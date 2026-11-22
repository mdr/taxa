import { describe, expect, it } from "vite-plus/test"
import { tidiedTitle } from "./tidied-title.ts"

describe("tidiedTitle", () => {
  it("makes runs of spaces one, and empty nothing", () => {
    expect(tidiedTitle("  Fix   the\ntap ")).toBe("Fix the tap")
    expect(tidiedTitle(" \n ")).toBeUndefined()
  })
})
