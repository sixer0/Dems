---
task_id: 2026-10-07_dems_real_capture_sealing
row: 82b (M7) — the sealing pipeline mounted in the running Core, operation 83, one worker-recorded session sealed and verified
date: 2026-10-09
agent: coder-execution
baseline: e296ce7 + the uncommitted wave D tree
status: needs-review — composition, op 83 and both end-to-end cases are built and ran green; case (a) had ONE unexplained red in four runs (section 5); the demo regeneration (item 4) is NOT done; three foreign pins are red until their owners apply filed requests
tier: 3
---

# Row 82b — seal composition

Paths relative to the repository root; `S` = `apps/core-server/src`. No commit, no migration, no lockfile write, `.data/pg*.env` not read, no camera or microphone opened.

## 1. What was built

| Part | Where | Real / stand-in |
|---|---|---|
| Closed unit `S/sealing-host` (`sealingHost(app)`, `mountSealingHost(app)`): production `SealingPorts`, controller, hand-off listener, RECOVERY boot step `sealing.resume`, real verification for op 41 | `S/sealing-host/index.ts` | real |
| Seal-time cipher over the session key `KID-<sessionId>` (create at the first fragment, open afterwards; nonce reuse refused) — the ONE file that imports the credential store | `S/sealing-host/session-key.ts` | real |
| Session record reader: engine committed state + `session_capture_sources` + `session_audio_intervals` + `audit_log` + the session's STT snapshot | `S/sealing-host/session-reader.ts` | real, with the stand-in values of section 4 |
| Op 83 answer from the session's `finalization` slice | `S/sealing-host/progress.ts` | real |
| Module `modules/sealing` (`sealingModule`): the op 83 route and the mount | `S/modules/sealing/index.ts`; `S/app.ts` one import + one unit line | real |
| Session machine: a session the Core's capture recorded (it carries `captureDurable`) is never sealed by the timer | `packages/shared/src/sim/session-machine.ts` `advanceStopping` | real |
| Pipeline: a FAILED step carries an operator-readable sentence as its `detail`; field 50 `keyframeAligned` from the fragment table | `S/sealing/pipeline/contract.ts` `sealingFailureReason`, `pipeline.ts` | real |

**Real modes only.** `mountSealingHost` asks `captureOperationOf(app.config)`; in `SIMULATED` it builds nothing (no port, no listener, no boot step, no verification provided) and the simulator's timed seal is the seal. Op 83 is routed in both modes.

**Hand-off.** `sealOnCaptureHandOff(sessionCapture(app))`: STOPPED -> normal seal, INTERRUPTED -> interrupted seal, anything else nothing. **RECOVERY.** The boot step runs after the engine's and starts `controller.resume()` in the background (the boot does not wait for a seal).

**Why the session-machine change.** In real capture the worker needs time to close its files; the simulator moved STOPPING to a timed FINALIZING after 1.5 s and would have put a SIMULATED item beside a real recording. Such a session now stays STOPPING until the pipeline's first report.

**A seal that fails** leaves: the FAILED row in `sealing_jobs`, the error-log entry, and the session in FINALIZING with that step in `error` and a sentence as its `detail`; no item. A run that could not start is recorded by the unit (`SEALING_RUN_REJECTED`) and told to the session the same way. Next attempt: the next process start, once. No file handle is held by the unit; the pipeline's are closed in its `finally` blocks.

**Known limit, tested.** Second camera file missing, or cut inside its first fragment: `CAMERA_FILE_UNUSABLE` at CLOSE_TRACKS, detail "Camera file VIDEO-02 holds no whole recording (...): this session cannot be sealed.", nothing signed, a second run ends the same way at attempt 2.

**Op 83.** `progressPct` from the per-step percent (done 100, running its own, else 0); `etaMs` = the RUNNING step's remaining time for a pipeline-driven seal (null without estimate, 0 when all done); for the simulator's timed seal the simulator's own run figure. 404 not the open session, 409 before finalization started, 422 bad ID; access = the registry's rule (any signed-in operator).

