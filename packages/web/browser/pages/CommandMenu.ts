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
    await expect(this.#page.getByTestId(commandMenuTestIds.command).locator(":scope > span:first-child")).toHaveText(
      commands
    )
  }

  /** The command Enter would run. */
  async expectPicked(command: string): Promise<void> {
    await expect(
      this.#page.locator(`[data-testid="${commandMenuTestIds.command}"][aria-selected="true"] > span:first-child`)
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

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "command-menu")
  }
}
