import { describe, expect, it } from "vite-plus/test"
import { releaseOf } from "./BuildVersion.tsx"

describe("releaseOf", () => {
  it("leaves out the commit", () => {
    expect(releaseOf("0.6.0+fa6c57e")).toBe("0.6.0")
  })

  it("keeps a build with no commit as it is", () => {
    expect(releaseOf("dev")).toBe("dev")
  })
})
