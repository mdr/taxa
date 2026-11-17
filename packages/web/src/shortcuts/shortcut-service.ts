import type { Ms } from "@taxa/shared/units"
import { useEffect, useLayoutEffect, useRef } from "react"
import { keyName } from "./key-press.ts"
import type { ShortcutSettingsStore } from "./shortcut-settings.ts"
import { AbstractService } from "../services/abstract-service.ts"
import type { Scheduler } from "../services/scheduler.ts"
import { createServiceContext, useService, useServiceState } from "../services/service-hooks.ts"

/** How long the app waits for the next key of a sequence like `G H`. */
export const SEQUENCE_MS: Ms = 1200

export enum ShortcutGroup {
  GENERAL = "GENERAL",
  GO = "GO",
  TASKS = "TASKS"
}

/** Who set a shortcut: a page's own beat the app's, so `C` on a task's page can file into its domain. */
export enum ShortcutScope {
  APP = "APP",
  PAGE = "PAGE"
}

/** Somewhere a shortcut puts the cursor, once the page with it is showing. */
export enum FocusTarget {
  CAPTURE = "CAPTURE"
}

export interface Shortcut {
  /** Pressed in turn, named as `keyName` names them. */
  keys: readonly string[]
  description: string
  group: ShortcutGroup
  run: () => void
  /** Whether there's anything for it to do now; if not, the key is left to the browser. */
  available?: () => boolean
}

interface Layer {
  scope: ShortcutScope
  shortcuts: () => readonly Shortcut[]
}

export interface ShortcutState {
  layers: readonly Layer[]
  /** Keys pressed so far of a sequence. */
  pending: readonly string[]
  helpOpen: boolean
  /** Shortcuts without ⌘ or Ctrl, which can clash with a screen reader's keys: each person can turn them off. */
  singleKeys: boolean
  focusRequest: FocusTarget | undefined
}

export interface ShortcutActions {
  /** Adds shortcuts, read afresh at each press; returns how to take them away. */
  register: (scope: ShortcutScope, shortcuts: () => readonly Shortcut[]) => () => void
  /** Whether the key did something, so the browser shouldn't. */
  press: (key: string) => boolean
  /** The shortcuts that work now, one for each sequence. */
  active: () => readonly Shortcut[]
  openHelp: () => void
  closeHelp: () => void
  setSingleKeys: (on: boolean) => void
  requestFocus: (target: FocusTarget) => void
  focusTaken: () => void
  dispose: () => void
}

const SCOPE_RANK: Record<ShortcutScope, number> = { [ShortcutScope.PAGE]: 0, [ShortcutScope.APP]: 1 }

const isSingleKey = (shortcut: Shortcut): boolean => !shortcut.keys[0]?.startsWith("mod+")

const startsWith = (keys: readonly string[], start: readonly string[]): boolean =>
  start.every((key, index) => keys[index] === key)

/** The keyboard shortcuts, wherever they're set, and the list of them. */
export class ShortcutService extends AbstractService<ShortcutState> implements ShortcutActions {
  readonly #scheduler: Scheduler
  readonly #settings: ShortcutSettingsStore
  #cancelWait: (() => void) | undefined

  constructor(scheduler: Scheduler, settings: ShortcutSettingsStore) {
    super({ layers: [], pending: [], helpOpen: false, singleKeys: settings.loadSingleKeys(), focusRequest: undefined })
    this.#scheduler = scheduler
    this.#settings = settings
  }

  readonly register = (scope: ShortcutScope, shortcuts: () => readonly Shortcut[]): (() => void) => {
    const layer: Layer = { scope, shortcuts }
    this.updateState((state) => ({ ...state, layers: [...state.layers, layer] }))
    return () => this.updateState((state) => ({ ...state, layers: state.layers.filter((each) => each !== layer) }))
  }

