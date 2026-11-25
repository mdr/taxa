import { describe, expect, it } from "vite-plus/test"
import { ActivityType, type Activity } from "@taxa/shared/activity/activity"
import type { Comment } from "@taxa/shared/comments/comment"
import { commentId, taskId, userId } from "@taxa/shared/ids"
import { hiddenCount, timeline, TimelineEntryType, type TimelineEntry } from "./timeline.ts"

const MATT = { user: { id: userId("0190a000-0000-7000-8000-000000000001"), name: "Matt" } }

const makeChange = (
  at: string,
  version: number,
  type = ActivityType.TASK_UPDATED,
  changes: Activity["changes"] = {}
): Activity => ({ sequence: version, at, actor: MATT, type, version, changes })

const makeComment = (createdAt: string, body: string): Comment => ({
  id: commentId("0190a000-0000-7000-8000-000000000002"),
  taskId: taskId("0190a000-0000-7000-8000-000000000003"),
  author: MATT,
  body,
  createdAt,
  version: 1
})

const described = (entry: TimelineEntry): string => {
  switch (entry.type) {
    case TimelineEntryType.CHANGE:
      return `change ${entry.change.version}`
    case TimelineEntryType.COMMENT:
      return entry.comment.body
  }
}

describe("timeline", () => {
  it("puts changes and comments in the order they happened, changes first at the same moment", () => {
    const entries = timeline(
      [
        makeChange("2026-01-05T09:00:00.000Z", 1, ActivityType.TASK_CREATED),
        makeChange("2026-01-05T09:02:00.000Z", 2, ActivityType.TASK_STATUS_CHANGED)
      ],
      [makeComment("2026-01-05T09:01:00.000Z", "Rang the plumber"), makeComment("2026-01-05T09:02:00.000Z", "Fixed")],
      false
    )
    expect(entries.map(described)).toEqual(["change 1", "Rang the plumber", "change 2", "Fixed"])
  })

  it("leaves out changes that go without saying, unless all are asked for", () => {
    const changes = [
      makeChange("2026-01-05T09:00:00.000Z", 1, ActivityType.TASK_CREATED),
      makeChange("2026-01-05T09:01:00.000Z", 2, ActivityType.TASK_UPDATED, { notes: { to: "Washer" } }),
      makeChange("2026-01-05T09:02:00.000Z", 3, ActivityType.TASK_UPDATED, { priority: { to: "HIGH" } }),
      makeChange("2026-01-05T09:04:00.000Z", 4, ActivityType.TASK_UPDATED, { domainId: { to: "x" } }),
      makeChange("2026-01-05T09:05:00.000Z", 5, ActivityType.TASK_OCCURRENCE_RECORDED)
    ]
    const comments = [makeComment("2026-01-05T09:05:30.000Z", "Did it")]
    expect(timeline(changes, comments, false).map(described)).toEqual(["change 1", "change 4", "Did it"])
    expect(timeline(changes, comments, true).map(described)).toEqual([
      "change 1",
      "change 2",
      "change 3",
      "change 4",
      "change 5",
      "Did it"
    ])
    expect(hiddenCount(changes)).toBe(3)
  })
})
