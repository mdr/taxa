import { QueryClient } from "@tanstack/react-query"
import { makeTask } from "@taxa/shared/test-support/make-task"
import type { Task } from "@taxa/shared/tasks/task"
import { describe, expect, it } from "vite-plus/test"
import { queryTaskCache } from "./task-cache.ts"
import { queryKeys } from "../../api/query-keys.ts"

const task = makeTask({ title: "Fix the tap", version: 3 })
const other = makeTask({ number: 2, title: "Bleed the radiators" })

describe("queryTaskCache", () => {
  it("knows nothing of a task the page hasn't loaded", () => {
    expect(queryTaskCache(new QueryClient()).latest(task.id)).toBeUndefined()
  })

  it("finds the latest version, whether shown on its own or in a list", () => {
    const queryClient = new QueryClient()
    const cache = queryTaskCache(queryClient)
    queryClient.setQueryData(queryKeys.task(task.ref), task)
    queryClient.setQueryData(queryKeys.tasks({ inbox: "true" }), [other, { ...task, version: 5 }])
    queryClient.setQueryData(queryKeys.tasks({ domain: "H" }), [{ ...task, version: 4 }])
    expect(cache.latest(task.id)?.version).toBe(5)
    expect(cache.latest(other.id)).toEqual(other)
  })

  it("finds a task shown only on its own", () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(queryKeys.task(task.ref), task)
    expect(queryTaskCache(queryClient).latest(task.id)).toEqual(task)
  })

  it("shows a newer version where the task is shown on its own, and has lists and activity fetched again", async () => {
    const queryClient = new QueryClient()
    const cache = queryTaskCache(queryClient)
    queryClient.setQueryData(queryKeys.task(task.ref), task)
    queryClient.setQueryData(queryKeys.task(other.ref), other)
    queryClient.setQueryData(queryKeys.tasks({ inbox: "true" }), [task])
    queryClient.setQueryData(queryKeys.activity(task.ref), [])
    const newer: Task = { ...task, title: "Fix the kitchen tap", version: 4 }

    await cache.show(newer)
    expect(queryClient.getQueryData(queryKeys.task(task.ref))).toEqual(newer)
    expect(queryClient.getQueryData(queryKeys.task(other.ref))).toEqual(other)
    expect(queryClient.getQueryState(queryKeys.task(other.ref))?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(queryKeys.tasks({ inbox: "true" }))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(queryKeys.activity(task.ref))?.isInvalidated).toBe(true)
  })
})
