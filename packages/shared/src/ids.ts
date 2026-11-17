import { z } from "zod"
import type { Instant } from "./units.ts"

const hex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")

const COUNTER_MAX = 0xfff

// The last id's time and counter, so ids made in the same millisecond still sort in the order they were made.
let last = { at: -1, counter: 0 }

/**
 * A UUIDv7: the time in its first 48 bits, then a counter (RFC 9562's
 * method 1) so ids from one process sort in the order they were made, even
 * within a millisecond, then random bits. Clients make their own, so a task
 * created offline has its id at once.
 */
export const uuidv7 = (at: Instant, random: Uint8Array = crypto.getRandomValues(new Uint8Array(10))): string => {
  const counter = at === last.at ? Math.min(last.counter + 1, COUNTER_MAX) : 0
  last = { at, counter }
  const bytes = new Uint8Array(16)
  let time = at
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256
    time = Math.floor(time / 256)
  }
  bytes.set(random, 6)
  bytes[6] = 0x70 | (counter >> 8)
  bytes[7] = counter & 0xff
  bytes[8] = 0x80 | (bytes[8]! & 0x3f)
  const text = hex(bytes)
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`
}

/*
 * Identifiers, branded: each has a schema that checks it and brands it, and a
 * constructor that parses with that schema, so an id of one kind cannot be
 * passed where another is wanted, nor a plain string where any is. The wire
 * schemas use them, so parsed answers come out branded.
 */

export const UserIdSchema = z.uuid().brand<"UserId">()
export type UserId = z.infer<typeof UserIdSchema>
export const userId = (text: string): UserId => UserIdSchema.parse(text)

export const AgentIdSchema = z.uuid().brand<"AgentId">()
export type AgentId = z.infer<typeof AgentIdSchema>
export const agentId = (text: string): AgentId => AgentIdSchema.parse(text)

export const ApiKeyIdSchema = z.uuid().brand<"ApiKeyId">()
export type ApiKeyId = z.infer<typeof ApiKeyIdSchema>
export const apiKeyId = (text: string): ApiKeyId => ApiKeyIdSchema.parse(text)

export const DomainIdSchema = z.uuid().brand<"DomainId">()
export type DomainId = z.infer<typeof DomainIdSchema>
export const domainId = (text: string): DomainId => DomainIdSchema.parse(text)

export const TaskIdSchema = z.uuid().brand<"TaskId">()
export type TaskId = z.infer<typeof TaskIdSchema>
export const taskId = (text: string): TaskId => TaskIdSchema.parse(text)
