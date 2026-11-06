# CF-M1 — mobile runtime: the web-stop crash, the false "Core link lost", the timer, the false "unreachable", the revoke latency

| Field | Value |
|---|---|
| Row | CF-M1 of the closing-fix round CF (decision D214) |
| Defects | R-P-1 (High), R-P-2 (Medium) with R-S-2 (Low), R-S-1 (Medium) |
| Agent | coder-execution |
| Time | 2026-10-06 13:36–16:35 WIB |
| Status | **needs-review**. R-P-1, R-P-2 and R-S-2 are fixed, with tests and a repeated on-device proof. **R-S-1 is NOT fixed.** On the final build, under the host load of the proof (8–13), revoke-to-Pair took 1,303–2,358 ms, and each revoke showed one frame of the empty boot anchor. At load 5–6 the same code took 475–776 ms. A fix was tried and withdrawn (§4) |
| Narrative tier | 2: what was found, why it matters, how it was checked, and where it comes from |
| Devices | dems2_phone = emulator-5554 (lane 1: Core 4421, web 5176); dems2_phone2 = emulator-5558 (main: Core 4420, web 5173). emulator-5556 was not touched |
| Rollback | `.cache/rollback/CF-M1/` (copies taken before each first edit; `SHA256SUMS.txt` lists the copies, the new files and the restored files) |
| Assets | `assets/12a_*` (40 files, 33 MB; §9) |

Path note: `src/…` means `apps/mobile/src/…`. Line numbers refer to the tree as it is now.

---

## 0. How the defects were reproduced (method)

The re-test round saw R-P-1 and R-P-2 only when the emulator's JS thread was starved. That cannot be ordered on demand. So this row **injected JS-thread stalls**. One `Runtime.evaluate` of a busy loop (`while (Date.now() - t < 3500) {}`) was sent through Metro's Hermes inspector proxy to the phone's own app. The command is `hermes stall` in `assets/12a_driver_cfq.mts.txt`.

- The target was bound to each phone by the disappearance check. On a force-stop, only that phone's target leaves `/json/list`. The tablet's target was never connected to.
- The same channel was used read-only for two more things: the runtime snapshot (`__DEMS_DEBUG__.runtime()`, which includes the banner kind) and two CPU profiles (§4).
- A stall freezes only the JS thread, which is what the starved emulator did. The UI thread and the Core keep running, so socket messages keep arriving and wait in the JS queue.

Frames were judged by script, not by eye alone:

- `assets/12a_tools_fx.py.txt` and `12a_tools_screens.py.txt` read the device time that `screenrecord --bugreport` prints on each frame (digit templates), find the banner by its colour and the REC row's shift, and find blank frames, red screens and the Pair, Login and "unreachable" screens.
- They also decode the monitor timer's six digits with glyph templates.
- Every recording's facts are in `12a_final_lane1_proof_runs.json` and `12a_revoke_handoff_timings.jsonl`.

---

## 1. Result at a glance

| Defect | Mechanism (short) | Change | Jest proof | Mutants | Final device proof |
|---|---|---|---|---|---|
| **R-P-1** crash at a web stop | The Finalizing hand-over removes the monitor in one commit. Reanimated keeps every view with an `exiting` animation as a "ghost" and shifts the indices of the next mount instructions around it. The crash log shows those indices wrong in the monitor's own subtree, with the link banner (FadeOut) as the first view out of place | `LayoutAnimationConfig skipExiting` around the monitor, with a host view that is never flattened. The banner has no `exiting` and gets a container of its own | `live-handover-exit.test.tsx` (6) | 5 / 5 | **11 web stops: 0 crashes, 0 blank frames, Finalizing every time**, 3 of them right after a 3.5 s stall and 3 with a stall right after the stop. 1 run invalid (§5.1) |
| **R-P-2** false "Core link lost" | The housekeeping tick of the socket client falls due during a stall, sits in the JS queue in front of the heartbeats that arrive meanwhile, runs first, and declares STALE (2.5 s rule) by the wall clock | Stall-tolerant timers for the whole Live source: a callback more than 250 ms late yields 50 ms to the queue (at most 20 times) | `stall-tolerant-timers.test.ts` (13), `live-stall-link.test.ts` (1) | 4 / 5 (1 equivalent) | Before: **7 of 8** injected stalls showed the false banner. After: **0 banner frames** in 22 recordings, 10 stalls injected, the debug handle read `hidden` after each |
| **R-P-2** "timer running backwards" | Not the clock. The digit columns held their position only in Reanimated; after a stall Reanimated drops settled values, and the next commit drew the digit the column was **mounted** with | `TimerReadout`: React places each column; the roll is an offset that rests at 0 | `monitor-timer-drawn.test.tsx` (13) | 3 / 3 | **0 backward steps** in every decoded recording. Before: 03:28, then 03:23 |
| **R-S-2** false "Core server unreachable" | (a) The same queue order: the `hello` deadline judged before the queued `hello` (SYNC_TIMEOUT). (b) The client's own socket restart reads OFFLINE in its reconnect gap | (a) the timers above. (b) The first restart the client makes itself reads as settling (DX-3 extended); a second one in a row shows the notice | `live-client-restart.test.tsx` (4) and the timer tests | 3 / 3 | **0 "unreachable" frames in 15 hand-offs** (6 final). Not reproduced on device before the fix either (§3.4) |
| **R-S-1** slow revoke-to-Pair | Not a timer, the secure-store delete, the gate snapshot or the signed-out landing (all synchronous, or not on the path). It is 1–3 s of synchronous React commit work on a loaded dev build: Reanimated worklet registration, unmounts, GC, DEV stacks. The empty boot anchor is painted in between | **No code change kept.** An in-place Pair at the anchor was measured slower and withdrawn | — | — | **FAIL** under load: 1,303 / 1,386 / 1,532 / 2,358 ms, with one dark anchor frame each |
| Controller note | `pairing-handoff-routes.test.tsx` passed jest's 5 s under load | `jest.setTimeout(30_000)` per file, also in `pairing-live.test.tsx` (same failure in this row's suite run 1) | suite run 2 green | — | — |

