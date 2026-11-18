import type { TaskId } from "@taxa/shared/ids"
import { SessionOutcome, type Session } from "@taxa/shared/sessions/session"
import { sessionTimeline, SlotState, type Slot, type Timeline } from "@taxa/shared/sessions/session-timeline"
import { TaskStatus } from "@taxa/shared/tasks/task"
import type { Instant } from "@taxa/shared/units"
import { useState } from "react"
import { Link, useLocation } from "wouter"
import styles from "../Session.module.css"
import { sessionPageTestIds } from "../SessionPageTestIds.ts"
import { PlanEditor } from "../plan/PlanEditor.tsx"
import { addEntry, DEFAULT_MINUTES, moveEntry, removeEntry, setMinutes, type PlanEntry } from "../plan/plan-edits.ts"
import { suggestedTasks } from "../plan/suggestions.ts"
import { useSessionListener } from "../session-queries.ts"
import { planRows, SLOT_STATUS, slotSpan } from "../session-rows.ts"
import { clockTime, countdown, durationText, minutesText, timeSpan } from "../session-text.ts"
import { summaryPath } from "../session-paths.ts"
import { useNow } from "../use-now.ts"
import { MORE_MINUTES, SessionRunService } from "./session-run-service.ts"
import { taxaApi } from "../../api/taxa-api.ts"
import { useServiceState } from "../../services/service-hooks.ts"
import { ShortcutGroup, ShortcutScope, useShortcuts } from "../../shortcuts/shortcut-service.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { StatusIcon } from "../../tasks/StatusIcon.tsx"
import { useTasks } from "../../tasks/task-queries.ts"

const MINUTE = 60_000

/** Finished: kept in place, ahead of what's still to do, when replanning. */
const isSettled = (session: Session, taskId: TaskId): boolean =>
  session.items.some((item) => item.task.id === taskId && item.outcome)

const slotNote = ({ item, state, spent }: Slot): string => {
  switch (state) {
    case SlotState.DONE:
    case SlotState.STOPPED:
      return `${durationText(spent)} of ${minutesText(item.minutes)}`
    case SlotState.CURRENT:
      return spent > item.minutes * MINUTE ? `${durationText(spent)} so far` : "now"
    case SlotState.NEXT:
      return minutesText(item.minutes)
  }
}

interface NowCardProps {
  slot: Slot
  busy: boolean
  finish: (outcome: SessionOutcome) => void
  moreTime: () => void
}

/** The task under way: how long's left on it, or how far over it's run, and moving on. */
const NowCard = ({ slot, busy, finish, moreTime }: NowCardProps) => {
  const { item, left, spent, start } = slot
  const planned = item.minutes * MINUTE
  const over = left < 0
  return (
    <section className={styles.card} aria-label="Now">
      <span className={styles.now}>
        <StatusIcon status={TaskStatus.IN_PROGRESS} /> Now · {item.task.ref}
      </span>
      <h2 className={styles.currentTitle} data-testid={sessionPageTestIds.currentTitle}>
        <Link href={`/tasks/${item.task.ref}`}>{item.task.title}</Link>
      </h2>
      <div className={styles.clock}>
        <span
          className={`${styles.countdown} ${over ? styles.countdownOver : ""}`}
          data-testid={sessionPageTestIds.countdown}
        >
          {over ? `${durationText(left)} over` : countdown(left)}
        </span>
        <span className={styles.subtle}>
          {over ? "of" : "left of"} {minutesText(item.minutes)} · {over ? "planned until" : "until"}{" "}
          {clockTime(start + planned)}
        </span>
      </div>
      <div
        className={styles.bar}
        role="img"
        aria-label={`${durationText(spent)} spent of ${minutesText(item.minutes)}`}
      >
        <div
          className={styles.fillCurrent}
          style={{ width: `${(Math.min(spent, planned) / Math.max(spent, planned)) * 100}%` }}
        />
        {over && <div className={styles.fillOver} style={{ flex: 1 }} />}
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => finish(SessionOutcome.DONE)}
          disabled={busy}
          aria-keyshortcuts="X"
          data-testid={sessionPageTestIds.done}
        >
          Done<span className={styles.key}>X</span>
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => finish(SessionOutcome.STOPPED)}
          disabled={busy}
          aria-keyshortcuts="I"
          data-testid={sessionPageTestIds.stop}
        >
          Stop here<span className={styles.key}>I</span>
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={moreTime}
          disabled={busy}
          data-testid={sessionPageTestIds.moreTime}
        >
          +{MORE_MINUTES} min
        </button>
      </div>
    </section>
  )
}

