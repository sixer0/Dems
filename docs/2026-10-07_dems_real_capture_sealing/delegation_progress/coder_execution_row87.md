# coder-execution — row 87 (M7-W6: clients + verify + tamper demo + B9)

- **Status:** needs-review (2026-10-09). Software complete and green. Not proven: every device / browser check (B9's logcat result first), and anything against a package sealed by the Core (row 82).
- **Note:** `implementation/42_m7_clients_verify.md`
- **Blocking:** nothing for other rows.

## Files

New — web: `apps/core-web/src/features/evidence/{verify-v2.ts,verify-v2-report.tsx,__tests__/verify-v2.test.tsx,__tests__/fixtures/verify-v2-recorded.ts}`, `features/session-monitor/{sealing-progress.ts,__tests__/sealing-progress.test.tsx}`, `src/test/live-row87-verify-v2.test.tsx`.

New — mobile: `apps/mobile/src/features/evidence/{verify-v2.ts,verify-v2-report.tsx,verify-v2.test.tsx,live-evidence-verify-v2.test.tsx,testing/verify-v2-recorded.ts}`, `features/session-finalizing/{sealing-progress.ts,sealing-progress.test.ts,finalizing-forward-only.test.tsx}`.

Changed — web: `features/evidence/{use-verification.ts,integrity-tab.tsx,export-wizard.tsx}`, `features/session-monitor/finalization-modal.tsx`.

Changed — mobile: `features/evidence/{live-integrity-tab.tsx,live-evidence-static.test.ts}`, `features/session-finalizing/{session-finalizing-screen.tsx,session-finalizing-screen.test.tsx,finalization-pipeline.tsx,finalizing.model.ts,sealed-stamp.tsx}`, `features/session-summary/{session-summary-screen.tsx,summary-live-static.test.ts}`.

Changed — shared (Edit tool, additive): `packages/shared/src/i18n/en/evidence.ts` (block `verifyV2`), `i18n/en/session.ts` (4 keys in `finalization`), `sim/demo-alignment.ts` (2 constants).

Not in git (git-ignored `.cache/row87/`): `gen-fixture.mts` (records the real verifier's answers), `mutation-red.py` (18 mutants).

## Results

- typecheck: core-web 0, mobile 0; shared 1 foreign known error (`test/evidence-package.test.ts:453`). Lint: 0 errors in the three workspaces.
- web 23 files / 224 tests, mobile 47 suites / 383 tests, each run twice; shared 5 files / 87 tests; static guards of both apps included.
- 18 of 18 mutants red (FAIL drawn as PASS; progress moved by a timer; rewind; made-up ETA; B9).

## Requests filed (`file_requests.md`, 11:28:04Z, both non-blocking)

1. session-recovery: draw Finalizing in place when a RECOVERY turns FINALIZING (MB-06).
2. v2 demo regeneration: alter EV-0005 at `DEMO_TAMPERED_FRAGMENT_TRACK` / `_SEQ`.

Already filed by rows 85 / 119 and awaited here: the op 41 schema members `overall`, `interrupted`, `checks`, `fragments`, `transcriptState`.

## Decisions taken

D-87-1 .. D-87-6 in the note §7. The one that changes what an operator sees: on the monitor -> Finalizing hand-over the pipeline no longer animates (D-87-1).
