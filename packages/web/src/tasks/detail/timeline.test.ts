import { describe, expect, it } from "vite-plus/test"
import { ActivityType, type Activity } from "@taxa/shared/activity/activity"
import type { Comment } from "@taxa/shared/comments/comment"
import { commentId, taskId, userId } from "@taxa/shared/ids"
import { timeline, TimelineEntryType } from "./timeline.ts"

const MATT = { user: { id: userId("0190a000-0000-7000-8000-000000000001"), name: "Matt" } }

const makeChange = (at: string, version: number): Activity => ({
  sequence: version,
  at,
  actor: MATT,
  type: ActivityType.TASK_UPDATED,
  version,
  changes: {}
})

const makeComment = (createdAt: string, body: string): Comment => ({
  id: commentId("0190a000-0000-7000-8000-000000000002"),
  taskId: taskId("0190a000-0000-7000-8000-000000000003"),
  author: MATT,
  body,
  createdAt,
  version: 1
})

describe("timeline", () => {
  it("puts changes and comments in the order they happened, changes first at the same moment", () => {
    const entries = timeline(
      [makeChange("2026-01-05T09:00:00.000Z", 1), makeChange("2026-01-05T09:02:00.000Z", 2)],
      [makeComment("2026-01-05T09:01:00.000Z", "Rang the plumber"), makeComment("2026-01-05T09:02:00.000Z", "Fixed")]
    )
    expect(
      entries.map((entry) =>
        entry.type === TimelineEntryType.CHANGE ? `change ${entry.change.version}` : entry.comment.body
      )
    ).toEqual(["change 1", "Rang the plumber", "change 2", "Fixed"])
  })
})
