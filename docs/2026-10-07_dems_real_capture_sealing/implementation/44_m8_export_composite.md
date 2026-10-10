---
task: 2026-10-07_dems_real_capture_sealing
row: 91 (M8-W2, export + composite)
date: 2026-10-09
agent: coder-execution
baseline: e296ce7
status: needs-review (export complete; composite ENCODER blocked: licence decision; production wiring waits for row 82)
---

# Row 91 — export + composite (M8-W2)

Paths are below `apps/core-server/`.

## What was built

| Piece | Where | State |
|---|---|---|
| Export of one sealed v2 package: source verified first (one verifier, one decryption path = the `FragmentOpener` of verify v2), archive with the DECRYPTED camera files + every clear file byte for byte, export manifest, export signature, names given last, full clean-up on failure | `src/evidence-export/package-export.ts:290` (`exportPackage`), decrypt stream `:199` | real |
| Archive writer (stored entries, ZIP64, deterministic, streamed: plaintext exists only inside the archive) | `src/evidence-export/zip-store.ts:172` | real; read back by `/usr/bin/unzip` in the tests |
| `dems.export-manifest/2`: the 8 items of book §19.2 + the 9 fields of spec §B.11 (shared `ManifestV2ExportBlockSchema`, unchanged), own hash, Ed25519 signature file (`purpose: EXPORT`), composite marking rule | `src/evidence-export/export-manifest.ts:57, :156, :171, :206` | real |
| Background jobs: ticket before the hosted action (409 `EXPORT_IN_PROGRESS`), serial queue, QUEUED / RUNNING / COMPLETE / FAILED, failure row, status after a restart from the package folder | `src/evidence-export/jobs.ts:152` | real, no table |
| Receiver-side verification at the destination (no key of the Core): X-01..X-07 | `src/evidence-export/receiver-verify.ts:115` | real (server side; a client version = request) |
| Secret sweep over every clear text of the artefact before it is named | `src/evidence-export/secret-sweep.ts:59`, called `package-export.ts:474` | real |
| Composite: seam, derived marking, hash into the export manifest, GPL-only encoders refused by name | `src/evidence-export/composite.ts:28, :58, :67`; job part `package-export.ts:410` | built behind a STAND-IN encoder; **product encoder: blocked: licence decision** |
| App side: request directory over the engine state, `EVIDENCE_EXPORT_FAILED` through one native unit, error log | `src/evidence-export/host.ts:51, :105, :117` | real code, **not composed** (row 82) |
| Op 87 route | `src/modules/evidence-export/index.ts:64`; mount `src/app.ts:97, :332` | real, routed |
| Op 42 seam (ticket, 409, hand-over) | `src/modules/evidence/index.ts:252-274` | real; inert until a runtime is provided |

Artefact in the package folder: `export/EXP-<id>.zip`, `export/EXP-<id>.manifest.json`, `export/EXP-<id>.manifest.sig` (per export; the `.sig` is the completion mark) and the spec's `export/export-manifest.json` / `.sig` = the export made LAST.

## Real vs stand-in

- Real: bytes, SHA-256, AES-256-GCM opening, Ed25519, the archive, the files on disk, the routes on the real app factory.
- Stand-in: the packages come from the verify-v2 TEST BUILDER (random bytes, not video; D133) — no product-sealed package exists. The composite encoder is a stand-in that reads both decrypted streams and writes a digest: **no video was encoded by this row**.
- Not run by this row: anything against PostgreSQL (the failure row through the real pipeline, the 403 denial row of op 87), browser/device flows.

## Licence gate (binding) — record first, then no selection

Record: `THIRD_PARTY_NOTICES.md`, section "FFmpeg for the on-demand composite: M8 licence check" (DOC-05), written before any encoder code. Facts read from the program: `.data/helpers/ffmpeg` = Homebrew 9.0.2 (same SHA-256), `--enable-gpl --enable-version3 --enable-libx264 --enable-libx265`; the BUILD is GPL-3.0-or-later whichever encoder a command line names. The choice depends on what a distributed Core ships (no FFmpeg / the GPL build / an LGPL-only build) — the owner's decision. Therefore `selectedCompositeEncoder()` is null (`composite.ts:67`), a COMPOSITE job ends FAILED `COMPOSITE_ENCODER_NOT_SELECTED` (audited), and `libx264` / `libx264rgb` / `libx265` are refused by name. Recommendation: LGPL-only build for distribution; `h264_videotoolbox` on macOS, `libvpx-vp9` elsewhere.

