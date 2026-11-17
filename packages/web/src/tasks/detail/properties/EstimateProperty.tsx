import { formatEstimate, parseEstimate } from "@taxa/shared/tasks/estimate"
import { Timer } from "lucide-react"
import { useState } from "react"
import styles from "./EstimateProperty.module.css"
import { estimatePropertyTestIds } from "./EstimatePropertyTestIds.ts"
import { OptionList } from "../../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../../ui/Popover.tsx"

const QUICK = [15, 30, 60, 120, 240]

const EstimateEditor = ({
  minutes,
  onChoose
}: {
  minutes: number | undefined
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
          if (event.key === "Enter" && parsed !== undefined) onChoose(parsed)
        }}
        placeholder="Type one: 45m, 1h30m"
        aria-label="Estimate"
        aria-invalid={typed.trim() !== "" && parsed === undefined}
        data-testid={estimatePropertyTestIds.typed}
      />
      <OptionList
        options={QUICK.map((quick) => ({ value: String(quick), label: formatEstimate(quick) }))}
        selected={minutes === undefined ? "" : String(minutes)}
        onChoose={(value) => onChoose(Number(value))}
      />
      {minutes !== undefined && (
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

/** Roughly how long it'll take. */
export const EstimateProperty = ({
  minutes,
  testId,
  onChange
}: {
  minutes: number | undefined
  testId: string
  onChange: (minutes: number | undefined) => void
}) => (
  <Popover
    label="Estimate"
    look={minutes === undefined ? PopoverLook.EMPTY_CHIP : PopoverLook.CHIP}
    testId={testId}
    value={minutes === undefined ? "" : formatEstimate(minutes)}
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
        onChoose={(chosen) => {
          close()
          if (chosen !== minutes) onChange(chosen)
        }}
      />
    )}
  </Popover>
)
