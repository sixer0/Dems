# coder-execution — row 68 (M4-W4 tablet/phone selector)

- Status: **needs-review** — software complete and green; device checks (M4-SEL-T, M4-SEL-P) not run by rule; LIVE ops 79/80 unproven until row 66; camera clock offsets are a seam (ruling needed).
- Note: `implementation/28_m4_mobile_selector.md`
- Results: mobile typecheck exit 0; lint 0 errors; 56 suites / 476 tests passed (`--maxWorkers=2`, touched folders + static guards).

## Files (apps/mobile/src)

New: `features/capture-selector/` — `capture-selector-model.ts`, `capture-selector-port.ts`, `use-capture-selector.ts`, `capture-selector.tsx`, `capture-source-sheet.tsx`, `settings-capture-section.tsx`, `camera-clock-card.tsx`, `i18n.ts`, and tests `capture-selector-model.test.ts`, `capture-selector.test.tsx`, `settings-capture-section.test.tsx`, `camera-clock-card.test.tsx`; `features/session-new/precheck-mic-roles.test.ts`; `features/network-time/camera-clocks.test.ts`; `features/audit/audit-capture-labels.test.ts`.

Modified: `features/devices/devices-screen.tsx`, `features/devices/device-detail.tsx`, `features/settings/section-body.tsx`, `features/settings/settings-model.ts`, `features/settings/settings-controls.tsx`, `navigation/params.ts`, `i18n/features.ts`, `features/session-new/check-icon.tsx`, `features/session-new/session-new-model.ts`, `features/session-new/devices-check-step.tsx`, `features/network-time/network-time-model.ts`, `features/network-time/network-time-screen.tsx`, `features/audit/audit-model.ts`, `features/audit/audit-entry-detail.tsx`.

Pins moved: `navigation/__tests__/navigation-units.test.ts`, `features/settings/settings-model.test.ts`, `features/settings/settings-screen.test.tsx`, `features/more/more-screen.test.tsx`.

Not mine in `git status apps/mobile`: `app/(app)/session/live.tsx`, `runtime/index.ts`, `runtime/session-diagnostics*`, `features/session-live/live-late-stop-handover-mark.test.tsx` (row 62), `features/transcription/` (row 118).

## Mediated requests applied (D95)
- Row 118: import + `case 'transcription'` in `section-body.tsx`; its three earlier edits kept; three pins moved.

## Open for the controller
1. Camera clock offsets source (replicated `time` slice vs. one read of op 57).
2. Pre-check pair `MIC_1/MIC_2` vs `MIC_PRIMARY/MIC_STANDBY` in shared `PRECHECK_ORDER` (with row 67).
3. `masterplan/02_plan.md` M4-W4 tracking left to the controller.
