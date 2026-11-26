import { expect, type Page } from "@playwright/test"
import { PageObject } from "../steps.ts"
import { taskDetailPageTestIds } from "../../../src/tasks/detail/TaskDetailPageTestIds.ts"
import { taskPropertiesTestIds } from "../../../src/tasks/detail/TaskPropertiesTestIds.ts"

/** On a task's page: whether it's in the Inbox still to sort out, and its domain. */
export class TaskFiling extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  /** Whether it offers a choice of domain: only with more than one. */
  async expectDomainChoice(shown: boolean): Promise<void> {
    await expect(this.#page.getByTestId(taskPropertiesTestIds.domain)).toHaveCount(shown ? 1 : 0)
  }

  /** Whether it says it's in the Inbox, still to sort out. */
  async expectInInbox(inbox: boolean): Promise<void> {
    await expect(this.#page.getByTestId(taskDetailPageTestIds.inbox)).toHaveCount(inbox ? 1 : 0)
  }

  /** Files it, sorted out, out of the Inbox, with the button in the notice. */
  async file(): Promise<void> {
    await this.#page.getByTestId(taskDetailPageTestIds.file).click()
    await this.expectInInbox(false)
  }
}
