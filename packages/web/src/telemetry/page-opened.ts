import type { LogFields } from "@taxa/shared/telemetry/log"

export enum Page {
  INBOX = "INBOX",
  IN_PROGRESS = "IN_PROGRESS",
  DOMAIN = "DOMAIN",
  TASK = "TASK",
  NOT_FOUND = "NOT_FOUND"
}

/** Which page a location is, with the domain or task it's about, for analytics. */
export const pageOpened = (location: string): LogFields => {
  if (location === "/") return { page: Page.INBOX }
  if (location === "/in-progress") return { page: Page.IN_PROGRESS }
  const [, section, name] = location.split("/")
  if (section === "domains" && name) return { page: Page.DOMAIN, domainPrefix: name.toUpperCase() }
  if (section === "tasks" && name) return { page: Page.TASK, taskRef: name.toUpperCase() }
  return { page: Page.NOT_FOUND }
}
