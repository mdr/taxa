import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { Keyboard } from "./Keyboard.ts"
import { PlanEditor } from "./PlanEditor.ts"
import { SessionSummaryPage } from "./SessionSummaryPage.ts"
import { Sidebar } from "./Sidebar.ts"
import { UndoNotice } from "./UndoNotice.ts"
import { sessionPageTestIds } from "../../src/sessions/SessionPageTestIds.ts"

/** A session under way: the task being worked on, and the rest of the plan. */
export class RunningSessionPage extends PageObject {
  readonly #page: Page
  /** The plan, while replanning. */
  readonly plan: PlanEditor
  readonly sidebar: Sidebar
  readonly keyboard: Keyboard
  readonly undoNotice: UndoNotice

  constructor(page: Page) {
    super()
    this.#page = page
    this.plan = new PlanEditor(page)
    this.sidebar = new Sidebar(page)
    this.keyboard = new Keyboard(page)
    this.undoNotice = new UndoNotice(page)
  }

  #byId(id: string): Locator {
    return this.#page.getByTestId(id)
  }

  async expectShown(): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.heading)).toHaveText("Session")
  }

  /** The task being worked on, and its time left (`27:00`) or over (`15 min over`). */
  async expectCurrent(title: string, countdown: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.currentTitle)).toHaveText(title)
    await expect(this.#byId(sessionPageTestIds.countdown)).toHaveText(countdown)
  }

  /** The line under the heading: `9:00 – 11:00 am · 1 h 33 min left · 13 min spare`. */
  async expectStatus(text: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.status)).toHaveText(text)
  }

  /** The session's tasks in order, each as its time, title and note: `["9:00 – 9:27", "Bleed the radiators", "27 min of 30 min"]`. */
  async expectTimeline(rows: [string, string, string][]): Promise<void> {
    await expect
      .poll(() =>
        this.#byId(sessionPageTestIds.slot).evaluateAll(
          (slots, ids) =>
            slots.map((slot) =>
              [ids.time, ids.title, ids.note].map(
                (id) => slot.querySelector(`[data-testid="${id}"]`)?.textContent.trim() ?? ""
              )
            ),
          { time: sessionPageTestIds.slotTime, title: sessionPageTestIds.slotTitle, note: sessionPageTestIds.slotNote }
        )
      )
      .toEqual(rows)
  }

  async done(): Promise<void> {
    await this.#byId(sessionPageTestIds.done).click()
  }

  async stopHere(): Promise<void> {
    await this.#byId(sessionPageTestIds.stop).click()
  }

  /** +15 min for the task being worked on. */
  /** Between tasks: starts the one up next. */
  async startNext(): Promise<void> {
    await this.#byId(sessionPageTestIds.startNext).click()
  }

  async moreTime(): Promise<void> {
    await this.#byId(sessionPageTestIds.moreTime).click()
  }

  /** Opens the plan to change it. */
  async replan(): Promise<void> {
    const button = this.#byId(sessionPageTestIds.replan)
    await expect(button).toHaveText("Replan")
    await button.click()
    await expect(button).toHaveText("Done replanning")
  }

  async doneReplanning(): Promise<void> {
    const button = this.#byId(sessionPageTestIds.replan)
    await expect(button).toHaveText("Done replanning")
    await button.click()
    await expect(button).toHaveText("Replan")
  }

  /** What the bar offering to undo Done or Stop here says: `“Fix the tap” done`. */
  async expectUndoOffered(text: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.undoBar)).toContainText(text)
  }

  async expectNoUndoOffered(): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.undoBar)).toHaveCount(0)
  }

  async undo(): Promise<void> {
    await this.#byId(sessionPageTestIds.undo).click()
  }

  async end(): Promise<SessionSummaryPage> {
    await this.#byId(sessionPageTestIds.end).click()
    const summary = new SessionSummaryPage(this.#page)
    await summary.expectShown()
    return summary
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "session-running")
  }
}
