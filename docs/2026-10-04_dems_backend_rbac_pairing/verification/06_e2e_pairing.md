---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W94
date: 2026-10-07
agent: verifier
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W94, line 774)
status: PASS (short confirmation under D232/D233: 1 run + 1 verification run)
narrative_tier: 2
evidence_folder: verification/assets/e2e_final/ (prefixes s1_, w94_, pair_, end_)
---

# W94: SC5 pairing on the rebuilt main instance (short confirmation)

Window: 2026-10-07 08:49 to 08:58 WIB, with the end state at 09:38-09:39. This run confirms on the instance that W90
rebuilt that the pairing journey still holds after W90 and the FXR fixes. The depth of this round is in
`test/07e_e2e_pairing.md` and `test/08d_retest_pairing.md`, so this is not a repeat campaign.

## 1. Environment

| Item | Value | Evidence |
|---|---|---|
| Core | `http://127.0.0.1:4420`, database `dems_demo`, `demoControls: true`, started 08:45 by the controller. The boot verified 85 audit rows (82 seed + D240's +1 + W90 state changes) | `.cache/manual/main-server-w94.log` line 1 and B-8 |
| Web | `http://127.0.0.1:5173`, Live (`data-core-mode=LIVE`, shell mode `LIVE`). Run by this row's own headless shell (`chromium_headless_shell-1243`, raw CDP on an OS-assigned port 53254, ownership checked on every connection: pid + profile in its command line + `lsof` listener). Profile in `$TMPDIR`, removed at the end | `w94_s2_web_signin.log`, `drv_browser.sh.txt`, `drv_lib.mjs.txt` (`connect()`) |
| Web operator | andi.pratama (OPR-002, SUPERVISOR), signed in through the form | `w94_s2_web_signin.log` |
| Device | emulator-5558 `dems2_phone2`, 1080x2424, keyguard false at every step | `s1_relaunch_5558.log`, step logs |
| Registry at start | `GET /api/v1/pairing/devices` 200, `[]`, "0 paired · 0 online" (DP-3: never paired on this database) | `w94_s2_web_signin.log`, `w94_s2_web_paired_devices_idle.png` |
| Device clocks | All three emulators run **49.86 s behind the host** (bracketed reads, 17-24 ms brackets). Every device time below is converted to host time | `w94_r1_issue_and_redeem.log` lines 1 and `clockAfter` |
| Load | 3.9 to 6.5 during W94 (limit 14) | `uptime` in each log |

## 2. Step 1: force-stop and relaunch on all three devices

`am force-stop`, then `am start -W -d 'demsdemo:///login?core=LIVE&motion=off'` (single-quoted). None of the three
held a device credential any more: the secure-store entry names were empty before the relaunch. Each landed on
**Pair** ("Not paired", LIVE, Link Connected). App calls: `GET /auth/session 401`, `GET /auth/status 200`. There were
0 token-shaped lines in any device JS log.

| Device | `runtime.live.ready` (context) | Capture |
|---|---|---|
| 5558 phone2 | `pairing: 'UNPAIRED'` after 1 s | `s1_relaunch_5558.png`, `s1_relaunch_5558.log` |
| 5554 phone | `pairing: 'UNPAIRED'` after 5 s | `s1_relaunch_5554.png`, `s1_relaunch_5554.log` |
| 5556 tablet | `pairing: 'UNPAIRED'` after 7 s | `s1_relaunch_5556.png`, `s1_relaunch_5556.log` |

## 3. W94 evidence table

Run 1 = the five plan steps. Run 2 = the verification run (re-pair, sign in, sign out to Login). Server times come
from `main-server-w94.log`. Audit rows are quoted from `GET /api/v1/audit` read by the signed-in SUPERVISOR page.

| Step | Pass condition (plan W94) | Observed | Result | Captures | Audit row / log |
|---|---|---|---|---|---|
| 1 | LIVE, no credential: only Pair and Stack Check | Pair (UI dump `screen-pair`). `demsdemo:///stack-check` shows Stack Check (Live heartbeat, core-server v0.2.0). A guarded `demsdemo:///home` from Stack Check lands on **Pair** (dump `screen-pair`; round 1's E2E-S-4 no longer reproduces) | PASS | `w94_s1_pair.png`, `w94_s1_stack_check.png`, `w94_s1_guarded_home_link.png`, `w94_s1_ui_*.xml` | `w94_s1.log` |
| 2 | portal issues a code, `PAIRING_CODE_ISSUED` | Blur mask injected before the click, then the mask was verified (transparent digits, no shadow, blur, QR hidden). `POST /api/v1/pairing/code 201` at 08:52:16.601. Panel `ACTIVE_KNOWN`, 299 s, "5 attempts left" | PASS | `w94_r1_web_code_issued_blurred.png` | **AUD-000087** 08:52:16.596 `PAIRING_CODE_ISSUED` actor OPR-002 "Pairing code PCD-000001 issued" |
| 3 | app redeems, reaches **Login**, `PAIRING_SUCCESS` | One process read the code into one variable and passed it to one `adb input text` (never printed). Redeem 201 at server 08:52:21.427. **The app reached Login** "Core: DEMS-IR-01 • paired as DEV-0001", Core online (round 1's E2E-S-1 no longer reproduces). Web: "DEV-0001 · sdk_gphone64_arm64 is paired." | PASS | `w94_r1_phone_after_redeem_login.png`, `w94_r1_phone_handoff_screenrecord.mp4`, `w94_r1_web_code_redeemed_device_paired.png` | **AUD-000088** 08:52:21.422 `PAIRING_SUCCESS` device DEV-0001 "Device DEV-0001 paired with DEMS-IR-01" |
| 4 | PAIRED, then the operator after sign-in (live, no reload), `AUTH_SUCCESS` naming the device | DEV-0001 Paired, operator "—". Phone sign-in as budi.santoso: server 08:53:33.741 `POST /auth/sign-in 200 principal=device:DEV-0001`. The open page (same document, time origin 08:51:34.086 at start and stop of the watcher) received `admin.changed DEVICES` at 08:53:34.799. Operator cell "AKP Budi Santoso" at **08:53:34.851 (+1.11 s, no reload)**. Registry `signedInOperatorId: OPR-001` | PASS | `w94_r1_web_device_with_operator.png`, `w94_r1_phone_signed_in.png` | **AUD-000090** 08:53:33.739 `AUTH_SUCCESS` actor OPR-001 **device DEV-0001**; `w94_r1_watch.log` |
| 5 | revoke returns the app to Pair (time recorded, D218), next call refused, `DEVICE_REVOKED` | Confirm at 08:54:24.150, `POST …/DEV-0001/revoke 200` at server 08:54:24.160. Server closed the phone's socket `code=4403 closedBy=server` at 24.162. App `auth.sessionEnd {kind: DEVICE_REVOKED}` at host 24.172. Recording frames: last Home frame at device 08:53:34.648 (host 24.508), cross-fade from 24.511, **Pair "Pairing revoked" fully drawn at host 24.596 = 436 ms after the server's answer** (debug build, load 3.9; time recorded only, the 1 s criterion is measured in W98 per D218). Link showed "Connecting…" then "Connected", no "Core server unreachable" frame (round 1's E2E-S-3 not seen). Next call: the 4403 close; the app's next calls were anonymous (`GET /auth/status 200 principal=null`), which satisfies the step per **D196** | PASS | `w94_r1_revoke_frames.png`, `w94_r1_phone_revoke_screenrecord.mp4`, `w94_r1_web_revoke_dialog.png`, `w94_r1_web_revoked.png`, `w94_r1_phone_after_revoke_pair.png` | **AUD-000091** 08:54:24.158 `DEVICE_REVOKED` actor OPR-002 device DEV-0001 `{"reason":"W94 final check","sessionsEnded":1}`; `w94_r1_revoke.log` |
| V-a | verification: re-pair (new ID) | Code PCD-000002, redeem 201 at server 08:55:46.085. **New ID DEV-0002**. App on Login "paired as DEV-0002". Web list: DEV-0002 Paired, DEV-0001 Revoked | PASS | `w94_r2_web_code_issued_blurred.png`, `w94_r2_phone_after_redeem_login.png`, `w94_r2_web_code_redeemed_device_paired.png` | **AUD-000093** `PAIRING_CODE_ISSUED` PCD-000002; **AUD-000094** 08:55:46.085 `PAIRING_SUCCESS` DEV-0002 |
| V-b | verification: sign in | Server 08:56:24.364 sign-in 200 `principal=device:DEV-0002`. Operator cell live at 08:56:25.625 (+1.26 s, same document) | PASS | `w94_r2_web_device_with_operator.png` | **AUD-000096** 08:56:24.362 `AUTH_SUCCESS` OPR-001 device DEV-0002 |
| V-c | verification: sign out to **Login** | More › Sign Out at 08:57:06.080: `POST /auth/sign-out 204`. The app shows **Login** "You have been signed out", "paired as DEV-0002". Web operator cell cleared live at 08:57:07.759 | PASS | `w94_r2_more.png`, `w94_r2_after_sign_out.png`, `w94_r2_sign_out_screenrecord.mp4` | **AUD-000097** 08:57:06.159 `AUTH_SIGNED_OUT` OPR-001 device DEV-0002 `{reason: USER}` |

Phone2 was left paired as DEV-0002 (as asked).

## 4. Step 3 of the brief: pairing the phone and the tablet

Both used the same driver, and the code was counted 0 times in every output (see section 6).

| Device | Code / redeem | New ID | Landing | Audit rows |
|---|---|---|---|---|
| 5554 phone | PCD-000003, redeem 201 at 08:57:45.9 | **DEV-0003** | Login "paired as DEV-0003" | AUD-000098 `PAIRING_CODE_ISSUED`, AUD-000099 `PAIRING_SUCCESS` |
| 5556 tablet | PCD-000004, redeem 201 at 08:58:14.2 | **DEV-0004** | Login "paired as DEV-0004" | AUD-000100 `PAIRING_CODE_ISSUED`, AUD-000101 `PAIRING_SUCCESS` |

Web registry at 08:58:40: DEV-0004, DEV-0003 and DEV-0002 PAIRED and online; DEV-0001 REVOKED; "3 paired · 3 online"
(`pair_web_three_paired.png`, `pair_web_three_paired.log`).

## 5. End state (checked 09:38-09:39)

| Item | Value | Evidence |
|---|---|---|
| phone2 5558 | Login "You have been signed out", paired as DEV-0002, Core online, LIVE | `end_phone2_login.png` |
| phone 5554 | signed out at 09:38:11 (`sign-out 204`), Login, paired as DEV-0003, prefs `{"coreLinkSource":"LIVE"}` | `end_phone_after_sign_out.png`, `end_phone_sign_out.log`; AUD-000201 |
| tablet 5556 | signed out at 09:38:42 (`sign-out 204`), Login, paired as DEV-0004, LIVE | `end_tablet_after_sign_out.png`, `end_tablet_sign_out.log`; AUD-000202 |
| Registry | DEV-0002/0003/0004 PAIRED, online, `signedInOperatorId: null`; DEV-0001 REVOKED | `end_web_a_final.log`, `end_web_a_paired_devices_final.png` |
| Browsers | web a SUPERVISOR signed out (204). Web b's session had already ended by idle expiry (sign-out 401, page on `/login`). Both processes stopped and profiles removed; no process of this row left | `end_web_a_final.log`, `end_web_b_sign_out.log`, browser stop output in the progress file |

## 6. Rules and secrets

- Devices: 5554, 5556 and 5558 only (the driver library refuses any other serial). No PIN was typed and no lock,
  fingerprint or setting was changed. No `locksettings`, no `adb emu finger`, no reverse-rule change (the rules were
  read only). No keyguard appeared.
- No uiautomator dump on Login, Summary or Home: dumps were taken on Pair, Stack Check (that attempt failed and was
  deleted), More, the wizard, Sessions, Audit and Devices only.
- No capture within 2 s of typing a password: the sign-in driver waits 2.6 s (`prefillDelayMs` in the JSON).
- `/` was never launched with `motion=`. `device-session.sh` was not used. Core, Vite, Metro and the emulators were
  not started or stopped, and no demo reset, scenario or fault was run.
- Pairing codes: each issue-and-redeem process counted its code as a digit-bounded token and as spaced digits, then
  dropped it. The places counted were every output file, `main-server-w94.log`, the device JS log, the whole device
  logcat, the app's AsyncStorage and its own result. **0 hits** in 29, 57, 80 and 89 places.
- Final scan of the 269 evidence files (`drv_secret_scan.mjs.txt`): the demo password occurs **0** times (PNG/MP4
  included as bytes). The 230 six-digit numbers are 133 `AUD-` IDs, 63 `PCD-` IDs, 27 byte sizes, 2 UUID fragments
  and 5 `durationMs`/`lagMaxAtMs` values. There are 0 spaced six-digit runs and 0 `dvc_`/`ses_`/`bio_` token shapes.
- Sandbox: adb (daemon socket 5037) and loopback HTTP and CDP are refused inside the sandbox, so those commands ran
  with the per-command sandbox bypass.

## 7. Notes

- N-1: round 1's defects E2E-S-1 (no Login after redeem or sign-out), E2E-S-2 (operator not live), E2E-S-3 (false
  "unreachable" after revoke) and E2E-S-4 (guarded link stays on a public screen) did **not** reproduce, in either
  run or on the two extra pairings.
- N-2: the Pair screen still says "Pair this tablet" on the phones (product copy, D196, left to the copy review).

---
*Generated: 2026-10-07 09:50*
*Last Updated: 2026-10-07 09:50*
