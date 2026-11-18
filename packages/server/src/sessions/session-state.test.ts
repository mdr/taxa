import { ProblemType } from "@taxa/shared/api/problem"
import { taskId } from "@taxa/shared/ids"
import { SessionOutcome } from "@taxa/shared/sessions/session"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { describe, expect, it } from "vite-plus/test"
import { ProblemError } from "../http/problem-error.ts"
import { newSession, statusMoves, updateSession, type SessionState } from "./session-state.ts"

const MINUTE = 60_000
const START = Date.UTC(2026, 0, 5, 14, 0)
const at = (minutes: number): number => START + minutes * MINUTE

const tap = taskId("0190a1b2-0000-7000-8000-000000000001")
const radiators = taskId("0190a1b2-0000-7000-8000-000000000002")
const boilers = taskId("0190a1b2-0000-7000-8000-000000000003")

const planned = (): SessionState =>
  newSession(
    at(120),
    [
      { taskId: radiators, minutes: 30 },
      { taskId: boilers, minutes: 45 }
    ],
    radiators,
    START
  )

const refusal = (run: () => unknown): string | undefined => {
  try {
    run()
    return undefined
  } catch (error) {
    if (error instanceof ProblemError && error.problem.type === ProblemType.INVALID_REQUEST)
      return error.problem.message
    throw error
  }
}

describe("sessions", () => {
  it("start now, on the task asked for", () => {
    expect(planned()).toEqual({
      startedAt: START,
      endsAt: at(120),
      items: [
        { taskId: radiators, minutes: 30, spentMs: 0 },
        { taskId: boilers, minutes: 45, spentMs: 0 }
      ],
      current: { taskId: radiators, since: START },
      note: "",
      endedAt: undefined
    })
    expect(refusal(() => newSession(START, [], undefined, START))).toBe("A session has to end after it starts.")
    expect(refusal(() => newSession(at(60), [], tap, START))).toBe("Only a task in the session's plan can be started.")
  })

  it("finish a task, keeping the time it took, and go on to the next", () => {
    const after = updateSession(planned(), { finish: SessionOutcome.DONE, start: boilers }, at(27))
    expect(after.items).toEqual([
      { taskId: radiators, minutes: 30, spentMs: 27 * MINUTE, outcome: SessionOutcome.DONE },
      { taskId: boilers, minutes: 45, spentMs: 0 }
    ])
    expect(after.current).toEqual({ taskId: boilers, since: at(27) })
    expect(
      refusal(() =>
        updateSession(
          updateSession(after, { finish: SessionOutcome.STOPPED }, at(30)),
          { finish: SessionOutcome.DONE },
          at(31)
        )
      )
    ).toBe("There's no task under way to finish.")
  })

  it("add up the stretches of a task left and come back to, which is then no longer stopped", () => {
    const stopped = updateSession(planned(), { finish: SessionOutcome.STOPPED, start: boilers }, at(10))
    const back = updateSession(stopped, { start: radiators }, at(20))
    const left = updateSession(back, { start: boilers }, at(25))
    expect(left.items[0]).toEqual({ taskId: radiators, minutes: 30, spentMs: 15 * MINUTE })
    expect(left.items[1]).toEqual({ taskId: boilers, minutes: 45, spentMs: 10 * MINUTE })
  })

  it("replan, keeping what's been spent, but not without the task under way", () => {
    const worked = updateSession(planned(), { finish: SessionOutcome.STOPPED }, at(10))
    const replanned = updateSession(
      worked,
      {
        set: {
          items: [
            { taskId: tap, minutes: 15 },
            { taskId: radiators, minutes: 40 }
          ],
          endsAt: at(150)
        }
      },
      at(11)
    )
    expect(replanned.items).toEqual([
      { taskId: tap, minutes: 15, spentMs: 0 },
      { taskId: radiators, minutes: 40, spentMs: 10 * MINUTE, outcome: SessionOutcome.STOPPED }
    ])
    expect(replanned.endsAt).toBe(at(150))
    expect(refusal(() => updateSession(planned(), { set: { items: [{ taskId: boilers, minutes: 45 }] } }, at(5)))).toBe(
      "Finish or stop the task under way before taking it out of the plan."
    )
    expect(refusal(() => updateSession(planned(), { set: { endsAt: START } }, at(5)))).toBe(
      "A session has to end after it starts."
    )
  })

  it("end by stopping the task under way, after which only the note can change", () => {
    const ended = updateSession(planned(), { end: true }, at(30))
    expect(ended.endedAt).toBe(at(30))
    expect(ended.current).toBeUndefined()
    expect(ended.items[0]).toEqual({
      taskId: radiators,
      minutes: 30,
      spentMs: 30 * MINUTE,
      outcome: SessionOutcome.STOPPED
    })
    expect(updateSession(ended, { set: { note: "Quotes next" } }, at(31)).note).toBe("Quotes next")
    expect(refusal(() => updateSession(ended, { start: boilers }, at(31)))).toBe(
      "This session has ended: only its note can change."
    )
  })
})

describe("statusMoves", () => {
  it("puts a started task in progress", () => {
    expect(statusMoves(undefined, planned())).toEqual([
      { taskId: radiators, to: TaskStatus.IN_PROGRESS, from: [TaskStatus.OPEN, TaskStatus.WAITING] }
    ])
  })

  it("ticks off a finished task, and puts a stopped one back to open", () => {
    const before = planned()
    expect(statusMoves(before, updateSession(before, { finish: SessionOutcome.DONE, start: boilers }, at(5)))).toEqual([
      { taskId: radiators, to: TaskStatus.DONE, from: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.WAITING] },
      { taskId: boilers, to: TaskStatus.IN_PROGRESS, from: [TaskStatus.OPEN, TaskStatus.WAITING] }
    ])
    expect(statusMoves(before, updateSession(before, { end: true }, at(5)))).toEqual([
      { taskId: radiators, to: TaskStatus.OPEN, from: [TaskStatus.IN_PROGRESS] }
    ])
    expect(statusMoves(before, updateSession(before, { set: { note: "hm" } }, at(5)))).toEqual([])
  })
})
