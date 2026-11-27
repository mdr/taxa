import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import styles from "./Popover.module.css"
import { appAnalytics } from "../telemetry/app-telemetry.ts"
import { trackUi, UiEvent } from "../telemetry/ui-tracking.ts"
import { ShortcutGroup, ShortcutScope, useShortcuts, type KeyShortcut } from "../shortcuts/shortcut-service.ts"

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
  /** What it's for, for analytics, which track it opening and closing: `TaskRow.menu`. */
  track: string
  /** On the trigger, for tests and styling: what it shows. */
  value?: string
  /** Its own look for the trigger, in place of `look`'s. */
  triggerClassName?: string
  /** Line the panel up with the trigger's right edge instead of its left. */
  alignEnd?: boolean
  /** A key that opens it, on the page that shows it. */
  shortcut?: KeyShortcut
  /** Opens it from elsewhere, at one part of its content if `into` says, which `children` is told; again with each new `seq`. */
  opening?: { into: string | undefined; seq: number }
  /** The panel's content, given a way to close it, and the part a key opened it at, if one did. */
  children: (close: () => void, into: string | undefined) => ReactNode
}

const FOCUSABLE = "input, button:not(:disabled), [tabindex]:not([tabindex='-1'])"

/** A button that opens a small panel beside it, closed by Escape or a click elsewhere. */
export const Popover = ({
  label,
  trigger,
  look,
  testId,
  track,
  value,
  triggerClassName,
  alignEnd = false,
  shortcut,
  opening,
  children
}: PopoverProps) => {
  const [open, setOpen] = useState(false)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open === wasOpen.current) return
    wasOpen.current = open
    trackUi(appAnalytics, open ? UiEvent.OPENED : UiEvent.CLOSED, track)
  }, [open, track])
  const [into, setInto] = useState<string | undefined>(undefined)
  /** Where the keyboard was when it was opened from elsewhere, to go back to when it closes. */
  const returnTo = useRef<HTMLElement | undefined>(undefined)
  const wrapper = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()
  useShortcuts(
    ShortcutScope.PAGE,
    shortcut
      ? [
          {
            keys: [shortcut.key],
            description: shortcut.description,
            group: ShortcutGroup.TASKS,
            run: () => {
              setInto(undefined)
              setOpen(true)
            }
          }
        ]
      : []
  )
  const openingSeq = opening?.seq
  const openingInto = opening?.into
  useEffect(() => {
    if (openingSeq === undefined) return
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    setInto(openingInto)
    setOpen(true)
  }, [openingSeq, openingInto])
  const giveBackFocus = (): void => {
    const back = returnTo.current?.isConnected ? returnTo.current : button.current
    returnTo.current = undefined
    back?.focus()
  }
  const close = () => {
    setOpen(false)
    giveBackFocus()
  }
  useEffect(() => {
    if (!open) return undefined
    // Unless what's in it has put the keyboard somewhere already, the keyboard goes to the first thing in it.
    if (!panel.current?.contains(document.activeElement)) panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      event.preventDefault()
      setOpen(false)
      giveBackFocus()
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
        className={triggerClassName ?? LOOK_CLASS[look]}
        aria-label={look === PopoverLook.ICON ? label : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts={shortcut?.key.toUpperCase()}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setInto(undefined)
          returnTo.current = undefined
          setOpen(!open)
        }}
        data-testid={testId}
        data-track=""
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
          {children(close, into)}
        </div>
      )}
    </div>
  )
}
