import type { Comment } from "@taxa/shared/comments/comment"
import { realClock } from "@taxa/shared/clock"
import { actorText } from "@taxa/shared/identity/actor-text"
import { Bot, Pencil, Trash2 } from "lucide-react"
import { useEffect, useRef } from "react"
import styles from "./CommentCard.module.css"
import { commentCardTestIds } from "./CommentCardTestIds.ts"
import { useCommentActions, useEditedBody } from "./comments-service.ts"
import { sendsComment } from "./comment-keys.ts"
import { browserTimeZone } from "../../dates/browser-time-zone.ts"
import { relativeTime } from "../../dates/relative-time.ts"
import { MarkdownView } from "../../notes/MarkdownView.tsx"

/** One comment in a task's timeline: who wrote it and when, and, for its author, ways to edit or delete it. */
export const CommentCard = ({ comment, mine }: { comment: Comment; mine: boolean }) => {
  const { startEditing, writeEdit, cancelEditing, saveEdit, remove } = useCommentActions()
  const edited = useEditedBody(comment.id)
  const editing = edited !== undefined
  // Asked to edit it: the field is where they'll type next.
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) field.current?.focus()
  }, [editing])
  const author = actorText(comment.author)
  return (
    <li className={styles.comment} data-testid={commentCardTestIds.comment}>
      <span className={styles.avatar} aria-hidden>
        {comment.author.agent ? <Bot size={12} /> : author.charAt(0)}
      </span>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.author} data-testid={commentCardTestIds.author}>
            {author}
          </span>
          <time
            className={styles.when}
            dateTime={comment.createdAt}
            title={new Date(comment.createdAt).toLocaleString()}
          >
            {relativeTime(Date.parse(comment.createdAt), realClock.now(), browserTimeZone())}
          </time>
          {comment.editedAt && (
            <span className={styles.edited} data-testid={commentCardTestIds.edited}>
              edited
            </span>
          )}
          {mine && edited === undefined && (
            <span className={styles.actions}>
              <button
                type="button"
                className={styles.action}
                onClick={() => startEditing(comment)}
                aria-label="Edit this comment"
                title="Edit"
                data-testid={commentCardTestIds.edit}
                data-track="CommentCard.edit"
              >
                <Pencil size={14} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.action}
                onClick={() => void remove(comment)}
                aria-label="Delete this comment"
                title="Delete"
                data-testid={commentCardTestIds.delete}
                data-track="CommentCard.delete"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </span>
          )}
        </div>
        {edited === undefined ? (
          <MarkdownView markdown={comment.body} className={styles.body} testId={commentCardTestIds.body} />
        ) : (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              void saveEdit(comment)
            }}
          >
            <textarea
              className={styles.editor}
              value={edited}
              onChange={(event) => writeEdit(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelEditing()
                if (sendsComment({ ...event, isComposing: event.nativeEvent.isComposing })) {
                  event.preventDefault()
                  void saveEdit(comment)
                }
              }}
              aria-label="Comment"
              rows={Math.max(3, edited.split("\n").length)}
              ref={field}
              data-testid={commentCardTestIds.editor}
              data-track="CommentCard.editor"
            />
            <span className={styles.buttons}>
              <button
                type="submit"
                className={styles.save}
                data-testid={commentCardTestIds.save}
                data-track="CommentCard.save"
              >
                Save
              </button>
              <button
                type="button"
                className={styles.cancel}
                onClick={cancelEditing}
                data-testid={commentCardTestIds.cancel}
                data-track="CommentCard.cancel"
              >
                Cancel
              </button>
            </span>
          </form>
        )}
      </div>
    </li>
  )
}
