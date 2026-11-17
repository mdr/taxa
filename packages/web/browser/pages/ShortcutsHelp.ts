import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { shortcutsHelpTestIds } from "../../src/shortcuts/ShortcutsHelpTestIds.ts"

/** The list of keyboard shortcuts. */
export class ShortcutsHelp extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  /** Each shortcut, as `description keys`, keys as shown (`G then H`). */
  async expectShortcuts(shortcuts: string[]): Promise<void> {
    await expect(this.#page.getByTestId(shortcutsHelpTestIds.dialog)).toBeVisible()
    await expect
      .poll(() =>
        this.#page
          .getByTestId(shortcutsHelpTestIds.shortcut)
          .evaluateAll((rows) =>
            rows.map(
              (row) =>
                `${row.querySelector("dt")?.textContent ?? ""} ${[...row.querySelectorAll("kbd")].map((key) => key.textContent).join(" then ")}`
            )
          )
      )
      .toEqual(shortcuts)
  }

  async setSingleKeys(on: boolean): Promise<void> {
    await this.#page.getByTestId(shortcutsHelpTestIds.singleKeys).setChecked(on)
  }

  async closeWithEscape(): Promise<void> {
    await this.#page.keyboard.press("Escape")
    await expect(this.#page.getByTestId(shortcutsHelpTestIds.dialog)).toHaveCount(0)
  }

  async close(): Promise<void> {
    await this.#page.getByTestId(shortcutsHelpTestIds.close).click()
    await expect(this.#page.getByTestId(shortcutsHelpTestIds.dialog)).toHaveCount(0)
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "shortcuts-help")
  }
}
