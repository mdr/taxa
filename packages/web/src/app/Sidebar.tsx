import { Inbox, Keyboard, Sprout, Timer } from "lucide-react"
import { Link, useLocation } from "wouter"
import styles from "./Sidebar.module.css"
import { sidebarTestIds } from "./SidebarTestIds.ts"
import { DomainBadge } from "../domains/DomainBadge.tsx"
import { NewDomainForm } from "../domains/NewDomainForm.tsx"
import { useDomains } from "../domains/domain-queries.ts"
import { useTasks } from "../tasks/task-queries.ts"
import { StatusIcon } from "../tasks/StatusIcon.tsx"
import { IN_PROGRESS_PATH } from "../tasks/in-progress.ts"
import { TaskStatus } from "@taxa/shared/tasks/task"
import { useShortcutActions } from "../shortcuts/shortcut-service.ts"
import type { Session } from "@taxa/shared/sessions/session"
import { sessionTimeline } from "@taxa/shared/sessions/session-timeline"
import { useCurrentSession } from "../sessions/session-queries.ts"
import { SESSION_PATH } from "../sessions/session-paths.ts"
import { shortLeft } from "../sessions/session-text.ts"
import { useNow } from "../sessions/use-now.ts"

/** Time left on the task under way, or how far over it's run. */
const SessionLeft = ({ session }: { session: Session }) => {
  const now = useNow()
  const { current } = sessionTimeline(session, now)
  if (!current) return undefined
  return (
    <span
      className={`${styles.count} ${current.left < 0 ? styles.over : styles.left}`}
      aria-label={current.left < 0 ? "over time" : "left on this task"}
      data-testid={sidebarTestIds.sessionLeft}
    >
      {shortLeft(current.left)}
    </span>
  )
}

export const Sidebar = () => {
  const [location] = useLocation()
  const domains = useDomains()
  const inbox = useTasks({ inbox: "true" })
  const inProgress = useTasks({ status: TaskStatus.IN_PROGRESS })
  const inProgressCount = inProgress.data?.length ?? 0
  const current = (href: string) => (location === href ? "page" : undefined)
  const inboxCount = inbox.data?.length ?? 0
  const { openHelp } = useShortcutActions()
  const session = useCurrentSession().data?.session
  return (
    <nav className={styles.sidebar} aria-label="Lists">
      <p className={styles.brand}>
        <Sprout size={20} className={styles.logo} aria-hidden />
        Taxa
      </p>
      <Link href="/" className={styles.link} aria-current={current("/")} data-testid={sidebarTestIds.inbox}>
        <Inbox size={16} className={styles.linkIcon} aria-hidden />
        <span className={styles.name}>Inbox</span>
        {inboxCount > 0 && (
          <span className={styles.count} data-testid={sidebarTestIds.inboxCount}>
            {inboxCount}
          </span>
        )}
      </Link>
      <Link
        href={IN_PROGRESS_PATH}
        className={styles.link}
        aria-current={current(IN_PROGRESS_PATH)}
        data-testid={sidebarTestIds.inProgress}
      >
        <span className={styles.linkIcon}>
          <StatusIcon status={TaskStatus.IN_PROGRESS} size={16} />
        </span>
        <span className={styles.name}>In progress</span>
        {inProgressCount > 0 && (
          <span className={styles.count} data-testid={sidebarTestIds.inProgressCount}>
            {inProgressCount}
          </span>
        )}
      </Link>
      <Link
        href={SESSION_PATH}
        className={styles.link}
        aria-current={current(SESSION_PATH)}
        data-testid={sidebarTestIds.session}
      >
        <Timer size={16} className={styles.linkIcon} aria-hidden />
        <span className={styles.name}>Session</span>
        {session && <SessionLeft session={session} />}
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
      <button
        type="button"
        className={styles.shortcuts}
        onClick={openHelp}
        aria-keyshortcuts="Shift+?"
        data-testid={sidebarTestIds.shortcuts}
      >
        <Keyboard size={16} aria-hidden />
        Keyboard shortcuts
        <kbd className={styles.shortcutsKey}>?</kbd>
      </button>
    </nav>
  )
}
