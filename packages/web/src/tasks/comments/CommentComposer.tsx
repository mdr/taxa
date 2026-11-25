import { Undo2 } from "lucide-react"
import styles from "./CommentComposer.module.css"
import { commentComposerTestIds } from "./CommentComposerTestIds.ts"
import type { TaskId } from "@taxa/shared/ids"
import { useCommentActions, useCommentDraft, useCommentPosting, useCommentProblem } from "./comments-service.ts"
import { useDeletedCommentLast, useUndo } from "../../undo/undo-service.ts"
import { sendsComment } from "./comment-keys.ts"

/**
 * Where a comment is written, under the timeline; and while deleting one is
 * the last change made, the offer to undo that.
 */
export const CommentComposer = ({ taskId }: { taskId: TaskId }) => {
  const { write, post } = useCommentActions()
  const { undo } = useUndo()
  const draft = useCommentDraft()
  const posting = useCommentPosting()
  const deleted = useDeletedCommentLast(taskId)
  const problem = useCommentProblem()
  return (
    <div className={styles.composer}>
      {deleted && (
        <p className={styles.deleted} role="status" data-testid={commentComposerTestIds.deleted}>
          Comment deleted.
          <button
            type="button"
            className={styles.restore}
            onClick={() => void undo()}
            aria-keyshortcuts="Meta+Z Control+Z"
            data-testid={commentComposerTestIds.restore}
            data-track="CommentComposer.restore"
          >
            <Undo2 size={14} aria-hidden /> Undo
          </button>
        </p>
      )}
      {problem && (
        <p className={styles.problem} role="alert" data-testid={commentComposerTestIds.problem}>
          {problem}
        </p>
      )}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          void post()
        }}
      >
        <textarea
          className={styles.text}
          value={draft}
          onChange={(event) => write(event.target.value)}
          onKeyDown={(event) => {
            if (sendsComment({ ...event, isComposing: event.nativeEvent.isComposing })) {
              // Not a new line: that's Shift+Enter.
              event.preventDefault()
              void post()
            }
            if (event.key === "Escape") event.currentTarget.blur()
          }}
          placeholder="Add a comment: what's happened, or progress (Markdown; Shift+Enter for a new line)"
          aria-label="Add a comment"
          aria-keyshortcuts="Enter"
          rows={Math.max(2, draft.split("\n").length)}
          data-testid={commentComposerTestIds.text}
          data-track="CommentComposer.text"
        />
        <button
          type="submit"
          className={styles.post}
          disabled={posting || draft.trim() === ""}
          data-testid={commentComposerTestIds.post}
          data-track="CommentComposer.post"
        >
          Comment
        </button>
      </form>
    </div>
  )
}
