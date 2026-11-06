---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 52
plan_row: W30 (wave B4; no lock)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete (every verification command of the row exits 0; no CONTRACT-GAP; one hypothesis of the specification stays unmeasured, section 9 F-2)
---

# 30 Live socket client (blueprint step 52, plan row W30)

Row, verbatim: [W30] Live socket client beside the heartbeat client: one socket, heartbeat view,
close codes, reconnect, resync. Writes: `packages/shared/src/realtime/live-socket-client.ts`,
`packages/shared/src/realtime/index.ts`, `packages/shared/test/realtime-live-*.test.ts`. Locks:
none. Implements AC-C-02, AC-C-15, AC-C-16. Rollback R-NEW, R-CO (`realtime/index.ts`).

**Result: the row is done and its gate is green.** `createLiveSocketClient` is the one socket of a
client in Live mode. It implements the existing `HeartbeatClient` interface from the `heartbeat`
messages of that socket, validates every frame with the contract's union, hands the snapshot and
gap-free deltas to its consumer, asks for a `resync` at most once in 2 s, ends on 4401 and 4403
without reconnecting, and reconnects on every other close with the existing backoff constants.
The heartbeat client and its test are byte-equal to `acaff20`.

| Field | Value |
|---|---|
| New source | `packages/shared/src/realtime/live-socket-client.ts` (1,179 lines; about 300 of them are the exported types with their comments, about 70 the header) |
| Changed source | `packages/shared/src/realtime/index.ts`: one line added, `export * from './live-socket-client';` |
| New tests | `packages/shared/test/realtime-live-socket.test.ts` (117 tests), `packages/shared/test/realtime-live-platform-neutral.test.ts` (13 tests): **130 tests** |
| `heartbeat-client.test.ts`, `heartbeat-client.ts` | Unchanged: `git diff --stat acaff20` prints nothing; `git hash-object` equals the blob of `acaff20` (`19df2df3…`, `216fed48…`) |
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0: **1,351 passed** in 55 files (10:23 WIB); an earlier full run at 10:17 was green too (1,231 in 50 files; the difference is the rows running in parallel) |
| `npm run typecheck -w @dems/shared`, `-w @dems/core-web`, `-w @dems/mobile` | exit 0, each |
| `npm run lint -w @dems/shared` | exit 0, no warning |
| Can the tests fail? | 44 single changes of the client on an isolated copy: 43 detected, 1 is an equivalent change (section 7.3) |
| CONTRACT-GAP | **None.** The contract held everything the row needs (section 8) |
| Close-code hypothesis on React Native [SP:§9.2] | **Not measured in this row** (no device lock; the emulator proof of W12 is still open). The client is correct for both outcomes (section 9, F-2) |

Evidence files, all under `implementation/assets/`: `30_baseline.log` (before the first edit),
`30_gate_final.log` (the final run), `30_realtime_tests_verbose.log` (every test of the three
realtime files by name), `30_mutations.log` and `30_mutate.py` (the 44 single changes),
`30_scratch_fake_transport.log` (section 9, F-6).
The mutation copy and the working logs are under the git-ignored `.cache/W30/`.

Sources are cited as [SP:§n] for `masterplan/01_specs.md`, [CS:…] for
`masterplan/04_client_integration_spec.md`, [PL:…] for `masterplan/02_plan.md`, [CB:…] for
`implementation/22_contract_b.md`.

---

## 1. What was done

| Step | What | Where |
|---|---|---|
| 1 | P23 pre-image saved before the first edit: `git diff acaff20 -- packages/shared/src/realtime/index.ts > .cache/rollback/W30.pre.patch`. It is empty (0 bytes): the file was equal to `acaff20` | `.cache/rollback/W30.pre.patch` |
| 2 | Baseline recorded: shared 977 tests in 46 files, typecheck and lint exit 0 | `assets/30_baseline.log` |
| 3 | The client written beside the heartbeat client. It imports the contract (`../api/constants`, `../api/realtime-messages`), `../domain/enums`, `./heartbeat-client` (the `reconnectDelayMs` function, two constants and three types) and, as a type only, `LiveLinkState` from `../live/mode` | `live-socket-client.ts` |
| 4 | One export line added to the realtime entry | `realtime/index.ts` |
| 5 | Behaviour tests with a fake socket and a manual clock that owns the timers; a static scan of the new file | the two test files |
| 6 | Mutation runs on a copy under `.cache/W30/mut` (never on the tree, so a row running at the same time never compiles a changed file) | `assets/30_mutations.log` |
| 7 | Gate on the finished tree | `assets/30_gate_final.log` |

Not written: the heartbeat client, its context, its hook, its test; anything under `src/api`,
`src/live`, `src/client`, `src/sim`; any `package.json`; anything in `apps/`; `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`,
`implementation/99_implementation_report.md` (parallel run: P8).

---

## 2. The consumer API (what the Live source row W44 uses)

Import: `@dems/shared/realtime` (the existing subpath, [CS:§2]).

### 2.1 Creation

```ts
function createLiveSocketClient(options: LiveSocketClientOptions): LiveSocketClient;

interface LiveSocketClientOptions extends LiveSocketHandlers {
  url: string;                               // ws://<host>/ws or wss://…; no query, no fragment, no user information
  socketFactory?: LiveSocketFactory;         // default: the global WebSocket constructor
  headers?: LiveSocketHeadersProvider;       // mobile: () => ({ Authorization: 'Bearer …' }); the web console leaves it out
  now?: () => number;                        // default Date.now
  random?: () => number;                     // default Math.random; jitter of the reconnect delay
  timers?: LiveSocketTimers;                 // default: the global timer functions
  meters?: boolean;                          // default true: subscribe to `meters` after an OPERATOR hello
  syncTimeoutMs?: number;                    // default LIVE_SOCKET_SYNC_TIMEOUT_MS (4,000)
}

interface LiveSocketLike extends SocketLike { send(data: string): void }      // SocketLike is the heartbeat client's
type LiveSocketHeaders = Readonly<Record<string, string>>;
type LiveSocketFactory = (url: string, headers: LiveSocketHeaders | undefined) => LiveSocketLike;
type LiveSocketHeadersProvider = () => LiveSocketHeaders | null | undefined;  // synchronous; asked at every connect
interface LiveSocketTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;   // a handle is opaque
  clearTimeout(handle: unknown): void;
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}
```

