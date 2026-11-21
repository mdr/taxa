import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { Keyboard } from "./Keyboard.ts"
import { Sidebar } from "./Sidebar.ts"
import { TaskDetailPage } from "./TaskDetailPage.ts"
import { TaskRowMenu } from "./TaskRowMenu.ts"
import { DayPlanPage } from "./DayPlanPage.ts"
import { TodayAttention } from "./TodayAttention.ts"
import { FollowOnDialog } from "./FollowOnDialog.ts"
import { quickCaptureTestIds } from "../../src/tasks/list/QuickCaptureTestIds.ts"
import { taskListPageTestIds } from "../../src/tasks/list/TaskListPageTestIds.ts"
import { taskRowTestIds } from "../../src/tasks/list/row/TaskRowTestIds.ts"
import { undoToastTestIds } from "../../src/tasks/list/UndoToastTestIds.ts"
import { optionListTestIds } from "../../src/ui/OptionListTestIds.ts"
import { tagChipTestIds } from "../../src/tags/TagChipTestIds.ts"
import { tagRenameTestIds } from "../../src/tags/TagRenameTestIds.ts"
import { tagSuggestionListTestIds } from "../../src/tags/TagSuggestionListTestIds.ts"

/** The Inbox, or a domain's tasks. */
export class TaskListPage extends PageObject {
  readonly #page: Page
  readonly sidebar: Sidebar
  readonly keyboard: Keyboard
  /** On Today: what might want planning for it. */
  readonly attention: TodayAttention

  constructor(page: Page) {
    super()
    this.#page = page
    this.sidebar = new Sidebar(page)
    this.attention = new TodayAttention(page)
    this.keyboard = new Keyboard(page)
  }

  #row(title: string): Locator {
    return this.#page
      .getByTestId(taskRowTestIds.row)
      .filter({ has: this.#page.getByTestId(taskRowTestIds.title).getByText(title, { exact: true }) })
  }

  /** Each row in a list as `ref title`, with ✓ before the ticked ones. */
  async #expectRows(list: Locator, tasks: string[]): Promise<void> {
    const rows = list.getByTestId(taskRowTestIds.row)
    await expect(rows).toHaveCount(tasks.length)
    await expect
      .poll(() =>
        rows.evaluateAll(
          (elements, ids) =>
            elements.map((row) => {
              const text = (id: string): string => row.querySelector(`[data-testid="${id}"]`)?.textContent ?? ""
              const ticked = row.querySelector<HTMLInputElement>(`[data-testid="${ids.done}"]`)?.checked
              return `${ticked ? "✓ " : ""}${text(ids.ref)} ${text(ids.title)}`
            }),
          taskRowTestIds
        )
      )
      .toEqual(tasks)
  }

