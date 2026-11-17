import { expect, type Locator, type Page } from "@playwright/test"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Energy, Priority, TaskStatus } from "@taxa/shared/tasks/task"
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

  /** Opens a date property's picker. */
  async #openDate(property: string): Promise<void> {
    await this.#page.getByTestId(property).click()
  }

  async #typeDate(property: string, date: IsoDate | string): Promise<void> {
    await this.#openDate(property)
    const typed = this.#page.getByTestId(datePickerTestIds.typed)
    await typed.fill(date)
    await typed.press("Enter")
  }

  async expectRef(ref: string): Promise<void> {
    await expect(this.#page.getByTestId(taskDetailPageTestIds.ref)).toHaveText(ref)
  }

  /** Starts renaming, then thinks better of it with Escape, and leaves the title. */
  async abandonRename(title: string): Promise<void> {
    const input = this.#page.getByTestId(titleFieldTestIds.title)
    await input.fill(title)
    await input.press("Escape")
    await input.blur()
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

  async expectStatus(status: TaskStatus): Promise<void> {
    await expect(this.#page.getByTestId(taskPropertiesTestIds.status)).toHaveAttribute("data-value", status)
  }

  async expectWaiting(text: string): Promise<void> {
    await expect(this.#page.getByTestId(taskPropertiesTestIds.waiting)).toHaveText(text)
  }

  /** Opens the priority with the keyboard, moves to it with the arrow keys, and picks it with Enter. */
  async setPriorityWithKeys(priority: Priority): Promise<void> {
    const chip = this.#page.getByTestId(taskPropertiesTestIds.priority)
    await chip.focus()
    await this.#page.keyboard.press("Enter")
    const focused = this.#page.locator(`[data-testid="${optionListTestIds.option}"]:focus`)
    await expect(focused).toHaveCount(1)
    for (let step = 0; step < 6 && (await focused.getAttribute("data-value")) !== priority; step++) {
      await this.#page.keyboard.press("ArrowDown")
    }
    await expect(focused).toHaveAttribute("data-value", priority)
    await this.#page.keyboard.press("Enter")
  }

  /** Opens the priority, then closes it with Escape. */
  async openAndEscapePriority(): Promise<void> {
    await this.#page.getByTestId(taskPropertiesTestIds.priority).click()
    await expect(this.#option("HIGH")).toBeVisible()
    await this.#page.keyboard.press("Escape")
  }

  /** The priority's options are closed, and the keyboard is back on its chip. */
  async expectPriorityClosedAndFocused(): Promise<void> {
    await expect(this.#page.getByTestId(optionListTestIds.option)).toHaveCount(0)
    await expect(this.#page.getByTestId(taskPropertiesTestIds.priority)).toBeFocused()
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

  /** Picks the due date from the picker's calendar, moving on through the months to it. */
  async pickDue(date: IsoDate): Promise<void> {
    await this.#openDate(taskPropertiesTestIds.due)
    const day = this.#page.locator(`[data-testid="${datePickerTestIds.day}"][data-date="${date}"]`)
    for (let month = 0; month < 12 && (await day.count()) === 0; month++) {
      await this.#page.getByTestId(datePickerTestIds.nextMonth).click()
    }
    await day.click()
  }

  /** Schedules it by one of the picker's shortcuts, by its label ("Tomorrow"). */
  async scheduleFor(shortcut: string): Promise<void> {
    await this.#openDate(taskPropertiesTestIds.scheduled)
    await this.#page.getByTestId(datePickerTestIds.shortcut).filter({ hasText: shortcut }).click()
  }

  async setScheduledTime(time: string): Promise<void> {
    await this.#openDate(taskPropertiesTestIds.scheduled)
    const field = this.#page.getByTestId(datePickerTestIds.time)
    await field.fill(time)
    await field.press("Enter")
  }

  /** The scheduled date, and the time if there is one, as the chip shows it ("Tue 6 Jan · 18:30"). */
  async expectScheduled(date: IsoDate | "", shown: string): Promise<void> {
    const chip = this.#page.getByTestId(taskPropertiesTestIds.scheduled)
    await expect(chip).toHaveAttribute("data-value", date)
    await expect(chip).toContainText(shown)
  }

  async hideUntil(date: IsoDate | string): Promise<void> {
    await this.#typeDate(taskPropertiesTestIds.start, date)
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

  async clearEstimate(): Promise<void> {
    await this.#page.getByTestId(taskPropertiesTestIds.estimate).click()
    await this.#page.getByTestId(estimatePropertyTestIds.clear).click()
  }

  /** Chooses the energy it needs, or with none, clears it. */
  async setEnergy(energy?: Energy): Promise<void> {
    await this.#choose(taskPropertiesTestIds.energy, energy ?? "")
  }

  async expectEnergy(energy?: Energy): Promise<void> {
    await expect(this.#page.getByTestId(taskPropertiesTestIds.energy)).toHaveAttribute("data-value", energy ?? "")
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

  /** Types into the formatted notes and stays there. */
  async startTypingNotes(text: string): Promise<void> {
    await this.#page.getByTestId(notesEditorTestIds.editor).click()
    await this.#page.keyboard.type(text)
  }

  async expectNotesText(text: string): Promise<void> {
    await expect(this.#page.getByTestId(notesEditorTestIds.editor)).toHaveText(text)
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

  async copyRef(): Promise<void> {
    await this.#page.getByTestId(taskMenuTestIds.open).click()
    await this.#option("COPY_REF").click()
  }

  async expectClipboard(text: string): Promise<void> {
    await expect.poll(() => this.#page.evaluate(() => navigator.clipboard.readText())).toBe(text)
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

  /** Checks the page with each kind of popover open: options, a date picker, an estimate, the menu. */
  async expectAccessibleWithPopovers(): Promise<void> {
    const popovers = [
      [taskPropertiesTestIds.priority, "the priority's options"],
      [taskPropertiesTestIds.due, "the date picker"],
      [taskPropertiesTestIds.estimate, "the estimate"],
      [taskMenuTestIds.open, "the menu"]
    ]
    for (const [testId, name] of popovers) {
      await this.#page.getByTestId(testId!).click()
      await expect(this.#page.getByRole("dialog")).toBeVisible()
      await expectAccessible(this.#page, `task detail with ${name} open`)
      await this.#page.keyboard.press("Escape")
      await expect(this.#page.getByRole("dialog")).toHaveCount(0)
    }
  }
}
