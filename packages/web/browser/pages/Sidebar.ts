import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { sidebarTestIds } from "../../src/app/SidebarTestIds.ts"
import { newDomainFormTestIds } from "../../src/domains/NewDomainFormTestIds.ts"
import { ShortcutsHelp } from "./ShortcutsHelp.ts"
import { TaskListPage } from "./TaskListPage.ts"
import { SessionPlannerPage } from "./SessionPlannerPage.ts"
import { SessionSetupPage } from "./SessionSetupPage.ts"

/** The lists down the side, on every page. */
export class Sidebar extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  async addDomain(name: string, prefix: string): Promise<void> {
    await this.#page.getByTestId(newDomainFormTestIds.open).click()
    await this.#page.getByTestId(newDomainFormTestIds.name).fill(name)
    await this.#page.getByTestId(newDomainFormTestIds.prefix).fill(prefix)
    await this.#page.getByTestId(newDomainFormTestIds.add).click()
  }

  /** Adds a domain with the prefix suggested for its name. */
  async addDomainSuggested(name: string): Promise<void> {
    await this.#page.getByTestId(newDomainFormTestIds.open).click()
    await this.#page.getByTestId(newDomainFormTestIds.name).fill(name)
    await this.#page.getByTestId(newDomainFormTestIds.add).click()
  }

  async expectDomainProblem(text: string): Promise<void> {
    await expect(this.#page.getByTestId(newDomainFormTestIds.error)).toContainText(text)
  }

  /** Each domain, as `prefix name`. */
  async expectDomains(domains: string[]): Promise<void> {
    await expect(this.#page.getByTestId(sidebarTestIds.domain)).toHaveText(
      domains.map((domain) => domain.replace(" ", ""))
    )
  }

  /** How many tasks the Inbox has, as the sidebar shows; none shows no count. */
  async expectInboxCount(count: number): Promise<void> {
    const shown = this.#page.getByTestId(sidebarTestIds.inboxCount)
    await (count === 0 ? expect(shown).toHaveCount(0) : expect(shown).toHaveText(String(count)))
  }

  async expectInProgressCount(count: number): Promise<void> {
    const shown = this.#page.getByTestId(sidebarTestIds.inProgressCount)
    await (count === 0 ? expect(shown).toHaveCount(0) : expect(shown).toHaveText(String(count)))
  }

  async openInProgress(): Promise<TaskListPage> {
    await this.#page.getByTestId(sidebarTestIds.inProgress).click()
    return new TaskListPage(this.#page)
  }

  async openInbox(): Promise<TaskListPage> {
    await this.#page.getByTestId(sidebarTestIds.inbox).click()
    return new TaskListPage(this.#page)
  }

  async openDomain(name: string): Promise<TaskListPage> {
    await this.#page.getByTestId(sidebarTestIds.domain).filter({ hasText: name }).click()
    return new TaskListPage(this.#page)
  }

  /** Opens Session, with none planned or under way: it starts with how long it's for. */
  async openSession(): Promise<SessionSetupPage> {
    await this.#page.getByTestId(sidebarTestIds.session).click()
    const setup = new SessionSetupPage(this.#page)
    await setup.expectShown()
    return setup
  }

  /** Opens Session, to go back to the plan being made. */
  async openSessionPlan(): Promise<SessionPlannerPage> {
    await this.#page.getByTestId(sidebarTestIds.session).click()
    const planner = new SessionPlannerPage(this.#page)
    await planner.expectShown()
    return planner
  }

  /** Time left on the session's task, or how far over: `25m`, `+15m`. */
  async expectSessionLeft(text: string): Promise<void> {
    await expect(this.#page.getByTestId(sidebarTestIds.sessionLeft)).toHaveText(text)
  }

  /** No time left showing, with no session task under way. */
  async expectNoSessionLeft(): Promise<void> {
    await expect(this.#page.getByTestId(sidebarTestIds.sessionLeft)).toHaveCount(0)
  }

  async openShortcuts(): Promise<ShortcutsHelp> {
    await this.#page.getByTestId(sidebarTestIds.shortcuts).click()
    return new ShortcutsHelp(this.#page)
  }
}
