---
task_id: 2026-09-30_dems_demo_stack_setup
step: 41
plan_row: 02_plan §4 W-07, part b (app-level and shell motion)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
decisions: D41(d), D49, D53, D59, D60, D63
---

# Step 41: App-level and shell motion

**Outcome: PASS.** Every row-41 check passes. Command output is in §5 and the browser measurements are in §6.

- **H-M1: falsified, so the fallback is used** (§3).
  - A unit test runs the native pattern: a keyed `AnimatePresence` around the top-level `<Outlet />`. The exiting copy re-renders with the new route, so the shell would mount twice and Login is lost.
  - The fallback is the two-phase hand-off: each side plays its own exit, then navigates.
  - A browser trace shows the emblem still flies natively through the shared `layoutId`. At the commit it starts at the Login box `[635, 318, 170]` and settles at the top-bar slot `[20, 16, 48]` in about 700 ms. No stored DOMRect is needed.
- **Reduced-motion test for shell loops passes** (`src/test/shell-motion.test.tsx`).
  - In the test: under reduced motion the topographic drift, SECURE dot, SECURE beam and clock colon carry `data-motion="reduced"` and `data-ambient="paused"`. There is no BorderBeam, no pulse and no SlidingNumber, and the nav card has no `layoutId`.
  - In the browser: the same holds for both the live OS switch and the in-app switch.
- **MS-01, MS-02 and MS-03 greps find nothing** (MS-03 is an extra check).
- **Gates.** core-web typecheck, lint (0 diagnostics in 100 files) and test (8 files, 109 tests) exit 0.
- **Headless Chromium at 1920×1080 and 1440×900** (Vite lane A on 5176, `dems.auth` seeded with OPR-001):
  - 60.1 and 60.2 fps idle, and 60.0 to 60.2 fps with the SECURE beam running;
  - 0 long tasks in steady state;
  - 1 of 4 ambient slots used by the shell;
  - route exit plus enter complete in about 870 ms;
  - reduced motion is static at 60 fps.
- **Screenshots:** 26 files in `implementation/assets/21_*.png`.

Run on 2026-10-01, 03:48 to 04:31 WIB. No `npm install` was run and no `package.json`, lockfile or `packages/shared/**` file was touched. No page feature folder was touched and no `vite build` was run. Nothing was committed.

## 1. Files (all under `apps/core-web/src/`)

