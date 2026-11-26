import { describe, expect } from "vite-plus/test"
import { LogLevel, type LogRecord } from "@taxa/shared/telemetry/log"
import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { LOG_CODES } from "../telemetry/log.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"
import type { InProcessServer } from "../test-support/in-process-server.ts"

/** The change logs since the test began, without the people and keys the test set up. */
const changeLogs = (server: InProcessServer, from: number): LogRecord[] => server.logs.slice(from)

describe("changes are logged", () => {
  const it = useInProcessServer()

  it("once each, at info, saying who changed which task and which fields, but not what to", async ({ server }) => {
    const matt = await server.user("Matt")
    const me = (await matt.client.me()).user
    const from = server.logs.length
    const home = await matt.addDomain("Home", "H")
    const task = await matt.addTask("Surprise party", { domain: "H" })
    await matt.client.updateTask(task.ref, { set: { priority: Priority.HIGH, notes: "Shh" } })
    await matt.client.updateTask(task.ref, { set: { priority: Priority.HIGH } })
    await matt.client.changeStatus(task.ref, { status: TaskStatus.DONE })
    await matt.client.deleteTask(task.ref)
    await matt.client.restoreTask(task.ref)

    const logs = changeLogs(server, from)
    expect(logs.map(({ level, code }) => [level, code])).toEqual([
      [LogLevel.INFO, LOG_CODES.domain.created],
      [LogLevel.INFO, LOG_CODES.task.created],
      [LogLevel.INFO, LOG_CODES.task.updated],
      [LogLevel.INFO, LOG_CODES.task.statusChanged],
      [LogLevel.INFO, LOG_CODES.task.deleted],
      [LogLevel.INFO, LOG_CODES.task.restored]
    ])
    expect(logs[0]?.fields).toEqual({ userId: me.id, agentId: undefined, domainId: home.id, prefix: "H" })
    expect(logs[2]?.fields).toEqual({
      userId: me.id,
      agentId: undefined,
      taskId: task.id,
      taskRef: "H-1",
      domainId: home.id,
      version: 2,
      fields: "notes,priority"
    })
    expect(JSON.stringify(logs)).not.toMatch(/Surprise|Shh/)
  })

  it("names the agent that made a change", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const claude = await matt.agent("Claude Code", "mdr/taxa")
    const from = server.logs.length
    await claude.addTask("Write the tests")
    const [created] = changeLogs(server, from)
    expect(created?.code).toBe(LOG_CODES.task.created)
    expect(created?.fields["agentId"]).toBe((await claude.client.me()).agent?.id)
  })

  it("logs agents and keys made and revoked", async ({ server }) => {
    const matt = await server.user("Matt")
    const from = server.logs.length
    const agent = await matt.client.createAgent("Claude Code")
    const key = await matt.client.createKey("Laptop")
    await matt.client.revokeKey(key.id)
    expect(
      changeLogs(server, from).map(({ code, fields }) => [code, fields["createdAgentId"] ?? fields["apiKeyId"]])
    ).toEqual([
      [LOG_CODES.agent.created, agent.id],
      [LOG_CODES.apiKey.created, key.id],
      [LOG_CODES.apiKey.revoked, key.id]
    ])
  })
})
