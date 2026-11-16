import { z } from "zod"

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().default(8787),
  DATABASE_URL: z.string(),
  TAXA_BUILD: z.string().default("dev")
})

export type Config = z.infer<typeof ConfigSchema>

export const configFrom = (environment: Record<string, string | undefined>): Config => ConfigSchema.parse(environment)
