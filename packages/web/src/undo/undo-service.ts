import type { Comment } from "@taxa/shared/comments/comment"
import type { CommentId, TaskId } from "@taxa/shared/ids"
import type { Task } from "@taxa/shared/tasks/task"
import type { Ms, Version } from "@taxa/shared/units"
import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import { problemMessage } from "../api/problem-message.ts"
import { AbstractService } from "../services/abstract-service.ts"
import type { Scheduler } from "../services/scheduler.ts"
import { createServiceContext, useService, useServiceState } from "../services/service-hooks.ts"
import type { ChangeOrder } from "../tasks/changes/change-order.ts"
import type { TaskCache } from "../tasks/changes/task-cache.ts"
import type { ChangeHistory, TaskChange } from "../tasks/changes/task-changes-service.ts"
import { addedLabel, changedLabel, changeLabel } from "./change-label.ts"
import type { Analytics } from "../telemetry/analytics.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"

/** How long the notice of an undo stays. */
export const UNDO_NOTICE_MS: Ms = 6000

/** How many changes back undo can go. */
const HISTORY = 100

export interface UndoApi {
  undoTask: (ref: string, version: Version) => Promise<Task>
  undoComment: (id: CommentId, version: Version) => Promise<Comment>
}

/** Where comments are shown: an undone change to one is shown there. */
export interface CommentCache {
  show: (comment: Comment) => Promise<void>
}

enum StepType {
  TASK = "TASK",
  COMMENT = "COMMENT",
  GROUP = "GROUP"
}

/** A change to a task that can be undone, or redone: the version it brought the task to. */
interface TaskStep {
  type: StepType.TASK
  taskId: TaskId
  version: Version
  label: string
}

/** A change to a comment that can be undone, or redone: the version it brought the comment to. */
interface CommentStep {
  type: StepType.COMMENT
  commentId: CommentId
  taskId: TaskId
  version: Version
  label: string
  /** Whether the change deleted it, so it can be offered back. */
  deletes: boolean
}

/** Changes made together, to several tasks at once: undone and redone together. */
interface GroupStep {
  type: StepType.GROUP
  steps: readonly TaskStep[]
  label: string
}

type Step = TaskStep | CommentStep | GroupStep

/** A change to a comment, made in turn with the tab's other changes and noted to undo. */
export interface CommentChange {
  /** The comment changed; none for one being added. */
  id: CommentId | undefined
  make: () => Promise<Comment>
  /** What it does, in a few words, for the notice once it's undone: `Commented on H-3`. */
  label: string
  /** Whether it deletes the comment. */
  deletes?: boolean
}

export enum NoticeType {
  UNDONE = "UNDONE",
  REDONE = "REDONE",
  REFUSED = "REFUSED"
}

export interface UndoNotice {
  type: NoticeType
  text: string
}

export interface UndoState {
  /** Changes made here, oldest first: undo takes back the last. */
  undoable: readonly Step[]
  /** Changes undone, oldest first: redo puts back the last. */
  redoable: readonly Step[]
  notice: UndoNotice | undefined
}

/** A change to a task undone or redone: the version it had brought the task to, and the task now. */
export interface Undone {
  taskId: TaskId
  version: Version
  task: Task
}

export interface UndoActions extends ChangeHistory {
  /** Adds a task, in turn with the tab's other changes, noting it to undo. */
  add: (adding: () => Promise<Task>) => Promise<Task>
  /** Makes a change to a comment, in turn with the tab's other changes, noting it to undo; refused, it rejects. */
  changeComment: (change: CommentChange) => Promise<Comment>
  /** Undoes the last change asked for here, once it's been answered; what that was if it was to a task, unless there was none or it was refused. */
  undo: () => Promise<Undone | undefined>
  redo: () => Promise<Undone | undefined>
  /** Undoes the change that brought a task to a version, by default the one it's at, whether made here or not; the task then, or undefined if refused. */
  undoChange: (task: Task, version?: Version) => Promise<Task | undefined>
  dismiss: () => void
  /** Whether the change that brought a task to its version is the last made here, which undo would take back. */
  isLatest: (task: Task) => boolean
  /** Makes changes to several tasks, noted as one, so one undo takes them all back: `label` says what, as `Moved 3 tasks`. */
  together: <T>(label: string, make: () => Promise<T>) => Promise<T>
}

const taskStep = (task: Task, label: string): TaskStep => ({
  type: StepType.TASK,
  taskId: task.id,
  version: task.version,
  label
})

const isLatestIn = ({ undoable }: UndoState, task: Task): boolean => {
  const last = undoable.at(-1)
  return last?.type === StepType.TASK && last.taskId === task.id && last.version === task.version
}

