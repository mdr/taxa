import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { tagChipTestIds } from "../../src/tags/TagChipTestIds.ts"
import { tagPickerTestIds } from "../../src/tags/TagPickerTestIds.ts"
import { tagsPropertyTestIds } from "../../src/tags/TagsPropertyTestIds.ts"
import { tagSuggestionListTestIds } from "../../src/tags/TagSuggestionListTestIds.ts"

/** On a task's page: its tags. */
export class TaskTags extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  #suggestion(name: string): Locator {
    return this.#page.locator(`[data-testid="${tagSuggestionListTestIds.suggestion}"][data-value="${name}"]`)
  }

  /** Opens the picker and types; what it offers then shows. */
  async find(typed: string): Promise<void> {
    await this.#page.getByTestId(tagsPropertyTestIds.add).click()
    await this.#page.getByTestId(tagPickerTestIds.input).fill(typed)
  }

  /** What the picker offers, each as its text: `Life Admin`, or `New tag “car”`. */
  async expectOffered(suggestions: string[]): Promise<void> {
    await expect(this.#page.getByTestId(tagSuggestionListTestIds.suggestion)).toHaveText(suggestions)
  }

  /** Makes a new tag of what's typed, with Enter, and puts the picker away. */
  async addNew(name: string): Promise<void> {
    await this.find(name)
    await expect(this.#page.getByTestId(tagSuggestionListTestIds.suggestion).first()).toHaveText(`New tag “${name}”`)
    await this.#page.getByTestId(tagPickerTestIds.input).press("Enter")
    await this.#page.keyboard.press("Escape")
  }

  /** Picks one of the tags offered for what's typed, and puts the picker away. */
  async addFound(typed: string, name: string): Promise<void> {
    await this.find(typed)
    await this.#suggestion(name).click()
    await this.#page.keyboard.press("Escape")
  }

  async remove(name: string): Promise<void> {
    await this.#page
      .locator(`[data-testid="${tagChipTestIds.chip}"][data-value="${name}"]`)
      .getByTestId(tagChipTestIds.remove)
      .click()
  }

  async expectTags(names: string[]): Promise<void> {
    await expect(this.#page.getByTestId(tagsPropertyTestIds.tags).getByTestId(tagChipTestIds.chip)).toHaveText(names)
  }

  /** Follows a tag to the list of its tasks. */
  async open(name: string): Promise<void> {
    await this.#page
      .getByTestId(tagsPropertyTestIds.tags)
      .locator(`[data-testid="${tagChipTestIds.chip}"][data-value="${name}"] a`)
      .click()
  }
}
