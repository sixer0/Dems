---
agent: senior-code-reviewer (navigator A of the pair on blueprint row 58 / M3-W2)
row: 58, parts P1 (protocol), P2 (supervisor), P5 (engine seam, config, INTERNAL actions, forwarder)
date: 2026-10-09
base: HEAD 101ce62, working tree uncommitted
status: complete
verdict: P1 ACCEPT-WITH-FINDINGS; P2 ACCEPT-WITH-FINDINGS; P5 ACCEPT-WITH-FINDINGS (4 major)
reviewed: implementation/20_m3_worker_engine.md (P1, P2, P5, decisions), delegation_progress/coder_execution_row58.md, delegation_progress/coder_execution_row58_p5_actions.md
not_reviewed: the C worker's media behaviour and every check that binds 8555-8564 or runs m3worker.py (navigator B)
---

# Row 58, navigator A: protocol, supervisor, engine seam

## 1. Verdict

| Part | Verdict | Blocker | Major | Minor |
|---|---|---|---|---|
| P1 protocol v2, RECORD class | ACCEPT-WITH-FINDINGS | 0 | 0 | 3 (A-5, A-6, A-10) |
| P2 supervisor, option C, N-1..N-4 | ACCEPT-WITH-FINDINGS | 0 | 0 | 3 (A-7, A-8, A-9) |
| P5 config, launcher, INTERNAL actions, forwarder, `store.ts` | ACCEPT-WITH-FINDINGS | 0 | 4 (A-1..A-4) | 5 (A-11..A-15) |

What holds in my own runs: M3-REC-1 on a fake and on a real process; option C in every ordering I
could construct; N-1, N-2, N-3 fixed; the driver's 7 mutations red, 7 of my 8 red; both frozen-file
pins red on one unwaived line; the two INTERNAL actions unreachable over HTTP; the `store.ts` fix
right and its test fails with the old code; every suite at the driver's numbers.

What does not hold: the camera half of "telemetry and warnings reach the engine" does not work end
to end with the IDs the worker and the fixtures use (A-1); a capture warning can be raised once and
never again (A-2); the server now has two definitions of "real capture" (A-3); the meters show
generated speech one second after a real worker dies (A-4). None is live in production today,
because nothing calls `app.capture.start`. A-1 and A-2 should be ruled on (and A-1 given one joined
test) before a row builds a plan.

## 2. Findings

