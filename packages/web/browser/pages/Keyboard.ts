import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { ShortcutsHelp } from "./ShortcutsHelp.ts"
import { TaskListPage } from "./TaskListPage.ts"
import { sidebarTestIds } from "../../src/app/SidebarTestIds.ts"
import { quickCaptureTestIds } from "../../src/tasks/list/QuickCaptureTestIds.ts"

/** The app's keyboard shortcuts, on any page. Keys are written as the app names them: `c`, `g h`, `mod+z`. */
export class Keyboard extends PageObject {
  readonly #page: Page

  constructor(page: Page) {
    super()
    this.#page = page
  }

  /** Presses each key of a sequence in turn, once the app is showing: unlike a click, a key press doesn't wait for that. */
  async press(keys: string): Promise<void> {
    await expect(this.#page.getByTestId(sidebarTestIds.inbox)).toBeVisible()
    for (const key of keys.split(" ")) await this.#page.keyboard.press(key.replace("mod+", "ControlOrMeta+"))
  }

  /** `C`, a title and Enter, then Escape to leave capture: lands on the list the task goes into. */
  async addTask(title: string): Promise<TaskListPage> {
    await this.press("c")
    const input = this.#page.getByTestId(quickCaptureTestIds.title)
    await expect(input).toBeFocused()
    await this.#page.keyboard.type(title)
    await this.#page.keyboard.press("Enter")
    await expect(input).toHaveValue("")
    await this.#page.keyboard.press("Escape")
    await expect(input).not.toBeFocused()
    return new TaskListPage(this.#page)
  }

  async goTo(keys: string): Promise<TaskListPage> {
    await this.press(keys)
    return new TaskListPage(this.#page)
  }

  async openShortcuts(): Promise<ShortcutsHelp> {
    await this.press("?")
    return new ShortcutsHelp(this.#page)
  }

  /** Quick capture wasn't given the cursor: checked after something else has happened since. */
  async expectCaptureNotFocused(): Promise<void> {
    await expect(this.#page.getByTestId(quickCaptureTestIds.title)).not.toBeFocused()
  }
}
