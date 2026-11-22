import { describe, expect } from "vite-plus/test"
import { Horizon, Priority, TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { InProcessServer } from "@taxa/server/src/test-support/in-process-server"
import type { TestUser } from "@taxa/server/src/test-support/test-user"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { ExitCode } from "../cli-io.ts"
import { runTaxaAs, type CliRun } from "../test-support/test-cli.ts"

const mattAtHome = async (server: InProcessServer): Promise<TestUser> => {
  const matt = await server.user("Matt")
  await matt.addDomain("Personal", "M")
  await matt.addDomain("Home", "H")
  return matt
}

const taxa = (server: InProcessServer, matt: TestUser, ...argv: string[]): Promise<CliRun> =>
  runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret, clock: server.clock }, argv)

describe("taxa add", () => {
  const it = useInProcessServer()

  it("adds a task to the Inbox and says its reference", async ({ server }) => {
    const matt = await mattAtHome(server)
    expect(await taxa(server, matt, "add", "Renew", "passport")).toEqual({
      exitCode: ExitCode.OK,
      stdout: "Added IN-1  Renew passport\n",
      stderr: ""
    })
  })

  it("reads dates as people write them, in their time zone", async ({ server }) => {
    const matt = await mattAtHome(server)
    await taxa(
      server,
      matt,
      "add",
      "Pay council tax",
      "--domain",
      "h",
      "--due",
      "fri",
      "--priority",
      "high",
      "--estimate",
      "1h30m"
    )
    expect(await matt.client.task("H-1")).toMatchObject({
      due: "2026-01-09",
      priority: Priority.HIGH,
      estimateMinutes: 90,
      inbox: false
    })
  })

  it("adds tasks from JSON on stdin, printing the API's JSON with --json", async ({ server }) => {
    const matt = await mattAtHome(server)
    const stdin = JSON.stringify([
      { title: "One", domain: "H" },
      { title: "Two", due: "2026-02-01" }
    ])
    const run = await runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret }, ["add", "-", "--json"], { stdin })
    expect(run.exitCode).toBe(ExitCode.OK)
    expect((JSON.parse(run.stdout) as Task[]).map(({ ref, due }) => [ref, due])).toEqual([
      ["H-1", undefined],
      ["IN-2", "2026-02-01"]
    ])
  })

  it("explains JSON that isn't a task", async ({ server }) => {
    const matt = await mattAtHome(server)
    const run = await runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret }, ["add", "-"], {
      stdin: '{"due": "soon"}'
    })
    expect(run.exitCode).toBe(ExitCode.USAGE)
    expect(run.stderr).toContain("title")
  })
})

