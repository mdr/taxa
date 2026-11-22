/** A title as typed, with runs of spaces and line breaks made one space; nothing if it's empty. */
export const tidiedTitle = (typed: string): string | undefined => typed.replaceAll(/\s+/g, " ").trim() || undefined
