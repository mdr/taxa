import { describe, expect } from "vite-plus/test"
import { ProblemType } from "@taxa/shared/api/problem"
import { commentId, uuidv7 } from "@taxa/shared/ids"
import { expectProblem } from "../test-support/problems.ts"
import { useInProcessServer } from "../test-support/use-in-process-server.ts"

const MINUTE = 60 * 1000

describe("comments", () => {
  const it = useInProcessServer()

  it("records what's happened on a task, oldest first, with who said it, leaving the task as it is", async ({
    server
  }) => {
    const matt = await server.user("Matt")
    const claude = await matt.agent("Claude Code", "mdr/taxa")
    const tap = await matt.addTask("Fix the tap", { notes: "The kitchen one" })
    await matt.client.addComment(tap.ref, { body: "Rang the plumber: he'll call back Thursday." })
    server.advance(MINUTE)
    await claude.client.addComment(tap.ref, { body: "  Found the part: **15mm** compression fitting.  " })

    const comments = await matt.client.comments(tap.ref)
    expect(
      comments.map(({ author, body }) => [author.user.name, author.agent?.name, author.agentContext, body])
    ).toEqual([
      ["Matt", undefined, undefined, "Rang the plumber: he'll call back Thursday."],
      ["Matt", "Claude Code", "mdr/taxa", "Found the part: **15mm** compression fitting."]
    ])
    expect(comments[1]).toMatchObject({ taskId: tap.id, createdAt: "2026-01-05T09:01:00.000Z", version: 1 })
    expect(await matt.client.task(tap.ref)).toMatchObject({ notes: "The kitchen one", version: tap.version })
    expect(server.logs.filter(({ code }) => code === "comment.added").map(({ fields }) => fields)).toEqual([
      expect.objectContaining({ taskId: tap.id, commentId: comments[0]!.id, version: 1 }),
      expect.objectContaining({ taskId: tap.id, commentId: comments[1]!.id, version: 1 })
    ])
    expect(JSON.stringify(server.logs)).not.toContain("plumber")
  })

  it("adds a comment once, however often the request is retried", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    const first = await matt.client.addComment(tap.ref, { body: "Rang the plumber" }, "key-1")
    expect(await matt.client.addComment(tap.ref, { body: "Rang the plumber" }, "key-1")).toEqual(first)
    const id = commentId(uuidv7(server.clock.now()))
    await matt.client.addComment(tap.ref, { id, body: "Bought washers" })
    await expectProblem(matt.client.addComment(tap.ref, { id, body: "Bought washers" }), ProblemType.INVALID_REQUEST)
    expect((await matt.client.comments(tap.ref)).map(({ body }) => body)).toEqual([
      "Rang the plumber",
      "Bought washers"
    ])
  })

  it("won't add an empty comment, nor one on a task someone can't see", async ({ server }) => {
    const matt = await server.user("Matt")
    const anna = await server.user("Anna")
    const tap = await matt.addTask("Fix the tap")
    await expectProblem(matt.client.addComment(tap.ref, { body: "   " }), ProblemType.INVALID_REQUEST)
    await expectProblem(anna.client.addComment(tap.ref, { body: "Hello" }), ProblemType.NOT_FOUND)
    await expectProblem(anna.client.comments(tap.ref), ProblemType.NOT_FOUND)
  })

  it("lets its author edit, delete and restore it, logging each change", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    const comment = await matt.client.addComment(tap.ref, { body: "Rang the plumbr" })
    server.advance(MINUTE)
    const edited = await matt.client.editComment(comment.id, { body: "Rang the plumber" }, comment.version)
    expect(edited).toMatchObject({ body: "Rang the plumber", editedAt: "2026-01-05T09:01:00.000Z", version: 2 })
    await expectProblem(
      matt.client.editComment(comment.id, { body: "Rang him" }, comment.version),
      ProblemType.VERSION_CONFLICT
    )
    expect(await matt.client.editComment(comment.id, { body: "Rang the plumber" })).toMatchObject({ version: 2 })

    const deleted = await matt.client.deleteComment(comment.id)
    expect(deleted.version).toBe(3)
    expect(await matt.client.comments(tap.ref)).toEqual([])
    await expectProblem(matt.client.editComment(comment.id, { body: "Rang him" }), ProblemType.INVALID_REQUEST)
    expect(await matt.client.restoreComment(comment.id)).toMatchObject({ body: "Rang the plumber", version: 4 })
    expect((await matt.client.comments(tap.ref)).map(({ body }) => body)).toEqual(["Rang the plumber"])

    expect(
      server.logs.filter(({ code }) => code.startsWith("comment.")).map(({ code, fields }) => [code, fields["version"]])
    ).toEqual([
      ["comment.added", 1],
      ["comment.edited", 2],
      ["comment.deleted", 3],
      ["comment.restored", 4]
    ])
    expect((await server.storedComments(tap.id))[0]!.logged).toEqual([
      { body: { to: "Rang the plumbr" } },
      { body: { from: "Rang the plumbr", to: "Rang the plumber" } },
      { deletedAt: { to: "2026-01-05T09:01:00.000Z" } },
      { deletedAt: { from: "2026-01-05T09:01:00.000Z" } }
    ])
  })

  it("lets no one else change it: not another person, nor the author's agents", async ({ server }) => {
    const matt = await server.user("Matt")
    const anna = await server.user("Anna")
    const claude = await matt.agent("Claude Code")
    await matt.addDomain("Home", "H")
    const tap = await matt.addTask("Fix the tap", { domain: "H" })
    const mine = await matt.client.addComment(tap.ref, { body: "Rang the plumber" })
    const its = await claude.client.addComment(tap.ref, { body: "Found the part" })
    await expectProblem(claude.client.editComment(mine.id, { body: "Hacked" }), ProblemType.FORBIDDEN)
    await expectProblem(matt.client.deleteComment(its.id), ProblemType.FORBIDDEN)
    await expectProblem(anna.client.deleteComment(mine.id), ProblemType.NOT_FOUND)
    expect(await claude.client.editComment(its.id, { body: "Found the part: 15mm" })).toMatchObject({ version: 2 })
  })

  it("finds a task by what its comments say, but not by a deleted one", async ({ server }) => {
    const matt = await server.user("Matt")
    const plumber = await matt.addTask("Call the plumber")
    await matt.addTask("Fix the tap")
    await matt.client.addComment(plumber.ref, { body: "He'll bring a new tap on Thursday" })
    const deleted = await matt.client.addComment(plumber.ref, { body: "Quoted £80" })
    await matt.client.deleteComment(deleted.id)
    const titles = async (search: string): Promise<string[]> =>
      (await matt.client.tasks({ search })).map(({ title }) => title)
    expect(await titles("tap")).toEqual(["Fix the tap", "Call the plumber"])
    expect(await titles("plumber thursday")).toEqual(["Call the plumber"])
    expect(await titles("quoted")).toEqual([])
  })

  it("is wiped when its task is deleted for good", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    const comment = await matt.client.addComment(tap.ref, { body: "Rang the plumber" }, "key-1")
    await matt.client.editComment(comment.id, { body: "Rang the plumber again" })
    await matt.client.deleteTask(tap.ref)
    await matt.client.purgeTask(tap.ref)
    expect(await server.storedComments(tap.id)).toEqual([{ body: "", logged: [{}, {}] }])
    await expectProblem(matt.client.restoreComment(comment.id), ProblemType.NOT_FOUND)
    const retried = await matt.addTask("Book the dentist")
    expect((await matt.client.addComment(retried.ref, { body: "New" }, "key-1")).body).toBe("New")
  })
})