## Checks run (each once; one re-run after the fail noted)

| Check | Command (repo root) | Result |
|---|---|---|
| M8-EXP-1 (server side) + negative controls | `npm exec -w @dems/core-server -- vitest run --project unit src/evidence-export/__tests__/export.test.ts` | 19 passed (first run 18/19: my control altered a revision's `reason`, which V-11 does not cover — see finding 4; control changed to the revision body, re-run green) |
| M8-CMP-1 (stand-in encoder) | same file, 5 tests | passed; **the encoder itself is not proven** |
| Secret sweep + M8-XAU-1 file half | same file, 4 tests (2 planted controls fail closed, value not echoed; session key not in the 3 files, search control) | passed |
| Original package untouched | same file: SHA-256 of every file before / after, in the success, composite and every failure path | equal |
| Jobs + M8-XAU-1 failure row (detail keys) | `... vitest run --project unit src/evidence-export/__tests__/jobs.test.ts` | 8 passed |
| Archive against `unzip` | `... src/evidence-export/__tests__/zip-store.test.ts` | 3 passed |
| Ops 87 / 42 routes | `... src/modules/evidence-export` | 7 passed (first run 2 red: I asserted 403 where the harness has no database; now the guard RULE is asserted) |
| Touched pins | `... src/modules/evidence/__tests__/static.test.ts src/modules/evidence/__tests__/routes.test.ts test/static` | passed (285 tests over the 20 files of the last run) |
| Mutation proof 1 | receiver X-02 never reports an invalid signature | 1 test red (the altered-signature control); restored |
| Mutation proof 2 | `signExportManifest` signs another digest | 8 tests red; restored, 19 green |
| typecheck / lint | `npm run -s typecheck -w @dems/core-server`, `npm run -s lint -w @dems/core-server` | 0 errors / 0 warnings in this row's files; the workspace has other rows' in-flight errors (`src/capture-session/index.ts:567`, `src/sealing/pipeline/contract.ts:110`, capture / engine test doubles) |

Red and not mine: `src/plugins/permission-guard/__tests__/static.test.ts:210` — `src/media-stream/store-door.ts` (`secrets.put(MEDIA_SESSION_KEY_SECRET_NAME, …)` matches the route pattern) — row 90. My folder registers no route.

## Not proven

- No product-sealed package was exported (row 82). No real media. No composite video.
- `EVIDENCE_EXPORT_FAILED` through the real pipeline and the audit CHECKs: unit level only.
- Op 87 for a request older than the audit ring (1000 rows): answers 404, as the simulator does.
- An export interrupted by a restart is answered FAILED `EXPORT_INTERRUPTED` on a poll; no audit row is written for it.

## To wire when row 82 lands

One call where the signer and the package folder are known:
`evidenceExport(app).provide(createEvidenceExportRuntime(coreExportHost(app, { findItem, packageDirOf, signer, trustedCertificateSha256, opener: () => coreFragmentOpener(app), composite: selectedCompositeEncoder })))`
plus one entry for the opener's use in `CREDENTIAL_STORE_USERS` if the composition file is new. `findItem` must answer only items with `integritySource = REAL` and a v2 package.

## Decisions taken (for the controller)

- D-91-1 No table, no migration: the request = the existing audit + `exports` rows; COMPLETE = the per-export signature file; FAILED = the audit row; progress in memory.
- D-91-2 `export.manifestSha256` = SHA-256 of the canonical export manifest with that member null (the §B.10 rule); the signature covers those 32 bytes.
- D-91-3 Per-export manifest / signature names beside the spec's two fixed names (which a second export would otherwise overwrite). Spec §A.2 erratum suggested.
- D-91-4 The composite is NOT kept in `<package>/composite/` (spec §A.1): it exists only inside the archive at `composite/composite.mp4`; the temporary file is removed. Less plaintext at rest.
- D-91-5 The sweep covers the transcript files too; a hit fails the export closed.
- D-91-6 The export signature's certificate travels in the archive as `certificates/<sha256>.pem` when it is not the sealing one.
- D-91-7 `modules/evidence` imports `src/evidence-export` (its import pin gained one entry); the alternative, a seam file inside the module, needs a module-to-module import for op 87.
- D-91-8 A hand-written ZIP writer (no archive library in the stack; no new dependency allowed). Alternative: add one by decision.

## Device / browser checks left for the M8 gate (one scripted flow)

Web, SUPERVISOR, a product-sealed item: Export -> 202 -> poll to COMPLETE -> copy the three files -> unzip -> receiver verify (M8-EXP-1); INVESTIGATOR -> 403 + denial row; second click while running -> "job progress already shown" (409); COMPOSITE -> FAILED wording until the licence decision (M8-CMP-1 stays open).

## Follow-up 2026-10-09 — controller ruling D139: the archive is written by a library

- **Replaced:** the hand-written container writer inside `apps/core-server/src/evidence-export/zip-store.ts` by `yazl` 3.3.1 (MIT). The interface is unchanged (`createArchive` -> `add` / `finish` / `abandon`, `isArchiveEntryName`), so no other file of the unit changed. D-91-8 is closed by this.
- **Why `yazl`:** MIT; no install script, no native build (`npm view yazl scripts dist.tarball` read before the install: only `test`); streaming; writes ZIP64 (`forceZip64Format`), which `fflate` does not; one small dependency (`buffer-crc32` 1.0.0, MIT) against `archiver`'s tree. Types: `@types/yazl` 3.3.1 (devDependency).
- **Install:** `/usr/bin/lockf -k -t 600 .locks/npm.lock npm install --cache "$PWD/.cache/npm-row91" --save-exact --ignore-scripts -w @dems/core-server yazl@3.3.1` and the same with `--save-dev @types/yazl@3.3.1`. The project cache folder was needed because `~/.npm` holds root-owned files (EPERM, as row 131 found); no sudo. Lockfile: +30 lines, 3 entries (`yazl`, `buffer-crc32`, `@types/yazl`). DOC-05 entry appended to `THIRD_PARTY_NOTICES.md`.
- **Reproducible archive:** stored entries in the order added, one fixed DOS time (1980-01-01, `forceDosTimestamp`, so no time-zone-dependent field), one fixed mode, ZIP64 forced.
- **Results (one run):** the 4 test files 38 green (37 + the new one: two exports of the same package give byte-identical archives and the same recorded archive hash; control: a composite export differs). `unzip -t` / extraction proof, the before / after hashes of the original package and both mutation proofs hold (mutant 1: 1 red; mutant 2: 8 red; restored, 20 green in `export.test.ts`). `test/static` green. typecheck and lint: nothing in this row's files.
- **A slip of mine, corrected:** the first repeat of the mutation proofs did not execute (a shell variable was not expanded into a command, so nothing ran); it was run again properly, with the results above.
- **Not mine in the same diff:** `apps/core-server/package.json` also shows a new script `evidence:dev-key` (another row).
- Accepted by D139 and unchanged: no job table; the `export.manifestSha256` rule; the per-export manifest / signature names (§A.2 erratum); the composite only inside the archive; the import pin. Composite encoder: still `blocked: licence decision`. Download: nothing drawn, ruled in a later row.

## Follow-up 2 — controller ruling D143: two pins of the mount closed

- `apps/core-server/src/capture/__tests__/static.test.ts` (P25 digest of `app.ts`): my two lines (the import and the unit line of `modules/evidence-export`) added to the waived list with the decision number; the three index references to the STT lines in the same test moved with the list (`WAIVED[3], [13], [17]`, read from the list itself). The frozen digest is unchanged.
- `apps/core-server/src/plugins/permission-guard/__tests__/without-domain-modules.ts`: stub + list entry for `modules/evidence-export`.
- `test/acceptance/rbac-matrix.test.ts`: the `getEvidenceExportJob` entry had already left `DEFERRED_ROUTE` (not by me); nothing to move.
- Run once: `src/capture/__tests__/static.test.ts`, `src/plugins/permission-guard`, `test/static` -> first run 2 red (my edit script stopped on an ambiguous match and wrote nothing), second run 1 red (the shifted indices), then `static.test.ts` alone 49 green; the other 22 files were green in the second run (363 of 364).
