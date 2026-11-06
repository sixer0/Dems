---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: device / browser environment for the final re-checks after fix wave L
date: 2026-10-11
agent: coder-execution (environment; rules D94 / D122 / D163)
narrative_tier: 3
status: complete - both lanes up on the wave L tree and left running, both devices on lane 2 at Login, every smoke expectation held
builds_on: initialization/08_gate_environment_wave_k.md with 06 and 07 (all kept unchanged; note 06 sections 7.2 presets, 7.3, 7.5, 7.6, 7.7 and note 08 sections 3, 6, 7 are still true and are cited, not repeated)
---

# 09 - Gate environment on fix wave L (left running)

Tree = fix wave L (HEAD read as `b05106b` with the wave staged at 12:44; `7b1aded` at 12:49, after
the git agent's commit). No product source, test or doc edited except this note; no git write.
`.data/pg*.env` and the pwfile were not read; nothing was reset; nothing under `.data/` was deleted.
No local device (`CAM-03` / `MIC-03`) was selected, pre-checked or started; no attendance variable
set; nothing was played. Ports 5173-5175, 8000, 5432: nothing listened there at the start or the
end. No emulator was rebooted; no unlock was needed; no app data cleared, nothing reinstalled, no
Gradle build; nobody signed in on a device. Run window 12:44-12:49 WIB. Scratch and logs:
`.cache/gate-env/wave-l/`.

## 1. What differs from note 08

| Item | Note 08 ("After fix 151") | Now |
|---|---|---|
| Core lane 1 | PID 52989 | **PID 13944**, `127.0.0.1:4421`, SIMULATED, demo controls on; started as it was, **no reset**; 33 info lines, 0 warn, 0 error since the start; `ws.clients 0` (no device) |
| Core lane 2 | PID 55401 | **PID 13991**, `127.0.0.1:4422`, REAL_DEVELOPMENT, `start 2 --with-camera-stub --speech-mic` redirected to `.cache/gate-env/wave-l/start_2.log` (0600), never piped; **NOT reset** |
| Camera stub ports (inside the lane 2 Core) | 62854 / 50651 / 50652 | **discovery UDP 64185, device TCP 53816, RTSP TCP 53817**; preset `NORMAL` (mode file read, not written) |
| Stub fixture account | made at 03:43 | the same file `.locks/camera-stub.lane2.fixture` (0600, `username=` / `secret=`), **made anew at 12:44**; removed at stop. Its content is not written here. The start output copy is `.cache/gate-env/wave-l/start_2.log` (0600). Every earlier account is dead |
| Seal rig | installed, OFF | installed again at this start, **OFF** (section 5) |
| Web lane 1 / lane 2 | 53106 / 53124 | **PID 14142** (`http://127.0.0.1:5176/`) / **PID 14141** (`http://127.0.0.1:5177/`), restarted; `/` 200, `/api/v1/health` ok and ready, `/media/x` 401 on both |
| Metro | PID 53148, 6234 modules | **PID 14166**, restarted on this tree; `Android Bundled ... (6238 modules)` |
| Emulators | 45773 / 45858 | the same two processes, not rebooted; both `Awake`, `isKeyguardShowing=false` |
| Devices | both on lane 2 | unchanged: both on lane 2 (section 3) |
| Capture devices | 8 | **9**: `CAM-05` added by a re-check (section 2) |
| Worker build, `capture:dev-setup`, Gradle | not run | not run; `apps/mobile/package.json`, `app.json`, `android/` and the lockfile show no change in the working tree |

The three old dev servers (53106, 53124, 53148) were stopped by PID after a `force-stop` of the app
on both devices, and started with the forms of note 05 section 6. In the scratch folder the earlier
`start_1.log` (10:36, wave L driver) was kept as `start_1_earlier_1036.log`; `start_1.log` is this
start's.

## 2. Lane 2 - confirmed after the start

| Check | Result |
|---|---|
| Boot log | `LANE_CAMERA_STUB_STARTED` (ports above); `LANE_SEAL_RIG_INSTALLED` ("installed and OFF"); `engine started`: `epoch 52, auditTotal 869, session SEALED, restartFault null, restartFaultEnded false, auditRows 0`; `TRANSCRIBER_RESOLVED` `cpu-local, vad READY`; `CAPTURE_FENCE_PASSED` `registered "", local "CAM-03,MIC-03"`; `CAPTURE_BOOT_CHECKS_PASSED` `checks real, capture-worker/0.5.0` |
| `locked` - boot line | `CAPTURE_CONFIG_LOADED` `devices 9, revision 2,` **`locked false`** (note 08 read `locked true` here; wave L fixed the line) |
| `locked` - API | `GET capture/config`: **`locked false`**, before and after the smoke. The two agree |
| Warn lines of the boot (3, all expected) | `INSTALLATION_IDENTITY_NOT_CONFIGURED`; `SEALING_DEVELOPMENT_SEAL_RIG`; **`SEALING_QUARANTINE_HOLDS_SESSIONS`** `count 2, sessions SES-20261011-0041,SES-20261011-0045` (new against note 08) |
| Active alerts (`GET alerts`) | **none.** 36 alerts at the start, every one `active false`. The CRITICAL ones, all inactive: `ALR-000011`, `-000052` (`WORKER_KILLED`); `-000016`, `-000039` (no `params.reason`); `-000046`, `-000059`, `-000067` (`SEAL_BLOCKED`, sessions `-0040`, `-0044`, `-0047`); `-000049`, `-000062` (`UNSEALABLE`, sessions `-0041`, `-0045`, both `acknowledged true`) |
| Selector (`GET capture/config`) | `VIDEO-01 = CAM-01` **`H264_720P30`**, `VIDEO-02 = CAM-02` **`H264_720P30`**, `MIC-01` PRIMARY, `MIC-02` STANDBY, `updatedAt 1791691013336` (10:56:53 WIB) |
| Session open | none: `session/current` = `SES-20261011-0047`, state `SEALED` (the last sealed one) |
| `lane.sh seal-rig 2 status` | `seal rig of lane 2: OFF` (read only). The switch file exists now and says `OFF` (4 bytes, 11:09) |
| Evidence list | **34 items** at the start (the brief said 35+; 34 is what the list returns, `nextCursor null`): 13 seed (incl. clean `EV-20261008-0001`, tampered `EV-20261009-0005`) + 21 sealed development items `EV-20261010-0014` .. `EV-20261011-0036`. Ids `-0030` and `-0034` do not exist (the two quarantined sessions). EXPORTED: `-0014`, `-0015`, `-0016`, `-0020`, `-0022`, `-0029`, `-0032`, `-0033`; `interrupted true`: `-0017`, `-0018`, `-0027`, `-0031`; all 21 transcript `READY` |
| Audit chain (`GET audit/chain`) | `view.ok true`, `stored.ok true`, **872 rows** checked, `firstBadSeq null` |
| Quarantine `.data/media/dems_lane_2/sessions/.quarantine/` | **`SES-20261011-0041`** (48,300 KiB, 08:38) and **`SES-20261011-0045`** (52,252 KiB, 10:50); both `drwx------`; names and sizes only, nothing opened |
| Capture devices | `CAM-01`, `CAM-02` (FAKE), `CAM-03` (LOCAL_DEVICE, in no selector), `CAM-04` (FAKE, host `127.0.0.1:64850`, dead), **`CAM-05`** (FAKE, `FAKE-CAM-1`, host `127.0.0.1:50651`, dead), `MIC-01`, `MIC-02` (FAKE), `MIC-03` (LOCAL_DEVICE, in no selector), `POE-SWITCH` |
| Pairing (`GET pairing/devices`) | `DEV-0001` and `DEV-0002` `PAIRED`, online; health `ws.clients 2` |

## 3. Devices - both on lane 2, at Login

| | Tablet | Phone |
|---|---|---|
| Serial | `emulator-5556` | `emulator-5554` |
| Reverse rules (read back before the launch and at the end) | `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422` | `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422` |
| Pairing in `dems_lane_2` | `DEV-0001`, online | `DEV-0002`, online |
| Screen (uiautomator, after the relaunch on the new bundle) | Login, `Core online`, `Core: DEMS-IR-01 - paired as DEV-0001`, `v2.4.1` | Login, `Core online`, `Core: DEMS-IR-01 - paired as DEV-0002`, `v2.4.1` |
| Sign-in fields | both show only their hint (text equals the hint attribute; content not printed) | the same |

The app was force-stopped on both before the restarts and launched with the form of note 06 section
7.4 (`am start -W` answered `Status: timeout` on the cold Metro, as before - not a failure). The dev
toast "Open debugger to view warnings." is on both Login screens. Nobody signed in, so no biometric
offer appeared. Screens: `.cache/gate-env/wave-l/dev_emulator-5554.png`, `dev_emulator-5556.png`.
Lane 1 has no device (note 08 section 3 says how to move the phone back - a new pairing).

## 4. Smoke on lane 2 through the API (one run each)

| | Check | Result |
|---|---|---|
| (a) | ONE real-capture session on the FAKE sources | **SEALED.** Session **`SES-20261011-0048`**, item **`EV-20261011-0037`**, case `LP/2026/1011-9601`, subject "Wave L Environment Smoke", investigator `OPR-002`. Create 201 -> pre-check 202 -> start 200, `RECORDING` 12:47:34.033, `captureDurable true` -> stop 202 (body with a reason) -> `FINALIZING` -> `SEALED`. `stoppedAt` 12:48:21.222, `sealedAt` 12:48:28.757: recording 47.2 s, seal 7.5 s, `resumed false`; CLOSE_TRACKS 182 ms, FINALIZE_HASHES 91, FINALIZE_TRANSCRIPT 7091, BUILD_MANIFEST 62, SIGN_MANIFEST 31, STORE_SEALED_PACKAGE 0 |
| (a) | manifest `tracks[].profile` | **`H264_720P30` on both tracks** (`VIDEO-01` / `CAM-01`, `VIDEO-02` / `CAM-02`), read from the stored `session-manifest.json` |
| (a) | no `STREAM_PROFILE_DIFFERS` | **none** for this session: the only new alert is `ALR-000069` (INFO, `MIC_RATE_AT_LIMIT`, `MIC-01`, inactive); no such log line |
| (a) | verify (op 41) | **`overall PASS`, 15 of 15**; `manifestOk`, `signatureOk` true; both files stored / plain / chain ok |
| (a) | op 40 `files[].profile` | **present** on both files: `VIDEO-01` `H264_720P30`, `VIDEO-02` `H264_720P30` (`evidence.files[]`; `media.source LIVE_STREAM`) |
| (a) | error-level Core log lines between stop and sealed | **none**: 23 lines in the window, all info. Earlier in the session, warn: `CAPTURE_FIRST_VIDEO_HELD` `CAM-01` 1575 ms, `CAM-02` 3110 ms; `CAPTURE_MIC_RATE_AT_LIMIT` `MIC-01` |
| (b) | op 41 on `EV-20261010-0015` | **`overall PASS`**, 15 of 15 |
| (b) | op 41 on the tampered `EV-20261009-0005` | **`overall TAMPERED`**: V-04, V-06, V-08 FAIL, V-05 SKIPPED, 11 PASS; `manifestOk`, `signatureOk` true; file `VIDEO-02` stored / chain not ok, `plainChecked false` |

The summary of `SES-20261011-0048` was acknowledged (204); the helper's session was signed out (204,
then 401) and its jar removed (no jar is left in `.cache/gate-env/`). Selector after the session:
unchanged, `locked false`. Answers kept in the scratch folder (`verify_*.json`,
`op40_EV-20261011-0037.json`, `alerts_*.json`, `sealing_0048.json`, `smoke_session.log`).