| # | Sev | File:line | Evidence | Suggested fix |
|---|---|---|---|---|
| A-1 | major | `apps/core-server/src/capture/forwarder.ts:55-59`, `:78`; `packages/shared/src/sim/capture-telemetry.ts:93`, `:149-151`; `packages/capture-protocol/src/index.ts:216` | The forwarder hands `ingest[].deviceId` and the warning `subject` on unchanged. The plan's camera ID is documented as "`VIDEO-01` or `VIDEO-02`" (protocol `:216`), the fixtures use it (`test/support/capture.ts` `capturePlan`, `forwarder.test.ts:56`, `:183`) and the real worker sent `WARNING CAPTURE_FAULT` subject `VIDEO-02` (driver note 3.3). The engine actions know capture-device IDs only. Scratch on a real simulator: `NAV-IDS {"cameraSlots":["VIDEO-01=CAM-01","VIDEO-02=CAM-02"],"deviceIds":["CAM-01:CAMERA","CAM-02:CAMERA","MIC-01:MIC","MIC-02:MIC","POE-SWITCH:POE"],"sameStateAfterVideoIds":true,"fault VIDEO-01":"SimNotFoundError","fault VIDEO-02":"SimNotFoundError","fault CAM-02":"raised",...}`. So an ingest state of `VIDEO-0x` is ignored without a trace (helper decision D-2b) and a camera `CAPTURE_FAULT` is refused (`CAPTURE_WARNING_NOT_RAISED`), no alert, no audit row. The shared and db tests use `CAM-0x`, the forwarder tests use `VIDEO-0x`; no test joins the two halves. Mic IDs and roles agree. | Decide the vocabulary once: either the plan's `cameras[].deviceId` is the capture-device ID (`CAM-xx`; correct the protocol comment and `capturePlan`), or the engine resolves a track ID through `captureConfig.cameras[].trackId`. Add one test that runs worker-shaped frames through `forwardCaptureEvents` into a real simulator and sees the camera go LOST and the fault raised. |
| A-2 | major | `packages/shared/src/sim/faults.ts:254` (`isFaultActive` returns the same state); `apps/core-server/src/modules/demo/index.ts:197-204`; `apps/core-server/src/modules/capture-config/fencing.ts:38` | A capture warning is deduplicated while its fault is active, and nothing in the capture path clears it (helper D-5e). The only clear is operation 74 `clearFault`, a demo operation that `fencing.ts:38` refuses with `403 DEMO_DISABLED` in real capture. Scratch: `NAV-SEM {...,"afterWorkerWarning":{"faults":["MIC_SILENT@AUDIO-01"],"audits":2},"afterLevelBackFor5s":["MIC_SILENT@AUDIO-01"],"secondEpisode":{"faults":["MIC_SILENT@AUDIO-01"],"audits":2}}`: the level came back for 5 s, the second silence wrote no audit row and no alert. The same holds for the supervisor's `CAPTURE_FAULT` (subject null): the second failed session of a Core's life is not recorded. | Rule on D-5e before real mode: clear capture faults when the session that raised them ends (or at the next `start`), or add a "cleared" message. Until then the audit trail under-reports. Owner: this row's fix round or row 71, by ruling. |
| A-3 | major | `apps/core-server/src/config.ts:234-239`, `:312` (new `captureMode`); `apps/core-server/src/modules/capture-config/fencing.ts:55-57` (M2) | Two definitions of the mode. M2: `captureModeOf(config)` = demo flag off means `REAL_CAPTURE`, with the comment "nothing else gets to call a run real". Row 58: `DEMS_CAPTURE_MODE`. They are independent, so all four combinations boot: `real` + demo controls ON starts a worker while fault injection, scenario load and reset stay allowed; `simulated` + demo controls OFF is fenced as real capture while no worker can ever start and every level is generated. | State the relation and make the boot checks hold it (row 61, CS-22): for example `real` requires demo controls off, and demo controls off with `simulated` is refused or labelled. Record it as a decision now; one of the two functions should read the other. |
| A-4 | major | `packages/shared/src/sim/constants.ts:132-138` (`CAPTURE_LEVEL_HOLD_MS`), `packages/shared/src/sim/audio.ts:176-180` | Helper decision D-1a. One second after the last telemetry frame the meter of a recording shows the generated conversation again. Scratch, recording scenario, feed stopped: `"micAfterNull":{"dbfs":-90,"noSignal":true}` then `"micAfter1500msWithoutFeed":{"dbfs":-15.48,"peak":-14.23,"noSignal":false}`. With a dead worker in a real recording the operator sees a healthy microphone that does not exist. | In capture mode `real` a missing feed must read NO SIGNAL, never a generated level (register CS-04 names `capture: 'external'`; `grep "'external'" apps/core-server/src` finds nothing). Keep the fallback for mode `simulated` only. |
| A-5 | minor | `apps/core-server/src/capture/supervisor.ts:334-349`, `:602-613`; spec `05_capture_architecture_spec.md:438` | The record path holds nothing in the supervisor (the outbox is drained in the same turn), and waits for no listener. So the backlog of a slow consumer lives in the consumer, without a bound. Real process, 300,000 records as fast as it can write, consumer 5 ms per record: `NAV-MEM-REAL ... {"ms":2049,"received":300000,"finished":254,"backlog":299746,"rssMB":525,"heapMB":519}`, heartbeat age 2-89 ms, worker not ended. Fake, 1,000,000 records, consumer never finishes: `{"lastSeq":1000000,"ordered":true,"pendingConsumers":1000000,"queued":1,"heapGrowthMB":203}`. The spec sentence "a worker that floods costs the Core CPU, not memory" is true for levels and no longer for records. Neither the header nor the driver's note states it. | State it (header + spec B.2), and give the path a ceiling: more than N records per second, or more than N unfinished, is a `PROTOCOL_VIOLATION` (option C then ends the session `FAULTED`). A real worker writes about one record per camera per fragment. Row 59 (the first consumer) must not `await` the database inside the listener without its own bound. |
| A-6 | minor | `apps/core-server/src/capture/types.ts:124-125`; `supervisor.ts:612`, `:622`; `records.test.ts` "the first video sample is a record too" | D58-3. A new worker restarts at 1 and the `record` event carries no attempt: the test itself expects `['1 FIRST_VIDEO_SAMPLE', '1 FIRST_VIDEO_SAMPLE', '2 FIRST_DURABLE_FRAGMENT']`. The two first-sample records have different `pts` against different T0 values; a consumer can tell them apart only by also listening to `workerDown`. Fragment records cannot collide (a second worker exists only before the first of them). | Add `attempt` to the `record` event (the supervisor knows it). Erratum for spec R-2: "per worker; the fragment records of a session are one sequence". |
| A-7 | minor | `supervisor.ts:541-547` | Only `OUTPUT_EXISTS` is treated as final. Every other refused `START` is retried to the limit although the plan is the same: `NAV-REFUSE {"code":"PLAN_INVALID","calls":6,"outcome":"CAPTURE_FAULT","rejectedAfterMs":7750}`, the same for `TAP_PATH_OCCUPIED` and `MIC_INPUT_NOT_FIFO`. Consequence for option C (HYPOTHESIS for the real binary, read in code, not run): with a regular-file PCM tap the first worker creates the tap at start (`apps/capture-worker/src/audio.c:205`), so a respawn before the first fragment is refused with `TAP_PATH_OCCUPIED` (`capture_worker.c:178`) six times and the restart rule never succeeds. | A set of final refusal codes (`PLAN_INVALID`, `PLAN_UNSUPPORTED`, `OUTPUT_DIR_MISSING`, `MIC_INPUT_NOT_FIFO`, `TAP_PATH_OCCUPIED`, `SESSION_ALREADY_SERVED`) with `retryable: false`; decide what a respawn does with a file tap. |
| A-8 | minor | `supervisor.ts:511` | My mutation MH (a message of a retired worker is processed) leaves all 142 tests green: the guard `worker !== from` is not pinned. Related: a durable record still in the pipe of a worker the supervisor itself killed is discarded (`NAV-D "afterLate":{"durable":false,"phase":"RESTARTING","seq":0}`); the session is then saved by the worker's `OUTPUT_EXISTS`, not by the supervisor. | One test for the guard. Consider reading the durable flag from a retired worker's remaining lines until its exit, so that no respawn is attempted at all. |
| A-9 | minor | `apps/capture-worker/check.sh` (no rule); `apps/capture-worker/src/sink.c:81` | D58-1 rests on the worker's exclusive create and on "an existing path is never opened". `grep -n "O_EXCL\|O_TRUNC" check.sh` finds no rule; the property is held by the dynamic `fatal --mode exists/planted` checks only, which are in no `npm test`. | Static rule: every `open` of an output path carries `O_EXCL`, `O_TRUNC` appears nowhere, `fopen(..., "w")` only for the test manifest; one planted line each. |
| A-10 | minor | `supervisor.ts:606-612` | Only the sequence and the camera are checked. `NAV-DUP`: a second `FIRST_DURABLE_FRAGMENT` for the same camera and a record after `SEAL_COMPLETE` are handed on (`["record 1 FIRST_DURABLE_FRAGMENT","record 2 FIRST_DURABLE_FRAGMENT","record 3 SEAL_COMPLETE","record 4 FIRST_DURABLE_FRAGMENT"]`). | Rows 59 and 82 validate content (checkpoint index grows by 1 per camera, nothing after seal completion) or say that the consumer does. |
| A-11 | minor | `apps/core-server/src/db/store/store.ts:153-167`; `apps/core-server/src/db/mapping/rows.ts:697-701` | The upsert's SET list writes `mac`, `onvif_uuid`, `profiles`, `last_seen_at` from a row whose values are always `null` / `[]` (the engine state does not model them). After the `kind` fix the path works, so the first ingest change of a camera will overwrite what discovery stored there. Nothing writes those columns today (`grep` over `src/modules`, `src/db/seed`: seed writes null). Read in code, not run. | Remove the four columns the state does not model from the SET list before row 65 writes them, or let `diffCapture` emit an UPDATE of the changed columns only. |
| A-12 | minor | `config.ts:242-246`; `capture/index.ts:87`, `:143` | The worker path is checked for "absolute, no NUL" only: not for existence, type, execute bit, owner or group/world-writable. Mode `real` without a worker boots (info line `worker: 'not-configured'`); `DEMS_CAPTURE_WORKER` in mode `simulated` is ignored without a line; a wrong path gives `SPAWN_FAILED` six times per start. Stated by the driver as CS-22's. | Row 61: refuse the boot in `real` without a usable worker (regular file, executable, not writable by group or others, owned by the server's user); warn when a worker is configured and the mode is `simulated`. |
| A-13 | minor (HYPOTHESIS) | `forwarder.ts:60-71`, `:79-82`; `apps/core-server/src/index.ts:96` | `report` is called inside promise handlers without a guard; the supervisor wraps its own (`supervisor.ts:194-200`). If `report` threw, the rejection is unhandled and `index.ts:96` turns it into `fatal`. Today `errorLog.append` catches everything (`error-log.ts:189-203`), so it cannot happen with the production reporter. | Wrap as the supervisor does. |
| A-14 | minor (tracking) | `identification/02_structured.md:247`, `:248` | Closes list, section 9. | Section 9. |
| A-15 | minor | `capture-telemetry.ts:74-79` | Helper D-2. `ENDED` means a loss only while the simulator's session is RECORDING; a camera marked LOST at the end of a faulted recording stays `enabled = false` in `capture_devices` and nothing sets it back outside a recording. No hysteresis: each flip of an ingest state is one unit (one upsert, one revision, one state publication). | Ruling under D58-10; the status feed of row 66 is the natural writer between sessions. |

