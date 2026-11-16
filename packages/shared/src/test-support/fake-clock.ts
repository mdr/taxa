import type { Instant, Ms } from "../units.ts"
import type { Clock } from "../clock.ts"

interface Timer {
  at: Instant
  callback: () => void
}

/**
 * A time that moves only when advanced. Timers fire only when `advance`
 * passes them, so a test decides when deadlines come.
 */
export class FakeClock implements Clock {
  #now: Instant
  #sequence = 0
  readonly #pending = new Map<number, Timer>()

  constructor(startAt: Instant) {
    this.#now = startAt
  }

  now(): Instant {
    return this.#now
  }

  setTimeout(callback: () => void, delay: Ms): number {
    const id = ++this.#sequence
    this.#pending.set(id, { at: this.#now + delay, callback })
    return id
  }

  clearTimeout(handle: unknown): void {
    if (typeof handle === "number") this.#pending.delete(handle)
  }

  /** Jump forward, firing everything now due in order. */
  advance(time: Ms): void {
    this.#now += time
    const due = [...this.#pending.entries()]
      .filter(([, timer]) => timer.at <= this.#now)
      .sort(([, a], [, b]) => a.at - b.at)
    for (const [id, timer] of due) {
      this.#pending.delete(id)
      timer.callback()
    }
  }
}
