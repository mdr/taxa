import { describe, expect } from "vite-plus/test"
import type { InProcessServer } from "@taxa/server/src/test-support/in-process-server"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { ExitCode } from "../cli-io.ts"
import { runTaxaAs, type CliRun } from "../test-support/test-cli.ts"

const MINUTE = 60 * 1000

describe("taxa comment", () => {
  const it = useInProcessServer()

  const taxaAs = (server: InProcessServer, secret: string, argv: string[], stdin?: string): Promise<CliRun> =>
    runTaxaAs({ httpUrl: server.httpUrl, secret, clock: server.clock, agentContext: "mdr/taxa" }, argv, { stdin })

  it("adds a comment, leaving the task as it is, and says where it is", async ({ server }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code")
    const tap = await matt.addTask("Fix the tap", { notes: "The kitchen one" })
    expect(await taxaAs(server, claude.secret, ["comment", tap.ref, "Found", "the", "part"])).toEqual({
      exitCode: ExitCode.OK,
      stdout: "Commented on IN-1  Fix the tap\nhttp://localhost:5173/tasks/IN-1\n",
      stderr: ""
    })
    expect(await matt.client.comments(tap.ref)).toMatchObject([
      { body: "Found the part", author: { agent: { name: "Claude Code" }, agentContext: "mdr/taxa" } }
    ])
    expect(await matt.client.task(tap.ref)).toMatchObject({ notes: "The kitchen one", version: tap.version })
  })

  it("reads Markdown from stdin with -", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    await taxaAs(server, matt.secret, ["comment", tap.ref, "-"], "Done so far:\n\n- bought washers\n")
    expect((await matt.client.comments(tap.ref))[0]?.body).toBe("Done so far:\n\n- bought washers")
  })

  it("says what's wrong without a task or text", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    expect((await taxaAs(server, matt.secret, ["comment"])).exitCode).toBe(ExitCode.USAGE)
    expect((await taxaAs(server, matt.secret, ["comment", tap.ref])).exitCode).toBe(ExitCode.USAGE)
    expect((await taxaAs(server, matt.secret, ["comment", "H-999", "Hello"])).exitCode).toBe(ExitCode.NOT_FOUND)
  })

  it("lists them oldest first, and show gives the latest three", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    for (const body of ["Rang the plumber", "He's coming Thursday", "Bought washers", "Fixed it"]) {
      await matt.client.addComment(tap.ref, { body })
      server.advance(MINUTE)
    }
    const ids = (await matt.client.comments(tap.ref)).map(({ id }) => id)
    const listed = await taxaAs(server, matt.secret, ["comments", tap.ref])
    expect(listed.stdout).toBe(
      [
        `2026-01-05 09:00  Matt  ${ids[0]}`,
        "  Rang the plumber",
        "",
        `2026-01-05 09:01  Matt  ${ids[1]}`,
        "  He's coming Thursday",
        "",
        `2026-01-05 09:02  Matt  ${ids[2]}`,
        "  Bought washers",
        "",
        `2026-01-05 09:03  Matt  ${ids[3]}`,
        "  Fixed it",
        ""
      ].join("\n")
    )
    const shown = (await taxaAs(server, matt.secret, ["show", tap.ref])).stdout
    expect(shown).toContain("Comments, the latest 3 (all 4: taxa comments IN-1)")
    expect(shown).not.toContain("Rang the plumber")
    expect(shown).toContain("  Fixed it\n")
    const json = JSON.parse((await taxaAs(server, matt.secret, ["comments", tap.ref, "--json"])).stdout) as unknown[]
    expect(json).toHaveLength(4)
  })

  it("edits, deletes and restores a comment of the caller's own, by its id", async ({ server }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code")
    const tap = await matt.addTask("Fix the tap")
    const its = await claude.client.addComment(tap.ref, { body: "Found the prat" })
    const mine = await matt.client.addComment(tap.ref, { body: "Thanks" })

    expect(await taxaAs(server, claude.secret, ["edit-comment", its.id, "Found", "the", "part"])).toEqual({
      exitCode: ExitCode.OK,
      stdout: "Edited the comment.\n",
      stderr: ""
    })
    expect((await taxaAs(server, claude.secret, ["edit-comment", its.id, "--if-version", "1", "Again"])).exitCode).toBe(
      ExitCode.CONFLICT
    )
    await taxaAs(server, claude.secret, ["edit-comment", its.id, "-"], "Found the part:\n\n- 15mm\n")
    expect((await taxaAs(server, claude.secret, ["edit-comment", mine.id, "Hacked"])).exitCode).toBe(ExitCode.FAILED)
    expect((await taxaAs(server, claude.secret, ["edit-comment", "nonsense", "Hi"])).exitCode).toBe(ExitCode.USAGE)

    const deleted = await taxaAs(server, claude.secret, ["delete-comment", its.id])
    expect(deleted.stdout).toBe(`Deleted the comment. taxa restore-comment ${its.id} brings it back.\n`)
    expect((await matt.client.comments(tap.ref)).map(({ body }) => body)).toEqual(["Thanks"])
    await taxaAs(server, claude.secret, ["restore-comment", its.id])
    expect((await matt.client.comments(tap.ref)).map(({ body }) => body)).toEqual([
      "Found the part:\n\n- 15mm",
      "Thanks"
    ])
  })
})
