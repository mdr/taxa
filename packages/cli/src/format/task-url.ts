import type { TaskRef } from "@taxa/shared/tasks/task-ref"

/** Where a task is in the web app at `web`. */
export const taskUrl = (web: string, ref: TaskRef): string => `${web.replace(/\/+$/, "")}/tasks/${ref}`
