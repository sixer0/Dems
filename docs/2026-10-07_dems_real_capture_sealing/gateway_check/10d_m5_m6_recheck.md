---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 75 (M5) TARGETED RE-CHECK after fix wave K, with the open conditions of row 81 (M6)
date: 2026-10-11
agent: verifier (independent +1; brief `delegation_progress/gate_brief_wave_g.md`; environment `initialization/08_gate_environment_wave_k.md` incl. "After fix 151")
narrative_tier: 2
tree: commit b05106b + the uncommitted fix 151 (6 files under `apps/core-server`; `git status --short` outside `docs/` read at 04:15 and 08:56: the same 6 lines; no product or test file changed by me)
builds_on: gateway_check/10_m5_gate.md (FAIL), 10b_m5_regate.md (FAIL, blocked), 10c_m5_regate.md (FAIL, narrowly), 11b_m6_regate.md (PASS WITH CONDITIONS)
status: needs-review
verdict_m5: PASS WITH CONDITIONS
verdict_m6: PASS WITH CONDITIONS
---

# 10d - Targeted re-check of row 75 (M5) and of the conditions of row 81 (M6)

Not a full gate: the items of the task, one run each. No speech-to-text speed figure is in this
file (D230). Nothing was played, on a device or in the browser (the browsers ran with
`--mute-audio`; no player was opened). No local device (`CAM-03` / `MIC-03`) was selected,
pre-checked or started; no attendance variable set; the fingerprint sensor never touched; `CAM-04`
/ `CAM-05` on no track; the camera stub not used and its fixture file not read. No fixture
account, pairing code, password, token or key material is in this file or in a file name. Lane 2
was never reset. Every `curl` / `adb` / `lane.sh` call ran outside the command sandbox. Evidence
under the git-ignored `.cache/gates/75d/`.

Surfaces: **W2** web lane 2 (5177), **W1** web lane 1 (5176) - headless Chromium over CDP with the
helper's cookie, a page sampler every 90 ms; **T** tablet `emulator-5556` = `DEV-0001`, **P** phone
`emulator-5554` = `DEV-0002`, both on lane 2 - `adb` taps, `uiautomator`, screenshots, sign-in
through the Login with the seed operators (values never printed into a file); **API** = the lane's
Core through the web origin; **FILE** = sealed package members read as text (manifest, transcript
document; no media opened).

Run windows: 04:15-04:22 WIB and 08:16-08:56 WIB. Between two of my calls the run stood still for
3 h 53 min (04:22:31 -> 08:15:48; nothing ran, the audit chain holds only five `AUTH_EXPIRED` rows
for that time). Every operator session had expired; I signed in again and went on. Host load 3.0
at the start, 3.5 at the end.

## 1. Verdicts

### Row 75 (M5): PASS WITH CONDITIONS

The one MAJOR of 10c is closed, and what 10c could not prove is now driven live:

- **G75c-01 CLOSED.** Core stopped gracefully during a recording and started again: the fault reads
  "Core was not running", the interrupted seal completes, then exactly ONE `FAULT_CLEARED` row, the
  alert resolved, web header / tablet Home / phone Home back to normal without any action; a new
  session recorded and sealed; a second clean restart raised nothing.
- **G75b-02 CLOSED (live).** With the supported rig: the blocked seal is stated on the web dialog,
  the Monitor banner, the header pill, tablet and phone Finalizing, Home and Sessions; New Session
  says why it is unavailable; after `release` the product's recovery operation sealed the item
  (verify PASS 15 of 15) and every surface returned to normal. The unsealable case ended
  INCOMPLETE with its files in quarantine and the lane recorded again at once.

No BLOCKER and no MAJOR is open by my rating. Conditions (each with an owner):

| # | Condition | Finding | Owner |
|---|---|---|---|
| C1 | After an UNSEALABLE end the CRITICAL alert stays `active` for good (acknowledged, a new sealed session, a restart: still active) while web header, Dashboard ring, tablet Home and phone Home read "SECURE / All systems operational / READY". **Ruling asked on the severity**: I rate it MINOR because the statement is true where it is made (the end-of-session notice, the bell, the Sessions row "Incomplete") and nothing is blocked; it is the mirror of G75c-01 (an alert no product action ends), and if the controller applies D220's reasoning to it, it is MAJOR and M5 is FAIL on this one item | G75d-01 | controller (ruling); coder-execution (engine alert rule + the three status readers) |
| C2 | A blocked seal tells the operator to "start recovery for the session"; no screen offers that action (web dialog, Monitor, Dashboard, tablet / phone Finalizing, Home, Sessions). I ran it through the API (op 33) | G75d-02 | coder-execution (web session monitor, mobile finalizing) |
| C3 | Web Dashboard ring says "SYSTEM READY ... ready for recording" while sealing is blocked and no session can be started | G75d-03 | coder-execution (web dashboard) |
| C4 | The web seal dialog at the UNSEALABLE end: title "Finalizing evidence", "0% complete", "Resumed after restart" (false) | G75d-04 | coder-execution (web session monitor) |
| C5 | A3 not met on the web: Monitor "Recording Profile: Standard (1080p / 25 fps)" beside recordings whose manifest states `H264_720P30`; camera tiles still "Dual-lens IP camera DL-2" for a generated source | G75d-05, G75d-06 | coder-execution (web); `session.input.profileId` is ruled "next task" by D224 (5) |
| C6 | "Synthetic demo values" chip: present on ONE block (System > About / Identity); the appliance-model blocks of Devices, Storage, Network & Time carry no such chip | G75d-07 | controller (D224 (3) says they "stay under" it) |
| C7 | NOT PROVEN live: the start-refusal sentence (`SESSION_KEY_NOT_OF_SESSION` at start; the rig does not drive it); G75c-06 on lane 1 (lane 1 has no device, so no simulated session can record); tablet Settings > About TPM row (not looked at) | - | controller: accept the tests / schedule with the final re-check |

G75c-02 (mount warnings) is a ruled limit (D224 (2)); the counts are in section 4.6.

### Row 81 (M6): PASS WITH CONDITIONS

