import { ActivityType, type Activity } from "@taxa/shared/activity/activity"
import type { Comment } from "@taxa/shared/comments/comment"

export enum TimelineEntryType {
  CHANGE = "CHANGE",
  COMMENT = "COMMENT",
  /** Changes that go without saying, folded into one line until asked for. */
  FOLD = "FOLD"
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

interface FoldEntry {
  type: TimelineEntryType.FOLD
  at: string
  changes: Activity[]
}

export type TimelineEntry = ChangeEntry | CommentEntry | FoldEntry

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
 * moment as a comment comes first. Changes that go without saying are folded,
 * each run of them into one entry, where they happened.
 */
export const timeline = (changes: readonly Activity[], comments: readonly Comment[]): TimelineEntry[] => {
  const all: (ChangeEntry | CommentEntry)[] = [
    ...changes.map((change): ChangeEntry => ({ type: TimelineEntryType.CHANGE, at: change.at, change })),
    ...comments.map((comment): CommentEntry => ({ type: TimelineEntryType.COMMENT, at: comment.createdAt, comment }))
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const entries: TimelineEntry[] = []
  for (const entry of all) {
    const last = entries.at(-1)
    if (entry.type === TimelineEntryType.COMMENT || isNotable(entry.change)) entries.push(entry)
    else if (last?.type === TimelineEntryType.FOLD) last.changes.push(entry.change)
    else entries.push({ type: TimelineEntryType.FOLD, at: entry.at, changes: [entry.change] })
  }
  return entries
}
