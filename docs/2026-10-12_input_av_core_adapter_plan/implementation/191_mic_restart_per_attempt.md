---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 191
milestone: M4 / WP-08
date: 2026-10-13
agent: coder-execution (batch 9, agent R2)
tier: T3
builds_on: test/184_mic_helpers_worker_restart.md (the rule, section 7); implementation/179 (the camera round, untouched); implementation/067 section 7 (a handle starts once)
status: complete on doubles and on the generated microphones (eight driver decisions to confirm, section 8; three requests; REAL_PRODUCTION not run, section 7)
---

# Row 191: the microphones of a session are closed, opened and started again for a later worker

Tier 3: what was built, where, and the command output that shows it. No microphone and no camera of this Mac was opened: every source is a double or a generated fixture (`lavfi`).

## 1. Result

| Measured | Before (row 184, 6 of 6 and 3 of 3) | After (this row, 4 of 4: s1, s2, s3, b1) |
|---|---|---|
| Level frames of the later worker with a level, per microphone | 0 of 246, 0 of 246 | 163 of 163, 172 of 172, 171 of 171, 172 of 172 - both microphones, 0 silent frames after the first |
| Samples the later worker received (`mic_summary`) | 0 and 0; `missing` 590,400 to 591,840 | 412,672 to 417,792 per microphone; `missing` 0 (one microphone of s3: 102) |
| Microphone helpers: before the kill / of before, 2 s later / new ones | 2 / 0 / 0 | 2 / 0 / 2, first seen 299 to 339 ms after the kill |
| The later worker's own microphone warnings | `no_mic_delivers_samples`, `MIC_DISCONNECTED` twice at 5.3 s | none |
| Audio of the recorded file | 9.54 to 9.56 s, 0 of 95 windows of 100 ms with sound (digital silence without end) | 7.49 to 7.51 s, 74 of 74 or 75 of 75 windows with sound, the first window included |
| How long no audio was captured | without end | at least 275 to 299 ms, at most 612 to 637 ms (the Core's own record, section 4; first level frame seen 624 to 669 ms after the kill) |
| The later worker acknowledged `START` | listened 279 to 296 ms after the kill | 287 to 315 ms after the kill (1-minute load 9.4 to 13.8; the back-off is 250 ms in both) |

## 2. What was built

| File | Change |
|---|---|
| `apps/core-server/src/capture/types.ts` | `CaptureAttemptIngest` gains ONE optional member, `sources?(attempt): Promise<ReadonlyMap<deviceId, input>>`: asked once per attempt after the first, after `renewed`; the worker of that attempt is started when it settled |
| `apps/core-server/src/capture/supervisor.ts` | `launch` is split: its body from "the worker is built" on is `startWorker` (unchanged text). For an attempt after the first with a `sources` member, `awaitSources` asks the session and starts the worker in the turn the promise settles, with a plan whose microphones are those of the session's first plan that the session gave an input for. A rejection, or a result that makes no plan of the protocol, starts no worker and is not tried again (report `CAPTURE_SOURCES_NOT_READY`, detail `RECEIVER_FAILED` or `PLAN_INVALID`). Before it starts a worker it reads again that the session is the same, not stopping, not durable, without a worker, in `RESTARTING` or `STARTING`. The timer, its delay and the count of restarts are not touched |
| `apps/core-server/src/capture-session/index.ts` | `microphonesAgain` (one piece of work per attempt, asked by the session at `RESTARTING` and by the supervisor before the worker): every microphone handle of the earlier attempt is closed, all before any open; each is opened again in the selector's order; each close and open is held to `ports.micStartBoundMs`. `startMicrophonesAgain` at `RECORDING` after `RESTARTING`, before `cameraRoundAgain` in the same turn. `startMicrophones` drops the outcome of a start of a superseded attempt (one log line `CAPTURE_MIC_REPORT_SUPERSEDED`, counted). `STARTED` waits for the starts of the worker in force. `sayAudioGap` writes the gap (section 4) |

The contract of the adapter layer is used as it is (`close()`, `open()`, `start?(signal)`); no adapter file was changed and no kind is named. A handle still starts once. The camera path of row 179 is not touched: one line was added before `cameraRoundAgain`, none inside it.

**Why the restart's timing guarantees hold.** The session begins the close-and-open when it hears `RESTARTING` (the supervisor's own event, handed out in the step that armed the back-off), so the work runs inside the back-off. The supervisor asks at the timer: a promise that is settled costs one turn. Pinned by the new case "SOURCES READY INSIDE THE BACK-OFF": for three restarts in a row no worker exists one millisecond before `backoffDelayMs` and one exists in the turn of the timer. With the generated microphones the close and open took less than the 250 ms (new helpers seen 12 to 24 ms after the acknowledgement). A session that needs longer (production: two card listings and a configuration write per microphone, one after the other) delays the later worker by that much and no more.