---

## 2. R-P-1 (High): the crash of the React instance at a web stop

### 2.1 Evidence and mechanism

**The crash log** (`test/assets/retest/p_phone/68_p4_device_log_app_process_1303_1304.txt`) shows two failed removals, a failed insert, and the instance destroyed:

- 13:04:03.495: `Tried to remove view [21688] of parent [20372] at index 0, but got view tag 19014 - actual index of view: 1`. The native children of 20372 at that moment were `[19014, 21688, 20348 ScrollView, 20370]`.
- 13:04:03.523: `Tried to remove view [20372] of parent [20378] at index 0, but got view tag 20376`. 20378 is react-native-screens' `ScreenContentWrapper`.
- 13:04:03.662: `addViewAt: failed to insert view [22216] into parent [20378] at index 1` (`IndexOutOfBoundsException: index=1 count=0`).
- 13:04:03.762: `ReactHost.handleHostException`, then "reactInstance is null".

What the log shows:

- The mounting layer's idea of the children of the monitor's root (20372: header 19014, banner 21688, scroll view, End Session) and of the screen's content wrapper disagrees with the native tree. One index is off in each, and then an insert targets index 1 in a parent that is already empty.
- 21688 is the banner's view. Its tag is newer than its parent's; it was mounted when the banner appeared at 13:04:00.36.
- Twelve seconds earlier the log has `synchronouslyUpdateUIProps failed … Unable to find SurfaceMountingManager for tag [21670]`: an animation still updating a view that native had already deleted, at the moment "Core link lost" turned into "Resynced". The banner's spinner unmounted then.

**Where indices are rewritten.** Fabric's mutations pass through Reanimated's layout-animation proxy (`react-native-reanimated` 4.5.1, `Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy_Legacy.cpp`):

- A removed subtree is walked in `startAnimationsRecursively` (line 499).
- A view with an EXITING config, and its ancestors, are kept alive as a "ghost" instead of being removed. A screen pop is the exception (`isScreenPop`).
- The indices of later Remove and Insert mutations are then rewritten around the ghosts (`updateIndexForMutation`, lines 159 and 294; `handleRemovals`, line 241).
- The Finalizing hand-over (`src/app/(app)/session/live.tsx`, FX-M2) is NOT a screen pop. In one commit it replaces the monitor with the Finalizing card inside the same screen, and its `<Redirect>` replaces the screen a moment later.
- So every `exiting` view inside the monitor becomes a ghost while the next commits arrive:
  - the banner's `exiting={FadeOut…}`, which was unconditional and so present even under `?motion=off`;
  - in full motion also the camera feed's cross-fade (`src/components/media/camera-feed.tsx:192`) and NO SIGNAL (`src/components/composed/dbfs-meter.tsx:268`).
- The two index errors sit exactly in that subtree.

**What is proven and what is not.** The crash did not reproduce on demand. This row tried 5 times before the fix:

| Attempt | What was done | Result |
|---|---|---|
| E2 | Stall 3.5 s, then stop | No banner appeared |
| E3 | Stop during "Resynced" | No crash |
| r2 | Stall, then stop during "Resynced" | No crash |
| v2a | Stop, then a 3 s stall | No crash |
| f1 | Full motion, plain stop | No crash |

The re-test had 1 crash in 2 runs. So the link "ghost bookkeeping, then crash" rests on the log above, the library code and the timing: the banner was on screen in the crashing run and not in the clean one. It is a mechanism with evidence, not a replay. The fix therefore removes the ghost mechanism from the hand-over altogether, whichever `exiting` view would have triggered it.

### 2.2 Change

| File | Change |
|---|---|
| `src/app/(app)/session/live.tsx:43-48` | The monitor is wrapped in `<LayoutAnimationConfig skipExiting>` with a `<View collapsable={false} testID="session-live-exit-boundary">` as its only child. On unmount the wrapper calls `setShouldAnimateExitingForTag(tag, false)` (`react-native-reanimated/src/component/LayoutAnimationConfig.tsx:62,67`) **before** the commit. The proxy's `shouldAnimateExiting` (`LayoutAnimationsManager.cpp:49-52`) then makes the whole removed subtree a plain removal: no ghost and no index rewrite, also in full motion. The non-collapsable host is the tag `findNodeHandle` reads |
| `src/features/session-live/connection-banner.tsx:44` | The `exiting` animation is removed. The `entering` animation is kept: it creates no ghost. The banner now leaves in the commit that hides it |
| `src/features/session-live/session-live-screen.tsx:310` | The banner sits in a `collapsable={false}` slot (`monitor-banner-slot`). Its inserts and removals happen inside that slot and never shift the index of the monitor root's other children |

