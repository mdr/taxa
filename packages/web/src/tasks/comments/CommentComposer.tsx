import { Undo2 } from "lucide-react"
import styles from "./CommentComposer.module.css"
import { commentComposerTestIds } from "./CommentComposerTestIds.ts"
import {
  useCommentActions,
  useCommentDraft,
  useCommentPosting,
  useCommentProblem,
  useDeletedComment
} from "./comments-service.ts"

/** Where a comment is written, under the timeline, with the offer to bring back one just deleted. */
export const CommentComposer = () => {
  const { write, post, restore } = useCommentActions()
  const draft = useCommentDraft()
  const posting = useCommentPosting()
  const deleted = useDeletedComment()
  const problem = useCommentProblem()
  return (
    <div className={styles.composer}>
      {deleted && (
        <p className={styles.deleted} role="status" data-testid={commentComposerTestIds.deleted}>
          Comment deleted.
          <button
            type="button"
            className={styles.restore}
            onClick={() => void restore()}
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
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void post()
            if (event.key === "Escape") event.currentTarget.blur()
          }}
          placeholder="Add a comment: what's happened, or progress (Markdown)"
          aria-label="Add a comment"
          aria-keyshortcuts="Meta+Enter Control+Enter"
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
