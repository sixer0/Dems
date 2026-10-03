---
task_id: 2026-09-30_dems_demo_stack_setup
step: 70
plan_row: 05_mobile_plan §3 M-03; §6
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 70: Mobile navigation shell (M-03)

**Outcome: PASS.** Every row-70 check passes on the current tree (after the step-73 fix of 04:18, D66):

- **Tests:** T-M02 (stubs) and T-M03 pass (MA-04 at stub level, MA-05).
- **Devices (both AVDs):**
  - MA-14 and MA-15 pass.
  - The chrome parts of MA-12 and MA-13 are recorded with screencaps.
  - The D57 extra checks pass: `?motion=off`, `?debug=1`, and `transition_animation_scale 0` with restore.
- **JS gate:** mobile typecheck, lint and jest exit 0 (33 suites / 439 tests, 04:59).

Delivered, per 04_mobile_specs §2–§3 and 05 M-03:

- **Route tree:** the full Expo Router tree of §3.1, with a stub screen for every route (`screen-<id>` from `src/features/<folder>/<name>-screen.tsx`) and an empty `i18n.ts` per feature folder, all registered in `src/i18n/features.ts`.
- **Guard:** the `Stack.Protected` guard on `useAuth()`, with the pending href and the §3.3 post-sign-in order.
- **Tabs:** headless `expo-router/ui` tabs with `ResponsiveTabList`: `BottomTabBar`, `NavRail` (72 / 88 / 232 dp, persisted collapse) and `LiveMiniBar`.
- **Hidden More destinations:** H-MB-01 is confirmed.
- **Boot router:** keeps `?motion=` on the proof screen (AC-31).
- **Public routes:** `/stack-check`, `/pair`, `+not-found`.
- **Back guard:** `useBackGuard` plus `BackGuardDialog` on `usePreventRemove`.
- **Deep links:** zod parsing, the session deep-link policies and master-detail routing.
- **Root layout:** the D57 `MotionPolicyProvider` render prop.
- **Hand-overs applied:**
  - F-69-1: the one proof-screen line;
  - D56: the one `jest.setup.ts` line.

## 1. Files

**Owned paths (P6).**

| Path | Change | Content |
|---|---|---|
| `apps/mobile/src/app/_layout.tsx` | edited | `MotionPolicyProvider` render prop → `AppProviders reducedMotion` → `BootGate` → `RootNavigator`. `ErrorBoundary` now mounts its own GestureHandlerRootView + SafeAreaProvider + HeroUINativeProvider: Expo Router renders it instead of the layout, and on device the HeroUI Card threw without a provider |
| `apps/mobile/src/app/index.tsx` | edited | Boot router: `?motion=` → proof screen; otherwise `BootRedirect` |
| `apps/mobile/src/app/{stack-check,pair,+not-found,+native-intent}.tsx` | new | Public routes. `+native-intent` records the pending href and opens a guarded link as `/login` while signed out (§3.3) |
| `apps/mobile/src/app/(auth)/{_layout,login}.tsx` | new | Auth group |
| `apps/mobile/src/app/(app)/_layout.tsx` | new | `AppStack`, `SessionRouteSync`, `KeepAwakeController` (§3.1) |
| `apps/mobile/src/app/(app)/(tabs)/_layout.tsx`, `home`, `storage`, `network-time`, `audit`, `more` | new | Tabs |
| `apps/mobile/src/app/(app)/(tabs)/{sessions,evidence,devices,settings}/{_layout,index,[id]}.tsx` | new (12 files) | Master-detail stacks |
| `apps/mobile/src/app/(app)/session/{_layout,new,live,finalizing,recovery,summary/[sessionId]}.tsx` | new | Session flow |
| `apps/mobile/src/app/dev-gallery.tsx` | kept | Step 71's file, left untouched. It stays public: routes that are not listed are added unprotected |
| `apps/mobile/src/navigation/` | new (15 source files) | See the list below this table |
| `apps/mobile/src/navigation/__tests__/` | new | `routes` (T-M02, 28 tests), `guard` (T-M03, 18), `chrome` (18), `back-guard` (5), `navigation-units` (40) |
| `apps/mobile/src/navigation/testing/{router-harness.tsx,router-testing-setup.ts}` | new | Jest harness for the real route tree (§5 S70-15) |
| `apps/mobile/src/components/composed/nav/` | new | See the list below this table |
| `apps/mobile/src/features/<16 folders>/<name>-screen.tsx` | new, **creation only** | 20 stubs, handed to the screen steps (§2) |
| `apps/mobile/src/features/<16 folders>/i18n.ts` | new, **creation only** | 16 empty trees, `<camelFolder>En` |
| `apps/mobile/src/i18n/features.ts` | edited | Registry: 16 feature folders plus `navigation` |

`src/navigation/` holds these source files:

