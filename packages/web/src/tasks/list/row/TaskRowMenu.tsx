import { formatDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Domain } from "@taxa/shared/domains/domain"
import { formatEstimate } from "@taxa/shared/tasks/estimate"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { When, whenOf, whenRequest } from "@taxa/shared/tasks/when"
import {
  CalendarClock,
  ChevronLeft,
  Copy,
  CornerDownRight,
  Ellipsis,
  FolderInput,
  Inbox,
  Timer,
  Trash2
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import styles from "./TaskRowMenu.module.css"
import { taskRowTestIds } from "./TaskRowTestIds.ts"
import { DatePicker } from "../../../dates/DatePicker.tsx"
import { DomainBadge } from "../../../domains/DomainBadge.tsx"
import { appAnalytics } from "../../../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../../../telemetry/codes.ts"
import { capitalised } from "../../../ui/capitalised.ts"
import { OptionList } from "../../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../../ui/Popover.tsx"
import { setOrClear } from "../../changes/field-change.ts"
import { TaskChangeType, useTaskChanges, type TaskChange } from "../../changes/task-changes-service.ts"
import { EstimateEditor } from "../../detail/properties/EstimateProperty.tsx"
import { INBOX_CHOICE, filingChoice, filingRequest } from "../../filing/filing.ts"
import { PriorityIcon } from "../../PriorityIcon.tsx"
import { StatusIcon } from "../../StatusIcon.tsx"
import { WHEN_ICONS, whenLabel, whenOptions } from "../../when/when-choices.tsx"
import { useFollowOn } from "../../follow-ons/follow-on-service.ts"

/** What the menu shows: its list of things to change, or the choices for one of them. */
enum Section {
  MAIN = "MAIN",
  STATUS = "STATUS",
  PRIORITY = "PRIORITY",
  WHEN = "WHEN",
  ON_A_DAY = "ON_A_DAY",
  DUE = "DUE",
  ESTIMATE = "ESTIMATE",
  MOVE = "MOVE"
}

const SECTION_TEXT: Record<Section, string> = {
  [Section.MAIN]: "",
  [Section.STATUS]: "Status",
  [Section.PRIORITY]: "Priority",
  [Section.WHEN]: "When",
  [Section.ON_A_DAY]: "On a day",
  [Section.DUE]: "Due date",
  [Section.ESTIMATE]: "Estimate",
  [Section.MOVE]: "Move to"
}

enum Action {
  FOLLOW_ON = "FOLLOW_ON",
  COPY_REF = "COPY_REF",
  DELETE = "DELETE"
}

const FOCUSABLE = "input, button:not(:disabled), [tabindex]:not([tabindex='-1'])"

interface PanelProps {
  task: Task
  today: IsoDate
  domains: readonly Domain[]
  /** Makes the change and closes the menu. */
  apply: (change: TaskChange) => void
  /** Deletes the task, with a chance to undo it, and closes the menu. */
  remove: () => void
  close: () => void
}

const MainOptions = ({
  task,
  today,
  domains,
  remove,
  close,
  open
}: PanelProps & { open: (section: Section) => void }) => {
  const domain = domains.find(({ id }) => id === task.domainId)
  const { start } = useFollowOn()
  const WhenIcon = WHEN_ICONS[whenOf(task, today)]
  return (
    <OptionList
      options={[
        {
          value: Section.STATUS,
          label: "Status",
          icon: <StatusIcon status={task.status} />,
          detail: capitalised(STATUS_TEXT[task.status])
        },
        {
          value: Section.PRIORITY,
          label: "Priority",
          icon: <PriorityIcon priority={task.priority} />,
          detail: capitalised(PRIORITY_TEXT[task.priority])
        },
        {
          value: Section.WHEN,
          label: "When",
          icon: <WhenIcon size={15} aria-hidden />,
          detail: whenLabel(task, today)
        },
        {
          value: Section.DUE,
          label: "Due date",
          icon: <CalendarClock size={15} aria-hidden />,
          detail: task.due ? formatDay(task.due, today) : "None"
        },
        {
          value: Section.ESTIMATE,
          label: "Estimate",
          icon: <Timer size={15} aria-hidden />,
          detail: task.estimateMinutes === undefined ? "None" : formatEstimate(task.estimateMinutes)
        },
        {
          value: Section.MOVE,
          label: "Move to",
          icon: <FolderInput size={15} aria-hidden />,
          detail: domain?.name ?? "Inbox"
        },
        {
          value: Action.FOLLOW_ON,
          label: "Add follow-on task",
          icon: <CornerDownRight size={15} aria-hidden />
        },
        { value: Action.COPY_REF, label: `Copy ${task.ref}`, icon: <Copy size={15} aria-hidden /> },
        { value: Action.DELETE, label: "Delete task", icon: <Trash2 size={15} aria-hidden />, danger: true }
      ]}
      onChoose={(choice) => {
        const chosen = choice as Action | Section
        if (chosen === Action.FOLLOW_ON) {
          close()
          start(task)
        } else if (chosen === Action.COPY_REF) {
          close()
          void navigator.clipboard.writeText(task.ref)
          appAnalytics.track(ANALYTICS_CODES.task.refCopied, `copied ${task.ref}`, {
            taskId: task.id,
            taskRef: task.ref
          })
        } else if (chosen === Action.DELETE) remove()
        else open(chosen)
      }}
    />
  )
}

/** The choices for one thing about the task. */
const SectionChoices = ({
  section,
  task,
  today,
  domains,
  apply,
  open
}: PanelProps & { section: Section; open: (section: Section) => void }) => {
  switch (section) {
    case Section.STATUS:
      return (
        <OptionList
          options={Object.values(TaskStatus).map((status) => ({
            value: status,
            label: capitalised(STATUS_TEXT[status]),
            icon: <StatusIcon status={status} />
          }))}
          selected={task.status}
          onChoose={(status) => apply({ type: TaskChangeType.STATUS, request: { status: status as TaskStatus } })}
        />
      )
    case Section.PRIORITY:
      return (
        <OptionList
          options={Object.values(Priority).map((priority) => ({
            value: priority,
            label: capitalised(PRIORITY_TEXT[priority]),
            icon: <PriorityIcon priority={priority} />
          }))}
          selected={task.priority}
          onChoose={(priority) =>
            apply({ type: TaskChangeType.UPDATE, request: { set: { priority: priority as Priority } } })
          }
        />
      )
    case Section.WHEN:
      return (
        <OptionList
          options={whenOptions(task, today)}
          selected={whenOf(task, today)}
          onChoose={(choice) => {
            const when = choice as When
            if (when === When.ON_A_DAY) open(Section.ON_A_DAY)
            else apply({ type: TaskChangeType.UPDATE, request: whenRequest(when, today) })
          }}
        />
      )
    case Section.ON_A_DAY:
      return (
        <DatePicker
          value={task.scheduled}
          today={today}
          onChoose={(date) =>
            apply({
              type: TaskChangeType.UPDATE,
              request: date === undefined ? whenRequest(When.ANY_TIME, today) : whenRequest(When.ON_A_DAY, today, date)
            })
          }
        />
      )
    case Section.DUE:
      return (
        <DatePicker value={task.due} today={today} onChoose={(date) => apply(setOrClear(ClearableField.DUE, date))} />
      )
    case Section.ESTIMATE:
      return (
        <EstimateEditor
          minutes={task.estimateMinutes}
          label={`Estimate for ${task.title}`}
          clearable
          onChoose={(minutes) => apply(setOrClear(ClearableField.ESTIMATE_MINUTES, minutes))}
        />
      )
    case Section.MOVE:
      return (
        <OptionList
          options={[
            ...domains.map(({ name, prefix }) => ({
              value: prefix,
              label: name,
              icon: <DomainBadge prefix={prefix} />
            })),
            { value: INBOX_CHOICE, label: "Inbox", icon: <Inbox size={15} aria-hidden /> }
          ]}
          selected={filingChoice(task, domains)}
          onChoose={(choice) => apply({ type: TaskChangeType.UPDATE, request: filingRequest(choice) })}
        />
      )
    case Section.MAIN:
      return undefined
  }
}

const MenuPanel = (props: PanelProps) => {
  const [section, setSection] = useState(Section.MAIN)
  /** The section last gone into, to come back out onto. */
  const [cameFrom, setCameFrom] = useState<Section | undefined>(undefined)
  const panel = useRef<HTMLDivElement>(null)
  const openSection = (into: Section): void => {
    // A section within a section comes back out onto the one it's in.
    if (section === Section.MAIN) setCameFrom(into)
    setSection(into)
  }
  // Into a section, the keyboard goes to its first choice; back out, to the section it came from.
  useEffect(() => {
    const focusable = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    const back = focusable.find((element) => element.dataset["value"] === cameFrom)
    ;(section === Section.MAIN ? (back ?? focusable[0]) : focusable[1])?.focus()
  }, [section, cameFrom])
  return (
    <div ref={panel} className={styles.menu}>
      {section === Section.MAIN ? (
        <MainOptions {...props} open={openSection} />
      ) : (
        <>
          <button
            type="button"
            className={styles.back}
            onClick={() => setSection(Section.MAIN)}
            data-testid={taskRowTestIds.menuBack}
          >
            <ChevronLeft size={15} aria-hidden />
            {SECTION_TEXT[section]}
          </button>
          <SectionChoices {...props} section={section} open={openSection} />
        </>
      )}
    </div>
  )
}

/** ⋯ on a task's row: change it without opening it. */
export const TaskRowMenu = ({
  task,
  today,
  domains,
  onDelete
}: {
  task: Task
  today: IsoDate
  domains: readonly Domain[]
  onDelete: () => void
}) => {
  const { change } = useTaskChanges()
  return (
    <Popover
      label={`Change ${task.title}`}
      look={PopoverLook.ICON}
      testId={taskRowTestIds.menu}
      trigger={<Ellipsis size={16} aria-hidden />}
      alignEnd
    >
      {(close) => (
        <MenuPanel
          task={task}
          today={today}
          domains={domains}
          close={close}
          remove={() => {
            close()
            onDelete()
          }}
          apply={(taskChange) => {
            close()
            void change(task, taskChange)
          }}
        />
      )}
    </Popover>
  )
}
