---
task_id: 2026-09-30_dems_demo_stack_setup
step: 74 (parallel checkpoint CP-M1; 05_mobile_plan §3 ownership rules applied early)
reviews: steps 67-73 (implementation/40-46) and step 90 (implementation/62)
date: 2026-10-01
agent: senior-code-reviewer
tier: 2
status: complete
verdict: PASS (0 open blockers; APPROVED WITH COMMENTS)
evidence_snapshot: source tree read 04:58-05:36 WIB; device measurements 05:08-05:26 WIB
---

# Step 74: mobile foundation review (CP-M1)

## 1. Verdict

**PASS. Zero open blockers.** Steps 76, 78 and 80-89 may start. The pass condition of row 74 ("zero open blocker findings before steps 76, 78 and 80-89 start") holds.

| Domain | Verdict | Findings |
|---|---|---|
| Code structure | PASS | 1 minor (F74-11), 2 nits |
| Dependency impact and hygiene | PASS | 1 minor (F74-14); single React, React DOM, React Native, zustand, Reanimated, Worklets, Skia and i18next copies |
| Duplication | CAUTION | 1 major (F74-03), 2 minor (F74-07, F74-09), 2 nits |
| Maintainability, test quality, performance, process | CAUTION | 1 major (F74-01, environment), 6 minor (incl. F74-21) |
| Reference integrity (React Compiler, worklets, contracts) | CAUTION | 1 major (F74-02), 2 minor (F74-08, F74-13) |

- **Findings by severity:** 0 blocker, 3 major, 12 minor, 6 nit.
- **Resolved while this review ran:** 2 earlier items, now verified gone (end of §3).
- **Special request (D69), cold-start regression:** it was diagnosed on the device (§2).
  - **Most likely cause:** the environment, not code from steps 70-73. Both emulator processes run in the macOS background scheduling band: every thread is at priority 4 and nice is 5.
  - **Consequence:** the whole guest, native phases included, slows by 3-5 times whenever other lanes load the host.
  - **Owner:** the controller, for the two running emulators. Step 61 owns the boot recipe and the performance baseline.

## 2. Cold-start regression (D69 special request)

### 2.1 Method

This review changed no code, ran no `git stash` and made no install.

- **Sessions.** All ran on dems_phone through `apps/mobile/scripts/device-session.sh` with Metro on 8084.
  - Five measuring sessions: A 05:08:56-05:10:22, B 05:12:42-05:13:41, C 05:16:09-05:18:38, D 05:21:47-05:22:49 and E 05:24:13-05:26:22.
  - Two `NO_METRO=1 KEEP_APP=1` read sessions of about 1 minute each.
  - The helper held the phone lock only. Each session lasted at most 2.5 minutes.
- **Launches.** Every launch was a cold start of `demsdemo:///stack-check?motion=off`, the row-18 proof screen and the same component step 68 timed at `/`. Two launches used `/login?motion=off`.
- **Measurement.** Each launch was bisected by markers that need no React DevTools:
  - device `logcat` timestamps: `ActivityTaskManager START`, `Start proc`, class loader, `loadJSBundleFromMetro`, `Creating BundleLoader`, `Loading JS Bundle`, `Running "main"`, `Displayed` and `SplashScreenView: remove starting view`;
  - the runtime's own `runtime.sim.hydrated` log record;
  - `performance.rnStartupTiming` and `LAUNCH_ID`, read through the Hermes inspector;
  - Metro's `Android Bundled` lines;
  - `__r.getModules()`;
  - the host `ps`, `sysctl vm.loadavg` and `lsappinfo`.
- **Raw evidence:** `verification/assets/74_cold_start_evidence.txt` (every table below comes from it).

### 2.2 Measurements (seconds, dems_phone)

| Launch | proc → class loader | native init | bundle download | JS bundle → `Running "main"` | main → sim hydrated | hydrated → Displayed | **START → Displayed** | → splash removed |
|---|---|---|---|---|---|---|---|---|
| A-L1 (fresh Metro) | 1.06 | 1.02 | 1.45 | 2.64 | 4.93 | 0.45 | **12.04** | 12.82 |
| A-L2 | 1.54 | 0.91 | 1.57 | 1.15 | 5.54 | 0.33 | **11.58** | 12.24 |
| A-L3 (`/login`) | 1.32 | 0.88 | 1.54 | 3.80 | 5.06 | 0.04 | **13.17** | 13.87 |
| B-W (fresh Metro) | 1.54 | 1.04 | 1.39 | 2.46 | 4.23 | 0.13 | **11.29** | 12.12 |
| B-P (profiler attached) | 0.34 | 0.29 | 0.33 | 0.75 | 1.20 | 0.10 | **3.13** | 3.64 |
| B-R (`/login`) | 0.33 | 0.18 | 0.31 | 0.59 | 1.01 | 0.00 | **2.51** | 2.99 |
| C1 (fresh Metro) | 0.82 | 0.19 | 1.23 | 2.95 | 5.60 | 0.15 | **11.43** | 12.26 |
| C2 | 1.13 | 0.71 | 1.23 | 2.84 | 5.03 | 0.29 | **11.71** | 12.32 |
| C3 | 0.87 | 0.70 | 1.11 | 0.61 | 1.16 | 0.09 | **4.85** | 5.36 |
| C4 (after 45 s idle) | 1.49 | 0.90 | 1.03 | 1.39 | 4.44 | 0.16 | **9.81** | 10.77 |
| C5 | 1.40 | 1.02 | 1.57 | 2.79 | 5.97 | 0.21 | **13.43** | 14.15 |

