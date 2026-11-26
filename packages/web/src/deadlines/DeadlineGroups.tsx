import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"
import styles from "./DeadlineGroups.module.css"
import { deadlineGroupsTestIds } from "./DeadlineGroupsTestIds.ts"
import { deadlineGroups } from "./deadlines.ts"
import { TaskRow } from "../tasks/list/row/TaskRow.tsx"

/** The Deadlines list: its tasks under when they're due, overdue first, each saying how long it has. */
export const DeadlineGroups = ({
  tasks,
  today,
  domains,
  onDelete
}: {
  tasks: readonly Task[]
  today: IsoDate
  domains: readonly Domain[]
  onDelete: (task: Task) => void
}) =>
  deadlineGroups(tasks, today).map((group) => (
    <section key={group.name} data-testid={deadlineGroupsTestIds.group} data-group={group.name}>
      <h2 className={group.overdue ? styles.overdue : styles.name}>{group.name}</h2>
      <ul className={styles.tasks}>
        {group.tasks.map((task) => (
          <TaskRow key={task.id} task={task} today={today} domains={domains} countdown onDelete={onDelete} />
        ))}
      </ul>
    </section>
  ))
