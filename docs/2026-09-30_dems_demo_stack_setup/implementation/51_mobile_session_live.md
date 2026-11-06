---
task_id: 2026-09-30_dems_demo_stack_setup
step: 79
plan_row: 05_mobile_plan §3 M-10
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete-with-notes
---

# Step 79: Mobile Session Monitor (M-10)

**Outcome: the Session Monitor is built and proven on both AVDs, with four notes for the controller.** The notes are F-79-1…F-79-4 in §6.

| Row-79 check | Result | Evidence |
|---|---|---|
| T-M08 passes | **PASS**: 8/8 tests. Mutation-checked: 5 tests fail with the guard off, and the F-79-1 test fails without the root-Back prompt | §4.1, §4.2 |
| The feed screencap on both AVDs shows the video with its OSD | **PASS** | [phone](assets/mobile/79_dems_phone_monitor_full.png) and [tablet](assets/mobile/79_dems_tablet_monitor_b.png): the step-72 live loop with the burnt-in UTC+07:00 time, "CAM 1" and the clip's own `CAM-01 · VIDEO-01 · LIVE · DEMO` line |
| MA-09 PASS on a device | **PASS on dems_phone**. Also shown on dems_tablet | §5.2 |
| MA-12 live part recorded on both AVDs | **Recorded, in fallback form.** `pane-feed`, `pane-meters` and `pane-timeline` are present on the tablet in landscape and in portrait. `uiautomator dump` cannot idle while the live video and the 1 Hz timers run (D68), so the host `testID` values, which uiautomator reports as `resource-id`, were read from the device's React tree | §5.3 |
| MA-17 recorded on both AVDs | **Recorded.** Phone: Janky 1.17 %, 90th percentile 22 ms, overlay 60/60 fps. Tablet: host-bound miss at load average 24–26; a Home baseline under the same load is just as bad (informational, §7.8) | §5.4 |
| MA-11 MB 4 checklist met | **PASS** | [contact sheet](assets/mobile/79_dems_phone_mb4_contact.png), §5.1 |
| Mobile typecheck, lint and jest exit 0 | **Own folder: all clean.** 3 suites, 49 tests; eslint clean; no `tsc` error in `session-live`. The full-app gate is red only in files other lanes are editing right now (P11): steps 78 and 83, and step 70's stub-parameter tests that those screens replace | §4.1 |

## 1. Files

Every file is under `apps/mobile/src/features/session-live/`, the only path step 79 owns (P6).

