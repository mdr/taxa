import { timeZone } from "@taxa/shared/dates/plain-date"
/**
 * Browser tests against the real API server, in the test's own process (see
 * InProcessServer): the `taxa` fixture starts one for each test, opens tabs
 * whose app talks to it, and sets up and checks what the server holds.
 */
import { expect, test as base, type Browser } from "@playwright/test"
import type { SessionId } from "@taxa/shared/ids"
import type { Task } from "@taxa/shared/tasks/task"
import { InProcessServer } from "../../../server/src/test-support/in-process-server.ts"
import type { TestUser } from "../../../server/src/test-support/test-user.ts"
import type { Ms } from "@taxa/shared/units"
import type { Tab } from "../pages/Tab.ts"
import { newTab } from "./iwft-tab.ts"

/** Who the web app signs in as: the development login. */
const PERSON = { name: "Matt", timeZone: timeZone("Europe/London") }

export class TestTaxa {
  readonly server: InProcessServer
  /** The person the tabs are signed in as, acting through the API to set up and check data. */
  readonly matt: TestUser
  readonly #browser: Browser
  readonly #tabs: Tab[] = []

  constructor(server: InProcessServer, matt: TestUser, browser: Browser) {
    this.server = server
    this.matt = matt
    this.#browser = browser
  }

  /** A new browser tab on the app, signed in as Matt, talking to this test's server at its time. */
  async openTab(label: string): Promise<Tab> {
    const tab = await newTab(this.#browser, label, this.server.httpUrl, {
      timeZone: PERSON.timeZone,
      now: this.server.clock.now()
    })
    this.#tabs.push(tab)
    return tab
  }

  /** Move the server's clock on, and the tabs' with it. */
  async advance(time: Ms): Promise<void> {
    this.server.advance(time)
    for (const tab of this.#tabs) await tab.setTime(this.server.clock.now())
  }

  /** The task, as the server has it, comes to have these values: `{ status: TaskStatus.DONE }`. */
  async expectTask(ref: string, expected: Partial<Task>): Promise<void> {
    await expect
      .poll(async () => {
        const task = await this.matt.client.task(ref)
        return Object.fromEntries(Object.keys(expected).map((key) => [key, task[key as keyof Task]]))
      }, `task ${ref} on the server`)
      .toEqual(expected)
  }

  /** The server comes to hold this many of Matt's tasks. */
  async expectTaskCount(count: number): Promise<void> {
    await expect.poll(async () => (await this.matt.client.tasks()).length, "tasks on the server").toBe(count)
  }

  /** Matt's domains, as the server has them, come to be these, by name. */
  async expectDomains(names: string[]): Promise<void> {
    await expect
      .poll(async () => (await this.matt.client.domains()).map((domain) => domain.name), "domains on the server")
      .toEqual(names)
  }

  /** Someone else using Taxa, with no domains or tasks yet. */
  addUser(name: string): Promise<TestUser> {
    return this.server.user(name)
  }

  /** The session's note, as the server has it. */
  async expectSessionNote(id: SessionId, note: string): Promise<void> {
    await expect
      .poll(async () => (await this.matt.client.session(id)).note, `session ${id}'s note on the server`)
      .toBe(note)
  }

  async stopDatabase(): Promise<void> {
    await this.server.stopDatabase()
  }

  /** Close every tab, failing the test if any asked for something beyond localhost. */
  async close(): Promise<void> {
    for (const tab of this.#tabs) {
      tab.expectNoOutsideRequests()
      await tab.close()
    }
  }
}

export const test = base.extend<{ taxa: TestTaxa }>({
  taxa: async ({ browser, baseURL }, use) => {
    const server = await InProcessServer.start({
      corsOrigins: baseURL ? [new URL(baseURL).origin] : [],
      devLogin: PERSON
    })
    try {
      const taxa = new TestTaxa(server, await server.devLoginUser(), browser)
      await use(taxa)
      await taxa.close()
    } finally {
      await server.close()
    }
  }
})
