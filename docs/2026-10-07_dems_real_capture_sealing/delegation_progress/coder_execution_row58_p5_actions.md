---
task_id: 2026-10-07_dems_real_capture_sealing
row: 58 (M3-W2), part P5, slice "SH-18 / CS-04 telemetry actions" (helper of the driver)
date: 2026-10-09
agent: coder-execution
status: needs-review
narrative_tier: 2
base: HEAD 101ce62 (working tree, not committed)
---

# Row 58 / P5: `applyCaptureTelemetry` and `raiseCaptureWarning`, end to end

Status **needs-review**: the two INTERNAL actions exist from `@dems/shared` to the engine host
and are tested, but (a) one line outside the slice had to change for the durable part to work at
all (`db/store/store.ts`, section 5), and (b) seven semantic points are decisions taken from the
specs that the driver/navigators must confirm (section 3, "open").

## 1. Files

Created

| File | What |
|---|---|
| `packages/shared/src/sim/capture-telemetry.ts` | the transitions: `feedCaptureLevels`, `applyCaptureTelemetryTransition`, `captureTelemetryChangesState`, `raiseCaptureWarningTransition`, `micInputOfCaptureRole` |
| `packages/shared/test/sim-capture-telemetry.test.ts` | 13 tests |
| `apps/core-server/src/engine/__tests__/capture-actions.db.test.ts` | 5 db tests (as `dems_app`) |
| this file | |

Updated

| File | Change |
|---|---|
| `packages/shared/src/sim/types.ts` | input types (section 2) + the two members of `SimActions` after `setTabletLink` |
| `packages/shared/src/sim/actions.ts` | the two actions |
| `packages/shared/src/sim/audio.ts` | `AudioRuntime.captureLevels`, `CaptureLevelFeed`, `captureLevelAt`; the audio subsystem shows a fresh measured level in place of the generated one |
| `packages/shared/src/sim/constants.ts` | `CAPTURE_LEVEL_HOLD_MS = 1_000` |
| `packages/shared/src/sim/faults.ts` | `raiseFaultAtKey` split out of `injectFaultTransition` (same body, same behaviour; `inject` now delegates to it) |
| `packages/shared/src/sim/index.ts` | `export * from './capture-telemetry'` |
| `packages/shared/src/api/sim-actions.ts` | two INTERNAL lines, header counts |
| `packages/shared/src/live/source/bindings.ts` | two LOCAL bindings that resolve (as `setTabletLink`), header counts |
| `packages/shared/src/api/core-api.ts`, `live/source/index.ts`, `live/source/types.ts`, `live/source/live-sim.ts` | comment counts only |
| `apps/core-server/src/engine/types.ts` | the two entry points on `EngineHost` |
| `apps/core-server/src/engine/host.ts` | their implementation |
| `apps/core-server/src/engine/limits.ts` | `ENGINE_UNIT_LABEL.captureTelemetry`, `.captureWarning` |
| `apps/core-server/src/engine/hosted-actions.ts` | comment counts only |
| `apps/core-server/src/db/store/store.ts` | **outside the slice**: `kind` removed from the `ON CONFLICT DO UPDATE SET` list of `capture_devices` (section 5) |
| five engine test doubles: `modules/{demo,devices,storage,system}/__tests__/support.ts`, `modules/sessions/__tests__/memory-engine.ts` | `applyCaptureTelemetry` / `raiseCaptureWarning` as `unused` / `notUsed` / `unsupported`, next to `setTabletLink` |
| tests with pins | section 4 |

Not touched: `packages/capture-protocol/**`, `apps/core-server/src/capture/**`, `apps/capture-worker/**`,
`config.ts|app.ts|index.ts`, `apps/transcriber/**`, `redaction.ts`, `transcription.ts` and their tests,
migrations, `packages/shared/openapi/**` (no generator was run; `git status` shows `openapi.json`
modified by another round, not by this one). No new dependency. Nothing committed, deleted or renamed.

## 2. Signatures (verbatim)

`packages/shared/src/sim/types.ts`