Checked and found sound: late lines of a dead worker are read before its exit (`ipc.ts:113-114`
`close`, not `exit`); no launch before the previous process exited (`supervisor.ts:399-408`,
`:616`); a record of another session ends the worker (`NAV-OTHER SESSION_MISMATCH`); a `RECORD`
without a session ID is not a frame (`envelope`, protocol `:286`); a listener that throws or rejects
loses nothing for the others (`NAV-R4 {"got":[1,2],"reports":["CAPTURE_LISTENER_FAILED" x4]}`).

## 3. P1: the record class

| Question | Answer | Evidence |
|---|---|---|
| Sequence per worker (D58-3) or per session | Per worker is right. A worker cannot know its predecessor's count. A session has a second worker only before its first fragment record, so fragment records are one sequence per session. The one overlap is `FIRST_VIDEO_SAMPLE` (A-6) | `supervisor.ts:475`, `:609`, `:622`; `NAV-C` |
| Gap, repeat, wrong first, step back | `PROTOCOL_VIOLATION / RECORD_SEQUENCE_GAP`, record not handed on, session `FAULTED` and durable | driver's 4 tests green; my mutation MB (durable set after the check) turns 1 red |
| Other session, before `START`, unknown camera | `SESSION_MISMATCH`, `RECORD_BEFORE_START`, `RECORD_SUBJECT_UNKNOWN` | `NAV-OTHER`; mutation MC red |
| Inline, never in the lossy queue | yes: `onRecord` -> `emit` -> outbox, never `emitFromWorker` | driver mutation M2: `2 failed | 140 passed` in my run |
| M3-REC-1 on a real process (mine) | 5,000 records interleaved with 100,000 telemetry and 20,000 progress frames, level listeners stuck, queue limit 8: `NAV-FLOOD-REAL {"ms":625,"delivered":5000,"inOrder":true,"maxQueue":8,"droppedTelemetry":99999,"droppedEvents":19992,"phase":"RECORDING","attempt":1,"lastCrash":null,"overflowReports":1}` | scratch worker + `createProcessLauncher` |
| Memory when records flood and the consumer is slow | unbounded in the consumer; not stated (A-5) | `NAV-MEM-REAL`, `NAV-MEM-FAKE` |
| `FIRST_VIDEO_SAMPLE` (D58-5) | sound: the manifest needs a value the file does not show, and it is no sign of durability (mutation MD red) | protocol `:114-121`, `:375-386` |

## 4. P2: option C, every ordering

Traced in `supervisor.ts:450-500`, `:530-547`, `:602-613`, `ipc.ts:113-114`,
`apps/capture-worker/src/sink.c:75-92`, `capture_worker.c:168-178`. Runs: fake worker.

| # | Ordering | Outcome | Evidence |
|---|---|---|---|
| 1 | fragment written, record read, then crash | `durable`, no respawn, `FAULTED`, one `CAPTURE_FAULT` | driver's sibling tests; `NAV-R1` |
| 2 | fragment written, record written, worker dies by itself before the Core read it | the line is read before the exit (`close`), then as 1 | `ipc.ts:113` |
| 3 | fragment written, worker killed before it wrote the record | not durable -> respawn after 250 ms with the same paths -> worker 2 finds the file -> `ACK ok=false OUTPUT_EXISTS` -> durable, not retried, `FAULTED`. The file is not opened | `NAV-C`: `"mid":{"phase":"RESTARTING","durable":false}`, `calls 2`, `lastCrash START_REFUSED/OUTPUT_EXISTS`, events `down EXITED restart=250`, `RECORDING>RESTARTING`, `down START_REFUSED/OUTPUT_EXISTS restart=null`, `warning CAPTURE_FAULT supervisor`, `RESTARTING>FAULTED` |
| 4 | supervisor kills the worker (heartbeat, violation) while its record is in the pipe | the late record is dropped (`worker !== from`), then as 3 | `NAV-D` (A-8) |
| 5 | kill in the middle of the first fragment's write | a short file exists -> as 3; the short file is kept for the box walk | `sink.c:81-85` (read) |
| 6 | a file appears between `START` and the first fragment | exclusive create fails, exit 70 -> respawn -> as 3 | `sink.c:81-82` (read); navigator B runs `fatal --mode planted` |
| 7 | crash before any fragment | no file exists (`sink.c:124`) -> respawn records normally | driver's F-7 test; but see A-7 for a file tap |

**Is there a window in which evidence is damaged or shadowed?** No, as long as the worker keeps
its two rules (`lstat` at `START`, `O_EXCL` at the first fragment). In orderings 3 to 6 the
supervisor holds `durable: false` for at least the back-off (250 ms) while bytes are on the disk,
and a second process is started; that process writes nothing and opens nothing at the output paths
before it refuses. The cost against the controller's default ("no respawn after `RECORDING`") is
one useless spawn and the phase passing through `RESTARTING`; the gain is that M3-KC-3 keeps
meaning something (a worker that dies while waiting for its cameras is replaced). The record
consumer never sees `FIRST_DURABLE_FRAGMENT` in orderings 3 to 5: row 59 and row 82 must take the
file, not the record, as the fact (the header says so).

