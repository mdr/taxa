import { describe, expect } from "vite-plus/test"
import type { TaxaClient } from "@taxa/shared/api/taxa-client"
import { useInProcessServer } from "../../../../server/src/test-support/use-in-process-server.ts"
import { ANALYTICS_CODES } from "../../telemetry/codes.ts"
import { testTelemetry } from "../../test-support/test-telemetry.ts"
import { BinQuestionType, BinService, type BinApi } from "./bin-service.ts"

const binOf = async (client: TaxaClient): Promise<string[]> =>
  (await client.tasks({ deleted: "true" })).map(({ title }) => title)

describe("BinService", () => {
  const it = useInProcessServer()

  it("deletes a task for good once it's confirmed, not when it's cancelled", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const tap = await matt.addTask("Fix the tap")
    await matt.addTask("Put the bins out")
    for (const { ref } of await matt.client.tasks()) await matt.client.deleteTask(ref)
    const telemetry = testTelemetry()
    let refreshed = 0
    const bin = new BinService(matt.client, () => Promise.resolve(void refreshed++), telemetry.analytics)
    const deleted = (await matt.client.tasks({ deleted: "true" })).find(({ id }) => id === tap.id)!

    bin.ask({ type: BinQuestionType.ONE, task: deleted })
    bin.cancel()
    expect(bin.state.asking).toBeUndefined()
    await bin.confirm()
    expect((await binOf(matt.client)).sort()).toEqual(["Fix the tap", "Put the bins out"])

    bin.ask({ type: BinQuestionType.ONE, task: deleted })
    await bin.confirm()
    expect(bin.state).toEqual({ asking: undefined, purging: false, problem: undefined })
    expect(await binOf(matt.client)).toEqual(["Put the bins out"])
    expect(refreshed).toBe(1)

    bin.ask({ type: BinQuestionType.ALL, count: 1 })
    await bin.confirm()
    expect(await binOf(matt.client)).toEqual([])
    expect(telemetry.tracked()).toEqual([
      [ANALYTICS_CODES.task.purged, { taskId: tap.id, taskRef: tap.ref }],
      [ANALYTICS_CODES.bin.emptied, { count: 1 }]
    ])
  })

  it("says why it couldn't, and keeps asking", async ({ server }) => {
    const matt = await server.user("Matt")
    await matt.addDomain("Matt", "M")
    const tap = await matt.addTask("Fix the tap")
    const unreachable: BinApi = {
      purgeTask: () => Promise.reject(new TypeError("Failed to fetch")),
      emptyBin: () => Promise.reject(new TypeError("Failed to fetch"))
    }
    const bin = new BinService(unreachable, () => Promise.resolve(), testTelemetry().analytics)
    bin.ask({ type: BinQuestionType.ONE, task: tap })
    await bin.confirm()
    expect(bin.state.asking).toEqual({ type: BinQuestionType.ONE, task: tap })
    expect(bin.state.problem).toBe("Can't reach the server. Check your connection and try again.")
  })
})
