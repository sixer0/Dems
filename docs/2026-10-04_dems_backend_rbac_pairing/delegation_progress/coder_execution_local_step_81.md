---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution-local
blueprint_row: 81 (plan W59, mobile Login in LIVE mode)
date: 2026-10-05
status: complete-with-one-deferred-evidence-item
gate: CLG
decision_refs: [D124, D129, D130, D133]
---

# coder-execution-local progress: step 81 (W59) — Mobile Login in LIVE mode

Status: **complete**, with one deferred evidence item (DV-1). The row's code is finished, audited,
typechecked, linted and fully tested; the only thing not shown on-device is the paired-device sign-in,
which needs a paired lane-1 phone that does not exist yet (pairing is W57's ungated flow).

## Audit outcome (D133 AUDIT-FIRST)

The interrupted agent left 5 modified production files + `login-live-model.ts`, no tests, no report.
Audited against `.cache/w59/baseline_folder.log` and `acaff20`: the leftover code **typechecked clean**
and the folder's existing tests were **37 passed / 2 suites** at session start (identical to the baseline);
every cross-module symbol and i18n key it references exists. **Kept** all of it except one block: the LB-10
mechanism in `use-login-controller.ts` used a ref + effect that fails this repo's React Compiler lint rules
(`react-hooks/set-state-in-effect`, `react-hooks/refs`). **Rewrote** it to the codebase's sanctioned
render-time state-adjustment pattern (same as `liveOfflineShown`). **Deleted**: nothing. **Added**: two test files.

## Files created or updated

- `apps/mobile/src/features/login/use-login-controller.ts`: rewrote the LB-10 block (ref+effect → `awaitingLimit` render-time state). Rest of the file as left by the audit.
- `apps/mobile/src/features/login/{i18n.ts,login-card.tsx,login-model.ts,login-screen.tsx,login-live-model.ts}`: kept from the leftover (audited sound).
- `apps/mobile/src/features/login/live-login.test.tsx`: created (9 tests, the real `LoginScreen` over the fake transport).
- `apps/mobile/src/features/login/login-live-model.test.ts`: created (11 tests, pure rules + the executable CLG(c) static scan).
- `docs/.../implementation/59_mobile_login.md`: created (the report).
- `docs/.../implementation/assets/59_login_live_unpaired.png`, `59_login_live_disclosure.png`, `59_after_reset_simulated.png`, `59_device_run.log`, `59_device_after_state.txt`, `59_device_requests.txt`: created (device evidence; no credential/token/code/password anywhere).
- `docs/.../delegation_progress/coder_execution_local_step_81.md`: created (this file).

Nothing outside `apps/mobile/src/features/login/**` was written. `auth/**`, `features/pairing/**`, `navigation/**`,
`packages/shared/**`, `apps/mock-core/**`, `release/**`, `apps/mobile/app.json`, `status_tasks.md`,
`decisions/decisions.md` and `masterplan/02_plan.md` are untouched. Scratch scripts live in `.cache/w59/`.

## Measured totals

| Check | Result |
|---|---|
| login folder tests | **57 passed / 4 suites** (37 existing unchanged + 9 + 11) |
| full mobile suite (`--maxWorkers=2`) | **1207 passed / 92 suites, 0 failed** (baseline 1187 + my 20) |
| typecheck | clean |
| lint | clean (0 problems) |
| CLG(a) | existing test files absent from `git diff --stat acaff20`; only 5 production files modified |
| CLG(b) | success / wrong-password refusal / outage-at-start / unanswered-request / 429-limit on the fake transport |
| CLG(c) | no `useSimActions`, no `.actions` on a Sim (manual grep + executable scan) |
| CLG(d) | lane-1 device check, core=LIVE, ~94 s, clean start/stop, screencaps captured |

## Mutation check

`isLimitFailure → false`: 1 test fails (LB-10 detected). `isLiveLogin → false`: 4 tests fail (LIVE branches detected). Restored: 57 pass. Both mutations caught.

## Device check (CLG (d))

Lane 1, `dems2_phone` (emulator-5554), backend 4421 / `dems_lane_1`, Metro 8082, under the lane lock and `device-session.sh phone`. Opened `core=LIVE`; unpaired, so it made only two anonymous GETs, zero sign-in/POST, zero JS errors, zero credentials, no secure-store entry; returned to `core=SIMULATED` and force-stopped; backend stopped, no listeners left, pid file emptied. Keyguard never shown, fingerprint count 1 untouched, lock state identical start↔end. Screencaps show the LIVE trust line ("Core server • not paired"), "Pair this tablet", the C1 sentence, "Select an operator to fill the form" (no pairing-code hint), and no role chip.

## Decisions the controller must rule on

1. **DN-1** — Accept CLG(d) for the observable LIVE points with the paired-device sign-in deferred to after W57 gates (DV-1)?
2. **DN-2** — Confirm the LB-10 rewrite (render-time `awaitingLimit`) replaces the leftover ref+effect, which cannot pass this repo's lint.
3. **DN-3** — Confirm the i18n split satisfies D129 DN-2: C1 sentence (`login.live.demoNotice`) and "Use Simulated mode" (`common.coreMode.useSimulated`) reused word-for-word from shared/web; only `features.login.live.trust.*` + `offlineBody` are mobile-local.
