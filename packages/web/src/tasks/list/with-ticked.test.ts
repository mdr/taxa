import { describe, expect, it } from "vite-plus/test"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { withTicked } from "./with-ticked.ts"

describe("withTicked", () => {
  it("keeps a ticked task where it was", () => {
    const ticked = makeTask({ number: 2, status: TaskStatus.DONE })
    expect(
      withTicked([makeTask({ number: 1 }), makeTask({ number: 3 })], { [ticked.id]: ticked }).map(({ ref }) => ref)
    ).toEqual(["H-1", "H-2", "H-3"])
  })

  it("shows a task once, as the list has it, when it's back in the list", () => {
    const reopened = makeTask({ number: 2 })
    const ticked = makeTask({ number: 2, status: TaskStatus.DONE })
    expect(withTicked([reopened], { [ticked.id]: ticked })).toEqual([reopened])
  })
})
