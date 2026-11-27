import styles from "./SelectBox.module.css"

/** A square box, so choosing a task to change isn't taken for ticking it done. */
export const SelectBox = ({
  checked,
  label,
  onChange,
  testId
}: {
  checked: boolean
  label: string
  /** With shift held, the tasks between the last one chosen and this. */
  onChange: (shift: boolean) => void
  testId: string
}) => (
  <span className={styles.box}>
    <input
      type="checkbox"
      className={styles.input}
      checked={checked}
      onClick={(event) => onChange(event.shiftKey)}
      onChange={() => undefined}
      aria-label={label}
      data-testid={testId}
      data-track={testId}
    />
  </span>
)
