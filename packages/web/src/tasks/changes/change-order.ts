import type { TaskId } from "@taxa/shared/ids"

/**
 * The order the tab's changes reach the server in, however slowly it answers.
 * Changes to one task go one at a time. An undo or redo waits for every
 * change asked for before it, answered or not, so it takes back the last one
 * asked for; and every change asked for after it waits for it, so builds on
 * what it did.
 */
export class ChangeOrder {
  /** Each task's last change, which its next waits for. */
  readonly #tasks = new Map<TaskId, Promise<unknown>>()
  /** Everything asked for and not yet answered. */
  readonly #unanswered = new Set<Promise<unknown>>()
  /** The last undo or redo, which everything after it waits for. */
  #undo: Promise<unknown> = Promise.resolve()

  /** A change to a task, after its earlier ones and any undo before it. */
  readonly change = <T>(id: TaskId, make: () => Promise<T>): Promise<T> => {
    const made = Promise.allSettled([this.#tasks.get(id), this.#undo]).then(make)
    this.#tasks.set(id, made)
    return this.#track(made)
  }

  /** A task added, after any undo before it. */
  readonly add = <T>(make: () => Promise<T>): Promise<T> => this.#track(Promise.allSettled([this.#undo]).then(make))

  /** An undo or redo: after everything asked for before it, and before everything after. */
  readonly undo = <T>(make: () => Promise<T>): Promise<T> => {
    const made = Promise.allSettled([...this.#unanswered, this.#undo]).then(make)
    this.#undo = made
    return this.#track(made)
  }

  #track<T>(made: Promise<T>): Promise<T> {
    this.#unanswered.add(made)
    const answered = (): void => void this.#unanswered.delete(made)
    made.then(answered, answered)
    return made
  }
}
