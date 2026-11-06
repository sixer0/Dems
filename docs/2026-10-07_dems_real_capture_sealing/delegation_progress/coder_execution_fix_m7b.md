# coder-execution — fix pass F-M7b (rest of review row 88)

**Status: needs-review — PARTIAL.** Item 1 and controller decision D185 (a)-(d) are done; items 2,
3 (except one line), 4 and 5 are NOT DONE. Stopped cleanly after a finished item. No commit, no
migration, no OpenAPI run.

Note: `implementation/113b_fix_m7_review_rest.md` (table, runs, what is not proven, checks for the
test runner, decisions).

## Done

- Item 1 — ruling D183 (durable prefix of a part-bad camera file sealed as INTERRUPTED, whole
  original to quarantine); R88-02 (a) bounded in-process retry (5 s / 30 s / 120 s), again at boot,
  on demand through the recovery operation; R88-02 (c) terminal UNSEALABLE (journal closed, files
  moved to `.quarantine/<sessionId>/`, engine door, one CRITICAL alert + one audit row, boot line,
  Core free); simulator parity; web + mobile state wording.
- D185 (a) verify notice `EXPORT_FOLDER_UNEXPECTED_FILE`; (b) engine file-list pin 21; (c) noted;
  (d) F-M8's export boot sweep read: it never enters `.quarantine/` or `.sealing/` and follows no
  link — no request line.
- Item 3: ONE line in `scripts/lane/lane.sh` only.

## Not done

- Item 2 (R88-05, open MAJOR), item 3 (boot refusals, 0700 creation of the media root, transcriber
  dir), item 4 (per-database keying: scratch path, session keys, facts file, signer — only read),
  item 5 (all MINORs), NOTEs.
- NOT RUN: seal e2e (its new case (c) has never run) and every kill-matrix cell — the heavy-host
  lock was held by fix F-M3 throughout. Commands in the note §5.

## Files

NEW
- `packages/shared/src/sim/seal-unsealable.ts`
- `packages/shared/test/sim-m7b-unsealable.test.ts`
- `apps/core-server/src/engine/unsealable-doors.ts`
- `apps/core-server/src/engine/__tests__/unsealable-doors.db.test.ts`
- `apps/core-server/src/sealing/pipeline/way-out.ts`
- `apps/core-server/src/sealing/__tests__/{pipeline-prefix,way-out}.test.ts`
- `apps/core-server/src/evidence-verify/__tests__/fix-m7b-export-notice.test.ts`
- `apps/core-web/src/features/session-monitor/{unsealable-notice.tsx,__tests__/unsealable-notice.test.tsx}`
- `apps/mobile/src/features/session-finalizing/{unsealable-notice.tsx,unsealable-notice.test.tsx}`

EDITED
- `packages/shared/src/sim/{session-machine.ts (seal block),index.ts}`, `packages/shared/src/i18n/en/common.ts` (appended block)
- `packages/shared/src/evidence-verify/{types.ts,verify.ts}`
- `apps/core-server/src/engine/{host.ts (own block + one type member),index.ts,__tests__/static.test.ts}`
- `apps/core-server/src/sealing/{index.ts,pipeline/pipeline.ts,pipeline/contract.ts}`
- `apps/core-server/src/sealing/__tests__/{pipeline.test.ts,pipeline-one-camera.test.ts,stt-states.test.ts}`
- `apps/core-server/src/sealing-host/{index.ts,__tests__/sealing-host.test.ts,__tests__/e2e/seal-e2e.db.test.ts}`
- `apps/core-server/src/modules/sessions/{routes.ts,__tests__/static.test.ts}` (foreign, declared first)
- `apps/core-web/src/features/session-monitor/finalization-modal.tsx`, `apps/core-web/src/features/evidence/__tests__/verify-v2-signing-key.test.tsx`
- `apps/mobile/src/features/session-finalizing/session-finalizing-screen.tsx`, `apps/mobile/src/features/session-recovery/session-recovery-screen.tsx`, `apps/mobile/src/features/evidence/verify-v2-signing-key.test.tsx`
- `scripts/lane/lane.sh`
- `delegation_progress/file_claims.md` (three lines)

## Request lines filed

None.

## Device / browser checks left for the gate (not run by a driver)

1. Web Session Monitor + tablet + phone: a session ended UNSEALABLE shows the sentence as a state
   (no error styling, no control) on the finalization / recovery view, and the CRITICAL alert.
2. A failed retriable seal shows "Sealing is being retried (retry n of 3, in s s). <cause>" on the
   failed step and moves on when the retry seals.
3. Recovery pressed on a FINALIZING session with a failed step: 202, the pipeline runs again.
