---
task_id: 2026-09-30_dems_demo_stack_setup
step: 39
plan_row: 02_plan §4 W-08, part a (custom compositions and media)
date: 2026-10-01
agent: coder-execution
tier: 3
lane: web B (Vite 127.0.0.1:5177, D59)
status: complete
decisions: D46, D48, D49, D50, D53, D54, D59, D61, D63, D64
---

# Step 39: Custom compositions and media (`apps/core-web/src/components/{composed,media}`)

**Outcome: PASS.** Run from 04:36 to 05:21 WIB. Every row-39 check passes; command output is quoted in §4.

| Row-39 check | Result | Evidence |
|---|---|---|
| Each composition has a test for its §14.6 accessibility contract | **PASS** | GlowRing: `role="img"` + per-state label, decorative layers `aria-hidden` (§4.2 G3–G5). DbfsMeter: `role="meter"`, −60…0, `aria-valuetext` "−18 dBFS", 1 Hz `aria-valuenow` (M2, M3). SessionTimeline: `<ol>` + polite live region for new items (T2, T4). Stepper: `<ol>` with `aria-current="step"` on the active step only (S1) |
| DbfsMeter counts **0 React commits across 20 audio frames** (MS-08 unit form) | **PASS** | `applies 20 audio frames with 0 React commits (MS-08 unit form) and ARIA at 1 Hz` ✓: Profiler commits = 0, `reportMeterFrame` count = 20 |
| CameraFeed shows the video source when available and the procedural canvas after a simulated media error | **PASS** | `plays the live-loop video, muted and looped, when it is available (D50)` ✓ (`src` ends `demo-media/live/VIDEO-01.loop.mp4`); `switches to the procedural canvas after a media error (D50 fallback)` ✓ (`data-feed-mode="procedural"`, `data-feed-fallback="error"`, canvas painted) |
| MS-01 and MS-02 greps find nothing | **PASS** | both exit 1, no output (§4.1) |
| core-web typecheck, lint and test exit 0 | **PASS** | `tsc -b` exit 0; oxlint exit 0, **0 diagnostics in 122 files**; vitest `Test Files 13 passed (13)`, `Tests 161 passed (161)` at 05:19 WIB |

**Also done:**
- A mutation check shows the key tests are not vacuous (§4.3).
- A headless-Chromium pass on lane-B port 5177 played the real step-92 videos, exercised the fallback, CLIP, a critical fault and reduced motion (§5).
- The browser pass found **two real defects**, both fixed test-first or measured (§5.3):
  - the timeline's `scrollIntoView` scrolled the whole page;
  - ring loops repainted the SVG every frame.

**Scope (P6):**
- Writes stayed inside:
  - `apps/core-web/src/components/composed/**` and `apps/core-web/src/components/media/**` (22 files);
  - this log, six screenshots `implementation/assets/39_*.png` and `delegation_progress/coder_execution_step_39.md`.
- Nothing was installed and no `package.json` or lockfile was edited (P1).
- These were not touched: `packages/shared/**`, routes, shell, pages, `vite.config.ts`, `index.css` and `THIRD_PARTY_NOTICES.md`.
- Nothing was committed.

## 1. Files (all new)

