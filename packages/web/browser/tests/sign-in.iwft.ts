import { test } from "../fixtures/taxa-fixture.ts"

test.describe("not signed in", () => {
  test.use({ signedOut: true })

  test("any page is the sign-in page, which comes back to it", async ({ taxa }) => {
    const tab = await taxa.openTab("Visitor")
    const signIn = await tab.openSignedOut("/tasks/H-7?sign-in=failed")
    await signIn.expectProblem("Signing in didn't work")
    await signIn.expectSignInComesBackTo(taxa.server.httpUrl, "/tasks/H-7")

    const fresh = await tab.openSignedOut("/today")
    await fresh.expectNoProblem()
    await fresh.expectSignInComesBackTo(taxa.server.httpUrl, "/today")
  })

  test("says when Taxa doesn't know the account", async ({ taxa }) => {
    const signIn = await (await taxa.openTab("Visitor")).openSignedOut("/?sign-in=not-known")
    await signIn.expectProblem("Taxa doesn't know that account")
  })
})
