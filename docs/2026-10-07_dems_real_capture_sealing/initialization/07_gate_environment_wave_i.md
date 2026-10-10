---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: device / browser environment for the re-gates after fix wave I
date: 2026-10-10
agent: coder-execution (environment; rules D94 / D122 / D163)
narrative_tier: 3
status: complete - both lanes up on the wave I tree, smoked, left running; one real-capture session SEALED on lane 2
builds_on: initialization/06_gate_environment_regate.md (kept unchanged; its sections 7.2 presets, 7.3, 7.4, 7.5, 7.6, 7.7 are still true and are cited, not repeated)
---

# 07 - Gate environment on fix wave I (left running)

Working tree = `74fd1f1` + the staged fix wave I (a git agent commits it in parallel; HEAD read
as `74fd1f1` at 21:48). No product source, test or doc edited except this note; no git write.
`.data/pg*.env` and the pwfile were not read; database commands went through
`scripts/lane/lane.sh` only. No local device (`CAM-03` / `MIC-03`) was selected, pre-checked or
started; no attendance variable set; the speech fixture was not played. Ports 5173-5175, 8000,
5432: nothing listened there at the start or the end. No emulator was rebooted; no unlock was
needed. Run window 21:48-21:58 WIB. Scratch and logs: `.cache/gate-env/wave-i/`.

## 1. What differs from note 06

| Item | Note 06 | Now |
|---|---|---|
| Core lane 1 | PID 3547 | **PID 49865**, `127.0.0.1:4421`, SIMULATED, demo controls on |
| Core lane 2 | PID 3595 | **PID 49915**, `127.0.0.1:4422`, REAL_DEVELOPMENT, `--with-camera-stub --speech-mic` |
| Camera stub ports (inside the lane 2 Core) | UDP 63879, TCP 64850 / 64851 | **discovery UDP 64235, device TCP 59971, RTSP TCP 59972** |
| Web lane 1 / lane 2 | PID 3694 / 3698 | **PID 49995** (`http://127.0.0.1:5176/`) / **PID 50013** (`http://127.0.0.1:5177/`), restarted |
| Metro | PID 3722, 6227 modules | **PID 50037**, restarted; `Android Bundled ... (6231 modules)` |
| Emulators | 45773 / 45858 | the same two processes, not rebooted |
| Stub fixture account | written in the note | **not written here**: read it from `.locks/camera-stub.lane2.fixture` (0600, `username=` / `secret=`, made at 21:49; removed at stop). A copy of the start output is in `.cache/gate-env/wave-i/start_2.log` (0600). The account of note 06 is dead |
| Lane 2 data | seed + one search | seed + one search + **one SEALED real-capture session** (section 4) |
| Worker build, `capture:dev-setup` | run | NOT run: no worker source is newer than the binary (only `README.md`), binary still `capture-worker/0.5.0` (10:46); helper `.data/helpers/ffmpeg`, the speech fixture and the signing key files are those of note 06 |
| Gradle | no rebuild | no rebuild: `apps/mobile/package.json`, `app.json`, `android/` and the lockfile are unchanged in the working tree |

## 2. Resets and starts

| Command | Result |
|---|---|
| `adb ... am force-stop` on both devices, `kill -TERM 3694 3698 3722` | the three old dev servers gone |
| `scripts/lane/lane.sh reset 1` | exit 0; audit head `seq 83`; v2 demo packages `NOT generated (NOT_A_DEVELOPMENT_CAPTURE_CORE)`; log `reset_1.log` |
| `scripts/lane/lane.sh reset 2` (PLAIN) | **exit 0, no refusal: `--discard-unsealed-fake-recordings` was NOT needed and NOT used.** Epoch 38 -> 39, discarded chain 83 rows; the two demo packages sealed anew (`EV-20261009-0005` / `SES-20261009-0015` one fragment altered, `EV-20261008-0001` / `SES-20261008-0011` clean); kept: `capture_devices 8`, `capture_device_credentials 1`, `capture_config 1`, `stt_config 1`, `paired_devices 1`; log `reset_2.log` |
| `scripts/lane/lane.sh start 1 > start_1.log` | ready, PID 49865 |
| `scripts/lane/lane.sh start 2 --with-camera-stub --speech-mic > start_2.log` (redirected, not piped) | ready, PID 49915; camera stub ON; the script now also prints "lane 2 records from the FAKE (generated) sources: its selector is CAM-01, CAM-02, MIC-01, MIC-02 ..." |
| Web 5176 / 5177, Metro 8081 | started as note 05 section 6; `/` 200, `/api/v1/health` ready, `/media/x` 401 on both; `packager-status:running` |

