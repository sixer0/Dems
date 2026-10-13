---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 229
package: M11 | X1-4 (rotation scenario)
date: 2026-10-13
agent: test-expert
tier: 2
status: needs-review
requirements: SX-09 (a) to (e), SX-10 (tested as built); design 05 sections 2.9, 2.10; decisions C69, C77, C79; SX-19 (keys of the run made and removed)
---

# Row 229 - the rotation scenario on doubles, one scripted session

Status `needs-review`: every check of the row's Verification cell holds and everything the session made is gone. It is not `complete` because four observations differ from the design or from decision C77 and need a ruling (section 3); two of them are of security weight and are named for row 230.

Branch `task4/input-av-core-port`, working tree on `0f5d2a8e` with the uncommitted work of the waves. NO product file and NO workspace test file was written. The scenario is one script, `.cache/task4-row229/rotation-session.mts` (git-ignored, as row 220's driver).

Command, repository root, command sandbox off (PostgreSQL, one stand-in child process), database lock only - no capture worker, no relay, no port:

`/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && node --import tsx ../../.cache/task4-row229/rotation-session.mts'`

Result line of the result run (14:01 WIB, exit 0): `RESULT: every expectation of the session held (44 held, 4 recorded as observations, 4 difference(s) from the design)`.

## 1. What is real and what is a double

| Part | Real | Double |
|---|---|---|
| The four keys | made by the FUNCTIONS of the three commands (`runProductionKeyCommand`, `runRotateKeyCommand` three times, `runMarkCompromisedCommand`) through the signer store's own writer and source of chance | the prompt (typed lines handed in), the clock (the commands' `now` port), and for the directory rule the directories ABOVE the session's root (row 206's double) |
| The production Core | `buildApp` in `REAL_PRODUCTION`, the capture unit's own mount, every reader of the boot checks on PostgreSQL and on the key store, the audit writer, sign-in, operations 41 (verify), 42 / 87 (export, signed download), 85 (transcript revision) through `inject` | the test host through the boot control's door (C46), three stand-in programs in row 61's fixture directory (NO key there), a manual clock |
| The seal | the Ed25519 signature through the signer the Core's own loader `loadSealingSigner` hands out, the product fragment cipher and credential store, the product manifest builder, the engine's seal door, the transcript store | the package is the verify-v2 BUILDER's (random media), committed by an app in capture operation SIMULATED on the same database and data directory; the four source rows are STATED with the production kinds (as row 208: no product path records them before row 88) |
| "The Core that runs" at a SEAL | ONE signer object taken from `loadSealingSigner` and kept (what `signingNow` of `sealing-host/index.ts` keeps); for the refusals also the product pipeline (`createSealingPipeline`, its real step `SIGN_MANIFEST`) on the sealing harness | not a started Core that seals a recorded session |
| "The Core that runs" at an EXPORT or a REVISION | the booted production Core itself, with the signer it loaded itself | - |
| The receiver | `verifyExportAtDestination` on the DOWNLOAD, unpacked by the system's `unzip` | - |

Fixture written as the owner role: speech configuration off; every operator one run-generated value (in memory only); the six selector columns EMPTIED before each production start and set back to the seeded ones before each simulated session (a simulated pre-check blocks on an empty slot; a production Core is started on an empty selector, rows 208 and 220).

A running Core's manual clock is set past the instant of each command (`catchUp`): a frozen clock makes a key made "later" look not yet valid, which is a fact of the double, not of the product (it produced two false observations in run 4, section 5).

## 2. The session: each step, the expectation, the observation

Key ids are written `-01` to `-04` for `CORE-KEY-EVSIGN-0n`. Fingerprints are of certificates (public).

