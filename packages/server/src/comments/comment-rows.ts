import type { Comment } from "@taxa/shared/comments/comment"
import type { Actor } from "@taxa/shared/identity/actor"
import type { ActorIds } from "../activity/actor-names.ts"
import type { comments } from "../database/schema.ts"

export type CommentRow = typeof comments.$inferSelect

export const authorIdsOf = (row: CommentRow): ActorIds => ({
  userId: row.userId,
  agentId: row.agentId ?? undefined,
  agentContext: row.agentContext ?? undefined
})

export const commentOf = (row: CommentRow, actorOf: (ids: ActorIds) => Actor): Comment => ({
  id: row.id,
  taskId: row.taskId,
  author: actorOf(authorIdsOf(row)),
  body: row.body,
  createdAt: row.createdAt.toISOString(),
  ...(row.editedAt && { editedAt: row.editedAt.toISOString() }),
  version: row.version
})

export type CommentValues = Partial<Omit<CommentRow, "id" | "taskId" | "userId" | "createdAt">>

/** A comment as it's restored: no longer deleted. */
export const RESTORED_COMMENT: CommentValues = { deletedAt: null }

/** What deleting its task for good leaves of a comment. */
export const PURGED_COMMENT = { body: "", agentContext: null }
