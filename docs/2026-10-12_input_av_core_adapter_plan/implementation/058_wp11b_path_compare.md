---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 58
work_package: WP-11b (branch B; condition met by C27, provisional until row 141)
date: 2026-10-13
agent: coder-execution
tier: T3
requirement: BR-01, BR-02, BR-03 (BR-04 is row 175, BR-05 row 176, BR-06 row 177, by the refined cells)
status: complete
---

# Row 58: the worker's positive-match gate on the announced address

## 1. What was built

An ingest of the capture worker now goes on to the probe, the file and `ingest_connected` only after a positive match: during its own open the library handed the log callback exactly one `ANNOUNCE` line, and that message equals, as a whole, the message the plan's address gives. Everything else ends that one camera as a fault before a byte of media is read. The plan member compared is the existing `cameras[].ingestUrl` (`Cam.url`); nothing of the protocol package or the Core was changed and nothing is missing there for the gate.

| File | Change |
|---|---|
| `apps/capture-worker/src/announce.h`, `announce.c` (new, pure) | `AnnounceGate`: the expected message, built before every open as `Parsing[<n>]: ANNOUNCE <plan address> RTSP/1.0` plus the library's newline, `<n>` computed from the expected line (`announce.c:12-25`); `announce_gate_observe` counts a message (`:53-61`); `announce_gate_passed` is true only for exactly one `ANNOUNCE` line that matched and no adopted other address (`announce.c:49-51`) |
| `apps/capture-worker/src/ingest.c` | the gate between `avformat_open_input` (`:534`) and `avformat_find_stream_info` (`:566`), at `:557`; the callback's observation with its attribution (`:181-191`); the per-camera interrupt callback (`:111-114`, argument set at `:528`); reset before the open (`:530-531`); header text |
| `apps/capture-worker/src/worker.h` | `Cam.announce`, `Cam.announce_refused`; the name `DEMS_PROOF_ANNOUNCE_UNSEEN` in the list that makes a build a PROOF build; the unit list of the header. Line 43 (`WORKER_VERSION`) untouched |
| `apps/capture-worker/Makefile` | `src/announce.c` / `.h` in `SRC` / `HDR`; one line of `unit`; one proof build `capture-worker-noannounce` |
| `apps/capture-worker/test/announce_test.c` (new) | unit check, 151 assertions |
| `apps/capture-worker/test-fixtures/row58_gate.py` (new) | the run script of section 3 (imports `e11_listener_path.py` and `test/m3worker.py` unchanged) |

Not touched: `check.sh`, `test/static/*`, `test/e2e.py`, `test/m3worker.py`, `capture_worker.c`, `ipc.c`, the Core, `packages/capture-protocol`.

## 2. The binding requirements, one by one

