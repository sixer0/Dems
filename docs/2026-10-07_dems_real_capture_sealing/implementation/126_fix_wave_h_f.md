---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-10
agent: coder-execution (wave H, driver F)
source_plan: docs/2026-10-07_dems_real_capture_sealing/delegation_progress/fix_brief_wave_h.md
status: needs-review
---

# Fix wave H, driver F - capture boot, supervisor refusals, system notices

Tree: `f293221` + the other wave H drivers' in-flight edits. No commit, no migration, no lockfile
write. **`apps/capture-worker/**` was NOT changed** (`git status apps/capture-worker/src` is empty):
the worker stays `capture-worker/0.5.0`, so its e2e series need not run again for the worker. The
supervisor it is driven through DID change (see "Checks for the test runner").

Paths below are under `apps/core-server/`.

## 1. Findings

| # | Finding | Reproduced (red first)? | Fix | Test | Status |
|---|---|---|---|---|---|
| 1 | Gate 64 C7: a `capture-worker/0.4.0` binary passes the boot (the allowlist is a FORM; the probe does not pass `--max-fragment-bytes`) | YES. `wave-h-f.test.ts` (all 24 cases failed before the fix) and `wave-h-f-boot.test.ts`: a scripted worker answering `capture-worker/0.4.0` booted and was started | `CAPTURE_WORKER_VERSION = 'capture-worker/0.5.0'` (`src/capture/boot/checks.ts:270`), held equal to `worker.h` by `wave-h-f.test.ts`. `workerVersionRefusalOf` order: protocol, proof mark, release form, then THE version -> `CAPTURE_WORKER_VERSION_MISMATCH`, boot reason `expected capture-worker/0.5.0, found capture-worker/0.4.0`. The same one rule for every HELLO of a session (`supervisor.ts:374`, `WorkerDownCode.VERSION_MISMATCH`, detail = the word found, not retried, nothing sent). The probe and the session start build their arguments with ONE function, `captureWorkerArguments` (NEW `src/capture/worker-arguments.ts`; `boot/index.ts:159`, `index.ts:136`) | `capture/__tests__/wave-h-f.test.ts` item 1 (4), `capture/boot/__tests__/wave-h-f-boot.test.ts` item 1 (6: refusal by name with expected / found, logged + persisted; newer word refused; the order; the probe's argument list equals the session's except the `--log` value; a worker that ends with usage on `--max-fragment-bytes` is refused AT BOOT `CAPTURE_WORKER_NO_HANDSHAKE / EXITED`); REAL binaries: `worker-probe.real.ts` run once - release accepted with the session argument set, 9 proof builds refused | FIXED |
| 2 | Gate 64 C4 / F-Y decision 8: a SYSTEM notice of a Core that died stays active for ever | YES, on PostgreSQL: after a restart the three notices (one CRITICAL) were still active after every boot step (`wave-h-f-boot-clear.db.test.ts`, red at line 91 before the fix) | NEW `src/capture/stale-notices.ts` (pure selection) + the capture unit's boot block (`index.ts:234`): every active `SYSTEM` alert whose reason is an advisory reason or `EVIDENCE_VOLUME_SYNC_NOT_FULL` is resolved through `engine.clearCaptureWarning`, in real operations, beside the D84 R-4 fault clear, before a client connects; log line + one persistent error-log row `CAPTURE_STALE_NOTICES_CLEARED` (count, reason codes); a failure is logged + persisted (`CAPTURE_STALE_NOTICE_NOT_CLEARED`) and never stops the boot | `wave-h-f-boot-clear.db.test.ts` (restart on a throw-away database; control: the pre-check notice stays; a later raise is a NEW alert), `wave-h-f.test.ts` item 2 (2) | FIXED, with ONE open point: no `audit_log` row (decision 1 below) |
| 3 | F-Y decision 6 / G75-05: the supervisor's other refusals, and a real worker crash, raise the fault without a reason | YES: `tidy-fy.test.ts` pinned "WITHOUT a reason"; the 12 scenarios of `wave-h-f.test.ts` item 3 were red | Closed enumerations in `src/capture/types.ts`: `SupervisorRefusal` (:95, the 12 things the supervisor refuses of a worker's words) and `CaptureDownReason` (:137, every end of a worker: the 12 + 21). `captureDownReasonOf` (`supervisor.ts:319`) maps EVERY code / detail / exit to one member. It is `WorkerDown.reason` (workerDown events, `status().lastCrash`, the stop outcome) and the member `cause` of the supervisor's own `warning` event (`types.ts:295`); the forwarder raises the engine fault with it as `reason` (`forwarder.ts:421`). Also in the persistent error log (`reason`, `downReason`). A final crash code (`NO_CAMERA_CONNECTED`) is a reason only for a session WITHOUT durable media | `wave-h-f.test.ts` item 3 (17: each refusal, crash, kill, non-zero exit, exit 0, heartbeat, failed starts, `STOP_TIMEOUT` / `WORKER_STOP_NOT_ACKNOWLEDGED` on the stop outcome, closedness incl. a read of `supervisor.ts` for a raw literal); THE LINK: `fault-wording.test.ts` enumerates `Object.values(CaptureDownReason)` | FIXED on the capture side. **30 cases of `fault-wording.test.ts` are RED until driver B adds the sentences** (request filed 09:50:58Z) - that red IS the link working |
| 4 | Gate 89 C3: nothing says which camera was given up mid-session, when and why | YES (the fact was nowhere: `status().cameraEnds` undefined; `STOPPED` / `INTERRUPTED` carry `files`, `firstVideo`, a session-wide `cause` only) | `CaptureCameraEnd` (`types.ts:220`): `{ deviceId, reason (closed: CAMERA_END_REASONS), at, lastDurableFragmentIndex, lastDurableMediaEndMs }`, kept per camera by the supervisor when the worker's warning line arrives (`supervisor.ts:887`), handed over as `status().cameraEnds` (:1055) and `CaptureStopOutcome.cameraEnds` (:644), both optional | `wave-h-f.test.ts` item 4 (3: clock floor on CAM-02 with a clean stop; never connected + interrupted stop; control: mic / advisory / nothing) | BUILT on the supervisor side; **the hand-off events are not mine**: member names sent to A and B by request line (10:08:55Z). Until `capture-session/index.ts` copies the list, the seal does not see it |
| 5 | `.sealing` is not in the owner-only list of the boot | YES (`wave-h-f-boot.test.ts` item 5: 4 cases red) | `EVIDENCE_STORE_PRIVATE_FOLDERS['.sealing']` -> `SEALING_STAGING_READABLE_BY_OTHERS` (`boot/checks.ts:175`); the refusal text names the folder and "none of them may be a link". The probe reads it with `lstat` like the others (no change in `evidence-volume.ts`: it iterates the list) | item 5 (4: the list; 0750 refused then accepted after chmod 700; a link refused; a real-mode boot stopped with `CAPTURE_EVIDENCE_STORE_UNUSABLE / SEALING_STAGING_READABLE_BY_OTHERS`). Confirmed still holding after item 1: `CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH` (pure + through the real channel) and the proof-build refusal (order test; `checks.test.ts`, `boot.test.ts`, `review-m3.test.ts`, `fault-lifecycle.test.ts` green; 9 real proof builds refused) | FIXED |

