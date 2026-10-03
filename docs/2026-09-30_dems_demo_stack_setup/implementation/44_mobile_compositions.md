---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: coder-execution
step: 71 (blueprint row 71; 05_mobile_plan M-04)
lane: mobile-B, Metro 8082 (P4)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/02_structured.md (row 71)
narrative_tier: 3
status: completed
---

# Step 71: mobile compositions and asset renderers (M-04)

## 1. Outcome

Step 71 is done. It built the five custom compositions (C-1 GlowRing, C-2 DbfsMeter, C-3 SessionTimeline, C-4 Stepper and C-6 RollingNumber), each with a pure-maths module and tests. It also built the three asset renderers (CameraFeed, Emblem/EmblemDraw and HeroBackdrop) with placeholder image and path data, and the debug-only route `src/app/dev-gallery.tsx`.

Every composition takes the motion policy as a prop, `motion: 'full' | 'reduced'`, which has the same shape as step 69's `useMotionPolicy()`. `reduced` is also the D43 test switch: ambient loops stop, and the meters keep working.

All per-frame motion runs on the UI thread, through Reanimated worklets and Skia props. No React render happens per animation frame.

| Acceptance (row 71) | Result | Evidence |
|---|---|---|
| T-M09 passes (MA-16: 1 meter render for 40 frames) | **PASS** | §4.1: `renders once while 40 audio frames stream through its shared values` ✓ (Profiler commits = 1) |
| No React state in `dbfs-meter.tsx` (MA-16) | **PASS** | `grep -rnE "useState\|setState" …/dbfs-meter.tsx` → no output, exit 1 |
| `useAudioChannel` only in `src/runtime/` (MA-16) | **PASS** | `grep -rn "useAudioChannel" apps/mobile/src \| grep -v runtime/` → exit 1 |
| MA-23 listing shows only C-1..C-6 under `components/composed` | **PASS** | §4.2 (only files of glow-ring, dbfs-meter, session-timeline, stepper and rolling-number; C-5 `nav/` belongs to step 70) |
| Dev-gallery screencaps on both AVDs after step 67's reinstall | **PASS** | §5; 24 PNGs; step 67 log line "NATIVE REINSTALL DONE (02:38:10 WIB)" |
| Mobile typecheck, lint and jest exit 0 | **PASS** | §4.3 |

## 2. Files (all created by step 71; P6 write set)

