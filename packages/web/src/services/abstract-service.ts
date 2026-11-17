type Listener = () => void

/**
 * A service owns a piece of the app's state and every action that changes
 * it, side effects included; components read its state through a selector
 * and call its actions. Actions are arrow-function fields, so they keep
 * `this` when destructured. Writes made together notify listeners once, after
 * the current task, so no reader sees a state halfway through an action.
 */
export abstract class AbstractService<State> {
  #state: State
  readonly #listeners = new Set<Listener>()
  #notifying = false

  protected constructor(initial: State) {
    this.#state = initial
  }

  get state(): State {
    return this.#state
  }

  /** Hears of changes to the state; returns how to stop. */
  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  protected setState(changes: Partial<State>): void {
    this.updateState((state) => ({ ...state, ...changes }))
  }

  protected updateState(next: (state: State) => State): void {
    this.#state = next(this.#state)
    if (this.#notifying) return
    this.#notifying = true
    queueMicrotask(() => {
      this.#notifying = false
      for (const listener of [...this.#listeners]) listener()
    })
  }
}
