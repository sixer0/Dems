---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: fix-f-m7b-review-row-88-rest
date: 2026-10-10
agent: coder-execution
source_review: gateway_check/20_m7_code_review.md
source_note: implementation/113_fix_m7_review.md
decisions: D178 (2), D180, D183, D185
baseline: tree at abf742f + the uncommitted fix-wave work
status: partial — item 1 (R88-02 (a) + (c), prefix ruling D183) DONE; decision D185 (a)-(d) DONE; items 2, 3, 4, 5 NOT DONE (stopped cleanly after a finished item; nothing half-built in the tree)
---

# Fix pass F-M7b — the rest of code-review row 88 (M7 sealing)

No commit. No migration (schema 6 / `dbc-7` untouched). No contract member moved, so no OpenAPI
run. Every fix was RED first (the red run is named per row). One negative control per rule and
one mutation proof per MAJOR closed.

## 1. Items

| Item | Reproduced? | Fix | Test (red -> green) | Status |
|---|---|---|---|---|
| **1 — ruling D183** prefix of a part-bad camera file | YES: the new file was 6 red on F-M7's "leave the whole file out" | `sealing/pipeline/pipeline.ts` CLOSE_TRACKS: fragment by fragment, in order — number follows, row is there, offset / length / digest AND the recording-time chain equal what the box walk made of the bytes, and not above the verifier's bound. The first failure ends the prefix; the fragments before it are sealed as INTERRUPTED with `truncated` on the last one (`ClosedTrack.partial { code, reason, firstBadSeq }`, `contract.ts`). Only a file whose FIRST fragment fails is left out (as F-M7 built). `storePackage`: the WHOLE original of a partial track is moved to `.quarantine/<sessionId>/` BEFORE the plaintext removal (its first bytes are the sealed prefix, so the removal rule would otherwise delete it and lose the remainder). Log `SEALING_CAMERA_PREFIX_SEALED` (error); operator sentence on the DONE step (`sealingOmittedNotice`) | `sealing/__tests__/pipeline-prefix.test.ts` (11): 4 part-way causes + too-large, each verify PASS 15/15 as interrupted, original in quarantine byte for byte 0700/0600, nothing left in the session folder; resume after the commit; controls: no valid first fragment -> left out; none in any file -> `NOTHING_SEALABLE`; clean recording untouched. **Mutation**: the move before the removal switched off -> 6 red, restored | **DONE** |
| **1 (a)** bounded in-process retry | YES by reading (`retriable` was only logged); new file red on a missing export (9) | NEW `sealing/pipeline/way-out.ts`. Named settings `SealRetrySettings { delaysMs, nonRecoverableAttempts }`, default `SEAL_RETRY_DEFAULTS`: **three retries per process after 5 s, 30 s, 120 s; terminal at the third attempt of a cause no retry gets past**. The composition (`sealing-host/index.ts`) hands the end of every run to it; a retry is the controller's `resume()`. The failed step reads "Sealing is being retried (retry n of N, in s s). <cause sentence>"; when the retries of the process are used up: "<cause> Sealing will be tried again when the Core starts, or by the recovery action." Next boot: `resume()` as before, with fresh retries. On demand: `sealingHost(app).retryFailedSeal(id)`, called by ONE branch of the `recoverSession` handler (`modules/sessions/routes.ts`) when the open session is FINALIZING with a FAILED step — 202, state FINALIZING | `sealing/__tests__/way-out.test.ts` (9): the rule table; a retriable cause that heals seals on the retry (control: nothing runs before the delay); one that stays: 4 attempts, then WAIT, no fifth run, session NOT ended, nothing moved. `sealing-host/__tests__/sealing-host.test.ts` (+1): `retryFailedSeal` true only for the open FINALIZING session with a FAILED step; four false controls | **DONE** (the route branch's positive path has no HTTP-level test: see §4) |
| **1 (c)** terminal UNSEALABLE | YES (F-M7 note: "a session with NO sealable file still stays FINALIZING and blocks the Core") | Order, each step repeatable: (1) the journal row of the failed step is closed — FAILED, `error_code = UNSEALABLE`, `checkpoint.unsealable { cause, at }`; (2) every entry of `SESSION-<id>/` and of `.sealing/<id>/` (under `sealing/`) is MOVED to `<mediaStoreRoot>/.quarantine/<id>/`, folders 0700, files 0600, a taken name gets a counted suffix, the two empty folders removed by `rmdir`; (3) NEW engine door `engine/unsealable-doors.ts` `endSessionUnsealable` (own block in `host.ts`) applies the shared `endUnsealableTransition` (`packages/shared/src/sim/session-machine.ts`, seal block): session ended INCOMPLETE, ONE audit row `SESSION_INCOMPLETE` severity CRITICAL `details { reason: UNSEALABLE, cause, faultKind, quarantinedFiles }`, ONE alert kind `SYSTEM` severity CRITICAL `params { reason: UNSEALABLE, cause, sessionId }`, NO evidence item, no open session. Boot: `SEALING_QUARANTINE_HOLDS_SESSIONS` (one warn line + error log, the session IDs); a journal that says UNSEALABLE is FINISHED (`finishPending`) and never run again. Triggers: `NOTHING_SEALABLE` at once; any other non-retriable code at attempt 3 (the journal's count, so it survives restarts) | shared `test/sim-m7b-unsealable.test.ts` (7, red first 7/7): the transition, `isSessionActive` false, a new session is created, 3 refusal controls. `engine/__tests__/unsealable-doors.db.test.ts` (1, PostgreSQL as `dems_app`): `active_session` empty, history INCOMPLETE, +1 audit row, 1 alert row `reason = UNSEALABLE`, no item, a new session created; control: another session ID -> 409, nothing written. `way-out.test.ts`: NOTHING_SEALABLE at once; non-recoverable cause terminal at the bound; engine not reachable -> mark stays, next start finishes without a run. **Mutation**: the bound switched off -> 2 red (session never ended), restored | **DONE** |
| **1 clients** | n/a | One sentence source `sim/seal-unsealable.ts` = i18n `common.sealUnsealable.notice`: "This recording could not be sealed. Its files were kept in quarantine on the Core. (<cause>)". Web `session-monitor/unsealable-notice.tsx` (role `status`, no control) mounted in the finalization and the recovery body of the overlay; mobile `session-finalizing/unsealable-notice.tsx` (polite live region, no control) mounted on the Finalizing screen (idle phase) and the Recovery screen | web `__tests__/unsealable-notice.test.tsx` (2), mobile `unsealable-notice.test.tsx` (3, red first: module missing); 4 controls each side | **DONE** |
| **D185 (a)** stray files under `export/` | YES (2 of 4 red) | `evidence-verify/{types,verify}.ts`: under `export/` only `EXP-<6 digits>.{zip,manifest.json,manifest.sig}` and `export-manifest.{json,sig}` are expected; anything else gives ONE notice `EXPORT_FOLDER_UNEXPECTED_FILE` that fails nothing. A name is printed only when it matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` (at most 3, then "and N more"); any other name is counted, never printed. Op 41 carries it (`notices[]`, existing member); both clients draw it in the existing list | `evidence-verify/__tests__/fix-m7b-export-notice.test.ts` (4): `.partial` + unknown name; unprintable and nested names counted; controls: finished artefacts and a composite raise none; a stray file outside `export/` is still V-14. One case in each client's `verify-v2-signing-key` test | **DONE** |
| **D185 (b)** engine file-list pin | — | `engine/__tests__/static.test.ts`: 21, with `export-doors.ts` and `unsealable-doors.ts` both named | the test | **DONE** |
| **D185 (c)** | — | noted: my request lines to F-M8 are closed | — | — |
| **D185 (d)** export boot sweep vs my folders | read `evidence-export/boot-sweep.ts:62-94` | It walks only entries of the root whose name starts with `SESSION-`, takes a directory entry of the listing as it is (a link is skipped, `PACKAGE_FOLDER_NOT_A_DIRECTORY`), `lstat`s `export/`, and unlinks only regular `*.partial` files directly in it. `.quarantine/` and `.sealing/` are never entered; an `export/` folder that a terminal outcome moved into `.quarantine/<id>/` is outside its walk | no request line needed | **DONE** |
| **2 — R88-05** plaintext outliving SEALED | not run | Only what item 1 needed: the staging folder (`.sealing/<id>`, the orphan `.part` files in it) is moved to the quarantine by the TERMINAL path. NOT built: the boot sweep over all sealed sessions, removal of orphans of a SEALED session, quarantine + alert + audit for `recordingsKept`, the repeated decrypt-and-compare of R88-15 | — | **NOT DONE** |
| **3** owner-only directories | not run | Done: `scripts/lane/lane.sh` one line in `cmd_start` (`mkdir -p "$MEDIA" && chmod 700 "$MEDIA"`; `$MEDIA` is always `.data/media/<database>/sessions`). The quarantine root and each session folder in it are made and held 0700 by both writers (`moveToQuarantine`, `quarantineSessionFiles`). NOT built: the boot refusal for a quarantine root / transcriber dir with group or other bits, the Core creating its media root 0700, the transcriber data dir rule | `sh -n` only | **NOT DONE** (lane line only) |
| **4** per-database keying (D180) | read only | Nothing changed. Read so far: the scratch path is one function, `transcription/host.ts:98` (`<dataDir>/transcriber/sessions/<id>`), used by `transcription/{index,session,session-run,scratch}.ts`, by the reset (`db/reset/transcriber-scratch.ts`, `routine.ts:881`) and pinned by 8 test files. Proposed form (NOT built): `<mediaStoreRoot>/.transcriber/sessions/<id>` — inside the root like `.sealing` and `.capture-session`, so it is per database, on the store volume and under the root's owner-only boot rule. (ii) session keys and (iii) facts file / signer: NOT examined | — | **NOT DONE** |
| **5** MINORs R88-10, -12, -13, -14, -15, -16, -17, -18, -19 | not run | none | — | **NOT DONE** |

NOTE R88-20..R88-27: not addressed. R88-27 (`.sealing/<id>` never removed) is narrowed only for a
session that ends UNSEALABLE.

## 2. Pins changed by ruling D183 (each asserts the new rule and keeps a refusal)

`sealing/__tests__/pipeline.test.ts`: the `leftOut` helper now holds "the bad fragment and all after
it are never sealed, the fragments before it are" (3 callers), the two-file `NOTHING_SEALABLE` cases
damage the FIRST fragment, the too-large pair; `pipeline-one-camera.test.ts`: the mismatch case moved
to the first fragment, the "lost durable bytes" case moved to `pipeline-prefix.test.ts` (its prefix
is sealed now). By delta: `sealing/__tests__/stt-states.test.ts` (file list + `pipeline/way-out.ts`),
`modules/sessions/__tests__/static.test.ts` (dependency list + `../../sealing-host`),
`engine/__tests__/static.test.ts` (21 files).

## 3. Runs (each once; a second run only after a fail)

| Check | Command | Result |
|---|---|---|
| shared suite | `npx -w packages/shared vitest run` | 100 files, 2461 passed |
| core-server unit, touched folders | `npx -w apps/core-server vitest run --project unit src/sealing/__tests__/ src/sealing-host/__tests__/ src/evidence-verify/__tests__/ src/engine/__tests__/ src/modules/sessions src/modules/sealing src/modules/demo src/db/reset/__tests__ test/static` | 77 files: 75 passed, 2 pins red (the two file / dependency lists above); after the delta the two files: 196 passed |
| engine door on PostgreSQL | `/usr/bin/lockf -k .locks/db-migrate.lock npx -w apps/core-server vitest run --project db src/engine/__tests__/unsealable-doors.db.test.ts` | 1 passed (two earlier reds were my test's own table / column names) |
| web | `npx -w apps/core-web vitest run src/features/session-monitor` ; `... src/features/evidence/__tests__/verify-v2-signing-key.test.tsx` | 65 passed ; 9 passed |
| mobile | `npx -w apps/mobile jest --maxWorkers=2 src/features/session-finalizing src/features/session-recovery` ; `... src/features/evidence/verify-v2-signing-key.test.tsx` | 116 passed ; 9 passed |
| typecheck | shared, core-server, core-web (`tsc -b`), mobile | clean |
| lint | `oxlint` shared, core-server touched folders, core-web `session-monitor` + `evidence`; `eslint` on the mobile files touched | clean |
| `lane.sh` | `sh -n scripts/lane/lane.sh` | syntax ok (not started: the lanes are the controller's) |

**NOT RUN by this pass** (the heavy-host lock was held by fix F-M3's worker e2e for more than 18
minutes; my queued run was withdrawn, nothing of it executed): the seal e2e with its NEW case (c),
and every kill-matrix cell. They are in §5.

## 4. What is not proven

- Case (c) of `seal-e2e.db.test.ts` (terminal UNSEALABLE in a running Core: RECOVERY -> quarantine ->
  door -> new session -> third start lists the quarantine) was WRITTEN and has NEVER run. Its
  assumptions that only the run can settle: fragment rows exist at the kill, and a 64-byte recording
  reads as "no whole fragment" for both files.
- The `recoverSession` branch answers 202 FINALIZING; proven at the host (`retryFailedSeal`) and by
  the route tests staying green in Simulated mode, not by an HTTP call on a mounted real-mode host.
- No kill-matrix CELL was added for the prefix seal, the retry or the terminal path: they are unit
  cases against the real pipeline (in-process stops only).
- The on-demand retry writes NO audit row (a log line `SEALING_RETRY_ON_DEMAND` only).

## 5. Checks for the test runner

| ID | Command (repo root, sandbox off) | Locks | Expected |
|---|---|---|---|
| FM7B-E2E | `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT=$PWD/.cache/fix-m7b/seal-e2e /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | heavy-host + db | 3 passed: (a), (b) as before, (c) NEW |
| FM7B-KM | `sh apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only M7-REF-1 --only M7-KM-P1-S6 --only M7-KM-P2-S6 --only M7-KM-P3-S6 --only M7-KM-P4-S6 --only M7-KM-C-S6` (ids by the rule of `cells.ts:83`; confirm with `run.sh --list`) | the script takes heavy-host + db | all passed (the pipeline's last step changed: a partial track is quarantined before the removal) |
| FM7B-DB | `/usr/bin/lockf -k .locks/db-migrate.lock npx -w apps/core-server vitest run --project db src/engine/__tests__/` | db | green (door file passed here; the rest of the folder not run by me) |

## 6. Decisions for the controller

1. **A retriable cause is never terminal.** A cause that never heals (a session key or signing key
   that is gone for good) keeps its session FINALIZING — visibly "will be tried again" — and the
   Core blocked. Ending it would quarantine evidence that is intact and sealable. An operator action
   "give this recording up" would be a new operation: not built. Rule on it.
2. **Any non-retriable code is terminal at attempt 3**, a defect (`SEALING_STEP_FAILED`) included.
   Everything is moved, nothing deleted, but a quarantined session has no path back into a seal.
3. **No evidence item for an UNSEALABLE session** (the simulator's own INCOMPLETE makes a RECORDED
   item): the history entry has `evidenceId: null`; the evidence counter the first progress report
   took is not given back.
4. **Foreign closed file edited, declared first**: `modules/sessions/routes.ts` (F-M5), one import
   and one branch; op 33 now answers `202` with `state: FINALIZING` in that one case (the contract
   text says RECOVERY) — an erratum sentence for C3 op 33 if accepted.
5. **`host.ts` shared line**: `& EngineUnsealableDoors` added to the type of the host constant.
6. **The transcriber scratch of an UNSEALABLE session is left where it is** (raw PCM tap, 0600 in a
   0700 folder): neither moved to the quarantine nor removed; the boot sweep removes scratch of
   SEALED sessions only. Belongs with item 4.
7. **Op 41 schema text** (`api/evidence.ts:288`) still describes only `AUDIT_EXTRACT_NOT_SIGNED`;
   the code form admits the new notice. Not edited (would need the OpenAPI generator).
8. New codes: sealing log `SEALING_CAMERA_PREFIX_SEALED`, `SEALING_RETRY_SCHEDULED`,
   `SEALING_RETRIES_EXHAUSTED`, `SEALING_SESSION_UNSEALABLE`, `SEALING_UNSEALABLE_NOT_FINISHED`,
   `SEALING_UNSEALABLE_FINISHED`, `SEALING_QUARANTINE_HOLDS_SESSIONS`, `SEALING_RETRY_ON_DEMAND`;
   journal `error_code` `UNSEALABLE`; verify notice `EXPORT_FOLDER_UNEXPECTED_FILE`.
9. **Environment**: `.data/media/sessions` is mode 0755 — left as it is; it is no lane's root any
   more. `dems_lane_2/sessions` is 0700; the lane script now makes each lane's root 0700 at a start.
10. **Items 2-5 need another pass.** R88-05 stays an open MAJOR.

## 7. Operator-facing sentences for docs row 96 (additions to note 113 §4)

1. A failed seal is tried again by the Core by itself (three times, after 5 s, 30 s and 2 minutes),
   again at every start, and when an operator starts recovery for that session.
2. A recording the Core cannot seal is closed as INCOMPLETE with the alert "This recording could not
   be sealed. Its files were kept in quarantine on the Core. (<cause>)". Its files are in
   `<evidence store>/.quarantine/<session>/`; the Core lists that folder at every start and never
   deletes from it.
3. A camera file that is damaged part-way is sealed up to the last good fragment, as an interrupted
   recording; the whole original file is kept in the quarantine folder.

---
*Generated: 2026-10-10*
