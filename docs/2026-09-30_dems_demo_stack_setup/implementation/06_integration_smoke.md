---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 19
agent: coder-execution
narrative_tier: 3
status: complete
date: 2026-10-01
spec: masterplan/01_specs.md rev 3 §3 (mock-core), §4 (core-web), §5 (mobile), §6.1-§6.3 (ports, emulator networking, AVDs), AC-40, AC-41, AC-45; masterplan/02_plan.md §3 Row 19; blueprint Parallel Execution Protocol P1-P12; decisions D23, D24, D29, D40, D41
---

# Step 19: Integration smoke (mock-core + core-web + mobile on both AVDs)

**Result: PASS.**
- **AC-40:** PASS on both serials.
- **AC-41:** PASS with three clients: web, `dems_phone` and `dems_tablet`.
- **AC-45:** PASS. Metro bound to `127.0.0.1:8081`.
- **Teardown:** `adb reverse --remove-all` run on both serials. Every PID this step started was stopped, except the two emulators, which stay up under P3/D40.

Window: 2026-10-01 01:55:35-02:01:30 WIB. All times below are WIB (UTC+07:00). The browser JSON uses UTC (`18:58Z` = `01:58` WIB).

## 1. Pre-check (01:55)

| Check | Result |
|---|---|
| `lsof -nP -iTCP:<p> -sTCP:LISTEN` for 4400, 8081, 5037, 5554-5557 | No listener (all free) |
| `lsof … 5173` | Only `node 3489 … TCP [::1]:5173` (the user's SMART WMS Vite, D41 f). `curl http://127.0.0.1:5173/` refused, so `127.0.0.1:5173` was free. **3489 was left untouched** |
| Emulator / DEMS dev processes | None running. Foreign SMART WMS processes 3313, 3489, 3521 (and their esbuild helpers) were present and left alone |
| `.locks/` | Absent, so created with `mkdir -p .locks`. `.gitignore` was **not** edited (step 25 adds `.locks/`) |

## 2. Commands, in order (workspace `/Users/gsp-budi/Documents/DEMS`)

Every command that binds a port or touches the emulator, adb, `lsof` or Chrome ran **outside the sandbox** (P10, D24). The session lock holder ran inside the sandbox.

Each long-running process was started detached, in its own session, through a helper: `nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' -- <cmd> > <log> 2>&1 < /dev/null &`.

1. **mock-core (P5).** `/usr/bin/lockf -k .locks/mock-core.lock /bin/sh <inner>`.
   - The inner script checks 4400. It was not listening, so it ran `npm run dev:mock` and wrote PID `50831` to `.locks/mock-core.pid`.
   - It then ran `mkdir -p .locks/mock-core.users` and `touch .locks/mock-core.users/step-19`.
2. **core-web.** `npm run dev:web`, which serves `http://127.0.0.1:5173/` (D41 f; never `localhost:5173`).
3. **Emulators (P3), started in parallel under separate locks.**
   - Phone: `/usr/bin/lockf -k -t 1800 .locks/dems_phone.lock /bin/sh <boot> dems_phone 5554`.
   - Tablet: `/usr/bin/lockf -k -t 1800 .locks/dems_tablet.lock /bin/sh <boot> dems_tablet 5556`.
   - The boot script runs `emulator -avd <avd> -port <port> -no-metrics -gpu host -no-boot-anim -no-snapshot-save` and writes the PID to `.locks/<avd>.pid`.
   - It then runs `adb -s emulator-<port> wait-for-device` and polls `getprop sys.boot_completed` until it reads `1`.
4. **Device session (P3).** `/usr/bin/lockf -k -t 1800 .locks/dems_phone.lock /usr/bin/lockf -k -t 1800 .locks/dems_tablet.lock /bin/sh <holder>`.
   - Both locks are taken phone first, then tablet.
   - The session was held 01:57:01-02:01:03 (4 min; the cap is 30 min).
   - Steps 5 to 11 ran inside it.
5. For each serial, `adb -s <serial> reverse --list` (empty before), then `ANDROID_SERIAL=<serial> npm run mobile:reverse`.
6. `npm run dev:mobile`, which runs `EXPO_NO_TELEMETRY=1 NODE_OPTIONS=--dns-result-order=ipv4first expo start --localhost --port 8081` (D41 b).
7. Phone launch:
   ```
   adb -s emulator-5554 shell am force-stop com.dems.demo.tablet
   adb -s emulator-5554 shell am start -W -n com.dems.demo.tablet/.MainActivity
   ```
   Then the same two commands on `emulator-5556`.
8. Synchronised capture at t and t+5 s:
   - Web: `playwright-core` from the session scratchpad drives the installed Chrome headless on `http://127.0.0.1:5173/`, viewport 1440×960.
   - Mobile: `adb -s <serial> exec-out screencap -p`, started in parallel with the web screenshot.
9. Teardown inside the session:
   - `am force-stop` on both serials.
   - `kill -TERM <Metro npm leader>`.
   - `adb -s <serial> reverse --remove-all` on both serials.
   - Release the session.
10. `kill -TERM <Vite npm leader>`.
11. **P5 release.** Under `.locks/mock-core.lock`, remove `users/step-19`. The directory was then empty, so `kill -TERM $(cat .locks/mock-core.pid)`, then remove the pid file.
12. `adb kill-server`. The server on 5037 was PID 51259, started by step 3.

## 3. Processes (every PID started by this step)

| PID(s) | Process | Bind | Started | Stopped by | Confirmed |
|---|---|---|---|---|---|
| 50831 → 50851 → 50873 → 50874 | `npm run dev:mock` → `npm run dev` → `tsx watch src/index.ts` → node server | `127.0.0.1:4400` (IPv4 only) | 01:56:00 | P5 release: `kill -TERM 50831` (the recorded PID), 02:01:23 | Log `"signal":"SIGTERM","msg":"shutdown requested"` then `"msg":"shutdown complete"` (same ms). All 4 PIDs exited. `lsof :4400` empty. `apps/mock-core/logs/errors.log` never created |
| 50983 → 51000 → 51022 | `npm run dev:web` → `npm run dev` → `vite` | `127.0.0.1:5173` | 01:56:09 | `kill -TERM 50983`, between 02:01:03 and 02:01:23 (not timestamped) | All 3 exited. `curl 127.0.0.1:5173` refused (exit 7). Only the foreign `[::1]:5173` (3489) remains |
| 51262 (+ child `netsimd` 51267) | qemu `dems_phone`, serial `emulator-5554` | console `127.0.0.1:5554` / `[::1]:5554`, adb `…:5555` (loopback) | 01:56:33; `boot_completed=1` after 6 s (quick-boot snapshot) | **Left running** (P3/D40) | PPID 1, own session (PGID 51262). PID in `.locks/dems_phone.pid` |
| 51273 | qemu `dems_tablet`, serial `emulator-5556` | console `…:5556`, adb `…:5557` (loopback) | 01:56:35; `boot_completed=1` after 2 s (quick-boot snapshot) | **Left running** (P3/D40) | PPID 1, own session (PGID 51273). PID in `.locks/dems_tablet.pid` |
| 51259 | adb server | `127.0.0.1:5037` | 01:56:33 (first `adb` call of step 3) | `adb kill-server`, after 02:01:23 (owner re-checked as 51259 first) | 51259 exited. 5037 free |
| 51407 | Session lock holder (`lockf` → `lockf` → `sh`) | none | 01:57:01 | `touch session.release` | Exited with code 0 at 02:01:03. Non-blocking `lockf -t 0` on both lock files succeeded afterwards |
| 51616 → 51637 → 51662 | `npm run dev:mobile` → `npm run dev` → `expo start --localhost --port 8081` (Metro) | `127.0.0.1:8081` | 01:57:17 | `kill -TERM 51616`, 02:00:55 | All 3 exited within 0.5 s. `lsof :8081` empty |
| app 5669 (phone), 5896 (tablet) | `com.dems.demo.tablet` on the AVDs | none | 01:57:32 / 01:57:56 | `am force-stop`, 02:00:5x | `pidof` empty on both. WS disconnect lines at 02:00:55 |
| (per run) | Chrome headless via playwright-core; `adb screencap`; `uiautomator dump` | none | 01:58:38-01:58:47; 01:59-02:00 | `browser.close()`; the children exited on their own | No process left |

**Final check (02:01).**
- Command: `lsof -nP -iTCP:{4400,5173,8081,5037} -sTCP:LISTEN`.
  - Only `node(3489) [::1]:5173` (foreign) is listed.
- Command: `kill -0` on every non-emulator PID above.
  - None is alive.

## 4. AC-40: `adb reverse --list` (PASS)

Before `mobile:reverse`, both lists were empty:

```
--- emulator-5554 reverse --list BEFORE
(empty, exit 0)
--- emulator-5556 reverse --list BEFORE
(empty, exit 0)
```

After `ANDROID_SERIAL=<serial> npm run mobile:reverse`:

```
--- AC-40: adb -s emulator-5554 reverse --list
host-10 tcp:4400 tcp:4400
host-10 tcp:8081 tcp:8081

--- AC-40: adb -s emulator-5556 reverse --list
host-24 tcp:4400 tcp:4400
host-24 tcp:8081 tcp:8081
```

Teardown:

```
emulator-5554 remove-all exit=0; list after: []
emulator-5556 remove-all exit=0; list after: []
```

## 5. AC-45: Metro bind address (PASS)

```
--- AC-45: lsof -nP -iTCP:8081 -sTCP:LISTEN
COMMAND   PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    51662 gsp-budi   33u  IPv4 0x73db1b12f1a73c87      0t0  TCP 127.0.0.1:8081 (LISTEN)
--- status
packager-status:running
```

- The bind address is **`127.0.0.1:8081`**: IPv4 loopback only, so PASS.
- This is the D41 b script (`NODE_OPTIONS=--dns-result-order=ipv4first`).
- One Metro served both devices; each device side is reversed to 8081 (P4).
- Metro log:
  ```
  Android Bundled 1113ms node_modules/expo-router/entry.js (5004 modules)
  Android Bundled 39ms node_modules/expo-router/entry.js (1 module)
  ```
  The first line is the phone and the second the tablet.

Other listeners recorded in the same run:

| Listener | Result |
|---|---|
| AC-35 mock-core | `node 50874 … IPv4 … TCP 127.0.0.1:4400 (LISTEN)`, the only 4400 listener |
| AC-21 core-web | `curl` gives `200`, with `<html lang="en" class="dark" data-theme="dark">` and `<title>DEMS Edge Client · Core Console</title>` |
| Vite listener (ours) | `node 51022 … IPv4 … TCP 127.0.0.1:5173 (LISTEN)` |
| Other 5173 listener | `node 3489 … IPv6 … [::1]:5173`, foreign, untouched |

## 6. AC-41: heartbeat reaches web, phone and tablet (PASS)

### 6.1 mock-core log (WS events, full list for this run)

```
01:56:01.360 "msg":"Server listening at http://127.0.0.1:4400"
01:57:10.163 "clientId":1,"clients":1,"origin":"http://127.0.0.1:4400","msg":"ws client connected"   ← tablet, snapshot-restored app
01:57:11.589 "clientId":2,"clients":2,"origin":"http://127.0.0.1:4400","msg":"ws client connected"   ← phone, snapshot-restored app
01:57:32.969 "clientId":2,"clients":1,"code":1006,"msg":"ws client disconnected"                    ← phone am force-stop
01:57:36.839 "clientId":3,"clients":2,"origin":"http://127.0.0.1:4400","msg":"ws client connected"   ← PHONE, fresh launch (app PID 5669)
01:57:56.340 "clientId":1,"clients":1,"code":1006,"msg":"ws client disconnected"                    ← tablet am force-stop
01:58:00.433 "clientId":4,"clients":2,"origin":"http://127.0.0.1:4400","msg":"ws client connected"   ← TABLET, fresh launch (app PID 5896)
01:58:39.819 "clientId":5,"clients":3,"origin":"http://127.0.0.1:5173","msg":"ws client connected"   ← web, React StrictMode dev mount #1
01:58:39.820 "clientId":5,"clients":2,"code":1006,"msg":"ws client disconnected"                    ← StrictMode dev unmount (1 ms later)
01:58:39.829 "clientId":6,"clients":3,"origin":"http://127.0.0.1:5173","msg":"ws client connected"   ← WEB (browser at http://127.0.0.1:5173/)
01:58:47.621 "clientId":6,"clients":2,"code":1001,"msg":"ws client disconnected"                    ← browser closed after the t+5 frame
02:00:55.211 "clientId":3,"clients":1,"code":1006,"msg":"ws client disconnected"                    ← phone am force-stop (teardown)
02:00:55.320 "clientId":4,"clients":0,"code":1006,"msg":"ws client disconnected"                    ← tablet am force-stop (teardown)
02:01:23.039 "signal":"SIGTERM","msg":"shutdown requested"
02:01:23.039 "msg":"shutdown complete"
```

The annotations after `←` come from the command timeline in §2. Both device clients send `Origin: http://127.0.0.1:4400` (H-S4, `SELF_ORIGINS`). They are told apart by sequential launches: the phone launched at 01:57:32 and connected as clientId 3; the tablet launched at 01:57:56 and connected as clientId 4.

- **AC-41 log condition:** `"clients":2` is present. clientId 3 and clientId 4 both connected with `"clients":2`, which is mobile plus mobile.
- **With the browser open:** `"clients":3` at 01:58:39.829 (clientId 6: web + phone + tablet).
- **Totals:** 49 `GET /api/v1/health`, 0 non-200 responses, 0 `warn` or `error` log lines, 0 `ws origin rejected`.

### 6.2 Frames at t and t+5 s

- **t:** 01:58:42.452.
- **t+5:** 01:58:47.453.
- **Capture skew:** every capture started within 5 ms of the frame time. The web screenshot took about 62 ms; the screencaps took 139-280 ms.
- **Web values:** read from the DOM just before and just after each screenshot (`data-testid` `heartbeat-chip`, `heartbeat-seq` via `aria-label`, `health-version`). The screenshot shows the "before" value.
- **Mobile values:** read from the frames (testIDs `heartbeat-chip`, `heartbeat-seq`, `health-version`).

| Client | t frame | t+5 frame | `heartbeat-seq` t → t+5 | Δ (≥ 4 required) | `heartbeat-chip` | `health-version` | Size |
|---|---|---|---|---|---|---|---|
| Web (Chrome, `http://127.0.0.1:5173/`) | [19_web_t0.png](assets/19_web_t0.png) | [19_web_t5.png](assets/19_web_t5.png) | **160 → 165** (DOM probe before/after: 160/161 → 165/166) | **5** | Live / Live | `mock-core v0.1.0 · api v1` | 1440×960 |
| `dems_phone` (emulator-5554) | [19_dems_phone_t0.png](assets/mobile/19_dems_phone_t0.png) | [19_dems_phone_t5.png](assets/mobile/19_dems_phone_t5.png) | **161 → 165** | **4** | Live / Live | `mock-core v0.1.0 · api v1` | 1080×2424, single column |
| `dems_tablet` (emulator-5556) | [19_dems_tablet_t0.png](assets/mobile/19_dems_tablet_t0.png) | [19_dems_tablet_t5.png](assets/mobile/19_dems_tablet_t5.png) | **161 → 165** | **4** | Live / Live | `mock-core v0.1.0 · api v1` | 2560×1600, two panes |

Supporting readings:

- **Web.** The clock card shows `01:58:41 → 01:58:46` (serverTime of the last heartbeat) and `clients: 3` in both frames. Chrome console errors: 0.
  - The page's WS `ws://127.0.0.1:4400/ws` received its first heartbeat about 250 ms (39.578Z → 39.831Z) after `goto`: `{"type":"heartbeat","v":1,"seq":158,…,"clients":3,"sessionState":null}`.
  - "Live" showed 372 ms after `goto`.
  - seq rose from 158 to 166 over the page's life.
- **Mobile t0 frames.** Both read 161 while the web read 160. The screencaps took 188-280 ms and finished after the 161 tick, whereas the web screenshot finished in about 62 ms, before it. All three clients are on the same 1 Hz broadcast.
- **Frame hashes (sha256, first 16 hex).** web t0 `84f4633a98fa7f09`, t5 `cb7c910c938b291a`; phone t0 `19006ce2c9b45fb1`, t5 `c3c89eec648a59aa`; tablet t0 `d3ef56f1b0806930`, t5 `ddfefbe5554f72cb`.

## 7. Decisions and deviations

| # | Item | Decision | Reason |
|---|---|---|---|
| S19-1 | Scope: both AVDs | The smoke ran web + `dems_phone` + `dems_tablet` at the same time. Blueprint row 19 names only `dems_tablet`, and AC-41 is worded for two clients (`"clients":2`) | Controller delegation: "the counter advancing on web, phone and tablet". This is a superset: the `"clients":2` line exists (§6.1), plus a `"clients":3` line with all three |
| S19-2 | `npm run mobile:reverse` with two devices | Ran as `ANDROID_SERIAL=<serial> npm run mobile:reverse`, once per serial. adb reads `ANDROID_SERIAL`, so the repo script ran unchanged | The script calls bare `adb reverse`. With two emulators attached, adb needs a serial. Plain adb then answers "more than one device/emulator" (known adb behaviour, **not run here**). **Run-guide note for step 60** (README "Emulator networking") |
| S19-3 | AVD locks | Both locks were held for the whole device session (phone, then tablet) | The step needs both AVDs at once, the same pattern P3 allows for steps 57 and 59. Pre-gate step 19 had no other lock users. Boots were each under their own AVD lock (P3) |
| S19-4 | Quick-boot snapshot | Boot used the P3 flags, so the quick-boot snapshot loaded (`-no-snapshot-load` is not in P3). The row-18 snapshot held a **running app instance**. It reconnected by itself once the adb reverse rules existed (clientIds 1 and 2). Both were force-stopped and relaunched, so the AC-41 clients are fresh launches served by this session's Metro | Deterministic evidence. **Note for steps 57, 59, 61, 67 and the mobile rows:** after a quick boot, `am force-stop com.dems.demo.tablet` before the first launch. `-no-snapshot-save` keeps the row-18 snapshot unchanged |
| S19-5 | One Metro | One `npm run dev:mobile` on host 8081 served both devices (each reversed `tcp:8081 tcp:8081`) | P4: the device side is always 8081. P9 allows ≤ 2 Metro. The controller assigned 8081 to this step (P4 has no step-19 row; it is pre-gate and owns every process) |
| S19-6 | Web double connect | clientId 5 opened and closed within 1 ms (code 1006) before clientId 6 | React StrictMode double-mounts effects in dev. This is expected, not a defect. A production build mounts once |
| S19-7 | `uiautomator dump` | Tried as supplementary text evidence. It fails on both AVDs with `ERROR: could not get idle state.` after about 11 s | The Skia pulse and the 1 Hz re-render keep the UI from going idle. AC-41 specifies screenshots, which are the evidence here. **Risk hypothesis for step 90 and the Maestro-based MA checks:** idle-wait tooling may stall on the home screen. Not verified |
| S19-8 | Browser tool | `playwright-core` already in this session's scratchpad (installed by row 17; **not** a workspace dependency), driving the installed Google Chrome headless with a throwaway context | Files must be saved and linkable. The same method as row 17 (S17-9) |
| S19-9 | mock-core stop | `kill -TERM` on the recorded npm leader PID only (P5). The signal propagated down once: npm → npm → tsx watch → server. The result was a graceful `shutdown complete` with no double signal. `.locks/mock-core.pid` was removed after the confirmed stop (a stale PID would mislead the next P5 user). `.locks/mock-core.users/` was left, empty | P5 and §3.5 |
| S19-10 | Emulators | **Left running** after the smoke (D40 exception to P7, allowed by the delegation). `.locks/dems_phone.pid` = `51262` and `.locks/dems_tablet.pid` = `51273`. The app is force-stopped and there are no reverse rules | Saves the boot in step 67 (W2). **Step 67 (or whichever step next needs a device) should find both up:** `adb devices` lists `emulator-5554` and `emulator-5556` once any adb command restarts the server. Stop command if needed: `adb -s emulator-5554 emu kill; adb -s emulator-5556 emu kill` |
| S19-11 | adb server | Stopped with `adb kill-server` after confirming the 5037 owner was 51259 (this step's) | P7. The emulators keep running, and the next `adb` call starts a fresh server that re-attaches both |
| S19-12 | Shared files | `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `implementation/99_implementation_report.md` were **not** written | P6/P8 parallel run. Progress is in `delegation_progress/coder_execution_step_19.md` |
| S19-13 | Raw logs | The mock-core, Metro, Vite and emulator logs and the capture JSON stay in the session scratchpad (`…/scratchpad/s19/`). Only the relevant lines are quoted here | The raw capture JSON contains an ephemeral Vite HMR token, and the logs carry the host name. Neither is needed as evidence |
| S19-14 | Sandbox | Bypass was used per command for port binding (mock-core, Vite, Metro), `lsof`, emulator, adb, Chrome and the capture | D24, P10. User option: `sandbox.network.allowLocalBinding: true` allows local binding without leaving the sandbox; the emulator still needs a bypass (D24) |

## 8. Host impact

- No files were written outside the workspace, apart from the session scratchpad.
- AVD user data is unchanged: no install, and `-no-snapshot-save` means the quick-boot snapshots were not re-saved.
- `adb reverse` rules were added and then removed on both devices.
- Workspace writes:
  - `.locks/`, holding `mock-core.lock`, `dems_phone.lock`, `dems_tablet.lock`, `dems_phone.pid`, `dems_tablet.pid` and an empty `mock-core.users/`.
  - This log.
  - `implementation/assets/19_web_t{0,5}.png`.
  - `implementation/assets/mobile/19_dems_{phone,tablet}_t{0,5}.png`. The `assets/mobile/` folder was created per P3.

## 9. Rollback

Nothing to roll back in code or configuration. To return the host to "no emulator running":

```
adb -s emulator-5554 emu kill; adb -s emulator-5556 emu kill; adb kill-server
rm -f .locks/dems_phone.pid .locks/dems_tablet.pid
```

---
*Generated: 2026-10-01 02:02 WIB*
