import { z } from "zod"
import type { Ms } from "../units.ts"

export const BIN_PATH = "/api/bin"

/** How many days a deleted task stays in the bin before it's deleted for good. */
export const BIN_KEEPS_DAYS = 30

export const BIN_KEEPS_MS: Ms = BIN_KEEPS_DAYS * 24 * 60 * 60 * 1000

/** How many tasks were deleted for good. */
export const PurgedSchema = z.object({ purged: z.number().int().nonnegative() })
