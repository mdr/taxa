import { formatDay, formatNearDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { OccurrenceOutcome } from "@taxa/shared/tasks/repeat"
import type { Task } from "@taxa/shared/tasks/task"
import { daysMissed } from "@taxa/shared/tasks/when"
import { useToday } from "../../dates/use-today.ts"
import { useOccurrences } from "../task-queries.ts"
import styles from "./OccurrenceStrip.module.css"
import { occurrenceStripTestIds } from "./OccurrenceStripTestIds.ts"

/** How many of the latest occurrences it shows. */
const SHOWN = 14

const OUTCOME_TEXT: Record<OccurrenceOutcome | "NEXT", string> = {
  [OccurrenceOutcome.DONE]: "done",
  [OccurrenceOutcome.SKIPPED]: "skipped",
  [OccurrenceOutcome.MISSED]: "missed",
  NEXT: "next"
}

const dayOfMonth = (date: IsoDate): string => String(Number(date.slice(8)))

interface Shown {
  key: string
  date: IsoDate
  outcome: OccurrenceOutcome | "NEXT"
}

const Day = ({ date, outcome, today }: Omit<Shown, "key"> & { today: IsoDate }) => {
  const label = `${formatDay(date, today)}: ${OUTCOME_TEXT[outcome]}`
  return (
    <li className={styles.day} data-testid={occurrenceStripTestIds.day}>
      <span className={styles.mark} data-outcome={outcome} role="img" aria-label={label} title={label} />
      <span className={styles.date}>{dayOfMonth(date)}</span>
    </li>
  )
}

/**
 * A repeating task's latest occurrences, oldest first, each done, skipped or
 * missed, then the one it's next for. Days it's missed that its next change
 * will record show as missed already.
 */
export const OccurrenceStrip = ({ task }: { task: Task }) => {
  const today = useToday()
  const pending = daysMissed(task, today)
  const recorded: Shown[] = (useOccurrences(task).data ?? []).map(({ id, date, outcome }) => ({
    key: id,
    date,
    outcome
  }))
  const missed: Shown[] = (pending?.missed ?? []).map((date) => ({
    key: date,
    date,
    outcome: OccurrenceOutcome.MISSED
  }))
  const occurrences = [...missed.reverse(), ...recorded].slice(0, SHOWN).reverse()
  const next = pending?.next ?? task.scheduled
  const done = occurrences.filter(({ outcome }) => outcome === OccurrenceOutcome.DONE).length
  const summary = occurrences.length === 0 ? "Nothing done yet" : `${done} of the last ${occurrences.length} done`
  return (
    <section className={styles.strip} aria-label="History" data-testid={occurrenceStripTestIds.strip}>
      <div className={styles.heading}>
        <h2 className={styles.title}>History</h2>
        <span className={styles.summary}>{next ? `${summary} · next ${formatNearDay(next, today)}` : summary}</span>
      </div>
      <ol className={styles.days}>
        {occurrences.map(({ key, ...day }) => (
          <Day key={key} {...day} today={today} />
        ))}
        {next && <Day date={next} outcome="NEXT" today={today} />}
      </ol>
    </section>
  )
}
