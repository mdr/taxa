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
import { useActivity, useComments, useMe } from "../task-queries.ts"
import { useUndo } from "../../undo/undo-service.ts"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { queryKeys } from "../../api/query-keys.ts"
import { taxaApi } from "../../api/taxa-api.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { CommentCard } from "../comments/CommentCard.tsx"
import { CommentComposer } from "../comments/CommentComposer.tsx"
import { CommentsContext, CommentsService } from "../comments/comments-service.ts"
import { timeline, TimelineEntryType } from "./timeline.ts"

/**
 * The task's timeline: every change to it, each with a way to undo it, and
 * its comments, oldest first, with a place to add one.
 */
export const ActivityList = ({ task, domains }: { task: Task; domains: Domain[] }) => {
  const activity = useActivity(task.id)
  const comments = useComments(task.id)
  const me = useMe()
  const queryClient = useQueryClient()
  const history = useUndo()
  const { undoChange } = history
  const [commenting] = useState(
    () =>
      new CommentsService(
        taxaApi,
        history,
        task,
        () => queryClient.invalidateQueries({ queryKey: queryKeys.comments(task.id) }),
        appAnalytics
      )
  )
  const today = useToday()
  const now = realClock.now()
  const timeZone = browserTimeZone()
  const domainName = (id: string) => domains.find((domain) => domain.id === id)?.name
  return (
    <CommentsContext.Provider value={commenting}>
      <section className={styles.activity} aria-labelledby="activity-heading">
        <h2 id="activity-heading" className={styles.heading}>
          Timeline
        </h2>
        <ol className={styles.entries}>
          {timeline(activity.data ?? [], comments.data ?? []).map((item) => {
            if (item.type === TimelineEntryType.COMMENT) {
              const { comment } = item
              const mine = !comment.author.agent && comment.author.user.id === me.data?.user.id
              return <CommentCard key={comment.id} comment={comment} mine={mine} />
            }
            const entry = item.change
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
        <CommentComposer taskId={task.id} />
      </section>
    </CommentsContext.Provider>
  )
}
