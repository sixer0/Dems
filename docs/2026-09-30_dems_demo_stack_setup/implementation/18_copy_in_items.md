---
task_id: 2026-09-30_dems_demo_stack_setup
step: 37
plan_row: 02_plan §4 W-08, part b
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 37: Magic UI and Motion Primitives copy-in items (`apps/core-web/src/components/ui`)

**Outcome: PASS.** All four row-37 checks pass, with command output quoted in §4:

| Check | Result |
|---|---|
| New item files under `components/ui` | 13; `border-beam.tsx` and `sliding-number.tsx` untouched |
| `THIRD_PARTY_NOTICES.md` | Names all 13 items with source URL and licence (append only) |
| AC-17 shadcn check | Finds nothing |
| core-web typecheck and lint | Both exit 0 |

**Additional verification:**
- A new test file (15 tests) covers the motion-policy integration. A mutation check shows the tests catch 4 deliberate breakages (§4.3).
- The full core-web suite passes: 79/79.
- MS-01, MS-02 and MS-03 find nothing.
- A headless Chromium pass on lane-B port 5177 confirmed:
  - every ambient item animates while it holds a slot;
  - every item rests under reduced motion;
  - the four-loop cap holds (5 requested, 4 granted).
- The browser pass found one real bug (AnimatedNumber under reduced motion in StrictMode, §6 D-9). It was fixed test-first.

**Scope:**
- Writes stayed inside:
  - the 13 item files;
  - one test file under `components/ui/__tests__/`;
  - an append to `THIRD_PARTY_NOTICES.md`;
  - this log, four screenshots and the step progress file.
- Installs and untouched paths:
  - nothing was installed (P1);
  - `package.json`, the lockfile, `index.css`, `packages/shared/**`, `src/routes/**` and the shell were not touched (P6).

## 1. Files

### 1.1 Items (all new, `apps/core-web/src/components/ui/`)

Every file starts with an attribution header that gives:
- the collection, licence and copyright;
- the source URL and retrieval date;
- the upstream SHA-256;
- a numbered list of local changes.

Every change is also marked `// DEMS: <n>` in the code, so the files can be diffed against upstream.

| File | Item (collection) | Lines | `DEMS:` marks | Used by (01_specs §14.5 / 03_motion_spec) |
|---|---|---|---|---|
| `animated-number.tsx` | AnimatedNumber (MP) | 91 | 14 | KPI counters: Dashboard C, F, H; SM S; Evidence KPIs; Devices; Storage (M-C-02, M-C-03) |
| `text-effect.tsx` | TextEffect (MP) | 370 | 15 | Hero tagline (B, M-C-13), GlowRing "SYSTEM READY" (M-C-01), page-title enter (M-APP-04) |
| `text-shimmer.tsx` | TextShimmer (MP) | 104 | 8 | SM header title, once (K, M-PG-SM) |
| `text-scramble.tsx` | TextScramble (MP) | 131 | 11 | Hash resolve: SM N and T, Evidence integrity (M-C-07, M-C-21) |
| `transition-panel.tsx` | TransitionPanel (MP) | 63 | 4 | Start New Session steps, Evidence detail tabs (M-C-09, M-PG-EVID) |
| `animated-background.tsx` | AnimatedBackground (MP) | 116 | 7 | Sidebar hover background (M-SH-01) |
| `spotlight.tsx` | Spotlight (MP) | 115 | 9 | Quick Actions J, System quick actions (M-C-16) |
| `animated-list.tsx` | AnimatedList + AnimatedListItem (MU; item variants edited) | 151 | 13 | Recent Events I, Live Audit T, Storage activity, Security live rows (M-C-07) |
| `ripple.tsx` | Ripple (MU) | 129 | 13 | Dashboard D idle icon (M-C-23) |
| `shine-border.tsx` | ShineBorder (MU) | 127 | 11 | Dashboard D idle "Start New Session" CTA (M-C-23) |
| `orbiting-circles.tsx` | OrbitingCircles (MU) | 145 | 12 | Network & Time, GNSS tier (M-PG-NET) |
| `animated-beam.tsx` | AnimatedBeam (MU) | 238 | 18 | Network domains diagram (M-PG-NET) |
| `particles.tsx` | Particles (MU) | 403 | 29 | Login brand side (M-PG-LOGIN) |

### 1.2 Other paths

