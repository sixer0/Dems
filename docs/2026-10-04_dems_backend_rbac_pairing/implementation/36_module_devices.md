---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 58
plan_row: W36
title: Devices module, operations 44 to 52 (the recording hardware of the Core)
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§7.1, §7.2, §7.3, §7.10, §7.17, §8.1, §8.7); gateway_check/01_gate_report.md, standing rules M1 to M13; controller notes D84 (gap IDs), D85, D87 (M14), D88 (M15)
evidence_tier: 3
status: complete, with one decision open for the controller (BE-GAP-W36-1, section 6)
---

# W36: the devices module, operations 44 to 52

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
the session never changed into a subfolder. Database commands ran with the per-command sandbox
bypass (P10). Quoted runner output is unchanged except that the sandbox's certificate warning
lines are left out.

**No password, token, cookie value, hash or other credential appears in this document.** The demo
password is used through its constant only. A test takes a session cookie from an answer and
hands it on in a header; none is printed, and no test name holds one.

The module is about the recording hardware of the Core itself (cameras, microphones, the other
devices, the platform devices GNSS, TPM and FRONT-PANEL). The paired mobile devices of the
registry (`DEV-NNNN`) are the pairing module's and are not touched here.

## 1. Result

| Item | Result |
|---|---|
| Row tests, `unit` (3 files of the folder) | **Exit 0**: 3 files, 87 tests, 0 failed (14:55:15) (section 9.1) |
| Row tests, `db` (2 files, `DEMS_TEST_STEP=58`) | **Exit 0**: 2 files, 39 tests, 0 failed; 0 databases remain with the run prefix (14:57:19) (section 9.1) |
| Route list of the module | Equals registry operations 44 to 52, nine routes, both lists printed by a test (section 9.2) |
| `restartDevice` during a recording | **409 `RECORDING_ACTIVE`**, `details: { simCode: RECORDING_ACTIVE, from: RECORDING, event: deviceCommand }`, for each of the seven devices that can be restarted; no row, no revision, the committed state is the same object (section 9.3) |
| An unsupported command | **409 `COMMAND_UNSUPPORTED`**, `details.simCode: COMMAND_UNSUPPORTED`: `restartDevice` and `testDeviceSignal` on GNSS, TPM and FRONT-PANEL; no row, no revision (section 9.3) |
| An unknown device ID | 404 `NOT_FOUND` with `details.simCode: NOT_FOUND`, as the contract documents; also for `DEV-0001`, the ID of a paired mobile device |
| A command's effect over time | The simulator's, on the engine's ticks. Test tone: 39 frames at -18 dBFS, release at 20 dB/s, back at the noise floor, frame for frame as a reference simulator. CLIP latch: reset, set again by the next burst, clear after the fault is cleared (section 7) |
| Audit rows of a sequence | Nine commands of three operators with ticks in between: each stored row equals the row the shared `deviceCommandTransition` builds on the committed state, **hash for hash**, and the trail equals a reference simulator's for the same sequence (section 7) |
| Engine host finding F-11 | `deviceCommand`, `setActiveCamera` and `resetClip` ran against PostgreSQL: after 50 `DEVICE_COMMAND` rows the tables hold exactly the committed state and the stored chain verifies (section 9.4) |
| Whole `unit` project (final) | **Exit 0**: 101 files, 2,647 tests, 0 failed (15:05:28) |
| Whole `db` project (final, `DEMS_TEST_STEP=58`) | **Exit 0**: 74 files, 1,071 tests, 0 failed; forced drops that needed a retry: 0; 0 databases remain with the run prefix (15:10:43) |
| Typecheck, lint of the workspace (final) | Exit 0 (15:09:55); exit 0 with no warning (15:10:11). Every run of the row, with what was red in other rows' files: section 9.5 |
| Mutation check | 63 of 64 planted defects detected; the one survivor is an equivalent mutant (section 11) |
| Gaps | `CONTRACT-GAP-3` (text for the close-out row, section 5), `CONTRACT-GAP-W36-1` (section 5), `BE-GAP-W36-1` (the engine seam offers no meter frame: section 6, **decision needed**) |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121. No database with this row's prefix remains (section 14) |

## 2. What was written

All under `apps/core-server/src/modules/devices/`, the row's one owned path. Three production
files (406 lines), five test files and one test-support file (2,354 lines).

| File | Lines | Content |
|---|--:|---|
| `index.ts` | 152 | The unit `devicesModule`: nine routes, each built from its registry entry with `routeOfOperation`. Replaces the scaffold's stub and keeps its export |
| `operations.ts` | 60 | The nine operation IDs in registry order; `DEVICE_COMMAND_OF_OPERATION`, the table of CONTRACT-GAP-3; `operationOf` |
| `status.ts` | 194 | Pure functions from the committed state to the four read answers; `stateLevelsOf`, the local adapter of BE-GAP-W36-1 |
| `__tests__/support.ts` | 343 | Test support (not a test file): an engine double and a database-free app; the booted app on a clone with the three operators signed in |
| `__tests__/routes.test.ts` | 539 | `unit`, 33 tests: MODG route list, CONTRACT-GAP-3, handlers against the engine double, stage 7, who may call |
| `__tests__/status.test.ts` | 299 | `unit`, 35 tests: the read answers against the in-app simulator's own handler on the same state |
| `__tests__/static.test.ts` | 226 | `unit`, 19 tests: rules M2 to M5, M8 and M14 for the folder |
| `__tests__/devices.db.test.ts` | 616 | `db`, 36 tests: the nine operations through the real stages, against PostgreSQL and the real engine |
| `__tests__/effects.db.test.ts` | 331 | `db`, 3 tests: the effects over time and the audit rows, against a reference simulator |

Nothing outside the folder was edited: not `app.ts`, the contract, the schema, the engine, a
plugin, another module or another row's test. No package was added.

## 3. The handler recipe per operation (rule M13)

Every command is a HOSTED action. The module has no table of its own, no unit of work of its
own and no row of its own: no `app.pipeline.run`, no `unit.audit.append`, no statement.