- **Metro side.**
  - Build times: `Android Bundled 950ms / 851ms / 909ms (5436 modules)` on the first request after a fresh Metro, then 30-667 ms.
  - Transfer: the dev bundle is 22,082,958 B and was served to curl in 0.059 s.
  - **Metro is not the cause.** A-L2, A-L3 and C2 were slow with a warm Metro graph.
- **Code path.** The same code, the same Metro process and the same route took both 2.51-3.13 s (B-P, B-R) and 11.3-13.4 s, minutes apart. The fast runs are faster than the step-68 baseline: 3,517 ms and 3,223 ms with 5,102 modules (41_mobile_foundation.md §4.3).
- **Upper bound on code cost.** The code added since step 68 (+334 modules; 5,436 in the bundle, 5,207 initialised at launch) costs at most a few hundred milliseconds. It cannot explain the 3-4 times growth.
- **Phases before any JavaScript.** In slow runs these phases slow by the same factor:
  - process start → class loader: 1.06-1.54 s against 0.33-0.34 s;
  - native init: 0.9-1.0 s against 0.18-0.29 s;
  - bundle download over `adb reverse`: 1.4-1.6 s against 0.31-0.33 s.

  No JS code change can slow Android's class loading or `SoLoader`. The variable is the throughput of the whole emulator.
- **Cross-step check (logs).** Step 72 measured `TotalTime: 3907` at 04:49 on the same 5,436-module tree (45_mobile_brand_media.md §5, F-72-5). Step 70 measured 12-15 s between 04:43 and 04:58 (43_mobile_navigation_shell.md F-70-2).

### 2.3 Cause (evidence, then hypothesis)

**Evidence** (`ps`, `lsappinfo`, `sysctl`, 05:36 WIB; appendix of the evidence file):

- **Host CPU.** Apple M5 with 4 Super cores and 6 Efficiency cores; `hw.ncpu` is 10.
- **Emulator priority.**
  - `qemu-system-aarch64 -avd dems_phone` (PID 51262) and `-avd dems_tablet` (PID 51273) run at **PRI 4, nice 5**.
  - `ps -M` shows **all 119 phone threads and all 85 tablet threads at `4T`**, the four vCPU threads included.
  - Their `crashpad_handler` and `netsimd` children run at PRI 31. This reviewer's shell runs at PRI 31, nice 0.
- **App Nap eligibility.** `lsappinfo` registers both qemu processes as `type="Foreground"` GUI apps with windows. App Nap can therefore apply to them.
- **Emulator CPU share.** During 24-second launch windows (session E) the emulator received only **1.0-1.2 host cores on average**: 23.5-29.6 CPU-seconds. The host load average was 2.5-3.3 on 10 cores. Session C showed 7 runnable guest threads at the same time (`/proc/loadavg` `7/2817`).
- **Guest memory.** 3 GB RAM with 700 MB of zram swap in use. After launch the app's PSS is 813,743 KB, of which the native heap is 583 MB (`dumpsys meminfo`, session C). Memory is not the switch: `MemAvailable` stayed at 1.53-1.59 GB and `SwapFree` did not change between fast and slow runs.

**Most likely cause (hypothesis, backed by the evidence above).**

- Both emulators run in the macOS darwin-background band. The most likely mechanism is App Nap on their occluded windows. The processes were booted detached at about 01:56 (step 19, P3 recipe) and have been at nice 5 since.
- Background-band threads get only the efficiency cores and yield to any normal-priority work: other lanes' jest, tsc, Metro workers, the web lanes' headless Chrome, and Spotlight.
- Emulator throughput therefore swings 3-5 times with host activity.
- Steps 68 and 69 (3.2-4.5 s) measured with fewer lanes running. Step 70 measured while 6 lanes ran ("the host ran 6 lanes", F-70-2).

**Candidates rejected by the evidence:**

| Candidate | Why it is rejected |
|---|---|
| Metro serving the 12 MB media set | Metro builds take 0.85-0.95 s. Startup mounts no media consumer, and no ExoPlayer `Init` appears in the startup logcat |
| `'use no memo'` | 3 small components; the same code also ran fast |
| Provider chain | Hydration → Displayed takes 0.00-0.45 s. The provider cost is inside "main → hydrated", which is 1.0-1.2 s in fast runs |

### 2.4 Owner and fix

