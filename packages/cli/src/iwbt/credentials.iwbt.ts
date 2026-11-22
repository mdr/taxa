import { describe, expect } from "vite-plus/test"
import { useInProcessServer } from "@taxa/server/src/test-support/use-in-process-server"
import { ExitCode } from "../cli-io.ts"
import { runTaxaAs } from "../test-support/test-cli.ts"

const PATH = "/home/matt/.config/taxa/credentials"

describe("the credentials file", () => {
  const it = useInProcessServer()

  it("gives taxa a key when the environment doesn't", async ({ server }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code")
    const credentials = { path: PATH, text: `TAXA_API_KEY=${claude.secret}\n`, mode: 0o600 }
    expect((await runTaxaAs({ httpUrl: server.httpUrl }, ["whoami"], { credentials })).stdout).toBe(
      "Claude Code, an agent of Matt\n"
    )
    expect(
      (await runTaxaAs({ httpUrl: server.httpUrl, secret: matt.secret }, ["whoami"], { credentials })).stdout
    ).toBe("Matt\n")
  })

  it("isn't used while others can read it", async ({ server }) => {
    const claude = await (await server.user("Matt")).agent("Claude Code")
    const run = await runTaxaAs({ httpUrl: server.httpUrl }, ["whoami"], {
      credentials: { path: PATH, text: `TAXA_API_KEY=${claude.secret}\n`, mode: 0o644 }
    })
    expect(run.exitCode).toBe(ExitCode.FAILED)
    expect(run.stderr).toBe(`${PATH} can be read by others; it holds an API key. Run: chmod 600 ${PATH}\n`)
    expect(run.stdout).toBe("")
  })
})
