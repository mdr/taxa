import type { Task } from "@taxa/shared/tasks/task"
import { problemMessage } from "../../api/problem-message.ts"
import { AbstractService } from "../../services/abstract-service.ts"
import type { Analytics } from "../../telemetry/analytics.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"

export enum BinQuestionType {
  ONE = "ONE",
  ALL = "ALL"
}

/** Deleting one task for good. */
interface PurgeOne {
  type: BinQuestionType.ONE
  task: Task
}

/** Emptying the bin of all it holds. */
interface PurgeAll {
  type: BinQuestionType.ALL
  count: number
}

export type BinQuestion = PurgeOne | PurgeAll

export interface BinApi {
  purgeTask: (ref: string) => Promise<void>
  emptyBin: () => Promise<number>
}

export interface BinState {
  /** What's being asked about, while the dialog is open. */
  asking: BinQuestion | undefined
  /** Waiting for the server to do it. */
  purging: boolean
  /** Why it couldn't be done. */
  problem: string | undefined
}

/** Deleting tasks in the bin for good, once asked whether to. */
export class BinService extends AbstractService<BinState> {
  readonly #api: BinApi
  readonly #refresh: () => Promise<void>
  readonly #analytics: Analytics

  /** `refresh` reloads the tasks shown, once some are gone. */
  constructor(api: BinApi, refresh: () => Promise<void>, analytics: Analytics) {
    super({ asking: undefined, purging: false, problem: undefined })
    this.#api = api
    this.#refresh = refresh
    this.#analytics = analytics
  }

  readonly ask = (question: BinQuestion): void => this.setState({ asking: question, problem: undefined })

  readonly cancel = (): void => {
    if (!this.state.purging) this.setState({ asking: undefined, problem: undefined })
  }

  readonly confirm = async (): Promise<void> => {
    const { asking, purging } = this.state
    if (!asking || purging) return
    this.setState({ purging: true, problem: undefined })
    try {
      if (asking.type === BinQuestionType.ONE) {
        await this.#api.purgeTask(asking.task.id)
        this.#analytics.track(ANALYTICS_CODES.task.purged, `deleted ${asking.task.ref} for good`, {
          taskId: asking.task.id,
          taskRef: asking.task.ref
        })
      } else {
        const count = await this.#api.emptyBin()
        this.#analytics.track(ANALYTICS_CODES.bin.emptied, "emptied the bin", { count })
      }
      this.setState({ asking: undefined, purging: false })
    } catch (error) {
      this.setState({ purging: false, problem: problemMessage(error) })
    }
    await this.#refresh()
  }
}
