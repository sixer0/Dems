---
task_id: 2026-10-07_dems_real_capture_sealing
row: 82 (M7-W1) — sealing pipeline v2
date: 2026-10-09
agent: coder-execution
baseline: e296ce7
status: needs-review — the pipeline (seal-time encryption, ruling D147), its engine doors and the session machine are built and proven on generated recordings. NOT DONE: the composition unit, the op 83 route, the seal of a worker-recorded session, the demo regeneration. F-82-3 / F-82-4 (item mapping) are with pass D4. READ SECTION 9 FIRST: it supersedes what sections 1-7 say about who encrypts, the camera path and findings F-82-1 / F-82-2
tier: 3
---

# Row 82 — sealing pipeline v2

Paths relative to the repository root. No commit, no migration, no lockfile write, `.data/pg*.env` not read.

## 1. What was built

| Part | Where | Real / stand-in |
|---|---|---|
| Pipeline: six steps, checkpoints, resume, failure rows, progress | `apps/core-server/src/sealing/pipeline/pipeline.ts:139` (`createSealingPipeline`), steps `:259` CLOSE_TRACKS, `:372` FINALIZE_HASHES, `:467` FINALIZE_TRANSCRIPT, `:581` BUILD_MANIFEST, `:604` SIGN_MANIFEST, `:617` STORE_SEALED_PACKAGE, run loop `:673` (line numbers of the first landing; the function names are the anchors) | real |
| Contract: ports, failure codes, hook points, outcomes | `.../pipeline/contract.ts` | real |
| Camera files: reader, plaintext view, the one truncation, `.part` names | `.../pipeline/camera-files.ts` | real |
| Package writer (staged, synced, renamed) | `.../pipeline/package-writer.ts` | real |
| Controller: one run per session, engine port, resume decision, the entry on row 71b's hand-off (`sealOnCaptureHandOff`: STOPPED / INTERRUPTED, ruling D144) | `.../pipeline/controller.ts` | real logic; not mounted |
| Signing key location + development key | `apps/core-server/src/sealing/signing.ts`, `dev-key-cli.ts`; script `evidence:dev-key` in `apps/core-server/package.json` | real |
| Session machine: Core-driven seal, verdict record, D121 | `packages/shared/src/sim/session-machine.ts` — `isCoreDrivenSeal`, `applySealingProgressTransition`, `completeSealTransition`, `recordEvidenceVerificationTransition`; guard in `advanceFinalization` | real |
| Engine doors `applySealingProgress` / `completeSeal` / `recordEvidenceVerification` | `apps/core-server/src/engine/host.ts` (seal block: `applySealTransition` + three doors), `engine/types.ts` (`EngineSealDoors`), `engine/seal-doors.ts` (`sealDoorsOf`), three labels in `engine/limits.ts` | real, as `dems_app` |

**Steps.** CLOSE_TRACKS runs row 59's `validateCameraFile` (box walk, never a probe) against the rows of `recording_fragments`, sorts `.part` names with `classifyPartNames`, calls `insertMissing` for whole unrecorded fragments, and cuts a tail that is no whole fragment. FINALIZE_HASHES re-hashes every recorded range against its row and chain, forms both whole-file hashes and writes `fragments/fragments.json`. FINALIZE_TRANSCRIPT asks row 79's step until DONE. BUILD_MANIFEST freezes `sealedAt`, `signedAt` and the manifest's step list in its RUNNING row before the first build. SIGN_MANIFEST signs that digest or nothing. STORE_SEALED_PACKAGE refuses an undeclared file, syncs, and commits the item through `completeSeal`.

**Package form (D133).** `<mediaStoreDir>/SESSION-<sessionId>/` with `session-manifest.json`, `signature.sig`, `device-certificate.pem`, `fragments/VIDEO-0n.mp4`, `fragments/fragments.json`, `audit-session-extract.jsonl`, and `transcript/*` + `transcript-revisions.json` only when a document is sealed. The package folder is the session folder. Row 71b records to `SESSION-<id>/VIDEO-0n.mp4`; CLOSE_TRACKS moves that NAME to `fragments/VIDEO-0n.mp4` (one rename, same file, both directories synced) — decision D-82-11.

