/** The credentials file: a key, and optionally a server, kept so agents needn't be given them each time. */
export interface CredentialsFile {
  path: string
  text: string
  /** Its permission bits, such as 0o600. */
  mode: number
}

export interface Credentials {
  apiKey?: string
  server?: string
}

/** Where `taxa` finds its server and key: the environment first, then the credentials file. */
export interface Connection {
  server: string
  apiKey: string | undefined
}

/** A credentials file `taxa` won't use, with why. */
export class CredentialsError extends Error {}

const NAMES: Record<string, keyof Credentials> = { TAXA_API_KEY: "apiKey", TAXA_SERVER: "server" }

const unquoted = (value: string): string => /^(["'])(.*)\1$/.exec(value)?.[2] ?? value

/** Reads `NAME=value` lines, as in an env file; `#` starts a comment line. */
export const parseCredentials = (file: CredentialsFile): Credentials => {
  if ((file.mode & 0o077) !== 0)
    throw new CredentialsError(`${file.path} can be read by others; it holds an API key. Run: chmod 600 ${file.path}`)
  const credentials: Credentials = {}
  for (const [index, line] of file.text.split("\n").entries()) {
    const trimmed = line.trim()
    if (trimmed === "" || trimmed.startsWith("#")) continue
    const match = /^(?:export\s+)?([A-Z_]+)\s*=\s*(.*)$/.exec(trimmed)
    const field = match && NAMES[match[1]!]
    if (!match || !field)
      throw new CredentialsError(
        `${file.path}, line ${index + 1}: expected TAXA_API_KEY=… or TAXA_SERVER=…, and nothing else.`
      )
    credentials[field] = unquoted(match[2]!.trim())
  }
  return credentials
}

/** The server and key to use: `--server`, then the environment, then the file, then the default server. */
export const connectionFrom = (
  serverOption: string | undefined,
  env: Record<string, string | undefined>,
  file: Credentials,
  defaultServer: string
): Connection => ({
  server: serverOption ?? env["TAXA_SERVER"] ?? file.server ?? defaultServer,
  apiKey: env["TAXA_API_KEY"] ?? file.apiKey
})
