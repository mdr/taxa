/** A tag being typed at the end of a title, after a `#`: where the `#` is, and what follows it. */
export interface HashTag {
  start: number
  typed: string
}

/** The tag being typed at the end of a title, if any: a `#` at the start or after a space, and what follows. */
export const hashTagIn = (title: string): HashTag | undefined => {
  const found = /(?:^|\s)#([^#]*)$/.exec(title)
  if (!found) return undefined
  return { start: title.length - found[1]!.length - 1, typed: found[1]! }
}
