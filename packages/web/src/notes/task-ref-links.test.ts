import { describe, expect, it } from "vite-plus/test"
import { taskRefsIn } from "./task-ref-links.ts"

const PREFIXES = new Set(["P", "H"])

describe("taskRefsIn", () => {
  it("finds refs to the reader's domains, however they're cased", () => {
    expect(taskRefsIn("Only item 4 left, with Jo under P-52 (and h-7).", PREFIXES)).toEqual([
      { from: 32, to: 36, ref: "P-52" },
      { from: 42, to: 45, ref: "H-7" }
    ])
  })

  it("leaves what only looks like a ref: other prefixes, longer words, and numbers from 0", () => {
    expect(taskRefsIn("UTF-8, SHA-256, X-P-5, P-5-2, P-0, P-52b", PREFIXES)).toEqual([])
  })
})
