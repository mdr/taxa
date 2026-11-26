import type { TaskId } from "@taxa/shared/ids"
import { When, whenRequest } from "@taxa/shared/tasks/when"
import { Plus } from "lucide-react"
import type { Domain } from "@taxa/shared/domains/domain"
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
import { captureDomain, loadCaptureFiling, saveCaptureFiling } from "./capture-filing.ts"
import { useToday } from "../../dates/use-today.ts"
import type { CaptureWhen } from "./task-list.ts"
import { FocusTarget, useFocusRequested, useShortcutActions } from "../../shortcuts/shortcut-service.ts"

/** With more than one domain, which a new task goes in. */
const DomainPicker = ({
  domain,
  domains,
  onChoose
}: {
  domain: Domain
  domains: readonly Domain[]
  onChoose: (choice: string) => void
}) => (
  <Popover
    label="Which domain it goes in"
    look={PopoverLook.CHIP}
    testId={quickCaptureTestIds.filing}
    track="QuickCapture.filing"
    value={domain.prefix}
    trigger={
      <>
        <DomainBadge prefix={domain.prefix} /> {domain.name}
      </>
    }
    alignEnd
  >
    {(close) => (
      <OptionList
        track="QuickCapture.filing"
        selected={domain.prefix}
        options={domains.map(({ prefix, name }) => ({
          value: prefix,
          label: name,
          icon: <DomainBadge prefix={prefix} />
        }))}
        onChoose={(choice) => {
          close()
          onChoose(choice)
        }}
      />
    )}
  </Popover>
)

const PLACEHOLDER: Record<CaptureWhen, string> = {
  [When.TODAY]: "Add a task for today",
  [When.SOON]: "Add a task for soon",
  [When.SOMEDAY]: "Add a task for someday"
}

/**
 * A title, and Enter: into this domain if given; else the only one, or the one
 * chosen beside it, which stays chosen for the next, here and next time. Said
 * nothing of when it's for, it waits in the Inbox to be sorted out.
 * Given a `when`, the task is for then, so it's listed where it was added.
 * Once added, a task shown on the page is highlighted there, if it can be.
 */
export const QuickCapture = ({
  domainPrefix,
  when,
  highlight
}: {
  domainPrefix?: string
  when?: CaptureWhen
  highlight?: (id: TaskId) => void
}) => {
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
  const domains = useDomains().data ?? []
  /** The domain last chosen, while it's still one; else the first. */
  const picked = captureDomain(domains, chosen)
  const choose = (choice: string): void => {
    setChosen(choice)
    saveCaptureFiling(choice)
  }
  const create = useCreateTask()
  const field = useRef<HTMLInputElement>(null)
  const { focusTaken } = useShortcutActions()
  const today = useToday()
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
      {
        title: title.trim(),
        tags,
        domain: domainPrefix ?? picked?.prefix,
        // Added in a domain's list, it's placed already, so filed, and listed there.
        ...(domainPrefix !== undefined && { inbox: false }),
        ...(when && whenRequest(when, today).set)
      },
      {
        onSuccess: (task) => {
          setTitle("")
          setTags([])
          // Highlighting the new row moves focus to it, for its keys; C comes back here.
          highlight?.(task.id)
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
        placeholder={when ? PLACEHOLDER[when] : "Add a task"}
        data-testid={quickCaptureTestIds.title}
        data-track="QuickCapture.title"
      />
      {tags.map((name) => (
        <TagChip key={name} name={name} onRemove={() => setTags(withoutTags(tags, [name]))} />
      ))}
      {title.trim() !== "" && <kbd className={styles.hint}>Enter</kbd>}
      {domainPrefix === undefined && picked && domains.length > 1 && (
        <DomainPicker domain={picked} domains={domains} onChoose={choose} />
      )}
      <button
        type="submit"
        className={styles.submit}
        disabled={create.isPending}
        data-testid={quickCaptureTestIds.add}
        data-track="QuickCapture.add"
      >
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
      {create.isError && (
        <p className={styles.error} role="alert" data-testid={quickCaptureTestIds.error}>
          {problemMessage(create.error)}
        </p>
      )}
    </form>
  )
}
