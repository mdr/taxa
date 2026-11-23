# Taxa design

Taxa is a task manager for Matt, and later Jo, built so that AI agents can
use it as easily as people can. At its core it's one well-structured
database of tasks behind an API. The web app, the installable phone app
(PWA), the `taxa` CLI and agents are all clients of that API.

This document records what we've decided and why. Where something is a
starting point rather than settled, it says so. [plan.md](plan.md) says
when each part gets built.

## Organising tasks

```
Domain (Personal / Work / Home)   who can see it
  └─ Project (optional)           a goal or stream of work
       └─ Task                    title, notes, status, dates, priority…
            └─ Subtask            any depth; the UI keeps it shallow
```

- **Domains** are the top level and the sharing boundary. Every project,
  and every task once it's filed, belongs to exactly one domain. A domain has **members**, and each
  person sees only the domains they belong to: Matt has Personal and Work,
  Jo has her own, and Home has both of them. Sharing is never set per task:
  moving a task into Home is what shares it, and the UI asks first.
- Members are equal, except that only a domain's creator can delete it or
  remove members.
- **Projects** have a name, a Markdown description of the goal, a status
  (active, someday, on hold, done), and optionally a target date. Many tasks
  belong to no project and sit directly in a domain.
- **Subtasks** are tasks with a parent. Projects stay a separate type from
  tasks: they have a different lifecycle and appear in different places.
- **Follow-ons** link a task to the one it came out of: it _follows on
  from_ that task, which shows what it _led to_. A task follows on from one
  task at most and can lead to any number, so the history is a trail, not a
  web, and never a loop. Ticking a task off offers **+ Follow-on**, which
  adds one in the same domain. It's the one kind of link between tasks;
  dependencies stay in the backlog. Once projects exist, a trail could
  become one.
- **Tags** are free-form labels (`Life Admin`, `errand`, `@phone`). A task
  can have any number. They're how we capture context and type, across
  domains: a tag's list gathers its tasks from the Inbox and every domain you
  can see. A tag is any words, kept as typed, spaces and capitals included;
  they match in any case, so `life admin` is `Life Admin`, but `life-admin`
  is a tag of its own. Tags are added from a task's page or ⋯ menu, or with
  `#` as a task is captured, where what follows the `#` is the tag until one
  is picked. Renaming a tag renames it on every task you can see. Tags are
  text on each task, not things of their own, so there's nothing to set up
  and nothing to share: someone sees a tag on the tasks they can see.
- **Assignees** come from a domain's members. In a shared domain, a task's
  assignee says whose job it is.

## Focus

A focus is a named set of domains, such as Work = {W}, Life = {M, H}, or
Everything. One switch in the app sets it, and every view, count and search
follows it. In v1 a focus is **sealed**: nothing from outside it shows, not
even urgent tasks. The current focus is always visible, new tasks go to the
focus's default domain, and each device remembers its own focus. The CLI and
agents take `--focus` or `TAXA_FOCUS`.

A focus is a soft preference about attention. What an API key can see is a
hard security boundary, and the two are kept separate.

## Tasks

| Field     | Notes                                                               |
| --------- | ------------------------------------------------------------------- |
| title     | Plain text                                                          |
| notes     | Markdown (see Rich text)                                            |
| status    | `OPEN`, `IN_PROGRESS`, `WAITING`, `DONE`, `CANCELLED`               |
| priority  | Urgent, high, normal, low                                           |
| due       | The real deadline                                                   |
| scheduled | When you plan to do it: a day, optionally with a time or time block |
| start     | Hidden until then                                                   |
| horizon   | Soon or someday, for a task with no scheduled day                   |
| estimate  | Roughly how long it will take                                       |
| energy    | Low, medium or high                                                 |
| assignee  | A member of the task's domain                                       |
| delegate  | An agent doing the work, while the assignee stays accountable       |

Everything except the title is optional. A quick capture is a title in the
Inbox, or straight into a domain picked beside it; the Inbox remembers the
last one picked, in that browser, until another is chosen. A task captured into the list
you're on is highlighted there, ready for its keys; `C` goes back to capture.

The **Inbox** is where a task waits before it's filed: a task created without
a domain goes into its creator's Inbox, in no domain, seen only by them. Its
ref is `IN-7`; filing it in Home makes it `H-7`, and `7` still finds it. A
task is in a domain or an Inbox, never both, so domain lists hold only filed
tasks. Capture without deciding where something goes, and sort it later.

- **In progress** records who is working on the task: a person or an agent.
  Tasks in progress sort first in their lists, and the In progress view
  gathers them from everywhere.
  For agents it works as a claim, so two agents don't pick up the same task.
  A claim with no activity for a while is flagged as stale.
