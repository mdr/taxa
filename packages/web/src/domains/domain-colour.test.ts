import { describe, expect, it } from "vite-plus/test"
import { domainColour } from "./domain-colour.ts"

describe("domainColour", () => {
  it("gives the first domains different colours, in order", () => {
    const prefixes = ["P", "H", "W"]
    expect(new Set(prefixes.map((prefix) => domainColour(prefix, prefixes))).size).toBe(3)
    expect(domainColour("H", prefixes)).toBe(domainColour("H", [...prefixes, "X"]))
  })

  it("still colours a domain it doesn't know, the same each time", () => {
    expect(domainColour("Z", [])).toBe(domainColour("Z", ["P"]))
  })
})
