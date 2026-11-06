---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 40
plan_row: W18 (wave B1)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete
---

# 18 Light Live API and the settle helper HB-15 (blueprint step 40, plan row W18)

Row, verbatim: [W18] Light Live API with the settle helper HB-15: `useCoreActions`, `coreActionsOf`,
`settle`, the two error classes, mode helpers and hooks; no network code. Writes:
`packages/shared/src/live/{index,settle,core-actions,errors,mode,hooks}.ts`,
`packages/shared/test/live-light-*.test.ts`. Locks: none. Implements AC-C-02, AC-C-06 (identity part),
AC-C-09. Rollback R-NEW.

**Result line: done and verified.** `@dems/shared/live` now exports the light API from six files with
no network code. `@dems/shared`: **680 passed of 680 in 37 files** (587 in 31 files when this row
started; 93 new tests in six `live-light-*` files; no existing test file touched). Typecheck and lint
of `@dems/shared` exit 0; typecheck of `@dems/core-web` and `@dems/mobile` exit 0.

**Follow-up of 08:00 WIB (finding F40-2, decision D43): section 11.** A seventh light file,
`constants.ts`, holds the two display timings of the specification. `@dems/shared` now stands at
**689 passed of 689 in 38 files**; sections 1 to 10 describe the first delivery and are unchanged.

| Field | Value |
|---|---|
| Started / last run | 2026-10-04 07:37 WIB (baseline run 07:38:49) / final gate 07:54:15 to 07:54:40 WIB |
| Source files | 6 in `packages/shared/src/live/` (395 lines with comments); `settle` itself is 39 lines |
| Test files | 6 in `packages/shared/test/`, 93 tests |
| Dependencies | None added. No manifest, no lockfile and no export map edited |
| Simulator | Nothing under `packages/shared/src/sim/` written (P21). Read only |
| Network, storage, timers | None in the six files (static test, section 5.5) |

Abbreviations: [CS] = `masterplan/04_client_integration_spec.md`; [AN] = `research/03_analysis.md`;
[PL] = `masterplan/02_plan.md`.

---

## 1. What was done

1. Read the inputs: 02_structured (row 40; P6, P9, P10, P12, P21, P22, P24), 02_plan (W18 in section
   8.3; section 3.4), [CS] sections 1.7, 1.8, 2, 3, 6, 7.2, 8, 12, 13.1, 17; [AN] ADQ-2, ADQ-3;
   `implementation/03_npm_slot_n1_server_shared.md`; the code `packages/shared/src/sim/{index,react,
   errors,engine,types,vocabulary,auth,dataset}.ts`, `src/client/core-client.ts` (names only),
   `src/realtime/{heartbeat-client,heartbeat-context,use-heartbeat}.ts(x)`, the call sites
   `apps/core-web/src/features/system/use-sim-command.ts`,
   `apps/mobile/src/features/session-live/use-monitor.ts`,
   `apps/mobile/src/features/evidence/archive-dialog.tsx`.
2. Baseline taken before the first edit (section 6.1). P23 pre-image saved:
   `.cache/rollback/W18.pre.patch` (0 bytes: the folder is not in `acaff20`).
3. Wrote the six source files, then six test files.
4. Checked that the tests can fail: 23 runtime mutations and 6 type mutations, on an isolated copy
   outside the repository; all 29 are detected (section 6.5).
5. Checked the subpath under each client's compiler options with a probe outside the repository
   (section 6.4), and ran both client typechecks.

---

## 2. Files

| Path | Change | Lines |
|---|---|--:|
| `packages/shared/src/live/index.ts` | Replaced W03's one-line placeholder: the barrel of the five files below | 14 |
| `packages/shared/src/live/core-actions.ts` | Created: `CoreResult`, `CoreActions`, `coreActionsOf` | 32 |
| `packages/shared/src/live/settle.ts` | Created: `SettleHandlers`, `settle` (HB-15) | 100 |
| `packages/shared/src/live/errors.ts` | Created: `LiveTransportError`, `CoreRefusalError`, `LiveTransportReason`; re-export of the three simulator classes | 89 |
| `packages/shared/src/live/mode.ts` | Created: `CoreMode`, `DEFAULT_CORE_MODE`, `parseCoreMode`, `LiveLinkState`, `LiveHandle`, `liveOf`, `coreModeOf`, `liveLinkOf`, `corePermissionOf` | 92 |
| `packages/shared/src/live/hooks.ts` | Created: `useCoreActions`, `useCoreMode`, `useLive`, `useLiveLink`, `useCorePermission`. The only file that imports React | 68 |
| `packages/shared/test/live-light-settle.test.ts` | Created | 32 tests |
| `packages/shared/test/live-light-core-actions.test.ts` | Created | 9 tests |
| `packages/shared/test/live-light-errors.test.ts` | Created | 13 tests |
| `packages/shared/test/live-light-mode.test.ts` | Created | 13 tests |
| `packages/shared/test/live-light-hooks.test.ts` | Created | 14 tests |
| `packages/shared/test/live-light-platform-neutral.test.ts` | Created | 12 tests |
| `docs/.../implementation/18_live_light_api_settle.md` | Created: this file | |
| `docs/.../implementation/assets/18_*` (10 files) | Created: gate logs, the verbose test list, the mutation scripts and logs, the client probe and its log | |
| `docs/.../delegation_progress/coder_execution_step_40.md` | Created | |
| `.cache/rollback/W18.pre.patch` (git-ignored) | Created by P23, 0 bytes | |

Not touched: `packages/shared/src/live/source/**`, `src/live/testing/**` (SHA-256 of both placeholders
equal before and after: `c4dfa6da…`, `7f2b38b3…`), `src/client/**`, `src/api/**`, `src/sim/**`,
`src/realtime/**`, every `package.json`, the lockfile, every client file, every existing test file.

---

## 3. Public API of `@dems/shared/live`

22 run-time exports (pinned by the test "exports the light API and nothing else") and 10 types (three of them share their name with a constant: `CoreMode`, `LiveLinkState`, `LiveTransportReason`).

### 3.1 Actions (`core-actions.ts`, `hooks.ts`) [CS:CL-12]

