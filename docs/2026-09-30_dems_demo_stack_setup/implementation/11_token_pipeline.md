---
task_id: 2026-09-30_dems_demo_stack_setup
step: 30
plan_row: 02_plan §4 W-01 part b and §6.1 (SCR-07)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 30: Shared token pipeline (tokens rev 3 check, NEW motion tokens, `theme/scalar.css`, AC-69)

**Outcome: PASS.** All five row-30 checks pass; command output is quoted in §4.

- **D31 rev 3 was already applied** by the scaffold row. It was checked, not re-applied, so `heroui-web.css` and `heroui-native.css` are byte-identical to the baseline commit.
- The 03_motion_spec §2.3 NEW motion tokens were added as plain numbers and `{ stiffness, damping, mass }` objects (SCR-07).
- The generator now writes a third output, `theme/scalar.css`.
- `test/contrast.test.ts` (AC-69) and `test/motion-tokens.test.ts` were created.
- The shared suite grew from 4 files / 16 tests to 6 files / 115 tests.
- No package was installed. No `package.json` or lockfile was touched (P1, P12).

## 1. What changed

| File | Change |
|---|---|
| `packages/shared/src/tokens/tokens.ts` | Added to `motion`: springs `counter`, `meter` and `indicator`; ambient periods `ringRotate` … `heartbeatPulse`; the new groups `distance`, `scale`, `blur` and `threshold`; the types `MotionTokens`, `DurationToken`, `EasingToken`, `SpringTokenName` and `AmbientToken`. `TYPOGRAPHY_FONT_SIZE_CLASSES` moved here, now derived from `typography`. New: `TYPOGRAPHY_TW_MERGE_CLASS_GROUPS` (D41(d)). All changes additive; no existing value or key changed |
| `packages/shared/src/tokens/status-tones.ts` | Removed the hand-written `TYPOGRAPHY_FONT_SIZE_CLASSES` tuple (moved; a pointer comment remains). Badge and tag tones already at rev 3 (Under Review, IN REVIEW, EXPORTED); unchanged |
| `packages/shared/scripts/gen-theme.ts` | Added `generateScalarTheme()`, the exported mappings `scalarRootVariables`, `scalarModeVariables` and `scalarMotionVariables`, and `SCALAR_THEME_PATH`. `generateTheme()` now returns `{ web, native, scalar }`; `main()` writes all three files |
| `packages/shared/theme/scalar.css` | **New, generated** (84 lines, 62 declarations, 2 keyframes) |
| `packages/shared/test/theme.test.ts` | Scalar output (required variables, method colours, fonts, radius, motion and reduced-motion, drift) plus the typography class-list sync (D41(d)) |
| `packages/shared/test/contrast.test.ts` | **New (AC-69):** the 20 §2.7 pairs (listed ratio ±0.05 and rating), plus 43 Scalar renderer text pairs at 4.5:1 or better |
| `packages/shared/test/motion-tokens.test.ts` | **New:** numeric stiffness, damping and mass on every spring; the stated ζ values; exact §2.1 and §2.3 values; plain-number leaves; the P1 and P8 limits |

`git diff --stat` for the tracked files is 4 files, +392 / −21. There are three new files: `contrast.test.ts` (171 lines), `motion-tokens.test.ts` (138 lines) and `scalar.css` (84 lines). Every write is inside `packages/shared/{src/tokens,scripts,test,theme}`. `package.json` (step 27) and `assets/` (steps 28 and 29) were not touched.

## 2. D31 rev-3 check (verify, do not re-apply)

| 02_plan §6.1 token | Required | Found in `tokens.ts` |
|---|---|---|
| `surface` | `#191008` | `derived.surface: '#191008'` (line 45) |
| `surface-secondary` / `field-background` | `#150E07` / `#150E07` | both `#150E07` |
| `surface-tertiary`, `segment` | `#251C14` | `derived.surfaceTertiary`; `kitColors.segment` = surfaceTertiary |
| `default` | `#2B231C` | `derived.default: '#2B231C'` |
| `overlay` | `#1F262E` | `kitColors.overlay` = `palette.charcoal` |
| `border` | `#FF9F3D59` | `derived.border: '#FF9F3D59'` |
| glow 1 / 2 / 3 | rev-3 strings | `elevation[1..3]` equal §2.7 rev 3 |
| NEW | `foreground-2 #D8CEC6`, `--color-charcoal #1F262E` | `extraColors['foreground-2']`, `extraColors.charcoal` |
| Badge tones | Under Review warning; IN REVIEW warning (outline); EXPORTED info (outline) | `status-tones.ts` BADGES and TAGS match |

