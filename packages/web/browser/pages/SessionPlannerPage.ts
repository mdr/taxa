import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { PlanEditor } from "./PlanEditor.ts"
import { RunningSessionPage } from "./RunningSessionPage.ts"
import { Sidebar } from "./Sidebar.ts"
import { Keyboard } from "./Keyboard.ts"
import { UndoNotice } from "./UndoNotice.ts"
import { sessionPageTestIds } from "../../src/sessions/SessionPageTestIds.ts"

/** Choosing a session's tasks, before it starts. */
export class SessionPlannerPage extends PageObject {
  readonly #page: Page
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
    await expect(this.#byId(sessionPageTestIds.heading)).toHaveText("Plan your session")
  }

  /** How the plan fills the time: `1 h 50 min planned of 2 h`, and `10 min spare` or `15 min over`. */
  async expectCapacity(planned: string, spare: string): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.planned)).toHaveText(planned)
    await expect(this.#byId(sessionPageTestIds.spare)).toHaveText(spare)
  }

  async start(): Promise<RunningSessionPage> {
    await this.#byId(sessionPageTestIds.start).click()
    const running = new RunningSessionPage(this.#page)
    await running.expectShown()
    return running
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "session-planner")
  }
}