| Owner | Action | Verification |
|---|---|---|
| **Controller** (host action on processes this task started; reversible; ask the user first because it changes host scheduling) | 1) Keep both emulator windows visible, not minimised or covered, while lanes run device sessions. 2) Or run `taskpolicy -B -p 51262` and `taskpolicy -B -p 51273` to move them out of `PRIO_DARWIN_BG` (rollback: `taskpolicy -b -p <pid>`). If App Nap re-applies, relaunch with App Nap disabled for the session and record the rollback | `ps -M -p <pid>` shows `31T` threads, and 5 consecutive cold starts give a median START → Displayed of 4.5 s or less on both AVDs |
| **Step 61** (stops and reboots both AVDs for AC-07; records the jank baseline) | Boot the emulators so they do not land in the background band. Record cold start as the median of 3 or more launches, together with `ps -o pri,nice` of qemu and the host load average | Same criterion |
| **Step 67's `scripts/device-session.sh` `ensure_avd`** (needs a controller hand-over; step 67 is closed) | Optional: after a P3 boot, log `ps -o pri,nice -p $!` and warn when PRI is below 31 | `sh -n` passes; one boot logs the priority |
| **Step 60** (README) | Document the measurement protocol: warm up one launch, record the median of 3, time START → Displayed rather than splash removal, and check the emulator priority | Read-through |

**For screen steps 75-89 until this is fixed:**
- A 10-15 s cold start and an `am start -W` "Status: timeout" come from the environment. They are not a regression in a screen.
- Wait for `Displayed` or for the splash to go, as step 70 did.

**Headroom items** (not the cause; the code-side cost is already at or below the step-68 baseline): F74-10 and F74-11.

## 3. Findings

Severity: **blocker** (gates 76, 78, 80-89) / **major** / **minor** / **nit**. File paths are under `apps/mobile/src/` unless noted.

