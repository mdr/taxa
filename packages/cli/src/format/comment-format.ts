import type { Comment } from "@taxa/shared/comments/comment"
import type { TimeZone } from "@taxa/shared/dates/plain-date"
import { actorText } from "@taxa/shared/identity/actor-text"
import { localTime } from "./local-time.ts"

/** How many of a task's comments `taxa show` shows: the latest. */
const SHOWN_COMMENTS = 3

const commentText = (comment: Comment, timeZone: TimeZone): string =>
  [
    `${localTime(comment.createdAt, timeZone)}  ${actorText(comment.author)}${comment.editedAt ? " (edited)" : ""}`,
    ...comment.body.split("\n").map((line) => (line === "" ? "" : `  ${line}`))
  ].join("\n")

/** Each comment, oldest first: when and who, then what it says, indented. */
export const commentLines = (comments: readonly Comment[], timeZone: TimeZone): string =>
  comments.length === 0 ? "No comments." : comments.map((comment) => commentText(comment, timeZone)).join("\n\n")

/** The latest few comments, under a heading saying how to see the rest. */
export const latestComments = (comments: readonly Comment[], ref: string, timeZone: TimeZone): string => {
  if (comments.length === 0) return ""
  const earlier = comments.length - SHOWN_COMMENTS
  const heading =
    earlier > 0 ? `Comments, the latest ${SHOWN_COMMENTS} (all ${comments.length}: taxa comments ${ref})` : "Comments"
  return `\n\n${heading}\n\n${commentLines(comments.slice(-SHOWN_COMMENTS), timeZone)}`
}
