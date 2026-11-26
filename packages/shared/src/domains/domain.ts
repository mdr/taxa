import { z } from "zod"
import { DomainIdSchema } from "../ids.ts"
import { flavoured, type Version } from "../units.ts"

export const DOMAINS_PATH = "/api/domains"

/** One domain, by prefix or id. */
export const DOMAIN_PATH = `${DOMAINS_PATH}/{domain}`

/** 1–5 capital letters, unique across the installation: the `H` of `H-142`. */
export const PREFIX_PATTERN = /^[A-Z]{1,5}$/

const DomainPrefixSchema = z.string().regex(PREFIX_PATTERN, "1 to 5 letters").brand<"DomainPrefix">()
export type DomainPrefix = z.infer<typeof DomainPrefixSchema>
export const domainPrefix = (text: string): DomainPrefix => DomainPrefixSchema.parse(text)

/** How Inbox tasks' refs used to start, `IN-7`, so no domain may take it and make old refs confusing. */
const INBOX_PREFIX = domainPrefix("IN")

export const VersionSchema = flavoured<Version>(z.number().int())

export const DomainSchema = z.object({
  id: DomainIdSchema,
  name: z.string(),
  prefix: DomainPrefixSchema,
  createdAt: z.iso.datetime(),
  version: VersionSchema
})

export type Domain = z.infer<typeof DomainSchema>

export const CreateDomainRequestSchema = z.object({
  id: DomainIdSchema.optional(),
  name: z.string().trim().min(1).max(100),
  /** Any case: it's kept in capitals. */
  prefix: z
    .string()
    .transform((prefix) => prefix.toUpperCase())
    .pipe(DomainPrefixSchema)
    .refine((prefix) => prefix !== INBOX_PREFIX, `${INBOX_PREFIX} is taken: Inbox tasks used to start with it`)
})

export type CreateDomainRequest = z.input<typeof CreateDomainRequestSchema>
