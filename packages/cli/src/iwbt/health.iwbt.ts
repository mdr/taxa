import { describe, expect } from "vite-plus/test"
import { HealthStatus } from "@taxa/shared/api/health"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { ExitCode } from "../cli-io.ts"
import { runTaxa } from "../test-support/test-cli.ts"

describe("taxa health", () => {
  const it = useInProcessServer()

  it("says the server is OK", async ({ server }) => {
    expect(await runTaxa(server.httpUrl, "health")).toEqual({
      exitCode: ExitCode.OK,
      stdout: "OK (build test)\n",
      stderr: ""
    })
  })

  it("prints JSON with --json", async ({ server }) => {
    const run = await runTaxa(server.httpUrl, "health", "--json")
    expect(JSON.parse(run.stdout)).toEqual({ status: HealthStatus.OK, build: "test" })
  })

  it("fails when the database is down", async ({ server }) => {
    await server.stopDatabase()
    const run = await runTaxa(server.httpUrl, "health")
    expect(run.exitCode).toBe(ExitCode.FAILED)
    expect(run.stdout).toContain("database is down")
  })

  it("fails with a clear message when the server can't be reached", async ({ server }) => {
    const unreachable = server.httpUrl
    await server.close()
    const run = await runTaxa(unreachable, "health")
    expect(run.exitCode).toBe(ExitCode.FAILED)
    expect(run.stderr).toContain("Can't reach the Taxa server")
  })
})
