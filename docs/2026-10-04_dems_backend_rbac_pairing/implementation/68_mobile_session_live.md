---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W68 (blueprint step 90; prov. 87)
agent: coder-execution
date: 2026-10-06
status: needs-review
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W68, line 742)
---

# W68 — Mobile Session Monitor in LIVE mode (blueprint step 90)

**Row**: W68 (plan §8.4, line 742). Agent: coder-execution. **Time**: 2026-10-06 00:29–01:21 WIB.
**Status**: **needs-review**. The row's work is complete: every gate item below passes with its output
quoted. The status is not `complete` only because of finding **F-1**: a defect in the runtime (not in
this row's files) that this row found and documented but may not fix. In LIVE the defect can leave the
monitor's "Core link lost" banner showing after the link is back.

Settle sites S2-1 and S4-2 [CS:§8.6, §8.7]; the meters from the socket (I8, CL-11b, [CS:S4-9]); AC-C-48;
LB-1 to LB-10; F59 (the Core judges the stop reason). Gate: CLG (plan §11 line 647) on top of SG.
Citation convention as in `masterplan/02_plan.md` (about line 81). Code is cited as `path:line` from the
workspace root, line numbers of the finished files.

Assets: `implementation/assets/68_*` (9 screencaps, 4 logs, the lock status, 3 device scripts, 3 mutation
files plus their log, 4 banner-probe files; §16).

---

## 1. Result at a glance

| Item | Result |
|---|---|
| One way in | `useCoreActions()` + `settle` in the one wrapper `useMonitorActions` (`use-monitor.ts:179-243`); no `useSimActions` and no `.actions` read on a `Sim` in the folder (CLG (c): grep exit 1) |
| S2-1 Snapshot | The tile is busy from the press (LB-1). In LIVE the shutter flashes at the press if the Core has not answered yet (LB-4). The flight, the counter pop and the toast run in `ok`. A refusal gets the presenter's toast and nothing else |
| S2-1 Marker + S4-2 | The Add button is busy. In `ok` the screen reads the timeline's newest node, which is the Core's marker by then (CL-16). The toast shows the Core's time, then the flight runs and the field closes. On a refusal the field stays open with the label |
| S2-1 End Session | The Dialog's confirm is busy, with the Spinner and "Ending…" after 420 ms. While the stop is out, "Keep recording" is disabled and the overlay and Back are held (D166). A 202 closes the Dialog and route-sync follows to `/session/finalizing`. A 422 `INVALID_REASON` shows the reason field's error with no toast (F59). A 403, an outage, a 429 or a 409 leave the Dialog open with the reason |
| Camera, CLIP reset | One command per control at a time. Results are ignored, as before [CS:S2-1]. A refusal is still worded |
| Meters (I8) | The meters need no code: socket `meters` frames → the store's `audio` slice (Live source) → Reanimated shared values (`useAudioSharedValues`) → drawn on the UI thread. In jest: both meters follow two frames, no request is sent, and 20 frames cause no React render. On the phone: the meters moved between two screencaps 3 s apart, and the request lists show no meter request |
| Core link (LIVE) | Read-only follows the runtime's one rule, `useCoreLinkNotice()` (rows M0/M1): no flicker on a reconnect attempt, and a down link turns the meters to NO SIGNAL. SIMULATED and HEARTBEAT keep the step-79 rule exactly |
| StrictMode (D158, F69-1) | Nothing starts on mount. Under `<StrictMode>`: 0 monitor requests on mount, and one press sends one request (snapshot, marker) |
| Simulated mode | Unchanged. The folder's 5 existing test files are byte-equal to `acaff20` and green. A Simulated control test pins the snapshot split |
| New tests | 2 suites / **29 tests** plus one test bed (§5) |
| Mutation check (M15, in memory) | **25 of 25 detected**. The mutated files are byte-identical before and after (§7) |
| Device check (lane 1, phone, ONE sitting, 3 min 13 s) | LIVE sign-in 200 → create 201 → pre-check 202 (8/8 PASS) → start 200 → hand-off into this monitor (SES-20261006-0028 RECORDING) → meters move → snapshot 204 → End Session by a tap with a typed reason → stop 202 → SEALED → relaunch SIMULATED (0 Core requests). Lock status identical before and after; ports free |
| SG | `@dems/mobile` **128 suites / 1,580 tests exit 0**; typecheck exit 0; lint exit 0, 517 files / 0 errors / 0 warnings |
| `CONTRACT-GAP` | None (§9) |

## 2. Sources read

`masterplan/02_plan.md`: row W68 (line 742), the citation convention (line 81), §11 SG/CLG (lines
645-647). `masterplan/04_client_integration_spec.md`: §2.2-§2.5 (CL-11b, CL-16 to CL-26), §3.5, §8.1
(LB-1 to LB-10), §8.6 S2-1, §8.7 S4-2 and S4-9, AC-C-48. `gateway_check/09_cp_mobile_runtime.md` §4
answer 3 (the ten rules). `gateway_check/09b_m1_mobile_consolidation.md` §8. `implementation/51_mobile_runtime.md`
§4, `67_mobile_session_new.md` (the hand-off, F-4, the device driver), `65_web_session_monitor.md` (the
web twin), and `34_module_sessions.md` §18 (precedence 404 → 409 → 422 `INVALID_REASON`, D94).
Decisions D94, D158 (F69-1), D164 (DN-7), D166 (controller note during the run) and F59.

Code read:
- the 19 files of `apps/mobile/src/features/session-live/`
- `apps/mobile/src/runtime/{index,use-pending-press,pending-control,use-core-link-notice,link-notice,connection-banner,core-errors,use-audio-shared-values,sim-runtime-provider}.ts(x)`
- `packages/shared/src/live/{settle,core-actions}.ts`, `live/source/{bindings,rebuild-error,neutral-state}.ts`, the meters path of `live/source/live-sim.ts:902-915`
- the fake transport (`live/testing/{socket,http,fake-transport}.ts`)
- the contract entries of operations 26, 34, 36, 51 and 52

## 3. What was built

All paths are under `apps/mobile/src/features/session-live/`.

### 3.1 The sites

| Site | Where | What and why |
|---|---|---|
| S2-1 wrapper | `use-monitor.ts:179-243` | `run(name, work, context, guarded, handlers)`. The read-only refusal stays first (`:216-225`, [CS:S2-1]); then `settle(work, { ok, fail, done })` (`:227-234`). `MonitorHandlers` (`:149-157`): exactly one of `ok` / `refused(why)` runs, then `done` (it releases the pending press). `explain` (`:188-213`): in LIVE, a 422 that comes back as `SimTransitionError(REASON_TOO_SHORT)` (CL-20) returns `'reason'` with no toast (`:193`); in LIVE, `presentCoreError(error)` comes first (`:199`, rule 2); otherwise the step-79 toasts. Every failure goes to the persistent runtime log (§14) |
| S2-1 Snapshot | `session-live-screen.tsx:173-191`; tile `action-tiles.tsx:68-85, 136-146` | `ok` raises `shutterSignal` (unless it was already raised), raises `snapshotSignal` and shows the toast. When the press returned before the settle (LIVE), the shutter is raised at the press (`:187-191`, LB-4). `live-feed.tsx:94-123` splits M-C-18 into the flash (`shutterSignal`) and the flight plus pop (`snapshotSignal`). In SIMULATED both rise in one handler, so the three still play together |
| S2-1 Marker, S4-2 | `session-live-screen.tsx:197-225`; `action-tiles.tsx:165-183` | The timeline read, the toast and the flight move into `ok`; `added()` then clears and closes the field. The submit (button or keyboard "done") goes through one `usePendingPress` |
| S2-1 End Session | `session-live-screen.tsx:227-229`; `end-session.tsx:184-266` | `onEnd(reason, handlers)`. The Dialog sends through `press.run` (`:207-222`): `ok` clears and closes, `refused('reason')` stores the refused text (`refusedByCore`, `:194`, cleared by editing), `done` releases. `dismiss` (`:203-205`) ignores a close while busy. "Keep recording" is disabled while busy (`:257`, D166). The confirm takes `busyState(press.busy, !check.valid)` and shows `PendingSpinner` plus "Ending…" while pending (`:259-264`) |
| Camera | `session-live-screen.tsx:138, 234-236`; `live-feed.tsx:175` | One `cameraPress` for the three camera controls (feed tap, tablet tabs, settings sheet). The feed's tap target carries `busyState(cameraBusy)` |
| CLIP reset | `mic-card.tsx:55, 66-69`; `monitor-sheets.tsx:100` | One `clipPress` per meter. The chip itself is drawn by `components/composed/dbfs-meter.tsx`, which is not this row's file (F-5) |
| Read-only (LIVE) | `use-monitor.ts:129-135` | `if (link.source === 'LIVE') return offline;` from `useCoreLinkNotice()`. SIMULATED and HEARTBEAT keep `banner.kind === 'offline' \|\| link.state === 'OFFLINE'` |
| Meters | no code change (`mic-card.tsx` header; `use-monitor.ts` header) | `useAudioSharedValues` (runtime) already reads the store's `audio` slice, which the Live source writes from socket `meters` frames (`packages/shared/src/live/source/live-sim.ts:902-906`) and resets to silent frames on STALE or OFFLINE (`:908-913`). Nothing on the screen polls |

### 3.2 What the screen does NOT do (by design)

- Nothing starts on mount, so React StrictMode sends nothing twice (D158 F69-1).
- No `setTimeout` was added. The pending reveal is the runtime hook's own selector on the store's clock (rule 7).
- No copy of `usePendingPress`, `busyState` or `PendingSpinner`: all three come from `@/runtime` (D166).
- No new user-facing text. "Ending…" (`i18n.ts:86`) existed already. No text says "simulated" (rule 8; the copy check of §6.5).

## 4. The ten mobile rules (CP-M1 §4 answer 3)

| # | Rule | How it holds here |
|---|---|---|
| 1 | One way in | `useCoreActions()` + `settle` only; no `useMobileLive()` was needed (every operation of the screen has a simulator action). The four static scans pass (§6.5) |
| 2 | Presenter first; reset in `beforeEach` | Every `fail` in LIVE calls `presentCoreError` before the site's branch (`use-monitor.ts:199`); the bed's `resetLiveMonitorBed()` calls `resetCoreErrorPresenterForTests()`. A 429 is a limit (tested), never a link state |
| 3 | No Core address, no network API | None in the folder. On the phone every request went through the app's typed client (`[DEMS-LIVE]` lines) |
| 4 | No credential | The folder imports no secure-store module. The stop reason is logged by its length only (`reasonLength`) |
| 5 | One LIVE idiom | `useCoreLink().source === 'LIVE'` (`use-monitor.ts:133, 181`); the mode is never re-derived |
| 6 | React Compiler | No ref plus effect for state. The two existing `useRef` + `useEffect` pairs in `live-feed.tsx` drive animations, as before. Lint: 0 errors, 0 warnings |
| 7 | Store clock, no new `setTimeout` | Yes (§3.2) |
| 8 | Truthful copy, no `SIM-GAP` | No new text and no marker. KI-07: 13 IDs / 62 markers, as at `acaff20` (§6.5) |
| 9 | Do-not-touch list | Only `features/session-live/**` was written. The folder's 5 existing test files and `heartbeat-release-gate.test.tsx` are unchanged (§6.1) |
| 10 | Ledger and device | §6, §8 |

## 5. Tests

`testing/live-monitor-bed.tsx` (test-only, 420 lines, modelled on W67's bed):
- The app's real Live source (`createMobileLive`) over the contract-checked fake transport.
- It is mounted by the real `AppProviders` around the **real** `/session/live` route file.
- The device is paired, and the investigator signs in through the Live source.
- The Core's engine is a real simulator holding the recording scenario. Each monitor command (operations 26, 34, 36, 51, 52) runs the same action on the engine, and the changed slices travel back as one delta with the answered revision: `delta-first`, or `answer-first` with the delta held until the test sends it.
- `sendMeters` puts one `meters` frame on the signed-in socket.
- Options: `answerDelayMs` (AC-C-57), `strict` (StrictMode), `onRender` (Profiler), and `setReachable(…, { drop: false })`, which makes the NEXT connect hang without losing the open socket.

| File | Tests | What it proves |
|---|--:|---|
| `live-session-live-sites.test.tsx` | 15 | **Snapshot**: success in `answer-first` order (the flash at the press; the flight, counter and toast only after the delta; a second press sends nothing); pending (busy at once, no Spinner at 300 ms, the Spinner at 500 ms in place of the icon); 403 `notPermitted` → the denied toast "Not permitted / Requires the Investigator role"; an outage. **Marker / S4-2**: success with the label in `answer-first` order (no toast and the field open until the delta; then the toast with the Core marker's time, and the field closes); 403 `notPermitted`; an outage. **End Session**: success with the trimmed reason → `/session/finalizing`; 403 `notPermitted`; an outage; 422 `INVALID_REASON` → the field's error, no toast, cleared by editing; 409 → the step-79 warning; 429 → the limit toast, no offline wording, no banner; pending with a 1 s answer (two presses → one request, no Spinner at 300 ms, Spinner and "Ending…" at 500 ms, "Keep recording" disabled and the Dialog held); a 50 ms answer shows no Spinner at any 10 ms step |
| `live-session-live-link.test.tsx` | 14 | **Meters (I8)**: the client subscribed (`{type:'subscribe',topic:'meters'}`); two frames move both meters' shared values, each from its own channel; 0 requests; the accessible value follows within 1 s. 20 frames cause ≤ 2 React commits. **Link**: lost → the banner, read-only actions, meters at the floor and "NO SIGNAL", nothing sent, the replica still RECORDING; back → "Resynced", actions return, a snapshot goes through; a CL-11a reconnect with no outage before it is a transient (no banner, actions usable, a press gets the Core's offline answer and no read-only toast); a reconnect hanging in CONNECTING after an outage keeps read-only. **StrictMode**: 0 monitor requests on mount; one press is one request (snapshot, marker). **Timer**: counts from the Core's start on the Live clock. **Camera**: one request; the feed follows the Core; two quick taps are one request and the tap target is busy; outage; 403 `originNotAllowed`. **CLIP**: the latch from the Core; reset after an outage; two quick taps are one reset. **Simulated control**: the snapshot raises both signals in the press, nothing is ever busy, the stop closes at once |

Every 403 of an operation that has a `notPermitted` example is named by it (`fake.example(op, 403, 'notPermitted')`):
stopSession, addSessionMarker, takeSessionSnapshot. Operations 51 and 52 have none (F-2).

## 6. Verification

Commands were run from the workspace root via `--prefix`, never `cd`. `uptime` was read before the whole suite (3.71).
Raw output: `assets/68_final_gate.log`.

### 6.1 CLG (a): the folder's existing tests pass and are not in the diff

```
## CLG (a): the folder's existing test files at acaff20
apps/mobile/src/features/session-live/back-guard.test.tsx
apps/mobile/src/features/session-live/session-live-screen.test.tsx
apps/mobile/src/features/session-live/session-live.math.test.ts
apps/mobile/src/features/session-live/testing/monitor-harness.tsx
apps/mobile/src/features/session-live/testing/monitor-test-setup.ts
$ git diff --stat acaff20 -- <those 5 files>
(end: 0 lines)
$ git diff --stat acaff20 -- apps/mobile/src/features/session-live
 .../src/features/session-live/action-tiles.tsx     |  68 +++++++---
 .../src/features/session-live/end-session.tsx      |  67 +++++++---
 .../mobile/src/features/session-live/live-feed.tsx |  30 ++++-
 apps/mobile/src/features/session-live/mic-card.tsx |  19 ++-
 .../src/features/session-live/monitor-sheets.tsx   |   2 +-
 .../features/session-live/session-live-screen.tsx  | 110 ++++++++++-----
 .../src/features/session-live/use-monitor.ts       | 147 ++++++++++++++++-----
 7 files changed, 336 insertions(+), 107 deletions(-)
## heartbeat-release-gate.test.tsx vs b90a3c6:
       0
```

The folder run at 01:00 had 5 suites and 74 tests. After the four tests added for the mutation run, the
whole run counts 78 tests in the folder: `PASS …/back-guard.test.tsx`, `PASS …/session-live.math.test.ts`,
`PASS …/session-live-screen.test.tsx` (49 existing tests), `PASS …/live-session-live-sites.test.tsx`,
`PASS …/live-session-live-link.test.tsx`.

### 6.2 CLG (b): one Live test per named site (success, refusal with the denied toast, outage), plus the meters

| Site | Success | Refusal (403 `notPermitted`, denied toast) | Outage |
|---|---|---|---|
| S2-1 Snapshot | sites "success: one request; the flash at the press …" | sites "refusal: 403 (example notPermitted) → the denied toast naming the role …" | sites "outage: …" |
| S2-1 Marker | sites "success: one request with the label …" | sites "refusal: 403 (example notPermitted) → the denied toast …" | sites "outage: …" |
| S2-1 End Session | sites "success: one stop with the trimmed reason …" | sites "refusal: 403 (example notPermitted) …" (also 422, 409, 429) | sites "outage: …" |
| S4-2 | sites Marker success: the toast's time equals the Core marker's `at`, read after the delta | the Marker refusal: no marker toast | the Marker outage: no marker toast |
| Camera, CLIP (results ignored) | link "camera: one request …", "CLIP reset: …" | link "camera: the 403 the contract documents for it (originNotAllowed …)" (F-2) | inside the same two tests |
| Meters | link "meters frames move both card meters … no request is sent …" | — | link "link lost: … meters at NO SIGNAL …" |

```
$ npm run test -w @dems/mobile -- --maxWorkers=2 src/features/session-live/live-session-live-sites src/features/session-live/session-live-screen   (01:00, after D166)
PASS src/features/session-live/live-session-live-sites.test.tsx (10.378 s)
PASS src/features/session-live/session-live-screen.test.tsx (11.401 s)
Tests:       36 passed, 36 total
$ … src/features/session-live/live-session-live-link   (after the last test was added)
PASS src/features/session-live/live-session-live-link.test.tsx (6.402 s)
Tests:       14 passed, 14 total
```

### 6.3 CLG (c): no `useSimActions`, no `.actions` on a `Sim` in the folder's production files

```
$ grep -rnE "useSimActions|\.actions\b" apps/mobile/src/features/session-live --include='*.ts' --include='*.tsx' | grep -vE "\.test\.|/testing/" | grep -vE "t\('session\.actions\.|BEAT\.actions|styles\.actions"
(exit of the last grep: 1; 1 = nothing found)
## useSimActions anywhere in the folder (tests included):
       0
```

The excluded texts are translation keys, the motion constant `BEAT.actions` and the StyleSheet key
`styles.actions`. None of them is a `Sim`; the last two were already there at `acaff20`.

### 6.4 SG, and the ledger

```
## 2026-10-06 01:16:53 WIB  1:16  2 users, load averages: 3.71 5.43 5.83
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 128 passed, 128 total
Tests:       1580 passed, 1580 total
Time:        78.387 s, estimated 111 s
exit=0
## 01:18:20 $ npm run typecheck -w @dems/mobile
> tsc --noEmit
exit=0
## 01:18:24 $ npm run lint -w @dems/mobile
> eslint .
exit=0
## 01:18:44 $ eslint . --format json (counts)
517 files 0 errors 0 warnings
```

**Ledger (L-1).** The floor in the brief was 114 suites / 1,431 tests (00:28). This row adds **2 suites /
29 tests** (`live-session-live-sites.test.tsx` 15, `live-session-live-link.test.tsx` 14) and changes no
existing test. The other 12 suites and 120 tests of the 128 / 1,580 belong to the rows running in
parallel. No red file of another row was seen in the final run.

### 6.5 The static scans, the copy check, KI-07

```
$ npm run test -w @dems/mobile -- --maxWorkers=2 src/runtime/live-no-raw-fetch.test.tsx src/runtime/link-notice-static.test.ts src/auth/live-auth-static.test.ts src/features/pairing/pairing-live-static.test.ts src/features/login/login-live-model.test.ts src/runtime/secure-store-import.test.ts
Test Suites: 6 passed, 6 total
Tests:       49 passed, 49 total
-- 'simulat' in the folder's production code: 4 lines, all code comments (session-live.math.ts:85, :228, :268; use-monitor.ts:76); 0 in shared session.ts
acaff20: 13 IDs / 62 markers      now: 13 IDs / 62 markers      in session-live: 0
```

(An earlier reading at 01:00 showed 65 markers. The extra three were in a test file of another row that
was being written at that minute (`session-summary/summary-live-static.test.ts`, W72), and they were
gone at 01:19.)

## 7. Mutation check (rule M15: nothing in the tree was modified)

**Method.** W67's copy of M0's method. A jest transformer outside the tree (`.cache/w68/mut/`, copied to
`assets/68_mutating_transformer.cjs.txt`, `68_jest_mut_config.cjs.txt`, `68_mutate.py.txt`) applies one
mutant's edits **in memory** to one production file. Each run executes the folder's five test files;
detected means jest exit ≠ 0. The SHA-256 of the six mutated files was compared before and after each
batch. Full output: `assets/68_mutations.log`.

```
# W68 mutation check, 2026-10-06 01:01:46; 5 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       78 passed, 78 total (33 s)
## 6 detected, 0 not detected, 0 not applied, of 6         (U1-U6, 01:01:46)
## 10 detected, 0 not detected, 0 not applied, of 10       (S1-S6, T1-T4, 01:04:02)
## 9 detected, 0 not detected, 0 not applied, of 9         (E1-E7, F1, M1, 01:08:28)
## the mutated files in the tree, before and after: identical      (every batch)
   6284eb88da69f56a  src/features/session-live/action-tiles.tsx
   e299a18f61f11ab5  src/features/session-live/end-session.tsx
   7d1ae5bc41d403fb  src/features/session-live/live-feed.tsx
   d3b44fc82cb94979  src/features/session-live/mic-card.tsx
   ab117051a21633dd  src/features/session-live/session-live-screen.tsx
   cf3dbc9876ea769f  src/features/session-live/use-monitor.ts
```

| Class | Mutants | Detected |
|---|---|--:|
| **The wrapper** | U1 LIVE skips the presenter; U2 the 422 is no field error; U3 LIVE keeps the step-79 read-only rule; U4 `ok` never runs; U5 `done` dropped; U6 a refusal not told to the control | 6 / 6 |
| **The screen** | S1 no flash at the press; S2 a double flash in LIVE; S3 the snapshot toast at the press; S4 the marker field closes at the press; S5 End Session's outcome not handed on; S6 no camera guard | 6 / 6 |
| **The tiles** | T1 no Snapshot guard; T2 no busy mark; T3 no Spinner; T4 the field closes whatever the Core says | 4 / 4 |
| **The Dialog** | E1 Keep closes while out; E2 no confirm guard; E3 closes on any refusal; E4 the 422 lost; E5 no Spinner; E6 no busy mark; E7 an edited reason keeps the refusal | 7 / 7 |
| **Feed, mic** | F1 the camera tap target never busy; M1 no CLIP guard | 2 / 2 |
| **Total** | | **25 / 25** |

Four of the tests were written after a first look at what a mutant would need: the Snapshot pending
test, the camera double tap, the CLIP double tap, and the CL-11a reconnect for U3. A server close with
1001 does not separate U3, because the heartbeat goes OFFLINE. Not mutated (no test claims them): the
log levels and the marker flight's geometry.

## 8. The device check (lane 1, `dems2_phone` / emulator-5554; CLG (d))

This was ONE run inside `/usr/bin/lockf -k -t 600 .locks/core-server.lane1.lock` (`lockf exit=0`):
- the lane backend on 4421 (`dems_lane_1`, `demoControls:false`), started and stopped by the script;
- the device commands inside `METRO_PORT=8083 DEMS_CORE_HOST_PORT=4421 apps/mobile/scripts/device-session.sh phone '…'`, with a hard cap of 600 s;
- the phone lock held from 01:12:44 to 01:15:57 (3 min 13 s).

**No lane reset**: the phone stays paired as DEV-0001. Scripts: `assets/68_run_w68.sh.txt`,
`68_device_w68.sh.txt`, and `68_drive_q.mts.txt` (W67's queue driver; I wrote each step after reading the
previous screencap). Every command and its result is in `68_device_driver_steps.log`. `uiautomator` was
not used on any screen.

**Lock status (read-only `emulator-user-lock.sh status`), `assets/68_lock_status.txt`:**

```
## before (01:11:00)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
## after (01:16:14)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
```

(`dems2_phone2` was read by the same status command and shows the same before and after; it was
otherwise not addressed.) `device-session.sh` reported "screen awake, no keyguard" and never exited 77.
No PIN was typed, no fingerprint was touched, no keyguard or system prompt was answered, and no lock or
setting was changed.

| Step | Evidence | Screencap |
|---|---|---|
| Launch `demsdemo:///login?core=LIVE&motion=off` (D164 DN-7) | `runtime.live.ready` after 1 s; `GET /api/v1/pairing/device 200` | — |
| Username into the username field; the cursor then in the password field | IME `0x80001`, then `0x80081` (text + password variation) | — |
| The demo password, typed only after the IME confirmed a password field; keypad go | `POST /api/v1/auth/sign-in 200` | — |
| The app's biometric offer | declined with the app's own "Not now" (in-memory); nothing enrolled | `68_phone_home_live.png` ("Core Live") |
| Start Session (`/session/new?step=1`): scan, TERSANGKA, a demo name | `LP/2026/1006-0012` from the replica | `68_phone_step1_filled_live.png` |
| Next | `POST /api/v1/session 201`, `POST /api/v1/session/{id}/precheck 202`; "All checks passed", 8 of 8, Core Machine ONLINE | — |
| Ready, Start Recording | `POST /api/v1/session/{id}/start 200` | `68_phone_step3_ready_live.png` |
| **The hand-off into this row's monitor** | "Active Session SES-20261006-0028", Recording 00:00:03; 0 "already active" lines | `68_phone_monitor_meters_a_live.png` |
| **The meters from the socket** | 3 s later: MIC 1 −18 → −19 dBFS, MIC 2 −53 → −51 dBFS, bars and peak markers moved, timer 00:00:06; no meter request in either request list below | `68_phone_monitor_meters_b_live.png` |
| S2-1 Snapshot (tile tap) | `POST /api/v1/session/{id}/snapshots 204`; the History badge 2 → 3 | `68_phone_snapshot_live.png` |
| End Session: ONE tap opens the reason Dialog under the motion switch (F-4 of W67); reason "W68 device check end" typed into the app's field | IME `0x24001` (text, multi-line) | `68_phone_end_dialog_live.png` |
| The Dialog's End Session | `POST /api/v1/session/{id}/stop 202`; route-sync to the Summary: **SEALED** SES-20261006-0028, LP/2026/1006-0012, 01:14:18 → 01:15:07, 00:00:48, EV-20261006-0016 | `68_phone_after_stop_summary_live.png` |
| Leave as found (D124) | force-stop, `demsdemo:///?core=SIMULATED`: `runtime.sim.hydrated` after 3 s, **0** Core requests after, prefs `{"coreLinkSource":"SIMULATED"}`; the SIMULATED Login ("paired (simulated)") | `68_phone_after_simulated.png` |

```
-- Core request lines this session (method, path template, status):
      1 DEMS-LIVE] POST /api/v1/session/{id}/stop 202
      1 DEMS-LIVE] POST /api/v1/session/{id}/start 200
      1 DEMS-LIVE] POST /api/v1/session/{id}/snapshots 204
      1 DEMS-LIVE] POST /api/v1/session/{id}/precheck 202
      1 DEMS-LIVE] POST /api/v1/session 201
      1 DEMS-LIVE] POST /api/v1/auth/touch 200
      1 DEMS-LIVE] POST /api/v1/auth/sign-in 200
      1 DEMS-LIVE] GET /api/v1/pairing/device 200
      1 DEMS-LIVE] GET /api/v1/auth/status 200
      1 DEMS-LIVE] GET /api/v1/auth/session 401
-- live.misuse lines: 0; credential/token lines (must be 0): 0
-- 'session is already active' lines in the JS log: 0
== 01:15:57 3. backend request log during the session
      1 POST /api/v1/auth/sign-in 200 principal=device
      1 POST /api/v1/auth/touch 200 principal=operator
      1 POST /api/v1/session 201 principal=operator
      1 POST /api/v1/session/:id/precheck 202 principal=operator
      1 POST /api/v1/session/:id/snapshots 204 principal=operator
      1 POST /api/v1/session/:id/start 200 principal=operator
      1 POST /api/v1/session/:id/stop 202 principal=operator
-- bearer/cookie/credential lines in the server log this run (must be 0): 0
== 01:15:57 4. stop the backend and check nothing is left
-- shutdown complete lines: 1
lsof exit 1 (1 = none)
```

After the run (01:16:14, read-only):
- `adb -s emulator-5554 reverse --list` is empty;
- no listener on 4421, 8083 or 8081 (only PostgreSQL on 127.0.0.1:4432, untouched);
- `.locks/core-server.lane1.pid` is 0 bytes, and the app is not running.

Secret scan of every `68_*` text asset and the server log: 0 occurrences of the demo password (read from
the dataset constant and never printed) and 0 `dvc_` / `ses_` / `bio_` token shapes. Port 5432, the ports
5173-5175 and 4400, and lane 3 were not touched.

## 9. Contract gaps found

**None.** Every operation the screen sends in LIVE has a binding and a contract entry: `stopSession`,
`addSessionMarker`, `takeSessionSnapshot`, `setActiveCamera` and `resetMicClip`
(`packages/shared/src/live/source/bindings.ts:340-364, 424-428, 474-479`). The replica and the `meters`
topic carry everything the screen reads. No `SIM-GAP` and no `CONTRACT-GAP-W68-n` marker was added.

## 10. Findings

| # | Severity | Finding | Where / evidence | Owner / proposal |
|---|---|---|---|---|
| F-1 | **Medium** | **The runtime's connection banner can fall back to "offline" after "Resynced" while the Core link is ONLINE.** In jest, with the monitor mounted, an outage during which wall-clock time passes (so the meters' 1 Hz accessible-value interval fires) is followed by a return of the link: the runtime publishes `connectionBannerFor('resynced')`, then `connectionBannerFor('offline')`, with no `nextBannerKind` call between them, and stays there. Probe log: `nextBannerKind(offline, OFFLINE/CONNECTING)=offline → bannerKindAfterResync(offline)=offline → nextBannerKind(offline, ONLINE/LIVE)=resynced → for(resynced) → for(offline)`, and the debug handle still reports `coreLink ONLINE/LIVE, banner offline` after three more seconds of the fake clock. It does not happen without the wall-clock wait, nor on Start Session (W67's bed), nor with the meters' interval stubbed out. It still happens with this row's read-only rule replaced by the step-79 rule and with the pending hook stubbed, so it is not caused by this row's code. **Hypothesis, not proven:** the render-phase adjustment `setKind(nextBannerKind(kind, link))` in `useConnectionBannerState` is dropped when React later rebases a pending bus updater `setKind(bannerKindAfterResync)` that sits in another lane. **Effect in LIVE:** the banner "Core link lost — recording continues on the Core. Reconnecting…" can stay up after a reconnect. With the step-79 read-only rule (banner-based) the session actions would also have stayed read-only; with this row's rule (`useCoreLinkNotice`) they come back. **Not verified on a device** (it needs an outage on a lane) | `apps/mobile/src/runtime/sim-runtime-provider.tsx:517-532`; the 1 Hz interval `runtime/use-audio-shared-values.ts:99-106`; `assets/68_banner_probe_results.txt` and the three probe files | Runtime owner (an M-row slot): derive the banner kind in one place, for example keep `resyncedAt` in state and compute `offline` / `resynced` / `hidden` from the notice rule plus that time, with no updater racing a render-phase update. Add a test that keeps an unrelated state update pending across the reconnect. This row's link test proves "link back" without the wall-clock wait and says why (`live-session-live-link.test.tsx`, comment above "link back") |
| F-2 | Info | AC-C-48 cannot occur on the camera (operation 51) or the CLIP reset (52): both are AUTHENTICATED, and the contract has no `notPermitted` example for them. Their refusal case is the documented 403 `originNotAllowed` (presenter: "The Core refused this action"). Same as W65 F-1 | the contract probe, `.cache/w68/ex.mts` | Controller (CLG (b) wording for these two) |
| F-3 | Info | On the device the server log has no line for the client's `subscribe meters`. The evidence that the meters come from the socket is the moving meters plus no meter request in either request list; in jest, the recorded client message `{type:'subscribe',topic:'meters'}` | `assets/68_device_run.log` §3 | none (a realtime log line would make it visible) |
| F-4 | Low | Jest prints "did not exit one second after the run" / "a worker process has failed to exit gracefully" with the monitor suites. This was already present in the folder's existing suite before this row's tests (first run, 00:41); likely the meters' 1 Hz interval or the ambient loops | `.cache/w68/folder_run1.log` | Test-harness owner (W100 hygiene) |
| F-5 | Info | The CLIP chip is drawn by `components/composed/dbfs-meter.tsx`, which no mobile page row owns. It gets this row's one-at-a-time guard through `onClipReset`, but no busy mark or Spinner | `mic-card.tsx:66-69` | Controller (the web twin is W65 F-3) |
| F-6 | Info | CA-02 also holds into this screen: in the device run the store reached RECORDING and the stack replace landed with no "session busy" toast (0 "already active" lines) | §8 | Confirms W67 F-7 |

## 11. Deviations

| # | Deviation | Why / effect |
|---|---|---|
| DV-1 | Process slip: at 00:33 one read-only listing (`ls node_modules/.bin`) began with `cd` into the repo root | Nothing was written; no `cd` afterwards, not even inside the device scripts (`npm --prefix`, an absolute tsx loader) |
| DV-2 | The End Session Dialog closes in `ok`, not in `done` (D166 named S3-1's "closes in `done`" for a dialog of a row's own) | [CS:S2-1] names this site: "the dialog closes in `ok`, and re-enables on `false`", and LB-6 keeps what was typed. Everything else of D166 holds: busy until the settle, "Keep recording" disabled while busy |
| DV-3 | The marker's Add button and the Dialog's confirm have no icon, so the Spinner stands before the label; the confirm also switches its label to the existing "Ending…" after the reveal | As W67 DV-3. The Snapshot tile's Spinner replaces its icon (nothing moves) |
| DV-4 | The tablet's camera tabs and the settings sheet's camera choice carry the guard but no busy mark or Spinner; the phone's feed tap target carries the busy mark | Results are ignored there [CS:S2-1], and the picture itself is the feedback |
| DV-5 | The presenter runs first **in LIVE only**, and the 422 branch is LIVE only too | W67 DN-1 precedent: SIMULATED keeps the step-79 toasts exactly. A Simulated `REASON_TOO_SHORT` is unreachable, because the Dialog's check is the simulator's rule (`session-live.math.ts:269-272` = `session-machine.ts:689-697`) |
| DV-6 | The sealed session's Summary was not acknowledged on the phone ("Done" not pressed) | The acknowledgement is W72's site, which is being changed in parallel. My sign-in reached Home although W67's summary was still unacknowledged, so the next sign-in is not blocked |
| DV-7 | During the F-1 investigation, five scratch test files (`zz-w68-*.test.tsx`) were created in the folder and deleted again; the bed got a `drop: false` option | My own new files only; copies are in `assets/68_banner_probe_*`. None was in a whole-suite run |
| DV-8 | The 409 of a stop (Q16) keeps the step-79 warning "The session is no longer recording." and leaves the Dialog open; the web says "already ended" and closes | LB-5 (the same branch as today). Route-sync leaves the monitor as soon as the delta shows STOPPING |

## 12. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DN-1 | Presenter first in LIVE only; SIMULATED keeps the step-79 toasts (DV-5) | Ratify (as W67 DN-1) |
| DN-2 | A 422 `INVALID_REASON` is the reason field's inline error with no toast (F59; the frontend rule "validation errors inline per field") | Ratify |
| DN-3 | The snapshot visual is split: the flash at the press (LB-4), the flight and the pop on the settle; two signals in `live-feed.tsx` | Ratify |
| DN-4 | **F-1 to the runtime owner** before W73 (Recovery shows the same banner) and W100 | Grant a small runtime slot; until then, the monitor's actions are correct and only the banner text can stay |
| DN-5 | DV-2: End Session closes in `ok` | Accept ([CS:S2-1] is explicit for this site) |
| DN-6 | DV-8: the 409 keeps the mobile wording | Accept, or give both clients one string in W83 |
| DN-7 | Ledger: +2 suites / +29 tests | Note |

## 13. State left on the phone and in `dems_lane_1`

| Where | State |
|---|---|
| `dems_lane_1` | Not reset. `paired_devices 1` (DEV-0001) and `device_credentials 1`, both unchanged. `audit_log` 197 → 220; `active_session` 1 → 1 (the row now holds the sealed session). One new session, **SES-20261006-0028, SEALED** (stopped with the reason "W68 device check end"), evidence EV-20261006-0016, one snapshot. Its summary is **not acknowledged** (DV-6). **No recording is running** |
| The phone (`dems2_phone`) | App not running. Stored Core-link preference `SIMULATED`. The paired device credential untouched. No session token anywhere (memory only). The biometric offer declined in memory, nothing enrolled. Keyguard, PIN and fingerprint as before (status identical). No reverse rule |
| Host | Backend on 4421 stopped (`shutdown complete`), Metro on 8083 stopped, `.locks/core-server.lane1.pid` empty. PostgreSQL on 4432 left running as found |

## 14. Error handling and logging

| Layer | What |
|---|---|
| Persistent log | Every failure writes the runtime log (`reportRuntimeIssue`; the persistent, privacy-filtered `dems.mobile.log.v1`) with source `sessionLive.<action>`, the error and a context without free text (`reasonLength`, `labelled`, `channel`, `cameraId`). Levels: LIVE refusals, outages and the Core's 422 at `warn` (expected states); a transition refusal at `warn`; anything else at `error`; the read-only refusal at `info`. The Live source reports every rejection itself as well (CL-24) |
| User feedback | LIVE: the presenter's toast (denied with the role, offline, timeout, limit, refused), or the reason field's error for a 422. Otherwise the step-79 toasts |
| Degradation | Every control returns to idle in every path (`done` releases the press). A dialog or field keeps what was typed on a refusal. The banner and the read-only actions explain a down link. The meters go to NO SIGNAL instead of freezing |

## 15. Rollback (R-CO; not executed)

The folder equalled `acaff20` before the first edit (`git diff --stat acaff20 -- apps/mobile/src/features/session-live`
was empty at 00:30). Pre-images of all 19 files, with SHA-256, are in `.cache/rollback/W68/` (`pre.sha256`).

1. `git checkout acaff20 -- apps/mobile/src/features/session-live` restores the seven changed files.
2. Remove this row's three new files: `apps/mobile/src/features/session-live/live-session-live-sites.test.tsx`,
   `…/live-session-live-link.test.tsx`, `…/testing/live-monitor-bed.tsx`.
3. The mobile ledger then drops by 2 suites / 29 tests. Nothing outside the folder imports anything this
   row added. The route `src/app/(app)/session/live.tsx` imports `SessionLiveScreen`, whose name and props
   are unchanged.

## 16. Assets (`implementation/assets/`)

| File | What |
|---|---|
| `68_phone_home_live.png`, `68_phone_step1_filled_live.png`, `68_phone_step3_ready_live.png`, `68_phone_monitor_meters_a_live.png`, `68_phone_monitor_meters_b_live.png`, `68_phone_snapshot_live.png`, `68_phone_end_dialog_live.png`, `68_phone_after_stop_summary_live.png`, `68_phone_after_simulated.png` | The device check, in order (§8) |
| `68_device_run.log`, `68_device_driver_steps.log`, `68_lock_status.txt` | The run log, every driver command with its result, the lock status before and after |
| `68_run_w68.sh.txt`, `68_device_w68.sh.txt`, `68_drive_q.mts.txt` | The device scripts |
| `68_mutate.py.txt`, `68_mutating_transformer.cjs.txt`, `68_jest_mut_config.cjs.txt`, `68_mutations.log` | The mutation check (§7) |
| `68_final_gate.log` | §6 |
| `68_banner_probe_results.txt`, `68_banner_probe_spy.test.tsx.txt`, `68_banner_probe_session_new.test.tsx.txt`, `68_banner_probe_mocks.test.tsx.txt` | F-1: the probes (scratch tests, deleted from the tree) and their output |

---
*Generated: 2026-10-06 01:21 WIB*
