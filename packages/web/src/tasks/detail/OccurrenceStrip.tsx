import { formatDay, formatNearDay } from "@taxa/shared/dates/date-format"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import { OccurrenceOutcome } from "@taxa/shared/tasks/repeat"
import type { Task } from "@taxa/shared/tasks/task"
import { useToday } from "../../dates/use-today.ts"
import { useOccurrences } from "../task-queries.ts"
import styles from "./OccurrenceStrip.module.css"
import { occurrenceStripTestIds } from "./OccurrenceStripTestIds.ts"

/** How many of the latest occurrences it shows. */
const SHOWN = 14

const OUTCOME_TEXT: Record<OccurrenceOutcome, string> = {
  [OccurrenceOutcome.DONE]: "done",
  [OccurrenceOutcome.SKIPPED]: "skipped",
  [OccurrenceOutcome.MISSED]: "missed"
}

const dayOfMonth = (date: IsoDate): string => String(Number(date.slice(8)))

/** A repeating task's latest occurrences, oldest first, each done, skipped or missed, then the one it's next for. */
export const OccurrenceStrip = ({ task, next }: { task: Pick<Task, "id" | "version">; next: IsoDate }) => {
  const today = useToday()
  const occurrences = (useOccurrences(task).data ?? []).slice(0, SHOWN).reverse()
  const done = occurrences.filter(({ outcome }) => outcome === OccurrenceOutcome.DONE).length
  return (
    <section className={styles.strip} aria-label="History" data-testid={occurrenceStripTestIds.strip}>
      <div className={styles.heading}>
        <h2 className={styles.title}>History</h2>
        <span className={styles.summary}>
          {occurrences.length === 0 ? "Nothing done yet" : `${done} of the last ${occurrences.length} done`} · next{" "}
          {formatNearDay(next, today)}
        </span>
      </div>
      <ol className={styles.days}>
        {occurrences.map(({ id, date, outcome }) => (
          <li key={id} className={styles.day} data-testid={occurrenceStripTestIds.day}>
            <span
              className={styles.mark}
              data-outcome={outcome}
              role="img"
              aria-label={`${formatDay(date, today)}: ${OUTCOME_TEXT[outcome]}`}
              title={`${formatDay(date, today)}: ${OUTCOME_TEXT[outcome]}`}
            />
            <span className={styles.date}>{dayOfMonth(date)}</span>
          </li>
        ))}
        <li className={styles.day}>
          <span
            className={styles.mark}
            data-outcome="NEXT"
            role="img"
            aria-label={`${formatDay(next, today)}: next`}
            title={`${formatDay(next, today)}: next`}
          />
          <span className={styles.date}>{dayOfMonth(next)}</span>
        </li>
      </ol>
    </section>
  )
}