| # | Severity | Domain | File:line | Finding and evidence | Owner, fix |
|---|---|---|---|---|---|
| F74-01 | major (environment) | Performance | host: qemu PIDs 51262, 51273 | Cold start 9.8-13.4 s in 8 of 11 launches; 2.5-4.9 s in the other 3. Both emulators run at background priority (all threads `4T`). §2 | Controller now; step 61 (boot and baseline); step 60 (protocol). §2.4 |
| F74-02 | **major** (latent, device only) | Reference integrity (D58) | `motion/builders.ts:169` | `animatePulseOnce(…, totalMs: number = SPEC_LITERALS.escalationPulseMs, …)` is a worklet whose default parameter names an imported binding. The compiled UI-thread code in the device bundle is `function animatePulseOnce_buildersTs8(peak,rest,m,totalMs=SPEC_LITERALS.escalationPulseMs,callback){const{SPEC_LITERALS,…}=this.__closure;…}`. The default is evaluated **before** the closure is destructured, which is a ReferenceError on the UI thread (the S71-3 class of bug). It is the only such case among the **1,077 worklets** in the whole bundle (bundle scan). Today's only caller runs on the JS thread (`motion/glow-layer.tsx:109`). Jest cannot catch it | **Step 91** (D69 routes step-69 leftovers there). Fix: resolve the default in the body. **Interim relay to 75-89:** pass `totalMs` explicitly whenever `animatePulseOnce` is called inside a worklet |
| F74-03 | **major** | Duplication, contract | `components/kit/subject-type-chip.tsx:10-18`, `i18n/en.mobile.ts:97-101` | Two key spaces for one domain value. The kit uses `'Tersangka' \| 'Saksi' \| 'Lainnya'` and `mobile.subjectType.*`. The simulator uses `SubjectType.TERSANGKA \| SAKSI \| LAINNYA` with `SubjectTypeLabel` and `SubjectTypeGloss` (`packages/shared/src/sim/vocabulary.ts:55-72`), and shared i18n has `common.subjectType.*` and `common.subjectTypeGloss.*` (`packages/shared/src/i18n/en/common.ts:108-119`). This is S68-9 and F-73-5, still open. Steps 78, 80, 82 and 83 render the chip from simulator data, so each would write its own mapping | **Controller hand-over before step 78**, for example to step 78: the chip takes the simulator `SubjectType` and reads `common.subjectType*`; remove `mobile.subjectType`. **Interim rule:** `SubjectTypeChip type={SubjectTypeLabel[s.subjectType]}`, never a local map |
| F74-04 | minor | Test quality | `motion/haptics.test.ts:266, 271` | `PENDING_OWNER_CHANGE` still exempts `features/home/home-screen.tsx`. That file now calls `triggerHaptic('stackCheckTap')` (`features/home/home-screen.tsx:21, 166`), so the entry is vacuous: a future `Haptics.` call there would pass MA-20 | Step 91 (D69): delete the entry |
| F74-05 | minor | Dev UX | `motion/motion-policy-provider.tsx:40` | `LogBox.ignoreLogs` filters only "…overwritten with mode". Reanimated's "Reduced motion setting is enabled on this device…" (`node_modules/react-native-reanimated/lib/module/animation/util.js:44`) still shows a LogBox banner under OS reduce motion (step 70 screencap `70_dems_phone_os_reduce_motion_overlay.png`). Development builds only | Step 91 (D69): add the second prefix |
| F74-06 | minor | Test quality | `navigation/testing/router-harness.tsx:162-177` and its suites | The foundation jest run passes (33 suites, 439 tests) but prints **204 `console.error` and 16 `console.warn`**. About 138 are HeroUI `colorKit.RGB` errors from `Button` (`heroui-native/src/components/button/button.tsx:111`; Uniwind has no `--theme` variable in jest) and 57 are `act()` warnings (RuntimeBridge 44, AuthProvider 13). Most come from the router-harness suites: guard about 93, chrome 52, routes 36. Screen route tests that use `renderApp` inherit this noise, which hides real errors | Step 57 (T-M02 and T-M11 extend the harness), or a controller hand-over of `src/navigation/testing/**` |
| F74-07 | minor | Duplication | `motion/prefs.ts:27-48` with `motion/policy.ts:171-224`; `navigation/rail-prefs.ts:16-59`; `runtime/core-link.ts:57-108`; `features/login/presentation-mode.ts:12-46` (step 75, in progress) | Four hand-written copies of "parse JSON object, read, merge-write one field, hydrate once, keep `{ hydrated, error }`" on `dems.mobile.prefs.v1`, plus a fifth reader. The D57 merge rule holds today: every writer uses `mergeItem` (`core-link.ts:74`, `rail-prefs.ts:31`, `prefs.ts:47`), and `auth-prefs.ts:44` writes its own key. Each copy also reads the key separately at startup | Controller: step 88 writes `presentationMode` only by merge. Step 91: one `createPrefsField(field, parse)` helper in `src/lib` |
| F74-08 | minor | Contract (C-2 against §5.4) | `components/composed/dbfs-meter.tsx:92`; `runtime/use-audio-shared-values.ts:38, 46` | The runtime exposes `noSignal` as a `SharedValue<number>`. `DbfsMeter` takes `signal?: 'ok' \| 'no-signal'` as a React prop, so nothing consumes the shared value and NO SIGNAL needs a JS bridge | Step 79 bridges it (for example from `useAudioAccessibilityValue`). Step 91 lets C-2 accept `noSignal?: SharedValue<number>` |
| F74-09 | minor | Duplication, correctness | `components/composed/nav/live-mini-bar.tsx:57-63` | The mini-bar timer uses `Date.now()`. The contract says timers derive from the simulator clock (`runtime/contract.ts:82`), and the simulator clock is `simStart + (source() − realStart) × speed` (`packages/shared/src/sim/clock.ts:23-28`). This is a third elapsed-time implementation besides `selectElapsedMs` (`packages/shared/src/sim/selectors.ts:57`) and step 79's `elapsedSecondsAt`. It diverges if Demo controls ever change the clock's speed or start | Step 91: derive from `selectElapsedMs` through the runtime contract |
| F74-10 | minor | Performance (shared) | `packages/shared/src/sim/engine.ts:113-115`; `packages/shared/src/sim/platform.ts:243-247` | While the app is in the foreground, the snapshot is rewritten **every second even when idle**. The clock `setState` every 100 ms triggers persist, and the throttled writer does not skip unchanged snapshots. The device snapshot `dems.sim.v1` is 104,981 B (session D probe), so this is about 105 KB/s of AsyncStorage (SQLite) writes | Step 91 (W-02 simulator owner): skip a write whose serialised snapshot is unchanged, or exclude clock-only changes |
| F74-11 | minor | Startup headroom (not the regression) | route tree; `lib/tone-icons.ts:1-12`, nav chrome icon imports; `runtime/sim-runtime-provider.tsx:85-95` | Measured on the device: (a) Expo Router's sync route import initialises **5,207 of 5,436 modules** at launch, including the debug-only `app/dev-gallery.tsx`, `CameraFeed` with expo-video, the Skia compositions and 84 media registrations; (b) the `lucide-react-native` barrel is **1,872 modules and 4.07 MB, 18.6 % of the 22.08 MB dev bundle**, all initialised; (c) `createSim` takes **275 ms** on the JS thread before the first render and is thrown away when a snapshot restores (`sha256Hex` runs at about 3 ms per KB on Hermes dev) | Step 91 or a controller decision: per-icon lucide imports; build the simulator dataset lazily |
| F74-12 | minor | Maintainability | `runtime/session-route-sync.tsx:23` | S73-11 deep import `expo-router/build/hooks` couples the runtime to expo-router internals. It is no longer needed: `standard-navigation` is now in `jest.config.js:13` (step 75, D69 F-70-3) | Step 91 (next owner of `src/runtime`): import from `expo-router` |
| F74-13 | minor | Readiness | `packages/shared/src/sim/react.ts:69-72`; `packages/shared/src/sim/selectors.ts:218-257` | `useSim` compares with `useShallow` (top level only). A selector that returns nested fresh objects makes `getSnapshot` unstable, and React 19 loops. `systemStatus()` and `selectSystemState` return `{ state, flags: [] }`; `selectAlerts` and `selectSessionHistory` return new arrays but pass shallow equality | Relay to 75-89: select primitives or flat tuples. Step 77's `features/dashboard/use-home-data.ts:44-52` already does this |
| F74-14 | minor | Dependency hygiene | root `node_modules/ajv-formats` | `npm ls --all` reports `ajv-formats@3.0.1 invalid: "^2.1.1" from @hookform/resolvers` (web and mobile). Mobile imports only `@hookform/resolvers/zod` (`features/login/use-login-controller.ts:19`), so there is no runtime effect. `zod@3.25.76` sits only under `@expo/cli`; the app bundle holds one zod, v4 (95 modules) | Steps 64 and 65 record it. An extra P1 slot only if an AC requires `npm ls` to exit 0 |
| F74-15 | nit | Duplication | `motion/log.ts:10-60`, `navigation/log.ts:10-59` | Structurally identical issue reporters (record type, console sink, `set*LogSink`, `report*Issue`). `runtime/log.ts:213-239` bridges them | Step 91: one `createIssueReporter(prefix)` |
| F74-16 | nit | Duplication (i18n) | `i18n/en.mobile.ts` | 18 of 58 strings repeat shared strings (nav labels, pairing states, subject types, `retryIn`). Wording can drift from the web (04 §9) | Screen steps prefer shared keys when the copy is equal. Step 91 cleans up |
| F74-17 | nit | Security (accepted, D-69-5) | `motion/policy.ts:139-161`; `motion/motion-policy-provider.tsx:119` | `?debug=1` turns on the performance overlay in any build, release included. It shows fps, loops and policy only, with no data | Step 63 records it |
| F74-18 | nit | Security | `runtime/log.ts:33` | `SENSITIVE_KEY` filters context by key name only. It does not match names such as `pwd`, `authorization` or `email`, and messages and stacks are stored as given. Current callers pass fixed strings (`auth/auth-provider.tsx:183-263`), and the filter is tested (`runtime/log.test.ts:54-67`) | Step 63 records it. Step 91 widens the pattern |
| F74-19 | nit | Dev noise | `providers/app-providers.tsx:24-32` | The HeroUI "Styling Principles" banner prints on every launch (Metro log). `devInfo.stylingPrinciples: false` turns it off | Next owner of `app-providers.tsx` (step 91) |
| F74-20 | nit | Structure | `components/composed/nav/nav-rail.tsx:7-8` against `components/media/brand-assets.ts` (`TOPO_XML`); `components/composed/nav/live-mini-bar.tsx:17` → `components/media/color.ts`; `navigation/params.ts:37` against `runtime/debug.ts:26-37`; S72-7 template images | Two import paths for the topo SVG; a colour helper imported across folders; two `scenario` parsers; unreferenced template assets | Step 91; step 64/65 for the assets |
| F74-21 | minor | Security, process (D47, DEC-90-2) | `apps/mobile/package.json:13` | The `e2e` script sets `MAESTRO_CLI_NO_ANALYTICS` and `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED` but not `MAESTRO_DISABLE_UPDATE_CHECK=true`. It also passes no `--test-output-dir` or `--debug-output`. So `npm run e2e` makes Maestro's version and changelog fetch on every run and writes artefacts to `~/.maestro/tests`. Step 90 handed the variable to step 67 (62_maestro_install.md §9), but step 67 had already closed its npm slot (D55) | **Step 57:** call Maestro directly with the step-90 §9 invocation, never `npm run e2e`, until a controller-scheduled P1 slot updates the script. Step 60 documents it. Step 63 records it |

