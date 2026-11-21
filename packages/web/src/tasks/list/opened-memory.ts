import type { TaskId } from "@taxa/shared/ids"
import type { TaskList } from "./task-list.ts"

/** The task last opened from a list, to highlight again on coming back to it. */
export interface OpenedMemory {
  recall: () => TaskId | undefined
  remember: (id: TaskId) => void
}

/** Each list's, for as long as the page is open: going back to a list finds the task you left it for. */
const lastOpened = new Map<string, TaskId>()

export const openedMemoryFor = (list: TaskList): OpenedMemory => {
  const key = JSON.stringify(list)
  return { recall: () => lastOpened.get(key), remember: (id) => lastOpened.set(key, id) }
}