| # | Operation | Recipe | Code of the handler |
|--:|---|---|---|
| 44 | `getDeviceHealth` | Read of the committed state | `deviceHealthOf(app.engine.state(), app.clock.now())`, serialised through `DeviceHealthResponseSchema` |
| 45 | `getAudioStatus` | Read of the committed state | `audioStatusOf(app.engine.state(), app.clock.now())`, through `AudioStatusResponseSchema` |
| 46 | `getVideoStatus` | Read of the committed state | `videoStatusOf(app.engine.state())`, through `VideoStatusResponseSchema` |
| 47 | `getDeviceInventory` | Read of the committed state: seven slices under their slice names, by reference (API-6) | `deviceInventoryOf(app.engine.state())`, through the strict `DeviceInventorySchema` |
| 48 | `restartDevice` | Hosted | `app.engine.command(request.principal, 'deviceCommand', request.params.id, 'RESTART')`, then 204 with `x-dems-epoch` and `x-dems-revision` of the outcome |
| 49 | `testDeviceSignal` | Hosted | the same call with `'TEST_SIGNAL'` |
| 50 | `identifyDevice` | Hosted | the same call with `'IDENTIFY'` |
| 51 | `setActiveCamera` | Hosted | `app.engine.command(request.principal, 'setActiveCamera', request.body.cameraId)`, then 204 with the two headers |
| 52 | `resetMicClip` | Hosted | `app.engine.command(request.principal, 'resetClip', request.body.channel)`, then 204 with the two headers |

- Operations 48 to 50 are ONE route registration in a loop over the table of CONTRACT-GAP-3; the
  command of each route is data.
- The `{id}` schema is built from the registry entry's own pattern
  (`operation.pathParam.pattern`, `HARDWARE_DEVICE_ID_PATTERN`); the two bodies are the
  contract's `ActiveCameraRequestSchema` and `MicClipResetRequestSchema`.
- The module catches nothing and builds no refusal: a refusal of the simulator arrives from the
  engine as an `ApiFailure` with `details.simCode` and propagates; an engine that is not running
  is the seam's 503. An unexpected failure is logged (as `{ err }`) and persisted by the error
  envelope; a hosted action that fails is logged and persisted by the engine host. The folder
  holds no log call (rule M14, asserted by the static test).
- Who may call is stage 6 only. The folder names no permission and no role; `request.principal`
  occurs three times, each time as the first argument of `app.engine.command` (static test).

## 4. The operation table: action, statuses, and the test for each

Files: R = `routes.test.ts`, S = `status.test.ts`, D = `devices.db.test.ts`, E = `effects.db.test.ts`.
"Stage" marks an answer that a request stage gives before the handler: the module cannot
produce it, and one test through the real stages is recorded for it.

| # | Operation | Action / command | Status | Test |
|--:|---|---|---|---|
| 44 | `getDeviceHealth` | reads | 200 | R "… reads all four …" (3 roles); D "… reads all four …" (3 roles), "the reads show the recording"; S, 4 scenarios, 12 single faults, all faults at once |
| | | | 401 (stage) | R "nobody without a session reaches a handler"; D "nobody without a session reads" |
| | | | 403 (stage) | D "a read with the session cookie and an Origin that is no web console origin: 403 ORIGIN_NOT_ALLOWED on all four" |
| | | | 500, 503 (envelope) | R "a state the contract refuses never leaves the server"; R "while the engine is not running every read answers 503" |
| 45 | `getAudioStatus` | reads | 200, 401, 403, 503 | the same tests as 44 |
| 46 | `getVideoStatus` | reads | 200, 401, 403, 500, 503 | the same tests as 44 |
| 47 | `getDeviceInventory` | reads | 200 | R and D as 44; D "what a read answers is what the tables hold"; S "operation 47" (4 scenarios, strictness) |
| | | | 401, 403, 500, 503 | the same tests as 44 |
| 48 | `restartDevice` | `deviceCommand(id, RESTART)` | 204 | R "restartDevice runs deviceCommand(id, command) once"; D "the TECHNICIAN restarts every camera, microphone and other device", "once the recording has stopped … the restart is accepted again"; E sequence |
| | | | 401 (stage) | R "nobody without a session …"; D "nobody without a session: 401 … on all five" |
| | | | 403 `NOT_PERMITTED` (stage) | D "who may call: INVESTIGATOR and SUPERVISOR are refused … ONE ACCESS_DENIED row each", "SR-44 …" |
| | | | 403 `ORIGIN_NOT_ALLOWED` (stage) | D "a command with a session cookie and an Origin that is no web console origin" |
| | | | 404 `NOT_FOUND` | D "a device the Core does not have: 404 NOT_FOUND", "the order of the refusals …"; R (CAM-99) |
| | | | 409 `RECORDING_ACTIVE` | D "answers 409 RECORDING_ACTIVE with the simulator's code for every device that could be restarted"; R |
| | | | 409 `COMMAND_UNSUPPORTED` | D "a platform device cannot be restarted", "the order of the refusals …"; R (GNSS) |
| | | | 422 `INVALID_INPUT` | R "a device ID outside the registry's pattern …" (11 malformed IDs); D "a malformed device ID is the schema stage's 422" |
| | | | 400 `INVALID_JSON` (stage 7) | R "a device command takes no body, but a body that is no JSON object is still refused" (CONTRACT-GAP-W36-1) |
| | | | 500, 503 (envelope) | R "a unit the server could not run or commit answers 503 …; anything else … 500" |
| 49 | `testDeviceSignal` | `deviceCommand(id, TEST_SIGNAL)` | 204 | R; D "… sends a test signal to each device that takes one" (3 roles), "a test signal and an identify are not refused by a recording"; E tone, sequence |
| | | | 401, 403 `ORIGIN_NOT_ALLOWED` (stage) | as 48 |
| | | | 403 `NOT_PERMITTED` (stage) | D "who may call: every seeded role holds DIAGNOSTICS_RUN; a role that loses the grant is refused with 403 and ONE ACCESS_DENIED row" |
| | | | 404 | D "a device the Core does not have: 404 NOT_FOUND for both operations"; R (MIC-09) |
| | | | 409 `COMMAND_UNSUPPORTED` | D "a platform device takes no test signal"; R (TPM) |
| | | | 422, 400, 500, 503 | as 48 |
| 50 | `identifyDevice` | `deviceCommand(id, IDENTIFY)` | 204 | R; D "… identifies a camera, a microphone, another device and every platform device" (3 roles); E sequence |
| | | | 401, 403, 404, 422, 400, 500, 503 | as 49 (404: R (NOPE), D) |
| 51 | `setActiveCamera` | `setActiveCamera(cameraId)` | 204 | R "setActiveCamera runs setActiveCamera(cameraId) …"; D "setActiveCamera changes the camera the monitor shows …" |
| | | | 400, 422 | R "setActiveCamera and resetMicClip: a body outside the schema answers 422, a body that is no JSON object 400" (10 bodies); D "a body outside the schema is refused before the engine" |
| | | | 401, 403 (stage), 500, 503 | as 48 |
| 52 | `resetMicClip` | `resetClip(channel)` | 204 | R; D "resetMicClip with no latch set"; E "a reset clears the latch …" |
| | | | 400, 422 | as 51 (8 bodies) |
| | | | 401, 403 (stage), 500, 503 | as 48 |

