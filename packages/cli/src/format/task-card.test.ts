import { describe, expect, it } from "vite-plus/test"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { timeZone } from "@taxa/shared/dates/plain-date"
import { Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import type { Comment } from "@taxa/shared/comments/comment"
import { markdownText } from "./markdown-format.ts"
import { PLAIN, shownLength, wrap, type Style } from "./style.ts"
import { taskCard, type CardContext } from "./task-card.ts"

const TODAY: IsoDate = "2026-11-26"

/** Styled in layout, without colour codes, so the layout's easy to read. */
const LAYOUT: Style = { ...PLAIN, styled: true }

const card = (style: Style = LAYOUT): CardContext => ({
  today: TODAY,
  timeZone: timeZone("Europe/London"),
  web: "https://taxa.example.com",
  style
})

const NONE = { followsOn: undefined, ledTo: [] }

describe("taskCard", () => {
  it("puts the title first and its facts on a line under it, leaving out what's rarely wanted", () => {
    const task = makeTask({
      title: "Renew passport",
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.URGENT,
      tags: ["Admin"],
      scheduled: TODAY,
      due: "2026-11-20",
      inbox: true
    })
    const domain = { id: task.domainId, name: "Home", prefix: "H" } as never
    expect(taskCard(task, domain, NONE, [], card())).toBe(
      [
        "H-1  Renew passport",
        "◐ in progress · Home, in your Inbox · ‼ urgent · #Admin",
        "planned today · overdue, due Fri 20 Nov"
      ].join("\n")
    )
  })

  it("draws the checklist as a bar and ticks, numbered as taxa check takes them", () => {
    const task = makeTask({
      checklist: [
        { id: "a", text: "Oxfam", done: true },
        { id: "b", text: "Shelter", done: false }
      ] as never
    })
    const shown = taskCard(task, undefined, NONE, [], card())
    expect(shown).toContain(`Checklist  ${"━".repeat(12)}${"─".repeat(12)} 1/2`)
    expect(shown).toContain("  1 ✓ Oxfam\n  2 ☐ Shelter")
  })

  it("shows only the latest comment, saying how to see the rest", () => {
    const comment = (body: string, at: string): Comment =>
      ({ id: body, body, createdAt: at, author: { user: { id: "u", name: "Matt" } } }) as never
    const shown = taskCard(
      makeTask(),
      undefined,
      NONE,
      [comment("Rang them", "2026-11-25T10:00:00Z"), comment("Booked", "2026-11-26T12:15:00Z")],
      card()
    )
    expect(shown).toContain("Latest comment of 2 · taxa comments H-1 for all\n  Matt · today 12:15\n  Booked")
    expect(shown).not.toContain("Rang them")
  })

  it("cuts checklist items to the terminal's width", () => {
    const task = makeTask({
      checklist: [{ id: "a", text: "Delete stale Chrome entries for Reddit, BSBI and Instagram", done: false }] as never
    })
    const lines = taskCard(task, undefined, NONE, [], card({ ...LAYOUT, columns: 40 })).split("\n")
    expect(lines.at(-1)).toBe("  1 ☐ Delete stale Chrome entries for R…")
    expect(shownLength(lines.at(-1)!)).toBe(40)
  })
})

describe("markdownText", () => {
  it("draws headings, bullets, bold, code and links for a terminal", () => {
    const tag = (name: string) => (text: string) => `<${name}>${text}</${name}>`
    const style: Style = { ...LAYOUT, bold: tag("b"), cyan: tag("c"), link: (url, text) => `[${text}](${url})` }
    expect(markdownText("# Plan\n- Ring **Sam**\n- See `notes.md`\n\n[Site](https://x.example)", style)).toBe(
      "  <b>Plan</b>\n  • Ring <b>Sam</b>\n  • See <c>notes.md</c>\n\n  [<c>Site</c>](https://x.example)"
    )
  })
})

describe("wrap", () => {
  it("breaks between words to fit, indenting what follows", () => {
    expect(wrap("one two three four", 10, "  ")).toBe("one two\n  three\n  four")
    expect(wrap("one two three four", undefined)).toBe("one two three four")
  })
})
