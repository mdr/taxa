import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { Sidebar } from "./Sidebar.ts"
import { TaskDetailPage } from "./TaskDetailPage.ts"
import { quickCaptureTestIds } from "../../src/tasks/list/QuickCaptureTestIds.ts"
import { taskListPageTestIds } from "../../src/tasks/list/TaskListPageTestIds.ts"
import { taskRowTestIds } from "../../src/tasks/list/TaskRowTestIds.ts"

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

  async expectHeading(heading: string): Promise<void> {
    await expect(this.#page.getByTestId(taskListPageTestIds.heading)).toHaveText(heading)
  }

  async expectWelcome(): Promise<void> {
    await expect(this.#page.getByTestId(taskListPageTestIds.welcome)).toBeVisible()
  }

  async capture(title: string): Promise<void> {
    const input = this.#page.getByTestId(quickCaptureTestIds.title)
    await input.fill(title)
    await input.press("Enter")
    await expect(input).toHaveValue("")
  }

  /** The tasks listed, in order, as `ref title`. */
  async expectTasks(tasks: string[]): Promise<void> {
    const rows = this.#page.getByTestId(taskRowTestIds.row)
    if (tasks.length === 0) {
      await expect(this.#page.getByTestId(taskListPageTestIds.empty)).toBeVisible()
      await expect(rows).toHaveCount(0)
      return
    }
    await expect(
      rows.locator(`[data-testid="${taskRowTestIds.ref}"], [data-testid="${taskRowTestIds.title}"]`)
    ).toHaveText(
      tasks.flatMap((task) => {
        const [ref, ...title] = task.split(" ")
        return [ref ?? "", title.join(" ")]
      })
    )
  }

  async expectHighlights(title: string, highlights: string): Promise<void> {
    await expect(this.#row(title).getByTestId(taskRowTestIds.highlights)).toHaveText(highlights)
  }

  /** Ticks it off; it's ticked once the server has it. */
  async complete(title: string): Promise<void> {
    await this.#row(title).getByTestId(taskRowTestIds.done).click()
  }

  async openTask(title: string): Promise<TaskDetailPage> {
    await this.#row(title).getByTestId(taskRowTestIds.title).click()
    return new TaskDetailPage(this.#page)
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "task list")
  }
}