## 2. Results (each once; repeats only after a fail)

| Check | Command | Result |
|---|---|---|
| Unit: sealing, sealing-host, modules/sealing, static guards, sessions + evidence module tests | `npx vitest run --root apps/core-server --project unit src/sealing src/sealing-host src/modules/sealing test/static src/engine/__tests__/static.test.ts src/credential-store/__tests__/static.test.ts src/capture/__tests__/static.test.ts src/modules/sessions/__tests__ src/modules/evidence/__tests__` | 735 passed, 2 failed — both foreign pins (section 6) |
| of which `pipeline.test.ts` | | 41 passed (4 new) |
| of which new: `sealing-host.test.ts`, `progress.test.ts`, `modules/sealing/__tests__/routes.test.ts` | | 6 + 6 + 4 passed |
| Permission guard folder | `... src/plugins/permission-guard` | 1 failed: `guard.test.ts` "the app without the domain modules" — needs the stub line (request filed) |
| Shared session machine | `npx vitest run --root packages/shared test/sim-core-driven-seal.test.ts` | 20 passed (3 new: simulated seals by time; `captureDurable` true / false does not) |
| Seal doors on PostgreSQL, the two MEASURED assertions flipped (D4's fix is in the tree) | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/engine/__tests__/seal-actions.db.test.ts` | 8 passed |
| Row 71b's session wiring after the session-machine change | `... --project db src/capture-session` | 12 passed |
| `capture-actions.db.test.ts` | same lock | 7 passed, 1 failed (A-4: `transcriber.config` boot refusal `CPU_LOCAL_RUNTIME_MISSING` in that file's real-mode fixture; not this row) |
| Typecheck | `npx tsc --noEmit -p apps/core-server`; `npm run typecheck -w @dems/shared` | exit 0; no error |
| Lint | `npm run lint -w @dems/core-server` | 1 warning in this row's files (`sealing-host/index.ts`), fixed; second run after the fix: 0 findings in this row's files |
| END TO END (section 3) | section 3 | (a) 3 of 4 runs green, (b) 2 of 2 |

No mutation run was made in this row; the evidence-integrity rules carry paired controls instead (AAD position control, 401 control of the access rule, simulated vs recorded session, percent / ETA controls, the failure-sentence control).

## 3. End-to-end proof

File `S/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` (skipped unless `DEMS_SEAL_E2E=1`). Built worker `apps/capture-worker/build/capture-worker` (newer than its sources, not rebuilt), generated sources (kind FAKE: test picture and tone through the private helper `.data/helpers/ffmpeg`), throw-away database and data directory, loopback, ports 8554 / 8556.

**Layers exercised:** app factory with every unit, request stages and routes through `app.inject` (sign-in, create, start, pre-check, stop, op 83, op 41), engine as `dems_app`, supervisor + real worker, fragment recorder, composition, credential store, development signing key, verify v2. **Not exercised:** a TCP listener of the Core; a paired tablet (`setTabletLink` through the engine); the transcriber (`stt_config.enabled` set false in the throw-away database, as row 71b's rig does — the real-mode boot refuses the seeded STT configuration on this host).

- **(a)** start -> ~7 s recording -> stop -> the composition seals (attempt 1, not interrupted) -> six `sealing_jobs` rows DONE -> package folder holds manifest, signature, certificate, audit extract, `fragments/{VIDEO-01.mp4,VIDEO-02.mp4,fragments.json}`; the two plaintext recordings are gone; no `moof` readable at any fragment offset -> op 83 `SEALED / 100 / 0` -> op 41 `ok: true`, `overall: PASS`, 15 checks all PASS, `sources.development: true` (tracks and the interval class `FAKE`), transcript `DISABLED_BY_CONFIGURATION`.
- **(b)** recording -> SIGKILL to the worker and the Core closed in the same turn (session row still RECORDING, no `sealing_jobs` row, recording on disk) -> a new Core on the same database and media -> RECOVERY seals as interrupted -> the same assertions with `interrupted: true` in the manifest, on every fragment and in op 41. The "crash" of the Core is an `app.close()` in-process, not a killed process.

## 4. Stand-in values and decisions

| ID | Decision / stand-in |
|---|---|
| D-82b-1 | Unit `S/sealing-host` + module `modules/sealing` (routes are registered by modules only). One mount line in `app.ts` |
| D-82b-2 | `advanceStopping` leaves a session with `captureDurable` to the pipeline (above) |
| D-82b-3 | **A session without an STT snapshot is sealed with the transcript DISABLED** and the fixed snapshot `{ enabled: false, backend: 'cpu-local', model: 'none', diarization: false, revision: 1 }`. Today NOTHING takes the snapshot at a session start (`snapshotSttConfigForSession` has no caller), so every real session is this case. `DISABLED_BY_CONFIGURATION` is then not literally true. To rule |
| D-82b-4 | A session whose snapshot ENABLES STT gets a seam that answers NOT_READY (no transcriber session is opened by any row): row 79's step waits to its bound (30 min) and row 119's last resort seals PARTIAL / `TRANSCRIPT_UNAVAILABLE_AT_SEAL`. Not reachable until D-82b-3's gap is closed |
| D-82b-5 | The evidence ID is the engine's: the reader moves a session without one to FINALIZING (all steps PENDING) before it reads the facts |
| D-82b-6 | The real verification of op 41 (`createRealEvidenceVerification`) had no production caller; the composition provides it. Trusted certificate = the current signing certificate only (no retained list exists) |
| D-82b-7 | Stand-ins in the manifest, no source in the Core today: `subject.authorization` (fixed text), `tracks[].clockOffsetMs` 0, `tracks[].codec` null, `avOffsetMs` null, fields 127 / 128 null (the capture side keeps `heldMs` only, nothing across a restart), `audio.codec` constant, `notice` by capture operation, timezone `+07:00` |
| D-82b-8 | `keyframeAligned` is computed from the sealed fragments, not read from the session record |
| D-82b-9 | The e2e is a vitest db file behind `DEMS_SEAL_E2E=1`, so the whole db suite never starts the worker |

## 5. Not proven / not done

1. **One unexplained red of case (a).** Run 1 of the final code: the assertion on the op 41 body (`ok / overall / interrupted / sources.development`) failed while the manifest assertions before it passed; the body was not captured. The next three runs passed with identical product code. Hypothesis, not verified: pass D4 was writing the op 41 body (`evidence-verify`, shared report) at that moment. The file now writes the report to `DEMS_SEAL_E2E_OUT` for the runner.
2. **Item 4, demo regeneration: NOT done.** `gen-demo-evidence.ts` is untouched; row 87's request stays open.
3. No db test runs the composition on a fake worker; the composition against the real tables is the e2e only.
4. The process-kill matrix of row 86 has no hook in production ports (none was added).
5. Spec errata of note 37 §9 are not placed; the comment block above `LANDED_UNROUTED` still lists op 83.
6. No device or browser check.

## 6. Reds caused by this row's mount, waiting for owners (requests filed)

| Test | Why | Request |
|---|---|---|
| `plugins/permission-guard/__tests__/guard.test.ts` "app without the domain modules" | `modules/sealing` needs its stub line | `without-domain-modules.ts` |
| `modules/sessions/__tests__/routes.test.ts:181` | 18 routes under `/api/v1/session`, the list expects 17 | pass D4 / 71b |
| `test/acceptance/rbac-matrix.test.ts` `DEFERRED_ROUTE` | op 83 is routed now | pass D4 (not run here) |

Not this row's: `capture/__tests__/static.test.ts:536` — the frozen-file digest passes with my two waived lines; the STT index pin is off by pass D4's own delta (their `transcripts` import), my +1 is applied.

## 7. Device / browser checks for the M7 gate

As note 37 §8, now runnable: development session -> stop -> Finalizing shows the steps and the running step's ETA -> SEALED -> verify PASS with the development-source line; kill the Core mid-recording -> restart -> Finalizing in place -> SEALED interrupted; a session with one camera -> Finalizing shows the failure sentence.