## 3. The order, as the doubles saw it

`session-capture.db.test.ts`, case "REAL_PRODUCTION, sources ready INSIDE the back-off" (`#n` = the n-th open of that microphone, `wN` = workers started so far):

```
phase RESTARTING
close MIC-01#1
close MIC-02#1
open MIC-01#2 w1
open MIC-02#2 w1
phase RECORDING
start MIC-01#2 w2
start MIC-02#2 w2
camera CAM-01
camera CAM-02
```

Each microphone: 2 starts (one per attempt), 2 opens, 2 closes after the shutdown - 0 handles left open. The fake audio adapter refuses an input that is still open, so the second open succeeding is itself the proof that the close came first. The plan of the later worker names both microphones.

## 4. What the session records about the gap

`CAPTURE_AUDIO_BEGINS_AFTER_RESTART` (error log, level warn), once per later worker, when its `SESSION_START` interval record arrives. Run s3:

```
attempt 2, deviceId MIC-01, role PRIMARY
audioAbsentAtLeastMs 299   (worker down -> microphones started again; the Core's clock)
audioAbsentAtMostMs  637   (worker down -> this record arrived; the Core's clock)
workerAudioFromAt    184 ms BEFORE workerDownAt   (the worker's own word)
earlierAudioNotRecordedMs 2057   intervalRowOf 1
```

| Run | at least / at most (ms) | the worker's own first-sample instant against the kill | heard by the earlier worker, not recorded (ms) |
|---|---|---|---|
| s2 | 275 / 612 | 223 ms before | 2,056 |
| s3 | 299 / 637 | 184 ms before | 2,057 |
| b1 | 293 / 629 | 195 ms before | 983 |