Evidence: `git diff --exit-code -- packages/shared/theme/heroui-web.css packages/shared/theme/heroui-native.css` printed "existing themes unchanged (exit 0)" after the rebuild.

## 3. Motion-token export API (stable; consumed by step 36 web and step 69 mobile)

Import it with `import { motion, type SpringToken, type SpringTokenName } from '@dems/shared/tokens'`; the root barrel `@dems/shared` also works.
- Every leaf is a finite `number`. A test walks the whole object and asserts this; a JSON round trip gives the same object.
- Keys are only ever added, never renamed or removed. This is recorded in the `tokens.ts` header.

| Path | Values | Unit |
|---|---|---|
| `motion.duration.{instant,fast,base,slow,slower,beatIn,beatOut,ambient}` | 90, 160, 240, 420, 640, 180, 720, 1200 | ms (unchanged) |
| `motion.easing.{standard,luxe,emphasized,exit}` | `readonly [x1, y1, x2, y2]` | cubic-bezier (unchanged) |
| `motion.spring.{gentle,snappy,bouncy}` | {170,26,1}, {420,34,0.9}, {260,18,1} | `SpringToken` (unchanged) |
| `motion.spring.counter` **NEW** | `{ stiffness: 90, damping: 20, mass: 1 }` (ζ 1.054) | `SpringToken` |
| `motion.spring.meter` **NEW** | `{ stiffness: 600, damping: 40, mass: 0.6 }` | `SpringToken` |
| `motion.spring.indicator` **NEW** | `{ stiffness: 380, damping: 36, mass: 1 }` (ζ 0.923) | `SpringToken` |
| `motion.choreography.{stagger,delayChildren}` | 60, 80 | ms (unchanged) |
| `motion.proofSlowFactor` | 10 | factor (unchanged) |
| `motion.ambient.{glowBreath,recPulse,meterFrameMs}` | 2400, 1200, 50 | ms (unchanged) |
| `motion.ambient.{ringRotate,kenBurns,topoDrift,sheen,scanline,scanlineSweep,colonBreath,heartbeatPulse}` **NEW** | 60000, 30000, 40000, 700, 6000, 1200, 1000, 600 | ms |
| `motion.distance.{riseSm,rise,riseLg,hoverLift,exitDrop}` **NEW** | 6, 12, 24, 2, 8 | px |
| `motion.scale.{press,hover,enterFrom,stampFrom}` **NEW** | 0.98, 1.01, 0.98, 1.2 | unitless |
| `motion.blur.{focusIn,mediaIn}` **NEW** | 6, 8 | px (web only; mobile uses opacity and scale) |
| `motion.threshold.{flashMaxHz,numberTextMaxHz,ambientMaxPerViewport,insertionMinGapMs,staggerCap}` **NEW** | 3, 4, 4, 400, 8 | Hz, Hz, count, ms, count |

Reanimated takes the springs as they are: `withSpring(v, motion.spring.counter)`, or `.springify().stiffness(s.stiffness).damping(s.damping).mass(s.mass)`. The 03M §2.3 entry "scanline 6,000 (sweep 1,200)" became two keys, `scanline` and `scanlineSweep`.

## 4. Verification (row 30 checks, with output)

