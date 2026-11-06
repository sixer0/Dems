# coder-execution — row 133 (R-10 no-device notifications, op 97, pre-check rule)

Status: **needs-review** (built and tested; three wiring calls belong to other rows). Note: `implementation/64_r10_no_device_alerts.md`.

## Files created
- `packages/shared/src/sim/capture-notices.ts`
- `packages/shared/test/sim-capture-notices.test.ts`
- `apps/core-server/src/capture-notices/{index.ts,notifier.ts,probe.ts,precheck.ts}`
- `apps/core-server/src/capture-notices/__tests__/notices.test.ts`
- `apps/core-server/src/modules/capture-inputs/{index.ts,routes.ts}`
- `apps/core-server/src/modules/capture-inputs/__tests__/{support.ts,routes.test.ts,no-device.db.test.ts}`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/64_r10_no_device_alerts.md`

## Files edited (smallest edits)
- `packages/shared/src/sim/types.ts` (`CaptureWarningInput` union), `actions.ts` (import + dispatch), `index.ts` (one export), `vocabulary.ts` (`PRECHECK_ORDER`, comment), `session-machine.ts` (`unreachableSource`, role-keyed mic cases, lens case)
- `packages/shared/test/{session-machine,sim-faults-scenarios,sim-gap-closure}.test.ts` (one id each)
- `apps/core-server/src/modules/sessions/routes.ts` (gate call sites), `sessions/__tests__/static.test.ts` (import pin + 1)
- `apps/core-server/test/static/imports.test.ts` (`CLOSED_UNITS` + 1)
- `apps/core-web/src/features/session-new/__tests__/session-new.test.tsx` (2 lines)
- `apps/mobile/src/features/session-new/precheck.test.tsx` (2 lines), `session-new-screen.test.tsx` (1 line)
- `delegation_progress/file_requests.md` (6 lines appended)

## Not edited
Registry, schemas, simulator REST answers, OpenAPI, count pins (row 132, D106); `app.ts`; `db/**`; `modules/capture-discovery/**`; engine; `masterplan/02_plan.md`, `status_tasks.md`.

## Results
shared 19/19 (+851/851 pre-check-related), server unit 21/21 + 10/10, db 4/4 x3 as `dems_app` under the db lock, web session-new 20/20, mobile session-new 97/97; typecheck core-server / core-web / mobile exit 0. Coordinator note on schema 5 / `dbc-6`: no test of this row pins a schema version or a table count.

## Blockers / open
1. `app.ts` registration of `modules/capture-inputs` (op 97 not served until then).
2. Row 132: `notifier.searchClosed` at every closed search; `provideDiscovery`.
3. Rows 71 / 136: `provideProbe`. Row 139: fault keys of situation C.
4. Decision to confirm: notices ride on `raiseCaptureWarning` / `clearCaptureWarning` instead of a new INTERNAL action.
