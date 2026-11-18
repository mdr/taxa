import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { SessionPlannerPage } from "./SessionPlannerPage.ts"
import { Sidebar } from "./Sidebar.ts"
import { sessionPageTestIds } from "../../src/sessions/SessionPageTestIds.ts"

/** The start of planning a session: how long it's for. */
export class SessionSetupPage extends PageObject {
  readonly #page: Page
  readonly sidebar: Sidebar

  constructor(page: Page) {
    super()
    this.#page = page
    this.sidebar = new Sidebar(page)
  }

  #byId(id: string): Locator {
    return this.#page.getByTestId(id)
  }

  async expectShown(): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.heading)).toHaveText("Plan a session")
  }

  /** Chooses a length, by its label: `2 hours`. */
  async chooseLength(label: string): Promise<void> {
    await this.#byId(sessionPageTestIds.preset).filter({ hasText: label }).click()
  }

  /** Has it go on until a time of day: `10:00`. */
  async chooseUntil(time: string): Promise<void> {
    await this.#byId(sessionPageTestIds.until).fill(time)
  }

  /** The time the session would have, or why it can't: `9:00 – 11:00 am`. */
  async expectWindow(text: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.window)).toContainText(text)
  }

  async chooseTasks(): Promise<SessionPlannerPage> {
    await this.#byId(sessionPageTestIds.chooseTasks).click()
    const planner = new SessionPlannerPage(this.#page)
    await planner.expectShown()
    return planner
  }

  /** Tries to go on to choosing tasks, and is told why not. */
  async chooseTasksExpectingProblem(problem: string): Promise<void> {
    await this.#byId(sessionPageTestIds.chooseTasks).click()
    await expect(this.#byId(sessionPageTestIds.problem)).toContainText(problem)
    await this.expectShown()
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "session-setup")
  }
}
