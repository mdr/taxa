import { expect } from "vite-plus/test"
import { TaxaApiError } from "@taxa/shared/api/taxa-client"
import type { ProblemType, Problem } from "@taxa/shared/api/problem"

/** The call fails with a problem of this type; the problem, for more checks. */
export const expectProblem = async (call: Promise<unknown>, type: ProblemType): Promise<Problem> => {
  const error: unknown = await call.then(
    () => undefined,
    (thrown: unknown) => thrown
  )
  expect(error, `a ${type} problem`).toBeInstanceOf(TaxaApiError)
  const { problem } = error as TaxaApiError
  expect(problem.type).toBe(type)
  return problem
}