```ts
export type CaptureIngestStateName = 'WAITING' | 'CONNECTED' | 'ENDED';

export interface CaptureTelemetryLevel {
  role: MicRole;
  /** dBFS, at most 0. `null`: the input delivers no samples (the meter shows NO SIGNAL). */
  dbfs: number | null;
  /** The worker saw a clipped sample in this frame. */
  clipped: boolean;
}

export interface CaptureTelemetryIngest {
  deviceId: string;
  state: CaptureIngestStateName;
}

export interface CaptureTelemetryFragments {
  deviceId: string;
  count: number;
  bytes: number;
}

export interface CaptureTelemetryInput {
  levels: readonly CaptureTelemetryLevel[];
  ingest: readonly CaptureTelemetryIngest[];
  fragments: readonly CaptureTelemetryFragments[];
}

export type CaptureWarningCode = Extract<FaultKind, 'MIC_SILENT' | 'CAPTURE_FAULT'>;

export interface CaptureWarningInput {
  code: CaptureWarningCode;
  subject: string | null;
}

// SimActions
applyCaptureTelemetry(telemetry: CaptureTelemetryInput): void;
raiseCaptureWarning(warning: CaptureWarningInput): void;
```

All exported from `@dems/shared/sim`. The three lists are the three lists of `TelemetryMessageSchema`
field for field, and `{ code, subject }` is the WARNING frame's, so the forwarder's translation is
`{ levels: m.levels, ingest: m.ingest, fragments: m.fragments }` and `{ code: m.code, subject: m.subject }`.
`CaptureMicRole`, `CaptureIngestState` and `CaptureWarningCode` of `@dems/capture-protocol` are
string-equal to `MicRole`, `CaptureIngestStateName` and `CaptureWarningCode` here, so they assign
without a cast. `@dems/shared` imports nothing from the protocol package.

`apps/core-server/src/engine/types.ts` (`EngineHost`)

```ts
applyCaptureTelemetry(telemetry: CaptureTelemetryInput): Promise<EngineOutcome<void>>;
raiseCaptureWarning(warning: CaptureWarningInput): Promise<EngineOutcome<void>>;
```

