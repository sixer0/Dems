---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: tidy_pass_fy
date: 2026-10-10
agent: coder-execution
baseline: abf742f + the working tree of the fix wave (no commit, no migration; schema 6 / dbc-7)
scope: the brief's items 1-7 + items 8-10 and the sync-level alert of controller decision D189
status: complete - needs-review on the decisions of section 4
---

# 118 - Tidy pass F-Y: F-M3's request lines for the Core's capture side

Every check was run ONCE; a repeat is named with its reason. No LOCAL_DEVICE selector, no heavy-host run.

## 1. Items

| # | Item | Red first? | What was done | Status |
|---|---|---|---|---|
| 1a | `CaptureStopOutcome` at the stop hand-off | NOT red: F-M5 had built it reading the final shape (its cast matched). Pin added | `capture-session/index.ts` `afterStopCommitted`: the cast is gone, the type is `CaptureStopOutcome`; cause = `down.detail ?? down.code`. db `fy_stop_timeout`: a worker that ignores STOP is killed at the grace -> `INTERRUPTED`, cause `STOP_TIMEOUT`, alert reason `CAPTURE_STOP_NOT_CLEAN`, never `STOPPED` | done (already done by F-M5; typed + pinned here) |
| 1b | fake worker / stub follow the real worker | Yes (4 red) | `test/support/capture.ts`: HELLO `capture-worker/0.5.0` (held equal to `worker.h` by test), `firstDurableFragment(.., syncLevel = F_FULLFSYNC)`, `fragmentSizeBound()` (once per camera, never CLEARED), `crash(code)` (CRASH frame + exit 70), behaviour `libavformatMismatch` (CRASH instead of HELLO, `sessionId: null`), `telemetry(count, clocks)`. `capture-stub-worker.mjs`: the same word, `syncLevel` on `--durable`, `--size-bound`, `--crash=<code>`, `--lavf-mismatch` - each driven as a real process. F-M3 had done the HELLO release word (`0.0.0`) and `timelineEndOnStop` | done |
| 1c | supervisor refusals reach the operator by name | Yes (2 red: the fault was raised with no reason) | `capture/forwarder.ts`: a FINAL `workerDown` `PROTOCOL_VIOLATION` whose detail is `TELEMETRY_SUBJECT_UNKNOWN` or `SWITCH_NOT_COMMANDED` (`SUPERVISOR_REFUSAL_REASONS`) makes the supervisor's own `CAPTURE_FAULT` carry `reason: <that code>` (no `evidenceFiles`: such a session may hold media). Two sentences + CRITICAL in the shared wording source. The session cause was already the detail (`captureEnded`); db: `INTERRUPTED` cause, alert `params.reason`, the sentence, `FAULT_RAISED.details.reason` | done |
| 2 | `--max-fragment-bytes` on every start path | NOT red (F-M3 built it): a pin | ONE launcher, built once in `capture/index.ts` from `CAPTURE_WORKER_PROCESS_SETTINGS`; restart option C goes through the same `launch()`; RECOVERY starts no worker. `tidy-fy.test.ts`: a real program writes down the arguments of EVERY launch - first start, the relaunch after a SIGKILL, the start after a Core restart on the same data directory: three identical lines holding `--max-fragment-bytes <SEALING_MAX_FRAGMENT_BYTES>` once. "Impossible without": the argument list of ANY settings holds it (left out -> the package default, the same number; out of range -> RangeError), one `createProcessLauncher(` in `index.ts`, none in the supervisor | done; see decision 1 |
| 3 | `FIRST_DURABLE_FRAGMENT.syncLevel` kept | Yes (unit 3 red; db cases written with the code) | `facts.ts`: per camera file `syncLevel` (`F_FULLFSYNC` / `FSYNC` / null), written when the record arrives; a file of before this pass still reads (null). No manifest field (D188). D189: a level weaker than the full sync (or none stated) raises ONE alert per session - shared notice `EVIDENCE_VOLUME_SYNC_NOT_FULL`, `SYSTEM`, target `EVIDENCE_VOLUME`, "The evidence volume does not confirm full durability; recordings may not survive a power loss." - CRITICAL in REAL_PRODUCTION, INFO in REAL_DEVELOPMENT; no fault, no audit row, the session keeps recording; resolved when the capture ends | done; decisions 2, 3 |
| 4 | field 40 from the worker's measurement + advisory | Yes (shared 4 red, unit 2 red) | Facts gain `measuredClockOffsetMs` = the FIRST `TELEMETRY.clocks[].lagMs` of the worker whose file it is, as camera minus Core (`-lagMs`, whole ms). `sealing-host/session-reader.ts`: ONE member (`measuredClockOffsetMs?`), field 40 = measured ?? adapter ?? stand-in. Above `CAMERA_CLOCK_OFFSET_ADVISORY_MS` = 500 (port `clockOffsetAdvisoryMs`): advisory notice `CAMERA_CLOCK_OFFSET` (INFO, target the camera, `params.offsetMs`), text "Camera clock differs from the Core by <n> ms; the recording keeps the camera's own timeline and records the offset."; resolved at the end of the capture. db: 1.5 s -> RECORDING, facts -1500 beside the adapter's -7, one advisory "1500 ms"; 100 ms -> kept, none; exactly 500 -> none; later readings change nothing. Vocabulary is in `packages/shared/src/sim` (`params.reason` is an open string in the API: no contract member to add) | done; decisions 4, 5 |
| 5 | ONVIF facade static pin | Red before the pass | `connectionTargetOf` + `targetOf` moved to `adapters/camera/connection-target.ts` (pure: imports the adapter errors and types only); the session imports `targetOf` from it, the barrel exports `connectionTargetOf` from it. THE RULE IS UNCHANGED; the adapter file list pin gains the file; a test holds the new file to "no client, no state" | done |
| 6 | `recording-fragments` header | - | "WHO CALLS IT" says the capture-session unit and the sealing host | done |
| 7 | F-M3's two edited cases | mutation | Both assert the NEW rule (`h.down` = `PROTOCOL_VIOLATION / TELEMETRY_SUBJECT_UNKNOWN`; `lastCrash.detail: SWITCH_NOT_COMMANDED` + the switch rejected). With both rules switched off in `supervisor.ts` exactly these 2 of 26 fail; file restored byte-exactly (sha256 `63db3572...` before and after, `cmp` clean) | confirmed |
| 8 | op 33 retry names its actor (D189) | Yes (actor `null`, twice) | `modules/sessions/routes.ts`: `retryFailedSeal(id, { actorId })`. F-X's HTTP test now asserts every `RECOVERY_STARTED` of the window: session, `reason: SEAL_RETRY`, actor = the investigator (its old "no RECOVERY_STARTED" line was overtaken by F-M7c's row) | done |
| 9 | op 41 names `REVISION_APPEND_PENDING` (D189) | reported red by the controller; not re-run red here | description in `api/evidence.ts`; OpenAPI regenerated ONCE (97 operations) | done |
| 10 | R88-19: nine untested verifier codes (D189) | additive coverage; the control is a sealed package that says none | `evidence-verify/__tests__/r88-19-codes.test.ts`: one package per code, each on its check with its class, with the WHOLE code list of that package pinned. All nine CAN occur: none removed, the verifier is unchanged | done |

