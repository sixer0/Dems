---
task_id: 2026-10-07_dems_real_capture_sealing
row: 136
date: 2026-10-09
agent: coder-execution
status: needs-review
---

# Row 136 — `LOCAL_DEVICE` adapter kind and the development boot fence (R-11)

Paths are below `apps/core-server/` unless they start with another folder. No camera and no
microphone was opened; no permission, settings or TCC tool was used. No commit.

## 1. What was built

| # | What | Where |
|--|--|--|
| 1 | THE one capture-operation function: `captureOperationDecisionOf` (the only reader of the development flag) and `captureOperationOf` (asks it). A refused combination answers `SIMULATED`, never a real operation | `src/capture/fence/operation.ts:71`, `:84` |
| 2 | Config keys, P25 edits 15-18 (waived, D108 (b)): `DEMS_CAPTURE_DEV_SOURCES`, `DEMS_CAPTURE_HELPER_FFMPEG`, in the four places of edits 7-10 + 4 header lines | `src/config.ts:21-24`, `:50-51`, `:188-191`, `:258-263`, `:285-288`, `:322`, `:337-338`; read by the loader `src/plugins/config/load-config.ts` (+9 lines) |
| 3 | Boot step `capture.fence`: the pure decision `captureFenceRefusalOf`, the runner `runCaptureFenceBoot` (log line + persistent error-log entry per refusal, fixed message with the remedy, registry ids only, never a path) | `src/capture/fence/boot.ts:126`, `:198` |
| 4 | Helper-program rule at boot, STRICT (no development exception): row 134's path rule + "is set" + "is executable" | `src/capture/fence/boot.ts:113` |
| 5 | Registration of the local camera and microphone as NEW rows (`LOCAL_DEVICE` as a SQL literal, next free `CAM-NN` / `MIC-NN`, idempotent by the statement itself, no UPDATE anywhere) | `src/capture/fence/statements.ts:38`, `registration.ts:74` |
| 6 | Device registry of the running operation: `REAL_DEVELOPMENT` = local camera + local microphone + a generated test source behind every stored `FAKE` camera / microphone; `REAL_PRODUCTION` = no adapter (class C is not loaded); `SIMULATED` = none | `src/capture/fence/index.ts:120`, `:168` |
| 7 | Development test sources of kind `FAKE` that really feed the worker (generated picture pushed to the loopback listener; 440 / 880 Hz tone into the pipe). One additive option `source: 'GENERATED'` in row 134's helper | `src/capture/fence/generated-sources.ts`; `src/capture/adapters/local/camera-helper.ts:60` |
| 8 | The four `session_capture_sources` rows, pure, plus the MR-S6 re-read check and "this operation cannot record at all" (SEC35-40) | `src/capture/fence/sources.ts:96`, `:121`, `:83` |
| 9 | Client data: `adapter` / `sourceClass` / `listed` behind ONE function; development label data (non-null in `REAL_DEVELOPMENT` only, ruling R-2) | `src/capture/fence/sources.ts:147`, `:162` |
| 10 | Mount in the capture unit (sinks handed in: `index.ts` stays the one logging file), control `captureFenceControl(app)` (operation, outcome, registry, `openSources`, `leftoverHelpers`) | `src/capture/index.ts:163`; `src/capture/fence/index.ts:196`, `:215` |
| 11 | One-command helper setup `npm run capture:dev-setup` | `scripts/capture/dev-setup.mjs`; root `package.json` (one script line) |
| 12 | Row 135's pending request: microphone exports in the local barrel | `src/capture/adapters/local/index.ts` |

