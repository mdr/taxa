import { hasTag, sameTag, TagSchema, type TagSummary } from "@taxa/shared/tasks/tags"

/** The most tags in use offered at once. */
const MOST_SHOWN = 6

export enum SuggestionType {
  /** A tag in use already. */
  EXISTING = "EXISTING",
  /** A tag made from what's typed. */
  NEW = "NEW"
}

export interface TagSuggestion {
  type: SuggestionType
  name: string
}

/**
 * The tags to offer for what's typed, leaving out those the task has: those
 * in use whose name starts with it, then those with it anywhere, most used
 * first; then, unless one is just what's typed, a new tag of it.
 */
export const tagSuggestions = (all: readonly TagSummary[], typed: string, has: readonly string[]): TagSuggestion[] => {
  const wanted = typed.trim().replace(/\s+/g, " ").toLowerCase()
  const rank = (name: string): number => (name.toLowerCase().startsWith(wanted) ? 0 : 1)
  const existing = all
    .filter(({ name }) => !hasTag(has, name) && name.toLowerCase().includes(wanted))
    .map((tag, index) => ({ tag, index }))
    .sort((a, b) => rank(a.tag.name) - rank(b.tag.name) || b.tag.openCount - a.tag.openCount || a.index - b.index)
    .slice(0, MOST_SHOWN)
    .map(({ tag }) => ({ type: SuggestionType.EXISTING, name: tag.name }))
  const parsed = TagSchema.safeParse(typed)
  const isNew = parsed.success && !hasTag(has, parsed.data) && !all.some(({ name }) => sameTag(name, parsed.data))
  return [...existing, ...(isNew ? [{ type: SuggestionType.NEW, name: parsed.data }] : [])]
}
