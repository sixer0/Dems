---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: SW2 (secret sweep of the captures taken after the SW sweep; D215, D257)
date: 2026-10-07
agent: verifier
narrative_tier: 3
status: complete
scope: test/assets/retest2/** (without */rec/*_frames/), test/assets/retest3/**, verification/assets/e2e_final/**, verification/assets/07_*, verification/assets/08_* (incl. 08_performance_realtime/), verification/assets/03_*, gateway_check/assets/12a_*, 12c_*, 13a_*, 13b_*
---

# SW2: secret sweep of the post-SW captures

## 1. Result

- **Hits: 1.** `gateway_check/assets/12a_final_F1_pairing_handoff.mp4`, frame 2 of 49 (overlay 15:45:50.382, phone2 "Pair this tablet", "Pairing…" state). The Pair code card showed the 6 digits of the issued one-time pairing code. That code had been typed and was being redeemed: frame 3 already shows "Paired … DEV-0015". No other frame in that file shows the code.
- **Redactions: 1.** A redacted copy, `gateway_check/assets/12a_final_F1_pairing_handoff_redacted.mp4`, was written and verified (section 4). The unredacted original was then deleted. It was untracked in git (`git ls-files --error-unmatch` → "did not match any file(s) known to git").
- **Everything else in scope is clean.** That covers:
  - every password field: empty, placeholder, or 9 equal-width mask dots (no Android last-character echo);
  - every other Pair code box: empty;
  - every web issued code: digits and QR blurred;
  - no token or device credential anywhere;
  - no match for the demo password or any 6-character piece of it.
- **Earlier redaction re-verified:** `test/assets/retest2/ph/rs2_h3_pairing_handoff.mp4`, frames 1-2 blacked out (`test/10a_final_retest_phones.md:179`). Both frames measure maximum luma 0, and frame 3 is intact.
- **Needs a decision: 1 reference update** (section 6).

## 2. Counts

| Item | Count | Evidence |
|---|---|---|
| PNG scanned | **433** | retest2/ph 41, retest2/t 74, retest3 57, e2e_final 139, 08_performance_realtime 47, 07_* 17, 12a_* 3, 12c_* 24, 13a_* 14, 13b_* 17. `03_*` holds no PNG or MP4 (text, log and script files only). JPG/JPEG/GIF/WEBM/MOV/WEBP in scope: 0 |
| MP4 scanned | **76** (16,150 frames) | retest2/ph 28, retest2/t/rec 5, retest3 2, e2e_final 22, 08_performance_realtime 7, 12a_* 9, 13a_* 3. Every frame was decoded: for all 76 files, `ffprobe -count_packets` equals the number of frames extracted |
| Excluded per brief | 5 folders, 2,527 PNG | `test/assets/retest2/t/rec/{e_run1,e_run2,e_run2b,e_run3,rt2_verify}_frames/`. These are frame dumps of the five `rec/*.mp4` files, which were scanned in full here; they are ignored by `docs/**/rec/*_frames/` (D227) |
| Images and frames run through OCR | 433 PNG + 16,150 frames | macOS Vision, method below; 0 OCR errors |
| PNG candidates viewed by eye | **175** | 51 Login forms, 31 Pair / code field / sign-in / audit screens, 50 web pages, 43 frame sheets and composites |
| MP4 viewed by eye | **76 of 76** | 25 pairing / revoke / sign-in / sign-out recordings and 51 session-flow recordings, see 3.4 |
| MP4 frames viewed | 140 Pair / hand-off frames whole; 729 Login frames as password-field crops (33 distinct states); 446 distinct frames covering the 14,830 frames of the 51 session-flow recordings | section 3.4 |
| Hits | 1 | section 4 |
| Redactions | 1 (MP4) | section 4 |
| Files deleted | 1 (the unredacted original of the hit, after the copy was verified) | section 4 |

## 3. Method

The method is the same as SW (`test/09_secret_sweep.md` §3).

### 3.1 Secret list (in memory only, never printed)
The list holds 4 values:
- the `DEMO_OPERATOR_PASSWORD` constant (`packages/shared/src/sim/dataset.ts:153`);
- the README pairing code (README line 47);
- the README emulator PIN (README line 48);
- the user's emulator lock PIN from the session memory.

Each value was read by the script itself; the script printed only "secrets_loaded 4". The OCR filter also flagged these shapes:
- any 6-digit run or 3+3 digit group;
- `ses_` / `dvc_` / `bio_` tokens;
- a run of mask bullets with a visible character at either end.

### 3.2 OCR pass (classification, not proof)
- **Tooling.** SW's Swift Vision program read every PNG and every frame (`scratchpad/sw/ocr`). Its output went straight into a Python filter that masked each match before anything was written. Only masked text was stored, in `scratchpad/sw2/` (outside `/docs`).
- **Run note.** Vision returns `nilError` inside the command sandbox (re-confirmed). The OCR therefore ran once outside the sandbox, as in SW: a local process on these files only, with no network, writing only masked output.
- **Load.** `uptime` before the run showed a load average of 6.78 (below 14). The highest reading during the run was 8.93.
- **PNG results:**
  - Password, any 6-character piece of it, the README code, the PINs, token shapes: 0.
  - Bullet+character: 1 OCR line, in `08_performance_realtime/08_phone2_phone_login_prefilled.png`. The pixel measurement gives 9 glyphs of equal 11-12 px width, so it is dots only and clean (3.3).
  - Bullet-only lines: 3, the phone "More" tab icon.
  - 6-digit runs: 44 PNG. Each is an audit ID, a hash or SHA-256 fragment, a certificate serial (`DEC-2026-IR01-…`), a frame-sheet label (`f_… host … t=`) or a timestamp overlay. None is a pairing code.
- **Frame results:**
  - Password, any piece of it, the README code, token shapes: 0.
  - Short-secret match: 10 frames. All 10 matches lie inside the top-left frame-timestamp overlay (`HH:MM:SS.mmm f=N`). The crops were viewed (overlay digits only), so these are not hits.
  - 6-digit runs: 1,718 frames. Each is a frame-timestamp overlay (1,606 lines), the screenrecord build banner (74), a session, evidence or audit ID (28) or a hash fragment (16).
- **Limits and safeguard.** OCR does not read mask dots or the per-digit Pair boxes as a 6-digit run; the hit read as five 1-character lines. Two safeguards cover this:
  - OCR was used to find every Login and Pair screen by its labels, and those screens were then viewed.
  - After the hit, every OCR result (PNG and frames) was searched for a row of 4 or more single-digit lines. It found the hit, plus 6 PNG that are the keyboard number row (5 prefilled Login captures) and the web evidence counters (`07_web_04_evidence.png`). Those crops were viewed.

### 3.3 PNG candidates viewed
Candidates are the union of:
- file names with login, signin, sign_out, signed_out, pair, code, prefill, password, username, biometric, relaunch, redeem, handoff, revoke, frames, crops or sheet (138);
- every OCR-detected Login, Pair, Paired Devices or credential screen;
- all 24 `12c_*` captures.

How they were viewed:
- **Mobile and tablet Login (51).** Cropped at native resolution around the OCR-located "Sign In" button and viewed.
  - The 7 filled password fields were also measured with PIL: the 5 phone captures have 9 glyphs 11-12 px wide, and the 2 tablet captures have 9 glyphs 9 px wide.
  - All 7 are uniform mask dots, which matches the 9-character password with no echoed character.
- **Pair, code field focused, after sign-in, relaunch, audit (31).** Viewed whole. All Pair code boxes are empty, including the 5 "code field focused" captures. The audit "Password" hits are the sign-in method label.
- **Web (50).** For the 22 Paired Devices captures, the "Pair a device" panel was cropped at native size: idle, paired list, revoke dialog, or code issued with digits and QR blurred (5). The other 30 were viewed whole. Login password fields are empty, and the 12c pages are evidence and custody views with no credential.
- **Frame sheets and composites (43).** Viewed at native or near-native size. The 4 pairing/revoke sheets (`rs1_revoke_to_pair_frames_4_revokes.png`, `rs2_pairing_handoff_frames_4_handoffs.png`, `08_r_revoke_frames.png`, `w94_r1_revoke_frames.png`) show empty Pair code boxes and empty or masked Login fields.

### 3.4 MP4 recordings
Every frame was extracted with `setpts=N/(30*TB)` and `-enc_time_base 1/30` (half size for 1080-wide streams), and every frame went through the masked OCR.

**25 pairing / revoke / sign-in / sign-out recordings** (`12a_final_F1_*`, `12a_final_F2_*`, `rs1_*`, `rs2_*`, `rfph4_login_*`, `08_end_*`, `08_r_*`, `08_rp_*`, `end_*_sign_out_*`, `fxr_tablet_sign_in_to_home`, `pair_555*_handoff`, `w94_*`):
- **Pair frames, 140 viewed whole.** These are the 94 visually distinct states of the 470 OCR Pair frames (the clock overlay was ignored when comparing), plus frames 1-6 of every hand-off recording.
  - Frame 2 of `12a_final_F1_pairing_handoff.mp4` is the hit.
  - Every other "Pairing…" / Verify-code frame shows empty code boxes or no code card.
  - The other hand-off recordings start on the paired view.
- **Login frames, 729.**
  - The 715 frames with an OCR "Sign In" button were cropped to the password field and grouped into 20 visually distinct states. The 132 tablet frames were also cropped to Username + Password and grouped into 13 states. All show the "Password" placeholder.
  - The 14 frames without an OCR button were viewed whole. 4 are a revoke cross-fade with empty fields. 10 are `fxr_tablet_sign_in_to_home.mp4` frames 2-11, "Signing in…", where a 3x crop shows the username and 9 uniform mask dots.

**51 session-flow recordings** (web stop/start, stall, monitor, role change, device settings):
- OCR found no Login or Pair text in any frame.
- The 446 visually distinct frames (consecutive duplicates dropped: mean difference < 4/255 on a 40x90 thumbnail, overlay band excluded) were viewed. They show the screenrecord banner, Start New Session, countdown, Active Session, Add Marker, End Session dialog, Finalizing, Evidence sealed, Summary, Home, Settings, Devices and the role-change toast.
- None shows a Login form, a Pair screen, a code or a credential.

## 4. Redacted file

| Item | Detail |
|---|---|
| Hit | `gateway_check/assets/12a_final_F1_pairing_handoff.mp4` (1,674,821 bytes, sha256 prefix e6e4b370599bd5d5, 1080x2424 H.264, 49 frames, 14.85 s, untracked). Frame index 1 (frame 2) showed the code digits in the Pair code card at y ≈ 1790-1840 |
| Redaction | `ffmpeg -i <orig> -map 0:v:0 -vf "drawbox=x=40:y=1735:w=1000:h=170:color=black:t=fill:enable='eq(n\,1)'" -c:v libx264 -crf 18 -pix_fmt yuv420p -fps_mode passthrough -an <orig>_redacted.mp4`. The original has no audio stream, so `-an` drops nothing |
| Redacted copy | `gateway_check/assets/12a_final_F1_pairing_handoff_redacted.mp4`: 756,772 bytes, sha256 8a0e68f0ff73fae23bd6b08a43cc9180fced571a27cec68a247d4674149f67da, 49 frames (`ffprobe -count_frames`), 14.852522 s (same as the original) |
| Verification | All 49 frames decoded. In frame 2, 0 of 163,016 pixels inside the box are above luma 40; 0 glyph pixels remain in the code row outside the box. Mean difference from the original: 0.126/255 outside the box in frame 2, and at most 0.454/255 in the other 48 frames (re-encode only). A crop of frame 2 was viewed: the black bar is under "console." and above "Pairing…", with no digit visible |
| Original | Deleted after the verification above (`rm`, untracked file). The scratch frames that held the digits (`scratchpad/sw2/hit/native/`, `frames/005/f_00002.png`, the overview sheet) were also deleted |
| Derived files | None found. The only references are the text lines in `gateway_check/12a_cf_mobile_runtime.md:281, 433` (section 6). `12a_final_handover_frames_11_runs.png` is built from other recordings (session frames, clean) |

## 5. Candidate table (verdicts)

All rows below are clean except row 1.

| # | File / group | Screen | Verdict |
|---|---|---|---|
| 1 | `gateway_check/assets/12a_final_F1_pairing_handoff.mp4` frame 2 | Phone2 Pair "Pairing…", code digits visible | **hit → redacted** (section 4) |
| 2 | same file, frames 1, 3-49 | screenrecord banner, paired view, boot anchor, Login (placeholder) | clean |
| 3 | `12a_final_F1_revoke_signed_out.mp4`, `12a_final_F2_revoke_signed_in.mp4` | Login (placeholder) → Pair, empty boxes | clean |
| 4 | `retest2/ph/rs1_{i1,i2,s1,s2}_revoke_*.mp4` | Summary / Login → Pair, empty boxes | clean |
| 5 | `retest2/ph/rs2_h{1,2,4}_pairing_handoff.mp4` | banner, paired view, Login (placeholder) | clean |
| 6 | `retest2/ph/rs2_h3_pairing_handoff.mp4` | frames 1-2 black (earlier redaction, luma max 0), paired view, Login | clean |
| 7 | `retest2/ph/rfph4_login_emblem_only_static_10s.mp4` | Login emblem only, 2 frames | clean |
| 8 | `08_performance_realtime/08_rp_phone_handoff_screenrecord.mp4`, `08_r_phone_revoke_screenrecord.mp4` | paired view / Pair empty / Login placeholder | clean |
| 9 | `08_end_5554_sign_out_screenrecord.mp4`, `08_end_5556_sign_out_screenrecord.mp4`, `e2e_final/end_{phone,tablet}_sign_out_screenrecord.mp4`, `w94_r2_sign_out_screenrecord.mp4` | sign-out → "You have been signed out" Login, empty fields | clean |
| 10 | `e2e_final/pair_5554_phone_handoff_screenrecord.mp4`, `pair_5556_…`, `w94_r1_phone_handoff_…`, `w94_r2_phone_handoff_…`, `w94_r1_phone_revoke_…` | paired view, Login placeholder, Pair empty | clean |
| 11 | `e2e_final/fxr_tablet_sign_in_to_home.mp4` | "Signing in…": username and 9 uniform dots → Home | clean |
| 12 | 51 session-flow MP4 (`rp1_r01-18`, `rp3_*`, `t/rec/e_run*`, `rt2_verify`, `retest3/*_540px`, `08_*_tablet_web_stop*`, `fxr_*_home_to_monitor`, `fxr_tablet_web_stop*`, `w95_*`, `w96_*`, `12a_final_F01/F03/F10/F12`, `12a_prefix_E2/E3`, `13a_run_*`) | session screens only (3.4) | clean |
| 13 | `e2e_final/w94_r1_phone_login_prefilled.png`, `w94_r2_phone_login_prefilled.png`, `w95_phone_login_prefilled.png`, `08_phone_phone_login_prefilled.png`, `08_phone2_phone_login_prefilled.png` | Phone Login filled: 9 dots, 11-12 px each | clean |
| 14 | `e2e_final/fxr_tablet_login_prefilled.png`, `08_tablet_phone_login_prefilled.png` | Tablet Login filled: 9 dots, 9 px each | clean |
| 15 | `e2e_final/w94_r{1,2}_phone_username_focused.png`, `fxr_tablet_username_focused.png`, `08_phone_login_username_focused.png`, `08_phone2_login_username_focused.png` | Login, password empty | clean |
| 16 | Further Login captures (some viewed whole, see 3.3): `retest2/ph/end_phone*_login_*`, `rf_0{0,1}_*`, `rfph4_login_*` (4), `rs1_s1_before_login_signed_out`, `rs2_h{1-4}_after_login_*`, `retest2/t/01_login_live_after_relaunch`, `S09_signout_lands_on_login`, `retest3/{p01,p12,t01,t20}_*`, `07_mob_01/99_*`, `08_start_login_555{4,6,8}`, `08_end_5558_login`, `08_end_555{4,6}_after_sign_out`, `08_rp_phone_after_redeem_login`, `e2e_final/end_phone2_login`, `end_{phone,tablet}_after_sign_out`, `pair_555{4,6}_phone_after_redeem_login`, `w94_r{1,2}_phone_after_redeem_login`, `w94_r2_after_sign_out`, `13a_rfph4_e01_*`, `13b_end_signed_out_login` | Login, fields empty or placeholder | clean |
| 17 | `e2e_final/pair_555{4,6}_phone_code_field_focused.png`, `w94_r{1,2}_phone_code_field_focused.png`, `08_rp_phone_code_field_focused.png` | Pair, code boxes empty (keyboard open) | clean |
| 18 | `e2e_final/w94_r1_phone_after_revoke_pair.png`, `w94_s1_pair.png`, `w94_s1_guarded_home_link.png`, `08_r_phone_after_revoke_pair.png`, `retest2/ph/rs1_{i1,i2,s1,s2}_after_pair.png`, `s1_relaunch_555{4,6,8}.png` | Pair / Stack screens, boxes empty | clean |
| 19 | `13a_c02_after_signin.png`, `retest2/t/02_after_signin_budi.png`, `retest3/{p02,t02}_*`, `07_mob_02_after_signin.png` | Home / Summary after sign-in, biometric offer | clean |
| 20 | `e2e_final/fxr_tablet_audit_{0,1,2,3,4}*.png` | Audit list; "Password" = sign-in method label | clean |
| 21 | 22 web Paired Devices (`e2e_final/pair_*_web_*`, `pair_web_three_paired`, `w94_*_web_*`, `w94_s2_*`, `end_web_a_paired_devices_final`, `08_*web*`, `w95_r1_web_after_start`) | issued code: digits and QR blurred (5); otherwise idle / list / revoke dialog | clean |
| 22 | `07_web_01_login_simulated.png`, `07_web_06_signed_out.png`, `e2e_final/end_web_a_signed_out_login.png`, `end_web_b_signed_out.png` | Web Login, password empty | clean |
| 23 | 24 `12c_*` captures | evidence media, custody and integrity pages; demo certificate fingerprint only | clean |
| 24 | 43 frame sheets / composites (`12a_*_frames`, `13a_rfph2_*_frames`, `retest2/ph/rfph3_*`, `rs1_revoke_*`, `rs2_pairing_*`, `retest2/t/B5_*`, `E1_*`, `E2_*`, `E3_*`, `retest3/c1_*`, `c2_*`, `c5_*_crops`, `c6_*_crops`, `c7_*`, `08_*_frames_*`, `08_r_revoke_frames`, `e2e_final/*_frames`) | session, pairing and revoke frames | clean |
| 25 | `07_web_04_evidence.png` (single-digit cross-check) | evidence counters 13 / 10 / 1 / 1 / 1 | clean |

## 6. Needs a decision

1. **Stale reference.** `gateway_check/12a_cf_mobile_runtime.md` lines 281 and 433 still name `12a_final_F1_pairing_handoff.mp4`. That file now exists only as `12a_final_F1_pairing_handoff_redacted.mp4`. This row did not edit the log (scope). Suggested: the controller appends "(redacted copy `…_redacted.mp4`, SW2)" to both lines, or records the rename in the gate entry.
2. **Pending process rule.** D215's rule ("no capture within 2 s of typing into a password field") held for every prefilled capture here. The one hit comes from the hand-off recording, which starts during "Pairing…". That screen still shows the just-typed code. Suggested rule for later rounds: start hand-off recordings after redeem returns, or record with the code card covered. The same pattern was redacted before in `rs2_h3` and `retest/s_pairing/03_*`.
3. **Observation (no action by this row).** There is an empty directory `test/assets/retest2/t/.claude/.cc-writes/` inside the evidence tree. It holds no files, so git ignores it. It can be removed at staging time if the controller wants.

---
*Generated: 2026-10-07 12:22*
