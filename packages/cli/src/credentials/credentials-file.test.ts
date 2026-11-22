import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vite-plus/test"
import { credentialsPath, readCredentialsFile } from "./credentials-file.ts"

describe("the credentials file", () => {
  let folder: string | undefined
  afterEach(async () => {
    if (folder !== undefined) await rm(folder, { recursive: true })
  })

  it("is found by TAXA_CREDENTIALS, or in the XDG config folder", () => {
    expect(credentialsPath({ TAXA_CREDENTIALS: "/elsewhere/creds", XDG_CONFIG_HOME: "/cfg" })).toBe("/elsewhere/creds")
    expect(credentialsPath({ XDG_CONFIG_HOME: "/cfg" })).toBe("/cfg/taxa/credentials")
  })

  it("is read with its permissions, or is nothing when it's missing", async () => {
    folder = await mkdtemp(join(tmpdir(), "taxa-credentials-"))
    const path = join(folder, "credentials")
    expect(await readCredentialsFile(path)).toBeUndefined()
    await writeFile(path, "TAXA_API_KEY=taxa_abc\n")
    await chmod(path, 0o600)
    expect(await readCredentialsFile(path)).toEqual({ path, text: "TAXA_API_KEY=taxa_abc\n", mode: 0o600 })
  })
})
