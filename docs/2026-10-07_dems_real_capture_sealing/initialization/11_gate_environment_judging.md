---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: device / browser environment for the UI judging session (tree = batch N)
date: 2026-10-11
agent: coder-execution (environment; rules D94 / D122 / D163)
narrative_tier: 3
status: complete - both lanes up on the batch N tree and left running; phone on lane 1 (DEV-0002), tablet on lane 2 (DEV-0001), both at Login; both smokes held
builds_on: initialization/10_gate_environment_wave_m.md with 05, 06, 08, 09 (all kept unchanged; what is not listed here is as they say and is cited, not repeated)
---

# 11 - Environment for the UI judging session (left running)

> **HARD RULE - LOCAL DEVICES (the user's, decision D163, by its letter).**
> NO agent run SELECTS, pre-checks or starts a LOCAL_DEVICE source: **`CAM-03`** and **`MIC-03`** are
> this Mac's camera and microphone. They are never put on a selector line - not even "select only" -
> by a driver, a test runner, a gate session or a judging session, in the web console, on a device or
> through the API. No agent sets `DEMS_LOCAL_SESSION_ATTENDED` or `DEMS_USER_ATTENDED`. Lane 2 is used
> with `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02` (FAKE, generated) only. A run with the real devices is the
> user's own, from the user's own Terminal. If a selector line is ever found naming `CAM-03` / `MIC-03`:
> put the FAKE default back and report it.

Tree = `713d83f` plus batch N (a git agent commits in parallel). Only this note was written outside
`.data/`, `.cache/`, `.locks/`; no git write; no product source, test or other doc edited.
`.data/pg*.env` and the pwfile were not read. **Lane 2 was NOT reset**; lane 1 was reset (asked).
Nothing under `.data/` was deleted by hand. No local device was selected, pre-checked or started; no
attendance variable set; nothing was played. Ports 5173-5175, 8000, 5432: nothing listens there. No
emulator rebooted, no unlock needed, no lock / PIN / fingerprint change, no app data cleared, nothing
reinstalled, no Gradle build; nobody signed in on a device. Run window 22:28-22:34 WIB. Scratch and
logs: `.cache/gate-env/judging/` (0700).

## 1. Lanes

| | Lane 1 - the DEMONSTRATION experience | Lane 2 - the REAL-CAPTURE experience on fake sources |
|---|---|---|
| Mode | SIMULATED, demo controls ON | REAL_DEVELOPMENT (FAKE sources), camera stub + speech microphone |
| Core | **PID 96412**, `http://127.0.0.1:4421` | **PID 96458**, `http://127.0.0.1:4422` |
| Started | `lane.sh reset 1` (exit 0, audit head `seq 83`, v2 demo packages `NOT generated` - expected on a SIMULATED lane), then `lane.sh start 1` | `lane.sh start 2 --with-camera-stub --speech-mic`, redirected to `.cache/gate-env/judging/start_2.log` (0600), never piped; **no reset** |
| Web console | **PID 96553**, `http://127.0.0.1:5176/` | **PID 96554**, `http://127.0.0.1:5177/` |
| Web checks | `/` 200, `/api/v1/health` ok + ready, `/media/x` 401 | the same |
| Database / media root | `dems_lane_1` / `.data/media/dems_lane_1/sessions` | `dems_lane_2` / `.data/media/dems_lane_2/sessions` |
| Core log since the start | 32 info, 0 warn, 0 error | 0 error; warn: the three expected boot lines (`INSTALLATION_IDENTITY_NOT_CONFIGURED`, `SEALING_DEVELOPMENT_SEAL_RIG`, `SEALING_QUARANTINE_HOLDS_SESSIONS` count 4) + the smoke's four (section 4) |
| Device | the PHONE | the TABLET |

Always the `127.0.0.1` address for a web console (at `localhost` it refuses Live mode).

Metro: **PID 96578**, port 8081, restarted on this tree; `Android Bundled ... (6240 modules)`;
`packager-status:running`. The three dev servers of note 10 (57202, 57199, 57226) were stopped by PID
after a force-stop of the app on both devices. PostgreSQL: PID 32505, `127.0.0.1:4432`, untouched.

Lane 2 boot log: `LANE_CAMERA_STUB_STARTED`; `LANE_SEAL_RIG_INSTALLED` and `LANE_SOURCE_RIG_INSTALLED`
(both "installed and OFF"); `engine started`: `epoch 55, auditTotal 1239, session SEALED, restartFault
null, restartFaultEnded false, auditRows 0`; `TRANSCRIBER_RESOLVED` `cpu-local, vad READY`;
`CAPTURE_FENCE_PASSED` `registered "", local "CAM-03,MIC-03"`; `CAPTURE_BOOT_CHECKS_PASSED` `checks
real, capture-worker/0.5.0`; `CAPTURE_CONFIG_LOADED` `devices 10, revision 2, locked false`;
`CAPTURE_SUPERVISOR_BOOTED` `mode real`.

**Camera stub** (inside the lane 2 Core): discovery UDP 61022, device TCP 53237, RTSP TCP 53238; preset
`NORMAL` (mode file `.locks/camera-stub.lane2.mode`, read, not written; presets: note 06 section 7.2).
**Its fixture account is in `.locks/camera-stub.lane2.fixture`** (0600, 42 bytes, made anew at 22:28,
removed at stop; the start output copy is `.cache/gate-env/judging/start_2.log`, 0600). Its content is
not written here and must stay out of every report. Every earlier account is dead.

## 2. Devices

| | Phone | Tablet |
|---|---|---|
| Serial / AVD | `emulator-5554` / `dems2_phone` (1080 x 2424) | `emulator-5556` / `dems2_tablet` (2560 x 1600) |
| Lane | **1** (moved in this run) | **2** (unchanged) |
| Device id | **`DEV-0002` of `dems_lane_1`**, `PAIRED`, online | **`DEV-0001` of `dems_lane_2`**, `PAIRED`, online |
| Reverse rules (read back at the end) | `tcp:8081 tcp:8081`, `tcp:4420 tcp:4421` | `tcp:8081 tcp:8081`, `tcp:4420 tcp:4422` |
| Screen (uiautomator, new bundle) | Login ("Sign In"), `Core online`, `Core: DEMS-IR-01 - paired as DEV-0002`, `v2.4.1` | Login, `Core online`, `Core: DEMS-IR-01 - paired as DEV-0001`, `v2.4.1` |
| Sign-in fields | both show only their hint (length 0; content never printed) | the same |
| Dev toast "Open debugger to view warnings." | closed on the phone (returns after a reload) | still on the Login: close it with its X first |

Health: lane 1 `ws.clients 1`, lane 2 `ws.clients 1`. Screens:
`.cache/gate-env/judging/dev_emulator-5554.png`, `dev_emulator-5556.png`, `phone_pair.png`.

How the phone was moved (the reverse of note 08 section 3): app force-stopped, `adb -s emulator-5554
reverse tcp:4420 tcp:4421` (`tcp:8081` kept), relaunch with the form of note 06 section 7.4. The app
dropped its lane 2 credential and opened **Pair this tablet** ("Tablet not registered"). A code was
issued on lane 1 through op 15 (`POST pairing/code` `{}`, 201) with the helper's supervisor session
and typed into the 6-digit field by `.cache/gate-env/judging/pair_phone.py` (it never prints the
code); "Pair" -> Login. Two codes were issued on lane 1: `PCD-000003` was NOT used (the first typing
entered one digit only - `input text` lost the rest when the keyboard opened; it expires by itself
after 5 minutes) and `PCD-000004` paired the phone (typed digit by digit with key events).

Registries after the move:
- lane 1: `DEV-0002` (the phone, online) and `DEV-0001` (the phone's pairing of 10 Oct, kept by the
  reset, offline and dead on the device side).
- lane 2: `DEV-0001` (tablet, online) and **`DEV-0002` (the phone's old registration, `PAIRED`,
  offline) - left in the registry, not removed.**

## 3. State of the data

**Lane 2 (KEPT - do NOT reset):**
- **52 evidence items**: 13 seed items (clean `EV-20261008-0001`, tampered `EV-20261009-0005`) + 39
  development items `EV-20261010-0014` .. `EV-20261011-0056` (clean, interrupted x7, blocked-then-sealed,
  revisions, 10 EXPORTED); 4 quarantine folders (`SES-20261011-0041`, `-0045`, `-0052`, `-0065`);
  capture devices `CAM-01`..`CAM-06`, `MIC-01`..`MIC-03`, `POE-SWITCH`.
- No session open (`session/current` = `SES-20261011-0085`, `SEALED`, summary acknowledged); 67 alerts,
  **none active**; audit chain `view.ok true`, `stored.ok true`, 1249 rows, `firstBadSeq null`; next
  session `SES-20261011-0086` (or the next day's number), next item `-0057`.

**Lane 1 (disposable, reset at 22:28):**
- The seed only: **13 demo items** `EV-20261009-0001` .. `EV-20261011-0013` (v1 shape; tampered
  `EV-20261010-0005`; one `UNDER_REVIEW`, one `EXPORTED`, one `RECORDED`), no alert, demo scenario
  `idle` with no active fault, scenarios `idle / recording / finalizing / fault-demo`.
- No session open (`{"session":null}`); audit chain ok, 91 rows; on top of the seed: one supervisor
  sign-in / sign-out, two pairing codes, one pairing, one verify run.

### Lane 2 - confirmed after the start (before the smoke)

| Check | Result |
|---|---|
| Active alerts | **none.** 66 alerts, every one `active false` |
| Selector | `VIDEO-01 = CAM-01` **`H264_720P30`**, `VIDEO-02 = CAM-02` **`H264_720P30`**, `MIC-01` PRIMARY, `MIC-02` STANDBY, `locked false`, `updatedAt 1791711869631`; **no line names `CAM-03` / `MIC-03`**; nothing had to be put back. Unchanged by the smoke |
| Session open | none: `SES-20261011-0084`, `SEALED` (the last sealed one) |
| Rigs (read only, before the start, after it and at the end) | `seal-rig 2 status` = **OFF**; `source-rig 2 status` = **OFF**; never switched |
| Evidence | **51 items** (two list pages: 50 + 1): `SEALED` 39, `EXPORTED` 10, `UNDER_REVIEW` 1, `RECORDED` 1; tampered: `EV-20261009-0005` only. EXPORTED: `EV-20261009-0004`, `EV-20261010-0014`, `-0015`, `-0016`, `-0020`, `-0022`, `EV-20261011-0029`, `-0032`, `-0033`, `-0043`; `interrupted true`: `EV-20261010-0017`, `-0018`, `EV-20261011-0027`, `-0031`, `-0041`, `-0042`, `-0049` |
| Audit chain | `view.ok true` (1000 checked), `stored.ok true`, **1242 rows**, `firstBadSeq null` |
| Quarantine `.data/media/dems_lane_2/sessions/.quarantine/` | 4 folders, all `drwx------` (48,300 / 52,252 / 47,796 / 52,236 KiB by `du`); names and sizes only, nothing opened |
| Capture devices | `CAM-01`, `CAM-02`; `CAM-03` (LOCAL_DEVICE, in no selector); `CAM-04` (`127.0.0.1:64850`), `CAM-05` (`:50651`), **`CAM-06`** (`:56570`, new against note 10) - all three point at DEAD ports, on no track: do not assign them; `MIC-01`, `MIC-02`; `MIC-03` (LOCAL_DEVICE, in no selector); `POE-SWITCH`. A search shows the stub as a NEW candidate on device port 53237; an adoption gives the next free id |
| Pairing | `DEV-0001` `PAIRED` online; `DEV-0002` `PAIRED` offline |

### Lane 1 - confirmed

Seed present (13 items), `session/current` null, `demo/status` answers 200 (demo controls on:
scenario `idle`, `activeFaults []`), alerts `[]`, audit chain ok (90 rows before the verify).

## 4. Smoke through the API (one run each)

| | Check | Result |
|---|---|---|
| Lane 2 | ONE session on the FAKE sources (the script refuses any selector other than `CAM-01, CAM-02, MIC-01, MIC-02`) | **SEALED.** Session **`SES-20261011-0085`**, item **`EV-20261011-0056`**, case `LP/2026/1011-9801`, subject "Judging Environment Smoke", investigator `OPR-002`. Create 201 -> pre-check 202, outcome PASS -> start 200 -> `RECORDING` 22:31:54.493, `captureDurable true` -> stop 202 (body with a reason) -> `SEALED`. `stoppedAt` 22:32:41.685, `sealedAt` 22:32:49.208: recording 47.2 s, seal 7.5 s (CLOSE_TRACKS 181 ms, FINALIZE_HASHES 85, FINALIZE_TRANSCRIPT 7101) |
| Lane 2 | verify (op 41) | **`overall PASS`, 15 of 15**; `manifestOk`, `signatureOk` true |
| Lane 2 | op 40 `files[].profile` | `H264_720P30` on `VIDEO-01` and `VIDEO-02`; `interrupted false` |
| Lane 2 | alerts / log | one new alert `ALR-000124` (INFO, `MIC_RATE_AT_LIMIT`, inactive); Core log: 0 error; warn `CAPTURE_FIRST_VIDEO_HELD` `CAM-01`, `CAM-02`, `CAPTURE_MIC_RATE_AT_LIMIT` `MIC-01`, one `transcriber.runner.clamp` (chunk 1, clamped 1, dropped 0) |
| Lane 2 | summary acknowledged | 204 |
| Lane 1 | supervisor sign-in (helper), op 41 on the clean demo item `EV-20261009-0001` | 200: **`ok true`, `manifestOk true`, `signatureOk true`**, tracks `VIDEO-01`, `VIDEO-02`, `AUDIO-01`, `AUDIO-02` all `ok true` (the v1 answer of a SIMULATED lane: no `overall` / n-of-n member) |

Both helper sessions were signed out (204, then 401) and both jars removed (no `*.jar` is left in
`.cache/gate-env/`). Both rigs read OFF after the smoke. Answers: `.cache/gate-env/judging/`
(`smoke_session.log`, `verify_EV-20261011-0056.json`, `op40_*.json`, `sealing.json`, `*_before.json`,
`*_after.json`, `l1_*.json`).

## 5. Signing in

**Seeded operators, the same three on both lanes** (role and operator id only):

| Role | Operator id |
|---|---|
| `INVESTIGATOR` | `OPR-001` |
| `SUPERVISOR` | `OPR-002` |
| `TECHNICIAN` | `OPR-003` |

The published demo sign-in is in `README.md`, Quick start, "Demo credentials" (and in the "Demo
operators" disclosure of each Login screen, unless Presentation mode hides it). It is not repeated here.

**On a device, safely:** `.cache/gates/89c/login.sh <serial> <ROLE>` (outside the sandbox; e.g.
`login.sh emulator-5556 INVESTIGATOR`). It checks that both Login fields are found, are of the right
kind and are EMPTY before it types, never prints a field's content, and takes the seed values by name
from the shared dataset. Close the dev toast first; after the sign-in answer **"Enable biometric
sign-in?" with "Not now"** (never the fingerprint button, never `adb emu finger`).

**API session without typing:** `npx tsx .cache/gate-env/gate-session.mts <1|2> <ROLE>` -> jar
`.cache/gate-env/session_lane<N>_<ROLE>.jar` (0600); send it with `-H "origin: http://127.0.0.1:517N"`
(lane 1 = 5176, lane 2 = 5177); `api.sh <lane> <METHOD> <path> [json]` in
`.cache/gate-env/wave-m/` uses the supervisor jar. It expires 15 minutes after its last POST. End with
`POST auth/sign-out` `{}` (204) and remove the jar. The web console's security-key button signs the
Supervisor in (README).

## 6. The two rigs (lane 2 only, both OFF) and the session slot

**Seal rig** (`delegation_progress/contract_wave_k.md` heading S1, item 2). From the repository root,
outside the sandbox:

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

**Source rig** (`delegation_progress/contract_wave_m.md` section "M-S 1"; effective on the running
lane, no restart):

```
scripts/lane/lane.sh source-rig 2 unreachable <deviceId>   # e.g. CAM-05 or MIC-02; a second call ADDS a device
scripts/lane/lane.sh source-rig 2 release                  # OFF: every rigged source answers again
scripts/lane/lane.sh source-rig 2 status
```

Only a stored `FAKE` CAMERA or MICROPHONE counts; `CAM-03` / `MIC-03` or a production device is never
touched (warn `LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE`). It does not end a source that is already open.
Always end with `release` and read `status`.

**Session slot:** lane 2 has ONE session slot; take it only while `session/current` is not open. The
tablet and the lane 2 web console see the same session. The slot and both rigs are free now.

## 7. Tooling notes (notes 09 section 7 and 10 section 6, in short)

- `uiautomator dump` hangs on Session Live / Home while a recording runs: screenshot there, dump after
  the stop. Tablet rows below y 1500 need a scroll before a tap.
- The dev toast lies over the footer (phone: its X at about x 996, y 2231); it returns after a reload.
- The pairing code field is not an EditText: tap it, then type the digits one by one with key events
  (`input text` lost five of six digits here).
- To cut a device's link: `adb -s <dev> reconnect`, then restore BOTH of ITS reverse rules and read them
  back - **phone `tcp:4420 tcp:4421`, tablet `tcp:4420 tcp:4422`**; never change `tcp:4420` under a
  running app (the app would delete its credential).
- Media volume: by volume-key events, read back 0 before any playback, put back as found. Nothing is
  played aloud.
- A stop without a reason is refused (422): body `{"reason":"<5 characters or more>"}`. Op 37:
  `POST session/{id}/summary/acknowledge` (204).
- Unlock (after a reboot only): `script -q /dev/null apps/mobile/scripts/emulator-user-lock.sh unlock
  <phone|tablet> </dev/null`; no lock / PIN / fingerprint change. No Gradle build. Never pipe
  `lane.sh start`. Never ports 5173-5175, 8000, 5432. Never `.data/pg*.env`. Do not wrap flows in
  `device-session.sh`.
- Keep the stub's fixture account, every pairing code, password and token out of notes and reports.

## 8. Putting the phone back on lane 2 (a NEW pairing again)

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet
adb -s emulator-5554 reverse tcp:4420 tcp:4422
adb -s emulator-5554 shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=LIVE&motion=off" com.dems.demo.tablet'
# -> Pair screen. Issue a code on lane 2: web console http://127.0.0.1:5177/ as the Supervisor,
#    Paired Devices (/admin/devices) -> Pair a device; or, with the helper's lane 2 supervisor jar:
#    python3 .cache/gate-env/judging/pair_phone.py 2 emulator-5554 <x> <y>   (x y = the centre of the code field,
#    read from a uiautomator dump: node "Pairing code, 6 digits"; it never prints the code), then tap "Pair".
```

The phone becomes the next free id of `dems_lane_2` (`DEV-0003`; read it from `GET pairing/devices`);
lane 2's old `DEV-0002` row and lane 1's `DEV-0002` row then stay offline.

## 9. STOP procedure

```
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5554 reverse --remove-all
adb -s emulator-5556 shell am force-stop com.dems.demo.tablet ; adb -s emulator-5556 reverse --remove-all
kill -TERM $(lsof -nP -t -iTCP:8081 -sTCP:LISTEN)      # Metro (96578)
kill -TERM $(lsof -nP -t -iTCP:5176 -sTCP:LISTEN)      # web lane 1 (96553)
kill -TERM $(lsof -nP -t -iTCP:5177 -sTCP:LISTEN)      # web lane 2 (96554)
scripts/lane/lane.sh seal-rig 2 status                 # must say OFF before the stop; else: seal-rig 2 release
scripts/lane/lane.sh source-rig 2 status               # same; else: source-rig 2 release
scripts/lane/lane.sh stop 1 ; scripts/lane/lane.sh stop 2 ; scripts/lane/lane.sh status
```

Outside the sandbox. Stopping lane 2 stops the stub and removes its fixture file; its data stays. **NO
reset of lane 2 afterwards.** After `reverse --remove-all` each device keeps its credential: before the
next launch restore `tcp:8081 -> 8081` on both and **`tcp:4420 -> 4421` on the phone, `tcp:4420 ->
4422` on the tablet** (a wrong lane port makes the app delete its pairing). Restart forms: section 1 and
note 05 section 6. PostgreSQL (PID 32505, `127.0.0.1:4432`) stays up. Emulators: the controller's or the
user's call.

## 10. Not proven / limits

- No flow on a device or in a browser beyond the phone's pairing: the sessions were driven through the
  API; the devices were relaunched on the new bundle and read at Login; nobody signed in on a device, no
  web page was opened beyond `/` (200).
- Neither rig was switched (read only).
- Lane 1's verify answer has the v1 shape (`ok`, `manifestOk`, `signatureOk`, per-track `ok`), not the
  n-of-n report of lane 2.
- Lane 2's evidence count after the smoke (52) is 51 read + the one new item, not a second list read.
- One digit of the unused first pairing code of lane 1 (`PCD-000003`, expired) appeared in my own tool
  output through a uiautomator content description; it is in no file and in no report.
- Host load (1-minute) 3.75 at the start, 2.07 at the smoke's start, 2.94 at the end.

---
*Generated: 2026-10-11 22:36 WIB*