(s1 ran an earlier form of the entry, which computed the gap from the worker's instant and wrote 0 ms: that is why the entry now states two bounds on the Core's clock and the worker's instant only as its word. The generated helper delivers its first half second at once, and the worker counts back from the samples it holds.)

**Not mended, and said in the entry (`intervalRowOf: 1`).** The interval row of the start is INSERT-only for the runtime role. After a restart the stored row is the earlier worker's: `from_at` 1.0 to 2.1 s before the later worker's audio. The seal does not read `from_at`; `from_media_ms` was 21 in both workers of every run, so the four sealed manifests state the audio of the file correctly. A switch made before the restart would leave a `MANUAL` row that no file matches: not built, request 1. No audit row is written (no type exists): request 2. Known limits 7, 19, 33 of the README are unchanged; nothing here claims the hearing was recorded while no worker ran.

## 5. Checks

All from `apps/core-server`, `--maxWorkers=2`; database and process runs with the command sandbox off under their locks.

| Check | Result line |
|---|---|
| `npx tsc --noEmit` | no error line (run after the last edit) |
| `vitest run --project unit src/capture/__tests__ src/capture-session/__tests__` (heavy-host lock; after the last edit) | `Test Files  20 passed (20)`, `Tests  652 passed (652)` |
| of which `supervisor.test.ts` | `Tests  73 passed (73)`: 67 existing, unchanged, and 6 new |
| `vitest run --project db src/capture-session/__tests__/session-capture.db.test.ts` (db-migrate lock) | `Tests  92 passed (92)`, `0 remain`: 86 existing and 6 new |
| `vitest run --project db` on `capture-notices/__tests__/session-start.db.test.ts`, `capture/fence/__tests__/development-session.db.test.ts`, `capture/__tests__/boot.db.test.ts` | `Test Files  3 passed (3)`, `Tests  14 passed (14)`, `0 remain` |
| `sh .cache/task4-row191/run.sh settled s1`, `s2`, `s3`; `before b1` (both locks, one hold per run) | each `Tests  1 passed (1)`, `0 remain` |

Runs beyond the first, each after a failure of MY OWN NEW test: `supervisor.test.ts` three times (the double cannot speak after its exit; then it needed `exitOnKill: false`); the session file three times (run 1: 91 of 92, an expected figure of the new gap case - media time has an origin of 1,024 samples; run 3 after the entry of section 4 changed). The last session-file run and the scenario runs precede one formatting-only edit of `startWorker` (the bare block removed); the unit folder and the typecheck ran after it.

**Existing results that changed: 3 lines, all of this row's subject.** (1) `session-capture.db.test.ts`, row 179's production case asserted "no microphone was touched" (`close MIC-` empty); it now asserts close, close, open, open. (2), (3) `ingest-address.test.ts`: the two pins of the session's source line that starts the worker - the line gained the member `sources`. Nothing else changed its result.

**Seen and not mine:** at 10:50 `capture/__tests__/static.test.ts` failed 2 cases about `src/index.ts` and `src/capture/boot/host-facts.ts` (row 85, agent R1, in flight); green in the run of the table. The typecheck showed errors in `adapters/audio/__tests__/*` and `adapters/__tests__/real.test.ts` while rows 199 / 200 / 85 were writing; none at the last run.

**The kill matrix was not run** (it binds 8554 / 8556, forbidden on this host; the controller's suite). Read instead: every cell that kills during a recording kills the Core together with the worker (`sealing/__tests__/kill-matrix/cells.ts:18-22`, `rig.ts:183`), so no cell has a later worker and none reaches this code.

## 6. The scenario and the seal

`.cache/task4-row191/restart.db.test.ts` is row 184's instrument with one addition. Real: the Core in the test process, the session unit, the supervisor, the built worker (`apps/capture-worker/build/capture-worker`, built 10:14 by row 193, SHA-256 `fe6bda4e4cf4fb79...` - not the binary of row 184), the generated microphones through the development door. Stand-ins: the ingest ports 8559 / 8561 (as row 184), and THE CAMERAS OF THE LATER WORKER - the development operation opens no camera again (row 179), so the file starts the same generated-camera command lines toward the addresses the Core built for attempt 2. Without that stand-in a development restart still ends `NO_CAMERA_CONNECTED` after about 15.6 s (row 184, 6.4): unchanged by this row, now with sound in the worker meanwhile.

| Run | Kill point | Helpers of before gone (ms) | New helpers seen (ms) | Later worker acknowledged (ms) | First durable (ms) | Seal |
|---|---|---|---|---|---|---|
| s1 | after `STARTED` | 46, 46 | 339 | 315 | 2,465 | `SEALED`, six steps `DONE` at attempt 1 |
| s2 | after `STARTED` | 33, 33 | 299 | 287 | 2,467 | `SEALED`, the same |
| s3 | after `STARTED` | 42, 42 | 337 | 315 | 2,422 | `SEALED`, the same |
| b1 | inside the helpers' settle time | 43, 43 | 329 | 309 | 2,497 | `SEALED`, the same |

**The seal, as a fact for the diagnosis row: `SEALED` 4 of 4, no `WRITE_FAILED`, no retry.** These are seals of sessions that were restarted BEFORE anything was durable and then STOPPED by the operator - not the seal of an INTERRUPTED session (killed after durable), which is where row 184 saw `WRITE_FAILED` in 3 of 4. That path was not run here and nothing of it was changed.

b1 also shows rule 3: the two starts that were in flight when the worker died are `CAPTURE_MIC_REPORT_SUPERSEDED` (level info, 39 ms after the kill), and there is no `CAPTURE_MIC_NOT_STARTED` - row 184 had the primary at level error in a1-a3.

After every run: no process named by the session, no worker, `leftoverHelpers()` and `openSources()` empty, no pipe; after the last, no listener on 8559-8564; `node scripts/secret-scan/count-only.mjs .cache/task4-row191` -> `TOTAL: 0 in 0 file(s)`; no ingest element in any result file.

## 7. Not proven

| What | Why | Where it closes |
|---|---|---|
| `REAL_PRODUCTION` with the production microphone adapter | no Linux, no sound card; the session reaches it through the same three calls the doubles answer, and row 67's own tests hold `close()` -> `open()` -> `start()` for that adapter | `9A/H-08` (what an ALSA input does when its reader goes), `9A/H-07` |
| How long a production close-and-open takes against the 250 ms | not measurable here | the same checks; the worker waits, however long (bounded at 8 s per close and per open) |
| A durable record that arrives WHILE the supervisor waits for the sources | the worker double says nothing after its exit; the guard is read, not driven | - |
| A session with the PCM tap across a restart (`TAP_PATH_OCCUPIED`, row 184 finding 9) | not this row | open |
| The loss watch of the production adapter for a helper of a superseded attempt | not wired yet (row 85); it knows no attempt | request 3 |

## 8. Driver decisions (for the controller)

1. **The supervisor waits; the adapter contract is not changed.** Of the two ways row 184 left open, the optional `sources` member was taken. "A handle starts once" (row 67) stands.
2. **Every operation, microphones only.** Development sources get the same close, open, start; development cameras are still not opened again (row 179's decision).
3. **A PRIMARY that cannot be opened again ends the capture** (error; no later worker; a failed start), as the plan builder refuses a first start without it. A STANDBY that cannot: a warning, and the later worker's plan has one microphone. The same when the microphone of the ACTIVE role is missing after a switch: no plan, the capture ends; nothing is switched by the Core (OD-11).
4. **Closes and opens run one after the other**, each held to `ports.micStartBoundMs` (8 s): an open may list cards and write a configuration. Worst case before the capture ends or goes on: four bounds.
5. **The supervisor sets no bound of its own** on `sources`; the session's promise always settles. A stop during the wait works as during a back-off.
6. **The gap is in the error log, as two bounds on the Core's clock**, not in an audit row and not in the interval row (requests 1, 2).
7. **A dropped outcome of a superseded start is a log line** (info, with the running count), not an error-log entry.
8. **The scenario's camera stand-in** (section 6), and its three kill-free assertions (two new helpers, both microphones heard, nothing left).

## 9. Requests (`delegation_progress/file_requests.md`, none blocking)

1. The schema's owner: let the runtime role replace the interval rows of a session that holds nothing durable.
2. The audit vocabulary's owner: an audit type for a restart that cost audio, if it is to be in the audit extract.
3. Row 85 and the owner of `mic-loss.ts`: the watch should not raise for a helper of a superseded attempt.

## 10. Rules kept

Edit tool only for every existing file (six product and test files, two shared documents); new files with Write. Nothing committed, staged or reverted. No full suite. Heavy-host lock for every run that starts a worker or a helper, db-migrate lock for every database run, one hold per run; throw-away databases only (`0 remain` each time); worker listeners 127.0.0.1:8559 / 8561 only; no lane port, no lane database; nothing under `apps/capture-worker` built or written; no `.env` read; no real device contacted.

---
*Generated: 2026-10-13*
