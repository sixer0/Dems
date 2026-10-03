---
task_id: 2026-09-30_dems_demo_stack_setup
step: 36
plan_row: 02_plan §4 W-07, part a
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 36: Web motion library (`apps/core-web/src/motion`)

**Outcome: PASS.** Every row-36 check passes. Command output is quoted in §4.

- **Row test.** A unit test shows `useMotionPolicy()` returns the reduced policy and opacity-only variants under `prefers-reduced-motion: reduce`. It also shows every duration, delay and stagger multiplied by 10 under `?motion=slow` on any route.
- **Greps.** MS-01 and MS-02 find nothing.
- **Gates.** core-web typecheck, lint and test exit 0. The final run at 03:13 WIB includes step 38's new shell files. A transient `tsc -b` failure caused only by step 38's in-progress files is recorded under P11 (§4.3).
- **Browser.** A headless Chromium pass measured 60 fps, 0 long tasks, meters at 20/s per channel, the 4-loop cap, the live OS switch, the in-app switch, `?motion=off` and proof mode (§5).
- **Bug found and fixed.** A live switch to reduced motion made settled panels jump 12 px (§6, D-1). A regression test now covers it.
- **Scope.** Writes are confined to `apps/core-web/src/motion/**` plus this log, three screenshots and the step progress file. No package was installed, and no `package.json`, lockfile, `packages/shared/**`, route or shell file was touched (P1, P6).

## 1. Files (all new, under `apps/core-web/src/motion/`)

| File | Lines | Role |
|---|---|---|
| `policy.ts` | 126 | Pure policy resolution (§8, §12, D43): `parseMotionQuery` (`?motion=slow`, `?motion=off`, with aliases `reduced` and `reduce`), `parseDebugQuery`, `resolveMotionPolicy`, guarded localStorage read and write of `dems.motion.reduced`, and `INITIAL_LOCATION_SEARCH` (captured at module load so router redirects cannot drop the switches) |
| `transitions.ts` | 108 | Token → Motion `Transition`: `tween`, `springTransition` (a tween of `slower` × 10 in proof mode, per 01_specs §4.5), `springOptions` (for `useSpring` consumers; ζ-preserving ×10 slow-down), `cappedStagger` (native Motion dynamic `delayChildren`, cap 8), `loopTransition` |
| `variants.ts` | 340 | `buildMotionKit(policy, timeScale)`: transitions, variants, interactions, flags, delays and helpers, as one full set and one reduced set |
| `glow.ts` | 24 | `glowShadow(tone, level)`: brand = the elevation tokens as they are; status tones = the same geometry and alpha steps with the colour from `toneHex` swapped in |
| `glow-layer.tsx` | 116 | `GlowLayer`: pre-rendered levels 1–3 plus a bloom layer. Only opacity moves. Optional breathing (a counted ambient loop) and a one-shot `pulseKey` bloom throttled to `flashMaxHz` |
| `ambient-registry.ts` | 115 | External store of ambient loops: cap `ambientMaxPerViewport` (4), page loops before shell loops, one slot per `group` |
| `use-ambient-loop.ts` | 68 | `useAmbientLoop(label, {ref, priority, group, enabled})` → `{ running, attrs }`. Uses Motion `usePageInView` and `useInView` (R10). `useAmbientSnapshot()` |
| `use-motion-policy.ts` | 47 | `MotionPolicyContext`, `useMotionPolicy()`, and a static full-motion default so components work without a provider |
| `use-media-query.ts` | 44 | Live `matchMedia` through `useSyncExternalStore` |
| `motion-policy-provider.tsx` | 109 | `MotionPolicyProvider`: resolves the policy, sets Motion `reducedMotion` (`'always'` when reduced, else `'user'`) and the default token transition, marks `<html>` (`data-motion`, `data-motion-speed`, `--motion-time-scale`), and renders the overlay gate when `?debug=1` |
| `debug-overlay-gate.tsx` | 13 | `React.lazy` gate, so the overlay is a separate chunk fetched only with `?debug=1` |
| `debug-overlay.tsx` | 169 | Overlay (default export). Shows fps over 1 s windows via Motion `useAnimationFrame`, with the average after a 2 s warm-up; long tasks via PerformanceObserver; ambient slots against the cap; meter frames/s per channel. Also exposes `data-*` attributes for scripted checks |
| `debug-metrics.ts` | 33 | `reportMeterFrame(channel)` (a no-op while the overlay is off) and `drainMeterFrames()` |
| `motion.css` | 27 | Pauses CSS keyframe loops marked `data-ambient="paused"`, and stops `[data-ambient]` CSS loops under `data-motion="reduced"` (so the in-app override reaches CSS too) |
| `index.ts` | 83 | Barrel |
| `__tests__/helpers.ts` | 105 | `fakeMatchMedia`, `memoryStorage`, `renderPolicy`, transition and target resolvers |
| `__tests__/motion-policy.test.tsx` | 334 | **Row acceptance test**, plus the live-switch regression test and the composite-only property walk |
| `__tests__/ambient.test.tsx` | 132 | Cap, priority, group, reduced, `?motion=off`, hidden-tab pause and resume |
| `__tests__/glow-layer.test.tsx` | 125 | Token shadows, layer cross-fade, breathing as a loop, reduced marking, no pulse on mount |
| `__tests__/debug-overlay.test.tsx` | 127 | Absent without `?debug=1`; lazy with it; ambient count; meter rates; breach flag versus shell yield |

