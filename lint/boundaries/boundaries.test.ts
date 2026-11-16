import { describe, expect, it } from "vite-plus/test"
import { importedPath, packageProblem, testSupportProblem, type Import } from "./boundaries.ts"

const makeImport = (from: string, specifier: string): Import => ({
  from,
  to: importedPath(from, specifier) ?? "",
  typeOnly: false,
  dynamic: false
})

describe("importedPath", () => {
  it("resolves relative imports and the workspace packages, not outside ones", () => {
    expect(importedPath("packages/web/src/app/App.tsx", "../api/api-client")).toBe("packages/web/src/api/api-client")
    expect(importedPath("packages/server/src/app.ts", "@taxa/shared/clock")).toBe("packages/shared/clock")
    expect(importedPath("packages/server/src/app.ts", "hono")).toBeUndefined()
  })
})

describe("packageProblem", () => {
  it.each([
    ["packages/shared/src/clock.ts", "../../web/src/main"],
    ["packages/shared/src/clock.ts", "@taxa/server/src/app"],
    ["packages/server/src/app.ts", "../../web/src/main"],
    ["packages/web/src/main.tsx", "../../server/src/app"],
    ["packages/web/src/main.tsx", "@taxa/cli/src/main"],
    ["packages/cli/src/main.ts", "@taxa/server/src/app"],
    ["packages/web/browser/tests/x.iwft.ts", "../../../server/src/app.ts"]
  ])("forbids %s importing %s", (from, specifier) => {
    expect(packageProblem(makeImport(from, specifier))).toBeDefined()
  })

  it.each([
    ["packages/web/src/main.tsx", "@taxa/shared/clock"],
    ["packages/server/src/app.ts", "./database/database"],
    ["packages/web/browser/fixtures/taxa-fixture.ts", "../../../server/src/test-support/in-process-server.ts"],
    ["packages/cli/src/iwbt/health.iwbt.ts", "@taxa/server/src/test-support/use-in-process-server"]
  ])("allows %s importing %s", (from, specifier) => {
    expect(packageProblem(makeImport(from, specifier))).toBeUndefined()
  })
})

describe("testSupportProblem", () => {
  it("keeps test-support out of shipped code", () => {
    expect(testSupportProblem(makeImport("packages/server/src/app.ts", "./test-support/x"))).toBeDefined()
  })

  it.each([
    ["packages/server/src/iwbt/health.iwbt.ts", "../test-support/use-in-process-server"],
    ["packages/shared/src/clock.test.ts", "./test-support/fake-clock"],
    ["packages/web/browser/fixtures/taxa-fixture.ts", "../../../server/src/test-support/in-process-server.ts"]
  ])("lets %s use %s", (from, specifier) => {
    expect(testSupportProblem(makeImport(from, specifier))).toBeUndefined()
  })
})
