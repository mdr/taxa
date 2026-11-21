import { Plus, Tag } from "lucide-react"
import styles from "./Tags.module.css"
import { tagSuggestionListTestIds } from "./TagSuggestionListTestIds.ts"
import { SuggestionType, type TagSuggestion } from "./tag-suggestions.ts"

/** Tags to choose from as you type, the highlighted one picked by Enter. */
export const TagSuggestionList = ({
  id,
  suggestions,
  highlighted,
  onPick
}: {
  id: string
  suggestions: readonly TagSuggestion[]
  highlighted: number
  onPick: (name: string) => void
}) => (
  <div
    id={id}
    role="listbox"
    aria-label="Tags"
    className={styles.suggestions}
    data-testid={tagSuggestionListTestIds.list}
  >
    {suggestions.map(({ type, name }, index) => (
      // Chosen from the keyboard in the field typed in, which keeps focus throughout.
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
      <div
        key={`${type}:${name}`}
        id={`${id}-${index}`}
        role="option"
        tabIndex={-1}
        aria-selected={index === highlighted}
        className={styles.suggestion}
        // Keeps focus in the field typed in.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onPick(name)}
        data-testid={tagSuggestionListTestIds.suggestion}
        data-value={name}
      >
        {type === SuggestionType.NEW ? (
          <>
            <Plus size={13} aria-hidden /> New tag “{name}”
          </>
        ) : (
          <>
            <Tag size={13} aria-hidden /> {name}
          </>
        )}
      </div>
    ))}
  </div>
)

/** Which suggestion arrow keys move to, round from the ends; or undefined, for a key that doesn't move. */
export const movedHighlight = (key: string, highlighted: number, count: number): number | undefined => {
  if (count === 0) return undefined
  if (key === "ArrowDown") return (highlighted + 1) % count
  if (key === "ArrowUp") return (highlighted - 1 + count) % count
  return undefined
}
