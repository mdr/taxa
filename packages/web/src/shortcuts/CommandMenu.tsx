import { TaskStatus } from "@taxa/shared/tasks/task"
import { Search } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useLocation } from "wouter"
import styles from "./CommandMenu.module.css"
import { commandMenuTestIds } from "./CommandMenuTestIds.ts"
import { CommandMenuService, menuCommands, type Command } from "./command-menu-service.ts"
import { keyLabel } from "./key-press.ts"
import { GROUP_TEXT } from "./shortcut-list.ts"
import { useShortcutActions } from "./shortcut-service.ts"
import { useServiceState } from "../services/service-hooks.ts"
import { appAnalytics } from "../telemetry/app-telemetry.ts"
import { taxaApi } from "../api/taxa-api.ts"
import { realScheduler } from "../services/scheduler.ts"
import { StatusIcon } from "../tasks/StatusIcon.tsx"

const MAC = navigator.userAgent.includes("Mac")

/** ⌘K: every command that works here, found by typing, run with Enter. */
export const CommandMenu = () => {
  const { active, closeMenu } = useShortcutActions()
  const [, navigate] = useLocation()
  const [menu] = useState(
    () =>
      new CommandMenuService(menuCommands(active()), (ref) => navigate(`/tasks/${ref}`), appAnalytics, {
        scheduler: realScheduler,
        find: (search) =>
          taxaApi.tasks({ search, status: Object.values(TaskStatus).join(","), includeNotStarted: "true" })
      })
  )
  useEffect(() => menu.dispose, [menu])
  const query = useServiceState(menu, (state) => state.query)
  const selected = useServiceState(menu, (state) => state.selected)
  // Read so the list follows the server's answers.
  useServiceState(menu, (state) => state.found)
  const dialog = useRef<HTMLDialogElement>(null)
  const listId = useId()
  // Not closed on unmount: closing fires onClose, which in development's double effects shuts it at once.
  useEffect(() => dialog.current?.showModal(), [])
  const matches = menu.matches(query)
  const run = (command: Command | undefined): void => {
    if (!command) return
    // Closed first, so focus is back on the page for what the command opens.
    dialog.current?.close()
    menu.run(command)
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      onClose={closeMenu}
      aria-label="Commands"
      data-testid={commandMenuTestIds.dialog}
    >
      <div className={styles.searchRow}>
        <Search size={18} aria-hidden />
        <input
          className={styles.search}
          value={query}
          onChange={(event) => menu.type(event.target.value)}
          onKeyDown={(event) => {
            const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
            if (step === 1 || step === -1) {
              event.preventDefault()
              menu.move(step)
            } else if (event.key === "Enter") {
              event.preventDefault()
              run(menu.chosen())
            }
          }}
          placeholder="Type a command, or find a task"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={matches.length > 0 ? `${listId}-${selected}` : undefined}
          aria-label="Command"
          data-testid={commandMenuTestIds.search}
        />
      </div>
      {matches.length === 0 ? (
        <p className={styles.empty}>Nothing matches</p>
      ) : (
        <div id={listId} className={styles.commands} role="listbox" aria-label="Commands">
          {matches.map((command, index) => (
            <div
              key={command.task?.id ?? `${command.group} ${command.description}`}
              id={`${listId}-${index}`}
              className={styles.command}
              role="option"
              aria-selected={index === selected}
              onPointerMove={() => menu.select(index)}
              onClick={() => run(command)}
              onKeyDown={(event) => {
                if (event.key === "Enter") run(command)
              }}
              tabIndex={-1}
              data-testid={command.task ? commandMenuTestIds.foundTask : commandMenuTestIds.command}
            >
              {command.task && <StatusIcon status={command.task.status} size={15} />}
              <span className={styles.description} data-testid={commandMenuTestIds.description}>
                {command.description}
              </span>
              <span className={styles.group} data-testid={commandMenuTestIds.detail}>
                {command.task ? command.task.ref : GROUP_TEXT[command.group]}
              </span>
              {command.keys?.map((key) => (
                <kbd key={key} className={styles.key}>
                  {keyLabel(key, MAC)}
                </kbd>
              ))}
            </div>
          ))}
        </div>
      )}
    </dialog>
  )
}
