import { TaskStatus } from "@taxa/shared/tasks/task"
import { Circle, CircleCheck, CircleDot, CirclePause, CircleX, type LucideIcon } from "lucide-react"
import styles from "./StatusIcon.module.css"

const ICONS: Record<TaskStatus, LucideIcon> = {
  [TaskStatus.OPEN]: Circle,
  [TaskStatus.IN_PROGRESS]: CircleDot,
  [TaskStatus.WAITING]: CirclePause,
  [TaskStatus.DONE]: CircleCheck,
  [TaskStatus.CANCELLED]: CircleX
}

const CLASSES: Record<TaskStatus, string | undefined> = {
  [TaskStatus.OPEN]: styles.open,
  [TaskStatus.IN_PROGRESS]: styles.inProgress,
  [TaskStatus.WAITING]: styles.waiting,
  [TaskStatus.DONE]: styles.done,
  [TaskStatus.CANCELLED]: styles.cancelled
}

export const StatusIcon = ({ status, size = 15 }: { status: TaskStatus; size?: number }) => {
  const Icon = ICONS[status]
  return <Icon size={size} className={CLASSES[status]} aria-hidden />
}
