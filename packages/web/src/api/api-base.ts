/**
 * Where the API is: the page's own origin, unless the browser tests point the
 * page at their in-process server by setting TAXA_API_BASE before it loads.
 */
export const apiBase = (): string => (globalThis as { TAXA_API_BASE?: string }).TAXA_API_BASE ?? ""
