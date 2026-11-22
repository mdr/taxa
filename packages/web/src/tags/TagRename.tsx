import { useState, type SubmitEvent } from "react"
import { useLocation } from "wouter"
import styles from "./Tags.module.css"
import { tagRenameTestIds } from "./TagRenameTestIds.ts"
import { tagPath } from "./tag-paths.ts"
import { useRenameTag } from "./tag-queries.ts"
import { problemMessage } from "../api/problem-message.ts"
import { Popover, PopoverLook } from "../ui/Popover.tsx"
import { appAnalytics } from "../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"

const RenameForm = ({ name, close }: { name: string; close: () => void }) => {
  const [to, setTo] = useState(name)
  const rename = useRenameTag()
  const [, navigate] = useLocation()
  const submit = (event: SubmitEvent): void => {
    event.preventDefault()
    if (to.trim() === "" || to.trim() === name) return close()
    rename.mutate(
      { from: name, to },
      {
        onSuccess: ({ renamed }) => {
          appAnalytics.track(ANALYTICS_CODES.tag.renamed, `renamed a tag on ${renamed} tasks`, { renamed })
          close()
          navigate(tagPath(to.trim().replace(/\s+/g, " ")), { replace: true })
        }
      }
    )
  }
  return (
    <form className={styles.picker} onSubmit={submit}>
      <input
        className={styles.pickerInput}
        value={to}
        onChange={(event) => setTo(event.target.value)}
        aria-label="New name"
        data-testid={tagRenameTestIds.input}
        data-track="TagRename.input"
      />
      <p className={styles.none}>Renames it on every task you can see.</p>
      {rename.isError && (
        <p className={styles.problem} role="alert">
          {problemMessage(rename.error)}
        </p>
      )}
    </form>
  )
}

/** Renames a tag everywhere it's used. */
export const TagRename = ({ name }: { name: string }) => (
  <Popover
    label="Rename the tag"
    look={PopoverLook.EMPTY_CHIP}
    testId={tagRenameTestIds.open}
    track="TagRename.open"
    trigger="Rename"
    alignEnd
  >
    {(close) => <RenameForm name={name} close={close} />}
  </Popover>
)
