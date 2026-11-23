import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { DayPlanSchema, type DayPlan, type SetDayPlanRequest } from "@taxa/shared/days/day-plan"
import { Horizon, type Task } from "@taxa/shared/tasks/task"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { testTelemetry, type TestTelemetry } from "../test-support/test-telemetry.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"
import type { TaskChange } from "../tasks/changes/task-changes-service.ts"
import { DayPlanService, type DayPlanApi } from "./day-plan-service.ts"

const today = "2026-01-05"
const tap = makeTask({ number: 1, title: "Fix the tap", scheduled: today, estimateMinutes: 15 })
const quote = makeTask({ number: 2, title: "Send the quote", scheduled: "2026-01-02" })
const boilers = makeTask({ number: 3, title: "Research boilers", horizon: Horizon.SOON })

class FakeDayPlanApi implements DayPlanApi {
  readonly saved: SetDayPlanRequest[] = []
  failing = false

  setDayPlan(date: IsoDate, request: SetDayPlanRequest): Promise<DayPlan> {
    if (this.failing) return Promise.reject(new Error("offline"))
    this.saved.push(request)
    return Promise.resolve(DayPlanSchema.parse({ date, taskIds: request.taskIds }))
  }
}

interface SetUp {
  api: FakeDayPlanApi
  changes: [string, TaskChange][]
  plan: DayPlanService
  telemetry: TestTelemetry
  /** How many orders had been saved each time lists were told to look again. */
  refreshed: number[]
}

const setUp = (refuse = false): SetUp => {
  const api = new FakeDayPlanApi()
  const changes: [string, TaskChange][] = []
  const telemetry = testTelemetry()
  const refreshed: number[] = []
  const plan = new DayPlanService(
    api,
    {
      change: (task: Task, change: TaskChange) => {
        changes.push([task.ref, change])
        return Promise.resolve(refuse ? undefined : task)
      }
    },
    telemetry.analytics,
    today,
    () => {
      refreshed.push(api.saved.length)
      return Promise.resolve()
    }
  )
  plan.showToday([tap, quote])
  return { api, changes, plan, telemetry, refreshed }
}

const titles = (plan: DayPlanService): string[] => (plan.state.entries ?? []).map(({ task }) => task.title)

describe("DayPlanService", () => {
  it("starts from today's tasks, in the order the server lists them, then follows them as they change", () => {
    const { plan } = setUp()
    expect(titles(plan)).toEqual(["Fix the tap", "Send the quote"])
    plan.move(quote.id, 0)
    plan.showToday([{ ...tap, title: "Fix the kitchen tap" }, quote])
    expect(titles(plan)).toEqual(["Send the quote", "Fix the kitchen tap"])
    // Changed elsewhere, or undone: one's no longer today, another is.
    plan.showToday([tap, boilers])
    expect(titles(plan)).toEqual(["Fix the tap", "Research boilers"])
    // Back again, it's back where it was.
    plan.showToday([quote, tap, boilers])
    expect(titles(plan)).toEqual(["Send the quote", "Fix the tap", "Research boilers"])
  })

  it("puts a task taken out back where it was when that's undone, and saves the order", async () => {
    const { api, plan } = setUp()
    await plan.remove(tap.id)
    plan.showToday([quote])
    plan.showToday([tap, quote])
    await plan.saved()
    expect(titles(plan)).toEqual(["Fix the tap", "Send the quote"])
    expect(api.saved.at(-1)).toEqual({ taskIds: [tap.id, quote.id] })
  })

  it("keeps a task being put in or taken out as it is here, whatever a list from before that says", async () => {
    let finish: (task: Task | undefined) => void = () => undefined
    const plan = new DayPlanService(
      new FakeDayPlanApi(),
      { change: () => new Promise<Task | undefined>((resolve) => (finish = resolve)) },
      testTelemetry().analytics,
      today,
      () => Promise.resolve()
    )
    plan.showToday([tap, quote])
    const adding = plan.add(boilers)
    plan.showToday([tap, quote])
    expect(titles(plan)).toEqual(["Fix the tap", "Send the quote", "Research boilers"])
    finish(boilers)
    await adding
    const removing = plan.remove(tap.id)
    plan.showToday([tap, quote, boilers])
    expect(titles(plan)).toEqual(["Send the quote", "Research boilers"])
    finish(tap)
    await removing
  })

  it("plans a task put in for today, at its place, and saves the order", async () => {
    const { api, changes, plan, telemetry } = setUp()
    await plan.add(boilers, 1)
    await plan.saved()
    expect(titles(plan)).toEqual(["Fix the tap", "Research boilers", "Send the quote"])
    expect(changes).toEqual([
      ["H-3", { type: "UPDATE", request: { set: { scheduled: today }, clear: [ClearableField.HORIZON] } }]
    ])
    expect(api.saved.at(-1)).toEqual({ taskIds: [tap.id, boilers.id, quote.id] })
    expect(telemetry.tracked()).toEqual([[ANALYTICS_CODES.today.taskPlanned, { taskId: boilers.id, taskRef: "H-3" }]])
  })

  it("leaves a task taken out for soon, and saves the order moved", async () => {
    const { api, changes, plan, refreshed, telemetry } = setUp()
    plan.move(quote.id, 0)
    await plan.remove(tap.id)
    expect(telemetry.tracked()).toEqual([
      [ANALYTICS_CODES.today.reordered, { taskId: quote.id, to: 0 }],
      [ANALYTICS_CODES.today.taskUnplanned, { taskId: tap.id, taskRef: "H-1" }]
    ])
    await plan.saved()
    expect(titles(plan)).toEqual(["Send the quote"])
    expect(changes).toEqual([
      [
        "H-1",
        {
          type: "UPDATE",
          request: { set: { horizon: Horizon.SOON }, clear: [ClearableField.SCHEDULED, ClearableField.SCHEDULED_TIME] }
        }
      ]
    ])
    expect(api.saved).toEqual([{ taskIds: [quote.id, tap.id] }, { taskIds: [quote.id] }])
    expect(refreshed).toEqual([1, 2])
  })

  it("takes a task back out if planning it is refused, and says so", async () => {
    const { plan } = setUp(true)
    await plan.add(boilers)
    expect(titles(plan)).toEqual(["Fix the tap", "Send the quote"])
    expect(plan.state.problem).toBe("Research boilers couldn't be planned for today.")
  })

  it("says when the order can't be saved", async () => {
    const { api, plan } = setUp()
    api.failing = true
    plan.move(quote.id, 0)
    await plan.saved()
    expect(plan.state.problem).toBe(
      "Today's order couldn't be saved: Can't reach the server. Check your connection and try again."
    )
  })
})
