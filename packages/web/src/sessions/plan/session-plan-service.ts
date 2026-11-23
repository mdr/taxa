import type { Clock } from "@taxa/shared/clock"
import type { TaskId } from "@taxa/shared/ids"
import type { Session } from "@taxa/shared/sessions/session"
import type { Task } from "@taxa/shared/tasks/task"
import type { Minutes } from "@taxa/shared/units"
import { problemMessage } from "../../api/problem-message.ts"
import { AbstractService } from "../../services/abstract-service.ts"
import { createServiceContext } from "../../services/service-hooks.ts"
import type { Analytics } from "../../telemetry/analytics.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import type { SessionApi } from "../session-api.ts"
import { addEntry, DEFAULT_MINUTES, moveEntry, removeEntry, totalMinutes } from "./plan-edits.ts"
import { DEFAULT_WINDOW, endsAtFor, type SessionWindow } from "./session-window.ts"

export enum PlanStep {
  /** Saying how long there is. */
  WINDOW = "WINDOW",
  /** Choosing the tasks to fill it. */
  TASKS = "TASKS"
}

export interface PlannedEntry {
  taskId: TaskId
  task: Task
  minutes: Minutes
}

export interface SessionPlanState {
  step: PlanStep
  window: SessionWindow
  entries: readonly PlannedEntry[]
  search: string
  /** Suggestions only with this tag, if one's chosen. */
  tag: string | undefined
  starting: boolean
  problem: string | undefined
}

const NEW_PLAN: SessionPlanState = {
  step: PlanStep.WINDOW,
  window: DEFAULT_WINDOW,
  entries: [],
  search: "",
  tag: undefined,
  starting: false,
  problem: undefined
}

/** A session being planned, before it starts: how long, and what to do in it. */
export class SessionPlanService extends AbstractService<SessionPlanState> {
  readonly #api: SessionApi
  readonly #clock: Clock
  readonly #analytics: Analytics
  readonly #started: (session: Session) => void

  constructor(api: SessionApi, clock: Clock, analytics: Analytics, started: (session: Session) => void) {
    super(NEW_PLAN)
    this.#api = api
    this.#clock = clock
    this.#analytics = analytics
    this.#started = started
  }

  readonly chooseWindow = (window: SessionWindow): void => this.setState({ window, problem: undefined })

  /** On to choosing tasks, if the time chosen is still to come. */
  readonly toTasks = (): void => {
    if (endsAtFor(this.state.window, this.#clock.now()) === undefined)
      this.setState({ problem: "That time's passed today: choose a later one." })
    else this.setState({ step: PlanStep.TASKS, problem: undefined })
  }

  readonly toWindow = (): void => this.setState({ step: PlanStep.WINDOW, problem: undefined })

  /** Adds a task to the plan, at the end or at a place; for its estimate, or half an hour. */
  readonly add = (task: Task, at?: number): void =>
    this.setState({
      entries: addEntry(
        this.state.entries,
        { taskId: task.id, task, minutes: task.estimateMinutes ?? DEFAULT_MINUTES },
        at
      )
    })

  readonly remove = (taskId: TaskId): void => this.setState({ entries: removeEntry(this.state.entries, taskId) })

  readonly move = (taskId: TaskId, to: number): void =>
    this.setState({ entries: moveEntry(this.state.entries, taskId, to) })

  /** A planned task's estimate has changed: it takes that long in the plan, or half an hour while it has none. */
  readonly estimated = (task: Task): void =>
    this.setState({
      entries: this.state.entries.map((entry) =>
        entry.taskId === task.id ? { ...entry, task, minutes: task.estimateMinutes ?? DEFAULT_MINUTES } : entry
      )
    })

  /** The tasks there are now: a planned one no longer among them (deleted, or finished elsewhere) comes out of the plan. */
  readonly tasksAre = (tasks: readonly Task[]): void => {
    const there = new Set(tasks.map(({ id }) => id))
    const entries = this.state.entries.filter(({ taskId }) => there.has(taskId))
    if (entries.length !== this.state.entries.length) this.setState({ entries })
  }

  readonly search = (search: string): void => this.setState({ search })

  readonly filterByTag = (tag: string | undefined): void => this.setState({ tag })

  /** Starts the session now, on the first task planned. */
  readonly start = async (): Promise<void> => {
    const { window, entries, starting } = this.state
    if (starting) return
    const now = this.#clock.now()
    const endsAt = endsAtFor(window, now)
    if (endsAt === undefined) {
      this.setState({ problem: "That time's passed today: choose a later one." })
      return
    }
    this.setState({ starting: true, problem: undefined })
    try {
      const session = await this.#api.createSession(
        {
          endsAt: new Date(endsAt).toISOString(),
          items: entries.map(({ taskId, minutes }) => ({ taskId, minutes })),
          start: entries[0]?.taskId
        },
        crypto.randomUUID()
      )
      this.#analytics.track(ANALYTICS_CODES.session.started, "started a session", {
        sessionId: session.id,
        tasks: entries.length,
        plannedMinutes: totalMinutes(entries),
        windowMinutes: Math.round((endsAt - now) / 60_000)
      })
      // Started: the next plan begins afresh.
      this.setState(NEW_PLAN)
      this.#started(session)
    } catch (error) {
      this.setState({ starting: false, problem: problemMessage(error) })
    }
  }
}
export const SessionPlanContext = createServiceContext<SessionPlanService>()
