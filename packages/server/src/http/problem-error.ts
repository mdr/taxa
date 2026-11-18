import { ProblemType, type Problem } from "@taxa/shared/api/problem"

const STATUS: Record<ProblemType, 400 | 401 | 403 | 404 | 409> = {
  [ProblemType.INVALID_REQUEST]: 400,
  [ProblemType.UNAUTHENTICATED]: 401,
  [ProblemType.FORBIDDEN]: 403,
  [ProblemType.NOT_FOUND]: 404,
  [ProblemType.VERSION_CONFLICT]: 409,
  [ProblemType.PREFIX_TAKEN]: 409,
  [ProblemType.SESSION_OPEN]: 409
}

/** Thrown by handlers; the app answers with it as a problem. */
export class ProblemError extends Error {
  readonly problem: Problem

  constructor(type: ProblemType, message: string, current?: unknown) {
    super(message)
    this.problem = { type, message, current }
  }

  get status(): 400 | 401 | 403 | 404 | 409 {
    return STATUS[this.problem.type]
  }
}