| Path | Change |
|---|---|
| `apps/core-web/src/components/ui/__tests__/copy-in-items.test.tsx` | New, 358 lines, 15 tests (§4.2) |
| `THIRD_PARTY_NOTICES.md` | Appended the section "Magic UI and Motion Primitives items (step 37)", 33 lines (87 → 120). The first 87 lines are byte-identical: SHA-256 `bd66ebd0…a8c9` before and after, checked before the append. `git diff --numstat`: 0 deleted lines |
| `docs/…/implementation/assets/18_copy_in_{ambient,ambient_reduced,content,content_reduced}.png` | Browser screenshots (§5) |

## 2. Sources and licences

- **When retrieved:** 2026-10-01 03:16 WIB (2026-09-30 20:16 UTC).
- **Registries:** Magic UI `https://magicui.design/r/<name>.json` and Motion Primitives `https://motion-primitives.com/c/<name>.json` (all 13 returned HTTP 200).
- **Dependencies:** every item depends only on `motion` (13.4.6, already installed) or on nothing. No new package was needed.
- **Cross-check against the MIT repositories:**
  - each copied source was compared with the upstream MIT repository (`magicuidesign/magicui@d7207e5`, `apps/www/registry/magicui/<name>.tsx`; `ibelick/motion-primitives@120f64f`, `components/core/<name>.tsx`);
  - 12 of 13 are byte-identical;
  - TextScramble's registry JSON is one revision behind the repository (it lacks upstream fix #182, commit `92586e6`, "resolve react doctor warnings"). The repository version was copied, because the fix derives the shown text from `children`, so a changed hash never shows stale text.
- **Licences:**
  - the GitHub API reports SPDX `MIT` for both repositories;
  - both licence files were fetched again and are byte-identical to the texts already in `THIRD_PARTY_NOTICES.md`;
  - no Magic UI Pro, Commons Clause, AGPL or paid item is used (03 SD-27).
- **Upstream licence artefact:** the Motion Primitives licence text in the notices ends with the line `app/page.tsx`. That line is part of the upstream `LICENCE.md`, confirmed again. It is left as found, and the notices say so.
- **Per-item record:** the notices table lists, for each item, the source URL, the repository path, the upstream SHA-256 and the copy destination.

## 3. Adaptation (what changed and why)

The copy-in model never runs `shadcn init` and never edits the global stylesheet, and D6 keeps ready-made items. The local changes fall into five kinds.

