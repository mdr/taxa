import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Task } from "@taxa/shared/tasks/task"
import { When, whenOf } from "@taxa/shared/tasks/when"
import { WHEN_ICONS } from "./when-choices.tsx"

/** What a row says of when its task's meant for. */
const whenText = (task: Task, when: When, today: IsoDate): string | undefined => {
  switch (when) {
    case When.TODAY:
      return "Today"
    case When.ON_A_DAY:
      return task.scheduled && formatDay(task.scheduled, today)
    case When.SOON:
      return "Soon"
    case When.SOMEDAY:
      return "Someday"
    case When.ANY_TIME:
      return undefined
  }
}

/**
 * When a task's meant for, on its row, with the time if it has one; nothing
 * for any time, nor what the list it's in already says, beyond the time.
 */
export const WhenTag = ({
  task,
  today,
  listedBy,
  className
}: {
  task: Task
  today: IsoDate
  listedBy: When | undefined
  className: string | undefined
}) => {
  const when = whenOf(task, today)
  const text = when === listedBy ? undefined : whenText(task, when, today)
  const shown = [text, task.scheduled && task.scheduledTime].filter(Boolean).join(" ")
  if (shown === "") return undefined
  const Icon = WHEN_ICONS[when]
  return (
    <span className={className}>
      <Icon size={14} aria-hidden />
      {shown}
    </span>
  )
}
