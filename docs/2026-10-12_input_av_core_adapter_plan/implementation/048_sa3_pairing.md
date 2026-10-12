---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 48
milestone: M3 / WP-06b
date: 2026-10-13
agent: coder-execution (batch 6, agent G)
tier: T3
requirement: SA-3 as defined by RC-3 (S13-06); AD-01 (4) (the second-connect rule); BR-08; design addendum 5.3 (HA-9 for the value of the bound)
status: complete after rulings C34 and C35 (section 0); built against the interface of the relay's report
---

# Row 48: SA-3, a camera counts as open only by the pairing

## 0. REVISION after the controller's rulings C34 and C35 (2026-10-13) - this section overrides sections 2, 3 and 6 where they differ

**C34, fail-closed.** `recordingStartedIn` refuses a start whose operation is `REAL_PRODUCTION` (read through the port `operationOf(registry)` the session already has; no new reader of a configuration flag) while `ports.relayReports` is null: 409 `INVALID_STATE`, `details.reason: SOURCE_KIND_NOT_RECORDABLE`, `details.cause: RELAY_REPORTS_NOT_WIRED` (new constant of the session unit, in the existing refusal of a start). It stands after the class rule, so a selector the operation cannot record keeps its own cause, and before anything is written: the unit does not commit, no worker and no source is started. A null source is admitted in the development operation; `simulated` never reaches the function.

**C35, two cases.**

| Case | What arrives | Outcome |
|---|---|---|
| (a) absent | nothing from either side, for any length of time | no fault; the degraded start of D72(k) stays |
| (a) absent | the worker's `CAMERA_NOT_CONNECTED` for a camera no relay reported for | no fault; the existing event `CAMERA_NOT_CONNECTED` names the camera, the session records with the other |
| (a) none at all | both absent | the pairing says nothing; the worker ends the session `NO_CAMERA_CONNECTED`, a failed start as before |
| (a) relay failure | the adapter's open fails | as before (row 47): `CAPTURE_CAMERA_NOT_OPENED`; the report interface carries successes only |
| (b) unpaired | relay report, no worker connect within the bound | fault `WORKER_REPORT_MISSING` |
| (b) unpaired | worker connect, no relay report within the bound | fault `RELAY_REPORT_MISSING` |
| (b) contradictory | second worker connect; second relay report | `WORKER_CONNECTED_TWICE`; `RELAY_REPORTED_TWICE` |
| (b) contradictory | the worker refuses a listener whose relay reported | `WORKER_REFUSED` |
| (b) other attempt | a relay report naming an earlier or a later attempt | `ATTEMPT_MISMATCH` (replaces `ATTEMPT_UNKNOWN`; an earlier attempt is no longer dropped) |

A fault of (b) ends the capture also when the other camera is paired. What states it, all existing types: the session goes to `FAULT` (`fault.kind: CAPTURE_FAULT`), its fault row holds `reason: CAMERA_INGEST_NOT_PAIRED`, ONE active alert `CAPTURE_FAULT` of severity `CRITICAL`, ONE audit row `FAULT_RAISED CAPTURE_FAULT`, one error-log entry with the closed reason. No member of `packages/shared` or of the audit vocabulary was added.

A worker-side report carries no attempt of its own (the session stamps it), so one stamped with another attempt than the one in force is dropped, not a fault; only a relay's own word about its attempt can be a mismatch. RISK to weigh at row 86: a relay of a worker that just went down, reporting in the instant after the phase `RESTARTING`, names the earlier attempt and by C35 ends the capture; row 46's `close()` must end a relay before it resolves.

**Checks after the revision** (in `apps/core-server`):

| Check | Result |
|---|---|
| `npx vitest run --project unit --maxWorkers=2 src/capture-session/__tests__ src/capture/__tests__/supervisor.test.ts` | `Test Files 4 passed (4)`, `Tests 101 passed (101)` (pairing unit: 12 cases) |
| `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/capture-session/__tests__/session-capture.db.test.ts src/capture/fence/__tests__/development-session.db.test.ts src/capture-notices/__tests__/session-start.db.test.ts` | run 1 `1 failed | 83 passed (84)`: the existing class-refusal case got the new cause (the C34 check stood before the class rule; moved after it). The fence and notices files passed in this run |
| the session file again | `Test Files 1 passed (1)`, `Tests 75 passed (75)`, `0 remain` |
| session unit files with `capture/__tests__/static.test.ts`, `test/static/log-calls.test.ts`, `logging.test.ts` | `Test Files 6 passed (6)`, `Tests 97 passed (97)` |
| typecheck, lint | 0 errors and 0 warnings in this row's files |

The D72(k) cases of task 3 (`no camera connected`, the durable control, `R74-03`) are unedited and pass. EDITED existing cases, each by one member: the four that put `REAL_PRODUCTION` over the fake adapters for another subject (F-Y item 3; row 47's bound; row 179's two) now hand in a source that never reports (`SILENT_RELAYS`), because C34 refuses them otherwise; no expectation of theirs changed.

