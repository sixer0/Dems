---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 93
date: 2026-10-01
agent: coder-execution
narrative_tier: 3
status: complete
source_plan: identification/02_structured.md row 93; Parallel Execution Protocol P1–P13
decisions: D50, D51, D54, D61, D62
---

# 65: DEMO evidence packages (blueprint step 93)

Run on 2026-10-01 from 04:34 to 04:55 WIB, from `/Users/gsp-budi/Documents/DEMS`. **Outcome: PASS.** Every row-93 check passes (§1).

**One controller action is needed before steps 47, 53 and 83 can import the module.** `packages/shared/package.json` has no `"./demo-data"` entry in `exports`, so `@dems/shared/demo-data` does not resolve yet. Under P1, step 93 may not edit a `package.json`. The fix is one line and needs no install (§8, R-93-1).

**Outputs**

| Path | Content |
|---|---|
| `packages/shared/scripts/gen-demo-evidence.ts` | The generator: 1,476 lines, SHA-256 `8690271414623dae…`. It uses Node built-ins and `/usr/bin/zip` only |
| `packages/shared/assets/demo-evidence/` | 89 files, `du -sk` 2,960 KB: 14 `SESSION-<session ID>/` packages and a `README.md` |
| `packages/shared/src/demo-data/types.ts`, `verify.ts`, `index.ts` | Written by hand: the types, the pure verify helper and the lookups (312, 488 and 71 lines) |
| `packages/shared/src/demo-data/packages.generated.ts` | The generated typed index `DEMO_EVIDENCE_INDEX` (140,024 B) |
| `packages/shared/src/demo-data/documents.generated.ts` | The generated package texts `DEMO_EVIDENCE_DOCUMENTS` and the certificate PEM (128,731 B) |
| `packages/shared/test/demo-evidence.test.ts` | 18 tests, 513 lines |

**Not written by this step:**
- `src/sim/**`: it is only read, and `dataset.ts` is unchanged (mtime 03:02:34, SHA-256 `d73e24a4…`, as step 92 used).
- The demo-media assets, every `package.json` and lockfile, and `src/index.ts`. The root barrel does not re-export demo-data.
- The shared tracking files (P8).

No npm install ran, no long-lived process was started and nothing was committed. No private-key file exists anywhere (§1).

## 1. Row-93 verification

| Row-93 check | Result | Evidence |
|---|---|---|
| `demo-evidence.test.ts` passes: it recomputes every SHA-256 and verifies every Ed25519 signature and the certificate with Node crypto (`X509Certificate`) | **PASS** | `npx vitest run test/demo-evidence.test.ts --maxWorkers=2`: `Tests 18 passed (18)`. The test hashes 56 track files against the manifests and 14 manifests against their `signature.sig` digests. It verifies 15 Ed25519 signatures with `crypto.verify`: 14 manifests plus 1 export manifest. The certificate checks are `x509.verify(x509.publicKey)`, the subject, the validity against each signing time, and the key against the index |
| The tampered package fails exactly one check (its altered track) | **PASS** | Test "exactly one package is TAMPERED…": the failed checks are `['track:AUDIO-02']` for EV 0005 and `[]` for the other 13. The pure helper gives the same result (WebCrypto), and the generator refuses to publish if this does not hold |
| Every package holds the §11.2 items | **PASS** | Test "every package folder holds the §11.2 items and nothing unexpected". The file list must be exactly the 6 items, plus `media/AUDIO-02.m4a` for the tampered package and `export/*` for exported items |
| Every manifest holds the 13 §11.3 fields | **PASS** | Test "every manifest holds the 13 §11.3 fields": every `MANIFEST_FIELDS` key is present and not null, the four track IDs appear in order with SHA-256 values, and the finalization status matches |
| Every export zip's SHA-256 equals its export manifest | **PASS** | EV 0004: `shasum -a 256 EXP-000031.zip` gives `d888f5449d1eb552…9e97`, the same as `export-manifest.json` `package.sha256`. The test also parses the zip: 10 entries, sorted, no extra fields, each entry's SHA-256 equal to `export-record.json`, and the payload hashes equal to the sealed manifest |
| `grep -rn "node:" packages/shared/src/demo-data` finds nothing | **PASS** | exit 1, no output. The test repeats this scan |
| Shared typecheck exits 0 | **PASS** | `npm run typecheck -w @dems/shared`: exit 0 |
| No private-key file is written anywhere | **PASS** | The generator scans its stage for "PRIVATE KEY" before publishing, and the test scans every output file for "PRIVATE KEY" and key-file extensions. A grep of `packages/shared/{assets,src}` and the run logs for the raw seed (hex and base64) and for "PRIVATE KEY" gives exit 1. The key object is created in memory with `createPrivateKey` and never exported |

