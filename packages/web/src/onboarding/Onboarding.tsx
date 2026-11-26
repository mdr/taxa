import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, type SubmitEvent } from "react"
import styles from "./Onboarding.module.css"
import { TaxaLogo } from "../app/TaxaLogo.tsx"
import { onboardingTestIds } from "./OnboardingTestIds.ts"
import { problemMessage } from "../api/problem-message.ts"
import { queryKeys } from "../api/query-keys.ts"
import { taxaApi } from "../api/taxa-api.ts"
import { appAnalytics } from "../telemetry/app-telemetry.ts"
import { ANALYTICS_CODES } from "../telemetry/codes.ts"
import {
  STARTING_CHOICES,
  prefixed,
  problemsOf,
  renamed,
  toCreate,
  toggled,
  withAnother,
  type DomainChoice
} from "./domain-choices.ts"

/** The first screen: choose the domains to start with. */
export const Onboarding = () => {
  const queryClient = useQueryClient()
  const [choices, setChoices] = useState<DomainChoice[]>([...STARTING_CHOICES])
  const [attempted, setAttempted] = useState(false)
  const problems = problemsOf(choices)
  const pending = toCreate(choices)
  const create = useMutation({
    // One at a time, in order, so they're listed as chosen; any made before a failure stay made.
    mutationFn: async () => {
      for (const { key, name, prefix } of pending) {
        await taxaApi.createDomain({ name, prefix }, `onboarding-${key}-${prefix}`).catch((error: unknown) => {
          throw new Error(`Couldn't add ${name}: ${problemMessage(error)}`)
        })
        setChoices((current) => current.map((row) => (row.key === key ? { ...row, created: true } : row)))
      }
    },
    onSuccess: () => {
      appAnalytics.track(ANALYTICS_CODES.onboarding.finished, "finished choosing domains", {
        domainCount: choices.filter(({ chosen }) => chosen).length
      })
      return queryClient.invalidateQueries({ queryKey: queryKeys.domains })
    }
  })
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (problems.size === 0 && pending.length > 0) create.mutate()
  }
  return (
    <div className={styles.page}>
      <p className={styles.brand}>
        <TaxaLogo size={28} />
        Taxa
      </p>
      <section className={styles.card} aria-labelledby="welcome-heading" data-testid={onboardingTestIds.welcome}>
        <p className={styles.eyebrow}>Getting started</p>
        <h1 id="welcome-heading" className={styles.heading}>
          Welcome to Taxa
        </h1>
        <p className={styles.lead}>
          Taxa sorts your tasks into a few big areas of your life, called <strong>domains</strong>. Choose the ones to
          start with; you can add more whenever you like.
        </p>
        <form onSubmit={submit} noValidate>
          <fieldset className={styles.choices}>
            <legend className={styles.legend}>Your domains</legend>
            <div className={styles.columns} aria-hidden="true">
              <span />
              <span>Name</span>
              <span>Prefix</span>
              <span>Tasks look like</span>
            </div>
            {choices.map((row, index) => {
              const problem = attempted ? problems.get(row.key) : undefined
              const problemId = `domain-${row.key}-problem`
              return (
                <div
                  key={row.key}
                  className={styles.choice}
                  data-chosen={row.chosen}
                  data-testid={onboardingTestIds.choice}
                >
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={row.chosen}
                    disabled={row.created}
                    onChange={() => setChoices(toggled(choices, row.key))}
                    aria-label={`Start with ${row.name || `domain ${index + 1}`}`}
                    data-testid={onboardingTestIds.chosen}
                    data-track="Onboarding.chosen"
                  />
                  <input
                    value={row.name}
                    disabled={row.created}
                    placeholder="Name it"
                    onChange={(event) => setChoices(renamed(choices, row.key, event.target.value))}
                    aria-label={`Domain ${index + 1} name`}
                    aria-invalid={problem !== undefined}
                    aria-describedby={problem ? problemId : undefined}
                    data-testid={onboardingTestIds.name}
                    data-track="Onboarding.name"
                  />
                  <input
                    className={styles.prefix}
                    value={row.prefix}
                    disabled={row.created}
                    maxLength={5}
                    onChange={(event) => setChoices(prefixed(choices, row.key, event.target.value))}
                    aria-label={`Domain ${index + 1} prefix`}
                    aria-invalid={problem !== undefined}
                    aria-describedby={problem ? problemId : undefined}
                    data-testid={onboardingTestIds.prefix}
                    data-track="Onboarding.prefix"
                  />
                  <span className={styles.example} aria-hidden="true">
                    {row.created ? "✓ added" : row.prefix ? `${row.prefix}-1` : ""}
                  </span>
                  {problem && (
                    <p id={problemId} className={styles.problem} data-testid={onboardingTestIds.problem}>
                      {problem}
                    </p>
                  )}
                </div>
              )
            })}
          </fieldset>
          <button
            type="button"
            className={styles.another}
            onClick={() => setChoices(withAnother(choices))}
            data-testid={onboardingTestIds.another}
            data-track="Onboarding.another"
          >
            + Another domain
          </button>
          <p className={styles.hint}>
            The prefix starts every task's reference, so “H-12” means the same thing here, in the terminal and to an
            agent. Anything you jot down without saying when waits in your Inbox, to sort out and file when you're
            ready.
          </p>
          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.start}
              disabled={pending.length === 0 || create.isPending}
              data-testid={onboardingTestIds.start}
              data-track="Onboarding.start"
            >
              {pending.length === 0
                ? "Choose a domain to start"
                : `Start with ${pending.length} ${pending.length === 1 ? "domain" : "domains"}`}
            </button>
          </div>
          {create.isError && (
            <p className={styles.error} role="alert" data-testid={onboardingTestIds.error}>
              {create.error.message}
            </p>
          )}
        </form>
      </section>
    </div>
  )
}