  /** The keyboard is on this task's row. */
  async expectHighlighted(title: string): Promise<void> {
    await expect(this.#row(title)).toHaveAttribute("data-highlighted", "true")
    await expect(this.#row(title).getByTestId(taskRowTestIds.title)).toBeFocused()
  }

  async expectHeading(heading: string): Promise<void> {
    await expect(this.#page.getByTestId(taskListPageTestIds.heading)).toHaveText(heading)
  }

  /** The list has come: its tasks, or word that there are none, or why not. */
  async expectLoaded(): Promise<void> {
    await expect(
      this.#page
        .getByTestId(taskListPageTestIds.tasks)
        .or(this.#page.getByTestId(taskListPageTestIds.empty))
        .or(this.#page.getByTestId(taskListPageTestIds.error))
    ).toBeVisible()
  }

  async capture(title: string): Promise<void> {
    const input = this.#page.getByTestId(quickCaptureTestIds.title)
    await input.fill(title)
    await input.press("Enter")
    await expect(input).toHaveValue("")
  }

  /** In the Inbox, chooses a domain for it before adding it, by prefix. */
  async captureInto(title: string, prefix: string): Promise<void> {
    await this.#page.getByTestId(quickCaptureTestIds.filing).click()
    await this.#page.locator(`[data-testid="${optionListTestIds.option}"][data-value="${prefix}"]`).click()
    await this.capture(title)
  }

  /** What the Inbox says of a task added straight into a domain: `Added H-3 to Home.` */
  async expectFiled(text: string): Promise<void> {
    await expect(this.#page.getByTestId(quickCaptureTestIds.filed)).toHaveText(text)
  }

  /** The tasks listed, in order, as `ref title`, with ✓ before any ticked off. */
  async expectTasks(tasks: string[]): Promise<void> {
    if (tasks.length === 0) {
      await expect(this.#page.getByTestId(taskListPageTestIds.empty)).toBeVisible()
      await expect(this.#page.getByTestId(taskListPageTestIds.tasks)).toHaveCount(0)
      return
    }
    await this.#expectRows(this.#page.getByTestId(taskListPageTestIds.tasks), tasks)
  }

  async expectHighlights(title: string, highlights: string): Promise<void> {
    await expect(this.#row(title).getByTestId(taskRowTestIds.highlights)).toHaveText(highlights)
  }

  /** Types in the capture box without adding it yet, as a # brings up tags to pick. */
  async typeCapture(text: string): Promise<void> {
    await this.#page.getByTestId(quickCaptureTestIds.title).fill(text)
  }

  /** What capture offers for the tag after the #, each as its text, the one Enter picks marked `>`. */
  async expectTagsOffered(suggestions: string[]): Promise<void> {
    const offered = this.#page.getByTestId(tagSuggestionListTestIds.suggestion)
    if (suggestions.length === 0) return expect(offered).toHaveCount(0)
    await expect(offered).toHaveText(suggestions.map((text) => text.replace(/^> /, "")))
    const picked = suggestions.findIndex((text) => text.startsWith("> "))
    await expect(offered.nth(picked)).toHaveAttribute("aria-selected", "true")
  }

  /** Presses a key in the capture box. */
  async pressInCapture(key: string): Promise<void> {
    await this.#page.getByTestId(quickCaptureTestIds.title).press(key)
  }

  /** What's in the capture box: its text, and the tags picked for it. */
  async expectCapture(title: string, tags: string[]): Promise<void> {
    await expect(this.#page.getByTestId(quickCaptureTestIds.title)).toHaveValue(title)
    await expect(this.#page.getByTestId(quickCaptureTestIds.form).getByTestId(tagChipTestIds.chip)).toHaveText(tags)
  }

  /** On a tag's list: renames it everywhere. */
  async renameTag(to: string): Promise<void> {
    await this.#page.getByTestId(tagRenameTestIds.open).click()
    const input = this.#page.getByTestId(tagRenameTestIds.input)
    await input.fill(to)
    await input.press("Enter")
    await this.expectHeading(to)
  }

  /** Tries to capture, and is told why not; what was typed stays to fix. */
  async captureExpectingProblem(title: string, problem: string): Promise<void> {
    const input = this.#page.getByTestId(quickCaptureTestIds.title)
    await input.fill(title)
    await input.press("Enter")
    await expect(this.#page.getByTestId(quickCaptureTestIds.error)).toContainText(problem)
    await expect(input).toHaveValue(title)
  }

  /** Tabs from the capture box to the task's tick box, and ticks it with Space. */
  async completeWithKeyboard(title: string): Promise<void> {
    const box = this.#row(title).getByTestId(taskRowTestIds.done)
    await this.#page.getByTestId(quickCaptureTestIds.title).focus()
    for (let step = 0; step < 20 && !(await box.evaluate((element) => element === document.activeElement)); step++) {
      await this.#page.keyboard.press("Tab")
    }
    await expect(box).toBeFocused()
    await this.#page.keyboard.press("Space")
  }

  /** The task shows its problem, from the server refusing a change. */
  async expectRowProblem(title: string, problem: string): Promise<void> {
    await expect(this.#row(title).getByTestId(taskRowTestIds.problem)).toContainText(problem)
  }

  /** Ticks it off. */
  async complete(title: string): Promise<void> {
    await this.#row(title).first().getByTestId(taskRowTestIds.done).check()
  }

  /** Unticks it. */
  async reopen(title: string): Promise<void> {
    await this.#row(title).first().getByTestId(taskRowTestIds.done).uncheck()
  }

  async expectUndoOffered(title: string): Promise<void> {
    await expect(this.#page.getByTestId(undoToastTestIds.toast)).toContainText(title)
  }

  /** The Undo offer goes by itself after a few seconds. */
  async expectUndoGoesAway(): Promise<void> {
    await expect(this.#page.getByTestId(undoToastTestIds.toast)).toHaveCount(0, { timeout: 10_000 })
  }

  /** From the offer to undo ticking one off, adds a task that follows on from it. */
  async addFollowOnFromUndo(): Promise<FollowOnDialog> {
    await this.#page.getByTestId(undoToastTestIds.followOn).click()
    const dialog = new FollowOnDialog(this.#page)
    await dialog.expectShown()
    return dialog
  }

  async undo(): Promise<void> {
    await this.#page.getByTestId(undoToastTestIds.undo).click()
  }

  /** Types into the list's search box. */
  async search(text: string): Promise<void> {
    await this.#page.getByTestId(taskListPageTestIds.search).fill(text)
  }

  /** Goes to the search box with `/`, and types there. */
  async searchFromKeyboard(text: string): Promise<void> {
    await this.#page.keyboard.press("/")
    const box = this.#page.getByTestId(taskListPageTestIds.search)
    await expect(box).toBeFocused()
    await this.#page.keyboard.type(text)
  }

  /** Escape, in the search box: it empties, and the whole list shows again. */
  async clearSearchWithEscape(): Promise<void> {
    const box = this.#page.getByTestId(taskListPageTestIds.search)
    await box.press("Escape")
    await expect(box).toHaveValue("")
    await expect(box).not.toBeFocused()
  }

  /** What the list says when a search finds nothing still to do. */
  async expectNoMatches(text: string): Promise<void> {
    await expect(this.#page.getByTestId(taskListPageTestIds.noMatches)).toHaveText(text)
  }

  async showCompleted(): Promise<void> {
    await this.#page.getByTestId(taskListPageTestIds.showCompleted).click()
  }

  /** The completed tasks shown, as `ref title`, ✓ before each still ticked. */
  async expectCompleted(tasks: string[]): Promise<void> {
    await this.#expectRows(this.#page.getByTestId(taskListPageTestIds.completed), tasks)
  }

  /** Files a task from the Inbox list, through its domain chip. */
  async file(title: string, prefix: string): Promise<void> {
    await this.#row(title).getByTestId(taskRowTestIds.domain).click()
    await this.#page.locator(`[data-testid="${optionListTestIds.option}"][data-value="${prefix}"]`).click()
  }

  /** Opens the ⋯ menu on a task's row. */
  /** From Today, to choosing today's tasks and their order. */
  async planToday(): Promise<DayPlanPage> {
    await this.#page.getByTestId(taskListPageTestIds.planToday).click()
    const plan = new DayPlanPage(this.#page)
    await plan.expectShown()
    return plan
  }

  async openMenu(title: string): Promise<TaskRowMenu> {
    const row = this.#row(title)
    await row.hover()
    await row.getByTestId(taskRowTestIds.menu).click()
    await expect(row.getByTestId(taskRowTestIds.menu)).toHaveAttribute("aria-expanded", "true")
    return new TaskRowMenu(this.#page, row)
  }

  async openTask(title: string): Promise<TaskDetailPage> {
    await this.#row(title).getByTestId(taskRowTestIds.title).click()
    return new TaskDetailPage(this.#page)
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "task list")
  }
}