**Resolved in flight** (verified at 05:32-05:35 WIB, both by step 75 under D69):

| Item | Evidence |
|---|---|
| Dev-only `StubSignIn` | Gone from `navigation/screen-stub.tsx` and `navigation/index.ts` (both modified 05:20). `/usr/bin/grep -rn "StubSignIn\|stub-sign-in\|DEMO_OPERATOR_PASSWORD" src/navigation src/app` exits 1. The published demo password now appears only in the Login demo-operators list (`features/login/login-card.tsx:467, 482`, 04 §6.1) and in tests |
| F-70-3 | `standard-navigation` is in the jest transform allowlist (`jest.config.js:11-13`) |

## 4. The 04_mobile_specs §5.6 selectors against the simulator (steps 31, 32)

Hooks (§5.1): `SimProvider`, `useSim`, `useSimActions`, `useSimReady` and `useAudioChannel` are in `packages/shared/src/sim/react.ts`. Actions are in `packages/shared/src/sim/actions.ts`; selectors are in `packages/shared/src/sim/selectors.ts`.

| §5.6 need | Simulator export (file:line) | Status |
|---|---|---|
| session | `selectSession` :52, `selectSessionState` :53, `selectIsRecording` :54, `selectElapsedMs` :57 | available |
| timeline | `selectTimeline` :63 | available |
| cameras | `selectCameras` :76, `selectCameraById`, `setActiveCamera` (actions :172) | available |
| mics | `selectMics` :77, `selectMicById`; levels through `useAudioChannel` → runtime `useAudioSharedValues` | available |
| storage | `selectStorage` :138, `storageSummary`, `selectStoragePolicy`, `setStoragePolicy` (actions :170) | available |
| time | no named selector; `s.time` slice (for example `useSim((s) => s.time.source)`) | available inline (not a gap) |
| network | no named selector; `s.network` slice | available inline (not a gap) |
| security | no named selector; `s.security` slice | available inline (not a gap). Relay D67: the simulator certificate is ECDSA, while the demo packages are Ed25519 (SIM-GAP-W1, step 54). Steps 83 and 88 show package data from `@dems/shared/demo-data` |
| events | `selectRecentEvents` :195 | available |
| audit | `selectAuditTail` :207, `selectChainHead` :208, `selectAuditChainBreak`, `exportAudit`, `verifyAuditChain` (actions :152-153) | available |
| evidence, `evidenceById` | `selectEvidence` :148, `selectEvidenceById` :149, `selectEvidenceStats` :163, `selectEvidenceBySessionId` :286 | available |
| `verify()` | `verify(evidenceId)` actions :148 | available |
| `precheck()` | `beginPrecheck` :129, `retryPrecheck`, `acknowledgePrecheckWarnings`; `selectPrecheck` :268 | available (different names) |
| `startRecording()`, `stopRecording(reason)` | actions :132, :133 | available |
| `addMarker()` | `addMarker(label)` actions :142 | available |
| `snapshot()` | actions :144 | available |
| `inject()` | `inject(kind, target)` actions :156, `clearFault` | available |
| `loadScenario()` | actions :160 | available |
| `runDiagnostics()` | actions :163, `selectDiagnostics` :279 | available |
| auth | `selectAuth` :39, `selectIsSignedIn` :40, `selectOperator` :41, `selectCan` :44, `selectLockout` :47; `signIn`, `signOut`, `touch` (actions :111, :117, :122) | available |
| SCR-02 `pairing`, `pair(code)`, `unpair()` | `selectPairing` :264; actions :179, :180 | available |
| SCR-02 `signInWithBiometric(operatorId)` | actions :112 (plus `recordBiometricFailure` :114) | available |
| SCR-02 `lastSealedSessionId`, `acknowledgeSummary(id)` | `selectLastSealedSession` :283, `selectPendingSummaryId` :65; actions :145 | available |
| SCR-02 `sessionHistory` (incomplete sessions included) | `selectSessionHistory` :68, `selectRecentSessions`, `selectSessionHistoryById` | available |
| SCR-02 `tabletLink` input driven by the app | `setTabletLink` actions :181, `selectTabletLink` :263 | available |

