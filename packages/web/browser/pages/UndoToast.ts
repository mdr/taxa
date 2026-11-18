import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { FollowOnDialog } from "./FollowOnDialog.ts"
import { undoToastTestIds } from "../../src/tasks/list/UndoToastTestIds.ts"

/** The offer to undo marking a task done or deleting it, and to add what follows on. */
export class UndoToast extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  async expectOffered(text: string): Promise<void> {
    await expect(this.#page.getByTestId(undoToastTestIds.toast)).toContainText(text)
  }

  async undo(): Promise<void> {
    await this.#page.getByTestId(undoToastTestIds.undo).click()
    await expect(this.#page.getByTestId(undoToastTestIds.toast)).toHaveCount(0)
  }

  async addFollowOn(): Promise<FollowOnDialog> {
    await this.#page.getByTestId(undoToastTestIds.followOn).click()
    const dialog = new FollowOnDialog(this.#page)
    await dialog.expectShown()
    return dialog
  }
}
