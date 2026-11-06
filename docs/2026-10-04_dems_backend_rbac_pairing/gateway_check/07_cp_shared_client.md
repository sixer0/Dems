---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: senior-code-reviewer
blueprint_row: 68
plan_row: W46 (CHECKPOINT CP-C1, read-only)
rows_reviewed: W12, W18, W30, W31, W44
evidence_tier: 2 (what was found, why it matters, how it was verified, source citation)
status: complete
verdict: PASS WITH FIXES (0 Blocker, 0 High, 6 Medium, 12 Low, 4 Info)
---

# 07 Checkpoint CP-C1: the shared client layer (blueprint step 68, plan row W46)

Row, verbatim: [W46] CHECKPOINT CP-C1, read-only: review the shared client layer (W12, W18, W30,
W31, W44) for platform neutrality, contract reuse and an untouched Simulated path; a parallel
audit. Writes: nothing (except this report). Checks AC-B-62; AC-C-02. Rollback R-NONE.

## 0. Result

**Verdict: PASS WITH FIXES.** Nothing has to be fixed before W50 (web runtime) and W51 (mobile
runtime) start: no finding changes the public API of `@dems/shared/client`, `/live`,
`/live/source` or `/realtime`. Six Medium findings should be fixed while those rows run, each
before the row named in section 9.

| Dimension | Verdict | Findings |
|---|---|---|
| 1 Platform neutrality | PASS (clean) | none |
| 2 Contract reuse | PASS WITH FIXES | CPC1-5, CPC1-6, CPC1-12 |
| 3 Untouched Simulated path (AC-B-62, AC-C-02) | PASS; one guard to add; one text to amend | CPC1-4, CPC1-17 |
| 4 Correctness of the hard parts | PASS WITH FIXES | CPC1-1, CPC1-2, CPC1-3, CPC1-7 to CPC1-11, CPC1-19, CPC1-20 |
| 5 Credentials and logging | PASS (clean); one wording note | CPC1-18 |
| 6 Maintainability | PASS WITH COMMENTS | CPC1-13 to CPC1-16 |
| 7 Tests as evidence | PASS; gaps named | section 7 |
| 8 The 18 decisions of W44 | None overruled; four upheld with a condition; one new decision asked | section 8, CPC1-21 |

The three checks the row asks for:

| Check | Result |
|---|---|
| Findings carry file:line and severity | Section 5 |
| `git diff acaff20 -- packages/shared/src/sim` shows only the additions of W16 and the recorded SIM-GAP-1 fix | Yes (section 3.1) |
| Each blocker names its owning row | There is no blocker. Every finding names its owning row |

How this review was done: every file of `src/client` (2), `src/live/*.ts` (7), `src/live/source`
(13) and `src/realtime/live-socket-client.ts` was read in full; `src/live/testing` and the test
files were read in part (section 10). **Nothing was executed except the three permitted commands
and read-only searches. Findings CPC1-1 to CPC1-11 and CPC1-21 are established by reading the
code; none was reproduced by a test.**

Commands run from `/Users/gsp-budi/Documents/DEMS` (no `cd` into a subfolder):

```
2026-10-04 12:47:31 WIB $ npm run typecheck -w @dems/shared      > tsc --noEmit    exit=0
                        $ npm run lint -w @dems/shared           > oxlint          exit=0
2026-10-04 12:47:37 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  64 passed (64)
      Tests  1650 passed (1650)
   Duration  6.43s                                                                exit=0
```

The same figures as the controller's baseline of 12:38 (64 files, 1,650 tests). No shared test is
red.

---

## 1. Platform neutrality: clean

