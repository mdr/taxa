import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import { uuidv7 } from "./ids.ts"

describe("uuidv7", () => {
  it("is a version 7 UUID with the time in its first 48 bits", () => {
    const at = Date.UTC(2026, 0, 5, 9, 0)
    const id = uuidv7(at, new Uint8Array(10))
    expect(z.uuid({ version: "v7" }).safeParse(id).success).toBe(true)
    expect(id.replace("-", "").slice(0, 12)).toBe(at.toString(16).padStart(12, "0"))
    expect(id.slice(14)).toBe("7000-8000-000000000000")
  })

  it("sorts by time", () => {
    expect(uuidv7(1_000) < uuidv7(2_000)).toBe(true)
  })
})
