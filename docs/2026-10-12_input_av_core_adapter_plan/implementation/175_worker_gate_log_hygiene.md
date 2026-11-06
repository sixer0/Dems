---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 175
work_package: WP-11b (branch B)
date: 2026-10-13
agent: coder-execution
tier: T3
requirement: BR-04 of verification/05_security_branch_b.md
status: needs-review (one part only: a frame member of the capture protocol, decision C30 (3); everything in the worker is complete)
---

# Row 175: log hygiene of the worker's gate, and its two refusal codes

## 1. What was built

| File | Change |
|---|---|
| `apps/capture-worker/src/announce.h`, `announce.c` (pure) | `AnnounceVerdict` and `announce_gate_verdict` (`announce.c:53-56`): the NAME of a refusal, `ANNOUNCE_NOT_SEEN` only when no ANNOUNCE line and no adopted address was shown, `ANNOUNCE_NOT_MATCHED` for every other open that may not pass, `ANNOUNCE_PASSED` exactly when `announce_gate_passed` is 1. `announce_names_path` (`announce.c:67-86`): does a text name the path of a plan's address - the whole path, or one of its elements of at least 8 characters (`ANNOUNCE_PATH_ELEMENT_CHARS`) |
| `apps/capture-worker/src/ingest.c` | the log callback's written part (`:186-217`): a message is judged on its whole formatted text (4,095 characters) and withheld when it names an address or the path of any camera of the session's plan; `announce_refusal_code` (`:225-227`) used at the two places that name a gate refusal (`:579`, `:589`); header text (`:40-45`) |
| `apps/capture-worker/src/worker.h` | one line, `:44`: `#pragma GCC poison av_log_set_level`. The version line (`:52` now, `:46` before) is untouched: row 177 |
| `apps/capture-worker/test/announce_test.c` | checks (9) the verdict and (10) the path test: 151 -> 187 assertions |
| `apps/capture-worker/test-fixtures/row58_gate.py` | the proof-build case `unseen` expects the second code; every run also requires 0 lines of the OTHER code (`never_the_other_gate_code`) |
| `apps/capture-worker/test-fixtures/row175_log_hygiene.py` (new) | the run script of section 3: `repeat` (two sessions) and `scan` (reads files only) |

Not touched: `check.sh`, `test/static/*`, `Makefile`, `test/e2e.py`, `test/m3worker.py`, `capture_worker.c`, `ipc.c`, `sink.c`, the Core, `packages/capture-protocol`. The gate itself (`announce_gate_passed`, its place between the open and the probe, the observation, the attribution, the per-camera interrupt) was not changed: `git diff` of `ingest.c` shows the test at `:586` with its condition as row 58 left it.

## 2. BR-04, point by point

| Point | State | Where, and how it is held |
|---|---|---|
| (1) `av_log_set_level` is not called | **done, held by the compiler** | `worker.h:44` poisons the identifier in every unit (the header is their first include). Shown: a file that includes `worker.h` and calls it does not compile (`error: attempt to use a poisoned identifier`). Search `av_log_set_level(` in `src/`: 0 |
| (1) nothing above level 16 is written | **done** | `ingest.c:192` and `:202`: the callback returns for every level above `AV_LOG_ERROR` (16) before anything is written; a higher level is only formatted when the gate has to see it. 14 runs: 0 library lines above level 16 in any worker log |
| (2) no announced or expected address or path in the log, a frame or an error | **done** | Nothing of the gate writes a text: the two codes are constants, the frame reason is a constant, `av_error` is the library's error name. Withheld by content, at every written level, from any thread and any context: a message with `://` (as before, now judged on the whole message, not on the 255 characters written), and a message that names the path of a camera of the plan (`ingest.c:211-213`). 14 runs: 0 occurrences of any path text - whole path, each long element, each near-miss path - in the worker's log; 0 in log plus standard output as each run recorded it; 0 occurrences of `://` in any worker log |
| (2) "a library message that contains the session's path element is withheld at every level" | **done by unit check and reading; not shown on the wire** | Unit check (10), 14 assertions in both directions (a text that names the path is recognised; an ordinary library message, a short element alone, a part of the element and another case are not). On libavformat 63.1.102 no message at level 16 or below names a bare path, so no run can show the branch |
| (3) two codes, told apart, neither with path text | **done in the worker's log; frame member: needs-review** | `INGEST_ANNOUNCE_NOT_MATCHED`: a differing line (9 runs: seven near misses, two foreign lines) and a repeated line on the wire (2 runs). `INGEST_ANNOUNCE_NOT_SEEN`: no line (the proof build, both cameras: 2 lines). No run shows the other code of its case. The frame of both is `WARNING CAPTURE_FAULT`, reason `CAMERA_NOT_CONNECTED` |

