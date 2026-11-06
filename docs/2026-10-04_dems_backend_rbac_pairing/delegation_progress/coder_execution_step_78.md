---
task_slug: dems_backend_rbac_pairing
step: 78
plan_row: W56
agent: coder-execution
date: 2026-10-04
status: complete
---

# Step 78 (W56): mobile sign-in, progress

Parallel run: this file is the row's only progress file. `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `gateway_check/01_gate_report.md`,
`masterplan/**` and `implementation/99_implementation_report.md` are the controller's and were not
written.

**Status: complete.** The auth layer of LIVE mode is built inside `apps/mobile/src/auth/**`,
tested, mutation-checked and run on the lane's emulator as far as an unpaired device allows.
Report: `implementation/56_mobile_sign_in.md`. What other rows still add before an operator sees
all of it: the Login screen places the Alert and words the result `invalid` (W59), the Settings
switch reads `biometric.changeBlocked` and `biometric.protected` (W82), and the feature-text
registry gets one entry (the report's finding F-5).

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 20:33 | Inputs read. Pre-images of the eight files of the folder saved under `.cache/rollback/W56/`, with their `git hash-object` |
| 20:34:34 | Controller's note received (decision D125): the user gave `dems2_phone` and `dems2_tablet` a PIN and one fingerprint at about 20:33. BEFORE reading taken with `emulator-user-lock.sh status` (read-only): phone and tablet `CredentialType=PIN`, fingerprint count 1, no keyguard; phone2 unchanged |
| 20:40 to 20:42 | Baseline: `@dems/mobile` 82 suites / 992 tests exit 0; typecheck exit 0; lint exit 0 |
| 21:03 | Production code compiles. First run of the suites around it: one runtime test red (the marker was read before the runtime's own read of the device credential); fixed in this row's code, not in the test |
| 21:04 | 25 suites of auth, runtime, login, settings and providers: 338 tests exit 0 |
| 21:11 to 21:16 | The four new test files: 6 suites of the folder, 171 tests exit 0; typecheck and lint exit 0 |
| 21:18 | Release transform check: no file of the auth layer that is part of the bundle loads the token storage or the wrapper; the checks of W15 and W51 pass unchanged |
| 21:21 to 21:29 | Mutation run 1 (a transformer outside the sources; the tree is not edited): 76 of 78 detected. The two survivors led to two added assertions |
| 21:27:13 to 21:35:51 | Device check on lane 1 (`dems2_phone`, backend `127.0.0.1:4421`, `dems_lane_1`, Metro 8082), four sessions inside `.locks/core-server.lane1.lock` and `device-session.sh`, 365 s in all. Session 1: two taps landed on the soft keyboard (two letters in the app's Username field; nothing sent or stored; reported as finding F-13). Session 4: one sign-in attempt on the unpaired phone, refused by the auth layer; the server saw 0 POST requests. Every session ended with a launch with `core=SIMULATED` |
| 21:36:20 | Afterwards: no reverse rule, the app stopped, no listener on 4421 or 8081 to 8086. `emulator-user-lock.sh status`: identical to 20:34:34 |
| 21:37 to 21:39 | Final gate: 90 suites / 1,185 tests exit 0 (4 suites and 144 tests are this row's; 4 suites and 49 tests are the pairing row's, in flight); typecheck exit 0; lint exit 0 |
| 21:39 to 21:47 | Final mutation run on the finished tree: 78 of 78 detected; the mutated files identical before and after |

## Files created or updated

Production, all under `apps/mobile/src/auth/`:

- `auth-provider.tsx` (changed)
- `biometric.ts` (changed)
- `auth-dialogs.tsx` (changed: two optional props)
- `index.ts` (changed)
- `auth-session.tsx` (new)
- `live-auth-provider.tsx` (new)
- `live-auth-model.ts` (new)
- `live-biometric.ts` (new)
- `auth-notice.tsx` (new)
- `i18n.ts` (new)
- `i18n-bundle.ts` (new)

Tests (new, `apps/mobile/src/auth/`): `live-auth.test.tsx` (41), `live-auth-model.test.ts` (62),
`live-biometric.test.ts` (30), `live-auth-static.test.ts` (11). The two existing test files are
unchanged (same `git hash-object`; absent from `git diff --stat acaff20`).

Documents: `implementation/56_mobile_sign_in.md`, this file, and under `implementation/assets/`:
`56_baseline.log`, `56_gate_final.log`, `56_live_tests_verbose.txt`, `56_mutations_run1.log`,
`56_mutations_final.log`, `56_mutate.py.txt`, `56_mutating_transformer.cjs.txt`,
`56_jest_mut_config.cjs.txt`, `56_release_gate_w56.cjs`, `56_release_transform.log`,
`56_run_w56.sh`, `56_device_w56.sh`, `56_device_run.log`, `56_device_run_look.log`,
`56_device_run_first_attempt.log`, `56_device_run_first_look.log`, `56_device_after_state.txt`,
`56_login_live_unpaired.png`, `56_login_live_unpaired_refused.png`, `56_after_reset_simulated.png`,
`56_lock_status_start.txt`, `56_lock_status_end.txt`.

Scratch (not documents): `.cache/w56/**` (the device scripts' output folders, the mutation
harness), `.cache/rollback/W56/**` (the pre-images).

Not written, nothing outside the write path edited: `apps/mobile/src/runtime/**`,
`apps/mobile/src/features/**`, `apps/mobile/src/i18n/**`, `packages/shared/**`,
`apps/core-server/**`. No git write. No Docker.

## Blockers

None.

## For the controller

- Findings F-1 to F-15, deviations DV-1 to DV-14 and decisions DN-1 to DN-9 are sections 8 to 10 of
  the report; the seams for W59, W60 and W82 are section 11; what was not exercised on a device,
  with the app state at which the user's finger is needed, is section 12.
- The two that want a ruling first: DN-4 (a lost answer of the biometric sign-in costs the
  enrolment on the tablet and is never retried: stricter than `implementation/41` §8.2) and DN-1
  (a process that dies while the request is out leaves the sent token in the store).
- Seen and not mine: the pairing row's four new test files were part of the whole run at 21:37
  and passed.
