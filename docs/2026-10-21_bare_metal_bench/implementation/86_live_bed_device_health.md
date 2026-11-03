# Row 139 - Live bed default answer for getDeviceHealth

Status: complete.

## Changes
- apps/core-web/src/runtime/testing/live-harness.ts: after `answered('getServiceHealth', ...)`, added `answered('getDeviceHealth', () => fake.example('getDeviceHealth', 200, 'idle'))` (contract example, DEVICE_HEALTH_IDLE). A test's own `fake.answer('getDeviceHealth', ...)` replaces it.
- apps/core-web/src/features/devices/__tests__/selector-microphones.test.tsx: removed the `liveHealth()` helper and its 4 calls (`grep -c liveHealth` = 0).
- camera-connect-canary.test.tsx: not touched.

## Risk gate (apps/core-web, src/features/devices/__tests__ + src/test/live-*, --maxWorkers=2, 84 files)
- BEFORE: Tests 85 failed | 1183 passed (1268). Failing files: live-devices-capture-selector 9, live-devices-clip 10, live-devices-commands 17, live-devices-drawer 14, live-meter-clip-reset 5, live-strict-mode-starts 1, live-w0-camera-words 2, live-w0-device-log 1, camera-connect-canary 6, camera-no-preview 9, camera-profile 10, health-caption 1.
- AFTER: Tests 0 failed | 1268 passed (1268). No suite went pass to fail.
- Typecheck `npm run typecheck` (tsc -b) in apps/core-web: no output, clean.

Note: the default also turned the 11 other red files above green (same LCD-poll cause). Suites outside these two sets (other importers of the bed) were not run, per the gate.
