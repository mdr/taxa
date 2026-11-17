/**
 * Flavours: a plain value is accepted where one is wanted, and arithmetic and
 * comparison need no wrapping, but a value of one flavour cannot be passed
 * where another is wanted. For quantities and values often written by hand;
 * identifiers are branded instead (`ids.ts`).
 */
import type { z } from "zod"

declare const flavour: unique symbol

export type Flavour<T, Name extends string> = T & { readonly [flavour]?: Name }

/** A schema whose output is the flavoured type; the check is the schema's own. */
export const flavoured = <Flavoured>(schema: z.ZodType): z.ZodType<Flavoured, Flavoured> =>
  schema as z.ZodType<Flavoured, Flavoured>

/** Milliseconds since the Unix epoch, in UTC. */
export type Instant = Flavour<number, "Instant">

/** A length of time in milliseconds. */
export type Ms = Flavour<number, "Ms">

/** A length of time in whole minutes, as estimates are given. */
export type Minutes = Flavour<number, "Minutes">

/** A record's version: one more with each change, sent back as If-Match. */
export type Version = Flavour<number, "Version">

/** A task's number, unique across the installation: the `142` of `H-142`. */
export type TaskNumber = Flavour<number, "TaskNumber">

/** An activity's place in the log of every change. */
export type ActivitySequence = Flavour<number, "ActivitySequence">
