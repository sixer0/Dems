---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: fix-f-m7-review-row-88
date: 2026-10-10
agent: coder-execution
source_review: gateway_check/20_m7_code_review.md
decision: D178
baseline: tree at abf742f (every suite green)
status: partial — BLOCKER closed; 6 of 8 MAJOR closed; R88-02 and R88-05 OPEN (stopped cleanly, nothing half-built in the tree)
---

# Fix pass F-M7 — findings of code-review row 88 (M7: sealing, verify, reset guard)

No commit. No migration (schema 6 / `dbc-7` untouched). Every fix below was RED first; where the red
was a pin of the base tree, the pin is named. One negative control per rule and one mutation proof
per closed MAJOR (the mutant, the tests it turned red, restored).

## 1. Findings

| Finding | Reproduced? | Fix | Test (red -> green) | Status |
|---|---|---|---|---|
| **R88-01** BLOCKER one-camera session never sealable | YES. The base tree PINNED it: `sealing/__tests__/pipeline.test.ts:398-404` at abf742f ("a NAMED failure ... and the next attempt ends the same way"); new shared / machine tests red before the fix (6 + 2) | `tracks[]` / `files[]` of 1 or 2: `isSealedTrackList` (`packages/shared/src/evidence-package/layout.ts`), `manifest.ts` cross-field rules, `fragments.ts`, `declaredPackageFiles({ tracks })`; V-14 judges the manifest's own track list (`evidence-verify/verify.ts` `checkCompleteness`); `completeSealTransition` accepts 1 or 2 (`sim/session-machine.ts`, one statement); pipeline `CLOSE_TRACKS` leaves out a camera with no file and no row (`NOT_RECORDED`, not interrupted), every later step walks the sealed tracks; absent camera stated under the signature by `sealing.steps[CLOSE_TRACKS].checkpoint.absentTracks` (existing member, 119 + 9 fields stay). Spec erratum **PE-M7-01** (`06_evidence_package_spec.md` §B.4) | `packages/shared/test/evidence-m7-one-camera.test.ts` (7), `sim-core-driven-seal.test.ts` (+2, 3 refusal rows), `sealing/__tests__/pipeline-one-camera.test.ts` (11: seal + verify PASS 15/15 for VIDEO-01-only and VIDEO-02-only, V-04 control, V-14 stray-file control, two-camera control, resume). Mutations: never-recorded rule off -> 2 red; schema back to "exactly 2" -> 3 red | **DONE** |
| **R88-02** MAJOR no way out of a failed seal | YES for (b), by the base pins `pipeline.test.ts` (FRAGMENT_MISMATCH / DURABLE_BYTES_MISSING / FRAGMENT_TOO_LARGE on ONE file failed the whole seal for ever) | **(b) built**: a failure confined to one camera file (`CONFINED_TO_ONE_CAMERA_FILE`) leaves THAT file out by name (`SEALING_CAMERA_LEFT_OUT`, error log + the DONE step's operator sentence), seals what validates as INTERRUPTED, and moves the file to `<media root>/.quarantine/<sessionId>/` (0700 / 0600, never deleted; `moveToQuarantine`). No file validates -> named failure `NOTHING_SEALABLE`, nothing signed, recordings untouched. **(a) NOT built** (bounded in-process retry). **(c) NOT built** (terminal UNSEALABLE: session ended INCOMPLETE, CRITICAL alert + audit row, whole-session quarantine, boot log line, retry through the recovery operation) | `pipeline-one-camera.test.ts` (4 confined cases + NOTHING_SEALABLE), 7 pins of `pipeline.test.ts` rewritten by ruling (each keeps its named detail, now on the left-out record) | **OPEN** — (b) only. A session with NO sealable file still stays FINALIZING and blocks the Core |
| **R88-03** MAJOR `MANIFEST_NOT_REPRODUCIBLE` permanent | YES. Base pin `pipeline.test.ts:560-571`; new file 4 red | The whole manifest input (minus `files`, which is `fragments.json`) and the source rows are written into the BUILD_MANIFEST RUNNING row before the first digest (`FrozenBuild.input / sourceRows`, `pipeline.ts` `liveInput` / `assemble`); a resume builds from the snapshot and reads nothing live. Old checkpoints without a snapshot build live as before | `sealing/__tests__/pipeline-frozen-facts.test.ts` (6: 3 stop points, snapshot in the row, control before the checkpoint, control "a package file changed -> still nothing signed"). Mutation: snapshot ignored -> 3 red | **DONE** |
| **R88-04** MAJOR plaintext-until-sealed in no spec; store root readable | YES (`checks.ts:162` accepted 0750 / 0755: 5 red) | Boot: `EvidenceStoreProblem.READABLE_BY_OTHERS` for any group / other bit (`capture/boot/checks.ts`), refusal text says what lies there and `chmod 700`. Errata: **CAP-M7-01** (`05_capture_architecture_spec.md` §D), **PE-M7-02** (`06` §A.3), **PE-M7-03** (`06` §H.6). Transcriber data dir: request line to F-M6 (their unit) | `capture/boot/__tests__/checks.test.ts` (+8) | **DONE for the media root + errata**; transcriber dir = request filed; operator sentences in §4 |
| **R88-05** MAJOR plaintext outlives SEALED silently | not run (not started) | Only what R88-02 (b) needed: a left-out camera file is quarantined and logged at error level. NOT built: removal of `.sealing/<id>/orphans`, the boot sweep over ALL sealed sessions, alert + audit row for a kept plaintext file, quarantine of `recordingsKept` | — | **NOT DONE** |
| **R88-06** MAJOR audit extract unsigned | YES (altered extract verifies PASS 15/15: 3 red) | No manifest member holds its hash (checked: `manifest.ts` has no audit member; ev §B has none) -> the named non-failing notice `AUDIT_EXTRACT_NOT_SIGNED` on every v2 result (`PackageVerifyResult.notices`, report line, op 41 `notices[]`, both clients show it). No field invented | `evidence-verify/__tests__/fix-m7-verify.test.ts` (3), client tests (3 + 3). Mutation: notice dropped -> 3 red | **DONE** (decision 1 open) |
| **R88-07** MAJOR clients ignore `developmentKey` | YES (web 6 red; mobile by mutation: line unmounted -> 2 red each app) | Both `verify-v2.ts` read `signature.developmentKey` (`signingKey`: DEVELOPMENT / NOT_DEVELOPMENT / NOT_ESTABLISHED; unreadable = not established + malformed), both report views draw "Signed with a DEVELOPMENT key — not a production signature" / "Signing key: not established ..." directly after the source line; the detail's signature entry repeats it once the Core answered (web `integrity-tab.tsx`, mobile `live-integrity-tab.tsx`) | web `__tests__/verify-v2-signing-key.test.tsx` (8) + `verify-v2.test.tsx` (+3); mobile `verify-v2-signing-key.test.tsx` (8) + `live-evidence-verify-v2.test.tsx` (+2) | **DONE** (item-level member = decision 5) |
| **R88-08** MAJOR mark not anchored; no boot refusal | YES (5 red; base pins `development-key.test.ts:71`, shared `evidence-verify-development-key.test.ts:46,56` answered true / false from an UNVERIFIED manifest) | `CertificateFacts.subject / serialNumber`; V-13 `CERTIFICATE_SUBJECT_MISMATCH` (fields 25 / 26 vs the certificate); `developmentKey` from the certificate that verified the signature, `null` unless V-01 / V-03 / V-09 / V-13 passed; op 41 member nullable, always carried for v2. Boot: `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION` (REAL_DEVELOPMENT accepts). Seal: `DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES` at SIGN_MANIFEST, nothing signed | `fix-m7-verify.test.ts` (6), shared `evidence-verify-development-key.test.ts` (8), `checks.test.ts` (+2), `pipeline-development-key.test.ts` (3). Mutation: manifest-text rule back -> 5 red | **DONE** |
| **R88-09** MAJOR reset beside an unsealed recording | YES ("THE HOLE": guard did not throw; 11 red) | `readEvidenceStore`: only ENOENT is "no store", anything else `unreadable` -> blocks (`RESET_STORE_UNREADABLE` in the message); the ONE statement gains `UNION ALL` of sessions with a production-class source row, no sealed item and no history entry (fail closed: "not a development kind") -> `unsealedSessions` block; `<root>/.quarantine/*` listed -> blocks | `db/reset/__tests__/real-evidence-m7.test.ts` (13), `real-evidence-m7.db.test.ts` (4, PostgreSQL, as `dems_owner` and `dems_app`). Mutation: every listing error = no store + unsealed row skipped -> 4 red | **DONE** |

### MINOR

| Finding | Status | Why |
|---|---|---|
| R88-10 unsealed dev folder blocks every reset | not fixed | Needs a clearing rule that DELETES unsigned media by source rows alone; not small, and it must follow the terminal path of R88-02 (c). Decision for the controller |
| R88-11 planted `manifest.json` | **fixed** | A folder holding `session-manifest.json` reads UNKNOWN (`evidence-store.ts`); test + v1 control; one fixture of `package-removal.test.ts` corrected |
| R88-12 session keys never destroyed | not fixed | `sessionKeys.destroy` is the credential store's (F-M4's area this wave) and must run from the reset after the folder is gone; not started |
| R88-13 IV rule / duplicated memo | partly | The rule is written honestly (cipher comment, errata CAP-M7-01 / PE-M7-03). NOT done: one sealer per key, fresh key per demo reseed |
| R88-14 trusted set = current certificate | not fixed | Needs the signer store's retained set (`capture/signer`, outside this pass) |
| R88-15 re-hash before removal on a later attempt | **not fixed** | Named in the brief; not reached |
| R88-16 `clockOffsetMs` 0 stand-in | not fixed | Needs field 40 nullable (schema + spec decision). The "seal-time values" half is narrowed by R88-03 (first build freezes them) |
| R88-17 duplicated client model | not fixed | Both copies were extended identically; moving the model to `packages/shared` collides with F-M8's edits in the same folders this wave |
| R88-18 stale headers | 2 of 4 | Fixed: `fragment-cipher.ts` "NOT WIRED YET", `session-machine.ts` "encrypts while recording". Open: `evidence-verify/index.ts:22-26, 131`, `modules/evidence/real-verification.ts:13-16` |
| R88-19 nine codes without a test | not fixed | Not reached. (`CERTIFICATE_SUBJECT_MISMATCH`, new, has tests) |
| row 69 Q11 demo codec text | **fixed** | `demo-seed/index.ts`: `'H264'`; `demo-seed.test.ts` asserts it (red first) |

