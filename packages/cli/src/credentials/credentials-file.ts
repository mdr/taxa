import { readFile, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import type { CredentialsFile } from "./credentials.ts"

/** `TAXA_CREDENTIALS`, or `taxa/credentials` in the XDG config folder (`~/.config` by default). */
export const credentialsPath = (env: Record<string, string | undefined>): string =>
  env["TAXA_CREDENTIALS"] ?? join(env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config"), "taxa", "credentials")

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR")

/** The file at `path`, or nothing when there's none. */
export const readCredentialsFile = async (path: string): Promise<CredentialsFile | undefined> => {
  try {
    const [text, info] = await Promise.all([readFile(path, "utf8"), stat(path)])
    return { path, text, mode: info.mode & 0o777 }
  } catch (error) {
    if (isMissing(error)) return undefined
    throw error
  }
}
