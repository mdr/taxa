import { Energy, Horizon, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { describe, expect, it } from "vite-plus/test"
import { suggestedTasks, suggestionReason, todayFirst } from "./suggestions.ts"

const TODAY = "2026-01-05"

describe("suggestionReason", () => {
  it("gives the most pressing reason a task's worth doing now", () => {
    const reason = (fields: Parameters<typeof makeTask>[0]): string | undefined =>
      suggestionReason(makeTask(fields), TODAY)
    expect(reason({ status: TaskStatus.IN_PROGRESS, due: TODAY })).toBe("In progress")
    expect(reason({ due: "2026-01-04" })).toBe("Overdue")
    expect(reason({ due: TODAY })).toBe("Due today")
    expect(reason({ scheduled: "2026-01-02", priority: Priority.URGENT })).toBe("Today")
    expect(reason({ due: "2026-01-09" })).toBe("Due Fri")
    expect(reason({ due: "2026-01-20", priority: Priority.URGENT })).toBe("Urgent")
    expect(reason({ priority: Priority.HIGH })).toBe("High priority")
    expect(reason({ horizon: Horizon.SOON, energy: Energy.LOW })).toBe("Soon")
    expect(reason({ energy: Energy.LOW })).toBe("Low energy")
    expect(reason({ inbox: true })).toBe("Inbox")
    expect(reason({})).toBeUndefined()
  })
})

describe("suggestedTasks", () => {
  const tap = makeTask({ number: 1, title: "Fix the tap" })
  const radiators = makeTask({ number: 2, title: "Bleed the radiators" })
  const builder = makeTask({ number: 3, title: "Hear from the builder", status: TaskStatus.WAITING })

  it("leaves out tasks planned already and ones waiting on others", () => {
    expect(suggestedTasks([tap, radiators, builder], [tap.id], "")).toEqual([radiators])
  })

  it("puts today's tasks first, in their order", () => {
    expect(todayFirst([radiators], [tap, radiators])).toEqual([radiators, tap])
  })

  it("finds tasks by title or ref", () => {
    expect(suggestedTasks([tap, radiators], [], "TAP")).toEqual([tap])
    expect(suggestedTasks([tap, radiators], [], "h-2")).toEqual([radiators])
  })
})
