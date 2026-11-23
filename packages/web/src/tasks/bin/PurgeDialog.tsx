import { useEffect, useRef } from "react"
import styles from "./PurgeDialog.module.css"
import { purgeDialogTestIds } from "./PurgeDialogTestIds.ts"
import { BinQuestionType, type BinQuestion, type BinService } from "./bin-service.ts"
import { useServiceState } from "../../services/service-hooks.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { trackUi, UiEvent } from "../../telemetry/ui-tracking.ts"

const tasks = (count: number): string => (count === 1 ? "The task" : `All ${count} tasks`)

const textFor = (question: BinQuestion): { heading: string; detail: string; confirm: string } =>
  question.type === BinQuestionType.ONE
    ? {
        heading: `Delete “${question.task.title}” forever?`,
        detail: "It can’t be restored.",
        confirm: "Delete forever"
      }
    : {
        heading: "Empty the bin?",
        detail: `${tasks(question.count)} in it will be deleted forever. They can’t be restored.`,
        confirm: "Empty bin"
      }

/** Asks before deleting tasks for good. */
export const PurgeDialog = ({ bin, question }: { bin: BinService; question: BinQuestion }) => {
  const purging = useServiceState(bin, (state) => state.purging)
  const problem = useServiceState(bin, (state) => state.problem)
  const dialog = useRef<HTMLDialogElement>(null)
  // Not closed on unmount: closing fires onClose, which in development's double effects shuts it at once.
  useEffect(() => {
    dialog.current?.showModal()
    trackUi(appAnalytics, UiEvent.OPENED, "PurgeDialog.dialog")
  }, [])
  const { heading, detail, confirm } = textFor(question)
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      onClose={bin.cancel}
      aria-labelledby="purge-heading"
      aria-describedby="purge-detail"
      data-testid={purgeDialogTestIds.dialog}
      data-track="PurgeDialog.dialog"
    >
      <h2 id="purge-heading" className={styles.heading} data-testid={purgeDialogTestIds.heading}>
        {heading}
      </h2>
      <p id="purge-detail" className={styles.detail}>
        {detail}
      </p>
      {problem && (
        <p role="alert" className={styles.problem} data-testid={purgeDialogTestIds.problem}>
          {problem}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancel}
          onClick={() => dialog.current?.close()}
          autoFocus
          data-testid={purgeDialogTestIds.cancel}
          data-track="PurgeDialog.cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.confirm}
          onClick={() => void bin.confirm()}
          disabled={purging}
          data-testid={purgeDialogTestIds.confirm}
          data-track="PurgeDialog.confirm"
        >
          {confirm}
        </button>
      </div>
    </dialog>
  )
}
