import { describe, expect, it } from "vite-plus/test"
import { testTelemetry } from "../test-support/test-telemetry.ts"
import { ANALYTICS_CODES } from "./codes.ts"
import { changeEvent, clickEvent, enterEvent, trackUi, UiEvent, type ControlFacts } from "./ui-tracking.ts"

const control = (tag: string, track: string | undefined, type?: string): ControlFacts => ({ tag, type, track })

describe("which interaction an event is", () => {
  it("counts clicks on buttons and links, not on fields", () => {
    expect(clickEvent(control("BUTTON", "TaskRow.done"))).toBe(UiEvent.CLICKED)
    expect(clickEvent(control("A", "Sidebar.inbox"))).toBe(UiEvent.CLICKED)
    expect(clickEvent(control("INPUT", "QuickCapture.title", "text"))).toBeUndefined()
    expect(clickEvent(control("DIALOG", "ShortcutsHelp.dialog"))).toBeUndefined()
  })

  it("leaves alone a control its component tracks, or one that isn't marked", () => {
    expect(clickEvent(control("BUTTON", ""))).toBeUndefined()
    expect(clickEvent(control("BUTTON", undefined))).toBeUndefined()
    expect(changeEvent(control("INPUT", "", "text"))).toBeUndefined()
  })

  it("counts a change to a box as a toggle, and to a field as an edit", () => {
    expect(changeEvent(control("INPUT", "TickBox.done", "checkbox"))).toBe(UiEvent.TOGGLED)
    expect(changeEvent(control("INPUT", "DatePicker.typed", "text"))).toBe(UiEvent.EDITED)
    expect(changeEvent(control("TEXTAREA", "TitleField.title"))).toBe(UiEvent.EDITED)
    expect(changeEvent(control("BUTTON", "TaskRow.done"))).toBeUndefined()
  })

  it("counts Enter in a text field as finishing the edit, but not on a box", () => {
    expect(enterEvent(control("INPUT", "DatePicker.typed", "text"))).toBe(UiEvent.EDITED)
    expect(enterEvent(control("INPUT", "TickBox.done", "checkbox"))).toBeUndefined()
    expect(enterEvent(control("BUTTON", "TaskRow.done"))).toBeUndefined()
  })
})

describe("trackUi", () => {
  it("tracks what the control is for, and nothing else", () => {
    const telemetry = testTelemetry()
    trackUi(telemetry.analytics, UiEvent.OPENED, "TaskRow.menu")
    expect(telemetry.tracked()).toEqual([[ANALYTICS_CODES.ui.opened, { control: "TaskRow.menu" }]])
  })
})