| Path (under `apps/mobile/src/`) | Kind | Content |
|---|---|---|
| `components/composed/glow-ring.tsx` | C-1 | Skia ring: rotating tick ring (60 s), 6 bracket arcs trimming open (900 ms `luxe`, 120 ms apart), inner ring sweep with a travelling spark, breathing blur copy (0.55 ↔ 1, 2.4 s), state colour morph (600 ms) + one bloom on escalation, REC arc pulse (1.2 s); modes login/hero/mini (mini: no rotation); `sweepDelayMs`, `replayKey`, `paused`, centre slot |
| `components/composed/glow-ring.math.ts` | maths | size ranges, geometry, 72 ticks, arc layout, sweep schedule (≤ 1.5 s), state tones, escalation rule |
| `components/composed/dbfs-meter.tsx` | C-2 | Skia segments fed by shared values (`level`, optional `peak`, `clip`); the `meter` spring runs on the UI thread; the peak marker holds 1.5 s then falls at 20 dB/s; 4 Hz Skia readout; CLIP chip pops with the `bouncy` spring and flashes once (180 ms); NO SIGNAL fade (400 ms) with a dashed flat line; monitoring-paused dim (0.35); variants card/large/compact, horizontal/vertical. **No React state** |
| `components/composed/dbfs-meter.math.ts` | maths | thresholds (−60…−2), tones, segment opacity `[t−1, t] → [0.12, 1]`, peak hold/decay, throttles, layout, peak offset |
| `components/composed/session-timeline.tsx` | C-3 | RN rail + kit `Typography`. First render: R1 stagger. Insertion: line `scaleY` (320 ms) → node pop (`bouncy`) → text rise 8 px (240 ms) → the newest halo pulses twice. `LinearTransition` for older rows |
| `components/composed/session-timeline.math.ts` | maths | ordering, UTC+07:00 labels (shared `formatClock`), newest/insertion detection, beats |
| `components/composed/stepper.tsx` | C-4 | Horizontal wizard (MB 3: gold lead-in, half-filled connector after the active step) and vertical pipeline. Kit `Chip` badges, kit `Separator` tracks, `Spinner` for running steps, SVG check draw (300 ms), glow ring and one halo pulse, connector fills (420 ms `luxe`), optional back-navigation to completed steps |
| `components/composed/stepper.math.ts` | maths | status derivation, connector fill, tones, a11y labels, R1 stagger |
| `components/composed/rolling-number.tsx` | C-6 | `slide`: 20-cell digit columns rolled by `translateY` on the UI thread (240 ms `standard`), odometer wraps, centred digits. `count`: the same columns as continuous drums on the `counter` spring after the 120 ms held beat; the leading zero stays hidden. Input is a number or a shared value |
| `components/composed/rolling-number.math.ts` | maths | `Intl`-free formats (integer, decimal, duration, clock, countdown), templates, digit-from-end, roll plan, places, drum position |
| `components/composed/*.test.tsx` (5 files) | tests | §4.1 |
| `components/media/camera-feed.tsx` | renderer | Skia 16:9 virtual feed: procedural placeholder room (or `image` from step 72), Ken Burns 1.00 → 1.06 / 30 s (Cam 2 mirrored, +11 s phase), 25 fps grain, 6 s scanline, burnt-in UTC+07:00 timestamp and camera label, NO SIGNAL grey noise, first paint 600 ms, camera switch cross-fade 320 ms. Reduced: static frame, timestamp at 1 Hz from JS |
| `components/media/camera-feed.math.ts` | maths | framing, Ken Burns, grain seed, scanline, cover scale, civil-date timestamp |
| `components/media/emblem.tsx` | renderer | `Emblem` (react-native-svg, static) and `EmblemDraw` (Skia: shield 500 ms, arcs 70 ms apart, one bloom, optional `scanning` pulse, `onDrawn`) |
| `components/media/emblem-paths.ts` | data | **placeholder** path data (double-stroke shield + 6 arcs, token-derived gradient) + the `EmblemPathData` contract + draw timing |
| `components/media/hero-backdrop.tsx` | renderer | expo-image still (step 72) or procedural warm-light placeholder, black/bronze grade, topographic texture (placeholder contours or `topoXml`), 2 static light streaks, Ken Burns push-in |
| `components/media/hero-backdrop.math.ts` | maths | seeded PRNG + deterministic contour rings (SCR-06 stand-in) |
| `components/media/color.ts` | helper | `withAlpha`, `mixHex` (worklet-safe; colours only derived from tokens, MA-22) |
| `components/media/index.ts` | barrel | media exports |
| `components/media/media.test.tsx` | tests | §4.1 |
| `components/media/testing/skia-mock.ts` | test helper | module-level Skia mock (04 §10.1), records props so tests can read the wired shared values |
| `app/dev-gallery.tsx` | route (create once, P6) | `demsdemo:///dev-gallery?section=rings\|meters\|numbers\|steps\|timeline\|media&motion=full\|reduced\|off`; `__DEV__` only (release → `<Redirect href="/">`); keyed by params; fake 20 Hz audio written into shared values from JS, as the runtime does; pauses canvases when unfocused |

Also written: `docs/…/delegation_progress/coder_execution_step_71.md`, this log, and 24 screencaps in `docs/…/implementation/assets/mobile/71_dems_{phone,tablet}_gallery_*.png`.
Not written: `packages/shared/**`, `apps/core-web/**`, root files, `package.json` and lockfiles (no npm install), `status_tasks.md`, `delegation_progress_report.md` and `masterplan/02_plan.md` (parallel run; the controller synthesises them).

## 3. Contract for the consuming steps

