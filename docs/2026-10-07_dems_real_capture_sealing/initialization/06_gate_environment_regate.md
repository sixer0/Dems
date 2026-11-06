---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: device / browser environment for the RE-GATES 70, 75, 81, 89, 94
date: 2026-10-10
agent: coder-execution (rules D94 / D122 / D163)
narrative_tier: 3
status: complete - everything asked for is up, smoked and left running; nothing refused
supersedes_for_the_regates: initialization/05_gate_environment_up.md (kept unchanged; its sections 3.2, 3.3 and 5.4 are still true and are cited, not repeated)
---

# 06 - Gate environment for the re-gates (left running)

Tree `74fd1f1`. No product source edited, no commit, no git write, no gate check. `.data/pg*.env`
and the pwfile were not read; every database command went through `scripts/lane/lane.sh` under
`.locks/db-migrate.lock`. No local device (`CAM-03` / `MIC-03`) was selected, pre-checked or
started; neither attendance variable was set; the speech fixture was not played. Ports 5173-5175,
8000, 5432: nothing listened there at the start or the end. No emulator was rebooted, no unlock
was needed. Run window 19:03-19:09 WIB.

## 1. Start state

| Check | Result |
|---|---|
| `lane.sh status` | four `stopped` |
| Listeners | `postgres 127.0.0.1:4432`; the three dev servers left by note 05: Vite 5176 (PID 45601), Vite 5177 (45611), Metro 8081 (47581), all started 12:31-12:33 and each with its working directory in this repository (`apps/core-web`, `apps/mobile`) |
| `adb devices` | `emulator-5554` (dems2_phone), `emulator-5556` (dems2_tablet), both `device`, both awake, `isKeyguardShowing=false` |
| Host | load 4.07 at the start, 2.15 at the end |

The three dev servers were stopped by PID (`kill -TERM`, only those three) after a `force-stop` of
the app on both devices, and started again as note 05 section 6 describes (section 3 below).

## 2. Worker, helper, fixture, key, resets

| Item | Result |
|---|---|
| `make -C apps/capture-worker` | exit 0, its own checks hold; binary `apps/capture-worker/build/capture-worker` (122,144 bytes, 10:46) is newer than every source; it carries the string `capture-worker/0.5.0`, and the Core's boot states the same version (section 4) |
| `npm run capture:dev-setup` (sandbox off, lanes stopped) | exit 0. `copied /opt/homebrew/Cellar/ffmpeg/9.0.2/bin/ffmpeg` to `.data/helpers/ffmpeg` (`-rwxr-xr-x`, 426,512 bytes, directory `drwx------`), `rule passes`; `speech kept ... dialogue.wav (mode 0600, directory 0700)`, `45 s of audio` |
| Speech fixture | `.data/dev-fixtures/speech-mic/` `drwx------`: `dialogue.wav` 4,320,312 bytes `-rw-------`, `dialogue.reference.json` 2,531 bytes `-rw-------` (both of 16:49 - kept, not renewed) |
| Development signing key | `.data/signer` `drwx------` holds `CORE-KEY-EVSIGN-01.crt` (0644), `.p8` (0600), `.wrap` (0600). Present; the provisioning command was not run; lane 2's boot and the reset's seal confirm it is usable |
| `git status --porcelain` under `.data/` | 0 lines |

`scripts/lane/lane.sh reset main | 1 | 2 | 3`: each exit 0, no refusal (logs
`.cache/gate-env/regate/reset_*.log`). Every lane: audit head `seq 83`, 13 evidence items.

| Lane | v2 demo packages | Pairings kept |
|---|---|---|
| main | `NOT generated (NOT_A_DEVELOPMENT_CAPTURE_CORE)` | 5 |
| 1 | same | 1 |
| 2 | `2 sealed with the development key from generated sources: EV-20261009-0005 (SES-20261009-0015, one fragment altered after the seal); EV-20261008-0001 (SES-20261008-0011, clean)`; the two old package folders removed and made again; discarded chain 111 rows; epoch 33 -> 34 | 1 |
| 3 | same as main | 1 |

Kept across the reset on lane 2, by the reset's own rule (so NOT pristine): `capture_devices 7`,
`capture_config 1`, `capture_device_credentials 0`, `stt_config 1`. The selector read after the
start is the four FAKE lines (section 5). Seven registered capture devices means one more than
`CAM-01..03` / `MIC-01..03`: by note 124 decision 6 this is the stub camera an earlier gate adopted
(`CAM-04`, FAKE) - inferred, its row was not read. A gate that adopts the stub again should expect
the next free id, and a candidate whose address differs from that old row.

