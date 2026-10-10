---
task_slug: dems_real_capture_sealing
row: 92
agent: coder-execution
date: 2026-10-09
status: needs-review
note: implementation/45_m8_playback_ui.md
---

# Row 92 — status and files

Status: **needs-review**. Software complete; typecheck 0 / lint 0 errors in core-web, mobile, shared; web 23 files / 205 tests, mobile 25 suites / 197 tests (the static suite re-run alone after a pin repair), shared i18n 50. Nothing run in a browser or on a device. Mobile playback is behind one runtime member (request filed, blocking for M8-PB-T / -P only).

## Files

Web `apps/core-web/src/features/evidence/`
- new: `item-v2.ts`, `development-source.tsx`, `media-session.ts`, `sealed-playback.ts`, `sealed-player.tsx`, `audio-source-band.tsx`, `transcript-model.ts`, `transcript.ts`, `transcript-pane.tsx`, `transcript-revise-dialog.tsx`, `export-job-model.ts`, `export-job.ts`, `export-job-status.tsx`, `__tests__/{item-v2,sealed-playback,media-session-canary,transcript,export-job}.test.tsx`
- edited: `verify-v2.ts`, `verify-v2-report.tsx`, `detail-page.tsx`, `evidence-table.tsx`, `export-wizard.tsx`, `evidence.css`, `__tests__/verify-v2.test.tsx`, `__tests__/fixtures/verify-v2-recorded.ts`, `__tests__/live-evidence-bed.ts`
- outside the folder: `apps/core-web/vite.config.ts` (one proxy entry), `src/test/{live-row87-verify-v2,live-evidence-archive,live-runtime-static}.test.tsx` (pins by delta)

Mobile `apps/mobile/src/features/evidence/`
- new: `item-v2.ts`, `development-source.tsx`, `media-session.ts`, `sealed-playback.ts`, `sealed-player.tsx`, `audio-source-band.tsx`, `transcript-model.ts`, `transcript.ts`, `transcript-pane.tsx`, `transcript-revise-sheet.tsx`, `export-job-model.ts`, `export-job.ts`, `export-job-status.tsx`, `item-v2.test.ts`, `sealed-playback.test.ts`, `export-job.test.ts`, `media-session-canary.test.tsx`
- edited: `verify-v2.ts`, `verify-v2-report.tsx`, `verify-v2.test.tsx`, `testing/verify-v2-recorded.ts`, `testing/live-evidence-bed.tsx`, `evidence-detail.tsx`, `evidence-row.tsx`, `export-sheet.tsx`, `live-integrity-tab.tsx`, `live-evidence-verify-v2.test.tsx`, `live-evidence-static.test.ts`
- `apps/mobile/src/features/session-summary/`: new `sealed-members.tsx`, `sealed-members.test.tsx`; edited `session-summary-screen.tsx` (one mount), `summary-live-static.test.ts` (+1 file)

Shared: `packages/shared/src/i18n/en/evidence.ts` (additive).
Docs: `implementation/45_m8_playback_ui.md`, this file; `file_claims.md` (3 lines), `file_requests.md` (5 lines).

## Requests filed (`file_requests.md`)

1. op 88 request body `{ fileId }` (now answered by row 90 / D1b; the client already sends it).
2. op 42 answer vs op 87 job id (`jobId` on the 202).
3. No download operation; no `kind` through the hosted export action.
4. Mobile runtime: `mediaTransport()` on the Live source — **blocking for M8-PB-T / -P**.
5. `ExportRequest.kind` + `EXPORT_IN_PROGRESS` in the shared binding.

## Checks for the test runner

| Command (repo root) | Lock | Expect | Check IDs |
|---|---|---|---|
| `npm run test -w @dems/core-web -- --maxWorkers=4` | none | all green; the Evidence files of this row among them | whole web suite |
| `npx -w apps/mobile jest --maxWorkers=2` | none | all green | whole mobile suite |
| `npm run test -w @dems/shared` | none | green (i18n blocks) | shared |
| Browser flow M8-PB-W, M8-REV-1, M8-EXP-1 (client part), M7-DEVSRC-EVID-W (note §4) | lane stack | as §4 | gate 94 |
| Device flows M8-PB-T / -P, M7-DEVSRC-EVID-T / -P, MB-05 sealed members on a v2 item (note §4) | emulators; needs request 4 | as §4 | gate 94 |
