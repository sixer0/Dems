# coder-execution, wave H closing pass Z2 - progress

Status: needs-review. Note: `implementation/129_fix_wave_h_z2.md`. No commit, no git write, no formatter run.

## Files

NEW (core-web): `src/lib/own-capture.ts` ; `src/features/session-monitor/{capture-checkpoints.tsx,capture-checkpoints-model.ts,__tests__/wave-h-z2-own-capture.test.tsx}` ; `src/features/dashboard/__tests__/wave-h-z2-failed-start-event.test.tsx` ; `src/features/devices/__tests__/wave-h-z2-audio-card-lines.test.tsx` ; `src/features/session-new/__tests__/{wave-h-z2-countdown-sources,wave-h-z2-precheck-note}.test.tsx`.

EDITED (core-web): `features/session-monitor/{status-banner.tsx,storage-panel.tsx,timeline-panel.tsx,sim-adapter.ts,integrity-panel.tsx,__tests__/connecting-leftovers.test.tsx}` ; `features/dashboard/{dashboard-model.ts,recent-events-panel.tsx}` ; `features/devices/audio-input-card.tsx` ; `features/session-new/{index.tsx,model.ts,devices-step.tsx}`.

NEW (mobile): `src/features/session-live/{own-capture.ts,capture-checkpoints.tsx,wave-h-z2-own-capture.test.tsx,wave-h-z2-mic-lines.test.tsx}` ; `src/features/session-summary/wave-h-z2-time-source.test.tsx` ; `src/features/sessions/wave-h-z2-row-no-preview.test.tsx` ; `src/features/session-new/{wave-h-z2-footer-labels,wave-h-z2-countdown-sources,wave-h-z2-precheck-note}.test.tsx`.

EDITED (mobile): `runtime/{pending-control.tsx,pending-control.test.tsx}` ; `features/session-live/{session-live.math.ts,use-monitor.ts,status-strip.tsx,mic-card.tsx,action-tiles.tsx,end-session.tsx,mic-source-controls.tsx,live-session-live-link.test.tsx}` ; `features/session-summary/{summary.model.ts,use-summary.ts,session-summary-screen.tsx}` ; `features/sessions/session-row.tsx` ; `features/devices/{camera-preview.tsx,device-command-dialog.tsx,diagnostics-sheet.tsx,live-devices-sites.test.tsx}` ; `features/session-new/{session-new-screen.tsx,session-new-model.ts,devices-check-step.tsx,device-previews.tsx}` ; `features/session-recovery/session-recovery-screen.tsx` ; `features/settings/{maintenance-section.tsx,core-link-switch.tsx,settings-live-static.test.ts}` ; `features/capture-selector/capture-source-sheet.tsx` ; `features/storage/live-storage-sites.test.tsx` ; `features/audit/live-audit-screen.test.tsx` ; `navigation/back-guard.tsx`.

EDITED (shared, append-only blocks at the end of the file): `packages/shared/src/i18n/en/session.ts` (`captureFacts`), `dashboard.ts` (`captureStart`), `session-new.ts` (`precheckNote`).

Touched and taken back (diff empty): `apps/mobile/src/features/dashboard/use-home-data.ts`.

## Checks

core-web whole: 170 files / 2001 passed. mobile whole: 2609 passed / 1 failed (mine, a static pin; fixed, its file re-run: 14 passed). shared i18n: 50 passed. Typecheck core-web and mobile: 0 errors. Lint: core-web clean; mobile 0 errors, 1 warning (`runtime/log.test.ts:160`, not mine).

## Request lines

One answer line appended to `file_requests.md` (to Z1). No request to another owner was needed.
