import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { Keyboard } from "./Keyboard.ts"
import { Sidebar } from "./Sidebar.ts"
import { sessionPageTestIds } from "../../src/sessions/SessionPageTestIds.ts"
import { planEditorTestIds } from "../../src/sessions/plan/PlanEditorTestIds.ts"

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

  async moveEarlier(title: string): Promise<void> {
    await this.#page.getByRole("button", { name: `Move ${title} earlier`, exact: true }).click()
  }

  /** Sets the time planned for a task, by its label: `45 min`. */
  async setTime(title: string, label: string): Promise<void> {
    await this.#page.getByRole("combobox", { name: `Time for ${title}`, exact: true }).selectOption({ label })
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