```ts
type CoreResult<R> = R | Promise<R>;

type CoreActions = {
  [Name in keyof SimActions]: SimActions[Name] extends (...args: infer Args) => infer Result
    ? (...args: Args) => CoreResult<Result>
    : SimActions[Name];
};

function coreActionsOf(sim: Sim): CoreActions;   // returns sim.actions itself
function useCoreActions(): CoreActions;          // coreActionsOf(useSimInstance())
```

Same names, same parameter lists, every return type `R` widened to `R | Promise<R>`. `SimActions` is
assignable to `CoreActions`, so no cast and no wrapper exists. `CoreActions` is not assignable to
`SimActions`, so a call site that takes its actions from here cannot read a result without settling it.

### 3.2 `settle` (`settle.ts`) [CS:CL-25]

```ts
interface SettleHandlers<T> {
  ok?: (value: T) => void;
  fail: (error: unknown) => void;   // required
  done?: () => void;
}

function settle<T>(run: () => T | PromiseLike<T>, handlers: SettleHandlers<T>): void;
```

### 3.3 Errors (`errors.ts`) [CS:CL-20, CL-21]

```ts
export { SimNotFoundError, SimPermissionError, SimTransitionError } from '../sim/errors';

const LiveTransportReason = { CORE_OFFLINE: 'CORE_OFFLINE', UNAVAILABLE: 'UNAVAILABLE' } as const;
type LiveTransportReason = 'CORE_OFFLINE' | 'UNAVAILABLE';

interface LiveErrorDetails { status?: number | null; requestId?: string | null }
interface LiveTransportDetails extends LiveErrorDetails { code?: string | null; retryAfterSeconds?: number | null }

class LiveTransportError extends Error {
  readonly reason: LiveTransportReason;
  readonly status: number | null;
  readonly code: string | null;
  readonly retryAfterSeconds: number | null;
  readonly requestId: string | null;
  constructor(reason: LiveTransportReason, details?: LiveTransportDetails);
}

class CoreRefusalError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly requestId: string | null;
  constructor(code: string, details?: LiveErrorDetails);
}
```

### 3.4 Mode and the light view of a Live source (`mode.ts`, `hooks.ts`) [CS:§3.1, CL-15, TS-3]

```ts
const CoreMode = { SIMULATED: 'SIMULATED', LIVE: 'LIVE' } as const;
type CoreMode = 'SIMULATED' | 'LIVE';
const CORE_MODES: readonly CoreMode[];              // ['SIMULATED', 'LIVE']
const DEFAULT_CORE_MODE: CoreMode;                  // 'SIMULATED'
function parseCoreMode(value: unknown): CoreMode | null;

const LiveLinkState = { CONNECTING, ONLINE, STALE, OFFLINE, RESYNCING } as const;
type LiveLinkState = 'CONNECTING' | 'ONLINE' | 'STALE' | 'OFFLINE' | 'RESYNCING';

interface LiveSessionHint { readonly permissions: readonly string[] }
interface LiveHandle {
  readonly coreMode: 'LIVE';                        // the marker of a Live source
  readonly link: LiveLinkState;
  readonly session: LiveSessionHint | null;
  onLiveChange(listener: () => void): () => void;   // returns the unsubscribe function
}

function liveOf<Handle extends LiveHandle = LiveHandle>(sim: Sim): Handle | null;
function coreModeOf(sim: Sim): CoreMode;
function liveLinkOf(sim: Sim): LiveLinkState | null;
function corePermissionOf(sim: Sim, permission: Permission): boolean;

function useCoreMode(): CoreMode;
function useLive<Handle extends LiveHandle = LiveHandle>(): Handle | null;
function useLiveLink(): LiveLinkState | null;
function useCorePermission(permission: Permission): boolean;
```

Every hook reads the object in the simulator's own `SimContext` through `useSimInstance()`
(`packages/shared/src/sim/react.ts:60`). There is no second provider.

---

## 4. Behaviour of `settle`

Test file for every row: `packages/shared/test/live-light-settle.test.ts`.

