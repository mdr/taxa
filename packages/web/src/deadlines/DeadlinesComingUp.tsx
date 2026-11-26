import { deadlinesComingUpTestIds } from "./DeadlinesComingUpTestIds.ts"
import { comingUp, DEADLINES_PATH, deadlineReason } from "./deadlines.ts"
import { AttentionBox } from "../days/AttentionBox.tsx"
import { useToday } from "../dates/use-today.ts"
import { useTasks } from "../tasks/task-queries.ts"

/** Below Today: deadlines overdue or within the week that aren't planned for it, to bring in with a click. */
export const DeadlinesComingUp = () => {
  const today = useToday()
  const items = comingUp(useTasks({ due: "true" }).data ?? [], today).map((task) => ({
    task,
    reason: deadlineReason(task.due!, today)
  }))
  return (
    <AttentionBox
      heading="Deadlines coming up"
      items={items}
      most={5}
      more={{ href: DEADLINES_PATH, text: "All deadlines", always: true }}
      testIds={deadlinesComingUpTestIds}
      track="DeadlinesComingUp.add"
    />
  )
}
