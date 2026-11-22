import { trackUi, UiEvent } from "../telemetry/ui-tracking.ts"
import { appAnalytics } from "../telemetry/app-telemetry.ts"
import { X } from "lucide-react"
import { Fragment, useEffect, useRef } from "react"
import styles from "./ShortcutsHelp.module.css"
import { shortcutsHelpTestIds } from "./ShortcutsHelpTestIds.ts"
import { keyLabel } from "./key-press.ts"
import { GROUP_TEXT, shortcutEntries } from "./shortcut-list.ts"
import { ShortcutGroup, useShortcutActions, useSingleKeys } from "./shortcut-service.ts"

const MAC = navigator.userAgent.includes("Mac")

/** `G` then `H`, or another way. */
const Ways = ({ ways }: { ways: (readonly string[])[] }) =>
  ways.map((keys, way) => (
    <Fragment key={way}>
      {way > 0 && <span className={styles.or}>or</span>}
      {keys.map((key, index) => (
        <Fragment key={index}>
          {index > 0 && "then"}
          <kbd className={styles.key}>{keyLabel(key, MAC)}</kbd>
        </Fragment>
      ))}
    </Fragment>
  ))

/** Every shortcut that works here, and the choice to turn single-key ones off. */
export const ShortcutsHelp = () => {
  const { active, closeHelp, setSingleKeys } = useShortcutActions()
  const singleKeys = useSingleKeys()
  const dialog = useRef<HTMLDialogElement>(null)
  // Not closed on unmount: closing fires onClose, which in development's double effects shuts it at once.
  useEffect(() => {
    dialog.current?.showModal()
    trackUi(appAnalytics, UiEvent.OPENED, "ShortcutsHelp.dialog")
  }, [])
  const shortcuts = active()
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      onClose={closeHelp}
      aria-labelledby="shortcuts-heading"
      data-testid={shortcutsHelpTestIds.dialog}
      data-track="ShortcutsHelp.dialog"
    >
      <div className={styles.header}>
        <h2 id="shortcuts-heading" className={styles.heading}>
          Keyboard shortcuts
        </h2>
        <button
          type="button"
          className={styles.close}
          onClick={() => dialog.current?.close()}
          aria-label="Close"
          data-testid={shortcutsHelpTestIds.close}
          data-track="ShortcutsHelp.close"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      {Object.values(ShortcutGroup).map((group) => {
        const entries = shortcutEntries(shortcuts, group)
        if (entries.length === 0) return undefined
        return (
          <Fragment key={group}>
            <h3 className={styles.group}>{GROUP_TEXT[group]}</h3>
            <dl className={styles.list}>
              {entries.map(({ description, ways }) => (
                <div key={description} className={styles.shortcut} data-testid={shortcutsHelpTestIds.shortcut}>
                  <dt className={styles.description}>{description}</dt>
                  <dd className={styles.keys}>
                    <Ways ways={ways} />
                  </dd>
                </div>
              ))}
            </dl>
          </Fragment>
        )
      })}
      <label className={styles.setting}>
        <input
          type="checkbox"
          checked={singleKeys}
          onChange={(event) => setSingleKeys(event.target.checked)}
          data-testid={shortcutsHelpTestIds.singleKeys}
          data-track="ShortcutsHelp.singleKeys"
        />
        <span>
          Single-key shortcuts
          <span className={styles.settingNote}>
            Keys without {MAC ? "⌘" : "Ctrl"}, like C and G. Turn them off if they get in the way of a screen reader's
            keys.
          </span>
        </span>
      </label>
    </dialog>
  )
}
