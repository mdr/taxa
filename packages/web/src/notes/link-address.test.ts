import { describe, expect, it } from "vite-plus/test"
import { isWebAddress, linkAddress } from "./link-address.ts"

describe("linkAddress", () => {
  it("keeps a full web address as it is", () => {
    expect(linkAddress(" https://example.com/a?b=1 ")).toBe("https://example.com/a?b=1")
    expect(linkAddress("http://localhost:5173")).toBe("http://localhost:5173")
  })

  it("assumes https for an address without one, and mail for an email address", () => {
    expect(linkAddress("example.com/docs")).toBe("https://example.com/docs")
    expect(linkAddress("jo@example.com")).toBe("mailto:jo@example.com")
    expect(linkAddress("tel:+441234567890")).toBe("tel:+441234567890")
  })

  it("keeps a link that opens a file in VS Code", () => {
    expect(linkAddress("vscode://file/Users/matt/repos/letter.md")).toBe("vscode://file/Users/matt/repos/letter.md")
  })

  it("refuses nothing, spaces, and addresses that would run something", () => {
    expect(linkAddress("  ")).toBeUndefined()
    expect(linkAddress("not a link")).toBeUndefined()
    expect(linkAddress("javascript:alert(1)")).toBeUndefined()
    expect(linkAddress("data:text/html,hi")).toBeUndefined()
    expect(linkAddress("file:///Users/matt/letter.md")).toBeUndefined()
  })
})

describe("isWebAddress", () => {
  it("tells web pages from apps", () => {
    expect(isWebAddress("https://example.com")).toBe(true)
    expect(isWebAddress("HTTP://example.com")).toBe(true)
    expect(isWebAddress("vscode://file/Users/matt/letter.md")).toBe(false)
    expect(isWebAddress("mailto:jo@example.com")).toBe(false)
  })
})
