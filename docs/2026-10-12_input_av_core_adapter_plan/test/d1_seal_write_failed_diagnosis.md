---
task_slug: input_av_core_adapter_plan
row: D1 (wave 12, track D)
date: 2026-10-14
agent: test-expert (wave 12, agent D1)
status: complete - reproduced, explained (predicted before the kill, 7 of 7), fixed in the seal (4 lines + 1 test case), green end to end 3 of 3
tier: T2
---

# Row D1: why the seal of an INTERRUPTED session failed with `WRITE_FAILED` (row 184, section 6 item 6)

Tier 2: what was found, why it matters, how it was verified, source. Development sources only (the generated cameras
`CAM-01`, `CAM-02` and the generated microphones `MIC-01`, `MIC-02`, all of kind `FAKE`); no device of this Mac, no real
device; throw-away databases (each run's helper printed `0 remain`).

## 1. Answer

| Question | Fact | Evidence |
|---|---|---|
| Reproduced on today's tree? | **Yes, 4 of 7 valid runs** (a1, a4, f1, f2); 3 sealed (a3, s1, s2). Row 184's own kill point ("3 s after the first durable fragment"): 2 of 3 | section 4 |
| How the session became INTERRUPTED | The worker got `SIGKILL` after the first durable fragment; the supervisor does not replace a worker once a fragment is durable: `CAPTURE_WORKER_DOWN` reason `WORKER_KILLED`, phase `RECORDING -> FAULTED -> STOPPING -> IDLE`; then the capture-session unit's `endCapture(durable)` moved the session to `INTERRUPTED` with cause `EXITED` 40 to 69 ms after the kill, and the seal started in the same millisecond (`SEALING_FIRST_VIDEO`). No Core stop, no session abort, no operator action | timeline of every run (`session:INTERRUPTED`, cause `EXITED`); `engine/host.ts:1303-1308`; same path as row 184 b1-b4 |
| What failed | NOT a file write. The seal's last step (`STORE_SEALED_PACKAGE`) asks the engine to commit the item (`engine.completeSeal`); the database refused the insert into `evidence_items`: **SQLSTATE `23514`, constraint `evidence_items_values_check`** (`... AND (sealed_at IS NULL OR sealed_at >= ended_at)`, `db/schema/evidence.ts:181-184`). The store wraps it as `StoreError WRITE_FAILED` (`db/store/store.ts:181`), the pipeline as `ENGINE_REFUSED` | the store's own answer, recorded by a wrapper around `applyChanges` (a1: `WRITE_FAILED: evidence_items: the server answered 23514 (constraint evidence_items_values_check).`; the row: `endedAt 1791947096415`, `sealedAt 1791947096230`) |
| The cause, in two sentences | For an interrupted recording the seal states its end as `session.startedAt + end of the last durable fragment` (`sealing/pipeline/pipeline.ts`, `liveInput` and `storePackage`), assuming the media time starts at `startedAt`; the worker starts its media time where its audio began (`audio_started.t0_real_us`, `apps/capture-worker/src/audio.c:574-586`), which on the development microphones lay **372 to 443 ms BEFORE `startedAt`** in every run. When the worker dies within about 400 ms of its last durable fragment the stated end lies after the seal's own instant, the row breaks `sealed_at >= ended_at`, and every retry fails the same way because `sealedAt` is frozen at the first `BUILD_MANIFEST` | prediction 7 of 7 (section 4); row 184's kept manifests 4 of 4 (section 5) |
| Fix | **Made**, in the seal: the end of an interrupted recording is never after the seal's instant (`durableEndOf`, `Math.min(startedAt + mediaEnd, sealedAt)`, used in both places). RED before: the new case saw `durableEndMs` = sealedAt + 400. GREEN after: the 7 sealing unit files 146 of 146; end to end 3 of 3 `SEALED` in the kill mode that had failed 2 of 2 | section 6 |
| What stays wrong (not fixed: outside this wave's owners) | The stated end of an interrupted recording is still an estimate: after the fix it was 128 to 159 ms AFTER the worker was killed (the true end of the media was 25 to 32 ms before it). The honest anchor is the worker's media zero, which the Core does not receive | section 7, request line |

## 2. Why it matters

An interrupted session is exactly the case the evidence chain exists for. Without the fix, in the measured window, it
does not seal at all: the engine state is set back, the session stays `FINALIZING`, retries 1 and 2 fail identically
(5 s and 30 s; seen: retry 1 in every failing run), and because the `BUILD_MANIFEST` checkpoint froze `sealedAt` a resumed
seal after a Core restart computes the same refused row (reading of `pipeline.ts` `frozenOf` / `liveInput(frozen)`; the
resumed run was not executed). The plaintext camera files stay beside the package (`VIDEO-01.mp4`, `VIDEO-02.mp4`,
`.capture-session/<id>.json` at the end of a1, a4, f1, f2), as ruling D147 intends while no item exists.

## 3. Instrument

`.cache/task4-d1/interrupted-seal.db.test.ts` (in no commit) = row 184's `restart.db.test.ts`, its steps kept (a real
Core by `buildApp`, never listening, `REAL_DEVELOPMENT`, the built worker `apps/capture-worker/build/capture-worker`,
the development helper `.data/helpers/ffmpeg`, the one stand-in of row 184: ingest ports 8559 / 8561 instead of
8554 / 8556), plus:

- a wrapper around the store's `applyChanges` (module mock) that records a failure's `code`, `table`, `sqlState`,
  `constraint` and the shape of the changes, then rethrows - nothing else is replaced;
- the disk under `media/` (names and sizes) at the kill, 2 s after and at the end; the session's scalar facts;
- kill modes: `after` = row 184's (3 s after the first durable fragment); `fresh` = the instant both cameras reported
  durable fragment 2; `stale` = 1,700 ms after that instant;
- **a prediction written to `runs/<name>/prediction.json` before the `SIGKILL`**, from the worker's log line on disk
  (`audio_started.t0_real_us`), the session's `startedAt` and the last `FRAGMENT_CHECKPOINT` (media start + duration).
  Rule, fixed from row 184's four runs before any run of this row: `startedAt + media end - now` > 250 ms -> `WRITE_FAILED`;
  < 120 ms -> `SEALED`; between -> `UNDECIDED` (row 184's seal took its instant 141 to 221 ms after the worker went down).

Run: `sh .cache/task4-d1/run.sh <after|fresh|stale> <name>` from the repository root, command sandbox off; it waits at
the heavy-host lock as a turnstile, then takes `db-migrate` (bounded 900 s) BEFORE `heavy-host` (bounded 240 s), one
hold per run. Runs 2026-10-14 03:04 to 03:22 UTC, after the controller's restart of PostgreSQL (see section 8).

## 4. Runs on today's tree (before the fix) - prediction and outcome

Times in ms; "ahead" = `startedAt + media end` minus the instant of the prediction (just before the kill);
"zero" = `startedAt` minus the worker's `t0_real_us`.

| Run | Mode | Zero | Media end | Durable fragments CAM-01 / CAM-02 | Ahead | PREDICTED | Interrupted at | sealedAt after kill | Stated end minus sealedAt | Store failure | OUTCOME |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1 | after | 443 | 5,548 | 2 / 2 | 335 | WRITE_FAILED | 59 | 135 | +185 | 193 ms and 5,215 ms: `evidence_items` 23514 `evidence_items_values_check` | `FINALIZING` (seal failed twice) |
| a3 | after | 437 | 4,548 | 2 / 2 | -712 | SEALED | 49 | 124 | -853 | none | `SEALED` at 194 |
| a4 | after | 440 | 5,548 | 2 / 2 | 292 | WRITE_FAILED | 48 | 131 | +145 | 191 / 5,220 ms: the same | `FINALIZING` |
| f1 | fresh | 407 | 5,546 | 2 / 2 | 384 | WRITE_FAILED | 69 | 160 | +205 | 222 / 5,241 ms: the same | `FINALIZING` |
| f2 | fresh | 430 | 5,550 | 2 / 2 | 404 | WRITE_FAILED | 66 | 156 | +231 | 211 / 5,245 ms: the same | `FINALIZING` |
| s1 | stale | 439 | 5,547 | 2 / 2 | -1,305 | SEALED | 52 | 135 | -1,459 | none | `SEALED` at 207 |
| s2 | stale | 439 | 5,546 | 2 / 2 | -1,283 | SEALED | 40 | 120 | -1,420 | none | `SEALED` at 187 |

**Prediction: 7 of 7 right, none undecided.** The outcome follows the sign of "stated end minus sealedAt" in 7 of 7.
Every run printed `Tests 1 passed (1)` (the file asserts only that nothing of the session is left) and `0 remain`.

Void attempts, not counted: (1) the first eight starts at 09:57 local stopped at the session request (HTTP 422: my case
number `LP/2026/1014-00D1` is not a valid case number) - set aside under `.cache/task4-d1/void-422/`; (2) run a2 (10:05)
did not load: `ReferenceError: CAPTURE_DEVICE_TEST_AUDIT_DIFFERING_MAX is not defined` at
`apps/core-server/src/core/audit-details.ts:853` - another agent's edit in flight (the constant exists in
`packages/shared/src/api/capture-discovery.ts:1446`; a3 one minute later loaded). Neither reached a seal.

The disk at the kill (names and sizes; identical in shape in failing and sealing runs), e.g. a1:
`.capture-session/<id>.json` 649 B, `VIDEO-01.mp4` 1,661,890 B, `VIDEO-02.mp4` 2,164,632 B - no `.part`, no temporary
name, no third file. At the end of a failing run the package is complete on disk (`fragments/VIDEO-0N.mp4` of the same
sizes, `fragments/fragments.json` 2,509 B, `session-manifest.json` 6,961 B, `signature.sig` 547 B,
`device-certificate.pem` 664 B, `audit-session-extract.jsonl` 2,330 B) beside the plaintext recordings; at the end of a
sealing run the recordings and the facts file are gone (`SEALING_CAPTURE_FACTS_REMOVED`). `CLOSE_TRACKS` said
`truncatedTails: 0` in all 7.

## 5. Row 184's kept runs, read again (no run)

From `.cache/task4-row184/runs/<b1..b4, c1, c2>/data` (manifest timeline, worker log, error log):

| Run | Zero | Stated end minus sealedAt | `sealed_at >= ended_at` | Stated end after the worker went down | True end (t0 + media end) before it | Outcome of row 184 |
|---|---|---|---|---|---|---|
| b1 | 368 | -14 | holds | 207 | 161 | SEALED |
| b2 | 425 | +133 | broken | 310 | 115 | WRITE_FAILED x2 |
| b3 | 387 | +117 | broken | 258 | 129 | WRITE_FAILED x2 |
| b4 | 422 | +185 | broken | 327 | 95 | WRITE_FAILED x2 |
| c1, c2 (stopped) | 436, 421 | -283, -248 | holds (`stoppedAt` is used) | - | - | SEALED |

4 of 4 interrupted runs fit; the stopped ones cannot fail this way (their end is `stoppedAt`).

## 6. The fix (owned area: `apps/core-server/src/sealing`)

- `apps/core-server/src/sealing/pipeline/pipeline.ts`: new module function `durableEndOf(interrupted, session, mediaEndMs, sealedAt)` -
  the stop when stopped, otherwise `Math.min(startedAt + mediaEndMs, sealedAt)`; used by `liveInput` (manifest field 16
  `timeline.durableEndMs`, and so field 14 `recordingDurationMs`) and by `storePackage` (the item's `durableEndAt` ->
  `endedAt`), so manifest and item keep saying the same instant.
- `apps/core-server/src/sealing/__tests__/pipeline.test.ts`: one case in the existing block "the interrupted
  durable-prefix seal": 10,000 ms of durable media, `startedAt` 9,600 ms before the seal's instant.
  **RED before the fix** (run 08:39 local, before any edit of `pipeline.ts`): `durableEndMs 1791529000400` expected `1791529000000`, `recordingDurationMs
  10000` expected `9600`. **GREEN after**, and the package still verifies (`PASS`, interrupted).
- Mutation statement: removing the `Math.min` (the code as it was) turns exactly this case red.

Checks after the fix:

| Command | Result |
|---|---|
| `npx vitest run --project unit --maxWorkers=2` pipeline, pipeline-prefix, pipeline-one-camera, pipeline-frozen-facts, sealed-plaintext, way-out, seal-summary | `Test Files 7 passed (7)`, `Tests 146 passed (146)` |
| `npx vitest run --project unit --maxWorkers=2 src/sealing-host` | `Test Files 10 passed (10)`, `Tests 150 passed (150)` |
| `npx tsc --noEmit` (apps/core-server) | exit 0, no output |
| `npx oxlint` on the two files | exit 0 |
| end to end, fixed tree, mode `fresh` (failed 2 of 2 before): g1, g2, g3 | **`SEALED` 3 of 3** (prediction of the old rule: WRITE_FAILED, ahead 395 / 347 / 400); stated end = sealedAt exactly; no store failure; `0 remain` |

Not run: the database suites of the seal (`*.db.test.ts`), the full suite (rule 5). Three other files under
`src/sealing/__tests__` (`last-resort.db.test.ts`, `production-key-proof.db.test.ts`, `stt-states.db.test.ts`) show
uncommitted changes that are NOT this row's.

## 7. What an interrupted session's manifest states (the second question)

From the 10 manifests of this row (7 before the fix, 3 after) and row 184's b1-b4:

| Statement | Truthful? |
|---|---|
| `timeline.interrupted: true`, `stoppedAt: null`, every fragment `interrupted: true`, `CLOSE_TRACKS {interrupted: true}` | yes |
| A track cut short: each track carries its OWN duration and bytes (a1: `VIDEO-01` 4,546 ms / 1,661,890 B, `VIDEO-02` 5,548 ms / 2,164,632 B; s1 both 5,5xx ms) | yes - one camera's last fragment not yet durable at the kill is not claimed |
| `timeline.durableEndMs` / `recordingDurationMs` | **NO, overstated.** Before the fix 207 to 387 ms after the worker was killed (true end 23 to 161 ms before it); after the fix clamped to sealedAt: still 128 to 159 ms after the kill. The arithmetic assumes media zero = `startedAt` |
| The audio interval `toMs` = the LONGER track's end (a1: `21-5548`), with `containsIn` both files | partly: in the shorter file the audio ends with that file (4,546 ms); the interval does not say so per file |
| Audio / video gaps of rows 191c / R1b (`audioRestartGaps`, video absences) | the seal's reader states them from the session's own records with no branch on the end cause (`sealing-host/session-reader.ts`, no `interrupted` / cause term) - so an interrupted session states them as a stopped one does. NOT measured: no run combined a restart with an interruption (a later worker exists only before the first durable fragment, and a development restart never reaches a recording - row 184 section 6.4) |

In production (real microphones, helpers started after the worker's `START` acknowledgement, `capture-session/index.ts`
start order) the worker's zero should lie AFTER `startedAt`: then the old arithmetic understates the end and never trips
the constraint. That the development helper's first ~0.4 s arrive faster than real time (zero back-dated to before the
helper existed) is a reading of `audio.c:574-586` and the numbers above, not separately measured; real-card behaviour is
hardware package matter (`9A/H-08`).