| File | Lines | Role |
|---|---|---|
| `composed/glow-ring.tsx` | 467 | **GlowRing** (§14.6, M-C-01) and the brand-emblem centre (`@dems/shared/brand`, per-instance gradient id, D48) |
| `composed/glow-ring.math.ts` | 92 | Geometry: 72 ticks, bracket arcs, inner circle path. State colours. Escalation rank (R8) |
| `composed/dbfs-meter.tsx` | 382 | **DbfsMeter** (§14.6, M-C-04), transient audio → Motion values |
| `composed/dbfs-meter.math.ts` | 97 | Thresholds, tones, segment opacity, peak-tick position, readout/ARIA formatting, frame-time rate gates |
| `composed/session-timeline.tsx` | 267 | **SessionTimeline** (§14.6, M-C-08) |
| `composed/session-timeline.math.ts` | 22 | Kind → node look |
| `composed/stepper.tsx` | 293 | **Stepper** (§14.6, M-C-09) plus **StepperStamp** (the SEALED stamp that ends M-C-09) |
| `composed/index.ts` | 45 | Barrel |
| `media/camera-feed.tsx` | 433 | **CameraFeed** (§14.10 as amended by D50; M-C-12, M-C-20) |
| `media/camera-feed.math.ts` | 123 | Step-92 crops and grades (D46), Ken Burns, scanline, OSD text, backing size |
| `media/procedural-feed.ts` | 299 | Canvas renderer: the graded still, grain tiles, vignette, scanline, burnt-in UTC+07:00 OSD. NO SIGNAL noise |
| `media/feed-scheduler.ts` | 55 | One shared rAF loop for all feed canvases (§9.3) |
| `media/demo-media.ts` | 139 | Step-92 media resolver (`import.meta.glob`, eager `?url`), join by evidence number (D61), excerpt rule |
| `media/rec-indicator.tsx` | 93 | **RecIndicator**: REC chip with pulse, halo and SlidingNumber timer (M-C-05) |
| `media/use-sim-clock.ts` | 45 | `useSimSecond()` (1 Hz) and `useSimNowReader()` (render-free); both work without a provider |
| `media/index.ts` | 31 | Barrel |
| `composed/__tests__/{glow-ring,dbfs-meter,session-timeline,stepper}.test.tsx` | 538 | 38 tests |
| `composed/__tests__/test-utils.ts` | 94 | Test sim (no ticks, in-memory storage, D54(a)), frame pusher, providers, on-screen IntersectionObserver |
| `media/__tests__/camera-feed.test.tsx` | 225 | 14 tests |

## 2. Component API for the page steps (42–53)

Import from `@/components/composed` and `@/components/media`. Everything reads `useMotionPolicy()`, so it works with or without step 41's `MotionPolicyProvider`. Without the provider it uses the static full-motion default.

### 2.1 GlowRing (Dashboard A, Login, Start Session step 3)

```tsx
<GlowRing
  state={systemState}            // 'READY'|'ATTENTION'|'CRITICAL'|'UNKNOWN'|'RECORDING' (selectSystemState(s).state)
  size={320}                     // hero ≈320, login ≈340, mini ≈120
  mode="hero"                    // 'hero' | 'login' | 'mini' (mini: no rotation, icon only)
  recordingSince={session?.startedAt ?? null}  // RECORDING centre: REC + SlidingNumber timer
  centerIcon="shield"            // 'shield' (default) | 'emblem' (default for login)
  delayMs={0}                    // offsets the mount sequence (page choreography, R3)
  label={optionalOverride}       // default dashboard.systemRing.ariaLabel.<state>
  center={optionalReplacement}   // replaces the default centre
>
  {/* optional readable centre content below the state word, e.g. the flags line + caption */}
</GlowRing>
```

- **Default centre:** the Lucide shield (its check draws at 900 ms), then "SYSTEM" and the state word through TextEffect.
- **Loops:** two ambient loops, `ring-rotate` and `ring-breath`.
- **While recording:** the red arc pulse joins the page's `rec-pulse` slot (shared with every RecIndicator).
- **Page caution:** select `selectSystemState(s).state`, not the whole object. `useSim(selectSystemState)` returns a new `flags` array on every store change, which makes `useShallow` loop (seen in the harness, §5.3 H-1).

### 2.2 DbfsMeter (Dashboard E, SM O and R, Devices)

```tsx
<DbfsMeter channel="AUDIO-01" variant="tile" />   // 'tile' | 'panel' | 'large' | 'compact'
<DbfsMeter channel="AUDIO-02" variant="panel" monitoringPaused={paused} />   // M-C-20 dim
<DbfsMeter channel="AUDIO-02" variant="large" orientation="vertical" />      // default vertical for large
```

- **Must render inside `SimProvider`.** It calls `useAudioChannel`.
- **CLIP chip:** its button calls `actions.resetClip(channel)`. While a `MIC_CLIP` fault stays injected, the simulator's bursts re-latch at once. That is simulator behaviour (13_sim_engine §2.5); clear the fault to see the reset hold.
- **Debug counter:** every applied frame calls `reportMeterFrame(channel)`, so `?debug=1` shows 20/s per meter instance (AC-61).
- **Out of scope:** the mic icon, the READY chip and the tile header belong to the page.

### 2.3 SessionTimeline (SM Q)

