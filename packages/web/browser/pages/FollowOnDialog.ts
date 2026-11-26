import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { followOnDialogTestIds } from "../../src/tasks/follow-ons/FollowOnDialogTestIds.ts"

type WhenChoice = "Any time" | "Today" | "Soon" | "Someday"

/** Writing a task that follows on from another, open. */
export class FollowOnDialog extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  async expectShown(): Promise<void> {
    await expect(this.#page.getByTestId(followOnDialogTestIds.dialog)).toBeVisible()
  }

  /** What it says the new task follows on from: `H-1 Back up the floppy disks`. */
  async expectFrom(task: string): Promise<void> {
    await expect(this.#page.getByTestId(followOnDialogTestIds.from)).toHaveText(`Follows on from ${task}`)
  }

  /** Which domain it'll go in, by name; none to choose from, with only one. */
  async expectPlace(place: string | undefined): Promise<void> {
    if (place === undefined) return expect(this.#page.getByTestId(followOnDialogTestIds.place)).toHaveCount(0)
    await expect(
      this.#page.getByTestId(followOnDialogTestIds.place).and(this.#page.locator('[aria-checked="true"]'))
    ).toHaveText(place)
  }

  /** Puts it in a domain, by name. */
  async choosePlace(place: string): Promise<void> {
    await this.#page.getByTestId(followOnDialogTestIds.place).filter({ hasText: place }).click()
  }

  /** Writes it, for when chosen, and adds it. */
  async add(title: string, when: WhenChoice = "Any time"): Promise<void> {
    await this.#page.getByTestId(followOnDialogTestIds.title).fill(title)
    await this.#page.getByTestId(followOnDialogTestIds.when).filter({ hasText: when }).click()
    await this.#page.getByTestId(followOnDialogTestIds.add).click()
    await expect(this.#page.getByTestId(followOnDialogTestIds.dialog)).toHaveCount(0)
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "follow-on dialog")
  }
}
