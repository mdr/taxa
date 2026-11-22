import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { undoNoticeTestIds } from "../../src/undo/UndoNoticeTestIds.ts"

/** What an undo or redo did, with the chance to go back on it; or why it couldn't. */
export class UndoNotice extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  /** `Undid: Added IN-1`. */
  async expectSays(text: string): Promise<void> {
    await expect(this.#page.getByTestId(undoNoticeTestIds.notice)).toContainText(text)
  }

  /** Redo, after an undo; Undo, after a redo. */
  async goBack(): Promise<void> {
    await this.#page.getByTestId(undoNoticeTestIds.again).click()
  }
}
