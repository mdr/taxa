/** Colours that read on both themes, for telling domains apart at a glance. */
const PALETTE = ["#d4572f", "#3f9b5c", "#4a78c9", "#d39a17", "#7d5bc6", "#2f8f9d", "#c4508f", "#8a7a5c"]

const hashed = (prefix: string): number => {
  let hash = 0x811c9dc5
  for (const letter of prefix) hash = Math.imul(hash ^ (letter.codePointAt(0) ?? 0), 0x01000193) >>> 0
  return hash >>> 13
}

/**
 * A domain's colour, by its place among the domains (oldest first), so the
 * first eight all differ and each keeps its colour; by its prefix otherwise.
 */
export const domainColour = (prefix: string, prefixes: readonly string[]): string => {
  const index = prefixes.indexOf(prefix)
  return PALETTE[(index === -1 ? hashed(prefix) : index) % PALETTE.length]!
}
