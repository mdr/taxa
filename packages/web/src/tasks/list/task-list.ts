import { TaskStatus } from "@taxa/shared/tasks/task"
import type { ListTasksQuery } from "@taxa/shared/tasks/task-requests"
import { When } from "@taxa/shared/tasks/when"

export enum ListType {
  INBOX = "INBOX",
  DOMAIN = "DOMAIN",
  IN_PROGRESS = "IN_PROGRESS",
  TODAY = "TODAY",
  SOON = "SOON",
  SOMEDAY = "SOMEDAY",
  TAG = "TAG",
  DEADLINES = "DEADLINES"
}

interface InboxList {
  type: ListType.INBOX
}

interface DomainList {
  type: ListType.DOMAIN
  /** As named in the address, in any case. */
  prefix: string
}

/** Everything you can see that's being worked on, across the Inbox and every domain. */
interface InProgressList {
  type: ListType.IN_PROGRESS
}

/** Everything you can see meant for one When, across the Inbox and every domain. */
interface WhenList {
  type: ListType.TODAY | ListType.SOON | ListType.SOMEDAY
}

/** Everything you can see with a tag, across the Inbox and every domain. */
interface TagList {
  type: ListType.TAG
  /** As named in the address, in any case. */
  name: string
}

/** Everything you can see with a due date, soonest first, across the Inbox and every domain. */
interface DeadlinesList {
  type: ListType.DEADLINES
}

export type TaskList = InboxList | DomainList | InProgressList | WhenList | TagList | DeadlinesList

export const listQuery = (list: TaskList): ListTasksQuery => {
  switch (list.type) {
    case ListType.INBOX:
      return { inbox: "true" }
    case ListType.DOMAIN:
      return { domain: list.prefix }
    case ListType.IN_PROGRESS:
      return { status: TaskStatus.IN_PROGRESS }
    case ListType.TODAY:
      return { when: When.TODAY }
    case ListType.SOON:
      return { when: When.SOON }
    case ListType.SOMEDAY:
      return { when: When.SOMEDAY }
    case ListType.TAG:
      return { tag: list.name }
    case ListType.DEADLINES:
      return { due: "true" }
  }
}

/** The views of what's for a time, each taking new tasks for then. */
export type CaptureWhen = When.TODAY | When.SOON | When.SOMEDAY

/** For a view of what's for today, soon or someday, what a task added there is for, so it's listed there. */
export const capturesWhen = (list: TaskList): CaptureWhen | undefined => {
  if (list.type === ListType.TODAY) return When.TODAY
  if (list.type === ListType.SOON) return When.SOON
  if (list.type === ListType.SOMEDAY) return When.SOMEDAY
  return undefined
}

/** Whether tasks live in the list, so it can take new ones and show those finished: not so for a view across lists. */
export const isHome = (list: TaskList): boolean => list.type === ListType.INBOX || list.type === ListType.DOMAIN
