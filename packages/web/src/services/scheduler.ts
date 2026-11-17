import type { Ms } from "@taxa/shared/units"

/** Runs something later; what it returns cancels it. A service takes one, so tests decide when later is. */
export interface Scheduler {
  after: (wait: Ms, run: () => void) => () => void
}

export const realScheduler: Scheduler = {
  after: (wait, run) => {
    const timer = setTimeout(run, wait)
    return () => clearTimeout(timer)
  }
}
