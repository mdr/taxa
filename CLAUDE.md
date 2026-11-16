Taxa is a task manager for people and their agents. What it does and why is in `docs/design.md`, and the stages we're building it in are in `docs/plan.md`. Read them before changing behaviour, and keep them current when a decision changes.

## Code comments

- Add a comment only when the reason for the code isn't obvious from the code itself. Most code needs none.
- When a comment is needed, write only what a future reader needs: the non-obvious reason or constraint, in as few words as possible.
- Leave out incidental detail, background the reader doesn't need, restating what the code does, and the history of how we got here. That history belongs in the commit message, if anywhere.

## Code

- Write TypeScript, not JavaScript, scripts included (a test fails on a tracked `.js`/`.mjs`/`.cjs`). Code runs on Node with `--experimental-transform-types`, so string enums work everywhere.
- String enums with ALL_CAPS names and values; reference members, not raw strings.
- Except values whose literal types an outside library owns: an `as const` object, so its types apply.
- Discriminators are called `type`. Variants are unions of named types, not a base interface plus intersections.
- Full-word names. `undefined`, not `null`. Postgres and Drizzle hand back `null`: convert at the database layer (`?? undefined`), so the rest of the code never sees it. On the wire, clearing a field is an explicit list of fields to clear, never a `null`.
- Never derive display text from code names (enum values, keys) by changing case; map each to its text.
- Write the actual type, not an indirection like `Task["status"]`, unless it is very complex or inexpressible.
- Annotate functions' return types. Not needed for React components, nor where the type is too complex to write (then ask whether the function should be simpler).
- Small modules, one job each; pull pure logic out so it can be unit-tested.
- Nothing reads the system clock directly: take a `Clock` (`@taxa/shared/clock`), so tests decide what time it is.

## Packages

- `shared`: types, Zod schemas and pure logic used by the others. No I/O, and it imports none of them.
- `server`: the Hono API over Postgres (Drizzle). `web`: the React app. `cli`: `taxa`. Each imports only `shared`; tests may start an in-process server through `server/src/test-support/`. Lint enforces both (`lint/boundaries`).

## Logs

- Server logs are flat JSON lines through a `LogEvent`: a `code` from `LOG_CODES` (constants, not an enum: `LOG_CODES.group.event`, valued `"group.event"`, lowerCamel, grouped by subject), a short human `msg`, and camelCase fields with units in their names (`openMs`). Errors go in `err`. Never log task content, tokens or API keys.

## Folders

- When several files in a folder share a prefix for one area (`task-*`), give them a subfolder named after it, whatever the folder's size.
- A folder holds at most 30 entries, about one editor screen; lint enforces it.

## Components

- A `.tsx` file exports one component, with its own CSS module and `*TestIds.ts`. A helper component may stay in the file if it is unexported, used only there, and short (about 30 lines).
- CSS modules are typed: `scripts/css-module-types.ts` writes a declaration beside each one, so a class missing from its CSS fails the typecheck.

## Tests

- Two levels: unit tests of services and pure functions (quick, run often), and IWFTs of the whole web app in a browser (slower, run less). Nothing renders a component on its own: move its logic into a service or pure function and unit-test that. A behaviour may be tested at both levels.
- Specify only the data the scenario needs; `makeX` factories supply defaults.
- API behaviour: `*.iwbt.ts` specs against the in-process server (`useInProcessServer`): the real server in the test's process, on a fake clock and a fresh PGlite database, driven through the HTTP API by test actors' steps. The CLI's specs run `taxa` in-process against the same server (`runTaxa`).

## Browser tests

- Page objects offer `expect…` methods; specs never see locators.
- Locate by test ID. Where a test ID alone identifies a state, assert on its presence rather than text or attributes.
- State that ARIA already expresses (`aria-pressed`…): assert the ARIA attribute.
- Page state: web-first assertions (`toHaveText`, `toBeVisible`…). Other state: `expect.poll`.
- "Doesn't happen" checks hold over time, after a positive check.
- Check each screen with axe (WCAG A/AA) through its page object's `expectAccessible`: fix the app, don't skip the rule.
- Tests never assume a fixed port or shared state, so runs in other worktrees can go at the same time.
- `*.iwft.ts` specs run against the in-process server through the `taxa` fixture (`browser/fixtures/taxa-fixture.ts`), which opens tabs, sets up and checks data, and moves the clock. A tab is refused anything beyond localhost, and such a request fails the test.
