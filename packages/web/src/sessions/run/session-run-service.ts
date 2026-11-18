import type { TaskId } from "@taxa/shared/ids"
import { SessionOutcome, type Session, type UpdateSessionRequest } from "@taxa/shared/sessions/session"
import { nextAfter } from "@taxa/shared/sessions/session-timeline"
import type { Minutes } from "@taxa/shared/units"
import { problemMessage } from "../../api/problem-message.ts"
import { AbstractService } from "../../services/abstract-service.ts"
import type { Analytics } from "../../telemetry/analytics.ts"
import { ANALYTICS_CODES, type AnalyticsCode } from "../../telemetry/codes.ts"
import type { PlanEntry } from "../plan/plan-edits.ts"
import type { SessionApi } from "../session-api.ts"

/** The time +15 min adds. */
export const MORE_MINUTES: Minutes = 15

export interface SessionRunState {
  busy: boolean
  problem: string | undefined
}

export interface SessionRunListener {
  /** The session as the server has it now. */
  changed: (session: Session) => void
  /** It changed elsewhere meanwhile: fetch it afresh. */
  stale: () => void
}

/** What you do to a session under way: each sent to the server as one change, against the version shown. */
export class SessionRunService extends AbstractService<SessionRunState> {
  readonly #api: SessionApi
  readonly #analytics: Analytics
  readonly #listener: SessionRunListener

  constructor(api: SessionApi, analytics: Analytics, listener: SessionRunListener) {
    super({ busy: false, problem: undefined })
    this.#api = api
    this.#analytics = analytics
    this.#listener = listener
  }

  async #send(
    session: Session,
    request: UpdateSessionRequest,
    code: AnalyticsCode,
    msg: string,
    fields: Record<string, string | number> = {}
  ): Promise<void> {
    if (this.state.busy) return
    this.setState({ busy: true, problem: undefined })
    try {
      const changed = await this.#api.updateSession(session.id, request, session.version)
      this.#analytics.track(code, msg, { sessionId: session.id, ...fields })
      this.setState({ busy: false })
      this.#listener.changed(changed)
    } catch (error) {
      this.setState({ busy: false, problem: problemMessage(error) })
      this.#listener.stale()
    }
  }

  /** Moves on from the task under way, done or not, to the next one still to do. */
  readonly finish = (session: Session, outcome: SessionOutcome): Promise<void> =>
    this.#send(
      session,
      { finish: outcome, start: nextAfter(session, session.current?.taskId) },
      ANALYTICS_CODES.session.taskFinished,
      outcome === SessionOutcome.DONE ? "finished a session's task" : "stopped a session's task",
      { outcome }
    )

  readonly startTask = (session: Session, taskId: TaskId): Promise<void> =>
    this.#send(session, { start: taskId }, ANALYTICS_CODES.session.taskStarted, "started a session's task")

  /** More time for the task under way, moving the rest later. */
  readonly addTime = (session: Session): Promise<void> =>
    this.#send(
      session,
      {
        set: {
          items: session.items.map(({ task, minutes }) => ({
            taskId: task.id,
            minutes: task.id === session.current?.taskId ? minutes + MORE_MINUTES : minutes
          }))
        }
      },
      ANALYTICS_CODES.session.timeAdded,
      "gave a session's task more time",
      { minutes: MORE_MINUTES }
    )

  readonly replan = (session: Session, plan: readonly PlanEntry[]): Promise<void> =>
    this.#send(
      session,
      { set: { items: plan.map(({ taskId, minutes }) => ({ taskId, minutes })) } },
      ANALYTICS_CODES.session.replanned,
      "replanned a session",
      { tasks: plan.length }
    )

  readonly end = (session: Session): Promise<void> =>
    this.#send(session, { end: true }, ANALYTICS_CODES.session.ended, "ended a session", {
      done: session.items.filter(({ outcome }) => outcome === SessionOutcome.DONE).length,
      tasks: session.items.length
    })

  /** Keeps the note written after a session, if it's changed. */
  readonly saveNote = async (session: Session, note: string): Promise<void> => {
    if (note === session.note) return
    await this.#send(session, { set: { note } }, ANALYTICS_CODES.session.noteSaved, "noted a session")
  }
}
