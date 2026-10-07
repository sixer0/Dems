---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: E2E-S (D194; the SC5 journey of plan row W94 plus the re-pair preface of W95)
date: 2026-10-06
agent: verifier
narrative_tier: 2
status: needs-review
evidence_folder: test/assets/e2e/s_pairing/
---

# E2E-S — SC5 pairing journey: web console Paired Devices and a fresh emulator, Live mode, real Core and PostgreSQL

## 1. Environment

| Item | Value | Source |
|---|---|---|
| Core server | `http://127.0.0.1:4420`, database `dems_demo`, `demoControls: true`, running since 09:34 (started by the controller, not by this row) | `.cache/manual/main-server.log` line 1 ("configuration loaded"); health 200 in `00_prepare.log` |
| Web console | `http://127.0.0.1:5173` (origin used, never `localhost`), Live mode (`data-core-mode=LIVE`, shell mode `LIVE`) | `02a_web_signin.log` |
| Browser | Playwright cache headless shell `chromium_headless_shell-1243` (`HeadlessChrome/153.0.8010.12`), raw CDP on 127.0.0.1:9461, fresh profile in `$TMPDIR` (removed at the end), viewport 1920x1080 | `02a_web_signin.log`, `08_final_device.log` |
| Web operator | `andi.pratama` = OPR-002, SUPERVISOR, signed in through the form; password read from the seed constant `DEMO_OPERATOR_PASSWORD`, never printed | `drv_02a_web_signin.mjs.txt` |
| Phone operator | `budi.santoso` = OPR-001, INVESTIGATOR | `drv_04_phone_sign_in.mjs.txt` |
| Emulator | `dems2_phone2` = `emulator-5558`, 1080x2424, `sys.boot_completed=1`, `isKeyguardShowing=false`, `CredentialType: NONE` (start and end) | `00_prepare.log`, `08_final_device.log` |
| App | `com.dems.demo.tablet` 0.1.0 (versionCode 100), already installed 2026-10-04 10:43, so no APK was copied from emulator-5554 | `00_prepare.log` |
| Starting state of the app | SecureStore.xml 65 bytes, 0 entries (no device credential); AsyncStorage keys `dems.mobile.log.v1`, `dems.sim.v1` only (no prefs key, so the Core link default is SIMULATED). `pm clear` was not needed | `00_prepare.log` |
| Reverse rules (set on 5558 only) | `tcp:8081 → tcp:8081`, `tcp:4420 → tcp:4420`. Left in place at the end because Live mode needs them | `00_prepare.log`, `08_final_device.log` |
| Registry at the start (DP-3 evidence) | `listPairedDevices` 200, **0 devices**, "No device has been paired yet", "0 paired · 0 online" | `02a_web_signin.log` 09:47:12; `02_web_paired_devices_idle.png` |
| Device clock | Device time minus host time: −433 ms (09:49), −461/−462 ms (10:08, bracket 25–27 ms), −437 ms (10:12). Every device timestamp below is also given in host time where that matters | `03_*.json`, `05_revoke.json`, `06_*.json` |
| Concurrency | E2E-W2 used the same instance at the same time. Its browser sessions as OPR-001 and OPR-003 show up in the server log and the audit chain, and its sessions SES-20261006-0024 and -0025 appear on the phone because the same operator (budi) was signed in there. This row changed no role, enabled or disabled no operator, signed out no other session and revoked only DEV-0001, the device it paired | `09_server_log_excerpt.txt`; `05_phone_frame_1_last_summary.png`; `06_phone_signed_in.png` |

## 2. Summary