The safety argument is "the worker is ours and keeps its rule", not "the version gate": `HELLO`
proves the number a worker says, nothing more. Conditions for accepting D58-1: A-9 (static rule),
A-7 (final refusal codes), and navigator B's re-run of `neg_kc1_option_c_removed`, `fatal --mode
exists` and `--mode planted` on the real binary.

**Re-entrancy and the rest of round 1/2.**

| Finding | My scenario now | Result |
|---|---|---|
| N-1 `stop()` from the `CAPTURE_FAULT` listener | `NAV-R1 {"phase":"IDLE","sessionId":null,"armed":[],"log":[...,"phase RECORDING>FAULTED","phase FAULTED>STOPPING","phase STOPPING>IDLE"]}`; the next start reports `IDLE>STARTING` | fixed (round 1: `FAULTED`, session null) |
| N-1 `stop()` from the `workerDown` listener | `NAV-R2 {"phase":"IDLE","sessionId":null,"armed":[],"calls":1,...}` | fixed (round 1: `RESTARTING`, timer armed) |
| `stop()` from a `record` listener | `NAV-R3`: record 2 is still delivered after `RECORDING>STOPPING`, then `IDLE` | sound |
| N-2 events of an ended session | `NAV-N2 {"queuedBefore":3,...,"droppedTelemetry":1,"droppedEvents":2,"got":["telemetry S-NAV-0001","warning S-NAV-0002 STANDBY"]}` | fixed, counted |
| N-3 invented subjects | `NAV-N3 lastCrash PROTOCOL_VIOLATION/WARNING_SUBJECT_UNKNOWN, queued 0` | fixed |
| N-4 title | `supervisor.test.ts:479` reworded | done |

**Mutations.** Driver's script (read first: it saves and restores `supervisor.ts`), my run, 142
tests in the folder:

| Mutation | Result |
|---|---|
| M1 option C term removed | `7 failed | 135 passed` (driver: 6 of 125; one test was added since) |
| M2 record through the lossy queue | `2 failed | 140 passed` |
| M3 sequence not checked | `5 failed | 137 passed` |
| M4 own events handed out mid-step | `3 failed | 139 passed` |
| M5 queue not cleared at session end | `1 failed | 141 passed` |
| M6 warning subject not checked | `8 failed | 134 passed` |
| M7 `OUTPUT_EXISTS` retried | `1 failed | 141 passed` |
| restored | SHA-256 equal (`9f8eca90...`), `142 passed` |

Mine:

| Mutation | Result |
|---|---|
| MA `recordSeq` not reset for a new worker | `1 failed | 141 passed` |
| MB `durable` set only after the sequence check | `1 failed | 141 passed` |
| MC record before `START` accepted | `1 failed | 141 passed` |
| MD `FIRST_VIDEO_SAMPLE` marks the session durable | `1 failed | 141 passed` |
| ME forwarder reports every telemetry failure | `1 failed | 141 passed` |
| MF forwarder's telemetry listener returns its promise | `1 failed | 141 passed` |
| MG launcher chosen by the worker path alone (mode ignored) | `1 failed | 141 passed` (the CONTROL) |
| MH a message of a retired worker is processed | **`142 passed`: survives** (A-8) |

## 5. P5: config, P25, launcher

- `git diff HEAD --numstat -- apps/core-server/src/config.ts` -> `45 0`; `app.ts`, `index.ts`: no
  diff. `git show HEAD:apps/core-server/src/config.ts | shasum -a 256` -> `de6f7bc9...54f9`, the
  digest the pin holds. The 45 lines are edit 7 (three `ENV_*`, the mode list, its type and
  default, the media sub-path), edit 8 (three fields), edit 9 (three inputs, two parsers), edit 10
  (three members of the frozen object) and four header lines that record the waived set (spec §I
  permits that). Nothing else. ACCEPT.
- Pins, one-line mutations, each restored (`cmp` identical, SHA-256 as before):

| Mutation | `static.test.ts` |
|---|---|
| as delivered | `23 passed` |
| one comment line added to `app.ts` | `1 failed | 22 passed` ("app.ts: every added line is a waived one") |
| one `export const` added to `config.ts` | `1 failed | 22 passed` ("config.ts: every added line is one of the capture keys") |
| a waived line changed (default mode `real`) | `1 failed | 22 passed` |
| an old line of `config.ts` changed (log level) | `1 failed | 22 passed` |

- Modes: `simulated` (default, also for an empty variable) and `real`; any other value stops the
  boot (`CAPTURE_MODE_INVALID`). The process launcher exists only for `real` AND a worker path
  (`capture/index.ts:87`; mutation MG red). A production boot ends on `unconfiguredLauncher`
  without a refusal in three ways: variable unset, `real` without a worker, worker set with
  `simulated`. The only sign is one info line. The path is not checked beyond "absolute" (A-12).
  And the mode has a second, independent definition (A-3).
- Argv and environment: `--log <dataDir>/capture-worker.jsonl --heartbeat-ms 500`, fixed at
  creation; `env: { ...options.env }` with no option passed, so empty (`ipc.ts:56-58`); the
  driver's test "which launcher" asserts both and is in the 142. No secret, no session, no plan.

## 6. P5: the INTERNAL actions and the forwarder

**Unreachable from a client.** `SIM_ACTION_OPERATIONS` gives both `operations: []`, `INTERNAL`
(`sim-actions.ts:95-96`); `engine.command` refuses any name outside the 31 hosted at run time
(`host.ts:904`, tested for both names in `commands.db.test.ts:302`, green in the db run); the live
bindings are `LOCAL` and send nothing. Scratch on `buildApp`: 78 route lines, none matches
`telemetry|warning|internal|action`; nine invented `POST`s all `404`
(`NAV-ROUTES {"suspicious":[],"ops":[],"tries":{... all 404},"total":92}`).
`gen-openapi.ts --check`: "up to date (all (committed): 92 operations ...)".

**Count pins.** Read at the listed lines: `api-domain-operations.test.ts:639` (44), `:643`
(`[31, 9, 1, 3]`), `:648`, `:650` (regex wider, still `[]`); `live-source-bindings.test.ts:203`,
`:220`; `hosted-actions.test.ts:26` (31, unchanged), `:27` (44). Each moved because the count
moved; the parity assertions (`names` = keys of a real simulator = bindings = `ARGS`) are intact.

**Cost of a frame (read in `host.ts:923-957`, measured by the driver's db test, green in my
run).** A frame that changes no stored slice: two passes over at most two ingest entries, one write
to the transient level table, no unit, no statement, no revision, no publication. A frame that
changes a camera: one unit (upsert of that row, revision, state publication); frames that arrive
while it waits replace its content, so at most one telemetry unit is queued. The meters go out at
the existing 20 Hz tick whether or not telemetry arrives. A 20 Hz stream cannot flood PostgreSQL or
the sockets; a flapping ingest can produce a unit per flip (A-15).

**The helper's choices (D58-10).**

| Choice | Recommendation |
|---|---|
| D-1 levels through the meters, never stored | ACCEPT |
| D-1a fall back to generated levels after 1 s | REJECT for mode `real` (A-4) |
| D-2 ingest -> `online` / `streamState`, `ENDED` only while RECORDING | ACCEPT provisionally; needs A-1 and the ruling of A-15 |
| D-2a `updatedAt` untouched, D-2b unknown IDs ignored | ACCEPT; D-2b is what hides A-1, so count or log an ignored ID once per session |
| D-3 `fragments` carried, not applied | ACCEPT (no slice field exists) |
| D-4 mic `online` not derived from levels | ACCEPT. Checked: 12 s of `dbfs: null` raise no fault by themselves (`NAV-SEM "faultsAfter12sOfNull":[]`) |
| D-5 warning = the fault of its kind, D-5b never a switch, D-5d no move to FAULT | ACCEPT (mutation M4 of the helper; SH-06 is row 82's) |
| D-5a no `MIC_SILENT` audit type without `sinceMs` | ACCEPT: inventing the value would be a false record. Row 71 adds `sinceMs` to the frame |
| D-5c subject resolution | needs A-1 |
| D-5e no clear path | REJECT as a final state (A-2) |
| D-6 no session ID in the inputs, D-7 telemetry raises no fault, D-8 fast path, D-9 cause | ACCEPT |

**Forwarder.** Listeners return nothing (mutation MF red); a failing engine is one report per
episode (ME red); every refused warning is reported; an engine that never answers delays nothing.
It cannot end the supervisor: `deliverOwn` and `pump` catch what a listener throws. A-13 is the one
theoretical hole. `clocks` and `progress` are not forwarded, as the driver says.

## 7. The `store.ts` fix

| Question | Answer | Evidence |
|---|---|---|
| Is `kind` immutable for `dems_app` | yes. UPDATE is granted on ten columns, `kind` is not among them; the ID prefix is tied to the kind by `capture_devices_id_check` | `0005_capture_privileges.sql:39-40`; `04_database_contract.md:229`, `:238-239`, `:660` ("10 columns") |
| Does a test fail with the old code | yes. As delivered `capture-actions.db.test.ts` `5 passed`; with `kind: row.kind,` put back `2 failed | 3 passed`, `StoreError: WRITE_FAILED: capture_devices: the server answered 42501`; restored, `cmp` identical | my run, sandbox off, under the migrate lock |
| Any other column written without a grant | no. The SET list is now exactly the ten granted columns. `capture_config` goes through `RUNTIME_UPDATABLE_COLUMNS` (`changes.ts:206-208`). Every other update names the changed columns of tables that were already written in M1 | `grep -rnE "onConflictDoUpdate\|\.update\("` over `src/db`, `src/engine` |
| Why M2 did not catch it | the grant matrix is tested by itself (`test/db/privileges.db.test.ts:94`), the change list by a unit test (`db/mapping/__tests__/changes.test.ts`), and the M2 modules write the capture tables with their own statements. No test ran `applyChanges` with a `capture_devices` row that already exists, as `dems_app`: `grep -rn "captureDevicesAsUpsert\|onConflict\|upsert"` over the store, mapping, engine and devices tests finds nothing | - |
| Residual | A-11: the same SET list blanks four columns the state does not model | `rows.ts:697-701` |

Recommendation: ACCEPT the fix; record it as a decision (a row-49/52 defect found by row 58).

## 8. Credentials (item 6)

Pattern search, counts only, no value printed (`postgres://user:pw@`, `PGPASSWORD=`, `password=`
followed by a literal):

