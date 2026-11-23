import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectHolds } from "./holds.ts"
import { TaskDetailPage } from "./TaskDetailPage.ts"
import { planEditorTestIds } from "../../src/sessions/plan/PlanEditorTestIds.ts"
import { estimatePropertyTestIds } from "../../src/tasks/detail/properties/EstimatePropertyTestIds.ts"
import { planCaptureTestIds } from "../../src/sessions/plan/PlanCaptureTestIds.ts"
import { tagFilterTestIds } from "../../src/sessions/plan/TagFilterTestIds.ts"
import { optionListTestIds } from "../../src/ui/OptionListTestIds.ts"

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Where on what's under it a drag is let go. */
type Spot = (box: Box) => number

/** Where, by what's there, a drag is let go. */
type Point = (box: Box) => { x: number; y: number }

/** Over a task: before it on its top half, after it on its bottom half. */
const HALF: Record<"before" | "after", Spot> = {
  before: ({ y, height }) => y + height * 0.25,
  after: ({ y, height }) => y + height * 0.75
}
/** Over a column's heading: on it, but on none of its tasks. */
const HEADING: Spot = ({ y }) => y + 16

/** The suggestions and the plan, side by side: before a session, and while replanning one. */
export class PlanEditor extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  #byId(id: string): Locator {
    return this.#page.getByTestId(id)
  }

  #suggestion(title: string): Locator {
    return this.#byId(planEditorTestIds.suggestion).filter({
      has: this.#byId(planEditorTestIds.suggestionTitle).getByText(title, { exact: true })
    })
  }

  #planned(title: string): Locator {
    return this.#byId(planEditorTestIds.row).filter({
      has: this.#byId(planEditorTestIds.title).getByText(title, { exact: true })
    })
  }

  /** The suggested tasks' titles, in order. */
  async expectSuggestions(titles: string[]): Promise<void> {
    await expect(this.#byId(planEditorTestIds.suggestionTitle)).toHaveText(titles)
  }

  async search(text: string): Promise<void> {
    await this.#byId(planEditorTestIds.search).fill(text)
  }

  /** Only suggestions with this tag, or with `undefined`, any. */
  async filterByTag(tag: string | undefined): Promise<void> {
    await this.#byId(tagFilterTestIds.filter).click()
    await this.#page.locator(`[data-testid="${optionListTestIds.option}"][data-value="${tag ?? ""}"]`).click()
  }

  /** Adds a task that's new, under the plan: it goes last. */
  async addNewTask(title: string): Promise<void> {
    const field = this.#byId(planCaptureTestIds.title)
    await field.fill(title)
    await field.press("Enter")
    await expect(field).toHaveValue("")
  }

  /** Adds a suggestion with its + button: it goes last. */
  async add(title: string): Promise<void> {
    await this.#suggestion(title).getByTestId(planEditorTestIds.add).click()
  }

  /** Takes a task out with its ×. */
  async remove(title: string): Promise<void> {
    await this.#planned(title).getByTestId(planEditorTestIds.remove).click()
  }

  /** Picks up with the mouse as a hand does, and moves in steps to that point by the target, holding on. */
  async #hold(from: Locator, to: Locator, point: Point): Promise<void> {
    // Tasks glide to new places after a change: wait for them to settle before measuring.
    await from.hover({ trial: true })
    await to.hover({ trial: true })
    const start = await from.boundingBox()
    const end = await to.boundingBox()
    if (!start || !end) throw new Error("Can't drag: the task or the place isn't showing.")
    await this.#page.mouse.move(start.x + Math.min(start.width / 2, 40), start.y + start.height / 2)
    await this.#page.mouse.down()
    const { x, y } = point(end)
    await this.#page.mouse.move(x, y, { steps: 12 })
  }

  async #letGo(): Promise<void> {
    await this.#page.mouse.up()
    // Letting go, the drag library swallows clicks for 50ms from a timer, so the drop isn't a click too: outlast it.
    await this.#page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)))
  }

  /** Drags and lets go at that spot on the target. */
  async #drag(from: Locator, to: Locator, spot: Spot): Promise<void> {
    await this.#hold(from, to, (box) => ({ x: box.x + box.width / 2, y: spot(box) }))
    await this.#letGo()
  }

  /** Drags a suggestion over a planned task, and before letting go, the plan has opened a gap for it: `[gap]` in the rows. */
  async dragInSeeingGap(title: string, onto: string, side: "before" | "after", rows: string[]): Promise<void> {
    await this.#hold(this.#suggestion(title), this.#planned(onto), (box) => ({
      x: box.x + box.width / 2,
      y: HALF[side](box)
    }))
    await expect(this.#byId(planEditorTestIds.planColumn)).toHaveAttribute("data-receiving", "true")
    await expect.poll(() => this.#planRowsWithGap()).toEqual(rows)
    await this.#letGo()
  }

  /** Drags a suggestion into the gutter between the columns, level with a planned task's lower half: it's on the plan's side, and goes after that task. */
  async dragInToGutterAfter(title: string, level: string): Promise<void> {
    const plan = await this.#byId(planEditorTestIds.planColumn).boundingBox()
    if (!plan) throw new Error("The plan isn't showing.")
    await this.#hold(this.#suggestion(title), this.#planned(level), (box) => ({
      x: plan.x - 8,
      y: HALF.after(box)
    }))
    await this.#letGo()
  }

  /** Drags a suggestion past the plan's right edge, level with a planned task's lower half: it goes after that task. */
  async dragInPastPlanAfter(title: string, level: string): Promise<void> {
    await this.#hold(this.#suggestion(title), this.#planned(level), (box) => ({
      x: box.x + box.width + 40,
      y: HALF.after(box)
    }))
    await this.#letGo()
  }

  /** Drags a suggestion into the page's white space under the plan: it goes last. */
  async dragInBelowPlan(title: string): Promise<void> {
    await this.#hold(this.#suggestion(title), this.#byId(planEditorTestIds.planColumn), (box) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height + 24
    }))
    await this.#letGo()
  }

  /** Drags a suggestion onto a planned task, to go in before it or after it. */
  async dragIn(title: string, onto: string, side: "before" | "after"): Promise<void> {
    await this.#drag(this.#suggestion(title), this.#planned(onto), HALF[side])
  }

  /** Drags a suggestion onto the plan, but onto none of its tasks: it goes last. */
  async dragInLast(title: string): Promise<void> {
    await this.#drag(this.#suggestion(title), this.#byId(planEditorTestIds.planColumn), HEADING)
  }

  /** Drags a suggestion, and lets go back over the suggestions: nowhere it can go. */
  async dragAndLetGo(title: string): Promise<void> {
    await this.#drag(this.#suggestion(title), this.#byId(planEditorTestIds.suggestionsColumn), HEADING)
  }

  /** Drags a planned task back to the suggestions, out of the plan. */
  async dragOut(title: string): Promise<void> {
    await this.#drag(this.#planned(title), this.#byId(planEditorTestIds.suggestionsColumn), HEADING)
  }

  /** Drags a planned task to where another is. */
  async dragTo(title: string, onto: string): Promise<void> {
    await this.#drag(this.#planned(title), this.#planned(onto), HALF.before)
  }

  /** Picks a planned task up by its grip with the keyboard, moves it with an arrow key that many times, and puts it down. */
  async #moveByKeyboard(title: string, key: "ArrowUp" | "ArrowDown", places: number): Promise<void> {
    const grip = this.#planned(title).getByTestId(planEditorTestIds.grip)
    await grip.hover({ trial: true })
    await grip.focus()
    await this.#page.keyboard.press("Space")
    // Picked up: only then does the page listen for the keys that move it.
    await expect(grip).toHaveAttribute("aria-pressed", "true")
    // On picking up, it measures the tasks over the next frames and listens for arrow keys from a timer: let both happen.
    await this.#page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve))))
    )
    // Each move is announced, for screen readers, once it's made: wait for that before the next key.
    const announced = this.#byId(planEditorTestIds.announcer)
    for (let step = 0; step < places; step++) {
      const before = (await announced.textContent()) ?? ""
      await this.#page.keyboard.press(key)
      await expect(announced).not.toHaveText(before)
    }
    await this.#page.keyboard.press("Space")
    await expect(grip).not.toHaveAttribute("aria-pressed", "true")
  }

  async moveUpByKeyboard(title: string, places = 1): Promise<void> {
    await this.#moveByKeyboard(title, "ArrowUp", places)
  }

  async moveDownByKeyboard(title: string, places = 1): Promise<void> {
    await this.#moveByKeyboard(title, "ArrowDown", places)
  }

  async #estimate(chip: Locator, estimate: string): Promise<void> {
    await chip.click()
    const typed = this.#byId(estimatePropertyTestIds.typed)
    await typed.fill(estimate)
    await typed.press("Enter")
  }

  /** Gives a suggested task an estimate, typed as on the task's page: `45m`. */
  async estimateSuggestion(title: string, estimate: string): Promise<void> {
    await this.#estimate(this.#suggestion(title).getByTestId(planEditorTestIds.estimate), estimate)
  }

  async expectSuggestionEstimate(title: string, estimate: string): Promise<void> {
    await expect(this.#suggestion(title).getByTestId(planEditorTestIds.estimate)).toHaveAttribute(
      "data-value",
      estimate
    )
  }

  /** Gives a planned task an estimate, typed as on the task's page: `45m`. */
  async estimatePlanned(title: string, estimate: string): Promise<void> {
    await this.#estimate(this.#planned(title).getByTestId(planEditorTestIds.plannedEstimate), estimate)
  }

  async expectPlannedEstimate(title: string, estimate: string): Promise<void> {
    await expect(this.#planned(title).getByTestId(planEditorTestIds.plannedEstimate)).toHaveAttribute(
      "data-value",
      estimate
    )
  }

  /** Follows a planned task's title to its page. */
  async openPlanned(title: string): Promise<TaskDetailPage> {
    await this.#planned(title).getByTestId(planEditorTestIds.title).click()
    const detail = new TaskDetailPage(this.#page)
    await detail.expectTitle(title)
    return detail
  }

  #planRows(): Promise<string[]> {
    return this.#byId(planEditorTestIds.row).evaluateAll(
      (rows, ids) =>
        rows.map(
          (row) =>
            `${row.querySelector(`[data-testid="${ids.time}"]`)?.textContent ?? ""} ${row.querySelector(`[data-testid="${ids.title}"]`)?.textContent ?? ""}`
        ),
      { time: planEditorTestIds.time, title: planEditorTestIds.title }
    )
  }

  /** The plan's tasks, in order, each by title; the gap opened for a suggestion as `[gap] title`. */
  async #planRowsWithGap(): Promise<string[]> {
    return this.#byId(planEditorTestIds.planColumn)
      .locator("li")
      .evaluateAll(
        (rows, ids) =>
          rows.map((row) =>
            row.dataset["testid"] === ids.gap
              ? `[gap] ${row.textContent}`
              : (row.querySelector(`[data-testid="${ids.title}"]`)?.textContent ?? "")
          ),
        { gap: planEditorTestIds.gap, title: planEditorTestIds.title }
      )
  }

  /** The plan's tasks, in order, each as `time span title`: `9:00 – 9:30 Bleed the radiators`. */
  async expectPlan(rows: string[]): Promise<void> {
    await expect.poll(() => this.#planRows()).toEqual(rows)
  }

  /** The plan is as given, and stays so: nothing that's been done changes it. */
  async expectPlanUnchanged(rows: string[]): Promise<void> {
    await this.expectPlan(rows)
    await expectHolds(() => this.#planRows(), rows)
  }
}