## 3. What is running (19:08 WIB)

| What | Address | PID | Notes |
|---|---|---|---|
| Core lane 1 | `127.0.0.1:4421` | 3547 | SIMULATED, `demoControls: true`, boot checks `inert`; ready; 0 warn / error lines |
| Core lane 2 | `127.0.0.1:4422` | 3595 | REAL_DEVELOPMENT, started `--with-camera-stub --speech-mic`; ready; see section 4 |
| Camera stub (inside PID 3595) | `127.0.0.1`: discovery UDP 63879, device TCP 64850, RTSP TCP 64851 | 3595 | ports are ephemeral: new at each start of lane 2 |
| Web lane 1 | `http://127.0.0.1:5176/` | 3694 | Vite, proxy to 4421; `/` 200, `/api/v1/health` ready, `/media/x` 401 |
| Web lane 2 | `http://127.0.0.1:5177/` | 3698 | Vite, proxy to 4422; same three answers |
| Metro | `127.0.0.1:8081` | 3722 | `packager-status:running`; `Android Bundled ... (6227 modules)` (6219 at `f293221`) |
| `dems2_phone` | `emulator-5554` | 45773 | not rebooted; unlocked; app on Login, lane 1 |
| `dems2_tablet` | `emulator-5556` | 45858 | not rebooted; unlocked; app on Login, lane 2 |
| PostgreSQL | `127.0.0.1:4432` | 32505 | untouched |

Not started: Core lane 3, Core main, `dems2_phone2` (start forms: note 05 section 6).

## 4. Lane 2 - what the start printed and what the boot log says

`scripts/lane/lane.sh start 2 --with-camera-stub --speech-mic` (output kept, 0600, in
`.cache/gate-env/regate/start_2.log`):

```
lane.sh: lane 2 = port 4422, database dems_lane_2, capture operation REAL_DEVELOPMENT, demo controls unset, options: --with-camera-stub --speech-mic
lane.sh: media store root /Users/gsp-budi/Documents/DEMS/.data/media/dems_lane_2/sessions
lane.sh: the first test microphone plays the speech fixture: synthetic speech made by 'npm run capture:dev-setup'.
lane.sh: lane 2 is ready on 127.0.0.1:4422 (PID 3595); log /Users/gsp-budi/Documents/DEMS/.locks/core-server.lane2.log
lane.sh: camera stub ON: ONE fake ONVIF camera on 127.0.0.1. Every camera search of lane 2 goes to it and to nothing else (no network search on this lane).
lane.sh: its fixture account (a fixture of the fake device, not a secret; made at this start):
lane.sh:   username=<see .locks/camera-stub.lane2.fixture>
lane.sh:   secret=<see .locks/camera-stub.lane2.fixture>
lane.sh: what it answers, one word:  echo <PRESET> > /Users/gsp-budi/Documents/DEMS/.locks/camera-stub.lane2.mode
lane.sh:   NORMAL       the fixture account -> the camera can be reached; any other account -> the camera refused it
lane.sh:   AUTH_SCHEME  the camera accepts only a sign-in the Core does not answer (SCHEME_NOT_ALLOWED; nothing is sent)
lane.sh:   UNREACHABLE  the camera does not answer     NO_PROFILE  no usable profile     NOT_H264  H.265 only
lane.sh:   EMPTY        no device answers a search (the empty-search notice)
lane.sh: two refused accounts hold further tests of 127.0.0.1 for 30 minutes (the Core's lock-out guard); a reachable test or a restart of the lane clears it.
```

The stub prints no address line of its own in `lane.sh`; the ports are in the Core's log.

Boot log `.locks/core-server.lane2.log` (codes and members quoted; nothing secret is in it):

