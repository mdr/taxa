import { AttentionBox } from "./AttentionBox.tsx"
import { todayAttentionTestIds } from "./TodayAttentionTestIds.ts"
import { needingAttention } from "./attention.ts"
import { useTasks } from "../tasks/task-queries.ts"
import { PLAN_TODAY_PATH } from "../tasks/when/when-paths.ts"

/** Below Today: what isn't planned for it but might want to be, to bring in with a click. */
export const TodayAttention = () => {
  const needing = needingAttention(useTasks({}).data ?? [])
  return (
    <AttentionBox
      heading="Might want attention"
      items={needing}
      most={3}
      more={{ href: PLAN_TODAY_PATH, text: `Review all ${needing.length}` }}
      testIds={todayAttentionTestIds}
      track="TodayAttention.add"
    />
  )
}