| Step | What | Expected | Observed | Result |
|---|---|---|---|---|
| 1a | key 1 by the command's function, unit of this installation | exit 0; `OU=Evidence signing DEMS-TEST-229` | exit 0; subject `CN=CORE-KEY-EVSIGN-01,OU=Evidence signing DEMS-TEST-229,O=SYNTHETIC ROTATION ORG - NOT AN INSTALLATION`; certificate sha256 `896306bb...f345aaeb` | pass |
| 1b | a `REAL_PRODUCTION` start on key 1 | boot passes; `SYSTEM_BOOT` names `-01` | passed (`CAPTURE_FENCE_PASSED, CAPTURE_HOST_PROFILE_NOT_ASKED, CAPTURE_PROGRAM_CHECKS_PASSED, CAPTURE_BOOT_CHECKS_PASSED`); `SYSTEM_BOOT` seq 83 `signingKeyId -01`, its fingerprint | pass |
| 1c | package A sealed under key 1 | signature key `-01` | item `EV-20261013-0014`, signed by `-01`, manifest sha256 `b224c31c...37e88d67`; 10 sealed files | pass |
| 1d | the Core's verify of A | pass, no compromise notice | HTTP 200, ok true, notices `[AUDIT_EXTRACT_NOT_SIGNED]` | pass |
| 1e | transcript revision 1 of A | 201, signed by `-01` | 201, signed by `-01` | pass |
| 1f | a first export of A (the running Core loads and keeps ITS signer) | COMPLETE | COMPLETE; download sha256 `423dd17c...3f3aec47` = the archive on disk | pass |
| 2a | rotation while that Core runs: key 2 active, certificate 1 KEPT | exit 0; pointer `-02`; `-01.crt` as before; every entry of key 1 as it was | exit 0; pointer `-02`; `-01.crt` sha256 unchanged; `-02.crt` `3b3681cb...e6180b47`; all earlier entries present with the same mode, size and modification time | pass |
| 2b | the kept signer refuses to seal | `ACTIVE_KEY_CHANGED`; pipeline `FAILED / SIGN_MANIFEST / SIGNER_FAILED`, no signature, no item | kept signer: `ACTIVE_KEY_CHANGED`; pipeline: `FAILED` at `SIGN_MANIFEST`, `SIGNER_FAILED`, retriable, cause `ACTIVE_KEY_CHANGED` in its error log, no signature file, 0 items | pass |
| 2c | the running Core itself: an export | job FAILS `SIGNATURE_FAILED`; no archive added | `FAILED`, `SIGNATURE_FAILED`; archives of A: 1; signer codes in the Core's log lines for the job: none | pass (difference D-1) |
| 2d | revision 2 of A after the rotation, Core NOT restarted - which key signs | design 2.9: a revision after a rotation is signed by the new key, its certificate retained; C77: a running Core does not go over to another key without a restart | 201, signed by `-02` (certificate of `-02`) | observed (difference D-2) |
| 2e | the restart | boot passes; `SYSTEM_BOOT` names `-02` | passed; `SYSTEM_BOOT` seq 100 `signingKeyId -02`, fingerprint `3b3681cb...` | pass |
| 2f | package B sealed after the restart | signature key `-02` | item `EV-20261013-0015`, signed by `-02`, manifest sha256 `8b175685...87aa2128` | pass |
| 2g | revision 3 of A after rotation AND restart | 201, signed by `-02`, certificate retained in the package | 201, signed by `-02`; `certificates/` of A holds the certificate of `-02` | pass |
| 3a | the Core's verify of A (manifest and revision 1 by key 1, revisions 2 and 3 by key 2) | pass under the certificate of `-01` | ok true; the package's certificate is that of `-01`; trust list `[-01, -02]`, compromised `[]` | pass |
| 3b | the Core's verify of B | pass under the certificate of `-02` | ok true; the package's certificate is that of `-02` | pass |
| 3c | both exported by the Core on key 2 | COMPLETE, COMPLETE | COMPLETE, COMPLETE | pass |
| 3d | a receiver, with ONLY the download | both ok, not anchored, self-contained | A: `ok true, anchored false, selfContained true`; B: the same. Certificates in A's download: `device-certificate.pem` = `-01`, `certificates/<sha256>.pem` = `-02`; in B's: `device-certificate.pem` = `-02` | pass |
| 3e | anchored | A with both fingerprints ok; B with `-02` ok; A with `-02` ALONE fails (control) | ok; ok; `ok false`: `V-11 REVISION_CERTIFICATE_NOT_TRUSTED`, `V-13 CERTIFICATE_NOT_TRUSTED` | pass |
| 4a | key 1 marked compromised (Core running) | exit 0; one new entry; pointer still `-02` | exit 0; added `-01.compromised`; every earlier entry unchanged; trust list `[-02]`, compromised `[-01]` | pass |
| 4b | the first key signs nothing | `KEY_COMPROMISED` | `KEY_COMPROMISED` (the signer object kept since step 1) | pass |
| 4c | verify of A: stored digest and stored revision head match | a pass ONLY with `SIGNED_BY_COMPROMISED_KEY` | ok true, notices `[AUDIT_EXTRACT_NOT_SIGNED, SIGNED_BY_COMPROMISED_KEY]` | pass |
| 4d | B unaffected | plain pass | ok true, notices `[AUDIT_EXTRACT_NOT_SIGNED]` | pass |
| 4e | an export of A is refused; B as before | A `FAILED / SOURCE_VERIFY_FAILED`, nothing written; B COMPLETE | A `FAILED`, `SOURCE_VERIFY_FAILED`, archives of A still 2; B COMPLETE | pass |
| 4f | a wholly consistent package of the same item under key 1 with ANOTHER manifest digest, in A's place | FAILURE with the notice | ok false, `V-03 MANIFEST_NOT_OF_ITEM`, signatureOk true, notice `SIGNED_BY_COMPROMISED_KEY` | pass |
| 4g | a COPY of A tampered in the temporary folder (one number of the manifest changed, digest recomputed), in A's place | FAILURE | ok false, `V-03 MANIFEST_NOT_OF_ITEM`, `V-04 FILE_SIZE_MISMATCH`, `V-09 SIGNATURE_INVALID`, with the notice | pass |
| 4h | A back in its place | the pass with the notice | ok true, with the notice | pass |
| 5a | clock at 2031-10-13 (1,826 days later): THE BOOT | refused: `CAPTURE_SIGNING_KEY_UNUSABLE`, `CERTIFICATE_NOT_VALID_NOW` | refused at `capture.boot` with exactly that code and reason | pass |
| 5b | THE SEAL of a Core started now | `CERTIFICATE_NOT_VALID_NOW` at the load | `CERTIFICATE_NOT_VALID_NOW` | pass |
| 5c | THE SEAL of a Core started BEFORE the expiry that still runs | the design states the refusal at load only | the kept signer SIGNED; the product pipeline with it: `SEALED`; verify of either package: ok false, `TAMPERED`, `V-13 CERTIFICATE_NOT_VALID_AT_SIGNING` | observed (difference D-3) |
| 5d | THE VERIFY: the trust list with every certificate past its validity | the retained set does not ask the clock | trusted `[-02]`, compromised `[-01]` | pass |
| 5e | the rotation is the way out | exit 0; pointer `-03`; earlier certificates kept | exit 0; pointer `-03`; three certificates, the first two with their fingerprints | pass |
| 5f | THE BOOT after it | passes; `SYSTEM_BOOT` names `-03` | passed; seq 127 `signingKeyId -03`, fingerprint `4e0ecfc0...4d4e7186` | pass |
| 5g | THE VERIFY by the Core, both certificates past their validity NOW | A: pass with the notice; B: plain pass (a certificate is judged at the signing instant) | A: ok true with the notice; B: ok true | pass |
| 6a | the key names `DEMS-TEST-229`, the Core is configured as `DEMS-TEST-229B` | `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`, `OTHER_INSTALLATION` | refused at `capture.boot` with exactly that | pass |
| 6b | OPEN QUESTION of C79: NO configured installation id | unverified | refused at step `capture.boot`: `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`, reason `INSTALLATION_ID_NOT_KNOWN`; the step `sealing.installation-identity` is never reached; no line with `INSTALLATION_IDENTITY_NOT_CONFIGURED` | observed |
| 6c | neither id nor name configured | the same | the same code and reason | pass |
| 7 | package A: every file the seal wrote, 10 readings | one digest | 1 distinct digest (`4d4311ea...206b9032`) | pass |
| 7 | package B, 8 readings | one digest | 1 distinct digest (`f4a7d00b...0c356a03`) | pass |
| 7 | the five export archives, hashed at every later reading (9, 6, 6, 5, 1) | each as made | each 1 distinct digest | pass |
| 7 | the revision list of A against the table | same numbers and hashes; key 1, then key 2 | `1:-01 2:-02 3:-02`, hashes equal | pass |
| 8a | BEYOND THE BRIEF: a Core booted on `-03` that has not used its signer; rotation to `-04` while it runs; export of B | C77 and the comment at `signingNow`: a running Core "never goes over to another key than the one its boot checks judged" | export COMPLETE; the download's export certificate is that of `-04`; this Core's `SYSTEM_BOOT` (seq 134) names `-03` | observed (difference D-4) |
| 9 | the search for private-key encodings | 0 | 0 (section 4) | pass |
| 10 | removal | database dropped, directories gone | dropped 3 (the clone and the run's two templates), 0 remain; root and stand-in directory gone | pass |

**Step 7, how A was hashed.** "The bytes of package A" are the ten files the seal wrote (`session-manifest.json`, `signature.sig`, `device-certificate.pem`, both camera files, `fragments/fragments.json`, the three transcript files, the audit extract), one digest over `<name> <sha256>` lines, read after the seal and at the end of every step - also after A was moved aside and back in step 4 (two renames, no write). Files ADDED since the seal are named at each reading: `certificates/<sha256>.pem` (the certificate of the key that signed revisions 2 and 3) and the files of `export/`. The revision list is the one file a revision appends to; it is held against the table instead. "A's archive" in the sense of the export: `export/<id>.zip` of step 1 hashed at 9 later readings, that of step 3 at 6 - identical each time, also after the mark and after the refused export.

**The Verification cell.** Before-rotation package and revision verify after it: 3a. After-rotation ones name the new certificate: 2f, 2g, 3b. After the mark the first key signs nothing and its stored-digest package carries the named state: 4b, 4c (and 4f, 4g fail). The expired certificate refuses the start until a rotation: 5a, 5e, 5f. Every directory and database gone: 10, and counted from outside (section 4).

## 3. Observations that differ from the design (for the controller and row 230)

**D-4 (step 8a; security weight). A running Core CAN go over to a new key without a restart - when it had not yet used its signer.** `sealing-host/index.ts` loads the signer at its FIRST use (`signing ??= loadSealingSigner(...)`), not at boot. A Core that booted on `-03` and had sealed and exported nothing, rotated under it to `-04`, signed its next export with `-04`: a key no boot check of that process judged (4, 4b, 4b-2) and no `SYSTEM_BOOT` row of it names. `ACTIVE_KEY_CHANGED` protects only a signer that was loaded BEFORE the rotation (2b, 2c). Decision C77 and the comment at `signingNow` state the stronger property. Where it was shown: the export signature of a real booted Core; that a SEAL does the same follows from the same getter and was not run. A remedy (load at boot, or hold the signer to the key id the boot judged) is a product change: not made.

**D-3 (step 5c; security weight). A signer loaded before its certificate ran out still signs after it.** Before each signature the loaded signer asks the mark and the pointer, not the validity. The product pipeline SEALED with it on a clock past the validity, and the product verifier then judges that package `TAMPERED` (`V-13 CERTIFICATE_NOT_VALID_AT_SIGNING`). A Core that is not restarted across the end of its certificate's validity would seal sessions into packages its own verify refuses. The design (2.9, A9) states the refusal at load and at boot only. Shown on the kept signer object and the pipeline harness, not on a started Core.

**D-2 (step 2d). A transcript revision on a Core that was not restarted is signed by the NEW key at once.** The route loads the signer per request (row 225's finding). So after a rotation the same running Core refuses a seal and an export, and signs a revision with `-02` while its `SYSTEM_BOOT` names `-01`. This is what design 2.9 expects of a revision; it is not what C77 / row 226b DD-1 ("no switch without a restart") says of a running Core. The package verifies (3a): the question is which of the two statements is the rule.

**D-1 (step 2c). The export a running Core refuses after a rotation does not say why.** The job says `SIGNATURE_FAILED`; `ACTIVE_KEY_CHANGED` is in no log line of the Core. `evidence-export/export-manifest.ts` (the `catch` around `signing.sign`) drops the signer's error. The seal keeps the code as the cause of `SIGNER_FAILED` (row 226b). An operator is not told that a restart is the remedy.

Not differences, recorded:
- **C79's open question (6b):** with NO configured installation id the first and only refusal is 4b-2's, `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH` / `INSTALLATION_ID_NOT_KNOWN`, at step `capture.boot`. `INSTALLATION_IDENTITY_NOT_CONFIGURED` is not reached and not logged. The operator gets the less helpful of the two refusals, as C79 feared; the order is the controller's to fix.
- **A REFUSED start also leaves a `SYSTEM_BOOT` row naming the active key** (seq 126 names `-02` at the start refused for its expired certificate; seq 131 to 133 name `-03` at the three starts refused by 4b-2). Not judged here (SX-15 is row 209's); named for row 230.
- **A's download carries no file that says key 1 was marked** and an export made before the mark stays valid at its destination (stated limit, V4 of C80).
- With the active fingerprint alone, A fails at its destination also for revision 1 (`V-11`), not only for the seal: a receiver needs the fingerprint of every key that signed anything in the package (row 227b said so for the seal).

## 4. Secrets and removal

- Keys: four, each made by a command's function into `<temporary root>/data/signer`. None under the repository's `.data/`, none through row 61's fixture (its directory held the three stand-in programs only).
- The session never opened a key file, a wrap file or anything of `credential-store/`: of those it read names, modes, sizes and modification times (`lstat`). It read the public certificates, the pointer and the records.
- **Search for private-key encodings: 0 hits.** Seven needles (the armour words of a PEM private key; the head of an unencrypted Ed25519 PKCS#8 key as bytes, as hex text in both cases and as base64; the object id of an encrypted PKCS#8 key as bytes and as hex text) in five places: the transcript (36,695 bytes), every line of the three commands (36,667), the logs of every Core (72,587), the 137 audit rows (65,014), and 172 files below the temporary root - packages, export archives and their unpacked downloads, records, hand-over records, certificates, pointer, mark (770,729 bytes; 11 key files and key folders NOT opened). Positive control: each needle found when planted; the public certificates found by the same search. Because key files were not read, their own bytes were not needles (row 227b did that; this row's rule forbids it).
- From outside afterwards: the five run transcripts searched for the same encodings: 0 lines each. `scripts/secret-scan/count-only.mjs` over the result transcript and the driver folder: `TOTAL: 0 in 0 file(s)`. This record and `row_229.md`: 0.
- Removal, in the session: `databases dropped: 3 ...; remain with the run prefix: 0; failed drops: 0`; the temporary root and `.data/test-row61-row229-72505-1` gone. Counted from outside: 0 entries `dems-row229-*` in the temporary folder, 0 entries `test-row61-row229*` under `.data/`. The helpers' scratch folders lay below the root (`TMPDIR` of the process). Removal ALSO ON FAILURE is measured: runs 1 to 3 stopped early and each ended `dropped 3, remaining 0`, root gone.
- LEFT BEHIND: nothing of a run. The driver source `.cache/task4-row229/rotation-session.mts` stays (no data, no key, no log) so that row 230 can run the session again.

## 5. Runs

| Run | Result | Why |
|---|---|---|
| 1, 2, 3 | stopped in step 1, cleaned up | MY driver: a simulated session cannot pass its pre-check on the emptied selector (`sourceNotAssigned`); the selector fixture is now set per kind of app |
| 4 | ran to its end, 1 expectation not held | MY driver: (a) the frozen clock of the running Core made the new key look not yet valid (revision 503, export `SIGNER_UNAVAILABLE`) - `catchUp` added; (b) I expected the cause code in the Core's log for the refused export; it is not there (D-1) |
| 5 | `RESULT: every expectation of the session held (44 held, 4 recorded as observations, 4 difference(s) from the design)`, exit 0 | the result run |

More than two runs: every repeat followed a failure in my own new script. No workspace was touched, so no typecheck and no suite applies; no product or test file of a workspace was edited.

## 6. Where the scenario stops

- No step needed a product change and no seam was added. One thing is reached by moving, not by an option: the Core verifies only the package in the item's place, so the two other packages of 4f and 4g were put there and A moved back.
- A seal by a STARTED production Core of a recorded session (the production kinds do not record before row 88): the seal refusals are on the kept signer and the pipeline harness; D-4 was shown on an export, not on a seal.
- The terminal entries of the three commands and a person at a terminal (attended check H5).
- The Linux host profile (9A/H-nn); the file `src/index.ts` as a process.
- The receiver's verifier has no state for a compromised key (V4, C80): not testable yet.

---
*Generated: 2026-10-13 14:05*
