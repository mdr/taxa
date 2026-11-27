import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"
import { SquareCheck } from "lucide-react"
import type { ReactNode } from "react"
import { useServiceState } from "../../services/service-hooks.ts"
import styles from "../list/TaskListPage.module.css"
import { taskListPageTestIds } from "../list/TaskListPageTestIds.ts"
import { BulkBar, BulkReport } from "./BulkBar.tsx"
import { useSelection } from "./selection-service.ts"
import type { BulkActions } from "./use-bulk-actions.ts"

/** In a list's header: starts choosing tasks to change together, or stops. */
export const SelectButton = () => {
  const selection = useSelection()
  const selecting = useServiceState(selection, (state) => state.selecting)
  return (
    <button
      type="button"
      className={styles.select}
      aria-pressed={selecting}
      onClick={selecting ? selection.stop : selection.start}
      title="Choose tasks to change together (Space on a task; shift-click a run of them)"
      data-testid={taskListPageTestIds.select}
      data-track="TaskListPage.select"
    >
      <SquareCheck size={15} aria-hidden />
      {selecting ? "Done selecting" : "Select"}
    </button>
  )
}

/**
 * At the foot of a list: while selecting, what can be done to the tasks
 * chosen; then what was done, to undo; otherwise `children`, the list's own
 * offer to undo, which would sit in the same place.
 */
export const SelectionFooter = ({
  listed,
  today,
  domains,
  bulk,
  children
}: {
  listed: readonly Task[]
  today: IsoDate
  domains: readonly Domain[]
  bulk: BulkActions
  children: ReactNode
}) => {
  const selection = useSelection()
  const selecting = useServiceState(selection, (state) => state.selecting)
  const chosen = useServiceState(selection, (state) => state.selected)
  if (selecting)
    return (
      <>
        {/* Room to scroll the last tasks up above the bar. */}
        <div className={styles.underBar} aria-hidden />
        <BulkBar
          selected={listed.filter(({ id }) => chosen.includes(id))}
          today={today}
          domains={domains}
          act={bulk.act}
        />
      </>
    )
  return bulk.report ? <BulkReport text={bulk.report} onUndo={bulk.undo} /> : children
}
