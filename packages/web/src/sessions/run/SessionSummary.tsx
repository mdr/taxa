import { SessionOutcome, type Session, type SessionItem } from "@taxa/shared/sessions/session"
import { useState } from "react"
import { Link } from "wouter"
import styles from "../Session.module.css"
import { sessionPageTestIds } from "../SessionPageTestIds.ts"
import { useSession, useSessionListener } from "../session-queries.ts"
import { SESSION_PATH } from "../session-paths.ts"
import { durationText, minutesText, timeSpan } from "../session-text.ts"
import { SessionRunService } from "./session-run-service.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { taxaApi } from "../../api/taxa-api.ts"
import { useServiceState } from "../../services/service-hooks.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { TaskStatus } from "@taxa/shared/tasks/task"
import type { Domain } from "@taxa/shared/domains/domain"
import { useDomains } from "../../domains/domain-queries.ts"

/** Whether it's done: ticked off, or, repeating, done this time in the session and come round again. */
const isDone = ({ task, outcome }: SessionItem): boolean =>
  task.status === TaskStatus.DONE || (task.repeat !== undefined && outcome === SessionOutcome.DONE)

/** Where a task stands now, after the session: done, or open and where. */
const nowText = (item: SessionItem, domains: readonly Domain[]): string => {
  const { task } = item
  if (isDone(item)) return "Done"
  const where = task.inbox ? "the Inbox" : (domains.find(({ id }) => id === task.domainId)?.name ?? "its domain")
  return `${task.status === TaskStatus.IN_PROGRESS ? "In progress" : "Open"}, in ${where}`
}

const Summary = ({ session }: { session: Session }) => {
  const listener = useSessionListener()
  const [run] = useState(() => new SessionRunService(taxaApi, appAnalytics, listener))
  const problem = useServiceState(run, (state) => state.problem)
  const [note, setNote] = useState(session.note)
  const domains = useDomains()
  const done = session.items.filter(({ outcome }) => outcome === SessionOutcome.DONE)
  const worked = session.items.filter(({ outcome, spentMs }) => outcome !== SessionOutcome.DONE && spentMs > 0)
  const untouched = session.items.filter(({ outcome, spentMs }) => outcome !== SessionOutcome.DONE && spentMs === 0)
  const spent = session.items.reduce((total, { spentMs }) => total + spentMs, 0)
  const stats: [number | string, string][] = [
    [done.length, "finished"],
    [worked.length, "worked on, not finished"],
    [untouched.length, "didn't get to"],
    [durationText(spent), "spent on tasks"]
  ]
  return (
    <section
      className={`${styles.page} ${styles.narrow}`}
      style={{ maxWidth: "52rem" }}
      data-testid={sessionPageTestIds.page}
    >
      <div className={styles.headingGroup}>
        <h1 className={styles.heading} data-testid={sessionPageTestIds.heading}>
          Session done
        </h1>
        <p className={styles.subtle}>
          {timeSpan(Date.parse(session.startedAt), Date.parse(session.endedAt ?? session.endsAt))}
        </p>
      </div>
      <div className={styles.stats}>
        {stats.map(([number, label]) => (
          <div key={label} className={styles.stat} data-testid={sessionPageTestIds.summaryCount}>
            <span className={styles.statNumber}>{number}</span>
            <span className={styles.subtle}>{label}</span>
          </div>
        ))}
      </div>
      {session.items.length > 0 && (
        <div className={styles.tableBox}>
          <table className={styles.table}>
            <caption className={styles.subtle} style={{ position: "absolute", left: "-9999px" }}>
              Each task's planned and spent time, and where it stands now
            </caption>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Planned</th>
                <th scope="col">Spent</th>
                <th scope="col">Now</th>
              </tr>
            </thead>
            <tbody>
              {session.items.map((item) => (
                <tr key={item.task.id} data-testid={sessionPageTestIds.summaryRow}>
                  <td data-testid={sessionPageTestIds.summaryTask}>
                    <Link href={`/tasks/${item.task.ref}`}>{item.task.title}</Link>
                  </td>
                  <td data-testid={sessionPageTestIds.summaryPlanned}>{minutesText(item.minutes)}</td>
                  <td
                    className={item.spentMs > item.minutes * 60_000 ? styles.over : undefined}
                    data-testid={sessionPageTestIds.summarySpent}
                  >
                    {item.spentMs > 0 ? durationText(item.spentMs) : "–"}
                  </td>
                  <td data-testid={sessionPageTestIds.summaryNow}>
                    <span className={`${styles.tag} ${isDone(item) ? styles.tagDone : ""}`}>
                      {nowText(item, domains.data ?? [])}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.noteField}>
        <label className={styles.label} htmlFor="session-note">
          Anything to remember? <span style={{ fontWeight: 400 }}>Optional</span>
        </label>
        <textarea
          id="session-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => void run.saveNote(session, note)}
          data-testid={sessionPageTestIds.note}
          data-track="SessionPage.note"
        />
      </div>
      {problem && (
        <p className={styles.problem} role="alert" data-testid={sessionPageTestIds.problem}>
          {problem}
        </p>
      )}
      <div className={`${styles.actions} ${styles.end}`}>
        <Link
          href={SESSION_PATH}
          className={`${styles.secondary} ${styles.linkButton}`}
          data-testid={sessionPageTestIds.planAnother}
        >
          Plan another session
        </Link>
        <Link href="/" className={`${styles.primary} ${styles.linkButton}`} data-testid={sessionPageTestIds.finish}>
          Finish
        </Link>
      </div>
    </section>
  )
}

/** How a session went, once it's over. */
export const SessionSummary = ({ id }: { id: string }) => {
  const session = useSession(id)
  if (session.isError) return <p role="alert">{problemMessage(session.error)}</p>
  return session.data ? <Summary key={session.data.id} session={session.data} /> : undefined
}
