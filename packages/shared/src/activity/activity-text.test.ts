import { describe, expect, it } from "vite-plus/test"
import { Priority, TaskStatus } from "../tasks/task.ts"
import { ActivityType, type Activity } from "./activity.ts"
import { activityText } from "./activity-text.ts"

const MATT = { id: "0190a1b2-0000-7000-8000-000000000001", name: "Matt" }
const HOME = "0190a1b2-0000-7000-8000-000000000002"

const context = { today: "2026-01-05", domainName: (id: string) => (id === HOME ? "Home" : undefined) }

const makeActivity = (type: ActivityType, changes: Activity["changes"] = {}): Activity => ({
  sequence: 1,
  at: "2026-01-05T09:00:00.000Z",
  actor: { user: MATT },
  type,
  changes
})

const said = (type: ActivityType, changes: Activity["changes"] = {}): string =>
  activityText(makeActivity(type, changes), context)

describe("activityText", () => {
  it("says a task was created, without listing its fields", () => {
    expect(said(ActivityType.TASK_CREATED, { title: { to: "Fix the tap" }, status: { to: TaskStatus.OPEN } })).toBe(
      "Matt created this"
    )
  })

  it("says what was set and cleared, in words", () => {
    expect(
      said(ActivityType.TASK_UPDATED, {
        priority: { from: Priority.NORMAL, to: Priority.HIGH },
        due: { to: "2026-01-09" },
        estimateMinutes: { to: 90 },
        scheduled: { from: "2026-01-08" }
      })
    ).toBe("Matt set priority to high, set due to Fri 9 Jan, estimated it at 1h30m and cleared the scheduled date")
  })

  it("names the domain a task moved to, and that it was filed", () => {
    expect(
      said(ActivityType.TASK_UPDATED, { domainId: { from: "x", to: HOME }, inbox: { from: true, to: false } })
    ).toBe("Matt moved it to Home and filed it")
  })

  it("says a title changed and notes were edited, without quoting the notes", () => {
    expect(
      said(ActivityType.TASK_UPDATED, { title: { from: "Tap", to: "Fix the tap" }, notes: { from: "a", to: "b" } })
    ).toBe("Matt renamed it “Fix the tap” and edited the notes")
  })

  it("says what a status change means, leaving out its bookkeeping", () => {
    expect(
      said(ActivityType.TASK_STATUS_CHANGED, {
        status: { from: TaskStatus.OPEN, to: TaskStatus.WAITING },
        waitingOn: { to: "Dave's quote" },
        followUp: { to: "2026-01-12" }
      })
    ).toBe("Matt marked it waiting on Dave's quote")
    expect(
      said(ActivityType.TASK_STATUS_CHANGED, {
        status: { from: TaskStatus.OPEN, to: TaskStatus.DONE },
        completedAt: { to: "2026-01-05T09:00:00.000Z" }
      })
    ).toBe("Matt marked it done")
    expect(said(ActivityType.TASK_STATUS_CHANGED, { status: { to: TaskStatus.IN_PROGRESS } })).toBe("Matt started it")
    expect(
      said(ActivityType.TASK_STATUS_CHANGED, {
        status: { to: TaskStatus.CANCELLED },
        cancelledReason: { to: "Kept it" }
      })
    ).toBe("Matt cancelled it because “Kept it”")
  })

  it("names an agent and its context", () => {
    const activity = {
      ...makeActivity(ActivityType.TASK_DELETED),
      actor: { user: MATT, agent: { id: MATT.id, name: "Claude Code" }, agentContext: "mdr/taxa" }
    }
    expect(activityText(activity, context)).toBe("Claude Code for Matt (mdr/taxa) deleted this")
  })
})
