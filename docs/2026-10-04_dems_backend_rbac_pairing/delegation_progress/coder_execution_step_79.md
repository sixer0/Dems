---
task_slug: dems_backend_rbac_pairing
step: 79
plan_row: W57
agent: coder-execution
date: 2026-10-04
status: needs-review
---

# Step 79 (W57): mobile pairing flow, progress

Parallel run: this file is the row's only progress file. `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `gateway_check/01_gate_report.md`,
`masterplan/**` and `implementation/99_implementation_report.md` are the controller's and were not
written.

**Status: needs-review.** Built, tested on the fake transport, mutation-checked and run on the
tablet against the lane 2 Core server: the tablet paired with a code issued by that backend and is
left paired as `DEV-0001`. One point needs a ruling: turning the tablet from landscape to portrait
while the Pair screen is open squeezes the connection pane to 144 dp. It is the predecessor's
layout defect (it shows in Simulated mode with the code of `acaff20`); a fix is one line of this
row's folder and changes a Simulated layout, which the plan forbids this row (KI-01). Report:
`implementation/57_mobile_pairing_flow.md` (finding F-1, decision DN-1).

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 20:30 | Inputs read: plan row W57 and the gates, [CS] §9.4, §9.6, §6.6, §3.2, §3.5, `51_mobile_runtime.md`, `32_pairing_device_registry.md` §11.3, `44_live_source.md` §17.4, decisions D116, D118, D124, finding F76 |
| 20:34 | Pre-images of the folder's ten files and of `home-screen.tsx` saved under `.cache/rollback/W57/` (each equals `acaff20`) |
| 20:34 | Controller's note received: the user gave `dems2_tablet` a PIN and one fingerprint at about 20:33. BEFORE reading taken with `emulator-user-lock.sh status tablet` (read-only): `isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1` |
| 20:41 | Read-only queries of the tablet: awake, no keyguard, `2560x1600`, the debug build of 10:43 |
| 21:05 | Code: the controller in both modes, the pure Live model, the connection card, the code card, the dialog, the screen, the copy, the one granted line of `home-screen.tsx`. Typecheck and lint exit 0; the folder's existing tests pass |
| 21:10 | First run of the Live tests: 15 of 21 pass; the six failures were the tests' own (a pattern that matched "Use Simulated mode", a `cleanup()` in the middle of a test, a time-out that runs on real timers). The run did not exit (a query-cache timer); the harness stopped it later at its time limit, after its results had been read |
| 21:10:50 | Last production edit before the device sessions |
| 21:14:14 to 21:16:22 | Device session 1 on lane 2 (`dems2_tablet`, backend `127.0.0.1:4422`, `dems_lane_2`, Metro 8083), inside `.locks/core-server.lane2.lock` and `device-session.sh`: the unpaired Pair screen in LIVE mode in both orientations; ONE code issued by the lane backend as the seeded SUPERVISOR and typed into the app; redeem 201 with the same request ID on both sides; `DEV-0001`; the issued code counted in the device log, AsyncStorage, the backend log and the outputs: 0; the paired screen; a launch with `core=SIMULATED` |
| 21:19:35 to 21:22:04 | Device session 2: the layout in both orientations in Simulated and LIVE mode; a cold start in LIVE mode on the paired tablet (the stored credential is read; operation 21 answers 200) |
| 21:22 | Finding F-1 established: 288 px and 1168 px after a turn to portrait in both modes; 728 px and 728 px from a cold start in both modes |
| 21:30 | Tests added: the pure model (12), the static rules (10), the granted line (2); the Live file at 25 tests |
| 21:35 to 21:54 | Mutation run 1 (a transformer in the row's scratch folder; the tree is not edited): 82 of 89 detected, 6 not, 1 not applied (a mistake of the list). The six survivors led to tests, and to two production lines: the unpair guard hands a refusal to the presenter in LIVE mode only; the LIVE wrapper of the code card has a test ID |
| 21:55 | Typecheck exit 0, lint exit 0; the folder: 6 suites, 66 tests |
| 21:55:29 to 21:57:42 | Device session 3: session 2 repeated on the finished production code; the same numbers |
| 22:00:53 | AFTER reading of the lock status: identical to 20:34. No reverse rule, the app not running, nothing listening on 4422 or 8081 to 8086, the tablet in its start pose |
| @@LATER@@ |

## Files created or updated

Production (the row's write list):

- `apps/mobile/src/features/pairing/use-pairing-flow.ts` (changed)
- `apps/mobile/src/features/pairing/pairing-live-model.ts` (new)
- `apps/mobile/src/features/pairing/pairing-model.ts` (changed)
- `apps/mobile/src/features/pairing/pairing-connection.tsx` (changed)
- `apps/mobile/src/features/pairing/pairing-code-panel.tsx` (changed)
- `apps/mobile/src/features/pairing/pairing-screen.tsx` (changed)
- `apps/mobile/src/features/pairing/unpair-dialog.tsx` (changed)
- `apps/mobile/src/features/pairing/i18n.ts` (changed: a subtree `live`, 50 texts; none of the 51 existing texts changed)
- `apps/mobile/src/features/home/home-screen.tsx` (ONE line, 217, granted by decision D124)

Tests (new, `apps/mobile/src/features/pairing/`): `pairing-live.test.tsx` (27),
`pairing-live-model.test.ts` (12), `pairing-live-static.test.ts` (10),
`stack-check-service-name.test.tsx` (2). The two existing test files are unchanged.

Documents: `implementation/57_mobile_pairing_flow.md`, this file, and under
`implementation/assets/` the files named in section 13 of the report (`57_*`).

Scratch, not part of the deliverable: `.cache/w57/**`, `.cache/rollback/W57/**`. Lane files:
`.locks/core-server.lane2.lock` (created by `lockf`), `.locks/core-server.lane2.pid` (empty).

## Findings, deviations, decisions

In the report: sections 5 (F-1 to F-11), 6 (DV-1 to DV-15) and 7 (DN-1 to DN-8). The ones that need
the controller:

| ID | Short |
|---|---|
| DN-1 | The Pair screen after a turn from landscape to portrait (both modes, the predecessor's defect): accept as KI-01's recorded state, or allow the one-line fix in this folder and a repeat of the tablet check |
| DN-2 | The Core server's address is not printed in the unpaired identity list: the runtime's static test allows the address in one file only |
| DN-3 | The granted line prints "core-server" and "mock-core" (the name without `dems-`): the raw name would turn W51's own Simulated assertion red |
| DN-6 | The tablet is paired with lane 2 as `DEV-0001`; the lane database must keep its pairing tables |

## State left

`dems2_tablet`: paired with the lane 2 Core as `DEV-0001`; Core link source SIMULATED (a row that
needs the paired tablet launches with `core=LIVE`); app stopped; landscape; the lock as the user
set it. `dems_lane_2`: not reset; `paired_devices 1`, `device_credentials 1`, `pairing_codes 1`.
No backend, no Metro, no reverse rule of this row is left.
