import type { TimeZone } from "@taxa/shared/dates/plain-date"
import { test, type Browser } from "@playwright/test"
import type { Instant } from "@taxa/shared/units"
import { Tab } from "../pages/Tab.ts"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"])

export interface TabSetting {
  timeZone: TimeZone
  /** The page's clock stands here, as the server's does. */
  now: Instant
}

/**
 * A tab whose app calls the API at `apiUrl` (the test's in-process server)
 * and is refused anything beyond localhost.
 */
export const newTab = async (
  browser: Browser,
  label: string,
  apiUrl: string,
  { timeZone, now }: TabSetting
): Promise<Tab> => {
  const baseUrl = test.info().project.use.baseURL
  if (!baseUrl) throw new Error("no baseURL: set one in the Playwright config")
  // Reduced motion, as the app honours it: nothing is caught half-faded-in.
  const context = await browser.newContext({
    timezoneId: timeZone,
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"]
  })
  await context.clock.setFixedTime(now)
  await context.addInitScript((url) => {
    ;(globalThis as { TAXA_API_BASE?: string }).TAXA_API_BASE = url
  }, apiUrl)
  const refused: string[] = []
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (LOCAL_HOSTS.has(url.hostname)) return route.fallback()
    refused.push(url.href)
    return route.abort("blockedbyclient")
  })
  const page = await context.newPage()
  page.on("pageerror", (error) => console.log(`[${label} pageerror]`, error.message))
  const logged: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`[${label} console.error]`, message.text().slice(0, 200))
    // The app's log lines start with their code; a control's, `ui.opened`, then name the control: `ui.opened TaskRow.menu`.
    const [, code, control] =
      /^([a-z][A-Za-z]*\.[a-z][A-Za-z]*): (?:.*? ([A-Z][A-Za-z]*\.\S+))?/.exec(message.text()) ?? []
    if (code) logged.push(code.startsWith("ui.") && control ? `${code} ${control}` : code)
  })
  return new Tab(page, baseUrl, refused, logged)
}
