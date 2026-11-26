import { describe, expect } from "vite-plus/test"
import type { InProcessServer } from "@taxa/server/src/test-support/in-process-server"
import type { TestUser } from "@taxa/server/src/test-support/test-user"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { ExitCode } from "../cli-io.ts"
import { runTaxaAs, type CliRun, type CliRunOptions } from "../test-support/test-cli.ts"

// oxlint-disable-next-line no-control-regex
const STYLING = /\u001B\[[\d;]*m|\u001B\]8;;[^\u001B]*\u001B\\/g

/** What a person would read, without the codes that colour it. */
const read = (text: string): string => text.replaceAll(STYLING, "")

const taxa = (server: InProcessServer, matt: TestUser, argv: string[], options: CliRunOptions = {}): Promise<CliRun> =>
  runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret, clock: server.clock }, argv, options)

const AT_A_TERMINAL = { terminal: { columns: 60 } }

describe("taxa for a person at a terminal", () => {
  const it = useInProcessServer()

  const withTasks = async (server: InProcessServer): Promise<TestUser> => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    await matt.addTask("Fix the tap", { domain: "H", inbox: false, scheduled: "2026-01-05" })
    await matt.addTask("Renew passport", { domain: "H", inbox: false })
    await matt.client.changeStatus("H-2", { status: TaskStatus.IN_PROGRESS })
    return matt
  }

  it("lists tasks under headings, with marks and colour, and links to them", async ({ server }) => {
    const matt = await withTasks(server)
    const { stdout } = await taxa(server, matt, ["list"], AT_A_TERMINAL)
    expect(read(stdout)).toBe("In progress 1\n  ◐ H-2  Renew passport\n\nToday 1\n  ◯ H-1  Fix the tap\n")
    expect(stdout).toContain("\u001B[33m◐\u001B[39m")
    expect(stdout).toContain("\u001B]8;;http://localhost:5173/tasks/H-2\u001B\\")
  })

  it("prints for agents and pipes exactly as before, and as asked with --color or NO_COLOR", async ({ server }) => {
    const matt = await withTasks(server)
    const piped = await taxa(server, matt, ["list"])
    expect(piped.stdout).toBe("H-2  Renew passport  (in progress)\nH-1  Fix the tap  (scheduled Mon 5 Jan)\n")
    expect((await taxa(server, matt, ["list"], { ...AT_A_TERMINAL, env: { NO_COLOR: "1" } })).stdout).toBe(piped.stdout)
    expect((await taxa(server, matt, ["list", "--color", "never"], AT_A_TERMINAL)).stdout).toBe(piped.stdout)
    expect(read((await taxa(server, matt, ["list", "--color", "always"])).stdout)).toContain("In progress 1")
    expect((await taxa(server, matt, ["list", "--json"], AT_A_TERMINAL)).stdout).not.toMatch(STYLING)
  })

  it("says what a change did with its mark and colour", async ({ server }) => {
    const matt = await withTasks(server)
    const { stdout } = await taxa(server, matt, ["done", "H-1"], AT_A_TERMINAL)
    expect(read(stdout)).toBe("✓ Done H-1  Fix the tap\n")
    expect(stdout).toContain("\u001B[32mDone\u001B[39m")
    expect((await taxa(server, matt, ["reopen", "H-1"])).stdout).toBe("Reopened H-1  Fix the tap\n")
  })

  it("says what went wrong in red, and what to try", async ({ server }) => {
    const matt = await withTasks(server)
    const styled = await taxa(server, matt, ["show", "H-99"], AT_A_TERMINAL)
    expect(styled.exitCode).toBe(ExitCode.NOT_FOUND)
    expect(read(styled.stderr)).toMatch(/^✗ There.s no task 99.*\n {2}taxa list finds tasks/)
    const piped = await taxa(server, matt, ["show", "H-99"])
    expect(piped.stderr).not.toContain("taxa list finds tasks")
  })

  it("won't take a --color it doesn't know", async ({ server }) => {
    const matt = await withTasks(server)
    const { exitCode, stderr } = await taxa(server, matt, ["list", "--color", "rainbow"])
    expect(exitCode).toBe(ExitCode.USAGE)
    expect(stderr).toContain("--color is auto, always or never")
  })
})

describe("taxa show for a person at a terminal", () => {
  const it = useInProcessServer()

  it("shows the title, its facts on a line, and the checklist, and pipes get the old layout", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    await matt.addTask("Give to charity", { domain: "H", inbox: false, checklist: ["Oxfam", "Shelter"] })
    await taxa(server, matt, ["check", "H-1", "1"])

    const { stdout } = await taxa(server, matt, ["show", "H-1"], AT_A_TERMINAL)
    expect(read(stdout)).toBe(
      [
        "H-1  Give to charity",
        "◯ open · Home",
        "",
        `Checklist  ${"━".repeat(12)}${"─".repeat(12)} 1/2`,
        "  1 ✓ Oxfam",
        "  2 ☐ Shelter",
        ""
      ].join("\n")
    )
    const piped = await taxa(server, matt, ["show", "H-1"])
    expect(piped.stdout).toContain("Status    open\nDomain    Home\n")
  })
})
