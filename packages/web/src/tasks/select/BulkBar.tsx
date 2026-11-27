import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Domain } from "@taxa/shared/domains/domain"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { PRIORITY_TEXT, STATUS_TEXT } from "@taxa/shared/tasks/task-text"
import { When } from "@taxa/shared/tasks/when"
import { CalendarClock, Check, FolderCheck, FolderInput, Tag, Trash2, X } from "lucide-react"
import { useState, type ReactNode } from "react"
import styles from "./BulkBar.module.css"
import { bulkBarTestIds } from "./BulkBarTestIds.ts"
import { BulkActionType, type BulkAction } from "./bulk-actions.ts"
import { useSelectedCount, useSelection } from "./selection-service.ts"
import { DatePicker } from "../../dates/DatePicker.tsx"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import { TagPicker } from "../../tags/TagPicker.tsx"
import { capitalised } from "../../ui/capitalised.ts"
import { OptionList } from "../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../ui/Popover.tsx"
import { PriorityIcon } from "../PriorityIcon.tsx"
import { StatusIcon } from "../StatusIcon.tsx"
import { WHEN_ICONS, whenOptions } from "../when/when-choices.tsx"

interface BulkBarProps {
  /** The tasks selected, as listed. */
  selected: readonly Task[]
  today: IsoDate
  domains: readonly Domain[]
  act: (action: BulkAction) => void
}

/** A choice from a menu on the bar, opening upwards, as the bar's at the foot of the screen. */
const BarMenu = ({
  type,
  label,
  icon,
  children
}: {
  type: BulkActionType
  label: string
  icon: ReactNode
  children: (close: () => void) => ReactNode
}) => (
  <Popover
    label={label}
    look={PopoverLook.CHIP}
    triggerClassName={styles.action}
    testId={bulkBarTestIds.action}
    value={type}
    track={`BulkBar.${type.toLowerCase()}`}
    trigger={
      <>
        {icon}
        {label}
      </>
    }
    above
  >
    {children}
  </Popover>
)

