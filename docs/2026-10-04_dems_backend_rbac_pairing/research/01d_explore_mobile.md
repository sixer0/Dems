---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: explore
step: 4
scope: apps/mobile (src/runtime, src/providers, src/auth, src/app, src/navigation and the feature folders), app.json, android manifests, package.json scripts, scripts/device-session.sh, jest harnesses. Read-only.
narrative_tier: 2
sources_of_findings: Graft graph (skeleton, callers, grep, map; all with --no-refresh) plus direct Grep/Read; a throw-away scan script kept outside the repo
---

# Explore 01d: how `apps/mobile` consumes the simulator

## Overview

This report maps every place the Android app reads or writes simulator state, so the specification can say what a Live data source backed by a real server and a real pairing flow must replace. It reports what exists. It does not design the integration.

- **Scope**: the 140 files under `apps/mobile/src` that match `@dems/shared/sim`, grouped by feature folder plus `src/runtime/`, `src/providers/`, `src/auth/`, `src/app/` and `src/navigation/`; the Core link, sign-in, biometric, pairing and route-guard code; storage keys; `app.json` plugins and the cleartext policy; the `reverse` and `e2e` scripts; test harnesses; the `scripts/device-session.sh` targets.
- **Graft vs direct inspection**: Graft was used first (`graft map`, `graft skeleton` on the five feature adapters, `graft callers useSimActions`, `graft callers useSimInstance`, `graft grep` for direct store access). Everything else (imported names, per-file action calls, line numbers, manifests, scripts, storage keys) came from `Grep`, `Read` and a scan script. Each finding below names its source.
- **Read-only**: no file under `apps/`, `packages/`, `release/` or `scripts/` was changed. No Metro, emulator or `adb` process was started (short-lived read-only tools only: `graft`, `grep`, `node`, `python3`). Nothing under `apps/mobile/signing/` was opened. No password, PIN, token or pairing code value is printed here; names and `file:line` only.

## 1. Coverage proof (verification the controller applies)

Command (run at 2026-10-04, from the workspace root):

```
grep -rl "@dems/shared/sim" apps/mobile/src | sort | wc -l      -> 140
grep -rl "from '@dems/shared/sim'" apps/mobile/src | sort | wc -l -> 139
```

| Check | Result | Source |
|---|---|---|
| Files matching `@dems/shared/sim` under `apps/mobile/src` | **140** (same as blueprint time) | command above |
| Of which carry a real import statement | 139 | second command |
| Of which match only in a comment | 1: `apps/mobile/src/runtime/index.ts:4` (header comment; the file imports nothing from the simulator) | `grep -n "@dems/shared/sim" apps/mobile/src/runtime/index.ts` |
| Files per group, summed over the 21 groups of section 9 | 140 (11+1+6+2+2+10+6+10+14+2+6+3+7+5+7+13+7+5+6+8+9) | `scan.json` rendered by a script; the script throws on a duplicate file |
| A file in two groups, or in none | none (140 unique, 0 ungrouped) | same script; re-checked by section 10 |
| Production / test / harness split | 96 / 33 / 11 | file-name rules: `*.test.ts(x)` = test; a `testing/` folder = harness |
| Files that import only types from the simulator (no value) | 29 (25 production, 4 test) | scan: files with zero value imports |
| Folders under `src/` with zero matches | `app/`, `layout/`, `lib/`, `motion/`, `i18n/` and the feature folder `home/` | folder listing against the grep list |

The `src/app/` group is empty by design: route files only compose feature screens and the navigator (section 6). The `home` feature (the `/stack-check` and `/` screen) uses the real heartbeat and health calls rather than the simulator (finding F-M15).

## 2. Findings (Tier 2: found, why it matters, how verified, source)

