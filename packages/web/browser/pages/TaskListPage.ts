import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { Sidebar } from "./Sidebar.ts"
import { TaskDetailPage } from "./TaskDetailPage.ts"
import { quickCaptureTestIds } from "../../src/tasks/list/QuickCaptureTestIds.ts"
import { taskListPageTestIds } from "../../src/tasks/list/TaskListPageTestIds.ts"
import { taskRowTestIds } from "../../src/tasks/list/TaskRowTestIds.ts"
import { undoToastTestIds } from "../../src/tasks/list/UndoToastTestIds.ts"

/** The Inbox, or a domain's tasks. */
export class TaskListPage extends PageObject {
  readonly #page: Page
  readonly sidebar: Sidebar

  constructor(page: Page) {
    super()
    this.#page = page
    this.sidebar = new Sidebar(page)
  }

  #row(title: string): Locator {
    return this.#page
      .getByTestId(taskRowTestIds.row)
      .filter({ has: this.#page.getByTestId(taskRowTestIds.title).getByText(title, { exact: true }) })
  }

  /** Each row in a list as `ref title`, with ✓ before the ticked ones. */
  async #expectRows(list: Locator, tasks: string[]): Promise<void> {
    const rows = list.getByTestId(taskRowTestIds.row)
    await expect(rows).toHaveCount(tasks.length)
    await expect
      .poll(() =>
        rows.evaluateAll(
          (elements, ids) =>
            elements.map((row) => {
              const text = (id: string): string => row.querySelector(`[data-testid="${id}"]`)?.textContent ?? ""
              const ticked = row.querySelector<HTMLInputElement>(`[data-testid="${ids.done}"]`)?.checked
              return `${ticked ? "✓ " : ""}${text(ids.ref)} ${text(ids.title)}`
            }),
          taskRowTestIds
        )
      )
      .toEqual(tasks)
  }

  async expectHeading(heading: string): Promise<void> {
    await expect(this.#page.getByTestId(taskListPageTestIds.heading)).toHaveText(heading)
  }

  async capture(title: string): Promise<void> {
    const input = this.#page.getByTestId(quickCaptureTestIds.title)
    await input.fill(title)
    await input.press("Enter")
    await expect(input).toHaveValue("")
  }

  /** The tasks listed, in order, as `ref title`, with ✓ before any ticked off. */
  async expectTasks(tasks: string[]): Promise<void> {
    if (tasks.length === 0) {
      await expect(this.#page.getByTestId(taskListPageTestIds.empty)).toBeVisible()
      await expect(this.#page.getByTestId(taskListPageTestIds.tasks)).toHaveCount(0)
      return
    }
    await this.#expectRows(this.#page.getByTestId(taskListPageTestIds.tasks), tasks)
  }

  async expectHighlights(title: string, highlights: string): Promise<void> {
    await expect(this.#row(title).getByTestId(taskRowTestIds.highlights)).toHaveText(highlights)
  }

  /** Ticks it off. */
  async complete(title: string): Promise<void> {
    await this.#row(title).first().getByTestId(taskRowTestIds.done).check()
  }

  /** Unticks it. */
  async reopen(title: string): Promise<void> {
    await this.#row(title).first().getByTestId(taskRowTestIds.done).uncheck()
  }

  async expectUndoOffered(title: string): Promise<void> {
    await expect(this.#page.getByTestId(undoToastTestIds.toast)).toContainText(title)
  }

  async undo(): Promise<void> {
    await this.#page.getByTestId(undoToastTestIds.undo).click()
  }

  async showCompleted(): Promise<void> {
    await this.#page.getByTestId(taskListPageTestIds.showCompleted).click()
  }

  /** The completed tasks shown, as `ref title`, ✓ before each still ticked. */
  async expectCompleted(tasks: string[]): Promise<void> {
    await this.#expectRows(this.#page.getByTestId(taskListPageTestIds.completed), tasks)
  }

  async openTask(title: string): Promise<TaskDetailPage> {
    await this.#row(title).getByTestId(taskRowTestIds.title).click()
    return new TaskDetailPage(this.#page)
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "task list")
  }
}
