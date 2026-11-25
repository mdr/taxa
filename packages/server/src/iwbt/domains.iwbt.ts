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

  it("are deleted once empty, even of the Bin, and old refs still find tasks moved out", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Home", "H")
    await matt.addDomain("Personal", "P")
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const old = await matt.addTask("Old idea", { domain: "H" })
    await matt.client.deleteTask(old.ref)

    const refused = await expectProblem(matt.client.deleteDomain("h"), ProblemType.INVALID_REQUEST)
    expect(refused.message).toBe(
      "Home still has 2 tasks (H-1, H-2): move them to another domain, or delete them for good from the Bin, first."
    )
    const moved = await matt.client.updateTask(tap.ref, { set: { domain: "P" } })
    expect(moved.ref).toBe("P-1")
    await matt.client.purgeTask(old.ref)

    expect(await matt.client.deleteDomain("H")).toMatchObject({ name: "Home", prefix: "H" })
    expect((await matt.client.domains()).map(({ prefix }) => prefix)).toEqual(["P"])
    expect((await matt.client.task("H-1")).ref).toBe("P-1")
    // Its prefix stays taken, so H-1 never means another task.
    await expectProblem(matt.addDomain("Hobbies", "H"), ProblemType.PREFIX_TAKEN)
    // Moving it back in would lose it.
    await expectProblem(matt.client.undoTask(moved.ref, moved.version), ProblemType.VERSION_CONFLICT)
    expect(server.logs.filter(({ code }) => code === "domain.deleted")).toHaveLength(1)
  })

  it("are seen only by their members", async ({ server }) => {
    const matt = await server.user("Matt")
    const jo = await server.user("Jo")
    await matt.addDomain("Personal", "M")
    expect(await jo.client.domains()).toEqual([])
  })
})
