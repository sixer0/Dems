---
task: 2026-10-07_dems_real_capture_sealing
row: 83 (M7-W2) — evidence package + manifest v2 + Signer
agent: coder-execution
date: 2026-10-09
status: complete for the self-contained part; seams open for rows 59, 82, 85, 129, 141
tier: 3
---

# Row 83 — package layout, manifest v2, Signer

## 1. What was built

| Part | Where (file:line) | Real or stand-in |
|---|---|---|
| Layout names (§A.1, §A.2) | `packages/shared/src/evidence-package/layout.ts:6-75` | real (names only) |
| Canonical JSON (sorted keys, UTF-8, refuses what has no canonical form) | `.../canonical.ts:88` | real |
| Manifest v2 schema, strict, 128 field definitions | `.../manifest.ts:352` (`ManifestV2Schema`), `:356` (unsigned), `:251` (cross-field rules), `:378` (`MANIFEST_V2_FIELDS`, 128 entries) | real |
| `manifestSha256`, canonical body, signed message | `.../hash.ts:30,39,44` | real |
| `fragments.json` = exact serialization of `files[]` (SEC35-11), chain rule | `.../fragments.ts:47,70,84` | real serializer; fed by a typed value (`FragmentTableInput`), not by the writer |
| `signature.sig` (`dems.detached-signature/2`) | `.../signature-file.ts:38,58` | real |
| Source class 124-126: mapping, four-row session record, derived flag | `.../source-class.ts:37,66,90` | real logic; the rows come from the caller |
| Build: `buildUnsignedManifest`, `attachSignature`, `parseManifestV2` | `.../build.ts:46,67,78` | real |
| FILE-time helper for intervals | `.../media-time.ts:17` | real |
| Example input (all sources FAKE, filler hashes) | `.../example.ts:57` | fixture, not evidence |
| `Signer` interface (the TPM / PKCS#11 seam, class C-8) | `apps/core-server/src/capture/signer/types.ts:15` | real |
| Software Ed25519, key at rest, provisioning, fail-closed load, compromise mark | `.../signer/host-key.ts:176,223,260` | real keys, real signatures |
| Self-signed X.509 certificate | `.../signer/der.ts:82` | real |
| Sign / check a manifest through the interface | `.../signer/seal.ts:61,93` | real |
| CS-13 real key record (shape of `security.keys[]`) | `.../signer/key-record.ts:22` | real builder; not yet shown by any view |

Small edits outside the two folders (Edit tool, additive): `packages/shared/package.json:21` (export `./evidence-package`); `apps/core-server/src/capture/index.ts:52-53` (`export * from './signer'`, the closed-unit rule); `apps/core-server/src/capture/__tests__/static.test.ts:62-63,71-74,137,144-145,215-217`.

**The one pinned file.** `src/capture/signer/host-key.ts` is added to the G-R2 allowlist (file system) and is the one exception of the G-R8 rule "no cryptography module" in the capture folder; both pins name that file and assert no other file does either. No `child_process`, no socket, no timer, no system clock, no environment read, no log call in the signer.

## 2. Decisions taken (for the controller)

| # | Decision | Why |
|---|---|---|
| D-83-1 | 119 fields live in the sealed manifest; the 9 `export.*` fields (§B.11) are a separate strict schema (`ManifestV2ExportBlockSchema`) and the sealed schema refuses an `export` member | §G.2 says the export carries `session-manifest.json` unchanged, and every member but two is under the hash; 119 + 9 = 128 |
| D-83-2 | Key at rest on this Mac: **encrypted PKCS#8 file, mode 0600, directory 0700**; the 32-byte wrap secret behind an interface (`KeyWrapSecrets`), built-in source = a second 0600 file beside the key | §C.3 allows "OS keychain or an encrypted file". The macOS keychain needs the `security` program (a second process, forbidden by G-R2 / T-CR-2) or a new dependency. **Honest limit:** with the built-in source key file and secret are on one volume — this defends a copied key file, not a reader of the whole directory. Request filed for row 84's credential store |
| D-83-3 | `signature.sig` v2 holds the signature as lowercase hex and the digest as `signedDigest`; schema id `dems.detached-signature/2` | same encoding as `evidence_items.signature_value` (dbc §C.5); the spec fixes only `signedDigest` |
| D-83-4 | A disabled transcript keeps all 19 keys, with `null` in fields 79-91 and 93-94 (the nested `model` / `diarization` objects stay, their members are null) | "required as keys"; strictness |
| D-83-5 | The builder's input type has **no** `sourceClass` and no `developmentSources`; they are computed from the four session-start rows; an unknown kind or a missing row throws before a hash exists | §B.12 rules 1, 2; dbc N.3 MR-S4 |
| D-83-6 | Interval rules in the schema: seq 1..n, `toMs >= fromMs`, no overlap, only the last open. `fileTimeMsOfTapSample` floors to the millisecond | rounding to whole ms is not stated in the spec — **confirm against row 77's chunk offsets** |
| D-83-7 | No key was provisioned under `.data/`: the store directory is the caller's choice and `config.ts` is frozen | row 82 / CS-22 decide the path (suggested `<dataDir>/signer`, apart from `media/`) |
| D-83-8 | SEC35-13 (`mts_` in the blanking list) **not done**: the list is now `packages/shared/src/api/redaction.ts:53,62`, not this row's file | request filed |

**Risk found, not solvable here.** `sealing.steps[]` (fields 95-101: `attempt`, `completedAt`, `status`) and `signature.signedAt` are inside the canonical body. §E.1 says a rebuilt manifest has the same hash after RECOVERY. That holds only if row 82 writes these values from a checkpoint fixed at the first `BUILD_MANIFEST` and not from the live job rows. Row 82 must decide; `M7-KM-C-S4/S5` will show it.

## 3. Attestation and compromise runbook (SEC35-06, SEC35-07; spec §C.3)

**What a signature attests.** That the holder of the private key of `signature.keyId` signed `manifestSha256`. It defends integrity, not confidentiality. Whoever can replace the Core's key **and** the certificate can forge a package that passes every check; the trust anchor is the certificate handed over out of band. A stolen package cannot be re-signed without the live key.

**Attest a key (once per key id).**
1. Provision: `provisionSigningKey({ dir, now })` — refuses if anything of that key id exists.
2. Read the certificate as public data: `readStoredCertificate({ dir })`; record `sha256`, `serialNumber`, `subject`, validity and the key fingerprint (`signingKeyRecords`) in the handover record.
3. Give the receiver `device-certificate.pem` and that SHA-256 through a channel that is not the package.
4. A receiver checks: SHA-256 of the certificate file equals the recorded value and `signature.certificate.sha256`; self-signature verifies; validity covers `signature.signedAt`; the signature verifies over the 32 bytes of `manifestSha256`.

**Key compromised.**
- (a) Stop signing: stop the Core.
- (b) Mark: `markSigningKeyCompromised({ dir, at })` — from then on `loadSoftwareSigner` throws `KEY_COMPROMISED`.
- (c) New key id and certificate: `provisionSigningKey({ dir, keyId: 'CORE-KEY-EVSIGN-02', now })`; distribute the new certificate out of band.
- (d) Re-verify every package whose `signature.keyId` is the compromised one against the **retained** certificate (`readStoredCertificate` still reads it); a package that verified before the compromise instant and whose stored bytes are unchanged keeps its value as evidence only together with custody records from outside the Core.
- (e) Record the event: fact, key id and instant only. No sealed manifest is rewritten (OD-15).

**Rotation** = step (c) without (a), (b): the old certificate stays in the store and in every package it signed.

## 4. Commands and results (2026-10-09)

| Command | Result |
|---|---|
| `npx vitest run --root packages/shared test/evidence-package.test.ts` | 155 passed |
| `npx vitest run --root apps/core-server --project unit src/capture/signer` | 16 passed |
| `npx vitest run --root packages/shared test/demo-evidence.test.ts test/client-platform-neutral.test.ts` (v1 untouched) | passed (180 with the file above) |
| `npx vitest run --root apps/core-server --project unit src/capture test/static` | 359 passed, 4 failed — all four name row 134 / 65 files: `adapters/local/process-door.ts`, `adapters/local/pipe-files.ts` (T-CR-2 child process, G-R2, G-R8 "only ipc.ts") and the adapter file-list pin |
| `npx tsc --noEmit -p packages/shared`, `-p apps/core-server` | no error in a row-83 file; foreign: `adapters/local/*-helper-args.ts` TS1294, later `shared/src/api/sim-actions.ts:98`, `live/source/bindings.ts:264` |
| `npm run lint -w @dems/shared`, `-w @dems/core-server` | no finding in a row-83 file |

Negative controls inside the tests: each of the 119 fields removed -> refused; an extra member in each of the 28 objects -> refused; a one-step change of each of 190+ leaf values -> hash fails, and with the hash recomputed the signature fails; only `manifestSha256` and `signature.value` are outside the digest; a signature of another key, a zero signature and a throwing signer seal nothing; key file mode 0640 / missing secret / wrong secret / foreign certificate / compromised -> refused.

## 5. What is NOT proven

- `M7-VV-SRV`, `M7-TP-1`, `M7-KM-C-S1..S6`, `M7-REF-1`: none run — they need the sealing pipeline, the writer and verify v2. The row's verification text is therefore **not met yet**; what is proven is the manifest, the hash and real signatures on an example value.
- No real fragment table, no real `session_capture_sources` row, no sealed package on disk, no DB write.
- The certificate was checked by Node's X.509 parser and WebCrypto only, not by a third-party tool.

## 6. To wire

| When | What |
|---|---|
| row 82 lands | call `buildUnsignedManifest` at `BUILD_MANIFEST` and `signManifest` at `SIGN_MANIFEST`; write `session-manifest.json` (`serializeManifest`), `signature.sig`, `device-certificate.pem`, `fragments/fragments.json`; choose the signer directory; load the signer at boot and fail closed (CS-22); persist `SignerError` / `EvidencePackageError` codes to the error log (this unit logs nothing by design, G-R4); fix the `sealing.steps[]` / `signedAt` snapshot (risk above); `M7-KM-C-S1..S6`, `M7-REF-1` |
| rows 82 / 129 | read the four `session_capture_sources` rows into `SessionCaptureSourceRow[]`; write `evidence_items.development_sources` = `manifest.developmentSources` in the item INSERT; `signature_*` columns from `manifest.signature` |
| row 59 | turn the writer's fragment table into `FragmentTableInput` (`manifestFilesFromFragmentTable`) |
| row 85 | verify CLI / route: V-01 = `parseManifestV2`, V-02 part = `fragmentsJsonMatchesManifest`, V-03 / V-09 = `verifyManifestSeal`, V-13 = `readSigningCertificate`; `M7-VV-SRV`, `M7-TP-1` |
| row 141 | compile-time check of `MANIFEST_SOURCE_CLASS_OF_ADAPTER_KIND` against `CaptureAdapterKind`; V-15 |
| row 84 | a `KeyWrapSecrets` backed by the credential store (request filed) |
| CS-13 view owner | put `signingKeyRecords(certificate)` into `security.keys[]` in real mode |
| OD-02 / §F.4 | regenerate the demo packages as v2 with this builder (rule 6: all FAKE) |

## 7. Device / browser checks left for the M7 gate

None of this row's own (no UI, no device). At the gate, one scripted flow after rows 82 / 85: clean fake session -> seal -> `M7-REF-1` hashes -> verify PASS (`M7-VV-SRV`) -> one-fragment tamper (`M7-TP-1`) -> Security & Audit shows `CORE-KEY-EVSIGN-01`, not simulated.
