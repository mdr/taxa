import { and, asc, eq, isNull } from "drizzle-orm"
import type { z } from "zod"
import { ActivityType, type FieldChange } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import type { AddCommentRequestSchema, Comment, EditCommentRequestSchema } from "@taxa/shared/comments/comment"
import { commentId as newCommentId, uuidv7, type CommentId } from "@taxa/shared/ids"
import type { Instant, Version } from "@taxa/shared/units"
import { changeTo, recordActivity } from "../activity/activity-store.ts"
import { actorsNamed } from "../activity/actor-names.ts"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { comments } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"
import { callerFields } from "../telemetry/change-fields.ts"
import { LOG_CODES, type ServerLogCode, type ServerLogger } from "../telemetry/log.ts"
import { lookupOf } from "../tasks/task-service.ts"
import { findTask, type FoundTask } from "../tasks/task-store.ts"
import { authorIdsOf, commentOf, RESTORED_COMMENT, type CommentRow, type CommentValues } from "./comment-rows.ts"

const commentsOf = async (db: Db, rows: readonly CommentRow[]): Promise<Comment[]> => {
  const actorOf = await actorsNamed(db, rows.map(authorIdsOf))
  return rows.map((row) => commentOf(row, actorOf))
}

const commentFrom = async (db: Db, row: CommentRow): Promise<Comment> => (await commentsOf(db, [row]))[0]!

/** A task's comments, oldest first, leaving out deleted ones. */
export const listComments = async (db: Db, caller: Caller, ref: string): Promise<Comment[]> => {
  const { row: task } = await findTask(db, caller.user.id, lookupOf(ref))
  const rows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.taskId, task.id), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt), asc(comments.id))
  return commentsOf(db, rows)
}

/** A comment's log line: who, on which task, and its version; never what it says. */
const logComment = (log: ServerLogger, code: ServerLogCode, caller: Caller, task: FoundTask, comment: Comment): void =>
  log.info(code, "a comment changed", {
    ...callerFields(caller),
    taskId: task.row.id,
    domainId: task.row.domainId ?? undefined,
    commentId: comment.id,
    version: comment.version
  })

export const addComment = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  ref: string,
  { id, body }: z.infer<typeof AddCommentRequestSchema>,
  now: Instant
): Promise<Comment> => {
  const { comment, task } = await db.transaction(async (tx) => {
    const task = await findTask(tx, caller.user.id, lookupOf(ref))
    const commentId = id ?? newCommentId(uuidv7(now))
    if ((await tx.select({ id: comments.id }).from(comments).where(eq(comments.id, commentId))).length > 0)
      throw new ProblemError(ProblemType.INVALID_REQUEST, `A comment with id ${commentId} already exists.`)
    const [row] = await tx
      .insert(comments)
      .values({
        id: commentId,
        taskId: task.row.id,
        userId: caller.user.id,
        agentId: caller.agent?.id,
        agentContext: caller.agentContext,
        body,
        createdAt: new Date(now),
        version: 1
      })
      .returning()
    await recordActivity(tx, caller, now, {
      type: ActivityType.COMMENT_ADDED,
      entityId: commentId,
      domainId: task.row.domainId ?? undefined,
      version: 1,
      changes: { body: { to: body } }
    })
    return { comment: await commentFrom(tx, row!), task }
  })
  logComment(log, LOG_CODES.comment.added, caller, task, comment)
  return comment
}

/** What a change sets, and what it changed: nothing, if it changes nothing. An undo also says what it is, and which it undoes. */
interface Applied {
  values: CommentValues
  changes: Record<string, FieldChange>
  type?: ActivityType
  undoesVersion?: Version
}

const UNCHANGED: Applied = { values: {}, changes: {} }

interface CommentChange {
  type: ActivityType
  code: ServerLogCode
  apply: (row: CommentRow, tx: Db) => Applied | Promise<Applied>
}

const NOT_FOUND = (id: CommentId): ProblemError =>
  new ProblemError(ProblemType.NOT_FOUND, `There's no comment ${id} that you can see.`)

/**
 * Changes one comment in a transaction: locks it, refuses if the caller
 * can't see its task or didn't write it, or if `ifMatch` isn't its version,
 * and when anything changed, saves it with its version one up and logs it.
 */
