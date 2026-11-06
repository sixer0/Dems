---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W96
date: 2026-10-07
agent: verifier
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W96, line 776)
status: PASS (short confirmation under D232/D233: 1 run + 1 verification run); one measurement gap in run 1 (D-1)
narrative_tier: 2
evidence_folder: verification/assets/e2e_final/ (prefix w96_, net_ctx_b)
---

# W96: SC4 live role change on the rebuilt main instance (short confirmation)

Window: 2026-10-07 09:13 to 09:21 WIB. The prior depth is in `test/07c_e2e_phone_lane1.md` Part C.

## Set-up

| Role | Client | State | Evidence |
|---|---|---|---|
| SUPERVISOR andi.pratama | web context a (own headless shell), Users & Roles `/admin/users` | signed in 08:51:37 (AUD-000086) | `w96_web_a_users_roles_before.png` |
| Affected operator budi.santoso | web context b (second headless shell, separate profile, OS-assigned port 56930, ownership-checked), Dashboard | signed in 09:13:13.950 (AUD-000154) | `w96_web_b_budi_dashboard_before.png`, `w96_web_b_signin.log` |
| Affected operator budi.santoso | phone emulator-5554 (DEV-0003), Home | signed in 09:00:09.534 (AUD-000102) | `w96_phone_home_before.png` |

There was no new sign-in by either watched client during W96. The tablet signed budi in at 09:16:39 (AUD-000158,
DEV-0004) for the FXR checklist; it is a third client and was not watched for W96.

Controls watched: web b Dashboard **Start New Session**. Locked means the wrapper `start-new-session-locked`
(aria-label "Start New Session: Requires the Investigator role") around a disabled button. Phone Home **Start
Session**: dimmed, with "Requires the Investigator role" under it. That lock is the FXR-M W93-11 rule; the round-1
phone had no such lock (E2E-P-5).

Method:
- web b: a CDP watcher that never navigates (`drv_watch_expr.mjs.txt` with `drv_expr_lock.txt`), polling every 50 ms.
- phone: a 540 px `screenrecord --bugreport`, host = device + 49.86-49.87 s.
- The start of every interval is the server's `POST /api/v1/admin/users/:id/role 200` log time.
- The role was chosen in the kit dialog by keyboard (focus the checked radio, arrow keys), because a CDP mouse click
  at the radio's centre did not select it (O-2).

## Evidence table

