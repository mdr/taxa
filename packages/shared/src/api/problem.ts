import { z } from "zod"

export enum ProblemType {
  INVALID_REQUEST = "INVALID_REQUEST",
  UNAUTHENTICATED = "UNAUTHENTICATED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  VERSION_CONFLICT = "VERSION_CONFLICT",
  PREFIX_TAKEN = "PREFIX_TAKEN",
  SESSION_OPEN = "SESSION_OPEN"
}

/** What the API answers when it can't do what was asked. */
export const ProblemSchema = z.object({
  type: z.enum(ProblemType),
  message: z.string(),
  /** For VERSION_CONFLICT: the record as it is now. */
  current: z.unknown().optional()
})

export type Problem = z.infer<typeof ProblemSchema>

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"
