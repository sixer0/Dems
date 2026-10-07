---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: R-S (re-test of the E2E-S pairing journey after E-fix; D196, D201-D208)
date: 2026-10-06
agent: verifier
narrative_tier: 2
status: needs-review
evidence_folder: test/assets/retest/s_pairing/
before_report: test/07e_e2e_pairing.md (captures in test/assets/e2e/s_pairing/)
---

# R-S: re-test of the pairing journey on phone2 and the web Paired Devices page after E-fix

## 1. Environment

| Item | Value | Source |
|---|---|---|
| Core server | `http://127.0.0.1:4420`, database `dems_demo`. Restarted by the controller with FX-C's engine; its first log line, "configuration loaded", is at 12:12:07 (D206 gives 12:14). This row did not start or stop it | `.cache/manual/main-server.log` line 1; health 200 at 12:40:24 |
| Web console | `http://127.0.0.1:5173` (origin used; never `localhost`), Live mode (`data-core-mode=LIVE`, shell mode `LIVE`) | `01a_web_signin.log` |
| Browser | This row's own Playwright-cache headless shell `chromium_headless_shell-1243` (`HeadlessChrome/153.0.8010.12`), pid 60644, raw CDP on OS-assigned port 53355 (`--remote-debugging-port=0`, read back from DevToolsActivePort and checked against the pid). Fresh profile in `$TMPDIR`, viewport 1920x1080. Stopped and profile removed at 13:14 | `browser.sh.txt`, `06_browser_stop.log` |
| Web operator | `andi.pratama` = OPR-002, SUPERVISOR, signed in through the form at 12:47:53. Password read inside the driver from the seed constant `DEMO_OPERATOR_PASSWORD`, which holds the value the README Quick start publishes. Never printed; README was not grepped | `drv_web_signin.mjs.txt` |
| Phone operator | `budi.santoso` = OPR-001, INVESTIGATOR (same source) | `drv_sign_in.mjs.txt` |
| Emulator | `dems2_phone2` = `emulator-5558`, 1080x2424, boot completed, `isKeyguardShowing=false` at every check. App `com.dems.demo.tablet` 0.1.0 (debug), reverse rules `tcp:8081` and `tcp:4420` present (not touched) | `00_relaunch.log`, `06_final_device.log` |
| New bundle | 12:45:57 `am force-stop`, then a COLD launch of `demsdemo:///login?core=LIVE&motion=off` (TotalTime 5480 ms). `Running "main"` at 12:46:01.9, `runtime.live.ready` at 12:46:04.0. Login: "Core: DEMS-IR-01 • paired as DEV-0002", Core online, no warnings toast | `00_relaunch.log`, `00_phone_relaunch_login.png` |
| Device clock | Device time minus host time: −533 ms (12:49:19, bracket 36 ms), −536 ms (12:49:29), −540 ms (13:01:10), −545 ms (13:01:35, 13:06:25; bracket 23-25 ms). Every device time below is also given in host time where it is compared with the server | `01_revoke.json`, `03_issue_and_redeem_first.json`, `04_phone_sign_in.json` |
| Web watcher | A background CDP client on the same page from 12:49:01 to 13:12:19. It stamped every change of the rows' State, Operator and online cells (in-page MutationObserver, host clock) and every realtime frame except meters, heartbeat and delta. It also logged every `/api/v1` answer. The document time origin was 12:47:49.673 at both start and stop, so the page was **never reloaded or navigated** during steps 1-5 | `web_watch.log`, `web_watch.json`, `drv_watch.mjs.txt` |
| Load | 1-minute load between 4.48 and 9.20 at every check (limit 14). No pause was needed | `uptime` lines in the step logs |
| Concurrency | Other re-test rows used lanes 4421-4423 and emulators 5554/5556. No other client used 4420 during this row, apart from the controller's health probes | `07_server_log_excerpt.txt` |

## 2. Summary

- **Steps 5 of 5 PASS against the four round-1 defects. All four are fixed on the device and on the web:**
  - E2E-S-1, both parts:
    - after the redeem the app lands on Login, not Stack Check, with no Stack Check frame in the 61-frame recording;
    - after sign-out it lands on Login, not the paired Pair view, with no Pair frame.
  - E2E-S-2, in and out: the Operator column updates live without a reload.
  - E2E-S-3: none of the 61 frames after the revoke shows "Core server unreachable".
  - E2E-S-4: warm guarded links from Stack Check open Pair.
- **Revoke latency: 1,897 ms** from the server's revoke answer (12:49:21.196) to the first Pair frame (device 12:49:22.558 = host 23.093; ±18 ms clock bracket). Round 1 measured 891 ms. That run revoked a **signed-in** phone on Session Summary; this one revoked a **signed-out** phone on Login, as the brief specified. The value is above W94 step 5's "within 1 s", so it is new defect **R-S-1** (needs a ruling; section 4).
- **Operator column latency:**
  - in: **1,221 ms** from the server's sign-in answer (13:06:28.543) to "AKP Budi Santoso" in the open page (13:06:29.764);
  - out: **1,705 ms** from the sign-out answer (13:08:23.172) to "—" (13:08:24.877). That is 1,236 ms after the last device change, the device socket admission at 23.641, which matches FX-C's 1 s debounce after the last change.