| Run | Step | Pass condition | Server time | Web b (no sign-in) | Phone (no sign-in) | Result | Captures | Audit row |
|---|---|---|---|---|---|---|---|---|
| 1 | INVESTIGATOR → TECHNICIAN, reason "W96 role change R1" | both controls lock within 1 s | `role 200` 09:15:17.543 | toast "Your role is now Technician…" at 09:15:17.549 (+6 ms). **The lock instant was not captured** (watcher expression error, D-1). Locked state confirmed at 09:15:27.957 (screenshot) and by DOM read at 09:15:38 | toast at host 09:15:18.049 (+0.51 s); Start Session locked with "Requires the Investigator role" at host 09:15:18.143 (**+0.60 s**) | phone PASS; web b lock timing not measured in run 1 (measured in run 2) | `w96_r1_web_a_role_dialog_technician.png`, `w96_r1_web_b_after_change_locked.png`, `w96_r1_phone_to_tech_frames.png`, `w96_r1_phone_to_tech.mp4`, `w96_r1_web_a_after_change.png` | **AUD-000156** 09:15:17.535 `ROLE_CHANGED` actor OPR-002 "Role of OPR-001 changed from INVESTIGATOR to TECHNICIAN" `{"to":"TECHNICIAN","from":"INVESTIGATOR","reason":"W96 role change R1","targetOperatorId":"OPR-001"}` |
| 1 | now-denied call from web b: `POST /api/v1/session` | 403 + `ACCESS_DENIED` | 09:16:03.375 | **403** `NOT_PERMITTED` `{"operationId":"createSession","permission":"SESSION_START","role":"TECHNICIAN"}` | — | PASS | `w96_r1_denied_call.log` | **AUD-000157** 09:16:03.375 `ACCESS_DENIED` WARNING actor OPR-001 "Access denied: role TECHNICIAN lacks SESSION_START (createSession)" |
| 1 | back to INVESTIGATOR, reason "W96 change back R1" | controls return | `role 200` 09:18:30.269 | UNLOCKED + toast at 09:18:30.317 (**≤48 ms**) | toast +0.43 s; unlocked at host 09:18:30.766 (**+0.50 s**); tablet also unlocked (`w96_r1_tablet_after_back.png`) | PASS | `w96_r1_web_a_role_dialog_back.png`, `w96_r1_web_b_after_back_unlocked.png`, `w96_r1_phone_back_frames.png`, `w96_r1_phone_back.mp4` | **AUD-000159** 09:18:30.265 `ROLE_CHANGED` TECHNICIAN → INVESTIGATOR |
| 2 | INVESTIGATOR → TECHNICIAN, reason "W96 role change R2" | both lock within 1 s | `role 200` 09:19:36.935 | **LOCKED** (aria-label "Start New Session: Requires the Investigator role") + toast at 09:19:36.973 (**+38 ms**, ≤50 ms poll) | toast +0.51 s; locked at host 09:19:37.481 (**+0.55 s**) | PASS | `w96_r2_web_a_role_dialog_technician.png`, `w96_r2_web_b_after_change_locked.png`, `w96_r2_phone_to_tech_frames.png`, `w96_r2_phone_to_tech.mp4`, `w96_r2_web_b_watch_to_tech.json` | **AUD-000160** 09:19:36.931 `ROLE_CHANGED` INVESTIGATOR → TECHNICIAN |
| 2 | now-denied call from web b | 403 + `ACCESS_DENIED` | 09:19:49.142 | **403** (this run's expression read only the top-level `code`, so the code shows null; the audit row names the rule) | — | PASS | `w96_r2_denied_call.log` | **AUD-000161** 09:19:49.142 `ACCESS_DENIED` actor OPR-001 "role TECHNICIAN lacks SESSION_START (createSession)" |
| 2 | back to INVESTIGATOR, reason "W96 change back R2" | controls return; **budi ends INVESTIGATOR** | `role 200` 09:20:32.318 | UNLOCKED + toast at 09:20:32.356 (**+38 ms**) | toast +0.40 s; unlocked at host 09:20:32.767 (**+0.45 s**) | PASS | `w96_r2_web_b_after_back_unlocked.png`, `w96_r2_web_a_after_back.png`, `w96_r2_phone_back_frames.png`, `w96_r2_phone_back.mp4` | **AUD-000162** 09:20:32.313 `ROLE_CHANGED` TECHNICIAN → INVESTIGATOR |
| end | final role | INVESTIGATOR | 09:20:44 | `GET /api/v1/admin/users`: `OPR-001:INVESTIGATOR:true`, `OPR-002:SUPERVISOR:true`, `OPR-003:TECHNICIAN:true` | — | PASS | `w96_final_roles.txt` | — |

All six rows are in `w96_audit_rows.json` / `.log`. Network log of web b (09:13:08 to 09:39:44): **523 requests to
`http://127.0.0.1:5173`, 4 sockets to `ws://127.0.0.1:5173`, no other origin** (`net_ctx_b.json`).

## Observations

- O-1: the toast reaches the phone about 0.4-0.5 s after the server, and the control follows 40-100 ms later. All
  four phone measurements are inside 1 s (0.45-0.60 s) at load 5.8-7.5.
- O-2 (needs-review, hypothesis only): in the Users & Roles role dialog, a CDP mouse press/release at the centre of
  the "Technician" option (`ur-role-option-TECHNICIAN`, a 400x20 `DIV.radio`, and the hit test lands inside it) did
  not select it, twice. Selecting with the keyboard worked. This may be the harness (React Aria press handling with
  synthetic CDP mouse events) and was not reproduced with a real pointer. Round 1 changed roles through the same
  dialog with a different driver.
- O-3: web b's session ended by the 15-minute idle lock before the end (09:13 sign-in, CDP reads only). The final
  sign-out answered 401 and the page was on `/login`. This is the expected idle behaviour (same as D196 O-3).

## Deviations

- D-1: run 1's web-b watcher tested `start-new-session` (present in both states, because the locked state wraps the
  disabled button), so it logged "UNLOCKED" throughout. The run-1 lock instant on web b is therefore unmeasured. The
  expression was corrected (`drv_expr_lock.txt`) and runs 1-back, 2 and 2-back were measured with it. The
  verification run (run 2) holds the measured web-b lock: +38 ms.

---
*Generated: 2026-10-07 09:55*
*Last Updated: 2026-10-07 09:55*
