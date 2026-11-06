---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 227b
package: M11 | X1-4
date: 2026-10-13
agent: coder-execution (driver of row 227b)
tier: T3
requirements: SX-09 (c), (d) - the export's half; decisions C69, C77
status: needs-review (on ONE point: a package under a key marked compromised - see "needs-review")
---

# Row 227b - the export's trust list after a rotation

## The gap, as found

`provideCoreEvidenceExport` (`apps/core-server/src/evidence-export/host.ts`) handed the export jobs
`trustedCertificateSha256: [loaded.certificate.sha256]` - the ACTIVE certificate alone. `exportPackage`
verifies its source with that list before it writes anything (`package-export.ts`, step 2), so after a
rotation the export of a package sealed under the EARLIER key failed `SOURCE_VERIFY_FAILED`
(V-13 `CERTIFICATE_NOT_TRUSTED`). Row 227 read this in the code; here it is RUN (the control of the
unit case).

What the archive carries was already right and is not changed: `package-export.ts` copies every clear
file of the sealed package byte for byte - among them `device-certificate.pem`, the certificate that
SIGNED the package, and `certificates/<sha256>.pem` of its revisions - and adds the certificate of the
export signature as `certificates/<sha256>.pem` when it is another one. The package of the earlier key
simply never reached that step.

## What was built

