import { expect, type Page } from "@playwright/test"
import { expectAccessible } from "./accessibility.ts"
import { PageObject } from "./steps.ts"
import { purgeDialogTestIds } from "../../src/tasks/bin/PurgeDialogTestIds.ts"

/** Asking before tasks in the bin are deleted forever. */
export class PurgeDialog extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  async expectAsks(question: string): Promise<void> {
    await expect(this.#page.getByTestId(purgeDialogTestIds.heading)).toHaveText(question)
  }

  async confirm(): Promise<void> {
    await this.#page.getByTestId(purgeDialogTestIds.confirm).click()
    await expect(this.#page.getByTestId(purgeDialogTestIds.dialog)).toBeHidden()
  }

  async cancel(): Promise<void> {
    await this.#page.getByTestId(purgeDialogTestIds.cancel).click()
    await expect(this.#page.getByTestId(purgeDialogTestIds.dialog)).toBeHidden()
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "asking before deleting forever")
  }
}
