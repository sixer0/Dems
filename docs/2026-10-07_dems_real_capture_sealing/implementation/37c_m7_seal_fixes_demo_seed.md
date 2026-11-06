---
task_id: 2026-10-07_dems_real_capture_sealing
row: 82c (M7) — kill-matrix findings F-86-1 / F-86-2, seed-time v2 demo packages
date: 2026-10-10
agent: coder-execution
baseline: e296ce7 + the uncommitted wave D tree
status: needs-review — both fixes and the generator are built and proven at unit level with mutation proofs; the four S6 kill cells ran ONCE and are RED, all four by the named failure FRAGMENT_TOO_LARGE of the rig's generated source (a foreign file: blocking request filed); item 1(b) NOT applied by this row
tier: 3
---

# Row 82c — seal fixes and the demo seed generator

Paths relative to the repository root; `S` = `apps/core-server/src`. No commit, no migration, no lockfile write, `.data/pg*.env` not read, no camera or microphone opened.

## 1. F-86-1 — cause

**Not reproduced: `M7-REF-1` ran 5 times before any change, 5 green.** The cause is established three other ways:

| Evidence | What it shows |
|---|---|
| The captured red report `M7-REF-1-1791563426356.json`: `overall CORRUPT`, failed exactly `V-05` | Of the five V-05 codes only `FRAGMENT_TOO_LARGE` has class CORRUPT (`packages/shared/src/evidence-verify/types.ts:86-90`; `overall` = gravest class, `verify.ts:831,959`). By elimination, not by a captured code |
| Unit reproduction (`pipeline.test.ts`, "THE CAUSE OF F-86-1, reproduced") | A verifier whose bound is one byte below a sealed fragment answers `ok false / CORRUPT / [V-05] / FRAGMENT_TOO_LARGE` naming it; control at the bound passes 15 of 15 |
| Four kill cells after the fix (section 4) | The rig recorded fragments of 97.8, 105.2, 105.2 and 107.9 MiB; the pipeline now refuses them by name |

**Why the rig's fragments are that large (finding F-82c-1, measured).** The generated picture of the FAKE camera is not paced: `-re` has no effect once `-use_wallclock_as_timestamps 1` stamps the frames, so the helper encodes as fast as the host goes — 8,141 frames in 4.03 s, 11,551 in 6.03 s (about 2,000 fps, not 30), 372 MB for 6 s. Fragment size follows host speed. A bitrate alone does not cure it (201 MB for 6 s with `-b:v 4M -maxrate 4M`). With the lavfi `realtime` filter in the graph: 240 frames in 8 s, 7.75 MB; with the 4 Mbit/s rate as well: 4.22 MB = about 1.05 MB per fragment.

## 2. What was built

| Part | Where |
|---|---|
| ONE bound: `SEALING_MAX_FRAGMENT_BYTES = VERIFY_MAX_OPEN_FRAGMENT_BYTES` (imported; the constant did not move) | `S/sealing/pipeline/contract.ts` |
| Refusal at CLOSE_TRACKS before the sealed file of that track is created; what the step wrote of the other track is removed; failure `FRAGMENT_TOO_LARGE` (not retriable) with `{ trackId, seq, bytes, limitBytes }` and an operator sentence | `pipeline.ts` (`closeTracks`), `contract.ts` (`sealingFailureReason`) |
| Controller: a SEALED session whose REAL item is committed and whose journal is open answers `FINISH`; `resume()` runs it | `S/sealing/pipeline/controller.ts` (`decide`), option `hasOpenSealingRows` wired in `S/sealing-host/index.ts` |
| Last step finishes a committed item: `SealEngine.isSealed` -> no commit call, no folder judgement, then the removal and the DONE row | `pipeline.ts` (`storePackage`) |
| Guarded removal of the plaintext recordings (both the normal and the resumed run) | `pipeline.ts` (`removeSealedRecordings`) |
| Manifest fields 6 / 7 for a demo package (`SealSessionFacts.demoPackage`; the Core's reader never sets it) | `contract.ts`, `pipeline.ts` (`assemble`) |
| Seed-time generator `sealDemoPackages` + argument table | `S/sealing-host/demo-seed/{index.ts,source-arguments.ts}`, exported by `S/sealing-host/index.ts` |
| Coordinator's line (D160 / D163): server-backend sessions of the rig state the model name only | `S/sealing/__tests__/support.ts`, one forged manifest in `stt-states-verify.test.ts` |

**Removal rule.** A recording is removed only when the package's own signed manifest (digest = the committed item's, session = this one) names it as `tracks[].file`, the name is a bare file name directly in the session folder, it is a regular file (no link followed), the sealed file of that track is present with the manifest's length, and its first `tracks[].bytes` bytes hash to `tracks[].sha256Plain`. Anything else under a recording's name is left and logged (`SEALING_RECORDING_NOT_OF_PACKAGE`); no other file is looked at. Cost: the recording is read once more at the end of every seal.

