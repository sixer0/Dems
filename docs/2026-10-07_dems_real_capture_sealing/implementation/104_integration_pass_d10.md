---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: integration pass D10 — what pass D6 left open (decision D162)
date: 2026-10-10
agent: coder-execution (single driver; rules D94 / D122, ownership D95 §9)
source_plan: implementation/100_integration_pass_d6.md (items 7, 10, 12, 15); delegation_progress/file_requests.md line 17:26:45Z (pass D9)
narrative_tier: 3
status: needs-review — items 1, 3, 4, 6, 7 done; 5 half (clients done, Core half is a request); 2 NOT wired (shape and rule built, the two `it.fails` stay)
---

# 104 — Integration pass D10

Baseline `e296ce7` plus the wave D tree. No commit, no migration (schema `[5, 'dbc-6']` asserted in
the new db file). Paths: `S` = `packages/shared/`, `C` = `apps/core-server/`, `W` =
`apps/core-web/src/`, `M` = `apps/mobile/src/`.

## 1. Per item

| # | Status | What (file) |
|---|---|---|
| 1 | done | The simulator models a recording start as the Core does. NEW `S/src/sim/capture-session.ts`: the shared copy of the Core's five capture transitions + the simulator's own decision `advanceCaptureStart`. `session-machine.ts`: `startRecordingTransition` writes `captureDurable: false`; `stopRecordingTransition` refuses a stop while it is `false` (`SimTransitionError.reason: CAPTURE_NOT_DURABLE`); `tickMachine` decides the start `CAPTURE_CONNECT_MS` (1,000 ms, `constants.ts`) after `startedAt`. `sim/api.ts`: the stop route answers `409 INVALID_STATE`, `details.reason: CAPTURE_NOT_DURABLE`. Only where the simulator runs its own capture (`CreateSimOptions.capture: 'simulated'`): the Core in real capture (`'external'`) is untouched. See §2 |
| 2 | NOT WIRED | The premise does not hold: both `it.fails` read the `captureDevices` SLICE of the engine state, which `modules/devices/status.ts` never writes (operations 44-47 list tracks and channels) and which the clients read for the badge and "is on". Built: optional `sourceOpen` on `CaptureDeviceStatusSchema` / `CaptureDeviceStatus` (+ OpenAPI); pure `applyCaptureSourceFactsTransition` (`S/src/sim/core-facts.ts`) with tests. Missing: one fact door of the engine host and its caller — request filed with the exact text. `.fails` NOT removed (both cases still fail as written) |
| 3 | done | `C/src/capture/boot/index.ts`: ONE statement of the boot step after the probe, `publishEvidenceVolume` → the engine's `applyStorageVolume` door. Nothing in SIMULATED; a hand-over that fails is logged + persisted (`CAPTURE_BOOT_STORAGE_VOLUME_NOT_APPLIED`) and does not refuse the start |
| 4 | done | `C/src/modules/demo/reset.ts`: the routine's `RESET_BLOCKED_REAL_EVIDENCE` is answered `409` with that code (was `503 NOT_READY`). The guard is unchanged. The contract walk produces the cell |
| 5 | HALF | Clients: `useTranscriptFollowsRevision` in `W/features/evidence/transcript.ts` and `M/features/evidence/transcript.ts`, one call line in each `transcript-pane.tsx`: both reads are fetched again when `item.transcript.revision` of the slice moves (also absent → a number). Core half NOT done: it is not one line of `db/mapping` (the mapping's row set holds neither `transcripts` nor `transcript_revisions`); the existing door `noteTranscriptRevision` does it from a boot step of `modules/transcripts` — request filed |
| 6 | done | Built from pass D9's request line (it was there). `S/src/evidence-verify`: result member `transcriptModel` (`types.ts`), report line after the transcript state (`report.ts`), V-10 holds the document's header against the manifest and against the provenance rule — finding `TRANSCRIPT_MODEL_MISMATCH` naming the member (`verify.ts` `checkTranscriptModel`). Operation 41 carries the optional member (`S/src/api/evidence.ts`, `C/src/evidence-verify/index.ts`) |
| 7 | done, nothing to fix | `W` `export-job.test.tsx` and `M` `live-evidence-export.test.tsx` green as they are |

## 2. Item 1 — what the simulator does now

| Start | Outcome, decided 1,000 ms of simulated time after the start |
|---|---|
| every camera of the session connects | durable: the member is REMOVED (absent reads as durable) |
| one camera of two has an active `CAMERA_LOSS` | durable + one WARNING `CAPTURE_DEVICE_UNREACHABLE` / `SESSION_START` / `NOT_CONNECTED`, `degraded: true`, naming that camera |
| every camera has an active `CAMERA_LOSS` | failed start: `FAULT`, `captureDurable: false`, `startedAt` null, 0 bytes; alert + `FAULT_RAISED` row with `reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0`; recovery → history INCOMPLETE / never started / 0 bytes, no evidence item |
| stop before the decision | refused, `CAPTURE_NOT_DURABLE` (before the reason check: 409 before 422) |

**Demo control (first decision): the EXISTING fault `CAMERA_LOSS` with a camera target** (operations
73 / 74). No new control. It is read when the start is decided. LIMIT: the pre-check blocks while it
is active, so the fault is set between ARMED and Start.

**One implementation:** not yet. The engine's file is another row's, so `S` holds a copy; 
`C/src/engine/__tests__/capture-session-parity.test.ts` (new, 12 cases) holds the two equal, with
one asserted difference (the shared failed start hands the two keys to the raise, so the audit row
has them too). Request to unify filed.

**Flipped tests** — each got ONE call of the shared helper `passCaptureStart(advance, tick?)`:

| File | Why |
|---|---|
| `S/test/session-machine.test.ts` | harness `toRecording` + one case stop right after the start |
| `S/test/sim-api.test.ts` | the stop sequence: 409 while connecting is now asserted, then 422 / 202 |
| `S/test/sim-gap-closure.test.ts` | a short stop reason right after the start |
| `S/test/sim-v2-parity.test.ts` | harness `toRecording` (stop / switch right after the start) |
| `S/test/sim-core-driven-seal.test.ts` | the `captureDurable: false` case put the member on BEFORE its stop; the stop comes first now |
| `C/src/modules/sessions/__tests__/routes.test.ts` | one case stops right after the start |
| `C/src/modules/sessions/__tests__/operations.db.test.ts` | two cases compare the stored state right after the start (`false` has no column) |
| `C/src/engine/__tests__/commands.db.test.ts` | its `startRecording` helper (six cases: stored-state compare, stop) |

`S/test/integration-c1.test.ts`: comment only. Web and mobile: none found in the folders run.

## 3. Results (each once; a second run only after a fail)

| Check | Result |
|---|---|
| typecheck shared / core-server / core-web / mobile | 0 errors each |
| lint shared, core-server (oxlint); touched web + mobile files | exit 0 |
| shared suite | 91 files, 2387 tests, green |
| Core unit: parity, engine static, sessions, demo, devices, storage, capture/boot, capture static, evidence-verify, `test/static` | 43 files, 904 tests, green |
| Core db (lock): `contract.test.ts`, `rbac-matrix.test.ts`, `commands.db`, `operations.db`, `volume-at-boot.db` (new), `modules/demo`, `modules/devices` | 12 files, 194 passed, 1 expected fail (row 140's `it.fails`); the contract coverage cell `resetDemo 409` is produced |
| Core db, flip search (one run of 49 files, with the delay at 1,200 ms) | 18 red in 8 files: 15 mine (8 flipped; 7 gone with the delay at 1,000 ms), 1 the contract cell (item 4), 2 foreign (§4) |
| OpenAPI regenerated under `npm.lock` | 97 operations, offline 31 |
| Web: `simulator-start` (new) 2, `transcript-follows-revision` (new) 3, `export-job`, `transcript`, session-monitor / session-new / dashboard folders, five static guards | 24 files, 204 tests, green |
| Mobile (`--maxWorkers=2`): `simulator-start` (new) 2, `transcript-follows-revision` (new) 3, `live-evidence-export`, session-live / -new / -recovery / -finalizing, runtime | 84 suites, 848 passed, 2 failed — both foreign (§4) |

Controls: item 1 — one tick short of the delay is still connecting; a durable recording that faults
keeps its evidence item; external capture is never decided by the time. Item 4 — another routine
code at the same step is still 503. Item 6 — `cpu-local` with a null fails (manifest and document);
a server manifest with an invented hash fails with a forger's valid signature.

## 4. Not proven / limits / foreign reds

- Nothing was run in a browser or on a device. The whole web, mobile and Core db suites were NOT run.
- Item 1, a Core in SIMULATED capture: after a restart inside the connecting second, or after a
  failed start, the member is absent (no column). The stop refusal of that Core has no
  `details.reason` until one line of `engine/errors.ts` lands (request).
- Item 3: the real case boots REAL_DEVELOPMENT (the seed's selector names the test sources).
- Item 4: the module does not call the caller-side guard before the quiesce, so a refused reset
  still stops and resumes the server (epoch + 1) and writes no audit row of the refusal, which the
  contract text promises. Not in this pass's list.
- Item 6: a package whose `transcript.json` has no header now fails V-10. The verify builder writes
  one; packages written by other test rigs were not all run.
- Foreign reds seen: `C` `development-session.db` (MIC_RATE_AT_LIMIT, pass D9), `capture-actions.db`
  A-4 (boot step `transcriber.config`), 31 sealing unit cases (pass D9's request to row 82c);
  `M` `runtime/live-no-raw-fetch` (pass D5's `MobileMediaTransport` line) and
  `runtime/link-notice-static` (row 139's `CONNECTING` chip).

## 5. Decisions for the controller

| ID | Decision | Alternative |
|---|---|---|
| D10-1 | A Core in SIMULATED capture connects too (it hosts the same simulator) | an option per host, clients only |
| D10-2 | Durable in the simulator's own capture = the member removed, not `true`: no column holds it, and `true` broke the lossless round trip in about 25 mapping / rehydrate unit tests | `true` + a column in migration 0013 |
| D10-3 | Delay 1,000 ms: existing tests drive one second after a start; 1,200 ms flipped seven more Core db cases | 1,200-1,500 ms |
| D10-4 | Demo control = `CAMERA_LOSS` per camera, read at the decision | a new "no camera" control |
| D10-5 | Item 2 stopped at the shape + the pure rule; no engine edit | take the fact-door block as pass D6's successor |
| D10-6 | Item 6: operation 41 gains the optional member (beyond "the report prints") | report lines only |
| D10-7 | Item 3: a failed hand-over does not refuse the boot | refuse |
| D10-8 | New file in a foreign folder: `C/src/engine/__tests__/capture-session-parity.test.ts`; flipped tests outside the area as listed | — |

## 6. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npm test -w @dems/core-web` | none | MUST run. Red to expect: a test that starts through the simulator's own start and, within the first simulated second, stops, or expects REC / the timer / End Session enabled; a snapshot of a session taken in that second. Fix = one `passCaptureStart` call. None expected for the `recording` scenario or Live tests |
| `npx -w apps/mobile jest --maxWorkers=2` | none | MUST run. Same kind; plus the two foreign static reds of §4 |
| `npm run test:db -w @dems/core-server` (whole) | `db-migrate` | a case that stops, or compares the stored state, within one second after a start goes back to this pass |
| `npm test -w @dems/core-server` (unit) | none | green except the 31 sealing cases of pass D9's request |

## 7. Device / browser checks for the gate

| Check | Flow | Pass |
|---|---|---|
| SIM-START-OK | web + tablet, Simulated mode: arm, Start | "Connecting cameras…" for about a second, no REC, End Session disabled; then recording |
| SIM-START-NOCAM | arm; System demo panel: Camera loss on both cameras; Start | "No camera connected. Nothing was recorded."; close: Sessions shows Incomplete, 0 bytes, no evidence item |
| SIM-START-DEGRADED | arm; Camera loss on camera 2; Start | recording, warning naming Camera 2 |
