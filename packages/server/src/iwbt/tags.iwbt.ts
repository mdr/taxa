import { describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

describe("tags", () => {
  const it = useInProcessServer()

  it("label a task with any words, kept as typed and matched in any case", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    const passport = await matt.addTask("Renew passport", { tags: ["  Life   Admin ", "#errand"] })
    expect(passport.tags).toEqual(["Life Admin", "errand"])
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const tagged = await matt.client.updateTask(tap.ref, { addTags: ["life admin", "life-admin"] })
    expect(tagged.tags).toEqual(["life admin", "life-admin"])
    await matt.addTask("Walk the dog", { domain: "H" })
    expect((await matt.client.tasks({ tag: "LIFE ADMIN" })).map(({ title }) => title).sort()).toEqual([
      "Fix the tap",
      "Renew passport"
    ])
    expect((await matt.client.tasks({ search: "admin errand" })).map(({ title }) => title)).toEqual(["Renew passport"])
    const untagged = await matt.client.updateTask(tap.ref, { removeTags: ["LIFE-ADMIN"], addTags: ["Life Admin"] })
    expect(untagged.tags).toEqual(["life admin"])
    expect((await matt.client.activity(tap.ref)).at(-1)?.changes).toEqual({
      tags: { from: ["life admin", "life-admin"], to: ["life admin"] }
    })
    await expectProblem(matt.client.updateTask(tap.ref, { addTags: ["a, b"] }), ProblemType.INVALID_REQUEST)
  })

  it("are listed across what you can see, with how many tasks are still to do, and renamed everywhere", async ({
    server
  }) => {
    const matt = await server.user("Matt")
    const jo = await server.user("Jo")
    await matt.addDomain("Home", "H")
    await jo.addDomain("Jo's", "J")
    const passport = await matt.addTask("Renew passport", { tags: ["Life Admin"] })
    await matt.addTask("Pay the council tax", { tags: ["life admin", "money"] })
    const tax = await matt.addTask("File the tax return", { tags: ["Life Admin"] })
    await matt.client.changeStatus(tax.ref, { status: TaskStatus.DONE })
    await jo.addTask("Jo's own", { domain: "J", tags: ["secret"] })
    expect(await matt.client.tags()).toEqual([
      { name: "Life Admin", openCount: 2 },
      { name: "money", openCount: 1 }
    ])
    expect(await matt.client.renameTag({ from: "LIFE ADMIN", to: "Admin" })).toEqual({ renamed: 3 })
    expect((await matt.client.task(passport.ref)).tags).toEqual(["Admin"])
    expect((await matt.client.tags()).map(({ name }) => name)).toEqual(["Admin", "money"])
    await expectProblem(matt.client.renameTag({ from: "secret", to: "mine" }), ProblemType.NOT_FOUND)
    expect((await jo.client.tags()).map(({ name }) => name)).toEqual(["secret"])
  })
})
