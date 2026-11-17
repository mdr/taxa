import { PREFIX_PATTERN } from "./domain.ts"

const MAX_LENGTH = 5

/**
 * A prefix for a domain called `name` that isn't taken: its first letter if
 * free, else its first letter and a later one (Home, Hobbies → H, HO), else
 * longer. Empty when the name has no letters or nothing fits.
 */
export const suggestPrefix = (name: string, taken: ReadonlySet<string>): string => {
  const letters = name.toUpperCase().replaceAll(/[^A-Z]/g, "")
  const [first] = letters
  if (first === undefined) return ""
  const candidates = [
    first,
    ...letters
      .slice(1)
      .split("")
      .map((letter) => `${first}${letter}`),
    letters.slice(0, MAX_LENGTH)
  ]
  return candidates.find((candidate) => PREFIX_PATTERN.test(candidate) && !taken.has(candidate)) ?? ""
}