Test files are `*.test.tsx`, because `vite.config.ts` includes only `src/**/*.test.tsx`.

## 2. API for later steps (38, 39, 41, 42–53)

- **Mount.** Mount the provider once, and replace the bare `<MotionConfig reducedMotion="user">` in `src/routes/__root.tsx` with `<MotionPolicyProvider>…</MotionPolicyProvider>`.
  - Step 38 currently mounts a bare `MotionConfig`, which is correct for row 38 (it does not depend on 36). The swap belongs to **step 41** (depends on 36 and 38).
  - With no props it reads the real `matchMedia`, localStorage and the load-time URL search.
- **Read.** `const m = useMotionPolicy()`
  - `m.policy` is `'full' | 'reduced'` (the §8 wording), with `m.reduced`, `m.speed`, `m.timeScale`, `m.ambient`, `m.debug` and `m.sources`.
  - `m.variants.{panel, hero, row, fade, rackFocus, mediaIn, container, rowContainer, route, step, stamp, halo}`:
    - panel, hero and the other enter sets use the states `hidden`, `visible` and `exit`;
    - `route` takes `custom` = ±1 (R7);
    - `step` uses `enter`, `center` and `exit` with `custom` = ±1, so it plugs straight into Motion Primitives `TransitionPanel`.
  - `m.transitions.{default, enter, exit, feedback, completion, indicator, layout, crossFade, glow, row}`.
  - `m.interactions.{card, press, iconPress, mediaTile}` supply `whileHover` / `whileTap`.
  - `m.flags`: `ambient`, `stagger`, `sharedLayout` (false → cross-fade instead of `layoutId`), `blur`, `animateNumbers` (false → jump), `flashes`, `chartAnimation` (Recharts `isAnimationActive`), `meterSpring` (null → set directly), `meterMaxHz` (10 when reduced) and `numberTextMaxHz` (4).
  - Helpers:
    - `m.seconds(ms)` gives time-scaled seconds for kit and copied-in item props (BorderBeam `duration`, TextEffect timing);
    - `m.spring(name)`;
    - `m.springOptions(name)` feeds AnimatedNumber `springOptions` (`counter`) and meter smoothing;
    - `m.loop(periodMs, {mirror, delayMs})`;
    - `m.delays.heldBeat` (R4);
    - `m.setReducedOverride(bool)` is the System → Settings "Reduce motion" `Switch`.
