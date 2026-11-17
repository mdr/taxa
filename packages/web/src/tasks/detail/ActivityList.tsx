import { browserTimeZone } from "../../dates/browser-time-zone.ts"
import { activityParts } from "@taxa/shared/activity/activity-text"
import type { Domain } from "@taxa/shared/domains/domain"
import { realClock } from "@taxa/shared/clock"
import { Bot } from "lucide-react"
import styles from "./ActivityList.module.css"
import { activityListTestIds } from "./ActivityListTestIds.ts"
import { relativeTime } from "../../dates/relative-time.ts"
import { useToday } from "../../dates/use-today.ts"
import { useActivity } from "../task-queries.ts"

/** Every change to the task, oldest first, as a quiet timeline. */
export const ActivityList = ({ taskId, domains }: { taskId: string; domains: Domain[] }) => {
  const activity = useActivity(taskId)
  const today = useToday()
  const now = realClock.now()
  const timeZone = browserTimeZone()
  const domainName = (id: string) => domains.find((domain) => domain.id === id)?.name
  return (
    <section className={styles.activity} aria-labelledby="activity-heading">
      <h2 id="activity-heading" className={styles.heading}>
        Activity
      </h2>
      <ol className={styles.entries}>
        {activity.data?.map((entry) => {
          const { actor, action } = activityParts(entry, { today, domainName })
          return (
            <li key={entry.sequence} className={styles.entry} data-testid={activityListTestIds.entry}>
              <span className={styles.avatar} aria-hidden>
                {entry.actor.agent ? <Bot size={12} /> : actor.charAt(0)}
              </span>
              <span className={styles.text} data-testid={activityListTestIds.text}>
                <span className={styles.actor}>{actor}</span> {action}
              </span>
              <time className={styles.when} dateTime={entry.at} title={new Date(entry.at).toLocaleString()}>
                {relativeTime(Date.parse(entry.at), now, timeZone)}
              </time>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
