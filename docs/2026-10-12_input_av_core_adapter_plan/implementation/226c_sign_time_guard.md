---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 226c
package: M11 | X1-4
date: 2026-10-13
agent: coder-execution (driver of row 226c)
tier: T3
requirements: decision C81 (the four differences of test/229), C77 (no switch without a restart), C79 (the boot's door pattern); design 05 sections 2.5, 2.7 (3), 2.10, A2; SX-09
status: complete
---

# Row 226c - the sign-time guard: bound to the boot's key, valid at signing, and a refused export says why

Branch `task4/input-av-core-port`, working tree on `0f5d2a8e` with the uncommitted work of the waves. Nothing committed. Existing files were changed with the Edit tool only; new files: this record and `delegation_progress/row_226c.md`.

## 1. The three defects, as found in the code

| # | Defect (test/229) | Where it was |
|---|---|---|
| 1 | D-4, D-2: a running Core that had not yet loaded its signer signs with the NEW key after a rotation; a transcript revision is signed by the new key at once | `sealing-host/index.ts`: `signing ??= loadSealingSigner(...)` at the FIRST use, and nothing knew which key the boot judged. `modules/transcripts/routes.ts` loaded the active key at each request (`loadCoreSigner`). The signer's own question (row 226b) compares the pointer with the id of ITS load, so it depends on the order of load and rotation |
| 2 | D-3: a signer loaded before its certificate's end signs after it | `capture/signer/host-key.ts`: a load is handed an INSTANT (`now`), not a clock; `stillSigns` asks the mark and the pointer only |
| 3 | D-1: a refused export says `SIGNATURE_FAILED` and nothing names the cause | `evidence-export/export-manifest.ts` (not this row's file) catches the signer's error without keeping it; `host.ts` caught a failed taking of the signer the same way |

## 2. What was built (paths relative to `apps/core-server/`)

| File | Change |
|---|---|
| `src/capture/signer/host-key.ts` | NEW `signerHeldToBoot(loaded, hold)` and the type `SignerHold { bootKeyId: string or null; now: () => number }`. Pure: opens nothing. When the hold is MADE and before EACH signature: `ACTIVE_KEY_CHANGED` (naming the boot's key) when the signer is not of the key id the boot judged; `CERTIFICATE_NOT_VALID_NOW` when the clock is outside the certificate's validity; then the signer's own questions of row 226b follow (the store, the mark, the pointer names its id). Header paragraph "A RUNNING CORE HOLDS ITS SIGNER TO ITS BOOT". `loadSoftwareSigner` and `stillSigns` are unchanged, line for line |
| `src/capture/signer/index.ts` | exports `signerHeldToBoot`, `type SignerHold` |
| `src/capture/signer/types.ts` | comments of `CERTIFICATE_NOT_VALID_NOW` and `ACTIVE_KEY_CHANGED` say the new use. NO new member |
| `src/capture/boot/index.ts` | THE ONE HAND-OVER. `CaptureBootControl.judgedSigningKey(): string or null` - a door of the control beside `provideHost` / `provideInstallationId` (the same pattern; no mount member, no new seam kind). `storedSigningKeyReaders` gains a fourth reader `loadedKeyId` over the SAME one load (it asks the store nothing; the pinned count of `load({ dir: directory, now })` stays 3); `signingKeyQuestionsOf` hands that reader out through a fifth argument; the boot step sets the judged id AFTER `runCaptureBootChecks` returned (a refused start judges nothing). 661 lines (635 before): +26, one line changed. `boot/checks.ts` NOT edited: blob `3dfea759` before and after |
| `src/sealing-host/index.ts` | `signingNow` hands the kept signer out ONLY through the hold: `signerHeldToBoot((signing ??= loadSealingSigner({...})), { bootKeyId: captureBootControl(app).judgedSigningKey(), now })`. A signer of another key than the boot's is refused and DROPPED (the process keeps no key its boot did not judge; its certificate is handed to nobody). NEW: `provideRevisionSigner(app, () => signingNow())` - a transcript revision is signed by the same held signer as a seal and an export (the transcripts module's existing door; that module is not edited). Comment block "HELD TO THE BOOT" |
| `src/evidence-export/host.ts` (item 3 only) | NEW `exportSignerWithRefusal(take)`: the signer of a job with its `sign` watched; keeps the NAMED refusal (`SignerError`: code and key id) of the taking or of a signature, forgets it when the next job takes the signer. NEW `reportExportSignerRefusal(app, failure, refusal)`: for the two codes a signer can cause (`SIGNATURE_FAILED`, `SIGNER_UNAVAILABLE`) one error line of the Core and one entry of the persistent error log, source `evidence-export.signer`, code = the job's code, context `jobId, evidenceId, signerReason, signingKeyId`. `provideCoreEvidenceExport` takes every job's signer through the watch and says the reason before the failure row is committed |

### Item 1 - where the binding holds, and where today's behaviour is kept

- **REAL_PRODUCTION and REAL_DEVELOPMENT: bound.** READ, not assumed: boot check 4 (`checks.ts` line 462, `deps.signingKeyProblem()`) loads the store in BOTH real operations; 4b and 4b-2 are production only and judge that same load (row 211). So in both real operations the boot loaded ONE certificate and `judgedSigningKey()` answers its key id once the step passed. The brief names REAL_DEVELOPMENT as an operation "where no boot check judges a key": that is not what the boot does - check 4 does. DRIVER DECISION D-1 below.
- **SIMULATED: today's behaviour, exactly.** The boot step is inert (nothing is inspected), the sealing host is not mounted (`INERT`), no export job exists, and the transcripts route loads the active key itself at each request (`loadCoreSigner`), as before this row. Nothing of this row runs there.
- **A real-operation app whose boot key is a TEST'S SEAM, or whose boot step has not passed**: the door answers null; the key rule is the one of row 226b (bound to the first load); the clock rule holds. No product composition can be in this state: the mount's argument members are pinned literally (AD-08) and carry no key seam.

### Item 2 - the code

`CERTIFICATE_NOT_VALID_NOW` IS in the signer's refusal set and IS the reason boot check 4 refuses an expired certificate with (`CAPTURE_SIGNING_KEY_UNUSABLE`, reason `CERTIFICATE_NOT_VALID_NOW`; row-229 step 5a). So the guard uses it: no new reason, no member of a shared type, no request to V4 for this item. The clock is `app.clock.now()` - the clock the boot step hands check 4.

### Item 3 - the code stays, the reason is said

The job's `failureReason` (operation 87: one code) and the audit row `EVIDENCE_EXPORT_FAILED` (three keys, C3 section 5.2) are unchanged: neither has a member for a second reason, and both are contracts outside this row (packages/shared is V4's). The signer's reason is in the Core's log and its persistent error log, for that job. A CLIENT is therefore not told; one line in `file_requests.md` asks for the ruling.

## 3. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| D-1 | REAL_DEVELOPMENT is bound to its boot's key like REAL_PRODUCTION | check 4 loads and judges the key there (section 2); binding by "the boot's own load" needs no reader of the operation in the signer host and leaves no real operation unbound |
| D-2 | Transcript revisions go through the host's ONE kept, held signer (no longer a load per request) in both real operations | C81: "a seal and a transcript revision alike". The call-sites pin allows the host one `loadSealingSigner(` call, so a second per-request load in the host was not open to me; one held signer for every taker is also the simpler rule. Effect: after a rotation or a mark a revision is refused (503 `SIGNING_KEY_UNAVAILABLE`, the signer's code in the log) until restart - what C81 rules |
| D-3 | The refusal for "not the boot's key" names the BOOT'S key id (`ACTIVE_KEY_CHANGED (CORE-KEY-EVSIGN-NN)`), also when the signer at hand is of the new key | it is the key this Core is held to, and what row 226b names in the early order |
| D-4 | The lazy order ends an export `SIGNER_UNAVAILABLE` (the signer could not be TAKEN), the early order `SIGNATURE_FAILED` (it did not sign) | both are the job's existing closed codes; refusing at the taking means nothing ever reads the certificate of a key the boot did not judge. The reason is the same in both (`ACTIVE_KEY_CHANGED`) |
| D-5 | The hold is applied by the taker (`signingNow`), not inside `loadSealingSigner` | `sealing/signing.ts` is not this row's file and its one line is pinned by `active-key-call-sites.test.ts`. LIMIT, stated: after a rotation the lazy load opens the NEW key's file before the hold refuses and drops it; nothing is signed and the object is not kept |

