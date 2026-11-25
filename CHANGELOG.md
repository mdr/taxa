# Changelog

What's changed in each release, for whoever uses Taxa. Each change adds a
line under **Unreleased**; a release moves them under its version and puts
them at the top of its release notes. See `docs/releasing.md`.

## Unreleased

### Changed

- With only one domain, the sidebar has no Domains section or "New domain": just **All tasks**, going to that domain's list. A second domain (`taxa add-domain`) brings the section back.

### Fixed

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