```tsx
<ScrollShadow className="h-[…]">                                   {/* the panel that scrolls */}
  <SessionTimeline events={session?.timeline ?? []} now={clockSecondMs} limit={optional} />
</ScrollShadow>
```

- **Titles** default to `session.timeline.kind.<KIND>`. The detail is `event.detail`, else the simulator label when it adds something. `getTitle` and `getDetail` override both.
- **Auto-scroll** moves only the nearest scrolling ancestor below `<main>`, and only if the user has not scrolled in 5 s. Give the timeline its own scrolling panel. Without one, it never scrolls.

### 2.4 Stepper and StepperStamp (Start Session, Finalization, Export, Update, Lifecycle)

```tsx
<Stepper ariaLabel="Start New Session" orientation="horizontal" variant="wizard"
  steps={[{ id, label, status: 'done'|'active'|'pending'|'warn'|'error', description? }]} />
<Stepper orientation="vertical" variant="pipeline" steps={finalization.steps.map(...)} />  // Spinner while active
<StepperStamp show={state === 'SEALED'} />   // violet SEALED, stampFrom 1.2 → 1 bouncy, e3 flash, hairline ring
```

- The sim's `StepStatus` values are the Stepper's statuses.
- The labels for FinalizationStep are in `common.enums.finalizationStep`.
- Wizard content transitions (TransitionPanel) belong to the page.

### 2.5 CameraFeed and RecIndicator (Dashboard D and E, SM L and R, Devices, Evidence posters)

```tsx
<CameraFeed
  cameraId="VIDEO-01"                         // 'VIDEO-01' | 'VIDEO-02'
  variant="feed"                              // 'feed' (framed, glow) | 'tile' (hover lift) | 'thumb'
  label="Camera 1 - Interview Room 1"         // session.feed.cameraLabel
  recordingSince={session?.startedAt ?? null} // top-right REC + timer (sim clock, 1 Hz)
  formatLabel="1080p • 25 fps • H.264"        // common.devices.cameraFormatCodec
  noSignal={lens === 'FAULT' || !online}
  dimmed={monitoringPaused}                   // M-C-20
  actions={<Button isIconOnly …/>}            // bottom-right slot (fullscreen)
  src={undefined}                             // default: step-92 live loop; null = procedural only; a URL = that clip
  live                                        // false: poster only, no decode (thumbnail budget)
  ref={feedRef}                               // feedRef.current.snapshot() → JPEG data URL (M-C-18)
  onModeChange={(mode, reason) => …}
/>
<RecIndicator since={session.startedAt} look="soft" size="md" />   // Dashboard D recording state
```

- **Fullscreen flight:** the page wraps the feed in `motion.div layoutId="feed-<cameraId>"` (R5).
- **Evidence playback:** use `evidenceMedia('EV-…-0007')` for `{ video: { 'VIDEO-01': { src, poster, thumb } …}, audio: { 'AUDIO-01': url … } }`. For an item without media it returns `null`: EV-…-0014 before step 93 or a regeneration.
- **Excerpt rule:** `excerptPositionSec(p, excerptDurationSec)` maps a timeline position into the excerpt (the DEMO excerpt rule, 64 §5).

## 3. Specification coverage

