import { ExternalLink } from "lucide-react"
import styles from "./LinkBar.module.css"
import { linkBarTestIds } from "./LinkBarTestIds.ts"

const keepFocus = (event: { preventDefault: () => void }): void => event.preventDefault()

/** Under the notes while the cursor is on a link: where it goes, and changing or removing it. */
export const LinkBar = ({ href, onEdit, onRemove }: { href: string; onEdit: () => void; onRemove: () => void }) => (
  <div className={styles.bar} data-testid={linkBarTestIds.bar}>
    <a
      className={styles.open}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseDown={keepFocus}
      data-testid={linkBarTestIds.open}
    >
      <ExternalLink size={13} aria-hidden />
      {href}
    </a>
    {/* Clicked without taking focus from the notes, whose cursor says which link. */}
    <button
      type="button"
      className={styles.action}
      onMouseDown={keepFocus}
      onClick={onEdit}
      data-testid={linkBarTestIds.edit}
    >
      Edit
    </button>
    <button
      type="button"
      className={styles.action}
      onMouseDown={keepFocus}
      onClick={onRemove}
      data-testid={linkBarTestIds.remove}
    >
      Remove
    </button>
  </div>
)