- **Waiting** records what it's waiting on and a follow-up date (by default
  about a week). When that date comes, the task shows up again in Today.
- **Done** and **cancelled** record when, and cancelled can record why.

### Human-friendly IDs

Every task gets a number from one global sequence that's never reused, and
it's shown with its domain's prefix: `H-142`, `W-143`. Prefixes are 1–5
letters, chosen per domain and unique across the installation. Because the
number alone identifies the task, a task can move between domains, or a
domain's prefix can change, without breaking references: `H-143`, `W-143`
and `143` all resolve. Input is case-insensitive and the prefix optional.
Internally everything uses UUIDv7s. Tasks created offline show as "pending"
until they sync and get their number.

### Rich text

Task notes and project descriptions are stored as GitHub-flavoured Markdown,
so agents and the CLI read and write them as plain text. The web app edits
them in a WYSIWYG editor (Tiptap or similar) with a toggle to raw Markdown.
All Markdown is normalised to one canonical style on save, whichever editor
or agent wrote it, so formatting doesn't churn and the activity log shows
only real changes. Task references such as `H-142` become links.
Links keep their own text: `⌘K` or the toolbar adds one, and with the cursor
on a link a bar shows where it goes, to open, edit or remove it. Clicking a
link places the cursor, to edit it; `⌘`-click follows it. Links go to web
pages, email, phone numbers, or a file in VS Code (`vscode://file/…`), since
browsers won't open `file://` links from a web page.

### Threads

