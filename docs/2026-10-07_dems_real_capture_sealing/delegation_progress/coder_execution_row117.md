# coder-execution — row 117 (web STT configuration menu, R-8)

Status: **needs-review** (2026-10-09) — built and tested in isolation; the mount line and the
removal of pre-D95 edits wait on row 67 (`file_requests.md`, three lines at 09:35:01Z).

## Files created
- `apps/core-web/src/features/system/stt-config-section.tsx`
- `apps/core-web/src/features/system/stt-config-model.ts`
- `apps/core-web/src/features/system/stt-config-queries.ts`
- `apps/core-web/src/features/system/__tests__/stt-config-model.test.ts`
- `apps/core-web/src/test/live-system-stt-config.test.tsx`
- `apps/core-web/src/test/live-system-stt-secret.test.tsx`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/56_m6_stt_config_web.md`

## Files changed
- `packages/shared/src/i18n/en/system.ts` — block `stt` (`:340-412`); one key outside it, `settings.transcription` (pre-D95, scripted insert).
- `docs/.../delegation_progress/file_requests.md` — three appended lines.

## Edits made before D95 in files row 67 owns (not touched again)
- `apps/core-web/src/features/system/settings-panel.tsx` — `useState` import, `Mic` import, `SttConfigSection` import, `sttOpen` state with a 2-line comment, `onExpandedChange` prop on the `<Accordion>`, `<Item id="transcription">` after the `device` item.
- `apps/core-web/src/lib/core-queries.ts` — doc-table row for `STT_CONFIG_QUERY_KEY`, `SttConfig` and `CORE_QUERY_ROOT` imports, `'getSttConfig'` in `CoreReadOperation`, trailing block (`STT_CONFIG_QUERY_KEY`, `useSttConfigGate`, `readSttConfig`, `sttConfigQueryOptions`). Now unused.

## Results
- typecheck core-web: 0 errors. Lint: nothing in the row's files.
- 72 tests in the 3 new files pass; the System folder static rules, `live-runtime-static`, `integrity-checks`, `live-runtime-sink`, `core-queries`, `system-page` pass.
- Red, not mine: `live-static-ac-c-53.test.ts` — `features/devices/capture-selector.ts: m.actions` (row 67).
- Mutation check of the credential canary: 7 red when leaking, green after revert.

## Not done / not proven
- No browser run (M6-STTCFG-WEB flows F1-F6 listed in the implementation note §6).
- Ops 90-92 not exercised against a booted Core.
- Whole-workspace suite not run (D94).

## Decisions for the controller
See implementation note §7 (seven items); the ones that need a ruling: Simulated mode shows a note only; the "Checking your permissions…" key lives in `system.stt`; credential is dropped on a failed save too.
