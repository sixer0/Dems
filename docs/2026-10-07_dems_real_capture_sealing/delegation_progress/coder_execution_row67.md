# coder-execution — row 67 (M4-W3 web selector + query factories)

Status: **needs-review** (code and automated tests done; real-Core and browser checks wait for row 66 and the gate; one ruling asked, see note §4.4)
Date: 2026-10-09
Note: `implementation/27_m4_web_selector.md`

## Files created
- apps/core-web/src/features/devices/capture-selector.ts
- apps/core-web/src/features/devices/capture-selector-panel.tsx
- apps/core-web/src/features/devices/__tests__/capture-selector.test.tsx
- apps/core-web/src/test/live-devices-capture-selector.test.tsx
- docs/2026-10-07_dems_real_capture_sealing/implementation/27_m4_web_selector.md
- docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_row67.md

## Files changed
- apps/core-web/src/lib/core-queries.ts (capture gate, factories, slice refresh; row 117's superseded additions removed on its request)
- apps/core-web/src/runtime/query-bridge.ts (two keys)
- apps/core-web/src/runtime/testing/live-harness.ts (default answers for ops 76/77)
- apps/core-web/src/test/live-runtime-bridge.test.tsx (key pin)
- apps/core-web/src/features/devices/{index.tsx,panel.tsx,motion.ts,devices.css}
- apps/core-web/src/features/system/settings-panel.tsx (selector entry link; row 117 mount in two-line form)
- apps/core-web/src/features/dashboard/devices-panel.tsx (mic role chip)
- apps/core-web/src/features/storage/kpi-cards.tsx (Live write-rate caption)
- apps/core-web/src/features/session-new/{devices-step.tsx,model.ts} (MIC_PRIMARY / MIC_STANDBY)
- packages/shared/src/i18n/en/devices.ts (block `selector`)
- packages/shared/src/i18n/en/system.ts (removed unused `settings.transcription`, per controller)

## Results
- core-web typecheck exit 0; lint 0 warnings.
- Touched tests + static guards: 39 files / 506 tests passed; new tests 22 passed; shared i18n tests 50 passed.
- Negative control run (gate rules removed → 5 red), restored.

## Open for the controller
1. Audit row "permission" key: R-1 AC-1 / M4-SEL-W vs C3 §5.2 key list (simulator writes none).
2. Existing camera kebab Restart sends no `{ confirm: true }` (shared Live source) — will be refused if row 66 enforces OD-22.
3. `sourceClass` is not in the shared slice schema; badge left to its row.
4. Shared "Checking your permissions..." key for web + mobile, or keep per-namespace.
5. Early i18n inserts were scripted before D95 arrived (disclosed in the note §6).