## 3. Lane 2 - confirmed

| Check | Result |
|---|---|
| Boot log (`.locks/core-server.lane2.log`) | `LANE_CAMERA_STUB_STARTED` (ports above); `TRANSCRIBER_RESOLVED` `backend cpu-local, vad READY`; `CAPTURE_FENCE_PASSED` `operation REAL_DEVELOPMENT, registered "", local "CAM-03,MIC-03"`; `CAPTURE_BOOT_CHECKS_PASSED` `checks real, workerVersion capture-worker/0.5.0`; `CAPTURE_CONFIG_LOADED` `devices 8, locked false`; `INSTALLATION_IDENTITY_NOT_CONFIGURED` (warn, expected) |
| Session-key folder `.data/credential-store/session-keys-5eb7d6943528705fe26b0e5904a4b219` BEFORE the smoke (names and dates only) | `KID-SES-20261008-0011.key` (21:49:17), `KID-SES-20261009-0015.key` (21:49:16) - the two demo packages the reset sealed, both known to the database. **No key of an unknown session** |
| Selector (`GET capture/config`) | `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` - already so, nothing was put |
| Capture devices (`GET capture/devices`) | `CAM-01`, `CAM-02` (FAKE), `CAM-03` (LOCAL_DEVICE, in no selector), **`CAM-04` (FAKE, model `FAKE-CAM-1`, host `127.0.0.1:64850` = the stub port of the 19:04 start, now dead)**, `MIC-01`, `MIC-02` (FAKE), `MIC-03` (LOCAL_DEVICE, in no selector), `POE-SWITCH` |
| `CAM-04` | exists, assigned to NO track; nothing was adopted. The one kept `capture_device_credentials` row is, by inference, its fixture account of the old start (row not read) |
| Session open | none (`session/current` = `null` before the smoke) |
| Alerts | `[]` before the smoke |
| Pairing | `DEV-0001` online |

## 4. Smoke through the API (one run each)

| | Check | Result |
|---|---|---|
| (a) | lane 2 camera search (`POST capture/discovery` `{}`, then GET) | `202` `DSC-000001` -> `COMPLETE`, `responderCount 1, newCount 1, registeredCount 0`; ONE candidate `CND-A067ABD96581`: adapter FAKE, DEVELOPMENT, host `127.0.0.1`, `Fake Camera 1` / `FAKE-CAM-1`, status NEW, testable, `adoptable false`, target port 59971. Core log: `datagramsSent 4, received 4, accepted 4, sendErrors 0`. `lsof` of PID 49915: every socket on 127.0.0.1 |
| (b) | lane 2, ONE real-capture session on the FAKE sources | **SEALED.** Session `SES-20261010-0024`, evidence item `EV-20261010-0014`. Create 201 -> pre-check 202 -> `ARMED`, outcome PASS (7 PASS, `TIME` WARN `HOST_SYSTEM_CLOCK`) -> start 200 `RECORDING` 21:51:43.398, `captureDurable true` from the second poll -> stop 202 -> `FINALIZING` -> `SEALED`. `stoppedAt` 21:56:39.302, `sealedAt` 21:56:47.018: **seal 7.7 s**, attempt 1, `resumed false`. Steps: CLOSE_TRACKS 1535 ms, FINALIZE_HASHES 919, FINALIZE_TRANSCRIPT 5088, BUILD_MANIFEST 67, SIGN_MANIFEST 35, STORE_SEALED_PACKAGE 0. Core log `SEALING_COMPLETE`, `SEALING_CAPTURE_FACTS_REMOVED`; no `SEALER_FAILED`, no `SEALING_SESSION_BLOCKED` |
| | verify (`POST evidence/EV-20261010-0014/verify`) | **`overall PASS`, 15 of 15 checks PASS**; `manifestOk`, `signatureOk` true; `VIDEO-01` 115 fragments, `VIDEO-02` 116 fragments, each stored / plain / chain ok; sources `DEVELOPMENT`, tracks `CAM-01` / `CAM-02` FAKE, audio interval 1 `MIC-01` FAKE. Answer kept in `.cache/gate-env/wave-i/verify_EV-20261010-0014.json` |
| (c) | adopt nothing; `CAM-04` on no track | done (section 3); selector re-read after the session: unchanged |
| (d) | lane 1 sign-in + one simulated demo item | SUPERVISOR 200; 13 items, 0 v2; verify `EV-20261008-0001`: `ok true`, `manifestOk`, `signatureOk` true, 4 tracks ok (v1 shape: no `overall` / `checks` list); `demo/status` 200 `scenario idle`; `DEV-0001` online; sign-out 204, then 401 |

