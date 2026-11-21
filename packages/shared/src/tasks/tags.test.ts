import { describe, expect, it } from "vite-plus/test"
import { hasTag, TagSchema, withoutTags, withTagRenamed, withTags } from "./tags.ts"

describe("tags", () => {
  it("keep spaces and capitals, tidying the ends and any leading #", () => {
    expect(TagSchema.parse("  Life   Admin ")).toBe("Life Admin")
    expect(TagSchema.parse("#life-admin")).toBe("life-admin")
    expect(TagSchema.safeParse("#").success).toBe(false)
    expect(TagSchema.safeParse("a,b").success).toBe(false)
  })

  it("are the same whatever their case, but not with a hyphen for a space", () => {
    expect(hasTag(["Life Admin"], "life admin")).toBe(true)
    expect(hasTag(["Life Admin"], "life-admin")).toBe(false)
  })

  it("are renamed where they stand, once", () => {
    expect(withTagRenamed(["car", "life admin", "errand"], "Life Admin", "Admin")).toEqual(["car", "Admin", "errand"])
    expect(withTagRenamed(["admin", "life admin"], "life admin", "Admin")).toEqual(["admin"])
  })

  it("are added once and taken out in any case", () => {
    expect(withTags(["car"], ["Life Admin", "CAR", "life admin"])).toEqual(["car", "Life Admin"])
    expect(withoutTags(["car", "Life Admin"], ["LIFE ADMIN"])).toEqual(["car"])
  })
})
