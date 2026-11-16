import { beforeAll, test, type TestAPI } from "vite-plus/test"
import { InProcessServer, type InProcessOptions } from "./in-process-server.ts"
import { warmUpDatabases } from "./pglite-database.ts"

/** Migrating the template database takes seconds when the machine is busy: not on any one test's clock. */
const WARM_UP_MS = 60_000

/** `it` for specs against an in-process server, started for each test and given as `server`. */
export const useInProcessServer = (options: InProcessOptions = {}): TestAPI<{ server: InProcessServer }> => {
  beforeAll(warmUpDatabases, WARM_UP_MS)
  return test.extend<{ server: InProcessServer }>({
    server: async ({ task: _task }, use) => {
      const server = await InProcessServer.start(options)
      try {
        await use(server)
      } finally {
        await server.close()
      }
    }
  })
}
