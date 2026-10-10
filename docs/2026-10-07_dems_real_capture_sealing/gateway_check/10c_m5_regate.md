---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 75 (M5 milestone gate, SECOND RE-GATE, independent +1)
date: 2026-10-10
agent: verifier
narrative_tier: 2
tree: commit 57b80a9 (product code unchanged by this gate)
supersedes: nothing - read with gateway_check/10_m5_gate.md (FAIL) and 10b_m5_regate.md (FAIL, blocked)
status: needs-review
verdict: FAIL (one new MAJOR, G75c-01; G75b-05 not at 0; the blocked-seal surfaces not provable live) - everything re-gate 10b was blocked on is now proven
---

# 10c - M5 milestone gate, second re-gate (row 75)

Run window 22:00-22:24 WIB on the environment of `initialization/07_gate_environment_wave_i.md`
(with note 06 for the helper and the browser tooling). No product or test file changed, no git
write, no install. No local device (`CAM-03` / `MIC-03`) selected, pre-checked or started; no
attendance variable set; the fingerprint sensor never touched; `CAM-04` on no track; the camera
stub not used; no credential and no fixture account is in this file or in a file name. Every
`curl` / `adb` / `lane.sh` call ran outside the command sandbox (loopback and adb are closed inside
it: the first call inside answered an empty body and "ADB server didn't ACK"). Evidence under the
git-ignored `.cache/gates/75c/`.

Surfaces: **W2** web lane 2 (5177, REAL_DEVELOPMENT), **T** tablet `emulator-5556` on lane 2,
**W1** web lane 1 (5176, SIMULATED), **P** phone `emulator-5554` on lane 1. Web = headless
Chromium over CDP with the cookie of `gate-session.mts`, a page sampler every 90 ms; devices =
`adb` taps, `uiautomator`, screenshots; device sign-in through "Demo operators" (values never
printed). Both overlays answered before the first tap on each device (toast X; "Not now").

## 1. Verdict

**FAIL - narrowly, and not blocked.** The main line of M5 is proven end to end on real capture for
the first time: a session from the tablet and a session from the web each went create ->
pre-check -> connecting -> recording -> one microphone switch -> stop -> six real sealing steps ->
SEALED -> Summary -> sealed item on web and tablet, verify 15 of 15. The interrupted path (worker
killed) is named with one phrase on web, tablet and API. A graceful stop of the Core during a
recording no longer writes "Power fail" or "Tablet control offline". The three MAJORs of the first
gate (G75-01, -02, -03) and G75b-01 are closed.

The gate fails on what it found while driving item 5:

| # | Blocking item | Finding | Owner |
|---|---|---|---|
| B-1 | After a Core restart with a session active, the restart fault never ends: the alert stays `active`, tablet Home reads "SYSTEM CRITICAL / Recording Blocked / A critical fault needs action", the web header "CRITICAL / Critical fault: Core was not running" - through a complete new recorded and sealed session, an acknowledgement and a second clean restart. Nothing is blocked (pre-check PASS, recording and seal work) and no product action ends it | **G75c-01 MAJOR** | coder-execution (shared fault clear at recovery completion / engine); or a controller ruling on the severity |
| B-2 | G75b-05 is not closed: 202 Reanimated "Unable to find SurfaceMountingManager" lines on the tablet (expected 0; ruling D217 (2) made 0 the acceptance) | G75c-02 MINOR | coder-execution (mobile) |
| B-3 | The blocked-seal surfaces (G75b-02, MAJOR at 10b) and the refused-start sentence are proven by component tests only: NOT PROVEN LIVE (section 4.6) | - | controller: accept the tests, or provide a supported rig |

If the controller rules G75c-01 MINOR (as G75-10 was), the verdict becomes PASS WITH CONDITIONS
with B-1..B-3 as the conditions. I rate it MAJOR because, unlike G75-10, the state does not end
at the next start: a Core that lost power once in a session tells its operator "Recording
Blocked" until the database is reset.

## 2. Start state (22:00)

