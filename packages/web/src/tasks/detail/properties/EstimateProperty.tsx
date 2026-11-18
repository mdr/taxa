import { formatEstimate, parseEstimate } from "@taxa/shared/tasks/estimate"
import { Timer } from "lucide-react"
import { useState } from "react"
import styles from "./EstimateProperty.module.css"
import { estimatePropertyTestIds } from "./EstimatePropertyTestIds.ts"
import { OptionList } from "../../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../../ui/Popover.tsx"
import type { KeyShortcut } from "../../../shortcuts/shortcut-service.ts"

const QUICK = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]

/** A time typed, or one of the usual lengths chosen; and, if it can be, cleared. */
export const EstimateEditor = ({
  minutes,
  label,
  clearable,
  onChoose
}: {
  minutes: number | undefined
  label: string
  clearable: boolean
  onChoose: (minutes: number | undefined) => void
}) => {
  const [typed, setTyped] = useState("")
  const parsed = parseEstimate(typed)
  return (
    <div className={styles.editor}>
      <input
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || parsed === undefined) return
          // Handled: the Enter would otherwise go on to click the picker's button, which has the focus back, and reopen it.
          event.preventDefault()
          onChoose(parsed)
        }}
        placeholder="Type one: 45m, 1h30m"
        aria-label={label}
        aria-invalid={typed.trim() !== "" && parsed === undefined}
        data-testid={estimatePropertyTestIds.typed}
      />
      <OptionList
        options={QUICK.map((quick) => ({ value: String(quick), label: formatEstimate(quick) }))}
        selected={minutes === undefined ? "" : String(minutes)}
        onChoose={(value) => onChoose(Number(value))}
      />
      {clearable && minutes !== undefined && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChoose(undefined)}
          data-testid={estimatePropertyTestIds.clear}
        >
          Clear
        </button>
      )}
    </div>
  )
}

/** Roughly how long it'll take; or, labelled otherwise, any length of time, such as a task's time in a session. */
export const EstimateProperty = ({
  minutes,
  testId,
  shortcut,
  label = "Estimate",
  clearable = true,
  onChange
}: {
  minutes: number | undefined
  testId: string
  shortcut?: KeyShortcut
  label?: string
  /** Whether it can be left with no time at all. */
  clearable?: boolean
  onChange: (minutes: number | undefined) => void
}) => (
  <Popover
    label={label}
    look={minutes === undefined ? PopoverLook.EMPTY_CHIP : PopoverLook.CHIP}
    testId={testId}
    value={minutes === undefined ? "" : formatEstimate(minutes)}
    shortcut={shortcut}
    trigger={
      <>
        <Timer size={15} aria-hidden />
        {minutes === undefined ? "Estimate" : formatEstimate(minutes)}
      </>
    }
  >
    {(close) => (
      <EstimateEditor
        minutes={minutes}
        label={label}
        clearable={clearable}
        onChoose={(chosen) => {
          close()
          if (chosen !== minutes) onChange(chosen)
        }}
      />
    )}
  </Popover>
)