Refusal codes: `DEV_SOURCES_NEED_REAL_CAPTURE`, `DEV_SOURCE_WITHOUT_FLAG`,
`DEV_FLAG_WITH_PRODUCTION_SOURCE`, `DEV_HELPER_PROGRAM_UNUSABLE`, `DEV_FLAG_WITH_LAN_LISTENER` (the
five), and `REAL_CAPTURE_WITH_DEMO_CONTROLS` for table row 4 (row 61's row; the name is provisional).

## 2. Real vs stand-in

- Real: everything in §1, run by `dems_app` on PostgreSQL (statements, audit row, whole boots).
- Stand-in in tests only: the helper program is `/bin/echo` (passes the path rule, captures
  nothing); helper processes are a scripted door. No test starts FFmpeg against a device.
- The generated test sources were exercised through a scripted door (argument lists), not through
  a real worker: that is row 140 / gate 70.

## 3. Verification (each with its control)

| Check | Result |
|--|--|
| `src/capture/fence/__tests__/fence.test.ts` (unit) | 45 / 45 |
| `src/capture/fence/__tests__/fence.db.test.ts` (as `dems_app`, clones, db lock; schema pin `[5, 'dbc-6']`) | 13 / 13, run twice |
| `src/capture/__tests__/static.test.ts` (G-R2, G-R8, file pins, P25, new G-R12, G-R14, G-R15, SEC35-41 (c)) | 46 / 46 |
| core-server typecheck / lint | 0 errors / 0 findings in this row's files |

- Table: rows 1-10 each boot or refuse as specified, with message, log line, error-log entry
  (unit); rows 1, 3, 4, 6, 7, 8, 9 also as whole boots on PostgreSQL.
- Single key / pair: from a production configuration all 4 single changes and all 6 pairs end
  "refused" (7) or "boots, not development" (3); control: the same two keys on a database without
  production sources do boot development.
- Stored `LOCAL_DEVICE` + `REAL_PRODUCTION`: assigned -> refused, id named; unassigned -> not named.
- Registration: two boots, second inserts nothing, table equal column by column, the five
  built-ins unchanged; `UPDATE ... adapter_kind` as `dems_app` -> `42501` (control: `enabled`
  updates); a `POE` local device -> `23514`.
- `SIMULATED`: a database holding assigned local and production cameras boots (2 boots), no
  statement of the fence runs; control: same database refused once the mode is `real`.
- Sources builder: development plan = `CAM-03 LOCAL_DEVICE`, `CAM-02 FAKE`, `MIC-03 LOCAL_DEVICE`,
  `MIC-02 FAKE`; mixed, all-production, no-opener, three-slot, wrong-class sets refused; control:
  the good set gives four rows.
- Helper rule: Homebrew path refused `DIRECTORY_WRITABLE` (unit + whole boot on this host);
  private copy accepted; the same copy group-writable, in a group-writable directory, or reached
  through a link into one refused (real files below `.data/`).
- Frozen-file pin: one planted line in `config.ts` -> digest differs, test red; restored, green.

Static pins brought to green (smallest additive edits): G-R2 allowlist and G-R8 process pin gain
`adapters/local/process-door.ts` and `pipe-files.ts`; the capture file list gains the seven fence
files; the adapters file-list pin gains the 14 `local/` files; `credentials.test.ts` (x2) — fixed in
`local/__tests__/mic-helper.generated.test.ts:176` (the two driver variable names are spelled from
parts; the assertion is unchanged).

## 4. Not proven / open

1. **Boot audit row only for real operations.** Written at every boot (SEC35-41 (b)) it breaks
   25 closed restart tests in 7 files, which hold a restart to "nothing but the epoch moves". It is
   written for `REAL_PRODUCTION` / `REAL_DEVELOPMENT`; `SIMULATED` needs a ruling
   (`BOOT_AUDIT_OPERATIONS`, `boot.ts:64`).
2. **The local microphone cannot be assigned today.** A selector naming `MIC-03` stops the boot at
   `engine.rehydrate`: the shared contract admits `MIC-01` / `MIC-02` only. The camera is
   assignable. Blocks row 140's "mic 1 = this Mac's microphone".
3. **Operations 78 / 79 do not ask the registry yet** (`M4-LOCAL-SEL-1`, API half): the capture
   unit may not import the capture-config module (unit cycle). Exact two-line change requested.
4. `REAL_PRODUCTION` cannot boot on any database the engine can rehydrate today (the microphones
   are always the `FAKE` built-ins): the "production sources only" cell is proven in memory only.
5. `adapter` / `sourceClass` are not in the shared device shapes (row 132 landed ops 93-97 without
   them): the mapping stays behind `deviceSourceFieldsOf`.
6. Leftover helpers of an earlier run are reported (warn + error log), not a boot refusal; the
   session start (row 71) must ask `leftoverHelpers()`.
7. The private helper copy still loads Homebrew's shared libraries (stated by the setup command).
8. During verification the whole db project ran once by mistake (an empty file list): 41 failed
   with the audit row at every boot, 12 of them the known `contract.test.ts` baseline.

## 5. To wire when a row lands

- Row 61: adopt `captureOperationDecisionOf`; decide table rows 4 (code name) and 5.
- Row 71: `assertRecordableSelector` -> `buildSessionCaptureSources` -> write the four rows ->
  re-read -> `assertSessionSourcesOfOperation`; `captureFenceControl(app).registry()` for openers;
  `leftoverHelpers()` before a start; `onSourceLost` of the adapters is not connected.
- Rows 137 / 138: `developmentSourceLabelOf`, `deviceSourceFieldsOf`, `openSources()`.
- Requests filed (`delegation_progress/file_requests.md`, 8 lines): `kinds.ts` comment,
  `fencing.ts` caller, capture-config registry wiring, slice members, `MicInputId`, engine test
  support for real mode, the audit-row ruling.

## 6. Device / browser checks left for the gate (scripted flows)

- Flow A (development boot): `npm run capture:dev-setup`, start with the three keys, expect
  `capture fence passed`, Devices lists `CAM-03` / `MIC-03`; restart, nothing inserted.
- Flow B (refusals): start with each unsafe combination, expect the code in the log and no listener.
- Flow C (row 140): a development session, the four source rows, the helper snapshot.

## 7. Decisions taken

- The fence lives in `src/capture/fence/` (inside the capture unit, as spec §I says for the adapters).
- `src/capture/index.ts` (+19 lines) and `src/plugins/config/load-config.ts` (+9) were edited:
  neither is in the ownership map, and without them the keys and the boot step do nothing.
- The local rows are inserted with `enabled` = "is in the device list now" (listing opens nothing).
- After the first registration the engine is stopped and started (`resync`) once, so that the
  first development boot lists the new rows.
- `.data/helpers/` is now mode 0700 and the copy 0755 (row 135's copy was replaced by the same binary).
