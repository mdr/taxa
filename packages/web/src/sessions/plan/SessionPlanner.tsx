import { isIsoTime } from "@taxa/shared/dates/plain-date"
import { sessionTimeline } from "@taxa/shared/sessions/session-timeline"
import { useState } from "react"
import styles from "../Session.module.css"
import { sessionPageTestIds } from "../SessionPageTestIds.ts"
import { PlanEditor } from "./PlanEditor.tsx"
import { PlanStep, SessionPlanContext, type SessionPlanService } from "./session-plan-service.ts"
import { endsAtFor, WINDOW_PRESETS, WindowType } from "./session-window.ts"
import { suggestedTasks } from "./suggestions.ts"
import { totalMinutes } from "./plan-edits.ts"
import { draftSession, planRows } from "../session-rows.ts"
import { durationText, minutesText, timeSpan } from "../session-text.ts"
import { useNow } from "../use-now.ts"
import { useService, useServiceState } from "../../services/service-hooks.ts"
import { useTasks } from "../../tasks/task-queries.ts"

const PRESET_TEXT: Readonly<Record<number, string>> = {
  30: "30 min",
  60: "1 hour",
  90: "1½ hours",
  120: "2 hours",
  180: "3 hours"
}

const presetText = (minutes: number): string => PRESET_TEXT[minutes] ?? minutesText(minutes)

/** How long a session has: a length, or until a time. */
const WindowChoice = ({ plan }: { plan: SessionPlanService }) => {
  const window = useServiceState(plan, (state) => state.window)
  const problem = useServiceState(plan, (state) => state.problem)
  const now = useNow()
  const endsAt = endsAtFor(window, now)
  const [until, setUntil] = useState(window.type === WindowType.UNTIL ? window.time : "")
  return (
    <section className={`${styles.page} ${styles.narrow}`} data-testid={sessionPageTestIds.page}>
      <div className={styles.headingGroup}>
        <h1 className={styles.heading} data-testid={sessionPageTestIds.heading}>
          Plan a session
        </h1>
        <p className={styles.subtle}>How long have you got? You can change the plan as you go.</p>
      </div>
      <div className={styles.card}>
        <fieldset className={styles.chips} style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className={styles.label} style={{ marginBottom: "0.6rem" }}>
            For
          </legend>
          {WINDOW_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={styles.chip}
              aria-pressed={window.type === WindowType.LENGTH && window.minutes === minutes}
              onClick={() => {
                setUntil("")
                plan.chooseWindow({ type: WindowType.LENGTH, minutes })
              }}
              data-testid={sessionPageTestIds.preset}
            >
              {presetText(minutes)}
            </button>
          ))}
        </fieldset>
        <div className={styles.until}>
          <label className={styles.label} htmlFor="session-until">
            Or until
          </label>
          <input
            id="session-until"
            type="time"
            value={until}
            onChange={(event) => {
              setUntil(event.target.value)
              if (isIsoTime(event.target.value)) plan.chooseWindow({ type: WindowType.UNTIL, time: event.target.value })
            }}
            data-testid={sessionPageTestIds.until}
          />
        </div>
        <p className={styles.summary} data-testid={sessionPageTestIds.window}>
          {endsAt === undefined ? (
            "That time's passed today."
          ) : (
            <>
              <strong>{timeSpan(now, endsAt)}</strong>, starting now
            </>
          )}
        </p>
        {problem && (
          <p className={styles.problem} role="alert" data-testid={sessionPageTestIds.problem}>
            {problem}
          </p>
        )}
        <div className={`${styles.actions} ${styles.end}`}>
          <button
            type="button"
            className={styles.primary}
            onClick={plan.toTasks}
            data-testid={sessionPageTestIds.chooseTasks}
          >
            Choose tasks
          </button>
        </div>
      </div>
    </section>
  )
}

/** The tasks to fill the session, against the time there is. */
const TaskChoice = ({ plan }: { plan: SessionPlanService }) => {
  const window = useServiceState(plan, (state) => state.window)
  const entries = useServiceState(plan, (state) => state.entries)
  const search = useServiceState(plan, (state) => state.search)
  const starting = useServiceState(plan, (state) => state.starting)
  const problem = useServiceState(plan, (state) => state.problem)
  const tasks = useTasks({})
  const now = useNow()
  const endsAt = endsAtFor(window, now) ?? now
  const timeline = sessionTimeline(draftSession(entries, now, endsAt), now)
  const planned = totalMinutes(entries)
  const available = Math.max(1, Math.round((endsAt - now) / 60_000))
  return (
    <section className={styles.page} data-testid={sessionPageTestIds.page}>
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <h1 className={styles.heading} data-testid={sessionPageTestIds.heading}>
            Plan your session
          </h1>
          <p className={styles.subtle}>
            <span data-testid={sessionPageTestIds.window}>{timeSpan(now, endsAt)}</span> ·{" "}
            <button
              type="button"
              className={styles.link}
              onClick={plan.toWindow}
              data-testid={sessionPageTestIds.changeWindow}
            >
              change
            </button>
          </p>
        </div>
        <button
          type="button"
          className={styles.primary}
          onClick={() => void plan.start()}
          disabled={starting || entries.length === 0}
          data-testid={sessionPageTestIds.start}
        >
          Start session
        </button>
      </header>
      {problem && (
        <p className={styles.problem} role="alert" data-testid={sessionPageTestIds.problem}>
          {problem}
        </p>
      )}
      <div className={styles.capacity}>
        <div className={styles.capacityText}>
          <span data-testid={sessionPageTestIds.planned}>
            <strong>{minutesText(planned)}</strong> planned of {minutesText(available)}
          </span>
          <span className={timeline.spare >= 0 ? styles.spare : styles.over} data-testid={sessionPageTestIds.spare}>
            {timeline.spare >= 0 ? `${durationText(timeline.spare)} spare` : `${durationText(timeline.spare)} over`}
          </span>
        </div>
        <div
          className={styles.bar}
          role="img"
          aria-label={`${minutesText(planned)} planned of ${minutesText(available)}`}
        >
          <div className={styles.fill} style={{ width: `${Math.min(100, (planned / available) * 100)}%` }} />
        </div>
      </div>
      <PlanEditor
        rows={planRows(timeline, false)}
        suggestions={suggestedTasks(
          tasks.data ?? [],
          entries.map(({ taskId }) => taskId),
          search
        )}
        search={search}
        onSearch={plan.search}
        onAdd={plan.add}
        onRemove={plan.remove}
        onMove={plan.move}
        onEstimated={plan.estimated}
        busy={starting}
      />
    </section>
  )
}

/** Planning a session, before it starts. */
export const SessionPlanner = () => {
  const plan = useService(SessionPlanContext)
  const step = useServiceState(plan, (state) => state.step)
  return step === PlanStep.WINDOW ? <WindowChoice plan={plan} /> : <TaskChoice plan={plan} />
}
