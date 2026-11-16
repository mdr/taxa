import { useState, type SubmitEvent } from "react"
import styles from "./NewDomainForm.module.css"
import { newDomainFormTestIds } from "./NewDomainFormTestIds.ts"
import { problemMessage } from "../api/problem-message.ts"
import { useCreateDomain } from "./domain-queries.ts"

export const NewDomainForm = () => {
  const [name, setName] = useState("")
  const [prefix, setPrefix] = useState("")
  const create = useCreateDomain()
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const submitted = { name, prefix }
    create.mutate(
      { name: name.trim(), prefix: prefix.trim() },
      {
        // Keep anything typed since.
        onSuccess: () => {
          setName((current) => (current === submitted.name ? "" : current))
          setPrefix((current) => (current === submitted.prefix ? "" : current))
        }
      }
    )
  }
  return (
    <form className={styles.form} onSubmit={submit} aria-label="New domain">
      <p className={styles.heading}>New domain</p>
      <label className={styles.field}>
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          data-testid={newDomainFormTestIds.name}
        />
      </label>
      <label className={styles.field}>
        Prefix
        <input
          value={prefix}
          onChange={(event) => setPrefix(event.target.value.toUpperCase())}
          required
          maxLength={5}
          pattern="[A-Za-z]{1,5}"
          title="1 to 5 letters, such as H for Home"
          className={styles.prefix}
          data-testid={newDomainFormTestIds.prefix}
        />
      </label>
      <button type="submit" disabled={create.isPending} data-testid={newDomainFormTestIds.add}>
        Add domain
      </button>
      {create.isError && (
        <p className={styles.error} role="alert" data-testid={newDomainFormTestIds.error}>
          {problemMessage(create.error)}
        </p>
      )}
    </form>
  )
}