`createLiveSocketClient` throws `LiveSocketUsageError` for a URL that is not a plain socket address
(a query, a fragment, user information, another scheme) and for a `syncTimeoutMs` that is not a
positive number. After that, no socket callback, no timer callback and no handler call lets an
exception out (G-3).

The default factory calls `new WebSocket(url)` when there are no headers and
`new WebSocket(url, undefined, { headers })` when there are: the third argument is where React
Native reads upgrade headers [SP:§9.2], and a browser ignores it.

### 2.2 The client

```ts
interface LiveSocketClient extends HeartbeatClient {
  // HeartbeatClient (unchanged interface, CL-7):
  subscribe(listener: () => void): () => void;     // listeners of the heartbeat view
  getSnapshot(): HeartbeatSnapshot;                // state, seq, serverTime (ISO), lastBeatAt, clients, reconnectAttempt
  start(): void;
  stop(): void;

  getStatus(): LiveSocketStatus;                   // a new object at every call
  getLatestMeters(): MetersMessage | null;         // the one frame kept: the newest of the current connection
  reconnect(reason: LiveSocketReconnectReason): boolean;   // CL-11a; false and no effect when not started
  setMetersWanted(wanted: boolean): void;          // CL-11b: visible (true) or hidden (false)
  requestResync(): boolean;                        // CL-17: true when a resync is now pending
}

type LiveSocketReconnectReason = 'SIGN_IN' | 'SIGN_OUT' | 'CREDENTIAL' | 'RETRY' | 'OTHER';   // a label; not sent to the server
```

The four `HeartbeatClient` members are closures: `useSyncExternalStore(client.subscribe,
client.getSnapshot)` works on them unbound, so the client can be put into the existing
`HeartbeatContext` as it is (CL-7).

### 2.3 Handlers (all optional; called synchronously, in the order the server sent the messages)

```ts
interface LiveSocketHandlers {
  onHello?(hello: HelloMessage, info: { connection: number }): void;
  onSnapshot?(snapshot: SnapshotMessage, info: { connection: number; cause: LiveSocketSnapshotCause }): void;
  onDelta?(delta: DeltaMessage): void;
  onMeters?(meters: MetersMessage): void;
  onControl?(message: SessionUpdatedMessage | SessionEndedMessage | DeviceRevokedMessage | AdminChangedMessage): void;
  onServerTime?(sample: { serverTime: number; receivedAt: number; source: 'hello' | 'heartbeat' }): void;
  onLinkChange?(link: LiveLinkState, previous: LiveLinkState): void;
  onResync?(event: { phase: 'RESYNCING' | 'RESYNCED'; cause: 'GAP' | 'EPOCH' | 'REQUESTED' | 'RECONNECT' }): void;
  onEnd?(end: LiveSocketEnd): void;
  onError?(report: LiveSocketErrorReport): void;
}

type LiveSocketSnapshotCause = 'CONNECT' | 'RECONNECT' | 'RESYNC' | 'EPOCH' | 'REFRESH';

interface LiveSocketEnd {
  kind: 'SESSION_ENDED' | 'DEVICE_REVOKED';      // 4401 | 4403
  closeCode: number | null;                      // as the runtime gave it
  sessionEnded: SessionEndedReason | null;       // reason of the session.ended of this connection
  deviceRevoked: DeviceRevokedReason | null;     // reason of the device.revoked of this connection
  helloReason: RealtimeHelloReason | null;       // hello.reason of this connection
  principal: RealtimePrincipal | null;
  at: number;
}
```

| Name the delegation proposed | Name here | Why |
|---|---|---|
| `onHello`, `onSnapshot`, `onDelta`, `onLinkChange`, `onError` | The same | |
| `onMeter` | `onMeters` | The message is `meters` and holds both channels in one frame [SP:§9.4] |
| `onSessionEvent` | `onControl` | The specification's name: CL-15 has `onControl(listener)` for "the four control messages". `admin.changed` and `device.revoked` are not session events |
| `onAppend` | None | An append is an operation inside a delta and is applied in order with the `replace` operations of the same delta [SP:RT-3]; [CB:§3.2]. Splitting it off would break that order. `onDelta` hands on the whole delta |
| `subscribe` (send) | `setMetersWanted(boolean)` | `subscribe` is already the listener registration of `HeartbeatClient`, which CL-7 requires. `meters` is the only topic a client can subscribe to [SP:§9.4]; `state`, `control` and `admin` are given by the server |
| `resync` (send) | `requestResync()` | The client also sends `resync` by itself on a gap |
| `ack` | None | The contract has no such message |
| — | `onServerTime`, `onResync`, `onEnd` | The clock offset needs both forms of time [CB:F-4]; "resyncing / resynced"; the two close codes that end a run |

### 2.4 Guarantees

| # | Guarantee | Test (in `realtime-live-socket.test.ts`) |
|---|---|---|
| G-1 | **Ordering.** `onDelta` is called only when a `snapshot` of the same connection with the same epoch was handed to `onSnapshot` before, and the delta's revision is exactly the revision of the last state message handed on plus 1. After a reconnect no delta is handed on before the snapshot of the new connection | "ordering: a delta before the snapshot of its connection…"; "ordering: after a reconnect no delta is handed on…"; "a gap sends one resync, drops deltas until the snapshot…" |
| G-2 | **One socket.** At most one socket is held at any time; `reconnect` detaches and closes the old one before it opens the new one | "reconnect(reason) on an open socket closes it with 1000 and holds exactly one socket" |
| G-3 | **Nothing thrown** inside a socket callback, a timer callback or a handler leaves the client | "a handler that throws never escapes…"; "an onError that throws never escapes either…"; "a failure inside the client itself does not escape…" |
| G-4 | **A report never holds** frame content, a header value or the text of an exception. `cause` exists only for `HANDLER_FAILED` and is the value the consumer's own handler threw | "an invalid frame is dropped, counted and reported with a code, and the report never holds the frame"; "a schema report names…with member names only" |
| G-5 | **Resync reports pair up.** Every RESYNCING is followed by exactly one RESYNCED, unless the run ends first (`onEnd`, `stop()`). A lost link is told by `onLinkChange` (OFFLINE), and when the link is back RESYNCED with the cause RECONNECT is reported once | The resync tests; "1001 server shutdown: reconnects…" |
| G-6 | **No message is sent by a connection that is not OPERATOR**, and none before `hello` | "ANONYMOUS: ONLINE at hello, and no client message is ever sent"; the same for DEVICE; "opens one socket…and sends nothing before hello" |
| G-7 | **Meter frames are not queued.** Each goes to `onMeters` at once; the client keeps one frame, the newest; an older one is dropped; frames are handed on while a resync is pending | The five meter tests |
| G-8 | **A handler may call any method**, `stop()` and `reconnect()` included | "a handler may call stop()…"; "a handler may call reconnect()…" |
| G-9 | **After `stop()` no timer is left** and nothing more is handed on | "stop() closes cleanly and leaves no timer" (9 phases) |

