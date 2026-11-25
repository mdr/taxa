import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { ChecklistChangeType, type ChecklistItem, type ChecklistRequest } from "@taxa/shared/tasks/checklist"
import type { Version } from "@taxa/shared/units"
import { useCallback, useState } from "react"
import styles from "./Checklist.module.css"
import { checklistTestIds } from "./ChecklistTestIds.ts"
import { ChecklistItemRow } from "./ChecklistItemRow.tsx"

export interface ShownItem {
  item: ChecklistItem
  /** As shown: ticked here and now, though the server's still to say so. */
  done: boolean
}

/** An order moved to here, shown until the task as the server has it moves on from the version it was moved from. */
interface Moved {
  from: Version
  ids: readonly string[]
}

/**
 * A checklist's items, in order: each dragged by its grip to another place,
 * with a mouse, a finger or the keyboard, and in its new place at once.
 */
export const ChecklistItems = ({
  items,
  version,
  change
}: {
  items: readonly ShownItem[]
  version: Version
  change: (request: ChecklistRequest) => void
}) => {
  const [moved, setMoved] = useState<Moved | undefined>(undefined)
  const [announcer, setAnnouncer] = useState<HTMLElement | undefined>(undefined)
  // oxlint-disable-next-line eslint-js/no-restricted-syntax -- React gives a ref null when the element goes
  const announceIn = useCallback((node: HTMLElement | null) => setAnnouncer(node ?? undefined), [])
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const ids: readonly string[] = moved?.from === version ? moved.ids : items.map(({ item }) => item.id)
  const byId = new Map(items.map((shown) => [shown.item.id as string, shown]))
  const shown = ids.flatMap((id) => byId.get(id) ?? [])
  const textOf = (id: UniqueIdentifier): string => `“${byId.get(String(id))?.item.text ?? "the item"}”`
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${textOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${textOf(active.id)} is at ${textOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${textOf(active.id)} dropped at ${textOf(over.id)}.` : `${textOf(active.id)} put back.`,
    onDragCancel: ({ active }) => `${textOf(active.id)} put back.`
  }
  const dropped = ({ active, over }: DragEndEvent): void => {
    const at = over ? ids.indexOf(String(over.id)) : -1
    const was = ids.indexOf(String(active.id))
    if (at < 0 || at === was) return
    const order = arrayMove([...ids], was, at)
    setMoved({ from: version, ids: order })
    const item = byId.get(String(active.id))!.item
    const after = order[at - 1]
    change({
      type: ChecklistChangeType.MOVE,
      item: item.id,
      ...(after !== undefined && { after: byId.get(after)!.item.id })
    })
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={dropped}
      accessibility={{
        container: announcer,
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move an item, press space or enter to pick it up, the arrow keys to move it, and space or enter again to put it down, or escape to put it back."
        }
      }}
    >
      <SortableContext items={[...ids]} strategy={verticalListSortingStrategy}>
        <ul className={styles.items}>
          {shown.map(({ item, done }) => (
            <ChecklistItemRow key={item.id} item={item} done={done} change={change} />
          ))}
        </ul>
      </SortableContext>
      <div ref={announceIn} data-testid={checklistTestIds.announcer} />
    </DndContext>
  )
}
