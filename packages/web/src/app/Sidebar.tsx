import { Inbox, Sprout } from "lucide-react"
import { Link, useLocation } from "wouter"
import styles from "./Sidebar.module.css"
import { sidebarTestIds } from "./SidebarTestIds.ts"
import { DomainBadge } from "../domains/DomainBadge.tsx"
import { NewDomainForm } from "../domains/NewDomainForm.tsx"
import { useDomains } from "../domains/domain-queries.ts"
import { useTasks } from "../tasks/task-queries.ts"

export const Sidebar = () => {
  const [location] = useLocation()
  const domains = useDomains()
  const inbox = useTasks({ inbox: "true" })
  const current = (href: string) => (location === href ? "page" : undefined)
  const inboxCount = inbox.data?.length ?? 0
  return (
    <nav className={styles.sidebar} aria-label="Lists">
      <p className={styles.brand}>
        <Sprout size={20} className={styles.logo} aria-hidden />
        Taxa
      </p>
      <Link href="/" className={styles.link} aria-current={current("/")} data-testid={sidebarTestIds.inbox}>
        <Inbox size={16} className={styles.linkIcon} aria-hidden />
        <span className={styles.name}>Inbox</span>
        {inboxCount > 0 && <span className={styles.count}>{inboxCount}</span>}
      </Link>
      <p className={styles.section}>Domains</p>
      <ul className={styles.links}>
        {domains.data?.map((domain) => {
          const href = `/domains/${domain.prefix}`
          return (
            <li key={domain.id}>
              <Link
                href={href}
                className={styles.link}
                aria-current={current(href)}
                data-testid={sidebarTestIds.domain}
              >
                <DomainBadge prefix={domain.prefix} />
                <span className={styles.name}>{domain.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <NewDomainForm />
    </nav>
  )
}
