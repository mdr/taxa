import type { TaskId } from "@taxa/shared/ids"
import type { Task } from "@taxa/shared/tasks/task"
import type { Ms, Version } from "@taxa/shared/units"
import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import { problemMessage } from "../api/problem-message.ts"
import { AbstractService } from "../services/abstract-service.ts"
import type { Scheduler } from "../services/scheduler.ts"
import { createServiceContext, useService, useServiceState } from "../services/service-hooks.ts"
import type { ChangeOrder } from "../tasks/changes/change-order.ts"
import type { TaskCache } from "../tasks/changes/task-cache.ts"
import type { ChangeHistory, TaskChange } from "../tasks/changes/task-changes-service.ts"
import { addedLabel, changedLabel, changeLabel } from "./change-label.ts"
import type { Analytics } from "../telemetry/analytics.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"

/** How long the notice of an undo stays. */
export const UNDO_NOTICE_MS: Ms = 6000

/** How many changes back undo can go. */
const HISTORY = 100

export interface UndoApi {
  undoTask: (ref: string, version: Version) => Promise<Task>
}

/** A change that can be undone, or redone: the version it brought its task to. */
interface Step {
  taskId: TaskId
  version: Version
  label: string
}

export enum NoticeType {
  UNDONE = "UNDONE",
  REDONE = "REDONE",
  REFUSED = "REFUSED"
}

export interface UndoNotice {
  type: NoticeType
  text: string
}

export interface UndoState {
  /** Changes made here, oldest first: undo takes back the last. */
  undoable: readonly Step[]
  /** Changes undone, oldest first: redo puts back the last. */
  redoable: readonly Step[]
  notice: UndoNotice | undefined
}

/** A change undone or redone: the version it had brought its task to, and the task now. */
export interface Undone {
  taskId: TaskId
  version: Version
  task: Task
}

export interface UndoActions extends ChangeHistory {
  /** Adds a task, in turn with the tab's other changes, noting it to undo. */
  add: (adding: () => Promise<Task>) => Promise<Task>
  /** Undoes the last change asked for here, once it's been answered; what that was, unless there was none or it was refused. */
  undo: () => Promise<Undone | undefined>
  redo: () => Promise<Undone | undefined>
  /** Undoes the change that brought a task to a version, by default the one it's at, whether made here or not; the task then, or undefined if refused. */
  undoChange: (task: Task, version?: Version) => Promise<Task | undefined>
  dismiss: () => void
  /** Whether the change that brought a task to its version is the last made here, which undo would take back. */
  isLatest: (task: Task) => boolean
}

const isLatestIn = ({ undoable }: UndoState, task: Task): boolean => {
  const last = undoable.at(-1)
  return last?.taskId === task.id && last.version === task.version
}

/**
 * Undo and redo for every change made in this tab, through the server, which
 * takes back the change that brought a task to a version: so an undo is a
 * change too, and the history survives changes made elsewhere in between,
 * unless they changed what's being undone.
 */
export class UndoService extends AbstractService<UndoState> implements UndoActions {
  readonly #api: UndoApi
  readonly #cache: TaskCache
  readonly #analytics: Analytics
  readonly #scheduler: Scheduler
  readonly #order: ChangeOrder
  #cancelNotice: (() => void) | undefined

  constructor(api: UndoApi, cache: TaskCache, analytics: Analytics, scheduler: Scheduler, order: ChangeOrder) {
    super({ undoable: [], redoable: [], notice: undefined })
    this.#api = api
    this.#order = order
    this.#cache = cache
    this.#analytics = analytics
    this.#scheduler = scheduler
  }

  readonly recordChange = (task: Task, change: TaskChange): void => this.#record(task, changeLabel(change, task))

  readonly add = (adding: () => Promise<Task>): Promise<Task> =>
    this.#order.add(async () => {
      const task = await adding()
      this.#record(task, addedLabel(task))
      return task
    })

  #record(task: Task, label: string): void {
    // What an undo did is old news once something else changes.
    this.dismiss()
    this.setState({
      undoable: [...this.state.undoable, { taskId: task.id, version: task.version, label }].slice(-HISTORY),
      redoable: []
    })
  }

  readonly undo = (): Promise<Undone | undefined> =>
    this.#order.undo(async () => {
      const step = this.state.undoable.at(-1)
      return step && this.#undone(step, await this.#take(step, true))
    })

  readonly redo = (): Promise<Undone | undefined> =>
    this.#order.undo(async () => {
      const step = this.state.redoable.at(-1)
      return step && this.#undone(step, await this.#take(step, false))
    })

  readonly undoChange = (task: Task, version: Version = task.version): Promise<Task | undefined> =>
    this.#order.undo(() => {
      const step = this.state.undoable.find((other) => other.taskId === task.id && other.version === version)
      return this.#take(step ?? { taskId: task.id, version, label: changedLabel(task) }, true)
    })

  #undone({ taskId, version }: Step, task: Task | undefined): Undone | undefined {
    return task && { taskId, version, task }
  }

  readonly dismiss = (): void => {
    this.#cancelNotice?.()
    this.#cancelNotice = undefined
    if (this.state.notice) this.setState({ notice: undefined })
  }

  readonly isLatest = (task: Task): boolean => isLatestIn(this.state, task)

  readonly dispose = (): void => this.#cancelNotice?.()

  /**
   * Undoes a step, or redoes one: either way, the server undoes the change
   * that brought its task to its version. Never rejects. If the server's never
   * reached, the step stays where it was, to try again.
   */
  async #take(step: Step, undoing: boolean): Promise<Task | undefined> {
    const without = (steps: readonly Step[]): Step[] => steps.filter((other) => other !== step)
    const { undoable, redoable } = this.state
    this.setState({ undoable: without(undoable), redoable: without(redoable) })
    try {
      const task = await this.#api.undoTask(step.taskId, step.version)
      await this.#cache.show(task)
      const next = { ...step, version: task.version }
      this.setState(
        undoing ? { redoable: [...this.state.redoable, next] } : { undoable: [...this.state.undoable, next] }
      )
      this.#analytics.track(
        undoing ? ANALYTICS_CODES.task.undone : ANALYTICS_CODES.task.redone,
        `${undoing ? "undid" : "redid"} a change to ${task.ref}`,
        { taskId: task.id, taskRef: task.ref }
      )
      this.#notify(
        undoing
          ? { type: NoticeType.UNDONE, text: `Undid: ${step.label}` }
          : { type: NoticeType.REDONE, text: `Redid: ${step.label}` }
      )
      return task
    } catch (error) {
      if (!(error instanceof TaxaApiError))
        this.setState({
          undoable: undoable.includes(step) ? [...undoable] : this.state.undoable,
          redoable: redoable.includes(step) ? [...redoable] : this.state.redoable
        })
      this.#notify({ type: NoticeType.REFUSED, text: problemMessage(error) })
      return undefined
    }
  }

  #notify(notice: UndoNotice): void {
    this.#cancelNotice?.()
    this.setState({ notice })
    this.#cancelNotice = this.#scheduler.after(UNDO_NOTICE_MS, () => {
      this.#cancelNotice = undefined
      this.setState({ notice: undefined })
    })
  }
}

export const UndoContext = createServiceContext<UndoService>()

export const useUndo = (): UndoActions => useService(UndoContext)

export const useIsLatestChange = (task: Task): boolean =>
  useServiceState(useService(UndoContext), (state) => isLatestIn(state, task))

export const useUndoNotice = (): UndoNotice | undefined =>
  useServiceState(useService(UndoContext), ({ notice }) => notice)
