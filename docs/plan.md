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
`reopen`, `delete`, `restore`, domains, agents and keys. Not yet: key
scopes (Stage 3), and `taxa` outside this repository's dev shell.

Brought forward from Stage 2 after first use: the notes editor (Tiptap)
with its Markdown toggle. The web app saves notes in the canonical style;
normalising what the API receives from others is still to come.

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
- Undo and trash
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
