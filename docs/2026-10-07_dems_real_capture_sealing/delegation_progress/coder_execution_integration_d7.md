# coder-execution — integration pass D7

Status: **needs-review** (2026-10-10). Note: `implementation/101_integration_pass_d7.md`.

Items: 1 done, 2 done, 3 done (web 2 groups, mobile 4 groups), 4 done, 5 done as a check (Dashboard
tile fixed; the web Monitor's recovery overlay on the close of a failed start is filed, not changed).

Edited (mobile): `src/features/session-recovery/session-recovery-screen.tsx`,
`src/features/session-recovery/testing/recovery-harness.tsx`, `src/app/(app)/session/recovery.tsx`,
`src/features/dashboard/{system-status-card.tsx,home-header.tsx,home-model.ts}`,
`src/components/composed/nav/live-mini-bar.tsx`,
`src/features/sessions/{hub-top.tsx,session-status-chip.tsx,session-row.tsx}`,
`src/features/session-live/mic-card.tsx`.
New (mobile tests): `src/features/session-recovery/{failed-start.test.tsx,recovery-finalizing-handover.test.tsx}`,
`src/features/dashboard/session-start-home.test.tsx`, `src/features/sessions/session-start-hub.test.tsx`,
`src/features/session-live/connecting-meters.test.tsx`.

Edited (web): `src/components/shell/notifications-bell.tsx`,
`src/features/dashboard/{sim-adapter.ts,system-ring-panel.tsx,hero-panel.tsx,active-session-panel.tsx}`,
`src/features/session-monitor/{audio-panel.tsx,model.ts}`.
New (web): `src/components/shell/failed-start-alert.ts`,
`src/features/dashboard/__tests__/session-start-d7.test.tsx`,
`src/features/session-monitor/__tests__/connecting-leftovers.test.tsx`.

Shared files: `delegation_progress/file_claims.md` (three lines), `file_requests.md` (two lines).
No shared i18n, api, sim or live edit.

Results: mobile 85 tests in the files written or touched, web 5; typecheck mobile 0, web 7 foreign
(row 139's `situation-c.test.tsx`); lint 0 errors in both.

Open for the controller: the two request lines; decisions 1-7 of the note; flows F5-F9 for gate 75.

## Follow-up D158 (2026-10-10) — needs-review

Items 1-4 done. Edited (web): `features/session-monitor/{index.tsx,model.ts,status-banner.tsx,live-feed-panel.tsx,__tests__/situation-c.test.tsx}`,
`features/system/demo-panel.tsx`. New (web): `features/session-monitor/__tests__/failed-start-close.test.tsx`,
`features/system/__tests__/demo-failed-start.test.tsx`. Edited (mobile): `features/dashboard/quick-actions.tsx`,
`features/sessions/{sessions-model.ts,session-detail.tsx}`, the two D7 test files (one case / two assertions added).
Results: web typecheck exit 0; new tests green; item 1 red before the fix; one foreign red
`session-monitor/__tests__/audio-source.test.tsx:255` (audio-source band, not this pass).
