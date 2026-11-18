import type { TaskId } from "@taxa/shared/ids"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import type { Ms } from "@taxa/shared/units"
import { AbstractService } from "../../services/abstract-service.ts"
import type { Scheduler } from "../../services/scheduler.ts"
import { createServiceContext, useService, useServiceState } from "../../services/service-hooks.ts"
import { TaskChangeType, type TaskChangesActions } from "../changes/task-changes-service.ts"
import { startedOrStopped } from "../in-progress.ts"
import type { Analytics } from "../../telemetry/analytics.ts"
import type { ChangeStatusRequest } from "@taxa/shared/tasks/task-requests"
import { restoringStatus } from "./restore-status.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"

/** How long the offer to undo a tick stays. */
export const UNDO_OFFERED_MS: Ms = 6000

/** What the offer to undo would take back. */
export enum Undo {
  TICK = "TICK",
  DELETE = "DELETE"
}

/** Tasks ticked off here, by id. */
export type TickedTasks = Readonly<Partial<Record<TaskId, Task>>>

export interface ListSessionState {
  /** Ticked off since the list opened: they stay in place, ticked, until you leave. */
  ticked: TickedTasks
  /** What a box shows while the server hasn't answered yet: ticked or not. */
  pending: Readonly<Partial<Record<TaskId, boolean>>>
  /** The task ticked off or deleted last, with a chance to undo it. */
  undoable: Task | undefined
  /** Which of those it was. */
  undoes: Undo
  /** A task ticked off, as it was before: what undoing the tick puts back. */
  before: Task | undefined
  /** The task the keyboard is on, if any. */
  highlighted: TaskId | undefined
  /** What's typed to find tasks in the list: only those it finds show. */
  search: string
}

/** Which way to move the highlight through the list. */
export enum Step {
  NEXT = "NEXT",
  PREVIOUS = "PREVIOUS"
}

export interface ListSessionActions {
  /** Ticks the task off, or unticks it, as its box shows it now. */
  toggle: (task: Task) => Promise<void>
  /** Starts working on a task, or stops if it's in progress. */
  startOrStop: (task: Task) => Promise<void>
  undo: () => Promise<void>
  /** Marks a task done, with a chance to undo it, as a tick does. */
  complete: (task: Task) => Promise<void>
  /** Deletes a task, with a chance to undo it; if it's highlighted, the highlight goes on to the task after it. */
  delete: (task: Task, shown: readonly TaskId[]) => Promise<void>
  dismissUndo: () => void
  /** Puts the highlight on a task, or takes it away. */
  highlight: (id: TaskId | undefined) => void
  /** Moves the highlight through the tasks shown, in order: from none, to the first or last. */
  moveHighlight: (shown: readonly TaskId[], step: Step) => void
  /** Finds tasks in the list by words in their titles or notes; nothing typed shows them all. */
  search: (text: string) => void
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
  readonly #analytics: Analytics
  #cancelUndoOffer: (() => void) | undefined
  /** Whether this visit's search has been tracked: once is enough. */
  #searched = false

  constructor(changes: TaskChangesActions, scheduler: Scheduler, analytics: Analytics) {
    super({
      ticked: {},
      pending: {},
      undoable: undefined,
      undoes: Undo.TICK,
      before: undefined,
      highlighted: undefined,
      search: ""
    })
    this.#changes = changes
    this.#scheduler = scheduler
    this.#analytics = analytics
  }

  readonly search = (text: string): void => {
    if (this.state.search === "" && text.trim() !== "" && !this.#searched) {
      this.#searched = true
      this.#analytics.track(ANALYTICS_CODES.list.searched, "searched a list")
    }
    this.setState({ search: text })
  }

  readonly toggle = async (task: Task): Promise<void> => {
    await this.#setStatus(task, { status: isShownDone(this.state, task) ? TaskStatus.OPEN : TaskStatus.DONE })
  }

  /** Marks it done, with a chance to undo it, as a tick does. */
  readonly complete = async (task: Task): Promise<void> => {
    await this.#setStatus(task, { status: TaskStatus.DONE })
  }

  readonly startOrStop = async (task: Task): Promise<void> => {
    const status = startedOrStopped(task.status)
    if (status) await this.#changes.change(task, { type: TaskChangeType.STATUS, request: { status } })
  }

  readonly undo = async (): Promise<void> => {
    const { undoable: task, undoes, before } = this.state
    if (!task) return
    this.dismissUndo()
    if (undoes === Undo.DELETE) {
      this.#analytics.track(ANALYTICS_CODES.task.undone, `undid deleting ${task.ref}`, { taskId: task.id, undoes })
      await this.#changes.change(task, { type: TaskChangeType.RESTORE })
      return
    }
    this.#analytics.track(ANALYTICS_CODES.task.undone, `undid ticking off ${task.ref}`, { taskId: task.id, undoes })
    await this.#setStatus(task, before ? restoringStatus(before) : { status: TaskStatus.OPEN })
  }

  readonly delete = async (task: Task, shown: readonly TaskId[]): Promise<void> => {
    this.#highlightPast(task.id, shown)
    const deleted = await this.#changes.change(task, { type: TaskChangeType.DELETE })
    if (!deleted) return
    this.setState({ undoable: deleted, undoes: Undo.DELETE })
    this.#offerUndo()
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
    this.#highlightPast(task.id, shown)
    await this.#changes.change(task, { type: TaskChangeType.UPDATE, request })
  }

  /** A task's leaving the list: if it's highlighted, the highlight goes on to the task after it. */
  #highlightPast(id: TaskId, shown: readonly TaskId[]): void {
    if (this.state.highlighted !== id) return
    const others = shown.filter((other) => other !== id)
    this.highlight(others[Math.min(shown.indexOf(id), others.length - 1)])
  }

  readonly dispose = (): void => {
    this.#cancelUndoOffer?.()
    this.#cancelUndoOffer = undefined
  }

  async #setStatus(task: Task, request: ChangeStatusRequest): Promise<void> {
    const done = request.status === TaskStatus.DONE
    // Kept in the list from the tick: the server's answer refreshes the list, without it, before it comes back.
    this.updateState((state) => ({
      ...state,
      pending: { ...state.pending, [task.id]: done },
      ticked: done ? { ...state.ticked, [task.id]: state.ticked[task.id] ?? task } : state.ticked
    }))
    const changed = await this.#changes.change(task, { type: TaskChangeType.STATUS, request })
    this.updateState((state) => ({ ...state, pending: { ...state.pending, [task.id]: undefined } }))
    if (!changed) {
      if (done) this.updateState((state) => ({ ...state, ticked: { ...state.ticked, [task.id]: undefined } }))
      return
    }
    this.updateState((state) => ({
      ...state,
      ticked: { ...state.ticked, [task.id]: done ? changed : undefined },
      undoable: done ? changed : state.undoable?.id === task.id ? undefined : state.undoable,
      undoes: done ? Undo.TICK : state.undoes,
      before: done ? task : state.before
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
