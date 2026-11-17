import { describe, expect, it } from "vite-plus/test"
import { Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { withTicked } from "./with-ticked.ts"

const makeTask = (number: number, fields: Partial<Task> = {}): Task => ({
  id: `0190a1b2-0000-7000-8000-00000000000${number}`,
  ref: `H-${number}`,
  number,
  domainId: "0190a1b2-0000-7000-8000-000000000000",
  title: `Task ${number}`,
  notes: "",
  status: TaskStatus.OPEN,
  priority: Priority.NORMAL,
  inbox: false,
  createdAt: "2026-01-05T09:00:00.000Z",
  updatedAt: "2026-01-05T09:00:00.000Z",
  version: 1,
  ...fields
})

describe("withTicked", () => {
  it("keeps a ticked task where it was", () => {
    const ticked = makeTask(2, { status: TaskStatus.DONE })
    expect(withTicked([makeTask(1), makeTask(3)], new Map([[ticked.id, ticked]])).map(({ ref }) => ref)).toEqual([
      "H-1",
      "H-2",
      "H-3"
    ])
  })

  it("shows a task once, as the list has it, when it's back in the list", () => {
    const reopened = makeTask(2)
    const ticked = makeTask(2, { status: TaskStatus.DONE })
    expect(withTicked([reopened], new Map([[ticked.id, ticked]]))).toEqual([reopened])
  })
})
