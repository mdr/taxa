import { ServerStatus } from "../../src/health/server-status.ts"
import { test } from "../fixtures/taxa-fixture.ts"

test("the sidebar shows the server is up", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.expectServerStatus(ServerStatus.OK)
})

test("the sidebar says when the server's database is down", async ({ taxa }) => {
  await taxa.stopDatabase()
  const inbox = await (await taxa.openTab("Matt")).openInbox()
  await inbox.sidebar.expectServerStatus(ServerStatus.DATABASE_DOWN)
})