| Place | Matches |
|---|---|
| `implementation/evidence/20_m3_worker/` (5 text files) | 0 |
| `implementation/20_m3_worker_engine.md`, both `coder_execution_row58*.md` | 0 |
| `.cache/row58/` (scripts and 18 baseline logs) | 0 |
| `.cache/m3worker/` (297 text files) | 0 |
| `.data/pg-scripts.log`, `.data/postgres.log` (both last modified 2026-10-08, before this row) | 0 |

`pg.env` is named once, in the driver's own admission (`coder_execution_row58.md:95`). Limit: this
is a search by pattern. I did not read the credential file, so I did not search for the value
itself; a bare password with no key beside it would not be found by this check.

## 9. Open items and the closes list (item 8)

- Who builds the plan and calls `start`: **no row says so.** `grep -nE
  "capture\.start|CapturePlan|capture plan" identification/02_structured.md` -> no hit; the same in
  `masterplan/02_plan.md` -> no hit. Row 65 builds adapters and fakes, row 66 the selector and its
  lock, row 71 the switch route (CS-07). The capture unit's own header says "the sessions module
  does, when it starts a real recording" (`capture/index.ts:31`). This is a blueprint gap: the row
  that makes `startRecording` / `stop` call `app.capture.start` / `stop`, builds the plan from the
  session's capture-config snapshot and decides the camera ID vocabulary (A-1) has to be named
  (row 66 or 71, or a new one; the controller classifies it).
- Closes list of row 58, as I find it:

| Item | State |
|---|---|
| NM-02 capture worker | met for ingest, encoder, meters, tap (navigator B confirms the media); **not** the "silence/disconnect detection" of the register row: the worker raises no `MIC_SILENT` (row 71) |
| NM-04 fMP4 writer, running hash, checkpoints, fsync | **not closed here.** Row 58 holds the mux flags and the fragment-granular sink only; row 59 lists NM-04 again and owns it |
| CS-02 config keys | mode, worker path, media root: met. The "model dir" of the register row is not here (the transcriber rows) |
| W1-C1 no non-existent mux option | static rule in `check.sh` (navigator B) |
| SH-18 / CS-04, telemetry part | the two actions, the engine entry points and the forwarder exist and are tested in halves; the camera half does not join (A-1); `fragments` and `clocks` go nowhere; SH-18 and CS-04 stay open until rows 66 and 82 |
| M3-KC-1 file half, M3-BC-1 | navigator B / row 61 |

## 10. Suites (item 7)

