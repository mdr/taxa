import { TaskStatus } from "@taxa/shared/tasks/task"
import type { ListTasksQuery } from "@taxa/shared/tasks/task-requests"
import { When } from "@taxa/shared/tasks/when"

export enum ListType {
  INBOX = "INBOX",
  DOMAIN = "DOMAIN",
  IN_PROGRESS = "IN_PROGRESS",
  TODAY = "TODAY",
  SOON = "SOON",
  SOMEDAY = "SOMEDAY"
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

export type TaskList = InboxList | DomainList | InProgressList | WhenList

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
  }
}

/** Whether tasks live in the list, so it can take new ones and show those finished: not so for a view across lists. */
export const isHome = (list: TaskList): boolean => list.type === ListType.INBOX || list.type === ListType.DOMAIN
