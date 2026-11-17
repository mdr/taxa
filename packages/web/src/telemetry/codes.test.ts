import { misfiledCodes } from "@taxa/shared/telemetry/log"
import { describe, expect, it } from "vite-plus/test"
import { ANALYTICS_CODES, LOG_CODES } from "./codes.ts"

const codesIn = (codes: Record<string, Record<string, string>>): string[] =>
  Object.values(codes).flatMap((events) => Object.values(events))

describe("the web app's codes", () => {
  it("are each `group.event`, as filed", () => {
    expect(misfiledCodes(LOG_CODES)).toEqual([])
    expect(misfiledCodes(ANALYTICS_CODES)).toEqual([])
  })

  it("aren't shared between logs and analytics, since both go to the log", () => {
    const logged = new Set(codesIn(LOG_CODES))
    expect(codesIn(ANALYTICS_CODES).filter((code) => logged.has(code))).toEqual([])
  })
})
