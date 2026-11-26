import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { DayPlanPage } from "./DayPlanPage.ts"
import { todayAttentionTestIds } from "../../src/days/TodayAttentionTestIds.ts"

/** Each box's test ids: the same parts, named for it. */
type AttentionBoxTestIds = Record<keyof typeof todayAttentionTestIds, string>

/** A box below Today of tasks it offers: what might want attention, or deadlines coming up. */
export class TodayAttention extends PageObject {
  readonly #page: Page
  readonly #ids: AttentionBoxTestIds

  constructor(page: Page, ids: AttentionBoxTestIds = todayAttentionTestIds) {
    super()
    this.#page = page
    this.#ids = ids
  }

  #item(title: string): Locator {
    return this.#page.getByTestId(this.#ids.item).filter({
      has: this.#page.getByTestId(this.#ids.title).getByText(title, { exact: true })
    })
  }

  /** Each task it offers, in order, as `title: reason`. */
  async expectOffered(items: string[]): Promise<void> {
    const offered = async (): Promise<string[]> =>
      Promise.all(
        (await this.#page.getByTestId(this.#ids.item).all()).map(
          async (item) =>
            `${await item.getByTestId(this.#ids.title).innerText()}: ${await item.getByTestId(this.#ids.reason).innerText()}`
        )
      )
    await expect.poll(offered).toEqual(items)
  }

  async expectNothingOffered(): Promise<void> {
    await expect(this.#page.getByTestId(this.#ids.box)).toHaveCount(0)
  }

  /** Plans one for today with its + Today. */
  async planForToday(title: string): Promise<void> {
    await this.#item(title).getByTestId(this.#ids.add).click()
  }

  /** Follows its link to the rest, which says this. */
  async openMore(text: string): Promise<void> {
    const link = this.#page.getByTestId(this.#ids.more)
    await expect(link).toHaveText(text)
    await link.click()
  }

  async reviewAll(count: number): Promise<DayPlanPage> {
    await this.openMore(`Review all ${count}`)
    const plan = new DayPlanPage(this.#page)
    await plan.expectShown()
    return plan
  }
}
