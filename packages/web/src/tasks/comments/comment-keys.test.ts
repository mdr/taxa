import { describe, expect, it } from "vite-plus/test"
import { sendsComment } from "./comment-keys.ts"

describe("sendsComment", () => {
  it("is Enter, with or without ⌘, but not Shift+Enter, nor Enter picking a character being composed", () => {
    expect(sendsComment({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true)
    expect(sendsComment({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false)
    expect(sendsComment({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false)
    expect(sendsComment({ key: "a", shiftKey: false, isComposing: false })).toBe(false)
  })
})
