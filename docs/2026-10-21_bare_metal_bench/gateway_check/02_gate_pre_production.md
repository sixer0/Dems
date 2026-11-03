# Gate G2: pre-production (row 53; AC3)

Date: 2026-10-22, checked by the verifier (read-only). Host .73 at the time of the check: `2026-10-22 23:00:52 +0700`.
Scope: rows 47-52 of `masterplan/02_plan.md` (lines 1120-1217) against the implementation artifacts `26_reboot_before_prep08.md` to `31_core_stopped.md` and decisions D35-D39. Nothing on the host was changed.
Source of the artifacts: the host copy `~/Desktop/DEMS-source/docs/2026-10-21_bare_metal_bench/`. This local snapshot does not contain implementation files 26-31; they were read over `ssh dems`.

## Fresh read-only re-checks (row 53 plus the allowed queries)

| Check | Command (on host) | Output | Expected | Result |
|---|---|---|---|---|
| Core state | `systemctl is-active dems-core.service` / `is-enabled` | `inactive` / `disabled` | `inactive` (row 53); not enabled (R18-5) | PASS |
| Four slots | `SELECT video_01_device_id IS NULL, video_02_device_id IS NULL, mic_primary_id IS NULL, mic_standby_id IS NULL FROM capture_config` | `t\|t\|t\|t` | `t\|t\|t\|t` (row 50) | PASS |
| STT | `SELECT enabled FROM stt_config` | `f` | `f` (row 51) | PASS |
| Sessions | `SELECT (SELECT count(*) FROM session_history), (SELECT count(*) FROM active_session)` | `13\|0` | equal to row 44 (`24_database_seed.md:6`: `13`, `0`) | PASS |
| Audit after T0 | `SELECT type, count(*) FROM audit_log WHERE at > 1792684100451 GROUP BY type` | `AUTH_SIGNED_OUT 2`, `AUTH_SUCCESS 2`, `CAPTURE_CONFIG_CHANGED 4`, `STT_CONFIG_CHANGED 1` | `CAPTURE_CONFIG_CHANGED` = 4 (row 50); `STT_CONFIG_CHANGED` >= 1 (row 51); no other change types | PASS |
| DB connections | `SELECT count(*) FROM pg_stat_activity WHERE datname='dems_demo'` (db postgres) | `0` | `0` (row 52) | PASS |

The audit set holds only the two sign-ins, two sign-outs, four slot changes and one STT change. No session type appears, so no session was started after T0. `AUTH_SIGNED_OUT 2` agrees with the artifacts: one sign-out at the end of row 50 (budi.santoso, `29_slots_unassigned.md:6` "AUTH_SIGNED_OUT 1") and one after row 51 (`30_stt_off.md:4` "Signed out afterwards").

## Checks per row

| Row | Requirement (plan) | Evidence (artifact) | Result |
|---|---|---|---|
| 47 | New boot; forwarding `0 0 0`; NTP `yes`; six units `active`; ufw active; Core `inactive`; Block P wifi_fault_lines 0 | `26_reboot_before_prep08.md:5-7`: reboot 22:43:13, boot `2026-10-22 22:43:28`, forwarding `0` `0` `0`, NTP `yes`, all six `active`, `Status: active`, dems-core `inactive`, wifi_fault_lines=0 | PASS |
| 48 | `active`; fence >=1; SIMULATED >=1; error count recorded; node listeners loopback only; `/tmp/tsx-*` owner dems-core; health 200; HOST-41 `inactive` then `active active`; no session | `27_simulated_boot.md:4`: `active`; fence `1`; SIMULATED `3`; error/fatal `0`; node listeners `127.0.0.1:4420`, `127.0.0.1:5173` only, PostgreSQL `127.0.0.1:4432`; `drwx------ dems-core`; `200`; HOST-41 `inactive`, then `active` `active`; no session. Full listener list after boot, `26_reboot_before_prep08.md:7`: 22 (sshd, all interfaces), with 4432, 5173, 631 and 53 on loopback only | PASS |
| 49 | Port free `0`; `200`; `<title>` `1`; health via proxy `200`; ufw ALLOW count equal to row 36 | `28_console_forward.md:5`: `0`, `200`, `1`, `200`, ALLOW `10` (equal to row 36); probe forward stopped | PASS (deviation L-2) |
| 50 | `t\|t\|t\|t`; 4 `CAPTURE_CONFIG_CHANGED` after T0, equal to the user's count; sessions equal row 44; no session started | `29_slots_unassigned.md:3-6`: baseline `f\|f\|f\|f`, `13\|0`; per-slot DB read after each Save 1->2->3->4; VERIFY `t\|t\|t\|t`, `4`, `13\|0`. Fresh re-check matches | PASS (deviation M-1) |
| 51 | `stt_config.enabled` `f`; `STT_CONFIG_CHANGED` after T0 >= 1 | `30_stt_off.md:3-4`: T1=1792684732126, `f`, `1`, slots still `t\|t\|t\|t`, sessions `13\|0`. Fresh re-check `f`, 1 | PASS (deviation M-1) |
| 52 | `inactive`; 'shutdown complete' `1`; connections `0`; `db:status` OK line; sessions equal row 44 | `31_core_stopped.md:3`: `inactive`, `1`, `0`, `db:status: OK: dems_demo is at the schema version this code expects and the ledger matches the files.`, `13\|0`. Fresh re-check `inactive`, `0`, `13\|0` | PASS |

