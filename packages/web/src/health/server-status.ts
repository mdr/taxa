import { HealthSchema, HealthStatus } from "@taxa/shared/api/health"

export enum ServerStatus {
  CHECKING = "CHECKING",
  OK = "OK",
  DATABASE_DOWN = "DATABASE_DOWN",
  UNREACHABLE = "UNREACHABLE"
}

export const SERVER_STATUS_TEXT: Record<ServerStatus, string> = {
  [ServerStatus.CHECKING]: "Checking the server…",
  [ServerStatus.OK]: "Server OK",
  [ServerStatus.DATABASE_DOWN]: "The server's database is down",
  [ServerStatus.UNREACHABLE]: "Can't reach the server"
}

/** What a health check's answer says about the server: unreachable if it isn't a health answer. */
export const serverStatusOf = (body: unknown): ServerStatus => {
  const health = HealthSchema.safeParse(body)
  if (!health.success) return ServerStatus.UNREACHABLE
  return health.data.status === HealthStatus.OK ? ServerStatus.OK : ServerStatus.DATABASE_DOWN
}
