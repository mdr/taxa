import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app/App.tsx"
import "@fontsource-variable/inter"
import "./global.css"
import { appLogger } from "./telemetry/app-telemetry.ts"
import { LOG_CODES } from "./telemetry/codes.ts"
import { logUncaughtErrors } from "./telemetry/error-listeners.ts"

logUncaughtErrors(window, appLogger)
appLogger.info(LOG_CODES.app.started, "the app started", { path: window.location.pathname })

const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
