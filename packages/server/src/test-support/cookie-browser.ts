/**
 * Just enough of a browser for signing in: it keeps cookies, follows
 * redirects one at a time, and says it's on Taxa's own pages when it sends
 * changes from them, as a real one sends Origin.
 */
export class CookieBrowser {
  readonly #cookies = new Map<string, string>()
  /** Where it was sent, in order, as it followed each redirect. */
  readonly visited: URL[] = []

  /** The cookies it holds, by name. */
  get cookies(): ReadonlyMap<string, string> {
    return this.#cookies
  }

  /** Goes to a URL and follows its redirects, to the page it ends on. */
  async open(url: string | URL): Promise<{ url: URL; response: Response }> {
    let at = new URL(url)
    for (let hops = 0; hops < 10; hops++) {
      this.visited.push(at)
      const response = await this.request(at)
      const location = response.headers.get("location") ?? undefined
      if (response.status < 300 || response.status >= 400 || location === undefined) return { url: at, response }
      at = new URL(location, at)
    }
    throw new Error(`too many redirects, last to ${at.href}`)
  }

  /** One request, with its cookies, keeping what it sets; with `from`, as if sent from that origin's pages. */
  async request(url: string | URL, init: RequestInit & { from?: string } = {}): Promise<Response> {
    const { from, ...rest } = init
    const headers = new Headers(rest.headers)
    const cookie = [...this.#cookies].map(([name, value]) => `${name}=${value}`).join("; ")
    if (cookie) headers.set("cookie", cookie)
    if (from !== undefined) headers.set("origin", from)
    const response = await fetch(url, { ...rest, headers, redirect: "manual" })
    for (const set of response.headers.getSetCookie()) this.#keep(set)
    return response
  }

  /** Forgets a cookie, or sets it to something else, as someone tampering might. */
  setCookie(name: string, value: string | undefined): void {
    if (value === undefined) this.#cookies.delete(name)
    else this.#cookies.set(name, value)
  }

  #keep(set: string): void {
    const [pair = "", ...attributes] = set.split(";").map((part) => part.trim())
    const at = pair.indexOf("=")
    const name = pair.slice(0, at)
    const value = pair.slice(at + 1)
    const expired = attributes.some((attribute) => /^max-age=0$/i.test(attribute)) || value === ""
    if (expired) this.#cookies.delete(name)
    else this.#cookies.set(name, value)
  }
}
