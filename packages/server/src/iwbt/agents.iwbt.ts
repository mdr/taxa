import { timeZone } from "@taxa/shared/dates/plain-date"
import { describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { TaxaClient } from "@taxa/shared/api/taxa-client"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { OPENAPI_PATH } from "../app.ts"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

describe("agents", () => {
  const it = useInProcessServer()

  it("keep a person's time zone up to date from where they call from, but not from where an agent runs", async ({
    server
  }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code")
    const from = (secret: string, zone: string): TaxaClient =>
      new TaxaClient({ baseUrl: server.httpUrl, apiKey: secret, timeZone: () => timeZone(zone) })
    const before = (await matt.client.me()).user.timeZone

    await from(claude.secret, "Pacific/Auckland").me()
    expect((await matt.client.me()).user.timeZone).toBe(before)
    expect((await from(matt.secret, "America/New_York").me()).user.timeZone).toBe("America/New_York")
    expect((await matt.client.me()).user.timeZone).toBe("America/New_York")
    expect((await claude.client.me()).user.timeZone).toBe("America/New_York")
    expect(server.logs.filter(({ code }) => code === "user.movedTimeZone")).toHaveLength(1)
  })

  it("act for their person, and are named as themselves in the activity log", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const claude = await matt.agent("Claude Code", "mdr/taxa repo")
    expect(await claude.client.me()).toMatchObject({ user: { name: "Matt" }, agent: { name: "Claude Code" } })
    const task = await claude.addTask("Research boiler engineers")
    const working = await claude.client.changeStatus(task.ref, { status: TaskStatus.IN_PROGRESS })
    expect(working.inProgressBy).toMatchObject({
      user: { name: "Matt" },
      agent: { name: "Claude Code" },
      agentContext: "mdr/taxa repo"
    })
    const [created] = await matt.client.activity(task.ref)
    expect(created?.actor).toMatchObject({
      user: { name: "Matt" },
      agent: { name: "Claude Code" },
      agentContext: "mdr/taxa repo"
    })
  })

  it("can't manage agents or keys", async ({ server }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code")
    await expectProblem(claude.client.createAgent("Sneaky"), ProblemType.FORBIDDEN)
    await expectProblem(claude.client.keys(), ProblemType.FORBIDDEN)
  })

  it("stop working when their key is revoked", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const agent = await matt.client.createAgent("Morning briefing")
    const key = await matt.client.createKey("briefing", agent.id)
    const briefing = new TaxaClient({ baseUrl: server.httpUrl, apiKey: key.secret })
    expect(await briefing.tasks()).toEqual([])
    await matt.client.revokeKey(key.id)
    await expectProblem(briefing.tasks(), ProblemType.UNAUTHENTICATED)
    expect((await matt.client.keys()).find(({ id }) => id === key.id)?.revokedAt).toBe("2026-01-05T09:00:00.000Z")
  })

  it("show only the start of a key once it's made", async ({ server }) => {
    const matt = await server.user("Matt")
    const key = await matt.client.createKey("laptop")
    expect(key.secret).toMatch(/^taxa_/)
    const listed = (await matt.client.keys()).find(({ id }) => id === key.id)
    expect(listed).toEqual({ id: key.id, name: "laptop", prefix: key.secret.slice(0, 12), createdAt: key.createdAt })
  })
})

describe("the API", () => {
  const it = useInProcessServer()

  it("turns away callers with no key", async ({ server }) => {
    await expectProblem(new TaxaClient({ baseUrl: server.httpUrl }).tasks(), ProblemType.UNAUTHENTICATED)
    await expectProblem(
      new TaxaClient({ baseUrl: server.httpUrl, apiKey: "taxa_nope" }).tasks(),
      ProblemType.UNAUTHENTICATED
    )
  })

  it("describes itself in OpenAPI", async ({ server }) => {
    const spec = (await (await fetch(`${server.httpUrl}${OPENAPI_PATH}`)).json()) as { paths: Record<string, unknown> }
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(["/api/tasks", "/api/tasks/{ref}", "/api/tasks/{ref}/status", "/api/domains", "/api/keys"])
    )
  })
})

describe("the development login", () => {
  const it = useInProcessServer({ devLogin: { name: "Matt", timeZone: timeZone("Europe/London") } })

  it("treats callers with no key as its person", async ({ server }) => {
    const anyone = new TaxaClient({ baseUrl: server.httpUrl })
    expect((await anyone.me()).user.name).toBe("Matt")
  })
})