| Entry point | Resolves with | No-op when | Rejects with |
|---|---|---|---|
| `applyCaptureTelemetry` | `{ value: undefined, epoch, revision }` | the frame changes neither `captureDevices` nor `captureConfig`: **no unit is opened**, no statement, same revision, no `state` publication; resolves at once with the current position. The levels are still taken (they are never stored) | 503 `NOT_READY` (`ApiFailure`) when the engine is not running or the unit did not commit; the thrown error when the simulator could not read the frame (logged + persisted, `engine.host`) |
| `raiseCaptureWarning` | `{ value: undefined, epoch, revision }` | that fault is already active for the same subject: one empty unit, no statement, same revision | `SimNotFoundError` for an unknown subject or code (nothing stored, engine state set back, persisted by the host's `undo` with `context.label = 'engine.raiseCaptureWarning'`); 503 `NOT_READY` |

A no-op is recognisable by `outcome.revision` being the revision before the call.

Coalescing (for the forwarder): while one telemetry unit waits for its turn, every later
`applyCaptureTelemetry` call replaces the frame that unit will apply and returns **the same promise**.
At most one telemetry unit is ever queued; the newest frame wins. A rejection of that unit reaches
every caller that joined it, so each call needs its own `.catch`.

## 3. Decisions (each with its source) and open points

| # | Decision | Source | Open? |
|---|---|---|---|
| D-1 | **Levels follow the existing meters path and are never stored.** The `audio` slice is streamed, not replicated: it is not a durable slice (`engine/write-plan.ts:20-22`) and goes out as `{ kind: 'meters' }` after a tick when its reference changed (`engine/host.ts` `publishMeters`, `settle`). The action puts the level into `AudioRuntime.captureLevels` (the precedent is `testToneUntil`, "transient engine state that actions may set"), and the 20 Hz audio subsystem shows it in its next frame of that input: `dbfs` as measured (through the same ballistics, so `peak` holds), `null` as NO SIGNAL at -90, `clipped` latching `mics[].clipLatched` exactly as a generated clip does | C3 §6 "Changed streamed slice"; SH-17; `sim/audio.ts` | no |
| D-1a | A measured level is shown for `CAPTURE_LEVEL_HOLD_MS = 1000` ms after the Core took it; then the meter falls back to the **generated** level. The constant is this row's choice (20 missed frames), measured by no spike | none (own choice) | **yes**: after a worker dies mid-recording the meters show generated speech again after 1 s. That is the pre-existing stand-in (before this row every meter was generated), but it should be decided whether "no feed while RECORDING" must read NO SIGNAL instead |
| D-2 | **Ingest to camera:** `CONNECTED` -> `online: true, streamState: LIVE`; `WAITING` -> `online: false, streamState: LOST`; `ENDED` -> LOST **only while the session is RECORDING**, otherwise unchanged. Written to the camera of `captureDevices` and to the rows of `captureConfig.cameras` naming the same device. `online` and `streamState` move together because the table cannot hold them apart (`db/mapping/rows.ts` `captureDeviceFromRow`: `streamState = enabled ? 'LIVE' : 'LOST'`) | C3 §6 slices 29/30; OD-22; `rows.ts:706-715` | **yes** (the ENDED rule): the worker closes its ingests on a normal stop; without the rule every camera would read LOST (and a PoE cycle would be legal) after every recording. If the worker reports a mid-recording loss as WAITING and uses ENDED only at stop, the rule can become "ENDED changes nothing" |
| D-2a | `captureConfig.updatedAt` is not moved by telemetry: it is the selector's edit stamp and the `revision` a session snapshot records (`session-machine.ts` `captureConfigSnapshot`). The open session's snapshot is not touched (OD-10) | OD-10 | no |
| D-2b | An ID that names no CAMERA of `captureDevices` (unknown, a mic, the PoE switch) and a role no mic row holds are ignored, not thrown: one bad entry must not drop a 20 Hz frame | own | no |
| D-3 | **`fragments` is carried and not applied.** No slice holds a fragment count or byte count of a file while a session records (`fragmentCount` exists on the sealed evidence file only, `sim/types.ts` evidence files) | `sim/types.ts`; row 82 owns sealing | **yes**: if the recording screen is to show real bytes written, a slice field has to be named first; a per-fragment durable write (every 2 s per camera) would be acceptable, a per-frame one not |
| D-4 | **Mic `online` is not derived from the levels.** `dbfs: null` shows NO SIGNAL on the meter and nothing else: a durable flag flipped by a 20 Hz value could be written 20 times a second, and §E.1 puts the 2 s disconnect debounce in the worker, which reports it as a warning | `capture-spec §E.1` | **yes** (who sets `captureConfig.mics[].online`) |
| D-5 | **A warning is the fault of its kind, through `inject`'s own path:** `FaultKind.MIC_SILENT` / `FaultKind.CAPTURE_FAULT`, one alert (`alerts.kind`), one `FAULT_RAISED` audit row and event, `actorId: null`. All of it is existing vocabulary; no error code, audit type, event type or fault kind was added and no pinned count moved. Idempotent by `isFaultActive(kind, key)`: the same warning while active returns the same state | `sim/faults.ts`; `sim/vocabulary.ts:233-234` | no |
| D-5a | **The audit type `MIC_SILENT` of C3 §5.2 is NOT written.** Its detail list requires `sinceMs` (media-pts ms the silence began; `core/audit-details.ts:236-242`, all five keys REQUIRED) and the WARNING frame carries only `{ code, subject }`. Inventing a value would be a false record | C3 §5.2; `capture-protocol` `WarningMessageSchema` | **yes**: either the WARNING frame gains `sinceMs` (protocol change, driver's) and a later row writes the `MIC_SILENT` row, or the contract accepts `FAULT_RAISED{kind: MIC_SILENT}` as the record |
| D-5b | Never a switch (OD-11): the transition does not touch `audio.activeInputId` or `session.audioSource`; tested in shared and against PostgreSQL (no `AUDIO_SOURCE_SWITCHED` row) | OD-11; `capture-spec §E.1` | no |
| D-5c | Subject resolution. `MIC_SILENT`: null -> the active input (the default of `inject`); a mic role / input ID / mic device ID -> the channel of that input. `CAPTURE_FAULT`: null -> no target (the supervisor's own warning); a `captureDevices` ID -> that ID; a mic role / input ID -> that mic's device ID. Roles are read from the open session's snapshot when it has one, else from the selector. Anything else throws `SimNotFoundError`: a warning is never recorded against a device the Core does not know | own; `db/fixtures/operations.ts:87-88` (targets `MIC-01`, `CAM-01`) | review |
| D-5d | `CAPTURE_FAULT` raises a CRITICAL alert and does **not** move the session machine to FAULT: it is not in `CRITICAL_FAULTS` and `faults.ts:64-66` says that is SH-06's decision (blueprint row 51) | `sim/faults.ts:64-66` | **yes** (row 51) |
| D-5e | There is no clear path from the capture layer: the spec names no "warning cleared" message. The fault stays until an operator's `clearFault` (hosted, exists). A warning raised when no session is open is still raised (the audit row then has no session ID) | `capture-spec §B.1` table | **yes** |
| D-6 | The inputs carry no `sessionId`. Device state is not per session, and dropping a warning because its session just closed would lose a fault | own | review |
| D-7 | Telemetry that marks a camera LOST does not raise `CAMERA_LOSS`; only a warning raises a fault | `capture-spec §B.1` (telemetry and warning are two actions) | review |
| D-8 | **Engine fast path.** `engine.applyCaptureTelemetry` asks `captureTelemetryChangesState(liveState, frame)` first; when false it calls the action outside a unit (the action then touches only the transient runtime, never the store) and resolves. This goes beyond `setTabletLink`, which always opens a unit (an empty one sends no statement either); at 20 Hz it keeps the pipeline's queue free. If the live state is later set back by another unit, the next frame (50 ms) sees the difference and opens a unit | HARD REQUIREMENT of the brief; `commands.db.test.ts:589-600` | review |
| D-9 | A telemetry unit runs with cause `'command'`, exactly like `setTabletLink` (so `noteOutcome` is called for it, as for the tablet link) | `engine/host.ts` `setTabletLink` | no |

## 4. Count pins changed (the count really changed: 42 -> 44 actions, internal 1 -> 3, local 2 -> 4; hosted stays 31)

| File:line (after) | Old -> new |
|---|---|
| `packages/shared/test/api-domain-operations.test.ts:639` | `toHaveLength(42)` -> `toHaveLength(44)` |
| `packages/shared/test/api-domain-operations.test.ts:643` | `[31, 9, 1, 1]` -> `[31, 9, 1, 3]` (hosted 31, server-native 9, not-available 1 unchanged) |
| `packages/shared/test/api-domain-operations.test.ts:648` | `byExecution('internal')` `['setTabletLink']` -> `['setTabletLink', 'applyCaptureTelemetry', 'raiseCaptureWarning']` |
| `packages/shared/test/api-domain-operations.test.ts:650` | the "no operation path" regex `tablet-?link\|security-?key` gains `\|telemetry\|capture-?warning` (stricter, still `[]`) |
| `packages/shared/test/api-domain-operations.test.ts:632, 642` | titles "the 42 ..." / "1 is internal" -> 44 / "3 are internal" |
| `packages/shared/test/live-source-bindings.test.ts:203` (was 194) | `toHaveLength(42)` -> `toHaveLength(44)` |
| `packages/shared/test/live-source-bindings.test.ts:220` (was 211) | LOCAL `['signInWithSecurityKey', 'setTabletLink']` -> `[..., 'applyCaptureTelemetry', 'raiseCaptureWarning']` |
| `packages/shared/test/live-source-bindings.test.ts:130-137` | `ARGS` gains the two members (the table is typed by `SimActions`; it did not compile without them) |
| `packages/shared/test/live-source-bindings.test.ts:1-3, 7, 84, 199, 211` | comments/titles 42 -> 44, "43rd" -> "45th", "2 local" -> "4 local" |
| `packages/shared/test/live-source-platform-neutral.test.ts:393` | comment 42 -> 44 |
| `apps/core-server/src/engine/__tests__/hosted-actions.test.ts:27` (was 25) | `toHaveLength(42)` -> `toHaveLength(44)`; `:26` `HOSTED_ACTIONS toHaveLength(31)` **unchanged** |
| `apps/core-server/src/engine/__tests__/hosted-actions.test.ts:20-21` | `NOT_HOSTED` gains the two names (two more `it.each` rows) |
| `apps/core-server/src/engine/__tests__/commands.db.test.ts:302` | the "not hosted through `engine.command`" list gains the two names (stricter) |

Unchanged and checked: the 31-hosted pins and messages (`engine/host.ts` x2, `hosted-actions.ts:17,32`),
"40 actions reach 41 operations", `CORE_API_OPERATIONS.length - reached.length` = 51, the eight
`LiveActionFlow` values, 33 command bindings. `apps/core-web` and `apps/mobile` hold **no** pin of the
action count (grep of section 7 returns none there); both suites pass unchanged. No pinned
error/audit/event/fault count moved. OpenAPI totals 92/35/57/63: not regenerated, `openapi.test.ts`
passes inside the shared suite.

## 5. Finding outside the slice: `capture_devices` could not be updated by `dems_app`

The first run of the db test failed:

```
StoreError: WRITE_FAILED: capture_devices: the server answered 42501.
 ❯ insertInto src/db/store/store.ts:175:11   ❯ applyChanges ...   ❯ flush src/engine/host.ts
```

Cause: the engine's write-through of a changed registry row is an `INSERT ... ON CONFLICT (id) DO
UPDATE SET kind = ..., transport = ..., ...` (`db/store/store.ts`), and migration
`0005_capture_privileges.sql:39-40` grants `dems_app` UPDATE on `transport, model, firmware, address,
mac, onvif_uuid, profiles, poe_port, enabled, last_seen_at` — **not** on `kind`. PostgreSQL checks
the column privilege of every column in the SET list, so every update of an existing device failed.
No test wrote this path as `dems_app` before (`grep -rn onConflict apps/core-server/src/**/__tests__`
-> none); row 58 is its first writer.

Fix applied (one line + comment): `kind` removed from the SET list. A device's kind never changes
under its ID, and the store's own comment says the upsert updates "every column the grant list
names". No migration, schema version stays 2. Residual: if a state ever re-kinds an existing ID, the
row keeps its old kind silently; `diffCapture` could refuse that (not done here).
**The driver/navigators should confirm this edit**, since `db/store` is outside the slice.

## 6. Tests and their negative controls

`packages/shared/test/sim-capture-telemetry.test.ts` (13) and
`apps/core-server/src/engine/__tests__/capture-actions.db.test.ts` (5). In-test controls: every
"nothing happens" assertion is followed by the same call with a changing input that does write.
Mutations run with `$TMPDIR/mutate.py` (each applied, tests run, source restored):

| Mutation | shared file | db file |
|---|---|---|
| M1 the transition returns `{ ...state }` when nothing changed | exit 1, 6 failed | exit 1, 1 failed |
| M2 the host has no fast path (always a unit) | - | exit 1, 1 failed |
| M3 `raiseFaultAtKey` without the "already active" check | exit 1, 2 failed | exit 1, 1 failed |
| M4 a `MIC_SILENT` warning flips `audio.activeInputId` | exit 1, 2 failed | exit 1, 1 failed |
| M5 the audio subsystem ignores measured levels | exit 1, 3 failed | exit 1, 1 failed |
| M6 `ENDED` is a loss in every session state | exit 1, 1 failed | - |
| M7 later frames do not join the waiting unit | - | exit 1, 1 failed |
| M8 an unknown `CAPTURE_FAULT` subject is not refused | exit 1, 1 failed | exit 1, 1 failed |

## 7. Commands and results (all from the repo root)

```
grep -rn "setTabletLink" apps packages --include='*.ts' --include='*.tsx' --exclude-dir=node_modules
grep -rnE "toHaveLength\(42\)|The 42 action|42 actions|31 hosted" apps packages --include='*.ts' --include='*.tsx' --exclude-dir=node_modules
```

| Command | Result |
|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2 </dev/null` | 75 files, **1984 passed**, 0 failed (baseline 1936; this slice adds 13 + 2 `it.each` rows; the rest comes from the other rounds working in the tree) |
| `npm run typecheck -w @dems/shared` / `npm run lint -w @dems/shared` | exit 0 / exit 0 |
| `npm run test -w @dems/core-server -- --maxWorkers=2 </dev/null` (sandbox off: `stt-config` binds loopback) | **3 failed / 4253 passed** (4256); the 3 are the known ones: `modules/sessions/__tests__/routes.test.ts` x2, `modules/evidence/__tests__/routes.test.ts` x1. Inside the sandbox the same run shows 7 failed: the 4 extra are `stt-config/routes.test.ts` with `listen EPERM 127.0.0.1` |
| `npm run typecheck -w @dems/core-server` / `npm run lint -w @dems/core-server` | exit 0 / exit 0 |
| `npm run test -w @dems/core-web -- --maxWorkers=2 </dev/null` | 117 files, **1523 passed** |
| `npm run typecheck -w @dems/core-web` | the 2 known `PrecheckCheckId` errors (`devices-step.tsx:27, :267`) |
| `npm run test -w @dems/mobile -- --maxWorkers=2 </dev/null` | 194 suites, **2020 passed** |
| `npm run typecheck -w @dems/mobile` | the 1 known `PrecheckCheckId` error (`check-icon.tsx:9`) |
| `npm run test:db -w @dems/core-server -- --maxWorkers=2 src/engine/__tests__/capture-actions.db.test.ts </dev/null` (sandbox off) | 5 passed |
| `npm run test:db -w @dems/core-server -- --maxWorkers=2 src/db/store src/engine/__tests__/ticks.db.test.ts src/engine/__tests__/recording.db.test.ts src/engine/__tests__/capture-actions.db.test.ts src/engine/__tests__/commands.db.test.ts src/modules/devices/__tests__/effects.db.test.ts </dev/null` (sandbox off) | 6 files, 60 passed |

The full db project was not run (the driver runs it once under the migrate lock).

## 8. Real versus stand-in

| Part | State |
|---|---|
| The two actions, their bindings, the engine entry points, the durable write of slices 29/30 | real, tested against PostgreSQL as `dems_app` |
| The levels on the meter frames | real path; **no worker feeds it yet** (the forwarder is the driver's) |
| Meters when no frame is fresh | stand-in: the simulator's generated conversation (as before this row) |
| `fragments` | accepted, not applied (D-3) |
| The `MIC_SILENT` audit type of C3 §5.2 | not written (D-5a) |
| Clearing a capture warning | operator `clearFault` only (D-5e) |

---

# Fix round 1 (decision D72; findings A-1, A-2, A-4, A-15 of `pair_58_navigator_a.md`)

Status **complete** for the four items. Date 2026-10-09. Nothing committed.

## F1. Files of this round

Created: `apps/core-server/src/capture/__tests__/forwarder-engine.test.ts` (the joined test, 3 tests; the one file under `capture/` this slice may write).

Updated

| File | Change |
|---|---|
| `packages/shared/src/sim/types.ts` | `clearCaptureWarning` on `SimActions`; `CreateSimOptions.capture`, type `CaptureLevelSource` |
| `packages/shared/src/sim/capture-telemetry.ts` | `clearCaptureWarningTransition`, `captureTelemetryIgnored`; raise and clear share one subject resolution (`faultOfCaptureWarning`) |
| `packages/shared/src/sim/faults.ts` | `clearFaultAtKey` split out of `clearFaultTransition` (same body; `clearFault` delegates) |
| `packages/shared/src/sim/audio.ts`, `engine.ts`, `constants.ts` (comment) | `AudioRuntime.levelSource`; `createAudioRuntime(levelSource)`; with `'external'` an input without a fresh measured level reads NO SIGNAL and nothing is generated |
| `packages/shared/src/sim/actions.ts`, `api/sim-actions.ts`, `live/source/bindings.ts` | the third action: INTERNAL, `operations: []`, LOCAL binding that resolves |
| `packages/shared/src/api/core-api.ts`, `live/source/{index,types,live-sim}.ts` | comment counts 44 -> 45 |
| `apps/core-server/src/engine/types.ts`, `host.ts`, `limits.ts` | `engine.clearCaptureWarning`; `EngineHostDependencies.captureLevels`; `noteIgnoredTelemetry`; label `engine.clearCaptureWarning` |
| `apps/core-server/src/engine/headless-sim.ts`, `index.ts` | the capture mode reaches the simulator (F3) |
| `apps/core-server/src/engine/hosted-actions.ts` | comment counts |
| `apps/core-server/test/support/engine.ts` | `EngineAppOptions.captureMode` (optional; default unchanged) so a db test can boot the app in mode `real` |
| five engine test doubles | `clearCaptureWarning` next to the other two |
| tests | `packages/shared/test/sim-capture-telemetry.test.ts` 13 -> 21; `engine/__tests__/capture-actions.db.test.ts` 5 -> 8; pins (F4) |

Not touched: `packages/capture-protocol/**`, `apps/core-server/src/capture/**` except the one new test, `test/support/capture*`, `apps/capture-worker/**`, `config.ts` (read only), migrations, OpenAPI. `.data/pg*.env` was never read.

## F2. Signatures (verbatim)

```ts
// @dems/shared/sim — SimActions
clearCaptureWarning(warning: CaptureWarningInput): void;

// @dems/shared/sim — CreateSimOptions
capture?: CaptureLevelSource;
export type CaptureLevelSource = 'simulated' | 'external';

// @dems/shared/sim — capture-telemetry.ts
export function clearCaptureWarningTransition(state: SimState, now: EpochMs, warning: CaptureWarningInput): SimState;
export function captureTelemetryIgnored(state: SimState, telemetry: CaptureTelemetryInput): string[];

// apps/core-server/src/engine/types.ts — EngineHost
clearCaptureWarning(warning: CaptureWarningInput): Promise<EngineOutcome<void>>;

// apps/core-server/src/engine/host.ts — EngineHostDependencies
readonly captureLevels?: CaptureLevelSource;
```

`engine.clearCaptureWarning`: one unit, no actor. Clears that fault through the simulator's own clear
path (`clearFaultAtKey`, the body of `clearFault`): the alert is resolved, one `FAULT_CLEARED` audit
row and event (existing vocabulary; no type added). No-op (no statement, same revision) when that
fault is not active. Rejects with `SimNotFoundError` for a subject `raiseCaptureWarning` refuses,
with 503 `NOT_READY` when the engine is not running. Operation 74 is untouched.

## F3. Decisions of this round

| # | Decision |
|---|---|
| F-D1 (A-2) | After a clear, `raiseCaptureWarning` for the same subject is a new fault: new `faults.active` entry, new alert ID, new `FAULT_RAISED` row. Tested in shared, against PostgreSQL and through the forwarder |
| F-D2 (A-2) | **`MIC_SILENT` cleared with subject `null` clears EVERY active `MIC_SILENT`.** With a subject, exactly that input's. Reason: raise with `null` takes the input that is active then; after an operator switch a symmetric clear would resolve to the other input and leave the first warning behind for good. All other cases clear exactly the key that raise used |
| F-D3 (A-1) | Vocabulary as ruled: capture-device IDs (`CAM-0x`, `MIC-0x`), a mic role, or null. A track ID is not resolved anywhere: in a warning it throws `SimNotFoundError` (and the driver's supervisor already ends the worker for it: `PROTOCOL_VIOLATION` / `WARNING_SUBJECT_UNKNOWN`); in telemetry it is ignored (D-2b kept) |
| F-D4 (A-1) | **Ignored IDs are made visible by the host, once per engine run and value** (the "counter the host logs once" option, not an outcome field: the action stays `void` and the outcome stays `EngineOutcome<void>`). `captureTelemetryIgnored` (shared, pure) names them as `levels:<role>`, `ingest:<id>`, `fragments:<id>`; `engine.applyCaptureTelemetry` writes ONE warn line and ONE error-log entry (`level: 'warn'`, `source: 'engine.host'`, `context.ignored`) per distinct value, the set is cleared at every engine start and holds at most 64 values |
| F-D5 (A-4) | **The mode reaches the simulator as a creation option.** `engine/index.ts` reads `app.config.captureMode` once and passes `captureLevels: 'external' \| 'simulated'` to the host; the host passes it to `createHeadlessSim({ capture })` at every start; `createSim({ capture })` gives it to the audio runtime. `@dems/shared` reads no environment. Default everywhere: `'simulated'` (web, mobile and every existing test are unchanged) |
| F-D6 (A-4) | With `'external'` NOTHING is generated, in any session state: no fresh measured level -> NO SIGNAL (-90, `noSignal: true`), before the first frame, after the last one (older than `CAPTURE_LEVEL_HOLD_MS`, still 1000), with the worker down, and also while idle. No generated `AUDIO_PEAK` timeline item, no generated clip burst, no test tone. **For review:** an idle Core in mode `real` therefore shows NO SIGNAL on both meters until something measures (the status feed of row 66); a missing feed raises no fault by itself (the worker/supervisor warn) |
| F-D7 (A-15) | No change. Seen nothing that contradicts the monotonic ingest; the telemetry unit is still at most one in the queue |

## F4. Pins moved (44 -> 45 actions, internal 3 -> 4, local 4 -> 5; hosted stays 31)

| File:line (after) | Old -> new |
|---|---|
| `packages/shared/test/api-domain-operations.test.ts:639` | `toHaveLength(44)` -> `toHaveLength(45)` |
| `packages/shared/test/api-domain-operations.test.ts:643` | `[31, 9, 1, 3]` -> `[31, 9, 1, 4]` |
| `packages/shared/test/api-domain-operations.test.ts:648` | internal list gains `'clearCaptureWarning'` |
| `packages/shared/test/api-domain-operations.test.ts:632, 642` | titles 44 -> 45, "3 are internal" -> "4 are internal" |
| `packages/shared/test/live-source-bindings.test.ts:204` (was 203) | `toHaveLength(44)` -> `toHaveLength(45)` |
| `packages/shared/test/live-source-bindings.test.ts:221` (was 220) | LOCAL list gains `'clearCaptureWarning'` |
| `packages/shared/test/live-source-bindings.test.ts:138` | `ARGS` gains the member |
| `packages/shared/test/live-source-bindings.test.ts:333` | new: `plan('clearCaptureWarning', idle)` resolves |
| `packages/shared/test/live-source-bindings.test.ts:1-3, 7, 84, 200, 212` | comments/titles 44 -> 45, "45th" -> "46th", "4 local" -> "5 local" |
| `packages/shared/test/live-source-platform-neutral.test.ts:393` | comment 44 -> 45 |
| `apps/core-server/src/engine/__tests__/hosted-actions.test.ts:28` (was 27) | `toHaveLength(44)` -> `toHaveLength(45)`; `:27` `HOSTED_ACTIONS toHaveLength(31)` unchanged |
| `apps/core-server/src/engine/__tests__/hosted-actions.test.ts:22` | `NOT_HOSTED` gains the name |
| `apps/core-server/src/engine/__tests__/commands.db.test.ts:302` | the not-hosted list gains the name |

No pinned error/audit/event/fault count moved. Public totals unchanged:
`node --import tsx packages/shared/scripts/gen-openapi.ts --check` -> `openapi.json is up to date (all (committed): 92 operations ...)`, exit 0.

## F5. Tests of this round and how each was proven

Every new test passed first on the fixed code and was then proven by a mutation (`$TMPDIR/mutate2.py`: apply, run, restore):

| Mutation | shared (21) | db (8) | joined (3) |
|---|---|---|---|
| N1 `clearCaptureWarning` clears nothing | 2 failed | 1 failed | 1 failed |
| N2 the external source still generates | 2 failed | 1 failed | - |
| N3 the host does not pass the capture mode on | - | 1 failed | - |
| N4 an ignored ID is said on every frame | - | 1 failed | - |
| N5 an ignored ID is not said at all | - | 1 failed | - |
| N6 telemetry accepts a track ID as its camera | 1 failed | - | 1 failed |
| N7 `MIC_SILENT` without subject clears the active channel only | 1 failed | - | - |
| N8 `ENDED` never marks a camera lost | 2 failed | - | 2 failed |
| N9 a mic device ID resolves to the other input | 3 failed | - | 1 failed |

The joined test: real supervisor on `FakeWorkerProcess`, real `forwardCaptureEvents`, real simulator
(`createSim`, recording scenario, `capture: 'external'`); the engine stand-in only turns a call into
the simulator's action and records `captureTelemetryIgnored` as the host does (the host's own
once-per-run logging is the db test "A-1"). It shows: `CAM-02` ingest `ENDED` while recording -> LOST
in both slices; `PRIMARY` `dbfs: null` -> NO SIGNAL on MIC-01 only; `CAPTURE_FAULT` `CAM-02` -> alert +
audit; `MIC_SILENT` `MIC-01` -> AUDIO-01, role `STANDBY` -> AUDIO-02, role `PRIMARY` -> AUDIO-01;
`CLEARED` -> cleared after the 2 s hold (not after 0.5 s); a second `ACTIVE` -> a new audit row and
alert. Control: the same telemetry with `VIDEO-01`/`VIDEO-02` leaves the cameras as they were and is
named in the ignored list; a warning with subject `VIDEO-02` ends the worker
(`PROTOCOL_VIOLATION` / `WARNING_SUBJECT_UNKNOWN`) and raises nothing; the simulator itself throws for it.

## F6. Commands and results

| Command | Result |
|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2 </dev/null` | 75 files, **1993 passed** (1984 before the round; +8 tests, +1 `it.each` row) |
| `npm run test -w @dems/core-server -- --maxWorkers=2 </dev/null` (sandbox off) | **3 failed / 4301 passed** (4304), 175 files; the 3 are the known `sessions/routes` x2 and `evidence/routes` x1 |
| `npm run test -w @dems/core-web -- --maxWorkers=2 </dev/null` | 117 files, **1523 passed** |
| `npm run test -w @dems/mobile -- --maxWorkers=2 </dev/null` | 194 suites, **2020 passed** |
| `npm run typecheck -w @dems/shared` / `lint` | exit 0 / exit 0 |
| `npm run typecheck -w @dems/core-server` / `lint` | exit 0 / exit 0 (mid-round it showed 5 errors in the driver's in-flight `test/support/capture.ts` and `capture/__tests__/supervisor.test.ts`; gone when the driver landed) |
| `npm run typecheck -w @dems/core-web` / `-w @dems/mobile` | the 2 + 1 known `PrecheckCheckId` errors |
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | up to date, 92 operations, exit 0 |
| `npx -w @dems/core-server vitest run --project unit src/capture --maxWorkers=2 </dev/null` | 9 files, 171 passed (3 of them the joined test) |
| `npm run test:db -w @dems/core-server -- --maxWorkers=2 src/engine/__tests__/capture-actions.db.test.ts </dev/null` (sandbox off) | 8 passed |
| same with `src/db/store`, `ticks`, `recording`, `commands`, `modules/devices/__tests__/effects.db.test.ts` | 6 files, 63 passed |

The full db project was not run. Core-web and mobile were run after the shared changes of items 1-3
(they import nothing of item 4).
