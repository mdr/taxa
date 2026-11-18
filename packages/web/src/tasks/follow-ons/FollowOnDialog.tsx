import { When, whenRequest } from "@taxa/shared/tasks/when"
import type { Task } from "@taxa/shared/tasks/task"
import { CornerDownRight, X } from "lucide-react"
import { useEffect, useRef, useState, type SubmitEvent } from "react"
import styles from "./FollowOn.module.css"
import { followOnDialogTestIds } from "./FollowOnDialogTestIds.ts"
import { useFollowOn } from "./follow-on-service.ts"
import { problemMessage } from "../../api/problem-message.ts"
import { useToday } from "../../dates/use-today.ts"
import { appAnalytics } from "../../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { useCreateTask } from "../task-queries.ts"
import { WHEN_ICONS } from "../when/when-choices.tsx"

/** The Whens a follow-on can start with: any but a particular day, which its page can set. */
const WHENS = [When.ANY_TIME, When.TODAY, When.SOON, When.SOMEDAY] as const

const WHEN_TEXT: Record<(typeof WHENS)[number], string> = {
  [When.ANY_TIME]: "Any time",
  [When.TODAY]: "Today",
  [When.SOON]: "Soon",
  [When.SOMEDAY]: "Someday"
}

/** Writes a task that follows on from another: in the same domain, linked to it, for when you choose. */
export const FollowOnDialog = ({ from }: { from: Task }) => {
  const { end } = useFollowOn()
  const today = useToday()
  const [title, setTitle] = useState("")
  const [when, setWhen] = useState<(typeof WHENS)[number]>(When.ANY_TIME)
  const create = useCreateTask()
  const dialog = useRef<HTMLDialogElement>(null)
  // Not closed on unmount: closing fires onClose, which in development's double effects shuts it at once.
  useEffect(() => dialog.current?.showModal(), [])
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (title.trim() === "") return
    create.mutate(
      { title: title.trim(), domain: from.domainId, followsOn: from.id, ...whenRequest(when, today).set },
      {
        onSuccess: (task) => {
          appAnalytics.track(ANALYTICS_CODES.task.followOnAdded, `added ${task.ref} following on from ${from.ref}`, {
            taskId: task.id,
            taskRef: task.ref,
            domainId: task.domainId
          })
          dialog.current?.close()
        }
      }
    )
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      onClose={end}
      aria-labelledby="follow-on-heading"
      data-testid={followOnDialogTestIds.dialog}
    >
      <div className={styles.header}>
        <h2 id="follow-on-heading" className={styles.heading}>
          Follow-on task
        </h2>
        <button type="button" className={styles.close} onClick={() => dialog.current?.close()} aria-label="Close">
          <X size={16} aria-hidden />
        </button>
      </div>
      <p className={styles.from} data-testid={followOnDialogTestIds.from}>
        <CornerDownRight size={14} aria-hidden />
        Follows on from <span className={styles.ref}>{from.ref}</span>{" "}
        <span className={styles.fromTitle}>{from.title}</span>
      </p>
      <form className={styles.form} onSubmit={submit}>
        <input
          className={styles.titleField}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="What's next"
          placeholder="What's next?"
          autoFocus
          data-testid={followOnDialogTestIds.title}
        />
        <div className={styles.whens} role="radiogroup" aria-label="When">
          {WHENS.map((choice) => {
            const Icon = WHEN_ICONS[choice]
            return (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={when === choice}
                className={styles.when}
                onClick={() => setWhen(choice)}
                data-testid={followOnDialogTestIds.when}
              >
                <Icon size={13} aria-hidden />
                {WHEN_TEXT[choice]}
              </button>
            )
          })}
        </div>
        {create.isError && (
          <p className={styles.error} role="alert" data-testid={followOnDialogTestIds.error}>
            {problemMessage(create.error)}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.add}
            disabled={create.isPending || title.trim() === ""}
            data-testid={followOnDialogTestIds.add}
          >
            Add follow-on
          </button>
        </div>
      </form>
    </dialog>
  )
}
