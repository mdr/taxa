import { describe, expect, it } from "vite-plus/test"
import { checklistProgress, itemsFromText, progressText } from "./checklist.ts"

describe("itemsFromText", () => {
  it("makes an item of each line, without blank lines or list markers", () => {
    expect(itemsFromText("Oxfam\n\n- Shelter\n* [ ] RSPB\n2. [x] Crisis\r\n  Médecins Sans Frontières  ")).toEqual([
      "Oxfam",
      "Shelter",
      "RSPB",
      "Crisis",
      "Médecins Sans Frontières"
    ])
  })
})

describe("checklistProgress", () => {
  it("counts the items ticked", () => {
    const progress = checklistProgress([{ done: true }, { done: false }, { done: true }])
    expect(progress).toEqual({ done: 2, total: 3 })
    expect(progressText(progress)).toBe("2/3")
  })
})
