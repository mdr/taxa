import { ChecklistChangeType, itemsFromText, type ChecklistItem } from "@taxa/shared/tasks/checklist"
import type { Task } from "@taxa/shared/tasks/task"
import { ExitCode } from "../cli-io.ts"
import { linked, oneArgument, print, stringOption, UsageError, type Command, type CommandContext } from "../command.ts"
import { checklistText } from "../format/checklist-format.ts"
import { STDIN } from "../input/stdin-json.ts"

const ITEM_HELP = "ITEM is an item's number, as taxa checklist shows it, or its text (or enough of it to tell)."

/** An item by its number, or its text: all of it, or a part only it has, in any case. */
const itemFrom = (task: Task, word: string): ChecklistItem => {
  const byNumber = /^\d+$/.test(word) ? task.checklist[Number(word) - 1] : undefined
  if (byNumber) return byNumber
  const text = word.trim().toLowerCase()
  const exact = task.checklist.filter((item) => item.text.toLowerCase() === text)
  const found = exact.length > 0 ? exact : task.checklist.filter((item) => item.text.toLowerCase().includes(text))
  if (found.length === 1) return found[0]!
  throw new UsageError(
    found.length === 0
      ? `${task.ref}'s checklist has no item ${JSON.stringify(word)}: taxa checklist ${task.ref} lists them.`
      : `${found.length} of ${task.ref}'s items match ${JSON.stringify(word)}: give its number from taxa checklist ${task.ref}.`
  )
}

const printChecklist = (context: CommandContext, task: Task): void =>
  print(context, task.checklist, () => checklistText(task.ref, task.checklist))

const checklist: Command = {
  name: "checklist",
  summary: "A task's checklist: its steps, numbered, and which are ticked",
  usage: "<ref>",
  options: {},
  run: async (context, _values, positionals) => {
    printChecklist(context, await context.client.task(oneArgument(positionals, "task")))
    return ExitCode.OK
  }
}

const ticking = (done: boolean): Command => ({
  name: done ? "check" : "uncheck",
  summary: done ? "Tick items off a task's checklist" : "Untick items on a task's checklist",
  usage: `<ref> <ITEM>...
${ITEM_HELP} Give several to ${done ? "tick" : "untick"} them all.`,
  options: {},
  run: async (context, _values, positionals) => {
    const [ref, ...words] = positionals
    if (ref === undefined || words.length === 0) throw new UsageError("Say which task, and which items.")
    let task = await context.client.task(ref)
    const items = words.map((word) => itemFrom(task, word))
    for (const item of items)
      task = await context.client.changeChecklist(task.id, { type: ChecklistChangeType.TICK, item: item.id, done })
    printChecklist(context, task)
    return ExitCode.OK
  }
})

const addItem: Command = {
  name: "add-item",
  summary: "Add items to a task's checklist",
  usage: `<ref> <text>...   or   taxa add-item <ref> - < items.txt
  --after ITEM          After this item, not at the end
Each argument is an item; with -, each line on stdin is (list markers like "- " or "- [ ] " are left off).
${ITEM_HELP}`,
  options: { after: { type: "string" } },
  run: async (context, values, positionals) => {
    const [ref, ...words] = positionals
    if (ref === undefined) throw new UsageError("Say which task.")
    const texts = words.length === 1 && words[0] === STDIN ? itemsFromText(await context.io.readStdin()) : words
    if (texts.length === 0) throw new UsageError("Say what to add.")
    const task = await context.client.task(ref)
    const after = stringOption(values, "after")
    printChecklist(
      context,
      await context.client.changeChecklist(task.id, {
        type: ChecklistChangeType.ADD,
        texts,
        ...(after !== undefined && { after: itemFrom(task, after).id })
      })
    )
    return ExitCode.OK
  }
}

const editItem: Command = {
  name: "edit-item",
  summary: "Change what an item on a task's checklist says",
  usage: `<ref> <ITEM> <text>
${ITEM_HELP}`,
  options: {},
  run: async (context, _values, positionals) => {
    const [ref, word, ...words] = positionals
    if (ref === undefined || word === undefined || words.length === 0)
      throw new UsageError("Say which task, which item, and what it should say.")
    const task = await context.client.task(ref)
    const item = itemFrom(task, word)
    printChecklist(
      context,
      await context.client.changeChecklist(task.id, {
        type: ChecklistChangeType.RENAME,
        item: item.id,
        text: words.join(" ")
      })
    )
    return ExitCode.OK
  }
}

const removeItem: Command = {
  name: "remove-item",
  summary: "Take an item off a task's checklist",
  usage: `<ref> <ITEM>
${ITEM_HELP}`,
  options: {},
  run: async (context, _values, positionals) => {
    const [ref, word, ...rest] = positionals
    if (ref === undefined || word === undefined || rest.length > 0)
      throw new UsageError("Say which task, and which item.")
    const task = await context.client.task(ref)
    const item = itemFrom(task, word)
    printChecklist(
      context,
      await context.client.changeChecklist(task.id, { type: ChecklistChangeType.REMOVE, item: item.id })
    )
    return ExitCode.OK
  }
}

const moveItem: Command = {
  name: "move-item",
  summary: "Move an item to another place on a task's checklist",
  usage: `<ref> <ITEM> (--after ITEM | --first)
  --after ITEM          Just after this item
  --first               To the top
${ITEM_HELP}`,
  options: { after: { type: "string" }, first: { type: "boolean" } },
  run: async (context, values, positionals) => {
    const [ref, word, ...rest] = positionals
    if (ref === undefined || word === undefined || rest.length > 0)
      throw new UsageError("Say which task, and which item.")
    const after = stringOption(values, "after")
    if ((after === undefined) === (values["first"] !== true))
      throw new UsageError("Say where: --after ITEM, or --first.")
    const task = await context.client.task(ref)
    const item = itemFrom(task, word)
    printChecklist(
      context,
      await context.client.changeChecklist(task.id, {
        type: ChecklistChangeType.MOVE,
        item: item.id,
        ...(after !== undefined && { after: itemFrom(task, after).id })
      })
    )
    return ExitCode.OK
  }
}

const itemToTask: Command = {
  name: "item-to-task",
  summary: "Make a checklist item a task of its own, which ticks the item when it's done",
  usage: `<ref> <ITEM>
The new task follows on from this one, in the same domain. The item stays on the checklist, linked to it.
${ITEM_HELP}`,
  options: {},
  run: async (context, _values, positionals) => {
    const [ref, word, ...rest] = positionals
    if (ref === undefined || word === undefined || rest.length > 0)
      throw new UsageError("Say which task, and which item.")
    const task = await context.client.task(ref)
    const item = itemFrom(task, word)
    const changed = await context.client.changeChecklist(task.id, {
      type: ChecklistChangeType.MAKE_TASK,
      item: item.id
    })
    const made = changed.checklist.find(({ id }) => id === item.id)?.task
    const shown = linked(context, await context.client.task(made!.id))
    print(context, shown, () => `Added ${shown.ref}  ${shown.title}, from ${changed.ref}'s checklist\n${shown.url}`)
    return ExitCode.OK
  }
}

export const CHECKLIST_COMMANDS: Command[] = [
  checklist,
  ticking(true),
  ticking(false),
  addItem,
  editItem,
  removeItem,
  moveItem,
  itemToTask
]
