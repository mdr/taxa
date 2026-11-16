import { describe, expect, it } from "vite-plus/test"
import { runCli } from "./cli.ts"
import { ExitCode } from "./cli-io.ts"

const run = async (...argv: string[]): Promise<{ exitCode: ExitCode; stderr: string }> => {
  let stderr = ""
  const exitCode = await runCli(argv, { env: {}, stdout: () => undefined, stderr: (text) => (stderr += text) })
  return { exitCode, stderr }
}

describe("runCli", () => {
  it("shows usage with no command", async () => {
    expect(await run()).toEqual({ exitCode: ExitCode.USAGE, stderr: expect.stringContaining("Usage: taxa") })
  })

  it("names an unknown command", async () => {
    expect((await run("frobnicate")).stderr).toContain("Unknown command: frobnicate")
  })

  it("names an unknown option", async () => {
    const { exitCode, stderr } = await run("health", "--loud")
    expect(exitCode).toBe(ExitCode.USAGE)
    expect(stderr).toContain("--loud")
  })
})
