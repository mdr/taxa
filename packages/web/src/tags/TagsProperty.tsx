import type { Task } from "@taxa/shared/tasks/task"
import { Tag } from "lucide-react"
import styles from "./Tags.module.css"
import { tagsPropertyTestIds } from "./TagsPropertyTestIds.ts"
import { TagChip } from "./TagChip.tsx"
import { TagPicker } from "./TagPicker.tsx"
import { Popover, PopoverLook } from "../ui/Popover.tsx"
import { TaskChangeType, type TaskChange } from "../tasks/changes/task-changes-service.ts"

/** A task's tags, each with a way to take it off, and a way to add more. */
export const TagsProperty = ({ task, change }: { task: Task; change: (change: TaskChange) => void }) => (
  <span className={styles.property} data-testid={tagsPropertyTestIds.tags}>
    {task.tags.map((name) => (
      <TagChip
        key={name}
        name={name}
        onRemove={() => change({ type: TaskChangeType.UPDATE, request: { removeTags: [name] } })}
      />
    ))}
    <Popover
      label="Add a tag"
      look={PopoverLook.EMPTY_CHIP}
      testId={tagsPropertyTestIds.add}
      track="TagsProperty.add"
      shortcut={{ key: "l", description: "Add a tag" }}
      trigger={
        <>
          <Tag size={15} aria-hidden /> Tag
        </>
      }
    >
      {() => (
        <TagPicker
          has={task.tags}
          onPick={(name) => change({ type: TaskChangeType.UPDATE, request: { addTags: [name] } })}
        />
      )}
    </Popover>
  </span>
)