Every answer in the tests is checked with `validateCoreApiResponse` of the contract. The 403
`DEVICE_REVOKED` of a retired device needs the device registry of the pairing row, which is in
flight: it is the guard's answer and is covered by the guard's tests and the matrix row W47.

What each operation is refused with, in the order the hosted action checks (spec §7.3 line 10),
measured during a recording: an unknown device 404, then a platform device 409
`COMMAND_UNSUPPORTED`, then 409 `RECORDING_ACTIVE`. Who may call is decided before all of it.

## 5. The contract gaps, with the text for the close-out row (W83)

### CONTRACT-GAP-3: which device command reaches which operation

`SIM_ACTION_OPERATIONS.deviceCommand` (`packages/shared/src/api/sim-actions.ts:81`) lists three
operations and not which `DeviceCommand` reaches which. The Live source keeps an index
(`DEVICE_COMMAND_OPERATION_INDEX`); the server keeps this table, in `operations.ts`:

```ts
export const DEVICE_COMMAND_OF_OPERATION = {
  restartDevice: DeviceCommand.RESTART,
  testDeviceSignal: DeviceCommand.TEST_SIGNAL,
  identifyDevice: DeviceCommand.IDENTIFY,
} as const satisfies Record<DeviceCommandOperation, DeviceCommand>;
```

Its keys are held to the contract's list at compile time. `routes.test.ts`, block
"CONTRACT-GAP-3", holds each value to its operation's path (the last segment of
`/api/v1/device/{id}/test-signal`, upper-cased with `_`, is the command), to the action the
registry entry's description names (`deviceCommand(deviceId, 'TEST_SIGNAL')`), and to the set of
`DeviceCommand` values (each exactly once).

**Text for W83**, so that both sides read ONE table. Add to
`packages/shared/src/api/sim-actions.ts`, after `SIM_ACTION_OPERATIONS`:

```ts
import type { DeviceCommand } from '../sim/vocabulary';   // type only: the module stays erasable

/**
 * Which operation each `DeviceCommand` reaches (01_specs §7.10, operations 48 to 50). The one
 * table for both sides: the Live source reads the operation of a command, the Core server the
 * command of an operation.
 */
export const DEVICE_COMMAND_OPERATIONS = {
  RESTART: 'restartDevice',
  TEST_SIGNAL: 'testDeviceSignal',
  IDENTIFY: 'identifyDevice',
} as const satisfies Record<DeviceCommand, (typeof SIM_ACTION_OPERATIONS)['deviceCommand']['operations'][number]>;

/** The command the operation runs, or undefined for an operation that is not one of the three. */
export function deviceCommandOfOperation(operationId: string): DeviceCommand | undefined {
  return (Object.keys(DEVICE_COMMAND_OPERATIONS) as DeviceCommand[]).find((command) => DEVICE_COMMAND_OPERATIONS[command] === operationId);
}
```

