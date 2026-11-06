---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 178
date: 2026-10-13
agent: coder-execution (batch 8, agent W2)
tier: T3
requirement: BR-09, second half (the concurrency and leak cases; hypothesis HB-1); AD-01 (2), (7); BR-04 (2), (3) as static rules (the requests of rows 175 and 182)
status: complete on this Mac's library (libavformat 63.1.102). The whole series was NOT run (row 59); the Ubuntu library is row 141
---

# Row 178: the permanent tests row 142 left, in the worker's own series, and the remaining static rules

Paths are under `apps/capture-worker/` unless they begin with `docs/`. No source of the worker was changed (`git diff --stat -- src/*.c src/*.h`: empty).

## 1. What was built

| File | State | What |
|---|---|---|
| `test-fixtures/br09_gate.py` | changed, additive | three cases: `assign`, `method`, `case_a`; `judge` takes a list of row 58's criteria a case replaces. The existing six cases are unchanged |
| `test/e2e.py` | changed, additive | 21 named checks after row 142's block (names `br09b_...`, `neg_br09b_...`); the series is 160 checks (139 before) |
| `check.sh` | changed, additive | rule BR-04 extended (4 conditions), 3 mutations; the OK line |
| `test/static/planted.tsv` | changed, additive | 4 planted lines (BR-04) |
| `README.md` | changed, additive | one bullet |

`apps/core-server/test/static/guard-family.test.ts` was NOT touched: no new rule tag (the rules stand under the existing `BR-04`).

## 2. The checks of the series

Every check is one session with two live session-shaped addresses (128 random bits each, new per run); the other camera of the session is pushed to its right address in the same moment and is the control.

| Checks | Case | Required |
|---|---|---|
| `br09b_right_and_wrong_at_once_wrong_on_camera_1_r1..r3`, `..._camera_2_r1..r3` | the FFmpeg pusher to the right address of one camera and, started by the next call (milliseconds later), to a WRONG path of the other: its own track with another 128-bit element. Both assignments, three sessions each | the wrong camera: no `ingest_connected`, 0 bytes, no 200 to SETUP or RECORD, log code `INGEST_ANNOUNCE_NOT_MATCHED` once, frame member `CAMERA_ANNOUNCE_NOT_MATCHED` for exactly that camera; the right camera: connected once, a whole file (75 pictures) that decodes with 0 messages, no gate line; worker exit 0 |
| `br09b_wrong_path_client_method_<m>` x 11 | a raw client on a wrong path whose FIRST request is `<m>`: OPTIONS, DESCRIBE, ANNOUNCE, SETUP, PLAY, PAUSE, RECORD, TEARDOWN, GET_PARAMETER, SET_PARAMETER, REDIRECT; then the rest of a push (OPTIONS, ANNOUNCE, SETUP, RECORD without `<m>`). The camera under test alternates | 0 occurrences of either session address, path or secret element in every byte the client received (6 texts searched; the same search finds them in a text that holds one); refused - by the gate, or by the library before the gate; the other camera records; nothing of a path in the worker's log, output or frames |
| `br09b_case_a_client_on_the_right_path_camera_1`, `_2` | row 176's client (OPTIONS ANNOUNCE SETUP RECORD with parameter sets, no media, closed) on the RIGHT address | the gate passes it (200 x4, no gate code, no refusal frame); that camera ends as its own fault: log code `INGEST_NO_PICTURE_SIZE`, frame member `CAMERA_NO_PICTURE` for exactly it, 0 bytes; no `CRASH` frame, worker exit 0; THE OTHER CAMERA'S FILE IS COMPLETE (75 pictures) and decodes with 0 messages |

**Negative controls (each must FAIL on exactly the named criteria):**

| Control | What | Fails on |
|---|---|---|
| `neg_br09b_both_right_judged_as_right_and_wrong` | both cameras to their right addresses, judged as an assignment | the four refusal criteria and `the_wrong_camera_recorded_nothing_and_only_it_was_refused` |
| `neg_br09b_push_with_media_judged_as_case_a` | a push WITH media, judged as case A | `no_ingest_connected_and_0_bytes`, `that_camera_ended_as_its_own_fault_with_its_code_and_member` |

**What the method runs showed** (one run each, by hand before the series; the same in the series):

| First request | The worker's side | Bytes the client received |
|---|---|---|
| OPTIONS | the library answers 200, the wrong ANNOUNCE is refused by the gate (`INGEST_ANNOUNCE_NOT_MATCHED`) | 100 |
| ANNOUNCE | refused by the gate | 0 |
| DESCRIBE, SETUP, PLAY, PAUSE, RECORD, TEARDOWN, GET_PARAMETER, SET_PARAMETER, REDIRECT | the library ends the open before the gate (`INGEST_OPEN_FAILED`) | 0 |

So ten of eleven methods get no byte at all: "0 occurrences" is true of an empty answer there, and the row says so rather than counting it as a search that could have found something.

**HB-1** ("the listening open emits its request-line messages on the thread that called the open, with the input context"): settled for this library. If it were false, the right camera of the assignment runs would have been refused; it recorded in 6 of 6 while the other was refused in 6 of 6.

## 3. The static rules (requests of rows 175 and 182; `file_requests.md` lines of those rows)

All under the existing tag `BR-04`:

