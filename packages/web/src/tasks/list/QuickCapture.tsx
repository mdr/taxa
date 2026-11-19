import type { Task } from "@taxa/shared/tasks/task"
import { Inbox, Plus } from "lucide-react"
import { Link } from "wouter"
import { useEffect, useRef, useState, type SubmitEvent } from "react"
import styles from "./QuickCapture.module.css"
import { quickCaptureTestIds } from "./QuickCaptureTestIds.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { useCreateTask } from "../task-queries.ts"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import { useDomains } from "../../domains/domain-queries.ts"
import { OptionList } from "../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../ui/Popover.tsx"
import { INBOX_CHOICE } from "../filing/filing.ts"
import { loadCaptureFiling, saveCaptureFiling } from "./capture-filing.ts"
import { FocusTarget, useFocusRequested, useShortcutActions } from "../../shortcuts/shortcut-service.ts"

/** In the Inbox, where a new task goes: the Inbox, or straight into a domain. */
const FilingPicker = ({ filing, onChoose }: { filing: string; onChoose: (choice: string) => void }) => {
  const domains = useDomains().data ?? []
  const domain = domains.find(({ prefix }) => prefix === filing)
  return (
    <Popover
      label="Where it goes"
      look={PopoverLook.CHIP}
      testId={quickCaptureTestIds.filing}
      value={filing}
      trigger={
        domain ? (
          <>
            <DomainBadge prefix={domain.prefix} /> {domain.name}
          </>
        ) : (
          <>
            <Inbox size={14} aria-hidden /> Inbox
          </>
        )
      }
      alignEnd
    >
      {(close) => (
        <OptionList
          selected={filing}
          options={[
            { value: INBOX_CHOICE, label: "Inbox", icon: <Inbox size={15} aria-hidden /> },
            ...domains.map(({ prefix, name }) => ({
              value: prefix,
              label: name,
              icon: <DomainBadge prefix={prefix} />
            }))
          ]}
          onChoose={(choice) => {
            close()
            onChoose(choice)
          }}
        />
      )}
    </Popover>
  )
}

/**
 * A title, and Enter: into this domain if given; else the Inbox, or a domain
 * chosen for it there, which stays chosen for the next, here and next time.
 */
export const QuickCapture = ({ domainPrefix }: { domainPrefix: string | undefined }) => {
  const [title, setTitle] = useState("")
  const [chosen, setChosen] = useState(loadCaptureFiling)
  /** The last task added straight into a domain from the Inbox, so it's not lost from sight. */
  const [filed, setFiled] = useState<Task | undefined>(undefined)
  const domains = useDomains().data ?? []
  /** The last place chosen, while it's still a domain; else the Inbox. */
  const filing = domains.some(({ prefix }) => prefix === chosen) ? chosen : INBOX_CHOICE
  const choose = (choice: string): void => {
    setChosen(choice)
    saveCaptureFiling(choice)
  }
  const create = useCreateTask()
  const field = useRef<HTMLInputElement>(null)
  const { focusTaken } = useShortcutActions()
  const focusWanted = useFocusRequested(FocusTarget.CAPTURE)
  useEffect(() => {
    if (!focusWanted) return
    field.current?.focus()
    focusTaken()
  }, [focusWanted, focusTaken])
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (title.trim() === "") return
    create.mutate(
      { title: title.trim(), domain: domainPrefix ?? (filing === INBOX_CHOICE ? undefined : filing) },
      {
        onSuccess: (task) => {
          setTitle("")
          setFiled(domainPrefix === undefined && !task.inbox ? task : undefined)
          appAnalytics.track(ANALYTICS_CODES.task.captured, `captured ${task.ref}`, {
            taskId: task.id,
            taskRef: task.ref,
            domainId: task.domainId
          })
        }
      }
    )
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <Plus size={18} className={styles.plus} aria-hidden />
      <input
        ref={field}
        className={styles.title}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur()
        }}
        aria-label="New task"
        aria-keyshortcuts="C"
        placeholder="Add a task"
        data-testid={quickCaptureTestIds.title}
      />
      {title.trim() !== "" && <kbd className={styles.hint}>Enter</kbd>}
      {domainPrefix === undefined && <FilingPicker filing={filing} onChoose={choose} />}
      <button type="submit" className={styles.submit} disabled={create.isPending} data-testid={quickCaptureTestIds.add}>
        Add
      </button>
      {filed && (
        <p className={styles.filed} role="status" data-testid={quickCaptureTestIds.filed}>
          Added <Link href={`/tasks/${filed.ref}`}>{filed.ref}</Link> to{" "}
          {domains.find(({ id }) => id === filed.domainId)?.name ?? "its domain"}.
        </p>
      )}
      {create.isError && (
        <p className={styles.error} role="alert" data-testid={quickCaptureTestIds.error}>
          {problemMessage(create.error)}
        </p>
      )}
    </form>
  )
}
