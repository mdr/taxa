import type { Session } from "@taxa/shared/sessions/session"
import { FakeClock } from "@taxa/shared/test-support/fake-clock"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { testTelemetry, type TestTelemetry } from "../../test-support/test-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { FakeSessionApi } from "../../test-support/fake-session-api.ts"
import { PlanStep, SessionPlanService } from "./session-plan-service.ts"
import { WindowType } from "./session-window.ts"

const NOW = new Date(2026, 0, 5, 14, 0).getTime()
const tap = makeTask({ number: 1, title: "Fix the tap", estimateMinutes: 15 })
const radiators = makeTask({ number: 2, title: "Bleed the radiators" })

const setUp = (): { api: FakeSessionApi; plan: SessionPlanService; started: Session[]; telemetry: TestTelemetry } => {
  const api = new FakeSessionApi()
  const started: Session[] = []
  const telemetry = testTelemetry()
  const plan = new SessionPlanService(api, new FakeClock(NOW), telemetry.analytics, (session) => started.push(session))
  return { api, plan, started, telemetry }
}

describe("SessionPlanService", () => {
  it("goes on to tasks only for a time still to come", () => {
    const { plan } = setUp()
    plan.chooseWindow({ type: WindowType.UNTIL, time: "13:00" })
    plan.toTasks()
    expect(plan.state.step).toBe(PlanStep.WINDOW)
    expect(plan.state.problem).toBe("That time's passed today: choose a later one.")
    plan.chooseWindow({ type: WindowType.UNTIL, time: "16:00" })
    plan.toTasks()
    expect(plan.state.step).toBe(PlanStep.TASKS)
    expect(plan.state.problem).toBeUndefined()
  })

  it("narrows the suggestions to a tag, and lets them all back", () => {
    const { plan } = setUp()
    plan.filterByTag("errand")
    expect(plan.state.tag).toBe("errand")
    plan.filterByTag(undefined)
    expect(plan.state.tag).toBeUndefined()
  })

  it("plans tasks for their estimates, or half an hour, in the order wanted", () => {
    const { plan } = setUp()
    plan.add(tap)
    plan.add(radiators)
    plan.add(tap)
    plan.move(radiators.id, 0)
    plan.estimated({ ...radiators, estimateMinutes: 45 })
    expect(plan.state.entries.map(({ task, minutes }) => [task.title, minutes])).toEqual([
      ["Bleed the radiators", 45],
      ["Fix the tap", 15]
    ])
    plan.remove(tap.id)
    expect(plan.state.entries.map(({ task }) => task.title)).toEqual(["Bleed the radiators"])
    plan.add(tap, 0)
    expect(plan.state.entries.map(({ task }) => task.title)).toEqual(["Fix the tap", "Bleed the radiators"])
  })

  it("starts the session now, on the first task, and tracks it", async () => {
    const { api, plan, started, telemetry } = setUp()
    plan.chooseWindow({ type: WindowType.LENGTH, minutes: 120 })
    plan.add(radiators)
    plan.add(tap)
    await plan.start()
    expect(api.created).toEqual([
      {
        endsAt: new Date(NOW + 120 * 60_000).toISOString(),
        items: [
          { taskId: radiators.id, minutes: 30 },
          { taskId: tap.id, minutes: 15 }
        ],
        start: radiators.id
      }
    ])
    expect(started).toHaveLength(1)
    expect(telemetry.tracked()).toEqual([
      [ANALYTICS_CODES.session.started, { sessionId: started[0]!.id, tasks: 2, plannedMinutes: 45, windowMinutes: 120 }]
    ])
  })

  it("says why a session couldn't start", async () => {
    const { api, plan, started } = setUp()
    api.refuse = true
    await plan.start()
    expect(started).toEqual([])
    expect(plan.state.problem).toBe("You're already in a session.")
    expect(plan.state.starting).toBe(false)
  })
})
