import { describe, expect } from "vite-plus/test"
import type { InProcessServer } from "@taxa/server/src/test-support/in-process-server"
import type { TestUser } from "@taxa/server/src/test-support/test-user"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { ExitCode } from "../cli-io.ts"
import { runTaxaAs, type CliRun } from "../test-support/test-cli.ts"

const taxa = (server: InProcessServer, matt: TestUser, ...argv: string[]): Promise<CliRun> =>
  runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret, clock: server.clock }, argv)

describe("taxa undo", () => {
  const it = useInProcessServer()

  it("undoes the last change, or any by its number in the log, and an undo redoes", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addTask("Fix the tap")
    await taxa(server, matt, "edit", "1", "--priority", "high")
    await taxa(server, matt, "done", "1")
    expect((await taxa(server, matt, "undo", "1")).stdout).toBe("Undid change 3 to IN-1  Fix the tap\n")
    expect((await taxa(server, matt, "undo", "1", "--version", "2")).exitCode).toBe(ExitCode.OK)
    expect((await taxa(server, matt, "log", "1")).stdout).toBe(
      [
        "1  2026-01-05 09:00  Matt created this",
        "2  2026-01-05 09:00  Matt set priority to high",
        "3  2026-01-05 09:00  Matt marked it done",
        "4  2026-01-05 09:00  Matt undid change 3: reopened it",
        "5  2026-01-05 09:00  Matt undid change 2: set priority to normal",
        ""
      ].join("\n")
    )
    await taxa(server, matt, "undo", "1")
    expect((await matt.client.task("1")).priority).toBe("HIGH")
  })

  it("deletes a task added by mistake", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addTask("Fix the tpa")
    await taxa(server, matt, "undo", "1")
    expect((await taxa(server, matt, "list")).stdout).toBe("No tasks.\n")
    expect((await taxa(server, matt, "list", "--deleted")).stdout).toContain("IN-1  Fix the tpa")
  })

  it("says when what a change did has been changed since, with its own exit code", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addTask("Fix the tap")
    await taxa(server, matt, "edit", "1", "--priority", "high")
    await taxa(server, matt, "edit", "1", "--priority", "low")
    const run = await taxa(server, matt, "undo", "1", "--version", "2")
    expect(run.exitCode).toBe(ExitCode.CONFLICT)
    expect(run.stderr).toContain("undo the later change first")
  })
})
