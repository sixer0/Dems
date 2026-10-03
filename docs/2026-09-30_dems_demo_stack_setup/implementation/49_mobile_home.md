---
task_id: 2026-09-30_dems_demo_stack_setup
step: 77
plan_row: 05_mobile_plan §3 M-08
date: 2026-10-01
agent: coder-execution
lane: mobile-B, Metro 8082 (D69)
tier: 3
status: complete (with findings F77-1, S77-9 for other owners; see §6)
decisions: D17, D28, D38, D43, D55, D57, D58, D61, D66, D68, D69, D73, D75, D78
---

# Step 77: mobile Home (Dashboard), M-08

**Outcome: PASS on every row-77 check.**

| Row-77 check | Result | Evidence |
|---|---|---|
| MA-11 MB 2 checklist met on dems_phone | **PASS** | §4.1: frame 1080×2424; H1–H5 in MB 2 order at y1 = 63 / 242 / 610 / 951 / 1340 px, then the tab bar (H6) at 2204; contact sheet `77_dems_phone_mb2_contact.png` |
| MA-12 home part recorded | **PASS** | §4.2: dems_tablet landscape 2560×1600, `nav-rail` 0–464 px = 232 dp with 8 `nav-item-*`, `pane-status`, `pane-devices`, `pane-activity` |
| MA-18 ring check recorded | **PASS** | §4.1: ring region (84, 347)–(273, 536) byte-identical 2 s apart under OS reduce-motion and under the in-app override (max delta 0); full-motion control differs (max delta 41, 11,593 px) |
| Its render test passes | **PASS** | `dashboard-screen.test.tsx` 14/14, `dashboard-route.test.tsx` 2/2 (real route tree), plus model, boundary and held-value suites: 5 suites / 37 tests |
| Mobile typecheck, lint and jest exit 0 | **typecheck 0, lint 0; jest 0 for every step-77 and `/home` case (P11 noise elsewhere)** | §3.1: final typecheck and lint exit 0; full jest 42 / 556 exit 0 at 05:38; the final run's 9 failures are all `/evidence` and `/session/new` stub assertions of steps 83 / 78 (P11) |

Only `apps/mobile/src/features/dashboard/**` was written in the app. No package, `package.json`, jest config, `packages/shared/**`, route file or shared module was touched; no npm install; nothing committed.

## 1. Files (all under `apps/mobile/src/features/dashboard/`)

| File | Content |
|---|---|
| `dashboard-screen.tsx` | `DashboardScreen()` (export and `SafeScreen id="home"` kept, T-M02): header + scroll body; per-class pane layout (§2.4); panes keyed per tablet class (S77-9); new-seal toast (§7.3 data moment) |
| `home-header.tsx` | H1: compact MB 2 header (Emblem 32 dp + two-line wordmark, bell, avatar "BS"), condensed 48 dp (phone landscape), 64 dp tablet header (title, state chip; expanded adds Core link chip + sim clock via C-6 `slide`). Bell → kit `Popover` of active alerts with Acknowledge and "View all events" → `/audit`; avatar → kit `Menu`: Profile → `/settings`, Lock console, Sign out |
| `system-status-card.tsx` | H2: `SectionCard` + C-1 GlowRing `mini` 72 dp around the state shield (phone) or `hero` 256–280 dp with "SYSTEM / READY / SECURE • HEALTHY • OPERATIONAL" (tablet). READY in success-400; ATTENTION/CRITICAL list their flags; RECORDING shows REC chip + sim-clock timer and opens `/session/live` |
| `status-tiles.tsx` | H3: Camera 2/2, Microphone 2/2, Storage 20% USED (kit `Surface variant="secondary"`), tone per state, tap → `/devices` / `/storage` |
| `quick-actions.tsx` | H4: `Button variant="primary" size="lg"` with the gold → bronze `expo-linear-gradient` in the `background` slot and an 8 s sheen loop; `Button variant="outline"` View Evidence. Start becomes Return to live session / Continue setup / View finalization / Open recovery / View session summary from the §3.7 table |
| `recent-sessions.tsx` | H5: `SectionCard` + `LinkButton` See All → `/sessions`; 3 rows (expo-image poster crop joined on the evidence suffix, D61; id in mono; "Today 09:35" at UTC+07:00; kit `SubjectTypeChip`); tablets add "7 Items sealed today" |
| `device-tiles.tsx` | Tablet expanded 2×2: CAM 1/2 `CameraFeed` live loops (poster under `?motion=off`), MIC 1/2 C-2 `compact` meters on `useAudioSharedValues` + 1 Hz dBFS line |
| `status-chip-row.tsx` | Tablet: Security / GNSS-Time / Network chips (+ Storage on expanded) |
| `panel-boundary.tsx` | Per-panel error boundary: shared panel copy, runtime-log record (`dems.mobile.log.v1`), retry 3 s → 6 s → 12 s, max 3 |
| `home-model.ts` | Pure view model: status/flag lines, tiles, primary action (reuses `resyncTarget`), recent rows, WIB clock, chip row |
| `home-motion.ts` | §7.3 beats (0 / 120 / 250+50 / 450 / 650 / 900 ring), `homeEnter` (R1 at a beat), `valueTickDelay`, loop names |
| `use-home-data.ts` | `useSim` reads, all returning flat values (F74-13) |
| `use-held-value.ts` | Held-beat value for `slide` numbers (DR-S77-1) |
| `i18n.ts` | `dashboardEn` (`features.dashboard.*`); shared keys reused for shell, common, dashboard terms |
| `dashboard-screen.test.tsx`, `dashboard-route.test.tsx`, `home-model.test.ts`, `panel-boundary.test.tsx`, `use-held-value.test.tsx` | Tests (§3) |