const changeComment = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  id: CommentId,
  ifMatch: number | undefined,
  now: Instant,
  { type: changeType, code, apply }: CommentChange
): Promise<Comment> => {
  const { comment, task, changed } = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(comments).where(eq(comments.id, id)).for("update")
    if (!row) throw NOT_FOUND(id)
    const task = await findTask(tx, caller.user.id, { type: "ID", id: row.taskId }).catch(() => {
      throw NOT_FOUND(id)
    })
    if (row.userId !== caller.user.id || (row.agentId ?? undefined) !== caller.agent?.id)
      throw new ProblemError(ProblemType.FORBIDDEN, "Only whoever wrote a comment can change it.")
    if (ifMatch !== undefined && ifMatch !== row.version)
      throw new ProblemError(
        ProblemType.VERSION_CONFLICT,
        `That comment has changed since version ${ifMatch}: it's at version ${row.version} now.`,
        await commentFrom(tx, row)
      )
    const { values, changes, type = changeType, undoesVersion } = await apply(row, tx)
    if (Object.keys(changes).length === 0) return { comment: await commentFrom(tx, row), task, changed: false }
    const [saved] = await tx
      .update(comments)
      .set({ ...values, version: row.version + 1 })
      .where(eq(comments.id, id))
      .returning()
    await recordActivity(tx, caller, now, {
      type,
      entityId: id,
      domainId: task.row.domainId ?? undefined,
      version: row.version + 1,
      ...(undoesVersion !== undefined && { undoesVersion }),
      changes
    })
    return { comment: await commentFrom(tx, saved!), task, changed: true }
  })
  if (changed) logComment(log, code, caller, task, comment)
  return comment
}

export const editComment = (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  id: CommentId,
  { body }: z.infer<typeof EditCommentRequestSchema>,
  ifMatch: number | undefined,
  now: Instant
): Promise<Comment> =>
  changeComment(db, log, caller, id, ifMatch, now, {
    type: ActivityType.COMMENT_EDITED,
    code: LOG_CODES.comment.edited,
    apply: (row) => {
      if (row.deletedAt)
        throw new ProblemError(ProblemType.INVALID_REQUEST, "That comment is deleted: restore it to edit it.")
      return row.body === body
        ? UNCHANGED
        : { values: { body, editedAt: new Date(now) }, changes: { body: { from: row.body, to: body } } }
    }
  })

const deletion = (row: CommentRow, now: Instant): Applied =>
  row.deletedAt
    ? UNCHANGED
    : { values: { deletedAt: new Date(now) }, changes: { deletedAt: { to: new Date(now).toISOString() } } }

const restoration = (row: CommentRow): Applied =>
  row.deletedAt
    ? { values: RESTORED_COMMENT, changes: { deletedAt: { from: row.deletedAt.toISOString() } } }
    : UNCHANGED

/** Deleting a comment: soft, so it can be restored. */
export const deleteComment = (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  id: CommentId,
  ifMatch: number | undefined,
  now: Instant
): Promise<Comment> =>
  changeComment(db, log, caller, id, ifMatch, now, {
    type: ActivityType.COMMENT_DELETED,
    code: LOG_CODES.comment.deleted,
    apply: (row) => deletion(row, now)
  })

export const restoreComment = (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  id: CommentId,
  now: Instant
): Promise<Comment> =>
  changeComment(db, log, caller, id, undefined, now, {
    type: ActivityType.COMMENT_RESTORED,
    code: LOG_CODES.comment.restored,
    apply: restoration
  })

const CHANGED_SINCE = (): ProblemError =>
  new ProblemError(
    ProblemType.VERSION_CONFLICT,
    "That comment has been changed since, so undoing that would lose it: undo the later change first."
  )

/** What undoing a change to a comment does: it's deleted, restored, or says what it said before. */
const undone = (type: ActivityType, changes: Record<string, FieldChange>, row: CommentRow, now: Instant): Applied => {
  switch (type) {
    case ActivityType.COMMENT_ADDED:
    case ActivityType.COMMENT_RESTORED:
      return { ...deletion(row, now), type: ActivityType.COMMENT_DELETED }
    case ActivityType.COMMENT_DELETED:
      return { ...restoration(row), type: ActivityType.COMMENT_RESTORED }
    case ActivityType.COMMENT_EDITED: {
      const { from, to } = changes["body"] ?? {}
      if (row.deletedAt || row.body !== to || typeof from !== "string") throw CHANGED_SINCE()
      return {
        values: { body: from, editedAt: new Date(now) },
        changes: { body: { from: row.body, to: from } },
        type: ActivityType.COMMENT_EDITED
      }
    }
    case ActivityType.DOMAIN_CREATED:
    case ActivityType.TASK_CREATED:
    case ActivityType.TASK_UPDATED:
    case ActivityType.TASK_STATUS_CHANGED:
    case ActivityType.TASK_DELETED:
    case ActivityType.TASK_RESTORED:
      throw new ProblemError(ProblemType.INVALID_REQUEST, "That change isn't to a comment.")
  }
}

/**
 * Takes back the change that brought a comment to `version`: a comment
 * added or restored is deleted, a deleted one restored, and an edit put back,
 * unless it's been changed since. Only its author can. An undo is a change
 * too, so undoing it again redoes what it undid.
 */
export const undoComment = (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  id: CommentId,
  version: Version,
  now: Instant
): Promise<Comment> =>
  changeComment(db, log, caller, id, undefined, now, {
    type: ActivityType.COMMENT_EDITED,
    code: LOG_CODES.comment.undone,
    apply: async (row, tx) => {
      const change = await changeTo(tx, id, version)
      if (!change)
        throw new ProblemError(ProblemType.NOT_FOUND, `That comment has no change to version ${version} to undo.`)
      return { ...undone(change.type, change.changes, row, now), undoesVersion: version }
    }
  })
