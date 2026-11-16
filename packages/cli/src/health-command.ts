import { HEALTH_PATH, HealthSchema, HealthStatus, type Health } from "@taxa/shared/api/health"
import { ExitCode, type CliIo } from "./cli-io.ts"

const STATUS_TEXT: Record<HealthStatus, string> = {
  [HealthStatus.OK]: "OK",
  [HealthStatus.DATABASE_DOWN]: "the server is up, but its database is down"
}

const fetchHealth = async (server: string): Promise<Health | undefined> => {
  try {
    const response = await fetch(`${server}${HEALTH_PATH}`)
    return HealthSchema.parse(await response.json())
  } catch {
    return undefined
  }
}

/** `taxa health`: whether the server and its database are up. */
export const healthCommand = async (server: string, json: boolean, io: CliIo): Promise<ExitCode> => {
  const health = await fetchHealth(server)
  if (!health) {
    io.stderr(`Can't reach the Taxa server at ${server}.\n`)
    return ExitCode.FAILED
  }
  io.stdout(json ? `${JSON.stringify(health)}\n` : `${STATUS_TEXT[health.status]} (build ${health.build})\n`)
  return health.status === HealthStatus.OK ? ExitCode.OK : ExitCode.FAILED
}