| Consumer | How to use |
|---|---|
| Screens (steps 75–89) | Pass `motion={useMotionPolicy()}` (step 69) and `paused={!useIsFocused()}` to canvases. Meters take the shared values from step 73's `use-audio-shared-values`; the screen updates `accessibilityValue` at 1 Hz (the meter has no state by design) |
| Step 70 (owner of `src/app/**`) | Keep `/dev-gallery` public inside the new route tree. It currently reads `?motion=` itself; switching it to `useMotionPolicy()` is optional |
| Step 72 | `CameraFeed image={require(hero)}`, `HeroBackdrop source={…} topoXml={…}`, and `Emblem`/`EmblemDraw data={adapter(@dems/shared/brand emblem)}`. Adapter: `{ viewBox: { width: emblem.size, height: emblem.size }, shield: { outer: emblem.shield }, arcs: emblem.arcs, stops: emblem.gradient.stops, strokeWidth: emblem.strokeWidth, source: 'shared' }`. A test proves it already type-checks and renders |

## 4. Verification (fresh runs, 03:05–03:08 WIB)

### 4.1 Step-71 tests: 6 suites, 54 tests pass

`npm test -w @dems/mobile -- src/components/composed src/components/media --maxWorkers=2 --forceExit`

| File | Tests | Covers |
|---|---|---|
| `composed/dbfs-meter.test.tsx` (**T-M09**) | 9 | thresholds and tones; opacity interpolation; −18 dBFS lights 6 segments; monotonic axis; peak hold 1.5 s then 20 dB/s; 4 Hz throttle; layout; **1 Profiler commit across 40 frames at 20 Hz**; segment opacity reaches 1 or 0.12 for −10 dBFS with no extra render |
| `composed/glow-ring.test.tsx` | 9 | mode clamps; nested radii; 72 ticks / 12 long; arcs disjoint with bright arcs at 0° and 180°; sweep ≤ 1.5 s; tones and escalation; full sweep 0 → 1; reduced = static final frame |
| `composed/rolling-number.test.tsx` | 10 | timer/clock/countdown formats; decimals; templates; digits from the right; places and drums; roll plans; digit columns; shared-value timer rolls, including the 9 → 0 wrap; KPI count-up after the held beat; 9 → 10 adds a column |
| `composed/stepper.test.tsx` | 7 | statuses; fills; tones and labels; stagger; MB 3 wizard; advance and back-press; pipeline running and failed |
| `composed/session-timeline.test.tsx` | 6 | ordering; UTC+07:00 labels; newest and insertions; rows; insertion; empty state |
| `media/media.test.tsx` | 13 | alpha and mix; Cam 2 framing; Ken Burns; grain and scanline; cover; timestamp across month, year and leap day; placeholder shape; **shared brand module via the step-72 adapter**; draw budget ≤ 1.4 s; topo determinism; renderers render; the draw notifies once |

### 4.2 MA-23 listing

```
$ ls apps/mobile/src/components/composed
dbfs-meter.math.ts  dbfs-meter.test.tsx  dbfs-meter.tsx  glow-ring.math.ts  glow-ring.test.tsx  glow-ring.tsx
rolling-number.math.ts  rolling-number.test.tsx  rolling-number.tsx  session-timeline.math.ts
session-timeline.test.tsx  session-timeline.tsx  stepper.math.ts  stepper.test.tsx  stepper.tsx
$ grep -rnE "export (default )?(function|const) (Button|Card|Chip|Tabs|Switch|Dialog|Toast|Select|TextField)\b" apps/mobile/src
(no output, exit 1)
```