- **New defects:**
  - **R-S-1** (Medium, needs a ruling): revoke-to-Pair takes 1.9 s from signed-out Login.
  - **R-S-2** (Low): "Core server unreachable", with "Use Simulated mode", shows on Login for 0.10-0.47 s right after the pairing hand-off. At that moment the app restarts its own device socket after a `SYNC_TIMEOUT`.
- **Two secret incidents in this row's own captures, both contained:**
  - D-2: the pairing code was in the first two frames of the hand-off recording. The video was redacted and the original deleted.
  - D-3: the password's last character was echoed in the prefill screencap. Redacted, original deleted.
- **The same echo is in round 1's evidence:** `test/assets/e2e/s_pairing/04_phone_login_prefilled.png` and `06_phone_login_prefilled.png` show the password's last character in clear. They are outside this row's write scope; routed for redaction (section 6).
- **Step 6 (repeat) not run.** Steps 3-5 met their criteria. R-S-2, found during step 3, is outside step 3's criterion, and a repeat would need another revoke (DEV-0004). That is left to the controller.
- **End state as asked:**
  - phone2 is paired to the main instance as **DEV-0003**, in LIVE mode (`{"coreLinkSource":"LIVE"}`), signed out, on Login ("You have been signed out.", "paired as DEV-0003", Core online);
  - the web SUPERVISOR session is signed out (204, then `GET /auth/session 401`);
  - the browser is closed.

## 3. Step table

Times are WIB, host clock unless marked "device". Server lines come from `.cache/manual/main-server.log` and are quoted as method, route, status. The full excerpt is `07_server_log_excerpt.txt`.

