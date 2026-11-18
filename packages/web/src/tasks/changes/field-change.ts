import type { ClearableField } from "@taxa/shared/tasks/task-requests"
import { TaskChangeType, type TaskChange } from "./task-changes-service.ts"

/** The change that sets a field that can be empty, or empties it. */
export const setOrClear = (field: ClearableField, value: string | number | undefined): TaskChange => ({
  type: TaskChangeType.UPDATE,
  request: value === undefined ? { clear: [field] } : { set: { [field]: value } }
})