| # | `run` ... | Callbacks, in order | When | Proven by (line: test name) |
|--:|---|---|---|---|
| 1 | returns a plain value | `ok(value)`, `done()` | **Before `settle` returns** | 85: "runs the action, then ok, then done, all before settle returns" |
| 2 | returns `undefined`, `null`, `0`, `''`, `false` | `ok(value)`, `done()` | Before `settle` returns | 96: "treats undefined, null and every falsy value as a plain value" |
| 3 | returns a plain value | No promise and no microtask is created | Synchronous | 112: "queues no microtask of its own"; 105: "same reference, not a copy and not a promise" |
| 4 | throws | `fail(error)`, `done()`; `ok` does not run; `settle` does not throw | **Before `settle` returns** | 134: "runs fail, then done, before settle returns"; 147: "passes any thrown value through unchanged" |
| 5 | returns a native promise that fulfils | `ok(value)`, `done()`, once | Nothing before `settle` returns; then the microtask of the settlement | 160: "fulfilment: no handler runs before settle returns"; 202: "adds no turn" |
| 6 | returns a native promise that rejects | `fail(reason)`, `done()`, once; `ok` does not run; the reason is the same object; no unhandled rejection | The microtask of the settlement | 174: "rejection: fail and done, once"; 185: "marks a rejected result as handled" |
| 7 | returns a Live result that calls back in its own turn (CL-16) | `ok`, `done` or `fail`, `done` | **Inside the turn of the settlement**: readable right after it, with no `await` | 225, 236: "runs ok and done inside the turn of the settlement"; 212: "calls then exactly once, with both callbacks, and never wraps the result" |
| 8 | returns a result that calls back twice, or both ways | The first callback only: never both `ok` and `fail`, `done` once | As 7 | 246, 257: "settles a site once" |
| 9 | (any) and `ok` throws | `done()` still runs once; **`fail` does not run**; the exception is not caught | Plain value: thrown out of `settle`. Promise: rejects the derived promise (the platform's unhandled-rejection report). Turn result: thrown into the result's callback | 289, 326, 347 |
| 10 | (any) and `fail` or `done` throws | `done()` runs once; the exception is not caught | As 9 | 305, 363 |
| 11 | sequence: the next `settle` inside `ok` | Plain values: the whole chain before the outer `settle` returns. Live: the second request starts only after the first settled | | 378, 403, 420 |
| 12 | a real simulator action | Return-value site, throw site (`instanceof SimPermissionError`, `SimTransitionError`), read-after-write site | Synchronous | 454, 465, 481 |

`done` runs exactly once in every row (rows 1 to 10 each assert the call list).

---

## 5. The other contracts and their tests

### 5.1 Identity (AC-C-06, identity part; TS-2)

| Statement | Test |
|---|---|
| `useCoreActions()` returns `sim.actions` itself, under a real `SimProvider` with a real simulator | `live-light-hooks.test.ts`: "useCoreActions() returns sim.actions itself" |
| It is the object `useSimActions()` returns, on every render | same file: "returns the very object useSimActions() returns, on every render" |
| `coreActionsOf(sim)` is `sim.actions`; every member is the very function (42 or more members) | `live-light-core-actions.test.ts`: "returns sim.actions itself", "adds no wrapper" |
| A call returns a plain value, never a promise; the store holds the effect when the call returns | same file: "returns plain values, never a promise", "adds no microtask" |
| The light API on a simulator calls no network function and builds no connection object (spies on four globals) | `live-light-hooks.test.ts`: "the light API calls no network function and builds no connection object" |

The second half of AC-C-06 (spies over the recording scenario with the Live source module present) is
row W44's; the spy test above covers the light API only.

### 5.2 Error classes (ADQ-3 rule 1; CL-20, CL-21)

| Statement | Test (`live-light-errors.test.ts`) |
|---|---|
| The three simulator classes exported by the Live module are the simulator's own class objects | "the three simulator classes taken from the Live module are the simulator's own class objects" |
| `instanceof` holds across the two modules in both directions | "an error built through the Live module satisfies an instanceof written against the simulator module, and the reverse" |
| `settle` hands a rejection to `fail` as the same object: class, `code`, `permission` survive | "a rejected Live result reaches fail as the same object" |
| The two new classes are `Error`s and no simulator class; `simErrorCode()` answers null for them | "are Errors, and are no simulator class" |
| A `fail` branch in today's order (permission, transition, generic) keeps its meaning and gains two branches; a 429 is told apart by `status` and keeps `retryAfterSeconds` | "a fail branch written as today … keeps its meaning, and gains two branches"; "keeps the status and the retry-after value" |
| A time-out, a starting server and an unsent command differ in `code` and `status` | "tells a time-out from a server that is starting and from a command that was never sent" |
| The message is fixed text per reason; no detail is copied into it | "never puts a detail into the message" |

### 5.3 Mode (TS-3; MD-2)

| Statement | Test (`live-light-mode.test.ts`) |
|---|---|
| Two modes; the default is SIMULATED; five link states | "has two data modes and SIMULATED as the default"; "has the five link states" |
| `parseCoreMode` accepts exactly `SIMULATED` and `LIVE`; anything else is null | "accepts exactly the two stored values"; "answers null for anything else" |
| A simulator means SIMULATED: `coreModeOf` SIMULATED, `liveOf` null, `liveLinkOf` null | "coreModeOf is SIMULATED; liveOf and liveLinkOf are null" |
| Only the exact marker `coreMode: 'LIVE'` makes a Live source | "only the exact marker makes a Live source" |
| `corePermissionOf` is false in Simulated mode while `selectCan` stays true | "corePermissionOf is false, signed out and signed in" |

### 5.4 Hooks (CL-15)

| Statement | Test (`live-light-hooks.test.ts`) |
|---|---|
| Simulated: `useCoreMode()` SIMULATED, `useLive()` null, `useLiveLink()` null, `useCorePermission()` false | "useCoreMode() is SIMULATED, useLive() is null, useLiveLink() is null"; "useCorePermission() is false while the simulator's own hint (selectCan) stays as it is" |
| Live: `useCoreMode()` LIVE; `useLive()` and `useCoreActions()` return the source's own objects | "useCoreMode() is LIVE and useLive() returns the source itself"; "returns the source's actions object itself" |
| `useLiveLink()` and `useCorePermission()` render again on every change, and not when the value stays | "shows the link and renders again on every change"; "follows the session"; "does not render again when a change leaves the value as it was" |
| One subscription per hook; ended on unmount | "subscribes once per hook and ends the subscription on unmount" |
| Outside a `SimProvider` the hook throws the provider's own error | "needs a SimProvider, as useSimActions() does" |
| React reports nothing on its error channel in any of these tests | The `afterEach` of the file |

### 5.5 No network code (the row; AC-C-02)

Static scan of every top-level file of `src/live` (`live-light-platform-neutral.test.ts`):

| Statement | Test |
|---|---|
| The folder's top level holds exactly the six files | "scans the six files of the row" |
| Imports: `react` (hooks.ts only), five simulator files, its own files; nothing else | "imports only React, the simulator module and its own files" |
| No Node built-in; nothing under `src/client`, `src/realtime`, `src/api`, `live/source`, `live/testing` | "no network code: imports no Node built-in …" |
| No file names `fetch`, `WebSocket`, `XMLHttpRequest`, `EventSource`, `sendBeacon`, `navigator` or a URL, comments included (positive control: the typed client does) | "no network code: names no request function and no connection class" |
| The transitive import graph (type-only imports included) reaches no file of those folders | "nothing reachable from the light API …" |
| AC-C-02: no file names `node:`, `react-native`, `expo`, `window`, `document`, comments included | "AC-C-02: …" |
| Only `hooks.ts` imports React; `settle.ts` imports nothing; `core-actions.ts` and `mode.ts` import types only | "only hooks.ts imports React …" |
| No storage, no timer, no console, no global object, no clock, no random | "reads no storage, starts no timer …" |
| Erasable syntax only | "uses erasable syntax only" |
| `@dems/shared/live` resolves to `src/live/index.ts` (same module objects) and exports the 22 names | "resolves to src/live/index.ts"; "exports the light API and nothing else" |

---

## 6. Verification (command output)

All commands were run from `/Users/gsp-budi/Documents/DEMS`. The line
`ERROR: failed to copy trust settings of system certificate-25291`, which the sandbox prints before
every npm command, is filtered out of the saved logs; nothing else is.

### 6.1 Baseline, before the first edit (07:38:49 WIB)

```
$ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  31 passed (31)
      Tests  587 passed (587)
   Start at  07:38:49
   Duration  2.13s (tests 50%, import 34%, transform 15%, worker 2%)

$ npm run typecheck -w @dems/shared      (exit 0, no output)
$ npm run lint -w @dems/shared           (exit 0, no output)
```

587 = 508 (the 28 files of `acaff20`) + 76 (`client-*`, step 34) + 3 (added by step 38 in
`auth.test.ts` and `i18n-vocabulary-sync.test.ts`, in flight; `git diff acaff20` over the two files
shows three added `it(` lines).

### 6.2 Final gate (`implementation/assets/18_gate_final.log`)

```
# Step 40 (W18): final gate, from /Users/gsp-budi/Documents/DEMS
2026-10-04 07:54:15 WIB
 7:54  1 user, load averages: 5.18 4.06 4.10

$ npm run test -w @dems/shared -- --maxWorkers=2   (07:54:15)

> @dems/shared@0.1.0 test
> vitest run --maxWorkers=2

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared

 Test Files  37 passed (37)
      Tests  680 passed (680)
   Start at  07:54:15
   Duration  3.15s (tests 46%, import 39%, transform 13%, worker 2%)
exit=0

$ npm run typecheck -w @dems/shared   (07:54:18)
> tsc --noEmit
exit=0

$ npm run lint -w @dems/shared   (07:54:20)
> oxlint
exit=0

$ npm run typecheck -w @dems/core-web   (07:54:20)
> tsc -b
exit=0

$ npm run typecheck -w @dems/mobile   (07:54:33)
> tsc --noEmit
exit=0
```

An earlier run at 07:50:50 with the same results is in `18_gate_shared_test.log` and
`18_gate_static.log`. A confirmation run after this document was written (07:58:28) is appended to
`18_gate_final.log`: 680 of 680 in 37 files, and the five commands exit 0.

The first lint run on the new tests (07:48) printed five warnings, exit 0: two
`unicorn(no-useless-spread)` (removed) and three `unicorn(no-thenable)` in the settle test. The test
doubles of that file are thenables on purpose; the file carries one file-level
`oxlint-disable unicorn/no-thenable` with that reason. After it the linter prints nothing.

### 6.3 The `live-light-*` tests and the ledger (P24)

```
$ npm run test -w @dems/shared -- --maxWorkers=2 --reporter=verbose test/live-light
 Test Files  6 passed (6)
      Tests  93 passed (93)
   Start at  07:51:00
   Duration  505ms (transform 42%, import 39%, tests 17%, worker 2%)
exit=0
```

The 93 test names are in `implementation/assets/18_live_light_tests_verbose.log`.

| Group (counted from the verbose reporter of the full run) | Files | Tests |
|---|--:|--:|
| The 28 files of `acaff20` (508 at the baseline, plus 3 by step 38) | 28 | 511 |
| `client-*` (step 34) | 3 | 76 |
| `live-light-settle.test.ts` | 1 | 32 |
| `live-light-core-actions.test.ts` | 1 | 9 |
| `live-light-errors.test.ts` | 1 | 13 |
| `live-light-mode.test.ts` | 1 | 13 |
| `live-light-hooks.test.ts` | 1 | 14 |
| `live-light-platform-neutral.test.ts` | 1 | 12 |
| **Total** | **37** | **680** |

**Ledger, `@dems/shared`: before 587 tests in 31 files; after 680 tests in 37 files; this row adds 93
tests in the six files named above.** No other workspace has a new test.

Existing tests unchanged by this row:

```
$ find packages/shared -newer .cache/rollback/W18.pre.patch -type f -not -path "*/node_modules/*"
07:51:02  packages/shared/.DS_Store
07:41:49  packages/shared/src/i18n/en/security-audit.ts          (step 38)
07:40:59  packages/shared/src/live/core-actions.ts
07:41:38  packages/shared/src/live/errors.ts
07:42:10  packages/shared/src/live/hooks.ts
07:42:16  packages/shared/src/live/index.ts
07:42:00  packages/shared/src/live/mode.ts
07:41:26  packages/shared/src/live/settle.ts
07:41:56  packages/shared/test/i18n-vocabulary-sync.test.ts      (step 38)
07:48:16  packages/shared/test/live-light-core-actions.test.ts
07:45:01  packages/shared/test/live-light-errors.test.ts
07:48:53  packages/shared/test/live-light-hooks.test.ts
07:48:53  packages/shared/test/live-light-mode.test.ts
07:47:44  packages/shared/test/live-light-platform-neutral.test.ts
07:48:53  packages/shared/test/live-light-settle.test.ts

$ git diff --stat acaff20 -- packages/shared/test
 packages/shared/test/auth.test.ts                 | 48 +++++++++++++++++++++++
 packages/shared/test/i18n-vocabulary-sync.test.ts | 42 ++++++++++++++++++++
 2 files changed, 90 insertions(+)
```

The two changed test files and the i18n file are step 38's. The three `client-*` files carry the
times 07:02:48, 07:03:36 and 07:12:48, before this row started.

### 6.4 The subpath under each client's compiler options (`assets/18_client_probe.log`)

No client file was edited. A probe file outside the repository imports 15 names from
`@dems/shared/live`; its `tsconfig.json` extends the client's own (`apps/core-web/tsconfig.app.json`,
`apps/mobile/tsconfig.json`) and lists only the probe. The probe is `assets/18_client_probe.ts.txt`.

