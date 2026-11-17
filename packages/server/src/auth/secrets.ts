import { ApiKeySecretSchema, type ApiKeySecret } from "@taxa/shared/identity/agent"
import { createHash, randomBytes } from "node:crypto"

const SECRET_PREFIX = "taxa_"
/** How much of a secret is kept in the clear, to tell keys apart. */
const SHOWN_LENGTH = 12

export const newSecret = (): ApiKeySecret =>
  ApiKeySecretSchema.parse(`${SECRET_PREFIX}${randomBytes(32).toString("base64url")}`)

/** Keys are stored only as this hash. */
export const hashSecret = (secret: string): string => createHash("sha256").update(secret).digest("hex")

export const shownPartOf = (secret: string): string => secret.slice(0, SHOWN_LENGTH)
