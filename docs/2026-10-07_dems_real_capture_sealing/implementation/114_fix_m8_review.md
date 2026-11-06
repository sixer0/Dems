---
task_id: 2026-10-07_dems_real_capture_sealing
row: fix pass F-M8 (findings of review row 93, milestone M8)
date: 2026-10-10
agent: coder-execution
source_review: gateway_check/21_m8_code_review.md
rulings: decision D178
baseline: abf742f (no commit, no migration; schema 6 / dbc-7)
narrative_tier: 2
status: needs-review
---

# 114 - Fix pass F-M8: media streaming, export, playback UI

Status **needs-review**: every BLOCKER / MAJOR of this pass's scope is fixed with a failing-first
test; three items are left open by decision or by scope (section 5). R93-02 is fix F-M6's.

How "red" was shown: each new test file was run on an untouched checkout of `abf742f`
(`git worktree`, removed afterwards; its `@dems/*` links pointed at that checkout) and then on the
working tree. Database tests were NOT run on the baseline tree (it has no `.data`; it could have
started a second PostgreSQL): for those the red is a mutation of the fix, named in the table.

## 1. Findings

| Finding | Reproduced? | Fix | Test | Status |
|---|---|---|---|---|
| R93-01 BLOCKER export jobs never provided; op 87 fabricates COMPLETE | Yes. Baseline: op 42 of a REAL item ran the hosted action (202) with no jobs; op 87 answered COMPLETE with the seal's hash (`modules/evidence-export/__tests__/routes.test.ts` "R93-01", 3 red) | `provideCoreEvidenceExport(app, { signer })` (`evidence-export/host.ts`), called by ONE line of `sealing-host/index.ts` (real capture operations only). Op 42 asks `service.admitRequest` first: an item with a sealed package and no jobs is refused `503 NOT_READY`, `details.reason: EXPORT_JOBS_NOT_AVAILABLE`, the hosted action does not run. Op 87 (`evidence-export/service.ts`) answers a sealed-package item only from a job record; none = `FAILED` with a code. A simulated export is COMPLETE only when the item's custody holds its `EXPORTED` entry | unit: `routes.test.ts` "R93-01" (3). e2e: `evidence-export/__tests__/export-e2e.db.test.ts` (seal -> control -> op 42 -> op 87 COMPLETE -> archive, the EXPORT's own hash / signature, download, receiver verify PASS + negative control). Mutation red: `provide` removed from `provideCoreEvidenceExport` -> the e2e fails at "jobs not null" | fixed |
| R93-02 BLOCKER case scope on ops 84 / 85 / 86 | not mine (fix F-M6) | Scope re-checked on MY operations: op 42, op 87, `GET /exports/:token` now hold the ONE predicate `holdsCase` of `src/media-stream` (exported by its index) for `integritySource === 'REAL'`, with the audited `403 NOT_PERMITTED / EVIDENCE_CASE_SCOPE`. Op 88 and the media route already did | `routes.test.ts` "the REAL-evidence case scope on operations 42 and 87" (red at baseline), `download.test.ts` "case scope holds at the route" | fixed for 42 / 87 / download |
| R93-03 MAJOR `EXPORTED` + custody at request time | Yes (`packages/shared/test/sim-export-completion.test.ts`, 4 red with the request-time behaviour; `jobs.test.ts` "R93-03", red at baseline) | `exportEvidenceTransition` takes `completion: 'DEFERRED'`: request row only. `completeEvidenceExportTransition` writes status + custody. New engine door `exportDoorsOf(engine).completeEvidenceExport` (`engine/export-doors.ts`, one block in `host.ts`). The job calls it after the archive, manifest and signature exist; a failed job never does. The simulator completes inside its request (both in one step) | shared: `sim-export-completion.test.ts` (6). unit: `jobs.test.ts` (4). db: `engine/__tests__/export-doors.db.test.ts`; e2e (COMPOSITE fails: status SEALED, no custody entry, one `EVIDENCE_EXPORT_FAILED`; PACKAGE completes: EXPORTED + one entry) | fixed |
| R93-04 MAJOR `.partial` left after a process death | Yes (`boot-sweep.test.ts` "CONTROL of the finding": the partial holds decrypted bytes and a later export does not remove it; passes at baseline, 3 sweep cases red) | `evidence-export/boot-sweep.ts` + boot step `evidenceExport.sweepPartials`: removes regular files `*.partial` in `<root>/SESSION-*/export/` only; a link in the place of a package folder, an export folder or a partial is not followed (reported to the error log). Each interrupted export is recorded `EVIDENCE_EXPORT_FAILED { EXPORT_INTERRUPTED }` once | `boot-sweep.test.ts` (4: sweep, containment, record-once); e2e restart leg | fixed |
| R93-05 MAJOR no download | Yes (no route at baseline: `download.test.ts` red by absence) | Op 87 COMPLETE gains OPTIONAL `download { path, expiresAt }`. Token `exs_` (`download-token.ts`): HMAC-SHA-256 under the media-session key through the existing door (`mediaSessionMacOf`), label `dems.export-download/1`, bound to operator + sign-in session + export + item, TTL `EVIDENCE_MEDIA_SESSION_TTL_MS`. `GET /exports/:token` registered by `modules/evidence-export`, guard rule `evidenceExportDownload` = the rule of op 87. `content-disposition: attachment; filename="DEMS-export-EXP-NNNNNN.zip"`, `cache-control: no-store`, no Range, nothing decrypted. Shared blanking rule knows `exs`. Web: "Download export". Mobile: "Download from the web console." (UX 6.6 gives tablet / phone no download) | `download-token.test.ts` (5), `download.test.ts` (7: binding negatives, expiry, scope, canary), `access-rules.test.ts` + `registered-routes.test.ts`, shared `redaction-export-token.test.ts`, web `export-job.test.tsx` (canary: cache, keys, sink, console, storage, markup), e2e | fixed |
| R93-06 MINOR `kind` dropped, no `jobId` in 202 | Yes (`routes.test.ts` "an accepted request", red) | `kind` goes onto the request when the body names it; the 202 carries `jobId` | `routes.test.ts`, `export-request.test.ts`, e2e, `commands.db.test.ts` | fixed |
| R93-07 MINOR revisions paged | not reproduced by me | the clients' transcript files are fix F-M6's | - | not mine |
| R93-08 MINOR sign-out, answer in flight | Yes (`modules/media-stream/__tests__/routes.test.ts` "R93-08", 2 red: the whole range was served) | Every 8 pieces the stream asks `parts().sessionOpen` (one row of `auth_sessions` by its key) and stops when the session is closed or the read fails. New requests already died at stage 4. Token expiry does NOT cut an answer in flight (D-90-9 stands) | unit (3); db `media-stream.db.test.ts` "R93-08" (real sign-out: 401 with no denial row, the session read says closed) | fixed |
| R93-09 MINOR dev proxy prints the token | Yes (`dev-proxy-blanking.test.ts` "CONTROL of the finding") | `configure: blankSignedPathOnProxyError` on `/media` and the new `^/exports/exs_` entry; it runs before Vite's own listener | `dev-proxy-blanking.test.ts` (3); pin `live-runtime-static.test.tsx` | fixed |
| R93-10 MINOR "latest" pair inconsistent | Yes (`boot-sweep.test.ts` "R93-10", 2 red) | Both partials first, then both names; a failed second name puts the first back (or removes it) | same file | fixed |
| R93-11 MINOR request in the 1000-row ring | Yes (`jobs.test.ts` "R93-11", 2 red) | The job keeps the request read at hand-over; after a restart the failure reason is read from its `EVIDENCE_EXPORT_FAILED` row | `jobs.test.ts` | partly: a request older than the ring still answers 404 on op 87 after a restart (section 5) |
| R93-12 MINOR `seq >= 0`, dead `INTEGRITY` branch | Yes (web canary "R93-12", red; mobile twin) | The media route's 409 cannot reach `requestMediaSession` (a media element / expo-video hands no body on): `integrityOf`, the refusal `INTEGRITY` and its `integrity` member are removed in both apps. The "points to Verify" wording stays | web + mobile `media-session-canary.test.tsx` | fixed |
| R93-13 MINOR "at <file> fragment" | by reading | New text `evidence.playback.integrityVerify`: "(Verify: <file> fragment <n>)" | typecheck + i18n missing-key checks of both suites | fixed (wording); no new render test |
| R93-14 MINOR silent stalls | (1) Yes, web (`media-session-canary` "R93-14", red). (2) by reading | (1) a rejected `play()` of the leading element (web) / a rejected `replaceAsync` (mobile) takes the playing state back. (2) web: a follower that is seeking is not re-seeked | web test; mobile and the hysteresis are not test-proven | partly (gate-94 device check) |
| R93-15 MINOR duplicated client models | by `diff` | `exportJobIdOf`: ONE rule `exportJobIdOfExport` in `@dems/shared/api`; the Core and both clients use it; the simulator's copy is a request line to F-M5. Files NOT moved (order): identical across web / mobile for hygiene row 97 - `item-v2.ts`, `export-job-model.ts`, `sealed-playback.ts`, `transcript-model.ts`; `verify-v2.ts` differs in 3 lines | existing suites | listed |
| R93-16 MINOR header enumerable again | Yes (mutation red: mobile canary fails with `enumerable: true`) | `mediaTransportOf` hands `headers` on non-enumerable | mobile `media-session-canary.test.tsx` | fixed |
| R93-17 MINOR `libx264` at run time not named | by `grep` | One appended DOC-05 section in `THIRD_PARTY_NOTICES.md`. Accurate places: the generated FAKE camera of a development capture operation (`camera-helper.ts`, source `GENERATED`; the real local camera uses `h264_videotoolbox`) and the demo seed; what an LGPL-only helper build would break | - (documentation) | fixed |
| R93-18 NOTE deprecated alias | Yes | `MIC_INPUT_OF_CHANNEL` removed, its one test use moved to `DEFAULT_MIC_INPUT_OF_CHANNEL` | shared suite | fixed |
| R93-19 NOTE manifest re-read | no seam to swap the file between the two reads | the re-read manifest is held to `item.manifestSha256` again | none: NOT claimed as proven | hardening only |
| R93-20 NOTE | - | not changed (a, b, c accepted as recorded) | - | open |
| R93-21 NOTE | by reading | `busy` is released in `finally` in both players. The job map is not pruned; `NO_TRANSPORT` keeps its sentence | - | partly |
| R93-22 NOTE | - | none needed | - | - |

One-camera packages (F-M7's two request lines, 03:40:00Z): `export-manifest.ts` takes 1 or 2 files
(`isSealedTrackList`); a COMPOSITE of a one-camera package is refused `COMPOSITE_FAILED` before
anything is written; a `fileId` the package does not hold is `409 MEDIA_NOT_AVAILABLE` with
`details.reason: CAMERA_FILE_NOT_IN_PACKAGE` at op 88; both players ask only for the files the
item names. Tests on a package SEALED BY THE PRODUCT PIPELINE with one camera (F-M7's rig):
`evidence-export/__tests__/export-one-camera.test.ts` (red before the schema change),
`media-stream/__tests__/one-camera.test.ts`, web canary "a package of ONE camera" (red at baseline).
The bundled demo-media tabs (`media-tab.tsx`, `play-sheet.tsx`) are not changed: they play v1 demo
packages, which have two cameras.

## 2. What verify does with a stray file in `export/`

`packages/shared/src/evidence-verify/verify.ts:757` skips every path under `export/` and
`composite/` in its file-completeness check. A stray file there is NOT reported by operation 41.
This pass did not edit verify (F-M7's file). The boot sweep removes `*.partial` and writes what it
did not touch to the persistent error log. A request line asks F-M7 for a named notice.

## 3. Commands run (each once; a repeat only after a fail)

| Check | Command | Result |
|---|---|---|
| shared suite | `npx vitest run --root packages/shared` | 99 files, 2454 passed |
| shared typecheck / lint | `tsc --noEmit -p packages/shared`; `npm run lint -w @dems/shared` | clean |
| core-server unit, touched folders + static guards | `npx vitest run --root apps/core-server --project unit src/evidence-export src/modules/evidence-export src/modules/evidence src/modules/media-stream src/media-stream src/plugins/permission-guard test/static/{imports,scaffold,routes,api-headers,log-calls,test-support-imports}.test.ts` | 32 files, 581 passed |
| core-server db, own files | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db <file>`: `export-e2e.db.test.ts`, `export-doors.db.test.ts`, `media-stream.db.test.ts`, `modules/evidence/__tests__/commands.db.test.ts` | passed |
| contract + rbac | same lock: `test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | rbac-matrix passed. contract: 3 failed, none from this pass (below) |
| core-server typecheck / lint | `tsc --noEmit -p apps/core-server`; `npm run lint -w @dems/core-server` | lint clean; typecheck: 2 errors in `src/capture/__tests__/records.test.ts` (not this pass) |
| core-web | `tsc -b`; `npm run lint`; `vitest run src/features/evidence src/test/{live-evidence-*,live-runtime-static,dev-proxy-blanking,media-token-blanking,sim-fetch}` | clean; 21 files, 215 passed |
| mobile | `tsc --noEmit`; `eslint src/features/evidence src/runtime/sim-adapters.ts`; `jest --maxWorkers=2 src/features/evidence src/runtime/log-media-token.test.ts` | clean; 23 suites, 177 passed |

Red results that come from other passes' in-flight edits (not fixed here):

- `test/acceptance/contract.test.ts`: the transcript block (ops 84-86) fails inside
  `modules/transcripts` answers; "area 5" and "the coverage" fail only because that block's
  misses carry over (`... /transcript/revisions as TECHNICIAN -> 403 NOT_PERMITTED; the
  specification says 200`: the R93-02 scope, fix F-M6).
- `src/engine/__tests__/static.test.ts`: the file-list pin reads 20 (this pass: +1
  `export-doors.ts`); the folder now holds 21 (`unsealable-doors.ts` of another pass).
- `test/static/guard-family.test.ts` (worker rule tags) and `src/capture/__tests__/static.test.ts`
  (ONVIF facade exports): capture-side files, not this pass.

## 4. Decisions taken (for the controller)

1. The request row stays `EVIDENCE_EXPORTED` (the contract names it the request row; the
   `exports` table is derived from it). The "export requested" record is that row; a deferred
   request words its message "Export of evidence ... requested". No custody entry at request time.
2. Download audit: no audit type was added. The row is `EVIDENCE_EXPORTED` with
   `details.reason: EXPORT_DOWNLOADED`, `jobId`, `bytes` and NO `exportId` (so the `exports` table
   and op 87 never read it as a request), plus a custody entry `EXPORT_DOWNLOADED`. Written through
   a second engine door BEFORE the first byte.
3. Issuing a download path (each COMPLETE poll of op 87) writes no audit row; each download does.
4. Provider absent: `503 NOT_READY` + `EXPORT_JOBS_NOT_AVAILABLE` (op 42 documents no 503 of its own).
5. A completed export whose custody entry could not be committed stays COMPLETE (the archive
   exists) and is reported to the persistent error log (`EXPORT_COMPLETION_NOT_RECORDED`).
6. A seed-sealed v2 DEMO item counts as "sealed here" (`hasSealedPackageHere`): it is exported by
   a job too, and refused in capture operation SIMULATED. The case scope applies to REAL only.
7. The web download is a transient same-origin `<a href>` (the browser streams to disk), not a
   fetch into memory: an archive can be many gigabytes. The path appears in the browser's own
   download list; it dies after 60 s and is useless without the session cookie.
8. R93-08: a stream is cut by its session, not by its token's expiry.

## 5. Not done / not proven

- R93-11 second half: op 87 after a restart for a request older than the audit ring answers 404
  (the durable `exports` table holds neither the audit ID nor the kind). For hygiene row 97.
- R93-14 (2) on mobile and R93-13: no automated test; device / browser checks at gate 94.
- R93-19: hardening without a failing test. R93-20, R93-21 (job map): unchanged.
- The simulator's `exportJobIdOf` and op 87 answer (`sim/api.ts`, F-M5's file): request line filed.
- No browser, emulator or device was used. No local device was selected or started.

## 6. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w @dems/shared` | - | green |
| `npm test -w @dems/core-server` | - | green once the other passes' pins settle (section 3) |
| `npm run test:db -w @dems/core-server` | `/usr/bin/lockf -k .locks/db-migrate.lock`, sandbox off | green; `contract.test.ts` after F-M6 lands |
| `npm test -w @dems/core-web` | - | green |
| `npm test -w @dems/mobile -- --maxWorkers=2` | - | green |
| `npm run typecheck` and `npm run lint` in the four workspaces | - | clean |

## 7. Gate-94 flows this pass adds

1. Web, SUPERVISOR, a product-sealed item: Export (PACKAGE) -> job Running -> Complete -> "Download
   export" -> the browser saves `DEMS-export-EXP-NNNNNN.zip`; unzip, run the receiver verify.
   The item turns EXPORTED only at Complete. The dev-server output shows no `exs_`.
2. Same item, COMPOSITE: job FAILED "Composite video is not available in this build"; the item's
   status and custody are unchanged.
3. Kill the Core during an export of a long recording; start it: no `.partial` in `export/`, one
   `EVIDENCE_EXPORT_FAILED / EXPORT_INTERRUPTED` in the audit view, the job reads "interrupted".
4. Playback, then sign out in a second tab while it plays: the picture stops within seconds; a
   seek is refused.
5. Playback of a one-camera item (web, tablet, phone): one player, no "other file" note.
6. Tablet / phone: a COMPLETE export shows "Download from the web console."
7. Stop the Core mid-playback with the dev proxy: the Vite output prints
   `/media/[signed path not printed]`.
8. Autoplay rule (web): after a renewal with no gesture left the control shows Play, not Pause.
