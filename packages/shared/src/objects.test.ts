import { describe, expect, it } from "vite-plus/test"
import { definedFields } from "./objects.ts"

describe("definedFields", () => {
  it("drops undefined fields and keeps falsy ones", () => {
    expect(definedFields({ a: 1, b: undefined, c: "", d: false, e: 0 })).toEqual({ a: 1, c: "", d: false, e: 0 })
  })
})
