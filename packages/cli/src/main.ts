#!/usr/bin/env -S node --experimental-transform-types --disable-warning=ExperimentalWarning
import { runCli } from "./cli.ts"

process.exitCode = await runCli(process.argv.slice(2), {
  env: process.env,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text)
})
