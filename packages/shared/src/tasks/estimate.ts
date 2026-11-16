const ESTIMATE = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m?)?$/

/** Minutes from `30`, `30m`, `1h`, `1.5h` or `1h30m`; undefined if it's none of those. */
export const parseEstimate = (text: string): number | undefined => {
  const match = ESTIMATE.exec(text.trim().toLowerCase())
  if (!match || (match[1] === undefined && match[2] === undefined)) return undefined
  const minutes = Math.round(Number(match[1] ?? 0) * 60) + Number(match[2] ?? 0)
  return minutes > 0 ? minutes : undefined
}

/** `45m`, `2h`, `1h30m`. */
export const formatEstimate = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h${rest}m`
}
