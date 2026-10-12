---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: environment for the CONFIRMATION of fix wave J (tree after wave J; a git agent commits in parallel)
date: 2026-10-12
agent: coder-execution (environment; rules D94 / D122 / D163)
narrative_tier: 3
status: complete - both lanes up and left running, no reset; phone on lane 1, tablet on lane 2, both at Login with "Core online"; both smokes held
builds_on: initialization/11_gate_environment_judging.md (kept unchanged; what is not listed here is as note 11 says and is cited, not repeated)
---

# 12 - Environment for the confirmation of fix wave J (left running)

> **HARD RULE - LOCAL DEVICES (the user's, decision D163, by its letter).**
> NO agent run SELECTS, pre-checks or starts a LOCAL_DEVICE source: **`CAM-03`** and **`MIC-03`** are
> this Mac's camera and microphone. They are never put on a selector line - not even "select only" -
> by a driver, a test runner, a gate session, a judging or a confirmation session, in the web console,
> on a device or through the API. No agent sets `DEMS_LOCAL_SESSION_ATTENDED` or `DEMS_USER_ATTENDED`.
> Lane 2 is used with `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02` (FAKE, generated) only. A run with the
> real devices is the user's own, from the user's own Terminal. If a selector line is ever found naming
> `CAM-03` / `MIC-03`: put the FAKE default back through the API and report it. (Found this time: it
> does not name them; nothing had to be put back.)

Run window 12:31-12:39 WIB on 2026-10-12. Only this note was written outside `.data/`, `.cache/`,
`.locks/`; no git write; no product source, test or other doc edited. `.data/pg*.env` and the pwfile
were not read. **No lane was reset** (lane 2 data kept, lane 1 data kept). Nothing under `.data/` was
deleted by hand. No local device was selected, pre-checked or started; no attendance variable set;
nothing was played. Ports 5173-5175, 8000, 5432: nothing listens there. No emulator rebooted, no unlock
needed, no lock / PIN / fingerprint change, no app data cleared, nothing reinstalled, no Gradle build;
nobody signed in on a device (the only device input: the BACK key to close the keyboard, and one tap on
the X of the dev toast on each device). Scratch and logs: `.cache/gate-env/confirm/`
(0700; `start_1.log`, `start_2.log`, `state.sh`, `smoke_session.sh/.log`, `l{1,2}_{a,b}_*.json`
= state before / after the smoke, `op40_*`, `verify_*`, `composite.raw`, `op41_recorded.raw`,
screenshots `dev_*`, `login_*`, `final_*`).

## 1. What differs from note 11

| | Note 11 (22:28 on 11 Oct) | Now |
|---|---|---|
| Lane 1 | reset, Core PID 96412 | **not reset**, Core **PID 49604**, `http://127.0.0.1:4421`, exit 0, "ready", log `.locks/core-server.lane1.log` |
| Lane 2 | Core PID 96458 | Core **PID 49674**, `http://127.0.0.1:4422`, exit 0, `--with-camera-stub --speech-mic`, redirected (never piped) to `.cache/gate-env/confirm/start_2.log` (0600); no reset |
| Web lane 1 / 2 | 96553 / 96554 | restarted: **PID 50023** (`http://127.0.0.1:5176/`) / **PID 50025** (`http://127.0.0.1:5177/`); started with the forms of note 05 section 6 (`DEMS_CORE_PROXY_PORT=442N VITE_DEMS_CORE_MODE=live nohup npm run -s dev -w @dems/core-web -- --port 517N --strictPort --host 127.0.0.1`, logs `.locks/core-server.lane{1,2}.vite.log`). `/` 200, `/api/v1/health` ok + `ready.database/engine true`, `/media/x` 401 on both |
| Metro | 96578 | restarted on this tree: **PID 50049**, port 8081 (`nohup npm run -s dev:mobile > .locks/metro.8081.log`), `packager-status:running`, `Android Bundled ... node_modules/expo-router/entry.js (6254 modules)` on the first launch |
| Camera stub (lane 2) | UDP 61022, TCP 53237 / 53238 | discovery UDP **50232**, device TCP **59808**, RTSP TCP **59809** (loopback, from the `LANE_CAMERA_STUB_STARTED` line of the Core log); preset file `.locks/camera-stub.lane2.mode` untouched |
| Fixture account of the stub | `.locks/camera-stub.lane2.fixture` | the **same path**, made anew at 12:31 (0600, 42 bytes), removed at stop; the start output copy is `.cache/gate-env/confirm/start_2.log` (0600). Its content is not written here and must stay out of every report. Every earlier account is dead |
| Lane 2 boot | epoch 55 | epoch 58, `auditTotal 1673`, session `SEALED`, `restartFault null`; `TRANSCRIBER_RESOLVED` `cpu-local, vad READY`; `CAPTURE_FENCE_PASSED` `registered "", local "CAM-03,MIC-03"`; `CAPTURE_SUPERVISOR_BOOTED` `mode real` |
| Core log since the start | | lane 1: 63 info, 0 warn, 0 error. Lane 2: 0 error; 16 warn: the three expected boot lines (`INSTALLATION_IDENTITY_NOT_CONFIGURED`, `SEALING_DEVELOPMENT_SEAL_RIG`, `SEALING_QUARANTINE_HOLDS_SESSIONS`), `CAPTURE_FIRST_VIDEO_HELD` x2 (the smoke's two cameras) and `CAPTURE_MIC_RATE_AT_LIMIT` x11 (the smoke; host 1-minute load 5 at the start, 12.6 at the end) |
| Device login "App" line | `v2.4.1` | the Login footer reads `App v0.1.0` on both devices (read from the screenshots; not investigated) |
| Host | | PostgreSQL PID 32505, `127.0.0.1:4432`, untouched. Load (1-minute) 5.1 at the start, 12.6 at the end (the smoke) |

The three dev servers of the earlier note (96553, 96554, 96578) were stopped by PID after a force-stop of
the app on both devices.

## 2. THE LAUNCH FORM OF RECORD

**From now on the normal launch is the form of record** (not the `motion=off` deep link of notes 05, 06,
11): no motion switch, so the motion policy is `full`; the Core link stays LIVE because that choice is
stored. Both devices use the same package, `com.dems.demo.tablet` (source: `report/judging_b2_motion_on.md`
section 2).

```
adb -s <serial> shell am force-stop com.dems.demo.tablet
adb -s <serial> shell monkey -p com.dems.demo.tablet -c android.intent.category.LAUNCHER 1
```

A cold launch with a cold Metro shows a black screen for a while and then the Login builds up (judging
B2, JM-N4); here Metro was warm after the first bundle and the Login was there within the first minute.
The Login opens with the Username field focused and the keyboard up: press BACK once to close the keyboard
(it does not type). The dev toast "Open debugger to view warnings." lies over the footer: close it with its
X (phone about x 993, y 2229; tablet about x 2495, y 1439); it returns after a reload.

**Tooling consequence:** with motion on, `uiautomator dump` answered `ERROR: could not get idle state.` on
both devices at the Login (the ambient loops keep the UI from idling). Read the screen from a screenshot
(`adb -s <serial> exec-out screencap -p > file.png`); taps by coordinates as before. Note 11 section 7 says
the dump also hangs during a recording; here it fails at the Login already.

## 3. Devices

| | Phone | Tablet |
|---|---|---|
| Serial / AVD | `emulator-5554` / `dems2_phone` (1080 x 2424) | `emulator-5556` / `dems2_tablet` (2560 x 1600) |
| Lane | **1** | **2** |
| Reverse rules (read back at the start, and again at the end; none was missing, none restored) | `tcp:8081 tcp:8081`, `tcp:4420 tcp:4421` | `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422` |
| Screen after the normal launch (screenshots) | Login ("Sign In"), after closing the toast: `Core online`, `Core: DEMS-IR-01 - paired as DEV-0002` | Login, `Core online`, `Core: DEMS-IR-01 - paired as DEV-0001` |
| Pairing in the registry | `DEV-0002` of `dems_lane_1`, online | `DEV-0001` of `dems_lane_2`, online |
| Sign-in fields | show only their hint (screenshot); nothing typed, no content read | the same |
| State at the end | Login, toast closed, rules as above | Login, toast closed, rules as above |

Neither device showed Pair. A wrong lane port makes the app delete its pairing: never change `tcp:4420`
under a running app (note 11 section 7).

## 4. What the user's trial left, and what I changed

Read-only; the helper's two supervisor sessions were signed out and their jars removed. Compared with the
last lines of `delegation_progress/judging_slots.md` (J2-M, 11:09): **the data is exactly what that file
describes; the user's hand trial left no session, no item, no alert and no selector change that I can find**
(no later session id, no new item). This is an inference from state, not from a log of the user's actions.

| Check | Lane 1 | Lane 2 |
|---|---|---|
| Session open | none: `session/current` = `SES-20261012-0026`, `SEALED` (acknowledged) | none: `SES-20261012-0101`, `SEALED` (acknowledged) - before my smoke |
| Selector lines | `CAM-01`, `CAM-02` (`H264_1080P25`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false` | `CAM-01`, `CAM-02` (`H264_720P30`), `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`. **No line names `CAM-03` / `MIC-03`; nothing was put back** |
| Active alerts | **0** (3 alerts in all, last `ALR-000011`) | **0** (94 alerts in all, last `ALR-000186`); nothing acknowledged by me |
| New evidence since `EV-20261012-0069` | n/a (separate numbering; last `EV-20261012-0016`) | `EV-20261012-0070`, `EV-20261012-0071` (J2-M's two sessions, `SES-20261012-0100` / `-0101`, in the slots file); none from the user's trial |
| Audit chain | `view.ok true`, `stored.ok true`, 195 rows, `firstBadSeq null` | `view.ok true` (1000 checked), `stored.ok true`, 1678 rows, `firstBadSeq null` |
| Evidence count | 16 (`SEALED` 11, `RECORDED` 3, `EXPORTED` 1, `UNDER_REVIEW` 1; tampered `EV-20261011-0005`) | 67 before the smoke (`SEALED` 51, `EXPORTED` 14, `RECORDED` 1, `UNDER_REVIEW` 1; tampered `EV-20261009-0005`), **68 after** |
| Rigs (`seal-rig 2 status`, `source-rig 2 status`; read only) | n/a | both **OFF**, before the start, after it and at the end; never switched |
| Quarantine folders (names only) | none (no `.quarantine` folder) | `SES-20261011-0041`, `-0045`, `-0052`, `-0065` |
| Capture devices | n/a | `CAM-01`, `CAM-02`; `CAM-03` (LOCAL_DEVICE, on no line); `CAM-04`, `CAM-05`, `CAM-06` (dead ports, on no track: do not assign); `MIC-01`, `MIC-02`; `MIC-03` (LOCAL_DEVICE, on no line); `POE-SWITCH` |
| Pairing | `DEV-0002` online, `DEV-0001` offline | `DEV-0001` online, `DEV-0002` offline (the phone's old registration, kept) |

**What I changed: nothing in the trial's data.** No session was cancelled (none was open), no selector put
back, no rig switched, no alert acknowledged. What the run added is the smoke of section 6 (below).

## 5. Lane data in two lines each

- **Lane 1** (disposable but NOT reset): the 13-item demo seed (v1 shape, tampered `EV-20261011-0005`) plus the demo-fault and round-two items up to `EV-20261012-0016` (16 items); `EV-20261012-0014` and `-0015` are never-sealed records (`RECORDED`); no session open; audit chain ok, 196 rows after my one verify.
- **Lane 2** (REAL_DEVELOPMENT, FAKE sources, KEPT): 68 items after the smoke (new: `EV-20261012-0072`), 4 quarantine folders, no session open (`SES-20261012-0102` `SEALED`, acknowledged); audit chain ok, 1685 rows, 95 alerts, none active; next session `SES-20261012-0103`.

## 6. Smoke through the API (one run each; the session helper, `.cache/gate-env/gate-session.mts`)

| Lane | Check | Result |
|---|---|---|
| 2 | ONE 45 s session on the FAKE sources (the script refuses any selector other than `CAM-01, CAM-02, MIC-01, MIC-02`) | **SEALED.** `SES-20261012-0102`, item **`EV-20261012-0072`**, case `LP/2026/1012-9801`, "Wave J Confirmation Smoke". Create 201 -> pre-check 202, `PASS` (the `TIME` item showed a warning, as on the earlier smokes; start with `acknowledgeWarnings`) -> start 200 -> `RECORDING` 12:36:37 -> stop 202 with a reason -> `SEALED`; `stoppedAt` 12:37:24.342, `sealedAt` 12:37:32.970; `captureDurable true`; seal steps CLOSE_TRACKS 252 ms, FINALIZE_HASHES 115, FINALIZE_TRANSCRIPT 8106 |
| 2 | Manifest `tracks[].profile` | **`H264_720P30`** on `VIDEO-01` and `VIDEO-02`, read from the stored `session-manifest.json` (`.data/media/dems_lane_2/sessions/SESSION-SES-20261012-0102/`); op 40 `files[].profile` says the same; `interrupted false` |
| 2 | Verify (op 41) | HTTP 200, **`overall PASS`, 15 of 15 checks PASS**; `ok`, `manifestOk`, `signatureOk`, `transcriptOk` true; both files `ok`; `failedFragmentCount 0`; transcript `READY` |
| 2 | Op 64 (`GET system/status`) `components` | `core` = `dems-core-server 0.2.0`, **`captureWorker` = `capture-worker/0.5.0`**, `apiContract 0.3.0` |
| 2 | Op 41 on a never-sealed item | **Lane 2 has no INCOMPLETE item**: its four INCOMPLETE sessions (`SES-20261011-0041`, `-0045`, `-0052`, `-0065`) are quarantined and have no evidence item. The only never-sealed item of the lane is the seeded `RECORDED` item `EV-20261009-0006`: op 41 on it answers **409 `NOT_SEALED`** ("This item was never sealed: there is nothing sealed to verify."; `details.simCode UNSEALED_EVIDENCE`). That is a seed `RECORDED` item, not an INCOMPLETE one |
| 2 | Composite export of `EV-20261012-0072` (op 42, body `kind COMPOSITE`) | **409 `COMMAND_UNSUPPORTED`, `details.reason COMPOSITE_ENCODER_NOT_SELECTED`** ("Composite video is not available in this build."). Counts before / after: the item's `exports` 0 -> 0, EXPORTED items on the lane 14 -> 14, audit stored rows 1684 -> 1684 (a refusal wrote no row). Op 40 `exportKinds` lists `COMPOSITE` with `available false` and the same reason |
| 2 | Alerts / log | one new alert `ALR-000188` (INFO, inactive); Core log: 0 error; the warns of section 1 |
| 2 | Summary acknowledged | op 37, 204 |
| 1 | Sign in (helper), op 41 on the clean seed item `EV-20261010-0001` | 200: **`demonstration true`**, `ok true`, `manifestOk true`, `signatureOk true`, tracks `VIDEO-01`, `VIDEO-02`, `AUDIO-01`, `AUDIO-02` all `ok true` (the v1 answer of a SIMULATED lane: no `overall`). (Op 40 / op 41 on `EV-20261009-0001` answers 404 now: that item is not in lane 1 any more; the seed ids start at `EV-20261010-0001`.) |
| 1 | Extra: op 41 on the never-sealed record `EV-20261012-0014` (an INCOMPLETE session's record) | 409 `NOT_SEALED` |
| 1 | Op 64 `components` | `core` and `apiContract` only (no `captureWorker`: a SIMULATED lane has no worker) |

Both helper sessions were signed out (204; a later read answered 401) and both jars removed (no `*.jar`
left in `.cache/gate-env/`). Both rigs read OFF after the smoke.

## 7. Signing in, rigs, slot

Signing in (seeded operators `OPR-001` INVESTIGATOR, `OPR-002` SUPERVISOR, `OPR-003` TECHNICIAN; the
published demo sign-in is in `README.md`; on a device `.cache/gates/89c/login.sh <serial> <ROLE>`, outside the
sandbox; after sign-in answer **"Not now"** to "Enable biometric sign-in?"; API session without typing
`npx tsx .cache/gate-env/gate-session.mts <1|2> SUPERVISOR`, jar `.cache/gate-env/session_lane<N>_SUPERVISOR.jar`,
`origin: http://127.0.0.1:5176` / `5177`; `.cache/gate-env/wave-m/api.sh <lane> <METHOD> <path> [json]`) is
as in note 11 section 5. Read endpoints used here: `session/current`, `session/history`, `alerts`,
`audit/chain`, `capture/config`, `capture/devices`, `pairing/devices`, `system/status`, `evidence?limit=50`
(+ `&cursor=<nextCursor>`), `evidence/{id}`.

**Rig usage (lane 2 only, both OFF now; outside the sandbox, from the repository root):**

```
scripts/lane/lane.sh seal-rig 2 status | blocked | unsealable | release     # blocked / unsealable BEFORE the session is ended; ALWAYS end with release
scripts/lane/lane.sh source-rig 2 status | unreachable <deviceId> | release # a FAKE CAMERA or MICROPHONE only; a second call ADDS a device; ALWAYS end with release
```

Details, effects and the retry paths: note 11 section 6.

**The slots file rule** (`delegation_progress/judging_slots.md`, append-only): every judge or session that
takes a lane's session slot, a rig, or a restart of a Core announces it on its own line (time, who, lane or
rig, "in use" / "held" with what it will do) BEFORE it starts and appends a "free" line (with what was left:
session state, rigs read back, selector) when it ends. Lane 2 has ONE session slot; take it only while
`session/current` is not open (an acknowledged `SEALED` session counts as not open). Two judges never hold the
same slot or rig at once. This run took no slot (no judge was running) and wrote no line: it was told to touch
only `.data/`, `.cache/`, `.locks/` and this note. **Both lanes' slots and both rigs are free now.**

## 8. STOP procedure

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5554 reverse --remove-all
adb -s emulator-5556 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5556 reverse --remove-all
kill -TERM $(lsof -nP -t -iTCP:8081 -sTCP:LISTEN)      # Metro (50049)
kill -TERM $(lsof -nP -t -iTCP:5176 -sTCP:LISTEN)      # web lane 1 (50023)
kill -TERM $(lsof -nP -t -iTCP:5177 -sTCP:LISTEN)      # web lane 2 (50025)
scripts/lane/lane.sh seal-rig 2 status                 # must say OFF before the stop; else: seal-rig 2 release
scripts/lane/lane.sh source-rig 2 status               # same; else: source-rig 2 release
scripts/lane/lane.sh stop 1 ; scripts/lane/lane.sh stop 2 ; scripts/lane/lane.sh status
```

Outside the sandbox. Stopping lane 2 stops the stub and removes its fixture file; its data stays. **NO reset
of lane 2 afterwards, and none of lane 1 unless asked.** After `reverse --remove-all` each device keeps its
credential: before the next launch restore `tcp:8081 -> 8081` on both and **`tcp:4420 -> 4421` on the phone,
`tcp:4420 -> 4422` on the tablet** (a wrong lane port makes the app delete its pairing). Restart: the lane
commands of section 1 (`lane.sh start 1`; `lane.sh start 2 --with-camera-stub --speech-mic`, redirected to a
file, never piped), the web and Metro forms of section 1, then the launch form of section 2. PostgreSQL (PID
32505, `127.0.0.1:4432`) stays up. Emulators: the controller's or the user's call.

## 9. Not proven / limits

- No flow on a device or in a browser: both apps were relaunched in the normal form and read at Login from
  screenshots; nobody signed in on a device; no web page was opened beyond `/` (200); the sessions were
  driven through the API.
- The statement "the user's trial left nothing" rests on state (ids, counts, selector, alerts, audit) matching
  the last line of the slots file; the user's actions themselves were not logged anywhere I read.
- `uiautomator dump` could not be used at the Login with motion on (section 2); the "Core online" and pairing
  lines were read from screenshots only.
- Lane 2 has no INCOMPLETE evidence item; the 409 `NOT_SEALED` of op 41 was proven on the seeded `RECORDED`
  item `EV-20261009-0006` (and, extra, on lane 1's `EV-20261012-0014`).
- The 45 s smoke ran under a host load of 5 to 12; 11 `CAPTURE_MIC_RATE_AT_LIMIT` warns are in the lane 2
  log for it, none was an error and the session sealed.

---
*Generated: 2026-10-12 12:42 WIB*