Every finding 11b handed to wave K that I was asked to re-drive is closed: G81b-01, -02, -03, -04,
-05, -06, -08, -09 (b); G81b-07 is closed as a defect (the false role sentence is gone) with one
note (G81c-01). What stays are 11b's own conditions, which this re-check was not asked to drive
and did not: **R1** server backend live (user's rule), **R2** `M6-KR-1` form (a), a Core kill while
the engine decodes (controller), **R3** `PARTIAL`, `LABELLED`, a no-speech session (controller).
No new finding of severity MINOR or above in the M6 subject.

## 2. Start state (04:15)

| Item | Read |
|---|---|
| Lanes | 1 RUNNING PID 52989 (SIMULATED), 2 RUNNING PID 55401 (REAL_DEVELOPMENT); both `ready {database, engine}`; seal rig OFF |
| Lane 2 | `session/current` = `SES-20261011-0037` SEALED; selector `CAM-01` / `CAM-02` `H264_720P30`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; 26 items; 18 alerts, none active; audit chain `ok`, 572 rows before my sign-ins |
| Devices | both awake, no keyguard, Login, "Core online", "paired as DEV-0001" (tablet) / "DEV-0002" (phone); reverse rules `tcp:8081 -> 8081`, `tcp:4420 -> 4422` on both |

## 3. Items table

| Item | Surface | Result |
|---|---|---|
| A1 restart fault appears as "Core was not running" | audit, W2 | PASS |
| A1 interrupted seal completes, then exactly one `FAULT_CLEARED`, alert resolved | API, audit | PASS |
| A1 header / tablet Home / phone Home not CRITICAL, no "Recording Blocked" | W2, T, P | PASS |
| A1 a new session records and seals | T, W2, API | PASS |
| A1 second clean restart raises nothing | audit, log | PASS |
| A2 blocked: web seal dialog | W2 | PASS |
| A2 blocked: tablet / phone Finalizing | T, P | PASS |
| A2 blocked: Home / Sessions "Sealing blocked", New Session explains | T, P | PASS |
| A2 blocked: header pill critical; mobile Home ring critical | W2, T, P | PASS (Dashboard ring: G75d-03) |
| A2 release -> the product's own retry seals, surfaces normal, alert resolved, verify PASS | API, W2, T, P | PASS through op 33 by API; no UI control (G75d-02) |
| A2 unsealable: ends UNSEALABLE, quarantine, surfaces say so, new session possible | API, FILE, W2, T, P | PASS with G75d-01, G75d-04 |
| A2 rig released, `status` OFF | lane | PASS |
| A2 start-refusal sentence | - | NOT PROVEN live (tests cited) |
| A3 manifest `H264_720P30` on both tracks, no `STREAM_PROFILE_DIFFERS` | FILE, API | PASS (five new packages) |
| A3 clients show what the manifest says | W2, T | tablet PASS; web FAIL (G75d-05) |
| A3 web camera tiles no "Dual-lens IP camera DL-2" | W2 | FAIL (G75d-06) |
| A4 lane 2: no DEMO key name, no TPM residence / attestation, no "RTC holdover", no invented write speed; the signing key shown is the packages' key | W2 | PASS |
| A4 blocks under the "Synthetic demo values" chip | W2 | listed; chip on one block only (G75d-07) |
| A4 lane 1 unchanged | W1 | PASS |
| A5 G75c-05 no time-left line during "Finalize transcript" | W2 (T, P by picture) | PASS |
| A5 G75c-06 one truthful timeline row per capture fault | W2 lane 2 | PASS (two faults); lane 1: NOT PROVEN live |
| A5 G75c-07 tablet while CONNECTING | T | PASS |
| A5 G75c-08 no error-level line through a healthy seal and after a graceful stop | log | PASS |
| A5 G75c-09 `SUMMARY_ACKNOWLEDGED` from the tablet carries `DEV-0001` | audit | PASS |
| A5 G81b-03 Summary: "Done", "View in Evidence", a "Sealed files" row | T, P | PASS |
| A6 B9 zero app ERROR lines | logcat T, P | PASS; mount warnings counted |
| B1 G81b-01 op 85 with a false `from` | API | PASS |
| B1 a correct revision from the web UI | W2 | PASS |
| B1 planted revision 4 of `EV-20261010-0020` still verifies | API | PASS |
| B2 G81b-02 operator change on the tablet, both orders | T, audit | PASS |
| B2 G81b-07 sentence | T | role sentence gone; the neutral sentence, not the case-scope one (G81c-01) |
| B3 G81b-04 `intervals_incomplete` on an interrupted item made after wave K | FILE | PASS (two items; two clean controls without it) |
| B4 G81b-05 no pending sentence with no session open | API, W2, T | PASS |
| B4 G81b-06 transcript model block | W2, T, P | PASS |
| B4 G81b-09 revision reason in the list | W2, T | PASS |
| B4 G81b-08 Session Live clock fully visible | T | PASS |

## 4. Section A - row 75

### 4.1 A1 - G75c-01: `SES-20261011-0038` -> `EV-20261011-0027`

Session started through the API (web actor), `RECORDING` and durable at 04:18:26.
`scripts/lane/lane.sh stop 2` at 04:18:48 (exit 0, "lane 2 stopped (was PID 55401)"); the Core log
was copied before the start (`core_lane2_run0.log`: `lane.sh start` starts the log anew);
`start 2 --with-camera-stub --speech-mic` at 04:18:54, output to a 0600 file, not piped (exit 0,
ready 04:18:56, **PID 59263**, seal rig "says: OFF", new stub ports and a new fixture account,
neither read).

| Check | Surface | Result | Evidence |
|---|---|---|---|
| The fault's name | audit, W2 | PASS | seq 581 `FAULT_RAISED` "The Core was not running while this session was active. It does not know why it stopped." `{kind POWER_FAIL, coreNotRunning true, fromState RECORDING}`; W2 header "CRITICAL / Critical fault: Core was not running", timeline ONE row "Fault Detected / Core was not running" (`l2_A1_web.log` 04:18:57). 0 "Power fail" on any surface |
| The interrupted seal completes | API | PASS | `FINALIZING` at 04:18:56, `SEALED` 04:19:25.510; op 83 `resumed true`; op 40 `interrupted true`; verify `PASS` 15 of 15; manifest `tracks[].profile` `H264_720P30` twice |
| THEN the fault ends: exactly one `FAULT_CLEARED` | audit | **PASS** | seq 582 `SYSTEM_BOOT`, 583 `RECOVERY_STARTED`, 584 `TABLET_LINK_CHANGED` connected, 585 `EVIDENCE_SEALED`, 586 `RECOVERY_COMPLETED`, **587 `FAULT_CLEARED`** "The Core is running again — the fault of the time it was not running is cleared" `{kind POWER_FAIL, coreNotRunning true}`. One row; none later (chain read to seq 653) |
| The alert resolved | API | PASS | `ALR-000039` CRITICAL `POWER_FAIL`: `active false`, `resolvedAt` 04:19:25.6; active alerts `[]` |
| Web header | W2 | PASS | CRITICAL from 04:18:57.4 to 04:19:25.6, then "SECURE / All systems operational" in the same sample as the sealed dialog, no action taken |
| Tablet Home / phone Home | T, P | PASS | both moved by themselves to the Summary of the interrupted session (`t_A1_02`, `p_A1_02`); phone "Done" -> Home "Ready for Recording / All systems operational"; tablet Home `READY`, "Ready for Recording", "Start Session" (`t_A1_03`). No "Recording Blocked", no CRITICAL |
| A NEW session records and seals | T, W2, API | PASS | `SES-20261011-0039` from the tablet (rows seq 600-603 carry `DEV-0001`) -> `EV-20261011-0028`, sealed 11.1 s after the stop, verify `PASS` 15 of 15, no alert left active |
| Second clean restart, no session active | lane, audit, log | PASS | 08:54:37 `stop 2` (exit 0, was PID 59263) / 08:54:42 start (exit 0, **PID 70017**, rig OFF); engine line `session SEALED, restartFault null, restartFaultEnded false, auditRows 0`; rows: seq 642 `SYSTEM_BOOT`, 643 `TABLET_LINK_CHANGED` connected, nothing else; no new alert; 0 error-level lines in the new log |
| The graceful stop itself | log | PASS | `core_lane2_run0.log`, 378 lines, 0 at level 50; last lines `CAPTURE_SESSION_SHUT_DOWN` (warn), "pipeline closed", "shutdown complete". No `MIRROR_WRITE_FAILED` (G75c-08, second half) |

While the Core was down both devices drew the last state received with the chip "Core Offline"
(`t_A1_01`, `p_A1_01`: "RECORDING / Session in progress / REC 00:00:31" beside "Core Offline").
The web said "Core server unreachable / The screen shows the last state received." The interrupted
item's sentence still prints the code: "The recording ended at a fault (POWER_FAIL) before it was
stopped." (known, G75c-03, next task).

### 4.2 A2 - the blocked seal: `SES-20261011-0040` -> `EV-20261011-0029`

`lane.sh seal-rig 2 blocked` ("BLOCKED"), session through the API, recorded 45.4 s, stopped
08:30:12 with a reason.

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Retries | W2, T, API | PASS | W2 08:30:12 "SEALING RETRIED / Sealing is being retried (retry 1 of 3, in 5 s). The Core's key store cannot be used: the seal stopped and can be tried again. / The recording is kept on the Core. / You can close this window."; retry 2 at 08:30:17 ("in 30 s"), retry 3 at 08:30:47 ("in 120 s"); T the same sentence with "Go to Home" (`t_A2_01`); op 83 `CLOSE_TRACKS error`, `etaMs null` |
| Blocked at t + 155 s | API | PASS | 08:32:47 `ALR-000046` CRITICAL `{reason SEAL_BLOCKED, detail SESSION_KEY_STORE_UNAVAILABLE, step CLOSE_TRACKS}` active; session stays `FINALIZING` |
| Web seal dialog | W2 | PASS | `w2_A2_01`: "Sealing is blocked / Session SES-20261011-0040", the cause sentence, "The Core's key store cannot be used.", what to check, "The Core records no new session until this one is sealed.", "The recording is kept on the Core.", "What you can do: tell the administrator of this Core.", "You can close this window."; steps "1/6: Fault", the rest Pending. No percentage, no "Resumed after restart". "Close" closed it (0 dialogs after) |
| Monitor banner, header pill | W2 | PASS | banner "SEALING BLOCKED" + the sentence; header "CRITICAL / Sealing is blocked"; Dashboard card "ACTIVE SESSION / Sealing blocked / SES-..." with "Open Session Monitor" and no "Start New Session" (`w2_A2_03`) |
| Tablet / phone Finalizing | T, P | PASS | `t_A2_02`, `p_A2_02`: "Sealing is blocked", the same facts, "The recording is kept on the Core.", "A technician or the administrator of the Core has to resolve the cause on the Core.", "You can leave this screen ... Home and Sessions show it as 'Sealing blocked'.", "Go to Home"; step 1 red; no percentage |
| Home | T, P | PASS | ring CRITICAL, "Sealing blocked / SES-20261011-0040 · The recording is kept on the Core.", action "Sealing blocked: view", and under it "A new session cannot be started: sealing of session SES-20261011-0040 is blocked, and the Core records no new session until it is sealed. The recording is kept on the Core." (`t_A2_03`; phone view tree) |
| Sessions | T | PASS | chip "Sealing blocked", "Sealing of this session is blocked. The recording is kept on the Core.", "Start New Session" disabled with the same reason, row status "Sealing blocked" (`t_A2_04`) |
| Release, then the product's own retry | lane, API | PASS by API | `seal-rig 2 release` ("OFF") at 08:34:41; the session stayed blocked (as specified: no automatic retry after t + 155 s). `POST session/{id}/recover` (op 33) at 08:34:47 -> 202; seq 612 `RECOVERY_STARTED` "Sealing of session ... is run again on demand (SEALER_FAILED)" `{reason SEAL_RETRY}`; `SEALED` 08:34:47.881; verify `PASS` 15 of 15, `interrupted false`. **No screen offered the action: G75d-02** |
| Back to normal | W2, T, P, API | PASS | `ALR-000046` `active false`; W2 header "SECURE" at 08:34:48.1, dialog "Evidence sealed / 100% complete / SEALED"; tablet and phone on the session's Summary; Home `READY`. "Resumed after restart" on no surface (`grep` over the five web logs of that time: 0), though op 83 answers `resumed true` for this retry without a restart (note, G75d-09) |

### 4.3 A2 - the unsealable case: `SES-20261011-0041` (no item)

`seal-rig 2 unsealable`, session started on the tablet, recorded 45.5 s, stopped through the API
at 08:37:50.

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Three attempts, then the terminal end | W2, audit | PASS | retry 1 at 08:37:50, retry 2 at 08:37:55, the last attempt 08:38:25; seq 620 `SESSION_INCOMPLETE` "... could not be sealed (SESSION_KEY_NOT_OF_SESSION): ended INCOMPLE..." `{reason UNSEALABLE, cause SESSION_KEY_NOT_OF_SESSION, quarantinedFiles 5}`; `session/current` = none |
| Quarantine | FILE (path and size only) | PASS | `.data/media/dems_lane_2/sessions/.quarantine/SES-20261011-0041/`, 5 files, 49,476 KiB; no `SESSION-SES-20261011-0041` folder in the store. Nothing in it was opened |
| Surfaces say so | W2, T, P | PASS, with findings | T and P Finalizing: "This recording could not be sealed. Its files were kept in quarantine on the Core. (SESSION_KEY_NOT_OF_SESSION)" above "No finalization in progress / Go to Home" (`t_A2_06`; phone view tree); W2 dialog the same sentence (G75d-04 for the rest of that dialog); bell "LATEST ALERTS" the sentence; tablet Sessions row "Incomplete" (`t_A2_08`). At rest: G75d-01 |
| The lane can start a new session | T, API | PASS | `SES-20261011-0042` created on the tablet 2 minutes later, pre-check 8 of 8, recorded, sealed (4.5) |
| Rig released | lane | PASS | `seal-rig 2 release`, `status`: OFF (read again at 08:54 and 08:56) |
| One CRITICAL alert | API | as built | `ALR-000049` CRITICAL `{reason UNSEALABLE, cause SESSION_KEY_NOT_OF_SESSION}` - still `active` at the end (G75d-01) |

START refusal sentence (`SESSION_KEY_NOT_OF_SESSION` at op "start"): the rig acts at the seal only
(contract S1 section 2, last sentence), so it was NOT driven. Tests, by name, not run by me:
`apps/core-server/src/sealing-host/__tests__/wave-i-a1-session-key.test.ts`,
`packages/shared/test/sim-pass-j.test.ts`; note 135 says the rendered toast has no test.

### 4.4 A3 - what the recording is said to be

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Manifest field 36 | FILE | PASS | `session-manifest.json` of `SES-20261011-0038`, `-0039`, `-0040`, `-0042`: `tracks[].profile` = `H264_720P30` on VIDEO-01 and VIDEO-02 |
| No `STREAM_PROFILE_DIFFERS` | API | PASS | 28 alerts on lane 2; the only one with that reason is `ALR-000033` of `SES-20261011-0036` (sealed before fix 151) |
| Tablet Session Live | T | PASS | no "1080p • 25 fps" chip on the feed of a real recording (`t_B4_01`) |
| Web Monitor, session details | W2 | **FAIL** | "Recording Profile / Standard (1080p / 25 fps)" for `SES-20261011-0037`, `-0040`, `-0042` (`w2_A4_session.txt` line 63; DOM at 04:17 and 08:33). G75d-05 |
| Web camera tiles | W2 | **FAIL** | "Camera 1 · CAM-01 · Dual-lens IP camera DL-2" on the Dashboard tiles, the Monitor feed tile, the Devices tiles, and the selector line ("VIDEO-01 · CAM-01 · Dual-lens IP camera DL-2 · Profile H264_720P30"); summary "Dual-lens DL-2 on PoE CAM 1". G75d-06 |
| Tablet tiles | T | not judged | "Camera 1 · Camera CAM-01", "Test source" - not read as proof of a track (G70c-01, known) |

The tablet's New Session form and Ready step read "Recording Profile / Profile: Standard (1080p /
25 fps)" - the configured choice before a recording (`session.input.profileId`, D224 (5): next
task).

