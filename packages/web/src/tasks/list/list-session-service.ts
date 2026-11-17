import type { TaskId } from "@taxa/shared/ids"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import type { Ms } from "@taxa/shared/units"
import { AbstractService } from "../../services/abstract-service.ts"
import type { Scheduler } from "../../services/scheduler.ts"
import { createServiceContext, useService, useServiceState } from "../../services/service-hooks.ts"
import { TaskChangeType, type TaskChangesActions } from "../changes/task-changes-service.ts"

/** How long the offer to undo a tick stays. */
export const UNDO_OFFERED_MS: Ms = 6000

/** Tasks ticked off here, by id. */
export type TickedTasks = Readonly<Partial<Record<TaskId, Task>>>

export interface ListSessionState {
  /** Ticked off since the list opened: they stay in place, ticked, until you leave. */
  ticked: TickedTasks
  /** What a box shows while the server hasn't answered yet: ticked or not. */
  pending: Readonly<Partial<Record<TaskId, boolean>>>
  /** The task ticked off last, with a chance to undo it. */
  undoable: Task | undefined
  /** The task the keyboard is on, if any. */
  highlighted: TaskId | undefined
}

/** Which way to move the highlight through the list. */
export enum Step {
  NEXT = "NEXT",
  PREVIOUS = "PREVIOUS"
}

export interface ListSessionActions {
  /** Ticks the task off, or unticks it, as its box shows it now. */
  toggle: (task: Task) => Promise<void>
  undo: () => Promise<void>
  dismissUndo: () => void
  /** Puts the highlight on a task, or takes it away. */
  highlight: (id: TaskId | undefined) => void
  /** Moves the highlight through the tasks shown, in order: from none, to the first or last. */
  moveHighlight: (shown: readonly TaskId[], step: Step) => void
  /** Files a task out of the list; if it's highlighted, the highlight goes on to the task after it. */
  file: (task: Task, request: UpdateTaskRequest, shown: readonly TaskId[]) => Promise<void>
  dispose: () => void
}

/** Whether a task's box shows it ticked. */
export const isShownDone = (state: ListSessionState, task: Task): boolean =>
  state.pending[task.id] ?? (state.ticked[task.id] !== undefined || task.status === TaskStatus.DONE)

/** Whether it was ticked here and now, and deserves a little celebration. */
export const isCelebrated = (state: ListSessionState, id: TaskId): boolean =>
  state.pending[id] === true || (state.pending[id] === undefined && state.ticked[id] !== undefined)

/** One visit to a list: what's been ticked off on it, and the chance to take a tick back. */
export class ListSessionService extends AbstractService<ListSessionState> implements ListSessionActions {
  readonly #changes: TaskChangesActions
  readonly #scheduler: Scheduler
  #cancelUndoOffer: (() => void) | undefined

  constructor(changes: TaskChangesActions, scheduler: Scheduler) {
    super({ ticked: {}, pending: {}, undoable: undefined, highlighted: undefined })
    this.#changes = changes
    this.#scheduler = scheduler
  }

  readonly toggle = async (task: Task): Promise<void> => {
    await this.#setStatus(task, isShownDone(this.state, task) ? TaskStatus.OPEN : TaskStatus.DONE)
  }

  readonly undo = async (): Promise<void> => {
    const task = this.state.undoable
    if (!task) return
    this.dismissUndo()
    await this.#setStatus(task, TaskStatus.OPEN)
  }

  readonly dismissUndo = (): void => {
    this.#cancelUndoOffer?.()
    this.#cancelUndoOffer = undefined
    if (this.state.undoable) this.setState({ undoable: undefined })
  }

  readonly highlight = (id: TaskId | undefined): void => {
    if (this.state.highlighted !== id) this.setState({ highlighted: id })
  }

  readonly moveHighlight = (shown: readonly TaskId[], step: Step): void => {
    const index = this.state.highlighted === undefined ? -1 : shown.indexOf(this.state.highlighted)
    const next =
      index === -1
        ? step === Step.NEXT
          ? 0
          : shown.length - 1
        : Math.min(Math.max(index + (step === Step.NEXT ? 1 : -1), 0), shown.length - 1)
    this.highlight(shown[next])
  }

  readonly file = async (task: Task, request: UpdateTaskRequest, shown: readonly TaskId[]): Promise<void> => {
    if (this.state.highlighted === task.id) {
      const others = shown.filter((id) => id !== task.id)
      this.highlight(others[Math.min(shown.indexOf(task.id), others.length - 1)])
    }
    await this.#changes.change(task, { type: TaskChangeType.UPDATE, request })
  }

  readonly dispose = (): void => {
    this.#cancelUndoOffer?.()
    this.#cancelUndoOffer = undefined
  }

  async #setStatus(task: Task, status: TaskStatus.OPEN | TaskStatus.DONE): Promise<void> {
    const done = status === TaskStatus.DONE
    // Kept in the list from the tick: the server's answer refreshes the list, without it, before it comes back.
    this.updateState((state) => ({
      ...state,
      pending: { ...state.pending, [task.id]: done },
      ticked: done ? { ...state.ticked, [task.id]: state.ticked[task.id] ?? task } : state.ticked
    }))
    const changed = await this.#changes.change(task, { type: TaskChangeType.STATUS, request: { status } })
    this.updateState((state) => ({ ...state, pending: { ...state.pending, [task.id]: undefined } }))
    if (!changed) {
      if (done) this.updateState((state) => ({ ...state, ticked: { ...state.ticked, [task.id]: undefined } }))
      return
    }
    this.updateState((state) => ({
      ...state,
      ticked: { ...state.ticked, [task.id]: done ? changed : undefined },
      undoable: done ? changed : state.undoable?.id === task.id ? undefined : state.undoable
    }))
    if (done) this.#offerUndo()
  }

  #offerUndo(): void {
    this.#cancelUndoOffer?.()
    this.#cancelUndoOffer = this.#scheduler.after(UNDO_OFFERED_MS, this.dismissUndo)
  }
}

export const ListSessionContext = createServiceContext<ListSessionService>()

export const useListSession = (): ListSessionActions => useService(ListSessionContext)

export const useShownDone = (task: Task): boolean =>
  useServiceState(useService(ListSessionContext), (state) => isShownDone(state, task))

export const useHighlighted = (id: TaskId): boolean =>
  useServiceState(useService(ListSessionContext), (state) => state.highlighted === id)

export const useCelebrated = (id: TaskId): boolean =>
  useServiceState(useService(ListSessionContext), (state) => isCelebrated(state, id))