| Item | Read |
|---|---|
| Tree | `57b80a9`; `git status --short` outside `docs/`: 0 lines (read again at 22:22: 0 lines, `git diff --stat HEAD -- apps packages scripts` empty) |
| Lanes | 1 RUNNING PID 49865, 2 RUNNING PID 49915; both `ready {database, engine}`, `ws.clients 1` |
| Lane 2 | selector `CAM-01`, `CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; `session/current` = the smoke's `SES-20261010-0024` SEALED; alerts: `ALR-000002` inactive; audit chain `ok`, 98 rows |
| Lane 1 | no session, `activeFaults []`, chain `ok`, 91 rows |
| Devices | both awake, no keyguard, Login, "Core online", "paired as DEV-0001", reverse rules 4421 / 4422 |
| Host | load 4.2 at the start, 4.0 at the end |

## 3. Entry condition - the MAJORs of the earlier gates

| Finding | State now | Where |
|---|---|---|
| G75-01 invented integrity rows | **CLOSED, both halves**: lane 2 audit rows seq 99-144 hold 0 `FRAME_HASH` / `WRITE_VERIFIED` / `TIMESTAMP_CONFIRMED`; the sealed `audit-session-extract.jsonl` of `SES-...-0025` = 5 rows (`SESSION_CREATED`, `PRECHECK_PASSED`, `RECORDING_STARTED`, `AUDIO_SOURCE_SWITCHED`, `RECORDING_STOPPED`), of `-0026` the same 5 types | 4.1, 4.2 |
| G75-02 sending device, simulated lane | closed at 10b; re-seen on the phone's stop (lane 1 seq 113 `DEV-0001`) | 4.3 |
| G75-03 interrupted seal reads as a plain seal | **CLOSED**: "Sealed — recording was interrupted" on web Monitor banner, feed card, seal dialog, Evidence list and detail; tablet Finalizing, Summary (chip "Interrupted") and Evidence row; op 40 `interrupted: true` | 4.4 |
| G75b-01 lane 2 cannot seal | **CLOSED** for the plain path: five sessions sealed on lane 2 tonight, attempt 1 each, no `SEALER_FAILED`; the key folder holds one `.key` + `.blob` per sealed session (names only read). The terminal / reset paths: by `test/09` (kill matrix 35 of 35, seal e2e 3 of 3) and the environment note's plain `reset 2`, not driven by me | 4.1, 4.2, 4.6 |
| G75b-02 blocked seal not stated | NOT PROVEN LIVE (component tests) | 4.6 |

## 4. Checks

### 4.1 Item 1 - real-capture session from the TABLET: `SES-20261010-0025` -> `EV-20261010-0015`

| Check | Surface | Result | Evidence |
|---|---|---|---|
| New session, pre-check | T, API | PASS | case number by "Fill in the next case number" (`LP/2026/1010-9002`), Saksi; "8 of 8 checked", "All checks passed"; lens / microphone rows "Development source / Test source", "Primary microphone · MIC-01", "Standby microphone · MIC-02"; row "Time Sync, Host system clock, NOTE"; seq 100, 101 |
| Start: connecting | T, API | PASS | API `RECORDING, durable False` 22:02:57.199 -> `True` 22:02:59.219; `t2_03_connecting.png` (22:02:57.9): "Connecting cameras...", VIDEO 1 / 2 CONNECTING, both audio cards "CONNECTING" without a meter, End Session dimmed with its sentence, chip "TIME Host system clock" |
| G75b-08 on the tablet | T | **PASS - closed** | the same picture: SESSION TIMELINE "No events yet" while connecting; "Recording Started 22:02:57" is there once recording (`t2_04_switch_confirm.png`) |
| Recording, checkpoint facts | T, W2 | PASS | T "9 fragments saved · last 2 s ago · 11.0 MB / Camera 1 (CAM-01) · 5 ... 6.3 MB / Camera 2 (CAM-02) · 4 ... 4.7 MB"; W2 at 00:00:13 the same three lines; banner "SESSION ACTIVE / Recording. The first fragment is durable on the evidence volume"; integrity panel: Capture, Media Protection "Not encrypted during recording...", Audit Log Hash Chain, Time Source "Core system clock (UTC+07:00)" |
| Monitor session size = durable bytes (G75b-06) | W2 | **PASS - closed** | "Session Size 11 MB" beside "9 fragments saved ... 11 MB"; later 22 / 22, 24 / 24, 35 / 35 MB |
| One microphone switch from the tablet | T, W2, API | PASS | dialog "Switch the active microphone to MIC 2? Recording continues. MIC 1 becomes the standby microphone. The switch is written to the audit log."; op 82: seq 1 `MIC-01 PRIMARY 21-26321 START`, seq 2 `MIC-02 STANDBY 26321- MANUAL OPR-001`; W2 without a reload: "MIC 1 from 0:00 to 0:26 / MIC 2 from 0:26", timeline "Microphone Switched, MIC 1 to MIC 2" |
| Stop | T, API | PASS | End Session dialog, reason required (button dimmed at 0 / 500); `stoppedAt 22:03:57.352`, `RECORDING_STOPPED {durationMs 60263}` |
| Sealing states | T, W2, API | PASS | op 83 (`l2_T_seal_poll.log`): `CLOSE_TRACKS active` 22:03:57 -> 16 % -> 33 % `FINALIZE_TRANSCRIPT active` 22:03:58 -> `SEALED` 22:04:08.201, `resumed: False` in every line; T `t2_07_finalizing.png`: "Finalizing evidence / 33% complete", steps 1-2 done with times, step 3 running, no "Resumed after restart". Core log `SEALING_COMPLETE ... attempt 1, interrupted false`. Leftover: G75c-05 (the ETA line) |
| Summary | T | PASS | `t2_08_summary.png`: "SEALED", "Sealed 10.8 s after the recording ended", six steps with times, Start / End time chips "Host system clock", Duration 00:01:00, 60.2 MB, EV-20261010-0015 |
| Sealed item on tablet and web | T, W2 | PASS | T Evidence row "EV-20261010-0015, Gate75cTablet, Sealed, ... duration 00:01:00" + "Development source", detail pane; W2 dialog "Evidence sealed / SEALED / Sealed 10.8 s after the recording ended", Evidence list row. `POST evidence/EV-20261010-0015/verify`: `overall PASS`, 15 of 15 |
| **B9 (narrow): hand-over to Finalizing AND Summary** | T logcat | **PASS** | cleared 22:02:00, read 22:04:24 (`logcat_T_session1.txt`, 40,603 lines). From 22:03:57 on: 0 "SurfaceMountingManager" lines; `ReactNativeJS`: 36 lines, all level I; level-E lines of the app's process: 91 "EGLConsumer is not attached to an OpenGL ES context", 10 `EGL_emulation`, 3 `Surface` (the emulator's graphics layer; 0 from the app's JS) |
| **G75b-05: Reanimated warnings in Session New and at the Session Live mount** | T logcat | **FAIL: 202** (expected 0) | "Unable to find SurfaceMountingManager for tag": 194 at 22:02:21.9-22.0 (the tap on Next = the commit that turns the session PRECHECK; tags 2282 x49, 2408 x48, 2528 x48, 2554 x49) and 8 at 22:02:57.9 (mount of Session Live, tag 4792). 10b counted 269: the per-check group is gone, the two others are unchanged. With their stack lines: 36,705 level-W `Reanimated` lines in 2 s. G75c-02 |

### 4.2 Item 2 - real-capture session from the WEB: `SES-20261010-0026` -> `EV-20261010-0016`

| Check | Surface | Result | Evidence |
|---|---|---|---|
| New session, pre-check | W2 | PASS | `LP/2026/1010-9003`; "All checks passed / 8 of 8 checks complete"; "Time Sync - Time source: host system clock (no GNSS) - NOTE"; step 3 "Recording starts at once and is sealed when you end the session." |
| Connecting, G75-04 on lane 2, G75b-08 on the web | W2 | **PASS - closed** | `l2_W_web.log`: 22:06:21.402 "CONNECTING CAMERAS… / Connecting cameras… Recording has not started.", `dBFS` strings 0, no REC, timeline "The timeline starts when recording starts."; 22:06:23.456 REC, meters, "Recording Started". API durable at 22:06:23.438 |
| Tablet Home while the web connects | T | PASS with a leftover | `t2_10b_home_connecting_web_session.png` (22:06:22.9): bar "Connecting cameras... SES-20261010-0026", ring "SYSTEM CONNECTING". Leftover G75c-07: header chip "RECORDING" and both microphone tiles with a level ("-12 dBFS Active", "-21 dBFS Standby") |
| Switch from the web | W2, API | PASS | the same dialog; "MIC 1 from 0:00 to 0:28 / MIC 2 from 0:28"; seq 110 `{fromMs 21, toMs 28401}` |
| Web Storage page: session size = durable bytes (pass J) | W2, API | **PASS** | "SESSION SIZE 0.03 GB · SES-20261010-0026 · live" while the Monitor read 35 MB durable and `session.bytesWritten` (the simulator's formula) was 83,605,833. Leftover on the same page: G75c-04 (write speed) |
| Stop, the seal dialog's real states | W2, API | PASS | `l2_W_seal_web.log`: "Finalizing evidence / 0% complete / Close tracks 1/6: Active" 22:07:30.8 -> "16% ... 2/6: Active" -> "33% ... Finalize transcript 3/6: Active" -> "50% ... 4/6" 22:07:40.4 -> "Evidence sealed / 100% complete / 6/6: Done / SEALED / Evidence EV-20261010-0016 sealed / Sealed 9.8 s after the recording ended"; banner "FINALIZING / Sealing evidence • step n of 6" then "SESSION SEALED"; no "Resumed after restart"; op 83 `resumed: False` throughout |
| Sealed item on the web | W2 | PASS | Evidence detail: "Sealed / Core record / Development source", 22:06:21 - 22:07:30, Duration 00:01:09, 69.5 MB, "Sealed recording ... Open playback", "Transcript assembled / Inside the sealed package"; verify `overall PASS` 15 of 15 (`manifestOk`, `signatureOk` true) |
| The package's audit extract carries the session's rows (G75-01, second half) | package | **PASS** | `SESSION-SES-20261010-0026/audit-session-extract.jsonl`: seq 107-111, the five types above, nothing else |

### 4.3 Item 3 - G75b-04, the sending device

| Row | Sent from | `deviceId` | Seq |
|---|---|---|---|
| `SESSION_CREATED`, `PRECHECK_PASSED`, `RECORDING_STARTED`, `AUDIO_SOURCE_SWITCHED`, `RECORDING_STOPPED` | tablet, lane 2 | `DEV-0001` on all five | 100-104 |
| the same five | web, lane 2 | `null` on all five | 107-111 |
| `RECORDING_STOPPED` | phone, lane 1 | `DEV-0001` | 113 |
| `SESSION_CREATED`, `PRECHECK_PASSED`, `SESSION_CANCELLED` | phone, lane 1 (New Session, then Back -> "Cancel session") | `DEV-0001` on all three | 126-128 |
| `SESSION_CREATED`, `PRECHECK_PASSED`, `SESSION_CANCELLED` | web API, lane 2 | `null` | 134-136 |

**PASS - G75b-04 closed.** Not covered by the ruling and still without the device: G75c-09.

### 4.4 Item 4 - the INTERRUPTED path on lane 2: `SES-20261010-0027` -> `EV-20261010-0017`

Session started through the API (web actor), durable; the capture worker (PID 60722, child of the
Core 49915, found with `ps`) killed once with `kill -KILL` at 22:09:07.9, 31 s into the recording.

| Check | Surface | Result | Evidence |
|---|---|---|---|
| Core | log | PASS | `CAPTURE_WORKER_DOWN {signal SIGKILL, restartInMs null}`, `CAPTURE_INTERRUPTED {cause EXITED, outcome INTERRUPTED, durable true}`; no worker or helper process left |
| The fault's wording and reason (G75-05, second half) | API | **PASS - closed** | `ALR-000011 CRITICAL CAPTURE_FAULT` "The capture worker process was killed." `{reason: WORKER_KILLED}`; seq 118 `FAULT_RAISED` the same sentence and reason |
| The clear row; no CRITICAL afterwards (G75-10 a) | API, W2, T | **PASS - closed** | seq 122 `FAULT_CLEARED` "The capture worker process was killed. — cleared" at the seal; `ALR-000011 active: false`; W2 header back to "SECURE / All systems operational" at 22:09:24.6; T Home "READY / Ready for Recording" |
| The interrupted prefix seal | API | PASS | `FAULT 22:09:07 -> FINALIZING 22:09:08 -> SEALED 22:09:24.438`, `resumed: False`; seq 119 `RECOVERY_STARTED`, 120 `EVIDENCE_SEALED`, 121 `RECOVERY_COMPLETED`; custody `RECORDING_INTERRUPTED / CAPTURE_FAULT`, `SEALED / "Durable prefix sealed (interrupted)"`; verify 15 of 15 |
| `stoppedAt`, Duration (G75-08) | API, W2, T | **PASS - closed** | `stoppedAt 22:09:07.620` (was null); W2 Duration 00:00:31; T Summary Duration 00:00:31, End Time 22:09:07; op 40 `durationMs 31122` |
| **The naming, identical on web, tablet and API (G75-03)** | W2, T, API | **PASS - closed** | W2 (`w2_07_interrupted_monitor.png`, `l2_I_web.log`): banner "Sealed — recording was interrupted / EV-20261010-0017 · The capture stopped unexpectedly before the recording was ended. The recording was interrupted. The evidence holds the recording up to the interruption."; the dialog title and its chip "INTERRUPTED". T (`t2_11_finalizing_interrupted.png`, `t2_12_summary_interrupted.png`): the same title and sentence on Finalizing and on the Summary, chip "Interrupted". API op 40: `interrupted: true, interruptedCause: CAPTURE_FAULT` |
| The sealed item marked interrupted with the same word | W2, T, op 40 | PASS | W2 Evidence list row and detail "Sealed — recording was interrupted / Cause: CAPTURE_FAULT"; T Evidence row "EV-20261010-0017, Gate75cInterrupt, Sealed — recording was interrupted, ..."; op 40 as above. The clean items of tonight: `interrupted: False` |
| The lane starts a new session | API | PASS | `SES-20261010-0028` created, pre-check PASS, recording durable (item 5) |
| Leftovers | W2, T | noted | G75c-06 (timeline sentence, listed twice), G75c-10 (the recovery screen in passing; "Sealed —" at 0 %) |

### 4.5 Item 5 - G75b-03 / `coreNotRunning`: `SES-20261010-0028` -> `EV-20261010-0018`

Session RECORDING and durable since 22:11:05; `scripts/lane/lane.sh stop 2` at 22:11:31 (exit 0,
"lane 2 stopped (was PID 49915)"); `start 2 --with-camera-stub --speech-mic` at 22:11:38 with its
output in a 0600 file, not piped (exit 0, ready, **PID 63257**).

| Check | Surface | Result | Evidence |
|---|---|---|---|
| The stop itself | log | PASS | `CAPTURE_SUPERVISOR_STOPPED`, `CAPTURE_SESSION_SHUT_DOWN` (warn: "the Core shut down while a session was being captured: the worker was stopped and its sources closed; the next boot resu..."), `shutdown complete`; no process left. Two error-level lines after "shutdown complete": G75c-08 |
| The audit chain's sentence | audit | **PASS** | seq 127 `FAULT_RAISED` "The Core was not running while this session was active. It does not know why it stopped." `{kind POWER_FAIL, evt EVT-21, fromState RECORDING, coreNotRunning: true}`; seq 128 `SYSTEM_BOOT` "Core started"; 129 `RECOVERY_STARTED {faultKind POWER_FAIL}`; 130 `TABLET_LINK_CHANGED` "Tablet control connected"; 131 `EVIDENCE_SEALED`; 132 `RECOVERY_COMPLETED`. Over seq 99-144: 0 messages with "ower fail" or "offline" |
| Labels on web and tablet | W2, T | PASS | W2 header "CRITICAL / Critical fault: Core was not running", timeline "Fault Detected / Core was not running" (`l2_R_web.log` 22:11:47); T Home flag "• Core was not running" (`t2_17_home_core_not_running.png`) |
| The seal resumes as the spec says | API, log | PASS | engine line `session FAULT, restartFault RECORDING, tabletLinkOfflineUnwritten true`; `SEALING_RESUMED`, `SEALING_COMPLETE ... interrupted true` 22:11:40, 8.7 s after `stoppedAt 22:11:31.641`; op 83 **`resumed: True`**; 26.5 s kept, verify 15 of 15 |
| "Resumed after restart" only where true | W2, T | PASS (by absence) | the text appears on no surface of tonight's runs (`grep` over the three web seal logs: 0; T Finalizing / Summary pictures: none). Web and tablet do not poll op 83 in Live mode (notes 133 D-2, 134 decision 2), so the true case is not shown either |
| The interrupted item's cause wording | W2, T, op 40 | leftover (ruled D218 (3)) | banner and T Summary (`t2_16_after_restart.png`): "The recording ended at a fault (POWER_FAIL) before it was stopped."; op 40 `interruptedCause: POWER_FAIL`, custody detail `POWER_FAIL`. G75c-03 |
| **The lane is usable after** | API, T, W2 | functionally PASS; **the state shown is false and does not end: FAIL** | `SES-...-0029` pre-check PASS (cancelled); `SES-...-0030` recorded 20.4 s and sealed clean (`EV-20261010-0019`, `resumed: False`, verify 15 of 15). Throughout and after: `ALR-000016 CRITICAL POWER_FAIL active: true`; T Home "SYSTEM CRITICAL / Recording Blocked / A critical fault needs action" beside an enabled "Start Session" (`t2_17`), "Recording — critical fault" during the healthy recording of `-0030` (`t2_21_home_recording_with_stale_fault.png`); W2 "CRITICAL / Critical fault: Core was not running", checklist "Recording pipeline: Failed" (`w2_10_dashboard_lane2.png`). No `FAULT_CLEARED` row follows `RECOVERY_COMPLETED` (the worker-kill case has one, seq 122). G75c-01 |
| What ends it | API | nothing I may do | `POST alerts/ALR-000016/acknowledge` 204 -> `acknowledged: true, active: true`, surfaces unchanged; a second restart with no session open (below) -> still `active: true` |
| Second restart (to see whether the fault ends; no session open) | lane | done | 22:21 `stop 2` / `start 2 ...` (exit 0, **PID 65172**); engine line `session SEALED, restartFault null, auditRows 0`; rows: `SYSTEM_BOOT` "Core started", `TABLET_LINK_CHANGED` "Tablet control connected" and nothing else |
| Web after the Core came back | W2 | noted | "Core server unreachable / The screen shows the last state received. Reconnecting…" from 22:11:31.2; the Core was ready at 22:11:40; the page reconnected at 22:11:47.2 |

### 4.6 Item 6 - G75b-01's new behaviours and the blocked-seal surfaces

| Check | Result | Evidence |
|---|---|---|
| A plain session start works after a reset | PASS | 4.1 (and four more starts) |
| Blocked seal on web dialog, tablet Finalizing, Home / Sessions "Sealing blocked", header pill / Home ring critical | **NOT PROVEN LIVE** | a healthy lane cannot produce it. Note 131 names no supported rig: its re-drive item 4 asks for "a test key made by a throw-away sealer" (no tool is named), item 3 for making the key folder not private - a change to a credential store's mode, which I did not make. Component tests, read by name, run by the test runner inside the green suites of `test/09`: `apps/core-web/src/features/session-monitor/__tests__/wave-i-b-seal-blocked.test.tsx` (12), `apps/core-web/src/test/pass-j.test.tsx` (17), `apps/mobile/src/features/session-finalizing/wave-i-c-seal-blocked.test.tsx` (8), `apps/mobile/src/features/dashboard/wave-i-c-seal-blocked-home.test.tsx` (4), `.../sessions/wave-i-c-seal-blocked-hub.test.tsx` (6), `apps/mobile/src/navigation/wave-i-c-new-session-blocked.test.tsx` (2), `.../dashboard/pass-j-home.test.tsx` (7), `packages/shared/test/sim-wave-i-a1-seal-blocked.test.ts` (5) |
| Start refusal sentence (`SESSION_KEY_NOT_OF_SESSION`) on web and tablet | **NOT PROVEN LIVE** | `apps/core-server/src/sealing-host/__tests__/wave-i-a1-session-key.test.ts`, `packages/shared/test/sim-pass-j.test.ts`; note 135 itself says the rendered toast is not proven by a test |
| Terminal cause -> quarantine; reset with the option | not driven | `apps/core-server/src/sealing/__tests__/wave-i-a1-way-out.test.ts`, `db/reset/__tests__/wave-i-a1-*.test.ts`; nothing is in quarantine on lane 2 (`.quarantine` does not exist under the store) |

### 4.7 Item 7 - G75b-06 / -07, pass J

Lane 2 (REAL_DEVELOPMENT):

| Surface | Reads | Result |
|---|---|---|
| W2 Dashboard strip | "Time / Host system clock", "Security / Not reported" | PASS |
| W2 Dashboard card | "TPM / Secure Boot - NOT REPORTED - TPM: not reported - Secure Boot: not reported"; "Time - HOST CLOCK"; "Security Posture - NOT REPORTED - Posture: not reported" | PASS |
| W2 header checklist | "TPM 2.0 and Secure Boot: Not reported", "Trusted time source: Host system clock" | PASS |
| W2 Network & Time | "HOST SYSTEM CLOCK • CONNECTED / Host system clock · no time service configured"; hierarchy: "This Core takes its time from the host system clock. GNSS, network time and a hardware clock are not configured, so no lock, stratum, offset or last synchronisation exists."; offset "Not measured" | PASS |
| W2 Security & Audit | "Posture: not reported"; "TPM 2.0 attestation / Secure Boot / Key custody: This Core does not read a TPM or the Secure Boot state. - Not reported" | PASS |
| W2 System & Maintenance | "TPM / SE firmware: Not reported" | PASS |
| T Home | chips "Security: Not reported", "Time: Host system clock"; Recent Sessions thumbnails = the neutral "no picture" tile (G75b-09 closed) | PASS |
| T Network & Time | header, System Time, Time Synchronization all "Host system clock" with the same sentence; camera clocks "Not reported yet" | PASS |
| T Session Live, Summary | chip "TIME Host system clock"; Start / End time chips "Host system clock" | PASS |
| T Settings > About TPM field | not found in two views of the screen | NOT PROVEN |
| W2 header names the alert's kind (G75b-07) | "Critical fault: Capture fault" (worker kill), "Critical fault: Core was not running" | PASS - closed |
| Monitor and Storage session size | 4.1, 4.2 | PASS |

Surfaces of lane 2 that still state a fact this Core does not have (the fix note names three
readers; I list what I read): G75c-04.

Lane 1 (SIMULATED), control:

| Check | Result | Evidence |
|---|---|---|
| Demo figures unchanged | PASS | W1 Dashboard at 22:01 and 22:22: "GNSS / Time - Synchronized", "Security - Secure", "TPM / Secure Boot - ACTIVE - TPM 2.0 Verified - Secure Boot Enabled", "GNSS / Time Sync - SYNCHRONIZED", "Security Posture - SECURE - All controls active"; Monitor "SESSION ACTIVE & SECURE", integrity panel "Secure Timestamp Synced GNSS", "Write Speed 2.3 MB/s"; P Summary time chips "GNSS" |
| Header names the kind (G75b-07) | PASS | demo capture fault: "CRITICAL / Critical fault: Capture fault" (`w1_01_demo_capture_fault.png`); one camera lost: "Critical fault: Camera signal lost"; with the failed start: "2 critical faults" |
| **G75b-10: no "Secure timestamp confirmed" after a FAILED start** | **PASS - closed** | `SES-20261010-0025` (both cameras lost): rows 115-120 = `SESSION_CREATED`, `PRECHECK_PASSED`, 2 x `FAULT_RAISED` camera, `RECORDING_STARTED`, `FAULT_RAISED` "No camera connected. Nothing was recorded."; 18 s later still no `TIMESTAMP_CONFIRMED` / `FRAME_HASH` / `WRITE_VERIFIED` row; after the close: 121-123 `RECOVERY_STARTED`, `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED` |

### 4.8 Item 8 - "Recording Started" while connecting; the transcript step's log level

| Check | Result | Evidence |
|---|---|---|
| G75b-08, web Monitor | PASS | 4.2; also lane 1's failed start: timeline only "Fault Detected / No camera connected. Nothing was recorded." |
| G75b-08, tablet timeline | PASS | 4.1 |
| Phone History badge while connecting (pass J) | NOT PROVEN | the phone is on lane 1 (1 s window, session started through the API) |
| `ASSEMBLY_REFUSED` / `TRANSCRIPT_NOT_COMPLETE` at error level | **a finding, MINOR** (G75c-08) | lane 2 log, level 50, one line per second while step 3 waits: 10 for `-0025`, 9 for `-0026`, 16 for `-0027`, 8 for `-0030` (the smoke: 5); each seal then completed at attempt 1. The spec treats this answer as the normal wait: `apps/core-server/src/sealing/finalize-transcript/contract.ts:102-103` "its `ASSEMBLY_REFUSED` with reason `TRANSCRIPT_NOT_COMPLETE` is `NOT_READY`", and `transcription/session-run.ts:349-350` returns `NOT_READY` for it ("the seal waits, within its bound"). The line is written by the transcriber's `refuse()` (`apps/transcriber/src/pipeline/assembly.ts:105` `log.error`) before the Core classifies it. I found no rule on log levels in the test strategy; the judgement is mine: a healthy seal that prints 8-16 error lines hides the real ones |

### 4.9 Item 9 - spot-check of what 10b passed (one per group)

| Group of 10b | Item re-seen | Result |
|---|---|---|
| 4.1 create / pre-check / connecting / durable / checkpoints / Monitor panel | 4.1 above | PASS |
| 4.1 switch, intervals, sending device on the switch | 4.1 (seq 103 `sendingDeviceId DEV-0001`) | PASS |
| 4.2 demo fault wording, web | lane 1 `ALR-000004 CRITICAL CAPTURE_FAULT` "The demo control raised a capture fault. The recording is not affected." `{reason DEMO_CAPTURE_FAULT}`; banner "FAULT / Recording continues • Capture fault"; session stays RECORDING; clear row seq 103 "... — cleared" | PASS, with G75c-06 (the timeline row beside it says the recording was interrupted) |
| 4.2 demo fault wording, phone | `p1_02_home_demo_capture_fault.png`: "Recording — critical fault / Recording SES-20261010-0024 continues. A critical fault needs action / • The demo control raised a capture fault. The recording is not affected."; Session Live shows only the badge (`p1_04_live_demo_capture_fault.png`), as at 10b | PASS |
| 4.2 stop from the phone, simulated seal | `RECORDING -> STOPPING 22:16:59 -> FINALIZING 22:17:00 -> SEALED 22:17:05.359`; P Summary "SEALED", Duration 00:01:37, chips "GNSS" | PASS |
| **4.2 B9 on the phone** | cleared 22:15:14, read 22:17:10 (`logcat_P_S1.txt`, 3,505 lines; Home -> Session Live -> Home -> Session Live -> End -> Finalizing -> Summary): 0 "SurfaceMountingManager", 0 `Reanimated` W, `ReactNativeJS` 21 lines all level I; level-E of the app's process: 190 "EGLConsumer...", 24 `EGL_emulation`, 7 `Surface`, 5 `ExpoVideo`, 2 `MediaCodec`, 1 `ImeBackDispatcher` | PASS |
| 4.2 failed start on the phone, close | `p1_09_failed_start.png`: "No camera connected / Nothing was recorded. Check the cameras on Devices, then close this session and start a new one.", Open Devices, Close session, Go to Home; "Close session" -> Home "Attention Needed / 1 check needs attention / • No camera connected. Nothing was recorded.", Start Session enabled | PASS |
| 4.2 the no-camera fault ends at the next start | seq 132 `FAULT_CLEARED` "No camera connected. Nothing was recorded. — cleared" at the start of `SES-...-0027`; `activeFaults []` | PASS |

### 4.10 Item 10 - regression / quality checks (mapped; NOT re-run by me)

| Check | Result | Evidence |
|---|---|---|
| `M5-RG-*` | PASS by `test/09_precommit_wave_i.md` + `implementation/138_pin_moves_wave_i.md` | on the wave I tree: shared 2570, capture-protocol 31, core-server unit 6517, core-web 2069, transcriber 561 (3 skipped), mock-core 19: 0 failed; core-server db 2419 passed / 3 failed, mobile 2692 passed / 1 failed - the 4 reds were stale pins in 3 files, moved by note 138 and those 3 files re-run green (51 db tests, 10 mobile tests). **The whole db and mobile suites were NOT run again after the pin moves** (D219: they run at row 95), so "db 2422 / mobile 2693 green" is an inference from the per-file re-runs, not a run |
| `M5-QA-1` | PASS by the same files | typecheck 0 errors and lint clean in 7 workspaces (1 known eslint warning); after the pin moves: typecheck + lint of core-server and mobile only |
| Kill matrix, seal e2e, development-session e2e | PASS by `test/09` rows 9-11 | 35 of 35; 3 of 3; 2 passed, 2 skipped |
| Tree unchanged since the commit | PASS | section 2 |
| `M5-GAP-1`, `M5-WARN-1`, `M5-SRC-REC-1`, `M5-NODEV-C-1` real-worker half | by record, as at the first gate | not re-run; the worker binary is `capture-worker/0.5.0` (unchanged) |
| `M5-SEC-SRC-1`; the file analyser on a product recording | NOT PROVEN | as at both earlier gates |
| Nothing was run by me from the suites | - | this gate ran no test file |

## 5. Findings of this re-gate

| ID | Severity | What | Steps / evidence | Spec / ruling |
|---|---|---|---|---|
| **G75c-01** | **MAJOR** | The restart fault of a Core in its own capture is never cleared. After the interrupted seal of the session it belongs to (`RECOVERY_COMPLETED`, seq 132) no `FAULT_CLEARED` row is written and `ALR-000016` stays `active`. Seen for 10 minutes: through a cancelled session, a full recorded and sealed session (`-0030`), an acknowledgement (204, still active) and a second clean restart. Tablet Home: "SYSTEM CRITICAL / Recording Blocked / A critical fault needs action / • Core was not running" with "Start Session" enabled; during the new recording "Recording — critical fault"; web header "CRITICAL / Critical fault: Core was not running", checklist "Recording pipeline: Failed", Dashboard ring "SYSTEM CRITICAL 1 ISSUE". Nothing is blocked. Lane 2 has no demo control, so no product action ends it; I know of a database reset only. The cause was not established: the sentence `CORE_NOT_RUNNING_CLEARED_SENTENCE` exists in `packages/shared/src/sim/faults.ts:531`, I saw no caller reach it on this path | 4.5; `t2_17`, `t2_21`, `w2_10` | G75-10 ("nothing is blocked and no integrity check failed") was closed for the capture fault by a clear at the seal; note 135 re-drive list expects "after Recover: '... is running again ...' rows"; ux flow 4 visible states |
| G75c-02 | MINOR (acceptance of D217 (2) not met) | G75b-05 not closed: 202 "Unable to find SurfaceMountingManager" warnings on the tablet - 194 in the commit where Session New turns PRECHECK (four tags, 48-49 each), 8 at the mount of Session Live (one tag). The per-check-row group of 10b (64 lines) is gone | 4.1; `logcat_T_session1.txt` | note 134: "needs-review: a hypothesis until logcat reads 0"; groups (a) and (c) of that note are the two that remain |
| G75c-03 | MINOR (known, ruled D218 (3); owner = the next task's `CORE_STOPPED`) | The interrupted notice of a session ended by a Core stop prints a code and the simulator's cause: "The recording ended at a fault (POWER_FAIL) before it was stopped." on the web banner and the tablet Summary; op 40 `interruptedCause: POWER_FAIL`; custody detail `POWER_FAIL`. The web item of a killed worker reads "Cause: CAPTURE_FAULT" (a code) | 4.5, 4.4; `t2_16_after_restart.png` | wording rule of the fix brief; these two items are what later gates (89, 94) will show |
| G75c-04 | MINOR (G75b-06 closed for the named chips, not for these) | On lane 2 the web still states: Security & Audit "Secure timestamp - **RTC holdover, not locked** - Check", "Hardware root key - Hardware-bound - **TPM 2.0 (fw 7.2.3.1) - Resident in TPM 2.0, never exported**" (beside "This Core does not read a TPM"), "Signed firmware - v2.4.1 signature verified - Active", "Enclosure tamper switch - Closed - Active", "Evidence signing key - DEMO-KEY-EVSIGN-01" (the items of this lane are signed with `CORE-KEY-EVSIGN-01`); Devices "GNSS Receiver: NO FIX / No fix · time from RTC", "TPM 2.0 / Secure Element - **Attestation OK · sealing enabled**", clock footer "· RTC"; Network & Time "SOURCE METADATA - RTC UNLOCKED", "A/V SYNC - Degraded" (captioned "Derived for the demo"); header checklist "Evidence encryption (AES-256-GCM): OK", "Enclosure tamper seal: OK"; Dashboard "SECURITY, TIME & NETWORK · All systems secure" beside "Posture: not reported" and SYSTEM CRITICAL; Storage page "WRITE SPEED 2.3 MB/s - Recording · 8.2 GB/h" and "Computed from free space at 8.2 GB per hour" during a recording that wrote about 0.9 MB/s; Monitor "Est. Remaining 56h" | 4.7; DOM text of the pages at 22:13-22:14 | D217 (7); note 135 decision 1 lists three readers left (device list, self-test, `getDeviceStatus`) - the list is longer |
| G75c-05 | MINOR | The seal's time-left line is wrong by two orders: "This step: about 1678 s left" (tablet), "about 1680 s left" / "about 1671 s left" (web dialog) while step 3 "Finalize transcript" ran 8-16 s | `t2_07_finalizing.png`; `l2_W_seal_web.log`, `l2_I_web.log` | ux flow 4: progress the operator can rely on |
| G75c-06 | MINOR | The Monitor timeline words every capture fault "The capture stopped unexpectedly before the recording was ended. The recording was interrupted.": (a) lane 1, demo capture fault, while the alert says "The recording is not affected", the banner "Recording continues" and the session stays RECORDING; (b) lane 2, worker kill, beside the alert's "The capture worker process was killed."; (c) on lane 2 the row is listed twice at 22:09:07 | `w1_01_demo_capture_fault.png`, `w2_07_interrupted_monitor.png` | R74-03: one true sentence per reason; G75-09 was closed on the alert only |
| G75c-07 | MINOR | Tablet while "Connecting cameras...": Home header chip reads "RECORDING" and both microphone tiles draw a level and "Active" / "Standby" (`t2_10b...png`); the Session Live feed tile reads "Not reachable" under "CONNECTING" (`t2_03_connecting.png`) | 4.1, 4.2 | ux 8e.2: no recording indicator, no meters before the first durable fragment |
| G75c-08 | MINOR | Error-level log lines of a healthy Core: 8-16 `ASSEMBLY_REFUSED / TRANSCRIPT_NOT_COMPLETE` per seal (4.8); and at the graceful stop during a recording two `TranscriptChunkStoreError / MIRROR_WRITE_FAILED` lines written after "shutdown complete" | `core_lane2_run1.log`, `core_lane2_run2.log` | 4.8 |
| G75c-09 | NOTE (ruling asked) | Rows of actions a paired device sent that still carry no device: `SUMMARY_ACKNOWLEDGED` from the tablet's Summary Back (lane 2 seq 106, 142: only the tablet acted), `RECOVERY_STARTED` from the phone's "Close session" (lane 1 seq 121, actor OPR-001) | audit lists | D216 (2) says "every audit row of an action sent by a paired device" and then lists create / pre-check / start / stop / cancel |
| G75c-10 | NOTE | Passing states at an interruption: web shows "SESSION ACTIVE / Capture fault / Start recovery" for about 120 ms; the tablet draws the Session recovery screen ("The evidence stays unsealed until a controlled recovery ... Recovery closes the session as incomplete. It never seals it.") between the Summary it was on and Finalizing (`t2_11a_recovery_flash.png`, taken 5 s after the kill, cross-fading); the notice says "Sealed — recording was interrupted" at "0% complete", before anything is sealed. Also: G75-12's one-frame mixture is still there ("CONNECTING CAMERAS… / Recording. The first fragment is durable" for 190 ms); a "Connecting cameras…" dialog stays 2.2 s into the recording after a start from the web wizard | `l2_I_web.log`, `l2_W_web.log` | cosmetic |
| G75c-11 | NOTE (for gate 89) | The web seal dialog of a REAL item ends "Manifest SHA-256 / LIVE / ... / No DEMO package exists for this item."; the Dashboard's sealed card at 22:01 read "Manifest hash · NO MEDIA PACKAGE" for `EV-20261010-0014` | W2 | not judged here |

## 6. Which G75 / G75b findings are closed

| Finding | State |
|---|---|
| G75-01, G75-02, G75-03 (MAJOR) | closed |
| G75-04 | closed on lane 2 as well (web connecting: 0 meters) |
| G75-05 | both halves closed |
| G75-06, -07, -09 (alert), -11, -14 | closed at 10b; -09 leaves G75c-06 |
| G75-08 | closed |
| G75-10 | (a) closed for the capture fault, (b) closed at 10b; the same class is open for the restart fault: G75c-01 |
| G75-12 | still there, NOTE |
| G75-13 | closed (G70-04, the stock picture, the device on the stop row) |
| G75-15 | not touched |
| G75b-01 | closed for the plain path (driven); terminal / reset paths by tests |
| G75b-02 | NOT PROVEN LIVE |
| G75b-03 | closed for the audit sentences and the labels; leaves G75c-01 and G75c-03 |
| G75b-04 | closed (leaves G75c-09) |
| G75b-05 | **open** (G75c-02) |
| G75b-06 | closed for the chips, TPM / posture lines and the session size it named; G75c-04 lists the rest |
| G75b-07, -08, -09, -10 | closed |
| G75b-11 | explained: the helper's session expires after 15 idle minutes (lane 1's did, 22:00:45 -> 22:15:48 "Sign-in expired"); signed in again |

## 7. Skipped / user-attended

| Item | Reason |
|---|---|
| Biometric sign-in | skipped by the user's instruction (D151); the offer answered "Not now" once on each device; never passed |
| `M5-SEC-PRIV-2-W / -T / -P`, the Start Recording notice, `M5-LOCAL-E2E-1` local half, `M5-LOCAL-CLAP-1` | user-attended, not run; no local selector was set |
| Camera search / stub / `CAM-04` | not part of this gate; not pressed, not assigned |
| Blocked seal and refused start by a planted key or a changed key-folder mode | not done: no supported rig is named (4.6) |

## 8. Not covered, and why

1. Section 4.6 (blocked-seal surfaces, start refusal, quarantine, reset with the option).
2. Tablet Settings > About TPM field; phone History badge while connecting; the phone's surfaces on a real-capture lane (the phone is paired to lane 1).
3. A Core stop while PRECHECK / ARMED / STOPPING / FINALIZING (the task asked for RECORDING; FINALIZING is by `wave-i-a2-graceful-restart.db.test.ts`).
4. Situation C and a degraded start on REAL capture; F6 (MB-06); `M5-SEC-SRC-1`; the file analyser on a product recording; advisories live - no means, as before.
5. The plan's tracking table and `implementation/99_implementation_report.md`: the task asked for this one file.

Lapses of mine, for the record: (a) my first page sampler was broken, so the web's connecting
window of the tablet session was not logged (the web session's and the interrupted session's
were); (b) the tablet's End Session tap came 15 s earlier than planned (the recording is 60.3 s);
(c) on the phone the Back key opened "Leave the monitor?", so the demo capture fault was raised a
second time for the Home picture (lane 1 seq 107, 108); (d) the first demo-fault call met the
expired helper session (401) and was repeated.

## 9. Screenshots (`.cache/gates/75c/`) - every file kept was read

| File | Shows |
|---|---|
| `t2_00_login.png` | tablet Login, "Core online", "paired as DEV-0001", the dev toast across the bottom |
| `t2_01_home.png` | tablet Home on lane 2 under the biometric offer; "No preview" tiles, neutral Recent Sessions thumbnails, chip "Time: Host system clock" |
| `t2_03_connecting.png` | tablet Session Live: "Connecting cameras...", cards CONNECTING without meters, timeline "No events yet", End Session dimmed with its sentence; feed tile "Not reachable" |
| `t2_04_switch_confirm.png` | tablet dialog "Switch the active microphone to MIC 2?"; behind it Recording, "9 fragments saved · last 2 s ago · 11.0 MB", timeline "Recording Started" |
| `t2_06_end_dialog.png` | tablet "End Session?" with the required reason, button dimmed; timeline with two rows; 32 fragments / 39.7 MB |
| `t2_06b_end_reason.png` | the same dialog with a reason typed, "End Session" enabled |
| `t2_07_finalizing.png` | tablet "Finalizing evidence / 33% complete / This step: about 1678 s left", steps 1-2 done, step 3 running, length 00:01:00, EV-20261010-0015 |
| `t2_08_summary.png` | tablet Summary "SEALED", "Sealed 10.8 s after the recording ended", six steps, time chips "Host system clock", 60.2 MB |
| `t2_10b_home_connecting_web_session.png` | tablet Home while the web's session connects: bar and ring "Connecting cameras... / CONNECTING", header chip "RECORDING", microphone tiles with levels |
| `t2_10_summary_0026_before_kill.png` | tablet on the Summary of the web's session (SEALED, 00:01:09, 69.5 MB) before the kill |
| `t2_11a_recovery_flash.png` | 5 s after the kill: that Summary with the Session recovery screen ("Capture fault ... Start recovery ... It never seals it.") cross-fading under it |
| `t2_11_finalizing_interrupted.png` | tablet Finalizing with the notice "Sealed — recording was interrupted" and its sentence, "0% complete", length 00:00:31 |
| `t2_12_summary_interrupted.png` | tablet Summary chip "Interrupted", the same notice, Duration 00:00:31, 28.9 MB, EV-20261010-0017 |
| `t2_16_after_restart.png` | tablet Summary of the session ended by the Core stop: "Interrupted", "The recording ended at a fault (POWER_FAIL) before it was stopped.", "Sealed 8.7 s after the recording ended", 00:00:26 |
| `t2_17_home_core_not_running.png` | tablet Home "SYSTEM CRITICAL / Recording Blocked / A critical fault needs action / • Core was not running", "Start Session" enabled |
| `t2_21_home_recording_with_stale_fault.png` | tablet Home during the healthy recording of `-0030`: "Recording — critical fault ... • Core was not running" |
| `t2_22_summary_0030.png` | tablet Summary of `-0030`: SEALED, 00:00:20, 19.3 MB, "Sealed 8.5 s after the recording ended" |
| `w2_07_interrupted_monitor.png` | web Monitor: banner and feed card "Sealed — recording was interrupted", Duration 00:00:31, timeline with "Fault Detected" twice, header SECURE |
| `w2_10_dashboard_lane2.png` | web Dashboard lane 2 after the restart: "SYSTEM CRITICAL 1 ISSUE", header "Critical fault: Core was not running", strip "Time: Host system clock / Security: Not reported", card NOT REPORTED / HOST CLOCK / NOT REPORTED, chip "All systems secure" |
| `w1_01_demo_capture_fault.png` | web Monitor lane 1: "FAULT / Recording continues • Capture fault", header "Critical fault: Capture fault", timeline "Fault Detected - The capture stopped unexpect...", simulated figures (Write Speed 2.3 MB/s) |
| `p1_01_home_recording.png` | phone Home lane 1: "Session in progress", REC 00:00:03, room pictures in Recent Sessions (simulated lane) |
| `p1_02_home_demo_capture_fault.png` | phone Home "Recording — critical fault" with the demo-fault sentence, bar "Recording 00:01:07" |
| `p1_04_live_demo_capture_fault.png` | phone Session Live during the demo fault: Recording 00:00:45, no fault line, badge 2 on the history icon |
| `p1_05_leave_monitor_dialog.png` | phone "Recording continues on the Core. Leave the monitor?" |
| `p1_06_end_dialog.png`, `p1_06b_end_reason.png` | phone "End Session?" without and with a reason |
| `p1_09_failed_start.png` | phone failed-start notice "No camera connected", Open Devices, Close session, Go to Home |

Everything else of this report was read from the DOM (the sampler's logs `l1_*`, `l2_*`), the view
tree, the API answers kept as `audit_*.json`, the two logcat files and two copies of the lane 2
Core log (`core_lane2_run1.log`, `core_lane2_run2.log`: `lane.sh start` starts the log anew).

## 10. Environment as left - what gates 81, 89, 94 inherit

| Item | State |
|---|---|
| Lanes | 1 RUNNING PID 49865 (never restarted); **2 RUNNING PID 65172 - restarted twice by me**: 22:11:31 / 22:11:38 (PID 63257, item 5) and 22:21 (to test G75c-01). Web 5176 / 5177, Metro, PostgreSQL untouched |
| Lane 2 stub | new at each start; now discovery UDP 63022, device TCP 51852, RTSP TCP 51853; **new fixture account** in `.locks/camera-stub.lane2.fixture` (the earlier ones are dead; copies of the two start outputs are in `.cache/gates/75c/start_2.log`, `start_2b.log`, 0600); preset not touched |
| Lane 2 selector | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`; `CAM-04` untouched, on no track |
| Lane 2 session | none open; `session/current` = `SES-20261010-0030` SEALED; `SES-...-0029` cancelled from ARMED; the next session is `-0031`, the next item `EV-20261010-0020` |
| **Lane 2 alert** | **`ALR-000016` CRITICAL `POWER_FAIL` (`coreNotRunning`) is ACTIVE and acknowledged**: every lane 2 surface reads CRITICAL / "Recording Blocked" / "Core was not running" until the lane is reset (G75c-01). Recording, sealing and verify work. All other alerts resolved |
| Lane 2 audit | chain `ok`, 147 rows at 22:22, then the helper sign-outs; 0 invented integrity rows |
| Lane 2 quarantine | nothing; no `.quarantine` folder; `.capture-session`, `.sealing`, `.transcriber` present; store 498 MB |
| Lane 1 | no session open (`SES-...-0027` SEALED), `activeFaults []`, 0 active alerts; audit about seq 141 |
| Devices | both relaunched, on Login, "Core online", "paired as DEV-0001", reverse rules intact; no re-pairing, no lock change, no reboot, biometric not enabled |
| Helpers | four helper sessions signed out (204), jars removed; both headless browsers stopped, their profiles removed; no `capture-worker` / `ffmpeg` process |

