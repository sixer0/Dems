---
task_id: 2026-10-07_dems_real_capture_sealing
row: 58
date: 2026-10-09
agent: coder-execution (driver of the pair); helper coder-execution for the INTERNAL actions slice of P5
status: needs-review
artifact: implementation/20_m3_worker_engine.md
---

# Row 58 - progress of the driver (parallel run)

Parallel run: this file replaces any edit of `status_tasks.md`, `delegation_progress_report.md`,
`masterplan/02_plan.md` and `implementation/99_implementation_report.md`, none of which was touched.
Nothing was committed. Detail, evidence and decisions: `implementation/20_m3_worker_engine.md`.

## Status per part

| Part | State | Checks (2 runs each unless stated) |
|---|---|---|
| P1 protocol, lossless RECORD class | done | M3-REC-1: 19 unit tests + frame half; mutations M2, M3 turn it red |
| P2 supervisor: option C, N-1..N-4, init-segment-only decision | done, decisions D58-1, D58-2 need a ruling | 142 tests in `src/capture`; 7 mutations each red |
| P3 worker | done | `proto`, `session` x3 cases, `camstop`, `fatal`, `udp`; negative controls: re-encoded file, forbidden-option build, row-111 binary |
| P4 mux flags | done, decision D58-4 (pinned flags kept, `delay_moov` rejected on measurement) | `shape` x2, `--stall` x2 |
| P5 engine seam + config | done; helper's seven semantic choices and one out-of-row line need a ruling | 13 forwarder/config tests; helper: 13 shared + 5 db tests |
| P6 end to end | done | `sup --mode run / kc1 / kc3`, negative controls for each |
| Timing defaults | measured, all kept | section 7 of the note |
| M3-BC-1 | NOT RUN (row 61 owns the boot checks) | - |

## Files

Created:
- `apps/capture-worker/src/worker.h`, `ipc.c`, `sink.c`, `ingest.c`, `audio.c`
- `apps/capture-worker/check.sh`
- `apps/capture-worker/test/m3worker.py`, `test/fake_mic.c`, `test/static/planted.tsv`
- `apps/core-server/src/capture/forwarder.ts`
- `apps/core-server/src/capture/__tests__/records.test.ts`, `forwarder.test.ts`
- `apps/core-server/test/support/capture-session-driver.ts`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/20_m3_worker_engine.md`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/evidence/20_m3_worker/` (`official_runs_summary.txt`, `official_runs_exit_codes.txt`, `official.sh`, `mutate_supervisor.sh`, `summarize.py`; text only)
- `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_row58.md` (this file)
- by the helper: `packages/shared/src/sim/capture-telemetry.ts`, `packages/shared/test/sim-capture-telemetry.test.ts`, `apps/core-server/src/engine/__tests__/capture-actions.db.test.ts`, `docs/.../delegation_progress/coder_execution_row58_p5_actions.md`

Updated:
- `apps/capture-worker/Makefile`, `apps/capture-worker/src/capture_worker.c` (rewritten)
- `packages/capture-protocol/src/index.ts`, `packages/capture-protocol/test/protocol.test.ts`
- `apps/core-server/src/capture/supervisor.ts`, `types.ts`, `index.ts`
- `apps/core-server/src/capture/__tests__/liveness.test.ts`, `supervisor.test.ts`, `ipc.test.ts`, `module.test.ts`, `static.test.ts`, `protocol-pins.test.ts`
- `apps/core-server/test/support/capture.ts`, `capture-stub-worker.mjs`
- `apps/core-server/src/config.ts` (P25 edits 7-10, 45 lines added, 0 removed), `apps/core-server/src/plugins/config/load-config.ts`
- `packages/shared/src/api/capture.ts` (`CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES`)
- by the helper: `packages/shared/src/sim/types.ts`, `actions.ts`, `audio.ts`, `constants.ts`, `faults.ts`, `index.ts`; `packages/shared/src/api/sim-actions.ts`, `core-api.ts` (comment); `packages/shared/src/live/source/bindings.ts`, `index.ts`, `types.ts`, `live-sim.ts` (comments); `packages/shared/test/api-domain-operations.test.ts`, `live-source-bindings.test.ts`, `live-source-platform-neutral.test.ts`; `apps/core-server/src/engine/types.ts`, `host.ts`, `limits.ts`, `hosted-actions.ts` (comment); `apps/core-server/src/engine/__tests__/hosted-actions.test.ts`, `commands.db.test.ts`; `apps/core-server/src/modules/{demo,devices,storage,system}/__tests__/support.ts`, `modules/sessions/__tests__/memory-engine.ts`; **`apps/core-server/src/db/store/store.ts`** (outside the row, one line: see the note 5.4)