### 2.5 What the Live source does with it (from the specification; not built here)

| Event | Live source |
|---|---|
| `onLinkChange` | Its `link` (CL-15). Commands only while ONLINE (CL-22). On STALE or OFFLINE the `audio` slice is reset to silent frames [CS:§2.3] |
| `onSnapshot` | Replaces the replica (CL-13). `cause: 'EPOCH'` settles CL-18 |
| `onDelta` | CL-16: held while an own command is in flight |
| `requestResync()` | CL-17: the settle time-out |
| `onResync` RESYNCED | The "Reconnected to the Core" notice for `LIVE_RESYNCED_NOTICE_MS` [CS:§3.5] |
| `onEnd` SESSION_ENDED | `auth.status` by the table of [CS:§6.5] from `end.sessionEnded` (null means "no notice"). Web: `reconnect('SIGN_OUT')` opens the anonymous socket [SP:§9.4]. Mobile: drop the session token, then `reconnect('SIGN_OUT')` with the device credential |
| `onEnd` DEVICE_REVOKED | [CS:§6.6]: delete the credential, then `reconnect('CREDENTIAL')` or `stop()` |
| `onControl` | Its own `onControl(listener)` (CL-15) |
| `onServerTime` | The clock offset [CS:§2.3] |
| `setMetersWanted(visible)` | CL-11b |
| `onError` | Its `errors()` ring (the last 50 reports) |

---

## 3. State machine

Internal phases, and the link a consumer sees:

