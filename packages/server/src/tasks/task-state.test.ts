import { describe, expect, it } from "vite-plus/test"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { Energy, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { changeStatus, changesFromNothing, editTask, type StatusContext, type TaskState } from "./task-state.ts"

const makeState = (overrides: Partial<TaskState> = {}): TaskState => ({
  domainId: "home",
  title: "Fix the tap",
  notes: "",
  status: TaskStatus.OPEN,
  priority: Priority.NORMAL,
  inbox: true,
  due: undefined,
  scheduled: undefined,
  scheduledTime: undefined,
  start: undefined,
  estimateMinutes: undefined,
  energy: undefined,
  inProgressBy: undefined,
  waitingOn: undefined,
  followUp: undefined,
  completedAt: undefined,
  cancelledAt: undefined,
  cancelledReason: undefined,
  ...overrides
})

const NOW = Date.UTC(2026, 0, 7, 10, 0)
const CONTEXT: StatusContext = {
  actor: { userId: "matt", agentId: "claude", agentContext: "mdr/taxa" },
  today: "2026-01-07",
  now: NOW
}

describe("editTask", () => {
  it("sets and clears fields, logging only what changed", () => {
    const before = makeState({ due: "2026-01-09", energy: Energy.LOW })
    const { state, changes } = editTask(before, {
      set: { title: "Fix the kitchen tap", priority: Priority.NORMAL, scheduled: "2026-01-08" },
      clear: [ClearableField.DUE]
    })
    expect(state).toEqual({ ...before, title: "Fix the kitchen tap", scheduled: "2026-01-08", due: undefined })
    expect(changes).toEqual({
      title: { from: "Fix the tap", to: "Fix the kitchen tap" },
      scheduled: { to: "2026-01-08" },
      due: { from: "2026-01-09" }
    })
  })

  it("takes a task out of the Inbox when it's filed in another domain", () => {
    expect(editTask(makeState(), { set: { domainId: "work" }, clear: [] }).state.inbox).toBe(false)
    expect(editTask(makeState(), { set: { domainId: "work", inbox: true }, clear: [] }).state.inbox).toBe(true)
    expect(editTask(makeState(), { set: { domainId: "home" }, clear: [] }).state.inbox).toBe(true)
  })

  it("changes nothing when nothing differs", () => {
    expect(editTask(makeState(), { set: { title: "Fix the tap" }, clear: [ClearableField.DUE] }).changes).toEqual({})
  })
})

describe("changeStatus", () => {
  it("records who is working on a task in progress", () => {
    const { state } = changeStatus(makeState(), { status: TaskStatus.IN_PROGRESS }, CONTEXT)
    expect(state.inProgressBy).toEqual(CONTEXT.actor)
  })

  it("waits on something, following up in a week unless told when", () => {
    const waiting = changeStatus(makeState(), { status: TaskStatus.WAITING, waitingOn: "the plumber" }, CONTEXT)
    expect(waiting.state).toMatchObject({ waitingOn: "the plumber", followUp: "2026-01-14" })
    const sooner = changeStatus(makeState(), { status: TaskStatus.WAITING, followUp: "2026-01-09" }, CONTEXT)
    expect(sooner.state).toMatchObject({ waitingOn: undefined, followUp: "2026-01-09" })
  })

  it("records when a task was done, and forgets the status it left", () => {
    const inProgress = changeStatus(makeState(), { status: TaskStatus.IN_PROGRESS }, CONTEXT).state
    const { state, changes } = changeStatus(inProgress, { status: TaskStatus.DONE }, CONTEXT)
    expect(state).toMatchObject({ status: TaskStatus.DONE, completedAt: NOW, inProgressBy: undefined })
    expect(changes["completedAt"]).toEqual({ to: "2026-01-07T10:00:00.000Z" })
    expect(changes["status"]).toEqual({ from: TaskStatus.IN_PROGRESS, to: TaskStatus.DONE })
  })

  it("keeps the original time when a done task is marked done again", () => {
    const done = changeStatus(makeState(), { status: TaskStatus.DONE }, CONTEXT).state
    expect(changeStatus(done, { status: TaskStatus.DONE }, { ...CONTEXT, now: NOW + 1000 }).changes).toEqual({})
  })

  it("cancels with a reason, and reopening clears it", () => {
    const cancelled = changeStatus(makeState(), { status: TaskStatus.CANCELLED, reason: "sold the house" }, CONTEXT)
    expect(cancelled.state).toMatchObject({ cancelledAt: NOW, cancelledReason: "sold the house" })
    const reopened = changeStatus(cancelled.state, { status: TaskStatus.OPEN }, CONTEXT)
    expect(reopened.state).toEqual(makeState())
  })
})

describe("changesFromNothing", () => {
  it("logs every field a new task has", () => {
    expect(changesFromNothing(makeState({ due: "2026-01-09" }))).toEqual({
      domainId: { to: "home" },
      title: { to: "Fix the tap" },
      notes: { to: "" },
      status: { to: TaskStatus.OPEN },
      priority: { to: Priority.NORMAL },
      inbox: { to: true },
      due: { to: "2026-01-09" }
    })
  })
})
