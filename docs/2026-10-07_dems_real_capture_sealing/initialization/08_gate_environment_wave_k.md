---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: device / browser environment for the targeted re-checks after fix wave K
date: 2026-10-11
agent: coder-execution (environment; rules D94 / D122 / D163)
narrative_tier: 3
status: needs-review - both lanes up on the wave K tree and left running, the phone is on lane 2 as DEV-0002; ONE smoke expectation did not hold (section 4 (a): the manifest profile is not H264_720P30 and the STREAM_PROFILE_DIFFERS notice was raised)
builds_on: initialization/06_gate_environment_regate.md and 07_gate_environment_wave_i.md (both kept unchanged; note 06 sections 7.2 presets, 7.3, 7.5, 7.6, 7.7 are still true and are cited, not repeated)
---

# 08 - Gate environment on fix wave K (left running)

Working tree = `57b80a9` + the staged fix wave K (a git agent commits it in parallel; HEAD read as
`57b80a9` at 03:25). No product source, test or doc edited except this note; no git write.
`.data/pg*.env` and the pwfile were not read; database commands went through
`scripts/lane/lane.sh` only. No local device (`CAM-03` / `MIC-03`) was selected, pre-checked or
started; no attendance variable set; nothing was played. Ports 5173-5175, 8000, 5432: nothing
listened there at the start or the end. No emulator was rebooted; no unlock was needed; no app
data was cleared, nothing reinstalled, no Gradle build. Run window 03:25-03:32 WIB. Scratch and
logs: `.cache/gate-env/wave-k/`.

## 1. What differs from notes 06 / 07

| Item | Note 07 | Now |
|---|---|---|
| Core lane 1 | PID 49865 | **PID 52989**, `127.0.0.1:4421`, SIMULATED, demo controls on; RESET before the start (`reset 1` exit 0, audit head `seq 83`, v2 demo packages `NOT generated`) |
| Core lane 2 | PID 49915 | **PID 53035**, `127.0.0.1:4422`, REAL_DEVELOPMENT, `--with-camera-stub --speech-mic`; **NOT reset** - its data is kept (section 5) |
| Camera stub ports (inside the lane 2 Core) | 64235 / 59971 / 59972 | **discovery UDP 53892, device TCP 65503, RTSP TCP 65504** |
| Seal rig | did not exist | installed at the start, **OFF** (section 6) |
| Web lane 1 / lane 2 | 49995 / 50013 | **PID 53106** (`http://127.0.0.1:5176/`) / **PID 53124** (`http://127.0.0.1:5177/`), restarted; `/` 200, `/api/v1/health` ok, `/media/x` 401 on both |
| Metro | PID 50037, 6231 modules | **PID 53148**, restarted on this tree; `Android Bundled ... (6234 modules)` |
| Emulators | 45773 / 45858 | the same two processes, not rebooted |
| Phone `emulator-5554` | lane 1, `DEV-0001` of `dems_lane_1` | **lane 2, `DEV-0002` of `dems_lane_2`** (section 3) |
| Tablet `emulator-5556` | lane 2, `DEV-0001` | unchanged: lane 2, `DEV-0001` |
| Stub fixture account | in `.locks/camera-stub.lane2.fixture` | the same file, **made anew at 03:25** (0600, `username=` / `secret=`; removed at stop). Not written here. The start output copy `.cache/gate-env/wave-k/start_2.log` is 0600. Every earlier account is dead |
| Worker build, `capture:dev-setup`, Gradle | not run | not run: only `apps/capture-worker/README.md` is newer than the binary; `apps/mobile/package.json`, `app.json`, `android/` and the lockfile are unchanged in the working tree |

Starts: `scripts/lane/lane.sh start 1 > .cache/gate-env/wave-k/start_1.log`;
`scripts/lane/lane.sh start 2 --with-camera-stub --speech-mic > .cache/gate-env/wave-k/start_2.log`
(redirected, never piped). The lane 2 start now ends with `seal rig available (development tool):
switch .../.locks/seal-rig.lane2.switch says: OFF`. Web servers and Metro: the forms of note 05
section 6.

## 2. Lane 2 - confirmed after the start

