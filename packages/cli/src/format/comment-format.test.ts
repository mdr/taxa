import { describe, expect, it } from "vite-plus/test"
import type { Comment } from "@taxa/shared/comments/comment"
import { timeZone } from "@taxa/shared/dates/plain-date"
import { agentId, commentId, taskId, userId } from "@taxa/shared/ids"
import { commentLines, latestComments } from "./comment-format.ts"

const LONDON = timeZone("Europe/London")
const MATT = { id: userId("0190a000-0000-7000-8000-000000000001"), name: "Matt" }

const makeComment = (fields: Partial<Comment> = {}): Comment => ({
  id: commentId("0190a000-0000-7000-8000-000000000002"),
  taskId: taskId("0190a000-0000-7000-8000-000000000003"),
  author: { user: MATT },
  body: "Rang the plumber",
  createdAt: "2026-01-05T09:00:00.000Z",
  version: 1,
  ...fields
})

describe("commentLines", () => {
  it("says when and who, then what each says, indented", () => {
    const comments = [
      makeComment(),
      makeComment({
        author: { user: MATT, agent: { id: agentId("0190a000-0000-7000-8000-000000000004"), name: "Claude Code" } },
        body: "Found the part.\n\n- 15mm fitting",
        createdAt: "2026-07-01T14:30:00.000Z",
        editedAt: "2026-07-01T14:31:00.000Z"
      })
    ]
    expect(commentLines(comments, LONDON)).toBe(
      [
        "2026-01-05 09:00  Matt",
        "  Rang the plumber",
        "",
        "2026-07-01 15:30  Claude Code for Matt (edited)",
        "  Found the part.",
        "",
        "  - 15mm fitting"
      ].join("\n")
    )
  })

  it("says when there are none", () => {
    expect(commentLines([], LONDON)).toBe("No comments.")
  })
})

describe("latestComments", () => {
  it("shows the latest three, and how to see them all", () => {
    const comments = ["One", "Two", "Three", "Four"].map((body) => makeComment({ body }))
    const shown = latestComments(comments, "H-142", LONDON)
    expect(shown).toMatch(/^\n\nComments, the latest 3 \(all 4: taxa comments H-142\)\n\n/)
    expect(shown).not.toContain("One")
    expect(shown).toContain("  Four")
  })

  it("is nothing when there are none", () => {
    expect(latestComments([], "H-142", LONDON)).toBe("")
  })
})
