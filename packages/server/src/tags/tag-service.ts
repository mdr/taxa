import { ActivityType } from "@taxa/shared/activity/activity"
import { ProblemType } from "@taxa/shared/api/problem"
import { hasTag, withTagRenamed, type TagSummary } from "@taxa/shared/tasks/tags"
import { ACTIVE_STATUSES, TaskStatus } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import type { Caller } from "../auth/caller.ts"
import type { Db } from "../database/database.ts"
import { ProblemError } from "../http/problem-error.ts"
import { LOG_CODES, type ServerLogger } from "../telemetry/log.ts"
import { changeTask } from "../tasks/task-service.ts"
import { editTask } from "../tasks/task-state.ts"
import { findTasks, type FoundTask } from "../tasks/task-store.ts"

const EVERY_STATUS: readonly TaskStatus[] = Object.values(TaskStatus)

/** Every live task this person can see, whatever its status. */
const everyTask = (db: Db, caller: Caller): Promise<FoundTask[]> =>
  findTasks(db, caller.user.id, { domainId: undefined, statuses: EVERY_STATUS, inbox: undefined })

/**
 * The tags on tasks this person can see, by name, each once whatever its
 * case (spelled as most of its tasks spell it), with how many of its tasks
 * are still to do.
 */
export const listTags = async (db: Db, caller: Caller): Promise<TagSummary[]> => {
  const tags = new Map<string, { spellings: Map<string, number>; openCount: number }>()
  for (const { row } of await everyTask(db, caller)) {
    for (const tag of row.tags) {
      const entry = tags.get(tag.toLowerCase()) ?? { spellings: new Map<string, number>(), openCount: 0 }
      entry.spellings.set(tag, (entry.spellings.get(tag) ?? 0) + 1)
      if (ACTIVE_STATUSES.includes(row.status)) entry.openCount++
      tags.set(tag.toLowerCase(), entry)
    }
  }
  return [...tags.values()]
    .map(({ spellings, openCount }) => ({
      name: [...spellings].reduce((best, next) => (next[1] > best[1] ? next : best))[0],
      openCount
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}

/** Renames a tag on every task this person can see that has it, each change in its task's activity. */
export const renameTag = async (
  db: Db,
  log: ServerLogger,
  caller: Caller,
  { from, to }: { from: string; to: string },
  now: Instant
): Promise<{ renamed: number }> => {
  const tagged = (await everyTask(db, caller)).filter(({ row }) => hasTag(row.tags, from))
  if (tagged.length === 0)
    throw new ProblemError(ProblemType.NOT_FOUND, `No task you can see is tagged ${JSON.stringify(from)}.`)
  for (const { row } of tagged)
    await changeTask(db, log, caller, row.id, undefined, now, {
      type: ActivityType.TASK_UPDATED,
      code: LOG_CODES.task.updated,
      apply: async (state) => editTask(state, { set: { tags: withTagRenamed(state.tags, from, to) }, clear: [] })
    })
  return { renamed: tagged.length }
}