Sealed items of lane 2 (all real capture, FAKE sources, development key, `MIC-01` = the synthetic
speech fixture, each with a transcript inside the package; verify `PASS` 15 of 15 for all six):

| Item | Session | Kind | Length | Size | Made by | Notes |
|---|---|---|---|---|---|---|
| `EV-20261010-0014` | `SES-20261010-0024` | clean | 295.9 s | 301.6 MB | environment smoke (API) | no switch |
| `EV-20261010-0015` | `SES-20261010-0025` | clean | 60.3 s | 60.2 MB | TABLET | one switch at 26.3 s to `MIC-02` (tone, no speech after it); rows carry `DEV-0001` |
| `EV-20261010-0016` | `SES-20261010-0026` | clean | 69.3 s | 69.5 MB | WEB | one switch at 28.4 s; rows without a device |
| `EV-20261010-0017` | `SES-20261010-0027` | **interrupted** (`CAPTURE_FAULT`, worker killed) | 31.1 s | 28.9 MB | API | sealed 16.8 s after the kill, attempt 1, `resumed false` |
| `EV-20261010-0018` | `SES-20261010-0028` | **interrupted + resumed** (`POWER_FAIL` / `coreNotRunning`, Core stopped gracefully while recording) | 26.5 s | 25.0 MB | API | sealed by the boot resume, op 83 `resumed true`; its extract holds the "Core was not running" row |
| `EV-20261010-0019` | `SES-20261010-0030` | clean | 20.4 s | 19.3 MB | API | recorded with the stale restart fault active |

Lane 1 (simulated): `EV-20261010-0014` = `SES-20261010-0024` (97 s, stopped on the phone, two demo
capture faults raised and cleared), `EV-20261010-0015` = `SES-20261010-0027` (14 s);
`SES-20261010-0025` INCOMPLETE (failed start, no item); `SES-20261010-0026` cancelled from ARMED on
the phone.

Tooling notes: the helper's session expires after 15 idle minutes; `uiautomator dump` fails on
Home and Session Live while a recording runs (screenshots there); a screenshot of the tablet took
up to 5 s during a seal; `GET audit` returns the oldest rows first (use `order=DESC` or the
cursor); in zsh a variable holding a command with arguments is ONE word (use a function).

---
*Generated: 2026-10-10 22:40 WIB*
