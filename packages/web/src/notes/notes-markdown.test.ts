import { describe, expect, it } from "vite-plus/test"
import { normaliseNotes } from "./notes-markdown.ts"

describe("normaliseNotes", () => {
  it.each([
    ["headings and nested lists", "## Plan\n\n- Turn off the water\n- Replace the **washer**, *carefully*\n  - nested"],
    ["numbered lists", "1. one\n2. two"],
    ["checklists", "- [ ] buy a washer\n- [x] find the spanner"],
    ["quotes and code", "> a quote\n\n```\nconst a = 1 < 2 && b\n```\n\nSome `x_y * z` code"],
    ["tables", "| a   | b     |\n| --- | ----- |\n| 1   | **2** |"],
    ["images and strikethrough", "![a boiler](https://example.com/boiler.png)\n\n~~gone~~"],
    ["line breaks", "line one  \nline two"],
    ["bare addresses, and links with text", "See https://example.com/a_b?c=1 and [the docs](https://example.com/docs)"],
    ["links that open a file in VS Code", "[the letter](vscode://file/Users/matt/repos/life/letter.md)"],
    ["ordinary punctuation", "snake_case, Fish & chips, 1 < 2, H-142, 50% off: ok? (yes) #hashtag 3.5"],
    ["an escaped heading", "\\# not a heading"],
    ["an escaped list", "\\- not a list"],
    ["an escaped numbered list", "1\\. not a list either"],
    ["an escaped quote", "\\> not a quote"],
    ["escaped inline syntax", "\\*not emphasis\\*, \\_nor this\\_, \\[nor a link\\]"],
    ["escaped entities and tags", "&amp;copy; and \\<b>not html\\</b>"]
  ])("keeps canonical Markdown as it is: %s", (_, markdown) => {
    expect(normaliseNotes(markdown)).toBe(markdown)
  })

  it("brings other styles to the canonical one", () => {
    expect(normaliseNotes("Plan\n====\n\n* one\n* two\n\n__bold__\n\n***")).toBe(
      "# Plan\n\n- one\n- two\n\n**bold**\n\n---"
    )
  })

  it("shows HTML as the text it is", () => {
    expect(normaliseNotes("<details>hi</details>")).toBe("\\<details>hi\\</details>")
  })

  it("is stable: normalising twice changes nothing more", () => {
    const messy = "Plan\n---\n\n+ a\n+ b\n\n1) x\n\n<b>hi</b> & *em*"
    expect(normaliseNotes(normaliseNotes(messy))).toBe(normaliseNotes(messy))
  })
})
