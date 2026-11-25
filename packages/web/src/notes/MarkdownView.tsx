import { EditorContent, useEditor } from "@tiptap/react"
import { notesToDocument, NOTES_EXTENSIONS } from "./notes-markdown.ts"
import prose from "./prose.module.css"

/** Markdown, formatted as notes are, and not editable. */
export const MarkdownView = ({
  markdown,
  className,
  testId
}: {
  markdown: string
  className: string | undefined
  testId: string
}) => {
  const editor = useEditor(
    {
      extensions: NOTES_EXTENSIONS,
      content: notesToDocument(markdown),
      editable: false,
      editorProps: {
        // Tiptap makes it a textbox unless told otherwise; here it's only text.
        attributes: { class: `${prose.prose} ${className ?? ""}`, role: "none", "data-testid": testId }
      }
    },
    [markdown]
  )
  return <EditorContent editor={editor} />
}
