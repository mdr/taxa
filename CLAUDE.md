Taxa is a task manager for people and their agents. What it does and why is in `docs/design.md`, and the stages we're building it in are in `docs/plan.md`. Read them before changing behaviour, and keep them current when a decision changes.

## Changelog

- A change someone using Taxa would notice (the web app, the CLI, the API, running the server) adds a line under `## Unreleased` in `CHANGELOG.md`, in the same commit, under `### New`, `### Changed` or `### Fixed`. Say what it does for them in plain words, and how to use it (the command, the button), not how it's built. Refactors, tests, tooling and design notes don't go in.

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

## Logs and analytics

- Both server and web log through `createLogger` (`@taxa/shared/telemetry/log`): a record has a `time` (from the injected `Clock`), a `level` (`ERROR`, `WARN`, `INFO`, `DEBUG`), a `code`, a short human `msg` that nothing matches on, and `fields`. The logger sends each record to its destinations: standard output as flat JSON lines on the server, the console in the browser for now.
- A `code` is unique and `group.event`, lowerCamel, from a package's registry (`LOG_CODES.group.event`, constants, not an enum; a test checks each code matches where it's filed). Fields are camelCase with units in their names (`openMs`); errors go in `err`.
- Fields carry identifiers for cross-referencing (`userId`, `agentId`, `taskId`, `taskRef`, `domainId`…) and small facts (a status, the names of the fields changed). Never what people wrote (titles, notes, names), nor tokens or API keys.
- Server: every request that changes data logs one `INFO` line once it's committed, saying who changed what (`task.updated`, with `userId`, `agentId`, `taskId`, `version` and the changed fields' names). Reads log nothing unless something goes wrong. A change that changed nothing isn't logged.
- Web: logs are for what happens to the app (`app.started`, uncaught errors, failed requests). Analytics are for what people do (`nav.pageOpened`, `task.captured`, `task.changed`, `shortcut.used`…), through `Analytics.track`, which writes them to the log at `INFO`. Their codes are in `ANALYTICS_CODES`, apart from `LOG_CODES`. Services take `Analytics` and a logger through their constructors; tests use `testTelemetry()` and assert on what was tracked.
- Track every interaction with a control, not only what's submitted: going somewhere, creating, changing or deleting something, running a command, copying, changing a setting, opening, showing or closing something (menus, pickers, dialogs), choosing an option, editing a field (once, when the edit is finished, not per keystroke), moving through a picker (a date picker's months), and formatting buttons. Only trivial interaction is left out: individual keystrokes in a text field, scrolling, pointer movement, hovering, and moving focus (Tab through controls).
- Controls are tracked without remembering to, as `ui.*` analytics carrying only the control's name (`Component.what`), never what was typed or chosen. Every `<button>`, `<input>`, `<textarea>`, `<select>` and `<dialog>` has `data-track="Component.what"`, which lint requires; one listener on the document (`useUiTracking`) tracks clicks, toggles, edits once committed, and dialogs closing. `Popover`, `OptionList` and `DatePicker` require a `track` prop and track themselves (opening, closing, choosing); controls a component tracks itself have `data-track=""`. Events about the data (`task.changed`) are tracked as well, where it changes.

## Folders

- When several files in a folder share a prefix for one area (`task-*`), give them a subfolder named after it, whatever the folder's size.
- A folder holds at most 30 entries, about one editor screen; lint enforces it.

## Components

- A `.tsx` file exports one component, with its own CSS module and `*TestIds.ts`. A helper component may stay in the file if it is unexported, used only there, and short (about 30 lines).
- CSS modules are typed: `scripts/css-module-types.ts` writes a declaration beside each one, so a class missing from its CSS fails the typecheck.

## Services

- Web state with side effects lives in a service (`web/src/services/`), not in components or hooks. A service extends `AbstractService<XState>` and `implements XActions`; actions are arrow-function fields, so they survive being destructured.
- Its outside world comes in through the constructor as interfaces (`TaskChangesApi`, `TaskCache`, a `Scheduler` for timers, a `Clock`), so tests can give it the real in-process server or a fake.
- Components read state through `useServiceState(service, selector)`, one value per call (it throws if a selector builds a new value). A service that components below its owner use also has a context and hooks: `useX()` for its actions, and selector hooks.
- Build a service once, where its lifetime begins (`useState(() => new XService(…))`, with `useEffect(() => service.dispose, [service])` if it holds anything), never inline in JSX. The app owns app-wide ones; a page or component owns its own, and its key decides when a new one starts.
- Test a service by calling its actions and asserting on `service.state`; with the in-process server that's a `*.iwbt.ts` beside it.

## Tests

- Two levels: unit tests of services and pure functions (quick, run often), and IWFTs of the whole web app in a browser (slower, run less). Nothing renders a component on its own: move its logic into a service or pure function and unit-test that. A behaviour may be tested at both levels.
- Specify only the data the scenario needs; `makeX` factories supply defaults.
- API behaviour: `*.iwbt.ts` specs against the in-process server (`useInProcessServer`): the real server in the test's process, on a fake clock and a fresh PGlite database, driven through the HTTP API by test actors' steps. The CLI's specs run `taxa` in-process against the same server (`runTaxa`).

## Browser tests

- A spec reads like a manual test script, in the app's own words ("add Fix the tap to the plan", "expect it to be done"): never locators, test IDs or how the app is built.
- A page object for each screen, and for a part of one that's used on its own (the plan editor, the sidebar). A step that goes to another screen returns that screen's page object.
- Checks are page object `expect…` methods too, which verify it however it takes; specs never see locators. Data on the server: the `taxa` fixture's `expect…` methods.
- Positive checks always retry until they pass or time out: web-first assertions, or `expect.poll` around anything that doesn't retry by itself.
- Each page object method shows in a failing test's log as a step, `Class.method args`: the `PageObject` base class wraps them.
- Locate by test ID. Where a test ID alone identifies a state, assert on its presence rather than text or attributes.
- State that ARIA already expresses (`aria-pressed`…): assert the ARIA attribute.
- Page state: web-first assertions (`toHaveText`, `toBeVisible`…). Other state: `expect.poll`.
- "Doesn't happen" checks hold over time, after a positive check.
- Check each screen with axe (WCAG A/AA) through its page object's `expectAccessible`: fix the app, don't skip the rule.
- Tests never assume a fixed port or shared state, so runs in other worktrees can go at the same time.
- `*.iwft.ts` specs run against the in-process server through the `taxa` fixture (`browser/fixtures/taxa-fixture.ts`), which opens tabs, sets up and checks data, and moves the clock. A tab is refused anything beyond localhost, and such a request fails the test.
