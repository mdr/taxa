import { When } from "@taxa/shared/tasks/when"

/** What each When is called, in menus and notices. */
export const WHEN_TEXT: Record<When, string> = {
  [When.TODAY]: "Today",
  [When.ON_A_DAY]: "On a day…",
  [When.SOON]: "Soon",
  [When.ANY_TIME]: "Any time",
  [When.SOMEDAY]: "Someday"
}
