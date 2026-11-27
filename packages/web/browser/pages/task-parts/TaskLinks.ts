import { expect, type Page } from "@playwright/test"
import { commentCardTestIds } from "../../../src/tasks/comments/CommentCardTestIds.ts"
import { linkBarTestIds } from "../../../src/notes/LinkBarTestIds.ts"
import { linkFormTestIds } from "../../../src/notes/LinkFormTestIds.ts"
import { notesEditorTestIds } from "../../../src/notes/NotesEditorTestIds.ts"
import { notesToolbarTestIds } from "../../../src/notes/NotesToolbarTestIds.ts"
import { PageObject } from "../steps.ts"

/** On a task's page: links in its notes, made with the link box, and other tasks' refs, such as `H-2`, in its notes and comments. */
export class TaskLinks extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  /** Opens the link box where the cursor is in the notes, by ⌘K or the toolbar's button. */
  async openLinkForm(by: "keyboard" | "toolbar"): Promise<void> {
    if (by === "keyboard") await this.#page.keyboard.press("ControlOrMeta+k")
    else await this.#page.getByTestId(notesToolbarTestIds.link).click()
    await expect(this.#page.getByTestId(linkFormTestIds.form)).toBeVisible()
  }

  async expectLinkForm(text: string, address: string): Promise<void> {
    await expect(this.#page.getByTestId(linkFormTestIds.text)).toHaveValue(text)
    await expect(this.#page.getByTestId(linkFormTestIds.address)).toHaveValue(address)
  }

  /** Fills in the open link box and saves it, leaving the cursor in the notes after the link. */
  async fillLinkForm(text: string | undefined, address: string): Promise<void> {
    if (text !== undefined) await this.#page.getByTestId(linkFormTestIds.text).fill(text)
    await this.#page.getByTestId(linkFormTestIds.address).fill(address)
    await this.#page.getByTestId(linkFormTestIds.save).click()
    await expect(this.#page.getByTestId(linkFormTestIds.form)).toHaveCount(0)
    await expect(this.#page.getByTestId(notesEditorTestIds.editor)).toBeFocused()
  }

  /** Saves an address that can't be linked to, which keeps the box open and says why. */
  async fillLinkFormWrongly(address: string): Promise<void> {
    await this.#page.getByTestId(linkFormTestIds.address).fill(address)
    await this.#page.getByTestId(linkFormTestIds.save).click()
    await expect(this.#page.getByTestId(linkFormTestIds.problem)).toBeVisible()
  }

  async cancelLinkFormWithEscape(): Promise<void> {
    await this.#page.keyboard.press("Escape")
    await expect(this.#page.getByTestId(linkFormTestIds.form)).toHaveCount(0)
    await expect(this.#page.getByTestId(notesEditorTestIds.editor)).toBeFocused()
  }

  /** Clicks a link in the formatted notes, which puts the cursor in it rather than following it. */
  async clickNotesLink(text: string): Promise<void> {
    await this.#page.getByTestId(notesEditorTestIds.editor).getByRole("link", { name: text }).click()
  }

  async expectNotesLink(text: string, href: string): Promise<void> {
    const link = this.#page.getByTestId(notesEditorTestIds.editor).getByRole("link", { name: text })
    await expect(link).toHaveAttribute("href", href)
  }

  /** A web page opens in a new tab; an app, such as VS Code, without one. */
  async expectLinkBar(href: string, inNewTab = true): Promise<void> {
    const open = this.#page.getByTestId(linkBarTestIds.open)
    await expect(open).toHaveText(href)
    await expect(open).toHaveAttribute("href", href)
    if (inNewTab) await expect(open).toHaveAttribute("target", "_blank")
    else await expect(open).not.toHaveAttribute("target")
  }

  async editLinkFromBar(): Promise<void> {
    await this.#page.getByTestId(linkBarTestIds.edit).click()
    await expect(this.#page.getByTestId(linkFormTestIds.form)).toBeVisible()
  }

  async removeLinkFromBar(): Promise<void> {
    await this.#page.getByTestId(linkBarTestIds.remove).click()
    await expect(this.#page.getByTestId(linkBarTestIds.bar)).toHaveCount(0)
  }

  /** Follows a task's ref in the notes: with ⌘ or Ctrl, as a plain click there places the cursor. */
  async openRefInNotes(ref: string): Promise<void> {
    const link = this.#page.getByTestId(notesEditorTestIds.editor).locator(`a[data-task-ref="${ref}"]`)
    const here = this.#page.url()
    await link.click()
    await expect(this.#page).toHaveURL(here)
    await link.click({ modifiers: ["ControlOrMeta"] })
  }

  /** Follows a task's ref in a comment, where a plain click does. */
  async openRefInComment(body: string, ref: string): Promise<void> {
    await this.#page
      .getByTestId(commentCardTestIds.comment)
      .filter({ hasText: body })
      .locator(`a[data-task-ref="${ref}"]`)
      .click()
  }
}
