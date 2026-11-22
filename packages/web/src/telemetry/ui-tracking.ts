import { useEffect } from "react"
import type { Analytics } from "./analytics.ts"
import { ANALYTICS_CODES, type AnalyticsCode } from "./codes.ts"

/** What someone did with a control, for the `ui.*` analytics. */
export enum UiEvent {
  CLICKED = "CLICKED",
  CHOSEN = "CHOSEN",
  TOGGLED = "TOGGLED",
  EDITED = "EDITED",
  OPENED = "OPENED",
  CLOSED = "CLOSED"
}

const CODES: Record<UiEvent, AnalyticsCode> = {
  [UiEvent.CLICKED]: ANALYTICS_CODES.ui.clicked,
  [UiEvent.CHOSEN]: ANALYTICS_CODES.ui.chosen,
  [UiEvent.TOGGLED]: ANALYTICS_CODES.ui.toggled,
  [UiEvent.EDITED]: ANALYTICS_CODES.ui.edited,
  [UiEvent.OPENED]: ANALYTICS_CODES.ui.opened,
  [UiEvent.CLOSED]: ANALYTICS_CODES.ui.closed
}

const VERBS: Record<UiEvent, string> = {
  [UiEvent.CLICKED]: "clicked",
  [UiEvent.CHOSEN]: "chose in",
  [UiEvent.TOGGLED]: "toggled",
  [UiEvent.EDITED]: "edited",
  [UiEvent.OPENED]: "opened",
  [UiEvent.CLOSED]: "closed"
}

/** Tracks an interaction with a control, named by what it's for (`TaskRow.menu`): never what was typed or chosen. */
export const trackUi = (analytics: Analytics, event: UiEvent, control: string): void =>
  analytics.track(CODES[event], `${VERBS[event]} ${control}`, { control })

/** What the listener needs to know of the element an event happened on. */
export interface ControlFacts {
  tag: string
  /** An input's type. */
  type: string | undefined
  /** Its `data-track`: what it's for; empty when its component tracks it itself. */
  track: string | undefined
}

const FIELDS = new Set(["INPUT", "TEXTAREA", "SELECT"])
const CLICKABLE = new Set(["BUTTON", "A", "SUMMARY"])
const TOGGLES = new Set(["checkbox", "radio"])
const TEXT_INPUTS = new Set(["text", "search", "email", "url", "number", "time", "date", "password", "tel"])

const isTextField = ({ tag, type }: ControlFacts): boolean =>
  tag === "TEXTAREA" || (tag === "INPUT" && TEXT_INPUTS.has(type ?? "text"))

/** A click's event: on buttons and links; fields are tracked when they change, not clicked into, and dialogs when they close. */
export const clickEvent = (facts: ControlFacts): UiEvent | undefined =>
  facts.track && CLICKABLE.has(facts.tag) ? UiEvent.CLICKED : undefined

/** A field's committed change: a toggle, or an edit. */
export const changeEvent = (facts: ControlFacts): UiEvent | undefined => {
  if (!facts.track || !FIELDS.has(facts.tag)) return undefined
  return facts.tag === "INPUT" && TOGGLES.has(facts.type ?? "") ? UiEvent.TOGGLED : UiEvent.EDITED
}

/** Enter in a text field commits it, as some close before they'd lose focus and change. */
export const enterEvent = (facts: ControlFacts): UiEvent | undefined =>
  facts.track && isTextField(facts) ? UiEvent.EDITED : undefined

const factsOf = (element: Element): ControlFacts => ({
  tag: element.tagName,
  type: element instanceof HTMLInputElement ? element.type : undefined,
  track: element.getAttribute("data-track") ?? undefined
})

const valueOf = (element: Element): string | undefined =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
    ? element.value
    : undefined

/**
 * Tracks what's done with every control marked `data-track`, from one
 * listener on the document: clicks, toggles, edits once committed (on
 * change or Enter, the same value once), and dialogs closing.
 */
export const useUiTracking = (analytics: Analytics): void =>
  useEffect(() => {
    /** The value each field was last tracked with, so Enter then leaving it counts once. */
    const tracked = new WeakMap<Element, string>()
    const edited = (element: Element, event: UiEvent | undefined): void => {
      const value = valueOf(element)
      if (event === undefined || (event === UiEvent.EDITED && tracked.get(element) === value)) return
      if (value !== undefined) tracked.set(element, value)
      trackUi(analytics, event, factsOf(element).track ?? "")
    }
    const click = (event: MouseEvent): void => {
      // The button clicked, not whatever named thing it's in, such as a dialog.
      const element =
        event.target instanceof Element ? (event.target.closest("button, a, summary") ?? undefined) : undefined
      const ui = element && clickEvent(factsOf(element))
      if (element && ui) trackUi(analytics, ui, factsOf(element).track ?? "")
    }
    const change = (event: Event): void => {
      if (event.target instanceof Element) edited(event.target, changeEvent(factsOf(event.target)))
    }
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === "Enter" && !event.isComposing && event.target instanceof Element)
        edited(event.target, enterEvent(factsOf(event.target)))
    }
    const close = (event: Event): void => {
      const track = event.target instanceof HTMLDialogElement && event.target.getAttribute("data-track")
      if (track) trackUi(analytics, UiEvent.CLOSED, track)
    }
    // Capturing, so a handler that stops the event doesn't hide it, and a dialog's close, which doesn't bubble, is heard.
    document.addEventListener("click", click, true)
    document.addEventListener("change", change, true)
    document.addEventListener("keydown", keydown, true)
    document.addEventListener("close", close, true)
    return () => {
      document.removeEventListener("click", click, true)
      document.removeEventListener("change", change, true)
      document.removeEventListener("keydown", keydown, true)
      document.removeEventListener("close", close, true)
    }
  }, [analytics])