```
## web
$ tsc -p <scratch>/probe-web/tsconfig.json --noEmit --listFiles | grep -E 'error|packages/shared/src/live|probe.ts'
packages/shared/src/live/core-actions.ts
packages/shared/src/live/settle.ts
packages/shared/src/live/errors.ts
packages/shared/src/live/mode.ts
packages/shared/src/live/hooks.ts
packages/shared/src/live/index.ts
<scratch>/probe-web/probe.ts
exit=0
## web: negative control (two wrong lines appended to the probe)
probe.ts(44,14): error TS2322: Type 'string' is not assignable to type 'number'.
probe.ts(45,17): error TS2345: Argument of type '{ ok: () => undefined; }' is not assignable to parameter of type 'SettleHandlers<number>'.
  Property 'fail' is missing in type '{ ok: () => undefined; }' but required in type 'SettleHandlers<number>'.
exit=2
## mobile
(the same six files and the probe)
exit=0
## mobile: negative control
(the same two errors)
exit=2
```

So the six files compile under the web's stricter options (`noUnusedLocals`, `noUnusedParameters`,
`erasableSyntaxOnly`) and under the mobile base configuration. Inside the package, the test
`live-light-platform-neutral.test.ts` imports `@dems/shared/live` by its package name (checked by
`tsc` and run by Vitest).

