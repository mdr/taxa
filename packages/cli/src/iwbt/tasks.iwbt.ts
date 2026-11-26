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
    expect(await taxa(server, matt, "add", "Renew", "passport", "--domain", "m")).toEqual({
      exitCode: ExitCode.OK,
      stdout: "Added M-1  Renew passport\nhttp://localhost:5173/tasks/M-1\n",
      stderr: ""
    })
  })

  it("links to the task in the web app TAXA_WEB names", async ({ server }) => {
    const matt = await mattAtHome(server)
    const run = await runTaxaAs(
      { httpUrl: server.httpUrl, secret: matt.secret },
      ["add", "Renew passport", "--domain", "M"],
      {
        env: { TAXA_WEB: "https://taxa.example/" }
      }
    )
    expect(run.stdout).toBe("Added M-1  Renew passport\nhttps://taxa.example/tasks/M-1\n")
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
      // Said nothing of when it's for, so still to sort out.
      inbox: true
    })
  })

  it("adds tasks from JSON on stdin, printing the API's JSON with --json", async ({ server }) => {
    const matt = await mattAtHome(server)
    const stdin = JSON.stringify([
      { title: "One", domain: "H" },
      { title: "Two", domain: "M", due: "2026-02-01" }
    ])
    const run = await runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret }, ["add", "-", "--json"], { stdin })
    expect(run.exitCode).toBe(ExitCode.OK)
    expect((JSON.parse(run.stdout) as (Task & { url: string })[]).map(({ ref, due, url }) => [ref, due, url])).toEqual([
      ["H-1", undefined, "http://localhost:5173/tasks/H-1"],
      ["M-2", "2026-02-01", "http://localhost:5173/tasks/M-2"]
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
    await matt.addTask("Renew passport", { domain: "M" })
    await matt.addTask("Fix the tap", { domain: "H", priority: Priority.URGENT, due: "2026-01-09", inbox: false })
    const run = await taxa(server, matt, "list")
    expect(run.stdout).toBe("H-2  Fix the tap  (urgent, due Fri 9 Jan)\nM-1  Renew passport  (inbox)\n")
    expect((await taxa(server, matt, "list", "--domain", "H")).stdout).toBe(
      "H-2  Fix the tap  (urgent, due Fri 9 Jan)\n"
    )
    expect((await taxa(server, matt, "list", "--inbox")).stdout).toBe("M-1  Renew passport  (inbox)\n")
  })

  it("gives each task's link in the web app with --json", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", { domain: "H", inbox: false })
    const listed = JSON.parse((await taxa(server, matt, "list", "--json")).stdout) as { url: string }[]
    expect(listed.map(({ url }) => url)).toEqual(["http://localhost:5173/tasks/H-1"])
    const shown = JSON.parse((await taxa(server, matt, "show", "H-1", "--json")).stdout) as { url: string }
    expect(shown.url).toBe("http://localhost:5173/tasks/H-1")
    const started = JSON.parse((await taxa(server, matt, "start", "H-1", "--json")).stdout) as { url: string }
    expect(started.url).toBe("http://localhost:5173/tasks/H-1")
  })

  it("lists deadlines with --due: tasks with a due date, soonest first", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", { domain: "H", inbox: false, priority: Priority.URGENT, due: "2026-02-01" })
    await matt.addTask("Renew passport", { domain: "M", horizon: Horizon.SOMEDAY, due: "2026-01-09" })
    await matt.addTask("Tidy the shed", { domain: "H", inbox: false })
    expect((await taxa(server, matt, "list", "--due")).stdout).toBe(
      "M-2  Renew passport  (due Fri 9 Jan)\nH-1  Fix the tap  (urgent, due Sun 1 Feb)\n"
    )
  })

  it("lists finished tasks when asked", async ({ server }) => {
    const matt = await mattAtHome(server)
    const { ref } = await matt.addTask("Renew passport", { domain: "M" })
    await matt.client.changeStatus(ref, { status: TaskStatus.DONE })
    expect((await taxa(server, matt, "list")).stdout).toBe("No tasks.\n")
    expect((await taxa(server, matt, "list", "--status", "done")).stdout).toBe("M-1  Renew passport  (done, inbox)\n")
  })

  it("shows everything about a task", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", {
      domain: "H",
      inbox: false,
      due: "2026-01-09",
      estimateMinutes: 30,
      notes: "Washer, *probably*."
    })
    expect((await taxa(server, matt, "show", "1")).stdout).toBe(
      [
        "H-1  Fix the tap",
        "http://localhost:5173/tasks/H-1",
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
    const disks = await matt.addTask("Back up the floppy disks", { domain: "H", inbox: false })
    await matt.addTask("Dispose of the disks", { domain: "H", inbox: false, followsOn: disks.ref })
    await matt.addTask("Upload the photos", {
      domain: "H",
      inbox: false,
      followsOn: disks.ref,
      horizon: Horizon.SOMEDAY
    })
    expect((await taxa(server, matt, "show", "H-2")).stdout).toContain("Came from H-1  Back up the floppy disks\n")
    expect((await taxa(server, matt, "show", "H-1")).stdout).toContain(
      "Led to    H-2  Dispose of the disks\n          H-3  Upload the photos\n"
    )
    expect((await taxa(server, matt, "list", "--follows-on", "H-1")).stdout).toBe("H-2  Dispose of the disks\n")
  })

  it("finds tasks by words in their title, notes or tags", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", { domain: "H", inbox: false, notes: "Kitchen, dripping" })
    await matt.addTask("Paint the kitchen", { domain: "H", inbox: false })
    await matt.addTask("Renew passport", { domain: "M", tags: ["Life Admin"] })
    expect((await taxa(server, matt, "list", "--search", "kitchen")).stdout).toBe(
      "H-2  Paint the kitchen\nH-1  Fix the tap\n"
    )
    expect((await taxa(server, matt, "list", "--search", "life admin")).stdout).toBe(
      "M-3  Renew passport  (inbox, #Life Admin)\n"
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
    await matt.addTask("Fix the tap", { domain: "M", due: "2026-01-09" })
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
    expect(await matt.client.task("1")).toMatchObject({ ref: "H-1", title: "Fix the kitchen tap" })
    expect((await matt.client.task("1")).due).toBeUndefined()
  })

  it("tags tasks, lists them by tag, and renames a tag", async ({ server }) => {
    const matt = await mattAtHome(server)
    expect(
      (await taxa(server, matt, "add", "Renew passport", "--domain", "m", "--tag", "Life Admin", "--tag", "errand"))
        .stdout
    ).toBe("Added M-1  Renew passport\nhttp://localhost:5173/tasks/M-1\n")
    await matt.addTask("Fix the tap", { domain: "H", inbox: false })
    expect((await taxa(server, matt, "edit", "H-2", "--tag", "life admin")).exitCode).toBe(ExitCode.OK)
    expect((await taxa(server, matt, "edit", "M-1", "--untag", "ERRAND")).exitCode).toBe(ExitCode.OK)
    expect((await taxa(server, matt, "list", "--tag", "LIFE ADMIN")).stdout).toBe(
      "M-1  Renew passport  (inbox, #Life Admin)\nH-2  Fix the tap  (#life admin)\n"
    )
    expect((await taxa(server, matt, "rename-tag", "life admin", "Admin")).stdout).toBe("Renamed it on 2 tasks.\n")
    expect((await taxa(server, matt, "tags")).stdout).toBe("Admin  (2 to do)\n")
  })

  it("adds to the notes, keeping what's there", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", { domain: "H", inbox: false, notes: "Washer, probably." })
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
    await matt.addTask("Fix the tap", { domain: "M" })
    const stdin = JSON.stringify({ set: { notes: "## Plan\n\n- Washer" } })
    await runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret }, ["edit", "M-1", "-"], { stdin })
    expect((await matt.client.task("1")).notes).toBe("## Plan\n\n- Washer")
  })

  it("refuses a change to a task that moved on since --if-version, with its own exit code", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Fix the tap", { domain: "M" })
    await matt.client.updateTask("1", { set: { priority: Priority.HIGH } })
    const run = await taxa(server, matt, "edit", "1", "--priority", "low", "--if-version", "1")
    expect(run.exitCode).toBe(ExitCode.CONFLICT)
    expect((await matt.client.task("1")).priority).toBe(Priority.HIGH)
  })

  it("files a task, and puts it back in the Inbox", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Renew passport", { domain: "M" })
    const filed = await taxa(server, matt, "file", "M-1", "--domain", "h")
    expect(filed.stdout).toContain("Domain    Home\n")
    expect(await matt.client.task("1")).toMatchObject({ ref: "H-1", inbox: false })
    await taxa(server, matt, "edit", "H-1", "--inbox")
    expect(await matt.client.task("1")).toMatchObject({ ref: "H-1", inbox: true })
    expect((await taxa(server, matt, "show", "1")).stdout).toContain("Domain    Home, in your Inbox to sort out\n")
    await taxa(server, matt, "edit", "H-1", "--filed")
    expect(await matt.client.task("1")).toMatchObject({ inbox: false })
    expect((await taxa(server, matt, "edit", "1", "--inbox", "--filed")).exitCode).toBe(ExitCode.USAGE)
  })

  it("says which domain a task goes in, when there's more than one", async ({ server }) => {
    const matt = await mattAtHome(server)
    expect(await taxa(server, matt, "add", "Renew passport")).toMatchObject({
      exitCode: ExitCode.USAGE,
      stderr: expect.stringContaining("Say which domain it goes in: M, H.")
    })
  })

  it("starts, waits on, finishes and deletes a task", async ({ server }) => {
    const matt = await mattAtHome(server)
    await matt.addTask("Get boiler quotes", { domain: "M" })
    expect((await taxa(server, matt, "start", "1")).stdout).toBe("Started M-1  Get boiler quotes\n")
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
    await matt.addTask("Fix the tap", { domain: "M" })
    server.advance(60 * 60 * 1000)
    await runTaxaAs({ httpUrl: server.httpUrl, secret: claude.secret, agentContext: "mdr/taxa" }, [
      "edit",
      "1",
      "--priority",
      "high"
    ])
    expect((await taxa(server, matt, "log", "1")).stdout).toBe(
      "1  2026-01-05 09:00  Matt created this\n2  2026-01-05 10:00  Claude Code for Matt (mdr/taxa) set priority to high\n"
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

  it("deletes a domain once its tasks have moved out", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    await matt.addDomain("Personal", "P")
    await matt.addTask("Fix the tap", { domain: "H", inbox: false })
    const refused = await taxa(server, matt, "delete-domain", "H")
    expect(refused.exitCode).not.toBe(ExitCode.OK)
    expect(refused.stderr).toContain("Home still has a task (H-1)")
    await taxa(server, matt, "edit", "H-1", "--domain", "P")
    expect((await taxa(server, matt, "delete-domain", "h")).stdout).toBe("Deleted Home (H)\n")
    expect((await taxa(server, matt, "domains")).stdout).toBe("P      Personal\n")
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
