# Plan

Each stage ends with something Matt can use and give feedback on. The data
model includes the sync-ready pieces from the start (operations, versions,
UUIDv7 IDs, soft deletes, an actor on every change), so later stages extend
it rather than rework it. Each stage is a series of small commits that can
be reviewed on their own.

## Stage 0: Foundations ✅

- Git, the Nix flake (`nix develop`, `.#ci`), the pnpm monorepo
- Whereabouts' tooling and conventions, CLAUDE.md
- Hono server, Drizzle over Postgres (dev) and PGlite (tests), React app, `taxa health`
- The test harness end to end: unit tests, IWBT (with the CLI in-process), IWFT with the `taxa` fixture
- This plan and the design doc

## Stage 1: Tasks you can actually use ✅ (awaiting feedback)

- Domains with prefixes, and tasks with all their fields and states
- Human IDs, operations with versions and `If-Match`, idempotency keys, soft deletes, the activity log
- Agent identities and API keys in their minimal form
- The API with its OpenAPI spec. The CLI: `add`, `list`, `show`, `edit`, `done`, `--json`, JSON on stdin
- Web: Inbox, per-domain lists, task detail, quick capture. Notes as plain Markdown
- Dev-mode login, one person. A Claude Code skill for `taxa`

Also in the CLI: `log` (the activity log), `start`, `wait`, `cancel`,
`reopen`, `delete`, `restore`, domains, agents and keys; for agents,
`edit --append-notes`, `list --search` and `--follows-on`. `taxa` is also
a Nix package (`packages.taxa`), with the skill in it, so it runs outside
this repository. Not yet: key scopes (Stage 3).

Brought forward from Stage 2 after first use: the notes editor (Tiptap)
with its Markdown toggle. The web app saves notes in the canonical style;
normalising what the API receives from others is still to come.

Also added after first use: keyboard shortcuts. `C` adds a task, `G` then a letter goes to a
list used every day (`T` Today, `S` Soon, `I` Inbox, `P` In progress, `N` the
session, `M` Someday, `B` the bin; domains, which people tend to stay in, are in
the command menu instead; after `G` a panel shows what can come next, until
the next key, `Esc` or a click elsewhere), `⌘Z` undoes the tab's last change of any kind and `⇧⌘Z` redoes it, and `?` lists them, with
single-key ones able to be turned off. In a list, `J`/`K` or the arrows move
through the tasks, `Enter` opens one and `X` ticks it off; on a task's page, a
key opens each picker (`S`, `P`, `M`, `D`, `T`, `H`, `E`), `R` renames, `N`
writes notes and `Esc` goes back. `⌘K` opens a command menu that finds any of
these by typing, shows its shortcut, and opens a task from its ref (`H-12`).

Also added: `I` starts or stops working on a task, in a list or on its page.
Tasks in progress sort first in every list, and an In progress list in the
sidebar gathers them from the Inbox and every domain.

Also added: links with their own text in notes, by `⌘K` while writing, the
toolbar, or typing `[text](address)`, with a bar to open, edit or remove one.

Also added: sessions, for planning a block of time (see Deciding what to do
in the design): the API, and in the web app, planning one, working through it
with `X` and `I`, replanning, and a summary at the end. Not yet in the CLI.

**Feedback checkpoint:** daily use, the CLI, and how agents get on with it.

## Stage 2: Organising and deciding

- Projects, subtasks, tags, manual ordering
- The query language (string and JSON forms) in the API and CLI. Saved filters and the filter builder
- Today (Planned, Needs attention, carried over), Upcoming, Someday, per-project views
- Focus
- Time zones, and times pinned to a zone
- Markdown normalisation in the API, whoever writes, and links for task references

## Stage 3: Agents as collaborators

- Key scopes enforced everywhere. Delegating to agents, claims, stale claims
- Threads, and the timeline
- The change feed and live updates over SSE
- Undo and bin: done (undo in the API and `taxa undo`, `⌘Z`/`⇧⌘Z`, undo from a task's activity, the Bin page and `taxa list --deleted`; deleting forever from the bin, emptying it, and clearing out tasks left there 30 days)
- The attention list in the API and CLI

## Stage 4: Sharing and going online

- Google sign-in with the allowlist, settings
- Domain membership, Home, assignees
- Hosting and the first deployment. Jo joins

## Stage 5: Mobile and offline (v1 complete)

- An installable PWA
- A read-only local copy in IndexedDB
- The offline capture queue, conflict detection and "changed while you were offline" notices

## After v1

Full offline editing, then the backlog in [design.md](design.md), in
whatever order using it suggests.
