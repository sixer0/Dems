---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 182
work_package: WP-11b (branch B), follow-up of rows 175 and 176 (decision C30 (3))
date: 2026-10-13
agent: coder-execution
tier: T3
requirement: BR-04 (2) and (3) of verification/05_security_branch_b.md (the frame half); feeds BR-09; ruling C35
status: needs-review (everything is built and green; three driver decisions of section 6 need the controller's word)
---

# Row 182: three frame members for the gate's two refusals and the missing picture

## 1. What was built

Until this row the worker told the three causes apart in its LOG only; the frame the Core reads said `CAMERA_NOT_CONNECTED` for all three. Now the frame says which it was.

| Frame member (`WARNING`, code `CAPTURE_FAULT`, subject = the camera's device ID) | Worker-log code (unchanged) | When |
|---|---|---|
| `CAMERA_ANNOUNCE_NOT_MATCHED` | `INGEST_ANNOUNCE_NOT_MATCHED` | the announced address differed, was repeated, or another control address was adopted |
| `CAMERA_ANNOUNCE_NOT_SEEN` | `INGEST_ANNOUNCE_NOT_SEEN` | the open returned and no announce line was seen |
| `CAMERA_NO_PICTURE` | `INGEST_NO_PICTURE_SIZE` | the push passed the gate, completed its handshake and brought no picture |

Every other end of an ingest keeps its member (`INGEST_OPEN_FAILED`, `INGEST_OPEN_STUCK`, `INGEST_OPEN_REFUSED`, `INGEST_STREAM_INFO_FAILED`, `INGEST_NO_VIDEO`, `INGEST_NO_EXTRADATA` -> `CAMERA_NOT_CONNECTED`).

| File | Change |
|---|---|
| `packages/capture-protocol/src/index.ts` | three members of `CaptureWarningReason` (`:241-243`) and of `WARNING_REASONS_OF.CAPTURE_FAULT` (`:257-259`); the comment table (`:207-213`); "a reason is a fixed word" (`:233-236`); the header note "also added inside version 4" (`:138-143`). `CAPTURE_PROTOCOL_VERSION` is 4, unchanged |
| `packages/capture-protocol/test/protocol.test.ts` | the case of the warning frame (`:240-257`): each member decodes under `CAPTURE_FAULT` with a camera, not under `MIC_SILENT`, not with a null subject; a member with a path appended and a lower-case form are no message; none is a microphone reason or an advice; the member count is 11; `CAMERA_NOT_CONNECTED` still decodes |
| `apps/capture-worker/src/ingest.c` | `ingest_over_as` (`:154-161`): the end of one camera with the frame reason its caller names; `ingest_over` (`:163-169`) keeps the mapping of every other code; `announce_refusal_reason` (`:238-240`): the frame member from the SAME verdict as the log code; the three callers (`:593`, `:606`, `:637`). No gate condition, no log code, no pin, no interrupt and no fatal path was touched |
| `apps/capture-worker/test-fixtures/row58_gate.py` | 3 lines: `frame_member_of_its_case_only` - the frames with an announce member are exactly the cameras the gate refused, each with the member of its log code |
| `apps/capture-worker/test-fixtures/row176_camera_end.py` | the expected frame: `close` = `CAMERA_NO_PICTURE`, `hold` = `CAMERA_NOT_CONNECTED` (given up first, no second frame); the control's list of camera faults holds the new member |
| `apps/capture-worker/test-fixtures/row175_log_hygiene.py` | 2 lines: `scan` searches the frames each run recorded for the same path texts and for `://`; the count is added to "path text in any worker log" |
| `apps/core-server/src/capture/types.ts` | `CAMERA_END_REASONS` +3 (each ends its camera for the session, as before under the generic word); new `CAMERA_ABSENT_REASONS`, `CAMERA_INTEGRITY_REASONS`, `isCameraAbsentReason`, `isCameraIntegrityReason` (`:239-262`); exported by `capture/index.ts` |
| `apps/core-server/src/capture/forwarder.ts` | `:417`: no fault for a reason of the absent set (was: for `CAMERA_NOT_CONNECTED` only); the two integrity members go on to the ordinary raise with their own reason. Header table |
| `apps/core-server/src/capture-session/index.ts` | `:1424-1433`, the worker-warning listener: all four reasons still reach `pairing.workerRefused`; only the absent set is told as the degraded start. One import |
| Tests of the Core | `forwarder-advisories.test.ts` (+5 cases, the rig keeps each raise whole), `fault-lifecycle.test.ts:585` (pin 3 -> 6 members), `session-capture.db.test.ts` (+5 cases: `:1194-1222`, `:1944-1962`) |

Not touched: `packages/shared` (integration I-6 added the three sentences itself; confirmed in `file_requests.md`), `worker.h`, `check.sh`, `test/static/*`, `Makefile`, `src/relay/`, `supervisor.ts`, `boot/checks.ts`, `ingest-pairing.ts`, `test/e2e.py`, `test/m3worker.py`.

## 2. Version: nothing moved, by the package's own rule

`packages/capture-protocol/src/index.ts:134-136` (ruling D179): a warning reason is ADDITIVE inside version 4 - `FRAGMENT_SIZE_BOUND_REACHED` was added that way, "a frame of the worker before it still decodes". The three members follow the same rule: protocol version 4, worker word `capture-worker/0.6.0` (`worker.h:52`, row 177) and the Core's `CAPTURE_WORKER_VERSION` are unchanged. **Pins moved: two counts, no version.** `fault-lifecycle.test.ts:585` (the end reasons, 3 -> 6) and the new count in `protocol.test.ts` (11 reasons). `protocol-pins.test.ts` needed no edit: it enumerates the package and requires each reason as a literal of the worker's sources, which is now true for all 11.

What that leaves: a 0.6.0 worker built before this row and one built after it carry the same word, and a Core built before this row ends a worker that writes a new member (`FRAME_NOT_A_MESSAGE`). Both come from one tree and one build, and `protocol-pins` holds them together; it is decision 1 of section 6.

## 3. Where each member falls under C35

| Member | Side | Why | What the Core does |
|---|---|---|---|
| `CAMERA_NO_PICTURE` | (a) a missing camera | the push announced the session's address and passed the gate: it is this session's own camera or relay, and it sent nothing | no fault (as `CAMERA_NOT_CONNECTED`); the session event `CAMERA_NOT_CONNECTED` -> the degraded start's WARNING; the supervisor keeps the cause by its own word in `cameraEnds` (facts file, manifest) |
| `CAMERA_ANNOUNCE_NOT_MATCHED` | (b) integrity | a client reached the listener without the session's address | ONE `CAPTURE_FAULT` of the camera with this reason: a critical alert and a `FAULT_RAISED` row whose `reason` is the member; not also said as "did not connect"; `pairing.workerRefused` as before |
| `CAMERA_ANNOUNCE_NOT_SEEN` | (b) integrity | no line was seen, so the worker cannot tell whose push it was (a library change refuses every push) | the same, under its own reason |

## 4. BR-04 for the frame

A reason is chosen from the worker's own judgement (`announce_gate_verdict`, the missing picture size), never from a text: `ingest_over_as` receives either `announce_refusal_reason(...)` or a string literal at each of its 4 calls. Nothing else was added to the frame. On the wire: 14 runs, 28 warning frames searched for every path text of their run (whole path, each long element) and for `://`: 0. The schema refuses a member with anything appended (`protocol.test.ts`).

## 5. Checks run (2026-10-13 05:00 to 05:11 WIB, this Mac, libavformat 63.1.102)

Worker builds and runs under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock`, sandbox off, worker ports 8559 and 8561, camera double 8565; six separate holds. Outputs in `.cache/row182/`. 1-minute load 2.6 before, 1.5 after.

| Check | Command | Result line |
|---|---|---|
| Worker: static rules, self-test, unit checks, relay unit test and fuzz | `make -C apps/capture-worker` | `make rc=0`; `check.sh: src: static rules OK`; 75 + 32 lines `refused as required`; `announce_test: all 187 checks hold`; `relay_unit_test: 376 checks passed`; `relay_fuzz: 1275072 inputs ... 0 failures` |
| Proof builds (the `unseen` case needs the rebuilt one) | `make -C apps/capture-worker proof` | rc 0 |
| Gate fixture | `row58_gate.py all` | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL`; frames: 9 runs `CAMERA_ANNOUNCE_NOT_MATCHED` on the camera under test, `unseen` `CAMERA_ANNOUNCE_NOT_SEEN` on both, `right` and `noannounce` none (`noannounce`: `CAMERA_NOT_CONNECTED`) |
| Per-camera end | `row176_camera_end.py all` | `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL`; `close` x3: one frame `CAMERA_NO_PICTURE`; `hold`: one frame `CAMERA_NOT_CONNECTED`; the two fatal runs still exit 70 |
| Repeated announce, then the scan | `row175_log_hygiene.py repeat`, `scan` | 2 of 2 PASS, frame `CAMERA_ANNOUNCE_NOT_MATCHED`; `ROW175 LOG HYGIENE: 14 run(s) scanned, 14 PASS, 0 FAIL; path text in any worker log: 0` (frames included) `; both codes seen, each in its case: yes` |
| Relay, adapter level | `row041_relay.py all` | `ROW41 RELAY: 28 run(s), 28 PASS, 0 FAIL` |
| Protocol package | `npx vitest run` | `Tests 31 passed (31)` |
| Core unit, 14 files: the four forwarder files, `fault-lifecycle`, `fault-wording`, `protocol-pins`, `muxer-safety`, capture `static`, `tidy-fy`, `supervisor`, `ingest-address`, `ingest-pairing`, `session-start` | `npx vitest run --project unit <files> --maxWorkers=2` | `Test Files 14 passed (14)`, `Tests 330 passed (330)`; after the last edit (one import) 5 of them again: `Tests 91 passed (91)` |
| Session unit on PostgreSQL | `npx vitest run --project db src/capture-session/__tests__/session-capture.db.test.ts` under `.locks/db-migrate.lock` | run 1: `2 failed | 78 passed (80)` - the two new integrity cases read the engine before the forwarder's raise had landed (a fault of the test: it now waits for it); run 2: `Tests 80 passed (80)`, 0 databases left |
| Typecheck | `tsc --noEmit` in `packages/capture-protocol` and `apps/core-server` | rc 0, rc 0 |
| Lint of the touched Core files | `npx oxlint <files>` | rc 0 |
| Leftovers | `lsof -nP -iTCP:8559-8574 -sTCP:LISTEN`; `pgrep` | 0 listeners; 0 processes |

The red run is rows 175 and 176 as recorded: the same fixtures showed `CAMERA_NOT_CONNECTED` in every one of these frames.

Doubles and what stays unproven: the clients are the FFmpeg 9.0.2 command line, a raw socket client and the test camera behind the relay, on this Mac's library; `CAMERA_ANNOUNCE_NOT_SEEN` is reached by the proof build only (no release client produces it); the Core cases use the fake worker. The e2e series was not run (rows 142 / 178 / 59); the Ubuntu library is row 141.

## 6. Driver decisions, for the controller to confirm

1. DRIVER DECISION: no version step and no worker-version rise (section 2), as the brief asked unless the package's rule required one. It does not.
2. DRIVER DECISION: `CAMERA_NO_PICTURE` raises NO capture fault. The brief asks for "each to a capture fault with a distinct cause"; a fault of the kind is CRITICAL by kind in the engine, which would turn a degraded start into a critical alert against D72(k) and C35 (a). Its distinct cause is kept in the supervisor's `cameraEnds` and the facts file; the operator reads the degraded start's existing sentence.
3. DRIVER DECISION: the integrity side is built as a critical fault of the camera, NOT as an end of the capture. A gate refusal for a camera whose relay did not report leaves the session recording with the other camera. When the relay did report, the pairing ends the capture as before and the camera's fault stands beside it: two critical notices (shown by two cases). Both points are one line in `file_requests.md`.
4. DRIVER DECISION: three files beyond the brief's list were edited because the members could not be carried through without them: `capture/types.ts` (the supervisor keeps a camera end only for a reason of `CAMERA_END_REASONS`), `capture/index.ts` (the export), `capture-session/index.ts` (its listener tested for the generic word alone, so the gate's refusals would no longer have reached the pairing: BR-08). Declared in `file_claims.md` before the edits; none had a writer in flight.
5. DRIVER DECISION: the worker says the frame reason at the call (`ingest_over_as`) instead of comparing log codes a second time, so row 175's requested rule "each `INGEST_ANNOUNCE_*` literal once" still holds.

## 7. Requests

Four lines in `delegation_progress/file_requests.md`: the answer to I-6 (sentences confirmed); one static rule for `check.sh`; the frame assertions for rows 142 / 178 / 59; the two open points of C35 (b) for the session file. None blocks another row.

---
*Generated: 2026-10-13 05:12 WIB*
*Last Updated: 2026-10-13 05:12 WIB*
