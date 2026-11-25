import { weekdayOf, type IsoDate } from "@taxa/shared/dates/plain-date"
import {
  MissedDays,
  missedDaysOf,
  ordinal,
  RepeatFrom,
  repeatOf,
  repeatText,
  RepeatUnit,
  WEEKDAYS,
  type Repeat as RepeatRule,
  type RepeatRequest
} from "@taxa/shared/tasks/repeat"
import { REPEAT_EXAMPLES, repeatFromPhrase } from "@taxa/shared/tasks/repeat-phrases"
import { Repeat } from "lucide-react"
import { useState } from "react"
import styles from "./RepeatProperty.module.css"
import { repeatPropertyTestIds } from "./RepeatPropertyTestIds.ts"
import { OptionList } from "../../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../../ui/Popover.tsx"
import type { KeyShortcut } from "../../../shortcuts/shortcut-service.ts"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

interface Preset {
  value: string
  label: string
  request: RepeatRequest
}

/** The usual ways to repeat, counted from the day it's next for. */
const presets = (from: IsoDate): Preset[] => {
  const [, month, day] = from.split("-").map(Number)
  const schedule = { every: 1, from: RepeatFrom.SCHEDULE }
  return [
    { value: "daily", label: "Every day", request: { ...schedule, unit: RepeatUnit.DAY } },
    {
      value: "weekdays",
      label: "Every weekday",
      request: { ...schedule, unit: RepeatUnit.WEEK, weekdays: WEEKDAYS.slice(0, 5) }
    },
    {
      value: "weekly",
      label: `Every ${WEEKDAY_NAMES[weekdayOf(from)]}`,
      request: { ...schedule, unit: RepeatUnit.WEEK, weekdays: [WEEKDAYS[weekdayOf(from)]!] }
    },
    {
      value: "monthly",
      label: `Monthly on the ${ordinal(day!)}`,
      request: { ...schedule, unit: RepeatUnit.MONTH, monthDay: day! }
    },
    {
      value: "yearly",
      label: `Every year on ${day} ${MONTHS[month! - 1]}`,
      request: { ...schedule, unit: RepeatUnit.YEAR, starts: from }
    }
  ]
}

const STOP = "stop"

const MISSED_CHOICES = [
  { value: MissedDays.SKIP, label: "Skip" },
  { value: MissedDays.CARRY_OVER, label: "Carry over" }
]

/** How a task repeats: one of the usual ways, or any typed (every 2 weeks on friday, 3 days after done), or not at all. */
export const RepeatProperty = ({
  repeat,
  from,
  testId,
  shortcut,
  onChange
}: {
  repeat: RepeatRule | undefined
  /** The day it's next for, or today: what the usual ways count from. */
  from: IsoDate
  testId: string
  shortcut?: KeyShortcut
  onChange: (repeat: RepeatRequest | undefined) => void
}) => {
  const [typed, setTyped] = useState("")
  const parsed = repeatFromPhrase(typed)
  const shown = repeat && repeatText(repeat)
  const usual = presets(from)
  const selected = usual.find(({ request }) => repeatText(repeatOf(request, from)) === shown)?.value ?? ""
  return (
    <Popover
      label="Repeat"
      look={repeat ? PopoverLook.CHIP : PopoverLook.EMPTY_CHIP}
      testId={testId}
      track={testId}
      value={shown ?? ""}
      shortcut={shortcut}
      trigger={
        <>
          <Repeat size={15} aria-hidden />
          {shown ?? "Repeat"}
        </>
      }
    >
      {(close) => {
        const choose = (chosen: RepeatRequest | undefined): void => {
          close()
          setTyped("")
          onChange(chosen)
        }
        return (
          <div className={styles.editor}>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || parsed === undefined) return
                // Handled: the Enter would otherwise go on to click the picker's button, and reopen it.
                event.preventDefault()
                choose(parsed)
              }}
              placeholder={REPEAT_EXAMPLES[5]}
              aria-label="How it repeats"
              aria-invalid={typed.trim() !== "" && parsed === undefined}
              data-testid={repeatPropertyTestIds.typed}
              data-track="RepeatProperty.typed"
            />
            <OptionList
              track="RepeatProperty.usual"
              options={[
                ...usual.map(({ value, label }) => ({ value, label })),
                ...(repeat ? [{ value: STOP, label: "Stop repeating", danger: true }] : [])
              ]}
              selected={selected}
              onChoose={(value) => choose(usual.find((preset) => preset.value === value)?.request)}
            />
            {repeat && (
              <div className={styles.missed} role="group" aria-label="Missed days">
                <span className={styles.missedLabel}>Missed days</span>
                {MISSED_CHOICES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={styles.missedChoice}
                    aria-pressed={missedDaysOf(repeat) === value}
                    onClick={() => choose({ ...repeat, missed: value })}
                    data-testid={repeatPropertyTestIds.missed}
                    data-value={value}
                    data-track={`RepeatProperty.missed.${value}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      }}
    </Popover>
  )
}
