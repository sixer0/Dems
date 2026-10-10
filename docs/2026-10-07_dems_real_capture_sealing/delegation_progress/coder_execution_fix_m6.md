# coder-execution — fix pass F-M6 (review row 80 + R93-02 / D178)

- Status: **needs-review** (4 MAJOR + the BLOCKER closed with red-then-green tests; R80-06 half closed; R80-05 / -08 / -10 open on a ruling; heavy runs handed to the test runner).
- Note: `implementation/111_fix_m6_review.md` (table, commands, decisions, checks for the test runner).
- No commit. No migration. STT server never called; no LOCAL_DEVICE selector.

## Files

NEW
- `packages/shared/test/sim-transcript-summary.test.ts`
- `apps/core-server/src/transcription/scratch.ts`, `src/transcription/__tests__/scratch.test.ts`
- `apps/core-server/src/db/reset/transcriber-scratch.ts`, `src/db/reset/__tests__/transcriber-scratch.test.ts`
- `apps/core-server/src/sealing/__tests__/seal-summary.test.ts`
- `apps/core-server/src/modules/transcripts/__tests__/summary-at-boot.test.ts`
- `apps/mobile/src/features/evidence/transcript-states.test.tsx`

EDITED
- `packages/shared/src/sim/{types.ts,core-facts.ts,session-machine.ts}`, `packages/shared/src/i18n/en/evidence.ts` (two keys appended)
- `apps/transcriber/src/pipeline/runner.ts`, `apps/transcriber/src/__tests__/{static-rules.ts,static.test.ts}`
- `apps/core-server/src/transcription/{session.ts,session-run.ts,index.ts}`, `__tests__/{support.ts,session.test.ts,session-run.test.ts}`
- `apps/core-server/src/sealing/finalize-transcript/commit.ts`, `src/sealing/__tests__/stt-states.test.ts` (one member)
- `apps/core-server/src/sealing-host/{index.ts,transcript-step.ts,session-reader.ts}`, `__tests__/transcript-step.test.ts`, `__tests__/e2e/seal-e2e.db.test.ts` (one assertion, not run)
- `apps/core-server/src/transcript-package/index.ts`
- `apps/core-server/src/modules/transcripts/{heads.ts,routes.ts,store.ts}`, `__tests__/transcript-routes.db.test.ts`
- `apps/core-server/src/modules/transcript-chunks/{statements.ts,index.ts}`, `__tests__/{store.test.ts,transcript-chunks.db.test.ts}`
- `apps/core-server/src/db/reset/routine.ts`, `src/db/reset/__tests__/static.test.ts` (file list)
- `apps/core-server/src/engine/fact-doors.ts` (comment only)
- `apps/core-web/src/features/evidence/{transcript-model.ts,transcript-pane.tsx}`, `__tests__/transcript.test.tsx`
- `apps/mobile/src/features/evidence/{transcript-model.ts,transcript-pane.tsx,export-job.test.ts}`
- `docs/.../delegation_progress/file_claims.md` (three lines)

## Blockers / decisions
See section 5 of the note. The one that is new and not in any review: transcriber scratch is keyed by data directory + session ID while the lanes share the data directory.