| Check | Result |
|---|---|
| Boot log | `LANE_CAMERA_STUB_STARTED` (ports above); `LANE_SEAL_RIG_INSTALLED` ("installed and OFF"); `engine started`: `epoch 47, auditTotal 513, session SEALED, restartFault null, restartFaultEnded false, auditRows 0`; `CAPTURE_FENCE_PASSED` `registered "", local "CAM-03,MIC-03"`; `CAPTURE_BOOT_CHECKS_PASSED` `checks real, capture-worker/0.5.0`; `CAPTURE_CONFIG_LOADED` `devices 8, revision 2, locked true` (the API reads `locked false`, see below); warn `INSTALLATION_IDENTITY_NOT_CONFIGURED` (expected), warn `SEALING_DEVELOPMENT_SEAL_RIG` (new, expected: the rig exists) |
| Active alerts | **none.** 14 alerts at the start, all `active false` with `resolvedAt`. `ALR-000016` (CRITICAL, `POWER_FAIL`): `active false`, `resolvedAt 1791657590480` = 01:39:50 WIB - it was healed at an EARLIER wave K start of this lane, not at mine (so this start says `restartFaultEnded false` and wrote no `FAULT_CLEARED` row: `auditRows 0`) |
| Selector (`GET capture/config`) | `VIDEO-01 = CAM-01` profile **`H264_720P30`**, `VIDEO-02 = CAM-02` profile **`H264_720P30`**, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`, `updatedAt 1791657590572` (01:39:50 WIB). **Selector revision 2** (boot line; the API answer carries no revision member). The correction was made at that earlier start: `DEV_GENERATED_SOURCE_PROFILE_STATED` is NOT in this start's log (it is logged once, when the line is corrected) |
| Session open | none: `session/current` = `SES-20261011-0035`, state `SEALED` (the last sealed one) |
| `lane.sh seal-rig 2 status` | `seal rig of lane 2: OFF` (read only; not switched; the switch file does not exist while it is OFF) |
| Evidence list | **24 items** at the start: 13 seed (incl. clean `EV-20261008-0001` and tampered `EV-20261009-0005`) + **11 sealed development items**: `EV-20261010-0014` .. `-0022` (9; `-0014`, `-0016`, `-0020`, `-0022` EXPORTED; `-0017`, `-0018` interrupted) and `EV-20261011-0023`, `-0024`. All 11 carry `transcriptModel` on the list row and transcript state `READY` |
| Audit chain (`GET audit/chain`) | `view.ok true`, `stored.ok true`, 515 rows checked, `firstBadSeq null` |
| Capture devices | `CAM-01`, `CAM-02` (FAKE), `CAM-03` (LOCAL_DEVICE, in no selector), **`CAM-04`** (FAKE, `FAKE-CAM-1`, host `127.0.0.1:64850` - a dead port, on no track), `MIC-01`, `MIC-02` (FAKE), `MIC-03` (LOCAL_DEVICE, in no selector), `POE-SWITCH` |
| Stub preset | `NORMAL` |

Open point, not judged: the boot line says `locked true` for the capture-config store while the
API says `locked false` and no session is open.

## 3. Devices - BOTH are on lane 2

| | Tablet | Phone |
|---|---|---|
| Serial | `emulator-5556` | `emulator-5554` |
| Lane | 2 | **2** (decision D223 (4)) |
| Reverse rules | `tcp:8081 -> 8081`, `tcp:4420 -> 4422` | `tcp:8081 -> 8081`, **`tcp:4420 -> 4422`** |
| Pairing in `dems_lane_2` | `DEV-0001`, code `PCD-000001`, online | **`DEV-0002`**, code `PCD-000002`, online |
| Screen (uiautomator) | Login, `Core online`, `Core: DEMS-IR-01 - paired as DEV-0001`, `v2.4.1` | Login, `Core online`, `Core: DEMS-IR-01 - paired as DEV-0002`, `v2.4.1` |

How the phone was moved (the procedure of note 05 section 3.3, now PROVEN once):

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet
adb -s emulator-5554 reverse tcp:4420 tcp:4422
adb -s emulator-5554 shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=LIVE&motion=off" com.dems.demo.tablet'
```

The app asked lane 2 for its registration, got 401, deleted its lane 1 credential by itself (Metro
log: "The Core does not know the stored device credential; it is deleted") and opened **Pair this
tablet** ("Tablet not registered"). No unpair control, no data clear, no reinstall was needed. The
code was issued through op 15 (`POST pairing/code` `{}`, 201, `PCD-000002`) with the supervisor
session of the helper and typed into the app's 6-digit field by a script that never printed it;
"Pair" -> Login. The dev toast lay over the code field and was closed with its X first. Lane 2's
Core reports `ws.clients 2`. Nobody signed in on a device, so no biometric offer appeared.

