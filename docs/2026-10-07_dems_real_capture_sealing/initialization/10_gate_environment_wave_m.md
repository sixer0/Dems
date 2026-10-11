---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: device / browser environment for the confirmation session after fix wave M
date: 2026-10-11
agent: coder-execution (environment; rules D94 / D122 / D163)
narrative_tier: 3
status: complete - both lanes up on the wave M tree and left running, both devices on lane 2 at Login, every smoke expectation held
builds_on: initialization/09_gate_environment_wave_l.md with 06 and 08 (all kept unchanged; everything not listed below is as note 09 says and is cited, not repeated)
---

# 10 - Gate environment on fix wave M (left running)

Tree = fix wave M (HEAD `7b1aded` plus the staged wave; a git agent commits in parallel). Only this
note was written outside `.data/`, `.cache/`, `.locks/`; no git write; no product source, test or doc
edited. `.data/pg*.env` and the pwfile were not read; nothing was reset; nothing under `.data/` was
deleted. No local device (`CAM-03` / `MIC-03`) was selected, pre-checked or started; no attendance
variable set; nothing was played. Ports 5173-5175, 8000, 5432: nothing listened there at the end. No
emulator was rebooted, no unlock needed, no app data cleared, nothing reinstalled, no Gradle build;
nobody signed in on a device. Run window 16:30-16:35 WIB. Scratch and logs: `.cache/gate-env/wave-m/`.

## 1. What differs from note 09

| Item | Note 09 | Now |
|---|---|---|
| Core lane 1 | PID 13944 | **PID 57048**, `127.0.0.1:4421`, SIMULATED, demo controls on; started as it was, **no reset**; 33 info lines, 0 warn, 0 error since the start; `ws.clients 0` (no device) |
| Core lane 2 | PID 13991 | **PID 57092**, `127.0.0.1:4422`, REAL_DEVELOPMENT, `start 2 --with-camera-stub --speech-mic` redirected to `.cache/gate-env/wave-m/start_2.log` (0600), never piped; **NOT reset** |
| Camera stub ports (inside the lane 2 Core) | 64185 / 53816 / 53817 | **discovery UDP 61980, device TCP 56570, RTSP TCP 56571**; preset `NORMAL` (mode file read, not written) |
| Stub fixture account | made 12:44 | the same file `.locks/camera-stub.lane2.fixture` (0600, `username=` / `secret=`), **made anew at 16:31**; removed at stop. Its content is not written here; the start output copy is `.cache/gate-env/wave-m/start_2.log` (0600). Every earlier account is dead |
| Rigs | seal rig OFF | **two rigs**, both installed at this start, both **OFF** (section 5): seal rig and the new **source rig** (`LANE_SOURCE_RIG_INSTALLED`; the start prints "source rig available ... says: OFF") |
| Web lane 1 / lane 2 | 14142 / 14141 | **PID 57202** (`http://127.0.0.1:5176/`) / **PID 57199** (`http://127.0.0.1:5177/`), restarted; `/` 200, `/api/v1/health` ok on both, `/media/x` 401 on both |
| Metro | PID 14166 | **PID 57226**, restarted on this tree; `Android Bundled ... (6238 modules)`; `packager-status:running` |
| Emulators | 45773 / 45858 | not rebooted (`adb devices`: both `device`, `Awake`, `isKeyguardShowing=false`) |
| Capture devices | 9 | 9, same ids (section 3) |
| Quarantine | 2 folders | **4 folders** (section 3) |
| Evidence | 35 | **48** (section 3) |

Restart order: app force-stopped on both devices, then the three old dev servers stopped by PID, then
`lane.sh start 1 > start_1.log 2>&1`, `lane.sh start 2 --with-camera-stub --speech-mic > start_2.log 2>&1`
(both exit 0), then the web servers and Metro with the forms of note 05 section 6, then the apps
launched with the form of note 06 section 7.4 (`am start -W` answered `Status: timeout`, as before, not a
failure).

## 2. Devices - both on lane 2, at Login

| | Tablet | Phone |
|---|---|---|
| Serial | `emulator-5556` | `emulator-5554` |
| Reverse rules (read before the restart and at the end) | `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422` | `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422` |
| Pairing in `dems_lane_2` | `DEV-0001`, `PAIRED`, online | `DEV-0002`, `PAIRED`, online |
| Screen (uiautomator, after the reload of the bundle) | Login ("Sign In"), `Core online`, `Core: DEMS-IR-01 - paired as DEV-0001`, `v2.4.1` | Login, `Core online`, `Core: DEMS-IR-01 - paired as DEV-0002`, `v2.4.1` |

