import { taskId } from "@taxa/shared/ids"
import { describe, expect, it } from "vite-plus/test"
import { ChangeOrder } from "./change-order.ts"

const tap = taskId("0190a1b2-0000-7000-8000-000000000001")
const bins = taskId("0190a1b2-0000-7000-8000-000000000002")

/** A request the server hasn't answered yet: `answer` answers it. */
const unanswered = (): { promise: Promise<void>; answer: () => void } => {
  let answer = (): void => undefined
  const promise = new Promise<void>((resolve) => (answer = resolve))
  return { promise, answer }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** A change that notes it's been made, then waits for its answer. */
const noting =
  (made: string[], name: string, answered: Promise<void> = Promise.resolve()) =>
  (): Promise<void> => {
    made.push(name)
    return answered
  }

describe("ChangeOrder", () => {
  it("makes one task's changes one at a time, and other tasks' alongside", async () => {
    const order = new ChangeOrder()
    const made: string[] = []
    const first = unanswered()
    void order.change(tap, noting(made, "tap 1", first.promise))
    void order.change(tap, noting(made, "tap 2"))
    void order.change(bins, noting(made, "bins"))
    await settle()
    expect(made).toEqual(["tap 1", "bins"])
    first.answer()
    await settle()
    expect(made).toEqual(["tap 1", "bins", "tap 2"])
  })

  it("undoes after every change asked for before, answered or not, and before every change after", async () => {
    const order = new ChangeOrder()
    const made: string[] = []
    const change = unanswered()
    const adding = unanswered()
    void order.change(tap, noting(made, "tap", change.promise))
    void order.add(noting(made, "add", adding.promise))
    const undoing = unanswered()
    void order.undo(noting(made, "undo", undoing.promise))
    void order.change(bins, noting(made, "bins"))
    void order.add(noting(made, "add again"))
    await settle()
    expect(made).toEqual(["tap", "add"])
    change.answer()
    adding.answer()
    await settle()
    expect(made).toEqual(["tap", "add", "undo"])
    undoing.answer()
    await settle()
    expect(made).toEqual(["tap", "add", "undo", "bins", "add again"])
  })

  it("goes on after a change that fails", async () => {
    const order = new ChangeOrder()
    await expect(order.change(tap, () => Promise.reject(new Error("offline")))).rejects.toThrow("offline")
    expect(await order.undo(() => Promise.resolve("undone"))).toBe("undone")
    expect(await order.change(tap, () => Promise.resolve("changed"))).toBe("changed")
  })
})