Docs: this file, `delegation_progress/coder_execution_step_77.md`, 30 screencaps `implementation/assets/mobile/77_*.png`.

## 2. MB 2 checklist (MA-11, dems_phone portrait, `77_dems_phone_home.png` + `77_dems_phone_mb2_contact.png`)

| MB 2 region (04 §4.3) | Present, in order | Notes |
|---|---|---|
| H1 header (355–590, 40–78) | yes, y1 63 | Emblem + "DEMS / EDGE CLIENT", bell, avatar **BS** (mockup "IR"; 04 §9 #29) |
| H2 System Status (352–592, 88–160) | yes, y1 242 | Ring + shield, "Ready for Recording" / "All systems operational" in success-400 |
| H3 tiles ×3 (352–592, 170–232) | yes, y1 610 | **2/2** cameras (mockup 1/1, 04 §9 #7), 2/2 mics, **20% USED** (mockup 80%, D28/Q1) |
| H4 Quick Actions (352–592, 245–320) | yes, y1 951 | Start Session (gradient, dark label) + View Evidence |
| H5 Recent Sessions (352–592, 335–488) | yes, y1 1340 | EV-…-0013 **Tersangka**, EV-…-0012 Saksi, EV-…-0011 Saksi (same chip sequence as MB 2), posters, See All |
| H6 tab bar (350–595, 495–530) | yes, y1 2204 | Step 70's chrome, Home selected |

Recorded differences only: 2 cameras, 20% used, "BS", kit pill button radius, dataset times. The final capture (session 4) was taken after clearing the LogBox list through the debug build's module registry, because step 69's Reanimated warning otherwise puts a banner over the tab bar (§6 F77-3).

## 3. Verification (JS)

| Check | Command | Result |
|---|---|---|
| Own suites | `npx jest --maxWorkers=2 --forceExit src/features/dashboard` | 5 suites, 37 tests pass (last run after the final edit) |
| Route tree with the real screen | `npx jest … src/navigation` (05:40) | 5 suites / 109 pass; later runs fail only on `/evidence` and `/session/new` (steps 83, 78 replacing stubs, P11) |
| Full mobile jest | `npx jest --maxWorkers=2 --forceExit` | 05:38:19–05:38:33: **42 suites / 556 tests, exit 0**; final gate §3.1 |
| Typecheck | `npm run typecheck -w @dems/mobile` | 0 `error TS` in `features/dashboard` on every run; other errors only in steps 75/78/83 files mid-write (P11) |
| Lint | `npx eslint src/features/dashboard` | exit 0, no warnings |
| MA-20 / 21 / 22 / 23 / 25, MA-16 path, D58 | greps over `features/dashboard` (`Haptics\.`, `Tersangka\|Saksi\|Lainnya`, hex colours, kit re-exports, URLs, `useAudioChannel`, `onSize`) | no match for any (exit 1 each) |

`dashboard-screen.test.tsx` covers: MB 2 order and dataset values (2/2, 2/2, 20%, EV-0013/12/11, "Today 09:35", chips via `common.subjectType.*`); every navigation target; RECORDING (REC, timer advances on the sim clock, Return to live session, card → monitor); storage FULL (tile red, "Full", **99%**, CRITICAL + "Evidence storage full"); MIC 2 clip (tile warning, "MIC 2: clipping"); expanded (3 panes, hero ring, chip row, 2×2 devices, sealed 7, Core Simulated, clock, device tap); medium; phone landscape; loops (breath + sheen, none when reduced or unfocused, rotation only on the hero ring, ≤ 4); bell popover acknowledge; avatar menu Profile and Lock console (recording untouched); new-seal toast; 0 missing i18n keys.

### 3.1 Final gate (06:55:30–06:56:16, after the last code edit)

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/mobile` | **exit 0**, 0 `error TS` (whole app) |
| `npm run lint -w @dems/mobile` | **exit 0** |
| `cd apps/mobile && npx jest --maxWorkers=2 --forceExit` | 50 suites: 48 pass, 2 fail; 648 tests: 639 pass, 9 fail. **All 9 failures are step 70's stub-level route/guard cases for `/evidence` and `/session/new`** (e.g. "Unable to find … stub-param-selectedId", "Attempted to navigate before mounting the Root Layout" in `session-new-screen.tsx`), i.e. steps 83 and 78 replacing those stubs right now (P11). Every `/home` case and every step-77 suite passes; the 05:38 full run (before those steps landed) was 42 / 42 suites, 556 / 556 tests |

## 4. Device (all sessions via `METRO_PORT=8082 apps/mobile/scripts/device-session.sh`, outside the sandbox, P10; app force-stopped first, D55/D43; deep links quoted, D68; sign-in through the debug handle `sim.actions.signIn`; canonical `idle` scenario loaded first because another lane had left a pending summary)

### 4.1 dems_phone (emulator-5554)

| Session | Window | Result |
|---|---|---|
| 1 | 05:43:44–05:45:58 | Home rendered; ids and order (above); recording morph + mini-bar (`77_dems_phone_home_recording*.png`); storage FULL (count mode showed "09%", F77-1); MA-18 pairs; phone landscape 2 columns (`pane-status`, `pane-activity`, icon rail); logcat `ReactNativeJS:E` 0, crash 0. Its first full-motion shot was another lane's pending summary (resync, §3.3) and was re-taken |
| 2 | 05:55:59–05:56:34 | Clean MB 2 capture after the layout fixes; MA-18 control 0.6 s apart: max delta 41, 11,593 px |
| 3 | 06:24:05–06:27:02 | Storage FULL tile **99%** red after DR-S77-1 (`77_dems_phone_home_storage_full.png`, usedPercent 99) |
| 4 | 06:58:19–06:58:55 | Final `77_dems_phone_home.png` + `77_dems_phone_mb2_contact.png` (order re-read: 63 / 242 / 610 / 951 / 1340 / 2204); logcat since 06:58:21: 1 `W ReactNativeJS` (step 69's Reanimated message), 0 E, 0 crash |

**Logcat evidence, corrected:** session 1 counted `ReactNativeJS` E = 0, W = 4 (texts not captured) and 0 crash lines. Sessions 2 and 3 used a helper whose logcat call wrote empty files (quoting bug), so they have **no** log evidence; the phone's log buffer had rotated by 06:58, so they could not be re-read. Tablet sessions 2–4 and phone session 4 (fixed helper): only step 69's Reanimated warning, 0 E, 0 crash.

**MA-18** (ring bounds from uiautomator: 84 347 273 536 px): OS `transition_animation_scale 0` + cold relaunch: `_ma18_os_a/b` identical (max delta 0); in-app override (the motion store's `setReduceMotionOverride(true)`, what Settings calls): `_ma18_app_a/b` identical; full motion: differs. Scale restored to the recorded `1.0`, override back to `false` (read back: `{"override":false,"policy":"full"}`).

### 4.2 dems_tablet (emulator-5556)

| Session | Window | Result |
|---|---|---|
| 1, 2 | 06:01, 06:05 | **Invalid** (environment incident, §6 F77-4): device lost; then the pre-step-67 APK restored by a snapshot boot ("AsyncStorage is null") |
| 3 | 06:13–06:15 | Expanded layout on the reinstalled APK; uiautomator could not idle (clock + dBFS lines) → S77-6 |
| tablet 2 | 06:30:58–06:33:17 | **MA-12 PASS**: `nav-rail` [0,0][464,1600] (232 dp), 8 items; `pane-status` 512–1152, `pane-devices` 1200–1864, `pane-activity` 1912–2512 px (`77_dems_tablet_home_motion_off.png`); cold start in portrait: medium 5 \| 3 correct (`77_dems_tablet_home_portrait_cold.png`); live rotation showed S77-9 |
| tablet 3, 4 | 06:36–06:39, 06:41–06:43 | S77-9 fix verified: after rotating, portrait panes 400 \| 240 dp, landscape 320 \| 332 \| 300 dp with the 232 dp rail and 8 items, same PID 10126; only warning: step 69's Reanimated "Reduced motion setting is overwritten…" |

Screencaps of the tablet recording state (`77_dems_tablet_home_recording.png`, before S77-11), the session-3 expanded frame (`77_dems_tablet_home_b.png`, before S77-10) and the pre-fix rotation frames (`77_dems_tablet_rot_*`, `_after_rotation`, `_debug_overlay`, `_home_portrait` before the fix) are kept as evidence of S77-9 and the host lag.

## 5. Spec mapping

§4.3 H1–H6 and the tablet additions as in §1; §2.4 Home row per class; §7.3 Home beats and ambient loops (ring rotation on the hero ring only, ring breathing, Start sheen; mini-bar REC is the shell's) with ≤ 4 loops (test); §7.3 data moments: idle → recording card morph (cross-fade + layout transition), new seal → toast + count tick; §7.6 `primaryPress` haptic on Start through the one service; §7.7 reduced motion through `useMotionPolicy()`; §9 dates through the shared arithmetic formatter (UTC+07:00).

## 6. Decisions, drift, findings

| ID | Type | Item | Resolution |
|---|---|---|---|
| S77-1 | decision | Home reads only the shared simulator (`useSim`, D19) plus `useAuth()` for the operator; every selector returns flat values (F74-13) | `use-home-data.ts` |
| S77-2 | decision | Primary action for active sessions: the §3.7 target via `resyncTarget` (one copy of the table) | `primaryActionFor` |
| S77-3 | decision | Recent rows show the evidence id when sealed (MB 2 shows EV ids), else the session id; posters joined on the evidence suffix (D61, P13) | `recentRowsFor` |
| S77-4 | decision | Subject chips map sim codes through `SubjectTypeLabel[code]` (D73 / F74-03 interim) | `subjectTypeFor` |
| S77-5 | decision | Expanded has no H3 tiles (the 2×2 device tiles replace them); Storage moves into the chip row so 20% USED stays visible (D28/Q1) | `chipRowFor({ storage })` |
| S77-6 | decision (D43) | Under the `?motion=off` test switch, Home is quiet: device feeds show posters, meters pause, the dBFS line holds, the header clock steps per minute. OS reduce-motion keeps them live (S72-2 parity) | uiautomator idle on tablet landscape: MA-12 dump succeeded |
| S77-7 | decision | Profile → `/settings` (G2 Account lives there, 04 §4.15); bell "View all events" → `/audit` | — |
| S77-8 | decision | Frontend error handling: per-panel boundary (user copy, persisted runtime-log record, rate-limited retry); alert acknowledge failures logged `warn` | `panel-boundary.tsx` |
| S77-10 | decision (device) | The sealed-today count uses Inter, not Orbitron: Orbitron's "7" read as "˥" at 24 px (`77_dems_tablet_home_b.png`, session 3) | `face="sans"` |
| S77-11 | decision (device) | Hero-ring centre text limited to 58% of the ring width with auto-shrink; "RECORDING" overflowed the inner ring (`77_dems_tablet_home_recording.png`, session 3) | `HERO_TEXT_SHARE` |
| **S77-9** | finding (device) + fix | Rotating the tablet from expanded to medium left the re-used status `Pane` with stale geometry (520 \| 120 dp instead of 5 \| 3), even with `width: 'auto'`; cause likely the pane's re-flow layout transition keeping the prior size | Home panes are keyed per tablet class (remount on medium ↔ expanded); phone rotations keep one tree. Cost: the entrance choreography replays after a tablet rotation. For step 68 / 91: `Pane` switching between `width` and `flex` on one instance is unsafe |
| **DR-S77-1** | drift | Home KPIs use C-6 `slide` + a held-beat hook instead of `count` | Because of F77-1; switch back once C-6 is fixed |
| **F77-1** | finding (C-6 owner, step 71 / 91) | `RollingNumber` `count` renders non-round settled values part-rolled: `drumPosition(99, 1)` = 9.9, so the tens drum sits 90% into the next cell ("99%" showed as "09%" on the device, session 1). Its tests only use round values (20) | Fix `drumPosition` so higher places turn only during the lower place's carry |
| F77-2 | finding | Tablet class switches cost 3–25 s of JS time on the current host (load avg 20+, emulator on E-cores, F74-01); a remount of Home adds 2 players and 5 canvases | Informational (§7.8 physical-device note); step 74b / 59 |
| F77-3 | relay (step 69 / 91) | Reanimated "Reduced motion setting is overwritten with mode 'never'" still reaches LogBox as a banner over the tab bar (seen in session 3; the only `W ReactNativeJS` line in every later session) | F-70-5 / D-69-6 |
| F77-4 | environment | Both session emulators died ≈05:50–05:53 (not by this step). This step's helper booted the downed tablet once at 06:01:26 (PID 89693, P3 flags, before D78); the snapshot restore brought back the old APK and PID 89693 later vanished. Step 75 reinstalled the step-72 APK (`cb6b1f51…`) on both AVDs at 06:07/06:08. D78 acknowledged: this step never kills or reboots emulators from now on | Tablet runs 1–2 excluded |
| D73 | relay applied | F74-13 flat selectors (checked), F74-02 not used, F74-03 applied, F74-09 timers on the sim clock | — |
| SIM-GAP | — | **None.** Every need met by the shared selectors and actions (`systemStatus`, `selectDeviceStats`, `selectStorage`, `selectRecentSessions`, `selectSealedToday`, `selectAlerts`, `acknowledgeAlert`, `selectElapsedMs`, `selectClockSecond`); no `sim-adapter.ts` needed | — |
| P12 | — | No new package, native module or shared-contract change | — |

## 7. Processes (P7)

| Process | Started by | Stopped |
|---|---|---|
| Metro 127.0.0.1:8082, one per session (PIDs 77667, 85559, 89771, 93567, 186, 11810, 16315, 20110, 7513, 35257) | helper | helper ("Metro … stopped", each session exit 0) |
| `adb reverse` tcp:8081, tcp:4400 | helper | helper cleanup |
| Emulator 89693 (tablet, booted by the helper at 06:01:26 when the AVD was down) | helper | gone by 06:04 (not stopped by this step); see F77-4 |
| `transition_animation_scale` 0 (phone) | this step | restored to 1.0 (read back) |
| In-app reduce-motion override | this step | set back to false (read back) |
| Simulator scenario | this step (`idle`, `recording`, `STORAGE_FULL`) | `idle` at the end of every session |

mock-core not used. No emulator stopped (P3, D78). Scratch scripts `s77_*` in the session scratchpad.

## 8. Rollback

Restore the step-70 stubs of `dashboard-screen.tsx` and `i18n.ts` (in `43_mobile_navigation_shell.md` §2: `ScreenStub id="home"`, empty `dashboardEn`) and delete the other files in `features/dashboard/`; delete `implementation/assets/mobile/77_*.png`. No shared, native or package change to undo.

---
*Generated: 2026-10-01 07:00 WIB by coder-execution (step 77)*