**Result: no §5.6 gap, so no SIM-GAP is needed from this review.** One usage caveat applies: F74-13, stable selector results.

## 5. Focus areas: results

### 5.1 Dependency hygiene (anchored D42 greps, 05:26 WIB)

```
$ npm ls react react-dom --all | grep -oE '(^| )react(-dom)?@[0-9.]+' | sed 's/^ //' | sort -u
react-dom@19.2.3
react@19.2.3
$ npm ls react-native --all | grep -oE '(^| )react-native@[0-9.]+' | sed 's/^ //' | sort -u
react-native@0.86.3
$ npm ls zustand … | sort | uniq -c        →   3 zustand@5.0.15
reanimated 4.5.1 (×8 edges), worklets 0.10.1, skia 2.6.2, i18next 26.4.2, react-i18next 17.0.15, @noble/hashes 2.4.0: one version each
zod: 4.6.5 (app) + 3.25.76 (only under @expo/cli, tooling); the device bundle holds node_modules/zod once (95 modules)
peer/invalid: only ajv-formats@3.0.1 vs @hookform/resolvers ^2.1.1 (F74-14)
```

### 5.2 React Compiler safety (D66, D69)

| Check | Result |
|---|---|
| Hook naming | A TypeScript-AST scan of every non-test `.ts` and `.tsx` under `src/` (172 files at 05:04, 205 files at 05:35) lists no hook call inside a function that is neither `use*` nor PascalCase. The only hits are false positives: `memo(function MeterCanvas…)` and `i18n.use()` |
| Zustand stores | All three bound stores are named `use…`: `auth/auth-prefs.ts:64`, `runtime/core-link.ts:88`, `navigation/rail-prefs.ts:44`. The two vanilla stores are read through `useStore` |
| Store-call grep | `grep -rnE "\b[a-z][A-Za-z]*Store\(\(" src` finds nothing |
| `'use no memo'` | Three uses, each justified in a comment: `navigation/app-tabs.tsx:43` (`NavigationContent` reads a render-phase ref) and `navigation/root-navigator.tsx:81, 98` (they read the module-level pending href during render) |
| Compiler lint rules | eslint-plugin-react-hooks 7.1.1, whose recommended set includes the compiler rules `refs`, `purity`, `set-state-in-render` and others, exits 0 with 0 warnings on every foundation path |

### 5.3 UI-thread discipline (D58, MA-16)

| Check | Result |
|---|---|
| Skia `onSize` | Not used. Only comments mention it (`components/composed/dbfs-meter.tsx:231`, `components/media/camera-feed.tsx:377`), plus the mock |
| React state in `dbfs-meter.tsx` | None |
| `useAudioChannel` outside `src/runtime` | None |
| Meter renders | `MeterCanvas` is `memo`. T-M09 records 1 render per 40 frames, and `use-audio-shared-values.test.tsx` records zero extra renders |
| Worklet default parameters | One violation: F74-02 |

