# coder-execution — row 139 (R-10 situation C: session start with cameras not connected)

Status: **needs-review** (built and tested in this row's folders; four wiring points are in foreign
folders and filed as requests). Date 2026-10-09. No commit, no migration, no device / browser run.
Note: `implementation/70_r10_session_start_situation_c.md`.

## Files

New:
- `apps/core-server/src/capture-notices/session-start.ts`
- `apps/core-server/src/capture-notices/__tests__/session-start.test.ts`
- `apps/core-server/src/capture-notices/__tests__/session-start.db.test.ts`
- `apps/core-web/src/features/session-monitor/__tests__/situation-c.test.tsx`
- `apps/mobile/src/features/session-live/capture-start-notice.tsx`
- `apps/mobile/src/features/session-live/situation-c.test.tsx`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/70_r10_session_start_situation_c.md`

Edited:
- `apps/core-server/src/capture-notices/index.ts`, `notifier.ts` (one comment)
- `packages/shared/src/i18n/en/common.ts` (one appended block `common.session`)
- `apps/core-web/src/lib/capture-notices.ts`
- `apps/core-web/src/features/session-monitor/{model.ts,status-banner.tsx,live-feed-panel.tsx,action-bar.tsx}`
- `apps/core-web/src/features/session-new/index.tsx`
- `apps/mobile/src/features/capture-selector/capture-notices-model.ts`
- `apps/mobile/src/features/session-live/{use-monitor.ts,session-live.math.ts,status-strip.tsx,end-session.tsx,live-feed.tsx,session-live-screen.tsx}`
- `delegation_progress/file_claims.md` (2 lines), `file_requests.md` (5 lines)

## Results (each once)

- core-server unit `src/capture-notices`: 33 / 33; db `session-start.db.test.ts`: 4 / 4.
- core-web `situation-c.test.tsx` 8 / 8; folders `session-monitor`, `session-new` + devices notices test 90 / 90.
- mobile `situation-c.test.tsx` 9 / 9; `session-live` folder + notices model 194 / 194.
- shared i18n pins 50 / 50. Typecheck and lint: nothing in this row's files.
- Foreign reds seen: `modules/sessions/__tests__/static.test.ts` x2; typecheck `packages/shared/src/sim/api.ts:496`, `packages/shared/test/live-source-bindings.test.ts:89`.

## Blockers / decisions

No blocker. Decisions 1-9 in the note, section 4. Requests: 5 lines in `file_requests.md`
(listener at boot; alert params `reason` / `evidenceFiles`; simulator member + Live `details`;
mobile recovery screen for a failed start; alert centre / Dashboard / Home wording).
