import type { Task } from "@taxa/shared/tasks/task"
import { Copy, Ellipsis, RotateCcw, Trash2 } from "lucide-react"
import { taskMenuTestIds } from "./TaskMenuTestIds.ts"
import { OptionList } from "../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../ui/Popover.tsx"
import { TaskChangeType, type TaskChange } from "../use-task-changes.ts"

enum MenuAction {
  COPY_REF = "COPY_REF",
  DELETE = "DELETE",
  RESTORE = "RESTORE"
}

/** Less frequent things to do with a task, behind ⋯. */
export const TaskMenu = ({ task, change }: { task: Task; change: (change: TaskChange) => void }) => (
  <Popover
    label="More actions"
    look={PopoverLook.ICON}
    testId={taskMenuTestIds.open}
    trigger={<Ellipsis size={18} aria-hidden />}
    alignEnd
  >
    {(close) => (
      <OptionList
        options={[
          { value: MenuAction.COPY_REF, label: `Copy ${task.ref}`, icon: <Copy size={15} aria-hidden /> },
          task.deletedAt
            ? { value: MenuAction.RESTORE, label: "Restore task", icon: <RotateCcw size={15} aria-hidden /> }
            : { value: MenuAction.DELETE, label: "Delete task", icon: <Trash2 size={15} aria-hidden />, danger: true }
        ]}
        onChoose={(action) => {
          close()
          const actions: Record<MenuAction, () => void> = {
            [MenuAction.COPY_REF]: () => void navigator.clipboard.writeText(task.ref),
            [MenuAction.DELETE]: () => change({ type: TaskChangeType.DELETE }),
            [MenuAction.RESTORE]: () => change({ type: TaskChangeType.RESTORE })
          }
          actions[action as MenuAction]()
        }}
      />
    )}
  </Popover>
)
