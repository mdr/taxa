import { test, type TestAPI } from "vite-plus/test"
import { InProcessServer, type InProcessOptions } from "./in-process-server.ts"

/** `it` for specs against an in-process server, started for each test and given as `server`. */
export const useInProcessServer = (options: InProcessOptions = {}): TestAPI<{ server: InProcessServer }> =>
  test.extend<{ server: InProcessServer }>({
    server: async ({ task: _task }, use) => {
      const server = await InProcessServer.start(options)
      try {
        await use(server)
      } finally {
        await server.close()
      }
    }
  })
