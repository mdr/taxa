import type { AddCommentRequest, Comment, EditCommentRequest } from "@taxa/shared/comments/comment"
import type { CommentId, TaskId } from "@taxa/shared/ids"
import type { Version } from "@taxa/shared/units"
import { problemMessage } from "../../api/problem-message.ts"
import { AbstractService } from "../../services/abstract-service.ts"
import { createServiceContext, useService, useServiceState } from "../../services/service-hooks.ts"
import type { Analytics } from "../../telemetry/analytics.ts"
import { ANALYTICS_CODES, type AnalyticsCode } from "../../telemetry/codes.ts"

export interface CommentsApi {
  addComment: (ref: string, request: AddCommentRequest, idempotencyKey?: string) => Promise<Comment>
  editComment: (id: CommentId, request: EditCommentRequest, ifMatch?: Version) => Promise<Comment>
  deleteComment: (id: CommentId, ifMatch?: Version) => Promise<Comment>
  restoreComment: (id: CommentId) => Promise<Comment>
}

export interface CommentsState {
  /** The comment being written. */
  draft: string
  /** Waiting for the server to add it. */
  posting: boolean
  /** The comment being edited, and what it says so far. */
  editing: { id: CommentId; body: string } | undefined
  /** The comment last deleted here: offered back until another is deleted or the page is left. */
  deleted: Comment | undefined
  /** Why the last change couldn't be made. */
  problem: string | undefined
}

export interface CommentsActions {
  write: (draft: string) => void
  post: () => Promise<void>
  startEditing: (comment: Comment) => void
  writeEdit: (body: string) => void
  cancelEditing: () => void
  saveEdit: (comment: Comment) => Promise<void>
  remove: (comment: Comment) => Promise<void>
  restore: () => Promise<void>
}

/** Writing, editing, deleting and restoring one task's comments. */
export class CommentsService extends AbstractService<CommentsState> implements CommentsActions {
  readonly #api: CommentsApi
  readonly #taskId: TaskId
  readonly #refresh: () => Promise<void>
  readonly #analytics: Analytics

  /** `refresh` reloads the comments shown, once they've changed. */
  constructor(api: CommentsApi, taskId: TaskId, refresh: () => Promise<void>, analytics: Analytics) {
    super({ draft: "", posting: false, editing: undefined, deleted: undefined, problem: undefined })
    this.#api = api
    this.#taskId = taskId
    this.#refresh = refresh
    this.#analytics = analytics
  }

  readonly write = (draft: string): void => this.setState({ draft })

  /** Adds the comment written so far, if there's anything in it. */
  readonly post = async (): Promise<void> => {
    const { draft, posting } = this.state
    if (posting || draft.trim() === "") return
    this.setState({ posting: true, problem: undefined })
    await this.#attempt(
      async () => {
        // A fresh key per comment, so a retried request can't add it twice.
        const added = await this.#api.addComment(this.#taskId, { body: draft }, crypto.randomUUID())
        this.#track(ANALYTICS_CODES.comment.added, "commented", added)
        this.setState({ draft: "" })
      },
      () => this.setState({ posting: false })
    )
  }

  readonly startEditing = (comment: Comment): void =>
    this.setState({ editing: { id: comment.id, body: comment.body }, problem: undefined })

  readonly writeEdit = (body: string): void => {
    const { editing } = this.state
    if (editing) this.setState({ editing: { ...editing, body } })
  }

  readonly cancelEditing = (): void => this.setState({ editing: undefined, problem: undefined })

  /** Saves the edit, refused if someone changed it since it was shown. */
  readonly saveEdit = async (comment: Comment): Promise<void> => {
    const { editing } = this.state
    if (!editing || editing.id !== comment.id) return
    if (editing.body.trim() === comment.body || editing.body.trim() === "") {
      this.cancelEditing()
      return
    }
    await this.#attempt(async () => {
      const edited = await this.#api.editComment(comment.id, { body: editing.body }, comment.version)
      this.#track(ANALYTICS_CODES.comment.edited, "edited a comment", edited)
      this.setState({ editing: undefined })
    })
  }

  readonly remove = async (comment: Comment): Promise<void> => {
    await this.#attempt(async () => {
      const deleted = await this.#api.deleteComment(comment.id, comment.version)
      this.#track(ANALYTICS_CODES.comment.deleted, "deleted a comment", deleted)
      this.setState({ deleted, editing: undefined })
    })
  }

  /** Brings back the comment last deleted here. */
  readonly restore = async (): Promise<void> => {
    const { deleted } = this.state
    if (!deleted) return
    await this.#attempt(async () => {
      const restored = await this.#api.restoreComment(deleted.id)
      this.#track(ANALYTICS_CODES.comment.restored, "restored a comment", restored)
      this.setState({ deleted: undefined })
    })
  }

  async #attempt(change: () => Promise<void>, always: () => void = () => undefined): Promise<void> {
    this.setState({ problem: undefined })
    try {
      await change()
    } catch (error) {
      this.setState({ problem: problemMessage(error) })
    }
    always()
    await this.#refresh()
  }

  #track(code: AnalyticsCode, msg: string, comment: Comment): void {
    this.#analytics.track(code, msg, { taskId: this.#taskId, commentId: comment.id })
  }
}

export const CommentsContext = createServiceContext<CommentsService>()

export const useCommentActions = (): CommentsActions => useService(CommentsContext)

export const useCommentDraft = (): string => useServiceState(useService(CommentsContext), (state) => state.draft)

export const useCommentPosting = (): boolean => useServiceState(useService(CommentsContext), (state) => state.posting)

/** What the comment says so far, while it's being edited. */
export const useEditedBody = (id: CommentId): string | undefined =>
  useServiceState(useService(CommentsContext), (state) => (state.editing?.id === id ? state.editing.body : undefined))

export const useDeletedComment = (): Comment | undefined =>
  useServiceState(useService(CommentsContext), (state) => state.deleted)

export const useCommentProblem = (): string | undefined =>
  useServiceState(useService(CommentsContext), (state) => state.problem)