Lane 2 health: `ws.clients 2` (before and after the smoke). The dev toast "Open debugger to view
warnings." is on both Login screens. Screens: `.cache/gate-env/wave-m/dev_emulator-5554.png`,
`dev_emulator-5556.png`. Lane 1 has no device (note 08 section 3: moving a device is a new pairing).

## 3. Lane 2 - confirmed after the start

| Check | Result |
|---|---|
| Boot log | `LANE_CAMERA_STUB_STARTED`; `LANE_SEAL_RIG_INSTALLED` and `LANE_SOURCE_RIG_INSTALLED` (both "installed and OFF"); `engine started`: `epoch 54, auditTotal 1162, session null, restartFault null, restartFaultEnded false, auditRows 0`; `TRANSCRIBER_RESOLVED` `cpu-local, vad READY`; `CAPTURE_FENCE_PASSED` `registered "", local "CAM-03,MIC-03"`; `CAPTURE_BOOT_CHECKS_PASSED` `checks real, capture-worker/0.5.0`; `CAPTURE_SUPERVISOR_BOOTED` `mode real` |
| `locked` | boot line `CAPTURE_CONFIG_LOADED` `devices 9, revision 2,` **`locked false`**; API `GET capture/config` **`locked false`**, before and after the smoke. They agree |
| Warn lines of the boot (3, all expected) | `INSTALLATION_IDENTITY_NOT_CONFIGURED`; `SEALING_DEVELOPMENT_SEAL_RIG`; `SEALING_QUARANTINE_HOLDS_SESSIONS` `count 4, sessions SES-20261011-0041,-0045,-0052,-0065` |
| Active alerts | **none.** 60 alerts at the start, every one `active false` (40 INFO, 4 WARNING, 16 CRITICAL; the CRITICAL ones: `WORKER_KILLED` x5, `SEAL_BLOCKED` x5, `UNSEALABLE` x4, and `ALR-000016`, `-000039` with no `params.reason`). The newest two, `ALR-000111`, `-000112`, are WARNING `CAPTURE_DEVICE_UNREACHABLE` (from the wave M source-rig drives), inactive |
| Selector | `VIDEO-01 = CAM-01` **`H264_720P30`**, `VIDEO-02 = CAM-02` **`H264_720P30`**, `MIC-01` PRIMARY, `MIC-02` STANDBY; `updatedAt 1791700593972` (13:36:33 WIB), unchanged by this start and by the smoke |
| Session open | none: `session/current` answered `{"session":null}` before the smoke |
| Rigs | `lane.sh seal-rig 2 status` = **OFF**; `lane.sh source-rig 2 status` = **OFF** (read only, before the start, after it and at the end; never switched). Both switch files exist (4 bytes, 0600) and say `OFF` |
| Evidence | **47 items** before the smoke (13 seed incl. clean `EV-20261008-0001` and tampered `EV-20261009-0005`; 34 development items `EV-20261010-0014` .. `EV-20261011-0051`); **48** after (`EV-20261011-0052`, section 4). EXPORTED: `EV-20261010-0014`, `-0015`, `-0016`, `-0020`, `-0022`, `EV-20261011-0029`, `-0032`, `-0033`, `-0043`; `interrupted true`: `EV-20261010-0017`, `-0018`, `EV-20261011-0027`, `-0031`, `-0041`, `-0042`, `-0049`. The 48th item was not re-listed after the smoke (the list call failed in my shell, the item itself was read through ops 40 / 41) |
| Audit chain | `view.ok true`, `stored.ok true`, 1165 rows checked before the smoke, **1174** after it, `firstBadSeq null` |
| Quarantine `.data/media/dems_lane_2/sessions/.quarantine/` | **`SES-20261011-0041`** (48,300 KiB), **`-0045`** (52,252 KiB), **`-0052`** (49,424 KiB), **`-0065`** (54,460 KiB); all `drwx------`; names and sizes only, nothing opened |
| Capture devices (ids) | `CAM-01`, `CAM-02`, `CAM-03` (LOCAL_DEVICE, in no selector), `CAM-04` (dead host `127.0.0.1:64850`), `CAM-05` (dead host `127.0.0.1:50651`), `MIC-01`, `MIC-02`, `MIC-03` (LOCAL_DEVICE, in no selector), `POE-SWITCH` |
| Pairing | `DEV-0001` and `DEV-0002` `PAIRED`, online |

