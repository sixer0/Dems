---
task: 2026-10-07_dems_real_capture_sealing
row: 85 (M7-W4) — verify v2, operation 41
agent: coder-execution
date: 2026-10-09
status: needs-review — the verifier, its Core unit, the route dispatch and their tests are built and green; operation 41 does NOT verify a real package in production yet (the verdict recorder does not exist: request filed, blocking)
tier: 3
---

# Row 85 — verify v2 (V-01 to V-14), operation 41

## 1. What was built

| Part | Where (file:line) | Real or stand-in |
|---|---|---|
| The 14 checks, pure logic behind ports | `packages/shared/src/evidence-verify/verify.ts:667` (`verifyPackageV2`), V-01 `:178`, V-13 `:217`, V-09 `:257`, V-02/V-07 records `:303`, V-04/05/06/08 `:366`, V-10 `:533`, V-11 `:556`, V-14 `:638` | real |
| Result shape, failure codes (61, each bound to one check and one class), ports | `packages/shared/src/evidence-verify/types.ts` (`PackageVerifyResult`, `VERIFY_FAILURES`, `PackageReader`, `FragmentOpener`, `VerifyExpectations`) | real |
| `transcript-revisions.json` schema as V-11 reads it | `packages/shared/src/evidence-verify/revisions.ts` | this row's reading: no spec fixes the members (§5 D-85-4) |
| Package folder as a reader: chunks, read only, no link followed | `apps/core-server/src/evidence-verify/package-reader.ts:32` | real |
| Core unit: item -> folder -> checks -> contract body -> recorded -> answered | `apps/core-server/src/evidence-verify/index.ts:177` (`createRealEvidenceVerification`), `:143` (`contractBodyOf`), `:112` (`corePorts`) | real logic; **not wired** (nothing calls it outside tests) |
| Operation 41 dispatch | `apps/core-server/src/modules/evidence/index.ts:231`; seam `real-verification.ts:44` (`evidenceVerification(app).provide`) | real |
| Test package builder + tamper tools | `apps/core-server/src/evidence-verify/__tests__/support.ts` | real bytes, SHA-256, chain, AES-256-GCM, Ed25519 of a throw-away key; random bytes instead of fMP4; the cipher is a **test double** of row 84's |

**Where the logic lives: shared.** The Core and a receiver of a copy (§G.2) must run one set of rules, so they sit beside the package format, platform neutral (zod, `@noble/hashes`; a static test holds it). The Core supplies the file system, row 83's `readSigningCertificate` / `verifyEd25519` and a native SHA-256. Row 83's shared functions are used as they are (`parseManifestV2`, `manifestHashMatches`, `fragmentsJsonMatchesManifest`, `detachedSignatureOf`, `nextFragmentChainHash`); `verifyManifestSeal` is server code and cannot be imported by shared — a test asserts the two agree.

**v1 is untouched.** The route asks the provided verification first; it answers `null` for every item that has no real sealed package, and that item takes the hosted `verify` exactly as before. No verification is provided in any app today, so today every item — the 13 dataset items, the 14 v1 demo packages — takes the old path. The module's eight static rules stand; two pinned lists gained the one new file.

**Dispatch key (decision D-85-1).** Not `manifest_version` alone: the mapping derives it from `transcriptSha256`, so simulated parity items read 2 and have no folder. The unit's `findItem` decides ("a real sealed v2 package": `integritySource = REAL`); the on-disk `schema` is then checked by V-01 (`dems.evidence-manifest/1` answers `MANIFEST_VERSION_UNSUPPORTED`).

## 2. The 14 checks — pass case, tamper case, outcome

Every row is a test in `verify-v2.test.ts`; "exactly" = the list of failing checks is asserted as a whole.

