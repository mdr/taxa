/** The credentials file: keys for you and your agents, so they needn't be handed one each time. */
export interface CredentialsFile {
  path: string
  text: string
  /** Its permission bits, such as 0o600. */
  mode: number
}

/** One identity in the file: who `--as NAME` acts as. */
interface Identity {
  key?: string
  server?: string
}

export interface Credentials {
  server?: string
  identities: Map<string, Identity>
}

/** Where `taxa` finds its server and key. */
export interface Connection {
  server: string
  apiKey: string | undefined
}

/** A credentials file `taxa` won't use, or an identity it doesn't have, with why. */
export class CredentialsError extends Error {}

/** The identity used when none is asked for: usually the person. */
const DEFAULT_IDENTITY = "default"

const unquoted = (value: string): string => /^(["'])(.*)\1$/.exec(value)?.[2] ?? value

const TOP_LEVEL = "expected server = …, or an identity such as [default]"
const IN_IDENTITY = "expected key = … or server = …"

/** Puts one `name = value` where it belongs, or says it doesn't belong anywhere. */
const settled = (credentials: Credentials, identity: Identity | undefined, name: string, value: string): boolean => {
  if (identity) {
    if (name !== "key" && name !== "server") return false
    identity[name] = value
  } else if (name === "server" || name === "TAXA_SERVER") credentials.server = value
  else if (name === "TAXA_API_KEY")
    credentials.identities.set(DEFAULT_IDENTITY, { ...credentials.identities.get(DEFAULT_IDENTITY), key: value })
  else return false
  return true
}

/**
 * Reads an INI file: `server = …` at the top, then `[name]` sections of
 * `key = …` and `server = …`. `#` starts a comment. The older one-identity
 * form, `TAXA_API_KEY=…` and `TAXA_SERVER=…` at the top, still works.
 */
export const parseCredentials = (file: CredentialsFile): Credentials => {
  if ((file.mode & 0o077) !== 0)
    throw new CredentialsError(`${file.path} can be read by others; it holds API keys. Run: chmod 600 ${file.path}`)
  const credentials: Credentials = { identities: new Map() }
  let current: Identity | undefined
  for (const [index, raw] of file.text.split("\n").entries()) {
    const line = raw.replace(/(^|\s)#.*$/, "").trim()
    if (line === "") continue
    const fail = (message: string): CredentialsError =>
      new CredentialsError(`${file.path}, line ${index + 1}: ${message}.`)
    const section = /^\[([a-z0-9][a-z0-9-]*)\]$/.exec(line)?.[1]
    if (section !== undefined) {
      if (credentials.identities.has(section)) throw fail(`[${section}] is here twice`)
      current = {}
      credentials.identities.set(section, current)
      continue
    }
    const [, name, value] = /^([A-Za-z_]+)\s*=\s*(.*)$/.exec(line) ?? []
    if (name === undefined || value === undefined || !settled(credentials, current, name, unquoted(value)))
      throw fail(current ? IN_IDENTITY : TOP_LEVEL)
  }
  return credentials
}

const identityNamed = (name: string | undefined, credentials: Credentials | undefined): Identity => {
  if (name === undefined) return credentials?.identities.get(DEFAULT_IDENTITY) ?? {}
  if (!credentials)
    throw new CredentialsError(`There's no identity "${name}": there's no credentials file (see taxa --help).`)
  const identity = credentials.identities.get(name)
  if (identity) return identity
  const names = [...credentials.identities.keys()]
  throw new CredentialsError(
    `There's no identity "${name}" in the credentials file${names.length > 0 ? `; it has ${names.join(", ")}` : ""}.`
  )
}

/**
 * The server and key to use. The key: `--as NAME`'s, else TAXA_API_KEY,
 * else TAXA_AS's identity, else [default]'s. The server: `--server`, else
 * TAXA_SERVER, else the identity's, else the file's, else the default.
 */
export const connectionFrom = (
  options: { server: string | undefined; as: string | undefined },
  env: Record<string, string | undefined>,
  credentials: Credentials | undefined,
  defaultServer: string
): Connection => {
  const envKey = options.as === undefined ? env["TAXA_API_KEY"] : undefined
  const identity = envKey === undefined ? identityNamed(options.as ?? env["TAXA_AS"], credentials) : {}
  return {
    server: options.server ?? env["TAXA_SERVER"] ?? identity.server ?? credentials?.server ?? defaultServer,
    apiKey: envKey ?? identity.key
  }
}