| Kind | Rule | Items |
|---|---|---|
| **Tooling** (TypeScript 6 strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`; oxlint 0 diagnostics) | `import type` for types; no global `JSX` or `NodeJS`. `motion.create(as)` is never called per render: upstream remounts the element every render. The fix is memoised creation, or Motion's cached `motion.<tag>` for tags | AnimatedNumber, TextShimmer, TextScramble, TransitionPanel, AnimatedBackground, Spotlight, Particles |
| **Tokens** (`@dems/shared/tokens`, 01_specs §2.7, 03_motion_spec §2) | Colours come from `palette`, CSS variables or `@theme` utilities (gold, bronze, gray, `--foreground`, `--accent`, `bronze/12`). Springs are `counter` (AnimatedNumber) and `indicator` (AnimatedBackground). Distances and blur are `rise` 12 and `focusIn` 6 (TextEffect presets; AnimatedListItem enters from `-rise` / `enterFrom`). The AnimatedBeam ease is the `emphasized` token, the same curve as upstream | All except TransitionPanel and TextScramble |
| **Policy** (step 36, `@/motion`; 03_motion_spec §8, §12) | Every item reads `useMotionPolicy()`. Reduced motion follows the §8 table. Proof mode (`?motion=slow`) multiplies durations, delays and staggers by the time scale | All 13 |
| **Ambient registry** (§9.4 cap of 4, R10) | Ripple, ShineBorder, OrbitingCircles, AnimatedBeam and Particles call `useAmbientLoop` and animate only while `running`: granted a slot, tab visible, element on screen, policy allows. An endless TextShimmer is a loop too; a one-sweep shimmer is not. Each ambient item takes `active` (the caller's condition), `loopGroup` (default = its item name, so every beam of one diagram or every ring of one orbit counts as **one** loop) and `loopPriority`. Its root carries `data-motion` and `data-ambient` (AC-70) | 5 + TextShimmer |
| **Registry `@keyframes` → Motion** (no global CSS; no `index.css` write under P6) | Ripple: scale 1 → 0.9 → 1, 2 s, CSS `ease`, 60 ms per circle, the `translate(-50%,-50%)` kept via Motion `x` / `y`. ShineBorder: the same `background-position` keyframes through `useAnimate`, so the upstream props interface is unchanged. OrbitingCircles: `rotate(a+t) translateY(r) rotate(-(a+t))` split into a carrier rotating by t, the static `rotate(a) translateY(r) rotate(-a)`, and an inner layer rotating by -t. All are composite-only transforms | Ripple, ShineBorder, OrbitingCircles |

**Item-specific changes required by the spec:**
- **AnimatedListItem (M-C-07).**
  - The variants are edited: the item enters from `{opacity 0, y -12, scale 0.98}` instead of the vendor `scale: 0`.
  - The vendor spring `{350, 40}` is kept, and so is `layout`.
  - The exit is opacity only, `fast`, with `exit` easing.
  - New `highlight` prop: a gold layer fading 0.18 → 0 over 1,500 ms, using opacity only (a D49 literal, exported as `HIGHLIGHT_FADE_MS`).
  - Reduced motion: rows appear instantly and keep only the highlight.
- **Spotlight (§9.2: `top` and `left` are never animated).** It moves with `x` / `y` transforms at a fixed `left: 0; top: 0`. The default is bronze at 12% (M-C-16).
- **ShineBorder (MS-03).** The upstream compositor-hint class on `background-position` is dropped.
- **Particles (§9.3).**
  - The pointer is kept in a ref. Upstream stored it in React state, which re-rendered on every mouse move.
  - Callback refs are assigned in a layout effect instead of during render.
  - Reduced motion draws one still frame. A paused loop keeps its last frame.
- **TextShimmer.**
  - New `repeat` prop (default `Infinity`, as upstream). `repeat={0}` sweeps once (M-PG-SM).
  - Colours: base `--foreground`, sweep `--accent`.
- **AnimatedNumber.**
  - New `format` prop (TB decimals and similar) and `from` prop. With `from`, the first tick waits for the R4 held beat (120 ms).
  - Reduced motion renders the final value as text (§6 D-9).
- **TransitionPanel.**
  - Without `variants`, it uses the policy's direction-aware `step` variants (M-C-09, R7). Pass `custom` = ±1.
  - Under reduced motion the policy's opacity-only variants always win.
- **AnimatedBackground.**
  - The default transition is the `indicator` spring.
  - Reduced motion drops the `layoutId` flight and cross-fades instead (§8 "Shared-element flights").
  - `defaultValue` seeds the state during render, replacing a `setState` inside an effect.
- **TextScramble.** Reduced motion shows the final text at once and still fires `onScrambleComplete`. The interval is cleared on unmount.
- **TextEffect.**
  - Reduced motion is opacity only, at most 160 ms, with no stagger, whatever the preset or custom variants. Resting transform and filter keys are pinned (the step-36 D-1 pattern).
  - The custom stagger and delay are read through the type guard.

### 3.1 API notes for the page steps (38–53)

- **Loops that belong together share one of the four slots.**
  - Beams: every `AnimatedBeam` defaults to `loopGroup="animated-beam"`.
  - Orbit rings: `OrbitingCircles` defaults to `loopGroup="orbiting-circles"`.
  - The Dashboard idle pair: give Ripple and ShineBorder the same `loopGroup="idle-invitation"` so they count as one loop, as in §9.4 "Ripple/ShineBorder alternating (4)".
- **Caller conditions use `active`.** Examples:
  - `active={session.state === 'IDLE'}` (Ripple and ShineBorder);
  - `active={time.source === 'GNSS' && time.locked}` (orbit);
  - `active={exportRunning}` (Export beam, dashed).
  - The GNSS-loss fade-out (600 ms) belongs to the page, for example `AnimatePresence` around the orbit.
- **Configuration values (M-C-23) are passed by the page.** The items keep the upstream numeric defaults and only swap colours for tokens. Examples: Particles `quantity 24, staticity 60, ease 80, size 0.6`; Ripple `numCircles 5, mainCircleOpacity 0.18`; ShineBorder `duration 8`; OrbitingCircles `radius 44, duration 20, iconSize 16`; AnimatedBeam `duration 4, pathOpacity 0.15`.
- **Held beat.** `AnimatedNumber from={0}` gives the R4 held beat on mount. Counters that must not count up omit `from`.
- **Hash resolve.** `TextScramble characterSet="0123456789abcdef" duration={0.6}` (M-C-07) or `0.8` (M-C-21). Re-trigger by toggling `trigger`.

## 4. Verification (row-37 checks, with output)

### 4.1 Row checks

| # | Check | Command | Result |
|---|---|---|---|
| 1 | 13 new files; BorderBeam and SlidingNumber untouched | `git status --short --untracked-files=all -- apps/core-web/src/components/ui THIRD_PARTY_NOTICES.md`; `git diff --stat -- …/border-beam.tsx …/sliding-number.tsx` | 13 item files plus 1 test file are `??` (new); `THIRD_PARTY_NOTICES.md` is `M`; the diff for border-beam and sliding-number is empty (exit 0). SHA-256 `1f9b1fbc…2fb3` and `27407060…c3e6` (PASS) |
| 2 | Notices name all 13 with URL and licence | `grep -c "^\| <Item>" THIRD_PARTY_NOTICES.md` for each | `AnimatedNumber:1 TextEffect:1 TextShimmer:1 TextScramble:1 TransitionPanel:1 AnimatedBackground:1 Spotlight:1 AnimatedList:1 Ripple:1 ShineBorder:1 OrbitingCircles:1 AnimatedBeam:1 Particles:1`. Each row carries `MIT` and a source URL (PASS) |
| 3 | AC-17 | `grep -cE 'BorderBeam\|SlidingNumber' THIRD_PARTY_NOTICES.md`; `grep -rn "shadcn" apps/core-web/package.json apps/core-web/components.json` | `3` (≥ 2); the second command prints nothing and exits 2; `components.json` does not exist (PASS) |
| 4 | core-web typecheck | `npm run typecheck -w @dems/core-web` (`tsc -b`) | **exit 0** at 03:40:43 and 03:41:30 WIB (PASS). The earlier run is in §4.4 (P11) |
| 4 | core-web lint | `npm run lint -w @dems/core-web`; `oxlint -f json` | exit 0; **0 diagnostics in 92 files, 116 rules**; 0 in `components/ui` (PASS) |

### 4.2 Tests

`npm test -w @dems/core-web -- --maxWorkers=2` gives `Test Files 7 passed (7)`, `Tests 79 passed (79)`, exit 0 (03:41 WIB). The new file `components/ui/__tests__/copy-in-items.test.tsx` holds 15 of them:

| Group | Tests |
|---|---|
| Ambient items (§9.4, R10) | (1) five item types request 5 slots and are granted 4, with `particles` suppressed; roots show `running` / `paused`. (2) Three beams share **one** slot. (3) Under reduced motion no slot is requested and every root is `paused` with `data-motion="reduced"`. (4) `active={false}` requests no slot. (5) An endless TextShimmer registers; a `repeat={0}` shimmer does not |
| AnimatedNumber (M-C-02, R4) | (6) Stays at `0` through the 120 ms held beat (checked after 100 ms of real frames), then reaches `42`. (7) Reduced motion shows the value at once. (8) Reduced motion inside StrictMode, including a re-render. (9) Custom `format` |
| TextScramble | (10) Scrambles (`xxxx`), then resolves and fires the callback once. (11) Reduced motion shows the final text at once and still fires the callback. (12) A changed text shows immediately (fix #182) |
| Geometry (§9.2) | (13) Spotlight keeps `left` / `top` at `0px`; `from-bronze/12`. (14) The orbit places children at `rotate(0deg) translateY(44px) rotate(0deg)` and `rotate(180deg) translateY(44px) rotate(-180deg)`. (15) `highlight` renders the layer only on the newest row |

### 4.3 Mutation check (the tests are not vacuous)

Each file was backed up and restored afterwards; `cmp` confirms each is identical.

| Mutation | Result |
|---|---|
| M1: Ripple ignores the registry (always runs) | 3 failed |
| M2: AnimatedNumber ignores reduced motion | 1 failed |
| M3: AnimatedNumber has no held beat | 1 failed |
| M4: TextScramble scrambles under reduced motion | 1 failed |

### 4.4 Motion greps and P11 record

| Check | Command | Result |
|---|---|---|
| MS-01 (AC-72) | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src` (bash) | no output, exit 1 (PASS) |
| MS-02 | `grep -rn "box-shadow" apps/core-web/src --include=*.tsx \| grep -E "animate\|transition"` (bash) | no output, exit 1 (PASS) |
| MS-03 | `grep -rnE "will-change" apps/core-web/src` | no output, exit 1 (PASS). A first run matched my own header comment in `shine-border.tsx`; the comment was reworded so it no longer contains the literal token |
| Scoped typecheck (my files only) | `tsc -p <scratch>/tsconfig.ui.json` (extends `tsconfig.app.json`; includes `src/components/ui` and `src/test/setup.ts`) | exit 0 |

**P11 (concurrent step 33).** At 03:30 WIB, `tsc -b` exited 2 with 22 errors, **none in `components/ui`**:
- 21 in `packages/shared/src/api/examples.ts`;
- 1 in `packages/shared/src/api/openapi.ts`.

Both files belong to step 33, which was running at the same time. The scoped typecheck over my files stayed at exit 0. The re-runs at 03:40:43 and 03:41:30 WIB exited **0** with 0 errors.

## 5. Browser check (headless Chromium over CDP; scratch harness)

**Method.**
- **Harness.** A throwaway Vite harness lives in the session scratchpad, outside the workspace. It imports `@/motion` and `@/components/ui/*` from `apps/core-web/src` under `MotionPolicyProvider` and `StrictMode`. It has three sets:
  - `?set=a`: the four ambient items;
  - `?set=b`: the content items;
  - `?set=c`: five ambient types, for the cap.
- **Server.** 127.0.0.1:**5177**, lane B per D59 and P4. Ports 5174 and 5175 were not used.
- **Browser.** Playwright's cached `chrome-headless-shell` (build 1243), with CDP on 9338. Driven with Node's global `WebSocket`. No package was installed.

| Scenario | Measured | Result |
|---|---|---|
| A, full, t and t + 700 ms | Registry `4/4` (ripple, shine-border, orbiting-circles, animated-beam ×2 sharing one slot). Ripple circle 0 scale 0.969 → 0.989. Shine `background-position` 35.2% → 52.7%. Orbit carrier rotation 25.4° → 37.9° (about 18°/s = 360° per 20 s), icons stay at radius **44 px**, inner tilt −38° = −carrier (upright). Beam gradient `x1` 101.5% → 107.7%. `will-change: auto` on the shine | Every loop animates (PASS) |
| A, `?motion=off` | Registry `0/0`. Ripple `scale 1` at both samples. Shine `0% 0%`. Orbit `transform: none`. Beam `0%/0%`. Every root is `paused/reduced` | Static final frame (PASS) |
| C, full | `requested 5, granted 4`; `particles` paused | Cap holds (PASS) |
| B, full, 250 ms / 3 s | Particles: 433–453 lit pixels, running. TextShimmer sweep `90.6%` → `0%` then stops. TextEffect words blur ≤ 1.1 px, rise ≤ 2.1 px → rest (token blur 6, rise 12). AnimatedNumber `154` → `1,234`. TextScramble scrambled → the exact hash. AnimatedList reveals `one` → `three, two, one`. Highlight 0.158 → 0.000 | PASS |
| B, after actions | Spotlight on hover: `left 0px; top 0px; transform matrix(1,0,0,1,20,-40)`, opacity 1. TransitionPanel old and new pages during `popLayout`, then "Devices check". New list row opacity 0.74 → 1 with highlight | PASS |
| B, `?motion=off`, 250 ms | Number `1,234` at once (after the D-9 fix; `0` before it). Hash final at once. Shimmer at rest, `data-motion="reduced"`. TextEffect `opacity 1, blur(0px), none`. Particles one still frame (452 lit pixels), paused. List shows all rows at once, highlight kept | PASS |
| Console | Only Motion's development warning "You have Reduced Motion enabled on your device" (the step-36 N-3 note) on the `?motion=off` loads. No errors, no exceptions | PASS |

**Screenshots** (1440×900):
- `implementation/assets/18_copy_in_ambient.png`: gold ShineBorder edge, bronze Ripple, orbit on its ring, beam diagram. The overlay line reads "full | slots 4/4 | …".
- `18_copy_in_ambient_reduced.png`: the reduced version.
- `18_copy_in_content.png`: particles, SESSION MONITOR, `1,234`, the resolved hash, "Devices check", the highlighted `EVT-4` row.
- `18_copy_in_content_reduced.png`: the reduced version.

**Processes (P7).** I started and then stopped:
- the harness Vite server, PID 8558. My first start attempt, PID 8395, died at once with the sandbox `listen EPERM`, and was re-run with a per-command bypass (P10);
- headless Chromium, PID 8762.

Ports 5177 and 9338 were free afterwards, and the scratch Chrome profile was deleted. mock-core, the Browser pane and the emulators were not used.

## 6. Decisions, drift and notes for the controller

| ID | Item | Resolution |
|---|---|---|
| D-1 | **Adapted, not verbatim.** BorderBeam and SlidingNumber (row 17) were copied verbatim. Row 37's brief requires adaptation to the tokens and the step-36 policy (reduced motion, proof mode, ambient registry) | Each file keeps the upstream structure and marks every change `// DEMS: <n>`. The headers give the upstream SHA-256, so an upstream diff stays easy |
| D-2 | **Registry CSS keyframes → Motion** (Ripple, ShineBorder, OrbitingCircles). The shadcn CLI would inject `@keyframes` and `--animate-*` theme variables into the global CSS. Here that is both "no shadcn" and a P6 write outside row 37 (`index.css`) | Reproduced in Motion with the same timing and geometry, using composite-only transforms (ShineBorder keeps `background-position`, as upstream). No new CSS file, so the row's "13 files" holds. A side benefit: the loops pause and resume through the registry in JS |
| D-3 | **TextScramble source.** The registry JSON lags the MIT repository by one fix (#182) | The repository file was copied. Both URLs are recorded in the notices |
| D-4 | **`loopGroup` defaults.** Same-type instances share one slot by default (all beams = 1 loop, all orbit rings = 1 loop, §9.4 "Orbit, beams, …") | The Dashboard page should pass one shared group to Ripple and ShineBorder (§3.1) |
| D-5 | **Test file location.** One test file sits at `components/ui/__tests__/copy-in-items.test.tsx`. The row names "13 new files under components/ui", and the test is additive verification | The 13 item files are exactly the 13 named items. The test sits in a sub-folder and matches `vite.config.ts` `src/**/*.test.tsx`. Flagged for the controller in case the count is read literally |
| D-6 | **Numeric defaults.** The items keep the upstream numeric defaults and change only colours to tokens | The M-C-23 configuration values are the page's to pass (§3.1). This keeps each item generic and the diff small |
| D-7 | **`background-position` animation** (ShineBorder, TextShimmer). §9.2 lists neither this property as allowed nor as never animated | Kept, as upstream and as the spec's own choice of these items. It repaints only a 1 px masked border, or a text run once (M-PG-SM). The same property is already used by the Scalar SIMULATED badge (§5.5) |
| D-8 | **R10 "resume in phase".** The declarative loops (Ripple, orbit, beam, shimmer) restart their cycle after a pause. A pause means hidden, off screen, suppressed or reduced | A paused loop is either not visible or becomes static, so the phase jump is not seen. Particles resumes from its last frame. Recorded as a minor deviation |
| D-9 | **Bug found in the browser, fixed test-first.** Under reduced motion inside `StrictMode` (which `main.tsx` uses), AnimatedNumber stayed at `0`. The second, simulated effect pass jumps the spring to an unchanged value, so Motion emits no change event and the MotionValue text child stays stale | A regression test (StrictMode plus re-render) now covers it. The fix: under reduced motion the final formatted value is rendered as text, and the spring is still jumped so that a later switch back to full motion starts from it. The browser now shows `1,234` at 250 ms |
| D-10 | **Error logging** (coder-execution STEP 3) | Not applicable in the persistent form: D41(g) rules out a client error-log endpoint. The items have no I/O or user-data failure paths. Particles tolerates a missing 2D context; Motion handles its own errors |
| N-1 | **Integration owners** | Pages 42–53 consume the items (§3.1). The step-36 policy must be mounted for the policy to be live; step 41 swaps `MotionPolicyProvider` into `__root.tsx`. Without the provider the items fall back to the static full-motion default, so they still work, and the registry is per provider |
| N-2 | **Not written** (parallel isolation, P8) | `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `implementation/99_implementation_report.md`. The controller synthesises them |
