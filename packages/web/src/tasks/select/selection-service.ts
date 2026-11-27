import type { TaskId } from "@taxa/shared/ids"
import { AbstractService } from "../../services/abstract-service.ts"
import { createServiceContext, useService, useServiceState } from "../../services/service-hooks.ts"

export interface SelectionState {
  /** Choosing tasks to change together: rows show a box to select them by, in place of their tick. */
  selecting: boolean
  /** In the order they were chosen. */
  selected: readonly TaskId[]
  /** The last one clicked, from which a shift-click selects the tasks between. */
  anchor: TaskId | undefined
}

const NONE: SelectionState = { selecting: false, selected: [], anchor: undefined }

/**
 * The tasks chosen on a list to change together. `listed` is the list as
 * shown, in order, for selecting a run of them and selecting all.
 */
export class SelectionService extends AbstractService<SelectionState> {
  readonly #listed: () => readonly TaskId[]

  constructor(listed: () => readonly TaskId[]) {
    super(NONE)
    this.#listed = listed
  }

  readonly start = (): void => this.setState({ selecting: true })

  /** Stops selecting, letting go of what was chosen. */
  readonly stop = (): void => this.setState(NONE)

  /** Selects a task, or unselects it: starting to select, if not already. */
  readonly toggle = (id: TaskId): void => {
    const { selected } = this.state
    this.setState({
      selecting: true,
      selected: selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id],
      anchor: id
    })
  }

  /** Selects the tasks from the last one clicked to this one, as listed, as shift-click does. */
  readonly extend = (id: TaskId): void => {
    const listed = this.#listed()
    const from = this.state.anchor === undefined ? -1 : listed.indexOf(this.state.anchor)
    const to = listed.indexOf(id)
    if (from < 0 || to < 0) {
      this.toggle(id)
      return
    }
    const run = listed.slice(Math.min(from, to), Math.max(from, to) + 1)
    const selected = [...this.state.selected, ...run.filter((other) => !this.state.selected.includes(other))]
    this.setState({ selecting: true, selected, anchor: id })
  }

  /** Selects every task listed, or none if they all are. */
  readonly toggleAll = (): void => {
    const listed = this.#listed()
    const all = listed.every((id) => this.state.selected.includes(id))
    this.setState({ selecting: true, selected: all ? [] : [...listed], anchor: undefined })
  }

  /** Those selected that are still listed, as listed, once something's changed what the list shows. */
  readonly chosen = (): TaskId[] => this.#listed().filter((id) => this.state.selected.includes(id))
}

export const SelectionContext = createServiceContext<SelectionService>()

export const useSelection = (): SelectionService => useService(SelectionContext)

export const useSelecting = (): boolean => useServiceState(useSelection(), ({ selecting }) => selecting)

export const useSelected = (id: TaskId): boolean =>
  useServiceState(useSelection(), ({ selected }) => selected.includes(id))

/** How many are selected and still listed. */
export const useSelectedCount = (): number => {
  const selection = useSelection()
  return useServiceState(selection, () => selection.chosen().length)
}
