import { z } from "zod"

export const HEALTH_PATH = "/api/health"

export enum HealthStatus {
  OK = "OK",
  DATABASE_DOWN = "DATABASE_DOWN"
}

export const HealthSchema = z.object({
  status: z.enum(HealthStatus),
  /** The commit the server was built from. */
  build: z.string()
})

export type Health = z.infer<typeof HealthSchema>
