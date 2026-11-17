import { Priority } from "@taxa/shared/tasks/task"
import { Flag } from "lucide-react"
import styles from "./PriorityIcon.module.css"

const CLASSES: Record<Priority, string | undefined> = {
  [Priority.URGENT]: styles.urgent,
  [Priority.HIGH]: styles.high,
  [Priority.NORMAL]: styles.normal,
  [Priority.LOW]: styles.low
}

export const PriorityIcon = ({ priority, size = 15 }: { priority: Priority; size?: number }) => (
  <Flag
    size={size}
    className={CLASSES[priority]}
    fill={priority === Priority.URGENT ? "currentColor" : "none"}
    aria-hidden
  />
)
