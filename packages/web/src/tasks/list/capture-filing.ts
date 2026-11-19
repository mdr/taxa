import { INBOX_CHOICE } from "../filing/filing.ts"

const KEY = "taxa.captureFiling"

/** Where the Inbox's quick capture last sent a task, in this browser: the Inbox, or a domain's prefix. */
export const loadCaptureFiling = (): string => {
  try {
    return localStorage.getItem(KEY) ?? INBOX_CHOICE
  } catch {
    return INBOX_CHOICE
  }
}

/** Remembers where quick capture should send tasks next time. */
export const saveCaptureFiling = (choice: string): void => {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Not remembered, then; it still applies until the page is left.
  }
}
