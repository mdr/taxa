import type { ReactNode } from "react"
import { OptionList, type Option } from "../../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../../ui/Popover.tsx"
import type { KeyShortcut } from "../../../shortcuts/shortcut-service.ts"

interface ChoicePropertyProps {
  label: string
  testId: string
  value: string
  options: Option[]
  /** What the chip shows. */
  trigger: ReactNode
  /** Not set yet, so the chip is quieter. */
  empty?: boolean
  shortcut?: KeyShortcut
  onChoose: (value: string) => void
}

/** A property chosen from a few options. */
export const ChoiceProperty = ({
  label,
  testId,
  value,
  options,
  trigger,
  empty = false,
  shortcut,
  onChoose
}: ChoicePropertyProps) => (
  <Popover
    label={label}
    trigger={trigger}
    look={empty ? PopoverLook.EMPTY_CHIP : PopoverLook.CHIP}
    testId={testId}
    value={value}
    shortcut={shortcut}
  >
    {(close) => (
      <OptionList
        options={options}
        selected={value}
        onChoose={(chosen) => {
          close()
          if (chosen !== value) onChoose(chosen)
        }}
      />
    )}
  </Popover>
)
