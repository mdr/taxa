import { Inbox, Keyboard, Sprout, Tag, Timer, Trash2 } from "lucide-react"
import { tagPath } from "../tags/tag-paths.ts"
import { useTags } from "../tags/tag-queries.ts"
import { Link, useLocation } from "wouter"
import styles from "./Sidebar.module.css"
import { sidebarTestIds } from "./SidebarTestIds.ts"
import { DomainBadge } from "../domains/DomainBadge.tsx"
import { NewDomainForm } from "../domains/NewDomainForm.tsx"
import { useDomains } from "../domains/domain-queries.ts"
import { useTasks } from "../tasks/task-queries.ts"
import { StatusIcon } from "../tasks/StatusIcon.tsx"
import { IN_PROGRESS_PATH } from "../tasks/in-progress.ts"
import { SOMEDAY_PATH, SOON_PATH, TODAY_PATH } from "../tasks/when/when-paths.ts"
import { TRASH_PATH } from "../tasks/trash/trash-path.ts"
import { WHEN_ICONS } from "../tasks/when/when-choices.tsx"
import { When } from "@taxa/shared/tasks/when"
import type { ReactNode } from "react"
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

/** A list in the sidebar, with how many tasks it has, if any. */
const ListLink = ({
  href,
  icon,
  name,
  count,
  testId,
  countTestId
}: {
  href: string
  icon: ReactNode
  name: string
  count: number
  testId: string
  countTestId: string
}) => {
  const [location] = useLocation()
  return (
    <Link
      href={href}
      className={styles.link}
      aria-current={location === href ? "page" : undefined}
      data-testid={testId}
    >
      <span className={styles.linkIcon}>{icon}</span>
      <span className={styles.name}>{name}</span>
      {count > 0 && (
        <span className={styles.count} data-testid={countTestId}>
          {count}
        </span>
      )}
    </Link>
  )
}

/** One of the lists of what's meant for when. */
const WhenLink = ({
  when,
  href,
  name,
  testId,
  countTestId
}: {
  when: When
  href: string
  name: string
  testId: string
  countTestId: string
}) => {
  const tasks = useTasks({ when })
  const Icon = WHEN_ICONS[when]
  return (
    <ListLink
      href={href}
      icon={<Icon size={16} aria-hidden />}
      name={name}
      count={tasks.data?.length ?? 0}
      testId={testId}
      countTestId={countTestId}
    />
  )
}

/** The tags with tasks still to do, each a list. */
const SidebarTags = () => {
  const tags = (useTags().data ?? []).filter(({ openCount }) => openCount > 0)
  if (tags.length === 0) return undefined
  return (
    <>
      <p className={styles.section}>Tags</p>
      <ul className={styles.links}>
        {tags.map(({ name, openCount }) => (
          <li key={name}>
            <ListLink
              href={tagPath(name)}
              icon={<Tag size={16} aria-hidden />}
              name={name}
              count={openCount}
              testId={sidebarTestIds.tag}
              countTestId={sidebarTestIds.tagCount}
            />
          </li>
        ))}
      </ul>
    </>
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
      <WhenLink
        when={When.TODAY}
        href={TODAY_PATH}
        name="Today"
        testId={sidebarTestIds.today}
        countTestId={sidebarTestIds.todayCount}
      />
      <WhenLink
        when={When.SOON}
        href={SOON_PATH}
        name="Soon"
        testId={sidebarTestIds.soon}
        countTestId={sidebarTestIds.soonCount}
      />
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
      <WhenLink
        when={When.SOMEDAY}
        href={SOMEDAY_PATH}
        name="Someday"
        testId={sidebarTestIds.someday}
        countTestId={sidebarTestIds.somedayCount}
      />
      <SidebarTags />
      <Link
        href={TRASH_PATH}
        className={styles.link}
        aria-current={current(TRASH_PATH)}
        data-testid={sidebarTestIds.trash}
      >
        <Trash2 size={16} className={styles.linkIcon} aria-hidden />
        <span className={styles.name}>Trash</span>
      </Link>
      <button
        type="button"
        className={styles.shortcuts}
        onClick={openHelp}
        aria-keyshortcuts="Shift+?"
        data-testid={sidebarTestIds.shortcuts}
        data-track="Sidebar.shortcuts"
      >
        <Keyboard size={16} aria-hidden />
        Keyboard shortcuts
        <kbd className={styles.shortcutsKey}>?</kbd>
      </button>
    </nav>
  )
}
