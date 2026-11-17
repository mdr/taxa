import { formatDay } from "@taxa/shared/dates/date-format"
import { parseDateInput } from "@taxa/shared/dates/date-input"
import { isIsoTime, type IsoDate, type IsoTime } from "@taxa/shared/dates/plain-date"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import styles from "./DatePicker.module.css"
import { datePickerTestIds } from "./DatePickerTestIds.ts"
import { dateShortcuts } from "./date-shortcuts.ts"
import { firstOfMonth, monthGrid, monthName } from "./month-grid.ts"

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

interface TimeSetting {
  value: IsoTime | undefined
  onChange: (time: IsoTime | undefined) => void
}

interface DatePickerProps {
  value: IsoDate | undefined
  today: IsoDate
  onChoose: (date: IsoDate | undefined) => void
  /** For a date that can have a time too. */
  time?: TimeSetting
}

export const DatePicker = ({ value, today, onChoose, time }: DatePickerProps) => {
  const [typed, setTyped] = useState("")
  const [timeTyped, setTimeTyped] = useState(time?.value ?? "")
  const [month, setMonth] = useState(firstOfMonth(value ?? today))
  const parsed = typed.trim() === "" ? undefined : parseDateInput(typed, today)
  const { weeks } = monthGrid(month)
  const saveTime = () => {
    const trimmed = timeTyped.trim()
    if (trimmed === (time?.value ?? "")) return
    if (trimmed === "") time?.onChange(undefined)
    else if (isIsoTime(trimmed)) time?.onChange(trimmed)
  }
  return (
    <div className={styles.picker}>
      <input
        className={styles.typed}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && parsed) onChoose(parsed)
        }}
        placeholder="Type a date: fri, +3d, 2026-03-01"
        aria-label="Date"
        aria-invalid={typed.trim() !== "" && !parsed}
        data-testid={datePickerTestIds.typed}
      />
      {typed.trim() !== "" && (
        <p className={styles.understood} aria-live="polite">
          {parsed ? `${formatDay(parsed, today)} — press Enter` : "Not a date I know"}
        </p>
      )}
      <div className={styles.shortcuts}>
        {dateShortcuts(today).map(({ label, date }) => (
          <button
            key={label}
            type="button"
            className={styles.shortcut}
            onClick={() => onChoose(date)}
            data-testid={datePickerTestIds.shortcut}
          >
            <span>{label}</span>
            <span className={styles.detail}>{formatDay(date, today)}</span>
          </button>
        ))}
      </div>
      <div className={styles.calendar}>
        <div className={styles.monthBar}>
          <span className={styles.month}>{monthName(month)}</span>
          <button
            type="button"
            className={styles.nav}
            onClick={() => setMonth(firstOfMonth(month, -1))}
            aria-label="Previous month"
            data-testid={datePickerTestIds.previousMonth}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.nav}
            onClick={() => setMonth(firstOfMonth(month, 1))}
            aria-label="Next month"
            data-testid={datePickerTestIds.nextMonth}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <table className={styles.grid}>
          <thead>
            <tr>
              {WEEKDAYS.map((day) => (
                <th key={day} scope="col" className={styles.weekday}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((day) => (
                  <td key={day}>
                    <button
                      type="button"
                      className={styles.day}
                      data-outside={day.slice(0, 7) !== month.slice(0, 7)}
                      data-today={day === today}
                      aria-pressed={day === value}
                      aria-label={formatDay(day, today)}
                      onClick={() => onChoose(day)}
                      data-testid={datePickerTestIds.day}
                      data-date={day}
                    >
                      {Number(day.slice(8))}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {time && (
        <label className={styles.time}>
          At
          <input
            value={timeTyped}
            onChange={(event) => setTimeTyped(event.target.value)}
            onBlur={saveTime}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveTime()
            }}
            placeholder="HH:MM"
            aria-invalid={timeTyped.trim() !== "" && !isIsoTime(timeTyped.trim())}
            data-testid={datePickerTestIds.time}
          />
        </label>
      )}
      {value && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChoose(undefined)}
          data-testid={datePickerTestIds.clear}
        >
          Clear
        </button>
      )}
    </div>
  )
}
