import { describe, expect } from "vite-plus/test"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { ExitCode } from "../cli-io.ts"
import { runTaxaAs } from "../test-support/test-cli.ts"

const PATH = "/home/matt/.config/taxa/credentials"

describe("the credentials file", () => {
  const it = useInProcessServer()

  it("acts as you by default, and as an agent when asked", async ({ server }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code")
    const credentials = {
      path: PATH,
      text: `[default]\nkey = ${matt.secret}\n\n[claude-code]\nkey = ${claude.secret}\n`,
      mode: 0o600
    }
    const whoami = async (argv: string[], env: Record<string, string> = {}): Promise<string> =>
      (await runTaxaAs({ httpUrl: server.httpUrl }, argv, { credentials, env })).stdout
    expect(await whoami(["whoami"])).toBe("Matt\n")
    expect(await whoami(["whoami", "--as", "claude-code"])).toBe("Claude Code, an agent of Matt\n")
    expect(await whoami(["whoami"], { TAXA_AS: "claude-code" })).toBe("Claude Code, an agent of Matt\n")
  })

  it("says so, and does nothing, for an identity it doesn't have", async ({ server }) => {
    const matt = await server.user("Matt")
    const run = await runTaxaAs({ httpUrl: server.httpUrl }, ["add", "Fix the tap", "--as", "claude"], {
      credentials: { path: PATH, text: `[default]\nkey = ${matt.secret}\n`, mode: 0o600 }
    })
    expect(run.exitCode).toBe(ExitCode.FAILED)
    expect(run.stderr).toBe('There\'s no identity "claude" in the credentials file; it has default.\n')
    expect(await matt.client.tasks({})).toEqual([])
  })

  it("isn't used while others can read it", async ({ server }) => {
    const claude = await (await server.user("Matt")).agent("Claude Code")
    const run = await runTaxaAs({ httpUrl: server.httpUrl }, ["whoami"], {
      credentials: { path: PATH, text: `[default]\nkey = ${claude.secret}\n`, mode: 0o644 }
    })
    expect(run.exitCode).toBe(ExitCode.FAILED)
    expect(run.stderr).toBe(`${PATH} can be read by others; it holds API keys. Run: chmod 600 ${PATH}\n`)
  })
})
