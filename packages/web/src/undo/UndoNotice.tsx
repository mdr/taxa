import { CircleAlert, Redo2, Undo2 } from "lucide-react"
import styles from "./UndoNotice.module.css"
import { undoNoticeTestIds } from "./UndoNoticeTestIds.ts"
import { NoticeType, useUndo, type UndoNotice as Notice } from "./undo-service.ts"

const ICONS = { [NoticeType.UNDONE]: Undo2, [NoticeType.REDONE]: Redo2, [NoticeType.REFUSED]: CircleAlert }

/** "Undid: Marked H-3 done, Redo", after an undo or a redo, or why one couldn't be done. */
export const UndoNotice = ({ notice }: { notice: Notice }) => {
  const { undo, redo } = useUndo()
  const Icon = ICONS[notice.type]
  return (
    <div
      className={styles.notice}
      role={notice.type === NoticeType.REFUSED ? "alert" : "status"}
      data-testid={undoNoticeTestIds.notice}
    >
      <Icon size={16} className={styles.icon} aria-hidden />
      <span className={styles.text}>{notice.text}</span>
      {notice.type === NoticeType.UNDONE && (
        <button
          type="button"
          className={styles.again}
          onClick={() => void redo()}
          aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
          data-testid={undoNoticeTestIds.again}
          data-track="UndoNotice.redo"
        >
          Redo
        </button>
      )}
      {notice.type === NoticeType.REDONE && (
        <button
          type="button"
          className={styles.again}
          onClick={() => void undo()}
          aria-keyshortcuts="Meta+Z Control+Z"
          data-testid={undoNoticeTestIds.again}
          data-track="UndoNotice.undo"
        >
          Undo
        </button>
      )}
    </div>
  )
}
