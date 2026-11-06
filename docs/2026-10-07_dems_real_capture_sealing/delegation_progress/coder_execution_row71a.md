# coder-execution — row 71a (worker half of row 71)

Status: **complete** for the worker and the protocol package. Supervisor-path checks wait for 71b.
Note: `implementation/30_m5_mic_switch.md`. Contract: `delegation_progress/contract_71a_protocol_landed.md`.

## Files

Edited: `packages/capture-protocol/src/index.ts`, `packages/capture-protocol/test/protocol.test.ts`;
`apps/capture-worker/src/{worker.h,audio.c,capture_worker.c,ingest.c,anchor.h,anchor.c}`;
`apps/capture-worker/Makefile`; `apps/capture-worker/test/{anchor_test.c,m3worker.py,e2e.py}`;
`apps/core-server/src/capture/__tests__/protocol-pins.test.ts` (pin only).

New: `apps/capture-worker/src/{micwatch.h,micwatch.c}`;
`apps/capture-worker/test/{micwatch_test.c,m5_mic.c,m5mic.py,frames_check.ts}`.

Not touched: `check.sh`, `test/static/**`, `test-fixtures/**`, `supervisor.ts`.

Requests filed: `file_requests.md` — `recording-fragments.db.test.ts:212-213` (fixture members).

## Worker state

Worker `capture-worker/0.4.0`, protocol 4. Static rules OK (row 61's pinned-call rule included, no
table change needed). Proof build added: `build/capture-worker-intervalskew`.

## Results

See the note, section 3. All checks this row wrote or touched ran once and are as expected; one
re-run after a harness-criterion fail (`m5_warn`).

## Coordinator notice (row 61, D138)

1. `make check`: OK, no red line, no pinned-call row requested (no create / rename / link call added).
2. Compile-time assert added (`ingest.c:61`); a compile with `-DDEMS_VERIFIED_LAVF_VERSION_INT=AV_VERSION_INT(63,1,103)` stops with the static assertion.
3. Version string keeps the form `capture-worker/0.4.0`.
