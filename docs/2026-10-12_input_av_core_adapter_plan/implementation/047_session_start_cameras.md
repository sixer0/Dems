---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 47
milestone: M3 / WP-06b
date: 2026-10-13
agent: coder-execution
tier: T3
requirement: P12-F03 (the session half), P12-F05 (a, e: the session half), AD-05 (1) (the static test of RC-2), AD-11 (the window constant; one open per camera), BR-07 (1), (3), (4); S13-05 (the secret); BR-07 (2) is row 179, SA-3 / BR-08 is row 48
status: needs-review
---

# Row 47: the session start for production sources

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`.

Status `needs-review` for three things outside the row's area, each a line in
`delegation_progress/file_requests.md`: one test file of the fence is red by this row's change
(section 6, request 1); the production window reaches a worker only after one line in
`CS/capture/index.ts` (request 2); where the one address function lives decides how row 179
reaches it (request 3). The row's own files compile, lint clean and pass.

## 1. What was built

| File | Change | Description |
|---|---|---|
| `CS/capture-session/index.ts` | modify | `captureIngestAddress(sessionId, trackId)`: the one function that builds an ingest address, with `CAPTURE_INGEST_SECRET_BYTES` (16). `openCameras`: every camera of the plan opened in the same turn, each adapter asked once, the plan's profile in the target; in `REAL_PRODUCTION` each open has its own signal and is given up at the port `cameraOpenBoundMs` (default `PRODUCTION_CAMERA_OPEN_BOUND_MS`, 25,000). `begin` waits for the opens or for the end of the capture, and says `STARTED` in the order of the plan. Header paragraph "THE CAMERAS OF A START" |
| `CS/capture/worker-arguments.ts` | modify | `PRODUCTION_INGEST_OPEN_WINDOW_MS` (30,000), `CAPTURE_WORKER_PRODUCTION_SETTINGS` (frozen), `captureWorkerArguments(logPath, production = false)`. No import of the server: the caller compares the operation (static rule A-5) |
| `CS/capture-session/__tests__/session-capture.db.test.ts` | modify | the address pin of the first case follows the new form; the rig exposes its log; one new block of 4 cases |
| `CS/capture-session/__tests__/ingest-address.test.ts` | new | 11 unit cases: the function, the window, the row's static rule with the development exception |

Not edited: `supervisor.ts`, `ipc.ts`, `capture/index.ts`, `adapters/types.ts`, `adapters/local/*`, the three capture static-rule files, `load-config.ts`, `packages/capture-protocol`.

## 2. How the plan reaches the worker today (the question of the brief)

| Question | Finding | Evidence |
|---|---|---|
| Does the plan travel as an argument? | No. The argument list is the log path, the heartbeat and five named settings | `CS/capture/worker-arguments.ts`, `captureWorkerArguments`; `CS/capture/index.ts:167` |
| How does it travel? | As the member `plan` of the `START` frame, written to the worker's standard input | `CS/capture/supervisor.ts:794` (`plan: current.plan`); `CS/capture/ipc.ts:132` (`stdin.write(encodeFrame(message))`) |
| Does the supervisor put the plan into a message or a log? | No: a refused plan names the path of the first issue only | `CS/capture/supervisor.ts:1084-1085` |
| Does the session log it? | No: section 4, static rule | - |

So nothing had to change in the argument list for BR-07 (4). The unit test asserts that neither argument list holds an address.

## 3. The decisions of the row, as built

1. **The address.** `rtsp://127.0.0.1:<port of the track>/<session>/<track, lower case>/<element>`. The element is `randomBytes(16)` of `node:crypto` as URL-safe base64 without padding: 22 characters of `A-Z a-z 0-9 - _`, the form row 5's needle counts. The first three path elements are today's, so a reader that compares a prefix keeps working. Built once per track at every start, at one line of `begin`.
2. **Two receivers.** The map given to the plan builder (it reaches the `START` frame), and the target of `openSource`. The string is the same object in both: never rebuilt, parsed or re-encoded.
3. **The profile.** The target is `{ ingestUrl, profile }` with the plan's code; the member is left out when the plan's line has none.
4. **Same turn.** All opens are started in one loop without a wait between them; a camera that has not answered costs the other nothing. This holds in every real operation (one code path).
5. **The bound.** Only in `REAL_PRODUCTION`: at 25,000 ms the open's own signal is aborted, the camera is reported `CAPTURE_CAMERA_NOT_OPENED` with `cause: CAMERA_OPEN_BOUND`, and a handle that arrives later is closed at once. `REAL_DEVELOPMENT` gets the session's signal and no bound, as before.
6. **The end of a capture during the opens.** `begin` no longer waits for an open in flight when a stop committed or the worker ended the session (the rule R74-08 already applies to the microphone starts). The open ends by the session's signal; a source it still brings is closed.
7. **Outside every unit.** A camera is opened in `begin` only; `begin` runs in the background chain after the commit. Traced: the pipeline refuses a nested unit by an `AsyncLocalStorage` state that is marked ended at the end of the unit (`CS/core/pipeline.ts:385-393`), so a unit submitted from `begin` is served. Shown by a case and held by a static rule.
8. **The window.** 30,000 ms is a literal in `worker-arguments.ts`; the builder takes a boolean and reads nothing else.

## 4. Checks (this Mac; no worker, no relay, no camera, no port)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| New unit file with the capture static rules and pins (10 files: `ingest-address`, `capture/__tests__/static`, `adapters/__tests__/static`, `tidy-fy`, `protocol-pins`, `test/static/imports`, `scan-coverage`, `test-support-imports`, `logging`, `log-calls`) | `npx vitest run --project unit --maxWorkers=2 <files>` | run 1: `Test Files 1 failed | 9 passed (10)`, `Tests 1 failed | 141 passed (142)`: the one failure was a wrong expectation of the new file (it counted the transcriber's `begin`). Both capture static files green |
| The same new file with the argument-list pins (`boot.test.ts`, `forwarder.test.ts`, `test/static/credentials.test.ts`) | same runner, 4 files | run 2: `Test Files 4 passed (4)`, `Tests 68 passed (68)` |
| The capture-session database tests, once | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/capture-session/__tests__/session-capture.db.test.ts` (sandbox off) | `Test Files 1 passed (1)`, `Tests 59 passed (59)` (55 existing, 4 new); throw-away databases, `0 remain` |
| The two other session-level database files | same, `capture-notices/__tests__/session-start.db.test.ts`, `capture/fence/__tests__/development-session.db.test.ts` | `Test Files 1 failed | 1 passed (2)`, `Tests 2 failed | 7 passed (9)`: the fence file pins the old address (request 1) |
| Typecheck | `npm run typecheck`, then `npx tsc --noEmit` | first: 1 error, in `modules/capture-config/__tests__/credential-reader.db.test.ts:101` (another row in flight); second: 0 `error TS` lines |
| Lint | `npx oxlint` on the four files | one warning in the new test file, fixed; the file re-run: `Tests 11 passed (11)` |
| Secret-scan needles on the changed sources | `node scripts/secret-scan/count-only.mjs apps/core-server/src/capture-session apps/core-server/src/capture/worker-arguments.ts` | `ingest-secret: 0`, `TOTAL: 0` |

The row's verification cell:

| Item | Where | Result |
|---|---|---|
| a first camera delayed 20 s does not delay the second | db case "both cameras are opened in the same turn" | the first camera is held by the case (not by a clock): the second is open and both were asked while the first has no answer; `STARTED` waits and names both in plan order |
| the element is at least 128 bits, in the grammar, differs between the two tracks | unit block 1; db case "each camera adapter is asked ONCE" | 16 bytes, 22 characters, the protocol's pattern and plan schema accept the address; 2,000 calls give 2,000 elements, every byte position varies; the two tracks of one real start differ |
| static test: built in one function, reaches the plan frame and the start message only | unit block 3, four cases | one source composes a loopback RTSP address, at one line; the function has one call; the sources that name `ingestUrl` are a closed list of 7; in the session file the address, the plan and the target stand at fixed lines and in no line that logs, tells, audits, queries or writes a file |
| the development helper's argument changed or named | unit case "THE EXCEPTION" | named, not changed: `camera-helper-args.ts` puts the address last in its list; only `adapters/local/*` and `fence/generated-sources.ts` reach it; both adapters are made once, inside the function that builds the registry of `REAL_DEVELOPMENT` |

Beyond the cell: the address is in none of the log, the audit table, three session tables, the events and the facts file of a recording session, with a control that finds it in the `START` frame; the bound in `REAL_PRODUCTION` (given up, own signal, session and other camera go on, late source closed, one open per camera); a unit submitted inside `openSource` is served, and the same call inside the unit of the start is refused `PIPELINE_REENTRANT`.

## 5. Doubles, and what stays unproven

- Doubles: the fake worker process of the rig, the fake camera and microphone adapters behind a wrapper that records what an adapter was asked and scripts its answer. "Production" in the bound case is the port `operationOf` answering `REAL_PRODUCTION` over the same fake adapters.
- Unproven here: that an adapter of production hands the address to its relay in the start message and nowhere else (row 46; the door's half is row 21's proof); that the relay announces the byte-identical string and the worker's gate accepts it (rows 41, 59, 142); the search in eight places and the count of reveal entries (row 151); the 30 s window and the 25 s bound against a real camera (`9A/H-21`, `9A/H-22`); 20 s on a clock (row 90).
- The error log file was not searched (one file for every rig of the run); row 151 has it.
- AD-02 and AD-03 are not this row's: the stored address is held to the destination rule by the reader and the adapter (rows 144, 46); the session holds no camera address and no credential.

## 6. Requests left (`delegation_progress/file_requests.md`, 8 lines)

1. `capture/fence/__tests__/development-session.db.test.ts:277-280, :295, :298`: three pins of the old address, with the exact replacement. Blocking for the commit's database suite.
2. `capture/index.ts:167` passes whether the operation is production; `:64` exports the two new names. Blocking for row 90 and the lift.
3. Row 179: the function is in the session unit; two ways to reach it, a decision. Also a finding: nothing re-opens a camera after a worker restart today.
4. Row 46: what the session hands an adapter; its file joins the closed list of the static test.
5. `adapters/types.ts`: `profile` not made required (20 call sites of other rows); one comment out of date.
6. `load-config.ts` (row 21's request): not taken, not this row's file.
7. The answer to row 64's line on rule A-5: closed, no rule edited.

## 7. DRIVER DECISIONS (for the controller to confirm)

1. **The one function lives in the session file**, not in `worker-arguments.ts` (request 3).
2. **The address keeps `<session>/<track>` before the element**, so prefix readers and the scan's needle hold; "in place of today's predictable path" (addendum 5.3) is read as "no longer predictable".
3. **The secret is in every real operation**, development included, with the helper's argument named as the exception (BR-07 (4) allows either).
4. **The session's own bound applies in `REAL_PRODUCTION` only**; development keeps no bound ("development unchanged"). The adapter of row 46 has its own 25,000 ms bound; the session's is the same figure and stops the wait if an adapter does not.
5. **`begin` stops waiting for the opens when the end of the capture was asked** (decision 6 of section 3): a change for development too, in the one case of a stop during a slow open.
6. **`captureWorkerArguments` takes a boolean**, after the coordinator's message on rule A-5.
7. **`profile` stays optional** and is left out for a plan line without one.
8. **A new unit test file** for the row's static rule, since the capture static lists have another writer.
9. **The new test file was written with the Write tool** (it did not exist); every existing file was changed with the Edit tool.

---
*Generated: 2026-10-13*
