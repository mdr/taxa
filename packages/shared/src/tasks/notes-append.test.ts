import { describe, expect, it } from "vite-plus/test"
import { appendedNotes } from "./notes-append.ts"

describe("appendedNotes", () => {
  it("adds after a blank line, or starts the notes", () => {
    expect(appendedNotes("Ring the plumber.\n", "  Rang: coming Tuesday. ")).toBe(
      "Ring the plumber.\n\nRang: coming Tuesday."
    )
    expect(appendedNotes("", "First note")).toBe("First note")
  })
})
