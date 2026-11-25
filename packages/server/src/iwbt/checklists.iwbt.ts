import { describe, expect } from "vite-plus/test"
import { ActivityType } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import { activityText } from "@taxa/shared/activity/activity-text"
import { ChecklistChangeType } from "@taxa/shared/tasks/checklist"
import { OccurrenceOutcome, RepeatFrom, RepeatUnit } from "@taxa/shared/tasks/repeat"
import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

const CONTEXT = { today: "2026-01-05", domainName: (): string => "Personal" }

/** A checklist as `✓ text`, `  text`, or `✓ text → P-2` for one made a task. */
const shown = ({ checklist }: Task): string[] =>
  checklist.map(({ text, done, task }) => `${done ? "✓" : " "} ${text}${task ? ` → ${task.ref}` : ""}`)

const itemId = (task: Task, text: string): Task["checklist"][number]["id"] =>
  task.checklist.find((item) => item.text === text)!.id

describe("checklists", () => {
  const it = useInProcessServer()

  it("holds a task's steps, added, ticked, reworded and removed, each change in its activity", async ({ server }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code", "mdr/life-admin")
    const giving = await matt.addTask("Move charitable giving to my name", { checklist: ["Oxfam", "Shelter"] })
    expect(shown(giving)).toEqual(["  Oxfam", "  Shelter"])

    const added = await matt.client.changeChecklist(giving.ref, {
      type: ChecklistChangeType.ADD,
      texts: ["RSPB", "Crisis"],
      after: itemId(giving, "Oxfam")
    })
    expect(shown(added)).toEqual(["  Oxfam", "  RSPB", "  Crisis", "  Shelter"])
    await claude.client.changeChecklist(giving.ref, {
      type: ChecklistChangeType.TICK,
      item: itemId(added, "Oxfam"),
      done: true
    })
    await matt.client.changeChecklist(giving.ref, {
      type: ChecklistChangeType.RENAME,
      item: itemId(added, "RSPB"),
      text: "RSPB (monthly)"
    })
    const last = await matt.client.changeChecklist(giving.ref, {
      type: ChecklistChangeType.REMOVE,
      item: itemId(added, "Crisis")
    })
    expect(shown(last)).toEqual(["✓ Oxfam", "  RSPB (monthly)", "  Shelter"])
    expect(last.version).toBe(5)

    const log = await matt.client.activity(giving.ref)
    expect(log.map((activity) => activityText(activity, CONTEXT))).toEqual([
      "Matt created this",
      "Matt added 2 items to the checklist",
      "Claude Code for Matt (mdr/life-admin) ticked “Oxfam”",
      "Matt changed “RSPB” to “RSPB (monthly)”",
      "Matt removed “Crisis” from the checklist"
    ])
    expect(server.logs.filter(({ code }) => code === "task.checklistChanged")).toHaveLength(4)
    expect(JSON.stringify(server.logs)).not.toContain("Oxfam")
  })

  it("moves an item after another, or to the top", async ({ server }) => {
    const matt = await server.user("Matt")
    const giving = await matt.addTask("Move charitable giving", { checklist: ["Oxfam", "Shelter", "RSPB"] })
    const down = await matt.client.changeChecklist(giving.ref, {
      type: ChecklistChangeType.MOVE,
      item: itemId(giving, "Oxfam"),
      after: itemId(giving, "RSPB")
    })
    expect(shown(down)).toEqual(["  Shelter", "  RSPB", "  Oxfam"])
    const top = await matt.client.changeChecklist(giving.ref, {
      type: ChecklistChangeType.MOVE,
      item: itemId(giving, "RSPB")
    })
    expect(shown(top)).toEqual(["  RSPB", "  Shelter", "  Oxfam"])
    const log = await matt.client.activity(giving.ref)
    expect(activityText(log.at(-1)!, CONTEXT)).toBe("Matt moved “RSPB”")
    await expectProblem(
      matt.client.changeChecklist(giving.ref, {
        type: ChecklistChangeType.MOVE,
        item: itemId(giving, "RSPB"),
        after: "0190f7a8-0000-7000-8000-000000000999"
      }),
      ProblemType.NOT_FOUND
    )
  })

  it("refuses items that aren't there, and more than it holds", async ({ server }) => {
    const matt = await server.user("Matt")
    const giving = await matt.addTask("Move charitable giving", { checklist: ["Oxfam"] })
    const oxfam = itemId(giving, "Oxfam")
    await matt.client.changeChecklist(giving.ref, { type: ChecklistChangeType.REMOVE, item: oxfam })
    await expectProblem(
      matt.client.changeChecklist(giving.ref, { type: ChecklistChangeType.TICK, item: oxfam, done: true }),
      ProblemType.NOT_FOUND
    )
    await matt.client.changeChecklist(giving.ref, {
      type: ChecklistChangeType.ADD,
      texts: Array.from({ length: 200 }, (_, n) => `Charity ${n}`)
    })
    await expectProblem(
      matt.client.changeChecklist(giving.ref, { type: ChecklistChangeType.ADD, texts: ["One too many"] }),
      ProblemType.INVALID_REQUEST
    )
  })

  it("makes an item a task of its own, which ticks the item when it's done", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Personal", "P")
    const giving = await matt.addTask("Move charitable giving", { domain: "P", checklist: ["Oxfam", "Shelter"] })
    const linked = await matt.client.changeChecklist(giving.ref, {
      type: ChecklistChangeType.MAKE_TASK,
      item: itemId(giving, "Oxfam")
    })
    expect(shown(linked)).toEqual(["  Oxfam → P-2", "  Shelter"])
    const oxfam = await matt.client.task("P-2")
    expect(oxfam).toMatchObject({ title: "Oxfam", domainId: giving.domainId, followsOnId: giving.id })
    await expectProblem(
      matt.client.changeChecklist(giving.ref, {
        type: ChecklistChangeType.TICK,
        item: itemId(giving, "Oxfam"),
        done: true
      }),
      ProblemType.INVALID_REQUEST
    )
    await expectProblem(
      matt.client.changeChecklist(giving.ref, { type: ChecklistChangeType.MAKE_TASK, item: itemId(giving, "Oxfam") }),
      ProblemType.INVALID_REQUEST
    )

    await matt.client.changeStatus("P-2", { status: TaskStatus.DONE })
    expect(shown(await matt.client.task(giving.ref))).toEqual(["✓ Oxfam → P-2", "  Shelter"])
    const [listed] = await matt.client
      .tasks({ domain: "P" })
      .then((tasks) => tasks.filter(({ id }) => id === giving.id))
    expect(shown(listed!)).toEqual(["✓ Oxfam → P-2", "  Shelter"])
    const log = await matt.client.activity(giving.ref)
    expect(activityText(log.at(-1)!, CONTEXT)).toBe("Matt made “Oxfam” a task of its own")
    expect(server.logs.filter(({ code }) => code === "task.created")).toHaveLength(2)
  })

  it("starts again each time a repeating task comes round", async ({ server }) => {
    const matt = await server.user("Matt")
    const review = await matt.addTask("Weekly review", {
      scheduled: "2026-01-05",
      repeat: { every: 1, unit: RepeatUnit.WEEK, from: RepeatFrom.SCHEDULE },
      checklist: ["Empty the Inbox", "Look at Soon"]
    })
    const ticked = await matt.client.changeChecklist(review.ref, {
      type: ChecklistChangeType.TICK,
      item: itemId(review, "Empty the Inbox"),
      done: true
    })
    expect(shown(ticked)).toEqual(["✓ Empty the Inbox", "  Look at Soon"])
    const next = await matt.client.recordOccurrence(review.ref, { outcome: OccurrenceOutcome.DONE })
    expect(next.scheduled).toBe("2026-01-12")
    expect(shown(next)).toEqual(["  Empty the Inbox", "  Look at Soon"])
  })

  it("undoes a tick, and refuses to undo one an item has changed since", async ({ server }) => {
    const matt = await server.user("Matt")
    const giving = await matt.addTask("Move charitable giving", { checklist: ["Oxfam", "Shelter"] })
    const oxfam = await matt.client.changeChecklist(giving.ref, {
      type: ChecklistChangeType.TICK,
      item: itemId(giving, "Oxfam"),
      done: true
    })
    const undone = await matt.client.undoTask(giving.ref, oxfam.version)
    expect(shown(undone)).toEqual(["  Oxfam", "  Shelter"])
    const log = await matt.client.activity(giving.ref)
    expect(log.at(-1)).toMatchObject({ type: ActivityType.TASK_UPDATED, undoesVersion: oxfam.version })
    expect(activityText(log.at(-1)!, CONTEXT)).toBe("Matt undid change 2: unticked “Oxfam”")
  })
})