- **6 steps, 4 PASS (two with notes), 2 FAIL.** The two FAILs have one cause, E2E-S-1: after a successful redeem the app does not reach Login by itself. It lands on Stack Check. Pairing works end to end on both clients: code issued, redeemed, PAIRED, sign-in, revoke, re-pair with a new ID. The audit chain has every row the plan asks for: `PAIRING_CODE_ISSUED` AUD-000093/145, `PAIRING_SUCCESS` AUD-000094/146, `AUTH_SUCCESS` naming the device AUD-000102 (DEV-0001) and AUD-000159 (DEV-0002), and `DEVICE_REVOKED` AUD-000142.
- **Revoke latency: 891 ms** from the server's revoke answer (10:08:24.587) to the Pair screen fully drawn on the phone (device 10:08:25.017 = host 10:08:25.478). It is 874 ms to the first transition frame and 911 ms from the click on Confirm. The clock uncertainty is ±14 ms. All three are under the 1 s limit.
- Not observed: a refused **HTTP request** from the revoked device (E2E-S-5). What the server refused was the device's live socket: it closed it with **4403** 4 ms after the revoke. The app deleted its credential immediately, so its next calls were anonymous and answered 200.
- Defects: **E2E-S-1** (Medium, the two FAILs), **E2E-S-2** (Medium, the Operator column does not update live), **E2E-S-3** (Low, a false "Core server unreachable" for about 1 s after a revoke), **E2E-S-4** (Low, a guarded deep link stays on the public screen), **E2E-S-5** (needs a controller ruling: the plan's wording of "next call refused").
- Secrets: no pairing code was found in any of the 28 and 73 places scanned (digit-bounded match). The demo password occurs 0 times in the 113 files scanned (the evidence folder, this report and the progress file). No credential or token lines (`dvc_`, `ses_`, `bio_`) appear in the device JS log or the server log. The code was blurred on the page before every screenshot.
- End state as asked: phone2 is paired to the main instance as **DEV-0002**, in LIVE mode (`{"coreLinkSource":"LIVE"}`), signed out, on Login ("You have been signed out", "Core: DEMS-IR-01 • paired as DEV-0002", Core online). See `07_phone_final_login.png` and `08_final_device.log`.

## 3. Step table

Times are WIB (UTC+7). Server times come from `main-server.log`, which uses the host clock. "device" means the emulator clock.

| Step | Action | Expected (W94 wording) | Observed (timestamps) | Result | Captures | Audit row / log line |
|---|---|---|---|---|---|---|
| 0 | Prepare phone2: boot check, app present, reverse rules on 5558 only, starting state | (prerequisite; DP-3 A: never paired) | Boot completed, keyguard false, CredentialType NONE. App installed, 0 secure-store entries, no prefs key. Reverse 8081/4420 set. Health: core 200, web 200, Metro running. The registry on 4420 was empty at 09:47:12 | PASS | — | `00_prepare.log`; `listPairedDevices` 0 devices (`02a_web_signin.log`) |
| 1 | Cold launch `demsdemo:///login?core=LIVE&motion=off` | "(1) the app in LIVE mode with no device credential shows only the Pair screen and Stack Check" | 09:42:22.5 COLD launch (TotalTime 4669 ms). `runtime.debug.core` at device 09:42:26.678, `runtime.live.ready` at 09:42:26.768. The `/login` link landed on **Pair** ("Not paired", LIVE chip, Link Connected; UI dump `screen-pair`). Prefs `{"coreLinkSource":"LIVE"}`. `/stack-check` was reachable at 09:42:42. Guarded links `/home`, `/login`, `/sessions` reached no guarded screen (the app stayed on Pair or Stack Check, see E2E-S-4). App calls: `GET /auth/session 401`, `GET /auth/status 200`, `GET /health 200` ×2 | PASS | `01_unpaired_pair.png`, `01_unpaired_stack_check.png`, `01_unpaired_home_blocked.png`, `01e_*.png` | `01_step1_unpaired.log`, `01_ui_pair_check.log`, `01e_guarded_link_repro.log` |
| 2 | Web as SUPERVISOR andi.pratama, Paired Devices, issue a code (blur injected before the click) | "(2) the portal issues a code (`PAIRING_CODE_ISSUED`)" | Click at 09:49:02.579. `POST /api/v1/pairing/code` **201**, answered 09:49:02.616. Panel `ACTIVE_KNOWN`, 6 digits shown, countdown 299 s, "5 attempts left". Mask check before the screenshot: digits transparent, no text shadow, blur applied, QR hidden | PASS | `02_web_paired_devices_idle.png`, `02_web_code_issued_blurred.png` | **AUD-000093** 09:49:02.602 `PAIRING_CODE_ISSUED` actor OPR-002, "Pairing code PCD-000001 issued", details `{codeId: PCD-000001, expiresAt}` |
| 3 | A script reads the code from the page over CDP and types it into the app with one `adb shell input text` (never printed), then the keypad's go key | "(3) the app redeems it and reaches Login (`PAIRING_SUCCESS`)" | Typed 09:49:05.70, Enter 09:49:06.785. App: `POST /api/v1/pairing/redeem` **201** at device 09:49:08.098; the server completed it at 09:49:08.378. Web: "DEV-0001 · sdk_gphone64_arm64 is paired." at 09:49:09.149, row DEV-0001 Paired. Secure store now holds `key_v1-dems.live.device.v1` (name only). **New device ID: DEV-0001.** The phone at 09:49:16.995 showed **Stack Check, not Login**. Login ("Core: DEMS-IR-01 • paired as DEV-0001", Core online) appeared only after a manual `demsdemo:///login` at 09:50:22 | **FAIL** (redeem and audit PASS; "reaches Login" not met, E2E-S-1) | `03_web_code_redeemed_device_paired.png`, `03_phone_paired_login.png` (shows Stack Check), `03b_phone_login_paired.png` | **AUD-000094** 09:49:08.369 `PAIRING_SUCCESS` device **DEV-0001**, "Device DEV-0001 paired with DEMS-IR-01". Server: `POST /api/v1/pairing/redeem 201`, then `socket opened principal=device:DEV-0001 kind=DEVICE` (09:49:10.567) |
| 4 | Paired Devices lists the device. Sign in on phone2 as budi.santoso, then check Paired Devices for the operator | "(4) Paired Devices lists the device as PAIRED and, after sign-in, with its operator (`AUTH_SUCCESS` naming the device)" | PAIRED with operator "—" at 09:49:10 and 09:54:57. Phone sign-in at device 09:55:09.500 = `POST /api/v1/auth/sign-in` **200** (server 09:55:09.782, `principal=device:DEV-0001`). No biometric offer appeared: Login says "Biometrics not set up on this device", so "Not now" did not apply. The phone opened Sessions, the deep link kept pending from step 1e, which is by design (MP-12). **On the open page the Operator cell stayed "—"** (still "—" at 09:55:55, 46 s after the sign-in), although `listPairedDevices` returned `signedInOperatorId: OPR-001` at 09:56:42. After a reload at 09:56:49 the row read "AKP Budi Santoso" | PASS with defect E2E-S-2 (operator shown only after a reload) | `04_web_paired_before_sign_in.png`, `04_phone_login_prefilled.png` (password as dots), `04_phone_signed_in.png`, `04_web_device_with_operator.png` (live: "—"), `04_web_after_reload.png` (operator shown) | **AUD-000102** 09:55:09.765 `AUTH_SUCCESS` actor OPR-001 device **DEV-0001**, "Operator signed in (AKP Budi Santoso) via password". AUD-000103 at 09:55:14 (device null) is E2E-W2's browser sign-in, not the phone |
| 5 | Revoke DEV-0001 in Paired Devices (reason typed), with the phone recorded (`screenrecord --bugreport`) and its JS log streamed | "(5) revoke in the portal returns the app to the Pair screen within 1 s and its next call is refused (`DEVICE_REVOKED`)" | First attempt at 10:06:46 aborted with nothing revoked: the web session had idle-expired at 10:04:02 (server 4401). Signed in again at 10:08:09. Confirm clicked at 10:08:24.567. `POST /api/v1/pairing/devices/DEV-0001/revoke` **200**: CDP answer 10:08:24.609, server 10:08:24.587. The server closed the phone's signed-in socket at 10:08:24.591 with `code=4403 closedBy=server`. App: `auth.sessionEnd {kind: DEVICE_REVOKED, wasSignedIn: true}` at device 10:08:24.224 = host 10:08:24.685. Screen: last Session Summary frame at device 24.951 (host 25.412), transition frame at 25.000 (host 25.462), Pair with "Pairing revoked" fully drawn at 25.017 (host **25.478**). **Latency 891 ms** from the server answer (874 ms to the first transition frame, 911 ms from the click). Web: "DEV-0001 revoked" toast, row Revoked, "0 paired · 0 online". Next call: the app deleted its credential (0 secure-store entries), opened an ANONYMOUS socket at 10:08:27.668, and its next HTTP calls `GET /api/v1/auth/status 200` and `GET /api/v1/health 200` (`principal=null`) at 10:08:28.404/.511 were not refused. **No refused request line exists** | PASS for the revoke, the < 1 s return and `DEVICE_REVOKED`. CAUTION on "next call refused": shown only as the 4403 socket refusal (E2E-S-5) | `05_web_revoke_dialog.png`, `05_web_revoked.png`, `05_phone_frame_1_last_summary.png`, `05_phone_frame_2_transition.png`, `05_phone_frame_3_pair_revoked.png`, `05_phone_frames_overlay_times.png`, `05_phone_after_revoke_pair.png`, `05_phone_revoke_screenrecord.mp4` | **AUD-000142** 10:08:24.583 `DEVICE_REVOKED` severity WARNING, actor OPR-002, device **DEV-0001**, "Device DEV-0001 revoked", details `{reason: "E2E-S check: revoke the reserved phone2 pairing", sessionsEnded: 1}`. Refusal line (method, route, status only): `POST /api/v1/pairing/devices/:id/revoke 200`, then `socket closed code=4403 closedBy=server`. No HTTP 401 or 403 followed for the device |
| 6 | Pair again (new code, blurred), sign in, check the operator | (W95 preface) "the emulator pairs again first (a new device ID)"; task: Login, sign in, PAIRED with operator | Issue at 10:12:00.763, `POST /pairing/code 201` at 10:12:00.798. Redeem **201** at device 10:12:06.008 (server 10:12:06.270). Web "DEV-0002 · sdk_gphone64_arm64 is paired." at 10:12:07.507. **New ID DEV-0002 ≠ DEV-0001.** The phone again showed **Stack Check** at 10:12:15; Login appeared only after `demsdemo:///login` (visible 10:13:19). Sign-in **200** at device 10:14:11.168 (server 10:14:11.087, `principal=device:DEV-0002`). The phone opened Session Summary SES-20261006-0025 (E2E-W2's session, the resync target). The Operator cell stayed "—" live (10:14:49). After a reload at 10:14:56: DEV-0002 Paired, "AKP Budi Santoso", Revoke shown; DEV-0001 Revoked | **FAIL** (new ID, sign-in and audit PASS; Login not reached by itself, E2E-S-1 again; operator shown only after a reload, E2E-S-2 again) | `06_web_code_issued_blurred.png`, `06_web_code_redeemed_device_paired.png`, `06_phone_paired_login.png` (shows Stack Check), `06_phone_username_focused_2.png` (Login), `06_phone_signed_in.png`, `06_web_device_live_after_sign_in.png`, `06_web_device_with_operator_after_reload.png` | **AUD-000145** `PAIRING_CODE_ISSUED` (PCD-000002) 10:12:00.777. **AUD-000146** `PAIRING_SUCCESS` device **DEV-0002** 10:12:06.267. **AUD-000159** `AUTH_SUCCESS` actor OPR-001 device **DEV-0002** 10:14:11.076 |
| End | Sign the phone out; leave it on Login | Paired, LIVE, signed out, on Login | More → Sign Out at 10:16:22: `POST /api/v1/auth/sign-out 204`. The app landed on the **paired Pair view, not Login** (another sign of E2E-S-1). Tapping its own "Continue to sign-in" (Unpair not touched) opened Login: "You have been signed out", "paired as DEV-0002", Core online (10:17:18). Registry: DEV-0002 PAIRED, online, `signedInOperatorId: null`; DEV-0001 REVOKED. The web SUPERVISOR session of this row signed out with 204 | Done (with the E2E-S-1 note) | `07_phone_more.png`, `07_phone_signed_out_login.png`, `07_phone_final_login.png`, `08_web_final_paired_devices.png` | **AUD-000165** 10:16:23.658 `AUTH_SIGNED_OUT` actor OPR-001 device DEV-0002 `{reason: USER}` |

### How the revoke latency was measured (Tier 2: method and verification)

1. Host and device clocks were compared right before and right after the revoke: the device clock ran 461/462 ms behind the host, with a 25–27 ms bracket.
2. `screenrecord --bugreport` stamps every frame with the device's wall clock in milliseconds. The recording holds 40 frames, and a frame is written only when the screen changes. Its frames 4 to 6 bracket the change: frame 4 at 24.951 shows Summary, frame 5 at 25.000 is the cross-fade, frame 6 at 25.017 shows Pair. See `05_phone_frames_overlay_times.png`.
3. The start of the interval is the server's own log time of the revoke answer (host clock). The CDP answer time and the click time are given as well.
4. The app's own `auth.sessionEnd DEVICE_REVOKED` record at host 10:08:24.685 shows the revocation reached it about 94 ms after the server closed its socket. The remaining ~790 ms is the render of the Pair screen, with the host load average around 12 at the time.

## 4. Defects

### E2E-S-1 — After pairing (and after sign-out) the app lands on Stack Check or Pair instead of Login (Medium; 3 occurrences)

- **Expected** (W94 step 3 "the app redeems it and reaches Login"): `apps/mobile/src/navigation/root-navigator.tsx` header comment, and `implementation/60_mobile_pairing_gate.md` §3 row "LIVE, PAIRED, not signed in → boot `/` → `/login`".
- **Observed:**
  1. Step 3: redeem 201 at 09:49:08, then Stack Check at 09:49:16.995 (`03_phone_paired_login.png`; the file is named after the expected screen).
  2. Step 6: redeem 201 at 10:12:06, then Stack Check at 10:12:15 (`06_phone_paired_login.png`).
  3. End: sign-out 204 at 10:16:23, then the paired Pair view instead of Login (`07_phone_signed_out_login.png`).

  Each time Login was reachable, by `demsdemo:///login` or by the Pair view's "Continue to sign-in".
- **Repro (as run):**
  1. Cold launch `demsdemo:///login?core=LIVE&motion=off` on an unpaired device.
  2. Open `demsdemo:///stack-check`, `demsdemo:///home`, `demsdemo:///pair`, then `/home`, `/stack-check`, `/login`, `/sessions` and `/pair` (W94 step 1 asks to show Stack Check).
  3. Pair with a fresh code.
  4. Watch the hand-off. After a revoke and a re-pair the same thing happens.
- **Hypothesis (not verified; label H):** `use-pairing-flow.ts:182–187` `leave()` calls `router.back()` whenever `router.canGoBack()`. That returns to whatever public screen is underneath: the Stack Check or Pair entries that the deep links pushed earlier. Another possibility is `/` kept with `?motion=off` from the launch URL, which `app/index.tsx` renders as Stack Check. Either way the boot router's `/login` choice is never reached.
- **To separate the two causes:** pair a fresh unpaired device straight from the cold launch, without visiting Stack Check, once with `motion=off` and once without. This was not done here, because it needs another revoke and pair cycle beyond this row's scope.

### E2E-S-2 — Paired Devices does not update the Operator column live after the device's operator signs in (Medium; 2 of 2)

- **Expected** (task step 4 "Paired Devices then shows its operator"; spec §10.3 live list): the operator appears on the open page.
- **Observed:**
  - DEV-0001: the open page showed "—" for at least 46 s after the sign-in (09:55:09 → 09:55:55). `GET /api/v1/pairing/devices` returned `signedInOperatorId: "OPR-001"`, `online: true` (`04e_probe_operator.log`). A reload showed "AKP Budi Santoso".
  - DEV-0002: the same pattern (10:14:11 sign-in, "—" at 10:14:49, the API had OPR-001 at 10:14:50, the reload showed the name at 10:14:56; `06f`/`06g` logs).
- **Likely cause:** `devices-panel.tsx:30–34` documents RESIDUAL-W70-1. A paired device connecting or signing in publishes no `admin.changed DEVICES`, so the list is read again only on a tablet-link change. The device's sign-in changes `signedInOperatorId` without either event. The server log shows the device socket closing and an operator socket opening at sign-in, but no admin event (`09_server_log_excerpt.txt`).

### E2E-S-3 — "Core server unreachable" shown for about 1 s after a revoke while the Core is reachable (Low)

- **Observed** in the recording: frames at device 10:08:26.425, 26.554, 26.652 and 26.816 show "Core server unreachable" and Link "Unreachable". The frame at 10:08:27.730 shows "Connected" again (`05_phone_frames_contact_sheet.png`).
- **Server side:** the device's socket was closed with 4403 at 10:08:24.591, and a new ANONYMOUS socket opened at 10:08:27.668. The app reports the gap between its sockets as an outage.
- **Expected:** after a revoke the Pair screen does not claim the Core is unreachable.

### E2E-S-4 — A guarded deep link while unpaired stays on the public screen instead of falling through to `/pair` (Low; the gate itself holds)

- **Observed** (`01e_guarded_link_repro.log`): from Stack Check, `demsdemo:///login` and `demsdemo:///sessions` left the app on Stack Check (`01e_from_stack_login.png`, `01e_from_stack_sessions.png`). From Pair, `/home` left it on Pair.
- **Expected** (`root-navigator.tsx` comment): "While blocked, `/login` is itself guarded out, so such a link falls through `/` to `/pair` and stays pending (MP-12)".
- No guarded screen was ever reachable, so W94 step 1 holds. The pending part works: after pairing and sign-in the app opened `/sessions`.

### E2E-S-5 — "Its next call is refused": no refused HTTP request exists (needs a controller ruling; not a product defect)

- The server refused the device's live socket (`socket closed code=4403 closedBy=server`, 10:08:24.591) and wrote `DEVICE_REVOKED` AUD-000142.
- The app then deleted its credential (0 secure-store entries), so it never made an HTTP call with the revoked credential. Its next calls were anonymous and answered 200 (`09_server_log_excerpt.txt`, step 5 block).
- A replay with the old credential was not attempted: the credential lives only in the app's Keystore-backed store, and the rules forbid handling it.
- **Ruling needed:** whether the 4403 close satisfies W94 (5), or whether W94 should name the socket refusal explicitly.

### Observations (not defects)

- **O-1:** Phone2 has no enrolled fingerprint ("Biometrics not set up on this device"). The app made no biometric offer after either sign-in, so "Not now" did not apply.
- **O-2:** The dev build's LogBox banner ("Open debugger to view warnings") showed on the phone. The device JS log has two warnings: `live.socket SYNC_TIMEOUT` (waiting for `hello`) at device 10:12:11.3, right after the re-pair, after which the app reconnected at 10:12:12.583; and one `getServiceHealth` time-out of 8000 ms at 10:13:18. Both fall in periods of high host load (`05_device_js_stream.log`).
- **O-3:** The web SUPERVISOR session idle-expired at 10:04:02, 15 min after the last user input. The CDP-scripted reads did not count as activity. This is the expected idle lock. The revoke was then run on a fresh sign-in. The first revoke attempt revoked nothing (`05_revoke_attempt1_aborted.log`).
- **O-4:** The web Paired Devices `online` cell is empty text in the DOM, an indicator dot with an aria-label; the summary chip carried the online count.

## 5. Rule compliance and deviations

- **Device security:** no lock, PIN, fingerprint or setting was changed. There were no `locksettings` writes and no `adb emu finger`. No keyguard appeared; it was checked before every input. `CredentialType: NONE` at start and end.
- **Emulator scope:** all device commands went to `emulator-5558` only. Nothing touched emulator-5554: the APK was already installed. Nothing touched emulator-5556. `adb devices` (a read-only listing) printed every serial once. `apps/mobile/scripts/device-session.sh` was not used.
- **No uiautomator dump on Login, Summary or Home.** The dumps were taken only on Pair (09:42, 10:11, 10:16) and More (10:16), and every Login field position came from screencap pixels. The app was never launched at `/` with `motion=`.
- **Servers:** no server, Vite, Metro or emulator was started or stopped. No demo reset, scenario or fault was run, nothing touched lanes 4421–4423 or ports 5176–5178, and nothing connected to PostgreSQL directly. The only browser process (CDP 9461) and two leftover `adb logcat` streams belonged to this row and were stopped.
- **Deviation D-1 (load guard):** at 09:49 the 1-minute load was **16.65** when steps 2 and 3 ran. The check and the run were in the same command, so I did not pause. The row then paused whenever the load was above 14: at 09:52–09:54, and at 09:58–10:06 before the revoke.
- **Deviation D-2:** `drv_02a_web_signin.mjs.txt` is the version used for the re-sign-in at 10:08 (output names `05_web_resignin*`). The 09:47 run used the same code with the output names `02_web_paired_devices_idle.png` and `02a_web_signin.json`.
- **Deviation D-3:** the step-1 script's dump grep looked for `id/screen-`. This build writes resource IDs without a package prefix, so the log printed an empty list. Reading the same dump again shows `screen-pair` (`01_ui_pair_check.log`).
- **Secrets:**
  - Pairing codes: both issue-and-redeem processes counted the issued code as a digit-bounded token in every output file present at the time, in `main-server.log`, the device JS log, the whole device logcat and the app's AsyncStorage. The result was **0 hits** in 28 and in 73 places (`03_issue_and_redeem_first.log`, `06c_issue_and_redeem_again.log`). Later files were written by processes that never held a code.
  - Password: the demo password occurs **0** times in the 113 files scanned: the 111 files of the evidence folder, this report and the progress file (`10_secret_scan.log`, run with `drv_10_secret_scan.mjs.txt`).
  - Six-digit numbers: every digit-bounded 6-digit number in the text files was classified. They are audit row IDs `AUD-NNNNNN`, pairing-code IDs `PCD-NNNNNN` (IDs, not codes), byte sizes of captures, Chromium log timestamps (HHMMSS and microseconds), JS bundle line numbers in one stack trace, and four fragments of request UUIDs. None is a pairing code.
  - The PNG and MP4 files have raw byte matches inside compressed data. These are not text, and the web screenshots were taken only after the blur mask was confirmed by computed style.

## 6. Screenshot index (file → caption)

| File | Caption |
|---|---|
| `01_unpaired_pair.png` | Phone, 09:42:33. The cold launch of `/login?core=LIVE&motion=off` with no credential lands on Pair this tablet: Not paired, LIVE, Link Connected |
| `01_unpaired_stack_check.png` | Phone, 09:42:42. Stack Check is reachable while unpaired (Live heartbeat, core-server v0.2.0) |
| `01_unpaired_home_blocked.png` | Phone, 09:42:48. `demsdemo:///home` while unpaired: no guarded screen; the app stays on Stack Check (E2E-S-4) |
| `01_unpaired_pair_ready.png` | Phone, 09:42:53. Back on Pair before the code is issued |
| `01e_from_pair_home.png`, `01e_from_stack_login.png`, `01e_from_stack_sessions.png`, `01e_back_on_pair.png` | Phone, 09:43. E2E-S-4 repro: guarded links leave the app on the current public screen |
| `02_web_paired_devices_idle.png` | Web, 09:47:12. SUPERVISOR on Paired Devices: no device paired yet, 0 paired · 0 online (DP-3 evidence) |
| `02_phone_code_field_focused.png` | Phone, 09:47:31. Code slot 1 focused, numeric keypad, empty slots |
| `02_web_code_issued_blurred.png` | Web, 09:49:04. Code issued: digits and QR blurred by injected CSS; 4:59 countdown, 5 attempts left |
| `03_web_code_redeemed_device_paired.png` | Web, 09:49:10. "DEV-0001 · sdk_gphone64_arm64 is paired."; list row DEV-0001 Paired, operator "—" |
| `03_phone_paired_login.png` | Phone, 09:49:16. After the redeem the app shows **Stack Check**, not Login (E2E-S-1) |
| `03b_phone_login_paired.png` | Phone, 09:50:34. Login after a manual `/login` link: "Core: DEMS-IR-01 • paired as DEV-0001", Core online |
| `04_phone_username_focused.png`, `04_phone_username_focused_2.png` | Phone, 09:51. Username field focused, keyboard up, no handwriting coach |
| `04_web_paired_before_sign_in.png` | Web, 09:54:57. DEV-0001 Paired, operator "—", 1 online |
| `04_phone_login_prefilled.png` | Phone, 09:55:09. Username typed, password shown as dots only |
| `04_phone_signed_in.png` | Phone, 09:55:19. Signed in as budi (Sessions list, the pending deep link from step 1e) |
| `04_web_device_with_operator.png` | Web, 09:55:56. The open page **still shows operator "—"** 46 s after the phone's sign-in (E2E-S-2) |
| `04_web_after_reload.png` | Web, 09:56:49. After a reload: DEV-0001 Paired, operator AKP Budi Santoso |
| `05_web_resignin_paired_devices.png` | Web, 10:08:12. Fresh SUPERVISOR sign-in after the idle expiry; DEV-0001 Paired, operator AKP Budi Santoso |
| `05_web_revoke_dialog.png` | Web, 10:08:24. The Revoke DEV-0001 dialog with the reason typed |
| `05_web_revoked.png` | Web, 10:08:25. Toast "DEV-0001 revoked"; row Revoked, "Revoked by AKP Andi Pratama" with the reason; 0 paired · 0 online |
| `05_phone_frame_1_last_summary.png` | Phone recording, device 10:08:24.951 (overlay). Last frame still on Session Summary |
| `05_phone_frame_2_transition.png` | Phone recording, device 10:08:25.000. Cross-fade from Summary to Pair |
| `05_phone_frame_3_pair_revoked.png` | Phone recording, device 10:08:25.017 (host 10:08:25.478). Pair screen with "Pairing revoked" |
| `05_phone_frames_overlay_times.png` | Overlay times of frames 1–8, with the screen each shows |
| `05_phone_frames_contact_sheet.png` | 15 frames of the recording: Summary → Pair; the "Core server unreachable" frames of E2E-S-3 |
| `05_phone_after_revoke_pair.png` | Phone, 10:08:31. Pair screen, "Pairing revoked", Not paired |
| `05_phone_revoke_screenrecord.mp4` | The 30 s recording with the `--bugreport` time overlay (40 frames) |
| `06_phone_code_field_focused.png`, `06_phone_code_field_focused_2.png` | Phone, 10:11. Pair with the revoked notice; the second tap focused the code slot (keypad) |
| `06_web_code_issued_blurred.png` | Web, 10:12:02. Second code issued, blurred; DEV-0001 listed as Revoked |
| `06_web_code_redeemed_device_paired.png` | Web, 10:12:09. "DEV-0002 · sdk_gphone64_arm64 is paired." |
| `06_phone_paired_login.png` | Phone, 10:12:15. After the re-pair the app again shows **Stack Check**, not Login (E2E-S-1) |
| `06_phone_login_paired_again.png` | Phone, 10:13:09. Still Stack Check 6 s after the `/login` link; Login came later |
| `06_phone_username_focused.png`, `06_phone_username_focused_2.png` | Phone, 10:13. Login "paired as DEV-0002" (entrance in progress), then Username focused with the keyboard |
| `06_phone_login_prefilled.png` | Phone, 10:14:10. Username typed, password as dots |
| `06_phone_signed_in.png` | Phone, 10:14:19. Signed in; the resync target is the Session Summary of SES-20261006-0025 (E2E-W2's session) |
| `06_web_device_live_after_sign_in.png` | Web, 10:14:50. The open page still shows operator "—" for DEV-0002 (E2E-S-2 again) |
| `06_web_device_with_operator_after_reload.png` | Web, 10:14:56. After a reload: DEV-0002 Paired, AKP Budi Santoso; DEV-0001 Revoked |
| `07_phone_settings.png`, `07_phone_more.png` | Phone, 10:15–10:16. Settings, then More with the Lock and Sign Out buttons |
| `07_phone_signed_out_login.png` | Phone, 10:16:32. After sign-out the app shows the paired Pair view, not Login (E2E-S-1) |
| `07_phone_final_login.png` | Phone, 10:17:18. **End state**: Login, "You have been signed out", "paired as DEV-0002", Core online |
| `08_web_final_paired_devices.png` | Web, 10:18:04. Final list: DEV-0002 Paired (no operator), DEV-0001 Revoked |

## 7. Files

- **Report:** `test/07e_e2e_pairing.md` (this file).
- **Progress:** `delegation_progress/e2e_s_pairing.md`.
- **Evidence:** `test/assets/e2e/s_pairing/` holds 111 files, including the final scan log and its script:
  - captures: 47 PNG and 1 MP4;
  - step logs: `00_prepare.log`, `01_*`, `02a/02b`, `03_*`, `04a`–`04e`, `05_*`, `06a`–`06g`, `07a`–`07d`, `08_*`;
  - JSON results per step;
  - UI dumps of Pair and More only (`01_ui_pair.xml`, `06_ui_pair_revoked.xml`, `07_ui_more.xml`, `07_ui_pair_paired_view.xml`);
  - `05_device_js_stream.log`, `09_server_log_excerpt.txt`, `chrome.log`, `10_secret_scan.log`;
  - drivers saved as `.txt`: `01_step1_unpaired.sh.txt`, `05_revoke_wrapper.sh.txt`, `09_server_log_excerpt.py.txt` and the `drv_*.mjs.txt` files.
- No tracked file was modified.

---
*Generated: 2026-10-06 10:25*
*Last Updated: 2026-10-06 10:25*
