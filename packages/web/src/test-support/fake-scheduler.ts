import type { Ms } from "@taxa/shared/units"
import type { Scheduler } from "../services/scheduler.ts"

/** Time that passes only when the test says. */
export class FakeScheduler implements Scheduler {
  #now: Ms = 0
  #waiting: { at: Ms; run: () => void }[] = []

  readonly after = (wait: Ms, run: () => void): (() => void) => {
    const entry = { at: this.#now + wait, run }
    this.#waiting.push(entry)
    return () => {
      this.#waiting = this.#waiting.filter((waiting) => waiting !== entry)
    }
  }

  get waiting(): number {
    return this.#waiting.length
  }

  advance(time: Ms): void {
    this.#now += time
    const due = this.#waiting.filter(({ at }) => at <= this.#now)
    this.#waiting = this.#waiting.filter(({ at }) => at > this.#now)
    for (const { run } of due) run()
  }
}
