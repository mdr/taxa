import { describe, expect } from "vite-plus/test"
import { HealthStatus } from "@taxa/shared/api/health"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"
import { LOG_CODES } from "../telemetry/log.ts"

describe("health", () => {
  const it = useInProcessServer()

  it("is OK while the database answers", async ({ server }) => {
    expect(await server.health()).toEqual({ status: HealthStatus.OK, build: "test" })
  })

  it("says so when the database is down, and logs it", async ({ server }) => {
    await server.stopDatabase()
    expect((await server.health()).status).toBe(HealthStatus.DATABASE_DOWN)
    expect(server.logs.map(({ code }) => code)).toContain(LOG_CODES.health.databaseDown)
  })
})
