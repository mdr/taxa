import { PREFIX_PATTERN, type CreateDomainRequest } from "@taxa/shared/domains/domain"
import { suggestPrefix } from "@taxa/shared/domains/prefix-suggestion"

/** One domain someone might start with. */
export interface DomainChoice {
  key: number
  chosen: boolean
  name: string
  prefix: string
  /** Once someone types a prefix, renaming stops suggesting one. */
  prefixEdited: boolean
  /** Made already, by an earlier try that failed part-way. */
  created: boolean
}

const choice = (key: number, name: string, prefix: string, chosen: boolean): DomainChoice => ({
  key,
  chosen,
  name,
  prefix,
  prefixEdited: false,
  created: false
})

export const STARTING_CHOICES: readonly DomainChoice[] = [
  choice(1, "Personal", "P", true),
  choice(2, "Home", "H", true),
  choice(3, "Work", "W", false)
]

const prefixesOf = (choices: readonly DomainChoice[], except: number): Set<string> =>
  new Set(choices.filter(({ key, chosen }) => chosen && key !== except).map(({ prefix }) => prefix))

/** One more, empty and chosen. */
export const withAnother = (choices: readonly DomainChoice[]): DomainChoice[] => [
  ...choices,
  choice(Math.max(0, ...choices.map(({ key }) => key)) + 1, "", "", true)
]

export const renamed = (choices: readonly DomainChoice[], key: number, name: string): DomainChoice[] =>
  choices.map((row) =>
    row.key !== key
      ? row
      : { ...row, name, prefix: row.prefixEdited ? row.prefix : suggestPrefix(name, prefixesOf(choices, key)) }
  )

export const prefixed = (choices: readonly DomainChoice[], key: number, prefix: string): DomainChoice[] =>
  choices.map((row) =>
    row.key === key ? { ...row, prefix: prefix.toUpperCase().replaceAll(/[^A-Z]/g, ""), prefixEdited: true } : row
  )

export const toggled = (choices: readonly DomainChoice[], key: number): DomainChoice[] =>
  choices.map((row) => (row.key === key && !row.created ? { ...row, chosen: !row.chosen } : row))

/** What's wrong with each chosen domain still to be made, by key. */
export const problemsOf = (choices: readonly DomainChoice[]): Map<number, string> => {
  const problems = new Map<number, string>()
  for (const row of choices.filter(({ chosen, created }) => chosen && !created)) {
    if (row.name.trim() === "") problems.set(row.key, "Give it a name.")
    else if (!PREFIX_PATTERN.test(row.prefix)) problems.set(row.key, "The prefix needs 1 to 5 letters.")
    else if (prefixesOf(choices, row.key).has(row.prefix))
      problems.set(row.key, `Another domain has ${row.prefix} too.`)
  }
  return problems
}

/** The domains still to make, in order: the first made becomes the default. */
export const toCreate = (choices: readonly DomainChoice[]): (CreateDomainRequest & { key: number })[] =>
  choices
    .filter(({ chosen, created }) => chosen && !created)
    .map(({ key, name, prefix }) => ({ key, name: name.trim(), prefix }))
