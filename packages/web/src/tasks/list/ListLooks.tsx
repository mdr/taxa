import type { Domain } from "@taxa/shared/domains/domain"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { When } from "@taxa/shared/tasks/when"
import { CalendarClock, Inbox, Tag } from "lucide-react"
import { Link } from "wouter"
import { taskListPageTestIds } from "./TaskListPageTestIds.ts"
import { PLAN_TODAY_PATH } from "../when/when-paths.ts"
import styles from "./TaskListPage.module.css"
import { ListType, type TaskList } from "./task-list.ts"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import { StatusIcon } from "../StatusIcon.tsx"
import { WHEN_ICONS } from "../when/when-choices.tsx"

const HEADINGS: Record<ListType, string | undefined> = {
  [ListType.INBOX]: "Inbox",
  [ListType.DOMAIN]: undefined,
  [ListType.IN_PROGRESS]: "In progress",
  [ListType.TODAY]: "Today",
  [ListType.SOON]: "Soon",
  [ListType.SOMEDAY]: "Someday",
  [ListType.TAG]: undefined,
  [ListType.DEADLINES]: "Deadlines"
}

/** What a list is called: a domain by its name, once known. */
export const listHeading = (list: TaskList, domain: Domain | undefined): string | undefined =>
  HEADINGS[list.type] ??
  domain?.name ??
  (list.type === ListType.DOMAIN ? list.prefix : list.type === ListType.TAG ? list.name : undefined)

const LIST_WHENS: Partial<Record<ListType, When>> = {
  [ListType.TODAY]: When.TODAY,
  [ListType.SOON]: When.SOON,
  [ListType.SOMEDAY]: When.SOMEDAY
}

/** The When a list is made of, which goes without saying on its rows. */
export const listWhen = (list: TaskList): When | undefined => LIST_WHENS[list.type]

export const ListIcon = ({ list, domain }: { list: TaskList; domain: Domain | undefined }) => {
  switch (list.type) {
    case ListType.DOMAIN:
      return domain && <DomainBadge prefix={domain.prefix} />
    case ListType.INBOX:
      return <Inbox size={22} className={styles.icon} aria-hidden />
    case ListType.TAG:
      return <Tag size={22} className={styles.icon} aria-hidden />
    case ListType.DEADLINES:
      return <CalendarClock size={22} className={styles.icon} aria-hidden />
    case ListType.IN_PROGRESS:
      return <StatusIcon status={TaskStatus.IN_PROGRESS} size={22} />
    case ListType.TODAY:
    case ListType.SOON:
    case ListType.SOMEDAY: {
      const Icon = WHEN_ICONS[LIST_WHENS[list.type] ?? When.ANY_TIME]
      return <Icon size={22} className={styles.icon} aria-hidden />
    }
  }
}

const EMPTY: Record<ListType, { title?: string; text: string }> = {
  [ListType.DOMAIN]: { text: "Nothing to do here. Enjoy it." },
  [ListType.INBOX]: {
    title: "Your Inbox is clear",
    text: "Jot anything down above as it occurs to you. Sort it out later: fill it in, decide when, then file it."
  },
  [ListType.IN_PROGRESS]: {
    title: "Nothing in progress",
    text: "Press I on a task to start working on it, and it shows here until you stop."
  },
  [ListType.TODAY]: {
    title: "Nothing planned for today",
    text: "Choose what you mean to do today from what's due, lined up for soon, or anything else."
  },
  [ListType.SOON]: {
    title: "Nothing lined up",
    text: "Put what you mean to get to next in Soon, from a task's ⋯ menu."
  },
  [ListType.TAG]: {
    title: "Nothing to do with this tag",
    text: "Add it to a task from the task's page, or with # as you capture one."
  },
  [ListType.SOMEDAY]: {
    title: "No somedays",
    text: "Things you might do one day go here, out of sight until you look."
  },
  [ListType.DEADLINES]: {
    title: "No deadlines",
    text: "Give a task a due date and it shows here, soonest first, until it's done."
  }
}

export const EmptyList = ({ list }: { list: TaskList }) => {
  const { title, text } = EMPTY[list.type]
  return (
    <>
      {title && <p className={styles.emptyTitle}>{title}</p>}
      <p>{text}</p>
      {list.type === ListType.TODAY && (
        <Link href={PLAN_TODAY_PATH} className={styles.emptyAction} data-testid={taskListPageTestIds.planToday}>
          Plan today
        </Link>
      )}
    </>
  )
}
