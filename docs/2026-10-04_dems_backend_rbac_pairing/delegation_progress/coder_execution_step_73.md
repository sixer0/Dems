---
task_slug: dems_backend_rbac_pairing
step: 73
plan_row: W51
agent: coder-execution
date: 2026-10-04
status: needs-review
---

# Step 73 (W51): mobile runtime, progress

Parallel run: this file is the row's only progress file. `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md` and `masterplan/02_plan.md` are the
controller's and were not written (P8).

**Status: needs-review.** Built, tested, mutation-checked and run on the lane's emulator. One item
of the row's verification is open and cannot be closed inside the row's write paths: the Pair
screen's chip reads `SIMULATED` in LIVE mode, because its text is hard-wired in
`apps/mobile/src/features/pairing/pairing-connection.tsx:162` (the pairing row's folder). Report:
`implementation/51_mobile_runtime.md`.

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 18:07 | Inputs read. Device state read with `emulator-user-lock.sh status` (read-only): three emulators, no keyguard, `CredentialType=NONE`, fingerprint count 0 |
| 18:07 | Rollback pre-image of `debug.ts` saved (`.cache/rollback/W51.pre.patch`, 72 lines); hashes of the 74 existing test files recorded |
| 18:08 | Baseline: `@dems/mobile` 74 suites / 870 tests exit 0; typecheck exit 0; lint exit 0 |
| 18:30 | Code: `contract.ts`, `core-link.ts`, `connection-banner.ts`, `debug.ts`, `sim-adapters.ts`, `sim-runtime-provider.tsx`, `core-errors.ts` (new), `index.ts`, `features/home/use-health.ts`, `i18n/en.mobile.ts` |
| 18:53 | First whole run with the new tests: 80 suites / 981 tests exit 0 |
| 18:59 | Release-bundle check: no probe text and none of the Live layer in the release bundle |
| 19:02 to 19:18 | Mutation run 1 (a transformer outside the repository; the tree is not edited): 81 of 89 detected. The eight survivors led to new tests and to three small code additions |
| 19:23 | Controller's note received (decisions D118, D116): the device credential on operations 8 and 23; `DEVICE_CREDENTIAL_REQUIRED`; nothing after `DEVICE_REVOKED`; a 429 on redeem. Built (one changed line group in `sim-adapters.ts`, one in `core-errors.ts`, one text key removed) and tested |
| 19:28:02 to 19:28:51 | Device check on lane 1 (`dems2_phone`, backend `127.0.0.1:4421`, `dems_lane_1`), inside `.locks/core-server.lane1.lock` and `device-session.sh`: the app in LIVE mode, three requests with the same request IDs on both sides, an anonymous socket, three screencaps; the app back on the default source; the backend stopped; no reverse rule, no listener |
| 19:29 | `emulator-user-lock.sh status`: identical to 18:07 |
| 19:31 | Release-bundle check repeated on the finished production code: unchanged result |
| 19:32 to 19:44 | Final mutation run: 100 of 100 detected |
| 19:44 to 19:45 | Final gate: 82 suites / 992 tests exit 0; typecheck exit 0; lint exit 0 |

## Files created or updated

Production (all inside the row's write list):

- `apps/mobile/src/runtime/contract.ts` (changed)
- `apps/mobile/src/runtime/core-link.ts` (changed)
- `apps/mobile/src/runtime/connection-banner.ts` (changed)
- `apps/mobile/src/runtime/debug.ts` (changed; pre-image saved)
- `apps/mobile/src/runtime/sim-adapters.ts` (changed)
- `apps/mobile/src/runtime/sim-runtime-provider.tsx` (changed)
- `apps/mobile/src/runtime/core-errors.ts` (new)
- `apps/mobile/src/runtime/index.ts` (changed)
- `apps/mobile/src/features/home/use-health.ts` (changed)
- `apps/mobile/src/i18n/en.mobile.ts` (changed: 20 keys added, none changed)

Tests (new, `apps/mobile/src/runtime/`): `live-core-link.test.tsx` (37), `live-runtime.test.tsx`
(11), `live-device.test.tsx` (32), `live-core-errors.test.tsx` (25), `live-health.test.tsx` (6),
`live-screens.test.tsx` (2), `live-no-raw-fetch.test.tsx` (7), `live-settings.test.tsx` (2).

Documents: `implementation/51_mobile_runtime.md`, this file, and under `implementation/assets/`:
`51_baseline.log`, `51_gate_final.log`, `51_test_hashes_before.txt`, `51_test_hashes_after.txt`,
`51_live_tests_verbose.txt`, `51_mutate.py.txt`, `51_mutating_transformer.cjs.txt`,
`51_jest_mut_config.cjs.txt`, `51_mutations_run1.log`, `51_mutations_final.log`,
`51_release_gate_w51.cjs`, `51_release_bundle_check.sh`, `51_release_bundle_check.log`,
`51_run_w51.sh`, `51_device_w51.sh`, `51_device_run.log`, `51_pair_live.png`,
`51_stack_check_live.png`, `51_after_reset_simulated.png`, `51_lock_status_start.txt`,
`51_lock_status_end.txt`.

Outside the tracked tree (git-ignored): `.cache/rollback/W51.pre.patch`, `.cache/w51/` (the run
scripts and their output), `.locks/core-server.lane1.pid` (exists, empty).

Not written: every existing test file (74 hashes identical), `secure-credentials.ts`,
`dev-probes.ts`, `internals.ts`, `providers/app-providers.tsx`, every feature folder but
`features/home/use-health.ts`, `packages/shared`, `package.json`, the native project.

## Blocker

None that stops later rows. The open item is finding F-1 (one line in a file of W57's folder).

## Findings, deviations, decisions

Numbered in `implementation/51_mobile_runtime.md`: findings F-1 to F-14 (section 8), deviations
DV-1 to DV-9 (section 9), decisions for the controller DN-1 to DN-9 (section 10). The ones the
controller must rule on:

| ID | In one line |
|---|---|
| DN-1 (F-1) | The Pair chip `LIVE`: allow this row one line in `features/pairing/pairing-connection.tsx`, or make it the first line of W57 |
| DN-2 (F-2) | Stack Check prints the fixed label "mock-core" before the Core server's version (`home-screen.tsx:217`, no owning row) |
| DN-3 (F-6) | Settings shows the third segment "Live" in debug builds from now on (it is built from `CORE_LINK_SOURCES`), before W82 adds the confirmation dialog and the sign-out |
| DN-4 (F-4) | The static test "no raw request to the Core server" exempts `runtime/dev-probes.ts` by name |
| DN-5 (DV-3) | The limit toast says "from this tablet" (LB-10's sentence says "console") |
| DN-6, DN-7 | Seams for W56 (`useMobileLiveRuntime()?.setBiometricPort`) and W60 / W57 (`usePairing()`, `isPairingBlocked()`, `pairing.notice`) |
| DN-8 (F-3) | The contract's only example of operation 1 is mock-core's: to the contract close-out |
| DN-9 | `core=` is stored like the Settings choice: every device check ends with a launch with `core=SIMULATED` |
| DV-2 | At a cold start of a debug build a simulator object exists for the first frame; with LIVE it reads nothing, writes nothing and never starts (MD-5's letter says `createSim` is not called) |
| DV-4 | A close with 4401 deletes the device credential only after operation 21 confirmed 401 |
