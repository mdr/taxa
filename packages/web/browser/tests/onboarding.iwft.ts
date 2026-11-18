import { test } from "../fixtures/taxa-fixture.ts"

test("a first visit offers domains to start with, and starts with the chosen ones", async ({ taxa }) => {
  const welcome = await (await taxa.openTab("Matt")).openFirstTime()
  await welcome.expectChoices(["✓ P Personal", "✓ H Home", "· W Work"])
  await welcome.expectStartLabel("Start with 2 domains")
  await welcome.expectAccessible()

  await welcome.toggle("Work")
  await welcome.addAnother("Health")
  await welcome.expectChoices(["✓ P Personal", "✓ H Home", "✓ W Work", "✓ HE Health"])
  await welcome.expectStartLabel("Start with 4 domains")

  const inbox = await welcome.start()
  await inbox.sidebar.expectDomains(["P Personal", "H Home", "W Work", "HE Health"])
  await inbox.expectTasks([])
  await inbox.expectAccessible()
})

test("problems with the choices are shown before anything is made", async ({ taxa }) => {
  const welcome = await (await taxa.openTab("Matt")).openFirstTime()
  await welcome.toggle("Work")
  await welcome.setPrefix("Work", "P")
  await welcome.startExpectingProblems()
  await welcome.expectProblem("Personal", "Another domain has P too.")
  await welcome.expectProblem("Work", "Another domain has P too.")
  await welcome.expectAccessible()
  await taxa.expectDomains([])
})

test("a prefix someone else has is explained, and the domains already made are kept", async ({ taxa }) => {
  const jo = await taxa.addUser("Jo")
  await jo.addDomain("Hobbies", "H")
  const welcome = await (await taxa.openTab("Matt")).openFirstTime()
  await welcome.startExpectingProblems()
  await welcome.expectError("Couldn't add Home")
  await welcome.setPrefix("Home", "HM")
  await welcome.expectStartLabel("Start with 1 domain")
  const inbox = await welcome.start()
  await inbox.sidebar.expectDomains(["P Personal", "HM Home"])
})
