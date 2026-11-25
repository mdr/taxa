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

  /** Drags an item by its grip with the mouse, as a hand does, and lets go over the top half of another. */
  async drag(text: string, onto: string): Promise<void> {
    const grip = this.#item(text).getByTestId(checklistItemRowTestIds.grip)
    await this.#item(text).hover()
    const start = await grip.boundingBox()
    const end = await this.#item(onto).boundingBox()
    if (!start || !end) throw new Error("Can't drag: the item or the place isn't showing.")
    await this.#page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await this.#page.mouse.down()
    await this.#page.mouse.move(start.x + start.width / 2, end.y + end.height / 4, { steps: 12 })
    await this.#page.mouse.up()
    // Letting go, the drag library swallows clicks for 50ms from a timer, so the drop isn't a click too: outlast it.
    await this.#page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)))
  }

  /** Picks an item up by its grip with the keyboard, moves it down (or up, if negative) that many places, and puts it down. */
  async moveByKeyboard(text: string, places: number): Promise<void> {
    const grip = this.#item(text).getByTestId(checklistItemRowTestIds.grip)
    await grip.focus()
    await this.#page.keyboard.press("Space")
    await expect(grip).toHaveAttribute("aria-pressed", "true")
    // On picking up, it measures the items over the next frames and listens for arrow keys from a timer: let both happen.
    await this.#page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve))))
    )
    // Each move is announced, for screen readers, once it's made: wait for that before the next key.
    const announced = this.#page.getByTestId(checklistTestIds.announcer)
    for (let step = 0; step < Math.abs(places); step++) {
      const before = (await announced.textContent()) ?? ""
      await this.#page.keyboard.press(places > 0 ? "ArrowDown" : "ArrowUp")
      await expect(announced).not.toHaveText(before)
    }
    await this.#page.keyboard.press("Space")
    await expect(grip).not.toHaveAttribute("aria-pressed", "true")
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
