---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-09-30
agent: data-analyst
blueprint_row: 4
type: specification
narrative_tier: 1
based_on: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/research/03_analysis.md
decisions_applied: D1-D28 (decisions/decisions.md)
revision: 3 (2026-10-01) - D17-D28 applied; §13 resolved; §14 web application added; tokens rev 3
design_source: /Users/gsp-budi/Documents/DEMS/ui_design/DEMS-DesignSystem.png (D16; token authority)
scope_note: D15 scope answered by D17-D28 (§13); the page rows in §14 wait for the second approval gate (D22); the scaffold §0-§8 is being built in parallel (D27)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/02_structured.md
status: complete
last_updated: 2026-10-01 00:39 WIB (rev 3: D17-D28)
---

# Stack Specification: DEMS Demo (Blueprint Row 4)

## 0. Scope, sources and conventions

### What this file is
- The binding specification for rows 5-25.
- Row 5 (`masterplan/02_plan.md`) turns it into ordered commands.
- Rows 14-19 build exactly what is written here.
- Rows 13, 20 and 22-24 verify against the acceptance criteria in §9.
- Every library chosen in `research/03_analysis.md` appears here; the traceability table is in §11.
- **Design source (D16):** visual tokens come from the designer's `ui_design/DEMS-DesignSystem.png` (§2.7-§2.10).
- **Scope (D15 → D17-D28, rev 3):** §0-§8 are the stack-proof scaffold (built now, D27). §13 records the resolved scope. **§14 specifies the 10-page web build**, which the page rows execute after the second gate (D22).
- **Companion documents:** `masterplan/03_motion_spec.md` (all motion; D15 delegates animation design to us) and `masterplan/02_plan.md` (ordered steps).

### Evidence conventions
- `03 SD-nn`: a decision in `research/03_analysis.md`.
- `02 Lnnn`: `research/02_collection.md` at line nnn.
- `01 …`: `research/01_explore.md`.
- `Vnn`: an analyst verification. V1-V21 are in 03; V22-V39 are below.
- **Hypothesis** marks a claim not yet proven. Each hypothesis is paired with a deterministic fallback, so no value in this spec is left open.

### Naming conventions
- npm scope: `@dems/*`
- Android application ID: `com.dems.demo.tablet`
- Deep-link scheme: `demsdemo`
- AVD names (D23): `dems_tablet` (pixel_tablet) and `dems_phone` (pixel_10)

### 5W1H

| Dimension | Content |
|---|---|
| What | Workspace layout, package contracts, shared types and tokens, service and UI placeholder specifications, device networking, AVD profile, telemetry opt-outs, tests, and command-level acceptance criteria mapped to SC1-SC7 |
| Who | Implementers: `coder-execution` (rows 8-19, 21) and `test-expert` (row 20). Verifiers: `verifier` (rows 13, 22), `security-review` (23), `senior-code-reviewer` (24). Owner: the user (demo owner) |
| When | Written 2026-09-30. It applies to the stack-setup phase only; feature screens are out of scope (C4) |
| Where | Code under `/Users/gsp-budi/Documents/DEMS/` (`apps/`, `packages/`, root config). Host paths as listed in 03's Host Impact Register |
| Why | Makes SC1-SC7 checkable by command. Enforces D6 (ready-made kits, kit defaults extended only through tokens). Keeps the single-React rule (03 SD-04) and local-only operation (NFR1) |
| How | Derived from 03 SD-01..SD-54, D10-D14 and the designer mockups in `ui_design/` (D15, D16; V36-V39). Remaining specifics were verified from official tarballs, registries and vendor example repositories (V22-V35). Palette values were computed and contrast-checked (V32) |

### Changes relative to `research/03_analysis.md`

Each change is MINOR under B.9, and the controller should record it.

| # | Change | Reason | Evidence |
|---|---|---|---|
| SPEC-C1 | mock-core serves **CORS for the web dev origin** through `@fastify/cors 11.3.0`. The web app calls `http://127.0.0.1:4400` directly. **This replaces SD-42's Vite proxy.** | Controller directive for row 4. It also matches blueprint row 19 ("web via 127.0.0.1") | `@fastify/cors@11.3.0` declares `fastify: '5.x'` (V22); 02 L854 |
| SPEC-C2 | `react-is` is removed from the root `overrides` (SD-04 RA-3). It is a direct dependency of core-web only, at 19.2.3 | `react-is` is a utility that legitimately appears at several majors (for example via `prop-types`). It is not a renderer, so forcing one version adds risk without benefit (hypothesis on the prop-types path; the rule itself is conservative) | V2 (Recharts peer) |
| SPEC-C3 | Linters: **oxlint 1.86.0** for core-web, mock-core and shared; **ESLint 9.39.5 + eslint-config-expo 57.0.2** for mobile | 03 made no lint decision. `create-vite@9.2.1`'s `react-ts` template ships oxlint, and the Expo template ships `expo lint` (eslint-config-expo) | V23, V24 |
| SPEC-C4 | Vite binds explicitly to `127.0.0.1:5173` with `strictPort` | This removes the dependence on Vite's default host (a hypothesis in 03), and every service stays on the IPv4 loopback | §6.1 |
| SPEC-C5 | The mock-core WS route enforces an **Origin allowlist** | Blocks cross-site WebSocket use by other browser pages on the loopback. The allowlist is listed in §3.3 | V22 (`preValidation` hooks run before upgrade) |
| SPEC-C6 | `@types/react` pinned exactly at **19.2.18** and `@types/react-dom` at **19.2.7** | Both sit inside SD-04's `~19.2.2`. Exact pins satisfy NFR2 | V25 |
| SPEC-C7 | Proof elements: Magic UI **`BorderBeam`** and Motion Primitives **`SlidingNumber`**. Adds `react-use-measure 2.1.7`, `clsx 2.1.1` and `tailwind-merge 3.7.0` to core-web | Smallest items that prove both collections. Neither declares CSS variables that could collide with HeroUI's | V26, V27 |
| SPEC-C8 | "Motion proof mode" (`motion=slow`) on both apps | Makes the enter-transition evidence deterministic: a mid-transition frame proves interpolation | §4.5, §5.6 |
| SPEC-C9 | Mobile fonts use HeroUI Native's `--font-normal/medium/semibold/bold` variables, following the vendor example | A vendor-documented pattern rather than an invented one | V28 |
| SPEC-C17 | **D17:** mobile `orientation: "default"` (unlocked); the Android 16 opt-out plugin is removed; responsive layout with a 900 dp breakpoint | User answer (phone portrait + tablet multi-pane) | §5.1, §5.2, §5.5 |
| SPEC-C18 | **D23:** two AVDs, `dems_tablet` (pixel_tablet) and `dems_phone` (pixel_10); root scripts `emulator` and `emulator:phone`. The coder already applied these in row 14 | Row 10 results | §1.2, §6.3, V45 |
| SPEC-C19 | **D23/D24:** `sdkmanager` calls add `--no-metrics`; emulator commands always run outside the sandbox | Row 9 finding; controller reproduction | §6.3, §7 |
| SPEC-C20 | **Tokens rev 3 (D28/Q6 plus measurement):** warm `--surface` `#191008`, inset `#150E07`, bronze 35% `--border`, bronze-tinted glow, Charcoal for overlays only, new `foreground-2` `#D8CEC6` | Pixel sampling of D1 and SM (V40); contrast improves (V46) | §2.7, §2.9 |
| SPEC-C21 | Badge tones: Under Review and IN REVIEW become amber; EXPORTED becomes Info Blue | 04 §9 #10, #11 | §2.8 |
| SPEC-C22 | **Web application: 10 pages plus the Start New Session flow**, with routes, shell, per-page component mapping and five custom compositions | D18, D25, D26 | §14.2-§14.6 |
| SPEC-C23 | **Simulator** in `packages/shared/src/sim` on **zustand 5.0.15**; hashes via **@noble/hashes 2.4.0** | D19; V42 | §14.7 |
| SPEC-C24 | **API renderer: Scalar** (`@scalar/api-reference-react` 0.9.76) with privacy flags and `customFetch`; Swagger UI rejected | D26; V41 | §14.9 |
| SPEC-C25 | **i18n:** i18next 26.4.2 + react-i18next 17.0.15; EN UI with ID domain terms | D28/Q3; V42 | §14.11 |
| SPEC-C26 | **Assets:** SVG emblem recreated; one Pexels/Unsplash still with its licence recorded; procedural camera feeds; generated topographic SVG; the MB 1 photo is never used | D28/Q10; V44 | §14.10 |
| SPEC-C27 | **New dependencies** for the page rows (additive; no §1.4 pin changes) | §14.1 | §14.1 |
| SPEC-C11 | **The designer's tokens replace this spec's palette** ("Obsidian & Champagne" is withdrawn). Gold `#FFC86B`, bronze `#FF9F3D`, status colours, charcoal `#1F262E` surfaces, black `#0B0D0F` canvas, and gold hairline glow borders | D16 (controller directive): `ui_design/DEMS-DesignSystem.png` is the token source | V36 |
| SPEC-C12 | **Fonts:** Orbitron (display), Inter (UI) and JetBrains Mono (data) replace Geist. `@fontsource-variable/{orbitron,inter,jetbrains-mono}` 5.3.0 on web; `@expo-google-fonts/{orbitron,inter}` 0.4.2 and `jetbrains-mono` 0.4.1 on mobile | D16 | V37 |
| SPEC-C13 | Two colours are **sampled** from the mockups and need designer confirmation: Sealed purple `#8B5CF6` and foreground `#F9FAFB`. Status **text** uses the 400 step (e.g. `#F87171`) to reach AA on charcoal | Not in the hex legend; small status text at the 500 step fails AA (V39) | V36, V39 |
| SPEC-C14 | Glow borders go through the kits' `--surface-shadow` and `--overlay-shadow` variables. Elevation 2 and 3 are Tailwind `shadow-glow-*` utilities | Both kits already route Card and Surface shadows through these variables | V38 |
| SPEC-C15 | `--radius: 0.5rem` and `--field-radius: 0.5rem`. Card and Surface take `rounded-xl` (12 px) through `className` | Makes the kit's derived radius scale equal the design's 4/8/12/16 scale; the kit card default (24 px) is off-scale | V38 |
| SPEC-C16 | Info, Sealed and Bronze become Tailwind `@theme` colours applied through `className` on kit components | The kits have no variables for them (§2.10) | V38 |
| SPEC-C10 | The AVD disables microphone input and cameras | The demo uses synthetic media. Leaving them enabled risks macOS privacy prompts that an unattended agent cannot answer (hypothesis) | §6.3 |

### Analyst verification log (row 4 additions)

