---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 177
work_package: WP-11b (branch B)
date: 2026-10-13
agent: coder-execution
tier: T3
requirement: BR-06 of verification/05_security_branch_b.md; decision C30 (5)
status: needs-review (the two pins of the row's profile are moved and verified; five pins outside it are requested and leave 17 Core test cases red until they land)
---

# Row 177: the worker version rises to 0.6.0

## 1. What was changed

| File | Change |
|---|---|
| `apps/capture-worker/src/worker.h:52` (line 46 before row 175 added its lines; 43 in the blueprint) | `#define WORKER_VERSION "capture-worker/0.5.0"` -> `"capture-worker/0.6.0"` |
| `apps/core-server/src/capture/boot/checks.ts:285` | `CAPTURE_WORKER_VERSION = 'capture-worker/0.5.0'` -> `'capture-worker/0.6.0'`. One word; no refusal, no check and no other line of the fence file changed |
| `apps/capture-worker/README.md:138` | the sentence that states the worker's word says 0.6.0 and why it rose |

One rise for the whole branch-B change set (rows 58, 175, 176), as decision C30 (5) accepted.

## 2. BR-06: the three library pins are unchanged

| Pin | Where | Evidence |
|---|---|---|
| compile-time pin | `apps/capture-worker/src/ingest.c:80-83` (`DEMS_VERIFIED_LAVF_VERSION_INT`, `_Static_assert`) | `git diff` of `ingest.c` and `capture_worker.c`: 0 changed lines that name `_Static_assert`, `LAVF_VERSION_INT`, `lavf_runtime_mismatch` or `LIBAVFORMAT_VERSION` |
| boot refusal of another libavformat | `ingest.c:90-99`, `capture_worker.c` (the `LIBAVFORMAT_VERSION_MISMATCH` block; no diff in that file) | `start_checks: all checks hold (... R63-07: another libavformat at run time -> CRASH LIBAVFORMAT_VERSION_MISMATCH instead of HELLO, exit 70, control: HELLO and exit 0)` |
| build check | `apps/capture-worker/check.sh`, `test/static/libavformat.pin` (`libavformat 63.1.102 9.0.2`) | no diff in either file; `make versions`: `63.1.102` first line |

The Core's own refusals were not touched: `CAPTURE_WORKER_VERSION_UNKNOWN` (a word that is not a release word), `CAPTURE_WORKER_VERSION_MISMATCH` (another release word), the proof-build and protocol refusals, the media-library refusal.

## 3. Checks run (2026-10-13 01:19 to 01:25 WIB, this Mac)

Builds and runs under `.locks/heavy-host.lock`; the fixture runs with the command sandbox off, ports 8559 and 8561 on loopback.

| Check | Command | Result line |
|---|---|---|
| Static rules, self-test, unit checks, build | `make -C apps/capture-worker` | `make rc=0`; static rules OK; 75 lines `refused as required`; `announce_test: all 187 checks hold`; `start_checks: all checks hold` (`.cache/row177-version/make_1.out`) |
| Proof builds | `make -C apps/capture-worker proof` | rc 0 |
| The word the built worker says | `build/capture-worker --log <file> --heartbeat-ms 1000 < /dev/null` | `{"v":4,"type":"HELLO","protocolVersion":4,"workerVersion":"capture-worker/0.6.0"}`; its log: `"message":"worker_starting","version":"capture-worker/0.6.0","protocol":4,...,"proof_build":false` |
| A proof build | `build/capture-worker-noannounce ...` | `"workerVersion":"capture-worker/0.6.0-PROOF"` |
| Row 58's gate on the 0.6.0 worker | `M3_PORTS=8559,8561 python3 apps/capture-worker/test-fixtures/row58_gate.py all` | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` |
| Row 176's fixture on the 0.6.0 worker | `... row176_camera_end.py all` | `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL` |
| Row 175's scan over those runs | `python3 apps/capture-worker/test-fixtures/row175_log_hygiene.py scan` | `ROW175 LOG HYGIENE: 14 run(s) scanned, 14 PASS, 0 FAIL; path text in any worker log: 0; ...; both codes seen, each in its case: yes` |
| Core tests that pin the word | `npx vitest run --project unit` of `protocol-pins`, `muxer-safety`, `fault-lifecycle`, `tidy-fy`, `boot`, `checks`, `supervisor`, `ipc`, `system/routes` (`--maxWorkers=2`, one run) | `Test Files 5 failed | 4 passed (9)`, `Tests 17 failed | 305 passed (322)` (`.cache/row177-version/core_pins_1.out`). **Expected red, by the brief: every failure is one of the five pins of section 4** |
| Core typecheck | `npm run typecheck` in `apps/core-server` | rc 0 |
| Leftovers | `lsof -nP -iTCP:8559-8564 -sTCP:LISTEN`; `pgrep` | 0 rows; 0 processes |

What is green in that Core run and belongs to the row's verification cell: the header equality (`fault-lifecycle.test.ts:396`: the word of `worker.h` equals `CAPTURE_WORKER_VERSION`), `protocol-pins` (the word is a release word; a proof build is not), `checks.test.ts` and `supervisor.test.ts` whole, and in `fault-lifecycle` and `boot` the cases "a worker that answers `capture-worker/0.4.0` is refused by name": the Core accepts 0.6.0 and refuses an older word. **Not shown by a test: the refusal of exactly `capture-worker/0.5.0`** (no case names that word; the comparison is an equality against one constant, `checks.ts:301`).

## 4. The 17 red cases, by cause (none edited: outside the profile line)

| # | Pin | Change needed | Red cases |
|--:|---|---|---|
| 1 | `apps/core-server/test/support/capture-stub-worker.mjs:77` | `'capture-worker/0.5.0'` -> `'capture-worker/0.6.0'` | 11 of `ipc.test.ts`, 3 of `tidy-fy.test.ts` (every case that starts the stand-in process; the case that reads its word) |
| 2 | `apps/core-server/src/capture/__tests__/fault-lifecycle.test.ts:415` | the "newer" word `0.6.0` -> `0.7.0` | 1 |
| 3 | `apps/core-server/src/capture/boot/__tests__/boot.test.ts:309` | the same | 1 |
| 4 | `packages/shared/src/api/system.ts:97` (`SYSTEM_COMPONENTS_EXAMPLE`) | `0.5.0` -> `0.6.0` | 1 of `modules/system/__tests__/routes.test.ts` (:371) |
| 5 | `packages/shared/openapi/openapi.json:16469` | by the generator after 4 | none in this run |

The blueprint cell names "the test lines that pin the word"; pins 4 and 5 are in `packages/shared` and are named nowhere in the row. The database suites that start the stand-in through `test/support/capture.ts` were not run; they will refuse the same way until pin 1 moves.

## 5. Doubles, and what stays unproven

- The handshake was read from the built binary directly, not through a Core boot: a Core boot on the real worker at 0.6.0 is the run of row 59 (BR-11) and of the session rows.
- Nothing about the production host: the version there is whatever build is installed (`9A/H-01`).

## 6. Driver decisions, for the controller to confirm

1. DRIVER DECISION: both pins of the profile line were moved (`worker.h`, `checks.ts:285`) although five further pins could not be: the row's verification (the header equality) needs both, and the brief said to expect the tests of a pin that is not this row's red and to report them. The cost is 17 red cases in five Core test files until the request lands; leaving `checks.ts` at 0.5.0 would have left the real worker refused by the Core instead.
2. DRIVER DECISION: `README.md:138` of the worker was edited (it states the word; it is in the worker's folder, declared in `file_claims.md`).
3. Proposed for the two "newer word" test lines: `0.7.0`, so that they stay "a release word above the built one".

## 7. Requests

One line in `delegation_progress/file_requests.md` (the five pins, blocking: yes for a green Core suite).

---
*Generated: 2026-10-13 01:27 WIB*
*Last Updated: 2026-10-13 01:27 WIB*