| Phase | Meaning | Link |
|---|---|---|
| IDLE | Not started, or stopped | CONNECTING before the first `start()` (as the heartbeat client's first snapshot), OFFLINE after `stop()` |
| CONNECTING | A socket exists; no `hello` yet | CONNECTING |
| OPEN | `hello` arrived | STALE when no `hello` or `heartbeat` for `HEARTBEAT_STALE_AFTER_MS`; else CONNECTING until the snapshot of this connection (only when `hello.topics` holds `state`); else RESYNCING while a resync is pending; else ONLINE |
| WAITING | No socket; the reconnect timer runs | OFFLINE |
| ENDED | No socket and no reconnect: 4401 or 4403 | OFFLINE |

The five link values are the five of `LiveLinkState` (`src/live/mode.ts`); the file checks that at
compile time (`satisfies { [State in LiveLinkState]: State }`).

| Phase | Event | Next phase | Action |
|---|---|---|---|
| IDLE | `start()` | CONNECTING | Ask `headers`; open a socket; start the 500 ms housekeeping interval (`STALE_CHECK_INTERVAL_MS`); arm the sync deadline; heartbeat view CONNECTING, attempt 0 |
| CONNECTING | `hello` (first) | OPEN | `onHello`; `onServerTime`; `subscribe` meters when wanted and `hello` is OPERATOR with the `meters` topic; deadline for the snapshot when the `state` topic was given, else link ONLINE (and RESYNCED when owed) |
| CONNECTING | any message but `heartbeat` and `hello` | CONNECTING | Dropped; `MESSAGE_BEFORE_HELLO` |
| OPEN | a second `hello` | OPEN | Dropped; `UNEXPECTED_HELLO` (the principal is fixed at the upgrade) |
| CONNECTING, OPEN | `heartbeat` | same | Heartbeat view LIVE; the first one after a reconnect resets `reconnectAttempt` to 0; `onServerTime`; the link leaves STALE |
| OPEN | a message the principal is never sent [SP:§9.2] | OPEN | Dropped; `MESSAGE_NOT_FOR_PRINCIPAL` |
| OPEN | `snapshot` | OPEN | Epoch and revision taken; a pending resync ends; the deadline is cleared; `onSnapshot` with its cause; link ONLINE; `onResync` RESYNCED when owed |
| OPEN, synced | `delta`, same epoch, revision = last + 1 | OPEN | `onDelta` |
| OPEN, synced | `delta`, same epoch, revision > last + 1 | OPEN, resync pending | Dropped; link RESYNCING; `onResync` RESYNCING (GAP); `resync` sent now when the 2 s rule allows, else at a housekeeping step |
| OPEN, synced | `delta` of a newer epoch | OPEN, resync pending | The same with the cause EPOCH |
| OPEN, synced | `delta`, revision at or below the last, or of an older epoch | OPEN | Dropped as already held (`deltasStale`); no resync |
| OPEN, resync pending | `delta` | same | Dropped (`deltasDropped`): the coming snapshot holds its effect |
| OPEN, before the snapshot | `delta` | same | Dropped; `DELTA_BEFORE_SNAPSHOT` once per connection; no resync |
| OPEN | `meters` | OPEN | Wanted and newer: kept as the latest, `onMeters`. Else dropped |
| OPEN | `session.updated`, `session.ended`, `device.revoked`, `admin.changed` | OPEN | `onControl`; the reason of `session.ended` and of `device.revoked` is kept for `onEnd` |
| any | a frame that is not text, not JSON, or not of the union | same | Dropped, counted, reported (`NON_TEXT_FRAME`, `INVALID_JSON`, `SCHEMA_MISMATCH`) |
| CONNECTING, OPEN | close: section 4 | ENDED or WAITING | Section 4 |
| CONNECTING, OPEN | socket error | ENDED or WAITING | As a close without a code; the socket is closed |
| CONNECTING, OPEN | sync deadline passed | WAITING | `SYNC_TIMEOUT` (`waiting`: `hello`, `snapshot` or `resync`); the socket is closed with 1000; reconnect timer |
| OPEN | `send` throws | WAITING | `SEND_FAILED`; the socket is closed; reconnect timer |
| WAITING | timer | CONNECTING | Ask `headers`; open a socket |
| CONNECTING (opening) | `headers` or the factory throws | WAITING | `HEADERS_FAILED` or `SOCKET_FACTORY_FAILED`; no socket; reconnect timer |
| OPEN | housekeeping step | OPEN | Stale checks of both views; a waiting `resync`; a waiting `subscribe` or `unsubscribe` |
| any but IDLE | `reconnect(reason)` | CONNECTING | Reconnect timer cancelled; socket closed with 1000 "client reconnect"; a new socket at once. The attempt counter is kept |
| any but IDLE | `stop()` | IDLE | Both timers cancelled; socket closed with 1000 "client stopped"; both views OFFLINE |
| IDLE | `reconnect`, `requestResync` | IDLE | Return false |

Timers: two. The reconnect timeout, and one 500 ms interval that does the stale checks, the sync
deadline and the deferred sends. There is no third timer to leak.

---

## 4. Close codes

Source of the reactions: [SP:§9.4]; [CS:CL-11]; AC-C-16. Tests are in
`realtime-live-socket.test.ts`, block "close codes (AC-C-16)"; each name is in
`assets/30_realtime_tests_verbose.log`.

| Close | Reaction | Reported | Reconnect | Test |
|--:|---|---|---|---|
| 4401 after `session.ended` (each of the six reasons) | End | `onEnd` SESSION_ENDED, `sessionEnded` = the reason | **No** | "4401 after session.ended SIGNED_OUT / IDLE_EXPIRED / ABSOLUTE_EXPIRED / ROTATED / USER_DISABLED / TOKEN_REUSE: reported as SESSION_ENDED with the reason, and nothing reconnects" (6) |
| 4401 with no `session.ended` (an invalid bearer value, [CS:§6.5] last row) | End | `onEnd` SESSION_ENDED, `sessionEnded: null`, `helloReason: SESSION_INVALID` | **No** | "4401 with no session.ended before it (an invalid bearer value)…" |
| 4401 alone, on an open OPERATOR connection | End | `onEnd` SESSION_ENDED | **No** | "4401 alone on an open OPERATOR connection, with no control message before it…" |
| 4401 before `hello` | End | `onEnd` SESSION_ENDED, `principal: null` | **No** | "4401 before hello: SESSION_ENDED, no reconnect" |
| 4403 after `device.revoked` (REVOKED, UNPAIRED) | End | `onEnd` DEVICE_REVOKED, `deviceRevoked` = the reason | **No** | "4403 after device.revoked REVOKED / UNPAIRED…" (2) |
| 4403 after the `hello` of a revoked bearer value | End | `onEnd` DEVICE_REVOKED, `helloReason: DEVICE_REVOKED` | **No** | "4403 right after the hello of a revoked bearer value…" |
| 4403 alone, on an open OPERATOR connection; 4403 before `hello` | End | `onEnd` DEVICE_REVOKED | **No** | "4403 alone on an open OPERATOR connection…"; "4403 before hello…" |
| 1001 server shutdown | Lost link | `onLinkChange` OFFLINE | **Yes**, `RECONNECT_BACKOFF_MS[attempt]` plus jitter up to `RECONNECT_JITTER_MS`; the new connection's snapshot is expected (cause RECONNECT) | "1001 server shutdown: reconnects after RECONNECT_BACKOFF_MS[0] and expects a snapshot"; "1001 again and again: the delays are RECONNECT_BACKOFF_MS, and the last one repeats" |
| 1013 connection cap | Lost link | The same | **Yes**, the same | "1013 connection cap: reconnects…"; "1013 again and again…" |
| 4408 slow consumer | Lost link | The same | **Yes**, the same | "4408 slow consumer: reconnects…"; "4408 again and again…" |
| 1008 protocol violation | Lost link | The same | **Yes** (CL-11) | "1008 protocol violation: reconnects…" |
| 1000 by the server, 1006, 1011, no code | Lost link | The same | **Yes**: the rule of the heartbeat client, "any close reconnects" | "1000 normal closure by the server…"; "1006 abnormal closure…"; "1011 server error…"; "no code at all…" |
| Socket error | Lost link | The same | **Yes** | "a socket error reconnects with the backoff; the late close of that socket is ignored" |
| A close without its code (or with another code) after `session.ended`, after `device.revoked`, or after a `hello` that refused a bearer value | End, as the server announced | `onEnd`, `closeCode` as received | **No** | "a close whose code the runtime did not hand on is still the end the server announced" |
| A close after a `hello` with `SESSION_INVALID` on a connection without headers (the web console's dead cookie) | Lost link | `onLinkChange` OFFLINE | **Yes** | "web: a cookie that no longer resolves stays connected as ANONYMOUS, and an ordinary close reconnects" |

The backoff: `reconnectDelayMs(attempt, random)` of `heartbeat-client.ts`, which reads
`RECONNECT_BACKOFF_MS` and `RECONNECT_JITTER_MS`. The new file repeats none of their values; the
static test asserts that no close code and no backoff value is written as a number in it. Tests:
"…the delays are RECONNECT_BACKOFF_MS, and the last one repeats" (500, 1000, 2000, 4000, 8000,
8000, 8000 for 1001, 1013 and 4408), "the jitter is RECONNECT_JITTER_MS at most" (750, 1250), "the
first heartbeat of the new connection ends the backoff".

After an end the consumer decides: `reconnect(reason)` opens a new socket at once, with headers
asked afresh ("reconnect(reason) after an end opens a new socket at once, with headers asked
afresh"; "a handler may call reconnect(): onEnd opens the anonymous socket of the web console at
once").

---

## 5. Resync (AC-C-15)

| Rule | How | Test |
|---|---|---|
| A gap or a newer epoch sends `resync` | Section 3 | "a gap sends one resync, drops deltas until the snapshot, and reports RESYNCING then RESYNCED"; "a delta of a newer epoch sends resync; the snapshot of that epoch replaces the replica" |
| At most one `resync` in 2 s | A `resync` leaves only when `REALTIME_RESYNC_MIN_INTERVAL_MS` plus `LIVE_SOCKET_RESYNC_GUARD_MS` (2,000 + 250 ms) passed since the last one this client sent, on whatever connection. One that must wait is sent at a housekeeping step | "at most one resync in 2 s: a storm of gaps sends exactly one" (40 gap deltas in 1.96 s: 1 `resync`); "…a second gap inside the interval waits, and no two resyncs are closer than 2 s" (four gaps: the test asserts that the four `resync` messages left at 0, 2,500, 5,000 and 7,500 ms); "the 2 s rule holds across a reconnect" |
| The snapshot replaces the replica | `onSnapshot` with `cause: 'RESYNC'`; epoch and revision are the snapshot's; the next delta must be its revision plus 1 | The same tests |
| A new epoch the server announces by a snapshot (reset, scenario load, RT-7) needs no `resync` | `onSnapshot` with `cause: 'EPOCH'` | "a snapshot of a new epoch that the server sends by itself is applied without a resync (RT-7)" |
| The consumer may ask | `requestResync()` | "requestResync: the consumer asks for a snapshot, under the same 2 s rule" |
| No answer | After `syncTimeoutMs` the socket is given up; the new connection starts with a snapshot [SP:RT-6] | "no answer to a resync within the deadline…" |

---

## 6. Verification (command output)

All commands from `/Users/gsp-budi/Documents/DEMS`, with no `cd` (P10). No port was bound, no
database used, no emulator touched, no package installed.

### 6.1 Baseline, before the first edit (09:49:31 to 09:49:40 WIB; `assets/30_baseline.log`)

```
$ npm run test -w @dems/shared -- --maxWorkers=2   (exit 0)
 Test Files  46 passed (46)
      Tests  977 passed (977)
$ npm run typecheck -w @dems/shared   (exit 0)
$ npm run lint -w @dems/shared   (exit 0)
```

### 6.2 Final gate on the finished tree (10:23:14 to 10:23:39 WIB; `assets/30_gate_final.log`)

```
== W30 final gate, 2026-10-04 10:23:14 WIB ==

$ npm run test -w @dems/shared -- --maxWorkers=2

> @dems/shared@0.1.0 test
> vitest run --maxWorkers=2

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared

 Test Files  55 passed (55)
      Tests  1351 passed (1351)
   Start at  10:23:14
   Duration  4.44s (tests 48%, import 38%, transform 12%, worker 1%)

exit=0

$ npm run typecheck -w @dems/shared

> @dems/shared@0.1.0 typecheck
> tsc --noEmit

exit=0

$ npm run lint -w @dems/shared

> @dems/shared@0.1.0 lint
> oxlint

exit=0

$ npm run typecheck -w @dems/core-web

> @dems/core-web@0.1.0 typecheck
> tsc -b

exit=0

$ npm run typecheck -w @dems/mobile

> @dems/mobile@0.1.0 typecheck
> tsc --noEmit

exit=0

$ git diff --stat acaff20 -- packages/shared/test/heartbeat-client.test.ts packages/shared/src/realtime/heartbeat-client.ts
(end of diff stat; exit=0)

$ git status --short packages/shared/src/realtime
 M packages/shared/src/realtime/index.ts
?? packages/shared/src/realtime/live-socket-client.ts
== end 10:23:39 ==
```

Both apps compile the new file, because each imports `@dems/shared/realtime` for
`HeartbeatProvider`: the web under the DOM library, the mobile app under React Native's types.

A first full run on the finished client, at 10:17:24, was green as well: 1,231 passed in 50 files,
all five commands exit 0. One assertion was added to a test of this row afterwards (the four
`resync` times), so the gate was run again; the 120 tests and 5 files between the two runs are the
rows running in parallel.

### 6.3 The three realtime test files (10:23:49 WIB; `assets/30_realtime_tests_verbose.log`)

```
$ npx vitest run --root packages/shared test/realtime-live-socket.test.ts test/realtime-live-platform-neutral.test.ts test/heartbeat-client.test.ts --maxWorkers=2 --reporter=verbose
 Test Files  3 passed (3)
      Tests  134 passed (134)
```

| File | Tests | State |
|---|--:|---|
| `realtime-live-socket.test.ts` | 117 | new |
| `realtime-live-platform-neutral.test.ts` | 13 | new |
| `heartbeat-client.test.ts` | 4 | unchanged (`git hash-object` = `19df2df39a415436fac8ac5b33f0f203767732e3` = `git rev-parse acaff20:packages/shared/test/heartbeat-client.test.ts`) |

### 6.4 No noise (P11)

No run of this row was red for a reason outside its files. Two runs were red for its own reasons
during the work and were fixed before the gate: one type error in the new test (an indexed access),
and one test that let 2.7 s pass without a heartbeat, so the link was STALE where the test expected
ONLINE (the client was right; the test now lets the fake server beat).

### 6.5 Test ledger (P24)

| Workspace | Before (09:49) | After (10:23) | This row | Others in the same time |
|---|---|---|---|---|
| `@dems/shared` | 977 tests, 46 files | 1,351 tests, 55 files (10:23) | **+130 tests, +2 files**: `realtime-live-socket.test.ts` (117), `realtime-live-platform-neutral.test.ts` (13) | +244 tests, +7 files: rows running in parallel (new files seen: six `live-testing-*.test.ts`, `sim-text-cut.test.ts`; some existing `sim-*` test files were also saved in that time). Not counted by this row |
| `@dems/core-web`, `@dems/mobile`, `@dems/core-server` | Not run | Typecheck only (core-web, mobile) | 0 | — |

No existing test file was edited.

### 6.6 Acceptance criteria of the row

| Criterion | Evidence |
|---|---|
| **AC-C-02** (the new file of `src/realtime` names no `node:`, `react-native`, `expo`, `window`, `document`) | `realtime-live-platform-neutral.test.ts`: "AC-C-02: the file names no node:, react-native, expo, window or document (comments included)", with a positive control. Also: it imports no package at all; it imports nothing from the simulator folder, `src/live/source`, `src/live/testing` or `src/client`; the only global it looks up is `WebSocket`, inside the default factory; it writes nothing to the console; the clock, the random source and the timers are injected |
| **AC-C-15** (a gap or a new epoch sends `resync` at most once in 2 s; the snapshot replaces the replica) | Section 5 |
| **AC-C-16** (close codes) | Section 4. The part "4401 moves `auth.status` away from SIGNED_IN" is the Live source's (W44); this row gives it `onEnd` with the reason. "4403 calls the revocation handler": `onEnd` with `kind: 'DEVICE_REVOKED'` |
| CL-7 (the heartbeat view) | "gives the same snapshots as the heartbeat client, step by step, for the same messages": both clients get the same messages, time steps and close, and `getSnapshot()` is compared after every step (CONNECTING, LIVE, STALE, LIVE, OFFLINE with attempt 1, CONNECTING, LIVE with attempt 0, OFFLINE) |
| CL-8 (headers) | "mobile: the headers function is asked at every connect and its value goes to the factory, never into the URL"; "the default factory calls the global WebSocket with the URL alone, or with the headers as the third argument" |
| CL-10 (validation) | Block "every incoming frame is validated; nothing is thrown out of a socket callback (CL-10)" |
| CL-11a, CL-11b | The `reconnect` tests; the meter tests |

---

## 7. Tests

### 7.1 How they run

A fake socket (`send`, `close`, and the server's side: `deliver`, `raw`, `serverClose`, `fail`) and
a manual clock that also owns the four timer functions. Time moves only by `advance(ms)`; the clock
counts the timers that are pending, so "no timer left after `stop()`" is a number that is read, and
it records the delay of every `setTimeout`, so a reconnect delay is compared with
`RECONNECT_BACKOFF_MS` itself. One test runs on the fake timers of the runner instead, with no
`timers` option, so the default timer functions are exercised too. The snapshot fixture is a real
simulator state (`createIdleState`) in its wire form; the other fixtures are the contract's own
examples (`REALTIME_SERVER_EXAMPLES`), and the first test parses every fixture with the union.

### 7.2 Blocks

| Block | Tests |
|---|--:|
| connect, hello, subscribe, snapshot, deltas | 31 |
| the heartbeat view is fed from the one socket (CL-7) | 5 |
| resync on a revision gap or a newer epoch (AC-C-15) | 12 |
| meter frames: the latest wins, nothing is queued (RT-8, CL-11b) | 6 |
| close codes (AC-C-16) | 34 |
| stop() closes cleanly and leaves no timer | 13 |
| every incoming frame is validated; nothing is thrown out of a socket callback (CL-10) | 16 |
| static scan (`realtime-live-platform-neutral.test.ts`) | 13 |

### 7.3 Can the tests fail? (44 single changes; `assets/30_mutations.log`, `assets/30_mutate.py`)

Each change is applied to a copy of the client under `.cache/W30/mut`, the two new test files run
on the copy, and the result is recorded. Final run on the final code, 10:22:47 to 10:23:14 WIB:

```
M00 no change | exit 0 | 130 passed (130)
…
mutations: 44, killed: 43, survived: 1 ['M18 a connection that is not OPERATOR sends']
```

| Changes | Detected |
|---|---|
| 4401 is not an end; 4403 is not an end; an end is followed by a reconnect timer; a close without its code after an announced end reconnects; a web `SESSION_INVALID` hello makes every close an end; a socket error does not reconnect | 6 of 6 |
| The backoff does not grow; no jitter; a heartbeat does not end the backoff; `start()` keeps the old attempt | 4 of 4 |
| No spacing between resyncs; spacing 1.4 s; the 2 s rule per connection; a gap is applied; a delta is applied before its snapshot; a newer epoch is ignored; deltas not dropped while a resync is pending; a delta the replica holds sends resync; RESYNCED never reported; no sync deadline; the deadline after hello not armed | 11 of 11 |
| `stop()` leaves the interval; `stop()` leaves the reconnect timer; `stop()` does not close the socket; `reconnect()` keeps the old socket | 4 of 4 |
| The raw path in a report; the frame text in a report; a handler exception not caught; the callbacks not guarded; the client writes to the console | 5 of 5 |
| Meter: an older frame handed on; handed on when not wanted; the kept frame survives a lost link; no send budget; `subscribe` sent before `hello` | 5 of 5 |
| Headers not handed to the factory; no URL guard; ONLINE before the snapshot; the link never STALE; the heartbeat view never STALE; a second hello accepted; no principal check on received messages; the ISO time of a heartbeat not read | 8 of 8 |
| **M18**: both principal checks before a send removed | **Not detectable**: an equivalent change. `hello` is validated by the contract, whose schema refuses a `hello` whose topics are outside the principal's set, so a connection that is not OPERATOR never has the `meters` or the `state` topic, and the topic checks alone already stop every send. The two principal checks are a second barrier that a valid `hello` cannot reach |

The first mutation run (10:13) showed that close 4403 as a bare code was covered only by the static
scan, because every 4403 test also had a `device.revoked` or a refused `hello` before the close.
Three tests were added ("4401 alone…", "4403 alone…", "4403 before hello"); in the final run each
of the two changes fails two behaviour tests.

---

## 8. CONTRACT-GAP

**None.** Everything the row needs is in the contract of W22:

| Needed | In the contract |
|---|---|
| The union | `WsServerMessageSchema`, `WsClientMessage` |
| Close codes | `RealtimeCloseCode.SESSION_ENDED` (4401), `.DEVICE_REVOKED` (4403); the others need no name here, because every other close reconnects |
| The 2 s rule | `REALTIME_RESYNC_MIN_INTERVAL_MS` |
| The client message limit | `REALTIME_CLIENT_MESSAGE_LIMIT` |
| Who may receive and send what | `canReceiveRealtimeMessage`, `canSendRealtimeMessage`, `REALTIME_SERVER_MESSAGES` |
| Principals, topics, hello reasons | `RealtimePrincipal`, `RealtimeTopic`, `RealtimeHelloReason` |
| Backoff and stale | `RECONNECT_BACKOFF_MS`, `RECONNECT_JITTER_MS`, `HEARTBEAT_STALE_AFTER_MS` (existing) |

Three numbers are the client's own and not the server's business, so they are exported from the
client file and not asked of the contract: section 10, item 1.

---

## 9. Findings for the controller (P22)

**F-1. Two close codes are worded differently in the delegation and in the specification.** The
delegation calls 4403 "forbidden (origin or revoked device)" and 4408 "idle / heartbeat timeout".
The specification and the contract say: 4403 = the device was revoked or unpaired; 4408 = slow
consumer [SP:§9.4]; `RealtimeCloseCode`. The client follows the specification; the reaction to
4408 is the same under either reading (reconnect). For 4403 the difference matters: **an Origin
refusal never arrives as a close code.** It is HTTP 403 at the handshake [SP:§9.2], and so are 401
(a cookie and a bearer value together) and 429 (the throttle, RT-P14). A client cannot read the
status of a refused upgrade; it sees a connect that failed, and retries with the backoff (at most
every 8 s) with the link OFFLINE. So a page opened under a wrong origin gets no end signal from
the socket. It does get 403 `ORIGIN_NOT_ALLOWED` on REST [CS:WT-2a], which is where the Live
source and the Login page learn it. No change asked; the wording of the end kinds here is the
contract's (`SESSION_ENDED`, `DEVICE_REVOKED`).

**F-2. The hypothesis "a React Native client can read a close code" [SP:§9.2, "row 59 (W30)
confirms"] is not confirmed by this row.** The row has no device lock and its verification is the
shared test run; the emulator proof of W12 (probe steps P9 and P10: the bearer header at the
upgrade, and close codes 4403 and 4401 on a device) is still open
(`implementation/12_typed_client_emulator_proof.md` §8.4). What this row did instead: the client
does not depend on the hypothesis. An end is also recognised without the code, from what the server
said before it closed: `session.ended`, `device.revoked`, or a `hello` that refused a bearer value.
So if the mobile runtime hands on no code, a revoked device still ends as DEVICE_REVOKED and an
ended session as SESSION_ENDED, and a bearer value the server refused is not presented again in a
loop (which would also count against the server's denial budget). What stays unmeasured on a
device: that the `headers` option reaches the upgrade request, and the close code itself. The
transport is injected, so a different way of passing headers needs a factory, not a change here.

**F-3. The realtime entry now re-exports the Live client; what that means for the bundles.**
`@dems/shared/realtime` is the subpath the specification gives the Live socket client [CS:§2], and
both apps import that entry for `HeartbeatProvider`. Loading the new file does nothing (it holds
declarations only; a socket is opened only by `createLiveSocketClient(...).start()`). A bundler
that removes unused exports drops it from a Simulated build; **Metro does not remove unused
exports by default, so the file is expected to be inside the mobile bundles, release included, as
code that nothing calls.** Not measured here (no build in this row). If a gate searches the release
bundle for Live code, the string `live-socket-client` (the value of `LIVE_SOCKET_ERROR_SOURCE`)
is a marker to search for. [SP:MC-3] asks that a packaged build has "no client or socket code path
that can run": without a caller it cannot run. If absence from the bundle is wanted, the client
needs its own export subpath, which is a `package.json` change and not this row's path.

**F-4. `src/realtime` now takes one type from `src/live`.** `LiveLinkState` is imported with
`import type` from `../live/mode`, so that the link values of the socket client and of the light
API cannot drift (the file checks equality at compile time). Nothing of `src/live` is loaded at
run time with the socket client; the static test asserts both. The other direction stays
forbidden by the light API's own test.

**F-5. A server that sends no `hello` is not a Core server for this client.** Against mock-core
(heartbeat only) the heartbeat view would turn LIVE, the link would stay CONNECTING, and after
4 s the client would give the socket up and retry. Live mode never addresses mock-core
[CS:§4.2]; noted so that nobody points this client at port 4400 in a test.

**F-6. The fake transport of W31 and this client fit together, and W31's tests now use this
client.** Two readings. (a) A scratch test of this row, on a copy and not kept in the tree, at
10:16 WIB: the client with `fake.socketFactory`, `fake.clock.now` and `fake.clock.timers`; an
OPERATOR start (hello, the `subscribe` the fake received, the snapshot, a delta, `session.ended`
with close 4401 reported as SESSION_ENDED with the reason) and a bearer header that reached the
fake server; 2 tests passed (`assets/30_scratch_fake_transport.log`). (b) By 10:21 W31 had written
`packages/shared/test/live-testing-live-socket.test.ts` (its file, 4 tests), which imports
`createLiveSocketClient`, `LiveSocketFactory` and `LiveSocketTimers` from this row's file and
assigns the fake's factory and timers to those types without a cast; it is part of the 55 green
files of the final gate. Facts for W44: the fake's `FakeTimers` has exactly the shape of
`LiveSocketTimers`; its factory reads the second argument as the headers, which is what this
client passes; its `sessionEnded()` closes with 4401 by itself. **Consequence for a rollback:**
that test of W31 depends on this row's file (section 11).

**F-7. Sizes.** The client file is 1,179 lines: about 300 are the exported types with their
comments, about 70 the header. The behaviour test is 1,767 lines because the row may write only
`realtime-live-*.test.ts` files, so the harness (fake socket, manual clock, fixtures; about 240
lines) could not be a shared helper file and all behaviour tests sit in one file with it.

---

## 10. What the specification left open, and the choice made

| # | Open point | Choice | Why |
|---|---|---|---|
| 1 | Three numbers of the client | `LIVE_SOCKET_SYNC_TIMEOUT_MS` 4,000 (the value of `LIVE_BOOT_TIMEOUT_MS`), `LIVE_SOCKET_RESYNC_GUARD_MS` 250, `LIVE_SOCKET_SEND_BUDGET` 15 (half of `REALTIME_CLIENT_MESSAGE_LIMIT.count`). Exported from the client file. **Not among the six pinned client constants of [PL:§3.4]: a decision to record** | See 2, 3, 4 |
| 2 | What if the awaited message never comes (no `hello`, no snapshot after an OPERATOR `hello`, no answer to `resync`) while heartbeats arrive | After `syncTimeoutMs` the socket is closed and the backoff starts; `SYNC_TIMEOUT` is reported as a warning | Otherwise the link would stay CONNECTING or RESYNCING for ever, and commands would be refused for ever (CL-22). A new connection always begins with a snapshot [SP:RT-6] |
| 3 | "At most one in 2 s" is measured where | On the client clock, with 250 ms added, and across connections | Two messages sent exactly 2 s apart can reach the server less than 2 s apart; the answer to "too many" is close 1008 [SP:§9.4] |
| 4 | RT-P5 (30 client messages in 10 s, else 1008) | The client sends at most 15 in any 10 s on one connection; a `subscribe` or `unsubscribe` beyond that waits for a housekeeping step, and only the last wish is sent | Rapid visibility changes must not get the socket closed |
| 5 | Is the headers function synchronous | Yes; it is asked at every connect | CL-8 says "a function returning"; an asynchronous one would add a state between "closed" and "connecting". The Live source holds the bearer value in memory after sign-in. If it throws or returns a value that cannot be a header (a line break, a name with a space), no socket is opened, `HEADERS_FAILED` is reported and the backoff runs |
| 6 | Default of the `meters` subscription | Wanted. `setMetersWanted(false)` when hidden | The delegation's flow: connect, hello, subscribe |
| 7 | A delta at or below the replica's revision, or of an older epoch | Dropped and counted; no resync | It is not a gap: the replica holds its effect. A resync would only cost a snapshot |
| 8 | A delta before the snapshot of its connection | Dropped; reported once per connection; no resync | The snapshot is on its way and holds its effect |
| 9 | A delta the schema refuses | Dropped and reported (CL-10). The next valid delta shows the gap and the client resynchronises | The revision of a refused message is not trusted |
| 10 | A snapshot nobody asked for | Applied. `cause: 'EPOCH'` when its epoch differs (RT-7), else `'REFRESH'` | A snapshot is the server's whole truth |
| 11 | An end whose close code is missing | Section 9, F-2 | The hypothesis is unmeasured |
| 12 | Does a heartbeat before `hello` count | For the heartbeat view, yes; the link stays CONNECTING until `hello` | The view must behave as the heartbeat client does |
| 13 | When does the backoff end | At the first heartbeat of the new connection, as in the heartbeat client. `hello` and the snapshot alone do not end it | CL-7: the view's `reconnectAttempt` must mean what it means today. It also keeps a 1013 loop (accept, then close before any heartbeat) on the growing delays |
| 14 | `reconnect()` and the attempt counter | Kept. `start()` after `stop()` resets it | "Retry now" must not reset the backoff of a server that is still down |
| 15 | STALE against RESYNCING and CONNECTING | STALE wins | No heartbeat is the more urgent fact; meters fall to "no signal" on STALE [CS:§2.3] |
| 16 | A link that stays STALE | Not dropped by the client, as in the heartbeat client. "Retry now" is `reconnect('RETRY')` | The specification names STALE as a state to show, not a reason to close |
| 17 | RESYNCED after the very first connect failed and the second worked | Reported, with the cause RECONNECT | The heartbeat client calls `onResync` in the same case |
| 18 | The URL | Refused at creation unless it is `ws://` or `wss://`, a host and an optional path | SR-38: no credential in a URL; the same guard as the typed client's (CL-6a) |
| 19 | `reconnect(reason)`: what is `reason` | One of five labels, kept in `getStatus().lastReconnectReason`; not sent to the server | The close frame carries a fixed text ("client reconnect"), so nothing of the consumer's reaches the wire |
| 20 | What a report may hold | A code, a level, the source, the clock, the connection number, `hello.connectionId`, and for a schema failure the message type (when it is one of the nine), the issue code and the place as member names and indices; a name that is not plain (an underscore, for one) is shown as `?` | "Never the raw payload in a log"; a bearer value has an underscore and cannot ride in a path |

Error handling and logging (the agent's standing rule). This is a library file with no UI and no
storage, so the three layers are split as follows: the client reports every failure and every
dropped message to `onError` as one structured record (`code`, `level`, `source`, `at`,
`connection`, `connectionId` as the correlation ID) and counts it in `getStatus().counters`
whether or not a sink is set; it writes nothing to the console. Persisting the record is the
consumer's part: the Live source keeps the last 50 [CS:§2.3 `errors()`], and each app decides
where they go. User feedback is the Live source's and the shells' (`onLinkChange`, `onEnd`).

---

## 11. Rollback (R-NEW; R-CO for `realtime/index.ts`)

Run only on the controller's instruction [PL:§8.1].

```sh
# R-NEW: the three files this row created (untracked)
git clean -fd -- packages/shared/src/realtime/live-socket-client.ts \
                 packages/shared/test/realtime-live-socket.test.ts \
                 packages/shared/test/realtime-live-platform-neutral.test.ts
# R-CO: the one tracked file, of which this row is the only writer so far
git checkout acaff20 -- packages/shared/src/realtime/index.ts
# P23: the pre-image is empty (the file was equal to acaff20), so this changes nothing; it is here for the form
git apply --allow-empty .cache/rollback/W30.pre.patch
```

Checked without running it on the tree: `git apply --allow-empty --check
.cache/rollback/W30.pre.patch` exits 0, and `git apply --check -R .cache/rollback/W30.post.patch`
exits 0 (`W30.post.patch` is the one added line; applying it again restores this row's change).
After a checkpoint commit that holds the three new files, `git clean` is replaced by
`git rm` of the same paths.

What depends on the row at its end: one file outside its paths imports `live-socket-client`,
`packages/shared/test/live-testing-live-socket.test.ts` of the fake-transport row W31 (F-6). A
rollback of this row therefore breaks that test and the shared typecheck until W31's test is
removed or W31 is rolled back with it. No production file imports the client yet (the Live source
row W44 will).

`git hash-object` at the end of the row:

| File | Blob |
|---|---|
| `packages/shared/src/realtime/live-socket-client.ts` | `b118f5ab3b1004ab785666d8c51d1902121773e1` |
| `packages/shared/src/realtime/index.ts` | `c28273b10d75fe57452f04d5320a303672766732` |
| `packages/shared/test/realtime-live-socket.test.ts` | `9969a6e17d03b73244335fcbf5af3a4f70f3e408` |
| `packages/shared/test/realtime-live-platform-neutral.test.ts` | `fc141272522ee5564f7ce3a432ff591658191a37` |

---

## 12. Limits of this evidence

- Everything here is a unit test on a fake socket. No real server, no browser and no device was
  used: the Core server's realtime channel (W42) is a later row, and the first run of this client
  against it is the Live source's and the gate rows'.
- The default factory's third argument (`{ headers }`) is tested against a stand-in for the global
  constructor, not against React Native.
- F-2 and F-3 are stated as not measured.
- The scratch run of F-6 used the other row's files at one moment.

---
*Generated: 2026-10-04 10:26 WIB*
