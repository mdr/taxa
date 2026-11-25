import { z } from "zod"
import { VersionSchema } from "../domains/domain.ts"
import { ActorSchema } from "../identity/actor.ts"
import { CommentIdSchema, TaskIdSchema } from "../ids.ts"

export const COMMENTS_PATH = "/api/comments"

/** The longest a comment can be, as notes can. */
const MAX_COMMENT_LENGTH = 100_000

const BodySchema = z.string().trim().min(1).max(MAX_COMMENT_LENGTH)

/** A dated entry in a task's history, from a person or an agent: what happened, not what the task is. */
export const CommentSchema = z.object({
  id: CommentIdSchema,
  taskId: TaskIdSchema,
  author: ActorSchema,
  /** Markdown. */
  body: z.string(),
  createdAt: z.iso.datetime(),
  /** When its author last changed it. */
  editedAt: z.iso.datetime().optional(),
  version: VersionSchema
})

export type Comment = z.infer<typeof CommentSchema>

export const AddCommentRequestSchema = z.object({
  /** Chosen by the client (a UUIDv7), so it can show the comment at once. */
  id: CommentIdSchema.optional(),
  body: BodySchema
})

export type AddCommentRequest = z.input<typeof AddCommentRequestSchema>

export const EditCommentRequestSchema = z.object({ body: BodySchema })

export type EditCommentRequest = z.input<typeof EditCommentRequestSchema>