/** Between tasks: the next one to start, or that the plan's all done. */
const NextCard = ({ slot, busy, start }: { slot: Slot | undefined; busy: boolean; start: (slot: Slot) => void }) => (
  <section className={styles.card} aria-label="Next">
    {slot ? (
      <>
        <span className={styles.now}>Up next · {slot.item.task.ref}</span>
        <h2 className={styles.currentTitle}>
          <Link href={`/tasks/${slot.item.task.ref}`}>{slot.item.task.title}</Link>
        </h2>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => start(slot)}
            disabled={busy}
            data-testid={sessionPageTestIds.startNext}
          >
            Start it
          </button>
        </div>
      </>
    ) : (
      <>
        <h2 className={styles.currentTitle}>That's everything planned</h2>
        <p className={styles.subtle}>Replan to add more, or end the session to see how it went.</p>
      </>
    )}
  </section>
)

const slotClass = (state: SlotState): string => {
  if (state === SlotState.CURRENT) return `${styles.slot} ${styles.slotCurrent}`
  if (state === SlotState.NEXT) return styles.slot
  return `${styles.slot} ${styles.slotFinished}`
}

/** The session's tasks in time, then any time to spare. */
const SlotList = ({ timeline, endsAt }: { timeline: Timeline; endsAt: Instant }) => (
  <ol className={styles.slots} aria-label="The session's tasks">
    {timeline.slots.map((slot) => (
      <li key={slot.item.task.id} className={slotClass(slot.state)} data-testid={sessionPageTestIds.slot}>
        <span className={styles.slotTime}>{slotSpan(slot)}</span>
        <StatusIcon status={SLOT_STATUS[slot.state]} />
        <span className={`${styles.slotTitle} ${slot.state === SlotState.DONE ? styles.slotDone : ""}`}>
          <Link href={`/tasks/${slot.item.task.ref}`}>{slot.item.task.title}</Link>
        </span>
        <span className={styles.slotNote}>{slotNote(slot)}</span>
      </li>
    ))}
    {timeline.spare > 0 && (
      <li className={`${styles.slot} ${styles.slotFinished}`}>
        <span className={styles.slotTime}>
          {clockTime(timeline.finish)} – {clockTime(endsAt)}
        </span>
        <span className={styles.slotTitle}>{durationText(timeline.spare)} spare</span>
      </li>
    )}
  </ol>
)

const UNDO_TEXT: Record<SessionOutcome, string> = {
  [SessionOutcome.DONE]: "done",
  [SessionOutcome.STOPPED]: "stopped, left open"
}

/** After Done or Stop here, until the next change: what happened, and a way to take it back. */
const UndoBar = ({ run, session }: { run: SessionRunService; session: Session }) => {
  const undoable = useServiceState(run, (state) => state.undoable)
  const busy = useServiceState(run, (state) => state.busy)
  if (!undoable) return undefined
  return (
    <div className={styles.undo} role="status" data-testid={sessionPageTestIds.undoBar}>
      <span>
        “{undoable.title}” {UNDO_TEXT[undoable.outcome]}
      </span>
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => void run.undo(session)}
        disabled={busy}
        data-testid={sessionPageTestIds.undo}
      >
        Undo
      </button>
    </div>
  )
}

/** Where the session stands: its time, what's left, and whether the plan fits. */
const statusText = (session: Session, timeline: Timeline): { text: string; spare: string } => ({
  text: `${timeSpan(Date.parse(session.startedAt), Date.parse(session.endsAt))} · ${
    timeline.remaining > 0 ? `${durationText(timeline.remaining)} left` : "time's up"
  } · `,
  spare: timeline.spare >= 0 ? `${durationText(timeline.spare)} spare` : `plan runs to ${clockTime(timeline.finish)}`
})

