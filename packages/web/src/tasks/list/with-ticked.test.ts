import { describe, expect, it } from "vite-plus/test"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { withTicked } from "./with-ticked.ts"

const [one, two, three, four] = [1, 2, 3, 4].map((number) => makeTask({ number }))

describe("withTicked", () => {
  it("keeps a ticked task where it was", () => {
    const ticked = { ...two!, status: TaskStatus.DONE }
    expect(
      withTicked([one!, three!], { [ticked.id]: ticked }, [one!.id, two!.id, three!.id]).map(({ ref }) => ref)
    ).toEqual(["H-1", "H-2", "H-3"])
  })

  it("keeps the order the tasks come in, not one of its own", () => {
    const ticked = { ...one!, status: TaskStatus.DONE }
    expect(
      withTicked([four!, three!], { [ticked.id]: ticked }, [four!.id, one!.id, three!.id]).map(({ ref }) => ref)
    ).toEqual(["H-4", "H-1", "H-3"])
    expect(withTicked([four!, two!], {}, []).map(({ ref }) => ref)).toEqual(["H-4", "H-2"])
  })

  it("puts back tasks ticked one after another, and those ticked first, first", () => {
    const ticked = { [one!.id]: one!, [two!.id]: two! }
    expect(withTicked([three!], ticked, [one!.id, two!.id, three!.id]).map(({ ref }) => ref)).toEqual([
      "H-1",
      "H-2",
      "H-3"
    ])
  })

  it("shows a task once, as the list has it, when it's back in the list", () => {
    const ticked = { ...two!, status: TaskStatus.DONE }
    expect(withTicked([two!], { [ticked.id]: ticked }, [two!.id])).toEqual([two])
  })
})
