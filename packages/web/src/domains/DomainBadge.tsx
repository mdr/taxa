import type { DomainPrefix } from "@taxa/shared/domains/domain"
import type { CSSProperties } from "react"
import styles from "./DomainBadge.module.css"
import { domainColour } from "./domain-colour.ts"
import { useDomains } from "./domain-queries.ts"

/** A domain's prefix on its colour. */
export const DomainBadge = ({ prefix }: { prefix: DomainPrefix }) => {
  const domains = useDomains()
  const colour = domainColour(prefix, domains.data?.map((domain) => domain.prefix) ?? [])
  return (
    <span className={styles.badge} style={{ "--domain": colour } as CSSProperties} aria-hidden>
      {prefix}
    </span>
  )
}