### 4.5 A4 - what lane 2's web still states (pages read at 08:49; texts kept as `w2_A4_*.txt`)

| Page | Lane 2 reads | Result |
|---|---|---|
| Security & Audit | "Posture: not reported", "1 of 9 controls active, 8 not reported"; TPM 2.0 attestation / Secure Boot / Key custody "This Core does not read a TPM or the Secure Boot state. - Not reported"; Secure timestamp "Host system clock. No time service is configured: nothing is locked and nothing is in holdover."; Enclosure "This Core has no enclosure switch to read."; Signed firmware "This Core reports no firmware signature."; Evidence signing key "DEVELOPMENT KEY / Ed25519 • CORE-KEY-EVSIGN-01 / The key the sealed items of this Core are signed with (newest: EV-20261011-0031)."; Hardware root key "Not reported ... It does not read a TPM." | PASS: no "DEMO-KEY", no "TPM 2.0 (fw", no "never exported", no "RTC holdover". The key named is the one my five packages are signed with (Summary rows, revision answers) |
| Devices | GNSS "No GNSS receiver is configured. The time is the host system clock. - Not configured"; TPM "This Core does not read a TPM or the Secure Boot state. - Not reported"; LCD "HOST CLOCK" | PASS for the two rows |
| Dashboard | "SECURITY, TIME & NETWORK · Platform security: not reported"; TPM / Secure Boot NOT REPORTED; Time HOST CLOCK; Security Posture NOT REPORTED | PASS ("All systems secure" is gone) |
| Storage | "WRITE SPEED / Not reported / This Core does not measure a write speed."; "EST. REMAINING / Not reported / No estimate: this Core does not measure a write speed to compute one from." | PASS |

