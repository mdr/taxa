import { describe, expect } from "vite-plus/test"
import { TaskStatus } from "@taxa/shared/tasks/task"
import type { InProcessServer } from "@taxa/server/src/test-support/in-process-server"
import type { TestUser } from "@taxa/server/src/test-support/test-user"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { ExitCode } from "../cli-io.ts"
import { runTaxaAs, type CliRun } from "../test-support/test-cli.ts"

const taxa = (server: InProcessServer, matt: TestUser, ...argv: string[]): Promise<CliRun> =>
  runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret, clock: server.clock }, argv)

const withThree = async (server: InProcessServer): Promise<TestUser> => {
  const matt = await server.user("Matt")
  await matt.addDomain("Home", "H")
  for (const title of ["Fix the tap", "Paint the fence", "Clear the gutters"])
    await matt.addTask(title, { domain: "H", inbox: false })
  return matt
}

describe("taxa on several tasks at once", () => {
  const it = useInProcessServer()

  it("changes each in turn, a line for each", async ({ server }) => {
    const matt = await withThree(server)
    expect(await taxa(server, matt, "done", "H-1", "H-3")).toEqual({
      exitCode: ExitCode.OK,
      stdout: "Done: H-1  Fix the tap\nDone: H-3  Clear the gutters\n",
      stderr: ""
    })
    expect((await matt.client.task("H-2")).status).toBe(TaskStatus.OPEN)
    expect((await taxa(server, matt, "edit", "H-1", "H-2", "--tag", "Garden")).stdout).toBe(
      "Edited H-1  Fix the tap\nEdited H-2  Paint the fence\n"
    )
    expect((await matt.client.task("H-2")).tags).toEqual(["Garden"])
  })

  it("carries on past one that fails, and exits as the first failure did", async ({ server }) => {
    const matt = await withThree(server)
    const run = await taxa(server, matt, "start", "H-1", "H-9", "H-2")
    expect(run.exitCode).toBe(ExitCode.NOT_FOUND)
    expect(run.stdout).toBe("Started H-1  Fix the tap\nStarted H-2  Paint the fence\n")
    expect(run.stderr).toContain("task 9")
    const skipping = await taxa(server, matt, "skip", "H-3")
    expect(skipping.exitCode).toBe(ExitCode.USAGE)
  })

  it("gives one array with --json, problems and all, and one task as ever", async ({ server }) => {
    const matt = await withThree(server)
    const many = await taxa(server, matt, "cancel", "H-1", "H-9", "--json")
    const results = JSON.parse(many.stdout) as { ref?: string; type?: string }[]
    expect(results.map(({ ref, type }) => ref ?? type)).toEqual(["H-1", "NOT_FOUND"])
    const one = JSON.parse((await taxa(server, matt, "reopen", "H-1", "--json")).stdout) as { ref: string }
    expect(one.ref).toBe("H-1")
  })

  it("won't take --if-version for several, as each has its own", async ({ server }) => {
    const matt = await withThree(server)
    const run = await taxa(server, matt, "delete", "H-1", "H-2", "--if-version", "1")
    expect(run.exitCode).toBe(ExitCode.USAGE)
    expect(run.stderr).toContain("--if-version is for one task")
  })
})
