import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { TaskDetailPage } from "./TaskDetailPage.ts"
import { commandMenuTestIds } from "../../src/shortcuts/CommandMenuTestIds.ts"

/** The ⌘K command menu. */
export class CommandMenu extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  async search(text: string): Promise<void> {
    await this.#page.getByTestId(commandMenuTestIds.search).fill(text)
  }

  /** The commands offered, each as its description. */
  async expectCommands(commands: string[]): Promise<void> {
    await expect(
      this.#page.getByTestId(commandMenuTestIds.command).getByTestId(commandMenuTestIds.description)
    ).toHaveText(commands)
  }

  /** The command Enter would run. */
  async expectPicked(command: string): Promise<void> {
    await expect(
      this.#page
        .locator(`[aria-selected="true"]`)
        .and(
          this.#page.getByTestId(commandMenuTestIds.command).or(this.#page.getByTestId(commandMenuTestIds.foundTask))
        )
        .getByTestId(commandMenuTestIds.description)
    ).toHaveText(command)
  }

  async pickNext(): Promise<void> {
    await this.#page.getByTestId(commandMenuTestIds.search).press("ArrowDown")
  }

  /** Enter: runs the picked command, closing the menu. */
  async run(): Promise<void> {
    await this.#page.getByTestId(commandMenuTestIds.search).press("Enter")
    await expect(this.#page.getByTestId(commandMenuTestIds.dialog)).toHaveCount(0)
  }

  /** Types a task's ref, and opens it. */
  async openTask(ref: string): Promise<TaskDetailPage> {
    await this.search(ref.toLowerCase())
    await this.expectPicked(`Open ${ref}`)
    await this.run()
    return new TaskDetailPage(this.#page)
  }

  /** The tasks found by what's typed, best first, each as `ref title`. */
  async expectFoundTasks(tasks: string[]): Promise<void> {
    await expect
      .poll(() =>
        this.#page
          .getByTestId(commandMenuTestIds.foundTask)
          .evaluateAll(
            (rows, ids) =>
              rows.map(
                (row) =>
                  `${row.querySelector(`[data-testid="${ids.detail}"]`)?.textContent ?? ""} ${row.querySelector(`[data-testid="${ids.description}"]`)?.textContent ?? ""}`
              ),
            { detail: commandMenuTestIds.detail, description: commandMenuTestIds.description }
          )
      )
      .toEqual(tasks)
  }

  /** Clicks a task found by searching, to open it. */
  async openFoundTask(title: string): Promise<TaskDetailPage> {
    await this.#page
      .getByTestId(commandMenuTestIds.foundTask)
      .filter({ has: this.#page.getByTestId(commandMenuTestIds.description).getByText(title, { exact: true }) })
      .click()
    await expect(this.#page.getByTestId(commandMenuTestIds.dialog)).toHaveCount(0)
    const detail = new TaskDetailPage(this.#page)
    await detail.expectTitle(title)
    return detail
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "command-menu")
  }
}