| Spec | Where |
|---|---|
| §14.6 GlowRing contract, layers, a11y | `glow-ring.tsx`; ticks, bracket glow and brackets as separate `<svg>` layers; `role="img"` on the track + inner-ring SVG |
| M-C-01 mount: ticks 420 ms, arcs `pathLength` 900 ms `luxe` 120 ms apart, inner ring from 200 ms over 1,200 ms, check at 900 ms (600 ms), words at 1,000 ms | `TIMELINE` constants; TextEffect `fade-in-blur` `per="char"` |
| M-C-01 rotation 60 s, glow 0.55 ↔ 1 over `glowBreath`, state morph 600 ms via `--ring-color`, one bloom on escalation, RECORDING red arcs at `recPulse` | Element `animate()` (WAAPI), `GlowLayer pulseKey`, `RING_COLOURS` |
| §14.6 DbfsMeter: 10 segments with tones, peak tick, CLIP latch Chip, mono readout, `role="meter"`, 1 Hz `aria-valuenow` | `dbfs-meter.tsx` / `.math.ts` |
| M-C-04: `useSpring(meter)`, `useTransform([t−1, t] → [0.12, 1])`, 4 Hz text, CLIP pop (`bouncy`) + one 180 ms flash, NO SIGNAL fade 400 ms + dashed line, paused dim 0.35, reduced = direct at 10 Hz | same |
| §9.3 zero renders per frame; `reportMeterFrame` | Motion values + direct DOM text; React state only on CLIP / NO SIGNAL flips |
| §14.6 SessionTimeline: kinds, node looks, `<ol>`, `aria-live` | `session-timeline.tsx` |
| M-C-08: line `scaleY` 320 ms `luxe`, node pop `bouncy`, text rise 8 px 240 ms, halo ×2 at 1.2 s, 5 s user-scroll rule | same |
| §14.6 Stepper; M-C-09 connector fill 420 ms `luxe`, active glow e2 + one pulse, check draw 300 ms, warn/error colour + pulse, Spinner in pipelines, SEALED stamp | `stepper.tsx` |
| §14.10 + D50: live-loop video under Chip overlays, procedural fallback (still, drift, grain, burnt-in timestamp) | `camera-feed.tsx`, `procedural-feed.ts` |
| M-C-12: Ken Burns 1.00 → 1.06 / 30 s alternating, Cam 2 +11 s, grain 25 fps, scanline 8% (1.2 s sweep / 6 s), first paint blur 8 → 0 (600 ms), camera switch 320 ms, NO SIGNAL 400 ms, tile hover 1.01 + glow e1 → e2 | same |
| M-C-05 REC dot `1 → 0.35 → 1` + scale over `recPulse`, halo, reduced static dot | `rec-indicator.tsx` |
| §8 reduced motion (`data-motion="reduced"`, static loops, meters kept) | every component; tests G7, M4, T5, S5, C8 |
| §9.2 / AC-72 composite-only; MS-02 glow via opacity layers | §4.1 greps; static `boxShadow` only on non-animated layers |
| §9.4 ambient cap | `ring-rotate`, `ring-breath`, `rec-pulse` (shared group), `feed-frame-glow`, `camera-feeds` (one group for every procedural feed) |

## 4. Verification (fresh; commands and output)

