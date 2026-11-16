import { useEffect, useState } from "react"
import { HEALTH_PATH } from "@taxa/shared/api/health"
import { apiBase } from "../api/api-base.ts"
import { ServerStatus, serverStatusOf } from "./server-status.ts"

const checkServer = async (): Promise<ServerStatus> => {
  try {
    const response = await fetch(`${apiBase()}${HEALTH_PATH}`)
    return serverStatusOf(await response.json())
  } catch {
    return ServerStatus.UNREACHABLE
  }
}

/** The server's status, checked once when the page opens. */
export const useServerStatus = (): ServerStatus => {
  const [status, setStatus] = useState(ServerStatus.CHECKING)
  useEffect(() => {
    let current = true
    void checkServer().then((checked) => current && setStatus(checked))
    return () => {
      current = false
    }
  }, [])
  return status
}