| File | Change | Role |
|---|---|---|
| `routes/__root.tsx` | modified | `MotionPolicyProvider` replaces the bare `MotionConfig reducedMotion="user"` (D59). A root `<LayoutGroup id="dems">` wraps the `<Outlet />`. The top-level route is recorded per router, for the entrance decision. The H-M1 finding is documented in the header |
| `router.tsx` | modified (one option) | `defaultViewTransition: ROUTE_VIEW_TRANSITION`, a typed view transition for in-shell path changes (M-APP-04) |
| `components/shell/route-view-transition.ts` | new | `routeViewTransitionTypes` gives `['dems-route', 'dems-forward' \| 'dems-back']` for in-shell path changes. It returns `false` for search-only changes and for anything crossing `/login`. Also `supportsRouteViewTransition()` and `historyIndex()`. No React import, so it can sit in the entry chunk |
| `components/shell/route-transition.tsx` | new | `RouteTransition` is the content wrapper, keyed on the **committed** leaf match (§7 DR-41-3). R7 direction comes from the history index. The enter waits for the exit (or for the shell entrance). It plays `exit` on sign-out |
| `components/shell/shell-entrance.ts` | new | `resolveShellEntrance` (pure) returns `handoff`, `cold` or `plain`. Also `noteTopLevelRoute` (a WeakMap per router) and `markShellIntroShown`, which sets `sessionStorage['dems.shell.intro']` |
| `components/shell/shell-choreography.ts` | new | `buildShellChoreography(entrance, kit)` builds the variants for the root, top bar, wordmark, sidebar, nav items and bottom tabs, plus `contentDelayMs` and the emblem draw timing. Full, reduced and ×10 proof mode |
| `components/shell/shell-motion-context.ts` | new | `ShellMotionContext` / `useShellMotion` (choreography and `leaving`), and `RouteEnterDelayContext` / `useRouteEnterDelay` |
| `components/shell/exit-guard.tsx` | new | An error boundary that hides a page failing *during* the sign-out exit. Any other error passes on to the router boundary |
| `components/shell/shared-layout-ids.ts` | new | `BRAND_EMBLEM_LAYOUT_ID = 'brand-emblem'`, the R5 ID step 43 imports |
| `components/shell/app-layout.tsx` | modified | M-APP-02: the shell plays its exit, then navigates to `/login`. A guard timeout (880 ms × time scale) makes sure it always leaves. Uses `ExitGuard` and `RouteTransition` |
| `components/shell/app-shell.tsx` | modified | The root is a Motion variant root (`initial` and `animate` driven by entrance and `leaving`, with `inert` while leaving). It carries `data-entrance` and `data-leaving` and provides `ShellMotionContext` |
| `components/shell/top-bar.tsx` | modified | Top-bar surface moved to its own `dems-topbar-bg` layer. Drop-in variants on the surface, lockup text and cluster. The emblem slot is `motion.span layoutId="brand-emblem"` (memoised lockup). M-SH-04 clock (SlidingNumber plus breathing colons as a shell loop). M-SH-08 hamburger → × |
| `components/shell/sidebar.tsx` | modified | M-SH-01: AnimatedBackground hover, CSS sheen span, icon brighten. M-SH-02: `NavActiveIndicator` (`layoutId="nav-active"`, `indicator` spring, e3 trail). M-SH-03: `layout` FLIP with `layout="position"` children and the label stagger. M-SH-07: `TopoTexture` loop. The sidebar has its own LayoutGroup |
| `components/shell/secure-pill.tsx` | modified | M-SH-05: dot breath loop, escalation ring pulse (only on a rise, R8), and a `SecureBeam` that mounts MU BorderBeam while ATTENTION or CRITICAL and the loop runs |
| `components/shell/notifications-bell.tsx` | modified | M-SH-06: bell swing plus badge pop when the unacknowledged count rises, throttled to once per 5 s. `data-swings` counter |
| `components/shell/page-header.tsx` | modified | M-APP-04 title: MP TextEffect `fade-in-blur` `per="word"` (speedReveal 1.4), delayed by `useRouteEnterDelay()`. The `<h1>` keeps its accessible name |
| `components/shell/brand-emblem.tsx` | modified | `draw` prop for the M-APP-03 stroke draw (`pathLength`, shield then arcs 70 ms apart). Off under reduced motion |
| `components/shell/bottom-tabs.tsx`, `nav-drawer.tsx` | modified | Bottom tabs follow the choreography. The Drawer list has its own LayoutGroup |
| `components/shell/index.ts` | modified | Adds exports: `RouteTransition`, `useRouteEnterDelay`, `BRAND_EMBLEM_LAYOUT_ID`, `ShellEntrance` |
| `components/shell/shell.css` | modified | Motion sections (see §4). Adds: token mirrors on `:root`, the focus glow, the top-bar layer, nav z-order, sheen, trail, topo drift, dot breath layer, ring, bell, clock face, burger, title word gradient, `.dems-route`, view-transition rules and five keyframes (transform and opacity only) |
| `test/shell-motion.test.tsx` | new | 30 tests (§5.2) |

**Evidence images:** `implementation/assets/21_{1920,1440}_{cold_mid, cold_end, debug_overlay, route_mid_exit, route_settled, rail, nav_hover, secure_attention, secure_critical, reduced_os, handoff_settled}.png`, `21_1440_proof_slow_route_{mid,end}.png` and `21_hm1_flight_{mid,end}.png` (§6).

## 2. Hand-offs (API for later steps)

- **Step 43 (Login, M-APP-01/02 Login side).** This is the fallback that the trace proved.
  1. Render the ring-centre emblem as `<motion.div layoutId={BRAND_EMBLEM_LAYOUT_ID} transition={m.transitions.layout}>` (import from `@/components/shell/shared-layout-ids`). Drop `layoutId` when `m.flags.sharedLayout` is false.
  2. On success, play the Login exit (card, text, bloom; t = 0 to 600). Keep the emblem visible and never inside a faded parent. Only then call `navigate`.
  3. In the same commit the top-bar emblem mounts and Motion flies it from the Login box (spring `gentle`, about 700 ms). The shell's own entrance (`handoff`: top bar +150, sidebar +230, page +350) starts on its own, because the shell sees `/login` as the previous top-level route.
  4. On sign-out the shell exits first (about 300 ms). Login's emblem then mounts with the same `layoutId`, so it flies back from the top bar. It must not start at `opacity: 0`.
  5. Step 43 should record MS-07 in the real app. The trace in §3 used a scratch harness.
