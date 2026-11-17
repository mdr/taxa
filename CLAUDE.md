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
- Full-word names. `undefined`, not `null`. Drizzle reads and writes empty columns as `null`: convert in the `*-rows.ts` modules, the only place lint lets `null` appear (besides React's `useRef(null)` for elements), so the rest of the code never sees it. On the wire, clearing a field is an explicit list of fields to clear, never a `null`.
- Never derive display text from code names (enum values, keys) by changing case; map each to its text.
- Model values with meaning as their own types, not bare `string` or `number`:
  - Identifiers and formatted strings are branded (`TaskId`, `DomainPrefix`, `TaskRef`, `TimeZone`…): a schema that checks and brands, and a constructor that parses with it (`taskId(text)`), so one kind can't stand in for another nor a plain string for any. Wire schemas and database columns (`.$type<TaskId>()`) use them, so values come out branded wherever they're read.
  - Quantities and values often written by hand are flavours (`Instant`, `Ms`, `Minutes`, `Version`, `IsoDate`…, through `Flavour` in `@taxa/shared/units`): a plain value is accepted and arithmetic needs no wrapping, but one flavour can't be passed as another.
  - Text a person typed to name something (`H-142`, `142` or an id; a prefix or a domain id) stays a `string` until it's parsed.
- Write the actual type, not an indirection like `Task["status"]`, unless it is very complex or inexpressible.
- Annotate functions' return types. Not needed for React components, nor where the type is too complex to write (then ask whether the function should be simpler).
- Small modules, one job each; pull pure logic out so it can be unit-tested.
- Nothing reads the system clock directly: take a `Clock` (`@taxa/shared/clock`), so tests decide what time it is.

## Packages

- `shared`: types, Zod schemas and pure logic used by the others, and `TaxaClient`, the typed API client, which is its only I/O (through the `fetch` it's given). It imports none of the others.
- `server`: the Hono API over Postgres (Drizzle). `web`: the React app. `cli`: `taxa`. Each imports only `shared`; tests may start an in-process server through `server/src/test-support/`. Lint enforces both (`lint/boundaries`).

## Logs

- Server logs are flat JSON lines through a `LogEvent`: a `code` from `LOG_CODES` (constants, not an enum: `LOG_CODES.group.event`, valued `"group.event"`, lowerCamel, grouped by subject), a short human `msg`, and camelCase fields with units in their names (`openMs`). Errors go in `err`. Never log task content, tokens or API keys.

## Folders

- When several files in a folder share a prefix for one area (`task-*`), give them a subfolder named after it, whatever the folder's size.
- A folder holds at most 30 entries, about one editor screen; lint enforces it.

## Components

- A `.tsx` file exports one component, with its own CSS module and `*TestIds.ts`. A helper component may stay in the file if it is unexported, used only there, and short (about 30 lines).
- CSS modules are typed: `scripts/css-module-types.ts` writes a declaration beside each one, so a class missing from its CSS fails the typecheck.

## Services

- Web state with side effects lives in a service (`web/src/services/`), not in components or hooks. A service extends `AbstractService<XState>` and `implements XActions`; actions are arrow-function fields, so they survive being destructured.
- Its outside world comes in through the constructor as interfaces (`TaskChangesApi`, `TaskCache`, a `Clock`), so tests can give it the real in-process server or a fake.
- Each module exports its state and actions interfaces, the class, a context, and hooks: `useXActions()` / `useX()` for actions, and selector hooks that pick one value from the state (`useServiceState` throws if a selector builds a new value).
- Build a service once (`useState(() => new XService(…))` or a module constant), never inline in JSX.
- Test a service by calling its actions and asserting on `service.state`; with the in-process server that's a `*.iwbt.ts` beside it.

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
