import { problemMessage } from "../api/problem-message.ts"
import { SessionPlanner } from "./plan/SessionPlanner.tsx"
import { SessionNow } from "./run/SessionNow.tsx"
import { useCurrentSession } from "./session-queries.ts"

/** Your session under way, or planning one. */
export const SessionPage = () => {
  const current = useCurrentSession()
  if (current.isError) return <p role="alert">{problemMessage(current.error)}</p>
  if (!current.data) return undefined
  return current.data.session ? (
    <SessionNow key={current.data.session.id} session={current.data.session} />
  ) : (
    <SessionPlanner />
  )
}
