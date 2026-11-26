import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { sidebarTestIds } from "../../src/app/SidebarTestIds.ts"
import { buildVersionTestIds } from "../../src/app/BuildVersionTestIds.ts"
import { newDomainFormTestIds } from "../../src/domains/NewDomainFormTestIds.ts"
import { ShortcutsHelp } from "./ShortcutsHelp.ts"
import { TaskListPage } from "./TaskListPage.ts"
import { BinPage } from "./BinPage.ts"
import { SessionPlannerPage } from "./SessionPlannerPage.ts"
import { SessionSetupPage } from "./SessionSetupPage.ts"

/** The lists of what's meant for when. */
type WhenList = "Today" | "Soon" | "Someday"

const WHEN_LINKS: Record<WhenList, { link: string; count: string }> = {
  Today: { link: sidebarTestIds.today, count: sidebarTestIds.todayCount },
  Soon: { link: sidebarTestIds.soon, count: sidebarTestIds.soonCount },
  Someday: { link: sidebarTestIds.someday, count: sidebarTestIds.somedayCount }
}

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

  /** With only one domain: no list of them, nor adding one, just All tasks, going to its tasks. */
  async expectOnlyAllTasks(): Promise<void> {
    await expect(this.#page.getByTestId(sidebarTestIds.domain)).toHaveText(["All tasks"])
    await expect(this.#page.getByTestId(newDomainFormTestIds.open)).toHaveCount(0)
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

  /** How many tasks are in Today, Soon or Someday, as the sidebar shows; none shows no count. */
  async expectCount(list: WhenList, count: number): Promise<void> {
    const shown = this.#page.getByTestId(WHEN_LINKS[list].count)
    await (count === 0 ? expect(shown).toHaveCount(0) : expect(shown).toHaveText(String(count)))
  }

  async openList(list: WhenList): Promise<TaskListPage> {
    await this.#page.getByTestId(WHEN_LINKS[list].link).click()
    const page = new TaskListPage(this.#page)
    await page.expectHeading(list)
    return page
  }

  async openDeadlines(): Promise<TaskListPage> {
    await this.#page.getByTestId(sidebarTestIds.deadlines).click()
    const page = new TaskListPage(this.#page)
    await page.expectHeading("Deadlines")
    return page
  }

  /** How many deadlines are overdue or due within the week, as the sidebar shows, and whether it says some are overdue. */
  async expectDeadlinesCount(count: number, overdue = false): Promise<void> {
    const shown = this.#page.getByTestId(sidebarTestIds.deadlinesCount)
    if (count === 0) return expect(shown).toHaveCount(0)
    await expect(shown).toHaveText(String(count))
    await expect(shown).toHaveAttribute("data-overdue", String(overdue))
  }

  async openInProgress(): Promise<TaskListPage> {
    await this.#page.getByTestId(sidebarTestIds.inProgress).click()
    return new TaskListPage(this.#page)
  }

  async openInbox(): Promise<TaskListPage> {
    await this.#page.getByTestId(sidebarTestIds.inbox).click()
    return new TaskListPage(this.#page)
  }

  /** The tags with tasks to do, each as `name count`: `Life Admin2`. */
  async expectTags(tags: string[]): Promise<void> {
    await expect(this.#page.getByTestId(sidebarTestIds.tag)).toHaveText(tags)
  }

  async openTag(name: string): Promise<TaskListPage> {
    await this.#page.getByTestId(sidebarTestIds.tag).filter({ hasText: name }).click()
    const page = new TaskListPage(this.#page)
    await page.expectHeading(name)
    return page
  }

  async openBin(): Promise<BinPage> {
    await this.#page.getByTestId(sidebarTestIds.bin).click()
    const bin = new BinPage(this.#page)
    await bin.expectShown()
    return bin
  }

  async openDomain(name: string): Promise<TaskListPage> {
    await this.#page.locator(`[data-testid="${sidebarTestIds.domain}"][data-domain="${name}"]`).click()
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

  /** The version of Taxa at the foot of the sidebar, with the full build on hover. */
  async expectVersion(release: string, build: string): Promise<void> {
    const version = this.#page.getByTestId(buildVersionTestIds.version)
    await expect(version).toHaveText(`Taxa ${release}`)
    await expect(version).toHaveAttribute("title", `Build ${build}`)
  }

  async openShortcuts(): Promise<ShortcutsHelp> {
    await this.#page.getByTestId(sidebarTestIds.shortcuts).click()
    return new ShortcutsHelp(this.#page)
  }
}
