# Changelog

What's changed in each release, for whoever uses Taxa. Each change adds a
line under **Unreleased**; a release moves them under its version and puts
them at the top of its release notes. See `docs/releasing.md`.

## Unreleased

### New

- **Task refs link to their tasks.** Write `P-52` (or `p-52`) in a task's notes or a comment and it becomes a link to that task: click it in a comment, ⌘- or Ctrl-click it in notes, as with other links there. Only your domains' prefixes count, so `UTF-8` stays text, as does a ref in code. Notes are saved as written.
- **`taxa` in colour.** In a terminal, `taxa list` groups tasks under In progress, Waiting, Today, Tomorrow, Later and Someday, with a mark for each one's status, overdue in red, due today in amber, urgent and high marked, and lines cut to fit the window. A task's ref is a link to it in the web app, in terminals that support links. `taxa show` puts the title first, its status, domain, priority and tags on one line under it, when it's planned and due on the next, the checklist as a progress bar and ticks, the notes drawn from their Markdown, and the latest comment. Changes say what they did with the task's mark and colour, and errors are in red with what to try next. Agents, pipes and scripts get the plain text they always have; `--color auto|always|never`, `NO_COLOR` and `FORCE_COLOR` choose otherwise.

### Changed

- **The Done button on a done task opens a menu** (Reopen, In progress, Waiting; for a repeating task, Not done this time) rather than quietly taking “done” back on a click. X still does.

## 0.7.0 (2026-11-26)

### New

- The sidebar says which version of Taxa you're using, such as "Taxa 0.6.0"; hover over it for the exact build.
- **Signing in with Google.** A server can have people sign in, with Google or any OpenID Connect provider, instead of everyone being one person. Anyone Taxa knows by email can, once the provider vouches for it; `TAXA_PEOPLE` gives people their emails, and someone already in Taxa by that name becomes them, tasks and all. A sign-in lasts until it's unused for 30 days, or **Sign out** at the foot of the sidebar. The CLI and agents keep their API keys. `docs/sign-in.md` says how to set it up, on NixOS (`services.taxa.signIn`) or with environment variables anywhere else.

## 0.6.0 (2026-11-26)

### New

- **Deadlines**, in the sidebar: every task with a due date, soonest first, under Overdue, Today, This week, Next week and each month, each saying how long it has. The sidebar counts those overdue or due within the week, in red when any are overdue. `G D` goes there; in the CLI, `taxa list --due`.
- Below Today, **Deadlines coming up**: what's overdue or due within the week and not yet planned for today, with + Today on each.
- **Filing** a task out of the Inbox is now its own step, once it's sorted out: the **File** button on its row or page, `V`, or "File it" in the row's menu. `V` again, or "Back to the Inbox", puts it back. In the CLI: `taxa file H-7`, `taxa edit --inbox` and `--filed`.

- A big green **Mark done** button at the top of a task's page, with a little celebration; `X` does it from the keyboard there too, as in lists. On a repeating task it says "Done this time".

### Changed

- **The Inbox** is for jotting things down to sort out later. Every task now goes in a domain from the start, with that domain's ref (`H-7`, no more `IN-7`), and waits in your Inbox until you file it. A task added for today, soon or someday, in a domain's list, or while planning is filed straight away. Inbox tasks are seen only by you, and stay out of their domain's list until filed. Your Inbox tasks have moved into your oldest domain, still in the Inbox; their old `IN-` refs still find them.
- **Energy** is gone for now: no Energy on a task's page, no "Low energy" suggestions when planning, and no `--energy` in the CLI. Any energy already set is kept, unseen, in case it comes back.
- With only one domain, there's no choosing it: no domain picker when capturing, on a task's page, in the row menu or when adding a follow-on. "Inbox" is no longer offered as a place to move a task to.

- **Might want attention**, below Today, leaves deadlines to the new box above it.
- With only one domain, the sidebar has no Domains section or "New domain": just **All tasks**, going to that domain's list. A second domain (`taxa add-domain`) brings the section back.

### Fixed

- "Due today" on a task's row is a darker amber, easier to read.
- The favicon and home-screen icon show on the live site: the built web app was missing them.

