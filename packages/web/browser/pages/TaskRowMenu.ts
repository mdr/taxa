import { expect, type Locator, type Page } from "@playwright/test"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import type { When } from "@taxa/shared/tasks/when"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { FollowOnDialog } from "./FollowOnDialog.ts"
import { datePickerTestIds } from "../../src/dates/DatePickerTestIds.ts"
import { estimatePropertyTestIds } from "../../src/tasks/detail/properties/EstimatePropertyTestIds.ts"
import { taskRowTestIds } from "../../src/tasks/list/row/TaskRowTestIds.ts"
import { rowTitleFieldTestIds } from "../../src/tasks/list/row/RowTitleFieldTestIds.ts"
import { optionListTestIds } from "../../src/ui/OptionListTestIds.ts"
import { tagPickerTestIds } from "../../src/tags/TagPickerTestIds.ts"

/** The things the menu lists to change, as it names them. */
type Thing = "Status" | "Priority" | "When" | "Due date" | "Estimate" | "Move to" | "Tags"

const THING_CHOICE: Record<Thing, string> = {
  Status: "STATUS",
  Priority: "PRIORITY",
  When: "WHEN",
  "Due date": "DUE",
  Estimate: "ESTIMATE",
  "Move to": "MOVE",
  Tags: "TAGS"
}

/** The ⋯ menu on a task's row in a list, open. */
export class TaskRowMenu extends PageObject {
  readonly #page: Page
  readonly #row: Locator

  constructor(page: Page, row: Locator) {
    super()
    this.#page = page
    this.#row = row
  }

  #option(value: string): Locator {
    return this.#row.locator(`[data-testid="${optionListTestIds.option}"][data-value="${value}"]`)
  }

  async #closed(): Promise<void> {
    await expect(this.#row.getByTestId(taskRowTestIds.menu)).toHaveAttribute("aria-expanded", "false")
  }

  /** What the menu says one thing about the task is now: `Priority`, `High`. */
  async expectShows(thing: Thing, now: string): Promise<void> {
    await expect(this.#option(THING_CHOICE[thing])).toContainText(now)
  }

  async #choose(thing: Thing, value: string): Promise<void> {
    await this.#option(THING_CHOICE[thing]).click()
    await this.#option(value).click()
    await this.#closed()
  }

  async setStatus(status: TaskStatus): Promise<void> {
    await this.#choose("Status", status)
  }

  async setPriority(priority: Priority): Promise<void> {
    await this.#choose("Priority", priority)
  }

  /** Today, soon, any time or someday. */
  async setWhen(when: Exclude<When, "ON_A_DAY">): Promise<void> {
    await this.#choose("When", when)
  }

  /** Plans it for a day to come, typed into the menu's date picker: `2026-01-09`, `fri`. */
  async setWhenOnADay(date: IsoDate | string): Promise<void> {
    await this.#option(THING_CHOICE.When).click()
    await this.#option("ON_A_DAY").click()
    const typed = this.#row.getByTestId(datePickerTestIds.typed)
    await typed.fill(date)
    await typed.press("Enter")
    await this.#closed()
  }

  /** Moves it to a domain, by its prefix. */
  async moveTo(prefix: string): Promise<void> {
    await this.#choose("Move to", prefix)
  }

  /** Files it out of the Inbox, or puts it back there: the menu's entry says which. */
  async fileOrPutBack(label: "File it" | "Back to the Inbox"): Promise<void> {
    await expect(this.#option("FILE")).toContainText(label)
    await this.#option("FILE").click()
    await this.#closed()
  }

  /** Whether the menu offers to move it: only with another domain to move it to. */
  async expectMovable(movable: boolean): Promise<void> {
    await expect(this.#option(THING_CHOICE["Move to"])).toHaveCount(movable ? 1 : 0)
  }

  /** Types a due date into the menu's date picker: `2026-01-09`, `fri`. */
  async setDue(date: IsoDate | string): Promise<void> {
    await this.#option(THING_CHOICE["Due date"]).click()
    const typed = this.#row.getByTestId(datePickerTestIds.typed)
    await typed.fill(date)
    await typed.press("Enter")
    await this.#closed()
  }

  /** Renames it in its row: types over its title and presses Enter. */
  async rename(title: string): Promise<void> {
    await this.#option("RENAME").click()
    // The row is found by its title, which is a field now.
    const field = this.#row.page().getByTestId(rowTitleFieldTestIds.field)
    await expect(field).toBeFocused()
    await field.fill(title)
    await field.press("Enter")
    await expect(field).toHaveCount(0)
  }

  /** Types an estimate: `45m`, `1h30m`. */
  async setEstimate(estimate: string): Promise<void> {
    await this.#option(THING_CHOICE.Estimate).click()
    const typed = this.#row.getByTestId(estimatePropertyTestIds.typed)
    await typed.fill(estimate)
    await typed.press("Enter")
    await this.#closed()
  }

  /** Finds a tag by what's typed, or makes a new one of it, and picks it with Enter. */
  async addTag(typed: string): Promise<void> {
    await this.#option(THING_CHOICE.Tags).click()
    const input = this.#row.getByTestId(tagPickerTestIds.input)
    await input.fill(typed)
    await input.press("Enter")
    await this.#closed()
  }

  /** Goes into one of the things to change, and back out again with the menu's back button. */
  async lookAtAndBack(thing: Thing): Promise<void> {
    await this.#option(THING_CHOICE[thing]).click()
    await this.#row.getByTestId(taskRowTestIds.menuBack).click()
    await expect(this.#option(THING_CHOICE[thing])).toBeFocused()
  }

  async addFollowOn(): Promise<FollowOnDialog> {
    await this.#option("FOLLOW_ON").click()
    const dialog = new FollowOnDialog(this.#page)
    await dialog.expectShown()
    return dialog
  }

  async delete(): Promise<void> {
    await this.#option("DELETE").click()
  }

  async closeWithEscape(): Promise<void> {
    await this.#page.keyboard.press("Escape")
    await this.#closed()
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "task-row-menu")
  }
}
