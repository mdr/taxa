#!/usr/bin/env -S node --experimental-transform-types --disable-warning=ExperimentalWarning
import { timeZone } from "@taxa/shared/dates/plain-date"
import { text } from "node:stream/consumers"
import { realClock } from "@taxa/shared/clock"
import { exitQuietlyOnBrokenPipe } from "./broken-pipe.ts"
import { runCli } from "./cli.ts"
import { credentialsPath, readCredentialsFile } from "./credentials/credentials-file.ts"

exitQuietlyOnBrokenPipe(process.stdout, (code) => process.exit(code))

process.exitCode = await runCli(process.argv.slice(2), {
  env: process.env,
  stdout: (output) => process.stdout.write(output),
  stderr: (output) => process.stderr.write(output),
  readStdin: () => text(process.stdin),
  now: () => realClock.now(),
  timeZone: timeZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
  readCredentials: () => readCredentialsFile(credentialsPath(process.env))
})
