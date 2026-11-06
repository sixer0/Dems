# coder-execution — fix F-M4 (review row 69)

Status: **complete** (2026-10-10). No commit, no migration, no lockfile write, no new dependency.
Note: `implementation/115_fix_m4_review.md` (table, decisions, commands, gate flows).

Sub-agents of this row: mobile half (R69-01, R69-02, R69-07, one comment) and web Session New half
(R69-01, R69-02 confirmation, R69-07, comments). Each appended its own line to `file_claims.md`.

## Files

Core server (`apps/core-server/`)
- `src/capture/fence/{sources.ts,index.ts}`, `__tests__/fence.test.ts`
- `src/capture/adapters/{types.ts,index.ts,camera/onvif-session.ts}`, `__tests__/static.test.ts`, `camera/__tests__/onvif-session.test.ts`
- `src/db/mapping/{rows.ts,from-rows.ts,index.ts}`, `__tests__/from-rows.test.ts`
- `src/db/seed/{demo-helper.ts,demo-core.ts}`, NEW `__tests__/demo-helper.test.ts`
- `src/credential-store/{envelope.ts,index.ts}`
- `src/modules/devices/source-facts.ts`, `__tests__/{source-class.db.test.ts,static.test.ts}`
- `src/modules/capture-discovery/{search.ts,store.ts,connect/service.ts,connect/index.ts}`, `__tests__/search.test.ts`, `connect/__tests__/service.test.ts`
- FOREIGN, declared in `file_claims.md` before the edit, own lines only: `src/engine/{host.ts,index.ts,rehydrate.ts}`; `test/acceptance/demo-seed-v2.test.ts` (one pin)

Shared (`packages/shared/`)
- `src/api/capture-discovery.ts` (two optional members, one closed list, one pattern), `openapi/openapi.json` (generator, under `.locks/npm.lock`)
- `src/i18n/en/common.ts` (two appended blocks: `localSourceNotice`, `captureConnectTarget`)
- NEW `test/capture-connect-target.test.ts`

Web (`apps/core-web/src/`)
- `features/devices/{camera-connect-dialog.tsx,camera-connect.ts,camera-search-panel.tsx,devices.css,source-badge.tsx,source-class.ts,registered-devices-model.ts,capture-selector-panel.tsx}`
- NEW `features/devices/{local-source-gate.ts,local-source-notice.tsx}`, `features/devices/__tests__/local-source-notice.test.tsx`
- `features/devices/__tests__/camera-connect-canary.test.tsx`
- `features/session-new/index.tsx` (shared hot file, own lines)
- NEW `test/{live-session-new-local-notice,live-local-source-on}.test.tsx`

Mobile (`apps/mobile/src/features/`)
- `capture-selector/{development-source-badge.tsx,capture-source-sheet.tsx}`; NEW `capture-selector/{local-source-notice-model.ts,local-source-notice.tsx,open-local-sources.tsx}` and six test files
- `devices/{registered-devices-model.ts,registered-devices-model.test.ts}`
- shared hot files, own lines: `session-new/{use-session-new.ts,session-new-screen.tsx}`, `session-live/session-live-screen.tsx` (+3 lines)

Specs: errata PE-FM4-01 (`masterplan/03_api_contract.md` §2.6, `08_client_ux_spec.md` §8d.3) and PE-FM4-02 (`08` §8d.3).

## Open

- R69-09 (replaced credential keys are never destroyed): recorded gap, not built.
- R69-08 seeder half: fix F-M7's file.
- R69-07 alert body wording: needs the worker's behaviour at the rate limit.
- Decisions 3, 4 and 6 of the note want a word from the controller.
- Browser and device flows: gate 70 / gate 75 lists in the note.
