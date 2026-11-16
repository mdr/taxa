/** The object without its undefined fields: what JSON and query strings should carry. */
export const definedFields = <T extends object>(object: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(object as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as Partial<T>
