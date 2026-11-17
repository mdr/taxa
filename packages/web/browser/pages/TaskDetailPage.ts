import { expect, type Locator, type Page } from "@playwright/test"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { Sidebar } from "./Sidebar.ts"
import { datePickerTestIds } from "../../src/dates/DatePickerTestIds.ts"
import { activityListTestIds } from "../../src/tasks/detail/ActivityListTestIds.ts"
import { notesEditorTestIds } from "../../src/notes/NotesEditorTestIds.ts"
import type { NotesFormat } from "../../src/notes/notes-format.ts"
import { notesToolbarTestIds } from "../../src/notes/NotesToolbarTestIds.ts"
import { estimatePropertyTestIds } from "../../src/tasks/detail/properties/EstimatePropertyTestIds.ts"
import { taskDetailPageTestIds } from "../../src/tasks/detail/TaskDetailPageTestIds.ts"
import { taskMenuTestIds } from "../../src/tasks/detail/TaskMenuTestIds.ts"
import { taskPropertiesTestIds } from "../../src/tasks/detail/TaskPropertiesTestIds.ts"
import { titleFieldTestIds } from "../../src/tasks/detail/TitleFieldTestIds.ts"
import { CONFLICT_NOTICE } from "../../src/tasks/use-task-changes.ts"
import { optionListTestIds } from "../../src/ui/OptionListTestIds.ts"

/** Everything about one task, editable. */
export class TaskDetailPage extends PageObject {
  readonly #page: Page
  readonly sidebar: Sidebar

  constructor(page: Page) {
    super()
    this.#page = page
    this.sidebar = new Sidebar(page)
  }

