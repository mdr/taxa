import { expect, type Page } from "@playwright/test"
import { PageObject } from "./steps.ts"
import { CommandMenu } from "./CommandMenu.ts"
import { ShortcutsHelp } from "./ShortcutsHelp.ts"
import { TaskDetailPage } from "./TaskDetailPage.ts"
import { TaskListPage } from "./TaskListPage.ts"
import { datePickerTestIds } from "../../src/dates/DatePickerTestIds.ts"
import { optionListTestIds } from "../../src/ui/OptionListTestIds.ts"
import { notesEditorTestIds } from "../../src/notes/NotesEditorTestIds.ts"
import { titleFieldTestIds } from "../../src/tasks/detail/TitleFieldTestIds.ts"
import { sidebarTestIds } from "../../src/app/SidebarTestIds.ts"
import { quickCaptureTestIds } from "../../src/tasks/list/QuickCaptureTestIds.ts"
import { tagPickerTestIds } from "../../src/tags/TagPickerTestIds.ts"

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

  async openCommandMenu(): Promise<CommandMenu> {
    await this.press("mod+k")
    return new CommandMenu(this.#page)
  }

  async openShortcuts(): Promise<ShortcutsHelp> {
    await this.press("?")
    return new ShortcutsHelp(this.#page)
  }

  /** Quick capture wasn't given the cursor: checked after something else has happened since. */
  async expectCaptureNotFocused(): Promise<void> {
    await expect(this.#page.getByTestId(quickCaptureTestIds.title)).not.toBeFocused()
  }

  /** Enter on the highlighted task. */
  async openHighlighted(): Promise<TaskDetailPage> {
    await this.press("Enter")
    return new TaskDetailPage(this.#page)
  }

  /** Escape, from a task's page to its list. */
  async backToList(): Promise<TaskListPage> {
    await this.press("Escape")
    return new TaskListPage(this.#page)
  }

  /** A picker's key, then the arrow keys to an option, and Enter. */
  async choose(key: string, value: string): Promise<void> {
    await this.press(key)
    await this.chooseInOpenPicker(value)
  }

  /** The arrow keys to an option in the picker that's open, and Enter. */
  async chooseInOpenPicker(value: string): Promise<void> {
    const focused = this.#page.locator(`[data-testid="${optionListTestIds.option}"]:focus`)
    await expect(focused).toHaveCount(1)
    for (let step = 0; step < 10 && (await focused.getAttribute("data-value")) !== value; step++) {
      await this.#page.keyboard.press("ArrowDown")
    }
    await expect(focused).toHaveAttribute("data-value", value)
    await this.#page.keyboard.press("Enter")
  }

  /** A date picker's key, then a date typed, and Enter. */
  async typeDate(key: string, date: string): Promise<void> {
    await this.press(key)
    await expect(this.#page.getByTestId(datePickerTestIds.typed)).toBeFocused()
    await this.#page.keyboard.type(date)
    await this.#page.keyboard.press("Enter")
    await expect(this.#page.getByTestId(datePickerTestIds.typed)).toHaveCount(0)
  }

  /** A tag picker's key, then a tag typed, and Enter: the one it finds, or a new one. */
  async typeTag(key: string, tag: string): Promise<void> {
    await this.press(key)
    await expect(this.#page.getByTestId(tagPickerTestIds.input)).toBeFocused()
    await this.#page.keyboard.type(tag)
    await this.#page.keyboard.press("Enter")
  }

  /** `R`: the title, selected, replaced by typing, and Enter. */
  async rename(title: string): Promise<void> {
    await this.press("r")
    await expect(this.#page.getByTestId(titleFieldTestIds.title)).toBeFocused()
    await this.#page.keyboard.type(title)
    await this.#page.keyboard.press("Enter")
  }

  /** `N`: writes at the end of the notes, then leaves them with Escape. */
  async writeNotes(text: string): Promise<void> {
    await this.press("n")
    await expect(this.#page.getByTestId(notesEditorTestIds.editor)).toBeFocused()
    await this.#page.keyboard.type(text)
    await this.#page.keyboard.press("Escape")
  }
}