| # | Pass on a sealed package | Tamper | Failing checks (asserted) | Class / code |
|--|--|--|--|--|
| V-01 | yes | not JSON; field removed; wrong type; v1 schema; no manifest | V-01 (others SKIPPED, never PASS); V-01+V-03; V-01+V-14 | UNREADABLE / MISSING |
| V-02 | yes | signed-wrong fragment count; chain head; overlapping range; `fragments.json` one nonce char or one byte of white space (SEC35-11); removed; fragment sealed for another position / track / offset (SEC35-10); wrong session key | exactly V-02 (removed: V-02+V-14) | CORRUPT; TAMPERED `FRAGMENTS_JSON_MISMATCH`; `GCM_RECORD_MISMATCH` |
| V-03 | yes | one text edited; other byte form of the same value; `signedDigest` edited; whole package swapped for another sealed one (anchor) | exactly V-03 | TAMPERED |
| V-04 | yes | one byte in one fragment — **for each of the 10 fragments**: that `(trackId, seq)` and no other; truncated tail; cut mid-file; two fragments reordered; a fragment swapped between cameras; files swapped; clear header/tail byte; appended bytes; file gone | V-04+V-06+V-08 (V-05 SKIPPED/BLOCKED); clear byte: V-04+V-05; gone: V-04+V-14 | TAMPERED; MISSING |
| V-05 | yes (all 10 ranges opened) | wrong sealed file plaintext hash; wrong fragment plaintext hash (names it); none recorded; no session key at the Core; range above the limit | exactly V-05 | TAMPERED; MISSING `SESSION_KEY_UNAVAILABLE` |
| V-06 | yes | recorded chain hash wrong (sealed wrong): exactly V-06, CORRUPT, V-08 stays PASS; altered bytes: chain broken **from that fragment** | V-06 | CORRUPT / TAMPERED |
| V-07 | yes | gap; duplicate; offsets not increasing | exactly V-07 | CORRUPT |
| V-08 | yes | one-fragment tamper is classified TAMPERED and named; a chain break without altered bytes is not called tampering | with V-04, V-06 | TAMPERED |
| V-09 | yes | signature value altered; field edited + hash recomputed + `signature.sig` rewritten; **`fragments.json` and manifest edited consistently, hash recomputed, no signature**; **re-signed with another key**; `signature.sig` removed / unreadable / other key ID | exactly V-09 (removed: +V-14) | TAMPERED; MISSING |
| V-10 | yes; DISABLED = declared absence | one byte of `.json` / `.srt` / `.vtt`; file removed; not the item's transcript (anchor) | exactly V-10 (removed: +V-14) | TAMPERED; MISSING |
| V-11 | yes, 2 revisions; after rotation with the retained certificate | body text; hash; parent link; order; dropped last revision (count anchor); another revision's signature; **per-revision certificate**: removed, a file of that name holding another certificate, wrong certificate claimed, none recorded, a stranger's key with its certificate retained | exactly V-11 | TAMPERED; MISSING |
| V-12 | interrupted package: `ok: true`, `interrupted: true` | interrupted + tampered fragment; flag removed after sealing | V-04+V-06+V-08+V-12; exactly V-03 | TAMPERED |
| V-13 | yes | signed outside validity; other certificate; one altered character; none; not trusted | exactly V-13; V-09+V-13; +V-14 | TAMPERED; MISSING |
| V-14 | yes; `export/`, `certificates/<sha>.pem` allowed | declared file removed; file nobody sealed; a link in place of a camera file | exactly V-14; V-04+V-14 | MISSING; TAMPERED `UNEXPECTED_FILE`; UNREADABLE |

**The stated limit, pinned by a test.** A manifest re-signed with another key **and** its certificate put in place is self-consistent: a verifier without anchors answers `ok: true` (SEC35-06). The anchors catch it — trusted certificates: exactly V-13; the sealed digest of the item: exactly V-03. The Core unit always passes both; `VerifyExpectations` is how a receiver passes the certificate hash it got out of band.

**Verdict rule.** `ok` = every check PASS. A check with nothing to read is SKIPPED (`BLOCKED`), never PASS. One allowed skip: V-05 for `KEY_UNAVAILABLE`, only when the caller asked (`plaintext: 'WHEN_KEY_AVAILABLE'`, a holder of ciphertext only, OD-03). At the Core the plaintext check is required: no key = V-05 FAIL.