| File | Change |
|---|---|
| `apps/core-server/src/evidence-export/host.ts` | NEW exported `exportTrustedCertificates({ dataDir, production })` = `sealingVerifyTrust(...).trusted` (row 227's one list); the wiring line `trustedCertificateSha256: () => exportTrustedCertificates({ dataDir: app.config.dataDir, production })`; `production = captureOperationOf(app.config) === 'REAL_PRODUCTION'`; two import lines (`../capture/fence`, `../sealing`); header paragraph |
| `apps/core-server/src/evidence-export/__tests__/export.test.ts` | EXTENDED: one import block, one `describe` (4 cases) appended. No existing case edited |
| `apps/core-server/src/evidence-export/__tests__/export-trust-list.db.test.ts` | NEW, 1 case (database) |

Nothing else of `evidence-export` was touched; nothing of `capture/signer`, `sealing`, `sealing-host`,
`evidence-verify`, `capture/boot`, `packages/shared`.

## The rules, as built

| Rule | Built |
|---|---|
| The list is the one the Core's own verify trusts | the same function, `sealingVerifyTrust`; a unit case holds the two equal. The export and operation 41 cannot disagree on a package |
| Parsed and self-verified first | by the store (`readRetainedCertificates`, row 227) before a digest is listed |
| A development-marked certificate, `REAL_PRODUCTION` Core | never listed: its package is not exported (`SOURCE_VERIFY_FAILED`, nothing written) |
| A never-active key | never listed |
| A key marked compromised | never listed: its package is NOT exported (below) |
| A store that cannot be taken | lists nothing: fail closed |
| When it is read | when a job starts (`ports()`), so a rotation or a mark is seen by the next job without a restart. The export SIGNER still needs the restart of decision C77 |
| Public certificates only | the function returns digests; the archive's certificate files are the package's own and the export signer's `pemText` |
| Nothing sealed rewritten, no manifest signed again | `host.ts` writes nothing; the cases compare every file of the sealed package outside `export/` before and after, and the export manifest names the SEAL's own key id and certificate |

`production` is read from the fence's one definition (`captureOperationOf`). The word `'REAL_PRODUCTION'`
is compared as a literal, held to the type by the compiler: the export is no wiring unit of the adapter
layer and may not import it (`capture/adapters/__tests__/static.test.ts`, "every importer is a wiring
unit" - my first version imported `CaptureOperation` from `../capture/adapters` and made that rule red;
fixed on my side, the static list not edited).

## What a receiver needs (design 05 section 2.6, spec C.3 "Rotation")

- With the archive ALONE (no fingerprint): both packages verify, `anchored: false` - "consistent with
  itself", the stated limit SEC35-06.
- Anchored: the receiver needs the fingerprint of EVERY key that signed what it receives - the earlier
  key's for the seal (and its revisions), the active key's for the export signature. With the active
  fingerprint alone the package of the earlier key fails `X-05:V-13:FAIL:CERTIFICATE_NOT_TRUSTED`
  (negative control of both tests). This belongs in the installer note: each hand-over record is kept
  and handed on. Request line left.

## A package under a key marked COMPROMISED

**It is not exported.** The job ends `FAILED` with `failureReason: SOURCE_VERIFY_FAILED`, one
`EVIDENCE_EXPORT_FAILED` row with that reason, nothing written to the package folder. An export made
before the mark stays where it is (not ruled here).

Why refused (DRIVER DECISION, conservative): the design speaks of the Core's VERIFY only (2.9, "a
notice, not a failure" - marked HYPOTHESIS) and has no word that lets such a package be exported;
SX-09 (d) and C77 say it is never a plain pass. The existing types cannot state the mark in an export:
`ExportManifestSchema.signature` is a strict object without a member for the key's state, and the
receiver's verifier has neither a notice for it nor an input of marked fingerprints. An export in
today's types would therefore be a plain pass at its destination.

**What waits for contract step V4** (request lines left, nothing of `packages/shared` edited):

1. `VERIFY_NOTICE` member `SIGNED_BY_COMPROMISED_KEY` that a verification without a database can raise,
   and the input `compromisedCertificateSha256?: readonly string[]` beside
   `expected.trustedCertificateSha256` (`packages/shared/src/evidence-verify/types.ts`);
2. the code `SOURCE_SIGNED_BY_COMPROMISED_KEY` in the open set of `failureReason` of operation 87, so
   the operator is told why;
3. then, in row 91's files: `keyState: 'COMPROMISED'` under the export signature, a port for the marked
   fingerprints, the second run of `evidence-verify`, and one more line in `host.ts`.

## Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| Unit, the export file | `npx vitest run --project unit src/evidence-export/__tests__/export.test.ts --maxWorkers=2` | run 1: `1 failed, 25 passed` - my own new expectation (the revision the earlier key signed is named too, V-11); run 2: `Tests 26 passed (26)` |
| Static rule files and every export unit suite (after the adapter-layer fix) | `npx vitest run --project unit src/capture/adapters/__tests__/static.test.ts src/capture/__tests__/static.test.ts test/static src/sealing/__tests__/active-key-call-sites.test.ts src/modules/evidence/__tests__/static.test.ts src/evidence-export --maxWorkers=2` | `Test Files 28 passed (28)`, `Tests 400 passed (400)` |
| Database, the new case | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db src/evidence-export/__tests__/export-trust-list.db.test.ts --maxWorkers=2` | first run: `Tests 1 passed (1)`; `0 remain with the run prefix` |
| Database, the existing export suites UNEDITED | same, `export-e2e.db.test.ts export-restart.db.test.ts` | `Test Files 2 passed (2)`, `Tests 2 passed (2)`; `0 remain with the run prefix` |
| Typecheck | `npx tsc --noEmit` | exit 0, no error |
| Left behind | `$TMPDIR` and `.data/` searched for `row227b` | 0 and 0 |

Not run (the controller's, per commit): the full suites, `seal-e2e`, the kill matrix.

The cases:

| Asked | Case |
|---|---|
| seal under key 1, rotate, seal under key 2, export both; the receiver verifies BOTH with only what the export contains | unit case 1 (the product `exportPackage` with the product list; `verifyExportAtDestination` on the unpacked archive alone, then anchored); database case (operation 42 -> 87 -> the signed download of a restarted Core; the DOWNLOAD verified) |
| CONTROL - the list before this row | unit case 1: the active certificate alone -> `SOURCE_VERIFY_FAILED`, no `export/` folder |
| a development-marked retained certificate is not exported by a production Core | unit case 2: refused, package untouched; what the production Core does export carries no development certificate; CONTROL: a development Core exports it |
| never-active key | unit case 3 |
| compromised key | unit case 3 (list, refusal, the earlier archive untouched, the other key still exported); database case (the job FAILED, its row, the folder unchanged) |
| no private key bytes in the export | unit case 1 and the database case: the archive file and every unpacked file searched for the PEM armour `PRIVATE KEY`, the DER head of an unencrypted Ed25519 PKCS#8 key (raw and base64), and each stored `.p8` and `.wrap` of the test's store raw, hex, base64 and in 24-byte slices; CONTROL: the public certificate is found by the same search |
| the wiring | unit case 4, by the text of `host.ts` |

## Expectations of existing tests changed

**None.** No existing export test pinned the content of the trust list of the composition; every one
ran unedited (`export.test.ts` got an import block and an appended `describe` only).

## Doubles and what stays unproven

- Packages are the row-85 builder's (real Ed25519, real AES-256-GCM; in the database case the product
  cipher and the product credential store), not seals of the product pipeline; the worker is row 61's
  stand-in program. The rotation is `provisionSigningKey` + `activateSigningKey` on the store, not the
  `evidence:rotate-key` command (row 226's own tests; the scenario is row 229).
- The database case runs in `REAL_DEVELOPMENT`. The `production: true` branch is proven on the function
  and on `exportPackage`; that a `REAL_PRODUCTION` Core's composition hands `true` is held by the text
  of the wiring line (a production boot needs the host doubles of C46 - row 229).
- Keys: generated by the tests in directories of the temporary folder, removed and asserted gone in
  `afterAll`; none under `.data/`, none through row 61's fixture (it holds the worker program only).
  Key files of those test stores are read only to search the archives; no assertion prints bytes.
- macOS only. No hardware check applies (9A/H: none for this row).

## DRIVER DECISIONS (for the controller)

1. A package under a compromised key is refused by the export until V4 (above).
2. The operation is compared as the literal `'REAL_PRODUCTION'` instead of importing the adapter layer.
3. The unit cases extend `export.test.ts` (driver rule 7); the database case is a file of its own - it
   needs its own key store, rotation and restart, which the module-level fixture of
   `export-e2e.db.test.ts` (row 61's `.data/` directory with a key) must not be given.
4. `signer()` null no longer empties the trust list: such a job fails `SIGNER_UNAVAILABLE` before its
   source is verified, as before.

## Files

Edit tool only on existing files: `host.ts`, `export.test.ts`, `delegation_progress/file_claims.md`,
`file_requests.md`. New with Write: `export-trust-list.db.test.ts`, this record,
`delegation_progress/row_227b.md`.

---
*Generated: 2026-10-13*