| # | Check | Method | Result |
|---|---|---|---|
| V22 | Fastify plugin APIs | `npm pack @fastify/cors@11.3.0 @fastify/websocket@11.3.1`, read files | cors: deps `fastify-plugin ^6.0.0`, `toad-cache`; `index.js` L308 `fastify: '5.x'`. websocket README L113-L117: `onRequest`, `preValidation` and `preHandler` hooks run **before** the upgrade. L248-L263: "By default, all ws connections are closed when the server closes"; a custom `preClose` can send code 1001. L71: `options: { maxPayload: ... }` |
| V23 | create-vite 9.2.1 `react-ts` template | `npm pack create-vite@9.2.1`, read `template-react-ts/package.json` | Scripts `dev: vite`, `build: tsc -b && vite build`, `lint: oxlint`, `preview`. Deps `react ^19.2.8`, `react-dom ^19.2.8`. Dev: `@types/node ^24.13.3`, `@types/react ^19.2.18`, `@types/react-dom ^19.2.7`, `@vitejs/plugin-react ^6.1.1`, `oxlint ^1.81.0`, `typescript ~6.0.2`, `vite ^8.3.0`. Files include `_oxlintrc.json`, `tsconfig.app.json`, `tsconfig.node.json` |
| V24 | Lint and tool versions | `npm view` | `oxlint 1.86.0`. `eslint-config-expo` latest `57.0.2`, peer `eslint >=8.10`. `eslint@9` → `9.39.5` (latest overall is 10.11.0). `expo-doctor 1.20.4`. `@types/ws 8.18.2` |
| V25 | React 19.2 patch line and types | `npm view react@~19.2.0 version`; `@types` | Published: 19.2.0 through **19.2.8**. `@types/react@~19.2.2` → **19.2.18**; `@types/react-dom@~19.2.0` → **19.2.7**. The template range `^19.2.8` **excludes** 19.2.3, so core-web must set 19.2.3 explicitly (SD-04) |
| V26 | Magic UI items | `curl https://magicui.design/r/<item>.json` | `border-beam`: deps `["motion"]`, no `cssVars`, no in-view dependency, imports `cn` from `@/lib/utils`, exports `BorderBeam`. `number-ticker` and `blur-fade` use in-view detection, and `blur-fade` uses `filter: blur()`; both rejected for the proof element (jsdom-hostile or not compositor-only) |
| V27 | Motion Primitives items | `curl https://motion-primitives.com/c/<item>.json`; registry list | 33 items, including `sliding-number`, `text-shimmer`, `border-trail`, `text-effect`. `sliding-number`: deps `["motion","react-use-measure"]`, `cssVars {light:{},dark:{}}` (empty), exports `SlidingNumber`. `react-use-measure 2.1.7`, peers `react >=16.13` |
| V28 | HeroUI Native example wiring | `curl` raw `global.css` and `metro.config.js` from `heroui-inc/heroui-native-example` | `global.css`: `@import 'tailwindcss'; @import 'uniwind'; @import 'heroui-native/styles';`, then **`@source './node_modules/heroui-native/lib';`**, then `@layer theme { :root { @variant light {...} @variant dark { --font-normal: 'Inter-Regular'; --font-medium: ...; --font-semibold: ...; --font-bold: ...; --radius: 0.5rem; } } }`. `metro.config.js`: `withUniwindConfig(getDefaultConfig(__dirname), { cssEntryFile: './global.css', dtsFile: './src/uniwind-types.d.ts' })` |
| V29 | Kit APIs used in the placeholders | Read `.d.ts` files in `@heroui/react@3.2.6`, `heroui-native@1.0.10`, `uniwind@1.12.0` | Web: `Card` (compound `Card.Header`, `Card.Title`, `Card.Description`, `Card.Content`, `Card.Footer`), `Chip`, `Button`, `Surface`, `Skeleton`, `Spinner`, `Separator`, `Typography`, `ToastProvider`, `toast()`. The README says "requires no `<Provider>` wrapper". Chip `color` ∈ `accent`, `default`, `success`, `warning`, `danger`. Native: `HeroUINativeProvider` (props `config`, `toast`, `animation`, `devInfo`), `Card` (compound `Header`, `Title`, `Description`, `Body`, `Footer`), `Chip` (`ChipColor = 'accent' \| 'default' \| 'success' \| 'warning' \| 'danger'`), `Surface`, `Button`, `Spinner`, `Skeleton`, `Text`, `ToastProvider`/`useToast` (returns `{ toast, isToastVisible }`; `toast.show(options: string \| { label?, description?, duration?, ... })`, `toast.hide(...)`). Web `toast`: callable as `toast(message, options?)` plus `toast.success`, `danger`, `info` and `warning` (options include `description`). Web `Button` variants: `primary`, `secondary`, `tertiary`, `ghost`, `outline`, `danger`, `soft`. Uniwind: `uniwind/metro` exports `withUniwindConfig(config, { cssEntryFile, extraThemes?, dtsFile?, polyfills? })`, and the runtime `Uniwind.setTheme(theme)`. Copy-in props: `BorderBeam { size?, duration?, delay?, colorFrom?, colorTo?, reverse?, initialOffset?, borderWidth?, className?, style?, transition? }`; `SlidingNumber { value: number; padStart?: boolean; decimalSeparator?: string }` |
| V30 | Theme defaults and CSS entry | Read `@heroui/styles@3.2.6` and `heroui-native` CSS and README | Web: `@import "@heroui/styles";` pulls in Tailwind, tw-animate-css and HeroUI (README L29); theme variables sit in `layer(theme)`, and the dark selector is `.dark, [data-theme="dark"]`. Web defaults: `--radius: 0.5rem`, `--field-radius: calc(var(--radius) * 1.5)`, `--border-width: 1px`. Native: `--radius: 0.5rem`, `--field-radius: calc(var(--radius) * 1.75)`. Package export `heroui-native/styles` exists |
| V31 | Fonts (**superseded by V37**, D16) | `npm pack` of the four font packages | `@expo-google-fonts/geist@0.4.2` exports `Geist_400Regular`, `Geist_500Medium`, `Geist_600SemiBold`, `Geist_700Bold` and more. `@expo-google-fonts/geist-mono@0.4.3` exports `GeistMono_400Regular`, `GeistMono_500Medium` and more. The fontsource CSS families are `'Geist Variable'` and `'Geist Mono Variable'` (weights 100-900) |
| V32 | Palette | Node script: OKLCH → sRGB (Björn Ottosson's OKLab matrices), WCAG 2.x contrast | All tokens are in gamut. Contrast: foreground/background 17.62; muted/background 7.98; accent-foreground/accent 10.18; danger/background 5.57; danger-foreground/danger 5.40 (after replacing the first white-on-red, which was 3.40); link/background 12.07 |
| V33 | Test tooling and animation exports | `npm pack` of Skia 2.6.2 and Reanimated 4.5.1, grep of `lib/typescript`; `npm view` | Skia ships `jestSetup.js`, `jestSetup.mjs` and `jestEnv.js`, and exports `Canvas`, `Circle`, `RadialGradient`, `BlurMask`, `Group`, `vec`, `LinearGradient` and `RoundedRect`. Reanimated ships `mock.js`, exports `setUpTests`, the layout builders `FadeIn`, `FadeInDown`, `FadeInUp` and `ZoomIn`, and `ReduceMotion`. `jest@29` → `29.7.0`. `vitest@5.0.3` peer `vite ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`. `@testing-library/react@16.3.3` peer `@testing-library/dom ^10.0.0` (latest 10.4.2) |
| V34 | Expo SDK 57 default template | `npm pack expo-template-default@57.0.28` | Routes live in `src/app/` (`_layout.tsx`, `index.tsx`, `explore.tsx`), plus `src/global.css`, `src/components/**`, `src/hooks/**` and `src/constants/theme.ts`. `tsconfig.json` extends `expo/tsconfig.base` with `strict: true` and paths `@/*` → `./src/*`. `app.json` has `orientation: "portrait"`, `userInterfaceStyle: "automatic"`, `android.predictiveBackGestureEnabled: false`, plugins `expo-router` and `expo-splash-screen`, and `experiments.typedRoutes` and `reactCompiler` both `true`. Template scripts include `"lint": "expo lint"` |
| V36 | Designer mockups (D15, D16) | Viewed all five PNGs in `ui_design/` (DesignSystem, Dashboard1 and SessionMonitor at 1672×941; AssetSample and Mobile at 1536×1024). Sampled pixels locally with Python Pillow 12.3.0 (no upload) | **Swatches:** the rendered centres match the hex legend within raster noise (e.g. gold renders `#FEBE65` against a stated `#FFC86B`; charcoal `#24282E` against `#1F262E`). **Sealed** chip and tag: purple pixels at `#8058E0` and `#A880F8` (hue ≈258°), tag fill ≈`#684080`. **Heading text** ≈`#F8F8F8`. **Panel hairline** sampled at `#362A18` over a `#0F0B07` interior, which matches gold at 18% over black (`#372F20` computed). Panel interiors render near-black and warm, darker than the charcoal swatch (noted in §13). **Mobile** mockup: 10 phone-portrait screens (Login, Dashboard, Start Session with a 3-step stepper, Session Monitor, Evidence List, Evidence Detail, Devices, Storage, Network & Time, Settings) and a 5-item bottom tab bar |
| V37 | New font packages | `npm view`; `npm pack` and read `index.d.ts` / `index.css` | `@expo-google-fonts/orbitron@0.4.2` (MIT AND OFL-1.1): `Orbitron_400Regular` … `Orbitron_900Black`. `@expo-google-fonts/inter@0.4.2`: `Inter_100Thin` … `Inter_900Black`. `@expo-google-fonts/jetbrains-mono@0.4.1`: `JetBrainsMono_100Thin` … `JetBrainsMono_800ExtraBold`. `@fontsource-variable/orbitron@5.3.0` family `'Orbitron Variable'` (weights 400-900); `@fontsource-variable/inter@5.3.0` `'Inter Variable'` (100-900); `@fontsource-variable/jetbrains-mono@5.3.0` `'JetBrains Mono Variable'` (100-800); all OFL-1.1 |
| V38 | How the kits apply shadow, radius and soft colours | Read `@heroui/styles@3.2.6` `dist/components/card.css` and theme files; `heroui-native@1.0.10` `src/styles/components/{surface,card}.css`, `theme.css`, `variables.css`, `card.tsx`; `className?:` in the component types | **Web:** `card.css` has `@apply shadow-surface` and `border-radius: min(32px, var(--radius-3xl))`. `--shadow-surface: var(--surface-shadow)`; Alert and Tabs also use it; the soft variables `--{accent,danger,success,warning,default}-soft(-foreground)` are raw and overridable. **Native:** `card.tsx` renders `<Surface>`; `.surface__root { border-radius: var(--radius-3xl); box-shadow: var(--shadow-surface) }`; the radius scale is derived as `--radius-sm` = `--radius` × 0.5, `lg` × 1, `xl` × 1.5, `2xl` × 2, `3xl` × 3; soft colours are derived with `color-mix(... 15% ...)` in `@theme`. There is no progress or ring component in the native set. `className` is accepted by Card, Chip, Button and Surface on both kits |
| V39 | Contrast of the designer palette | Node WCAG 2.x script (sRGB relative luminance) | Listed in §2.7. Key results: foreground on black 18.63; gray on charcoal 6.02; black on gold 12.72; danger, info and sealed at the 500 step on charcoal 4.06, 4.15 and 3.61 (below AA), and at the 400 step 5.52, 6.01 and 5.61; white on danger 3.76 (AA-large only) |
| V35 | Host resources | `system_profiler SPHardwareDataType` (read-only; `sysctl` is blocked by the sandbox) | Chip: Apple M5. Total number of cores: 10 (4 Super, 6 Efficiency). Memory: 24 GB |

---

## 1. Workspace layout

### 1.1 Tree (new paths only; no existing file is moved, renamed or deleted)

```
/Users/gsp-budi/Documents/DEMS/
├── package.json                 private workspace root (§1.2)
├── package-lock.json            generated by npm 11.19.1
├── .npmrc                       save-exact=true
├── .node-version                26.8.2
├── tsconfig.base.json           shared compiler options (§1.6)
├── THIRD_PARTY_NOTICES.md       copied-in registry items (§4.4)
├── README.md                    run guide (row 21)
├── .gitignore                   append-only additions (§1.8)
├── packages/
│   └── shared/                  @dems/shared (§2)
└── apps/
    ├── mock-core/               @dems/mock-core (§3)
    ├── core-web/                @dems/core-web (§4)
    └── mobile/                  @dems/mobile (§5)
```

### 1.2 Root `package.json`

```json
{
  "name": "dems-demo",
  "private": true,
  "version": "0.1.0",
  "packageManager": "npm@11.19.1",
  "engines": { "node": ">=26.8.2 <27" },
  "workspaces": ["packages/*", "apps/*"],
  "overrides": {
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-test-renderer": "19.2.3",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.7"
  },
  "scripts": {
    "theme:gen": "npm run build -w @dems/shared",
    "dev:mock": "npm run dev -w @dems/mock-core",
    "dev:web": "npm run dev -w @dems/core-web",
    "dev:mobile": "npm run dev -w @dems/mobile",
    "android": "npm run android -w @dems/mobile",
    "emulator": "emulator -avd dems_tablet -no-metrics -gpu host -no-boot-anim",
    "emulator:phone": "emulator -avd dems_phone -no-metrics -gpu host -no-boot-anim",
    "mobile:reverse": "npm run reverse -w @dems/mobile",
    "probe:ws": "npm run probe:ws -w @dems/mock-core",
    "build": "npm run build -w @dems/shared -w @dems/mock-core -w @dems/core-web",
    "build:android": "npm run build -w @dems/mobile",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

Notes on the root file:
- `workspaces` lists `packages/*` first, so `--workspaces` runs process `@dems/shared` before the apps. This relies on npm running workspaces in declared order, which is a hypothesis; the scripts are also correct in any order, because the generated theme CSS is committed (§2.9).
- Root `build` excludes mobile, because a Gradle build takes minutes. `build:android` runs it separately.

### 1.3 Packages

| Package | Path | Purpose | Consumed as |
|---|---|---|---|
| `@dems/shared` | `packages/shared` | Domain type stubs (§21.3), Part C enumerations, the REST and WS contract (types, zod schemas, constants), the heartbeat client and React hook, the **single token source**, and the generated kit themes | TypeScript source, with no build step for JS (03 SD-37). Generated CSS is committed |
| `@dems/mock-core` | `apps/mock-core` | Local mock Core service: `GET /api/v1/health` and the WS `/ws` 1 Hz heartbeat on `127.0.0.1:4400` (D4) | Node process run through tsx |
| `@dems/core-web` | `apps/core-web` | React web "Core" console, with one placeholder route that proves the stack (D3) | Vite SPA |
| `@dems/mobile` | `apps/mobile` | Expo Android tablet app, with one landscape placeholder screen that proves the stack | Expo local debug build |

### 1.4 Dependency pins

**Install rules:**
- **R-1:** packages listed in Expo's `bundledNativeModules.json` are added with `npx expo install <pkg>` from `apps/mobile`. They keep Expo's `~` range in `package.json`, and the lockfile pins the exact version.
- **R-2:** every other package is added with `npm install --save-exact <pkg>@<version> -w <workspace>`.
- **R-3:** internal packages are declared as `"@dems/shared": "*"`, never `workspace:*` (03 V19).
- **R-4:** every npm command runs from the workspace root with `npm_config_cache="$PWD/.cache/npm"` (03 HI-8, R13).
- **R-5:** peer dependencies that npm auto-installs (for example HeroUI's `react-aria-components ^1.21.1`) are not declared. The lockfile records their exact versions.

#### `@dems/shared`

| Kind | Package | Version |
|---|---|---|
| dependencies | `zod` | 4.6.5 |
| peerDependencies | `react` | 19.2.3 |
| devDependencies | `typescript` | 6.0.3 |
| devDependencies | `tsx` | 4.23.15 |
| devDependencies | `vitest` | 5.0.3 |
| devDependencies | `oxlint` | 1.86.0 |
| devDependencies | `@types/node` | 26.6.3 |
| devDependencies | `react` | 19.2.3 |
| devDependencies | `@types/react` | 19.2.18 |

#### `@dems/mock-core`

| Kind | Package | Version |
|---|---|---|
| dependencies | `@dems/shared` | `*` |
| dependencies | `fastify` | 5.12.5 |
| dependencies | `@fastify/websocket` | 11.3.1 |
| dependencies | `@fastify/cors` | 11.3.0 |
| dependencies | `tsx` | 4.23.15 |
| devDependencies | `typescript` | 6.0.3 |
| devDependencies | `@types/node` | 26.6.3 |
| devDependencies | `@types/ws` | 8.18.2 |
| devDependencies | `ws` | 8.22.0 |
| devDependencies | `vitest` | 5.0.3 |
| devDependencies | `oxlint` | 1.86.0 |

#### `@dems/core-web`

| Kind | Packages and versions |
|---|---|
| dependencies: React | `react` 19.2.3; `react-dom` 19.2.3; `react-is` 19.2.3 |
| dependencies: UI and motion | `@heroui/react` 3.2.6; `@heroui/styles` 3.2.6; `motion` 13.4.6 |
| dependencies: data and routing | `@tanstack/react-router` 1.170.40; `@tanstack/react-query` 5.104.0; `@tanstack/react-table` 8.21.3 |
| dependencies: charts, icons, fonts | `recharts` 3.10.1; `lucide-react` 1.49.0; `@fontsource-variable/orbitron` 5.3.0; `@fontsource-variable/inter` 5.3.0; `@fontsource-variable/jetbrains-mono` 5.3.0 (all OFL-1.1, V37; D16 replaces Geist) |
| dependencies: forms | `react-hook-form` 7.89.0; `zod` 4.6.5; `@hookform/resolvers` 5.9.1 |
| dependencies: copy-in support | `clsx` 2.1.1; `tailwind-merge` 3.7.0; `react-use-measure` 2.1.7 |
| dependencies: internal | `@dems/shared` `*` |
| devDependencies: build | `vite` 8.3.1; `@vitejs/plugin-react` 6.1.1; `@tanstack/router-plugin` 1.168.41; `tailwindcss` 4.3.3; `@tailwindcss/vite` 4.3.3 |
| devDependencies: types | `typescript` 6.0.3; `@types/react` 19.2.18; `@types/react-dom` 19.2.7; `@types/node` 26.6.3 |
| devDependencies: lint and test | `oxlint` 1.86.0; `vitest` 5.0.3; `jsdom` 30.1.1; `@testing-library/react` 16.3.3; `@testing-library/dom` 10.4.2; `@testing-library/jest-dom` 7.0.1 |

#### `@dems/mobile`

| Kind | Packages and versions |
|---|---|
| dependencies, **rule R-1** (`npx expo install`): framework and navigation | `expo` ~57.0.26; `react` 19.2.3; `react-dom` 19.2.3; `react-native` 0.86.3; `react-native-web` ~0.21.0; `expo-router` ~57.0.24; `react-native-screens` ~4.26.0; `react-native-safe-area-context` ~5.7.0 |
| dependencies, rule R-1: animation and graphics | `react-native-reanimated` 4.5.1; `react-native-worklets` 0.10.1; `react-native-gesture-handler` ~2.32.0; `react-native-svg` 15.15.4; `@shopify/react-native-skia` 2.6.2; `@shopify/flash-list` 2.0.2 |
| dependencies, rule R-1: Expo modules | `expo-video` ~57.0.5; `expo-blur` ~57.0.3; `expo-linear-gradient` ~57.0.2; `expo-haptics` ~57.0.3; `expo-keep-awake` ~57.0.2; `expo-font` ~57.0.4; `expo-splash-screen` ~57.0.9; `expo-status-bar` ~57.0.1; `expo-system-ui` ~57.0.4; `expo-constants` ~57.0.20; `expo-linking` ~57.0.11 |
| dependencies, rule R-1: kept from the template | `expo-image`, `expo-symbols`, `expo-web-browser`, `expo-device`, `@expo/ui`, `expo-glass-effect` (V3) |
| dependencies, **rule R-2** (exact): UI and styling | `heroui-native` 1.0.10; `uniwind` 1.12.0; `tailwindcss` 4.3.3; `tailwind-variants` 3.3.1; `tailwind-merge` 3.7.0; `@gorhom/bottom-sheet` 5.2.14 |
| dependencies, rule R-2: charts, icons, fonts | `victory-native` 42.0.1; `lucide-react-native` 1.49.0; `@expo-google-fonts/orbitron` 0.4.2; `@expo-google-fonts/inter` 0.4.2; `@expo-google-fonts/jetbrains-mono` 0.4.1 (all MIT AND OFL-1.1, V37; D16 replaces Geist) |
| dependencies, rule R-2: data and forms | `@tanstack/react-query` 5.104.0; `react-hook-form` 7.89.0; `zod` 4.6.5; `@hookform/resolvers` 5.9.1 |
| dependencies, rule R-2: internal | `@dems/shared` `*` |
| devDependencies: types | `typescript` 6.0.3; `@types/react` 19.2.18 |
| devDependencies: tests | `jest-expo` ~57.0.5 (R-1); `jest` 29.7.0; `@testing-library/react-native` 13.3.3; `react-test-renderer` 19.2.3 |
| devDependencies: lint and checks | `eslint` 9.39.5; `eslint-config-expo` 57.0.2; `expo-doctor` 1.20.4 |
| **Must be absent** | `expo-updates`, `expo-dev-client`, `eas-cli`, `moti`, `nativewind`, `react-native-gesture-handler@3.x`, `@react-navigation/native` (as a direct dependency) |

`lottie-react-native ~7.3.8` stays deferred (03 SD-13). It is added through rule R-1 only when design assets exist.

### 1.5 Scripts per package

| Package | dev | build | typecheck | lint | test | Extra scripts |
|---|---|---|---|---|---|---|
| shared | `tsc --noEmit --watch` | `tsx scripts/gen-theme.ts && tsc --noEmit` | `tsc --noEmit` | `oxlint` | `vitest run` | none |
| mock-core | `tsx watch src/index.ts` | `tsc --noEmit` (the service runs from TS source through tsx; nothing is emitted) | `tsc --noEmit` | `oxlint` | `vitest run` | `start`: `tsx src/index.ts`; `probe:ws`: `tsx scripts/ws-probe.ts` |
| core-web | `vite` | `vite build && tsc -b` (the router plugin regenerates `src/routeTree.gen.ts` before `tsc`) | `tsc -b` | `oxlint` | `vitest run` | `preview`: `vite preview` |
| mobile | `EXPO_NO_TELEMETRY=1 expo start --localhost --port 8081` | `EXPO_NO_TELEMETRY=1 expo prebuild --platform android --no-install && cd android && ./gradlew assembleDebug` | `tsc --noEmit` | `eslint .` | `jest` | `android`: `EXPO_NO_TELEMETRY=1 expo run:android`; `prebuild`: `EXPO_NO_TELEMETRY=1 expo prebuild --platform android --no-install`; `doctor`: `EXPO_NO_TELEMETRY=1 expo-doctor`; `deps:check`: `EXPO_NO_TELEMETRY=1 expo install --check`; `reverse`: `adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081` |

- `src/routeTree.gen.ts` is **committed**, so `typecheck` passes on a clean checkout before the first Vite run.
- The mobile template's `reset-project` script and its example files are removed:
  - `src/app/explore.tsx`
  - `src/components/*` (all of them)
  - `src/hooks/*`
  - `src/constants/theme.ts`
  - `scripts/reset-project.js`
- These are files created by this task's scaffold, not user files.

### 1.6 TypeScript configuration

**`tsconfig.base.json` (root)**, used by shared and mock-core:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

- `erasableSyntaxOnly` forbids `enum`, `namespace` and parameter properties, which enforces the const-object rule (03 SD-37). Whether the flag exists in TS 6.0.3 is a hypothesis; row 15's `tsc` run proves it. **Fallback:** remove the flag and keep the rule through an oxlint `no-restricted-syntax` equivalent, or by review in row 24.
- core-web keeps the template's `tsconfig.json`, `tsconfig.app.json` and `tsconfig.node.json` (V23), and adds `"paths": { "@/*": ["./src/*"] }` to `tsconfig.app.json`.
- mobile keeps the template's `tsconfig.json` (V34): it extends `expo/tsconfig.base`, uses `strict`, and maps `@/*` → `./src/*`.

### 1.7 `.npmrc` and `.node-version`

- `.npmrc`: a single line, `save-exact=true`.
- `.node-version`: a single line, `26.8.2`.

### 1.8 `.gitignore` additions (append only; row 7's rules stay)

```
.cache/
apps/mobile/android/
apps/mobile/ios/
apps/mobile/.expo/
apps/core-web/dist/
*.tsbuildinfo
coverage/
```

---

## 2. `packages/shared` contract

### 2.1 Module map and exports

`package.json`:
- `"name": "@dems/shared"`, `"version": "0.1.0"`, `"private": true`, `"type": "module"`
- `"exports"`:
  - `"."`: `"./src/index.ts"`
  - `"./domain"`: `"./src/domain/index.ts"`
  - `"./api"`: `"./src/api/index.ts"`
  - `"./realtime"`: `"./src/realtime/index.ts"`
  - `"./tokens"`: `"./src/tokens/index.ts"`
  - `"./theme/heroui-web.css"`: `"./theme/heroui-web.css"`
  - `"./theme/heroui-native.css"`: `"./theme/heroui-native.css"`

| File | Exports |
|---|---|
| `src/domain/ids.ts` | `EntityId<T>` (branded string) |
| `src/domain/entities.ts` | 24 entity interfaces (§2.2) |
| `src/domain/enums.ts` | Part C enumerations as `const` objects, their union types and display-label maps (§2.3) |
| `src/api/constants.ts` | Network constants (§2.4) |
| `src/api/health.ts` | `HealthResponse` type and `HealthResponseSchema` (§2.5) |
| `src/api/realtime-messages.ts` | `Heartbeat`, `WsServerMessage` and their schemas (§2.5) |
| `src/realtime/heartbeat-client.ts` | `createHeartbeatClient()`, framework-free (§2.6) |
| `src/realtime/use-heartbeat.ts` | `useHeartbeat()` React hook (§2.6) |
| `src/realtime/heartbeat-context.tsx` | `HeartbeatProvider` (accepts an optional `socketFactory`) |
| `src/tokens/tokens.ts` | **The single token source** (§2.7) |
| `src/tokens/status-tones.ts` | `StatusTone` and the status-to-tone maps (§2.8) |
| `scripts/gen-theme.ts` | Generator for both theme CSS files (§2.9) |
| `theme/heroui-web.css`, `theme/heroui-native.css` | Generated and committed (§2.9) |
| `test/theme.test.ts`, `test/schemas.test.ts` | Smoke tests (§8) |

### 2.2 Entity type stubs (§21.3; 01 L370-L385)

**Rule:** each stub is an exported `interface` with a branded `readonly id`. It carries only the attributes the design book itself fixes. The book defines no other attributes (01 G10, L681), so the feature phase adds them from §11.3, §19.2, §24.1 and §25.3.

| Group | Entity | Fields in this phase |
|---|---|---|
| Device | `Device` | `id` |
| Device | `HardwareRevision` | `id` |
| Device | `SoftwareRelease` | `id` |
| Identity | `Operator` | `id` |
| Identity | `Role` | `id` (role names are a book gap, 01 G1) |
| Identity | `AuthenticationEvent` | `id` |
| Session | `Session` | `id`, `state: SessionState` (§6.2) |
| Session | `CaseReference` | `id` |
| Session | `SubjectWitnessMetadata` | `id` |
| Tracks | `VideoTrack` | `id`, `trackId: 'VIDEO-01' \| 'VIDEO-02'` (§6.3) |
| Tracks | `AudioTrack` | `id`, `trackId: 'AUDIO-01' \| 'AUDIO-02'` (§6.3) |
| Tracks | `TrackHealthEvent` | `id` |
| Evidence | `EvidenceObject` | `id` |
| Evidence | `Manifest` | `id` |
| Evidence | `SignatureRecord` | `id` |
| Audit | `AuditEvent` | `id` |
| Audit | `ExportEvent` | `id` |
| Audit | `TamperEvent` | `id` |
| Trust | `Certificate` | `id` |
| Trust | `KeyReference` | `id` |
| Trust | `ProvisioningRecord` | `id` |
| Health | `HealthSnapshot` | `id` |
| Health | `StorageDevice` | `id` |
| Health | `TimeSourceState` | `id`, `source: TimeSource` (§2.2, §5.3) |

`src/domain/entities.ts` exports the tuple `ENTITY_NAMES` (24 names in the order above). The row-15 check compares it with 01 L370-L385.

### 2.3 Status enumerations (01 Part C, L641-L666)

**Wire-value rule:**
- State enumerations use SCREAMING_SNAKE_CASE. Spaces, slashes and hyphens become `_`, and runs of underscores collapse.
- Each enumeration has a `…Label` map that holds **the book's exact display text**.
- Identifiers that the book defines as IDs keep their exact form (`TrackId`).
- Each enumeration is written as `export const X = { … } as const; export type X = typeof X[keyof typeof X];`.

| Enumeration | Wire values | Display labels that differ from the wire value | Source |
|---|---|---|---|
| `SessionState` | CREATE, PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING, SEALED, FAULT, RECOVERY | none | §6.2. FAULT and RECOVERY are demo assumptions (01 G4) |
| `TabletScreen` | LOGIN, DASHBOARD, NEW_SESSION, METADATA, PRE_CHECK, START, RECORDING_MONITOR, STOP, FINALIZATION, SESSION_SUMMARY | "NEW SESSION", "PRE-CHECK", "RECORDING MONITOR", "SESSION SUMMARY" | §5.2 |
| `CoreLinkState` | ONLINE, OFFLINE | none | §5.3 |
| `LensState` | READY, FAULT | none | §5.3 |
| `MicState` | READY, NO_SIGNAL, CLIP | "NO SIGNAL" | §5.3 |
| `StorageState` | READY, LOW, FULL | none. `StorageRecordingLabel` = "OK" for the recording screen | §5.3, §5.4 |
| `TimeSource` | GNSS, NTP, RTC (priority order) | none | §2.2, §5.3 |
| `TimeQuality` | LOCKED | none | §5.4 (the only value named; 01 G9) |
| `SecurityState` | READY, FAULT | none | §5.3 |
| `TrackId` | `VIDEO-01`, `VIDEO-02`, `AUDIO-01`, `AUDIO-02` (verbatim IDs) | none | §6.3, §11.1 |
| `TrackRecState` | REC, DEGRADED, LOST | none | §5.4, §23.1 |
| `DeviceReadiness` | READY | none | EVT-01 |
| `PowerFailState` | NORMAL, POWER_FAIL_DETECTED, RECORDING_RECOVERY_MARKER_WRITTEN, FLUSH_MEDIA_AND_METADATA, STORAGE_SYNC, SAFE_SHUTDOWN, POWER_OFF | none | §18.1 |
| `BootRecoveryState` | RECOVERY_SCAN, INCOMPLETE_SESSION_ANALYSIS | none | §18.1 |
| `EvidenceLifecycleStage` | CAPTURE, RECORDING, FINALIZING, HASH, MANIFEST, ENCRYPT, SIGN, SEALED_LOCAL_EVIDENCE, AUTHORIZED_REVIEW, AUTHORIZED_EXPORT_TRANSFER, DESTINATION_VERIFICATION, RETENTION_ARCHIVE_DISPOSITION | "SEALED LOCAL EVIDENCE", "AUTHORIZED REVIEW", "AUTHORIZED EXPORT / TRANSFER", "DESTINATION VERIFICATION", "RETENTION / ARCHIVE / DISPOSITION" | §19.1 |
| `FinalizationStep` | FINALIZE_TRACKS, CALCULATE_HASHES, BUILD_MANIFEST, ENCRYPT_PAYLOAD, SIGN_MANIFEST, STORE_SEALED_PACKAGE | "Finalize tracks", "Calculate hashes", "Build manifest", "Encrypt evidence payload", "Sign manifest", "Store sealed evidence package" | §12.2 |
| `UpdateStep` | SIGNATURE_VERIFICATION, COMPATIBILITY_CHECK, ANTI_ROLLBACK_POLICY, INSTALL_INACTIVE_SLOT, REBOOT, POST_BOOT_HEALTH_CHECK | the book's step names (01 L659) | §20.2 |
| `UpdateOutcome` | PASS, FAIL | none | §20.2 |
| `SystemSlot` | A, B | none | §20.3 |
| `Led` | POWER, REC, NET, STORAGE, FAULT | "RECORD" and "NETWORK" as long labels | §3 A.34, §4.2 |
| `LcdButton` | UP, DOWN, ENTER, BACK | none | §3 A.33 |
| `NetworkDomain` | CAMERA, MANAGEMENT, SERVICE_UPDATE, EXPORT_TRANSFER | "Camera", "Management", "Service/Update", "Export/Transfer" | §21.1 |
| `HealthCategory` | CPU, STORAGE, FAN, NETWORK, CAMERA, AUDIO, TIME, SECURITY | none | §6.1, §21.2 |
| `AuditEventKind` | AUTHENTICATION, TRACK_HEALTH, AUDIT, EXPORT, TAMPER, AUDIO_CLIP, SOURCE_FAULT, POWER_FAIL, WATCHDOG_RECOVERY, UNAUTHORIZED_EXPORT, AUDIT_CHAIN_DISCONTINUITY, GAIN_PHANTOM_CHANGE, PROVISIONING, CONFIG_DRIFT | none | 01 L665 |
| `HeartbeatState` (client-side, not from the book) | CONNECTING, LIVE, STALE, OFFLINE | "Connecting", "Live", "Stale", "Offline" | §2.6 |

**Roles:** no role enumeration exists in this phase. The book names none (01 G1), so the feature phase defines one.

### 2.4 Network constants (`src/api/constants.ts`)

| Constant | Value |
|---|---|
| `MOCK_CORE_HOST` | `'127.0.0.1'` |
| `MOCK_CORE_PORT` | `4400` |
| `CORE_HTTP_ORIGIN` | `'http://127.0.0.1:4400'` |
| `API_BASE_PATH` | `'/api/v1'` (01 L363, ICD-23) |
| `HEALTH_PATH` | `'/api/v1/health'` |
| `WS_PATH` | `'/ws'` |
| `CORE_WS_URL` | `'ws://127.0.0.1:4400/ws'` |
| `HEARTBEAT_INTERVAL_MS` | `1000` |
| `HEARTBEAT_STALE_AFTER_MS` | `2500` |
| `RECONNECT_BACKOFF_MS` | `[500, 1000, 2000, 4000, 8000]` (the last value repeats) |
| `RECONNECT_JITTER_MS` | `250` |
| `WEB_DEV_ORIGINS` | `['http://127.0.0.1:5173', 'http://localhost:5173']` |
| `SELF_ORIGINS` | `['http://127.0.0.1:4400', 'http://localhost:4400']` |
| `SERVICE_NAME` | `'dems-mock-core'` |

- Both apps use these constants and have no environment overrides.
- The emulator reaches the same URLs through `adb reverse` (§6.2), and a physical USB tablet (A4) would too.
- `GET /api/v1/health` is **service liveness**. It is distinct from the book's `GET /api/v1/device/health` (§21.2), a device health snapshot left to the feature phase. The book leaves the WS path undefined (01 G6), so `/ws` is this spec's choice.

### 2.5 `HealthResponse` and `Heartbeat`

```ts
// src/api/health.ts
export interface HealthResponse {
  status: 'ok';
  service: 'dems-mock-core';
  version: string;            // equals apps/mock-core/package.json "version" ("0.1.0")
  apiVersion: 'v1';
  serverTime: string;         // ISO-8601 UTC, e.g. "2026-09-30T16:41:00.000Z"
  uptimeMs: number;           // integer, >= 0
  ws: {
    path: '/ws';
    heartbeatIntervalMs: 1000;
    clients: number;          // currently connected WS clients, integer >= 0
  };
}
```

```ts
// src/api/realtime-messages.ts
export interface Heartbeat {
  type: 'heartbeat';
  v: 1;                       // message schema version
  seq: number;                // global tick counter since server start; the connect-time message carries the current value (0 before the first tick)
  serverTime: string;         // ISO-8601 UTC
  uptimeMs: number;           // integer, >= 0
  intervalMs: 1000;
  clients: number;            // connected WS clients at send time
  sessionState: SessionState | null;   // always null in this phase (D4: no simulator)
}
export type WsServerMessage = Heartbeat;   // discriminated on "type"; the feature phase adds members
```

- `HealthResponseSchema` and `HeartbeatSchema` are zod 4 schemas mirroring the types exactly.
- They use `z.literal` for the constant fields, `z.iso.datetime()` for timestamps, and `z.int().nonnegative()` for counters. The zod-4 API names are a hypothesis. **Fallback:** `z.string().datetime()` and `z.number().int().min(0)`.
- `WsServerMessageSchema` is a `z.discriminatedUnion('type', [HeartbeatSchema])`.
- Clients parse every inbound WS message with `WsServerMessageSchema.safeParse`. Invalid messages are dropped, and a `console.warn` in development records the drop.

### 2.6 Heartbeat client and hook

`createHeartbeatClient({ url, socketFactory = (u) => new WebSocket(u), now = Date.now, onResync? })` returns `{ subscribe(listener), getSnapshot(), start(), stop() }`.

The snapshot is `{ state: HeartbeatState, seq: number | null, serverTime: string | null, lastBeatAt: number | null, clients: number | null, reconnectAttempt: number }`.

| From | Event | To | Action |
|---|---|---|---|
| (start) | `start()` | CONNECTING | Open the socket |
| CONNECTING | valid heartbeat | LIVE | Store `seq`, `serverTime`, `clients` and `lastBeatAt`. If `reconnectAttempt > 0`, call `onResync()` and reset `reconnectAttempt` to 0 |
| LIVE | valid heartbeat | LIVE | Update the fields |
| LIVE | no heartbeat for `HEARTBEAT_STALE_AFTER_MS` (2,500 ms) | STALE | Checked by a 500 ms timer |
| STALE | valid heartbeat | LIVE | Update the fields |
| any | socket `close` or `error` | OFFLINE | Schedule a reconnect after `RECONNECT_BACKOFF_MS[min(attempt, 4)] + random(0..250)` ms, and increment `reconnectAttempt` |
| OFFLINE | reconnect timer fires | CONNECTING | Open a new socket |
| any | `stop()` | (stopped) | Clear timers and close the socket with code 1000 |

- `useHeartbeat()` wraps the client with React's `useSyncExternalStore`. It reads `url` and `socketFactory` from `HeartbeatProvider`, which defaults to `CORE_WS_URL` and the global `WebSocket`.
- `onResync` defaults to a no-op. Both apps pass `() => queryClient.invalidateQueries({ queryKey: ['health'] })`, which is the scaffold stand-in for the §5.5/§5.6 resync (01 S2 L696).

### 2.7 Single token source (`src/tokens/tokens.ts`): the designer's system (D16)

**Source:** `/Users/gsp-budi/Documents/DEMS/ui_design/DEMS-DesignSystem.png`, which is the token authority (D16). Relevant panels: §02 colour palette, §03 typography, §06 badges, §07 cards and panels, §11 spacing, radius, stroke and elevation. The other four mockups were read for usage context (V36).

**Theme direction (from the design):**
- **Dark theme only.**
- Black canvas and **warm brown-black panels** (rev 3, D28/Q6; charcoal only for overlays).
- Thin gold/bronze hairline borders with a soft outer gold glow.
- Gold for brand and primary actions; bronze for secondary actions.
- Saturated status colours.
- Orbitron display capitals.

**How the kits pick it up:**
- Kit defaults are extended **through kit variables first**.
- Anything the variables cannot express is closed with Tailwind utilities on kit components (§2.10). No component is hand-built (D6).
- Animation design is delegated to Claude (D15: "semua animasi kamu yang tentukan"), so the motion tokens below are this spec's.

Every colour is stored as sRGB hex, and as `#RRGGBBAA` where an alpha is needed. Hex works in CSS, in React Native, and in Skia, Recharts and Motion alike.

#### Colours

Sourced by the design (§02 hex labels are authoritative; rendered swatches match within raster noise, V36):

| Token | Hex | Role (design wording) | Kit variable(s) |
|---|---|---|---|
| `gold` | `#FFC86B` | Brand, primary actions, highlights | `--accent`, `--focus`, `--link` |
| `bronze` | `#FF9F3D` | Secondary actions, accents, icons | Tailwind `--color-bronze` (no kit variable; §2.10) |
| `success` | `#22C55E` | Success states, online, ready | `--success` |
| `warning` | `#F59E0B` | Warnings, attention | `--warning` |
| `danger` | `#EF4444` | Errors, critical alerts (also the REC red) | `--danger` |
| `info` | `#3B82F6` | Information, links, updates | Tailwind `--color-info` (no kit variable; §2.10) |
| `gray` | `#9CA3AF` | Muted text, icons, placeholders | `--muted`, `--field-placeholder` |
| `charcoal` | `#1F262E` | Cards, surfaces, elevated backgrounds. **Rev 3 (D28/Q6): used for L5 only** (menus, popovers, tooltips, dialogs), because the rendered panels are warm (V40) | `--overlay` |
| `black` | `#0B0D0F` | App background, main canvas | `--background`; also `--accent-foreground`, `--success-foreground`, `--warning-foreground` |

Sampled from the mockups (not in the hex legend; **designer to confirm**, V36):

| Token | Hex | Evidence | Kit variable(s) |
|---|---|---|---|
| `sealed` | `#8B5CF6` | The Sealed badge pixels sit at hue ≈258°, which matches Tailwind violet-500. Every other status hex in the legend is a Tailwind 500 value (green-500, amber-500, red-500, blue-500) | Tailwind `--color-sealed` (§2.10) |
| `foreground` | `#F9FAFB` | Heading text samples at ≈`#F8F8F8`, which matches Tailwind gray-50. `gray` (#9CA3AF) is gray-400 of the same scale | `--foreground` and every `*-foreground` that sits on a dark fill |

Derived for kit slots the design does not name (computed, V39):

| Token | Value | Derivation | Kit variable(s) |
|---|---|---|---|
| `surface` (**rev 3**) | `#191008` | **Measured (V40):** median fill of six Dashboard and Session Monitor panels (range `#160F07`–`#1B1108`); the warm L2 panel (D28/Q6) | `--surface` |
| `surface-secondary` (**rev 3**) | `#150E07` | **Measured (V40):** inset tile interior (Dashboard MIC tile), darker than the panel (L3) | `--surface-secondary`, `--field-background` |
| `surface-tertiary` (**rev 3**) | `#251C14` | panel + 5% white (hover and nested emphasis) | `--surface-tertiary`, `--segment` |
| `default` (**rev 3**) | `#2B231C` | panel + 8% white (neutral component fill) | `--default` |
| `field-background` (**rev 3**) | `#150E07` | Equal to `surface-secondary`: the mockup inputs are insets | `--field-background` |
| `border` (**rev 3**) | `#FF9F3D59` (bronze at 35%) | **Measured (V40):** the Dashboard panel edge samples at `#563218`–`#643F22` (hue ≈25°) over the `#191008` fill, which is bronze at about 33–49% alpha. The design-system sheet's lighter 18% gold hairline (V36) is kept only for Card §07 look-alikes | `--border` |
| `separator` | `#FFFFFF14` (white at 8%) | Row dividers in the tables | `--separator` |
| `foreground-2` (**rev 3**) | `#D8CEC6` | **Measured (V40):** warm secondary text on panels (Session Monitor value text ≈`#D0CCC8`–`#DCD8D4`, Dashboard nav labels ≈`#DCCCC4`–`#E4D8D0`) | Tailwind `--color-foreground-2` |
| `field-border` | `#9CA3AF40` (gray at 25%) | The form-field outlines are neutral, not gold | `--field-border` |
| `danger-foreground` | `#FFFFFF` | The design puts white labels on red fills ("Stop Session", "End Session") | `--danger-foreground` |
| Status **text** tones (400 step) | success `#4ADE80`, warning `#FBBF24`, danger `#F87171`, info `#60A5FA`, sealed `#A78BFA` | The sampled Sealed **text** pixels (≈`#A880F8`) are lighter than the fill, which suggests a lighter step for text on dark. The 500 step fails AA for small text on charcoal (V39) | web `--success-soft-foreground`, `--warning-soft-foreground`, `--danger-soft-foreground`; native `--color-*-soft-foreground`; Tailwind `--color-info-text`, `--color-sealed-text` |
| Status **soft fills** | base colour at 15% alpha, e.g. `#EF444426` | Matches HeroUI Native's own 15% `accent-soft` recipe (V38) | web `--*-soft`; native `--color-*-soft`; Tailwind `--color-info-soft`, `--color-sealed-soft` |

#### Contrast (WCAG 2.x, V39)

| Pair | Ratio | Rating |
|---|---|---|
| foreground / background | 18.63 | AAA |
| foreground / panel `#191008` (rev 3) | 17.96 | AAA |
| foreground-2 / panel | 12.12 | AAA |
| gray / background | 7.67 | AAA |
| gray / panel | 7.39 | AAA |
| gray / surface-tertiary (rev 3, `#251C14`) | 6.59 | AA (the rev-2 AA-large exception is resolved by the warm surfaces) |
| gold / panel | 12.27 | AAA |
| black label on gold | 12.72 | AAA |
| bronze / panel | 9.19 | AAA |
| success-400 / panel | 10.77 | AAA |
| warning-400 / panel | 11.24 | AAA |
| danger (500) / panel | 4.99 | AA; text still uses the 400 step (6.78) for consistency |
| info-400 / panel | 7.38 | AAA |
| sealed-400 / panel | 6.90 | AA |
| black on success | 8.54 | AAA |
| black on warning | 9.06 | AAA |
| white on danger (the design's choice) | 3.76 | **AA-large only.** Labels on red fills must be at least 18.66 px bold or 24 px. Otherwise use black (5.17). Recorded as a design question (§13) |
| white on info | 3.68 | **AA-large only.** Same rule |

#### Typography (design §03)

| Token | Web family (fontsource, V37) | Mobile family (V37) | Size / line height (px) | Weight | Tracking | Case | Utility |
|---|---|---|---|---|---|---|---|
| `display` | `"Orbitron Variable"` (a free stand-in for Eurostile Bold) | `Orbitron_700Bold` | 32 / 40 | 700 | 1% (0.01em) | UPPER | `font-display text-display uppercase` |
| `h1` | `"Inter Variable"` | `Inter_700Bold` | 24 / 32 | 700 | 0 | none | `text-h1 font-bold` |
| `h2` | Inter | `Inter_600SemiBold` | 20 / 28 | 600 | 0 | none | `text-h2 font-semibold` |
| `h3` | Inter | `Inter_600SemiBold` | 16 / 24 | 600 | 0 | none | `text-h3 font-semibold` |
| `body` | Inter | `Inter_400Regular` | 14 / 20 | 400 | 0 | none | `text-body` |
| `caption` | Inter | `Inter_400Regular` | 12 / 16 | 400 | 0 | none | `text-caption` |
| `label` | Inter | `Inter_500Medium` | 11 / 16 | 500 | 5% (0.05em) | UPPER | `text-label font-medium uppercase` |
| `data` (mono) | `"JetBrains Mono Variable"` | `JetBrainsMono_400Regular` | 12 / 16 | 400 | 2% (0.02em) | none | `font-mono text-data` |
| `readout` (derived) | Orbitron | `Orbitron_700Bold` | 24 / 32 (header clock), 32 / 40 (REC timer, SYSTEM READY) | 700 | 1% | none | `font-display text-h1 tabular-nums` or `text-display` |

- The `readout` row is derived: Dashboard1 and SessionMonitor set their large numerals (clock `14:27:32`, timer `00:18:42`) in the display face.
- The design's mono fallback "Roboto Mono" is not installed.
- Geist is dropped (D16).

**Mobile font variables** (the vendor pattern, V28):
- `--font-normal: 'Inter_400Regular'`
- `--font-medium: 'Inter_500Medium'`
- `--font-semibold: 'Inter_600SemiBold'`
- `--font-bold: 'Inter_700Bold'`
- plus `--font-display: 'Orbitron_700Bold'` and `--font-mono: 'JetBrainsMono_400Regular'`
- On React Native each weight is its own family, so `font-bold` resolves through `--font-bold`.

#### Spacing, radius and stroke (design §11)

No Tailwind or kit override is needed for spacing, because the design scale sits on Tailwind v4's defaults.

| Scale | Design values (px) | Mapping |
|---|---|---|
| Spacing | 4, 8, 12, 16, 24, 32, 48 | Tailwind v4 default `--spacing: 0.25rem`: utilities `1, 2, 3, 4, 6, 8, 12` (e.g. `p-4` = 16 px). JS export: `spacing = [4, 8, 12, 16, 24, 32, 48]` |
| Radius | 4, 8, 12, 16, full | Both kits derive `--radius-sm/lg/xl/2xl` as `--radius` × 0.5, 1, 1.5 and 2 (V38). Setting **`--radius: 0.5rem`** (8 px) makes `rounded-sm` = 4, `rounded-lg` = 8, `rounded-xl` = 12, `rounded-2xl` = 16, `rounded-full` = full: an exact match. **`--field-radius: 0.5rem`** (8 px; the design's inputs) on both kits |
| Stroke | 1, 1.5, 2 | `--border-width: 1px` (kit default); utilities `border`, `border-[1.5px]`, `border-2`; ring widths inside the elevation shadows |

#### Elevation (design §11, levels 0-3, gold glow)

- The design draws four levels without numbers. Level 1's hairline alpha is **measured** (V36); the other blur and alpha values are **derived** so the glow grows monotonically.
- Hex alpha key: `1F` = 0.12, `38` = 0.22, `59` = 0.35, `80` = 0.50, `A6` = 0.65.
- **Rev 3:** the glow hue moves from gold to bronze, because the Dashboard panel edges sample at hue ≈25° (V40, D16 "gold/bronze").

| Level | `box-shadow` | Used for | Kit variable or utility |
|---|---|---|---|
| 0 | `none` | Rows, list items, flat inputs | `--field-shadow` (the kit focus ring still applies) |
| 1 | `0 0 0 1px #FF9F3D59, 0 0 14px 0 #FF9F3D1F` (**rev 3**, bronze per V40) | Every panel and card (the default) | `--surface-shadow`; Tailwind `--shadow-glow-1` |
| 2 | `0 0 0 1px #FF9F3D80, 0 0 20px 0 #FF9F3D38` (**rev 3**) | Hover, selected sidebar item, active tab, focused card | Tailwind `--shadow-glow-2` |
| 3 | `0 0 0 1.5px #FFC86BA6, 0 0 28px 2px #FF9F3D59` (**rev 3**: gold ring, bronze bloom) | Primary CTA, "SYSTEM READY" ring, popovers, dialogs, toasts | `--overlay-shadow`; Tailwind `--shadow-glow-3` |

#### Motion (Claude-owned per D15)

The duration, easing, spring and choreography tokens stay as first specified:

| Group | Token | Value |
|---|---|---|
| duration (ms) | `instant` | 90 |
| | `fast` | 160 |
| | `base` | 240 |
| | `slow` | 420 |
| | `slower` | 640 |
| | `beatIn` | 180 |
| | `beatOut` | 720 |
| | `ambient` | 1200 |
| easing | `standard` | `[0.2, 0, 0, 1]` |
| | `luxe` | `[0.22, 1, 0.36, 1]` |
| | `emphasized` | `[0.16, 1, 0.3, 1]` |
| | `exit` | `[0.4, 0, 1, 1]` |
| spring | `gentle` | `{170, 26, 1}` (stiffness, damping, mass), ζ ≈ 1.00. Enter transitions |
| | `snappy` | `{420, 34, 0.9}`, ζ ≈ 0.87. Press and toggle feedback |
| | `bouncy` | `{260, 18, 1}`, ζ ≈ 0.56. Success confirmations only |
| choreography | `stagger` | 60 ms |
| | `delayChildren` | 80 ms |
| proof mode | `proofSlowFactor` | 10 |

Ambient tokens added for the design's live elements:

| Token | Value | Use |
|---|---|---|
| `glowBreath` | 2,400 ms loop | Elevation 2 ↔ 3 on "SYSTEM READY" and "SECURE" |
| `recPulse` | 1,200 ms loop | REC dot opacity 1 → 0.35 → 1 |
| `meterFrameMs` | 50 | A 20 Hz audio-meter update target (01 G5 range) |

- **Mapping:** Motion takes `transition={{ type: 'spring', ...spring.gentle }}` and `ease: easing.luxe`. Reanimated takes `withSpring(v, spring.gentle)`, `withTiming(v, { duration, easing: Easing.bezier(...easing.luxe) })`, and layout builders `.springify().stiffness(170).damping(26).mass(1)`.
- **Reduced motion:**
  - web: `<MotionConfig reducedMotion="user">`;
  - mobile: `.reduceMotion(ReduceMotion.System)` (V33).
  - Spatial movement then becomes a `fast` opacity fade, and ambient loops stop.

### 2.8 Status tone map (`src/tokens/status-tones.ts`, S8)

`StatusTone = 'accent' | 'default' | 'success' | 'warning' | 'danger' | 'info' | 'sealed'`.
- The first five are **exactly** the kit Chip `color` values on both platforms (V29), so they need no translation.
- `info` and `sealed` render as `Chip color="default"` plus the §2.10 className recipe.

**Design badges** (DesignSystem §06) and **tags** (AssetSample "Badges & Tags"). Lucide icon names are stored as strings and resolved per platform:

| Badge | Tone | Icon |
|---|---|---|
| Ready | success | `CircleCheck` |
| Recording | danger | `Circle` (filled, `recPulse`) |
| Offline | default | `Circle` |
| Sealed | sealed | `BadgeCheck` |
| Secure | success | `ShieldCheck` |
| Connected | success | `Wifi` |
| Warning | warning | `TriangleAlert` |
| Info | info | `Info` |
| Under Review | warning (**rev 3**, 04 §9 #10: one label, amber) | `Eye` |
| Archived | default | `Archive` |

| Tag | Tone | Kit variant |
|---|---|---|
| NEW | info | soft |
| URGENT | danger | soft |
| SEALED | sealed | soft |
| IN REVIEW | warning (**rev 3**, 04 §9 #10) | outline |
| EXPORTED | info (**rev 3**, 04 §9 #11: Info Blue) | outline |
| ARCHIVED | default | outline (`variant` per kit; §2.10) |

**Indicator sets** (AssetSample "Status Indicators"):
- Online / Warning / Error / Offline → success / warning / danger / default.
- Secure / Attention / Critical / Unknown shields → success / warning / danger / default.
- Ready / Recording / Paused / Stop chips → success / danger / warning / default.

**Enumeration tones:**

| Enumeration | success | warning | danger | accent | info | sealed | default |
|---|---|---|---|---|---|---|---|
| HeartbeatState | LIVE | STALE | OFFLINE | none | none | none | CONNECTING |
| CoreLinkState | ONLINE | none | OFFLINE | none | none | none | none |
| LensState, SecurityState | READY | none | FAULT | none | none | none | none |
| MicState | READY | NO_SIGNAL | CLIP | none | none | none | none |
| StorageState | READY | LOW | FULL | none | none | none | none |
| TimeSource | GNSS | RTC | none | none | NTP | none | none |
| SessionState | none | ARMED, STOPPING, RECOVERY | RECORDING, FAULT | PRECHECK, FINALIZING | none | SEALED | CREATE |
| TrackRecState | REC | DEGRADED | LOST | none | none | none | none |
| EvidenceLifecycleStage | AUTHORIZED_EXPORT_TRANSFER, DESTINATION_VERIFICATION | none | none | CAPTURE, RECORDING, FINALIZING, HASH, MANIFEST, ENCRYPT, SIGN | none | SEALED_LOCAL_EVIDENCE | AUTHORIZED_REVIEW, RETENTION_ARCHIVE_DISPOSITION |
| PowerFailState | NORMAL | POWER_FAIL_DETECTED, RECORDING_RECOVERY_MARKER_WRITTEN, FLUSH_MEDIA_AND_METADATA, STORAGE_SYNC | SAFE_SHUTDOWN, POWER_OFF | none | none | none | none |
| BootRecoveryState | none | RECOVERY_SCAN, INCOMPLETE_SESSION_ANALYSIS | none | none | none | none | none |

- RECORDING maps to `danger` (the design's red Recording badge).
- SEALED maps to `sealed` (the design's purple Sealed badge).
- That the icon names exist in `lucide-react` and `lucide-react-native` 1.49.0 is a hypothesis; the row 17 and 18 typechecks prove it. **Fallback:** the legacy names `CheckCircle2`, `AlertTriangle`, `Circle`.

### 2.9 Theme generation pipeline

**Generator:** `scripts/gen-theme.ts`, run with `tsx`, imports `tokens.ts` and writes two files.
- Both start with the header `/* GENERATED by packages/shared/scripts/gen-theme.ts from src/tokens/tokens.ts. Do not edit. */`
- Both are committed.
- The test in §8 fails on any drift between the committed files and the generator output.

**`theme/heroui-web.css`** (skeleton; the generator emits every token in §2.7):

```css
:root, .dark, [data-theme="dark"] {
  color-scheme: dark;
  --background: #0B0D0F;  --foreground: #F9FAFB;
  --surface: #191008;     --surface-secondary: #150E07;  --surface-tertiary: #251C14;
  --overlay: #1F262E;     --default: #2B231C;            --segment: #251C14;
  --accent: #FFC86B;      --accent-foreground: #0B0D0F;  --focus: #FFC86B;  --link: #FFC86B;
  --success: #22C55E;     --warning: #F59E0B;            --danger: #EF4444;  --danger-foreground: #FFFFFF;
  --success-soft: #22C55E26;  --success-soft-foreground: #4ADE80;
  --warning-soft: #F59E0B26;  --warning-soft-foreground: #FBBF24;
  --danger-soft:  #EF444426;  --danger-soft-foreground:  #F87171;
  --muted: #9CA3AF;  --border: #FF9F3D59;  --separator: #FFFFFF14;
  --field-background: #150E07;  --field-border: #9CA3AF40;  --field-placeholder: #9CA3AF;
  --radius: 0.5rem;  --field-radius: 0.5rem;
  --surface-shadow: 0 0 0 1px #FF9F3D59, 0 0 14px 0 #FF9F3D1F;
  --overlay-shadow: 0 0 0 1.5px #FFC86BA6, 0 0 28px 2px #FF9F3D59;
  --field-shadow: 0 0 0 0 transparent inset;
}
@theme {
  --color-bronze: #FF9F3D;
  --color-info: #3B82F6;   --color-info-soft: #3B82F626;   --color-info-text: #60A5FA;
  --color-sealed: #8B5CF6; --color-sealed-soft: #8B5CF626; --color-sealed-text: #A78BFA;
  --font-display: "Orbitron Variable", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
  --text-display: 2rem;      --text-display--line-height: 2.5rem;  --text-display--letter-spacing: 0.01em;
  --text-h1: 1.5rem;         --text-h1--line-height: 2rem;
  --text-h2: 1.25rem;        --text-h2--line-height: 1.75rem;
  --text-h3: 1rem;           --text-h3--line-height: 1.5rem;
  --text-body: 0.875rem;     --text-body--line-height: 1.25rem;
  --text-caption: 0.75rem;   --text-caption--line-height: 1rem;
  --text-label: 0.6875rem;   --text-label--line-height: 1rem;      --text-label--letter-spacing: 0.05em;
  --text-data: 0.75rem;      --text-data--line-height: 1rem;       --text-data--letter-spacing: 0.02em;
  --shadow-glow-1: 0 0 0 1px #FF9F3D59, 0 0 14px 0 #FF9F3D1F;
  --shadow-glow-2: 0 0 0 1px #FF9F3D80, 0 0 20px 0 #FF9F3D38;
  --shadow-glow-3: 0 0 0 1.5px #FFC86BA6, 0 0 28px 2px #FF9F3D59;
  --color-foreground-2: #D8CEC6;
  --color-charcoal: #1F262E;
}
```

- The variable block is unlayered, so it wins over HeroUI's `layer(theme)` values (V30).
- The `--text-*` names (`display`, `h1` … `data`) do not collide with Tailwind's default `text-xs` … `text-9xl` scale.

**`theme/heroui-native.css`** (skeleton; the same values):

```css
@layer theme {
  :root {
    @variant dark {
      /* every kit variable from the web block above, same values */
      --font-normal: 'Inter_400Regular';  --font-medium: 'Inter_500Medium';
      --font-semibold: 'Inter_600SemiBold'; --font-bold: 'Inter_700Bold';
    }
    @variant light { /* identical values: dark only (D16), so an OS light mode cannot flip it */ }
  }
}
@theme {
  --color-success-soft: #22C55E26;  --color-success-soft-foreground: #4ADE80;
  --color-warning-soft: #F59E0B26;  --color-warning-soft-foreground: #FBBF24;
  --color-danger-soft:  #EF444426;  --color-danger-soft-foreground:  #F87171;
  /* bronze, info*, sealed*, --text-*, --shadow-glow-* exactly as in the web @theme */
  --font-display: 'Orbitron_700Bold';
  --font-mono: 'JetBrainsMono_400Regular';
}
```

- The native soft colours are overridden at the `--color-*` level, because HeroUI Native derives them with `color-mix` inside its own `@theme` (V38).
- That a later `@theme` declaration wins is a hypothesis (H-S15).

**Import points:**
- Web: `apps/core-web/src/index.css`, after `@import "@heroui/styles";` (§4.3).
- Mobile: `apps/mobile/src/global.css`, after `@import 'heroui-native/styles';` (§5.3).
- **Fallback** (H-S2): relative-path imports. Web: `../../../packages/shared/theme/heroui-web.css`. Mobile: `../../../packages/shared/theme/heroui-native.css`.

### 2.10 Kit theming capability check (HeroUI v3 and HeroUI Native against the design)

**Method:** kit CSS and typings were read (V30, V38) and compared with the five mockups (V36).
- "Variables" means the look is achieved purely by the §2.9 token files.
- "Utilities" means Tailwind classes on a **kit component** (`className` is accepted by `Card`, `Chip`, `Button` and `Surface` on both platforms, V38). This is still ready-made composition (D6).

| Design element | HeroUI v3 (web) | HeroUI Native | Closure |
|---|---|---|---|
| Black canvas, charcoal cards | `--background`, `--surface` | same | **Variables** |
| Thin gold hairline and soft outer glow on panels | Card, Alert and Tabs apply `shadow-surface` → `--surface-shadow` (V38) | Card renders `Surface`, and `.surface__root` uses `box-shadow: var(--shadow-surface)` (V38) | **Variables** (`--surface-shadow` = elevation 1). Native relies on React Native `boxShadow` spread and blur support (H-S13). **Fallback:** `className="border border-[#FFC86B2E]"` (hairline only) |
| Glow levels 2 and 3 (hover, selected, CTA) | none per component | none | **Utilities:** `shadow-glow-2`, `shadow-glow-3` on the kit component |
| Gold primary action | `Button variant="primary"` uses `--accent` / `--accent-foreground` | Button default uses the accent colour | **Variables.** The design's gold→bronze gradient fill on some CTAs is a utility: web `bg-linear-to-r from-accent to-bronze`; native, an `expo-linear-gradient` inside the Button's background slot (`ButtonBackgroundProps` is exported, V29; that it accepts children is a hypothesis, H-S16). Fallback: the flat gold fill |
| Bronze secondary action | No bronze variable | none | **Utilities:** `Button variant="outline"` with `className="border-bronze/60 text-bronze"` |
| Destructive (red outline or red fill) | `Button variant="danger"` | Button danger colour | **Variables** (`--danger`, `--danger-foreground`) |
| Status badges: success, warning, danger, neutral | `Chip color=` | `Chip color=` (identical set, V29) | **Variables** (soft variants read `--*-soft` and `--*-soft-foreground`) |
| Info (blue) and Sealed (purple) badges and tags | No `info` or `sealed` colour | none | **Utilities:** `Chip color="default" className="bg-info-soft text-info-text border-info/40"` (and the `sealed` equivalents), using the `--color-*` tokens from §2.9 |
| Radius 4/8/12/16 | Derived from `--radius`, so exact with 0.5rem | same | **Variables** |
| Card and Surface corner radius | `min(32px, var(--radius-3xl))` = 24 px (V38), which is off the design scale | `--radius-3xl` = 24 px | **Utilities:** `className="rounded-xl"` (12 px) on `Card` and `Surface`. A global `--radius-3xl` override was rejected because it would invert the scale (3xl < 2xl) for other kit parts |
| Orbitron display capitals, Inter UI text, JetBrains Mono data | `--font-sans` via Tailwind; display and mono via `font-display` and `font-mono` | `--font-normal/medium/semibold/bold` (vendor pattern) plus `font-display`, `font-mono` | **Variables** for the body face. **Utilities** (`font-display text-display uppercase`, `font-mono text-data`) on kit `Text`, `Typography` and `Heading` |
| Toggle, checkbox, radio in gold | Use `--accent` | Use `--accent` | **Variables** |
| Inputs (dark, neutral outline, 8 px radius) | `--field-*` | `--field-*` | **Variables** |
| Alerts (success, error, warning, info with a coloured edge) | `Alert` with status colours | `Alert` | **Variables** for three colours. **Utilities** for info (`border-info/40 text-info-text`) |
| Donut and ring (storage 80%, "SYSTEM READY" ring) | `ProgressCircle` (V4) themed by `--accent` | **No progress component** in the native set (V38; 02 L306) | Web: **Variables**. Native: **ready-made library**, victory-native `Pie` or a Skia arc (03 SD-13, SD-14) |
| Bar and time charts (sealed per hour, bandwidth) | none | none | **Ready-made library:** Recharts (web), victory-native (mobile), themed from `tokens.ts` |
| Audio level meters (green→amber segmented bars) | none | none | **Ready-made library:** Skia (mobile, UI thread), Motion transforms on kit `Surface` (web). This is composition (01 S3) |
| Stepper ("Session Info → Devices Check → Ready") | none | none | **Composition** of kit `Chip` and `Separator` plus Motion or Reanimated (01 S12) |
| Sidebar navigation with a glowing active item (web) | `ListBox` or `Link` | n/a | **Utilities:** `shadow-glow-2 bg-accent-soft` on the selected item |
| Bottom tab bar (mobile mockup) | n/a | Expo Router tabs | Pending the scope decision (§13) |

**Verdict:**
- The kit variables express the core look: canvas, surfaces, gold primary, status colours, radius, fonts and level-1 glow borders.
- Four gaps remain: bronze, info and sealed colours; glow levels 2 and 3; the Card radius; gradient CTA fills.
- Each gap closes with Tailwind utilities on kit components, backed by the §2.9 `@theme` tokens.
- Charts, rings and meters use the ready-made libraries already chosen.
- No hand-built UI primitive is needed (D6).

---

## 3. `apps/mock-core`

### 3.1 Server construction

| File | Contract |
|---|---|
| `src/app.ts` | `buildApp(opts?: { logger?: boolean }): FastifyInstance`. Registers, in this order: `@fastify/cors` (§3.4), then `@fastify/websocket` with `{ options: { maxPayload: 65536 } }`, then the heartbeat plugin, then routes. Performs no listen |
| `src/heartbeat.ts` | Fastify plugin. It owns `seq`, the client registry, the `setInterval(1000)` ticker started on `onReady` and cleared on `onClose`, and the broadcast to every client whose `readyState === OPEN` |
| `src/index.ts` | `const app = buildApp(); await app.listen({ host: MOCK_CORE_HOST, port: MOCK_CORE_PORT })` (`127.0.0.1:4400`, SD-41); signal handling (§3.5) |
| `scripts/ws-probe.ts` | CLI probe (§3.6) |

- Logging: Fastify's built-in JSON logger (`logger: { level: process.env.LOG_LEVEL ?? 'info' }`) writing to stdout.
- The service binds only `127.0.0.1`. Passing `host: '0.0.0.0'` or `'::'` anywhere is forbidden (NFR4).

### 3.2 `GET /api/v1/health`

- Response: `200`, `content-type: application/json; charset=utf-8`, body = `HealthResponse` (§2.5), validated in tests with `HealthResponseSchema`.
- Sample: `{"status":"ok","service":"dems-mock-core","version":"0.1.0","apiVersion":"v1","serverTime":"2026-09-30T16:41:00.000Z","uptimeMs":12034,"ws":{"path":"/ws","heartbeatIntervalMs":1000,"clients":2}}`
- Any other path returns Fastify's default JSON 404.

### 3.3 WebSocket `GET /ws` (upgrade)

**Origin rule** (SPEC-C5), enforced in a route-level `preValidation` hook, which runs before the upgrade (V22):
- **Accept** when the `Origin` header is absent, or its value is in `WEB_DEV_ORIGINS` ∪ `SELF_ORIGINS` (§2.4).
- **Otherwise** reply `403` with `{"error":"origin_not_allowed"}` and log `ws origin rejected` with the origin.
- Why `SELF_ORIGINS` is included: React Native's Android WebSocket may send an Origin derived from the target URL (hypothesis). Allowing the service's own loopback origins covers that case without widening access.

**On connect:**
- Assign `clientId` (an incrementing integer).
- Log `{"msg":"ws client connected","clientId":n,"clients":k,"origin":"…"}`.
- **Immediately send one `Heartbeat`** carrying the current `seq`, so clients show LIVE within about 100 ms.

**Ticker:**
- Every 1,000 ms: `seq += 1`, then broadcast a `Heartbeat` to every open client.
- Messages are serialised with `JSON.stringify`, one JSON object per text frame.

**Inbound messages:** ignored in this phase. Each is logged at `debug` with its byte length.

**On disconnect:** log `{"msg":"ws client disconnected","clientId":n,"clients":k,"code":c}`.

### 3.4 CORS (SPEC-C1)

`@fastify/cors` options:
- `origin`: `WEB_DEV_ORIGINS` (exact strings)
- `methods`: `['GET', 'POST', 'OPTIONS']`
- `allowedHeaders`: `['Content-Type']`
- `credentials`: `false`
- `maxAge`: `600`

An allowed origin receives `access-control-allow-origin: <origin>`. Any other origin receives no ACAO header. POST is allowed now so the feature-phase endpoints need no CORS change.

### 3.5 Graceful shutdown

1. On `SIGINT` or `SIGTERM`, log `shutdown requested` with the signal, then call `app.close()`.
2. `onClose` clears the ticker.
3. A custom `preClose` (V22) sends `close(1001, 'server shutting down')` to every client, then closes the WS server.
4. Fastify closes the HTTP listener.
5. On completion, log `shutdown complete` and exit `0`.
6. If this has not finished after **5,000 ms**, log `shutdown timeout` and exit `1`.
7. A second signal during shutdown forces exit `1`.
8. `uncaughtException` and `unhandledRejection` are logged at `fatal` and exit `1`.

### 3.6 WS probe (`npm run probe:ws`)

- Usage: `tsx scripts/ws-probe.ts [--url ws://127.0.0.1:4400/ws] [--count 3] [--timeout 3500] [--origin <origin>]`
- It connects with the `ws` client and prints each heartbeat as one line: `seq=<n> serverTime=<iso> clients=<k>`.

| Exit code | Meaning |
|---|---|
| `0` | At least `count` schema-valid heartbeats arrived within `timeout`, with strictly increasing `seq` |
| `1` | Timeout, or an invalid message |
| `2` | The upgrade was rejected (HTTP 403) |

It is used by AC-38, AC-39 and rows 16, 19 and 22.

---

## 4. `apps/core-web`

### 4.1 Files

| File | Content |
|---|---|
| `index.html` | `<html lang="en" class="dark" data-theme="dark">`, `<title>DEMS Edge Client · Core Console</title>`, and `<meta name="color-scheme" content="dark">` |
| `vite.config.ts` | §4.2 |
| `.oxlintrc.json` | The template's `_oxlintrc.json`, renamed (V23) |
| `src/main.tsx` | Imports `@fontsource-variable/orbitron`, `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`, then `./index.css`. Creates a `QueryClient` and the router from `routeTree`. Renders `<QueryClientProvider><HeartbeatProvider><RouterProvider router={router} /></HeartbeatProvider></QueryClientProvider>` |
| `src/index.css` | §4.3 |
| `src/routes/__root.tsx` | `<MotionConfig reducedMotion="user">` wrapping `<Surface>` (full-viewport shell) with `<Outlet />` and `<ToastProvider />` at its default placement (V29; HeroUI needs no provider otherwise) |
| `src/routes/index.tsx` | `createFileRoute('/')({ component: () => <HomePage motionMode={useMotionMode()} /> })` |
| `src/features/home/home-page.tsx` | The placeholder (§4.4). Exports `HomePage` for tests |
| `src/features/home/motion-variants.ts` | Exports `enterVariants` (`hidden`, `visible`) and `enterTransition(mode)` (§4.4, §4.5). This is the only place enter-transition properties are defined, which makes AC-23 greppable |
| `src/features/home/use-motion-mode.ts` | Returns `'slow'` when `new URLSearchParams(location.search).get('motion') === 'slow'`, otherwise `'normal'` |
| `src/features/home/use-health.ts` | `useQuery({ queryKey: ['health'], queryFn: () => fetch(CORE_HTTP_ORIGIN + HEALTH_PATH).then(r => r.json()).then(HealthResponseSchema.parse), refetchInterval: 10000 })` |
| `src/components/ui/border-beam.tsx` | Magic UI `BorderBeam`, copied in verbatim (V26) |
| `src/components/ui/sliding-number.tsx` | Motion Primitives `SlidingNumber`, copied in verbatim (V27) |
| `src/lib/utils.ts` | `export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }` (the standard registry utility expected at `@/lib/utils`, V26) |
| `src/lib/tone-icons.ts` | Maps tone icon names (§2.8) to `lucide-react` components |
| `src/test/setup.ts` | Adds `@testing-library/jest-dom/vitest` matchers, and stubs `ResizeObserver` (needed by `react-use-measure`), `IntersectionObserver` and `window.matchMedia` for jsdom |
| `src/test/home-page.test.tsx` | Smoke test (§8) |
| `src/routeTree.gen.ts` | Generated by the router plugin; committed (§1.5) |

`THIRD_PARTY_NOTICES.md` (root) gets one row per copied item:

| Item | Collection | Licence | Source URL | Retrieved |
|---|---|---|---|---|
| BorderBeam | Magic UI | MIT | `https://magicui.design/r/border-beam.json` | 2026-09-30 |
| SlidingNumber | Motion Primitives | MIT | `https://motion-primitives.com/c/sliding-number.json` | 2026-09-30 |

**`shadcn init` is never run in core-web** (03 F4).

### 4.2 `vite.config.ts`

- `plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()]`. The router plugin comes **before** `react()` (02 L527).
- `resolve.alias: { '@': path.resolve(__dirname, 'src') }`
- `server: { host: '127.0.0.1', port: 5173, strictPort: true }`
- `preview: { host: '127.0.0.1', port: 4173, strictPort: true }`
- `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.tsx'] }`

### 4.3 CSS entry (`src/index.css`)

```css
@import "@heroui/styles";
@import "@dems/shared/theme/heroui-web.css";
```

- `@heroui/styles` already imports Tailwind v4 and tw-animate-css (V30), so `tailwindcss` is **not** imported a second time.
- Fonts come from the JS imports in `main.tsx`; the `--font-*` values come from the generated file (§2.9).

### 4.4 Placeholder route `/` (proves SC3)

**Layout:**
- A full-viewport `Surface` on `background`.
- A centred column, max width 960 px, with 48 px vertical padding.
- One hero `Card`, followed by a status row of three `Card`s.

| Region | Components (HeroUI v3 unless stated) | Content and binding |
|---|---|---|
| Hero | `Card` (`className="rounded-xl shadow-glow-2"`, §2.10) with `Card.Header`, `Card.Title`, `Card.Description`, `Card.Content`, `Card.Footer`, and inside it **Magic UI `BorderBeam`** (`size={220}`, `duration={8}`, `colorFrom="#FFC86B"` gold, `colorTo="#FF9F3D"` bronze) | Title "DEMS EDGE CLIENT" in `font-display text-display uppercase text-accent`, with a `Chip` "Secure" (success, `ShieldCheck` icon) beside it. Description "Stack check · placeholder". Content: one line of `muted` copy. Footer: a `Button` (`variant="primary"`, label "Show test toast") that calls `toast.success('Toasts ready', { description: 'HeroUI toast queue is wired.' })` (V29) |
| Heartbeat | `Card` containing a `Chip` (`color` = tone of `HeartbeatState`, §2.8), with a pulse dot and **Motion Primitives `SlidingNumber`** | The Chip label is the `HeartbeatState` label (`data-testid="heartbeat-chip"`). `SlidingNumber value={seq ?? 0}` in `font-display text-display tabular-nums` (the `readout` token, §2.7; `data-testid="heartbeat-seq"`). The pulse dot is a `motion.span` keyed by `seq`, animating `scale: [1, 1.8]` and `opacity: [0.6, 0]` over `beatOut` ms with `luxe` easing |
| Service | `Card` containing a `Skeleton` while loading, then text | `useHealth()` → "mock-core v{version} · api {apiVersion}" (`data-testid="health-version"`). On error: `Chip color="danger"` labelled "Core unreachable" |
| Clock | `Card` | `serverTime` from the last heartbeat, formatted `HH:mm:ss` in `font-display text-h1 text-accent tabular-nums` (the design's gold header clock), plus "clients: {clients}" in `font-mono text-data text-muted` |

**Enter transition (Motion):**
- A `motion.section` wraps the column. It uses `enterVariants` from `motion-variants.ts`: `hidden = { opacity: 0, y: 24, scale: 0.98 }` and `visible = { opacity: 1, y: 0, scale: 1 }`.
- `transition = { type: 'spring', ...spring.gentle, staggerChildren: 0.06, delayChildren: 0.08 }`. Each card is a `motion.div` child using the same variants.
- Only `opacity` and `transform` are animated, which keeps it compositor-friendly (NFR3). `filter`, `height` and `width` are never animated in the enter transition.

**Heartbeat binding:** `useHeartbeat()` (§2.6) with `onResync` → `invalidateQueries(['health'])`.

**Icons:** `lucide-react` `Activity` in the heartbeat card header, plus the tone icon inside the Chip.

### 4.5 Motion proof mode (web)

- `http://127.0.0.1:5173/?motion=slow` replaces the spring with `{ type: 'tween', duration: (640 × 10) / 1000 s, ease: easing.luxe }` and multiplies the stagger by 10.
- **Evidence:**
  - screenshot A at about 1.0 s after load: the cards are partially transparent and offset (mid-transition);
  - screenshot B at 8.0 s: the final state;
  - screenshot C in normal mode at 1.5 s: the final state.
- Row 17 captures them with the agent-browser skill, or the built-in browser pane as fallback (CLAUDE.md §10).

---

## 5. `apps/mobile`

### 5.1 `app.json` essentials

These are the keys that are set or changed. Every other template key (V34) stays.

```json
{
  "expo": {
    "name": "DEMS Tablet Demo",
    "slug": "dems-tablet-demo",
    "version": "0.1.0",
    "scheme": "demsdemo",
    "orientation": "default",
    "userInterfaceStyle": "dark",
    "backgroundColor": "#0B0D0F",
    "android": {
      "package": "com.dems.demo.tablet",
      "predictiveBackGestureEnabled": false,
      "adaptiveIcon": { "backgroundColor": "#0B0D0F" }
    },
    "plugins": [
      "expo-router",
      ["expo-splash-screen", { "backgroundColor": "#0B0D0F" }]
    ],
    "experiments": { "typedRoutes": true, "reactCompiler": true }
  }
}
```

- The template's own `expo-splash-screen` `image` and `imageWidth` stay; only `backgroundColor` changes.
- The template's `adaptiveIcon` image keys stay; only `backgroundColor` changes.
- **Rev 3 (D17):** `orientation` is `"default"` (unlocked). The app targets phone portrait and tablet multi-pane, so it must never lock orientation. The Android 16 opt-out plugin (§5.2) is removed.
- `name`, `slug` and `android.package` (`com.dems.demo.tablet`) are kept unchanged despite the word "tablet". They are identifiers the scaffold (D27) is already using; renaming them now would be churn with no benefit.

**Must be absent:** `owner`, `extra.eas`, `extra.eas.projectId`, `updates`, `runtimeVersion`, `eas.json` (D5, NFR1).

**Cleartext:**
- Nothing is added to `app.json`.
- Cleartext `ws://` and `http://` are allowed **only in debug variants**, by the prebuild template's `src/debug/AndroidManifest.xml` and `src/debugOptimized/AndroidManifest.xml` (`usesCleartextTraffic="true"`). The release variant sets the placeholder to `false` (02 L732-L736).
- The main manifest must not contain `usesCleartextTraffic="true"`.

**Telemetry:** every script that invokes the Expo CLI is prefixed with `EXPO_NO_TELEMETRY=1` (§1.5).

**React Compiler:** it stays enabled (the template default).
- **Fallback:** if row 18 sees a Reanimated or HeroUI runtime error that points at compiled memoisation, set `experiments.reactCompiler` to `false`. This is MINOR, logged in row 18.

### 5.2 Config plugin: removed (rev 3, D17)

- D17 supersedes the landscape lock (A3) and the Android 16 large-screen opt-out.
- `plugins/with-large-screen-orientation-optout.js` is **not** created, and `app.json` lists no local plugin.
- Android 16's large-screen behaviour (03 V14) now works in our favour: the tablet can rotate freely and the layout adapts (§5.5).
- R14 is closed: without a lock, there is nothing for Android to override.

### 5.3 Metro, Babel and CSS

**`metro.config.js`** (vendor pattern, V28):

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
```

- No manual `watchFolders`, `nodeModulesPaths` or `extraNodeModules` (03 SD-03, SD-04 RA-5).
- **No `babel.config.js`**. `babel-preset-expo` adds the worklets plugin automatically (02 L395-L398).

**`src/global.css`** (replaces the template file):

```css
@import 'tailwindcss';
@import 'uniwind';
@import 'heroui-native/styles';
@import '@dems/shared/theme/heroui-native.css';
@source '../../../node_modules/heroui-native/lib';
```

The `@source` path is the vendor's `./node_modules/heroui-native/lib` (V28), adjusted for the root-hoisted `node_modules` (`apps/mobile/src` → repository root).
- **Fallback, if HeroUI Native components render unstyled:** use `@source '../node_modules/heroui-native/lib';` in addition, which covers the case where npm nests the package under `apps/mobile/node_modules`.

### 5.4 Root layout (`src/app/_layout.tsx`)

1. At module scope: `import '../global.css'`, `SplashScreen.preventAutoHideAsync()`, and `Uniwind.setTheme('dark')` (V29).
2. Font loading:
   - Call `useFonts({ Orbitron_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, JetBrainsMono_400Regular, JetBrainsMono_500Medium })`, importing from `@expo-google-fonts/orbitron`, `@expo-google-fonts/inter` and `@expo-google-fonts/jetbrains-mono` (V37). The object keys become the family names used in §2.9 (V31; the vendor example uses the same mechanism, V28).
   - Render `null` until the fonts are loaded (or report an error), then call `SplashScreen.hideAsync()`.
3. Provider tree, outermost first:
   - `GestureHandlerRootView style={{ flex: 1 }}`
   - `QueryClientProvider`
   - `HeartbeatProvider`
   - `HeroUINativeProvider config={{ textProps: { maxFontSizeMultiplier: 1.2 } }}` (toasts enabled by default)
   - `Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#0B0D0F' } }}`
4. `StatusBar style="light"`.

### 5.5 Placeholder screen (`src/app/index.tsx` → `src/features/home/home-screen.tsx`; proves SC4)

**Layout (rev 3, D17: responsive and unlocked):**
- **Width ≥ 900 dp** (tablet, either orientation that fits): two panes, left `flex: 3`, right `flex: 2`.
- **Width < 900 dp** (phone portrait, and tablet portrait if narrower): a single column (hero, then heartbeat, then service).
- The breakpoint is read with `useWindowDimensions()`, so rotation re-lays out live.
- Gap 24, padding 32, background `background`.

| Region | Components (HeroUI Native unless stated) | Content and binding |
|---|---|---|
| Left: hero | `Card` (`className="rounded-xl"`, §2.10) with `Card.Header`, `Card.Title`, `Card.Description`, `Card.Body`, `Card.Footer` (V29) | Title "DEMS EDGE CLIENT" in `font-display text-display uppercase text-accent`, with a `Chip` "Secure" (success). Description "Stack check · placeholder". Body: one `muted` line. Footer: a `Button` labelled "Show test toast" that calls `toast.show({ label: 'Toasts ready', description: 'HeroUI Native toast is wired.' })`, where `toast` comes from `useToast()` (V29) |
| Right: heartbeat | `Surface` (`className="rounded-xl"`, §2.10) containing a `Chip` (`color` = tone), a Skia **`PulseRing`**, and `Text` for `seq` | Chip label is the HeartbeatState label (`testID="heartbeat-chip"`). `seq` in `font-display text-display text-accent` (the `readout` token, §2.7; `testID="heartbeat-seq"`) |
| Right: service | `Surface` containing a `Skeleton` while loading, then `Text` | "mock-core v{version}" (`testID="health-version"`), from TanStack Query `GET http://127.0.0.1:4400/api/v1/health` over `adb reverse` |

**Reanimated enter transition (UI thread, NFR3):**
- The left pane is an `Animated.View` with `entering={FadeInDown.springify().stiffness(170).damping(26).mass(1).reduceMotion(ReduceMotion.System)}`.
- The right pane uses `entering={FadeInUp.delay(80).springify().stiffness(170).damping(26).mass(1).reduceMotion(ReduceMotion.System)}`.
- `FadeInDown`, `FadeInUp` and `ReduceMotion` are confirmed exports (V33; Reanimated 4.5.1 typings).
- Layout animations run on the UI thread (02 L389-L394).

**Skia element (`src/features/home/pulse-ring.tsx`):**
- A `Canvas` of 120×120 containing a `Group` with:
  - a `Circle` at centre (60, 60) whose radius `r` is a `useDerivedValue(() => 14 + pulse.value * 34)`, filled with a `RadialGradient` from gold `#FFC86B` to `#FFC86B00`, with `BlurMask blur={6} style="normal"`;
  - a solid 8-pt `Circle` core in success `#22C55E` when LIVE (otherwise the tone's base hex from §2.7).
- `pulse` is a `useSharedValue(0)`. On every `seq` change, set `pulse.value = withSequence(withTiming(1, { duration: 180, easing: Easing.bezier(...luxe) }), withTiming(0, { duration: 720, easing: Easing.bezier(...standard) }))`.
- The `useDerivedValue` callback is a **worklet**, so the ring animates entirely on the UI thread. Skia accepts Reanimated shared and derived values as props (02 L408).
- `Canvas`, `Circle`, `RadialGradient`, `BlurMask`, `Group` and `vec` are confirmed exports (V33).

**Also:**
- `useKeepAwake()` (`expo-keep-awake`, S28).
- `Haptics.selectionAsync()` on the toast button (`expo-haptics`).
- Icons: `lucide-react-native` `Activity` plus the tone icon.

### 5.6 Motion proof mode (mobile)

- `adb shell am start -W -a android.intent.action.VIEW -d "demsdemo://?motion=slow" com.dems.demo.tablet` opens the screen with `motionMode="slow"`: the builders switch to `FadeInDown.duration(6400).easing(Easing.bezier(...luxe))`, and `FadeInUp` does the same with `delay(800)`.
- The route reads the mode with `useLocalSearchParams()` and passes it to `HomeScreen` as a prop.
- **Evidence:** `adb exec-out screencap -p` at about 1.0 s (mid-transition) and at 8.0 s (final), plus a normal launch at 2.0 s.
- Whether `demsdemo://?motion=slow` routes to `/` is a hypothesis. **Fallback:** `demsdemo:///?motion=slow`.

### 5.7 Android build facts

These come from the SDK 57 and RN 0.86.3 catalogs (03 V12; 02 L211): compileSdk 36, targetSdk 36, minSdk 24, build-tools 36.0.0, NDK 27.1.12297006, AGP 8.12.0, Kotlin 2.1.20, Gradle wrapper 9.3.1 (02 L191).

- The New Architecture and Hermes are always on (02 L225).
- No release signing in this phase: only the debug APK is built.

---

## 6. Device networking, AVD and ports

### 6.1 Ports

| Port | Service | Bind address | Set by |
|---|---|---|---|
| 4400 | mock-core HTTP and WS | `127.0.0.1` | `app.listen({ host, port })` (§3.1) |
| 5173 | Vite dev server | `127.0.0.1`, `strictPort` | `vite.config.ts` (§4.2) |
| 4173 | Vite preview (optional; not used by the acceptance criteria) | `127.0.0.1`, `strictPort` | `vite.config.ts` |
| 8081 | Metro | Expo CLI with `--localhost --port 8081`; the actual bind address is checked in AC-45 (03 R20) | mobile `dev` script |
| 5037 | adb server | adb default (loopback, hypothesis) | platform-tools |
| 5554 / 5555 | emulator console / adb | emulator default (loopback, hypothesis) | emulator |

Before starting a service, the executor runs `lsof -nP -iTCP:<port> -sTCP:LISTEN`. A non-empty result means stop and report; the executor does not kill foreign processes (E5).

### 6.2 Emulator networking

- After every emulator boot and before app launch, run `npm run mobile:reverse`, which executes `adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081`.
- `expo run:android` also reverses 8081 itself (02 L721). The explicit 8081 entry makes `expo start` after a reboot deterministic.
- The app uses `http://127.0.0.1:4400` and `ws://127.0.0.1:4400/ws` (§2.4).
- **Fallback (documented, not configured):** the emulator alias `10.0.2.2` (02 L711-L718).

### 6.3 AVD profiles (rev 3: two AVDs per D17; names per D23; values as built in row 10)

Both AVDs were created and cold-booted in row 10 (`initialization/05_avds.md`) on `system-images;android-36;google_apis;arm64-v8a`.

| Key | `dems_tablet` | `dems_phone` | Why |
|---|---|---|---|
| Device profile | `pixel_tablet` (10.95 in, 2560×1600, xhdpi) | `pixel_10` (6.3 in, 1080×2424, 420 dpi) | D17: responsive target. `pixel_10` is the base model of the newest Pixel generation in cmdline-tools 23.0 (05_avds §1) |
| `hw.ramSize` | `4096` | `3072` | Host has 24 GB (V35) |
| `hw.cpu.ncore` | `4` | `4` | 4 of 10 host cores (V35) |
| `disk.dataPartition.size` | `8G` | `8G` | App and media |
| `hw.gpu.enabled` / `hw.gpu.mode` | `yes` / `host` | `yes` / `host` | gfxstream on Metal (05_avds) |
| `hw.initialOrientation` | `landscape` | `portrait` | The **starting pose only**; it does not lock rotation (D17) |
| `hw.keyboard` | `yes` | `yes` | Host keyboard for forms |
| `hw.audioInput`, `hw.camera.back`, `hw.camera.front` | `no`, `none`, `none` | same | SPEC-C10. Both booted unattended with no privacy prompt (H-S9 confirmed, 05_avds) |

**Create** (as run in row 10):

```
echo no | avdmanager create avd -n dems_tablet -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_tablet
echo no | avdmanager create avd -n dems_phone  -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_10
```

**Launch (D24: always outside the agent sandbox):**
- Tablet: `npm run emulator`, which runs `emulator -avd dems_tablet -no-metrics -gpu host -no-boot-anim`.
- Phone: `npm run emulator:phone`.
- Cold-boot proof: add `-no-snapshot-load`.
- **One AVD at a time** by default (console 5554, adb 5555). For both at once, the second instance gets 5556/5557 automatically and `adb -s <serial>` selects the device.

**Expected values (measured in row 10):**

| Check | `dems_tablet` | `dems_phone` |
|---|---|---|
| Cold boot to `sys.boot_completed=1` | 25 s | 22 s |
| `adb shell wm size` | `Physical size: 2560x1600` | `Physical size: 1080x2424` |
| `adb shell wm density` | `Physical density: 320` | `Physical density: 420` |
| `adb shell getprop ro.build.version.sdk` | `36` | `36` |
| `adb shell getprop ro.product.cpu.abi` | `arm64-v8a` | `arm64-v8a` |

**Listeners:** every emulator and adb listener is on loopback only: console 5554, adb 5555, gRPC 8554, adb server 5037 (05_avds "Listener exposure"). This resolves the §6.1 hypothesis.

### 6.4 Host toolchain (from 03 SD-45..SD-51, D11-D13)

| Item | Pin | Location | Channel |
|---|---|---|---|
| JDK | `openjdk@17` 17.0.20.1 (Homebrew formula; no sudo) | `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` (`JAVA_HOME`) | `HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install openjdk@17` |
| Android command-line tools | `cmdline-tools` rev 23.0, from `commandlinetools-mac_arm64-16111833_latest.zip` (148 MiB, SHA-1 `ad03dc49bfacfd52c110b14104ea548b8a07e830`, 02 L669) | `~/Library/Android/sdk/cmdline-tools/latest/` (`ANDROID_HOME=$HOME/Library/Android/sdk`) | Official Google zip; checksum verified before unzip |
| sdkmanager packages | `platform-tools` 37.0.1; `emulator` 37.1.11; `platforms;android-36` r2; `build-tools;36.0.0`; `ndk;27.1.12297006`; `cmake;3.22.1`; `system-images;android-36;google_apis;arm64-v8a` r7 | under `ANDROID_HOME` | Stable (channel 0); licences pre-accepted with `yes \| sdkmanager --licenses` |
| Shell profile | Two marked blocks appended to `~/.zprofile` after the backup `~/.zprofile.bak.dems-2026-09-30`; `~/.zshrc` is not created | `~/.zprofile` (D11) | Exact lines are in 03, Host Impact Register |
| Not installed | watchman, pnpm, fnm or any Node version manager, Android Studio, any cask or `.pkg` | none | D12, 03 SD-51 |

---

## 7. Telemetry opt-outs

| Tool | Opt-out in this stack | Where it is set | Evidence |
|---|---|---|---|
| Expo CLI | `EXPO_NO_TELEMETRY=1` | Every Expo-invoking script (§1.5), and the run guide | 02 L760 |
| Homebrew | `HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_AUTO_UPDATE=1` | Prefix on each `brew` command in row 5 (no persistent change) | 02 L779 |
| Android Emulator | `-no-metrics` | Root `emulator` script; row 10 launch | 02 L780 (secondary) |
| Android SDK tools | Decline any metrics prompt, and never pass an opt-in | Rows 9 and 10 | 02 L780 (the analytics library is present; its opt-in state is unknown: 03 G-3) |
| Vite, create-vite, oxlint, tsx, Fastify, npm | None found; nothing to set | none | 02 L775, L781 |
| shadcn CLI | Not used in this spec (copy-in by URL fetch, §4.1) | none | 02 L769 |
| Next.js, Turborepo | Not used | none | 02 L777-L778 |
| Android CLI (the cmdline-tools 23.0 `sdkmanager` shim) | `--no-metrics` on every `sdkmanager` / `android` call (D23) | Rows 9, 13, 22 | V45 |
| Scalar API Reference | `telemetry: false`, `withDefaultFonts: false`, `agent.disabled`, `mcp.disabled`, `showDeveloperTools: 'never'`, no `proxyUrl`; the PostHog plugin is never imported | §14.9 config | V41 |
| swagger-ui-react (Scarf install analytics) | Not used (rejected) | none | V41 |

---

## 8. Test runners and minimal smoke tests

| Package | Runner | Config | Smoke tests (minimum) |
|---|---|---|---|
| shared | Vitest 5.0.3 (node) | `vitest.config.ts`: `{ test: { environment: 'node', include: ['test/**/*.test.ts'] } }` | **S-1** `theme.test.ts`: `generateTheme()` output for web and native contains each of the §2.7 palette variables and `--radius`. The web file contains `.dark, [data-theme="dark"]`, and the native file contains `@variant dark` and `@variant light`. The committed files equal the generator output. **S-2** `schemas.test.ts`: a sample `Heartbeat` and a sample `HealthResponse` both parse, and messages with `type: 'nope'` or `seq: -1` are rejected |
| mock-core | Vitest 5.0.3 (node) | `vitest.config.ts` (node, `test/**/*.test.ts`) | **M-1** `health.test.ts`: `buildApp().inject({ method: 'GET', url: '/api/v1/health', headers: { origin: 'http://127.0.0.1:5173' } })` returns 200, `HealthResponseSchema` passes, `version` equals `package.json`, and `access-control-allow-origin` is `http://127.0.0.1:5173`. With `origin: 'http://evil.example'`, there is no ACAO header. **M-2** `heartbeat.test.ts`: `listen({ host: '127.0.0.1', port: 0 })`, the `server.address().address === '127.0.0.1'`, a `ws` client receives at least 3 schema-valid heartbeats within 3,500 ms with strictly increasing `seq`, and `app.close()` delivers close code `1001` to the client. **M-3** `ws-origin.test.ts`: a `ws` client with header `Origin: http://evil.example` gets `unexpected-response` with status 403 |
| core-web | Vitest 5.0.3 (jsdom 30.1.1) with Testing Library | `vite.config.ts` `test` block (§4.2) | **W-1** `home-page.test.tsx`: render `HomePage motionMode="normal"` inside `QueryClientProvider` and a `HeartbeatProvider` with a fake `socketFactory`, with `fetch` stubbed to return a valid `HealthResponse`. Assert the title "DEMS EDGE CLIENT" is visible and `heartbeat-chip` shows "Connecting". Then emit one fake heartbeat with `seq: 7` and assert the chip shows "Live" and `health-version` contains "v0.1.0" |
| mobile | jest-expo ~57.0.5 on jest 29.7.0 with RNTL 13.3.3 | `package.json` `"jest"` (below) | **N-1** `src/features/home/home-screen.test.tsx`: render `HomeScreen motionMode="normal"` inside `HeroUINativeProvider`, `QueryClientProvider` and a fake-socket `HeartbeatProvider`, with `fetch` stubbed. Assert the title "DEMS EDGE CLIENT" and `heartbeat-chip` shows "Connecting". Emit a fake heartbeat and assert "Live". `PulseRing` is mocked with `jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }))`, because Skia is proven on device in AC-31, not in jest |

**Mobile jest configuration** (in `apps/mobile/package.json`):

```json
{
  "preset": "jest-expo",
  "setupFilesAfterEnv": ["./jest.setup.ts"],
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|heroui-native|uniwind|@shopify/.*|@gorhom/.*|lucide-react-native|victory-native|@dems/.*)"
  ]
}
```

- `jest.setup.ts` contains `require('react-native-reanimated').setUpTests();` (V33).
- Test files import `describe`, `it` and `expect` from `@jest/globals` (a jest-expo dependency, 03 V2), so no `@types/jest` is needed.

**Mobile fallback (deterministic):**
- If `heroui-native` or `uniwind` cannot render under jest-expo, N-1 adds `jest.mock('heroui-native', ...)`. That mock maps `Card`, `Card.*`, `Chip`, `Surface`, `Button`, `Skeleton` and `Text` to React Native `View` and `Text` passthroughs, and makes `HeroUINativeProvider` a fragment.
- The reason is recorded in `test/01_test_report.md`. The test still asserts the same labels.

**Network rule for all tests:**
- Only the in-process `inject()` and listeners on `127.0.0.1:0` are used.
- `http://evil.example` appears only as a header value; nothing connects to it.

**Root command:** `npm test` runs every workspace's `test` script, for a total of **at least 7 tests** (S-1, S-2, M-1..M-3, W-1, N-1).

---

## 9. Acceptance criteria

- **Runtime ACs:** anything that needs a running mock, web server or emulator states the precondition in the "Check" column.
- **Shell:** `zsh -l -c` means a fresh login shell, which reads `~/.zprofile` (D11).
- **Working directory:** every relative path is from `/Users/gsp-budi/Documents/DEMS`.

| AC | Check (command-level) | Pass condition | SC |
|---|---|---|---|
| AC-01 | `zsh -l -c 'java -version 2>&1 \| head -1; echo $JAVA_HOME'` | Version line contains `17.0.20.1`. `JAVA_HOME` = `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`, and `test -x "$JAVA_HOME/bin/java"` exits 0 | SC1 |
| AC-02 | `zsh -l -c 'java -XshowSettings:properties -version 2>&1 \| grep "os.arch"'` | `os.arch = aarch64` | SC1 |
| AC-03 | `zsh -l -c 'echo $ANDROID_HOME; which sdkmanager; grep Pkg.Revision "$ANDROID_HOME/cmdline-tools/latest/source.properties"'` | `/Users/gsp-budi/Library/Android/sdk`; `sdkmanager` resolves under `$ANDROID_HOME/cmdline-tools/latest/bin`; `Pkg.Revision=23.0` (cmdline-tools rev 23.0, 02 L669) | SC1 |
| AC-04 | `zsh -l -c 'sdkmanager --list_installed --no-metrics'` | Lists, in the Android CLI's slash form (D23: cmdline-tools 23.0 `sdkmanager` is a shim that prints IDs with `/`): `platform-tools`, `emulator`, `platforms/android-36`, `build-tools/36.0.0`, `ndk/27.1.12297006`, `cmake/3.22.1`, `system-images/android-36/google_apis/arm64-v8a` | SC1 |
| AC-05 | `zsh -l -c 'adb version; emulator -version \| head -1'` | adb shows `Version 37.0.1`; emulator shows `37.1.11` | SC1 |
| AC-06 | `zsh -l -c 'avdmanager list avd'`; then for each of `dems_tablet` and `dems_phone`: `grep -E '^(hw.ramSize\|hw.cpu.ncore\|hw.initialOrientation\|hw.audioInput\|hw.device.name)=' ~/.android/avd/<name>.avd/config.ini` | Both AVDs listed. Tablet: `4096`, `4`, `landscape`, `no`, `pixel_tablet`. Phone: `3072`, `4`, `portrait`, `no`, `pixel_10` | SC1 |
| AC-07 | Outside the sandbox (D24), one AVD at a time: `emulator -avd <name> -no-metrics -gpu host -no-snapshot-load &`; `adb wait-for-device`; poll `adb shell getprop sys.boot_completed` | Prints `1` within 180 s for both `dems_tablet` and `dems_phone`; `adb devices` lists `emulator-5554	device`; boot seconds recorded (row 10 measured 25 s and 22 s) | SC1 |
| AC-08 | `adb shell wm size; adb shell getprop ro.build.version.sdk; adb shell getprop ro.product.cpu.abi` on each AVD | Tablet `Physical size: 2560x1600`, phone `Physical size: 1080x2424`; both `36` and `arm64-v8a` | SC1 |
| AC-09 | `zsh -l -c 'node -v; npm -v; which -a node'` | `v26.8.2`; `11.19.1`; first entry `/usr/local/bin/node` | SC1 |
| AC-10 | `test ! -e ~/.zshrc; brew list --formula \| grep -cxE 'watchman\|pnpm\|fnm'` | `~/.zshrc` absent; count `0` | SC1, SC7 |
| AC-11 | `diff ~/.zprofile.bak.dems-2026-09-30 ~/.zprofile` | Only additions: the 8 non-blank lines of the two marked blocks (03 HI-3), plus optional blank separator lines; no removed or changed lines | SC1, SC7 |
| AC-12 | `npm ls --workspaces --depth=0` | Every package and version in §1.4 is present. Exact pins match; `~` pins resolve inside their range | SC2 |
| AC-13 | `npm ls react react-dom --all \| grep -oE 'react(-dom)?@[0-9.]+' \| sort -u`; `test ! -d apps/mobile/node_modules/react && test ! -d apps/core-web/node_modules/react` | Only `react-dom@19.2.3` and `react@19.2.3`; both `test` commands exit 0 | SC2 |
| AC-14 | `npm ls react-native --all \| grep -oE 'react-native@[0-9.]+' \| sort -u`; `npm ls typescript --all \| grep -oE 'typescript@[0-9.]+' \| sort -u` | Only `react-native@0.86.3`; only `typescript@6.0.3` | SC2 |
| AC-15 | `grep -l '"workspace:' package.json apps/*/package.json packages/*/package.json` | No output (exit 1) | SC2 |
| AC-16 | `cd apps/mobile && npm run deps:check && npm run doctor` | Both exit 0; doctor reports no failed checks | SC2, SC4 |
| AC-17 | `grep -cE 'BorderBeam\|SlidingNumber' THIRD_PARTY_NOTICES.md`; `grep -rn "shadcn" apps/core-web/package.json apps/core-web/components.json 2>/dev/null` | At least `2`; the second command finds nothing | SC2 |
| AC-18 | `npm run build -w @dems/shared && git diff --exit-code packages/shared/theme/` | Exit 0: committed themes equal the generator output | SC2, SC7 |
| AC-19 | `npm run build -w @dems/core-web`; `test -f apps/core-web/dist/index.html`; `grep -lE "Orbitron Variable" apps/core-web/dist/assets/*.css && grep -lE "Inter Variable" apps/core-web/dist/assets/*.css && grep -lE "JetBrains Mono Variable" apps/core-web/dist/assets/*.css`; `grep -ciE '#FFC86B' apps/core-web/dist/assets/*.css` | Build exits 0; the file exists; all three font families are present; the gold token is present (count at least 1) | SC3 |
| AC-20 | `npm run typecheck -w @dems/core-web && npm run lint -w @dems/core-web` | Both exit 0 | SC3 |
| AC-21 | Dev server running (`npm run dev:web`): `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/`; `lsof -nP -iTCP:5173 -sTCP:LISTEN` | `200`; listener is `127.0.0.1:5173` only | SC3 |
| AC-22 | `grep -cE 'class="dark"\|data-theme="dark"' apps/core-web/index.html`; `grep -nE "from ['\"]@heroui/react['\"]" apps/core-web/src/features/home/home-page.tsx` | At least 1; the import includes `Card`, `Chip`, `Button`, `Surface`, `Skeleton` and `toast` | SC3 |
| AC-23 | `grep -nE "from ['\"]motion/react['\"]" apps/core-web/src/features/home/home-page.tsx`; `grep -nE "filter\|height\|width" apps/core-web/src/features/home/motion-variants.ts` | The Motion import is present; the second grep finds nothing (enter variants animate only opacity and transform) | SC3 |
| AC-24 | Browser screenshots per §4.5 (A at about 1.0 s in `?motion=slow`, B at 8.0 s, C normal at 1.5 s) linked in `implementation/04_core_web_app.md` | A visibly differs from B (cards translucent or offset); B and C show the final layout with `BorderBeam` and the heartbeat Chip | SC3 |
| AC-25 | `cd apps/mobile && npm run prebuild`; `grep -c 'PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY' android/app/src/main/AndroidManifest.xml`; `grep -cE 'android:screenOrientation="(landscape\|portrait\|sensorLandscape\|sensorPortrait)"' android/app/src/main/AndroidManifest.xml` | Prebuild exits 0; both counts `0` (no lock and no opt-out, D17) | SC4 |
| AC-26 | `grep -c 'usesCleartextTraffic="true"' apps/mobile/android/app/src/debug/AndroidManifest.xml apps/mobile/android/app/src/main/AndroidManifest.xml` | Debug at least `1`; main `0` | SC4, SC5 |
| AC-27 | `test ! -e apps/mobile/eas.json; grep -cE '"(expo-updates\|expo-dev-client\|eas-cli)"' apps/mobile/package.json; grep -cE 'projectId\|"owner"\|"updates"\|runtimeVersion' apps/mobile/app.json` | Exit 0; `0`; `0` | SC4 |
| AC-28 | `npm run build -w @dems/mobile` | Exit 0; `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` exists; duration recorded | SC4 |
| AC-29 | Per AVD (tablet, then phone), with the emulator booted outside the sandbox (D24) and `npm run mobile:reverse` done: `npm run android`, then `adb shell pidof com.dems.demo.tablet` | Exit 0; non-empty PID on both AVDs | SC4 |
| AC-30 | Per AVD: `adb exec-out screencap -p > $TMPDIR/<avd>.png && sips -g pixelWidth -g pixelHeight $TMPDIR/<avd>.png`; then on the tablet `adb emu rotate` and repeat | Tablet `2560`×`1600` (two-pane layout); phone `1080`×`2424` (single column). After rotation the tablet frame is `1600`×`2560` and the layout re-flows, which proves orientation is unlocked (D17) | SC4 |
| AC-31 | §5.6 screenshots (1.0 s and 8.0 s in slow mode, 2.0 s normal) linked in `implementation/05_mobile_app.md`; `grep -nE 'entering=\{FadeIn(Down\|Up)' apps/mobile/src/features/home/home-screen.tsx`; `grep -nE 'useDerivedValue\|withSequence\|<Canvas' apps/mobile/src/features/home/pulse-ring.tsx` | The 1.0 s frame is mid-transition and the 8.0 s frame is final; the enter builders are present; the Skia worklet code is present | SC4 |
| AC-32 | `npm run typecheck -w @dems/mobile && npm run lint -w @dems/mobile` | Both exit 0 | SC4 |
| AC-33 | `grep -cE 'Orbitron_700Bold\|Inter_600SemiBold\|JetBrainsMono_400Regular' apps/mobile/src/app/_layout.tsx`; the AC-30 screenshot | At least `3`; the screenshot shows rendered text (the app is past the splash) | SC4 |
| AC-34 | `grep -o 'EXPO_NO_TELEMETRY=1' apps/mobile/package.json \| wc -l` | At least `6` (dev, build, android, prebuild, doctor, deps:check) | SC4 |
| AC-35 | mock running (`npm run dev:mock`): `lsof -nP -iTCP:4400 -sTCP:LISTEN` | Exactly one listener, `127.0.0.1:4400`; no `*:4400` and no `[::]:4400` | SC5 |
| AC-36 | `curl -s -i http://127.0.0.1:4400/api/v1/health` | `HTTP/1.1 200`; `content-type: application/json`; body has `status:"ok"`, `apiVersion:"v1"`, `ws.path:"/ws"`, `ws.heartbeatIntervalMs:1000` | SC5 |
| AC-37 | `curl -s -D - -o /dev/null -H 'Origin: http://127.0.0.1:5173' http://127.0.0.1:4400/api/v1/health`; the same with `-H 'Origin: http://evil.example'` | The first has `access-control-allow-origin: http://127.0.0.1:5173`; the second has no `access-control-allow-origin` header | SC5 |
| AC-38 | `npm run probe:ws` | Exit 0; at least 3 lines `seq=` with strictly increasing values within 3.5 s | SC5 |
| AC-39 | `npm run probe:ws -- --origin http://evil.example` | Exit `2`; output contains `403` | SC5 |
| AC-40 | `adb reverse --list` | Contains `tcp:4400 tcp:4400` and `tcp:8081 tcp:8081` | SC5 |
| AC-41 | mock, web (browser open at `http://127.0.0.1:5173/`) and mobile all running: the mock-core log, then screenshots of both clients at t and t+5 s | The log has a `ws client connected` line with `"clients":2`. In both clients, `heartbeat-seq` advances by at least 4 between the frames, and `heartbeat-chip` reads "Live". `health-version` shows `v0.1.0` in both | SC5 |
| AC-42 | `kill -TERM <mock PID>`, then `lsof -nP -iTCP:4400 -sTCP:LISTEN` | Process exits `0` within 5 s; log has `shutdown complete`; no listener remains; both clients show "Offline", then "Connecting" (reconnect loop) | SC5 |
| AC-43 | `npm test` (root) | Exit 0; at least 7 passing tests across 4 workspaces; runner output quoted in `test/01_test_report.md` | SC7 |
| AC-44 | `grep -cE '^## (Prerequisites\|Install\|Start\|Emulator networking\|Tests\|Stop\|Troubleshooting\|Rollback)' README.md` | `8`; every command in the README has passing output in an initialization, implementation or test log | SC6 |
| AC-45 | Metro running (`npm run dev:mobile`): `lsof -nP -iTCP:8081 -sTCP:LISTEN` | Records the bind address. `127.0.0.1` is PASS. `*` (all interfaces) is CAUTION, forwarded to row 23 (03 R20) | SC5, SC7 |
| AC-46 | `git check-ignore -q "DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx" && git check-ignore -q apps/mobile/android && git check-ignore -q .cache` | Exit 0 | SC7 |
| AC-47 | From a fresh `zsh -l`, follow `README.md` literally (row 22); then `npm run typecheck && npm run lint && npm test` at the root | Every AC above PASS or CAUTION-with-acknowledgement; the root commands exit 0; no extra install step was needed | SC7 |

### Success-criteria coverage

| SC (01_translated L149-L157) | Covered by |
|---|---|
| SC1 Tools installed, versions recorded, `adb devices` lists the tablet | AC-01..AC-11 |
| SC2 Frameworks recorded with versions and reasons | AC-12..AC-18, plus 03 SD table and §1.4 |
| SC3 Web dev server and animated placeholder | AC-19..AC-24 |
| SC4 Mobile build, install, launch, animated placeholder | AC-16, AC-25..AC-34 |
| SC5 Mock health and WS heartbeat reach both apps, including the emulator | AC-26, AC-35..AC-42, AC-45 |
| SC6 Run guide with exact commands | AC-44 |
| SC7 Feature phase can begin with no environment work | AC-10, AC-11, AC-18, AC-43, AC-45..AC-47 |
| **Web build scope (D18, D25, D26), rev 3** | **AC-48..AC-75** (§14.14) |

---

## 10. Risks, assumptions and hypotheses introduced by this spec

| # | Item | Type | Deterministic fallback | Checked in |
|---|---|---|---|---|
| H-S1 | `erasableSyntaxOnly` exists in TS 6.0.3 | hypothesis | Remove the flag; enforce the rule by review | Row 15 |
| H-S2 | Tailwind v4 `@import` resolves `@dems/shared/theme/*.css` via `exports` | hypothesis | Relative-path imports (§2.9) | Rows 17, 18 |
| H-S3 | HeroUI Native classes compile through `@source '../../../node_modules/heroui-native/lib'` | hypothesis (vendor pattern adjusted for hoisting) | Add `@source '../node_modules/heroui-native/lib'` | Row 18 |
| H-S4 | The RN Android WebSocket sends an Origin derived from the target URL | hypothesis | Allowed by `SELF_ORIGINS` either way | Row 19 |
| H-S5 | zod 4 API names (`z.iso.datetime`, `z.int`) | hypothesis | `z.string().datetime()`, `z.number().int().min(0)` | Row 15 |
| H-S6 | Lucide icon names | hypothesis | Legacy names (§2.8) | Rows 17, 18 |
| H-S7 | `demsdemo://?motion=slow` routes to `/` | hypothesis | `demsdemo:///?motion=slow` | Row 18 |
| H-S8 | HeroUI Native renders under jest-expo | hypothesis | Passthrough mock (§8) | Row 20 |
| H-S9 | Disabling mic and cameras avoids macOS privacy prompts | **confirmed** (both AVDs booted unattended, V45) | If a prompt still appears, the row returns `needs-review` with one instruction for the user | Row 10 |
| H-S10 | React Compiler is compatible with the kit and Reanimated | hypothesis | `reactCompiler: false` | Row 18 |
| H-S11 | npm runs `--workspaces` scripts in declared order | hypothesis | Scripts are order-independent (committed theme CSS) | Row 14 |
| H-S17 | Scalar sends try-it requests through the configured `customFetch` (its schema says it is used "when sending requests from the API client") | hypothesis, well evidenced | If not: set `hideTestRequestButton: true` for simulated operations by filtering, and use the page's own "Simulated try" panel (kit `Card` + `Button`) | Page row (API) |
| H-S18 | The procedural CameraFeed canvas (2-4 instances at 25 fps) stays inside the motion spec's 60 fps budget | hypothesis | Lower the feed repaint to 12.5 fps and pause off-screen feeds (IntersectionObserver) | Page rows (Dashboard, SM) |
| H-S19 | A licensed empty-room still of at least 2560 px with no people or insignia is available on Pexels or Unsplash | hypothesis | The procedural SVG room abstraction (§14.10), recorded in `THIRD_PARTY_NOTICES.md` | Asset row |
| H-S12 | Without `expo-dev-client`, `expo start` (the mobile `dev` script) serves the bundle to the already-installed debug APK, and `expo run:android` builds and launches it (03 G-4) | hypothesis | Use `npm run android` for every launch. If that also fails to load the bundle, add `expo-dev-client ~57.0.19` via rule R-1 (MINOR) and update AC-27 accordingly | Row 18 |
| H-S13 | React Native `boxShadow` (New Architecture) renders spread and blur on Android, so the native `--surface-shadow` glow appears | hypothesis | `className="border border-[#FF9F3D59]"` on Card and Surface (hairline without the glow) | Row 18 |
| H-S14 | Uniwind honours Tailwind v4 `--text-*--line-height` and `--letter-spacing` sub-properties for `text-display` and similar | hypothesis | Arbitrary utilities, e.g. `text-[32px] leading-[40px] tracking-[0.01em]` | Row 18 |
| H-S15 | A later `@theme` declaration of `--color-*-soft*` overrides HeroUI Native's `color-mix` definitions | hypothesis | `className` text and fill utilities (`text-[#F87171] bg-[#EF444426]`) on the Chip | Row 18 |
| H-S16 | HeroUI Native's Button background slot (`ButtonBackgroundProps`) accepts an `expo-linear-gradient` child for gradient CTAs | hypothesis | The flat gold fill (`--accent`) | Feature phase |
| A-S1 | English UI copy in the placeholders | assumption | A10 is decided in the feature phase; strings are few and local | n/a |

Risks carried from 03 (R13 sandbox scope, R14 orientation, R16 kit maturity, R20 Metro binding) are unchanged. Each has a matching AC: R13 affects rows 8-10 and 18; R14 is AC-25 and AC-30; R16 falls to row 24's review; R20 is AC-45.

---

## 11. Traceability to `research/03_analysis.md` (every chosen library appears)

| 03 decision | Appears in this spec |
|---|---|
| SD-01 Node 26.8.2 | §1.2 engines, §1.7 `.node-version`, AC-09 |
| SD-02, SD-03 npm workspaces, layout | §1.1-§1.4, AC-15 |
| SD-04 React 19.2.3 rule | §1.2 overrides, §1.4, AC-13 (refined by SPEC-C2, SPEC-C6) |
| SD-05 TypeScript 6.0.3 | §1.4, §1.6, AC-14 |
| SD-06, SD-07 Expo SDK 57, local debug build | §1.4, §1.5, §5, AC-16, AC-25..AC-29 |
| SD-08 Expo Router and react-native-screens | §1.4, §5.4 |
| SD-09, SD-10 HeroUI Native, Uniwind, Tailwind 4 | §1.4, §5.3-§5.5 |
| SD-11, SD-12 Reanimated, worklets, RNGH | §1.4, §5.5 |
| SD-13, SD-14 Skia, victory-native (Lottie deferred) | §1.4, §5.5 |
| SD-15, SD-16 expo-video, blur, linear-gradient, haptics | §1.4, §5.5 (haptics used; the others are installed for the feature phase, SC7) |
| SD-17, SD-18 bottom sheet, kit toasts | §1.4, §4.4, §5.5 |
| SD-19, SD-34 Lucide (both) | §1.4, §2.8, §4.4, §5.5 |
| SD-20, SD-35 Geist fonts | **Superseded by D16:** Orbitron, Inter and JetBrains Mono (§1.4, §2.7, §4.1, §5.4) |
| D16 design tokens (palette, typography, spacing, radius, stroke, elevation, badges) | §2.7-§2.10, §4.4, §5.5, AC-19 |
| D17-D28 (rev 3) | §5.1, §5.2, §5.5, §6.3, §7, §13, §14; AC-06/07/08/25/29/30, AC-48..AC-75 |
| SD-21, SD-22 keep-awake, orientation | §5.1, §5.2, §5.5, AC-25, AC-30 |
| SD-23, SD-30 TanStack Query, WS client | §2.6, §4.1, §5.5 |
| SD-24..SD-26 Vite, HeroUI v3, Motion | §1.4, §4.2-§4.4 |
| SD-27 Magic UI and Motion Primitives (copy-in, no `shadcn init`) | §4.1, §4.4, AC-17 |
| SD-28 no admin template | §4.4 (composition only) |
| SD-29 TanStack Router | §1.4, §4.1, §4.2 |
| SD-31, SD-32 TanStack Table v8, Recharts | §1.4 (installed for the feature phase, SC7) |
| SD-36 RHF, zod, resolvers | §1.4, §2.5 |
| SD-37, SD-38 shared contents, token pipeline | §2 |
| SD-39..SD-41 Fastify, WS, tsx, 127.0.0.1:4400 | §3, AC-35..AC-42 |
| SD-42 Vite proxy | **Superseded by SPEC-C1 (CORS)** |
| SD-43, SD-44 adb reverse, debug cleartext | §6.2, §5.1, AC-26, AC-40 |
| SD-45..SD-51 JDK, SDK, packages, image, AVD, no watchman | §6.3, §6.4, AC-01..AC-08, AC-10 |
| SD-52, SD-53 test runners | §8, AC-43 |
| SD-54 telemetry | §7, AC-34 |

## 12. Plan note

This file does not create `masterplan/02_plan.md`. Row 5 turns §1-§9 into ordered, pinned commands with rollbacks, after the controller has checked row 4.

## 13. Scope change (D15): resolved by D17-D28 (rev 3)

The rev-2 pending questions are answered. The scaffold sections §0-§8 remain the stack-proof baseline, and are being built now (D27). The full web build is §14; its rows wait for the second approval gate (D22), which now covers only the page rows (D27).

| Rev-2 question | Answer | Where it lands |
|---|---|---|
| 13(a) Phone portrait or tablet landscape | **Both, responsive, orientation unlocked** (D17). Two AVDs: `dems_tablet` (pixel_tablet) and `dems_phone` (pixel_10) (D23) | §5.1 (`orientation: "default"`), §5.2 (plugin removed), §5.5 (breakpoint at 900 dp), §6.3 (two AVDs), AC-06/07/08/25/29/30. The mobile **screens** are the next task (D20); row 18 stays a proof screen on both AVDs |
| 13(b) Web screens to build | **10 pages** (D18, D25, D26): Login, Dashboard, Session Monitor, Evidence (list and detail), Devices & Inputs, Storage, Network & Time, Security & Audit, System & Maintenance, API Reference. Plus the Start New Session 3-step flow | §14 |
| 13(c) Mock-core simulator depth | **In-browser simulation** in `packages/shared/src/sim` (D19). mock-core stays the approved scaffold (health plus 1 Hz WS heartbeat, D3/D4). API Reference try-it answers simulated endpoints in the browser via the renderer's `customFetch` (§14.9), so **no mock-core extension is proposed** at the second gate (D26 left this open) | §3 unchanged; §14.7, §14.9 |

**Design questions from rev 2, and their status:**

| # | Question | Status (rev 3) |
|---|---|---|
| Q-D1 | Sealed purple | **Adopted:** violet `#8B5CF6` (D28/Q4) |
| Q-D2 | Primary text colour | **Confirmed** `#F9FAFB`. Dashboard headings sample at `#FCFCFC` (V40). Warm secondary text is `#D8CEC6` (new `foreground-2`) |
| Q-D3 | Mobile gold "Sealed" / blue "Exported" vs DesignSystem | Sealed = violet (D28/Q4). **Exported = Info Blue** (04 §9 #11), which also matches the mobile mockup. **Under Review = amber** (04 §9 #10) |
| Q-D4 | Warm panels vs charcoal | **Resolved: warm** `--surface` `#191008` (measured, V40), with Charcoal for overlays only (D28/Q6) |
| Q-D5 | White on red (3.76) | Kept for large labels (End Session). Gold buttons use dark text (D28/Q5) |
| Q-D6 | Orbitron vs Eurostile | Orbitron (OFL). Italic titles use a synthetic oblique, `skewX(-9deg)` (04 §9 #25), because Orbitron has no italic |
| Q-D7 | Elevation numerics | Rev 3 values follow the measured bronze border (V40, §2.7) |

## 14. Web application (D18, D25, D26): 10 pages and the Start New Session flow

**Sources:**
- `research/04_ui_design_analysis.md` (§1-§10);
- decisions D17-D28;
- `ui_design/*.png`;
- analyst verification V40-V46 (§14.16).

**Fidelity levels:**
- Dashboard and Session Monitor are **faithful to D1 and SM, with creative improvement** (D18).
- The other pages are **derived** from DS, AS and MB (04 §5).

**D6 rule:**
- Every element is a HeroUI v3 component, a Magic UI or Motion Primitives item, Recharts, or TanStack Table.
- The **only** custom compositions are the five in §14.6: GlowRing, DbfsMeter, SessionTimeline, Stepper and AppShell.
- Page layouts are arrangements of kit components, not new primitives.

**Scaffold hand-over:**
- The row-17 proof route `/` (`src/routes/index.tsx`) is moved by the shell row to `/stack-check` (`src/routes/_app/stack-check.tsx`), and `/` becomes a redirect.
- This is a page-row change, **not** a change for the running scaffold (D27).

### 14.1 Dependencies added for the page rows (additive; §1.4 pins unchanged)

Install rule R-2: `npm install --save-exact <pkg>@<ver> -w <ws>`, from the workspace root with the workspace-local npm cache.

| Workspace | Package | Version | Licence | Why | Evidence |
|---|---|---|---|---|---|
| shared | `zustand` | 5.0.15 | MIT | Simulator store (§14.7). `zustand/vanilla` has no React dependency; React is an **optional** peer | V42 |
| shared | `@noble/hashes` | 2.4.0 | MIT | Real SHA-256 for the synthetic evidence tracks, manifest and audit hash chain (EVT-13/14/30), in pure TS that also runs on Hermes later | V42 |
| shared (dev) | `@scalar/openapi-parser` | 0.29.9 | MIT | Validates the OpenAPI 3.1 document in tests (AC-56) | V42 |
| core-web | `zustand` | 5.0.15 | MIT | `useStore` binding (one hoisted copy with shared) | V42 |
| core-web | `@scalar/api-reference-react` | 0.9.76 | MIT | API Reference renderer (§14.9). Brings `@scalar/api-reference` 1.72.3 | V41 |
| core-web | `i18next` | 26.4.2 | MIT | i18n runtime (§14.11). Peer `typescript ^5 \|\| ^6 \|\| ^7` passes against 6.0.3 | V42 |
| core-web | `react-i18next` | 17.0.15 | MIT | React binding. Peers `react >= 16.8.0`, `i18next >= 26.2.0` | V42 |

**Rejected** (evidence in §14.9 and §14.7):
- `swagger-ui-react` 5.33.0: it pulls in `@scarf/scarf` (install analytics).
- `xstate` 5.33.2: 2.2 MiB, more than the simulator needs.
- `jotai` 3.0.1: React-bound atoms that do not fit a framework-free simulator.
- `@xstate/store` 4.2.3: viable, but zustand's `persist` and `subscribeWithSelector` middleware cover snapshot persistence and transient meter subscriptions without extra code.

The mobile app gets no new dependencies in this task (D20).

### 14.2 Routes (TanStack Router, file-based, `apps/core-web/src/routes/`)

| File | Path | Page | Guard | Notes |
|---|---|---|---|---|
| `__root.tsx` | none | Providers: `MotionConfig`, `ToastProvider`, i18n, `SimProvider`, `HeartbeatProvider`, `QueryClientProvider` | none | Existing file, extended |
| `login.tsx` | `/login` | **Login** (§14.8) | Redirects to `/dashboard` if already signed in | `validateSearch`: `{ redirect?: string }` (zod) |
| `_app.tsx` | pathless layout | **AppShell** (§14.4) with `<Outlet />` | `beforeLoad`: if not authenticated, `throw redirect({ to: '/login', search: { redirect: location.href } })` | Every page below is inside the shell |
| `_app/index.tsx` | `/` | Redirect to `/dashboard` | inherited | none |
| `_app/dashboard.tsx` | `/dashboard` | **Dashboard** (§14.5.1) | inherited | none |
| `_app/session/index.tsx` | `/session` | **Session Monitor** (§14.5.2) | inherited | NO SESSION state when idle |
| `_app/session/new.tsx` | `/session/new` | **Start New Session** (§14.5.11) | inherited, plus RBAC `session:start` | `validateSearch`: `{ step: 1 \| 2 \| 3 }` |
| `_app/evidence/index.tsx` | `/evidence` | **Evidence list** (§14.5.3) | inherited | `validateSearch`: `{ q?, status?, caseType?, investigator?, from?, to?, page? }` |
| `_app/evidence/$evidenceId.tsx` | `/evidence/$evidenceId` | **Evidence detail** | inherited | `validateSearch`: `{ tab?: 'media' \| 'metadata' \| 'integrity' }` |
| `_app/devices.tsx` | `/devices` | **Devices & Inputs** (§14.5.4) | inherited | none |
| `_app/storage.tsx` | `/storage` | **Storage** (§14.5.5) | inherited | none |
| `_app/network-time.tsx` | `/network-time` | **Network & Time** (§14.5.6) | inherited | none |
| `_app/security-audit.tsx` | `/security-audit` | **Security & Audit** (§14.5.7) | inherited | none |
| `_app/system.tsx` | `/system` | **System & Maintenance** (§14.5.8) | inherited | Hosts the Demo Control Panel |
| `_app/developer/api.tsx` | `/developer/api` | **API Reference** (§14.9) | inherited | Lazy chunk: Scalar is loaded only here (AC-73) |
| `_app/stack-check.tsx` | `/stack-check` | The row-17 proof screen, moved | inherited | Kept as a stack diagnostic |

**Page contract:**
- Each page's root element carries `data-testid="page-<id>"` (for AC-48).
- Route files hold only `createFileRoute(...)` and `validateSearch`. Page bodies live in `src/features/<page>/`.
- `autoCodeSplitting: true` (§4.2) splits each page into its own chunk.

### 14.3 Global layout tokens

These values come from 04 §2.4 and §2.5. They are exported as `shell` in `tokens.ts` and applied as CSS variables on `:root`.

| Token | ≥ 1600 px | 1280-1599 | 1024-1279 | 768-1023 | < 768 |
|---|---|---|---|---|---|
| Sidebar | Full, **232** | Full, **216** | Icon rail, **72** (labels become Tooltips) | Hidden; HeroUI `Drawer` (placement start) opened by the hamburger | Hidden; a bottom tab bar (Home, Sessions, Evidence, Devices, More), 04 §2.5 |
| Top bar height | **80** | **72** | 72 | 64 | 64 |
| Page padding / gutter | 16 / 16 | 12 / 12 | 12 / 12 | 12 / 12 | 12 / 8 |
| Grid | 12 columns | 12 | 8 (Dashboard row 3 wraps 2 + 1) | 1-2 columns | 1 column |
| Nav item height / pitch | 56 / 64 | 48 / 54 | 48 / 54 | 48 / 54 (Drawer) | none |

- The shell is fixed; only the content area scrolls.
- The rail state persists in `localStorage` key `dems.shell.rail`. The `[` key toggles it.
- Type sizes stay at the printed px; only `display` uses `clamp(24px, 2.2vw, 32px)` (04 §2.4).

### 14.4 AppShell (custom composition 5 of 5, §14.6)

**Top bar** (04 §2.1), left to right:
1. **Logo lockup:** the SVG emblem (§14.10) plus the wordmark "DEMS EDGE CLIENT" (Orbitron 800, white-to-gold `background-clip: text`) plus the tagline in `foreground-2`. It is a `Link` to `/dashboard` and the landing target of the Login emblem flight.
2. **Date** (sim clock, `ddd, D MMM YYYY`, UTC+07:00, D28/Q2).
3. Vertical `Separator`.
4. **Clock** `HH:mm:ss`: Motion Primitives **SlidingNumber**, `font-mono` SemiBold, gold, tabular (04 §9 #24).
5. `Separator`.
6. **Device ID** block with a `Tooltip` (serial, firmware v2.4.1, build).
7. `Separator`.
8. **Bell:** a `Button isIconOnly` with a `Badge` count, opening a `Popover` of the latest alerts (04 §9 #37).
9. **User:** a `Dropdown` triggered by a ghost `Button` with an `Avatar` (initials from the operator name, 04 §9 #29). Menu items: Profile, Role (read-only), Lock console, **Sign out** (to `/login`).
10. **SECURE pill:** `Button variant="outline"` (restyled per §2.10), opening a `Popover` with the integrity checklist. States SECURE / ATTENTION / CRITICAL / UNKNOWN (AS shields). **Magic UI BorderBeam** runs only while degraded.

**Sidebar** (04 §2.2, D28 "Developer" group):
- **Items:** Dashboard `House`, Session Monitor `Monitor`, Evidence `FileText`, Devices & Inputs `Camera`, Storage `Database`, Network & Time `Network`, Security & Audit `ShieldCheck`, System & Maintenance `Settings`.
- Then a `Separator`, the micro label "DEVELOPER", and **API Reference** `Braces` with a small `Chip` "DEV".
- Items are TanStack Router `Link`s. The active indicator is an **inset rounded card** (D28/Q6; radius 8, bronze-to-dark horizontal gradient `#6A3916` → `#573520`, measured V40, `shadow-glow-2`). It moves between items as a Motion `layoutId` element (motion spec M-SH-02).
- Below the items: the topographic SVG (§14.10), then the footer "DEMS EDGE CLIENT · v2.4.1" and "SECURE RECORDING / TRUSTED EVIDENCE / SAFER COMMUNITIES".

**Page header template** (04 §3.2 K, reused by every shell page except the Dashboard):
- `Card variant="transparent"` containing a Lucide page icon, the title in `font-display text-display uppercase` with a synthetic oblique `skewX(-9deg)` and white-to-gold gradient text, and a subtitle in `foreground-2`.
- A right-side status banner: an `Alert` with a custom layout, or a `Card` with an animated `StatusDot` (`Chip` dot).

**Focus:** a 2 px gold focus ring on every interactive element (`--focus`; 04 §1.6; the mockups draw none).

### 14.5 Per-page mapping: panel → components

Column key:
- **HeroUI** = `@heroui/react` 3.2.6 components (V4, 04 §0);
- **Item** = a Magic UI (MU) or Motion Primitives (MP) copy-in item (V26, V27, V43);
- **Custom** = one of the §14.6 compositions;
- **Data** = simulator selector (§14.7).

Recharts 3.10.1 and TanStack Table 8.21.3 are as pinned in §1.4.

#### 14.5.1 Dashboard (D1; faithful + improved; 04 §3.1; grid 3|9, 5|7, 4|5|3, 6|6; row heights 340/256/180/148 at 1920, 280/216/156/128 at 1440)

| ID | Panel | HeroUI | Item | Custom | Data |
|---|---|---|---|---|---|
| A | SYSTEM READY ring | `Card variant="transparent"` | none | **GlowRing** (states READY / ATTENTION / CRITICAL / UNKNOWN / RECORDING) | `systemState`, `flags` |
| B | Hero (photo, overline, italic tagline, paragraph, gold rule, vertical RECORD / PRESERVE / PROTECT) | `Card variant="transparent"`, `Typography` | MP **TextEffect** (tagline, per line) | none | Static i18n. While recording, the copy switches to "Session in progress" |
| C | Status strip (6 cells) | `Card variant="secondary"`, `Separator` (vertical), `Link` per cell | MP **AnimatedNumber** (free TB) | none | `cameras`, `mics`, `storage`, `time`, `security`, `network` |
| D | Active Session (idle / setup / recording / finalizing / sealed) | `Card`, `EmptyState`, `ButtonGroup` (primary `Button` plus `Dropdown` chevron: "Start with last profile", "Start from template…"), `Button variant="outline"` "Open Evidence Queue" | MU **Ripple** (idle icon), MU **ShineBorder** (idle CTA) | In recording: REC thumbnail via CameraFeed (§14.10) plus a SlidingNumber timer | `session` |
| E | Devices & Inputs (Cam 1, Cam 2, MIC 1, MIC 2) | `Card variant="secondary"` tiles, `Chip`, `Dropdown` on an `isIconOnly` ghost `Button` (Details, Test signal, Restart: simulated), `Link` "View All Devices" | none | **DbfsMeter** (tile variant); CameraFeed | `cameras`, audio channel (transient) |
| F | Storage & Evidence | `Card`, `ProgressCircle` (**USED %**, D28/Q1), `Link` | MP **AnimatedNumber** | none | `storage` |
| G | Security, Time & Network (4 columns) | `Card`, `Separator`, `Chip color="success" variant="soft" size="sm"`, `Tooltip` | none | none | `security`, `time`, `network` |
| H | Sealed Evidence Today | `Card`, `Link` | MP **AnimatedNumber**; Recharts `BarChart` (gradient bronze → gold, no Y axis) | none | `sealedHourly[24]`, `sealedToday` |
| I | Recent Events (grouped by day, 04 §9 #34) | `Card`, `ScrollShadow`, `Link` | MU **AnimatedList** | none | `events` (latest 6) |
| J | Quick Actions (Run Diagnostics, Review Audit, Export Evidence, Open Maintenance) | Pressable `Card` as `Link` | MP **Spotlight** (hover) | none | RBAC (S20) |

#### 14.5.2 Session Monitor (SM; faithful + improved; 04 §3.2; grid 6|3|3, 6×2, 5|4|3)

| ID | Panel | HeroUI | Item | Custom | Data |
|---|---|---|---|---|---|
| K | Page header plus status banner (ACTIVE & SECURE / ATTENTION / FAULT / NO SESSION + CTA / FINALIZING) | Header template (§14.4), `Alert`, `Button` | MP **TextShimmer** (title, once) | none | `session.state`, worst alert |
| L | Live Session Feed (overlays: camera name, REC plus timer, `1080p • 25 fps • H.264`, fullscreen) | `Card`, `Chip color="danger"`, `ToggleButtonGroup` (Camera 1 \| Camera 2), `Button isIconOnly`, `Modal` (fullscreen) | MP **SlidingNumber** (timer) | CameraFeed | `session`, `activeCameraId` |
| M | Session Details (key-values) | `Card`, `Label` / `Description`, `Separator` | MP **SlidingNumber** (Duration) | none | `session` |
| N | Evidence Integrity (Encryption AES-256, Hash chain SHA-256, Secure timestamp, Storage write verified) | `Card`, `ListBox` (read-only), `Spinner`, `Chip` | MP **TextScramble** (on re-verify) | none | `security`, `audit.chainHead` |
| O | Audio Monitor (MIC 1 Interviewer, MIC 2 Subject) | `Card` | none | **DbfsMeter** × 2 (panel variant) | audio channel (transient) |
| P | Action bar (Pause Monitoring UI-only per D28/Q8; Add Marker; Session Note; Snapshot; Open Evidence Queue; **End Session**) | `Toolbar`, `ToggleButton`, `Button variant="outline"` × 4, `Button variant="danger-soft"`, `Popover` (marker label), `Drawer` + `TextArea` (note), `toast`, `AlertDialog` (mandatory reason, S21) | none | none | actions `addMarker`, `addNote`, `snapshot`, `stopRecording` |
| Q | Session Timeline | `Card`, `ScrollShadow`, `Link` | none | **SessionTimeline** | `session.timeline` |
| R | Camera & Input Status (2×2) | `Card`, `Card variant="tertiary"` × 4, `Chip` | none | DbfsMeter (compact); CameraFeed thumbnails | `cameras`, audio channel |
| S | Storage During Session | `Card`, `ProgressCircle` | MP **AnimatedNumber**; Recharts sparkline (write rate) | none | `storage`, `session` |
| T | Live Audit Events | `Card`, `ScrollShadow`, `Link` | MU **AnimatedList**, MP **TextScramble** (short hash) | none | `audit` (latest 12) |
| — | Finalization overlay (FINALIZING → SEALED) | `Modal` (non-dismissible), `ProgressBar`, `Chip` | none | **Stepper** (FinalizationStep × 6) | `session.finalization` |

#### 14.5.3 Evidence (list `/evidence`, detail `/evidence/$evidenceId`; 04 §5.1)

| Region | HeroUI | Item | Custom | Data |
|---|---|---|---|---|
| Header ("7 sealed today • 1 pending") | Template (§14.4) | none | none | `evidenceStats` |
| KPI cards: Total, Sealed, Recorded, Exported, Pending | `Card variant="secondary"` × 5 | MP **AnimatedNumber** | none | `evidenceStats` |
| Toolbar | `SearchField`, `ToggleButtonGroup` (All / Recorded / Sealed / Exported / Under Review / Archived), `Select` (Case Type), `Select` (Investigator), `DateRangePicker` | none | none | Route search params |
| Table (thumbnail, Evidence ID mono, recorded, subject + subject-type Chip, case, investigator, duration mono, size, status Chip, actions) | `Table`, `Checkbox` (bulk), `Pagination` (10/page), `Dropdown` (View, Verify, Export, Archive), `Skeleton`, `EmptyState` | TanStack Table v8 (sorting, filtering, pagination models) | none | `evidence` |
| Sticky preview (right, 4 columns) | `Card` | none | none | Selected row |
| Detail: header block | `Card`, `Chip`, `Label` / `Description` | none | none | `evidenceById` |
| Detail: Tabs Media, Metadata, Hash & Integrity | `Tabs`; Media: track list + `Modal` player; Metadata: key-values plus JSON in `Typography` `Code` inside `ScrollShadow` (closes the S19 JSON-viewer gap without a new library); Integrity: mono hashes + copy `Button` + `toast`, **Verify** → `Spinner` → PASS/FAIL `Chip`, custody-log `Table` | MP **TextScramble** (hash on verify) | **Stepper** (EvidenceLifecycleStage §19.1) | `evidenceById`, `verify()` |
| Detail: actions | `Button` primary Play, `Button variant="outline"` Export → `Modal` export wizard (**Stepper**; mandatory reason `TextArea`; RBAC-denied `Alert danger`), `Dropdown` More (Archive, Copy ID, Download manifest) | none | Stepper | `exportEvidence()` |

#### 14.5.4 Devices & Inputs (04 §5.2)

| Region | HeroUI | Item | Custom | Data |
|---|---|---|---|---|
| Camera Devices: Cam 1, Cam 2 live tiles | `Card`, `Chip`, `Dropdown` | none | CameraFeed | `cameras` |
| Summary metric cards | `Card variant="secondary"` | MP AnimatedNumber | none | `deviceStats` |
| Audio Inputs (large meters, peak hold, clip latch, read-only gain and phantom per G13) | `Card`, `Tooltip`, `Chip` | none | **DbfsMeter** (large) | audio channel, `mics` |
| Other Devices (PoE Switch 4/4, Recording Indicator "SEDANG MEREKAM", Tablet Control CONNECTED/OFFLINE with a recording-continues `Alert`, S9) | `Card`, `ListBox` (read-only), `Chip`, `Alert` | none | none | `otherDevices`, `tabletLink` |
| Port map (PoE CAM 1, PoE CAM 2/AUX, MGMT LAN, MIC IN 1/2, GNSS SMA, Relay I/O; link LEDs) | `Card`, grid of `Chip` (dot) + `Tooltip` | none | none | `ports` |
| Device Drawer: Overview, Health, Log | `Drawer`, `Tabs`, `Table` | Recharts `LineChart` | none | `deviceById` |

#### 14.5.5 Storage (04 §5.3)

| Region | HeroUI | Item | Custom | Data |
|---|---|---|---|---|
| Capacity ring (**used %**) plus legend | `Card`, `ProgressCircle` (large), `Separator` | MP AnimatedNumber | none | `storage` |
| KPI cards: Write speed, Session size, Est. remaining (computed, 04 §9 #17), Retention days | `Card variant="secondary"` × 4 | MP AnimatedNumber | none | `storage` |
| Usage over 24 h / Sealed per hour | `Card` × 2 | Recharts `AreaChart`, `BarChart` | none | `storage.history`, `sealedHourly` |
| Volumes: NVMe (system), HDD (evidence) | `Card`, `ProgressBar` × 2 | none | none | `storage.volumes` |
| Recent storage activity | `Card`, `ScrollShadow` | MU AnimatedList | none | `events` filtered to storage |
| Retention calculator (S15) | `Card`, `NumberField` × 2 (bitrate Mbps, hours/day), `Meter` | MP AnimatedNumber | none | Local form (01 §10.2 formula) |
| Manage Storage | `Button` → `Drawer` (`Select` retention policy, `Switch` auto-archive, `Button`) | none | none | `storagePolicy` |

#### 14.5.6 Network & Time (04 §5.4)

| Region | HeroUI | Item | Custom | Data |
|---|---|---|---|---|
| System time hero (clock, date, UTC+07:00, Synchronized) | `Card`, `Chip` | MP SlidingNumber | none | `clock`, `time` |
| Time-source hierarchy GNSS → NTP → RTC (active tier, lock, stratum, last sync, offset, server) | `Card`, `Chip`, `Separator` (composition of kit parts) | MU **OrbitingCircles** (satellites while GNSS is LOCKED) | none | `time` |
| Network status (LAN, PoE, bandwidth) | `Card`, `Chip` | Recharts sparkline (`LineChart`) | none | `network` |
| Network domains (Camera, Management, Service/Update, Export/Transfer) | `Card` grid | MU **AnimatedBeam** (Camera ↔ Core ↔ Tablet; Export path dashed) | none | `network.domains` |
| Time-offset history / event log | `Card` × 2, `Table` (compact) | Recharts `LineChart` | none | `time.history`, `events` |

#### 14.5.7 Security & Audit (04 §5.5)

| Region | HeroUI | Item | Custom | Data |
|---|---|---|---|---|
| Posture shield (Secure / Attention / Critical / Unknown; Unknown uses `ShieldQuestion`, 04 AS #5) | `Card`, Lucide shields | none | none | `security.posture` |
| Controls checklist | `Card`, `ListBox` (read-only), `Chip` | none | none | `security.controls` |
| Audit log (time, event, actor, category Chip, chain-link status) + filters + "Live" switch | `Table`, `SearchField`, `Select`, `DateRangePicker`, `Switch`, `Pagination` | TanStack Table v8; MU AnimatedList for live rows | none | `audit` |
| Hash-chain strip (last N blocks); discontinuity `Alert` (EVT-30) | `Card`, `TagGroup` / `Tag`, `Tooltip`, `Alert` | none | none | `audit.chain` |
| Keys & certificates (C11) | `Card`, `Label` / `Description`, `Chip` (expiry) | none | none | `security.keys` |
| Export audit (RBAC-gated; disabled with a Tooltip naming the role, S20) | `Button`, `Tooltip` | none | none | `auth.role` |

#### 14.5.8 System & Maintenance (04 §5.6)

| Region | HeroUI | Item | Custom | Data |
|---|---|---|---|---|
| Quick actions (reuses J) | as J | MP Spotlight | none | none |
| Services board (16 Core services, §6.1) | `Table` (compact), `Chip` | none | none | `services` |
| Health (CPU, zone temperatures, fan RPM) | `Card` × 3 | Recharts `LineChart` (mini) | none | `health.series` |
| Software update (v2.4.1 → **v2.5.0** available, 04 §9 #19; slot A/B) | `Card`, `ProgressBar`, `Chip` | none | **Stepper** (UpdateStep §20.2) | `update` |
| About / identity (§24.1, 12 fields) | `Card`, `Label` / `Description` | none | none | `device.identity` |
| Settings (MB 10 rows) | `Accordion`, `Switch`, `Checkbox`, `RadioGroup`, `Select` | none | none | `settings` |
| **Demo Control Panel** (C17; behind a `Switch` "Demo controls") | `Card`, `Button` per fault (camera loss, MIC 2 clip, MIC 1 no signal, storage low, storage full, GNSS loss, tamper, fan stall, power fail), `Select` scenario, `Button` reset, `Switch` presentation mode | none | none | `sim.inject()`, `sim.loadScenario()` |
| Run Diagnostics | `Modal`, `ProgressBar` per check, `Alert` | none | none | `sim.runDiagnostics()` |

#### 14.5.9 Login `/login` (D25; 04 §5.8) and 14.5.10 API Reference `/developer/api` (D26; 04 §5.9)

Specified in §14.8 and §14.9.

#### 14.5.11 Start New Session `/session/new` (04 §5.7)

- **Container:** a full route page inside the shell (deep-linkable and back-button friendly), with `?step=1|2|3`.
- **Header:** the **Stepper** (① Session Info → ② Devices Check → ③ Ready).
- **Step content:** transitions with MP **TransitionPanel**.

| Step | HeroUI | Custom | Data and rules |
|---|---|---|---|
| 1 Session Info | `Form`, `TextField` (Case Number, with a scan `Button isIconOnly`), `ToggleButtonGroup` Subject Type (**Tersangka** red / **Saksi** blue / **Lainnya** neutral, EN tooltips Suspect / Witness / Other, D28/Q3), `TextField` Subject Name, `ComboBox` Investigator (defaults to the signed-in operator), `Select` Room, `Select` Recording Profile ("Standard (1080p / 25 fps)"), `TextArea` Notes, `FieldError` | Stepper | RHF + zod `sessionCreateSchema` (shared). "Next" is disabled until the form is valid |
| 2 Devices Check (§5.3 gate) | `ListBox` of 8 checks, each with a PASS / WARN / BLOCK `Chip` and `Spinner` while resolving, `Checkbox` "Acknowledge warnings", `Alert danger` for BLOCK | CameraFeed × 2, DbfsMeter × 2, Stepper | `sim.precheck()`. Policy (demo, G8): Core OFFLINE, Lens FAULT, Storage FULL or Security FAULT → **BLOCK**; MIC NO SIGNAL / CLIP, Storage LOW or Time on RTC → **WARN** (needs acknowledgement) |
| 3 Ready | `Card` summary, `Switch` "3-2-1 countdown" (default on), `Button` primary "Start Recording" | GlowRing (mini), Stepper | `sim.startRecording()`, then navigate to `/session`. Cancel after data entry → `AlertDialog` |

### 14.6 The five custom compositions (the only non-kit UI; D6)

| Composition | File | Contract | Built from | Accessibility |
|---|---|---|---|---|
| **GlowRing** | `src/components/composed/glow-ring.tsx` | `{ state: 'READY'\|'ATTENTION'\|'CRITICAL'\|'UNKNOWN'\|'RECORDING'; size: number; center?: ReactNode; label?: string; mode?: 'hero'\|'mini'\|'login' }` | SVG layers (tick ring, bracket arcs, solid ring) plus Motion; Lucide `ShieldCheck` default centre | `role="img"` with `aria-label` "System ready" and similar; decorative layers `aria-hidden` |
| **DbfsMeter** | `src/components/composed/dbfs-meter.tsx` | `{ channel: 'AUDIO-01'\|'AUDIO-02'; variant: 'tile'\|'panel'\|'large'\|'compact'; orientation?: 'vertical'\|'horizontal' }`. It reads the **transient** audio channel (§14.7), never React state | 10 segments: −60, −48, −40, −32, −26, −20 (green), −14, −9 (amber), −5, −2 (red); peak-hold tick; CLIP latch `Chip`; dBFS readout (mono) | `role="meter"` with `aria-valuemin=-60`, `aria-valuemax=0`, and `aria-valuenow` updated at **1 Hz** (not 20 Hz) plus `aria-valuetext` "−18 dBFS" |
| **SessionTimeline** | `src/components/composed/session-timeline.tsx` | `{ events: TimelineEvent[]; now: number }`. Kinds START, NOTE, AUDIO_PEAK, HEALTH, AUTOSAVE, CHECK, MARKER, SNAPSHOT, FAULT | Vertical line plus nodes (filled green = system OK; hollow amber = note; filled amber = peak; red = fault), kit `Typography` | `<ol>` list semantics; the newest item is announced with `aria-live="polite"` |
| **Stepper** | `src/components/composed/stepper.tsx` | `{ steps: {id,label,status:'pending'\|'active'\|'done'\|'warn'\|'error'}[]; orientation: 'horizontal'\|'vertical'; variant: 'wizard'\|'pipeline' }`. Used by Start Session, Finalization, Export wizard, Update and Lifecycle | Kit `Chip` (step badges), `Separator` (connectors), Motion | `<ol>` with `aria-current="step"` |
| **AppShell** | `src/components/shell/{app-shell,top-bar,sidebar,page-header}.tsx` | §14.3, §14.4 | Kit `Link`, `Button`, `Dropdown`, `Popover`, `Drawer`, `Tooltip`, `Avatar`, `Badge`, `Chip`, `Separator` plus Motion `layoutId` | Landmarks `<header>`, `<nav aria-label="Primary">`, `<main>`; skip-to-content link |

**Not a UI primitive:** **CameraFeed** (`src/components/media/camera-feed.tsx`) is an **asset renderer** (§14.10). It paints a procedural camera image onto a `<canvas>` and composes kit `Chip` overlays.

### 14.7 In-browser simulator (`packages/shared/src/sim`; D19)

Pure TypeScript with no DOM and no React in the core, so the mobile app can reuse it (D19).

| File | Responsibility |
|---|---|
| `rng.ts` | Seeded PRNG (**mulberry32**) and helpers (`int`, `pick`, `gauss`, `poisson`). One stream per subsystem, derived from `seed` plus a salt, so adding a subsystem never shifts another subsystem's sequence |
| `clock.ts` | `SimClock { now(): number; tz: '+07:00' }` (D28/Q2). Starts at real `Date.now()` so dates are never stale (04 §9 #1). Options: `speed` (1× default) and a test mode with a frozen start |
| `dataset.ts` | **The one canonical demo dataset** (D28/Q7; resolves 04 §9 #3, #5-#8, #12-#18, #27-#29). See the dataset table below |
| `session-machine.ts` | Transition table (below) plus guards; idempotent `createSession` (S26); FAULT and RECOVERY labelled as demo assumptions (01 G4) |
| `audio.ts` | Dual-channel level generator at **20 Hz** (`meterFrameMs` 50, §2.7). Noise floor −52 ±2 dBFS. Alternating speaker turns (3-12 s) at −24 to −12 dBFS with 4-6 Hz syllabic modulation. One peak near −3.1 dBFS every 90-180 s (SM timeline). Ballistics: instant attack, 20 dB/s release. Peak hold 1.5 s, then a 20 dB/s decay. CLIP (≥ −0.5 dBFS) only by fault injection, latched until reset. NO SIGNAL means a flat −90 |
| `health.ts` | Cameras, mics, storage (bytes, write speed, bitrate 18.3 Mbps = 8.2 GB/h per 01 §10.3), time (GNSS → NTP → RTC, offset ±12 ms), network (192.168.10.21, Interview LAN, PoE 4/4, bandwidth series), security (TPM 2.0, Secure Boot, AES-256-GCM, SHA-256 chain), 16 services, CPU/temperature/fan series. Updated at 1 Hz |
| `events.ts` | Event and audit generator; audit hash chain `hash = sha256(prevHash ‖ canonicalJSON(event))` via `@noble/hashes/sha2.js`; ring buffers (events 500, audit 1000) |
| `evidence.ts` | Evidence objects, per-track SHA-256 over synthetic segment descriptors, manifest hash, and a **simulated signature** (sha256 of manifest plus key ID, labelled "simulated" in the UI and never called a real signature), `verify()`, and a tamper hook (EVT-13/14) |
| `auth.ts` | Operators, roles and lockout (§14.8) |
| `faults.ts` | `inject(kind)`, keyed to EVT and FMEA: CAMERA_LOSS (EVT-04), MIC_NO_SIGNAL (EVT-05/06), MIC_CLIP (EVT-07), STORAGE_LOW / STORAGE_FULL (EVT-08), GNSS_LOSS (EVT-10), TAMPER (EVT-12), FAN_STALL (EVT-24), POWER_FAIL (EVT-21) → FAULT → RECOVERY, AUDIT_TAMPER (EVT-30). Each fault emits an alert **and** an audit row (§6.4, SYS-014) |
| `api.ts` | Simulated REST handlers for the 9 §21.2 endpoints: `(req, store) => { status, headers, body }`, returning `x-dems-simulated: 1`. Used by the API Reference `customFetch` (§14.9) |
| `scenarios.ts` | `idle` (default after login; Dashboard D1), `recording` (a session 00:18:42 in, as SM), `finalizing`, `fault-demo` |
| `engine.ts` | `createSim({ seed = 20261001, scenario = 'idle', clock, scheduler })` returns `{ store, start(), stop(), actions }`. The scheduler is injectable (tests use fake timers); the default is `setInterval(50)`. It pauses while `document.hidden` and catches up on resume |
| `store.ts` | **zustand vanilla** `createStore` with `subscribeWithSelector` and `persist` (sessionStorage key `dems.sim.v1`, throttled to 1 s, so a reload resumes and the timer survives: S4). The high-frequency `audio` slice is excluded from persistence |
| `react.ts` | `SimProvider`, `useSim(selector)` (zustand `useStore` + `useShallow`), `useSimActions()`, and `useAudioChannel(ch, onFrame)`, a **transient** subscription that drives Motion values without React re-renders (03_motion_spec M-C-04 and §9.3) |

**Why zustand 5.0.15** (V42):
- `zustand/vanilla` runs with no React (React is an optional peer), so the engine stays framework-free and mobile-reusable.
- `subscribeWithSelector` gives the transient 20 Hz meter subscriptions.
- `persist` gives reload-safe snapshots.
- It is 0.1 MiB unpacked and MIT.
- The same package later binds React Native (D20).

**Rejected:**
- XState 5.33.2: 2.2 MiB, and it models the session machine but not the generators.
- Jotai 3.0.1: React-bound.
- `@xstate/store` 4.2.3: no built-in persist or selector subscriptions.
- Redux Toolkit: not collected, and verbose for this.

**Session machine** (book §6.2 plus demo assumptions). `null` means no session (IDLE):

| From | Event | To | Timing / effect |
|---|---|---|---|
| null or SEALED | `createSession(input)` | CREATE | Rejected if a session is active (S26). Audit SESSION_CREATED |
| CREATE | `beginPrecheck()` | PRECHECK | 8 checks resolve one at a time, 300-700 ms each (seeded) |
| PRECHECK | all resolved, no BLOCK, warnings acknowledged | ARMED | Audit PRECHECK_PASSED. With a BLOCK it stays in PRECHECK and lists the reasons |
| ARMED | `startRecording()` | RECORDING | `startedAt = now`. Audit RECORDING_STARTED. Timeline START |
| RECORDING | `stopRecording(reason)` (reason ≥ 5 characters) | STOPPING | 1.5 s. Audit RECORDING_STOPPED |
| STOPPING | tracks closed | FINALIZING | FinalizationStep × 6 at 0.6-1.2 s each; per-track SHA-256 |
| FINALIZING | steps done | SEALED | EvidenceObject and Manifest created. Audit EVIDENCE_SEALED. `sealedHourly` incremented |
| PRECHECK, ARMED, RECORDING, FINALIZING | `inject(critical)` (STORAGE_FULL, TPM failure, POWER_FAIL, SECURITY_FAULT) | FAULT | Alert CRITICAL plus audit. Recording is never silently masked (§6.4) |
| FAULT | `recover()` | RECOVERY | RECOVERY_SCAN → INCOMPLETE_SESSION_ANALYSIS, 3 s |
| RECOVERY | analysis done | null | The session is kept as **incomplete**, never SEALED (SYS-008) |
| CREATE, PRECHECK, ARMED | `cancel()` | null | Audit SESSION_CANCELLED |

**Non-critical faults** (camera loss, MIC clip or no signal, GNSS loss, fan stall, tamper) raise an alert plus audit and change device state, but **do not** change the session state (§6.4: policy-driven).

**Canonical dataset** (`dataset.ts`; synthetic, no real persons or cases, A7):

| Item | Value |
|---|---|
| Device | `DEMS-IR-01`, "Interview Room 1", DEMS Edge Client **v2.4.1** (update available **v2.5.0**) |
| Time zone | UTC+07:00 (WIB), D28/Q2 |
| Operators (D25, D28/Q14) | `budi.santoso`: **AKP Budi Santoso**, INVESTIGATOR (initials BS). `andi.pratama`: **AKP Andi Pratama**, SUPERVISOR. `rina.wijaya`: **Rina Wijaya**, TECHNICIAN. Demo password for all three: `demo-2026`, shown only in the Login Disclosure, never logged |
| Roles (demo assumption, 01 G1) | INVESTIGATOR: start/stop sessions, notes, view evidence. SUPERVISOR: plus review, export, audit export. TECHNICIAN: devices, diagnostics, maintenance; no evidence export and no session start |
| Recording scenario session | `SES-{YYYYMMDD}-0017`; case `LP/{YYYY}/{MMDD}-0007`; subject **Ahmad Fauzi**, subject type **Tersangka**; investigator AKP Budi Santoso; room Interview Room 1; profile Standard (1080p / 25 fps); elapsed 00:18:42 at load. All dates come from the sim clock |
| Evidence history | 6 items `EV-{date}-0001…0006` over the previous 2 days. Subjects Siti Rahma (Saksi), Budi Hartono (Saksi), Rudi Setiawan (Tersangka), Maya Lestari (Saksi), Dewi Anggraini (Lainnya), Hendra Wijaya (Saksi). Status mix: 3 SEALED, 1 RECORDED, 1 EXPORTED, 1 UNDER_REVIEW |
| Tracks | VIDEO-01 Camera 1, VIDEO-02 Camera 2 (1080p, 25 fps, H.264); AUDIO-01 "MIC 1 – Interviewer", AUDIO-02 "MIC 2 – Subject" (04 §9 #8) |
| Storage | 4.0 TB evidence HDD (4,000 GB decimal) with 804 GB used at load, so **20% used, 3.2 TB free** (D28/Q1, consistent with 04 §9 #4); 2 TB NVMe system volume |
| Network and time | 192.168.10.21 on "Interview LAN"; NTP server 192.168.10.1; GNSS locked, stratum 1 |
| Copy conventions | "Start New Session" / "End Session" (04 §9 #27); "Pause Monitoring" is UI-only (D28/Q8; typo fixed, 04 §9 #2); "Open Evidence Queue" routes to `/evidence?status=RECORDED` (04 §9 #33) |

**Rates:**
- clock tick 100 ms
- audio 20 Hz
- health, timer and heartbeat UI 1 Hz
- recording events: a Poisson process with a mean of 1 per 8 s (audit: frame hash, write verified, timestamp confirmed)
- idle events: 1 per 60 s

### 14.8 Login and simulated authentication (D25; 04 §5.8)

**Layout:**
- ≥ 1280: a 7 | 5 split.
- 1024-1279: 6 | 6.
- 768-1023: stacked brand band (280 px) above the card.
- < 768: full-bleed backdrop with the card over it.

**Brand side:**
- the hero still (§14.10) graded per 04 §7;
- **GlowRing** (`mode="login"`, 320-360 px) with the SVG emblem at its centre;
- the overline, wordmark, italic tagline, gold rule, and a vertical RECORD / PRESERVE / PROTECT;
- a device strip: a compact `Card` row showing device, room, clock (SlidingNumber), GNSS, Core link (from `useHeartbeat`) and SECURE;
- optional MU **Particles** (quantity ≤ 24, gold at 30%, off under reduced motion).

**Auth card:**
- `Card` (L2, width 440) with a MU **BorderBeam** that runs one lap on entry;
- "Sign in" (h1) and "Authorised operators only";
- `TextField` + `InputGroup` for Username (`User` icon, `autocomplete="username"`) and Password (`Lock` icon, eye toggle via `Button isIconOnly`, caps-lock hint);
- `Button` primary `fullWidth` "Sign In" with **dark text** (D28/Q5) and a `Spinner` while pending;
- `Separator` "or";
- `Button variant="outline"` "Use security key (simulated)" (D28/Q15): after a 1.2 s simulated prompt it signs in as the SUPERVISOR operator;
- `Disclosure` "Demo operators" (collapsed) listing the 3 operators with role `Chip`s; clicking one fills the form; hidden in presentation mode;
- a trust line with `ShieldCheck`: "Console: DEMS-IR-01 • paired (simulated)", with a `Tooltip` citing §20.1;
- footer: version and brand triplet.

**States:** Idle; Validating (`FieldError`); Submitting; Error (generic "Invalid username or password." plus attempts remaining); Locked out (`Alert warning` with a live countdown); Core offline (`Alert danger` with Retry; Sign In disabled); Signed out / expired (`Alert`); Success (hand-off, motion spec M-APP-01).

**Policy (demo, `auth.ts`):**
- **5** failed attempts within **5 min** → locked for **60 s**. The sim clock is authoritative; the component only displays it.
- Every attempt emits an audit row: AUTH_SUCCESS, AUTH_FAILED or AUTH_LOCKED (visible in Security & Audit).
- Sessions live in `sessionStorage` key `dems.auth` as `{ operatorId, issuedAt }`, never a password.
- Idle timeout is 15 min, leading to "session expired".
- Credentials never appear in URLs, logs or events (§20.1).

### 14.9 API Reference `/developer/api` (D26; 04 §5.9)

**Renderer decision: Scalar**, via `@scalar/api-reference-react` 0.9.76 (V41).

| Criterion | Scalar (`@scalar/api-reference-react` 0.9.76 → `@scalar/api-reference` 1.72.3) | Swagger UI (`swagger-ui-react` 5.33.0) |
|---|---|---|
| Theming via CSS variables | **Yes.** `--scalar-background-1/2/3`, `--scalar-color-1/2/3`, `--scalar-color-accent`, `--scalar-border-color`, `--scalar-font`, `--scalar-font-code`, `--scalar-radius`, `--scalar-color-{green,blue,orange,red,purple,yellow}`, `--scalar-sidebar-*` (from the `@scalar/themes` source); `theme: 'none'` and `customCss` | No variable system. Class-level overrides of `swagger-ui.css` (186 KB); dark mode exists as `dark-mode` classes |
| No CDN fonts | **Configurable.** `withDefaultFonts` defaults to `true` (loads `fonts.scalar.com`, found in `@scalar/themes`), so set `withDefaultFonts: false` | System fonts (`font-family: sans-serif` / `monospace`); no CDN |
| No hosted proxy | **Safe for our targets.** `shouldUseProxy()` returns false when the request URL is local (`127.0.0.1`, `localhost`); `isLocalUrl` in `@scalar/helpers`. We set no `proxyUrl` | No proxy. But **`validatorUrl` defaults to `https://validator.swagger.io/validator`** (an external call) and must be set to `null` |
| No telemetry | **Configurable.** `telemetry` defaults to `true`, but PostHog is an **opt-in plugin** (`@scalar/api-reference/plugins/posthog`: "If the plugin is not loaded, no tracking occurs"). The React wrapper contains no PostHog. We still set `telemetry: false`, `agent: { disabled: true }` (agent chat otherwise shows) and `mcp: { disabled: true }` | **Install-time analytics:** it depends on `@scarf/scarf` 1.4.0 ("like Google Analytics for your npm packages"; `postinstall: node ./report.js`). That conflicts with NFR1 |
| Licence | MIT | Apache-2.0 |
| Size | 4.38 MB standalone bundle (**1.26 MB gzip**, includes Vue and the API client) | 1.59 MB bundle (**429 KB gzip**) plus CSS 27 KB gzip |
| LIVE / SIMULATED marking | Native **`x-badges`** operation extension (rendered before or after the title) | Only through description text |
| Simulated try-it | **`customFetch`**: "Custom fetch function used both when loading the OpenAPI document and when sending requests from the API client" | `requestInterceptor` |
| React 19 | Peer `^18.0.0 \|\| ^19.0.0` | Peer `>=16.8.0 <20` |

**Verdict:** Scalar wins on theming, marking, try-it routing, dark mode and runtime privacy. Its cost is bundle size, which is contained by lazy-loading the route (autoCodeSplitting; AC-73). Swagger UI is rejected mainly for the install-time Scarf analytics and the default external validator.

**Configuration** (`src/features/api-reference/scalar-config.ts`; unit-tested in AC-57):

```ts
{
  content: openApiDocument,            // imported object from @dems/shared (no network fetch)
  theme: 'none', layout: 'modern', forceDarkModeState: 'dark', hideDarkModeToggle: true,
  withDefaultFonts: false, telemetry: false, showDeveloperTools: 'never',
  agent: { disabled: true }, mcp: { disabled: true },
  hideClientButton: true, documentDownloadType: 'none', persistAuth: false,
  customCss: scalarThemeCss,           // generated: packages/shared/theme/scalar.css
  customFetch: simAwareFetch,          // health → network; others → sim/api.ts
}
```

**OpenAPI document:**
- `packages/shared/src/api/openapi.ts`: an OpenAPI **3.1.0** object with 10 operations: `GET /api/v1/health` (**LIVE**) plus the 9 §21.2 endpoints (**SIMULATED**). The WS `/ws` is described in a Realtime tag description, because OpenAPI cannot model WebSockets.
- Schemas come from the shared types (`HealthResponse`, session, device health, audio, video and storage status, export request/response).
- Each operation carries `x-badges` (`LIVE`, `SIMULATED`, and `RBAC + AUDIT` on export) and `x-dems-mode: live | simulated`.
- An info section states which endpoints the design book does not define (01 L364-L368).
- `npm run openapi:gen -w @dems/shared` writes `packages/shared/openapi/openapi.json` (committed, with a drift test).
- "Download openapi.json" builds a Blob from the same object.

**`simAwareFetch`:**
- `GET {CORE_HTTP_ORIGIN}/api/v1/health` goes to the real `fetch` (LIVE, CORS per SPEC-C1).
- Every other `{CORE_HTTP_ORIGIN}/api/v1/*` request is answered by `sim/api.ts` as a `Response` with `x-dems-simulated: 1`. Export follows the signed-in role: INVESTIGATOR gets 403 plus an audit row; SUPERVISOR gets 202 plus an ExportEvent.
- Any other URL is **blocked** (rejected Promise), so nothing leaves the machine.

**Theme:** `gen-theme.ts` gets a **third output**, `theme/scalar.css`, which maps §2.7 tokens onto the `--scalar-*` variables. Method colours: GET Info Blue, POST Success Green, PUT/PATCH Amber, DELETE Red, WS Bronze, per 04 §5.9. Fonts: Inter and JetBrains Mono (Orbitron never appears inside the renderer).

**Page layout:**
- The header template, with a service banner fed by `useHeartbeat`.
- A server strip: base-URL `Chip` (mono), spec version, Download and Copy `Button`s, legend `Chip`s LIVE / SIMULATED / RBAC + AUDIT, and a `Switch` "Show simulated endpoints" that filters the document object.
- The renderer inside an L2 `Card` (9 columns).
- A **Realtime WS panel** (3 columns; full width below 1440): `Card`, `Chip` (ONLINE / CONNECTING / OFFLINE), the WS URL with a copy `Button`, `seq` (MP **SlidingNumber**), serverTime, uptime, clients, the last 5 messages as JSON (MU **AnimatedList**), and a Connect/Disconnect `Switch`.

### 14.10 Assets

| Asset | Decision | Licence / provenance record |
|---|---|---|
| **Logo emblem** | **Recreated as hand-authored SVG** (04 §7): a double-stroke shield plus 6 fingerprint arcs. Each arc is a separate `<path>` with ids `emblem-shield`, `emblem-arc-1`…`emblem-arc-6` (animation targets). Vertical gradient `#FFE2A6` → `#FFC86B` → `#C9802F`; glow via CSS `drop-shadow` | Original work in this repo. `apps/core-web/src/assets/brand/emblem.svg`, plus `favicon.svg` (SVG favicon) |
| **Wordmark** | Live text (Orbitron 800, gradient) | n/a |
| **Hero / room still** (Dashboard hero B and Login brand side) | **Primary:** one free-licence photograph of an **empty** interview or meeting room from **Pexels** or **Unsplash**: no people, no insignia, no text, at least 2560×1440. Graded in CSS (brightness .55, sepia .35, saturate .8, warm overlay; 04 §7) and resized with macOS `sips` to ≤ 2560 px wide at JPEG quality 80. **Fallback:** a procedural SVG/CSS room abstraction (gradient walls, table silhouette) | Pexels: "free to use … modify"; attribution "not necessary"; limits on identifiable people and on selling unaltered copies. Unsplash: "download, copy, modify, distribute … for free, including for commercial purposes, without permission"; limits on selling without significant modification and on compiling to replicate a competing service (V44). The row records the photographer, source URL, licence name and retrieval date in `THIRD_PARTY_NOTICES.md` (AC-67) |
| **Camera feeds, thumbnails, evidence posters** | **Procedural CameraFeed** (`<canvas>`): two fixed crops of the hero still (Cam 1 wide, Cam 2 reverse-angle mirror crop), with slow Ken Burns drift, film grain and sensor noise from the seeded RNG, a rolling scanline, and a burnt-in timestamp from the sim clock. Posters are canvas snapshots. **No video files** in this task (smaller repo, no extra licences). Looped clips (01 S5) can replace it later without an API change (`src` prop) | Derived from the hero still; same licence |
| **Topographic texture** | Generated SVG: `packages/shared/scripts/gen-topo.ts` (seeded value noise → marching-squares contours), 1 px bronze strokes at 15-40% alpha. Committed as `apps/core-web/src/assets/brand/topo.svg` | Original work |
| **Light streaks / canvas glows** | CSS radial and linear gradients | n/a |
| **Mobile login photo** (MB 1, an identifiable officer with insignia) | **Never used or cropped** (D28) | n/a |
| **Icons** | Lucide (`lucide-react` 1.49.0), names per 04 §7, verified at typecheck | ISC |
| **Fonts** | Orbitron, Inter and JetBrains Mono (§1.4, rev 2) | OFL-1.1 |

### 14.11 Internationalisation and copy (D28/Q3)

- **Runtime:** `i18next` 26.4.2 + `react-i18next` 17.0.15, initialised in `apps/core-web/src/i18n.ts` with `lng: 'en'` and `fallbackLng: 'en'`.
- **Resources:** in `packages/shared/src/i18n/en.ts`, as typed nested keys by page (`dashboard.hero.title`, etc.). Shared so mobile can reuse them.
- **Language:** the UI is **English**. Indonesian **domain terms are kept verbatim**:
  - subject types "Tersangka", "Saksi", "Lainnya" (tooltips "Suspect", "Witness", "Other");
  - ranks in names (AKP);
  - case prefix "LP/";
  - the recording lamp label "SEDANG MEREKAM".
- An `id` locale is out of scope (A10). The keys-from-day-one rule makes it additive later.
- **Formatting:** `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta' })`, which is the UTC+07:00 zone (D28/Q2), plus tabular numerals for live values.

### 14.12 Adopted defaults (D28) and 04 §9 resolutions used by this spec

| Ref | Decision |
|---|---|
| Q1 | Storage rings show **USED %** (20% at load) with "3.2 TB free of 4.0 TB" |
| Q2 | UTC+07:00 (WIB) everywhere |
| Q3 | EN UI with ID domain terms; i18n keys from day one (§14.11) |
| Q4 | Violet Sealed (`#8B5CF6`) |
| Q5 | Dark text (`#0B0D0F`) on gold buttons |
| Q6 | Warm `--surface`; Charcoal only for L5; **inset** active nav card |
| Q7 | One canonical dataset (§14.7) |
| Q8 | "Pause Monitoring" is UI-only; no PAUSED session state |
| Q9 | Fonts pinned (§1.4) |
| Q10 | Media: no MB 1 photo; a licensed still plus procedural feeds (§14.10) |
| Q11 | Colours pixel-sampled (V36, V40) |
| Q12 | API Reference is its own sidebar item in a **DEVELOPER** group |
| Q13 | Renderer is Scalar; simulated try-it routes to the in-browser simulator with a SIMULATED badge |
| Q14 | 3 synthetic operators (§14.7) in a collapsible Disclosure, with presentation mode |
| Q15 | A simulated "Use security key" on web |
| 04 §9 | #2 typo fixed; #10 Under Review amber; #11 Exported blue; #17/#18 storage values computed; #19 v2.5.0 update; #24 mono for live values; #25 synthetic oblique; #26 no PAUSED state; #27 one verb pair; #29 initials from name; #33 queue route; #34 events grouped by day; #37 bell added |

### 14.13 Tests added by the page rows

| Workspace | File | What it proves |
|---|---|---|
| shared | `test/sim-determinism.test.ts` | Same seed and scenario gives identical 600-tick event streams and chain heads (AC-51) |
| shared | `test/session-machine.test.ts` | Every allowed transition passes, disallowed ones throw, and duplicate sessions are refused (AC-52) |
| shared | `test/audio.test.ts` | Range, peak-hold decay, clip latch (AC-53) |
| shared | `test/storage-math.test.ts` | USED % and estimated remaining (AC-54) |
| shared | `test/hash-chain.test.ts` | PASS, then tamper, then FAIL at the exact index (AC-55) |
| shared | `test/auth.test.ts` | Lockout policy and audit rows (AC-50) |
| shared | `test/openapi.test.ts` | Valid 3.1 document, 10 operations, badges (AC-56) |
| shared | `test/contrast.test.ts` | §2.7 text pairs meet the listed ratios (AC-69) |
| core-web | `src/test/routes.test.tsx` | 11 routes render; the guard redirects (AC-48, AC-49) |
| core-web | `src/test/scalar-config.test.ts` | Privacy flags (AC-57) |
| core-web | `src/test/sim-fetch.test.ts` | LIVE passthrough, SIMULATED responses, RBAC 403/202, foreign URL blocked (AC-58) |
| core-web | `src/test/evidence-table.test.tsx` | Filters and pagination (AC-64) |
| core-web | `src/test/reduced-motion.test.tsx` | Loops static under reduced motion (AC-70) |

### 14.14 Acceptance criteria for the web build (AC-48 … AC-75)

These map to SC3 (web app), SC7, and the scope decisions D18, D25 and D26.

| AC | Check (command-level) | Pass condition | Maps to |
|---|---|---|---|
| AC-48 | `npm run test -w @dems/core-web -- src/test/routes.test.tsx` | 12 routes (`/login`, `/dashboard`, `/session`, `/session/new`, `/evidence`, `/evidence/$id`, `/devices`, `/storage`, `/network-time`, `/security-audit`, `/system`, `/developer/api`) render their `page-<id>` test ID with a signed-in operator | SC3, D18, D25, D26 |
| AC-49 | Same file | Unauthenticated `/dashboard` redirects to `/login?redirect=%2Fdashboard`; after sign-in it lands on `/dashboard` | D25 |
| AC-50 | `npm run test -w @dems/shared -- test/auth.test.ts` | 5 bad attempts in 5 min → LOCKED for 60 s (even correct credentials are rejected); success after 60 s of sim time. Audit: 5 AUTH_FAILED, 1 AUTH_LOCKED, 1 AUTH_SUCCESS; no password in any event | D25, §20.1 |
| AC-51 | `… test/sim-determinism.test.ts` | Two runs with `{seed: 20261001, scenario: 'recording'}` over 600 ticks are deep-equal (events, audit, chain head) | D19, D28/Q7 |
| AC-52 | `… test/session-machine.test.ts` | Every row in the §14.7 table passes; illegal transitions throw; a second `createSession` while active is refused | §6.2, S26 |
| AC-53 | `… test/audio.test.ts` | 20 frames/s; levels in [−90, 0]; the peak holds 1.5 s then decays at 20 dB/s; the CLIP latch persists until reset | 01 S3, G5 |
| AC-54 | `… test/storage-math.test.ts` | At load, used = 804 GB = **20%**; estimated remaining = free ÷ 8.2 GB/h (±1 min) | D28/Q1, 04 §9 #17 |
| AC-55 | `… test/hash-chain.test.ts` | `verify()` PASS on the pristine chain; after `inject('AUDIT_TAMPER')` it reports FAIL at the tampered index | EVT-13/14/30 |
| AC-56 | `… test/openapi.test.ts`; `git diff --exit-code packages/shared/openapi/` | `@scalar/openapi-parser` reports valid; `openapi: "3.1.0"`; 10 operations; health has `x-badges` LIVE and 9 have SIMULATED; no drift | D26 |
| AC-57 | `npm run test -w @dems/core-web -- src/test/scalar-config.test.ts`; then in the browser at `/developer/api`: `performance.getEntriesByType('resource').map(e => new URL(e.name).host)` | Config has `telemetry: false`, `withDefaultFonts: false`, `showDeveloperTools: 'never'`, `agent.disabled`, `mcp.disabled`, and no `proxyUrl`. **Every** resource host is `127.0.0.1:5173` or `127.0.0.1:4400` | D26, NFR1 |
| AC-58 | `… src/test/sim-fetch.test.ts`; browser try-it on health and on `GET /api/v1/session/current` | Health: 200 from mock-core. Session: 200 with `x-dems-simulated: 1` and the sim body. Export as INVESTIGATOR: 403 plus audit; as SUPERVISOR: 202. A foreign URL is rejected | D26, S20 |
| AC-59 | Browser at 1920×1080, 1440×900, 1200×800, 900×800: `document.querySelector('nav[aria-label=Primary]').getBoundingClientRect().width` and the top-bar height | 232/80, 216/72, 72/72, Drawer (0)/64 | 04 §2.4-§2.5 |
| AC-60 | Dashboard at 1920×1080 | Panels A-J present (`data-testid`); `main.scrollHeight <= main.clientHeight` (no scroll); row heights within ±8 px of 340/256/180/148 | D18 |
| AC-61 | Session Monitor, `recording` scenario, 1920×1080 | Panels K-T present; the timer advances 1/s; with `?debug=1` the meter frame counter shows ≥ 15 updates/s per channel | D18, S3 |
| AC-62 | Browser: `/session/new` steps 1 → 2 → 3 → Start | Step 2 resolves 8 checks within 5 s; Start lands on `/session` with REC showing and sim state RECORDING; audit contains SESSION_CREATED, PRECHECK_PASSED, RECORDING_STARTED | 04 §5.7 |
| AC-63 | End Session with a reason | FINALIZING → SEALED within 10 s; a new `EV-…` row with a **violet Sealed** Chip in `/evidence`; the detail Integrity tab Verify gives PASS | §12.2, D28/Q4 |
| AC-64 | `… src/test/evidence-table.test.tsx` | Status filter Sealed shows only sealed rows; pagination 10/page; search matches ID, case and subject | 04 §5.1 |
| AC-65 | Demo Control Panel: "MIC 2 clip", then "Storage full" | MIC 2 CLIP latch on SM and Devices, a warning toast, audit AUDIO_CLIP. Then StorageState FULL, the ring turns red, and Start Session step 2 shows BLOCK | EVT-07/08, §6.4 |
| AC-66 | Route tests with an i18next `missingKey` handler | 0 missing keys | D28/Q3 |
| AC-67 | `grep -E 'hero' THIRD_PARTY_NOTICES.md`; `sips -g pixelWidth apps/core-web/src/assets/hero/*` | The hero row names source URL, author, licence (Pexels or Unsplash) and date; width ≥ 2560 (or the procedural fallback is recorded instead); no MB 1 derivative anywhere | D28, §14.10 |
| AC-68 | `grep -oE 'id="emblem-(shield\|arc-[1-6])"' apps/core-web/src/assets/brand/emblem.svg \| wc -l`; `test -f apps/core-web/public/favicon.svg` | `7`; exit 0 | §14.10 |
| AC-69 | `… test/contrast.test.ts` | Every §2.7 text pair meets its listed ratio (±0.05) | §2.7 |
| AC-70 | `… src/test/reduced-motion.test.tsx`; browser with "Emulate prefers-reduced-motion: reduce" | Ring rotation, Ken Burns, topographic drift and particles render with `data-motion="reduced"`; the Login hand-off becomes a cross-fade | Motion spec §8 |
| AC-71 | Chrome, SM `recording` scenario, 30 s, `?debug=1` overlay and a `PerformanceObserver('longtask')` | Average ≥ 55 fps after the first 2 s; ≤ 3 long tasks over 50 ms | Motion spec §9 |
| AC-72 | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src` | No matches: layout properties are never animated (motion spec §9) | Motion spec §9 |
| AC-73 | `npm run build -w @dems/core-web`; `grep -l "scalar" apps/core-web/dist/assets/index-*.js` | No match in the entry chunk (Scalar only in the lazy `/developer/api` chunk); entry chunk gzip ≤ 450 KB (`gzip -9c … \| wc -c`) | §14.9 |
| AC-74 | Browser, `recording` scenario | The same Session ID, case and investigator appear on Dashboard D, SM M and Evidence; every timestamp shows UTC+07:00 | D28/Q2, Q7 |
| AC-75 | Dashboard F and Storage | The ring shows **20%** labelled USED, with "3.2 TB free of 4.0 TB" | D28/Q1 |

### 14.15 Files added by the page rows (summary)

- **`packages/shared/src/`:** `sim/*` (§14.7), `i18n/en.ts`, `api/openapi.ts`, `api/session-schema.ts`.
- **`packages/shared/scripts/`:** `gen-theme.ts` (adds `theme/scalar.css`), `gen-openapi.ts`, `gen-topo.ts`.
- **`packages/shared/`:** `openapi/openapi.json`, `test/*` (§14.13).
- **`apps/core-web/src/`:**
  - `routes/**` (§14.2)
  - `features/<page>/**`
  - `components/{composed,shell,media}/**`
  - `components/ui/**` (copied-in MU/MP items listed in §14.5, recorded in `THIRD_PARTY_NOTICES.md`)
  - `assets/{brand,hero}/**`
  - `i18n.ts`
  - `test/**`

### 14.16 Analyst verification (rev 3 additions)

| # | Check | Method | Result |
|---|---|---|---|
| V40 | Rendered surfaces and text on D1 and SM | Pillow 12.3.0, local (median of the darker half of empty panel regions; row scans across edges) | Panel fill `#1B1108`, `#170F07`, `#1A1109`, `#160F07`, `#1A1108`, `#170F07` (median ≈ `#191008`); inset tile `#150E07`; panel edge `#563218`–`#643F22` (hue ≈25°) over the fill (bronze ≈ 33-49%); active nav gradient `#6A3916` → `#573520`; heading text `#FCFCFC`; secondary text `#D0CCC8`–`#E4D8D0`; hero paragraph `#BCB0AC`; meter lit bars lime ≈`#90E050` (the palette green is used instead) |
| V41 | Renderer evidence | `npm view` / `npm pack` of `@scalar/api-reference-react@0.9.76`, `@scalar/api-reference@1.72.3`, `@scalar/types@0.22.3`, `@scalar/themes@0.18.1`, `@scalar/helpers@0.16.0`, `@scalar/api-client@3.21.3`, `swagger-ui-react@5.33.0`, `swagger-ui-dist@5.33.0`, `@scarf/scarf`; greps as quoted in §14.9 | As in the §14.9 table. Key lines: `telemetry: z.boolean().optional().default(true)`; `withDefaultFonts: z.boolean().optional().default(true)`; `showDeveloperTools … default('localhost')`; `shouldUseProxy` returns false for local URLs; the PostHog plugin is opt-in; `customFetch`; `x-badges`; Swagger `validatorUrl:"https://validator.swagger.io/validator"`; `@scarf/scarf` postinstall `node ./report.js` |
| V42 | Store, hash, i18n and parser packages | `npm view` / `npm pack` | `zustand` 5.0.15 MIT, 0.1 MiB, peers optional (`react`, `immer`, `use-sync-external-store`); exports `createStore` (vanilla), `useStore`, `subscribeWithSelector`, `useShallow`. `xstate` 5.33.2 (2.2 MiB). `@xstate/store` 4.2.3. `jotai` 3.0.1 (peer react). `@noble/hashes` 2.4.0 MIT, `./sha2.js` exports `sha256`. `i18next` 26.4.2, `react-i18next` 17.0.15. `@scalar/openapi-parser` 0.29.9 MIT |
| V43 | Magic UI and Motion Primitives items named in §14 | Registry JSON (`magicui.design/registry.json`, `/r/<item>.json`; `motion-primitives.com/c/<item>.json`) | MU present: number-ticker, animated-list, ripple, shimmer-button, shine-border, animated-circular-progress-bar, particles, orbiting-circles, border-beam, animated-beam, blur-fade. Deps: `motion` only, or none. `cssVars` are theme keyframes only (`animate-ripple`, `animate-orbit`, `animate-shimmer-slide`, `animate-spin-around`, `shine`), with no colour-variable collision. MP items (text-effect, text-scramble, text-shimmer, animated-number, transition-panel, animated-background, border-trail, spotlight, glow-effect, sliding-number) depend only on `motion` and have 0 cssVars |
| V44 | Stock-photo licences | WebFetch `unsplash.com/license`, `pexels.com/license/` | As quoted in §14.10 |
| V45 | Row 8-10 results | `initialization/03_jdk_install.md`, `04_android_sdk_install.md`, `05_avds.md` | JDK 17.0.20.1 PASS (23 formulae, 502.6 MiB); SDK PASS (8.4 GB; sdkmanager is an Android CLI shim with `/` IDs and `--no-metrics`); AVDs `dems_tablet` (25 s boot) and `dems_phone` (22 s); emulator listeners loopback only |
| V46 | Contrast on warm surfaces | Node WCAG script | As in §2.7 rev 3 (every text tone ≥ 6.59 on panel, inset and tertiary; danger-500 4.99) |


---
*Generated: 2026-09-30 23:41 WIB*
*Last Updated: 2026-10-01 00:39 WIB (rev 3: D17-D28 applied; §13 resolved; §14 web application; tokens rev 3)*
