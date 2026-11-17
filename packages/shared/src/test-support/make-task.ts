import { domainPrefix } from "../domains/domain.ts"
import { domainId, taskId } from "../ids.ts"
import { formatTaskRef } from "../tasks/task-ref.ts"
import { Priority, TaskStatus, type Task } from "../tasks/task.ts"

/** The domain tasks are in unless a test says otherwise. */
const TEST_DOMAIN_ID = domainId("0190a1b2-0000-7000-8000-000000000000")

/** An open task in H, numbered 1 unless given a number, with its id and ref to match. */
export const makeTask = (fields: Partial<Task> = {}): Task => {
  const number = fields.number ?? 1
  return {
    id: taskId(`0190a1b2-0000-7000-8000-${String(number).padStart(12, "0")}`),
    ref: formatTaskRef(domainPrefix("H"), number),
    number,
    domainId: TEST_DOMAIN_ID,
    title: `Task ${number}`,
    notes: "",
    status: TaskStatus.OPEN,
    priority: Priority.NORMAL,
    inbox: false,
    createdAt: "2026-01-05T09:00:00.000Z",
    updatedAt: "2026-01-05T09:00:00.000Z",
    version: 1,
    ...fields
  }
}
