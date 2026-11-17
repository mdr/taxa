import type { Editor } from "@tiptap/react"

/** What the link box starts with: the link the cursor is on, or the selected text to make one of. */
export interface LinkDraft {
  text: string
  address: string
  /** The cursor was on a link, which saving replaces. */
  existing: boolean
}

/** Selects the whole link the cursor is on, if any, and says what's to be linked. */
export const linkDraftAt = (editor: Editor): LinkDraft => {
  const existing = editor.isActive("link")
  const address = existing ? String(editor.getAttributes("link")["href"] ?? "") : ""
  if (existing) editor.commands.extendMarkRange("link")
  const { from, to } = editor.state.selection
  return { text: editor.state.doc.textBetween(from, to, " "), address, existing }
}

/** Puts a link in place of the selection, its text the address if none is given, and carries on after it unlinked. */
export const applyLink = (editor: Editor, text: string, address: string): void => {
  editor
    .chain()
    .focus()
    .insertContent({ type: "text", text: text.trim() || address, marks: [{ type: "link", attrs: { href: address } }] })
    .unsetMark("link")
    .run()
}

export const removeLink = (editor: Editor): void => {
  editor.chain().focus().extendMarkRange("link").unsetLink().run()
}
