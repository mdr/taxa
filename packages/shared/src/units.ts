/** Milliseconds since the Unix epoch, in UTC. */
export type Instant = number & { readonly __flavour?: "Instant" }

/** A length of time in milliseconds. */
export type Ms = number & { readonly __flavour?: "Ms" }
