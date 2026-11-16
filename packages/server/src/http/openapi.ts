import { z } from "@hono/zod-openapi"
import { ProblemSchema } from "@taxa/shared/api/problem"

interface JsonContent<T extends z.ZodType> {
  content: { "application/json": { schema: T } }
  description: string
}

export const json = <T extends z.ZodType>(schema: T, description: string): JsonContent<T> => ({
  content: { "application/json": { schema } },
  description
})

export const jsonBody = <T extends z.ZodType>(
  schema: T
): { body: { content: { "application/json": { schema: T } }; required: true } } => ({
  body: { content: { "application/json": { schema } }, required: true }
})

/** What any authenticated route may answer besides success. */
export const PROBLEMS = {
  400: json(ProblemSchema, "The request isn't valid"),
  401: json(ProblemSchema, "No valid API key or sign-in"),
  404: json(ProblemSchema, "Not found, or not yours to see"),
  409: json(ProblemSchema, "A version conflict, or a clash such as a prefix in use")
}

export const BEARER = [{ bearer: [] }]

export const listOf = <T extends z.ZodType>(item: T): z.ZodObject<{ items: z.ZodArray<T> }> =>
  z.object({ items: z.array(item) })

export const IfMatchHeaderSchema = z.object({
  "if-match": z.string().optional().openapi({
    description: 'The version you last saw, e.g. "3": the change is refused if the task has changed since.'
  })
})
