import { describe, expect, it } from "vite-plus/test"
import type { Clock } from "../clock.ts"
import { createLogger, flatRecord, LogLevel, misfiledCodes, type LogRecord } from "./log.ts"

const clock: Clock = {
  now: () => Date.UTC(2026, 0, 5, 9, 0),
  setTimeout: () => undefined,
  clearTimeout: () => undefined
}

describe("createLogger", () => {
  it("stamps records with the clock's time and level, and sends them to every destination", () => {
    const first: LogRecord[] = []
    const second: LogRecord[] = []
    const log = createLogger<"task.created" | "app.started">(clock, [
      (record) => first.push(record),
      (record) => second.push(record)
    ])
    log.info("task.created", "a task was created", { taskId: "t1" })
    log.error("app.started", "it broke")
    expect(first).toEqual([
      {
        time: "2026-01-05T09:00:00.000Z",
        level: LogLevel.INFO,
        code: "task.created",
        msg: "a task was created",
        fields: { taskId: "t1" }
      },
      { time: "2026-01-05T09:00:00.000Z", level: LogLevel.ERROR, code: "app.started", msg: "it broke", fields: {} }
    ])
    expect(second).toEqual(first)
  })
})

describe("flatRecord", () => {
  it("puts fields beside the record's keys, which win a clash", () => {
    expect(
      flatRecord({ time: "t", level: LogLevel.WARN, code: "a.b", msg: "m", fields: { taskId: "t1", code: "x" } })
    ).toEqual({ taskId: "t1", time: "t", level: LogLevel.WARN, code: "a.b", msg: "m" })
    expect(
      Object.keys(flatRecord({ time: "t", level: LogLevel.WARN, code: "a.b", msg: "m", fields: { taskId: "t1" } }))
    ).toEqual(["time", "level", "code", "msg", "taskId"])
  })
})

describe("misfiledCodes", () => {
  it("finds codes that don't match where they're filed", () => {
    expect(misfiledCodes({ task: { created: "task.created", updated: "task.changed" } })).toEqual(["task.changed"])
  })
})
