import { browserTimeZone } from "../../dates/browser-time-zone.ts"
import { activityParts } from "@taxa/shared/activity/activity-text"
import type { Domain } from "@taxa/shared/domains/domain"
import { realClock } from "@taxa/shared/clock"
import { ActivityType } from "@taxa/shared/activity/activity"
import type { Task } from "@taxa/shared/tasks/task"
import { Bot, Undo2 } from "lucide-react"
import styles from "./ActivityList.module.css"
import { activityListTestIds } from "./ActivityListTestIds.ts"
import { relativeTime } from "../../dates/relative-time.ts"
import { useToday } from "../../dates/use-today.ts"
import { useActivity } from "../task-queries.ts"
import { useUndo } from "../../undo/undo-service.ts"

/** Every change to the task, oldest first, as a quiet timeline, each with a way to undo it. */
export const ActivityList = ({ task, domains }: { task: Task; domains: Domain[] }) => {
  const activity = useActivity(task.id)
  const { undoChange } = useUndo()
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
              {entry.type !== ActivityType.DOMAIN_CREATED && (
                <button
                  type="button"
                  className={styles.undo}
                  onClick={() => void undoChange(task, entry.version)}
                  aria-label={`Undo: ${actor} ${action}`}
                  title="Undo this change"
                  data-testid={activityListTestIds.undo}
                  data-track="ActivityList.undo"
                >
                  <Undo2 size={14} aria-hidden />
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
