---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 66
plan_row: W44 (wave B6; no lock)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete (first delivery: gate passed, decision D75; fix round after checkpoint CP-C1, decision D80: gate passed, decision D84; follow-up of D84 done; second fix round after the re-review, decision D90: the seven findings that ask for code are fixed with red-before / green-after tests, the three that ask for notes are answered; third round, decision D100: CPC1-33, CPC1-34 and CPC1-35 fixed with red-before / green-after tests, CPC1-36 capped, two contract gaps worded; see sections 14 to 18. The briefs of W50, W51 and the page rows read section 17.4)
---

# 44 Live source HB-14 (blueprint step 66, plan row W44)

> **Amended by section 14: the fix round after checkpoint CP-C1 (decision D80).** Sections 1 to 13
> are the record of the first delivery (gate passed, decision D75). Where they and section 14
> differ, section 14 stands; section 14.8 lists each earlier statement that no longer holds, and
> section 14.3 every change of the public API. The briefs of W50 and W51 read section 15.
>
> **And by section 16: the follow-up after the fix round (decision D84).** It closes F66-12, F66-14
> and the gap-ID collision, answers F66-18 (one defect found and fixed), and holds the FINAL list
> of public API changes (16.5) and the notes for the briefs of W50, W51 and the administration
> page rows (16.6). Where section 14 or 15 and section 16 differ, section 16 stands.
>
> **And by section 17: the second fix round after the re-review (decision D90).** It fixes CPC1-23
> to CPC1-26, CPC1-31 and CPC1-32, adds the optional storage of the debt (`owedSignOut`), withdraws
> `CONTRACT-GAP-7`, and holds the FINAL public API list (17.3) and the ONE list of notes the
> runtime rows are briefed from (17.4), which replaces sections 15 and 16.6. Where an earlier
> section and section 17 differ, section 17 stands; section 17.8 lists the statements that changed.
>
> **And by section 18: the third round (decision D100).** It fixes CPC1-33, CPC1-34 and CPC1-35,
> caps CPC1-36, and words two contract gaps of this row's own series (`CONTRACT-GAP-W44-1`, `-2`;
> section 18.5). No exported name changed; section 18.3 lists the six changes of behaviour.
> **Section 17.4 was updated in place and is still the one list of brief notes** (rows 2, 7, 16,
> 22, 23 and 27 changed, rows 28 to 34 added; section 18.4). Where an earlier section and section
> 18 differ, section 18 stands; section 18.8 lists the statements that changed.

Row, verbatim: [W44] Live source HB-14: the replica store, delta application with structural
sharing, the 42 action bindings, own-command atomicity, error rebuilding, the `touchSession`
throttle; a 429 keeps its status and `retry-after` in `LiveTransportError`; `session.ended` with
`TOKEN_REUSE` is passed on to the clients. Writes: `packages/shared/src/live/source/**`,
`packages/shared/test/live-source-*.test.ts`. Locks: none. Implements AC-B-63 (spies); AC-C-02,
AC-C-06..08, AC-C-10..15, AC-C-39, AC-C-54. Rollback R-NEW.

**Result: the row is done and its gate is green.** `@dems/shared/live/source` exports
`createLiveSim`: a store of `SimState` shape that is filled from the Core server's snapshot and
deltas, the 42 actions of `SimActions` by name (each calls the operation the contract's table
names), and the session of the caller. It stands in the simulator's own `SimContext` through one
cast (`asSim`), so `useSim(selector)` and every selector work on it unchanged. Loading the module
starts nothing, and with a simulator in the context nothing reaches the network.

| Field | Value |
|---|---|
| New source | 13 files under `packages/shared/src/live/source/`, 3,402 lines (section 2). The placeholder `index.ts` of W03 is replaced |
| New tests | 7 files `packages/shared/test/live-source-*.test.ts`, 4,153 lines, **244 tests** (section 2) |
| Files outside the two write paths | **None changed.** The 57 test files that existed before the row have identical `git hash-object` values before and after; the digest of `packages/shared/src` without `live/source` is identical (`assets/44_pre_state.txt`, `44_post_state.txt`) |
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0: **1,650 passed in 64 files** (12:32 WIB). Before the first edit: 1,406 in 57 files (11:25). 1,406 + 244 = 1,650 |
| The baseline of `acaff20` | The 28 test files that exist at `acaff20` pass alone: 28 files, 517 tests, exit 0. They held 508 tests at `acaff20`; the 9 more were added by earlier rows by recorded decisions (section 9.3). This row edited none of them |
| `npm run typecheck -w @dems/shared`, `npm run lint -w @dems/shared` | exit 0, exit 0 (no warning) |
| `npm run typecheck -w @dems/core-web`, `-w @dems/mobile` | exit 0, exit 0 |
| The subpath under each client's compiler options | A web probe and a mobile probe that use the API as W50 and W51 will compile (exit 0); two wrong lines appended are refused (exit 2) (section 9.5) |
| Can the tests fail? | 60 single changes on an isolated copy: **60 detected** (final run). The first run, of 58, detected 56; the two survivors showed two weak tests, which were strengthened (section 9.6) |
| Gaps | `CONTRACT-GAP-3` and `SIM-GAP-2`, each with a local adapter inside the folder; no file of the contract or of the simulator was edited (section 10) |
| Processes | None started. No port, no emulator, no database, no network |

Evidence files, all under `implementation/assets/`: `44_baseline.log` (before the first edit),
`44_pre_state.txt` and `44_post_state.txt` (file hashes), `44_gate_final.log` (the final run),
`44_tests_verbose.log` (the 244 tests by name), `44_client_probe.log`, `44_probe_web.ts.txt`,
`44_probe_mobile.ts.txt` (the two probes), `44_mutate.py`, `44_mutations.log` (final run),
`44_mutations_run1.log` (first run, with the two survivors). The mutation copy and the probes are
under the git-ignored `.cache/w44/`.

Sources are cited as [SP:…] for `masterplan/01_specs.md`, [CS:…] for
`masterplan/04_client_integration_spec.md`, [L18], [L27], [L30], [L31] for the logs
`implementation/18_…`, `27_…`, `30_…`, `31_…`, and [DEC:Dn] for `decisions/decisions.md`.

---

## 1. What was done

| Step | What | Where |
|---|---|---|
| 1 | Inputs read: the row and P1-P25; [CS:§2, §3.5, §5, §6, §8.1, §9, §12, §13.1, §14, §17]; [SP:§7.2, §7.17, §9]; the logs 12, 18, 27, 30, 31 and the source they describe; decisions D11, D15, D43, D50, D51, D53, D59, D61, D64, D69 | — |
| 2 | Baseline before the first edit: 57 files / 1,406 tests, typecheck and lint exit 0 | `assets/44_baseline.log` |
| 3 | P23 pre-image: `git diff acaff20 -- packages/shared/src/live/source > .cache/rollback/W44.pre.patch` (0 bytes: the folder is untracked), and a copy of the placeholder | `.cache/rollback/W44.pre.patch`, `W44.source-index.ts.pre` |
| 4 | The module written: the replica and its structural sharing, the neutral state, the clock, the gate, the Live result, the bindings, the error rebuilding, the throttle, `createLiveSim` | `packages/shared/src/live/source/` |
| 5 | Tests: one engine driven through the recording scenario and replayed as snapshot plus deltas; atomicity in both orders; the 42 bindings against the registry; the error table; the session, the secrets port and pairing; React hooks under `SimProvider`; Simulated isolation with spies; a static scan | `packages/shared/test/live-source-*.test.ts` |
| 6 | Each client's compiler options: a probe file per client | `.cache/w44/probe-web`, `probe-mobile` |
| 7 | Mutation runs on a copy under `.cache/w44/mut/shared` (never on the tree) | `assets/44_mutations.log` |
| 8 | Gate on the finished tree | `assets/44_gate_final.log` |

Not written: anything under `src/sim`, `src/api`, `src/client`, `src/realtime`, the light files
`src/live/*.ts`, `src/live/testing`, i18n, any `package.json`, anything in `apps/`;
`status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`,
`masterplan/02_plan.md`, `implementation/99_implementation_report.md` (parallel run: P8).

---

## 2. Files

| File | Lines | Holds |
|---|--:|---|
| `src/live/source/index.ts` | 119 | The exports, and `asSim`: the one documented cast into `Sim` |
| `…/types.ts` | 252 | `LiveSim`, `CreateLiveSimOptions`, `LiveActions`, `LiveSecretsPort`, `LiveSessionEnd`, `LiveAuditChain`, `LiveStore`, `LiveClient` |
| `…/live-sim.ts` | 1,290 | `createLiveSim`: the store, the socket handlers, the session, the bootstrap, the action runners, the reports |
| `…/bindings.ts` | 521 | `LIVE_BINDINGS`: the 42 bindings as data; `operationOf`, `DEVICE_COMMAND_OPERATION_INDEX` |
| `…/command-gate.ts` | 256 | `createCommandGate`: own-command atomicity |
| `…/live-result.ts` | 169 | `createLiveResult`: the thenable a Live action returns |
| `…/replica.ts` | 117 | `foldStateMessages`, `replacementPatch`, `hasReached` |
| `…/structural-sharing.ts` | 90 | `shareStructure`, the default of CL-13 |
| `…/neutral-state.ts` | 248 | `createNeutralState` and the five client-built slices |
| `…/rebuild-error.ts` | 140 | `rebuildRefusal`, `transportErrorOf`, `ENVELOPE_SIM_CODE` |
| `…/touch-throttle.ts` | 123 | `createTouchThrottle` |
| `…/clock.ts` | 45 | `createLiveClock` |
| `…/constants.ts` | 32 | `LIVE_SETTLE_TIMEOUT_MS` 2,000; `LIVE_BOOT_TIMEOUT_MS` 4,000; `LIVE_TOUCH_INTERVAL_MS` 60,000; `LIVE_PERMISSION_REFRESH_MS` 1,000; `LIVE_SESSION_PROBE_RETRY_MS` 2,000; `LIVE_ERROR_LOG_SIZE` 50 |

| Test file | Tests | Proves |
|---|--:|---|
| `test/live-source-replica.test.ts` | 15 | AC-C-07, AC-C-08, CL-14, the neutral state |
| `test/live-source-atomicity.test.ts` | 35 | AC-C-10, AC-C-12, AC-C-14, AC-C-15, CL-18, CL-22, the gate and the Live result by themselves |
| `test/live-source-bindings.test.ts` | 98 | The 42 bindings against `SIM_ACTION_OPERATIONS` and the registry; AC-C-11; CL-19; the 429 |
| `test/live-source-session.test.ts` | 71 | The bootstrap, sign-in, sign-out, every `session.ended` reason, AC-C-13, AC-C-39, AC-C-54, the secrets port, pairing, the clock, the meters |
| `test/live-source-react.test.ts` | 6 | ADQ-2: the simulator's hooks and the light API's hooks on a Live source |
| `test/live-source-simulated-isolation.test.ts` | 4 | AC-B-63, AC-C-06 (spies) |
| `test/live-source-platform-neutral.test.ts` | 15 | AC-C-02, D69 (no request function), the export subpath |

What the module imports at run time (the static test holds it): `zustand/vanilla`,
`zustand/middleware`; `../../realtime/live-socket-client` and `heartbeat-client` by file (never
the barrel that holds the React context); the contract (`../../api/*`); of the simulator only
`constants`, `errors`, `events` (`pushRing`), `vocabulary` and types; the light API's `errors` and
`mode`. The typed client is imported **as a type only**. No React file, no simulator engine, no
demo dataset, no test double.

---

## 3. Public API of `@dems/shared/live/source`

Loaded by a client only through a dynamic import behind its build gate (MD-2, MD-6):

```ts
const { createLiveSim, asSim } = await import('@dems/shared/live/source');
```

### 3.1 Create

```ts
function createLiveSim<Client extends LiveClient>(options: CreateLiveSimOptions<Client>): LiveSim<Client>;

interface CreateLiveSimOptions<Client> {
  client: Client;                       // createCoreClient({ baseUrl, credentials }): EVERY request goes through it (D69)
  socket: {
    url: string;                        // the socket address of the Core server, path /ws
    factory?: LiveSocketFactory;        // default: the platform's socket constructor (in live-socket-client.ts)
    headers?: LiveSocketHeadersProvider;// mobile: () => ({ Authorization: 'Bearer …' }); the web leaves it out
    create?: (options: LiveSocketClientOptions) => LiveSocketClient;   // default createLiveSocketClient
  };
  secrets?: LiveSecretsPort;            // mobile only: the app's storage of secrets (section 3.5)
  device?: () => { deviceName: string; platform: string; appVersion: string };   // mobile only: the redeem request (MP-5)
  visibility?: VisibilityAdapter;       // the simulator's adapter type; meters are subscribed only while visible (CL-11b)
  structuralSharing?: StructuralSharing;// default shareStructure; replaceEqualDeep of the query library fits (CA-04)
  onError?: (report: SimErrorReport) => void;   // the app writes it to its persistent log
  now?: () => number;                   // default Date.now
  timers?: LiveSocketTimers;            // default: the global timer functions
  random?: () => number;                // jitter of the reconnect delay
  autoStart?: boolean;                  // default true (section 3.2)
  settleTimeoutMs?: number; bootTimeoutMs?: number; touchIntervalMs?: number;   // defaults: the constants
}
```

`LiveClient` is `{ call: (...input: never[]) => Promise<unknown> }`: both forms of the typed
client fit (the literal table and `operations: CORE_API_OPERATIONS`), and `live.client` keeps the
caller's own type, so a portal page calls `live.client.call('listUsers')` type-checked.

### 3.2 Start, stop, ready

| Member | Behaviour |
|---|---|
| `createLiveSim(options)` | Builds everything. With `autoStart` true (the default) it also starts: the bootstrap of [CS:§5.1] begins at creation, so `await live.ready` works before any provider is mounted, as [CS:§5.1 step 5] writes it. With `autoStart: false` nothing is sent and no socket is opened until `start()` |
| `start()` | Opens the socket, asks `getAuthSession`, starts the clock timer and the boot timer. Idempotent |
| `stop()`, `destroy()` | Closes the socket (1000), clears every timer, resolves `ready` if it is still pending. The store keeps what it holds. Idempotent. After `stop()` no timer is left (tested for an idle source here; since the fix round also with a command in flight, and every action that is out is settled inside the call: section 14.1, CPC1-7) |
| `ready`, `isReady()` | Resolves when the bootstrap is over: the probe answered and, when a session is known, the first snapshot is applied; at once when the probe got no answer or answered 401; at the latest after `LIVE_BOOT_TIMEOUT_MS`. Never rejects |
| `isRunning()` | Between `start()` and `stop()` |
| `tick()`, `flush()` | No-ops. `wasRestored()` is false. `rng` is inert; `seed` is `meta.seed` of the replica |
| `request()` | Answers 501 `SIMULATOR_ERROR`, without the `x-dems-simulated` header ([SP:API-10]) |
| `errors()` | The last 50 reports |

`SimProvider sim={asSim(live)} autoStart` works as with a simulator: its `start()` finds the source
started, its unmount stops it (tested in `live-source-react.test.ts`).

### 3.3 The `Sim` members and the Live handle (CL-15)

```ts
interface LiveSim<Client> extends LiveHandle {
  readonly coreMode: 'LIVE';                       // the light API's marker
  readonly store: LiveStore;                       // zustand vanilla + subscribeWithSelector; no `persist`
  readonly actions: LiveActions;                   // the 42 names; each returns a Live result (assignable to CoreActions)
  readonly clock: SimClock;                        // the server's clock; never moves backwards
  readonly link: LiveLinkState;                    // CONNECTING | ONLINE | STALE | OFFLINE | RESYNCING, the socket's
  readonly session: AuthSessionInfo | null;        // replaced on every change, never edited in place
  readonly lastSessionEnd: LiveSessionEnd | null;  // why the last session or pairing ended; in memory only
  readonly auditChain: LiveAuditChain | null;      // `stored`, `lineage`, `lineageTotal` of the last verifyAuditChain
  readonly client: Client;
  readonly heartbeat: HeartbeatClient;             // the one socket's heartbeat view, for HeartbeatContext; its start/stop do nothing
  onLiveChange(listener: () => void): () => void;  // link, session or auditChain changed (the light hooks subscribe here)
  onControl(listener: (message: LiveSocketControlMessage) => void): () => void;   // the four control messages
  onSessionEnd(listener: (end: LiveSessionEnd) => void): () => void;              // once per end, after the store dropped the Core data
  onResync(listener: (event: LiveSocketResyncEvent) => void): () => void;         // RESYNCING / RESYNCED
  reconnect(reason: LiveSocketReconnectReason): boolean;   // "Retry now"; after the app replaced a stored credential
  socketStatus(): LiveSocketStatus;                // for a diagnostics view (the API Reference realtime panel)
  setPairing(pairing: { core: CoreIdentity; pairedAt: number } | null): void;     // the client-built `pairing` slice (MP-10)
  // plus: rng, seed, ready, isReady, wasRestored, start, stop, isRunning, tick, flush, destroy, errors, request
}

function asSim(live: LiveSim): Sim;   // the one documented cast (ADQ-2)
```

The source has **30 members and none of them returns a credential or a token** (MP-3; the member
list is pinned by a test).

```ts
interface LiveSessionEnd {
  kind: 'SESSION_ENDED' | 'DEVICE_REVOKED';
  reason: SessionEndedReason | DeviceRevokedReason | null;   // TOKEN_REUSE, IDLE_EXPIRED, … REVOKED, UNPAIRED; null: the server gave none
  source: 'CONTROL' | 'CLOSE' | 'HELLO' | 'REST' | 'SIGN_OUT' | 'UNPAIR';
  signOut: 'USER' | 'LOCK' | null;     // the reason this client sent with its own sign-out
  wasSignedIn: boolean;                // false: only the credential of the socket was refused
  sessionState: SessionState | null;   // "The recording continues on the Core"
  helloReason: RealtimeHelloReason | null; principal: RealtimePrincipal | null; at: number;
}
```

### 3.4 What the web runtime (W50) does

```ts
const client = createCoreClient({ baseUrl: pageOrigin, credentials: 'browser-cookie' });
const live = createLiveSim({ client, socket: { url: coreWsUrl() }, structuralSharing: replaceEqualDeep, onError: logSystemError, visibility });
await live.ready;                                   // signed in (auth SIGNED_IN, replica filled) or signed out
createAppRouter({ sim: asSim(live), queryClient, coreMode });
// __root.tsx: <HeartbeatContext.Provider value={live.heartbeat}> and <SimProvider sim={asSim(live)} autoStart>
live.onSessionEnd((end) => { queryClient.removeQueries({ queryKey: ['core'] }); /* PG-6a, the notice of §6.5 */ });
live.onControl((message) => { /* session.updated: toast and router.invalidate(); admin.changed: refetch */ });
```

The compiled probe is `assets/44_probe_web.ts.txt`.

### 3.5 What the mobile runtime (W51, W56, W57) does: the secrets port

The Live source **keeps no secret**. The credential providers of the typed client and of the
socket belong to the app; the source hands a value to the app in the turn the server returned it.

```ts
interface LiveSecretsPort {            // every member may return a promise; the source waits for it
  sessionIssued?(issued: { sessionToken: string; biometricToken: string | null; operatorId: string }): void | Promise<void>;
  sessionCleared?(end: LiveSessionEnd): void | Promise<void>;
  biometricToken?(operatorId: string): string | null | Promise<string | null>;
  devicePaired?(redeemed: PairingRedeemed): void | Promise<void>;
  deviceUnpaired?(end: LiveSessionEnd): void | Promise<void>;
}
```

| Event | Order |
|---|---|
| `signIn` answered 200 with `sessionToken` | `sessionIssued` (awaited) → the socket is reopened (its header provider already returns the session token) → the snapshot → the action settles |
| `signInWithBiometric(operatorId)` | `biometricToken(operatorId)` → operation 8 with `{ token }` → `sessionIssued` with the rotated `biometricToken` → as above. No stored token: the action rejects `CoreRefusalError('NOT_AVAILABLE')` and nothing is sent |
| A session ends | The store is cleared and the listeners are told → `sessionCleared` (awaited) → the socket is reopened with the device credential |
| `pair(code)` answered 201 | `devicePaired` (awaited, BEFORE the action settles, MP-6) → the `pairing` slice is PAIRED → the socket is reopened with the device credential → the action settles. If `devicePaired` rejects, the action rejects with the same error and the slice stays UNPAIRED |
| `unpair()` answered 204, `device.revoked`, close 4403, 403 `DEVICE_REVOKED` | `auth` SIGNED_OUT and `pairing` neutral → `deviceUnpaired` (awaited) → the socket is reopened without a credential |
| Close 4401 with nobody signed in (the credential is unknown to the Core, MP-10) | Reported once through `onSessionEnd` (`wasSignedIn: false`, `helloReason: SESSION_INVALID`). **Not retried by itself.** The app deletes the credential and calls `live.reconnect('CREDENTIAL')` |

The compiled probe is `assets/44_probe_mobile.ts.txt`. A sign-in that returns a session token
while no `sessionIssued` is injected rejects with `CoreRefusalError('NOT_AVAILABLE')`: the token
could not be kept.

---

## 4. The replica: the 33 slices

| Slices | Count | Filled from | While signed out, and after a session ended |
|---|--:|---|---|
| `meta`, `device`, `operators`, `tabletLink`, `session`, `lastSealedSessionId`, `lastSealedAcknowledged`, `sessionHistory`, `activeCameraId`, `cameras`, `mics`, `storage`, `storagePolicy`, `time`, `network`, `security`, `services`, `health`, `otherDevices`, `ports`, `evidence`, `events`, `alerts`, `audit`, `faults`, `diagnostics`, `update`, `settings` | 28 | `snapshot`, then `delta` (`REPLICATED_SLICE_NAMES` of the contract: the module reads the list, it does not retype it) | The neutral value: empty lists, no session, an empty device identity |
| `audio` | 1 | `meters` frames, at once (never held). On link STALE or OFFLINE, and on a session end: a flat "no signal" frame on both channels | No signal |
| `clock` | 1 | The Live clock, published in 100 ms steps (`CLOCK_TICK_MS`) | Runs |
| `auth` | 1 | `AuthSessionInfo` (`status`, `operatorId`, `method`, `issuedAt`, `lastActivityAt`); section 6 | SIGNED_OUT, or EXPIRED after an expiry |
| `authLockout` | 1 | `SignInStatus` (`getSignInStatus` at start and after a session end; a sign-in refusal; `reportBiometricFailure`): `lockedUntil` copied, `failures` holds `AUTH_MAX_FAILURES - attemptsRemaining` entries stamped with `serverTime` | As answered |
| `pairing` | 1 | `PairingRedeemed` (`pair`), `setPairing(…)` from `DeviceRegistration`, a redeem refusal (FAILED). The web console keeps the neutral value | Kept across a session end; neutral after the pairing ended |

The neutral state is built in `neutral-state.ts` from the simulator's constants and types and
nothing of the demo dataset. It is not a valid `ReplicatedState` of the contract (an empty device
ID is refused there) and is never sent anywhere.

---

## 5. Delta application, and what keeps its identity

`foldStateMessages(state, messages, share)` applies a list of state messages in order and returns
**one patch**: the replicated slices that differ from the state, and nothing else. The source
commits it with one `store.setState(patch)`; an empty patch touches nothing.