New session cases: production without a source refused, nothing started; development without a source as before; one camera absent and the other paired: `RECORDING`, durable, the warning names the camera, 0 audit entries; no camera at all: failed start with the worker's cause; one camera unpaired and the other paired: capture ended; a relay report of a later and of an earlier attempt: capture ended.

Decisions 1 and 2 of section 6 are replaced by C35 and C34. Decision 3 is replaced by the row "other attempt" above. Status: **complete** against the interface; open requests in section 5 and `file_requests.md`.

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`.

## 1. What was built

| File | Change | Description |
|---|---|---|
| `CS/capture-session/ingest-pairing.ts` | new | The rule as a pure unit: `createIngestPairing({ cameras, boundMs, after, opened, fault })` with `begin(attempt)`, `relayReported`, `workerConnected`, `workerRefused`, `open()`, `failure()`, `end()`; `INGEST_PAIRING_BOUND_MS` (5,000); the closed list `IngestPairingFault` (6 members); the interface of the relay's side, `RelayIngestReport { sessionId, deviceId, attempt }` and `RelayIngestReports { subscribe }`. It imports nothing, reads no clock, holds no address |
| `CS/capture-session/index.ts` | modify | Ports `relayReports` (default null) and `ingestPairingBoundMs`; in `begin`, for `REAL_PRODUCTION` with a source, the pairing is made and the source subscribed BEFORE the worker is started; `onIngest` (the worker's side, from telemetry); the worker's refusal in the existing warning listener; `begin(attempt)` at the phases `RECORDING` and `RESTARTING`; `pairingFailed` ends the capture through `captureEnded` with the cause `CAMERA_INGEST_NOT_PAIRED`; `release` ends the pairing. Header paragraph. The names of the interface are exported again from the unit's index for the wiring rows |
| `CS/capture-session/__tests__/ingest-pairing.test.ts` | new | 10 unit cases (a new unit, so a new file) |
| `CS/capture-session/__tests__/session-capture.db.test.ts` | modify | one block, 7 cases; the rig's case number wraps at 100 (the file reached its 100th session: `% 100`, each rig has its own database) |

## 2. The rule, as built

| Arrives | Outcome |
|---|---|
| relay report and worker connect report, same camera, same attempt, within the bound, either order | the camera counts as open (`opened`; info line `CAPTURE_CAMERA_INGEST_PAIRED`) |
| relay report only, bound passes | fault `WORKER_REPORT_MISSING` |
| worker connect report only, bound passes | fault `RELAY_REPORT_MISSING` |
| second worker connect report for a camera of the attempt (before or after it was open) | fault `WORKER_CONNECTED_TWICE` (AD-01 (4)) |
| second relay report for a camera of the attempt | fault `RELAY_REPORTED_TWICE` |
| the worker's refusal of a camera's listener | fault `WORKER_REFUSED` (BR-08) |
| a report of an EARLIER attempt | dropped: pairs with nothing, no fault |
| a report of an attempt that has not begun | fault `ATTEMPT_UNKNOWN` |
| a report of another session, or of a device that is no camera of the plan | dropped |

One fault per capture: the first is said once and ends the pairing. In the session it is one error line and one error-log entry (`CAPTURE_INGEST_NOT_PAIRED`: session, camera, attempt, reason), then `captureEnded(..., 'CAMERA_INGEST_NOT_PAIRED', durable)`: the engine's door records the end of the capture on the session (the audit entry), the worker is stopped, every source is closed.

**What the two reports are.** (i) The relay's: whatever calls the listener of `ports.relayReports`. (ii) The worker's connect report: the ingest state of a camera in a telemetry frame CHANGING to `CONNECTED` (protocol member `ingest[].state`); the level said again is the same report, `CONNECTED` after another state for the same worker is a second one. The worker's refusal: `WARNING CAPTURE_FAULT / CAMERA_NOT_CONNECTED`, the frame of both codes of row 175 (`implementation/175_worker_gate_log_hygiene.md`, item (3)).

**Where it is applied.** `REAL_PRODUCTION` with a report source. Not in the development operation (no relay there), not in `simulated`, and not in production while the port is null.

## 3. Checks (this Mac; no worker, no relay, no port)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| The unit | `npx vitest run --project unit --maxWorkers=2 src/capture-session/__tests__/ingest-pairing.test.ts` | `Tests 10 passed (10)` |
| Session database file | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/capture-session/__tests__/session-capture.db.test.ts` (sandbox off) | run 1 `1 failed | 68 passed`, run 2 `2 failed | 77 passed (79)` with the fence and notices files: the control cases could not create a session (the rig's case number had three digits at its 100th session); run 3 `Test Files 1 passed (1)`, `Tests 70 passed (70)`, `0 remain` |
| Fence session and notices session start | in run 2 above | both files passed (`2 passed` of 3 files) |
| Session and supervisor unit files | `npx vitest run --project unit --maxWorkers=2 src/capture-session/__tests__ src/capture/__tests__/supervisor.test.ts src/capture/__tests__/forwarder.test.ts src/capture/__tests__/fault-lifecycle.test.ts src/capture/__tests__/records.test.ts` | `Test Files 7 passed (7)`, `Tests 226 passed (226)` |
| Capture unit folders and `test/static`, once | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__ src/capture-session/__tests__ src/capture-notices/__tests__ test/static` | `Test Files 2 failed | 38 passed (40)`, `Tests 2 failed | 841 passed (843)`: `test/static/imports.test.ts:399` (row 70's module) and `test/static/search-path.test.ts:94` (row 65's file); neither names a file of this row |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors in this row's files; errors of rows in flight as listed in `file_requests.md` |
| Lint | `npx oxlint src/capture/supervisor.ts src/capture/types.ts src/capture-session` | one warning in the new test file, fixed |
| Secret-scan needles | `node scripts/secret-scan/count-only.mjs apps/core-server/src/capture-session apps/core-server/src/capture/supervisor.ts` | `ingest-secret: 0`, `TOTAL: 0` |

The row's verification cell, at the session level (db block of row 48) and in the unit:

| Item | Result |
|---|---|
| report without connect is a fault | `CAM-01@1 WORKER_REPORT_MISSING`; 1 error line, 1 audit entry with the cause, `STOP` sent, 4 sources closed, `FAILED_START` |
| connect without report is a fault | `CAM-02@1 RELAY_REPORT_MISSING`; the same five facts |
| both inside the bound, in both orders, open the camera | relay first for CAM-01, worker first for CAM-02 in one session: both paired, the capture alive past twice the bound, 0 audit entries |
| a refusal code of row 175 reported for a port: a capture fault with 1 audit entry | `CAM-01@1 WORKER_REFUSED`; 1 audit entry, still 1 after twice the bound |
| the brief's combinations: a duplicate; a report for another attempt | second connect after open: `WORKER_CONNECTED_TWICE`; second relay report: `RELAY_REPORTED_TWICE`; earlier attempt dropped; later attempt: `ATTEMPT_UNKNOWN` |
| controls | production without a source, and development with one: the same lone connect report and the same refusal change nothing, 0 subscriptions |

## 4. Doubles, and what stays unproven

- Doubles: the relay's report is a fake of the injected source; the worker's side is frames of the `FakeWorkerProcess`; production is the port `operationOf`. The bound in the session cases is 120 ms through the port; 5,000 ms is pinned in the unit.
- Unproven here: a real relay's report and a real worker's telemetry inside 5 s (HA-9; `9A/H-17`); a foreign push in both orders against the real worker (rows 142, 90); that nothing of the track is sealed after the fault (row 151).
- LIMIT: a telemetry event carries no attempt; the session stamps it with the supervisor's attempt when it reads the frame. A frame of an earlier worker read after a later one began would be stamped with the later attempt; the consequence is a fault at the bound (never an open camera, which also needs the relay's report of that attempt). Closing it needs the attempt on the supervisor's telemetry event.
- NOT CHANGED: the event `STARTED` still names the cameras whose adapter returned a source. "Open by SA-3" is the pairing's own state (`open()`, the info line); no slice or client reads it yet.

## 5. What is left to rows 43, 44, 46

1. A program that reports (rows 43/44) and an object with `subscribe` handed to `sessionCapture(app).replace({ relayReports })` in the composition of production. Until then SA-3 is not applied anywhere.
2. The relay must know its attempt: request line for `CameraSourceTarget.attempt` (`file_requests.md`).
3. Row 46: `close()` of a camera source ends its relay before it resolves, so that no report of an earlier attempt is produced after the session moved on (the pairing drops one that still comes).

## 6. Identifiers, and DRIVER DECISIONS for the controller

Closed on doubles, against the interface: RC-3 / S13-06 (the Core half), AD-01 (4), BR-08 (the pairing half). Open: RC-4 (no resumed push exists), row 151's half of BR-08.

1. **A worker refusal ends the capture also when one camera of two would have been enough** (BR-08 read strictly). It removes the degraded start of D72(k) in production once a source is wired. The narrower reading is one condition; request line filed.
2. **No source, no pairing** - also in `REAL_PRODUCTION`. Chosen because no relay report exists yet and a production session would otherwise fault at every start on this Mac's doubles. It is fail-open until the wiring row sets the port: a condition of the lift (request line filed).
3. **A report of an earlier attempt is dropped, one of a later attempt is a fault.**
4. **A second relay report is a fault** (the documents name only the worker's second connect).
5. **The cause on the session is one word**, `CAMERA_INGEST_NOT_PAIRED`; the closed reason is in the error log only. No new member of the shared wording tables (another writer's files): the operator's sentence for this cause is not written yet.
6. **The rig's case number wraps at 100** (test file only).

---
*Generated: 2026-10-13*
