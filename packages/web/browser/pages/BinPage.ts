import { expect, type Page } from "@playwright/test"
import { expectAccessible } from "./accessibility.ts"
import { PageObject } from "./steps.ts"
import { Sidebar } from "./Sidebar.ts"
import { UndoNotice } from "./UndoNotice.ts"
import { Keyboard } from "./Keyboard.ts"
import { PurgeDialog } from "./PurgeDialog.ts"
import { binPageTestIds } from "../../src/tasks/bin/BinPageTestIds.ts"

/** Deleted tasks, to restore or delete forever. */
export class BinPage extends PageObject {
  readonly #page: Page
  readonly sidebar: Sidebar
  readonly undoNotice: UndoNotice
  readonly keyboard: Keyboard

  constructor(page: Page) {
    super()
    this.#page = page
    this.sidebar = new Sidebar(page)
    this.undoNotice = new UndoNotice(page)
    this.keyboard = new Keyboard(page)
  }

  async expectShown(): Promise<void> {
    await expect(this.#page.getByTestId(binPageTestIds.heading)).toBeVisible()
  }

  /** The tasks in the bin, last deleted first, each `H-1 Fix the tap`. */
  async expectTasks(tasks: string[]): Promise<void> {
    const rows = this.#page.getByTestId(binPageTestIds.task)
    await expect(rows).toHaveCount(tasks.length)
    for (const [index, task] of tasks.entries()) {
      const [ref = "", ...title] = task.split(" ")
      await expect(rows.nth(index)).toContainText(ref)
      await expect(rows.nth(index)).toContainText(title.join(" "))
    }
  }

  async expectEmpty(): Promise<void> {
    await expect(this.#page.getByTestId(binPageTestIds.empty)).toBeVisible()
  }

  async restore(title: string): Promise<void> {
    await this.#page
      .getByTestId(binPageTestIds.task)
      .filter({ hasText: title })
      .getByTestId(binPageTestIds.restore)
      .click()
  }

  async deleteForever(title: string): Promise<PurgeDialog> {
    await this.#page
      .getByTestId(binPageTestIds.task)
      .filter({ hasText: title })
      .getByTestId(binPageTestIds.purge)
      .click()
    return new PurgeDialog(this.#page)
  }

  async emptyBin(): Promise<PurgeDialog> {
    await this.#page.getByTestId(binPageTestIds.emptyBin).click()
    return new PurgeDialog(this.#page)
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "bin")
  }
}