**What keeps a real camera under the bound.** Arithmetic only. Plan profile `H264_720P30` at 4 Mbit/s = 0.5 MB/s; fragment = max(GOP, `CAPTURE_MIN_FRAG_DURATION_MS` 2 s) = about 1 MB, 64 times below 64 MiB. The bound is reached at 134 s of video in one fragment at 4 Mbit/s, or 33 s at 16 Mbit/s. **The worker enforces no cap** (`apps/capture-worker/src/ingest.c:205-213`); it only reports a long keyframe interval. Finding F-82c-2 filed.

**Generator.** Per item: two camera files synthesised into the session folder through a handed-in helper door (the unit starts no process); sealed by `createSealingPipeline` with the caller's sealer / opener / signer (journal, fragment rows and engine of the run in memory); refuses any signing certificate that is not the development one, an evidence store outside the data directory, and an existing session folder; manifest `integrity DEMO_PACKAGE`, `demo true`, `developmentSources true`; for evidence sequence 5 one byte of the stored bytes of `(DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_FRAGMENT_SEQ)` is altered after the seal; then it verifies its own work with `verifyPackageV2` and removes what it created if the package does not read as scripted or is above 10 MB. Returns the `CompleteSealInput` for the item's row.

## 3. Results (each once unless stated)

| Check | Result |
|---|---|
| `M7-REF-1` x5 before any change (`run.sh --only M7-REF-1`) | 5 green; cause not reproduced |
| `npx vitest run --root apps/core-server --project unit test/static src/sealing src/sealing-host src/modules/sealing src/capture/__tests__/static.test.ts src/credential-store/__tests__/static.test.ts src/engine/__tests__/static.test.ts` | 30 files, 467 passed |
| of which `pipeline.test.ts` | 55 (41 before; 14 new) |
| of which `demo-seed.test.ts` / `demo-seed.generated.test.ts` | 13 / 1 |
| of which the coordinator's three files (`stt-states`, `stt-states-verify`, `finalize-transcript`) | green; first run after the one-line fix: 1 red (`stt-states-verify` forged an ill-formed manifest under D160), fixed in the test, second run green |
| `npx tsc --noEmit -p apps/core-server` | 0 errors (an earlier run showed 1 foreign error in `modules/devices/__tests__/source-class.db.test.ts`, gone since) |
| `npm run lint -w @dems/core-server` | no finding in `sealing` / `sealing-host` |
| Mutations, pipeline / controller (files restored, SHA-256 before = after) | 4 of 4 red: bound check off (1 test), SEALED answers NONE (5), removal without the hash guard (1), commit again although sealed (3) |
| Mutations, generator | 2 of 2 red: another fragment altered; self-check inverted |
| 14 frozen v1 demo packages | SHA-256 over the 89 tracked files = `005e8f85…1fd4b1`, unchanged; `gen-demo-evidence.ts` untouched |
| `M7-KM-P4-S6`, `C-S6`, `P2-S6`, `P3-S6` | **RED, all four, once each** — section 4 |

