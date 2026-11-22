import { useId, useState } from "react"
import styles from "./Tags.module.css"
import { tagPickerTestIds } from "./TagPickerTestIds.ts"
import { useTags } from "./tag-queries.ts"
import { tagSuggestions } from "./tag-suggestions.ts"
import { movedHighlight, NONE_HIGHLIGHTED, startingHighlight, TagSuggestionList } from "./TagSuggestionList.tsx"

/** Finds a tag to add, or makes one of what's typed. */
export const TagPicker = ({ has, onPick }: { has: readonly string[]; onPick: (name: string) => void }) => {
  const [typed, setTyped] = useState("")
  const [highlighted, setHighlighted] = useState(NONE_HIGHLIGHTED)
  const suggestions = tagSuggestions(useTags().data ?? [], typed, has)
  const listId = useId()
  const pick = (name: string): void => {
    setTyped("")
    setHighlighted(NONE_HIGHLIGHTED)
    onPick(name)
  }
  return (
    <div className={styles.picker}>
      <input
        className={styles.pickerInput}
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value)
          setHighlighted(startingHighlight(event.target.value))
        }}
        onKeyDown={(event) => {
          const moved = movedHighlight(event.key, highlighted, suggestions.length)
          if (moved !== undefined) {
            event.preventDefault()
            setHighlighted(moved)
          } else if (event.key === "Enter") {
            event.preventDefault()
            const chosen = suggestions[highlighted]
            if (chosen) pick(chosen.name)
          }
        }}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-activedescendant={suggestions[highlighted] ? `${listId}-${highlighted}` : undefined}
        aria-label="Find or make a tag"
        placeholder="Find or make a tag"
        data-testid={tagPickerTestIds.input}
        data-track="TagPicker.input"
      />
      {suggestions.length > 0 ? (
        <TagSuggestionList id={listId} suggestions={suggestions} highlighted={highlighted} onPick={pick} />
      ) : (
        <p className={styles.none}>{typed.trim() === "" ? "No tags yet: type one." : "It has that tag already."}</p>
      )}
    </div>
  )
}
