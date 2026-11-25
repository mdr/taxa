import { browserTimeZone } from "../dates/browser-time-zone.ts"
import { TaxaClient } from "@taxa/shared/api/taxa-client"
import { apiBase } from "./api-base.ts"

/** The page signs in as the development login, so it sends no API key. */
export const taxaApi = new TaxaClient({ baseUrl: apiBase(), timeZone: browserTimeZone })
