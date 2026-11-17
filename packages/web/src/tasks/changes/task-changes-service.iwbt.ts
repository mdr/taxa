import type { TaskId } from "@taxa/shared/ids"
import { Priority } from "@taxa/shared/tasks/task"
import type { Task } from "@taxa/shared/tasks/task"
import { describe, expect } from "vite-plus/test"
import type { InProcessServer } from "../../../../server/src/test-support/in-process-server.ts"
import { useInProcessServer } from "../../../../server/src/test-support/use-in-process-server.ts"
import type { TestUser } from "../../../../server/src/test-support/test-user.ts"
import type { TaskCache } from "./task-cache.ts"
import { CONFLICT_NOTICE, TaskChangesService, TaskChangeType, type TaskChange } from "./task-changes-service.ts"

/** The page's cache, in memory: what it was last shown of each task. */
class FakeTaskCache implements TaskCache {
  readonly #tasks = new Map<TaskId, Task>()

  readonly latest = (id: TaskId): Task | undefined => this.#tasks.get(id)

  readonly show = (task: Task): Promise<void> => {
    this.#tasks.set(task.id, task)
    return Promise.resolve()
  }
}

const prioritise = (priority: Priority): TaskChange => ({ type: TaskChangeType.UPDATE, request: { set: { priority } } })
const rename = (title: string): TaskChange => ({ type: TaskChangeType.UPDATE, request: { set: { title } } })

interface Setup {
  matt: TestUser
  task: Task
  cache: FakeTaskCache
  service: TaskChangesService
}

/** Matt with a task, and a service making his changes through a cache of its own. */
const makeTaskChangesService = async (server: InProcessServer): Promise<Setup> => {
  const matt = await server.user("Matt")
  await matt.addDomain("Home", "H")
  const task = await matt.addTask("Fix the tap", { domain: "H" })
  const cache = new FakeTaskCache()
  return { matt, task, cache, service: new TaskChangesService(matt.client, cache) }
}

describe("TaskChangesService", () => {
  const it = useInProcessServer()

  it("makes a change and shows the task as it then is", async ({ server }) => {
    const { task, cache, service } = await makeTaskChangesService(server)
    const changed = await service.change(task, prioritise(Priority.HIGH))
    expect(changed).toMatchObject({ priority: Priority.HIGH, version: task.version + 1 })
    expect(cache.latest(task.id)).toEqual(changed)
    expect(service.state.problems).toEqual({ [task.id]: undefined })
  })

  it("makes quick changes to a task one after another, each on the version the last one left", async ({ server }) => {
    const { matt, task, service } = await makeTaskChangesService(server)
    const [first, second] = await Promise.all([
      service.change(task, prioritise(Priority.HIGH)),
      service.change(task, rename("Fix the kitchen tap"))
    ])
    expect([first?.version, second?.version]).toEqual([task.version + 1, task.version + 2])
    expect(await matt.client.task(task.id)).toMatchObject({ priority: Priority.HIGH, title: "Fix the kitchen tap" })
  })

  it("refuses a change to a version someone else has moved on from, and shows theirs", async ({ server }) => {
    const { matt, task, cache, service } = await makeTaskChangesService(server)
    const claude = await matt.agent("Claude Code")
    await claude.client.updateTask(task.id, { set: { priority: Priority.URGENT } })

    expect(await service.change(task, prioritise(Priority.LOW))).toBeUndefined()
    expect(service.state.problems[task.id]).toBe(CONFLICT_NOTICE)
    expect(cache.latest(task.id)?.priority).toBe(Priority.URGENT)
  })

  it("says why the server refused a change, and goes on with the next", async ({ server }) => {
    const { task, service } = await makeTaskChangesService(server)
    const [refused, made] = await Promise.all([
      service.change(task, rename("x".repeat(501))),
      service.change(task, prioritise(Priority.HIGH))
    ])
    expect(refused).toBeUndefined()
    expect(made?.priority).toBe(Priority.HIGH)
    expect(service.state.problems[task.id]).toBeUndefined()
  })

  it("keeps a problem until the task's next change, or until asked to forget it", async ({ server }) => {
    const { task, service } = await makeTaskChangesService(server)
    await service.change(task, rename("x".repeat(501)))
    expect(service.state.problems[task.id]).toContain("500")

    const next = service.change(task, prioritise(Priority.HIGH))
    expect(service.state.problems[task.id]).toBeUndefined()
    await next

    await service.change(task, rename("x".repeat(501)))
    service.clearProblems()
    expect(service.state.problems).toEqual({})
  })
})
