import styles from "./App.module.css"
import { appTestIds } from "./AppTestIds.ts"
import { SERVER_STATUS_TEXT } from "../health/server-status.ts"
import { useServerStatus } from "../health/use-server-status.ts"

export const App = () => {
  const status = useServerStatus()
  return (
    <main className={styles.app}>
      <h1 className={styles.title}>Taxa</h1>
      <p className={styles.status} role="status" data-testid={appTestIds.serverStatus} data-status={status}>
        {SERVER_STATUS_TEXT[status]}
      </p>
    </main>
  )
}
