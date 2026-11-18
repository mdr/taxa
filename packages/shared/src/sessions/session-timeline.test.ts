import { describe, expect, it } from "vite-plus/test"
import { makeSession, planned } from "../test-support/make-session.ts"
import { makeTask } from "../test-support/make-task.ts"
import { SessionOutcome } from "./session.ts"
import { nextAfter, sessionTimeline } from "./session-timeline.ts"

const MINUTE = 60_000
const at = (time: string): number => Date.parse(`2026-01-05T${time}:00.000Z`)
const clock = (instant: number): string => new Date(instant).toISOString().slice(11, 16)

const radiators = makeTask({ number: 2, title: "Bleed the radiators" })
const boilers = makeTask({ number: 3, title: "Research boilers" })
const passport = makeTask({ number: 4, title: "Renew passport" })

const slotsOf = (timeline: ReturnType<typeof sessionTimeline>): string[] =>
  timeline.slots.map(({ item, state, start, end }) => `${clock(start)}-${clock(end)} ${state} ${item.task.title}`)

describe("sessionTimeline", () => {
  it("lays a plan out from the start, one task after another", () => {
    const session = makeSession({ items: [planned(radiators, 30), planned(boilers, 45), planned(passport, 20)] })
    const timeline = sessionTimeline(session, at("14:00"))
    expect(slotsOf(timeline)).toEqual([
      "14:00-14:30 NEXT Bleed the radiators",
      "14:30-15:15 NEXT Research boilers",
      "15:15-15:35 NEXT Renew passport"
    ])
    expect(timeline.spare).toBe(25 * MINUTE)
    expect(timeline.remaining).toBe(120 * MINUTE)
    expect(timeline.next?.item.task).toBe(radiators)
  })

  it("puts finished tasks in for as long as they took, and the rest after the current one", () => {
    const session = makeSession({
      items: [
        planned(radiators, 30, { spentMs: 27 * MINUTE, outcome: SessionOutcome.DONE }),
        planned(boilers, 45),
        planned(passport, 20)
      ],
      current: { taskId: boilers.id, since: "2026-01-05T14:27:00.000Z" }
    })
    const timeline = sessionTimeline(session, at("14:47"))
    expect(slotsOf(timeline)).toEqual([
      "14:00-14:27 DONE Bleed the radiators",
      "14:27-15:12 CURRENT Research boilers",
      "15:12-15:32 NEXT Renew passport"
    ])
    expect(timeline.current?.left).toBe(25 * MINUTE)
    expect(timeline.current?.spent).toBe(20 * MINUTE)
    expect(timeline.spare).toBe(28 * MINUTE)
  })

  it("lets the current task run over, sliding the rest, past the end if need be", () => {
    const session = makeSession({
      items: [planned(boilers, 45), planned(passport, 20)],
      endsAt: "2026-01-05T15:15:00.000Z",
      current: { taskId: boilers.id, since: "2026-01-05T14:00:00.000Z" }
    })
    const timeline = sessionTimeline(session, at("15:00"))
    expect(slotsOf(timeline)).toEqual(["14:00-15:00 CURRENT Research boilers", "15:00-15:20 NEXT Renew passport"])
    expect(timeline.current?.left).toBe(-15 * MINUTE)
    expect(timeline.spare).toBe(-5 * MINUTE)
  })

  it("counts time already spent on a task that's come back to, and starts the rest from now between tasks", () => {
    const session = makeSession({
      items: [planned(boilers, 45, { spentMs: 30 * MINUTE }), planned(passport, 20)]
    })
    expect(slotsOf(sessionTimeline(session, at("14:40")))).toEqual([
      "14:40-14:55 NEXT Research boilers",
      "14:55-15:15 NEXT Renew passport"
    ])
  })

  it("leaves what wasn't got to where the plan had it once the session's over", () => {
    const session = makeSession({
      items: [planned(radiators, 30, { spentMs: 30 * MINUTE, outcome: SessionOutcome.STOPPED }), planned(passport, 20)],
      endedAt: "2026-01-05T15:00:00.000Z"
    })
    expect(slotsOf(sessionTimeline(session, at("17:00")))).toEqual([
      "14:00-14:30 STOPPED Bleed the radiators",
      "14:30-14:50 NEXT Renew passport"
    ])
  })
})

describe("nextAfter", () => {
  it("finds the next task still to do, after the one given, then from the start", () => {
    const session = makeSession({
      items: [planned(radiators, 30, { outcome: SessionOutcome.DONE }), planned(boilers, 45), planned(passport, 20)]
    })
    expect(nextAfter(session, undefined)).toBe(boilers.id)
    expect(nextAfter(session, boilers.id)).toBe(passport.id)
    expect(nextAfter(session, passport.id)).toBe(boilers.id)
    expect(nextAfter({ ...session, items: session.items.slice(0, 1) }, radiators.id)).toBeUndefined()
  })
})