| Line | Content |
|---|---|
| `LANE_CAMERA_STUB_STARTED` | `operation REAL_DEVELOPMENT, devices 1, bound discovery:127.0.0.1:63879,device:127.0.0.1:64850,rtsp:127.0.0.1:64851` |
| `configuration loaded` | `port 4422, database dems_lane_2, demoControls false, cameraStub true` |
| `TRANSCRIBER_RESOLVED` | `outcome RESOLVED, backend cpu-local, vad READY` |
| `DEV_FAKE_MIC_SPEECH` | "the first test microphone plays the speech fixture (synthetic speech, development capture only)" - no path |
| `CAPTURE_FENCE_PASSED` | `operation REAL_DEVELOPMENT, registered "", local "CAM-03,MIC-03"` (registered local devices, in NO selector) |
| `CAPTURE_BOOT_CHECKS_PASSED` | `checks real, workerVersion capture-worker/0.5.0` |
| `INSTALLATION_IDENTITY_NOT_CONFIGURED` (level 40, warn) | `missing DEMS_INSTALLATION_DEVICE_ID,DEMS_INSTALLATION_NAME` - "the installation identity of this Core is not configured: the signed manifest of a recording sealed here says NOT_CONFIGURED for the device id and the name (development capture; a production Core refuses to start)" |
| `boot step passed` | `step sealing.installation-identity` |

`lane.sh` sets neither installation key and I set none: a recording sealed on this lane carries
`NOT_CONFIGURED` in manifest fields 20 / 21 (note 128 section 6 item 2 expects exactly that).
Level counts at 19:08: lane 2 = 68 info, 2 warn, 0 error (the second warn is my own probe of
`/api/v1/demo/status`, refused `DEMO_DISABLED`, as it must be on lane 2); lane 1 = 51 info, 0
warn, 0 error. No directory-mode refusal; nothing was chmod-ed by hand.

## 5. Smoke through the API (session helper, no UI)

| Check | Result |
|---|---|
| Lane 2 selector (`GET capture/config`) | cameras `VIDEO-01 = CAM-01`, `VIDEO-02 = CAM-02`; mics `MIC-01` PRIMARY, `MIC-02` STANDBY; `locked: false`; no `CAM-03` / `MIC-03` |
| Op 93 (`POST capture/discovery`, `{}`) | `202`, `DSC-000001`, `RUNNING`, `windowMs 3000` |
| Op 94 after the window | `COMPLETE`, `responderCount 1, newCount 1, interfaceCount 1`; ONE candidate `CND-A8AE7E528D2F`: `adapter FAKE`, `sourceClass DEVELOPMENT`, `host 127.0.0.1`, `Fake Camera 1` / `FAKE-CAM-1`, `status NEW`, `testable true`, `lastTest null`, `adoptable false` |
| Loopback only | Core log `CAPTURE_DISCOVERY_SEARCHED`: `datagramsSent 4, datagramsReceived 4, datagramsAccepted 4, sendErrors 0, dropped {}`. `lsof -a -p 3595 -i`: every socket of the Core is on 127.0.0.1 (4422, 63879 UDP, 64850, 64851, two connections to 4432). The log line does not print a destination address; "loopback only" rests on these two reads plus the launcher's construction (note 124 section 2) |
| Op 41, clean `EV-20261008-0001` | `overall PASS`, 15 of 15 checks `PASS` (V-01..V-15), both files 4 fragments `ok`, `sources.development true`, tracks `CAM-01` / `CAM-02` class `FAKE` |
| Op 41, tampered `EV-20261009-0005` | `overall TAMPERED`: V-04 `FRAGMENT_HASH_MISMATCH (VIDEO-02, seq 3)` + `FILE_HASH_MISMATCH`, V-06 `CHAIN_BROKEN (VIDEO-02, 3)`, V-08 `FRAGMENT_TAMPERED (VIDEO-02, 3)`, V-05 `SKIPPED (BLOCKED)`, 11 `PASS`; `manifestOk`, `signatureOk` true |
| Op 40, clean item | `media: { source: LIVE_STREAM, packageSuffix: null, fileIds: [VIDEO-01, VIDEO-02] }` |
| Lane 1 | health `ok`, ready; 13 items, 0 of them v2; `GET demo/status` 200 (`scenario idle`, `activeFaults []`) |
| Pairings | lane 1 `DEV-0001 PAIRED online: true` (`pairedAt 1791426649334`), lane 2 `DEV-0001 PAIRED online: true` (`pairedAt 1791426674169`) - the same pairings as note 05; nothing was paired again |

Not done, on purpose: no session, no pre-check, no connection test (op 95), no adoption.
Both smoke sessions were signed out (204, then 401) and their jars removed.

What my smoke left in the data (so the lanes are seed + these rows, not seed): lane 2 - one
supervisor sign-in / sign-out, ONE `CAPTURE_DISCOVERY_SEARCHED` row (`DSC-000001`; the next search
is `DSC-000002`), two verify runs and whatever audit rows ops 40 / 41 write, one refused
`demo/status`; lane 1 - one supervisor sign-in / sign-out. If a gate needs a pristine chain:
`lane.sh stop N`, `reset N`, start again as in section 7.1 (lane 2: new stub ports and a NEW
fixture account).

