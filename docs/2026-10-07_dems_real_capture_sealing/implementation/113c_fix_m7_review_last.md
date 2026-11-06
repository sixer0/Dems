---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: fix-f-m7c-review-row-88-last
date: 2026-10-10
agent: coder-execution
source_review: gateway_check/20_m7_code_review.md
source_notes: implementation/113_fix_m7_review.md, implementation/113b_fix_m7_review_rest.md
decisions: D180, D183, D186, D187, D188
baseline: tree at abf742f + the uncommitted fix-wave work
status: partial - items 1, 2, 3, 5 DONE; D187 DONE; D188 (a) DONE; item 4 PARTLY; D188 (b) NOT DONE (stopped cleanly, nothing half-built)
---

# Fix pass F-M7c - the last open items of code-review row 88 (M7 sealing)

No commit. No migration (schema 6 / `dbc-7` untouched). No contract member moved, no OpenAPI run.
Every fix was RED first (named per row). One control per rule; one mutation proof for the MAJOR.

## 1. Items

| Item | Reproduced? | Fix | Test (red -> green) | Status |
|---|---|---|---|---|
| **1 - R88-05 (i)** boot sweep over ALL sealed sessions | YES (new file 10 red: no such unit; the base read only the current session, `controller.ts:122`) | NEW `sealing/pipeline/sealed-plaintext.ts`: `finishSealedPlaintext` (the one unit for plaintext after a commit; the pipeline's last step calls it, `pipeline.ts` `storePackage`) and `sweepSealedSession`. `sealing-host/index.ts` `sweepSealedSessions`: at the boot step, every REAL item whose session is not the one the pipeline still seals or finishes - recordings removed by proof, journal row of the last step closed (`finishedBy: BOOT_SWEEP`), nothing committed again. Refusals (`MANIFEST_NOT_OF_ITEM`, `NO_SEAL_RECORD`, `FRAGMENT_NOT_OPENABLE`, `NOTICE_NOT_WRITTEN`) touch no file and are in the error log (`SEALING_SWEEP_REFUSED`) | `sealing/__tests__/sealed-plaintext.test.ts` (12): killed after the commit -> swept, verify 15/15, second sweep does nothing; controls: another manifest digest, a clean sealed folder | **DONE** |
| **1 - R88-15** repeated decrypt-and-compare | YES (wrong-content sealed file of the right length let the plaintext go) | `sealedFileProven`: every fragment's stored digest + chain, decrypt, plaintext digest against the SIGNED table AND the recording-time row, both whole-file digests. Runs whenever the removal is not in the attempt of FINALIZE_HASHES (`recheck`), always in the sweep | same file: sweep case + the pipeline's own FINISH (attempt 2); controls: same attempt -> opener not asked again; key absent -> nothing removed, nothing moved. **Mutation**: recheck switched off -> 3 red, restored | **DONE** |
| **1 - R88-05 (ii)** orphan `.part` files | YES (the base pin read the orphan after the seal) | `removeSealedOrphans`: only after the commit; real staging dir + real `orphans` dir, regular files named `VIDEO-0n.mp4.<pid>.part` only; empty `orphans` and staging folder removed (narrows R88-27) | same file (3): pipeline removes them; a FAILED seal keeps them; sweep + containment (other name, link, folder, `orphans` that is a link) | **DONE** |
| **1 - R88-05 (iii)** kept plaintext | YES (base: one log line `SEALING_RECORDING_NOT_OF_PACKAGE`) | TOLD FIRST, then MOVED to `.quarantine/<sessionId>/`. NEW engine door `engine/sealing-notice-doors.ts` `noteSealedPlaintextKept`: ONE CRITICAL alert (`reason SEALED_PLAINTEXT_QUARANTINED`, target = session) + ONE audit row `FAULT_RAISED` (`details.reason`, `files`, `count`); a second call while the alert is active writes nothing. The engine refusing = nothing moved | unit (2) + `engine/__tests__/sealing-notice-doors.db.test.ts` (PostgreSQL, as `dems_app`) | **DONE** |
| **2** owner-only directories | YES (9 red) | `capture/boot/checks.ts`: `EvidenceVolumeFacts.privateFolders` + reasons `QUARANTINE_READABLE_BY_OTHERS`, `TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS` under `CAPTURE_EVIDENCE_STORE_UNUSABLE` (not a directory / a link, another owner, any group or other bit); `evidence-volume.ts` reads `.quarantine`, `.transcriber`, `.transcriber/sessions` by `lstat`, creates and changes nothing. Scratch made 0700 by `ensureSessionScratch` (closes a folder it finds open). Seed: `mkdirSync(store, { mode: 0o700 })`. CONFIRMED, no change: the boot probe already creates the store root 0700 (`evidence-volume.ts:70`, now tested); `scripts/lane/lane.sh:103` `mkdir -p "$MEDIA" && chmod 700 "$MEDIA"` with `MEDIA=.data/media/<database>/sessions` - the chmod is on that leaf only; `mkdir -p` may create its two parents with the default mode | `capture/boot/__tests__/checks.test.ts` (+8), `evidence-volume-private.test.ts` (3, real directories) | **DONE** |
| **3 (i)** scratch per database (D180) | YES (3 red) | `<mediaStoreRoot>/.transcriber/sessions/<id>` (`transcription/host.ts` `transcriberScratchRoot` / `sessionScratchDir` / `sessionTapPath`; `scratch.ts`; `index.ts`, `session.ts` take the media store root). Reset: `db/reset/transcriber-scratch.ts` + `routine.ts` remove below `evidence.storeRoot` of THE database being reset. UNSEALABLE: the scratch moves to `<quarantine>/transcriber/` (way-out port `scratchDir`, the run ended first). CONFIRMED by test / reading: the store scan of the reset guard lists `SESSION-*` + `.quarantine` only (`db/commands/evidence-store.ts:174-193`); the export boot sweep walks `SESSION-*` only (`evidence-export/boot-sweep.ts:68`); the sealed-session sweep goes by evidence items; verify reads one package folder | `transcription/__tests__/per-store-scratch.test.ts` (3: two Cores, one data dir, SAME id), `db/reset/__tests__/{transcriber-scratch (+1),hidden-folders (1)}.test.ts`, `way-out.test.ts` (+2) | **DONE** |
| **3 (ii)** session keys `KID-<sessionId>` | **DEFECT FOUND**: files in `<dataDir>/credential-store/keys/` (shared). Two databases with equal session IDs opened ONE key (`session-key.ts:37` `has ? open : create`) - 3 red | NO MIGRATION (files). `credential-store/index.ts` `sessionKeyScopeOf(mediaStoreDir)`; this Core's keys in `credential-store/session-keys-<scope>/` (`key-store.ts` option `folder`); `SessionKeys.owns`; `create` / `destroy` own folder only; `open` / `has` fall back to the shared folder of an earlier build READ-ONLY. The sealer seals with an OWN key only. The seeder's host names the real store root | `credential-store/__tests__/per-store-session-keys.test.ts` (3) | **DONE** |
| **3 (iii)** facts file, signer | read | `.capture-session/<sessionId>.json` is under the media store root (`sealing-host/index.ts` `readSessionCaptureFacts(mediaStoreDir, ...)`; `capture-session/facts.ts`). `<dataDir>/signer` is DELIBERATELY shared: one signing key and certificate per installation (`sealing/signing.ts`, boot check), not per database | - | **CONFIRMED** |
| **4 - R88-13 second half** key reused at a reseed | YES (pin "THE KEY IS KEPT"; red on equal key bytes) | `session-key.ts` `renewSessionKey`: the seeder destroys this Core's key of each session before it seals again -> fresh key per reseed; the nonce memo of a destroyed key is dropped. IV rule stated: cipher header + spec erratum **PE-M7-04** (`06` section H.7) | `sealing-host/__tests__/demo-seed-hook.test.ts` (pin changed by ruling) | **DONE** |
| **5 (1)** blocked seal visible (D186) | YES (3 red) | `way-out.ts`: when the retries of the process are used up -> log `SEALING_SESSION_BLOCKED` + door `raiseSealBlocked` (ONE CRITICAL alert, `reason SEAL_BLOCKED`, cause, step, the sentence of what restores it: `sealBlockedRestoreHint`); resolved by `resolveSealBlocked` on SEALED and on the terminal outcome; at a start `reportBlockedSeal` writes the same line | `way-out.test.ts` (+4), door db test | **DONE** |
| **5 (8)** retry on demand audited | YES (red: no row when the journal cannot be read) | `retryFailedSeal(sessionId, by?)` -> door `noteSealRetryOnDemand`: ONE row `RECOVERY_STARTED`, `details { reason: SEAL_RETRY, cause, step }`, `actor_id` = who asked | `sealing-host.test.ts` (+1), door db test | **DONE at the host**; the route must pass the actor: request line |
| **5 (9)** HTTP test of the route branch | - | not my file: the exact test is a request line | - | **REQUEST FILED** |
| **D187** staged revision list | YES (1 red) | `evidence-verify/{types,verify}.ts`: exactly `transcript/transcript-revisions.json.next` in a package that declares a transcript -> notice `REVISION_APPEND_PENDING` ("A transcript revision is being written; verify again shortly."), no V-14 failure | `evidence-verify/__tests__/fix-m7c-revision-pending.test.ts` (7; 5 look-alike names still fail V-14) | **DONE**; op 41 description = request line (1 shared test red until then) |
| **D188 (a)** worker on another libavformat | YES (2 red) | `worker-probe.ts`: first frame `CRASH LIBAVFORMAT_VERSION_MISMATCH` -> `HandshakeFailure.MEDIA_LIBRARY_MISMATCH`; `checks.ts`: refusal `CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH` with the installer's sentence | `worker-probe.test.ts` (+2), `checks.test.ts` (+2; one loop pin by delta) | **DONE** (scripted probe; no such worker build was run) |
| **D188 (b)** sync level at boot | - | NOT BUILT: Node cannot learn it (libuv's `fsync` asks for F_FULLFSYNC and falls back silently; no `fcntl`). The fact must come from the worker: request line | - | **NOT DONE** |

### MINORs and NOTEs not fixed

| Finding | Status | Why |
|---|---|---|
| R88-10 unsealed dev folder blocks every reset | not fixed | needs a rule that DELETES unsigned media by source rows; an UNSEALABLE session now leaves no folder (it is in the quarantine, which blocks by ruling) |
| R88-12 session keys never destroyed | partly | destroyed for a reseeded demo session. NOT for other development packages a reset removes: `db/reset` imports no unit and is not in the pinned list of credential-store users - two pins and a rule for the scope |
| R88-13 first half (one sealer per key) | not fixed | the cipher's own memo still never engages (a sealer per fragment); the host memo is now dropped with a destroyed key. Risk as stated in PE-M7-04 |
| R88-14 trusted set = current certificate | not fixed | needs the signer store's retained set (`capture/signer`, outside this pass) |
| R88-16 `clockOffsetMs` 0 | not fixed | field 40 nullable = schema + spec decision |
| R88-17 duplicated client model | not fixed | clients are not in this pass |
| R88-18 two stale headers | not fixed | `evidence-verify/index.ts:22-26, 131`, `modules/evidence/real-verification.ts:13-16`: not reached |
| R88-19 nine codes without a test | **NOT DONE** | not reached. Codes: `FRAGMENTS_JSON_MISSING`, `FRAGMENT_PLAINTEXT_HASH_MISMATCH`, `STORED_BYTES_INCONSISTENT`, `SIGNATURE_FILE_MISSING`, `REVISIONS_FILE_MISSING`, `CERTIFICATE_MISSING`, `CERTIFICATE_UNREADABLE`, `PACKAGE_UNLISTABLE`, `TRANSCRIPT_FILE_UNREADABLE` |
| NOTE R88-20..R88-26 | not addressed | R88-27 narrowed: the staging folder of a sealed session is removed when empty; `.capture-session/<id>.json` still stays |

## 2. Pins changed (each asserts the new rule and keeps a refusal)

`sealing/__tests__/pipeline.test.ts`: the containment case (kept files go to the quarantine with one notice) and the pair-58 R-5 case (the orphan is read while the seal runs, gone after it); `stt-states.test.ts` (file list + one dep name); `engine/__tests__/static.test.ts` (22 files); `credential-store/__tests__/static.test.ts` (builder count 3); `sealing-host/__tests__/demo-seed-hook.test.ts` (fresh key per reseed); `transcription/__tests__/{boot,scratch,session,session-run,encrypted-credential}.test.ts` and `db/reset/__tests__/transcriber-scratch.test.ts` (the path); `capture/boot/__tests__/checks.test.ts` (one loop excludes the new handshake failure).

## 3. Runs (each once; a second run only after a fail)

| Check | Command | Result |
|---|---|---|
| core-server unit, touched folders | `npx -w apps/core-server vitest run --project unit src/sealing/__tests__/ src/sealing-host/__tests__/ src/engine/__tests__/ src/evidence-verify/__tests__/ src/credential-store src/transcription src/db/reset/__tests__ src/capture/boot src/modules/sealing src/modules/demo src/modules/sessions src/modules/system src/media-stream src/evidence-export test/static` (sandbox off: loopback) | 112 files, 1816 passed |
| db | `/usr/bin/lockf -k .locks/db-migrate.lock npx -w apps/core-server vitest run --project db src/db/reset/__tests__ src/engine/__tests__/sealing-notice-doors.db.test.ts src/engine/__tests__/unsealable-doors.db.test.ts test/db/m4-sec-reset.db.test.ts` | 11 files, 115 passed |
| shared suite | `npx -w packages/shared vitest run` | 104 files: 2468 passed, 5 red in 2 files - `api-fx-descriptions.test.ts` (1: the op 41 description does not name `REVISION_APPEND_PENDING`; request line) and `sim-fy-clock-offset.test.ts` (4: `CAMERA_CLOCK_OFFSET`, an untracked test of another pass over `packages/shared/src/sim`, not touched here) |
| typecheck | `npm run -w apps/core-server typecheck`, `npm run -w packages/shared typecheck` | clean |
| lint | `oxlint` on the touched core-server folders and `packages/shared/src/evidence-verify` | clean |

## 4. What is not proven

- `sweepSealedSessions`, `reportBlockedSeal`, the blocked alert and the kept-plaintext notice in a RUNNING Core: the functions they call are tested, the doors on PostgreSQL; the wiring is typecheck only.
- The seed with the real helper on a database (`test/acceptance/demo-seed-v2.test.ts`) after the key scope and the fresh-key rule: not run (not my folder).
- No kill-matrix cell and no seal e2e was run; none was added.
- A real worker that answers `LIBAVFORMAT_VERSION_MISMATCH`: scripted only.
- No mutation proof for the per-store keys and scratch (controls only).

## 5. Checks for the test runner

| ID | Command (repo root, sandbox off) | Locks | Expected |
|---|---|---|---|
| FM7C-E2E | `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT=$PWD/.cache/fix-m7c/seal-e2e /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | heavy-host + db | 3 passed, case (c) of F-M7b included (never run so far) |
| FM7C-KM | `sh apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only M7-REF-1 --only M7-KM-P1-S6 --only M7-KM-P2-S6 --only M7-KM-P3-S6 --only M7-KM-P4-S6 --only M7-KM-C-S6` (confirm the ids with `run.sh --list`) | the script takes heavy-host + db | all passed: the last step now re-proves the sealed files in a resumed attempt and removes orphans |
| FM7C-SEED | `/usr/bin/lockf -k .locks/db-migrate.lock npx -w apps/core-server vitest run --project db test/acceptance/demo-seed-v2.test.ts` | db (+ heavy-host if the file takes the helper) | green: seed -> sealed under this store root's own keys -> op 41 PASS; reseed -> fresh keys |
| FM7C-DB | `/usr/bin/lockf -k .locks/db-migrate.lock npx -w apps/core-server vitest run --project db src/engine/__tests__/ src/modules/demo src/transcription` | db | green |

## 6. Decisions for the controller

1. **Audit type of kept plaintext = `FAULT_RAISED`** with `details.reason: SEALED_PLAINTEXT_QUARANTINED` and no `details.kind` (audit row only, no event). A client that reads `details.kind` of every `FAULT_RAISED` row sees none here. Say if another existing type is wanted.
2. **The blocked alert writes no audit row** (alert + log only); the retry on demand uses `RECOVERY_STARTED` with `details.reason: SEAL_RETRY`.
3. **The scope of the session keys is the resolved PATH of the media store root.** A store moved to another path needs its key folder renamed (`session-keys-<scope>`); stated in PE-M7-04. Alternative (an id file inside the store) was not built.
4. **Keys of an earlier build stay readable from the shared folder and are never destroyed by a Core.** The v2 demo packages of the standing databases (all sealed under one shared key per session ID) keep verifying; a reseed gives each database its own keys. The shared `keys/KID-*.key` files can be removed by hand once every database is reseeded.
5. **Fresh key per reseed destroys the old key BEFORE the new packages are placed.** If the reset then fails, the old demo packages of that database cannot be decrypted until the next successful reseed (their stored-bytes checks still pass). Demo data only; a two-phase key swap was not built.
6. **A sealed file that fails the repeated proof**: the plaintext goes to the quarantine with the alert, the step is DONE and the session stays SEALED with a package that fails verify. Nothing is deleted.
7. **Old scratch under `<dataDir>/transcriber/sessions/`** is no Core's any more: never listed, never removed. Remove by hand (raw audio) after the lanes restart.
8. **`host.ts` shared line** `& EngineSealingNoticeDoors` added to the type of the host constant.
9. **D188 (b)** needs the worker to state the sync level of the evidence volume (request line); the boot rule is then about ten lines in `capture/boot/checks.ts`.
10. **Decision D186 is not in `decisions/decisions.md`** (the newest entry there is D185); built from the brief's text.
11. New codes: reasons `QUARANTINE_READABLE_BY_OTHERS`, `TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS`; refusal `CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH`; alert reasons `SEALED_PLAINTEXT_QUARANTINED`, `SEAL_BLOCKED`; audit detail `SEAL_RETRY`; verify notice `REVISION_APPEND_PENDING`; log `SEALING_PLAINTEXT_QUARANTINED`, `SEALING_SWEEP_REFUSED`, `SEALING_SEALED_SESSION_FINISHED`, `SEALING_SESSION_BLOCKED`, `SEALING_ORPHAN_NOT_REMOVED`, `SEALING_RETRY_NOT_AUDITED`. `SEALING_RECORDING_NOT_OF_PACKAGE` is no longer written.

## 7. Operator-facing sentences for docs row 96

1. A sealed session never keeps plaintext: a recording the Core cannot prove to be the sealed one is moved to `<evidence store>/.quarantine/<session>/` with a CRITICAL alert.
2. "Sealing of this session is blocked ... The Core records no new session until this one is sealed." names the cause and what restores it; it clears itself when the seal completes.
3. `.quarantine` and `.transcriber` inside the evidence store must be owner-only (`chmod 700`), like the store.
4. Session keys are kept per evidence store: `<data directory>/credential-store/session-keys-<scope>/`. Back them up with the data directory; moving the evidence store requires renaming that folder.

---
*Generated: 2026-10-10 04:45 UTC*
