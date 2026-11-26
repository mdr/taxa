import type { TaskId } from "@taxa/shared/ids"

/** Where a key opens a row's menu: the whole of it, or straight at one thing to change. */
export enum RowMenuEntry {
  MENU = "MENU",
  STATUS = "STATUS",
  PRIORITY = "PRIORITY",
  WHEN = "WHEN",
  DUE = "DUE",
  ESTIMATE = "ESTIMATE",
  MOVE = "MOVE",
  TAGS = "TAGS"
}

/** A key's request to open a row's menu; each has a new `seq`, so the same one twice opens it twice. */
export interface RowMenuOpening {
  taskId: TaskId
  entry: RowMenuEntry
  seq: number
}
