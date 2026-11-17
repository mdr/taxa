import { realClock } from "@taxa/shared/clock"
import { browserTimeZone } from "./browser-time-zone.ts"
import { dateIn, type IsoDate } from "@taxa/shared/dates/plain-date"

/** Today's date where the browser is. */
export const useToday = (): IsoDate => dateIn(browserTimeZone(), realClock.now())
