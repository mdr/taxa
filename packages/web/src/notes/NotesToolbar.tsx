import { useEditorState, type Editor } from "@tiptap/react"
import {
  Bold,
  Code,
  Heading2,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
  type LucideIcon
} from "lucide-react"
import styles from "./NotesToolbar.module.css"
import { notesToolbarTestIds } from "./NotesToolbarTestIds.ts"

import { NotesFormat } from "./notes-format.ts"

interface Format {
  format: NotesFormat
  label: string
  icon: LucideIcon
  /** Whether the selection has it, by Tiptap's name for it. */
  active: [string, Record<string, unknown>?]
  apply: (editor: Editor) => void
}

const FORMATS: Format[] = [
  {
    format: NotesFormat.HEADING,
    label: "Heading",
    icon: Heading2,
    active: ["heading", { level: 2 }],
    apply: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()
  },
  {
    format: NotesFormat.BOLD,
    label: "Bold (⌘B)",
    icon: Bold,
    active: ["bold"],
    apply: (editor) => editor.chain().focus().toggleBold().run()
  },
  {
    format: NotesFormat.ITALIC,
    label: "Italic (⌘I)",
    icon: Italic,
    active: ["italic"],
    apply: (editor) => editor.chain().focus().toggleItalic().run()
  },
  {
    format: NotesFormat.STRIKE,
    label: "Strikethrough",
    icon: Strikethrough,
    active: ["strike"],
    apply: (editor) => editor.chain().focus().toggleStrike().run()
  },
  {
    format: NotesFormat.BULLET_LIST,
    label: "Bulleted list",
    icon: List,
    active: ["bulletList"],
    apply: (editor) => editor.chain().focus().toggleBulletList().run()
  },
  {
    format: NotesFormat.NUMBERED_LIST,
    label: "Numbered list",
    icon: ListOrdered,
    active: ["orderedList"],
    apply: (editor) => editor.chain().focus().toggleOrderedList().run()
  },
  {
    format: NotesFormat.CHECKLIST,
    label: "Checklist",
    icon: ListChecks,
    active: ["taskList"],
    apply: (editor) => editor.chain().focus().toggleTaskList().run()
  },
  {
    format: NotesFormat.QUOTE,
    label: "Quote",
    icon: Quote,
    active: ["blockquote"],
    apply: (editor) => editor.chain().focus().toggleBlockquote().run()
  },
  {
    format: NotesFormat.CODE,
    label: "Code",
    icon: Code,
    active: ["code"],
    apply: (editor) => editor.chain().focus().toggleCode().run()
  }
]

/** Formatting for the selection; everything here also has a Markdown shortcut as you type. */
export const NotesToolbar = ({ editor }: { editor: Editor }) => {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      FORMATS.map(({ active: [name, attributes] }) => current.isActive(name, attributes))
  })
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
      {FORMATS.map(({ format, label, icon: Icon, apply }, index) => (
        <button
          key={format}
          type="button"
          className={styles.button}
          aria-label={label}
          title={label}
          aria-pressed={active[index] ?? false}
          // Keeps the selection in the editor.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply(editor)}
          data-value={format}
          data-testid={notesToolbarTestIds.button}
        >
          <Icon size={15} aria-hidden />
        </button>
      ))}
    </div>
  )
}
