import { Extension } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"

/** `P-52`, or `p-52` as it's often typed, not inside a longer word such as `COVID-19-B`. */
const REF = /(?<![\w-])([A-Za-z]{1,5})-([1-9]\d*)(?![\w-])/g

export interface FoundRef {
  from: number
  to: number
  /** As the app writes it: `P-52`. */
  ref: string
}

/** The task refs in some text, for domains the reader has, so `UTF-8` and `SHA-256` aren't taken for tasks. */
export const taskRefsIn = (text: string, prefixes: ReadonlySet<string>): FoundRef[] =>
  Array.from(text.matchAll(REF), (match) => ({ match, prefix: match[1]!.toUpperCase() }))
    .filter(({ prefix }) => prefixes.has(prefix))
    .map(({ match, prefix }) => ({
      from: match.index,
      to: match.index + match[0].length,
      ref: `${prefix}-${match[2]!}`
    }))

const taskPath = (ref: string): string => `/tasks/${ref}`

/** Text where a ref is meant as written: in code, or already a link. */
const isLiteral = (node: ProseMirrorNode, inCode: boolean): boolean =>
  inCode || node.marks.some((mark) => mark.type.name === "link" || mark.type.spec.code === true)

const FOLLOW_KEY = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"

const refDecorations = (doc: ProseMirrorNode, prefixes: ReadonlySet<string>, editing: boolean): DecorationSet => {
  if (prefixes.size === 0) return DecorationSet.empty
  const decorations: Decoration[] = []
  doc.descendants((node, position, parent) => {
    if (!node.isText || isLiteral(node, parent?.type.spec.code === true)) return
    for (const { from, to, ref } of taskRefsIn(node.text ?? "", prefixes))
      decorations.push(
        Decoration.inline(position + from, position + to, {
          nodeName: "a",
          href: taskPath(ref),
          "data-task-ref": ref,
          ...(editing ? { title: `${FOLLOW_KEY}-click to open ${ref}` } : {})
        })
      )
  })
  return DecorationSet.create(doc, decorations)
}

export interface TaskRefLinksOptions {
  /** In an editor, where a click places the cursor and ⌘ or Ctrl-click follows, as the hint says. */
  editing: boolean
  /** The prefixes of the reader's domains, read when drawing. */
  prefixes: () => ReadonlySet<string>
  /** Opens a task in the app, without reloading it. */
  follow: (path: string) => void
}

/** Shown for a ref clicked as a link is: plainly when only being read, with ⌘ or Ctrl while editing. */
const follows = (view: EditorView, event: MouseEvent): boolean => {
  if (event.button !== 0 || event.shiftKey || event.altKey) return false
  const modified = event.metaKey || event.ctrlKey
  return view.editable ? modified : !modified
}

const KEY = new PluginKey("taskRefLinks")

/** Redraws refs when the reader's domains change; dispatched on the editor's view. */
export const REDRAW_REFS = "taskRefLinks.redraw"

/**
 * Task refs in notes and comments, such as `P-52`, as links to the task.
 * They're drawn over the text rather than written into it, so the Markdown
 * stays as people and agents wrote it, and a new domain's refs light up too.
 */
export const TaskRefLinks = Extension.create<TaskRefLinksOptions>({
  name: "taskRefLinks",
  addOptions: () => ({ editing: false, prefixes: () => new Set<string>(), follow: () => undefined }),
  addProseMirrorPlugins() {
    const { editing, prefixes, follow } = this.options
    return [
      new Plugin<DecorationSet>({
        key: KEY,
        state: {
          init: (_config, state) => refDecorations(state.doc, prefixes(), editing),
          apply: (transaction, previous) =>
            transaction.docChanged || transaction.getMeta(REDRAW_REFS) === true
              ? refDecorations(transaction.doc, prefixes(), editing)
              : previous
        },
        props: {
          decorations: (state) => KEY.getState(state) as DecorationSet,
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target instanceof Element ? event.target : undefined
              const ref = target?.closest("a[data-task-ref]")?.getAttribute("data-task-ref")
              if (!ref || !follows(view, event)) return false
              event.preventDefault()
              follow(taskPath(ref))
              return true
            }
          }
        }
      })
    ]
  }
})
