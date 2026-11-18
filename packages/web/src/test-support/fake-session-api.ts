import type { SessionId } from "@taxa/shared/ids"
import type { CreateSessionRequest, Session, UpdateSessionRequest } from "@taxa/shared/sessions/session"
import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import { ProblemType } from "@taxa/shared/api/problem"
import type { Version } from "@taxa/shared/units"
import { makeSession } from "@taxa/shared/test-support/make-session"
import type { SessionApi } from "../sessions/session-api.ts"

/** Records what's asked, and answers with the session as it was, a version on; or refuses, if told to. */
export class FakeSessionApi implements SessionApi {
  readonly created: CreateSessionRequest[] = []
  readonly updated: { id: SessionId; request: UpdateSessionRequest; ifMatch: Version | undefined }[] = []
  refuse = false

  readonly createSession = async (request: CreateSessionRequest): Promise<Session> => {
    this.created.push(request)
    if (this.refuse)
      throw new TaxaApiError(409, { type: ProblemType.SESSION_OPEN, message: "You're already in a session." })
    return makeSession({ endsAt: request.endsAt })
  }

  readonly updateSession = async (
    id: SessionId,
    request: UpdateSessionRequest,
    ifMatch?: Version
  ): Promise<Session> => {
    this.updated.push({ id, request, ifMatch })
    if (this.refuse) throw new TaxaApiError(409, { type: ProblemType.VERSION_CONFLICT, message: "It changed." })
    return makeSession({ id, version: (ifMatch ?? 1) + 1 })
  }
}
