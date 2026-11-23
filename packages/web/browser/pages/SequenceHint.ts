import { expect, type Page } from "@playwright/test"
import { expectAccessible } from "./accessibility.ts"
import { PageObject } from "./steps.ts"
import { TaskListPage } from "./TaskListPage.ts"
import { sequenceHintTestIds } from "../../src/shortcuts/SequenceHintTestIds.ts"
import { taskListPageTestIds } from "../../src/tasks/list/TaskListPageTestIds.ts"

/** After `G`: the keys that can come next, and where each goes. */
export class SequenceHint extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  /** Each as `T Today`. */
  async expectOffered(next: string[]): Promise<void> {
    await expect(this.#page.getByTestId(sequenceHintTestIds.next)).toHaveText(next.map((each) => each.replace(" ", "")))
  }

  async choose(description: string): Promise<TaskListPage> {
    await this.#page.getByTestId(sequenceHintTestIds.next).filter({ hasText: description }).click()
    return new TaskListPage(this.#page)
  }

  async cancel(): Promise<void> {
    await this.#page.keyboard.press("Escape")
  }

  /** Clicks the list's heading. */
  async clickAway(): Promise<void> {
    await this.#page.getByTestId(taskListPageTestIds.heading).click()
  }

  async expectGone(): Promise<void> {
    await expect(this.#page.getByTestId(sequenceHintTestIds.hint)).toBeHidden()
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "keys to press next")
  }
}
