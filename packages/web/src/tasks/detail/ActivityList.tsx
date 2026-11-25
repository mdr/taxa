import { browserTimeZone } from "../../dates/browser-time-zone.ts"
import { activityParts } from "@taxa/shared/activity/activity-text"
import type { Activity } from "@taxa/shared/activity/activity"
import type { Domain } from "@taxa/shared/domains/domain"
import { realClock } from "@taxa/shared/clock"
import type { IsoDate } from "@taxa/shared/dates/plain-date"
import type { Task } from "@taxa/shared/tasks/task"
import { Bot, ChevronDown, ChevronRight } from "lucide-react"
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
import { MarkdownView } from "../../notes/MarkdownView.tsx"
import { TaskChangeType, type TaskChange } from "../changes/task-changes-service.ts"
import { timeline, TimelineEntryType } from "./timeline.ts"

interface RowContext {
  today: IsoDate
  domainName: (id: string) => string | undefined
  /** Puts the notes back as they were before a change. */
  restoreNotes: (notes: string) => void
}

/** The notes as a change found them, to look back at, and to put back. */
const NotesBefore = ({ notes, restore }: { notes: string; restore: (notes: string) => void }) => (
  <details className={styles.notesBefore} data-testid={activityListTestIds.notesBefore}>
    <summary className={styles.notesSummary} data-track="ActivityList.notesBefore">
      Notes before this
    </summary>
    <MarkdownView markdown={notes} className={styles.notesText} testId={activityListTestIds.notesBeforeText} />
    <button
      type="button"
      className={styles.restore}
      onClick={() => restore(notes)}
      data-testid={activityListTestIds.restoreNotes}
      data-track="ActivityList.restoreNotes"
    >
      Restore these notes
    </button>
  </details>
)

const ChangeRow = ({ entry, context }: { entry: Activity; context: RowContext }) => {
  const { actor, action } = activityParts(entry, context)
  const notesBefore = entry.changes["notes"]?.from
  return (
    <li className={styles.entry} data-testid={activityListTestIds.entry}>
      <span className={styles.avatar} aria-hidden>
        {entry.actor.agent ? <Bot size={12} /> : actor.charAt(0)}
      </span>
      <div className={styles.body}>
        <div className={styles.line}>
          <span className={styles.text} data-testid={activityListTestIds.text}>
            <span className={styles.actor}>{actor}</span> {action}
          </span>
          <time className={styles.when} dateTime={entry.at} title={new Date(entry.at).toLocaleString()}>
            {relativeTime(Date.parse(entry.at), realClock.now(), browserTimeZone())}
          </time>
        </div>
        {typeof notesBefore === "string" && notesBefore.trim() !== "" && (
          <NotesBefore notes={notesBefore} restore={context.restoreNotes} />
        )}
      </div>
    </li>
  )
}

/** Changes that go without saying, as one line, opened to show them where they happened. */
const Fold = ({ changes, context }: { changes: Activity[]; context: RowContext }) => {
  const [open, setOpen] = useState(false)
  const count = changes.length === 1 ? "1 other change" : `${changes.length} other changes`
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <>
      <li className={styles.fold}>
        <button
          type="button"
          className={styles.foldButton}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          data-testid={activityListTestIds.fold}
          data-track="ActivityList.fold"
        >
          <Chevron size={14} aria-hidden />
          {open ? `Hide ${changes.length === 1 ? "it" : "them"}` : count}
        </button>
      </li>
      {open && changes.map((change) => <ChangeRow key={change.sequence} entry={change} context={context} />)}
    </>
  )
}

/**
 * The task's timeline, oldest first: what mostly matters (made, started,
 * done, moved) and its comments, with the other changes folded where they
 * happened, and a place to add a comment. Taking a change back is ⌘Z's job,
 * for what you've just done; a notes change can put back the notes it replaced.
 */
export const ActivityList = ({
  task,
  domains,
  change
}: {
  task: Task
  domains: Domain[]
  change: (change: TaskChange) => void
}) => {
  const activity = useActivity(task.id)
  const comments = useComments(task.id)
  const me = useMe()
  const queryClient = useQueryClient()
  const history = useUndo()
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
  const context: RowContext = {
    today: useToday(),
    domainName: (id) => domains.find((domain) => domain.id === id)?.name,
    restoreNotes: (notes) => change({ type: TaskChangeType.UPDATE, request: { set: { notes } } })
  }
  return (
    <CommentsContext.Provider value={commenting}>
      <section className={styles.activity} aria-labelledby="activity-heading">
        <h2 id="activity-heading" className={styles.heading}>
          Timeline
        </h2>
        <ol className={styles.entries}>
          {timeline(activity.data ?? [], comments.data ?? []).map((item) => {
            switch (item.type) {
              case TimelineEntryType.COMMENT:
                return (
                  <CommentCard
                    key={item.comment.id}
                    comment={item.comment}
                    // Yours, or written by one of your agents.
                    mine={item.comment.author.user.id === me.data?.user.id}
                  />
                )
              case TimelineEntryType.CHANGE:
                return <ChangeRow key={item.change.sequence} entry={item.change} context={context} />
              case TimelineEntryType.FOLD:
                return <Fold key={`fold-${item.changes[0]?.sequence}`} changes={item.changes} context={context} />
            }
          })}
        </ol>
        <CommentComposer taskId={task.id} />
      </section>
    </CommentsContext.Provider>
  )
}