describe("taxa list and show", () => {
  const it = useInProcessServer()

  it("lists active tasks, most urgent first, with what sets each apart", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Renew passport")
    await matt.addTask("Fix the tap", { domain: "H", priority: Priority.URGENT, due: "2026-01-09" })
    const run = await taxa(server, matt, "list")
    expect(run.stdout).toBe("H-2   Fix the tap  (urgent, due Fri 9 Jan)\nIN-1  Renew passport  (inbox)\n")
    expect((await taxa(server, matt, "list", "--domain", "H")).stdout).toBe(
      "H-2  Fix the tap  (urgent, due Fri 9 Jan)\n"
    )
    expect((await taxa(server, matt, "list", "--inbox")).stdout).toBe("IN-1  Renew passport  (inbox)\n")
  })

  it("lists finished tasks when asked", async ({ server }) => {
    const matt = await mattAtHome(server)
    const { ref } = await matt.addTask("Renew passport")
    await matt.client.changeStatus(ref, { status: TaskStatus.DONE })
    expect((await taxa(server, matt, "list")).stdout).toBe("No tasks.\n")
    expect((await taxa(server, matt, "list", "--status", "done")).stdout).toBe("IN-1  Renew passport  (done, inbox)\n")
  })

  it("shows everything about a task", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", {
      domain: "H",
      due: "2026-01-09",
      estimateMinutes: 30,
      notes: "Washer, *probably*."
    })
    expect((await taxa(server, matt, "show", "1")).stdout).toBe(
      [
        "H-1  Fix the tap",
        "",
        "Status    open",
        "Domain    Home",
        "Priority  normal",
        "Due       Fri 9 Jan",
        "Estimate  30m",
        "Version   1",
        "",
        "Washer, *probably*.",
        ""
      ].join("\n")
    )
  })

  it("shows the task one follows on from, and those it led to", async ({ server }) => {
    const matt = await mattAtHome(server)
    const disks = await matt.addTask("Back up the floppy disks", { domain: "H" })
    await matt.addTask("Dispose of the disks", { domain: "H", followsOn: disks.ref })
    await matt.addTask("Upload the photos", { domain: "H", followsOn: disks.ref, horizon: Horizon.SOMEDAY })
    expect((await taxa(server, matt, "show", "H-2")).stdout).toContain("Came from H-1  Back up the floppy disks\n")
    expect((await taxa(server, matt, "show", "H-1")).stdout).toContain(
      "Led to    H-2  Dispose of the disks\n          H-3  Upload the photos\n"
    )
    expect((await taxa(server, matt, "list", "--follows-on", "H-1")).stdout).toBe("H-2  Dispose of the disks\n")
  })

  it("finds tasks by words in their title, notes or tags", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", { domain: "H", notes: "Kitchen, dripping" })
    await matt.addTask("Paint the kitchen", { domain: "H" })
    await matt.addTask("Renew passport", { tags: ["Life Admin"] })
    expect((await taxa(server, matt, "list", "--search", "kitchen")).stdout).toBe(
      "H-2  Paint the kitchen\nH-1  Fix the tap\n"
    )
    expect((await taxa(server, matt, "list", "--search", "life admin")).stdout).toBe(
      "IN-3  Renew passport  (inbox, #Life Admin)\n"
    )
  })

  it("says when there's no such task, with its own exit code", async ({ server }) => {
    const matt = await mattAtHome(server)
    expect(await taxa(server, matt, "show", "M-99")).toMatchObject({
      exitCode: ExitCode.NOT_FOUND,
      stderr: expect.stringContaining("99")
    })
  })
})

