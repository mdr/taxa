import { describe, expect, it } from "vite-plus/test"
import { HealthStatus } from "@taxa/shared/api/health"
import { ServerStatus, serverStatusOf } from "./server-status.ts"

describe("serverStatusOf", () => {
  it("reads a health answer", () => {
    expect(serverStatusOf({ status: HealthStatus.OK, build: "abc" })).toBe(ServerStatus.OK)
    expect(serverStatusOf({ status: HealthStatus.DATABASE_DOWN, build: "abc" })).toBe(ServerStatus.DATABASE_DOWN)
  })

  it("treats anything else as no answer", () => {
    expect(serverStatusOf(undefined)).toBe(ServerStatus.UNREACHABLE)
    expect(serverStatusOf({ error: "Bad Gateway" })).toBe(ServerStatus.UNREACHABLE)
  })
})