### 4.1 Gates (05:19:29–05:19:39 WIB)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck -w @dems/core-web` (`tsc -b`) | exit 0 |
| Lint | `npm run lint -w @dems/core-web`; `oxlint -f json` | exit 0; `oxlint files 122 rules 116 diagnostics 0` |
| Tests | `npm test -w @dems/core-web -- --maxWorkers=2` | exit 0; `Test Files 13 passed (13)`, `Tests 161 passed (161)` (52 are step 39's) |
| MS-01 (AC-72) | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src` (bash) | no output, exit 1 |
| MS-02 | `grep -rn "box-shadow" apps/core-web/src --include=*.tsx \| grep -E "animate\|transition"` (bash) | no output, exit 1 |
| MS-03 (literal) | `grep -rnE "will-change" apps/core-web/src` | no output, exit 1 |

- **`willChange` in React style.** The only use is on the GlowRing rotating tick layer, one of the four places §9.3 allows.
- **Static `boxShadow`** appears in three places, none animated:
  - the meter segments' inner glow;
  - the timeline node glow;
  - the stamp's pre-rendered e3 layer, whose opacity alone moves.

### 4.2 Step-39 tests (52)

| File | Tests | Covers |
|---|---|---|
| `dbfs-meter.test.tsx` | 11 | Maths: thresholds and tones; −18 dBFS lights 6; the fade band; peak tick monotonic and hidden below the floor; formatting.<br>Behaviour:<br>- M1 a11y contract;<br>- **M2 MS-08: 20 frames → 0 commits, 20 frames reported, ARIA unchanged for 19 frames then updated at +1 s, readout followed**;<br>- M3 segment opacity driven by frames;<br>- M4 reduced motion → 10 Hz (20 frames → 10 applied);<br>- M5 CLIP latch = exactly 1 commit, top segment locked at opacity 1, the chip resets through `resetClip`;<br>- M6 NO SIGNAL (valuetext "No signal", flat line);<br>- M7 monitoring paused still meters |
| `glow-ring.test.tsx` | 15 | Escalation rank; geometry.<br>G1–G5: labels for all 5 states; 6 decorative layers `aria-hidden`; one `img`; custom label; readable caption.<br>G6: the state word.<br>Loops:<br>- two loops (`ring-breath`, `ring-rotate`);<br>- mini: breath only, no rotation;<br>- G7 reduced: 0 loops requested, `data-motion="reduced"`, glow at 0.8.<br>RECORDING: red arcs + REC 00:18:4x.<br>Two login rings: 2 distinct gradient ids (D48) |
| `session-timeline.test.tsx` | 6 | Node looks.<br>T1: `<ol>` oldest first, 14:08:50 UTC+07:00, i18n titles, simulator label as detail, node looks.<br>T3: `now` and `limit`.<br>T4: live region empty at mount, announces an insertion.<br>Scroll: its own panel only, never `<main>`, not within 5 s of a user wheel.<br>T5: reduced |
| `stepper.test.tsx` | 6 | S1: `<ol>`, `aria-current` only on the active step, statuses, visually hidden "1/3: Done".<br>Wizard numbering, filled connector, check drawn.<br>Pipeline Spinner and advance.<br>warn/error.<br>S5: reduced.<br>SEALED stamp |
| `camera-feed.test.tsx` | 14 | Resolver:<br>- live loops, posters, MIC loops;<br>- join by evidence number (13 suffixes 0001–0013; 0014 → `null`; no `mobile/` paths);<br>- excerpt `p mod L`.<br>Maths: Ken Burns 1 → 1.06 → 1 and the Cam 2 phase; scanline window; OSD `2026-10-01  10:00:00  UTC+07:00`; backing cap.<br>Behaviour:<br>- **C1 video plays (muted, loop, `playsinline`, live poster)**;<br>- **C2 media error → procedural canvas painted**;<br>- C3 autoplay refused → fallback;<br>- C4 `AbortError` ignored, no frame by the timeout → fallback;<br>- C5 `src={null}` and a fresh try for a new `src`;<br>- `live={false}` poster only;<br>- C7 REC 00:18:42 from the simulator clock, and NO SIGNAL without decoding;<br>- C8 reduced → paused, `data-motion="reduced"`, dimmed label |

### 4.3 Mutation check (tests are not vacuous)

The three files were backed up and restored afterwards; `cmp` reported them identical ("restored identical").

| Mutation | Failed tests |
|---|---|
| M1: DbfsMeter sets React state on every frame | 2 (MS-08; CLIP "exactly one commit") |
| M2: CameraFeed ignores media errors | 1 (the D50 fallback test) |
| M3: GlowRing exposes a decorative layer (`aria-hidden` removed) | 1 (the a11y layer test) |

### 4.4 P11

- No run failed because of a concurrent step.
- A scoped typecheck (a scratch tsconfig over my two folders) was used while writing. The full `tsc -b` ran clean each time.

## 5. Browser check (lane B 127.0.0.1:5177; headless Chromium over CDP; scratch harness)

### 5.1 Method

- **Harness:**
  - A throwaway Vite harness lives in the session scratchpad, outside the workspace. Its `node_modules` is a symlink to the workspace's, and its Tailwind `@source` points at `apps/core-web/src`.
  - It renders both rings (hero RECORDING, mini READY), 5 meters, 4 feeds (2 live videos, 1 `src={null}`, 1 broken `src`), the live session timeline, both steppers and the stamp.
  - A live simulator (`recording` scenario, in-memory) runs under `MotionPolicyProvider` with `?debug=1`.
- **Server:** `vite` on **127.0.0.1:5177** (D59 lane B), with a per-command sandbox bypass (P10).
- **Browsers:**
  - Google Chrome 154 headless (new) for the functional pass and screenshots.
  - Playwright's `chrome-headless-shell` build 1243, the same binary steps 36 and 37 used, for the fps matrix.
  - Both driven with Node 26's global `WebSocket`. No package was installed.

### 5.2 Functional results (final code, 05:16 WIB)

| Check | Measured |
|---|---|
| Live videos (D50) | VIDEO-01 feed and VIDEO-02 tile: `readyState 4`, 1280×720, playing (`currentTime` 3.65 → 5.65 s over 2 s), `data-feed-fallback="none"` |
| Fallback in a real browser | the tile with a 404 `src` → `procedural:error`; `src={null}` → `procedural:no-source`; both canvases painted (249×139 backing); one DEV `console.warn` "[core-web] camera feed fallback" per fallback (structured fields) |
| Meters | 5 meters live (−16 … −19 dBFS on MIC 1 during speech, −52 floor on MIC 2). Overlay `meters AUDIO-01 40/s · AUDIO-02 60/s`: 2 and 3 meter instances × 20/s (AC-61 needs ≥ 15/s per channel) |
| Ring | RECORDING: `--ring-arc-color #EF4444`, ticks layer `transform matrix(0.9279, 0.3728, …)` → `matrix(0.8301, 0.5576, …)` 2 s later (rotating), label "Recording in progress" |
| MIC_CLIP injected | all three AUDIO-02 meters `data-clip="latched"` with the reset chip; the top segment locks red (screenshot `39_compositions_clip.png`) |
| CAMERA_LOSS injected | ring → CRITICAL (ShieldX, "CRITICAL", red); `39_compositions_critical.png` |
| `?motion=off` (reduced) | `html[data-motion=reduced]`; both videos paused at 0 s (poster); rotation `transform: none`; ambient 0/4; meters still live at **10/s per instance** (§8) |
| Console | no errors or exceptions. Warnings: the expected fallback warnings and Motion's dev notice "You have Reduced Motion enabled" (step-36 N-3) |

**Screenshots** (`implementation/assets/`):
- `39_compositions_full.png`: the whole harness at 1600×1000;
- `39_compositions_clip.png`;
- `39_compositions_critical.png`;
- `39_compositions_reduced.png`;
- `39_glow_ring_ready.png`: the READY ring close-up, ×2; it matches the D1 mockup (ticks, two bright brackets, inner ring, shield, SYSTEM / READY);
- `39_timeline_stepper.png`: timeline rail with green, hollow-amber and filled nodes, wizard and pipeline steppers, SEALED stamp.

### 5.3 Defects found by the browser and fixed

| ID | Finding | Fix | Proof |
|---|---|---|---|
| B-1 | **The timeline's `scrollIntoView` scrolled the whole page** on an insertion. Every feed and loop above scrolled off-screen, so R10 paused them all ("ambient 0/0", videos paused at ≈3.7 s) | The component now scrolls **only the nearest scrolling ancestor below `<main>`** (`scrollIntoPanel`), and never the page or the shell's content area | The test "scrolls its own panel … never `<main>`" asserts `panel.scrollBy({top: 210, behavior: 'smooth'})` and no `main.scrollBy`. In the browser, `scrollY` stays 0 and loops stay running |
| B-2 | Ring loops animated SVG children (`<g>` rotate, filtered-group opacity), which re-rasterises the SVG and its blur every frame | Ticks, bracket glow and brackets are separate `<svg>` layers. The loops run through Motion's element `animate()`, which uses native WAAPI for `transform` and `opacity`. The rotation resumes from the computed angle | chrome-headless-shell: ring-only **61 fps**, 0 long tasks |
| B-3 | Memoisation: static geometry was rebuilt and every list or meter child re-rendered on each parent render | Module-level `TICKS` and `ARCS`; `memo` on `TimelineItem` and `MeterSegment`; a stable newest-item ref | Trace below |
| H-1 (harness only) | `useSim(selectSystemState)` loops: "getSnapshot should be cached", then "Maximum update depth exceeded". The selector returns a fresh `flags` array | The harness selects `.state`. **Relayed to the page steps** (§2.1) | – |
| H-2 (harness only) | A whole-page `useSim(selectSession)` re-rendered every composition at store rate: 40–53 ms React tasks in a CDP trace | The harness now selects narrowly, as pages should. The trace then shows **no main-thread task over 25 ms** and 0 long tasks after warm-up | – |

### 5.4 fps matrix (chrome-headless-shell 1243, 1600×1000, 8 s, `?debug=1`, 05:17 WIB)

| Harness content | fps (avg) | Long tasks after warm-up |
|---|---|---|
| blank page (rAF baseline) | 60.5 | – |
| timeline + steppers only | 60 | 0 |
| hero ring (2 loops) | 61 | 0 |
| mini ring | 60 | 0 |
| 5 meters at 20 Hz | 60 | 0 |
| ring + meters | 61 | 0 |
| one procedural feed | 60 | 0 |
| one live video feed with REC and frame glow | 61 | 0 |
| **two live video feeds** | **30** | 0 |
| **two plain `<video>` elements, no CameraFeed code** | **30** | 0 |
| everything (4 feeds, 2 rings, 5 meters, timeline) | 31 | 0 |

**Reading the matrix.**
- Every composition holds 60 fps on its own and together, except when **two videos play at once**.
- Two plain `<video>` tags reproduce the same 30 fps without any step-39 code. This is the headless software video path, not the component.
- Google Chrome's headless mode ran at 30 fps for any animating page (a static page ran at 60), so its numbers are not used for fps.
- **AC-71 must be measured in windowed Chrome with the GPU (step 58).** The blueprint already asks for it with the step-92 videos playing.
- If windowed Chrome also drops frames, pages can pass `live={false}` to small thumbnails (SM R, Dashboard tiles). That shows the poster with no decode.

### 5.5 Processes and side effects (P7)

**Processes started and stopped:**
- Vite harness PIDs 50528 (first start) and 50800;
- Chrome PIDs 50863, 53263 and 54438 (50852 exited at once on a shell-quoting error);
- chrome-headless-shell PIDs 53754 and 56403.

After the run, `lsof` showed ports 5177 and 9339 free. The scratch browser profiles and Vite cache were deleted. mock-core, the emulators and every other process were untouched.

**Side effects:**

| ID | What happened | Consequence |
|---|---|---|
| N-39-1 (incident, low) | My first harness start (04:58:42) had no `cacheDir`. Through the `node_modules` symlink, Vite re-optimised into the **workspace root** `node_modules/.vite/deps`. That folder already existed (born 04:24:34, another step's harness) and was rewritten with my dependency hash. I stopped the server at once and restarted with `cacheDir` in the scratchpad. No DEMS Vite server was running at the time (`ps`/`lsof`) | Another harness that reuses that cache re-optimises once on its next start. Nothing else is affected. The folder is cache only and was not deleted, because I did not create it |
| N-39-2 (read-only) | A `zoom` call went to the in-app Browser pane by mistake | It only returned a screenshot of an existing tab (tab-2, another step's favicon view). Nothing was clicked, navigated or closed |

## 6. Decisions, drift and notes

| ID | Kind | Item |
|---|---|---|
| D-39-1 | tech (drift from the row wording) | **The glob uses a workspace-relative path.** Vite 8 rejects `import.meta.glob('@dems/shared/assets/demo-media/…')` with "Invalid glob … It must start with '/' or './'". `demo-media.ts` globs `../../../../../packages/shared/assets/demo-media/{live,evidence/*}/*` (eager `?url`), which is the same folder. The hero still keeps the package export (`@dems/shared/assets/hero/room-2560.jpg?url`). The web never globs `mobile/` |
| D-39-2 | design | **Live video is media, not an ambient loop.** It does not take one of the 4 slots, so Dashboard tiles are not frozen by the cap. It still pauses off-screen and in a hidden tab (R10) and while NO SIGNAL. Under reduced motion it pauses on its poster, because the synthetic clip drifts, pushes in and has a scanline (§8, AC-70). The procedural push-in **is** an ambient loop, group `camera-feeds` (§9.4 "Camera Ken Burns ×2 (1 group)") |
| D-39-3 | design | Fallback triggers: `error` event; `play()` rejected with `NotAllowedError` (autoplay) or any other error; no decoded frame within `loadTimeoutMs` (default 8 s). `AbortError`, meaning a pause interrupted play, is not a failure. A failure is tied to its `src`, so a new source is tried again |
| D-39-4 | design | While recording, the ring's arc pulse shares the `rec-pulse` group with every RecIndicator (same tempo, same meaning). A Dashboard in recording therefore spends 3 of 4 slots: rotation, REC pulse, hero Ken Burns |
| D-39-5 | form (additive to the §14.6 contracts) | All additions are optional, and the §14.6 fields are unchanged:<br>- GlowRing: `centerIcon`, `recordingSince`, `children`, `delayMs`, `className`;<br>- DbfsMeter: `monitoringPaused`, `label`, `showReadout`, `className`;<br>- SessionTimeline: `getTitle`, `getDetail`, `limit`, `ariaLabel`, `className`;<br>- Stepper: `description` per step, `ariaLabel`, `className`; plus `StepperStamp`;<br>- CameraFeed: `src`, `poster`, `variant`, overlays, `noSignal`, `dimmed`, `actions`, `live`, `loadTimeoutMs`, `onModeChange`, `ref.snapshot()` |
| D-39-6 | design | `RecIndicator` lives in `components/media` as the CameraFeed REC overlay (M-C-05). It is exported for Dashboard D and the ring centre. It is a kit `Chip` plus Motion, not a sixth composition (D6) |
| D-39-7 | design | The procedural crops and grades copy step 92's generator table: Cam 1 is the full-width 16:9 band at y 120 (D46); Cam 2 is the 1792×1008 mirrored crop. The fallback therefore frames the room like the videos. Its OSD line reads "CAM-0n \| VIDEO-0n \| LIVE \| DEMO" (P13) under a UTC+07:00 timestamp from the simulator clock |
| D-39-8 | a11y | Stepper steps carry visually hidden "n/N: status" text from `common.status.*` / `common.actions.done`. The timeline's live region stays empty at mount and announces only insertions. The DbfsMeter readout is `aria-hidden`, and the meter's `aria-valuetext` carries the value |
| D-39-9 | literal timings (D49) | Documented spec literals are exported as constants with their spec IDs, and no token was added: 320 camera switch, 400 NO SIGNAL, 180 clip flash, 900 / 120 / 1,200 / 200 / 600 / 1,000 ring mount, 320 / 240 / 8 px timeline, 300 check, 400 / 700 stamp, 8 s load timeout |
| D-39-10 | error logging (coder-execution STEP 3) | Persistent logging is not possible: there is no client log endpoint (D41(g)).<br>- The media fallback is the graceful-degradation layer, and it writes one structured DEV `console.warn` (`level`, `source`, `message`, `context`).<br>- Canvas code tolerates a missing 2D context, and the still-image loader tolerates a failed decode (gradient room abstraction).<br>- No user data is involved |
| D-39-11 | behaviour | The Lucide `Shield` plus a Motion-drawn check path reproduces `ShieldCheck` with a drawable check (M-C-01). The path string is Lucide's (ISC, already a dependency), so `THIRD_PARTY_NOTICES.md` needs no change |
| N-39-3 | note (tiles) | On tiles narrower than about 260 px, the bottom-left `formatLabel` chip overlaps the small baked OSD line of the video (and of the procedural canvas). Pages may omit `formatLabel` on small tiles, or put it top-left |

**Relays:**

| To | Item |
|---|---|
| 41 (shell) | Nothing is needed. When `MotionPolicyProvider` is mounted, the compositions follow the live policy. They already work without it |
| 42 (Dashboard) | A (§2.1; select `.state`); D (RecIndicator, CameraFeed `variant="tile"`); E (CameraFeed tiles plus DbfsMeter `tile`). Ripple and ShineBorder share `loopGroup="idle-invitation"` (step 37) |
| 43 (Login) | `GlowRing mode="login"` defaults to the emblem centre with a unique gradient id. The M-APP-01 flight still needs the page's `layoutId` emblem; pass it as `center` if the flight needs that element |
| 44 (Session Monitor) | L (CameraFeed `feed`, `actions` = fullscreen, `ref.snapshot()` for M-C-18, `dimmed` for Pause Monitoring); O and R (DbfsMeter `panel` / `compact`); Q (SessionTimeline inside its own ScrollShadow); finalization modal (Stepper `pipeline` plus StepperStamp) |
| 46 (Start Session) | Stepper `wizard`; `GlowRing mode="mini"` on step 3 |
| 47 (Evidence) | `evidenceMedia()` with the excerpt rule. Items without media → `null`, so show the fallback |
| 49 (Devices) | CameraFeed tiles, DbfsMeter `large` (vertical) |
| 52 (System) | Stepper `pipeline` for Update and Lifecycle |
| 56 (tests), 58 (verification) | AC-70 marks: `data-motion` on every composition, `data-ambient` on loop layers. **AC-71: measure in windowed Chrome with the videos playing** (§5.4). AC-61: `?debug=1` shows 20/s per meter instance |
| Controller | `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `implementation/99_implementation_report.md` were **not** edited: they are shared files (parallel run, P8) |

**Persistent issues: none.** Blockers: none.
