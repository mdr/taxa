import type { Editor } from "@tiptap/react"
import { useEffect, useMemo, useRef } from "react"
import { useLocation } from "wouter"
import { useDomains } from "../domains/domain-queries.ts"
import { REDRAW_REFS, TaskRefLinks } from "./task-ref-links.ts"
import type { AnyExtension } from "@tiptap/core"

/**
 * The extension that links task refs, for an editor made once: it reads the
 * reader's domains and the app's navigation through refs, so they stay current.
 */
export const useTaskRefLinks = ({
  editing = false,
  onFollow = () => undefined
}: { editing?: boolean; onFollow?: () => void } = {}): AnyExtension => {
  const domains = useDomains()
  const [, navigate] = useLocation()
  const prefixes = useMemo(() => new Set((domains.data ?? []).map(({ prefix }) => String(prefix))), [domains.data])
  const current = useRef({ prefixes, navigate, onFollow })
  current.current = { prefixes, navigate, onFollow }
  return useMemo(
    () =>
      TaskRefLinks.configure({
        editing,
        prefixes: () => current.current.prefixes,
        follow: (path) => {
          current.current.onFollow()
          current.current.navigate(path)
        }
      }),
    [editing]
  )
}

/** Redraws the editor's refs once the reader's domains are known, or change. */
export const useRedrawRefs = (editor: Editor): void => {
  const domains = useDomains()
  useEffect(() => {
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(REDRAW_REFS, true))
  }, [editor, domains.data])
}
