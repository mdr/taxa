import { describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

describe("day plans", () => {
  const it = useInProcessServer()

  it("put today's tasks in your order, those not placed coming after", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap", { scheduled: "2026-01-05" })
    const quote = await matt.addTask("Send the quote", { scheduled: "2026-01-04" })
    await matt.addTask("Book the MOT", { scheduled: "2026-01-05" })
    expect(await matt.client.dayPlan("2026-01-05")).toEqual({ date: "2026-01-05", taskIds: [] })

    const plan = await matt.client.setDayPlan("2026-01-05", { taskIds: [quote.id, tap.id, quote.id] })
    expect(plan).toEqual({ date: "2026-01-05", taskIds: [quote.id, tap.id] })
    expect(await matt.client.dayPlan("2026-01-05")).toEqual(plan)
    const today = await matt.client.tasks({ when: "TODAY" })
    expect(today.map(({ title }) => title)).toEqual(["Send the quote", "Fix the tap", "Book the MOT"])

    await matt.client.setDayPlan("2026-01-05", { taskIds: [tap.id] })
    expect((await matt.client.dayPlan("2026-01-05")).taskIds).toEqual([tap.id])
  })

  it("keep only your own tasks, and each person's plan to themselves", async ({ server }) => {
    const matt = await server.user("Matt")
    const jo = await server.user("Jo")
    const tap = await matt.addTask("Fix the tap", { scheduled: "2026-01-05" })
    const hers = await jo.addTask("Jo's own", { scheduled: "2026-01-05" })
    expect((await matt.client.setDayPlan("2026-01-05", { taskIds: [hers.id, tap.id] })).taskIds).toEqual([tap.id])
    expect((await jo.client.dayPlan("2026-01-05")).taskIds).toEqual([])
    await expectProblem(matt.client.dayPlan("tomorrow"), ProblemType.INVALID_REQUEST)
  })
})