- **Ambient loops** (ring rotation, Ken Burns, topographic drift, Particles, Ripple and the rest):
  - call `const loop = useAmbientLoop('ken-burns', { ref, priority: 'page' | 'shell', group, enabled })`;
  - animate only while `loop.running`, and spread `{...loop.attrs}` on the element (AC-70's `data-motion`; `data-ambient` for CSS loops);
  - the shell's topographic drift and SECURE dot should share `group: 'shell'` with `priority: 'shell'` (§9.4).
- **Glow.** Put `<GlowLayer level={2} tone="danger" breathe pulseKey={…} />` as the first child of a `relative`, rounded element. Never animate `box-shadow` (§9.2).
- **Meters (step 39).** Call `reportMeterFrame(channelId)` inside the `useAudioChannel` frame handler. It is a plain counter, so the zero-render rule (MS-08) still holds. The `?debug=1` overlay then shows per-channel frames per second (AC-61).

## 3. Specification coverage

| Spec item | Where |
|---|---|
| §2 tokens (every value from `motion.*` in `@dems/shared/tokens`, 11_token_pipeline §3) | `transitions.ts`, `variants.ts`, `glow.ts`, `ambient-registry.ts` |
| R1 enter (opacity + `rise` + `enterFrom`, `gentle`, stagger 60 after 80, cap 8) | `variants.panel`, `variants.container` |
| R2 exit (opacity + `-exitDrop`, `fast`, `exit`, no stagger) | `transitions.exit`, every `exit` state |
| R4 held beat (120 ms literal, D49) | `delays.heldBeat` |
| R5 layout spring and cross-fade | `transitions.layout` (instant when reduced), `transitions.crossFade` |
| R7 direction | `variants.route`, `variants.step` (`custom` ±1) |
| R8 one pulse, no strobe | `GlowLayer.pulseKey` (one bloom; pulses closer than 1/`flashMaxHz` dropped), `variants.halo` |
| R10 idle respect | `useAmbientLoop` (Motion `usePageInView`, `useInView`), `motion.css` pause |
| §8 reduced policy (OS OR override OR `?motion=off`), `data-motion` | `policy.ts`, provider, `flags`, `GlowLayer`, `useAmbientLoop` |
| §9.2 composite-only properties | Test "animate only composite-friendly properties…" walks every variant in 3 modes |
| §9.4 ≤ 4 ambient loops, shell yields | `ambient-registry.ts` |
| §9.5 `?debug=1` overlay (fps, long tasks, ambient loops, meter frames/s) | `debug-overlay.tsx`, `debug-metrics.ts` |
| §12 / 01_specs §4.5 proof mode ×10, springs → tweens | `transitions.ts`; provider sets `--motion-time-scale` for CSS |
| D43 test / reduced switch | `?motion=off` |

## 4. Verification (row-36 checks, with output)

### 4.1 Row checks

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Policy unit test: reduced variants under `prefers-reduced-motion` | `npm test -w @dems/core-web -- --maxWorkers=2 --reporter=verbose` | ✓ "returns the reduced policy and opacity-only variants of at most `fast`, with no stagger"; ✓ "also reads the real window.matchMedia when no seam is passed"; ✓ "follows a live change of the OS setting without a reload" (PASS) |
| 1 | Policy unit test: ×10 under `?motion=slow` on any route | same | ✓ "multiplies every duration, delay and stagger by proofSlowFactor (10) on any route" (`/evidence/EV-2026-0001?motion=slow`; exit 0.16 → 1.6 s; spring → tween 6.4 s `luxe`; stagger 0.08 / 0.14 s → ×10; cap at the 8th item; `seconds(240)` = 2.4; ζ preserved for `useSpring` options) (PASS) |
| 2 | MS-01 (AC-72) | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src` | no output, exit 1 (PASS) |
| 2 | MS-02 | `grep -rn "box-shadow" apps/core-web/src --include=*.tsx \| grep -E "animate\|transition"` (run under bash; zsh needs the glob quoted) | no output, exit 1 (PASS) |
| 3 | core-web lint | `npm run lint -w @dems/core-web`; `oxlint -f json` | exit 0; `0 diagnostics in 40 files, 116 rules` at 03:04; `0 diagnostics in 77 files; 0 in src/motion` at 03:13 (PASS) |
| 3 | core-web test | `npm test -w @dems/core-web -- --maxWorkers=2` | `Test Files 5 passed (5)`, `Tests 33 passed (33)`, exit 0: 32 motion tests plus the existing W-1 home-page test. Same result at 03:13 (PASS) |
| 3 | core-web typecheck | `npm run typecheck -w @dems/core-web` (`tsc -b`) | exit 0 at 03:00 WIB (before step 38's files) and **exit 0 at 03:13 WIB** (with them); 0 errors. Runs in between: §4.3 (P11) |

### 4.2 Additional checks

| Check | Command | Result |
|---|---|---|
| MS-03 (my scope) | `grep -rnE "will-change" apps/core-web/src/motion` | none. The library adds no `will-change` |
| Shadow references | `grep -rnE "boxShadow\|box-shadow" apps/core-web/src/motion` (non-test) | only the static `style={{ boxShadow: … }}` of the pre-rendered glow layers (`glow-layer.tsx:101`, `:112`), as §9.2 prescribes |
| Tests are not vacuous | Three deliberate breakages, each restored from a backup (`cmp` identical afterwards): (a) the reduced panel keeps a 12 px rise; (b) the time scale is ignored; (c) the OS setting is ignored | (a) 1 failed, (b) 1 failed, (c) 6 failed |
| Scoped typecheck (my files only; §4.3) | `tsc -p <scratch>/tsconfig.motion.json` (extends `tsconfig.app.json`; includes `src/motion`, `src/lib`, `src/test/setup.ts`) | exit 0 over my 20 files plus their imports |
| Write scope | `git status --short --untracked-files=all apps/core-web/src/motion` | 20 new files, all mine. No change to `package.json`, lockfile, `packages/shared/**`, routes or shell |

### 4.3 P11 record (concurrent step 38)

At 03:04 WIB, `tsc -b` exited 2 with 3 errors, **none in `src/motion`**:

- `src/components/shell/sidebar.tsx(67,7)`
- `src/main.tsx(14,29)`
- `src/routes/__root.tsx(125,17)`

All three are route-typing errors in files step 38 was writing at the time (its progress file shows it started at 02:59; `routeTree.gen.ts` not yet regenerated).

A background poll then re-ran `tsc -b` every 60 s. Every try had **0 errors in `src/motion`**:

| WIB | `tsc -b` exit | Errors |
|---|---|---|
| 03:06 | 2 | 6 |
| 03:07:47 | 2 | 7 |
| 03:08:49 | 2 | 9 |
| 03:09:51 | 2 | 9 |
| 03:10:53 | 2 | 9 |
| 03:11:56 | 2 | 35 |
| **03:12:58** | **0** | **0** |

A scoped `tsc` over only my files stayed at exit 0 throughout (§4.2).

### 4.4 Final run (03:13 WIB, with step 38's files present)

| Check | Result |
|---|---|
| `npm run typecheck -w @dems/core-web` | exit 0, 0 errors |
| `npm run lint -w @dems/core-web`; `oxlint -f json` | exit 0; 0 diagnostics in 77 files, 0 in `src/motion` |
| `npm test -w @dems/core-web -- --maxWorkers=2` | exit 0; `Test Files 5 passed (5)`, `Tests 33 passed (33)` |
| MS-01 / MS-02 (bash) | exit 1 / exit 1 (no matches) |

## 5. Browser check (headless Chromium over CDP; scratch harness)

**Method.**
- **Harness.** A throwaway Vite harness in the session scratchpad (not in the workspace) imports `@/motion` from `apps/core-web/src`. It renders 10 staggered panels with `GlowLayer`, 4 page loops plus 1 shell loop, and a fake 20 Hz meter calling `reportMeterFrame`.
- **Server.** It is served on **127.0.0.1:5177**. P4's web-coder port 5174 was taken by `SMART WMS/apps/axiom-web` (PID 3550), and 5175 by `SMART WMS/apps/pwms` (PID 3521, `[::1]`). Neither was touched.
- **Browser.** Playwright's cached `chrome-headless-shell` (build 1243) was driven through CDP with Node 26's global `WebSocket`. No package was installed.
- **Why not the pane.** The in-app Browser pane was hidden (`document.visibilityState: "hidden"`). That already showed R10 working, since the loops held at 0/4 there, but it cannot measure frame rates.

**Measurements** (1440×900; final code; `cdp-final.json` in scratch):

| Scenario | html `data-motion` / speed | fps (avg) | Long tasks | Ambient running/requested | Meters | Panels 0 and 9 | Glow |
|---|---|---|---|---|---|---|---|
| A `?debug=1` at 1.5 s | full / normal ×1 | 61 (61) | 0 | 4/5, "shell paused" (topo-drift yields; no breach) | AUDIO-01 20/s, AUDIO-02 20/s | opacity 1, transform none | breathing |
| E OS reduce, emulated live (`Emulation.setEmulatedMedia`) | reduced | 60 | 0 | 0/0 | 20/s | **opacity 1, transform none** (after the D-1 fix) | reduced / paused |
| E cleared | full | 60 | 0 | 4/5 | 20/s | 1 / none | running |
| D in-app switch on | reduced; `localStorage dems.motion.reduced = "1"` | 60 | 0 | 0/0 | 20/s | 1 / none | reduced / paused |
| D switch off | full; key removed | 60 | 0 | 4/5 | 20/s | 1 / none | running |
| F pulse (+120 ms, +1,020 ms) | full | 60 | 0 | 4/5 | 20/s | – | bloom opacity 0.67, then 0 (one pulse) |
| B `?motion=slow` at 1.0 s | full / slow ×10, `--motion-time-scale: 10` | (first window) | 0 | 4/5 | – | p0 opacity 0.113, `translateY 10.6 px`, scale 0.982 (mid-transition); p9 not started | – |
| B at 8.0 s | full / slow | 60 | 0 | 4/5 | 20/s | p0 final (1 / none); p9 0.951 (lands at ≈11.4 s: 0.5 s capped delay ×10 + 6.4 s) | – |
| C `?motion=off` at 1.5 s | reduced | 61 | 0 | 0/0 | 20/s | 1 / none | reduced / paused |

**Screenshots:**
- `implementation/assets/17_motion_debug_overlay.png`: the overlay reads "full · normal ×1 | 60 (avg 60) | 0 (0 after warm-up) | 4/4 (shell paused) | … | AUDIO-01 20/s · AUDIO-02 20/s".
- `17_motion_slow_1000ms.png`: proof mode mid-transition.
- `17_motion_slow_8000ms.png`: proof mode, later frame.

MS-10 holds: the mid-transition frame differs from the final frame.

**Processes (P7).** I started and then stopped:
- the Vite harness, PID 87287;
- headless Chromium, PID 88113 (stopped and relaunched outside the Vite root, see D-4);
- headless Chromium, PID 89575.

Ports 5177 and 9337 were free afterwards. The scratch Chrome profile was deleted, and the Browser-pane tab I opened (tab-3) was closed. mock-core was not used.

## 6. Decisions, drift and notes for the controller

| ID | Item | Resolution |
|---|---|---|
| D-1 | **Bug found in the browser, fixed test-first.** When the policy flipped to reduced on a live page, settled panels jumped to `translateY(12px) scale(0.98)`. The reduced `visible` target lacked `y`/`scale`, and Motion returns a key that leaves the target to its mount-time `initial` value | A regression test ("leaves settled elements at rest when motion becomes reduced") reproduced it: red, `translateY(12px) scale(0.98)`. Now the reduced `visible` animates opacity only and **pins** each transform or filter key of the full set at its resting value (`y 0`, `x 0`, `scale 1`, `blur(0px)`). The test is green, and the browser shows `transform: none` after the live switch |
| D-2 | `useMotionPolicy()` returns an object, not a bare string | Its `.policy` is `'full' \| 'reduced'` exactly as §8 words it. The object also carries the speed and the matching variants, which the row-36 acceptance test needs ("returns reduced variants … 10x durations") |
| D-3 | The OS setting is read live (`useSyncExternalStore` over `matchMedia`) rather than through Motion's `useReducedMotion()` | Motion 13.4.6 `useReducedMotion` reads once (`useState(prefersReducedMotion.current)`) and does not follow changes. The live read makes DevTools "Emulate prefers-reduced-motion" (AC-70, MS-06) apply without a reload, as proven in scenario E. Motion itself still gets `reducedMotion` through `MotionConfig`. Ready-made Motion primitives are used for the rest (D6): `MotionConfig`, `usePageInView`, `useInView`, `useAnimationFrame`, `useAnimate`, dynamic `delayChildren` |
| D-4 | Harness only: my first Chrome profile sat inside the Vite root, so Vite's watcher reloaded the page mid-run | The profile was moved outside the root and the run repeated. Not a library issue |
| D-5 | `delayChildren` is multiplied in proof mode too (80 → 800 ms) | §12 says ×10 "on every duration and stagger", and a delay is a duration. The row-17 scaffold scaled only the stagger. A 10-item stagger therefore lands at ≈11.4 s in proof mode (bounded by the cap of 8) |
| D-6 | `?debug=1` gating | The overlay renders when `?debug=1` is present, in dev or production. It is a separate lazy chunk, so it is absent from the entry chunk (§9.5 "excluded from production builds"; AC-73 budget). Switches are read from the URL captured at module load, so `/` → `/dashboard` redirects keep them |
| D-7 | Overlay "breach" semantics | Red only when a **page** loop is suppressed (a real P3 breach). A shell loop yielding to four page loops is §9.4 by design, shown as "(shell paused)" |
| D-8 | Spec literals, not tokens (D49) | Held beat 120; row stagger 30 ms and first 10 rows (M-C-11); row exit 120; media-in 600; halo 600 and ×1.35 (M-C-10); hover 200; icon press 0.94 (M-C-16). These are exported named constants with their spec IDs. No token was added (no `packages/shared` write) |
| D-9 | Error logging (coder-execution STEP 3) | Not applicable in the persistent form: D41(g) rules out a client error-log endpoint on mock-core. The only failure paths are storage access (guarded; falls back to the OS setting; the switch still applies for the page view), a missing `matchMedia`, and unsupported `PerformanceObserver('longtask')` (the overlay shows "n/a"). None is user data, and none needs user feedback |
| N-1 | **Port note for web lanes (P4).** 5174 (IPv4) and 5175 (IPv6) are held by SMART WMS dev servers (PIDs 3550, 3521) | Web coders B and C on 5175 and 5176 may hit `strictPort` errors. The spares are 5177 and 5178. Same situation as D41(f) for 5173 |
| N-2 | **Integration owner.** Step 38's `__root.tsx` mounts a bare `MotionConfig` | Step 41 (depends on 36 and 38) should replace it with `MotionPolicyProvider` (§2). Step 39's DbfsMeter should call `reportMeterFrame` (AC-61) and read `flags.meterSpring` / `flags.meterMaxHz`. Step 52 (System) binds `setReducedOverride` to the Settings `Switch`. Step 56 (`reduced-motion.test.tsx`, AC-70) can reuse `__tests__/helpers.ts` (`fakeMatchMedia`) |
| N-3 | Motion's dev-only console warning "You have Reduced Motion enabled on your device" appears when reduced motion is on | It comes from Motion's `warnOnce` in development. It is informational and absent from production builds |
