import { ProblemType } from "@taxa/shared/api/problem"
import type { TaskId } from "@taxa/shared/ids"
import { SessionOutcome, type PlannedTask } from "@taxa/shared/sessions/session"
import { TaskStatus } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import type { StoredSessionItem } from "../database/schema.ts"
import { ProblemError } from "../http/problem-error.ts"

export interface SessionState {
  startedAt: Instant
  endsAt: Instant
  items: StoredSessionItem[]
  current: { taskId: TaskId; since: Instant } | undefined
  note: string
  endedAt: Instant | undefined
}

/** What's asked of a session, its times as instants. */
export interface SessionUpdate {
  finish?: SessionOutcome
  set?: { endsAt?: Instant; items?: readonly PlannedTask[]; note?: string }
  start?: TaskId
  end?: true
}

const refuse = (message: string): never => {
  throw new ProblemError(ProblemType.INVALID_REQUEST, message)
}

/** Stops the clock on the task under way, adding the time to it, with how it went if that's known. */
const leaveCurrent = (state: SessionState, now: Instant, outcome?: SessionOutcome): SessionState => {
  const { current } = state
  if (!current) return state
  return {
    ...state,
    current: undefined,
    items: state.items.map((item) =>
      item.taskId === current.taskId
        ? {
            ...item,
            spentMs: item.spentMs + Math.max(0, now - current.since),
            ...(outcome ? { outcome } : {})
          }
        : item
    )
  }
}

/**
 * The plan as asked for, keeping the time spent and outcome of tasks already
 * in it. Tasks not `visible` (deleted since) weren't shown to whoever asked,
 * so keep their places, to be there again if they come back.
 */
const replan = (
  state: SessionState,
  items: readonly PlannedTask[],
  visible: ReadonlySet<TaskId> | undefined
): SessionState => {
  const asked = new Set(items.map(({ taskId }) => taskId))
  const hidden = state.items.filter(({ taskId }) => visible && !visible.has(taskId) && !asked.has(taskId))
  const { current } = state
  if (current && !asked.has(current.taskId) && !hidden.some(({ taskId }) => taskId === current.taskId))
    refuse("Finish or stop the task under way before taking it out of the plan.")
  const kept = new Map(state.items.map((item) => [item.taskId, item]))
  const planned = items.map(({ taskId, minutes }) => ({ spentMs: 0, ...kept.get(taskId), taskId, minutes }))
  return {
    ...state,
    items: hidden.reduce((plan, item) => {
      const at = Math.min(state.items.indexOf(item), plan.length)
      return [...plan.slice(0, at), item, ...plan.slice(at)]
    }, planned)
  }
}

/** The task stopped, if it's the one under way: deleted, it waits if it comes back, its time spent kept. */
export const stopTask = (state: SessionState, taskId: TaskId, now: Instant): SessionState =>
  state.current?.taskId === taskId ? leaveCurrent(state, now) : state

const startTask = (state: SessionState, taskId: TaskId, now: Instant): SessionState => {
  if (!state.items.some((item) => item.taskId === taskId)) refuse("Only a task in the session's plan can be started.")
  if (state.current?.taskId === taskId) return state
  const left = leaveCurrent(state, now)
  return {
    ...left,
    current: { taskId, since: now },
    items: left.items.map((item) => {
      if (item.taskId !== taskId) return item
      const { outcome: _cleared, ...rest } = item
      return rest
    })
  }
}

const endsAfterStart = (state: SessionState, endsAt: Instant): void => {
  if (endsAt <= state.startedAt) refuse("A session has to end after it starts.")
}

/** A session starting now, as planned. */
export const newSession = (
  endsAt: Instant,
  items: readonly PlannedTask[],
  start: TaskId | undefined,
  now: Instant
): SessionState => {
  const state: SessionState = {
    startedAt: now,
    endsAt,
    items: items.map(({ taskId, minutes }) => ({ taskId, minutes, spentMs: 0 })),
    current: undefined,
    note: "",
    endedAt: undefined
  }
  endsAfterStart(state, endsAt)
  return start === undefined ? state : startTask(state, start, now)
}

/** A session after the update: finish, replan, start, end, in that order; `visible`, its tasks the asker can see. */
export const updateSession = (
  state: SessionState,
  update: SessionUpdate,
  now: Instant,
  visible?: ReadonlySet<TaskId>
): SessionState => {
  const { finish, set, start, end } = update
  if (state.endedAt !== undefined) {
    if (finish || start || end || set?.endsAt !== undefined || set?.items)
      refuse("This session has ended: only its note can change.")
    return set?.note === undefined ? state : { ...state, note: set.note }
  }
  let next = state
  if (finish) {
    if (!next.current) refuse("There's no task under way to finish.")
    next = leaveCurrent(next, now, finish)
  }
  if (set?.items) next = replan(next, set.items, visible)
  if (set?.endsAt !== undefined) {
    endsAfterStart(next, set.endsAt)
    next = { ...next, endsAt: set.endsAt }
  }
  if (set?.note !== undefined) next = { ...next, note: set.note }
  if (start) next = startTask(next, start, now)
  if (end) next = { ...leaveCurrent(next, now, SessionOutcome.STOPPED), endedAt: now }
  return next
}

/** A status a session's change moves a task to, from the statuses it can move it from. */
export interface StatusMove {
  /** Starting a task the session had ticked off: taking that back. */
  takesBack?: boolean
  taskId: TaskId
  to: TaskStatus
  from: readonly TaskStatus[]
}

/**
 * How the session's change moves its tasks: starting one puts it in
 * progress, finishing it ticks it off, and leaving it otherwise puts it back
 * to open. Only from statuses where that makes sense, so a task someone
 * else has meanwhile ticked off stays ticked off.
 */
export const statusMoves = (before: SessionState | undefined, after: SessionState): StatusMove[] => {
  const moves: StatusMove[] = []
  const was = before?.current?.taskId
  const is = after.current?.taskId
  if (was && was !== is) {
    const finished = after.items.find((item) => item.taskId === was)?.outcome === SessionOutcome.DONE
    moves.push(
      finished
        ? { taskId: was, to: TaskStatus.DONE, from: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.WAITING] }
        : { taskId: was, to: TaskStatus.OPEN, from: [TaskStatus.IN_PROGRESS] }
    )
  }
  // Done too: starting a task the session ticked off is taking that back.
  if (is && is !== was)
    moves.push({
      taskId: is,
      to: TaskStatus.IN_PROGRESS,
      from: [TaskStatus.OPEN, TaskStatus.WAITING, TaskStatus.DONE],
      ...(before?.items.find((item) => item.taskId === is)?.outcome === SessionOutcome.DONE && { takesBack: true })
    })
  return moves
}
