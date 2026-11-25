import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { carriedOverText, When } from "@taxa/shared/tasks/when"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Link } from "wouter"
import styles from "../sessions/Session.module.css"
import { PlanEditor, type PlanRow } from "../sessions/plan/PlanEditor.tsx"
import { QuickCapture } from "../tasks/list/QuickCapture.tsx"
import type { PlannedEntry } from "../sessions/plan/session-plan-service.ts"
import { minutesText } from "../sessions/session-text.ts"
import { queryKeys } from "../api/query-keys.ts"
import { taxaApi } from "../api/taxa-api.ts"
import { useToday } from "../dates/use-today.ts"
import { useServiceState } from "../services/service-hooks.ts"
import { useTaskChanges } from "../tasks/changes/task-changes-service.ts"
import { useTasks } from "../tasks/task-queries.ts"
import { TODAY_PATH } from "../tasks/when/when-paths.ts"
import { appAnalytics } from "../telemetry/app-telemetry.ts"
import { daySuggestions } from "./day-suggestions.ts"
import { DayPlanService } from "./day-plan-service.ts"
import { dayPlanPageTestIds } from "./DayPlanPageTestIds.ts"
import pageStyles from "./DayPlanPage.module.css"

/** Each of today's tasks as the editor shows it: its place, and whether it's carried over. */
const dayRows = (entries: readonly PlannedEntry[], today: IsoDate): PlanRow[] =>
  entries.map(({ task, minutes }, index) => ({
    task,
    minutes,
    span: String(index + 1),
    locked: false,
    detail: carriedOverText(task, today)
  }))

/** How long today's tasks are reckoned to take, by those with estimates. */
const estimatedText = (entries: readonly PlannedEntry[]): string => {
  const estimates = entries.flatMap(({ task }) => task.estimateMinutes ?? [])
  const unestimated = entries.length - estimates.length
  const total = estimates.reduce((sum, minutes) => sum + minutes, 0)
  if (entries.length === 0) return "Nothing planned yet."
  const parts = [
    `${entries.length} ${entries.length === 1 ? "task" : "tasks"}`,
    ...(estimates.length > 0 ? [`about ${minutesText(total)} estimated`] : []),
    ...(unestimated > 0 && estimates.length > 0 ? [`${unestimated} without an estimate`] : [])
  ]
  return parts.join(" · ")
}

/** Choosing today's tasks from suggestions, or any task, and putting them in order. */
export const DayPlanPage = () => {
  const today = useToday()
  const changes = useTaskChanges()
  const queryClient = useQueryClient()
  const [plan] = useState(
    () =>
      new DayPlanService(taxaApi, changes, appAnalytics, today, () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.allTasks })
      )
  )
  const todayTasks = useTasks({ when: "TODAY" })
  const tasks = useTasks({})
  const entries = useServiceState(plan, (state) => state.entries)
  const search = useServiceState(plan, (state) => state.search)
  const problem = useServiceState(plan, (state) => state.problem)
  useEffect(() => {
    if (todayTasks.data) plan.showToday(todayTasks.data)
  }, [plan, todayTasks.data])
  const planned = entries ?? []
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <h1 className={styles.heading} data-testid={dayPlanPageTestIds.heading}>
            Plan today
          </h1>
          <p className={styles.subtle}>
            What do you mean to do today? Put it in, in the order you'll do it.{" "}
            <span data-testid={dayPlanPageTestIds.estimated}>{estimatedText(planned)}</span>
          </p>
        </div>
        <Link href={TODAY_PATH} className={pageStyles.done} data-testid={dayPlanPageTestIds.done}>
          Done planning
        </Link>
      </header>
      {problem && (
        <p className={styles.problem} role="alert" data-testid={dayPlanPageTestIds.problem}>
          {problem}
        </p>
      )}
      <QuickCapture when={When.TODAY} />
      <PlanEditor
        rows={dayRows(planned, today)}
        suggestions={daySuggestions(
          tasks.data ?? [],
          today,
          planned.map(({ taskId }) => taskId),
          search
        )}
        search={search}
        onSearch={plan.search}
        onAdd={(task, at) => void plan.add(task, at)}
        onRemove={(taskId) => void plan.remove(taskId)}
        onMove={plan.move}
        onEstimated={plan.estimated}
        busy={entries === undefined}
        planTitle="Today"
        numbered
      />
    </section>
  )
}