**Measured demo packages (real helper, real H.264, 8 s, product pipeline):** 8,590,160 and 8,590,175 bytes per package; camera files 4,287,338 to 4,287,353 bytes; 4 fragments per file of 1.00 to 1.18 MB; clean item PASS 15 of 15; EV 0005 TAMPERED, failing V-04 / V-06 / V-08, the one fragment `(VIDEO-02, 3)`, chain broken from 3; both `sources.development true` and `signature.developmentKey true`. Under the 10 MB stop rule, above "a few MB": a 4 s clip would halve it but leaves 2 fragments, and fragment 3 must exist.

## 4. Not proven

- **The S6 kill cells.** Each ended `FAILED / CLOSE_TRACKS / FRAGMENT_TOO_LARGE` (fragment 2 of VIDEO-01, 97.8 to 107.9 MiB) before any S6 kill point: the fix of F-86-2 was never reached in a killed process. It is proven in process only (a stop inside the commit call, and a stop at `STORE_SEALED_PACKAGE:AFTER_WORK`, each resumed through the controller). Reports `.cache/kill-matrix/M7-KM-{P4,C,P2,P3}-S6-*.json`.
- **Consequence to rule on:** every check that seals a worker-recorded session (`M7-REF-1`, all sealed kill cells, `seal-e2e`) is now red with that named failure on a fast host until the generated source is paced. Before this row the same recordings sealed into packages the verifier refused.
- "Killed between commit and plaintext removal" is a unit case, not a process kill: the harness has no kill point inside a step.
- Item 1(b): no fixture or argument table was changed. The table is `S/capture/adapters/local/camera-helper-args.ts`, closed to this row; the worker fixtures (`m3worker.py:1026`, 320x240) were not measured.
- The generator ran on a throw-away data directory only: no seed, no database row, no op 41 route, no reset.
- A demo item has no transcript (STT snapshot off) and an empty audit extract.
- The session key of a failed generation stays in the credential store (no port removes one).

## 5. Decisions taken

| ID | Decision |
|---|---|
| D-82c-1 | The verifier's constant is imported as it is; no request to move it |
| D-82c-2 | `FINISH` runs the same pipeline run (five steps skipped); the last step asks `isSealed` first and then does not judge the folder again — a sealed package may have gained an export or a retained certificate |
| D-82c-3 | The guarded removal is one rule for both runs, including the re-hash of the plaintext |
| D-82c-4 | A file under a recording's name that is not the sealed recording is left and logged at error level; the step still ends DONE (such a folder then fails V-14) |
| D-82c-5 | The generator lives in the composition unit `sealing-host` (no new unit, no pin moved) and starts no process |
| D-82c-6 | `SealingStop` thrown inside the commit call passes through (one line), so a test can stop the run there |
| D-82c-7 | `findItem` (op 41) not changed although the file is this row's: `manifestVersion === 2` cannot tell a seed-sealed item from a v1 demo item |

## 6. Requests filed (`delegation_progress/file_requests.md`)

1. Generated source: `,realtime` in the filter graph + `-b:v 4M -maxrate 4M -bufsize 4M` on the software encoder line, with its two pins — **blocking**.
2. Worker: no cap on fragment bytes (F-82c-2).
3. Seed hook: helper door export of the fence, the seed call, the item rows, reset.
4. Op 41 admission of a v2 demo item: one mapping member, then one line in `findItem`.

## 7. Checks for the test runner (after request 1 lands; each once, sandbox off)

| Command | Expected |
|---|---|
| `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only M7-REF-1` | green, verify PASS |
| `... --only M7-KM-P4-S6 --only M7-KM-C-S6 --only M7-KM-P2-S6 --only M7-KM-P3-S6` | green: six rows DONE, last step attempt 2, one item, one EVIDENCE_SEALED row, no plaintext recording |
| the 22 remaining cells of note 41 section 8 | as listed there |
| `DEMS_SEAL_E2E=1` run of `S/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` (both locks) | (a) and (b) green |