- **Pages (steps 42–53).**
  - The routed page is inside `RouteTransition`, whose variants are `hidden` → `visible` → `exit` with `delayChildren` = the route delay.
  - A page root that declares only `variants={m.variants.container}` (no `initial` or `animate`) inherits them. It starts after the exit, and it exits with no stagger on sign-out (R2).
  - Pages that set their own `initial` or `animate` can add `useRouteEnterDelay()` ms to their first delay.
  - `PageHeader` animates its title automatically.
  - Pages must tolerate `operator === null` for about 300 ms after a sign-out. If they throw, `ExitGuard` hides them.
- **Step 52 (System → Settings).** Bind the "Reduce motion" `Switch` to `useMotionPolicy().setReducedOverride`. The shell follows it live (§6: the in-app switch).
- **Step 56 (AC-70, `reduced-motion.test.tsx`).** It can reuse the `stubMatchMedia` and `VisibleObserver` helpers from `shell-motion.test.tsx`. Shell loops are marked with `data-motion` and `data-ambient`.
- **Step 45 (CP-2, port 5173).** Open `?debug=1` to see the ambient list (`clock-colon, secure-dot, topo-drift`, plus `secure-beam` when degraded). The shell holds one of the four slots.
- **Step 42 (Dashboard hero, M-C-13).** The "gold rule under the tagline" wipe of M-APP-03 is the hero's rule (DR-41-12).

## 3. H-M1: the test and the trace that decided it

**Hypothesis (03_motion_spec §4, §12).** TanStack Router plus `AnimatePresence` can keep the exiting Login route mounted for the cross-route `layoutId` flight.

**1. Source reading** (`@tanstack/react-router` 1.170.40):
- `Match.js` `Outlet`: it resolves its child with `useSelector(router.stores.ids, …)`, so an `<Outlet />` inside an exiting element follows the store to the new match.
- `@tanstack/router-core` `stores.js` `setMatches`: it clears the old route's match store (`byRoute.get(id).set(() => void 0)`), so a "frozen" `<Match routeId="/login">` would read `undefined`.

**2. Unit test (decisive):** `shell-motion.test.tsx`, "does not hold for TanStack Router 1.170: the exiting copy re-renders with the NEW route".
- **Setup:** a probe router whose root is `<AnimatePresence mode="sync"><motion.div key={topLevel} exit={{opacity: 0}} transition={{duration: 10}}><Outlet/></motion.div></AnimatePresence>`, run with real animations.
- **Action:** navigate from `/login` to `/app`.
- **Assertions:**
  - two wrappers are mounted, and the exiting one is keyed `/login`;
  - that exiting wrapper contains `probe-app`, not `probe-login`;
  - `probe-app` appears **twice**.
- **Result:** ✓ (passes). So the native pattern fails: the shell would mount twice, with duplicate effects and test IDs. The root therefore has **no keyed `AnimatePresence`**, only the `LayoutGroup`.

**3. Browser trace (the flight itself).**
- **Harness:** a scratch Vite harness on spare port 5179 (D59), built from the real `BrandEmblem`, `MotionPolicyProvider` and TanStack Router.
  - A Login-like route has a 170 px emblem at the centre.
  - A shell-like route has the 48 px top-bar slot.
  - Both use `layoutId="brand-emblem"` inside one root LayoutGroup.
  - The Login side plays its card exit (`scale 0.96`, `y 8`, opacity), then navigates.
- **Trace:** the emblem box `[left, top, width]` was sampled on every frame (`scratchpad/hm1-trace.json`).

| t (ms) | Login emblem | Shell emblem | Login route mounted |
|---|---|---|---|
| 2 | [635, 318, 170] | — | yes |
| 462 | (navigate called) | | |
| 479 | — | **[635, 318, 170]** | no |
| 525 | — | [583, 292, 160] | no |
| 607 | — | [347, 176, 113] | no |
| 708 | — | [153, 81, 74] | no |
| 842 | — | [54, 32, 55] | no |
| 1,009 | — | [25, 19, 49] | no |
| 1,208 | — | [20, 16, 48] (settled) | no |

- **Reading:** the old route is unmounted in the same commit (`loginRoute` false at 479). Motion still hands the old node's measured box to the new one: `projection.unmount()` → `willUpdate()` snapshots it while it is still attached, and `NodeStack.promote` passes it on. So the flight is continuous with no jump, which is MS-07's condition.
- **Screenshots:** `21_hm1_flight_mid.png` (in flight) and `21_hm1_flight_end.png`.