### 5.4 Ownership (P6)

- **Mobile steps and `packages/shared`.**
  - Files changed under `packages/shared` after 03:15 match the owners' windows: `src/api/*` and `src/sim/{selectors,faults,session-machine}.ts` 03:18-03:38 (steps 32 and 33), `src/demo-data/*` 04:41-04:50 (step 93), `package.json` 04:54 (step 93b).
  - Mobile logs 40-46 list no shared write.
- **Recorded hand-overs:** D56 (jest.setup line), D57 (the proof-screen haptic), D58 (the expo-video mock), and D69 (step 75: jest.config and the removal of `StubSignIn`).
- **Recorded drifts:** DR-S70-3 and S73-17 (tests of step 68 edited by the next owners).

### 5.5 Security leftovers

| Item | Result |
|---|---|
| Runtime stub | Gone: `RUNTIME_IMPLEMENTATION = 'simulator'` (`runtime/contract.ts:20`) |
| `__DEMS_DEBUG__` and `&scenario=` | Gated by `enabled = __DEV__` defaults (`runtime/debug.ts:43, 104`) |
| `/dev-gallery` | Renders `<Redirect href="/">` when `!__DEV__` (`app/dev-gallery.tsx:51`) |
| Deep links | Only the `demsdemo` scheme; path segments are allow-listed; 512-character cap; `..` rejected (`navigation/params.ts:97-122`). The pending href lives in memory only (`navigation/pending-href.ts`) |
| AsyncStorage keys on the device | `dems.mobile.log.v1`, `dems.mobile.prefs.v1` (`{"coreLinkSource":"SIMULATED"}`) and `dems.sim.v1` (session D). No credential. The log filters are tested |
| Dev-only sign-in | Removed (§3, resolved in flight) |
| Remaining notes | F74-17 and F74-18 |

### 5.6 Prefs-key merge rule (D57)

It holds for every writer of `dems.mobile.prefs.v1` (F74-07 has the lines). Step 88 must keep it for `presentationMode`.

### 5.7 Test quality

| Check | Result |
|---|---|
| Foundation run | `npx jest --maxWorkers=2 --forceExit` on src/{motion,runtime,auth,navigation,providers,layout,components,i18n,features/home}: `Test Suites: 33 passed, 33 total`, `Tests: 439 passed, 439 total`, 8.669 s, exit 0 (05:29) |
| Mutation checks | Steps 69, 72 and 73 showed their suites are not vacuous |
| MA-20 | Enforced as a test, apart from the vacuous exemption (F74-04) |
| Noise | F74-06 |
| Typecheck (05:29) | `tsc --noEmit` fails only in in-progress screen tests: `features/login/login.test.tsx`, `features/dashboard/dashboard-screen.test.tsx` and `features/session-live/back-guard.test.tsx` (steps 75, 77, 79; P11). Foundation files type-check clean |
| Lint | Exit 0 on the foundation paths |

### 5.8 Readiness for screen rows 75-89

The foundation is ready. It provides:

- the contract hooks (`@/runtime`), the simulator hooks, `renderWithRuntime` and `createTestSim`;
- the router harness and the back guard;
- the kit recipes, C-1..C-6 and the media renderers;
- the motion builders and the haptics service;
- the i18n registry `features.<folder>`.

Screens must follow the relays in §6.

## 6. Relays to screen steps 75-89 (no code change needed to start)

1. **Worklets.** Never rely on a default parameter inside a worklet. Pass `totalMs` to `animatePulseOnce` (F74-02, D58).
2. **Subject type.** Show it with `SubjectTypeChip type={SubjectTypeLabel[s.subjectType]}` until F74-03 is fixed. Write no local map.
3. **`useSim` selectors.** They must return primitives or flat arrays and tuples, never nested fresh objects (F74-13).
4. **Meter NO SIGNAL.** Bridge it explicitly (F74-08).
5. **Evidence integrity and certificates** (83, 88). Take them from `@dems/shared/demo-data`, not from the simulator's manifest hash or ECDSA fields (D67, SIM-GAP-W1).
6. **Cold-start timings on device.** They are environment-bound until F74-01 is fixed. Wait for `Displayed` and do not log them as a regression of the screen.
7. **Prefs writes.** Any write to `dems.mobile.prefs.v1` uses `AsyncStorage.mergeItem` with one field (D57).
8. **Maestro (step 57).** Use the step-90 §9 invocation with `MAESTRO_DISABLE_UPDATE_CHECK=true`, `--test-output-dir` and `--debug-output`, not `npm run e2e` (F74-21).

## 7. Key challenges

1. **"Cold start regressed because of steps 70-73."** The data says otherwise.
   - The identical build starts in 2.5-3.1 s, below the step-68 baseline, in the fast runs.
   - In the slow runs, phases before any JavaScript slow by the same factor.
   - A code bisect by stash would have chased noise. The fix belongs to the environment (§2.4), and the measurement protocol needs a warm-up launch, a median, and the emulator priority on record.
