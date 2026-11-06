# coder-execution - wave H, driver D

Status: **needs-review** (2026-10-10). Note: `implementation/124_fix_wave_h_d.md`.

Sub-drivers: web client (complete, needs-review), mobile client (complete); their results are in the note. They wrote no doc and no claim line.

## Files
Server / scripts / shared (driver D):
- NEW `apps/core-server/src/capture/fence/development-discovery.ts`, `src/capture/fence/__tests__/development-discovery.test.ts`
- `apps/core-server/src/capture/fence/index.ts`, `src/capture/__tests__/static.test.ts` (pin by delta)
- NEW `apps/core-server/test/support/lane-camera-stub.ts`, `lane-camera-stub-cli.ts`, `lane-camera-stub.test.ts`; `test/support/fake-onvif-stub.ts`
- NEW `apps/core-server/test/static/lane-camera-stub.test.ts`
- NEW `apps/core-server/src/modules/capture-discovery/__tests__/lane-camera-stub.db.test.ts`
- NEW `apps/core-server/src/modules/devices/__tests__/simulated-no-source-class.db.test.ts`
- `apps/core-server/src/modules/capture-inputs/{routes,index}.ts`, `__tests__/{routes.test,no-device.db.test}.ts`
- `apps/core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts`
- `apps/core-server/package.json` (script `start:camera-stub`), `scripts/lane/lane.sh`
- `packages/shared/src/api/capture-discovery.ts`, `packages/shared/openapi/openapi.json`, `packages/shared/src/sim/capture-config.ts`, NEW `packages/shared/test/sim-capture-config-sending-device.test.ts`

Web: `apps/core-web/src/features/devices/**` (new `camera-preview.tsx`, four new tests under `__tests__/`), blocks in `session-new/{index,devices-step,ready-step}.tsx`, `dashboard/{active-session-panel,devices-panel}.tsx`, `session-monitor/{inputs-panel,live-feed-panel}.tsx`; one appended block in `packages/shared/src/i18n/en/devices.ts`.

Mobile: `apps/mobile/src/features/capture-selector/**` (new `settled-busy-state.ts`, wave-h tests), `apps/mobile/src/features/devices/**` (new `camera-preview.tsx`, wave-h tests), blocks in `dashboard/device-tiles.tsx`, `session-new/{device-previews,session-new-screen,devices-check-step}.tsx`, `session-live/live-feed.tsx`.

## Blockers
None. Open items and decisions: note sections 4 and 5. Requests: `file_requests.md` (wave H D lines).