**Outcome.** **Fallback** (two-phase hand-off), with the flight done by Motion's shared `layoutId`, not by a stored DOMRect. The spec's DOMRect variant is not needed. See DR-41-1.

The same mechanism moves the sidebar's `nav-active` card. In §6 its `top` travels 96 → 288 px in about 300 ms with a largest frame step of 24.6 px (1920).

## 4. Specification coverage

| Spec | Implementation | Reduced motion (§8) |
|---|---|---|
| **M-APP-01** (shell side) | Root `LayoutGroup`; emblem slot `layoutId="brand-emblem"`, spring `gentle`. `handoff` entrance: top-bar surface and cluster drop `y -24 → 0` at +150, wordmark rack-focus at +150, sidebar `x -24 → 0` at +230 with items 30 ms apart, page at +350 | No `layoutId`; every part fades, opacity only, `fast`, no delay |
| **M-APP-02** | The shell exits first: content at 0, sidebar at +60, top bar at +120 (each `fast`, `exit`). The emblem stays, the shell is `inert`, then `/login`. Measured 325–328 ms | Same order, opacity only |
| **M-APP-03** | `cold` entrance once per session: shield draws 500 ms, arcs start 70 ms apart, 240 ms each; wordmark rack-focus at +600; shell fade 240 ms at +600; page enter at +600 (arcs done ≈ 1,090 ms, ≤ 1,400 ms) | No draw; opacity fade |
| **M-APP-04** | Typed view transition: old content snapshot `opacity → 0` over 160 ms with `exit` easing; the shell stays live and still. New page: `y +12` (forward) or `−12` (back, R7) → 0 with spring `gentle`, delayed 160 ms. Title TextEffect `fade-in-blur`, per word, speedReveal 1.4. Scroll reset by the router. Search-only changes do not transition | Cross-fade: 160 ms snapshot fade plus the page fading in with no delay, opacity only |
| **M-SH-01** | AnimatedBackground hover (spring `indicator`); one-shot sheen `translateX -100% → 100%` (700 ms, `luxe`); icon brightens (`fast`) | Sheen off; hover background cross-fades |
| **M-SH-02** | `layoutId="nav-active"` card (spring `indicator`). The e3 trail layer's opacity goes 0 → 1 → 0 during travel (`slow`). Icon colour at `base`. The card sits under all item content, so it never covers a label in flight | Card cross-fades in at the destination |
| **M-SH-03** | `layout` FLIP on the panel (scale 3.18 → 1 measured, never a width transition). `layout="position"` children keep the list unsquashed. Labels fade `x -8 → 0`, `fast`, 20 ms apart, when the panel expands. Rail tooltips are unchanged from step 38 | Instant resize; labels fade |
| **M-SH-04** | MP SlidingNumber per group (only changed digits move). Colons breathe 1 ↔ 0.55, 1 s cycle, sine, as a shell loop | Plain digits, steady colons |
| **M-SH-05** | Dot glow layer breathes 0.55 ↔ 1 over `glowBreath`. Colour transition 400 ms. One ring pulse (1 → 1.6, 0.5 → 0, 600 ms) on escalation only. MU BorderBeam (6 s lap, `size 220`, amber or red → bronze) while ATTENTION or CRITICAL; it stops on recovery | Steady dot, colour change only, no pulse, no beam |
| **M-SH-06** | Badge pop `--dems-badge-scale 0.6 → 1` (spring `bouncy`); bell swing `0 → 12° → −8° → 0` over 600 ms; once per 5 s burst | Badge simply appears |
| **M-SH-07** | Image layer `translateY 0 ↔ −12 px` and opacity 0.625 ↔ 1 (REC-35-1), 40 s cycle, sine, alternating. The static CSS glow is kept (D53) | Static |
| **M-SH-08** | Kit Drawer transition unchanged (D6); hamburger lines morph to × (`base`) | Instant glyph swap |
| **M-C-25** (focus ring, listed in the brief) | 2 px ring appears instantly (outline never transitions); the e2 glow fades in over 120 ms through `--dems-focus-glow` | Glow without the fade |
| **§9.4 budget** | Topographic drift, SECURE dot, clock colon and SECURE beam share **one** `shell` slot (priority `shell`, yields to page loops) | All paused |
| **§9.2 properties** | Only transform and opacity animate (plus SVG `pathLength` on the emblem and the focus-glow colour property). A test walks every keyframe and CSS transition declaration | — |
| **Reduced-motion switch** | OS setting (live), in-app override (`localStorage dems.motion.reduced`, UI in step 52), `?motion=off`, all through `MotionPolicyProvider` | — |
| **Proof mode** | `?motion=slow`: every shell duration and delay ×10 (Motion via `m.seconds`, CSS via `--motion-time-scale`). The route exit took ≈ 1.6 s: the mid frame at 953 ms differs from the end frame (MS-10) | — |

