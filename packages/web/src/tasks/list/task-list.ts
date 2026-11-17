import { TaskStatus } from "@taxa/shared/tasks/task"
import type { ListTasksQuery } from "@taxa/shared/tasks/task-requests"

export enum ListType {
  INBOX = "INBOX",
  DOMAIN = "DOMAIN",
  IN_PROGRESS = "IN_PROGRESS"
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

export type TaskList = InboxList | DomainList | InProgressList

export const listQuery = (list: TaskList): ListTasksQuery => {
  switch (list.type) {
    case ListType.INBOX:
      return { inbox: "true" }
    case ListType.DOMAIN:
      return { domain: list.prefix }
    case ListType.IN_PROGRESS:
      return { status: TaskStatus.IN_PROGRESS }
  }
}

/** Whether tasks live in the list, so it can take new ones and show those finished: not so for a view across lists. */
export const isHome = (list: TaskList): boolean => list.type !== ListType.IN_PROGRESS