The nine (item 10): `FRAGMENTS_JSON_MISSING` (file removed), `FRAGMENT_PLAINTEXT_HASH_MISMATCH` (sealed with a wrong `sha256Plain`), `STORED_BYTES_INCONSISTENT` (sealed with a wrong stored hash of one fragment; bytes and chain whole), `SIGNATURE_FILE_MISSING`, `REVISIONS_FILE_MISSING`, `CERTIFICATE_MISSING` (files removed), `CERTIFICATE_UNREADABLE` (no certificate text), `PACKAGE_UNLISTABLE` (a reader whose `list` gives up), `TRANSCRIPT_FILE_UNREADABLE` (a directory at `transcript.srt`).

## 2. Stand-ins and limits

- The worker in every test is the fake or the stub; no run with the built worker.
- REAL_PRODUCTION for the CRITICAL volume alert is reached through the port `operationOf` (the rig's registry is REAL_DEVELOPMENT: fake adapters are refused in production). The default (`registry.operation`) is exercised by the development case only.
- `PACKAGE_UNLISTABLE` is produced by a wrapped reader, not by a folder on disk.
- A notice raised by a Core that then dies stays active (no boot clear for `SYSTEM` notices; the same limit the forwarder's advisories have); a new raise for the same target then writes nothing.
- Also fixed in my test file, not mine by cause: `session-capture.db.test.ts` asked `sessionTapPath(dataDir)`; the scratch moved below the media store (D180). One argument.

## 3. Commands and results

| Check | Command | Result |
|---|---|---|
| core unit | `npx vitest run --root apps/core-server --project unit src/capture src/capture-session test/static` | 66 files, 1054 passed (the ONVIF facade pin green) |
| core unit, added after | `... src/capture/__tests__/tidy-fy.test.ts` ; `src/evidence-verify/__tests__/r88-19-codes.test.ts src/capture/__tests__/fault-wording.test.ts` | 13 ; 28 passed |
| core db (lock `.locks/db-migrate.lock`, sandbox off) | `--project db src/capture-session src/capture/fence src/capture-notices` | first run 74 passed, 1 failed (the stale tap-path argument above), 3 skipped; `src/capture-session` again after the fix: 52 passed (once more after a lint-only refactor of `release`: 52) |
| op 33 | `--project db src/modules/sessions/__tests__/recover-failed-seal.db.test.ts` | red twice (count, then actor), then 1 passed |
| shared | `npx vitest run --root packages/shared` | 104 files: 2475 passed, 1 failed (`integration-d1b` enumerates the advisory reasons: the fifth added) -> the three touched files again: 43 passed |
| OpenAPI | `/usr/bin/lockf -k .locks/npm.lock node --import tsx packages/shared/scripts/gen-openapi.ts` | written once |
| typecheck / lint | `tsc --noEmit -p` shared, core-server; `npm run -s lint -w` both | clean; clean |

## 4. Decisions for the controller

1. **Item 2: the launcher names the bound by the VERIFIER's constant** (`VERIFY_MAX_OPEN_FRAGMENT_BYTES`), not by importing `SEALING_MAX_FRAGMENT_BYTES`: the sealing unit imports the capture unit, so that import would be a cycle. `SEALING_MAX_FRAGMENT_BYTES` IS that constant (`sealing/pipeline/contract.ts:61`) and two tests hold launcher = seal. No second number exists. Left as F-M3 built it.
2. **"The session record" for the sync level is the capture facts file** (what the seal's reader reads of a session) plus F-M3's log / error-log lines. No audit row: no audit type exists for it and none was added (a contract change).
3. **The volume alert is a NOTICE (kind `SYSTEM`), not a fault**, so that a CRITICAL severity does not move the session to FAULT ("keep recording"). One per session, target `EVIDENCE_VOLUME`. A worker that states NO level is treated as "not full" (`syncLevel: NOT_STATED`).
4. **Field 40 now contains the delivery delay** (about 20 ms on the fixture): the worker's `lagMs` is arrival minus camera time and cannot be separated from a static offset without a round trip. Sign: camera minus Core, so a camera 1.5 s BEHIND reads -1500. The protocol has no record at anchoring; "at anchoring" = the first telemetry reading of that worker (a restarted worker measures again).
5. **The clock-offset alert carries a number** although R-10 AC-6 says alert text holds IDs and codes only: by the brief's sentence. A whole number of ms, never device text.
6. Not named (fixed list): the supervisor's other refusals (`WARNING_SUBJECT_UNKNOWN`, `RECORD_*`, `HELLO_EXPECTED`) still raise the capture-wide fault without a reason.
7. The i18n entry `common.captureFault.reason.CAMERA_CLOCK_OFFSET` holds `{{offsetMs}}`: a client that translates it must pass `params.offsetMs` (both clients show `alert.message` for `SYSTEM` alerts today).

## 5. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npm run -s test -w apps/core-server` | - | green apart from the baseline; the fake worker's HELLO word and `syncLevel` changed for every file that uses it |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w apps/core-server` (sandbox off) | db-migrate | watch `modules/sessions/__tests__/audio-intervals.db.test.ts`, `capture/fence/**`, `sealing-host/__tests__/e2e/seal-e2e.db.test.ts` (field 40 source), `test/acceptance/contract.test.ts` |
| `npm run -s test -w apps/core-web` ; `npx -w apps/mobile jest --maxWorkers=2` | - | a client test that enumerates `CaptureAdvisoryReason` / `CAPTURE_FAULT_SENTENCES`, or counts `SYSTEM` alerts, sees two new reasons |
| heavy (`.locks/heavy-host.lock`): capture e2e with the built worker | heavy-host | facts hold `syncLevel` and `measuredClockOffsetMs` per camera; manifest field 40 = minus the first `lagMs` |
