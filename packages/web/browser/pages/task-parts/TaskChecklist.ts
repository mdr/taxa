import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "../steps.ts"
import { checklistTestIds } from "../../../src/tasks/checklist/ChecklistTestIds.ts"
import { checklistItemRowTestIds } from "../../../src/tasks/checklist/ChecklistItemRowTestIds.ts"

/** On a task's page: its checklist. */
export class TaskChecklist extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  #item(text: string): Locator {
    return this.#page
      .getByTestId(checklistItemRowTestIds.item)
      .filter({ has: this.#page.getByTestId(checklistItemRowTestIds.text).getByText(text, { exact: true }) })
  }

  /** Starts a checklist on a task without one. */
  async start(): Promise<void> {
    await this.#page.getByTestId(checklistTestIds.start).click()
  }

  /** Types an item and presses Enter. */
  async add(text: string): Promise<void> {
    const box = this.#page.getByTestId(checklistTestIds.add)
    await box.fill(text)
    await box.press("Enter")
  }

  /** Pastes text into the box for adding items, as from another app. */
  async paste(text: string): Promise<void> {
    await this.#page.getByTestId(checklistTestIds.add).evaluate((box, pasted) => {
      const data = new DataTransfer()
      data.setData("text/plain", pasted)
      box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
    }, text)
  }

  async tick(text: string): Promise<void> {
    await this.#item(text).getByTestId(checklistItemRowTestIds.tick).click()
  }

  async reword(text: string, reworded: string): Promise<void> {
    await this.#item(text).getByTestId(checklistItemRowTestIds.text).click()
    const field = this.#page.getByTestId(checklistItemRowTestIds.edit)
    await field.fill(reworded)
    await field.press("Enter")
  }

  async remove(text: string): Promise<void> {
    await this.#item(text).hover()
    await this.#item(text).getByTestId(checklistItemRowTestIds.remove).click()
  }

  async makeTask(text: string): Promise<void> {
    await this.#item(text).hover()
    await this.#item(text).getByTestId(checklistItemRowTestIds.makeTask).click()
  }

  /** Opens the task an item was made into. */
  async openItemTask(text: string): Promise<void> {
    await this.#item(text).getByTestId(checklistItemRowTestIds.taskRef).click()
  }

  /** The items, as `✓ text` if ticked, and `→ H-2` after one made a task. */
  async expectItems(items: string[]): Promise<void> {
    await expect
      .poll(() =>
        this.#page.getByTestId(checklistItemRowTestIds.item).evaluateAll(
          (rows, ids) =>
            rows.map((row) => {
              const ticked = row.querySelector<HTMLInputElement>(`[data-testid="${ids.tick}"]`)?.checked
              const text = row.querySelector(`[data-testid="${ids.text}"]`)?.textContent ?? ""
              const ref = row.querySelector(`[data-testid="${ids.taskRef}"]`)?.textContent
              return `${ticked ? "✓ " : ""}${text}${ref ? ` → ${ref}` : ""}`
            }),
          checklistItemRowTestIds
        )
      )
      .toEqual(items)
  }

  async expectProgress(progress: string): Promise<void> {
    await expect(this.#page.getByTestId(checklistTestIds.progress)).toHaveText(progress)
  }

  /** Every item's ticked: marks the task done, from the offer to. */
  async markDone(): Promise<void> {
    await this.#page.getByTestId(checklistTestIds.markDone).click()
  }

  async expectFinishedOffer(shown: boolean): Promise<void> {
    await expect(this.#page.getByTestId(checklistTestIds.finished)).toHaveCount(shown ? 1 : 0)
  }
}