**The needs-review part (decision C30 (3)).** The capture protocol has no reason that tells the two refusals apart in a frame, and `packages/capture-protocol` is not this row's. Nothing was edited there. The exact members, should the Core have to read the difference from a frame, are in `file_requests.md`: `CAMERA_ANNOUNCE_NOT_MATCHED`, `CAMERA_ANNOUNCE_NOT_SEEN`, and row 176's optional `CAMERA_NO_PICTURE` (its code `INGEST_NO_PICTURE_SIZE` is likewise in the worker's log only), each also in `WARNING_REASONS_OF.CAPTURE_FAULT`, then one mapping line each in `ingest_over` (`ingest.c:152`). Rows 48, 142 and 178 do not need them: row 48 treats every one as the same capture fault (BR-08), rows 142 / 178 read the worker's log.

## 3. Checks run (2026-10-13 01:08 to 01:18 WIB, this Mac, libavformat 63.1.102)

Every build and run under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock` from the repository root; the runs with the command sandbox off, ports 8559 and 8561 on loopback. One run each; nothing failed. 1-minute load before the runs: 3.9.

| Check | Command | Result line |
|---|---|---|
| Static rules, self-test, unit checks, build | `make -C apps/capture-worker` | `make rc=0`; `check.sh: src: static rules OK (...)`; 75 lines `refused as required`; `announce_test: all 187 checks hold (...)`; `writer_test`, `start_checks`, `log_test`, `anchor_test`, `micwatch_test`: `all checks hold` (`.cache/row175-log-hygiene/make_1.out`) |
| Proof builds | `make -C apps/capture-worker proof` | rc 0 |
| The poisoned identifier | `clang -std=c11 -fsyntax-only` of a two-line file that includes `worker.h` and calls the function | `error: attempt to use a poisoned identifier`, 1 error |
| Row 58's gate, once | `M3_PORTS=8559,8561 python3 apps/capture-worker/test-fixtures/row58_gate.py all` | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` (`row58_gate_1.out`); `unseen`: `codes=['ingest1:INGEST_ANNOUNCE_NOT_SEEN', 'ingest2:INGEST_ANNOUNCE_NOT_SEEN']`, worker rc 70; near and foreign: `INGEST_ANNOUNCE_NOT_MATCHED` |
| A repeated line on the wire | `... row175_log_hygiene.py repeat` | 2 of 2 PASS: same address twice on camera 1, another address second on camera 2; statuses `[200, 200, None]` (the second ANNOUNCE gets no answer), ic 0, 0 bytes, 1 line `INGEST_ANNOUNCE_NOT_MATCHED`, 0 lines of the other code; control ic 1, 75 frames; worker rc 0 |
| Path text and codes over every run | `python3 apps/capture-worker/test-fixtures/row175_log_hygiene.py scan` | `ROW175 LOG HYGIENE: 14 run(s) scanned, 14 PASS, 0 FAIL; path text in any worker log: 0; library lines above level 16: 0; {"differing_line_runs_with_NOT_MATCHED": 9, "no_line_runs_with_NOT_SEEN": 1, "repeated_line_runs_with_NOT_MATCHED": 2}; both codes seen, each in its case: yes` (`scan_1.out`, `scan.json`) |
| Row 176's fixture, once | `... row176_camera_end.py all` | `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL` |
| Core tests that read the worker's sources | `npx vitest run --project unit src/capture/__tests__/protocol-pins.test.ts src/capture/__tests__/muxer-safety.test.ts --maxWorkers=2` | `Test Files 2 passed (2)`, `Tests 15 passed (15)` |
| Leftovers | `lsof -nP -iTCP:8559-8564 -sTCP:LISTEN`; `pgrep` of worker and fake microphone | 0 rows; 0 processes |

The library lines the 14 runs did write (level 16, three runs: the two `repeat` runs and row 58's `no_announce_request`): `RTSP: Unexpected Command` and one `(message with an address withheld)` each. The second is the existing address rule at work on the real binary.

## 4. Doubles, and what stays unproven

- The clients are the FFmpeg 9.0.2 command line and a raw socket client; there is no relay. The library is this Mac's Homebrew build; the same on the Ubuntu 24.04 library is row 141.
- The withholding of a bare session path is not shown on the wire (section 2). If another library version names a path at level 16, the unit-checked test is what stands between it and the log.
- A path element shorter than 8 characters, alone, is not withheld (the whole path always is). The random element of row 47 is 22 characters.
- An ANNOUNCED address that differs from the plan's is unknown text: it is kept out of the log by level (the messages that carry it are levels 24, 32 and 56) and by the `://` rule, not by a comparison. A level-16 message naming a foreign bare path would be written; none exists on this library (HX-3 of the addendum review stays as it was for foreign text).
- The whole e2e series was not run (row 59, BR-11).

## 5. Driver decisions, for the controller to confirm

1. DRIVER DECISION: the home of the two codes is the worker's log vocabulary (`ingest.c`), the judgement is in the pure unit (`announce.c`); no protocol member. Names: `INGEST_ANNOUNCE_NOT_MATCHED` kept for "a line was seen and it does not let the open pass", new `INGEST_ANNOUNCE_NOT_SEEN` for "no line".
2. DRIVER DECISION: an adopted other control address without an ANNOUNCE line counts as "not matched" (something was announced); "not seen" means nothing at all was shown.
3. DRIVER DECISION: `av_log_set_level` is made uncallable by a poison line in `worker.h` instead of a static rule, because `check.sh` is not this row's file. The rule for `check.sh` is requested.
4. DRIVER DECISION: the path test covers every camera of the plan on every thread (a message of one camera's context may name the other's path), and a single element counts from 8 characters.
5. DRIVER DECISION: `row58_gate.py` (row 58's fixture) was edited in three lines so that its `unseen` case expects the second code; without it that case fails by design of this row.
6. A client that never announces still ends as `INGEST_OPEN_FAILED` (the library fails that open before the gate, row 58 decision 7); `INGEST_ANNOUNCE_NOT_SEEN` is reached only when the open returns without a line, which today only the proof build does.

## 6. Requests

Three lines in `delegation_progress/file_requests.md`: the three protocol members (the needs-review part); two static rules for `check.sh`; the cases for rows 142 / 178. None blocks another row.

---
*Generated: 2026-10-13 01:20 WIB*
*Last Updated: 2026-10-13 01:20 WIB*
