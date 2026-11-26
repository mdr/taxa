import { describe, expect } from "vite-plus/test"
import type { InProcessServer } from "@taxa/server/src/test-support/in-process-server"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { ExitCode } from "../cli-io.ts"
import { runTaxaAs, type CliRun } from "../test-support/test-cli.ts"

describe("taxa checklists", () => {
  const it = useInProcessServer()

  const taxaAs = (server: InProcessServer, secret: string, argv: string[], stdin?: string): Promise<CliRun> =>
    runTaxaAs({ httpUrl: server.httpUrl, secret, clock: server.clock, agentContext: "mdr/life-admin" }, argv, { stdin })

  const output = async (server: InProcessServer, secret: string, argv: string[], stdin?: string): Promise<string> => {
    const run = await taxaAs(server, secret, argv, stdin)
    expect(run.stderr).toBe("")
    return run.stdout
  }

  it("adds a task with items, adds more from stdin, and ticks them by number or text", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const claude = await matt.agent("Claude Code")
    await output(server, matt.secret, ["add", "Move charitable giving", "--item", "Oxfam", "--item", "Shelter"])
    expect(await output(server, claude.secret, ["add-item", "M-1", "-"], "- [ ] RSPB\n- [ ] Crisis\n\n")).toBe(
      "Checklist  0/4\n1. [ ] Oxfam\n2. [ ] Shelter\n3. [ ] RSPB\n4. [ ] Crisis\n"
    )
    expect(await output(server, claude.secret, ["check", "M-1", "1", "rsp"])).toBe(
      "Checklist  2/4\n1. [x] Oxfam\n2. [ ] Shelter\n3. [x] RSPB\n4. [ ] Crisis\n"
    )
    await output(server, matt.secret, ["uncheck", "M-1", "oxfam"])
    await output(server, matt.secret, ["edit-item", "M-1", "Crisis", "Crisis", "at", "Christmas"])
    await output(server, matt.secret, ["add-item", "M-1", "--after", "1", "British Heart Foundation"])
    expect(await output(server, matt.secret, ["remove-item", "M-1", "shelter"])).toBe(
      "Checklist  1/4\n1. [ ] Oxfam\n2. [ ] British Heart Foundation\n3. [x] RSPB\n4. [ ] Crisis at Christmas\n"
    )
    expect(await output(server, matt.secret, ["list"])).toContain("M-1  Move charitable giving  (checklist 1/4, inbox)")
    expect(await output(server, matt.secret, ["show", "M-1"])).toContain("\nChecklist  1/4\n1. [ ] Oxfam\n")
  })

  it("moves an item after another, or to the top", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    await matt.addTask("Move charitable giving", { checklist: ["Oxfam", "Shelter", "RSPB"] })
    expect(await output(server, matt.secret, ["move-item", "M-1", "oxfam", "--after", "rspb"])).toBe(
      "Checklist  0/3\n1. [ ] Shelter\n2. [ ] RSPB\n3. [ ] Oxfam\n"
    )
    expect(await output(server, matt.secret, ["move-item", "M-1", "3", "--first"])).toBe(
      "Checklist  0/3\n1. [ ] Oxfam\n2. [ ] Shelter\n3. [ ] RSPB\n"
    )
    expect(await taxaAs(server, matt.secret, ["move-item", "M-1", "oxfam"])).toMatchObject({
      exitCode: ExitCode.USAGE,
      stderr: expect.stringContaining("Say where")
    })
  })

  it("makes an item a task, which ticks it when done", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Personal", "P")
    await matt.addTask("Move charitable giving", { domain: "P", checklist: ["Oxfam", "Shelter"] })
    expect(await output(server, matt.secret, ["item-to-task", "P-1", "oxfam"])).toBe(
      "Added P-2  Oxfam, from P-1's checklist\nhttp://localhost:5173/tasks/P-2\n"
    )
    await matt.client.changeStatus("P-2", { status: TaskStatus.DONE })
    expect(await output(server, matt.secret, ["checklist", "P-1"])).toBe(
      "Checklist  1/2\n1. [x] Oxfam  (P-2)\n2. [ ] Shelter\n"
    )
  })

  it("says what's wrong with an item it can't tell", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    await matt.addTask("Passwords", { checklist: ["Amazon", "Amazon Prime"] })
    expect(await taxaAs(server, matt.secret, ["check", "M-1", "ama"])).toMatchObject({
      exitCode: ExitCode.USAGE,
      stderr: expect.stringContaining('2 of M-1\'s items match "ama"')
    })
    expect(await output(server, matt.secret, ["check", "M-1", "amazon"])).toContain("1. [x] Amazon\n")
    expect((await taxaAs(server, matt.secret, ["check", "M-1", "eBay"])).exitCode).toBe(ExitCode.USAGE)
    expect(await output(server, matt.secret, ["checklist", "M-1", "--json"])).toContain('"text": "Amazon Prime"')
  })
})
