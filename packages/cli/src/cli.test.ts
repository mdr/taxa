import { timeZone } from "@taxa/shared/dates/plain-date"
import { describe, expect, it } from "vite-plus/test"
import { runCli } from "./cli.ts"
import { ExitCode } from "./cli-io.ts"

const run = async (...argv: string[]): Promise<{ exitCode: ExitCode; stdout: string; stderr: string }> => {
  let stdout = ""
  let stderr = ""
  const exitCode = await runCli(argv, {
    env: {},
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    readStdin: () => Promise.resolve(""),
    readCredentials: () => Promise.resolve(undefined),
    now: () => 0,
    timeZone: timeZone("UTC")
  })
  return { exitCode, stdout, stderr }
}

describe("runCli", () => {
  it("shows usage with no command", async () => {
    expect(await run()).toMatchObject({ exitCode: ExitCode.USAGE, stderr: expect.stringContaining("Usage: taxa") })
  })

  it("shows usage on stdout when asked", async () => {
    expect(await run("--help")).toMatchObject({ exitCode: ExitCode.OK, stdout: expect.stringContaining("add-domain") })
  })

  it("explains a command", async () => {
    expect(await run("add", "--help")).toMatchObject({
      exitCode: ExitCode.OK,
      stdout: expect.stringContaining("--due DATE")
    })
  })

  it("names an unknown command", async () => {
    expect((await run("frobnicate")).stderr).toContain("Unknown command: frobnicate")
  })

  it.each([["health"], ["list"]])("names an unknown option to %s", async (command) => {
    const { exitCode, stderr } = await run(command, "--loud")
    expect(exitCode).toBe(ExitCode.USAGE)
    expect(stderr).toContain("--loud")
  })

  it("explains a bad date before calling the server", async () => {
    const { exitCode, stderr } = await run("add", "Pay council tax", "--due", "someday")
    expect(exitCode).toBe(ExitCode.USAGE)
    expect(stderr).toContain("--due must be")
  })
})
