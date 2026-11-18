import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Task } from "@taxa/shared/tasks/task"
import { isCarriedOver, weeksInSoon, When, whenOf } from "@taxa/shared/tasks/when"
import { WHEN_ICONS } from "./when-choices.tsx"

/** What a row says of when its task's meant for. */
const whenText = (task: Task, when: When, today: IsoDate): string | undefined => {
  switch (when) {
    case When.TODAY:
      return task.scheduled && isCarriedOver(task, today)
        ? `Carried over from ${formatDay(task.scheduled, today)}`
        : "Today"
    case When.ON_A_DAY:
      return task.scheduled && formatDay(task.scheduled, today)
    case When.SOON: {
      const weeks = weeksInSoon(task, today)
      return weeks === undefined ? "Soon" : `In Soon for ${weeks} weeks`
    }
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
  // A list says what it's made of, but not that a task's been carried over into it, nor sat in it for weeks.
  const sayable = when !== listedBy || isCarriedOver(task, today) || weeksInSoon(task, today) !== undefined
  const text = sayable ? whenText(task, when, today) : undefined
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
