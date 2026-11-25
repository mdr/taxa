import { checklistProgress, progressText, type ChecklistItem } from "@taxa/shared/tasks/checklist"

/** `3. [x] Oxfam`, numbered as `taxa check` takes them, with the task an item was made into. */
const checklistLines = (checklist: readonly ChecklistItem[]): string[] => {
  const width = String(checklist.length).length
  return checklist.map(
    ({ text, done, task }, index) =>
      `${String(index + 1).padStart(width)}. [${done ? "x" : " "}] ${text}${task ? `  (${task.ref})` : ""}`
  )
}

/** A task's checklist, with how far through it is. */
export const checklistText = (ref: string, checklist: readonly ChecklistItem[]): string =>
  checklist.length === 0
    ? `${ref} has no checklist: taxa add-item ${ref} <text> starts one.`
    : [`Checklist  ${progressText(checklistProgress(checklist))}`, ...checklistLines(checklist)].join("\n")
