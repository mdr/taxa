import { expect, type Locator, type Page } from "@playwright/test"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { datePickerTestIds } from "../../src/dates/DatePickerTestIds.ts"
import { INBOX_CHOICE } from "../../src/tasks/filing/filing.ts"
import { estimatePropertyTestIds } from "../../src/tasks/detail/properties/EstimatePropertyTestIds.ts"
import { taskRowTestIds } from "../../src/tasks/list/TaskRowTestIds.ts"
import { optionListTestIds } from "../../src/ui/OptionListTestIds.ts"

/** The things the menu lists to change, as it names them. */
type Thing = "Status" | "Priority" | "Due date" | "Estimate" | "Move to"

const THING_CHOICE: Record<Thing, string> = {
  Status: "STATUS",
  Priority: "PRIORITY",
  "Due date": "DUE",
  Estimate: "ESTIMATE",
  "Move to": "MOVE"
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

  /** Moves it to a domain, by its prefix. */
  async moveTo(prefix: string): Promise<void> {
    await this.#choose("Move to", prefix)
  }

  async moveToInbox(): Promise<void> {
    await this.#choose("Move to", INBOX_CHOICE)
  }

  /** Types a due date into the menu's date picker: `2026-01-09`, `fri`. */
  async setDue(date: IsoDate | string): Promise<void> {
    await this.#option(THING_CHOICE["Due date"]).click()
    const typed = this.#row.getByTestId(datePickerTestIds.typed)
    await typed.fill(date)
    await typed.press("Enter")
    await this.#closed()
  }

  /** Types an estimate: `45m`, `1h30m`. */
  async setEstimate(estimate: string): Promise<void> {
    await this.#option(THING_CHOICE.Estimate).click()
    const typed = this.#row.getByTestId(estimatePropertyTestIds.typed)
    await typed.fill(estimate)
    await typed.press("Enter")
    await this.#closed()
  }

  /** Goes into one of the things to change, and back out again with the menu's back button. */
  async lookAtAndBack(thing: Thing): Promise<void> {
    await this.#option(THING_CHOICE[thing]).click()
    await this.#row.getByTestId(taskRowTestIds.menuBack).click()
    await expect(this.#option(THING_CHOICE[thing])).toBeFocused()
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
