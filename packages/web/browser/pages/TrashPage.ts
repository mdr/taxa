import { expect, type Page } from "@playwright/test"
import { expectAccessible } from "./accessibility.ts"
import { PageObject } from "./steps.ts"
import { Sidebar } from "./Sidebar.ts"
import { UndoNotice } from "./UndoNotice.ts"
import { Keyboard } from "./Keyboard.ts"
import { trashPageTestIds } from "../../src/tasks/trash/TrashPageTestIds.ts"

/** Deleted tasks, to restore. */
export class TrashPage extends PageObject {
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
    await expect(this.#page.getByTestId(trashPageTestIds.heading)).toBeVisible()
  }

  /** The tasks in the trash, last deleted first, each `H-1 Fix the tap`. */
  async expectTasks(tasks: string[]): Promise<void> {
    const rows = this.#page.getByTestId(trashPageTestIds.task)
    await expect(rows).toHaveCount(tasks.length)
    for (const [index, task] of tasks.entries()) {
      const [ref = "", ...title] = task.split(" ")
      await expect(rows.nth(index)).toContainText(ref)
      await expect(rows.nth(index)).toContainText(title.join(" "))
    }
  }

  async expectEmpty(): Promise<void> {
    await expect(this.#page.getByTestId(trashPageTestIds.empty)).toBeVisible()
  }

  async restore(title: string): Promise<void> {
    await this.#page
      .getByTestId(trashPageTestIds.task)
      .filter({ hasText: title })
      .getByTestId(trashPageTestIds.restore)
      .click()
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "trash")
  }
}
