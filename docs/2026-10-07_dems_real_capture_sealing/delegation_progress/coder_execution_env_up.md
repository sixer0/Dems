# coder-execution - gate environment up (gates 70, 75, 81, 89, 94)

- Date: 2026-10-10, 12:31-12:40 WIB. Tree `f293221`. No product source change, no commit.
- Status: **needs-review** (everything asked is up and smoked; decisions E-1, E-2 to rule).
- Note: `initialization/05_gate_environment_up.md` (operating sheet in section 5).

## Running (left running)

| What | Where |
|---|---|
| Core lane 1, SIMULATED + demo controls | 127.0.0.1:4421 |
| Core lane 2, REAL_DEVELOPMENT, worker 0.5.0, vad READY | 127.0.0.1:4422 |
| Web lane 1 / lane 2 (Vite, proxy `/api/v1`, `/ws`, `/media`) | 127.0.0.1:5176 / 5177 |
| Metro | 127.0.0.1:8081 |
| `dems2_phone` (emulator-5554) -> lane 1, paired `DEV-0001`, online | unlocked, app on Login |
| `dems2_tablet` (emulator-5556) -> lane 2, paired `DEV-0001`, online | unlocked, app on Login |

Not started: lane 3, main, `dems2_phone2` (not needed by the plan).

## Done

- Start state clean; four databases at schema 6 / `dbc-7`; `lane.sh reset` 2, 1, 3, main: all exit 0
  (lane 2: `2 sealed with the development key`).
- Unlock: `script -q /dev/null apps/mobile/scripts/emulator-user-lock.sh unlock <tablet|phone> </dev/null`
  (pseudo-terminal for the guard; unlock only; no PIN passed or printed; no lock / fingerprint change).
- No Gradle build (E-1): installed APK = host APK by SHA-256, native inputs unchanged, JS from Metro.
- Finding (E-2): re-pointing a device to another lane deletes its stored credential (401 ->
  `forget('unknown')`, `apps/mobile/src/runtime/sim-adapters.ts:754-761`) - a new pairing each way.

## Files

| File | Kind |
|---|---|
| `docs/2026-10-07_dems_real_capture_sealing/initialization/05_gate_environment_up.md` | new |
| `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_env_up.md` | new (this) |
| `.cache/gate-env/` : `tablet_lane2.png`, `phone_lane1.png`, `web_lane1_5176.png`, `web_lane2_5177.png`, `reset_*.log`, `boot_*.log`, `gate-session.mts` | git-ignored evidence + session helper |
| `.locks/core-server.lane{1,2}.log`, `.locks/core-server.lane{1,2}.vite.{log,pid}`, `.locks/metro.8081.log`, `.locks/dems2_{phone,tablet}.{pid,emulator.log}` | runtime logs / PID files (git-ignored) |

## Blockers

None.

## For the decision log

E-1 no rebuild; E-2 re-point = new pairing; E-3 lane 3 / main / phone2 not started; E-4 one
supervisor sign-in / sign-out on lanes 1 and 2 (audit = seed + those rows); E-5 scratch session
helper; E-6 unlock guard satisfied with `script` for `unlock` only.
