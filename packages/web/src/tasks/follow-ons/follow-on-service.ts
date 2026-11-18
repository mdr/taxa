import type { Task } from "@taxa/shared/tasks/task"
import { AbstractService } from "../../services/abstract-service.ts"
import { createServiceContext, useService, useServiceState } from "../../services/service-hooks.ts"

export interface FollowOnState {
  /** The task a follow-on is being added to, while the dialog for it is open. */
  from: Task | undefined
}

/** Adding a follow-on task: which task it follows on from, while it's being written. */
export class FollowOnService extends AbstractService<FollowOnState> {
  constructor() {
    super({ from: undefined })
  }

  readonly start = (from: Task): void => this.setState({ from })

  readonly end = (): void => this.setState({ from: undefined })
}

export const FollowOnContext = createServiceContext<FollowOnService>()

export const useFollowOn = (): FollowOnService => useService(FollowOnContext)

export const useFollowingOn = (): Task | undefined => useServiceState(useFollowOn(), ({ from }) => from)