### 6.5 The tests can fail (`assets/18_mutation_runtime.log`, `assets/18_mutation_types.log`)

Run on an isolated copy of `packages/shared/src` and the six tests in the session scratchpad; the
workspace files were never mutated. Scripts: `assets/18_mutation_runtime.py`, `18_mutation_types.py`.

| Kind | Mutations | Detected |
|---|--:|--:|
| Runtime (Vitest): `settle` defers a plain value; passes a throw of `ok` to `fail`; skips `done`; runs `done` first; loses the once guard; rethrows a synchronous throw; adds turns; wraps the reason; `coreActionsOf` copies or wraps; hooks never subscribe; permission falls back to the role table; loose marker; loose parser; default LIVE; lost `retry-after`; a second copy of a simulator class; a new class extends a simulator class; a network call; an import of the typed client; React outside `hooks.ts`; web storage | 23 | 23 |
| Types (`tsc --noEmit`): result not widened; `fail` optional; no unwrapping in `ok`; parameters dropped; `useLive` without its type argument; permission as any string | 6 | 6 |

```
BASE rc=0 Tests  93 passed (93)
KILLED | M1 settle defers a plain value by one microtask | rc=1 | Tests  13 failed | 80 passed (93) | failing tests: 13
...
KILLED | M23 a file reads web storage | rc=1 | Tests  2 failed | 91 passed (93) | failing tests: 2
RESTORED rc=0 Tests  93 passed (93)

BASE tsc exit=0 errors=0
KILLED | T1 CoreResult is not widened | tsc exit=2 | errors=6
KILLED | T2 fail becomes optional | tsc exit=2 | errors=2
KILLED | T3 ok receives the raw return type (no unwrapping) | tsc exit=2 | errors=17
KILLED | T4 CoreActions drops the parameters | tsc exit=2 | errors=16
KILLED | T5 useLive loses its type argument | tsc exit=2 | errors=2
KILLED | T6 corePermissionOf takes any string | tsc exit=2 | errors=1
RESTORED tsc exit=0 errors=0
```

### 6.6 Acceptance criteria of the row

| Criterion | Result | Evidence |
|---|---|---|
| AC-C-02 (the `src/live` part of this row) | Pass | Section 5.5, test "AC-C-02: …" |
| AC-C-06, identity part | Pass | Section 5.1 |
| AC-C-09 | Pass | Section 4, rows 1 and 4 |
| The row's verification cell [PL:W18] | Pass | Sections 6.2, 6.3 |
| "No network code" | Pass | Section 5.5 |

---

## 7. Details the specification left open, and the choice made

Each choice is the smallest one found that serves the sites of [CS:§8]. All are for the controller to
record (section 8.3).

