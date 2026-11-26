import { agentId, domainId, userId } from "@taxa/shared/ids"
import { describe, expect, it } from "vite-plus/test"
import { ClearableField } from "@taxa/shared/tasks/task-requests"
import { Energy, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import {
  changeStatus,
  changesFromNothing,
  editTask,
  revertedState,
  RevertType,
  type StatusContext,
  type TaskState
} from "./task-state.ts"

const HOME = domainId("0190a1b2-0000-7000-8000-00000000000a")
const WORK = domainId("0190a1b2-0000-7000-8000-00000000000b")
const MATT = userId("0190a1b2-0000-7000-8000-000000000001")

const makeState = (overrides: Partial<TaskState> = {}): TaskState => ({
  domainId: HOME,
  inboxUserId: MATT,
  title: "Fix the tap",
  notes: "",
  status: TaskStatus.OPEN,
  priority: Priority.NORMAL,
  due: undefined,
  scheduled: undefined,
  scheduledTime: undefined,
  start: undefined,
  estimateMinutes: undefined,
  energy: undefined,
  horizon: undefined,
  tags: [],
  checklist: [],
  repeat: undefined,
  followsOnId: undefined,
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
  actor: {
    userId: MATT,
    agentId: agentId("0190a1b2-0000-7000-8000-000000000002"),
    agentContext: "mdr/taxa"
  },
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
      domainId: { to: HOME },
      inboxUserId: { to: MATT },
      title: { to: "Fix the tap" },
      notes: { to: "" },
      status: { to: TaskStatus.OPEN },
      priority: { to: Priority.NORMAL },
      due: { to: "2026-01-09" }
    })
  })
})

describe("revertedState", () => {
  it("puts back what a change did, times and cleared fields too", () => {
    const inProgress = changeStatus(makeState({ priority: Priority.HIGH }), { status: TaskStatus.IN_PROGRESS }, CONTEXT)
    const done = changeStatus(inProgress.state, { status: TaskStatus.DONE }, CONTEXT)
    const reverted = revertedState(done.state, done.changes)
    expect(reverted).toEqual({
      type: RevertType.REVERTED,
      outcome: { state: inProgress.state, changes: expect.anything() }
    })
    const cancelled = changeStatus(makeState(), { status: TaskStatus.CANCELLED, reason: "moved" }, CONTEXT)
    const reopened = changeStatus(cancelled.state, { status: TaskStatus.OPEN }, CONTEXT)
    expect(revertedState(reopened.state, reopened.changes)).toMatchObject({ outcome: { state: cancelled.state } })
  })

  it("takes back moving a task to another domain", () => {
    const moved = editTask(makeState(), { set: { domainId: WORK }, clear: [] })
    expect(revertedState(moved.state, moved.changes)).toMatchObject({ outcome: { state: makeState() } })
  })

  it("won't overwrite what's changed since, saying which", () => {
    const edited = editTask(makeState(), { set: { title: "Fix the kitchen tap", priority: Priority.HIGH }, clear: [] })
    const since = editTask(edited.state, { set: { priority: Priority.LOW }, clear: [] }).state
    expect(revertedState(since, edited.changes)).toEqual({ type: RevertType.CHANGED_SINCE, fields: ["priority"] })
  })
})
