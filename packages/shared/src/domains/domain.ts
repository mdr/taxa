import { z } from "zod"

export const DOMAINS_PATH = "/api/domains"

/** 1–5 capital letters, unique across the installation: the `H` of `H-142`. */
export const PREFIX_PATTERN = /^[A-Z]{1,5}$/

const PrefixSchema = z
  .string()
  .transform((prefix) => prefix.toUpperCase())
  .refine((prefix) => PREFIX_PATTERN.test(prefix), "1 to 5 letters")

export const DomainSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string(),
  createdAt: z.iso.datetime(),
  version: z.number().int()
})

export type Domain = z.infer<typeof DomainSchema>

export const CreateDomainRequestSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(100),
  prefix: PrefixSchema
})

export type CreateDomainRequest = z.input<typeof CreateDomainRequestSchema>