const BarButton = ({
  type,
  label,
  icon,
  danger = false,
  onClick
}: {
  type: BulkActionType
  label: string
  icon: ReactNode
  danger?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    className={danger ? `${styles.action} ${styles.danger}` : styles.action}
    onClick={onClick}
    data-testid={bulkBarTestIds.action}
    data-value={type}
    data-track={`BulkBar.${type.toLowerCase()}`}
  >
    {icon}
    {label}
  </button>
)

/** When, as the row menu offers it, with a day to choose for On a day. */
const WhenChoices = ({ today, act }: { today: IsoDate; act: (action: BulkAction) => void }) => {
  const [choosingDay, setChoosingDay] = useState(false)
  return choosingDay ? (
    <DatePicker
      track="BulkBar.onADay"
      value={undefined}
      today={today}
      onChoose={(day) => act({ type: BulkActionType.WHEN, when: When.ON_A_DAY, day })}
    />
  ) : (
    <OptionList
      track="BulkBar.whenChoices"
      options={whenOptions({ scheduled: undefined, horizon: undefined }, today)}
      onChoose={(choice) => {
        const when = choice as When
        if (when === When.ON_A_DAY) setChoosingDay(true)
        else act({ type: BulkActionType.WHEN, when })
      }}
    />
  )
}

/**
 * At the foot of a list while tasks are selected: what can be done to them
 * all at once, as the row menu does to one. Each closes the selection.
 */
export const BulkBar = ({ selected, today, domains, act }: BulkBarProps) => {
  const selection = useSelection()
  const count = useSelectedCount()
  const WhenIcon = WHEN_ICONS[When.TODAY]
  const choose =
    (close: () => void) =>
    (action: BulkAction): void => {
      close()
      act(action)
    }
  const none = count === 0
  return (
    <div className={styles.bar} role="toolbar" aria-label="Change the selected tasks" data-testid={bulkBarTestIds.bar}>
      <span className={styles.count} data-testid={bulkBarTestIds.count} aria-live="polite">
        {none ? "Select tasks" : `${count} selected`}
      </span>
      {!none && (
        <>
          <BarButton
            type={BulkActionType.DONE}
            label="Done"
            icon={<Check size={15} aria-hidden />}
            onClick={() => act({ type: BulkActionType.DONE })}
          />
          <BarMenu type={BulkActionType.STATUS} label="Status" icon={<StatusIcon status={TaskStatus.IN_PROGRESS} />}>
            {(close) => (
              <OptionList
                track="BulkBar.statusChoices"
                options={Object.values(TaskStatus).map((status) => ({
                  value: status,
                  label: capitalised(STATUS_TEXT[status]),
                  icon: <StatusIcon status={status} />
                }))}
                onChoose={(status) => choose(close)({ type: BulkActionType.STATUS, status: status as TaskStatus })}
              />
            )}
          </BarMenu>
          <BarMenu type={BulkActionType.WHEN} label="When" icon={<WhenIcon size={15} aria-hidden />}>
            {(close) => <WhenChoices today={today} act={choose(close)} />}
          </BarMenu>
          <BarMenu type={BulkActionType.DUE} label="Due" icon={<CalendarClock size={15} aria-hidden />}>
            {(close) => (
              <DatePicker
                track="BulkBar.dueChoices"
                value={undefined}
                today={today}
                onChoose={(day) => choose(close)({ type: BulkActionType.DUE, day })}
              />
            )}
          </BarMenu>
          <BarMenu type={BulkActionType.PRIORITY} label="Priority" icon={<PriorityIcon priority={Priority.HIGH} />}>
            {(close) => (
              <OptionList
                track="BulkBar.priorityChoices"
                options={Object.values(Priority).map((priority) => ({
                  value: priority,
                  label: capitalised(PRIORITY_TEXT[priority]),
                  icon: <PriorityIcon priority={priority} />
                }))}
                onChoose={(priority) =>
                  choose(close)({ type: BulkActionType.PRIORITY, priority: priority as Priority })
                }
              />
            )}
          </BarMenu>
          {domains.length > 1 && (
            <BarMenu type={BulkActionType.MOVE} label="Move to" icon={<FolderInput size={15} aria-hidden />}>
              {(close) => (
                <OptionList
                  track="BulkBar.moveChoices"
                  options={domains.map(({ name, prefix }) => ({
                    value: prefix,
                    label: name,
                    icon: <DomainBadge prefix={prefix} />
                  }))}
                  onChoose={(prefix) =>
                    choose(close)({
                      type: BulkActionType.MOVE,
                      prefix,
                      name: domains.find((domain) => domain.prefix === prefix)?.name ?? prefix
                    })
                  }
                />
              )}
            </BarMenu>
          )}
          <BarMenu type={BulkActionType.TAG} label="Tag" icon={<Tag size={15} aria-hidden />}>
            {(close) => <TagPicker has={[]} onPick={(name) => choose(close)({ type: BulkActionType.TAG, name })} />}
          </BarMenu>
          {selected.some(({ inbox }) => inbox) && (
            <BarButton
              type={BulkActionType.FILE}
              label="File"
              icon={<FolderCheck size={15} aria-hidden />}
              onClick={() => act({ type: BulkActionType.FILE })}
            />
          )}
          <BarButton
            type={BulkActionType.DELETE}
            label="Delete"
            icon={<Trash2 size={15} aria-hidden />}
            danger
            onClick={() => act({ type: BulkActionType.DELETE })}
          />
        </>
      )}
      <span className={styles.divider} aria-hidden />
      <button
        type="button"
        className={`${styles.action} ${styles.quiet}`}
        onClick={selection.toggleAll}
        aria-keyshortcuts="Control+A Meta+A"
        data-testid={bulkBarTestIds.all}
        data-track="BulkBar.all"
      >
        All
      </button>
      <button
        type="button"
        className={`${styles.action} ${styles.quiet}`}
        onClick={selection.stop}
        aria-label="Stop selecting"
        title="Stop selecting (Esc)"
        data-testid={bulkBarTestIds.close}
        data-track="BulkBar.close"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  )
}

/** What a change to the selection did, with the offer to take it back, for a few seconds. */
export const BulkReport = ({ text, onUndo }: { text: string; onUndo: () => void }) => (
  <div className={styles.report} role="status" data-testid={bulkBarTestIds.report}>
    <span>{text}</span>
    <button
      type="button"
      className={styles.undo}
      onClick={onUndo}
      data-testid={bulkBarTestIds.undo}
      data-track="BulkBar.undo"
    >
      Undo
    </button>
  </div>
)
