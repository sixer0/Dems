# coder-execution - fix wave I, driver C (apps/mobile) - 2026-10-10

Status: **needs-review** (G75b-05 is provable only by logcat on a device; `checkedAt` of contract note A2 section 4 has not landed). Note: `implementation/134_fix_wave_i_c.md`.

| Finding | State |
|---|---|
| G75b-02 (MAJOR) Finalizing / Home / Sessions / New Session on a blocked seal | done in tests |
| G70b-03 selector rows read "busy" | done in tests |
| G70b-04 / G75b-09 Home recent thumbs | done in tests |
| G75b-06 mobile half (time chip) + Home microphone state + G70b-06 camera line word | done in tests ("Not checked" on the pure rule only) |
| G75b-05 Reanimated mount warnings | done in tests; hypothesis until logcat = 0 |
| G70-08 tablet (stale vs unknown) | rule confirmed; one gap fixed (Confirm re-checks) |
| G75b-08 mobile half | done in tests |

Created (apps/mobile/src): features/capture-selector/{source-state.ts, wave-i-c-row-labels.test.tsx, wave-i-c-source-state.test.ts, wave-i-c-sources-stale.test.tsx}; features/dashboard/{wave-i-c-home-real-capture.test.tsx, wave-i-c-seal-blocked-home.test.tsx}; features/session-finalizing/{seal-attention.tsx, wave-i-c-seal-blocked.test.tsx}; features/session-live/wave-i-c-timeline-connecting.test.ts; features/session-new/wave-i-c-no-removed-spinner.test.tsx; features/sessions/wave-i-c-seal-blocked-hub.test.tsx; navigation/wave-i-c-new-session-blocked.test.tsx.

Changed (apps/mobile/src): features/capture-selector/{capture-selector.tsx, i18n.ts, local-source-notice.tsx}; features/dashboard/{device-tiles.tsx, home-model.ts, quick-actions.tsx, recent-sessions.tsx, status-tiles.tsx, system-status-card.tsx, use-home-data.ts}; features/session-finalizing/{i18n.ts, session-finalizing-screen.tsx}; features/session-live/{session-live.math.ts, use-monitor.ts}; features/session-new/{devices-check-step.tsx, session-new-screen.tsx}; features/session-summary/summary-live-static.test.ts (two pins, one name each); features/sessions/{hub-top.tsx, session-status-chip.tsx}; navigation/{i18n.ts, session-guards.ts}.

Docs: implementation/134_fix_wave_i_c.md; delegation_progress/file_claims.md (two lines); this file. No request line filed. Not touched: packages/shared, apps/core-server, apps/core-web, components/composed/stepper.tsx, runtime/**.

Proof run by the driver: the 10 new files (73 tests) green; the existing files of the touched folders green; mobile typecheck 0 errors; lint 0 errors (1 known warning).
