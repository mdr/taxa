# Taxa

A task manager built for people and their agents: one well-structured
database of tasks behind an API, used from a web app, a phone, the `taxa`
CLI, and AI agents such as Claude Code.

- What it does and why: [docs/design.md](docs/design.md)
- How we're building it, stage by stage: [docs/plan.md](docs/plan.md)
- Conventions for working on the code: [CLAUDE.md](CLAUDE.md)

## Run

```sh
nix develop        # or let direnv load the shell
pnpm install
task dev           # starts the local Postgres, then the web app on
                   # http://localhost:5173 and the API server on :8787
taxa health        # the CLI; the dev shell puts bin/ on the PATH
```

There's no sign-in yet: `task dev` runs the server with a development
login, so the web app, and `taxa` without an API key, act as Matt
(`TAXA_DEV_USER` changes the name). The API is described at
http://localhost:8787/api/openapi.json.

`taxa --help` lists the commands. To act as an agent rather than as
yourself, make one and give it a key:

```sh
taxa add-agent "Claude Code"              # prints its id
taxa add-key "Claude Code" --agent <id>   # prints the key's secret, once
```

Agents pass the key as `TAXA_API_KEY`, and can say what they're working
on with `TAXA_AGENT_CONTEXT`. The Claude Code skill in
`.claude/skills/taxa` teaches agents to use `taxa`.

To use `taxa` outside this repository, install the flake's package
(`nix build .#taxa`, or `taxa.packages.${system}.taxa` from another
flake). It's the CLI bundled into one file and run by Node, with the skill
at `share/claude/skills/taxa/SKILL.md`, to link into `~/.claude/skills`.
When the lockfile changes what the CLI depends on, its build fails with a
hash mismatch: put the hash it got in `nix/taxa-cli.nix`.

`task db:start` creates a Postgres cluster in `.data/postgres` the first time
(port 5433, override with `DB_PORT`), and `task db:stop` stops it. `task
--list` shows everything else.

## Packages

- `packages/shared`: Zod schemas, types and pure logic every other package uses.
- `packages/server`: the HTTP API (Hono) over Postgres (Drizzle).
- `packages/web`: the web app (React and Vite).
- `packages/cli`: `taxa`, the command-line client.

## Check

- `task check` (`pnpm check`): formatting (Oxfmt), type-aware lint (Oxlint
  through Vite+), the typecheck, Knip (unused files, exports and
  dependencies), and the tests that run in Vitest:
  - unit tests (`*.test.ts`) of pure logic;
  - `*.iwbt.ts`, the isolated whole-backend tests: the real server inside
    the test's process, on a free port, a fake clock and a fresh in-memory
    Postgres (PGlite), driven through its HTTP API. The CLI's are here too:
    `taxa` runs in-process against the same server.
- `task iwft`: the isolated browser tests (`packages/web/browser/tests/*.iwft.ts`),
  run by Playwright in your installed Chrome. A Vite dev server of their own
  serves the web app on a free port; each test starts the API server in its
  own process through the `taxa` fixture, and points the tab's app at it. A
  request beyond localhost fails the test. Output and a report go to
  `smoke-out/`.
- `task mutate -- 'packages/shared/src/**/*.ts'`: mutation testing with Stryker.
