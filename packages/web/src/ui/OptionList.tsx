import { Check } from "lucide-react"
import type { KeyboardEvent, ReactNode } from "react"
import styles from "./OptionList.module.css"
import { optionListTestIds } from "./OptionListTestIds.ts"

export interface Option {
  value: string
  label: string
  icon?: ReactNode
  /** Shown faintly on the right, such as a date or a shortcut. */
  detail?: string
  /** Shown in the danger colour, for things like Delete. */
  danger?: boolean
}

interface OptionListProps {
  options: Option[]
  selected?: string
  onChoose: (value: string) => void
}

/** Up and down move between options. */
const moveFocus = (event: KeyboardEvent<HTMLButtonElement>): void => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
  event.preventDefault()
  const buttons = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === "ArrowDown" ? index + 1 : index - 1
  buttons[(next + buttons.length) % buttons.length]?.focus()
}

/** One-of-several choices in a popover. */
export const OptionList = ({ options, selected, onChoose }: OptionListProps) => (
  <div className={styles.list}>
    {options.map(({ value, label, icon, detail, danger }) => (
      <button
        key={value}
        type="button"
        className={danger ? `${styles.option} ${styles.danger}` : styles.option}
        aria-pressed={selected === undefined ? undefined : value === selected}
        onClick={() => onChoose(value)}
        onKeyDown={moveFocus}
        data-testid={optionListTestIds.option}
        data-value={value}
      >
        <span className={styles.icon}>{icon}</span>
        <span className={styles.label}>{label}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
        {value === selected && <Check size={15} className={styles.check} aria-hidden />}
      </button>
    ))}
  </div>
)
