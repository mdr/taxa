import { describe, expect, it } from "vite-plus/test"
import { TaskRefSchema } from "@taxa/shared/tasks/task-ref"
import { taskUrl } from "./task-url.ts"

describe("taskUrl", () => {
  it("is the task's page in the web app, however its address ends", () => {
    expect(taskUrl("http://localhost:5173", TaskRefSchema.parse("H-35"))).toBe("http://localhost:5173/tasks/H-35")
    expect(taskUrl("https://taxa.example/app/", TaskRefSchema.parse("IN-2"))).toBe(
      "https://taxa.example/app/tasks/IN-2"
    )
  })
})