  #option(value: string): Locator {
    return this.#page.locator(`[data-testid="${optionListTestIds.option}"][data-value="${value}"]`)
  }

  /** Opens a property's chip and picks one of its options. */
  async #choose(property: string, value: string): Promise<void> {
    await this.#page.getByTestId(property).click()
    await this.#option(value).click()
  }

  async expectRef(ref: string): Promise<void> {
    await expect(this.#page.getByTestId(taskDetailPageTestIds.ref)).toHaveText(ref)
  }

  async rename(title: string): Promise<void> {
    const input = this.#page.getByTestId(titleFieldTestIds.title)
    await input.fill(title)
    await input.press("Enter")
  }

  async expectTitle(title: string): Promise<void> {
    await expect(this.#page.getByTestId(titleFieldTestIds.title)).toHaveValue(title)
  }

  async moveTo(prefix: string): Promise<void> {
    await this.#choose(taskPropertiesTestIds.domain, prefix)
  }

  async setStatus(status: TaskStatus): Promise<void> {
    await this.#choose(taskPropertiesTestIds.status, status)
  }

  async setPriority(priority: Priority): Promise<void> {
    await this.#choose(taskPropertiesTestIds.priority, priority)
  }

  async expectPriority(priority: Priority): Promise<void> {
    await expect(this.#page.getByTestId(taskPropertiesTestIds.priority)).toHaveAttribute("data-value", priority)
  }

  /** Types the date into the due date's picker, as someone would; "" clears it. */
  async setDue(date: IsoDate | ""): Promise<void> {
    await this.#page.getByTestId(taskPropertiesTestIds.due).click()
    if (date === "") {
      await this.#page.getByTestId(datePickerTestIds.clear).click()
      return
    }
    const typed = this.#page.getByTestId(datePickerTestIds.typed)
    await typed.fill(date)
    await typed.press("Enter")
  }

  /** Picks the due date from the picker's calendar. */
  async pickDue(date: IsoDate): Promise<void> {
    await this.#page.getByTestId(taskPropertiesTestIds.due).click()
    await this.#page.locator(`[data-testid="${datePickerTestIds.day}"][data-date="${date}"]`).click()
  }

  async expectDue(date: IsoDate | ""): Promise<void> {
    await expect(this.#page.getByTestId(taskPropertiesTestIds.due)).toHaveAttribute("data-value", date)
  }

  async setEstimate(estimate: string): Promise<void> {
    await this.#page.getByTestId(taskPropertiesTestIds.estimate).click()
    const typed = this.#page.getByTestId(estimatePropertyTestIds.typed)
    await typed.fill(estimate)
    await typed.press("Enter")
  }

  async expectEstimate(estimate: string): Promise<void> {
    await expect(this.#page.getByTestId(taskPropertiesTestIds.estimate)).toHaveAttribute("data-value", estimate)
  }

  async expectWorkingOn(text: string): Promise<void> {
    await expect(this.#page.getByTestId(taskPropertiesTestIds.inProgressBy)).toHaveText(text)
  }

  /** Types into the formatted notes, as someone would, Markdown shortcuts and all, then leaves them. */
  async typeNotes(text: string): Promise<void> {
    await this.#page.getByTestId(notesEditorTestIds.editor).click()
    await this.#page.keyboard.type(text)
    await this.#page.keyboard.press("Escape")
  }

  /** Types into the formatted notes, switching a format on first, then leaves them. */
  async typeNotesFormatted(format: NotesFormat, text: string): Promise<void> {
    await this.#page.getByTestId(notesEditorTestIds.editor).click()
    await this.#page.keyboard.press("End")
    await this.#page.locator(`[data-testid="${notesToolbarTestIds.button}"][data-value="${format}"]`).click()
    await this.#page.keyboard.type(text)
    await this.#page.keyboard.press("Escape")
  }

  async #setMarkdownMode(on: boolean): Promise<void> {
    const toggle = this.#page.getByTestId(notesEditorTestIds.markdownMode)
    if ((await toggle.getAttribute("aria-pressed")) !== String(on)) await toggle.click()
    await expect(toggle).toHaveAttribute("aria-pressed", String(on))
  }

  async writeNotesAsMarkdown(markdown: string): Promise<void> {
    await this.#setMarkdownMode(true)
    const source = this.#page.getByTestId(notesEditorTestIds.markdown)
    await source.fill(markdown)
    await source.press("Escape")
  }

  async expectNotesMarkdown(markdown: string): Promise<void> {
    await this.#setMarkdownMode(true)
    await expect(this.#page.getByTestId(notesEditorTestIds.markdown)).toHaveValue(markdown)
  }

  async showNotesFormatted(): Promise<void> {
    await this.#setMarkdownMode(false)
  }

  /** The formatted notes have a heading with this text. */
  async expectNotesHeading(text: string): Promise<void> {
    await expect(this.#page.getByTestId(notesEditorTestIds.editor).getByRole("heading", { name: text })).toBeVisible()
  }

  /** Leaves the tab and comes back, which is when the app looks for changes made elsewhere. */
  async returnToTab(): Promise<void> {
    await this.#page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")))
  }

  async tickNotesItem(text: string): Promise<void> {
    await this.#page
      .getByTestId(notesEditorTestIds.editor)
      .getByRole("checkbox", { name: `Done: ${text}` })
      .click()
  }

  /** The activity log, oldest first, without times. */
  async expectActivity(entries: string[]): Promise<void> {
    await expect(this.#page.getByTestId(activityListTestIds.text)).toHaveText(entries)
  }

  async expectConflictNotice(): Promise<void> {
    await expect(this.#page.getByTestId(taskDetailPageTestIds.problem)).toHaveText(CONFLICT_NOTICE)
  }

  async delete(): Promise<void> {
    await this.#page.getByTestId(taskMenuTestIds.open).click()
    await this.#option("DELETE").click()
    await expect(this.#page.getByTestId(taskDetailPageTestIds.deleted)).toBeVisible()
  }

  async restore(): Promise<void> {
    await this.#page.getByTestId(taskDetailPageTestIds.restore).click()
    await expect(this.#page.getByTestId(taskDetailPageTestIds.deleted)).toHaveCount(0)
  }

  /** Checks the page, and with a property's popover open, the popover too. */
  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "task detail")
  }

  async expectAccessibleWithDatePicker(): Promise<void> {
    await this.#page.getByTestId(taskPropertiesTestIds.due).click()
    await expectAccessible(this.#page, "task detail with the date picker")
    await this.#page.keyboard.press("Escape")
  }
}
