# coder-execution — row 71c (D153, D156)

Status: **needs-review**. Note: `implementation/30c_m5_real_session_stt_wiring.md`.

## Files

NEW (below `apps/core-server/src/`): `capture-session/facts.ts`, `transcription/session-run.ts`, `transcription/__tests__/session-run.test.ts`, `sealing-host/transcript-step.ts`, `sealing-host/__tests__/transcript-step.test.ts`.

EDITED: `capture-session/index.ts`, `capture-session/__tests__/session-capture.db.test.ts`, `transcription/index.ts`, `transcription/session.ts`, `sealing-host/index.ts`, `sealing-host/session-reader.ts`, `sealing-host/__tests__/sealing-host.test.ts`, `engine/capture-session.ts`, `engine/host.ts` (endCapture, two lines), `engine/types.ts` (endCapture signature), `capture/fence/__tests__/development-session.db.test.ts` (one word at :323, row 140's request as permission).

Docs: `implementation/30c_m5_real_session_stt_wiring.md`, this file; appended lines in `file_claims.md` (2) and `file_requests.md` (4).

NOT touched: `modules/stt-config/**`, `modules/sessions/**` (one line tried under D156, refused by rule M3, reverted), `sealing-host/__tests__/e2e/seal-e2e.db.test.ts`, `packages/shared/**`, any migration.

## Open, by owner

- Controller / spec: model provenance source (blocks ASSEMBLED in production); the no-snapshot manifest state (D-71c-2); where the boot call of `captureNotices(app)` goes (D156 item 1).
- Pass D4 / D6 + forwarder: `reason` / `evidenceFiles` at the capture fault raise (D156 item 2, the part a stored alert cannot take).
- Row 140: reword the title of its flipped case.

## Checks for the test runner

See the final response of the row; the list is section "Checks for the test runner" there and the commands of note 30c section 3.
