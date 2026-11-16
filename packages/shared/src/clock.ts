import type { Instant, Ms } from "./units.ts"

/** Injected clock so tests can drive time: nothing else reads the system clock. */
export interface Clock {
  now(): Instant
  setTimeout(callback: () => void, delay: Ms): unknown
  clearTimeout(handle: unknown): void
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
}
