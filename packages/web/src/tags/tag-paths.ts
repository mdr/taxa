/** A tag's list of tasks. */
export const tagPath = (name: string): string => `/tags/${encodeURIComponent(name)}`

/** The tag named in an address, as typed. */
export const tagFromPath = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