Blocks of the appliance model that lane 2 still draws, and the chip:

| Page | Block | "Synthetic demo values" chip visible? |
|---|---|---|
| System & Maintenance | ABOUT / IDENTITY (device id, room, model, software release) | **yes** - the only place the text exists on any page (`grep -c` over the seven page texts: system 1, all others 0) |
| Devices | summary "Balanced XLR · 48 V phantom", "PoE · relay · tablet · GNSS · TPM", "OTHER DEVICES 4/5 - 1 issue" beside "ALL DEVICES READY 7/7"; audio inputs "GAIN 32 dB / PHANTOM POWER 48 V ON" and "USB condenser microphone UM-1" for generated microphones; PoE Switch, Recording Indicator "SEDANG MEREKAM / STANDBY", Tablet Control; front panel; port map incl. "GNSS SMA - Link up" beside "No GNSS receiver is configured" | no |
| Storage | volumes and SMART (captioned "SMART values are demo values derived by the console: the Core server does not report them"), retention calculator (captioned "Demo defaults"), storage policy, "Pending 1" | no chip; two captions of their own |
| Network & Time, System (services, update slots) | not read line by line | no chip on Network & Time; System: the one above |
| Security & Audit | "EVIDENCE PACKAGES 12 PASS • 1 FAIL / EV-20261009-0005: AUDIO-02 hash mismatch / DEMO - precomputed" (the lane holds 30 items; op 41 names VIDEO-02 for that item, 08_gate_environment section 4 (c)) | labelled "DEMO - precomputed", no chip - for re-check 89 |

Lane 1 (SIMULATED), read at 08:50: "DEMO-KEY-EVSIGN-01", "Resident in TPM 2.0, never exported",
"9 of 9", "Attestation", "RTC", "WRITE SPEED" with a MB/s figure, "All systems secure",
"TPM 2.0 Verified", "Dual-lens" are all still there (`w1_A4_*.txt`). Unchanged: PASS.

### 4.6 A5 and A6

