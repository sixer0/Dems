---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: device / browser environment for the milestone gates 70, 75, 81, 89, 94
date: 2026-10-10
agent: coder-execution (rules D94 / D122 / D163)
narrative_tier: 3
status: needs-review - everything is up and smoked; two decisions to rule (E-1 no Gradle rebuild, E-2 a re-point costs a new pairing)
---

# 05 - Gate environment UP (left running)

Tree `f293221`. No product source edited, no commit, no gate check. `.data/pg*.env` and the pwfile
were not read; every database command went through `scripts/lane/lane.sh` / the npm scripts under
`.locks/db-migrate.lock`. No local device (`CAM-03` / `MIC-03`) was selected, pre-checked or
started; neither attendance variable was set. Ports 5173-5175, 8000, 5432: nothing listened there
at the start or at the end, and nothing of mine touched them. Run window 12:31-12:38 WIB.

## 1. Start state and reseed

| Check | Result |
|---|---|
| Listeners at the start (`lsof`, 44xx / 517x / 808x) | only `postgres 127.0.0.1:4432` (plus the adb server 5037) |
| `adb devices`, `pgrep qemu-system` | no device, no emulator process |
| `lane.sh status` | four `stopped` |
| `db:status` x4 (`dems_lane_1/2/3`, `dems_demo`) | each `schema version 6; contract revision dbc-7; this code expects 6 (dbc-7)`, `15 file(s); ledger matches`, 43 tables, `db:status: OK` |

`scripts/lane/lane.sh reset <2|1|3|main>`, each once, each exit 0, no refusal (logs
`.cache/gate-env/reset_*.log`):

| Lane | Outcome |
|---|---|
| 2 | `v2 demo packages: 2 sealed with the development key from generated sources: EV-20261009-0005 (SES-20261009-0015, one fragment altered after the seal); EV-20261008-0001 (SES-20261008-0011, clean)`; 13 items, 8 `session_capture_sources`, 1 paired device kept, audit head seq 83 |
| 1 | `NOT generated (NOT_A_DEVELOPMENT_CAPTURE_CORE)` (expected, SIMULATED); 13 v1 items; 1 paired device kept; seq 83 |
| 3 | same as lane 1; 1 paired device kept; seq 83 |
| main | same; 5 paired devices kept; seq 83 |

## 2. What is running

| What | Address | PID at 12:38 | Notes |
|---|---|---|---|
| Core lane 1 | `127.0.0.1:4421` | 44664 | `SIMULATED`, `demoControls: true`, boot checks `inert`; health ready; 0 warn / error lines |
| Core lane 2 | `127.0.0.1:4422` | 44593 | `REAL_DEVELOPMENT`, `checks: real`, `workerVersion capture-worker/0.5.0`, `TRANSCRIBER_RESOLVED cpu-local, vad READY`, fence `local: CAM-03,MIC-03` (registered, in NO selector); health ready; 0 warn / error lines. No directory-mode refusal: nothing was chmod-ed by hand (`lane.sh start` sets its own root 0700; `dems_lane_2/` and `sessions/` are `drwx------`) |
| Web lane 1 | `http://127.0.0.1:5176/` | 45601 | Vite, proxy to 4421 |
| Web lane 2 | `http://127.0.0.1:5177/` | 45611 | Vite, proxy to 4422 |
| Metro (one, both devices) | `127.0.0.1:8081` | 47581 | `packager-status:running`; `Android Bundled ... (6219 modules)` from this tree |
| `dems2_phone` | `emulator-5554` (`-port 5554`) | 45773 | cold boot by `device-session.sh`; unlocked; app on Login, lane 1 |
| `dems2_tablet` | `emulator-5556` (`-port 5556`) | 45858 | cold boot by `device-session.sh`; unlocked; app on Login, lane 2 |
| PostgreSQL | `127.0.0.1:4432` | 32505 | was already running |

NOT started, on purpose (no gate plan here needs them): Core lane 3, Core main, their web servers,
`dems2_phone2`. Start forms in section 6.

Web checks (plain HTTP): `GET /` 200 `text/html` on 5176 and 5177; `GET /api/v1/health` through
each proxy = that lane's Core answer, `ready {database:true, engine:true}`; `GET /media/x` through
each proxy 401, the same as the Core directly (so `/media` is forwarded, not answered by the SPA).

Lane 2 selector (`GET /api/v1/capture/config`, seed supervisor): cameras `CAM-01`, `CAM-02`; mics
`MIC-01` (PRIMARY), `MIC-02` (STANDBY); `locked: false`. `CAM-03` / `MIC-03` are not in it.

