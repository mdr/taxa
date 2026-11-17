import { createContext, useContext, useSyncExternalStore, type Context } from "react"
import type { AbstractService } from "./abstract-service.ts"

/** A context for a service, empty until a provider gives it one. */
export const createServiceContext = <Service>(): Context<Service | undefined> =>
  createContext<Service | undefined>(undefined)

export const useService = <Service>(context: Context<Service | undefined>): Service => {
  const service = useContext(context)
  if (!service) throw new Error("No service here: render this inside its service's provider.")
  return service
}

/**
 * One value from a service's state, re-rendering only when that value
 * changes. The selector must pick a value out of the state, not build a new
 * one, or React would see a change on every read: that's checked here.
 */
export const useServiceState = <State, Selected>(
  service: AbstractService<State>,
  select: (state: State) => Selected
): Selected =>
  useSyncExternalStore(service.subscribe, () => {
    const selected = select(service.state)
    if (!Object.is(selected, select(service.state))) {
      throw new Error("A service state selector built a new value: select a field, or a value from one, instead.")
    }
    return selected
  })
