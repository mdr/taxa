import { Tag, X } from "lucide-react"
import { Link } from "wouter"
import styles from "./Tags.module.css"
import { tagChipTestIds } from "./TagChipTestIds.ts"
import { tagPath } from "./tag-paths.ts"

/** A tag, linking to its tasks; with a way to take it off, if given one. */
export const TagChip = ({ name, onRemove }: { name: string; onRemove?: () => void }) => (
  <span className={styles.chip} data-testid={tagChipTestIds.chip} data-value={name}>
    <Link href={tagPath(name)} className={styles.chipLink}>
      <Tag size={12} aria-hidden />
      {name}
    </Link>
    {onRemove && (
      <button
        type="button"
        className={styles.remove}
        aria-label={`Take off the tag ${name}`}
        onClick={onRemove}
        data-testid={tagChipTestIds.remove}
      >
        <X size={12} aria-hidden />
      </button>
    )}
  </span>
)