Lane 1's database still holds its `DEV-0001` row (the phone's old pairing), now offline and dead on
the device side; lane 1 has NO device at the moment.

Screens: `.cache/gate-env/wave-k/dev_emulator-5554_lane2.png`, `dev_emulator-5556_lane2.png`,
`phone_pair.png` (the Pair screen before the code).

**The two overlays (unchanged, note 06 section 7.4):** after a sign-in answer "Enable biometric
sign-in?" with **"Not now"**; close the dev toast **"Open debugger to view warnings."** with its
X before tapping or judging what is under it (phone: about x 996, y 2231 on the 1080 x 2424
screen; it returns after every reload; on the tablet it is on the Login now).

### Putting the phone back on lane 1 (a NEW pairing again)

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet
adb -s emulator-5554 reverse tcp:4420 tcp:4421
adb -s emulator-5554 shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=LIVE&motion=off" com.dems.demo.tablet'
# -> Pair screen. Issue a code on lane 1: web console http://127.0.0.1:5176/ as the Supervisor,
#    Paired Devices (/admin/devices) -> Pair a device; or POST pairing/code {} with the helper's lane 1 jar.
#    Type the 6 digits within 5 minutes. The phone becomes DEV-0002 of dems_lane_1 (or DEV-0001 after a reset
#    that keeps no pairing - read it from GET pairing/devices).
```

Lane 2 then keeps a `DEV-0002` row that is offline; revoke it on lane 2's Paired Devices page if a
re-check must not see it. Never change `tcp:4420` under a running app.

## 4. Smoke on lane 2 through the API (one run each)

| | Check | Result |
|---|---|---|
| (a) | ONE real-capture session on the FAKE sources | **SEALED.** Session `SES-20261011-0036`, item **`EV-20261011-0025`**, case `LP/2026/1011-9101`, subject "Wave K Environment Smoke", investigator `OPR-002`. Create 201 -> pre-check 202 -> `ARMED`, outcome PASS -> start 200, `RECORDING` 03:29:20.699, `captureDurable true` -> stop 202 (body with a reason) -> `FINALIZING` -> `SEALED`. `stoppedAt` 03:30:12.890, `sealedAt` 03:30:20.424: recording 52.2 s, seal 7.5 s; CLOSE_TRACKS 203 ms, FINALIZE_HASHES 91 ms, FINALIZE_TRANSCRIPT 7095 ms. 51,864,198 bytes; VIDEO-01 22 fragments, VIDEO-02 21 |
| (a) | manifest `tracks[].profile` = `H264_720P30` | **NOT MET.** `session-manifest.json` of the package states `VIDEO-01` (`CAM-01`): **`H264_720P27.67`**, `VIDEO-02` (`CAM-02`): **`H264_720P26`** |
| (a) | NO `STREAM_PROFILE_DIFFERS` notice | **NOT MET.** Alert `ALR-000033`: WARNING, `active false`, target `SES-20261011-0036`, `params.reason STREAM_PROFILE_DIFFERS`, `params.tracks "VIDEO-01:H264_720P27.67:H264_720P30,VIDEO-02:H264_720P26:H264_720P30"`; Core log warn `SEALING_STREAM_PROFILE_DIFFERS` at the seal |
| (a) | verify (op 41) | **`overall PASS`, 15 of 15**; `manifestOk`, `signatureOk` true; both files stored / plain / chain ok. Answer: `.cache/gate-env/wave-k/verify_EV-20261011-0025.json` |
| (a) | error-level lines between stop and sealed | **none** (27 lines in the window, 0 at level 50). The five `ASSEMBLY_REFUSED` / `TRANSCRIPT_NOT_COMPLETE` lines of note 07 did not appear. Warn lines in the window: `SEALING_STREAM_PROFILE_DIFFERS` (above) and one `transcriber log entry` (`transcriber.runner.clamp`, chunk 1, `clamped 1, dropped 0`). Earlier in the session: `CAPTURE_FIRST_VIDEO_HELD` `CAM-01` 1572 ms, `CAM-02` 3121 ms; `CAPTURE_MIC_RATE_AT_LIMIT` (alert `ALR-000032`, INFO, inactive) |
| (b) | op 88 (`POST evidence/EV-20261011-0025/media-sessions`) with `{"seekIndex":true}` | 201, member **`seekIndex` present** (`true`). Control, body `{}`: 201, `seekIndex` **absent**. No media was fetched or played |
| (c) | op 41 on `EV-20261010-0015` | `overall PASS`, 15 of 15 |
| (c) | op 41 on `EV-20261010-0017` (interrupted) | `overall PASS`, 15 of 15 |
| (c) | op 41 on the tampered `EV-20261009-0005` | **`overall TAMPERED`**: V-04 FAIL (`FRAGMENT_HASH_MISMATCH`, `FILE_HASH_MISMATCH`), V-06 FAIL (`CHAIN_BROKEN`), V-08 FAIL (`FRAGMENT_TAMPERED`), V-05 SKIPPED, 11 PASS; file `VIDEO-02` answers `plainOk false, plainChecked false` (the KR member is live) |
| (c) | op 41 on the clean `EV-20261008-0001` | `overall PASS`, 15 of 15 |

**Finding of (a), for the controller (not fixed, not re-run - the brief says one run):** the
selector says `H264_720P30` on both lines (contract KR item 4 holds), but the seal's MEASURED frame
rate was 27.67 and 26, so the manifest does not state `H264_720P30` and the notice is raised. For
comparison, read from the stored manifests: `EV-20261010-0022`, `EV-20261011-0023`, `-0024` all
state `H264_1080P25` (sealed before the 01:39 correction, by older code), so
`EV-20261011-0025` is the first item of this lane sealed with the corrected selector on the
running wave K code. Facts that may bear on it: the fragment durations of the file are irregular
(VIDEO-01: 2595, 3053, 2070, 3064, 3054, 3069 ms; VIDEO-02: 4137, 2062, 2060, 3055, 3068, 3086 ms)
and the first video was held (`skipped.beforeKeyframe 29` on both). Host load was 2.6 during the
run. Whether this is the generator's delivery, the measurement of `streamProfileOf`, or load is not
established here; one run cannot tell a flake from a defect.

## 5. State of lane 2's data now (KEPT, not pristine - do not reset)

- Evidence: **25 items** = the 24 of section 2 + `EV-20261011-0025` (v2, SEALED, transcript READY).
  The next session is `SES-20261011-0037` (or the next day's number), the next item `-0026`.
- `session/current` returns `SES-20261011-0036` in state `SEALED`; its summary was ACKNOWLEDGED by
  the smoke (204). No session is open.
- Store: `.data/media/dems_lane_2/sessions/SESSION-SES-20261011-0036/` (manifest, signature,
  certificate, audit extract, `fragments/`, `transcript/`); its session key (`.key`, `.blob`) is in
  the session-key folder.
- Alerts: 16, **none active**; new: `ALR-000032` (INFO, `MIC_RATE_AT_LIMIT`), `ALR-000033`
  (WARNING, `STREAM_PROFILE_DIFFERS`).
- Audit chain: `ok`, 531 rows at 03:31, then one sign-out.
- Pairing: `DEV-0001` (tablet), `DEV-0002` (phone); codes `PCD-000001`, `PCD-000002` used.
- My smoke also wrote: one supervisor sign-in / sign-out, five verify runs, two media sessions of
  op 88 (issued, never fetched), one pairing code.
- Selector unchanged after the session (`H264_720P30` twice, `locked false`).
- Lane 1: seed only (reset at 03:25), nothing signed in, no device.

## 6. The seal rig (contract_wave_k.md heading S1, item 2) - it is OFF

Lane 2 only, installed by this start. Drive it from the repository root, outside the sandbox:

```
scripts/lane/lane.sh seal-rig 2 status         # now: OFF
scripts/lane/lane.sh seal-rig 2 blocked        # BEFORE the session is ended: retriable cause SESSION_KEY_STORE_UNAVAILABLE
#   end a session recorded on CAM-01, CAM-02, MIC-01, MIC-02: attempts at t+0, +5 s, +35 s, +155 s,
#   then the CRITICAL alert params.reason SEAL_BLOCKED; the session stays FINALIZING
scripts/lane/lane.sh seal-rig 2 release        # then the product's own retry (the session's recovery action,
#   or the next automatic retry if released before t+155 s, or the next start) seals it; verify PASS
scripts/lane/lane.sh seal-rig 2 unsealable     # BEFORE the session is ended: not retriable, SESSION_KEY_NOT_OF_SESSION
#   attempts at t+0, +5 s, +35 s, then: recordings moved to <media root>/.quarantine/<sessionId>/,
#   SESSION_INCOMPLETE (UNSEALABLE), one CRITICAL alert, no open session
scripts/lane/lane.sh seal-rig 2 release        # ALWAYS end with it
```

It binds to ONE session (the first whose seal it meets; the switch file then reads
`BLOCKED <sessionId>` / `UNSEALABLE <sessionId>`), touches only sessions recorded from FAKE sources,
writes or reads no key file. Core log while on: `LANE_SEAL_RIG_BOUND` (warn). After an UNSEALABLE
run lane 2 holds a quarantine folder: its next reset would need
`--discard-unsealed-fake-recordings` - and lane 2 is NOT to be reset during the re-checks.
A restart of lane 2 installs the rig again, OFF.

## 7. What a re-check must not do

Everything of note 06 section 7.7 and note 07 section 7, and:
- **Do not reset lane 2** and do not delete anything under `.data/`: the sealed items, their
  exports and revisions, the demo items and `CAM-04` are what the re-checks read.
- Do not leave the seal rig on: end every rig case with `seal-rig 2 release` and read `status`.
- Do not take the profile of smoke (a) as settled: section 4's finding is open.
- Do not use an earlier fixture account; read `.locks/camera-stub.lane2.fixture` and keep its
  content, every pairing code, password and token out of reports.
- `CAM-04` points at a dead port: do not assign it to a track. A search shows the stub as a NEW
  candidate on device port 65503; an adoption gives the next free id.
- Never select, pre-check or start `CAM-03` / `MIC-03`; never set an attendance variable.
- Playback on a device: media volume 0 first (`adb -s <serial> shell cmd media_session volume
  --stream 3 --set 0` - a form I did NOT run or verify here; read the volume back before trusting
  it) - nothing is played aloud. I played nothing and did not set the volume.
- Devices: unlock only through `script -q /dev/null apps/mobile/scripts/emulator-user-lock.sh
  unlock <phone|tablet> </dev/null` (after a reboot only); never set / change / remove a lock,
  never `adb emu finger`, biometric offer "Not now".
- A stop without a reason is refused (422) and leaves the session RECORDING: body
  `{"reason":"<5 characters or more>"}`.
- Never pipe `lane.sh start`. Never ports 5173-5175, 8000, 5432. Never `.data/pg*.env`.
- Both devices are on lane 2 now: a session started on one is seen on the other.

## 8. Session helper

Unchanged: `npx tsx .cache/gate-env/gate-session.mts <1|2|3|main> <ROLE>` (outside the sandbox),
jar `.cache/gate-env/session_lane<N>_<ROLE>.jar`, origin `http://127.0.0.1:517N`. My lane 2 session
was signed out (204, then 401) and its jar removed. Scratch of this run:
`.cache/gate-env/wave-k/api.sh` (`api.sh <lane> <METHOD> <path> [json]`), `smoke_session.sh`,
`smoke_session.log`, `verify_*.json`. Routes used beyond notes 06 / 07: `POST pairing/code` (op 15),
`POST evidence/{id}/media-sessions` (op 88; body `{"seekIndex":true}` or `{}`; never print `url`).

