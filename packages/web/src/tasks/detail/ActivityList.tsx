import { activityText } from "@taxa/shared/activity/activity-text"
import styles from "./ActivityList.module.css"
import { activityListTestIds } from "./ActivityListTestIds.ts"
import { useActivity } from "../task-queries.ts"

const when = (at: string): string => new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

export const ActivityList = ({ taskId }: { taskId: string }) => {
  const activity = useActivity(taskId)
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className={styles.heading}>
        Activity
      </h2>
      <ol className={styles.entries}>
        {activity.data?.map((entry) => (
          <li key={entry.sequence} data-testid={activityListTestIds.entry}>
            <time className={styles.when} dateTime={entry.at}>
              {when(entry.at)}
            </time>{" "}
            <span data-testid={activityListTestIds.text}>{activityText(entry)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
