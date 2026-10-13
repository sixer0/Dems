---
task: 2026-10-12_input_av_core_adapter_plan
row: 149
milestone: M2 / AD-04 (closes WP-13a)
agent: coder-execution (batch 7, agent R/T/X)
date: 2026-10-13
tier: T3
status: complete; four lines in file_requests.md (one answer, three for the controller); driver decisions DD-1 to DD-4
---

# Row 149 - the reader inventory as a test; the shared seam of row 28 removed

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `SH` = `packages/shared`, `WEB` = `apps/core-web/src`, `MOB` = `apps/mobile/src`. Site numbers are those of `research/027_selector_assumptions.md` ("row 27").

## 1. The inventory test

NEW `CS/src/modules/capture-config/__tests__/selector-reader-inventory.test.ts` (unit project, no database, no process; 12 cases). It reads the four workspaces and the other trees through `CS/test/static/scan.ts` and searches the twelve names of row 27 section 1 (six columns, six members of the row image; built from parts, matched as whole identifiers).

| Rule | What it holds | Control |
|---|---|---|
| I-1 | the PRODUCTION sources of the server and of `SH` that name one equal the ten files of row 27 section 5.2 (8 server, 2 shared), each entry with its site A1 to A9; two of them in a comment only | a reader planted in `CS/src/modules/sessions/` and one in `SH/src/sim/` are named as `outside`; an entry that stopped naming one is named as `stale` |
| I-2 | every other file that names one is a test or fixture file of the server; the seventeen such files of this row still name one; `SH` names one in its two sources only | a planted script and a planted shared test are named; a new server test is not |
| I-3 | generated and historical: migrations and snapshots of the server from set 0004 on, by rule (16 or more) | a file beside the migrations that is no migration, a set before 0004 |
| I-4 | `apps/core-web` and `apps/mobile`, sources and tests: 0 files | a planted client reader is named |
| I-5 | `apps/capture-worker`, `apps/mock-core`, `apps/transcriber`, `packages/capture-protocol`, `scripts/`: 0 files | - |

The list today, against row 27 section 5.2: production 10 of 10, the same files. Tests and fixtures: the 14 of row 27 plus `CS/test/db/contract-v7-delta.ts`, `CS/test/db/set8.db.test.ts` (schema set A) and `CS/src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` (row 70) = 17; and, created by agent S while this row ran, `CS/src/capture-notices/__tests__/precheck-unassigned.db.test.ts` (row 30). Generated: `0004_capture.sql`, `0005_capture_privileges.sql`, `0015_capture_streams_audio_inputs.sql`, snapshots 0004 to 0016.

"Nothing by position" (the second half of the gate condition) is held by the static test of row 172 (`SH/test/audio.test.ts`, 0 names of the positional function in four trees).

## 2. The shared seam of row 28, removed

