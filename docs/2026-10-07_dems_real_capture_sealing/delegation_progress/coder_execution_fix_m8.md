# coder-execution - fix pass F-M8 (review row 93, milestone M8)

Status: **needs-review** (2026-10-10). No commit, no migration. Note: `implementation/114_fix_m8_review.md`.

## Result in short

- R93-01, R93-03, R93-04, R93-05 fixed, each with a failing-first test and an end-to-end test on a
  throw-away database (`evidence-export/__tests__/export-e2e.db.test.ts`).
- Case scope of REAL evidence now on op 42, op 87 and the download route (one predicate,
  `holdsCase` of `src/media-stream`). R93-02 itself is fix F-M6's.
- MINOR: R93-06, 08, 09, 10, 12, 16, 17, 18 fixed; R93-11, 14, 21 partly; R93-13 wording only;
  R93-15 listed; R93-07 not mine; R93-19 hardening without a test; R93-20, 22 unchanged.
- One-camera packages: export, media session and both players accept one camera file (tests on a
  package sealed by the product pipeline).

## Files

New, server: `src/engine/export-doors.ts`; `src/evidence-export/{control.ts,boot-sweep.ts,download-token.ts,service.ts}`;
tests `src/engine/__tests__/export-doors.db.test.ts`,
`src/evidence-export/__tests__/{boot-sweep,download-token,export-one-camera}.test.ts`,
`src/evidence-export/__tests__/export-e2e.db.test.ts`,
`src/modules/evidence-export/__tests__/download.test.ts`, `src/media-stream/__tests__/one-camera.test.ts`.

Edited, server: `src/evidence-export/{host,index,jobs,package-export,export-manifest}.ts` + `__tests__/jobs.test.ts`;
`src/modules/evidence-export/index.ts` + `__tests__/routes.test.ts`;
`src/modules/evidence/{index.ts (op 42 block),export-request.ts}` + `__tests__/{routes,export-request}.test.ts`, `commands.db.test.ts`;
`src/media-stream/{index,items,service,source}.ts`; `src/modules/media-stream/__tests__/{routes.test.ts,media-stream.db.test.ts,support.ts}`;
shared hot files, own lines only: `src/sealing-host/index.ts` (one import, one provide line),
`src/engine/{host.ts (one block, one import group, one type name),index.ts (one export line)}`,
`src/plugins/permission-guard/{access-rules.ts,index.ts}` + its two tests,
`src/engine/__tests__/static.test.ts` (19 -> 20), `test/acceptance/contract.test.ts` (external routes, 99 -> 100).

Shared: `src/sim/evidence-actions.ts`, `src/sim/audio.ts` (alias removed), `src/api/{capture.ts,evidence.ts,patterns.ts,redaction.ts}`,
`src/i18n/en/evidence.ts` (appended keys), `openapi/openapi.json` (generator: unchanged after another pass's run, 97 operations);
tests `test/{sim-export-completion,redaction-export-token}.test.ts`, `test/audio.test.ts`.

Web: `src/features/evidence/{export-job-model.ts,export-job.ts,export-job-status.tsx,media-session.ts,sealed-player.tsx}` +
`__tests__/{export-job,media-session-canary}.test.tsx`; `vite.config.ts`;
`src/test/{dev-proxy-blanking.test.ts (new),live-runtime-static.test.tsx,live-evidence-archive.test.tsx}`.

Mobile: `src/features/evidence/{export-job-model.ts,export-job-status.tsx,media-session.ts,sealed-player.tsx}` +
`export-job.test.ts`, `media-session-canary.test.tsx`.

Docs: `THIRD_PARTY_NOTICES.md` (one appended section), `implementation/114_fix_m8_review.md`, this file,
three lines in `file_claims.md`, two request lines in `file_requests.md` (to F-M7, to F-M5).

Not touched: `src/app.ts`, `apps/mobile/src/runtime/sim-adapters.ts`, `packages/shared/src/live/**`, any migration.

## Blockers / open

- `contract.test.ts` is red in the transcript block (fix F-M6 in flight); nothing of this pass.
- `src/engine/__tests__/static.test.ts` pin: 20 by this pass, the folder holds 21 with
  `unsealable-doors.ts` of another pass.
- Decisions for the controller: note section 4. Not done: note section 5.