| # | Open detail | Choice | Reason |
|--:|---|---|---|
| O-1 | How `settle` recognises "a Live action result" and how its handlers get into "the turn of CL-16" [CS:CL-25] | Duck type: any value with a callable `then`. `settle` hands both callbacks to the result's own `then` in one call and adds no turn | A native promise calls back one microtask after its settlement, which is the "Promise-only delivery" that [CS:§1.7] rejects. With this shape the Live source decides the turn: a result whose `then` callbacks run when the revision is applied gets `ok` in that very turn (table row 7), and the same result can still be awaited (CL-26) |
| O-2 | Which handlers are optional | `fail` is required; `ok` and `done` are optional | `settle` never throws and reports nothing by itself, so a site without `fail` would lose a refusal silently in Simulated mode. The compiler now refuses such a site |
| O-3 | What happens when a handler throws. [CS:CL-25] says "`settle` itself never throws"; the row's brief says an error inside `ok` is not swallowed and not reported as the action's failure | The action's error never leaves `settle` (it goes to `fail`). A handler's own exception is not caught and is never passed to `fail`; `done` runs once first. It leaves through whoever called the handler: the `settle` call for a plain value or a throw, the result's `then` otherwise | Both sentences hold when "itself" is read as "for the action's error". Catching the exception and raising it again in a later turn was not chosen: it needs a timer or a deliberately unobserved rejection, and how each platform reports those was not measured in this row. Letting it leave at once keeps today's behaviour of a faulty continuation in an event handler |
| O-4 | A result that calls back twice or both ways | The first callback wins | "Exactly once" is then a property of `settle`, also for a hand-built Live result |
| O-5 | Return value of `settle` | None (`void`) | The wrappers of [CS:§8.6] build their own possibly asynchronous boolean in `ok` and `fail` |
| O-6 | Name of the widened return type | `CoreResult<R> = R \| Promise<R>`, used by `CoreActions` | One word for the union; the spec gives the union, not a name |
| O-7 | Members of the two error classes beyond `reason` and `code` | `LiveTransportError`: `status`, `retryAfterSeconds` (named as in the typed client's failure, step 34), `code`, `requestId`. `CoreRefusalError`: `status`, `requestId`. All default to null | `status` and `retryAfterSeconds` are required by CL-21 and LB-10. `code` (`TIMEOUT`, `NOT_READY`, …) lets LB-7 word a time-out apart from an unsent command, both of which are `CORE_OFFLINE`. `requestId` gives the call site's log line a correlation ID |
| O-8 | How class identity is kept (ADQ-3 rule 1) | The Live module re-exports the three simulator classes unchanged; the two new classes extend `Error` only | One class object in the process, whichever module a file imports it from; an existing branch can neither miss a rebuilt error nor take a new one by mistake |
| O-9 | The mode helpers ([CS:§2] names none) | `CoreMode`, `CORE_MODES`, `DEFAULT_CORE_MODE`, `parseCoreMode` (exact stored values only), and the derivation from the source: `coreModeOf`, `liveOf` | TS-3: the mode is read from the object in `SimContext`. No storage and no build flag is read here. The resolution order of MD-2 (stored key, `VITE_DEMS_CORE_MODE`, build type) stays with the web runtime row, MD-3 with the mobile runtime row; `parseCoreMode` is the pure part both can use. The lowercase spelling of the environment value is not accepted by it |
| O-10 | What makes an object in `SimContext` a Live source, and how the light hooks follow it | `LiveHandle`: the marker `coreMode: 'LIVE'`, `link`, `session` (an object replaced on change, with `permissions`), `onLiveChange(listener)` | The members `link` and `session` are CL-15's. The marker and the subscription are new names: CL-15 names `onControl` for the four control messages only, and a link change is not one of them. `AuthSessionInfo` is not in the contract yet (row W19), so the light API declares only the `permissions` member it reads |
| O-11 | `useLive()` must return "the Live source", whose full type lives in the heavy module | `useLive<Handle extends LiveHandle = LiveHandle>()`; the type argument is not checked at run time | A feature file names the full type with a type-only import, which loads nothing; the light files import nothing from the heavy folders |
| O-12 | `useCorePermission()` in Simulated mode ([CS:§6.1] gives no value) | False | The simulator has no server permission list. A new consumer that forgets the mode check then stays hidden in Simulated mode (AC-C-51), and the existing gates keep `selectCan` (§6.1 row 1) |
| O-13 | Pure twins of the hooks | `coreModeOf`, `liveOf`, `liveLinkOf`, `corePermissionOf`, beside the spec's `coreActionsOf` | Route guards run outside React and hold `context.sim` (the two portal routes, §10.1) |
| O-14 | Renderer for the hook tests | `react-test-renderer` 19.2.3 | See finding F40-1 |

---

## 8. For the controller

### 8.1 Findings

| ID | Finding | Evidence | Proposed action |
|---|---|---|---|
| F40-1 | `@dems/shared` declares `react` but no renderer. The row must prove a hook under a provider (AC-C-06), so `live-light-hooks.test.ts` imports `react-test-renderer`, which resolves to the root copy (19.2.3; declared by `@dems/mobile`; pinned by the root `overrides`). No manifest was edited | `packages/shared/package.json` devDependencies; `apps/mobile/package.json:84`; root `package.json:16` | Accept as is, or let an npm slot add to `packages/shared/package.json` devDependencies: `"react-test-renderer": "19.2.3"` and `"@types/react-test-renderer": "19.3.0"` (both already installed at these versions). The renderer prints its own deprecation notice once; the test accepts that one line and fails on any other console error |
| F40-2 | The UI constants of [CS:§2.4] have no light home. `LIVE_PENDING_REVEAL_MS` (LB-1, every page row) and `LIVE_RESYNCED_NOTICE_MS` are needed by feature files, which may import only the light module statically (MD-6). Step 34 put `LIVE_COMMAND_TIMEOUT_MS` into `@dems/shared/client`. This row's task list names no constant, so none was added | [PL:§3.4 "Client constants"]; `packages/shared/src/client/index.ts` | Decide the home. Smallest: two lines in `packages/shared/src/live/mode.ts` or a seventh light file, in a slot that owns `src/live/` top level |
| F40-3 | Obligations of row W44 that follow from this row's contract: (a) the Live source carries `coreMode: 'LIVE'`, `link`, `session` and `onLiveChange` (O-10); (b) an action returns a result whose `then` callbacks run in the turn of CL-16, not a bare native promise (O-1); (c) a callback may throw a handler's exception (O-3): the source must contain it and report it through `onError`, so that it cannot break the delta loop; (d) `session` is replaced, never edited in place | `packages/shared/src/live/mode.ts:56-64`; `settle.ts:1-38` | Paste into W44's delegation |
| F40-4 | The suite stood at 587 when this row started, not at 584: step 38 added three tests by design while in flight | Section 6.1 | Ledger note only |
| F40-5 | One file-level lint directive in a test: `oxlint-disable unicorn/no-thenable` in `live-light-settle.test.ts` | Section 6.2 | None; recorded for the review rows |
| F40-6 | `parseCoreMode` takes the stored spelling only (`SIMULATED`, `LIVE`); the environment value of MD-2 is lowercase | [CS:§3.1 row 2, MD-2] | The web runtime row maps the environment value itself |

### 8.2 Deviations from the plan

| # | Deviation | Why |
|--:|---|---|
| 1 | Six test files instead of one; all match `live-light-*.test.ts` | One file per contract |
| 2 | Ten evidence files under `implementation/assets/18_*` and the P23 file under `.cache/rollback/` | Evidence and protocol; no code path |
| 3 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run (P8): this file and the progress file carry the status |

No deviation in write paths, names of the spec, or behaviour.

### 8.3 Decisions to record

| # | Decision asked | Default if none is taken |
|--:|---|---|
| 1 | Accept O-1 to O-13 as the light API's contract (in particular O-2 `fail` required, O-3 handler exceptions, O-10 the marker and `onLiveChange`, O-12 false in Simulated mode) | They stand: later rows build on them |
| 2 | F40-1: accept the renderer as resolved from the root, or schedule the two manifest lines | Accepted as is |
| 3 | F40-2: where the light constants live, and which row writes them | Open: the first page row that needs `LIVE_PENDING_REVEAL_MS` returns `needs-review` |
| 4 | F40-3: add the four obligations to W44's delegation | W44 reads `mode.ts` and `settle.ts` and finds them in the file headers |

### 8.4 Error handling and logging

The helper has one error path: it hands the error to `fail`, which the type requires at every site.
It writes no log itself, because the shared layer holds no logger, no storage and no network by this
row's rule; the call sites log through their own channels (`logSystemError` on the web,
`reportRuntimeIssue` on mobile), and in Live mode the source reports every rejection through
`onError` (CL-24). `requestId` on both error classes carries the correlation ID to that log line.

---

## 9. Rollback (R-NEW)

Nothing outside the row's paths depends on these files yet (no client file imports the subpath; the
two heavy placeholders are untouched).

```
cd /Users/gsp-budi/Documents/DEMS
rm packages/shared/src/live/core-actions.ts packages/shared/src/live/settle.ts \
   packages/shared/src/live/errors.ts packages/shared/src/live/mode.ts packages/shared/src/live/hooks.ts
rm packages/shared/test/live-light-*.test.ts
printf '%s\n' 'export {}; // Placeholder of `@dems/shared/live` (plan W03); the light Live API row (W18) replaces this file.' \
  > packages/shared/src/live/index.ts
npm run test -w @dems/shared -- --maxWorkers=2      # back to the 31 files of the baseline
```

The placeholder line is W03's, as read before the first edit (SHA-256 `c46dc3b0…`, 110 bytes).
`.cache/rollback/W18.pre.patch` is empty because the folder is not in `acaff20`. The export map entry
`./live` stays; it is W03's.

---