Tasks and projects have a **thread**: Markdown entries from people or
agents, recording what has happened ("called the garage, they'll ring back
Thursday"). Notes say what the task is, and the thread says what has
happened. Agents report their work here, appending rather than editing your
notes. Authors can edit or delete their own entries, and that's logged. The
task's timeline in the UI mixes thread entries with activity-log events,
which aren't stored as comments.

## Dates, times and time zones

- **Dates** (due, scheduled, start) are floating: Friday is Friday wherever
  you are. They're stored as plain dates.
- **Times** are floating by default: "21:00" is 21:00 wherever the viewer
  is. A time can be **pinned** to a zone for real-world appointments ("15:00
  London"), and the UI shows the zone. This matches iCalendar's floating and
  `TZID` times, so calendar sync and recurrence (RRULE) can follow later.
- **Timestamps** (created, completed, the activity log) are UTC instants,
  shown in local time.
- Each person has a **current time zone**. It updates automatically from the
  browser or phone (and from the CLI's environment), and can be overridden
  or locked in settings. The server uses it to work out "today", overdue and
  follow-ups for that person and their agents.

## Deciding what to do

- **Today** (starting point, open to change): _Planned_ is the tasks
  scheduled for today, i.e. your commitment. _Needs attention_ is what's due
  or overdue, follow-ups that have come round, and newly assigned tasks, as
  suggestions to pull in or dismiss. Unfinished planned tasks show as
  "carried over" rather than rolling forward silently.
- **When** is one choice made of the scheduled day and the horizon: today
  (scheduled today or before), on a day to come, soon, any time (neither: the
  default) or someday. A date beats a horizon, and choosing one clears the
  other. Someday tasks stay out of lists and suggestions until you look at
  Someday, though search still finds them.
- **Plan today** chooses today's tasks from suggestions (due or overdue, in
  progress, soon, due this week, important) or any task found, and puts them
  in order. Putting one in schedules it for today; taking one out leaves it
  for soon. The order is a day plan, kept per person per date; Today lists
  tasks in that order, those it doesn't place after. The plan follows
  today's tasks as they change elsewhere, by an undo or in another tab: a
  task taken out and put back returns to its place.
- Below Today, **Might want attention** offers what isn't planned for it but
  is due, overdue, or urgent and lined up for soon, with + Today on each. A
  task in Soon for four weeks says so, to ask whether it's still soon or
  someday. Sessions offer today's tasks first, in the order planned.
- Other built-in views: **Inbox** (not yet organised), **Upcoming**,
  **Someday**, and per project.
- **Saved filters** are named queries in the query language, built by
  pointing and clicking or written out.
- Later: an agent suggests what to do now from these fields and your
  calendar.

There is no hidden priority score: the fields stay understandable, and any
cleverness lives in views and suggestions.

**Sessions** plan a one-off block of time: say how long you have (a length,
or until a time), then drag tasks in from suggestions (in progress, due soon,
high priority), in the order you'll do them. The suggestions can be narrowed
to a tag, and a task thought of while planning can be added from under the
plan: it goes to the Inbox and the end of the plan. A task's time in the plan is its
estimate, the same one as on its page: set or changed in the plan, it's saved
to the task, and a task with none counts as half an hour until it has one.
It's yours to read as a target or a timebox. Every task links to its page,
and a plan being made survives a look there (not a reload). While the
session runs, the task under way counts down, then counts up as "over" with
the rest of the plan sliding later; nothing moves on by itself. Done ticks
the task off, Stop here leaves it open, and either goes on to the next; Undo
(or ⌘Z) takes that back until the next change, and ⇧⌘Z redoes it. A task
deleted while under way stops there, keeping its time, and the session waits
to start the next; restored (an undo), it's back in its place in the plan. The plan can be changed at any point:
the top of what's still to do is the task under way, so putting another
above it starts that one, the other waiting next. Ending shows what got done,
what was worked on and what wasn't reached, with planned against spent time
and a note. Sessions are kept on the server, one under way per person,
so agents can see when you're in one, and the time spent on each task in
them is there for checking estimates later.

Still open: should unassigned tasks in a shared domain appear in everyone's
Today, or in a separate "unclaimed" list?

## The query language

One small language is used by saved filters, focus, the CLI, the API
(`?q=`) and agents:

```
domain:H status:open due:<=friday energy:low
tag:errand -tag:waiting-on (priority:urgent or priority:high)
assignee:me project:"Kitchen renovation" scheduled:today
```

It's designed for agents first. People mostly use the filter builder, or
say what they want and let an agent write the query. It's strict, with
helpful errors (`unknown field 'prio', did you mean 'priority'?`), it has a
documented grammar, and a query string compiles to a JSON form that the API
also accepts. Relative dates (`today`, `friday`, `+3d`) mean the same thing
here as in CLI flags. A prefix (e.g. `cf.`) is reserved for custom fields.

Plain words in a query, not `field:value`, find tasks by their title or
notes: every word in one or the other, in any case, those still to do and
found by title first. Until the language exists, the API's `?search=` does
just that. In the app, each list has a search box (`/`) that narrows it as
you type, its finished tasks included, and ⌘K finds any task, whatever its
status, as well as commands.

## Agents and the API

The API is the product: an HTTP JSON API with an OpenAPI spec generated from
the Zod schemas in `shared`.

- **Agents are identities.** Each agent ("Claude Code", "Morning briefing")
  belongs to a person and has its own API keys. The key decides which agent
  is acting, so an agent can't claim to be someone else. An agent can also
  send an optional, unverified context label (`TAXA_AGENT_CONTEXT="mdr/taxa
  repo"`), which is stored with its changes.
- **Keys are scoped:** read or write, optionally limited to some domains. An
  agent's access is its owner's access narrowed by its key's scopes. Keys
  are stored hashed and shown once. `taxa` keeps them in a credentials
  file readable only by its owner, as named identities: the person by
  default, and an agent with `--as` or `TAXA_AS`, which Claude Code sets
  for its sessions. That labels agents' changes honestly; it isn't a
  boundary, since an agent could pick the person's identity.
- **Assign vs delegate:** people are assigned tasks and stay accountable.
  Agents are delegated tasks to work on.
- **The activity log** records every change with its actor (a person or an
  agent). The UI marks automated changes clearly, and anything can be
  undone from the log: each entry records the version it brought the task
  to, and undoing it puts back each field it changed, unless one has been
  changed since. Undoing an addition deletes the task, undoing a deletion
  restores it, and an undo is itself an entry, so undoing it redoes.
  `taxa undo` names the change by its number in the log rather than taking
  the last, which may be someone else's. In the
  web app, ⌘Z undoes the tab's last change and ⇧⌘Z redoes it; an offer to
  undo something on a page (a tick, a deletion) stands only until another
  change is made, after which ⌘Z takes back that one. Whatever a page shows
  of tasks (a plan being made, a session) follows what an undo does to them.
  However slow the network, ⌘Z takes back the last change asked for, waiting
  for its answer if need be, and a change asked for after an undo waits for
  it, so builds on it; an undo that can't reach the server keeps the change,
  to try again.
- **The CLI (`taxa`)** wraps the API. It prints readable output by default,
  `--json` for machines, takes JSON on stdin, has meaningful exit codes, and
  never prompts unless asked to. It gives each task's link in the web app
  (`taxa add`, `taxa show` and `--json`), so agents can hand people one. In v1, tasks are created with explicit
  flags (`taxa add "Pay council tax" --domain H --due friday`). A Claude
  Code skill teaches agents to use it.
- **The attention list** (`taxa attention`) is what needs a person's
  attention: follow-ups that have come round, tasks due or overdue,
  new assignments, stale claims. The Today view and agents both read it.
  Email and push notifications are later work; v1 notifies only inside the
  app.

## Concurrency, sync and offline

No CRDTs. The server is the source of truth, and the design supports
offline editing from the start, even though it ships in stages.

- **Writes are operations that express intent**, not whole-record
  snapshots: "set due date", "add tag", "complete", "move to project". Two
  people changing different fields, or adding different tags, never clash.
- **Versions:** every record has a version number. A client can send
  `If-Match` and get `409 Conflict` instead of overwriting a change it
  didn't see. The CLI and agents do this for read-modify-write.
- **Idempotency keys** make retries safe, so a timed-out create doesn't
  produce two tasks.
- **Manual order** uses fractional indexing, so reordering never renumbers
  other tasks.
- **IDs come from the client** (UUIDv7), so a task created offline is a
  real task straight away.
- **Change feed:** every change is in the activity log with an increasing
  sequence number. `GET /changes?since=N` (`taxa changes`) tells a client or
  agent what has changed, and the web app gets live updates over
  Server-Sent Events, driven by Postgres `LISTEN/NOTIFY` behind a small
  interface (PGlite in tests, `pg` in production).
- **Offline:** the web app keeps a full copy of the person's data in
  IndexedDB and queues operations while offline. Back online, the server
  replays the queue on top of whatever happened meanwhile, and the client
  catches up from the change feed. When both sides changed the same field,
  the server detects it from the operation's base version. The later change
  wins, the overwritten value is kept in the activity log, and the person
  sees a "changed while you were offline" notice with undo.
- **Deletes are soft** (`deleted_at`), so they sync like any other change
  and give us a trash. They can be cleaned up later.
- If several people ever need to edit the same notes at once, Yjs could be
  used for notes alone.

## People and sign-in

- People sign in with Google, checked against an allowlist of email
  addresses. There's no sign-up. Sessions use secure, HTTP-only cookies.
  Local development has a dev-mode login. Passkeys may come later.
- Agents and the CLI use API keys (see above).

## Technology

- TypeScript throughout, in a pnpm monorepo: `shared`, `server`, `web`, `cli`.
- Server: Hono on Node, Postgres with Drizzle. Postgres 17, the same major
  version as PGlite.
- Web: React with Vite, and a PWA later. State and side effects live in
  services, after the Providerish pattern from earlier projects: a plain
  class owns a piece of state and every action that changes it, takes its
  outside world (API, cache, clock) through its constructor, and is read
  from components through selectors. Services are tested without rendering.
  TanStack Query caches server data for now. With live updates (Stage 3)
  and the offline copy (Stage 5), an app-wide store service will own the
  local copy of the person's data, the queue of operations waiting to send
  and the change feed, and TanStack Query goes.
- Tooling and conventions follow mdr/whereabouts: Vite+ (Oxfmt and
  type-aware Oxlint), Knip, Stryker, Taskfile, lint for folder size and
  package boundaries, and a Nix flake for the development shell.
- Hosting: local for now, probably Fly.io with managed Postgres later.

## Testing

- **Unit tests** cover pure logic: the query language, date semantics,
  replaying operations, fractional ordering, Markdown normalisation, ID
  resolution, and the rules for Today and attention.
- **IWBT** (`*.iwbt.ts`): the real server in the test's process, on a free
  port, a fake clock and a fresh PGlite database, driven through the HTTP
  API by test actors (people, agents, and the CLI run in-process). This is
  where concurrency, conflicts, retries, offline replay, stale claims and
  scope security get tested deterministically.
- **IWFT** (`*.iwft.ts`): Playwright drives the web app against that
  in-process server. The `taxa` fixture sets up data, acts as other people
  and agents, moves the clock and checks results. Tabs are refused anything
  beyond localhost. Offline behaviour is tested with the browser set
  offline.
- **e2e**: a few specs against the real dev servers and Postgres.

## Backlog

Not in v1, but the design shouldn't rule any of them out:

- Recurring tasks (RRULE), dependencies, sequential projects (only the next
  task available)
- Google Calendar: free/busy, then time blocks. Scheduling suggestions
- Reminders by email or push. Urgent items breaking through a focus.
  Switching focus on a schedule
- Attachments in S3-compatible storage (S3, B2, R2, Tigris), with signed URLs
- An MCP server for Claude on the web and phone
- AI in the app: what to do now, auto-tagging, an agent-drafted daily plan,
  voice brain-dump capture
- Natural-language quick add, sharing the query language's vocabulary
- Project reviews (review interval, Review mode); daily planning and
  shutdown rituals
- Custom fields; a tunable urgency score
- This Evening, headings within projects, richer saved views, a triage
  inbox, a command palette, an Eisenhower view, habits, a focus timer
- Passkeys; a native mobile app if the PWA isn't enough
