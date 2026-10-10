---
task_id: 2026-10-07_dems_real_capture_sealing
row: wave H, driver C1 (evidence server: the item the Core sends, media sessions, export + download)
date: 2026-10-10
agent: coder-execution
brief: delegation_progress/fix_brief_wave_h.md (D200; rules D94 / D122 / D163)
tree: f293221 + the working tree of wave H (no commit, no migration: schema 6 / dbc-7 unchanged)
narrative_tier: 2
status: complete
---

# 122 - Wave H, driver C1: the evidence server after gates 81 / 89 / 94

## 1. Findings

| Finding | Reproduced? | Fix (file) | Test | Status |
|---|---|---|---|---|
| **G94-01 BLOCKER** op 40 never answers `LIVE_STREAM` | YES. Negative-control run with the decisive rule reverted in my own file (`evidence-facts/index.ts`, restored byte-exactly, sha256 checked): the route answered `source: NONE` for a product-sealed item - 3 cases red (`expected 'NONE' to equal 'LIVE_STREAM'`) | NEW unit `src/evidence-facts/` (`detail`): REAL + v2 -> the plan of operation 88 itself (`mediaStream(app).playability`, `media-stream/source.ts listPlayableFiles`) -> `LIVE_STREAM` + `media.fileIds` (1 or 2), else `NONE` + `media.reason` (the code op 88 would refuse with); bundled join -> `DEMO_PACKAGE`; anything else `NONE` + `NOT_SEALED` / `NOT_A_SEALED_PACKAGE`. `modules/evidence/index.ts` op 40 calls it (one line) | `modules/evidence/__tests__/detail-facts.db.test.ts` (THROUGH THE ROUTE, throw-away database, a package sealed with the product cipher): 3 kinds + the CONTRACT case "three kinds, three states"; each file it names gets an op 88 session; the missing package is refused by op 88 with the same code. `evidence-export/__tests__/export-e2e.db.test.ts`: an item sealed by the product door in a real-mode Core answers `LIVE_STREAM`, also after a restart | FIXED |
| **G94-04** no `audioSourceIntervals` on the item | YES (control inside the rehydrate case: the item the engine read back holds none) | `evidence-facts/sealed-facts.ts` reads the item's own sealed manifest under the digest of record; NEW engine door `engine/sealed-facts-doors.ts` (`applySealedItemFacts`) puts the facts on the REPLICATED item: at boot (step `evidence.sealedFacts`) and after every committed `EVIDENCE_SEALED` (pipeline commit watch); op 39 / 40 lay the replicated members over the rows, op 40 reads the package when the replicated item has none | `detail-facts.db` (three intervals, `seq` 1..3, `sourceClass` per interval; rehydrate -> replicated item -> op 39); `engine/__tests__/sealed-facts-doors.test.ts` (5: transition, same-state, anchor negative control, cause, NOT_READABLE); `export-e2e.db` (seal-time publication and after a restart) | FIXED |
| Item members (brief item 3) | the gate reports | all optional, in `packages/shared/src/api/{state-slices,evidence}.ts`: `sealedPackage`, `files` (the sealed manifest's camera files - a REAL item had NO `files`: `isV2` was false, hence G89-04), `audioSourceIntervals[].sourceClass`, `interrupted`, `interruptedCause`, `signature.developmentKey` (the verifier's own statement, `verifyPackageV2` scope MANIFEST; no column, no migration), `transcript` on op 40's body (from the replicated item), `manifestVersion` / `integritySource` as before. Example `getEvidence.productSealed` | `detail-facts.db`, `sealed-facts-doors.test`, shared api tests (examples validate) | FIXED on the server; the clients are C2's |
| **G94-03** the download is the zip only; no receiver tool | YES: after the change every pin of the three-file form went red (`X-01` in 9 cases of `export.test.ts`, `export-one-camera`) | `package-export.ts`: the export manifest and signature are the LAST TWO ENTRIES of the archive (`export/EXP-<id>.manifest.json` / `.sig`); the manifest names no hash of the archive (`package.bytes` / `sha256` optional, absent); `ExportOutcome.archive`, op 87 `archive { bytes, sha256 }`, the download's audit row `details.archiveSha256`. `receiver-verify.ts` verifies both forms. COMMAND `npm run evidence:verify-export -- <archive> [--sha256 <hex>] [--trust <hex>]` = `src/evidence-export/receiver-cli.ts` + process entry `apps/core-server/cli/verify-export.ts` (system `unzip`) | `receiver-cli.test.ts` (6: the download alone -> PASS exit 0; one altered byte -> exit 1 `X-04 ... ENTRY_HASH_MISMATCH:fragments/VIDEO-02.mp4` + X-06; wrong `--sha256` -> X-03; other anchor -> X-02; edited embedded manifest -> X-01; usage exit 2); `export-e2e.db`: export -> `GET /exports/<token>` bytes -> the command on those bytes alone -> PASS; one altered byte -> FAIL by name. The npm script itself was run once without an archive (usage, exit 2) | FIXED |
| **G94-05** a finished export only from the dialog that asked | by reading (no list existed) | `evidence-export/finished.ts` (`listFinishedExports`), `service.finished`; op 40 `exports[]` for a caller with `access.export`; op 87 by `jobId` already answered from the stored rows + folder - now with `archive` | `wave-h-c1.test.ts` (list newest first, another item lists nothing, a NEW runtime answers both jobs); `export-e2e.db` (ANOTHER supervisor session reads the list, polls op 87, downloads 200 byte-identical; an investigator reads no list; after a restart the list is there) | FIXED |
| **G94-06** 117 audit rows per open | YES: the pins of one row per range went red (13 cases of `modules/media-stream/__tests__/routes.test.ts`, 1 of `media-stream.db`) | `media-stream/service.ts recordServed`: an answered range is a `debug` log line; ONE row stays for a stream that stops on the package (unchanged keys - `core/audit-details.ts` allows no other); a cut by sign-out is a log line. Followed: SEC35-12 (the issue row, committed before the answer). `access` on op 40 (G81-07) | `detail-facts.db`: 1 open + 40 ranges = 1 row; a non-holder's VIEW writes no row, his real ASK writes one (negative control) | FIXED |
| G94-10 PACKAGE row without `details.kind` | YES: `modules/evidence-export/__tests__/routes.test.ts` pinned the request without `kind` | `modules/evidence/index.ts`: a request that becomes a JOB always carries its kind | the same case, moved | FIXED (a simulated item's request is unchanged: simulator parity) |
| G94-11 archives accumulate | by reading | ev section G states NO retention rule -> kept, listed on the item, none deleted; README limit requested | `wave-h-c1.test.ts` (both archives stay) | DONE as ruled |
| G94-12 a stop lets an export finish | by reading (`jobs.ts` had no stop) | `jobs.ts stop()` + `AbortSignal` through `exportPackage` (checked before every piece and between steps) + `onClose` hook in `host.ts` | `wave-h-c1.test.ts`: a RUNNING job -> FAILED `EXPORT_INTERRUPTED`, its row, the `export/` folder gone at once; a QUEUED job never runs; CONTROL without a stop completes | FIXED at the job; the hook line is not driven by a process stop (re-gate) |

## 2. What is not proven / limits
- Red first: only G94-01 was run red in isolation (by reverting the rule). For G94-03 / -06 / -10 the red is the old pins failing against the fix; for G94-04 / -05 / -12 the tests were written with the fix (each holds a control).
- A live `lane.sh stop` during an export, the players, the band, the list on a page: device / browser checks (section 5).
- Operation 39 lays over what the replicated item carries and reads no package; operation 40 reads it.
- The facts are not stored: after a start they are read again (boot step), inside the process operation 40 heals them. `files` on the replicated item is not written to the track rows.
- A seed-sealed v2 demo item answers `DEMO_PACKAGE` (operation 88 opens REAL items only), with `sealedPackage: PRESENT`.
- An export written BEFORE this change (manifest beside the archive) still verifies through `verifyExportAtDestination({ exportDir })`; the command takes the self-contained form.
- First download / first op 87 of an archive after a restart hashes the file once (then remembered).

## 3. Decisions for the controller
1. NEW closed unit `src/evidence-facts` and NEW engine door file; `engine/host.ts` three own insertions (one is the shared type line of the host constant); pins moved by delta: `engine/__tests__/static.test.ts` 22 -> 23, `test/static/imports.test.ts` closed list + 1, `modules/evidence/__tests__/static.test.ts` import list + 1.
2. Export manifest: `package.bytes` / `package.sha256` optional (absent in the self-contained form). Spec erratum requested (ev G.1).
3. The command's process entry lies OUTSIDE `src/` (`apps/core-server/cli/`, added to `tsconfig.json` include): the server sources start no process and read no environment (static rules). It needs the system `unzip`.
4. Member names are C2's own (`media.fileIds`, `access.readTranscript`). `transcript.noSpeech` / `transcript.reason` NOT built: the sealed manifest states neither.
5. `interruptedCause` is the code of the item's stored custody entry (the manifest has no cause field).
6. Should a seed-sealed demo item play through operation 88? Today no.

## 4. Checks for the test runner
| Command | Lock | Expected |
|---|---|---|
| `npm run test -w @dems/core-server` | - | green (my run: touched folders + test/static, 37 files / 500 tests) |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db` | db-migrate | green (my run: contract, rbac-matrix, detail-facts, reads, bulk, media-stream.db, export-e2e, export-restart, modules/evidence db: all passed) |
| `npm run test -w @dems/core-web`, `-w @dems/mobile` | - | not run by me (typecheck only, clean) |
| on a lane after the refresh: export, download in the browser, `npm run evidence:verify-export -- <download> --sha256 <op 87 archive.sha256>` | - | X-01..X-07 PASS, exit 0 |

## 5. Gate checks to re-drive
M8-PB-W / -T / -P (sealed player opens from op 40; one-camera item offers one file); the audio-source band (three intervals); M8-EXP-1 on the download alone with the command; G94-05 (list on the item, download from another session and after a restart); audit rows per "Open playback" (1 + 1 per file, none per range); G81-07 (no `ACCESS_DENIED` on a page view by a non-holder - needs C2); G94-10 (`details.kind` on a PACKAGE row); G94-12 (`lane.sh stop` during an export: no `.partial`, job `EXPORT_INTERRUPTED` after the start); after a Core restart the item still shows the band and the key line.

*Generated: 2026-10-10 17:30 WIB*
