import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { HomePage } from "./HomePage.ts"

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

  async openHome(): Promise<HomePage> {
    await this.#page.goto(`${this.#baseUrl}/`)
    return new HomePage(this.#page)
  }

  /** The page asked nothing of the network beyond localhost. */
  expectNoOutsideRequests(): void {
    expect(this.#refused, "requests beyond localhost").toEqual([])
  }

  async close(): Promise<void> {
    await this.#page.context().close()
  }
}
