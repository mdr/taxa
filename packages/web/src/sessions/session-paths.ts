import type { SessionId } from "@taxa/shared/ids"

export const SESSION_PATH = "/session"

export const summaryPath = (id: SessionId): string => `/sessions/${id}`
