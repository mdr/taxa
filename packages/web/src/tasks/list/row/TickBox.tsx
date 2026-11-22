import { Priority } from "@taxa/shared/tasks/task"
import type { CSSProperties } from "react"
import styles from "./TickBox.module.css"

const RING: Record<Priority, string> = {
  [Priority.URGENT]: "var(--priority-urgent)",
  [Priority.HIGH]: "var(--priority-high)",
  [Priority.NORMAL]: "var(--border-strong)",
  [Priority.LOW]: "var(--priority-low)"
}

const SPARKS = 8

interface TickBoxProps {
  checked: boolean
  /** Ticked just now, by you: the moment to celebrate. */
  celebrate: boolean
  priority: Priority
  label: string
  onChange: () => void
  testId: string
}

/** A round tick box that fills, ticks and sparkles. */
export const TickBox = ({ checked, celebrate, priority, label, onChange, testId }: TickBoxProps) => (
  <span
    className={styles.tick}
    data-celebrate={celebrate && checked}
    style={{ "--ring": RING[priority] } as CSSProperties}
  >
    <input
      type="checkbox"
      className={styles.input}
      checked={checked}
      onChange={onChange}
      aria-label={label}
      data-testid={testId}
      data-track={testId}
    />
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden>
      <circle className={styles.ring} cx="12" cy="12" r="9.25" />
      <circle className={styles.fill} cx="12" cy="12" r="10.25" />
      <path className={styles.check} d="M7.6 12.4l3 3 5.9-6.3" pathLength={1} />
    </svg>
    {celebrate && checked && (
      <span className={styles.sparks} aria-hidden>
        {Array.from({ length: SPARKS }, (_, index) => (
          <i key={index} style={{ "--angle": `${(360 / SPARKS) * index}deg` } as CSSProperties} />
        ))}
      </span>
    )}
  </span>
)
