import type { Activity } from "@taxa/shared/activity/activity"
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

/** A task's changes and comments, oldest first; a change made at the same moment as a comment comes first. */
export const timeline = (changes: readonly Activity[], comments: readonly Comment[]): TimelineEntry[] =>
  [
    ...changes.map((change): TimelineEntry => ({ type: TimelineEntryType.CHANGE, at: change.at, change })),
    ...comments.map((comment): TimelineEntry => ({ type: TimelineEntryType.COMMENT, at: comment.createdAt, comment }))
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
