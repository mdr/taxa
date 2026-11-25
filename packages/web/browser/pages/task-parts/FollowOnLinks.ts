import { expect, type Page } from "@playwright/test"
import { PageObject } from "../steps.ts"
import { FollowOnDialog } from "../FollowOnDialog.ts"
import { followOnLinksTestIds } from "../../../src/tasks/follow-ons/FollowOnLinksTestIds.ts"
import { taskDetailPageTestIds } from "../../../src/tasks/detail/TaskDetailPageTestIds.ts"

/** On a task's page: what it follows on from, and what it led to. */
export class FollowOnLinks extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  async #dialog(): Promise<FollowOnDialog> {
    const dialog = new FollowOnDialog(this.#page)
    await dialog.expectShown()
    return dialog
  }

  /** The task it follows on from, as `H-1 Back up the floppy disks`; none, as "". */
  async expectFollowsOn(task: string): Promise<void> {
    const link = this.#page.getByTestId(followOnLinksTestIds.followsOn)
    if (task === "") await expect(link).toHaveCount(0)
    else await expect(link).toHaveText(task)
  }

  /** The tasks it led to, each as `H-3 Dispose of the disks`. */
  async expectLedTo(tasks: string[]): Promise<void> {
    await expect(this.#page.getByTestId(followOnLinksTestIds.ledTo)).toHaveText(tasks)
  }

  async addFollowOn(): Promise<FollowOnDialog> {
    await this.#page.getByTestId(followOnLinksTestIds.addFollowOn).click()
    return this.#dialog()
  }

  async addFollowOnWithKey(): Promise<FollowOnDialog> {
    await expect(this.#page.getByTestId(followOnLinksTestIds.links)).toBeVisible()
    await this.#page.keyboard.press("f")
    return this.#dialog()
  }

  /** Finds the earlier task by searching, and says this one follows on from it. */
  async setFollowsOn(search: string, title: string): Promise<void> {
    await this.#page.getByTestId(followOnLinksTestIds.setFollowsOn).click()
    await this.#page.getByTestId(followOnLinksTestIds.search).fill(search)
    await this.#page.getByTestId(followOnLinksTestIds.candidate).filter({ hasText: title }).click()
  }

  async unlink(): Promise<void> {
    await this.#page.getByTestId(followOnLinksTestIds.unlink).click()
  }

  /** Follows the link to the task it follows on from. */
  async openFollowsOn(): Promise<void> {
    await this.#page.getByTestId(followOnLinksTestIds.followsOn).click()
  }

  async openLedTo(title: string): Promise<void> {
    await this.#page.getByTestId(followOnLinksTestIds.ledTo).filter({ hasText: title }).click()
  }

  async expectProblem(problem: string): Promise<void> {
    await expect(this.#page.getByTestId(taskDetailPageTestIds.problem)).toContainText(problem)
  }
}
