import { describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { SessionOutcome } from "@taxa/shared/sessions/session"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { RepeatFrom, RepeatUnit } from "@taxa/shared/tasks/repeat"
import { LOG_CODES } from "../telemetry/log.ts"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

const MINUTE = 60_000

describe("sessions", () => {
  const it = useInProcessServer()

  it("work through a plan, moving each task on, and keep the time spent", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const radiators = await matt.addTask("Bleed the radiators", { domain: "H" })
    const passport = await matt.addTask("Renew passport")
    expect(await matt.client.currentSession()).toBeUndefined()

    const endsAt = new Date(server.clock.now() + 120 * MINUTE).toISOString()
    const started = await matt.client.createSession({
      endsAt,
      items: [
        { taskId: radiators.id, minutes: 30 },
        { taskId: passport.id, minutes: 20 }
      ],
      start: radiators.id
    })
    expect(started.items.map(({ task, minutes }) => [task.ref, task.status, minutes])).toEqual([
      ["H-1", TaskStatus.IN_PROGRESS, 30],
      ["H-2", TaskStatus.OPEN, 20]
    ])
    expect(started.current?.taskId).toBe(radiators.id)
    expect(await matt.client.currentSession()).toEqual(started)

    server.advance(27 * MINUTE)
    const moved = await matt.client.updateSession(
      started.id,
      { finish: SessionOutcome.DONE, start: passport.id },
      started.version
    )
    expect(moved.items.map(({ task, spentMs, outcome }) => [task.ref, task.status, spentMs, outcome])).toEqual([
      ["H-1", TaskStatus.DONE, 27 * MINUTE, SessionOutcome.DONE],
      ["H-2", TaskStatus.IN_PROGRESS, 0, undefined]
    ])
    await expectProblem(
      matt.client.updateSession(started.id, { finish: SessionOutcome.DONE }, started.version),
      ProblemType.VERSION_CONFLICT
    )

    server.advance(10 * MINUTE)
    const ended = await matt.client.updateSession(moved.id, { end: true })
    expect(ended.endedAt).toBeDefined()
    expect(ended.items[1]).toMatchObject({ spentMs: 10 * MINUTE, outcome: SessionOutcome.STOPPED })
    expect((await matt.client.task("H-2")).status).toBe(TaskStatus.OPEN)
    expect(await matt.client.currentSession()).toBeUndefined()

    const noted = await matt.client.updateSession(ended.id, { set: { note: "Passport photo next" } })
    expect((await matt.client.session(ended.id)).note).toBe("Passport photo next")
    expect(noted.version).toBe(ended.version + 1)
    await expectProblem(matt.client.updateSession(ended.id, { start: passport.id }), ProblemType.INVALID_REQUEST)
  })

  it("are one at a time, each only its owner's, and only of tasks they can see", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const jo = await server.user("Jo")
    const tap = await matt.addTask("Fix the tap")
    const endsAt = new Date(server.clock.now() + 60 * MINUTE).toISOString()

    await expectProblem(
      jo.client.createSession({ endsAt, items: [{ taskId: tap.id, minutes: 15 }] }),
      ProblemType.NOT_FOUND
    )
    const session = await matt.client.createSession({ endsAt, items: [{ taskId: tap.id, minutes: 15 }] })
    await expectProblem(matt.client.createSession({ endsAt, items: [] }), ProblemType.SESSION_OPEN)
    await expectProblem(jo.client.session(session.id), ProblemType.NOT_FOUND)
    await expectProblem(jo.client.updateSession(session.id, { end: true }), ProblemType.NOT_FOUND)
    await expectProblem(matt.client.session("not-an-id" as never), ProblemType.NOT_FOUND)
  })

  it("leave a task someone else finished meanwhile as it is", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const tap = await matt.addTask("Fix the tap")
    const session = await matt.client.createSession({
      endsAt: new Date(server.clock.now() + 60 * MINUTE).toISOString(),
      items: [{ taskId: tap.id, minutes: 15 }],
      start: tap.id
    })
    await matt.client.changeStatus(tap.ref, { status: TaskStatus.DONE })
    await matt.client.updateSession(session.id, { end: true })
    expect((await matt.client.task(tap.ref)).status).toBe(TaskStatus.DONE)
  })

  it("take back a task finished by mistake: it's under way again, and the one moved on to waits", async ({
    server
  }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const tap = await matt.addTask("Fix the tap")
    const radiators = await matt.addTask("Bleed the radiators")
    const session = await matt.client.createSession({
      endsAt: new Date(server.clock.now() + 60 * MINUTE).toISOString(),
      items: [
        { taskId: tap.id, minutes: 15 },
        { taskId: radiators.id, minutes: 30 }
      ],
      start: tap.id
    })
    server.advance(5 * MINUTE)
    await matt.client.updateSession(session.id, { finish: SessionOutcome.DONE, start: radiators.id })
    expect((await matt.client.task(tap.ref)).status).toBe(TaskStatus.DONE)

    const undone = await matt.client.updateSession(session.id, { start: tap.id })
    expect(undone.current?.taskId).toBe(tap.id)
    expect(undone.items.map(({ task, outcome, spentMs }) => [task.title, outcome, spentMs])).toEqual([
      ["Fix the tap", undefined, 5 * MINUTE],
      ["Bleed the radiators", undefined, 0]
    ])
    expect((await matt.client.task(tap.ref)).status).toBe(TaskStatus.IN_PROGRESS)
    expect((await matt.client.task(radiators.ref)).status).toBe(TaskStatus.OPEN)
  })

  it("do a repeating task this time, and taking that back takes back the occurrence too", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const anki = await matt.addTask("Revise Anki cards", {
      repeat: { every: 1, unit: RepeatUnit.DAY, from: RepeatFrom.SCHEDULE }
    })
    const tap = await matt.addTask("Fix the tap")
    const session = await matt.client.createSession({
      endsAt: new Date(server.clock.now() + 60 * MINUTE).toISOString(),
      items: [
        { taskId: anki.id, minutes: 15 },
        { taskId: tap.id, minutes: 30 }
      ],
      start: anki.id
    })
    await matt.client.updateSession(session.id, { finish: SessionOutcome.DONE, start: tap.id })
    expect(await matt.client.task(anki.ref)).toMatchObject({ status: TaskStatus.OPEN, scheduled: "2026-01-06" })
    expect(await matt.client.occurrences(anki.ref)).toHaveLength(1)

    await matt.client.updateSession(session.id, { start: anki.id })
    expect(await matt.client.task(anki.ref)).toMatchObject({ status: TaskStatus.IN_PROGRESS, scheduled: "2026-01-05" })
    expect(await matt.client.occurrences(anki.ref)).toEqual([])
  })

  it("stop a task deleted while under way, and keep its place for when it's restored", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const tap = await matt.addTask("Fix the tap")
    const radiators = await matt.addTask("Bleed the radiators")
    const session = await matt.client.createSession({
      endsAt: new Date(server.clock.now() + 60 * MINUTE).toISOString(),
      items: [
        { taskId: tap.id, minutes: 15 },
        { taskId: radiators.id, minutes: 30 }
      ],
      start: tap.id
    })
    server.advance(5 * MINUTE)
    await matt.client.deleteTask(tap.ref)
    const shown = await matt.client.session(session.id)
    expect(shown.current).toBeUndefined()
    expect(shown.items.map(({ task }) => task.title)).toEqual(["Bleed the radiators"])

    // Replanned without it, as all that's shown.
    server.advance(20 * MINUTE)
    await matt.client.updateSession(session.id, { set: { items: [{ taskId: radiators.id, minutes: 45 }] } })
    await matt.client.restoreTask(tap.ref)
    const restored = await matt.client.session(session.id)
    expect(restored.current).toBeUndefined()
    expect(restored.items.map(({ task, minutes, spentMs }) => [task.title, minutes, spentMs])).toEqual([
      ["Fix the tap", 15, 5 * MINUTE],
      ["Bleed the radiators", 45, 0]
    ])
  })

  it("are logged, once per change, with what changed", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const tap = await matt.addTask("Fix the tap")
    const from = server.logs.length
    const session = await matt.client.createSession({
      endsAt: new Date(server.clock.now() + 60 * MINUTE).toISOString(),
      items: [{ taskId: tap.id, minutes: 15 }],
      start: tap.id
    })
    await matt.client.updateSession(session.id, {
      set: { endsAt: new Date(server.clock.now() + 90 * MINUTE).toISOString() }
    })
    await matt.client.updateSession(session.id, { end: true })
    const logs = server.logs.slice(from).filter(({ code }) => code.startsWith("session."))
    expect(logs.map(({ code, fields }) => [code, fields["changed"], fields["sessionId"]])).toEqual([
      [LOG_CODES.session.created, "created", session.id],
      [LOG_CODES.session.changed, "endsAt", session.id],
      [LOG_CODES.session.ended, "end", session.id]
    ])
  })
})
