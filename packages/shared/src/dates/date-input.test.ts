import { describe, expect, it } from "vite-plus/test"
import { parseDateInput } from "./date-input.ts"

// A Wednesday.
const TODAY = "2026-01-07"

describe("parseDateInput", () => {
  it.each([
    ["2026-03-01", "2026-03-01"],
    ["today", "2026-01-07"],
    ["Tomorrow", "2026-01-08"],
    ["yesterday", "2026-01-06"],
    ["+3d", "2026-01-10"],
    ["+2w", "2026-01-21"],
    ["fri", "2026-01-09"],
    ["friday", "2026-01-09"],
    ["wed", "2026-01-07"],
    ["mon", "2026-01-12"],
    [" sunday ", "2026-01-11"]
  ])("reads %s", (text, expected) => {
    expect(parseDateInput(text, TODAY)).toBe(expected)
  })

  it.each(["", "soon", "fr", "2026-02-30", "+3", "-3d", "next friday"])("rejects %j", (text) => {
    expect(parseDateInput(text, TODAY)).toBeUndefined()
  })
})