  readonly active = (): readonly Shortcut[] => {
    const layers = [...this.state.layers].reverse().sort((a, b) => SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope])
    const seen = new Set<string>()
    return layers
      .flatMap((layer) => layer.shortcuts())
      .filter((shortcut) => this.state.singleKeys || !isSingleKey(shortcut))
      .filter((shortcut) => {
        const sequence = shortcut.keys.join(" ")
        if (seen.has(sequence)) return false
        seen.add(sequence)
        return true
      })
  }

  readonly press = (key: string): boolean => {
    if (this.state.helpOpen) return false
    this.#stopWaiting()
    const pending = this.state.pending
    const sequence = [...pending, key]
    const active = this.active()
    const exact = active.find(
      (shortcut) => shortcut.keys.length === sequence.length && startsWith(shortcut.keys, sequence)
    )
    if (active.some((shortcut) => shortcut.keys.length > sequence.length && startsWith(shortcut.keys, sequence))) {
      this.setState({ pending: sequence })
      // `G H` could be the start of `G H O`: wait, then take the shorter.
      this.#cancelWait = this.#scheduler.after(SEQUENCE_MS, () => {
        this.#cancelWait = undefined
        this.setState({ pending: [] })
        exact?.run()
      })
      return true
    }
    if (pending.length > 0) this.setState({ pending: [] })
    if (exact && exact.available?.() !== false) {
      exact.run()
      return true
    }
    // A key that doesn't go on from the keys before it starts afresh.
    return pending.length > 0 ? this.press(key) : false
  }

  readonly openHelp = (): void => {
    this.#stopWaiting()
    this.setState({ helpOpen: true, pending: [] })
  }

  readonly closeHelp = (): void => this.setState({ helpOpen: false })

  readonly setSingleKeys = (on: boolean): void => {
    this.setState({ singleKeys: on })
    this.#settings.saveSingleKeys(on)
  }

  readonly requestFocus = (target: FocusTarget): void => this.setState({ focusRequest: target })

  readonly focusTaken = (): void => this.setState({ focusRequest: undefined })

  readonly dispose = (): void => this.#stopWaiting()

  #stopWaiting(): void {
    this.#cancelWait?.()
    this.#cancelWait = undefined
  }
}

export const ShortcutContext = createServiceContext<ShortcutService>()

export const useShortcutActions = (): ShortcutActions => useService(ShortcutContext)

export const useHelpOpen = (): boolean => useServiceState(useService(ShortcutContext), (state) => state.helpOpen)

export const useSingleKeys = (): boolean => useServiceState(useService(ShortcutContext), (state) => state.singleKeys)

export const useFocusRequested = (target: FocusTarget): boolean =>
  useServiceState(useService(ShortcutContext), (state) => state.focusRequest === target)

/** Shortcuts for as long as the component is showing; each press sees the latest given. */
export const useShortcuts = (scope: ShortcutScope, shortcuts: readonly Shortcut[]): void => {
  const service = useService(ShortcutContext)
  const latest = useRef(shortcuts)
  useLayoutEffect(() => {
    latest.current = shortcuts
  })
  useEffect(() => service.register(scope, () => latest.current), [service, scope])
}

const TYPED_IN = new Set(["INPUT", "TEXTAREA", "SELECT"])
const NOT_TYPED_IN = new Set(["checkbox", "radio", "button", "submit", "reset"])

/** Whether a key pressed here is someone typing, which shortcuts must leave alone. */
const isTyping = (target: EventTarget | undefined): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (!TYPED_IN.has(target.tagName)) return false
  return !(target instanceof HTMLInputElement && NOT_TYPED_IN.has(target.type))
}

/** Sends the page's key presses to the service. */
export const useKeyboardShortcuts = (service: ShortcutService): void =>
  useEffect(() => {
    const listener = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing || isTyping(event.target ?? undefined)) return
      const key = keyName(event)
      if (key !== undefined && service.press(key)) event.preventDefault()
    }
    document.addEventListener("keydown", listener)
    return () => document.removeEventListener("keydown", listener)
  }, [service])