| Step | Defect | Before (round-1 file) | After (new file) | Observed (timestamps) | Result | Audit row / log line |
|---|---|---|---|---|---|---|
| 0 | (prerequisite) relaunch so the full new bundle loads | — | `00_phone_relaunch_login.png` | force-stop 12:45:57.8; COLD launch 12:45:59.1 (TotalTime 5480 ms); `runtime.live.ready` 12:46:04.0. Login "paired as DEV-0002", Core online, no warnings toast. The one W-level JS line is Reanimated's reduced-motion note, caused by `motion=off` | Done | `socket opened kind=DEVICE` (DEV-0002) 12:46:04.179; `GET /api/v1/auth/session 401`, `GET /api/v1/pairing/device 200`, `GET /api/v1/auth/status 200` |
| 1 | **E2E-S-3** (false "Core server unreachable" after a revoke) and the revoke time | `05_phone_frames_contact_sheet.png` ("unreachable" at device 10:08:26.425-26.816), `05_phone_frames_overlay_times.png` | `01_phone_revoke_frames_1.png` … `01_phone_revoke_frames_6.png`, `01_phone_revoke_frames_bottom_strip.png`, `01_phone_revoke_contact_sheet.png`, `01_phone_revoke_screenrecord.mp4`, `01_phone_after_revoke_pair.png`, `01_web_revoke_dialog.png`, `01_web_revoked.png` | Confirm clicked 12:49:21.160; CDP answer 21.244; server answer 21.196. Web: `admin.changed DEVICES` 21.194, row Revoked in the open page 21.442, toast "DEV-0002 revoked", "0 paired · 0 online". App: `auth.sessionEnd {kind: DEVICE_REVOKED, wasSignedIn: false}` at device 20.724 (host 21.259). Phone frames: Login (still "paired as DEV-0002", Core online) until device 22.429; one black frame 22.498; **Pair "Pairing revoked" first drawn at device 22.558 (host 23.093)**. Then Link "Connected" 22.558-22.731, "Connecting to the Core server…" with Link "Connecting…" 22.769-22.930, and "Not paired…" with Link "Connected" from 23.164 to the last frame 24.815 (no further change to the end of the 30 s recording). **No frame of 61 shows "Core server unreachable", Link "Unreachable" or the "Pairing needs the Core server" line.** Revoke-to-Pair: **1,897 ms** from the server answer, 1,933 ms from the click, 1,834 ms on the device clock from the app's own revoke record | **PASS** (E2E-S-3 fixed). Latency 1.9 s > 1 s: **R-S-1** | **AUD-000176** 12:49:21.180 `DEVICE_REVOKED` WARNING, actor OPR-002, device DEV-0002, "Device DEV-0002 revoked", `{reason: "R-S re-test", sessionsEnded: 0}`. AUD-000177 12:49:21.197 `TABLET_LINK_CHANGED` OFFLINE. Server: `POST /api/v1/pairing/devices/:id/revoke 200` 12:49:21.196; `socket closed code=4403 closedBy=server` 21.207; `socket opened kind=ANONYMOUS` 23.596; `GET /api/v1/auth/status 200` 23.705 |
| 2 | **E2E-S-4** (warm guarded link while unpaired stayed on the public screen) | `01e_from_stack_login.png`, `01e_from_stack_sessions.png`, `01_unpaired_home_blocked.png`, `01e_from_pair_home.png` (all: no fall-through to Pair) | `02b_stack_check.png` → `02b_from_stack_home.png`; `02c_rerun_stack_check_before.png` → `02c_rerun_after_2s.png`; `02d_rerun_stack_check_before.png` → `02d_rerun_after_2s.png`; `02e_rerun_stack_check_before.png` → `02e_rerun_after_2s.png`; `02a_from_pair_home.png`; `02_web_while_unpaired.png` | Unpaired: secure store had 0 entries. From Pair, `/home` 12:54:44.777 → Pair (dump `screen-pair`). From Stack Check (captured 12:54:59), `/home` 12:55:10.917 → Pair (dump `screen-pair`). Re-run with a Stack Check picture before each link: `/login` 12:57:27.292 → Pair at the 12:57:29.584 capture; `/sessions` 12:57:41.391 → Pair at 43.611; `/home` 12:57:55.269 → Pair at 57.501. All six "after" dumps read `screen-pair`. The first run of 2c-2e also landed on Pair (`02c_from_stack_login.png`, `02d_from_stack_sessions.png`, `02e_from_stack_home_again.png`) | **PASS** (E2E-S-4 fixed) | No audit row (the newest stayed AUD-000177 at 12:58:58: local navigation). Server: only the app's anonymous keep-alive, 22 × `GET /api/v1/health 200`. Web list unchanged: DEV-0002 and DEV-0001 Revoked |
| 3 | **E2E-S-1** part 1 (after a redeem the app landed on Stack Check) | `03_phone_paired_login.png`, `06_phone_paired_login.png` (both Stack Check) | `03_phone_stack_check_visited.png`, `03_phone_code_field_focused.png`, `03_web_code_issued_blurred.png`, `03_web_code_redeemed_device_paired.png`, `03_phone_handoff_contact_sheet.png`, `03_phone_handoff_frames_landing.png`, `03_phone_handoff_screenrecord_redacted.mp4`, `03_phone_after_redeem_login.png` | Round 1's history was rebuilt: Stack Check 13:00:39, then `/pair` 13:00:39.037, slot 0 focused 13:00:46 (keypad up). Issue clicked 13:01:10.924. Blur mask checked before the screenshot: digits transparent, no shadow, blurred, QR hidden. Panel ACTIVE_KNOWN, 299 s, "5 attempts left". Code typed 13:01:13.438, go key 14.300. App `POST /api/v1/pairing/redeem 201` at device 16.040; server 16.475. Web: row DEV-0003 Paired in the open page 16.561; "DEV-0003 · sdk_gphone64_arm64 is paired." 17.240; online dot on 19.302. Phone (device clock): "Pairing…" until at least 17.968 (code redacted, D-2); paired view "Tablet paired … Returning automatically…" 20.554-24.742; black frame 24.883; **Login at 24.946 (host 25.488)**. "Core server unreachable" shows 24.946-25.047 (**R-S-2**), the notice is gone from 25.417 and the ring is gold again by 25.481 ("paired as DEV-0003", Core online). **No Stack Check frame in 61 frames.** **New device ID: DEV-0003.** Code count-scan: 0 digit-bounded or spaced hits in 70 places | **PASS** (E2E-S-1 part 1 fixed). New **R-S-2** | **AUD-000178** 13:01:10.948 `PAIRING_CODE_ISSUED`, actor OPR-002, "Pairing code PCD-000003 issued". **AUD-000179** 13:01:16.469 `PAIRING_SUCCESS`, device **DEV-0003**, "Device DEV-0003 paired with DEMS-IR-01". AUD-000180 13:01:19.179 `TABLET_LINK_CHANGED` CONNECTED. Server: `POST /api/v1/pairing/code 201` 13:01:10.957; `POST /api/v1/pairing/redeem 201` 13:01:16.475; `socket opened kind=DEVICE` 19.178; `GET /api/v1/auth/status 200` 22.630; `socket closed code=1000 closedBy=peer` 24.742; `socket opened kind=DEVICE` 25.607 |
| 4 | **E2E-S-2** in (Operator column not updated live after the device's sign-in) | `04_web_device_with_operator.png` ("—" 46 s after the sign-in), `06_web_device_live_after_sign_in.png` | `04_phone_username_focused.png`, `04_phone_login_prefilled_redacted.png`, `04_phone_signed_in.png`, `04_web_operator_live.png`, `web_watch.log` | Paired Devices kept open; the same document since 12:47:49.673. Phone go key 13:06:28.400; app `POST /api/v1/auth/sign-in 200` at device 28.041 (host 28.586); server 28.543. Web: `admin.changed DEVICES` 13:06:29.690, `GET /api/v1/pairing/devices 200` 29.731, **Operator cell "AKP Budi Santoso" at 13:06:29.764: 1,221 ms after the sign-in answer, no reload**. No biometric offer ("Biometrics not set up on this device"). The phone opened Session Summary SES-20261006-0025 (observation O-4) | **PASS** (E2E-S-2 fixed: 1.22 s ≤ about 1.5 s) | **AUD-000181** 13:06:28.538 `AUTH_SUCCESS`, actor OPR-001, device **DEV-0003**, "Operator signed in (AKP Budi Santoso) via password". Server: `POST /api/v1/auth/sign-in 200` 13:06:28.543; `socket closed code=1000 closedBy=peer` (device) 28.605; `socket opened kind=OPERATOR` (OPR-001) 28.618 |
| 5 | **E2E-S-1** part 2 (after sign-out the app showed the paired Pair view) and **E2E-S-2** out | `07_phone_signed_out_login.png` (paired Pair view); round 1 had no live check of the cell clearing | `05_phone_more.png`, `05_phone_sign_out_frames_landing.png`, `05_phone_sign_out_frames_notice_strip.png`, `05_phone_sign_out_screenrecord.mp4`, `05_phone_after_sign_out.png`, `05_web_operator_cleared.png` | `/more` 13:08:12.430 (dump `screen-more`; Sign Out `[556,600][996,726]`). Sign Out tapped at 13:08:23.074. Server `POST /api/v1/auth/sign-out 204` 23.172. Phone frames (device): More until 23.027, fade 23.056-23.096, dark 23.261-23.277, **Login "You have been signed out." from 23.295 (host ≈23.840): 668 ms after the answer**. All 58 Login frames to 39.198 show "You have been signed out.", Core online and "paired as DEV-0003"; **no Pair view and no "unreachable"**. Web: `admin.changed DEVICES` 13:08:24.833; **Operator cell "—" at 13:08:24.877**: 1,705 ms after the sign-out answer, 1,236 ms after the device socket admission at 23.641 (the debounce's last change); no reload | **PASS** (E2E-S-1 part 2 fixed; E2E-S-2 out live) | **AUD-000182** 13:08:23.168 `AUTH_SIGNED_OUT`, actor OPR-001, device **DEV-0003**, `{reason: USER}`. Server: `POST /api/v1/auth/touch 200` 23.154; `POST /api/v1/auth/sign-out 204` 23.172; `socket closed code=4401 closedBy=server` (OPR-001) 23.173; `socket opened kind=DEVICE` 23.641; `GET /api/v1/auth/status 200` 23.715 |
| 6 | Repeat of 3-5 only if one failed | — | — | Not run: steps 3-5 met their criteria (section 2) | Not run | — |
| End | Phone paired, LIVE, signed out, on Login; web signed out; browser closed | `07_phone_final_login.png` | `05_phone_after_sign_out.png`, `06_web_signed_out_login.png` | Registry 13:13:02: DEV-0003 PAIRED, online, `signedInOperatorId: null`; DEV-0002 and DEV-0001 REVOKED. Phone prefs `{"coreLinkSource":"LIVE"}`, one secure-store entry `key_v1-dems.live.device.v1` (name only). Web sign-out 13:13:02.379. Browser pid 60644 stopped, profile removed, no process of this row left | Done | Server: `POST /api/v1/auth/sign-out 204` (OPR-002) 13:13:02.379; `socket closed code=4401 closedBy=server` 02.380; `GET /api/v1/auth/session 401` 03.318 |

### How the times were measured (Tier 2: method and verification)

1. **Phone screens.** `screenrecord --bugreport` stamps every frame with the device wall clock in milliseconds, and a frame is written only when the screen changes.
   - Every frame was extracted (ffmpeg, passthrough timing). Each was read from its overlay (`frames.py.txt`), never assumed from the pts.
   - The pts were cross-checked against the overlay: f_0018 minus f_0002 = 5.891 s in both.
   - Device times were converted to host time with the measured offset; the bracket is 23-36 ms.
2. **Web cells.** An in-page MutationObserver stamped the cell change with `Date.now()` (host clock) in the same document that was open from sign-in to the end. Realtime frame times come from CDP's frame timestamps, mapped to wall time by one page request.
3. **Server.** Request times are the server's own "request completed" log times (host clock).
4. **"No unreachable at any frame"** was checked frame by frame on crop sheets of the time overlay, the Core connection card (y 300-1860) and the bottom strip (y 1860-2424). A crop on the wrong region was noticed and redone; see `05_phone_sign_out_frames_notice_strip.png`. There are no OCR tools on this host, so the frames were read visually; the sheets are kept so the reading can be checked.

## 4. Defects

### R-S-1: Revoke-to-Pair takes 1.9 s when the phone is signed out on Login (Medium; needs a ruling; 1 of 1)

- **What:** the server answered the revoke at 12:49:21.196, and the app logged `auth.sessionEnd {kind: DEVICE_REVOKED, wasSignedIn: false}` at host 21.259.
  - The Login screen then stayed for 1.7 s more, still reading "paired as DEV-0002" and Core online (frames to device 22.429).
  - Then one black frame (22.498), then Pair "Pairing revoked" (22.558 = host 23.093).
  - Total **1,897 ms** (`01_phone_revoke_frames_2.png`, `01_revoke.log`, `01_device_js_stream.log` lines 2-12).
- **Why it matters:** W94 step 5 reads "revoke in the portal returns the app to the Pair screen within 1 s". Round 1 met it with 891 ms (`test/07e_e2e_pairing.md` step 5), but from a **signed-in** phone on Session Summary.
- **Not established:** whether this is a regression from E-fix or depends on the starting state. This row followed the brief: the phone was signed out on Login, and only one revoke was in scope.
- **Hypothesis (H, not verified):** for a signed-out operator, the route leaves `(auth)` only when the pairing gate re-reads the device as unpaired. That may wait for the credential deletion (the Keystore delete took about 3 s in round 1) or for FX-M1's `SignedOutLanding` reset; the black frame suggests a reset. The anonymous socket (opened after the deletion) came at 23.596, 0.5 s after Pair was drawn, so the deletion alone does not explain it all.
- **Suggested check:** one revoke of a signed-in phone and one of a signed-out phone, same build, same load.

### R-S-2: "Core server unreachable" on Login for 0.10-0.47 s right after the pairing hand-off (Low; 1 of 1 in this row)

- **What:** the first Login frames after the hand-off show the red ring and "Core server unreachable — Sign-in needs the Core server. Nothing is sent while it cannot be reached.", with Retry, **Use Simulated mode** and a disabled Sign In.
  - Frames at device 13:01:24.946, 24.972 and 25.047; the next frame, 25.417, has no notice, and the ring is gold again by 25.481 (`03_phone_handoff_frames_landing.png`, `03_phone_handoff_contact_sheet.png`).
  - The Core was reachable throughout.
- **Correlated (from the logs):**
  - The app logged a warn `live.socket` "The live socket reported SYNC_TIMEOUT." (`waiting: 'hello'`, connection 3) at device 13:01:24.176 (`01_device_js_stream.log`).
  - The server logged `socket closed code=1000 closedBy=peer` for DEV-0003 at 13:01:24.742 and `socket opened kind=DEVICE` at 25.607.
  - The notice shows in that self-made socket gap. FX-M1's DX-3 mapping covers only a run the Core ended (4401/4403), not a client reconnect after `SYNC_TIMEOUT`.
- **Same family as:** round 1's O-2, which logged `SYNC_TIMEOUT` right after the re-pair (device 10:12:11.3), and E2E-S-3.
- **Why it matters:** low impact (under half a second). But it offers "Use Simulated mode" in that window, and it is the same class of false outage E2E-S-3 removed for the revoke.

### Round-1 defects re-tested

| Round-1 defect | Result | Evidence |
|---|---|---|
| E2E-S-1 (Stack Check after redeem; Pair view after sign-out) | **Fixed** | Step 3: Login, no Stack Check frame; step 5: Login, no Pair frame |
| E2E-S-2 (Operator column not live) | **Fixed** | In 1,221 ms, out 1,705 ms, same document |
| E2E-S-3 (false "unreachable" after revoke) | **Fixed** | 61 of 61 frames clean; Link reads "Connecting…" in the gap |
| E2E-S-4 (warm guarded link stays put) | **Fixed** | 6 of 6 links from Stack Check or Pair open Pair |

### Observations (not defects)

- **O-1: the code stays visible after the redeem answer.** The app's own 201 line is at device 13:01:16.040, but "Pairing…" with the code in the slots was still drawn at 17.968, and the paired view came at 20.554 (4.5 s). The paired view then stayed 4.2 s ("Returning automatically…") before the hand-off; `PAIR_TIMELINE.handoffAfter` is 2.4 s.
  - This matches the secure-store write budget FX-M1 routed to W98/W93 (D203).
  - Side effect for testers: a capture started after the 201 line can still show the code (D-2).
- **O-2: black frames at route resets.** About 60 ms each: revoke (device 12:49:22.498), hand-off (13:01:24.883) and sign-out (13:08:23.261-23.277).
- **O-3: Pair-screen link states after the revoke.** The first two Pair frames read Link "Connected" (22.558, 22.731), then "Connecting…" while the run is ended (22.769-22.930), then "Connected" from 23.164.
- **O-4: pending `/home` link not opened after sign-in.** After the step-4 sign-in the phone opened Session Summary SES-20261006-0025 (the resync target, as in round 1 step 6). The pending `/home` from step 2e did not open. FX-M1 says the pending href opens after pairing and sign-in (MP-12); perhaps the resync target takes precedence. Outside this row's criteria; noted for W93.
- **O-5: no warnings toast.** No "Open debugger to view warnings" toast in any of the 192 recorded frames (61 + 61 + 70; F80). The `SYNC_TIMEOUT` warn reached logcat at level I, consistent with DX-6.
- **O-6: web ATTENTION while unpaired.** The web header read ATTENTION ("Some checks need attention") while no device was paired. That is `TABLET_LINK_CHANGED` OFFLINE (AUD-000177), expected. SECURE returned after DEV-0003's socket (AUD-000180).

## 5. Rule compliance and deviations

- **Device security:** no lock, PIN, fingerprint or setting was changed. No `locksettings`, no `adb emu finger`. `isKeyguardShowing=false` was checked before every input.
- **Emulator scope:**
  - Every adb command went to `emulator-5558`. Nothing touched 5554/5556 or their reverse rules.
  - `apps/mobile/scripts/device-session.sh` was not used.
  - The app was never launched at `/` with `motion=`.
  - UI dumps were taken only on Pair, Stack Check (empty) and More, never on Login, Summary or Home. Login field positions came from screencap pixels.
- **Servers:** no server, Vite, Metro or emulator was started or stopped. No demo reset, scenario or fault was run. Roles and operators were not touched. Only DEV-0002, phone2's own device, was revoked. Nothing touched 4421-4423, 5176-5178 or PostgreSQL.
- **Tracked files:** none modified. This row wrote only under `test/assets/retest/s_pairing/`, plus this report and `delegation_progress/retest_s_pairing.md`.
- **D-1: Stack Check dumps are empty.** The UI dump of the animated Stack Check returns 0 bytes (`02b`-`02e_ui_stack_check.xml`, kept as evidence), so the first run of 2c-2e had no "before" picture. 2c-2e were re-run with a screencap of Stack Check before each link (`02b_guarded_links_rerun.log`). Both runs landed on Pair.
- **D-2 (secret incident, contained): the code got into the hand-off recording.**
  - What happened: the driver started the recording 500 ms after the app's `redeem 201` line, on the assumption that Live mode clears the slots on the answer (`use-pairing-flow.ts:222-223`). The screen lagged (O-1): frames at device 13:01:17.374 and 17.968 still showed the redeemed code.
  - Within about 2 minutes, the video was re-encoded with a black box over the code card for every frame before the paired view (`sheets_and_redaction.py.txt`). The redacted frames were checked, and the original MP4 and its extracted frames were deleted. Only `03_phone_handoff_screenrecord_redacted.mp4` remains, and every sheet was built from the redacted video.
  - The code was already redeemed (PCD-000003, single use) and was never printed or logged.
  - The count-only scan cannot see pixels.
  - Lesson for later rows: never record or screencap the Pair screen until the paired view is drawn.
- **D-3 (secret incident, contained): the password's last character was in a screencap.** Android echoes the last typed character of a password field for a moment, and the prefill screencap caught it. The password text was covered and the original deleted; `04_phone_login_prefilled_redacted.png` remains.
- **D-4: the step-1 JS stream ran on.** The step-1 wrapper's `kill` stopped the shell function, not its `adb logcat` child. The step-1 JS stream therefore kept running until 13:14 (pid verified as this row's, then stopped), and `01_device_js_stream.log` covers steps 1-5 (88 lines, 0 credential lines). Its first 13 lines are the step-1 window.
- **D-5: first watcher run discarded.** The first watcher run (12:48:17-12:48:36) logged the 20 Hz meters frames. It was stopped and restarted with filters, and its output was overwritten. The page was not touched.
- **D-6: principal IDs in request lines.** Request lines in the step logs and the excerpt also carry the principal ID (for example `device:DEV-0003`), to tell the clients apart. It is an ID, not a credential.
- **Secrets:** see section 7.

## 6. For the controller

- **Record:** R-S-1 (Medium, ruling needed: does W94's "< 1 s" apply to a signed-out phone, and is 1.9 s a regression?) and R-S-2 (Low).
- **Record:** the four round-1 defects E2E-S-1 to E2E-S-4 are fixed on the device and on the web.
- **Route (secret hygiene, outside this row's write scope):** `test/assets/e2e/s_pairing/04_phone_login_prefilled.png` and `06_phone_login_prefilled.png` show the demo password's last character in clear (Android password echo).
  - They need the same redaction as D-3.
  - Other rows that screencapped a filled password field may have the same issue: worth a check across `test/assets/**/*prefill*`.
- **Rule for later device rows:**
  - take no capture of the Pair screen between typing the code and the paired view (D-2);
  - take no screencap within 2 s of typing into a password field (D-3).

## 7. Secret scan

- **Pairing code:** the issue-and-redeem driver held the code in one variable and handed it to one `adb shell input text`.
  - Before dropping it, it counted the code (digit-bounded, and as digits separated by spaces) in 70 places: every file of the evidence folder at 13:01:36, `main-server.log`, the device JS log since T0, the whole device logcat, the app's AsyncStorage and its own result JSON. Result: **0 hits** (`03b_issue_and_redeem.log`).
  - Files written later came from processes that never held the code.
  - Pixels are not text: D-2 above is the one capture that showed the code, and only its redacted copy exists.
- **Password:** the final scan (`drv_secret_scan.mjs.txt`, output `08_secret_scan.log`) counted the demo password in all 115 files: the evidence folder (including the scan's own log), this report and the progress file, with PNG and MP4 read as bytes. Result: **0 occurrences**. The visible last-character echo in one screencap is D-3; it was redacted before this scan.
- **Six-digit numbers:**
  - Spaced six-digit sequences (digits separated by single spaces, dots, commas or dashes): **0** in the text files.
  - Digit-bounded six-digit numbers: 154 in the text files, all explained (no pairing code among them):
    - audit row IDs `AUD-NNNNNN` (72);
    - pairing-code IDs `PCD-NNNNNN`, which are IDs, not codes (30);
    - capture byte sizes (18);
    - Chromium log timestamps in `chrome.log` (18);
    - fragments of request UUIDs or socket connection IDs (6 + 3 trailing UUID groups in `01_device_js_stream.log`);
    - JS bundle line numbers in the `SYNC_TIMEOUT` stack trace (5, `hermes-stable:NNNNNN`);
    - the browser profile's folder suffix, which is its start time HHMMSS (2: `rs_pairing_profile_124630` in `06_browser_stop.log` and in this paragraph).
- **Credentials:** 0 lines with `dvc_`, `ses_` or `bio_` in the device JS log and the server log (`03b_issue_and_redeem.log`, `04b_phone_sign_in.log`, `01_revoke.log`). No cookie, token or request body was printed or written.

## 8. Screenshot index

| File | Caption |
|---|---|
| `00_phone_relaunch_login.png` | Phone, 12:46:13. After force-stop and the LIVE relaunch: Login, "Core: DEMS-IR-01 • paired as DEV-0002", Core online, no warnings toast |
| `01_web_paired_devices_before.png` | Web, 12:47:59. SUPERVISOR on Paired Devices: DEV-0002 Paired, online, operator "—"; DEV-0001 Revoked |
| `01_web_revoke_dialog.png` | Web, 12:49:20. "Revoke DEV-0002?" dialog with the reason "R-S re-test" |
| `01_web_revoked.png` | Web, 12:49:22. Toast "DEV-0002 revoked"; row Revoked, "Revoked by AKP Andi Pratama, R-S re-test"; 0 paired · 0 online |
| `01_phone_revoke_frames_1.png` | Phone recording, frames 1-12 (device 12:49:16.667-20.818): the recording slate and Login before the revoke answer |
| `01_phone_revoke_frames_2.png` | Phone recording, frames 13-24: Login until device 22.429, one black frame at 22.498, Pair "Pairing revoked" from 22.558, Link "Connected", then "Connecting…" |
| `01_phone_revoke_frames_3.png` | Phone recording, frames 25-36 (22.848-23.273): "Connecting to the Core server…" with Link "Connecting…", then "Not paired…" with Link "Connected"; no "unreachable" |
| `01_phone_revoke_frames_4.png` | Phone recording, frames 37-48 (23.282-23.899): Pair, Link "Connected", ring animation; no "unreachable" |
| `01_phone_revoke_frames_5.png` | Phone recording, frames 49-60 (23.917-24.099): Pair, Link "Connected"; no "unreachable" |
| `01_phone_revoke_frames_6.png` | Phone recording, frame 61 (24.815): the last frame of the recording, Pair, Link "Connected" |
| `01_phone_revoke_frames_bottom_strip.png` | Phone recording, frames 18-61: the bottom of the Pair screen (code slots), with no "Pairing needs the Core server" line in any frame |
| `01_phone_revoke_contact_sheet.png` | Phone recording, all 61 frames at thumbnail size: Login, then one black frame, then Pair |
| `01_phone_after_revoke_pair.png` | Phone, 12:49:29. Pair "Pairing revoked", Not paired, Link Connected |
| `02_web_while_unpaired.png` | Web, 12:58:58. During step 2: no device paired (DEV-0002 and DEV-0001 Revoked), header ATTENTION |
| `02a_from_pair_home.png` | Phone, 12:54:51. `demsdemo:///home` while on Pair, unpaired: stays on Pair (dump `screen-pair`) |
| `02b_stack_check.png` | Phone, 12:54:59. Stack Check opened by `demsdemo:///stack-check` while unpaired |
| `02b_from_stack_home.png` | Phone, 12:55:17. `demsdemo:///home` from Stack Check: Pair (round 1 stayed on Stack Check) |
| `02c_from_stack_login.png` | Phone, 12:55:43. First run: `demsdemo:///login` from Stack Check lands on Pair |
| `02c_rerun_stack_check_before.png` | Phone, 12:57:27. Re-run: Stack Check right before the `/login` link |
| `02c_rerun_after_2s.png` | Phone, 12:57:29. Re-run: 2.3 s after `demsdemo:///login`: Pair |
| `02c_rerun_after_6s.png` | Phone, 12:57:33. Re-run: still Pair 6.5 s after the `/login` link (dump `screen-pair`) |
| `02d_from_stack_sessions.png` | Phone, 12:56:09. First run: `demsdemo:///sessions` from Stack Check lands on Pair |
| `02d_rerun_stack_check_before.png` | Phone, 12:57:41. Re-run: Stack Check right before the `/sessions` link |
| `02d_rerun_after_2s.png` | Phone, 12:57:43. Re-run: 2.2 s after `demsdemo:///sessions`: Pair |
| `02d_rerun_after_6s.png` | Phone, 12:57:47. Re-run: still Pair (dump `screen-pair`) |
| `02e_from_stack_home_again.png` | Phone, 12:56:35. First run: `demsdemo:///home` from Stack Check again: Pair |
| `02e_rerun_stack_check_before.png` | Phone, 12:57:55. Re-run: Stack Check right before the `/home` link |
| `02e_rerun_after_2s.png` | Phone, 12:57:57. Re-run: 2.2 s after `demsdemo:///home`: Pair |
| `02e_rerun_after_6s.png` | Phone, 12:58:01. Re-run: still Pair (dump `screen-pair`) |
| `03_phone_stack_check_visited.png` | Phone, 13:00:39. Stack Check visited before Pair, to rebuild round 1's history |
| `03_phone_code_field_focused.png` | Phone, 13:00:49. Pair with "Pairing revoked", code slot 1 focused, numeric keypad, empty slots |
| `03_web_code_issued_blurred.png` | Web, 13:01:12. Code PCD-000003 issued; digits and QR blurred by injected CSS; 4:59, 5 attempts left |
| `03_web_code_redeemed_device_paired.png` | Web, 13:01:18. "DEV-0003 · sdk_gphone64_arm64 is paired."; row DEV-0003 Paired (online dot still off until 13:01:19.3) |
| `03_phone_handoff_contact_sheet.png` | Phone recording (redacted), all 61 frames: "Pairing…" (code card blacked out), paired view, one black frame, Login; no Stack Check frame |
| `03_phone_handoff_frames_landing.png` | Phone recording (redacted), frames at device 24.742 (paired view), 24.883 (black), 24.946 and 25.047 (Login with false "Core server unreachable", R-S-2), 25.445 (notice gone, ring still red) and 25.481 (ring gold, Core online) |
| `03_phone_after_redeem_login.png` | Phone, 13:01:35. Login, "Core: DEMS-IR-01 • paired as DEV-0003", Core online |
| `04_phone_username_focused.png` | Phone, 13:06:06. Login, Username focused, keyboard up, fields empty |
| `04_phone_login_prefilled_redacted.png` | Phone, 13:06:27. Username budi.santoso typed; the password field covered by a black box (D-3) |
| `04_phone_signed_in.png` | Phone, 13:06:35. Signed in as AKP Budi Santoso; the app opened Session Summary SES-20261006-0025 (O-4) |
| `04_web_operator_live.png` | Web, 13:06:48. Same open page, no reload: DEV-0003 Paired, online, Operator "AKP Budi Santoso" (shown at 13:06:29.764) |
| `05_phone_more.png` | Phone, 13:08:17. More (signed in as AKP Budi Santoso) with Lock console and Sign out |
| `05_phone_sign_out_frames_landing.png` | Phone recording, frames at device 23.027 (More), 23.056 and 23.079 (fade), 23.277 (dark), 23.295, 23.311, 23.344, 23.429 (Login "You have been signed out.") |
| `05_phone_sign_out_frames_notice_strip.png` | Phone recording, all 58 Login frames (device 23.295-39.198): "You have been signed out.", Core online, "paired as DEV-0003"; no "unreachable" |
| `05_phone_after_sign_out.png` | Phone, 13:08:42. **End state**: Login, "You have been signed out.", Core online, "paired as DEV-0003" |
| `05_web_operator_cleared.png` | Web, 13:12:18. Same open page, no reload: DEV-0003 Paired, online, Operator "—" (cleared at 13:08:24.877) |
| `06_web_signed_out_login.png` | Web, 13:13:03. After the SUPERVISOR sign-out: the web Login page, mid entrance animation (brand shown, form not yet drawn) |
| `01_phone_revoke_screenrecord.mp4` | Phone, 12:49:16-12:49:46. The step-1 recording with the `--bugreport` time overlay (61 frames) |
| `03_phone_handoff_screenrecord_redacted.mp4` | Phone, 13:01:17-13:01:32. The step-3 hand-off recording, code card blacked out in frames before the paired view (61 frames) |
| `05_phone_sign_out_screenrecord.mp4` | Phone, 13:08:19-13:08:39. The step-5 sign-out recording (70 frames) |

## 9. Files

- **Report:** `test/08d_retest_pairing.md` (this file).
- **Progress:** `delegation_progress/retest_s_pairing.md`.
- **Evidence:** `test/assets/retest/s_pairing/`:
  - 46 PNG, 3 MP4;
  - step logs `00`-`06` with JSON results;
  - UI dumps of Pair, Stack Check (empty) and More only;
  - `web_watch.log` and `web_watch.json`, `01_device_js_stream.log`, `07_server_log_excerpt.txt`, `chrome.log`;
  - the scan log `08_secret_scan.log`;
  - drivers saved as `.txt`: `drv_*.mjs.txt`, `*.sh.txt`, `frames.py.txt`, `server_excerpt.py.txt`, `sheets_and_redaction.py.txt`, `drv_secret_scan.mjs.txt`.

---
*Generated: 2026-10-06 13:25*
*Last Updated: 2026-10-06 13:25*
