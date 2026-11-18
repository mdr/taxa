import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { DayPlanPage } from "./DayPlanPage.ts"
import { todayAttentionTestIds } from "../../src/days/TodayAttentionTestIds.ts"

/** Below Today: what isn't planned for it but might want to be. */
export class TodayAttention extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  #item(title: string): Locator {
    return this.#page.getByTestId(todayAttentionTestIds.item).filter({
      has: this.#page.getByTestId(todayAttentionTestIds.title).getByText(title, { exact: true })
    })
  }

  /** Each task it offers, in order, as `title: reason`. */
  async expectOffered(items: string[]): Promise<void> {
    const offered = async (): Promise<string[]> =>
      Promise.all(
        (await this.#page.getByTestId(todayAttentionTestIds.item).all()).map(
          async (item) =>
            `${await item.getByTestId(todayAttentionTestIds.title).innerText()}: ${await item.getByTestId(todayAttentionTestIds.reason).innerText()}`
        )
      )
    await expect.poll(offered).toEqual(items)
  }

  async expectNothingOffered(): Promise<void> {
    await expect(this.#page.getByTestId(todayAttentionTestIds.box)).toHaveCount(0)
  }

  /** Plans one for today with its + Today. */
  async planForToday(title: string): Promise<void> {
    await this.#item(title).getByTestId(todayAttentionTestIds.add).click()
  }

  async reviewAll(count: number): Promise<DayPlanPage> {
    const link = this.#page.getByTestId(todayAttentionTestIds.reviewAll)
    await expect(link).toHaveText(`Review all ${count}`)
    await link.click()
    const plan = new DayPlanPage(this.#page)
    await plan.expectShown()
    return plan
  }
}
