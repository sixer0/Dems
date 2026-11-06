---
task_id: 2026-10-07_dems_real_capture_sealing
row: 137
date: 2026-10-09
agent: coder-execution
status: needs-review
note: implementation/68_r9_web_devices.md
---

# Row 137 — status and file list

Status **needs-review**: built and unit / component tested; not `complete` because the browser flows
are the gate's, one request is open (System entry link), and the label on built-in devices waits
for data of rows 136 / 139. Nothing committed, deleted or renamed; no dependency; no lockfile write.

## Created
- `apps/core-web/src/features/devices/`: `camera-search.ts`, `camera-search-context.tsx`, `camera-search-panel.tsx`, `camera-connect.ts`, `camera-connect-dialog.tsx`, `capture-inputs.ts`, `mic-rescan.tsx`, `capture-notices.tsx`, `source-class.ts`, `source-badge.tsx`, `precheck-search.tsx`
- `apps/core-web/src/features/devices/__tests__/`: `search-bed.tsx`, `camera-search.test.tsx`, `camera-connect.test.tsx`, `camera-connect-canary.test.tsx`, `capture-notices.test.tsx`
- `apps/core-web/src/lib/capture-notices.ts`
- `apps/core-web/src/features/session-new/__tests__/precheck-unreachable.test.tsx`
- `docs/.../implementation/68_r9_web_devices.md`, this file

## Updated
- `apps/core-web/src/features/devices/`: `index.tsx`, `capture-selector-panel.tsx`, `camera-tile.tsx`, `audio-input-card.tsx`, `device-drawer.tsx`, `motion.ts`, `devices.css`, `__tests__/capture-selector.test.tsx`
- `apps/core-web/src/features/session-new/`: `model.ts`, `devices-step.tsx`
- `apps/core-web/src/components/shell/notifications-bell.tsx`
- `apps/core-web/src/runtime/testing/live-harness.ts` (default answer of op 94)
- `apps/core-web/src/test/live-devices-commands.test.tsx` (D100 (2))
- `packages/shared/src/i18n/en/common.ts`, `packages/shared/src/i18n/en/devices.ts`
- `packages/shared/src/live/source/bindings.ts`, `packages/shared/test/live-source-bindings.test.ts` (D100 (2))
- `docs/.../delegation_progress/file_claims.md` (3 lines), `file_requests.md` (2 lines: i18n notice, System link)

## Results
Web typecheck: 0 errors in this row's files (1 foreign: `verify-v2.test.tsx`). Lint exit 0. 24 test
files / 227 tests passed in the one final targeted run; canary passed; both negative controls red.

## Open for the controller
Decisions D-137-1..10 in the note (esp. D-137-2 badge rule without op 71, D-137-5 the shared binding
change for D100, D-137-7 the redaction gap); the System link request; the Dashboard kebab Restart.