### 4.3 Workspace gates (the whole mobile app, including the parallel steps' files)

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/mobile` | exit **0**, 0 `error TS` |
| `npm run lint -w @dems/mobile` | exit **0**. 3 warnings, all in step 69's `src/motion/haptics.test.ts` (P11, not step 71) |
| `npm test -w @dems/mobile -- --maxWorkers=2 --forceExit` | exit **0**: **18 suites, 210 tests pass** |
| MA-22 `grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?" apps/mobile/src/features apps/mobile/src/components apps/mobile/src/app/dev-gallery.tsx` | no output, exit 1 |
| MA-25 URL grep on the step-71 paths | no output, exit 1 |
| MA-20 `grep -rn "Haptics\."` on the step-71 paths | no output, exit 1 (compositions emit no haptics; screens call step 69's service) |

## 5. Device smoke (both AVDs, after step 67's reinstall)

- **Command:** `LOCK_WAIT=500 SESSION_MAX_SECS=900 METRO_PORT=8082 apps/mobile/scripts/device-session.sh <phone|tablet> "sh <scratch>/gallery_smoke.sh"`, run outside the sandbox (P10).
- **What the helper does:** it takes the AVD lock, starts lane Metro 8082, sets the bundler host to localhost:8081 (step 67 F-1) and maps the reverse ports. On exit it stops Metro and removes its own reverse rules.
- **Final runs:** phone 03:02:18–03:03:27, tablet 03:03:33–03:04:42. Media re-check after the emblem refactor: phone 03:07:36–03:07:48, tablet 03:07:49–03:08:00. Every session ended with status 0.

| Check | Phone (emulator-5554, 1080×2424) | Tablet (emulator-5556, 2560×1600) |
|---|---|---|
| Bundle | `Android Bundled 996ms … (5135 modules)` | `Android Bundled 813ms … (5135 modules)` |
| Screencaps | 12: rings, meters, meters_2, numbers, steps, steps_2, timeline, media, media_2, rings_reduced_a/b, meters_reduced | same 12 |
| D43 switch (`?motion=off`), rings frames 2 s apart | **byte-identical** (467,014 B each) | **byte-identical** (354,586 B each) |
| JS warnings or errors in logcat (`ReactNativeJS:W`, `AndroidRuntime:E`) | 0 (final run and media re-check) | 0 |
| `gfxinfo` sample, meters section, full motion, 10 s (informational, 04 §7.8) | 391 frames; Janky 13.55 % (legacy 11.25 %); p50 16 ms; **p90 20 ms** | 388 frames; Janky 13.66 % (legacy 7.73 %); p50 16 ms; **p90 18 ms** |

**Seen on the screens:**
- The ring renders with ticks, brackets, glow and the Emblem centre.
- MIC cards light green up to the level, with the peak marker and the "-27 dBFS" readout.
- The timer reads `00:24:22` and the clock `02:56:53`, with digits aligned.
- The KPI counts up to `20%`; bandwidth reads `12.4 Mbps`.
- The stepper matches MB 3.
- The timeline shows its nodes and mono times.
- The placeholder room shows CAM 1 and the mirrored CAM 2, with the burnt-in timestamp and the camera label.
- The emblem appears at three sizes.
- The backdrop shows its topo lines and light streaks.

Emulator frame figures are informational only (04 §7.8, R-M2).

**Process hygiene (P7):**
- Port 8082 has no listener, no step-71 script is running, and `adb reverse --list` is empty on both serials.
- The adb server (PID 80888) started at 02:47:20, before step 71's first session at 02:50, so it is not step 71's and was left running.
- Emulators 51262 and 51273 were left up (P3).

## 6. Decisions, drift and findings

| # | Type | Item | Resolution |
|---|---|---|---|
| S71-1 | drift (spec) | 04 §4.0 C-6 `count` uses "useAnimatedProps on a read-only TextInput". On device the text stayed `0%`: the UI-thread `text` prop did not apply on this Fabric debug build | `count` now reuses the digit columns as continuous drums on the `counter` spring. Still UI-thread, still 0 React renders per frame. Device result: `20%`. Recorded in the file header |
| S71-2 | finding (library) | Skia `Canvas onSize` runs a per-frame `measure()` frame callback even when idle. It kept the UI loop busy, which hurts D43 idle and performance, and on detached screens it logged the Reanimated "LayoutMetrics" warning (24 warnings when leaving the meters section, found by a per-section probe) | The meter and the feed use a wrapping `View onLayout` that writes the same shared value. Warnings went from 24 to 0. Screens should avoid `onSize` too |
| S71-3 | finding (worklets) | A default parameter that names an imported binding is not captured in a worklet closure. On device: `ReferenceError: Property 'DISPLAY_UTC_OFFSET_MINUTES' doesn't exist` in `formatFeedTimestamp` | Defaults are now resolved in the function body, from local constants. The rule is written in `camera-feed.math.ts`. Jest cannot catch this (the worklet mock runs plain JS) |
| S71-4 | finding (library) | Skia 2.6.2 deprecates the mutating `SkPath` API (logcat warnings) | GlowRing builds its paths with `Skia.PathBuilder…build()`. Other paths are SVG strings |
| S71-5 | decision | 04 §8.3 reserves `CameraFeed source={{ uri }}` → expo-video. Importing expo-video breaks every consumer's jest run (native module), and D31 rules out clips | Not built. Adding it later is additive, so existing call sites stay unchanged. Recorded in the file header |
| S71-6 | decision | 01S §14.6 wants `accessibilityValue` at 1 Hz, while MA-16 and T-M09 forbid state in the meter and require 1 render per 40 frames | The screen passes `accessibilityValue` (1 Hz). The canvas is memoised, so only the outer `View` re-renders |
| S71-7 | decision | The composition motion prop is `'full' \| 'reduced'` (same shape as step 69). `reduced` = the D43 switch: ambient loops off. Meters keep a UI frame callback (10 Hz sampling, 4 Hz readout) because the spec keeps them functional. CameraFeed in reduced mode uses a JS 1 Hz timer, not a frame loop | Proven by the byte-identical reduced frames on both AVDs |
| S71-8 | SCR-07 | The NEW motion tokens are read at run time when present: `spring.meter`, `spring.counter`, `ambient.ringRotate`, `ambient.kenBurns`, `ambient.scanline`, with 03M §2.3 fallbacks. Step 30 has since published all five with identical values | The compositions now use the shared tokens, with no code change needed |
| S71-9 | SCR-03 / SCR-06 | Emblem and topographic data are **placeholders** (as the row asks). The `EmblemPathData` contract gained `strokeWidth` and an optional `inner` rim, so step 35's published module (128 viewBox, two-rim shield path) fits the documented adapter | A test proves the adapter renders the shared module. Step 72 wires the data |
| S71-10 | drift (process) | 04 §10.1 wants Skia "mocked at module level". Step 71 adds `components/media/testing/skia-mock.ts` (in its own write path) instead of editing step 67's jest config | Each test file uses `jest.mock('@shopify/react-native-skia', …createSkiaMock())` |
| S71-11 | finding (test env) | Frame callbacks register and unregister through the worklets mock's timers. A registration queued under one test's fake clock and unregistered under the next test's clock threw `Cannot set properties of undefined (setting 'startTime')` | The component tests' `afterEach` runs `cleanup()` and `runOnlyPendingTimers()` before real timers. Redundant `setActive(false)` cleanups were removed (the hook unregisters on unmount) |
| S71-12 | naming | 05 plan names the log `43_mobile_compositions.md`; the blueprint row 71 names it `44_mobile_compositions.md` | The blueprint is followed (44) |
| S71-13 | P11 | Step 67's log recorded step-71 `rolling-number.tsx` typecheck errors at 02:43, in a file still in progress. Fixed (typed narrowing) | Typecheck exit 0 since (§4.3) |
| S71-14 | observation | Baseline: the row-18 test kept jest alive for about 5 minutes after the run (React Query `gcTime`). Step-71 runs use `--forceExit` | Pre-existing, not step 71's. For step 88 or the test step |

## 7. Persistent issues

None blocking. Informational: the emulator Janky share (new metric) is about 13.6 % with p90 18–20 ms. That is within the §7.8 p90 hypothesis of 20 ms, above the 10 % Janky hypothesis, and emulator-only (R-M2). No physical device is in scope.

## 8. Next steps (other rows)

- Step 70: keep `/dev-gallery` public in the new tree.
- Step 72: wire the hero still, the topo SVG and the shared emblem (§3).
- Step 73: shared values for the meters.
- Steps 75–89: consume the compositions with `useMotionPolicy()` and `paused={!focused}`.

---
*Generated: 2026-10-01 03:10 WIB*
*Last Updated: 2026-10-01 03:10 WIB*
