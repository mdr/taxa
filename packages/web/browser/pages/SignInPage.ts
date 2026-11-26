import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { signInPageTestIds } from "../../src/sign-in/SignInPageTestIds.ts"

/** What a browser that isn't signed in sees. */
export class SignInPage extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  /** Signing in goes to the server's sign-in, to come back to this page. */
  async expectSignInComesBackTo(apiUrl: string, page: string): Promise<void> {
    await expect(this.#page.getByTestId(signInPageTestIds.signIn)).toHaveAttribute(
      "href",
      `${apiUrl}/auth/sign-in?then=${encodeURIComponent(page)}`
    )
  }

  async expectProblem(text: string): Promise<void> {
    await expect(this.#page.getByTestId(signInPageTestIds.problem)).toContainText(text)
  }

  async expectNoProblem(): Promise<void> {
    await expect(this.#page.getByTestId(signInPageTestIds.problem)).toHaveCount(0)
  }
}