| File | Change |
|---|---|
| `SH/src/sim/types.ts` | `AudioSliceInState` deleted; `SimState['audio']` is `AudioSlice` (its `activeInputId` nullable, as the wire type already was) |
| `SH/src/sim/audio.ts` | the subsystem writes `activeInputId: active` (null without a PRIMARY line; the marker PENDING-ROW-28-SEAM is gone); `channelOfMicLine` takes `readonly RoleMicLine[]`, `MicLineRoleUnstated` and `statesRole` deleted (rows 164 / 171); `activeMeterChannel` reads the member without the local annotation |
| `SH/src/sim/capture-config.ts` | the hosted action writes `micInputOfRole(mics, PRIMARY)` alone (marker gone) |
| `SH/src/sim/api.ts` | `audioSourceIntervalsOf`: the literal `'MIC-01'` is gone; with no boundary, no pair, no PRIMARY line of the session's snapshot and no active input of the meters the answer is `[]` (decision C36 (2)); `activeInputOf`: comment and annotation only |
| `SH/src/sim/session-machine.ts` | comment and annotation of `held` only |
| `SH/src/live/source/live-sim.ts` | a meter frame with `activeInputId: null` is held as it came (it kept the store's earlier input before) |
| `SH/test/api-state-slices.test.ts` | the marker `audioStateIsTheSlice` is `Exact<AudioSliceBody, SimState['audio']> = true` |
| `SH/test/audio.test.ts` | two expectations flip to `toBeNull()` / drop the cast; a list without roles given to `channelOfMicLine` is a `@ts-expect-error` |
| `SH/test/sim-capture-config.test.ts` | "two cleared slots": `activeInputId` is null; NEW case for C36 (2) with two controls |
| `SH/test/sim-capture-start.test.ts` | the switch refusal: the meters hold null (asserted); the second half now plants a STRAY active input (not a line of the session) instead of a cast null |
| `SH/test/support/selector-category-bed.ts` | the bed's meters: null without a PRIMARY line |

No wire schema changed (`AudioSliceSchema` was already nullable): `SH/openapi/openapi.json` NOT regenerated; `test/openapi.test.ts` and `test/api-openapi-scope.test.ts` pass on the file as committed.

Readers after the removal: the typecheck of every workspace is green with no edit outside `SH` - the nine seam readers of row 28 were made null-safe by rows 163, 164, 165, 168, 170, 171 as stated. 0 readers to report.

## 3. Count check of WP-13a against row 27

### 3.1 Column sites not null-safe: 5 of 5

| Site | Where | Carrying row | Named test |
|---|---|---|---|
| A1 | `CS/src/modules/capture-config/store.ts` (`recordOf`) | 29 | `CS/src/modules/capture-config/__tests__/capture-config.db.test.ts`, `slices.test.ts` |
| A2 | `CS/src/modules/capture-config/slices.ts` | 29 | `slices.test.ts`, `plan.test.ts` |
| A3 | `CS/src/db/mapping/rows.ts` `captureConfigToRow` | 166 | `CS/src/db/mapping/__tests__/to-rows.test.ts`, `round-trip.test.ts` |
| A4 | `CS/src/db/mapping/rows.ts` `captureConfigFromRow` | 166 | `CS/src/db/mapping/__tests__/from-rows.test.ts` |
| A9 | `SH/src/domain/entities.ts` `CaptureConfig` | 28 | `SH/test/api-state-slices.test.ts` |

All five files are entries of I-1. The server's column seam (`slotColumn`, `seamedSelectorRow`; row 29's request) is no longer in `CS/src` (search: 0 files).

### 3.2 Selector-line readers not safe: 31 of 31

| Tree | Sites | Count | Carrying row | Named test |
|---|---|---|---|---|
| core-server | B11, B12, B13 | 3 | 150 | `CS/src/modules/devices/__tests__/status.test.ts` |
| shared | C1, C2, C4, C5, C7 | 5 | 163 | `SH/test/sim-capture-start.test.ts`, `sim-capture-notices.test.ts` |
| shared | C9, C10, C11, C12 | 4 | 162 | `SH/test/sim-capture-config.test.ts` |
| shared | C16, C18 | 2 | 164 | `SH/test/audio.test.ts` |
| shared | C17, C23, C24, C25 | 4 | 165 | `SH/test/sim-api.test.ts` |
| shared | C15 | 1 | 172 | `SH/test/audio.test.ts` (static block) |
| core-web | W1, W2 | 2 | 31 | `WEB/features/devices/__tests__/selector-microphones.test.tsx` |
| core-web | W3 | 1 | 167 | `WEB/features/session-new/__tests__/precheck-unreachable.test.tsx` |
| core-web | W4, W5, W6 | 3 | 168 | `WEB/features/session-monitor/__tests__/audio-source.test.tsx`, `WEB/components/composed/__tests__/dbfs-meter.test.tsx` |
| mobile | M1, M2 | 2 | 32 | `MOB/features/capture-selector/capture-selector-model.test.ts`, `capture-selector.test.tsx` |
| mobile | M3 | 1 | 169 | `MOB/features/capture-selector/precheck-capture-notices.test.tsx` |
| mobile | M4 | 1 | 170 | `MOB/features/session-live/mic-source-model.test.ts` |
| mobile | M5, M6 | 2 | 171 | `MOB/features/capture-selector/source-state.test.ts`, `MOB/features/devices/devices-model.test.ts` |

3 + 16 + 6 + 6 = 31. Unaccounted: 0.

### 3.3 Files of the positional fallback: 24 of 24

