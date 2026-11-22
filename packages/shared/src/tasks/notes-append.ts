/** Notes with more added at the end, after a blank line: what an agent's progress note does to them. */
export const appendedNotes = (notes: string, added: string): string =>
  notes.trim() === "" ? added.trim() : `${notes.trimEnd()}\n\n${added.trim()}`
