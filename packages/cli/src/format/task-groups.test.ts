import { describe, expect, it } from "vite-plus/test"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { Horizon, Priority, TaskStatus } from "@taxa/shared/tasks/task"
import { makeTask } from "@taxa/shared/test-support/make-task"
import { formatTaskRef } from "@taxa/shared/tasks/task-ref"
import { domainPrefix } from "@taxa/shared/domains/domain"
import type { TaskRef } from "@taxa/shared/tasks/task-ref"
import { PLAIN, shownLength, type Style } from "./style.ts"
import { taskGroups } from "./task-groups.ts"

const TODAY: IsoDate = "2026-11-26"
const WEB = "https://taxa.example.com"

const ref = (number: number): TaskRef => formatTaskRef(domainPrefix("P"), number)

/** Styled in layout, without colour codes, so the layout's easy to read in a test. */
const PLAIN_STYLED: Style = { ...PLAIN, styled: true }

/** Styled, with each colour written out so tests can read it: `<red>overdue</red>`. */
const marked = (columns?: number): Style => {
  const tag = (name: string) => (text: string) => `<${name}>${text}</${name}>`
  return {
    ...PLAIN,
    styled: true,
    columns,
    bold: tag("b"),
    dim: tag("dim"),
    red: tag("red"),
    orange: tag("orange"),
    amber: tag("amber"),
    green: tag("green"),
    cyan: tag("cyan"),
    violet: tag("violet")
  }
}

const tasks = [
  makeTask({ ref: ref(29), title: "Chrome password manager decommission", status: TaskStatus.IN_PROGRESS }),
  makeTask({ ref: ref(46), title: "Ecotalk SIM payment", scheduled: TODAY, due: "2026-12-03" }),
  makeTask({ ref: ref(9), title: "Renew passport", due: "2026-11-20", priority: Priority.URGENT }),
  makeTask({ ref: ref(49), title: "Study Anki cards", scheduled: "2026-11-27" }),
  makeTask({ ref: ref(4), title: "Sell the Zip drive", tags: ["Life Admin"], inbox: true }),
  makeTask({ ref: ref(70), title: "Learn the cello", horizon: Horizon.SOMEDAY }),
  makeTask({ ref: ref(12), title: "Call Sam", status: TaskStatus.WAITING, waitingOn: "Sam" })
]

describe("taskGroups", () => {
  it("lists tasks under headings in order, keeping the server's order within each", () => {
    const shown = taskGroups(tasks, { today: TODAY, web: WEB, style: PLAIN_STYLED, grouped: true })
    expect(shown).toBe(
      [
        "In progress 1",
        "  ◐ P-29  Chrome password manager decommission",
        "",
        "Waiting 1",
        "  ◔ P-12  Call Sam  on Sam",
        "",
        "Today 2",
        "  ◯ P-46  Ecotalk SIM payment  due Thu 3 Dec",
        "  ◯ P-9   ‼ Renew passport  overdue Fri 20 Nov",
        "",
        "Tomorrow 1",
        "  ◯ P-49  Study Anki cards",
        "",
        "Later 1",
        "  ◯ P-4   Sell the Zip drive  Inbox  #Life Admin",
        "",
        "Someday 1",
        "  ◯ P-70  Learn the cello"
      ].join("\n")
    )
  })

  it("marks what needs attention in colour: overdue red, urgent red, due today amber", () => {
    const dueToday = makeTask({ ref: ref(5), title: "Pay the bill", due: TODAY })
    const shown = taskGroups([tasks[2]!, dueToday], { today: TODAY, web: WEB, style: marked(), grouped: true })
    expect(shown).toContain("<red>‼</red> Renew passport  <red>overdue Fri 20 Nov</red>")
    expect(shown).toContain("Pay the bill  <amber>due today</amber>")
    expect(shown).toContain("<b>Today</b> <dim>2</dim>")
  })

  it("cuts long titles to the terminal's width, keeping the right-hand column", () => {
    const long = makeTask({
      ref: ref(52),
      title: "Go through Jo's passwords with her and fix any flagged in a data breach",
      tags: ["Jo"]
    })
    const [, line] = taskGroups([long], {
      today: TODAY,
      web: WEB,
      style: { ...PLAIN_STYLED, columns: 50 },
      grouped: true
    }).split("\n")
    expect(line).toBe("  ◯ P-52  Go through Jo's passwords with her…  #Jo")
    expect(shownLength(line!)).toBe(50)
  })

  it("keeps search results in one list, best matches first", () => {
    const shown = taskGroups(tasks.slice(0, 2), { today: TODAY, web: WEB, style: PLAIN_STYLED, grouped: false })
    expect(shown).toBe("◐ P-29  Chrome password manager decommission\n◯ P-46  Ecotalk SIM payment  due Thu 3 Dec")
  })
})