Shared 8 (`sim/audio.ts` 164 and 172, `sim/capture-config.ts` 162, `sim/session-machine.ts` 163, `sim/api.ts`, `sim/faults.ts`, `sim/health.ts`, `sim/react.ts`, `sim/capture-telemetry.ts` 165); core-server 1 (`modules/devices/status.ts` 150); core-web 5 (167, 168); mobile 10 (169, 170, 171) - the per-file rows are blueprint section 8.1. Measured now: 0 of the 24 name the positional function or anything else of that name (search of `apps/` and `packages/`: 0 lines); the function does not exist (row 172). Named test: `SH/test/audio.test.ts`, "the positional microphone function stays deleted".

## 4. Checks (2026-10-13; one run each unless said)

| Check | Result |
|---|---|
| `npx tsc --noEmit` in `packages/shared`, `apps/core-server`, `apps/mobile`, `apps/mock-core`, `apps/transcriber`; `npx tsc -b` in `apps/core-web` | exit 0, six of six |
| `npx oxlint` in `packages/shared` | exit 0 |
| shared: `vitest run test/sim- test/audio.test.ts test/api-state-slices.test.ts test/api-realtime.test.ts test/live-source test/evidence-m7-one-camera.test.ts test/evidence-package.test.ts test/evidence-verify-sources.test.ts test/openapi --maxWorkers=2` | `Test Files 47 passed (47)`, `Tests 1505 passed (1505)` |
| shared: `vitest run test/api-openapi-scope.test.ts` | `Test Files 1 passed (1)`, `Tests 24 passed (24)` |
| web, the suites that use the audio state (`src/test/live-*`, `selector-in-force`, `features/session-monitor`, `features/devices/__tests__/mic-input-name`, `audio-input*`, `components/composed`) | `Test Files 22 passed (22)`, `Tests 261 passed (261)` |
| mobile (`src/features/session-live`, `selector-in-force`, the dashboard, devices and runtime audio tests) | `Test Suites: 31 passed, 31 total`, `Tests: 391 passed, 391 total` |
| server: the inventory test with the seven unit files that read the active input (`devices/status`, `devices/routes`, `sessions/audio-intervals`, `engine/capture-session-parity`, `engine/actor-scope`, `capture-notices/notices`, `capture/forwarder-engine`) | first run: 7 files passed, the inventory file 2 of 12 failed on MY list I-2 (a test file created by agent S in this batch was outside it - see DD-1); second run of the inventory file: `Test Files 1 passed (1)`, `Tests 12 passed (12)` |

Simulated mode on the seeded, complete selector: 0 changed results - every pre-existing expectation of the shared, web and mobile suites above stands; the expectations that moved are the four that described the seam on a selector WITHOUT a PRIMARY line.

## 5. Identifiers

AD-04 (4) closed: full reader inventory as a test; nothing by position (with row 172). WP-13a closed: 5 / 31 / 24, unaccounted 0. Decision C36 (2) carried out.

## 6. Requests (file_requests.md, four lines of row 149)

1. Answer: the seam, the two writes, the narrowing and the literal are served.
2. `otherMicInput` of `apps/mobile` has no production caller and may be deleted by a mobile row; the web twin has a caller and stays; `packages/shared` holds no such function.
3. Two mobile comments still say the seam is to come (comment only).
4. `SH/src/live/source/neutral-state.ts:49` `silentAudio` still states `'MIC-01'` (row 28's open finding; not in this row's list).

## 7. Driver decisions (for the controller to confirm)

- DD-1: rule I-2 holds test and fixture files by KIND (a test or fixture of the server), not by a closed list. The first version pinned the 17 files and went red at once on a test file agent S created for row 30 in this same batch. A test is a proof, not a reader; the gate condition ("fails when a reader is added to a file outside it") is rule I-1, which is closed.
- DD-2: the inventory is a NEW test file in the folder the profile names, not an extension of `static.test.ts` there (that file is the credential read path, another subject; agent S edits tests of the folder).
- DD-3: `audioSourceIntervalsOf` loses the literal only. The fallback to the meters' active input is kept (row 165 proposed dropping it too; C36 (2) rules the literal): it is `null` whenever no PRIMARY line is in force, so nothing is invented.
- DD-4: `otherMicInput` not deleted: it lives in `apps/mobile` and `apps/core-web`, outside this row's area (request 2).