- `routes.ts`
- `params.ts`
- `pending-href.ts`
- `session-routes.ts`
- `session-guards.ts`
- `root-navigator.tsx`
- `app-tabs.tsx`
- `stacks.tsx`
- `back-guard.tsx`
- `master-detail.ts`
- `rail-prefs.ts`
- `screen-stub.tsx`
- `not-found-screen.tsx`
- `stack-check-route.tsx`
- `log.ts`
- `i18n.ts`
- `index.ts`

`src/components/composed/nav/` is C-5 NavChrome:

- `bottom-tab-bar.tsx`
- `nav-rail.tsx`
- `nav-item.tsx`
- `live-mini-bar.tsx`
- `responsive-tab-list.tsx`
- `use-indicator.ts`
- `index.ts`

**Paths handed to this step for one change.**

| Path | Change | Authority |
|---|---|---|
| `apps/mobile/src/features/home/home-screen.tsx` | `import * as Haptics` removed; line 166 is now `triggerHaptic('stackCheckTap')` (+2 / −2 lines) | F-69-1 (D57) |
| `apps/mobile/jest.setup.ts` | +1 line: `import 'react-native-gesture-handler/jestSetup'` | D56 |
| `apps/mobile/src/i18n/i18n.test.ts` | One test case: "starts with an empty feature registry" became "mounts the registry under features.*". Step 73 later rewrote the file again (it owns `src/i18n/**`) | **P6 deviation, DR-S70-3** |

**Not written:**

- `packages/shared/**`, `apps/core-web/**`, `apps/mock-core/**`;
- any `package.json`, `package-lock.json`, `app.json`, `jest.config.js`;
- `src/runtime/**`, `src/auth/**`, `src/providers/**`, `src/motion/**`, `src/layout/**`;
- `README.md`, `THIRD_PARTY_NOTICES.md`.

No `npm install` ran. `apps/mobile/.expo/types/router.d.ts` (generated, git-ignored) was regenerated with `@expo/router-server` `regenerateDeclarations` (the same code `expo start` runs), so `tsc` knows the new routes.

**Docs written:**

- this file;
- `delegation_progress/coder_execution_step_70.md`;
- 43 screencaps `implementation/assets/mobile/70_dems_{phone,tablet}_*.png`;
- 5 diagnostic screencaps `70diag_dems_phone_d1..d5.png` (the P11 incident, §4.5).

## 2. Contract for the screen steps (75–89) and step 57

Each stub renders `SafeScreen id="<id>"` plus a label and its parsed params, through `ScreenStub` in `@/navigation/screen-stub`. The screen step for a folder replaces the body. It keeps the export name, the props and the `SafeScreen id`, because route files are step 70's (P6).

| Route | Screen file (`src/features/…`) | Export and props | `screen-<id>` | Owner |
|---|---|---|---|---|
| `/login` | `login/login-screen.tsx` | `LoginScreen()` | `login` | 75 |
| `/pair` | `pairing/pairing-screen.tsx` | `PairingScreen()` | `pair` | 76 |
| `/home` | `dashboard/dashboard-screen.tsx` | `DashboardScreen()` | `home` | 77 |
| `/session/new?step=` | `session-new/session-new-screen.tsx` | `SessionNewScreen({ step: 1\|2\|3 })` | `session-new` | 78 |
| `/session/live` | `session-live/session-live-screen.tsx` | `SessionLiveScreen()` | `session-live` | 79 |
| `/session/finalizing` | `session-finalizing/session-finalizing-screen.tsx` | `SessionFinalizingScreen()` | `session-finalizing` | 80 |
| `/session/summary/[sessionId]` | `session-summary/session-summary-screen.tsx` | `SessionSummaryScreen({ sessionId })` | `session-summary` | 80 |
| `/session/recovery` | `session-recovery/session-recovery-screen.tsx` | `SessionRecoveryScreen()` | `session-recovery` | 81 |
| `/sessions`, `/sessions/[sessionId]` | `sessions/{sessions,session-detail}-screen.tsx` | `SessionsScreen({ selectedId })`, `SessionDetailScreen({ sessionId })` | `sessions`, `session-detail` | 82 |
| `/evidence`, `/evidence/[evidenceId]` | `evidence/{evidence-list,evidence-detail}-screen.tsx` | `EvidenceListScreen({ selectedId })`, `EvidenceDetailScreen({ evidenceId })` | `evidence`, `evidence-detail` | 83 |
| `/devices`, `/devices/[deviceId]` | `devices/{devices,device-detail}-screen.tsx` | `DevicesScreen({ selectedId })`, `DeviceDetailScreen({ deviceId })` | `devices`, `device-detail` | 84 |
| `/storage` | `storage/storage-screen.tsx` | `StorageScreen()` | `storage` | 85 |
| `/network-time` | `network-time/network-time-screen.tsx` | `NetworkTimeScreen()` | `network-time` | 86 |
| `/audit` | `audit/audit-screen.tsx` | `AuditScreen()` | `audit` | 87 |
| `/settings`, `/settings/[section]` | `settings/{settings,settings-section}-screen.tsx` | `SettingsScreen({ selectedSection })`, `SettingsSectionScreen({ section })`; sections: preferences, notifications, security, maintenance, about | `settings`, `settings-section` | 88 |
| `/more` | `more/more-screen.tsx` | `MoreScreen()` | `more` | 89 |