**Deviation in (b): the recording ran 4 min 56 s, not about 30 s.** My first stop call sent `{}`
and was refused `422 INVALID_REASON` ("A reason of at least 5 characters is required"); my poll
loop did not treat that as a stop and waited 249 s before I sent the stop with a reason. The
item is therefore 295.9 s long, 301,649,805 bytes. The stop body a gate needs is
`{"reason":"<5 characters or more>"}`. Also: the create call answers `{sessionId, state, created}`
(not a session object), and the same create input sent again answers 200 with the open session.

Observations of the session, not judged here:
- Five `level 50` lines `ASSEMBLY_REFUSED` / `TRANSCRIPT_NOT_COMPLETE` (`unfinished 1`), one per
  second 21:56:41-21:56:45, during FINALIZE_TRANSCRIPT; the step then completed and the seal
  followed. They are the only error-level lines of the lane 2 log.
- Warn lines: `CAPTURE_FIRST_VIDEO_HELD` for `CAM-01` (held 1579 ms) and `CAM-02` (3096 ms),
  `CAPTURE_MIC_RATE_AT_LIMIT` `MIC-01` (value -5000, bound 5000).
- Alert `ALR-000002` (INFO, `MIC_RATE_AT_LIMIT`, `MIC-01`): `active false`, resolved at the stop,
  `acknowledged false`. It is the only alert; no active alert is left.

## 5. State of lane 2's data after the smoke (NOT pristine)