| Message | What it changes | What keeps its reference |
|---|---|---|
| `snapshot` | Every replicated slice, through `share(current, incoming)` | A slice deeply equal to the current one. A snapshot equal to the state leaves the state object itself unchanged and tells no subscriber |
| `delta`, `replace` | The named slice, through `share` | Every slice no op names. Inside the slice: every member and every array element that is deeply equal |
| `delta`, `append` on `audit` | `rows` = `pushRing(rows, op.rows, AUDIT_RING_SIZE)` (the simulator's own function and size); `head`, `total`, `dropped` from the message | Every row already held |
| `delta`, `append` on `events` | `pushRing(events, op.rows, EVENT_RING_SIZE)` | Every event already held |
| Several messages in one fold | Applied in order; ops of one delta in their order | A slice that ends where it started is not in the patch |

`shareStructure(previous, next)` (the default of CL-13): the previous value when the two are
deeply equal; else a new object or array whose equal parts are the previous references. An array
element is matched at its own index first, and, for elements with a string `id`, by that `id`: a
ring that moved by one row keeps its rows. The function is injectable (CA-04).

---

## 6. The atomicity gate (CL-16 to CL-18)

`createCommandGate` stands between the socket's state messages and the store. A command of this
client is "in flight" from the call of the action until it settles.

| State | Event | What happens |
|---|---|---|
| Nothing in flight, nothing held back | A state message | Applied at once (one store update) |
| A command in flight | A state message (delta **or snapshot**) | Held, in order |
| A command in flight | Its answer names revision N; the held messages reach N (**delta first**) | The held messages up to N are applied in ONE store update, then the action is settled, in the same synchronous turn |
| A command in flight | Its answer names revision N; N is not reached (**answer first**) | The command keeps waiting; a timer of `LIVE_SETTLE_TIMEOUT_MS` starts |
| A command waits for N | The delta of N arrives | One store update, then the action is settled, **inside the socket's message callback** |
| A command settles and no other is in flight | — | Everything held goes into that same update |
| A command settles and another is in flight | — | Only the messages up to N; the rest stays held |
| A command waits for N | The time-out passes (CL-17) | `requestResync()` (the socket sends ONE `resync`, the link reads RESYNCING), everything held is applied, the action **resolves** with the server's answer |
| A command in flight | A refusal, no answer, or no replicated state on this client | What may be applied is applied; the action is settled |
| A command in flight | Its answer names another epoch (CL-18) | It waits for the snapshot of that epoch: a position is reached at a later epoch, or at the same epoch at or beyond the revision |
| A sign-in in flight | The answer arrived | The socket is reopened; the target is the first snapshot of a connection with a higher number; time-out `LIVE_BOOT_TIMEOUT_MS`, then the action rejects `CORE_OFFLINE` (`code: SNAPSHOT_TIMEOUT`) |
| The session of the socket is being asked for (`hold`) | A state message | Held until the answer, so no Core data is shown before `auth` says who is signed in |
| Any | The session ended (`reset`) | Everything held is dropped, the position is forgotten, every waiting command is settled (it resolves: the server had accepted it) |

A Live action returns a **Live result** (`live-result.ts`): the members of a promise, whose `then`
callbacks run inside the settlement. So `settle(run, handlers)` runs `ok` in the turn of the store
update, `await` works (CL-26), a result that is already settled calls back inside `then` (a
locally refused action behaves as a simulator action that throws), and a callback that throws is
contained and reported (F40-3 c). Meter frames never pass the gate.

---

## 7. The 42 bindings

Operation numbers are those of [SP:§7.17]. The operation IDs are read from
`SIM_ACTION_OPERATIONS`; a test plans every action and checks the request against the registry.
"→" is what the action resolves with; where nothing is said it resolves with `undefined`.
A void action that is refused rejects with the error of section 8.

| # | Action | Flow | Operation | Request | Resolves with; local answers |
|--:|---|---|---|---|---|
| 1 | `signIn(username, password)` | sign-in | 2 `signIn` | body `{ username, password }` | → `{ ok: true, operatorId, role, method }` after the snapshot. 401 `INVALID_CREDENTIALS` → `{ ok: false, reason, attemptsRemaining }`; 423 → `{ ok: false, reason: 'LOCKED', lockedUntil, retryInMs }` |
| 2 | `signInWithBiometric(operatorId)` | sign-in | 8 `signInWithBiometric` | body `{ token }` from `secrets.biometricToken` | As 1. No token: rejects `NOT_AVAILABLE`, nothing sent |
| 3 | `recordBiometricFailure(operatorId)` | command | 9 `reportBiometricFailure` | body `{ operatorId }` | → the `SignInStatus` as the failed-attempt union; the lockout view follows |
| 4 | `signInWithSecurityKey()` | local | — (X-1) | — | Rejects `CoreRefusalError('NOT_AVAILABLE')` |
| 5 | `signOut(reason?)` | sign-out | 5 `signOut` | body `{ reason }` (USER when omitted) | Ends the session. Signed out already: no request (EXPIRED becomes SIGNED_OUT). A 401 resolves |
| 6 | `touch()` | touch | 6 `touchSession` | none | Resolves at once; throttled (CL-27): at most one request per 60 s, plus one at the end of the period when there was activity |
| 7 | `createSession(input)` | command | 24 `createSession` | body `input` (the device's room when `room` is undefined, as the simulator) | → `{ ok: true, sessionId, created }`. 401, 403 `NOT_PERMITTED`, 409 `SESSION_ACTIVE`, 422 → the union's reasons |
| 8 | `beginPrecheck()` | command | 28 `beginPrecheck` | `{id}` = the replica's session | No open session: rejects `SimTransitionError(null, action)` |
| 9 | `acknowledgePrecheckWarnings()` | command | 30 | `{id}` | As 8 |
| 10 | `retryPrecheck()` | command | 29 | `{id}` | As 8 |
| 11 | `startRecording()` | command | 25 `startSession` | `{id}` | Only from ARMED; else rejects `SimTransitionError(state, 'startRecording')` locally |
| 12 | `stopRecording(reason)` | command | 26 `stopSession` | `{id}`, body `{ reason }` | As 8. A 422 is `REASON_TOO_SHORT` |
| 13 | `cancel()` | command | 31 `cancelSession` | `{id}` | As 8 |
| 14 | `scanCaseNumber()` | command | 32 | none | → `caseNumber` |
| 15 | `recover()` | command | 33 `recoverSession` | `{id}` | As 8 |
| 16 | `addMarker(label?)` | command | 34 `addSessionMarker` | `{id}`, body `{ label }` when given | As 8 |
| 17 | `addNote(text)` | command | 35 `addSessionNote` | `{id}`, body `{ text }` | As 8. A 422 is `NOTE_INVALID` |
| 18 | `snapshot()` | command | 36 `takeSessionSnapshot` | `{id}` | As 8 |
| 19 | `acknowledgeSummary(sessionId)` | command | 37 | `{id}` = `sessionId` | |
| 20 | `verify(evidenceId)` | command | 41 `verifyEvidence` | `{id}` | → `EvidenceVerifyResult`. No demo control is called first |
| 21 | `exportEvidence(evidenceId, request)` | command | 42 `exportEvidence` | `{id}`, body `{ reason, destination? }` | → `{ ok: true, status: 202, exportId }`. 401 → `NOT_SIGNED_IN`, any 403 → `FORBIDDEN`, 404 → `NOT_FOUND`, 409 → `NOT_SEALED` or `SECURITY_FAULT`, 422 → `INVALID_REASON` |
| 22 | `archiveEvidence(evidenceId)` | command | 43 | `{id}` | |
| 23 | `exportAudit(request?)` | command | 61 `exportAudit` | body `{ reason, destination? }` | As 21 |
| 24 | `exportLogs(request?)` | command | 62 `exportLogs` | body `{ reason, destination? }` | As 21 |
| 25 | `verifyAuditChain()` | read | 60 (GET) | none | → `view`; `stored`, `lineage`, `lineageTotal` are kept in `live.auditChain` |
| 26 | `inject(kind, target?)` | command | 73 `injectFault` | body `{ kind, target? }` | 403 `DEMO_DISABLED` → `CoreRefusalError` |
| 27 | `clearFault(kind, target?)` | command | 74 `clearFault` | body `{ kind, target? }` | |
| 28 | `resetClip(channel)` | command | 52 `resetMicClip` | body `{ channel }` | |
| 29 | `acknowledgeAlert(alertId)` | command | 70 | `{id}` | |
| 30 | `loadScenario(name)` | command | 72 | body `{ name }` | Settles with the snapshot of the answered epoch (CL-18) |
| 31 | `resetDemo()` | command | 75 | none | As 30 |
| 32 | `runDiagnostics()` | command | 65 | none | → `runId` |
| 33 | `deviceCommand(deviceId, command)` | command | 48 `restartDevice`, 49 `testDeviceSignal`, 50 `identifyDevice` | `{id}` = `deviceId` | By `command`: RESTART, TEST_SIGNAL, IDENTIFY. Another value: rejects `COMMAND_UNSUPPORTED` locally |
| 34 | `setStoragePolicy(policy)` | command | 55 | body `policy` | A 422 is `POLICY_RANGE` |
| 35 | `startSoftwareUpdate()` | command | 67 | none | |
| 36 | `restartServices()` | command | 66 | none | → `restarted` |
| 37 | `setActiveCamera(cameraId)` | command | 51 | body `{ cameraId }` | Already the active camera: resolves, nothing sent |
| 38 | `setPresentationMode(enabled)` | command | 68 `updateSettings` | body `{ presentationMode }` | |
| 39 | `updateSettings(patch)` | command | 68 `updateSettings` | body `patch` | |
| 40 | `pair(code)` | pair | 18 `redeemPairingCode` | body `{ code, deviceName, platform, appVersion }` from `options.device()` | → `{ ok: true, pairedAt }`. 401 `INVALID_CODE` and 423 → the union. Paired already: resolves with the pairing. No port (the web): rejects `NOT_AVAILABLE`, nothing sent |
| 41 | `unpair()` | unpair | 22 `unpairDevice` | none | Not paired: resolves, nothing sent |
| 42 | `setTabletLink(state)` | local | — (X-2) | — | Resolves, nothing sent |

Flows: 33 `command`, 1 `read`, 2 `sign-in`, 1 `sign-out`, 1 `touch`, 1 `pair`, 1 `unpair`, 2
`local`. 40 bindings reach the 41 operations of the table. The two reads of the bootstrap
(`getAuthSession`, `getSignInStatus`) stand for no action.

**The input travels as the caller gave it**: nothing is trimmed, cut or validated in a binding.
The Core server is the judge, in its own order (identity and permission first, with the audit row
of a denial; then the body).

Rules every flow shares: while `link` is not ONLINE the request is not sent and the action rejects
`LiveTransportError('CORE_OFFLINE')` with no status and no code (CL-22); every rejection is
reported once through `onError` (CL-24); a 2xx of a POST restarts the touch period (CL-27).

---

## 8. Error mapping (CL-19 to CL-21)

`rebuildRefusal(failure, context)`; the first matching row decides.

| # | Failure of the typed client | Error | Members |
|--:|---|---|---|
| 1 | `failure.transport` is set: no answer (`NETWORK`), time-out (`TIMEOUT`), 503, a gateway answer without an envelope → `CORE_OFFLINE`; 429, any other 5xx, an answer outside the contract → `UNAVAILABLE` | `LiveTransportError` | `reason`, `status`, `code`, **`retryAfterSeconds`**, `requestId` as the client gave them. Never rebuilt into a simulator class; a result-union action rejects with it too |
| 2 | 401 `NOT_SIGNED_IN` | `SimPermissionError` | `code: NOT_SIGNED_IN`; `permission` = `details.permission`, else the operation's access rule (`A \| B` for the any-of) |
| 3 | 403 `NOT_PERMITTED` or `FORBIDDEN` | `SimPermissionError` | `code: NOT_PERMITTED`; `permission` as row 2 |
| 4 | 404, and the request named an entity | `SimNotFoundError` | `entity` (`session`, `evidence`, `device`, `alert`) and `entityId` as the binding sent them |
| 5 | 409 or 422 that stands for a simulator code | `SimTransitionError` | `code` = `details.simCode` when it is a `SimErrorCode`; else, for a 422, the action's own code (`stopRecording` → `REASON_TOO_SHORT`, `addNote` → `NOTE_INVALID`, `setStoragePolicy` → `POLICY_RANGE`); else the envelope code read backwards. `from` = `details.from` when the envelope has that member (null stays null), else the replica's session state. `event` = `details.event`, else the action's name |
| 6 | Any other refusal | `CoreRefusalError` | `code` (`DEMO_DISABLED`, `LAST_ADMIN`, `DEVICE_NOT_PAIRED`, `DEVICE_REVOKED`, `ORIGIN_NOT_ALLOWED`, `LOCKED`, `INVALID_CODE`, `INVALID_JSON`, …), `status`, `requestId` |

Envelope codes read backwards ([SP:§7.2]): `INVALID_STATE` → `ILLEGAL_STATE`; `PRECHECK_RUNNING`
→ `CHECKS_RUNNING`; `PRECHECK_WARNINGS`, `PRECHECK_BLOCKED` → `ILLEGAL_STATE`; `NOT_SEALED` →
`UNSEALED_EVIDENCE`; `INVALID_REASON` → `REASON_TOO_SHORT`; `SESSION_ACTIVE`, `RECORDING_ACTIVE`,
`COMMAND_UNSUPPORTED`, `INVALID_INPUT` → the same name.

Side effects of an answer, whatever action asked (CL-23): 401 `NOT_SIGNED_IN` while signed in ends
the session (`source: REST`); 403 `DEVICE_REVOKED` ends the pairing; 403 `NOT_PERMITTED` or
`FORBIDDEN` refreshes the permission hint once (one `getAuthSession` 1,000 ms after the first
refusal; refusals inside that second share it).

No error carries the server's `message` or a value of `details`, and no report carries an argument
of an action (both tested).

---

## 9. Verification

All commands from `/Users/gsp-budi/Documents/DEMS`, with no `cd` (P10). No port was bound, no
process was started, no real time was waited for (the fake clock owns every timer; the one test
that uses the runtime's timers is the control of the isolation test).

### 9.1 Baseline, before the first edit (`assets/44_baseline.log`)

```
## 2026-10-04 11:25:24 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  57 passed (57)
      Tests  1406 passed (1406)
exit=0
## 11:25:30 $ npm run typecheck -w @dems/shared      exit=0
## 11:25:33 $ npm run lint -w @dems/shared           exit=0
```

### 9.2 Final gate on the finished tree (`assets/44_gate_final.log`)

The runner's summary lines as printed; the four static commands are shown on one line each (their
full output, two lines of npm banner and the exit code, is in the asset).

```
# Step 66 (W44): final gate, from /Users/gsp-budi/Documents/DEMS (no cd; every command as written)
## 2026-10-04 12:32:01 WIB $ npm run test -w @dems/shared -- --maxWorkers=2

 Test Files  64 passed (64)
      Tests  1650 passed (1650)
   Start at  12:32:01
   Duration  5.36s (tests 51%, import 37%, transform 11%, worker 1%)
exit=0

## 12:32:06 the 28 test files that exist at acaff20 (git ls-tree -r acaff20 --name-only packages/shared/test), alone
 Test Files  28 passed (28)
      Tests  517 passed (517)
exit=0

## 12:32:09 the seven new files, alone
 Test Files  7 passed (7)
      Tests  244 passed (244)
exit=0

## 12:32:10 $ npm run typecheck -w @dems/shared       > tsc --noEmit    exit=0
## 12:32:13 $ npm run lint -w @dems/shared            > oxlint          exit=0
## 12:32:13 $ npm run typecheck -w @dems/core-web     > tsc -b          exit=0
## 12:32:23 $ npm run typecheck -w @dems/mobile       > tsc --noEmit    exit=0
```

This gate was run twice on purpose, and both runs were green: at 12:22 (1,647 tests) and, after
three tests and one line of the source were added (section 9.6, last paragraph), at 12:32. The
asset holds the second run in full and, appended, a third run of 12:36 after the mutation run
(64 files, 1,650 passed, exit 0; typecheck of shared, core-web and mobile and lint exit 0). No run
failed, so no repeat for noise is recorded (P11). No source file and no test file was edited after
12:31:41. Every run in this sandbox also prints the host's keychain line `ERROR: failed to copy
trust settings of system certificate-25291` (log 01, line 162); it is not a test result.

### 9.3 Simulated mode is untouched (rule 3 of the brief; AC-B-63)

**How the 508 were identified.** `git ls-tree -r acaff20 --name-only packages/shared/test` lists
28 test files; they held 508 tests at `acaff20` (P24 ledger). Today those 28 files hold 517:
five of them were changed by earlier rows by recorded decisions (`git diff --stat acaff20`:
`auth.test.ts` +48, `i18n-vocabulary-sync.test.ts` +42, `openapi.test.ts` +72 −9,
`schemas.test.ts` +28, `sim-api-validation.test.ts` +26 −1). They pass alone: 28 files, 517 tests.

**This row edited none of them, and nothing else outside its two paths**
(`assets/44_post_state.txt`):

```
57 test files that existed before this row: identical git hash-object values before and after
packages/shared/src outside live/source: digest before and after:
85ee021ba5d9b442e1c7e1ea73971bdb58c303e9b4e69f3ea6ab7c7b11a81105  -
85ee021ba5d9b442e1c7e1ea73971bdb58c303e9b4e69f3ea6ab7c7b11a81105  -
```

**The spies** (`live-source-simulated-isolation.test.ts`; `fetch`, `WebSocket`, `XMLHttpRequest`
and `EventSource` are replaced by counting stand-ins):

| Statement | Test |
|---|---|
| Loading `@dems/shared/live/source` calls no request function, constructs no socket and starts no timer | "loading the Live source starts nothing: no request, no socket, no timer" |
| With the module loaded, a simulator driven through the recording scenario (21 actions through `coreActionsOf` and `settle`, 20.5 s of engine time, the simulated REST surface, `start` and `stop`): **0 `fetch` calls, 0 socket constructions**; `coreActionsOf(sim)` is `sim.actions` itself; the mode is SIMULATED; every continuation ran before `settle` returned | "over the recording scenario the spies count zero fetch calls and zero socket constructions; the actions are the simulator's own" |
| Control: the spies can count. A Live source that is given no transport constructs 1 socket and makes 1 `fetch` call (`/api/v1/auth/session`) | "control: a Live source that is given no transport DOES reach the spies…" |
| Control: a Live source on injected transports reaches neither | "control: a Live source on injected transports never touches what the runtime holds" |

No file of `apps/` imports `@dems/shared/live/source` yet (`grep -rl 'live/source' apps/*/src`:
0 files), so no client suite can load it; the two client typechecks exit 0.

### 9.4 Test ledger (P24)

| Workspace | Before (11:25) | After (12:22) | New test files of this row |
|---|---|---|---|
| `@dems/shared` | 57 files / 1,406 tests, failed 0 | **64 files / 1,650 tests, failed 0** | `live-source-replica.test.ts` (15), `live-source-atomicity.test.ts` (35), `live-source-bindings.test.ts` (98), `live-source-session.test.ts` (71), `live-source-react.test.ts` (6), `live-source-simulated-isolation.test.ts` (4), `live-source-platform-neutral.test.ts` (15): **244** |
| `@dems/core-web`, `@dems/mobile`, `@dems/core-server`, `@dems/mock-core` | not run | not run | None. No file of those workspaces was written and none imports the new module; their typechecks (web, mobile) exit 0 |

Expected total = 1,406 + 244 = 1,650 = the runner's total. No existing test changed.

### 9.5 The subpath under each client's compiler options (`assets/44_client_probe.log`)

```
## web (tsconfig extends apps/core-web/tsconfig.app.json; include: the probe only)
$ npx tsc -p .cache/w44/probe-web/tsconfig.json --noEmit --listFiles | grep -E 'error TS|packages/shared/src/live/source|probe.ts'
packages/shared/src/live/source/neutral-state.ts … live-sim.ts, index.ts   (the 13 files)
.cache/w44/probe-web/probe.ts
exit=0
## mobile (tsconfig extends apps/mobile/tsconfig.json; include: the probe only)
(the same 13 files) .cache/w44/probe-mobile/probe.ts
exit=0
## web: negative control (two wrong lines appended to the probe)
probe.ts(30,128): error TS2353: Object literal may only specify known properties, and 'address' does not exist in type …
probe.ts(31,14): error TS2322: Type '{ operator: … }' is not assignable to type 'string'.
exit=2
## mobile: negative control          (the same two errors)  exit=2
```

The web options include `noUnusedLocals` and `noUnusedParameters`: the 13 files compile under
them. The web probe passes the literal-typed client and calls `live.client.call('listUsers')`.

### 9.6 The tests can fail (`assets/44_mutations.log`, `44_mutate.py`)

60 single changes, each applied to a copy of `packages/shared/src` under `.cache/w44/mut/shared`
(never to the tree), with six of the seven test files run on the copy (229 tests; the static test
compares the export subpath with the file and cannot run on a copy).

```
M00 no change | exit 0 | 229 passed (229)
…
mutations: 60, killed: 60, survived: 0 []
```

| Group | Changes | Examples (all detected) |
|---|--:|---|
| Delta application (`replica.ts`, `structural-sharing.ts`) | 13 | D01, D02 no structural sharing on a replace, on a snapshot; D03, D04 an append keeps the old head, the old total; D05, D06 ring sizes; D07 an append replaces the rows; D08 the patch names every slice; D09 ops of a delta in reverse order; D10 only the first message of a batch; D11 to D13 sharing of moved elements, equal objects, equal arrays |
| The atomicity gate (`command-gate.ts`, `hasReached`) | 14 | G01 a command in flight does not hold; G02 the continuation runs before the store update; G03, G04 how much is applied at a settlement; G05 to G08 the time-out (no resync, nothing applied, not settled, twice as long); G09 a refusal does not release; G10 reset; G11 a snapshot of the same connection satisfies a sign-in; G12 a hold does not hold; G13, G14 the reached rule |
| The source (`live-sim.ts`) | 16 | S01 a command sent while not ONLINE; S02 settles at its answer; S03 a meter frame held; S04 a session end keeps the Core data; S05 one permission refresh per refusal; S06 an expiry reads as a sign-out; S07 a rejection reported twice; S08 the close after a handled end handled again; S09 signed in before the snapshot; S10 the sign-in settles without its snapshot; **S11 the session token kept with the session**; S12 state applied while the session is being asked for; **S13 `TOKEN_REUSE` not passed on**; S14 a stale link leaves the meters; S15 the state of a socket whose session the server does not name is applied; S16 the socket reopened inside its own message callback |
| Bindings, errors, lockout, throttle, result | 17 | B01 to B04; E01 a failure without an answer rebuilt into a simulator error; **E02 the retry-after value lost**; E03 to E05; L01, L02; T01 to T03; R01 to R03 |

The first run (`44_mutations_run1.log`, 58 changes) detected 56. The two survivors were test gaps,
not source defects: D09 (no test had two ops on one slice in one delta) and E03 (every test's
`details.permission` equalled the registry's). Both tests were strengthened and both changes are
detected since.

After that run three paths that no test reached were given a test each (an OPERATOR socket whose
session the server does not name; a sign-in on a client that is already signed in; a port of the
app that throws). The third one showed a difference in timing: a port that throws at once made the
source reopen the socket inside the socket's own message callback, while a port that returns made
it reopen one promise job later. One line was added (`await Promise.resolve()` before the
reopening), so both cases behave alike. Two changes were added to the list for these paths (S15,
S16); the final run holds all 60.

### 9.7 Acceptance criteria of the row

| Criterion | Statement | Proven by (file: test name) |
|---|---|---|
| **AC-B-63** (spies) | In Simulated mode nothing reaches the network | Section 9.3 |
| **AC-C-02** | No file of `src/live/source` names `node:`, `react-native`, `expo`, `window` or `document`, comments included | `platform-neutral`: "AC-C-02: no file names …". Also: "D69: no request function and no connection class is named anywhere …"; "the typed client is taken as a type only …"; "reads no storage, writes nothing to the console and uses no global object"; "the clock and the timers are injected …" |
| **AC-C-06** | With a simulator, the actions are `sim.actions` itself; zero `fetch` calls and zero socket constructions over the recording scenario | `simulated-isolation`: "over the recording scenario the spies count zero …" (the hook half is W18's `live-light-hooks.test.ts`) |
| **AC-C-07** | A snapshot and the deltas of the recording scenario drive the selectors to the simulator's values | `replica`: "follows one engine through a session: recording, markers, faults, stop, seal, verify, export, archive, diagnostics, a new session": ONE simulator (finding F42), 24 steps; after each step one delta is sent (the fake checks it against the contract) and all 57 one-argument selectors of `sim/selectors.ts` but `selectPairing`, `selectCan` for the 12 permissions, six selectors with an argument, the 28 slices, the chain check, `audio` and `clock` are compared. Also "is a Live source: LIVE in the SimContext …" |
| **AC-C-08** | Structural sharing | `replica`: "after a delta that replaces one slice, every other slice reference is unchanged"; "a snapshot equal to the current state changes no reference and tells no subscriber"; "a replace whose value equals the slice keeps the slice; unchanged array elements keep their references"; "a selector subscription does not fire for a delta that names another slice"; `react`: "a delta renders the hooks that read its slice, once; a delta of another slice renders nothing" |
| **AC-C-10** | Atomicity in both arrival orders; no subscriber is told between the update and the continuation | `atomicity`: "delta first: the delta is held while the command is in flight; the answer applies it and runs the continuation in one turn"; "answer first: … the delta applies and settles in one synchronous turn" (the log is `update, ok, done` before the call of `connection.delta` returns, and the microtask the subscriber queued runs after); "the scripted command of the fake transport, delta-first / answer-first"; `react`: "CL-16: no render happens between the store update that holds a command's effect and its continuation" |
| **AC-C-11** | Error rebuilding | `bindings`: "401 NOT_SIGNED_IN and 403 NOT_PERMITTED become SimPermissionError …"; "404 becomes SimNotFoundError …"; 17 rows "… becomes SimTransitionError …"; 12 rows "… has no simulator class: CoreRefusalError …"; 7 rows "a … failure … is a LiveTransportError, never a simulator error"; through the transport: "a void action rejects with the simulator's class, checked with instanceof"; "a result-union action resolves with ok: false and the mapped reason (CL-19)" |
| **AC-C-12** | A rejected action nobody awaits raises no unhandled-rejection event and is reported once | `atomicity`: "AC-C-12: a rejected Live action that nobody awaits …" (a `process.on('unhandledRejection')` listener sees nothing; one report) |
| **AC-C-13** | The `touchSession` throttle | `session`: "ten activity calls within 60 s send one request at once and one at the end of the window; then none without activity"; "no activity sends none"; "a successful POST restarts the window and clears what was remembered"; "the answer updates the idle expiry …" |
| **AC-C-14** | The settle time-out | `atomicity`: "when the delta of the answered revision does not arrive within 2,000 ms: ONE resync, the action resolves, the link reads RESYNCING until the snapshot"; "two commands that both time out still send ONE resync, and both resolve" |
| **AC-C-15** | A gap or a new epoch; the snapshot replaces the replica | `atomicity`: "a gap sends resync at most once in 2 s, and the snapshot replaces the replica"; "a reset settles when the snapshot of its epoch is applied (snapshot first / answer first)" |
| **AC-C-39** | `selectLockout` on the replica returns the server's `locked`, `lockedUntil`, `attemptsRemaining` | `session`: 7 rows ("1 … 5 attempts remaining", "locked for 18000 ms", "locked for 60000 ms"), each on the pure function and through `getSignInStatus`; "a locked console resolves with LOCKED, and the countdown runs on the Live clock to lockedUntil" |
| **AC-C-54** | A 403 `NOT_PERMITTED` causes one `getAuthSession` within 1 s; ten cause one | `session`: "one refusal causes one getAuthSession within 1 s; ten of them cause one" |
| The row: a 429 keeps its status and `retry-after` | | `bindings`: "a 429 keeps its status and retry-after in LiveTransportError, also for an action with a result union"; `session`: "403 rejects with CoreRefusalError; 429 rejects with LiveTransportError …" |
| The row: `session.ended` with `TOKEN_REUSE` is passed on | | `session`: "session.ended TOKEN_REUSE: auth.status becomes SIGNED_OUT, the Core data goes, the reason is passed on once …"; "session.ended TOKEN_REUSE is passed on with its reason; the app drops the session token and the device socket takes over; the pairing stays" |
| Rule 5: the 42 enumerated | A 43rd action or a renamed operation fails | `bindings`: "has one binding per member of SimActions …"; 42 rows "… calls the operation the contract table names, with a request the contract accepts"; "together the bindings reach the 41 operations of the table, and no other"; `ARGS` is typed by `SimActions` (compile time) |
| Rule 7: no token stored or logged | | `session`: `expectNoSecret` in 9 device tests (reports, store, session, end records, socket status hold no `ses_`, `dvc_`, `bio_` value and no password); `platform-neutral`: "the public surface of a Live source has no member that returns a credential or a token (MP-3)" |
| D61: every Live test ends with `assertNoViolations()` | | An `afterEach` in each of the five files that use the fake; the isolation test calls it in its `finally` |

---

## 10. Findings (P22)

| ID | Finding | Evidence | Proposed action |
|---|---|---|---|
| F66-1, **CONTRACT-GAP-3** | `SIM_ACTION_OPERATIONS.deviceCommand` lists three operations but not which `DeviceCommand` reaches which. Local adapter: `DEVICE_COMMAND_OPERATION_INDEX` (an index into the contract's list), held by a test against each operation's path | `packages/shared/src/api/sim-actions.ts:81`; `live/source/bindings.ts` | W83: add the link to the table (for example `byCommand: { RESTART: 'restartDevice', … }`), then the index goes |
| F66-2, **SIM-GAP-2** (no simulator change asked for) | [CS:§2.3, §6.5, WS-12] set `auth.status` to "LOCKED" after a console lock. The simulator's `AuthStatus` has three values: SIGNED_OUT, SIGNED_IN, EXPIRED. Local adapter: the status is SIGNED_OUT and `lastSessionEnd.signOut` is `'LOCK'` | `packages/shared/src/sim/vocabulary.ts:48-52` | W55 reads the notice "Console locked" from `lastSessionEnd.signOut` (WS-6 already names `lastSessionEnd` as its source) |
| F66-3 | [L27 §11 F-7] says "in Live mode the typed client refuses over-long text before sending". The typed client parses a GET's query with its schema and **never a body** | `packages/shared/src/client/core-client.ts:558-567` | None in code. The refusal is the server's 422 (the contract says "the server does not cut a text", `core-api.ts:830`). The form rows W66, W69, W75 keep the bounds, as F-7 asks |
| F66-4 | The envelope's `details` for `409 SESSION_ACTIVE` names no session; `CreateSessionResult` carries one. The binding reads `details.sessionId` when present, else the replica's open session | [SP:§7.2] | None needed: the replica holds that session |
| F66-5 | `AuthSessionExpiry` (operation 6) carries no `lastActivityAt`. The source derives it as `idleExpiresAt` minus `AUTH_IDLE_TIMEOUT_MS` (15 min, [SP:ID-P4]) | `api/identity.ts:170-176` | None, unless the server's idle time-out is ever configured away from 15 min |
| F66-6 | A simulator session command with no open session checks the permission first; the Live binding cannot (there is no ID to send), so it rejects `SimTransitionError(null, action)` whatever the role, and no denial is audited | `sim/session-machine.ts:521-524` | None: the screens offer these commands only with an open session |
| F66-7 | `SimProvider`'s effect stops the source on unmount. Under React StrictMode (dev) the mount-unmount-mount cycle closes and reopens the socket once and repeats the probe | `sim/react.ts:50-54` | W50 decides: accept it, or keep the provider outside the strict subtree |
| F66-8 | For test authors of the client rows: (a) the fake's `scriptSignedInStart` and `scriptAnonymousStart` ADD a connect script; a test in which the principal changes scripts sockets through one `fake.onConnect` of its own. (b) After every session end the source asks `getSignInStatus`: script it, else the fake records a violation. (c) One synchronous `clock.advance` of several seconds can open and abandon several sockets before a connect script runs: advance in steps and let the promise jobs run in between | `test/live-source-session.test.ts` (`elapse`, `script.start`) | Paste into the client rows' briefs |
| F66-9 | `live-sim.ts` is 1,290 lines: one closure that owns the session state. Its pure parts are already separate files | Section 2 | For CP-C1 (W46) to judge |
| F66-10 | Under `asSim`, `useSimActions()` hands out the Live actions typed as `SimActions`. A call site that still uses it would read a thenable as a value | `sim/react.ts:72` | The static test of AC-C-53 (the client rows) is the guard |
| F66-11 | The 28 baseline files hold 517 tests today, not 508 | Section 9.3 | Ledger note only |

---

## 11. Decisions for the controller

Each is what the code does now; the default if none is taken is that it stands.

| # | Choice the specification left open | What was built | Why |
|--:|---|---|---|
| 1 | When the bootstrap starts | At creation (`autoStart` true by default); `start()` and `stop()` stay idempotent | [CS:§5.1] awaits `live.ready` before any provider is mounted |
| 2 | Input mapping | Passed through unchanged; no trim, no cut, no local validation | The server decides in its own order, so a denial is audited before a body is looked at; F66-3 |
| 3 | A 2xx of a POST without `x-dems-revision` ([DEC:D51] left it to this row) | The action settles at once; one `warn` report | Nothing can be waited for; the store is corrected by the next delta |
| 4 | "LOCKED" | `auth.status` SIGNED_OUT, `lastSessionEnd.signOut: 'LOCK'` | SIM-GAP-2 |
| 5 | What is held while a command is in flight | Deltas **and snapshots** | A snapshot applied early would show the effect before the continuation |
| 6 | The seam for secrets | `LiveSecretsPort` and `device()` (section 3.5); the source keeps no token | Rule 7 of the brief; [CS:MP-3] |
| 7 | The socket after an end | Reopened by the source after the app's port returned, always one promise job after the end was told (never inside the socket's own callback). **Not** reopened after a refused credential with nobody signed in | The same refusal would repeat at once |
| 8 | `touch()` | Resolves at once; a failed touch is reported, never rejected; activity while offline is remembered and sent when the link is back | The shells call it on every pointer event (class F) |
| 9 | Which refusals refresh the permission hint | 403 `NOT_PERMITTED` and 403 `FORBIDDEN` (the export) | The same situation under two codes [SP:RB-5] |
| 10 | The default structural sharing | Index first, then by `id` | A ring that moved by one row keeps its rows; injectable |
| 11 | `LiveSim.actions` | Typed `LiveActions` (each returns a promise-shaped Live result); assignable to `CoreActions` | A consumer of the source itself may `await`; call sites keep `useCoreActions()` |
| 12 | 409 `PRECHECK_WARNINGS`, `PRECHECK_BLOCKED` on a void action | `SimTransitionError`, `ILLEGAL_STATE` | The simulator's `startRecording` refuses a session that is not ARMED that way |
| 13 | A 422 without `details.simCode` | The action's own code: `REASON_TOO_SHORT`, `NOTE_INVALID`, `POLICY_RANGE`; else `INVALID_INPUT` | `INVALID_INPUT` stands for three simulator codes; the action tells them apart |
| 14 | `exportAudit()` and `exportLogs()` without a request | The body `{ reason: '' }` is sent; the server answers 422 → `INVALID_REASON` | The reason is mandatory in Live mode [SP:§7.13]; the server stays the judge |
| 15 | `signOut` answered 401 | Resolves; the session is ended (`source: REST`) | The session is gone, which is what the caller wanted |
| 16 | `ready` | Resolves at once when the probe got no answer or 401; when a session is known, at the first snapshot or after 4,000 ms; on `stop()` | "It never rejects" |
| 17 | New constants | `LIVE_PERMISSION_REFRESH_MS` 1,000 ("debounced 1 s", CL-23); `LIVE_SESSION_PROBE_RETRY_MS` 2,000; `LIVE_ERROR_LOG_SIZE` 50 | The specification gives the first value and no name; the second is this row's |
| 18 | Local answers | A session command with no open session, `startRecording` outside ARMED, a camera that is already active, `pair` on a paired tablet, `unpair` on one that is not, an unknown device command | The simulator changes nothing or throws there; F66-6 |

### Deviations from the plan

| # | Deviation | Why |
|--:|---|---|
| 1 | Seven test files instead of one pattern-named file; all match `live-source-*.test.ts` | One file per subject |
| 2 | Eleven evidence files under `implementation/assets/44_*`; the P23 files under `.cache/rollback/`; scratch under `.cache/w44/` | Evidence and protocol; no code path |
| 3 | `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` were not written | Parallel run (P8) |
| 4 | [CS:§6.6] says "the Live source deletes the device credential". It tells the app (`secrets.deviceUnpaired`, `onSessionEnd`) and deletes nothing | Rule 7 of the brief |

No deviation in write paths.

### Error handling and logging

Every error path of the module ends in one structured report: `{ level, source, message, at,
stack?, context }` (`SimErrorReport`, the simulator's own type), kept in `errors()` and handed to
`onError`, where each app writes it to its persistent log (`logSystemError` on the web,
`reportRuntimeIssue` on mobile). `source` is `live.action.<name>`, `live.socket`, `live.client`,
`live.continuation`, `live.listener.<name>`, `live.secrets`, `live.gate` (and, since the fix round,
the sources of section 14.3, row 11). `context` carries the action, the operation ID, the status,
the code and the request ID (the correlation ID of the server's log).

**What a report can carry** (corrected after checkpoint finding CPC1-18; the first version of this
paragraph said "never an argument, a header or a body", which was not exact). A report holds the
error's own message. For a 404 that message names the entity ID the caller passed
(`SimNotFoundError`, `sim/errors.ts:85`), and a rebuilt refusal carries three members of the
envelope's `details`: `from`, `event` and `permission` (state names and permission names). So an
entity ID and those names can appear in a report. **No credential can**: the typed client refuses
a credential in a path parameter (`client/core-client.ts:410-414, 462`), no header and no request
body reaches the module's errors, and the report of a failing store subscriber names the error and
never a slice's content. The shared layer holds no storage and no console writer of its own
(static test).

---

## 12. Rollback (R-NEW)

```
# from /Users/gsp-budi/Documents/DEMS
# the placeholder of W03 comes back; the 12 other files of the folder and the 7 tests go
cp .cache/rollback/W44.source-index.ts.pre packages/shared/src/live/source/index.ts
# remove: packages/shared/src/live/source/{bindings,clock,command-gate,constants,live-result,live-sim,neutral-state,rebuild-error,replica,structural-sharing,touch-throttle,types}.ts
# remove: packages/shared/test/live-source-{replica,atomicity,bindings,session,react,simulated-isolation,platform-neutral}.test.ts
```

Nothing else depends on the module yet: no production file imports `@dems/shared/live/source`
(the light API's static test holds that for `src/live`), and no test outside the seven does.
After the rollback the suite is the baseline's 57 files / 1,406 tests.

---

## 13. Limits of this evidence

- Everything is proven on the fake transport. No request reached a Core server and no socket was
  opened to one: the first run against the server is the client rows' lane check and W58.
- The deltas of AC-C-07 are built by the test from the simulator's state (a `replace` per changed
  slice, an `append` where a ring only grew). That is what [SP:RT-3] describes; the server's own
  delta builder (W42) is not in this proof.
- The mobile flows (the secrets port, pairing, biometric) are proven under Vitest with an
  in-memory vault. `expo-secure-store`, the OS prompt and a device are W15, W51, W56 and W57.
- React is proven with `react-test-renderer` (no DOM), as the light API's hook tests are.
- The envelope's `details.from`, `details.event` and `details.simCode` are read as [SP:§7.2]
  states them; whether the engine host fills them for every refusal is W34 to W43's, and the
  conformance row's. Where they are absent the fallbacks of section 8 apply.


---

## 14. Fix round after CP-C1 (decision D80)

Source of the round: `gateway_check/07_cp_shared_client.md` (checkpoint CP-C1: 0 Blocker, 0 High,
6 Medium, 12 Low, 4 Info) and the controller's decision D80 ("fix now, before the web and mobile
runtimes are built on the source"), with its ruling on CPC1-21 (a recorded change of [CS:CL-22]
and [CS:WS-12], drift DR-11). Seventeen findings were given to this row; CPC1-3 and CPC1-12 belong
to the typed client's row and were not touched.

**Result: 16 of 17 fixed; 1 cannot be fixed inside the write paths of the row (CPC1-16: the exact
line the owner needs is given).** Of the 16: 14 have tests that are red on the code before the
round and green on the tree; CPC1-14 is a compile-time property, shown by a compile probe (exit 0
before, exit 2 after); CPC1-15 is a restructuring with no behaviour of its own to test, and its
safety is the unchanged result of the tests that existed and of the mutation run. No finding was
skipped, and none was found harmless: every defect the reviewer established by reading was
reproduced.

| Field | Value |
|---|---|
| Files changed in `src/live/source` | 10 of 13 (`replica.ts`, `structural-sharing.ts`, `clock.ts` are byte-equal to the first delivery) |
| Light API (recorded exception, CPC1-13) | `src/live/hooks.ts`: 20 lines added (lines 15-16 and 71-88), none changed or removed. `src/live/index.ts`: unchanged (it re-exports `./hooks`) |
| Tests | 3 new files and additions to 5 existing ones: **67 new tests**; 1 existing test rewritten (its rule changed by D80). The pinned export list of the light API grew by one line: `test/live-light-platform-neutral.test.ts:181` |
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0: **1,735 passed in 68 files** (14:14 WIB). Baseline of the round: 64 files / 1,650 tests. This row adds 3 files and 67 tests; the rest of the difference is the typed client's row, which worked on `test/client-*.test.ts` at the same time (section 14.5) |
| The 28 files of `acaff20` | Unedited (identical `git hash-object` values, `assets/44_fix_pre_state.txt` and `44_fix_post_state.txt`); alone: 28 files, 517 tests, exit 0 |
| `typecheck` of shared, core-web, mobile; `lint` of shared | exit 0, 0, 0; exit 0 (no warning) |
| Red before, green after | **57 tests** fail on the code before the round and pass on the tree (`assets/44_fix_red_green.log`) |
| Mutation re-run | **114 single changes, 114 detected**: the 60 of the first delivery (20 of them re-written for the changed code) and 54 over the code of this round, one per fix or more (`assets/44_mutations.log`) |
| Public API | No member removed, no signature narrowed. Additions, one value added to a union, and five changes of behaviour: section 14.3 |

Sections 1 to 13 are the record of the first delivery. **Where they and this section differ, this
section stands**; section 14.8 lists each earlier statement that no longer holds.

### 14.1 Outcome per finding

"Red before": the named test fails when it runs against `src/live/source` and `src/live/hooks.ts`
as they were before the round (the pre-images under `.cache/rollback/W44-fix/`, on an isolated
copy); "green after": it passes on the tree. Test files are `packages/shared/test/live-source-<name>.test.ts`.

| Finding | Outcome | What changed | Test (file: name) | Red before / green after |
|---|---|---|---|---|
| **CPC1-2** Medium | **Fixed** | Every store subscriber is called by itself (`guardSubscribers`, a wrapper under `subscribeWithSelector`): one that throws, or whose selector throws, is reported as `live.subscriber` (the error's name and message, how many reports were left out; no slice content) and the others are still told. `commit` cannot throw. A command runs between `begin` and its settlement inside `throughGate`: whatever its body does, it leaves the gate exactly once. Every continuation of the source's own questions runs inside `ask`, which reports and recovers. The caller's structural-sharing function is guarded too | `resilience`: "a store subscriber that throws during the session end of a 401 on a command: the end is complete, the gate is free, the action rejects, the subscriber is reported"; "a subscriber that throws on a delta keeps no other subscriber from the update; one that keeps throwing is reported once a second at most"; "a selector that throws is contained in the same way"; "an answer the source cannot read … leaves the gate: the action rejects, and later state is still applied"; "an answer to a question of the source itself that cannot be read is reported and raises no unhandled rejection" | 5 red / 5 green |
| **CPC1-1** Medium | **Fixed** | One revocation is one end: the first sign of it (`device.revoked`, close 4403, 403 `DEVICE_REVOKED`) ends the pairing and is remembered (`retiredEnd`); every later sign is dropped. A `hello` that names `DEVICE_REVOKED` starts no read with the revoked credential. When the reopened socket is refused again, the app's `deviceUnpaired` is asked again after 2 s, 4 s and 8 s (3 times), then one `error` report and the socket stays closed. `pair`, `setPairing(…)` and `reconnect('CREDENTIAL')` end that state | `resilience`: "device.revoked and the 403 of a request that was in flight are one end"; "a cold start with a revoked credential … ONE end, the app told once, no read with the revoked credential, then an anonymous socket"; "a deviceUnpaired that throws and leaves the credential: one end, the storage asked again three times with a growing delay, then one report and a closed socket"; "a new pairing ends the old revocation …"; "the app replaced the credential and says so (reconnect / setPairing): a later revocation is a new end" | 3 red / 3 green; 3 guards of the new code, green on both |
| **CPC1-4** Medium | **Fixed, with stated limits** | Two run-time signs under `live.misuse`, once per action name each: `READ_AS_VALUE` (level `error`): the member `ok` is read on the result of one of the 14 actions that return a value in the simulator; `NOT_OBSERVED` (level `warn`): such a result settled and `then`, `catch`, `finally` were never called on it. Section 14.4 says what cannot be detected | `misuse`: "READ_AS_VALUE: the member `ok` read on the result of a value-returning action is reported at once, as an error, once per action"; "NOT_OBSERVED: … reported once it settled, as a warning, once per action"; "no report: await, settle(), then, catch, finally, Promise.all, and a result returned from an async function"; "no report for an action that returns nothing in the simulator …"; "the watched member is not listed …"; "the names: the 14 actions …" | 3 red / 3 green; 3 guards of the new code, green on both |
| **CPC1-5** Medium | **Fixed** | Every envelope code is a member of the contract's `ApiErrorCode` (imported, no retyped list): the comparisons go through `isRefusal(failure, status, code: ApiErrorCode)`, and `ENVELOPE_SIM_CODE` is `Partial<Record<ApiErrorCode, SimErrorCode>>`. The texts that remain (`reason: 'NOT_SIGNED_IN'` and the like) are members of the simulator's result unions, typed by those unions | `platform-neutral`: "CPC1-5: no envelope code is compared as a text of this folder …"; "CPC1-5: every envelope code the folder mentions is a code of the contract; the three codes of its own are not"; `bindings`: "CPC1-5: every envelope code of the table, and every code a comparison helper is given, is a code of the contract" | 3 red / 3 green |
| **CPC1-21** Medium, ruling D80 | **Fixed as ruled: option (a)** | Section 14.2 | `local-end`: 18 tests (section 14.2); `session`: "a sign-out the server cannot answer does not reject and do nothing (decision D80) …" | 17 red / 17 green; 2 guards, green on both |
| **CPC1-6** Low | **Fixed** | The three markers stand in the comment of each adapter: `CONTRACT-GAP-3` (`bindings.ts`, `DEVICE_COMMAND_OPERATION_INDEX`), `SIM-GAP-2` (`live-sim.ts`, the LOCK adapter), `F66-5` (`neutral-state.ts`, `lastActivityOf`). The round adds one: `CONTRACT-GAP-7` (section 14.6) | `platform-neutral`: "CPC1-6: each local adapter carries its ID as a text a search finds" | 1 red / 1 green |
| **CPC1-7** Low | **Fixed** | `stop()` cancels every timer (the six one-shot slots, the clock, the gate's waiters through the new `gate.halt()`, the waits for the app's storage) and settles what is out: a command the Core already accepted resolves, an action without an answer rejects `LiveTransportError('CORE_OFFLINE', code 'STOPPED')`. A run counter makes every answer of a stopped run a no-op | `resilience`: "a command the Core accepted and that waits for its delta resolves inside stop(); no timer is left"; "a command without an answer rejects inside stop() (CORE_OFFLINE, STOPPED); the 401 that arrives afterwards ends no session"; "a 403 that arrives after stop() starts no permission refresh"; "the answer to the session probe that arrives after stop() adopts no session and starts nothing"; "a sign-in that is out at stop() rejects there; its late answer hands no token to the app"; `atomicity`: "CPC1-7: `halt` settles every waiting command as dropped, clears its timer, …" | 6 red / 6 green |
| **CPC1-8** Low | **Fixed** | The probe is repeated after 2 s, 4 s, 8 s, 16 s, then every 30 s (`LIVE_SESSION_PROBE_RETRY_MAX_MS`); a `retry-after` is never undercut, also not by a new OPERATOR `hello`. The gate holds 256 state messages at most (`LIVE_HELD_MESSAGES_MAX`): beyond it everything held is dropped, one `warn` report is written, deltas are dropped until a snapshot, and ONE `resync` is asked for when the gate is free | `resilience`: "with the Core down the probe is repeated after 2 s, 4 s, 8 s, 16 s and then every 30 s"; "a 429 is not asked again inside its retry-after, also when a new socket says OPERATOR in between"; "more than 256 held state messages are dropped, reported, and ONE resync brings the state back when the gate is free"; `atomicity`: "CPC1-8: beyond `maxHeld` …"; "CPC1-8: a command that waited for a dropped message leaves by its time-out, and the resync is asked for once"; "CPC1-8: without `maxHeld` nothing is bounded, as before" | 5 red / 5 green; 1 guard, green on both |
| **CPC1-9** Low | **Fixed**; `headers()` stays synchronous and is documented | A `hello` that names another principal while the session is known asks for one new socket (one promise job later, once per session). A second socket that still does not carry the session is reported (`live.socket`, level `error`) and nothing loops. `CreateLiveSimOptions.socket.headers` now says: synchronous, asked whenever a socket is opened | `resilience`: "the probe answers first, then `hello` names DEVICE: one new socket is asked for, and the client is signed in"; "when the second socket does not carry the session either, that is reported once and nothing loops" | 2 red / 2 green |
| **CPC1-10** Low | **Fixed** | The throttle keeps the time of the remembered activity. When the link returns, activity older than the interval (60 s) is forgotten and nothing is sent; activity at most 60 s old is sent ("at most 60 s late", [CS:CL-27]) | `session`: "activity older than the interval is forgotten when the link returns …"; "activity at most the interval old is still sent …; one millisecond older is not"; "on a Live source: the link is down for five minutes after the last activity; when it returns no touch is sent"; "the newest activity counts …" | 3 red / 3 green; 1 guard, green on both |
| **CPC1-11** Low | **Fixed** | After `devicePaired` the lock state is read again, with the device credential; an answer that was asked for before the credential changed is not applied | `resilience`: "the view that was read without a device credential is replaced by the one read as this device" | 1 red / 1 green |
| **CPC1-13** Low (owner W18; done here by the recorded exception) | **Fixed** | `useLiveSelector(read)` is exported by the light API (`src/live/hooks.ts:71-88`): `read` gets the Live source, or `null` in Simulated mode; the component renders when the source reports a change. One generic hook serves `session`, `lastSessionEnd` and `auditChain`: the light API cannot name the heavy module's types, so three named hooks would return `unknown` | `react` (this row's own file): "CPC1-13: useLiveSelector() reads the session, why the last session ended and the audit chain check, and renders on their changes only"; "CPC1-13: useLiveSelector() gets null in Simulated mode and subscribes to nothing" | 2 red / 2 green |
| **CPC1-14** Low | **Fixed** | `asSim` is a checked construction: the compiler holds every member of `Sim` but `actions` and `store` to the simulator's own type, and a type-level statement holds the names (`Exclude<keyof Sim, keyof LiveSim>` is `never`). One narrowing `as Sim` remains, for the two documented members | Compile time, on two copies (`assets/44_fix_assim_probe.log`): with one member added to `Sim`, the code before the round compiles (exit 0) and the tree does not (exit 2, `index.ts(134,7)`). Run time: `misuse`: "a Live source has every member of a real simulator, by name and by kind"; "compile time: no member of Sim is missing on LiveSim" | Compile probe: exit 0 before, exit 2 after. The two run-time tests are green on both: the 16 members were present before |
| **CPC1-15** Low | **Fixed** | The 22 mutable bindings of the closure are ONE record (`LiveSourceState`, built by `initialState()`), with a table in the file's header: member, meaning, what sets it, what clears it. Two bindings remain outside it, both written once: `resolveReady` and the store. The file was not split | No behaviour to test. `grep -n "^  let " live-sim.ts` finds one line (`resolveReady`) | Not a test finding |
| **CPC1-16** Low | **Not fixable in this row's write paths** | The second copy of `DEFAULT_TIMERS` is in `src/realtime/live-socket-client.ts:468-473`, which this row may not edit, and that file does not export it. The other pair (`isThenable` in `live/settle.ts:53` and `live-result.ts:39`) is forced by "no import" in both files; the reviewer accepted it. Finding F66-12 (section 14.6) gives the two lines the owner changes | — | — |
| **CPC1-18** Info | **Fixed** | The sentence of this log is corrected (section 11, "Error handling and logging", and the header of `live-sim.ts` and of `rebuild-error.ts`): a report can hold an entity ID and the state and permission names of an envelope; never a credential, a header or a body. The two inherited-key lookups are closed (`envelopeSimCodeOf`, `deviceCommandIndex`: own keys only) | `bindings`: "CPC1-18: an envelope code that names an inherited member of an object stands for no simulator code"; "CPC1-18: a device command that names an inherited member is refused as any unknown command, without a request" | 2 red / 2 green |
| **CPC1-20** Info | **Fixed**, and one step wider than asked | The wait for `sessionCleared` and `deviceUnpaired` ends after `LIVE_SECRETS_TIMEOUT_MS` (5,000 ms) with a report, and the socket is reopened. The same bound holds for `sessionIssued` and `devicePaired`: there the action rejects (`CoreRefusalError`, `NOT_AVAILABLE`), because a sign-in that waits for ever would keep the gate closed. `biometricToken` is not bounded (the operating system's prompt has its own time-out) | `resilience`: "a sessionCleared that never answers: given up after 5,000 ms, reported, and the socket is reopened"; "a sessionIssued that never answers: the sign-in rejects after 5,000 ms and the gate is free again" | 2 red / 2 green |

### 14.2 CPC1-21 as ruled: a local end, an owed sign-out, a local expiry check

| Rule of D80 | What the source does | Test in `local-end` |
|---|---|---|
| `signOut` (USER, LOCK) while the link is not ONLINE must not reject and do nothing | It resolves at once. The session ends HERE, in the turn of the call | "signOut(USER / LOCK) while the link is OFFLINE resolves; …"; "Lock while the link is STALE: the same local end" |
| The replica is cleared to the neutral signed-out state at once | One store update: the 28 replicated slices neutral, `auth` SIGNED_OUT (EXPIRED for an expiry) | The same tests: one subscriber call, `SIGNED_OUT operators=0` |
| `lastSessionEnd` says USER or LOCK | `{ kind: 'SESSION_ENDED', reason: 'SIGNED_OUT', source: 'LOCAL', signOut: 'USER' or 'LOCK' }` | The same tests |
| The sign-out is owed and is sent before the next OPERATOR socket is taken | On an OPERATOR `hello` with a debt: the socket is not probed, its state is held back, and the sign-out is sent. After the answer the held state is dropped and the socket is reopened | "then the link returns: exactly ONE owed sign-out is sent, before the OPERATOR socket is taken; its state is never shown; then the socket is anonymous" |
| A 401 because the session already ended resolves | 401 `NOT_SIGNED_IN` counts as done | "the owed sign-out answered 401 NOT_SIGNED_IN … counts as done" |
| `sessionCleared` is called at the local end, not at the later send | It is called by the same code as for every end, right after the listeners | "Lock while OFFLINE: sessionCleared is called then; when the link returns the socket is the device's and no sign-out is sent" (the port records the link state at its call: OFFLINE or CONNECTING) |
| No token is kept for the owed sign-out | The request is built when it is sent, from the binding; it travels with what the credential provider or the browser still holds. On a tablet the app dropped the session token at the local end, so the next socket is the device's: nothing is owed any more and nothing is sent | The same device test: no request, and no token readable on the source |
| A local idle check against `session.idleExpiresAt` on the injected clock | One timer for the earlier of the idle and the absolute expiry, on the Live clock. At that instant, and whenever the link leaves ONLINE after it: a local end with reason `IDLE_EXPIRED` or `ABSOLUTE_EXPIRED` | "the idle expiry passes while the link is OFFLINE: EXPIRED, …"; "the absolute expiry likewise" |
| No local end may be skipped because the transport is down | A sign-out that gets no answer while the link says ONLINE (no answer, a time-out, 429, 5xx) is the same local end, and owed | "no answer: a sign-out the Core does not answer while the link says ONLINE ends here too, and is owed" |
| The link returning with nothing owed sends nothing | — | "nothing owed: a link that is lost and returns sends no sign-out, and the client stays signed in" (green before too: a guard) |

What the ruling left open, and what was built (each is a decision for the controller, section 14.7):

- **While the link is ONLINE the expiry ends nothing here**: the Core says so itself (`session.ended`). Test: "while the link is ONLINE the instant passes and nothing ends here …; when the link is lost after it, the end follows at once".
- **An answered POST of this client moves the idle instant** by the idle time-out, as the server does (ID-P9); otherwise the client would end a session the server still holds. Test: "a POST of this client the Core answered moves the idle instant …". A POST a page sends through `live.client` by itself is not seen by the source, so the instant can be early, never late (finding F66-14).
- **An expiry decided here is owed too**, with the reason USER (the request knows USER and LOCK only: `CONTRACT-GAP-7`). Without it a session that is still alive at the Core would be taken again silently when the link returns, after the screen said "expired". Test: "after a local expiry the link returns with the session still alive at the Core: it is signed out (reason USER), not taken again".
- **A socket that is no OPERATOR socket ends the debt** (the credential names no session any more). Test: "the link returns and the socket is anonymous …: nothing is owed, nothing is sent", which also shows that a later OPERATOR socket (a new session) is taken as usual.
- **A sign-in ends the debt at its answer**, and no owed sign-out is sent while a sign-in is out: one that arrived after it would end the NEW session. Test: "a sign-in while a sign-out is still owed ends the debt: the new session is not signed out afterwards". The first version of this fix cleared the debt only at the sign-in's snapshot; this test failed on it (three requests instead of two) and the order was corrected.
- **An owed sign-out without an answer is asked again** after 2 s, 4 s, 8 s, up to 30 s, never inside a `retry-after`. Test: "the owed sign-out without an answer is asked again after 2 s, 4 s, 8 s …".
- **A refused sign-out still rejects**: an answer of the Core other than 401 (for example 403 `ORIGIN_NOT_ALLOWED`) is not "the transport is down". Test: "a sign-out the Core REFUSES … still rejects and leaves the client signed in" (green before too).
- **`stop()` and `start()` with a debt**: the new run sends it again. Test: "stop() and start() while the owed sign-out is out …".

### 14.3 Public API of `@dems/shared/live/source` and `@dems/shared/live` after the round

The reviewer found no need to change the public API, and nothing was removed or narrowed. The 30
members of `LiveSim`, the 5 members of `LiveSecretsPort` and `CreateLiveSimOptions` are unchanged
in type. What is new, and what behaves differently:

| # | Kind | Change | Who it concerns |
|--:|---|---|---|
| 1 | **Behaviour** | `actions.signOut(reason)`: resolves with a local end when the link is not ONLINE, and when the request gets no answer. It rejects only when the Core answers with a refusal other than 401 | W54 (the shell's Lock entry), W55 |
| 2 | **Type, one value added** | `LiveSessionEndSource` has the member `'LOCAL'`. `LiveSessionEnd.reason` of a LOCAL end is `SIGNED_OUT`, `IDLE_EXPIRED` or `ABSOLUTE_EXPIRED`; `signOut` is `USER`, `LOCK`, or null for an expiry | W50, W51, W54: a `switch` over `source` gets one more case |
| 3 | **Behaviour** | `stop()` settles every action that is out, inside the call (resolve when the Core accepted it; reject `LiveTransportError('CORE_OFFLINE')` with `code: LIVE_STOPPED_CODE` otherwise) | W50 (StrictMode, F66-7), W51 |
| 4 | **Behaviour** | `store.subscribe`: a listener or selector that throws is contained and reported (`live.subscriber`); it no longer throws into the turn that committed the update | W50, W51: a subscriber's own bug shows in the persistent log, not as a frozen screen |
| 5 | **Behaviour** | `reconnect('CREDENTIAL')` and `setPairing(pairing)` with a pairing also tell the source that the device credential was replaced | W51, W57 |
| 6 | **Behaviour** | The result of the 14 value-returning actions has a hidden member `ok` (not enumerable, answers `undefined`) that reports its read | W55 and the call-site rows |
| 7 | New values | `LIVE_SESSION_PROBE_RETRY_MAX_MS` 30,000; `LIVE_HELD_MESSAGES_MAX` 256; `LIVE_SECRETS_TIMEOUT_MS` 5,000; `LIVE_DEVICE_CLEANUP_RETRY_MS` 2,000; `LIVE_DEVICE_CLEANUP_RETRIES` 3; `LIVE_SUBSCRIBER_REPORT_INTERVAL_MS` 1,000; `LIVE_STOPPED_CODE` `'STOPPED'`; `LiveMisuse` (`READ_AS_VALUE`, `NOT_OBSERVED`); `LIVE_VALUE_ACTION_NAMES` (14 names); `LIVE_RESULT_DISCRIMINANT` `'ok'`; `envelopeSimCodeOf(code)`; `isRefusal(failure, status, code)` | — |
| 8 | New types | `LiveResultHooks`; the type `LiveMisuse` | — |
| 9 | Type made stricter | `ENVELOPE_SIM_CODE` is `Readonly<Partial<Record<ApiErrorCode, SimErrorCode>>>` (was `Readonly<Record<string, SimErrorCode>>`). Reading it with an arbitrary text no longer compiles: use `envelopeSimCodeOf(text)`. No file outside this folder read it | — |
| 10 | Optional parameters and members added | `createLiveResult(report, hooks?)`, `resolvedLiveResult(value, report, hooks?)`, `rejectedLiveResult(reason, report, hooks?)`; `CommandGate.halt()`; `CommandGateOptions.maxHeld?`, `overflow?` | — |
| 11 | New report sources | `live.subscriber`, `live.misuse`, `live.session`, `live.store`, `live.structuralSharing`, `live.owed`, `live.status`, `live.permission`, `live.touch`, `live.expiry`, `live.cleanup`; `live.secrets` now also for a time-out (`context.timedOut`) and for a credential that stays (`context.tries`) | The apps' log readers |
| 12 | Light API, new export | `useLiveSelector<T, Handle>(read: (live: Handle or null) => T): T` | W50, W51, W54 |

The export list of the subpath is pinned by `test/live-source-platform-neutral.test.ts` ("exports
the Live source and nothing else": 56 names, 12 of them new) and that of the light API by
`test/live-light-platform-neutral.test.ts:181`.

### 14.4 The misuse report: what is detected and what is not (CPC1-4)

| Case | Reported? |
|---|---|
| `const r = actions.createSession(v); if (r.ok) …` on a Live source | **Yes, at once**: `READ_AS_VALUE`, level `error`, `context: { action, misuse, member: 'ok' }` |
| The result of a value-returning action is dropped (`actions.runDiagnostics();`), or read by another member (`r.exportId`, `r.length`, the text of a `runId`) | **Yes, when it settled**: `NOT_OBSERVED`, level `warn`. The two cases cannot be told apart |
| `await`, `settle()`, `.then`, `.catch`, `.finally`, `Promise.all`, a result returned from an async function | No |
| An action that returns nothing in the simulator, read as a value: `try { actions.stopRecording(r) } catch …`, or a call that expects the effect in the next line | **Not detectable.** A fire-and-forget call of such an action is how the shells call them (`touch`, `resetClip`), and it looks the same. The static test of the client rows is the guard |
| A handler that is attached only after the result settled and three promise jobs passed | Reported as `NOT_OBSERVED` although the value is used (a false report; level `warn`, once per action name) |

Deviation from the reviewer's suggested fix, with its reason: the reviewer asked for one report at
level `error` when no `then` was attached. Three production call sites drop a value on purpose
today: `apps/core-web/src/features/evidence/export-wizard.tsx:133` (`exportEvidence`),
`apps/mobile/src/features/evidence/sim-adapter.ts:61` (`verify`),
`apps/mobile/src/features/settings/maintenance-section.tsx:114` (`void actions.runDiagnostics()`).
An `error` for each would be a false alarm, so that sign is a `warn` and the certain sign (a read
of `ok`) is the `error`. Each sign is reported once per action name for the life of the source.

### 14.5 Verification

**Gate on the finished tree** (`assets/44_fix_gate.log`; from `/Users/gsp-budi/Documents/DEMS`, no `cd`):

```
# Step 66 (W44), fix round after CP-C1 (decision D80): final gate
## 2026-10-04 14:14:40 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1735 passed (1735)
   Start at  14:14:40
   Duration  6.92s (tests 55%, import 35%, transform 9%, worker 1%)
exit=0
## 14:14:47 the 28 test files that exist at acaff20 (git ls-tree -r acaff20 --name-only packages/shared/test), alone
 Test Files  28 passed (28)
      Tests  517 passed (517)
exit=0
## 14:14:50 the ten files of this row, alone (every test name is in 44_fix_tests_verbose.log)
 Test Files  10 passed (10)
      Tests  311 passed (311)
exit=0
## 14:14:52 the light API's test files, alone (the pinned export list grew by one line)
 Test Files  2 passed (2)
      Tests  26 passed (26)
exit=0
## 14:14:52 $ npm run typecheck -w @dems/shared       > tsc --noEmit    exit=0
## 14:14:55 $ npm run lint -w @dems/shared            > oxlint          exit=0
## 14:14:55 $ npm run typecheck -w @dems/core-web     > tsc -b          exit=0
## 14:15:04 $ npm run typecheck -w @dems/mobile       > tsc --noEmit    exit=0
```

The gate was run twice in the round, both times green: at 14:06, and at 14:14 after two test
files were changed once more (the new tests no longer read the round's own constants, section
14.10); the mutation run, the comparison below and the verbose listing were repeated with it. The
asset holds the second run. No source file of the row was edited after 13:57:03 and no test file
after 14:08:38. Every sandboxed run
also prints the host's keychain line (log 01, line 162); it is not a test result.

**Test ledger (P24).**

| | Before the round | After | By name |
|---|---|---|---|
| `@dems/shared`, files | 64 | 68 | This row: `live-source-resilience.test.ts`, `live-source-local-end.test.ts`, `live-source-misuse.test.ts`. Not this row: `client-credentials.test.ts` (the typed client's row, CPC1-3) |
| `@dems/shared`, tests | 1,650 | 1,735 | This row: +67 (table below). Not this row: +18 in that file |

| File of this row | Tests before | Tests after | Added in the round |
|---|--:|--:|---|
| `live-source-replica.test.ts` | 15 | 15 | — |
| `live-source-atomicity.test.ts` | 35 | 39 | 4: the gate's bound (3) and `halt` (1) |
| `live-source-bindings.test.ts` | 98 | 101 | 3: CPC1-18 (2), CPC1-5 (1) |
| `live-source-session.test.ts` | 71 | 75 | 4: CPC1-10. One more was re-written (D80) |
| `live-source-react.test.ts` | 6 | 8 | 2: CPC1-13 |
| `live-source-simulated-isolation.test.ts` | 4 | 4 | — |
| `live-source-platform-neutral.test.ts` | 15 | 19 | 4: CPC1-5 (2), CPC1-6 (1), the constants of the round (1) |
| `live-source-resilience.test.ts` (new) | — | 24 | CPC1-2 (5), CPC1-1 (6), CPC1-20 (2), CPC1-7 (5), CPC1-8 (3), CPC1-9 (2), CPC1-11 (1) |
| `live-source-local-end.test.ts` (new) | — | 18 | CPC1-21 |
| `live-source-misuse.test.ts` (new) | — | 8 | CPC1-4 (6), CPC1-14 (2) |
| **Sum** | **244** | **311** | **67 more; 68 new names, one of them the re-written test** |

One existing test changed its rule, as D80 rules: `session`, "a sign-out the server cannot answer
rejects and leaves the client signed in" is now "a sign-out the server cannot answer does not
reject and do nothing (decision D80): the session ends here, and the sign-out is owed". No other
existing test of the row was changed in what it asserts, except the pinned export list of the
subpath, which gained the 12 new names.

**Red before, green after** (`assets/44_fix_red_green.py`, `44_fix_red_green.log`). The tests of
the round were run on a copy with the code before the round, and on the tree:

```
# Step 66 (W44), fix round after CP-C1 (decision D80): red before, green after, 2026-10-04 14:14:34 WIB
$ python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_fix_red_green.py
BEFORE (the code before the round, today's tests): exit 1 | 57 failed | 235 passed (292)
AFTER  (the tree):                                 exit 0 | 292 passed (292)

## Red before, green after: 57
…
## Not green after: 0
## Green before and after (tests that existed, and tests that only guard the new code): 235
```

The 57 tests are listed by name in the log. Tests of the round that are green on both
runs are guards of new code or of a rule that held before; each is marked as such in section 14.1
and 14.2. They are: `local-end`: "nothing owed: a link that is lost and returns sends no sign-out, and the client stays signed in"; `local-end`: "a sign-out the Core REFUSES (an answer, not a failed transport) still rejects and leaves the client signed in"; `session`: "the newest activity counts: an operator who was active to the end of the outage is reported"; `atomicity`: "CPC1-8: without `maxHeld` nothing is bounded, as before"; `resilience`: "a new pairing ends the old revocation: a later revocation is a new end"; `resilience`: "the app replaced the credential and says so (reconnect): a later revocation is a new end"; `resilience`: "the app replaced the credential and says so (setPairing): a later revocation is a new end"; `misuse`: "the watched member is not listed: a log or a matcher that walks the result reads nothing"; `misuse`: "no report: await, settle(), then, catch, finally, Promise.all, and a result returned from an async function"; `misuse`: "no report for an action that returns nothing in the simulator, however it is called: fire-and-forget is how the shells call them"; `misuse`: "a Live source has every member of a real simulator, by name and by kind"; `misuse`: "compile time: no member of Sim is missing on LiveSim (this file does not compile otherwise)".

**Mutation re-run** (`assets/44_mutate.py`, `44_mutations.log`): 114 single changes on
an isolated copy, nine of the ten test files (the static file compares the export subpath with the
tree and cannot run on a copy).

```
# Step 66 (W44), fix round after CP-C1 (decision D80): mutation run on an isolated copy (.cache/w44/mut/shared), 2026-10-04 14:08:47 WIB
$ python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_mutate.py
M00 no change | exit 0 | 292 passed (292)
…
mutations: 114, killed: 114, survived: 0 []
exit=0
# finished 14:14:14 WIB
```

| Group | Changes | Note |
|---|--:|---|
| The 60 of the first delivery | 60 | 40 unchanged; 20 re-written for the code as it stands now (S01 to S16, T01, G05, G06, G10). S05 now changes the delay of the permission refresh: with one timer slot per name its old form would change nothing |
| CPC1-2 | 4 | F01 to F04 |
| CPC1-1 | 7 | F05 to F11 |
| CPC1-20 | 1 | F12 |
| CPC1-7 | 6 | F13 to F16, F25, F26 |
| CPC1-8 | 8 | F17 to F24 |
| CPC1-9 | 2 | F27, F28 |
| CPC1-10 | 2 | F29, F30 |
| CPC1-11 | 1 | F31 |
| CPC1-4 | 5 | F32 to F36 |
| CPC1-18 | 2 | F37, F38 |
| CPC1-21 | 16 | F39 to F54 |

Each F change is detected by the test of its own finding (the log names the first failing test).
Two changes were found to be equivalent while the list was written and are not in it: removing
either of the two places that hold back the state of an OPERATOR socket while a sign-out is owed
(`sendOwed` and `onState`) changes nothing, because the other one still holds. That redundancy is
deliberate.

**Each client's compiler options** (`assets/44_client_probe.log`): the two probes now also use
`useLiveSelector`, the `LOCAL` source, `LiveMisuse`, `LIVE_STOPPED_CODE` and
`reconnect('CREDENTIAL')`. Web: exit 0. Mobile: exit 0. Two wrong lines appended: exit 2 for both.

**CPC1-14 at compile time** (`assets/44_fix_assim_probe.py`, `44_fix_assim_probe.log`):

```
before | Sim as it is              | tsc exit 0 | 0 errors
before | Sim with one member more  | tsc exit 0 | 0 errors
after  | Sim as it is              | tsc exit 0 | 0 errors
after  | Sim with one member more  | tsc exit 2 | 1 errors
         src/live/source/index.ts(134,7): error TS2322: Type 'true' is not assignable to type 'never'.
```

### 14.6 Findings of the round (P22)

| ID | Finding | Evidence | Proposed action |
|---|---|---|---|
| F66-12 (CPC1-16) | The global timer functions exist twice: `packages/shared/src/realtime/live-socket-client.ts:468-473` and `live/source/live-sim.ts` (`DEFAULT_TIMERS`). The first file is outside this row's write paths and does not export its copy | The two files | Owner of `src/realtime` (W30): change line 468 from `const DEFAULT_TIMERS: LiveSocketTimers = {` to `export const LIVE_SOCKET_DEFAULT_TIMERS: LiveSocketTimers = {` and its one use. Then this row deletes its six lines, imports the name, and changes the static test "the clock and the timers are injected" to expect no timer call in the folder |
| | **Resolved in the follow-up (D84, section 16.3)**: the socket client exports its copy and this row deleted its own | | |
| F66-13, **CONTRACT-GAP-7** (first logged as CONTRACT-GAP-4, a number the typed client's row had taken; renamed by D84) | The sign-out request knows the reasons USER and LOCK. A session this client ended for its expiry while the link was down, and that is still alive at the Core when the link returns, is signed out as USER | `packages/shared/src/sim/vocabulary.ts:56`; `api/identity.ts:160-168`; marker at `endLocally` in `live-sim.ts` | W83: either a third reason (for example `EXPIRED`) in `SignOutRequest`, or record that USER is accepted. The audit row then says who ended it |
| F66-14 | A POST a page sends through `live.client` by itself (the administration pages) is not seen by the source: it does not restart the touch period, a 401 on it ends no session here, and it does not move the idle instant this client reckons with. So a local expiry can come early (never late) on a console whose only activity was such POSTs | `live-sim.ts`, `inspect` and `expiryOf` | The client rows: either call `actions.touch()` after such a POST, or the source gets a member that takes an answer (`live.observe(result)`). A decision for the controller |
| | **Resolved in the follow-up (D84, section 16.2)**: `live.client` is an observed view; an answered POST of the operator through it is activity | | |
| F66-15 | On a tablet a local end drops the session token at once (D80), so the owed sign-out cannot be sent with it. The session stays open at the Core until its idle expiry (15 minutes at most); nobody holds its token | Section 14.2, the device test | None in code. For the server's audit: such a session ends as IDLE_EXPIRED, not as a sign-out |
| F66-16 | The reviewer read CPC1-1 (b) as "a cold start can end two or three times", and CPC1-1 (a) as a loop without a delay. Both reproduced on the code before the round: 3 ends at a cold start, and 24 ends within 60 s when `deviceUnpaired` throws. The first version of this round's cold-start test answered each request by what the app's storage held at that moment and was green on the old code; it now answers by the credential the request itself carried | `resilience`: "a cold start with a revoked credential …", "a deviceUnpaired that throws and leaves the credential …"; `assets/44_fix_red_before_reasons.log` | For the client rows' fakes: answer by what the request presented, not by what the app holds now |
| F66-17 | `live-sim.ts` is 2,036 lines after the round (1,290 before); its header comment, with the state table, is 108 of them. It was not split, as CP-C1 and D80 say | `wc -l` | CP-C1's step 2 (extract the reports) and step 3 (after W58) stand |
| F66-18 | A `hello` that names no OPERATOR and gives no reason, while this client believes it is signed in, is not an end: one new socket is asked for, and a second such socket is reported. The specification names only `SESSION_INVALID` as an end | [CS:§6.5]; `live-sim.ts`, `onHello` | None, unless the backend gate shows a server that answers so |
| | **Answered in the follow-up (section 16.4); one defect found and fixed**: the expiry is now checked here whenever the socket is not the session's | | |

### 14.7 Decisions for the controller (the round's)

Each is what the code does now; it stands unless the controller decides otherwise.

| # | Left open by | What was built | Why |
|--:|---|---|---|
| 19 | D80 | A sign-out that gets no answer while the link says ONLINE is a local end too | "No local end may be skipped because the transport is down" |
| 20 | D80 | A sign-out the Core refuses (not 401) still rejects and leaves the client signed in | It is an answer, not a failed transport; the call site can show it |
| 21 | D80 | An expiry that was decided here owes a sign-out, sent as USER | Else the session comes back silently; CONTRACT-GAP-7 |
| 22 | D80 | A socket that is no OPERATOR socket ends the debt; on a tablet nothing is sent | No token is kept; F66-15 |
| 23 | D80 | The owed sign-out is asked again with the probe's back-off; a sign-in ends the debt at its answer, and none is sent while a sign-in is out | The test that found the race |
| 24 | D80 | The expiry ends nothing here while the link is ONLINE | The Core is the judge whenever it can be heard |
| 25 | D80 | An answered POST of an action moves the idle instant by `AUTH_IDLE_TIMEOUT_MS` | ID-P9; else the client ends a live session |
| 26 | CPC1-4 | `NOT_OBSERVED` is a `warn`, `READ_AS_VALUE` an `error` | Three call sites drop a value on purpose (section 14.4) |
| 27 | CPC1-7 | At `stop()` an accepted command resolves; an unanswered action rejects `STOPPED` | The server did accept the first; for the second there is no answer |
| 28 | CPC1-1 | The storage is asked again 3 times (2 s, 4 s, 8 s); then the socket stays closed | Bounded and delayed; the app's `reconnect('CREDENTIAL')` reopens it |
| 29 | CPC1-1 | A `hello` that names `DEVICE_REVOKED` starts no status read | The read would be refused with the same credential |
| 30 | CPC1-20 | `sessionIssued` and `devicePaired` are bounded too (5,000 ms; the action rejects `NOT_AVAILABLE`) | A sign-in that waits for ever keeps the gate closed |
| 31 | CPC1-8 | 256 held messages; the probe's cap is 30 s | A snapshot is one message; 256 deltas are minutes of a session |
| 32 | CPC1-2 | A subscriber that keeps throwing is reported once a second at most, with the count left out | The clock slice changes ten times a second |
| 33 | CPC1-13 | One generic hook, `useLiveSelector`, instead of three named hooks | The light API cannot name the heavy module's types |

### 14.8 Statements of sections 1 to 13 that no longer hold

| Where | It said | Now |
|---|---|---|
| Section 3.2, `stop()` | "After `stop()` no timer is left (tested)": true for an idle source only | True also with a command in flight (CPC1-7) |
| Section 6, the gate table | Three operations on a waiting command | Plus `halt` and the bound (`maxHeld`) |
| Section 7, `signOut` | Rejects `CORE_OFFLINE` while the link is not ONLINE | A local end (D80) |
| Section 9.7, AC-C-13 | "activity while offline is remembered and sent when the link is back" | Sent only when it is at most 60 s old (CPC1-10) |
| Section 10, F66-9 | `live-sim.ts` is 1,290 lines | 2,036 (F66-17) |
| Section 10, F66-10 | The static test of the client rows is the guard | Plus the run-time report (CPC1-4) |
| Section 11, decision 7 | "Reopened by the source after the app's port returned" | After the port returned or 5,000 ms passed; for a revocation at most 1 + 3 times |
| Section 11, decision 8 | "activity while offline is remembered and sent when the link is back" | As for AC-C-13 above |
| Section 11, decision 15 | "`signOut` answered 401: resolves" | Unchanged, and now also: no answer resolves, with a local end |
| Section 11, decision 17 | `LIVE_SESSION_PROBE_RETRY_MS` 2,000 | The first wait; it doubles up to 30,000 |
| Section 11, "Error handling and logging" | "never an argument, a header or a body" | Corrected in place (CPC1-18) |
| Section 12, rollback | 13 source files, 7 tests | Section 14.9 |

| Section 14, result | "16 of 17 fixed; CPC1-16 not fixable inside the write paths" | 17 of 17 after the follow-up's recorded exception (section 16.3) |
| Section 14.2 | "While the link is ONLINE the expiry ends nothing here" | While the link is ONLINE **on the session's OPERATOR socket** (section 16.4) |
| Section 14.2, 14.7 decision 25 | "An answered POST of an action moves the idle instant" (a 2xx) | Every answered POST of the operator except 401, of an action or through `live.client` (section 16.2) |
| Section 14.5, the mutation table | 114 changes | 127 (section 16.7); F48, F49, F50 re-written |

### 14.9 Rollback of the round

The pre-images of every file the round touched are under `.cache/rollback/W44-fix/` (git-ignored):
`source/` (the 13 files), `live/hooks.ts`, `live/index.ts`, `test/` (the seven test files of the
row and the two light-API test files).

```
# from /Users/gsp-budi/Documents/DEMS: back to the state the gate of D75 passed
cp .cache/rollback/W44-fix/source/*.ts packages/shared/src/live/source/
cp .cache/rollback/W44-fix/live/hooks.ts packages/shared/src/live/hooks.ts
cp .cache/rollback/W44-fix/test/live-source-*.test.ts .cache/rollback/W44-fix/test/live-light-platform-neutral.test.ts packages/shared/test/
# remove the three files the round added:
#   packages/shared/test/live-source-{resilience,local-end,misuse}.test.ts
```

After it the shared suite is the 64 files / 1,650 tests of the round's baseline, plus whatever the
typed client's row added meanwhile.

### 14.10 Limits of this evidence

- Everything is still proven on the fake transport and the fake clock. What the Core server
  answers to a revoked credential on REST, how soon it sends `session.ended` after an expiry, and
  whether a browser still presents its credential on a socket after a local end are observed first
  by the client rows' lane checks and by W58.
- "Red before" is established on a copy that holds the code before the round and today's tests.
  So that a test fails there for what the old code DOES, the tests of the round do not read the
  round's own constants (they hold the numbers as texts; the static test pins the constants to the
  same values). Seven of the 57 red tests are red only because a name did not exist before the
  round, and that is what they are about: the pinned export list and the constants test (the new
  names), the two tests of `useLiveSelector` (CPC1-13), the gate's `halt` (CPC1-7), the list of
  value-returning actions (CPC1-4), and the helper `isRefusal` (CPC1-5; the two static tests of
  CPC1-5 are the ones that fail on the old comparisons). The other 50 fail on an assertion about
  behaviour. `assets/44_fix_red_before_reasons.log` gives the first line of each failure: for
  example 24 session ends where one is expected (CPC1-1, the credential that stays), 3 ends at a
  cold start with a revoked credential, a probe every 2 s (CPC1-8), an action that stays
  `pending` (CPC1-2, CPC1-7, CPC1-20).
- CPC1-15 changes no behaviour; its evidence is the unchanged result of the 244 tests of the first
  delivery (one of them re-written by D80) and the mutation run.
- The idle instant the client reckons with is the server's only as far as the client saw the
  session's activity (F66-14), and the Live clock is the local clock plus the offset of the last
  `hello` or heartbeat.

---

## 15. What the briefs of W50 (web runtime) and W51 (mobile runtime) must now say

> **Replaced by section 17.4** (decision D90), which merges this section, section 16.6 and the
> re-review's notes a to j into one list. The text below is the record of the first fix round.

The six notes of the checkpoint (`gateway_check/07_cp_shared_client.md` section 9, a to f) stand.
After the round they read as follows, with what the round adds.

| # | For | Note |
|--:|---|---|
| 1 | W51 | `socket.headers()` is **synchronous** and is asked whenever a socket is opened: the first time when the source starts. Load the stored values BEFORE `createLiveSim`, or pass `autoStart: false` and call `start()` when they are loaded. If a socket was opened without the session's value all the same, the source asks for one new socket as soon as it knows the session; a second socket that still does not carry the session is reported (`live.socket`) and left alone |
| 2 | W51 | The credential provider of the typed client must not touch storage: it returns a value held in memory (CPC1-3 is the typed client's row; this note stands whatever that fix does) |
| 3 | W51, W56, W57 | The secrets port: `sessionCleared` and `deviceUnpaired` must have removed the value before they resolve; the socket is reopened right after. Every port call but `biometricToken` is given 5,000 ms (`LIVE_SECRETS_TIMEOUT_MS`), then it counts as failed and is reported. `deviceUnpaired` must be idempotent: it is called again (3 times at most, after 2 s, 4 s, 8 s) when the reopened socket still presents the old credential. After that the socket stays closed until the app deletes the credential and calls `live.reconnect('CREDENTIAL')` |
| 4 | W51 | Call `live.reconnect('RETRY')` when the app returns to the foreground with a STALE link (CPC1-19 of the socket client) |
| 5 | W50, W51 | `ready` resolves on `stop()` too and says nothing about the outcome: read `live.session`, `live.link` and the store after it |
| 6 | W50 to W57 | How to script the fake: F66-8 of section 10, and F66-16 of section 14.6 (answer by the credential the request presented; a connect script must not act on a socket the client already gave up: check `connection.state === 'CONNECTING'`) |
| 7 | W54 (the shell), W55 | **Lock and Sign out never do nothing** (D80). `actions.signOut('LOCK')` resolves also with the link down; the replica is empty at once; `live.lastSessionEnd` is `{ source: 'LOCAL', signOut: 'LOCK' or 'USER' }`. The shell reads its notice from `lastSessionEnd` (`useLiveSelector`), not from the outcome of the action: `signOut === 'LOCK'` → "Console locked"; `reason` `IDLE_EXPIRED` or `ABSOLUTE_EXPIRED` → "Session expired" (also with `source: 'LOCAL'`, when it expired while the link was down). `auth.status` has no value LOCKED (SIM-GAP-2) |
| 8 | W54, W55 | A sign-out the Core REFUSES (not 401) still rejects: show it. Only "no answer" ends locally |
| 9 | W50 | `stop()` settles every action that is out: an accepted one resolves, one without an answer rejects `LiveTransportError` with `code: 'STOPPED'`. Under React StrictMode the provider stops and starts the source once at mount (F66-7): nothing is in flight then, and a debt of a local end is sent again by the new run |
| 10 | W50, W51 | A store subscriber outside React that throws no longer freezes the replica: it is reported as `live.subscriber` (once a second at most) and the other subscribers are told. Write such subscribers so that they do not throw all the same |
| 11 | W55 and every call-site row | Take the actions from `useCoreActions()`. A call site that still reads a Live result as a value is reported once per action: `live.misuse`, `READ_AS_VALUE` (level `error`) for a read of `ok`; `NOT_OBSERVED` (level `warn`) for a value-returning action whose result nobody observed. A lane check of a call-site row should end with no `live.misuse` report of level `error`. A dropped value (`exportEvidence` in the wizard's first step, `verify` and `runDiagnostics` on mobile) is handed to `settle()` or gets a `.catch` |
| 12 | W50, W51, W54 | `useLiveSelector(read)` of `@dems/shared/live` reads `session`, `lastSessionEnd` and `auditChain`; name `LiveSim` as the parameter's type with a type-only import. Do not write a second `useSyncExternalStore` wrapper |
| 13 | The administration pages | **Replaced by section 16.6, row 13 (decision D84)**: call every operation that is no simulator action through `live.client.call(operationId, input)`; an answered POST of the operator there is activity, and no `actions.touch()` is needed |
| 14 | The web System page row | `exportLogs()` without a request is always 422 `INVALID_REASON` in Live mode (CPC1-22, decision 14): the row must collect a reason |

---

## 16. Follow-up after the fix round (decision D84)

The controller's gate on the fix round passed (decision D84). Decisions 19 to 33 stand until the
re-review has read them; `NOT_OBSERVED` as a `warn` and F66-15 are accepted. D84 asked for three
small follow-ups and one answer. All four are done; answering the question found one defect, which
is fixed (section 16.4).

| Item | Outcome |
|---|---|
| 1. Gap-ID collision | This row's marker is now **`CONTRACT-GAP-7`** (was `CONTRACT-GAP-4`, which is the typed client's): in the code (`live-sim.ts`, at `endLocally`), in the static test, in this log (every place, F66-13 included) and in the progress file. `CONTRACT-GAP-3` (`bindings.ts`) stays |
| 2. F66-14, ruled: fix it in the source | **`live.client` is an observed view of the typed client.** An answered POST of the signed-in operator through it counts as activity by the same function as an action's (`noteActivity`). ONE way for pages: `live.client.call(operationId, input)` (section 16.2) |
| 3. F66-12 (CPC1-16), recorded exception | One line changed in `src/realtime/live-socket-client.ts` (468: `export` added); this row's copy of the timer functions is deleted and the one source is imported (section 16.3). **CPC1-16 is now fixed: 17 of 17** |
| Question F66-18 | Answered in section 16.4. **A defect was found and fixed**: on a socket that is not the session's the expiry was never checked while the link was ONLINE, so an unattended console could show Core data of a session the Core no longer knows without a bound. The bound is now the idle instant |

| Field | Value |
|---|---|
| Files changed | `src/live/source/live-sim.ts`, `src/live/source/types.ts` (a comment); `src/realtime/live-socket-client.ts` (one line); tests `live-source-local-end.test.ts` (+12 tests), `live-source-platform-neutral.test.ts` (two tests re-written: the timers, the gap IDs) |
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0: **1,747 passed in 68 files** (14:34 WIB). Baseline of the follow-up: 68 files / 1,735 tests; this row adds 12 tests |
| The 28 files of `acaff20` | Unedited (identical hashes, `assets/44_followup_pre_state.txt`, `44_followup_post_state.txt`); alone: 28 files, 517 tests, exit 0 |
| The socket client's own tests | `test/realtime-live-socket.test.ts`, `test/realtime-live-platform-neutral.test.ts`: unedited (identical hashes) and green |
| `typecheck` of shared, core-web, mobile; `lint` of shared | exit 0, 0, 0; exit 0 |
| Red before, green after | **9 tests** fail on the code before the follow-up and pass on the tree (`assets/44_followup_red_green.log`) |
| Mutation re-run | **127 single changes, 127 detected**: the 114 of the fix round (3 re-written for the changed lines) and 13 over the follow-up's code (`assets/44_mutations.log`) |

### 16.1 Item 1: the gap ID

`CONTRACT-GAP-7`: the sign-out request knows the reasons USER and LOCK only, so a session this
client ended for its expiry, and that is still alive at the Core when the link returns, is signed
out as USER (finding F66-13; marker in the comment of `endLocally`, `live-sim.ts`). The static test
"CPC1-6: each local adapter carries its ID as a text a search finds" now expects exactly two
contract gaps in this folder: `bindings.ts: CONTRACT-GAP-3` and `live-sim.ts: CONTRACT-GAP-7`.

### 16.2 Item 2: activity through `live.client`

**The one way for pages.** An operation that is no simulator action (the lists and commands of the
two administration pages, and any read a page makes itself) is called through
`live.client.call(operationId, input)`. A page builds no typed client of its own: a request sent
around `live.client` is not seen by the source. The type of `live.client` is unchanged (`Client`,
the typed client's own type, with its typed operation IDs), so a dedicated entry was not needed
and `live.client` stays public.

**What the view is.** `live.client` is an object whose prototype is the client that was passed in
and whose own `call` hands the arguments to that client's `call` (called ON that client) and
returns **the very promise it returned**. On a branch of that promise the answer is given to
`noteActivity`. The view sends no request of its own, waits for nothing, blocks nothing (also not
while the link is down), and changes no result. Two things can be observed besides the activity:
`live.client !== options.client` (it is a view), and a promise the typed client rejects (a usage
error) is also reported as `live.client`; it still rejects for the caller.

**Exactly what counts** (one function for actions and for `live.client`; `live-sim.ts`, `noteActivity`):

| The answer to a POST sent as the signed-in operator | The touch period (CL-27) | The idle instant this client reckons with | Why |
|---|---|---|---|
| 2xx | Starts again; remembered activity is forgotten | Moves to now plus `AUTH_IDLE_TIMEOUT_MS` | The Core counted it (it reached its handler), so no touch is needed |
| Any other answer that has a status, except 401: 400, 403, 404, 409, 422, 423, 429, 5xx | **Unchanged** | **Moves** all the same | See below |
| 401 | Unchanged | Unchanged | The Core named no session: there is nothing whose activity could have moved |
| No answer (no connection, a time-out) | Unchanged | Unchanged | Nothing is known. This is "the same while OFFLINE counts nothing" |

Not counted at all: a GET (ID-P9); a call while nobody is signed in (on a tablet the request then
carries the device credential, which is no operator); an answer that arrives after the session
that sent the request ended, or after `stop()`.

**Why a refused POST moves the instant but does not restart the touch period.** The ruling
defines activity as "a POST of an operator that reached the server: 2xx and 4xx other than 401".
The identity row's code is narrower: `apps/core-server/src/plugins/authenticate/index.ts:41-44`
and `:257-258` record activity in a `preHandler` hook, "after the access rule and the validation,
so a POST that was refused or malformed is not activity" (and `signIn` and `signOut` are exempt,
`:150`). A client cannot tell from a status whether a 4xx was produced before the handler (a 403
of the access rule, a 422 of the schema) or by it (a 409 of the engine, a 422 with
`details.simCode`). So the two halves of the activity state take the two safe sides:

- **The idle instant must never come early** (the ruling's requirement), so every answer that may
  have reached the handler moves it. Where the Core did not count the POST, the client's instant
  is later than the Core's, by less than the idle time-out, never beyond the absolute expiry, and
  it matters only while the Core cannot say so. It is also what the local check is for: a refused
  POST still shows that an operator was at the console at that moment.
- **The touch must never be left out wrongly**, so only a 2xx restarts the touch period. After a
  refused POST the remembered activity is still reported by a touch, and the touch's answer names
  the Core's own idle expiry, which replaces the client's reckoning (`activityAt` is cleared).

This rule also changes the actions: before the follow-up only a 2xx of an action moved the
instant, so an action the Core refused with a state conflict (which the Core counts) left the
client's instant early.

Tests, all in `test/live-source-local-end.test.ts`, describe "D84: an answered POST of the
operator through `live.client` is activity, as an action's is (F66-14)":

| Test | Red before / green after |
|---|---|
| "a POST at minute 14 moves the idle instant from minute 15 to minute 29" | red / green |
| "a POST the Core refuses (403) counts too: the operator was at the console, and the instant must not come early" | red / green |
| "an ACTION the Core refuses with a state conflict (409) counts by the same rule" | red / green |
| "a GET does not count: the instant stays minute 15" | green / green (a guard) |
| "a POST answered 401 does not count: the Core named no session" | green / green (a guard) |
| "the same POST while the Core cannot be reached counts nothing: there is no answer" | green / green (a guard) |
| "an answer that arrives for an earlier session counts nothing for the next one" | green / green (a guard) |
| "the touch period: a 2xx POST through `live.client` restarts it (the Core counted it), a refused one does not (a touch is still owed)" | red / green |
| "the view is transparent: the very promise of the typed client, its arguments, its other members; no request of its own" | red / green (before, `live.client` was the client itself) |
| "a promise the typed client rejects still rejects for the caller, and is reported as live.client" | red / green |

The four guards are green before because the code before the follow-up looked at no page call at
all; each is held by a mutation (H02, H03, H04, H08).

### 16.3 Item 3: one copy of the platform's timer functions

| | |
|---|---|
| The one line | `packages/shared/src/realtime/live-socket-client.ts:468`: `const DEFAULT_TIMERS: LiveSocketTimers = {` became `export const DEFAULT_TIMERS: LiveSocketTimers = {`. `git diff --stat` against the pre-image: 1 insertion, 1 deletion; nothing else in the file |
| The name | **It stays `DEFAULT_TIMERS`**, not `LIVE_SOCKET_DEFAULT_TIMERS` as the ruling suggested: the file's own static test reads the text `const DEFAULT_TIMERS: LiveSocketTimers = {` (`test/realtime-live-platform-neutral.test.ts:110`) and line 523 of the file uses the name. With another name a second line of the file and a line of that test would have had to change, against "only line 468" and "its tests unedited". This folder imports it under the suggested name: `import { DEFAULT_TIMERS as LIVE_SOCKET_DEFAULT_TIMERS, … } from '../../realtime/live-socket-client'` |
| `realtime/index.ts` | **Not edited.** It exports the socket client with `export * from './live-socket-client'` (line 2), so `DEFAULT_TIMERS` is exported by `@dems/shared/realtime` too, by that line. This folder imports the socket client by its file, never through that barrel |
| Pinned export lists | No `realtime-*` test pins the names the folder exports (searched: no list names `createLiveSocketClient`); no line of such a test changed. The root entry `src/index.ts` exports the heartbeat client and the formatter by name, so it is unaffected |
| This folder | The six lines of `DEFAULT_TIMERS` in `live-sim.ts` are deleted; `createLiveSim` takes `options.timers ?? LIVE_SOCKET_DEFAULT_TIMERS`. No file of `src/live/source` calls a timer function of the platform any more |
| Test | `platform-neutral`: "the clock and the timers are injected: the local clock is named once, as the default of createLiveSim, and NO file of the folder calls a timer function of the platform (CPC1-16, F66-12)" (red before / green after), with a positive control that finds the four functions in the socket client |
| The other pair (`isThenable`) | Unchanged, as the reviewer accepted: `live/settle.ts` and `live-result.ts` both state "no import" |

### 16.4 The answer to F66-18

**The case.** The replica says signed in; the socket is lost and the next `hello` names a principal
other than OPERATOR and gives no reason.

**What happens.**

| Step | What the source does | Bound |
|---|---|---|
| 1 | It is not an end: the specification names `SESSION_INVALID` as the only `hello` that ends a session ([CS:§6.5]) | — |
| 2 | CPC1-9: ONE new socket is asked for, one promise job later | Once per session (`socketAsked`; cleared only by an OPERATOR `hello`, a new session or a session end) |
| 3 | When that socket is no OPERATOR socket either: one `error` report (`live.socket`: "the session is known, and the socket the app opens does not carry it") and nothing more | One report per such `hello`; the source opens no further socket. Later sockets are the socket client's own reconnects after a lost link |
| 4 | The store keeps the last Core data and `auth` stays SIGNED_IN; the link reads ONLINE (the socket has heartbeats); no state message arrives on it | See below |

**How long the Core data can stay for a session the Core no longer knows.**

| Situation | Bound |
|---|---|
| An operator is at the console | The next answered POST: an action, or the touch. The first activity sends a touch at once when no touch period is open, else at the end of the period: at most 60 s (`LIVE_TOUCH_INTERVAL_MS`) plus the request. The 401 ends the session (`source: 'REST'`) and clears the replica |
| Nobody is at the console | **The idle instant this client reckons with**: at most `AUTH_IDLE_TIMEOUT_MS` (15 minutes) after the last activity it counted, and never beyond the absolute expiry. The same bound as with the link down |

**The defect this question found.** Before the follow-up the second bound did not hold: the local
check (D80) ended a session only "while the link is not ONLINE", and in this case the link IS
ONLINE, on a socket that will never carry `session.ended`. An unattended console then showed the
last Core data without a bound. Fixed: the check asks whether the Core would tell (the link is
ONLINE **and** the socket is an OPERATOR socket); when it would not, the session ends here at its
instant (`reason: IDLE_EXPIRED` or `ABSOLUTE_EXPIRED`, `source: 'LOCAL'`).

Tests, `test/live-source-local-end.test.ts`, describe "F66-18 …": "the link returns ANONYMOUS
without a reason while signed in: one new socket, one report, no loop; an unattended console ends
at its idle instant, not later" (red before / green after) and "with an operator at the console
the bound is the next answer: the touch is refused 401 and the session ends at once" (green
before too: that half held). Mutation H13.

Not built, and left to the controller (decision 36): asking `getAuthSession` once when the second
socket carries no session either. A 401 would end the session at once instead of at the idle
instant; a 200 would confirm that the app's two credential providers disagree. It costs one
request, and the bound above holds without it.

### 16.5 The public API after the fix round and the follow-up (the final list)

Nothing was removed and no signature narrowed. `CreateLiveSimOptions` and `LiveSecretsPort` are
unchanged in type; `LiveSim` has the same 30 members with the same types. Rows 1 to 12 are those
of section 14.3; rows 13 to 16 are the follow-up's.

| # | Kind | Change |
|--:|---|---|
| 1 | Behaviour | `actions.signOut(reason)`: a local end when the link is not ONLINE or the request gets no answer; it rejects only for a refusal other than 401 |
| 2 | Type, one value added | `LiveSessionEndSource` has `'LOCAL'` |
| 3 | Behaviour | `stop()` settles every action that is out (resolve when accepted; reject with `code: 'STOPPED'`) |
| 4 | Behaviour | `store.subscribe`: a listener or selector that throws is contained and reported (`live.subscriber`) |
| 5 | Behaviour | `reconnect('CREDENTIAL')` and `setPairing(pairing)` also end a remembered revocation |
| 6 | Behaviour | The result of the 14 value-returning actions has a hidden, not enumerable member `ok` that reports its read |
| 7 | New values | `LIVE_SESSION_PROBE_RETRY_MAX_MS`, `LIVE_HELD_MESSAGES_MAX`, `LIVE_SECRETS_TIMEOUT_MS`, `LIVE_DEVICE_CLEANUP_RETRY_MS`, `LIVE_DEVICE_CLEANUP_RETRIES`, `LIVE_SUBSCRIBER_REPORT_INTERVAL_MS`, `LIVE_STOPPED_CODE`, `LiveMisuse`, `LIVE_VALUE_ACTION_NAMES`, `LIVE_RESULT_DISCRIMINANT`, `envelopeSimCodeOf`, `isRefusal` |
| 8 | New types | `LiveResultHooks`, `LiveMisuse` |
| 9 | Type made stricter | `ENVELOPE_SIM_CODE` is keyed by the contract's `ApiErrorCode` |
| 10 | Optional additions | `createLiveResult(report, hooks?)` and its two siblings; `CommandGate.halt()`; `CommandGateOptions.maxHeld?`, `overflow?` |
| 11 | New report sources | `live.subscriber`, `live.misuse`, `live.session`, `live.store`, `live.structuralSharing`, `live.owed`, `live.status`, `live.permission`, `live.touch`, `live.expiry`, `live.cleanup`; `live.secrets` for a time-out and a credential that stays; **`live.client` now also for a promise of the typed client that rejects through `live.client`** |
| 12 | Light API | `useLiveSelector(read)` |
| **13** | **Behaviour (D84)** | **`live.client` is an observed view of the typed client that was passed in**: the same type, the same results, errors and timing; `live.client !== options.client`, and `Object.getPrototypeOf(live.client)` is that client. An answered POST of the signed-in operator through it counts as activity |
| **14** | **Behaviour (D84)** | **The activity rule, for actions too**: every answered POST except 401 moves the idle instant the client reckons with (before: a 2xx only); only a 2xx restarts the touch period (unchanged) |
| **15** | **Behaviour (F66-18)** | **A local expiry also ends the session while the link is ONLINE on a socket that is not an OPERATOR socket** |
| **16** | **Export of another folder (recorded exception)** | `src/realtime/live-socket-client.ts` exports `DEFAULT_TIMERS`; through `realtime/index.ts:2` so does `@dems/shared/realtime` |

The follow-up adds no name to `@dems/shared/live/source` (56 names, pinned) and none to
`@dems/shared/live`.

### 16.6 For the briefs of W50, W51 and the administration page rows

> **Replaced by section 17.4** (decision D90). Row 15 below was overruled (CPC1-32): a page's call
> through `live.client` now gets the full CL-23.

Section 15 stands, with these changes.

| # | For | Note |
|--:|---|---|
| 13 (replaces row 13 of section 15) | **The administration page rows** (users and roles; paired devices), and any page that calls an operation that is no simulator action | Call it through **`live.client.call(operationId, input)`**, read with `useLive<LiveSim<…>>()` or `liveOf`. Never build a typed client in a page, and never keep the client the runtime built: only `live.client` is seen by the source. Nothing else is needed: no `actions.touch()` after a POST. The answer is the typed client's own (`ok`, `status`, `error.code`, `retryAfterSeconds`, `transport`), not a rebuilt simulator error: the page maps it itself |
| 15 | The administration page rows | What the source does NOT do for a call through `live.client`: it does not end the session on a 401, it does not refresh the permission hint on a 403, and it does not refuse the call while the link is down. A 401 there means the session is gone: the `session.ended` of the socket, or the local expiry, ends it; the page shows the refusal meanwhile. (An option for the controller: decision 35) |
| 16 | W50, W51 | Pass ONE typed client to `createLiveSim` and hand the pages `live.client`, not that client. `live.client !== client`; do not compare them |
| 17 | W50, W51, W54 | A session can now also end here while the link reads ONLINE: when the socket is not the session's (F66-18). The shell's notice is the same as for every local expiry (`lastSessionEnd.source === 'LOCAL'`, `reason` `IDLE_EXPIRED` or `ABSOLUTE_EXPIRED`) |
| 18 | W51 | A `live.socket` report of level `error` that says "the session is known, and the socket the app opens does not carry it" means the socket's `headers()` and the typed client's credential provider returned different credentials: fix the app's storage loading (row 1 of section 15) |

### 16.7 Verification

**Gate on the finished tree** (`assets/44_followup_gate.log`; from `/Users/gsp-budi/Documents/DEMS`, no `cd`):

```
# Step 66 (W44), follow-up after the fix round (decision D84): final gate
## 2026-10-04 14:34:47 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1747 passed (1747)
   Start at  14:34:47
   Duration  7.51s (tests 56%, import 34%, transform 9%, worker 1%)
exit=0
## 14:34:54 the 28 test files that exist at acaff20 (git ls-tree -r acaff20 --name-only packages/shared/test), alone
 Test Files  28 passed (28)
      Tests  517 passed (517)
exit=0
## 14:34:57 the ten files of this row, alone (every test name is in 44_followup_tests_verbose.log)
 Test Files  10 passed (10)
      Tests  323 passed (323)
exit=0
## 14:35:00 the live socket client's own test files, unedited, alone
 Test Files  2 passed (2)
      Tests  130 passed (130)
exit=0
## 14:35:01 $ npm run typecheck -w @dems/shared       > tsc --noEmit    exit=0
## 14:35:04 $ npm run lint -w @dems/shared            > oxlint          exit=0
## 14:35:04 $ npm run typecheck -w @dems/core-web     > tsc -b          exit=0
## 14:35:14 $ npm run typecheck -w @dems/mobile       > tsc --noEmit    exit=0
```

No source file of the row was edited after 14:26:21 and no test file after 14:26:21.

**Test ledger (P24).** `@dems/shared`: 68 files / 1,735 tests before the follow-up, 68 files /
1,747 after. All 12 new tests are in `live-source-local-end.test.ts` (18 to 30): 10 for D84
item 2 and 2 for F66-18. Two tests of `live-source-platform-neutral.test.ts` were re-written (the
timers; the gap IDs), so its count stays 19. The row's ten files: 311 to 323.

**Red before, green after** (`assets/44_followup_red_green.py`, `44_followup_red_green.log`): the
copy holds `src/live/source` and `src/realtime/live-socket-client.ts` as they were before the
follow-up.

```
$ python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_followup_red_green.py
BEFORE (the code before the follow-up, today's tests): exit 1 | 9 failed | 295 passed (304)
AFTER  (the tree):                                     exit 0 | 304 passed (304)

## Red before, green after: 9
…
## Not green after: 0
## Green before and after (tests that existed, and tests that only guard the new code): 295
```

**Mutation re-run** (`assets/44_mutations.log`):

```
# Step 66 (W44), follow-up after the fix round (decision D84): mutation run on an isolated copy (.cache/w44/mut/shared), 2026-10-04 14:26:45 WIB
$ python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_mutate.py
M00 no change | exit 0 | 304 passed (304)
…
mutations: 127, killed: 127, survived: 0 []
exit=0
# finished 14:34:00 WIB
```

| Group | Changes |
|---|--:|
| The 114 of the fix round (F48, F49, F50 re-written for the changed lines) | 114 |
| D84 item 2, H01 to H12 | 12 |
| F66-18, H13 | 1 |

**Each client's compiler options** (`assets/44_client_probe.log`): the web probe now also calls an
administration POST through `live.client`. Web: exit 0. Mobile: exit 0. Negative
controls: exit 2 for both.

### 16.8 Findings and decisions of the follow-up

| ID | Finding | Evidence | Proposed action |
|---|---|---|---|
| F66-19 | The ruling's wording of activity ("2xx and 4xx other than 401") is wider than what the identity row built: the Core counts a POST only when it reached its handler, so a POST refused by the access rule or malformed is no activity, and `signIn` and `signOut` are exempt | `apps/core-server/src/plugins/authenticate/index.ts:41-44, 150, 257-258` | None in the client: section 16.2 takes the safe side for each half. If the instant must be exact, the contract could carry the Core's own idle expiry in a response header of every operator POST; then the client stops reckoning |
| F66-20 | The export of item 3 keeps the name `DEFAULT_TIMERS`, and `@dems/shared/realtime` now exports it through `export *` | Section 16.3 | The owner of `src/realtime` may rename it together with its own test and line 523 |

| # | Left open by | What was built | Why |
|--:|---|---|---|
| 34 | D84, item 2 | A refused POST (any status but 401) moves the idle instant; only a 2xx restarts the touch period | Never early for the instant; never a touch left out (section 16.2, F66-19) |
| 35 | D84, item 2 | The view counts activity and does nothing else: no session end on a page's 401, no permission refresh on its 403 | "It must not change the client's results, errors or timing, must not send anything extra"; a permission refresh is a request. The controller may widen it to the full CL-23 |
| 36 | F66-18 | No extra `getAuthSession` when the second socket carries no session either; the idle instant is the bound | It would be a new request; the bound holds without it |
| 37 | D84, item 3 | The exported name is `DEFAULT_TIMERS`; `realtime/index.ts` is not edited | Section 16.3 |

### 16.9 Rollback of the follow-up

Pre-images under `.cache/rollback/W44-followup/` (git-ignored): `source/` (the 13 files),
`test/` (the ten test files of the row), `live-socket-client.ts.pre`, `realtime-index.ts.pre`.

```
# from /Users/gsp-budi/Documents/DEMS: back to the state the gate of D84 passed
cp .cache/rollback/W44-followup/source/*.ts packages/shared/src/live/source/
cp .cache/rollback/W44-followup/test/live-source-*.test.ts packages/shared/test/
cp .cache/rollback/W44-followup/live-socket-client.ts.pre packages/shared/src/realtime/live-socket-client.ts
```

### 16.10 Limits of this evidence

- As before, everything is proven on the fake transport and the fake clock.
- What the Core counts as activity was read in the identity row's code (F66-19), not observed:
  the first run against the Core server (W58) shows whether a refused POST leaves the Core's idle
  expiry where it was.
- A page that sends a request around `live.client` is not seen; no test of this row can hold
  that. The static test of the client rows should forbid `createCoreClient` outside the runtime.

---

## 17. Second fix round after the re-review (decision D90)

Source: the section "Re-review of the fix rounds" appended to `gateway_check/07_cp_shared_client.md`
(R0 to R5: PASS WITH FIXES; 10 new findings, 0 Blocker, 0 High, 2 Medium, 5 Low, 3 Info, all
established by reading) and the controller's decision D90 with three binding rulings: decision 35
is overruled (CPC1-32), decision 21 is overruled in part and decision 24 amended (CPC1-23), and
CPC1-24 is a port, not a residual.

**Result: the seven findings that ask for code are fixed, each with tests that are red on the code
before the round and green on the tree; the three that ask for notes are answered, one of them
with the one report code it asks for.** Both Medium defects were reproduced before they were fixed.

| Field | Value |
|---|---|
| Files changed | `src/live/source/live-sim.ts`, `types.ts`, `index.ts`; tests `live-source-local-end.test.ts` (re-written around a model of the Core's session: 30 to 54 tests), `live-source-resilience.test.ts` (+3), `live-source-platform-neutral.test.ts` (+1), `live-source-session.test.ts` (two tests re-written) |
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0: **1,775 passed in 68 files** (15:56 WIB). Baseline of the round: 68 files / 1,747 tests; this row adds 28 tests |
| The 28 files of `acaff20` | Unedited (identical hashes, `assets/44_round2_pre_state.txt`, `44_round2_post_state.txt`); alone: 28 files, 517 tests, exit 0 |
| `typecheck` of shared, core-web, mobile; `lint` of shared | exit 0, 0, 0; exit 0 |
| Red before, green after | **37 tests** fail on the code before the round and pass on the tree (`assets/44_round2_red_green.log`) |
| Mutation check, over the code this round changed only | **46 single changes, 46 detected** (`assets/44_round2_mutations.log`). The first run detected 42; the four survivors showed four tests that asserted too little, which were strengthened (`44_round2_mutations_run1.log`; section 17.6) |
| Platform neutrality | The new storage is INJECTED: no file of the folder names a storage of the platform, comments included (static test) |
| Gap numbers | `CONTRACT-GAP-7` is **withdrawn**: since this round no sign-out is ever sent for an expiry, so the adapter it marked no longer exists. The folder holds one open contract gap, `CONTRACT-GAP-3`. No new gap number was needed |

### 17.1 Outcome per finding

Test files are `packages/shared/test/live-source-<name>.test.ts`.

| Finding | Outcome | What changed | Tests | Red before / green after |
|---|---|---|---|---|
| **CPC1-23** Medium | **Fixed, as the reviewer specifies and the controller rules** | (a) RESYNCING on the session's OPERATOR socket counts as "the Core would tell": no local end on that link change. (b) When the reckoned instant passes, **the Core is asked** (`getAuthSession`): a session → its instants are taken; 401 → the session ends with the expiry as its reason (`source: 'REST'`), nothing owed; no answer while the Core would tell → nothing ends, asked again; no answer and the Core would not tell → the local end of DR-11. (c) **A debt is never paid blindly**: it names its session (operator and `issuedAt`), and before anything is sent the Core is asked which session the credential names now (section 17.2) | `local-end`, describes "the debt is never paid blindly" (8 tests) and "the expiry this client reckons with …" (10 tests), among them the controller's four: "two tabs: the operator works in tab B; tab A's reckoned instant passes while ONLINE: A asks, takes the Core's instant and does not end; a blip of A's link afterwards ends nothing; tab B stays signed in"; "a lost answer: …"; "a NEW sign-in while a debt exists (another tab): the debt is dropped, no sign-out is sent, and the new session lives"; "the offline local end still works as ruled: …" | 10 red / 10 green; 8 guards (rules that held before, re-proven on the model) |
| **CPC1-24** Medium | **Fixed: the optional port `owedSignOut`** | `CreateLiveSimOptions.owedSignOut?: LiveOwedSignOutPort` (`read`, `write`, `clear`; section 17.3). The debt is written at the local end before the end is reported, read at a start before any session is asked for, and settled first. A stored value that is no debt is dropped. Every call is bounded (5,000 ms); a storage that fails once is reported once and not asked again | `local-end`, describe "the debt of a local end survives a reload …" (11 tests), among them "a reload after an offline Lock (a new source, the same credential, the same storage): the session is NOT taken, and the sign-out is sent once"; "a second tab that finds a debt for the credential's session pays it rather than taking the session"; "a stored debt for ANOTHER session is dropped …"; "a storage that throws is "no persistence": ONE report …"; "a storage that never answers: after 5,000 ms the start goes on without it, with one report"; `platform-neutral`: "CPC1-24: the storage of the debt is injected …" | 11 red / 11 green; 1 guard ("without a storage the behaviour is as before") |
| **CPC1-32** Low, ruling | **Fixed as ruled: decision 35 is overruled** | The view of `live.client` hands every answer of a signed-in operator's call to the same function the actions use (`inspect`): a 401 `NOT_SIGNED_IN` ends the session, a 403 `DEVICE_REVOKED` ends the pairing, a 403 `NOT_PERMITTED` or `FORBIDDEN` starts the one debounced permission refresh, and the activity rule stays. The one exemption stays: the view refuses nothing while the link is down (CL-22 is the actions') | `local-end`, describe "a page's call through `live.client` gets the full CL-23, and not CL-22": "a page's 401 ends the session exactly as an action's 401 does" (the two ends are compared member by member); "a page's 403 NOT_PERMITTED causes exactly one debounced permission refresh; ten of them cause one"; "a page call while the link is down is NOT refused by the view: the request goes out, and the page gets the typed client's own transport error" | 2 red / 2 green; 1 guard (the exemption held before) |
| **CPC1-25** Low | **Fixed** | Every runner takes the session generation (`era`) before it sends, and its answer is looked at only when the generation is the same (`inspectFor`). A sign-out's answer ends, or ends locally, only the session it was sent for. The action itself still settles with its own answer | `local-end`, describe "an answer is held to the session that sent the request": "an action's 401 that arrives after that session ended and another one signed in ends nothing and counts nothing"; "the answer to a sign-out that arrives after that session ended and another one signed in does not end the new session"; "an answer through `live.client` …" | 2 red / 2 green; 1 guard |
| **CPC1-26** Low | **Fixed** | What a port of the app throws is reported by a fixed text, the port's name, where it was called and the NAME of the error: never its message, never its stack. An action whose port failed (`sessionIssued`, `devicePaired`, `biometricToken`) rejects with `CoreRefusalError` (`NOT_AVAILABLE`), not with the port's own error. The same holds for the new storage | `resilience`, describe "nothing of what the storage of the app throws travels …": three tests with a marker text in the port's error, looked for in every report, in `errors()`, in the ends and in the rejection; `session`: "a port of the app that throws is reported, and the socket is still reopened", "a credential the app could not store rejects the action with a fixed error, never with the app's own (CPC1-26)"; `local-end`: "a storage that throws is "no persistence" …" | 5 red / 5 green |
| **CPC1-31** Low | **Fixed: it fails closed, for LOCK and for USER** | A sign-out the Core refuses (any answer but 2xx and 401): the action resolves, the console is signed out or locked here (a local end), the refusal is reported (`live.session`, level `error`), and the debt stays owed. A refused payment of a debt: the debt stays, the session is never taken again, the payment is tried again with the back-off, and the refusal is reported once for that debt. **A USER sign-out does the same as a LOCK**: an operator who asked to be signed out is signed out here, whatever the Core answers | `local-end`, describe "a sign-out the Core refuses fails closed": "signOut(LOCK / USER) refused with 403: the action resolves, the console is signed out here, the debt stays owed and is asked again with back-off; the session is never taken again" | 2 red / 2 green |
| **CPC1-30** Info | **One report code added**, as asked | The report that the device clean-up gave up carries `context.code: 'DEVICE_CLEANUP_GAVE_UP'` (exported as `LIVE_DEVICE_CLEANUP_GAVE_UP_CODE`), so the mobile runtime can find it in its `onError` sink. The state it sees beside it is the reviewer's note j: `link === 'OFFLINE'` and `socketStatus().end?.kind === 'DEVICE_REVOKED'` | `resilience`: "a deviceUnpaired that throws and leaves the credential …" (now also asserts the code and that state) | 1 red / 1 green |
| **CPC1-27** Low | **Note; no code** | Section 17.5 | — | — |
| **CPC1-28** Info | **Note; not this row's** | The package exports two constants named `DEFAULT_TIMERS` (`sim/platform.ts:187`, `realtime/live-socket-client.ts:468`). The rename of the second belongs to the owner of `src/realtime`, with its own static test and line 523 (decision 37; D84 allowed one line) | — | — |
| **CPC1-29** Info | **Note for the mobile briefs**; one sentence added to the port's comment in `types.ts` | Section 17.4, row 13 | — | — |

### 17.2 The debt of a local end, and how it is settled (CPC1-23 c, CPC1-24, CPC1-31)

A local end leaves a debt: `{ operatorId, issuedAt, reason, at }`. `operatorId` and `issuedAt` are
what the Core's own `getAuthSession` says about the session, so the same two members name it again
later; the contract has no other session identifier a client may hold, and none is needed. The
record holds no credential.

The debt is settled as soon as an OPERATOR socket appears, and at a start that finds one in the
storage. Meanwhile the socket is not taken: its state is held back (256 messages at most) and
nothing of it is shown. The Core is asked `getAuthSession`, and the first matching row decides:

| What the Core answers | The debt | Then |
|---|---|---|
| No answer; an answer that says nothing about the session (a 403, a 5xx) | Stays | Asked again after 2 s, 4 s, 8 s … 30 s, never inside a `retry-after` |
| 401 | Dropped: the session is over already | Signed out; the socket is replaced |
| A session of another operator, or with another `issuedAt` | Dropped: a new sign-in happened, in this tab or another, and the debt was never owed for that session | That session is taken, as after any probe |
| The same session; the debt is an EXPIRY this client reckoned; by the Core's own clock (`serverTime` against its two instants) the session has not expired | Dropped: the reckoning was early | The session is taken again |
| The same session; an EXPIRY; by the Core's own clock its instant has passed | Stays | Asked again: the Core ends it itself. **No sign-out is ever sent for an expiry** |
| The same session; USER or LOCK | **Paid**: `signOut` with that reason | 2xx or 401: dropped, signed out, the socket is replaced. No answer: asked again (from the top). A refusal: fails closed (CPC1-31) |

Also: a socket that is no OPERATOR socket ends the debt without a question (the credential names
no session; on a tablet the app dropped the session token at the local end); the answer of a
successful sign-in ends the debt; no question and no payment is sent while a sign-in is out; and
the end of the socket while the debt is being settled is not told as a second end.

Three things in this table go beyond the texts of the ruling, and are decisions for the controller
(section 17.7): an expiry is never signed out at all (so the audit trail gets no user sign-out
that no user made, and `CONTRACT-GAP-7` is gone); an expiry whose session the Core still holds is
taken again, and the tab does not stay signed out; a refused USER sign-out fails closed like a LOCK.

### 17.3 The final public API change list

Nothing was removed and no signature was narrowed in any round. `LiveSim` has the same 30 members
with the same types; `LiveSecretsPort` has the same 5 members. `CreateLiveSimOptions` gained ONE
optional member in this round. Rows 1 to 16 are sections 14.3 and 16.5; rows 17 to 23 are this
round's; rows 1, 13, 14 and 15 are restated as they stand now.

**The new port, exactly** (`packages/shared/src/live/source/types.ts`):

```ts
export interface LiveOwedSignOut {
  /** The operator of the session the debt is for (`AuthSessionInfo.operator.id`). */
  readonly operatorId: string;
  /** When the Core issued that session (`AuthSessionInfo.issuedAt`). With the operator it names one session. */
  readonly issuedAt: EpochMs;
  /** USER, LOCK: the operator asked for it. IDLE_EXPIRED, ABSOLUTE_EXPIRED: this client reckoned it. */
  readonly reason: SignOutReason | typeof SessionEndedReason.IDLE_EXPIRED | typeof SessionEndedReason.ABSOLUTE_EXPIRED;
  /** When the session ended here, on the Live clock. */
  readonly at: EpochMs;
}

export interface LiveOwedSignOutPort {
  read(): LiveOwedSignOut | null | Promise<LiveOwedSignOut | null>;
  write(debt: LiveOwedSignOut): void | Promise<void>;
  clear(): void | Promise<void>;
}

export interface CreateLiveSimOptions<Client extends LiveClient = LiveClient> {
  // … every member as before …
  /** Web: where the debt of a local end is kept across a reload (CPC1-24). Shared by the tabs of one origin. */
  readonly owedSignOut?: LiveOwedSignOutPort;
}
```

| # | Kind | Change as it stands now |
|--:|---|---|
| 1 | Behaviour | `actions.signOut(reason)` **always resolves when somebody is signed in**: with the link down, without an answer, and since this round also when the Core refuses it (CPC1-31). In each of those cases the session ends here (`source: 'LOCAL'`) and a debt is kept. It rejects in no case but a `stop()` while it is out |
| 2 | Type, one value added | `LiveSessionEndSource` has `'LOCAL'` |
| 3 | Behaviour | `stop()` settles every action that is out |
| 4 | Behaviour | `store.subscribe`: a listener or selector that throws is contained and reported |
| 5 | Behaviour | `reconnect('CREDENTIAL')` and `setPairing(pairing)` also end a remembered revocation |
| 6 | Behaviour | The result of the 14 value-returning actions has a hidden member `ok` that reports its read |
| 7 | New values | The twelve of section 14.3, row 7, and **`LIVE_DEVICE_CLEANUP_GAVE_UP_CODE`** (`'DEVICE_CLEANUP_GAVE_UP'`). The subpath exports 57 names (pinned) |
| 8 | New types | `LiveResultHooks`, `LiveMisuse`, and **`LiveOwedSignOut`, `LiveOwedSignOutPort`** |
| 9 | Type made stricter | `ENVELOPE_SIM_CODE` is keyed by the contract's `ApiErrorCode` |
| 10 | Optional additions | `createLiveResult(report, hooks?)` and its siblings; `CommandGate.halt()`; `CommandGateOptions.maxHeld?`, `overflow?`; **`CreateLiveSimOptions.owedSignOut?`** |
| 11 | Report sources | As section 16.5, row 11. **Changed**: every `live.secrets` report now has a fixed text, `context.port` and `context.errorName` (or `timedOut`), and never the port's own message or stack; the port names of the new storage are `owedSignOut.read`, `owedSignOut.write`, `owedSignOut.clear`. New: `live.owed` (level `warn`: a stored debt that cannot be read) |
| 12 | Light API | `useLiveSelector(read)` |
| 13 | Behaviour | `live.client` is an observed view of the typed client (same type; `live.client !== options.client`; `Object.keys(live.client)` is `['call']`). **Since this round its answers get the full CL-23**: a 401 ends the session, a 403 `DEVICE_REVOKED` ends the pairing, a 403 `NOT_PERMITTED` or `FORBIDDEN` causes one debounced `getAuthSession`. It still refuses nothing while the link is down |
| 14 | Behaviour | The activity rule (section 16.2), for actions and for `live.client` |
| 15 | Behaviour | **Changed**: an expiry is not decided on the client's reckoning while the Core can be asked. At the reckoned instant the source sends one `getAuthSession`. The session ends here by itself (`source: 'LOCAL'`) only when the Core cannot be asked and would not tell (the link is down, or the socket is not the session's OPERATOR socket). An expiry the Core confirms ends with `source: 'REST'` |
| 16 | Another folder | `src/realtime/live-socket-client.ts` exports `DEFAULT_TIMERS` |
| **17** | **Behaviour** | **A debt is never paid blindly** (section 17.2). New requests the source can send by itself: `getAuthSession` before a debt is settled and at a reckoned instant |
| **18** | **Behaviour** | **After a local EXPIRY the session can come back without a sign-in**: when the Core, asked, still holds the same session, `auth` turns SIGNED_IN again. After a LOCK or a sign-out it never does |
| **19** | **Behaviour** | **RESYNCING on the session's socket is no lost link** for the expiry |
| **20** | **Behaviour** | **An action's answer is held to the session that sent the request**: after that session ended, its late answer ends nothing and counts nothing; the action still settles with it |
| **21** | **Behaviour** | **An action whose storage port failed rejects with `CoreRefusalError('NOT_AVAILABLE')`**, not with the port's own error (`pair`, `signIn`, `signInWithBiometric`) |
| **22** | **Behaviour** | With `owedSignOut`, a start reads the storage before it asks for the session; `ready` resolves as before (at the latest after the boot time-out) |
| **23** | **Withdrawn** | `CONTRACT-GAP-7`: nothing in the code any more |

### 17.4 The notes for the briefs of W50, W51 and the page rows: ONE list

This list replaces section 15, section 16.6 and the notes a to j of the re-review (R5). Each row
says where it comes from.

**Updated in the third round (decision D100; section 18.4).** Rows 2, 7, 16, 22, 23 and 27 were
changed and rows 28 to 34 added: the four additions of the third pass of the review (T5 a to d)
and what the round's fixes change for the runtimes. Every row keeps its number; the new rows
stand in the group they belong to. This is the list as it stands, and the only one.

**The web runtime (W50)**

| # | Note | From |
|--:|---|---|
| 1 | Build ONE typed client, pass it to `createLiveSim`, and hand the pages `live.client`, never that client. `live.client !== client`: do not compare them. `Object.keys(live.client)` is `['call']`: do not copy it by spread, the other members would be lost | 16.6-16; R5-i |
| 2 | **Pass `owedSignOut`, backed by the origin's `localStorage`** (one key, for example `dems.live.owedSignOut`). **All three calls must be synchronous**: each has done its work when it returns. Only then does "a reload cannot forget a local Lock" hold; with a call that returns a promise, a reload while `write` is out forgets the Lock (the source then only keeps the calls in order). `read` returns `null` when the key is absent, and ONLY then: when the stored text does not parse, or the storage throws, `read` must THROW (do not catch it and return `null`), and the start is then closed (row 28). `write` stores exactly the four members it is given (`operatorId`, `issuedAt`, `reason`, `at`); `clear` removes the key. Never store a token or a cookie value there, and nothing else under that key. `localStorage` is shared by the tabs of the origin on purpose: a NEW tab (and a reloaded one) then finds the debt, and the source in that tab settles it instead of taking the session | D90, CPC1-24; **D100, CPC1-34; T5-a** |
| 3 | `await live.ready` before the providers are mounted. It never rejects, resolves on `stop()` too, and says nothing about the outcome: read `live.session`, `live.link` and the store after it | 15-5 |
| 4 | `stop()` settles every action that is out (an accepted one resolves, one without an answer rejects with `code: 'STOPPED'`). Under React StrictMode the provider stops and starts the source once at mount; a debt is then asked about again by the new run. **A stopped source has no expiry timer: do not leave a stopped source on screen**; one that is started again looks at once | 15-9; R5-h |
| 5 | The `onError` sink writes every report to the persistent log. In a development build make a report of level `error` from `live.subscriber` and `live.misuse` loud (the console): the source contains the exception and writes nothing itself | R5-g |
| 6 | A store subscriber outside React that throws is contained and reported (`live.subscriber`, once a second at most); write such subscribers so that they do not throw | 15-10 |
| 7 | Two tabs are supported: one tab's reckoned expiry or lost link does not end the shared session. A Lock or a sign-out in one tab does end it for every tab: the session is the browser's. **A change of operator in one tab is supported too** (CPC1-35). (a) A tab whose socket is OPEN hears ROTATED, asks once who owns the credential and from then on shows that session; no session end is reported (§6.5), so `auth.operatorId` can change under a mounted shell. (b) A tab that was OFFLINE at that time asks ONE `getAuthSession` when its socket returns, before anything of the new socket is shown. The same session goes on. Another one: the earlier session ends in this tab (`live.lastSessionEnd`: `reason: 'ROTATED'`, `source: 'REST'`, `signOut: null`; the replica is emptied, nothing is owed and no sign-out is sent), and the session the credential names now is taken as at a fresh start (signed out for a moment, then signed in as the new operator). **The two-tab lane check may now include "another operator signs in while one tab is offline"**; expect: never the earlier operator's name over the new operator's data, one `getAuthSession` per reconnect of a signed-in tab, no `signOut` request | R5-b, D90; **D100, CPC1-35; T5-d (lifted)** |
| 28 | **A start whose `read` fails is CLOSED** (it throws, it does not answer in 5,000 ms, or it returns something that is no debt): a stored Lock may exist, so when the credential names a session the source does NOT take it. The console shows the login screen, one report `live.owed` of level `error` says why (after the `live.secrets` report of the failed call), nothing is signed out at the Core, and a fresh sign-in is required; the same session is declined again at every reconnect until then. A session that is issued later (a sign-in in any tab) is taken. So decide ONCE, before `createLiveSim`, whether the origin has a usable `localStorage` (a write-and-remove probe): when it has none, do NOT pass `owedSignOut` (nothing can be stored there; the behaviour is "no persistence", and the runtime logs that a Lock will not survive a reload); pass the port only when the storage works, so that a later failure of `read` really means "a stored Lock may be unreadable" | **D100, CPC1-34** |
| 29 | A tab that is already OPEN does not learn of a debt another tab wrote: the storage is read at a start only. While the Core cannot be reached, a Lock in one tab does not lock the others; they follow when the debt is paid (the Core then ends the session and tells their sockets). Optional, the runtime's choice: on the browser's `storage` event for that key, call `live.actions.signOut('LOCK')` in this tab when the debt that appeared names this tab's session (`operatorId` and `issuedAt` of `live.session`) | **T5-a** |
| 30 | Between a reconnect of a signed-in tab and the answer of row 7 (b) the session is UNCONFIRMED: one round trip, or longer while the Core does not answer that question (asked again after 2 s, 4 s … 30 s, never inside a `retry-after`). In that time `useLiveLink()` can say ONLINE while every action that sends a request is refused as with the link down (`LiveTransportError`, `CORE_OFFLINE`, no request), a touch waits and is sent at the confirmation, and `signOut` ends the session here and is owed (the debt is settled by asking first, so it never signs out another operator's session). The earlier replica stays on screen meanwhile. The shell needs no new state and no new wording: the offline refusal is right. Calls of pages through `live.client` are NOT held back in that window (finding F66-26) | **D100, CPC1-35** |

**The mobile runtime and its rows (W51, W56, W57)**

| # | Note | From |
|--:|---|---|
| 8 | `socket.headers()` is **synchronous** and is asked whenever a socket is opened, the first time when the source starts. Load the stored values BEFORE `createLiveSim`, or pass `autoStart: false` and call `start()` when they are loaded. A `live.socket` report of level `error` "the session is known, and the socket the app opens does not carry it" means the two providers returned different credentials | 15-1; 16.6-18 |
| 9 | The credential provider of the typed client returns a value held in memory and never touches storage | 15-2 |
| 10 | Pass no `owedSignOut`: on a tablet the app drops the session token at the local end (`sessionCleared`), so nothing can be taken again after a reload. The session then stays open at the Core until its idle expiry (accepted residual, F66-15) | D90; D84 |
| 11 | The secrets port. `sessionCleared` and `deviceUnpaired` must have removed the value before they resolve. `deviceUnpaired` must be idempotent: it is called again, 3 times at most (after 2 s, 4 s, 8 s), when the reopened socket still presents the old credential | 15-3 |
| 12 | Every port call but `biometricToken` is given 5,000 ms. **Whatever a port throws, the source reports only the port's name and the error's name, and an action whose port failed rejects with `CoreRefusalError` (`NOT_AVAILABLE`)**, not with the port's error: the app's own log is the place for its own text | 15-3; D90, CPC1-26 |
| 13 | **No prompt of the operating system inside `sessionIssued` or `devicePaired`** (it carries the rotated biometric token): keep the value in memory first, resolve, and persist it without a prompt. A `sessionIssued` past 5 s rejects the sign-in although the Core issued the session; a `devicePaired` past 5 s leaves a device the Core registered and the tablet does not hold: revoke it in the portal | R5-c, CPC1-29 |
| 14 | When the device clean-up gave up: ONE report `live.secrets` with `context.code === LIVE_DEVICE_CLEANUP_GAVE_UP_CODE`; the state is `live.link === 'OFFLINE'` with `live.socketStatus().end?.kind === 'DEVICE_REVOKED'`. Show it, delete the credential, then call `live.reconnect('CREDENTIAL')`. `setPairing` alone opens no socket, and `pair` is refused while the link is down | R5-j, CPC1-30 |
| 15 | Call `live.reconnect('RETRY')` when the app returns to the foreground with a STALE link | 15-4 (CPC1-19) |

**The shell and the call-site rows (W54, W55 and after)**

| # | Note | From |
|--:|---|---|
| 16 | **Lock and Sign out never do nothing, and never fail**: `actions.signOut(reason)` resolves with the link down, without an answer, and when the Core refuses it; the replica is empty at once. Read the notice from `live.lastSessionEnd` (`useLiveSelector`), not from the action's outcome: `signOut === 'LOCK'` → "Console locked"; `signOut === 'USER'` → signed out; `reason` `IDLE_EXPIRED` or `ABSOLUTE_EXPIRED` → "Session expired", whatever the `source` (`CONTROL`: the Core said it; `REST`: the Core confirmed it when asked; `LOCAL`: the Core could not be asked). `reason === 'ROTATED'`: another sign-in with this browser replaced the session of this tab; when a session follows, the shell is signed in again right after it (row 7). `auth.status` has no value LOCKED (SIM-GAP-2) | 15-7, 15-8 (replaced), D90; **D100, CPC1-35** |
| 17 | After "Session expired" with `source: 'LOCAL'` the console can become signed in again by itself, when the Core turns out to hold the session still (the reckoning was early): the shell must follow `auth.status` in both directions, as it does at a reload. After a Lock or a sign-out it never comes back without a sign-in | D90 |
| 31 | **A sign-in can stay pending for up to 16 s before its own request goes out**: when a debt is being settled at that moment, the sign-in waits for the question and the payment (two requests, 8 s each at worst). The Login page keeps its pending state for that long: it does not time out by itself and does not let the operator submit twice | **T5-c** |
| 32 | A closed start (row 28) looks like any signed-out start: `auth.status` is SIGNED_OUT and `live.lastSessionEnd` is `null`. The shell shows the login screen and needs no notice; the reason is in the persistent log (`live.owed`) | **D100, CPC1-34** |
| 18 | Take the actions from `useCoreActions()`. A call site that reads a Live result as a value is reported once per action: `live.misuse`, `READ_AS_VALUE` (level `error`) for a read of `ok`, `NOT_OBSERVED` (level `warn`) for a value nobody observed. A lane check of a call-site row ends with no `live.misuse` report of level `error`. A value that is dropped on purpose goes through `settle()` or gets a `.catch` | 15-11 |
| 19 | `useLiveSelector(read)` reads `session`, `lastSessionEnd` and `auditChain`; name `LiveSim` as the parameter's type with a type-only import. Do not write a second `useSyncExternalStore` wrapper | 15-12 |
| 20 | The refusal presenter words four codes of `LiveTransportError`: `CREDENTIALS_UNAVAILABLE` and `CREDENTIALS_TIMEOUT` (nothing was sent), `SNAPSHOT_TIMEOUT`, and `STOPPED` (the screen is gone: show nothing); and `CoreRefusalError` `NOT_AVAILABLE` (the storage of the app failed, or the action does not exist in Live mode) | R5-d; D90 |

**The administration page rows (W77, W81) and every page that calls an operation that is no simulator action**

| # | Note | From |
|--:|---|---|
| 21 | Call it through **`live.client.call(operationId, input)`** and through nothing else. Never build a typed client in a page. The answer is the typed client's own (`ok`, `status`, `error.code`, `retryAfterSeconds`, `transport`): the page maps it itself | 16.6-13 |
| 22 | **Write no page-level handling of a 401 and no permission refresh.** The source does both for a call through `live.client`, exactly as for an action: a 401 `NOT_SIGNED_IN` ends the session (the shell then shows the login screen), and a 403 `NOT_PERMITTED` or `FORBIDDEN` refreshes the permission hint with one debounced request, so `useCorePermission` follows. The page shows the refusal of its own call and nothing more. An answered POST is activity: no `actions.touch()`. **The query client of the pages must not repeat a call that was answered 401 or 403** (no retry for those statuses): every 403 through `live.client` starts the debounced permission refresh, a 401 has already ended the session, and the Core audits every refusal | D90, CPC1-32 (replaces 16.6-15 and R5-f); **T5-b** |
| 23 | While the link is down the view refuses nothing: the request goes out and the page gets `{ ok: false, status: null, transport: 'CORE_OFFLINE' }`. A page that wants CL-22 for its commands checks `useLiveLink()` itself. The view holds nothing back in the unconfirmed window of row 30 either | D90; **D100** |
| 24 | The web System page: `exportLogs()` without a request is always 422 `INVALID_REASON` in Live mode; the row must collect a reason | 15-14 (CPC1-22) |

**Every client test**

| # | Note | From |
|--:|---|---|
| 25 | Inject `now: fake.clock.now` and `timers: fake.clock.timers` into `createLiveSim`: a test that leaves the local clock real while the fake's time is the contract examples' instant gets an early expiry (CPC1-27) | R5-e |
| 26 | Scripting the fake: `scriptSignedInStart` and `scriptAnonymousStart` ADD a connect script; a test in which the principal changes scripts sockets through one `fake.onConnect` of its own. A connect script must not act on a socket the client already gave up: check `connection.state === 'CONNECTING'`. Advance the fake clock in steps and let the promise jobs run in between. Answer each request by the credential the request presented, and a session read by what the Core holds when the request arrives (`serverTime` is the fake clock's now): the model of the Core's session in `test/live-source-local-end.test.ts` (`boot`, `core`) can be copied | F66-8, F66-16, D90 |
| 27 | After every session end the source asks `getSignInStatus`. It asks `getAuthSession` at a reckoned expiry, before it settles a debt, **and once after every reconnect of a signed-in client** (CPC1-35): script them, or the fake records a violation. **The answer after a reconnect must name the SAME session the test signed in with (the same `operator.id` and `issuedAt`)**, or the source ends the session as ROTATED: answer from one session model (row 26), not from a fixed example. The contract's examples pair up (`signIn` `webConsole` with `getAuthSession` `webConsole`, `pairedDevice` with `pairedDevice`), but the fake's default answer, and `fake.hold(operationId).release()` without an argument, is the FIRST example (`webConsole`): a test that signed in as `pairedDevice` scripts `getAuthSession` with `pairedDevice` | F66-8, D90; **D100, CPC1-35** |
| 33 | The web runtime's storage port has its own tests: a `write` followed by a `read` in the same turn returns the debt (the calls are synchronous); `read` of an absent key returns `null`; `read` of a text that does not parse THROWS; `clear` removes the key. A lane check of the web shell with a stored Lock: after a reload the login screen is shown and one `signOut` with `reason: 'LOCK'` reaches the Core | **D100, CPC1-34** |
| 34 | A test in which the operator changes uses a session model with an operator per session (`core.signIn(operator)`, `core.replaceUnheard(operator)` in `test/live-source-local-end.test.ts`) and watches every store update: the earlier `auth.operatorId` must never stand beside state the new socket sent | **D100, CPC1-35** |

### 17.5 CPC1-27: the Live clock and a server clock that is behind (a note, as ruled)

The Live clock never moves backwards (`clock.ts`), and it is first read when the source is
created, before any reading of the server clock. With a server clock BEHIND the local one by X the
Live clock stands still for X and then runs X ahead of the server, so the instant the client
reckons with comes X early. Since this round that is no defect while the Core can be asked: at the
reckoned instant the source asks, the Core says the session is open, and the next look is set by
the Core's own clock (`idleExpiresAt` minus `serverTime` of the answer), which needs no local
clock. **The residual**: when the Core cannot be asked AND would not tell, the local end comes X
early. It errs on the early side, never the late one, and the debt check corrects it when the Core
answers again (an expiry whose session the Core still holds is taken again). On the one computer
of this demo X is 0. No code was changed in `clock.ts`: letting the first sample set the clock
back would contradict its rule that a countdown never counts up, and the round's fix removes the
harm. Every client test injects `now` (row 25).

### 17.6 Verification

**Gate on the finished tree** (`assets/44_round2_gate.log`; from `/Users/gsp-budi/Documents/DEMS`, no `cd`):

```
# Step 66 (W44), second fix round after the re-review (decision D90): final gate
## 2026-10-04 15:56:20 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1775 passed (1775)
   Start at  15:56:20
   Duration  8.25s (tests 59%, import 31%, transform 9%, worker 1%)
exit=0
## 15:56:28 the 28 test files that exist at acaff20 (git ls-tree -r acaff20 --name-only packages/shared/test), alone
 Test Files  28 passed (28)
      Tests  517 passed (517)
exit=0
## 15:56:31 the ten files of this row, alone (every test name is in 44_round2_tests_verbose.log)
 Test Files  10 passed (10)
      Tests  351 passed (351)
exit=0
## 15:56:35 $ npm run typecheck -w @dems/shared       > tsc --noEmit    exit=0
## 15:56:38 $ npm run lint -w @dems/shared            > oxlint          exit=0
## 15:56:38 $ npm run typecheck -w @dems/core-web     > tsc -b          exit=0
## 15:56:48 $ npm run typecheck -w @dems/mobile       > tsc --noEmit    exit=0
```

No source file of the row was edited after 15:43:40 and no test file after 15:53:20; the mutation
check, the comparison below, the listing and this gate were all run after that, in that order. The
shared suite was run after each coherent step of the round and at the end (D90).

**Test ledger (P24).** `@dems/shared`: 68 files / 1,747 tests before the round, 68 files /
1,775 after: +28, all in this row's files.

| File of this row | Before | After | Note |
|---|--:|--:|---|
| `live-source-local-end.test.ts` | 30 | 54 | Re-written around a model of the Core's session (one session behind the browser's credential, shared by the tabs, with the Core's own rules). The 30 earlier tests are all carried over: 22 as they were, proven on the model, and 8 with the rule the rulings changed (the debt is asked about before it is paid, three tests; a refused sign-out; an expiry while the Core can be asked; an expiry whose session the Core still holds; a page's 401; the F66-18 end, now confirmed by the Core). 24 tests are new |
| `live-source-resilience.test.ts` | 24 | 27 | +3: CPC1-26. One test extended (CPC1-30) |
| `live-source-platform-neutral.test.ts` | 19 | 20 | +1: the storage is injected. Three tests changed by design: the export list (57 names), the constants, the gap IDs |
| `live-source-session.test.ts` | 75 | 75 | Two tests re-written for CPC1-26 (a fixed text; a fixed rejection) |
| The other six | 175 | 175 | Unchanged |
| **Sum** | **323** | **351** | |

**Red before, green after** (`assets/44_round2_red_green.py`, `44_round2_red_green.log`): the copy
holds `src/live/source` as it was before the round.

```
$ python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_round2_red_green.py
BEFORE (the code before the round, today's tests): exit 1 | 37 failed | 295 passed (332)
AFTER  (the tree):                                 exit 0 | 332 passed (332)

## Red before, green after: 37
…
## Not green after: 0
## Green before and after (tests that existed, and tests that only guard the new code): 295
```

By finding: CPC1-23: 10. CPC1-24: 11 (ten in `local-end`, one static). CPC1-26: 5. CPC1-31: 2.
CPC1-32: 2. CPC1-25: 2. CPC1-30: 1. F66-18: 1 (its end is now confirmed by the Core: `source: 'REST'`).
The static tests of the export list, the constants and the gap IDs: 3. Sum: 37. On the code before
the round: with two tabs the shared session was signed out after a blip (`signOuts()` 1 where 0 is
expected, `core.session.open` false); a new session was ended by an old debt; a reload after an
offline Lock was signed in again without a password.

**Mutation check** (`assets/44_mutate.py`, with the IDs of this round; `44_round2_mutations.log`).
As D90 rules, only the code this round changed was mutated, on a scratch copy (never in the tree):
the 26 new changes K01 to K26, and the 20 older ones whose lines the round touched (S01, F12, F39
to F50 except F51, F52 to F54, H01, H08, H13), re-written where the text moved.

```
# Step 66 (W44), second fix round (decision D90): mutation run over the code this round changed, on an isolated copy (.cache/w44/mut/shared), 2026-10-04 15:53:45 WIB
$ python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_mutate.py S01 F12 F39 F40 F41 F42 F43 F44 F45 F46 F47 F48 F49 F50 F52 F53 …
M00 no change | exit 0 | 331 passed (331)
…
mutations: 46, killed: 46, survived: 0 []
exit=0
# finished 15:56:10 WIB
```

The first run (`44_round2_mutations_run1.log`) detected 42 of 46. The four survivors were tests
that asserted too little, not defects:

| Survivor | Why it survived | The test now also asserts |
|---|---|---|
| F43 the answer of a sign-in leaves the debt | The session check of this round drops such a debt later anyway | No question about the debt is asked after the sign-in |
| F45 a 401 for the payment counts as a refusal | The next question finds the session over and drops the debt | It is done at once: no refusal is reported, nothing is asked again |
| F46 a socket that is nobody's keeps the debt | Without a storage the kept debt changes nothing | A new test with a storage: the stored debt is cleared at once, without a question |
| F47 the expiry is not looked at when the link is lost | The next repeated question ended the session a few seconds later | The end follows in the turns of the lost link, at the same clock reading |

The other 107 entries of the list (code this round did not touch) were not run again; their last
full run is section 16.7 (127 of 127).

**Each client's compiler options** (`assets/44_client_probe.log`): the web probe passes
`owedSignOut`, the mobile probe reads `LIVE_DEVICE_CLEANUP_GAVE_UP_CODE`. Web: exit 0. Mobile:
exit 0. Negative controls (a reason outside the four; a record with a `sessionToken` member): exit
2 for both.

### 17.7 Findings and decisions of the round

| ID | Finding | Evidence | Proposed action |
|---|---|---|---|
| F66-21 | `CONTRACT-GAP-7` is withdrawn. The round's rule "no sign-out is ever sent for an expiry" removed the adapter that sent it as USER; the marker is gone from the code and the static test expects one open gap in this folder (`CONTRACT-GAP-3`) | `live-sim.ts` (`settleDebt`); `platform-neutral`: "CPC1-6 …" | W83 has nothing to do for it. F66-13 is closed |
| F66-22 | The debt names its session by `operator.id` and `issuedAt`: `AuthSessionInfo` has no session identifier. Two sessions of one operator issued in the same millisecond would be told apart by nothing; a sign-in is one request, so that does not happen | `api/identity.ts:112-129` | None. If the contract ever gives the session an opaque identifier, the record takes it |
| F66-23 | At a reckoned instant the source asks `getAuthSession` also while the link is ONLINE: one GET per expiry boundary and tab. While that question is out (8 s at most, the typed client's time-out) the last Core data stays on the screen | `live-sim.ts` (`checkExpiry`) | None. W58 observes whether the Core's own `session.ended` arrives before or after it; either order ends the session once |
| F66-24 | With a storage that answers asynchronously, the debt is being written when the end is reported, and is not yet stored. The web runtime's storage is synchronous, so the order the ruling asks for holds there | `types.ts`, the comment of `LiveOwedSignOutPort` | Row 2 of section 17.4 says "must be synchronous" |
| F66-25 | When the Core is reachable, a permission refresh after a 403 takes the Core's instants, so the "a refused POST moves the idle instant" of decision 34 is replaced by the Core's truth one second later. The rule matters only while the Core cannot be asked | `live-sim.ts` (`schedulePermissionRefresh`, `adoptSession`) | None |

| # | Left open by | What was built | Why |
|--:|---|---|---|
| 38 | D90, CPC1-23 | An expiry that was decided here is **never** signed out: the debt is settled by asking only | "Never signed out blindly", and no user sign-out in the audit trail that no user made. It removes CONTRACT-GAP-7 |
| 39 | D90, CPC1-23 (the reviewer: "this tab stays signed out, the debt is dropped") | When the Core still holds the session of an expiry debt, the session is **taken again** | The reckoning was wrong, and the Core is the judge: it is what rule (b) does at the instant when the Core can be asked. Keeping the tab signed out needs one more remembered state and makes the operator sign in again in a tab whose session is alive. The controller may rule the other way |
| 40 | D90, CPC1-31 ("say what a USER sign-out does") | A refused USER sign-out fails closed exactly like a LOCK | An operator who asked to be signed out is signed out here; decision 20 is replaced |
| 41 | D90, CPC1-31 | A sign-out the Core refuses RESOLVES (it does not reject) and is reported as `live.session`, level `error` | What the operator asked for happened here; a rejection after the console is already signed out would only confuse the call site |
| 42 | D90, CPC1-24 | The record: `operatorId`, `issuedAt`, `reason` (USER, LOCK, IDLE_EXPIRED, ABSOLUTE_EXPIRED), `at`. What `read` returns is taken only in that exact shape; anything else is dropped, cleared and reported (`live.owed`) | A storage is not trusted; F66-22 |
| 43 | D90, CPC1-24 | `write` is called before the end is reported and is not waited for before the replica is cleared | "Cleared at once" (D80) and "written before it is reported" (D90) both hold for a synchronous storage; F66-24 |
| 44 | D90, CPC1-24 | A storage that failed once is not asked again by that source | "No persistence, with one report" |
| 45 | D90, CPC1-23 | No answer to the question at the instant: nothing ends while the Core would tell (the socket carries `session.ended`); asked again with the back-off | (a) and (b) together |
| 46 | D90, CPC1-23 | The same session whose instant has passed by the Core's own clock is neither signed out nor taken: the Core is asked again until it has ended it | Nothing is sent for an expiry; nothing expired is shown |
| 47 | D90, CPC1-26 | The fixed rejection of an action whose port failed is `CoreRefusalError('NOT_AVAILABLE')`, the same as for a port that timed out or does not exist | One code for "the storage of the app is not available"; the report tells the cases apart |
| 48 | D90, CPC1-30 | A report code, not a new member of `LiveSim` | The ruling allowed either; the 30 members stay as they are |
| 49 | D90, CPC1-27 | No change in `clock.ts` | Section 17.5 |

### 17.8 Statements of sections 1 to 16 that no longer hold

| Where | It said | Now |
|---|---|---|
| Section 14.2, 14.7 decision 21 | An expiry decided here owes a sign-out, sent as USER | Never sent; settled by asking (decision 38) |
| Section 14.2, 14.7 decision 24; 16.4 | While the link is ONLINE the expiry ends nothing here / the expiry is checked here when the socket is not the session's | At the reckoned instant the Core is asked, in every link state; the local end only when it cannot be asked and would not tell |
| Section 14.2, 14.7 decision 20 | A sign-out the Core refuses still rejects and leaves the client signed in | It fails closed and resolves (decisions 40, 41) |
| Section 14.2, 14.7 decision 23 | The owed sign-out is sent as soon as an OPERATOR socket appears | The Core is asked first (section 17.2) |
| Section 14.6 F66-13; 16.1 | `CONTRACT-GAP-7` | Withdrawn (F66-21) |
| Section 15 and 16.6 | The notes for the briefs | Replaced by section 17.4 |
| Section 16.2, the table row "401" | A 401 through `live.client` changes nothing | It still counts no activity, and it ends the session (CPC1-32) |
| Section 16.6 row 15; 16.8 decision 35 | The view counts activity and nothing else | Overruled: the full CL-23, without CL-22 |
| Section 14.5 and 16.7, the mutation tables | 114 and 127 changes | The list holds 153; the 46 on this round's code were run (section 17.6) |
| Section 11, "a credential the app could not store rejects the action with the app's own error" (the test of that name) | The app's own error | A fixed error (CPC1-26) |

### 17.9 Rollback of the round

Pre-images under `.cache/rollback/W44-round2/` (git-ignored): `source/` (the 13 files) and `test/`
(the ten test files of the row).

```
# from /Users/gsp-budi/Documents/DEMS: back to the state the gate of D84 and its follow-up passed
cp .cache/rollback/W44-round2/source/*.ts packages/shared/src/live/source/
cp .cache/rollback/W44-round2/test/live-source-*.test.ts packages/shared/test/
```

### 17.10 Limits of this evidence

- Everything is proven on the fake transport and the fake clock, against a model of the Core's
  session that this row wrote from the specification and from the identity row's code
  (`authenticate/index.ts`): one session per credential, lazy expiry at the read, a sign-out that
  tells its sockets. Whether the Core server answers `getAuthSession` with 401 at once after an
  idle expiry, and in which order `session.ended` and that 401 arrive, is observed first by W58.
- "Two tabs" are two Live sources on one fake transport that share the session model. No browser
  ran; that `localStorage` is seen by a second tab in time is the browser's own rule and W50's
  lane check.
- CPC1-23 and CPC1-24 were reproduced on the code before the round; CPC1-25, CPC1-26, CPC1-31 and
  CPC1-32 likewise. CPC1-27 is not reproduced by a test: it is a note, as ruled.
- The mutation check of this round covers the code it changed. A change in code the round did not
  touch was last checked in the follow-up's full run.

## 18. Third round (decision D100)

Source: the section "Third pass" (T0 to T6) appended to `gateway_check/07_cp_shared_client.md`
(PASS WITH FIXES; decisions 38 to 49 upheld; six new items, all Low or Info, all established by
reading) and the controller's decision D100: three Low items for code (CPC1-34, CPC1-35,
CPC1-33), three for notes (CPC1-36, CPC1-37, CPC1-38), and four additions to the brief list.

**Result: the three items that ask for code are fixed, each with tests that are red on the code
before the round and green on the tree. CPC1-36 is capped (my call, as D100 allows). CPC1-37 is
a contract gap, marked in the code and worded below. CPC1-38 asks nothing of this row. The brief
list (section 17.4) is updated in place and stays the one list.**

| Field | Value |
|---|---|
| Files changed | `src/live/source/live-sim.ts`, `types.ts` (documentation of `LiveOwedSignOutPort` only), `live-result.ts` (`isThenable` exported inside the folder; not in `index.ts`); tests `live-source-local-end.test.ts` (54 to 86 tests), `live-source-platform-neutral.test.ts` (one test changed by design: the gap markers) |
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0: **1,807 passed in 68 files** (17:01 WIB). Baseline of the round: 68 files / 1,775 tests; this row adds 32 tests |
| The 28 files of `acaff20` | Unedited (identical hashes, `assets/44_round3_pre_state.txt`, `44_round3_post_state.txt`); alone: 28 files, 517 tests, exit 0 |
| `typecheck` of shared, core-web, mobile; `lint` of shared | exit 0, 0, 0; exit 0 |
| Red before, green after | **30 tests** fail on the code before the round and pass on the tree (`assets/44_round3_red_green.log`; the first failing assertion of each is in `44_round3_red_before_reasons.log`) |
| Mutation check, over the code this round changed only | **94 single changes, 94 detected** (`assets/44_round3_mutations.log`): the 56 changes of this round and the 38 earlier ones whose lines the round touched. Two earlier runs of this round's own changes detected 52 of 53 and 55 of 56: each survivor showed a test that asserted too little, and reading beside the first run found one defect of this round's first version, which was fixed (section 18.6) |
| Platform neutrality | Unchanged: no file of the folder names a storage of the platform, comments included (static test, green) |
| Public API | **No name added, removed or re-typed.** The subpath still exports 57 names; `LiveSim` has its 30 members. Six changes of behaviour, and the documentation of one type (section 18.3) |
| Gap numbers | Two new markers in this row's own series, as D100 rules: `CONTRACT-GAP-W44-1` (`hello` names no session) and `CONTRACT-GAP-W44-2` (a sign-out names no session). The folder holds three open contract gaps: these two and `CONTRACT-GAP-3` (static test) |

### 18.1 Outcome per item

Test file: `packages/shared/test/live-source-local-end.test.ts`, unless another is named.

| Item | Outcome | What changed | Tests | Red before / green after |
|---|---|---|---|---|
| **CPC1-34** Low | **Fixed: the type says what the guarantee costs, the calls are made in order, and a `read` that fails starts closed** | (1) The documentation of `LiveOwedSignOutPort` (`types.ts`) states it: "a reload cannot forget a local Lock" holds only when ALL THREE calls are synchronous; with a call that returns a promise a reload inside `write` forgets the debt; a table says what each kind of storage gets. (2) **The ordering defect is fixed whatever the storage** (`debtStorage`): a call that is asked for while an earlier one is still out is made only when the storage has REALLY finished that one. A late `clear` cannot erase a newer debt; a `clear` cannot overtake the `write` before it. A synchronous storage is called at once, as before. The budget of a waiting call (5,000 ms) runs from the moment it was asked for; when the storage failed meanwhile the waiting call is not made; `stop()` ends the waiting and the reports, not the order. (3) **A `read` that throws, rejects or does not answer in 5,000 ms is "a debt may exist"**: the Core is asked, and the session it names is NOT taken; the client is signed out, one report `live.owed` of level `error` says why, nothing is signed out at the Core, and a fresh sign-in is required. The same session is declined again at every later socket; a session that is issued later is taken. A stored value that is no debt is treated the same way (decision 50). A `read` that returns `null` takes the session as before | Describe "the debt of a local end survives a reload …": "a stored value that is no debt … the start is CLOSED"; "a `read` that returns null (now, or later) means nothing is owed …"; "a `read` that THROWS is "a debt may exist" …"; "a `read` that never answers …"; "a `read` that throws while the credential names NO session …"; "the fresh sign-in ends the closed start, also when it comes before the Core answered the first question …"; "after a closed start, a session another tab signs in to LATER … is taken". Describe "an asynchronous storage: the calls take effect in the order they were asked for" (a fake storage whose calls finish when the test says, newest first): "a `clear` that is still out does not erase a debt that is written after it was asked for …"; "a `write` that is still out is not overtaken by the `clear` that follows it …"; "`stop()` ends the waiting and the reports, not the order …"; "a call that waits behind one the storage never finishes is not made …" | 8 red / 8 green (four for `read`, four for the order); 3 guards (`null` takes the session; no session, nothing declined; a sign-in ends a closed start) |
| **CPC1-35** Low | **Fixed in the source, as ruled; the contract text is reported as `CONTRACT-GAP-W44-1`** | After a reconnect that follows a time without the session's socket, ONE `getAuthSession` is asked before anything of the new socket is shown (the state messages are held). The same session (operator and `issuedAt`) goes on, with the Core's present instants and permissions. Another session: the earlier one ends in this client (`reason: 'ROTATED'`, `source: 'REST'`), nothing is owed and no sign-out is sent, the replica is cleared, and the new session is taken as at a fresh start. Section 18.2 has the exact trigger and what else follows from it | Describe "a known session is confirmed again for a socket that was opened after a time without one" (22 tests), among them the controller's: "ANOTHER operator signs in with the same browser while this tab is offline: at the reconnect ONE question, the earlier session ends here (ROTATED, nothing owed), and the new one is taken as at a fresh start; never the earlier operator with the new socket's state" (every store update is watched) and "the trigger is exact: a socket that was never lost causes no question, and neither does the socket this source opens itself right after the Core named the session" | 19 red / 19 green; 3 guards (the uninterrupted case; `stop()` and `start()` while the question is out; a sign-in while unconfirmed) |
| **CPC1-33** Low | **Fixed** | When a debt check ends with the session being taken (`taken` in `settleDebt`), the mark "the end of this socket is dealt with" is cleared: the socket is this client's again, and its end is an end | Describe "the debt is never paid blindly": "CPC1-33 / D100: a session that is taken after a debt check is this client's again: when the Core closes its socket with 4401 and no `session.ended` arrives, that is an end" | 1 red / 1 green |
| **CPC1-36** Info | **Capped (my call; decision 58)** | After five refusals in a row of the payment of one debt, the source stops asking by itself and says so once (`live.session`, level `error`, `context.refusals: 5`). The debt stays, the console stays signed out here, and the next OPERATOR socket asks again (five more at most). Before: one payment every 30 s without end, each audited by the Core | Describe "a sign-out the Core refuses fails closed": "CPC1-36 / D100: a payment the Core refuses again and again is not repeated without end …" | 1 red / 1 green |
| **CPC1-37** Info | **Nothing can be built here: contract text reported as `CONTRACT-GAP-W44-2`** | A marker at the payment in `settleDebt`; section 18.5 has the text | `platform-neutral`: "CPC1-6: each local adapter carries its ID as a text a search finds" (the marker stands at the payment) | 1 red / 1 green (the static test of the markers, shared with W44-1) |
| **CPC1-38** Info | **Nothing for this row** (residuals for the final report) | — | — | — |

### 18.2 CPC1-35: the trigger, and what follows from it

**The trigger, exactly.** An OPERATOR `hello` whose connection number is greater than the
connection on which the session was last confirmed, while a session is known and neither a
sign-in nor a probe is out. "Confirmed on" means: the connection that was current when the Core
last named this session in answer to the probe, the debt check or the confirmation itself, or the
connection the source itself opened right after such an answer. A socket that was never lost says
`hello` once and causes no request (test "the trigger is exact"); a socket that was lost causes
exactly one request per new connection.

| The Core answers the question | Then |
|---|---|
| The same session (operator and `issuedAt`) | It goes on with the Core's present role, permissions and instants; the held snapshot is applied; a touch that waited is sent |
| Another session | The earlier session ends here: `LiveSessionEnd` with `reason: 'ROTATED'`, `source: 'REST'`, `signOut: null`. Nothing is owed. The socket is reopened, and the probe of the new socket takes the session the credential names now, exactly as a fresh start does |
| 401 | The session ends as after any 401 (`reason: null`, `source: 'REST'`) |
| Nothing (no answer, 429, 5xx) | Asked again after 2 s, 4 s … 30 s, never inside a `retry-after` (the question shares the rule and the instant of the probe, CPC1-8); a new socket asks at once outside a `retry-after` |
| The same session, but the socket was replaced while the question was out | Nothing is confirmed by it: the newer socket is asked about itself |

**While the question has no answer, the session is unconfirmed** (decision 54). The client then
does not know whose session its credential names, so nothing is shown of the new socket and
nothing is sent for the operator:

| What | While unconfirmed |
|---|---|
| The replica on screen | The earlier one, unchanged |
| An action that sends a command, or the read `verifyAuditChain` | Rejected as with the link down: `LiveTransportError`, `CORE_OFFLINE`, no request (CL-22), although `link` can be ONLINE |
| `touch` | Remembered, and sent at the confirmation when it is at most 60 s old |
| `signOut` (USER, LOCK) | The session ends HERE and the sign-out is owed. The debt is settled by asking first (D90), so a Lock in this tab can never sign out the session of another operator (test "while the question has no answer …": the Lock sends nothing, and B's session lives) |
| A sign-in | Allowed; its own snapshot confirms the new session, and the old question is over with the session it was about |
| A call of a page through `live.client` | NOT held back (finding F66-26): the view changes nothing of a call (D84) |

**The same comparison wherever an answer names a session while one is known** (decision 55). Three
paths took whatever session the answer named, without a word: the expiry check, the permission
refresh, and the probe of a start with a session in memory (`stop()`, then `start()`). They now go
through one function, `confirmSession`: another session than the known one ends the known one
(`ROTATED`, `REST`) and is then taken as at a fresh start. An answer of the expiry check or the
permission refresh confirms nothing for a socket that is being opened, and is not applied while a
confirmation is out. **One path is left as it was built and reviewed**: a ROTATED that is HEARD on
an open socket makes the client ask once and keep whoever owns the credential now, without a
session end (§6.5). Finding F66-27 names the difference.

**Windows the client cannot close** (finding F66-28). Each needs a sign-in in another tab and a
socket of this tab being opened inside ONE request's round trip: the socket the source opens right
after an answer named the session (after a sign-in, after the probe), and an answer of the probe
that was asked before that sign-in and arrives after the socket was reopened. They close when
`hello` names the session (`CONTRACT-GAP-W44-1`).

### 18.3 The public API after this round

No export was added or removed and no signature changed: the subpath exports the same 57 names
(pinned by the static test, unedited in that part), `LiveSim` has its 30 members,
`LiveOwedSignOutPort` its three. `live-result.ts` now exports `isThenable` for `live-sim.ts`; it
is not re-exported by `index.ts`. The rows continue the list of section 17.3.

| # | Kind | Change |
|--:|---|---|
| **24** | **Behaviour, changed** | With `owedSignOut`: a `read` that fails, and a stored value that is no debt, start CLOSED (the session the credential names is not taken; a fresh sign-in is required). Before this round both started open. A new report: `live.owed`, level `error` |
| **25** | **Behaviour** | The calls of `owedSignOut` are made one after another when the storage answers later; a synchronous storage sees no difference |
| **26** | **Behaviour** | After a reconnect of a signed-in client the source sends one `getAuthSession` (per new connection). Until its answer the session is unconfirmed: actions that send a request reject with `CORE_OFFLINE` although `link` can be ONLINE, a touch waits, and `signOut` ends the session here and is owed |
| **27** | **Behaviour** | A `LiveSessionEnd` with `reason: 'ROTATED'` can now have `source: 'REST'` (before: `'CONTROL'` only): a session answer named another session than the known one (after a reconnect, at the expiry check, at the permission refresh, at a restart). The session the credential names is taken right after it |
| **28** | **Behaviour** | A session that was taken after a debt check ends with `source: 'CLOSE'` when its socket is closed with 4401 and no `session.ended` was heard (before: that close was passed over) |
| **29** | **Behaviour** | A payment of an owed sign-out that the Core refuses five times in a row is not repeated on the timer any more; one more `live.session` report (level `error`, `context.refusals`); a new OPERATOR socket asks again |
| **30** | **Documentation, markers** | `LiveOwedSignOutPort` says what its guarantee costs and what a failing `read` does. `live-sim.ts` carries `CONTRACT-GAP-W44-1` and `CONTRACT-GAP-W44-2` |

### 18.4 The brief list: what changed in section 17.4

Section 17.4 was updated IN PLACE and is the list. Nothing was renumbered; rows 28 to 34 are new.

| Row | For | Change | From |
|--:|---|---|---|
| 2 | W50 | Re-written: all three calls of the storage port are synchronous; `read` returns `null` only when nothing is stored and THROWS when the stored text cannot be read | T5-a; CPC1-34 |
| 7 | W50, W54 | Re-written: the two cases of a change of operator in another tab (heard on an open socket; found at a reconnect), and **the two-tab lane check may now include "another operator signs in while one tab is offline"**, with what to expect | T5-d, lifted by the fix of CPC1-35 |
| 28 (new) | W50 | A start whose `read` fails is closed; decide once, before `createLiveSim`, whether the origin has a usable storage, and pass no port when it has none | CPC1-34 |
| 29 (new) | W50 | A tab that is already open does not learn of another tab's debt; the optional `storage` event | T5-a |
| 30 (new) | W50, W54 | The unconfirmed window: `useLiveLink()` can say ONLINE while actions are refused as offline; no new shell state is needed | CPC1-35 |
| 16 | W54, W55 | One sentence added: the wording for `reason === 'ROTATED'` | CPC1-35 |
| 31 (new) | W55 | A sign-in can stay pending up to 16 s behind a debt that is being settled; the Login page's pending state must bear it | T5-c |
| 32 (new) | W54 | A closed start looks like any signed-out start | CPC1-34 |
| 22 | W77, W81 | One sentence added: the query client of the pages must not repeat a call that was answered 401 or 403 | T5-b |
| 23 | W77, W81 | One sentence added: the view holds nothing back in the unconfirmed window either | F66-26 |
| 27 | Every client test | Re-written: `getAuthSession` is asked once after every reconnect of a signed-in client, and its answer must name the SAME session the test signed in with; the fake's default answer is the first example | CPC1-35; F66-31 |
| 33 (new) | W50's tests | The storage port's own tests, and the lane check of a stored Lock | CPC1-34 |
| 34 (new) | Tests with a change of operator | A session model with an operator per session; watch every store update | CPC1-35 |

### 18.5 The two contract texts for the close-out row

Both are numbered in this row's series, as D100 rules; the close-out row gives them their final
numbers. Neither blocks anything: the client-side fix of CPC1-35 is in place, and CPC1-37 is a
window of one round trip.

| ID | Where the contract is | Today | The text to add | What it closes |
|---|---|---|---|---|
| `CONTRACT-GAP-W44-1` | `packages/shared/src/api/realtime-messages.ts`, `HelloMessageSchema` (the first message of every socket) | `hello` names the principal (`OPERATOR`, `DEVICE`, `ANONYMOUS`) and no session | For the principal `OPERATOR`, `hello` carries the session it speaks for: `session: { operatorId: string, issuedAt: EpochMs }`, the two members `getAuthSession` already returns (`AuthSessionInfo.operator.id`, `AuthSessionInfo.issuedAt`). Absent for the other principals | The client compares at `hello` and needs no request after a reconnect; the windows of finding F66-28 close, because every socket then says whose state it carries. The local adapter to delete is `revalidateSession` in `live-sim.ts` (the marker stands on it) |
| `CONTRACT-GAP-W44-2` | `packages/shared/src/api/identity.ts`, `SignOutRequestSchema` (`{ reason }`) | A sign-out ends whatever session the credential names when the request arrives | The request may name the session it is for: an optional `issuedAt: EpochMs`. When it is given and the session behind the credential was issued at another instant, the Core ends nothing and answers that the named session is over already (the 401 `NOT_SIGNED_IN` the client already takes as "paid") | CPC1-37: between the debt's question and its payment another tab can sign in, and the payment then ends that new session. Only this closes it; the client sends the `issuedAt` it already keeps in the debt (`settleDebt`; the marker stands at the payment) |

### 18.6 Verification

**Gate on the finished tree** (`assets/44_round3_gate.log`; from `/Users/gsp-budi/Documents/DEMS`, no `cd`):

```
# Step 66 (W44), third round (decision D100): final gate, from /Users/gsp-budi/Documents/DEMS (no cd; every command as written)
## 2026-10-04 17:01:17 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1807 passed (1807)
   Start at  17:01:17
   Duration  6.76s (tests 61%, import 31%, transform 7%, worker 1%)
exit=0
## 17:01:24 the 28 test files that exist at acaff20 (git ls-tree -r acaff20 --name-only packages/shared/test), alone
 Test Files  28 passed (28)
      Tests  517 passed (517)
exit=0
## 17:01:26 the ten files of this row, alone (every test name is in 44_round3_tests_verbose.log)
exit=0
 Test Files  10 passed (10)
      Tests  383 passed (383)
## 17:01:29 $ npm run typecheck -w @dems/shared      > tsc --noEmit  exit=0
## 17:01:32 $ npm run lint -w @dems/shared           > oxlint        exit=0
## 17:01:32 $ npm run typecheck -w @dems/core-web    > tsc -b        exit=0
## 17:01:41 $ npm run typecheck -w @dems/mobile      > tsc --noEmit  exit=0
```

No source file of the row was edited after 16:45:21 and no test file after 16:53:59; the mutation
check (16:55 to 17:00), the comparison below and this gate were all run after that, in that order.
The shared suite was run six times in the round: after the source change (the four tests whose
rule the round changes were red, as expected, and nothing else), green after each further step,
and at this gate. The tree was green whenever the round left it.

**Test ledger (P24).** `@dems/shared`: 68 files / 1,775 tests before the round, 68 files /
1,807 after: +32, all in one file of this row.

| File of this row | Before | After | Note |
|---|--:|--:|---|
| `live-source-local-end.test.ts` | 54 | 86 | +32. The model of the Core's session has an operator per session now (`core.signIn(operator)`, `core.replaceUnheard(operator)`), the state the Core serves can be changed (`served`), and a socket can be left with its upgrade unanswered (`core.parked`). Three tests of the earlier round were re-written with the rule D100 changed (a stored value that is no debt, a storage that throws, a storage that never answers: the start is closed now); the other 51 are unedited |
| `live-source-platform-neutral.test.ts` | 20 | 20 | One test changed by design: the two new gap markers and where they stand |
| The other eight | 277 | 277 | Unchanged |
| **Sum** | **351** | **383** | |

**Red before, green after** (`assets/44_round3_red_green.py`, `44_round3_red_green.log`): the copy
holds `src/live/source` as it was before the round (`.cache/rollback/W44-round3/source`).

```
$ python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_round3_red_green.py
BEFORE (the code before the round, today's tests): exit 1 | 30 failed | 225 passed (255)
AFTER  (the tree):                                 exit 0 | 255 passed (255)

## Red before, green after: 30
…
## Not green after: 0
## Green before and after (tests that existed, and tests that only guard the new code): 225
```

By item: CPC1-35: 19. CPC1-34: 8 (four for a `read` that fails, four for the order of the calls).
CPC1-33: 1. CPC1-36: 1. The static test of the gap markers: 1. Sum: 30. Six new tests are green on
the code before the round too: they guard what must NOT change (a `read` that returns `null`
takes the session; no session, nothing declined; a sign-in ends a closed start; a socket that was
never lost causes no question; `stop()` and `start()` while the question is out; a sign-in while
unconfirmed), and each is the test that detects at least one change of the mutation list (N18,
N19, N21, N22, N45, N46, N54 to N56), except the first, which every test with a storage repeats.
On the code before the round: the earlier operator stood on screen over the state of the other
operator's socket (`shown` not empty); a Lock in that tab signed the other operator out
(`signOuts()` 1 where 0 is expected); a start with a storage that throws was signed in; a `clear`
and a `write` were out at the same time (`calls` held both).

**Mutation check** (`assets/44_mutate.py`, with the IDs below; `44_round3_mutations.log`). As D90
and D100 rule, only the code this round changed was mutated, on a scratch copy (never in the
tree): the 56 new changes N01 to N56, run against the file that holds the round's tests, and the
38 earlier ones whose lines the round touched (four of them re-written where the text moved: S01,
K02, K04, K19; F20 lengthened, because its text now also stands in the new function), run against
the nine test files.

```
# Step 66 (W44), third round (decision D100): mutation run over the code this round changed, on an isolated copy (.cache/w44/mut/shared), 2026-10-04 16:54:47 WIB
## Part 1: the 56 changes of this round (N01 to N56), against the file that holds the round's tests
$ W44_TESTS=local-end python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_mutate.py N01 N02 N03 N04 N05 N06 N07 N08 N09 N10 N11 …
M00 no change | exit 0 | 86 passed (86)
…
mutations: 56, killed: 56, survived: 0 []
exit=0
## Part 2 (16:57:43): the 38 earlier changes whose lines the round touched, against the nine test files
$ python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_mutate.py S01 S08 S09 S12 S15 F20 F27 F28 F39 F40 F41 F42 F43 F44 F45 F46 …
M00 no change | exit 0 | 363 passed (363)
…
mutations: 38, killed: 38, survived: 0 []
exit=0
# finished 17:00:21 WIB
```

Three runs of this round's own changes were needed; the log of each is kept.

| Run | Result | What it showed | What was done |
|---|---|---|---|
| 1 (`44_round3_mutations_run1.log`, 53 changes) | 52 detected | N53 survived: "the answer of a question about a session that is over clears the flag of the next one". No test let such an answer arrive while a LATER session was waiting for a confirmation of its own | The test "a Lock while the question is out ends the question with the session …" now does exactly that: the old answer arrives while the next session is unconfirmed, and a command must still be refused |
| — | Found by reading while run 1 was going | A sign-in while a question is out left the question's flag standing: the sign-in's snapshot sets the session without going through `endSession`, so a client that signed in while unconfirmed would have refused every command afterwards. **A defect of this round's first version** | Fixed (the sign-in's snapshot ends the question and its timer); test "a sign-in while the session waits to be confirmed ends the waiting …" (both cases: the question is out; it waits to be asked again); three changes N54 to N56 |
| 2 (`44_round3_mutations_run2.log`, 56 changes, and the 38 earlier ones) | 55 detected; 38 of 38 | N47 survived: "the end of a session leaves its question standing". The test that had detected it in run 1 signs in after the end, and the fix above now clears the flag there too | A test without a sign-in after the end: "a Lock while the question is out, and the credential names another session: that session is taken, and nothing waits for the old answer" |
| 3 (`44_round3_mutations.log`) | **56 of 56**, and 38 of 38 of the earlier ones | — | — |

Not mutated, and why: `state.declined = null` at a sign-in's answer (after a sign-in the Core can
never name the declined session again, so no observable behaviour depends on the line; it keeps the
record from outliving its session), and `cancel('revalidate')` at `endSession` (a timer that fires
for a session that is over asks nothing; it stands with the other timers that are cancelled there).
The other 115 entries of the list (code this round did not touch) were not run again; their last
runs are sections 16.7 and 17.6.

**Each client's compiler options.** No exported name or type changed in this round (the port's
members got documentation), so the two probes of section 17.6 were not re-written; `typecheck` of
core-web and mobile is in the gate.

### 18.7 Findings and decisions of the round

| ID | Finding | Evidence | Proposed action |
|---|---|---|---|
| F66-26 | While a known session waits to be confirmed after a reconnect, a call of a page through `live.client` is still sent, and acts for whoever the credential names. The actions are held back; the view is not, because D84 rules that it changes nothing of a call (results, errors, timing) and D90 that it refuses nothing (CL-22 is the actions') | `live-sim.ts` (`observedClient`, `unconfirmed`); brief rows 23 and 30 | The controller's call. Without a ruling it stays as D84 and D90 made it: one round trip, and the page's own data stays the Core's truth for the credential. If it is to close: a member of `LiveSim` the pages read (for example through `useLiveSelector`), which is a public API change |
| F66-27 | A change of operator reaches a tab in two ways, and they look different to the app. HEARD on an open socket (ROTATED): the client asks once and switches to the new session with NO session end (§6.5, as built in the first delivery; "whoever owns the credential now stays signed in"). FOUND at a reconnect, an expiry check, a permission refresh or a restart: the earlier session ends (`ROTATED`, `REST`) and the new one starts fresh (D100) | `live-sim.ts` (`onControl`, `probeSession`, `confirmSession`); tests "the trigger is exact …" and "ANOTHER operator signs in …" | The shell rows handle both (brief row 7). If the controller wants ONE behaviour, the heard case can end the session too: one line in `probeSession` (use `confirmSession` also after a ROTATED) and two tests of `live-source-session.test.ts` to re-write. Not done: it changes reviewed behaviour D100 did not ask about |
| F66-28 | Windows of CPC1-35 the client cannot close, each one request's round trip wide and each needing a sign-in in another tab inside it: the socket the source opens right after an answer named the session (after a sign-in; after the probe), and a probe answer that was asked before that sign-in and arrives after the socket was reopened. The confirmation itself has no such window: a "same session" answer about an earlier socket confirms nothing (test "the socket is lost AGAIN …") | `live-sim.ts` (`ensureSessionSocket`, `awaitSignInSnapshot`, `probeSession`) | `CONTRACT-GAP-W44-1` closes them. None before that |
| F66-29 | After a closed start the session that was not taken stays open at the Core until its idle expiry or the fresh sign-in: nothing is known to be owed, so nothing is signed out, and the other tabs of the session go on. The browser still holds the credential | `live-sim.ts` (`declines`); test "a `read` that THROWS …" (`signOuts()` 0, the session open) | None. Signing out on a storage error would be "paid blindly" (D90) and would lock every tab. The controller may rule the other way: it is one line |
| F66-30 | With a storage that ALWAYS throws (a private window, a blocked storage), every start of the web console would be closed. The source cannot tell "no storage" from "a stored Lock is unreadable" | `types.ts` (the table of `read`) | Brief row 28: W50 decides once whether the origin has a usable storage and passes no port when it has none |
| F66-31 | The fake's default answer to `getAuthSession` (and `hold(…).release()` without an argument) is the FIRST contract example (`webConsole`, OPR-002). A test that signed in as `pairedDevice` (OPR-001) and then reconnects gets "another session" from that default, and its session ends as ROTATED | `CORE_API_EXAMPLES.getAuthSession` and `.signIn` (the pairs match by name); found when a new test of this round released a held question without an argument | Brief row 27. The shared suite is green: no existing test does it |

| # | Left open by | What was built | Why |
|--:|---|---|---|
| 50 | D100, CPC1-34 ("a `read` that throws or times out") | A stored value that is no debt starts closed too, after it was cleared and reported | It may have been a Lock; the reviewer asks the runtime's `read` to throw on a text that does not parse, and a `read` that returns such a value instead must not be the way around it |
| 51 | D100, CPC1-34 ("do not adopt on the probe; require a fresh sign-in") | The session the Core names first is remembered (operator, `issuedAt`) and declined at every later socket, with ONE report; no sign-out is sent. The closed start is over at a fresh sign-in, at a probe answered 401, and for a session that is issued later | "Signed-out state with a report"; F66-29 for what is not done |
| 52 | D100, CPC1-34 ("serialise the port's calls") | A later call waits for the REAL end of the earlier one, not for the end of its budget; its own budget runs from the ask; `stop()` does not drop a call that waits; after a failure nothing more is asked | Order is the point: a call whose budget ran out can still land later, and the next must not overtake it. A stopped source must leave the storage as its memory has it (React StrictMode stops and starts the same source) |
| 53 | D100, CPC1-35 ("state the exact trigger") | Section 18.2 | — |
| 54 | D100, CPC1-35 ("before the replica is shown as that operator's") | Besides holding the state messages, the client sends nothing for the operator while unconfirmed: commands and the read are refused as offline, a touch waits, a sign-out becomes a local end with a debt | The harm the finding names is "requests act for the cookie's operator". Holding only the picture would leave a Lock in tab A signing out operator B. The controller may narrow it |
| 55 | D100, CPC1-35 | The comparison also guards the expiry check, the permission refresh and a restart's probe; the heard ROTATED of §6.5 is left as built | One rule for "an answer names another session than the one I know"; F66-27 for the path that is left |
| 56 | D100, CPC1-35 | The question keeps to the Core's `retry-after` for `getAuthSession` (one instant, shared with the probe); its back-off belongs to one socket | CPC1-8 ruled that nothing is asked inside a `retry-after`, "whatever suggests it" |
| 57 | D100, CPC1-35 | An answer "the same session" that was asked on an earlier socket confirms nothing for the present one | Otherwise a second loss of the link inside the question's round trip reopens the finding |
| 58 | D100, CPC1-36 ("cap it or leave it with a comment, your call") | **Capped**: five refusals in a row, then silence until a new OPERATOR socket | Not reachable today (the Core has no rule that refuses a sign-out of the session's own origin), but a loop without end that the Core audits every 30 s is not a state to leave behind; the cap costs six lines and one report |
| 59 | D100, CPC1-37 | Nothing built; a marker and the contract text | No adapter is possible: the request cannot name a session |
| 60 | D100 ("no gap number without your row") | The markers are `CONTRACT-GAP-W44-1` and `-2`; the static test of the markers accepts the row's series beside the numbered one and pins the list | The close-out row's search (`CONTRACT-GAP-`) finds them |

### 18.8 Statements of sections 1 to 17 that no longer hold

| Where | It said | Now |
|---|---|---|
| Section 17.1, CPC1-24; 17.4 row 2 (as it stood) | "A storage that throws is "no persistence": ONE report …"; "a storage that never answers: after 5,000 ms the start goes on without it"; a stored value that is no debt: "the start goes on as without one" | The start is CLOSED in all three cases (decisions 50, 51). "Not asked again" and "the debt then lives in memory" still hold for the calls after it |
| Section 17.3 row 11 | `live.owed` has level `warn` only | Also level `error`: a session that was not taken |
| Section 17.4 row 7 (as it stood); T5-d | The two-tab lane check does not include a change of operator while one tab is offline | It may (row 7 as it stands) |
| Section 17.7 F66-24 | With an asynchronous storage the debt is being written when the end is reported | Still so; in addition the calls are now made in order, and the type says what is lost |
| Section 17.7 decision 42 | Anything that is no debt is "dropped, cleared and reported" | And the start is closed |
| Section 17.6 and 17.8, the mutation list | 153 changes | The list holds 209; the 94 on this round's code were run (section 18.6) |
| Section 17.2, the table row "A refusal (CPC1-31)" | "asked again with the same back-off" | For five refusals in a row; then at the next OPERATOR socket (decision 58) |

### 18.9 Rollback of the round

Pre-images under `.cache/rollback/W44-round3/` (git-ignored): `source/` (the 13 files) and `test/`
(the ten test files of the row).

```
# from /Users/gsp-budi/Documents/DEMS: back to the state the gate of D90 passed (15:56 WIB)
cp .cache/rollback/W44-round3/source/*.ts packages/shared/src/live/source/
cp .cache/rollback/W44-round3/test/live-source-*.test.ts packages/shared/test/
```

Section 17.4 of this document would then be wrong in rows 2, 7, 16, 22, 23, 27 and 28 to 34.

### 18.10 Limits of this evidence

- Everything is proven on the fake transport and the fake clock, against this row's model of the
  Core's session. "Another tab" is the shared session model: another Live source on the same
  fake, or a direct change of the model (`core.signIn(operator)`). No browser ran.
- That the Core's `hello` says OPERATOR for whoever the credential names at the upgrade, and that
  `getAuthSession` answers by the same credential, is read from the specification and from the
  realtime and identity rows' code; the first run against the Core server is the realtime row's
  first-contact test and W58.
- The asynchronous storage is a fake whose calls finish when the test says. The web runtime's
  storage is synchronous; its own tests are W50's (brief row 33).
- CPC1-34, CPC1-35, CPC1-33 and CPC1-36 were reproduced on the code before the round (the red
  runs). CPC1-37 is not reproduced: nothing in the client can show or close it.
- The windows of finding F66-28 are argued by reading, not shown by a test.

---
*Generated: 2026-10-04 12:30*
*Last Updated: 2026-10-04 17:05* (fix round after CP-C1: sections 14 and 15; follow-up of decision D84: section 16; second fix round of decision D90: section 17, with the final API list in 17.3 and the one list of brief notes in 17.4; third round of decision D100: section 18, and section 17.4 updated in place)
