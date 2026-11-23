import { useEffect, useRef } from "react"
import styles from "./SequenceHint.module.css"
import { sequenceHintTestIds } from "./SequenceHintTestIds.ts"
import { keyLabel } from "./key-press.ts"
import { nextKeys, usePendingKeys, useShortcutActions } from "./shortcut-service.ts"

const MAC = navigator.userAgent.includes("Mac")

/** After `G`: the keys that can come next and where each goes. Escape or a click elsewhere cancels. */
export const SequenceHint = () => {
  const { active, press, cancelSequence } = useShortcutActions()
  const pending = usePendingKeys()
  const hint = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (pending.length === 0) return
    const away = (event: PointerEvent): void => {
      if (!(event.target instanceof Node && hint.current?.contains(event.target))) cancelSequence()
    }
    document.addEventListener("pointerdown", away)
    return () => document.removeEventListener("pointerdown", away)
  }, [pending, cancelSequence])
  if (pending.length === 0) return undefined
  const next = nextKeys(active(), pending)
  if (next.length === 0) return undefined
  return (
    <div
      ref={hint}
      className={styles.hint}
      role="group"
      aria-label={`${pending.map((key) => keyLabel(key, MAC)).join(" then ")} then…`}
      data-testid={sequenceHintTestIds.hint}
    >
      <p className={styles.heading}>
        {pending.map((key) => (
          <kbd key={key} className={styles.key}>
            {keyLabel(key, MAC)}
          </kbd>
        ))}
        then…
      </p>
      <ul className={styles.list}>
        {next.map(({ key, description }) => (
          <li key={key}>
            <button
              type="button"
              className={styles.next}
              onClick={() => void press(key)}
              data-testid={sequenceHintTestIds.next}
              data-track="SequenceHint.next"
            >
              <kbd className={styles.key}>{keyLabel(key, MAC)}</kbd>
              <span>{description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
