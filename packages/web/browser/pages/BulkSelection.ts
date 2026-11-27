import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { bulkBarTestIds } from "../../src/tasks/select/BulkBarTestIds.ts"
import type { BulkActionType } from "../../src/tasks/select/bulk-actions.ts"
import { taskListPageTestIds } from "../../src/tasks/list/TaskListPageTestIds.ts"
import { taskRowTestIds } from "../../src/tasks/list/row/TaskRowTestIds.ts"
import { optionListTestIds } from "../../src/ui/OptionListTestIds.ts"

/** On a list: choosing tasks, and changing them all at once from the bar at the foot. */
export class BulkSelection extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  #row(title: string): Locator {
    return this.#page
      .getByTestId(taskRowTestIds.row)
      .filter({ has: this.#page.getByTestId(taskRowTestIds.title).getByText(title, { exact: true }) })
  }

  #action(type: BulkActionType): Locator {
    return this.#page
      .getByTestId(bulkBarTestIds.bar)
      .locator(`[data-testid="${bulkBarTestIds.action}"][data-value="${type}"]`)
  }

  /** By the list's Select button. */
  async start(): Promise<void> {
    await this.#page.getByTestId(taskListPageTestIds.select).click()
    await expect(this.#page.getByTestId(bulkBarTestIds.bar)).toBeVisible()
  }

  /** Ticks each one's box, which is square, in place of its done tick. */
  async choose(...titles: string[]): Promise<void> {
    for (const title of titles) await this.#row(title).getByTestId(taskRowTestIds.select).click()
  }

  /** Clicks one's title, which chooses it while selecting, or with shift, the tasks from the last one chosen. */
  async clickTitle(title: string, shift = false): Promise<void> {
    await this.#row(title)
      .getByTestId(taskRowTestIds.title)
      .click({ modifiers: shift ? ["Shift"] : [] })
  }

  async expectChosen(titles: string[]): Promise<void> {
    await expect(
      this.#page.locator(
        `[data-testid="${taskRowTestIds.row}"][data-selected="true"] [data-testid="${taskRowTestIds.title}"]`
      )
    ).toHaveText(titles)
    await expect(this.#page.getByTestId(bulkBarTestIds.count)).toHaveText(
      titles.length === 0 ? "Select tasks" : `${titles.length} selected`
    )
  }

  async expectSelecting(selecting: boolean): Promise<void> {
    await expect(this.#page.getByTestId(bulkBarTestIds.bar)).toHaveCount(selecting ? 1 : 0)
    await expect(this.#page.getByTestId(taskRowTestIds.select)).toHaveCount(selecting ? await this.#rowCount() : 0)
  }

  async #rowCount(): Promise<number> {
    return this.#page.getByTestId(taskRowTestIds.row).count()
  }

  /** A button on the bar that acts at once: Done, File or Delete. */
  async act(type: BulkActionType): Promise<void> {
    await this.#action(type).click()
  }

  /** A choice from one of the bar's menus, by what it says. */
  async pick(type: BulkActionType, choice: string): Promise<void> {
    await this.#action(type).click()
    await this.#page.getByTestId(optionListTestIds.option).filter({ hasText: choice }).first().click()
  }

  async selectAll(): Promise<void> {
    await this.#page.getByTestId(bulkBarTestIds.all).click()
  }

  async stop(): Promise<void> {
    await this.#page.getByTestId(bulkBarTestIds.close).click()
  }

  async expectReport(text: string): Promise<void> {
    await expect(this.#page.getByTestId(bulkBarTestIds.report)).toContainText(text)
  }

  async undo(): Promise<void> {
    await this.#page.getByTestId(bulkBarTestIds.undo).click()
  }
}
