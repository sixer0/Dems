---
task_id: 2026-10-07_dems_real_capture_sealing
row: 66 (M4-W2)
date: 2026-10-09
agent: coder-execution
status: needs-review
note: implementation/26_m4_selector.md
---

# Row 66 — status and file list

Status **needs-review** (not blocked). Open for the controller: three file requests
(`file_requests.md`, 10:02Z, row 66), the contract contradiction D-66-3 (mic order: AC-B-70 versus
the slice's describe text and the durable mapping), operation 89 not routed (D-66-4). Nothing
committed, deleted or renamed. No dependency, no lockfile write, no frozen file touched
(`app.ts` / `index.ts` / `config.ts`), nothing under `src/db/**`, `capture/adapters/**`, the web or
the mobile app. `status_tasks.md`, `delegation_progress_report.md` and `masterplan/02_plan.md` were
not written (D94; parallel isolation).

## Created

| File | What |
|---|---|
| `apps/core-server/src/modules/capture-config/routes.ts` | operations 76-80, the lock, the registry seam |
| `apps/core-server/src/modules/capture-config/plan.ts` | `buildCapturePlan`, `assertRecordableSelector`, `CapturePlanError` |
| `apps/core-server/src/modules/capture-config/__tests__/plan.test.ts` | 10 tests |
| `apps/core-server/src/modules/capture-config/__tests__/routes.test.ts` | 13 tests |
| `apps/core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts` | 9 db tests (real engine, clone of the seed) |
| `apps/core-server/src/modules/capture-config/__tests__/support.ts` | unit harness: the engine stand-in on a real simulator |
| `packages/shared/src/sim/capture-config.ts` | `setCaptureConfigTransition` |
| `packages/shared/test/sim-capture-config.test.ts` | 12 tests |
| `docs/.../implementation/26_m4_selector.md`, this file | |

## Updated

| File | Change |
|---|---|
| `apps/core-server/src/modules/capture-config/index.ts` | mounts the routes; `provideDeviceRegistry` / `hasDeviceRegistry`; exports; header |
| `apps/core-server/src/modules/capture-config/slices.ts` | mic rows in input order (AC-B-70) |
| `apps/core-server/src/modules/capture-config/__tests__/slices.test.ts` | +1 test (swapped primary) |
| `packages/shared/src/sim/types.ts` | `CaptureConfigChange` types; two members of `SimActions` (appended) |
| `packages/shared/src/sim/actions.ts`, `sim/index.ts` | the two actions; one export line |
| `packages/shared/src/api/sim-actions.ts` | two hosted lines, `CAPTURE_CONFIG_CHANGE_OPERATIONS`, header counts |
| `packages/shared/src/live/source/bindings.ts`, `live/source/index.ts` | two bindings, `CAPTURE_CONFIG_CHANGE_OPERATION_INDEX`, one export |
| `packages/shared/src/api/core-api.ts`, `live/source/types.ts`, `live/source/live-sim.ts` | comment counts only |
| `apps/core-server/src/engine/hosted-actions.ts`, `engine/host.ts` | comment / message counts only (31 -> 33, 45 -> 47) |
| tests with pins | `packages/shared/test/{api-domain-operations,live-source-bindings,live-source-platform-neutral}.test.ts`, `apps/core-server/src/engine/__tests__/hosted-actions.test.ts`, `apps/core-server/test/acceptance/{contract,rbac-matrix}.test.ts`, `apps/core-server/test/static/imports.test.ts` — lines in the note, section 4 |
| `delegation_progress/file_requests.md` | three appended lines |

## Results

- typecheck: 0 errors in this row's files; not mine, in flight: shared `test/evidence-package.test.ts:453`, core-server `src/sealing/__tests__/finalize-transcript.db.test.ts:77`; lint 0 / 0.
- unit: capture-config + hosted-actions 73 passed, `test/static/imports.test.ts` 17 passed; shared touched files all passed.
- db (under `.locks/db-migrate.lock`, throw-away databases, sandbox off): `capture-config.db.test.ts`
  9/9; `rbac-matrix.test.ts` green (83 routed operations walked); `contract.test.ts` 12 failed / 23
  passed (baseline, measured) -> 11 failed / 25 passed.
- Red by design until request 1 is applied: `src/capture/adapters/__tests__/static.test.ts` block A-5.

## Not proven here

- Device / browser halves of `M4-SEL-W/T/P` (listed in the note, section 8).
- A real client socket receiving the delta end to end (the publication and the replica fold are
  each proven; the realtime hub between them is untouched code).
- `409 CAPTURE_CONFIG_LOCKED` inside the acceptance walk (it is in the module's db test; area 4 of
  `contract.test.ts` cannot run until ops 81-83 are routed).
- Rule RG-3 against a registry built by the real wiring (only the seam, with the fake registry).
