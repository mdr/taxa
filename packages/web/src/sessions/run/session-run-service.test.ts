import { SessionOutcome, type Session } from "@taxa/shared/sessions/session"
import { makeSession, planned } from "@taxa/shared/test-support/make-session"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { testTelemetry, type TestTelemetry } from "../../test-support/test-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { FakeSessionApi } from "../../test-support/fake-session-api.ts"
import { SessionRunService } from "./session-run-service.ts"

const radiators = makeTask({ number: 2, title: "Bleed the radiators" })
const boilers = makeTask({ number: 3, title: "Research boilers" })
const passport = makeTask({ number: 4, title: "Renew passport" })

const session = makeSession({
  version: 4,
  items: [
    planned(radiators, 30, { outcome: SessionOutcome.DONE, spentMs: 27 * 60_000 }),
    planned(boilers, 45),
    planned(passport, 20)
  ],
  current: { taskId: boilers.id, since: "2026-01-05T14:27:00.000Z" }
})

const setUp = (): {
  api: FakeSessionApi
  run: SessionRunService
  changed: Session[]
  stale: number[]
  telemetry: TestTelemetry
} => {
  const api = new FakeSessionApi()
  const changed: Session[] = []
  const stale: number[] = []
  const telemetry = testTelemetry()
  const run = new SessionRunService(api, telemetry.analytics, {
    changed: (now) => changed.push(now),
    stale: () => stale.push(1)
  })
  return { api, run, changed, stale, telemetry }
}

describe("SessionRunService", () => {
  it("moves on from the task under way to the next still to do, against the version shown", async () => {
    const { api, run, changed, telemetry } = setUp()
    await run.finish(session, SessionOutcome.DONE)
    await run.finish({ ...session, current: { taskId: passport.id, since: session.startedAt } }, SessionOutcome.STOPPED)
    expect(api.updated).toEqual([
      { id: session.id, request: { finish: SessionOutcome.DONE, start: passport.id }, ifMatch: 4 },
      { id: session.id, request: { finish: SessionOutcome.STOPPED, start: boilers.id }, ifMatch: 4 }
    ])
    expect(changed).toHaveLength(2)
    expect(telemetry.tracked()).toEqual([
      [ANALYTICS_CODES.session.taskFinished, { sessionId: session.id, outcome: SessionOutcome.DONE }],
      [ANALYTICS_CODES.session.taskFinished, { sessionId: session.id, outcome: SessionOutcome.STOPPED }]
    ])
  })

  it("gives the task under way more time, and replans", async () => {
    const { api, run } = setUp()
    await run.addTime(session)
    await run.replan(session, [{ taskId: passport.id, minutes: 10 }])
    expect(api.updated.map(({ request }) => request)).toEqual([
      {
        set: {
          items: [
            { taskId: radiators.id, minutes: 30 },
            { taskId: boilers.id, minutes: 60 },
            { taskId: passport.id, minutes: 20 }
          ]
        }
      },
      { set: { items: [{ taskId: passport.id, minutes: 10 }] } }
    ])
  })

  it("ends the session, and keeps a note only if it's changed", async () => {
    const { api, run, telemetry } = setUp()
    await run.end(session)
    await run.saveNote(session, "")
    await run.saveNote(session, "Quotes next")
    expect(api.updated.map(({ request }) => request)).toEqual([{ end: true }, { set: { note: "Quotes next" } }])
    expect(telemetry.tracked().map(([code]) => code)).toEqual([
      ANALYTICS_CODES.session.ended,
      ANALYTICS_CODES.session.noteSaved
    ])
  })

  it("says why a change was refused, and asks for the session afresh", async () => {
    const { api, run, changed, stale } = setUp()
    api.refuse = true
    await run.startTask(session, passport.id)
    expect(run.state.problem).toBe("It changed.")
    expect(changed).toEqual([])
    expect(stale).toEqual([1])
  })
})