/** Whether the last change made here deleted a comment on this task, which undo would bring back. */
const deletedCommentLastIn = ({ undoable }: UndoState, taskId: TaskId): boolean => {
  const last = undoable.at(-1)
  return last?.type === StepType.COMMENT && last.deletes && last.taskId === taskId
}

/** What undoing or redoing a step came to: the task, for a change to one. */
interface Taken {
  task: Task | undefined
}

/**
 * Undo and redo for every change made in this tab, through the server, which
 * takes back the change that brought a task to a version: so an undo is a
 * change too, and the history survives changes made elsewhere in between,
 * unless they changed what's being undone.
 */
export class UndoService extends AbstractService<UndoState> implements UndoActions {
  readonly #api: UndoApi
  readonly #cache: TaskCache
  readonly #comments: CommentCache
  readonly #analytics: Analytics
  readonly #scheduler: Scheduler
  readonly #order: ChangeOrder
  #cancelNotice: (() => void) | undefined
  /** The changes made so far by changes being made together. */
  #gathering: TaskStep[] | undefined

  constructor(
    api: UndoApi,
    cache: TaskCache,
    comments: CommentCache,
    analytics: Analytics,
    scheduler: Scheduler,
    order: ChangeOrder
  ) {
    super({ undoable: [], redoable: [], notice: undefined })
    this.#api = api
    this.#order = order
    this.#cache = cache
    this.#comments = comments
    this.#analytics = analytics
    this.#scheduler = scheduler
  }

  readonly recordChange = (task: Task, change: TaskChange): void =>
    this.#record(taskStep(task, changeLabel(change, task)))

