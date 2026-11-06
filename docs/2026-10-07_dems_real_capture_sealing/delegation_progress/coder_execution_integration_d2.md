# Integration pass D2 (client seams) — coder-execution

Status: **needs-review** — items 1-7 done in software; open: `tsc -b` of core-web is red on one foreign
line (`packages/shared/src/sim/types.ts(20,3)` TS6196, pass D1b in flight); meters / role chips of a
third microphone and the fixed Devices roster are not built (note §4).

Note: `implementation/96_integration_pass_d2.md`. Baseline `e296ce7`. No commit.

## Files

New:
- `apps/mobile/src/features/capture-selector/mic-input-name.ts`
- `apps/mobile/src/features/capture-selector/mic-input-name.test.ts`
- `apps/mobile/src/features/capture-selector/development-source-rule.test.tsx`
- `apps/mobile/src/features/dashboard/development-source-tiles.test.tsx`
- `apps/mobile/src/features/session-live/development-source-mounts.test.tsx`
- `apps/core-web/src/test/live-d2-client-seams.test.tsx`
- `apps/core-web/src/features/devices/__tests__/mic-input-name.test.tsx`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/96_integration_pass_d2.md`

Edited (mobile): `features/capture-selector/{capture-notices-model.ts,capture-notices-model.test.ts,development-source-badge.tsx,capture-source-sheet.tsx,capture-selector.tsx,use-capture-selector.ts,use-camera-search.tsx,camera-search-panel.tsx}`;
`features/session-live/{mic-card.tsx,live-feed.tsx,mic-source-model.ts,mic-source-model.test.ts,use-mic-source.ts,mic-source-controls.tsx}`; `features/dashboard/device-tiles.tsx`.

Edited (web): `features/devices/{source-class.ts,source-badge.tsx,capture-notices.tsx,__tests__/camera-connect-canary.test.tsx}`;
`features/dashboard/devices-panel.tsx`; `features/system/settings-panel.tsx`;
`features/session-monitor/{audio-panel.tsx,live-feed-panel.tsx,audio-source.ts,audio-source-controls.tsx,timeline-panel.tsx}`;
`components/composed/{audio-source-band.tsx,audio-source-band.math.ts}`; `lib/capture-notices.ts`; `test/live-dashboard-devices.test.tsx`.

Edited (shared): `packages/shared/src/i18n/en/common.ts` (one appended block `captureDeviceName`).

Edited (task folder): `delegation_progress/file_claims.md` (three lines of pass D2).

Not touched: `features/evidence/**` of both apps; `status_tasks.md`; `masterplan/02_plan.md`; `delegation_progress_report.md`.

## Results

See the note §2. Own and touched test files green (mobile 6 suites / 45 tests + log test 32; web 5 files / 53 tests incl. item 6's 22); mobile typecheck clean; lint of both apps 0 errors; web typecheck blocked by the one foreign error, 0 errors in core-web files.

## Decisions for the controller

Note §4 items 1 (which member maps a meter channel to a mic input), 2 (roster), 3 (wording "Microphone 3" vs "MIC 3"), 5 (edits outside §9 made under the brief's items 2 and 5).
