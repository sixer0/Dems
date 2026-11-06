---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 227
package: M11 | X1-4
date: 2026-10-13
agent: coder-execution (agent K2)
tier: T3
requirements: SX-09 (c), (d); Known limit 30
status: needs-review (the Core's verdict is built and checked; the remainder is listed under "needs-review: the exact remainder")
---

# Row 227 - the retained certificate set in the Core's own verify

## What was built (paths relative to `apps/core-server/`)

| File | Change |
|---|---|
| `src/capture/signer/host-key.ts` | `readRetainedCertificates({ dir, ownerUid? })`, `RetainedCertificateRefusal`, types `RetainedCertificate`, `RetainedCertificateSet` (new, exported) |
| `src/capture/signer/index.ts` | five names added to the export of `host-key` |
| `src/sealing/signing.ts` | `sealingVerifyTrust({ dataDir, production })` and `SealingVerifyTrust` (new); one import line |
| `src/evidence-verify/index.ts` | `SigningKeyVerdict`, `COMPROMISED_KEY_NOTICE_CODE`, `COMPROMISED_KEY_NOTICE_REPORT` (new); option `compromisedCertificateSha256`; member `revisionHeadSha256` of `RealEvidenceItem`; member `signingKey` of `RealVerificationRun`; the run of `createRealEvidenceVerification` |
| `src/sealing-host/index.ts` | the composition of operation 41: `trustedCertificateSha256` and `compromisedCertificateSha256` from `sealingVerifyTrust`; `findItem` states the revision head of the database |
| `src/capture/signer/__tests__/retained-certificates.test.ts` | new, 5 cases |
| `src/evidence-verify/__tests__/retained-certificates.test.ts` | new, 6 cases |
| `src/sealing/__tests__/active-key-call-sites.test.ts` | re-stated expectations (below) |

## The rules, as built

**(c) Which certificates the Core's verify trusts.** Read from `<dataDir>/signer` at EACH run (a rotation or a mark is seen by the next verification without a restart; a verify loads no key).

| Rule | Built |
|---|---|
| Every certificate parsed and self-verified before it is trusted | `readRetainedCertificates`: each `<key id>.crt` goes through `readStoredCertificate` - the store's one reader (no link followed; a regular file of this user that others cannot write; bounded) and `readSigningCertificate` (it parses, is Ed25519, its self-signature verifies). One that fails is named in `refused` (`CERTIFICATE_INVALID`) and is not in the set; it never makes the read fail |
| Which key ids | a key id of the series AT OR BEFORE the active one (the one resolver). A foreign name: `NOT_OF_THE_SERIES` |
| A key provisioned and never active (row 225's information line (2)) | NOT trusted (`NEVER_ACTIVE`): the Core sealed nothing under it. It is trusted from the moment a rotation makes it active |
| Other names of the store (`ACTIVE`, `ACTIVE.<id>.next`, `<id>.provisioned.json`, key files) | not looked at |
| Development-marked certificate, `REAL_PRODUCTION` Core | in NEITHER list of `sealingVerifyTrust` - not trusted, and not admitted through the compromised path either |
| A store that cannot be taken (directory a link / foreign / reachable by others; a pointer that cannot be read) | no set: both lists empty, V-13 fails `CERTIFICATE_NOT_TRUSTED` (fail closed) |

**(d) A package under a key marked compromised.** The certificate of a marked key is never in the trusted list, so such a package fails the first run. Only when the store names marked certificates AND the first run rests on an untrusted certificate, the package is verified once more with the marked certificates admitted:

| Outcome of the second run | State (`RealVerificationRun.signingKey`) | Verdict |
|---|---|---|
| still rests on an untrusted certificate (a foreign key) | `NOT_COMPROMISED` | the first run's failure |
| passes, the stored manifest digest is a real digest (the verifier held the manifest to it: `MANIFEST_NOT_OF_ITEM` otherwise), and - where the item has transcript revisions - the head of the package's revision chain equals the head the database holds | `COMPROMISED_KEY_STORED_DIGEST` | PASS, with the notice `SIGNED_BY_COMPROMISED_KEY` in the answer |
| anything else (another digest, another revision head, a head the caller did not state, any other failure) | `COMPROMISED_KEY_NOT_STORED_DIGEST` | FAILURE, with the notice; a guard throws if such a run were ever about to answer a pass |

"The digest the Core's database stored" is `evidence_items.manifest_hash` as the engine state holds it (`item.manifestHash`), which was the anchor of every run before this row. The revision head is `transcript_revisions.sha256` of the last revision (`revisionHead` of the transcript store); the chain is hash-linked, so the head anchors every revision body.

## Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| The store's set | `npx vitest run --project unit src/capture/signer/__tests__/retained-certificates.test.ts --maxWorkers=2` | run 1: `1 failed, 4 passed` - my own expectation (the order of the refused names); run 2 with the next file: passed |
| The Core's verify | `... src/evidence-verify/__tests__/retained-certificates.test.ts` | first run; `Test Files 2 passed (2)`, `Tests 11 passed (11)` for the two files |
| Every database-free suite of signer, sealing, boot, verify, export, sealing host, transcripts, evidence, fence, the static rules, the commands | `npx vitest run --project unit src/capture/signer src/sealing src/capture/boot src/evidence-verify src/evidence-export src/sealing-host src/modules/transcripts src/modules/evidence src/capture/fence src/capture/__tests__/static.test.ts test/static test/cli --maxWorkers=2` | `Test Files 95 passed (95)`, `Tests 1656 passed (1656)` |
| Database: sealing, verify, export, transcripts on throw-away clones | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2` on `export-e2e.db`, `modules/evidence commands.db`, `production-key-proof.db`, `recover-failed-seal.db`, `transcript-routes.db`, `stt-states.db`, `last-resort.db` | `Test Files 7 passed (7)`, `Tests 74 passed (74)`; `0 remain with the run prefix` |
| Typecheck | `npx tsc --noEmit` | no error |

Not run (the controller's, per commit): `sealing-host/__tests__/e2e/seal-e2e.db.test.ts` (worker processes and ports), the kill matrix, the acceptance suites.

The Verification cell, case by case:

| Cell | Case (`evidence-verify/__tests__/retained-certificates.test.ts` unless named) |
|---|---|
| a package sealed under the earlier certificate verifies after a rotation | (c) case 1: sealed under `-01`, rotation to `-02`, a plain pass with `NOT_COMPROMISED`; CONTROL: with the active certificate alone (the behaviour before this row) the same package fails `CERTIFICATE_NOT_TRUSTED` |
| under a compromised key the stored-digest package gets the named state | (d) case 1: `COMPROMISED_KEY_STORED_DIGEST`, `ok: true`, the notice in the answer, the answer parses under the contract schema, recorded once |
| a package with another digest fails | (d) case 1: a second, wholly consistent package of the same item, signed with the SAME key before the mark and put in the item's place: `COMPROMISED_KEY_NOT_STORED_DIGEST`, `ok: false`, `MANIFEST_NOT_OF_ITEM`; CONTROL: before the mark that package verified as its own item |
| a development certificate in the directory is not in the trusted list of a production Core | (c) case 3: alone, beside a production key, and marked compromised; CONTROL: a development Core trusts it and the package passes there |
| (cell text) every certificate parsed and self-verified | `capture/signer/__tests__/retained-certificates.test.ts` case 3: an edited certificate, a file that is none, a link, a file the group can write, a foreign name - each refused by name, the rest kept |
| (information line 2) never-active key | store case 2; verify (c) case 2 |
| (driver decision) revisions under the compromised key | (d) case 2: the stored head passes with the state; another head and an unstated head fail |
| fail closed | (c) case 4, store case 5 |

## Expectations of existing tests changed

One file, `src/sealing/__tests__/active-key-call-sites.test.ts`, case "each call site is the one line":

1. the count of `activeSigningKeyId(` in the store: 5 -> 6 (4 -> 5 was row 226b), with the new line pinned by its text;
2. `expect(host).toContain('signingNow().certificate.sha256')` is now `not.toContain`, and the verify lines of sealing-host are pinned as the two calls of `sealingVerifyTrust({ dataDir: app.config.dataDir, production: ... })` plus the store read of `sealing/signing.ts` - what row 225's information line (1) asked for. `NAMED_KEY_READERS` is unchanged: the reader that hands a key id to `readStoredCertificate` is in the store's own file.

Every other existing signer, sealing, transcript, verify and export test ran unedited.

## SX-09, letter by letter

| Letter | State |
|---|---|
| (a), (b), (e) | rows 225 / 226 |
| (c) retained set: parsed and self-verified; development never trusted in production | DONE in the Core's own verify (operation 41). LEFT: the export's own verification (below) |
| (d) compromised key never a plain pass | DONE for the VERDICT of the Core's own verify, and stated in the answer. LEFT: the shared vocabulary / clients, the audit row, the receiver's verifier (below) |

## needs-review: the exact remainder

1. **The new member of the shared verifier (the cell's own condition).** The answer of operation 41 carries the state as a notice `SIGNED_BY_COMPROMISED_KEY`. The contract schema admits it (an open code form), so nothing fails; but `VERIFY_NOTICE` and the description of `notices[].code` in `packages/shared` do not name it and no client words it. Not edited (another agent's package). Request left.
2. **The receiver's verifier** (`evidence:verify-export`) has no state "signed by a key later marked compromised" and no database to anchor to: a shared member and an input of marked fingerprints. Request left with (1).
3. **The export's own verification** (`evidence-export/host.ts`) still trusts the active certificate alone: after a rotation, exporting a package of the earlier key is expected to fail (read in the code, NOT run). Not in my area. Request left.
4. **The audit row and custody entry of a verification** do not carry the state (a pass under a compromised key is recorded as a pass). The engine's door is not mine. Question left for row 230.
5. **Other holders of a trust list**: `readSealedSourceMark` takes `trustedCertificateSha256` from its callers (the reset guard); not inventoried here.

## Doubles and what stays unproven

- Packages are the row-85 builder's (real Ed25519, real AES-256-GCM, the product verifier), not seals of a running Core; the composition lines of `sealing-host/index.ts` are held by their text and by the unedited database suites, not by a database case that rotates a key under a started Core (row 229, the rotation scenario).
- "The thief" is the test signing before the mark. A package under a compromised key with the SAME digest as stored is, by the hash, the stored package.
- A certificate file of another user cannot be made without root (the directory-level owner refusal is exercised, as in rows 210 / 225).
- Whoever may write the signer directory as the Core's user can add a self-verifying certificate at or before the active id: the set trusts what the store holds (the stated limit of the store, design 2.3).
- Linux: macOS only here.

## DRIVER DECISIONS (for the controller)

1. **A never-active key is not trusted** (row 225's question (2)).
2. **Only key ids of the series are read**; a foreign `.crt` name is refused.
3. **The trust set is read per verification**, not cached and not from the loaded signer: a verify needs no usable key (an expired or marked ACTIVE key no longer makes every old package untrusted).
4. **A development certificate marked compromised is in neither list** of a production Core.
5. **Two runs of the verifier** for a package under a marked key (the first with the sound certificates only), so the named state is decided by the product verifier and no manifest is parsed a second way.
6. **Transcript revisions are anchored to the database's revision head** under a marked key; a caller that does not state the head gets a failure.
7. **The state travels as a notice code of the Core** until the shared member exists; the row is returned `needs-review` for that, as the cell says.

## Files

Changed with the Edit tool: `host-key.ts`, `signer/index.ts`, `sealing/signing.ts`, `evidence-verify/index.ts`, `sealing-host/index.ts`, `active-key-call-sites.test.ts`, `delegation_progress/file_claims.md`, `file_requests.md`. New with Write: the two test files, this record, `delegation_progress/row_227.md`.

---
*Generated: 2026-10-13*
