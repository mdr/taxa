import { expect } from "@playwright/test"

const HOLD_MS = 500
const EVERY_MS = 50

/**
 * For checks that something doesn't happen. Called after a positive check
 * has passed, it reads the state again and again for a while, and fails
 * the moment it's not as expected.
 */
export const expectHolds = async (read: () => Promise<unknown>, expected: unknown): Promise<void> => {
  const until = Date.now() + HOLD_MS
  while (Date.now() < until) {
    expect(await read()).toEqual(expected)
    await new Promise((resolve) => setTimeout(resolve, EVERY_MS))
  }
}