## 4. Tests

New cases, all extending existing files (driver rule 7); every key is generated by the test in a directory of the temporary folder that the file's `afterAll` removes and asserts gone. No key under `.data/`, none through row 61's fixture (the database case uses that fixture's directory for the stand-in WORKER PROGRAM only, as row 227b does). No key content is read by a new case.

| File | Cases added | What they hold |
|---|---|---|
| `src/capture/signer/__tests__/sign-time-guard.test.ts` | 6 (5 -> 11) | the lazy order (rotate before the first load -> `ACTIVE_KEY_CHANGED` naming the boot's key; CONTROL: the unheld load signs with the new key); the early order through the hold; validity at signing with both bounds, the unheld CONTROL, and "key change is named before validity"; `bootKeyId` null = row 226b's rule plus the clock; **a BOOTED PRODUCTION Core** - the real mounted boot step (`mountCaptureBootChecks`, its own readers of the store) - rotated BEFORE its first signature: door null before the boot, the first key after it, the first signer the Core takes refused; the restarted process judges the second key and signs; the door is null after a REFUSED boot, with key seams, and for an expired certificate |
| `src/evidence-export/__tests__/export.test.ts` | 5 (26 -> 31) | the product `exportPackage` with the composition's held and watched signer: rotated then marked while the Core runs (`SIGNATURE_FAILED`, refusal `ACTIVE_KEY_CHANGED` then `KEY_COMPROMISED`, nothing written); signer cannot be taken, lazy order and past validity (`SIGNER_UNAVAILABLE`, reason kept and said); validity ends between taking and signing; CONTROLS (other failure codes, nameless errors, no refusal: nothing said; the watched signer signs as the one handed in); the wiring text of `host.ts` |
| `src/evidence-export/__tests__/export-trust-list.db.test.ts` | 1 (1 -> 2) | THE RUNNING CORE on a throw-away database (REAL_DEVELOPMENT, real boot, real store): lazy -> job `FAILED / SIGNER_UNAVAILABLE`, log and error log `ACTIVE_KEY_CHANGED` + the boot's key, failure row = three keys, no archive; restart -> the door names key 2, export COMPLETE; second rotation -> `SIGNATURE_FAILED` with the reason; a Core on a manual clock past its certificate's end -> `SIGNER_UNAVAILABLE` with `CERTIFICATE_NOT_VALID_NOW` |
| `src/sealing-host/__tests__/sealing-host.test.ts` | 1 (25 -> 26) | the wiring: one load inside one hold; the three takers (seal port, export jobs, revision signer) take `signingNow` and nothing reads the kept signer otherwise |

**Existing tests changed: NONE.** No existing case, expectation or pin was edited. Two pins of files I do not own were HIT by my first version and satisfied by changing my code, not the pin: G-R2 "no file names a key file" (its needle `signer[-_.]?key` matched the expression `signer.keyId` in my new function: the local is now `inner`); C46 (three consecutive lines of the boot step pinned as text: my statement between them was moved into the argument list). `one-load-mount.test.ts`, `capture/__tests__/static.test.ts`, `sealing/__tests__/active-key-call-sites.test.ts`: unedited and green.

## 5. Checks (commands from `apps/core-server`, `--maxWorkers=2`)

| Check | Result line |
|---|---|
| Unit: signer, sealing, sealing-host, evidence-export, evidence-verify, capture/boot, capture static, adapters static, capture/fence, modules transcripts / sealing / evidence, `test/static` | run 1: `Tests 2 failed, 1413 passed (1415)` - the two pins above, both in MY code; run 2 (after the fix, with two more folders): `Test Files 96 passed (96)`, `Tests 1655 passed (1655)`. The sealing-host case was added after it: `Test Files 1 passed (1)`, `Tests 26 passed (26)` |
| Database, the extended file (sandbox off, `.locks/db-migrate.lock`) | `Test Files 1 passed (1)`, `Tests 2 passed (2)`; teardown `dropped 2 database(s) ... 0 remain`. THREE runs: runs 1 and 2 failed in my own new case (the test's engine clock and then its manual clock stood behind the state the first case stored - `ENGINE_CLOCK_WITHOUT_FLOOR`); product code unchanged between them |
| Database suites of sealing / verify / export / transcripts / fence (export-e2e, export-restart, production-key-proof, last-resort, finalize-transcript, stt-states, transcript-routes, transcripts, fence, sealing-notice-doors, modules/evidence) | one run: `Test Files 17 passed (17)`, `Tests 245 passed (245)`; teardown `dropped 3 database(s) ... 0 remain` |
| Typecheck `tsc --noEmit` (core-server; no other workspace touched) | exit 0, no output |
| Row-229 driver re-run (section 6) | `RESULT: every expectation of the session held (46 held, 1 recorded as observations, 0 difference(s) from the design)`, exit 0 |
| Secret scan (`scripts/secret-scan/count-only.mjs`) over the files of this row | `TOTAL: 4 in 1 file(s)` - all four in `export.test.ts` and the same four at `HEAD` (the planted needles of its secret-sweep cases); 0 in every other file, 0 in the re-run's transcript and the driver folder |

NOT RUN: the full suites (the controller's); `sealing-host/__tests__/e2e/seal-e2e.db.test.ts`, `kill-matrix`, `development-session-e2e` - they start the capture worker and bind ports 8554 / 8556, which a driver may not use.

## 6. The row-229 driver, re-run

Command (repository root, sandbox off, database lock): `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && node --import tsx ../../.cache/task4-row229/rotation-session.mts'`.

Run 1: `DIFFERENCES FROM THE DESIGN: 0`, `RESULT: 1 expectation(s) did NOT hold: 5c` - MY edit of the driver read the harness's error log before the pipeline ran. Run 2 (result): `DIFFERENCES FROM THE DESIGN: 0`, `RESULT: every expectation of the session held (46 held, 1 recorded as observations, 0 difference(s) from the design)`. 44 -> 46 held: +3 (2d, 5c, 8a are expectations now), -1 (the archive of step 8 no longer exists, so its step-7 row is gone). The one observation left is 6b (C79's question, answered in C81). Removal as before: `dropped 3, remaining 0, failed 0`; temporary root and stand-in directory gone; private-key search 0 hits.

| Step | Before (run 5 of row 229) | Now |
|---|---|---|
| 2c (D-1) | `FAILED / SIGNATURE_FAILED`; signer codes in the log: none | the same job code; signer codes in the log: `ACTIVE_KEY_CHANGED` |
| 2d (D-2) | 201, revision 2 signed by key 2 on the Core that was not restarted | HTTP 503 `SIGNING_KEY_UNAVAILABLE`, no revision 2 stored, log names `ACTIVE_KEY_CHANGED`; after the restart revision 2 is signed by key 2 (2g) |
| 5c (D-3) | the kept signer SIGNED; pipeline `SEALED`; verify `CERTIFICATE_NOT_VALID_AT_SIGNING` | refused `CERTIFICATE_NOT_VALID_NOW` at the signature and at the taking; pipeline `FAILED` at `SIGN_MANIFEST`, `SIGNER_FAILED`, that cause in its error log, no signature file, no item |
| 8a (D-4) | export COMPLETE, signed by key 4; `SYSTEM_BOOT` names key 3 | export `FAILED / SIGNER_UNAVAILABLE`, log names `ACTIVE_KEY_CHANGED`, nothing downloaded; `SYSTEM_BOOT` names key 3, pointer key 4 |

**What was changed in the driver (Edit tool, the four differences only):**
- 2c: the pass condition and the expected text now INCLUDE the signer's code in the Core's log.
- 2d: an observation became an expectation (503, reason, no stored row, the code in the log); one `const` for the logged codes.
- 8a: an observation became an expectation (job code, reason in the log, boot key and pointer, nothing signed by the new key); one `const` for the logged codes.
- 5c: MORE THAN AN EXPECTATION, and said plainly: the session's double of "the signer the running Core holds" was the loaded object itself. The Core no longer hands that object out; so step 5c now takes the SAME object (`held2`) through the product's hold (`signerHeldToBoot`, key 2, a clock standing at the last valid instant and then set to the session's late instant) - for the builder and for the product pipeline - and one import was added for it. The loaded object by itself still signs (the unit CONTROL shows it): what changed is that no taker of the Core gets it unheld.
- NOT changed: steps 2b and 4b still use the unheld object `held1` and still hold (`ACTIVE_KEY_CHANGED`, `KEY_COMPROMISED` are the store's own questions); every other step, helper and the result line's wording.

## 7. What stays unproven, and limits

- A SEAL by a STARTED Core of a recorded session after a rotation (the product pipeline reading `ports.signing` of the host): held by the wiring case and by the pipeline harness with the held signer (row-229 2b, 5c); not run end to end (the e2e needs the capture worker and ports a driver may not bind). In the lazy order the seal fails at its first read of the signing port (`BUILD_MANIFEST`), `SIGNER_FAILED` with `signerCode` in the error log; that step is retriable, so the way out retries and then raises the blocked-seal alert - not run here.
- A transcript revision in the LAZY order on a started Core: the revision takes the same `signingNow` as the export that WAS run in that order (database case, row-229 8a); the route itself was run in the early order only (row-229 2d).
- The demo seed hook (`sealing-host/demo-seed/seed-hook.ts`) loads its own signer and is not held; it accepts the development key only. Named in `file_requests.md` for row 230.
- The hold compares; the store is asked by the signer's own questions, so the stated limit of row 226b stands: a mark or a rotation in the instant between the question and the signature is seen by the next signature.
- A second run of the boot step on one app would keep the id of an earlier pass until it passes again (the readiness plugin runs each step once per boot).
- No Linux host, no hardware, no real device: nothing of this row depends on one.

## 8. Requests

Two lines in `delegation_progress/file_requests.md`, neither blocking: (1) a contract member for the signer's reason on the export job body and the failure row (packages/shared, `core/audit-details.ts`) - ruling wanted; (2) information for row 230: the seed hook's own signer, and that a new caller of `loadSealingSigner` would not be held.

---
*Generated: 2026-10-13 14:35*
