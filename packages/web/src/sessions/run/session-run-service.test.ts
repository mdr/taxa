import { SessionOutcome, type Session } from "@taxa/shared/sessions/session"
import { makeSession, planned } from "@taxa/shared/test-support/make-session"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { testTelemetry, type TestTelemetry } from "../../test-support/test-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { FakeSessionApi } from "../../test-support/fake-session-api.ts"
import { SessionRunService, toDoOf } from "./session-run-service.ts"
import type { UndoActions } from "../../undo/undo-service.ts"

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

/** The tab's history: which it was asked to do. */
class FakeHistory implements Pick<UndoActions, "undo" | "redo"> {
  readonly asked: string[] = []

  readonly undo = (): Promise<undefined> => {
    this.asked.push("undo")
    return Promise.resolve(undefined)
  }

  readonly redo = (): Promise<undefined> => {
    this.asked.push("redo")
    return Promise.resolve(undefined)
  }
}

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

  it("undoes the last Done or Stop here, until the next change", async () => {
    const { api, run, telemetry } = setUp()
    expect(run.state.undoable).toBeUndefined()
    await run.finish(session, SessionOutcome.DONE)
    expect(run.state.undoable).toEqual({ taskId: boilers.id, title: "Research boilers", outcome: SessionOutcome.DONE })
    await run.undo(session)
    expect(run.state.undoable).toBeUndefined()
    expect(api.updated.at(-1)?.request).toEqual({ start: boilers.id })
    expect(telemetry.tracked().at(-1)).toEqual([
      ANALYTICS_CODES.session.finishUndone,
      { sessionId: session.id, outcome: SessionOutcome.DONE }
    ])

    await run.finish(session, SessionOutcome.STOPPED)
    await run.addTime(session)
    expect(run.state.undoable).toBeUndefined()
    await run.undo(session)
    expect(api.updated).toHaveLength(4)
  })

  it("⌘Z takes back moving on once that's answered, never the tab's last change, and ⇧⌘Z redoes it", async () => {
    const { api, run } = setUp()
    const history = new FakeHistory()
    let letGo = (): void => undefined
    api.held = new Promise((resolve) => (letGo = resolve))
    const finishing = run.finish(session, SessionOutcome.DONE)
    const undoing = run.undoLast(session, history)
    letGo()
    await Promise.all([finishing, undoing])
    expect(history.asked).toEqual([])
    expect(api.updated.map(({ request, ifMatch }) => [request, ifMatch])).toEqual([
      [{ finish: SessionOutcome.DONE, start: passport.id }, 4],
      [{ start: boilers.id }, 5]
    ])

    await run.redoLast({ ...session, version: 6 }, history)
    expect(api.updated.at(-1)?.request).toEqual({ finish: SessionOutcome.DONE, start: passport.id })
    expect(history.asked).toEqual([])
  })

  it("⌘Z and ⇧⌘Z go to the tab's history when there's no moving on to take back or redo", async () => {
    const { run } = setUp()
    const history = new FakeHistory()
    await run.undoLast(session, history)
    await run.redoLast(session, history)
    expect(history.asked).toEqual(["undo", "redo"])
  })

  it("keeps finished tasks ahead of what's still to do, and starts a task put above the one under way", async () => {
    const { api, run } = setUp()
    expect(toDoOf(session).map(({ taskId }) => taskId)).toEqual([boilers.id, passport.id])
    await run.replanToDo(session, [
      { taskId: boilers.id, minutes: 45 },
      { taskId: passport.id, minutes: 10 }
    ])
    await run.replanToDo(session, [
      { taskId: passport.id, minutes: 20 },
      { taskId: boilers.id, minutes: 45 }
    ])
    expect(api.updated.map(({ request }) => request)).toEqual([
      {
        set: {
          items: [
            { taskId: radiators.id, minutes: 30 },
            { taskId: boilers.id, minutes: 45 },
            { taskId: passport.id, minutes: 10 }
          ]
        }
      },
      {
        set: {
          items: [
            { taskId: radiators.id, minutes: 30 },
            { taskId: passport.id, minutes: 20 },
            { taskId: boilers.id, minutes: 45 }
          ]
        },
        start: passport.id
      }
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
