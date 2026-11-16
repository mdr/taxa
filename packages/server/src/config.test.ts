import { describe, expect, it } from "vite-plus/test"
import { configFrom } from "./config.ts"

describe("configFrom", () => {
  it("needs a database, and defaults the port and build", () => {
    expect(() => configFrom({})).toThrow()
    expect(configFrom({ DATABASE_URL: "postgres://localhost/taxa" })).toEqual({
      PORT: 8787,
      DATABASE_URL: "postgres://localhost/taxa",
      TAXA_BUILD: "dev",
      TAXA_TIME_ZONE: "Europe/London"
    })
  })

  it("reads the port as a number", () => {
    expect(configFrom({ DATABASE_URL: "postgres://localhost/taxa", PORT: "9000" }).PORT).toBe(9000)
  })
})

describe("configFrom's development login", () => {
  it("takes a person's name and a real time zone", () => {
    const config = configFrom({ DATABASE_URL: "postgres://x", TAXA_DEV_USER: "Matt", TAXA_TIME_ZONE: "Asia/Tokyo" })
    expect(config).toMatchObject({ TAXA_DEV_USER: "Matt", TAXA_TIME_ZONE: "Asia/Tokyo" })
    expect(() => configFrom({ DATABASE_URL: "postgres://x", TAXA_TIME_ZONE: "Mars/Olympus" })).toThrow()
  })
})
