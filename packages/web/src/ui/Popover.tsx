import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import styles from "./Popover.module.css"

export enum PopoverLook {
  /** A property shown as a rounded chip. */
  CHIP = "CHIP",
  /** A property not set yet: quieter, inviting. */
  EMPTY_CHIP = "EMPTY_CHIP",
  /** Just an icon, such as ⋯. */
  ICON = "ICON"
}

const LOOK_CLASS: Record<PopoverLook, string | undefined> = {
  [PopoverLook.CHIP]: styles.chip,
  [PopoverLook.EMPTY_CHIP]: styles.emptyChip,
  [PopoverLook.ICON]: styles.icon
}

interface PopoverProps {
  /** Names the trigger and the panel for assistive technology. */
  label: string
  trigger: ReactNode
  look: PopoverLook
  testId: string
  /** On the trigger, for tests and styling: what it shows. */
  value?: string
  /** Line the panel up with the trigger's right edge instead of its left. */
  alignEnd?: boolean
  /** The panel's content, given a way to close it. */
  children: (close: () => void) => ReactNode
}

const FOCUSABLE = "input, button:not(:disabled), [tabindex]:not([tabindex='-1'])"

/** A button that opens a small panel beside it, closed by Escape or a click elsewhere. */
export const Popover = ({ label, trigger, look, testId, value, alignEnd = false, children }: PopoverProps) => {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const close = () => {
    setOpen(false)
    button.current?.focus()
  }
  useEffect(() => {
    if (!open) return undefined
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", escape)
    }
  }, [open])
  return (
    <div className={styles.wrapper} ref={wrapper}>
      <button
        ref={button}
        type="button"
        className={LOOK_CLASS[look]}
        aria-label={look === PopoverLook.ICON ? label : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
        data-testid={testId}
        data-value={value}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          className={alignEnd ? `${styles.panel} ${styles.end}` : styles.panel}
          role="dialog"
          aria-label={label}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}