## 4. Smoke on lane 2 through the API (one run each)

| | Check | Result |
|---|---|---|
| (a) | ONE real-capture session on the FAKE sources | **SEALED.** Session **`SES-20261011-0076`**, item **`EV-20261011-0052`**, case `LP/2026/1011-9701`, subject "Wave M Environment Smoke", investigator `OPR-002`. Create 201 -> pre-check 202 -> `ARMED`, outcome PASS -> start 200 -> `RECORDING` 16:33:52.023, `captureDurable true` -> stop 202 (body with a reason) -> `FINALIZING` -> `SEALED`. `stoppedAt` 16:34:39.213, `sealedAt` 16:34:46.709: recording 47.2 s, seal 7.5 s; CLOSE_TRACKS 178 ms, FINALIZE_HASHES 82, FINALIZE_TRANSCRIPT 7097, BUILD_MANIFEST 54, SIGN_MANIFEST 36, STORE_SEALED_PACKAGE 0 |
| (a) | manifest `tracks[].profile` | **`H264_720P30` on both tracks** (`VIDEO-01` / `CAM-01`, `VIDEO-02` / `CAM-02`), read from the stored `session-manifest.json`; op 40 `evidence.files[].profile` also `H264_720P30` x2 |
| (a) | verify (op 41) | **`overall PASS`, 15 of 15**; `manifestOk`, `signatureOk` true; both files stored / plain / chain ok |
| (a) | no `STREAM_PROFILE_DIFFERS` | none: the only new alert is `ALR-000114` (INFO, `MIC_RATE_AT_LIMIT`, inactive) |
| (a) | Core log, error level | **none**: 47 info + 6 warn lines from the smoke's start to after its verify runs, 0 at error level. Warn: `CAPTURE_FIRST_VIDEO_HELD` `CAM-01` and `CAM-02`; `CAPTURE_MIC_RATE_AT_LIMIT` `MIC-01` x4 |
| (a) | `CAPTURE_SUPERVISOR_FAULT_OVER` (wave M's info line) | **not seen** in the window (0 lines): no fault occurred in this session, so the line was not expected to appear. Absence is not proof that it works |
| (b) | op 41 on `EV-20261010-0015` | **`overall PASS`**, 15 of 15 |
| (b) | op 41 on the tampered `EV-20261009-0005` | **`overall TAMPERED`**: V-04, V-06, V-08 FAIL, V-05 SKIPPED, 11 PASS; `manifestOk`, `signatureOk` true; file `VIDEO-02` stored / plain / chain not ok, `plainChecked false` |

The summary of `SES-20261011-0076` was acknowledged (204); the helper's supervisor session was signed
out (204, then 401) and its jar removed (no jar is left in `.cache/gate-env/`). Selector after the
session: unchanged, `locked false`. Both rigs read OFF after the smoke. Answers are in the scratch
folder (`verify_*.json`, `op40_EV-20261011-0052.json`, `alerts_*.json`, `sealing_0076.json`,
`smoke_session.log`, `smoke_session.sh`, `api.sh <lane> <METHOD> <path> [json]`).

## 5. State of lane 2's data now (KEPT - do not reset)

- Evidence: **48 items** = the 47 above + `EV-20261011-0052` (SEALED). Next session `SES-20261011-0077`
  (or the next day's number), next item `-0053`.
- `session/current` = `SES-20261011-0076`, `SEALED`, summary acknowledged; no session open.
- Alerts: 61, **none active**. Audit chain `ok`, 1174 rows at the check, then one acknowledgement and one
  sign-out. My smoke also wrote one supervisor sign-in / sign-out and three verify runs.
- Four quarantined sessions (section 3): a reset of this lane would need
  `--discard-unsealed-fake-recordings` - and lane 2 is NOT to be reset.
- `CAM-04` and `CAM-05` point at dead ports: on no track; do not assign them. A search shows the stub as
  a NEW candidate on device port 56570; an adoption gives the next free id.
- Lane 1: as it was stopped (not reset), nothing signed in, no device.

### The two rigs (both OFF) and the session slot

**Seal rig** (`delegation_progress/contract_wave_k.md` heading S1, item 2; lane 2 only). From the
repository root, outside the sandbox:

```
scripts/lane/lane.sh seal-rig 2 status         # now: OFF
scripts/lane/lane.sh seal-rig 2 blocked        # BEFORE the session is ended: retriable cause SESSION_KEY_STORE_UNAVAILABLE
scripts/lane/lane.sh seal-rig 2 release        # then the product's own retry seals it
scripts/lane/lane.sh seal-rig 2 unsealable     # BEFORE the session is ended: not retriable, SESSION_KEY_NOT_OF_SESSION -> quarantine
scripts/lane/lane.sh seal-rig 2 release        # ALWAYS end with it
```

It binds to ONE FAKE-source session (the switch then reads `BLOCKED <sessionId>` / `UNSEALABLE
<sessionId>`); always end with `release` and read `status`. A BLOCKED seal is retried with "Retry
sealing" on the web Session Monitor (operation 33) or by a Core restart; an UNSEALABLE notice is closed
by a supervisor's acknowledgement (note 09 section 6).

**Source rig** (`delegation_progress/contract_wave_m.md` section "M-S 1"; lane 2 only, effective on the
running lane, no restart):

```
scripts/lane/lane.sh source-rig 2 unreachable <deviceId>   # e.g. CAM-05 or MIC-02; a second call ADDS a device
scripts/lane/lane.sh source-rig 2 release                  # OFF: every rigged source answers again
scripts/lane/lane.sh source-rig 2 status
```

Only a stored `FAKE` CAMERA or MICROPHONE counts; `CAM-03` / `MIC-03` or a production device is never
touched (warn `LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE`). It does not end a source that is already open. Always
end with `release` and read `status`.

**Session slot** (contract_wave_m.md, "Rig use log"): lane 2 has ONE session slot. Take it only while
`session/current` is not open; write "session slot in use by <who> from <time>" and "session slot free"
in that log (and "rig in use by <who> from <time>" / "rig free" for either rig). My smoke ran before any
other driver held the slot and wrote nothing into that log (I was told to touch only this note); the slot
and both rigs are free now.

## 6. Tooling notes

Unchanged from note 09 section 7 (uiautomator hangs on Session Live / Home while recording; tablet rows
below y 1500 need a scroll; a helper session expires 15 minutes after its last POST; cut a device's link
with `adb reconnect` and restore BOTH reverse rules; media volume read back as 0 before any playback; a
stop without a reason is refused 422). Session helper:
`npx tsx .cache/gate-env/gate-session.mts <1|2|3|main> <ROLE>` (outside the sandbox). Op used beyond
note 09: `POST session/{id}/summary/acknowledge` (op 37, 204).

## 7. STOP procedure

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5554 reverse --remove-all
adb -s emulator-5556 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5556 reverse --remove-all
kill -TERM $(lsof -nP -t -iTCP:8081 -sTCP:LISTEN)      # Metro (57226)
kill -TERM $(lsof -nP -t -iTCP:5176 -sTCP:LISTEN)      # web lane 1 (57202)
kill -TERM $(lsof -nP -t -iTCP:5177 -sTCP:LISTEN)      # web lane 2 (57199)
scripts/lane/lane.sh seal-rig 2 status                 # must say OFF before the stop; else: seal-rig 2 release
scripts/lane/lane.sh source-rig 2 status               # same: else: source-rig 2 release
scripts/lane/lane.sh stop 1 ; scripts/lane/lane.sh stop 2 ; scripts/lane/lane.sh status
```

Outside the sandbox. Stopping lane 2 stops the stub and removes its fixture file; its data stays. NO reset
of lane 2 afterwards. After `reverse --remove-all` both devices keep their lane 2 credential: restore
`tcp:8081 -> 8081`, `tcp:4420 -> 4422` on both before the next launch. Restart forms: section 1 and note
05 section 6. PostgreSQL (PID 32505, `127.0.0.1:4432`) stays up. Emulators: the controller's or the user's
call.

## 8. Not proven / limits

- No flow on a device or in a browser: the session was driven through the API; devices were only
  relaunched on the new bundle and read at Login. Neither rig was switched.
- `CAPTURE_SUPERVISOR_FAULT_OVER` could not be observed because the smoke had no fault.
- The evidence count after the smoke (48) is 47 read + the one new item, not a second list read.
- The Core log window of the smoke includes the three verify runs after the seal.
- Host load 1.39 at the start, 1.95 at the end (1-minute).

---
*Generated: 2026-10-11 16:38 WIB*