### 2.3 Tests

`src/features/session-live/live-handover-exit.test.tsx` uses the app's own Live source over the contract-checked fake transport (W68's `live-monitor-bed`):

- The monitor is under exactly one `skipExiting` wrapper, whose only child is the non-collapsable host.
- The banner (offline and "Resynced") has no `exiting` anywhere up to its slot, and the slot is non-collapsable.
- In reduced and in full motion, a web stop while "Resynced" shows makes the wrapper's `setShouldAnimateExiting` run exactly once, with `skipExiting: true`, with the banner still on screen. Then the monitor is gone and Finalizing is drawn.
- A static check with a negative control: `connection-banner.tsx` declares no `exiting`.

```
npx jest src/features/session-live/live-handover-exit.test.tsx
Tests:       6 passed, 6 total
```

Mutants (in memory, `12a_mutations.log`), all **DETECTED**:

| Mutant | What it removes or changes |
|---|---|
| P1-a | No wrapper |
| P1-b | `skipExiting={false}` |
| P1-c | Collapsable host |
| P1-d | The banner's `exiting` back |
| P1-e | Flattenable banner slot |

### 2.4 On-device proof

The proof ran on lane 1 after a fresh relaunch (15:43, `demsdemo:///login?core=LIVE&motion=off`). Each run: budi starts on the phone wizard; andi.pratama stops on the web 5176 while the phone shows the monitor.

- Host load was 8–13 throughout.
- "Next frame" is the first frame after the last monitor frame.
- "Core 202 → Finalizing" converts device time to host time with the measured device−host offset (≈ −400 ms).

| Run | Stop variant | Core `stop` 202 (host) | Last monitor frame → next frame (device) | Next frame | Core 202 → Finalizing | Crash-class lines | Web | Recording |
|---|---|---|---|---|---|---|---|---|
| F01 | 3.5 s stall, then stop | 15:45:41.678 | 15:45:42.535 → 43.079 | Finalizing card (mean 18.0, not blank) | ≈1.80 s | 0 | SEALED | `12a_final_F01_web_stop_after_stall.mp4` |
| F02 | plain | 15:47:21.766 | 15:47:23.067 → 23.466 | Finalizing | ≈2.10 s | 0 | SEALED | (scratch) |
| F03 | stop, then 3 s stall | 15:48:58.727 | 15:49:01.778 → 03.118 | Finalizing (the frame freezes during the stall, no blank) | ≈4.79 s | 0 | SEALED | `12a_final_F03_web_stop_then_stall.mp4` |
| F04 | plain | 15:50:43.009 | 15:50:44.508 → 44.755 | Finalizing | ≈2.15 s | 0 | SEALED | (scratch) |
| F05 | **invalid**: the wizard's Start Recording tap was missed, so the session stayed ARMED and no stop applied | — | — | — | — | 0 | (ARMED) | — |
| F06 | plain, with the phone's own End Session dialog open (a stray tap of the driver; §5.1) | 15:55:38.889 | dialog over the monitor 15:55:40.515 → 42.994 | Finalizing | ≈4.5 s | 0 | SEALED | (scratch) |
| F07 | stop, then 3 s stall | 15:57:25.910 | 15:57:28.036 → 28.478 | Finalizing | ≈2.97 s | 0 | SEALED | (scratch) |
| F08 | 3.5 s stall, then stop | 15:59:09.335 | 15:59:10.150 → 10.440 | Finalizing | ≈1.51 s | 0 | SEALED | (scratch) |
| F09 | plain | 16:00:53.424 | 16:00:54.768 → 55.291 | Finalizing | ≈2.27 s | 0 | SEALED | (scratch) |
| F10 | 3.5 s stall, then stop | 16:02:37.067 | 16:02:38.352 → 38.577 | Finalizing | ≈1.91 s | 0 | SEALED | (scratch) |
| F11 | stop, then 3 s stall | 16:04:08.630 | 16:04:10.227 → 10.813 | Finalizing | ≈2.58 s | 0 | SEALED | (scratch) |
| F12 | plain | 16:05:47.568 | 16:05:48.307 → 48.445 | Finalizing | ≈1.28 s | 0 | SEALED | `12a_final_F12_web_stop_plain.mp4` |

**Totals: 11 valid web stops, 0 crashes, 0 blank frames, 0 red screens, Finalizing every time.**

- Crash-class lines counted per run: `addViewAt`, `Tried to remove view`, `handleHostException`, `reactInstance is null`, `FATAL`, `IndexOutOfBounds`.
- The last-monitor and next frames of every run are in `12a_final_handover_frames_11_runs.png`.
- Five interim runs (P01–P05, 15:17–15:26, same code, before the final relaunch) also handed over cleanly with 0 crash lines. They are not counted, because a Fast Refresh of this row's own edit landed during P05.

**A stop right after a link banner** could not be provoked honestly after the fix. The stalls that produced the banner every time before the fix no longer produce it (§3), and a real outage was out of bounds (no server, Metro or reverse-rule change). The variants F01, F08 and F10 stop exactly at the condition that produced the banner before. The banner-on-screen case is held by the jest test (§2.3).

### 2.5 Residual risk