## 6. Devices and screens

Both devices: `mWakefulness=Awake`, `isKeyguardShowing=false`, `CredentialType=PIN, fingerprint
count=1` (read only). Reverse rules were intact: phone `tcp:8081 -> 8081`, `tcp:4420 -> 4421`;
tablet `tcp:8081 -> 8081`, `tcp:4420 -> 4422`. The app was force-stopped and launched again on both
(`am start -W` answered `Status: timeout` on the cold Metro - not a failure); both read (uiautomator)
`Core online`, `Core: DEMS-IR-01 - paired as DEV-0001`, `v2.4.1`; both Cores report `ws.clients: 1`.
No biometric offer appeared (nobody signed in). `git diff f293221 HEAD -- apps/mobile/package.json
apps/mobile/app.json` is empty: decision E-1 of note 05 (no Gradle rebuild) still holds.

Screens in `.cache/gate-env/regate/` (each read):

| File | Shows |
|---|---|
| `phone_lane1.png` | Edge Client Login, phone layout, empty form, "Demo operators" closed; the dev toast "Open debugger to view warnings." covers the status lines above "Pairing details" |
| `tablet_lane2.png` | Edge Client Login, tablet layout: `Core online`, `Core: DEMS-IR-01 - paired as DEV-0001`, `v2.4.1`; the dev toast across the bottom |
| `web_lane1_5176.png` | web console Sign in, Data mode `Live`, bar: `dems-core-server 0.2.0`, Database Ready, Engine Ready, Core link `Stale` (signed-out page under virtual time, not judged), Mode Live |
| `web_lane2_5177.png` | the same for lane 2 |

## 7. OPERATING SHEET for the re-gates

Run everything from the repository root, outside the sandbox. `R=/Users/gsp-budi/Documents/DEMS`.

### 7.1 Lanes

| Lane | Core | Web (never `localhost`) | Mode / options | Media root | Core log | Web log |
|---|---|---|---|---|---|---|
| 1 RUNNING | `http://127.0.0.1:4421` | `http://127.0.0.1:5176/` | SIMULATED, demo controls ON, no option | `$R/.data/media/dems_lane_1/sessions` | `.locks/core-server.lane1.log` | `.locks/core-server.lane1.vite.log` |
| 2 RUNNING | `http://127.0.0.1:4422` | `http://127.0.0.1:5177/` | REAL_DEVELOPMENT, FAKE sources, `--with-camera-stub --speech-mic`, installation identity NOT configured | `$R/.data/media/dems_lane_2/sessions` | `.locks/core-server.lane2.log` | `.locks/core-server.lane2.vite.log` |
| 3 stopped | `http://127.0.0.1:4423` | `http://127.0.0.1:5178/` | SIMULATED, no demo controls | `$R/.data/media/dems_lane_3/sessions` | `.locks/core-server.lane3.log` | - |
| main stopped | `http://127.0.0.1:4420` | none (5173 is off limits) | SIMULATED, demo controls ON | `$R/.data/media/dems_demo/sessions` | `.locks/core-server.demo.log` | - |

Restart forms (never pipe `lane.sh start`; redirect to a file if the output is wanted):

```
scripts/lane/lane.sh stop 1 ; scripts/lane/lane.sh start 1
scripts/lane/lane.sh stop 2 ; scripts/lane/lane.sh start 2 --with-camera-stub --speech-mic > .cache/gate-env/regate/start_2.log 2>&1
```

A restart of lane 2 makes NEW stub ports and a NEW fixture account. Pristine data: `stop N`,
`reset N`, start. The app reconnects by itself, or relaunch it (7.4). Metro log
`.locks/metro.8081.log`.

### 7.2 The camera stub (lane 2 only)

- ONE fake ONVIF camera on `127.0.0.1`; every camera search of lane 2 (op 93 and the pre-check's
  search) goes to it and to nothing else. It shows as "Fake Camera 1" / `FAKE-CAM-1`, `host
  127.0.0.1`, adapter FAKE, class DEVELOPMENT. Ports of this start: discovery UDP 63879, device
  TCP 64850, RTSP TCP 64851 (line `LANE_CAMERA_STUB_STARTED` of the Core log).
