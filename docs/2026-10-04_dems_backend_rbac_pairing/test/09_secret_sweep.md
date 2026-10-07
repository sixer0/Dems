---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: SW (secret sweep of the E2E round and the re-test round captures; D196-D213, D211)
date: 2026-10-06
agent: verifier
narrative_tier: 3
status: complete
scope: test/assets/e2e/**, test/assets/retest/**, gateway_check/assets/11b_*, 11c_*, 11d_*
---

# SW: secret sweep of the E2E and re-test captures

## 1. Result

- **New hits: 0.** No capture in scope shows a password character, an unblurred pairing code, a token, a device credential or a `.data/` secret.
- **Redactions made by this sweep: 0.** No MP4 was re-encoded or deleted.
- **Redactions done earlier and verified here: 4.**
  - Round-1 phone Login captures `e2e/s_pairing/04_phone_login_prefilled.png` and `06_phone_login_prefilled.png` (controller, 13:20, D211).
  - Re-test phone Login capture `retest/s_pairing/04_phone_login_prefilled_redacted.png` (R-S agent, D-3).
  - Re-test hand-off recording `retest/s_pairing/03_phone_handoff_screenrecord_redacted.mp4` (R-S agent, D-2).
- **Files that need a decision: 0.**

## 2. Counts

| Item | Count | Evidence |
|---|---|---|
| PNG scanned under `test/assets/e2e/` | 771 | `find ... -iname '*.png'` per folder: p_phone 177, s_pairing 47, t_tablet 180 + misc 13 + q 7 + q2 1, w1_supervisor 207 + aborted_run0 1, w2_roles 138 |
| PNG scanned under `test/assets/retest/` | 495 | p_phone 152, s_pairing 46, t_tablet 95 + misc 1 + rec/j_stop_frames 131, w_web 70 |
| PNG scanned under `gateway_check/assets/11b_*` | 23 | `11c_*` and `11d_*` hold no image or recording (text, log and diff files only) |
| **PNG total** | **1,289** | JPG / JPEG / GIF / WEBM / MOV in scope: 0 |
| **MP4 scanned** | **20** (1,812 frames) | every frame decoded (`ffprobe -count_frames` = frames extracted, all 20 files) |
| Images and frames run through OCR | 1,289 PNG + 1,812 frames | macOS Vision, see method |
| Candidates viewed by eye | 260 PNG + 20 MP4 = **280** | table in section 5 |
| MP4 frames viewed by eye | 192 Login/Pair frames as crops (4 pairing/sign-out recordings) + 95 distinct frames covering the 1,580 frames of the other 16 recordings | section 3.4 |
| Hits found by this sweep | 0 | |
| Redactions by this sweep | 0 | |
| Earlier redactions verified | 4 (3 PNG, 1 MP4) | section 4 |

## 3. Method

### 3.1 Secret list (held in memory only, never printed)
- The demo password: read from the `DEMO_OPERATOR_PASSWORD` constant in `packages/shared/src/sim/dataset.ts`. The script reported only "found, length 9".
- The README published values, treated as secrets for evidence: the tablet pairing code (README line 47) and the emulator PIN (README line 48).
- Shapes:
  - any 6-digit run or 3+3 digit group;
  - `ses_` / `dvc_` / `bio_` tokens;
  - a run of mask bullets with a visible character at either end (the Android echo pattern).

### 3.2 OCR pass over everything (classification, not proof)
- A small Swift program using macOS Vision text recognition read every PNG and every MP4 frame.
- Its output was piped straight into a Python filter. The filter masked every match before anything was written. A matching line became `[MASKED:secret]` / `[MASKED:pw-partial]` (any 6 consecutive characters of the password) / `[6D]` / `[TOKEN]`.
- Only masked text and box positions were stored, in the scratchpad (outside `/docs`).
- Results over 1,289 PNG + 1,812 frames:
  - Password (exact or any 6-character fragment): 0.
  - README pairing code: 0. PIN: 0. Token shapes: 0.
  - Bullet+character: 1 OCR line, in `retest/t_tablet/C5_technician_home_before_22_after_R2c.png` at x 2090, y 280. That is the MIC 2 level-meter segments on the tablet Home (crop viewed; no form, clean). The 28 bullet-only lines are the phone "More" tab icon (same box x 946, y 2247 in every file).
  - 6-digit runs: 142 PNG and 72 frames. Every context was read in masked form. Each is one of the following:
    - an audit ID (`AUD-…`);
    - a hash-chain short link (6 hex characters that happen to be digits) or a certificate serial (`DEC-2026-IR01-…`);
    - an export ID;
    - the emulator build string in the screenrecord banner (`BE2A.…`);
    - the frame timestamp overlay of the P-row recordings;
    - the API Reference status list "200 401 403";
    - an audio meter scale.
  - None of them is a pairing code.
- Limit: OCR does not read masked dots or the per-digit Pair boxes reliably. So OCR was used to **find** every Login, Pair, code-panel and sign-in screen, by the labels it reads reliably: "Sign In", "Password", "Pairing code", "Enter the 6-digit…", "Pair a device", "Cancel code", "attempts left", "The code expired". Every screen found that way was then **viewed**.
- Run note: Vision returns `nilError` inside the command sandbox. The OCR therefore ran once outside the sandbox. It was a local process on these files only, with no network, and its output stayed in the scratchpad.

### 3.3 Candidates viewed (Read of the image or of a native-resolution crop)
Candidates are the union of the following sets:
- File names with login, signin, sign_in, signed_out, pair, code, prefill, typed, password, username, biometric or relaunch.
- Every OCR-detected Login, Pair, Stack Check and Paired Devices screen.
- The screens right before and after each typed username and each sign-in or sign-out.
- Every frame sheet, contact sheet and crop composite. These are multi-frame images that could hide a Login frame.
- The API Reference captures that show cookie and curl fields.
- All 23 gateway 11b crops.

How they were viewed:
- **Mobile Login (83 files):** cropped at native resolution to the Username/Password/Sign In block, 4 per sheet, and read.
  - Filled fields were checked again at native size: `e2e/p_phone/03_after_signin.png` shows dots only with "Signing in…", plus the three redacted files.
- **Pair and pairing-route screens (47):** the Pair code card was cropped where present; other screens were viewed whole at one third scale. All code boxes are empty, including the four "code field focused" captures with the numeric keyboard open.
- **Web Login (42):** the form was cropped, 9 per sheet. Every password field is empty or masked. "Demo operators" is closed in all of them. `198_login_password_toggle_visible_test_text.png` shows the non-secret test text (allowed by the brief).
- **Web Paired Devices (25):** the "Pair a device" panel was cropped.
  - Code issued or expired (5 + 1 captures): digits and QR blurred.
  - All other captures: no code element on screen.
- **Frame sheets, composites, API Reference, 11b crops (63):** viewed whole.

### 3.4 MP4 recordings
- Every frame of all 20 MP4s was extracted at half size with `setpts=N/(30*TB)` and `-enc_time_base 1/30`. This is needed because the screenrecord streams have repeating timestamps that make ffmpeg drop frames. The extracted counts equal the decoded counts for all 20 files.
- Every frame then went through the masked OCR pass.
- **Pairing / sign-out recordings (4).** Every frame with Login or Pair text was cropped to the form and viewed:
  - `e2e/s_pairing/05_phone_revoke_screenrecord.mp4`: 35 Pair frames, code boxes empty.
  - `retest/s_pairing/01_phone_revoke_screenrecord.mp4`: 15 Login frames and 44 Pair frames, all empty.
  - `retest/s_pairing/03_phone_handoff_screenrecord_redacted.mp4`: frames 2-3 ("Pairing…") have the code card solid black; 38 Login frames are empty.
  - `retest/s_pairing/05_phone_sign_out_screenrecord.mp4`: 58 Login frames, all empty.
- **Other 16 recordings:** SC3/SC4 monitor and role changes, the P3/P4/P5 re-test recordings and the tablet `j_stop.mp4`. OCR found no Login or Pair text in any frame. The 95 visually distinct frames (consecutive duplicates dropped, mean difference < 4/255 on a 40x90 thumbnail) were viewed. They show the screenrecord banner, Active Session, End Session dialog, Finalizing, Summary, Home, Camera 1 and the R-P-1 red error screen. None shows a Login form, a Pair screen or a code.

## 4. Redacted files (all done before this sweep; verified here)

| File | Region blacked out | Verification |
|---|---|---|
| `test/assets/e2e/s_pairing/04_phone_login_prefilled.png` | password text, x 185-870, y 1290-1400 (1080x2424), controller 13:20 (D211) | pixel scan: 0 non-black samples of 8,473 inside the box; the only bright pixels next to it are the lock icon (left) and the eye icon (right); 3x crop viewed |
| `test/assets/e2e/s_pairing/06_phone_login_prefilled.png` | same region, controller 13:20 (D211) | same: 0 of 8,473 non-black inside; crop viewed |
| `test/assets/retest/s_pairing/04_phone_login_prefilled_redacted.png` | password text, x 170-880, y 1285-1400, R-S agent (D-3) | the only non-black pixels inside are 472 pixels at x 191-297, y 1331-1341, which are the agent's label "password redacted (R-S)"; crop viewed |
| `test/assets/retest/s_pairing/03_phone_handoff_screenrecord_redacted.mp4` | code card in the frames before the paired view, R-S agent (D-2) | all 61 frames extracted; frames 2-3 show the black card over the code, no frame shows a code; the derived sheets `03_phone_handoff_contact_sheet.png` and `03_phone_handoff_frames_landing.png` were built from the redacted video and show the same |

The sweep made no redaction and deleted no file.

## 5. Every candidate with its verdict

Paths are relative to `test/assets/` (or start with `gateway_check/assets/`).

| # | File | Screen | Verdict | Note |
|---|---|---|---|---|
| 1 | `e2e/s_pairing/02_web_code_issued_blurred.png` | Web Paired Devices: code issued; digits and QR blurred | clean |  |
| 2 | `e2e/s_pairing/02_web_paired_devices_idle.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 3 | `e2e/s_pairing/04_web_after_reload.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 4 | `e2e/s_pairing/04_web_device_with_operator.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 5 | `e2e/s_pairing/04_web_paired_before_sign_in.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 6 | `e2e/s_pairing/05_web_resignin_paired_devices.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 7 | `e2e/s_pairing/05_web_revoke_dialog.png` | Web Paired Devices: revoke dialog; no code on screen | clean |  |
| 8 | `e2e/s_pairing/05_web_revoked.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 9 | `e2e/s_pairing/06_web_code_issued_blurred.png` | Web Paired Devices: code issued; digits and QR blurred | clean |  |
| 10 | `e2e/s_pairing/06_web_device_live_after_sign_in.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 11 | `e2e/s_pairing/06_web_device_with_operator_after_reload.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 12 | `e2e/s_pairing/08_web_final_paired_devices.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 13 | `e2e/w1_supervisor/178_paired_devices_live_empty.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 14 | `e2e/w1_supervisor/179_paired_devices_code_issued_masked.png` | Web Paired Devices: code issued; digits and QR blurred | clean |  |
| 15 | `e2e/w1_supervisor/180_paired_devices_code_cancelled.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 16 | `e2e/w1_supervisor/181_paired_devices_second_code_masked.png` | Web Paired Devices: code issued; digits and QR blurred | clean |  |
| 17 | `e2e/w1_supervisor/182_paired_devices_code_expired.png` | Web Paired Devices: expired code; digits and QR blurred | clean |  |
| 18 | `retest/s_pairing/01_web_paired_devices_before.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 19 | `retest/s_pairing/01_web_revoke_dialog.png` | Web Paired Devices: revoke dialog; no code on screen | clean |  |
| 20 | `retest/s_pairing/01_web_revoked.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 21 | `retest/s_pairing/02_web_while_unpaired.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 22 | `retest/s_pairing/03_web_code_issued_blurred.png` | Web Paired Devices: code issued; digits and QR blurred | clean |  |
| 23 | `retest/s_pairing/04_web_operator_live.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 24 | `retest/s_pairing/05_web_operator_cleared.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 25 | `retest/w_web/p2_14_paired_devices.png` | Web Paired Devices: device list / idle panel; no code on screen | clean |  |
| 26 | `e2e/p_phone/19c_settings_security_core_pairing.png` | Settings pairing details (device ID only; no code, no credential) | clean |  |
| 27 | `e2e/p_phone/22_stack_check.png` | Stack Check; no code entry | clean |  |
| 28 | `e2e/p_phone/22b_stack_check_scrolled.png` | Stack Check; no code entry | clean |  |
| 29 | `e2e/s_pairing/01_unpaired_home_blocked.png` | Stack Check; no code entry | clean |  |
| 30 | `e2e/s_pairing/01_unpaired_pair.png` | Pair screen; code boxes empty | clean |  |
| 31 | `e2e/s_pairing/01_unpaired_pair_ready.png` | Pair screen; code boxes empty | clean |  |
| 32 | `e2e/s_pairing/01_unpaired_stack_check.png` | Stack Check; no code entry | clean |  |
| 33 | `e2e/s_pairing/01e_back_on_pair.png` | Pair screen; code boxes empty | clean |  |
| 34 | `e2e/s_pairing/01e_from_pair_home.png` | Pair screen; code boxes empty | clean |  |
| 35 | `e2e/s_pairing/01e_from_stack_login.png` | Stack Check; no code entry | clean |  |
| 36 | `e2e/s_pairing/01e_from_stack_sessions.png` | Stack Check; no code entry | clean |  |
| 37 | `e2e/s_pairing/02_phone_code_field_focused.png` | Pair screen; code boxes empty (numeric keyboard open) | clean |  |
| 38 | `e2e/s_pairing/03_phone_paired_login.png` | Stack Check; no code entry | clean |  |
| 39 | `e2e/s_pairing/03b_phone_login_paired.png` | Phone Login; fields empty | clean |  |
| 40 | `e2e/s_pairing/05_phone_after_revoke_pair.png` | Pair screen; code boxes empty | clean |  |
| 41 | `e2e/s_pairing/05_phone_frame_2_transition.png` | Pair screen; code boxes empty | clean |  |
| 42 | `e2e/s_pairing/05_phone_frame_3_pair_revoked.png` | Pair screen; code boxes empty | clean |  |
| 43 | `e2e/s_pairing/06_phone_code_field_focused.png` | Pair screen; code boxes empty (numeric keyboard open) | clean |  |
| 44 | `e2e/s_pairing/06_phone_code_field_focused_2.png` | Pair screen; code boxes empty (numeric keyboard open) | clean |  |
| 45 | `e2e/s_pairing/06_phone_login_paired_again.png` | Stack Check; no code entry | clean |  |
| 46 | `e2e/s_pairing/06_phone_paired_login.png` | Stack Check; no code entry | clean |  |
| 47 | `e2e/s_pairing/07_phone_signed_out_login.png` | Pairing-route screen; no code entry | clean |  |
| 48 | `e2e/t_tablet/19_stack_check.png` | Stack Check; no code entry | clean |  |
| 49 | `e2e/t_tablet/28b_pairing_details.png` | Settings pairing details (device ID only; no code, no credential) | clean |  |
| 50 | `retest/p_phone/45_repro_device_settings_with_cam_detail_in_stack.png` | Pairing-route screen; no code entry | clean |  |
| 51 | `retest/p_phone/47_stack_check_p2.png` | Stack Check; no code entry | clean |  |
| 52 | `retest/p_phone/47b_stack_check_p2_t2.png` | Stack Check; no code entry | clean |  |
| 53 | `retest/p_phone/47c_stack_check_p2_scrolled.png` | Stack Check; no code entry | clean |  |
| 54 | `retest/s_pairing/01_phone_after_revoke_pair.png` | Pair screen; code boxes empty | clean |  |
| 55 | `retest/s_pairing/02a_from_pair_home.png` | Pair screen; code boxes empty | clean |  |
| 56 | `retest/s_pairing/02b_from_stack_home.png` | Pair screen; code boxes empty | clean |  |
| 57 | `retest/s_pairing/02b_stack_check.png` | Stack Check; no code entry | clean |  |
| 58 | `retest/s_pairing/02c_from_stack_login.png` | Pair screen; code boxes empty | clean |  |
| 59 | `retest/s_pairing/02c_rerun_after_2s.png` | Pair screen; code boxes empty | clean |  |
| 60 | `retest/s_pairing/02c_rerun_after_6s.png` | Pair screen; code boxes empty | clean |  |
| 61 | `retest/s_pairing/02c_rerun_stack_check_before.png` | Stack Check; no code entry | clean |  |
| 62 | `retest/s_pairing/02d_from_stack_sessions.png` | Pair screen; code boxes empty | clean |  |
| 63 | `retest/s_pairing/02d_rerun_after_2s.png` | Pair screen; code boxes empty | clean |  |
| 64 | `retest/s_pairing/02d_rerun_after_6s.png` | Pair screen; code boxes empty | clean |  |
| 65 | `retest/s_pairing/02d_rerun_stack_check_before.png` | Stack Check; no code entry | clean |  |
| 66 | `retest/s_pairing/02e_from_stack_home_again.png` | Pair screen; code boxes empty | clean |  |
| 67 | `retest/s_pairing/02e_rerun_after_2s.png` | Pair screen; code boxes empty | clean |  |
| 68 | `retest/s_pairing/02e_rerun_after_6s.png` | Pair screen; code boxes empty | clean |  |
| 69 | `retest/s_pairing/02e_rerun_stack_check_before.png` | Stack Check; no code entry | clean |  |
| 70 | `retest/s_pairing/03_phone_code_field_focused.png` | Pair screen; code boxes empty (numeric keyboard open) | clean |  |
| 71 | `retest/s_pairing/03_phone_stack_check_visited.png` | Stack Check; no code entry | clean |  |
| 72 | `retest/t_tablet/P15_stack_check.png` | Stack Check; no code entry | clean |  |
| 73 | `e2e/p_phone/00_initial_state.png` | Phone Login; fields empty | clean |  |
| 74 | `e2e/p_phone/01_login_live.png` | Phone Login; fields empty | clean |  |
| 75 | `e2e/p_phone/01b_login_username_focus.png` | Phone Login: username typed or focused; password empty | clean |  |
| 76 | `e2e/p_phone/02_login_username_typed.png` | Phone Login: username typed or focused; password empty | clean |  |
| 77 | `e2e/p_phone/03_after_signin.png` | Mobile Login: signing in; password masked (dots only) | clean |  |
| 78 | `e2e/p_phone/03b_after_signin_t2.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 79 | `e2e/p_phone/04_biometric_offer.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 80 | `e2e/p_phone/31b_monitor_bookmark_label_typed.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 81 | `e2e/p_phone/41_relaunch_after_forcestop.png` | Phone Login; fields empty | clean |  |
| 82 | `e2e/p_phone/42_after_resignin_route_sync.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 83 | `e2e/p_phone/43_monitor_resumed_after_relaunch.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 84 | `e2e/p_phone/46b_end_session_reason_typed.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 85 | `e2e/p_phone/96_more_before_sign_out.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 86 | `e2e/p_phone/97_sign_out_step.png` | Phone Login after sign-out; fields empty | clean |  |
| 87 | `e2e/p_phone/98_end_state_login_live_signed_out.png` | Phone Login after sign-out; fields empty | clean |  |
| 88 | `e2e/p_phone/99a_retest_after_signin.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 89 | `e2e/p_phone/99j_end_state_login_live_signed_out.png` | Phone Login after sign-out; fields empty | clean |  |
| 90 | `e2e/s_pairing/04_phone_login_prefilled.png` | Phone Login: username typed; password field (Android last-character echo at capture time) | redacted | redacted (controller 13:20, D211); verified: solid black box x 185-870, y 1290-1400 over the password text, 0 non-black samples inside, only lock and eye icons outside |
| 91 | `e2e/s_pairing/04_phone_username_focused.png` | Phone Login: username typed or focused; password empty | clean |  |
| 92 | `e2e/s_pairing/04_phone_username_focused_2.png` | Phone Login: username typed or focused; password empty | clean |  |
| 93 | `e2e/s_pairing/06_phone_login_prefilled.png` | Phone Login: username typed; password field (Android last-character echo at capture time) | redacted | redacted (controller 13:20, D211); verified: same box, 0 non-black samples inside |
| 94 | `e2e/s_pairing/06_phone_username_focused.png` | Phone Login: username typed or focused; password empty | clean |  |
| 95 | `e2e/s_pairing/06_phone_username_focused_2.png` | Phone Login: username typed or focused; password empty | clean |  |
| 96 | `e2e/s_pairing/07_phone_final_login.png` | Phone Login after sign-out; fields empty | clean |  |
| 97 | `e2e/t_tablet/00_initial_state.png` | Tablet Login; fields empty | clean |  |
| 98 | `e2e/t_tablet/01_login_live.png` | Tablet Login; fields empty | clean |  |
| 99 | `e2e/t_tablet/01_login_live_cold.png` | Tablet Login; fields empty | clean |  |
| 100 | `e2e/t_tablet/02_login_username_filled.png` | Tablet Login: username typed or focused; password empty | clean |  |
| 101 | `e2e/t_tablet/03_biometric_offer.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 102 | `e2e/t_tablet/04_summary_after_signin.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 103 | `e2e/t_tablet/17_audit.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 104 | `e2e/t_tablet/17b_audit_entry_and_verify.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 105 | `e2e/t_tablet/20_signout_step.png` | Tablet Login after sign-out; fields empty | clean |  |
| 106 | `e2e/t_tablet/21_login_technician_username.png` | Tablet Login: username typed or focused; password empty (sign-out notice still shown) | clean |  |
| 107 | `e2e/t_tablet/22_technician_after_signin.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 108 | `e2e/t_tablet/24_signed_out_after_technician.png` | Tablet Login after sign-out; fields empty | clean |  |
| 109 | `e2e/t_tablet/25_login_fresh_partB.png` | Tablet Login; fields empty | clean |  |
| 110 | `e2e/t_tablet/99_final_login_live_signed_out.png` | Tablet Login after sign-out; fields empty | clean |  |
| 111 | `e2e/t_tablet/q/003.png` | Tablet Login; fields empty | clean |  |
| 112 | `e2e/t_tablet/q/068.png` | Tablet Login; fields empty | clean |  |
| 113 | `e2e/t_tablet/q/092.png` | Tablet Login after sign-out; fields empty | clean |  |
| 114 | `e2e/t_tablet/q/17c_audit_verify_later.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 115 | `e2e/t_tablet/q2/002.png` | Tablet Login after sign-out; fields empty | clean |  |
| 116 | `retest/p_phone/00_before_relaunch.png` | Phone Login; fields empty | clean |  |
| 117 | `retest/p_phone/01_login_live_after_relaunch.png` | Phone Login; fields empty | clean |  |
| 118 | `retest/p_phone/02_login_username_typed_budi.png` | Phone Login: username typed or focused; password empty | clean |  |
| 119 | `retest/p_phone/03_after_signin_biometric_offer.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 120 | `retest/p_phone/107_e2e_s1_after_sign_out_rina.png` | Phone Login after sign-out; fields empty | clean |  |
| 121 | `retest/p_phone/108_login_username_typed_andi.png` | Phone Login: username typed or focused; password empty (sign-out notice still shown) | clean |  |
| 122 | `retest/p_phone/109_andi_after_signin.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 123 | `retest/p_phone/112_e2e_s1_after_sign_out_andi_end_state.png` | Phone Login after sign-out; fields empty | clean |  |
| 124 | `retest/p_phone/113_end_state_login_live_signed_out.png` | Phone Login after sign-out; fields empty | clean |  |
| 125 | `retest/p_phone/69_relaunch_after_crash_login.png` | Phone Login; fields empty | clean |  |
| 126 | `retest/p_phone/70_after_resignin_route.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 127 | `retest/p_phone/70b_after_resignin_route_t2.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 128 | `retest/p_phone/71_summary_ses0035_after_relaunch.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 129 | `retest/p_phone/94_more_before_sign_out.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 130 | `retest/p_phone/95_e2e_s1_after_sign_out_budi.png` | Phone Login after sign-out; fields empty | clean |  |
| 131 | `retest/p_phone/95b_e2e_s1_after_sign_out_budi_t2.png` | Phone Login after sign-out; fields empty | clean |  |
| 132 | `retest/p_phone/96_login_username_typed_rina.png` | Phone Login: username typed or focused; password empty (sign-out notice still shown) | clean |  |
| 133 | `retest/p_phone/97_rina_after_signin.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 134 | `retest/s_pairing/00_phone_relaunch_login.png` | Phone Login; fields empty | clean |  |
| 135 | `retest/s_pairing/03_phone_after_redeem_login.png` | Phone Login; fields empty | clean |  |
| 136 | `retest/s_pairing/04_phone_login_prefilled_redacted.png` | Phone Login: username typed; password field (Android last-character echo at capture time) | redacted | redacted (R-S agent, D-3); verified: black box x 170-880, y 1285-1400 holding only the label "password redacted (R-S)" |
| 137 | `retest/s_pairing/04_phone_username_focused.png` | Phone Login: username typed or focused; password empty | clean |  |
| 138 | `retest/s_pairing/05_phone_after_sign_out.png` | Phone Login after sign-out; fields empty | clean |  |
| 139 | `retest/t_tablet/00_before_relaunch.png` | Tablet Login; fields empty | clean |  |
| 140 | `retest/t_tablet/01_login_live_after_relaunch.png` | Tablet Login; fields empty | clean |  |
| 141 | `retest/t_tablet/02_biometric_offer_budi.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 142 | `retest/t_tablet/P01_login_signed_out.png` | Tablet Login after sign-out; fields empty | clean |  |
| 143 | `retest/t_tablet/P02_after_signin_offer.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 144 | `retest/t_tablet/P13_audit.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 145 | `retest/t_tablet/P17_signout_lands_on_login.png` | Tablet Login after sign-out; fields empty | clean |  |
| 146 | `retest/t_tablet/P17a_more_before_signout.png` | Screen next to a sign-in/sign-out step (Home, Summary, audit, More, monitor); no password or code field | clean |  |
| 147 | `retest/t_tablet/R2_a_signed_out_login.png` | Tablet Login after sign-out; fields empty | clean |  |
| 148 | `retest/t_tablet/R2_b_technician_after_signin.png` | Biometric offer after sign-in (Enable / Not now); no form | clean |  |
| 149 | `e2e/p_phone/w1_expired_probe.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 150 | `e2e/w1_supervisor/01_login_live_idle.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 151 | `e2e/w1_supervisor/02_login_wrong_password_after.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 152 | `e2e/w1_supervisor/02_login_wrong_password_before.png` | Web Login: wrong password typed, field masked | clean |  |
| 153 | `e2e/w1_supervisor/03_login_mode_switch_dialog.png` | Web Login: data-mode switch dialog; fields empty | clean |  |
| 154 | `e2e/w1_supervisor/04_login_filled_before_sign_in.png` | Web Login: username filled, password masked (dots) | clean |  |
| 155 | `e2e/w1_supervisor/05_dashboard_after_sign_in.png` | Web Dashboard after sign-in; no form | clean |  |
| 156 | `e2e/w1_supervisor/176_signed_out_before_relaunch.png` | Web Login after sign-out; fields empty | clean |  |
| 157 | `e2e/w1_supervisor/193_lock_console.png` | Web Login (console locked); fields empty | clean |  |
| 158 | `e2e/w1_supervisor/196_final_signed_out.png` | Web Login after sign-out; fields empty | clean |  |
| 159 | `e2e/w1_supervisor/197_deep_link_signed_out.png` | Web Login after sign-out; fields empty | clean |  |
| 160 | `e2e/w1_supervisor/198_login_password_toggle_visible_test_text.png` | Web Login: password eye toggle showing the non-secret test text | clean |  |
| 161 | `e2e/w1_supervisor/203_final_sign_out_end_of_walk.png` | Web Login after sign-out; fields empty | clean |  |
| 162 | `e2e/w1_supervisor/aborted_run0_port_collision/01_login_live_idle.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 163 | `e2e/w2_roles/01_investigator_dashboard_after_sign_in.png` | Web Dashboard after sign-in; no form | clean |  |
| 164 | `e2e/w2_roles/01_live_sign_in_supervisor.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 165 | `e2e/w2_roles/01_technician_dashboard_after_sign_in.png` | Web Dashboard after sign-in; no form | clean |  |
| 166 | `e2e/w2_roles/02_live_sign_in_investigator.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 167 | `e2e/w2_roles/31_live_signed_out_supervisor.png` | Web Login after sign-out; fields empty | clean |  |
| 168 | `e2e/w2_roles/32_live_signed_out_investigator.png` | Web Login after sign-out; fields empty | clean |  |
| 169 | `e2e/w2_roles/46_technician_signed_out_login.png` | Web Login after sign-out; fields empty | clean |  |
| 170 | `e2e/w2_roles/52_investigator_signed_out_login.png` | Web Login after sign-out; fields empty | clean |  |
| 171 | `retest/p_phone/61a_web_after_idle_expiry.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 172 | `retest/s_pairing/06_web_signed_out_login.png` | Web Login after sign-out; fields empty | clean |  |
| 173 | `retest/w_web/p1_w1_4_sim_01_login_live_selector.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 174 | `retest/w_web/p1_w1_4_sim_02_switch_to_simulated_dialog.png` | Web Login: data-mode switch dialog; fields empty | clean |  |
| 175 | `retest/w_web/p1_w1_4_sim_03_login_simulated.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 176 | `retest/w_web/p1_w1_4_sim_05_switch_to_live_dialog.png` | Web Login: data-mode switch dialog; fields empty | clean |  |
| 177 | `retest/w_web/p1_w1_4_sim_06_login_live_again.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 178 | `retest/w_web/p1_w1_4_simok_01_login_live_selector.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 179 | `retest/w_web/p1_w1_4_simok_02_switch_to_simulated_dialog.png` | Web Login: data-mode switch dialog; fields empty | clean |  |
| 180 | `retest/w_web/p1_w1_4_simok_03_login_simulated.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 181 | `retest/w_web/p1_w1_4_simok_05_switch_to_live_dialog.png` | Web Login: data-mode switch dialog; fields empty | clean |  |
| 182 | `retest/w_web/p1_w1_4_simok_06_login_live_again.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 183 | `retest/w_web/p2_01_login.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 184 | `retest/w_web/p2_16_signed_out.png` | Web Login after sign-out; fields empty | clean |  |
| 185 | `retest/w_web/p4_main_sim_01_login_simulated.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 186 | `retest/w_web/p4_main_sim_04_login_live_again.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 187 | `retest/w_web/p4_main_sim_attempt1_01_login_simulated.png` | Web Login; fields empty; Demo operators closed | clean |  |
| 188 | `e2e/s_pairing/05_phone_frame_1_last_summary.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 189 | `e2e/s_pairing/05_phone_frames_contact_sheet.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 190 | `e2e/s_pairing/05_phone_frames_overlay_times.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 191 | `retest/s_pairing/01_phone_revoke_contact_sheet.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 192 | `retest/s_pairing/01_phone_revoke_frames_1.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 193 | `retest/s_pairing/01_phone_revoke_frames_2.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 194 | `retest/s_pairing/01_phone_revoke_frames_3.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 195 | `retest/s_pairing/01_phone_revoke_frames_4.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 196 | `retest/s_pairing/01_phone_revoke_frames_5.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 197 | `retest/s_pairing/01_phone_revoke_frames_6.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 198 | `retest/s_pairing/01_phone_revoke_frames_bottom_strip.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 199 | `retest/s_pairing/03_phone_handoff_contact_sheet.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty; hand-off frames show the code card blacked out (built from the redacted MP4) | clean |  |
| 200 | `retest/s_pairing/03_phone_handoff_frames_landing.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty; hand-off frames show the code card blacked out (built from the redacted MP4) | clean |  |
| 201 | `retest/s_pairing/05_phone_sign_out_frames_landing.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 202 | `retest/s_pairing/05_phone_sign_out_frames_notice_strip.png` | Frame sheet from a pairing / revoke / sign-out recording; Login fields and Pair code boxes empty | clean |  |
| 203 | `e2e/p_phone/65_sc3_s3_phone_transition_frames_f27_f42.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 204 | `e2e/p_phone/69_sc3_s1b_phone_transition_frames_f1_f11.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 205 | `e2e/p_phone/79_sc4_phone_frames_restart_control.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 206 | `e2e/p_phone/79b_sc4_phone_frames_toast_f2_f3_f6.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 207 | `e2e/p_phone/90a_defect_e2e_p1_bottom_nav_crops.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 208 | `e2e/p_phone/92_sc4_phone_frames_back_f1_f4.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 209 | `e2e/p_phone/93_sc4_cycle2_phone_frames_to_technician.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 210 | `e2e/p_phone/94_sc4_cycle2_phone_frames_back.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 211 | `e2e/p_phone/99f_retest_go_home_frames.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 212 | `retest/p_phone/101_p5_deeplink_session_new_frames_one_toast.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 213 | `retest/p_phone/22_p1_after_bottom_nav_crops_all_reps.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 214 | `retest/p_phone/56b_run1_start_handoff_monitor_timer_crops.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 215 | `retest/p_phone/58_p3_after_home_timer_vs_bar_captures.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 216 | `retest/p_phone/59_p3_after_home_timer_vs_bar_every_frame.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 217 | `retest/p_phone/65_p4_after_phone_frames_f58_f163.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 218 | `retest/p_phone/81_p4b_after_phone_frames_f25_f59.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 219 | `retest/p_phone/82_repeat_start_handoff_frames_top.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 220 | `retest/p_phone/87_role_to_technician_phone_frames_f2_f6.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 221 | `retest/p_phone/92_role_back_to_investigator_phone_frames_f2_f6.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 222 | `retest/t_tablet/C1_note_label_before_B12a_after_J12a.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 223 | `retest/t_tablet/C2_custody_before_B29_after_J29.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 224 | `retest/t_tablet/C3_metadata_before_B27_after_J27b.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 225 | `retest/t_tablet/C4_install_update_before_18g_after_O2b.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 226 | `retest/t_tablet/C5_technician_home_before_22_after_R2c.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 227 | `retest/t_tablet/C6_devices_before_12blank_after_T2c1.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 228 | `retest/t_tablet/C7_stop_transition_before_B17_after_f80_f81.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 229 | `retest/t_tablet/J17_tablet_stop_transition_frames_f78_f85.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 230 | `retest/t_tablet/J19_tablet_seal_frames_f100_f107.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 231 | `retest/t_tablet/T2_devices_cycles_1_to_5_sheet.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 232 | `retest/t_tablet/misc/p07e_more_menu_crop_brightened.png` | Frame or crop composite (monitor, role change, nav, custody, devices); no Login, Pair or code field | clean |  |
| 233 | `e2e/w1_supervisor/185_api_reference_client_health.png` | Web API Reference: Cookies panel empty; curl sample uses the placeholder token only | clean |  |
| 234 | `e2e/w1_supervisor/186_api_reference_health_response.png` | Web API Reference: Cookies panel empty; curl sample uses the placeholder token only | clean |  |
| 235 | `e2e/w1_supervisor/187b_api_reference_storage_client.png` | Web API Reference: Cookies panel empty; curl sample uses the placeholder token only | clean |  |
| 236 | `e2e/w1_supervisor/187_api_reference_storage_status_operation.png` | Web API Reference: Cookies panel empty; curl sample uses the placeholder token only | clean |  |
| 237 | `e2e/w1_supervisor/192_api_reference_client_closed.png` | Web API Reference: Cookies panel empty; curl sample uses the placeholder token only | clean |  |
| 238 | `gateway_check/assets/11b_after_d1_dashboard_camera1_menu.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 239 | `gateway_check/assets/11b_after_d1_dashboard_test_signal_toast.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 240 | `gateway_check/assets/11b_after_d2_integrity_after_reload.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 241 | `gateway_check/assets/11b_after_d2_integrity_after_verify.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 242 | `gateway_check/assets/11b_after_d2_integrity_on_open.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 243 | `gateway_check/assets/11b_after_d3_metadata_tab.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 244 | `gateway_check/assets/11b_after_d4_ring_1440x900.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 245 | `gateway_check/assets/11b_after_d4_ring_390x844.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 246 | `gateway_check/assets/11b_after_d4d5_dashboard_1440x900.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 247 | `gateway_check/assets/11b_after_d4d5_dashboard_390x844.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 248 | `gateway_check/assets/11b_after_d5_strip_390x844.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 249 | `gateway_check/assets/11b_after_d6_custody_1440x900.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 250 | `gateway_check/assets/11b_before_d1_dashboard_camera1_menu.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 251 | `gateway_check/assets/11b_before_d2_integrity_after_reload.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 252 | `gateway_check/assets/11b_before_d2_integrity_after_verify.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 253 | `gateway_check/assets/11b_before_d2_integrity_on_open.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 254 | `gateway_check/assets/11b_before_d3_metadata_tab.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 255 | `gateway_check/assets/11b_before_d4_ring_1440x900.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 256 | `gateway_check/assets/11b_before_d4_ring_390x844.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 257 | `gateway_check/assets/11b_before_d4d5_dashboard_1440x900.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 258 | `gateway_check/assets/11b_before_d4d5_dashboard_390x844.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 259 | `gateway_check/assets/11b_before_d5_strip_390x844.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 260 | `gateway_check/assets/11b_before_d6_custody_1440x900.png` | Web FX-W before/after crop (dashboard, integrity, metadata, ring, strip, custody); no Login, Pair or code field | clean |  |
| 261 | `e2e/p_phone/retest_go_home.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [114 frames] | clean |  |
| 262 | `e2e/p_phone/sc3_s1b_phone.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [39 frames] | clean |  |
| 263 | `e2e/p_phone/sc3_s2_phone.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [75 frames] | clean |  |
| 264 | `e2e/p_phone/sc3_s3_phone.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [67 frames] | clean |  |
| 265 | `e2e/p_phone/sc4_back_phone.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [5 frames] | clean |  |
| 266 | `e2e/p_phone/sc4_cycle2_back_phone.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [5 frames] | clean |  |
| 267 | `e2e/p_phone/sc4_cycle2_tech_phone.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [5 frames] | clean |  |
| 268 | `e2e/p_phone/sc4_to_tech_phone.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [20 frames] | clean |  |
| 269 | `e2e/s_pairing/05_phone_revoke_screenrecord.mp4` | Phone revoke -> Pair (round 1): 35 Pair frames cropped and viewed, code boxes empty [40 frames] | clean |  |
| 270 | `retest/p_phone/p3_home_bar.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [29 frames] | clean |  |
| 271 | `retest/p_phone/p4_web_stop.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [163 frames] | clean |  |
| 272 | `retest/p_phone/p4b_start_handoff.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [799 frames] | clean |  |
| 273 | `retest/p_phone/p4b_web_stop.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [81 frames] | clean |  |
| 274 | `retest/p_phone/p5_deeplink.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [35 frames] | clean |  |
| 275 | `retest/p_phone/role_back_inv.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [6 frames] | clean |  |
| 276 | `retest/p_phone/role_to_tech.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [6 frames] | clean |  |
| 277 | `retest/s_pairing/01_phone_revoke_screenrecord.mp4` | Phone revoke Login -> Pair (re-test): 15 Login + 44 Pair frames cropped and viewed; fields and code boxes empty [61 frames] | clean |  |
| 278 | `retest/s_pairing/03_phone_handoff_screenrecord_redacted.mp4` | Phone pairing hand-off (re-test): frames 2-3 "Pairing..." with the code card blacked out; 38 Login frames empty [61 frames] | redacted | redacted by the R-S agent (D-2) before this sweep; verified frame by frame, no code visible in any of 61 frames |
| 279 | `retest/s_pairing/05_phone_sign_out_screenrecord.mp4` | Phone sign-out -> Login (re-test): 58 Login frames cropped and viewed; fields empty [70 frames] | clean |  |
| 280 | `retest/t_tablet/rec/j_stop.mp4` | Monitor / role change / stop / deep link recording: no Login, Pair or code screen in any frame (OCR all frames; distinct frames viewed) [131 frames] | clean |  |

## 6. Files that need a decision

None.

## 7. Notes for the controller

- **The drivers' rule worked.** The P and T rows (round 1 and re-test) took no screencap until the sign-in had answered 200. Their 7 typed or focused username Login captures all show an empty password field: `e2e/p_phone/01b`, `02`, `e2e/t_tablet/02`, `21`, `retest/p_phone/02`, `96`, `108`.
- **Only the pairing rows were exposed.** The S rows captured a "prefilled" frame right after typing, and those were the only captures with the echo. 08d already proposes the rule for later rounds: no screencap within 2 s of typing into a password field.
- **Paired Devices blur held everywhere.** The web rows' blur-before-capture rule held on every code panel (W1 179/181/182, S 02/06, R-S 03).
- **Not done:** `masterplan/02_plan.md` was not updated by this row. The brief limits writes to the asset folders, this log and the progress file, so the controller records the row.
- **Scratchpad only (outside `/docs`):** the masked OCR files `ocr_masked.jsonl` / `ocr_frames.jsonl`, the half-size MP4 frames and the review sheets. They hold no secret. They are in the session scratchpad `…/scratchpad/sw/`.

---
*Generated: 2026-10-06 14:10*
*Last Updated: 2026-10-06 14:10*