## 9. STOP procedure

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5554 reverse --remove-all
adb -s emulator-5556 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5556 reverse --remove-all
kill -TERM $(lsof -nP -t -iTCP:8081 -sTCP:LISTEN)      # Metro (53148)
kill -TERM $(lsof -nP -t -iTCP:5176 -sTCP:LISTEN)      # web lane 1 (53106)
kill -TERM $(lsof -nP -t -iTCP:5177 -sTCP:LISTEN)      # web lane 2 (53124)
scripts/lane/lane.sh seal-rig 2 status                 # must say OFF before the stop; else: seal-rig 2 release
scripts/lane/lane.sh stop 1 ; scripts/lane/lane.sh stop 2 ; scripts/lane/lane.sh status
```

Run it outside the sandbox. Stopping lane 2 stops the stub and removes its fixture file; its data
stays. NO reset of lane 2 afterwards. With `reverse --remove-all` the phone keeps its lane 2
credential: restore `tcp:8081 -> 8081`, `tcp:4420 -> 4422` on both devices before the next launch.
Restart forms: section 1. Emulators: no project script stops one; that is the controller's or the
user's call. PostgreSQL (PID 32505, `127.0.0.1:4432`) stays up.

## 10. Not proven / limits

- Smoke (a)'s profile expectation failed once; no second run, no diagnosis (section 4).
- No flow on a device or in a browser beyond the phone's pairing: the session was driven through
  the API; the sealed player, the seek on the indexed view and camera discovery in the phone
  layout were NOT driven. Op 88 was only asked; no byte of media was fetched.
- The seal rig was read (`status`), not switched: neither rig case was exercised.
- The heal of `ALR-000016` and the selector correction happened at an earlier wave K start
  (01:39:50 WIB); this start only confirms their result, not the act.
- `locked true` on the boot line against `locked false` on the API: observed, not explained.
- No web screenshot, no lane 1 smoke beyond health (ok, ready) and its log (32 info lines, 0 warn,
  0 error).
- Host load 3.44 at the start, 2.32 at the end.

## After fix 151 (2026-10-11 03:46 WIB)

The finding of section 4 (a) is diagnosed and fixed: `implementation/151_fix_manifest_profile_declared.md`.
Cause: the wave K frame rate was MEASURED over a span that holds the first video sample (1.572 s and
3.121 s here); the streams declare, and were delivered at, 30 per second. Field 36 now states what the
stream declares. Sections 1-10 above are kept as written; these facts replace theirs:

| Item | Now |
|---|---|
| Core lane 2 | **PID 55401**, `127.0.0.1:4422`, REAL_DEVELOPMENT, restarted with `lane.sh stop 2` then `start 2 --with-camera-stub --speech-mic` (redirected to `.cache/gate-env/fix-151/start_2.log`, 0600; NOT reset). Boot: `epoch 48, auditTotal 532, session SEALED, restartFault null, auditRows 0`; `CAPTURE_CONFIG_LOADED` `devices 8, revision 2` |
| Camera stub ports | **discovery UDP 62854, device TCP 50651, RTSP TCP 50652**; preset `NORMAL`; a search shows the stub as a NEW candidate on device port 50651 |
| Stub fixture account | the same file, **made anew at this start**; every earlier account is dead. Not written here |
| Seal rig | installed again, **OFF** (`seal-rig 2 status` read; not switched) |
| Smoke of fix 151 | `SES-20261011-0037` -> **`EV-20261011-0026`** (case `LP/2026/1011-9151`), 52.2 s on `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`; manifest `tracks[].profile` **`H264_720P30`** on both tracks; **no** `STREAM_PROFILE_DIFFERS`; verify PASS 15 of 15. `EV-20261011-0025` and `EV-20261010-0015`: verify PASS 15 of 15 |
| Lane 2 data | **26 items** (the 25 of section 5 + `-0026`); next session `SES-20261011-0038`, next item `-0027`. `session/current` = `SES-20261011-0037`, `SEALED`, summary acknowledged; no session open. 17 alerts, none active. Audit chain `ok`, 544 rows, then one sign-out. `EV-20261011-0025` keeps `H264_720P27.67` / `H264_720P26` and `ALR-000033` (sealed: not rewritten) |
| Selector | unchanged: `CAM-01` / `CAM-02` `H264_720P30`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` |
| Devices | both still paired to lane 2 and online after the restart: `pairing/devices` `DEV-0001`, `DEV-0002` `PAIRED`, online; health `ws.clients 2`; uiautomator on both: "Core online", "paired as DEV-0001" (tablet `emulator-5556`), "paired as DEV-0002" (phone `emulator-5554`); reverse rules unchanged. Nothing else was done on a device |
| Lane 1, web 5176 / 5177, Metro | unchanged (lane 1 PID 52989, not stopped) |
| Helper | lane 2 supervisor session signed out (204, then 401), jar removed. Scratch: `.cache/gate-env/fix-151/` (`smoke_session.sh`, `smoke_session.log`, `verify_*.json`) |

Section 7's line "Do not take the profile of smoke (a) as settled" is closed by this section.
The STOP procedure of section 9 holds with the new PIDs (it reads them from the ports).

---
*Generated: 2026-10-11 03:33 WIB*
*Last Updated: 2026-10-11 03:50 WIB (section "After fix 151")*