**Streaming bound.** A camera file is never held whole: it passes the hashes in the reader's chunks (1 MiB; a test measures the largest chunk). With a session key one sealed range at a time is held (GCM authenticates a whole message), at most 64 MiB; a larger one fails V-05 and is still hashed in chunks. Manifest and `fragments.json` are read whole (limit 64 MiB each; they grow with the number of fragments, not with media size).

**Result, logs, errors.** A finding holds a code, a class and a place (track, fragment, package-relative file, member path, revision number): no hash, nonce, tag, key, signature or host path (test). The units log nothing; a failure of the run reaches the envelope as any unexpected failure. `at` is one clock reading per run; the frozen body is what is recorded and answered; a verdict that could not be recorded is not answered, and the simulator is not used in its place (route test).

## 3. Commands and results (2026-10-09)

| Command | Result |
|---|---|
| `npx vitest run --root apps/core-server --project unit src/evidence-verify` | 67 passed (60 checks + 7 Core unit / route) |
| `... src/modules/evidence/__tests__/{routes,static,media,cursor,export-request}.test.ts` | routes: 79 passed, **1 failed = the known-red MODG test, same test, same diff** (`routes.test.ts:198`, the registry area holds 10 operations); 6 new seam tests green; static: all green incl. 2 new |
| `... test/static` | 3 failed, none in a row-85 file: `credentials.test.ts` x2 (`adapters/local/__tests__/mic-helper.generated.test.ts:176`), `log-calls.test.ts` (`src/transcription/*`) |
| `npx vitest run --root packages/shared test/evidence-verify.test.ts test/demo-evidence.test.ts` | 25 passed (v1 verifier untouched) |
| `npx tsc --noEmit -p apps/core-server` / `-p packages/shared` | 0 errors in row-85 files; foreign: `src/sealing/**` (9), `test/evidence-package.test.ts:453` |
| `npm run lint -w @dems/core-server`, `-w @dems/shared` | exit 0 |
| db tests | none: the route path of this row opens no database |

**Mutation proof** (production check mutated in place, tests run, file restored; SHA-256 before = after = `5e92e743…2023e`; 67 green afterwards). 17 of 17 red:

| Mutation | Red tests |
|---|--:|
| V-02 `fragments.json` equality removed | 1 |
| V-03 manifest hash removed | 3 |
| V-04 fragment stored hash always true | 10 |
| V-04 whole-file hash removed | 4 |
| V-05 file plaintext hash inverted | 46 |
| V-05 missing key no longer a failure | 2 |
| V-06 chain over disk bytes removed | 8 |
| V-07 sequence gap removed | 2 |
| V-08 classification removed | 1 |
| V-09 signature removed | 5 |
| V-10 transcript hash removed | 1 |
| V-11 revision signature removed | 3 |
| V-11 any retained certificate file accepted | 1 |
| V-12 interrupted prefix removed | 1 |
| V-13 certificate hash removed | 1 |
| V-14 unexpected file removed | 2 |
| `ok` always true | 55 |

## 4. What is NOT proven

- **`M7-VV-SRV` and `M7-TP-1` are not met as written**: they need a package sealed by row 82 from row 59's fMP4, row 84's cipher and a database item. What is proven is the same assertions on packages of this row's builder.
- The AAD layout of the test double is row 84's as its header states it; the product `openFragment` was never run against this verifier.
- No audit row, custody entry or `verification` state is written for a real item: the recorder is a stand-in in every test.
- No real `transcript-revisions.json` exists; revision fields outside `body` (author, reason, time) are under no hash in this row's reading.
- `audit-session-extract.jsonl`: existence only — the manifest holds no hash of it.
- ECDSA-P256 (class C-8): no verifier here; such a signature does not verify (fails closed).
- A decrypted export (§G.2) is not a mode of the verifier yet: it verifies the sealed (ciphertext) layout only.
- Concurrency: nothing limits parallel verifications of large files by holders of `EVIDENCE_VIEW`.