  readonly add = (adding: () => Promise<Task>): Promise<Task> =>
    this.#order.add(async () => {
      const task = await adding()
      this.#record(taskStep(task, addedLabel(task)))
      return task
    })

  readonly changeComment = ({ id, make, label, deletes = false }: CommentChange): Promise<Comment> => {
    const made = async (): Promise<Comment> => {
      const comment = await make()
      this.#record({
        type: StepType.COMMENT,
        commentId: comment.id,
        taskId: comment.taskId,
        version: comment.version,
        label,
        deletes
      })
      return comment
    }
    return id === undefined ? this.#order.add(made) : this.#order.change(id, made)
  }

  readonly together = async <T>(label: string, make: () => Promise<T>): Promise<T> => {
    const gathered: TaskStep[] = []
    this.#gathering = gathered
    try {
      return await make()
    } finally {
      this.#gathering = undefined
      const [only] = gathered
      if (gathered.length > 1) this.#record({ type: StepType.GROUP, steps: gathered, label })
      else if (only) this.#record(only)
    }
  }

  #record(step: Step): void {
    if (this.#gathering && step.type === StepType.TASK) {
      this.#gathering.push(step)
      return
    }
    // What an undo did is old news once something else changes.
    this.dismiss()
    this.setState({ undoable: [...this.state.undoable, step].slice(-HISTORY), redoable: [] })
  }

  readonly undo = (): Promise<Undone | undefined> =>
    this.#order.undo(async () => {
      const step = this.state.undoable.at(-1)
      return step && this.#undone(step, await this.#take(step, true))
    })

  readonly redo = (): Promise<Undone | undefined> =>
    this.#order.undo(async () => {
      const step = this.state.redoable.at(-1)
      return step && this.#undone(step, await this.#take(step, false))
    })

  readonly undoChange = (task: Task, version: Version = task.version): Promise<Task | undefined> =>
    this.#order.undo(async () => {
      const step = this.state.undoable.find(
        (other) => other.type === StepType.TASK && other.taskId === task.id && other.version === version
      )
      return (await this.#take(step ?? { ...taskStep(task, changedLabel(task)), version }, true))?.task
    })

  /** As #takeTask, for each change in a group, latest first; the group of those taken, and why any weren't. */
  async #takeGroup(step: GroupStep, undoing: boolean): Promise<{ group: GroupStep | undefined; refused: string[] }> {
    const taken: TaskStep[] = []
    const refused: string[] = []
    for (const each of [...step.steps].reverse()) {
      try {
        const { version } = await this.#takeTask(each, undoing)
        taken.unshift({ ...each, version })
      } catch (error) {
        refused.push(problemMessage(error))
      }
    }
    return { group: taken.length > 0 ? { ...step, steps: taken } : undefined, refused }
  }

  /** Undoes or redoes a group: those that can be, with a notice saying what couldn't. */
  async #takeAll(step: GroupStep, undoing: boolean): Promise<Taken> {
    const { undoable, redoable } = this.state
    const without = (steps: readonly Step[]): Step[] => steps.filter((other) => other !== step)
    this.setState({ undoable: without(undoable), redoable: without(redoable) })
    const { group, refused } = await this.#takeGroup(step, undoing)
    if (group)
      this.setState(
        undoing ? { redoable: [...this.state.redoable, group] } : { undoable: [...this.state.undoable, group] }
      )
    const done = `${undoing ? "Undid" : "Redid"}: ${step.label}`
    const [problem] = refused
    if (problem === undefined) this.#notify({ type: undoing ? NoticeType.UNDONE : NoticeType.REDONE, text: done })
    else
      this.#notify({
        type: NoticeType.REFUSED,
        text: group ? `${done}, but not ${refused.length} of them: ${problem}` : problem
      })
    return { task: undefined }
  }

  #undone(step: Step, taken: Taken | undefined): Undone | undefined {
    return step.type === StepType.TASK && taken?.task
      ? { taskId: step.taskId, version: step.version, task: taken.task }
      : undefined
  }

  readonly dismiss = (): void => {
    this.#cancelNotice?.()
    this.#cancelNotice = undefined
    if (this.state.notice) this.setState({ notice: undefined })
  }

  readonly isLatest = (task: Task): boolean => isLatestIn(this.state, task)

  readonly dispose = (): void => this.#cancelNotice?.()

  /** Has the server undo the change that brought a task to a step's version: the version that brings it to, and the task. */
  async #takeTask(step: TaskStep, undoing: boolean): Promise<{ version: Version; taken: Taken }> {
    const task = await this.#api.undoTask(step.taskId, step.version)
    await this.#cache.show(task)
    this.#analytics.track(
      undoing ? ANALYTICS_CODES.task.undone : ANALYTICS_CODES.task.redone,
      `${undoing ? "undid" : "redid"} a change to ${task.ref}`,
      { taskId: task.id, taskRef: task.ref }
    )
    return { version: task.version, taken: { task } }
  }

  /** As #takeTask, for a comment. */
  async #takeComment(step: CommentStep, undoing: boolean): Promise<{ version: Version; taken: Taken }> {
    const comment = await this.#api.undoComment(step.commentId, step.version)
    await this.#comments.show(comment)
    this.#analytics.track(
      undoing ? ANALYTICS_CODES.comment.undone : ANALYTICS_CODES.comment.redone,
      `${undoing ? "undid" : "redid"} a change to a comment`,
      { taskId: comment.taskId, commentId: comment.id }
    )
    return { version: comment.version, taken: { task: undefined } }
  }

  /**
   * Undoes a step, or redoes one: either way, the server undoes the change
   * that brought its task or comment to its version. Never rejects. If the
   * server's never reached, the step stays where it was, to try again.
   */
  async #take(step: Step, undoing: boolean): Promise<Taken | undefined> {
    if (step.type === StepType.GROUP) return this.#takeAll(step, undoing)
    const without = (steps: readonly Step[]): Step[] => steps.filter((other) => other !== step)
    const { undoable, redoable } = this.state
    this.setState({ undoable: without(undoable), redoable: without(redoable) })
    try {
      const { version, taken } =
        step.type === StepType.TASK ? await this.#takeTask(step, undoing) : await this.#takeComment(step, undoing)
      const next = { ...step, version }
      this.setState(
        undoing ? { redoable: [...this.state.redoable, next] } : { undoable: [...this.state.undoable, next] }
      )
      this.#notify(
        undoing
          ? { type: NoticeType.UNDONE, text: `Undid: ${step.label}` }
          : { type: NoticeType.REDONE, text: `Redid: ${step.label}` }
      )
      return taken
    } catch (error) {
      if (!(error instanceof TaxaApiError))
        this.setState({
          undoable: undoable.includes(step) ? [...undoable] : this.state.undoable,
          redoable: redoable.includes(step) ? [...redoable] : this.state.redoable
        })
      this.#notify({ type: NoticeType.REFUSED, text: problemMessage(error) })
      return undefined
    }
  }

  #notify(notice: UndoNotice): void {
    this.#cancelNotice?.()
    this.setState({ notice })
    this.#cancelNotice = this.#scheduler.after(UNDO_NOTICE_MS, () => {
      this.#cancelNotice = undefined
      this.setState({ notice: undefined })
    })
  }
}

export const UndoContext = createServiceContext<UndoService>()

export const useUndo = (): UndoActions => useService(UndoContext)

export const useIsLatestChange = (task: Task): boolean =>
  useServiceState(useService(UndoContext), (state) => isLatestIn(state, task))

/** Whether the last change made here deleted a comment on this task: it's offered back. */
export const useDeletedCommentLast = (taskId: TaskId): boolean =>
  useServiceState(useService(UndoContext), (state) => deletedCommentLastIn(state, taskId))

export const useUndoNotice = (): UndoNotice | undefined =>
  useServiceState(useService(UndoContext), ({ notice }) => notice)
