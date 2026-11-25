# Changelog

What's changed in each release, for whoever uses Taxa. Each change adds a
line under **Unreleased**; a release moves them under its version and puts
them at the top of its release notes. See `docs/releasing.md`.

## Unreleased

### Changed

- **The timeline shows what matters.** A task's timeline shows when it was
  made, started, finished, moved or set to repeat, and its comments. Other
  changes (notes, title, dates, priority, tags, a repeating task done or
  skipped) fold into a line such as "› 3 other changes", which opens where
  they happened.
- **No undo button on the timeline.** Undo is ⌘Z, for what you've just
  done. A notes change in the timeline instead shows the notes before it,
  with **Restore these notes**.
- **Your agents' comments are yours.** You can edit or delete comments
  written by your agents as well as your own. An agent can still change
  only its own.
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
