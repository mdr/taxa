import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { PlanEditor } from "./PlanEditor.ts"
import { TaskListPage } from "./TaskListPage.ts"
import { dayPlanPageTestIds } from "../../src/days/DayPlanPageTestIds.ts"

/** Plan today: choosing today's tasks, and their order. Each row's time is its place: `1 Fix the tap`. */
export class DayPlanPage extends PageObject {
  readonly #page: Page
  readonly plan: PlanEditor

  constructor(page: Page) {
    super()
    this.#page = page
    this.plan = new PlanEditor(page)
  }

  async expectShown(): Promise<void> {
    await expect(this.#page.getByTestId(dayPlanPageTestIds.heading)).toHaveText("Plan today")
  }

  /** How many tasks, and how long they're reckoned to take: `3 tasks · about 1 h estimated`. */
  async expectEstimated(text: string): Promise<void> {
    await expect(this.#page.getByTestId(dayPlanPageTestIds.estimated)).toHaveText(text)
  }

  /** Back to Today. */
  async done(): Promise<TaskListPage> {
    await this.#page.getByTestId(dayPlanPageTestIds.done).click()
    const today = new TaskListPage(this.#page)
    await today.expectHeading("Today")
    return today
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "day-plan")
  }
}