The routing rules below are already enforced in the route files, so screens do not re-implement them:

- **Ids:** they are zod-validated (`recordIdSchema`). A malformed id goes back to the list; an unknown settings section goes to `/settings`.
- **Master-detail (§2.5 rule 3):**
  - on medium and expanded windows, `/<list>/<id>` hands over to `/<list>?selected=<id>` (`StackActions.popTo('index')`), so list screens receive `selectedId` and render the detail pane;
  - on compact windows, a `?selected=` becomes a pushed detail route, and Back returns to the plain list.
- **Session policies (§3.5):**
  - `/session/live` opens only while RECORDING; otherwise it goes to the §3.7 target, or `/home`;
  - `/session/new` is refused, with one warning toast, while the session is RECORDING, STOPPING, FINALIZING, FAULT or RECOVERY.
- **Copy:** each screen's copy goes in its own `i18n.ts`, resolved as `features.<folder>.*`. Never edit `features.ts`.

**Tools for the screens:**

- **Back guard (§3.6):** `useBackGuard({ enabled, mode })` and `BackGuardDialog variant="monitor"|"flow"` from `@/navigation`.
  - Steps 78 and 79: `const guard = useBackGuard({ enabled: state === 'RECORDING' }); <BackGuardDialog guard={guard} variant="monitor" />`. "Go to Home" goes through `dismissTo('/home')` and never touches the session.
  - Step 80: `mode: 'block'` with `onBlocked` to show the "Finalizing — please wait" toast.
- **Links:** `router.push('/storage')` etc. from More works on phones (H-MB-01), and Back returns to More (`backBehavior="history"`).
- **Tests:** screen tests that render routes import `@/navigation/testing/router-harness` first (`renderApp(url, { runtime: new FakeRuntime(), window: 'tabletLandscape' })`), or import `@/navigation/testing/router-testing-setup` first before importing `expo-router` (§5, S70-15).

## 3. Hand-over contract for the other steps

| Step | Item |
|---|---|
| 73 (runtime) | Done by step 73 while this step ran: `resyncTarget` delegates to `sessionResyncHref` (one §3.7 table), and `SessionRouteSync` / `KeepAwakeController` are mounted by `(app)/_layout.tsx`. The boot router honours `session.summaryAcknowledged` as soon as the runtime adds it to `ActiveSessionInfo` (read defensively). `setNavigationLogSink` lets the runtime persist navigation issue records |
| 75 (Login) | Replace `LoginScreen`. The dev-only `StubSignIn` (first demo operator, `DEMO_OPERATOR_PASSWORD` from `@dems/shared/sim`, `__DEV__` only) can go with the stub. Device checks by steps 70–74 used it |
| 57 (tests) | T-M02 against the real screens: extend `routes.test.tsx` (same file). T-M11: `getMissingKeys()` after rendering every route through the harness |
| 74 (review) | The §5 findings (React Compiler rules, harness workarounds, the jest-config request) |
| 69 (motion kit) | `PENDING_OWNER_CHANGE` in `src/motion/haptics.test.ts:266` is now vacuous: the proof-screen line is fixed and the MA-20 grep is clean. Remove the entry. Also: the Reanimated "Reduced motion setting is enabled on this device" warning is not in `LogBox.ignoreLogs`, and it put a LogBox banner on the phone under `transition_animation_scale 0` (`70_dems_phone_os_reduce_motion_overlay.png`, bottom). This is D-69-6's concern |

## 4. Verification (Tier 3 evidence)

### 4.1 JS gate (`--maxWorkers=2`; commands from the workspace root)

