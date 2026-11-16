import type { Instant } from "./units.ts"

const hex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")

/**
 * A UUIDv7: the time in its first 48 bits, so ids sort by when they were
 * made, and random bits after. Clients make their own, so a task created
 * offline has its id at once.
 */
export const uuidv7 = (at: Instant, random: Uint8Array = crypto.getRandomValues(new Uint8Array(10))): string => {
  const bytes = new Uint8Array(16)
  let time = at
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256
    time = Math.floor(time / 256)
  }
  bytes.set(random, 6)
  bytes[6] = 0x70 | (bytes[6]! & 0x0f)
  bytes[8] = 0x80 | (bytes[8]! & 0x3f)
  const text = hex(bytes)
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`
}