**Extra checks**

| Check | Result |
|---|---|
| `npm run lint -w @dems/shared`; `oxlint` on the 7 new files | exit 0; "Found 0 warnings and 0 errors" |
| `npm test -w @dems/shared -- --maxWorkers=2` (regression) | `Test Files 23 passed (23)`, `Tests 393 passed (393)`: 375 before this step plus 18 new |
| Deterministic re-run | Two `--out` scratch runs and the repository run give 91 of 91 files byte-identical (`shasum -a 256` lists, `diff` empty) |
| Mutation check | Three files were corrupted: a signature in 0001, one character in 0002's manifest, and one byte of the export zip. Result: 8 of 18 tests fail. After regenerating, the output is again byte-identical to the previous run (91 of 91) and 18 of 18 pass |
| Independent tools | `openssl x509` (OpenSSL 3.6.4) parses the certificate: subject `…OU=DEMO — NOT FOR PRODUCTION…CN=DEMS-IR-01 (DEMO — NOT FOR PRODUCTION)`, `CA:FALSE`, Digital Signature, Netscape Comment "DEMO certificate - NOT FOR PRODUCTION…". `openssl pkeyutl -verify -rawin` gives "Signature Verified Successfully" for 0001 and 0005. `unzip -tq` gives "No errors detected" |
| Altered track is still playable | `ffmpeg -v error -i …/0015/media/AUDIO-02.m4a -f null -` exits 0 with no errors: aac, 48 kHz, 42.000 s. 290 AAC frames were rotated between 29.720 s and 36.444 s (the subject's last answer) |
| Consumer compilers | `src/demo-data/index.ts` under the core-web settings (DOM lib, bundler, unused checks) exits 0. A probe there assigns the browser's `crypto.subtle` to `SubtleLike`. The same under Expo `tsconfig.base` (`customConditions: react-native`, `module: preserve`) exits 0 |
| `--as-of 2026-10-20` (scratch) | IDs re-dated (`EV-20261018-0001` …), signatures changed, certificate unchanged, **56 of 56 track hashes unchanged**, results PASS × 13 and FAIL × 1 (0005). A warning is logged because the media were made for 2026-10-01T10:00 |
| Error paths | `--as-of 2026-13-99`, `2026-10-01T25:00`, `1-10-2026`, `2025-06-01`, `2031-01-01` and `--bogus` each exit 1 with a structured error line and create no output folder and no stage folder |
| Two verifier implementations agree | For every package, the generator compares its Node-crypto checks with `verifyDemoPackage` (noble + WebCrypto) check by check, and fails the run if they differ |

## 2. Packages (`--as-of 2026-10-01T10:00`, the step-92 default)

| EV | Session | Subject | Status (sim) | Finalization | Signature purpose | Audit rows (seq, gaps) | Excerpt | Precomputed |
|---|---|---|---|---|---|---|---|---|
| 0001 | SES-20260929-0011 | Siti Rahma | SEALED | SEALED | SEAL | 6 (1–6, gaps 0) | 40 s | PASS |
| 0002 | SES-20260929-0012 | Budi Hartono | SEALED | SEALED | SEAL | 6 (7–12, gaps 0) | 40 s | PASS |
| 0003 | SES-20260930-0013 | Rudi Setiawan | UNDER_REVIEW | SEALED | SEAL | 7 (13–25, gaps 1) | 47 s | PASS |
| 0004 | SES-20260930-0014 | Maya Lestari | EXPORTED | SEALED | SEAL | 7 (19–39, gaps 1) | 41 s | PASS; export `EXP-000031` |
| 0005 | SES-20260930-0015 | Dewi Anggraini | SEALED | SEALED | SEAL | 6 (26–31, gaps 0) | 42 s | **FAIL (track:AUDIO-02)**, TAMPERED |
| 0006 | SES-20260930-0016 | Hendra Wijaya | RECORDED | INCOMPLETE | RECOVERY_ATTESTATION | 7 (32–38, gaps 0) | 43 s | PASS |
| 0007–0013 | SES-20261001-0017…0023 | today's 7 follow-ups | SEALED | SEALED | SEAL | 6 each (41–82) | 31–34 s | PASS |
| 0014 | SES-20261001-0024 | Ahmad Fauzi | SEALED (recording scenario) | SEALED | SEAL | 150 (83–232, gaps 0) | 38 s (live loops) | PASS |

## 3. Design

- **Layout (§11.2).** Each `SESSION-<session ID>/` folder holds:
  - `evidence-container.json`: stands in for the encrypted payload. It references the step-92 files by paths relative to `packages/shared/assets/`, and records `encryption: AES-256-GCM, applied: false`.
  - `metadata.json`: the descriptive record (status, lifecycle, custody). It is not signed.
  - `manifest.json`: the 13 §11.3 fields, keyed as in `MANIFEST_FIELDS`, plus `excerpt`.
  - `signature.sig`, `device-certificate.pem` and `audit-session-extract.jsonl`.
- **Hashing (§11.4, §12.2).** Each of the four track files is hashed and bound into the manifest, which also records its bytes, duration and codec. The SHA-256 of the manifest's exact bytes is signed.
  - `signature.sig` is JSON, so it can carry the DEMO label: `notice`, `digest` and a base64 `signature`, an Ed25519 signature over the 32 raw digest bytes.
  - `metadata.json` is kept outside the signature, because status and custody change after sealing.
- **DEMO key (D51).**
  - The seed is the SHA-256 of the published phrase `DEMO_SEED_PHRASE`. The Ed25519 key is built from it in memory through a PKCS#8 wrapper (RFC 8410) and is never exported. The public key is `a99fac18…c323`.
  - The certificate is a hand-built X.509 v3 DER: serial `70EF9B0B8CD04EE8A2E02DBF5634FE7B`, valid 2026-01-01 to 2030-12-31, not a CA, key usage digitalSignature, a subject key identifier, and a DEMO comment. It is the same file in every package, with SHA-256 `760be929…779a`.
  - `--as-of` must fall within the certificate's validity.
- **Audit extract.** The rows are the simulator's own, unaltered: `createIdleState(now)` for EV 0001–0013, and the `finalizing` scenario, ticked until SEALED, for EV 0014. The extract takes every row with the session's or the evidence's ID, plus the investigator's sign-in row just before them, with global `seq`, `prevHash` and `hash`.
  - Verification recomputes each row with `chainHash(prevHash, auditBody(row))` (the step-31 rule), requires `seq` to increase, and requires consecutive rows to link.
  - A jump in `seq` means rows of other sessions were left out; these gaps are counted.
- **Tamper.** EV 0005 AUDIO-02, the simulator's `DEFAULT_TAMPER_TRACK`, was altered after sealing: equal-size AAC frames of the last subject answer are rotated, so the file keeps its size and still decodes.
  - The altered copy is `SESSION-…-0015/media/AUDIO-02.m4a`, and the container points to it.
  - The manifest keeps the sealed hash, so only `track:AUDIO-02` fails. The manifest, signature, certificate and audit chain all pass.
- **Export (§19.2, §19.3).** Only EV 0004 is EXPORTED in the dataset (D51: zips only for exported items).
  - `export/EXP-000031.zip` is built with `/usr/bin/zip -X -D -n .mp4:.m4a` under `TZ=UTC`, from a staged tree with mode 0644 and the export time. It holds the 4 payload files, the sealed manifest, the signature, the certificate, the metadata, the audit extract and `export-record.json`.
  - `export-manifest.json` sits beside the zip because it records the zip's hash. It holds the 8 §19.2 items: payload, sessionManifest, signature, export, source, destination, package (hash and verification result) and authorization (purpose and audit row `AUD-000039`).
  - `export-manifest.sig` is the DEMO Ed25519 signature of the export manifest.
  - The source is verified before the zip is built (§19.3 rule 3), and the result is recorded.
  - The export ID `EXP-000031` is read from step 33's `CORE_API_EXAMPLES.exportEvidence`, which describes this same item. The reason and destination come from the dataset's `EVIDENCE_EXPORTED` row: "Prosecutor request", "Case file transfer (simulated)".
- **Runs.** Each run is staged in `$TMPDIR/dems-demo-evidence-*` and verified twice (Node crypto, then the pure helper). It is published to the repository last, pruning files that are no longer produced.
  - Structured JSON-lines logs go to `$TMPDIR/dems-gen-demo-evidence/run-*.jsonl`, with timestamp, level, source, correlationId, message, stack_trace and context.
  - On an error, the stage is kept and its path is logged.
  - Command: `cd packages/shared && node --import tsx scripts/gen-demo-evidence.ts [--as-of YYYY-MM-DD[THH:MM]] [--out <dir>]`.

## 4. API for consumers (steps 47, 53, 83): `@dems/shared/demo-data`

The module is framework-free and uses no DOM or Node built-ins. Paths are relative to `packages/shared/assets/` (export `@dems/shared/assets/*`).

| Export | Use |
|---|---|
| `DEMO_EVIDENCE_INDEX` (`DemoEvidenceIndex`) | `packages[]` (14 entries), `key` (keyId, publicKeyHex, seedPhrase), `certificate` (sha256, subject, serial, validity), `tamperedEvidenceSuffix` "0005", `exportedEvidenceSuffixes` ["0004"], `liveSession` {sessionSuffix "0024", evidenceSuffixWhenSealed "0014"}, `apiExamples`, `asOf`, `datasetNow` |
| `getDemoEvidencePackage(evidenceIdOrSuffix)` | Joins by the **evidence** suffix (D61): `EV-…-0004`, `"0004"` or `4`. A `SES-…` ID returns null |
| `getDemoEvidencePackageBySession(sessionIdOrSuffix)` | Joins by the **session** suffix. Note that session 0014 is evidence 0004 |
| `listDemoEvidencePackages()`, `demoIdSuffix(id, 'EV' \| 'SES')`, `demoAssetUrl(path, base)` | Helpers |
| `DemoEvidencePackage` | IDs and suffixes; `origin` (DATASET or RECORDING_SCENARIO); `status`; `finalizationStatus`; subject and investigator; ISO times at +07:00; `recordingDurationMs`; `excerptDurationMs`; `tampered` and `tamperedTrackId`; `files.{container,metadata,manifest,signature,certificate,auditExtract}` (`{path, bytes, sha256}`); `signature` (signedDigest, signatureHex, keyId, purpose, signedAt); `audit` summary; `export` (exportId, zip, manifest, signature, reason, destination, exportedBy, authorizationRef) or null; `verification` (the precomputed report) |
| `DemoTrackEntry` (`pkg.tracks[4]`) | `trackId`, `label`, `file`, `mediaType`, `durationSec`, `sealedSha256`, `stored` (the file to play and hash; the altered copy for 0005 AUDIO-02), `altered`, `poster`, `thumbnail`, and `mobile.{media,poster}` with the flat `file` name step 72 copies |
| `verifyDemoPackage(pkg, load, { trust: demoVerificationTrust(), subtle?, onCheck? })` | Web re-verification. `load(assetPath) → Promise<Uint8Array>`. It always recomputes the 4 track hashes, the manifest hash, the audit chain and the export zip hash. It checks the Ed25519 signature, the certificate self-signature and the export signature with WebCrypto where supported; otherwise those checks come from the precomputed report with `source: 'precomputed'`, and the report is labelled "DEMO - recomputed (some checks precomputed)". `onCheck` fires per check (for the animated list) |
| Single checks | `checkTrack`, `checkManifest`, `checkSignature`, `checkCertificate`, `checkAuditExtract`, `checkExportPackage`, `checkExportSignature`; also `sha256Hex`, `sha256HexOfText`, `parseAuditExtract`, `parseEd25519Certificate`, `pemToDer`, `decodeUtf8`, `checkOrder(pkg)` |
| `precomputedReport(pkg)` | Mobile: the generator's result, labelled "DEMO - precomputed" (the UI shows "verified by the Core"). PASS for 13 items; FAIL with `failed: ['track:AUDIO-02']` and expected and actual hashes for 0005 |
| `getDemoEvidenceDocuments(id)` → `{manifestJson, metadataJson, signatureSig, exportManifestJson}`; `DEMO_DEVICE_CERTIFICATE_PEM` | Mobile Metadata tab (04 §4.11 D5b). `manifestJson` is byte-exact: hashing it gives `signature.signedDigest` |
| `DEMO_EVIDENCE_INDEX.apiExamples` | Step 53: `sessionCreate.request` (the recording-scenario session; valid under `sessionCreateSchema`); `evidenceExport.{evidenceId, request, response}` (EV 0004, `EXP-000031`; valid under `EvidenceExportRequestSchema` and `EvidenceExportAcceptedSchema`) |
| `MANIFEST_FIELDS`, `EXPORT_MANIFEST_ITEMS`, `PACKAGE_ITEM_FILES` | Labels for the viewers: the §11.3, §19.2 and §11.2 wording with each key |

## 5. Decisions, drift and findings

| ID | Kind | Item |
|---|---|---|
| DR-93-1 | tech | The row says "a pure verify helper using @noble/hashes". Hashing uses `@noble/hashes`, which is already a shared dependency. `@noble/curves` is not installed and P1 forbids an install, so the helper checks Ed25519 through WebCrypto when available and otherwise falls back to the labelled precomputed result (row 47 describes the same fallback) |
| DR-93-2 | design | `signature.sig` is a JSON document carrying the base64 signature, not a raw 64-byte blob, so the file itself carries the DEMO label (P13). The signed message is the 32-byte SHA-256 of `manifest.json` |
| DR-93-3 | design | A package exists for 14 items: EV 0001–0013, plus EV 0014, the recording scenario's item. EV 0014's package comes from the simulator's `finalizing` scenario at `--as-of`: stopped at 09:59:58.4 and sealed at 10:00:04.51 WIB. Its media are the step-92 live loops. In a live demo the simulator seals 0014 at run time, so its times come from the simulator, while media and integrity come from the package (join by evidence suffix) |
| DR-93-4 | design | EV 0006 (RECORDED, the INCOMPLETE session after the power fail) has a full §11.2 package. Its manifest has `finalizationStatus: INCOMPLETE` and a `RECOVERY_ATTESTATION` signature, made at the SESSION_INCOMPLETE row time. It is still never sealed (§18.2), and integrity checks pass |
| DR-93-5 | data | The audit extracts are the simulator's rows at `--as-of`. Their `EVIDENCE_SEALED.details.manifestHash` is the **simulator's** synthetic manifest hash (sim `evidence.ts`), not the package digest; the simulator was not changed (the D51 ruling). Likewise, the simulator's `EvidenceItem.tracks[].sha256` and `SIMULATED-SHA256` signature differ from the package values. Consumers show package integrity data whenever a package exists |
| DR-93-6 | data | The simulator lists the device certificate as "ECDSA P-256 (simulated)" (`security.keys`), while the DEMO packages use Ed25519 (D50/D51). Show the package certificate from `DEMO_EVIDENCE_INDEX.certificate` in integrity views |
| DR-93-7 | design | Folders are named `SESSION-<full session ID>` (for example `SESSION-SES-20260930-0015`), following §11.2. Re-dating renames them, so consumers must use index paths, never literals |
| DR-93-8 | design | Only verified assets carry hashes in the index. Posters, thumbnails and the mobile renditions carry `{path, bytes}` only (P13: never hard-code hashes) |
| DR-93-9 | data | Export reason: the package follows the dataset ("Prosecutor request"). Step 33's OpenAPI example uses "Case file handover for prosecutor review" with the same `EXP-000031` |
| F-93-1 | finding | A consumer with a Vite `import.meta.glob` must glob both `demo-evidence/**` and `demo-media/**`: the container and `tracks[].stored.path` point into `demo-media/` for pristine tracks |

## 6. Runs

| When (WIB, from the run logs) | Command | Result |
|---|---|---|
| 04:45:56 | `--out <scratch>/out1` (first draft) | exit 0, 91 files. Review then fixed the codec labels, the manifest key order and the size of the stills' refs |
| 04:47:01 | `--out <scratch>/out2` | exit 0; the altered AUDIO-02 decodes (ffmpeg exit 0) |
| 04:48:40 | default (repository) | exit 0; 91 files written, 0 pruned |
| 04:49:32 | default (repository), after the lint fixes | exit 0; the output is unchanged |
| 04:49:44 (two runs) | `--out det1`, `--out det2` | 91 of 91 byte-identical to each other and to the repository |
| 04:49:53 | `--as-of 2026-10-20 --out redate` | exit 0; see §1 |
| 04:49:59 | 6 invalid-argument runs, first attempt | zsh passed each option and value as one word, so all six stopped at "Unknown option"; this was the test loop's mistake, not the generator's. They exited 1 with no output |
| 04:50:04 | the same 6 runs, words split | each exits 1 with the expected message (§1) and no output |
| about 04:50:10 | mutation: 3 corrupted files, then the test | 8 of 18 fail |
| 04:50:16 | default (repository), restore | exit 0; 91 of 91 byte-identical to the 04:49:32 output; 18 of 18 pass |

Timing: a full run takes 0.2–0.3 s. No process was left running.

## 7. Persistent issues

None. No check needed more than one repair cycle. The typecheck failure on `SubtleCrypto` against `SubtleLike` was fixed in the first cycle with `Uint8Array<ArrayBuffer>` parameters and was re-verified.

## 8. Relays

| To | Item |
|---|---|
| **Controller (R-93-1, needs-review, MINOR)** | Add `"./demo-data": "./src/demo-data/index.ts"` to `packages/shared/package.json` `exports`, next to `"./sim"`. It is one line with no install and no lockfile change. P1 reserves `package.json` edits for steps 27 and 67 (both closed, D55), so it needs the controller's serial slot. Without it, `@dems/shared/demo-data` does not resolve in core-web or mobile. The shared test imports relatively, so it is unaffected |
| 47 (web evidence) | - Join with `getDemoEvidencePackage(item.id)`.<br>- Media tab: `tracks[].stored.path` (0005 AUDIO-02 plays the altered copy); posters and thumbnails.<br>- Metadata tab: fetch `files.manifest.path` / `files.metadata.path`, or use `getDemoEvidenceDocuments`.<br>- Integrity tab: `verifyDemoPackage(pkg, load, { trust: demoVerificationTrust(), onCheck })`, where `load` maps asset paths to glob URLs and fetches bytes; show `source: 'precomputed'` as labelled (DR-93-1).<br>- Export wizard: `pkg.export.zip.path` for EV 0004. Other items have no export manifest (zips and export manifests exist only for exported items, D51); offer `manifest.json` (DEMO) instead, or build the export record client-side.<br>- EV 0006 shows INCOMPLETE; EV 0014 exists only after the recording scenario seals |
| 53 (API reference) | `DEMO_EVIDENCE_INDEX.apiExamples` (validated in `demo-evidence.test.ts` with the Core API zod schemas). IDs follow `--as-of`; DR-93-9 |
| 83 (mobile evidence) | - Integrity: `precomputedReport(pkg)` or `pkg.verification` (PASS × 13; 0005 FAIL on `track:AUDIO-02`, with expected and actual hashes).<br>- Play sheet: `tracks[].mobile.media.file` (the flat names in step 72's copy).<br>- Metadata: `getDemoEvidenceDocuments(id).manifestJson` |
| 58 (browser verification) | Check that `verifyDemoPackage` runs with `crypto.subtle` Ed25519 in the target Chromium (all `computed`), and hash `EXP-000031.zip` against `export-manifest.json` |
| 60 (README) | Regenerate with `node --import tsx scripts/gen-demo-evidence.ts --as-of <same as step 92>`. The `--as-of` semantics and the certificate-validity range are in §3; the DEMO seed phrase is published; run step 93 again after any step-92 regeneration |
| 62, 63 (security) | The DEMO key is derivable by design (D51) and labelled in the index, the certificate, the signatures and the README. No private-key file is written; `demo-evidence.test.ts` guards this |
| Controller | The tracking rows in `masterplan/02_plan.md`, `status_tasks.md` and `99_implementation_report.md` were not edited: they are shared files (P8) |

**Blockers: none** apart from R-93-1, which does not block row 93's own checks.
