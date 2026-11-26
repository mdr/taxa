import { expect, type Page } from "@playwright/test"
import type { Instant, Ms } from "@taxa/shared/units"
import { OnboardingPage } from "./OnboardingPage.ts"
import { PageObject } from "./steps.ts"
import { SignInPage } from "./SignInPage.ts"
import { TaskDetailPage } from "./TaskDetailPage.ts"
import { TaskListPage } from "./TaskListPage.ts"

/** One person's browser tab: where each test starts. */
export class Tab extends PageObject {
  readonly #page: Page
  readonly #baseUrl: string
  /** Requests the page made beyond localhost, which the tab refused. */
  readonly #refused: string[]
  /** The codes of what the app logged, in order. */
  readonly #logged: string[]

  constructor(page: Page, baseUrl: string, refused: string[], logged: string[]) {
    super()
    this.#page = page
    this.#baseUrl = baseUrl.replace(/\/$/, "")
    this.#refused = refused
    this.#logged = logged
  }

  /** The app logged these codes, in this order, among others. */
  async expectLogged(codes: string[]): Promise<void> {
    await expect
      .poll(() => {
        let next = 0
        for (const code of this.#logged) if (code === codes[next]) next++
        return codes.slice(next)
      }, "codes not yet logged")
      .toEqual([])
  }

  /** The app's front page before there are any domains. */
  async openFirstTime(): Promise<OnboardingPage> {
    await this.#page.goto(`${this.#baseUrl}/`)
    return new OnboardingPage(this.#page)
  }

  /** The app's front page: the Inbox. */
  async openInbox(): Promise<TaskListPage> {
    await this.#page.goto(`${this.#baseUrl}/`)
    const inbox = new TaskListPage(this.#page)
    await inbox.expectLoaded()
    return inbox
  }

  /** A page of the app, not signed in: the sign-in page, whatever the path. */
  async openSignedOut(path: string): Promise<SignInPage> {
    await this.#page.goto(`${this.#baseUrl}${path}`)
    return new SignInPage(this.#page)
  }

  async openTask(ref: string): Promise<TaskDetailPage> {
    await this.#page.goto(`${this.#baseUrl}/tasks/${ref}`)
    return new TaskDetailPage(this.#page)
  }

  async setTime(now: Instant): Promise<void> {
    await this.#page.clock.setFixedTime(now)
  }

  /** From now on, each answer from the API takes this long to come back, as over a slow network. */
  async slowNetwork(delay: Ms): Promise<void> {
    const app = new URL(this.#baseUrl).origin
    await this.#page.route(
      (url) => url.origin !== app && (url.hostname === "localhost" || url.hostname === "127.0.0.1"),
      async (route) => {
        const response = await route.fetch()
        await new Promise((resolve) => setTimeout(resolve, delay))
        await route.fulfill({ response })
      }
    )
  }

  /** The page asked nothing of the network beyond localhost. */
  expectNoOutsideRequests(): void {
    expect(this.#refused, "requests beyond localhost").toEqual([])
  }

  async close(): Promise<void> {
    await this.#page.context().close()
  }
}
