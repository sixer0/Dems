---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: data-analyst
type: mobile-specification
narrative_tier: 1
decisions_applied: D6, D10, D16, D17, D19, D20, D23, D24, D28, D30, D31, D33, D34, D35
based_on:
  - /Users/gsp-budi/Documents/DEMS/ui_design/DEMS-Mobile.png (10 phone screens; viewed directly and as 3x crops)
  - /Users/gsp-budi/Documents/DEMS/ui_design/DEMS-DesignSystem.png, DEMS-AssetSample.png
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/research/04_ui_design_analysis.md (§1, §4, §6, §7, §9)
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/research/01_explore.md (§5.1-§5.6, tablet screen inventory T1-T16)
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/01_specs.md (rev 3: §1.4, §2, §5, §6, §8, §14.7, §14.8)
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/03_motion_spec.md (whole; Appendix A)
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/02_plan.md (§4 W-01..W-05)
companion: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/05_mobile_plan.md
status: complete (pending the Mobile Approval Gate, D33)
last_updated: 2026-10-01 01:15 WIB
---

# Mobile App Specification: DEMS Tablet/Phone Operator App (D33)

## 0. Scope, sources and conventions

### 0.1 5W1H

| Dimension | Content |
|---|---|
| **What** | The full specification of the `apps/mobile` operator app (Expo SDK 57, React Native 0.86.3): screen inventory, responsive layout for phone and tablet, navigation, per-screen composition, data, auth, motion, assets, i18n, tests and acceptance criteria MA-01..MA-30. It covers every §5.1 module of the design book (01 L55-L71) and all 10 screens of `DEMS-Mobile.png` |
| **Who** | Author: data-analyst. Owner: the user (demo owner). Implementers: `coder-execution` (M-rows in `05_mobile_plan.md`), `test-expert`, `verifier`, `security-review`, `senior-code-reviewer`. Shared prerequisites are owned by the web rows W-01..W-05 (`02_plan.md` §4); the mobile app never edits `packages/shared/src/sim` (W-02 owns it) |
| **When** | Written 2026-10-01. The build starts after the **Mobile Approval Gate** (D33). Under D34 it runs **in parallel** with the web build, in shared waves (plan §3) |
| **Where** | Code in `/Users/gsp-budi/Documents/DEMS/apps/mobile/`. Runs on AVDs `dems_phone` (1080x2424 @ 420 dpi) and `dems_tablet` (2560x1600 @ 320 dpi) (D23, 01S §6.3) |
| **Why** | D33 asks for the mobile spec and plan now. D17 fixes the target (phone portrait per the mockups plus tablet multi-pane, orientation unlocked). D20 deferred the screens until the web was specified; this file closes that gap so the mobile build can start on approval |
| **How** | (1) The designer's mockup was read directly and as 3x crops (§0.3). (2) The design-book digest (01 §5) supplied the modules, flow, gate and recording-screen content. (3) The web spec supplied tokens, simulator, auth and copy conventions, which are reused, not redefined. (4) Every kit, library and platform claim was checked against the pinned packages (§0.4, VM-01..VM-22). (5) Anything not proven is labelled **hypothesis** with a deterministic fallback |

### 0.2 Evidence conventions

| Code | Meaning |
|---|---|
| `MB n (x1–x2, y1–y2)` | Screen n of `ui_design/DEMS-Mobile.png` (1536x1024), native-pixel region read by eye from 3x crops (±10 px). Screen boxes follow 04 §6: MB 1 (42–308, 8–545), MB 2 (338–606, 8–545), MB 3 (634–903, 8–545), MB 4 (932–1200, 8–545), MB 5 (1228–1497, 8–545), MB 6 (44–312, 580–1003), MB 7 (338–608, 580–1003), MB 8 (632–905, 580–1003), MB 9 (932–1200, 580–1003), MB 10 (1228–1497, 580–1003) |
| `DS §nn`, `AS #nn` | Design-system sheet section / AssetSample component number (04 §4) |
| `01 …`, `04 …` | `research/01_explore.md`, `research/04_ui_design_analysis.md` |
| `01S §…`, `02P §…`, `03M …` | `masterplan/01_specs.md` rev 3, `masterplan/02_plan.md`, `masterplan/03_motion_spec.md` (IDs M-APP, M-SH, M-C, M-PG) |
| `VM-nn` | This file's verification log (§0.4) |
| `SCR-nn` | Shared-contract request to the controller (§13) |
| `MA-nn` | Mobile acceptance criterion (§11) |
| **hypothesis** | Not yet proven; each carries a fallback (§14) |

**Pins are not changed.** Every package version in 01S §1.4 `@dems/mobile` stays as pinned. §8.4 lists four **additive** packages; per D35 they are installed only by the single mobile dependency row (plan M-01), and only if row 18/D30 has not already installed them.

### 0.3 How the mockup was read