## Deviations and findings

High: none.

Medium:
- **M-1 (rows 50-51, D39): HIL actor changed.** The plan says "USER: in the Mac browser through the forward: signs in ... unassigns the 4 slots, reads the audit list, reports the count" (02_plan.md, row 50) and the user switches STT off (row 51). Under D39 the controller did both rows in the app's browser pane. It signed in with the console's own "Demo operators" picker, which fills the published synthetic demo credentials, so the controller typed no password. The user approved this approach in their own words: "login ada template akun di dropdownnya, kamu bisa gunakan itu". Effect on VERIFY: every database expectation of rows 50 and 51 is met, and the fresh re-check confirms it. The row-50 cross-check "equals the user's count" could not be done as written, because the user's earlier "Sudah, terlihat 4" (D38 (2)) came from the console's Simulated data mode and never reached the Core. The controller replaced it with a database read after each Save (1->2->3->4, `29_slots_unassigned.md:5`). That is stronger evidence for the database state, but it is not an independent count read by a human in Security & Audit. Verdict: the VERIFY expectations are met; the change of actor is a recorded deviation, not a gate failure.

Low:
- **L-1 (row 50): first sign-in with the wrong role.** budi.santoso (INVESTIGATOR) was tried first and the selector was disabled by role (`29_slots_unassigned.md:4`). It left an `AUTH_SUCCESS`/`AUTH_SIGNED_OUT` pair in the audit log and no configuration change. Harmless; recorded.
- **L-2 (row 49): forward origin.** The forward ran from the user's Windows workstation with alias `dems` and key `~/.ssh/id_gsp_dems`, not the runbook's Mac line with `id_ed25519_smartwms` (`28_console_forward.md:3-4`). All probe results passed. A forward for rows 50-51 was left running in the user's terminal tab "DEMS console forward". It is harmless while the Core is stopped, but the controller should confirm whether it is still needed.
- **L-3 (row 48): evidence form.** `27_simulated_boot.md` summarises the outputs instead of quoting the raw command output, and the Core is now stopped, so the listener and journal counts cannot be re-checked without a restart (outside row 53). I accept them as recorded. The plan's own expected list includes `127.0.0.1:4432`, but the `ss` filter selects only `node`. The artifact states PostgreSQL separately, and the post-boot listener list in row 47 confirms it is on loopback.
- **L-4 (snapshot): stale local copy.** `C:\Users\TRIAL\dems-review-snapshot` lacks implementation files 26-31 and `gateway_check/04_gate_rflex.md`, which exist on the host. Re-sync it before relying on it for review.

## Remediation notes

None of the findings blocks the gate. M-1 is already recorded in D39. If the user wants the human cross-check from row 50 as written, they can open Security & Audit and count the four `CAPTURE_CONFIG_CHANGED` entries. That needs the Core running again, which is a separate decision. L-2: stop the leftover forward when it is no longer needed.

## Next steps

Row 54 (attended hidden-prompt check) may start: Core `inactive` as row 54 PREPARE requires.

G2: PASS
