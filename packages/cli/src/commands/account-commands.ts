import { ExitCode } from "../cli-io.ts"
import { oneArgument, print, stringOption, UsageError, type Command } from "../command.ts"

const whoami: Command = {
  name: "whoami",
  summary: "Who the server thinks you are",
  usage: "",
  options: {},
  run: async (context) => {
    const me = await context.client.me()
    print(context, me, () => (me.agent ? `${me.agent.name}, an agent of ${me.user.name}` : me.user.name))
    return ExitCode.OK
  }
}

const domains: Command = {
  name: "domains",
  summary: "List your domains",
  usage: "",
  options: {},
  run: async (context) => {
    const [all, me] = await Promise.all([context.client.domains(), context.client.me()])
    print(context, all, () =>
      all.length === 0
        ? "No domains yet: add one with taxa add-domain <name> --prefix <letters>."
        : all
            .map(
              ({ id, prefix, name }) =>
                `${prefix.padEnd(5)}  ${name}${id === me.user.defaultDomainId ? "  (default)" : ""}`
            )
            .join("\n")
    )
    return ExitCode.OK
  }
}

const addDomain: Command = {
  name: "add-domain",
  summary: "Add a domain, such as Home or Work",
  usage: `<name> --prefix LETTERS
  --prefix LETTERS      1 to 5 letters that start its tasks' references (H for H-142)`,
  options: { prefix: { type: "string" } },
  run: async (context, values, positionals) => {
    const name = positionals.join(" ").trim()
    const prefix = stringOption(values, "prefix")
    if (name === "") throw new UsageError("Give the domain a name.")
    if (prefix === undefined) throw new UsageError("Give the domain a --prefix, e.g. --prefix H.")
    const domain = await context.client.createDomain({ name, prefix })
    print(context, domain, () => `Added ${domain.name} (${domain.prefix})`)
    return ExitCode.OK
  }
}

const agents: Command = {
  name: "agents",
  summary: "List your agents",
  usage: "",
  options: {},
  run: async (context) => {
    const all = await context.client.agents()
    print(context, all, () =>
      all.length === 0 ? "No agents yet." : all.map(({ id, name }) => `${id}  ${name}`).join("\n")
    )
    return ExitCode.OK
  }
}

const addAgent: Command = {
  name: "add-agent",
  summary: "Add an agent, such as Claude Code, to act for you with keys of its own",
  usage: "<name>",
  options: {},
  run: async (context, _values, positionals) => {
    const name = positionals.join(" ").trim()
    if (name === "") throw new UsageError("Give the agent a name.")
    const agent = await context.client.createAgent(name)
    print(
      context,
      agent,
      () => `Added agent ${agent.name} (${agent.id}). Give it a key with taxa add-key --agent ${agent.id}`
    )
    return ExitCode.OK
  }
}

const keys: Command = {
  name: "keys",
  summary: "List your API keys and your agents'",
  usage: "",
  options: {},
  run: async (context) => {
    const [all, everyAgent] = await Promise.all([context.client.keys(), context.client.agents()])
    const agentName = (id: string | undefined): string => everyAgent.find((agent) => agent.id === id)?.name ?? "you"
    print(context, all, () =>
      all.length === 0
        ? "No API keys yet."
        : all
            .map(
              ({ id, name, prefix, agentId, revokedAt }) =>
                `${id}  ${prefix}…  ${name}, for ${agentName(agentId)}${revokedAt ? "  (revoked)" : ""}`
            )
            .join("\n")
    )
    return ExitCode.OK
  }
}

const addKey: Command = {
  name: "add-key",
  summary: "Make an API key and print its secret, which is never shown again",
  usage: `<name> [--agent ID]
  --agent ID            Make it for this agent, so it acts as the agent`,
  options: { agent: { type: "string" } },
  run: async (context, values, positionals) => {
    const name = positionals.join(" ").trim()
    if (name === "") throw new UsageError("Give the key a name, such as where it's used.")
    const key = await context.client.createKey(name, stringOption(values, "agent"))
    // The secret alone, so it can be piped straight into a password manager.
    print(context, key, () => key.secret)
    return ExitCode.OK
  }
}

const revokeKey: Command = {
  name: "revoke-key",
  summary: "Revoke an API key",
  usage: "<id>",
  options: {},
  run: async (context, _values, positionals) => {
    const key = await context.client.revokeKey(oneArgument(positionals, "key"))
    print(context, key, () => `Revoked ${key.name}`)
    return ExitCode.OK
  }
}

export const ACCOUNT_COMMANDS: Command[] = [whoami, domains, addDomain, agents, addAgent, keys, addKey, revokeKey]
