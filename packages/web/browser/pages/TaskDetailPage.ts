import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { Sidebar } from "./Sidebar.ts"
import { activityListTestIds } from "../../src/tasks/detail/ActivityListTestIds.ts"
import { notesEditorTestIds } from "../../src/tasks/detail/NotesEditorTestIds.ts"
import { taskDetailPageTestIds } from "../../src/tasks/detail/TaskDetailPageTestIds.ts"
import { taskFieldsTestIds } from "../../src/tasks/detail/TaskFieldsTestIds.ts"
import { titleFieldTestIds } from "../../src/tasks/detail/TitleFieldTestIds.ts"
import { CONFLICT_NOTICE } from "../../src/tasks/use-task-changes.ts"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Priority, TaskStatus } from "@taxa/shared/tasks/task"

/** Everything about one task, editable. */
export class TaskDetailPage extends PageObject {
  readonly #page: Page
  readonly sidebar: Sidebar

  constructor(page: Page) {
    super()
    this.#page = page
    this.sidebar = new Sidebar(page)
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
    await this.#page.getByTestId(taskFieldsTestIds.domain).selectOption(prefix)
  }

  async setStatus(status: TaskStatus): Promise<void> {
    await this.#page.getByTestId(taskFieldsTestIds.status).selectOption(status)
  }

  async setPriority(priority: Priority): Promise<void> {
    await this.#page.getByTestId(taskFieldsTestIds.priority).selectOption(priority)
  }

  async expectPriority(priority: Priority): Promise<void> {
    await expect(this.#page.getByTestId(taskFieldsTestIds.priority)).toHaveValue(priority)
  }

  async setDue(date: IsoDate | ""): Promise<void> {
    await this.#page.getByTestId(taskFieldsTestIds.due).fill(date)
  }

  async expectDue(date: IsoDate | ""): Promise<void> {
    await expect(this.#page.getByTestId(taskFieldsTestIds.due)).toHaveValue(date)
  }

  async setEstimate(estimate: string): Promise<void> {
    const input = this.#page.getByTestId(taskFieldsTestIds.estimate)
    await input.fill(estimate)
    await input.blur()
  }

  async expectEstimate(estimate: string): Promise<void> {
    await expect(this.#page.getByTestId(taskFieldsTestIds.estimate)).toHaveValue(estimate)
  }

  async expectWorkingOn(text: string): Promise<void> {
    await expect(this.#page.getByTestId(taskFieldsTestIds.inProgressBy)).toHaveText(text)
  }

  async writeNotes(markdown: string): Promise<void> {
    await this.#page.getByTestId(notesEditorTestIds.edit).click()
    await this.#page.getByTestId(notesEditorTestIds.text).fill(markdown)
    await this.#page.getByTestId(notesEditorTestIds.save).click()
  }

  /** The notes' rendered Markdown has a heading with this text. */
  async expectNotesHeading(text: string): Promise<void> {
    await expect(this.#page.getByTestId(notesEditorTestIds.rendered).getByRole("heading", { name: text })).toBeVisible()
  }

  /** The activity log, oldest first, without times. */
  async expectActivity(entries: string[]): Promise<void> {
    await expect(this.#page.getByTestId(activityListTestIds.text)).toHaveText(entries)
  }

  async expectConflictNotice(): Promise<void> {
    await expect(this.#page.getByTestId(taskDetailPageTestIds.problem)).toHaveText(CONFLICT_NOTICE)
  }

  async delete(): Promise<void> {
    await this.#page.getByTestId(taskDetailPageTestIds.delete).click()
    await expect(this.#page.getByTestId(taskDetailPageTestIds.deleted)).toBeVisible()
  }

  async restore(): Promise<void> {
    await this.#page.getByTestId(taskDetailPageTestIds.restore).click()
    await expect(this.#page.getByTestId(taskDetailPageTestIds.deleted)).toHaveCount(0)
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "task detail")
  }
}