**Failed start vs interrupted (D144 (2)).** Decided by walking the files: with no `sealing_jobs` row, a session seals when a fragment row exists OR a camera file holds a whole fragment by box walk (`durableMediaOnDisk`, also the controller's `hasDurableMedia`); rows the recorder is behind with are rebuilt from the validated file (`insertMissing`). Only a session with no valid fragment on disk and no row answers `NOTHING_DURABLE`: no row, no item, nothing moved or cut. Limit: with a cipher, an unrecorded fragment is ciphertext without IV and reads as no fragment (F-82-2).

**Truncated tail.** Dropped bytes are said in four places: the CLOSE_TRACKS checkpoint, the session timeline (one `CHECK` item, `source: TAIL_VALIDATION`), the error log (`SEALING_TORN_TAIL_DROPPED`) and the manifest (`timeline.interrupted`, `fragments[].truncated` on the last fragment of that file). A dropped tail makes the seal an interrupted one even after a clean stop.

**Sealed files and the box walk.** A fragment sealed as one GCM message has a ciphertext `moof`. The walk therefore reads the file after the cipher, through verify's `FragmentOpener`; stored bytes are hashed apart. This works for recorded fragments only (F-82-2).

**D121.** A step's `etaMs` is now that step's remaining time in the simulator as well; op 83's run total is unchanged (it is computed in `sim/api.ts`).

## 2. Findings that block a real seal (none fixable in this row's files)

| ID | Finding |
|---|---|
| F-82-1 | `recording_fragments` has no column for `gcmIv`, `gcmTag`, `keyId`, `sha256Plain`, `keyframe`; the manifest requires the first three. Nothing stores them. No migration was made. The pipeline reads them through the port `FragmentSealFactsReader`, which has no production reader |
| F-82-2 | The worker's cipher seam is empty: a real camera file is plaintext. The pipeline cuts and flags its tail, then refuses it (`FRAGMENT_NOT_SEALED`) and signs nothing. Spec §D.1 also contradicts itself (whole fragment sealed vs boxes clear) |
| F-82-3 | The database mapping writes `evidence_items.development_sources` NULL whatever the item says (measured) |
| F-82-4 | After a real item is stored, the next process start is refused by the mapping's way back (`ROW_SHAPE`, measured): the Core does not boot after its first real seal |

Each is a line in `delegation_progress/file_requests.md`.

## 3. Results (each once, after the last change)

| Check | Command | Result |
|---|---|---|
| Pipeline + signing + row 79/116/119 tests of the folder, engine static, workspace static guards | `vitest run --root apps/core-server --project unit src/sealing src/engine/__tests__/static.test.ts test/static` | 21 files, 327 passed |
| of which `pipeline.test.ts` | | 35 passed |
| Session machine | `vitest run --root packages/shared test/sim-core-driven-seal.test.ts test/session-machine.test.ts test/sim-v2-parity.test.ts test/sim-api.test.ts` | 73 passed (16 new) |
| Engine doors, db | `lockf -k .locks/db-migrate.lock vitest run --root apps/core-server --project db src/engine/__tests__/seal-actions.db.test.ts src/modules/recording-fragments/__tests__/recording-fragments.db.test.ts` | 33 passed; 0 databases remain |
| Typecheck | `npm run typecheck -w @dems/core-server`, `-w @dems/shared` | exit 0 both |
| Lint | `npm run lint` both workspaces | 0 findings in this row's files |
| Mutations | 14 single-line mutations (10 pipeline/controller, 4 session machine) | 14 red, files restored |

What the tests show:
- **First product-sealed package.** A session sealed by the pipeline passes all 15 checks of rows 85 / 141 with the Core's anchors, also with a machine transcript inside. **M7-REF-1, function half:** track hashes, plaintext hashes, chain heads and a prefix hash equal values recomputed in the test.
- **Tamper (ev §F.2).** One flipped byte in `(VIDEO-02, 3)` (`DEMO_TAMPERED_FRAGMENT_TRACK` / `_SEQ`) gives TAMPERED naming exactly that fragment.
- **Kill-and-resume.** Stopped after BUILD_MANIFEST's work, the resumed run produces a byte-identical manifest and signature to an uninterrupted run; without the frozen checkpoint the digest differs (control). All 18 hook points once: resume seals, verifies, media hashes equal the reference, item committed once.
- **Interrupted path.** Durable prefix sealed, tail cut and flagged, V-12 passes with `interrupted: true`.
- **Failed start by walk (D144).** Whole fragments on disk without rows: rows inserted, seal interrupted (then stops at F-82-2). Control: a cut first fragment and no row gives `NOTHING_DURABLE` with 0 journal writes.
- **Fail closed.** Altered stored byte, row digest not the bytes', missing durable bytes, no session key, three source rows, undeclared file, changed session record before a resumed sign, engine down: each ends FAILED with its row and log entry, nothing signed or committed.

## 4. Not proven / not done

- No real worker, no real media, no real kill (in-process stop through the hook). M7-REF-1 and M7-KM-P1..P4-0 as written need a worker session and are not met.
- The pipeline's ports are in memory in `pipeline.test.ts`; the journal on the real table is row 79's db test. No db test runs the whole pipeline against the tables (it needs the composition).
- M7-FF-UNIT is a client check (row 87's); the forward-only rule is shown on the session machine only.
- **Demo regeneration not done.** `gen-demo-evidence.ts` is untouched. v2 demo packages need camera files with fragments and cipher records (F-82-1/2), and the generated indexes are in D1b's folder. The tamper constants are exercised in `pipeline.test.ts` instead.
- No device or browser check.

## 5. Decisions taken

| ID | Decision |
|---|---|
| D-82-1 | The three engine actions are pure transitions in `session-machine.ts`, applied by host doors beside the seam (`sealDoorsOf`), not `SimActions` members: the pinned action count is untouched |
| D-82-2 | A Core-driven finalization is recognised by open steps without a planned duration; `advanceFinalization` leaves such a session alone. No new state member |
| D-82-3 | The manifest's `sealing.steps[]` lists the three steps before BUILD_MANIFEST, frozen with `sealedAt` / `signedAt` |
| D-82-4 | `session-manifest.json` is written at SIGN_MANIFEST; item and track rows are written once, in `completeSeal` |
| D-82-5 | A dropped tail always makes the seal interrupted (`stoppedAt` null in the manifest) |
| D-82-6 | A SEALED history entry carries no fault kind (database CHECK); the fault is in custody (`RECORDING_INTERRUPTED`) and audit |
| D-82-7 | An orphan `.part` file is moved to `<mediaStoreDir>/.sealing/<id>/orphans/`, bytes kept |
| D-82-8 | Row 79's pin "no production file of `src/sealing` imports capture" was narrowed to the transcript step and the journal; the capture importers of the pipeline are pinned by name |
| D-82-9 | Signing key in `<dataDir>/signer` (the boot check's directory, held equal by a test). `evidence:dev-key` marks the key `OU=DEVELOPMENT KEY - NOT FOR PRODUCTION`; the verify report does not show the subject yet |
| D-82-10 | The real item carries `tracks` and no `files[]` (the mapping models one chain head per item) |
| D-82-11 | The camera file's name is moved from the recording path to `fragments/` at CLOSE_TRACKS; rows 90 / 91 see `fragments/VIDEO-0n.mp4` in a sealed package |
| D-82-12 | `FIRST_VIDEO_SAMPLE.skipped` / `skippedSpanMs` have no manifest member: handed to the composition's log (`onFirstVideo`), spec question filed. `audio.sourceIntervals` are read from the table through the session reader; an open last interval is closed at the media end |

## 6. Hook points for row 86

`SealingPorts.hook({ step, phase, attempt })`; throwing `SealingStop` ends the run as a kill does (no FAILED row, no log, no engine call). Steps × phases `BEFORE`, `AFTER_WORK`, `AFTER_CHECKPOINT` = 18 points. FINALIZE_TRANSCRIPT's `AFTER_WORK` is already after its DONE row; STORE_SEALED_PACKAGE's `AFTER_WORK` is "item committed, row RUNNING". Row 86's process kill needs the composition to pass a hook that kills the process.

## 7. To wire

| When | What |
|---|---|
| F-82-1 ruled | production `FragmentSealFactsReader` |
| 71a | worker cipher; then a real file passes FINALIZE_HASHES |
| mapping opened | flip the two MEASURED expectations in `seal-actions.db.test.ts` |
| composition | the unit that builds `SealingPorts`, calls `controller.resume()` after the engine start and provides the real verification with `recordEvidenceVerification` |
| 71b (landed) | the composition calls `sealOnCaptureHandOff({ capture: sessionCapture(app), controller, ... })`; `realBootFixture()` for a real-mode db test |
| 87 follow-up | MB-06 in-place Recovery -> Finalizing; MB-05 Summary |

## 8. Device / browser checks for the M7 gate

One flow once the blockers are closed: fake session -> stop -> Finalizing shows per-step percent and the running step's ETA -> SEALED -> verify PASS (op 41). Second: kill the worker mid-recording -> Recovery -> Finalizing in place -> SEALED interrupted, verify shows the mark. Third: tamper `(VIDEO-02, 3)` -> verify names the fragment.

## 9. Follow-up D147 (supersedes sections 1-7 where they differ)

**What changed in the pipeline.**

| Step | Now |
|---|---|
| CLOSE_TRACKS | Validates the worker's RECORDING file `SESSION-<id>/VIDEO-0n.mp4` (plaintext) by box walk against the rows; inserts missing rows; then THE CORE SEALS: writes `fragments/VIDEO-0n.mp4.seal.part` (exclusive create), init segment clear, each whole `moof` + `mdat` as one AES-256-GCM message at the same offset through the port `SessionFragmentSealer` (row 84's cipher, key `KID-<sessionId>` in the credential store), syncs, renames. Writes `fragments/fragments.json` (the durable home of IV / tag / key ID) before its checkpoint. The recording file is not changed and not renamed. A run stopped inside the step starts both sealed files again |
| FINALIZE_HASHES | Reads the SEALED files again: stored digest, chain and prefix against the fragment table; opens every range and holds the plaintext against the row's recording-time digest; whole-file hashes against CLOSE_TRACKS' checkpoint |
| STORE_SEALED_PACKAGE | The recordings are tolerated beside the package until the item is committed, then removed; `recordingsRemoved` is in the checkpoint. A crash before leaves them: never a package without media |

**The two hashes.** Row `sha256` / `chain_hash` = the worker's bytes = manifest `sha256Plain` per fragment; whole recording prefix = `tracks[].sha256Plain`. Stored digest, chain, prefix and `tracks[].sha256` are computed by the pipeline over the sealed file. `keyframe` is the box walk's; a fragment whose boxes do not say fails the step (`NO_MEDIA_TIME`).

**Removed:** the port `FragmentSealFactsReader`, the plaintext view, the truncation of a file, the rename of the recording (D-82-11 withdrawn). A torn tail is left out of the sealed file and flagged in the same four places.

**Spec erratum (to place in `06_evidence_package_spec.md` §A.3 and `05_capture_architecture_spec.md` §D.1).** "Structural boxes remain clear" means the init segment (`ftyp` + `moov`) only; each fragment's `moof` + `mdat` is one GCM message. Encryption happens at seal time in the Core, not at write time in the worker; the worker's cipher seam stays empty.

**LIMITATION, stated plainly.** Recorded media is PLAINTEXT on the Core's private media root from the first fragment until the seal completes — and, after a crash, until RECOVERY has sealed it. Encryption at rest protects a sealed package only.

**Database contract.** `dbc-3 §B.6` (`04_database_contract.md:364-378`) calls `recording_fragments.sha256` the digest of the "stored fragment bytes". After D147 the rows hold recording-time (plaintext) digests; the stored-bytes digests of the sealed file exist only in the manifest and `fragments.json`. No row was updated. Erratum wanted.

**Other follow-ups applied.** D138: signing key in `<dataDir>/signer`, `evidence:dev-key`. D144: `sealOnCaptureHandOff` (STOPPED / INTERRUPTED), failed start decided by walking the recordings (`durableMediaOnDisk`). D146 (1): `session-machine.ts` takes any `MIC-NN` pair by role (one case of `integration-c1.test.ts` is red by design, filed). 71a: two fixture lines in `recording-fragments.db.test.ts`.

**Results after the rework (once each).**

| Check | Result |
|---|---|
| `vitest --project unit src/sealing src/engine/__tests__/static.test.ts test/static` (core-server) | 21 files, 329 passed; `pipeline.test.ts` 37 |
| shared: `sim-core-driven-seal`, `session-machine`, `sim-v2-parity`, `sim-api` | 74 passed (`integration-c1.test.ts`: 1 red by design) |
| db `seal-actions.db.test.ts` + `recording-fragments.db.test.ts` | 33 passed (run before the pipeline rework; no engine or db file changed since) |
| typecheck core-server + shared; lint | exit 0; 0 findings in this row's files |
| Mutations | 15 of 15 red (11 pipeline / controller, 4 session machine), incl. "the plaintext is written as the sealed file" and "recordings left beside the package" |

New in the tests: the sealed file differs from the recording in every fragment range and equals it in the init segment; 10 distinct IVs; the recordings are gone after the commit and still there after any stop before it; a sealed file altered between the two steps, an altered IV in the fragment table, no opener and a sealer that cannot make its key each fail closed.

**NOT DONE — not claimed.**

| Item | State | What it needs |
|---|---|---|
| Composition unit (approved) | not written | one unit that builds `SealingPorts`: `sealer` over `coreCredentialStore(app).sessionKeys` (`has ? open : create`, `createFragmentSealer`), `opener = coreFragmentOpener(app)`, `signing = loadSealingSigner`, journal / fragment store on the pool, a `SealSessionReader` over the engine state + `session_capture_sources` + `session_audio_intervals` + the audit rows + row 115's STT snapshot and `firstVideo`, the transcript step with row 115's seam, `sealEngineOf(sealDoorsOf(app.engine), commitSealedTranscript)`, `sealOnCaptureHandOff(sessionCapture(app))`, `controller.resume()` after the engine start, the real verification with `recordEvidenceVerification`; the `app.ts` mount line + P25 entry (D147) and one `CREDENTIAL_STORE_USERS` entry, each with its test |
| Op 83 route | not written | needs that unit (a mounted module) and the simulator's `sealingProgress` exported |
| Worker-recorded session sealed and verified (normal + killed) | NOT RUN | needs the composition; then `realBootFixture()`, the built worker, fake cameras under `.locks/heavy-host.lock` |
| Demo regeneration with the two tamper constants | not done | was conditional on the worker proof |
| Flip of the two MEASURED assertions | pending pass D4 | `seal-actions.db.test.ts`: `development_sources` `toBeNull()` -> `toBe(true)`; the last case becomes "the second boot holds the REAL item" |

**What a product item lists in `files` (question D146 (4)).** Nothing: the item of a product seal carries `tracks` = the two camera files `VIDEO-01`, `VIDEO-02` (stored-bytes hash) and no `files` member. Spec: `ev §B.4` "tracks[] of exactly 2" and §A.2 "`AUDIO-01` inside both camera files (no separate audio file in a real package)". The one-audio-file `files` list is the simulator's preview shape.