describe("taxa edit and status commands", () => {
  const it = useInProcessServer()

  it("sets and clears fields", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", { due: "2026-01-09" })
    const run = await taxa(
      server,
      matt,
      "edit",
      "M-1",
      "--title",
      "Fix the kitchen tap",
      "--domain",
      "H",
      "--clear",
      "due"
    )
    expect(run.exitCode).toBe(ExitCode.OK)
    expect(await matt.client.task("1")).toMatchObject({ ref: "H-1", title: "Fix the kitchen tap", inbox: false })
    expect((await matt.client.task("1")).due).toBeUndefined()
  })

  it("tags tasks, lists them by tag, and renames a tag", async ({ server }) => {
    const matt = await mattAtHome(server)
    expect((await taxa(server, matt, "add", "Renew passport", "--tag", "Life Admin", "--tag", "errand")).stdout).toBe(
      "Added IN-1  Renew passport\n"
    )
    await matt.addTask("Fix the tap", { domain: "H" })
    expect((await taxa(server, matt, "edit", "H-2", "--tag", "life admin")).exitCode).toBe(ExitCode.OK)
    expect((await taxa(server, matt, "edit", "IN-1", "--untag", "ERRAND")).exitCode).toBe(ExitCode.OK)
    expect((await taxa(server, matt, "list", "--tag", "LIFE ADMIN")).stdout).toBe(
      "IN-1  Renew passport  (inbox, #Life Admin)\nH-2   Fix the tap  (#life admin)\n"
    )
    expect((await taxa(server, matt, "rename-tag", "life admin", "Admin")).stdout).toBe("Renamed it on 2 tasks.\n")
    expect((await taxa(server, matt, "tags")).stdout).toBe("Admin  (2 to do)\n")
  })

  it("adds to the notes, keeping what's there", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", { domain: "H", notes: "Washer, probably." })
    expect((await taxa(server, matt, "edit", "H-1", "--append-notes", "Rang the plumber: Tuesday.")).exitCode).toBe(
      ExitCode.OK
    )
    expect((await matt.client.task("H-1")).notes).toBe("Washer, probably.\n\nRang the plumber: Tuesday.")
    const both = await taxa(server, matt, "edit", "H-1", "--notes", "New", "--append-notes", "More")
    expect(both.exitCode).toBe(ExitCode.USAGE)
    expect(both.stderr).toContain("Set the notes or add to them, not both.")
  })

  it("takes changes as JSON on stdin", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap")
    const stdin = JSON.stringify({ set: { notes: "## Plan\n\n- Washer" } })
    await runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret }, ["edit", "M-1", "-"], { stdin })
    expect((await matt.client.task("1")).notes).toBe("## Plan\n\n- Washer")
  })

  it("refuses a change to a task that moved on since --if-version, with its own exit code", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap")
    await matt.client.updateTask("1", { set: { priority: Priority.HIGH } })
    const run = await taxa(server, matt, "edit", "1", "--priority", "low", "--if-version", "1")
    expect(run.exitCode).toBe(ExitCode.CONFLICT)
    expect((await matt.client.task("1")).priority).toBe(Priority.HIGH)
  })

  it("files a task, and puts it back in the Inbox", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Renew passport")
    await taxa(server, matt, "edit", "IN-1", "--domain", "h")
    expect(await matt.client.task("1")).toMatchObject({ ref: "H-1", inbox: false })
    await taxa(server, matt, "edit", "H-1", "--inbox")
    expect(await matt.client.task("1")).toMatchObject({ ref: "IN-1", inbox: true })
  })

  it("starts, waits on, finishes and deletes a task", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Get boiler quotes")
    expect((await taxa(server, matt, "start", "1")).stdout).toBe("Started IN-1  Get boiler quotes\n")
    await taxa(server, matt, "wait", "1", "--on", "Dave", "--follow-up", "+3d")
    expect(await matt.client.task("1")).toMatchObject({
      status: TaskStatus.WAITING,
      waitingOn: "Dave",
      followUp: "2026-01-08"
    })
    await taxa(server, matt, "done", "1")
    expect((await matt.client.task("1")).status).toBe(TaskStatus.DONE)
    await taxa(server, matt, "delete", "1")
    expect((await matt.client.task("1")).deletedAt).toBeDefined()
    await taxa(server, matt, "restore", "1")
    expect((await matt.client.task("1")).deletedAt).toBeUndefined()
  })

  it("logs who changed what", async ({ server }) => {
    const matt = await mattAtHome(server)
    const claude = await matt.agent("Claude Code", "mdr/taxa")
    await matt.addTask("Fix the tap")
    server.advance(60 * 60 * 1000)
    await runTaxaAs({ httpUrl: server.httpUrl, secret: claude.secret, agentContext: "mdr/taxa" }, [
      "edit",
      "1",
      "--priority",
      "high"
    ])
    expect((await taxa(server, matt, "log", "1")).stdout).toBe(
      "2026-01-05 09:00  Matt created this\n2026-01-05 10:00  Claude Code for Matt (mdr/taxa) set priority to high\n"
    )
  })
})

describe("taxa for people and agents", () => {
  const it = useInProcessServer()

  it("says who you are", async ({ server }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code")
    expect((await taxa(server, matt, "whoami")).stdout).toBe("Matt\n")
    expect((await runTaxaAs({ httpUrl: server.httpUrl, secret: claude.secret }, ["whoami"])).stdout).toBe(
      "Claude Code, an agent of Matt\n"
    )
  })

  it("adds and lists domains", async ({ server }) => {
    const matt = await server.user("Matt")
    await taxa(server, matt, "add-domain", "Home", "--prefix", "h")
    await taxa(server, matt, "add-domain", "Work", "--prefix", "W")
    expect((await taxa(server, matt, "domains")).stdout).toBe("H      Home\nW      Work\n")
  })

  it("makes an agent a key, printing only the secret", async ({ server }) => {
    const matt = await server.user("Matt")
    const agent = await matt.client.createAgent("Claude Code")
    const run = await taxa(server, matt, "add-key", "laptop", "--agent", agent.id)
    const secret = run.stdout.trim()
    expect(secret).toMatch(/^taxa_\S+$/)
    expect((await runTaxaAs({ httpUrl: server.httpUrl, secret }, ["whoami"])).stdout).toBe(
      "Claude Code, an agent of Matt\n"
    )
  })

  it("tells a caller without a key how to get one", async ({ server }) => {
    const run = await runTaxaAs({ httpUrl: server.httpUrl }, ["list"])
    expect(run.exitCode).toBe(ExitCode.FAILED)
    expect(run.stderr).toContain("TAXA_API_KEY")
  })
})
