import { describe, expect } from "vite-plus/test"
import { useInProcessServer } from "../../../../server/src/test-support/use-in-process-server.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { testTelemetry } from "../../test-support/test-telemetry.ts"
import { CommentsService, type CommentHistory, type CommentsApi } from "./comments-service.ts"

/** A history that only makes each change, as the tab's would, without noting it. */
const noHistory: CommentHistory = { changeComment: ({ make }) => make() }

describe("CommentsService", () => {
  const it = useInProcessServer()

  it("adds what's written, then empties the draft", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    const telemetry = testTelemetry()
    let refreshed = 0
    const comments = new CommentsService(
      matt.client,
      noHistory,
      tap,
      () => Promise.resolve(void refreshed++),
      telemetry.analytics
    )

    await comments.post()
    expect(refreshed).toBe(0)
    comments.write("Rang the plumber")
    await comments.post()
    expect(comments.state).toMatchObject({ draft: "", posting: false, problem: undefined })
    const [added] = await matt.client.comments(tap.ref)
    expect(added?.body).toBe("Rang the plumber")
    expect(refreshed).toBe(1)
    expect(telemetry.tracked()).toEqual([[ANALYTICS_CODES.comment.added, { taskId: tap.id, commentId: added?.id }]])
  })

  it("edits a comment, and leaves it as it was when the edit is cancelled or changes nothing", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    const comment = await matt.client.addComment(tap.ref, { body: "Rang the plumbr" })
    const comments = new CommentsService(
      matt.client,
      noHistory,
      tap,
      () => Promise.resolve(),
      testTelemetry().analytics
    )

    comments.startEditing(comment)
    comments.writeEdit("Something else")
    comments.cancelEditing()
    comments.startEditing(comment)
    await comments.saveEdit(comment)
    expect((await matt.client.comments(tap.ref))[0]?.version).toBe(1)

    comments.startEditing(comment)
    comments.writeEdit("Rang the plumber")
    await comments.saveEdit(comment)
    expect(comments.state.editing).toBeUndefined()
    expect(await matt.client.comments(tap.ref)).toMatchObject([{ body: "Rang the plumber", version: 2 }])
  })

  it("says so when the comment changed since it was shown, and keeps the edit", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    const comment = await matt.client.addComment(tap.ref, { body: "Rang the plumber" })
    await matt.client.editComment(comment.id, { body: "Rang the plumber twice" })
    const comments = new CommentsService(
      matt.client,
      noHistory,
      tap,
      () => Promise.resolve(),
      testTelemetry().analytics
    )
    comments.startEditing(comment)
    comments.writeEdit("Rang him")
    await comments.saveEdit(comment)
    expect(comments.state.editing).toEqual({ id: comment.id, body: "Rang him" })
    expect(comments.state.problem).toMatch(/changed since/)
  })

  it("deletes a comment", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    const comment = await matt.client.addComment(tap.ref, { body: "Rang the plumber" })
    const telemetry = testTelemetry()
    const comments = new CommentsService(matt.client, noHistory, tap, () => Promise.resolve(), telemetry.analytics)
    await comments.remove(comment)
    expect(await matt.client.comments(tap.ref)).toEqual([])
    expect(telemetry.tracked().map(([code]) => code)).toEqual([ANALYTICS_CODES.comment.deleted])
  })

  it("keeps the draft and says why when the server can't be reached", async ({ server }) => {
    const matt = await server.user("Matt")
    const tap = await matt.addTask("Fix the tap")
    const unreachable = (): Promise<never> => Promise.reject(new TypeError("Failed to fetch"))
    const api: CommentsApi = {
      addComment: unreachable,
      editComment: unreachable,
      deleteComment: unreachable
    }
    const comments = new CommentsService(api, noHistory, tap, () => Promise.resolve(), testTelemetry().analytics)
    comments.write("Rang the plumber")
    await comments.post()
    expect(comments.state).toMatchObject({
      draft: "Rang the plumber",
      posting: false,
      problem: "Can't reach the server. Check your connection and try again."
    })
  })
})
