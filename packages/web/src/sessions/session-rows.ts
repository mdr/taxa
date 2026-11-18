import { sessionId } from "@taxa/shared/ids"
import type { Session } from "@taxa/shared/sessions/session"
import { SlotState, type Slot, type Timeline } from "@taxa/shared/sessions/session-timeline"
import { TaskStatus } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import type { PlanRow } from "./plan/PlanEditor.tsx"
import type { PlannedEntry } from "./plan/session-plan-service.ts"
import { clockTime, durationText, minutesText } from "./session-text.ts"

/** Stands in for a session not yet started, so a plan can be laid out in time like one. */
const DRAFT_ID = sessionId("00000000-0000-7000-8000-000000000000")

export const draftSession = (entries: readonly PlannedEntry[], startedAt: Instant, endsAt: Instant): Session => ({
  id: DRAFT_ID,
  startedAt: new Date(startedAt).toISOString(),
  endsAt: new Date(endsAt).toISOString(),
  items: entries.map(({ task, minutes }) => ({ task, minutes, spentMs: 0 })),
  note: "",
  version: 0
})

export const SLOT_STATUS: Record<SlotState, TaskStatus> = {
  [SlotState.DONE]: TaskStatus.DONE,
  [SlotState.STOPPED]: TaskStatus.OPEN,
  [SlotState.CURRENT]: TaskStatus.IN_PROGRESS,
  [SlotState.NEXT]: TaskStatus.OPEN
}

const detailOf = ({ item, state, spent }: Slot): string | undefined => {
  switch (state) {
    case SlotState.DONE:
      return `Done in ${durationText(spent)}`
    case SlotState.STOPPED:
      return `Stopped after ${durationText(spent)}`
    case SlotState.CURRENT:
      return "Under way"
    case SlotState.NEXT:
      return item.task.estimateMinutes === undefined
        ? `No estimate: counted as ${minutesText(item.minutes)}`
        : undefined
  }
}

export const slotSpan = ({ start, end }: Slot): string => `${clockTime(start)} – ${clockTime(end)}`

/** The timeline's tasks as the plan editor shows them; with statuses, for a session under way. */
export const planRows = (timeline: Timeline, underWay: boolean): PlanRow[] =>
  timeline.slots.map((slot) => ({
    task: slot.item.task,
    minutes: slot.item.minutes,
    span: slotSpan(slot),
    locked: slot.state === SlotState.DONE || slot.state === SlotState.STOPPED,
    underWay: slot.state === SlotState.CURRENT,
    ...(underWay ? { status: SLOT_STATUS[slot.state] } : {}),
    detail: detailOf(slot)
  }))
