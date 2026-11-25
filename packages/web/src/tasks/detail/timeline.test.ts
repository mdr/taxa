import { describe, expect, it } from "vite-plus/test"
import { ActivityType, type Activity } from "@taxa/shared/activity/activity"
import type { Comment } from "@taxa/shared/comments/comment"
import { commentId, taskId, userId } from "@taxa/shared/ids"
import { timeline, TimelineEntryType, type TimelineEntry } from "./timeline.ts"

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
    case TimelineEntryType.FOLD:
      return `fold ${entry.changes.map(({ version }) => version).join(",")}`
  }
}

describe("timeline", () => {
  it("puts changes and comments in the order they happened, changes first at the same moment", () => {
    const entries = timeline(
      [
        makeChange("2026-01-05T09:00:00.000Z", 1, ActivityType.TASK_CREATED),
        makeChange("2026-01-05T09:02:00.000Z", 2, ActivityType.TASK_STATUS_CHANGED)
      ],
      [makeComment("2026-01-05T09:01:00.000Z", "Rang the plumber"), makeComment("2026-01-05T09:02:00.000Z", "Fixed")]
    )
    expect(entries.map(described)).toEqual(["change 1", "Rang the plumber", "change 2", "Fixed"])
  })

  it("folds each run of changes that go without saying, where they happened", () => {
    const entries = timeline(
      [
        makeChange("2026-01-05T09:00:00.000Z", 1, ActivityType.TASK_CREATED),
        makeChange("2026-01-05T09:01:00.000Z", 2, ActivityType.TASK_UPDATED, { notes: { to: "Washer" } }),
        makeChange("2026-01-05T09:02:00.000Z", 3, ActivityType.TASK_UPDATED, { priority: { to: "HIGH" } }),
        makeChange("2026-01-05T09:04:00.000Z", 4, ActivityType.TASK_UPDATED, { domainId: { to: "x" } }),
        makeChange("2026-01-05T09:05:00.000Z", 5, ActivityType.TASK_OCCURRENCE_RECORDED),
        makeChange("2026-01-05T09:06:00.000Z", 6, ActivityType.TASK_UPDATED, { due: { to: "2026-01-09" } })
      ],
      [makeComment("2026-01-05T09:05:30.000Z", "Did it")]
    )
    expect(entries.map(described)).toEqual(["change 1", "fold 2,3", "change 4", "fold 5", "Did it", "fold 6"])
  })
})
