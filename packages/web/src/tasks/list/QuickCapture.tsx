import type { Task } from "@taxa/shared/tasks/task"
import { Inbox, Plus } from "lucide-react"
import { Link } from "wouter"
import { useEffect, useId, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react"
import { withTags, withoutTags } from "@taxa/shared/tasks/tags"
import { hashTagIn } from "../../tags/hash-tag.ts"
import { useTags } from "../../tags/tag-queries.ts"
import { tagSuggestions } from "../../tags/tag-suggestions.ts"
import { TagChip } from "../../tags/TagChip.tsx"
import {
  movedHighlight,
  NONE_HIGHLIGHTED,
  startingHighlight,
  TagSuggestionList
} from "../../tags/TagSuggestionList.tsx"
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
import { useListSession } from "./list-session-service.ts"
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
  /** Tags picked with #, for the task about to be added. */
  const [tags, setTags] = useState<string[]>([])
  /** Where a # was typed whose suggestions Escape put away, so it's kept as text. */
  const [dismissed, setDismissed] = useState<number | undefined>(undefined)
  const [highlighted, setHighlighted] = useState(NONE_HIGHLIGHTED)
  const allTags = useTags().data ?? []
  const hashTag = hashTagIn(title)
  const typingTag = hashTag !== undefined && hashTag.start !== dismissed
  const suggestions = typingTag ? tagSuggestions(allTags, hashTag.typed, tags) : []
  const suggestionsId = useId()
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
  const { highlight } = useListSession()
  const focusWanted = useFocusRequested(FocusTarget.CAPTURE)
  useEffect(() => {
    if (!focusWanted) return
    field.current?.focus()
    focusTaken()
  }, [focusWanted, focusTaken])
  /** Takes the # and what follows out of the title, and the tag into those for the task. */
  const pickTag = (name: string, start: number): void => {
    setTitle(title.slice(0, start))
    setTags(withTags(tags, [name]))
    setHighlighted(NONE_HIGHLIGHTED)
  }
  const pickWithKeys = (event: KeyboardEvent<HTMLInputElement>, start: number): void => {
    const moved = movedHighlight(event.key, highlighted, suggestions.length)
    if (moved !== undefined) {
      event.preventDefault()
      setHighlighted(moved)
    } else if ((event.key === "Enter" || event.key === "Tab") && suggestions[highlighted]) {
      // With none highlighted, Enter adds the task as it is.
      event.preventDefault()
      pickTag(suggestions[highlighted].name, start)
    } else if (event.key === "Escape") {
      event.preventDefault()
      setDismissed(start)
    }
  }
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (title.trim() === "") return
    create.mutate(
      { title: title.trim(), tags, domain: domainPrefix ?? (filing === INBOX_CHOICE ? undefined : filing) },
      {
        onSuccess: (task) => {
          setTitle("")
          setTags([])
          const filedElsewhere = domainPrefix === undefined && !task.inbox
          setFiled(filedElsewhere ? task : undefined)
          // Highlighting the new row moves focus to it, for its keys; C comes back here.
          if (!filedElsewhere) highlight(task.id)
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
    <form className={styles.form} onSubmit={submit} data-testid={quickCaptureTestIds.form}>
      <Plus size={18} className={styles.plus} aria-hidden />
      <input
        ref={field}
        className={styles.title}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value)
          setHighlighted(startingHighlight(hashTagIn(event.target.value)?.typed ?? ""))
        }}
        onKeyDown={(event) => {
          if (suggestions.length > 0 && hashTag) return pickWithKeys(event, hashTag.start)
          if (event.key === "Escape") event.currentTarget.blur()
        }}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={suggestionsId}
        aria-activedescendant={suggestions[highlighted] ? `${suggestionsId}-${highlighted}` : undefined}
        aria-label="New task"
        aria-keyshortcuts="C"
        placeholder="Add a task"
        data-testid={quickCaptureTestIds.title}
      />
      {tags.map((name) => (
        <TagChip key={name} name={name} onRemove={() => setTags(withoutTags(tags, [name]))} />
      ))}
      {title.trim() !== "" && <kbd className={styles.hint}>Enter</kbd>}
      {domainPrefix === undefined && <FilingPicker filing={filing} onChoose={choose} />}
      <button type="submit" className={styles.submit} disabled={create.isPending} data-testid={quickCaptureTestIds.add}>
        Add
      </button>
      {suggestions.length > 0 && hashTag && (
        <div className={styles.tagSuggestions}>
          <TagSuggestionList
            id={suggestionsId}
            suggestions={suggestions}
            highlighted={highlighted}
            onPick={(name) => pickTag(name, hashTag.start)}
          />
        </div>
      )}
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
