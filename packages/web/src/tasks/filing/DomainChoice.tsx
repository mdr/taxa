import type { Domain } from "@taxa/shared/domains/domain"
import type { Task } from "@taxa/shared/tasks/task"
import type { UpdateTaskRequest } from "@taxa/shared/tasks/task-requests"
import { domainChoice, movedRequest } from "./filing.ts"
import { DomainBadge } from "../../domains/DomainBadge.tsx"
import type { KeyShortcut } from "../../shortcuts/shortcut-service.ts"
import { ChoiceProperty } from "../detail/properties/ChoiceProperty.tsx"

interface DomainChoiceProps {
  task: Task
  domains: readonly Domain[]
  testId: string
  shortcut?: KeyShortcut
  onChoose: (request: UpdateTaskRequest) => void
}

/** The domain a task is in, to move it to another: nothing, with only one. */
export const DomainChoice = ({ task, domains, testId, shortcut, onChoose }: DomainChoiceProps) => {
  const domain = domains.find(({ id }) => id === task.domainId)
  if (domains.length < 2 || !domain) return undefined
  return (
    <ChoiceProperty
      label="Domain"
      testId={testId}
      shortcut={shortcut}
      value={domainChoice(task, domains)}
      trigger={
        <>
          <DomainBadge prefix={domain.prefix} />
          {domain.name}
        </>
      }
      options={domains.map(({ name, prefix }) => ({
        value: prefix,
        label: name,
        icon: <DomainBadge prefix={prefix} />
      }))}
      onChoose={(choice) => onChoose(movedRequest(choice))}
    />
  )
}
