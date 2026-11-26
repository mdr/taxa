import { describe, expect, it } from "vite-plus/test"
import { UsageError } from "../command.ts"
import { ColorChoice, colorChoiceOf, cut, shownLength, styleFor } from "./style.ts"

const TERMINAL = { columns: 80 }

describe("styleFor", () => {
  it("styles for a terminal and not for a pipe, as agents and scripts get", () => {
    expect(styleFor(ColorChoice.AUTO, {}, TERMINAL)).toMatchObject({ styled: true, columns: 80 })
    expect(styleFor(ColorChoice.AUTO, {}, undefined).styled).toBe(false)
  })

  it("takes NO_COLOR and FORCE_COLOR as the conventions say, and --color over both", () => {
    expect(styleFor(ColorChoice.AUTO, { NO_COLOR: "1" }, TERMINAL).styled).toBe(false)
    expect(styleFor(ColorChoice.AUTO, { NO_COLOR: "" }, TERMINAL).styled).toBe(true)
    expect(styleFor(ColorChoice.AUTO, { FORCE_COLOR: "1" }, undefined).styled).toBe(true)
    expect(styleFor(ColorChoice.AUTO, { FORCE_COLOR: "0" }, undefined).styled).toBe(false)
    expect(styleFor(ColorChoice.ALWAYS, { NO_COLOR: "1" }, undefined).styled).toBe(true)
    expect(styleFor(ColorChoice.NEVER, { FORCE_COLOR: "1" }, TERMINAL).styled).toBe(false)
  })

  it("links refs only in a terminal, and leaves text alone when plain", () => {
    const url = "https://taxa.example.com/tasks/H-7"
    expect(styleFor(ColorChoice.AUTO, {}, TERMINAL).link(url, "H-7")).toContain(url)
    expect(styleFor(ColorChoice.ALWAYS, {}, undefined).link(url, "H-7")).toBe("H-7")
    const plain = styleFor(ColorChoice.NEVER, {}, TERMINAL)
    expect(plain.red(plain.bold("Overdue"))).toBe("Overdue")
  })

  it("takes only auto, always or never", () => {
    expect(colorChoiceOf(undefined)).toBe(ColorChoice.AUTO)
    expect(colorChoiceOf("always")).toBe(ColorChoice.ALWAYS)
    expect(() => colorChoiceOf("yes")).toThrow(UsageError)
  })
})

describe("cutting to fit", () => {
  it("counts what shows, not the styling", () => {
    const style = styleFor(ColorChoice.ALWAYS, {}, TERMINAL)
    expect(shownLength(style.link("https://x.example", style.red("£14 ◐")))).toBe(5)
  })

  it("ends a cut line with an ellipsis, and leaves one that fits", () => {
    expect(cut("Buy an Apple TV 4K", 10)).toBe("Buy an Ap…")
    expect(cut("Buy an Apple TV 4K", 18)).toBe("Buy an Apple TV 4K")
  })
})
