---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 179
milestone: M3 / WP-06b
date: 2026-10-13
agent: coder-execution (batch 6, agent G)
tier: T3
requirement: BR-07 (2) (verification/05_security_branch_b.md); RC-2 (the per-attempt half); P12-F11 (the supervisor half)
status: complete (five driver decisions to confirm; one rule of the brief broken once, section 7)
---

# Row 179: a later worker of a session gets ingest addresses of its own

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`.

## 1. What was built

| File | Change | Description |
|---|---|---|
| `CS/capture/types.ts` | modify | `CaptureAttemptIngest { chance; renewed(attempt, addresses) }`; `CaptureSupervisor.start(sessionId, plan, attempts?)` - the third parameter is optional, so no double and no other caller changes |
| `CS/capture/supervisor.ts` | modify | `renewIngest`: for every worker after the first of a session, one new address per camera from `captureIngestAddress(session, track, chance)`; the last element is compared with every element a plan of the session held (`Session.ingestElements`) and a repeat is refused; the renewed plan passes `CapturePlanSchema`; the session is told (`renewed`) BEFORE the launcher is called; only then is `current.plan` replaced. The `START` line (now `:839`, was `:794`) is unchanged: it sends `current.plan`. A plan that cannot be renewed starts no worker and is final: report `CAPTURE_INGEST_NOT_RENEWED` with one of five closed reasons (`IngestRenewalFailure`), then the existing path of a start that cannot be made (`SPAWN_FAILED`, not retryable, `CAPTURE_FAULT`). Header paragraph added |
| `CS/capture-session/index.ts` | modify | `start` is handed `{ chance: randomBytes, renewed }`; `Live.ingest` holds the address of each camera for the worker in force and is the ONE thing the target of an open reads; the camera opens belong to a `CameraRound`; `cameraRoundOver` (phase `RESTARTING`) and `cameraRoundAgain` (phase `RECORDING` after `RESTARTING`) close the sources of the earlier worker and open every camera again, in `REAL_PRODUCTION` only; `begin` says `STARTED` from the newest round. New constant `INGEST_ADDRESS_UNKNOWN` |
| `CS/capture/__tests__/supervisor.test.ts` | modify | one block, 6 cases |
| `CS/capture-session/__tests__/session-capture.db.test.ts` | modify | 4 cases inside the block of row 47 (its helpers) |
| `CS/capture-session/__tests__/ingest-address.test.ts` | modify | row 47's static pins moved with the code (5), 1 new case for the supervisor |

Not edited: `capture/index.ts` (the composition), `ingest-address.ts`, `ipc.ts`, any static-rule list, any adapter, `packages/*`, `apps/capture-worker`.

## 2. Where the source of chance comes from (the question of the brief)

`supervisor.ts` and `capture/index.ts` are under `CS/capture/` and may import no source (G-R8; DD-1 of `i03_integration_pass.md`). The source is therefore handed in PER START by the unit that already names it: the session passes the same `randomBytes` it uses at its own call (`capture-session/index.ts`, the `supervisor.start` line). No composition file changed and no rule list moved. The supervisor calls the one function itself (the row's cell: "built by the one function of row 47"); the function is now called at two lines of the server, both pinned by `ingest-address.test.ts`.

## 3. What happens at a restart, and whose part each step is

| Step | Who | State |
|---|---|---|
| The worker of attempt n is down; the supervisor waits its back-off | supervisor (existing) | unchanged |
| New address per camera, no element reused, session told, plan replaced, worker n+1 started, `START` carries the new plan | supervisor | THIS ROW |
| The session keeps the addresses of the worker in force; a camera open always takes them (also when worker 1 never came up and the cameras are first opened for worker 2) | session | THIS ROW, every real operation |
| `RESTARTING` during a recording: opens in flight given up without a report, camera sources of the earlier worker closed (`handle.close()`) | session | THIS ROW, `REAL_PRODUCTION` only |
| Worker n+1 acknowledged `START`: `openSource(deviceId, { ingestUrl: <address of n+1>, profile }, signal)` once per camera, each with the bound of a start | session | THIS ROW, `REAL_PRODUCTION` only |
| `openSource` of the production camera adapter starts a relay and writes the address into its start message on standard input; `close()` ends that relay | row 46 | NOT BUILT. The adapter must not keep an address per device between two opens: the second open of a session gets another string |
| The relay announces the byte-identical string; its report says the track and the attempt | rows 41, 43, 44 | NOT BUILT here. Row 48 pairs by attempt and reads `Live.ingest` for nothing |

## 4. Checks (this Mac; no worker process, no relay, no port)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Supervisor unit file | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/supervisor.test.ts` | `Test Files 1 passed (1)`, `Tests 67 passed (67)` (61 existing, 6 new) |
| Row 47's static file | same runner, `src/capture-session/__tests__/ingest-address.test.ts` | run 1 `5 failed | 6 passed` (the pins that had to move); run 2 `1 failed | 11 passed` (a word of my own report text matched my own new rule; text changed); then green inside the run below |
| Capture unit folders and static rules, once | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__ src/capture-session/__tests__ src/capture-notices/__tests__ test/static/imports.test.ts test/static/logging.test.ts test/static/log-calls.test.ts test/static/credentials.test.ts` | `Test Files 1 failed | 26 passed (27)`, `Tests 3 failed | 690 passed (693)`. The 3 reds are in `capture/__tests__/static.test.ts:508, :595, :1040` and name `modules/capture-audio-cards` in `app.ts` and a statements file: row 70 in flight (agent I), not this row |
| Session database file | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/capture-session/__tests__/session-capture.db.test.ts` (sandbox off) | `Test Files 1 passed (1)`, `Tests 63 passed (63)` (59 existing, 4 new); `0 remain` |
| Fence session, notices session start, capture boot | same, `src/capture/fence/__tests__/development-session.db.test.ts src/capture-notices/__tests__/session-start.db.test.ts src/capture/__tests__/boot.db.test.ts` | `Test Files 3 passed (3)`, `Tests 13 passed (13)`; `0 remain` |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors in the files of this row. Errors of rows in flight: `modules/capture-audio-cards/store.ts:60` (row 70), `modules/capture-config/__tests__/credential-reader.db.test.ts` (row 145), then `packages/shared/src/sim/session-machine.ts:504, :800, :801` (rows 162 to 165) |

The row's verification cell:

| Item | Where | Result |
|---|---|---|
| two attempts of one session: the elements of attempt 2 differ from attempt 1 for both tracks | supervisor case 1; db case "two attempts" | exact strings with a counting source; with the real source four elements, four distinct |
| the relay double receives the string of its own attempt | db case "two attempts" (the camera adapter double is what a relay would be started with) | opens 1-2 equal the plan of worker 1, opens 3-4 equal the plan of worker 2, byte for byte; the sources of attempt 1 are closed before opens 3-4 |
| the element of an earlier attempt or session is in no later plan | supervisor case 2 (three attempts, then a second session); refusal in case 4 | 8 addresses, 8 elements; a source that repeats starts no worker |
| the supervisor's existing restart tests show 0 other changed results | the 61 existing cases, unedited | 61 passed; the control case shows a start without the source sends the plan unchanged |

Beyond the cell: no event, report, status or other frame holds an element (control: the `START` frame does); four ways a renewal fails, each closed, none retried, the receiver's error text not repeated; the switch of the audio source survives a renewal; the first worker never comes up; an open in flight when its worker goes down; the development control.

## 5. Doubles, and what stays unproven

- Doubles: the `FakeWorkerProcess`, the fake camera and microphone adapters behind row 47's recording wrapper; "production" is the port `operationOf` answering `REAL_PRODUCTION` over them.
- Unproven here: that a relay of production is ended by `close()` and started again with the new string (row 46); that the worker's gate refuses the element of attempt 1 after a restart (rows 59, 142; `9A/H-01`); the 25 s bound of the second round against a real camera.
- FINDING (existing, not changed): the microphone helpers of a session are started once, after the first acknowledged `START`. Nothing starts them again for a later worker, in any operation. A recording whose worker is replaced after its `START` therefore has cameras again (production, this row) but no microphone samples. A row for it, or a decision that such a restart is not wanted at all, is the controller's.

## 6. Identifiers

Closed on doubles: BR-07 (2); the Core half of RC-2 for a later attempt. Open: the search of row 151, the worker side (rows 59, 142).

## 7. DRIVER DECISIONS and one deviation

1. **The source is handed in with `start`, by the session** - not through the supervisor's options, because the composition (`capture/index.ts`) may import none either and the session already names it.
2. **The supervisor builds, the session is told through `renewed`** (not: the session builds). The address therefore crosses one call inside the process, a map by device.
3. **A plan that cannot be renewed is final** and uses the existing code `SPAWN_FAILED` (no new member of `WorkerDownCode`: the wording tables are another writer's). The reason is in the report.
4. **Cameras are opened again in `REAL_PRODUCTION` only.** Development keeps its sources untouched at a restart, as before ("development unchanged"). To extend it: the one condition `current.production` in `cameraRoundOver` / `cameraRoundAgain`.
5. **The plan is renewed in every operation that hands the source in** (development too): the supervisor does not know the operation, and row 47 put the secret into every real operation.

DEVIATION: the first change of `capture/types.ts` was made with an exact-text script (three replacements, each asserted to match once) instead of the Edit tool, against the brief. The result was read back (`git diff`: 27 lines added, 2 replaced); every later change of an existing file used the Edit tool.

---
*Generated: 2026-10-13*