| File | Change | Role |
|---|---|---|
| `session-live-screen.tsx` | rewritten (was step 70's stub) | The screen. It keeps its export, `SafeScreen id="session-live"` and the four §2.4 arrangements (`stack`, `split`, `tablet-portrait`, `tablet-landscape`). It also holds the header, the back guard plus `useRootBackPrompt` (F-79-1), the marker flight wiring, the sheets and the settled remount of the tablet meters (F-79-4) |
| `i18n.ts` | filled (was empty) | `features.session-live.*`. It holds only copy the monitor alone uses; the rest is shared `session.*` and `common.*`, and `mobile.*` |
| `session-live.math.ts` | new | Pure rules: arrangement, column widths, the clock-derived timer, the S2b strip, timeline rows, marker label, the S21 reason rule, hold and shutter constants |
| `use-monitor.ts` | new | Selectors that return flat values or store slices (F74-13), and `useMonitorActions`. `SimTransitionError` shows a warning toast and writes a `warn` log line; anything else shows a danger toast and writes an `error` line; while read-only (S7) actions are refused with a toast. The stop reason is never logged, only its length |
| `rec-indicator.tsx` | new | S2: the REC dot and halo (M-C-05, loop `monitor-rec`) and `RecTimer` (C-6 `slide`, simulator clock) |
| `live-feed.tsx` | new | S3: CameraFeed live loop, GlowLayer breathing (loop `glow-breath`), overlay chips, REC chip with timer, snapshot counter, M-C-18 shutter and thumbnail flight, tap-to-switch (phone) or kit Tabs (tablet), the Pause-monitoring scrim, NO SIGNAL |
| `mic-card.tsx` | new | S4: `MicCard` and `MicMeter`. A C-2 DbfsMeter fed by `useAudioSharedValues` (D57); a 1 Hz accessibility value; NO SIGNAL bridged from the shared value (F74-08); CLIP reset; a Warning haptic when the latch sets |
| `status-strip.tsx` | new | S2b: VIDEO 1, VIDEO 2, STORAGE, TIME as StatusChips, in a row or a column |
| `action-tiles.tsx` | new | S5: Snapshot, Bookmark (kit Popover: bottom-sheet presentation on phones, popover on tablets), Audio Monitor, Settings |
| `end-session.tsx` | new | S6: the "End Session" hold (M-C-19, 1,500 ms, haptics at 0/50/100 %) and the reason Dialog. The Dialog needs a reason of at least 5 characters, moves above the keyboard, and is capped at 560 dp wide |
| `monitor-sheets.tsx` | new | Kit BottomSheets for the timeline (newest 8), the Audio Monitor (two `large` meters) and the settings (Pause monitoring, camera, meter size). The simulator context is provided again inside the kit portal |
| `connection-banner.tsx` | new | S7: `Alert` warning plus `Spinner` "Core link lost…", or success "Resynced", from `useConnectionBanner()` (M-MB-04) |
| `marker-flight.tsx` | new | M-C-17: a chip flies from the Bookmark tile to the History icon (phone) or the inline timeline (tablet) |
| `use-sheet-presence.tsx` | new | Mounts a sheet on demand and opens it after its content's first layout (F-79-2) |
| `back-guard.test.tsx` | new | **T-M08** (8 tests) |
| `session-live-screen.test.tsx` | new | 22 screen tests: phone, End Session, Core link, tablet layouts |
| `session-live.math.test.ts` | new | 19 tests of the pure rules |
| `testing/monitor-harness.tsx`, `testing/monitor-test-setup.ts` | new, test-only | The real `/session/live` route on the real providers with `createTestSim`, and the package's own gorhom mock for the sheet suites |

**Not written:** `packages/shared/**`, `src/app/**`, `src/navigation/**`, `src/runtime/**`, `src/components/**`, any `package.json`, the jest config, `delegation_progress_report.md`, `status_tasks.md`, `masterplan/02_plan.md` and `99_implementation_report.md`. The last four are shared files in a parallel run (P8), so the controller synthesises them.

No `npm install` ran and nothing was committed.

**SIM-GAP: none.** Every need is covered by the step-31/32 contract (§3).

## 2. What the screen does (04_mobile_specs §4.5)

| Region | Implementation |
|---|---|
| S1 header | Guarded back arrow, "Active Session", and the session id in mono. **Phone:** a History icon opens the timeline sheet; its badge counts events not yet seen and pops with `bouncy`. **Tablet:** the timeline is inline |
| S2 REC row | Pulsing dot with a halo, "Recording" in danger-400, and the Orbitron `display` timer from `session.startedAt` on the simulator clock (S4, F74-09) |
| S2b strip | "VIDEO 1 REC · VIDEO 2 REC · STORAGE OK · TIME GNSS LOCKED". Tones: REC/OK/GNSS-locked green; DEGRADED/LOW/unlocked amber; LOST/FULL/OFFLINE red. Labels come from shared enums (`storageRecordingState.READY` = "OK") |
| S3 feed | `CameraFeed mode="live"` plays `liveLoopFor(n)` (session 0024, D61), muted and looped, with the procedural fallback. Chips "CAM 1 - Interview Room 1" and "1080p • 25 fps" sit raised above the clip's own OSD line. A snapshot counter and a REC chip with the timer (DR-92-7). Camera switch: tap on phones, `Tabs variant="secondary"` on tablets |
| S4 MIC cards | `Surface` plus a dot Chip plus DbfsMeter `card` (or `compact` via Settings). 20 Hz shared values, zero renders per frame (MA-16 path) |
| S5 tiles | **Snapshot:** `snapshot()`, shutter, flight, counter pop, and a bottom toast. **Bookmark:** a Popover with an optional label (≤ 80 characters) calls `addMarker()`; the chip flies and a bottom toast shows "Marker added at HH:MM:SS". **Audio Monitor** and **Settings** open sheets. Snapshot and Bookmark are disabled while read-only (S7) |
| S6 End Session | Danger `lg` button, `Square` icon, "End Session" at 19 dp bold. **Full motion:** hold 1.5 s; a short tap only shows the hint toast. **Reduced motion:** a press opens the Dialog. **TalkBack:** the `activate` action opens the Dialog. The Dialog requires the reason, then calls `stopRecording(reason)`, and route-sync plus the route's policy open `/session/finalizing` |
| S7 banner | Offline: warning Alert plus Spinner and the read-only note; Warning haptic. Resynced: success Alert for 3 s. Slides in 240 ms; a fade under reduced motion |
| S8 faults | NO SIGNAL on the meter (from the frame flag or the mic state). CLIP latch chip; tapping it calls `resetClip`. A lost camera shows CameraFeed's NO SIGNAL; FAULT routes via route-sync |
| Back (§3.6) | `useBackGuard({ enabled: RECORDING })` plus `BackGuardDialog variant="monitor"`, extended by `useRootBackPrompt` for a monitor with no route beneath it (F-79-1). Back never stops a recording |
| Keep-awake | Held by the step-73 runtime for all of RECORDING. The device log shows "Screen kept on for the session" while recording and "Screen keep-on released" after SEALED (§5.2) |
| Motion | §7.3 beats: feed 80, MIC 140, actions 200, End Session 260 (`enterRise`). Ambient loops: 2 of 4 (`monitor-rec`, `glow-breath`; debug overlay). Reduced motion or `?motion=off`: a static dot, no glow breathing, no flights, the Dialog on press; the meters and video stay live (S72-2) |

## 3. Simulator contract used (no SIM-GAP)

**Reads:**
- `useSim` with `activeCameraId`;
- `selectCameras`, `selectMics`, `selectTimeline`;
- `storage.state`, `time.source`, `time.locked`;
- the session primitives: id, state, `startedAt`, case, room, counters, timeline length;
- `clock.now` for the timer.

**Actions:** `snapshot`, `addMarker`, `stopRecording`, `resetClip`, `setActiveCamera`.

**Runtime (step 73):** `useAudioSharedValues`, `useAudioAccessibilityValue`, `useConnectionBanner`, `useCoreLink`, `reportRuntimeIssue`.

**Navigation (step 70):** `useBackGuard`, `BackGuardDialog`.

## 4. Verification (JS)

### 4.1 Gates

Commands ran from the workspace root; jest used `--maxWorkers=2` (P9).

| Check | Command | Result |
|---|---|---|
| Baseline before edits | `npm run typecheck -w @dems/mobile` | exit 0 (05:05) |
| Own suites | `cd apps/mobile && npx jest --maxWorkers=2 src/features/session-live` | **3 passed, 49 tests passed** (back-guard 8, screen 22, math 19). Last run after the final edit, 06:3x |
| Own lint | `npx eslint src/features/session-live` | no output, exit 0 |
| Own typecheck | `npm run typecheck -w @dems/mobile` filtered to `session-live` | 0 errors |
| Full lint | `npm run lint -w @dems/mobile` | **exit 0** (06:03) |
| Full typecheck (P11) | same | exit 2: 168 errors, all in step 83's `evidence-list.test.tsx` and `evidence-model.test.ts` and step 78's `session-new-model.test.ts`. Earlier runs had errors only in steps 75 and 77 files (`login-brand.tsx`, `login.test.tsx`, `dashboard-screen.test.tsx`), which were being edited at the time |
| Full jest (P11) | `npx jest --maxWorkers=2` | 44 of 47 suites; 619 of 634 tests. The failures are step 78's `session-new-screen.test.tsx` (its own work in progress) and step 70's `routes.test.tsx` / `guard.test.tsx` cases that assert the `stub-param-*` test ids of the evidence and session-new stubs, which steps 83 and 78 are replacing. No failure touches `/session/live` |

### 4.2 T-M08 and its mutation checks

`back-guard.test.tsx` renders the real route file `src/app/(app)/session/live.tsx` over Home, with a recording simulator.

It proves:
1. The monitor opens with 00:18:42 from the simulator clock.
2. `router.back()` opens "Recording continues on the Core. Leave the monitor?" while the path stays `/session/live` and the state stays RECORDING; Stay closes the Dialog.
3. The header arrow is guarded too.
4. Go to Home leads to `/home`, still RECORDING, with no `RECORDING_STOPPED` row and time still running.
5. Three Backs never stop the recording.
6. After a stop the guard is off and the route follows STOPPING to `/session/finalizing`.
7. With a route below, a hardware Back (BackHandler) is passed on and the stack guard asks.
8. **F-79-1:** with the monitor as the only route, a hardware Back is consumed and asks; a second Back means Stay; the header arrow asks; Go to Home leads to `/home`, still RECORDING.

Mutation checks. The source was edited in place for a few seconds each, then restored; `shasum -c` reported OK.

| Mutant | Result |
|---|---|
| `useBackGuard({ enabled: false })` | **5 failed**, 3 passed |
| Root-Back listener always `return false` | **1 failed** (the F-79-1 case) |

### 4.3 Screen tests (22)

- **Phone MB 4 regions and copy.** "End Session" is present and no "Stop Session" text appears. Live loop 1 plays muted and looped. The timer follows the simulator clock. Tap-to-switch changes the camera to VIDEO-02 and the loop to loop 2.
- **Snapshot.** Count and timeline update, a `SNAPSHOT_TAKEN` row is written, and the counter chip changes.
- **Bookmark.** The bottom-sheet form with an empty label adds `Marker n`; the History badge appears.
- **History sheet.** It shows exactly 8 rows, the new marker, and clears the badge.
- **Audio Monitor sheet.** Two separate `large` meters.
- **Settings.** Pause monitoring shows the scrim and pauses the player, and the state stays RECORDING.
- **Faults.** MIC_CLIP latch, then the CLIP chip resets it. MIC_NO_SIGNAL shows NO SIGNAL only on MIC 1.
- **MA-16, screen form.** 40 frames per channel produce at most 8 commits of the whole tree.
- **End Session.**
  - A short tap never ends anything.
  - The long press opens "End Session?".
  - A 4-character reason shows the error and does nothing.
  - "Interview complete" leads to STOPPING with that stop reason, a `RECORDING_STOPPED` row, and `/session/finalizing`.
  - Keep recording closes the Dialog.
  - Under reduced motion a press opens the Dialog.
  - The `activate` action opens the Dialog.
- **Core link lost.** The banner shows; Snapshot and End Session are refused; the state stays RECORDING. After the link returns, "Resynced" shows.
- **Tablets.**
  - Landscape has the three panes, no History icon, the inline timeline, and working camera Tabs; a new marker lands inline.
  - Portrait has the three panes and Tabs.
  - Phone landscape has feed and meters, no inline timeline, and History.

### 4.4 Static checks (own folder)

| AC | Command | Result |
|---|---|---|
| MA-22 | `grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?" apps/mobile/src/features/session-live` | no match (exit 1) |
| MA-16 | `grep -rn useAudioChannel …/session-live` | no match |
| MA-20 | `grep -rn "Haptics\." …/session-live` | no match: every haptic goes through `triggerHaptic` |
| MA-21 | `grep -rnE "Tersangka\|Saksi\|Lainnya" …/session-live` | no match |
| MA-23 | kit-primitive export grep | no match |
| MA-25 | URL grep | no match |
| D38 | "Stop Session" in source outside comments | no match |
| D66 | Every hook-calling function is a `use*` hook or a PascalCase component. The four lowercase helpers call no hook | checked |

## 5. Verification on the devices

**Setup.** Every session ran through `METRO_PORT=8083 apps/mobile/scripts/device-session.sh <avd> …` (lane C, D69), outside the sandbox (P10). The helper force-stopped the app first (D55).

**Deep links** were quoted (D68): `demsdemo:///session/live?scenario=recording[&motion=off|&debug=1]`.

**Sign-in** used the simulator's own biometric action through the dev-only `__DEMS_DEBUG__` handle (`signInWithBiometric("OPR-001")`). The Login stub button was gone because step 75 is replacing Login. No password was entered anywhere.

**Taps** used screencap coordinates, because uiautomator cannot idle on this screen (D68).

**Interactive sessions.** A small driver held the AVD lock and Metro while commands ran one at a time (under 25 minutes, P3). Scratch scripts are `s79_*` in the session scratchpad.

### 5.1 MA-11 (MB 4) checklist, dems_phone 1080x2424

[79_dems_phone_mb4_contact.png](assets/mobile/79_dems_phone_mb4_contact.png) puts the MB 4 crop (3x) next to the device screen.

Every MB 4 region is present, in the same order:
1. back arrow, "Active Session", History icon;
2. "● Recording" and the timer;
3. the 16:9 feed with "CAM 1 - Interview Room 1" and "1080p • 25 fps";
4. MIC 1 and MIC 2 cards with bars and a dBFS readout;
5. Snapshot, Bookmark, Audio Monitor, Settings;
6. the red full-width end button.

The differences are all recorded decisions:
- the label is "End Session" (D38 Q-M5) with a hold hint;
- the §5.4 status strip is added (S2b);
- the session id sits under the title;
- a REC chip and a snapshot counter are on the feed (DR-92-7);
- the feed is the step-92 live loop, not the mockup photo (D50, D28);
- the phone is taller than the MB 4 frame, so there is space above End Session.

### 5.2 MA-09 and the flows

| Check | dems_phone | dems_tablet |
|---|---|---|
| **MA-09**: `input keyevent KEYCODE_BACK` while RECORDING | **Before the fix (05:27): the app left to the launcher** (F-79-1). **After the fix (05:31):** the Dialog is visible and the state is RECORDING ([dialog](assets/mobile/79_dems_phone_ma09_dialog.png)). "Go to Home" leads to Home with the **mini-bar showing REC and the timer**, state RECORDING ([home](assets/mobile/79_dems_phone_ma09_home_minibar_b.png)). The mini-bar leads back to the monitor. **PASS** | Dialog visible, state RECORDING ([dialog](assets/mobile/79_dems_tablet_ma09_dialog.png)); Stay |
| Snapshot | Count 1→2, toast; the counter chip reads "2 snapshots" ([png](assets/mobile/79_dems_phone_snapshot.png)); the toast sits at the bottom after the change ([png](assets/mobile/79_dems_phone_snapshot_toast_bottom.png)) | — |
| Bookmark | Bottom sheet form ([png](assets/mobile/79_dems_phone_bookmark_sheet.png)). "Key admission" is recorded: last timeline entry `{kind: MARKER, label: "Key admission"}`, the chip is in flight, toast ([png](assets/mobile/79_dems_phone_marker_flight.png)) | Popover over the tile ([png](assets/mobile/79_dems_tablet_bookmark_popover.png)). An empty label gives `Marker 2`, which lands in the inline timeline ([png](assets/mobile/79_dems_tablet_marker_added.png)) |
| Sheets | Timeline, newest 8 ([png](assets/mobile/79_dems_phone_timeline_sheet.png)); Audio Monitor with two large live meters ([png](assets/mobile/79_dems_phone_audio_sheet.png)); Settings ([png](assets/mobile/79_dems_phone_settings_sheet.png)); Pause monitoring shows the scrim and dimmed meters while REC keeps pulsing ([png](assets/mobile/79_dems_phone_monitoring_paused.png)) | — |
| End Session | A short tap shows only the hint toast. A 2.2 s hold shows "Keep holding…" and then the reason Dialog. With 3 characters the confirm stays disabled; with 22 characters it enables. The Dialog sits above the keyboard. Confirm leads to state FINALIZING, then SEALED within 11.5 s. The audit tail ends `RECORDING_STOPPED, EVIDENCE_SEALED` (reason length 22). The runtime log shows "Resynced route to the session state" and "Screen keep-on released". Screens: [hold](assets/mobile/79_dems_phone_end_holding.png), [dialog](assets/mobile/79_dems_phone_end_dialog.png), [valid reason](assets/mobile/79_dems_phone_end_reason_valid.png) | — |
| Layouts | Portrait (MB 4). Landscape: feed, then the controls column ([png](assets/mobile/79_dems_phone_landscape.png)). This is the fixed version; `79_dems_phone_landscape_b.png` shows the overflow before the fix | Landscape three columns ([png](assets/mobile/79_dems_tablet_monitor_b.png)). Portrait: full-width feed, tiles, meters, then status and timeline, End Session pinned ([png](assets/mobile/79_dems_tablet_portrait_b.png)) |
| Crash buffer | `logcat -b crash`: 0 lines for the app | 0 lines |

**Rotation.** Each AVD was rotated with `adb emu rotate` and restored to its start pose (4 rotations). The final check read `cur=1080x2424` on the phone and `cur=2560x1600` on the tablet.

### 5.3 MA-12 live part (dems_tablet, landscape and portrait)

`uiautomator dump` failed with "could not get idle state" in every mode tried:
- full motion;
- `?motion=off`;
- `?motion=off` plus Pause monitoring.

It also failed on the phone. Causes: the live video plays, the timers and the meters' accessibility values change at 1 Hz, and the REC and glow loops run in full motion (D68).

**Fallback evidence.** The host `testID` values were read from the device's React tree through the Hermes inspector (`s79_ids.js`). React Native reports these as uiautomator `resource-id` values (VM-06).

| Pose | Result |
|---|---|
| Landscape 2560x1600 | `pane-feed`, `pane-meters`, `pane-timeline`, `screen-session-live`, and the `monitor-*` controls, including `monitor-camera-tab-1` and `monitor-camera-tab-2` |
| Portrait 1600x2560 | `pane-feed`, `pane-meters`, `pane-timeline`, `screen-session-live` |

The same query on the phone returns `pane-feed` and `pane-meters`, with no timeline pane (it is a sheet there).

### 5.4 MA-17 (`dumpsys gfxinfo`, 30 s, `?scenario=recording&debug=1`)

| AVD | Time | Host load | Frames | Janky | 90th percentile | Overlay | Verdict |
|---|---|---|---|---|---|---|---|
| dems_phone | 05:46 | ≈ 15 | 1,792 | 21 (1.17 %) | 22 ms | UI 60 / JS 60 fps; meters 15/s each; loops 2/4 | Janky ≤ 10 % and UI ≥ 55 pass; 90th is 2 ms over the 20 ms guide (informational) |
| dems_tablet | 06:11 | 24 | 993 | 369 (37.2 %) | 117 ms | UI 14 / JS 10 fps | informational miss |
| dems_tablet, run 2 | 06:28 | 26 | 988 | 412 (41.7 %) | 105 ms | — | informational miss |
| dems_tablet, Home baseline (idle), same load | 06:30 | 23 | 915 | 453 (49.5 %) | 109 ms | — | baseline is as bad as the monitor |

**Reading.** The tablet figures are bound by the host: the rebooted tablet emulator, a load average of 23–26 on 10 cores from the parallel lanes, and gfxstream. The Home baseline fails the same way. §7.8 treats emulator numbers as informational, and the physical-device note applies.

Overlays: [phone](assets/mobile/79_dems_phone_ma17_overlay.png), [tablet](assets/mobile/79_dems_tablet_ma17_overlay.png), [tablet Home baseline](assets/mobile/79_dems_tablet_baseline_home_overlay.png).

### 5.5 Device state left behind

- Every session ended through the helper: Metro on 8083 stopped, the app force-stopped, and this session's reverse rules removed. 8083 was free after each session.
- **Tablet:** the simulator snapshot was cleared at the end (`sim.stop()` + `persist.clearStorage()`).
- **Phone:** nothing of this step remains. The phone's reboot at about 05:56–06:07 reloaded `default_boot`, which reverted its userdata, including this step's simulator snapshot, before another lane reinstalled the app at 06:07. The clean-up session queued at 06:31 never got the lock another lane held (`lockf … already locked`, exit 75 at 06:46), and it is no longer needed.
- **Rotation** restored on both AVDs.
- **APK (F-79-3):** the tablet's app was reinstalled at 06:07 with the step-72 APK after the reboot reverted it. Another lane reinstalled it again at 06:08 and reinstalled the phone's at 06:07.

## 6. Decisions, drift, findings

### 6.1 Findings for the controller

| # | For | Finding | What step 79 did |
|---|---|---|---|
| **F-79-1** | step 70 (navigation), step 74, step 57 | After the sign-in or relaunch resync the router **replaces** straight to `/session/live`, so no route sits below the monitor. Android's hardware Back then has nothing to pop, `usePreventRemove` never fires, and **the app leaves to the launcher without asking** (dems_phone 05:27). The `(app)` layout's `initialRouteName: '(tabs)'` does not survive the replace | Handled inside the feature: `useRootBackPrompt` (a BackHandler while RECORDING and focused) opens the same Dialog, and "Go to Home" goes through `guard.leaveTo('/home')`. T-M08 covers both paths. **Suggestion:** step 70 could make the resync keep `(tabs)` underneath, so every session screen gets this for free (step 78's steps 2–3 and step 80 face the same case) |
| **F-79-2** | steps 76–89 (any kit sheet), step 74 | HeroUI Native sheets open only on a closed→open **transition** that their mounted, laid-out content sees. A sheet mounted already open, or whose content mounts after `isOpen` flips (portal delay), **stays parked off-screen**. This held for the Popover's bottom-sheet presentation and for percentage snap points or a scroll body. Also, a closed sheet still mounts gorhom, whose worklet closure holds the whole `react-native` module; Reanimated's Jest mapper walks it and throws on the `DevMenu` getter. So any suite that renders a screen with an idle sheet fails in Jest | `use-sheet-presence.tsx`: mount on request, open one frame after the content's first layout, stay mounted 450 ms for the exit, then unmount. The timeline sheet is content-sized (newest 8). The sheet suites use the package's own gorhom mock (test-only file) |
| **F-79-3** | controller, all mobile lanes, steps 59, 61, 60 | Emulators were killed and rebooted during this run (tablet PID file 05:52 and 06:04; phone down ≈05:56 to 06:07). Booting loads the `default_boot` snapshot, which **reverted the installed app to the row-18 APK** (lastUpdateTime 01:33:57; redbox "AsyncStorage is null"). It very likely also reverted step 75's PIN and fingerprint enrolment (05:27). The helper boots with `-no-snapshot-save` but still *loads* the stale snapshot | 06:07: `adb install -r` of `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, sha256 `cb6b1f513d52…7b0be5` = step 72's recorded APK (no Gradle), under the tablet lock (NO_METRO). **Suggestion:** boot with `-no-snapshot-load` (or save one fresh snapshot once) and re-check step 75's enrolment |
| **F-79-4** | steps 71, 74 | On dems_tablet under load, Skia canvases sometimes stay blank for seconds after mounting. logcat: `RNSkia updateAndRelease() failed` / `EGLConsumer is not attached to an OpenGL ES context`. It was seen on the meters in the landscape middle column, which recover after a re-render; the phone never showed it | One settled remount of the landscape meter list 900 ms after mount (`useSettledKey`). This is an emulator and GL observation, not a composition bug; re-check on a physical tablet |
| F-79-5 | step 70 | `BackGuardDialog` spans the whole tablet width (1,300 dp at 2560x1600) | Not a step-79 path. The End Session Dialog is capped at 560 dp |
| F-79-6 | step 57, 61 (Maestro, uiautomator) | The monitor never lets uiautomator idle (video, 1 Hz timers and accessibility values), even with `?motion=off` and Pause monitoring. Maestro flows on this screen should tap by id without waiting for idle, or check through another screen | The device React tree was used for MA-12 (§5.3) |

### 6.2 Decisions and interpretations

| # | Type | Decision | Why |
|---|---|---|---|
| S79-1 | interpretation | Settings "meter scale" means the meter size, Standard (`card`) or Compact | DbfsMeter has no scale prop, and the composition is not step 79's |
| S79-2 | interpretation | Pause monitoring pauses the player and the meters' UI clocks and dims them; REC keeps pulsing | The shared copy "Resume Monitoring – Show live preview and meters" (03M M-C-20) |
| S79-3 | decision | Snapshot and marker confirmations go at the **bottom** for 2.5 s; warnings stay at the top | A top toast covered the History icon, which is where the marker chip flies (dems_phone) |
| S79-4 | decision | The timeline sheet shows the newest 8 events; tablets show all of them inline in a bounded scroll | F-79-2; the full history is in Sessions and Audit |
| S79-5 | decision | The stop reason is capped at 500 characters in the UI | The API sets no maximum; the audit row keeps the whole reason |
| S79-6 | decision | Snapshot, Bookmark and End Session are disabled while the Core link is OFFLINE (S7); Audio Monitor, Settings and the camera choice stay | S7 "session actions become read-only" |
| S79-7 | decision | The column widths for phone landscape and tablet landscape are computed (`monitorColumnWidths`) | With flex ratios the 16:9 feed sized its column from the row height and overflowed on dems_phone |
| S79-8 | decision | The simulator context is provided again inside the kit sheet portal | The portal host sits under HeroUINativeProvider, above SimRuntimeProvider (§3.2 slots 7 and 9); without it the meters inside a sheet throw (found in Jest; it would crash on a device too) |
| S79-9 | decision | Device sign-in for evidence used `sim.actions.signInWithBiometric("OPR-001")` through the dev-only handle | Step 75 is replacing the Login stub; no credential was typed |
| S79-10 | D73 | F74-08: NO SIGNAL is bridged change-only; F74-09: timer on the simulator clock; F74-13: selectors return flat values or slices; F74-02: the escalation pulse is not used here | Controller relay |
| DR-79-1 | drift (plan) | 05 M-10 names the log `49_mobile_session_live.md`; row 79 names `51_…` | The blueprint is followed (51), as in DR-72-1 |
| DR-79-2 | drift (process) | The agent-level instruction to update `masterplan/02_plan.md` and write `99_implementation_report.md` was not followed | These are shared files in a parallel run (P8). Progress is in `delegation_progress/coder_execution_step_79.md` |

### 6.3 Persistent issues

| Issue | Attempts | Root cause | Status | Blocking? |
|---|---|---|---|---|
| uiautomator cannot dump the monitor | 4 modes | Live content by design (D68) | Workaround: React-tree test ids (§5.3) | no |
| Tablet MA-17 over the guide | 2 runs plus a baseline | Host load 23–26 and the emulator (the Home baseline fails the same way) | Recorded as informational (§7.8) | no |

## 7. Processes (P7)

| What | Started by | Stopped | Confirmed |
|---|---|---|---|
| Metro 127.0.0.1:8083: PIDs 62782, 65104, 79454, 87525, 97558, 1534 | device-session helper | helper clean-up ("Metro … stopped", "session ended with status 0") | `lsof -iTCP:8083` empty after each session |
| `adb reverse` 8081 and 4400 of these sessions | helper | helper | — |
| Tablet app reinstall (NO_METRO session) | this step, 06:07 | — | lastUpdateTime 06:07:56 |

**Not touched:** the emulators (no stop and no boot by this step), the adb server, mock-core (not used), and other lanes' Metro.

**Clean-up session:** the phone clean-up session gave up on the lock another lane held (exit 75, 06:46). It started nothing, so it left nothing running. See §5.5 for why no clean-up is pending.

## 8. Rollback

- **Code:** restore step 70's stub body in `session-live-screen.tsx` and its empty `i18n.ts` (both shown in 43_mobile_navigation_shell.md §2). Delete every other file listed in §1. Nothing was committed.
- **Devices:** nothing to undo. The reinstalled APK is the recorded baseline. Clear the app data to drop the `dems.mobile.log.v1` records.
- **Screencaps:** `implementation/assets/mobile/79_*`. Superseded frames are kept and labelled in §5.2: `79_dems_phone_monitor.png` (first overlay placement), `79_dems_phone_bookmark_sheet_b.png` and `…_later.png` (parked sheet before F-79-2), `79_dems_phone_landscape_b.png` (overflow before S79-7), `79_dems_tablet_monitor.png` and `…_final.png` (blank meters, F-79-4).

---
*Generated: 2026-10-01 06:45 WIB by coder-execution (step 79)*
