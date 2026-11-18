import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { Keyboard } from "./Keyboard.ts"
import { Sidebar } from "./Sidebar.ts"
import { TaskDetailPage } from "./TaskDetailPage.ts"
import { sessionPageTestIds } from "../../src/sessions/SessionPageTestIds.ts"
import { planEditorTestIds } from "../../src/sessions/plan/PlanEditorTestIds.ts"
import { estimatePropertyTestIds } from "../../src/tasks/detail/properties/EstimatePropertyTestIds.ts"

/** Planning a session, working through it, and how it went. */
export class SessionPage extends PageObject {
  readonly #page: Page
  readonly sidebar: Sidebar
  readonly keyboard: Keyboard

  constructor(page: Page) {
    super()
    this.#page = page
    this.sidebar = new Sidebar(page)
    this.keyboard = new Keyboard(page)
  }

  #byId(id: string): Locator {
    return this.#page.getByTestId(id)
  }

  async expectHeading(text: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.heading)).toHaveText(text)
  }

  /** Chooses a length, by its label: `2 hours`. */
  async chooseLength(label: string): Promise<void> {
    await this.#byId(sessionPageTestIds.preset).filter({ hasText: label }).click()
  }

  async chooseUntil(time: string): Promise<void> {
    await this.#byId(sessionPageTestIds.until).fill(time)
  }

  /** The time the session would have, or has: `9:00 – 11:00 am`. */
  async expectWindow(text: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.window)).toContainText(text)
  }

  async chooseTasks(): Promise<void> {
    await this.#byId(sessionPageTestIds.chooseTasks).click()
  }

  async expectProblem(text: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.problem)).toContainText(text)
  }

  /** The suggested tasks' titles, in order. */
  async expectSuggestions(titles: string[]): Promise<void> {
    await expect(this.#byId(planEditorTestIds.suggestionTitle)).toHaveText(titles)
  }

  async search(text: string): Promise<void> {
    await this.#byId(planEditorTestIds.search).fill(text)
  }

  async add(title: string): Promise<void> {
    await this.#page.getByRole("button", { name: `Add ${title}`, exact: true }).click()
  }

  async remove(title: string): Promise<void> {
    await this.#page.getByRole("button", { name: `Take ${title} out`, exact: true }).click()
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

  /** Drags with the mouse as a hand does: press, move in steps, and let go that far down the target (0 its top, 1 its bottom). */
  async #drag(from: Locator, to: Locator, at = 0.5): Promise<void> {
    // Rows glide to new places after a change: wait for them to settle before measuring.
    await from.hover({ trial: true })
    await to.hover({ trial: true })
    const start = await from.boundingBox()
    const end = await to.boundingBox()
    if (!start || !end) throw new Error("Can't drag: the row or the place isn't showing.")
    await this.#page.mouse.move(start.x + Math.min(start.width / 2, 40), start.y + start.height / 2)
    await this.#page.mouse.down()
    await this.#page.mouse.move(end.x + end.width / 2, end.y + end.height * at, { steps: 12 })
    await this.#page.mouse.up()
    // Letting go, the drag library swallows clicks for 50ms from a timer, so the drop isn't a click too: outlast it.
    await this.#page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)))
  }

  #heading(name: string): Locator {
    return this.#page.getByRole("heading", { name, exact: true })
  }

  /** Drags a suggestion onto a planned task, to go in before it or after it. */
  async dragIn(title: string, onto: string, side: "before" | "after"): Promise<void> {
    await this.#drag(this.#suggestion(title), this.#planned(onto), side === "before" ? 0.25 : 0.75)
  }

  /** Drags a suggestion onto the plan, but not onto any task in it: it goes last. */
  async dragInLast(title: string): Promise<void> {
    await this.#drag(this.#suggestion(title), this.#heading("Your plan"))
  }

  /** Drags a suggestion and lets go back over the suggestions: nowhere it can go. */
  async dragAndLetGo(title: string): Promise<void> {
    await this.#drag(this.#suggestion(title), this.#heading("Suggestions"))
  }

  /** Drags a planned task back to the suggestions, out of the plan. */
  async dragOut(title: string): Promise<void> {
    await this.#drag(this.#planned(title), this.#heading("Suggestions"))
  }

  /** Drags a planned task to where another is. */
  async dragTo(title: string, onto: string): Promise<void> {
    await this.#drag(this.#planned(title), this.#planned(onto))
  }

  /** Moves a planned task with the keyboard, from its grip: up (below zero) or down by that many places. */
  async moveByKeyboard(title: string, places: number): Promise<void> {
    const grip = this.#planned(title).getByTestId(planEditorTestIds.grip)
    await grip.hover({ trial: true })
    await grip.focus()
    await this.#page.keyboard.press("Space")
    // Picked up: only then does the page listen for the keys that move it.
    await expect(grip).toHaveAttribute("aria-pressed", "true")
    // On picking up, it measures the rows over the next frames and listens for arrow keys from a timer: let both happen.
    await this.#page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve))))
    )
    // Each move shows on the page's next render, as the library announces it: wait for that before the next key.
    const announced = this.#page.locator("[id^=DndLiveRegion]")
    for (let step = 0; step < Math.abs(places); step++) {
      const before = (await announced.textContent()) ?? ""
      await this.#page.keyboard.press(places < 0 ? "ArrowUp" : "ArrowDown")
      await expect(announced).not.toHaveText(before)
    }
    await this.#page.keyboard.press("Space")
    await expect(grip).not.toHaveAttribute("aria-pressed", "true")
  }

  /** Gives a suggested task an estimate, typed as on the task page: `45m`. */
  async estimateSuggestion(title: string, estimate: string): Promise<void> {
    await this.#suggestion(title).getByTestId(planEditorTestIds.estimate).click()
    await this.#page.getByTestId(estimatePropertyTestIds.typed).fill(estimate)
    await this.#page.getByTestId(estimatePropertyTestIds.typed).press("Enter")
  }

  async expectSuggestionEstimate(title: string, estimate: string): Promise<void> {
    await expect(this.#suggestion(title).getByTestId(planEditorTestIds.estimate)).toHaveAttribute(
      "data-value",
      estimate
    )
  }

  /** Gives a planned task an estimate, as on its page: `45m`. */
  async estimatePlanned(title: string, estimate: string): Promise<void> {
    await this.#planned(title).getByTestId(planEditorTestIds.minutes).click()
    await this.#page.getByTestId(estimatePropertyTestIds.typed).fill(estimate)
    await this.#page.getByTestId(estimatePropertyTestIds.typed).press("Enter")
  }

  async expectPlannedEstimate(title: string, estimate: string): Promise<void> {
    await expect(this.#planned(title).getByTestId(planEditorTestIds.minutes)).toHaveAttribute("data-value", estimate)
  }

  /** Follows a planned task's title to its page. */
  async openPlanned(title: string): Promise<TaskDetailPage> {
    await this.#planned(title).getByRole("link", { name: title, exact: true }).click()
    return new TaskDetailPage(this.#page)
  }

  /** The plan's tasks, as `time span title`: `9:00 – 9:30 Bleed the radiators`. */
  async expectPlan(rows: string[]): Promise<void> {
    await expect
      .poll(() =>
        this.#byId(planEditorTestIds.row).evaluateAll(
          (elements, ids) =>
            elements.map(
              (row) =>
                `${row.querySelector(`[data-testid="${ids.time}"]`)?.textContent ?? ""} ${row.querySelector(`[data-testid="${ids.title}"]`)?.textContent ?? ""}`
            ),
          { time: planEditorTestIds.time, title: planEditorTestIds.title }
        )
      )
      .toEqual(rows)
  }

  /** `1 h 50 min planned of 2 h`, `10 min spare`. */
  async expectCapacity(planned: string, spare: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.planned)).toHaveText(planned)
    await expect(this.#byId(sessionPageTestIds.spare)).toHaveText(spare)
  }

  async start(): Promise<void> {
    await this.#byId(sessionPageTestIds.start).click()
    await this.expectHeading("Session")
  }

  async expectCurrent(title: string, countdown: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.currentTitle)).toHaveText(title)
    await expect(this.#byId(sessionPageTestIds.countdown)).toHaveText(countdown)
  }

  /** The line under the heading: `9:00 – 11:00 am · 1 h 33 min left · 13 min spare`. */
  async expectStatus(text: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.status)).toHaveText(text)
  }

  /** The session's tasks, each as its row reads: `9:00 – 9:27 Bleed the radiators 27 min of 30 min`. */
  async expectSlots(slots: string[]): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.slot)).toHaveText(slots)
  }

  async stopHere(): Promise<void> {
    await this.#byId(sessionPageTestIds.stop).click()
  }

  async moreTime(): Promise<void> {
    await this.#byId(sessionPageTestIds.moreTime).click()
  }

  async replan(): Promise<void> {
    await this.#byId(sessionPageTestIds.replan).click()
  }

  /** What the bar after Done or Stop here says, or that it's gone. */
  async expectUndoBar(text: string | undefined): Promise<void> {
    const bar = this.#byId(sessionPageTestIds.undoBar)
    await (text === undefined ? expect(bar).toHaveCount(0) : expect(bar).toContainText(text))
  }

  async undo(): Promise<void> {
    await this.#byId(sessionPageTestIds.undo).click()
  }

  async end(): Promise<void> {
    await this.#byId(sessionPageTestIds.end).click()
    await this.expectHeading("Session done")
  }

  /** The summary's counts: finished, worked on, not got to, time spent. */
  async expectCounts(counts: string[]): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.summaryCount)).toHaveText(counts)
  }

  /** Each task's row in the summary: title, planned, spent, now. */
  async expectSummary(rows: string[][]): Promise<void> {
    await expect
      .poll(() =>
        this.#byId(sessionPageTestIds.summaryRow).evaluateAll((elements) =>
          elements.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent))
        )
      )
      .toEqual(rows)
  }

  async writeNote(text: string): Promise<void> {
    const note = this.#byId(sessionPageTestIds.note)
    await note.fill(text)
    await note.blur()
  }

  /** The session's id, from the summary's address. */
  sessionId(): string {
    return new URL(this.#page.url()).pathname.split("/").pop() ?? ""
  }

  async finish(): Promise<void> {
    await this.#byId(sessionPageTestIds.finish).click()
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "session")
  }
}
