# coder-execution — row 71b (Core half of row 71)

Status: **needs-review** (2026-10-09). Note: `implementation/30b_m5_session_wiring.md`. No commit, no migration.

Why needs-review: no real worker ran against the adapted supervisor (runner item); three rulings wanted
(new `details.reason` values, the one-fault-per-device limit of the engine, operator alerts for the notices).

## Files

New: `apps/core-server/src/capture-session/{index.ts,statements.ts,__tests__/session-capture.db.test.ts}`,
`src/engine/capture-session.ts`, `src/capture/__tests__/fault-lifecycle.test.ts`.

Edited: `src/capture/{supervisor.ts,forwarder.ts,index.ts,types.ts}`,
`src/engine/{host.ts (capture blocks),types.ts,internal-actions.ts,limits.ts,index.ts}`,
`src/modules/sessions/{routes.ts,operations.ts,index.ts}`,
tests `src/capture/__tests__/{forwarder,forwarder-engine,records,supervisor,liveness,ipc,static}.test.ts`,
`src/modules/sessions/__tests__/static.test.ts`, `src/engine/__tests__/static.test.ts`,
`test/support/{capture.ts,capture-stub-worker.mjs}`, `test/static/imports.test.ts`.

Docs: `delegation_progress/file_claims.md` (2 lines), `file_requests.md` (5 lines).

## Results

- db `src/capture-session`: 12 / 12.
- unit (capture tests, sessions tests, `test/static`, engine static): 600 passed, 3 failed, none this row's (`app.ts` pin: rows 90 / 91; 2 baseline MODG).
- typecheck: 0 in this row's files; lint: 0 in this row's files.

## Requests applied

Row 61 (D138): boot checks mounted, capture mode through the one function, closed-unit entry, proof-build refusal.
Pass D3: worker stopped before the sources are closed, with test and control.
Controller D142: protocol 4, interval rows from the record, `firstVideo` in the hand-off events.