- Sessions: `SES-20261010-0024` SEALED, case number `LP/2026/1010-9001`, subject "Environment
  Smoke" (SAKSI), investigator `OPR-001`, created by the seed SUPERVISOR. Its summary was
  ACKNOWLEDGED by the smoke (204). `session/current` still returns it in state `SEALED` (the last
  sealed session, by the machine's design); no session is open. **The next session is
  `SES-20261010-0025`, the next item `EV-20261010-0015`.**
- Evidence: 14 items (13 seed + `EV-20261010-0014`, v2).
- Store `.data/media/dems_lane_2/sessions/`: `SESSION-SES-20261008-0011`,
  `SESSION-SES-20261009-0015`, `SESSION-SES-20261010-0024` (manifest, signature, certificate,
  audit extract, `fragments/`, `transcript/`).
- Key folder: the two demo keys + `KID-SES-20261010-0024.key` and `.blob` (21:56:39) - a key of
  a session the database knows.
- Audit chain: `ok`, 95 rows at 21:57 (83 seed + the smoke's), then one sign-out.
- Discovery: `DSC-000001` used; the next search is `DSC-000002`.
- Alerts: `ALR-000002` inactive, unacknowledged.
- Lane 1: seed + one supervisor sign-in / sign-out and one verify run.
- A later `lane.sh reset 2` should pass plain (the session is sealed from FAKE sources); not tried.

## 6. Devices

Both: `mWakefulness=Awake`, `isKeyguardShowing=false` (no unlock run), reverse rules intact
(phone `tcp:8081 -> 8081`, `tcp:4420 -> 4421`; tablet `tcp:8081 -> 8081`, `tcp:4420 -> 4422`).
The app was force-stopped before the restarts and launched again with the form of note 06
section 7.4 (`Status: timeout` on the cold Metro, as before), so both run the wave I bundle.
Both read (uiautomator): Login, `Core online`, `Core: DEMS-IR-01 - paired as DEV-0001`, `v2.4.1`;
both Cores report `ws.clients 1`. Nobody signed in on a device, so no biometric offer appeared.
Screens: `.cache/gate-env/wave-i/dev_emulator-5554.png` (phone, lane 1),
`dev_emulator-5556.png` (tablet, lane 2). No web screenshot was taken this time.

**The two overlays (unchanged, note 06 section 7.4):** after a sign-in answer "Enable biometric
sign-in?" with **"Not now"**; close the dev toast **"Open debugger to view warnings."** with its
X before tapping or judging what is under it - it is on both Login screens now.

## 7. What a gate must not do

Everything of note 06 section 7.7, and:
- Do not use the fixture account of note 06; read the current one from
  `.locks/camera-stub.lane2.fixture` and keep it out of reports.
- `CAM-04` points at a dead port (64850). A search shows the stub as a NEW candidate on port
  59971 (`registeredCount 0`), not as `CAM-04`. Do not assign `CAM-04` to a track: its stream is
  not there. An adoption gives the next free id.
- Do not expect a pristine lane 2 (section 5). For pristine data: `lane.sh stop 2`, `reset 2`,
  start as below - new stub ports and a new fixture account.
- A stop without a reason is refused (422); a refused stop leaves the session RECORDING.
- Never pipe `lane.sh start`.

## 8. Session helper

Unchanged: `npx tsx .cache/gate-env/gate-session.mts <1|2|3|main> <ROLE>` (outside the sandbox),
jar `.cache/gate-env/session_lane<N>_<ROLE>.jar`, origin `http://127.0.0.1:517N`. Both smoke
sessions were signed out (204, then 401) and their jars removed. The smoke's own scripts
(`smoke_session.sh`, `smoke_stop.sh`) are in `.cache/gate-env/wave-i/` (scratch). Routes used
beyond note 06: `POST session`, `POST session/{id}/precheck`, `POST session/{id}/start`
(`{"acknowledgeWarnings":true}`), `POST session/{id}/stop` (`{"reason":"..."}`),
`GET session/current`, `GET session/{id}/sealing`, `POST session/{id}/summary/acknowledge`,
`GET capture/devices`, `GET alerts`, `GET audit/chain`.

## 9. STOP procedure

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5554 reverse --remove-all
adb -s emulator-5556 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5556 reverse --remove-all
kill -TERM $(lsof -nP -t -iTCP:8081 -sTCP:LISTEN)      # Metro (50037)
kill -TERM $(lsof -nP -t -iTCP:5176 -sTCP:LISTEN)      # web lane 1 (49995)
kill -TERM $(lsof -nP -t -iTCP:5177 -sTCP:LISTEN)      # web lane 2 (50013)
scripts/lane/lane.sh stop 1 ; scripts/lane/lane.sh stop 2 ; scripts/lane/lane.sh status
```

Run it outside the sandbox (inside it the script can send no signal). Stopping lane 2 stops the
stub and removes its fixture file. Restart forms: note 06 section 7.1 (write the lane 2 start
output to a 0600 file). Emulators: no project script stops one; that is the controller's or the
user's call. PostgreSQL (PID 32505, `127.0.0.1:4432`) stays up.

## 10. Not proven / limits

- No gate flow on a device or in a browser: the session was driven through the API only.
- The interrupted / blocked-seal cases of re-gate 75 (G75-03, -05b, -08, -10, G75b-02) were not
  exercised; only the plain create -> seal path.
- No connection test, no adoption, no preset switch (mode file read: `NORMAL`).
- That `MIC-01` carries speech rests on the boot line `DEV_FAKE_MIC_SPEECH` and on the transcript
  step completing; no audio was heard and the transcript text was not read.
- `CAM-04`'s credential row is inferred, not read.
- Host load 2.98 at the start, 3.54 at the end.

---
*Generated: 2026-10-10 21:58 WIB*
