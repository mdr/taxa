import { Link, useLocation } from "wouter"
import styles from "./Sidebar.module.css"
import { sidebarTestIds } from "./SidebarTestIds.ts"
import { NewDomainForm } from "../domains/NewDomainForm.tsx"
import { useDomains } from "../domains/domain-queries.ts"
import { SERVER_STATUS_TEXT } from "../health/server-status.ts"
import { useServerStatus } from "../health/use-server-status.ts"

export const Sidebar = () => {
  const [location] = useLocation()
  const domains = useDomains()
  const status = useServerStatus()
  const current = (href: string) => (location === href ? "page" : undefined)
  return (
    <nav className={styles.sidebar} aria-label="Lists">
      <p className={styles.brand}>Taxa</p>
      <ul className={styles.links}>
        <li>
          <Link href="/" className={styles.link} aria-current={current("/")} data-testid={sidebarTestIds.inbox}>
            Inbox
          </Link>
        </li>
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
                <span className={styles.prefix}>{domain.prefix}</span>
                {domain.name}
              </Link>
            </li>
          )
        })}
      </ul>
      <NewDomainForm />
      <p className={styles.status} role="status" data-testid={sidebarTestIds.serverStatus} data-status={status}>
        {SERVER_STATUS_TEXT[status]}
      </p>
    </nav>
  )
}