| # | Row-30 check | Command | Result |
|---|---|---|---|
| 1 | `#191008` present | `grep -c '#191008' packages/shared/src/tokens/tokens.ts` | `1` (PASS) |
| 2 | scalar.css sets both variables | `grep -nE -- '--scalar-background-1:\|--scalar-color-accent:' packages/shared/theme/scalar.css` | `21:  --scalar-background-1: #191008;` and `28:  --scalar-color-accent: #FFC86B;` (PASS) |
| 3 | A token test asserts numeric spring fields | `npx vitest run --reporter=verbose test/motion-tokens.test.ts` | 6 × "`<name>` is a plain { stiffness, damping, mass } object of finite positive numbers" ✓ (gentle, snappy, bouncy, counter, meter, indicator); `Tests 21 passed (21)` (PASS) |
| 4 | Row test command | `npm test -w @dems/shared -- --maxWorkers=2 test/theme.test.ts test/contrast.test.ts` | `Test Files 2 passed (2)`, `Tests 83 passed (83)`, exit 0 (PASS) |
| 5 | Typecheck | `npm run typecheck -w @dems/core-web` / `-w @dems/mobile` | `tsc -b` exit 0; `tsc --noEmit` exit 0 (PASS) |

**Additional checks:**

| Check | Command | Result |
|---|---|---|
| Full shared suite | `npm test -w @dems/shared -- --maxWorkers=2` | `Test Files 6 passed (6)`, `Tests 115 passed (115)`, exit 0 (baseline before step 30: 4 files, 16 tests) |
| Shared typecheck and lint | `npm run typecheck -w @dems/shared`; `npm run lint -w @dems/shared` | exit 0; exit 0 |
| core-web lint and test | `npm run lint -w @dems/core-web`; `npm test -w @dems/core-web -- --maxWorkers=2` | exit 0; `Tests 1 passed (1)`, exit 0 |
| Generator plus `tsc` (AC-18 first half) | `npm run build -w @dems/shared` | wrote the three files (3111, 4542 and 3065 chars); exit 0. Needs the P10 bypass; see §6 D-5 |
| AC-18, pre-commit form | shasum all three `theme/*.css`, regenerate (`node --import tsx scripts/gen-theme.ts`), shasum again; `git diff --exit-code packages/shared/theme/` | shasums identical: `cf3d4703…` web, `c5864da5…` native, `4fb773a2…` scalar. `git diff` exit 0. The drift test also covers the untracked `scalar.css` |
| CSS validity | lightningcss `transform` and css-tree `parse` on the generated files | `scalar.css parsed OK; warnings: 0`; `heroui-web.css parsed OK; warnings: 0`; css-tree: 0 parse errors, 62 declarations, 2 keyframes |
| Tests are not vacuous | Scratch copy of `packages/shared` (outside the workspace) with `surface` reverted to rev-2 `#1F262E` and `counter.mass` set to the string `'1'` | `Failed Tests 18` across contrast, motion-tokens and theme (panel pairs out of tolerance; spring type; drift). Scratch copy deleted |
| D41(d) class helper at runtime | `node --import tsx` in `apps/core-web` | plain `twMerge('text-display text-accent')` → `"text-accent"`. core-web `cn(…)` → `"text-display text-accent"`. `extendTailwindMerge({ extend: { classGroups: TYPOGRAPHY_TW_MERGE_CLASS_GROUPS } })` → `"text-display text-accent"`. `cn('text-h1 text-display')` → `"text-display"` (a size conflict still resolves) |
| §2.7 ratios recomputed independently (before writing the test) | node WCAG 2.x script | all 20 listed ratios reproduce within ±0.005 (for example fg/panel 17.959 against 17.96; white/danger 3.763 against 3.76) |

P11: no noisy run. Step 27's install had finished before step 30's first run (its log is `implementation/08_web_dependencies.md`), and no test failed for reasons outside this step. The only failing run was my own test bug (D-6), fixed and re-run.

## 5. `theme/scalar.css` design (01_specs §14.9; research/04 §5.9)

- **Layering (read from the installed packages).**
  - Scalar 1.72.3 declares every `--scalar-*` default inside `@layer scalar-base`: on `:root` for type and radius, and on `.light-mode` / `.dark-mode` for colours, including an `@supports (color: display-p3)` block.
  - `customCss` goes verbatim into an unlayered `<style>` (`@scalar/api-reference/dist/components/ApiReference.vue.script.js` line 230: `` `${customCss}\n${themeStyle}` ``). The theme styles are wrapped in `layer = "scalar-theme"` (`@scalar/themes` `getThemeStyles`).
  - So the generated, unlayered declarations win over every layered default.
  - The colour mode class goes on `<body>` (`@scalar/use-hooks` `useColorMode.js` line 54).
