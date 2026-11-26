import { TaskStatus, type Task } from "@taxa/shared/tasks/task"
import type { Style } from "./style.ts"
import { mark } from "./task-groups.ts"
import { taskUrl } from "./task-url.ts"

const VERB_COLOUR: Record<TaskStatus, keyof Pick<Style, "green" | "amber" | "violet" | "dim" | "bold">> = {
  [TaskStatus.DONE]: "green",
  [TaskStatus.IN_PROGRESS]: "amber",
  [TaskStatus.WAITING]: "violet",
  [TaskStatus.CANCELLED]: "dim",
  [TaskStatus.OPEN]: "bold"
}

/**
 * What a change did, said in a line: "Done: P-48  Consider Christmas lights".
 * Styled, the task's mark leads and the verb takes its status's colour, the
 * ref a link to it; `extra` follows the ref, as for a repeating task's next date.
 */
export const confirmation = (
  verb: string,
  task: Task,
  { style, web, extra = "" }: { style: Style; web: string; extra?: string }
): string => {
  if (!style.styled) return `${verb} ${task.ref}${extra}  ${task.title}`
  const said = style[VERB_COLOUR[task.status]](verb.replace(/:$/, ""))
  const ref = style.link(taskUrl(web, task.ref), style.dim(task.ref))
  return `${mark(task, style)} ${said} ${ref}${style.dim(extra)}  ${task.title}`
}
