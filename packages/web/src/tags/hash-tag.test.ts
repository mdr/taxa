import { describe, expect, it } from "vite-plus/test"
import { hashTagIn } from "./hash-tag.ts"

describe("hashTagIn", () => {
  it("finds what's typed after a # at the end, spaces and all", () => {
    expect(hashTagIn("Renew passport #life ad")).toEqual({ start: 15, typed: "life ad" })
    expect(hashTagIn("#")).toEqual({ start: 0, typed: "" })
  })

  it("finds none in a word, or with no #", () => {
    expect(hashTagIn("Fix bug C#")).toBeUndefined()
    expect(hashTagIn("Renew passport")).toBeUndefined()
  })
})
