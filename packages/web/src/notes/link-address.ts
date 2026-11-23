const SCHEME = /^[a-z][a-z\d+.-]*:/i

/** Apps a note can link into: `vscode://file/…` opens a file in VS Code, as agents write them. */
export const APP_SCHEMES = ["vscode"]

const WEB = new Set(["http:", "https:"])
const ALLOWED = new Set([...WEB, "mailto:", "tel:", ...APP_SCHEMES.map((scheme) => `${scheme}:`)])
const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/

/**
 * The address a link goes to, from what someone typed: `example.com` becomes
 * `https://example.com` and `jo@example.com` a mailto link. Undefined for
 * nothing, or for a kind of address a note shouldn't link to (`javascript:`).
 */
export const linkAddress = (typed: string): string | undefined => {
  const text = typed.trim()
  if (text === "" || /\s/.test(text)) return undefined
  const full = SCHEME.test(text) ? text : EMAIL.test(text) ? `mailto:${text}` : `https://${text}`
  try {
    const url = new URL(full)
    return ALLOWED.has(url.protocol) ? full : undefined
  } catch {
    return undefined
  }
}

/** Whether a link goes to a web page, for a new tab, rather than to an app, which opens without one. */
export const isWebAddress = (href: string): boolean => WEB.has(SCHEME.exec(href)?.[0].toLowerCase() ?? "")
