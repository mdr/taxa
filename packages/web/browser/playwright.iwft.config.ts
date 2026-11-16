// The isolated browser tests (*.iwft.ts): the web app from a Vite dev server
// of their own, on a free port, and nothing else. Each test starts the API
// server in its own process (the taxa fixture), and any request a tab makes
// beyond localhost fails the test. `task iwft` runs them.
import { defineConfig } from "@playwright/test"
import { devServer, portsIn, runSettings } from "./playwright-common.ts"

const { WEB_PORT: webPort } = await portsIn("WEB_PORT")

export default defineConfig({
  ...runSettings("iwft", webPort),
  testMatch: /\.iwft\.ts$/,
  webServer: [devServer("web", `http://localhost:${webPort}`, { WEB_PORT: webPort })]
})
