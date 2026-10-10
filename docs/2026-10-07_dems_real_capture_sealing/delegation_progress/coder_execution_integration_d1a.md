# coder-execution — integration pass D1a

- Status: **complete** (items 1-6 done; item 7 a written finding, no code, as briefed). No commit.
- Report: `implementation/94_integration_pass_d1a.md`
- Files changed: `apps/core-server/src/core/audit-details.ts`; `apps/core-server/src/modules/capture-discovery/connect/service.ts`; `apps/core-server/src/modules/capture-discovery/connect/__tests__/service.test.ts`; `apps/core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts`; `apps/core-server/src/capture/adapters/__tests__/credential.test.ts`; `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts`; `apps/core-server/test/db/set4-rules.test.ts`; `packages/shared/src/api/redaction.ts`; `packages/shared/test/redaction.test.ts`; `delegation_progress/file_claims.md` (two lines appended).
- Not touched: `adoption.ts`, `credential-store/**`, `capture/adapters/camera/**`, `apps/core-web/**`, any migration, `app.ts` / `config.ts` / `index.ts`.
- Results: unit 29 files / 434; db 3 files / 61 (under `.locks/db-migrate.lock`); shared redaction 57; shared typecheck + lint clean; core-server lint 0 errors; core-server typecheck red with 21 errors in 13 files of other in-flight rows, none in this pass's files.
- Blockers: none. Decisions and runner checks: see the report.

## Follow-up D134 — status: complete
- F1 server log member-name layer (shared rule reused), F2 second guard removal, F3 writers table lines: done; erratum sentence written into the note.
- Files: `apps/core-server/src/plugins/logger/logger-options.ts`; `.../logger/__tests__/member-blanking.test.ts` (new); `.../logger/__tests__/log-capture.test.ts` (one block, forced — to confirm); `apps/core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts`; `apps/core-server/src/core/__tests__/writers.test.ts`; `file_claims.md` (lines 3 and 4).
- Results: unit 1868 passed / 4 red pins of other rows' new folders; db 3 files / 43 passed; lint 0 errors; no typecheck error in this pass's files.

## Follow-up D144 — status: complete
- `apps/core-server/src/core/audit-details.ts` (`fromInput` / `toInput` -> shared `MIC_INPUT_ID_PATTERN`), `apps/core-server/src/core/__tests__/writers.test.ts` (valid + invalid cases); 94 passed. Open: `inputId` of `CAPTURE_CONFIG_CHANGED` and `MIC_SILENT` still the first pair only.

## Follow-up D145 — status: complete
- `inputId` of `CAPTURE_CONFIG_CHANGED` and `MIC_SILENT` -> shared `MIC_INPUT_ID_PATTERN`; no other `MIC-01 | MIC-02` literal left in `audit-details.ts`. `writers.test.ts` 94 passed.
