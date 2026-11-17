import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { sidebarTestIds } from "../../src/app/SidebarTestIds.ts"
import { newDomainFormTestIds } from "../../src/domains/NewDomainFormTestIds.ts"
import { SERVER_STATUS_TEXT, type ServerStatus } from "../../src/health/server-status.ts"

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

  async openInbox(): Promise<void> {
    await this.#page.getByTestId(sidebarTestIds.inbox).click()
  }

  async openDomain(name: string): Promise<void> {
    await this.#page.getByTestId(sidebarTestIds.domain).filter({ hasText: name }).click()
  }

  async expectServerStatus(status: ServerStatus): Promise<void> {
    const shown = this.#page.getByTestId(sidebarTestIds.serverStatus)
    await expect(shown).toHaveAttribute("data-status", status)
    await expect(shown).toHaveText(SERVER_STATUS_TEXT[status])
  }
}