## 0.5.0 (2026-11-25)

### New

- Checklist items can be put in order: drag one by its grip, or pick it up with the keyboard. In the CLI, `taxa move-item`.

### Changed

- Undoing adding a task takes it back completely: it no longer lands in the Bin.
- Undoing making a checklist item a task takes that task back too, unless it's been changed since.
- A checklist item's "make it a task" button has a follow-on arrow instead of the open-link icon.

## 0.4.0 (2026-11-25)

### New

- **Checklists.** A task can hold a checklist of steps to tick off, for
  work whose parts you know up front: accounts to move, passwords to
  change. On a task's page, **Add a checklist**, then type items (Enter
  adds each) or paste a list. Lists show how far through it is, such as
  "3/8", and once every item's ticked, the page offers to mark the task
  done. A repeating task's ticks come off each time it comes round.
- **Make an item a task.** An item that grows into work of its own can
  become a task, following on from the first; the item stays, and is
  ticked when that task is done.
- **Checklists in the CLI:** `taxa add --item`, `taxa checklist`,
  `taxa check` and `uncheck` (by number or text), `taxa add-item`,
  `edit-item`, `remove-item` and `item-to-task`. Search finds tasks by
  their checklist items too.
- **A logo.** Taxa's mark is a specimen tag, ticked, hanging on its string,
  in moss green. It's the favicon in your browser's tabs, the icon when you
  add Taxa to a phone's home screen, and beside the name in the sidebar.

## 0.3.0 (2026-11-25)

### Changed

- **The timeline shows what matters.** A task's timeline shows when it was
  made, started, finished, moved or set to repeat, and its comments. Other
  changes (notes, title, dates, priority, tags, a repeating task done or
  skipped) are hidden until you click **Show all changes** at the top of
  the timeline.
- **No undo button on the timeline.** Undo is ⌘Z, for what you've just
  done. A notes change in the timeline instead shows the notes before it,
  with **Restore these notes**.
- **Your agents' comments are yours.** You can edit or delete comments
  written by your agents as well as your own. An agent can still change
  only its own.
- **Enter posts a comment**, as in a chat; Shift+Enter starts a new line.
  Editing a comment, Enter saves it. (It was ⌘Enter, which still works.)
- **Show finished.** The section under each list that held done tasks now
  holds cancelled ones too, as "N finished". Cancelled tasks are struck
  through and say "Cancelled".

## 0.2.0 (2026-11-25)

### New

- **Repeating tasks.** Set how a task repeats from its page (Every day,
  Every weekday, Every Friday, Monthly on the 9th, or typed, such as "every
  2 weeks on friday" or "3 days after done"), or with `--repeat` in the CLI.
  A repeating task keeps one ref. Ticking it off does it this time and moves
  it on to its next date; unticking or ⌘Z takes that back. "Skip this time"
  is in its status menu, `taxa skip` in the CLI, and taking it out of
  today's plan skips today's. Its page shows a history of recent days.
- **Missed days.** A repeating task either skips days that go by undone
  (the default for daily ones), recording them as missed when it's next
  changed and moving on to today, or carries them over until it's done.
  Choose in its Repeat menu, or with `--missed skip|carry-over`.
- **Comments.** Add comments to a task, from the web app or
  `taxa comment`, to record what's happened; agents report their work this
  way. They appear in the task's timeline, and can be edited, deleted and
  restored. ⌘Z undoes changes to them.
- **Search finds tasks by their comments.**
- **Quick capture** on Today, Plan today, Soon and Someday adds a task for
  then.
- **Deleting a domain:** `taxa delete-domain H`, once it has no tasks, the
  Bin included. Its tasks' old refs still find them.

### Changed

- **Time zone.** Your time zone follows the browser or the CLI you're using,
  so "today" is right wherever you are.

## 0.1.0 (2026-11-24)

The first release: tasks in domains and the Inbox; Today, Soon, Someday and
In progress; planning today; sessions; notes in Markdown with a formatting
editor; tags; follow-ons; keyboard shortcuts and the command menu; undo,
redo and the Bin; the `taxa` CLI; agents with their own API keys; and the
NixOS module for running the server.
