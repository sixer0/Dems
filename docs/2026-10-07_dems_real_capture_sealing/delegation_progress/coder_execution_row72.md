# coder-execution — row 72 (M5-W2 web mic UI)

- Status: **needs-review** (code and automated tests complete; Live mode proven on the fake transport only; browser check M5-SW-W scripted, not run; panel layout not seen in a browser)
- Date: 2026-10-09
- Note: `implementation/31_m5_web_mic.md`

## Files

New:
- `apps/core-web/src/features/session-monitor/audio-source.ts`
- `apps/core-web/src/features/session-monitor/audio-source-controls.tsx`
- `apps/core-web/src/features/session-monitor/__tests__/audio-source.test.tsx`
- `apps/core-web/src/components/composed/audio-source-band.tsx`
- `apps/core-web/src/components/composed/audio-source-band.math.ts`
- `apps/core-web/src/test/live-session-monitor-audio-source.test.tsx`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/31_m5_web_mic.md`

Changed:
- `apps/core-web/src/features/session-monitor/{audio-panel.tsx,model.ts,status-banner.tsx,timeline-panel.tsx,session-monitor.css}`
- `apps/core-web/src/lib/core-queries.ts` (additive: op 82 gate, key, factory)
- `apps/core-web/src/components/composed/index.ts` (exports)
- `apps/core-web/src/features/dashboard/devices-panel.tsx` (WB-02 Active/Standby chip while recording)
- `apps/core-web/src/runtime/testing/live-harness.ts` (default answer of op 82)
- `packages/shared/src/i18n/en/session.ts` (one block `session.audioSource.*`, Edit tool)
- `docs/.../delegation_progress/file_requests.md` (one appended line: `captureDurable` schema member)

## Results

- core-web typecheck exit 0; lint exit 0.
- 36 targeted files / 405 tests passed (new: 20 + 6); shared i18n 50 passed.
- Negative control (role + holder lines removed from the gate): 4 red, restored.

## Open for the controller

- Request: `captureDurable` in the shared session schema (not blocking).
- Rulings wanted: D-72-1 (Active/Standby wording), D-72-2 (string namespace), the 403 holder wording in the shared presenter, the audit detail keys of the simulator vs C3 §5.2.
- Re-check list for rows 66/71 and the gate flow W-MIC: note §4 and §5.