| Run | Time (WIB) | typecheck | lint | jest |
|---|---|---|---|---|
| 1, after the code | 03:45 | exit 0 | exit 0 | 23 suites / 317 tests pass |
| P11 noise | 04:01 | exit 0 | exit 0 | 3 suites failed to parse (`policy`, `app-providers`, `runtime-contract`): step 73's in-progress runtime imported the `expo-router` entry, which pulls in ESM-only `standard-navigation` (§5, F-70-3). No step-70 suite failed |
| 2, P11 re-run after step 73 moved to `expo-router/build/hooks` | 04:11 | exit 0 | exit 0 | 31 suites / 420 tests pass, exit 0 |
| 3 | 04:49–04:50 | exit 0 | exit 0 | 33 suites / 437 tests pass, exit 0 |
| **Final**, after the guarded-link fix (S70-13) | 04:59:04–04:59:18 | **exit 0** | **exit 0 (0 warnings)** | **33 suites / 439 tests pass, exit 0** (step 70's own 5 suites: 109 tests) |

### 4.2 Acceptance map

| Check | Evidence | Result |
|---|---|---|
| **T-M02 / MA-04 (stub level)** | `routes.test.tsx`: all 22 route patterns of `ROUTE_SCREENS` render their `screen-<id>` through the real `src/app` tree, with params parsed. Also covered: `+not-found`; step `9` → `1`; a malformed id → the list; an unknown section → `/settings`; a feature file exists for every route; no test file in `src/app` | **PASS** (28/28) |
| **T-M03 / MA-05** | `guard.test.tsx` (18/18) | **PASS** |

`guard.test.tsx` covers:

- unauthenticated `/evidence` → `/login`, with `/evidence` pending;
- after sign-in → `/evidence`, and the pending href is dropped;
- the query is kept, but `motion` and `debug` are dropped;
- the resync target wins over the pending href while RECORDING;
- a sign-in that started over a public screen still opens the pending href (mutation-checked: without the S70-13 replace it fails);
- CREATE, PRECHECK, ARMED, FINALIZING and FAULT → their §3.7 routes;
- nothing pending → `/home`;
- sign-out → `/login`, and the old link is never reused;
- `/login` is never shown while signed in;
- the public routes open while signed out;
- the dev sign-in path;
- the `/session/live` and `/session/new` policies.

| Check | Evidence | Result |
|---|---|---|
| Chrome (jest) | `chrome.test.tsx` 18/18: 5 bar items on phone, the tab press gives one selection haptic, insets are not double-padded, More destinations are hidden but routable with More highlighted and history Back, rails of 72/88/232 dp (+ start inset), the collapse is persisted **by merge** (`{reduceMotion, haptics}` kept) and restored, the footer version equals the dataset `SOFTWARE_VERSION`, rotation does not remount the open screen (mount counter 1), master-detail both ways, the mini-bar (above the bar or at the top, hidden when not RECORDING, tap → monitor), 0 missing i18n keys | PASS |
| Back guard (jest) | `back-guard.test.tsx` 5/5: confirm (Stay, Go to Home), flow (Cancel session → held Back), block (onBlocked), disabled | PASS |
| **MA-12 (chrome part)** | Tablet landscape: frame 2560×1600; `nav-rail` bounds [0,0][464,1600] = **232 dp**; **8** `nav-item-*`; `selected=home` ([70_dems_tablet_home_extended_rail.png](assets/mobile/70_dems_tablet_home_extended_rail.png)). Evidence pane hand-over: `selectedId=EV-20261001-0007` ([70_dems_tablet_master_detail_handover.png](assets/mobile/70_dems_tablet_master_detail_handover.png)). `pane-*` ids belong to step 83 | **Recorded, PASS** |
| **MA-13 (chrome part)** | §4.3 and §4.4: tablet → 1600×2560 with the 88 dp rail and labels; phone → 2424×1080 with the 72 dp icon-only rail; same PID; the Evidence selection is kept; the recording timer keeps running | **Recorded, PASS** |
| **MA-14** | Phone. Portrait: bar [0,2204][1080,2424], items end at y 2361, bottom inset 63 px (24 dp) → every item is above the inset. Landscape (ROTATION_270 and ROTATION_90): rail [0,0][189,1080], items x 21–167, y 95–872. `dumpsys window displays`: `DisplayCutout{insets=Rect(0, 0 - 0, 0)}` in all four rotations: this `pixel_10` image reports **no cutout**, so no item can lie in one. The rail pads the start inset itself (jest proves it with a 32 dp inset) | **PASS** (no cutout on the AVD; recorded) |
| **MA-15** | §4.3 and §4.4 | **PASS** (proof screen). Login part N/A: placeholder, owned by step 75 |

MA-15 on the proof screen, both AVDs:
- **Procedure:** `?motion=slow` on `/`, frames at 1.0 s and 8.0 s. The mid frame differs from the final one.
- **Warm start:** measured after `am start -W`.
- **Cold start:** timed from the splash removal. Cold starts now take 12–15 s, which outlasts `-W`.
- **AC-31 greps:** unchanged (4 `entering=` builders in `home-screen.tsx`; the `pulse-ring.tsx` pattern count is 4).
- **Login part:** `/login?motion=slow` reaches `screen-login`, but the placeholder has no enter animation.

| Check | Evidence | Result |
|---|---|---|
| D57: `?motion=off` | uiautomator reaches idle: `dump` exit 0 on `demsdemo:///?motion=off` (proof screen) and on `/home?motion=off` (chrome) on both AVDs | **PASS** |
| D57: `?debug=1` | Overlay visible on both AVDs; on the tablet during recording: "loops 1/4: mini-bar-rec · motion full" | **PASS** |
| D57: `transition_animation_scale 0` | Cold start → overlay "**motion reduced (os)**"; restored to the recorded original `1.0` (read back: `1.0` on both AVDs) → "motion full" | **PASS** |
| MA-20 | `grep -rn "Haptics\." apps/mobile/src \| grep -v motion/haptics` | no match (exit 1) |
| MA-22 (step-70 paths) | `grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?"` over `components/composed/nav`, `navigation`, `app` and the 16 new feature folders | no match (exit 1) |
| MA-23 | `ls components/composed` → C-1..C-6 + `nav/`; kit re-export grep | no match (exit 1) |
| MA-25 (whole `apps/mobile/src`) | `grep -rnE "https?://" … \| grep -vE "127\.0\.0\.1\|localhost\|CORE_…"` | no match (exit 1) |

### 4.3 Device: dems_phone (emulator-5554, Metro 8081 via `device-session.sh`, current tree)

Run 4 was 04:26:48–04:30:19, run 6 04:46:13–04:47:55 and run 8 04:57:30–04:58:56. logcat `ReactNativeJS:E` and `AndroidRuntime:E` had no lines in any of them.

| # | Action | Result | Screencap |
|---|---|---|---|
| 1 | `demsdemo:///?motion=off` | proof screen; `dump` exit 0; `screen-stack-check` | [proof_motion_off](assets/mobile/70_dems_phone_proof_motion_off.png) |
| 2 | `demsdemo:///` (signed out) | boot router → `screen-login`, `stub-sign-in` | [login_stub](assets/mobile/70_dems_phone_login_stub.png) |
| 3 | tap `stub-sign-in` (simulator auth, OPR-001) | boot target `/home` (simulator idle): `nav-bottom`, 5 items, `selected=home` | [after_sign_in](assets/mobile/70_dems_phone_after_sign_in.png), [home_bottom_bar](assets/mobile/70_dems_phone_home_bottom_bar.png) |
| 4 | tap `nav-item-evidence` | `screen-evidence`, `selected=evidence` (content follows the tab) | [evidence_tab](assets/mobile/70_dems_phone_evidence_tab.png) |
| 5 | `/more` → `/storage` → `KEYCODE_BACK` | `screen-storage` with `selected=more` (H-MB-01), then `screen-more` (history) | [storage_more_highlighted](assets/mobile/70_dems_phone_storage_more_highlighted.png) |
| 6 | `adb emu rotate` ×4 on Home | ROTATION_270 / 270 / 90: frame 2424×1080, `nav-rail` [0,0][189,1080] = **72 dp**, 5 items, no labels; ROTATION_0: bar back. **PID 13623 throughout** | [rotate_1](assets/mobile/70_dems_phone_rotate_1.png)…[rotate_4](assets/mobile/70_dems_phone_rotate_4.png) |
| 7 | `?debug=1` | overlay "UI 31 fps · JS 31 fps · loops 0/4 · motion full" | [debug_overlay](assets/mobile/70_dems_phone_debug_overlay.png) |
| 8 | MA-15 warm | 12.32 % of pixels differ, bbox (81,144)–(999,1886) | [1 s](assets/mobile/70_dems_phone_ma15_warm_proof_1s.png), [8 s](assets/mobile/70_dems_phone_ma15_warm_proof_8s.png) |
| 9 | `transition_animation_scale 0`, cold start `/stack-check?debug=1`; restore | "motion reduced (os)" → restored `1.0` → "motion full" | [reduced](assets/mobile/70_dems_phone_os_reduce_motion_overlay.png), [restored](assets/mobile/70_dems_phone_os_motion_restored_overlay.png) |
| 10 | MA-15 cold (splash removed after 14.0 s) | 5.01 % differ, bbox (81,144)–(999,1886); login placeholder 0.00 % | [proof 1 s](assets/mobile/70_dems_phone_ma15_proof_1s.png), [proof 8 s](assets/mobile/70_dems_phone_ma15_proof_8s.png), [login 1 s](assets/mobile/70_dems_phone_ma15_login_1s.png), [login 8 s](assets/mobile/70_dems_phone_ma15_login_8s.png) |
| 11 | `/evidence?motion=off&scenario=recording` (debug scenario, step 73) | mini-bar **above the bar**, [32,2051][1049,2183] (bar top 2204); timer 00:18:47 → landscape 00:19:05 (icon rail plus the mini-bar at the top of content) → portrait 00:19:30; PID 15879 unchanged; tap → `screen-session-live`; then `scenario=idle` restored | [mini-bar](assets/mobile/70_dems_phone_recording_mini_bar.png), [landscape](assets/mobile/70_dems_phone_recording_landscape.png), [portrait](assets/mobile/70_dems_phone_recording_portrait_again.png), [monitor](assets/mobile/70_dems_phone_mini_bar_opens_monitor.png) |
| 12 | Guarded links (run 8, 04:57:30–04:58:56): (a) cold start `demsdemo:///devices` signed out; (b) `/stack-check` running, then `demsdemo:///audit`; (c) signed in, `demsdemo:///pair` then Back | (a) `screen-login` → sign-in → `screen-devices`; (b) `screen-login` (before S70-13, run 7 at 04:55 dropped the link and stayed on the proof screen after sign-in) → sign-in → `screen-audit` with More highlighted; (c) `screen-pair` → Back → `screen-audit`. logcat E: none | [cold link → login](assets/mobile/70_dems_phone_guard_cold_link_login.png), [pending → devices](assets/mobile/70_dems_phone_guard_pending_href_devices.png), [warm link → audit](assets/mobile/70_dems_phone_guard_warm_link_audit.png) |

### 4.4 Device: dems_tablet (emulator-5556, Metro 8081, current tree)

Session 1 ran 04:31:28–04:35:57, session 2 04:41–04:42:25 and session 3 04:48–04:49:18. logcat E-level: none.

| # | Action | Result | Screencap |
|---|---|---|---|
| 1 | `?motion=off` proof screen; `demsdemo:///` | `dump` exit 0; `screen-login` | [login_stub](assets/mobile/70_dems_tablet_login_stub.png) |
| 2 | sign in, `/home?motion=off` | extended rail [0,0][464,1600] = **232 dp**, 8 items, `nav-rail-footer` "DEMS EDGE CLIENT · v2.4.1", collapse toggle | [home_extended_rail](assets/mobile/70_dems_tablet_home_extended_rail.png) |
| 3 | tap `nav-item-evidence`, then `nav-item-settings` | `screen-evidence` / `screen-settings`, selected follows | [settings_rail](assets/mobile/70_dems_tablet_settings_rail.png) |
| 4 | tap `nav-rail-collapse` twice | rail [0,0][176,1600] = **88 dp**, no footer → back to 464 (device state as found) | [rail_collapsed](assets/mobile/70_dems_tablet_rail_collapsed.png) |
| 5 | `/evidence/EV-20261001-0007` | hand-over: `screen-evidence` with `selectedId=EV-20261001-0007` | [master_detail_handover](assets/mobile/70_dems_tablet_master_detail_handover.png) |
| 6 | `…&scenario=recording`, then rotate ×4 | mini-bar at the top of the content column; portrait frames 1600×2560 with the labelled rail; `selectedId` kept; timer 00:18:59 → 00:19:16 → 00:19:58; **PID 7810 throughout** | [recording](assets/mobile/70_dems_tablet_recording_mini_bar.png), [rotate_1](assets/mobile/70_dems_tablet_rotate_1.png)…[rotate_4](assets/mobile/70_dems_tablet_rotate_4.png) |
| 7 | rotate ×4 while idle (session 2) | portrait `nav-rail` [0,0][176,2560] = **88 dp**, 8 items, labels ("Network & Time" on 2 lines); landscape 464; **PID 9840 throughout** | [portrait_rail_idle](assets/mobile/70_dems_tablet_portrait_rail_idle.png) |
| 8 | `?debug=1` | "loops 1/4: mini-bar-rec · motion full" | [debug_overlay](assets/mobile/70_dems_tablet_debug_overlay.png) |
| 9 | MA-15 warm | 6.81 %, bbox (62,110)–(2498,762) | [1 s](assets/mobile/70_dems_tablet_ma15_warm_proof_1s.png), [8 s](assets/mobile/70_dems_tablet_ma15_warm_proof_8s.png) |
| 10 | `scenario=idle` | Home, idle (the simulator is left idle for the other lanes) | — |
| 11 | `transition_animation_scale 0` → cold → restore | "motion reduced (os)" → restored `1.0` → "motion full" | [reduced](assets/mobile/70_dems_tablet_os_reduce_motion_overlay.png), [restored](assets/mobile/70_dems_tablet_os_motion_restored_overlay.png) |
| 12 | MA-15 cold (splash removed after 12.9 s) | proof 5.74 %, bbox (62,21)–(2498,762); login 4.56 % only in the status-bar strip (0,25)–(2560,121), no animation | [proof 1 s](assets/mobile/70_dems_tablet_ma15_proof_1s.png), [proof 8 s](assets/mobile/70_dems_tablet_ma15_proof_8s.png), [login 1 s](assets/mobile/70_dems_tablet_ma15_login_1s.png), [login 8 s](assets/mobile/70_dems_tablet_ma15_login_8s.png) |

uiautomator could not reach idle while recording at rotation turns 1–3: the recording kept updating the UI. Those turns are recorded by screencaps; turn 4's dump succeeded (timer 00:19:58).

### 4.5 Earlier device runs (P11 record, D66 relay)

| Run | Time | What happened | Action |
|---|---|---|---|
| phone 1 | 03:46–03:50 | **Step-70 bug:** "change in the order of Hooks called by TabsFrame". The React Compiler memoised `railPrefsStore(...)`, a zustand hook not named `use…`. The route error boundary then threw (HeroUI Card without a provider) | Renamed to `useRailPrefsStore`; the ErrorBoundary got its own providers |
| phone 2 | 03:52–03:55 | Chrome correct, but the **tab content stayed on Home**. The compiler memoised React Navigation's `NavigationContent` element, so the navigator context went stale | `'use no memo'` in `AppTabs`, and in the boot router, which reads module state during render |
| diag / probe | 03:58, 04:13 | Red box on cold start in **step 73's** files: `RuntimeBridge` (`coreLinkPrefsStore`), then `AuthProvider` (`authPrefsStore`). Same compiler rule. [70diag_dems_phone_d1.png](assets/mobile/70diag_dems_phone_d1.png) | Reported in the progress file (03:58, 04:13); step 73 fixed it at 04:18 (D66) |
| phone 3 | 04:18–04:22 | Current runtime. The simulator was RECORDING from another lane's session, so sign-in resynced to `/session/live` (correct per §3.3). The rotation dumps failed idle under `?motion=full`. The `&` in a URL was split by the device shell | Script fixed: quoted URLs, `?motion=off` kept during dumps, cold-start timing from splash removal |

| phone 5 | 04:43–04:45 | The first deep link was sent before the 20 s cold start had finished (the first bundle build of the grown tree), so the app kept its launch URL. The later guarded links arrived while signed out on a public screen and were dropped by the protected navigator | Script: wait for the splash removal (run 6). Code: S70-13 |
| phone 7 | 04:55 | Guarded links: case (a) PASS; case (b) reached `/login`, but after sign-in stayed on `/stack-check` (the public screen underneath) | Code: S70-13 second half; run 8 PASS |

Every result in §4.3 and §4.4 comes from runs after 04:18.

## 5. Decisions, drift and findings

| ID | Type | Item | Resolution |
|---|---|---|---|
| **DR-S70-1** | drift (path) | 04 §10.1 puts T-M02/T-M03 in `src/app/__tests__/`. Expo Router bundles **every** `.tsx` under the app root as a route (`node_modules/expo-router/_ctx.android.js` regex), so a test file there would enter the Android bundle | Tests live in `src/navigation/__tests__/` (same test ids); `routes.test.tsx` asserts that `src/app/__tests__` does not exist |
| DR-S70-2 | drift (design) | 04 §2.3 rail active fill `#6A3916 → #573520` is untokenised, and MA-22 scans `src/components` | D49 web parity: `surface-tertiary` fill, gold 1 px hairline, glow e2 (`GlowLayer`), all from tokens |
| DR-S70-3 | P6 deviation | Step 68's `i18n.test.ts` asserted `FEATURE_RESOURCES` was `{}`, the state step 68 handed over; filling it is step 70's job | One test case changed to assert the mount point; step 73 (owner of `src/i18n/**`) has since rewritten it. Controller acknowledgement requested |
| S70-1 | design | Headless tabs through `useTabsWithTriggers({ triggers })` (all 9 routes) and `useTabTrigger` per item. `Tabs` only parses `TabTrigger`s that are direct `TabList` children, so a responsive custom list must declare triggers explicitly | H-MB-01 **confirmed**: routes are tabs whether or not a trigger is visible (jest + phone run 4 row 5) |
| S70-2 | design | Pending href: `Stack.Protected` sends a guarded launch URL to the anchor `/` **without its query** (jest experiment). So `+native-intent.redirectSystemPath` records it (in memory only, never logged; guarded paths only; `motion` / `debug` stripped; dropped on sign-out) | The boot router at `/` is the one dispatcher after every guard change: `/login`, or resync target → pending → `/home` |
| S70-3 | design | The boot router's `?motion=` rule is followed literally (any value → proof screen). A guarded link carrying `?motion=off` reaches the anchor without the query, so it still lands on `/login` | Verified in jest (T-M03) |
| S70-4 | design | Tab bar: the spec's gold pill behind the icon, plus the mockup's gold streak on the bar's top edge (MB 2); both travel on the `indicator` spring, and the glow pulses e2 → e3 on arrival (M-MB-01) | No blur: the chrome never overlays content, so H-MB-03 is not exercised |
| S70-5 | design | Rotation safety: the element tree keeps the content column at a fixed position, with the list before it (rail) or after it (bar) and `null` in the other slot | jest mount counter stays 1; device PIDs unchanged |
| S70-6 | design | Master-detail rules applied to Evidence, Devices, Sessions and Settings (§2.4 gives each a pane layout); focus effects, like `<Redirect>` | A deep link's path param stays in Expo Router's *global* params of the parent tab; the list route's own params are replaced (`popTo`, merge false). Harmless, recorded |
| S70-7 | design | Session deep-link policies (§3.5): `/session/live` → §3.7 target or `/home` when not RECORDING; `/session/new` refused while busy, one toast | T-M03 |
| S70-8 | design | `StubSignIn` (dev builds only) signs in `OPERATORS[0]` with `DEMO_OPERATOR_PASSWORD` from `@dems/shared/sim` (the published demo credentials), so device checks work before Login (step 75) with either runtime | The literal is not in step-70 code; step 75 removes it with the stub |
| S70-9 | design | Feature i18n: 16 empty `<camelFolder>En` trees plus `navigation` (shell copy: not-found, stubs, session-busy toast) under `features.*` | 0 missing keys (jest) |
| S70-10 | design | The rail footer version reads `SOFTWARE_VERSION` from `@dems/shared/sim` (web parity) | — |
| S70-11 | design | `(app)/_layout.tsx` mounts `SessionRouteSync` and `KeepAwakeController`. `ConnectionBanner` and the idle lock are mounted by step 73 inside its providers (no route-file edit needed) | Confirmed in step 73's runtime index |
| S70-12 | env | `.expo/types/router.d.ts` (git-ignored, generated) regenerated without Metro via `@expo/router-server/build/typed-routes` `regenerateDeclarations` | Every Metro start regenerates it too |
| S70-13 | design (found on device) | 04 §3.3 "an unauthenticated visit to any (app) URL lands on /login" also has to hold while the app is running on a public screen, and the §3.3 order has to hold after that sign-in | `redirectSystemPath` returns `/login` for a guarded link while signed out (pending kept). After a sign-in, `RootNavigator` replaces a public screen left on top with `/`, so the boot router runs. Jest (mutation-checked) and phone run 8 |
| **F-70-1** | finding (all mobile code) | **React Compiler rules**, which jest does not exercise (only the device bundle has `transform.reactCompiler=true`): (a) every zustand bound store used as a hook must be named `use…`; (b) components that render React Navigation's `NavigationContent` (render-phase refs) need `'use no memo'`; (c) render code that reads module state needs `'use no memo'` | Applied in step-70 code. Step 73 applied (a) at 04:18; the rule was relayed by the controller (D66) |
| F-70-2 | finding | Cold start (debug build, Metro) now takes **12.2–15.2 s** to splash removal on both AVDs. Steps 68 and 69 measured 3.5–4.5 s. Timeline (phone): START → `Running "main"` +6.8 s → first provider render +4.7 s → sim hydrated → Displayed +12.4 s. The bundle grew (5,102 → 5,436 modules) and the host ran 6 lanes | Informational. Not a step-70 acceptance item; for steps 74, 59 and MA-17. `am start -W` times out on cold starts, so MA-15 was timed from splash removal |
| F-70-3 | request (controller) | `jest.config.js` (step 67's) does not transform `standard-navigation`, an 8-line ESM-only dependency of expo-router 57. Any suite importing the `expo-router` entry fails to parse | Worked around in `router-testing-setup.ts`. **Durable fix:** add `standard-navigation` to the `transformIgnorePatterns` allowlist (one token, needs the owner of `jest.config.js`) |
| F-70-4 | finding | `expo-router/testing-library` replaces Reanimated with `react-native-reanimated/mock` (no `useReducedMotion`), which breaks HeroUI Native and the motion kit. Its `{ appDir, overrides }` context also strips the `./…` keys, so `+native-intent` is rejected as a route | The harness renders `ExpoRoot` itself (same sync import mode) over an in-memory context of `src/app` |
| F-70-5 | finding (step 69) | The Reanimated "Reduced motion setting is enabled on this device" dev warning is not in step 69's `LogBox.ignoreLogs`. It shows a LogBox banner under OS reduce motion | For steps 69 and 74 (D-69-6) |
| F-70-6 | finding (step 69) | `PENDING_OWNER_CHANGE` in `src/motion/haptics.test.ts:266` is now vacuous | For steps 69, 74 or 57 to delete |
| SIM-GAP / P12 | — | None: no shared-contract change, native module or package was needed | — |

## 6. Processes (P7)

| Process | Started by | Stopped | Confirmed |
|---|---|---|---|
| Metro 127.0.0.1:8081, one per device session (PIDs 13433, 15172, 17884, 23289, 24870, 27552, 28306, 31841, 37395, 40006, 42647, 43829, 47649, 49789) | `device-session.sh` | helper cleanup ("Metro … stopped" for each) | `curl 127.0.0.1:8081/status` gets no answer; 8082 and 8083 are not in use either |
| `adb reverse` tcp:8081 and tcp:4400 on both serials | helper | helper cleanup | `adb reverse --list` is empty on emulator-5554 and emulator-5556 |
| `transition_animation_scale` | step 70 set it to 0 | restored to the recorded 1.0 | `settings get` returns `1.0` on both AVDs |
| AVD rotation | `adb emu rotate` ×4 per run | four quarter turns return to the start | phone ROTATION_0 (portrait); tablet ROTATION_0 (its natural landscape) |
| Simulator scenario (app data) | `&scenario=recording` (debug) | `&scenario=idle` in the same session | the idle Home dump after it |
| Rail preference | collapse toggled | expanded again | rail 464 px after the toggle |
| Background wait loops (3) | this agent | `TaskStop` / exit | — |

- Not touched: the emulators, the adb server, `.locks/*.pid`, mock-core (not started).
- Scratch files (scripts, dumps, logs) stay in the session scratchpad.

## 7. Rollback

- Delete the new paths: `src/navigation/`, `src/components/composed/nav/`, the new files under `src/app/`, and the 16 new feature folders.
- Restore `_layout.tsx` and `index.tsx` from their step-68 state (not committed; baseline `33e4c95` has the row-18 versions).
- Revert the one line in `home-screen.tsx` and the one line in `jest.setup.ts`.
- Reset `src/i18n/features.ts` to `{}`.
- Delete `implementation/assets/mobile/70_*.png` and `70diag_*.png`.
- No native, package, host or shared change was made.

---
*Generated: 2026-10-01 05:02 WIB by coder-execution (step 70)*
