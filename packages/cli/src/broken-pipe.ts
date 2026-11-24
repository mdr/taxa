import type { EventEmitter } from "node:events"

/**
 * Exits quietly when whatever reads the output stops early (`taxa list | head -1`),
 * as other command-line tools do, instead of crashing with an unhandled EPIPE.
 */
export const exitQuietlyOnBrokenPipe = (output: EventEmitter, exit: (code: number) => void): void => {
  output.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") throw error
    exit(0)
  })
}
