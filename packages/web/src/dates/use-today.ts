import { realClock } from "@taxa/shared/clock"
import { dateIn, type IsoDate } from "@taxa/shared/dates/plain-date"

/** Today's date where the browser is. */
export const useToday = (): IsoDate => dateIn(Intl.DateTimeFormat().resolvedOptions().timeZone, realClock.now())
