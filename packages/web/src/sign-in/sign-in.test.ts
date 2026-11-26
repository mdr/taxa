import { describe, expect, it } from "vite-plus/test"
import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import { ProblemType } from "@taxa/shared/api/problem"
import { isSignedOut, signInHref, signInProblem } from "./sign-in.ts"

describe("signInHref", () => {
  it("comes back to the page, with its query but not the last try's outcome", () => {
    expect(signInHref("/tasks/H-7", "?sign-in=failed&tab=notes")).toBe(
      "/auth/sign-in?then=%2Ftasks%2FH-7%3Ftab%3Dnotes"
    )
    expect(signInHref("/", "")).toBe("/auth/sign-in?then=%2F")
  })
})

describe("signInProblem", () => {
  it("says why the last try didn't work, if it didn't", () => {
    expect(signInProblem("?sign-in=not-known")).toMatch(/doesn't know that account/)
    expect(signInProblem("?sign-in=failed")).toMatch(/didn't work/)
    expect(signInProblem("")).toBeUndefined()
  })
})

describe("isSignedOut", () => {
  it("is a 401 from the API, not any other problem", () => {
    expect(isSignedOut(new TaxaApiError(401, { type: ProblemType.UNAUTHENTICATED, message: "" }))).toBe(true)
    expect(isSignedOut(new TaxaApiError(403, { type: ProblemType.FORBIDDEN, message: "" }))).toBe(false)
    expect(isSignedOut(new Error("offline"))).toBe(false)
  })
})