| Check | Surface | Result | Evidence |
|---|---|---|---|
| G75c-05 | W2 | PASS | seal of `-0039` (`l2_B_seal_web.log`): "This step: about 3 s / 2 s / 1 s left" only during Close tracks and Finalize hashes (the steps the Core measures); from 08:27:49.3 to 08:27:56.4 "Finalize transcript ... 3/6: Active" with NO time-left line. The interrupted seals of `-0038` (29 s in that step) and `-0042`: no such line. Tablet `t_A5_04_finalizing_a` shows "about 1 s left" at Close tracks 85 %; phone `p_A5_04_finalizing_b` (last step) none. The transcript step itself was not caught in a device picture |
| G75c-06, lane 2 | W2 | PASS | worker kill (`l2_E_web.log`): ONE row "Fault Detected / The capture worker process was killed."; Core stop: ONE row "Fault Detected / Core was not running" |
| G75c-06, lane 1 demo fault | W1 | **NOT PROVEN live** | lane 1 has no device: the pre-check of a simulated session ends "Pre-recording checks blocked: Core link offline" (seq 91), start 409. I raised and cleared the demo capture fault with no recording (alert and rows 92, 93 read "The demo control raised a capture fault. The recording is not affected."); no timeline row exists without a recording (`w1_A5_01`). Test: `packages/shared/test/sim-wave-k-s1-timeline-fault.test.ts` (not run by me) |
| G75c-07 Home | T | PASS | `t_A5_07_home_connecting_3` (08:29:28, session started by the API): bar and ring "Connecting cameras... / SYSTEM CONNECTING", header chip "CONNECTING", both microphone tiles "CONNECTING" with no meter and no dBFS, camera tiles "Connecting" (the word is cut by the tile's lower edge) |
| G75c-07 Session Live feed tile | T | PASS, read through a cross-fade | `t_A5_09_live_connecting_3`: Session Live under the fading wizard - title "Connecting cameras...", feed tile "No preview / CAM 1 · Camera CAM-01 / Connecting cameras...", audio cards "CONNECTING" without meters, chips "VIDEO 1 CONNECTING", timeline "No events yet". No "Not reachable". A clean frame was not caught in three tries (the 3-2-1 countdown takes the first 3 s) |
| G75c-08 | log | PASS | lane 2 Core log of PID 59263 (`core_lane2_run1.log`, 2235 lines): 9 error-level lines, all of faults I made - 7 `SEALER_FAILED` (4 blocked + 3 unsealable attempts), 1 `SEALING_SESSION_UNSEALABLE`, 1 `CAPTURE_FAULT` (the kill). 0 `ASSEMBLY_REFUSED` through the healthy seal of `-0039`; after both graceful stops nothing follows "shutdown complete" |
| G75c-09 | audit | PASS | seq 588 `SUMMARY_ACKNOWLEDGED` `DEV-0001` (tablet "View in Evidence"), 605 `DEV-0001` (tablet "Done"), 635 `DEV-0001` (tablet Back); 615 `DEV-0002` (phone "View in Evidence") |
| G81b-03 tablet | T | PASS | Summary of `-0038` scrolled to its end: `summary-actions` and the buttons report their own bounds (y 1432); "Transcript hash" row opened its sheet (`t_A5_02`), "View in Evidence" opened Evidence. FRESH clean session `-0039`: "Done" -> Home (`t_A5_06`) |
| G81b-03 phone | P | PASS | `-0038`: "Done" -> Home. `-0040`: "Transcript hash" row -> sheet with the full value (`p_A5_07`), "View in Evidence" -> the item `EV-20261011-0029` |
| B9 app ERROR lines | logcat | PASS | level E / F lines of the app's process, whole run: tablet 771 "EGLConsumer is not attached to an OpenGL ES context", 136 `EGL_emulation`, 31 `Surface`, 1 `ImeBackDispatcher`; phone 44 / 34 / 25 / 0 - the emulator's graphics layer and the keyboard. `ReactNativeJS`: tablet 218 lines, phone 151, ALL level I. Zero app ERROR lines |

Library mount warnings ("Unable to find SurfaceMountingManager"), counted per flow (ruled limit,
D224 (2); not failed on):

| Flow | Tablet | Phone |
|---|---|---|
| A1 restart, Summary taps (04:17-04:22) | 71 | 0 |
| Tablet session `-0039`, Finalizing, Summary (08:21-08:29) | 218 | 0 |
| A2 blocked rig (08:29-08:36) | 63 | 41 |
| A2 unsealable rig, session from the tablet (08:36-08:40) | 200 | 4 |
| B3 worker kill, session from the tablet (08:40-08:43) | 216 | 6 |
| B2 / B4 evidence, settings, operator change (08:43-08:55) | 269 | 54 |

## 5. Section B - the conditions of row 81

| Check | Surface | Result | Evidence |
|---|---|---|---|
| **B1** false `from` | API | PASS | op 85 on `EV-20261011-0028`, segment 2, `from "not the sealed text"`: **422 `INVALID_INPUT`, `details.reason REVISION_FROM_NOT_CURRENT_TEXT`, `segmentIndex 2`, `currentRevision 0`**, message "A change does not start from the current text of its segment. Read the transcript again and repeat the correction." Audit chain before and after: 631 rows, the same head; op 86 0 items; op 40 `transcript.revision 0`. No `TRANSCRIPT_REVISED` row |
| B1 correct revision from the web | W2 | PASS | "Revise" on segment 0 of the same item, text and reason typed, "Sign and append" -> 201 `TRV-000001`, toast "Revision 1 appended", list "Revision 1 by AKP Andi Pratama · based on the sealed original · Signed by the Core key CORE-KEY-EVSIGN-01 / Reason: Gate 75d: correct revision from the web" (`w2_B1_01`); seq 633; verify after it `PASS` 15 of 15 |
| B1 planted revision | API | PASS | `EV-20261010-0020`: verify `PASS` 15 of 15, V-10 and V-11 PASS, notices `AUDIT_EXTRACT_NOT_SIGNED` only; op 86 four items, each with `reason` |
| **B2** A then B | T, audit | PASS | investigator (holder) opened `EV-20261011-0029` and its transcript, signed out (seq 638); technician signed in (639) and opened the same item first: "You are not permitted to play this recording." and ONE line "You are not permitted to read this transcript." (`t_B2_01`). **Rows written by that view: none** (next row is the technician's sign-out, 640) |
| B2 B then A | T, audit | PASS | technician out (640), investigator in (641), same item: "Transcript", segments with "Revise" (`t_B2_02`); no denial row |
| B2 the sentence | T | role sentence gone | the red "Your role cannot read this transcript." of 11b is not drawn. The case-scope sentence ("You are not assigned to the case of this item ...") is not drawn either: op 40 already answers `access.readTranscript false`, the pane then asks nothing and draws the neutral sentence (note 143: "a caller operation 40 refused gets ONE sentence"). G81c-01 |
| **B3** | FILE | PASS | `transcript.json` of `SES-20261011-0042` (worker killed at 26 s; `EV-20261011-0031`): `qa_flags ["intervals_incomplete", "speaker labels unavailable"]`, `intervals [{MIC-01, from_ms 21, to_ms null}]`, `ASSEMBLED`, 6 segments. The same flag on `SES-20261011-0038` (Core stop). Controls: `-0039` and `-0040` (stopped): no such flag, closed interval |
| **B4** G81b-05 | API, W2, T | PASS | no session open; op 91 saved twice (labelling off, then on): 200, **`appliesFrom NOW`, `pendingForNextSession false`**; op 90 after it `false`. W2 Transcription (STT) section: no "A saved change is waiting" banner (`w2_B4_01`; the section's fixed intro "A change applies to the next session." is not that banner). T Transcription status: no "Changed — applies to the next session" note (`t_B4_04`) |
| G81b-06 | W2, T, P | PASS | "Transcript model / Name ggml-large-v3-turbo / Version (declared by the installation) large-v3-turbo / Quantisation f16 / Model file SHA-256 1fc70f77…e2bc69" on W2 (`EV-20261010-0020`, `EV-20261011-0028`), T (`t_B4_05`), P (`p_B4_01`, `EV-20261011-0031`) |
| G81b-09 (b) | W2, T | PASS | "Reason: ..." under each of the four revisions of `EV-20261010-0020` on W2 (as the supervisor) and T (as the investigator, `t_B4_06`), from op 86's own `reason` |
| G81b-08 | T | PASS | `t_B4_01` during the recording of `-0039`: "Recording / 00:02:02" fully visible in its own card above AUDIO MONITOR |

## 6. Findings

| ID | Severity | What | Steps / evidence | Spec / ruling |
|---|---|---|---|---|
| **G75d-01** | MINOR by my rating - **ruling asked** (section 1, C1) | After a session ends UNSEALABLE, `ALR-000049` (CRITICAL) stays `active`: through the next recorded and sealed session, an acknowledgement (204 -> `acknowledged true, active true`) and a restart of the Core. I know of no product action that ends it. Meanwhile web header "SECURE / All systems operational", Dashboard "SYSTEM READY / OPERATIONAL • NO FAULT REPORTED" (with "1 active alert" under Security Posture), tablet Home "READY / SECURE • HEALTHY • OPERATIONAL / All systems operational" with a "1" on the bell, phone Home the same; Recent Sessions lists `SES-20261011-0041` with no word; Sessions row "Incomplete" without the quarantine | 4.3; `t_A2_09`, `t_A2_07`, `t_A2_08`, `w2_A2_05`; `w2_A4_dashboard.txt` | contract S1 section 2 says only "one CRITICAL alert"; D220 on G75c-01: a state on an evidence device that no action ends is not cosmetic. For the blocked seal the same readers DO go CRITICAL through the alert |
| **G75d-02** | MINOR | The blocked seal names an action no screen offers. Web dialog / banner / Dashboard card: "Sealing will be tried again when the Core starts, or by the recovery action"; alert, tablet, phone: "then start recovery for the session or restart the Core". Controls on the Monitor in that state: none of them recovery (list read from the DOM; `status-banner.tsx:146` offers it for `FAULT` only); tablet / phone Finalizing: "Go to Home" only. After `release` the session stayed blocked until I sent op 33 through the API | 4.2 | contract S1 section 2: "the recovery action of the session (web / tablet 'recover' on a FAILED sealing step)" |
| **G75d-03** | MINOR | Web Dashboard ring during a blocked seal: "SYSTEM READY / OPERATIONAL • NO FAULT REPORTED / All core services are running and the system is ready for recording." beside the header's "CRITICAL / Sealing is blocked" and the card "Sealing blocked"; no session can be started | `w2_A2_03` | the mobile Home ring reads CRITICAL in the same state |
| **G75d-04** | MINOR | The web seal dialog at the UNSEALABLE end reads "Finalizing evidence / Session ... / This recording could not be sealed. ... (SESSION_KEY_NOT_OF_SESSION) / 0% complete / **Resumed after restart** / Close" - nothing is being finalized, nothing was restarted. During its retries the dialog says "Sealing is being retried (retry n of 3 ...)" and, in the same sentence, "this session cannot be sealed". Tablet and phone print the code in brackets as well | `w2_A2_04`; `l2_D_web.log` | task A2 for the blocked dialog: no percentage, no "Resumed after restart"; wording rule: no code as a sentence |
| **G75d-05** | MINOR (the client half of G89b-01; `profileId` ruled "next task", D224 (5)) | Web Monitor > Session Details reads "Recording Profile / Standard (1080p / 25 fps)" for sealed sessions whose manifest states `H264_720P30`. The web's relabel to "Configured profile" hangs on the `STREAM_PROFILE_DIFFERS` notice (`session-monitor/sim-adapter.ts:119-130`); since the selector was corrected and fix 151 landed, no session carries the notice, so the 1080p label is back as a fact of the recording | 4.4 | contract S1 section 3 client rule; task A3 |
| **G75d-06** | MINOR | Web camera tiles of generated sources still name a product: "CAM-01 · Dual-lens IP camera DL-2" (Dashboard, Monitor feed, Devices tiles, selector lines and options), "Dual-lens DL-2 on PoE CAM 1"; microphones "USB condenser microphone UM-1", "Balanced XLR · 48 V phantom", "GAIN 32 dB / PHANTOM POWER 48 V ON" | 4.4, 4.5; `w2_A4_devices.txt`, `w2_A4_dashboard.txt` | note 141 D-1 lists "a camera model of the dataset" as changed; task A3 |
| **G75d-07** | MINOR (ruling D224 (3) not met as worded) | The "Synthetic demo values" chip exists on one block (System > About / Identity). The appliance-model blocks of Devices (PoE, relay lamp, tablet link, front panel, port map, input gain / phantom) and Network & Time have no chip; Storage has two captions of its own. Contradictions inside those blocks on lane 2: "OTHER DEVICES 4/5 - 1 issue" beside "ALL DEVICES READY 7/7"; "GNSS SMA - Link up" beside "No GNSS receiver is configured" | 4.5 | D224 (3) |
| G75d-08 | NOTE (known: G75c-10 (b), next task) | After the worker kill the tablet stood on "Session recovery / Session interrupted: Capture fault / Start recovery / Recovery closes the session as incomplete. It never seals it." 8 s after the kill, while the Core was sealing (sealed 9.3 s after the kill). Not a flash at that length; the button was not pressed | `t_B3_02` | - |
| G75d-09 | NOTE | (a) op 83 answers `resumed true` for the on-demand retry of a blocked seal (no restart happened); no client draws it. (b) The quarantined session's history row states `sizeBytes` 103,693,556 while its quarantine folder holds 49,476 KiB (the simulator's size formula, seen at 10c). (c) `EV-20261011-0030` was reserved for the unsealable session and exists nowhere; Storage > Recent activity still lists "Finalization started / EV-20261011-0030". (d) The tablet Home clock shows "hh:mm:00" in every picture and view-tree read of this run (04:17:00, 08:20:00, 08:29:00, 08:33:00, 08:44:00) - seconds that do not run, with `motion=off`; the web clock runs. (e) Dashboard "Manifest hash · NO MEDIA PACKAGE" on a real sealed item (G75c-11, for re-check 89). (f) Security & Audit "EV-20261009-0005: AUDIO-02 hash mismatch / DEMO - precomputed" against op 41's VIDEO-02 (for re-check 89). (g) Boot warns `SEALING_QUARANTINE_HOLDS_SESSIONS` since the quarantine exists | sections 4.2-4.5 | - |
| G81c-01 | NOTE | The case-scope sentence of fix M2 ("You are not assigned to the case of this item, so its transcript is not shown.") is not reachable on the tablet path I drove: the pane draws the neutral "You are not permitted to read this transcript." because op 40 refused first. The false role sentence is gone, which was the defect. The case-scope sentence rests on `apps/mobile/src/features/evidence/wave-k-m2-operator-export.test.tsx` ("a case-scope refusal") | 5, B2 | task B2 expected the case-scope sentence |

Known findings met again, not re-reported: G70c-01 (tablet tiles), G75c-03 (the `POWER_FAIL` /
`CAPTURE_FAULT` cause words on the interrupted notice), G75-12 ("CONNECTING CAMERAS… / Recording.
The first fragment is durable" for about 190 ms on the web).

## 7. Which findings of 10c and 11b are now closed

| Finding | State |
|---|---|
| G75c-01 (MAJOR) | **closed** (4.1) |
| G75b-02 blocked seal not stated (MAJOR at 10b, not provable at 10c) | **closed live** (4.2); leaves G75d-02, -03 |
| G75c-02 | ruled limit D224 (2); counts in 4.6 |
| G75c-03 | open, next task (`CORE_STOPPED`) |
| G75c-04 | closed for every sentence it named; G75d-06, -07 list what is left |
| G75c-05, -08, -09 | closed |
| G75c-06 | closed on lane 2 live; lane 1 by test only |
| G75c-07 | closed |
| G75c-10 | (a) the sealing notice now reads "The recording was interrupted. ... The Core is sealing the recording up to the interruption." until SEALED (web, 4.1 and B3); (b) open, G75d-08 |
| G81b-01, -02, -03, -04, -05, -06, -08, -09 (b) | **closed** |
| G81b-07 | closed as a defect; G81c-01 |
| G81b-09 (a), (c), (d); G81b-10 | not in this re-check |

## 8. Skipped / user-attended

| Item | Reason |
|---|---|
| Biometric sign-in | skipped by the user's instruction (D151); the offer answered "Not now" at every sign-in (tablet 4 times, phone 2); never passed |
| Local devices, the local-device notice, attendance variables | not part of a flow here; never selected or set |
| Playback on any surface | not needed by an item; nothing was played. The device volume command of note 08 (`cmd media_session volume --stream 3 --set 0`) did NOT take (read back 4 and 5): a re-check that plays on a device must find another way first |
| Camera search, stub, `CAM-04` / `CAM-05` | not touched |
| Server STT backend, port 8000 | not touched (R1 of 11b) |

## 9. Not covered, and why

1. The start-refusal sentence live (4.3); G75c-06 on lane 1 live (4.6); tablet Settings > About TPM
   row.
2. The Summary's controls with the app launched WITHOUT `motion=off` (note 142 re-drive 1).
3. The transcript step in a DEVICE picture (the web's sampler has it); a clean Session Live frame
   while connecting.
4. 11b's R1, R2, R3; everything 10c section 8 items 3 and 4 list (a Core stop in other states,
   situation C, degraded start on real capture, `M5-SEC-SRC-1`).
5. No test file was run by me; the suites are mapped by `test/10_precommit_wave_k.md` (D226), and
   the whole suites were not re-run after `implementation/149` - 151 (row 95 runs them).
6. `masterplan/02_plan.md` and `implementation/99_implementation_report.md`: the task asked for
   this one file and nothing else under `docs/`.

Lapses of mine, for the record:
(a) the 3 h 53 min standstill (above);
(b) the tablet session `-0039` recorded 327.8 s, not 45-60 s: two of my commands waited on a
background sampler and on `uiautomator` (which hangs while Session Live animates), so the stop came
late; the item is 334 MB;
(c) after the expiry I typed a subject name into the tablet's Login user-name field (removed), and
on the phone a mistyped sign-in left the seed sign-in strings in the user-name field; one scratch
read of the view tree printed that field's content into my own tool output. It is in no file, no
screenshot and not in this report; the field was cleared and the read was replaced by one that
hides field values;
(d) my first tap on the phone's "Sealed files" row landed under the sticky header and the Back key
that followed left the Summary: the phone's row and "View in Evidence" were driven on the next
session instead;
(e) lane 1: one session created, blocked at pre-check and cancelled, one demo fault raised and
cleared (rows 90-94).

## 10. Screenshots (`.cache/gates/75d/`)

Read by me as pictures:

| File | Shows |
|---|---|
| `t_00_home.png` | tablet Home under the biometric offer; READY, "No preview" tiles, Recent Sessions |
| `p_00_home.png` | phone Home under the biometric offer; "Ready for Recording" |
| `t_A1_01_after_start.png` | tablet Home just after the start: last state "RECORDING / REC 00:00:31" with the chip "Core Offline" |
| `p_A1_01_after_start.png` | phone Home at the same moment: "Session in progress", chip "Core Offline" |
| `t_A1_02_home_after_seal.png` | tablet Summary of `-0038`: chip "Interrupted", "Sealed — recording was interrupted", the POWER_FAIL sentence, "Sealed 36.0 s after the recording ended", time chips "Host system clock" |
| `p_A1_02_home_after_seal.png` | phone Summary of the same session with "Done" / "View in Evidence" |
| `t_A5_01_summary_end.png` | tablet Summary scrolled to its end: "Sealed files" rows, development-key line, "Done", "View in Evidence" |
| `t_A5_03_live_connecting.png` | the 3-2-1 countdown over the Ready step ("Recording starts in 3"), not the connecting state |
| `p_A5_03_home_connecting.png` | phone Home during that countdown: "Ready for Recording", "Continue setup" |
| `t_B4_01_live_recording.png` | tablet Session Live of `-0039`: clock 00:02:02 fully visible, meters, "91 fragments saved", no format chip, chip "TIME Host system clock" |
| `t_A5_04_finalizing_a.png` | tablet Finalizing: "14% complete / This step: about 1 s left", Close tracks 85 %, recording length 00:05:27 |
| `p_A5_04_finalizing_b.png` | phone Finalizing: 83 %, five steps done with their times, the sixth running, no time-left line |
| `t_A5_07_home_connecting_3.png` | tablet Home while connecting: chip "CONNECTING", ring "SYSTEM CONNECTING", microphone tiles "CONNECTING" without meters |
| `t_A2_01_finalizing_retry.png` | tablet "Sealing is being retried (retry 2 of 3, in 30 s) ... The recording is kept on the Core.", "Go to Home", step 1 red |
| `t_A2_02_finalizing_blocked.png` | tablet "Sealing is blocked" with the cause, what to check, "The recording is kept on the Core.", "Go to Home" |
| `p_A2_02_finalizing_blocked.png` | the same on the phone |
| `w2_A2_01_seal_dialog_blocked.png` | web dialog "Sealing is blocked", the sentences, "Close tracks" red, "Close" |
| `t_A2_03_home_blocked.png` | tablet Home: chip and ring CRITICAL, "Sealing blocked / SES-20261011-0040 · The recording is kept on the Core.", "Sealing blocked: view", the New Session sentence |
| `w2_A2_03_dashboard_blocked.png` | web Dashboard: header "CRITICAL / Sealing is blocked", card "Sealing blocked", ring "SYSTEM READY / OPERATIONAL • NO FAULT REPORTED" |
| `p_A5_07_sealed_row_sheet.png` | phone Summary of `-0040` with the sheet "Transcript hash" and the full value |
| `t_A2_06_unsealable_end.png` | tablet: the quarantine sentence with its code above "No finalization in progress / Go to Home" |
| `w2_A2_04_unsealable_dialog.png` | web dialog "Finalizing evidence", the quarantine sentence, "0% complete", "Resumed after restart" |
| `t_A2_09_home_ready_with_unsealable_alert.png` | tablet Home READY, "SECURE • HEALTHY • OPERATIONAL", bell "1", Recent Sessions with `SES-20261011-0041` |
| `t_A5_09_live_connecting_3.png` | cross-fade: Session Live "Connecting cameras...", feed tile "Connecting cameras...", cards CONNECTING, under the fading wizard ("Starting...") |
| `t_B3_02_finalizing_interrupted.png` | tablet "Session recovery / Session interrupted: Capture fault / Start recovery" 8 s after the kill |
| `t_B2_01_technician_item0029.png` | tablet as the technician: "You are not permitted to play this recording." and one line "You are not permitted to read this transcript."; Play and Export dimmed |
| `t_B4_05_item0020_model.png` | tablet `EV-20261010-0020`: "Transcript model" block with four lines, chips, a revision block under segment 1 |
| `p_B4_01_item0031_model.png` | phone `EV-20261011-0031`: the same block, "Transcript assembled", segments with "Revise" |

Taken, NOT read as pictures (their text was read from the DOM or the view tree):
`t_A1_03_home`, `t_A5_02_sealed_row_sheet`, `t_A5_04_finalizing_b`, `t_A5_05_summary_clean`,
`t_A5_06_summary_clean_end`, `t_A2_04_sessions_blocked`, `t_A2_05_unsealable_retry`,
`t_A2_07_home_after_unsealable`, `t_A2_08_sessions_after_unsealable`, `t_B2_02_investigator_after_technician`,
`t_B3_01_after_kill`, `t_B4_03_item_transcript_A`, `t_B4_04_stt_status`, `t_B4_06_item0020_revisions`,
`p_A2_01_finalizing_retry`, `p_A2_03_home_blocked`, `p_A2_06_unsealable_end`, `p_A5_04_finalizing_a`,
`p_A5_05_summary_clean`, `p_A5_06_summary_sealed_files`, `p_B_home_recording`,
`w2_A2_02_monitor_blocked`, `w2_A2_05_unsealable_bell`, `w2_B1_01_revision_appended`,
`w2_B4_01_stt_section`, `w1_A5_01_demo_capture_fault` (lane 1 Monitor in SESSION SETUP, no
recording), and the fourteen page pictures `w2_A4_*.png` / `w1_A4_*.png` (their texts are the
`*_A4_*.txt` files).

Other files there: the web sampler logs `l2_A1_web`, `l2_B_web`, `l2_B_seal_web`, `l2_C_web`,
`l2_C2_web`, `l2_D_web`, `l2_E_web`; `core_lane2_run0.log`, `core_lane2_run1.log`;
`logcat_emulator-5556.txt`, `logcat_emulator-5554.txt`; `start_2a.log`, `start_2b.log` (0600),
`stop_2a.log`, `stop_2b.log`; `audit_l2.json`; my scratch scripts.

## 11. Environment as left - what re-checks 89 and 94 inherit

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 52989 (never restarted). **2 RUNNING PID 70017 - restarted twice by me**: 04:18:48 / 04:18:54 (PID 59263, A1, with a session recording) and 08:54:37 / 08:54:42 (PID 70017, no session active). No reset. Web 5176 / 5177, Metro, PostgreSQL untouched |
| Lane 2 stub | new ports and a NEW fixture account at each start (not read by me); every earlier account is dead; preset not touched |
| Seal rig | **OFF** (`status` read at 08:56); installed again by the last start |
| Lane 2 selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, both `H264_720P30`; `MIC-01` PRIMARY, `MIC-02` STANDBY; `locked false` - never changed |
| Lane 2 session | none open; `session/current` = `SES-20261011-0042` SEALED, summary acknowledged. Next session `SES-20261011-0043`; next item `EV-20261011-0032` |
| **Lane 2 alert** | **`ALR-000049` CRITICAL `UNSEALABLE` (`SES-20261011-0041`) is ACTIVE and acknowledged** - raised by this re-check; I found no product action that ends it (G75d-01). Surfaces read SECURE / READY all the same; bell "1". All other alerts of this run are resolved (28 alerts in all) |
| **Lane 2 quarantine** | `.data/media/dems_lane_2/sessions/.quarantine/SES-20261011-0041/` (5 files, 49,476 KiB). A later reset of lane 2 needs `--discard-unsealed-fake-recordings`; the boot warns `SEALING_QUARANTINE_HOLDS_SESSIONS` |
| Lane 2 audit | chain `ok`, 653 rows, head `d07d51095daa112d…` at 08:56, then my last sign-out (654) |
| Lane 2 STT configuration | content as found (enabled, `cpu-local`, `ggml-large-v3-turbo`, `id`, labelling on, no credential); **`revision` 13 (found 11)**: labelling off / on through op 91; `pendingForNextSession false` |
| Lane 1 | no session open, 0 active alerts, chain `ok` 94 rows + my sign-out; still NO device (a simulated session cannot pass its pre-check there: "Core link offline") |
| Devices | tablet and phone signed out, on Login, "Core online", "paired as DEV-0001" / "DEV-0002"; `pairing/devices` both `PAIRED`, online; both reverse rules read back on both (`tcp:8081 -> 8081`, `tcp:4420 -> 4422`); no re-pairing, no link cut, no lock change, no reboot, biometric not enabled; media volume unchanged (4 / 5) |
| Helpers | every helper session signed out (204) and its jar removed; both headless browsers stopped, their profiles removed; the two logcat readers stopped; no `capture-worker` / `ffmpeg` / `whisper` process |

New on lane 2 (real capture, FAKE sources, development key `CORE-KEY-EVSIGN-01`, `MIC-01` = the
synthetic speech fixture, no microphone switch; each sealed item verifies `PASS` 15 of 15 and its
manifest states `H264_720P30` on both tracks; the lane now holds 30 items):

| Item | Session | Kind | Length | Size | Made by | Notes |
|---|---|---|---|---|---|---|
| `EV-20261011-0027` | `SES-20261011-0038` | **interrupted + resumed** (`POWER_FAIL` / `coreNotRunning`: Core stopped gracefully while recording) | 24.8 s | 23.3 MB | API | op 83 `resumed true`; transcript 1 chunk, 5 segments, `intervals_incomplete`; its extract holds the "Core was not running" row |
| `EV-20261011-0028` | `SES-20261011-0039` | **clean** | 327.8 s | 334.3 MB | TABLET (rows carry `DEV-0001`) | transcript 11 chunks, 66 segments; **revision head 1** (segment 0, by OPR-002 from the web; permanent) |
| `EV-20261011-0029` | `SES-20261011-0040` | **clean, blocked then sealed** (rig; four failed attempts, then op 33) | 45.4 s | 45.0 MB | API | op 83 `resumed true`, `interrupted false`; sealed 4 min 36 s after the stop; row `RECOVERY_STARTED {reason SEAL_RETRY}` |
| - | `SES-20261011-0041` | **UNSEALABLE, in quarantine** (rig) | 45.5 s | 49,476 KiB in quarantine | TABLET start, API stop | no item; `EV-20261011-0030` does not exist; history outcome `INCOMPLETE` |
| `EV-20261011-0031` | `SES-20261011-0042` | **interrupted** (`CAPTURE_FAULT`, capture worker killed once) | 26.1 s | 23.8 MB | TABLET (rows carry `DEV-0001`) | sealed 9.3 s after the kill, `resumed false`; transcript 1 chunk, 6 segments, `intervals_incomplete` |

## 12. What later re-checks must know

1. `uiautomator dump` hangs for a long time on Session Live and on Home while a recording runs
   ("could not get idle state"): take screenshots and tap by coordinates there. The End Session
   confirm of the tablet lies at about (1674, 740) with the keyboard up.
2. The tablet's "Start Recording" starts after a 3-2-1 countdown: the connecting window is 3.0 to
   5.0 s after the tap.
3. A helper session and a device session expire after 15 idle minutes; after an expiry the Login
   shows a banner and (phone) a dialog that move the fields - re-read the field places after each
   step, and never print a field's text.
4. After a sign-in the soft keyboard can stay up over Home and swallow taps: close it with Back
   (`keyevent 4`), not Escape, and read `mInputShown`.
5. Tablet sign-out: Settings > the account row > "Sign out" (no confirm). Phone: More > "Sign out".
6. `lane.sh start` starts the Core log anew: copy `.locks/core-server.lane2.log` after a stop and
   before the start if the stop's lines are wanted.
7. A blocked seal is ended with `seal-rig 2 release` and then `POST session/{id}/recover` (op 33)
   through the API, or a lane restart: no screen offers it (G75d-02).
8. Lane 2 shows SECURE / READY although `ALR-000049` is active (G75d-01): do not read the header as
   "no active alert"; read `GET alerts`.
9. Lane 1 has no device: a simulated session cannot be recorded there until a device is paired to
   it again (a NEW pairing, note 08 section 3).
10. The device media volume was not set to 0 by the command of note 08.

---
*Generated: 2026-10-11 09:05 WIB*
