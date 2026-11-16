import { OpenAPIHono } from "@hono/zod-openapi"
import { z } from "zod"
import { ProblemType, type Problem } from "@taxa/shared/api/problem"
import type { AuthVariables } from "../auth/authenticate.ts"

export interface TaxaEnv {
  Variables: AuthVariables
}

export type TaxaApp = OpenAPIHono<TaxaEnv>

/** A router whose requests are validated against their schemas, answering a problem when they don't fit. */
export const taxaHono = (): TaxaApp =>
  new OpenAPIHono<TaxaEnv>({
    defaultHook: (result, context) => {
      if (result.success) return undefined
      const problem: Problem = { type: ProblemType.INVALID_REQUEST, message: z.prettifyError(result.error) }
      return context.json(problem, 400)
    }
  })