- Fixture account of THIS start (a fixture of the fake device; it opens nothing else): user name
  not written here, secret not written here (redacted before the commit). The current values are always in
  `.locks/camera-stub.lane2.fixture` (0600, two lines `username=…` / `secret=…`): read them from
  there after any restart of lane 2. The file is removed at stop.
- Presets, switched while the lane runs, read by the stub within 0.5 s:
  `echo <PRESET> > $R/.locks/camera-stub.lane2.mode` - now `NORMAL`.

| Preset | The stub answers |
|---|---|
| `NORMAL` | fixture account -> reachable; any other account -> refused by the camera |
| `AUTH_SCHEME` | only a sign-in the Core does not answer (`SCHEME_NOT_ALLOWED`; nothing is sent) |
| `UNREACHABLE` | no answer |
| `NO_PROFILE` | no usable profile (`WRONG_PROFILE`) |
| `NOT_H264` | H.265 only |
| `EMPTY` | no device answers a search (the empty-search notice) |

- Put it back to `NORMAL` after each case. Two refused accounts hold further tests of 127.0.0.1
  for 30 minutes (the Core's lock-out guard); a reachable test or a lane restart clears it: drive
  the wrong-account outcome ONCE.
- The connection test and the adoption are web-console only (ops 95 / 96).
- `scripts/lane/lane.sh start 1 --with-camera-stub` prints "camera stub IGNORED" (SIMULATED).

### 7.3 The speech microphone (lane 2)

`MIC-01` (PRIMARY, the first FAKE microphone) plays the speech fixture: 45 s of SYNTHETIC
two-speaker Indonesian dialogue, looped; text and SHA-256 in
`.data/dev-fixtures/speech-mic/dialogue.reference.json`. `MIC-02` (STANDBY) keeps its tone, so a
switch to the standby records no speech. Never play the file. The selector to use is `CAM-01`,
`CAM-02`, `MIC-01`, `MIC-02` and nothing else. A session of lane 2 sealed now states
`NOT_CONFIGURED` for the installation device id and name.

### 7.4 Devices

| | Tablet | Phone |
|---|---|---|
| Serial / AVD | `emulator-5556` / `dems2_tablet` (2560x1600) | `emulator-5554` / `dems2_phone` (1080x2424) |
| Lane | 2 | 1 |
| Pairing | `DEV-0001` of `dems_lane_2` | `DEV-0001` of `dems_lane_1` |
| Relaunch | `adb -s <serial> shell am force-stop com.dems.demo.tablet` then `adb -s <serial> shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=LIVE&motion=off" com.dems.demo.tablet'` (`Status: timeout` on a cold Metro is not a failure: read the screen) | same |
| Rules, if lost (`adb -s <serial> reverse --list`) | `reverse tcp:8081 tcp:8081`, `reverse tcp:4420 tcp:4422` | `reverse tcp:8081 tcp:8081`, `reverse tcp:4420 tcp:4421` |
| Re-point to the other lane | = a NEW PAIRING each way (note 05 section 3.3); never change `tcp:4420` under a running app | same |
| Locked (after a reboot only) | `script -q /dev/null apps/mobile/scripts/emulator-user-lock.sh unlock tablet </dev/null` | `... unlock phone </dev/null` |

Unlock only; no PIN on a command line; never set / change / remove a lock or a fingerprint; never
`adb emu finger`. Drive with plain `adb -s` (`input tap | text | keyevent | swipe`,
`exec-out uiautomator dump /dev/tty`, `exec-out screencap -p > file.png`); do not wrap flows in
`device-session.sh` (note 05 section 5.2).

**THE TWO OVERLAYS that swallowed first taps at the earlier gates:**

1. After a sign-in the app shows **"Enable biometric sign-in?"** - answer **"Not now"** before
   anything else; never the fingerprint sensor, never the Login's fingerprint button.
2. The dev-build toast **"Open debugger to view warnings."** lies over the footer (on the phone it
   covers the status lines and sits just above "Pairing details"; on the tablet it spans the
   bottom) - close it with its X (right end of the toast) before tapping or judging what is under
   it. It comes back after a reload.

Take a `uiautomator dump` after each of the two and tap only then.

### 7.5 Operators and the session helper (no credential printed)

Seed operators by ROLE: `SUPERVISOR` (`OPR-002`), `INVESTIGATOR`, `TECHNICIAN`.

```
npx tsx .cache/gate-env/gate-session.mts <1|2|3|main> <ROLE>      # prints role, operator id, jar path
curl -b .cache/gate-env/session_lane<N>_<ROLE>.jar -H "origin: http://127.0.0.1:517N" http://127.0.0.1:517N/api/v1/...
curl -X POST -b <jar> -H "origin: ..." -H 'content-type: application/json' -d '{}' http://127.0.0.1:517N/api/v1/auth/sign-out   # 204
```

Web origin per lane: 1 = 5176, 2 = 5177. A request without the lane's origin is refused. Proven
today on both lanes (200, reads, 204, then 401). Routes used: `capture/config`,
`capture/discovery` (POST = op 93, GET = op 94; the GET answers the OWNER session only),
`evidence`, `evidence/{id}` (op 40), `evidence/{id}/verify` (op 41, POST `{}`), `demo/status`,
`pairing/devices`. UI sign-in: the Login's "Demo operators" disclosure lists the seed accounts;
keep the values out of logs, reports and captions.

### 7.6 Browser tooling

Unchanged from note 05 section 5.4: no `agent-browser` binary, no Playwright package; the
Playwright-cache headless Chromium works
(`~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
one-shot: `--headless --no-first-run --disable-gpu --user-data-dir=<fresh dir in $TMPDIR>
--window-size=1440,900 --virtual-time-budget=20000 --screenshot=<png>
"http://127.0.0.1:517N/login?motion=off"` - used for today's two screens; interactive: the same
binary over CDP with `--remote-debugging-port=0`); the Browser pane tools can open
`http://127.0.0.1:5176/` / `5177/` directly (not tried today). Always `127.0.0.1`: at `localhost`
the console refuses Live mode.

### 7.7 Hard rules in force for a gate session

Lane 2: only `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`; never select, pre-check or start `CAM-03` /
`MIC-03` (G70-02 is SELECT ONLY and must be put back before any pre-check); never set
`DEMS_LOCAL_SESSION_ATTENDED` / `DEMS_USER_ATTENDED`; no TCC / System Settings. Never 5173-5175,
8000, 5432. Never read `.data/pg*.env` or a pwfile. Heavy runs under `.locks/heavy-host.lock`.
Delete nothing under `.data/`. `npm run capture:dev-setup` only with lane 2 stopped.

### 7.8 STOP procedure (nothing was stopped by me)

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5554 reverse --remove-all
adb -s emulator-5556 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5556 reverse --remove-all
kill -TERM $(lsof -nP -t -iTCP:8081 -sTCP:LISTEN)      # Metro
kill -TERM $(lsof -nP -t -iTCP:5176 -sTCP:LISTEN)      # web lane 1
kill -TERM $(lsof -nP -t -iTCP:5177 -sTCP:LISTEN)      # web lane 2
scripts/lane/lane.sh stop 1 ; scripts/lane/lane.sh stop 2 ; scripts/lane/lane.sh status
```

Stopping lane 2 stops the stub with it and removes its fixture file. Emulators: no project script
stops one; `adb -s emulator-555N emu kill` is the controller's or the user's call. PostgreSQL
stays up.

## 8. Decisions and notes for the controller

| ID | Note |
|---|---|
| R-1 | The fixture account of the fake camera is written into this sheet (section 7.2), as the brief asks; it is valid until lane 2 is restarted |
| R-2 | The smoke left rows on lanes 1 and 2 (section 5, last paragraph); no second reset was run. Alternative: `stop`, `reset`, start once more before the first gate |
| R-3 | A lane reset keeps `capture_devices` (7 on lane 2) and `capture_config`: an adopted stub camera of an earlier gate survives the reset. Whether the re-gate of 70 wants that row gone is not something `lane.sh reset` can do |
| R-4 | No Gradle rebuild (E-1 of note 05 re-checked: native inputs unchanged; the bundle is this tree's) |
| R-5 | The provisioning command for the signing key was not run (the key files exist and lane 2 sealed with it at reset). One call `evidence:dev-key -- --help` answered its usage line only |

## 9. Not proven / limits

- No gate flow: no session, pre-check, recording, seal, connection test, adoption, playback, demo
  control action, preset switch (the mode file was read, not written).
- That `MIC-01` really carries speech is the boot's statement (`DEV_FAKE_MIC_SPEECH`); no audio
  was recorded or heard.
- The 7th capture device of lane 2 is inferred to be the earlier gate's `CAM-04`, not read.
- "Loopback only" for the search: see the wording in section 5.
- The emulators have been up since 12:31 from an agent shell; if device timing looks slow, that is
  the first suspect.

---
*Generated: 2026-10-10 19:10 WIB*
