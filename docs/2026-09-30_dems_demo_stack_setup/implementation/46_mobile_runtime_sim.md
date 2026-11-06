---
task_id: 2026-09-30_dems_demo_stack_setup
step: 73
plan_row: 05_mobile_plan §3 M-06; §6
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 73: Mobile runtime on the shared simulator (M-06)

**Outcome: PASS.** Every row-73 acceptance check passes:

| Check | Result |
|---|---|
| T-M05, T-M06, T-M07 pass | 21, 29 and 10 tests pass. Mutation checks: each suite fails against a planted bug (§4.2) |
| MA-08 PASS on a device | PASS on **both** AVDs (§5.2) |
| MA-19 PASS on a device | PASS on **both** AVDs, with Expo's development keep-awake tag isolated (§5.3, F-73-2) |
| MA-10 runtime part recorded, sole mock-core user (P5) | Recorded on dems_phone (§5.4) |
| MA-28 finds at least one `@dems/shared/sim` importer | 21 files (§4.3) |
| Mobile typecheck, lint and jest exit 0 | typecheck 0, lint 0 (0 warnings), jest 33 suites / 437 tests (04:46 WIB, §4.1) |

The step-68 contract stub is gone: `RUNTIME_IMPLEMENTATION = 'simulator'` (`src/runtime/contract.ts:20`).

What the app now runs:
- **Simulator.** The shared simulator (`@dems/shared/sim`, D19) runs behind mobile adapters: AsyncStorage snapshots, AppState visibility, a memory-only operator record and a hydration gate.
- **Auth.** Sign-in, lockout and audit go through the simulator's `auth.ts`, with biometric sign-in and the 15-minute idle lock on top.
- **Session features.** The Core link (Simulated by default, heartbeat as the alternative), the connection banner, state-routed resync, keep-awake and the 20 Hz shared-value meter path.
- **i18n.** The shared `@dems/shared/i18n` resources sit under the mobile ones.

**An incident, now fixed:** between about 03:50 and 04:18 WIB any device session that loaded the working tree showed a Render Error in `AuthProvider`. Jest did not show it. See F-73-1: lanes that ran device checks in that window should re-run them.

## 1. Files

All paths are under `apps/mobile/`. Only P6 paths of step 73 were written.

