---
name: taxa
description: Read and update Matt's tasks in Taxa with the `taxa` CLI. Use when asked to add, find, check, plan, claim, update or finish tasks or to-dos, when a task reference like H-142 comes up, when work you're doing should be recorded against a task, or when you finish or get blocked on work that came from one.
---

# Taxa

Taxa is Matt's task manager. You use it through `taxa`, which wraps its
HTTP API. Run `taxa --help` and `taxa <command> --help` for the details;
this page is how to use it well.

## Who you are

`TAXA_API_KEY` decides who you act as. With an agent's key, every change
you make is recorded as that agent, acting for Matt. Set
`TAXA_AGENT_CONTEXT` to what you're working on (a repo, a session) so
Matt can tell your changes apart: `export TAXA_AGENT_CONTEXT="mdr/taxa"`.
`taxa whoami` says who the server thinks you are: check it before your
first change.

Never print, log or echo the API key. If it's missing, say so; don't
look for one.

Against the local development server (`task dev`), calls without a key
act as Matt himself. `TAXA_SERVER` says where the server is
(`http://localhost:8787` by default).

## Reading

Use `--json` whenever you'll act on the output: it prints exactly what
the API answered.

```sh
taxa list --json                    # active tasks, most urgent first
taxa list --domain H --json         # one domain's
taxa list --inbox --json            # not yet organised
taxa list --status done,cancelled --json
taxa list --search "council tax" --json  # every word in the title, notes or tags
taxa list --tag "Life Admin" --json
taxa list --follows-on H-142 --json  # what H-142 led to
taxa show H-142 --json              # one task, everything about it
taxa show H-142                     # readable, with what it came from and led to
taxa log H-142                      # every change, with who made it
taxa domains --json
```

A task is named by its reference (`H-142`), its number alone (`142`) or
its id. The number never changes, so `H-142` still works after it moves.

## Changing

```sh
taxa add "Pay council tax" --domain H --due fri --priority high --estimate 30m
taxa edit H-142 --due +3d --clear scheduled
taxa edit H-142 --append-notes "Rang the garage: they'll call back Thursday."
taxa edit H-142 --tag "Life Admin" --untag errand
taxa add "Dispose of the old disks" --domain H --follows-on H-142
taxa start H-142                    # you're working on it: a claim others can see
taxa wait H-142 --on "Dave's quote" --follow-up mon
taxa done H-142
taxa cancel H-142 --reason "Not needed after all"
taxa reopen H-142
taxa delete H-142                   # soft: taxa restore brings it back
```

Dates are `YYYY-MM-DD`, `today`, `tomorrow`, a weekday (`fri`), `+3d` or
`+2w`. Without `--domain`, a new task goes into the Inbox of Matt's
default domain.

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
  already in progress by someone else, ask Matt before taking it over.
- **Matt's notes are his.** Report progress with `--append-notes`, which
  adds to the end and keeps what's there. Never `--notes` on a task you
  didn't create: it replaces them all.
- **Say what happened.** As you go, and when you finish, append a short
  note: what you did, what you found, what's left. Don't mark something
  done you haven't checked.
- **Blocked?** `taxa wait H-142 --on "..."` with a note saying why, rather
  than leaving it in progress. What's left over that's new work is a new
  task with `--follows-on`.
- **Ask before deleting or cancelling** anything you didn't create, or
  changing the priority, dates or domain of Matt's tasks: suggest it in a
  note instead.

Exit codes: 0 OK, 1 failed (including no key or no server), 2 bad usage,
3 the task changed since `--if-version`, 4 not found. Errors go to stderr;
with `--json`, the API's problem is printed on stdout too.
