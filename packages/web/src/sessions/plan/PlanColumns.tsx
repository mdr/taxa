import { useDroppable } from "@dnd-kit/core"
import type { ReactNode } from "react"
import styles from "./PlanEditor.module.css"
import { planEditorTestIds } from "./PlanEditorTestIds.ts"
import { PLAN_END, PLAN_GAP, SUGGESTIONS } from "./plan-drop.ts"

/** Room opened in the plan where a suggestion let go now would go, with the task's outline in it. */
export const Gap = ({ title }: { title: string }) => {
  const { setNodeRef } = useDroppable({ id: PLAN_GAP })
  return (
    <li ref={setNodeRef} className={styles.gap} data-gap data-testid={planEditorTestIds.gap} aria-hidden>
      {title}
    </li>
  )
}

/** The plan: a suggestion dropped on it, but not on a row, goes last; it lights up while one's over it. */
export const PlanColumn = ({
  accepting,
  receiving,
  children
}: {
  accepting: boolean
  receiving: boolean
  children: ReactNode
}) => {
  const { setNodeRef } = useDroppable({ id: PLAN_END, disabled: !accepting })
  return (
    <section
      ref={setNodeRef}
      className={`${styles.column} ${styles.planColumn} ${receiving ? styles.receiving : ""}`}
      aria-labelledby="plan-heading"
      data-receiving={receiving}
      data-testid={planEditorTestIds.planColumn}
    >
      {children}
    </section>
  )
}

/** The suggestions, which take a planned task dragged back to them out of the plan. */
export const SuggestionsColumn = ({ accepting, children }: { accepting: boolean; children: ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: SUGGESTIONS, disabled: !accepting })
  return (
    <section
      ref={setNodeRef}
      className={`${styles.column} ${accepting ? styles.takesBack : ""} ${accepting && isOver ? styles.takingBack : ""}`}
      aria-labelledby="suggestions-heading"
      data-testid={planEditorTestIds.suggestionsColumn}
    >
      {children}
    </section>
  )
}
