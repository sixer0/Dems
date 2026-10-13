---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 142
date: 2026-10-13
agent: coder-execution (batch 7, agent W)
tier: T3
work_package: AD-01 (condition "branch A or B": met, C27)
requirement: BR-09 (the refusal cases; the concurrency and leak cases are row 178); AD-01 (2), (7) (a permanent check of RC-1 instead of a process step); BR-01 and BR-04 (1) as static rules (the requests of rows 58 and 175); the frame members of row 182 asserted
status: complete on this Mac's library (libavformat 63.1.102). The whole series was NOT run (row 59); the Ubuntu library is row 141
---

# Row 142: the permanent test of the announce gate, in the worker's own series

Paths are under `apps/capture-worker/` unless they begin with `docs/` or `apps/core-server/`.

## 1. What was built

| File | State | What |
|---|---|---|
| `test-fixtures/br09_gate.py` | new | the checks: one worker session each, printing ONE result in the series' own form (`test/m3worker.py` `finish`: `verdict`, `criteria`, `--expect-fail --must-fail-on`). It imports `row58_gate.py` and `row175_log_hygiene.py` unchanged (their session runner, raw client, handshake, second-announce client) with its own folder and addresses |
| `test/e2e.py` | changed, additive | 17 named checks, once each, in a block before `mg1_no_media_in_git`; `add` takes the script of a check (the harness by default); the series is 139 checks (122 before) |
| `check.sh` | changed, additive | rules BR-01, BR-03, BR-04 inside `rules()` (`:108-135`), 6 mutations in the self-test (`:223-228`), the OK line |
| `test/static/planted.tsv` | changed, additive | 7 planted lines (5 BR-01, 2 BR-04) |
| `README.md` | changed, additive | one row of the table "What the series checks", one bullet |
| `apps/core-server/test/static/guard-family.test.ts` | changed, 1 line and 1 comment | the pinned list of the rule tags of `check.sh` gains `BR-01`, `BR-03`, `BR-04` (that test's header: "a new guard or rule is added here by its own row, by delta"). Outside the row's area: driver decision 5 |

No source of the worker was changed (`git diff --stat -- apps/capture-worker/src/*.c apps/capture-worker/src/*.h`: empty).

## 2. The checks of the series

Every check is ONE session with a live plan: two cameras, each with a session-shaped address `<session>/<track>/<128 random bits, URL-safe>` made new for the run. The camera under test gets the case; **the other camera of the same session is pushed to its right address at the same moment and must record** (the right-path control in the same run).

| Check of the series | Case | What is required |
|---|---|---|
| `br09_right_path_both_cameras_each_its_own_line` | both cameras to their own addresses at the same instant | both `ingest_connected`, both files with pictures, no refusal frame: each open is bound to its own line; the right path is accepted |
| `br09_near_miss_<kind>` x 7 | a push to the near miss: `last_character`, `strict_prefix`, `one_more_component`, `letter_case`, `trailing_slash`, `query_string`, `percent_encoded_character`; the camera under test alternates | refused (below) |
| `br09_foreign_line_on_camera_1`, `_2` | a raw client announces the OTHER camera's whole address on this camera's port while the other gets its own push | refused; the other records |
| `br09_announce_line_absent_refused` | the proof build `capture-worker-noannounce` (its callback sees nothing), both right-address pushes | both refused: 0 `ingest_connected`, 0 bytes, log code `INGEST_ANNOUNCE_NOT_SEEN` once each, frames `CAMERA_ANNOUNCE_NOT_SEEN` for both, worker exit 70 `NO_CAMERA_CONNECTED` |
| `br09_second_announce_same_address`, `_other_address` | a second ANNOUNCE on the wire | refused; the second ANNOUNCE gets no answer |
| `br09_wrong_path_client_reads_no_secret` | a raw client on a wrong path, OPTIONS then ANNOUNCE, every byte answered kept | refused; in the 100 bytes it received: 0 occurrences of either address, path or secret element (6 texts searched); inside the check the same search finds them in a text that holds one |

**"Refused"** is, for the camera under test: no `ingest_connected` for its port; 0 bytes in its file; no 200 to SETUP or RECORD; the log code `INGEST_ANNOUNCE_NOT_MATCHED` exactly once and 0 lines of the other code; **the frame `WARNING` with the member `CAMERA_ANNOUNCE_NOT_MATCHED` for exactly that camera and no other announce member (row 182)**; the control recorded; worker exit 0. In EVERY check: 0 occurrences of any path text of the run (each whole path, each element of 8 characters or more, the near-miss texts) and of `://` in the worker's log, its standard output and its frames; no process, no listener left.

**Negative controls (each must FAIL, on exactly the named criteria):**

| Control | What it is | Fails on |
|---|---|---|
| `neg_br09_right_path_judged_as_a_near_miss` | the near-miss check with the push sent to the RIGHT address | `no_ingest_connected_and_0_bytes`, `no_rtsp_ok_after_the_announce`, `refused_by_the_gate_code`, `refusal_frame_names_the_camera_and_its_member_only` |
| `neg_br09_line_absent_judged_on_the_release_worker` | the line-absent judgement on the release worker | `both_cameras_refused_0_bytes`, `gate_code_for_both`, `session_ended_without_a_camera`, `frames_say_no_line_was_seen_for_both_cameras` |
| `neg_br09_single_announce_judged_as_a_second` | the second-announce client with ONE announce of the right address | `no_rtsp_ok_after_the_announce`, `refused_by_the_gate_code`, `refusal_frame_names_the_camera_and_its_member_only`, `the_second_announce_got_no_answer` (the gate passes it; without media it ends as `CAMERA_NO_PICTURE`, which is no refusal of the gate) |

There is no control "the gate off": BR-01 forbids such a build. The red run of the gate itself is `docs/.../test/006_e11_listener_path.md` (18 of 21 near misses recorded before row 58).

## 3. The two static rules (requests of rows 58 and 175)

| Rule | Holds | Controls in the self-test |
|---|---|---|
| **BR-01** the gate cannot be bypassed | in the whole worker ONE `avformat_open_input(`, ONE `avformat_find_stream_info(`, ONE `av_read_frame(`, all in `ingest.c`; the line `if (!announce_gate_passed(&c->announce)) {` exactly once; order open < gate < probe < read; no preprocessor line and no jump between the open and the probe; the gate's block returns; the only `DEMS_PROOF_ANNOUNCE` name is `_UNSEEN`, around the callback's observation | planted: a second probe, a second open (another file), a second gate call, a read outside `ingest.c`, another proof switch. Mutations: the test behind a constant; the stream probed before the gate; a refusal that goes on; the proof switch renamed |
| BR-03 (one line, beside it) | `interrupt_callback.opaque = c;` once | mutation: the argument set to NULL |
| **BR-04 (1)** no `av_log_set_level` | the name is code nowhere (a call, a pointer); exactly one line `#pragma GCC poison av_log_set_level` in `worker.h` | planted: a call, a function pointer. Mutation: the poison line removed |

F-2's sentence ("the worker keys on no message text of the library") now states its one decided exception in the comment of the rule (C26: the ANNOUNCE line, a necessary condition only).

## 4. Checks run (2026-10-13, this Mac, libavformat 63.1.102; sandbox off; heavy-host lock per command)

| Check | Command (repository root) | Result |
|---|---|---|
| The new checks of the series, alone | `make -C apps/capture-worker e2e E2E_ARGS="--only 'br09' --runs 1 --tag row142 --ports 8559,8561 --no-build"` (the series takes the lock itself; everything was built by `make` and `make proof` before, so `--no-build` keeps the hold at 2 minutes) | first run: `17 checks (14 expected PASS, 3 negative controls expected FAIL): 17 as expected, 0 unexpected`; `ports still listening after the series: none`; `AGGREGATE EXIT CODE 0` (`.cache/m3worker/e2e/row142/summary.txt`) |
| The aggregate can fail | `python3 apps/capture-worker/test/e2e.py --prove-aggregate .cache/m3worker/e2e/row142` | `each of the 17 verdicts flipped in turn: 0 flips leave the aggregate at 0` |
| Static rules and self-test | `sh check.sh src`; `sh check.sh --selftest` | `static rules OK (... BR-01 ..., BR-03 ..., BR-04 ...)`; 88 lines `refused as required` (75 before), 13 of them by BR-01 / BR-03 / BR-04 (7 planted lines, 6 mutations); rc 0 |
| **Whole build, final** | `make -C apps/capture-worker` | `make rc=0` (`.cache/row142/make_final.out`): worker rules OK; 124 `refused as required` (worker 88, relay 36); unit checks; relay unit test 590 checks, plain and sanitizers; fuzz 8 entries 0 failures; `import net OK`; `guard_test: all 83 checks hold` |
| Gate fixture | `row58_gate.py all` | **first run `12 run(s), 10 PASS, 2 FAIL`** - its first two sessions (worker exit 70, `INGEST_OPEN_STUCK`; 4 pictures in each file). Second run, nothing changed: **`ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL`**. See below |
| Camera end | `row176_camera_end.py all` | `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL` |
| Log hygiene | `row175_log_hygiene.py repeat`, then `scan` | 2 of 2 PASS; `ROW175 LOG HYGIENE: 14 run(s) scanned, 14 PASS, 0 FAIL; path text in any worker log: 0; library lines above level 16: 0; ... both codes seen, each in its case: yes` (the scan after the second gate run) |
| Relay, adapter level | `row041_relay.py all` | `ROW41 RELAY: 28 run(s), 28 PASS, 0 FAIL` |
| Relay, time bounds | `row186_bounds.py all` | `ROW186 BOUNDS (capture-relay): 23 run(s), 23 PASS, 0 FAIL` |
| The Core's pin of the worker's rules | `npx vitest run --project unit --maxWorkers=2 test/static/guard-family.test.ts` (in `apps/core-server`) | red before the edit of its list (seen by row 46: line 65); after it `Test Files 1 passed (1)`, `Tests 4 passed (4)` |
| Leftovers | `lsof -nP -iTCP:8559-8574 -sTCP:LISTEN` | 0 rows |

**The two failed sessions of the first gate run.** They are the first two sessions after the final build; the build's output file was closed at 08:05 local and the gate run's at 08:28, for a run that takes 2 minutes: the host (or this session) stood still in between - the coordinator reports a network outage of this agent's run at that time. Both sessions show a recording cut short on BOTH cameras (4 and 51 pictures) and the worker's own fatal code for an open that did not return. The same binary passed the 17 series checks before and 12 of 12 after. **Not established**: that the pause is the cause; no third run was made (rule: a second run only after a failure). If row 59 sees `INGEST_OPEN_STUCK` on an idle host, it is a finding of the worker, not of this row's tests.

## 5. Doubles, and what stays unproven

- Clients: the FFmpeg 9.0.2 command line and raw socket clients on loopback; no relay in these checks (the relay against the gate: `row041_relay.py`, `row042_probe.py record`). The library is this Mac's; the same line on Ubuntu 24.04 is row 141 (BR-10), the host `9A/H-01`.
- "No line" is reached by the proof build only; a release client that never announces is ended by the library before the gate (`INGEST_OPEN_FAILED`: row 58, decision 7; `row58_gate.py noannounce`, not in the series).
- The withholding of a bare path in a level-16 library message is still unit-checked only (row 175).
- The whole series (139 checks, about 40 minutes) was not run: row 59 (BR-11).

## 6. Left to the named rows

| Row | What |
|---|---|
| 178 | right and wrong at the same instant in both assignments, repeated; a raw wrong-path client sending EVERY method (here: OPTIONS and ANNOUNCE); the case-A client on the right path (`row176_camera_end.py close`); the search of every output. `br09_gate.py` and the `gate(...)` block of `e2e.py` are where its cases go |
| 59 | the whole series once, with the count 139 recorded, and the kill matrix |
| 43 / 44 | nothing of this row |
| a later static-rule row | row 175's rule (a) and row 182's rule (the literals of the two codes and members once each; the reasons of `ingest_over_as`): asked in `file_requests.md`, not among the two this row was given |

## 7. Driver decisions (for the controller to confirm)

1. **The checks live in a new script, `test-fixtures/br09_gate.py`, not in `m3worker.py`**; `e2e.py` runs it as it runs the harness. It reuses the sessions of rows 58 and 175 by import.
2. **Once each, not twice** (17 checks, about 2 minutes), as the series does for the later blocks (decision D122).
3. **Negative controls judge a passing case as a refusal** (three of them); no build without the gate exists or may exist.
4. **The oracle check sends OPTIONS and ANNOUNCE only**; every method is row 178's, by the refined cell.
5. **`apps/core-server/test/static/guard-family.test.ts` edited** (three tags, by delta): the red was this row's doing and the file rules that the adding row moves it.
6. **BR-03 got a static line** beside the two rules asked (one count; without it the mutation "an interrupt callback without its camera" had no tag).
7. **`--no-build` for the run of the new checks**, after a full `make` and `make proof` in the same tree, to keep the lock hold short.

## 8. Requests

Two lines in `delegation_progress/file_requests.md`: the answer to row 46's red; what is left to rows 178 and 59 and the static rules not built.

---
*Generated: 2026-10-13*