/** A session under way: the task now, what's next, and moving on. */
export const SessionNow = ({ session }: { session: Session }) => {
  const listener = useSessionListener()
  const [run] = useState(() => new SessionRunService(taxaApi, appAnalytics, listener))
  const busy = useServiceState(run, (state) => state.busy)
  const problem = useServiceState(run, (state) => state.problem)
  const [replanning, setReplanning] = useState(false)
  const [search, setSearch] = useState("")
  const [, navigate] = useLocation()
  const tasks = useTasks({}, replanning)
  const timeline = sessionTimeline(session, useNow())
  const { current } = timeline

  const finish = (outcome: SessionOutcome) => void run.finish(session, outcome)
  const end = async () => {
    await run.end(session)
    navigate(summaryPath(session.id))
  }
  const underWay = () => current !== undefined && !run.state.busy
  useShortcuts(ShortcutScope.PAGE, [
    {
      keys: ["x"],
      description: "Done: on to the next task",
      group: ShortcutGroup.TASKS,
      run: () => finish(SessionOutcome.DONE),
      available: underWay
    },
    {
      keys: ["i"],
      description: "Stop here: on to the next task, leaving this open",
      group: ShortcutGroup.TASKS,
      run: () => finish(SessionOutcome.STOPPED),
      available: underWay
    }
  ])

  const plan: PlanEntry[] = session.items.map(({ task, minutes }) => ({ taskId: task.id, minutes }))
  const settled = plan.filter(({ taskId }) => isSettled(session, taskId))
  const toDo = plan.filter(({ taskId }) => !isSettled(session, taskId))
  /** The top of what's still to do is the task under way: put another there, and that's started now, the other waiting next. */
  const replan = (entries: PlanEntry[]) => {
    const first = entries[0]?.taskId
    const switchTo = current && first !== undefined && first !== current.item.task.id ? first : undefined
    void run.replan(session, [...settled, ...entries], switchTo)
  }
  const status = statusText(session, timeline)

  return (
    <section className={styles.page} data-testid={sessionPageTestIds.page}>
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <h1 className={styles.heading} data-testid={sessionPageTestIds.heading}>
            Session
          </h1>
          <p className={styles.subtle} data-testid={sessionPageTestIds.status}>
            {status.text}
            <span className={timeline.spare >= 0 ? styles.spare : styles.over}>{status.spare}</span>
          </p>
        </div>
        <button
          type="button"
          className={styles.secondary}
          aria-pressed={replanning}
          onClick={() => setReplanning(!replanning)}
          data-testid={sessionPageTestIds.replan}
        >
          {replanning ? "Done replanning" : "Replan"}
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => void end()}
          disabled={busy}
          data-testid={sessionPageTestIds.end}
        >
          End session
        </button>
      </header>
      <UndoBar run={run} session={session} />
      {problem && (
        <p className={styles.problem} role="alert" data-testid={sessionPageTestIds.problem}>
          {problem}
        </p>
      )}
      {current ? (
        <NowCard slot={current} busy={busy} finish={finish} moreTime={() => void run.addTime(session)} />
      ) : (
        <NextCard slot={timeline.next} busy={busy} start={(slot) => void run.startTask(session, slot.item.task.id)} />
      )}
      {replanning ? (
        <PlanEditor
          rows={planRows(timeline, true)}
          suggestions={suggestedTasks(
            tasks.data ?? [],
            plan.map(({ taskId }) => taskId),
            search
          )}
          search={search}
          onSearch={setSearch}
          onAdd={(task, at) =>
            replan(addEntry(toDo, { taskId: task.id, minutes: task.estimateMinutes ?? DEFAULT_MINUTES }, at))
          }
          onRemove={(taskId) => replan(removeEntry(toDo, taskId))}
          onMove={(taskId, to) => replan(moveEntry(toDo, taskId, to))}
          onEstimated={(task) => replan(setMinutes(toDo, task.id, task.estimateMinutes ?? DEFAULT_MINUTES))}
          busy={busy}
        />
      ) : (
        <SlotList timeline={timeline} endsAt={Date.parse(session.endsAt)} />
      )}
    </section>
  )
}
