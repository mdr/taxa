import type { Task } from "@taxa/shared/tasks/task"
import { FolderCheck } from "lucide-react"
import styles from "./FileButton.module.css"

/** In the Inbox: files a task, once it's sorted out, out of the Inbox. */
export const FileButton = ({
  task,
  testId,
  track,
  onFile
}: {
  task: Task
  testId: string
  track: string
  onFile: () => void
}) => (
  <button
    type="button"
    className={styles.file}
    onClick={onFile}
    aria-label={`File ${task.title}: sorted out, out of the Inbox`}
    title="Sorted out: out of the Inbox (V)"
    data-testid={testId}
    data-track={track}
  >
    <FolderCheck size={14} aria-hidden />
    File
  </button>
)
