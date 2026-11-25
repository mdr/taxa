import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { activityListTestIds } from "../../src/tasks/detail/ActivityListTestIds.ts"
import { commentCardTestIds } from "../../src/tasks/comments/CommentCardTestIds.ts"
import { commentComposerTestIds } from "../../src/tasks/comments/CommentComposerTestIds.ts"

/** A comment as the page shows it: who wrote it, and what it says. */
export interface ShownComment {
  author: string
  body: string
}

/** On a task's page: its comments, in its timeline, and the box for writing one. */
export class TaskComments extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  #comment(body: string): Locator {
    return this.#page.getByTestId(commentCardTestIds.comment).filter({ hasText: body })
  }

  async add(text: string): Promise<void> {
    await this.#page.getByTestId(commentComposerTestIds.text).fill(text)
    await this.#page.getByTestId(commentComposerTestIds.post).click()
  }

  /** Writes one and posts it with ⌘Enter. */
  async addWithKeyboard(text: string): Promise<void> {
    const field = this.#page.getByTestId(commentComposerTestIds.text)
    await field.fill(text)
    await field.press("Enter")
  }

  /** Types a comment a line at a time, Shift+Enter between them, and posts it with Enter. */
  async addLines(lines: string[]): Promise<void> {
    const field = this.#page.getByTestId(commentComposerTestIds.text)
    for (const [index, line] of lines.entries()) {
      if (index > 0) await field.press("Shift+Enter")
      await field.pressSequentially(line)
    }
    await field.press("Enter")
  }

  /** The comments, oldest first. */
  async expectComments(comments: ShownComment[]): Promise<void> {
    await expect(this.#page.getByTestId(commentCardTestIds.author)).toHaveText(comments.map(({ author }) => author))
    await expect(this.#page.getByTestId(commentCardTestIds.body)).toHaveText(comments.map(({ body }) => body))
  }

  /** Changes and comments together, in the order the timeline shows them, each by what it says. */
  async expectTimeline(entries: string[]): Promise<void> {
    await expect(
      this.#page.locator(
        [activityListTestIds.text, commentCardTestIds.body].map((testId) => `[data-testid="${testId}"]`).join(", ")
      )
    ).toHaveText(entries)
  }

  /** The comment box is empty again, ready for the next. */
  async expectBoxEmpty(): Promise<void> {
    await expect(this.#page.getByTestId(commentComposerTestIds.text)).toHaveValue("")
  }

  async edit(body: string, edited: string): Promise<void> {
    const comment = this.#comment(body)
    await comment.hover()
    await comment.getByTestId(commentCardTestIds.edit).click()
    // While it's edited, what it says is in the field, not its text: one comment is edited at a time.
    await this.#page.getByTestId(commentCardTestIds.editor).fill(edited)
    await this.#page.getByTestId(commentCardTestIds.save).click()
  }

  /** Starts editing, then thinks better of it with Escape. */
  async abandonEdit(body: string, edited: string): Promise<void> {
    const comment = this.#comment(body)
    await comment.hover()
    await comment.getByTestId(commentCardTestIds.edit).click()
    const editor = this.#page.getByTestId(commentCardTestIds.editor)
    await editor.fill(edited)
    await editor.press("Escape")
  }

  async expectEdited(body: string): Promise<void> {
    await expect(this.#comment(body).getByTestId(commentCardTestIds.edited)).toBeVisible()
  }

  async delete(body: string): Promise<void> {
    const comment = this.#comment(body)
    await comment.hover()
    await comment.getByTestId(commentCardTestIds.delete).click()
  }

  /** Brings back the comment just deleted, from the notice offering it. */
  async undoDelete(): Promise<void> {
    await this.#page.getByTestId(commentComposerTestIds.restore).click()
  }
}
