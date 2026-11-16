import { ServerStatus } from "../../src/health/server-status.ts"
import { test } from "../fixtures/taxa-fixture.ts"

test("the home page shows the server is up", async ({ taxa }) => {
  const homePage = await (await taxa.openTab("Matt")).openHome()
  await homePage.expectServerStatus(ServerStatus.OK)
  await homePage.expectAccessible()
})

test("the home page says when the server's database is down", async ({ taxa }) => {
  await taxa.stopDatabase()
  const homePage = await (await taxa.openTab("Matt")).openHome()
  await homePage.expectServerStatus(ServerStatus.DATABASE_DOWN)
})
