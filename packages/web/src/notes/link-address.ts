const SCHEME = /^[a-z][a-z\d+.-]*:/i
const ALLOWED = new Set(["http:", "https:", "mailto:", "tel:"])
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
