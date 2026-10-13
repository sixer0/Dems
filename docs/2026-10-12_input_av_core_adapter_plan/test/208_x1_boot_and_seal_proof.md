---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 208
package: M11 | X1-1 (proof)
date: 2026-10-13
agent: test-expert (wave 10, agent X2)
tier: 2
status: complete
requirements: design 05 sections 2.10, 2.11 (rows "Boot checks", "Seal"); SX-05 (the load the command ran is the boot's); SX-17 (no boot file edited)
---

# Row 208 - proof of X-1 against the real boot function and the seal (tests only)

Branch `task4/input-av-core-port`, working tree on top of `0f5d2a8e` with the uncommitted work of batches 9 and 10. NO product file was written. Paths are relative to `apps/core-server/`.

## 1. What was found

| # | Proof (the row's Verification cell) | Result | Evidence |
|---|---|---|---|
| 1 | Checks 4 and 4b pass on the command's store with neither seam injected | **HOLDS.** A whole `REAL_PRODUCTION` start of the real app factory on a clone passes the step `capture.boot` (line `CAPTURE_BOOT_CHECKS_PASSED`); none of the three refusals of checks 4, 4b, 4c is written | case "PROOF 1 and PROOF 3", section 4 |
| 2 | A store of the same form made by the development function is still refused by 4b | **HOLDS.** The same start, same configuration, same kind of clone; only the store differs: refused at step `capture.boot` with `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION`, reason null; it is the only line of the boot checks | case "PROOF 2" |
| 3 | The sign step does not raise `DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES`; the signature verifies against the certificate whose fingerprint the command printed | **HOLDS at the level of the pipeline** (section 3): `SEALED`, `developmentSources=false`, the journal row of `SIGN_MANIFEST` names the printed fingerprint, the verifier passes all its checks with ONLY the printed fingerprint trusted | case "PROOF 1 and PROOF 3" |
| 4 | Every temporary directory is gone after the run, also on failure | **HOLDS, measured on a failed run** (section 5) | `afterAll` + a count from outside |

Why it matters: row 206 proved "OK means 4 and 4b pass" by inference - a hand-made mount whose checks 1 to 3 were answered by stated facts, refused AT 4c by a stated number. Here no check is stated: the first production start will meet exactly this code path, except for the host (section 6).

## 2. How proof 1 and 2 go further than row 206

File: `src/sealing/__tests__/production-key-proof.db.test.ts` (new; 3 cases; project `db`).

| Element | Row 206, case 11 | This row |
|---|---|---|
| The mount | `mountCaptureBootChecks` called by the test | the capture unit's own (`src/capture/index.ts:327`, hands `timers` and `sinks` only) inside `buildApp` - the test CANNOT hand in a key seam |
| Checks 1, 2 (worker program) | stated facts | the real inspector on row 61's stand-in script |
| Check 3 (evidence volume) | stated facts | the real probe, on `<data dir>/media/sessions` |
| Checks 4, 4b | the step's own readers | the step's own readers (the same; now inside a whole boot) |
| Check 4c | told "7 operators" | the real count on PostgreSQL (`storedDemoPasswordOperators`) over hash sets the product's hasher made |
| Checks 4d, 4e | not run (before row 85) | run, on the explicit test host `provideTestCaptureHost` and `testHostPrograms` (C46, C55 DD-3) |
| Check 5 (handshake) | never reached | the stand-in worker is started and says HELLO |
| Outcome | refused at 4c | the step PASSES; `captureBootControl(app).outcome()` is `REAL_PRODUCTION` |
| The store after the boot | - | names, modes, owners, sizes and modification times unchanged (`lstat` only) |

The data directory of the configuration IS the command's `--data-dir`. The negative control uses `runDevKeyCommand` on a fresh directory and asserts first that both stores have the same three names with the same modes.

## 3. Where the seal proof stops, and why

**It begins at the session port of the pipeline and stops there going backwards.** Proven: `createSealingPipeline(...).run` - `BUILD_MANIFEST`, the real `signManifestStep` (`src/sealing/pipeline/pipeline.ts`, the rule at the line that names `DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES`), `signManifest`, the package files - with `ports.signing` = what the seal's own loader `loadSealingSigner` reads from the store the boot just accepted.

NOT proven: that four all-production source rows reach that port from a recording. In the product the port is filled by `createSealSessionReader` (`src/sealing-host/session-reader.ts`, its read of `session_capture_sources`). Before the class-C lift (row 88, not done) no product path writes a row of kind `ONVIF_RTSP` or `USB_AUDIO`: `loadProductionAdapters` (`src/capture/adapters/real.ts`) loads the class-C stubs, which have no opener, and the registry refuses to open them (`src/capture/adapters/registry.ts`, `SOURCE_KIND_NOT_RECORDABLE`). The four rows are therefore STATED by the test (the sealing harness's `facts.sourceRows`), with the production kinds and the harness's own device ids. Nothing was loosened to get further: no adapter was given an opener and no row was written into a database by hand.

Also not the product's: the recorded media and the fragment cipher of the harness (`pipeline-support.ts`, as in every pipeline test).

The fingerprint chain that was asserted, each link by a different reader:

| Link | Read by |
|---|---|
| the 64 hex characters after `certificate: sha256` in the command's output | the test, from `run.lines` only |
| = `loadSealingSigner(...).certificate.sha256` on that store | the signer store |
| = `checkpoint.certificateSha256` of the journal row `SIGN_MANIFEST` | the pipeline |
| = `pemCertificateSha256` of the package's certificate file | the verifier's own function (`packages/shared/src/evidence-verify/verify.ts`) |
| the package verifies (`ok`, `PASS`, no check that is not `PASS`) with `trustedCertificateSha256 = [printed]` | `verifyPackageV2` |
| CONTROL: with another fingerprint trusted the same package answers `CERTIFICATE_NOT_TRUSTED` | `verifyPackageV2` |

The negative control repeats at the seal: the development store's signer on the same four rows fails `SIGN_MANIFEST` with `DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES`, nothing sealed, no signature file.

## 4. Runs

Command, from `apps/core-server`, sandbox off (PostgreSQL, a child process):
`/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/sealing/__tests__/production-key-proof.db.test.ts`

| Run | Time | `capture/boot/index.ts` sha256, before and after the run | Result |
|---|---|---|---|
| 1 | 12:13:14 | `47946c29...82b2f3d` / same | `Tests 2 failed | 1 passed (3)` - MY OWN test: the stated source rows named devices `CAM-11...` that the harness's tracks do not have (`MANIFEST_INVALID` at `BUILD_MANIFEST`). Both BOOT halves had already passed; the failures were at the pipeline lines |
| 2 | 12:13:41 | `47946c29...82b2f3d` / same | `Test Files 1 passed (1)`, `Tests 3 passed (3)`; `0 remain with the run prefix` |
| 3 (end) | 12:15:33 | `47946c29...82b2f3d` / same | `Test Files 1 passed (1)`, `Tests 3 passed (3)`; `0 remain with the run prefix` |

Full hash: `47946c29357990129069df054b24153441c9cf0e63e0ba0f28cad00ac82b2f3d`.

**The state BEFORE row 211 was not run.** At 12:07, when this row began reading, the file hashed `ce29691801775be8d0d4053c4718eb4498c4848562238d5122792bd56b11996e` (two loads, one per reader). Row 211 wrote the file at 12:11:25, before this row's test existed; all three runs saw the state AFTER it. What stands for the earlier state: the test names no internal of the boot folder (it cannot depend on which of the two forms the readers have), and row 206's case 11 ran on the earlier form. That is an argument, not a run.

`capture/boot/checks.ts`: `d201004b6710458674ad0fc861d872e4355fa05b607a03f313aec53ba510dd94`, not edited.

Other checks: `npx tsc --noEmit` - 4 errors, none in this row's file (section 7). Static rules (`test/static`, `src/sealing/__tests__/stt-states.test.ts`, `src/capture/__tests__/static.test.ts`): 260 passed, 2 failed, neither about this row (section 7).

## 5. Temporary directories

| Made | Where | Removed |
|---|---|---|
| each key store (1 production, 2 development per run of the file) | `mkdtemp` under the real path of the temporary folder, prefix `dems-row208-` | `afterAll`, which then asserts each is gone |
| the stand-in worker, relay and guard scripts | row 61's fixture `.data/test-row61-row208-<pid>-1` - NO key is put there | `afterAll`, asserted gone |
| recordings and packages of the seal | the sealing harness's own scratch | `removeRecordings`, `removePackages`; asserted gone |
| clones | one per case | `afterEach`, also for a failed case |

Measured from outside after run 1 (which FAILED) and after runs 2 and 3: 0 entries `dems-row208-*` in the temporary folder, 0 entries `test-row61-row208-*` under `.data/` (names counted only).

## 6. What stays unproven

- The host. Steps 4d and 4e ran on the test host (not Linux; its runner starts nothing): a production host is hardware check 9A/H-nn and gate 223 / X-G.
- A real worker: the handshake is a stand-in script.
- The seal from a recording of production kinds (section 3): after row 88.
- The state of `boot/index.ts` before row 211 (section 4).
- The sealing host's lazy load of the signer inside the booted Core (`sealing-host/index.ts`, `signingNow`) is not exercised: the test calls the same loader on the same directory itself.

## 7. Red that is not this row's

| Place | Likely owner |
|---|---|
| `src/capture/__tests__/static.test.ts`, case "SR-2: the third destination is the destination rule's own answer" (G-R9) | row 143b (source address at every dial) |
| `src/capture/__tests__/static.test.ts:616`, case "the client never leaves the file" (G-R10 / G-R11; `read(candidate, signal, sourceAddress?)`) | row 143b |
| typecheck: `packages/shared/src/api/core-api.ts` (2), `packages/shared/src/api/capture-discovery.ts` (1) | row V3 |
| typecheck: `src/modules/capture-config/network/facts.ts` (1) | the network-facts row (108) |

## 8. Driver decisions (for the controller to confirm)

| # | Decision |
|---|---|
| DD-1 | ONE new test file, in the sealing unit's tests, project `db`. The seal half needs no database, but it signs with the store the boot of the same case accepted - one chain on one store. Cost: the unit gate does not run it (the unit gate keeps `pipeline-development-key.test.ts`, whose third case is the same rule on a throw-away key) |
| DD-2 | The three stand-in programs lie in row 61's fixture below `.data/` (as in `fence.db.test.ts`): the boot's real path rule refuses a program below the temporary folder. No key goes there; R-X1-8 is about keys |
| DD-3 | The command's directory rule is answered for the directories ABOVE the test's root by row 206's double (`aboveIsSound`); nothing else of the command is doubled |
| DD-4 | Rule 7 says a new test extends the file of its subject. `production-key.test.ts` is a unit file and this proof needs PostgreSQL, so it is a file of its own |

Process: the new file was made with Write and corrected with the Edit tool (three edits); `file_claims.md` got one line with the Edit tool. Nothing was committed, staged or stashed.

---
*Generated: 2026-10-13*
