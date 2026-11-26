import { defineConfig, lazyPlugins } from "vite-plus"
import type { Plugin } from "vite-plus"
import react from "@vitejs/plugin-react"
import { generateAll, writeDeclaration } from "./scripts/css-module-types.ts"

// Overridable so a second pair of dev servers can run beside the first.
const webPort = Number(process.env["WEB_PORT"] ?? 5173)
const serverPort = Number(process.env["PORT"] ?? 8787)

// Keeps the CSS modules' declarations (see scripts/css-module-types.ts) current while
// editing, and reports a bad composes without stopping the server.
const cssModuleTypes: Plugin = {
  name: "css-module-types",
  apply: "serve",
  buildStart() {
    for (const error of generateAll()) this.warn(error)
  },
  watchChange(file, { event }) {
    if (!file.endsWith(".module.css")) return
    const errors = event === "delete" ? generateAll() : writeDeclaration(file)
    for (const error of errors) this.warn(error)
  }
}

export default defineConfig({
  plugins: lazyPlugins(() => [react(), cssModuleTypes]),
  server: {
    port: webPort,
    strictPort: true,
    open: false,
    proxy: {
      "/api": { target: `http://localhost:${serverPort}` },
      "/auth": { target: `http://localhost:${serverPort}` }
    }
  },
  css: { transformer: "lightningcss" }
})