| File | Change | Role |
|---|---|---|
| `src/runtime/contract.ts` | new (moved out of the step-68 `index.ts`) | Contract types, `RuntimeContractProvider`, `createRuntimeContract`, hooks, `initialsFor`, `RUNTIME_IMPLEMENTATION = 'simulator'` |
| `src/runtime/index.ts` | **rewritten** (owner 68 → 73) | Barrel; every step-68 name and type is kept |
| `src/runtime/sim-adapters.ts` | new | `createAsyncStoragePersistStorage`, `createAppStateVisibility`, `isHiddenAppState`, `createMobileSim` (§5.2) |
| `src/runtime/sim-runtime-provider.tsx` | new | `SimRuntimeProvider`: shared `SimProvider`, hydration gate, session summary, Core link, heartbeat → tablet link, banner state, runtime keep-awake holder, debug hooks, simulator errors → log |
| `src/runtime/use-audio-shared-values.ts` | new | `useAudioSharedValues(channel)`, the §5.4 transient path with `reportMeterFrame`; `useAudioAccessibilityValue` at 1 Hz |
| `src/runtime/core-link.ts` | new | `coreLinkStateFor`, `tabletLinkForHeartbeat`, and the `coreLinkSource` preference (merge-write, D57) with `useCoreLinkSourceSetting` |
| `src/runtime/connection-banner.ts` | new | Banner logic: `nextBannerKind`, `bannerKindAfterResync`, `useConnectionBanner`, `RESYNCED_BANNER_MS` 3,000 |
| `src/runtime/route-sync.ts` | new | `resyncTarget` (delegates to step 70's `sessionResyncHref`), `isForcedTransition`, `resyncNavigation` |
| `src/runtime/session-route-sync.tsx` | new | `SessionRouteSync` (§3.7 triggers 2 and 3) |
| `src/runtime/keep-awake.ts` | new | `KeepAwakeController`, `createKeepAwakeManager` (union of holders), tag `dems-session` |
| `src/runtime/resync-bus.ts`, `internals.ts` | new | The heartbeat resync signal; the simulator and bus for runtime components |
| `src/runtime/log.ts` | new | Persistent, privacy-filtered runtime log `dems.mobile.log.v1`; `installRuntimeLogSinks` (motion, navigation) |
| `src/runtime/debug.ts` | new | Debug builds only: `&scenario=` deep links and the `__DEMS_DEBUG__` handle |
| `src/runtime/testing/test-sim.tsx` | new, test-only | `createTestSim`, `renderWithRuntime`, `RuntimeTestProviders`, `FakeHeartbeatSocket`, `flushAsync` |
| `src/auth/auth-provider.tsx` | new | `AuthProvider` (§3.2 slot 10), `useAuthSession` |
| `src/auth/biometric.ts` | new | The §6.3 service: `getBiometricAvailability`, `promptOutcomeFor`, `biometricPromptOptions`, `applyBiometricOutcome`, `biometricSignIn` |
| `src/auth/auth-prefs.ts` | new | `dems.mobile.auth.v1` `{ lastOperatorId, biometricEnabled }`, read once per process |
| `src/auth/auth-dialogs.tsx`, `operators.ts`, `index.ts` | new | Idle-lock and biometric-offer dialogs; operator mapping; barrel |
| `src/providers/app-providers.tsx` | **edited** (owner 68 → 73) | Slot 9 is the real `SimRuntimeProvider`; slot 10 `AuthProvider`; resync bus; log sinks; optional `sim` / `simOptions` props |
| `src/i18n/index.ts` | **edited** (owner 68 → 73) | Shared `en` is the first layer (`EN_RESOURCE_LAYERS`) |
| `src/i18n/en.mobile.ts` | edited | Adds `mobile.idleLock.{title, recording, confirm}` |
| `src/i18n/i18n.test.ts` | edited (`src/i18n/**` is a step-73 path) | Three disjoint layers, shared keys resolve, the merge is a copy |
| `src/providers/runtime-contract.test.tsx` | **rewritten in place** (a step-68 test of the step-73 file; S73-17) | Stub cases replaced by simulator-runtime cases; same describe blocks |
| Tests, new | | `src/runtime/{sim-adapters,route-sync}.test.ts`, `src/runtime/{runtime,session-route-sync,use-audio-shared-values}.test.tsx`, `src/runtime/log.test.ts`, `src/auth/biometric.test.ts`, `src/auth/auth-provider.test.tsx` |

**Not written:**
- `packages/shared/**` (no SIM-GAP was needed, §6.3), `src/app/**`, `src/navigation/**`, `src/features/**`;
- `jest.config.js`, `jest.setup.ts`, `app.json`, and every `package.json` and lockfile.

No `npm install` ran and nothing was committed. `git status --short packages/shared` lists only files of earlier steps.

## 2. Runtime contract as implemented

Screens keep using `@/runtime` hooks. The contract gained only optional members, so step 70's `FakeRuntime` harness is unchanged:
- `AuthOperator.username`;
- `ActiveSessionInfo.summaryAcknowledged` (step 70's boot router already reads it);
- `CoreLinkInfo.heartbeat`;
- `RuntimeStatus.restored`.

| Contract part | Source |
|---|---|
| `status.ready` | Simulator snapshot hydrated **and** the Core-link preference read (one combined gate). `BootGate` (step 68) holds the splash on it with no `_layout.tsx` edit |
| `session` | `selectActiveSessionInfo`: state, id, `startedAt`, `summaryAcknowledged` (from `selectPendingSummaryId`) |
| `coreLink` | SIMULATED: the simulator's `tabletLink`. HEARTBEAT: LIVE → ONLINE, else OFFLINE, plus `heartbeat` detail |
| `auth` | `AuthProvider`. Outside it: `UNAVAILABLE_AUTH` |

`useAuth().signIn(u, p)` results:
- `{ok:true, operator}` with id `OPR-00n`;
- `INVALID_CREDENTIALS` with `attemptsRemaining`;
- `LOCKED` with `lockedUntilMs`;
- `CORE_OFFLINE` in heartbeat mode while offline, **before** the simulator, so no audit row is written;
- `UNAVAILABLE`.

Hand-over surface for the screen steps (75–89):

| Need | Use |
|---|---|
| Any simulator data or action | `useSim(select…)` and `useSimActions()` from `@dems/shared/sim` (the `SimProvider` is in the tree) |
| Meters (step 79) | `const v = useAudioSharedValues('AUDIO-01')` → `<DbfsMeter level={v.level} peak={v.peak} clip={v.clip} …/>`; `accessibilityValue={useAudioAccessibilityValue('AUDIO-01')}` |
| Login (step 75) | `useAuth().signIn`<br>`useAuthSession()`:<br>- `.lockout` (`locked`, `retryInSeconds`, `attemptsRemaining`)<br>- `.lastSignOut` ('USER' / 'IDLE' / 'LOCK' → the matching Alert)<br>- `.biometric` (`availability`: call `refreshBiometricAvailability()` on mount; `enabled`; `lastOperator`)<br>- `.signInWithBiometric()` → `BiometricSignInResult` (`signed-in`, `cancelled`, `lockout`, `not-enrolled`, `failed`, `locked`, `unavailable`, `core-offline`, `error`)<br>`useCoreLink()` for L2, L6 and L11 |
| Settings (step 88) | `useCoreLinkSourceSetting()` (`source`, `setSource`, `error`); `useAuthSession().setBiometricEnabled(bool)` |
| Avatar menu | `useAuthSession().lockConsole()`; `useAuth().signOut('USER')` |
| Connection banner (step 79, shell) | `useConnectionBanner()` → `{ kind: 'hidden' \| 'offline' \| 'resynced', messageKey }` |
| Global dialogs | The idle-lock "Session expired" and the biometric enable offer are rendered by `AuthProvider`. Screens do nothing |
| Screen tests | `renderWithRuntime(ui, { sim: createTestSim().sim })` from `@/runtime/testing/test-sim`. The injected simulator is hydrated, so no `act()` warning |
| Screenshot ACs | `demsdemo:///<route>?scenario=recording\|finalizing\|fault-demo\|idle` (debug builds) |

## 3. Behaviour notes (04_mobile_specs mapping)

| Spec | Implemented as |
|---|---|
| §5.2 storage | `createJSONStorage(() => AsyncStorage)` on `dems.sim.v1`, throttled to 1 s by the engine. The audio, clock and auth slices are never stored |
| §5.2 visibility | `AppState` `background` / `inactive` → hidden (pause and flush). `active` → one catch-up tick, then resume |
| §5.2 hydration gate | The engine's own (`start()` waits for `ready`), plus the UI gate `status.ready` |
| §5.2 auth record | `authStorage: null` (memory), so the operator signs in again after a cold start (§6.4) |
| §5.4 meters | Each 20 Hz frame assigns four shared values and calls `reportMeterFrame`. Zero React renders per frame (tested) |
| §5.5 heartbeat | `onResync` → health invalidation (step 68) + the resync bus → `SessionRouteSync` + banner "Resynced". In heartbeat mode the tablet link follows the heartbeat, so the precheck CORE check blocks |
| §3.7 resync | Trigger 1 (after sign-in) = step 70's boot router. Trigger 2 (heartbeat) and trigger 3 (STOPPING → FINALIZING, FINALIZING → SEALED, any → FAULT) = `SessionRouteSync`. It never navigates on mount or for a plain state change |
| §6.1 lockout | The simulator: 5 failures in 5 min → 60 s on the simulator clock; AUTH_FAILED / AUTH_LOCKED / AUTH_SUCCESS rows |
| §6.3 biometric | Hardware → enrolment → prompt with the §6.3 options. The OS result is mapped per the §6.3 table; `authentication_failed` counts toward the lockout. The offer comes after a password sign-in (available device, not already bound to that operator) |
| §6.4, §4.19 idle lock | A bubbling `onTouchStart` on one wrapping view → `touch()`, throttled to 5 s. The simulator expires after 15 min (AUTH_EXPIRED) → `lastSignOut = 'IDLE'` + the "Session expired" dialog. Recording is untouched |
| §6.6 keep-awake | Tag `dems-session` while PRECHECK, ARMED, RECORDING, STOPPING or FINALIZING. It is held by the runtime (always mounted) and by the `(app)` controller (union), so a sign-out during a session keeps the screen on |
| §9 i18n | `[shared en, mobile.*, features.*]`, disjoint top-level keys, no override (tested) |

## 4. Verification (JS)

### 4.1 Gates

All commands run from the workspace root, jest with `--maxWorkers=2` (P9).

| Check | Command | Result |
|---|---|---|
| Baseline before edits | `npm run typecheck -w @dems/mobile` | exit 0 (03:45) |
| Typecheck | `npm run typecheck -w @dems/mobile` | **exit 0** (04:46) |
| Lint | `npm run lint -w @dems/mobile` | **exit 0**, 0 warnings (04:46) |
| Jest, full | `cd apps/mobile && npx jest --maxWorkers=2` | **exit 0**: `Test Suites: 33 passed, 33 total`, `Tests: 437 passed, 437 total` (04:46:53). This includes the concurrent steps' suites |

### 4.2 Row tests and mutation checks

Mutants were swapped in through a jest `moduleNameMapper` from a temporary `src/runtime/__mutants__/`, so no live source changed while another lane's Metro was bundling. The folder was then removed.

| Test | File | Tests | What it proves | Mutant → result |
|---|---|---|---|---|
| **T-M05** | `src/auth/biometric.test.ts` | 21 | success (AUTH_SUCCESS, method BIOMETRIC, exact §6.3 options); `user_cancel` (no audit); `lockout`; `not_enrolled` (up front and from the prompt), `passcode_not_set`; `authentication_failed` (AUTH_FAILED, 4 left, the 5th locks, AUTH_LOCKED while locked); no hardware; thrown errors; the full result table | `authentication_failed → cancel`: **2 failed** |
| **T-M06** | `src/runtime/route-sync.test.ts` | 29 | The §3.7 table row by row (11 rows); forced transitions (14 cases); `resyncNavigation`; the table on the real simulator: recording → stop → finalizing → sealed summary → acknowledged; POWER_FAIL → recovery → none | forced-FAULT rule removed: **3 failed** |
| **T-M07** | `src/runtime/sim-adapters.test.ts` | 10 | AsyncStorage round trip and relaunch resume (same id and `startedAt`; timer = clock − start; no second session; no audio, clock, auth or `dems.auth`); throttled writes; no tick before hydration (a saved session survives, writes dropped before ready); AppState mapping; background pause + flush, foreground catch-up | `isHiddenAppState → false`: **4 failed** |
| — | `src/runtime/runtime.test.tsx` | 17 | Hydration gate on a deferred AsyncStorage; SIMULATED link and banner; **MA-10 unit form** (heartbeat LIVE → drop → offline banner, tablet OFFLINE, audit TABLET_LINK_CHANGED, precheck CORE BLOCK → reconnect → Resynced → hidden; back to SIMULATED); D57 prefs merge; keep-awake mapping, union and sign-out survival (**MA-19 unit form**); `scenarioFromUrl`; launch-URL scenario + debug handle + SHA-256("abc") vector | — |
| — | `src/runtime/session-route-sync.test.tsx` | 7 | No navigation on mount or for RECORDING; STOPPING → FINALIZING → SEALED routes; FAULT → recovery; already-on-target; heartbeat resync; real simulator FINALIZING → SEALED → summary | — |
| — | `src/runtime/use-audio-shared-values.test.tsx` | 3 | 40 frames → **zero** extra renders (MA-16 path); values equal the store frame; clip latch; meter frame counting ≥ 19 fps; a11y value clamped, at most once per second | — |
| — | `src/runtime/log.test.ts` | 7 | Record fields; the privacy filter (password, username, code, token, secret, pin dropped); debounced writes; capacity; load once; failing storage; motion, navigation and simulator sinks | — |
| — | `src/auth/auth-provider.test.tsx` | 7 | 5 failures → LOCKED with a live countdown; the password appears in no state, audit, log or storage; CORE_OFFLINE gate; Lock console (LOCK row, recording kept); idle expiry → dialog + `lastSignOut` IDLE; touch keeps the sign-in; biometric offer → Enable → prefs → fingerprint sign-in; Not now | — |
| — | `src/providers/runtime-contract.test.tsx` | 12 | The contract with the simulator runtime; fake injection unchanged | — |
| — | `src/i18n/i18n.test.ts` | 9 | Layering, shared keys, copy semantics | — |

Unmutated, T-M05/06/07 pass: `Tests: 60 passed, 60 total`.

### 4.3 Static checks

| AC | Command | Result |
|---|---|---|
| **MA-28** | `grep -rln "@dems/shared/sim" apps/mobile/src` | **21 importers**, including `runtime/sim-adapters.ts`, `runtime/sim-runtime-provider.tsx`, `runtime/use-audio-shared-values.ts`, `auth/auth-provider.tsx`, `auth/biometric.ts`, `auth/operators.ts`. Nothing written under `packages/shared/src/sim` |
| MA-16 | `grep -rn "useAudioChannel" apps/mobile/src \| grep -v runtime/` | no match (exit 1) |
| MA-22 | `grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?"` over `src/{runtime,auth,i18n}` and `app-providers.tsx` | no match (exit 1) |
| MA-25 | `grep -rnE "https?://" src/{runtime,auth,providers,i18n} \| grep -vE "127\.0\.0\.1\|localhost\|CORE_(HTTP_ORIGIN\|WS_URL)"` | no match (exit 1) |
| Stub gone (for steps 62, 63, 74) | `grep -rn "RUNTIME_IMPLEMENTATION: RuntimeImplementation" src/runtime` | `contract.ts:20: … = 'simulator';` |
| No credential literals in app code | `grep -rnE "demo-2026\|DEMO_OPERATOR_PASSWORD" src/{runtime,auth,providers}` excluding tests | no match |

## 5. Verification on the devices

**Setup:**
- Every session ran through `METRO_PORT=8082 apps/mobile/scripts/device-session.sh <avd> '…'` (lane B, P4), outside the sandbox (P10).
- The helper force-stopped the app first (D55), set the bundler location and removed its reverse rules on exit.
- Values were read through the Hermes inspector: Metro `/json/list` → `Runtime.evaluate` on the dev-only `__DEMS_DEBUG__` handle.
- Sign-in used step 70's dev-only Login placeholder button (`stub-sign-in`), which calls `useAuth().signIn` with the first demo operator. It now signs in through the simulator auth.

**Build and platform:**
- Build: `Android Bundled 924ms node_modules/expo-router/entry.js (5341 modules)`.
- Both AVDs run Android 16 (API 36) on Hermes.

### 5.1 D54 (d): `@noble/hashes/sha2.js` under Metro and Hermes

| Evidence | dems_phone | dems_tablet |
|---|---|---|
| Modules in the device bundle (`__r.getModules()` verbose names) | `@noble/hashes/sha2.js`, `_md.js`, `_u64.js`, `utils.js` | same |
| `sha256Hex("abc")` on Hermes | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` (the FIPS 180-2 vector) | same |
| `verifyAuditChain()` over the device-built chain | `{ ok: true, checked: 219 }` | `{ ok: true, checked: 220 }` |

**D54 (d) is proven:** the simulator's SHA-256 path loads and computes correctly on Hermes, and H-31-1 is confirmed.

### 5.2 MA-08: relaunch resume

**Procedure:**
1. `am start -W … -d "demsdemo:///session/live?scenario=recording"`: the scenario loads after hydration.
2. Sign in (the placeholder button).
3. Note the timer.
4. `am force-stop`, wait 20 s, relaunch from the launcher (no URL).
5. Sign in.

| | dems_phone (04:22–04:23) | dems_tablet (04:36–04:37) |
|---|---|---|
| After the first sign-in | `screen-session-live` (resync precedence over the pending href) | `screen-session-live` |
| Relaunch, before sign-in | `screen-login`; runtime `ready: true, restored: true`; session `SES-20261001-0024` RECORDING; `auth: SIGNED_OUT` (memory-only operator record) | same |
| **After sign-in, no extra taps** | **`screen-session-live`** | **`screen-session-live`** |
| Timer (ms) before → after | 1,140,132 → 1,181,338: grew **41,206**; wall clock **41,206**; diff **0 ms** | 1,140,845 → 1,185,484: grew **44,639**; wall **44,634**; diff **5 ms** |
| Second session? | No: history 13 → 13; `counters.session` 25 → 25; same id and `startedAt` | No: 13 → 13; 25 → 25 |
| Verdict | **PASS** (±2 s) | **PASS** |

Screencaps:
- [73_dems_phone_ma08_relaunch_login.png](assets/mobile/73_dems_phone_ma08_relaunch_login.png)
- [73_dems_phone_ma08_relaunch_live.png](assets/mobile/73_dems_phone_ma08_relaunch_live.png)
- [73_dems_tablet_ma08_relaunch_login.png](assets/mobile/73_dems_tablet_ma08_relaunch_login.png)
- [73_dems_tablet_ma08_relaunch_live.png](assets/mobile/73_dems_tablet_ma08_relaunch_live.png)

The screens are step 70's placeholders; the pass condition is the route.

**Route sync on the device (§3.7 trigger 3):**
- After `stopRecording(…)` the app moved by itself to `screen-session-finalizing`, then to `screen-session-summary` for `SES-20261001-0024` once SEALED, on both AVDs.
- Screencaps: [73_dems_phone_finalizing.png](assets/mobile/73_dems_phone_finalizing.png), [73_dems_phone_summary_after_seal.png](assets/mobile/73_dems_phone_summary_after_seal.png), and the tablet equivalents.
- The runtime log recorded `info runtime.routeSync.transition Resynced route to the session state`.
- `logcat -b crash` has 0 lines for the app.

### 5.3 MA-19: keep-awake

**First measurement:** the spec's `dumpsys window | grep -c KEEP_SCREEN_ON` gave 1 while RECORDING **and** 1 when idle, even signed out before any session. The flag sat on `Window{… com.dems.demo.tablet/…MainActivity}`.

**Cause (F-73-2):** in development builds Expo's `registerRootComponent` wraps the app in `withDevTools`, which calls `useKeepAwake(ExpoKeepAwakeTag)`. Source: `node_modules/expo/src/launch/withDevTools.tsx:13-20` and `registerRootComponent.tsx:43-45`, `if (process.env.NODE_ENV !== 'production')`. A debug build therefore always keeps the screen on, and MA-19's "0 when idle" is unobservable as written.

**Isolation:** the dev-only tag was released once through the inspector (`deactivateKeepAwake('ExpoKeepAwakeDefaultTag')` on the loaded `expo-keep-awake` module). The app's own tag was then measured.

| State | dems_phone (04:31) | dems_tablet (04:44) |
|---|---|---|
| Idle, no session | **0** | **0** |
| RECORDING (`fl=KEEP_SCREEN_ON …`) | **1** | **1** |
| STOPPING | 1 | 1 |
| SEALED | **0** | **0** |
| Runtime log | `Screen kept on for the session` 21:31:28Z → `Screen keep-on released` 21:31:38Z | 21:44:42Z → 21:44:53Z |
| Verdict | **PASS** | **PASS** |

Screencaps: [73_dems_phone_ma19_recording.png](assets/mobile/73_dems_phone_ma19_recording.png), [73_dems_phone_ma19_sealed.png](assets/mobile/73_dems_phone_ma19_sealed.png), and the tablet pair.

A first tablet attempt at 04:37–04:41 is **invalid and not counted**. My own cleanup had stopped the engine in the same process, and the launcher intent reused that process, so the session stayed in STOPPING. The rerun in a fresh session is the row above.

### 5.4 MA-10 runtime part (dems_phone, 04:24; P5)

**mock-core lifecycle (P5):**
- Started under `.locks/mock-core.lock` (PID 27069; user entry `step-73`).
- Killed only after the sole-user check (`users: [step-73]`).
- Restarted (PID 27369).
- Released as the last user.

| Step | Result |
|---|---|
| Source → HEARTBEAT (debug handle; the Settings control is step 88's) | LIVE after the first reconnect: `link HEARTBEAT/ONLINE/LIVE`, tablet CONNECTED |
| `kill -TERM 27069` at 04:24:13 (sole user) | **167 ms** later: `link HEARTBEAT/OFFLINE/OFFLINE`, banner **offline**, tablet **OFFLINE** (≤ 5 s ✔) |
| Start Session step 2 in that state (`createSession` + `beginPrecheck`) | Precheck `outcome: BLOCK`; CORE `{ status: BLOCK, value: OFFLINE, reason: "Core link offline" }` ✔. Then `cancel()` |
| Restart mock-core | **489 ms** later: `link HEARTBEAT/ONLINE/LIVE`, banner **resynced**, tablet **CONNECTED** ✔ |
| Audit | `Tablet control offline — recording continues`, then `Tablet control connected` |
| Back to SIMULATED | `link SIMULATED/ONLINE`, banner hidden, tablet CONNECTED |

Screencaps (the placeholder screen; banner and chip UI belong to steps 79 and 75): `73_dems_phone_ma10_{heartbeat_live,offline,resynced}.png`.

The UI half of MA-10 (the "Offline" banner and chip) is left to the screen steps, which render `useConnectionBanner()` and `useCoreLink()`.

### 5.5 Device state left behind

- **Simulator snapshot:** every session ended with `sim.stop()` + `store.persist.clearStorage()`, so no `dems.sim.v1` snapshot of these checks is left for later lanes. The next launch starts the canonical dataset.
- **Core-link preference:** set back to SIMULATED (`{"coreLinkSource":"SIMULATED"}`, merged).
- **Other keys:** `dems.mobile.auth.v1` was never written (the emulators have no enrolled fingerprint, so there was no offer). `dems.mobile.log.v1` keeps the runtime log.

## 6. Decisions, drift, findings

### 6.1 Decisions

| # | Type | Decision | Why |
|---|---|---|---|
| S73-1 | structure | The contract moved to `runtime/contract.ts`; `index.ts` is the barrel; only optional members were added | Internal modules import the contract without a cycle through the barrel; step 70's fakes still type-check |
| S73-2 | interpretation | `AuthProvider` (slot 10) re-provides the contract with the simulator auth; `SimRuntimeProvider` alone gives `UNAVAILABLE_AUTH` | §3.2 layering ("thin adapter over the simulator's `auth.ts`"); `RuntimeContractProvider` fakes keep working |
| S73-3 | reuse | `resyncTarget` delegates to step 70's `sessionResyncHref`: one copy of the §3.7 table | Step 70 asked for it (`session-routes.ts` header); T-M06 tests the table through `resyncTarget` |
| S73-4 | interpretation | `SessionRouteSync` owns triggers 2 and 3; trigger 1 (after sign-in) is the boot router's | Navigating on mount too would navigate twice |
| S73-5 | addition | A second keep-awake holder is always mounted in the runtime; the manager holds the tag while any holder wants it | §6.6: "released on sign-out only if no session is active". `(app)` unmounts on sign-out |
| S73-6 | interpretation | Hidden = AppState `background` or `inactive`; `unknown` counts as visible | The spec sketch says `!== 'active'`; a start-up `unknown` must not stall the engine. The next `change` event corrects either way (tested) |
| S73-7 | interpretation | Heartbeat → tablet link: LIVE → CONNECTED; STALE / OFFLINE → OFFLINE; CONNECTING leaves it; leaving heartbeat mode → CONNECTED. The banner ignores CONNECTING | Every tablet-link change is an audit row; no flicker between reconnect attempts |
| S73-8 | interpretation | `CORE_OFFLINE` is refused before the simulator (no audit row) | §4.1 L6: Sign In is disabled while the Core is OFFLINE in heartbeat mode |
| S73-9 | **drift (additive)** | New AsyncStorage key `dems.mobile.log.v1`: the persistent runtime log (ring of 200, debounced, privacy-filtered). It also receives the motion (D57) and navigation (step 70) records | The agent's persistent error-logging rule; there is no client log endpoint (D41(g)). The key is not in the §5.3 list, so **step 63 should review it**. It holds no credentials or personal data (tested) |
| S73-10 | addition | Debug builds only: `&scenario=` deep links (§3.5) and `globalThis.__DEMS_DEBUG__ = { sim, sha256Hex, log, runtime(), setCoreLinkSource() }` | Screenshot ACs; device evidence before the Login, Monitor and Settings screens exist. `__DEV__`-gated. **Step 63 should note it** |
| S73-11 | workaround | The runtime imports `expo-router/build/hooks`, not the `expo-router` entry | The entry loads ESM-only `standard-navigation`, which the step-67 jest transform allowlist does not cover. Every suite rendering `AppProviders` would fail; only step 70's harness mocks it. Same module instance (`build/exports.js` re-exports `./hooks`). See F-73-3 |
| S73-12 | decision | The hydration gate combines the simulator snapshot and the Core-link preference into one update; the preference stores re-render only on value change; the biometric availability is queried lazily; dialogs mount only while open | Each `AppProviders` mount costs at most 1 async React update (0 with an injected hydrated simulator). This cuts `act()` noise in other steps' suites, and no hidden kit `Dialog` overlay is mounted |
| S73-13 | fix | zustand stores used as hooks are named `use…` (`useAuthPrefsStore`, `useCoreLinkPrefsStore`) | F-73-1 |
| S73-14 | decision | The idle-lock dialog and the biometric enable offer are global (rendered by `AuthProvider`); `lastSignOut` feeds the Login Alert | The expiry and the post-sign-in navigation unmount the screen that would host them |
| S73-15 | decision | The biometric offer appears after a password sign-in when the device is available and biometrics are not already bound to that operator | §6.3 step 1 |
| S73-16 | decision | `initialPairing` stays PAIRED (the shared default) | The mockup trust line reads "paired (simulated)" (§4.1 L11); step 76 exercises `unpair` / `pair` |
| S73-17 | **drift (test file of step 68)** | `src/providers/runtime-contract.test.tsx` rewritten in place: the stub cases now test the simulator runtime; the describe blocks and the fake-injection case are kept | It pinned exactly the stub that step 73 is told to replace (the step-68 handover). Precedent S32-D1. Nothing was deleted |
| S73-18 | interpretation | An explicit `signOut('IDLE')` is recorded as reason IDLE but signs out in the simulator as USER | The simulator has only USER and LOCK; the real idle expiry is the engine's (AUTH_EXPIRED) |

### 6.2 Findings and hand-overs

| # | For | Item |
|---|---|---|
| **F-73-1** | controller; **every lane that ran a device session between ≈03:50 and 04:18 WIB** (logcat on emulator-5554 shows the same Render Error at 04:13:17, PID 11412, in another lane's session) | **The device (Metro) build runs the React Compiler** (`app.json` `experiments.reactCompiler: true` → `transform.reactCompiler=true`); **jest does not.** The compiler treats a call to a function not named `use…` as pure and may memoize and skip it. Calling a zustand store hook as `fooStore(selector)` therefore changes the hook order on the next render: "Cannot read property 'length' of undefined" (`areHookInputsEqual`), "change in the order of Hooks called by AuthProvider". Fixed at 04:18 (S73-13). All tests passed before and after, so **jest cannot catch this class of bug**. Step 70's `useRailPrefsStore` already follows the rule. **Suggestion:** for steps 74 and 65, a lint rule or review item "store hooks are named use…"; for the jest config owner, compiler parity in jest |
| **F-73-2** | steps 59 and 61 (MA-19 on a device), step 60 (README), step 74 | In a debug build Expo keeps the screen on for development (`withDevTools` → `useKeepAwake(ExpoKeepAwakeTag)`), so MA-19's "0 when idle" never holds as written. Its fallback (screen timeout / `mWakefulness`) is also masked. **Procedure used here:** release `ExpoKeepAwakeDefaultTag` once through the Hermes inspector, then measure. Alternatively measure a release build |
| F-73-3 | jest config owner (step 67's `jest.config.js`) | Adding `standard-navigation` to the `transformIgnorePatterns` allowlist would let any suite import the `expo-router` entry without step 70's mock. Then S73-11 could return to `import … from 'expo-router'` |
| F-73-4 | screen steps 75–89 | Render under `renderWithRuntime(ui, { sim: createTestSim().sim })` (no `act()` warning). The plain `AppProviders` in a test costs 1 async update (the hydration gate); `await flushAsync()` settles it. The step-68 `app-providers.test.tsx` shows 5 such warnings (its tests do not await hydration); they are harmless |
| F-73-5 | steps 74 and 75 | S68-9 is still open: the kit's `SubjectTypeChip` uses a local `'Tersangka' \| 'Saksi' \| 'Lainnya'` union, while the simulator uses `TERSANGKA \| SAKSI \| LAINNYA` and shared i18n has `common.subjectType.*`. Not a step-73 path |
| F-73-6 | step 63 | Review S73-9 (`dems.mobile.log.v1`) and S73-10 (the `__DEMS_DEBUG__` handle; `__DEV__` only). `dems.mobile.auth.v1` holds only `{ lastOperatorId: "OPR-00n", biometricEnabled }`. `dems.auth` is never written on mobile |
| F-73-7 | step 75 | The Login placeholder's `StubSignIn` (step 70) now signs in through the simulator (the first demo operator, demo password). It renders only while `__DEV__`; step 75 replaces the placeholder |

### 6.3 SIM-GAPs and P12

- **SIM-GAP: none.** Every need was met by the step-31/32 contract:
  - `createSim` adapters;
  - `signIn`, `signInWithBiometric`, `recordBiometricFailure`, `signOut`, `touch`;
  - `selectLockout`, `selectPendingSummaryId`, `acknowledgeSummary`;
  - `setTabletLink` with the CORE precheck BLOCK;
  - `loadScenario`, `useAudioChannel`, `sessionHistory`;
  - relaunch resume.
- `packages/shared/**` was not written.
- **P12:** no new package or native module; `expo-keep-awake`, `expo-local-authentication` and AsyncStorage were already installed (step 67).

### 6.4 P11 and concurrency notes

- **Concurrent steps.** Step 70 (`src/app/**`, `src/navigation/**`) ran at the same time. It had already adapted its Login placeholder and guard test to the simulator runtime. All its suites pass in the final run.
- **Phone lock.** My second phone session queued behind step 70's phone session (04:18:30–04:22:33) under `.locks/dems_phone.lock`, as P3 intends.
- **Bundle size.** The module count grew from 5341 to 5436 between sessions, because of concurrent steps' files.

## 7. Processes (P7)

| PID | Process | Started by | Stopped | Confirmed |
|---|---|---|---|---|
| 23725 | Metro 127.0.0.1:8082, session run 1 (phone) | device-session helper | Run 1 was stopped with TaskStop, so the helper's trap did not run | 8082 free. My leftover reverse rules (`tcp:8081 → 8082`, `tcp:4400`) were removed and the app force-stopped under `.locks/dems_phone.lock` (the lock was free) |
| 26382, 27854, 31539 (and the first MA-19 attempt's); tablet 34758, 39825 | Metro 8082 for the later phone and tablet sessions | helper | helper cleanup ("Metro … stopped", "session ended with status 0") | 8082 not listening at 04:45 |
| 27069, 27369 | mock-core (npm leader) on 127.0.0.1:4400 | `s73_mock.sh start` under `.locks/mock-core.lock` (P5) | 27069: `kill -TERM` (MA-10, sole user); 27369: released as the last user | 4400 free; `.locks/mock-core.pid` removed; `mock-core.users/` empty |
| — | `adb reverse` rules of my sessions | helper | helper cleanup, or manual as above | Tablet: none. The phone's current `tcp:8081 → tcp:8081` belongs to another lane's active session and was not touched |
| — | app `com.dems.demo.tablet` | my sessions | helper force-stop | — |

Not touched:
- the session emulators (P3);
- the adb server;
- other lanes' Metro (8081) and sessions.

Scratch helpers live in the session scratchpad (`s73_*`):
- `s73_cdp.mjs`: inspector evaluate with a loopback `Origin`;
- `s73_ui.py`: uiautomator ids and taps;
- `s73_lib.sh`, `s73_phone.sh`, `s73_ma10.sh`, `s73_ma19.sh`, `s73_keepawake_diag.sh`, `s73_cleanup.sh`;
- `s73_mock.sh`: the P5 wrapper;
- the raw outputs `s73_*_out.txt`.

## 8. Rollback

**Code:**
1. Put back the step-68 content of `src/providers/app-providers.tsx`, `src/i18n/index.ts` and `src/runtime/index.ts` (the stub). No commit holds it: these files came after the baseline 33e4c95 and are uncommitted; their step-68 shape is in 41_mobile_foundation.md §1 and §3.
2. Delete `src/auth/**` and every other `src/runtime/*` file and folder.
3. Revert `runtime-contract.test.tsx`, `i18n.test.ts` and `en.mobile.ts` (`mobile.idleLock`).

**Devices:** `adb -s <serial> shell run-as com.dems.demo.tablet` access to AsyncStorage is not needed. The keys left are `dems.mobile.log.v1` and the prefs key's `coreLinkSource: 'SIMULATED'` (the default); clearing the app data removes both.

**Screencaps:** delete `implementation/assets/mobile/73_*`.

No host, native or package change was made.

---
*Generated: 2026-10-01 04:50 WIB by coder-execution (step 73)*
