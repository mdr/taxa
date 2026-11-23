import { Tag } from "lucide-react"
import { OptionList } from "../../ui/OptionList.tsx"
import { Popover, PopoverLook } from "../../ui/Popover.tsx"
import { tagFilterTestIds } from "./TagFilterTestIds.ts"

/** The choice of no tag: every task. */
const ANY_TAG = ""

/** Narrows the suggestions to the tasks with one tag, or lets them all back. */
export const TagFilter = ({
  tags,
  tag,
  onChoose
}: {
  tags: readonly string[]
  tag: string | undefined
  onChoose: (tag: string | undefined) => void
}) => (
  <Popover
    label="Only tasks with a tag"
    look={tag === undefined ? PopoverLook.EMPTY_CHIP : PopoverLook.CHIP}
    testId={tagFilterTestIds.filter}
    track="TagFilter.filter"
    value={tag ?? ANY_TAG}
    trigger={
      <>
        <Tag size={13} aria-hidden /> {tag ?? "Any tag"}
      </>
    }
    alignEnd
  >
    {(close) => (
      <OptionList
        track="TagFilter.filter"
        selected={tag ?? ANY_TAG}
        options={[{ value: ANY_TAG, label: "Any tag" }, ...tags.map((name) => ({ value: name, label: name }))]}
        onChoose={(choice) => {
          close()
          onChoose(choice === ANY_TAG ? undefined : choice)
        }}
      />
    )}
  </Popover>
)