- The crash is in the library's bookkeeping and was intermittent (re-test: 1 of 2; this row before the fix: 0 of 5). "0 of 11" after the fix is strong but statistical.
- Full motion was not part of the final device proof (the launch is `?motion=off`). The fix covers full motion by construction (`skipExiting` covers every descendant), and jest checks both policies.
- Other screens that remove a subtree in place (not a screen pop) while a descendant has `exiting` would carry the same exposure. Not audited here.

---

## 3. R-P-2 and R-S-2: false "Core link lost", the timer, false "unreachable"

### 3.1 Reproduction before the fix (lane 1)

| Run | Stall | Banner (frames, device time) | Debug handle |
|---|---|---|---|
| E1 (start) | 3.5 s at elapsed ≈8.7 s | "Core link lost" 13:59:50.875, "Resynced" 51.091, gone after 3.3 s | — |
| E2 (monitor) | 3.5 s | none | — |
| E3 | 3.5 s | lost 14:05:52.448, Resynced 53.038 | `resynced` |
| r1 | 4 × 3.5 s | — | `resynced` after **4 of 4** |
| r2 | 3.5 s | lost 14:20:55.669, Resynced 56.010 | `resynced` |

So **7 of 8** stalls made the false banner, while the Core logged no socket close or open (`serverlog` of each batch). Frames: `12a_prefix_stall_false_banner_frames.png`; recording: `12a_prefix_E3_stall_banner_then_web_stop.mp4`.

### 3.2 Mechanism: the queue order after a stall

The socket client (`packages/shared/src/realtime/live-socket-client.ts`) judges the link with wall-clock deadlines in its housekeeping:

- The housekeeping runs every 500 ms (`STALE_CHECK_INTERVAL_MS`, `heartbeat-client.ts:65`; armed at line 1107).
- STALE: no message for 2,500 ms (`HEARTBEAT_STALE_AFTER_MS`, `api/constants.ts:21`; `stale = true`, line 1078).
- SYNC_TIMEOUT: `hello` or a snapshot not received by `syncDeadline` (lines 891 and 1082), which ends in `abandonConnection` (line 793).

During a stall the tick that falls due is queued **before** the heartbeats that arrive later. When the thread is free it runs first, reads `now()`, and declares the link lost; the heartbeat that runs a moment later brings it back.

- In the monitor this is STALE: the heartbeat state is not LIVE, the banner shows "offline", then "Resynced".
- On the pairing hand-off it is SYNC_TIMEOUT `waiting: 'hello'` (D211: the Core opened the socket at 19.178 and the app judged at device 24.176). The client then gives the socket up, and its reconnect gap reads OFFLINE: the 0.10–0.47 s of "Core server unreachable".

This is in the shared package, which is outside this row's paths and also used by the web. The fix is therefore on the mobile side, where the Live source's timers are injected.

### 3.3 Mechanism: the "timer running backwards"

The timer is not the clock. The Live clock never moves backwards (`packages/shared/src/live/source/clock.ts`), and in R-P-2's own captures the feed's burnt-in time runs on (12:59:50, 52, 52, 53, 53, 56) while the timer reads 12, 13, 04, 07, 08, 20 (`test/assets/retest/p_phone/56b_run1_start_handoff_monitor_timer_crops.png`).

**How the digits were drawn.** The timer, and the feed's REC chip, used `RollingNumber` slide columns. Each digit's position (`translateY`) lived only in a Reanimated shared value; React held the position of the digit the column was **mounted** with.

**How Reanimated loses a settled value.** Reanimated 4.5.1 hands settled animated props back to React from a 500 ms JS interval:

- `src/PropsRegistryGarbageCollector.ts:11` sets the interval; `AnimatedComponent.tsx` `_syncStylePropsBackToReact` applies the values.
- The native side, in `getSettledUpdates`, first **removes** every update settled more than 2 s ago, then returns those settled more than 1 s ago (`ReanimatedModuleProxy.cpp:663`, `AnimatedPropsRegistry.cpp:49`).
- After a JS stall longer than about 1–2 s, a value that settled just before it is deleted without ever reaching React.
- The next commit of that column then draws React's own value: the digit of its mount.

**Every observed case fits.**

| Case | Mounted at | Stall, then | What showed |
|---|---|---|---|
| R-P-2 | 00:00:0x (tens 0) | the tens column showed 0 again | 14, 17, 18 read 04, 07, 08, until the tens roll to 20 moved the column |
| R-P-1 | 00:03:13 (13:02:49) | the tens column, rolled to 2 at 13:03:56, showed 1 again | 04:24 read **04:12** |
| E2, this row | 00:00:03 | ones column back on its mount digit, in the timer and in the REC chip | **00:03:28, then 00:03:23**, then 03:29 (`12a_prefix_stall_timer_revert_frames.png`; recording `12a_prefix_E2_stall_timer_revert.mp4`) |

### 3.4 Changes