| What was looked for | Where | Result |
|---|---|---|
| `window`, `document`, `navigator`, `localStorage`, `sessionStorage`, `XMLHttpRequest`, `EventSource`, `Buffer`, `require`, `__DEV__`, `process` (whole words, comments included) | `src/client`, `src/live` (testing included), `src/realtime/live-socket-client.ts` | 0 matches (`grep -rnwE`) |
| `node:`, `react-native`, `react-dom`, `expo`, `import.meta`, a Node built-in or a test runner in an import | the same | 0 matches |
| The global `fetch` | `client/core-client.ts:514-517` | Looked up only when no `fetch` was injected, at each call |
| The global `WebSocket` | `realtime/live-socket-client.ts:459-465` | Only inside the default socket factory |
| Global timers | `live/source/live-sim.ts:142-147`, `realtime/live-socket-client.ts:468-473` (injectable defaults); `client/core-client.ts:621` (the client's own time-out, not injectable, cleared after every call) | The intervals run only between `start()` and `stop()`; see CPC1-7 for what outlives `stop()` |
| `console.*` | the same three places | 0 matches |
| Side effects on import | module level of the 23 files read in full | Declarations, regular expressions and `Object.keys` / `Object.values` only |
| React | `live/hooks.ts:16` only | As the light API states |

Export map (`packages/shared/package.json`, diff against `acaff20`: four added lines, `./client`,
`./live`, `./live/source`, `./live/testing`). The root entry `src/index.ts` and `src/sim/index.ts`
are unchanged against `acaff20`; neither exports anything of the Live layer. `src/live/source`
imports nothing of `src/live/testing`. `@dems/shared/live/testing` is imported by no file outside
its folder and by no production file of an app (search over `packages/shared/src` and the four
`apps/*/src`; the static test `test/live-testing-platform-neutral.test.ts:203-216` holds it). It
names no test runner; its imports are its own files, the contract, and the two clients as types.

Import directions (search for `from '../…'` by folder): `sim` imports nothing of `live`, `client`
or `realtime`; `client` imports zod types and `../api` only; `live/source` imports the contract,
the socket client by file, five simulator files and the typed client as a type only;
`realtime/live-socket-client.ts:95` takes one **type** from `../live/mode` (the row's own F-4,
accepted in D59). No runtime cycle.

Context graph: `graft callers createLiveSim -d all` and `graft callers asSim -d all` list test
callers only; `graft callers createCoreClient -d all` lists one production caller, the debug-only
probe of W12 (`apps/mobile/src/runtime/dev-probes.ts:232`).

Two notes, no finding. (a) `packages/shared/tsconfig.json` sets `"types": ["node"]`, so the
compiler would accept a Node global in these folders; the five static `*-platform-neutral` tests
are the guard, and the web and mobile probes of the rows compile the subpaths under each client's
own options. (b) The inert socket client travels in Simulated bundles through the realtime barrel
(`realtime/index.ts:2`), as D59 accepted.

Not verified: no bundle was built; what a release web build or a release APK contains is for W50,
W51 and the release-gate rows to measure.

---

## 2. Contract reuse: one source, with three exceptions

One source confirmed for: operation IDs (`SIM_ACTION_OPERATIONS`, read by `bindings.ts:146-151`);
paths, methods, path parameters, query and response schemas (the typed client reads the registry,
`core-client.ts:495-496, 551-702`; a search of the layer's code for `/api/v1`, `/ws` and
`127.0.0.1` finds no literal outside comments); header names (`core-client.ts:31, 52-57` are
aliases of `api/constants`); realtime messages, principals, topics and close codes
(`live-socket-client.ts:70-93`); the replicated slice list (`replica.ts:27`); ring sizes and the
ring function (`replica.ts:28-29`); back-off, stale and resync constants
(`live-socket-client.ts:70, 96-103`). The two bootstrap reads are string constants
(`live-sim.ts:132-133`) held to the registry by `test/live-source-bindings.test.ts:247-250`.

The three known adapters:

| Adapter | Safe? | Pinned by a test? | Marked for W83? |
|---|---|---|---|
| `DEVICE_COMMAND_OPERATION_INDEX` (`bindings.ts:154-158`), CONTRACT-GAP-3 | Yes, while the contract's list keeps its order | Yes: `test/live-source-bindings.test.ts:253-264` checks each command against the path suffix of the operation it reaches (`/restart`, `/test-signal`, `/identify`); mutation B02 is detected | **No** (CPC1-6) |
| "LOCKED" as `auth.status` SIGNED_OUT plus `lastSessionEnd.signOut: 'LOCK'`, SIM-GAP-2 | Yes: no value outside `AuthStatus` enters the store | Yes: `test/live-source-session.test.ts:655-686` | Not a contract matter; no marker in the code (CPC1-6) |
| `lastActivityAt` = `idleExpiresAt` minus 15 min (`neutral-state.ts:74-76`), F66-5 | **Yes, by construction**: the server takes its idle time-out from the same constant (`apps/core-server/src/modules/identity/limits.ts:26`, `SESSION_IDLE_TIMEOUT_MS = AUTH_IDLE_TIMEOUT_MS`), and that file states that no environment variable reaches it | Yes: `test/live-source-session.test.ts:824-834` | No marker (CPC1-6) |

Duplication the rows did not report: CPC1-5 (envelope codes typed as string literals) and CPC1-12
(the three credential prefixes). Judged and accepted: the neutral state's literal defaults
(`neutral-state.ts:145-248`; typed by `SimState`, replaced by the first snapshot), the link value
table `live-socket-client.ts:143-149` (held equal to `LiveLinkState` by `satisfies`), and the two
transport reason types (`core-client.ts:134`, `live/errors.ts:22-28`; assignability is checked at
`rebuild-error.ts:83`).

---

## 3. The Simulated path

### 3.1 AC-B-62: the diff

```
$ git diff acaff20 --stat -- packages/shared/src/sim
 packages/shared/src/sim/auth.ts             |  5 +++++
 packages/shared/src/sim/evidence-actions.ts |  5 +++--
 packages/shared/src/sim/session-machine.ts  |  7 +++++--
 packages/shared/src/sim/vocabulary.ts       | 27 +++++++++++++++++++++++++++
 4 files changed, 40 insertions(+), 4 deletions(-)
$ git diff acaff20 --numstat -- packages/shared/src/sim
5 0 auth.ts | 3 2 evidence-actions.ts | 5 2 session-machine.ts | 27 0 vocabulary.ts
$ git status --short -- packages/shared/src/sim      (the one untracked file)
?? packages/shared/src/sim/text-cut.ts               (42 lines)
```

Baseline 33 files (`git ls-tree -r acaff20`), today 34. Every hunk was read:

| File | Hunk | Decision | Verdict |
|---|---|---|---|
| `vocabulary.ts` +27 −0 | 3 permissions (`PAIRING_MANAGE`, `USER_ADMIN`, `DEMO_CONTROL`); 9 audit types; their 9 categories; three comments | D37, D41 (W16) | As recorded; additions only |
| `auth.ts` +5 −0 | The three permissions on SUPERVISOR, two comment lines | D37 | As recorded |
| `session-machine.ts` +5 −2 | Import of `cutText`; the marker label cut (80) and the note line cut (139 plus ellipsis) go through it | D53, D56 (SIM-GAP-1) | As recorded; limits unchanged |
| `evidence-actions.ts` +3 −2 | Import of `cutText`; the two export destinations (120) go through it | D53, D56 | As recorded |
| `text-cut.ts` new | `cutText`, pure; not exported by `sim/index.ts` | D56 | As recorded |

**Nothing else differs. No blocker.** `sim/index.ts`, `sim/react.ts`, `sim/types.ts`,
`sim/engine.ts` and the root `src/index.ts` are byte-equal to `acaff20` (`git diff --stat`
prints nothing for them), so `useSim`, `useSimActions`, `SimProvider`, `Sim` and `SimActions`
are unchanged in type and code. The texts of AC-B-62 and TS-1 still describe the state before
SIM-GAP-1: CPC1-17.

### 3.2 Importing in Simulated mode starts nothing

By reading: the root entry and `@dems/shared/sim` import no file of the Live layer;
`@dems/shared/live` (light) holds no network code; `@dems/shared/realtime` now loads
`live-socket-client.ts`, which holds declarations only. By test:
`test/live-source-simulated-isolation.test.ts:135-145` (loading the heavy module calls no
`fetch`, constructs no socket, starts no timer) and `:147-176` (21 actions over the recording
scenario through `coreActionsOf` and `settle`: 0 calls on four spied globals), with a control
that proves the spies count (`:178-193`).

### 3.3 F66-10: is the planned static test a sufficient guard?

**No, not alone** (CPC1-4). A type-level guard in the shared layer is not possible without
editing `sim/react.ts`, which AC-B-62 freezes: `useSimActions(): SimActions` (`sim/react.ts:72-74`)
is where the type says "a value", and `asSim` (`live/source/index.ts:117-119`) is a double cast.
A run-time guard inside the Live source is possible now and is recommended.

---

## 4. Correctness of the hard parts

What holds, by reading:

| Part | Finding |
|---|---|
| Delta sequencing | A delta reaches the source only after a snapshot of the same connection, in the same epoch, with exactly the last revision plus 1 (`live-socket-client.ts:970-995`); a stale one is dropped, a gap or a newer epoch starts one resync and drops deltas until the snapshot (`:979-982, 993-994`). `hasSnapshot` is reset with every connection (`:749-765`), and events of a replaced socket are ignored (`:821, 1015`). So a delta cannot be applied twice, out of order or across an epoch change. The gate does not check revisions itself; it relies on this |
| The gate, both orders | Delta first: held at `receive`, applied and settled inside `wait` (`command-gate.ts:218-223`, `161-192`). Answer first: applied and settled inside the socket's callback (`:224-227`). One store update, then the continuation, in one synchronous turn (`:177-180`). The `pumping` flag makes a nested call a no-op, and a command begun by a subscriber during the update is counted correctly (`:210-212, 178`) |
| The settle time-out | One timer per waiting command (`:220`); at the time-out one `requestResync()` (`:201`), which the socket turns into at most one `resync` (`live-socket-client.ts:1173-1177`, `709-722`); everything held is applied and the action resolves (`:202-205`) |
| Reconnect | The attempt counter grows until a heartbeat of the new connection arrives (`live-socket-client.ts:774-790, 896-916`), so a server that accepts and closes at once is backed off to 8 s. 4401 and 4403 end the run without a reconnect (`:805-838`); 4408 and every other code reconnect. An end is also recognised without a close code (`:809-814`) |
| Error rebuilding | A failure with `transport` set is a `LiveTransportError` before any other rule is read (`rebuild-error.ts:106-107`), and `transport` is set for every failure without a contract envelope (`core-client.ts:363-378`). A simulator class is built only from a 401, 403, 404, 409 or 422 that carried a valid envelope. Neither direction can cross |
| The typed client | 204: no parse, a body is a violation (`core-client.ts:676-679`). 429: `RATE_LIMITED`, `retry-after` kept, also when the body is no envelope (`:649-651`). Time-out: one timer over request and body read, cleared after the race, abort sent, nothing retried (`:619-641`); the late rejection of the abandoned exchange is handled (`:626-629`) |
| Unhandled rejections of actions | A Live result is not a native promise; a rejection nobody handles raises no event (`live-result.ts:59-65, 122-145`) and is reported once (`live-sim.ts:766-769`) |
| Re-entrancy | A subscriber that calls an action inside a notification: no defect found by reading (the gate's `pumping` flag, the socket's `generation` checks). No test exercises it |

What does not hold: CPC1-1, CPC1-2, CPC1-3 and CPC1-7 to CPC1-11 in section 5.

---

## 5. Findings

Severity: Blocker (fix before W50 / W51 start), High, Medium (fix before the row named in section
9), Low, Info. "By reading" means: traced in the code, not executed.

### 5.1 Medium

**CPC1-1. Medium. W44. A device revocation is not idempotent, and the socket is reopened without
limit when the app's port leaves the credential in place.**
`live/source/live-sim.ts:564-567` (`reopen` is true for every `DEVICE_REVOKED` end when the port
exists), `:572-583` (the port's exception is reported and the socket is reopened all the same),
`:498-507` (`onEnd` starts a new end for every new connection), `:716-717` (a REST 403
`DEVICE_REVOKED` starts an end unconditionally; the 401 rule on `:718` checks `session !== null`).
- (a) Loop: when `secrets.deviceUnpaired` throws, or resolves without removing the credential
  that `socket.headers()` returns, the new socket presents the same value, the server answers
  `hello` (DEVICE_REVOKED) and closes 4403, `onEnd` sees a new connection number, `endSession`
  runs again, the port is called again, the socket is reopened again, with no delay. Every round
  also sends `getSignInStatus` (`:444`; `lockoutKnown` was reset on `:536`) and tells the
  `onSessionEnd` listeners. The session rule next to it is safe: a refused credential with nobody
  signed in is not reopened (`:567`).
- (b) Duplicates: one revocation can end two or three times (the `device.revoked` message plus
  the 403 of a request that was in flight; at a cold start with a revoked credential the probe's
  403, the status read's 403 and the close 4403). The log's "the app told once" holds only for
  the tested path (`test/live-source-session.test.ts:1211-1233`, where the REST side answers as
  for a valid device).
- Why it matters: W51 writes the port on `expo-secure-store`, and DEPARTURE-6 (D15) already
  expects failing protected writes on the emulators. A failing delete becomes a socket and
  request storm against the Core server and one notice per round.
- Fix: treat a second `DEVICE_REVOKED` end with `wasSignedIn: false` as the session rule does
  (report once, do not reopen; the app calls `reconnect('CREDENTIAL')`); skip an end when the
  pairing is already gone and no credential change was signalled since (`pair`, `setPairing`,
  `reconnect('CREDENTIAL')`). Tests: a `deviceUnpaired` that throws; a cold start with REST 403
  plus close 4403, where `ends` has length 1.
- Verified: by reading. The existing test of a throwing port
  (`test/live-source-session.test.ts:1178-1200`) clears the vault by hand, so it never presents
  the stale credential. Not verified: that the server answers 403 `DEVICE_REVOKED` on the two
  public reads (taken from `01_specs.md:501`), and what it counts against its denial budget.

**CPC1-2. Medium. W44. An exception inside a store update, or between `gate.begin()` and its
settlement, freezes the replica and cuts a session end short.**
`live-sim.ts:287-290` (`commit` is unguarded), `:813-865` (`runCommand`: `inspect` on `:822`,
`unionOf` on `:825`, `commit` on `:842`, `binding.target` on `:845` are outside any `try`),
`:930-984` (`runSignIn`: `:946`), `:1048-1069` (`runSignOut`: `:1059`, `:1066`), and the four
continuations without a `catch` (`:610-656`, `:663-673`, `:689-693`, `:736-754`). The store
library calls subscribers synchronously with no guard (`node_modules/zustand/vanilla.js:11`), and
`subscribe(selector, listener)` evaluates the selector there (`middleware.js:259-262`).
- Consequence: a subscriber or selector that throws while the source commits (most likely on the
  neutral state of a session end) leaves the `async` body as an unhandled rejection. The command
  stays "in flight" for ever (`command-gate.ts:100, 183`): every later state message is held, and
  the store advances only up to the revision of each command this client sends. The action never
  settles. An `endSession` cut short on `:554` tells no listener, does not call `sessionCleared`
  or `deviceUnpaired`, and does not reopen the socket. Nothing bounds the hold: there is no
  watchdog.
- Why it matters: both runtimes add subscribers outside React. Four exist today, all harmless:
  `apps/core-web/src/features/session-monitor/sim-adapter.ts:52`,
  `apps/core-web/src/components/media/use-sim-clock.ts:24`,
  `apps/mobile/src/features/pairing/use-pairing-flow.ts:93, 128`. React's own subscriptions are
  not affected: React 19.2.3 catches a selector error at the store notification
  (`node_modules/react-dom/cjs/react-dom-client.development.js:8250-8258`).
- Fix: `commit()` catches and reports (`live.subscriber`); each of the three runners gets the
  whole-body `try` that `runRead`, `runPair` and `runUnpair` already have, ending in `gate.end`;
  a `.catch` on the four continuations. Test: a subscriber that throws during a 401 on a command.
- Verified: by reading. No test has a store subscriber that throws.

**CPC1-3. Medium. W12. The credential provider is outside the time-out and outside the "never
rejects" rule.** `client/core-client.ts:535-543, 555` (awaited before the timer is created on
`:619-625`). A provider that never resolves makes `call` hang for ever (CL-6 says 8,000 ms); one
that rejects makes `call` reject with the provider's own error (CL-1 says only
`CoreClientUsageError`). In the Live source a hung call keeps a command in flight
(`live-sim.ts:817`) or keeps `probing` true (`:607, 611`): the same frozen replica as CPC1-2.
- Why it matters: on mobile every request takes its bearer value from this function; a provider
  that reads the protected store on each call can wait behind an OS prompt.
- Fix: run `bearerValue()` inside the timed race and turn its rejection into a failure. Rule for
  W51 until then: the provider returns a value held in memory and never touches storage.
- Verified: by reading; `test/client-core.test.ts:681` covers an asynchronous provider that answers.

**CPC1-4. Medium. W44 (guard), the client rows (scope of AC-C-53). F66-10: the static test alone
is not a sufficient guard.** `live/source/index.ts:117-119`, `sim/react.ts:72-74`,
`live-result.ts:122-145`.
- A Live result read as a value fails silently: `result.ok` is `undefined`, a `try` around a void
  action catches nothing, and the rejection raises no event by design (CL-24).
- AC-C-53 (`04_client_integration_spec.md:1247`) scans three folders and, by `:619`, leaves
  `components/` and `runtime/` out. Call sites exist there:
  `apps/core-web/src/components/shell/user-menu.tsx:21-22` (`signOut`),
  `components/shell/app-shell.tsx:101-103` (`touch`), `components/composed/dbfs-meter.tsx:360`
  (`resetClip`). A site that reads a result today:
  `apps/mobile/src/features/pairing/use-pairing-flow.ts:103`.
- The test lands with the client rows; W50 and W51 put a Live source behind `asSim` before them.
- Fix now, in `run()` (`live-sim.ts:1148-1176`): when an action whose simulator signature
  returns a value settles and no `then` was attached, report it once per action name
  (`live.misuse`, level `error`). It gives no false report for fire-and-forget void actions.
  And widen the static test to `components/`, `routes/`, `navigation/` and `runtime/`, with a
  list of the allowed fire-and-forget calls.
- Verified: by reading and by search (`useSimActions` is named by 22 web and 14 mobile production
  files).

**CPC1-5. Medium. W44. Envelope codes are typed as string literals, not taken from the contract.**
`live-sim.ts:716, 718, 720, 1060`; `bindings.ts:196, 218, 304-306, 496`;
`rebuild-error.ts:45-56, 113, 116`. The contract exports the vocabulary
(`api/core-api.ts:153-189`, `ApiErrorCode`). `ENVELOPE_SIM_CODE` is `Record<string, SimErrorCode>`.
No test ties the literals to `API_ERROR_CODES`, and the fake cannot catch a wrong one:
`ApiErrorSchema.error.code` is a pattern (`core-api.ts:197-200`). The eight compared codes and
the ten keys of the table are members of `ApiErrorCode` today (checked one by one).
- Why it matters: a code renamed at the close-out compiles and passes on the client side.
- Fix: `ApiErrorCode.X` in the comparisons; `Partial<Record<ApiErrorCode, SimErrorCode>>` for the
  table.

**CPC1-21. Medium. A decision for the controller; then W44 and W54 / W55. No local lock while the
link is down.** `live-sim.ts:1042-1045`: `signOut` (USER and LOCK) rejects `CORE_OFFLINE` when the
link is not ONLINE, as CL-22 (`04_client_integration_spec.md:282`) and WS-12 (`:518`) say. The
call site is fire-and-forget (`user-menu.tsx:21-22`), so "Lock" then does nothing and shows
nothing. And an idle expiry reaches the client only over the socket (`live-sim.ts:479-481`): with
the link down a signed-in console keeps showing the last Core data without limit, although it
holds `session.idleExpiresAt`.
- Fix, one of: (a) a local end when the link is not ONLINE (clear the replica, remember that the
  sign-out is owed, send it before the next OPERATOR socket is adopted), plus a local idle check
  against `idleExpiresAt`; (b) keep the rule and make the shell show the refusal.
- Verified: by reading.

### 5.2 Low

**CPC1-6. Low (process). W44. The gap adapters carry no marker in the code.** W83's verification
is "a search for `CONTRACT-GAP-` under `apps/` and `packages/` finds nothing" (`02_plan.md:762`).
That search finds nothing today, with CONTRACT-GAP-3 open: `bindings.ts:153-158` has no marker;
neither have the LOCK adapter (`live-sim.ts:33, 1046`) and `lastActivityOf`
(`neutral-state.ts:73-76`). Fix: one comment line each (`CONTRACT-GAP-3`, `SIM-GAP-2`, `F66-5`).
Verified: `grep -rnE "CONTRACT-GAP|SIM-GAP|W83"` over `src/live`, `src/client` and
`src/realtime/live-socket-client.ts`: 0 matches.

| ID | Owner | File:line | What is wrong | Why it matters for W50 / W51 | Suggested fix |
|---|---|---|---|---|---|
| CPC1-7 | W44 | `live-sim.ts:1207-1220`; `command-gate.ts:218-223`; `live-sim.ts:683-696` | `stop()` does not touch the gate. A waiting command keeps its timer (2 s, or 4 s for a sign-in); an answer that arrives after `stop()` still runs `inspect`, updates the store, can call `sessionCleared`, and can start the 1 s permission timer. The log's "after `stop()` no timer is left (tested)" holds for an idle source only (`test/live-source-session.test.ts:286-308`) | A continuation runs on an unmounted screen; a jest run keeps a timer for up to 4 s; StrictMode stops and starts the source (F66-7) | Settle waiting commands at `stop()` and clear their timers; ignore late answers while not running |
| CPC1-8 | W44 | `live-sim.ts:631-639`; `constants.ts:29`; `command-gate.ts:98, 224-227` | The session probe is repeated every 2 s for ever after a transport failure: not tied to the link, no back-off, `retryAfterSeconds` ignored (a 429 is retried inside its window). While the hold stays, held state messages grow without bound | With the Core down: one request every 2 s, each reported by the typed client's `report` sink; a rate limit is kept alive | Ask again on the next `hello`, or use the socket's delays; honour `retry-after`; cap what is held (drop and resync) |
| CPC1-9 | W44; a note for W51 | `live-sim.ts:617-629` against `:431-445`; `live-socket-client.ts:166-167, 841-852`; `live-sim.ts:1288` | A session the probe finds while the socket is not an OPERATOR socket gets a new socket only when `hello` arrived before the probe's answer; in the other order nothing reopens it and `auth` never turns SIGNED_IN. Reachable on mobile: `headers()` is synchronous and is asked at creation (`autoStart` true), while the client's provider may be asynchronous | A cold start that looks signed out until the app restarts | In `onHello`: session known, principal not OPERATOR, no reason, no sign-in in flight: reconnect once. W51: load the stored values before `createLiveSim`, or pass `autoStart: false` |
| CPC1-10 | W44 | `touch-throttle.ts:95-98, 108-113` | Activity remembered while offline has no age. `flush()` reports it as fresh when the link is back, so the idle time-out is extended by up to the offline time (under 15 min). CL-27 says "at most 60 s late" | An idle rule that is weaker in Live mode than specified | Stamp the remembered activity; drop it at `flush` when older than the interval |
| CPC1-11 | W44 | `live-sim.ts:661, 670, 1102-1108` | `lockoutKnown` is not reset after `pair`. The lock state read before pairing was read without a device credential, so it is the web console's (`api/identity.ts:291-292`), and it stays in `authLockout` | The tablet's login can show the web console's lock right after pairing | Reset the flag and read again after `devicePaired` |
| CPC1-12 | W12 | `core-client.ts:60` | `CREDENTIAL_PREFIX` retypes the three token prefixes of `api/patterns.ts:52-54`; no test ties them | A fourth token form would pass the URL guard | Build the expression from the contract, or add one test |
| CPC1-13 | W18 | `live/hooks.ts:35-43` | `useLiveValue` is private; the light API has no hook for `session`, `lastSessionEnd`, `auditChain` | Both runtimes would write the same `useSyncExternalStore` wrapper | Export it (`useLiveSelector(read)`) |
| CPC1-14 | W44 | `live/source/index.ts:117-119` | `as unknown as Sim`: nothing proves at compile time that `LiveSim` has every member of `Sim` (`sim/engine.ts:63-92`). All 16 are present today (compared by hand) | A member added to `Sim` would be missing at run time only | One type assertion: `Exclude<keyof Sim, keyof LiveSim>` is `never` |
| CPC1-15 | W44 | `live-sim.ts:201-204, 313-345` | 22 mutable bindings of one closure carry the session state; the file has a table for `auth` but none for the flags (`probing`, `sessionHold`, `rotated`, `signingIn`, `endedConnection`, `refusedConnection`, `lockoutKnown`, `pendingSignOut`) | CPC1-1, CPC1-9 and CPC1-11 are all flag interactions | Section 6 |
| CPC1-16 | W44 | `live/settle.ts:53-59` and `live-result.ts:39-45` (`isThenable`); `live-sim.ts:142-147` and `live-socket-client.ts:468-473` (`DEFAULT_TIMERS`) | Two helpers exist twice | None for the runtimes | Export the timers from the socket client; the first pair is forced by "no import" in both files and may stay |
| CPC1-17 | Controller (specification text) | `01_specs.md:1818` (AC-B-62); `04_client_integration_spec.md:1119` (TS-1); blueprint row 68 | The texts say "only in `vocabulary.ts` and `auth.ts`" and "byte-identical". D53 and D56 changed two more files and added one. Neither specification names SIM-GAP-1 (search: 0 matches) | The regression row W97 runs the literal check, and it fails | Amend the two sentences, citing D53 and D56 |

### 5.3 Info

| ID | Owner | File:line | Note |
|---|---|---|---|
| CPC1-18 | W44 | `rebuild-error.ts:119-121, 131-136`; `sim/errors.ts:85`; `live-sim.ts:242-248` | The log says no error carries a value of `details` and no report carries an argument. Not exact: `details.from`, `details.event` and `details.permission` go into the rebuilt error, and a 404 puts the entity ID the caller passed into the error's message and so into the report. No credential can travel this way (the typed client refuses a credential in a path parameter, `core-client.ts:410-414, 462`). Also `ENVELOPE_SIM_CODE[code]` (`rebuild-error.ts:128`) and the index lookup on `bindings.ts:443` read inherited keys; `Object.hasOwn` closes it |
| CPC1-19 | W30; a note for W51 | `live-socket-client.ts:1071-1087` | A link that stays STALE is never given up; it waits for the runtime's close, as the heartbeat client does. In Live mode STALE refuses every command. W51 should call `reconnect('RETRY')` when the app returns to the foreground with a STALE link |
| CPC1-20 | W44 | `live-sim.ts:572-583` | The wait for `sessionCleared` / `deviceUnpaired` has no bound. A port that never resolves leaves the socket closed, the link OFFLINE and the sign-in refused |
| CPC1-22 | The web System page row | `apps/core-web/src/features/system/diagnostics.tsx:103` | Calls `exportLogs()` with no request. In Live mode that is always 422 `INVALID_REASON` (decision 14). The row must collect a reason |

---

## 6. Maintainability

Scan of `src/client`, `src/live`, `src/realtime/live-socket-client.ts`: 0 `TODO` / `FIXME`,
0 `any`, 0 non-null assertions, 0 `@ts-expect-error` outside tests, 1 lint directive
(`live-result.ts:124`, with its reason), 8 `as unknown as` casts, each at a documented seam
(`mode.ts:72`, `live-sim.ts:189, 1149, 1180`, `source/index.ts:118`, `live-result.ts:99`,
`live-socket-client.ts:460`, `testing/socket.ts:778`). `npm run lint` exit 0.

**F66-9, `live-sim.ts` at 1,290 lines: do not split it before W50 and W51.** The pure parts are
already separate (the other twelve files hold 2,112 of the folder's 3,402 lines); the two
runtimes depend on the public API only, so a later split costs them nothing; and the closure is
the one piece both stand on, proven only on the fake transport so far. The risk is not the length
but CPC1-15. Recommended order: (1) with the fixes of CPC1-1 and CPC1-2, gather the flags into
one typed state record and add a state table like the socket client's
(`live-socket-client.ts:19-47`); (2) extract the reports (`live-sim.ts:212-282`), a seam with no
shared state beyond the clock and the link; (3) after the first run against the real server
(W58), and only if wanted, the action runners (`:758-1180`) and the session controller
(`:509-723`) as two factories over that record. Step 3 carries a moderate risk: the runners write
six of the flags. The 244 tests and the mutation script protect it.

---

## 7. Tests as evidence

| Criterion | Test | Code | Would the test fail if the behaviour broke? |
|---|---|---|---|
| AC-C-10 atomicity, both orders | `test/live-source-atomicity.test.ts:112-167`, `:169-187`; `test/live-source-react.test.ts:149` | `command-gate.ts:161-192, 218-227`; `live-sim.ts:813-864`; `live-result.ts:59-65` | Yes. The log `update, ok, done` is asserted before `connection.delta()` returns, and the microtask a subscriber queued must come after. Mutations G01, G02, S02, R01 detected |
| AC-C-14 settle time-out, exactly one `resync` | `test/live-source-atomicity.test.ts:309-349, 351-366` | `command-gate.ts:194-207`; `live-socket-client.ts:709-722, 1173-1177` | Yes. Nothing at 1,999 ms; one `resync` and a resolved action at 2,000 ms; still one after 10 s, and one for two commands. G05 to G08 detected |
| AC-C-12 no unhandled rejection, one report | `test/live-source-atomicity.test.ts:469-493` | `live-result.ts`; `live-sim.ts:766-769` | Yes, for an action: a real `unhandledRejection` listener across a macrotask. It does not cover the source's own continuations (CPC1-2) |
| AC-B-63, AC-C-06 isolation | `test/live-source-simulated-isolation.test.ts:135-193` | `live/core-actions.ts:30-32`; module level of the folder | Yes. Four spied globals and a positive control. The server-log half of AC-B-63 is W97's |
| AC-C-13 touch throttle | `test/live-source-session.test.ts:769-823, 853-878` | `touch-throttle.ts:86-118`; `live-sim.ts:469, 711` | Yes. T01 to T03 detected. The age of offline activity is untested (CPC1-10) |

**D61.** Each of the six Live-source test files that use the fake ends every test with
`assertNoViolations()`: an `afterEach` in `atomicity:35-39`, `bindings:492-496`, `react:51`,
`replica:66-69`, `session:52-56`, and a `finally` in `simulated-isolation:215-218`.
`client-core.test.ts` and `realtime-live-socket.test.ts` use their own doubles, not the fake, so
the rule does not apply to them.

**F48.** `test/client-types.test.ts:173-250` now runs against the full registry: the default
client is typed by `RegistryTable`, five `@ts-expect-error` lines misuse real operations
(`:237-248`), and `:208-232` is the TS2590 regression over all 75 operations. `test` is inside
the compiler's `include` (`packages/shared/tsconfig.json`) and `typecheck` exits 0, so the
directives are live.

**Mutation coverage (judged, not repeated).** `assets/44_mutations.log`: 60 of 60, on delta
application (13), the gate (14), the source (16), bindings, errors, lockout, throttle and result
(17). Good on the documented behaviour. Thin on teardown and on guards: no change touches
`stop()`, the `reopen` rule (`live-sim.ts:564-567`), the conditions of `inspect` (`:716-721`),
the probe retry, `lockoutKnown`, or the order "port, then settle" of `pair`. Those are where the
findings of section 5 lie. `assets/30_mutations.log`: 43 of 44, and it does cover `stop()`,
`reconnect()` and the back-off.

**What every proof shares** (the rows say so): everything runs on the fake transport. No request
reached a Core server, no socket was opened to one, no device ran the Live source.

---

## 8. The 18 decisions of W44 (implementation/44 section 11)

None is overruled. Decisions 1, 4, 6, 9 to 13, 15, 17 and 18 stand as built.

| # | Decision | Ruling | Reason and condition |
|--:|---|---|---|
| 2 | Input passes through, no local validation | Uphold | The server judges identity and permission before the body, so a denied attempt is audited. Local validation would hide it. Consequence to keep visible: a text the simulator cuts is refused in Live mode with `INVALID_INPUT`; the form rows keep the bounds |
| 3 | A 2xx POST without `x-dems-revision` settles at once, one `warn` | Uphold, with a condition | The backend gate must assert API-7 for every 2xx of a POST. If one operation legitimately has no revision, name it in the contract; otherwise raise the report to `error`, because the continuation then runs before its effect |
| 5 | Snapshots are held while a command is in flight | Uphold, with a condition | A snapshot applied early would show the effect before the continuation. The condition is CPC1-2 and CPC1-3: the hold has no upper bound of its own, so every path out of a command must reach the gate |
| 7 | The socket is reopened one promise job after an end | Uphold, with a condition | Right for timing. CPC1-1 (do not reopen twice with a refused credential) and CPC1-20 (bound the wait for the port) |
| 8 | `touch`: activity while offline is remembered | Uphold, with a condition | CPC1-10 |
| 14 | `exportAudit()` / `exportLogs()` without a request send `{ reason: '' }` | Uphold | The same reason as 2: a caller without the permission gets its 403 and its `EXPORT_DENIED` row. One call site depends on it: CPC1-22 |
| 16 | `ready` never rejects, bounded by 4,000 ms | Uphold | A rejecting `ready` would need a handler in both start-ups for no gain. Note for W50: `ready` also resolves when `stop()` is called (`live-sim.ts:1219`) and says nothing about the outcome; read `live.session`, `live.link` and the store after it |

New decision asked: CPC1-21.

---

## 9. Fixes, in order of priority

| # | Finding | Owner | Before |
|--:|---|---|---|
| 1 | CPC1-2 guard `commit` and the three runners | W44 | W50 or W51 puts a subscriber on a Live store |
| 2 | CPC1-1 idempotent device end, no second reopen | W44 | W57 (mobile pairing flow); W51 writes the port |
| 3 | CPC1-3 credential provider inside the time-out | W12 | W51 wires the bearer provider; until then the provider reads memory only |
| 4 | CPC1-4 the misuse report; a wider static test | W44; the client rows | W55, the first call-site row |
| 5 | CPC1-21 local lock: a decision | Controller; then W44 and W54 / W55 | W54 (the shell's Lock entry) |
| 6 | CPC1-5 `ApiErrorCode` instead of literals | W44 | W83 |
| 7 | CPC1-6 the three markers | W44 | W83 |
| 8 | CPC1-17 the text of AC-B-62 and TS-1 | Controller | W97 |
| 9 | CPC1-7 to CPC1-11 | W44 | W58 (backend gate), each with its test |
| 10 | CPC1-12; CPC1-13; CPC1-14, CPC1-15, CPC1-16 | W12; W18; W44 | W92 (the code review of `packages/shared`) |

For the briefs of W50 and W51: (a) the socket's `headers()` is synchronous and is asked when the
source is created; (b) the typed client's credential provider must not touch storage; (c)
`deviceUnpaired` and `sessionCleared` must have removed the value before they resolve; (d) call
`live.reconnect('RETRY')` on return to the foreground when the link is STALE; (e) `ready` resolves
on `stop()` too; (f) F66-8 of the row's log (how to script the fake).

---

## 10. What was not reviewed, and what is not verified

- **Nothing was executed beyond typecheck, lint and the shared test run.** CPC1-1 to CPC1-11 and
  CPC1-21 are traced in the code and not reproduced. Each should get its test with its fix.
- `src/live/testing` (W31, 3,373 lines): read `index.ts`, `install.ts` and
  `fake-transport.ts:1-235`; `contract.ts`, `http.ts`, `socket.ts`, `log.ts`, `errors.ts` and
  `clock.ts` were not read line by line. Its import list and its static test were checked.
- Test files: read `client-types.test.ts` in full, `live-source-atomicity.test.ts:1-500`,
  `live-source-simulated-isolation.test.ts:60-200`, and parts of `live-source-session.test.ts`
  and `live-source-bindings.test.ts`. The other tests were judged by name and by the mutation logs.
- The contract under `src/api` (reviewed elsewhere): read only where the client layer uses it.
- The logs: 44 in full; 30 section 9; 12 section 17.6; 18 and 31 by their headings. Of the
  context documents: the rows, rules and criteria cited here. `research/03_analysis.md` and
  `identification/01_*.md` were not read; `implementation/99_implementation_report.md` does not
  exist.
- Behaviour against the real Core server, a browser, Hermes or a device: not observed. In
  particular the server's answers to a revoked or unknown credential on REST, its revision and
  epoch after a restart, and close codes on React Native.
- No bundle was built; the mutation runs were not repeated; the apps were searched, not reviewed.

---
*Generated: 2026-10-04 13:06 WIB*

---

# Re-review of the fix rounds (decisions D80, D81, D84, D86)

Appended to the first pass above, which is unchanged. Same rules: read-only, the three permitted
commands, read-only searches, no source edit.

## R0. Result

**Verdict after the fixes: PASS WITH FIXES.** All 22 findings of the first pass are dealt with:
19 are closed in the code (17 pinned by tests, CPC1-14 by the compiler, CPC1-15 a restructuring with no behaviour of its own); 1 is closed by a ruling (CPC1-17); 2 are routed
to briefs as proposed (CPC1-19, CPC1-22). The fix of CPC1-21 (the local end) brings two new
Medium findings; five Low and three Info are new. None removes or changes a member of the public API (the fix of CPC1-24 adds one optional option), so **W50 and W51
may start, briefed from sections 15 and 16.6 of the Live source's log plus the additions of R5.**

| | First pass | Now |
|---|---|---|
| Findings of the first pass | 22 open | 0 open in the shared layer; 2 wait for their client row (CPC1-19 at W51, CPC1-22 at W76) |
| New findings | — | 10: 2 Medium (CPC1-23, CPC1-24), 5 Low (CPC1-25, 26, 27, 31, 32), 3 Info (CPC1-28, 29, 30) |
| Blockers | 0 | 0 |

Commands run from `/Users/gsp-budi/Documents/DEMS`:

```
2026-10-04 15:11 WIB $ npm run typecheck -w @dems/shared      > tsc --noEmit    exit=0
                     $ npm run lint -w @dems/shared           > oxlint          exit=0
2026-10-04 15:11:54  $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1747 passed (1747)
   Duration  22.90s                                                              exit=0
```

The controller's baseline of 14:37 (68 files, 1,747 tests). `git diff acaff20 --numstat --
packages/shared/src/sim` is unchanged (5/0, 3/2, 5/2, 27/0, plus `text-cut.ts`): the fix rounds
did not touch the simulator.

How this pass was done: `core-client.ts:56-70, 370-397, 470-815`, `live-sim.ts` (all 2,093
lines), `command-gate.ts:56-302`, `live-result.ts:20-208` and `hooks.ts:56-88` were read; the
other changed files of `src/live/source` were read as a diff against their pre-images
(`git diff --no-index .cache/rollback/W44-fix/source/<file>`). Test bodies read: all of
`client-credentials.test.ts`; `live-source-resilience.test.ts:120-469`;
`live-source-local-end.test.ts:120-479`; `live-source-misuse.test.ts:60-150`;
`live-source-platform-neutral.test.ts:184-232`; `live-source-bindings.test.ts:446-462`. The
other tests are judged by name and by the code they pin. **The new findings are established by
reading; none was executed.** One command of this pass changed into the assets folder before a
listing (`cd`, against P10); it read only, and the working directory is reset between commands.

---

## R1. Per finding (question A)

"Would it fail" is my judgement of whether the test fails when the behaviour regresses.
"Read" means I read the test body; "by name" means I read its name and the code it pins.

| Finding | Status | The fix | The test that pins it | Would it fail? |
|---|---|---|---|---|
| **CPC1-1** Medium | **Closed** | `live-sim.ts:851-867` (a refused reopen is the same revocation), `:879-880, 910-913` (one end, remembered), `:963-988` (three delayed repeats, then a closed socket), `:777` (no read with a revoked credential), `:2079-2088` | `resilience:380-398, 400-414, 416-464` | Yes (read): `ends` has length 1; the port is asked at 0, 2, 6 and 14 s; five sockets, then none; link OFFLINE |
| **CPC1-2** Medium | **Closed** | `live-sim.ts:379-395, 413-418` (every subscriber guarded), `:466-480`, `:560-568` (`commit` cannot throw), `:1254-1265` (`ask`), `:1533-1560` (`throughGate`: one exit) | `resilience:227-373` | Yes (read): a real `unhandledRejection` listener; the end is complete; a later subscriber is told; a delta is applied afterwards |
| **CPC1-3** Medium | **Closed** | `core-client.ts:596-609` (the call is checked before the provider is asked), `:654-707` (one budget), `:709-741` | `client-credentials:74-198` | Yes (read): unsettled at 7,999 ms, settled at 8,000; no `fetch`; the provider's text absent. Residual, stated by the row: the provider is not aborted (F34-21) |
| **CPC1-4** Medium | **Closed, with stated limits** | `live-sim.ts:511-525, 1444-1478`; `live-result.ts:35-41, 63, 79-85, 114, 150, 170-184`; `bindings.ts:536-569` | `misuse:73-150` | Yes (read). Limits as the log's section 14.4 states them: a void action read as a value cannot be detected; the wider static test is the client rows' (D80) |
| **CPC1-5** Medium | **Closed** | `rebuild-error.ts:53-74, 132-136, 147`; `bindings.ts:210, 232, 317-319, 509`; `live-sim.ts:1048, 1294-1298, 1823` | The compiler (members of `ApiErrorCode`); `platform-neutral:184-216`; `bindings:446-451` | Yes (read): the static pattern has positive controls |
| **CPC1-21** Medium | **Closed as ruled (option a)**; see CPC1-23, CPC1-24 | `live-sim.ts:752-775, 795` (the owed socket is not taken), `:814-816`, `:998-1062`, `:1353-1392`, `:1710-1714`, `:1794-1838` | `local-end:120-540` | Yes (read to `:479`): one store update, no request, exactly one owed sign-out, its state never shown |
| CPC1-6 | **Closed** | Markers at `bindings.ts:156`, `live-sim.ts:42, 994`, `neutral-state.ts:76`, `core-client.ts:63` | `platform-neutral:218-232` | Yes (read) |
| CPC1-7 | **Closed** | `live-sim.ts:613, 1464-1478, 1541, 1574, 1994-2018`; `command-gate.ts:266-278` | `resilience:560-650`; `atomicity:705` | By name; the code was read |
| CPC1-8 | **Closed** | `live-sim.ts:369-372, 1122-1128, 1143-1156`; `command-gate.ts:199-203, 243-257` | `resilience:654-727`; `atomicity:655-703` | By name; the code was read |
| CPC1-9 | **Closed** | `live-sim.ts:778-787, 1089-1109`; the comment of `socket.headers` in `types.ts` | `resilience:729-768` | By name |
| CPC1-10 | **Closed** | `touch-throttle.ts:65, 113-121` | `session:886-960` | By name; the diff was read |
| CPC1-11 | **Closed** | `live-sim.ts:1195-1223, 1879-1885` | `resilience:770-789` | By name |
| CPC1-12 | **Closed by a test**; the constant itself is CONTRACT-GAP-4 for W83 | `core-client.ts:59-70` | `client-credentials:263-296` | Yes (read): a fourth token pattern in the contract turns `:272` red |
| CPC1-13 | **Closed** | `live/hooks.ts:71-88` | `react:222-270` | By name |
| CPC1-14 | **Closed** | `live/source/index.ts:131-146` | The compile probe (`assets/44_fix_assim_probe.log`); `misuse:196-217` | Compile time; the code was read |
| CPC1-15 | **Closed** | `live-sim.ts:86-107` (the table), `:279-362` (one record); one `let` is left (`:429`) | None (a restructuring) | — |
| CPC1-16 | **Closed** | `live-socket-client.ts:468` (`export`); `live-sim.ts:127-128, 400` | `platform-neutral:146` | By name. See CPC1-28 |
| CPC1-17 | **Closed by a ruling, not by a text** | D80 with drift DR-07 (`decisions.md:106`); the specifications are not re-issued | W97's brief must carry "W16 plus SIM-GAP-1" | — |
| CPC1-18 | **Closed** | The header texts; `rebuild-error.ts:67-69`; `bindings.ts:168-172` | `bindings:426-445` | By name |
| CPC1-19 | **Routed, as proposed** | No code; the log's section 15, row 4 | — | Open until W51 |
| CPC1-20 | **Closed** | `live-sim.ts:627-663, 951, 1719-1729, 1873-1875` | `resilience:504-558` | By name. See CPC1-29 |
| CPC1-22 | **Routed (D80)** | The log's section 15, row 14 | — | Open until W76 |

Red before, green after, as the owners report it: `assets/44_fix_red_green.log` (57 red, then
292 green), `44_followup_red_green.log` (9 red, then 304 green), `12d_cpc1_red_before.log`
(8 of 18 red) and `12d_cpc1_green_after.log` (18 green); `44_mutations.log` ends `mutations: 127,
killed: 127`. The files exist and say so; I did not repeat the runs.

---

## R2. New risk introduced by the fixes (question B)

### R2.1 Answers

| Question | Answer |
|---|---|
| Can the local end end a session that is fine? | **Yes: CPC1-23.** An explicit sign-out or Lock ends what the operator asked to end. A local EXPIRY can end a session the Core still holds, and the sign-out it then owes ends it at the Core |
| Can it leave Core data on screen? | Not on a running source: the replica is cleared in one guarded update (`live-sim.ts:923-930`), state of an owed socket is held and dropped (`:795, 1059`), meters stop (`:802`). Three edges: a stopped source has no expiry timer (`:1999`; CPC1-30); after a device sleep the check waits for the first link change, at most the stale interval (by reasoning; a sleeping device was not observed); another tab keeps its own replica until its own link returns |
| What if the owed sign-out's answer never comes? | The typed client settles within 8 s; the request is repeated after 2, 4, 8 … 30 s, never inside a `retry-after` (`:1039-1045`); the socket stays untaken and its state is bounded (256). A sign-in waits for an owed request that is out (`:1659`), at most 8 s |
| A new operator signs in while a sign-out is owed: whose session ends? | In the same tab: the old one, or none. The sign-in waits for an owed request that is out, no owed request is sent while a sign-in is out (`:1009-1013`), and the sign-in's answer ends the debt (`:1710-1714`). **Across tabs: the new one (CPC1-23 b).** The owed request names no session |
| The bounded retry of `deviceUnpaired`: how does the app recover? | `live.reconnect('CREDENTIAL')` clears the remembered revocation and opens a socket (`:2079-2083`). `setPairing(pairing)` clears it but opens nothing. `pair` cannot run meanwhile: the link is OFFLINE. `reconnect('RETRY')` helps only when the credential is really gone. No member says "gave up": CPC1-30 |
| Guarded subscribers: is an exception swallowed that should stop the app in development? | It is contained and reported through `onError` only, once a second at most. Nothing reaches the console or React's error overlay unless the app's sink puts it there: CPC1-30 |
| The observed `live.client`: identity | `live.client !== options.client`; its prototype is the injected client, `call` is its one own member. No production file of the apps holds or compares a typed client today (search). Section 16.6, row 16 says it. A client that depends on `this` in other members would break; `createCoreClient`'s does not |
| The activity rule: "never early, possibly late" on every path? | **No.** Late: yes, bounded by the idle time-out. Early: a POST the Core counted whose answer was lost (`:1285`), a POST of another tab, a POST around `live.client` (documented). And an action's late answer has no session check: CPC1-25 |
| The probe back-off and the 256 bound | Sound. An OPERATOR `hello` asks at once, whatever the back-off, except inside a `retry-after` (`:1122-1128`). Beyond 256 held messages everything held is dropped, deltas are dropped until a snapshot, one resync is asked for when the gate is free (`command-gate.ts:243-257, 199-203`) |
| `stop()` settling every action that is out | Sound: waiters are dropped (an accepted command resolves), flights reject `STOPPED`, late answers return on `control.settled`, the run counter voids every continuation. A rejected flight is reported at level `error`; `warn` would do |
| The hidden `ok` member | Not enumerable: `Object.keys`, `JSON.stringify`, a matcher's walk and a log's listing read nothing (`misuse` test). `'ok' in result` is true. Derived results (`then`) do not carry it. No React key or prop is involved |
| The misuse report on the three call sites that drop a value | `export-wizard.tsx:133`, `evidence/sim-adapter.ts:61` and `maintenance-section.tsx:114` each give one `NOT_OBSERVED` at level `warn` per action name, no `error`. After that first report the same sign is not reported again for that action |

### R2.2 New findings

**CPC1-23. Medium. W44. A local expiry can end a session the Core still holds, and the sign-out
it then owes ends that session for every tab.**
- The instant is reckoned from the last session answer and the POSTs this source saw
  (`live-sim.ts:1353-1360`). It does not see a POST of another tab of the same browser profile
  (the cookie, and so the session, is shared: `04_client_integration_spec.md:478, 521`), nor a
  POST the Core counted whose answer was lost (`:1285`).
- `checkExpiry` (`:1381-1392`) ends the session here when the instant has passed and
  `coreWouldTell()` is false. `coreWouldTell` (`:1374`) is false for every link state but ONLINE,
  and it is asked at every link change (`:814-816`): also RESYNCING, where the socket is open and
  the Core would tell, and STALE.
- `endLocally` (`:998-1004`) then owes a sign-out as USER, and the next OPERATOR `hello` sends it
  (`:754-761`).
- (a) Tab B is idle for 15 minutes while the operator works in tab A. B's link blips once. B
  shows "Session expired" and, when its socket is back, signs the shared session out: the
  operator is signed out in tab A in the middle of the work, and the audit trail holds a user
  sign-out that no user made.
- (b) The owed request names no session (`:1014`; the header says so, `:55-57`). When another tab
  signed in meanwhile, the request ends the NEW session. `local-end:269-296` covers only the case
  in which an anonymous socket came in between.
- The tests pin the behaviour: `local-end:424-435` (the Core has not ended the session five
  seconds after the instant; the link is lost; the session ends here) and `:457-475` (then it is
  signed out as USER).
- Fix: (1) count RESYNCING on an OPERATOR socket as "the Core would tell"; (2) when the instant
  passes while the Core would tell and no `session.ended` follows, ask `getAuthSession` once (a
  GET moves no idle time) and take its `idleExpiresAt`; (3) before a debt is paid, ask
  `getAuthSession`: a 401 owes nothing; a session with another `issuedAt` or operator owes
  nothing; for the debt of an EXPIRY, a session whose `idleExpiresAt` lies after the instant
  reckoned here is not signed out (this tab stays signed out, the debt is dropped). The members
  exist (`api/identity.ts:121-124`); no contract change. Decisions 21 and 24 change with it.
- Verified: by reading. Not verified: what the Core counts (read in the log's F66-19).

**CPC1-24. Medium. W44 and W50. The debt of a local end lives in memory: a page reload forgets
it, and a Lock made while the Core could not be reached is undone.**
- `state.owed` (`live-sim.ts:311, 1000`) belongs to the source. A reload builds a new one
  (`:324-362`); the browser still holds the cookie; when the Core answers again inside the idle
  window the probe adopts the session (`:1115-1191`): signed in, with the data, without a
  password. The tablet is not affected: its token is dropped at the local end (F66-15).
- Bound: the Core's idle expiry, 15 minutes after the last activity it counted. Loopback only.
- Why it matters: this is the one place where the behaviour D80 ruled ("Lock never does nothing")
  does not hold for the web console.
- Fix: an optional port, for example `CreateLiveSimOptions.owedSignOut?: { read(): SignOutReason
  | null; write(reason: SignOutReason | null): void }`. W50 backs it with the tab's
  `sessionStorage` (each tab has its own, `04_client_integration_spec.md:478`). A source that
  starts with a debt pays it before it adopts an OPERATOR socket. Additive. Or the controller
  records it as a residual beside F66-15.
- Verified: by reading.

| ID | Sev. | Owner | File:line | What is wrong | Suggested fix |
|---|---|---|---|---|---|
| CPC1-25 | Low | W44 | `live-sim.ts:1291-1301` against `:1329-1333`; the runners check only `control.settled` (`:1574, 1627, 1689, 1813`) | An action's answer is not held to the session that sent it. An answer that arrives after a sign-out and a new sign-in counts as activity of the new session, and a late 401 `NOT_SIGNED_IN` ends the new session. The log's "not counted" (section 16.2) holds for `live.client` only. Window: at most 8 s | Take `state.era` before `call`; skip `inspect` when it moved |
| CPC1-26 | Low | W44 | `live-sim.ts:639-641`; `:1729, 1875` with `:483-508` | The text and the stack of what the app's secrets port throws travel into reports (`live.secrets`, and `live.action.signIn` / `pair`), and the action rejects with the port's own error. A port whose error names the value it failed to store puts a token into the persistent log. D81 removed exactly this in the typed client (`core-client.ts:679-683`). `resilience:452` pins the text in the report | A fixed text and `errorName` for a port failure; no message, no stack |
| CPC1-27 | Low | W44 | `clock.ts:32-36`; first read at `live-sim.ts:415` | The Live clock never moves backwards and is first read at creation, before any reading of the server clock. With a server clock behind the local one by X it stands still for X and then runs X ahead of the server: the local expiry comes X early. One computer: none. An emulator whose clock is ahead; a client test that injects no `now` while the fake's time is the contract examples' instant | Let the first sample set the clock without the clamp. Brief: every client test injects `now: fake.clock.now` |
| CPC1-31 | Low | W44 | `live-sim.ts:1823-1826`; `:1046-1061` then `:764` | A sign-out the Core refuses (not 401) fails open: the action rejects and the client stays signed in (decision 20), and a refused OWED sign-out is followed by a probe that adopts the session again, so a locked console resumes. Not reachable with today's contract (403 `ORIGIN_NOT_ALLOWED`, or a defect) | Fail closed: the local end stands; no adoption after a refused owed sign-out |
| CPC1-32 | Low | W44 | `live-sim.ts:1319-1342` | Decision 35: a page's call through `live.client` gets no CL-23. See R3 | `inspect` instead of `noteActivity` in the view |
| CPC1-28 | Info | W30 at W92 | `sim/platform.ts:187`; `realtime/live-socket-client.ts:468` (and `realtime/index.ts:2`) | The package now exports two constants named `DEFAULT_TIMERS`, of two types | Rename the socket client's with its test, as the ruling first said |
| CPC1-29 | Info | Briefs of W51, W56, W57 | `live-sim.ts:1719-1729, 1873-1875` | The 5 s bound covers `sessionIssued`, which carries the rotated biometric token: a write that waits for an OS prompt runs past it and the sign-in rejects although the Core issued the session. A `devicePaired` that runs past it leaves a device the Core registered and the tablet does not hold (revoke it in the portal) | A note in the briefs: store in memory first, resolve, persist without a prompt |
| CPC1-30 | Info | Briefs of W50, W51, W57 | `live-sim.ts:466-480, 511-525, 966-974, 1999` | See R5, notes g to j | — |

**The note on CP-B1** (an error logged under a key other than `err`): the client layer hands the
apps no error object. A report is `{ level, source, message, stack?, context, at }` with a
`context` of strings, numbers, booleans and null (`sim/types.ts:68, 130-137`); the typed client's
report holds fixed texts. What does travel is the free text of an exception that app code threw
(a listener, a subscriber, a secrets port): CPC1-26. The socket client's own report can carry the
thrown value as `cause` (`live-socket-client.ts:308-309`); the Live source turns it into text
(`live-sim.ts:729-750`) and no app uses that client directly.

---

## R3. Decisions 19 to 37 (question C)

| # | Decision | Ruling |
|--:|---|---|
| 19 | A sign-out without an answer while ONLINE is a local end | Uphold |
| 20 | A sign-out the Core refuses (not 401) rejects; the client stays signed in | Uphold for now; fail closed is the better default (CPC1-31) |
| 21 | An expiry decided here owes a sign-out, sent as USER | **Overrule in part**: not paid blindly. The Core is asked first (CPC1-23, fix 3) |
| 22 | A socket that is no OPERATOR socket ends the debt; a tablet sends nothing | Uphold (F66-15 is an accepted residual) |
| 23 | The owed sign-out backs off; a sign-in ends the debt at its answer | Uphold; bind the debt to the session it was owed for (CPC1-23 b) |
| 24 | While ONLINE the expiry ends nothing here | Uphold, amended: at the instant the Core is asked for the session's real expiry, and RESYNCING counts as "the Core would tell" (CPC1-23, fixes 1 and 2) |
| 25 | An answered POST moves the idle instant | Uphold (now decision 34) |
| 26 | `NOT_OBSERVED` is a `warn`, `READ_AS_VALUE` an `error` | Uphold |
| 27 | At `stop()` an accepted command resolves, an unanswered one rejects `STOPPED` | Uphold |
| 28 | The storage is asked again three times, then the socket stays closed | Uphold; say how the app sees it (R5, note j) |
| 29 | A `hello` that names `DEVICE_REVOKED` starts no status read | Uphold |
| 30 | `sessionIssued` and `devicePaired` are bounded too | Uphold, with CPC1-29 in the briefs |
| 31 | 256 held messages; the probe's cap is 30 s | Uphold |
| 32 | A subscriber that keeps throwing is reported once a second at most | Uphold |
| 33 | One generic hook | Uphold |
| 34 | A refused POST moves the idle instant; only a 2xx restarts the touch period | Uphold. "Never early" has the three exceptions of R2.1 |
| 35 | The observed view counts activity and nothing else | **Overrule: a page call gets the full CL-23.** CPC1-32 |
| 36 | No extra `getAuthSession` when the second socket carries no session | Uphold: the bound holds |
| 37 | The exported name stays `DEFAULT_TIMERS` | Uphold for now; CPC1-28 |

**Decision 35, the reason.** CL-23 (`04_client_integration_spec.md:283`) says "on any call of a
client that believes it is signed in", and CL-15 makes `client` a member of the Live source. With
the view as built, the two administration pages (W77, W81) each have to write their own handling
of a 401 and a 403, twice, and differently from every action. A permission hint that went stale
during a link blip (a missed `session.updated` is not replayed) is then never refreshed from those
pages, so each further attempt is refused, audited as `ACCESS_DENIED` and counted against the
denial budget. The full behaviour costs one debounced GET after a 403 and changes no result, no
error and no timing of the page's call. Keep the one exemption that is right: a page call is not
refused while the link is down (CL-22 is the actions'). The view already holds the answer to the
session that sent it (`:1329-1333`), so a late 401 cannot end a newer session. Before W77 and W81.

---

## R4. The public API (question D)

The 16 rows of the log's section 16.5 match the code read in this pass. I did not recount the 30
members of `LiveSim` or the 56 exports; a test of the row pins both. Nothing I read was removed or
narrowed. What W50 or W51 could trip over and sections 15 and 16.6 do not say is R5.

---

## R5. Verdict, what is open, and the briefs (question E)

**PASS WITH FIXES. W50 and W51 may be briefed from sections 15 and 16.6 as written, with these
additions:**

| | For | Note |
|---|---|---|
| a | W50, W54 | Until CPC1-24 is decided: a sign-out or Lock made while the Core could not be reached is forgotten by a page reload |
| b | W50, W54, W55 | Until CPC1-23 is fixed: with two tabs, an idle tab can end the shared session after a link blip. No lane check with two tabs before the fix |
| c | W51, W56, W57 | CPC1-29: `sessionIssued` has 5 s and carries the rotated biometric token; no OS prompt inside it. A `devicePaired` past 5 s leaves a registered device to revoke |
| d | W50, W51 | The refusal presenter words four codes of `LiveTransportError`: `CREDENTIALS_UNAVAILABLE` and `CREDENTIALS_TIMEOUT` (nothing was sent), `SNAPSHOT_TIMEOUT`, `STOPPED` (the screen is gone: show nothing) |
| e | Every client test | Inject `now: fake.clock.now` and `timers: fake.clock.timers` (CPC1-27) |
| f | The administration page rows | Decision 35 is under review (CPC1-32): write no page-level handling of a 401 before the ruling |
| g | W50, W51 | In a development build the `onError` sink makes a report of level `error` from `live.subscriber` and `live.misuse` loud (console): the source contains it and writes nothing itself |
| h | W50, W51 | A stopped source has no expiry timer. Do not leave a stopped source on screen; a source that is started again checks at once |
| i | W50 | `Object.keys(live.client)` is `['call']`: a copy by spread loses `operationIds` and `describe` |
| j | W57 | The clean-up that gave up is seen as `link === 'OFFLINE'` with `socketStatus().end?.kind === 'DEVICE_REVOKED'`: delete the credential, then `reconnect('CREDENTIAL')`. `setPairing` alone opens no socket, and `pair` is refused while the link is down |

Still open, in order:

| # | Item | Owner | Before |
|--:|---|---|---|
| 1 | CPC1-23 the local expiry and the owed sign-out ask the Core first | W44 | W54 (the shell); any lane check with two tabs |
| 2 | CPC1-24 the debt survives a reload, or a recorded residual | Controller; then W44 and W50 | W54 |
| 3 | CPC1-32 decision 35 | Controller; then W44 | W77, W81 |
| 4 | CPC1-26 no port text in reports | W44 | W56 (the first row that writes a real port) |
| 5 | CPC1-25, CPC1-27, CPC1-31 | W44 | W92 |
| 6 | CPC1-28 the timer name | W30's owner | W92 |
| 7 | CONTRACT-GAP-3, -4, -7 | W83 | W83 |
| 8 | CPC1-19 (STALE on return to the foreground) | W51 | W51 |
| 9 | CPC1-22 (`exportLogs()` without a reason) | W76 | W76 |
| 10 | The wider static test of AC-C-53; no `createCoreClient` outside the runtime | The client rows | W55 |
| 11 | The condition on decision 3 (API-7 on every 2xx POST); whether a refused POST moves the Core's idle expiry (F66-19) | W58 | W58 |
| 12 | The brief of W97: the simulator diff is "W16 plus SIM-GAP-1" | Controller | W97 |

Not reviewed in this pass: the test bodies named "by name" in R1; `44_mutate.py` and the
red-green scripts (their logs only); `apps/core-server` (the activity rule was taken from the
log's F66-19); behaviour against a real Core server, browser or device.

---
*Re-review appended: 2026-10-04 15:25 WIB*

---

# Third pass: the second fix round (decisions D90, D97)

Appended; the first pass and the re-review above are unchanged. Read-only, the three permitted
commands, no `cd`.

## T0. Result

**Verdict: PASS WITH FIXES, Low only.** The seven findings of the re-review that asked for code
are closed, and both Medium ones are pinned by tests that fail on the code before the round.
Nothing of Medium or higher is open in the shared client layer. Six new items: 3 Low, 3 Info.
None stands in the way of W50 or W51.

Commands, from `/Users/gsp-budi/Documents/DEMS`:

```
2026-10-04 15:59:52 WIB $ npm run typecheck -w @dems/shared      > tsc --noEmit    exit=0
                        $ npm run lint -w @dems/shared           > oxlint          exit=0
2026-10-04 15:59:55 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1775 passed (1775)
   Duration  6.67s                                                                exit=0
```

The controller's figures of 15:59. The simulator diff against `acaff20` is unchanged. Of the 13
files of `src/live/source`, three differ from their pre-images under `.cache/rollback/W44-round2/`
(`live-sim.ts` +406 −119, `types.ts` +55 −3, `index.ts` +1); the other ten are byte-equal
(`git diff --no-index --quiet`).

Read in this pass: `live-sim.ts:296-414, 676-762, 820-1295, 1297-1696, 1810-2379`; the diff of
`types.ts` and `index.ts`; `live-source-local-end.test.ts:58-235` (the model of the Core's
session), `:594-773` and `:803-1018`. The other tests of the round are judged by name and by the
code they pin. **The new items are established by reading; none was executed.**

---

## T1. The seven findings (question 1)

| Finding | Status | The fix | The test | Would it fail on a regression? |
|---|---|---|---|---|
| **CPC1-23** Medium | **Closed** | `live-sim.ts:1579-1580` (RESYNCING on the session's socket counts as "the Core would tell"); `:886` (a link change looks only when the Core would not tell); `:1595-1647` (at the reckoned instant the Core is asked; a local end only without an answer and without a socket that would tell); `:1069-1084` (the debt names its session); `:1159-1248` (the Core is asked before anything is paid; another session is taken; no sign-out for an expiry) | `local-end:644-675` (two tabs), `:677-700` (a lost answer), `:702-728` (RESYNCING), `:730-743`, `:745-764`, `:400-429` (a new sign-in in another tab) | **Yes (read).** On the old code tab A ends at the blip of minute 16: `a.ends` is not empty, one `signOut` is sent, `core.session.open` is false and tab B is signed out; each is asserted |
| **CPC1-24** Medium | **Closed** | `types.ts:188-223` and the option; `live-sim.ts:459-461`, `:1082` (written before the end is reported), `:1091-1144` (read at the first start, settled first), `:1303-1307` (nothing is asked for before the storage was read), `:2270-2271` | `local-end:824-840` (written before the report, four members, no credential), `:842-873` (a reload), `:875-885` (a second tab pays), `:887-898`, `:961-986`, `:988-1005`; `platform-neutral:139` | **Yes (read).** Without the port the reloaded source turns SIGNED_IN: `:861` collects every `auth.status` and expects none |
| CPC1-25 Low | **Closed** | `live-sim.ts:1499-1501`; the generation is taken before each send (`:1826, 1880, 1954, 2077, 2131, 2187`) and held at `:1831, 1885, 1962, 2083-2092, 2137, 2193` | `local-end:1216-1303` | By name; the code was read |
| CPC1-26 Low | **Closed** | `live-sim.ts:302` (a failure carries nothing), `:682-690`, `:698-735`, `:1919-1928`, `:1996`, `:2158` | `resilience:511` and after; `session:1418`; `local-end:961-986` | Yes for the one read: a marker text in the port's error is looked for in every report and in `errors()` |
| CPC1-31 Low | **Closed** | `live-sim.ts:2093-2107` (the action resolves, the end is local, the debt stays), `:1224-1237` (a refused payment: the debt stays, reported once) | `local-end:550-592` | By name; the code was read |
| CPC1-32 Low | **Closed** | `live-sim.ts:1523-1546` (`:1537`: `inspect`, held to the session that sent the call) | `local-end:1159-1214` | By name; the code was read |
| CPC1-30 Info | **Closed** (one report code) | `live-sim.ts:1039-1046`; `index.ts` exports `LIVE_DEVICE_CLEANUP_GAVE_UP_CODE` | `resilience:457-458` | Yes (read) |

CPC1-27 (the Live clock): a note, as ruled; the residual of the log's section 17.5 is right. CPC1-28
(two exports named `DEFAULT_TIMERS`): still open for the owner of `src/realtime`. CPC1-29: in the
port's comment and in row 13 of the brief list.

**Does "two tabs" as two Live sources over one session model exercise the shared-cookie case?**
For the Live source, yes. Both sources use `credentials: 'browser-cookie'` on one `fake.fetch`,
and every answer comes from ONE `core.session` (`local-end:116-185`): one credential, one session.
A POST of tab B moves the Core's `lastActivityAt` and tab A never sees it; `core.end()` tells every
open OPERATOR socket; `core.signIn()` replaces the session for both. That is the property the
finding was about. What it does not exercise: a browser's cookie jar and `localStorage` themselves;
two live sources settling the same debt at the same time (by reading: the second gets a 401 on its
question and is signed out, `:1207`); and a tab that is already open when another tab writes a
debt (T4).

---

## T2. The port `owedSignOut` (question 2)

**Is `operatorId` plus `issuedAt` strong enough?** Yes, for what it is used for. The Core stamps a
new session with its own clock (`apps/core-server/src/modules/identity/sessions.ts:174`), so a new
sign-in, by the same operator or another, has another `issuedAt`; the record is taken only in its
exact shape (`live-sim.ts:312-319`) and holds no credential. A forged record can at most cause a
sign-out or a question; it can never make the source take a session. Three limits:

| | Limit | Size |
|---|---|---|
| 1 | Between the question and the payment (`:1203` to `:1221`) another tab can sign in; the payment then travels with the new session's cookie | One round trip. Only the contract can close it (a sign-out that names the session's `issuedAt`): CPC1-37 |
| 2 | An already open second tab reads the storage only at its first start (`:2270-2271`). After a Lock in tab 1 while the Core is unreachable, tab 2 keeps its replica until its own link returns | The length of the outage, at most the idle time-out (tab 2 then asks the Core, or ends locally). T5, note a |
| 3 | Until the debt is paid a local Lock protects the screen, not the session: whoever reaches the Core with this browser profile holds the session | The Core's idle window. Inherent; for the final report |

**Is "synchronous write required" stated clearly enough?** In the brief, yes (row 2 of the log's
section 17.4). In the type, no: `write` and `clear` may return a promise (`types.ts:219-223`), and
the comment says a storage that answers later "is waited for in the background" (`:209-210`)
without saying what that costs. CPC1-34.

**An asynchronous or failing port** (the row's F66-24), by reading:

| The port | What happens |
|---|---|
| `write` answers later | The end is reported and the replica is cleared at once; a reload inside the write finds no debt and the session is taken again. Not tested: every fake port of the tests is synchronous |
| `clear` answers later, and a new `write` follows | The two calls are neither awaited nor ordered (`:1082, 1106`): a late `clear` can erase the newer debt |
| `write` throws or runs past 5 s | One report by the names of the call and the error; that source asks the storage no more; the debt lives in memory, as without a port (`:1091-1097`) |
| `read` throws or runs past 5 s at a start | The same; the start goes on and the session is taken. It fails open, which is the behaviour without a port (`local-end:961-986, 988-1005`) |

**A second tab that reads a debt for the cookie's session pays, it does not adopt**
(`live-sim.ts:1137-1141`, then `settleDebt`; `local-end:875-885`). A debt for another session is
dropped and that session is taken (`:887-898`).

---

## T3. Decisions 38 to 49 (question 3)

| # | Decision | Ruling |
|--:|---|---|
| 38 | A locally reckoned expiry is never signed out; its debt is settled by asking only | **Uphold.** Better than what I asked for: no audit row for a sign-out nobody made, and CONTRACT-GAP-7 is gone |
| 39 | An expiry whose session the Core still holds is taken again | **Uphold; I withdraw "this tab stays signed out".** The session is taken only when the Core itself says it is open by its own clock (`:1214`), which is the rule a reload follows; the local expiry is a guard for the time the Core cannot be heard, and it is no judgement on the session. A Lock or a sign-out is never taken again (`:1217-1238`). The shell must follow `auth.status` in both directions (row 17) |
| 40 | A refused USER sign-out fails closed like a LOCK | **Uphold** |
| 41 | A sign-out the Core refuses resolves, with one `error` report | **Uphold.** The shell reads its notice from `lastSessionEnd` |
| 42 | The record and its exact-shape check | **Uphold** |
| 43 | `write` is called before the end is reported and is not awaited | **Uphold**, with CPC1-34 (say it in the type) |
| 44 | A storage that failed once is not asked again | **Uphold.** A failing `read` fails open; stated in T2 |
| 45 | No answer at the instant while the Core would tell: nothing ends; asked again | **Uphold** |
| 46 | The same session past its instant by the Core's clock is neither signed out nor taken | **Uphold** |
| 47 | One fixed rejection, `CoreRefusalError('NOT_AVAILABLE')`, for a failed port | **Uphold** |
| 48 | A report code, not a new member | **Uphold** |
| 49 | No change in `clock.ts` | **Uphold.** The residual is on the early side and is corrected when the Core answers |

---

## T4. New risk from this round (question 4)

| Question | Answer |
|---|---|
| F66-23: the question at the reckoned instant, up to 8 s with the last data on screen | Accept. The data stays past the instant only while the request hangs: a refused connection fails at once and ends locally. Worst case by reading: the stale interval plus one time-out, about 10 s, when the socket dies and REST black-holes together. `expiryAsked` cannot stick: it is cleared by the answer, by `endSession` and by `stop()` (`:1616, 979, 2292`) |
| F66-25: a permission refresh replaces the reckoned instant | Accept. It replaces a reckoning by the Core's own instants (`:1425`, `:1254`); the instant can move earlier only to the Core's truth |
| CPC1-25: can a legitimate answer now be dropped? | Not one that matters. The generation moves only at a session end and at a sign-in's snapshot (`:968, 2030`). The action still settles with its answer; what is skipped is the side effect for ANOTHER session. A 403 `DEVICE_REVOKED` that arrives after an unrelated session end is skipped, and the socket's `hello` and close say the same |
| A sign-in while a debt is being settled | It waits for the question and the payment (`:1916`): two requests, 16 s at worst, before it is sent |

New items:

| ID | Sev. | Owner | File:line | What is wrong | Suggested fix | Before |
|---|---|---|---|---|---|---|
| CPC1-33 | Low | W44 | `live-sim.ts:1171`; `:1194-1200`; `:921-924` | `settleDebt` marks the open socket as "its end is dealt with". When the check ends in `taken` (another session, or an expiry the Core does not confirm) the session is adopted on that same socket and the mark stays. A later close 4401 of that socket WITHOUT a `session.ended` before it is then not treated as an end: the client stays signed in with a closed socket until the next refused call or its idle instant. The Core sends `session.ended` first, so this needs a server that closes without it | Clear `endedConnection` in `taken` | W92 |
| CPC1-34 | Low | W44 | `types.ts:209-223`; `live-sim.ts:1082, 1106` | The port's type allows an asynchronous `write` and `clear`, and its comment does not say that the guarantee (a Lock survives a reload) holds for a synchronous storage only, nor that a late `clear` can erase a newer debt. No test has an asynchronous port | One sentence in the comment; and either narrow `write` and `clear` to `void`, or run the calls one after another | W50 writes its port (row 2 of the brief already says synchronous) |
| CPC1-35 | Low | W44 | `live-sim.ts:826-837`; `api/realtime-messages.ts:225-242` | **Not introduced by this round; found on the claim "two tabs are supported".** When an OPERATOR `hello` returns while a session is known, nothing is asked, and `hello` names no operator. A `session.ended` ROTATED or a `session.updated` that was sent while this tab's link was down is missed: `live.session` (operator, permissions, instants) stays the earlier one, the shell shows the earlier operator, and requests act for the one the cookie names. It corrects itself at the first 403 or at the reckoned instant (15 minutes at most) | One `getAuthSession` at an OPERATOR `hello` of a reconnect while a session is known; compare `operator.id` and `issuedAt`, then adopt | The two-tab lane check with a change of operator |
| CPC1-36 | Info | W44 | `live-sim.ts:1224-1237` | A payment the Core keeps refusing is repeated without an end: one GET and one POST every 30 s at most, each refusal audited by the Core. Not reachable with today's contract | Stop after a number of refusals, with the one report | W92 |
| CPC1-37 | Info | W83, optional | `live-sim.ts:1203-1221` | Limit 1 of T2 | A sign-out request that names `issuedAt` | W83 |
| CPC1-38 | Info | Controller | — | Limits 2 and 3 of T2, and "a failing `read` fails open": residuals for the final report | — | The final report |

---

## T5. The brief list, section 17.4 of the log (question 5)

It replaces sections 15 and 16.6 and my notes a to j, and I checked each of those against it: all
are there (15-1 to 15-14 in rows 3, 4, 6, 8, 9, 11, 12, 15, 16, 18, 19, 21, 24, 26; 16.6-13 to
16.6-18 in rows 1, 8, 16, 21, 22; a to j in rows 1, 2, 4, 5, 7, 13, 14, 20, 22, 25). I found
nothing wrong in it. **It can be used as THE list**, with four additions:

| | For | Add |
|---|---|---|
| a | W50 (row 2) | All three calls of the storage port are synchronous, not only `write` (CPC1-34). And: a tab that is already open does not learn of another tab's debt; while the Core is unreachable a Lock in one tab does not lock the others. Optional: on the browser's `storage` event for that key, call `actions.signOut('LOCK')` in the other tabs |
| b | W77, W81 (row 22) | Do not let the query client repeat a call that was answered 401 or 403: every 403 through `live.client` starts the debounced permission refresh, and every refusal is audited by the Core |
| c | W55 (row 16) | A sign-in can wait up to 16 s for a debt that is being settled before its own request goes out; the pending state of the Login page must bear it |
| d | W50, W54 (row 7) | Until CPC1-35 is fixed: the two-tab lane check does not include "another operator signs in while one tab is offline" |

---

## T6. Verdict and what is open (question 6)

**PASS WITH FIXES (Low only).** W50 and W51 proceed; the two-tab lane checks may run, with note d.

| # | Item | Owner | Before |
|--:|---|---|---|
| 1 | CPC1-34 the port's comment and type | W44 | W50 writes its storage port |
| 2 | CPC1-35 a session check at an OPERATOR `hello` of a reconnect | W44 | The two-tab lane check with a change of operator |
| 3 | CPC1-33, CPC1-36 | W44 | W92 |
| 4 | CPC1-28 the name `DEFAULT_TIMERS` | The owner of `src/realtime` | W92 (D90 says the contract close-out) |
| 5 | CONTRACT-GAP-3, CONTRACT-GAP-4; CPC1-37 optional | W83 | W83 |
| 6 | CPC1-19 at W51; CPC1-22 at W76; the wider static test of AC-C-53 and "no `createCoreClient` outside the runtime" at W55 | The client rows | As named |
| 7 | API-7 on every 2xx POST; whether a refused POST moves the Core's idle expiry; whether `getAuthSession` answers 401 at once after an expiry, and the order of `session.ended` and that 401 | W58 | W58 |
| 8 | CPC1-38 the residuals; the simulator diff for W97 | Controller | The final report; W97 |

Not reviewed in this pass: the tests named "by name" in T1; `live-source-session.test.ts` and
`live-source-platform-neutral.test.ts` beyond the lines cited; the round's scripts
(`44_round2_red_green.py`, the mutation script: their logs only, which say 37 red then 332 green,
and 46 of 46); behaviour against a real Core server or a browser.

---
*Third pass appended: 2026-10-04 16:06 WIB*