## 3. Devices

| Device | AVD / serial | Lane | Reverse rules | Pairing (read from that lane's `GET /api/v1/pairing/devices`) |
|---|---|---|---|---|
| Tablet | `dems2_tablet` / `emulator-5556` | 2 (REAL_DEVELOPMENT) | `tcp:8081 -> 8081`, `tcp:4420 -> 4422` | `DEV-0001`, `online: true`, `pairedAt 1791426674169` |
| Phone | `dems2_phone` / `emulator-5554` | 1 (SIMULATED + demo controls) | `tcp:8081 -> 8081`, `tcp:4420 -> 4421` | `DEV-0001`, `online: true`, `pairedAt 1791426649334` |
| Phone 2 | `dems2_phone2` / would be `emulator-5558` | 3 | not booted | lane 3 holds 1 pairing (`08_m2_gate_device.md`: this AVD); not re-read today |

The device plan of the brief is the plan the existing pairings already have (both `pairedAt` values
equal those of the M2 gate): nothing was adjusted, nothing was paired. The phone AVDs are back on
their standard ports (the swap of `08_m2_gate_device.md` section 5 is closed by this cold boot).
Both Cores report `ws.clients: 1`. Screen stays on: both devices read `screen_off_timeout
2147483647`, `stay_on_while_plugged_in 1` (read only, not set by me), so they do not re-lock by
time-out; a reboot locks them again.

### 3.1 The unlock - exactly how it was run

`device-session.sh` booted each AVD and then stopped with 77 (keyguard, as designed). Then, from the
repository root, outside the sandbox, once per device:

```
script -q /dev/null apps/mobile/scripts/emulator-user-lock.sh unlock tablet </dev/null
script -q /dev/null apps/mobile/scripts/emulator-user-lock.sh unlock phone  </dev/null
```

`script` gives the helper a pseudo-terminal, which satisfies its terminal guard (exit 77) - allowed
for `unlock` only by the user's rule of 2026-10-09. The script used its own default test value; I
passed no PIN and none was printed. Answers: `tablet (emulator-5556, dems2_tablet): unlocked
(isKeyguardShowing=false)`, `phone (emulator-5554, dems2_phone): unlocked (isKeyguardShowing=false)`,
both exit 0. `status` afterwards: both `CredentialType=PIN, fingerprint count=1` - unchanged. No
`setup`, no `remove`, no `locksettings`, no `adb emu finger`.

### 3.2 The app build (decision E-1)

No Gradle build was run. Measured instead:

- the APK installed on BOTH devices is byte-equal to the host debug APK
  (`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, SHA-256 `d89c9be3...7f8a14ec`
  = `base.apk` on 5554 and on 5556) - the D78 check `device-session.sh` asks for after a cold boot;
- the native inputs have not changed since that APK: `git diff b90a3c6 HEAD -- apps/mobile/package.json
  apps/mobile/app.json` is empty, the lockfile diff holds no `expo*` / `react-native*` package, and
  the one module added around the APK's date (`expo-secure-store`) IS in the APK (its classes are in
  the dex);
- a debug APK carries no JavaScript: the app loads its bundle from Metro, which serves the tree at
  `f293221` (`Android Bundled 3760ms node_modules/expo-router/entry.js (6219 modules)` at launch).

So the stale part of the M2 build was the bundle, and Metro replaces it; a rebuild would produce the
same native shell, cost a heavy host run beside the gate-64 verifier, and `npm run build:android`
re-runs `expo prebuild` (README: it can wipe `apps/mobile/android/`). Alternative, if the controller
wants it anyway: `/usr/bin/lockf -k -t 3600 .locks/heavy-host.lock npm run build:android`, then
`adb -s <serial> install -r <apk>` on both.

### 3.3 Re-pointing a device to the other lane (decision E-2) - it costs a NEW PAIRING

Read from the code, NOT tried (trying it destroys a pairing): the app keeps ONE device credential
(`apps/mobile/src/runtime/secure-credentials.ts:38`, key `dems.live.device.v1`). At start it asks
the Core for its registration; a Core that does not know the credential answers 401 and the app
DELETES it (`apps/mobile/src/runtime/sim-adapters.ts:754-761`, `forget('unknown')`). A pairing
belongs to one database (README "Pairing, once per database"). Therefore:

- pointing a device at the other lane ends its pairing on the device side at the first launch, and
  the device shows the Pair screen; coming back needs a new pairing again (the old lane's database
  keeps its `DEV-0001` row, offline; the new one becomes `DEV-0002`);
- never change `tcp:4420` under a running app "just to look": the next registration question
  deletes the credential.

Phone -> lane 2:

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet
adb -s emulator-5554 reverse tcp:4420 tcp:4422
adb -s emulator-5554 shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=LIVE&motion=off" com.dems.demo.tablet'
# -> Pair screen. Lane 2 web console (5177) as the Supervisor: Paired Devices (/admin/devices) -> Pair a device,
#    type the 6-digit one-time code into the app within 5 minutes.
```

Tablet -> lane 1: the same with `emulator-5556`, `tcp:4420 tcp:4421`, web console 5176. Back: the
same commands with the original host port, and a new pairing on the original lane.

Without any new pairing: `dems2_phone2` (lock-free, paired with lane 3) is a third device -
`scripts/lane/lane.sh start 3`, `NO_METRO=1 apps/mobile/scripts/device-session.sh phone2 'true'`
(boots it on 5558), then the reverse rules `tcp:8081 tcp:8081`, `tcp:4420 tcp:4423` and the launch
line. Lane 3 is SIMULATED without demo controls.

## 4. Screens (`.cache/gate-env/`, git-ignored; each read)

| File | Shows |
|---|---|
| `tablet_lane2.png` | Edge Client Login on the tablet: `Core online`, `Core: DEMS-IR-01 - paired as DEV-0001`, `v2.4.1`; a dev-build toast "Open debugger to view warnings." at the bottom |
| `phone_lane1.png` | the same Login in the phone layout; the dev toast covers the status lines, which `uiautomator dump` reads as `Core online`, `Core: DEMS-IR-01 • paired as DEV-0001` |
| `web_lane1_5176.png` | web console Login, lane 1: Sign in card, Data mode `Live` selected, status bar `dems-core-server 0.2.0`, Database Ready, Engine Ready, Mode Live, Core link `Stale` (not judged: a signed-out page under virtual time) |
| `web_lane2_5177.png` | the same for lane 2 |

## 5. OPERATING SHEET for the gate agents

Run everything from the repository root, outside the sandbox. `R=/Users/gsp-budi/Documents/DEMS`.

### 5.1 Lanes

| Lane | Core URL | Web URL (never `localhost`) | Mode | Database | Media root | Core log | Web log |
|---|---|---|---|---|---|---|---|
| 1 RUNNING | `http://127.0.0.1:4421` | `http://127.0.0.1:5176/` | SIMULATED, demo controls ON | `dems_lane_1` | `$R/.data/media/dems_lane_1/sessions` | `.locks/core-server.lane1.log` | `.locks/core-server.lane1.vite.log` |
| 2 RUNNING | `http://127.0.0.1:4422` | `http://127.0.0.1:5177/` | REAL_DEVELOPMENT (FAKE sources only) | `dems_lane_2` | `$R/.data/media/dems_lane_2/sessions` | `.locks/core-server.lane2.log` | `.locks/core-server.lane2.vite.log` |
| 3 stopped | `http://127.0.0.1:4423` | `http://127.0.0.1:5178/` | SIMULATED, no demo controls | `dems_lane_3` | `$R/.data/media/dems_lane_3/sessions` | `.locks/core-server.lane3.log` | `.locks/core-server.lane3.vite.log` |
| main stopped | `http://127.0.0.1:4420` | none planned (its default port 5173 is off limits here) | SIMULATED, demo controls ON | `dems_demo` | `$R/.data/media/dems_demo/sessions` | `.locks/core-server.demo.log` | - |

Metro log `.locks/metro.8081.log`; emulator logs `.locks/dems2_<target>.emulator.log`; PID files
`.locks/dems2_<target>.pid`, `.locks/core-server.lane{1,2}.vite.pid`.

State of the data: lanes 1 and 2 = this commit's seed plus ONE supervisor sign-in / sign-out each
(my smoke; the session is ended, no jar is left). Lanes 3 and main = pristine seed, seq 83. To get a
pristine lane again: `lane.sh stop N`, `lane.sh reset N`, `lane.sh start N` (pairings are kept; the
app reconnects by itself, or relaunch it).

### 5.2 Devices

| | Tablet | Phone |
|---|---|---|
| Serial / AVD | `emulator-5556` / `dems2_tablet` (2560x1600) | `emulator-5554` / `dems2_phone` (1080x2424) |
| Lane | 2 | 1 |
| App | `com.dems.demo.tablet`, debug build, bundle from Metro 8081 | same |
| Relaunch | `adb -s <serial> shell am force-stop com.dems.demo.tablet` then `adb -s <serial> shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=LIVE&motion=off" com.dems.demo.tablet'` (a `Status: timeout` on a cold Metro is not a failure: look at the screen) | same |
| Rules, if lost (`adb -s <serial> reverse --list`) | `reverse tcp:8081 tcp:8081`, `reverse tcp:4420 tcp:4422` | `reverse tcp:8081 tcp:8081`, `reverse tcp:4420 tcp:4421` |
| Re-point | section 3.3 - a new pairing each way | same |
| Locked again (after a reboot only) | `script -q /dev/null apps/mobile/scripts/emulator-user-lock.sh unlock tablet </dev/null` | `... unlock phone </dev/null` |

- Do NOT wrap gate flows in `device-session.sh`: it starts its own Metro (8081 is taken: exit 70)
  and, at its end, force-stops the app and removes the reverse rules it set. Use plain `adb -s`.
  If you must use it: `NO_METRO=1 KEEP_APP=1` and no `DEMS_CORE_HOST_PORT` (that one removes
  `tcp:4420` at the end).
- Driving: `adb -s <serial> shell input tap X Y | text '<t>' | keyevent <n> | swipe ...`;
  `adb -s <serial> exec-out uiautomator dump /dev/tty` (texts, bounds, `resource-id` = the app's
  testIDs); `adb -s <serial> exec-out screencap -p > file.png`; read-only lock state
  `apps/mobile/scripts/emulator-user-lock.sh status`. The only helpers in `apps/mobile/scripts/` are
  `device-session.sh` and `emulator-user-lock.sh` (plus two release-build scripts). Maestro exists at
  `~/.maestro/bin/maestro` (not on PATH; `npm run e2e -w @dems/mobile`) but the repo holds no flow
  under `apps/mobile/e2e/maestro` - not tried.
- The dev-build toast "Open debugger to view warnings." sits over the bottom of the screen; close it
  with its X before judging or tapping what is under it.
- Biometrics: skipped in every gate. Never `adb emu finger`. The Login's fingerprint button is not
  to be used; sign in with the username / password path.
- Stay-awake is on for both devices; nothing needs to be changed there.

### 5.3 Operators and sessions (no credential printed)

Seed operators by ROLE: `SUPERVISOR` (`OPR-002`), `INVESTIGATOR`, `TECHNICIAN` (three operators,
`OPERATORS` in `packages/shared/src/sim/dataset.ts`; one shared seed password constant, imported by
name).

- API session without typing anything (helper written for the gates, git-ignored scratch, not
  product source): `npx tsx .cache/gate-env/gate-session.mts <1|2|3|main> <ROLE>` -> prints the
  role, the operator id and the jar path only, and writes `.cache/gate-env/session_lane<N>_<ROLE>.jar`
  (0600). Use: `curl -b <jar> -H "origin: http://127.0.0.1:517N" http://127.0.0.1:517N/api/v1/...`
  (the Core refuses a request without the lane's web origin). End it:
  `curl -X POST -b <jar> -H "origin: ..." -H 'content-type: application/json' -d '{}' .../api/v1/auth/sign-out`
  (204). Proven on lanes 1 and 2 (200, list read, 204, then 401).
- UI sign-in (web or app): the Login page has a "Demo operators" disclosure that lists the seed
  accounts; fill the form from it through the automation, and keep the values out of logs, reports
  and screenshots' captions. The security-key button on the web signs the Supervisor in (README).

### 5.4 Driving the web console - what is on this host

| Tool | State |
|---|---|
| `agent-browser` CLI | NOT installed (`which`: not found; the skill file exists, the binary does not) |
| `playwright` npm / Python package, project e2e tooling in `apps/core-web` | none (no e2e folder; vitest + jsdom only) |
| Playwright-cache headless Chromium | WORKS: `~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`. One-shot page: `--headless --no-first-run --disable-gpu --user-data-dir=<fresh dir in $TMPDIR> --window-size=1440,900 --virtual-time-budget=20000 --screenshot=<png> "http://127.0.0.1:517N/login?motion=off"` (used for the two screens above; without `?motion=off` the Login card is not drawn yet; `--dump-dom` works the same way). Interactive flows: the same binary over raw CDP with `--remote-debugging-port=0` and the port read from the profile's `DevToolsActivePort` - the way the earlier gates drove it (`docs/2026-10-04_dems_backend_rbac_pairing/test/07b_e2e_web_roles_consoles.md`); not re-run by me |
| Browser pane tools (`mcp__Claude_Browser__*`), Google Chrome.app | present in my session / installed; NOT tried here - an agent that has the pane tools can open `http://127.0.0.1:5176/` directly |

Always the `127.0.0.1` address: at `localhost` the console refuses Live mode.

### 5.5 Hard rules that stay in force for a gate session

Lane 2: only `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`. Never select, pre-check or start `CAM-03` /
`MIC-03`; never set `DEMS_LOCAL_SESSION_ATTENDED` / `DEMS_USER_ATTENDED`. Never 5173-5175, 8000,
5432. Heavy runs under `.locks/heavy-host.lock`. Delete nothing under `.data/`.

### 5.6 STOP procedure (nothing was stopped by me)

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5554 reverse --remove-all
adb -s emulator-5556 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5556 reverse --remove-all
kill -TERM $(lsof -nP -t -iTCP:8081 -sTCP:LISTEN)      # Metro
kill -TERM $(lsof -nP -t -iTCP:5176 -sTCP:LISTEN)      # web lane 1
kill -TERM $(lsof -nP -t -iTCP:5177 -sTCP:LISTEN)      # web lane 2
scripts/lane/lane.sh stop 1 ; scripts/lane/lane.sh stop 2 ; scripts/lane/lane.sh status
```

Emulators: NO project script stops one (`device-session.sh` never does, by design). The README form
is `adb -s emulator-5554 emu kill` / `adb -s emulator-5556 emu kill`, "only when no agent lane uses
it" - the controller's or the user's call. PostgreSQL stays up (`npm run pg:stop` only if asked).

## 6. Start forms for what is not running

```
scripts/lane/lane.sh start 3
DEMS_CORE_PROXY_PORT=4423 VITE_DEMS_CORE_MODE=live nohup npm run -s dev -w @dems/core-web -- --port 5178 --strictPort --host 127.0.0.1 > .locks/core-server.lane3.vite.log 2>&1 &
NO_METRO=1 apps/mobile/scripts/device-session.sh phone2 'true'     # boots dems2_phone2 on 5558 (lock-free)
```

The running web servers and Metro were started the same way (`nohup ... &`, 5176 / 4421, 5177 /
4422; `nohup npm run -s dev:mobile > .locks/metro.8081.log`).

## 7. Decisions for the controller

| ID | Decision taken | Alternative |
|---|---|---|
| E-1 | No Gradle build: installed APK = host APK (SHA-256), native inputs unchanged, current JS from Metro (section 3.2) | one build under `heavy-host.lock` and a reinstall |
| E-2 | The device plan stays fixed (tablet -> 2, phone -> 1); a re-point is documented as "new pairing each way", not prepared (section 3.3). A flow that needs the tablet on a SIMULATED lane, or the phone on real capture, costs two pairings and leaves a second device row in each lane | pair each device with BOTH lanes is not possible: the app holds one credential |
| E-3 | Lane 3, main and `dems2_phone2` not started (less host load beside the gate-64 verifier) | section 6 |
| E-4 | One supervisor sign-in / sign-out on lanes 1 and 2 to read the pairing owner and the selector; so those two audit chains are seed + my rows | reset both lanes once more before the first gate (`stop`, `reset`, `start`) |
| E-5 | `.cache/gate-env/gate-session.mts` written as the gates' session tool (scratch, git-ignored) | sign in through the UI only |
| E-6 | The emulator unlock guard was satisfied with `script` (section 3.1) - to enter in the decision log, as the user's rule asks | - |

## 8. Not proven / limits

- No gate flow was run: no session, no recording, no seal, no verify, no playback, no demo control.
- The re-point behaviour (section 3.3) is read from code, not exercised.
- The emulators were booted from an agent shell (README: such a boot inherits its nice level, and a
  hidden window can run slower under App Nap). If device timing looks slow, that is the first suspect.
- Raw-CDP driving and the Browser pane were not exercised today; only one-shot headless pages were.
- Lane 3's pairing owner (`dems2_phone2`) is taken from the M2 gate note, not re-read.
- The adapter kind (`FAKE`) of the four selector sources is the lane script's and note 04's
  statement; today's read shows the four ids and that `CAM-03` / `MIC-03` are absent.
- During the helper's development one `grep` printed the line of the shared seed-password constant
  into my own tool output (the published demo value of the README); it is in no file I wrote.

---
*Generated: 2026-10-10 12:40 WIB*