- `DEMS-Mobile.png` was opened with the Read tool at native size, then cropped per screen with Python Pillow 12.3.0 (local, no upload) into 3x images in `$TMPDIR/mob/s1.png … s10.png` and read one by one.
- `DEMS-DesignSystem.png` and `DEMS-AssetSample.png` were read at native size for component vocabulary (buttons, chips, cards, meters, alerts).
- The status bar in every phone frame reads "9:41" (iOS convention); it is ignored (04 §9 #30).

### 0.4 Analyst verification log (VM)

| # | Check | Method (read-only) | Result |
|---|---|---|---|
| VM-01 | HeroUI Native component inventory | Read `heroui-native@1.0.10` (the pinned version) unpacked earlier in this session's scratchpad `tar/hn/package`: `lib/typescript/src/index.d.ts` and `components/*` | 43 component folders: accordion, alert, avatar, bottom-sheet, button, card, checkbox, chip, close-button, control-field, description, dialog, field-error, glass-view, input, input-group, input-otp, label, link-button, list-group, menu, popover, pressable-feedback, radio, radio-group, scroll-shadow, search-field, select, separator, skeleton, skeleton-group, slider, spinner, sub-menu, surface, switch, tabs, tag-group, text, text-area, text-field, theme-background, toast. **No** progress, stepper, timeline, chart, navbar or tab-bar component. The installed copy is being added by row 18 (not present in `node_modules` at 01:05 WIB); plan M-01 re-checks the installed version |
| VM-02 | HeroUI Native peers and licence | `package.json` of the same tarball | Apache-2.0. Peers: `@gorhom/bottom-sheet ^5.2.9` (optional), `expo-blur >=14` (optional), `react-native-reanimated ^4.1.1`, `react-native-worklets >=0.5.1`, `react-native-svg ^15.12.1`, `react-native-gesture-handler ^2.28.0`, `react-native-safe-area-context ^5.6.0`, `react-native-screens >=4` (optional), `tailwind-variants ^3.2.2`, `tailwind-merge ^3.4.0`, `react >=19`, `react-native >=0.81`. All satisfied by 01S §1.4 |
| VM-03 | HeroUI Native compound parts and variants | `components/*/*.d.ts`, `*.types.d.ts` | `Tabs`: List, ListBackground, ScrollView, Trigger, Label, Indicator, Separator, Content; `variant` primary\|secondary. `ListGroup`: Item, ItemPrefix, ItemContent, ItemTitle, ItemDescription, ItemSuffix. `Select`: Trigger, Value, Portal, Overlay, Content, Item, ItemLabel, ItemIndicator, ListLabel, Close; presentations popover\|bottom-sheet\|dialog. `Menu`: presentation popover\|bottom-sheet. `BottomSheet`, `Dialog`, `Popover`: Trigger, Portal, Overlay, Content, Close, Title, Description. `TagGroup`: `selectionMode`, `selectedKeys`, `onSelectionChange`; variant default\|surface. `SearchField`: Group, SearchIcon, Input, ClearButton. `Alert`: `status` default\|accent\|success\|warning\|danger. `Toast`: variant default\|accent\|success\|warning\|danger; placement top\|bottom. `Button`: variant primary\|secondary\|tertiary\|outline\|ghost\|danger\|danger-soft, size sm\|md\|lg, `isIconOnly`, `feedbackVariant` scale-highlight\|scale-ripple\|scale\|none. `Chip`: variant primary\|secondary\|tertiary\|soft. `Surface`: variant default\|secondary\|tertiary\|transparent. `Skeleton`: shimmer\|pulse\|none. `Switch`: `isSelected`. `InputOTP`, `Slider`, `Avatar` (Image, Fallback), `Accordion` (variant default\|surface) exist |
| VM-04 | Kit behaviour under reduced motion; Android blur | `lib/module/providers/animation-settings/provider.js`; `bottom-sheet.types.d.ts` L126 | The kit calls Reanimated `useReducedMotion()` and disables **all** kit animations when it is true or when `config.animation = 'disable-all'`. The BottomSheet `blur` overlay is "iOS only, requires expo-blur; falls back to `default` otherwise" |
| VM-05 | Reanimated 4.5.1 API and shared-element status | Scratchpad `x_react-native-reanimated-4.5.1`: `lib/typescript/index.d.ts`; `lib/module/featureFlags/staticFlags.json` L10; `src/hook/useReducedMotion.ts`; `android/.../NativeProxy.kt` L329 | Exports include `useReducedMotion`, `ReducedMotionConfig`, `ReduceMotion`, `LinearTransition`, `FadeInDown`, `FadeOutUp`, `ZoomIn`, `Keyframe`, `useAnimatedProps`, `useAnimatedReaction`, `useDerivedValue`, `useFrameCallback`, `withRepeat`, `withSequence`, `withSpring`, `withTiming`, `interpolateColor`, `runOnUI`, `SharedTransition`, `SharedTransitionBoundary`. **`ENABLE_SHARED_ELEMENT_TRANSITIONS: false`** (static flag). `useReducedMotion()` returns the value **read at app start** and "doesn't cause your components to rerender"; on Android it reads `Settings.Global.TRANSITION_ANIMATION_SCALE` |
| VM-06 | RN 0.86.3 reduce-motion and testID on Android | Scratchpad `rn/package/ReactAndroid`: `AccessibilityInfoModule.kt` L49-L57, L101-L106; `ReactAccessibilityDelegate.kt` L168-L175 | `AccessibilityInfo.isReduceMotionEnabled` = `TRANSITION_ANIMATION_SCALE == 0`, observed live through a ContentObserver. `testID` is exposed as the accessibility node's **resource-id** ("Black-box E2E/UI testing frameworks … do not have access to view tags"), so `uiautomator dump` and Maestro can find it |
| VM-07 | Skia 2.6.2 exports | Scratchpad `x_shopify-react-native-skia-2.6.2/package/lib/typescript` | `Canvas`, `Path`, `Group`, `RoundedRect`, `Rect`, `Circle`, `Line`, `Points`, `BlurMask`, `SweepGradient`, `LinearGradient`, `RadialGradient`, `Image`, `useImage`, `FractalNoise`, `Turbulence`, `RuntimeShader`, `Shader`, `Atlas`, `Text`, `Paragraph`, `matchFont`, `useFont`, `Mask`, `DashPathEffect`, `ColorMatrix`, `DisplacementMap`, `Fill` all exported |
| VM-08 | Expo Router 57.0.24 | `npm pack expo-router@57.0.24` into `$TMPDIR/er` | Headless tabs in `expo-router/ui`: `Tabs` (prop `backBehavior`), `TabList`, `TabTrigger` (`name`, `href`, `resetOnFocus`), `TabSlot`. `Stack.Protected` / `Tabs.Protected` with `{ guard: boolean }` (`build/views/Protected.d.ts`). `expo-router/testing-library` exports `renderRouter` (peer `@testing-library/react-native >= 13.2.0`). `usePreventRemove` is exported through `expo-router/react-navigation`. `expo-router/unstable-split-view` is **iOS only**: on Android it warns and "will behave like a Slot navigator" (`build/split-view/split-view.js` L52-L55) |
| VM-09 | Expo SDK 57 bundled versions for additive packages | `expo@57.0.26` `bundledNativeModules.json` (scratchpad copy diffed identical to a fresh extract) | `expo-local-authentication ~57.0.3`, `@react-native-async-storage/async-storage 2.2.0`, `react-native-keyboard-controller 1.21.9`, `expo-secure-store ~57.0.4`, `expo-sqlite ~57.0.3`, `expo-screen-orientation ~57.0.2`, `expo-navigation-bar ~57.0.3`, `lottie-react-native ~7.3.8`. `react-native-mmkv` is **not** in the list |
| VM-10 | npm registry: additive packages and peers | `npm view <pkg>@<ver> … --json` | `expo-local-authentication@57.0.3` MIT, peer `expo *`. `@react-native-async-storage/async-storage@2.2.0` MIT, peer `react-native ^0.0.0-0 \|\| >=0.65 <1.0`, has `codegenConfig` (TurboModule). `react-native-keyboard-controller@1.21.9` MIT, peer `react-native-reanimated >=3.0.0`. `zustand@5.0.15` MIT, all peers optional. `i18next@26.4.2` MIT. `react-i18next@17.0.15` MIT, peers `react >=16.8.0`, `i18next >=26.2.0`, `typescript ^5\|\|^6\|\|^7`, `react-native` optional |
| VM-11 | Peers of already-pinned mobile libraries | `npm view … peerDependencies --json` | `victory-native@42.0.1`: Skia `>=2.6.0 <3.0.0`, Reanimated `>=3.19.1`, RNGH `>=2.0.0`. `@gorhom/bottom-sheet@5.2.14`: Reanimated `>=3.16.0 \|\| >=4.0.0-`, RNGH `>=2.16.1`. `@shopify/flash-list@2.0.2`: `react`, `react-native`, `@babel/runtime`. `lucide-react-native@1.49.0` (ISC): `react-native-svg ^12\|\|…\|\|^15`. All satisfied |
| VM-12 | victory-native 42.0.1 exports | `npm pack` into `$TMPDIR/vn`, `dist/index.d.ts` | `CartesianChart`, `Line`, `Bar`, `HorizontalBar`, `Area`, `StackedBar`, `PolarChart`, `Pie` (`Pie.Chart` with `innerRadius`, `Pie.Slice` with `animate`), `useChartPressState` |
| VM-13 | expo-local-authentication 57.0.3 API | `npm pack` into `$TMPDIR/ela` | Functions `hasHardwareAsync`, `isEnrolledAsync`, `getEnrolledLevelAsync`, `supportedAuthenticationTypesAsync`, `authenticateAsync`, `cancelAuthenticate`. Options `promptMessage`, `promptSubtitle`, `promptDescription`, `cancelLabel`, `disableDeviceFallback`, `requireConfirmation`, `biometricsSecurityLevel` (`weak`\|`strong`). Errors include `not_enrolled`, `user_cancel`, `lockout`, `not_available`, `passcode_not_set`, `authentication_failed`. The config plugin adds Android `USE_BIOMETRIC` and `USE_FINGERPRINT` |
| VM-14 | expo-blur 57.0.3 on Android | `npm pack` into `$TMPDIR/eb` | Real blur on Android needs `blurMethod: 'dimezisBlurViewSdk31Plus'` (or `'dimezisBlurView'`) plus a `BlurTargetView` ref passed as `blurTarget` ("@platform android") |
| VM-15 | zustand 5.0.15 and @noble/hashes 2.4.0 module formats | Scratchpad `r_zustand-5.0.15`, `r_noble-hashes-2.4.0` package.json | zustand has an explicit **`react-native` export condition** (CJS) for `.` and `./*`, including `vanilla` and `middleware`. `@noble/hashes` is `"type": "module"` (ESM only), so jest needs it in the transform allowlist |
| VM-16 | AsyncStorage jest mock | `npm pack` into `$TMPDIR/as` | `jest/async-storage-mock.js` ships in 2.2.0 |
| VM-17 | Maestro | GitHub API `repos/mobile-dev-inc/maestro/releases/latest`; README; docs; PR #1848; installer script `get.maestro.mobile.dev` | Latest `cli-2.11.0` (2026-09-29). Asset `maestro.zip` 314,886,578 B, sha256 `5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a`; `checksums_sha256.txt` published. Licence Apache-2.0. Requires Java 17+. `maestro test` runs flows on a local emulator; `maestro cloud` is the only command documented as needing an account. Analytics opt-out: `MAESTRO_CLI_NO_ANALYTICS=true` (PR #1848) and `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true`. The **curl installer touches and appends to `~/.zshrc`, `~/.bashrc` and `~/.bash_profile`** (script lines 64-66, 138-155) |
| VM-18 | Host lock primitive for D35 | `command -v flock lockf shlock`; a two-process `lockf` test in `$TMPDIR/lk` | **`flock` is not installed** on this macOS 27.0.1 host. `/usr/bin/lockf` works: `lockf -k -t 0 <file> <cmd>` exits **75** ("already locked") while another holder runs; `-t <secs>` waits, then acquires after release |
| VM-19 | Shared surface the app reuses | `graft callers createHeartbeatClient -d all`; `graft callers formatClock -d all`; `packages/shared/package.json` | `createHeartbeatClient` is called by `HeartbeatProvider` (`heartbeat-context.tsx` L21-L47) and tests; `formatClock` (`realtime/format.ts` L14-L23) is plain arithmetic, used by core-web. `@dems/shared` exports `.`, `./domain`, `./api`, `./realtime`, `./tokens`, `./sim`, theme CSS; **no `./i18n` export yet**. `src/sim/index.ts` is an empty placeholder (W-02 fills it) |
| VM-20 | Tokens already on disk | `packages/shared/src/tokens/tokens.ts` | Rev 3 values are applied (`surface #191008`, `border #FF9F3D59`). `fontFamily.native` lists `Orbitron_700Bold`, `Inter_400Regular…700Bold`, `JetBrainsMono_400Regular/500Medium`. `motion` has durations, easings, springs gentle/snappy/bouncy, choreography, `proofSlowFactor`, ambient `glowBreath`/`recPulse`/`meterFrameMs`. The NEW motion tokens (03M §2.3: `counter`, `meter`, `indicator` springs, distances, ambient periods) are **not** there yet; W-01 adds them |
| VM-21 | Mobile scaffold state | `ls apps/mobile`, `cat apps/mobile/package.json`, `app.json` | Row 18 is in progress: the template is present (`src/app/_layout.tsx`, `src/app/index.tsx`, `src/global.css`); `app.json` still has template values; no `node_modules` for mobile yet. This spec assumes row 18 completes as specified in 01S §5 |
| VM-22 | Screen-density maths | `wm size` / `wm density` values from 01S §6.3 (measured in row 10) | Phone: 1080/2.625 = **411 dp** wide, 2424/2.625 = **923 dp** tall. Tablet: 2560/2.0 = **1280 dp**, 1600/2.0 = **800 dp** |

---

## 1. Screen inventory

### 1.1 The 10 mockup screens → routes

| MB | Mockup screen (caption) | Route (Expo Router URL) | Feature folder | Design-book trace |
|---|---|---|---|---|
| 1 | Login Screen | `/login` | `features/login` | §5.1 #1, §5.2 LOGIN, §20.1 (01 L59, L79, L551-L558) |
| 2 | Dashboard (Mobile) | `/home` (tab **Home**) | `features/dashboard` | §5.1 #2, §5.2 DASHBOARD |
| 3 | Start Session (3 steps) | `/session/new?step=1\|2\|3` | `features/session-new` | §5.1 #3, #4, #7, #8; §5.2 NEW SESSION → START |
| 4 | Session Monitor (Live Recording) | `/session/live` | `features/session-live` | §5.1 #5, #6, #8, #9; §5.4 |
| 5 | Evidence List (Mobile) | `/evidence` (tab **Evidence**) | `features/evidence` | §5.1 #11; §19.1 |
| 6 | Evidence Detail | `/evidence/[evidenceId]` (phone) or the detail pane of `/evidence?selected=` (tablet) | `features/evidence` | §5.1 #11; §11; EVT-13/14 |
| 7 | Devices (Mobile) | `/devices` (tab **Devices**), `/devices/[deviceId]` | `features/devices` | §5.1 #12, #5, #6; §21.2 health |
| 8 | Storage (Mobile) | `/storage` (under **More** on phone; rail item on tablet) | `features/storage` | §5.3 Storage; §10 |
| 9 | Network & Time (Mobile) | `/network-time` (under More / rail) | `features/network-time` | §5.3 Time Sync; §2.2; §21.1 |
| 10 | Settings (Mobile) | `/settings`, `/settings/[section]` (under More / rail) | `features/settings` | §24.1 (About), §20.1 (Security) |

### 1.2 The 13 §5.1 modules → where they live

| # | Module (01 L57-L71) | Mockup coverage | Where it lives in the app |
|---|---|---|---|
| 1 | Authentication & device pairing | MB 1 (credentials, biometric) | `/login` (MB 1 plus derived states) and **`/pair`** (derived pairing screen, §4.2) |
| 2 | Dashboard | MB 2 | `/home` |
| 3 | New Session / Session Preparation | MB 3 step 1 header | `/session/new?step=1`; leaving step 1 calls `createSession()` → CREATE (01S §14.7) |
| 4 | Metadata Entry | MB 3 step 1 form | `/session/new?step=1` form |
| 5 | Camera Preview | MB 4 feed; MB 7 camera rows | `/session/new?step=2` previews; `/session/live` feed; `/devices/[deviceId]` live preview |
| 6 | Dual Audio Level Monitor | MB 4 MIC cards | `/session/live` (MIC cards and the Audio Monitor sheet); `/session/new?step=2`; `/devices/[deviceId]` |
| 7 | Pre-Recording Health Check | **None** (MB 3 shows only the step label "Devices Check") | `/session/new?step=2`: the 8-check gate of §5.3 (derived, §4.4) |
| 8 | Recording Control | MB 3 step 3 label "Ready"; MB 4 "Stop Session" | `/session/new?step=3` (ARMED, Start Recording) and the End Session control on `/session/live` |
| 9 | Live Session Monitor | MB 4 | `/session/live` |
| 10 | Session Finalization Status | **None** | `/session/finalizing` (derived, §4.6) |
| 11 | Authorized Evidence Review | MB 5, MB 6 | `/evidence`, `/evidence/[evidenceId]` (Verify, lifecycle, export) |
| 12 | Device Health & Diagnostics | MB 7 (list only) | `/devices`, `/devices/[deviceId]` (Health tab, Run diagnostics sheet) |
| 13 | Operator Audit View | **None** (MB 10 has "Security & Privacy" only) | `/audit` (derived, §4.16) |

### 1.3 The §5.2 flow (01 L75) → routes and simulator states

| Step | Screen | Route | Simulator `session.state` (01S §14.7) |
|---|---|---|---|
| 1 | LOGIN | `/login` | any (the Core keeps running) |
| 2 | DASHBOARD | `/home` | null or SEALED |
| 3 | NEW SESSION | `/session/new?step=1` | null → CREATE on Next |
| 4 | METADATA | `/session/new?step=1` (same form) | CREATE |
| 5 | PRE-CHECK | `/session/new?step=2` | PRECHECK |
| 6 | START | `/session/new?step=3` | ARMED → RECORDING on Start |
| 7 | RECORDING MONITOR | `/session/live` | RECORDING |
| 8 | STOP | End Session dialog on `/session/live` | RECORDING → STOPPING |
| 9 | FINALIZATION | `/session/finalizing` | STOPPING → FINALIZING |
| 10 | SESSION SUMMARY | `/session/summary/[sessionId]` | SEALED |
| — | Recovery (T16) | `/session/recovery` | FAULT → RECOVERY → null (incomplete) |

### 1.4 Derived screens (no mockup) and how they are derived

Every derived screen uses only the mockup's vocabulary: warm L2 panels with bronze hairlines (01S §2.7 rev 3), Inter headings, gold primary, soft status chips (DS §06), key-value rows (MB 6), grouped list rows with chevrons (MB 7, MB 10) and the numbered stepper (MB 3).

| Derived screen | Route | Source of content | Derived from (design language) |
|---|---|---|---|
| Pairing | `/pair` | §5.1 #1, §20.1 "certificate-bound pairing … preferred" (01 L554) | MB 3 stepper + MB 6 key-values + HeroUI Native `InputOTP` |
| Pre-Recording gate | `/session/new?step=2` | §5.3 (01 L92-L107); policy 01S §14.5.11 | MB 7 grouped rows (icon, title, status chip) + MB 4 meters |
| Ready / Armed | `/session/new?step=3` | §6.2 ARMED (01 L190); web 04 §5.7 step 3 | MB 6 key-values + mini GlowRing (AS #3) |
| Finalization | `/session/finalizing` | §12.2 steps (01S §2.3 `FinalizationStep`) | MB 3 stepper, vertical pipeline variant |
| Session Summary | `/session/summary/[sessionId]` | §5.2 step 10, §11.3 manifest fields | MB 6 hero + key-values + Hash tab |
| Recovery Status | `/session/recovery` | §18.1, §6.4 (01 L535-L548, L210-L216) | DS §10 alert + stepper pipeline |
| Sessions hub | `/sessions`, `/sessions/[sessionId]` | MB tab bar item "Sessions" (MB 2 (350–595, 495–530)) has no screen | MB 5 list rows + MB 2 active-session card |
| More | `/more` (phone only) | MB 8 and MB 10 show **More** highlighted (04 §6) but its root list is not drawn | MB 10 grouped rows |
| Operator Audit View | `/audit` | §5.1 #13, §21.3 AuditEvent (01 L71) | MB 8 activity rows + MB 5 search and filter chips |
| Settings sections | `/settings/[section]` | MB 10 rows | MB 10 rows + DS §05 switches and selects |
| Connection overlay (T15) | global banner | §5.5, §5.6 (01 L131-L149) | DS §10 warning alert |
| Stack check | `/stack-check`, and `/` with `?motion=` | Row 18 proof screen (01S §5.5) | unchanged |

---

## 2. Responsive strategy (D17)

### 2.1 Target windows (VM-22)

| AVD | Physical px | Density | Portrait window (dp) | Landscape window (dp) | Start pose |
|---|---|---|---|---|---|
| `dems_phone` (pixel_10) | 1080x2424 | 420 (2.625x) | **411 x 923** | **923 x 411** | portrait (01S §6.3; not a lock) |
| `dems_tablet` (pixel_tablet) | 2560x1600 | 320 (2.0x) | **800 x 1280** | **1280 x 800** | landscape (not a lock) |

Both AVDs boot with `accelerometer_rotation=1` (coder_execution.md note 8), and `app.json` keeps `orientation: "default"` (01S §5.1, D17).

### 2.2 Layout classes and breakpoints

Computed from `useWindowDimensions()` (window dp, before insets) in `src/layout/use-layout-class.ts`. The class is recomputed on every dimension change, so rotation and split-screen re-lay out live.

| Class | Rule | AVD pose | Navigation chrome |
|---|---|---|---|
| `compact` | W < 600 | phone portrait (411 x 923) | Bottom tab bar, 5 items (MB) |
| `compact-landscape` | W ≥ 600 and H < 480 | phone landscape (923 x 411) | Icon-only rail, 72 dp, 5 items |
| `medium` | 600 ≤ W < 840 and H ≥ 480 | tablet portrait (800 x 1280); tablet split-screen | Rail 88 dp, icon + label, 8 items |
| `expanded` | W ≥ 840 and H ≥ 480 | tablet landscape (1280 x 800) | W ≥ 1200: extended rail 232 dp (icon + label inline, collapsible to 88); else 88 dp rail |

- **Why these numbers.** 600 and 840 are the Android window-size-class boundaries (compact < 600, medium 600–839, expanded ≥ 840; general Android guidance, not fetched in this task, so treated as a convention). The height rule (< 480) keeps a landscape phone out of the tablet layouts: 923 dp is wider than 840, but 411 dp of height cannot hold a multi-pane layout. The 232 dp extended rail mirrors the web sidebar width at 1920 (01S §14.3).
- The row-18 proof screen keeps its own 900 dp two-pane rule (01S §5.5); it is not changed.

### 2.3 Navigation chrome per class

| Element | compact | compact-landscape | medium | expanded |
|---|---|---|---|---|
| Destinations | Home, Sessions, Evidence, Devices, More | same 5 | Home, Sessions, Evidence, Devices, Storage, Network & Time, Audit, Settings (8; "More" dissolves) | same 8 |
| Placement | Bottom, 60 dp + bottom inset (MB 2 tab bar (350–595, 495–530) ≈ 59 dp at 0.596 px/dp) | Start side, after the left inset | Start side | Start side; the topographic texture and the footer "DEMS EDGE CLIENT · v2.4.1" sit at its foot (web parity, 01S §14.4) |
| Active state | Gold icon and label (MB 2); gold pill indicator under the icon (M-MB-01) | Gold icon + inset indicator | Inset rounded card, bronze gradient `#6A3916 → #573520` (01S §14.4, V40), glow e2 | same; collapse toggle persisted in AsyncStorage `dems.mobile.prefs.v1` |
| Header | Per screen (MB): emblem + wordmark on Home; back arrow + title elsewhere; bell and avatar on Home | Condensed 48 dp header | 64 dp header in the content column: title (Inter SemiBold 20), status chips right | same, plus the Core link chip and the clock (RollingNumber) |
| Live mini-bar (recording, outside the monitor) | Above the tab bar | Top of content | Top of the rail content column | Top of content |

**Flow screens** (`/session/*`) hide the tab bar and rail on every class. They are a focused, full-screen stack (§5.4 "recording screen"; 01 L109-L129).

### 2.4 Pane rules per screen

| Screen | compact (phone portrait = the mockup) | compact-landscape | medium (tablet portrait) | expanded (tablet landscape) |
|---|---|---|---|---|
| Login | MB 1: full-bleed backdrop, centred stack | Brand 40% (ring 160 dp) \| auth card 60%, scrollable | Brand band 360 dp above the card (web 768–1023 rule, 01S §14.8) | Split 7 \| 5 (web ≥ 1280 rule): brand side with a 340 dp ring \| auth card 440 dp |
| Home | MB 2 single column | 2 columns: status, tiles, actions \| recent sessions | 2 columns (5 \| 3 of 8): GlowRing hero + status + tiles \| quick actions + recent | 3 zones: GlowRing hero + status \| device tiles 2x2 with live meters and feed thumbnails \| recent sessions + quick actions |
| Start Session | MB 3: horizontal stepper, one step at a time | Stepper on top; form in 2 columns | Vertical stepper 240 dp \| step content | Vertical stepper \| step content \| (step 2) both camera previews and both meters side by side |
| Session Monitor | MB 4 stack: REC row, feed 16:9, MIC cards 2-up, 4 action tiles, End Session | Feed left (height-bound 16:9) \| column: timer, meters, 2x2 actions, End Session | Feed full width (≈ 450 dp tall), then 2 columns: meters \| §5.4 status list + timeline; End Session pinned bottom | 3 columns: feed 58% with track chips \| timer + 2 meters + §5.4 status \| timeline + actions; End Session pinned bottom-right (04 §6) |
| Finalizing, Summary, Recovery | Centred card | Centred card, 560 dp max | Card 640 dp max | Card 720 dp + side summary |
| Evidence | MB 5 list → push MB 6 detail | List (2-column cards) → push detail (hero 40% \| tabs 60%) | List 360 dp \| detail pane | List 40% \| detail 60% |
| Devices | MB 7 list → push device detail | 2 columns → push | List 360 dp \| device detail (live preview or large meter) | List 40% \| detail 60% |
| Storage | MB 8 | Ring card \| activity | Ring + legend, then KPIs and activity in 2 columns | Ring \| KPIs + charts \| activity |
| Network & Time | MB 9 | Network \| time | System time hero on top, then Network \| Time | System time \| Network \| Time hierarchy with GNSS orbit |
| Settings | MB 10 list → push section | List → push | Categories 320 dp \| section pane | same |
| Sessions, Audit | List → push | List → push | List \| detail pane | Filters \| list \| detail |

### 2.5 Rotation behaviour

1. **Unlocked on both AVDs** (D17). No `screenOrientation` in the manifest (AC-25 stays valid).
2. **State survives rotation.** Android recreates nothing at the JS level: navigation state lives in the router, simulator state in the zustand store, and screen-local state in React. The chrome switch (bottom bar ↔ rail) happens inside **one** headless `Tabs` navigator by rendering a different `TabList`, so the navigator state is untouched (VM-08).
3. **Evidence and Devices master-detail.** One route, `/evidence`, holds the selection in the search param `selected`. On compact, selecting pushes `/evidence/[evidenceId]`. On medium or expanded, `/evidence/[evidenceId]` (for example from a deep link) replaces itself with `/evidence?selected=<id>`. If a tablet in split-screen shrinks to compact while a detail pane is open, the detail is shown full-screen and Back returns to the list.
4. **Recording continues through rotation.** Meters and timers are driven by the simulator and UI-thread shared values; the keep-awake tag stays active (§6.6).
5. **Motion.** Pane containers take `layout={LinearTransition.springify().stiffness(170).damping(26).mass(1)}` so they re-flow smoothly (M-MB-03). The system's own rotation animation is left alone.
6. **Proof.** MA-13 rotates each AVD with `adb emu rotate` and checks frame size, chrome and preserved state.

### 2.6 Safe areas, system bars and keyboard

- **Edge-to-edge.** The app targets SDK 36 (01S §5.7), where Android draws behind the system bars. Every screen root uses `react-native-safe-area-context` (~5.7.0, pinned): top inset under the header, bottom inset under the tab bar or the pinned End Session button, left and right insets in landscape (the phone's camera cutout).
- **System bars.** `expo-status-bar` light content on the `#0B0D0F` canvas; `expo-system-ui` background `#0B0D0F` (01S §5.1). No `expo-navigation-bar` dependency.
- **Keyboard.** Under edge-to-edge the window no longer resizes for the IME (hypothesis H-MB-06, based on Android 15+ behaviour). Forms use `KeyboardAwareScrollView` from **`react-native-keyboard-controller` 1.21.9** (Expo-bundled, VM-09; MIT, VM-10) with its `KeyboardProvider` at the root. **Fallback:** React Native's `KeyboardAvoidingView` with `behavior="height"`.
- **Touch targets** are at least 48 dp. Icon-only buttons use `Button isIconOnly size="lg"`.
- **Font scaling:** `HeroUINativeProvider config={{ textProps: { maxFontSizeMultiplier: 1.2 } }}` (01S §5.4) keeps layouts stable at large system font sizes.

---

## 3. Navigation (Expo Router 57)

### 3.1 File tree (`apps/mobile/src/app/`)

```
_layout.tsx                    root: fonts, splash, <AppProviders>, root Stack with Protected groups
index.tsx                      boot router: ?motion= → row-18 proof screen (AC-31); else <Redirect> to the resync target, /home or /login
stack-check.tsx                row-18 proof screen (public), same component as index?motion=
pair.tsx                       pairing (derived; public, so it is reachable both from Login and from Settings → Security)
+not-found.tsx
(auth)/_layout.tsx             Stack, headerShown false, animation 'fade'
(auth)/login.tsx               MB 1
(app)/_layout.tsx              Stack: (tabs) + session flow; mounts <SessionRouteSync/>, <KeepAwakeController/>, <ConnectionBanner/>, <IdleLock/>
(app)/(tabs)/_layout.tsx       expo-router/ui <Tabs backBehavior="history"> + <ResponsiveTabList/> (bottom bar | rail) + <TabSlot/>
(app)/(tabs)/home.tsx          MB 2
(app)/(tabs)/sessions/_layout.tsx, index.tsx, [sessionId].tsx
(app)/(tabs)/evidence/_layout.tsx, index.tsx, [evidenceId].tsx          MB 5, MB 6
(app)/(tabs)/devices/_layout.tsx, index.tsx, [deviceId].tsx             MB 7
(app)/(tabs)/storage.tsx       MB 8
(app)/(tabs)/network-time.tsx  MB 9
(app)/(tabs)/audit.tsx         module 13
(app)/(tabs)/settings/_layout.tsx, index.tsx, [section].tsx             MB 10
(app)/(tabs)/more.tsx          phone More list
(app)/session/_layout.tsx      Stack, animation 'fade_from_bottom', gestureEnabled false while a session is active
(app)/session/new.tsx          MB 3 (?step=1|2|3)
(app)/session/live.tsx         MB 4
(app)/session/finalizing.tsx   module 10
(app)/session/summary/[sessionId].tsx
(app)/session/recovery.tsx
```

**Rules:**
- Route files contain only the route export, `useLocalSearchParams` parsing (zod) and the screen import from `src/features/<folder>/`. Screen rows edit feature folders only, never route files (plan M-03 owns `src/app/**`).
- The row-18 files are **edited, not renamed or deleted**: `src/app/_layout.tsx` gets the new provider tree, and `src/app/index.tsx` becomes the boot router that still renders the proof screen for `?motion=` (so AC-31 and M-PX-02, `demsdemo://?motion=slow`, keep working unchanged). The proof component stays at `src/features/home/home-screen.tsx`, which keeps test N-1 and the AC-31 greps valid. The Dashboard therefore lives in `features/dashboard`, not `features/home`.
- `storage`, `network-time`, `audit` and `settings` are real tabs with **hidden** triggers on compact (hypothesis H-MB-01: a `TabTrigger` can be rendered hidden; fallback: `router.push` from More into those tab routes). This keeps URLs identical on phone and tablet. The bottom bar highlights **More** when the active route is one of them, which is exactly what MB 8 and MB 10 show.

### 3.2 Root layout and providers

`src/providers/app-providers.tsx`, outermost first:

1. `GestureHandlerRootView style={{ flex: 1 }}`
2. `KeyboardProvider` (react-native-keyboard-controller)
3. `SafeAreaProvider`
4. `QueryClientProvider` (health query, as row 18)
5. `I18nextProvider` (§9)
6. `MotionPolicyProvider`, which renders `<ReducedMotionConfig mode={…}>` (§7.7)
7. `HeroUINativeProvider config={{ textProps: { maxFontSizeMultiplier: 1.2 }, animation: reduced ? 'disable-all' : undefined, toast: { … placement 'top' } }}` (VM-03, VM-04)
8. `HeartbeatProvider` (shared, 01S §2.6)
9. `SimRuntimeProvider` (shared `SimProvider` fed by the mobile adapters, §5.2)
10. `AuthProvider` (a thin adapter over the simulator's `auth.ts`, §6)

The root layout keeps row 18's font loading (`Orbitron_700Bold`, `Inter_400/500/600/700`, `JetBrainsMono_400/500`) and holds the native splash until fonts **and** simulator hydration are ready (maximum 2 s, then a Skeleton boot screen).

### 3.3 Auth guard

```tsx
// src/app/_layout.tsx (sketch)
<Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#0B0D0F' } }}>
  <Stack.Screen name="index" />
  <Stack.Screen name="stack-check" />
  <Stack.Screen name="pair" />
  <Stack.Protected guard={!isAuthenticated}><Stack.Screen name="(auth)" /></Stack.Protected>
  <Stack.Protected guard={isAuthenticated}><Stack.Screen name="(app)" /></Stack.Protected>
</Stack>
```

- `Stack.Protected` is verified in Expo Router 57.0.24 (VM-08).
- An unauthenticated visit to any `(app)` URL lands on `/login`. The requested href is kept in memory as `pendingHref` (never persisted, never logged).
- **After sign-in the target is chosen in this order:** (1) the resync target (§3.7), (2) `pendingHref`, (3) `/home`.
- Sign-out, idle expiry (15 min, 01S §14.8) and Lock console set `isAuthenticated=false`. The guard then removes the `(app)` screens and lands on `/login` with the matching Alert. **Recording is never touched by sign-out** (§5.6 "Core recording continues").

### 3.4 Tabs and rail

- The navigator is `expo-router/ui` `Tabs` with `backBehavior="history"` (VM-08). Back from Storage therefore returns to More on the phone.
- `ResponsiveTabList` renders either `BottomTabBar` or `NavRail` according to the layout class (§2.2). Both are made of `TabTrigger asChild` wrapping HeroUI Native `PressableFeedback`, `Text` and Lucide icons, plus a Reanimated indicator (composition C-5, §4.0).
- Tab switches fire `Haptics.selectionAsync()` (§7.6).

### 3.5 Deep links (scheme `demsdemo`, 01S §0)

| URL | Opens | Auth |
|---|---|---|
| `demsdemo://?motion=slow` | Row-18 proof screen in slow mode (M-PX-02, AC-31) | public |
| `demsdemo:///stack-check` | Proof screen | public |
| `demsdemo:///login` | Login | public |
| `demsdemo:///pair` | Pairing | public |
| `demsdemo:///home` | Home | guarded |
| `demsdemo:///sessions`, `…/sessions/<id>` | Sessions hub, session summary | guarded |
| `demsdemo:///session/new?step=1` | Start Session | guarded; refused (toast) if a session is active |
| `demsdemo:///session/live` | Session Monitor | guarded; redirects to `/home` if nothing is recording |
| `demsdemo:///evidence`, `…/evidence/<id>`, `…/evidence?selected=<id>` | Evidence | guarded |
| `demsdemo:///devices`, `…/devices/<id>` | Devices | guarded |
| `demsdemo:///storage`, `…/network-time`, `…/audit`, `…/settings`, `…/settings/<section>` | More destinations | guarded |
| Any guarded URL + `&scenario=recording` | Loads the simulator scenario first (**debug builds only**; used by the screenshot ACs) | guarded |
| Any URL + `&debug=1` | Shows the FPS and meter overlay (§7.8) | same |

`adb shell am start -W -a android.intent.action.VIEW -d "<url>" com.dems.demo.tablet` opens any of these (01S §5.6 pattern).

### 3.6 Back behaviour and the RECORDING guard

| Situation | Hardware back or gesture | Behaviour |
|---|---|---|
| `/session/live` while RECORDING | Guarded | `usePreventRemove(isActive, …)` (VM-08) opens a HeroUI Native `Dialog`: "Recording continues on the Core. Leave the monitor?", with **Stay on monitor** (primary) and **Go to Home** (outline). Going Home shows the live mini-bar. **Back never stops a recording**; only End Session does |
| `/session/new?step=2\|3` (PRECHECK, ARMED) | Guarded | Dialog "Cancel this session?" → `cancel()` (audit SESSION_CANCELLED) or stay |
| `/session/finalizing` (STOPPING, FINALIZING) | Blocked | A toast explains "Finalizing — please wait"; no dialog |
| `/session/summary/[id]` | Allowed | Acknowledges the summary (SCR-02) and returns Home |
| Tabs | Default | `backBehavior="history"` |
| Root (Home) | Default | Android moves the task to the background; recording continues |

- `predictiveBackGestureEnabled: false` stays as in the template (01S §5.1, V34). Predictive back would preview the screen underneath the monitor.
- `gestureEnabled: false` is set on the session stack screens while a session is active.

### 3.7 State-routed resync (§5.2, §5.5, §5.6)

`src/runtime/route-sync.ts` exports a **pure** function `resyncTarget(state, context)`; `SessionRouteSync` applies it.

| `session.state` | Target |
|---|---|
| null, or SEALED with the summary acknowledged | none (stay) |
| CREATE | `/session/new?step=1` |
| PRECHECK | `/session/new?step=2` |
| ARMED | `/session/new?step=3` |
| RECORDING | `/session/live` |
| STOPPING, FINALIZING | `/session/finalizing` |
| SEALED, summary not acknowledged | `/session/summary/<id>` |
| FAULT, RECOVERY | `/session/recovery` |

**When it forces navigation (`router.replace`)**, and only then:
1. right after sign-in (cold start or relaunch after a crash, §5.6 "app reconnects and retrieves current session state");
2. on the heartbeat client's `onResync` (after an OFFLINE → LIVE reconnect, §5.5);
3. on simulator-driven transitions inside the flow (STOPPING → FINALIZING → SEALED; any → FAULT).

At any other time, for example while the operator browses Evidence during RECORDING, it **does not** yank the user. The live mini-bar is shown instead. A resync never creates a second session: the simulator's idempotent `createSession` guarantees that (S26, 01S §14.7).

### 3.8 Live mini-bar

- Shown whenever `session.state === 'RECORDING'` and the current route is not `/session/live`.
- Contents: REC dot (M-C-05), "Recording", session ID (mono), timer (RollingNumber), and a chevron. It is a `Surface` with a danger-tinted hairline. Tap → `/session/live`.
- Motion M-MB-02 (§7.5).

---

## 4. Per-screen specification

### 4.0 Component vocabulary (D6)

**Rule:** a HeroUI Native component first (VM-01, VM-03); then a pinned library; a custom composition **only** where neither fits. `className` recipes on kit components (01S §2.10) are not new primitives.

**Kit components used** (HeroUI Native 1.0.10): `Card` (Header, Body, Footer, Title, Description), `Surface`, `Button`, `Chip`, `Alert`, `Toast`/`useToast`, `Dialog`, `BottomSheet`, `Popover`, `Menu`, `Select`, `Tabs`, `TagGroup`, `ListGroup`, `Accordion`, `TextField`, `InputGroup`, `Input`, `TextArea`, `SearchField`, `InputOTP`, `FieldError`, `Label`, `Description`, `Checkbox`, `Switch`, `RadioGroup`, `Slider`, `Avatar`, `Separator`, `Skeleton`, `SkeletonGroup`, `Spinner`, `ScrollShadow`, `LinkButton`, `PressableFeedback`, `Text`, `CloseButton`.

**Libraries** (all pinned in 01S §1.4): `victory-native` (donut, bars, lines), `@shopify/react-native-skia` (rings, meters, feeds), `@shopify/flash-list` (lists longer than about 10), `@gorhom/bottom-sheet` (through the kit's `BottomSheet`), `react-native-svg` (emblem, topographic texture), `lucide-react-native` (icons), `expo-linear-gradient` (gradient CTA fill, light streaks, photo grade), `expo-blur` (nav chrome over scrolling content, §4.19), `expo-image` (backdrop and thumbnails), `expo-video` (reserved: CameraFeed `source={{ uri }}` when looped clips exist, 01S §14.10), `expo-haptics`, `expo-keep-awake`, `expo-local-authentication` (additive).

**Custom compositions** (the complete list; 01S §14.6 names the web equivalents):

| ID | Composition | File (`src/components/composed/`) | Built from | Why no kit or library item fits |
|---|---|---|---|---|
| C-1 | **GlowRing** (modes `login` 200–340 dp, `hero` 280 dp, `mini` 72–120 dp) | `glow-ring.tsx` | Skia `Canvas`, `Group`, `Path` (tick ring, bracket arcs, solid ring; trim via animated `end`), `BlurMask`, `SweepGradient`; centre slot for the Emblem or a Lucide shield | No ring or progress component in HeroUI Native (VM-01); rings drawn on the UI thread (03M Appendix A) |
| C-2 | **DbfsMeter** (variants `card`, `large`, `compact`; horizontal or vertical) | `dbfs-meter.tsx` | Skia `RoundedRect` ×10 segments (−60, −48, −40, −32, −26, −20 green; −14, −9 amber; −5, −2 red: 01S §14.6), peak `Rect`, Skia `Text` readout, fed by shared values | 20 Hz data with zero React renders (S3, 03M M-C-04) |
| C-3 | **SessionTimeline** | `session-timeline.tsx` | RN `View` line + node dots, kit `Text`, Reanimated entering and layout | No timeline component (VM-01) |
| C-4 | **Stepper** (horizontal wizard / vertical pipeline) | `stepper.tsx` | Kit `Chip` (numbered badges), `Separator` (connectors), Reanimated fills | No stepper component (VM-01); MB 3 (650–885, 85–130) |
| C-5 | **NavChrome**: `BottomTabBar`, `NavRail`, `LiveMiniBar` | `nav/*.tsx` | `expo-router/ui` `TabTrigger`, kit `PressableFeedback`, `Text`, `Avatar`, `Surface`; Reanimated indicator; `expo-blur` | No tab-bar component in the kit; the web counts its AppShell as a composition too (01S §14.6) |
| C-6 | **RollingNumber** (`slide` for clocks and timers; `count` for KPIs) | `rolling-number.tsx` | Reanimated per-digit `translateY` columns (`slide`) and `useAnimatedProps` on a read-only `TextInput` (`count`); tabular figures | The web uses Motion Primitives SlidingNumber and AnimatedNumber, which are web-only (03M §10, Appendix A) |

**Asset renderers** (not UI primitives; 01S §14.6 precedent): `CameraFeed` (Skia procedural image, §8.3), `Emblem` (react-native-svg; Skia path variant for the draw animation), `HeroBackdrop` (expo-image + linear gradients + topographic SVG).

**Recipes** (tokens and `className` on kit parts): `StatusChip` (tone → `Chip color` or the info/sealed recipe of 01S §2.10), `SubjectTypeChip` (Tersangka → danger soft; Saksi → info recipe; Lainnya → default), `SectionCard` (`Card className="rounded-xl"`), `KeyValueList` (`ListGroup`), `GlowLayer` (a pre-rendered glow sibling whose opacity animates, 03M §9.2).

**testID convention:** each screen root carries `testID="screen-<id>"`, and layout containers carry `testID="pane-<name>"` and `testID="nav-bottom" | "nav-rail"`. They surface as uiautomator `resource-id` values (VM-06).

### 4.1 Login — MB 1 (42–308, 8–545); modules 1; 01S §14.8

| # | Region | MB 1 ref | Kit | Library / composition | Data | States and notes |
|---|---|---|---|---|---|---|
| L1 | Backdrop | (50–300, 15–540) | — | `HeroBackdrop`: the licensed room still (W-05), graded (black 45% + bronze multiply via `expo-linear-gradient`), topographic SVG at 15–30%, diagonal light streaks | static | **The officer photo is never used** (D28, 04 §7). Reduced motion: no Ken Burns |
| L2 | Emblem in ring | (143–207, 100–185) | — | C-1 GlowRing `login` (200 dp compact, 340 dp expanded) + Emblem | Core link (heartbeat or simulated) → ring READY / ATTENTION (STALE) / CRITICAL (OFFLINE); lockout → amber | Hero moment (M-PG-LOGIN) |
| L3 | Wordmark and caption | (90–260, 188–248) | `Text` with `font-display` (Orbitron) and the white-to-gold look via `expo-linear-gradient` masked text (hypothesis H-MB-02; fallback: flat gold `#FFC86B`) | — | i18n | "DEMS / EDGE CLIENT", "Digital Evidence Recording Controller" |
| L4 | Username | (66–286, 270–302) | `TextField` + `InputGroup` (Prefix `User`, `Input autoComplete="username"`) + `FieldError` | react-hook-form + zod | — | Required |
| L5 | Password | (66–286, 313–345) | `TextField` + `InputGroup` (Prefix `Lock`, `Input secureTextEntry`, Suffix `Button isIconOnly variant="ghost"` Eye/EyeOff) + `FieldError` | — | — | Eye toggle morph (M-C-16) |
| L6 | Sign In | (66–286, 365–400) | `Button variant="primary" size="lg"` full width, **dark label** (D28/Q5, MB 1), `Spinner` while pending | expo-haptics | `auth.signIn` | Disabled while locked, while pending, or when Core is OFFLINE in heartbeat mode |
| L7 | Biometric | (135–220, 415–470) | `Button isIconOnly variant="outline"` (`Fingerprint`) + caption "Use biometric login" | expo-local-authentication | `lastOperatorId`, `biometricEnabled` | Hidden without hardware; disabled with the caption "Biometrics not set up on this device" when not enrolled (§6.3) |
| L8 | Version | (160–190, 520–530) | `Text` caption | — | dataset device version **v2.4.1** (01S §14.7) | App build version appears on About |
| L9 | Alerts (derived) | — | `Alert status="danger"` (generic "Invalid username or password.", attempts left), `status="warning"` (locked; countdown with C-6), `status="accent"` (signed out / expired), `status="danger"` + Retry (Core offline) | — | `auth` | 01S §14.8 states, same copy |
| L10 | Demo operators (derived) | — | `Accordion variant="surface"` (collapsed) + `ListGroup` rows with a role `Chip`; tap fills the form | — | dataset operators | Hidden in presentation mode (D28/Q14) |
| L11 | Core trust line (derived) | — | `Chip` (Core link tone) + `Text` "Core: DEMS-IR-01 • paired (simulated)" + `LinkButton` "Pair this tablet" → `/pair` | — | heartbeat, pairing | §20.1 |

**Layouts:** as §2.4. **Keyboard:** `KeyboardAwareScrollView`. **Focus:** the Username field takes focus once the card settles (M-PG-LOGIN t = 1,200).

### 4.2 Pairing — derived; module 1; §20.1

- **Layout:** `SectionCard` with C-4 Stepper (Discover → Verify code → Paired), then the Core identity as a `KeyValueList`: device `DEMS-IR-01`, room, certificate fingerprint in mono, and a `Chip` "SIMULATED".
- **Code entry:** `InputOTP` with 6 digits (VM-03). The demo code is shown only in the Login "Demo operators" accordion (hidden in presentation mode).
- **Actions:** `Button` primary "Pair" and outline "Cancel". A paired tablet shows `Button variant="danger-soft"` "Unpair" behind a `Dialog`.
- **States:** UNPAIRED, PAIRING (Spinner), PAIRED (Chip success + haptic Success), FAILED (Alert danger; 3 failures → 60 s lockout, mirroring the auth policy).
- **Data:** SCR-02 `pairing` slice, `pair(code)` and `unpair()`, each with an audit row.

### 4.3 Home (Dashboard) — MB 2 (338–606, 8–545); module 2

| # | Region | MB 2 ref | Kit | Library / composition | Data |
|---|---|---|---|---|---|
| H1 | Header | (355–590, 40–78) | `Avatar` (Fallback initials **"BS"** from the operator name, 04 §9 #29) → `Menu` (Profile, Lock console, Sign out); bell `Button isIconOnly variant="ghost"` with a count `Chip` → `Popover` of the latest alerts | Emblem (react-native-svg, 32 dp) + wordmark | operator, alerts |
| H2 | System Status | (352–592, 88–160) | `SectionCard`; title `Text`; status `Text` in success-400 (`#4ADE80`) | C-1 GlowRing `mini` (72 dp) around a `ShieldCheck` | `systemState`: READY "Ready for Recording / All systems operational"; ATTENTION (warning list); CRITICAL; RECORDING "Session in progress" + REC + timer (tap → live) |
| H3 | Status tiles ×3 | (352–592, 170–232) | `Surface variant="secondary"` + icon + `Chip` dot + value | C-6 `count` | Camera **2/2** (04 §9 #7), Microphone 2/2, Storage **20% used** (D28/Q1). Tap → Devices or Storage |
| H4 | Quick actions | (352–592, 245–320) | `Button variant="primary" size="lg"` "Start Session" (gold → bronze fill via `expo-linear-gradient` in the background slot, H-S16; fallback flat gold) and `Button variant="outline"` "View Evidence" | periodic sheen (M-C-23 ShineBorder equivalent) | Start is replaced by "Return to live session" while recording |
| H5 | Recent Sessions | (352–592, 335–488) | `SectionCard` + 3 rows (thumbnail, ID mono, time, `SubjectTypeChip`) + `LinkButton` "See All" → `/sessions` | `expo-image` crop thumbnails | latest 3 sessions |
| H6 | Tab bar | (350–595, 495–530) | — | C-5 | — |

**Tablet additions** (expanded; web Dashboard parity, 01S §14.5.1): GlowRing `hero` (280 dp) replaces the mini ring; device tiles 2x2 with C-2 `compact` meters and CameraFeed thumbnails (at most 2 live canvases); a Security, Time & Network chip row.

### 4.4 Start New Session — MB 3 (634–903, 8–545); modules 3, 4, 5, 6, 7, 8

**Header** MB 3 (650–885, 45–75): back arrow (guarded, §3.6), title "Start New Session", and a right icon that the mockup does not explain. Interpreted as **"Load last session profile"** (hypothesis; it matches the web's "Start with last profile", 04 §5.7) → `Menu` with "Start with last profile" and "Clear form".

**Stepper** MB 3 (650–885, 85–130): C-4, horizontal on compact, vertical on medium and expanded. Labels: Session Info, Devices Check, Ready.

**Step 1: Session Information** — MB 3 (650–885, 140–470)

| Field | Kit | Notes |
|---|---|---|
| Case Number | `TextField` + `InputGroup` (Suffix `Button isIconOnly` `ScanLine`) | "Scan" is **simulated**: it fills the next synthetic case number `LP/{YYYY}/{MMDD}-0008` with a haptic Success. There is no camera (SPEC-C10) |
| Subject Type | `TagGroup selectionMode="single"` with 3 tags: **Tersangka** (danger soft), **Saksi** (info recipe), **Lainnya** (default) | ID terms verbatim; EN gloss (Suspect, Witness, Other) in `accessibilityHint` and a long-press `Popover` (D28/Q3) |
| Subject Name | `TextField` | — |
| Investigator | `Select` (presentation `bottom-sheet` on compact, `popover` on tablet) with `SearchField` in the content | Defaults to the signed-in operator |
| Room / Location | `Select` | Default "Interview Room 1" |
| Recording Profile | `Select` "Standard (1080p / 25 fps)" | Web parity (01S §14.5.11); not drawn in MB 3 |
| Notes (Optional) | `TextArea` | — |
| Next | `Button variant="primary" size="lg"` full width with `ArrowRight`, MB 3 (653–885, 485–520) | Disabled until the shared `sessionCreateSchema` (W-03) validates. On press: `createSession(input)` → CREATE, then `beginPrecheck()` → PRECHECK |

**Step 2: Devices Check** (the §5.3 gate; derived)

- **Check list:** a `ListGroup` of 8 items: Core Machine (ONLINE/OFFLINE), Video Lens 1 and 2 (READY/FAULT), MIC 1 and 2 (READY/NO SIGNAL/CLIP), Storage (READY/LOW/FULL), Time Sync (GNSS/NTP/RTC), Security (READY/FAULT). Each item has a Prefix icon, Title, Description (the live state) and a Suffix of `Spinner` while resolving, then a PASS, WARN or BLOCK `StatusChip`.
- **Policy** (01S §14.5.11, demo G8): Core OFFLINE, Lens FAULT, Storage FULL or Security FAULT → **BLOCK**. MIC NO SIGNAL or CLIP, Storage LOW, or Time on RTC → **WARN**, which needs the `Checkbox` "Acknowledge warnings".
- **BLOCK** shows `Alert status="danger"` with the reasons and disables Next.
- **Previews:** CameraFeed ×2 and C-2 ×2 above the list (compact) or beside it (tablet), with the hint "Speak to test (simulated)".
- **Core Machine source:** Settings → App Preferences → "Core link source": **Simulated** (default; the app works stand-alone) or **mock-core heartbeat** (LIVE → ONLINE, anything else → OFFLINE). Heartbeat mode makes the §5.3 hard block demonstrable by stopping mock-core (MA-10).

**Step 3: Ready (ARMED)**

- A summary `SectionCard` with a `KeyValueList` (case, subject + chip, investigator, room, profile, "All devices ready").
- C-1 GlowRing `mini` (120 dp).
- `Switch` "3-2-1 countdown" (default on).
- `Button variant="primary" size="lg"` "Start Recording" (haptic Medium) → `startRecording()` → `router.replace('/session/live')`, so Back from the monitor can never return to ARMED.

**Cancel after data entry** → `Dialog` → `cancel()`. **Keyboard:** `KeyboardAwareScrollView`.

### 4.5 Session Monitor — MB 4 (932–1200, 8–545); modules 5, 6, 8, 9; §5.4

| # | Region | MB 4 ref | Kit | Library / composition | Data |
|---|---|---|---|---|---|
| S1 | Header | (945–1190, 45–75) | back (guarded), title "Active Session", right `Button isIconOnly` `History` → `BottomSheet` with C-3 SessionTimeline (compact; tablet shows the timeline inline) | — | `session.timeline` |
| S2 | REC row | (948–1185, 88–112) | `Text` "Recording" in danger-400 | REC dot (M-C-05) + C-6 `slide` timer in the Orbitron readout (32/40, 01S §2.7) | `session.startedAt` (clock-derived, S4) |
| S2b | §5.4 status strip (derived; the book elements MB 4 omits) | — | `ScrollShadow` row of `StatusChip`s: VIDEO 1 REC, VIDEO 2 REC, STORAGE OK, TIME GNSS LOCKED | — | tracks, storage, time |
| S3 | Live feed | (948–1185, 122–300) | `SectionCard` with glow frame (GlowLayer); overlay `Chip`s "CAM 1 - Interview Room 1" and "1080p • 25 fps"; camera switch `Tabs variant="secondary"` (Cam 1 \| Cam 2) on tablet, tap-to-switch on phone | CameraFeed (Skia, §8.3) | `activeCameraId`, camera states |
| S4 | MIC cards ×2 | (948–1185, 310–395) | `Surface variant="secondary"` + `Chip` dot "MIC 1" / "MIC 2" | C-2 `card` (bars + dBFS readout) | audio channels (transient, §5.4) |
| S5 | Action tiles ×4 | (948–1185, 403–455) | `Button variant="tertiary"` with icon + label | — | **Snapshot** → `snapshot()` (M-C-18); **Bookmark** = Add Marker → `Popover` label → `addMarker()` (M-C-17); **Audio Monitor** → `BottomSheet` with C-2 `large` ×2, peak hold, clip reset; **Settings** → `BottomSheet`: `Switch` "Pause monitoring" (UI-only, D28/Q8), camera choice, meter scale |
| S6 | End Session | (952–1180, 468–510) | `Button variant="danger" size="lg"` full width with `Square` icon; label "**End Session**" (one verb pair, 04 §9 #27, 01S §14.12; MB 4 reads "Stop Session"); white label at 19 dp Inter Bold so it meets AA-large (01S §2.7: white on red is 3.76) | hold-to-confirm 1.5 s (M-C-19) → `Dialog` with `TextArea` reason (≥ 5 characters, S21) + `Button variant="danger"` | `stopRecording(reason)` → route-sync to `/session/finalizing` |
| S7 | Connection banner (T15) | — | `Alert status="warning"` + `Spinner`: "Core link lost — recording continues on the Core. Reconnecting…" | — | heartbeat state (heartbeat mode); session actions become read-only |
| S8 | Fault overlays | — | NO SIGNAL overlay on the feed; CLIP latch `Chip` on the MIC card (tap to reset); critical FAULT → route-sync to recovery | — | faults |

**Keep-awake** is on (§6.6). **Back** is guarded (§3.6).

### 4.6 Finalization — derived; module 10; §12.2

- A full-screen centred `SectionCard`: title "Finalizing evidence", session ID in mono, and C-4 Stepper `pipeline` (vertical) over the 6 `FinalizationStep` labels (01S §2.3). Each step shows `Spinner` → check.
- Non-dismissible (§3.6).
- On SEALED: the violet **SEALED** chip stamp (M-C-09; `StatusChip` sealed + `BadgeCheck`; haptic Success). After 1.2 s, route-sync opens the Summary.

### 4.7 Session Summary — derived; §5.2 step 10; §11.3

- **Header:** SEALED `StatusChip`, session ID (mono, h2).
- **Details:** `KeyValueList` with Case, Subject + `SubjectTypeChip`, Investigator, Room, Start and End (each with its time-source badge "GNSS", S29), Duration, Size.
- **Hashes:** a `KeyValueList` of 4 per-track SHA-256 values (mono, truncated), plus the manifest hash and the signature marked "SIMULATED" (01S §14.7). Tapping a hash opens a `BottomSheet` with the full value as `Text selectable` (long-press copy is native; no clipboard dependency is added).
- **Lifecycle:** C-4 horizontal over §19.1, current stage SEALED LOCAL EVIDENCE.
- **Actions:** `Button` primary "View in Evidence" and outline "Done". Both acknowledge the summary (SCR-02).
- The same component serves `/sessions/[sessionId]` for past sessions (no acknowledgement there).

### 4.8 Recovery Status — derived; T16; §18.1, §6.4

- `Alert status="danger"` naming the fault.
- C-4 `pipeline`: RECOVERY_SCAN → INCOMPLETE_SESSION_ANALYSIS.
- A result `SectionCard`: "Session marked INCOMPLETE — it will never be sealed (SYS-008)" with an amber `StatusChip`.
- `Button` "Acknowledge" → idle; the ring goes to ATTENTION, then READY (03M §7).

### 4.9 Sessions hub — derived (MB tab "Sessions")

- An active-session `SectionCard` when recording (REC, timer, "Return to monitor").
- `Button` primary "Start New Session".
- `SearchField`, then `TagGroup` filters (All, Sealed, Incomplete, Today).
- `FlashList` rows: ID (mono), date, subject + `SubjectTypeChip`, duration, state `StatusChip` (SEALED violet, INCOMPLETE amber, RECORDING danger). Row → `/sessions/[sessionId]` (the Summary component).

### 4.10 Evidence list — MB 5 (1228–1497, 8–545); module 11

| # | Region | MB 5 ref | Kit | Library | Data |
|---|---|---|---|---|---|
| E1 | Header | (1240–1490, 40–75) | emblem + "Evidence"; right `Button isIconOnly` `List` → `Menu` (Sort newest/oldest; Density comfortable/compact). The icon's meaning is a hypothesis | — | — |
| E2 | Search | (1245–1482, 80–103) | `SearchField` "Search session ID, subject, or case number…" | — | `q` |
| E3 | Filters | (1245–1482, 112–133) | `TagGroup selectionMode="single"`: All, Recorded, Sealed, Exported, Under Review (the 5th scrolls horizontally) | — | `status` |
| E4 | List | (1245–1482, 145–475) | Pressable `SectionCard` rows: thumbnail, ID (mono), date/time, subject, `SubjectTypeChip`, duration (mono), status `StatusChip` (Sealed **violet** with `Lock`, D28/Q4; Recorded success; Exported info with `Upload`; Under Review warning with `Eye`), kebab `Menu` (View, Verify, Export, Archive; RBAC-gated) | `FlashList`; `expo-image` thumbnails | `evidenceList(filter)` |
| E5 | Tab bar | (1240–1490, 495–530) | — | C-5 | — |

- **Empty:** a `SectionCard` with "No evidence matches" and a "Clear filters" button. **Loading:** `SkeletonGroup` rows.
- **Tablet:** list pane plus detail pane (§2.4); the selected row carries glow e2.

### 4.11 Evidence detail — MB 6 (44–312, 580–1003); module 11; EVT-13/14

| # | Region | MB 6 ref | Kit | Library / composition | Data |
|---|---|---|---|---|---|
| D1 | Header | (55–300, 610–635) | back + "Evidence Details" | — | — |
| D2 | Hero | (60–297, 643–715) | `StatusChip` "Sealed" (violet + `Lock`) top-right | `expo-image` poster (CameraFeed snapshot) + gradient fade | `evidenceById` |
| D3 | ID and time | (60–297, 715–745) | `Text` mono h2; time range with a GNSS badge | — | — |
| D4 | Key-values | (60–297, 750–870) | `KeyValueList` (icon prefix, label, value): Case Number, Subject (+ chip), Investigator, Location, Duration, File Size, Status | — | — |
| D5 | Tabs | (60–297, 880–900) | `Tabs variant="primary"` with animated `Tabs.Indicator`: **Media**, **Metadata**, **Hash & Integrity** | — | — |
| D5a | Media | (60–297, 905–955) | horizontal list of posters with a play overlay and duration labels (VIDEO-01, VIDEO-02, snapshots) → Play sheet | `expo-image` | tracks, snapshots |
| D5b | Metadata | — | `KeyValueList` of manifest fields + the JSON in mono `Text selectable` inside `ScrollShadow` (S19) | — | manifest |
| D5c | Hash & Integrity | — | per-track SHA-256, manifest hash, signature with a "SIMULATED" chip; `Button` "Verify" → `Spinner` → scramble (a 600 ms `useScramble` hook, at most 20 text updates) → PASS `StatusChip` (bouncy pop) or FAIL; C-4 lifecycle (§19.1, horizontal scroll); custody log `ListGroup` | — | `verify(id)`, audit |
| D6 | Actions | (60–297, 962–990) | `Button variant="tertiary"` **Play** → `BottomSheet` with CameraFeed in playback mode + `Slider` scrubber over the recorded duration + a "Simulated playback" chip; `Button variant="outline"` **Export** → `BottomSheet` export wizard (C-4): Authorize (INVESTIGATOR → `Alert danger` "Your role cannot export" with a lock-shackle motion; S20, EVT-26), Verify source, Destination (`Select`), Reason (`TextArea`, mandatory, §19.2 item 8), Build and hash, Done (status → EXPORTED, ExportEvent + audit); `Button variant="outline"` **More** → `Menu` (Archive, RBAC-gated; Download manifest, a simulated toast) | — | `exportEvidence()` |

### 4.12 Devices & Inputs — MB 7 (338–608, 580–1003); modules 12, 5, 6

| # | Region | MB 7 ref | Kit | Data |
|---|---|---|---|---|
| V1 | Header | (350–595, 610–640) | icon + "Devices & Inputs" | — |
| V2 | Camera Devices | (350–595, 650–712) | `ListGroup` items: Prefix poster, Title "Camera 1" / "Camera 2" (canonical 2 cameras, 04 §9 #7; MB 7 draws only Camera 1), Description room, Suffix `StatusChip` Online + `ChevronRight` | cameras |
| V3 | Audio Inputs | (350–595, 722–828) | items "MIC 1 – Interviewer, Channel 1" and "MIC 2 – Subject, Channel 2" (canonical label, 04 §9 #8; MB 7 says "Investigator"); a C-2 `compact` inline on tablet | mics, audio |
| V4 | Other Devices | (350–595, 838–945) | items PoE Switch "4/4 Ports Active", Recording Indicator "Active" (lamp breathes while recording; detail shows "SEDANG MEREKAM"), Tablet Control "Connected" (this tablet's own Core link) | otherDevices, heartbeat |
| V5 | Device detail `/devices/[deviceId]` | — | `Tabs` Overview / Health / Log. Overview: live CameraFeed or C-2 `large`, spec `KeyValueList`, read-only gain and phantom (G13). Health: `victory-native` `CartesianChart` + `Line` (1 Hz, no animation). Log: audit rows for the device. `Button` "Run diagnostics" → `BottomSheet` of checks (`Spinner` → `StatusChip`) via `runDiagnostics()`; "Test signal" and "Restart" (simulated) behind `Dialog` | deviceById |

### 4.13 Storage — MB 8 (632–905, 580–1003)

| # | Region | MB 8 ref | Kit | Library | Data |
|---|---|---|---|---|---|
| T1 | Header | (645–890, 610–640) | back + "Storage" | — | — |
| T2 | Capacity card | (645–890, 648–780) | `SectionCard`; "3.2 TB Free" (h2), "of 4.0 TB"; legend `ListGroup` (Used 804 GB, Free 3.2 TB, Sealed Evidence 7, Pending 1) | `victory-native` `PolarChart` + `Pie.Chart innerRadius` (VM-12), sweep via `Pie.Slice animate`; centre C-6 "20%" + label **USED** (D28/Q1; MB 8 prints 80%, which is the free share, 04 §9 #4) | `storage` |
| T3 | Recent Storage Activity | (645–890, 788–905) | `SectionCard` + 5 rows (tone dot, time mono, text) + `LinkButton` "See All" → `/audit?category=storage` | — | events |
| T4 | Manage Storage | (652–887, 915–948) | `Button variant="outline" size="lg"` with `Layers` → `BottomSheet` (`Select` retention policy, `Switch` auto-archive, `Button` Save: simulated, audited) | — | `storagePolicy` |
| T5 | Tablet KPIs (derived, web parity) | — | `Surface variant="secondary"` ×4: write speed, session size, est. remaining (computed, 04 §9 #17), retention days | C-6; `victory-native` `Area` (24 h usage) and `HorizontalBar` (NVMe and HDD volumes) | `storage.history`, `storage.volumes` |

### 4.14 Network & Time — MB 9 (932–1200, 580–1003)

| # | Region | MB 9 ref | Kit | Library / composition | Data |
|---|---|---|---|---|---|
| N1 | Header | (945–1190, 610–640) | back + "Network & Time" | — | — |
| N2 | Network Status | (945–1190, 650–785) | `ListGroup`: LAN Connection (`StatusChip` Connected + chevron → detail sheet), PoE Network (Active), Bandwidth | `victory-native` `CartesianChart` + `Bar` (12 bars, streaming, animation off) + C-6 "12.4 Mbps ↑ 3.1 Mbps" at 1 Hz | `network` |
| N3 | Time Synchronization | (945–1190, 790–900) | `ListGroup`: GNSS / NTP (`StatusChip` "Synchronized", caption "UTC +07:00", D28/Q2), Last Sync, Time Source "GPS (GNSS Stratum-1)", Server `192.168.10.1`; tier row GNSS → NTP → RTC (3 `Chip`s; the active one carries a moving indicator, `time-tier`, 03M M-PG-NET) | Skia orbit around the GNSS icon while locked | `time` |
| N4 | System Time | (945–1190, 910–975) | clock ring icon, date in gold, `StatusChip` "Synchronized" | C-6 `slide` time in the Orbitron readout (32/40) | `clock`, `time` |

### 4.15 Settings — MB 10 (1228–1497, 580–1003)

| # | Region | MB 10 ref | Kit | Target |
|---|---|---|---|---|
| G1 | Header | (1240–1485, 610–640) | back + "Settings" | — |
| G2 | Account | (1240–1485, 650–712) | `ListGroup` item: `Avatar` (initials), role "Investigator", name, chevron | Profile `BottomSheet`: role, demo permissions, Lock console, Sign out |
| G3 | Application | (1240–1485, 720–815) | items App Preferences, Notifications, Security & Privacy | `/settings/preferences`, `/settings/notifications`, `/settings/security` |
| G4 | System | (1240–1485, 825–960) | items Device Settings, Storage Management, Network & Time, System Maintenance, About DEMS | `/devices`, `/storage`, `/network-time`, `/settings/maintenance`, `/settings/about` |

**Sections:**

| Section | Controls (kit) |
|---|---|
| `preferences` | `Switch` Reduce motion (in-app override, §7.7); `Switch` Haptics; `Switch` Presentation mode; `Select` Core link source (Simulated \| mock-core heartbeat); `Select` Language (English; "Bahasa Indonesia — later" disabled, A10); `Switch` Performance overlay (debug builds) |
| `notifications` | `Switch` per alert category; Critical is always on (a disabled `Switch` with an explanation) |
| `security` | `Switch` Biometric sign-in (with hardware and enrolment status, §6.3); `Select` Auto-lock (5 / 15 / 30 min); Core pairing → `/pair`; Operator audit → `/audit` |
| `maintenance` | `Button` Run diagnostics (sheet); software update `SectionCard` (v2.4.1 → **v2.5.0** available, 04 §9 #19; C-4 over `UpdateStep`, simulated); **Demo controls** `Accordion` (collapsed; hidden in presentation mode): one `Button` per fault (camera loss, MIC 2 clip, MIC 1 no signal, storage low, storage full, GNSS loss, tamper, fan stall, power fail), scenario `Select`, `Button` Reset (`sim.inject()`, `sim.loadScenario()`, 01S §14.5.8) |
| `about` | Product and device identity (§24.1 subset); app version (expo-constants); licences (fonts OFL-1.1; hero photo credit from `THIRD_PARTY_NOTICES.md`); `LinkButton` "Stack diagnostics" → `/stack-check` |

On medium and expanded, the section opens in the right pane (§2.4).

### 4.16 Operator Audit View — derived; module 13; §21.3

- **Header:** "Audit" + chain status `StatusChip` (Chain OK / Discontinuity).
- **Controls:** `SearchField`; `TagGroup` categories (All, Auth, Session, Evidence, Device, Security, Storage); `Switch` "Live".
- **List:** `FlashList` rows: time (mono), event, actor, category `Chip`, chain-link dot. Row → `BottomSheet` with the event JSON (mono, selectable) and the previous and current hashes.
- **Tamper (EVT-30):** `Alert status="danger"`; the broken row holds a slow red glow (M-C-21).
- Login attempts appear as AUTH rows; pairing as PAIRING rows.

### 4.17 More — phone only

- An operator header card (`Avatar`, name, role).
- `ListGroup`: Storage, Network & Time, Audit, Settings, About.
- Footer: version and the Core link chip.

### 4.18 Stack check (row 18 proof)

Unchanged (01S §5.5, §5.6). Reachable at `/stack-check` and at `/` with `?motion=`, and linked from Settings → About.

### 4.19 Global overlays

| Overlay | Kit | Notes |
|---|---|---|
| Toasts | `Toast` via `useToast`, placement top, variants per severity | Critical toasts persist until dismissed (03M M-C-14) |
| Dialogs | `Dialog` | Back guard, End Session reason, cancel session, unpair |
| Sheets | `BottomSheet` (@gorhom) | Timeline, Audio Monitor, session settings, export, play, diagnostics. The `blur` overlay is iOS-only (VM-04), so Android uses the default dim overlay |
| Nav chrome over content | C-5 inside an `expo-blur` `BlurView` (`blurMethod="dimezisBlurViewSdk31Plus"`, `blurTarget` = the screen's `BlurTargetView`, VM-14) | **Fallback:** a translucent `#0B0D0FE6` fill (hypothesis H-MB-03 on cost) |
| Idle lock | `Dialog` "Session expired" | After 15 min without interaction (01S §14.8); recording is unaffected |

---

## 5. Data

### 5.1 Simulator reuse, not a fork (D19)

| Import | From | Owner |
|---|---|---|
| `createSim`, `SimProvider`, `useSim`, `useSimActions`, `useAudioChannel` | `@dems/shared/sim` (01S §14.7) | W-02 |
| `HeartbeatProvider`, `useHeartbeat`, `formatClock` | `@dems/shared/realtime` (VM-19) | rows 15–16 (done) |
| tokens, status tones | `@dems/shared/tokens` | W-01 |
| enums and labels | `@dems/shared/domain` | row 15 |
| `CORE_HTTP_ORIGIN`, `CORE_WS_URL`, `sessionCreateSchema` | `@dems/shared/api` | row 15, W-03 |
| i18n resources | `@dems/shared/i18n` (**SCR-05**: export not yet declared, VM-19) | W-03 |

- **The mobile app never edits `packages/shared/**`.** Anything missing goes to the controller as a Shared-contract request (§13).
- The mobile side adds only **platform adapters** in `apps/mobile/src/runtime/`.

### 5.2 Platform adapters (`src/runtime/`)

| Adapter | Implementation | Needed because |
|---|---|---|
| Persistent storage | `createJSONStorage(() => AsyncStorage)` from `zustand/middleware` (zustand resolves through its `react-native` export condition, VM-15) | The web store persists to `sessionStorage`, which React Native lacks (01S §14.7 `store.ts`) |
| Visibility | `{ isHidden: () => AppState.currentState !== 'active', subscribe(cb) }` on `AppState` | The web engine pauses on `document.hidden` (01S §14.7 `engine.ts`) |
| Hydration gate | Await `sim.ready` (or `store.persist.hasHydrated()`) before `start()` | AsyncStorage is asynchronous, so ticking before hydration would overwrite the saved session |
| Scheduler | Default `setInterval(50)` (Hermes supports it) | none |
| Core link | Settings "Core link source": simulated, or mapped from `useHeartbeat().state` | §4.4 step 2, MA-10 |

These need the engine to accept injected adapters: **SCR-01**.

### 5.3 Persistence: AsyncStorage 2.2.0 (chosen)

| Option | Status | Verdict |
|---|---|---|
| **`@react-native-async-storage/async-storage` 2.2.0** | Expo SDK 57 bundled version (VM-09); MIT; TurboModule `codegenConfig` (VM-10); official jest mock (VM-16); the zustand docs' reference RN storage (hypothesis-grade: knowledge, not fetched) | **Chosen.** Ready-made, Expo-tested, installed with `npx expo install` (rule R-1). The asynchronous API is fine for a 1 s throttled snapshot. Latest upstream is 3.1.1, but R-1 keeps Expo's tested 2.2.0 |
| `expo-sqlite` ~57.0.3 (`kv-store`) | Bundled | Rejected: a SQLite native module for a single key-value snapshot |
| `react-native-mmkv` | **Not** in Expo's bundled list (VM-09); needs extra native modules | Rejected: outside Expo's tested set; rule R-1 cannot pin it |
| `expo-secure-store` ~57.0.4 | Bundled; encrypted | Rejected for snapshots (encrypted per-item storage is meant for small secrets); not needed, because no secret is stored (§6.4) |

**Keys** (no credentials, no tokens):
- `dems.sim.v1` — the simulator snapshot. Same key as the web; the audio slice is excluded; throttled to 1 s (01S §14.7).
- `dems.mobile.prefs.v1` — reduce motion, haptics, presentation mode, Core link source, rail collapsed.
- `dems.mobile.auth.v1` — `{ lastOperatorId, biometricEnabled }`.

### 5.4 Transient meter path (zero React renders per frame)

```ts
// src/runtime/use-audio-shared-values.ts (sketch)
const level = useSharedValue(-90), peak = useSharedValue(-90), clip = useSharedValue(0);
useAudioChannel(channel, (f) => { level.value = f.dbfs; peak.value = f.peak; clip.value = f.clip ? 1 : 0; });
// C-2 DbfsMeter: const smooth = useDerivedValue(() => withSpring(level.value, meterSpring));
// segment i opacity: useDerivedValue(() => interpolate(smooth.value, [t[i] - 1, t[i]], [0.12, 1], Extrapolation.CLAMP))
// readout: Skia <Text text={useDerivedValue(() => `${Math.round(level.value)} dBFS`)} /> refreshed at 4 Hz by a UI-thread throttle
```

- The simulator ticks at 20 Hz on the JS thread (`meterFrameMs` 50, 01S §2.7). Each frame only assigns shared values. Segment opacity, spring smoothing, peak hold and the readout all run on the UI thread in Skia and Reanimated.
- `accessibilityValue { min: -60, max: 0, now, text }` updates at **1 Hz** from JS (01S §14.6).
- **SCR-01** asks that frames be plain numbers and booleans.

### 5.5 Heartbeat over `adb reverse`

- `HeartbeatProvider` connects to `CORE_WS_URL` (`ws://127.0.0.1:4400/ws`) through `adb reverse tcp:4400 tcp:4400` (01S §2.4, §6.2).
- `onResync` → `SessionRouteSync.resync()` plus `queryClient.invalidateQueries({ queryKey: ['health'] })`.
- OFFLINE → the connection banner (S7). In heartbeat mode, the Core check blocks. The in-app simulator keeps recording, which matches §5.6 "Core recording continues".

### 5.6 Selectors the screens need

Available per 01S §14.7: session, timeline, cameras, mics, storage, time, network, security, events, audit, evidence, `evidenceById`, `verify()`, `precheck()`, `startRecording()`, `stopRecording(reason)`, `addMarker()`, `snapshot()`, `inject()`, `loadScenario()`, `runDiagnostics()`, auth.

**Requested (SCR-02):** `pairing` + `pair(code)` + `unpair()`; `signInWithBiometric(operatorId)` (audit method BIOMETRIC); `lastSealedSessionId` + `acknowledgeSummary(id)`; `sessionHistory` (including incomplete sessions); a `tabletLink` input driven by the app.

### 5.7 Forms

`react-hook-form` 7.89.0 + `zod` 4.6.5 + `@hookform/resolvers` 5.9.1 (pinned). The shared `sessionCreateSchema` (W-03) drives step 1; the login schema is local (two required strings).

---

## 6. Auth (same policy as web, 01S §14.8)

### 6.1 Operators and policy

| Item | Value |
|---|---|
| Operators | `budi.santoso` (AKP Budi Santoso, INVESTIGATOR, initials BS), `andi.pratama` (AKP Andi Pratama, SUPERVISOR), `rina.wijaya` (Rina Wijaya, TECHNICIAN); demo password `demo-2026`, shown only in the Demo operators accordion |
| Roles | INVESTIGATOR: start and stop sessions, notes, view evidence. SUPERVISOR: plus review, export and audit export. TECHNICIAN: devices, diagnostics, maintenance; no export, no session start (RBAC in the UI via `isDisabled` + a reason, S20) |
| Lockout | 5 failures in 5 min → locked for 60 s. The simulator clock is authoritative. Audit rows AUTH_SUCCESS, AUTH_FAILED, AUTH_LOCKED |
| Messages | Generic "Invalid username or password." plus attempts remaining |
| Never | Credentials in URLs, logs, audit rows or storage (§20.1) |

### 6.2 States

Idle, Validating, Submitting, Error, Locked, Core offline, Signed out / Expired, Success. Visuals are in §4.1 (L9); motion is M-C-22 (§7.4).

### 6.3 Biometric sign-in (expo-local-authentication 57.0.3, VM-13)

**Flow:**
1. Enabling: after the first successful password sign-in, a `Dialog` offers "Enable biometric sign-in on this tablet?". Yes stores `biometricEnabled` and `lastOperatorId`. It can also be toggled in Settings → Security.
2. The Login fingerprint button runs:
   - `hasHardwareAsync()` → hide the button if false;
   - `isEnrolledAsync()` → disabled button with a caption if false;
   - `authenticateAsync({ promptMessage: 'Sign in to DEMS', promptSubtitle: operator name, cancelLabel: 'Use password', disableDeviceFallback: true, biometricsSecurityLevel: 'strong' })`.
3. Results:
   - `success` → `signInWithBiometric(lastOperatorId)` (SCR-02) → audit AUTH_SUCCESS (method BIOMETRIC).
   - `user_cancel`, `system_cancel` → no audit; stay.
   - `lockout` → Alert warning "Biometrics locked — use your password".
   - `not_enrolled`, `passcode_not_set` → the caption.
   - `authentication_failed` → counts as one failure toward the §6.1 lockout.
4. The simulator trusts the OS result; this is labelled "simulated identity binding".

**Emulator enrolment for the demo** (AVD user data only; run outside the sandbox, D24; while holding that AVD's lock, D35):

| Step | Command or action | Status |
|---|---|---|
| 1 | Set a screen-lock PIN: `adb -s <serial> shell locksettings set-pin 1234` | hypothesis H-MB-04; fallback: Settings → Security & privacy → Device unlock → Screen lock → PIN |
| 2 | Open enrolment: `adb -s <serial> shell am start -a android.settings.BIOMETRIC_ENROLL`; enter the PIN with `adb -s <serial> shell input text 1234 && adb -s <serial> shell input keyevent 66` | hypothesis; fallback: Settings → Security & privacy → Device unlock → Fingerprint Unlock |
| 3 | At "Touch the sensor", repeat `adb -s <serial> emu finger touch 1` until "Fingerprint added" (usually 3–6 touches) | Android emulator console command (hypothesis for the `pixel_tablet` profile; fallback: hide the button on that AVD and record it) |
| 4 | In the app, sign in once with a password, accept the biometric offer, sign out, tap the fingerprint button, then run `adb -s <serial> emu finger touch 1` | MA-07 |
| 5 | Rollback: `adb -s <serial> shell locksettings clear --old 1234` | hypothesis; removes the PIN (and with it the enrolled biometrics) |

### 6.4 Session lifetime

- The authenticated session lives **in memory only**. After a cold start or crash the operator signs in again (§5.6 "re-authenticates"). Route-sync then restores the monitor if a session is still recording.
- Idle timeout: 15 min → "Session expired".
- Lock console: Avatar menu.

### 6.5 Pairing

See §4.2. Unpaired tablets can still sign in in this demo. Unpaired state shows an amber trust line and a "Pair this tablet" link. Blocking unpaired sign-in is **not** proposed, because the book only says pairing is "preferred" (01 L554).

### 6.6 Keep-awake (S28)

`KeepAwakeController` subscribes to `session.state`:
- `activateKeepAwakeAsync('dems-session')` while PRECHECK, ARMED, RECORDING, STOPPING or FINALIZING;
- `deactivateKeepAwake('dems-session')` otherwise.

The stack-check screen keeps its own `useKeepAwake()` (row 18). The tag is released on sign-out only if no session is active.

---

## 7. Motion ("Gilded Calm" on Reanimated 4.5.1, worklets 0.10.1, Skia 2.6.2)

### 7.1 Token → Reanimated mapping (03M §2, Appendix A)

| Token (shared `motion`) | Reanimated / Skia |
|---|---|
| `duration.*`, `easing.*` | `withTiming(v, { duration, easing: Easing.bezier(...easing.luxe) })` |
| `spring.gentle` / `snappy` / `bouncy` | `withSpring(v, { stiffness, damping, mass })` (same numbers) |
| NEW `counter`, `meter`, `indicator` springs and ambient periods (03M §2.3; added by W-01, VM-20) | same pattern |
| R1 enter | `FadeInDown.springify().stiffness(170).damping(26).mass(1).delay(80 + i * 60).reduceMotion(ReduceMotion.System)`, capped at 8 items; the 12 px rise is tuned with `.withInitialValues()` (hypothesis H-MB-05; fallback: the builder's default offset) |
| R2 exit | `FadeOutUp.duration(160).easing(Easing.bezier(0.4, 0, 1, 1))`, no stagger |
| Layout (FLIP) | `LinearTransition.springify().stiffness(170).damping(26).mass(1)` |
| Shared elements (R5) | **Not used across routes.** `ENABLE_SHARED_ELEMENT_TRANSITIONS` is `false` in 4.5.1 (VM-05). Within one screen: layout transitions; across screens: cross-fade plus scale (03M Appendix A) |
| Proof mode (`?motion=slow`) | Every duration and stagger ×10 (`proofSlowFactor`); springs become `withTiming(slower × 10)` |
| Loops | `withRepeat(withSequence(...), -1)` on the UI thread; paused when the screen loses focus or the app goes to the background |

### 7.2 App-level transitions (mobile variants)

| ID | Mobile behaviour | Total | Reduced |
|---|---|---|---|
| M-APP-01 Login → Home | t0: the ring check draws (Skia `end` 0 → 1, 300 `luxe`), the ring flashes green then gold, haptic Success. t150: card exits (opacity, scale 0.96, y 8; 300 `exit`). t300: brand text fades. t450: the emblem scales 1 → 0.26 and translates toward the header logo slot, then `router.replace('/home')` with the Stack `fade` (240). t700: Home's header emblem enters with `ZoomIn` from 1.4 → 1, then panels stagger (R1). The status-card ring sweep lands last as the hero moment. This is the web's two-phase hand-off fallback (03M H-M1), because cross-route shared elements are off (VM-05) | ≤ 1,600 ms | 240 ms cross-fade |
| M-APP-02 Sign out | Reverse, compressed: panels fade, the emblem scales up from the header position on Login, the ring sweeps, the card rises; the "signed out" Alert enters last | ≤ 900 ms | cross-fade |
| M-APP-03 Cold entry | The native splash (`#0B0D0F`) hands over to a boot screen: the emblem strokes draw (shield 500 ms, then 6 arcs 70 ms apart) while fonts and the simulator hydrate. Once per app process | ≤ 1,400 ms | static emblem |
| M-APP-04 Route transitions | Stack `animation`: `fade` (tabs and auth), `slide_from_right` (drill-in, R7 forward), `fade_from_bottom` (entering the session flow). Tab switches cross-fade content 160 ms; panel stagger only on the first visit per process | exit 160 + enter ≤ 900 | cross-fade 160 |

### 7.3 Per-screen choreography

| Screen | Enter beats (ms from route enter) | Hero moment | Ambient loops (≤ 4, P3) | Data moments | 03M ref |
|---|---|---|---|---|---|
| Login | 0 backdrop fade-up (900) + Ken Burns; 200 ring layers sweep; 500 emblem scan and bloom; 900 wordmark rack focus (opacity + scale 0.98, because blur on text is not used on mobile), caption; 1,200 card rises 12 px and one border-beam lap (Skia dashed path, 6 s) | Emblem scan and bloom | Ring rotation, bracket breathing, Ken Burns, gold dust (Skia `Points`, ≤ 24) | M-C-22 states → M-APP-01 | M-PG-LOGIN |
| Home | 0 header; 120 status card; 250 tiles (stagger 50, values tick after the 120 ms held beat); 450 quick actions; 650 recent sessions (stagger); 900 GlowRing sweep last | Status ring sweep | Ring rotation, ring breathing, Start-button sheen (every 8 s), bell idle (none) | Idle → recording: status card morphs to REC + timer; new seal: toast + count tick | M-PG-DASH |
| Start Session | Stepper badges stagger; step content enters in the direction of travel (x ±24, `gentle`, R7) | Step 3 mini-ring sweep and optional 3-2-1 (each digit scales 1.1 → 1 over 600) | Mini-ring breathing (step 3) | Step 2 checks resolve in sequence (Spinner → check draw, WARN/BLOCK chip pulse once); Next enable glow | M-PG-NEW |
| Session Monitor | 0 header; 80 feed (opacity 0 → 1 over 600; CameraFeed paints); REC pulse starts; 140 MIC cards; 200 actions (stagger 40); 260 End Session | REC indicator + timer + breathing feed frame | REC pulse, feed frame glow, camera Ken Burns (in canvas), status-strip dot | Clip latch; Snapshot shutter + thumbnail flight to a counter chip; Bookmark chip flight to the History icon (badge pop) on phone or into the inline timeline on tablet; hold-to-confirm End Session | M-PG-SM |
| Finalizing | Card rises; steps resolve 0.6–1.2 s each | SEALED stamp (scale 1.2 → 1 `bouncy`, glow e3 flash, hairline ring) | none | — | M-C-09 |
| Evidence | Search + filters, then rows stagger (first 8, 30 ms) | List reveal | none | Filter re-flow (`LinearTransition` in FlashList); detail tab indicator slides (kit); Verify scramble → PASS pop | M-PG-EVID |
| Devices | Camera rows (posters fade in), audio rows, other devices | Large meters (detail) | Recording lamp breath (while recording) | Tablet-link OFFLINE escalation + Alert slide | M-PG-DEV |
| Storage | Ring sweep, legend stagger, activity rows | Capacity ring sweep | none | LOW/FULL colour morph + one pulse + toast | M-PG-STOR |
| Network & Time | System time slides, then the tier row, network rows, bandwidth bars | GNSS orbit | Orbit, bandwidth stream (data, not decoration) | GNSS loss: orbit fades, the tier indicator moves down to NTP (`indicator` spring) | M-PG-NET |
| Audit | Chain chip, list rows stagger | Chain status | Chain-head breath (subtle) | Live rows insert (M-C-07); tamper pulse | M-PG-SEC |
| Settings | List sections stagger | none | none | Switch toggles (kit); Run diagnostics progress | M-PG-SYS |

### 7.4 Component motions (03M §5 → mobile)

| 03M ID | Mobile implementation | Reduced |
|---|---|---|
| M-C-01 GlowRing | Skia: tick ring `Group` rotation `withRepeat(withTiming(360°, 60,000 ms, linear))`; bracket arcs trim `end` 0 → 1 (900 `luxe`, 120 ms apart); the glow copy (`BlurMask`) breathes 0.55 ↔ 1 over 2,400 ms; state colour via `interpolateColor` (600) | static final frame |
| M-C-02 Number tickers | C-6: `slide` for clock and timers (per-digit translateY, 240 `standard`); `count` for KPIs (`counter` spring) after the held beat | jump to the final value |
| M-C-03 Donut sweep | `Pie.Slice animate` (VM-12) from 0 to value (900 `luxe`); threshold colour change 400 | no sweep |
| M-C-04 dBFS meter | §5.4 path; peak hold 1.5 s then 20 dB/s; clip: the top segment locks red, a CLIP `Chip` pops (`bouncy`) with **one** flash (180 ms) + haptic Warning; NO SIGNAL fades segments to 0.12 over 400 and shows the label; paused monitoring dims to 0.35 | 10 Hz direct updates, no spring, no flash (meters stay functional) |
| M-C-05 REC indicator | dot opacity 1 → 0.35 → 1 and scale 1 → 0.9 → 1 over 1,200 ms (0.83 Hz); halo scale 1 → 2.2 fading 0.5 → 0 once per cycle | static red dot; the timer still ticks |
| M-C-06 Heartbeat pulse | Core link chip dot: scale 1 → 1.6, opacity 0.6 → 0 (600) on every heartbeat | none |
| M-C-07 List insertion | `entering={FadeInDown.duration(240)}` + `layout={LinearTransition}`; newest row gold highlight fades 0.18 → 0 over 1,500 ms; insertions coalesce at 400 ms (R9) | instant, highlight only |
| M-C-08 Timeline | line segment `scaleY` 0 → 1 (320), node pops (`bouncy`), text rises 8 px (240); newest node halo ×2 | instant |
| M-C-09 Stepper | connector fill `scaleX` 0 → 1 (420 `luxe`); badge pending → active (glow e2 + one pulse) → done (check draw 300); SEALED stamp | instant |
| M-C-10 Status chip morph | label cross-fade 120; colour 400; escalation-only halo pulse (600) | colour only |
| M-C-11 List reveals | first 10 rows stagger 30 ms (6 px rise); filter/sort via `LinearTransition` | no stagger |
| M-C-12 CameraFeed | in-canvas Ken Burns 1.00 → 1.06 over 30 s (Cam 2 phase +11 s), grain at 25 fps (fallback 12.5 fps, H-S18), scanline band every 6 s, burnt-in timestamp; first paint: opacity 0 → 1 over 600 (no blur on mobile); camera switch cross-fade 320; NO SIGNAL fades to grey noise (400) | no Ken Burns, frozen grain |
| M-C-13 Hero backdrop | Ken Burns on the Login backdrop | static |
| M-C-14 Toasts | kit Toast animations (D6); critical toasts hold a slow red glow | kit disables them (VM-04) |
| M-C-15 Dialogs and sheets | kit defaults (HeroUI Native Dialog, BottomSheet); static glow e3 on the panel | kit disables them |
| M-C-16 Press | `Button feedbackVariant="scale-highlight"` (kit default, VM-03) + haptics; pressable cards scale 0.98 with the `snappy` spring | kit handles it |
| M-C-17 Marker flight | within the monitor: a chip travels to the History icon (phone) or into the inline timeline (tablet) with the `gentle` spring (≈ 520 ms) | node appears directly |
| M-C-18 Snapshot | white shutter 0 → 0.85 → 0 in 180 ms (one flash, P8), thumbnail flies to a snapshot-count chip, badge pops, toast | border highlight only |
| M-C-19 Hold to confirm | fill `scaleX` 0 → 1 over 1,500 ms linear; early release springs back (`snappy`); haptics light at 0% and 50%, heavy at 100%; then the reason Dialog. TalkBack users get the Dialog directly on activation | no fill animation; the Dialog opens on press |
| M-C-20 Pause monitoring | icon morph; feed and meters dim; REC keeps pulsing | dim only |
| M-C-21 Hash verify | 600 ms scramble of the shown hashes, PASS pop + green glow; FAIL red pulse (no shake) | final text immediately |
| M-C-22 Login states | error: one card shake `x: [0, -6, 6, -4, 4, 0]` over 300 ms (P7) + haptic Error; lockout: lock shackle closes (rotate 20° → 0), ring → amber, countdown C-6; Core offline: chip turns red and breathes | red border, no shake |
| M-C-23 Ambient accents | Login gold dust (Skia `Points`), Start-button sheen (gradient translate every 8 s), Network GNSS orbit, recording lamp breath, login-card border-beam lap | off |
| M-C-24 Loading | kit `Skeleton variant="shimmer"` and `SkeletonGroup` on the first load after hydration | static skeleton (kit) |
| M-C-25 Focus | kit focus styles for hardware-keyboard navigation (`hw.keyboard=yes` on both AVDs) | same |

### 7.5 Mobile-only motion IDs (extensions; 03M is not edited)

| ID | Element | Motion | Reduced |
|---|---|---|---|
| M-MB-01 | Nav active indicator (tab-bar pill, rail inset card) | Moves with the `indicator` spring; its glow layer fades e2 → e3 → e2 while travelling; icon colour cross-fades 240; haptic selection | jump |
| M-MB-02 | Live mini-bar | Enters from y −24 with the `gentle` spring and opacity; REC pulse; exits (160) when the session stops | fade |
| M-MB-03 | Rotation and split-screen re-flow | Panes use `LinearTransition`; the chrome swap (bottom bar ↔ rail) cross-fades 160 | instant |
| M-MB-04 | Connection banner (T15) | Slides down from under the header (240); Spinner; on resync it morphs green "Resynced" for 1.2 s, then exits | fade |
| M-MB-05 | Boot and hydration | Native splash → emblem draw (M-APP-03) → Skeleton if hydration exceeds 2 s | static |

### 7.6 Haptics map (`expo-haptics`)

| Event | Call |
|---|---|
| Tab, rail, filter chip, segmented or stepper selection; `Switch` toggle | `selectionAsync()` |
| Primary button press (Sign In, Next, Save) | `impactAsync(Light)` |
| Start Recording | `impactAsync(Medium)` |
| End Session hold completes | `impactAsync(Heavy)` |
| Sign-in success, pairing success, Verify PASS, SEALED stamp | `notificationAsync(Success)` |
| Gate WARN, MIC clip latch, Storage LOW, Core link lost | `notificationAsync(Warning)` |
| Sign-in failure, lockout, gate BLOCK, critical FAULT, Verify FAIL | `notificationAsync(Error)` |

- **Rules:** at most one haptic per 400 ms (coalesced); never tied to 20 Hz data; off when the in-app Haptics switch is off.
- Haptics are **not** reduced by reduce-motion; they are a separate preference.

### 7.7 Reduced motion

| Source | How it is read |
|---|---|
| OS setting | Live: `AccessibilityInfo.isReduceMotionEnabled()` plus the `reduceMotionChanged` listener (RN reads `TRANSITION_ANIMATION_SCALE == 0`, VM-06). Start-time: Reanimated's `useReducedMotion()` (VM-05) |
| In-app override | Settings → App Preferences → Reduce motion, persisted in `dems.mobile.prefs.v1` |

- **Wiring:** `useMotionPolicy()` returns `'full' | 'reduced'` (OS **or** override). It sets:
  - `<ReducedMotionConfig mode={reduced ? ReduceMotion.Always : ReduceMotion.Never}>` (explicit modes, because `ReduceMotion.System` would only use the start-time value, VM-05);
  - `HeroUINativeProvider config.animation = 'disable-all'` when reduced (VM-04);
  - a `motion` prop on compositions that stops loops, removes flights and turns meters into 10 Hz direct updates.
- **Behaviour** follows the 03M §8 table: loops off, enters and exits become opacity ≤ 160 ms, flights become cross-fades, tickers jump, flashes become static colour, the shake becomes a red border, REC is a static dot, charts do not animate.
- **Test hook:** `adb shell settings put global transition_animation_scale 0`, then force-stop and relaunch (MA-18). Restore with `… 1`.

### 7.8 Performance budget

| Budget | Value | How it is enforced |
|---|---|---|
| Frame rate | 60 fps target (16.7 ms) on the UI thread | All animation in worklets or Skia; no `setState` in animation paths |
| React renders from live data | 0 per audio frame; text ≤ 4 Hz (dBFS in Skia, so 0 React renders), timers and clocks 1 Hz | §5.4; MA-16 |
| Ambient loops per screen | ≤ 4, including chrome (P3) | §7.3; loops register with `useMotionPolicy` (the debug overlay lists them) |
| Animated Skia canvases on screen | ≤ 3 on compact (monitor: feed + 2 meters), ≤ 5 on expanded | Screen design; off-screen and unfocused canvases pause (`useIsFocused`, `AppState`) |
| Lists | `FlashList` for any list that can exceed about 10 rows (evidence, audit, sessions, activity) | code review |
| Images | Backdrop ≤ 1600 px wide; thumbnails through `expo-image` crops (no canvas per row) | §8 |
| Measurement | `adb shell dumpsys gfxinfo com.dems.demo.tablet reset`, 30 s of the scenario, then `adb shell dumpsys gfxinfo com.dems.demo.tablet` → "Janky frames" and "90th percentile"; plus the `?debug=1` overlay (UI-thread fps from `useFrameCallback`, JS fps from `requestAnimationFrame`, meter frames per second, active loops) | MA-17 |

- **Emulator thresholds are informational** (hypothesis): Janky ≤ 10%, 90th percentile ≤ 20 ms, overlay UI fps ≥ 55. They run on `gfxstream` over Metal on an Apple M5 host (01S §6.3, V35), which is not representative of an Android tablet (03M R-M2).
- Skia may draw into its own surface, so `gfxinfo` can under-count Skia frames (hypothesis H-MB-07). The overlay's UI-thread fps is therefore the primary figure.
- **Physical-device note:** no physical tablet is in scope. Before a customer demo, run the same checks on a physical arm64 Android tablet over USB. `adb reverse` works identically (01S §2.4). A release-variant build gives more representative numbers than the debug build, whose JS runs in development mode (UI-thread animations are largely unaffected). Final performance judgement is deferred to that device.

---

## 8. Assets

### 8.1 Brand

| Asset | Mobile use | Source | Format |
|---|---|---|---|
| Emblem | Header (32 dp), Login ring centre, boot draw | W-04's recreated SVG (7 path IDs: `emblem-shield`, `emblem-arc-1..6`, 01S §14.10). **SCR-03**: the path data as a TypeScript module in `packages/shared`, so web and mobile render one source | `react-native-svg` `Svg`/`Path`/`LinearGradient` (static; gradient `#FFE2A6 → #FFC86B → #C9802F`); Skia `Path` with animated `end` for the draw |
| App icon, adaptive icon, monochrome, splash | `app.json` `icon`, `android.adaptiveIcon.foregroundImage` / `monochromeImage` (background `#0B0D0F`), `expo-splash-screen` `image` | **SCR-03**: PNG exports (1024 px foreground on transparent, monochrome, splash) | PNG; replaces the Expo template images |
| Wordmark | Header, Login | live text (Orbitron) | — |
| Topographic texture | Login backdrop, rail foot | W-04's generated SVG (01S §14.10). **SCR-06**: SVG string available from shared | `react-native-svg` `SvgXml` |

### 8.2 Photography

- **The MB 1 officer photo is never used, cropped or traced** (D28, 04 §7). MA-24 checks for this.
- **Room still:** the W-05 photo (Pexels or Unsplash, licence recorded in `THIRD_PARTY_NOTICES.md`, 01S §14.10), or its procedural fallback. The mobile variant is ≤ 1600 px wide at JPEG quality 80, made with macOS `sips`. **SCR-04** covers the location and the mobile-use line in the notices.
- **Uses:** Login backdrop (graded), CameraFeed source image, evidence and session thumbnails (`expo-image` with `contentFit="cover"`, a seeded `contentPosition` per item, and a warm grade overlay).

### 8.3 Camera feeds: procedural (Skia)

`CameraFeed({ cameraId, mode: 'live' | 'poster' | 'playback', source?: { uri } })`:
- **Image:** Skia `Image` from `useImage(require('…/room-1600.jpg'))`. Cam 1 is a wide crop; Cam 2 is a mirrored reverse-angle crop (web parity, 01S §14.10).
- **Motion:** Ken Burns via a `Group` transform.
- **Grain:** `FractalNoise` shader blended at 6–8%, re-seeded at 25 fps.
- **Scanline:** a `Rect` band at 8% opacity.
- **Timestamp:** Skia `Text` in JetBrains Mono (`useFont`), UTC+07:00, from the shared formatter.
- **Overlays:** kit `Chip`s outside the canvas.
- **No video files** (D31). `source={{ uri }}` switches to `expo-video` `VideoView` (muted, looped) when clips exist, with no API change.

### 8.4 Additive dependencies (for the single mobile dependency row; R-1 / R-2)

| Package | Version | Rule | Why | Evidence |
|---|---|---|---|---|
| `zustand` | 5.0.15 | R-2 | Simulator bindings; the same hoisted copy as shared and web (D30) | VM-10, VM-15 |
| `i18next` | 26.4.2 | R-2 | Shared resources (§9); same pin as web | VM-10 |
| `react-i18next` | 17.0.15 | R-2 | React binding; same pin as web | VM-10 |
| `expo-local-authentication` | ~57.0.3 | R-1 | Biometric sign-in (D30) | VM-09, VM-13 |
| `@react-native-async-storage/async-storage` | 2.2.0 | R-1 | Simulator persistence (§5.3) | VM-09, VM-10, VM-16 |
| `react-native-keyboard-controller` | 1.21.9 | R-1 | Keyboard handling under edge-to-edge (§2.6) | VM-09, VM-10 |

Each is installed **only if row 18 (D30) has not already installed it**. `app.json` gains the `expo-local-authentication` plugin; the Android permissions `USE_BIOMETRIC` and `USE_FINGERPRINT` come from it (VM-13).

---

## 9. Internationalisation

- **Runtime:** `i18next` 26.4.2 + `react-i18next` 17.0.15, initialised in `apps/mobile/src/i18n/index.ts` with `lng: 'en'`, `fallbackLng: 'en'`, `interpolation: { escapeValue: false }`, and a development `missingKeyHandler` that records misses (MA-21).
- **Resources:** the shared `en` object from `packages/shared/src/i18n/en.ts` (W-03), deep-merged with a mobile namespace `apps/mobile/src/i18n/en.mobile.ts` (`mobile.*`: tab labels, rail, biometric, pairing, mini-bar, back-guard dialog, haptics, Core link source). Shared keys cover every common term (statuses, enums, subject types, page copy), so web and mobile say the same thing. **SCR-05** asks for the `./i18n` export and deep-mergeable plain objects.
- **Language rule (D28/Q3):** English UI. Indonesian domain terms stay verbatim: **Tersangka**, **Saksi**, **Lainnya** (EN glosses Suspect, Witness, Other in `accessibilityHint` and the long-press Popover), ranks such as "AKP", the case prefix "LP/", and "SEDANG MEREKAM". The `id` locale is out of scope (A10); the keys-from-day-one rule makes it additive later.
- **Dates and times:** UTC+07:00 (D28/Q2), rendered through the shared **arithmetic** formatters (`formatClock`, VM-19; `formatDate` requested in SCR-05), not `Intl` time-zone support on Hermes (hypothesis H-MB-08, avoided by design). Tabular figures (`fontVariant: ['tabular-nums']`) for live values.

---

## 10. Testing

### 10.1 Unit and component tests (jest-expo ~57.0.5, jest 29.7.0, RNTL 13.3.3)

**Configuration:** the 01S §8 settings, moved to `apps/mobile/jest.config.js` by the dependency row (so later rows never edit `package.json`), with these additions:
- `@noble/.*` in the `transformIgnorePatterns` allowlist (ESM only, VM-15);
- the AsyncStorage mock (VM-16);
- explicit mocks for `expo-local-authentication` and `expo-haptics`;
- Skia compositions mocked at module level. Their maths live in pure TypeScript functions that are tested directly; Skia rendering is proven on device (01S §8 N-1 precedent);
- routing tests use `renderRouter` from `expo-router/testing-library` (VM-08).

| Test | File | Proves |
|---|---|---|
| T-M01 | `src/layout/use-layout-class.test.ts` | 411x923 → compact; 923x411 → compact-landscape; 800x1280 → medium; 1280x800 → expanded (extended rail); 640x800 → medium; 500x800 → compact |
| T-M02 | `src/app/__tests__/routes.test.tsx` | Every route in §3.1 renders its `screen-<id>` when signed in (MA-04) |
| T-M03 | `src/app/__tests__/guard.test.tsx` | Unauthenticated `/evidence` → `/login`; after sign-in → the pending href; the resync target wins when recording (MA-05) |
| T-M04 | `src/features/login/login.test.tsx` | Generic error, 5 failures → locked alert with countdown, Core-offline alert, demo operators hidden in presentation mode (MA-06) |
| T-M05 | `src/auth/biometric.test.ts` | success, `user_cancel`, `lockout`, `not_enrolled`, `authentication_failed` branches (MA-07) |
| T-M06 | `src/runtime/route-sync.test.ts` | The §3.7 table, row by row (MA-08) |
| T-M07 | `src/runtime/sim-adapters.test.ts` | AsyncStorage round trip; no tick before hydration; AppState pause and resume (MA-08) |
| T-M08 | `src/features/session-live/back-guard.test.tsx` | Back during RECORDING opens the Dialog and the state stays RECORDING (MA-09) |
| T-M09 | `src/components/composed/dbfs-meter.test.tsx` | Segment maths; 40 fake audio frames → **one** render of the meter (MA-16) |
| T-M10 | `src/features/session-new/precheck.test.tsx` | BLOCK, WARN + acknowledgement, PASS paths with fake timers (MA-29, MA-30) |
| T-M11 | `src/i18n/missing-keys.test.tsx` | Rendering every screen records 0 missing keys (MA-21) |
| T-M12 | `src/motion/policy.test.tsx` | OS reduce-motion or the override → loops off, `animation: 'disable-all'` (MA-18) |
| T-M13 | `src/features/home/home-screen.test.tsx` | Row-18 N-1, unchanged (continuity) |
| T-M14 | `src/motion/haptics.test.ts` | The §7.6 map and the 400 ms coalescing (MA-20) |
| T-M15 | `src/features/evidence/evidence-list.test.tsx` | Filters, search, selection → detail pane in a mocked expanded window (MA-12) |

### 10.2 End-to-end: Maestro evaluation

| Criterion | Finding (VM-17) |
|---|---|
| Ready-made, local | Yes: YAML flows run by `maestro test` against a local emulator |
| Licence | Apache-2.0 |
| Account or cloud | Not needed for `maestro test`; only `maestro cloud` needs login |
| Telemetry | Analytics prompt exists; disable with `MAESTRO_CLI_NO_ANALYTICS=true` (PR #1848) and `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true` |
| Runtime | Java 17+ (JDK 17.0.20.1 is installed, 01S §6.4) |
| Install channel | **Not** the curl installer: it touches and appends to `~/.zshrc`, which would break AC-10 (`~/.zshrc` must stay absent). Use the pinned `cli-2.11.0` `maestro.zip` (314,886,578 B, sha256 `5384593c…1283a`), verified against `checksums_sha256.txt`, unzipped into `~/.maestro`, and invoked by absolute path. No profile edit |
| Host impact | ~300 MiB download, `~/.maestro` (binaries and test output). Rollback: `rm -rf ~/.maestro` |
| AVD impact | Maestro installs its driver apps on the device (hypothesis: `dev.mobile.maestro` and `dev.mobile.maestro.test`). Rollback: `adb uninstall` each |
| Sandbox | Outside the sandbox, like every adb/emulator step (D24) |
| Selectors | `id:` matches RN `testID` through the resource-id mapping (VM-06) |
| Freshness | 2.11.0 was published 2026-09-29. If it misbehaves, pin the previous CLI release (same procedure) |

**Recommendation: YES, as an optional row that the user approves at the Mobile Approval Gate** (a new host tool, D14 scope). Flows in `apps/mobile/e2e/maestro/`:
1. `01_login.yaml`: launch, tap a demo operator, Sign In, assert `screen-home`.
2. `02_session_flow.yaml`: Start Session → fill → Next → acknowledge → Start → assert REC → hold End Session → reason → assert `screen-session-summary` with SEALED → Evidence shows the new row.
3. `03_evidence_detail.yaml`: open an item → Hash & Integrity → Verify → assert PASS.
4. `04_navigation.yaml`: visit every tab or rail destination.

Each flow runs on both AVDs. Biometric and rotation checks stay adb-driven (MA-07, MA-13).

**If declined:** the verifier drives the same paths with deep links, `adb shell input`, `uiautomator dump` and screencaps (slower, less robust). No host change.

---

## 11. Acceptance criteria (MA-01..MA-30)

Preconditions for runtime checks: the AVD is booted outside the sandbox (D24) and its lock is held (D35); the app is installed; `adb -s <serial> reverse tcp:8081 tcp:<lane Metro port>` and `tcp:4400 tcp:4400` are set; mock-core is running where stated. `<pkg>` = `com.dems.demo.tablet`. Screenshots go to `docs/…/implementation/assets/mobile/` and are linked from the row log.

| AC | Check (command-level) | Pass condition | Maps to |
|---|---|---|---|
| MA-01 | `npm ls -w @dems/mobile --depth=0 zustand i18next react-i18next expo-local-authentication @react-native-async-storage/async-storage react-native-keyboard-controller heroui-native uniwind victory-native @shopify/react-native-skia @shopify/flash-list @gorhom/bottom-sheet expo-haptics expo-keep-awake expo-blur expo-linear-gradient expo-video`; `npm ls zustand react react-native --all \| grep -oE '(zustand\|react\|react-native)@[0-9.]+' \| sort -u` | Pins per 01S §1.4 and §8.4; exactly one `zustand@5.0.15`, `react@19.2.3`, `react-native@0.86.3` | §8.4, D30 |
| MA-02 | `cd apps/mobile && npm run deps:check && npm run doctor && npm run prebuild`; `grep -c 'USE_BIOMETRIC' android/app/src/main/AndroidManifest.xml`; then AC-25 greps | All exit 0; count ≥ 1; still no orientation lock or opt-out | §6.3, D17 |
| MA-03 | `npm run typecheck -w @dems/mobile && npm run lint -w @dems/mobile && npm test -w @dems/mobile` | Exit 0; ≥ 15 test files (T-M01..T-M15) pass | §10.1 |
| MA-04 | `npm test -w @dems/mobile -- src/app/__tests__/routes.test.tsx` | Every §3.1 route renders its `screen-<id>` | §1, §3 |
| MA-05 | `… guard.test.tsx` | Guard redirects; pending href honoured; resync precedence | §3.3 |
| MA-06 | `… login.test.tsx`; plus shared AC-50 | Lockout after 5 failures with a live countdown; generic error; audit rows as AC-50 | §6.1 |
| MA-07 | Jest `… biometric.test.ts`; on device after §6.3 enrolment: tap the fingerprint button, `adb -s <serial> emu finger touch 1`, `adb exec-out screencap -p` | All branches pass; the screenshot shows `screen-home`; the Audit screen lists AUTH_SUCCESS (BIOMETRIC) | §6.3, D30 |
| MA-08 | Device, `?scenario=recording`: note the timer; `adb shell am force-stop <pkg>`; relaunch; sign in | Lands on `/session/live` without extra taps; timer ≥ the noted value + elapsed wall time (±2 s); no second session in Sessions | §3.7, §5.3, §5.6 |
| MA-09 | Device, RECORDING on the monitor: `adb shell input keyevent KEYCODE_BACK`; screencap; then choose Go to Home | The Dialog is visible; after "Go to Home" the mini-bar shows REC and the timer; state is still RECORDING | §3.6 |
| MA-10 | Heartbeat mode: mock-core running → Core chip "Live"; `kill -TERM <mock PID>`; screencap within 5 s; open Start Session step 2; restart mock-core | "Offline" banner within `HEARTBEAT_STALE_AFTER_MS` + reconnect (≤ 5 s); step 2 Core check BLOCK; after restart: banner "Resynced", chip Live | §4.4, §5.5 |
| MA-11 | `dems_phone` portrait: for each MB screen open its deep link (§3.5) and `adb exec-out screencap -p > …/mb<n>_phone.png`; build a contact sheet with Pillow next to the 3x MB crops | Each screenshot is 1080x2424 and contains the MB regions of §4 in the same order (checklist in the row log); differences are only the recorded decisions (violet Sealed, 20% used, 2 cameras, "End Session", no officer photo) | D17, §4 |
| MA-12 | `dems_tablet` landscape: open `/evidence?selected=<id>`, `/session/live` (scenario recording), `/home`; `adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml $TMPDIR/`; `grep -oE 'resource-id="(nav-rail\|pane-[a-z-]+)"' $TMPDIR/ui.xml \| sort -u` | Frame 2560x1600; `nav-rail` present with 8 destinations; Evidence shows `pane-list` and `pane-detail`; the monitor shows `pane-feed`, `pane-meters`, `pane-timeline` | §2.4 |
| MA-13 | Each AVD: open Evidence (tablet: with a selection) and start `?scenario=recording`; `adb emu rotate`; screencap; `uiautomator dump` | Tablet → 1600x2560 with `nav-rail` (88 dp, labels); phone → 2424x1080 with the icon-only rail; the selection is kept and the timer keeps running; no restart (same PID from `adb shell pidof <pkg>`) | §2.5, D17 |
| MA-14 | Phone landscape: `uiautomator dump`; read the bounds of `nav-rail` and the first content element; `adb shell dumpsys window \| grep -i cutout` | No interactive element lies inside the cutout inset; the tab bar and the End Session button sit above the bottom inset | §2.6 |
| MA-15 | `adb shell am start -W -a android.intent.action.VIEW -d "demsdemo://?motion=slow" <pkg>` (the AC-31 procedure) and `demsdemo:///login?motion=slow`; screencaps at 1.0 s and 8.0 s | The mid frames differ from the final frames on both screens; AC-31 still passes unchanged | §3.1, M-PX-02 |
| MA-16 | `… dbfs-meter.test.tsx`; `grep -rnE "useState\|setState" apps/mobile/src/components/composed/dbfs-meter.tsx`; `grep -rn "useAudioChannel" apps/mobile/src \| grep -v runtime/` | 1 render for 40 frames; no React state in the meter; `useAudioChannel` is used only in `src/runtime/` | §5.4, S3 |
| MA-17 | On each AVD, `?scenario=recording&debug=1` on the monitor: `adb shell dumpsys gfxinfo <pkg> reset`; wait 30 s; `adb shell dumpsys gfxinfo <pkg> \| grep -E 'Total frames\|Janky frames\|90th percentile'`; screencap the overlay | Recorded. Informational pass: Janky ≤ 10%, 90th ≤ 20 ms, overlay UI fps ≥ 55. A miss is recorded with the H-S18 fallback applied, not a blocker (physical-device note, §7.8) | §7.8 |
| MA-18 | `adb shell settings put global transition_animation_scale 0`; `adb shell am force-stop <pkg>`; relaunch to `/home`; two screencaps 2 s apart; crop the ring bounds with Pillow and diff; repeat with the in-app switch; restore `… 1` | Ring region identical (loops off); the meters on the monitor still change; `T-M12` passes | §7.7 |
| MA-19 | During RECORDING: `adb shell dumpsys window \| grep -c KEEP_SCREEN_ON`; after the session is sealed, the same command | ≥ 1 while recording; 0 when idle (hypothesis on the dump format; fallback: `settings put system screen_off_timeout 15000`, wait 25 s, `dumpsys power \| grep mWakefulness` shows Awake while recording; restore the timeout) | §6.6, S28 |
| MA-20 | `… haptics.test.ts`; `grep -rn "Haptics\." apps/mobile/src \| grep -v motion/haptics` | The map and throttle pass; every haptic goes through the one service | §7.6 |
| MA-21 | `… missing-keys.test.tsx`; `grep -rnE "Tersangka\|Saksi\|Lainnya" apps/mobile/src/features` | 0 missing keys; the ID terms come from i18n keys, not literals | §9, D28/Q3 |
| MA-22 | `grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?" apps/mobile/src/features apps/mobile/src/components` | No matches: every colour comes from `@dems/shared/tokens` or kit classes | D16, D31 |
| MA-23 | `ls apps/mobile/src/components/composed`; `grep -rnE "export (default )?(function\|const) (Button\|Card\|Chip\|Tabs\|Switch\|Dialog\|Toast\|Select\|TextField)\b" apps/mobile/src` | Only C-1..C-6 (plus their `nav/` subfolder); no re-implemented kit primitive | D6, §4.0 |
| MA-24 | `grep -rn "DEMS-Mobile" apps/mobile`; `shasum -a 256 apps/mobile/assets/images/hero/*`; `grep -n "apps/mobile" THIRD_PARTY_NOTICES.md` | No reference to the mockup; the hero file is the W-05 photo (or its recorded derivative); the notices name the mobile use | D28, §8.2 |
| MA-25 | `grep -rnE "https?://" apps/mobile/src \| grep -vE "127\.0\.0\.1\|localhost\|CORE_(HTTP_ORIGIN\|WS_URL)"` | No matches: the app talks only to loopback through the shared constants | NFR1 |
| MA-26 | AC-27 (no EAS, no `expo-updates`, no projectId); `grep -c "MAESTRO_CLI_NO_ANALYTICS=true" apps/mobile/package.json` if Maestro is approved | AC-27 passes; the e2e script sets the analytics opt-out | NFR1, §10.2 |
| MA-27 | If approved: `MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true ~/.maestro/bin/maestro --device <serial> test apps/mobile/e2e/maestro --format junit --output $TMPDIR/maestro-<avd>.xml` on each AVD | Exit 0; 4 flows pass on both AVDs; `test ! -e ~/.zshrc` still holds | §10.2 |
| MA-28 | `grep -rln "@dems/shared/sim" apps/mobile/src`; `git diff --stat <baseline> -- packages/shared/src/sim` restricted to commits of M-rows | ≥ 1 importer; M-rows changed nothing under `packages/shared/src/sim` | D19, D33 |
| MA-29 | Device (phone, then tablet): Start Session steps 1 → 2 → 3 → Start → wait 20 s → hold End Session → reason → wait; screencaps of step 2, live, finalizing, summary, Evidence | Step 2 resolves 8 checks ≤ 5 s; live shows REC and a ticking timer; FINALIZING → SEALED ≤ 10 s; summary shows a **violet** SEALED chip; the new EV row is first in Evidence; the Audit screen lists SESSION_CREATED, PRECHECK_PASSED, RECORDING_STARTED, RECORDING_STOPPED, EVIDENCE_SEALED | §1.3, AC-62/63 parity |
| MA-30 | Settings → Maintenance → Demo controls: "MIC 2 clip", then "Storage full"; screencaps of the monitor and step 2 | MIC 2 CLIP latch + warning toast; Storage FULL → Home tile red, step 2 BLOCK with the reason | §4.15, AC-65 parity |

---

## 12. Open questions and gaps from the mockups

| # | Gap | Evidence | Resolution in this spec | Status |
|---|---|---|---|---|
| G-M1 | Officer with POLRI insignia on the login backdrop | MB 1 (50–300, 15–540); 04 §7 | Licensed room still + abstract texture | **Decided** (D28) |
| G-M2 | "Sealed" is gold with a lock on mobile, violet on DS/AS | MB 5 (1410–1465, 150–172), MB 6 (226–293, 648–668); 04 §9 #9 | Violet `sealed` tone, lock icon kept | **Decided** (D28/Q4) |
| G-M3 | Mixed EN/ID copy | MB 3 (660–880, 243–263); 04 §9 #3 | EN UI, ID subject types verbatim, EN glosses | **Decided** (D28/Q3) |
| G-M4 | "Camera 1/1" and one camera in the Devices list, versus 2 cameras on the web | MB 2 (360–425, 175–225); MB 7; 04 §9 #7 | 2 cameras (canonical dataset) | **Decided** (01S §14.7) |
| G-M5 | Storage "80%" is the free share | MB 8 ring; MB 2 tile; 04 §9 #4, #36 | 20% USED | **Decided** (D28/Q1) |
| G-M6 | Avatar "IR" vs AKP Budi Santoso | MB 2 (563–588, 45–68); 04 §9 #29 | Initials from the name ("BS") | **Decided** (01S §14.12) |
| G-M7 | "Stop Session" vs the web's "End Session" | MB 4 (952–1180, 468–510); 04 §9 #27 | "End Session" (one verb pair) | **Decided** (01S §14.12); the user may prefer the book's "STOP SESSION" — say so at the gate |
| G-M8 | The "Sessions" tab has no screen | MB 2 tab bar | Sessions hub (§4.9) | Derived |
| G-M9 | The "More" root list is not drawn | MB 8, MB 10 highlight More | More list (§4.17) | Derived |
| G-M10 | Meaning of MB 4's icons: header right (history), "Bookmark", "Audio Monitor", "Settings" | MB 4 (1160–1185, 50–70), (948–1185, 403–455) | Timeline sheet; Add Marker; large-meter sheet; session settings with UI-only Pause Monitoring | **Hypothesis** — confirm with the designer |
| G-M11 | MB 3 header right icon | MB 3 (865–885, 50–70) | "Load last session profile" | **Hypothesis** |
| G-M12 | MB 5 header right icon (list) | MB 5 (1455–1480, 50–70) | Sort and density menu | **Hypothesis** |
| G-M13 | MIC 1 "Investigator" vs "Interviewer" | MB 7 (410–495, 752–765); 04 §9 #8 | "Interviewer" (canonical) | **Decided** (01S §14.7) |
| G-M14 | No loading, empty, offline, lockout, fault, finalizing or recovery states drawn | all MB; 04 §9 #38, #40 | Kit Alert, Skeleton, derived screens | Derived |
| G-M15 | **Web and mobile run two independent simulators**: a session started on the tablet does not appear on the web console | D19 (sim in-app), D31 (no mock-core extension) | Accepted for this demo: each app simulates its own Core; only the heartbeat is shared | **Decision candidate** — a shared session would need a mock-core relay (MAJOR, out of scope) |
| G-M16 | Biometric enrolment on the `pixel_tablet` profile is unproven | §6.3 | Fallback: hide the button on that AVD and record it | Hypothesis H-MB-04 |
| G-M17 | No physical tablet for performance judgement | R3, 03M R-M2 | Emulator figures informational (§7.8) | Open (user) |
| G-M18 | Maestro host install (~300 MiB, `~/.maestro`, driver apps on the AVDs) | §10.2 | Optional row; adb fallback | **Gate decision** |
| G-M19 | App name and ID say "tablet" but also run on the phone | 01S §5.1 note | Kept unchanged (identifiers already in use) | Decided (01S) |
| G-M20 | Indonesian locale | A10 | Out of scope; keys ready | Deferred |

---

## 13. Shared-contract requests (for the controller)

The mobile rows never edit `packages/shared` (D33, D35 rule 5). These requests go to the owning web rows. Each has a mobile-side fallback, so none blocks the mobile lane outright.

| # | Request | Owner row | Why mobile needs it | Mobile fallback if refused |
|---|---|---|---|---|
| **SCR-01** | `createSim()` accepts platform adapters: `storage` (a zustand `PersistStorage`; default `sessionStorage`), `visibility` (`{ isHidden(), subscribe(cb) }`; default `document`), and returns `ready: Promise<void>` after hydration. No unguarded `document`, `window`, `sessionStorage`, `localStorage`, `crypto.randomUUID` or other Web-only globals under `src/sim/**` (IDs from the seeded RNG). Audio frames are plain numbers and booleans. Add a shared test `test/sim-platform-neutral.test.ts` (runs the engine with injected adapters and no DOM globals) | W-02 (preferred in its first pass; otherwise W-02b before M-06) | §5.2: React Native has no DOM or `sessionStorage`; AsyncStorage hydrates asynchronously | Polyfill `globalThis.sessionStorage` with a synchronous in-memory map that is flushed to AsyncStorage, and a fake `document.hidden` (fragile) |
| **SCR-02** | Simulator additions: `pairing` slice + `pair(code)` / `unpair()` with audit rows; `signInWithBiometric(operatorId)` (audit method BIOMETRIC); `lastSealedSessionId` + `acknowledgeSummary(id)`; `sessionHistory` (including incomplete sessions); a `setTabletLink(state)` input | W-02 / W-02b | §4.2, §6.3, §3.7, §4.9, §4.12 | App-local state for pairing, the biometric flag and summary acknowledgement (no audit rows for them) |
| **SCR-03** | Brand exports: the emblem path data as `packages/shared/src/brand/emblem.ts` (viewBox, `shield`, `arcs[6]`, gradient stops), in sync with `emblem.svg`; PNGs: 1024 px foreground on transparent, 1024 px monochrome, splash 1024 px | W-04 | §8.1: react-native-svg and Skia draw from path data; Expo icons need PNG | The mobile row copies the path data from `emblem.svg`; macOS `qlmanage -t -s 1024` renders the PNGs (hypothesis) |
| **SCR-04** | Hero still in a shared location (for example `packages/shared/assets/hero/`) plus a ≤ 1600 px mobile variant, and a `THIRD_PARTY_NOTICES.md` line that names mobile use | W-05 | §8.2 one licence record, one file | The mobile row copies the W-05 file into `apps/mobile/assets/images/hero/` and appends the notice line in a slot where no web row writes that file |
| **SCR-05** | `@dems/shared` `exports` gains `"./i18n"`; `en.ts` is a plain nested object that can be deep-merged; subject-type EN gloss keys; an arithmetic `formatDate` (no `Intl` time zone) next to `formatClock` | W-03 (the `package.json` exports edit belongs in W-01's lockfile-writer slot or W-03) | §9 | Import by relative path and keep a local `formatDate` |
| **SCR-06** | Topographic SVG available as a string or module from shared (the `gen-topo.ts` output) | W-04 | §8.1 | Copy `topo.svg` into mobile assets |
| **SCR-07** | The NEW motion tokens (03M §2.3) exported from `tokens.ts` as plain numbers and `{ stiffness, damping, mass }` objects | W-01 (already planned) | §7.1 | Local constants mirroring 03M §2.3 |

---

## 14. Risks and hypotheses

| # | Item | Type | Fallback | Checked in |
|---|---|---|---|---|
| H-MB-01 | A headless `TabTrigger` can be hidden while its route stays a tab (compact More destinations) | hypothesis | `router.push` from More into those routes | M-03 |
| H-MB-02 | Gradient wordmark via masked `expo-linear-gradient` | hypothesis | Flat gold text | M-07 |
| H-MB-03 | `expo-blur` Android blur on the chrome is cheap enough | hypothesis | Translucent `#0B0D0FE6` | M-03, MA-17 |
| H-MB-04 | `locksettings set-pin` and `BIOMETRIC_ENROLL` work on both AVD images; the `pixel_tablet` profile supports fingerprint | hypothesis | Settings UI path; hide the button on that AVD | M-07 |
| H-MB-05 | `FadeInDown.withInitialValues()` sets the rise distance | hypothesis | Builder default offset | M-02 |
| H-MB-06 | Under edge-to-edge (SDK 36) the window does not resize for the IME | hypothesis | `react-native-keyboard-controller` handles both cases | M-06..M-09 |
| H-MB-07 | `gfxinfo` under-counts Skia frames | hypothesis | The overlay's UI-thread fps is primary | MA-17 |
| H-MB-08 | Hermes `Intl` time-zone support is unreliable | hypothesis (avoided) | Shared arithmetic formatters | §9 |
| H-MB-09 | The debug APK loads its bundle from device `localhost:8081`, so `adb reverse tcp:8081 tcp:<lane port>` lets each coder use its own Metro port (D35) | hypothesis | Lanes share one Metro on 8081 under the emulator lock | M-01 |
| H-MB-10 | FlashList v2 recycling works with `entering` animations | hypothesis | Entering only on first mount; `LinearTransition` for re-flow | M-12 |
| H-MB-11 | Plain RN container views expose `testID` as resource-id (VM-06 shows the delegate path) | hypothesis | Add `accessible` + `accessibilityLabel` to the few checked containers | MA-12 |
| Inherited | H-S3, H-S10, H-S12, H-S13, H-S14, H-S15, H-S16, H-S18 (01S §10) | hypotheses | As in 01S §10 | row 18, M-rows |
| R-MB-1 | The simulator couples to DOM or web storage | risk | SCR-01; mobile polyfill fallback | M-06 |
| R-MB-2 | Skia and Reanimated cost on the emulator (3 canvases + ring) | risk | Canvas caps, 12.5 fps grain, pause when unfocused | MA-17 |
| R-MB-3 | Kit styling gaps on native (glow shadow, soft colours) | risk | 01S §2.10 fallbacks (hairline border, className colours) | M-02 |
| R-MB-4 | Two simulators confuse a two-screen demo | risk | G-M15 narrative; decision at the gate | gate |
| R-MB-5 | Resource pressure with parallel lanes (2 AVDs, Metro ×2, Vite ×3, jest) on 24 GB | risk | D35 locks; Metro runs only while an emulator lock is held | plan §5 |

---

## 15. Traceability

| Decision | Where applied |
|---|---|
| D6 ready-made frameworks | §4.0 (kit first; 6 compositions only), MA-23 |
| D16 / D31 tokens rev 3 | §4 recipes, §7.1, MA-22 |
| D17 responsive, unlocked | §2, MA-11..MA-14 |
| D19 simulator in shared | §5, SCR-01/02, MA-28 |
| D20 / D33 mobile screens after the web spec | this file; the Mobile Approval Gate |
| D23 AVD names | §2.1, §11 |
| D24 emulator outside the sandbox | §6.3, §10.2, §11 preconditions |
| D28 defaults (Q1–Q15) | §4 (20% used, violet Sealed, dark gold labels, UTC+07:00, one dataset, UI-only pause, operators, no officer photo) |
| D30 full mobile dependency set | §8.4, MA-01 |
| D34 / D35 parallel build and resource guards | §11 preconditions, H-MB-09, VM-18, plan §3-§5 |

---
*Generated: 2026-10-01 01:15 WIB by data-analyst (D33)*
*Last Updated: 2026-10-01 01:15 WIB*