## 5. Verification (row-41 checks, with output)

### 5.1 Row checks (final run 04:28:40 WIB, after the last code edit)

| # | Check | Command | Result |
|---|---|---|---|
| 1 | H-M1 outcome recorded with the deciding test or trace | §3; `npx vitest run src/test/shell-motion.test.tsx` | ✓ H-M1 probe test passes (the native pattern fails). Browser trace in §3. Outcome: fallback |
| 2 | Reduced-motion test for shell loops | same file: "reduced motion: every shell loop is static and marked data-motion="reduced" (the row-41 test)" | ✓ passes (also the full-motion counterpart and the provider tests) |
| 3 | MS-01 (AC-72) | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src` | no output, exit 1 (PASS) |
| 4 | MS-02 | `grep -rn "box-shadow" apps/core-web/src --include=*.tsx \| grep -E "animate\|transition"` (bash) | no output, exit 1 (PASS) |
| 5 | core-web typecheck | `npm run typecheck -w @dems/core-web` | exit 0 |
| 6 | core-web lint | `npm run lint -w @dems/core-web`; `npx oxlint -f json` (in `apps/core-web`) | exit 0; `diagnostics 0 files 100 rules 116` |
| 7 | core-web test | `npm test -w @dems/core-web -- --maxWorkers=2` | `Test Files 8 passed (8)`, `Tests 109 passed (109)`, exit 0: 79 existing tests and 30 new |
| extra | MS-03 | `grep -rnE "will-change" apps/core-web/src` | no output, exit 1 (the shell adds no `will-change`) |

### 5.2 `src/test/shell-motion.test.tsx` (30 tests)

Groups:
- **H-M1 probe** (1 test).
- **MotionPolicyProvider mount** (2): `html[data-motion]` is `full`, or `reduced` from the OS setting or the in-app switch.
- **Shell loops** (2): full (one shell slot running, SlidingNumber, no beam while SECURE) and reduced.
- **SECURE and bell** (2):
  - escalation pulses 0 → 1 → 2 and starts the beam;
  - recovery leaves the pulses at 2 and removes the beam;
  - the bell swings once within a 5 s burst.
- **Sidebar** (2): one `nav-active` card with `data-layout-id`, moved to the new item; nine hover wrappers and nine sheen spans; rail round-trip.
- **Route transitions** (4):
  - re-keyed per path, forward, then back after `history.back()`;
  - search-only changes keep the same element;
  - the TextEffect `<h1>` keeps its name "DEVICES & INPUTS";
  - view-transition types for forward, back, search-only, `/login` crossings and first load.
- **Entrances and exit** (6):
  - cold then plain in one session;
  - cold under reduced motion does not draw;
  - Login stub sign-in gives `handoff`;
  - sign-out gives `data-leaving` plus `inert`, then `/login`;
  - ExitGuard hides while leaving and passes errors on otherwise;
  - choreography values, including proof mode (top-bar delay 1.5 s).
- **CSS literals** (11):
  - 10 `:root` motion literals equal the tokens (`@dems/shared/tokens`);
  - keyframes move only transform and opacity, and no CSS `transition` touches layout, outline or shadow.

**The tests are not vacuous.** Six single mutations were each restored from a backup, and `cmp` confirmed each file identical afterwards:

| Mutation | Result |
|---|---|
| (a) The topo layer drops its loop attributes | 2 failed |
| (b) Direction always forward | 1 failed |
| (c) View transition allowed across `/login` | 1 failed |
| (d) Pulse on de-escalation | 1 failed |
| (e) No hand-off detection | 1 failed |
| (f) SlidingNumber under reduced motion | 1 failed |

**Note:** the CSS-literal tests read `shell.css` from `process.cwd()/src/components/shell/`. Vitest does not process CSS, so a `?raw` import would come back empty. Run them with core-web as the working directory, as `npm test -w @dems/core-web` does.

## 6. Browser check (headless Chromium over CDP)

**Method.**
- **Server.** `npx vite --port 5176 --strictPort --host 127.0.0.1` in `apps/core-web`: web lane A (D59); 5174 and 5175 were not used.
- **Browser.** Playwright's cached `chrome-headless-shell` 1243, driven over CDP with Node 26's `WebSocket` (`scratchpad/cdp.mjs`, `shell-motion-check.mjs`).
- **Sign-in.** `sessionStorage['dems.auth'] = {"operatorId":"OPR-001","issuedAt":…}` (P4: off 5173 the Core link is offline).
- **Sampling.**
  - Per-frame sampling with `requestAnimationFrame`.
  - Long tasks through a `PerformanceObserver` injected before load.
  - `?debug=1` overlay attributes.
  - Faults injected through the page's own simulator (found via the React fiber, inspection only).
- **Final run.** Both viewports ran on the final code at 04:29 WIB (`results-1920.json`, `results-1440.json`).

| Measurement | 1920×1080 | 1440×900 |
|---|---|---|
| M-APP-03 cold entry (`data-entrance`, stroke draw, session flag) | cold, draw on, flag set | cold, draw on, flag set |
| Idle fps (5 s, own rAF counter) / overlay | 60.1 / 61 (avg 61) | 60.2 / 61 (avg 61) |
| Long tasks in 5 s steady state / in the route transition | 0 / 0 | 0 / 0 |
| Long tasks since load (dev build, app boot) | 1 (87 ms at t = 123 ms) | 0 |
| Ambient slots (overlay) | 1/4, `clock-colon, secure-dot, topo-drift`; no breach | same |
| Typed view transitions supported | `startViewTransition` yes, types yes | yes, yes |
| M-APP-04 forward (click Devices) | transition active 32–215 ms; new key at 53 ms (inside it); wrapper opacity 1 at 865 ms; `y 12 → 0` | active 43–243 ms; new key at 76 ms; opacity 1 at 876 ms |
| M-APP-04 back (`history.back()`) | `data-direction=back`, `translateY(-12px)` → 0 | same |
| M-SH-02 card travel (`top`) | 96.3 → 288 px, largest frame step 24.6 px | 84.3 → 246 px, largest step 36.8 px |
| M-SH-03 collapse (visual width) / expand | 232 → 108 → 72.2 (panel `scaleX` 3.18 → 1) / 72.1 → 231.8, labels 0.08 → 1 | 216 → 107 → 72.2 / 72.1 → 215.8 |
| M-SH-01 hover | `data-checked=true`, 1 hover layer, sheen `dems-sheen` | same |
| M-SH-05 / M-SH-06: FAN_STALL | ATTENTION, pulses 1, ring on, beam mounted and running, swings 1, badge 1 | same |
| CAMERA_LOSS (within 5 s) | CRITICAL, pulses 2, beam on, swings still 1 (throttled) | same |
| fps / long tasks with the beam running (4 s) | 60.2 / 0 | 60.0 / 0 |
| Recovery (faults cleared) | SECURE, pulses stay 2, beam removed | same |
| Reduced motion, OS (`Emulation.setEmulatedMedia`, live) | `html[data-motion=reduced]`; colon, topo and dot animations `none`; all 4 loop elements `paused/reduced`; SlidingNumber off; no `layoutId`; 60.2 fps | same, 60.1 fps |
| Reduced route change | cross-fade: wrapper opacity 0.06 → 0.78 within about 50 ms, no transform | same |
| Reduced OS cleared | back to `full`; loops running | same |
| In-app switch (`dems.motion.reduced=1`, reload) | `reduced`; all loops `paused/reduced`; 0 slots | same |
| M-APP-02 sign-out | `data-leaving` and `inert` at once; route, then nav, then top bar fade; `/login` at 328 ms | `/login` at 325 ms |
| M-APP-01 hand-off (Login stub sign-in) | `handoff`; top bar from `opacity 0, translateY(-24px)`; everything at rest by about 1.06 s | same |
| Console | only Motion's dev warning "You have Reduced Motion enabled…" while reduced is emulated (step-36 N-3) | same |

**Screenshots** (`implementation/assets/`):
- `21_{w}_cold_mid.png`: emblem strokes drawing on the dark shell.
- `21_{w}_cold_end.png`.
- `21_{w}_debug_overlay.png`: "ambient 1/4".
- `21_{w}_route_mid_exit.png`: the old page fading while the card travels.
- `21_{w}_route_settled.png`.
- `21_{w}_rail.png`.
- `21_{w}_nav_hover.png`.
- `21_{w}_secure_attention.png`: amber pill, beam, badge.
- `21_{w}_secure_critical.png`.
- `21_{w}_reduced_os.png`.
- `21_{w}_handoff_settled.png`.
- `21_1440_proof_slow_route_{mid,end}.png`: MS-10, the mid frame (card mid-travel, content hidden) differs from the end frame.
- `21_hm1_flight_{mid,end}.png`.

**Processes (P7).** I started and stopped each of these:
- **Vite 5176:** npx 25202 / node 25220 (first run); npx 30020 / node 30038 (final run).
- **Harness Vite 5179:** 27661.
- **chrome-headless-shell** one-shots: 26011, 26610, 27714, 27781, 28983, 30088, 30667. Each was killed by its own script.

Afterwards `lsof -iTCP:5176` and `lsof -iTCP:5179` returned nothing, `ps` showed no Vite or headless shell of mine, and the scratch Chrome profiles were deleted. mock-core was not used (P5).

## 7. Decisions, drift and notes

| ID | Kind | Item |
|---|---|---|
| DR-41-1 | decision (H-M1) | H-M1 is false for TanStack Router 1.170.40 (§3), so the root has a `LayoutGroup` but **no keyed `AnimatePresence`**. The row text asked for both; the spec's own fallback applies. The two-phase hand-off uses Motion's shared `layoutId` across the commit instead of a stored DOMRect: equivalent start and end positions, fewer moving parts, proven by trace |
| DR-41-2 | decision (M-APP-04 mechanism) | The exit cannot be an `AnimatePresence` exit (same reason), so it uses TanStack Router's ready-made `defaultViewTransition` (typed) plus CSS: a snapshot of the old content area fades 160 ms while the new page mounts live. `::view-transition { pointer-events: none }` keeps input flowing (R6). Browsers without typed view transitions skip the exit and show the enter only (`supportsRouteViewTransition()` sets the delay to 0). This adds one router option in `router.tsx` (a step-38 file; within row 41's "route transition wrapper" scope) |
| DR-41-3 | bug found and fixed (browser) | The first cut keyed the wrapper on `location.pathname`, which the router moves as soon as a navigation starts. The old page remounted hidden just before the view transition captured it, so `21_1920_route_mid_exit.png` showed an empty area. The wrapper is now keyed on the committed leaf match; the retake shows the old page fading. The history index is only recorded when location and match agree |
| DR-41-4 | drift (library) | M-SH-04 says "240, `standard`". MP SlidingNumber is verbatim (row 37: "sliding-number.tsx untouched") and uses its own spring (280 / 18 / 0.3, ζ ≈ 0.98, settles ≈ 0.25 s). Proof mode ×10 does not reach it. Reduced motion renders plain digits. The readable time is an `sr-only` `<time data-testid="top-bar-clock">`; the ten-glyph face is `aria-hidden` |
| DR-41-5 | decision (§9.4) | The clock-colon breath and the SECURE BorderBeam join the one `shell` slot, together with the topographic drift and the SECURE dot, at priority `shell`. So the shell always costs one slot and yields to pages that run four |
| DR-41-6 | decision | BorderBeam `size 220` (M-C-23), `borderWidth 1.5` (the pill border). On the 214×52 pill it reads as a bright segment travelling the border (see the attention and critical crops in the screenshots). A first run with size 72 was barely visible and was replaced |
| DR-41-7 | decision (R8 over M-SH-05 wording) | "On a state change … one ring pulse" is applied to **escalations** only. Hydration (UNKNOWN → state) and recovery are a colour transition only, per R8 and P7 |
| DR-41-8 | decision (M-C-25, §9.2) | The focus glow fades through a registered colour custom property (`@property --dems-focus-glow`) feeding a static-geometry glow. §9.2 allows colour custom properties; `box-shadow` itself is never transitioned, and `outline` appears instantly |
| DR-41-9 | decision (CSS) | AnimatedBackground wraps each nav item in a Tailwind `.z-10` element, which would make every item its own stacking context, so a travelling card would paint over other labels. One **unlayered** rule sets those wrappers to `z-index: auto`, and item content sits at z 1 over cards and hover layers at z 0 |
| DR-41-10 | decision (performance) | The sidebar, the drawer list and the clock each have their own `LayoutGroup inherit={false}`, and the lockup is memoised. Shell re-renders (hover, clock ticks, navigation) never make page layout nodes re-measure or animate. The emblem and page R5 IDs stay in the root group |
| DR-41-11 | decision (M-APP-02) | The sign-out exit keeps the page mounted for about 300 ms. `ExitGuard` hides a page that throws without an operator. A guard timeout (`slower` + `base` = 880 ms × time scale) always reaches `/login`. The page contract is noted in §2 |
| DR-41-12 | drift (spec reference) | M-APP-03 step 3, "the gold rule under the tagline", has no counterpart in the top bar (no rule under its tagline). The Dashboard hero's rule wipe is M-C-13 (step 42). The sidebar footer rule is left static |
| DR-41-13 | decision | Entrance detection: `handoff` when the previous top-level route of this router was `/login`; `cold` for the first shell of the browser session (`sessionStorage['dems.shell.intro']`), with the flag also set after a hand-off; otherwise `plain`. Before step 43, a Login-stub sign-in gives `handoff` (tested) |
| DR-41-14 | decision | Hand-off offsets are the spec timeline re-based to the flight start (top bar 600 − 450 = 150, sidebar 230, panels 350). Under reduced motion the shell cross-fades in `fast`, the kit's reduced cap; the spec's M-APP-01 row says 240 ms, and AC-70 needs only a cross-fade |
| DR-41-15 | note (D49 literals) | Spec literals used as named constants: 150 / 230 / 350 / 30 (hand-off), 600 / 500 / 70 (cold), 600 and 1.6 (ring), 600 ms and 5,000 ms (bell), 20 ms (labels), 120 ms (focus), 400 ms (status colour), −12 px (topo). The CSS mirrors of token values are test-checked against `@dems/shared/tokens` |
| DR-41-16 | decision | Page title: a parent's `background-clip: text` does not reach words that animate on their own layer, so the white-to-gold gradient moves onto each TextEffect word (same vertical gradient). The `<h1>` keeps its name from TextEffect's screen-reader copy |
| DR-41-17 | note | The "reduced-motion switch" UI stays with step 52 (D59). Step 41 wires and verifies the live OS switch and the persisted in-app override on the shell |
| DR-41-18 | note (error logging) | There is no client-log endpoint on mock-core (D3/D4, D41(g)). `ExitGuard` reports to the dev console as a structured `warn`. The other new paths are storage access (guarded) and animation promises (fire-and-forget) |
| DR-41-19 | note | The badge pop animates the CSS `scale` property through `--dems-badge-scale`, so the kit Badge's placement `transform: translate(…)` is untouched |
| DR-41-20 | note (DR-38-12) | The lazily split `_app` chunk does not break the flight: the router loads route chunks before it commits, so Login's unmount and the shell's mount share one commit. Step 43 should still confirm MS-07 in the real app |
| DR-41-21 | note | `data-shell-slot` targets from step 38 are all kept. New scripted-check hooks: `data-entrance`, `data-leaving`, `data-route-key`, `data-direction`, `data-layout-id`, `data-pulses`, `data-swings`, `data-sliding`, `data-emblem-draw` |

## 8. Parallel-run notes (P1–P13)

- **P1:** no install; no manifest or lockfile edit.
- **P4:**
  - Vite lane A **5176** for the app checks (D59).
  - The scratch H-M1 harness ran on spare **5179** and was stopped before the final run.
  - 5174 and 5175 were never used, and 5173 was not touched.
  - `dems.auth` was seeded with OPR-001.
- **P5:** mock-core not started.
- **P6:** wrote only row-41 paths:
  - `apps/core-web/src/components/shell/**` (the shell components, CSS and the new motion modules);
  - `routes/__root.tsx` (provider mounting);
  - `router.tsx` (the route-transition option);
  - `test/shell-motion.test.tsx`.

  No feature folder, `packages/shared/**`, `components/ui/**` (BorderBeam, SlidingNumber and the others were only imported), `motion/**` or `vite.config.ts` was written.
- **P7:** §6. Every PID I started was stopped.
- **P8:** progress is in `delegation_progress/coder_execution_step_41.md`.
- **P9:** vitest ran with `--maxWorkers=2`; no `vite build`.
- **P10:** per-command sandbox bypass for the Vite binds, the headless shells, `kill` and `sips` crops.
- **P11:** no noisy run. Concurrent steps 70, 73 and 92 write outside core-web. The sandbox's `failed to copy trust settings` lines on Node start are unrelated.
- **Shared files not written:** `masterplan/02_plan.md`, `status_tasks.md` and `delegation_progress_report.md` (controller-owned during the parallel run).

---
*Generated: 2026-10-01 04:31 WIB*
