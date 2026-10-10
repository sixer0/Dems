# coder-execution - wave H, driver F (capture boot, supervisor refusals, system notices)

Status: **needs-review** (all five findings fixed on the capture side and proven by tests that were
red first; three things wait on others - see "Open"). Note: `implementation/126_fix_wave_h_f.md`.

## Files (under `apps/core-server/`)

| File | Change |
|---|---|
| `src/capture/boot/checks.ts` | `CAPTURE_WORKER_VERSION`, refusal `CAPTURE_WORKER_VERSION_MISMATCH` (expected / found), `.sealing` in the owner-only folders (`SEALING_STAGING_READABLE_BY_OTHERS`) |
| `src/capture/boot/index.ts` | the probe launches with `captureWorkerArguments`; exports |
| `src/capture/worker-arguments.ts` | NEW: one argument list for a session start and the boot probe (settings moved here from `index.ts`) |
| `src/capture/types.ts` | `SupervisorRefusal`, `CaptureDownReason`, `WorkerDown.reason`, `CaptureCameraEnd`, `CAMERA_END_REASONS`, `cameraEnds` on status / stop outcome, `cause` on the supervisor's warning, `WorkerDownCode.VERSION_MISMATCH` |
| `src/capture/supervisor.ts` | `captureDownReasonOf`, the exact-version rule for every HELLO, refusals named only through `SupervisorRefusal`, per-camera ends |
| `src/capture/forwarder.ts` | the supervisor's fault is raised with its `cause` as `reason` |
| `src/capture/stale-notices.ts` | NEW: which notices a boot resolves |
| `src/capture/index.ts` | boot clear of stale capture notices; `reason` in the persisted fault and worker-down rows; exports |
| `test/support/capture.ts` | the fake worker's default version is `CAPTURE_WORKER_VERSION` |
| `src/capture/boot/__tests__/support.ts` | `worker()` writes the built version for a plain release word; NEW `workerSaying()` |
| `src/capture/boot/__tests__/worker-probe.real.ts` | the runner's check uses the boot argument set |
| NEW tests | `src/capture/__tests__/wave-h-f.test.ts` (26), `src/capture/boot/__tests__/wave-h-f-boot.test.ts` (10), `src/capture/__tests__/wave-h-f-boot-clear.db.test.ts` (1, db) |
| Pins by delta | `src/capture/__tests__/{fault-lifecycle,fault-wording,forwarder,module,review-m3,static,tidy-fy}.test.ts`, `src/capture/boot/__tests__/{boot,checks}.test.ts` |

NOT changed: `apps/capture-worker/**`, `src/capture-notices/**`, `test/support/capture-stub-worker.mjs`,
`test/support/capture-session-driver.ts`, any file of another driver.

## Open

- `fault-wording.test.ts`: 30 cases red until driver B adds the sentences of the new reasons (request 09:50:58Z).
- The per-camera end reaches the seal only when `capture-session/index.ts` copies `cameraEnds` onto `STOPPED` / `INTERRUPTED` (request 10:08:55Z to A and B).
- The boot clear writes a log line and a persistent error-log row, not an `audit_log` row (decision for the controller, request 10:08:55Z).

## Claims / requests

`file_claims.md`: line `wave H F` (+ this addition: `src/capture/worker-arguments.ts`, `src/capture/stale-notices.ts`).
`file_requests.md`: four lines `wave H F` (09:50:58Z, 3 x 10:08:55Z).