| Command | Result | Classification |
|---|---|---|
| `npm run test -w @dems/capture-protocol -- --maxWorkers=2` | `1 passed (1)`, `Tests 20 passed (20)` | as the driver |
| `npx vitest run --root apps/core-server --project unit src/capture` | `8 passed (8)`, `Tests 142 passed (142)` (4 runs) | as the driver |
| `npm run test -w @dems/shared -- --maxWorkers=2` | `75 passed (75)`, `Tests 1984 passed (1984)` | as the driver |
| `npm run test -w @dems/core-web -- --maxWorkers=2` | `117 passed (117)`, `Tests 1523 passed (1523)` | as the driver |
| `npm run test -w @dems/mobile -- --maxWorkers=2` | `Test Suites: 194 passed`, `Tests: 2020 passed, 2020 total` | as the driver |
| `npm run test -w @dems/core-server -- --maxWorkers=2` (sandbox off) | `2 failed | 172 passed (174)`, `Tests 3 failed | 4271 passed (4274)` | 3 baseline MODG: `modules/sessions/__tests__/routes.test.ts` x2, `modules/evidence/__tests__/routes.test.ts` x1. 0 of row 58. (Driver: 4270 of 4273; one test more in the tree now.) Inside the sandbox: 7 failed, the 4 extra are `stt-config/routes.test.ts`, `listen EPERM` |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- --maxWorkers=2` (once, sandbox off) | `1 failed | 128 passed (129)`, `Tests 12 failed | 1853 passed (1865)` | all 12 in `test/acceptance/contract.test.ts` (baseline set). 0 of row 58 |
| typecheck and lint, `shared`, `core-server`, `capture-protocol` | exit 0, six times | - |
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | "openapi.json is up to date (all (committed): 92 operations, 2 security schemes, version 0.3.0; offline: 26 operations ...)", exit 0 | public totals unchanged |
| `npm run db:status -w @dems/core-server -- --database dems_demo` | "schema version 2; contract revision dbc-3; this code expects 2 (dbc-3)", "OK ... the ledger matches the files" | - |

## 11. Tree state

Scratch tests (two in `apps/core-server/src/capture/__tests__`, two in `packages/shared/test`)
deleted: `git status --short | grep -c nav58a` -> `0`. Scratch worker kept outside the repository.
`git status --short` before and after: identical. SHA-256 of `supervisor.ts`, `config.ts`,
`app.ts`, `store.ts`, `forwarder.ts`, `engine/host.ts` before and after: identical; `capture/index.ts`
`cmp` identical. No process left (`pgrep -fl "flood-worker|capture-stub-worker|nav58a"` -> exit 1).
No media port bound, `m3worker.py` not run, nothing committed. One slip of mine: three scratch runs
passed the file name after a flag that swallowed it, so the whole unit project (twice core-server,
once shared) ran instead of one file; read-only, no effect on the tree.

## 12. For the controller to record

| Decision | Recommendation |
|---|---|
| D58-1 restart only while not durable | ACCEPT, in place of the "no respawn after RECORDING" default, on three conditions: A-9, A-7, and navigator B's real-binary controls. Correct the spec sentence: what closes the gap is the worker's check of the disk, not the version |
| D58-2 file created at its first fragment, exclusively | ACCEPT |
| D58-3 protocol 2, sequence per worker | ACCEPT, with `attempt` on the `record` event (A-6) and an erratum to spec R-2 |
| D58-5 `FIRST_VIDEO_SAMPLE` | ACCEPT |
| D58-10 the helper's choices | ACCEPT except D-1a (A-4) and D-5e (A-2); D-2 and D-5c wait for A-1 |
| `store.ts` | ACCEPT; note A-11 for row 65 |
| New decisions needed | the camera ID vocabulary between plan and engine (A-1); how a capture fault is cleared (A-2); the relation of `DEMS_CAPTURE_MODE` to the demo flag (A-3); a ceiling or a stated rule for the record path (A-5); which row calls `app.capture.start` (section 9) |
| Fix round | recommended for A-1 (ruling + one joined test), A-4, A-6, A-7, A-8, A-9; the rest by ruling or by the owner rows named |

*Generated: 2026-10-09*

---

# Re-check of fix round 1

Date 2026-10-09. Reviewed: sections FR-1 to FR-5 of `implementation/20_m3_worker_engine.md`, "Fix
round 1" of `coder_execution_row58_p5_actions.md`, decision D72, and the code as it stands
(`supervisor.ts` SHA-256 `fac40efc5571db29...`, `forwarder.ts` `8c61e0e1e483faa7...`). Report only.
Not run: anything on the media ports, `m3worker.py`, the transcriber suite.

## RC-1. Final verdict

| Part | Verdict | Blocker | Major | New minor |
|---|---|---|---|---|
| P1 protocol | **ACCEPT-WITH-FINDINGS** | 0 | 0 | 1 (R-7) |
| P2 supervisor | **ACCEPT-WITH-FINDINGS** | 0 | 0 | 2 (R-5, R-8) |
| P5 forwarder, INTERNAL actions, config | **ACCEPT-WITH-FINDINGS** | 0 | 0 | 5 (R-1 to R-4, R-6) |

All four majors of round 1 are fixed in my own runs (A-1, A-2 for the case I reported, A-4, and
A-3 is routed to row 61 by D72(l)). A-5, A-6, A-7, A-8, A-10, A-13 are fixed. A-9 is fixed for the
four spellings it names and for nothing else (R-6). The row can close on my side; the eight
findings below are inherited as named. None is live: nothing calls `app.capture.start`, and the
real worker sends no `MIC_SILENT` and no `CLEARED`.

## RC-2. New findings

| # | Sev | File:line | Evidence | Suggested fix, owner |
|---|---|---|---|---|
| R-1 | minor (A-2, rest) | `apps/core-server/src/capture/forwarder.ts:87` (`keyOf`), `:139-143`; `packages/shared/src/sim/capture-telemetry.ts` (`clearCaptureWarningTransition`, null subject) | D58-17 is too broad, and the forwarder does not know what the engine cleared. Scratch on the joined rig: `MIC_SILENT` null, then `MIC_SILENT STANDBY`, then `CLEARED` null: `NAV-D17 {"both":["MIC_SILENT@AUDIO-01","MIC_SILENT@AUDIO-02"],"afterNullClear":[],"standbySaysAgain":[],...,"calls":["raise MIC_SILENT:null","raise MIC_SILENT:STANDBY","clear MIC_SILENT:null"]}`. The standby's fault is cleared although nothing said its silence ended, and when the standby says ACTIVE again nothing is raised: the forwarder still holds `MIC_SILENT:STANDBY` as raised. | Do not allow a null subject for `MIC_SILENT` on the wire (the worker always knows the role); then the "clear every one" rule is not needed and can go. Owner: row 71 (it writes the raiser); the protocol comment now. |
| R-2 | minor | `forwarder.ts:87`, `:131-144` | Same cause, other form: a mic named by device ID and by role is one fault in the engine and two entries in the forwarder. `NAV-ALIAS`: ACTIVE `MIC-01`, ACTIVE `PRIMARY`, CLEARED `PRIMARY`, hold, then ACTIVE `MIC-01` again: `{"afterClearByRole":[],"silentAgainByDeviceId":[],"audits":["FAULT_RAISED@AUDIO-01","FAULT_CLEARED@AUDIO-01"],"calls":["raise MIC_SILENT:MIC-01","raise MIC_SILENT:PRIMARY","clear MIC_SILENT:PRIMARY"]}`. The second silence is not recorded. | One form per device on the wire (role for a mic), stated in the protocol header; or the forwarder keys by what the engine answers. Owner: row 71. |
| R-3 | minor (A-2, rest) | `supervisor.ts:501-502` (`ownFault = ownFault ?? base`); `forwarder.ts:139-143` | Two sessions that fail in a row with no recording between them are one fault. `NAV-2FAIL {"a":"CAPTURE_FAULT","b":"CAPTURE_FAULT","calls":["raise CAPTURE_FAULT:null"],"audits":["FAULT_RAISED@null"],"warnings":["... ACTIVE supervisor null [S-NAV-A]","... ACTIVE supervisor null [S-NAV-B]"]}`. D72(h) says a later occurrence is a new fault with its own audit row; the second failed session has none. | An ACTIVE of the supervisor for another `correlationId` than the one held: clear, then raise. Owner: row 71 (session start wiring), or a short fix now. |
| R-4 | minor | `forwarder.ts:86` (the table lives in memory), `:154-160` | A capture fault that is active in the engine and was not raised by this forwarder instance (a Core restart: faults are stored, the table is not) is cleared by nobody, and its recurrence is not recorded. `NAV-STALE {"afterNewRecording":["CAPTURE_FAULT@CAM-02"],"afterSameWarningAgain":["CAPTURE_FAULT@CAM-02"],"audits":["FAULT_RAISED@CAM-02"]}`. | When a session reaches `RECORDING` (or at boot), clear every active `MIC_SILENT` / `CAPTURE_FAULT` of the engine, not only the forwarder's own table. Owner: row 71. |
| R-5 | minor | `supervisor.ts:539-551` (`onLateMessage`) | My mutations NB (the check `from.of !== current` removed: a dying worker of ANOTHER session could mark this one durable) and NC (`!from.started` removed) leave all 171 tests green. The code is right (`NAV-LATE-2`: session 2 stays `durable: false` through the old worker's late record, before and after its exit); nothing pins it. Also by design, stated here: the late path checks neither the session ID nor the camera of the record (`NAV-LATE-1`: a record for `S-OTHER` / `CAM-09` from the session's own retired worker gives `FAULTED`, `durable: true`, restart called off). That fails closed: it can cost a restart, never evidence. | Two tests (the scenario of `NAV-LATE-2`; a never-started worker). Owner: row 59 (first record consumer) or a short fix now. |
| R-6 | minor (A-9, rest) | `apps/capture-worker/check.sh:55-59` | The rule is a list of four spellings. On a scratch copy of `src/` (outside the repository), one planted line each, both controls refused (`O_TRUNC`, create without `O_EXCL`), and **11 of 11 evasions pass with "static rules OK"**: `open(p, O_WRONLY)` on an existing file (overwrite in place), `creat()`, `O_EXCL` masked out of a flags variable, a comment holding the pattern on the same line, `fopen(p,"w")` without the space, `fopen` with a variable mode, `truncate()`, `renameat()`, `avio_open(..., AVIO_FLAG_WRITE)`, `linkat()`, `unlink()`. | Turn it round: count and place EVERY call of `open(`, `openat(`, `creat(`, `fopen(`, `freopen(`, `avio_open`, `truncate(`, `ftruncate(`, `rename`, `link`, `unlink(` (so many, in these files), so that a new one of any spelling is seen. Owner: row 61 (D72(l) already routes the static rules there). The dynamic guard (`sink_kill_test.c`, navigator B) does not depend on it. |
| R-7 | minor | `packages/capture-protocol/src/index.ts:405` (`state` required), `:68` (version still 2) | `WARNING` gained a required member without a version change. A worker binary of protocol 2 built before this round passes `HELLO` and is ended at its first warning: `NAV-DECODE {"telemetry":true,"warning":true,"warningWithoutState":false}`. No such worker is deployed, so it is tolerable today; the version exists for exactly this. | Raise `CAPTURE_PROTOCOL_VERSION` to 3 with the next frame change at the latest, or now. Owner: row 59 (it adds the checkpoint emission). |
| R-8 | minor | `forwarder.ts:108` (only `levels`, `ingest`, `fragments` are handed on); `apps/capture-worker/src/capture_worker.c:184-191` | D58-15. A restarted worker that finds the tap file records without the tap and says so only as `tapActive: false` in telemetry and one line of its own log. Nothing in the Core reads `tapActive` (`grep -rn tapActive apps/core-server/src packages/shared/src` -> no hit outside tests). A session can therefore end with whole camera files and no transcript source, and nobody is told. | The consumer of the tap decides: `tapActive: false` while a tap was planned is a warning (existing channel) and a fact of the session record. Owner: row 77 (it consumes the tap), with row 71 for the session record. Until then D58-15 is safe for the evidence and silent for the transcript. |

Not findings, stated: the supervisor's `CLEARED` is redundant with the forwarder's own clear at
`RECORDING` (my mutation ND survives because both do the same thing); a raise the engine refused
is dropped from the table (mutation NE survives: no test asks for a second try of a refused raise).

## RC-3. Item by item

| Item | Result | Evidence (my runs) |
|---|---|---|
| A-1 identities | **fixed.** The joined test uses the worker's frame shapes: `audio.c:410-442` prints `levels[{role,dbfs,clipped}]`, `ingest[{deviceId,state}]`, `fragments`, `clocks`, `tapActive`; `capture_worker.c:82` prints `code`, `state`, `subject`. A line written exactly so decodes (`NAV-DECODE`). The test hands objects to the supervisor, not text; the text step is `ipc.test.ts`'s. | Mutation NA1 (forwarder hands a `VIDEO-0x` warning subject on): `3 failed | 168 passed`, one of them the joined test. NA2 (the same for ingest IDs): `4 failed | 167 passed`, three of them the joined test. |
| A-2 clearing | **fixed for the case reported**; R-1 to R-4 remain. My round-1 scenario through the real forwarder: `NAV-A2 ... "afterBack":{"faults":[],"audits":["FAULT_RAISED@AUDIO-01","FAULT_CLEARED@AUDIO-01"]},"second":{"faults":["MIC_SILENT@AUDIO-01"],"audits":[RAISED, CLEARED, RAISED],"alerts":["ALR-000030:resolved","ALR-000033:active"]}`: two raised rows, two alerts. At 500 ms the fault is still there (the hold). | driver's F1, F2, F3, M14 red in my run |
| Pins, reach, totals | 45 actions: hosted 31, server-native 9, not-available 1, internal 4. Counted from the registry by a script of mine: `{"operations":92,"GET":35,"POST":57,"other":0,"auditTypeVocabulary":63,"actions":45,"exec":{"server-native":9,"not-available":1,"hosted":31,"internal":4},"captureLike":0}`. `gen-openapi.ts --check`: up to date, 92 operations. The three capture actions have `operations: []`; `engine.command` refuses them (`commands.db.test.ts:302`, green in the db run). | - |
| A-4 no generated meter | **fixed.** Simulator with `capture: 'external'`, scenarios `recording` and `idle`: 3 s before any frame 0 frames that are not NO SIGNAL; a fed level shows (`-12/false`); 5 s after the feed went stale 0 again. | `NAV-A4 recording`, `NAV-A4 idle` |
| A-5 ceiling | **fixed, memory bounded.** Fake: 70 records at once -> 64 handed on, `RECORD_RATE_EXCEEDED`, `FAULTED`, 1 launch. Real process, 300,000 records, consumer 5 ms each: `received 64, finished 64, heapGrowthMB 3` in every sample (round 1: 300,000 received, 519 MB). | `NAV-CEIL`, `NAV-MEM-REAL`; M9 red |
| A-10 content, A-6 attempt | fixed | M11, M12, M15 red |
| A-8 late record | fixed; cannot cross sessions (R-5 for the missing pin) | `NAV-LATE-1/2/3`; M8, M13 red |
| A-7 final refusals | fixed. The seven: `OUTPUT_EXISTS`, `PLAN_INVALID`, `PLAN_UNSUPPORTED`, `OUTPUT_DIR_MISSING`, `MIC_INPUT_NOT_FIFO`, `TAP_PATH_OCCUPIED`, `SESSION_ALREADY_SERVED`: each 1 launch; control `NO_DEVICE` 6 launches. Two of them could in principle read differently on a second try: `MIC_INPUT_NOT_FIFO` (an adapter process that creates its pipe a moment after `START`) and `OUTPUT_DIR_MISSING` (a directory made late). Both are ordering faults of the plan builder, and failing at once is the right answer; row 65 / 66 must create pipes and directories before `start`. `SESSION_ALREADY_SERVED` cannot come from a fresh process at all. | `NAV-FINAL`; M10 red |
| A-9 static rule | the four spellings are held; the rule is easy to pass by another spelling (R-6) | 2 controls refused, 11 evasions accepted |
| A-13 | fixed | F4 red |
| D72(k) no camera | as ruled, at the supervisor: `NAV-NOCAM {"during":{"phase":"RECORDING","durable":false,"lastRecordSeq":0},"after":{"phase":"FAULTED","durable":false},"calls":1,"log":[...,"down EXITED/NO_CAMERA_CONNECTED restart=null","warning CAPTURE_FAULT ACTIVE supervisor null","phase RECORDING>FAULTED"]}`. See RC-4 | M16 red |

## RC-4. "RECORDING" with nothing durable (item 7)

The supervisor's `RECORDING` means "the worker accepted the plan". Until the first fragment record
the session holds nothing; with no camera that lasts the whole ingest window (15 s by default; the
launcher passes no `--listen-timeout-s`, `capture/index.ts:105`) and then ends `FAULTED`.

A distinct fact exists and is already published: `status().durable` (false in `NAV-NOCAM` during
the window) and the `record` event `FIRST_DURABLE_FRAGMENT`. What does not exist is any use of it:
the simulator's session machine has no such member (`grep -nE "durable|firstFragment"
packages/shared/src/sim/session-machine.ts packages/shared/src/sim/types.ts` finds no capture
flag), and the forwarder hands no record on.

Judged against D72(k) ("nothing claims to record"): the supervisor does not break the rule by
itself, because nothing shows its phase to anyone yet. The row that wires session start would
break it if it mapped the supervisor's `RECORDING` to the session state `RECORDING`. So this is a
requirement for **row 71**, to be written into its row text now:

1. the session is shown as recording only from the first `FIRST_DURABLE_FRAGMENT` of the session
   (one slice member, for example `capture.durable`, set from the `record` event; before it the
   clients show "starting", not a running recording clock);
2. `workerDown` with `NO_CAMERA_CONNECTED` (and every `FAULTED` with `durable: false`) ends the
   session start as failed, with no evidence item;
3. `FAULTED` with `durable: true` goes to the OD-08 interrupted seal;
4. the ingest window is a named setting passed by the launcher, not the worker's default.

No change is needed in row 58 for this; a new supervisor phase would duplicate `durable`.

## RC-5. Mutations (item 8)

Driver's script (`.cache/row58/mutate.sh`, byte-equal to the evidence copy; it saves and restores
both files), my run, 171 tests:

| M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 | M11 | M12 | M13 | M14 | M15 | M16 | F1 | F2 | F3 | F4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 | 2 | 5 | 3 | 1 | 9 | 1 | 2 | 1 | 6 | 2 | 2 | 1 | 1 | 1 | 1 | 3 | 1 | 1 | 1 |

(failed tests per mutation; restored: `171 passed`, `cmp` identical.)

Mine: NA1 `3 failed`, NA2 `4 failed` (the joined test in both); **NB, NC, ND, NE: `171 passed`,
survive** (R-5 for NB and NC; ND and NE explained under RC-2). Restored, `cmp` identical, SHA-256
of `supervisor.ts`, `forwarder.ts`, `capture/index.ts`, `capture-telemetry.ts`, `check.sh` equal
before and after.

## RC-6. Suites (item 9)

| Command | Result | Classification |
|---|---|---|
| capture-protocol | `Tests 20 passed (20)` | as the driver |
| `npx vitest run --root apps/core-server --project unit src/capture` | `9 passed (9)`, `Tests 171 passed (171)` (3 runs) | as the driver |
| shared | `75 passed (75)`, `Tests 1993 passed (1993)` | as the driver |
| core-web | `Tests 1523 passed (1523)` | as the driver |
| mobile | `Tests: 2020 passed, 2020 total` | as the driver |
| core-server unit, full, sandbox off, after the late lint fix | `3 failed | 173 passed (176)`, `Tests 4 failed | 4308 passed (4312)` | 3 baseline MODG (`modules/sessions/__tests__/routes.test.ts` x2, `modules/evidence/__tests__/routes.test.ts` x1). **1 of row 77:** `test/static/imports.test.ts` "a closed unit is imported through its index": `src/modules/transcript-chunks/index.ts:21 reaches into src/db/schema: ../../db/schema/value-sets`; that module is untracked and is the transcript persistence, not row 58. 0 of row 58 |
| full db project, once, under the migrate lock, sandbox off | `1 failed | 129 passed (130)`, `Tests 12 failed | 1878 passed (1890)` | all 12 in `test/acceptance/contract.test.ts` (baseline). The count is above the driver's 1856 because another row added db tests since |
| typecheck and lint: shared, core-server, capture-protocol | exit 0, six times | lint of core-server clean after the driver's late fix |
| `gen-openapi.ts --check` | up to date, 92 operations, exit 0 | - |
| `db:status --database dems_demo` | schema version 2, dbc-3, ledger matches | - |
| frozen files | `config.ts` 45 / 0; `app.ts`, `index.ts` no diff | unchanged since round 1 |

## RC-7. Recommendations on the new decisions

| Decision | Recommendation |
|---|---|
| D58-11 `trackId` in the plan only, frames carry device IDs | ACCEPT. The joined test holds it and fails when it is broken (NA1, NA2) |
| D58-12 `state` on `WARNING`, 2 s hold, clear at the next `RECORDING`; the real worker sends no `CLEARED` | ACCEPT for row 58. A camera cannot return inside a session (one-shot listener), so its fault ending at the next recording is right. Row 71 owns the mic conditions and inherits R-1 to R-4; raise the protocol version with the next frame change (R-7) |
| D58-13 record ceiling 64 per second, content rules, late record = durable | ACCEPT. 32 times the contract rate; memory bounded in my flood; the late rule cannot cross sessions. Pin it (R-5) |
| D58-15 restarted worker leaves the tap file alone and records without a tap | ACCEPT for the evidence side, with R-8: the loss of the transcript source must be surfaced by row 77 / 71 before a real session depends on it |
| D58-17 null-subject clear clears every `MIC_SILENT`; idle Core in mode `real` shows NO SIGNAL; ignored IDs logged once | The second and third parts: ACCEPT. The first: **too broad** (R-1); forbid the null subject for `MIC_SILENT` instead |

## RC-8. Tree state

Scratch test (one, in `apps/core-server/src/capture/__tests__`) deleted: `git status --short |
grep -c nav58a` -> `0`. The static-rule trial ran on a copy outside the repository, removed
afterwards. No process left (`pgrep` exit 1). `git status --short` differs from my snapshot at the
start only by files of other rows in flight (`apps/transcriber/**`, `THIRD_PARTY_NOTICES.md`,
`masterplan/04_database_contract.md`, `delegation_progress/data_analyst_row123.md`), none touched
by me. Nothing committed.

## RC-9. For the controller to record

1. Row 58, parts P1 / P2 / P5 after fix round 1: ACCEPT-WITH-FINDINGS, 0 blocker, 0 major.
2. Inherited: R-1, R-2, R-3, R-4 and the four points of RC-4 -> row 71; R-5 and R-7 -> row 59;
   R-6 -> row 61; R-8 -> row 77 (with row 71). A-3 and A-12 stay with row 61, A-11 with row 65.
3. D58-11, D58-12, D58-13, D58-15 accepted as above; D58-17 accepted except the null-subject clear.
4. The fourth unit failure in the tree is row 77's (`src/modules/transcript-chunks/index.ts:21`).

*Re-check appended: 2026-10-09*
