import { describe, expect, it } from "vite-plus/test"
import { ifMatchVersion } from "./if-match.ts"

describe("ifMatchVersion", () => {
  it.each([
    ['"3"', 3],
    ["3", 3],
    ['W/"12"', 12]
  ])("reads %s", (header, version) => {
    expect(ifMatchVersion(header)).toBe(version)
  })

  it("is undefined without the header, and refuses anything else", () => {
    expect(ifMatchVersion(undefined)).toBeUndefined()
    expect(() => ifMatchVersion("*")).toThrow("If-Match")
  })
})
