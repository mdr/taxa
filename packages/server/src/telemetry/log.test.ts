import { misfiledCodes } from "@taxa/shared/telemetry/log"
import { describe, expect, it } from "vite-plus/test"
import { LOG_CODES } from "./log.ts"

describe("LOG_CODES", () => {
  it("are each `group.event`, as filed", () => {
    expect(misfiledCodes(LOG_CODES)).toEqual([])
  })
})
