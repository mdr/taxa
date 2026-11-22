import { suggestPrefix } from "@taxa/shared/domains/prefix-suggestion"
import { useState, type SubmitEvent } from "react"
import styles from "./NewDomainForm.module.css"
import { newDomainFormTestIds } from "./NewDomainFormTestIds.ts"
import { problemMessage } from "../api/problem-message.ts"
import { useCreateDomain, useDomains } from "./domain-queries.ts"
import { appAnalytics } from "../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"

/** "+ New domain", opening into a small form. */
export const NewDomainForm = () => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [prefix, setPrefix] = useState("")
  const [prefixEdited, setPrefixEdited] = useState(false)
  const create = useCreateDomain()
  const domains = useDomains()
  const rename = (newName: string) => {
    setName(newName)
    if (!prefixEdited) setPrefix(suggestPrefix(newName, new Set(domains.data?.map((domain) => domain.prefix))))
  }
  const close = () => {
    setOpen(false)
    setName("")
    setPrefix("")
    setPrefixEdited(false)
    create.reset()
  }
  if (!open) {
    return (
      <button
        type="button"
        className={styles.open}
        onClick={() => setOpen(true)}
        data-testid={newDomainFormTestIds.open}
        data-track="NewDomainForm.open"
      >
        + New domain
      </button>
    )
  }
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    create.mutate(
      { name: name.trim(), prefix: prefix.trim() },
      {
        onSuccess: (domain) => {
          appAnalytics.track(ANALYTICS_CODES.domain.created, `created domain ${domain.prefix}`, {
            domainId: domain.id,
            prefix: domain.prefix
          })
          close()
        }
      }
    )
  }
  return (
    <form className={styles.form} onSubmit={submit} aria-label="New domain">
      <label className={styles.field}>
        Name
        <input
          value={name}
          onChange={(event) => rename(event.target.value)}
          required
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- it opens because you asked to type in it.
          autoFocus
          data-testid={newDomainFormTestIds.name}
          data-track="NewDomainForm.name"
        />
      </label>
      <label className={styles.field}>
        Prefix
        <input
          value={prefix}
          onChange={(event) => {
            setPrefix(event.target.value.toUpperCase())
            setPrefixEdited(true)
          }}
          required
          maxLength={5}
          pattern="[A-Za-z]{1,5}"
          title="1 to 5 letters, such as H for Home"
          className={styles.prefix}
          data-testid={newDomainFormTestIds.prefix}
          data-track="NewDomainForm.prefix"
        />
      </label>
      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.add}
          disabled={create.isPending}
          data-testid={newDomainFormTestIds.add}
          data-track="NewDomainForm.add"
        >
          Add
        </button>
        <button type="button" onClick={close} data-track="NewDomainForm.cancel">
          Cancel
        </button>
      </div>
      {create.isError && (
        <p className={styles.error} role="alert" data-testid={newDomainFormTestIds.error}>
          {problemMessage(create.error)}
        </p>
      )}
    </form>
  )
}