**Request (one line in `file_requests.md`)**: the honest anchor is the worker's media zero. Smallest change: the worker
puts `t0_real_us` (already in its log and in its manifest line `{"type":"t0"}`, `audio.c:591`) on the
`AUDIO_SOURCE_INTERVAL` record of sample 0 (it already carries the instant it was HELD, `capture-session/index.ts:1032`
- if that member is `t0_real` itself, only the Core side is needed); the session stores it; the seal states
`mediaZeroAt + mediaEnd` instead of `startedAt + mediaEnd`. Needs `packages/capture-protocol` and/or the worker (nobody
edits them in this wave) and a manifest-semantics decision; the `Math.min` stays as the guard.

## 8. Before / after the database start

The controller reported that the project PostgreSQL (127.0.0.1:4432) was not running this morning until it was started.
**No run of this row reached the database before that**: all my starts until about 09:57 local were waiting for the locks
(no vitest process ran); the first runs that loaded (09:57) answered the session request with HTTP 422 from the Core,
i.e. the database was up (`[test:db] PostgreSQL 18.4 on 127.0.0.1:4432`). No connection refusal is counted anywhere
above. Row 184's runs (2026-10-13) are read from their kept files only.

## 9. Rules kept

Edit tool for existing files (pipeline.ts, pipeline.test.ts, file_claims.md, file_requests.md); new files with Write or
under `.cache/task4-d1/`. No commit. No worker, protocol, engine, db or fence file touched. Locks: db-migrate before
heavy-host, bounded, one hold per run (my first two waiting chains held `db-migrate` while waiting for `heavy-host`
for up to ~19 minutes before I replaced them with the turnstile script - DRIVER DECISION, stated). Worker listeners
8559 / 8561 only, loopback; no HTTP listener. After the last run: `pgrep -fl task4-d1` empty, no listener on
8559-8574, `node scripts/secret-scan/count-only.mjs .cache/task4-d1` -> `TOTAL: 0 in 0 file(s)`.

---
*Generated: 2026-10-14*
