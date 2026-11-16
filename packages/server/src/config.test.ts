import { describe, expect, it } from "vite-plus/test"
import { configFrom } from "./config.ts"

describe("configFrom", () => {
  it("needs a database, and defaults the port and build", () => {
    expect(() => configFrom({})).toThrow()
    expect(configFrom({ DATABASE_URL: "postgres://localhost/taxa" })).toEqual({
      PORT: 8787,
      DATABASE_URL: "postgres://localhost/taxa",
      TAXA_BUILD: "dev"
    })
  })

  it("reads the port as a number", () => {
    expect(configFrom({ DATABASE_URL: "postgres://localhost/taxa", PORT: "9000" }).PORT).toBe(9000)
  })
})