## 5. Decisions taken (for the controller)

| # | Decision | Why |
|---|---|---|
| D-85-1 | Dispatch on "the item has a real sealed package" (`integritySource = REAL`), the manifest version then checked from the file | `manifest_version` is derived from `transcriptSha256`; simulated v2-shaped items have no folder and must keep the old path |
| D-85-2 | V-02 byte ranges: ascending, non-overlapping, inside the file — **not** "gapless from file start, sum == bytes". The whole file is hashed against `tracks[].sha256` and its length against `tracks[].bytes` (reported under V-04) | the literal rule contradicts §B.10's example (offset 1259) and cap §D.1; the whole-file hash leaves no byte unprotected |
| D-85-3 | Anchors from outside the package are part of verification (item's sealed digest, IDs, transcript hash, revision count, trusted certificates) | without them a swapped or re-signed package passes |
| D-85-4 | `transcript-revisions.json` = `dems.transcript-revisions/1`; retained certificates at `certificates/<sha256>.pem`; a revision without a recorded certificate fails | neither is fixed by a spec; request filed |
| D-85-5 | A file nobody sealed fails V-14 (TAMPERED); `export/`, `composite/` and retained certificates are allowed | "missing/extra file"; row 82 must leave no temporary file in a sealed folder |
| D-85-6 | The contract body is answered as the registry defines it today; the per-check and per-fragment report exists (`run().report`) but is not in the response | the schema is strict and not this row's file; request filed (rows 87 / 141) |
| D-85-7 | Body flags: `manifestOk` = V-01, 02, 03, 07, 12, 14; `signatureOk` = V-09, 13; `transcriptOk` = V-10, 11 (absent when DISABLED); `plainOk` false when not checked | every failing check must turn one flag false |
| D-85-8 | A stored-bytes failure by truncation is TAMPERED (`FRAGMENT_BYTES_TRUNCATED`); V-05 of an altered file is SKIPPED, not FAIL | "a stored byte differs from the sealed value"; M7-TP-1 "everything else passes" |

## 6. To wire

| When | What |
|---|---|
| **verdict recorder (request, blocking)** | an internal action that records a verdict the Core computed (audit `EVIDENCE_VERIFIED` / `EVIDENCE_VERIFY_FAILED` with `manifestOk`, `signatureOk`, `failedTracks`; custody; item state); then one place provides: `evidenceVerification(app).provide(createRealEvidenceVerification({ findItem, packageDirOf, now, opener, trustedCertificateSha256, record }))` |
| row 84 (request) | `FragmentOpener` from `coreCredentialStore(app).sessionKeys` + `openFragment`; needs one entry in `CREDENTIAL_STORE_USERS` |
| row 82 | the folder of a session (`sessionPackageDir` is the §A.1 tree form); the signer directory -> `trustedCertificateSha256` (`readStoredCertificate`); no stray file in a sealed folder; `findItem` from the evidence state; then `M7-VV-SRV`, `M7-TP-1` on a sealed fake package |
| row 59 | real fragment geometry: confirm D-85-2 against the writer's table |
| op 85 / revisions writer | write `dems.transcript-revisions/1` and the retained certificate |
| row 141 | V-15 = a 15th entry of `checks` + a `sources` member of `PackageVerifyResult` and of the body |
| row 87 | the report in the response (schema request) |
| OD-02 / §F.4 | EV-0005 re-scripted on one fragment — needs v2 demo packages (not this row) |

## 7. Device / browser checks left for the M7 gate (one scripted flow)

Fake session -> seal -> web WB-04 and mobile MB-07: verify PASS with file rows -> alter one byte of one fragment on disk -> verify FAIL naming the file (and the fragment once the schema carries it), transcript / signature rows PASS -> audit shows `EVIDENCE_VERIFY_FAILED`, the per-run verdict stays pinned -> a v1 demo item still verifies as before.
