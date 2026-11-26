import { z } from "zod"
import { timeZone, TimeZoneSchema } from "@taxa/shared/dates/plain-date"

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().default(8787),
  /** The address to listen on: every interface if unset. */
  HOST: z.string().optional(),
  DATABASE_URL: z.string(),
  TAXA_BUILD: z.string().default("dev"),
  /** The built web app's folder, to serve beside the API; in development the web app's own server does. */
  TAXA_WEB_ROOT: z.string().optional(),
  /** Development only: no sign-in, and everyone is the person of this name. */
  TAXA_DEV_USER: z.string().optional(),
  /** The development login's time zone, and that of people first made to sign in. */
  TAXA_TIME_ZONE: TimeZoneSchema.default(timeZone("Europe/London")),
  /** Where people reach Taxa, such as https://taxa.example.com: sign-in sends them back here. */
  TAXA_PUBLIC_URL: z.url().optional(),
  /** The OpenID Connect provider people sign in with. */
  TAXA_OIDC_ISSUER: z.url().default("https://accounts.google.com"),
  /** Taxa's client at that provider: set to turn sign-in on. */
  TAXA_OIDC_CLIENT_ID: z.string().min(1).optional(),
  TAXA_OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  /** A file holding the client secret instead, such as a systemd credential. */
  TAXA_OIDC_CLIENT_SECRET_FILE: z.string().min(1).optional(),
  /** Who may sign in, by the email their provider vouches for: "Sam <sam@example.com>, Alex <alex@example.com>". */
  TAXA_PEOPLE: z.string().optional()
})

export type Config = z.infer<typeof ConfigSchema>

export const configFrom = (environment: Record<string, string | undefined>): Config => ConfigSchema.parse(environment)