## 5. State of lane 2's data now (KEPT - do not reset)

- Evidence: **35 items** = the 34 of section 2 + `EV-20261011-0037` (v2, SEALED). The next session
  is `SES-20261011-0049` (or the next day's number), the next item `-0038`.
- `session/current` = `SES-20261011-0048`, `SEALED`, summary acknowledged; no session open.
- Alerts: 37, **none active**.
- Audit chain: `ok`, 881 rows at 12:49, then one sign-out.
- My smoke also wrote: one supervisor sign-in / sign-out and three verify runs.
- Two quarantined sessions (section 2): a reset of this lane would need
  `--discard-unsealed-fake-recordings` - and lane 2 is NOT to be reset.
- `CAM-04` and `CAM-05` point at dead ports: on no track; do not assign them. A search shows the
  stub as a NEW candidate on device port 53816; an adoption gives the next free id.
- Lane 1: as it was stopped (not reset), nothing signed in, no device.

## 6. The seal rig, the retry and the UNSEALABLE notice

The rig is driven exactly as `delegation_progress/contract_wave_k.md` heading S1, item 2 says (the
command forms are also in note 08 section 6): from the repository root, outside the sandbox,
`scripts/lane/lane.sh seal-rig 2 status | blocked | unsealable | release`; `blocked` / `unsealable`
are set BEFORE the session is ended; it binds to one FAKE-source session; **always end with
`release` and read `status`**. It is **OFF** now (read at the start and at the end; never switched
by me).

Stated by the wave L notes (`implementation/154`, `155`, `156`), not exercised in this run:
- A BLOCKED seal is retried, after `release`, with **"Retry sealing"** on the web console's Session
  Monitor (operation 33), by an investigator or a supervisor; a restart of the Core also retries.
- An **UNSEALABLE** notice (CRITICAL alert, `params.reason UNSEALABLE`) is closed by a
  **supervisor's acknowledgement**. Both such alerts of this lane are acknowledged and inactive.

## 7. Tooling notes collected by the re-checks (relayed, not re-proven here)

- `uiautomator dump` hangs on Session Live / Home while a recording runs: use a screenshot there,
  dump again after the stop.
- Tablet rows below y 1500 are off the visible area: scroll before tapping.
- A helper session expires 15 minutes after its last POST: sign in again
  (`npx tsx .cache/gate-env/gate-session.mts 2 <ROLE>`), remove the jar at the end.
- To cut a device's link: `adb -s <dev> reconnect`, then restore BOTH reverse rules
  (`reverse tcp:8081 tcp:8081`, `reverse tcp:4420 tcp:4422`) and read them back.
- Media volume: by volume-key events (`input keyevent`), read back 0 before any playback, put back
  as found (4 / 5 per note 155). I did not touch the volume and played nothing.
- Sign-in on a device: check the field shows only its hint before typing; never print a field's
  content; biometric offer "Not now"; close the dev toast first.
- A stop without a reason is refused (422): body `{"reason":"<5 characters or more>"}`.

Everything of note 06 section 7.7, note 07 section 7 and note 08 section 7 still holds.

## 8. STOP procedure

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5554 reverse --remove-all
adb -s emulator-5556 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5556 reverse --remove-all
kill -TERM $(lsof -nP -t -iTCP:8081 -sTCP:LISTEN)      # Metro (14166)
kill -TERM $(lsof -nP -t -iTCP:5176 -sTCP:LISTEN)      # web lane 1 (14142)
kill -TERM $(lsof -nP -t -iTCP:5177 -sTCP:LISTEN)      # web lane 2 (14141)
scripts/lane/lane.sh seal-rig 2 status                 # must say OFF before the stop; else: seal-rig 2 release
scripts/lane/lane.sh stop 1 ; scripts/lane/lane.sh stop 2 ; scripts/lane/lane.sh status
```

Run it outside the sandbox. Stopping lane 2 stops the stub and removes its fixture file; its data
stays. NO reset of lane 2 afterwards. After `reverse --remove-all` both devices keep their lane 2
credential: restore `tcp:8081 -> 8081`, `tcp:4420 -> 4422` on both before the next launch. Restart
forms: section 1 and note 05 section 6. Emulators: the controller's or the user's call. PostgreSQL
(PID 32505, `127.0.0.1:4432`) stays up.

## 9. Not proven / limits

- No flow on a device or in a browser: the session was driven through the API; devices were only
  relaunched and read at Login.
- The seal rig was read, not switched; "Retry sealing" and the supervisor's acknowledgement are
  relayed from the wave L notes (section 6); the tooling notes of section 7 likewise.
- The brief's "35+ sealed items" was read as 34 list items before the smoke (21 of them sealed
  development items), 35 after.
- No web screenshot; lane 1 only health and its log.
- Host load 6.18 at the start (1-minute), 2.28 at the smoke's start, 2.63 at the end.

---
*Generated: 2026-10-11 12:52 WIB*
