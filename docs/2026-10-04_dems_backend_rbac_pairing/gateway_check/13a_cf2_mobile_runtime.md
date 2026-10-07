# CF2-A: mobile runtime (frozen monitor timer, stale monitor after an early web stop, empty frames, Login stuck after idle sign-out, Reanimated warnings)

| Field | Value |
|---|---|
| Row | CF2-A of the second closing round CF2 (decisions D218, D227, D234; test depth D232/D233: 2 runs + 1 verification) |
| Defects | RF-PH-1 = RF-T-3 (Medium), RF-PH-2 (Medium), RF-PH-3 = RF-T-4 (Low), RF-PH-4 (Medium, intermittent), and the investigation of the Reanimated `Unable to find SurfaceMountingManager` warnings |
| Agent | coder-execution |
| Time | 2026-10-06 20:39-22:10 WIB |
| Status | **needs-review.** RF-PH-1: fixed in mechanism. The 5-21 s holds are gone. Lag measured from the frames: 1.3-2.4 s at load 6-7, up to 4.3 s at load 10 (by this measure a perfect timer already reads up to 1 s behind, see §1.4). The rest is JS-thread time of the debug build. RF-PH-2: partly fixed. The 71 s tail is gone; the stale monitor lasted 0.5, 0.6 and 4.1 s in 3 early stops. RF-PH-3: Ready -> monitor fixed (0 empty frames in 9 starts). Sealed -> Summary now draws the Summary in place at the seal. One empty frame remains at the later route swap (5/5), and its fix is in `navigation/` (CF2-B's path). RF-PH-4: fixed in mechanism (jest, worst-case model); 1 device idle expiry was normal. Warnings: sources found; none can be removed in my paths |
| Narrative tier | 2: what was found, why it matters, how it was verified, source |
| Device | dems2_phone = emulator-5554 only (lane 1: Core 4421, web 5176). emulator-5556 and emulator-5558 were not touched |
| Rollback | `.cache/rollback/CF2-A/`: 18 pre-edit copies, `SHA256SUMS`, and `NEW_FILES.txt` (10 new files; rollback = delete them) |
| Assets | `assets/13a_*` (64 files, 24 MB; §8) |

Path note: `src/…` means `apps/mobile/src/…`. Line numbers refer to the tree as it is now. Device times are the host minus 0.39-0.44 s (`p clock` in each run).

---

## 0. Method

- **Driver.** RF-PH's queue driver (`test/assets/retest2/ph/rf_driver_rfq.mts.txt`), copied and cut down to emulator-5554 only: no phone2 lane, no revoke, no pairing code (`assets/13a_driver_cfq.mts.txt`). It keeps RF-PH's credential rules:
  - the demo password is imported from the dataset module (never grepped, printed or written);
  - it is typed only into a focused password editor;
  - no capture within 2.5 s of typing it, nothing before a 200;
  - every output is redacted.
  The web console was the Playwright-cache headless shell on 127.0.0.1:5176 with an OS-assigned CDP port and an `lsof` ownership check (`13a_relaunch_signin_batch_out.txt`).
- **Runs.** budi.santoso (investigator) starts on the phone's wizard. andi.pratama (supervisor) stops on the web, either about 30 s after the start (`s30`, for the timer) or at once (`xearly`, aiming at "Starting...", for RF-PH-2). One screenrecord covers start -> stop -> Summary.
- **Analysis.** RF-PH's frame tools, unchanged: the timer decoded by glyph templates, lag = Core elapsed at the frame's host time minus the drawn value, and empty frames found in the app area (`13a_driver_an.sh.txt`).
- **App build.** The app was force-stopped and relaunched once with `demsdemo:///login?core=LIVE&motion=off` at 21:09:36, so the changed bundle was loaded; later edits came in by Fast Refresh.
  - Fast Refresh was checked: the in-place Summary appeared from C2 on, and the D1 tick log came from the then-current code.
  - The final ticker (§1.3) was in place from P1 on.
- **Runs that count.**
  - RF-PH-1: P1, P3, then verification V1.
  - RF-PH-2: C2, P2, then verification V2.
  - C1, C3 and D1 were diagnostic runs on earlier states of the timer code. C3 also has `dumpsys` calls, which stall the UI thread.
- **Host load** at each run start: 6-11 (`uptime`, and `load` in each batch). Nothing ran on *:5432. No server, Vite, Metro, mock-core or emulator was started or stopped. No adb reverse, settings, lock, PIN or fingerprint change; no Hermes inspector. No uiautomator dump at all; `dumpsys activity top` (class, bounds and id, no text) was run on the wizard, monitor and Finalizing only, in C3.

## 1. RF-PH-1 (= RF-T-3): the monitor timer held behind the Core under load

### 1.1 Mechanism (three causes, file:line)

1. **The stall-tolerant yields compounded.** `src/runtime/stall-tolerant-timers.ts` (CF-M1) yielded a late callback 50 ms at a time, up to 20 times. On a starved thread each yield is itself late, so with every task 400 ms late a callback slipped 20 x 450 ms = **9.4 s**, not the "about a second" its header promised.
   - The Live source's store clock is a 100 ms `setInterval` on those timers (`packages/shared/src/live/source/live-sim.ts:2568`). The monitor timer read that clock (`use-monitor.ts`, old lines 78-80).
   - In the JsThread model this gave 3 clock publications in 30 s.
   - Jest: `runtime/stall-tolerant-timers.test.ts`, "a thread starved for good…", fails on the original with 9,400 ms against a bound of 1,850 ms.
2. **The Live clock held after late-handled heartbeats.** `packages/shared/src/live/source/clock.ts:32` and `live-sim.ts:816`: the newest sample sets the offset, and the clock never moves back. A sample is `serverTime` against the local instant the **JS thread handled** the message. A heartbeat that waited in the queue therefore lowers the offset, and `now()` stands still.
   - Jest model: every heartbeat handled 8 s late. On the original, the drawn timer advanced **0 s in 6 s** (`live-monitor-timer-core-clock.test.tsx`: Expected >= 5, Received 0).
3. **The redraw waited in React's queue.** A diagnostic run, D1 (temporary `console.log`, since removed; `13a_run_D1_diag_tick_log.txt`), showed the tick computing the right second at device 11.349, 12.105, 13.053, 14.045 and 15.080. The frames drew it 0.37-0.75 s later (`13a_run_D1_frame_analysis.json`): a plain `setState` from a timer waits behind the socket's work.

### 1.2 Why it matters

The operator saw a frozen recording timer (00:00:00 for up to 21 s) while the Core recorded. RF-T-3 saw the same on the tablet.

### 1.3 Change

- `src/runtime/stall-tolerant-timers.ts:61, 76-89`. New wall-time bound `STALL_MAX_POSTPONE_MS = 1_000`: no yield starts later than 1 s after the callback first fired late, whatever each yield's own lateness. The CF-M1 rule (let the queue go first once) stays.
- `src/runtime/core-clock.ts` (new) is the Core clock a running display re-reads.
  - It returns `max(Live clock, local clock + the highest offset seen in the last 60-120 s)`. A queued sample can only lower the offset, so the highest is the best lower bound, and the clock never runs ahead of the Core.
  - It is created per Live source and fed at every store-clock publication: `src/runtime/sim-adapters.ts:732-737`, through `coreClockOf(sim)`.
  - It uses the PLAIN timers, not the stall-tolerant ones.
- `src/features/session-live/use-monitor.ts:93-160`. In LIVE, `useMonitorElapsedSeconds` = max(store clock value, `createElapsedTicker`).
  - The ticker re-reads the Core clock every 250 ms (sooner before a new second; `msToNextSecond` in `session-live.math.ts:101`).
  - It is an external store for `useSyncExternalStore`, which React renders at the end of the tick's task.
  - The value only grows, and the timer runs only while subscribed.
  - SIMULATED and HEARTBEAT are unchanged (store clock only).

### 1.4 Device proof (frames; lag includes the 0-1 s floor of whole seconds)

| Run | Kind | Load | Monitor frames (decoded) | Max lag | Frames > 2 s | Backward steps | Banner |
|---|---|---|---|---|---|---|---|
| RF-PH before (R09, R10) | s30 | 9-14 | - | 19.5, 21.0 s | lag > 2.5 s in 12/14 recordings | 0 | 0 |
| P1 (run 1) | s30 | 7.1 | 498 (498) | **1.43 s** | 0 | 0 | 0 |
| P3 (run 2) | s30 | 6.1 | 380 (380) | **2.37 s** (at 00:00:00, the first second after the monitor appeared) | 17 | 0 | 0 |
| V1 (verification) | s30 | 10.0 | 399 (399) | **4.27 s** at 00:00:00 right after the mount; then 3.86, and ≤ 2.83 | 97 | 0 | 0 |
| C1 (diagnostic, 1 Hz tick) | s30 | 7-10 | 967 (967) | 1.30 s | 0 | 0 | 0 |
| C3 (diagnostic, with `dumpsys`) | s30 | 6.7 | 347 (347) | 3.23 s | 35 | 0 | 0 |
| D1 (diagnostic, tick log) | e5 | 5.9 | 119 | 1.85 s | 0 | 0 | 0 |

How V1 reads (`13a_rfph1_V1_timer_catches_up_in_jumps.png`):

- The timer goes 0 -> 3 -> 6, straight to the Core's value, at each JS turn the thread got. The value is right; the turns are missing.
- In C3, at the moment of the hold (`13a_rfph1_C3_timer_and_feed_stamp_during_hold.png`), the feed's own JS 1 Hz stamp was also about 1.5 s behind.

Against the brief's "within about 1 s even under load":

- **Met at load 6-7** (P1: latency ≤ 0.43 s beyond the floor).
- **Not met at load 10** (V1: 2-3 s, mostly in the 3 s after the monitor appeared).
- The residual is JS-thread time of the DEBUG build: the monitor's first render, and the socket's work. No JS-drawn value can beat it.

### 1.5 Tests

Fail-before / pass-after checks used a jest config that maps the module to its pre-edit copy. The working tree was not edited.

| Suite | Before (original mapped) | After |
|---|---|---|
| `runtime/stall-tolerant-timers.test.ts` (16) | 3 failed (9,400 ms > 1,850; 3 publications in 30 s; bound constant missing) | 16 passed |
| `features/session-live/live-monitor-timer-core-clock.test.tsx` (2) | 1 failed (timer advanced 0 s in 6 s) | 2 passed |
| `runtime/core-clock.test.ts` (4) | new module | 4 passed |
| `features/session-live/elapsed-ticker.test.ts` (3) | new module | 3 passed |

Mutants (in memory), all caught:

- (a) ticker back to 1 Hz: 1 failed;
- (b) no never-backwards max in the ticker: 1 failed;
- (c) Core clock without the best offset: 2 failed;
- (d) hook without the ticker: 1 failed;
- (e) yields without the wall-time bound: 2 failed.

Mutants (a) and (b) first survived. `elapsed-ticker.test.ts` was strengthened (a clock jump must show within 250 ms; a clock read that goes back must not lower the value), and both are caught now.

### 1.6 Residual risk

- Under load ≥ 10 in the debug build the timer is still 2-4 s behind, mainly in the 3 s after the monitor mounts.
- A release build (W98) should be measured before calling this closed.
- The shared clock's own hold is NOT changed: `packages/shared` is outside this row. The Core clock works around it for the monitor only. Other Live-clock readers, such as countdowns, still see the hold.

## 2. RF-PH-2: stale "Recording" monitor after a web stop during "Starting..."

### 2.1 Mechanism

Two parts:

- **The long tail (once about 71 s): fixed.** The socket client's housekeeping (sending a pending `resync`, the sync deadline) and the command gate's settle timeout run on the stall-tolerant timers. With the compounding of §1.1, a resync could go out tens of seconds late, and deltas are dropped while a resync is pending (`packages/shared/src/realtime/live-socket-client.ts`, header rows CL-11 and "delta while a resync is pending"). The wall-time bound caps that at about 1 s.
- **The remaining window: the JS stall right after the monitor's first render.**
  - In P2, the Core stopped at 21:39:01.073, 0.81 s after its start.
  - The phone drew the monitor at 02.187. It stayed until 06.274, its timer showing **00:00:00 for all 4.1 s** (`13a_rfph2_P2_early_stop_frames.png`). With the §1.3 ticker it would have counted 1-2-3-4, so the JS thread ran nothing in those 4 s.
  - The stop delta, already queued, was handled after that: the route sync logged FINALIZING at device 21:39:09.218 and SEALED at 21:39:23.893, 16 s after the Core's seal (`13a_run_P2_device_js_log.txt`).
  - The in-place hand-over (`src/app/(app)/session/live.tsx`) then drew Finalizing at once.

### 2.2 Device proof

| Run | Core start -> web stop | Monitor of the stopped session drawn | Next frame |
|---|---|---|---|
| RF-PH before (R05, R17, R08, R11) | early | 2.7 s, 4.5 s, 7.1 s, **≥ 32 s** (route resync at about 71 s) | Finalizing |
| C2 (run 1) | 0.39 s | 21:22:50.091-50.708 = **0.6 s** | Finalizing |
| P2 (run 2) | 0.81 s | 02.187-06.274 = **4.1 s** (load 9.3) | Finalizing |
| V2 (verification) | 0.42 s | 12.317-12.784 = **0.5 s** (load 11) | Finalizing |

0 crashes, 0 banners, 0 backward steps in all three.

### 2.3 Tests

- The stall-tolerant suite above (housekeeping and resync deadlines run on those timers).
- No separate jest model of the 4 s first-render stall: it is not reachable without a device.

### 2.4 Residual risk

**Not fully fixed.** While the debug build's JS thread is busy with the monitor's first render, the monitor shows a session the Core has already stopped, for the length of that stall (0.5-4.1 s in 3 runs at load 9-11).

The cure is outside this row:

- a lighter first render of the monitor (session-live screen structure, a larger change);
- the release-build measurement in W98;
- or, in `packages/shared`, handling socket messages ahead of render work.

The replica learning the seal late (5-16 s after the Core in P1-V2) is the same cause.

## 3. RF-PH-3 (= RF-T-4): single empty frames at Ready -> monitor and Evidence sealed -> Summary

### 3.1 Mechanism

- **Ready -> monitor.** Every monitor region (header, feed, meters, tiles, End Session) entered with `enterRise`, from opacity 0, in the very commit in which the start hand-off's stack replace dropped "Starting..." (`session-live-screen.tsx`, old 449-655). The Finalizing hand-over had no empty frame because its incoming screen skips the enter motion (`session-finalizing/handover.ts`, D201).
- **Evidence sealed -> Summary.** Not the Summary's content: with the cards drawn in place, the next frame after the empty one is the complete Summary, header included (`13a_rfph3_C1_sealed_to_summary_blank_frame.png`).
  - Route sync called `router.replace` at device 21:17:25.014 (C1). The Summary appeared at host 27.474, after about 2 s of JS work, as a hard cut with one 34 ms empty frame.
  - Ready -> monitor, by comparison, is a native cross-fade (`13a_rfph3_C1_ready_to_monitor_crossfade.png`).
  - After drawing the Summary in place (below), the empty frame moved to the later swap between two identical Summary frames (`13a_rfph3_C2_summary_in_place_then_blank_at_route_swap.png`: f_094 Summary, f_095 empty, f_096 Summary; 7.5 s after the replace).
  - So it is the native-stack replace of that heavy route on a starved UI thread. The SessionFlowStack uses `animation: stackAnimation('tabs')` = `'fade'` (`src/navigation/stacks.tsx:43`, `src/motion/builders.ts:330/339`).

### 3.2 Change

- `src/features/session-live/monitor-handoff.ts` (new) and `session-live-screen.tsx:122, 456, 542`. After the start hand-off's mark (`session-new-screen.tsx:257`) the monitor draws its regions in place (no `entering`). A Home banner or a deep link keeps the entrance.
- `src/features/session-summary/summary-handoff.ts` (new) and `session-summary-screen.tsx:103, 254`, plus `session-finalizing-screen.tsx:89, 108`.
  - Sealed with the summary pending, the Finalizing route draws the Summary **in place** (the D201 recipe). The route follows by the route sync or the 1.2 s hand-off.
  - The Summary opened by that hand-off has no card rise.
  - The SEALED stamp still plays once.
- **Behaviour change.** Without route sync, the step-80 fallback "Evidence sealed / Opening the session summary…" card for 1.2 s is replaced by the in-place Summary. `session-finalizing-screen.test.tsx` was updated to match. With route sync (the app), the card was only ever visible because of latency.

### 3.3 Device proof

| Route change | RF-PH before | After (C1, C2, C3, D1, P1, P2, P3, V1, V2) |
|---|---|---|
| Ready -> monitor | empty frame in 7/18 | **0/9** (C1 shows a native cross-fade, the monitor complete from its first frame) |
| Evidence sealed -> Summary | empty frame in 9/18 | Summary drawn in place at the seal from C2 on. **1 empty frame per run (9/9)**, at the later route swap between identical frames (C2 f_095, P1 f_578, P2 f_134, P3 f_456, V1 f_477, V2 f_090) |
| monitor -> Finalizing | 0/16 | 0/9 (handover next frame never blank) |

### 3.4 Tests

| Suite | Before | After |
|---|---|---|
| `session-live/monitor-handoff-in-place.test.tsx` (3) | 1 failed (rising regions still declared after the mark) | 3 passed |
| `session-new/live-start-handoff-in-place.test.tsx` (2, both arrival orders, real Live source) | 2 failed (not marked) | 2 passed |
| `session-summary/summary-handoff-in-place.test.tsx` (3) | 2 failed (rising cards still declared) | 3 passed |
| `session-finalizing/session-finalizing-screen.test.tsx` (updated case) | - | passed |

Control cases (opened from Home, a deep link, another session's mark) pass both before and after.

### 3.5 Residual risk and hand-over

- One empty frame (30-70 ms) remains at the Summary route swap under load.
- The likely fix is to give the session flow's Summary screen `animation: 'none'`: the content is identical, so a fade adds nothing. That means a `Stack.Screen` option in `src/navigation/stacks.tsx` `SessionFlowStack`, which is CF2-B's path.
- The route files cannot set the incoming transition in time (options set from inside a screen apply after its mount).
- **Proposed to the controller for CF2-B or a later row.**

## 4. RF-PH-4: Login showed only the emblem after an idle sign-out

### 4.1 Mechanism

The stuck frame (`test/assets/retest2/ph/rfph4_login_emblem_only_48s_after_idle_sign_out.png`) is the full Login layout with **exactly** these parts missing:

- the backdrop, wordmark, caption, card and companions.

Those are the parts whose opacity lives only in Reanimated shared values (`use-login-choreography.ts`: `backdrop`, `wordmark`, `caption`, `cardOpacity`). React holds the value they were mounted with: 0. The emblem, which React holds at scale 1 for `enter`, was drawn.

It is the lost-update family of D214:

- Login mounted while the JS thread was stalled (the 8 s `getAuthSession` time-out was logged 10 s late);
- Reanimated's direct updates fail for views it cannot find (`Unable to find SurfaceMountingManager for tag`, §5);
- the settled values a stalled thread does not take back within 2 s are dropped;
- nothing re-renders Login by itself.

In jest, under the worst-case model (every `useAnimatedStyle` keeps its first value; the same model as CF-M1's timer test), the original Login draws the username field, Sign In and the backdrop at opacity **0** after the entrance: the device picture.

### 4.2 Change

`src/features/login/use-login-choreography.ts:69-100, 115-125, 213-243`.

- After `entranceEndMs` (the last beat plus 250 ms: 1.9 s `enter`, 1.4 s `return`, 0.41 s reduced, x10 in proof mode), set by a plain timer, every part is drawn from a style whose **React value is its resting value** (opacity 1, no rise, no flight).
- The shake and the exit stay animated on top (their first value has `exit` and `shakeX` at 0).
- Whatever Reanimated drops, the next commit draws a usable Login.

### 4.3 Tests

`features/login/login-entrance-rest.test.tsx` (6):

- before (original mapped): **6 failed**, "Expected 1, Received 0";
- after: 6 passed;
- mutant (f), card style not switched to rest: 5 failed.

### 4.4 Device proof (1 idle expiry, as the brief allows when the mechanism is proven in jest)

| Step | Time (host) | Evidence |
|---|---|---|
| Phone left on V2's Summary, signed in; web andi idle too (both last acted at about 21:47:12, as in the original case where both expired together) | 21:50:07 | `13a_rfph4_i00_phone_idle_start_on_summary.png` |
| Core: `GET /auth/session 401 NOT_SIGNED_IN` and both sockets closed; app `auth.sessionEnd` `IDLE_EXPIRED` at device 22:02:11.423 | 22:02:11.8-12.1 | `13a_rfph4_idle_batch_out.txt` |
| Full Login with the "Session expired" dialog | 22:03:03 (+50 s), 22:04:08 (+2 min), 22:06:10 (+4 min) | `13a_rfph4_i01…`, `i02…`, `i03…` |
| Dialog dismissed: Login with "Your session expired after 15 minutes…", Core online | 22:06:32 | `13a_rfph4_e01_end_phone_login_signed_out_live.png` |

The stalled variant (the 8 s `getAuthSession` time-out) did not occur in this run; the probe was answered at once. Without a JS-stall injection (not allowed) it cannot be forced. The proof of the fix is therefore the jest model plus 1 normal device run (**1 of 1**).

### 4.5 Residual risk

- The "Session expired" dialog itself is `src/auth/auth-dialogs.tsx` (the HeroUI Dialog, not in my paths). Its own entrance is a kit animation (disabled under reduced motion, which is how the demo runs).
- A lost update there would hide the dialog, not the form.

## 5. Reanimated "Unable to find SurfaceMountingManager" warnings (investigation)

| Run | Warnings | Bursts (device time) |
|---|---|---|
| C1 | 1,093 | wizard step 1 -> 2: 12 tags x 42; monitor -> Finalizing and after: 85 tags x 15 |
| C2 | 1,643 | wizard: 12 x 42; hand-over: 44 x 5; Finalizing: 60 x 15; just before the Summary: 12 x 44 |
| C3 | 1,488 | wizard: 12 x 40; in-place Finalizing swapped for the route copy: 12 x 5; Finalizing: 60 x 15; Summary: 12 x 44 |
| P2 | 1,616 | the same pattern |
| V1 | 1,475 | the same pattern |

The counts are the same in every run, so the pattern is structural (`13a_reanimated_warning_bursts_C1_C2_C3_P2_V1.txt`).

**Tags mapped to views** (Fabric view id = React tag, from `dumpsys activity top` in C3; `13a_reanimated_tags_mapped_to_views_C3.txt`):

- **Finalizing swap (12 tags):**
  - the six 84x84 step badges and the 6x48 connector fills of the C-4 Stepper in the **in-place** Finalizing copy;
  - present in the dump 0.5 s before the swap;
  - updated by `src/components/composed/stepper.tsx:229` (`ConnectorHalf` `fillStyle`) and `:284-285` (`StepBadge` `ringStyle` / `haloStyle`), with the kit `Spinner` (`:323`).
- **Wizard step 1 -> 2 (12 tags, 4 of them mapped):**
  - views of step 1: a 147x147 view at the case field's right end (the scan icon button, HeroUI `Button`), plus 105x105 and two 42x42 children (kit press-feedback views);
  - `src/features/session-new/session-info-step.tsx` (the scan button) inside the HeroUI kit (`node_modules/heroui-native`).
- **60 x 15 during Finalizing and 12 x 44 just before the Summary: not mapped.** They were created after the last dump. By timing (hypothesis, not proven) they are the Finalizing route copy's pipeline and session card, and the in-place Summary's pipeline card (the same Stepper).

**Mechanism (supported by the mapping, the exact Reanimated internals not verified).** UI-thread updates still target views that a swap has just removed (in-place copy -> route copy, wizard step -> step), or not yet attached. Reanimated catches the `RetryableMountingLayerException` and logs it. It has no visible effect, except where the lost final value was the only value: Login (RF-PH-4, fixed by React-held rest values) and the CF-M1 timer digits (D214).

**Removable in my paths: none without undoing the in-place hand-overs.** Those hand-overs are what remove the empty frames, and they cause the swaps. The sources are `components/composed/stepper.tsx` and the HeroUI kit, outside both CF2 rows. Suggested owner fix: give the Stepper's animated views React-held rest values (as `TimerReadout` and Login now have), and skip animation work in an in-place copy.

## 6. Verification ledger

| Check | Command | Result |
|---|---|---|
| Owned-area suites (before the last edits) | `npx jest --maxWorkers=2 src/features/{session-live,session-new,session-finalizing,session-summary,login} src/runtime` | 67/68 suites, 717/718 tests. 1 failure: `summary-live-static.test.ts` lists the production files and did not know `summary-handoff.ts`. Its list was updated; 10/10 after |
| Full mobile suite, once (load 6.2 at start, 9.7 at end) | `npx jest --maxWorkers=2` (21:50-21:55) | **181 suites, 1,931 tests, all passed** (285.6 s) |
| After the final ticker and the step-80 test update | `npx jest src/features/session-live`; `npx jest src/features/session-finalizing src/features/session-summary`; `npx jest src/features/session-live/elapsed-ticker.test.ts` | 112/112; 66/66; 3/3 |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Lint | `npx eslint .` | exit 0 |
| Mutation (in memory, mapped module copies) | 6 mutants (a)-(f), plus the fail-before checks of §1.5, §3.4, §4.3 | 6/6 caught, after strengthening the ticker test for (a) and (b) |
| Evidence scan | count-only scan of the 47 text assets for the demo password (imported constant) and `ses_` / `dvc_` / `bio_` token shapes | 0 and 0 |

The full suite ran after the timer code of P1 and before the strengthened ticker test and the final mutant round. The later edits are tests only, plus `use-monitor.ts`, whose suites were re-run (row 3).

## 7. Slips, deviations, end state

- **C1, first attempt.** At load 15.1 the scripted wizard taps misfired: the Summary's Done was slow, and a later tap landed on the Evidence tab. No session was created by it (`create NOT SEEN`). The driver was then run step by step with captures, and the wizard got longer waits.
- **The driver was restarted once** (21:27) to add the read-only `viewdump` command. Its browser was closed at the stop and opened again (fresh profile, ownership checked).
- **Diagnostic code.** A temporary `console.log` (`[CF2A-DIAG]`, `__DEV__` only) was in `use-monitor.ts` for run D1 only and is removed. `grep -rn CF2A-DIAG apps/mobile/src` finds nothing.
- **Rollback gaps, recovered.**
  - `features/session-live/session-live.math.ts` was edited before a copy was taken. Its diff against HEAD is only this row's 16 added lines, so the copy is `git show HEAD:…`.
  - `summary-live-static.test.ts` was edited before a copy; the copy is the current file minus the one added line.
  - `session-finalizing-screen.test.tsx` was copied before its edit.
- **Test runs:** 9 recorded runs instead of 6 (2 + 1 per defect). C1, C3 and D1 were needed to find the second and third causes of §1.1. No repeated loops.
- **End state** (22:06:32, `13a_end_state_batch_out.txt`, `13a_rfph4_e01_end_phone_login_signed_out_live.png`):
  - emulator-5554 is on Login, LIVE ("Core online"), signed out;
  - the last session (V2, SES-20261006-0086) is SEALED: nothing recording;
  - the web console is signed out by the idle expiry (`GET /session/current` 401) and the browser is closed (driver ended, process gone);
  - no commits.

## 8. Assets (`gateway_check/assets/13a_*`)

| Files | What |
|---|---|
| `13a_driver_cfq.mts.txt`, `13a_driver_{genrun,wizard,finish,an,run}.sh.txt` | the driver (emulator-5554 only) and the run and analysis scripts |
| `13a_run_{C1,C2,C3,D1,P1,P2,P3,V1,V2}_driver_out.txt` | redacted driver output per run (taps, log waits, web times, session row, Core lines) |
| `13a_run_*_frame_analysis.json`, `13a_run_*_timer_lag.json`, `13a_run_*_empty_frames.json` | per-recording frame facts, timer lag, empty frames |
| `13a_rfph1_V1_timer_catches_up_in_jumps.png`, `13a_rfph1_C3_timer_and_feed_stamp_during_hold.png` | RF-PH-1 frames |
| `13a_run_D1_diag_tick_log.txt` | the tick's device times (diagnostic code, removed) |
| `13a_rfph2_P2_early_stop_frames.png`, `13a_rfph2_V2_early_stop_frames.png`, `13a_run_P2_device_js_log.txt`, `13a_run_P2_early_web_stop.mp4` | RF-PH-2 |
| `13a_rfph3_C1_ready_to_monitor_crossfade.png`, `13a_rfph3_C1_sealed_to_summary_blank_frame.png`, `13a_rfph3_C2_summary_in_place_then_blank_at_route_swap.png`, `13a_run_C2_early_web_stop_summary_in_place.mp4` | RF-PH-3 |
| `13a_rfph4_i00…i03_*.png`, `13a_rfph4_e01_*.png`, `13a_rfph4_idle_batch_out.txt` | RF-PH-4 idle expiry |
| `13a_reanimated_warning_bursts_C1_C2_C3_P2_V1.txt`, `13a_reanimated_tags_mapped_to_views_C3.txt` | §5 |
| `13a_run_V1_s30_load10.mp4`, `13a_c00_phone_before.png`, `13a_c02_after_signin.png`, `13a_relaunch_signin_batch_out.txt`, `13a_end_state_batch_out.txt` | context and end state |

Extracted frame folders were not copied; the `.mp4` files and the scripts reproduce them.