Then: (1) `packages/shared/src/live/source/bindings.ts` reads `DEVICE_COMMAND_OPERATIONS[command]`
and `DEVICE_COMMAND_OPERATION_INDEX` goes; (2) `apps/core-server/src/modules/devices/operations.ts`
builds its three routes from `Object.entries(DEVICE_COMMAND_OPERATIONS)` and
`DEVICE_COMMAND_OF_OPERATION` goes, with the first test of the block "CONTRACT-GAP-3" (the second
test, path against command, moves to the contract's own tests). The contract test to add: the
values of the table equal `SIM_ACTION_OPERATIONS.deviceCommand.operations` in order, and the last
path segment of each operation names its command.

### CONTRACT-GAP-W36-1: a POST without a request body documents no 400

Stage 7 parses every `application/json` body before a handler runs, so a body that is no JSON
object answers 400 `INVALID_JSON` on EVERY POST, also on one whose registry entry has no
`requestBody`. The registry documents 400 only where a body exists, and its envelope list has 400
for the routing stage only (`INVALID_PATH`). Measured (`routes.test.ts`, printed, not asserted):

```
[w36] CONTRACT-GAP-W36-1 restartDevice: 400 INVALID_JSON against the contract: {"ok":false,"reason":"UNDOCUMENTED_STATUS","issues":["400"]}
[w36] CONTRACT-GAP-W36-1 testDeviceSignal: 400 INVALID_JSON against the contract: {"ok":false,"reason":"UNDOCUMENTED_STATUS","issues":["400"]}
[w36] CONTRACT-GAP-W36-1 identifyDevice: 400 INVALID_JSON against the contract: {"ok":false,"reason":"UNDOCUMENTED_STATUS","issues":["400"]}
```

No client sends a body there; the conformance test (W52) will meet it if it sends a malformed
body to every POST. **Text for W83**, one of two:

- per operation, in `packages/shared/src/api/devices.ts`: add `400: INVALID_JSON,` to the
  `responses` of `restartDevice`, `testDeviceSignal` and `identifyDevice`, and
  `400: { invalidJson: ERROR_EXAMPLES.invalidJson }` to their examples (and the same for every
  other POST of the registry without a `requestBody`);
- or once, in `CORE_API_ENVELOPE_RESPONSES` of `core-api.ts`: an entry
  `{ status: 400, codes: [ApiErrorCode.INVALID_JSON], stage: CoreApiEnvelopeStage.PIPELINE, description: 'A body was sent that is not a JSON object. Every POST, also one that takes no body.' }`.
  `validateCoreApiEnvelopeResponse` finds an entry by status alone and would then need to look at
  the code as well, because 400 would have two entries.

The server's answer is not in question (an empty body and `{}` run the command: tested).

## 6. BE-GAP-W36-1: the engine seam offers no meter frame (decision needed)

**The fact.** The in-app simulator answers `dbfs` and `peak` of an audio channel (operation 45,
and `audio` of operation 44) from the newest frame of its `audio` slice. That slice is class X
of spec §3.2: streamed only, never stored, no durable slice. `app.engine.state()` returns the 28
durable slices, and the seam has no member that returns the newest meter frame
(`apps/core-server/src/engine/types.ts:158-234`). A module must not read the simulator's working
state (rule M4) and may not replace the seam `publish` to listen (static test of the guard row).
So the two levels cannot be answered from what a module may read. Positive control in
`status.test.ts`: the simulator's own handler, given a state without the five non-durable
slices, answers 500.

**What the module does (local adapter, `status.ts`, `stateLevelsOf`).** It answers what the
committed `mics` slice decides: the frame the shared code gives a channel at the moment it
enters the state the mic is in.

| Member | Value | Against the simulator |
|---|---|---|
| `clip` | `mic.clipLatched` | Exact, always |
| `noSignal` | `mic.state === 'NO_SIGNAL'` | Exact, always |
| `dbfs`, `peak` of a NO_SIGNAL mic | -90 (`noSignalFrame`) | Exact: such a channel does not move |
| `dbfs`, `peak` of a CLIP mic | -0.2 (`AUDIO_CLIP_BURST_DBFS`) | The frame the fault sets when injected; the peak hold (1.5 s) outlasts the longest pause between bursts (1.2 s) |
| `dbfs`, `peak` of a READY mic | -52 (`silentFrame`, the noise floor) | What a fresh engine holds before its first tick (spec §8.6); it does not follow speech, a peak or a test tone |

**Measured.** Exact equality with the simulator's handler, member for member, on the four
scenarios as loaded, on each of the 12 fault kinds injected into the recording scenario, and on
all 12 at once (`status.test.ts`, 21 tests). With the generator running, the levels differ and
every other member of the three answers stays equal:

```
[w36] BE-GAP-W36-1: after 3 s of the recording scenario the simulator answers AUDIO-01 -16.6/-12.99, AUDIO-02 -51.27/-50.98 dBFS; the module answers AUDIO-01 -52/-52, AUDIO-02 -52/-52; every other member is equal
```

On the booted server, half a second into a test tone, the newest meter frame holds about -18
dBFS and `GET /api/v1/audio/status` answers -52 (`effects.db.test.ts`, asserted and printed).

**Who is affected.** Neither client reads a level from this operation in Live mode: the Live
source fills `audio` from `meters` frames only (`implementation/44_live_source.md` §4). A caller
of the REST read (the API Reference's "Try it", an integration) gets a level that does not move.

**Request to the owner of `apps/core-server/src/engine/`** (five lines; no schema, no contract):

```ts
// types.ts, in EngineHost
/**
 * The newest meter frame the engine produced (what it last handed to `app.publish` as
 * `{ kind: 'meters' }`), or null before the first tick of this start. Never stored; by reference:
 * a reader must not change it. Throws 503 `NOT_READY` while the host is not running.
 */
meters(): EngineMeterFrame | null;

// host.ts, where the frame is published (host.ts:252-257): keep it
const frame = { at: current.clock.now(), seq: meterSeq, audio };
lastFrame = frame;
publish({ kind: 'meters', frame });
// set `lastFrame = null` where `meterSeq = 0` is set at a start, and return it from `meters()`.
```

With it, `audioChannelsOf` reads `app.engine.meters()?.audio.channels[mic.id]` and falls back to
`stateLevelsOf` before the first tick; the parity tests then drop their "without the levels"
form. This row did not edit the engine (rule M1).

**Decision for the controller (DN-1):** accept the adapter as the behaviour of operations 44
and 45 until the engine row adds the member, or rule that the levels of a READY channel are
answered in another way. Nothing else of the row depends on it.

## 7. A command's effect over time (rule 3 of the row)

The module answers 204 and holds no timer; what follows is the simulator's, on the engine's
ticks. `effects.db.test.ts` boots the server on a clone, on a manual clock and a manual timer,
and gives the SAME sequence to a reference simulator (a headless `Sim` of the shared core,
`createHost` of the seed row's test support).

**The test tone (`testDeviceSignal` on MIC-01).** 90 ticks of 50 ms after the command:

```
[w36] test tone on MIC-01, dBFS of AUDIO-01 at +ms 50, 1000, 1950, 2000, 2500, 3000, 3750, 4500: server -18.18, -17.85, -17.96, -18.96, -28.96, -38.96, -52.66, -52.22; reference simulator -17.8, -17.75, -17.88, -18.88, -28.88, -38.88, -51.49, -50.98; frames above -19 dBFS: 40 and 40; GET /audio/status during the tone: -52 (BE-GAP-W36-1)
```

Asserted: one meter frame per tick, gap-free, on the 50 ms grid; the 39 frames before
`t0 + AUDIO_TEST_TONE_MS` within 1 dB of `AUDIO_TEST_TONE_DBFS`; then one dB per frame down
(`AUDIO_RELEASE_DB_PER_S`), never upwards, until the noise floor, where it stays; AUDIO-02 never
leaves the noise floor; no frame differs from the reference simulator's by more than the two
noise draws can (the two engines' random streams are seeded apart, the server's by its epoch);
both carry the tone in the same number of frames and settle within two frames of each other.
Durable: one `DEVICE_COMMAND` row at `t0`; `cameras`, `mics`, `otherDevices`, `ports` and
`activeCameraId` are unchanged.

**A restart.** The brief's example "a restart that completes after N ticks" does not exist in
the simulator: `deviceCommandTransition` writes one `DEVICE_COMMAND` row for RESTART and changes
no slice, at the command or later (`packages/shared/src/sim/maintenance.ts:197-241`). Proven the
other way round: after three restarts and 7.35 s of ticks the five device slices are
`toStrictEqual` to before, on the server and on the reference simulator.

**The audit rows of a sequence.** Nine commands of the three operators (test signal on MIC-01
and CAM-01; identify on GNSS, FRONT-PANEL, MIC-02 and TPM; restart of CAM-02, POE-SWITCH and
TABLET) with 50 ms to 3 s of ticks in between:

```
[w36] 9 device commands over 7.35 s of ticks: 9 stored audit rows = the shared transition's (seq, id, at, type, actor, device, message, details, prevHash, hash) = the reference simulator's 9 rows (at, type, category, severity, actor, device, message, details); chain ok over 96 rows
```

Before each command the test applies the shared `deviceCommandTransition` to the server's own
committed state with the caller as the actor; the row it builds is the row the server then
stored, all 14 members, the hash included. The ticks in between wrote nothing on either side.

**The CLIP latch (`resetMicClip`).** The microphone is made to clip with the hosted action
`inject` through `app.engine.command` (the demo routes are another row's):

```
[w36] resetMicClip over 5.5 s: latch true, reset false, next burst true, fault cleared true, reset false and stays; audit types since: FAULT_RAISED, FAULT_CLEARED (the simulator's)
```

The reset replaces the `mics` slice in one published change whose revision the answer names; it
writes no audit row (NONE-P); while the fault is active the next burst sets the latch again, on
the server as on the reference; after the fault is cleared a reset holds. At the end the `mics`
slice is `toStrictEqual` to the reference simulator's.

## 8. Measured round trips for one command

`devices.db.test.ts`, "the cost of one command", through the real stages with a counting pool:

```
[w36] one restartDevice through the real stages: 7.0 ms; statements on unit-of-work connections since the request began: 6; the command's unit (6): BEGIN ISOLATION LEVEL READ COMMITTED | SELECT seq, hash FROM public.audit_chain_loc | SELECT set_config('statement_timeout', $1, t | select "id", "username", "rank", "name", "di | insert into "audit_log" ("seq", "id", "at",  | COMMIT
```

One transaction on one connection, six statements: `BEGIN`, the chain lock, the unit's time
limit, the operators mirror, the audit row, `COMMIT`. No event row (the hosted action writes
none). The wall time is a measurement of this host under the load of the parallel run (1.0 ms,
2.0 ms and 7.0 ms in three runs), not an assertion. A read sends no statement on a
unit-of-work connection and publishes nothing (asserted).

## 9. Verification

### 9.1 The row's own tests

```
14:55:15  $ npm run test -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/devices
 Test Files  3 passed (3)
      Tests  87 passed (87)
   Start at  14:55:15

14:57:19  $ DEMS_TEST_STEP=58 npm run test:db -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/devices
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_58_tmdi3jaw_
[test:db] stale sweep: dropped 0; kept 7 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  2 passed (2)
      Tests  39 passed (39)
   Start at  14:57:19
   Duration  6.71s (tests 44%, transform 34%, import 22%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 129 ms; 0 remain with the run prefix dems_test_step_58_tmdi3jaw_
```

Per file: `routes.test.ts` 33, `status.test.ts` 35, `static.test.ts` 19; `devices.db.test.ts`
36, `effects.db.test.ts` 3. Every test name with its result:
`implementation/assets/36_test_unit_verbose.txt`, `36_test_db_verbose.txt`.

### 9.2 The module gate (MODG, rule M11)

```
[w36] MODG routes of src/modules/devices: GET /api/v1/device/health getDeviceHealth | GET /api/v1/audio/status getAudioStatus | GET /api/v1/video/status getVideoStatus | GET /api/v1/device/inventory getDeviceInventory | POST /api/v1/device/:id/restart restartDevice | POST /api/v1/device/:id/test-signal testDeviceSignal | POST /api/v1/device/:id/identify identifyDevice | POST /api/v1/video/active-camera setActiveCamera | POST /api/v1/audio/clip/reset resetMicClip
[w36] MODG registry, operations 44 to 52:  GET /api/v1/device/health getDeviceHealth | GET /api/v1/audio/status getAudioStatus | GET /api/v1/video/status getVideoStatus | GET /api/v1/device/inventory getDeviceInventory | POST /api/v1/device/:id/restart restartDevice | POST /api/v1/device/:id/test-signal testDeviceSignal | POST /api/v1/device/:id/identify identifyDevice | POST /api/v1/video/active-camera setActiveCamera | POST /api/v1/audio/clip/reset resetMicClip
```

| Gate item | Met by |
|---|---|
| The route list equals the registry operations | The two lines above (`routes.test.ts`, first test); the registry's `Device` tag is exactly these nine; each route matches its operation with `matchCoreApiOperation`, and the guard holds the registry's rule for it |
| Each documented status the module can produce has a test, and every answer validates | Section 4; `validateCoreApiResponse` on every answer |
| The role-by-operation decision is the guard's: one allowed and one refused call per operation | Allowed: every role on 44 to 47, 49 to 52, the TECHNICIAN on 48. Refused: nobody without a session on all nine (401); INVESTIGATOR and SUPERVISOR on 48 (403 with one row each); a role without the stored grant on 49 and 50 (403 with one row each) |
| Typecheck and lint | Section 9.5 |
| A mutation check of the module's own logic | Section 11 |
| In-process, own clones, no port | `DEMS_TEST_STEP=58`; every request is `app.inject`; `app.server.listening` is asserted false after the boot |

### 9.3 The two cases the row names

```
 ✓ devices.db.test.ts > restartDevice while a recording runs > answers 409 RECORDING_ACTIVE with the simulator's code for every device that could be restarted, and changes nothing 54ms
[w36] restartDevice during a recording: 409 RECORDING_ACTIVE, details { simCode: RECORDING_ACTIVE, from: RECORDING, event: deviceCommand }, for CAM-01, CAM-02, MIC-01, MIC-02, POE-SWITCH, REC-INDICATOR, TABLET; no row, no revision
 ✓ devices.db.test.ts > restartDevice while a recording runs > the order of the refusals is the hosted action's: an unknown device 404, a platform device 409 COMMAND_UNSUPPORTED, then 409 RECORDING_ACTIVE 74ms
 ✓ devices.db.test.ts > operation 48: restartDevice (DEVICE_MANAGE) > a platform device cannot be restarted: 409 COMMAND_UNSUPPORTED, and nothing is written 14ms
 ✓ devices.db.test.ts > operations 49 and 50: testDeviceSignal and identifyDevice (DIAGNOSTICS_RUN) > a platform device takes no test signal: 409 COMMAND_UNSUPPORTED with the simulator's code, and nothing is written 16ms
[w36] restartDevice and testDeviceSignal on GNSS, TPM and FRONT-PANEL answer 409 COMMAND_UNSUPPORTED with details.simCode COMMAND_UNSUPPORTED; no row, no revision
```

The recording is reached through `app.engine.command` only (`createSession`, `beginPrecheck`,
ticks, `startRecording`), on a second clone; the sessions routes are not used. After the
refusals nobody is signed in on the engine, the session records on, and the committed state is
the same object as before. Once the session is SEALED the restart answers 204 again.

### 9.4 Engine host finding F-11: the three hosted actions against PostgreSQL

```
[w36] rows written by this file after boot and sign-in: {"DEVICE_COMMAND":50,"ACCESS_DENIED":8}; stored = committed; chain ok over 144 rows
```

`deviceCommand` (all three commands, ten devices, three operators), `setActiveCamera` and
`resetClip` ran through the engine against PostgreSQL as `dems_app`. Asserted four times in
the file: the durable slices read back from the tables are `toStrictEqual` to
`app.engine.state()`, the stored chain links and verifies over all rows, the stored head is the
engine's, and the log holds no line at level error and no `audit head diverged`. Each command's
answer names the epoch and the revision of the published change that holds its effect; a
command that changes nothing (the same camera again, a latch that is not set) names the current
revision and publishes nothing.

### 9.5 Whole projects, typecheck, lint: every run (P11)

| Time | Command | Result |
|---|---|---|
| 14:26:25 to 14:43:46 | `npm run typecheck -w @dems/core-server` (4 runs while writing) | Exit 0 each |
| 14:43:46 | `npm run lint -w @dems/core-server` | Exit 0; 6 warnings, none in this folder: 2 in `src/modules/pairing/__tests__/devices.db.test.ts` (pairing row, in flight), 4 in `src/plugins/permission-guard/__tests__/guard.test.ts` (the guard row's file under its owner fix, decision D85) |
| 14:52:10 | Whole `unit` project | **Exit 0: 96 files, 2,540 tests** |
| 14:52:48 | Whole `db` project, `DEMS_TEST_STEP=58` | **Exit 0: 67 files, 1,006 tests**; forced drops that needed a retry: 0; 0 remain with the run prefix `dems_test_step_58_tmdhw14j_` |
| 14:55:18, 14:55:46 | Typecheck | Exit 2, one error each time, in `src/modules/pairing/__tests__/routes.test.ts(184,94)` (TS2345): the pairing row's test file, in flight. No error in this folder |
| 14:55:28 | Lint | Exit 0; 5 warnings, all in three test files of `src/modules/pairing/__tests__/` (in flight). `oxlint src/modules/devices`: exit 0, no output |
| 14:57:39 | Whole `unit` project (after one more test of this row) | Exit 1: 99 of 101 files passed, 2,636 of 2,647 tests. The 11 failures are in `src/modules/storage/__tests__/routes.test.ts` (8) and `projection.test.ts` (3): the storage row's files, in flight (`estimatedRemainingMs` not rounded in ITS `storageStatusOf`). No failure in this folder |
| 14:58:22 | Whole `db` project | Exit 1: 68 of 70 files passed, 1,030 of 1,036 tests. Failures: `src/modules/storage/__tests__/storage.db.test.ts` (4; the storage row, in flight) and `test/helpers/db/__tests__/sweep.db.test.ts` (2; "Test timed out in 5000ms" in the helper's own test while the run took 179 s instead of 128 s: load). 0 remain with the run prefix `dems_test_step_58_tmdi5apo_` |
| 15:01:22 | Typecheck | **Exit 0** |
| 15:01:34 | Lint | **Exit 0, no warning** |
| 15:05:28 | Whole `unit` project | **Exit 0: 101 files, 2,647 tests** (final) |
| 15:06:09 | Whole `db` project | Exit 1: 72 of 74 files passed, 1,069 of 1,071 tests. Failures: `src/modules/sessions/__tests__/history.db.test.ts` (1; the sessions row, in flight: a paging assertion) and `test/helpers/db/__tests__/templates.db.test.ts` (1; "Test timed out in 5000ms"; the run took 225 s). 0 remain with the run prefix `dems_test_step_58_tmdiiatz_` |
| 15:09:55 | Typecheck | **Exit 0** (final) |
| 15:10:11 | Lint | **Exit 0, no warning** (final) |
| 15:10:22 | The helper's two files that had timed out (`sweep.db.test.ts`, `templates.db.test.ts`), alone with this row's two `db` files | Exit 0: 4 files, 54 tests |
| 15:10:43 | Whole `db` project | **Exit 0: 74 files, 1,071 tests** (final); forced drops that needed a retry: 0; 0 remain with the run prefix `dems_test_step_58_tmdipw0a_` |

The final runs, as the runner printed them:

```
15:05:28  $ npm run test -w @dems/core-server -- --maxWorkers=2
 Test Files  101 passed (101)
      Tests  2647 passed (2647)
   Start at  15:05:29
   Duration  40.37s (import 59%, tests 34%, transform 7%, worker 1%)

15:10:43  $ DEMS_TEST_STEP=58 npm run test:db -w @dems/core-server -- --maxWorkers=2
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_58_tmdipw0a_
[test:db] stale sweep: dropped 0; kept 14 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  74 passed (74)
      Tests  1071 passed (1071)
   Start at  15:10:44
   Duration  177.24s (tests 84%, import 14%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 743 ms; 0 remain with the run prefix dems_test_step_58_tmdipw0a_

15:09:55  $ npm run typecheck -w @dems/core-server      > tsc --noEmit      exit 0
15:10:11  $ npm run lint -w @dems/core-server           > oxlint            exit 0, no warning
```

What was red, and whose it was. Of the six whole-project runs three were red, never in this
folder: at 14:57 and 14:58 in three test files of the storage row (`estimatedRemainingMs` not
rounded in that row's own `storageStatusOf`: the controller's note D88 names a mutated file of
another row on disk in that window); at 15:06 in one test of the sessions row, in flight; and
three times a 5 s time-out in the test helper's own tests (`sweep.db.test.ts` twice at 14:58,
`templates.db.test.ts` at 15:06) while the whole `db` run took 179 s and 225 s instead of 128 s.
Those two files pass alone (15:10:22). The 1-minute load average was 17.15 at 15:10 and 12.68
at 15:13 on ten cores (finding F-14).

The three guard files of decision D85 (`guard.test.ts`, `denial.db.test.ts`,
`matrix.db.test.ts`) were green in every whole-project run of this row from 14:52 on: the
owner's fix was in the tree by then. Raw output: `implementation/assets/36_final_runs.log`.

## 10. Test ledger (P24)

`@dems/core-server` only; no other workspace was written.

| Project | Controller baseline 14:11 | This row adds | Files |
|---|---|---|---|
| `unit` | 77 files, 1,992 tests | +3 files, +87 tests | `src/modules/devices/__tests__/routes.test.ts` (33), `status.test.ts` (35), `static.test.ts` (19) |
| `db` | 48 files, 740 tests | +2 files, +39 tests | `src/modules/devices/__tests__/devices.db.test.ts` (36), `effects.db.test.ts` (3) |

The whole-project totals of section 9.5 (96 and 2,540; 67 and 1,006 at 14:52) hold the files of
the other module rows in flight as well, so they are above baseline plus this row's additions.
The final runs hold 101 `unit` files with 2,647 tests and 74 `db` files with 1,071 tests. No
existing test of any row was edited.

## 11. Mutation check

64 defects were planted one at a time, plus one control, and the row's own tests (3 `unit`
files, 2 `db` files) run on each. **63 of 64 detected.** No file of the repository was changed:
the harness of the identity and guard rows was reused, a scratch Vitest configuration outside
the repository whose one transform hands ONE production file to Vitest with ONE text replaced
(`implementation/assets/36_mutation_harness.vitest.config.mjs.txt`,
`36_mutation_harness.run.sh.txt`, `36_mutations.json`; result lines `36_mutations.log`). The
runner starts from the workspace root (`--root`), with no change of directory. One pass,
14:46:05 to 14:51:41, against 87 unit and 37 database tests (two database tests were added
afterwards; they are not about a planted defect).

| File | Mutations | Examples |
|---|---|---|
| `operations.ts` | M01 to M04 | Each of the three operations runs another command; the operation list in another order |
| `index.ts`, commands | M05 to M24 | A fixed device ID; the actor a constant operator (48 to 50, 51) or a copy of the principal (52); the answer before the commit (48 to 50, 51); 52 runs nothing; the path ID not validated, any string, or lower case accepted; a body not validated; a header missing, swapped or one behind; 200 instead of 204; a fixed camera, a fixed channel; another hosted action |
| `index.ts`, reads | M25 to M31 | The clock not read; a response schema missing (44, 46, 47); the answer of the first call kept; a fixed active camera; the engine's refusal swallowed |
| `status.ts` | M32 to M64 | The latch never shown; NO_SIGNAL or CLIP answered at the noise floor; a camera always online, a lens always READY, no recording state; device ID, gain, phantom, bitrate; the storage members; system state, flags, severity; the two times; time source, TPM, tamper, security state; services; ports, tablet link, other devices; the two channels swapped |

| Result | Detail |
|---|---|
| M00 (control: a text that is not in the file) | The harness refuses it by name, in both projects |
| 63 detected | All 63 by the `unit` files; 33 of them by the `db` files as well |
| **M15 survived**: "a command's 204 is given a body" (`.code(204).send({ ok: true })`) | An equivalent mutant: the framework sends no payload with a 204. The tests' `response.body === ''` assertions pass on the mutant, which shows it |

Rule M15 (decision D88): no file of the workspace tree was changed at any moment. The transform
replaces the text in memory, inside this row's own Vitest process, and the configuration, the
list and the outputs lie under the session's scratchpad.

Limits: each mutation is one text replaced in one file; the static test reads the sources from
disk, not through the transform, so it cannot see a mutation.

## 12. Findings (P22)

| ID | Finding | Evidence | Effect or proposal |
|---|---|---|---|
| F-1, **BE-GAP-W36-1** | The engine seam returns no meter frame, so `dbfs` and `peak` of operations 44 and 45 cannot follow the 20 Hz levels | Section 6 | Local adapter `stateLevelsOf`; five-line request to the engine's owner; decision DN-1 |
| F-2, **CONTRACT-GAP-3** | The contract does not say which device command reaches which operation | Section 5 | Local table, pinned by tests; the text for W83 |
| F-3, **CONTRACT-GAP-W36-1** | A POST without a request body answers 400 `INVALID_JSON` for a body that is no JSON object; the registry documents no 400 there | Section 5 | Text for W83 (two forms); the conformance row W52 should know |
| F-4 | The simulated restart has no duration: one row, no slice changes | Section 7 | The row's rule 3 is proven as "nothing changes after N ticks". A client must not wait for a "restarted" state |
| F-5 | **A 403 without an audit row is possible for the hosted actions that check a permission themselves** (17 of the 31, spec §7.17 column "Rule today"; three of them through this module). `deviceCommand` checks its permission again with the SHARED static matrix (`ROLE_PERMISSIONS`). With a grant that exists only in the stored matrix (SUPERVISOR given `DEVICE_MANAGE` in the clone), the guard lets the call through and the simulator refuses it: 403 `NOT_PERMITTED`, `details: { simCode: NOT_PERMITTED, permission: DEVICE_MANAGE }`, **no `ACCESS_DENIED` row** | `devices.db.test.ts` "the hosted action checks the same permission by the SHARED matrix …" | Not reachable while the stored matrix equals the shared one (RB-9: not editable; the boot step checks the vocabulary, not the grants). For the security review W45 and the matrix row W47: decision DN-3 |
| F-6 | The order of refusals inside `deviceCommand` is 404, then `COMMAND_UNSUPPORTED`, then `RECORDING_ACTIVE`: a restart of GNSS during a recording answers `COMMAND_UNSUPPORTED` | `devices.db.test.ts` "the order of the refusals …" | As spec §7.3 line 10. For the client rows' wording |
| F-7 | A `DEVICE_COMMAND` row carries no session ID, also during a recording | "a test signal and an identify are not refused by a recording" | The simulator's row; for a session timeline nothing is added |
| F-8 | `TABLET`, `REC-INDICATOR` and `POE-SWITCH` are "other devices" of the Core: restart and test signal are accepted for them. `TABLET` is the Core's list entry of the tablet control, not a paired device; `DEV-0001` fits the hardware ID pattern and answers 404 | `devices.db.test.ts`, `HARDWARE`; "a device the Core does not have" | For the Devices page rows: a paired device's ID is never sent to these operations |
| F-9 | A test signal has a meter effect on MIC-01 and MIC-02 only; on a camera or another device it writes its row and nothing else | `maintenance.ts:184, 217-218`; the sequence test | The simulator's behaviour, unchanged |
| F-10 | Every seeded role holds `DIAGNOSTICS_RUN`: a refused call of 49 or 50 exists only for a caller without a session, or after a grant is removed from the stored matrix (tested so) | `sim/auth.ts:53-72`; section 4 | For W47: the matrix has no "refused" cell for these two operations with seeded data |
| F-11 | The read answers of 44 to 46 are a second place where the design-book shapes are built (the simulator's builders in `sim/api.ts` are not exported) | `status.ts`; `status.test.ts` holds every member against the simulator's handler | If W83 or the code review wants one place: export `deviceHealth`, `audioChannels`, `videoTracks`, `storageStatus` from `packages/shared/src/sim/api.ts` typed on the slices they read (a simulator change: `SIM-GAP-W36-1`, no writer planned). The storage row builds the same `storageStatus` shape for operation 53 |
| F-12 | After a process start the tablet link is OFFLINE, so `getDeviceHealth` answers `ATTENTION` with the flag `TABLET_OFFLINE` until a tablet connects | `devices.db.test.ts` "what a read answers is what the tables hold" | Engine host F-10, seen through this operation; for W58 and W86 |
| F-13 | A stray scratch file of this row, `apps/core-server/.w36_paths.tmp.ts`, existed from 14:29 for under a minute and was moved out of the repository (to the temporary directory); it never ran | Section 14 | None; recorded because it was outside the row's write path |
| F-14 | **The test helper's own tests time out at 5 s under the load of the parallel run.** Three time-outs in two whole `db` runs (14:58, 15:06), each in `test/helpers/db/__tests__/`; alone the files pass. The whole `db` project took 128 s, 179 s, 225 s and 177 s in four runs of this row | Section 9.5 | P9 load guard: for the controller. A longer time-out for those tests is the helper row's to decide |

## 13. Deviations and decisions

| ID | Deviation from the row text | Reason |
|---|---|---|
| DV-1 | Rule 1 says reads answer from the committed slices. `dbfs` and `peak` of operations 44 and 45 are not in them | Section 6 |
| DV-2 | Rule 3 names "a restart that completes after N ticks" | The simulator has no such thing (F-4) |
| DV-3 | The test support imports the test support of four other rows (`core`, `db/seed`, `engine`, `identity`), read-only | Their files say other rows may |
| DV-4 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (P8) |
| DV-5 | The engine is driven into RECORDING, and a microphone is made to clip, with hosted actions through `app.engine.command` in the tests | The row's rule 2; the sessions and demo routes are other rows in flight |

| ID | Question for the controller | Recommendation |
|---|---|---|
| DN-1 | BE-GAP-W36-1: the levels of operations 44 and 45 | Accept the adapter now; schedule the five-line `meters()` member with the engine's owner (or the code review W38); this row's owner then replaces `stateLevelsOf` |
| DN-2 | CONTRACT-GAP-3 and CONTRACT-GAP-W36-1 | To W83 with the texts of section 5 |
| DN-3 | F-5: a 403 of the simulator without a row | Accept as residual while the matrix is not editable; pass to W45 and W47. If the matrix ever becomes editable, the engine's `NOT_PERMITTED` refusal needs a row, or the simulator's check must use the stored grants |
| DN-4 | F-11: two places that build the design-book read shapes | Leave it; the parity tests hold them together. Decide at W83 or the code review whether to export the simulator's builders |

## 14. End state and cleanup

At 14:55:39 (a scratch script outside the repository, as `dems_owner`, through the test
helper's own reader of the connection file; it prints names and counts;
`implementation/assets/36_end_state.mts.txt`):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_58_*): 0
test databases of all rows at this moment: 4
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

The same at 15:14:02, after the last runs: 0 databases with this row's prefix, 2 test databases
of other rows at that moment, 0 sessions on this row's databases.

- `.locks/postgres.pid`: 19121, the process started 07:14:26, as before. PostgreSQL was never
  stopped or reconfigured. Nothing connected as the bootstrap superuser.
- `dems_demo` and the lane databases were never connected to: every test ran on a clone of the
  helper (`DEMS_TEST_STEP=58`); the one further clone of `devices.db.test.ts` is dropped with
  its file. Every run of this row ended with "0 remain with the run prefix".
- No port was bound and no process of this row is left: the one background command (the
  mutation pass) ended by itself.
- Pre-image: `.cache/rollback/W36.devices-index.ts.pre` (the scaffold's stub, a file copy: the
  path is untracked).
- Scratch files are under the session's scratchpad (`w36_mut/`), outside the repository. What is
  evidence is kept as text under `implementation/assets/36_*` (eight files). No credential is in
  any of them or in the folder (searched for the demo password, the demo pairing code, token
  prefixes with a value and a session cookie pair: none).
- One file was written outside the row's path by mistake and moved out at once (F-13).

## 15. Not done, and limits of this evidence

- A real listener: every request is `app.inject`. The backend gate W58 runs the server.
- The 403 `DEVICE_REVOKED` of a retired device, and a call with a paired device's bearer
  session: the device registry is the pairing row's, in flight. Every test here uses web
  sessions (a cookie).
- The role-by-operation matrix in full: W47.
- The realtime channel: `app.publish` is a recorder in the database tests.
- The reference simulator is given the idle scenario, not the server's seeded state: the audit
  rows are compared by content there, and by hash against the pure transition on the server's
  own state.
- Operations 64 to 68 (system, diagnostics run) are another row's.

## 16. Rollback (R-NEW; not executed)

`src/modules/devices/` is this row's folder. Before this row it held one file, the scaffold's stub.

```sh
# from /Users/gsp-budi/Documents/DEMS
rm -rf apps/core-server/src/modules/devices
mkdir -p apps/core-server/src/modules/devices
cp .cache/rollback/W36.devices-index.ts.pre apps/core-server/src/modules/devices/index.ts
```

After it the nine operations have no route (404 from stage 1), the module's five test files are
gone (the ledger falls by 3 `unit` files and 87 tests, 2 `db` files and 39 tests), and nothing
else changes: no other file imports from this folder except `app.ts`, which imports
`devicesModule` and finds it in the stub.

---
*Generated: 2026-10-04 15:16 WIB*
