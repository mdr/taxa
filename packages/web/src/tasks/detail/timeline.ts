import { ActivityType, type Activity } from "@taxa/shared/activity/activity"
import type { Comment } from "@taxa/shared/comments/comment"

export enum TimelineEntryType {
  CHANGE = "CHANGE",
  COMMENT = "COMMENT"
}

interface ChangeEntry {
  type: TimelineEntryType.CHANGE
  at: string
  change: Activity
}

interface CommentEntry {
  type: TimelineEntryType.COMMENT
  at: string
  comment: Comment
}

export type TimelineEntry = ChangeEntry | CommentEntry

/** Changes worth showing whatever they changed. */
const NOTABLE_TYPES: ReadonlySet<ActivityType> = new Set([
  ActivityType.TASK_CREATED,
  ActivityType.TASK_DELETED,
  ActivityType.TASK_RESTORED,
  ActivityType.TASK_STATUS_CHANGED
])

/** Edits worth showing: where it stands, where it's filed, and whether it repeats. */
const NOTABLE_FIELDS: ReadonlySet<string> = new Set(["status", "domainId", "inboxUserId", "repeat"])

/**
 * Whether a change is one people mostly want to see: created, started,
 * done, cancelled, deleted, moved, made to repeat. Notes, dates, priority
 * and the like, and each time a repeating task is done or skipped (which its
 * history shows), go without saying.
 */
const isNotable = (change: Activity): boolean =>
  NOTABLE_TYPES.has(change.type) ||
  (change.type === ActivityType.TASK_UPDATED && Object.keys(change.changes).some((key) => NOTABLE_FIELDS.has(key)))

/**
 * A task's changes and comments, oldest first; a change made at the same
 * moment as a comment comes first. Unless all are asked for, only the
 * changes that matter.
 */
export const timeline = (changes: readonly Activity[], comments: readonly Comment[], all: boolean): TimelineEntry[] =>
  [
    ...changes
      .filter((change) => all || isNotable(change))
      .map((change): TimelineEntry => ({ type: TimelineEntryType.CHANGE, at: change.at, change })),
    ...comments.map((comment): TimelineEntry => ({ type: TimelineEntryType.COMMENT, at: comment.createdAt, comment }))
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

/** How many changes go without saying, hidden unless all are asked for. */
export const hiddenCount = (changes: readonly Activity[]): number =>
  changes.filter((change) => !isNotable(change)).length