## 10. Limits of this evidence

- The Live paths of `settle` are proven with a native promise and with a hand-made result that calls
  back in its own turn. The real Live result is W44's; AC-C-10 (atomicity) is proven there.
- The hooks' Live side is proven against a stand-in object with the four members of `LiveHandle`, not
  against the Live source.
- No bundle was built and no app was started: this row has no page and no screen. The two client
  typechecks and the probe show that the subpath resolves and compiles.

---

## 11. Follow-up: the light constants (finding F40-2, decision D43)

Controller ruling, 2026-10-04: the choices O-1 to O-14 are accepted as written; the test renderer
stays resolved from the root install (F40-1; no manifest line); the obligations of F40-3 go into the
brief of row W44; and this row, as the owner of the light module, adds one file with the light
constants. Done 08:00 to 08:03 WIB.

### 11.1 What was added

| Path | Change |
|---|---|
| `packages/shared/src/live/constants.ts` | Created: two constants, no import (25 lines with comments) |
| `packages/shared/src/live/index.ts` | One line added, `export * from './constants';`, and the header comment names the timings |
| `packages/shared/test/live-light-constants.test.ts` | Created: 9 tests |
| `packages/shared/test/live-light-platform-neutral.test.ts` | Updated, see 11.4 |
| `implementation/assets/18_gate_followup.log`, `18_mutation_constants.py`, `18_mutation_constants.log`; `18_client_probe.log` (appended) | Evidence |

### 11.2 The constants, with their sources

| Constant | Value | Where the specification states it | What it is for |
|---|--:|---|---|
| `LIVE_PENDING_REVEAL_MS` | 420 | [CS:§2.4] (`04_client_integration_spec.md:262`): "420 (the motion token `duration.slow`)"; name pinned by [PL:§3.4] (`02_plan.md:343`). The token: `packages/shared/src/tokens/tokens.ts:286` (`slow: 420`) | LB-1 (`:720`): for this long a control that sent a command keeps its look; only then its pending state shows. CA-01 (`:169`). The test points of AC-C-57 (300 ms and 500 ms) lie on either side of it |
| `LIVE_RESYNCED_NOTICE_MS` | 3,000 | [CS:§2.4] (`:267`): "3,000. Equals the mobile `RESYNCED_BANNER_MS`"; name pinned by [PL:§3.4]. The mobile value: `apps/mobile/src/runtime/connection-banner.ts:21` (`RESYNCED_BANNER_MS = 3000`, read, not imported) | §3.5 "Link back" (`:394`): the success toast "Reconnected to the Core" replaces the offline toast for this long |

Both are plain numeric literals, typed as `420` and `3000`. The file imports nothing: the token value
is repeated, and a test holds `LIVE_PENDING_REVEAL_MS` equal to `motion.duration.slow`. The equality
with the mobile banner constant is not tested from the shared package (a shared test would have to
read a file of the mobile app); it was read once, as cited.

### 11.3 Not added, and why (nothing was invented)

| Item of the specification | Value | Why it is not in the light file |
|---|--:|---|
| `LIVE_COMMAND_TIMEOUT_MS` [CS:§2.4, `:263`; CL-6, `:205`] | 8,000 | It is the typed client's own time-out and already exists there: `packages/shared/src/client/core-client.ts:40`, exported by `@dems/shared/client` (step 34). A second definition could drift. No display rule reads the number: the toast of LB-7 carries no figure |
| `LIVE_SETTLE_TIMEOUT_MS` [`:264`; CL-17] | 2,000 | Used by the Live source only (row W44, `live/source/**`) |
| `LIVE_BOOT_TIMEOUT_MS` [`:265`; §2.3 `ready`, §5.2 step 6] | 4,000 | Used by the Live source only |
| `LIVE_TOUCH_INTERVAL_MS` [`:266`; CL-27] | 60,000 | Used by the Live source only |
| The offline toast is "coalesced to one per 3 s" [LB-6, `:725`; AC-C-59, `:1258`] | 3 s | **A display rule of the light layer with a value and no name.** The specification and the plan pin no name for it, so no constant was added. For the controller: a name is needed if the web and the mobile presenter are to share the figure (finding F40-7) |
| The refresh of the permission hint is "debounced 1 s" [CL-23, `:283`]; `resync` "at most one in 2 s" [CL-11, `:218`] | 1 s; 2 s | No name; behaviour of the Live source and of the channel client, not of a feature file |
| The Paired Devices page: hairline amber from 60 s and red from 15 s, digits revealed over 600 ms, "Last seen" refreshed every 30 s [§10.3, `:1051`, `:1065`] | | No name; local to one page (row W81) |

Apart from the six names of §2.4, every constant name in the specification is an existing one of the
apps, the simulator or the contract (`VERIFY_BEAT_MS`, `CREATE_BEAT_MS`, `EXPORT_BUILD_MS`,
`RESYNCED_BANNER_MS`, `CLOCK_TICK_MS`, `HEARTBEAT_STALE_AFTER_MS`, `RECONNECT_BACKOFF_MS`,
`RECONNECT_JITTER_MS`); the search was `grep -n "LIVE_[A-Z_]*\|[A-Z][A-Z_]*_MS\b"` over the file.

### 11.4 The one change beyond the three files named in the ruling

`live-light-platform-neutral.test.ts` pins the file list of the light API and its export list, so it
had to follow: `constants.ts` added to the file list (seven files), `./constants` added to the allowed
imports, the two names added to the export list (24 run-time exports), and one line that asserts that
`constants.ts` imports nothing. No assertion was weakened; the scan (no network name, no storage, no
timer, AC-C-02) runs over the new file as over the others.

### 11.5 Tests (`live-light-constants.test.ts`, 9 tests)

| Statement | Test |
|---|---|
| 420, equal to the motion token | "LIVE_PENDING_REVEAL_MS is 420, the motion token duration.slow (LB-1)" |
| 3,000 | "LIVE_RESYNCED_NOTICE_MS is 3,000 (§3.5, "Link back")" |
| Above 180 ms, between 300 and 500 ms | "the reveal sits above the feedback tempo … and between the test points of AC-C-57" |
| Literal number types | "both are plain numbers, typed as their literal value" |
| The file exports exactly the two names | "holds exactly the two constants the specification gives to the light layer" |
| The file imports nothing (positive control: `hooks.ts` does) | "imports nothing: no import, no re-export, no require" |
| The file is two numeric declarations and nothing else | "holds only two numeric declarations: no call, no object, no computed value" |
| The other four names of §2.4 are not exported by the light module | "leaves the other four constants of §2.4 to the modules that use them" |
| The subpath exports both | "@dems/shared/live exports both, with the same values" |