2. **The kit breaks the rule it hands to the screens.** D58 bans imported bindings in worklet default parameters, yet `animatePulseOnce` has one (F74-02). Kit code is copied as the example to follow, so fix it before screen steps start calling it from worklets.
3. **A kit recipe with its own vocabulary.** `SubjectTypeChip` built a third key space next to the simulator and shared i18n (F74-03). The kit should consume `@dems/shared` vocabulary, not restate it.

## 8. Positive findings

- **One copy of each rule.** One §3.7 resync table (`navigation/session-routes.ts`, reused by `runtime/route-sync.ts:20-22`). The union of keep-awake holders is explicit and tested. The runtime contract only gained optional members, so fakes still compile.
- **Transient meter path as specified.** The runtime writes only shared values, and the meter draws on the UI thread with no React state. It is tested (zero re-renders).
- **Guard and deep links.** Deep-link parsing is defensive and validated with zod. Guard and pending-href semantics are covered by 18 guard tests plus device runs, and hold for guarded links that arrive while a public screen is open (S70-13).
- **Compiler rules enforced.** The React Compiler bugs found on the device (F-70-1, F-73-1) were fixed at the root: hook naming, and `'use no memo'` only where justified. This review's AST scan finds no remaining case across 205 source files.
- **Shared simulator reused.** It is reused as specified (D19) through adapters only. The §5.6 contract is complete (§4).
- **Security basics.** No credential is persisted. Debug surfaces are behind `__DEV__`. The runtime log is filtered and bounded (200 records).
- **Controlled startup cost.** The provider tree adds only 0.00-0.45 s between hydration and Displayed, and the BootGate caps the splash hold at 2 s.

## 9. Files reviewed

- **Code (read in full):**
  - `app/_layout.tsx`, `app/index.tsx`, `app/+native-intent.tsx`, `app/(app)/_layout.tsx`, `app/(app)/(tabs)/_layout.tsx`, `app/(auth)/*`, `app/stack-check.tsx`
  - `providers/*`
  - `runtime/{index,contract,sim-adapters,sim-runtime-provider,use-audio-shared-values,internals,resync-bus,core-link,connection-banner,route-sync,session-route-sync,keep-awake,log,debug}.ts(x)`
  - `motion/{index,motion-policy-provider,policy,use-motion-policy,prefs,log,debug-metrics,loops,haptics,debug-overlay,builders,tokens,glow-layer}.ts(x)` and the tail of `haptics.test.ts`
  - `navigation/{index,root-navigator,app-tabs,stacks,screen-stub,stack-check-route,pending-href,rail-prefs,log,params}.ts(x)`
  - `components/kit/*`, `lib/tone-icons.ts`, `components/media/{index,demo-media}.ts` (header)
  - `components/composed/nav/*` (imports), `components/composed/nav/live-mini-bar.tsx`, `components/composed/dbfs-meter.tsx` (canvas and props)
  - `layout/safe-screen.tsx`, `i18n/{index,resources,features}.ts`
  - `app.json`, `jest.config.js`, `jest.setup.ts`, `metro.config.js`, `eslint.config.js`, `package.json`, `scripts/device-session.sh`
  - Shared: `packages/shared/src/sim/{index,react,selectors,vocabulary,store,clock}.ts`, plus parts of `engine.ts`, `platform.ts` and `actions.ts`
- **Logs:** `implementation/41`-`46` in full; `implementation/40` and `62` through their decision, hand-off and helper sections (§3, §9, §10), `decisions/decisions.md` D40-D69, `identification/02_structured.md` rows 67-93 and P1-P13, `masterplan/04_mobile_specs.md` §5, `masterplan/05_mobile_plan.md` §3 and §4.3.

## 10. Processes and footprint (P7)

| Item | What happened |
|---|---|
| Device sessions | 7 on dems_phone only, through the helper under `.locks/dems_phone.lock` |
| Metro | 8084, one process per session (PIDs 54023, 54889, 55971, 59291, 60621). The helper stopped each one ("Metro … stopped") |
| Device-side state | Reverse rules removed. App force-stopped at the end of each session |
| Hermes inspector | Read-only `Runtime.evaluate` and `Profiler` probes. One unstarted in-memory simulator (`storage: null`) was created inside the app during session D, and the app was force-stopped afterwards |
| Not touched | Emulators, adb server, mock-core, `transition_animation_scale`, AsyncStorage contents |
| Tablet | No session: the tablet lock was not taken |
| Files written | This report, `verification/assets/74_cold_start_evidence.txt` and `delegation_progress/senior_code_reviewer_step_74.md` |
| Not written | No code or config file. No shared tracking file (`02_plan.md`, `99_implementation_report.md`, `status_tasks.md`, `delegation_progress_report.md`: parallel run, P8) |
| Scratch | `…/scratchpad/s74/` |

---
*Generated: 2026-10-01 05:40 WIB by senior-code-reviewer (step 74)*
