import { describe, expect, it } from "vite-plus/test"
import { domainPrefix } from "../domains/domain.ts"
import { formatTaskRef, parseTaskLookup } from "./task-ref.ts"

describe("task refs", () => {
  it("are formatted prefix-number", () => {
    expect(formatTaskRef(domainPrefix("H"), 142)).toBe("H-142")
  })

  it.each(["H-142", "h-142", "WORK-142", "142", " 142 "])("read %j as task 142", (text) => {
    expect(parseTaskLookup(text)).toEqual({ type: "NUMBER", number: 142 })
  })

  it("read a UUID as an id", () => {
    expect(parseTaskLookup("0190A1B2-C3D4-7E5F-8A9B-0C1D2E3F4A5B")).toEqual({
      type: "ID",
      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b"
    })
  })

  it.each(["", "H-", "-142", "TOOLONG-1", "H-0", "H-1.5", "H142", "99999999999999999999"])("reject %j", (text) => {
    expect(parseTaskLookup(text)).toBeUndefined()
  })
})
