/** Sentence case for a label that starts a line, from the lower-case text the CLI shares. */
export const capitalised = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`
