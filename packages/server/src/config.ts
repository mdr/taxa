import { z } from "zod"
import { isTimeZone } from "@taxa/shared/dates/plain-date"

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().default(8787),
  DATABASE_URL: z.string(),
  TAXA_BUILD: z.string().default("dev"),
  /** Development only: no sign-in, and everyone is the person of this name. */
  TAXA_DEV_USER: z.string().optional(),
  /** The development login's time zone, when they are first made. */
  TAXA_TIME_ZONE: z.string().refine(isTimeZone, "an IANA time zone, such as Europe/London").default("Europe/London")
})

export type Config = z.infer<typeof ConfigSchema>

export const configFrom = (environment: Record<string, string | undefined>): Config => ConfigSchema.parse(environment)