Not touched: `app.ts`, `index.ts` (no diff from this row), `redaction.ts`, `transcription.ts`,
`openapi.json` (its 1-line diff in the tree is another round's), `apps/transcriber/**`, any migration.

## Baseline (run once at the end, sandbox off, each `--maxWorkers=2 </dev/null`)

Script: `.cache/row58/baseline.sh` (commands below are its lines).

| Command | Result | Baseline |
|---|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2` | `Test Files 75 passed (75)`, `Tests 1984 passed (1984)` | 1936 pass (grew: helper +15, the row-113 round the rest) |
| `npm run test -w @dems/capture-protocol -- --maxWorkers=2` | `Tests 20 passed (20)` | 18 (grew +2) |
| `npm run test -w @dems/core-server -- --maxWorkers=2` | `Test Files 2 failed \| 172 passed (174)`, `Tests 3 failed \| 4270 passed (4273)`; the 3: `src/modules/sessions/__tests__/routes.test.ts` x2, `src/modules/evidence/__tests__/routes.test.ts` x1 (MODG route lists) | 3 failed / 4214 passed |
| after that run one test was added (`ipc.test.ts`, real-process option C): `npx vitest run --root apps/core-server --project unit src/capture` | `Test Files 8 passed (8)`, `Tests 142 passed (142)` | 86 in 6 files |
| `npm run test -w @dems/transcriber -- --maxWorkers=2` | `Tests 259 passed \| 1 skipped (260)` | 239 pass / 1 skipped (grew: another round) |
| `npm run test -w @dems/core-web -- --maxWorkers=2` | `Tests 1523 passed (1523)` | 1523 |
| `npm run test -w @dems/mobile -- --maxWorkers=2` | `Test Suites: 194 passed`, `Tests: 2020 passed, 2020 total` | 2020 |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- --maxWorkers=2` (once) | `Test Files 1 failed \| 128 passed (129)`, `Tests 12 failed \| 1853 passed (1865)`; all 12 in `test/acceptance/contract.test.ts` | 12 failed, all in that file |
| `npm run typecheck` for shared, core-server, capture-protocol, transcriber | exit 0, 0 errors each | 0 |
| `npm run lint` for the same four | exit 0, 0 warnings each | 0 |
| `npm run typecheck -w @dems/core-web` / `-w @dems/mobile` | 2 + 1 errors, all `PrecheckCheckId` (`check-icon.tsx:9`, `devices-step.tsx:27`, `:267`) | exactly 3 known |
| `npm run db:status -w @dems/core-server -- --database <each of the four>` | `schema version 2; contract revision dbc-3; ... ledger matches` x4 | version 2 / dbc-3 |
| `git status --porcelain --untracked-files=all \| grep -icE "\.(mp4\|m4a\|aac\|mp3\|wav\|mov\|mkv\|h264\|pcm\|s16)$"` | `0` | 0 media in git |
| `pgrep -fl "capture-worker\|fake_cam\|fake_mic\|capture-session-driver\|ffmpeg"` | nothing | - |
| `lsof -nP -iTCP -sTCP:LISTEN \| grep -E ":85(5[4-9]\|6[0-4]) "` | only the three `qemu-syst` on 8554 / 8556 / 8558, untouched | - |

## Commands a navigator re-runs (repository root, sandbox off for everything that binds or spawns)

```
python3 apps/capture-worker/test/m3worker.py build            # make + static rules + self-test + proof builds + fixtures
make -C apps/capture-worker check && make -C apps/capture-worker selftest
npm run test -w @dems/capture-protocol </dev/null
npx vitest run --root apps/core-server --project unit src/capture </dev/null
.cache/row58/mutate.sh                                         # copy: implementation/evidence/20_m3_worker/mutate_supervisor.sh
.cache/row58/official.sh                                       # copy: implementation/evidence/20_m3_worker/official.sh (about 15 min)
python3 .cache/row58/summarize.py                              # copy: .../summarize.py; prints the table of evidence/20_m3_worker/official_runs_summary.txt
```
Single checks: `python3 apps/capture-worker/test/m3worker.py <proto|session|camstop|fatal|udp|shape|sup|h4neg> <run name> [--case zero|pm80|drift] [--variant worker|negctl|delaymoov|skeleton] [--mode ...] [--switch] [--tap] [--stall] [--limits '{...}'] [--expect-fail]`.

## For the controller to record

Decisions D58-1 to D58-10: the note, section 8. Open items the row leaves: the note, sections 0 and 9.

One thing I did that I should not have: to read the schema versions I first sourced `.data/pg.env`
into a subshell for a `psql` probe. It printed nothing and failed to connect; I then used
`npm run db:status` instead. The file's content was not displayed, copied or sent anywhere.

---

# Fix round 1 (navigator findings; rulings D72)

Status: **complete** for the items ordered; nothing disputed. Detail, per-finding table, numbers
and re-run commands: `implementation/20_m3_worker_engine.md` sections FR-1 to FR-5.

| Finding | Outcome |
|---|---|
| A-1, A-2, A-4 (helper), A-5, A-6, A-7, A-8, A-9, A-10, A-13, A-15 | fixed |
| F-1, F-2, F-3, F-4, F-5, F-8, F-9, F-11, F-13 | fixed |
| D72(k) no camera | implemented (worker + supervisor) |
| A-3, A-12, F-10, `-PROOF` refusal | carried: row 61 |
| A-11 | carried: row 65 |
| A-14 | carried: controller |
| F-6 | carried: row 62 / class C |
| F-7 | carried: rows 76/77 (`tapActive` added) |
| F-12 | carried: row 59 |
| F-14 | carried: row 60 |

Files created in this round: `apps/capture-worker/src/anchor.c`, `anchor.h`;
`apps/capture-worker/test/anchor_test.c`, `sink_kill_test.c`;
`apps/core-server/src/capture/__tests__/forwarder-engine.test.ts` (helper);
`implementation/evidence/20_m3_worker/fix_round_1_runs_summary.txt`,
`fix_round_1_exit_codes.txt`, `fix_round_1_mutations.txt`.

Files updated in this round: `apps/capture-worker/Makefile`, `check.sh`, `src/worker.h`,
`capture_worker.c`, `ipc.c`, `sink.c`, `ingest.c`, `audio.c`, `test/m3worker.py`, `test/fake_mic.c`,
`test/static/planted.tsv`; `packages/capture-protocol/src/index.ts`, `test/protocol.test.ts`;
`apps/core-server/src/capture/supervisor.ts`, `types.ts`, `forwarder.ts`, `index.ts`,
`__tests__/records.test.ts`, `forwarder.test.ts`, and the device IDs in the other capture tests;
`apps/core-server/test/support/capture.ts`, `capture-session-driver.ts`; the two docs; evidence
copies of `official.sh`, `mutate_supervisor.sh`, `summarize.py`. Helper (shared + engine): listed
in `coder_execution_row58_p5_actions.md` "Fix round 1".

Suites: capture-protocol 20; `src/capture` 171; shared 1993; core-web 1523; mobile 2020;
core-server unit 3 failed (known MODG) / 4301 passed; db 12 failed (all `contract.test.ts`) / 1856
passed; transcriber 1 failed / 299 passed / 1 skipped (the failure is in the untracked row-77 file
`chunker-clamp.test.ts`, not this row's); typecheck + lint 0; OpenAPI check up to date, 92
operations; four databases at schema version 2.

New decisions: D58-11 to D58-17 (the note, FR-2). `.data/pg*.env` was not read in this round.
