const KEY = "taxa.captureFiling"

/** The domain quick capture last sent a task to, in this browser, by prefix, if one was chosen. */
export const loadCaptureFiling = (): string | undefined => {
  try {
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** Remembers which domain quick capture should send tasks to next time. */
export const saveCaptureFiling = (choice: string): void => {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Not remembered, then; it still applies until the page is left.
  }
}

/** The domain a capture goes in: the one last chosen, while it's still one, else the first. */
export const captureDomain = <D extends { prefix: string }>(
  domains: readonly D[],
  chosen = loadCaptureFiling()
): D | undefined => domains.find(({ prefix }) => prefix === chosen) ?? domains[0]
