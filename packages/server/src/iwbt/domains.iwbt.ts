import { describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

describe("domains", () => {
  const it = useInProcessServer()

  it("are created with a prefix, and listed oldest first", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Work", "W")
    server.advance(1000)
    await matt.addDomain("Personal", "p")
    expect((await matt.client.domains()).map(({ name, prefix }) => [name, prefix])).toEqual([
      ["Work", "W"],
      ["Personal", "P"]
    ])
  })

  it("can't share a prefix, even between people", async ({ server }) => {
    const matt = await server.user("Matt")
    const jo = await server.user("Jo")
    await matt.addDomain("Home", "H")
    const problem = await expectProblem(jo.addDomain("Hobbies", "h"), ProblemType.PREFIX_TAKEN)
    expect(problem.message).toContain("H")
  })

  it("need a prefix of 1 to 5 letters, other than the Inbox's", async ({ server }) => {
    const matt = await server.user("Matt")
    await expectProblem(matt.client.createDomain({ name: "Work", prefix: "W1" }), ProblemType.INVALID_REQUEST)
    await expectProblem(matt.client.createDomain({ name: "Work", prefix: "WORKSS" }), ProblemType.INVALID_REQUEST)
    await expectProblem(matt.client.createDomain({ name: "Ideas", prefix: "in" }), ProblemType.INVALID_REQUEST)
  })

  it("are seen only by their members", async ({ server }) => {
    const matt = await server.user("Matt")
    const jo = await server.user("Jo")
    await matt.addDomain("Personal", "M")
    expect(await jo.client.domains()).toEqual([])
  })
})
