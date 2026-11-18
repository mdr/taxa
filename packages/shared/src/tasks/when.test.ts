import { describe, expect, it } from "vite-plus/test"
import { Horizon } from "./task.ts"
import { ClearableField } from "./task-requests.ts"
import { isCarriedOver, weeksInSoon, When, whenOf, whenRequest } from "./when.ts"

const today = "2026-01-05"

describe("whenOf", () => {
  it("is today for a task scheduled today or before, and on a day for one to come", () => {
    expect(whenOf({ scheduled: "2026-01-05" }, today)).toBe(When.TODAY)
    expect(whenOf({ scheduled: "2026-01-02" }, today)).toBe(When.TODAY)
    expect(whenOf({ scheduled: "2026-01-09" }, today)).toBe(When.ON_A_DAY)
  })

  it("is soon or someday by its horizon, and any time with neither", () => {
    expect(whenOf({ horizon: Horizon.SOON }, today)).toBe(When.SOON)
    expect(whenOf({ horizon: Horizon.SOMEDAY }, today)).toBe(When.SOMEDAY)
    expect(whenOf({}, today)).toBe(When.ANY_TIME)
  })

  it("goes by a date over a horizon", () => {
    expect(whenOf({ scheduled: "2026-01-05", horizon: Horizon.SOMEDAY }, today)).toBe(When.TODAY)
  })
})

describe("isCarriedOver", () => {
  it("is a task meant for an earlier day", () => {
    expect(isCarriedOver({ scheduled: "2026-01-02" }, today)).toBe(true)
    expect(isCarriedOver({ scheduled: "2026-01-05" }, today)).toBe(false)
    expect(isCarriedOver({}, today)).toBe(false)
  })
})

describe("weeksInSoon", () => {
  it("counts the weeks a task's been in soon, from four", () => {
    const since = (date: string): { horizon: Horizon; horizonSetAt: string } => ({
      horizon: Horizon.SOON,
      horizonSetAt: `${date}T09:00:00.000Z`
    })
    expect(weeksInSoon(since("2025-12-08"), today)).toBe(4)
    expect(weeksInSoon(since("2025-11-20"), today)).toBe(6)
    expect(weeksInSoon(since("2025-12-09"), today)).toBeUndefined()
    expect(weeksInSoon({ horizon: Horizon.SOMEDAY, horizonSetAt: "2025-01-01T09:00:00.000Z" }, today)).toBeUndefined()
    expect(weeksInSoon({ horizon: Horizon.SOON }, today)).toBeUndefined()
  })
})

describe("whenRequest", () => {
  it("sets a date or a horizon, clearing the other", () => {
    expect(whenRequest(When.TODAY, today)).toEqual({ set: { scheduled: today }, clear: [ClearableField.HORIZON] })
    expect(whenRequest(When.ON_A_DAY, today, "2026-01-09")).toEqual({
      set: { scheduled: "2026-01-09" },
      clear: [ClearableField.HORIZON]
    })
    expect(whenRequest(When.SOON, today)).toEqual({
      set: { horizon: Horizon.SOON },
      clear: [ClearableField.SCHEDULED, ClearableField.SCHEDULED_TIME]
    })
    expect(whenRequest(When.SOMEDAY, today)).toEqual({
      set: { horizon: Horizon.SOMEDAY },
      clear: [ClearableField.SCHEDULED, ClearableField.SCHEDULED_TIME]
    })
    expect(whenRequest(When.ANY_TIME, today)).toEqual({
      clear: [ClearableField.SCHEDULED, ClearableField.SCHEDULED_TIME, ClearableField.HORIZON]
    })
  })
})