Six mutations on the isolated copy, all detected (`assets/18_mutation_constants.log`): 400 instead of
420; 2,000 instead of 3,000; the token imported instead of repeated; an invented third constant; the
barrel without the file; the command time-out copied in.

### 11.6 Verification (`assets/18_gate_followup.log`)

Before the follow-up (08:00:32): `Test Files  37 passed (37)`, `Tests  680 passed (680)`, exit 0.

```
# Step 40 (W18), follow-up F40-2 (light constants): gate, from /Users/gsp-budi/Documents/DEMS
2026-10-04 08:02:43 WIB
 8:02  1 user, load averages: 3.36 3.68 3.99

$ npm run test -w @dems/shared -- --maxWorkers=2   (08:02:43)

> @dems/shared@0.1.0 test
> vitest run --maxWorkers=2

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared

 Test Files  38 passed (38)
      Tests  689 passed (689)
   Start at  08:02:43
   Duration  2.63s (tests 47%, import 37%, transform 14%, worker 2%)
exit=0

$ npm run typecheck -w @dems/shared   (08:02:46)
> tsc --noEmit
exit=0

$ npm run lint -w @dems/shared   (08:02:47)
> oxlint
exit=0

$ npm run typecheck -w @dems/core-web   (08:02:47)
> tsc -b
exit=0

$ npm run typecheck -w @dems/mobile   (08:02:56)
> tsc --noEmit
exit=0
```

The `live-light-*` group alone: 7 files, 102 tests (93 + 9).

**Later runs (P11): one failure, in a file of the contract-owner row.** That row started to edit
`packages/shared/src/api/**` after the gate above (modification times 08:03:00 to 08:05:12:
`constants.ts`, `patterns.ts`, `text.ts`, `health.ts`, `contract-model.ts`, `schema-parts.ts`), while
the committed `openapi/openapi.json` is still the one of 1 October. Every run since then shows the
same single failure, the drift check of its pinned test. No file of this row changed after 08:02:06.

| Run | Command | Result |
|---|---|---|
| 08:02:43 | `npm run test -w @dems/shared -- --maxWorkers=2` | **38 files, 689 of 689, exit 0** (the gate quoted above; with this row's change in place) |
| 08:04:44 | same | 1 failed, 688 passed (689); 1 file failed, 37 passed; exit 1 |
| 08:05:11 | same | the same one failure; exit 1 |
| 08:05:40 | same | the same one failure; exit 1 |
| 08:05:43 | same, with `--exclude test/openapi.test.ts` | 37 files, 668 of 668, exit 0 |
| 08:05:46 | same, `test/live-light` only | 7 files, 102 of 102, exit 0 |

```
 FAIL  test/openapi.test.ts > AC-56: the OpenAPI document > matches the committed openapi/openapi.json byte for byte (no drift)
 Test Files  1 failed | 37 passed (38)
      Tests  1 failed | 688 passed (689)
   Start at  08:05:40
exit=1

$ npm run test -w @dems/shared -- --maxWorkers=2 --exclude test/openapi.test.ts   (08:05:43)
 Test Files  37 passed (37)
      Tests  668 passed (668)
   Start at  08:05:43
exit=0
```

At 08:06:34 the typecheck of `@dems/shared` also turned red, with two errors, both in
`src/api/example-parts.ts` (TS2339 at line 46, TS2353 at line 49), a file the contract-owner row
created at 08:06:30. This row's last green typechecks of `@dems/shared` are those of 08:02:46 and
08:04:47; lint stays at exit 0. The last reading is appended to `18_gate_followup.log`.

The failing test compares the generated OpenAPI text with the committed file; it reads nothing under
`src/live`. It is expected to pass again when the contract-owner row has regenerated the file; this
row cannot and must not repair it (P17). In the confirmation run of 08:04:44 the other four commands
(typecheck and lint of `@dems/shared`, typecheck of `@dems/core-web` and `@dems/mobile`) exit 0.

**Two short red intervals caused by this row, recorded for P11.** (1) Between 08:00:51 (the new file
written) and 08:01:20 (the static test updated) the test suite of `@dems/shared` would have failed in
`live-light-platform-neutral.test.ts`, which pinned six files and 22 exports. (2) From the creation
of `live-light-constants.test.ts` (after 08:01:20) until its correction at 08:02:06 the typecheck of
`@dems/shared` failed with two errors in that file (lines 35 and 36: a type assertion written on the
value instead of on its type; observed in my own run at 08:01:57); it was green at 08:02:13. A run of
another row inside either interval may show these files; its re-run is clean.

The two names under each client's compiler options (`assets/18_client_probe.log`, appended): the
probe `const reveal: 420 = LIVE_PENDING_REVEAL_MS; const notice: 3000 = LIVE_RESYNCED_NOTICE_MS;`
compiles with exit 0 under the web and the mobile configuration, and `const wrong: 400 = …` fails
with `TS2322: Type '420' is not assignable to type '400'` (exit 2) under both.

**Ledger (P24), `@dems/shared`: 680 tests in 37 files before the follow-up; 689 in 38 after; the
follow-up adds 9 tests in `live-light-constants.test.ts`.** Row total: 587 → 689, seven new files,
102 tests.

### 11.7 Findings and rollback of the follow-up

| ID | Finding | Proposed action |
|---|---|---|
| F40-2 | Closed by this section for the two named display timings | None |
| F40-7 | LB-6's coalescing interval (3 s) has a value and no name; it was not added | Pin a name if the two presenters are to share it; else each presenter keeps its own figure |

Rollback of the follow-up alone: delete `packages/shared/src/live/constants.ts` and
`packages/shared/test/live-light-constants.test.ts`, remove the line `export * from './constants';`
from `packages/shared/src/live/index.ts`, and take the four additions of 11.4 out of the static
test. The full rollback of section 9 needs one more path in its first `rm`:
`packages/shared/src/live/constants.ts`.

---
*Generated: 2026-10-04 07:58*
*Last Updated: 2026-10-04 08:07 (section 11: the light constants)*
