import { realClock } from "@taxa/shared/clock"
import type { Instant } from "@taxa/shared/units"
import { useEffect, useState } from "react"

/** The time now, kept up to the second while `ticking`. */
export const useNow = (ticking = true): Instant => {
  const [now, setNow] = useState(() => realClock.now())
  useEffect(() => {
    if (!ticking) return undefined
    const timer = setInterval(() => setNow(realClock.now()), 1000)
    return () => clearInterval(timer)
  }, [ticking])
  return ticking ? now : realClock.now()
}