| Id | State | Where, and how it is held |
|---|---|---|
| BR-01 gate position, unconditional | **done** | `ingest.c:557`: `if (!announce_gate_passed(&c->announce))` closes the input and calls `ingest_over` (a fault of that camera). It stands after the failed-open test (`:551`) and before `avformat_find_stream_info` (`:566`), `open_output` (`:573`) and `ingest_connected` (`:583`). No preprocessor line, argument, environment read or plan member stands around it (section 4). The interrupt callback only ends an open earlier: in the proof run of section 3 the open returned 0 after four `200` and the gate alone refused |
| BR-01 proof build may only force "no match" | **done** | `DEMS_PROOF_ANNOUNCE_UNSEEN` (`ingest.c:181`) removes the callback's observation, never the gate; such a build says `-PROOF` in HELLO (`worker.h` list; seen: `capture-worker/0.5.0-PROOF`) and refuses every push |
| BR-02 whole message, constant time, length checked | **done** | `announce.c:59`: `whole && have == expected_len && same_bytes(...)`; `same_bytes` (`:43-47`) reads every byte into a volatile accumulator. No prefix, substring, case-folded or decoded comparison counts FOR an open; nothing is split out of the address |
| BR-02 formatting buffer, "does not fit" | **done** | `ANNOUNCE_MESSAGE_CHARS` 4096 (`announce.h`, at least 2,048 asked); `ingest.c:183-189` formats the whole message with a copy of the argument list and hands `fits = 0` when it did not fit; such a message can only count against the open (unit check (6)) |
| BR-02 exactly one line; `Updating control URI` refuses | **done** | `lines == 1 && matches == 1 && !adopted_other`; a second line, equal or not, and the "adopted" message set the refusal (unit checks (4), (5)). The prefix tests that classify a message (`announce.c:34-40`, `:55`) can only count against an open |
| BR-03 attribution | **done** | a message counts only when `tls_opening` is this camera AND `avcl == c->in` (`ingest.c:182`); the state is the camera's own (`worker.h`), reset before each open; no shared mutable state was added to the callback |
| BR-03 per-camera interrupt | **done** | `interrupt_cb` takes the camera as its argument and reads that camera's `announce_refused`; `g_stop_ingest` is still READ there for the session stop and is written by nothing new (`grep g_stop_ingest ingest.c`: `:113` read, `:148` read, `:596` read) |
| BR-04 log hygiene, two codes | **left to row 175** | Kept here: `av_log_set_level` 0 occurrences in `src/`; nothing above level 16 is written; this row writes no address and no path (12 runs: 0 occurrences of any path text of a run in the worker's log and standard output). NOT done: one code only (`INGEST_ANNOUNCE_NOT_MATCHED`); a bare path in a level-16 library message is still not withheld by content |
| BR-05 per-camera end | **left to row 176** | `OUTPUT_SETUP_FAILED` is still `fatal` |
| BR-06 pins, version | **pins unchanged; version left to row 177** | `git diff` of `ingest.c` touches none of `_Static_assert`, `DEMS_VERIFIED_LAVF_VERSION_INT`, `RUNTIME_LAVF_VERSION_INT`; `check.sh` and `test/static/libavformat.pin` have no diff. `WORKER_VERSION` is still `capture-worker/0.5.0` |

The probe's `refuse` mode was not copied: there is no path by which a missing line accepts. A build that only refused on a seen mismatch would fail the proof run and unit check (1) "LINE ABSENT".

## 3. Checks run (2026-10-13, this Mac, libavformat 63.1.102)

Every build and run under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock` from the repository root, command sandbox off, ports 8559 and 8561 on loopback. One run per case (rule 7); the one case that failed was run a second time after its criterion was corrected (decision 7).

| Check | Command | Result line |
|---|---|---|
| Static rules, self-test, unit checks, build (= `npm run test:capture-worker`) | `make -C apps/capture-worker` | `make rc=0`; `check.sh: src: static rules OK (...)`; 75 lines `refused as required`; `announce_test: all 151 checks hold (...)`; `start_checks: all checks hold`; output `.cache/row58-gate/make_1.out` |
| Proof builds | `make -C apps/capture-worker proof` | rc 0 (ten builds, `capture-worker-noannounce` among them) |
| The gate on the real worker | `M3_PORTS=8559,8561 python3 apps/capture-worker/test-fixtures/row58_gate.py right / near / foreign / noannounce / unseen` | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` (`.cache/row58-gate/summary.txt`) |
| Core tests that read the worker's sources | `npx vitest run --project unit src/capture/__tests__/protocol-pins.test.ts src/capture/__tests__/muxer-safety.test.ts --maxWorkers=2` | `Test Files 2 passed (2)`, `Tests 15 passed (15)` |

The twelve runs (ic = `ingest_connected` lines for the port; the control is the other camera of the same session, pushed at the same instant to its right address):

| Run | Camera under test | Statuses the client read | ic | Bytes | Worker code for it | Control: ic, frames |
|---|---|---|--:|--:|---|---|
| right, both at once | right address, port 8559 | 200 200 200 200 | 1 | 374237 (75 frames) | none | 1, 75 |
| near: last character | 8559 | 200, then no answer to `ANNOUNCE` | 0 | 0 | `INGEST_ANNOUNCE_NOT_MATCHED` | 1, 75 |
| near: strict prefix | 8561 | 200, none | 0 | 0 | the same | 1, 75 |
| near: one more component | 8559 | 200, none | 0 | 0 | the same | 1, 75 |
| near: letter case | 8561 | 200, none | 0 | 0 | the same | 1, 75 |
| near: trailing slash | 8559 | 200, none | 0 | 0 | the same | 1, 75 |
| near: query string | 8561 | 200, none | 0 | 0 | the same | 1, 75 |
| near: percent-encoded character | 8559 | 200, none | 0 | 0 | the same | 1, 75 |
| foreign line on camera 1 (raw client announces camera 2's whole address on camera 1's port while camera 2 is pushed) | 8559 | 200, none | 0 | 0 | the same | 1, 75 |
| foreign line on camera 2 | 8561 | 200, none | 0 | 0 | the same | 1, 75 |
| no `ANNOUNCE` request (raw `OPTIONS`, `RECORD`) | 8559 | 200, none | 0 | 0 | `INGEST_OPEN_FAILED` (the library ended the open: level 16 `RTSP: Unexpected Command`) | 1, 75 |
| line unseen (proof build, both cameras to their right addresses) | 8559 and 8561 | 200 200 200 200 | 0 and 0 | 0 and 0 | `INGEST_ANNOUNCE_NOT_MATCHED` for both; worker exit 70 `NO_CAMERA_CONNECTED` | its control is the first run |

In all twelve: 0 occurrences of a path text in the worker's log and standard output, 0 leftover processes, 0 leftover listeners (`lsof` after the series: no row for 8559-8564). Each refused camera got one `WARNING CAPTURE_FAULT CAMERA_NOT_CONNECTED` frame; the worker ended 0 in the eleven release runs.

What the runs settle: hypothesis HB-1 holds on this library for two cameras opened at the same instant (the line arrives on the opening thread with the input context: both recorded). Before this row the same seven pushes were recorded in 18 of 21 runs (`test/006`); that is the red run.

## 4. The search for a switch that disables the comparison: 0

- Preprocessor conditionals of `ingest.c`, `announce.c`, `announce.h` (`grep -n '^#if\|^#ifdef\|^#ifndef'`): `ingest.c:63, 75, 85, 162, 181, 344, 672` and the include guard. None lies between `:534` and `:566`. `:181` (`DEMS_PROOF_ANNOUNCE_UNSEEN`) removes the observation, so that build refuses everything.
- `getenv(` in `src/`: 0. `av_log_set_level` in `src/`: 0.
- Arguments and plan: `capture_worker.c` has no diff; the argument list (`:373-389`) and the closed plan (`take_plan`: 5 members, a camera 5 members) admit no new name.
- `announce` named outside `ingest.c`, `announce.c`, `announce.h`, `worker.h`: 0 lines.

## 5. Doubles, and what stays unproven

- The client is the FFmpeg 9.0.2 command line and a raw socket client; there is no relay yet. The library is this Mac's Homebrew build. The same line on the Ubuntu 24.04 library is row 141 (BR-10), on the production host `9A/H-01`.
- The whole e2e series was not run on the changed worker (row 59, BR-11). By reading, its pushers announce the plan's own address (`test/m3worker.py:356`, `test-fixtures/fake_cam_sr.py:178`); not shown.
- Not run here (rows 142 / 178): a second `ANNOUNCE` on the wire, a raw client sending every method, both right / wrong assignments three times, the case-A client. The second line and the adopted address are covered by the unit check only.
- The gate's own "no line" branch is shown by the proof build and the unit check; the one client found that sends no `ANNOUNCE` is ended by the library before the gate.
- Unchanged residuals: any first connection still consumes the listener (a detected loss of that camera); a relay that writes the address another way, or announces twice, is refused by design.

## 6. Driver decisions, for the controller to confirm

1. DRIVER DECISION: the comparison lives in a new pure unit (`announce.c`, `announce.h`) so that `make unit` checks it without a worker; the profile named `ingest.c` only. `Makefile` and `worker.h` were edited for it (declared in `file_claims.md`).
2. DRIVER DECISION: one proof build, `capture-worker-noannounce`, as BR-01 allows ("may only force no match"); it is what shows "line absent: refused" on the real binary.
3. DRIVER DECISION: the expected message includes the library's trailing newline (`Parsing[%d]: %s` plus a newline in the linked binary): the whole message as handed over, nothing trimmed.
4. DRIVER DECISION: one worker-log code, `INGEST_ANNOUNCE_NOT_MATCHED`, with the existing frame reason; no protocol member. The two codes are row 175's.
5. DRIVER DECISION: the gate stands directly after the failed-open test, before the two fatal self-checks of the worker (unconsumed option, socket check), as `verification/05:77` places it.
6. DRIVER DECISION: what counts as "an ANNOUNCE line" for the count is wider than the library's wording (`Parsing[...]: ANNOUNCE` with anything after it); it can only refuse.
7. DRIVER DECISION: the criterion of the no-`ANNOUNCE` run was changed after its first run from "refused by the gate's code" to "refused by the gate or by the library", because the library itself fails that open; the first result is kept in `.cache/row58-gate/run_noannounce.out`.
8. The unit check has no negative-control build: a switch that weakens the comparison would itself be forbidden in `src/`. It asserts both directions instead (the right message must pass; every other case must not).

## 7. Requests

Three lines in `delegation_progress/file_requests.md`: a static rule for the gate in `check.sh` (not this row's file; blocking no); what rows 175, 176, 177, 142, 178, 59 take over; what rows 47 / 179 must hold (the byte-identical address, once).

---
*Generated: 2026-10-13 00:55 WIB*
*Last Updated: 2026-10-13 00:55 WIB*
