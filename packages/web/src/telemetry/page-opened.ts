import type { LogFields } from "@taxa/shared/telemetry/log"

export enum Page {
  INBOX = "INBOX",
  IN_PROGRESS = "IN_PROGRESS",
  TODAY = "TODAY",
  PLAN_TODAY = "PLAN_TODAY",
  SOON = "SOON",
  SOMEDAY = "SOMEDAY",
  SESSION = "SESSION",
  SESSION_SUMMARY = "SESSION_SUMMARY",
  BIN = "BIN",
  DOMAIN = "DOMAIN",
  TASK = "TASK",
  NOT_FOUND = "NOT_FOUND"
}

/** Which page a location is, with the domain or task it's about, for analytics. */
export const pageOpened = (location: string): LogFields => {
  if (location === "/") return { page: Page.INBOX }
  if (location === "/in-progress") return { page: Page.IN_PROGRESS }
  if (location === "/today") return { page: Page.TODAY }
  if (location === "/today/plan") return { page: Page.PLAN_TODAY }
  if (location === "/soon") return { page: Page.SOON }
  if (location === "/someday") return { page: Page.SOMEDAY }
  if (location === "/session") return { page: Page.SESSION }
  if (location === "/bin") return { page: Page.BIN }
  const [, section, name] = location.split("/")
  if (section === "domains" && name) return { page: Page.DOMAIN, domainPrefix: name.toUpperCase() }
  if (section === "tasks" && name) return { page: Page.TASK, taskRef: name.toUpperCase() }
  if (section === "sessions" && name) return { page: Page.SESSION_SUMMARY, sessionId: name }
  return { page: Page.NOT_FOUND }
}
