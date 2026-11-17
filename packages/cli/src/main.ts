#!/usr/bin/env -S node --experimental-transform-types --disable-warning=ExperimentalWarning
import { timeZone } from "@taxa/shared/dates/plain-date"
import { text } from "node:stream/consumers"
import { realClock } from "@taxa/shared/clock"
import { runCli } from "./cli.ts"

process.exitCode = await runCli(process.argv.slice(2), {
  env: process.env,
  stdout: (output) => process.stdout.write(output),
  stderr: (output) => process.stderr.write(output),
  readStdin: () => text(process.stdin),
  now: () => realClock.now(),
  timeZone: timeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
})
