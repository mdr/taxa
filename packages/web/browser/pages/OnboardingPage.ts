import { expect, type Locator, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { expectAccessible } from "./accessibility.ts"
import { TaskListPage } from "./TaskListPage.ts"
import { onboardingTestIds } from "../../src/onboarding/OnboardingTestIds.ts"

/** The first visit: choosing domains to start with. */
export class OnboardingPage extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  #choice(name: string): Locator {
    return this.#page.getByTestId(onboardingTestIds.choice).filter({
      has: this.#page.locator(`[data-testid="${onboardingTestIds.name}"][value="${name}"]`)
    })
  }

  async expectWelcome(): Promise<void> {
    await expect(this.#page.getByTestId(onboardingTestIds.welcome)).toBeVisible()
  }

  /** The domains on offer as `prefix name`, each ticked (✓) or not (·). */
  async expectChoices(choices: string[]): Promise<void> {
    const rows = this.#page.getByTestId(onboardingTestIds.choice)
    await expect(rows).toHaveCount(choices.length)
    const shown = await rows.evaluateAll(
      (elements, ids) =>
        elements.map((row) => {
          const value = (id: string): string =>
            row.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)?.value ?? ""
          const chosen = row.querySelector<HTMLInputElement>(`[data-testid="${ids.chosen}"]`)?.checked
          return `${chosen ? "✓" : "·"} ${value(ids.prefix)} ${value(ids.name)}`
        }),
      onboardingTestIds
    )
    expect(shown).toEqual(choices)
  }

  async toggle(name: string): Promise<void> {
    await this.#choice(name).getByTestId(onboardingTestIds.chosen).click()
  }

  async setPrefix(name: string, prefix: string): Promise<void> {
    await this.#choice(name).getByTestId(onboardingTestIds.prefix).fill(prefix)
  }

  /** Adds a row and names it, leaving the suggested prefix. */
  async addAnother(name: string): Promise<void> {
    await this.#page.getByTestId(onboardingTestIds.another).click()
    await this.#page.getByTestId(onboardingTestIds.name).last().fill(name)
  }

  async expectStartLabel(label: string): Promise<void> {
    await expect(this.#page.getByTestId(onboardingTestIds.start)).toHaveText(label)
  }

  /** Starts, and expects to land in the Inbox. */
  async start(): Promise<TaskListPage> {
    await this.#page.getByTestId(onboardingTestIds.start).click()
    const inbox = new TaskListPage(this.#page)
    await inbox.expectHeading("Inbox")
    return inbox
  }

  /** Starts, and expects to stay here. */
  async startExpectingProblems(): Promise<void> {
    await this.#page.getByTestId(onboardingTestIds.start).click()
    await this.expectWelcome()
  }

  async expectProblem(name: string, problem: string): Promise<void> {
    await expect(this.#choice(name).getByTestId(onboardingTestIds.problem)).toHaveText(problem)
  }

  async expectError(text: string): Promise<void> {
    await expect(this.#page.getByTestId(onboardingTestIds.error)).toContainText(text)
  }

  async expectAccessible(): Promise<void> {
    await expectAccessible(this.#page, "onboarding")
  }
}