| File | Change |
|---|---|
| `src/runtime/stall-tolerant-timers.ts` (new) | `createStallTolerantTimers(timers, now)`. A callback that fires more than `STALL_LATENESS_MS` (250 ms) after its due time yields `STALL_YIELD_MS` (50 ms) so every queued task runs first, then it runs. It yields at most `STALL_MAX_YIELDS` (20) times in a row, so no deadline moves by more than about 1 s. On-time callbacks are unchanged; clearing works in every phase; an interval keeps its period from the run that happened |
| `src/runtime/sim-adapters.ts:365` | `createMobileLive` wraps the Live source's timers once. That covers the socket client's housekeeping and reconnects, the command gate's CL-17 time-outs, the source's own deadlines and the secure-store budgets (D203 had routed the budgets' starvation risk) |
| `src/runtime/sim-adapters.ts:396, 595, 728-732`; `isClientRestart` at `:277` | A marker for a connection the client gave up **by itself** (SYNC_TIMEOUT or SEND_FAILED, read from the Live source's own report). While the link is OFFLINE between that socket and the next one, and only for the first restart of a series (`reconnectAttempt <= 1`), `isClientRestart` is true |
| `src/runtime/ended-link.ts:49`, `src/runtime/sim-runtime-provider.tsx:421-422` | `isLinkSettling = isRunEndedByCore || isClientRestart`. That is DX-3 extended: OFFLINE reads CONNECTING for the Core link, the banner, the Login notice and the Pair screen's notice (`useNoticeLiveLink`). A Core that keeps not answering, so that the next socket also times out, shows the notice one reconnect step later than before; a socket the Core really lost shows it at once, as before |
| `src/features/session-live/timer-readout.tsx` (new); `rec-indicator.tsx:84`; `live-feed.tsx:224` | `TimerReadout`: the same 20-cell columns as `RollingNumber`, but **React** places the current digit's cell (`translateY: -cell * lineHeight` in the view's own props). The M-C-02 roll (full motion) is an extra offset on a wrapper that starts one cell back and **rests at 0**, which is also the value React holds, so a dropped or reverted offset still shows the current time. Reduced motion has no offset. The feed's REC chip gets `testID="monitor-feed-timer"` |
| `src/runtime/index.ts:215-216` | Exports `isLinkSettling` and the timer helpers |

### 3.5 Tests

- `src/runtime/stall-tolerant-timers.test.ts` (13). It models the JS queue exactly (`src/runtime/testing/js-thread.ts`: tasks in arrival order, a stall lets time pass while nothing runs) and runs the **real** shared socket client on it:
  - plain timers: `STALE` then `ONLINE` after a 3.5 s stall, the device picture;
  - plain timers: SYNC_TIMEOUT, the socket given up, OFFLINE, when `hello` waits behind the tick;
  - stall-tolerant timers: neither happens;
  - a Core that really goes quiet is still STALE, and a missing `hello` still times out within the deadline plus one yield;
  - plus the rules: lateness bound, yield, at most 20 yields, cancel, interval period, foreign handles.
- `src/runtime/live-stall-link.test.ts` (1): the app's real `createMobileLive` on the JS-thread model. A 3.5 s stall while the Core beats leaves the link ONLINE and the socket kept.
- `src/features/session-live/live-client-restart.test.tsx` (4), on the Live source over the fake transport:
  - in the gap after SYNC_TIMEOUT the link reads settling, with no banner and actions usable;
  - the Core answers the next socket, and no "lost" frame appears at any step;
  - a Core that keeps not answering shows the banner;
  - a lost socket still shows the banner at once.
- `src/features/session-live/monitor-timer-drawn.test.tsx` (13). Every `useAnimatedStyle` keeps its first-render style forever (the worst case of Reanimated's loss, FX-M2b's model), and the drawn digit is read from the views' own transforms. In both motion policies:
  - mounted at 00:18:42, after 25 s the timer **draws** 00:19:07, and so does the feed chip;
  - a jump of 9 s and of 70 s draws the current time;
  - `nextCell` odometer cases.
  - Against the old `RollingNumber` the same test draws **00:18:42** after 25 s: the device defect.

```
npx jest src/runtime/stall-tolerant-timers.test.ts src/runtime/live-stall-link.test.ts \
         src/features/session-live/live-client-restart.test.tsx src/features/session-live/monitor-timer-drawn.test.tsx
→ 13 + 1 + 4 + 13 passed (also inside the mutation control run: 61 passed in the 6 files)
```

Mutants:

| Mutant | Result |
|---|---|
| P2-a `RollingNumber` back | DETECTED |
| P2-b column position only in the animated style | DETECTED |
| P2-c roll rests away from 0 | DETECTED |
| P3-a late callbacks run at once | DETECTED |
| P3-b unbounded yields | DETECTED |
| P3-d the app does not wrap its timers | DETECTED |
| P4-a no settling for a client restart | DETECTED |
| P4-b marker never set | DETECTED |
| P4-c every restart settles | DETECTED |
| **P3-c** "cancel ignored during a yield" | **MISSED**, equivalent: clearing also clears the inner yield timer, so the extra `cancelled` check in `fire` changes nothing on React Native or in the model |

### 3.6 On-device proof (final build, lane 1, after the relaunch)

| Check | Runs | Result |
|---|---|---|
| Starts watched (25 s recording from Start Recording) | 10 proper starts (F01–F04, F07–F12), 4 of them with a 3.5 s stall 7 s after the start (F01, F04, F07, F10) | **0 banner frames**; the debug handle read `hidden` 300 ms and 1 s after each stall; timer 0 → 14–20 s with **0 backward steps** (decoded on every frame) |
| Monitor before the stop (30 s recording) | 11 | 0 banner frames; 0 backward steps; after each of the 3 pre-stop stalls the debug handle read `hidden` |
| Stalls injected after the fix | 10 (4 at start, 3 before a stop, 3 after a stop) | 0 false banners (before the fix: 7 of 8) |

Per-run counts are in `12a_final_lane1_proof_runs.json`; a start with a stall is in `12a_final_F10_start_with_stall.mp4`. In F06 the start recording began at an elapsed time of 84 s (§5.1).

**R-S-2 on device.** 15 pairing hand-offs were watched frame by frame for the "unreachable" Login (red ring):

| Group | Hand-offs |
|---|---|
| Before the fix | hoA, hoB, hoA2, hoB2, hoS1 |
| With the withdrawn R-S-1 attempt | hoR1–R4, hoM1 |
| Final | hoF0–F5 |

Result: **0 frames** with the notice. Before the fix it did not reproduce either at this load, so the device does not distinguish before from after here. The fix rests on the mechanism and the jest models (§3.5), and the device shows no regression.

Each hand-off shows one frame of the empty boot anchor between the paired view and Login (mean 10.3; §4). Recording: `12a_final_F1_pairing_handoff.mp4`.

### 3.7 Residual risk

- A JS stall longer than about 1 s plus 20 × 50 ms postpones the deadline only by that bound; a very long stall can still end in STALE. The tick then runs after the queue, so only a Core that really sent nothing is judged lost.
- `RollingNumber` itself (shared component, not this row's path) keeps the exposure wherever it shows a long-lived value: the bottom Recording bar, Home, KPIs. Worth a follow-up.

---

## 4. R-S-1 (Medium): revoke-to-Pair, **not fixed**

### 4.1 Measurements (dems2_phone2, main)

Server revoke answer (host) to the first frame of the Pair screen. "Dark" means one uniform frame of the app background (the empty boot anchor, mean 10.3, sd 7.5). Device−host offset about −600 ms.

| Build | Tag | State | Host load | Revoke 200 (host) | → first Pair frame | Dark frame |
|---|---|---|---|---|---|---|
| before CF-M1 | A | signed out (Login) | ~5 | 14:42:19.311 | **776 ms** | no |
| | A2 | signed out | ~6 | 14:52:56.534 | **475 ms** | no |
| | B | signed in (Summary) | ~6 | 14:50:24.865 | **608 ms** | no |
| | B2 | signed in | ~6 | 14:54:14.312 | **584 ms** | no |
| | S1 | signed out, 80 % JS-starvation model (200 ms busy every 250 ms) | ~6 | 15:03:01.331 | **551 ms** | no |
| withdrawn in-place attempt | R1 / R3 | signed out | 10–17 | | 1,183 / 1,513 ms | no |
| | R2 / R4 | signed in | 10–17 | | 1,171 / 1,463 ms | yes (fade start) |
| | M1 | signed out | ~6 | 15:27:28.456 | **1,533 ms** | no |
| **final** | **F1** | signed out | ~12 | 15:45:15.580 | **1,303 ms** | yes |
| | **F2** | signed in | ~12 | 15:46:28.819 | **1,386 ms** | yes |
| | **F3** | signed out | ~11 | 15:47:28.920 | **1,532 ms** | yes |
| | **F4** | signed in | ~11 | 15:48:43.568 | **2,358 ms** | yes |
| | P2 (profiled) | signed out | ~11 | 15:51:32.221 | 2,393 ms | yes |

No revoke showed the "unreachable" Login (0 frames). Recordings: `12a_final_F1_revoke_signed_out.mp4`, `12a_final_F2_revoke_signed_in.mp4`; all rows in `12a_revoke_handoff_timings.jsonl`.

### 4.2 What delays it

**The suspects in the brief are off the path:**

- The Core's `device.revoked` reaches the app at once: the app's `auth.sessionEnd` log comes 25 ms after the server's answer.
- `endSession` then calls the app's `deviceUnpaired` synchronously (`bounded` calls the port inside its promise executor, `packages/shared/src/live/source/live-sim.ts:723-753`), which sets the pairing gate UNPAIRED before anything is awaited (`src/runtime/sim-adapters.ts`, `deviceUnpaired`).
- So no timer, no secure-store delete (awaited only after the flip), no gate snapshot (a map write) and no `SignedOutLanding` (it acts only after a sign-out of a signed-in operator) sits between the revoke and the route change.
- Signed-out is not intrinsically slower: 776 and 475 ms against 608 and 584 ms signed-in, at the same load.

**The time is one synchronous React commit on the dev build, and it scales with host load.** A Hermes CPU profile of the final build during a signed-out revoke (`12a_revoke_profile_summary.txt`, `12a_revoke_profile_final_build.cpuprofile.json`) shows, from `sessionEnd` to the Pair frame:

- 2,709 ms inside `performSyncWorkOnRoot`;
- of which Reanimated worklet registration in passive effects (`scheduleOnUI` 1,314 ms; `createSerializable` and `cloneWorklet` ≈550 ms; `reconnectPassiveEffects` 711 ms);
- Reanimated `_detachStyles` on unmount 444 ms;
- GC 923 ms;
- React DEV stack capture (`errorStackGetter` 722 ms, `createTask` 178 ms).

The guard drops `(auth)`, Expo Router falls back to the anchor `/`, and that empty screen is painted (the dark frame) before the redirect's Pair is drawn.

**The withdrawn attempt.** Drawing the Pair screen in place at the anchor (FX-M2's pattern) removed the dark frame in the signed-out case but **doubled** the Pair render inside the same synchronous task: M1 took 1,533 ms against 475–776 ms before, at the same load. It was reverted. The three files are byte-identical to their rollback copies (`SHA256SUMS.txt`, "RESTORED"); the new mark file and its test were moved out of the tree to `.cache/cf_m1/reverted/`. Its profile is in `12a_revoke_profile_withdrawn_inplace_pair.cpuprofile.json`.

### 4.3 Status and what would fix it (for the controller)

- W94's "< 1 s" holds at host load ≈5–6 (5 of 5) and fails at load ≥10 (6 of 6) on the debug build.
- A real fix means less synchronous work in that one commit:
  - fewer Reanimated registrations on the Pair screen's first frame (ambient loops, glow ring);
  - or a two-phase Pair render: a light first frame, the rest after paint;
  - plus a cheap Pair skeleton at the anchor instead of an empty frame.
- Or W94 could be measured on a release build, where the DEV stack capture (≈0.9 s here) does not exist.
- Both are design work beyond this row's budget. I recommend a follow-up row or a ruling.

---

## 5. Notes from the proof

### 5.1 Driver incidents (counted honestly)

- **F05 is invalid.** Under load the wizard's Start Recording tap was missed: no `start` request, the session stayed ARMED, and the web "stop" had nothing to stop.
- **F06 is a variant, not a clean run.** Its "Done" tap landed on that wizard and started the F05 session. Its next taps then hit the monitor and opened the phone's own End Session dialog (hold). The web stop came with that dialog open, and the hand-over to Finalizing was clean (frames in the sheet). It is counted as a web stop while the phone showed the monitor.
- **`screenrecord` hung** (stuck in a futex past its `--time-limit`) six times. Once (14:08–14:19) it also blocked the emulator's graphics, with `dequeueBuffer failed -110` from the app and SystemUI. The stuck process was killed (`kill -KILL` of the shell's own `screenrecord`), the display recovered, and a watchdog was added. Four final start recordings end early (F01, F06, F07, F09); their frames up to the hang were analysed.
- **Driver lifetimes.** One sign-in on phone2 failed (401, 15:38). The cause was not established; the driver now empties the username field before typing. That gave one AUTH_FAILED row on main. Two background drivers ended at their 30-min tool limit; the batches they had not answered were run again, and their revokes and pairings are counted only once.

### 5.2 Secrets and hygiene

- **The demo password** was read only inside the driver from `packages/shared/src/sim/dataset.ts` and never printed. Phone captures are refused until the sign-in is answered 200. Lane-1 recordings never include a sign-in; phone2 revoke recordings start at least 5 s after it.
- **Pairing codes.** 12 codes were issued under the blur mask, with the mask checked before each screenshot. Each code was typed digit by digit in one process and forgotten; each redeem was followed by a count-only scan (device JS log, server log, events): 0 hits each time. Hand-off recordings start only after the 201, when the slots are cleared.
- **Slip.** A uiautomator dump printed **one digit** of a code that had not been redeemed (B2's re-pair, 14:55, typed into the slot when the field kept only one digit). It appeared twice, in my own driver's batch output, events log and console log (`q_phone2/013.out`, `015.out`, `events.log`, the scratch `driver_phone2.log`) and in this session's tool output. It was redacted in place in all the files. The slot was cleared; the code was never redeemed and expired at 14:59:39. The driver now never prints slot text, clears the slots after a failed redeem, and refuses captures for the rest of that batch.
- **Final scan** of the outputs of this row (report, assets, progress file, driver queues): 0 password occurrences, 0 token shapes (§8).
- **Metro.** Seven `ERROR Connection from DevTools failed … origin 'undefined'` lines in `.cache/manual/metro.log` (13:54–13:56) are this row's first inspector attempts without an Origin header. Harmless; mentioned so nobody chases them.
- **Device rules.** No lock, PIN, fingerprint, settings, reverse rule, server, Metro or emulator was touched; emulator-5556 was never touched.

---

## 6. Changes (all files)

| File | Kind | Defect |
|---|---|---|
| `src/app/(app)/session/live.tsx` | edit | R-P-1 |
| `src/features/session-live/connection-banner.tsx` | edit | R-P-1 |
| `src/features/session-live/session-live-screen.tsx` | edit (banner slot) | R-P-1 |
| `src/features/session-live/timer-readout.tsx` | **new** | R-P-2 timer |
| `src/features/session-live/rec-indicator.tsx` | edit | R-P-2 timer |
| `src/features/session-live/live-feed.tsx` | edit (testID) | R-P-2 timer |
| `src/runtime/stall-tolerant-timers.ts` | **new** | R-P-2, R-S-2 |
| `src/runtime/sim-adapters.ts` | edit | R-P-2, R-S-2 |
| `src/runtime/ended-link.ts` | edit | R-S-2 |
| `src/runtime/sim-runtime-provider.tsx` | edit | R-S-2 |
| `src/runtime/index.ts` | edit (exports) | — |
| `src/runtime/testing/js-thread.ts` | **new** (test only) | tests |
| `src/features/session-live/live-handover-exit.test.tsx` | **new** | R-P-1 |
| `src/features/session-live/monitor-timer-drawn.test.tsx` | **new** | R-P-2 |
| `src/features/session-live/live-client-restart.test.tsx` | **new** | R-S-2 |
| `src/runtime/stall-tolerant-timers.test.ts` | **new** | R-P-2, R-S-2 |
| `src/runtime/live-stall-link.test.ts` | **new** | R-P-2 |
| `src/features/pairing/pairing-handoff-routes.test.tsx` | edit (`jest.setTimeout(30_000)`) | controller note |
| `src/features/pairing/pairing-live.test.tsx` | edit (`jest.setTimeout(30_000)`) | same class |
| `src/app/index.tsx`, `src/app/pair.tsx`, `src/features/pairing/pairing-live-static.test.ts` | edited, then **restored** byte-identical | withdrawn R-S-1 attempt |

---

## 7. Suite ledger

The full ledger is in `12a_suite_ledger.txt`.

| Command (in `apps/mobile`) | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 (16:13; again at 16:26 after the last test edit) |
| `npx eslint .` | exit 0 (16:13); the two edited pairing tests again at 16:26: exit 0 |
| `npm run test -- --maxWorkers=2`, run 1 (16:14, load 8–11) | 169 / 170 suites, 1,893 / 1,894 tests. 1 failure: `pairing-live.test.tsx` "423 countdown" exceeded jest's 5 s (passes alone). Fixed with a per-file timeout |
| `npm run test -- --maxWorkers=2`, run 2 (16:21, final tree) | **170 / 170 suites, 1,894 / 1,894 tests**, exit 0 |
| Mutation check (`12a_mut_mutate.py.txt`), unmutated control | 6 files, 61 tests pass; tree unchanged by the run (SHA-256 before and after) |
| Mutants | **14 / 15 detected**; P3-c equivalent (§3.5) |

---

## 8. End state

| Item | State |
|---|---|
| dems2_phone (emulator-5554) | LIVE, Core online, **Login, signed out** (budi's lane-1 session had idled out). The Demo operators section, which a stray tap had opened, was closed again. Capture `end_phone_login_final.png` (scratch) |
| dems2_phone2 (emulator-5558) | LIVE, **Login, signed out, paired to main as DEV-0019** (the only Paired row on main) |
| Roles | budi.santoso **INVESTIGATOR** on lane 1 and on main (`GET /api/v1/admin/users`, 16:22 and 16:24) |
| Recording | nothing: the current session is SEALED on both lanes |
| Browsers and drivers | all headless shells and drivers ended; profiles in `$TMPDIR` removed. The andi.pratama web sessions of the last checks idle out in 15 min (their browsers are gone) |
| Devices revoked | only phone2's own: DEV-0003 to DEV-0018 on main (16 revokes; every revoke and redeem is an audit row on main) |
| Secret scan of this row's outputs | 0 password occurrences, 0 `ses_`/`dvc_`/`bio_` token shapes |

---

## 9. Assets (`gateway_check/assets/12a_*`)

| Asset | What |
|---|---|
| `12a_prefix_stall_false_banner_frames.png` | Before the fix: E1, E3 and r2 frames, "Core link lost" and "Resynced" after a stall |
| `12a_prefix_stall_timer_revert_frames.png` | Before the fix: 00:03:28, then 00:03:23 (mount digit), then 03:29 |
| `12a_prefix_E3_stall_banner_then_web_stop.mp4`, `12a_prefix_E2_stall_timer_revert.mp4` | The two recordings above |
| `12a_final_handover_frames_11_runs.png` | Last monitor frame and next frame of the 11 final web stops |
| `12a_final_lane1_proof_runs.json` | Per-run facts F01–F12: banner, blank and red frames, decoded timer and backward steps, hand-over, debug readings, crash lines |
| `12a_final_F01_web_stop_after_stall.mp4`, `12a_final_F03_web_stop_then_stall.mp4`, `12a_final_F12_web_stop_plain.mp4`, `12a_final_F10_start_with_stall.mp4` | Final lane-1 recordings (device time on every frame) |
| `12a_final_F1_revoke_signed_out.mp4`, `12a_final_F2_revoke_signed_in.mp4`, `12a_final_F1_pairing_handoff.mp4` | Final phone2 recordings |
| `12a_revoke_handoff_timings.jsonl` | Every revoke and hand-off: offsets, server answer, first change, first Pair frame, dark frames, "unreachable" frames |
| `12a_revoke_profile_summary.txt`, `12a_revoke_profile_final_build.cpuprofile.json`, `12a_revoke_profile_withdrawn_inplace_pair.cpuprofile.json` | Hermes CPU profiles of a revoke |
| `12a_mutations.log`, `12a_suite_ledger.txt` | Mutation results; typecheck, lint and suite |
| `12a_driver_cfq.mts.txt`, `12a_proofbatch.sh.txt`, `12a_proofloop.sh.txt`, `12a_cycle.sh.txt`, `12a_revokeloop.sh.txt`, `12a_final_phone2.sh.txt`, `12a_run.sh.txt`, `12a_send.mjs.txt`, `12a_rollback.sh.txt` | The drivers |
| `12a_tools_*.py.txt`, `12a_tools_*_templates.json` | Frame and timing analysis tools, with their digit templates |
| `12a_mut_*.txt` | The in-memory mutation harness |

Raw captures (every frame, native logs of 40–320k lines, the pre-fix runs, the code-mask web screenshots) stay in the session scratchpad.