NOTE R88-20..R88-27: none addressed. R88-25: the seal e2e ran once in this pass, both cases green.

## 2. Pins changed by ruling D178 (not weakened: each asserts the new rule and keeps a refusal)

`packages/shared/test/evidence-package.test.ts` (one-file fragment table), `sim-core-driven-seal.test.ts`
(the "one camera file only" refusal row), `evidence-verify-development-key.test.ts` (2 cases);
`sealing/__tests__/pipeline.test.ts` (7 one-file failure pins + the not-reproducible pin);
`evidence-verify/__tests__/{development-key (1), verify-v2 (1), core-verification (1)}.test.ts`;
`db/reset/__tests__/{real-evidence (details keys), package-removal (v1 fixture)}.test.ts`.

## 3. Runs (each once)

| Check | Command | Result |
|---|---|---|
| shared suite | `npx -w packages/shared vitest run` | 99 files, 2454 passed |
| core-server unit, touched folders | `npx -w apps/core-server vitest run --project unit src/sealing/__tests__/ src/sealing-host/__tests__/ src/evidence-verify/__tests__/ src/db/reset/__tests__/ src/capture/boot/__tests__/ src/credential-store/__tests__/ src/modules/sealing src/modules/demo src/modules/evidence/__tests__` | 54 files, 1038 passed |
| guard on PostgreSQL | `/usr/bin/lockf -k .locks/db-migrate.lock npx -w apps/core-server vitest run --project db src/db/reset/__tests__/real-evidence-m7.db.test.ts` | 4 passed |
| kill matrix | `sh apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only M7-REF-1 --only M7-KM-C-S6` | 2 passed |
| seal e2e | `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT=$PWD/.cache/fix-m7/seal-e2e` + both locks, `vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | 2 passed (the test now makes its output folder) |
| web evidence folder | `npx -w apps/core-web vitest run src/features/evidence` + `src/test/live-evidence-archive.test.tsx src/test/live-row87-verify-v2.test.tsx` | 150 + 15 passed |
| mobile verify | `npx -w apps/mobile jest --maxWorkers=2 src/features/evidence/{verify-v2,verify-v2-signing-key,live-evidence-verify-v2}.test.tsx src/features/evidence/live-evidence-static.test.ts` | 36 + 12 passed |
| typecheck | shared clean; core-web clean; core-server: errors only in `capture-notices/**`, `capture-session/**`, `capture/__tests__/records.test.ts` (F-M5's in-flight forwarder / event types); mobile: one error in `session-recovery/failed-start.test.tsx` (F-M5) | mine clean |
| lint | `oxlint` shared, core-server touched folders, core-web `src/features/evidence`; `eslint` on the mobile files touched | clean |

Reds seen that are not this pass's: `test/static/guard-family.test.ts:65` (worker rule tags,
`apps/capture-worker`), `capture/__tests__/static.test.ts:431` (ONVIF client exports,
`capture/adapters`): both files are in other passes' diffs.

NOT run by this pass: the unit case for the terminal UNSEALABLE path and a new kill-matrix cell for
it (the path is not built); a kill-matrix cell for the one-camera seal (covered by the unit file
only).

## 4. Operator-facing sentences the docs row 96 must carry (R88-04)

1. Recordings are stored in PLAINTEXT on the evidence store (`DEMS_MEDIA_DIR`, default `<data directory>/media/sessions`) from the start of a session until its seal completes. They are encrypted when the session is sealed, not while it records.
2. The evidence store directory must belong to the user of the Core and be closed to everybody else (`chmod 700`). The Core refuses to start real capture otherwise (`CAPTURE_EVIDENCE_STORE_UNUSABLE`, reason `READABLE_BY_OTHERS`).
3. Put the evidence store on an encrypted volume: a copied or stolen disk exposes every session that is not sealed yet, and the quarantine folder.
4. `<evidence store>/.quarantine/<session>/` holds recordings the Core could not seal. They are plaintext, they are evidence, they are never deleted by the Core, and a demo reset is refused while the folder holds anything.
5. A session whose seal failed keeps its plaintext recordings in its folder until the seal succeeds.
6. A production Core does not start with a development signing key (`CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION`); a package signed with one says "Signed with a DEVELOPMENT key — not a production signature" on every verification.
7. The audit extract inside a package (`audit-session-extract.jsonl`) is not covered by the package signature; the audit chain of the Core is the record.
8. A session recorded with one camera is sealed with one camera file; the package says which camera is absent.

## 5. Decisions for the controller

1. **R88-06**: one field in the next manifest revision (the audit extract's SHA-256, checked like V-10). Until then the notice stands.
2. **R88-02 (b) reading**: a failure confined to one camera file leaves the WHOLE file out (it is quarantined), not "the prefix before the first bad fragment". Confirm or ask for the prefix rule.
3. **Environment**: `.data/media/sessions` (the main lane's root) is mode 0755. With the R88-04 boot rule a real-mode Core on it is refused until `chmod 700 .data/media/sessions`; `dems_lane_2/sessions` is already 0700. Not changed by this pass (standing environment). Whoever creates that folder with a plain `mkdir` should create it 0700.
4. **`developmentKey` is `null` for an unverified package** (it was `true` / `false`): three pins changed; op 41 carries `signature: { developmentKey: null }`.
5. **Item-level development-key member** (the detail's signature line before any verification) needs a column: request line to F-M5, no migration done.
6. **New codes**: verify `CERTIFICATE_SUBJECT_MISMATCH` (V-13); sealing `NOTHING_SEALABLE`, `DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES`; boot `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION`, store problem `READABLE_BY_OTHERS`. Log codes `SEALING_CAMERA_NOT_RECORDED`, `SEALING_CAMERA_LEFT_OUT`, `SEALING_RECORDING_QUARANTINED`.
7. **`openapi.json`** was regenerated under `.locks/npm.lock`: it holds this pass's op 41 members and whatever the other passes had in `packages/shared/src/api` at that moment.
8. **Client fixtures** `verify-v2-recorded.ts` (both apps) were recorded before `signature` / `notices` existed; the new tests add the members by hand. Re-record from the real verifier when F-M8 is out of the folder.
9. **R88-02 (a), (c) and R88-05 are open MAJORs.** They need: an engine door + machine transition that ends a session INCOMPLETE with reason `UNSEALABLE` (existing audit type `SESSION_INCOMPLETE` with `details.reason`), a CRITICAL alert, the boot sweep, and named retry bounds. The pieces already in the tree for them: `SEALING_QUARANTINE_DIR`, `moveToQuarantine`, `SealingPorts.quarantineDir`, `SealingFailure.NOTHING_SEALABLE`, the guard's quarantine block.

## 6. Request lines filed (`delegation_progress/file_requests.md`)

F-M8: `evidence-export/export-manifest.ts:62, :107` (1 or 2 files / sources); F-M8: `media-stream/service.ts:116` + the clients' players (a `fileId` the package does not hold; players list `item.tracks`); F-M6: `transcription/{boot,scratch}.ts` owner-only transcriber data dir; F-M5: optional item member for the development key (decision 5).

---
*Generated: 2026-10-10 03:45 UTC*
