import type { TaxaClient } from "@taxa/shared/api/taxa-client"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { TaskId } from "@taxa/shared/ids"
import type { Task } from "@taxa/shared/tasks/task"
import { When, whenRequest } from "@taxa/shared/tasks/when"
import { problemMessage } from "../api/problem-message.ts"
import { AbstractService } from "../services/abstract-service.ts"
import { addEntry, DEFAULT_MINUTES, moveEntry, removeEntry } from "../sessions/plan/plan-edits.ts"
import type { PlannedEntry } from "../sessions/plan/session-plan-service.ts"
import { TaskChangeType, type TaskChangesActions } from "../tasks/changes/task-changes-service.ts"
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

  /** Today's tasks as the server lists them, in the plan's order: the plan to start from, then newer copies of its tasks. */
  readonly showToday = (tasks: readonly Task[]): void => {
    const { entries } = this.state
    if (entries === undefined) {
      this.setState({ entries: tasks.map(entryOf) })
      return
    }
    const latest = new Map(tasks.map((task) => [task.id, task]))
    this.setState({
      entries: entries.map((entry) => {
        const task = latest.get(entry.taskId)
        return task ? entryOf(task) : entry
      })
    })
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
    const changed = await this.#changes.change(task, {
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

  /** Not today after all: it's left for soon. */
  readonly remove = async (taskId: TaskId): Promise<void> => {
    const entry = this.state.entries?.find((planned) => planned.taskId === taskId)
    if (!entry) return
    this.setState({ entries: removeEntry(this.state.entries ?? [], taskId), problem: undefined })
    this.#save()
    this.#analytics.track(ANALYTICS_CODES.today.taskUnplanned, `took ${entry.task.ref} out of today`, {
      taskId,
      taskRef: entry.task.ref
    })
    await this.#changes.change(entry.task, {
      type: TaskChangeType.UPDATE,
      request: whenRequest(When.SOON, this.#today)
    })
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
