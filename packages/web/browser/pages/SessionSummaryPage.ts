import { expect, type Locator, type Page } from "@playwright/test"
import { sessionId, type SessionId } from "@taxa/shared/ids"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { Sidebar } from "./Sidebar.ts"
import { TaskListPage } from "./TaskListPage.ts"
import { sessionPageTestIds } from "../../src/sessions/SessionPageTestIds.ts"

/** How a session went, once it's ended. */
export class SessionSummaryPage extends PageObject {
  readonly #page: Page
  readonly sidebar: Sidebar

  constructor(page: Page) {
    super()
    this.#page = page
    this.sidebar = new Sidebar(page)
  }

  #byId(id: string): Locator {
    return this.#page.getByTestId(id)
  }

  async expectShown(): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.heading)).toHaveText("Session done")
  }

  /** The counts across the top, each as figure and label: `1finished`, `1 h 27 minspent on tasks`. */
  async expectCounts(counts: string[]): Promise<void> {
    await expect(this.#byId(sessionPageTestIds.summaryCount)).toHaveText(counts)
  }

  /** Each task's row: title, time planned, time spent, and where it is now. */
  async expectTasks(rows: [string, string, string, string][]): Promise<void> {
    await expect
      .poll(() =>
        this.#byId(sessionPageTestIds.summaryRow).evaluateAll(
          (trs, ids) => trs.map((tr) => ids.map((id) => tr.querySelector(`[data-testid="${id}"]`)?.textContent ?? "")),
          [
            sessionPageTestIds.summaryTask,
            sessionPageTestIds.summaryPlanned,
            sessionPageTestIds.summarySpent,
            sessionPageTestIds.summaryNow
          ]
        )
      )
      .toEqual(rows)
  }

  /** Writes a note on how it went, and leaves it to be saved. */
  async writeNote(text: string): Promise<void> {
    const note = this.#byId(sessionPageTestIds.note)
    await note.fill(text)
    await note.blur()
  }

  /** The session this is, from the page's address. */
  sessionId(): SessionId {
    return sessionId(new URL(this.#page.url()).pathname.split("/").pop() ?? "")
  }

  /** Done with the summary: back to the Inbox. */
  async finish(): Promise<TaskListPage> {
    await this.#byId(sessionPageTestIds.finish).click()
    const inbox = new TaskListPage(this.#page)
    await inbox.expectHeading("Inbox")
    return inbox
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "session-summary")
  }
}