### Confirmations asked for

- **The e2e harness's negative-control binaries need no bypass.** They are driven by
  `apps/capture-worker/test/m3worker.py` directly (`VARIANTS`, line 43; "driven by THIS script only",
  line 48). Through the supervisor a proof build is refused by its mark BEFORE the version is looked
  at (the order is unchanged: protocol, proof, form, version), with the same code and detail the
  harness asserts (`CAPTURE_WORKER_PROOF_BUILD` / `PROOF_BUILD`, `m3worker.py:1555-1556`).
- **Fake workers state the built version.** `test/support/capture.ts` takes its default from
  `CAPTURE_WORKER_VERSION`; `capture-stub-worker.mjs` already says `capture-worker/0.5.0` (held by
  `tidy-fy.test.ts`); not edited. `realBootFixture().worker()` (boot test support) writes the built
  version for any plain release word, so the db tests of other units that name `0.3.0` / `0.4.0`
  boot unchanged (notice line filed); `workerSaying()` writes any word as given.

## 2. Pins moved by delta (my folders only)

`checks.test.ts` (the good HELLO; `12.0.1` is now a mismatch), `boot.test.ts` (built version),
`review-m3.test.ts` and `fault-lifecycle.test.ts` (the CONTROL word is the built version),
`forwarder.test.ts` (4 expectations gain `reason`), `tidy-fy.test.ts` (the "without a reason"
control now names the other reason; the launcher-arguments regex follows `captureWorkerArguments`),
`module.test.ts` (persisted context gains `reason`), `static.test.ts` (two new files of the folder),
`worker-probe.real.ts` (the check for the runner uses the boot's argument set).

## 3. Commands and results (each once; a second run only after a fail)

| Check | Command | Result |
|---|---|---|
| Red first | `npx vitest run --root apps/core-server --project unit src/capture/__tests__/wave-h-f.test.ts` before the fix | 24 of 24 failed |
| Unit, capture + static (sandbox off) | `npx vitest run --root apps/core-server --project unit src/capture test/static </dev/null` | 72 files: 66 passed, 6 failed; 1124 tests passed, 37 failed. MINE, fixed and re-run green: `module.test.ts` (1), `static.test.ts` (1 pin). OPEN BY DESIGN: `fault-wording.test.ts` 30 (driver B's sentences). NOT MINE: `test/static/{credentials,network}.test.ts` (`src/evidence-export/receiver-cli.ts`, driver C1), `test/static/imports.test.ts` 3 (`src/evidence-facts`, `sealing-host/index.ts:54 -> capture-session/facts`, driver A) |
| Re-run after the fail | `... src/capture/__tests__/static.test.ts src/capture/__tests__/module.test.ts src/capture/__tests__/wave-h-f.test.ts` | 3 files, 80 passed |
| Unit, notices + session | `... --project unit src/capture-notices src/capture-session` | 6 files, 51 passed |
| DB (lock `db-migrate`, sandbox off) | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture-notices src/capture-session src/capture/__tests__` | 4 files, 60 passed (incl. `wave-h-f-boot-clear.db.test.ts`, red before the fix) |
| Real binaries, HELLO only (lock `heavy-host`, no port, no START) | `/usr/bin/lockf -k .locks/heavy-host.lock npx tsx apps/core-server/src/capture/boot/__tests__/worker-probe.real.ts` | `capture-worker: ACCEPTED (capture-worker/0.5.0)`; 9 proof builds `CAPTURE_WORKER_PROOF_BUILD`; exit 0 |
| Typecheck | `npx tsc --noEmit -p apps/core-server` | 0 errors in `src/capture/**`, `src/capture-notices/**`, `test/support/capture*`; the errors present are other drivers' in-flight files (`capture-session/__tests__/facts-fy.test.ts`, `sealing-host/__tests__`, `modules/evidence-export/__tests__`, `modules/evidence/__tests__`, `packages/shared/src/sim/generator.ts`) |
| Lint | `npm run lint -w apps/core-server` | 0 findings in my files (1 warning in `src/db/reset/session-artefacts.ts`, driver A) |

One flake seen and told apart: `capture/__tests__/ipc.test.ts` "the interval of the start at T0 ..."
failed once inside a 40-file run on a loaded host (a real child process and wall time) and passed
alone; my change does not touch its path.

## 4. Decisions for the controller

1. **"Audited as cleared at boot" is only half met.** The notices' own shared rule is "a clear
   writes no audit row" (`packages/shared/src/sim/capture-notices.ts`). What I could write from my
   area is the log line and ONE persistent error-log row. An `audit_log` row needs a shared
   transition or an engine door (driver B / A). Request line filed. Rule: accept the error-log row,
   or order the audit row.
2. **Not cleared at boot, on purpose:** `CAPTURE_DEVICE_UNREACHABLE` and `CAPTURE_DISCOVERY_EMPTY`.
   They are what the last pre-check / session start / search found, the next one resolves them
   (D72(h)), and resolving one marks its device online - a statement a boot cannot make. The
   ruling says "every capture-originated SYSTEM notice"; I read it as the notices of a RUNNING
   capture. Overrule if the two are wanted too.
3. **G75-10 (a capture fault stays active after an interrupted seal) is NOT changed here.** It is
   not in my findings list. The supervisor can end its own fault when the faulted session's stop
   finishes (one `CLEARED` in `finishStop`), but clearing a `CAPTURE_FAULT` in the engine while the
   session is FINALIZING is session-state behaviour (driver B's). Say if it should be done on the
   capture side.
4. **G75-05, first half** (the `FAULT_CLEARED` row of a no-camera fault worded with another cause) is
   in `packages/shared/src/sim/faults.ts` (driver B): a capture-wide fault is keyed without its
   reason, so the clear cannot word it. Not mine; named in the request to B by context only.
5. **Until driver B lands the 30 sentences** a supervisor fault reads the neutral
   "Capture reported a problem (<CODE>)." instead of "The capture stopped unexpectedly ...". The
   code is true; the sentence is poorer for one commit window. Land B's table in the same commit.
6. **`lastDurableMediaEndMs` is a lower bound**, stated in the type: the fragment open when the
   camera ended is closed after the worker's statement, and the worker goes on writing audio-only
   fragments into that file. If the manifest mark needs the exact last VIDEO sample time, that is a
   worker change (a member on the warning or a record) and a new worker version - not done.
7. `WorkerDown.reason`, `CaptureStatus.cameraEnds`, `CaptureStopOutcome.cameraEnds` and the event
   member `cause` are OPTIONAL in the types so that the test doubles of other units compile
   unchanged; the supervisor always sets the first two.

## 5. Checks for the test runner

| Check | Command | Lock | Expected |
|---|---|---|---|
| The checks of the worker series that go THROUGH THE PRODUCTION SUPERVISOR (the supervisor changed; the worker did not) | `make -C apps/capture-worker e2e E2E_ARGS="--tag waveHF --ports <a free pair of 8559-8564, not 8554 / 8556> --runs 1 --no-build --only '^(sup_|neg_sup_)'"` | `heavy-host` (the runner takes it itself) | every `sup_*` PASS, every `neg_sup_*` FAIL on its named criterion; in particular `sup_refuses_proof_build` still reads `CAPTURE_WORKER_PROOF_BUILD / PROOF_BUILD` |
| Whole core-server unit + db once per commit | the controller's usual commands | `db-migrate` for db | my files green; `fault-wording.test.ts` green only with driver B's sentences |
| Real worker HELLO with the boot argument set (already run once by me) | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock npx tsx apps/core-server/src/capture/boot/__tests__/worker-probe.real.ts` | `heavy-host` | exit 0 |

## 6. Gate checks to drive again on a device / browser because of this change

- **Gate 64 C7**: start a lane Core with `DEMS_CAPTURE_WORKER` pointing at a 0.4.0 build (or any
  renamed older binary): the boot must stop at `capture.boot` with `CAPTURE_WORKER_VERSION_MISMATCH`
  and "expected capture-worker/0.5.0, found ...". Control: the lane boots with the tree's build.
- **Gate 64 C4**: with a session recording on a lane and an advisory / volume notice active, kill
  the Core (`kill -9`), start it again: the bell shows no stale notice; the Core log has
  `CAPTURE_STALE_NOTICES_CLEARED`.
- **Gate 75 G75-05 (second half)**: kill the worker of a recording lane session: the alert and its
  `FAULT_RAISED` row carry `reason: WORKER_KILLED` and (with B's table) the sentence of that reason.
- **Gate 64 row-96 note**: `chmod 755 <media root>/.sealing`, start the Core: refused with
  `CAPTURE_EVIDENCE_STORE_UNUSABLE`, reason `SEALING_STAGING_READABLE_BY_OTHERS`; `chmod 700`: boots.
- **Gate 89 C3** stays NOT DRIVABLE with FAKE sources (a fake camera's clock cannot be offset on a
  lane); the fact is proven on the supervisor with the fake worker only.

## 7. Request lines filed (`delegation_progress/file_requests.md`)

1. To B: the 30 reason names + proposed sentences (one line) and where the reason travels.
2. To A and B: the member names of the per-camera end (`CaptureCameraEnd`, `cameraEnds`) and the
   proposed optional member on `STOPPED` / `INTERRUPTED`; `WorkerDown.reason` for the interrupted cause.
3. To the controller / B: the audit-row decision of the boot clear.
4. To the owners of the db tests that name a stand-in worker version: notice, no change needed.

---
*Generated: 2026-10-10*
