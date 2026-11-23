import type { TaskId } from "@taxa/shared/ids"
import type { OpenedMemory } from "./opened-memory.ts"
import type { RowMenuEntry, RowMenuOpening } from "./row/row-menu-entry.ts"
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
import type { UndoActions } from "../../undo/undo-service.ts"
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
  /** The task the keyboard is on, if any. */
  highlighted: TaskId | undefined
  /** What's typed to find tasks in the list: only those it finds show. */
  search: string
  /** The row menu a key asked to open last. */
  opening: RowMenuOpening | undefined
  /** The task whose title is being edited in its row. */
  renaming: TaskId | undefined
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
  /** Undoes the tick or delete on offer, or else the tab's last change. */
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
  /** Notes that a task is being opened from the list, to highlight it again on coming back. */
  rememberOpened: (task: Task) => void
  /** Opens a task's row menu, whole or at one thing to change. */
  openRowMenu: (task: Task, entry: RowMenuEntry) => void
  /** Makes a task's title editable in its row, or none's. */
  rename: (task: Task | undefined) => void
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
  readonly #history: Pick<UndoActions, "undo" | "undoChange" | "isLatest">
  readonly #scheduler: Scheduler
  readonly #analytics: Analytics
  #cancelUndoOffer: (() => void) | undefined
  /** Whether this visit's search has been tracked: once is enough. */
  #searched = false

  readonly #opened: OpenedMemory | undefined

  /** With `opened`, the task last opened from the list starts highlighted, as you left it. */
  constructor(
    changes: TaskChangesActions,
    history: Pick<UndoActions, "undo" | "undoChange" | "isLatest">,
    scheduler: Scheduler,
    analytics: Analytics,
    opened?: OpenedMemory
  ) {
    super({
      ticked: {},
      pending: {},
      undoable: undefined,
      undoes: Undo.TICK,
      highlighted: opened?.recall(),
      search: "",
      opening: undefined,
      renaming: undefined
    })
    this.#changes = changes
    this.#history = history
    this.#scheduler = scheduler
    this.#analytics = analytics
    this.#opened = opened
  }

  /** Notes that a task is being opened from the list, to highlight it again on coming back. */
  readonly rememberOpened = (task: Task): void => {
    this.#opened?.remember(task.id)
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
    const { undoable: task, undoes } = this.state
    this.dismissUndo()
    // On offer only while it's the last change: after another, that's what undo takes back.
    if (!task || !this.#history.isLatest(task)) return this.#history.undo()
    if (undoes === Undo.DELETE) {
      await this.#history.undoChange(task)
      return
    }
    this.updateState((state) => ({ ...state, pending: { ...state.pending, [task.id]: false } }))
    const undone = await this.#history.undoChange(task)
    this.updateState((state) => ({
      ...state,
      pending: { ...state.pending, [task.id]: undefined },
      ticked: undone ? { ...state.ticked, [task.id]: undefined } : state.ticked
    }))
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

  readonly rename = (task: Task | undefined): void => {
    if (this.state.renaming !== task?.id) this.setState({ renaming: task?.id })
  }

  readonly openRowMenu = (task: Task, entry: RowMenuEntry): void =>
    this.setState({ opening: { taskId: task.id, entry, seq: (this.state.opening?.seq ?? 0) + 1 } })

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
      undoes: done ? Undo.TICK : state.undoes
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

/** What a key last asked of this task's row menu, if it was this task's. */
export const useRowMenuOpening = (task: Task): RowMenuOpening | undefined =>
  useServiceState(useService(ListSessionContext), (state) =>
    state.opening?.taskId === task.id ? state.opening : undefined
  )

export const useShownDone = (task: Task): boolean =>
  useServiceState(useService(ListSessionContext), (state) => isShownDone(state, task))

export const useHighlighted = (id: TaskId): boolean =>
  useServiceState(useService(ListSessionContext), (state) => state.highlighted === id)

export const useRenaming = (id: TaskId): boolean =>
  useServiceState(useService(ListSessionContext), (state) => state.renaming === id)

export const useCelebrated = (id: TaskId): boolean =>
  useServiceState(useService(ListSessionContext), (state) => isCelebrated(state, id))
