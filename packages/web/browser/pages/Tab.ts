import { expect, type Page } from "@playwright/test"
import type { Instant } from "@taxa/shared/units"
import { PageObject } from "./steps.ts"
import { TaskDetailPage } from "./TaskDetailPage.ts"
import { TaskListPage } from "./TaskListPage.ts"

/** One person's browser tab: where each test starts. */
export class Tab extends PageObject {
  readonly #page: Page
  readonly #baseUrl: string
  /** Requests the page made beyond localhost, which the tab refused. */
  readonly #refused: string[]

  constructor(page: Page, baseUrl: string, refused: string[]) {
    super()
    this.#page = page
    this.#baseUrl = baseUrl.replace(/\/$/, "")
    this.#refused = refused
  }

  /** The app's front page: the Inbox. */
  async openInbox(): Promise<TaskListPage> {
    await this.#page.goto(`${this.#baseUrl}/`)
    return new TaskListPage(this.#page)
  }

  async openTask(ref: string): Promise<TaskDetailPage> {
    await this.#page.goto(`${this.#baseUrl}/tasks/${ref}`)
    return new TaskDetailPage(this.#page)
  }

  async setTime(now: Instant): Promise<void> {
    await this.#page.clock.setFixedTime(now)
  }

  /** The page asked nothing of the network beyond localhost. */
  expectNoOutsideRequests(): void {
    expect(this.#refused, "requests beyond localhost").toEqual([])
  }

  async close(): Promise<void> {
    await this.#page.context().close()
  }
}
