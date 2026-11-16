import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { appTestIds } from "../../src/app/AppTestIds.ts"
import { SERVER_STATUS_TEXT, type ServerStatus } from "../../src/health/server-status.ts"
import { expectAccessible } from "./accessibility.ts"

/** The page the app opens on. */
export class HomePage extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  async expectServerStatus(status: ServerStatus): Promise<void> {
    const shown = this.#page.getByTestId(appTestIds.serverStatus)
    await expect(shown).toHaveAttribute("data-status", status)
    await expect(shown).toHaveText(SERVER_STATUS_TEXT[status])
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "home")
  }
}