- **`:root` block.**
  - Fonts: Inter Variable and JetBrains Mono Variable, never Orbitron.
  - `--scalar-radius: 4px` gives md 4 (pills), lg 8 (insets) and 2xl 16.
  - `--scalar-radius-xl: 12px` pins the panel step; the derived value would be 10.67.
  - `--scalar-radius-max: 16px` and `--scalar-border-width: 1px`.
  - These sit on `:root` because Scalar resolves its derived radius steps there.
- **`.light-mode, .dark-mode` block.** Identical values, dark only (D16).
  - Background: bg-1 is the panel `#191008`, bg-2 the inset `#150E07`, bg-3 `#251C14`.
  - Text: color-1 `#F9FAFB`, color-2 `#D8CEC6`, color-3 `#9CA3AF`.
  - Accent, link and button: gold, with black labels.
  - Border: bronze at 35%.
  - Methods (Scalar's `REQUEST_METHODS` map in `@scalar/helpers/dist/http/http-info.js`):
    - GET → blue `#3B82F6`
    - POST → green `#22C55E`
    - PUT → orange and PATCH → yellow, both amber `#F59E0B`
    - DELETE → red `#EF4444`
    - OPTIONS → purple, set to gray `#9CA3AF`
  - Also covered: alerts, scrollbars (bronze), tooltips (Charcoal), shadows (elevation 1 and 3) and the whole sidebar set.
- **Motion (03_motion_spec §5.5).**
  - Keyframes `dems-pop` (scale 0.9 → 1) and `dems-sheen` (background-position sweep).
  - Three animation or transition shorthands built from tokens:
    - `--dems-scalar-pop` (240 ms, `luxe`)
    - `--dems-scalar-sheen` (1,200 ms, `standard`)
    - `--dems-scalar-chevron-transition` (160 ms, `standard`)
  - `@media (prefers-reduced-motion: reduce)` sets all three to `none`.
- **Contrast.** All 43 renderer text pairs in `contrast.test.ts` reach 4.5:1 or better. The lowest are GET on the sidebar hover or active fill at 4.55 and DELETE red on bg-1 at 4.99.

## 6. Decisions, drift and notes for the controller

| ID | Item | Resolution |
|---|---|---|
| D-1 | D31 rev 3 was already in the scaffold | Verified row by row (§2); not re-applied. `heroui-*.css` are byte-identical to baseline |
| D-2 | D41(d) class registration | `TYPOGRAPHY_FONT_SIZE_CLASSES` now **derives** from `typography`. It moved from `status-tones.ts` to `tokens.ts`, since two `export *` modules may not share a name, and its import path `@dems/shared/tokens` is unchanged. Added `TYPOGRAPHY_TW_MERGE_CLASS_GROUPS`, plain data with no tailwind-merge dependency. core-web `src/lib/utils.ts` already registers the list, and the runtime check (§4) shows it keeps `text-display`. The list's type changed from a literal tuple to `readonly TypographyToken[]`; core-web typecheck exits 0. **Path note:** `status-tones.ts` is in the W-01 file scope (02_plan §10: `src/tokens/{tokens,status-tones}.ts`) but not in row 30's short list. No concurrent step writes it |
| D-3 | **Observation for steps 38 and 68 (not acted on; app paths are outside row 30).** The apps' `cn` cannot reach class merging *inside* kit components | `heroui-native/lib/module/helpers/external/utils/cn.js` builds its `twMerge` at module load from a fixed config. HeroUI web and native both style through tailwind-variants 3.3.1, whose global `defaultConfig.twMergeConfig` is mutable (heroui-native mutates it itself). **Hypothesis:** merging `TYPOGRAPHY_TW_MERGE_CLASS_GROUPS` into `defaultConfig.twMergeConfig.classGroups` at app start reaches `tv`-based kit styles. It needs an app-side test before anyone relies on it. Until then, the safe recipe for kit components is D41(d)'s "size and colour on separate elements" |
| D-4 | Scalar sidebar active fill | Set to `surface-tertiary` `#251C14` instead of the accent soft fill. Composited over the panel, the soft fill is `#3B2B17`, and the GET label on it measured 3.70:1, below AA. The selected endpoint stays marked by gold text and a gold indent border |
| D-5 | Sandbox (P10) | `npm run build -w @dems/shared` fails in the sandbox with `listen EPERM … /tmp/claude-501/tsx-501/<pid>.pipe`: the tsx CLI opens an IPC socket. It passed with a per-command bypass. `node --import tsx scripts/gen-theme.ts` produces identical output (same shasums) **inside** the sandbox. Relevant to AC-18 in steps 26 and 61 |
| D-6 | The first run of the row test failed 1 of 83 | The "no Orbitron" assertion matched the header comment. The test now strips `/* … */` comments before matching. Re-run: 83/83 |
| DR-a | **Drift (MINOR), 03M §5.5 against what was generated.** §5.5 puts the renderer motion in the generated `scalar.css`: chevron rotate, method-pill hover brightness (120 ms), selected-operation glow fade (200 ms), status-chip pop, one-shot SIMULATED sheen, reduced-motion guard | The generated file carries the **selector-independent** parts: both keyframes, the token-timed shorthands and the reduced-motion switch. **Selector binding** to Scalar's internal DOM is left to **step 53**, which owns H-S17 and can verify selectors in the running renderer. Scalar's Vue-scoped classes (for example `.section-accordion-chevron[data-v-…]`, `.sidebar-heading-type`) cannot be proven from static CSS. The one-shot sheen also needs a JS trigger when a response arrives. Step 53 can pass `customCss: scalarThemeCss + <its rules>` from its feature folder, so no shared-contract change is needed. The 120 ms and 200 ms values are not tokens (§2.3) and were not invented here |
| DR-b | **Drift (MINOR), response status colours.** 04 §5.9 asks for 3xx blue and 4xx amber | Scalar's `http-status-codes.js` maps 1xx blue, 2xx green, 3xx yellow and 4xx/5xx red. Through variables alone, the result is 3xx amber and 4xx red. Changing that needs selector rules (step 53's call). Methods match §5.9 exactly |
| DR-c | WS Bronze | Not in `scalar.css`. `/ws` is not an operation in the renderer; it appears in a tag description and in the custom Realtime WS panel, which uses `--color-bronze` / `text-bronze` from `heroui-web.css` |
| N-1 | Values the motion spec uses that are not §2.3 tokens | These were **not** added, to avoid spec drift: held beat 120 ms (§1, R4), newest-highlight fade 1,500 ms (R9), pill hover 120 ms and selected fade 200 ms (§5.5). Steps 36, 53 and 69 use the spec literals, or ask for a token through the controller |
| N-2 | Informational contrast (not asserted) | DELETE red on bg-3 is 4.45. The DEMS document has no DELETE (§21.2), and red text only sits on bg-1 and bg-2 (4.99 and 5.08) |
| N-3 | Error logging (coder-execution STEP 3) | Not applicable. This is build-time token data and a generator with no runtime error path; generator failures surface as a non-zero `npm run build` exit |
| N-4 | Mobile jest not run | The mobile typecheck (row check 5) proves the additive API compiles against `apps/mobile`. Mobile jest was not run while steps 68 and 71 were editing mobile files concurrently (P11); step 69 runs it with its own changes |

## 7. For step 69 (mobile motion kit) and step 36 (web motion library)

- Read every motion value from `motion.*` (§3). The SCR-07 fallback constants in 04_mobile_specs §7.1 / 05 §3 M-02 are no longer needed.
- `SpringToken` objects can be passed straight to Reanimated `withSpring`. Their fields are plain numbers, safe inside worklets.
- `proofSlowFactor` × `duration.*` and × `choreography.stagger` gives `?motion=slow`. Springs become `withTiming(slower × 10)`, as before.
