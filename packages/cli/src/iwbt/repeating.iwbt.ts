import { describe, expect } from "vite-plus/test"
import type { InProcessServer } from "@taxa/server/src/test-support/in-process-server"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { RepeatFrom, RepeatUnit } from "@taxa/shared/tasks/repeat"
import { ExitCode } from "../cli-io.ts"
import { runTaxaAs, type CliRun } from "../test-support/test-cli.ts"

// The clock starts on Monday 5 January 2026.
describe("repeating tasks in the CLI", () => {
  const it = useInProcessServer()

  const taxaAs = (server: InProcessServer, secret: string, argv: string[]): Promise<CliRun> =>
    runTaxaAs({ httpUrl: server.httpUrl, secret, clock: server.clock }, argv)

  it("are added with --repeat, done and skipped each time, and shown with what's happened lately", async ({
    server
  }) => {
    const matt = await server.user("Matt")
    await taxaAs(server, matt.secret, ["add", "Revise Anki cards", "--repeat", "every day"])
    expect(await matt.client.task("IN-1")).toMatchObject({ scheduled: "2026-01-05", repeat: { every: 1 } })

    expect((await taxaAs(server, matt.secret, ["done", "IN-1"])).stdout).toBe(
      "Done IN-1 for Mon 5 Jan; next Tue 6 Jan  Revise Anki cards\n"
    )
    expect((await taxaAs(server, matt.secret, ["skip", "IN-1"])).stdout).toMatch(
      /^Skipped IN-1 for Tue 6 Jan; next Wed 7 Jan /
    )
    const shown = (await taxaAs(server, matt.secret, ["show", "IN-1"])).stdout
    expect(shown).toContain("Repeats   Every day")
    expect(shown).toContain("Lately\n  Tue 6 Jan  skipped (on Mon 5 Jan)\n  Mon 5 Jan  done")

    const cancelled = await taxaAs(server, matt.secret, ["cancel", "IN-1"])
    expect(cancelled.exitCode).not.toBe(ExitCode.OK)
    expect(cancelled.stderr).toContain("taxa skip IN-1")
  })

  it("stop repeating with --repeat none, or when done for good", async ({ server }) => {
    const matt = await server.user("Matt")
    const gym = await matt.addTask("Go to the gym")
    await taxaAs(server, matt.secret, ["edit", gym.ref, "--repeat", "every monday and thursday"])
    expect((await matt.client.task(gym.ref)).repeat?.weekdays).toEqual(["MONDAY", "THURSDAY"])
    await taxaAs(server, matt.secret, ["edit", gym.ref, "--repeat", "none"])
    expect((await matt.client.task(gym.ref)).repeat).toBeUndefined()

    const anki = await matt.addTask("Revise Anki cards", {
      repeat: { every: 1, unit: RepeatUnit.DAY, from: RepeatFrom.SCHEDULE }
    })
    await taxaAs(server, matt.secret, ["done", anki.ref, "--stop-repeating"])
    expect(await matt.client.task(anki.ref)).toMatchObject({ status: TaskStatus.DONE })
    expect((await taxaAs(server, matt.secret, ["skip", gym.ref])).exitCode).toBe(ExitCode.USAGE)

    const wrong = await taxaAs(server, matt.secret, ["edit", gym.ref, "--repeat", "now and then"])
    expect(wrong.exitCode).toBe(ExitCode.USAGE)
    expect(wrong.stderr).toContain("every weekday")
  })
})
