import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Task } from "@taxa/shared/tasks/task"
import { When, whenOf } from "@taxa/shared/tasks/when"
import { ArrowRight, CalendarDays, Circle, Cloud, Sun, type LucideIcon } from "lucide-react"
import type { Option } from "../../ui/OptionList.tsx"

export const WHEN_ICONS: Record<When, LucideIcon> = {
  [When.TODAY]: Sun,
  [When.ON_A_DAY]: CalendarDays,
  [When.SOON]: ArrowRight,
  [When.ANY_TIME]: Circle,
  [When.SOMEDAY]: Cloud
}

const WHEN_TEXT: Record<When, string> = {
  [When.TODAY]: "Today",
  [When.ON_A_DAY]: "On a day…",
  [When.SOON]: "Soon",
  [When.ANY_TIME]: "Any time",
  [When.SOMEDAY]: "Someday"
}

const WHEN_DETAIL: Partial<Record<When, string>> = {
  [When.ANY_TIME]: "no plan",
  [When.SOMEDAY]: "out of sight"
}

/** What a task's When reads as: the day itself, for one to come. */
export const whenLabel = (task: Pick<Task, "scheduled" | "horizon">, today: IsoDate): string => {
  const when = whenOf(task, today)
  return when === When.ON_A_DAY && task.scheduled ? formatDay(task.scheduled, today) : WHEN_TEXT[when]
}

/**
 * The choices, soonest first, with a day to come last as it needs a date;
 * left out where a date is chosen some other way.
 */
export const whenOptions = (task: Pick<Task, "scheduled" | "horizon">, today: IsoDate, withDay = true): Option[] =>
  [When.TODAY, When.SOON, When.ANY_TIME, When.SOMEDAY, ...(withDay ? [When.ON_A_DAY] : [])].map((when) => {
    const Icon = WHEN_ICONS[when]
    return {
      value: when,
      label: WHEN_TEXT[when],
      icon: <Icon size={15} aria-hidden />,
      detail:
        when === When.ON_A_DAY && whenOf(task, today) === When.ON_A_DAY && task.scheduled
          ? formatDay(task.scheduled, today)
          : WHEN_DETAIL[when]
    }
  })
