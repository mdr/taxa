import type { AnyExtension, JSONContent } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TableKit } from "@tiptap/extension-table"
import { MarkdownManager } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"

/** A link whose text is its address, written as a bare address, as people and agents write them. */
const BARE_URL = /^https?:\/\/[^\s<>]*[^\s<>.,:;"')\]!?*_~]$/

const isBareLink = (href: unknown, text: unknown): boolean =>
  typeof href === "string" && text === href && BARE_URL.test(href)

const NotesLink = Link.extend({
  renderMarkdown: (node, helpers, context) => {
    const attribute: unknown = node.attrs?.["href"]
    const href = typeof attribute === "string" ? attribute : ""
    const children = helpers.renderChildren(node)
    return isBareLink(href, context.meta?.["markText"]) ? children : `[${children}](${href})`
  }
}).configure({ openOnClick: false, autolink: true, markdownLinks: true, defaultProtocol: "https" })

/** What notes can hold: GitHub-flavoured Markdown, less raw HTML. Underline has no Markdown. */
export const NOTES_EXTENSIONS: AnyExtension[] = [
  StarterKit.configure({ underline: false, link: false }),
  NotesLink,
  TaskList,
  TaskItem.configure({ nested: true, a11y: { checkboxLabel: (node) => `Done: ${node.textContent || "empty item"}` } }),
  TableKit,
  Image
]

/** The parts of Tiptap's manager patched below; private there, so typed here. */
interface ManagerInternals {
  encodeTextForMarkdown: (text: string, node: JSONContent, parent: JSONContent | undefined) => string
  parseHTMLToken: (token: { text?: string; raw?: string; block?: boolean }) => unknown
  htmlAsLiteralText: (html: string, block: boolean) => unknown
  codeTypes: Set<string>
}

/** Characters that start formatting mid-line. `_` only at a word's edge, so `snake_case` stays as it is. */
const escapeInline = (text: string): string =>
  text
    .replace(/[\\`*[\]~]/g, "\\$&")
    .replace(/_/g, (underscore, offset: number, whole: string) =>
      /\w/.test(whole[offset - 1] ?? "") && /\w/.test(whole[offset + 1] ?? "") ? underscore : "\\_"
    )
    .replace(/&(?=#?\w+;)/g, "&amp;")
    .replace(/<(?=[a-zA-Z/!?])/g, "\\<")

/** Text that would start a heading, list, quote or rule if it began a line. */
const escapeLineStart = (text: string): string =>
  text
    .replace(/^(\s{0,3})(#{1,6})(?=\s|$)/, "$1\\$2")
    .replace(/^(\s{0,3})([-+=])(?=[\s\-+=]|$)/, "$1\\$2")
    .replace(/^(\s{0,3}\d{1,9})([.)])(?=\s|$)/, "$1\\$2")
    .replace(/^(\s{0,3})>/, "$1\\>")

const notesManager = (): MarkdownManager => {
  const manager = new MarkdownManager({ extensions: NOTES_EXTENSIONS })
  const internals = manager as unknown as ManagerInternals
  internals.encodeTextForMarkdown = (text, node, parent) => {
    const marks = node.marks ?? []
    const inCode =
      internals.codeTypes.has(parent?.type ?? "") || marks.some((mark) => internals.codeTypes.has(mark.type))
    if (inCode || marks.some((mark) => mark.type === "link" && isBareLink(mark.attrs?.["href"], text))) return text
    const index = parent?.content?.indexOf(node) ?? 0
    const previous = index > 0 ? parent?.content?.[index - 1] : undefined
    const startsLine = parent?.type === "paragraph" && (index === 0 || previous?.type === "hardBreak")
    return startsLine ? escapeLineStart(escapeInline(text)) : escapeInline(text)
  }
  // HTML shows as the text it is, in the browser as on the server.
  internals.parseHTMLToken = (token) => internals.htmlAsLiteralText(token.text ?? token.raw ?? "", token.block ?? false)
  return manager
}

const manager = notesManager()

export const notesToDocument = (markdown: string): JSONContent => manager.parse(markdown)

export const documentToNotes = (document: JSONContent): string => manager.serialize(document).trim()

/** Notes in the one style the editor writes, so formatting never churns between writers. */
export const normaliseNotes = (markdown: string): string => documentToNotes(notesToDocument(markdown))
