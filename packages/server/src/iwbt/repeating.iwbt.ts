import { describe, expect } from "vite-plus/test"
import { ActivityType } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import { MissedDays, OccurrenceOutcome, RepeatFrom, RepeatUnit, Weekday } from "@taxa/shared/tasks/repeat"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { Horizon, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

const DAY_MS = 86_400_000
const DAILY = { every: 1, unit: RepeatUnit.DAY, from: RepeatFrom.SCHEDULE }

// Every test's clock starts on Monday 5 January 2026.
describe("repeating tasks", () => {
  const it = useInProcessServer()

  it("keep one number, and doing one moves it on to its next date, recording what was done", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const anki = await matt.addTask("Revise Anki cards", { domain: "H", repeat: DAILY })
    expect(anki).toMatchObject({
      scheduled: "2026-01-05",
      repeat: { every: 1, unit: RepeatUnit.DAY, from: RepeatFrom.SCHEDULE, starts: "2026-01-05" }
    })

    const done = await matt.client.changeStatus(anki.ref, { status: TaskStatus.DONE })
    expect(done).toMatchObject({ ref: anki.ref, status: TaskStatus.OPEN, scheduled: "2026-01-06" })
    expect(done.completedAt).toBeUndefined()
    const skipped = await matt.client.recordOccurrence(anki.ref, {
      outcome: OccurrenceOutcome.SKIPPED,
      date: "2026-01-06"
    })
    expect(skipped.scheduled).toBe("2026-01-07")

    expect(await matt.client.occurrences(anki.ref)).toMatchObject([
      { date: "2026-01-06", outcome: OccurrenceOutcome.SKIPPED, on: "2026-01-05", by: { user: { name: "Matt" } } },
      { date: "2026-01-05", outcome: OccurrenceOutcome.DONE, on: "2026-01-05" }
    ])
    const [recorded] = await matt.client.activity(anki.ref).then((entries) => entries.slice(-1))
    expect(recorded).toMatchObject({ type: ActivityType.TASK_OCCURRENCE_RECORDED, version: skipped.version })
    expect(server.logs.filter(({ code }) => code === "task.occurrenceRecorded")).toHaveLength(1)
  })

  it("won't do the same occurrence twice: a retry for a date it's moved on from is refused", async ({ server }) => {
    const matt = await server.user("Matt")
    const anki = await matt.addTask("Revise Anki cards", { repeat: DAILY })
    const request = { outcome: OccurrenceOutcome.DONE, date: "2026-01-05" } as const
    await matt.client.recordOccurrence(anki.ref, request)
    await expectProblem(matt.client.recordOccurrence(anki.ref, request), ProblemType.VERSION_CONFLICT)
    expect(await matt.client.occurrences(anki.ref)).toHaveLength(1)
    const once = await matt.addTask("Ring the bank")
    await expectProblem(matt.client.recordOccurrence(once.ref, request), ProblemType.INVALID_REQUEST)
  })

  it("keeps to its schedule, moving its due date with it", async ({ server }) => {
    const matt = await server.user("Matt")
    const rent = await matt.addTask("Pay the rent", {
      scheduled: "2026-01-01",
      due: "2026-01-03",
      repeat: { every: 1, unit: RepeatUnit.MONTH, from: RepeatFrom.SCHEDULE }
    })
    // Carried over, done late on the 5th: next month, still due two days later.
    const paid = await matt.client.changeStatus(rent.ref, { status: TaskStatus.DONE })
    expect(paid).toMatchObject({ scheduled: "2026-02-01", due: "2026-02-03" })

    const gym = await matt.addTask("Go to the gym", {
      repeat: {
        every: 1,
        unit: RepeatUnit.WEEK,
        from: RepeatFrom.SCHEDULE,
        weekdays: [Weekday.TUESDAY, Weekday.THURSDAY]
      }
    })
    expect(gym.scheduled).toBe("2026-01-06")
    const plants = await matt.addTask("Water the plants", {
      scheduled: "2026-01-04",
      repeat: { every: 3, unit: RepeatUnit.DAY, from: RepeatFrom.COMPLETION }
    })
    expect((await matt.client.changeStatus(plants.ref, { status: TaskStatus.DONE })).scheduled).toBe("2026-01-08")
  })

  it("always has a day it's next for, which beats a horizon", async ({ server }) => {
    const matt = await server.user("Matt")
    const soon = await matt.addTask("Revise Anki cards", { horizon: Horizon.SOON })
    const repeating = await matt.client.updateTask(soon.ref, { set: { repeat: DAILY } })
    expect(repeating).toMatchObject({ scheduled: "2026-01-05" })
    expect(repeating.horizon).toBeUndefined()

    await expectProblem(
      matt.client.updateTask(soon.ref, { clear: [ClearableField.SCHEDULED] }),
      ProblemType.INVALID_REQUEST
    )
    expect((await matt.client.updateTask(soon.ref, { set: { scheduled: "2026-01-09" } })).scheduled).toBe("2026-01-09")
    const stopped = await matt.client.updateTask(soon.ref, { clear: [ClearableField.REPEAT] })
    expect(stopped.repeat).toBeUndefined()
    expect(stopped.scheduled).toBe("2026-01-09")
  })

  it("is skipped rather than cancelled, and only done for good once it stops repeating", async ({ server }) => {
    const matt = await server.user("Matt")
    const anki = await matt.addTask("Revise Anki cards", { repeat: DAILY })
    await expectProblem(
      matt.client.changeStatus(anki.ref, { status: TaskStatus.CANCELLED }),
      ProblemType.INVALID_REQUEST
    )
    await matt.client.updateTask(anki.ref, { clear: [ClearableField.REPEAT] })
    expect((await matt.client.changeStatus(anki.ref, { status: TaskStatus.DONE })).status).toBe(TaskStatus.DONE)
    await expectProblem(matt.client.updateTask(anki.ref, { set: { repeat: DAILY } }), ProblemType.INVALID_REQUEST)
  })

  it("undoes doing one, putting its dates back, and redoes it", async ({ server }) => {
    const matt = await server.user("Matt")
    const anki = await matt.addTask("Revise Anki cards", { repeat: DAILY })
    const done = await matt.client.changeStatus(anki.ref, { status: TaskStatus.DONE })

    const undone = await matt.client.undoTask(anki.ref, done.version)
    expect(undone.scheduled).toBe("2026-01-05")
    expect(await matt.client.occurrences(anki.ref)).toEqual([])
    const [entry] = (await matt.client.activity(anki.ref)).slice(-1)
    expect(entry).toMatchObject({ type: ActivityType.TASK_OCCURRENCE_UNDONE, undoesVersion: done.version })

    const redone = await matt.client.undoTask(anki.ref, undone.version)
    expect(redone.scheduled).toBe("2026-01-06")
    expect(await matt.client.occurrences(anki.ref)).toMatchObject([{ date: "2026-01-05" }])
    await matt.client.undoTask(anki.ref, redone.version)
    // Done again once undone: a new occurrence for the same day.
    await matt.client.changeStatus(anki.ref, { status: TaskStatus.DONE })
    expect(await matt.client.occurrences(anki.ref)).toHaveLength(1)
  })

  it("won't undo doing one once it's been moved since", async ({ server }) => {
    const matt = await server.user("Matt")
    const anki = await matt.addTask("Revise Anki cards", { repeat: DAILY })
    const done = await matt.client.changeStatus(anki.ref, { status: TaskStatus.DONE })
    server.clock.advance(DAY_MS)
    await matt.client.changeStatus(anki.ref, { status: TaskStatus.DONE })
    await expectProblem(matt.client.undoTask(anki.ref, done.version), ProblemType.VERSION_CONFLICT)
  })

  it("skips missed days, by default for a daily one: recorded with the next change, which goes on from today", async ({
    server
  }) => {
    const matt = await server.user("Matt")
    const anki = await matt.addTask("Revise Anki cards", { repeat: DAILY, due: "2026-01-05" })
    expect(anki.repeat?.missed).toBe(MissedDays.SKIP)
    server.clock.advance(3 * DAY_MS)
    // Until it's changed, it's just overdue: nothing runs to catch it up.
    expect((await matt.client.task(anki.ref)).scheduled).toBe("2026-01-05")

    // Done as the tab saw it, for Monday: it's Thursday's that's done.
    const done = await matt.client.recordOccurrence(anki.ref, { outcome: OccurrenceOutcome.DONE, date: "2026-01-05" })
    expect(done).toMatchObject({ scheduled: "2026-01-09", due: "2026-01-09" })
    expect((await matt.client.occurrences(anki.ref)).map(({ date, outcome }) => [date, outcome])).toEqual([
      ["2026-01-08", OccurrenceOutcome.DONE],
      ["2026-01-07", OccurrenceOutcome.MISSED],
      ["2026-01-06", OccurrenceOutcome.MISSED],
      ["2026-01-05", OccurrenceOutcome.MISSED]
    ])
    const [entry] = (await matt.client.activity(anki.ref)).slice(-1)
    expect(entry).toMatchObject({
      type: ActivityType.TASK_OCCURRENCE_RECORDED,
      changes: { scheduled: { from: "2026-01-05", to: "2026-01-09" } }
    })
    // A retry for Monday's is refused: it's moved on.
    await expectProblem(
      matt.client.recordOccurrence(anki.ref, { outcome: OccurrenceOutcome.DONE, date: "2026-01-05" }),
      ProblemType.VERSION_CONFLICT
    )

    // Undone, Monday's back, and the days missed with it.
    const undone = await matt.client.undoTask(anki.ref, done.version)
    expect(undone.scheduled).toBe("2026-01-05")
    expect(await matt.client.occurrences(anki.ref)).toEqual([])
    const redone = await matt.client.undoTask(anki.ref, undone.version)
    expect(redone.scheduled).toBe("2026-01-09")
    expect(await matt.client.occurrences(anki.ref)).toHaveLength(4)
  })

  it("catches up missed days with any edit, but not while it's under way, nor when they're carried over", async ({
    server
  }) => {
    const matt = await server.user("Matt")
    const anki = await matt.addTask("Revise Anki cards", { repeat: DAILY })
    const started = await matt.addTask("Practise piano", { repeat: DAILY })
    await matt.client.changeStatus(started.ref, { status: TaskStatus.IN_PROGRESS })
    const bins = await matt.addTask("Put the bins out", {
      repeat: { every: 1, unit: RepeatUnit.WEEK, from: RepeatFrom.SCHEDULE }
    })
    expect(bins.repeat?.missed).toBe(MissedDays.CARRY_OVER)
    server.clock.advance(8 * DAY_MS)

    const edited = await matt.client.updateTask(anki.ref, { set: { title: "Revise Anki decks" } })
    expect(edited.scheduled).toBe("2026-01-13")
    expect(await matt.client.occurrences(anki.ref)).toHaveLength(8)
    const [entry] = (await matt.client.activity(anki.ref)).slice(-1)
    expect(entry?.changes).toMatchObject({ title: { to: "Revise Anki decks" }, scheduled: { to: "2026-01-13" } })

    expect((await matt.client.updateTask(started.ref, { set: { priority: Priority.HIGH } })).scheduled).toBe(
      "2026-01-05"
    )
    expect((await matt.client.updateTask(bins.ref, { set: { priority: Priority.HIGH } })).scheduled).toBe("2026-01-05")
    const skipping = await matt.client.updateTask(bins.ref, {
      set: { repeat: { ...bins.repeat!, missed: MissedDays.SKIP } }
    })
    expect(skipping.scheduled).toBe("2026-01-05")
    const done = await matt.client.changeStatus(bins.ref, { status: TaskStatus.DONE })
    // Done a day late on Tuesday the 13th, it's Monday the 12th's: the 5th was missed.
    expect(done.scheduled).toBe("2026-01-19")
    expect((await matt.client.occurrences(bins.ref)).map(({ date, outcome }) => [date, outcome])).toEqual([
      ["2026-01-12", OccurrenceOutcome.DONE],
      ["2026-01-05", OccurrenceOutcome.MISSED]
    ])
  })

  it("forgets its occurrences when it's deleted for good", async ({ server }) => {
    const matt = await server.user("Matt")
    const anki = await matt.addTask("Revise Anki cards", { repeat: DAILY })
    await matt.client.changeStatus(anki.ref, { status: TaskStatus.DONE })
    await matt.client.deleteTask(anki.ref)
    await matt.client.purgeTask(anki.ref)
    expect(await server.storedOccurrences(anki.id)).toEqual([])
  })
})
