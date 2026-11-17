import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate, IsoTime } from "@taxa/shared/dates/plain-date"
import type { ReactNode } from "react"
import styles from "./DateProperty.module.css"
import { DatePicker } from "../../../dates/DatePicker.tsx"
import { Popover, PopoverLook } from "../../../ui/Popover.tsx"
import type { KeyShortcut } from "../../../shortcuts/shortcut-service.ts"

export enum DateTone {
  PLAIN = "PLAIN",
  TODAY = "TODAY",
  OVERDUE = "OVERDUE"
}

const TONE_CLASS: Record<DateTone, string | undefined> = {
  [DateTone.PLAIN]: undefined,
  [DateTone.TODAY]: styles.today,
  [DateTone.OVERDUE]: styles.overdue
}

interface DatePropertyProps {
  label: string
  icon: ReactNode
  testId: string
  value: IsoDate | undefined
  today: IsoDate
  onChange: (date: IsoDate | undefined) => void
  tone?: DateTone
  time?: { value: IsoTime | undefined; onChange: (time: IsoTime | undefined) => void }
  shortcut?: KeyShortcut
}

export const DateProperty = ({
  label,
  icon,
  testId,
  value,
  today,
  onChange,
  tone = DateTone.PLAIN,
  time,
  shortcut
}: DatePropertyProps) => (
  <Popover
    label={label}
    look={value ? PopoverLook.CHIP : PopoverLook.EMPTY_CHIP}
    testId={testId}
    value={value ?? ""}
    shortcut={shortcut}
    trigger={
      <span className={TONE_CLASS[tone] ?? styles.plain}>
        {icon}
        {value ? (
          <>
            <span className={styles.label}>{label}</span> {formatDay(value, today)}
            {time?.value && ` · ${time.value}`}
          </>
        ) : (
          label
        )}
      </span>
    }
  >
    {(close) => (
      <DatePicker
        value={value}
        today={today}
        time={time}
        onChoose={(date) => {
          close()
          if (date !== value) onChange(date)
        }}
      />
    )}
  </Popover>
)