| ID | What was found | Why it matters for this task | How verified | Source |
|---|---|---|---|---|
| F-M1 | The app reaches the simulator through four channels only: `useSim(selector)` (128 call expressions in 31 production files), `useSimActions()` (13 files, 15 callers), `useSimInstance()` (17 files, 18 callers; gives the raw `Sim` handle) and `useAudioChannel` (2 files, through `useAudioSharedValues` and `use-devices-data.ts`). Five sheet frames re-provide the `Sim` to portalled content with `SimContext.Provider` | A Live source has to satisfy the whole `Sim` object (`store`, `actions`, `clock`, `ready`, `isReady`, `wasRestored`, `start`, `stop`), not only the two hooks. In production code the raw handle is used for `store.getState()` (15 sites in 10 files), `store.subscribe` (2, both in `use-pairing-flow.ts`), `clock.now()` (5) and `ready` / `isReady` / `wasRestored` (7) | Graft callers counts match the grep counts; scan counts `useSim(` on comment-stripped code | `packages/shared/src/sim/react.ts:67,72,60`; `apps/mobile/src/runtime/sim-runtime-provider.tsx:84-107`; section 3.3 |
| F-M2 | 33 of the 42 `SimActions` members are called by production code. Nine are never called anywhere in `apps/mobile/src`, tests included: `signInWithSecurityKey`, `scanCaseNumber`, `addNote`, `exportAudit`, `exportLogs`, `resetDemo`, `restartServices`, `setPresentationMode`, `updateSettings` | The mobile surface of the server specification is 33 actions, not 42. Mobile builds its own case number (`nextCaseNumber`) instead of `scanCaseNumber`, and resets the demo with `loadScenario(IDLE)` instead of `resetDemo` | scan of action names on comment- and string-stripped code, then a zero-hit grep for each of the nine | section 3.1; `packages/shared/src/sim/types.ts:985-1094` |
| F-M3 | Nine call expressions in six files consume an action's **synchronous return value**: `signIn`, `signInWithBiometric`, `recordBiometricFailure`, `createSession` (two lines), `exportEvidence` (two lines), `verifyAuditChain`, `pair` | These are the call sites that must change when a Live action crosses a network (ADQ-3). `AuthContract.signIn` is already `Promise`, so auth is the cheapest; `createSession`, `exportEvidence`, `verifyAuditChain` and `pair` are not | grep for each value-returning action, then Read of each site | section 3.2 table S1 |
| F-M4 | Eight wrapper functions turn a synchronous success or throw into a **boolean** that callers branch on at once (navigate, toast, close a dialog): `useMonitorActions.run`, `useFlowActions.guarded`, `useRecoveryActions.start`, `useAcknowledgeSummary`, `usePairingFlow.unpair`, `useApplyStoragePolicy`, `useSimCommand`, `KnownDeviceDetail.startDiagnostics` | The boolean is the only success signal. Making the action asynchronous changes eight signatures and every consumer in table S2 | Read of each wrapper and each consumer | section 3.2 table S2 |
| F-M5 | Two dialogs take a callback typed `=> void` that "throws on refusal" and show the **success toast right after the call** inside a synchronous `try`: `ArchiveDialog.archive` and `DeviceCommandDialog.onConfirm` | With an asynchronous action the `catch` is unreachable and the success toast shows before the server answers | Read | `features/evidence/archive-dialog.tsx:18-19,26-39`; `features/devices/device-command-dialog.tsx:22-23,31-45`; callers in table S3 |
| F-M6 | The start-recording hand-off depends on synchronous order **by design**: `startRecording()` and the stack navigation to `/session/live` are dispatched in the same render, because that route admits only `RECORDING` and redirects to `/home` otherwise. `createAndCheck` also calls `beginPrecheck()` straight after `createSession()` returns ok | The most delicate synchronous coupling in the app. A Live implementation must complete the state change (and expose it through the runtime contract's `session.state`) before the navigation, or the guard redirects | Read of the comment block and of `session-guards.ts` | `features/session-new/session-new-screen.tsx:179-193`; `features/session-new/use-session-new.ts:174-190`; `navigation/session-guards.ts:40-44` |
| F-M7 | Nine sites read the store right after a write, or just before one, without a return value: `auth-provider.tsx:224`, `session-live-screen.tsx:158-163`, `chain-strip.tsx:108`, `use-summary.ts:130`, `sessions-screen.tsx:136`, `session-new-screen.tsx:203`, `sim-runtime-provider.tsx:199`, `use-recovery.ts:251`, `use-audio-shared-values.ts:94` | Read-after-write consistency is assumed. With a server the store updates after a round trip or a pushed event | grep `sim.store.getState`, Read | table S4 |
| F-M8 | The pairing flow is a **simulator-clock timeline**: the code is committed to `pair(code)` when `s.clock.now - startedAt >= PAIR_TIMELINE.commitAt` (1,800 ms) through `sim.store.subscribe`, and the hand-off fires at `pairedAt + 2,400 ms` the same way, both inside `queueMicrotask` | A real pairing is a server round trip with server time (Q15), not a store subscription on `clock.now`. The three-step stepper (Discover, Verify, Commit) is visual pacing, not network state | Read | `features/pairing/pairing-model.ts:23`; `features/pairing/use-pairing-flow.ts:89-143` |
| F-M9 | Failure branches use simulator classes and codes: `instanceof SimTransitionError` (3 sites), `instanceof SimPermissionError` (1 site plus 2 throws), result unions with `reason` strings, several mapped to i18n keys (`NOT_SIGNED_IN`, `NOT_PERMITTED`, `INVALID_CREDENTIALS`, `LOCKED`, `INVALID_CODE`, `SESSION_ACTIVE`, `INVALID_INPUT`, `FORBIDDEN`, `INVALID_REASON`, `NOT_SEALED`, `SECURITY_FAULT`, `NOT_FOUND`) | A Live source must surface server errors as these classes and codes, or the three `catch` branches and the i18n maps change | grep `instanceof Sim`, Read of the result types | `features/session-live/use-monitor.ts:143`; `features/session-recovery/use-recovery.ts:221,224`; `features/settings/maintenance-section.tsx:71`; `packages/shared/src/sim/types.ts:890-949`; `packages/shared/src/sim/errors.ts:62,98` |
| F-M10 | RBAC is checked **in the client** with the static matrix: `roleHas` (6 call expressions in 4 files), `selectCan` (2), `ROLE_PERMISSIONS` (1), plus UI-only gates the adapters document as "the simulator would still accept the call from anyone" (storage policy, device restart, recovery start). The export wizard deliberately sends a forbidden export so the Core writes the denial audit row | The server must enforce; the client must read permissions from the server. The deliberate denied-export call is a pattern to keep (audit row EXPORT_DENIED) | grep, Read of the three adapters' header comments | table S5 |
| F-M11 | The Login screen renders seeded demo material straight from the simulator dataset: `OPERATORS` rows that fill the form, `DEMO_OPERATOR_PASSWORD` and `DEMO_PAIRING_CODE` shown as hints. Hidden only in presentation mode (`usePresentationMode`, read from `dems.mobile.prefs.v1`) | In Live mode these must not appear. The pairing code shown on Login is the simulator's fixed code (the shared constant that `pairing.ts` compares against). Values deliberately not recorded here | Read | `features/login/login-card.tsx:34-36,467-506`; `packages/shared/src/sim/pairing.ts:47-51` |
| F-M12 | Authentication is already asynchronous at the contract: `AuthContract.signIn` returns `Promise<SignInResult>` and the failure reasons already include `CORE_OFFLINE` and `UNAVAILABLE`; the Login controller `await`s both sign-in paths. The synchronous coupling is confined to `auth-provider.tsx:218` and the `BiometricSimAuth` interface (`biometric.ts:128-131,147,151`) | Sign-in is the smallest change; the contract types need no change. The operator record is memory-only (`authStorage: null`), so every cold start signs in again | Read | `runtime/contract.ts:41,61`; `auth/auth-provider.tsx:208-233,267-289`; `features/login/use-login-controller.ts:116,161`; `runtime/sim-adapters.ts:76-84` |
| F-M13 | The Core link has exactly two sources, `SIMULATED` (default) and `HEARTBEAT` (debug builds only, `__DEV__`). The type, the list, the parser and the Settings control all enumerate those two values. In HEARTBEAT mode the app drives the simulator's `tabletLink` from the heartbeat | A third source (Live) touches the union type, `CORE_LINK_SOURCES`, `parseCoreLinkSource`, `isCoreLinkSourceAvailable`, the Settings option list and the stored preference. A stored `HEARTBEAT` value falls back to `SIMULATED` in release builds, the same path a stored Live value would take | Read | `runtime/contract.ts:67`; `runtime/core-link.ts:24-34,72-80,128-139`; `features/settings/preferences-section.tsx:67-75`; `runtime/sim-runtime-provider.tsx:192-207` |
| F-M14 | There is **no pairing gate**: `/pair` is a public route, the only guard predicate is `isAuthenticated`, and pairing state is shown (Login trust line, Settings Security row, More link) but never blocks sign-in. The app holds no device credential and has no secure-storage or camera module | Q5 (pairing mandatory in Live mode) needs a new predicate in `RootNavigator` and `useBootHref`, a device credential store and (for QR) a camera module, none of which exist | Read; `package.json` dependency list searched for storage and camera modules | `navigation/routes.ts:130`; `navigation/root-navigator.tsx:58-63,78-90`; `features/login/login-card.tsx:519-547`; `apps/mobile/package.json:20-73` |
| F-M15 | Two calls already talk to a real server (mock-core): the shared `HeartbeatProvider` (WebSocket) and `useHealth` (`fetchHealth`, refetch 10 s). The origin is a compile-time constant with no environment override: `http://127.0.0.1:4400`, `ws://127.0.0.1:4400/ws` | A backend on another port needs these constants (shared package) or a second client; HEARTBEAT mode and the `reverse` script both assume 4400 | Read | `providers/app-providers.tsx:110-117`; `features/home/use-health.ts:8`; `packages/shared/src/api/constants.ts:8-10,18` |
| F-M16 | Four AsyncStorage keys are written by the app, one by the simulator adapter and three by app modules (section 5). Preferences share one key through `mergeItem` (D57). The runtime log redacts keys that look like credentials or pairing codes | Live mode must not delete or repurpose `dems.sim.v1`, `dems.mobile.auth.v1`, `dems.mobile.prefs.v1` or `dems.mobile.log.v1` (E10, U8). A device credential cannot go in `dems.mobile.auth.v1` (that module's contract says it holds only an operator id and a flag) | grep for keys and `AsyncStorage.*` calls | section 5 |
| F-M17 | Cleartext policy: `app.json` has no cleartext key and no `expo-build-properties` plugin. The generated `android/` folder (git-ignored, regenerated by `expo prebuild`) carries `usesCleartextTraffic="true"` in the **debug** and **debugOptimized** manifests only. The merged **release** manifest has no cleartext attribute (targetSdk 36), so release traffic is HTTPS-only by platform default | A Live mode over `adb reverse` works in debug builds as is; a release APK that reaches a backend needs a policy change (U4). Editing `android/` is not durable (KI-21) | Read of three manifests and the merged release manifest; `git check-ignore` | section 7 |
| F-M18 | `npm run e2e` runs Maestro against `e2e/maestro`, which does not exist. `npm run reverse` reverses only `tcp:4400` and `tcp:8081`. `device-session.sh` hard-codes the same two ports (lines 238, 449-459) | A backend port other than 4400 needs both scripts changed, or a second reverse. The e2e folder must be created by the plan (KI-02) | `ls apps/mobile/e2e` (no such directory); Read | section 8 |
| F-M19 | 34 files construct a simulator (`createTestSim`, `createSim`, `createMobileSim`; two of them are production: `runtime/sim-adapters.ts` and `runtime/sim-runtime-provider.tsx`); 11 test files use `renderWithRuntime` or `RuntimeTestProviders`; nine feature harnesses plus `router-harness.tsx` and `test-sim.tsx` make the 11 harness files; route-guard tests drive auth with a `FakeRuntime`, not the simulator | The Simulated mode and its tests are the regression baseline. The harnesses call synchronous actions to set up state (`signIn(...).ok`, `createSession`), so they must keep a Simulated implementation | grep, Read | section 8.3 |
| F-M20 | Many pure helpers take a whole `SimState`: `evaluatePrecheck`, `systemStatus`, `storageSummary`, `verifyEvidenceItem`, `caseNumberFor`, `startOfWibDay`, `selectCan`, `bookPoe`, `healthSeries` and the per-feature models that `Pick<SimState, ...>` | If the Live store is not `SimState`-shaped, each helper needs a Live equivalent (H-B2). Mobile also computes evidence integrity on the device from bundled demo packages (`@dems/shared/demo-data`, joined by evidence number suffix) | Read of the imports and adapters | section 3.4; `features/evidence/evidence-model.ts:9,27`; `features/evidence/sim-adapter.ts:40-67` |
| F-M21 | `useSim(selector)` compares with `useShallow`, so every selector must return a primitive or a reference the store keeps stable between changes; the code says so repeatedly (F74-13, F-70-1) and the 20 Hz audio tick must re-render nothing | A Live store fed by JSON messages needs structural sharing (stable references for unchanged slices), or each `useSim` consumer re-renders on every push. The high-rate audio path is a separate channel (`useAudioChannel`, S4-9) that bypasses React renders on purpose | Read of the hook and of the comments | `packages/shared/src/sim/react.ts:67-70`; `features/session-new/use-session-new.ts:1-9`; `runtime/sim-runtime-provider.tsx:61-72`; `runtime/use-audio-shared-values.ts:1-60` |

## 3. The simulator surface the app uses

### 3.1 Actions: all 42 `SimActions` members against mobile call sites

Signatures from `packages/shared/src/sim/types.ts:985-1094`. "Value returned" marks the 14 members that return something synchronously. Call sites are production code only (tests and harnesses are in section 8.3). Two of the call lines in `session-live-screen.tsx` and `session-new-screen.tsx` call a **wrapper** (`useMonitorActions`, `useFlowActions`), not the simulator; the simulator call is the wrapper's line. Method: scan on comment- and string-stripped code, then a line scan of every production file; the nine "never called" rows were re-checked with a zero-hit grep over all of `apps/mobile/src`.

| Action | Value returned (types.ts) | Production call sites (file:line under `apps/mobile/src/`) | Return value used? |
|---|---|---|---|
| `signIn` | `SignInResult` (:988) | `auth/auth-provider.tsx:218` | YES (S1-1) |
| `signInWithBiometric` | `SignInResult` (:990) | `auth/biometric.ts:147` | YES (S1-2) |
| `recordBiometricFailure` | `SignInResult` (:992) | `auth/biometric.ts:151` | YES (S1-3) |
| `signInWithSecurityKey` | `SignInResult` (:994) | none | never called |
| `signOut` | void | `auth/auth-provider.tsx:240` | no (throws are caught :238-244) |
| `touch` | void | `auth/auth-provider.tsx:261` | no |
| `createSession` | `CreateSessionResult` (:1005) | `features/session-new/use-session-new.ts:174,179` | YES (S1-4) |
| `beginPrecheck` | void | `features/session-new/use-session-new.ts:185` | no; must follow `createSession` ok |
| `acknowledgePrecheckWarnings` | void | `features/session-new/use-session-new.ts:214` | no (boolean wrapper S2-2) |
| `retryPrecheck` | void | `features/session-new/use-session-new.ts:215` | no (S2-2) |
| `startRecording` | void | `features/session-new/use-session-new.ts:217` (wrapper called at `session-new-screen.tsx:188`) | no (S2-2; sync navigation F-M6) |
| `stopRecording` | void | `features/session-live/use-monitor.ts:159` | no (S2-1) |
| `cancel` | void | `features/session-new/use-session-new.ts:178,216` | no |
| `scanCaseNumber` | `string` (:1024) | none (the app derives the number: `session-new-screen.tsx:203`, `session-new/sim-adapter.ts:34-36`) | never called |
| `recover` | void | `features/session-recovery/sim-adapter.ts:52`; `features/settings/maintenance-section.tsx:298` | no |
| `addMarker` | void | `features/session-live/use-monitor.ts:158` (wrapper called at `session-live-screen.tsx:157`) | no; store read after (S4) |
| `addNote` | void | none | never called |
| `snapshot` | void | `features/session-live/use-monitor.ts:157` (wrapper at `session-live-screen.tsx:150`) | no |
| `acknowledgeSummary` | void | `features/session-summary/use-summary.ts:135` | no (S2-4) |
| `verify` | `EvidenceVerifyResult` (:1034) | `features/evidence/sim-adapter.ts:61` | **ignored**; only "did not throw" is used |
| `exportEvidence` | `ExportResult` (:1035) | `features/evidence/export-sheet.tsx:113,142` | YES (S1-5, S1-6) |
| `archiveEvidence` | void | `features/evidence/evidence-detail.tsx:354`; `features/evidence/evidence-list-screen.tsx:139` | no; sync throw (S3) |
| `exportAudit` | `ExportResult` (:1042) | none | never called |
| `exportLogs` | `ExportResult` (:1048) | none | never called |
| `verifyAuditChain` | `ChainVerifyResult` (:1050) | `features/audit/chain-strip.tsx:107` | YES (S1-7) |
| `inject` | void | `features/settings/maintenance-section.tsx:273` | no (S2-7) |
| `clearFault` | void | `features/settings/maintenance-section.tsx:275` | no (S2-7) |
| `resetClip` | void | `features/session-live/use-monitor.ts:160`; `features/devices/device-detail.tsx:147`; `features/session-new/device-previews.tsx:111`; `features/settings/maintenance-section.tsx:277` (wrapper at `session-live-screen.tsx:186`) | no |
| `acknowledgeAlert` | void | `features/dashboard/home-header.tsx:170`; `features/session-recovery/use-recovery.ts:254` | no; looped over a store read at `use-recovery.ts:251-258` |
| `loadScenario` | void | `features/settings/maintenance-section.tsx:288`; `runtime/debug.ts:53` | no |
| `resetDemo` | void | none (reset is `loadScenario(IDLE)` at `maintenance-section.tsx:377`) | never called |
| `runDiagnostics` | `string` (:1065) | `features/settings/maintenance-section.tsx:114`; `features/devices/device-detail.tsx:136` | **ignored** (`void` at :114) |
| `deviceCommand` | void | `features/devices/device-detail.tsx:278` | no; sync throw (S3) |
| `setStoragePolicy` | void | `features/storage/storage-screen.tsx:192` | no (S2-6) |
| `startSoftwareUpdate` | void | `features/settings/maintenance-section.tsx:203` | no (S2-7) |
| `restartServices` | `number` (:1081) | none | never called |
| `setActiveCamera` | void | `features/session-live/use-monitor.ts:161` (wrapper at `session-live-screen.tsx:189`) | no |
| `setPresentationMode` | void | none (presentation mode is the app's own pref in `dems.mobile.prefs.v1`, `features/settings/settings-prefs.ts:139`) | never called |
| `updateSettings` | void | none | never called |
| `pair` | `PairResult` (:1090) | `features/pairing/use-pairing-flow.ts:103` | YES (S1-8) |
| `unpair` | void | `features/pairing/use-pairing-flow.ts:165` | no (S2-5) |
| `setTabletLink` | void | `runtime/sim-runtime-provider.tsx:201` | no |

Totals: 33 called, 9 never called, 14 return a value (7 used, 2 ignored, 5 never called). The 28 void members signal refusal only by throwing synchronously (`SimPermissionError`, `SimTransitionError`; documented in the `types.ts` comments at :1006-1010, :1067-1070, :1077-1080). Source: `scan.mjs` and `actions_lines.mjs` (kept outside the repo), `types.ts`.

### 3.2 Synchronous-return call sites

**Why this section exists**: the Live data source will answer after a network round trip. Every row below is a place where the app today depends on the answer, or on the state change, being available in the same call stack.

**Table S1: the return value of an action is consumed (9 expressions, 6 files)**

| ID | Call site | What is done with the value | Source |
|---|---|---|---|
| S1-1 | `result = sim.actions.signIn(username, password)` inside `async signIn` | `!result.ok` -> `toContractSignInResult(result, null)` (`LOCKED` + `lockedUntil`, else `INVALID_CREDENTIALS` + `attemptsRemaining`); on ok reads `sim.store.getState().operators` for the signed-in operator (:224), then `offerBiometricFor`. Wrapped in `try`; a throw becomes `UNAVAILABLE`. The enclosing function is already `Promise<SignInResult>` | `auth/auth-provider.tsx:208-233` |
| S1-2 | `auth.signInWithBiometric(operatorId)` (the `auth` argument is `sim.actions`, passed at `auth-provider.tsx:280`) | `result.ok` -> `{kind:'signed-in', operatorId}`, else `fromFailure` (`locked` / `failed`). Sits behind the interface `BiometricSimAuth` whose two methods are typed **synchronous** | `auth/biometric.ts:128-131,140-166` |
| S1-3 | `auth.recordBiometricFailure(operatorId)` | counts one failure toward the lockout; result mapped by `fromFailure`; `result.ok` is treated as an error | `auth/biometric.ts:150-153` |
| S1-4 | `actions.createSession(values)` twice | `result.ok`, `result.reason` (`SESSION_ACTIVE` triggers `cancel()` then a second `createSession` when the local state is `CREATE`), `result.sessionId`, `result.created`; then `beginPrecheck()` straight after. Returned as `CreateOutcome` and read at `session-new-screen.tsx:228-235` (`outcome.ok`, `outcome.reason` -> `setCreateError`) | `features/session-new/use-session-new.ts:171-197`; `features/session-new/session-new-screen.tsx:228` |
| S1-5 | `actions.exportEvidence(evidenceId, {reason:'', destination:''})` | deliberate probe by a role without EVIDENCE_EXPORT so the Core writes the denial audit row; only `result.ok` / `result.status` are logged | `features/evidence/export-sheet.tsx:107-120` |
| S1-6 | `actions.exportEvidence(evidenceId, {reason, destination})` after a timer | `result?.ok` -> `result.exportId`, step 5, success toast; else `result.reason` / `result.status` -> `setFailure`, and `INVALID_REASON` returns to step 3. A throw leaves `result = null` -> `UNKNOWN`. Runs inside `setTimeout` (`EXPORT_BUILD_MS`) | `features/evidence/export-sheet.tsx:136-164` |
| S1-7 | `actions.verifyAuditChain()` | `setState({kind:'done', result, at: sim.store.getState().clock.now})`, haptic on `result.ok`; runs one animation frame after the spinner shows | `features/audit/chain-strip.tsx:98-118` |
| S1-8 | `outcomeOf(actions.pair(attempt.code))` | `PairResult` (`ok` + `pairedAt`, or `INVALID_CODE` + `attemptsRemaining`, or `LOCKED` + `lockedUntil` + `retryInMs`) mapped by `outcomeOf` (`pairing-model.ts:45`); runs inside a `queueMicrotask` fired by a store subscription (F-M8) | `features/pairing/use-pairing-flow.ts:99-112` |

Return value present but **ignored**: `verify` (`features/evidence/sim-adapter.ts:61`, called from `integrity-tab.tsx:77`; only absence of a throw yields `'recorded'`), `runDiagnostics` (`maintenance-section.tsx:114` uses `void`; `device-detail.tsx:136`).

**Table S2: a synchronous success or throw becomes a boolean that callers branch on at once**

| ID | Wrapper (file:lines) | Actions wrapped | Consumer branching on the boolean (file:line) |
|---|---|---|---|
| S2-1 | `useMonitorActions` -> `run` (`features/session-live/use-monitor.ts:126-163`, `run` at :132-152; refuses first while the Core link is OFFLINE: `useMonitorReadOnly` :104-108) | `snapshot`, `addMarker`, `endSession` (= `stopRecording`), `resetClip`, `setActiveCamera` | `session-live-screen.tsx:150` (`if (actions.snapshot())` bumps a signal and toasts); :157 (`if (!actions.addMarker(label)) return false;` then reads the timeline from the store, S4); :180-183 (`onEnd` returns the boolean) -> `end-session.tsx:189` (`if (onEnd(check.value))` clears the reason and closes the dialog, else re-enables); :186 and :189 ignore the boolean |
| S2-2 | `useFlowActions` -> `guarded` (`features/session-new/use-session-new.ts:158-219`, `guarded` :199-210) | `acknowledgePrecheckWarnings`, `retryPrecheck`, `cancel`, `startRecording` | `session-new-screen.tsx:240` (`!actions.acknowledgeWarnings()` blocks step 3); :246 (`if (actions.retryChecks()) setAcknowledged(false)`); :188 (`if (!actions.startRecording()) { setLaunching(false); return; }` then synchronous navigation, F-M6); :256 `cancelSession()` ignores it |
| S2-3 | `useRecoveryActions` (`features/session-recovery/use-recovery.ts:204-265`; `start` :213-232, `canOpenEvidence` :235-243) | `recover` (through `startRecovery`, `sim-adapter.ts:50-53`); a client-side permission assert | `session-recovery-screen.tsx:175` (`onStart={actions.start}`); :140 (`!actions.canOpenEvidence()` stops opening the evidence) |
| S2-4 | `useAcknowledgeSummary` (`features/session-summary/use-summary.ts:123-144`; reads `selectPendingSummaryId(sim.store.getState())` first, :130) | `acknowledgeSummary` | `session-summary-screen.tsx:103` (`if (acknowledge()) navigate('/home', 'home')`) and :107 (navigate to the evidence) |
| S2-5 | `usePairingFlow.unpair` (`features/pairing/use-pairing-flow.ts:163-174`) | `unpair` | `pairing-screen.tsx:66-68` (success or failure toast by `ok`) |
| S2-6 | `useApplyStoragePolicy` (`features/storage/storage-screen.tsx:184-204`) | `setStoragePolicy` | `manage-storage-sheet.tsx:179` (`if (onApply(draft)) onDone()` closes the sheet) |
| S2-7 | `useSimCommand` (`features/settings/maintenance-section.tsx:61-80`) | `runDiagnostics` (:114), `startSoftwareUpdate` (:203), `inject` / `clearFault` / `resetClip` (:270-282), `loadScenario` (:288), `recover` (:298) | :115 (`if (started) setOpen(true)`), :209 (toast if started), :282 (`if (!done) return`), :289-290 (`if (!done) return; setScenario(name)`), :298 (toast) |
| S2-8 | `KnownDeviceDetail.startDiagnostics` (`features/devices/device-detail.tsx:134-141`) | `runDiagnostics` | `device-detail.tsx:236` (`if (startDiagnostics()) setDiagnosticsOpen(true)`); :270 ignores it |

**Table S3: callbacks typed `=> void` that signal refusal by throwing, with a success toast after the call**

| ID | Dialog | The synchronous pattern | Callers that supply the action |
|---|---|---|---|
| S3-1 | `ArchiveDialog` (`features/evidence/archive-dialog.tsx:18-19,26-39`) | `try { archive(evidenceId); toast success } catch { toast danger } finally { setBusy(false); onOpenChange(false) }` | `features/evidence/evidence-list-screen.tsx:137-144` and `features/evidence/evidence-detail.tsx:352-359` (each wraps `actions.archiveEvidence(id)` and rethrows) |
| S3-2 | `DeviceCommandDialog` (`features/devices/device-command-dialog.tsx:22-23,31-45`) | `try { onConfirm(command); toast success } catch { toast danger } finally { setBusy(false); onClose() }` | `features/devices/device-detail.tsx:278` (`onConfirm={(next) => actions.deviceCommand(deviceId, next)}`) |

**Table S4: store read right after a write, or just before one (no return value involved)**

| ID | Site | Dependence | Source |
|---|---|---|---|
| S4-1 | `findAuthOperator(sim.store.getState().operators, result.operatorId)` right after `signIn` | the operator record is in the store the moment `signIn` returns | `auth/auth-provider.tsx:224` |
| S4-2 | `sim.store.getState().session?.timeline.at(-1)` right after `addMarker` (label and time of the new marker), plus `sim.clock.now()` | the new timeline node exists when the call returns | `features/session-live/session-live-screen.tsx:158-163` |
| S4-3 | `at: sim.store.getState().clock.now` after `verifyAuditChain` | the simulator clock is the time shown | `features/audit/chain-strip.tsx:108` |
| S4-4 | `selectPendingSummaryId(sim.store.getState()) !== sessionId` before `acknowledgeSummary` | pending-summary id is readable synchronously | `features/session-summary/use-summary.ts:130` |
| S4-5 | `setFrom(sim.store.getState().clock.now)` on pull-to-refresh | "last refreshed" is the simulator clock | `features/sessions/sessions-screen.tsx:136` |
| S4-6 | `form.setValue('caseNumber', nextCaseNumber(sim.store.getState()))` | the next case number is computed on the device from `meta.counters.caseNumber`, the active session and the history (`session-new/sim-adapter.ts:20-36`); `scanCaseNumber` is not used | `features/session-new/session-new-screen.tsx:203` |
| S4-7 | `sim.store.getState().tabletLink.state === next` before `setTabletLink(next)` (writes only on a real change; each change is one audit row) | de-duplication against the current store | `runtime/sim-runtime-provider.tsx:199-201` |
| S4-8 | `sim.store.getState().alerts` looped to call `acknowledgeAlert(alert.id)` per matching alert | alerts are readable and each acknowledge is synchronous | `features/session-recovery/use-recovery.ts:251-258` |
| S4-9 | `sim.store.getState().audio.channels[channel]` polled every `AUDIO_A11Y_INTERVAL_MS`; and `useAudioChannel` subscribes with `store.subscribe(selector, listener, {fireImmediately:true})` at 20 Hz without a React render | the 20 Hz audio frame is a store value written by the engine, not a request | `runtime/use-audio-shared-values.ts:87-109`; `packages/shared/src/sim/react.ts:97-111` |

**Simulator-clock dependence** (a timeline on `s.clock.now`, not a request): the pairing commit and hand-off (F-M8); `phaseAt(s.clock.now - startedAt)` at `use-pairing-flow.ts:78`; `ackSettled(acknowledgedAt, s.clock.now)` at `use-recovery.ts:173-175`; the Login lockout countdown (`lockoutInfoOf`, `auth-provider.tsx:125-133`); the elapsed-seconds timer of the monitor (`use-monitor.ts:59-61`). Eleven production files read `s.clock` inline (group tables, column "Inline slices").

**Table S5: permission and role checks done in the client**

| ID | Site | Check | Note |
|---|---|---|---|
| S5-1 | `features/evidence/export-sheet.tsx:107-120` | `roleHas(operator.role, Permission.EVIDENCE_EXPORT)`; a role without it still calls the Core so the denial is audited | pattern to keep |
| S5-2 | `features/session-recovery/sim-adapter.ts:40-58` | `roleHas(role, Permission.SESSION_START)` (throws `SimPermissionError` before `recover`); `roleHas(role, EVIDENCE_VIEW)` | header comment SIM-GAP-M81-2: the simulator's `recover` has no role check. Used at `session-recovery-screen.tsx:174` and `use-recovery.ts:213-243` |
| S5-3 | `features/storage/sim-adapter.ts:60-62` | `roleHas(role, EVIDENCE_REVIEW) \|\| roleHas(role, MAINTENANCE)` | header SIM-GAP-M85-2: "the simulator itself would still accept the call from anyone". Used by `manage-storage-sheet.tsx` (prop `role`) |
| S5-4 | `features/devices/use-devices-data.ts:29` and `features/devices/device-detail.tsx:155` | `selectCan(s, Permission.DEVICE_MANAGE)`; `restartBlocked = !canManage \|\| recording` | header SIM-GAP-M84-3: `deviceCommand` checks no permission |
| S5-5 | `features/evidence/use-evidence-data.ts:56` | `selectCan(s, Permission.EVIDENCE_REVIEW)` -> `useCanArchive`, consumed at `evidence-list-screen.tsx:166`, `evidence-detail.tsx:82` | |
| S5-6 | `features/session-new/session-new-model.ts:62` | `operators.filter((o) => roleHas(o.role, 'SESSION_START'))`: the investigator list | |
| S5-7 | `features/settings/settings-model.ts:76`; `features/settings/profile-sheet.tsx:51` | `ROLE_PERMISSIONS[role]` shown as the operator's permission list | static matrix imported from the simulator |

### 3.3 Selectors and views the app reads

Production code imports 31 distinct named selectors and views from the simulator (per-file in the group tables). Most-used: `selectPendingSummaryId` (4 files), `selectClockSecond` (3), `selectAuditChainBreak`, `selectStorage`, `selectCan`, `selectOperatorById`, `selectSessionHistoryById` (2 each); the remaining 24 are used by one file each: `selectLockout`, `selectActiveAlerts`, `selectDeviceStats`, `selectElapsedMs`, `selectRecentSessions`, `selectSealedToday`, `selectUnacknowledgedAlertCount`, `systemStatus`, `selectEvidence`, `selectEvidenceById`, `selectOperator`, `storageSummary`, `selectCameras`, `selectMics`, `selectTimeline`, `selectPrecheck`, `selectRole`, `selectEvidenceBySessionId`, `selectSessionHistory`, `selectActiveFaults`, `selectDiagnostics`, `selectUpdate`, `selectEvidenceStats`, `selectStoragePolicy`. Beyond the named ones, 60 production files read slices inline with `s.<slice>` inside a `useSim` callback or a `Pick<SimState, ...>` model. Inline slices read by production code, with file counts: `session` 17, `clock` 11, `time` 6, `network` 6, `cameras` 5, `tabletLink` 5, `operators` 4, `audit` 4, `mics` 4, `pairing` 4, `faults` 3, `storage` 3, `sessionHistory` 3, `auth` 2, `evidence` 2, `meta` 2, then one file each for `security`, `otherDevices`, `diagnostics`, `lastSealedSessionId`, `lastSealedAcknowledged`, `activeCameraId`, `alerts`, `device`, `events`, `audio`. Seven slices have no inline read in mobile production code (`authLockout`, `storagePolicy`, `services`, `health`, `ports`, `update`, `settings`); they may still be read through the named selectors above (hypothesis; the selector-to-slice map is row 1's output). Source: scan of `useSim(` callbacks and `Pick<SimState, ...>` on stripped code.

Other simulator values imported into production code (constants, pure functions, classes; 55 distinct type names are also imported): `AUDIT_TYPE_CATEGORY`, `AuditCategory`, `AUTH_IDLE_TIMEOUT_MS` (3 files), `caseNumberFor`, `evaluatePrecheck`, `EVIDENCE_STATUS_STAGE`, `EvidenceStatus`, `FaultKind` (4 files), `formatDuration`, `formatWibTime`, `GB`/`TB`, `PAIRING_CODE_LENGTH`, `PairingState`, `Permission`, `PRECHECK_ORDER`, `RECORDING_BYTES_PER_HOUR`, `RECORDING_PROFILES`, `RecordingProfileId`, `RECOVERY_MS`, `RECOVERY_SCAN_MS`, `RetentionPolicyId`, `ROLE_PERMISSIONS`, `roleHas`, `ROOMS`, `ScenarioName`, `SessionOutcome`, `Severity`, `sha256Hex`, `signedInOperatorId`, `SIM_STORAGE_KEY`, `SimPermissionError`, `SimTransitionError`, `SOFTWARE_VERSION`, `startOfWibDay`, `STOP_REASON_MIN_LENGTH`, `STORAGE_FULL_PERCENT`, `STORAGE_LOW_PERCENT`, `SubjectTypeLabel`, `TRACK_ORDER`, `verifyEvidenceItem`, and the three demo-material constants `OPERATORS`, `DEMO_OPERATOR_PASSWORD`, `DEMO_PAIRING_CODE` (F-M11). Source: scan of imports.

### 3.4 The raw `Sim` handle and the provider tree

| Item | Where | Note |
|---|---|---|
| Creation | `runtime/sim-adapters.ts:76-84` `createMobileSim`: `createSim({... storage: AsyncStorage persist, authStorage: null, visibility: AppState})` | operator record is never persisted (:81 `authStorage: null`) |
| Provider | `runtime/sim-runtime-provider.tsx:84-107`: creates one sim per mount (or accepts an injected one) and renders the shared `SimProvider sim={instance} autoStart` | |
| Hydration gate | `sim-runtime-provider.tsx:119-134`: `Promise.all([sim.ready, hydrateCoreLinkSource()])`; `BootGate` holds the splash up to `SPLASH_MAX_HOLD_MS` (2,000 ms) | `providers/boot-gate.tsx:12,24-38` |
| Runtime contract derived from the store | `sim-runtime-provider.tsx:62-72,136-168`: `selectActiveSessionInfo`, tablet link, heartbeat -> `RuntimeContract { status, auth, coreLink, session }` | `useActiveSession()` is what the route guards and `KeepAwakeController` read |
| Tree order | `providers/app-providers.tsx:103-123`: Gesture, Keyboard, SafeArea, QueryClient, I18next, HeroUI, **HeartbeatProvider, SimRuntimeProvider, AuthProvider** | `AppProviders` accepts an injected `sim` and `simOptions` (tests) |
| Portalled content | five sheet frames re-provide with `SimContext.Provider`: `features/settings/sheet-frame.tsx:50`, `features/evidence/sheet-frame.tsx:98,127`, `features/session-live/monitor-sheets.tsx:43`, `features/storage/manage-storage-sheet.tsx:71`, `features/devices/diagnostics-sheet.tsx:44` | a Live provider must also be re-providable into portals |
| Raw handle users | table S4, plus `auth-provider.tsx:211,268` (`await sim.ready`), `runtime/debug.ts:50`, `evidence/integrity-tab.tsx:50,77`, `evidence-detail.tsx:105`, `export-sheet.tsx:98` (`sim.clock.now()` into `integrityFor`) | |
| Debug handle | `runtime/debug.ts:98-118`: `globalThis.__DEMS_DEBUG__ = { sim, ... }`, gated on `__DEV__` | the handle exposes the `Sim` to the Hermes inspector in debug builds |
| Barrel | `runtime/index.ts:25-128` exports the contract, `SimRuntimeProvider`, `createMobileSim`, `useAudioSharedValues`, the Core link functions, route resync, keep-awake, banner, resync bus, runtime log | |

## 4. Core link, sign-in, biometric and pairing code

### 4.1 Core link sources

| Item | What exists (quoted) | Source |
|---|---|---|
| Source type | `export type CoreLinkSource = 'SIMULATED' \| 'HEARTBEAT';` and `CoreLinkInfo { source, state, heartbeat? }` | `runtime/contract.ts:67-75` |
| Default and list | `export const DEFAULT_CORE_LINK_SOURCE: CoreLinkSource = 'SIMULATED';` and `export const CORE_LINK_SOURCES: readonly CoreLinkSource[] = ['SIMULATED', 'HEARTBEAT'];` | `runtime/core-link.ts:24-25` |
| Build gate | `return source !== 'HEARTBEAT' \|\| isDevBuild;` with `isDevBuild = __DEV__`; `effectiveCoreLinkSource` falls back to the default; `setCoreLinkSource` refuses an unavailable source and logs `runtime.coreLink.unavailableSource` | `runtime/core-link.ts:32-39,128-133` |
| State by source | `if (source === 'HEARTBEAT') return heartbeat === 'LIVE' ? 'ONLINE' : 'OFFLINE'; return tabletLink === 'CONNECTED' ? 'ONLINE' : 'OFFLINE';` | `runtime/core-link.ts:42-49` |
| Heartbeat to simulator | `LIVE` -> `CONNECTED`; `STALE` and `OFFLINE` -> `OFFLINE`; `CONNECTING` leaves it. Applied in `useTabletLinkFromHeartbeat` with `sim.actions.setTabletLink(next)`, after hydration only, and only on a real change | `runtime/core-link.ts:55-65`; `runtime/sim-runtime-provider.tsx:192-207` |
| Persistence | Preference `coreLinkSource` inside `dems.mobile.prefs.v1`, written with `AsyncStorage.mergeItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: source }))`; parsed by `parseCoreLinkSource`, which accepts only the two values | `runtime/core-link.ts:72-89` |
| Settings control | option list built from `CORE_LINK_SOURCES`, `isDisabled: !isCoreLinkSourceAvailable(source)`, hint text differs by `__DEV__` | `features/settings/preferences-section.tsx:67-75` |
| Sign-in block | `isSignInBlocked(link)`: `link.source === 'HEARTBEAT' && link.state === 'OFFLINE'` (Login Sign In disabled, reason `CORE_OFFLINE`) | `auth/auth-provider.tsx:144-147` |
| Read-only while offline | monitor and recovery actions refuse while `banner.kind === 'offline' \|\| link.state === 'OFFLINE'` | `features/session-live/use-monitor.ts:104-108`; `features/session-recovery/use-recovery.ts:184-188` |
| Banner and resync | `connection-banner.ts` (`nextBannerKind`, `bannerKindAfterResync`); heartbeat `onResync` invalidates the health query and emits the resync bus; `SessionRouteSync` replaces the route per the session table | `runtime/connection-banner.ts:26-40`; `providers/app-providers.tsx:96-101`; `runtime/session-route-sync.tsx:1-40` |
| Real network calls today | `HeartbeatProvider` (WebSocket, `CORE_WS_URL`) and `useHealth` (`fetchHealth`, 10 s refetch). Nothing else in the app calls a server | `providers/app-providers.tsx:110-117`; `features/home/use-health.ts:8` |
| Release behaviour | the stored value `HEARTBEAT` is read, then `effectiveCoreLinkSource` returns `SIMULATED` in a release build (test: `features/settings/heartbeat-release-gate.test.tsx`) | `runtime/core-link.ts:111-125` |

### 4.2 Sign-in

| Item | What exists | Source |
|---|---|---|
| Contract | `signIn(username: string, password: string): Promise<SignInResult>;` and `signOut(reason?: SignOutReason): void;`; reasons `'INVALID_CREDENTIALS' \| 'LOCKED' \| 'CORE_OFFLINE' \| 'UNAVAILABLE'`; outside `AuthProvider` the value is `UNAVAILABLE_AUTH` (`signIn: async () => ({ ok: false, reason: 'UNAVAILABLE' })`) | `runtime/contract.ts:41,57-64,115-120` |
| Provider | `AuthProvider` sits inside `SimRuntimeProvider`, re-provides the contract with `auth`, and holds the idle lock: `onTouchStart={touch}` on one wrapping view calls `sim.actions.touch()` throttled to `ACTIVITY_THROTTLE_MS = 5_000`; the simulator expires the sign-in after 15 min (`AUTH_IDLE_TIMEOUT_MS`, `auth-dialogs.tsx`) | `auth/auth-provider.tsx:54,155-265,358` |
| Operator identity | `AuthOperator { id, displayName, initials, role, username? }`, found by `findAuthOperator(sim.store.getState().operators, id)`; `isAuthenticated` = an operator is found for `auth.status === 'SIGNED_IN'` | `auth/operators.ts:9-23`; `auth/auth-provider.tsx:187-190,248-251` |
| Lockout | read from the store through `selectLockout` (`lockoutInfoOf`): `locked`, `lockedUntilMs`, `retryInSeconds`, `attemptsRemaining` | `auth/auth-provider.tsx:125-133` |
| Credentials | in memory for the call only; the Login controller clears the password in `finally`; the runtime log drops context keys matching `pass`, `pin`, `token`, `secret`, `credential`, `username`, `code`, `pairingcode`, `otp` | `features/login/use-login-controller.ts:148-153`; `runtime/log.ts:33,69` |
| Session lifetime | the operator record is **memory only**: `authStorage: null`, so a cold start signs in again, and the route sync restores the monitor if a session still records | `runtime/sim-adapters.ts:76-84`; `auth/auth-provider.tsx:24-25` (header) |
| Login screen | `useLoginController` calls `auth.signIn` and `session.signInWithBiometric` (both awaited), maps `result.reason` to notices; trust line from `pairing.state`; demo operator rows from `OPERATORS` | `features/login/use-login-controller.ts:110-201`; `features/login/login-card.tsx:467-547` |
| "Security key (simulated)" | `signInWithSecurityKey` exists in the simulator and is **not used** by mobile | section 3.1 |

### 4.3 Biometric

| Item | What exists | Source |
|---|---|---|
| Module | `expo-local-authentication ~57.0.3`, plugin listed in `app.json`; Android permissions `USE_BIOMETRIC` and `USE_FINGERPRINT` in the main manifest | `apps/mobile/package.json:43`; `apps/mobile/app.json:47`; `android/app/src/main/AndroidManifest.xml:5-6` |
| Flow | `biometricSignIn`: availability (`hasHardwareAsync`, `isEnrolledAsync`), OS prompt (`authenticateAsync` with `disableDeviceFallback: true`, `biometricsSecurityLevel: 'strong'`), then the simulator trusts the OS verdict ("simulated identity binding"): `signInWithBiometric(operatorId)` or `recordBiometricFailure(operatorId)` | `auth/biometric.ts:1-24` (header), `:87-95,140-187` |
| What is bound | `dems.mobile.auth.v1` holds exactly `{ lastOperatorId, biometricEnabled }`; no template, no secret, no token. The operator id must match `/^[A-Z]{2,5}-\d{1,6}$/` | `auth/auth-prefs.ts:1-24,43-48` |
| Offer and toggle | after a password sign-in the provider offers the binding when the device can and the operator is not already bound (`offerBiometricFor`); Settings > Security has the switch (`setBiometricEnabled`) | `auth/auth-provider.tsx:199-206,291-308`; `features/settings/security-section.tsx:45-62` |
| Not present | no stored device credential, no key in a keystore, no biometric-protected item: the OS verdict alone signs in | `package.json` lists no secure-storage module (F-M14) |

### 4.4 Pairing

| Item | What exists | Source |
|---|---|---|
| Route and screen | `/pair` (public) -> `PairingScreen`; entered from the Login trust line (`router.push('/pair')`), Settings > Security, and the More list | `app/pair.tsx:1-6`; `navigation/routes.ts:130`; `features/login/login-card.tsx:546`; `features/settings/security-section.tsx:81-86`; `features/more/more-model.ts:23-26` |
| State read | `s.pairing.state`, `coreDeviceId`, `coreName`, `certificateFingerprint`, `pairedAt`, `lockedUntil`, plus the last pairing audit row (`selectLastPairingAudit` over `s.audit`) | `features/pairing/pairing-model.ts:129-146` |
| Code entry | six digits (`PAIRING_CODE_LENGTH`), digits-only input, kept in the hook's memory only ("never stored, logged or put in an audit row") | `features/pairing/use-pairing-flow.ts:1-16,145-149` |
| Timeline | `PAIR_TIMELINE = { verifyAt: 900, commitAt: 1_800, handoffAfter: 2_400 }` on the simulator clock; `pair(code)` runs at `commitAt` | `features/pairing/pairing-model.ts:23`; `use-pairing-flow.ts:89-120` |
| Outcome | `outcomeOf(PairResult)`; `paired`, `failed`, `locked` (3 failures within 5 min lock 60 s, enforced by the simulator), `error` on a throw; haptics per outcome | `pairing-model.ts:45`; `use-pairing-flow.ts:99-112`; `packages/shared/src/sim/pairing.ts:5-9`; `packages/shared/src/sim/constants.ts:59-61` |
| Hand-off | after success, `leave()`: back if the stack has a screen below, else `router.replace('/')` (boot router) | `use-pairing-flow.ts:81-86,122-143` |
| Unpair | `unpair()` -> one UNPAIRED audit row; `pairing-screen.tsx:64-69` shows a toast by the boolean | `use-pairing-flow.ts:163-174` |
| Code check | the shared `pairTransition` compares the entered code with a fixed constant (`DEMO_PAIRING_CODE`); mobile has no code verification of its own | `packages/shared/src/sim/pairing.ts:47-51` |
| Persistence | `pairing` is a snapshot key persisted in `dems.sim.v1` | `packages/shared/src/sim/store.ts:29` |
| Where the code is shown | Login "demo operators" accordion prints `DEMO_PAIRING_CODE` (hidden in presentation mode); `pairing-screen.test.tsx` imports the constant. Value not recorded here | `features/login/login-card.tsx:506`; `features/pairing/pairing-screen.test.tsx` |
| Camera / QR | none: no camera module, no QR scanner in `apps/mobile/package.json` | `apps/mobile/package.json:20-73` |

## 5. Storage keys (quoted from code)

| Key | Where defined (quote) | Owner and shape | Written by |
|---|---|---|---|
| `dems.sim.v1` | `packages/shared/src/sim/constants.ts:12`: `export const SIM_STORAGE_KEY = 'dems.sim.v1';` re-exported on mobile as `export const SIM_SNAPSHOT_KEY = SIM_STORAGE_KEY;` (`runtime/sim-adapters.ts:29`) | the simulator snapshot (30 slices; audio, clock and auth excluded; version `SIM_SNAPSHOT_VERSION = 1`); throttled to 1 write per second (`PERSIST_THROTTLE_MS = 1_000`, `constants.ts:18`) | `createAsyncStoragePersistStorage` -> `createJSONStorage(() => AsyncStorage)` (`runtime/sim-adapters.ts:32-36`) |
| `dems.mobile.prefs.v1` | `motion/prefs.ts:12`: `export const MOBILE_PREFS_KEY = 'dems.mobile.prefs.v1';` | one shared object, **every writer uses `AsyncStorage.mergeItem`** (D57): `reduceMotion`, `haptics` (`motion/prefs.ts:47`); `coreLinkSource` (`runtime/core-link.ts:88`); `railCollapsed` (`navigation/rail-prefs.ts:31`); `presentationMode`, `meterSize`, `notifications` (`features/settings/settings-prefs.ts:88`); `features/login/presentation-mode.ts:29` only reads | motion kit, runtime, navigation shell, Settings |
| `dems.mobile.auth.v1` | `auth/auth-prefs.ts:13`: `export const MOBILE_AUTH_KEY = 'dems.mobile.auth.v1';` | exactly `{ lastOperatorId, biometricEnabled }`; "this module is the key's only writer"; `setItem` of the whole object | `auth/auth-prefs.ts:43-48` |
| `dems.mobile.log.v1` | `runtime/log.ts:24`: `export const RUNTIME_LOG_KEY = 'dems.mobile.log.v1';` | ring buffer of up to `RUNTIME_LOG_CAPACITY = 200` privacy-filtered records, flushed debounced every 2,000 ms | `runtime/log.ts:19-40,136-137` |
| `dems.auth` | `packages/shared/src/sim/constants.ts:16`: `export const AUTH_STORAGE_KEY = 'dems.auth';` | the web's signed-in record. **Never written on mobile** (`authStorage: null`); a test asserts `AsyncStorage.getItem(AUTH_STORAGE_KEY)` is `null` | `runtime/sim-adapters.test.ts:83` |

Not storage: `CAMERA_POE_PORT_KEY = 'devices.ports.poeCam1'` (`features/devices/sim-adapter.ts:53`) is a lookup key. Module state without storage: the pending deep link (`navigation/pending-href.ts:41-60`) and the signed-in snapshot used by it (`:24`). No keychain, no `expo-secure-store`, no SQLite: AsyncStorage `2.2.0` is the only persistent store (`apps/mobile/package.json:28`).

## 6. Routes and guards

| Item | What exists (quoted) | Source |
|---|---|---|
| Root stack | `<Stack.Protected guard={!isAuthenticated}><Stack.Screen name="(auth)" /></Stack.Protected>` and `<Stack.Protected guard={isAuthenticated}><Stack.Screen name="(app)" /></Stack.Protected>`; `index`, `stack-check`, `pair` unguarded. **The only guard predicate is `isAuthenticated`** from `useAuth()` | `navigation/root-navigator.tsx:48-64` |
| Boot router | `useBootHref`: `/login` while signed out; after sign-in the session resync target, else the pending href, else `/home`; `BootRedirect` renders `<Redirect href={href} />` | `navigation/root-navigator.tsx:78-108`; `app/index.tsx:1-19` |
| After sign-in | when the guard removes the auth group, Expo Router falls back to `/`; if a public screen (`/pair`, `/stack-check`) is underneath, the navigator replaces it with `/` | `navigation/root-navigator.tsx:29-45` |
| Route table | `ROUTE_SCREENS`: `/`, `/stack-check`, `/pair` are `public`; `/login` is `signed-out`; 18 more are `guarded`; `isGuardedPath` checks the first segment against the tabs and `session` | `navigation/routes.ts:127-150` (22 entries, `access` per entry); `GUARDED_FIRST_SEGMENTS` at :159 and `isGuardedPath` at :162-164 |
| Deep links | `redirectSystemPath` keeps a guarded URL received while signed out as the pending href and returns `/login` (never logs the URL) | `app/+native-intent.tsx:1-20`; `navigation/pending-href.ts:41-50` |
| Session routes | `/session/new` is refused while a session is busy (`RECORDING`, `STOPPING`, `FINALIZING`, `FAULT`, `RECOVERY`); `/session/live` redirects to the resync target or `/home` unless `session.state === 'RECORDING'` | `navigation/session-guards.ts:21-44`; `navigation/session-routes.ts:35-81` |
| State source | every guard reads `useActiveSession()`, i.e. the runtime contract derived from the simulator store (`selectActiveSessionInfo`) | `runtime/sim-runtime-provider.tsx:62-72,168` |
| Group layouts | `(app)/_layout.tsx` mounts `AppStack`, `SessionRouteSync`, `KeepAwakeController`; `(auth)/_layout.tsx` mounts `AuthStack` | `app/(app)/_layout.tsx:1-20`; `app/(auth)/_layout.tsx:1-8` |
| No pairing predicate | nothing in the navigator, the boot router or the login controller reads `pairing.state` to allow or deny sign-in | grep of `pairing` in `navigation/` (none) and `use-login-controller.ts` (none) |
| Route files | `src/app/` holds 34 route and layout files and no simulator import: `index`, `pair`, `stack-check`, `dev-gallery`, `+not-found`, `+native-intent`, `_layout`, `(auth)/login`, `(app)/_layout`, `(app)/session/{finalizing,live,new,recovery,summary/[sessionId]}`, `(app)/(tabs)/{home,more,audit,network-time,storage,devices/*,evidence/*,sessions/*,settings/*}` | `find apps/mobile/src/app -type f` (34 entries); `graft map` also reports 34 files for `apps/mobile/src/app/` |

## 7. `app.json`, plugins and the cleartext policy

| Item | What exists (quoted) | Source |
|---|---|---|
| Plugins | `"expo-router"`, `["expo-splash-screen", {...}]`, `"expo-video"`, `"expo-font"`, `"expo-status-bar"`, `"expo-local-authentication"`, `"./plugins/with-dems-release-signing"` (7 entries) | `app.json:34-49` |
| Experiments | `"typedRoutes": true`, `"reactCompiler": true` | `app.json:50-53` |
| Identity | `"scheme": "demsdemo"`, `"package": "com.dems.demo.tablet"`, `"versionCode": 100`, `"version": "0.1.0"`, `"allowBackup": false` | `app.json:5,8,21-23` |
| Blocked permissions | `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | `app.json:24-28` |
| Not present in `app.json` | no `usesCleartextTraffic`, no `expo-build-properties`, no `networkSecurityConfig`, no camera or secure-store plugin | grep of `app.json` (no match) |
| Local plugin | `with-dems-release-signing.js` appends one marked block to the generated `android/app/build.gradle` at every prebuild; reads the git-ignored `signing/release-signing.properties` (not opened here); fails any release task if that file is missing; never touches the debug build type | `plugins/with-dems-release-signing.js:1-60` |
| Debug manifests | `<application android:usesCleartextTraffic="true" tools:targetApi="28" ... tools:replace="android:usesCleartextTraffic" />` in **both** `debug` and `debugOptimized` | `android/app/src/debug/AndroidManifest.xml:6`; `android/app/src/debugOptimized/AndroidManifest.xml:6` |
| Main manifest | `<uses-permission android:name="android.permission.INTERNET"/>`; `USE_BIOMETRIC`, `USE_FINGERPRINT`, `VIBRATE`; the `<application ...>` element carries **no** `usesCleartextTraffic` attribute | `android/app/src/main/AndroidManifest.xml:2-7,16` |
| Merged release manifest | `android:minSdkVersion="24"`, `android:targetSdkVersion="36"`, zero occurrences of `usesCleartextTraffic` (grep count 0); permissions include `INTERNET` | `android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml:8-9,11-14` (build artifact, git-ignored) |
| Consequence | with targetSdk 36 and no attribute, cleartext HTTP is blocked in the release build; the debug builds allow it, which is why `adb reverse` to `http://127.0.0.1:4400` works there | platform default for targetSdk >= 28 (stated, not tested here); 06_packaging_spec §2.6 |
| Regeneration | `apps/mobile/android` is git-ignored (`apps/mobile/.gitignore:43` `/android`) and rebuilt by `expo prebuild` (`package.json:9,15`; `scripts/build-release-apk.sh` runs `npx expo prebuild --platform android --no-install` under `.locks/gradle.lock`), so a manifest edit under `android/` does not survive (KI-21) | `git check-ignore -v apps/mobile/android` |
| Not known | which build (debug or release-signed) is installed on each emulator; the merged manifest of the debug variant is not in the build folder (only `release` exists under `merged_manifests/`) | F-A20 stays open |

## 8. Scripts, device-session targets and test harnesses

### 8.1 `apps/mobile/package.json` scripts (line numbers)

| Script | Command | Note |
|---|---|---|
| `dev` (:7) | `EXPO_NO_TELEMETRY=1 NODE_OPTIONS=--dns-result-order=ipv4first expo start --localhost --port 8081` | Metro on loopback, IPv4 first |
| `start:lane` (:8) | same with `--port ${METRO_PORT:-8081}` | lane model (P4) |
| `build` (:9) / `prebuild` (:15) | `expo prebuild --platform android --no-install` (+ `./gradlew assembleDebug` for `build`) | regenerates `android/` |
| `typecheck` (:10) / `lint` (:11) / `test` (:12) | `tsc --noEmit` / `eslint .` / `jest` | |
| **`e2e` (:13)** | `MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true "$HOME/.maestro/bin/maestro" ${ANDROID_SERIAL:+--device $ANDROID_SERIAL} test e2e/maestro` | **`apps/mobile/e2e` does not exist** (`ls apps/mobile/e2e`: no such file or directory); the Maestro binary path was not checked (outside the workspace) |
| `android` (:14) | `expo run:android` | |
| `doctor` (:16) / `deps:check` (:17) | `expo-doctor` / `expo install --check` | |
| **`reverse` (:18)** | `adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081` | only the mock-core and Metro ports; no other backend port |

### 8.2 `apps/mobile/scripts/device-session.sh` targets (476 lines; run outside the sandbox)

| Target | AVD | Serial | Lock | Source |
|---|---|---|---|---|
| `phone` | `dems_phone` | `emulator-5554` (console port 5554) | `.locks/dems_phone.lock` | `device-session.sh:129-130` |
| `phone2` | `dems_phone2` | `emulator-5558` (5558) | `.locks/dems_phone2.lock` | same |
| `tablet` | `dems_tablet` | `emulator-5556` (5556) | `.locks/dems_tablet.lock` | same |
| `both` | phone, then tablet | both serials | phone lock first, then tablet lock | `:114` and the outer `lockf` chain |
| `any-phone` | first free of phone, phone2 | picked | non-blocking `lockf -k -t 0` probes, repeated every 2 s until `LOCK_WAIT` | `pick_session` |
| `any` | first free of phone, phone2, tablet | picked | same | `pick_session` |

Other facts: `APP_ID=com.dems.demo.tablet` (:89); `LOCKS="$ROOT/.locks"` (:88); hard cap `DEVICE_SESSION_MAX_SECONDS` default 1800 (:120); a down AVD is booted cold with `-no-snapshot-load -no-snapshot-save` (:218-224), never killed; Metro lane port must be `808[1-9]` (:424); **reversed ports are hard-coded**: `PLANNED_REV="8081 4400"` or `"4400"` with `NO_METRO=1` (:238), `REVERSED="8081 4400"` (:449), `adb reverse tcp:8081 tcp:$METRO_PORT` and `adb reverse tcp:4400 tcp:4400` (:452-453), the `NO_METRO=1` branch (:457-459). The script sets React Native's `debug_http_host` through `run-as` so the app loads the bundle through the reverse rule (`set_bundle_host`, :402). Environment variables handed to `<commands>`: `SERIAL`, `ANDROID_SERIAL`, `AVD_NAME`, `SERIALS`, `APP_ID`, `METRO_PORT`, `METRO_LOG`, `ROOT`, `APP`, `SHOTS`. Exit codes: 64 usage, 69 device unavailable, 70 Metro or setup failed, 75 lock not acquired, 142 cap reached. Other scripts: `build-release-apk.sh` (release APK, signed with the demo key, refuses when `release/` or `signing/` is not git-ignored) and `create-demo-keystore.sh` (not opened).

### 8.3 Test harnesses

| Harness | File | What it provides | Used by |
|---|---|---|---|
| Jest config | `jest.config.js` | preset `jest-expo`, `setupFilesAfterEnv: ['./jest.setup.ts']`, transform allowlist for `@dems/.*`, `@noble/.*`, `victory-native`, `d3-.*` | all 72 test files (`find apps/mobile/src -name '*.test.ts' -o -name '*.test.tsx'`) |
| Jest setup | `jest.setup.ts` | mocks: worklets, AsyncStorage (in-memory mock), keyboard-controller, `expo-local-authentication` (hardware present, enrolled, success), `expo-haptics`, `expo-video` and more | all tests |
| Test simulator | `runtime/testing/test-sim.tsx:58-80` | `createTestSim()` (manual clock, manual scheduler, memory storage; `advance(ms)`), `renderWithRuntime`, `RuntimeTestProviders` (real `AppProviders` with a fake heartbeat socket), `FakeHeartbeatSocket`, `flushAsync`, `TEST_START` (2026-10-01 10:00 WIB) | 34 files construct a sim; 11 test files use `renderWithRuntime` or `RuntimeTestProviders` |
| Route harness | `navigation/testing/router-harness.tsx` | `FakeRuntime` (controllable auth and session; **guard tests do not use the simulator for auth**), `routeTestSim(state)` (drives a sim to IDLE, CREATE, PRECHECK or ARMED through `signIn(...)`, `createSession`, `beginPrecheck`), `renderApp`, `renderRoutes` | `navigation/__tests__/{guard,routes,back-guard}.test.tsx`, `features/dashboard/dashboard-route.test.tsx` |
| Feature harnesses (9) | `features/{audit,devices,evidence,network-time,session-finalizing,session-live,session-new,session-recovery,sessions}/testing/*-harness.tsx` | `renderAuditApp`, `renderDevicesApp`, `renderEvidenceApp`, `renderNetworkTimeApp`, `renderFlowApp`, `renderMonitorApp`, `renderSessionNewApp`, `renderRecoveryApp`, `renderSessionsApp`; each signs in with the **synchronous** `signIn(...)` and reads `.ok` (e.g. `monitor-harness.tsx:94`, `evidence-harness.tsx:67`, `audit-harness.tsx:99-100`), then `loadScenario(...)`; plus `*-test-setup.ts` files for module mocks | the feature screen tests |
| Maestro | `e2e/maestro` | **missing** (script points at it) | none |
| Demo credential in tests | `runtime/runtime.test.tsx:152,288`, `runtime/route-sync.test.ts:77`, `providers/runtime-contract.test.tsx:63` | harnesses use the `DEMO_OPERATOR_PASSWORD` constant; these four sites pass a demo password **literal** instead (value not recorded here) | grep |


## 9. The 140 files by group

How to read the tables. One row per file that matches `@dems/shared/sim` under `apps/mobile/src`; every file is in exactly one group (section 1, section 10.4). Columns: **Role** (file-name rule: `test`, `harness` = a `testing/` folder, `adapter` = `sim-adapter.ts`, `hook` = `use-*.ts(x)`, `pure model` = `*-model.ts`, `*.model.ts` or `*.math.ts`, `UI` = other `.tsx`, `module` = other `.ts`); **Hooks and direct handle** (hooks imported from the simulator, plus counted uses of the raw handle: `store.getState`, `store.subscribe`, `clock.now`, `ready` / `isReady` / `wasRestored`); **Selectors and views** (named selector, view and derive functions imported); **Other sim values** (constants, pure functions, classes, enums imported); **Inline slices read** (`s.<slice>` or `state.<slice>` on stripped code); **Actions called** (`SimActions` members invoked on `actions.`, `sim.actions.` or the biometric `auth.` argument; `signOut*` marks the contract's `useAuth().signOut`, which is not a simulator call); **Types** (count of type-only names imported). Test and harness rows list the setup actions they run. Source: `scan.mjs` over the 140 files (kept outside the repo); counts per group are in each heading.

The task asked for `src/app/` as a group. It has **0** matching files (34 route files, none imports the simulator), so it has no table; section 6 describes it. `features/home` also has 0 matches.

#### Group `runtime` (11 files: 7 production, 3 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `core-link.ts` | module | - | - | - | - | - | 1 |
| 2 | `debug.ts` | module | ready/isReady/wasRestored x1 | - | ScenarioName, sha256Hex | - | loadScenario | 1 |
| 3 | `index.ts` | module | - | - | - | - | - | - |
| 4 | `internals.ts` | module | - | - | - | - | - | 1 |
| 5 | `route-sync.test.ts` | test | store.getState x7 | selectPendingSummaryId | - | session | signIn, stopRecording, recover, acknowledgeSummary, inject, loadScenario | - |
| 6 | `runtime.test.tsx` | test | useSim, store.getState x4 | selectPrecheck | DEMO_OPERATOR_PASSWORD, createManualClock | tabletLink, session, audit, auth | signIn, createSession, beginPrecheck, stopRecording, loadScenario, setTabletLink | - |
| 7 | `sim-adapters.test.ts` | test | store.getState x7, ready/isReady/wasRestored x11 | selectElapsedMs | AUTH_STORAGE_KEY, createManualClock, ENGINE_INTERVAL_MS | tabletLink, session, sessionHistory, clock, auth | loadScenario, setTabletLink | 1 |
| 8 | `sim-adapters.ts` | module | createSim | - | SIM_STORAGE_KEY | - | - | 5 |
| 9 | `sim-runtime-provider.tsx` | UI | SimProvider, useSim, store.getState x2, ready/isReady/wasRestored x4 | selectPendingSummaryId | - | tabletLink, session | setTabletLink | 3 |
| 10 | `testing/test-sim.tsx` | harness | createSim | - | createManualClock | - | - | 5 |
| 11 | `use-audio-shared-values.ts` | hook | useAudioChannel, useSimInstance, store.getState x1 | - | - | audio | - | 1 |

Notes: Creates, provides and bridges the simulator. `sim-adapters.ts` builds it (`createMobileSim`), `sim-runtime-provider.tsx` owns hydration, the runtime contract, the heartbeat-to-tablet-link bridge and the banner, `debug.ts` loads `&scenario=` links and exposes `__DEMS_DEBUG__`, `use-audio-shared-values.ts` carries the 20 Hz channel, `core-link.ts` and `internals.ts` import types only, `index.ts` matches only in a comment. Detail: sections 3.4, 4.1, 10.1.

#### Group `providers` (1 files: 1 production, 0 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `app-providers.tsx` | UI | - | - | - | - | - | 1 |

Notes: `app-providers.tsx` imports the `Sim` type only; it passes an injected `sim` or `simOptions` to `SimRuntimeProvider`. Tree order: section 3.4.

#### Group `auth` (6 files: 4 production, 2 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `auth-dialogs.tsx` | UI | - | - | AUTH_IDLE_TIMEOUT_MS | - | - | - |
| 2 | `auth-provider.test.tsx` | test | store.getState x10 | - | AUTH_IDLE_TIMEOUT_MS | session, audit, auth | - | - |
| 3 | `auth-provider.tsx` | UI | useSim, useSimInstance, store.getState x4, ready/isReady/wasRestored x2 | selectLockout | - | operators, auth | signIn, signOut, touch | 2 |
| 4 | `biometric.test.ts` | test | store.getState x6 | - | - | audit, auth | signInWithBiometric, recordBiometricFailure | 1 |
| 5 | `biometric.ts` | module | - | - | - | - | signInWithBiometric, recordBiometricFailure | 1 |
| 6 | `operators.ts` | module | - | - | - | - | - | 1 |

Notes: Sign-in and biometric: table S1-1 to S1-3. `operators.ts` maps `SimOperator` to the contract operator; `auth-dialogs.tsx` uses `AUTH_IDLE_TIMEOUT_MS` for the idle-lock text. Section 4.2 and 4.3.

#### Group `navigation` (2 files: 0 production, 1 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `__tests__/chrome.test.tsx` | test | - | - | SOFTWARE_VERSION | - | - | - |
| 2 | `testing/router-harness.tsx` | harness | store.getState x1 | - | DEMO_OPERATOR_PASSWORD, PRECHECK_TOTAL_MAX_MS | session | signIn, createSession, beginPrecheck | 1 |

Notes: Only a test and a harness import the simulator. The guards read the runtime contract (`useAuth`, `useActiveSession`), not the simulator. `router-harness.tsx` holds `FakeRuntime` and `routeTestSim` (section 8.3).

#### Group `components` (2 files: 2 production, 0 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `composed/nav/nav-rail.tsx` | UI | - | - | SOFTWARE_VERSION | - | - | - |
| 2 | `kit/subject-type-chip.tsx` | UI | - | - | - | - | - | 1 |

Notes: `nav-rail.tsx` prints `SOFTWARE_VERSION`; `subject-type-chip.tsx` imports the `SubjectType` code as a type.

#### Group `features/audit` (10 files: 7 production, 2 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `audit-entry-detail.tsx` | UI | - | - | - | - | - | 1 |
| 2 | `audit-model.test.ts` | test | store.getState x5 | selectAuditChainBreak | FaultKind, OPERATORS | audit | signInWithBiometric, verifyAuditChain, inject | - |
| 3 | `audit-model.ts` | pure model | - | - | AuditCategory, FaultKind, Severity | - | - | 2 |
| 4 | `audit-row.tsx` | UI | - | - | - | - | - | 1 |
| 5 | `audit-screen.test.tsx` | test | store.getState x8 | selectAuditChainBreak | FaultKind | lastSealedSessionId, audit | verifyAuditChain, inject, clearFault, deviceCommand | - |
| 6 | `audit-screen.tsx` | UI | - | - | - | - | - | 1 |
| 7 | `audit-tones.ts` | module | - | - | - | - | - | 1 |
| 8 | `chain-strip.tsx` | UI | useSimActions, useSimInstance, store.getState x1 | - | - | clock | verifyAuditChain | 2 |
| 9 | `testing/audit-harness.tsx` | harness | store.getState x1 | - | DEMO_OPERATOR_PASSWORD, OPERATORS | session | signIn, signInWithBiometric, createSession, beginPrecheck, acknowledgePrecheckWarnings, startRecording, stopRecording | 2 |
| 10 | `use-audit-data.ts` | hook | useSim | selectAuditChainBreak | - | operators, audit | - | 1 |

Notes: Reads audit rows and the chain break; `chain-strip.tsx` calls `verifyAuditChain` (S1-7, S4-3). No adapter.

#### Group `features/dashboard` (6 files: 4 production, 2 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `dashboard-screen.test.tsx` | test | store.getState x4 | - | DEMO_OPERATOR_PASSWORD | session, alerts, auth | signIn, stopRecording, inject | - |
| 2 | `dashboard-screen.tsx` | UI | useSim | - | - | evidence | - | 1 |
| 3 | `home-header.tsx` | UI | useSim, useSimActions | selectClockSecond | - | - | acknowledgeAlert, signOut* | 1 |
| 4 | `home-model.test.ts` | test | - | - | - | - | - | 1 |
| 5 | `home-model.ts` | pure model | - | - | SubjectTypeLabel, startOfWibDay | - | - | 6 |
| 6 | `use-home-data.ts` | hook | useSim | selectActiveAlerts, selectDeviceStats, selectElapsedMs, selectPendingSummaryId, selectRecentSessions, selectSealedToday, selectStorage, selectUnacknowledgedAlertCount, systemStatus | startOfWibDay | session, cameras, mics, time, network, security, clock | - | 3 |

Notes: `use-home-data.ts` is the widest reader (11 selectors); `home-header.tsx` calls `acknowledgeAlert` and the contract `signOut` (`signOut*` = `useAuth().signOut`, not `sim.actions`).

#### Group `features/devices` (10 files: 7 production, 2 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `device-command-dialog.tsx` | UI | - | - | - | - | - | 1 |
| 2 | `device-detail.tsx` | UI | useSimActions | - | - | - | resetClip, runDiagnostics, deviceCommand | 2 |
| 3 | `device-mic-meter.tsx` | UI | - | - | - | - | - | 1 |
| 4 | `devices-model.test.ts` | test | store.getState x13 | - | DEMO_OPERATOR_PASSWORD, FaultKind, ScenarioName | audit | signIn, inject, loadScenario, deviceCommand, setTabletLink | 1 |
| 5 | `devices-model.ts` | pure model | - | - | - | tabletLink, session, cameras, mics, otherDevices | - | 1 |
| 6 | `devices-screen.test.tsx` | test | store.getState x4 | - | FaultKind | mics, audit | inject, clearFault, setTabletLink | - |
| 7 | `diagnostics-sheet.tsx` | UI | SimContext, useSim, useSimInstance | - | - | diagnostics | - | 2 |
| 8 | `sim-adapter.ts` | adapter | - | - | FaultKind | tabletLink, session, cameras, network, faults | - | 5 |
| 9 | `testing/devices-harness.tsx` | harness | - | - | DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName | - | signIn, loadScenario | 1 |
| 10 | `use-devices-data.ts` | hook | useAudioChannel, useSim | selectCan | Permission | tabletLink, session, cameras, mics, network, audit, faults | - | 3 |

Notes: `device-detail.tsx` calls `resetClip`, `runDiagnostics`, `deviceCommand` (S2-8, S3-2); `sim-adapter.ts` is pure reads (PoE book view, health series, mic sampler, device log), no action; permission by `selectCan(DEVICE_MANAGE)` (S5-4).

#### Group `features/evidence` (14 files: 10 production, 3 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `evidence-chips.tsx` | UI | - | - | - | - | - | 2 |
| 2 | `evidence-detail.test.tsx` | test | store.getState x5 | - | EvidenceStatus | evidence, audit | - | - |
| 3 | `evidence-detail.tsx` | UI | useSimActions, useSimInstance, clock.now x1 | - | - | - | archiveEvidence | - |
| 4 | `evidence-list-screen.tsx` | UI | useSimActions | - | - | - | archiveEvidence | - |
| 5 | `evidence-list.test.tsx` | test | store.getState x3 | - | EvidenceStatus | evidence | - | - |
| 6 | `evidence-model.test.ts` | test | store.getState x1 | - | EvidenceStatus | evidence | - | 1 |
| 7 | `evidence-model.ts` | pure model | - | - | EVIDENCE_STATUS_STAGE, EvidenceStatus, TRACK_ORDER, verifyEvidenceItem | - | - | 2 |
| 8 | `evidence-row.tsx` | UI | - | - | - | - | - | 1 |
| 9 | `export-sheet.tsx` | UI | useSimActions, useSimInstance, clock.now x1 | - | Permission, roleHas | - | exportEvidence | 1 |
| 10 | `integrity-tab.tsx` | UI | useSimInstance | - | - | - | - | 1 |
| 11 | `sheet-frame.tsx` | UI | SimContext, useSimInstance | - | - | - | - | - |
| 12 | `sim-adapter.ts` | adapter | clock.now x1 | - | verifyEvidenceItem | - | verify | 2 |
| 13 | `testing/evidence-harness.tsx` | harness | store.getState x1 | - | DEMO_OPERATOR_PASSWORD, OPERATORS | evidence | signIn | 1 |
| 14 | `use-evidence-data.ts` | hook | useSim | selectCan, selectEvidence, selectEvidenceById, selectOperator | Permission | operators | - | 2 |

Notes: `export-sheet.tsx` S1-5/S1-6 and S5-1; archive S3-1; `sim-adapter.ts` `recordCoreVerification` calls `verify` with the return ignored; integrity is computed on the device from bundled demo packages (`evidence-model.ts`, F-M20).

#### Group `features/login` (2 files: 1 production, 1 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `login-card.tsx` | UI | useSim | - | AUTH_IDLE_TIMEOUT_MS, DEMO_OPERATOR_PASSWORD, DEMO_PAIRING_CODE, OPERATORS, SOFTWARE_VERSION | pairing | - | 1 |
| 2 | `login.test.tsx` | test | store.getState x8 | - | AUTH_IDLE_TIMEOUT_MS, AUTH_LOCKOUT_MS, OPERATORS | session, audit, auth | - | 1 |

Notes: `login-card.tsx` reads `pairing` and prints seeded demo material (F-M11). The Login controller imports no simulator name: it uses the contract and the shared heartbeat context.

#### Group `features/more` (6 files: 5 production, 1 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `console-tiles.tsx` | UI | useSim | - | - | - | - | - |
| 2 | `more-boundary.tsx` | UI | useSim | selectClockSecond | - | - | - | - |
| 3 | `more-links.tsx` | UI | useSim | - | SOFTWARE_VERSION | - | - | - |
| 4 | `more-model.ts` | pure model | - | selectAuditChainBreak, storageSummary | - | pairing, session, storage, time, network, audit, auth | - | 1 |
| 5 | `more-screen.test.tsx` | test | store.getState x5 | - | DEMO_OPERATOR_PASSWORD | session, auth | signIn, inject | - |
| 6 | `operator-card.tsx` | UI | useSim | - | - | - | signOut* | - |

Notes: Read-only summaries of pairing, session, storage, time, network, audit and auth through `more-model.ts`; `operator-card.tsx` signs out through the contract.

#### Group `features/network-time` (3 files: 2 production, 0 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `network-time-model.ts` | pure model | - | - | - | tabletLink, time, network | - | 2 |
| 2 | `testing/network-time-harness.tsx` | harness | - | - | DEMO_OPERATOR_PASSWORD, OPERATORS | - | signIn | 1 |
| 3 | `use-network-time.ts` | hook | useSim | selectClockSecond | - | time, network, clock | - | - |

Notes: Reads `time`, `network`, `tabletLink` and the clock second; no action.

#### Group `features/pairing` (7 files: 5 production, 2 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `pairing-code-panel.tsx` | UI | - | - | PAIRING_CODE_LENGTH | - | - | - |
| 2 | `pairing-connection.tsx` | UI | useSim | - | - | - | - | 1 |
| 3 | `pairing-model.test.ts` | test | store.getState x4 | - | PairingState | audit | pair | - |
| 4 | `pairing-model.ts` | pure model | - | - | AUDIT_TYPE_CATEGORY, PairingState | pairing, audit, clock | - | 4 |
| 5 | `pairing-screen.test.tsx` | test | store.getState x4 | - | DEMO_OPERATOR_PASSWORD, DEMO_PAIRING_CODE, PairingState | pairing, audit, clock | signIn | 1 |
| 6 | `pairing-screen.tsx` | UI | useSim | - | - | - | - | - |
| 7 | `use-pairing-flow.ts` | hook | useSim, useSimActions, useSimInstance, store.getState x1, store.subscribe x2 | - | PAIRING_CODE_LENGTH | clock | pair, unpair | 2 |

Notes: S1-8, S2-5, F-M8; `pairing-model.ts` holds `PAIR_TIMELINE` and the pairing selectors; `pairing-code-panel.tsx` uses `PAIRING_CODE_LENGTH`.

#### Group `features/session-finalizing` (5 files: 3 production, 1 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `finalizing.model.test.ts` | test | - | - | - | - | - | 1 |
| 2 | `finalizing.model.ts` | pure model | - | - | - | - | - | 1 |
| 3 | `session-finalizing-screen.tsx` | UI | - | - | formatDuration | - | - | - |
| 4 | `testing/flow-harness.tsx` | harness | store.getState x2 | - | DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName | session | signIn, loadScenario | 1 |
| 5 | `use-finalizing.ts` | hook | useSim | - | - | session, lastSealedSessionId, lastSealedAcknowledged, clock | - | 3 |

Notes: Reads `session` finalization steps and `lastSealed*`; no action.

#### Group `features/session-live` (7 files: 6 production, 0 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `live-feed.tsx` | UI | - | - | - | - | - | 1 |
| 2 | `mic-card.tsx` | UI | - | - | - | - | - | 1 |
| 3 | `monitor-sheets.tsx` | UI | SimContext, useSimInstance | - | - | - | - | 2 |
| 4 | `session-live-screen.tsx` | UI | useSimInstance, store.getState x2, clock.now x1 | - | - | session | addMarker, snapshot, resetClip, setActiveCamera | - |
| 5 | `session-live.math.ts` | pure model | - | - | STOP_REASON_MIN_LENGTH | - | - | - |
| 6 | `testing/monitor-harness.tsx` | harness | - | - | DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName | - | signIn, loadScenario | 1 |
| 7 | `use-monitor.ts` | hook | useSim, useSimActions | selectCameras, selectMics, selectTimeline | SimTransitionError | session, activeCameraId, storage, time, clock | stopRecording, addMarker, snapshot, resetClip, setActiveCamera | 3 |

Notes: Monitor: S2-1, S4-2; 20 Hz audio through `useAudioSharedValues`; `session-live.math.ts` imports `STOP_REASON_MIN_LENGTH`.

#### Group `features/session-new` (13 files: 9 production, 3 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `check-icon.tsx` | UI | - | - | - | - | - | 1 |
| 2 | `device-previews.tsx` | UI | useSim, useSimActions | - | - | cameras | resetClip | 1 |
| 3 | `devices-check-step.tsx` | UI | - | - | - | - | - | 2 |
| 4 | `precheck.test.tsx` | test | - | - | OPERATORS, PRECHECK_ORDER, PRECHECK_TOTAL_MAX_MS | - | createSession, beginPrecheck, inject, clearFault, setTabletLink | - |
| 5 | `ready-step.tsx` | UI | - | - | - | - | - | 2 |
| 6 | `session-info-step.tsx` | UI | - | - | RECORDING_PROFILES, ROOMS | - | - | 2 |
| 7 | `session-new-model.test.ts` | test | store.getState x5 | - | DEMO_OPERATOR_PASSWORD, OPERATORS | sessionHistory | signIn, createSession | 2 |
| 8 | `session-new-model.ts` | pure model | - | - | PRECHECK_ORDER, roleHas | - | - | 7 |
| 9 | `session-new-screen.test.tsx` | test | - | - | OPERATORS, PRECHECK_TOTAL_MAX_MS, ScenarioName | - | createSession, beginPrecheck, loadScenario | - |
| 10 | `session-new-screen.tsx` | UI | useSimInstance, store.getState x1 | - | - | - | startRecording | - |
| 11 | `sim-adapter.ts` | adapter | - | - | caseNumberFor | meta, session, sessionHistory, clock | - | 1 |
| 12 | `testing/session-new-harness.tsx` | harness | store.getState x1 | - | DEMO_OPERATOR_PASSWORD, OPERATORS | audit | signIn | 2 |
| 13 | `use-session-new.ts` | hook | useSim, useSimActions | selectPrecheck | PRECHECK_ORDER, RecordingProfileId, evaluatePrecheck, signedInOperatorId | operators, session, sessionHistory, mics | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, cancel | 6 |

Notes: S1-4, S2-2, F-M6; `sim-adapter.ts` derives the next case number (S4-6); `evaluatePrecheck` runs on the device against the whole state (F-M20).

#### Group `features/session-recovery` (7 files: 4 production, 2 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `recovery.model.test.ts` | test | - | - | RECOVERY_MS, RECOVERY_SCAN_MS, SimPermissionError | - | - | - |
| 2 | `recovery.model.ts` | pure model | - | - | RECOVERY_MS, RECOVERY_SCAN_MS | - | - | 2 |
| 3 | `session-recovery-screen.test.tsx` | test | store.getState x11 | - | RECOVERY_MS | session, sessionHistory, evidence, alerts | inject | - |
| 4 | `session-recovery-screen.tsx` | UI | useSim | - | - | session | - | - |
| 5 | `sim-adapter.ts` | adapter | - | - | Permission, SimPermissionError, roleHas | - | recover | 3 |
| 6 | `testing/recovery-harness.tsx` | harness | store.getState x2 | - | DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName | session | signIn, createSession, beginPrecheck, inject, loadScenario | 1 |
| 7 | `use-recovery.ts` | hook | useSim, useSimActions, useSimInstance, store.getState x1, clock.now x1 | selectRole | SimPermissionError, SimTransitionError | session, sessionHistory, evidence, alerts, faults, clock | acknowledgeAlert | 5 |

Notes: S2-3; `sim-adapter.ts` is the client-side role gate (S5-2); milestones read `session.recovery` against the simulator clock.

#### Group `features/session-summary` (5 files: 4 production, 1 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `session-summary-screen.tsx` | UI | - | - | formatDuration | - | - | - |
| 2 | `sim-adapter.ts` | adapter | - | - | - | - | - | 1 |
| 3 | `summary.model.test.ts` | test | - | - | - | - | - | 2 |
| 4 | `summary.model.ts` | pure model | - | - | - | - | - | 1 |
| 5 | `use-summary.ts` | hook | useSim, useSimInstance, store.getState x1 | selectEvidenceBySessionId, selectOperatorById, selectPendingSummaryId, selectSessionHistoryById | - | session, time | acknowledgeSummary | 5 |

Notes: S2-4; `sim-adapter.ts` imports types only and reads `time.history` for the time-source badge.

#### Group `features/sessions` (6 files: 3 production, 2 test, 1 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `sessions-model.test.ts` | test | - | selectPendingSummaryId, selectSessionHistory | DEFAULT_SEED, SessionOutcome, createIdleState, startOfWibDay | - | - | - |
| 2 | `sessions-model.ts` | pure model | - | - | SessionOutcome, startOfWibDay | - | - | 4 |
| 3 | `sessions-screen.test.tsx` | test | store.getState x5 | - | SessionOutcome, SubjectTypeLabel, startOfWibDay | session, clock | inject, loadScenario | - |
| 4 | `sessions-screen.tsx` | UI | useSim, useSimInstance, store.getState x1 | - | - | clock | - | - |
| 5 | `testing/sessions-harness.tsx` | harness | store.getState x1 | selectSessionHistory | DEMO_OPERATOR_PASSWORD, OPERATORS | - | signIn | 1 |
| 6 | `use-sessions-data.ts` | hook | useSim | selectOperatorById, selectPendingSummaryId, selectSessionHistory, selectSessionHistoryById | startOfWibDay | session, clock | - | 1 |

Notes: History hub: `sessionHistory`, the pending summary id, operators; `sessions-screen.tsx` stamps refresh with the simulator clock (S4-5).

#### Group `features/settings` (8 files: 5 production, 3 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `about-section.tsx` | UI | useSim | - | - | device | - | 1 |
| 2 | `heartbeat-release-gate.test.tsx` | test | - | - | DEMO_OPERATOR_PASSWORD | - | signIn | - |
| 3 | `maintenance-section.tsx` | UI | useSim, useSimActions | selectActiveFaults, selectDiagnostics, selectUpdate | FaultKind, formatWibTime, ScenarioName, SimTransitionError | meta, session | recover, inject, clearFault, resetClip, loadScenario, runDiagnostics, startSoftwareUpdate | 2 |
| 4 | `security-section.tsx` | UI | useSim | - | - | pairing | signOut* | 1 |
| 5 | `settings-model.test.ts` | test | - | - | CRITICAL_FAULTS, FaultKind | - | - | - |
| 6 | `settings-model.ts` | pure model | - | - | AUTH_IDLE_TIMEOUT_MS, FaultKind, ROLE_PERMISSIONS, ScenarioName | - | - | 5 |
| 7 | `settings-screen.test.tsx` | test | store.getState x8 | - | DEMO_OPERATOR_PASSWORD | meta, mics, faults, diagnostics, auth | signIn | - |
| 8 | `sheet-frame.tsx` | UI | SimContext, useSimInstance | - | - | - | - | - |

Notes: `maintenance-section.tsx`: `useSimCommand` (S2-7) and the Demo controls (`inject`, `clearFault`, `loadScenario`, `recover`, `startSoftwareUpdate`, `runDiagnostics`); `security-section.tsx` shows the pairing row and the biometric switch and signs out through the contract; `settings-model.ts` imports `ROLE_PERMISSIONS` (S5-7).

#### Group `features/storage` (9 files: 7 production, 2 test, 0 harness)

| # | File (under `apps/mobile/src/`) | Role | Hooks and direct handle | Selectors and views | Other sim values | Inline slices read (`s.<slice>`) | Actions called | Types |
|---|---|---|---|---|---|---|---|---|
| 1 | `manage-storage-sheet.tsx` | UI | SimContext, useSimInstance | - | RetentionPolicyId | - | - | 1 |
| 2 | `sim-adapter.ts` | adapter | - | - | Permission, roleHas | events | - | 4 |
| 3 | `storage-activity.tsx` | UI | - | - | formatWibTime | - | - | 1 |
| 4 | `storage-kpis.tsx` | UI | - | - | GB | - | - | - |
| 5 | `storage-model.test.ts` | test | createSim, store.getState x1 | selectStorage | GB, TB | - | - | 1 |
| 6 | `storage-model.ts` | pure model | - | - | GB, RECORDING_BYTES_PER_HOUR, STORAGE_FULL_PERCENT, STORAGE_LOW_PERCENT, TB | - | - | 1 |
| 7 | `storage-screen.test.tsx` | test | store.getState x1 | - | DEMO_OPERATOR_PASSWORD | storagePolicy | signIn, inject | - |
| 8 | `storage-screen.tsx` | UI | useSimActions | - | - | - | setStoragePolicy | - |
| 9 | `use-storage-data.ts` | hook | useSim | selectEvidenceStats, selectStorage, selectStoragePolicy | - | session, storage | - | 2 |

Notes: `storage-screen.tsx` calls `setStoragePolicy` (S2-6); `sim-adapter.ts` is the role gate (S5-3) and the storage-activity filter.

## 10. Supporting inventories, re-check and open points

### 10.1 Each `sim-adapter.ts` (plus the runtime adapter file)

P6/P12 of the predecessor task kept screen steps from editing the shared simulator, so each feature bridged a simulator gap in a local `sim-adapter.ts`. Each header lists the gap it works around; that list is a map of where the simulator is not enough today.

| File | What it exports (graft skeleton) | Reads / writes | Gaps named in its header | Actions called |
|---|---|---|---|---|
| `runtime/sim-adapters.ts` | `createMobileSim`, `createAsyncStoragePersistStorage`, `createAppStateVisibility`, `isHiddenAppState`, `SIM_SNAPSHOT_KEY`, `MobileSimOptions` | creates the `Sim` with AsyncStorage persistence (`dems.sim.v1`), `authStorage: null`, `AppState` visibility (background or inactive pauses the engine and flushes the snapshot; active catches up) | none (platform adapters, `sim-adapters.ts:1-14`) | none |
| `features/devices/sim-adapter.ts` | `bookPoe`, `healthSeries`, `MicLevelSampler`, `micDevice`, `auditRowDevice`, `deviceLog`, `channelOf`, `seriesInputOf`, `CAMERA_POE_PORT_KEY` | pure reads of `network`, `cameras`, `tabletLink`, `session`, `faults`, audit rows; nothing written | SIM-GAP-M84-1 (4-port PoE model vs the book's 2 ports), M84-2 (no per-device health history; derived from 1 Hz bandwidth history; mic level sampled on the device), M84-3 (`deviceCommand` checks no permission) | none |
| `features/evidence/sim-adapter.ts` | `recordCoreVerification`, `CoreVerificationOutcome` | computes the simulator verdict with `verifyEvidenceItem(item, sim.clock.now())`, calls `verify(id)` only when it agrees with the bundled demo package | SIM-GAP-M83-1 (simulator evidence 0005 is not tampered; the demo package is), M83-2 (no per-evidence snapshots or markers) | `verify` (`:61`, return ignored) |
| `features/session-new/sim-adapter.ts` | `caseSeqOf`, `nextCaseSeq`, `nextCaseNumber` | derives the next case number from `meta.counters.caseNumber`, the active session and the history with `caseNumberFor` | SIM-GAP-1 ("no next case number selector and no action advances the counter"; note that `scanCaseNumber` exists in `types.ts:1024` but mobile does not call it) | none |
| `features/session-recovery/sim-adapter.ts` | `canStartRecovery`, `startRecovery`, `assertCanViewEvidence`, `recoverySignatureOf`, `RECOVERY_PERMISSION` | client-side `roleHas` gate, then `recover()` | SIM-GAP-M81-1 (no "recovered and sealed" outcome), M81-2 (`recover()` has no role check), M81-3 (no per-check recovery results), M81-4 (no FAULT scenario) | `recover` (`:52`) |
| `features/session-summary/sim-adapter.ts` | `timeSourceAt` | reads `time.history` for the time-source badge (type import only) | SIM-GAP-M80-1 (no time source per session instant) | none |
| `features/storage/sim-adapter.ts` | `isStorageEvent`, `selectStorageActivity`, `canManageStoragePolicy`, `STORAGE_EVENT_TYPES` | filters `events` by type; client-side role gate (`EVIDENCE_REVIEW` or `MAINTENANCE`) | SIM-GAP-M85-1 (no storage-activity selector), M85-2 (no role check on `setStoragePolicy`) | none |

Source: `graft skeleton` on five adapters (devices, evidence, session-recovery, session-summary, storage); the session-new adapter and `runtime/sim-adapters.ts` were read in full; header comments read for all seven. The runtime test `runtime/sim-adapters.test.ts` covers persistence, visibility and the auth-key assertion (`:83`).

### 10.2 Consumers that do not match `@dems/shared/sim`

These depend on the simulator through the runtime contract or a harness. They are outside the 140 but change behaviour when the data source changes.

| Contract hook | Production consumers (file:line under `apps/mobile/src/`) |
|---|---|
| `useAuth()` (`isAuthenticated`, `operator`, `signIn`, `signOut`) | `navigation/root-navigator.tsx:25,82,99`; `features/login/use-login-controller.ts:54`; `features/settings/settings-screen.tsx:38`; `features/settings/security-section.tsx:30`; `features/more/operator-card.tsx:25`; `features/pairing/pairing-screen.tsx:55`; `features/storage/storage-screen.tsx:54`; `features/dashboard/home-header.tsx:246` |
| `useAuthSession()` (lockout, biometric, idle lock) | `features/login/login-screen.tsx:52`; `features/login/use-login-controller.ts:55`; `features/settings/settings-screen.tsx:39`; `features/settings/security-section.tsx:31`; `features/more/operator-card.tsx:26`; `features/dashboard/home-header.tsx:247` |
| `useCoreLink()` | `features/login/use-login-controller.ts:56`; `features/session-live/use-monitor.ts:106`; `features/session-recovery/use-recovery.ts:186`; `features/more/more-links.tsx:153`; `features/dashboard/home-header.tsx:111` |
| `useActiveSession()` (state, sessionId, startedAtMs, summaryAcknowledged) | `navigation/app-tabs.tsx:62`; `navigation/root-navigator.tsx:83`; `navigation/stacks.tsx:38`; `navigation/session-guards.ts:21,41`; `runtime/session-route-sync.tsx:31`; `runtime/keep-awake.ts:86`; `features/session-new/use-session-new.ts:69` |
| `useRuntimeStatus()` (`ready`) | `providers/boot-gate.tsx:24`; `features/evidence/evidence-list-screen.tsx:164`; `features/audit/audit-screen.tsx:63`; `features/sessions/sessions-screen.tsx:156`; `features/devices/devices-screen.tsx:88` |
| `useConnectionBanner()` | `features/session-live/use-monitor.ts:105`; `features/session-recovery/use-recovery.ts:185`; `features/session-live/connection-banner.tsx:21` |
| `useCoreLinkSourceSetting()` | `features/settings/section-body.tsx:43`; `features/settings/preferences-section.tsx:27` |
| `useAudioSharedValues()` | `features/session-live/mic-card.tsx:41`; `features/session-new/device-previews.tsx:106`; `features/dashboard/device-tiles.tsx:124`; `features/devices/device-mic-meter.tsx:40` |

Tests and harness users that reach a simulator without importing it: `features/evidence/play-sheet.test.tsx`, `features/network-time/network-time-screen.test.tsx`, `features/session-finalizing/session-finalizing-screen.test.tsx`, `features/session-live/back-guard.test.tsx`, `features/session-live/session-live-screen.test.tsx`, `features/session-summary/session-summary-screen.test.tsx`, `features/dashboard/dashboard-route.test.tsx`, `motion/policy.test.tsx`, `navigation/__tests__/{back-guard,guard,routes}.test.tsx`, `providers/{app-providers,runtime-contract}.test.tsx`, `runtime/{session-route-sync,use-audio-shared-values}.test.tsx` (16 files). Source: grep for `renderXApp`, `renderApp`, `createTestSim`, `AppProviders` against the 140-file list (`comm -23`), then Read of the imports.

### 10.3 Other shared-package imports that matter for a Live source

| Package subpath | Matches in `apps/mobile/src` | What mobile takes from it |
|---|---|---|
| `@dems/shared/api` | 6 | `HEALTH_QUERY_KEY`, `fetchHealth` (`features/home/use-health.ts`, `providers/app-providers.tsx:8`); `CORE_HTTP_ORIGIN` (`features/login/login-model.ts:15,79`); `sessionCreateSchema`, `DEFAULT_SESSION_ROOM` (`features/session-new/use-session-new.ts:16-21`); `SESSION_INPUT_LIMITS` (`features/session-new/session-info-step.tsx:21`) |
| `@dems/shared/realtime` | 40 | `HeartbeatProvider`, `HeartbeatContext`, `useRetryCooldown`, `useHeartbeat` in 5 production files (`providers/app-providers.tsx:9`, `runtime/sim-runtime-provider.tsx:20`, `features/login/use-login-controller.ts:22`, `app/_layout.tsx:19`, `features/home/home-screen.tsx:9`); `SocketLike` in tests and harnesses; the rest are date and duration formatters and constants |
| `@dems/shared/demo-data` | 8 (6 imports, 2 comments) | bundled evidence packages and documents: `getDemoEvidencePackage`, `getDemoEvidenceDocuments`, `MANIFEST_FIELDS`, `DEMO_EVIDENCE_INDEX` (evidence feature, joined by the evidence number suffix) |
| `@dems/shared/domain`, `/tokens`, `/i18n`, `/brand` | 49 / 157 / 16 / 6 | types and presentation tokens; unaffected by the data source |
| `@dems/shared` (root barrel) | 0 (`from '@dems/shared'` has no match) | none |

The shared package's `exports` map has no `./client` or `./live` subpath (`packages/shared/package.json:6-21`); mobile resolves subpaths through package exports with no `paths` alias for `@dems/shared` (`apps/mobile/tsconfig.json`, `metro.config.js:1-9`). Source: grep counts `grep -rn "@dems/shared/<sub>" apps/mobile/src`.

### 10.4 Coverage re-check (run on the assembled report)

The controller can re-run this against the report file itself (shell only, no script needed). The first command lists the grep matches; the second lists the file rows of the section 9 tables (`awk` reads each `#### Group` heading and each table row); `diff` compares them.

```
grep -rl "@dems/shared/sim" apps/mobile/src | sed 's#^apps/mobile/src/##' | sort > a.txt
awk '/^#### Group `/{g=$3; gsub("`","",g)} /^\| [0-9]+ \| `/{split($0,x,"`"); print g "/" x[2]}' \
  docs/2026-10-04_dems_backend_rbac_pairing/research/01d_explore_mobile.md | sort > b.txt
wc -l < a.txt; wc -l < b.txt; diff a.txt b.txt && echo IDENTICAL; sort b.txt | uniq -d | wc -l
```

Result when run on 2026-10-04 (the `awk` ran on the assembled draft of this report before section 10.4 was filled in):

| Measure | Value |
|---|---|
| Files matching `@dems/shared/sim` (a.txt) | 140 |
| File rows in the group tables (b.txt) | 140 |
| `diff a.txt b.txt` | identical (no output; `IDENTICAL` printed) |
| Files in more than one group (`uniq -d`) | 0 |
| Files in a grep match but in no group / in a group but not in the grep | 0 / 0 (same result from the node cross-check `coverage.mjs`) |
| Group sizes (heading counts) | runtime 11, providers 1, auth 6, navigation 2, components 2, audit 10, dashboard 6, devices 10, evidence 14, login 2, more 6, network-time 3, pairing 7, session-finalizing 5, session-live 7, session-new 13, session-recovery 7, session-summary 5, sessions 6, settings 8, storage 9 = 140 |

Reading rule for the awk step: only the first backticked token of a table row is a file name, and the heading's second token is the group path, so `features/audit` plus `chain-strip.tsx` gives `features/audit/chain-strip.tsx`, which equals the grep path with `apps/mobile/src/` removed.

### 10.5 Gaps and items needing investigation

| ID | Gap | Why it is open |
|---|---|---|
| G-M1 | The selector-to-slice map and the action-to-slice map (what each of the 33 called actions writes) | row 1's output, not repeated here; this report maps mobile's usage only |
| G-M2 | Which build is installed on each emulator (debug or the release-signed 0.1.0), and whether `adb install -r` of a debug build works without an uninstall (H-B6, F-A20) | needs `adb`, which P7 forbids for this row |
| G-M3 | The merged manifest of the **debug** variant is absent from the build folder (only `release` exists under `merged_manifests/`), so the debug cleartext flag is read from the two source manifests, not from a merged one | the build folder is a git-ignored artifact; regenerate by a debug build |
| G-M4 | The Maestro binary path (`$HOME/.maestro/bin/maestro`) was not checked: it is outside the workspace and the task did not provide it | `package.json:13`; blueprint F-A20 and KI-02 |
| G-M5 | Reason-code i18n catalogues (`features/session-new/i18n.ts:35-36`, `features/evidence/i18n.ts:225`, `features/login/i18n.ts`) were sampled, not enumerated | would be needed to map every server error code to a message |
| G-M6 | `scripts/create-demo-keystore.sh` and everything under `apps/mobile/signing/` were not opened (P19) | by instruction |
| G-M7 | The 72 test files were classified by what they import and construct, not read assertion by assertion | scale; the blueprint's regression row will run them |
| G-M8 | The `home` feature (`/` and `/stack-check`) uses the live heartbeat and health calls; its screens were not mapped in detail | outside the 140; relevant only if the backend port changes (F-M15) |

### 10.6 Deviations, decisions needed and notes for the controller

- **Deviation 1 (count)**: the 140 includes one comment-only match (`runtime/index.ts:4`); 139 files import from the simulator. Both numbers are stated in section 1. No file was dropped.
- **Deviation 2 (group `src/app/`)**: the task names it; it has no matching file, so it has a note (section 6) instead of a table.
- **Deviation 3 (Graft refresh)**: every Graft call used `--no-refresh`, so the graph (a git-ignored folder) was not rewritten; the counts it returned equal the grep counts, so the index is current for these files.
- **Deviation 4 (tooling processes)**: short-lived read-only tools ran (`graft`, `grep`, `node`, `python3`); no Metro, emulator or `adb` was started (P7). Scratch files (`scan.mjs`, `scan.json`, `render.mjs`, `actions_lines.mjs`, intermediate tables) live in the session scratchpad and `$TMPDIR`, outside `apps/`, `packages/`, `release/` and `scripts/`.
- **Decisions needed**: none for this row. Two facts the specification rows must resolve rather than assume: (a) whether mobile Live mode keeps the synchronous `Sim` object contract (F-M1, F-M20, F-M21) or introduces an asynchronous action layer, which would touch the 27 production files named in tables S1 to S4 (F-M3 to F-M7, F-M9); (b) where the pairing gate sits (F-M14), since no predicate exists and the app holds no device credential module.
- **Record for `decisions/decisions.md` (suggestion, controller's call)**: mobile uses 33 of 42 actions; the nine unused ones need no mobile Live behaviour unless the plan adds a feature.
- **Security note (P19)**: no secret value is printed. `login-card.tsx:489,504,506` render seeded demo material and four test files pass a demo password literal (section 8.3); the values were not copied. Row 20 (security design review) should read those lines directly.

---
*Generated: 2026-10-04*
*Last Updated: 2026-10-04*
