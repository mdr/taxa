import { useEffect, useId, useRef, useState, type SubmitEvent } from "react"
import styles from "./LinkForm.module.css"
import { linkFormTestIds } from "./LinkFormTestIds.ts"
import { linkAddress } from "./link-address.ts"
import type { LinkDraft } from "./notes-links.ts"

interface LinkFormProps {
  draft: LinkDraft
  onSave: (text: string, address: string) => void
  onRemove: () => void
  onCancel: () => void
}

/** A link's text and address, to add one or change the one the cursor is on. */
export const LinkForm = ({ draft, onSave, onRemove, onCancel }: LinkFormProps) => {
  const [text, setText] = useState(draft.text)
  const [address, setAddress] = useState(draft.address)
  const [problem, setProblem] = useState<string | undefined>()
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  // Escape anywhere in the box leaves it, putting you back in the notes.
  useEffect(() => {
    const element = form.current
    if (!element) return undefined
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return
      event.preventDefault()
      onCancel()
    }
    element.addEventListener("keydown", escape)
    return () => element.removeEventListener("keydown", escape)
  }, [onCancel])
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const href = linkAddress(address)
    if (href) onSave(text, href)
    else setProblem("Enter a web address, like example.com, or an email address.")
  }
  return (
    <form
      className={styles.form}
      ref={form}
      onSubmit={submit}
      aria-label={draft.existing ? "Edit link" : "Add a link"}
      data-testid={linkFormTestIds.form}
    >
      <label className={styles.label} htmlFor={`${id}-text`}>
        Text
      </label>
      <input
        id={`${id}-text`}
        className={styles.field}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="The address, if left empty"
        data-testid={linkFormTestIds.text}
      />
      <label className={styles.label} htmlFor={`${id}-address`}>
        Address
      </label>
      <input
        id={`${id}-address`}
        className={styles.field}
        value={address}
        onChange={(event) => {
          setAddress(event.target.value)
          setProblem(undefined)
        }}
        placeholder="example.com"
        // The address is what's always needed, so the box opens on it.
        // oxlint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-invalid={problem !== undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        data-testid={linkFormTestIds.address}
      />
      {problem && (
        <p id={`${id}-problem`} className={styles.problem} role="alert" data-testid={linkFormTestIds.problem}>
          {problem}
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" data-testid={linkFormTestIds.save}>
          {draft.existing ? "Save" : "Add link"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {draft.existing && (
          <button type="button" className={styles.remove} onClick={onRemove} data-testid={linkFormTestIds.remove}>
            Remove link
          </button>
        )}
      </div>
    </form>
  )
}
