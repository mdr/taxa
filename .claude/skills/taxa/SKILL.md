---
name: taxa
description: Read and update your user's tasks in Taxa with the `taxa` CLI. Use when asked to add, find, check, plan, claim, update or finish tasks or to-dos, when a task reference like H-142 comes up, when work you're doing should be recorded against a task, or when you finish or get blocked on work that came from one.
---

# Taxa

Taxa is your user's task manager. You use it through `taxa`, which wraps its
HTTP API. Run `taxa --help` and `taxa <command> --help` for the details;
this page is how to use it well.

## Who you are

You act as your own agent, never as your user: every change you make is
recorded as that agent, acting for them. `taxa` takes the key from an
identity in `~/.config/taxa/credentials`; Claude Code sets `TAXA_AS` to
yours, so you needn't pass `--as`. Never use `--as` or `TAXA_API_KEY`
to act as anyone else. Set
`TAXA_AGENT_CONTEXT` to what you're working on (a repo, a session) so
your user can tell your changes apart: `export TAXA_AGENT_CONTEXT="mdr/taxa"`.
`taxa whoami` says who the server thinks you are: check it before your
first change. If it names your user rather than an agent, stop and tell them.

Never print, log or echo a key, and never read the credentials file. If
`taxa` says it has no valid key or no such identity, tell your user; don't look
for one.

Against the local development server (`task dev`), calls without a key
act as your user themselves. `TAXA_SERVER` says where the server is
(`http://localhost:8787` by default).

## Reading

Use `--json` whenever you'll act on the output: it prints exactly what
the API answered, with each task's `url` in the web app added. Give your user
that link whenever you mention a task you added or changed; `taxa add`
and `taxa show` print it too.

```sh
taxa list --json                    # active tasks, most urgent first
taxa list --domain H --json         # one domain's
taxa list --inbox --json            # not yet organised
taxa list --status done,cancelled --json
taxa list --search "council tax" --json  # every word in the title, notes, tags or comments
taxa list --tag "Life Admin" --json
taxa list --follows-on H-142 --json  # what H-142 led to
taxa show H-142 --json              # one task, everything about it
taxa show H-142                     # readable, with what it came from and led to, and the latest comments
taxa comments H-142                 # what's happened on it, oldest first
taxa log H-142                      # every change, with who made it
taxa domains --json
```

A task is named by its reference (`H-142`), its number alone (`142`) or
its id. The number never changes, so `H-142` still works after it moves.

## Changing

```sh
taxa add "Pay council tax" --domain H --due fri --priority high --estimate 30m
taxa edit H-142 --due +3d --clear scheduled
taxa comment H-142 "Rang the garage: they'll call back Thursday."
taxa comment H-142 - < update.md    # longer Markdown, from a file or a heredoc
taxa edit-comment <id> "..."        # fix a comment of yours; ids are in taxa comments
taxa delete-comment <id>            # taxa restore-comment <id> brings it back
taxa edit H-142 --tag "Life Admin" --untag errand
taxa add "Dispose of the old disks" --domain H --follows-on H-142
taxa start H-142                    # you're working on it: a claim others can see
taxa wait H-142 --on "Dave's quote" --follow-up mon
taxa done H-142
taxa cancel H-142 --reason "Not needed after all"
taxa reopen H-142
taxa delete H-142                   # soft: taxa restore brings it back; taxa list --deleted shows the bin
taxa undo H-142 --version 3         # takes back change 3 from taxa log (find your own there first)
```

Repeating tasks keep one ref for good. `taxa done` on one does it this
time: it records that occurrence and moves the task on to its next date,
still open. Don't cancel one (it's refused): skip this time, or stop it
repeating. Days that go by undone are skipped (recorded as missed when it's
next changed, and it moves on) for a daily one, and carried over (it waits,
overdue) otherwise; `--missed` changes that.

```sh
taxa add "Revise Anki cards" --repeat daily     # or: every weekday, every monday and thursday,
                                                # monthly on the 1st, 3 days after done
taxa done H-142                     # done this time; taxa show lists what's happened lately
taxa skip H-142                     # not this time
taxa edit H-142 --missed carry-over # or skip: what becomes of days that go by undone
taxa edit H-142 --repeat none       # stop it repeating; taxa done H-142 --stop-repeating ends it
```

A task can have a **checklist**: steps, ticked off one at a time, for work
whose parts are known up front (accounts to move, passwords to change).
Lists show how far through it is (`checklist 3/8`). An item is named by its
number in `taxa checklist`, or by its text (or enough of it to tell). When
you work through one, tick each item as it's done, and comment on anything
worth saying about it. An item that turns into real work of its own (a
date, a wait, a reply to chase) can become a task with `taxa item-to-task`:
the item stays, ticked when that task is done.

```sh
taxa add "Move charitable giving" --item Oxfam --item Shelter
taxa add-item H-142 RSPB Crisis             # each argument an item; or - for a line each from stdin
taxa checklist H-142                        # numbered, ticked ones [x]
taxa check H-142 1 rspb                     # tick by number or text; taxa uncheck unticks
taxa edit-item H-142 3 "RSPB (monthly)"
taxa remove-item H-142 crisis
taxa item-to-task H-142 oxfam               # a task of its own, following on from H-142
```

Dates are `YYYY-MM-DD`, `today`, `tomorrow`, a weekday (`fri`), `+3d` or
`+2w`. Without `--domain`, a new task goes into the Inbox of your
user's default domain.

For several fields at once, or text with awkward quoting, pipe JSON in
with `-`. The shapes are the API's (`/api/openapi.json`):

```sh
echo '{"title": "Book MOT", "domain": "H", "due": "2026-03-01"}' | taxa add - --json
echo '[{"title": "One"}, {"title": "Two"}]' | taxa add - --json
echo '{"set": {"priority": "HIGH"}, "clear": ["due"]}' | taxa edit H-142 - --json
```

## Working safely

- **Read, then change with `--if-version`.** When a change depends on what
  you read, pass the version you read: `taxa edit H-142 --if-version 4 ...`.
  If someone changed it since, nothing is changed and taxa exits 3: show
  it again, rethink, and retry.
- **Retries:** `taxa add --idempotency-key KEY` never adds the same task
  twice, however often it's retried. Use one key per task you mean to add.
- **Claim before you work.** `taxa start` marks a task as yours. If it's
  already in progress by someone else, ask your user before taking it over.
- **Notes say what the task is; comments say what's happened.** Your
  user's notes are theirs: never `--notes` on a task you didn't create, as it
  replaces them all. Report progress with `taxa comment`, which leaves the
  task as it is.
- **Say what happened.** As you go, and when you finish, add a short
  comment: what you did, what you found, what's left. Don't mark something
  done you haven't checked. Link files on this Mac as
  `[letter.md](vscode://file/<absolute path>/letter.md)`, which opens them in
  VS Code; `file://` links don't work.
- **Blocked?** `taxa wait H-142 --on "..."` with a comment saying why, rather
  than leaving it in progress. What's left over that's new work is a new
  task with `--follows-on`.
- **Ask before deleting or cancelling** anything you didn't create, or
  changing the priority, dates or domain of your user's tasks: suggest it in a
  comment instead.

Exit codes: 0 OK, 1 failed (including no key or no server), 2 bad usage,
3 the task changed since `--if-version`, 4 not found. Errors go to stderr;
with `--json`, the API's problem is printed on stdout too.
