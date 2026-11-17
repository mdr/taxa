import { domainPrefix } from "@taxa/shared/domains/domain"
import { describe, expect, it } from "vite-plus/test"
import { domainColour } from "./domain-colour.ts"

const [P, H, W, X, Z] = [domainPrefix("P"), domainPrefix("H"), domainPrefix("W"), domainPrefix("X"), domainPrefix("Z")]

describe("domainColour", () => {
  it("gives the first domains different colours, in order", () => {
    const prefixes = [P, H, W]
    expect(new Set(prefixes.map((prefix) => domainColour(prefix, prefixes))).size).toBe(3)
    expect(domainColour(H, prefixes)).toBe(domainColour(H, [...prefixes, X]))
  })

  it("still colours a domain it doesn't know, the same each time", () => {
    expect(domainColour(Z, [])).toBe(domainColour(Z, [P]))
  })
})
