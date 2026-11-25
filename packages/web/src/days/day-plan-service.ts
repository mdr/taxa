import type { TaxaClient } from "@taxa/shared/api/taxa-client"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { TaskId } from "@taxa/shared/ids"
import type { Task } from "@taxa/shared/tasks/task"
import { OccurrenceOutcome } from "@taxa/shared/tasks/repeat"
import { When, whenRequest } from "@taxa/shared/tasks/when"
import { problemMessage } from "../api/problem-message.ts"
import { AbstractService } from "../services/abstract-service.ts"
import { addEntry, DEFAULT_MINUTES, moveEntry, removeEntry } from "../sessions/plan/plan-edits.ts"
import type { PlannedEntry } from "../sessions/plan/session-plan-service.ts"
import { TaskChangeType, type TaskChange, type TaskChangesActions } from "../tasks/changes/task-changes-service.ts"
import type { Analytics } from "../telemetry/analytics.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"

/** What planning a day asks of the API. */
export type DayPlanApi = Pick<TaxaClient, "setDayPlan">

export interface DayPlanState {
  /** Today's tasks in order, once known. */
  entries: readonly PlannedEntry[] | undefined
  search: string
  problem: string | undefined
}

const entryOf = (task: Task): PlannedEntry => ({
  taskId: task.id,
  task,
  minutes: task.estimateMinutes ?? DEFAULT_MINUTES
})

/**
 * Today's tasks being chosen and put in order. Putting one in plans it for
 * today; taking one out leaves it for soon. Each change is saved as it's made.
 */
export class DayPlanService extends AbstractService<DayPlanState> {
  readonly #api: DayPlanApi
  readonly #changes: Pick<TaskChangesActions, "change">
  readonly #analytics: Analytics
  readonly #today: IsoDate
  readonly #saved: () => Promise<void>
  #saving: Promise<void> = Promise.resolve()
  /** Tasks being put in or taken out here: until that's saved, a list of today's tasks may not show it yet. */
  readonly #moving = new Set<TaskId>()
  /** Where each task that's left the plan was: the task after it, to go back before if it comes back, as undoing that does. */
  readonly #places = new Map<TaskId, TaskId | undefined>()

  constructor(
    api: DayPlanApi,
    changes: Pick<TaskChangesActions, "change">,
    analytics: Analytics,
    today: IsoDate,
    /** The order's been saved: lists showing today's tasks should look again. */
    saved: () => Promise<void>
  ) {
    super({ entries: undefined, search: "", problem: undefined })
    this.#api = api
    this.#changes = changes
    this.#analytics = analytics
    this.#today = today
    this.#saved = saved
  }

  /**
   * Today's tasks as the server lists them, in the plan's order: the plan to
   * start from, then what's changed since, wherever it changed (an undo, or
   * another tab). A task no longer today leaves the plan, and one now today
   * joins it, back where it was if it had been in it, or at the end; but not
   * one being put in or taken out here.
   */
  readonly showToday = (tasks: readonly Task[]): void => {
    const { entries } = this.state
    if (entries === undefined) {
      this.setState({ entries: tasks.map(entryOf) })
      return
    }
    const latest = new Map(tasks.map((task) => [task.id, task]))
    const planned = new Set(entries.map(({ taskId }) => taskId))
    const kept = entries.flatMap((entry) => {
      const task = latest.get(entry.taskId)
      if (task) return [entryOf(task)]
      if (this.#moving.has(entry.taskId)) return [entry]
      this.#notePlace(entry.taskId)
      return []
    })
    const joining = tasks.filter(({ id }) => !planned.has(id) && !this.#moving.has(id))
    this.setState({ entries: joining.reduce((plan, task) => this.#placed(plan, task), kept) })
    if (joining.length > 0) this.#save()
  }

  #notePlace(taskId: TaskId): void {
    const entries = this.state.entries ?? []
    this.#places.set(taskId, entries[entries.findIndex((entry) => entry.taskId === taskId) + 1]?.taskId)
  }

  #placed(plan: readonly PlannedEntry[], task: Task): PlannedEntry[] {
    const before = plan.findIndex(({ taskId }) => taskId === this.#places.get(task.id))
    return addEntry(plan, entryOf(task), before < 0 ? plan.length : before)
  }

  /** Makes a change to a task being put in or taken out, the plan following today's tasks again once it's done. */
  async #moved(task: Task, change: TaskChange): Promise<Task | undefined> {
    this.#moving.add(task.id)
    try {
      return await this.#changes.change(task, change)
    } finally {
      this.#moving.delete(task.id)
    }
  }

  readonly search = (search: string): void => this.setState({ search })

  /** Plans a task for today, at a place among the rest, or last. */
  readonly add = async (task: Task, at?: number): Promise<void> => {
    this.setState({ entries: addEntry(this.state.entries ?? [], entryOf(task), at), problem: undefined })
    this.#save()
    this.#analytics.track(ANALYTICS_CODES.today.taskPlanned, `planned ${task.ref} for today`, {
      taskId: task.id,
      taskRef: task.ref
    })
    const changed = await this.#moved(task, {
      type: TaskChangeType.UPDATE,
      request: whenRequest(When.TODAY, this.#today)
    })
    if (changed === undefined) {
      this.setState({
        entries: removeEntry(this.state.entries ?? [], task.id),
        problem: `${task.title} couldn't be planned for today.`
      })
      this.#save()
    }
  }

  /** Not today after all: it's left for soon; a repeating task, skipped this time. */
  readonly remove = async (taskId: TaskId): Promise<void> => {
    const entry = this.state.entries?.find((planned) => planned.taskId === taskId)
    if (!entry) return
    this.#notePlace(taskId)
    this.setState({ entries: removeEntry(this.state.entries ?? [], taskId), problem: undefined })
    this.#save()
    this.#analytics.track(ANALYTICS_CODES.today.taskUnplanned, `took ${entry.task.ref} out of today`, {
      taskId,
      taskRef: entry.task.ref
    })
    await this.#moved(
      entry.task,
      entry.task.repeat
        ? { type: TaskChangeType.OCCURRENCE, request: { outcome: OccurrenceOutcome.SKIPPED } }
        : { type: TaskChangeType.UPDATE, request: whenRequest(When.SOON, this.#today) }
    )
  }

  readonly move = (taskId: TaskId, to: number): void => {
    this.setState({ entries: moveEntry(this.state.entries ?? [], taskId, to), problem: undefined })
    this.#save()
    this.#analytics.track(ANALYTICS_CODES.today.reordered, "reordered today", { taskId, to })
  }

  /** A task's estimate has changed, and been saved. */
  readonly estimated = (task: Task): void =>
    this.setState({
      entries: this.state.entries?.map((entry) => (entry.taskId === task.id ? entryOf(task) : entry))
    })

  /** Saves the order, after any save still going. */
  #save(): void {
    const taskIds = (this.state.entries ?? []).map(({ taskId }) => taskId)
    this.#saving = this.#saving.then(async () => {
      try {
        await this.#api.setDayPlan(this.#today, { taskIds })
        await this.#saved()
      } catch (error) {
        this.setState({ problem: `Today's order couldn't be saved: ${problemMessage(error)}` })
      }
    })
  }

  /** Once every save so far is done. */
  readonly saved = (): Promise<void> => this.#saving
}