| Rule | Controls |
|---|---|
| `"INGEST_ANNOUNCE_NOT_SEEN"` and `"INGEST_ANNOUNCE_NOT_MATCHED"` are literals on exactly one line of the worker: the body of `announce_refusal_code`, in that order | planted: the literal a second time; mutation: the two swapped |
| the same for `"CAMERA_ANNOUNCE_NOT_SEEN"` / `"CAMERA_ANNOUNCE_NOT_MATCHED"` and `announce_refusal_reason` | planted (another file); mutation: swapped |
| `"CAMERA_NO_PICTURE"` is a literal on exactly one line | planted |
| `ingest_over_as(` stands on 5 lines of `ingest.c` and nowhere else: its definition and four callers, each as written (two hand over the gate's two functions, one two literals, one the closed choice of `ingest_over`): a frame reason is never built from a text | planted: a caller with a text; mutation: the literal replaced by a variable |

`sh check.sh --selftest`: 95 `refused as required` (88 before), rc 0. Row 58's own request (BR-01) was served by row 142.

## 4. Doubles, and what stays unproven

- Clients: the FFmpeg 9.0.2 command line and raw sockets on loopback; no relay in these checks (the relay against the gate: `row041_relay.py`, `row042_probe.py`, `row043_reopen.py`).
- "At the same instant" is two process starts by consecutive calls; the order is always right first, wrong second. The opposite order at millisecond distance was not made.
- This Mac's library. Which methods the library ends before the gate is a property of libavformat 63.1.102's listening reader: on Ubuntu it is row 141 (BR-10).
- The whole series (160 checks) was not run: row 59 (BR-11).

## 5. Checks run at the end of the three rows (2026-10-13 09:40 to 10:05 local; sandbox off; heavy-host lock per command)

| Check | Command (repository root) | Result |
|---|---|---|
| Whole build | `make -C apps/capture-worker` | `make rc=0` (`.cache/row178/make_final.out`): worker rules OK; 146 `refused as required` (worker 95, relay 51); `announce_test: all 187 checks hold`; `relay_unit_test: 918 checks passed ... 34 of 34 pass` plain and with sanitizers; fuzz `1431808 inputs over 8 entry point(s) in 16.0 s ... 0 failures`; `import net OK`; `guard_test: all 83 checks hold` |
| The gate checks of the series, old and new | `make -C apps/capture-worker e2e E2E_ARGS="--only 'br09' --runs 1 --tag row178 --ports 8559,8561 --no-build"` | `38 checks (33 expected PASS, 5 negative controls expected FAIL): 38 as expected, 0 unexpected`; `ports still listening after the series: none`; `AGGREGATE EXIT CODE 0` (17 of row 142, 21 new) |
| Relay, record | `row041_relay.py all` | `ROW41 RELAY: 28 run(s), 28 PASS, 0 FAIL` |
| Relay, probe | `row042_probe.py all` | `ROW42 PROBE: 21 run(s), 21 PASS, 0 FAIL; probe runs 10, requests of the Basic scheme received by the camera in them: 0` |
| Relay, bounds | `row186_bounds.py all` | `ROW186 BOUNDS (capture-relay): 23 run(s), 23 PASS, 0 FAIL` |
| Camera end | `row176_camera_end.py all` | `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL` |
| Log hygiene | `row175_log_hygiene.py repeat`, then `scan` | rc 0; `ROW175 LOG HYGIENE: 14 run(s) scanned, 14 PASS, 0 FAIL; path text in any worker log: 0; library lines above level 16: 0` |
| Rows 43 and 153 | `row043_reopen.py`, `row153_confinement.py` | `ROW43 REOPEN: 11 run(s), 11 PASS, 0 FAIL`; `ROW153 CONFINEMENT: 6 run(s), 6 PASS, 0 FAIL` |
| The Core's tests that read the worker's files | `npx vitest run --project unit --maxWorkers=2 test/static/guard-family.test.ts src/capture/adapters/camera/__tests__/onvif-relay.test.ts` (in `apps/core-server`) | `Test Files 2 passed (2)`, `Tests 32 passed (32)` |
| Leftovers | `lsof -nP -iTCP:8559-8574 -sTCP:LISTEN` | 0 rows |

**The gate fixture three times in a row** (the possible flake of row 142: 10 of 12 once, `INGEST_OPEN_STUCK`):

| Run | 1-minute load before | Result |
|---|---|---|
| 1 | 2.39 | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` |
| 2 | 2.15 | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` |
| 3 | 1.97 | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` |

36 of 36; `INGEST_OPEN_STUCK` did not occur, so there is no worker log of a stuck session to show. In this session no run of any fixture failed with that code (more than 150 worker sessions, 1-minute load 2 to 10); the logs of passing runs were not searched for it. That does not establish the cause of row 142's two failures; it stays an open observation for row 59.

## 6. Left to the named rows

| Row | What |
|---|---|
| 59 | the whole series once, with the count 160 recorded, the BR-09 cases of rows 142 and 178 in it, and the kill matrix |
| 141 | the same 38 gate checks on the worker rebuilt in the container; which methods end before the gate there |
| 44 | nothing of this row |

## 7. Driver decisions (for the controller to confirm)

1. **Three sessions per assignment** (6 checks) although the series runs its later blocks once (D122): a timing case is not judged on one run. About 45 s of the series.
2. **The wrong path of an assignment is the camera's own track with another secret**, not a near miss (those are row 142's seven).
3. **One session per method** (11 checks, about 80 s): the listener takes one connection per session, and most methods end it.
4. **A method the library ends before the gate counts as refused** (row 58's criterion "by the gate or by the library"); which of the two is recorded per run.
5. **The static rules stand under the tag BR-04**, not under a new tag: the Core's pinned tag list needs no edit.
6. **The new names carry `br09b`** so that they can be selected alone (`--only 'br09b'`) and with row 142's (`--only 'br09'`).

## 8. Requests

None blocking. One line in `delegation_progress/file_requests.md` answers the lines of rows 175 and 182 (served) and names the count for row 59.

---
*Generated: 2026-10-13*
