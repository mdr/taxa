import { z } from "zod"

export const TAGS_PATH = "/api/tags"

/** The most tags a task can have. */
export const MAX_TAGS = 20

/**
 * A label, as typed: any words, spaces and capitals kept, so `Life Admin`
 * and `life-admin` both work (as two different tags). Spaces at the ends
 * and runs of them are tidied, and a leading `#` is dropped.
 */
export const TagSchema = z
  .string()
  .transform((text) => text.replace(/^#+/, "").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "A tag needs a name.")
      .max(50, "A tag can be at most 50 characters.")
      .regex(/^[^,]*$/, "A tag can't have a comma in it.")
  )

/** Whether two tags are the same, whatever their case: `Life Admin` is `life admin`. */
export const sameTag = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/** Whether a task's tags include one. */
export const hasTag = (tags: readonly string[], tag: string): boolean => tags.some((each) => sameTag(each, tag))

/** Tags with these added after them, leaving out any already there in another case. */
export const withTags = (tags: readonly string[], added: readonly string[]): string[] =>
  added.reduce<string[]>((all, tag) => (hasTag(all, tag) ? all : [...all, tag]), [...tags])

/** Tags with these taken out, in any case. */
export const withoutTags = (tags: readonly string[], removed: readonly string[]): string[] =>
  tags.filter((tag) => !hasTag(removed, tag))

/** A tag in use, and how many tasks still to do have it. */
export const TagSummarySchema = z.object({
  name: z.string(),
  openCount: z.number().int()
})

export type TagSummary = z.infer<typeof TagSummarySchema>

export const RenameTagRequestSchema = z.object({ from: TagSchema, to: TagSchema })

export type RenameTagRequest = z.input<typeof RenameTagRequestSchema>

/** Tags with one renamed where it stands, in any case; if the new name is there already, once. */
export const withTagRenamed = (tags: readonly string[], from: string, to: string): string[] =>
  withTags(
    [],
    tags.map((tag) => (sameTag(tag, from) ? to : tag))
  )
