import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Task } from "@taxa/shared/tasks/task"
import { useEffect, useState } from "react"
import { useTaskChanges } from "../changes/task-changes-service.ts"
import { UNDO_NOTICE_MS, useUndo } from "../../undo/undo-service.ts"
import { appliesTo, bulkLabel, changeFor, type BulkAction } from "./bulk-actions.ts"
import type { SelectionService } from "./selection-service.ts"

export interface BulkActions {
  act: (action: BulkAction) => void
  /** What the last action did, while it's shown. */
  report: string | undefined
  undo: () => void
}

/**
 * Makes one change to every task selected, as one change to undo, then stops
 * selecting. Each task's change goes as any other, so one changed elsewhere
 * meanwhile is refused alone, and its row says so.
 */
export const useBulkActions = (selection: SelectionService, listed: readonly Task[], today: IsoDate): BulkActions => {
  const changes = useTaskChanges()
  const history = useUndo()
  const [report, setReport] = useState<{ text: string; seq: number } | undefined>()
  useEffect(() => {
    if (!report) return undefined
    const timer = setTimeout(() => setReport(undefined), UNDO_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [report])
  const act = (action: BulkAction): void => {
    const chosen = selection.chosen()
    const tasks = appliesTo(
      action,
      listed.filter(({ id }) => chosen.includes(id))
    )
    selection.stop()
    if (tasks.length === 0) return
    const label = bulkLabel(action, tasks.length, today)
    void history
      .together(label, () => Promise.all(tasks.map((task) => changes.change(task, changeFor(action, task, today)))))
      .then((results) => {
        const refused = results.filter((result) => result === undefined).length
        const text = refused === 0 ? label : `${label}, but ${refused} couldn't be: see the list`
        setReport((last) => ({ text, seq: (last?.seq ?? 0) + 1 }))
      })
  }
  return {
    act,
    report: report?.text,
    undo: () => {
      setReport(undefined)
      void history.undo()
    }
  }
}
