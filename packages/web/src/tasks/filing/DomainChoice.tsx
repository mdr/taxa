import type { Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"
import type { UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import { Inbox } from "lucide-react"
import { INBOX_CHOICE, filingChoice, filingRequest } from "./filing.ts"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import type { KeyShortcut } from "../../shortcuts/shortcut-service.ts"
import { ChoiceProperty } from "../detail/properties/ChoiceProperty.tsx"

interface DomainChoiceProps {
  task: Task
  domains: readonly Domain[]
  testId: string
  shortcut?: KeyShortcut
  /** Opens it from elsewhere, again with each new number. */
  opening?: number
  onChoose: (request: UpdateTaskRequest) => void
}

/** Where a task is filed: a domain, or still the Inbox, inviting a choice. */
export const DomainChoice = ({ task, domains, testId, shortcut, opening, onChoose }: DomainChoiceProps) => {
  const domain = domains.find(({ id }) => id === task.domainId)
  return (
    <ChoiceProperty
      label="Domain"
      testId={testId}
      shortcut={shortcut}
      opening={opening}
      value={filingChoice(task, domains)}
      empty={task.inbox}
      trigger={
        domain ? (
          <>
            <DomainBadge prefix={domain.prefix} />
            {domain.name}
          </>
        ) : (
          <>
            <Inbox size={14} aria-hidden />
            Choose a domain
          </>
        )
      }
      options={[
        ...domains.map(({ name, prefix }) => ({ value: prefix, label: name, icon: <DomainBadge prefix={prefix} /> })),
        ...(task.inbox
          ? []
          : [{ value: INBOX_CHOICE, label: "Back to the Inbox", icon: <Inbox size={14} aria-hidden /> }])
      ]}
      onChoose={(choice) => onChoose(filingRequest(choice))}
    />
  )
}
