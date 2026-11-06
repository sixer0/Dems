# `apps/mobile/src/runtime`

Up: [`src/`](../README.md)

## Purpose

The data source of the app and its wiring. The runtime runs the shared simulator store behind mobile adapters; in Live mode (the only source of a release build, D163, D199, D208) the same store is a replica of the Core server, fed by the Live typed client and the realtime socket. This folder holds the Core address (the one source of the Core origin), the Core link and its banner and notices, secure credentials, the owed sign-out, the refusal presenter, the camera stream transport, keep-awake, session route sync, the persistent runtime log and the debug-only hooks.

`index.ts` documents, in a table, what a screen imports for each need (link state, Core actions, direct operations, refusals, pairing gate).

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `camera-stream-transport.ts` | The ONE request of the live camera preview's stream. The preview stream `GET /preview/{token}` is `multipart/x-mixed-replace` |
| `connection-banner-live.test.tsx` | Test: After an outage the runtime's connection banner fell back to "offline" after showing "Resynced", although the Core link was ONLINE. It showed in jest when wall-clock time passed during the outage with ... |
| `connection-banner.ts` | Connection banner logic. The banner is the app-wide answer to "is the Core link up?" |
| `contract.ts` | The runtime contract of the mobile app. What it is: the typed surface the navigation shell and every screen build against. The names and types of step 68 are kept; step 73 only added optional members, so fakes built ... |
| `core-address-live.test.tsx` | Test: The runtime's one source of the Core origin, end to end. A changed Core server address moves every way the app reaches the Core: the typed client (HTTP), the Live socket (WS), the media transport and the ... |
| `core-address.test.ts` | Test: The runtime's one source of the Core origin (`./core-address.ts`). |
| `core-address.ts` | The Core server address of this device. THE ONE SOURCE OF THE CORE ORIGIN. The Live source's adapters (`sim-adapters.ts`) build the typed client, the Live socket and the media transport from ... |
| `core-clock.test.ts` | Test: Tests "createCoreClock". |
| `core-clock.ts` | The Core server's "now" for a display that must keep up with it. |
| `core-errors.ts` | The refusal presenter of the mobile app. One place words what a Live action can reject with, so a refusal reads the same on every screen. |
| `core-link.ts` | The Core link. - **SIMULATED (retired on this device):** the in-app simulator is the Core. The link is the simulator's `tabletLink` (CONNECTED → ONLINE), which demo controls can drop (`setTabletLink('OFFLINE')`). |
| `debug.ts` | Debug-build hooks of the runtime (never active in a release build: all are gated on `__DEV__`). |
| `dems-live-console-static.test.ts` | Test: The `[DEMS-LIVE]` request line of the Live typed client is a development-console line only. Its guard must contain a literal `__DEV__` test, so Metro folds the line away in a release bundle by ... |
| `dev-probes.ts` | Debug-build device probes. NEVER part of a release build: the only reference to this module is the `require` inside the `if (__DEV__)` block of `runDevProbeFromUrl` in `./debug.ts`, which Metro removes from a release ... |
| `ended-link.test.tsx` | Test: Tests "the mapping (pure)". |
| `ended-link.ts` | A run the Core ended ON PURPOSE is no outage. When the Core revokes this device (close 4403) or ends the session of its socket (close 4401), the socket client of `@dems/shared/realtime` goes to its ENDED phase: no ... |
| `foreign-session-signal.ts` | Signal "a session of the Core changed, and this device does not follow it". |
| `index.ts` | Public surface of the runtime, with the table of what a screen imports for each need. |
| `internals.ts` | Runtime internals shared by the runtime's own components (route sync, auth, debug hooks) |
| `keep-awake.ts` | Keep-awake during a session. The `dems-session` tag is held while the session is PRECHECK, ARMED, RECORDING, STOPPING or FINALIZING, and released otherwise. Two holders use one manager: - the runtime's own controller ... |
| `link-notice-static.test.ts` | Test: No production file under `apps/mobile/src/features/**` writes a rule of its own for the "Core server unreachable" notice. The one rule is `runtime/link-notice.ts`; a screen calls ... |
| `link-notice.test.ts` | Test: The one view of the Core link and the one rule of the "Core server unreachable" notice. The static rule over `features/**` is `link-notice-static.test.ts`. |
| `link-notice.ts` | The Core link as a screen reads it, and the ONE rule for the "Core server unreachable" notice of LIVE mode. Before this file the rule lived twice, over two representations of the same link: the Pair screen over the ... |
| `live-core-errors.test.tsx` | Test: The refusal presenter. What a rejected Core action reads as on the tablet. |
| `live-core-link.test.tsx` | Test: `LIVE` as a Core link source, the banner rule, and the debug parameter `core=`. |
| `live-device.test.tsx` | Test: The app's Live source with its adapters (`createMobileLive`), mounted by the real `AppProviders`, over the contract-checked fake transport. The secure store is the in-memory one of `jest.setup.ts`. |
| `live-health.test.tsx` | Test: The health call of Stack Check. In LIVE mode the screen reads operation 1 `getServiceHealth` of the Core server through the typed client of the Live source; in the other modes it reads mock-core, as ... |
| `live-no-raw-fetch.test.tsx` | Test: NO RAW REQUEST TO THE CORE SERVER'S ORIGIN anywhere in the app. Why: React Native's socket sends, on the upgrade, whatever cookie the app's store holds for the host, and the Core server ... |
| `live-resync-watch.ts` | When the Live source's store holds what a RESYNCED signal is about. Used by `SessionRouteSync` for its heartbeat resync in LIVE mode. The socket client reports RESYNCED as soon as it has handed the snapshot to the ... |
| `live-runtime.test.tsx` | Test: The mobile runtime with its three Core link sources. What is rendered: the real `AppProviders` (so `SimRuntimeProvider` sits where it sits in the app, under `HeartbeatProvider` and above ... |
| `live-screens.test.tsx` | Test: The two screens an unpaired tablet can open in LIVE mode, drawn on the Live source's replica. This row changes the runtime, not the screens: the Pair screen is the pairing row's, the Stack Check ... |
| `live-settings.test.tsx` | Test: What MD-3 does to a screen this row does not write. Settings → App Preferences builds its "Core link source" control from `CORE_LINK_SOURCES`, and since 2026-11-05 that list is LIVE only: the device ... |
| `live-stall-link.test.ts` | Test: Tests "createMobileLive: a 3.5 s JS stall while the Core keeps beating". |
| `log-console.test.ts` | Test: In a debug build React Native's LogBox turns every `console.warn` into the "Open debugger to view warnings" toast over the bottom of the screen (nearly every capture of the ... |
| `log-flush-timer.test.ts` | Test: The runtime log's debounced flush timer must not keep a Node process alive. Before the fix the 2 s timer of a log that had just been written held the jest worker open after its suites ended ("A worker process ... |
| `log-media-token.test.ts` | Test: Log-blanking list 2 of 2, the mobile runtime log. A signed media URL of operation 88 that reaches a record - in its message, its stack or its context - is stored with the token blanked ... |
| `log.test.ts` | Test: The persistent runtime log: structured records, privacy filter, debounced AsyncStorage writes, ring capacity, one-time load, and the motion/navigation/simulator sinks routed into it. |
| `log.ts` | Runtime issue log: structured, persistent (`dems.mobile.log.v1`), privacy-filtered. |
| `owed-sign-out.test.ts` | Test: The tablet's owed-sign-out port (`./owed-sign-out.ts`) on the real wrapper `./secure-credentials` and the in-memory secure store of `jest.setup.ts` (TS-16). |
| `owed-sign-out.ts` | The tablet's owed-sign-out port. The mobile twin of the web console's `apps/core-web/src/runtime/owed-sign-out-storage.ts` |
| `pairing-gate-snapshot.test.ts` | Test: Tests "the snapshot (pure)". |
| `pairing-gate-snapshot.ts` | The pairing gate outside React. Expo Router hands every system URL to `src/app/+native-intent.tsx` BEFORE routing, outside the component tree, so the hook `usePairing()` cannot answer there. While the gate holds ... |
| `pending-control.test.tsx` | Test: One `busyState` and one in-button spinner for every pending control, beside `usePendingPress` in the runtime. Start Session and Devices each had their own copy; both now take these. 1. |
| `pending-control.tsx` | The look of a pending control: the visual half of `usePendingPress` (`use-pending-press.ts`). |
| `probe-failure.test.ts` | Test: One slow or timed-out probe or keep-alive is never an outage by itself, and an expected state of the link is never an `error`. |
| `probe-failure.ts` | Background probes and keep-alives in LIVE mode: one slow or timed-out answer is never an outage by itself. What happened: the Core answered the keep-alive `POST /api/v1/auth/touch` in 28 ms, but the app's JS thread ... |
| `recording-elapsed.ts` | The recording time every screen draws. SIMULATED and HEARTBEAT: the simulator's store clock (`selectElapsedSeconds`), as before. LIVE: under host load the phone held one value for 5-21 s while the Core recorded, then ... |
| `resync-bus.ts` | A tiny signal for "the Core link came back" (04_mobile_specs §5.5: the heartbeat client's `onResync` → `SessionRouteSync.resync()`). |
| `route-sync.test.ts` | Test: The state-routed resync table, row by row, plus the forced-transition rule and the table applied to the real simulator's states. |
| `route-sync.ts` | State-routed resync, the pure part. `resyncTarget(state, context)` is the §3.7 table. The table itself lives once, in the navigation shell's `sessionResyncHref`, which the boot router already uses for the ... |
| `runtime.test.tsx` | Test: SimRuntimeProvider: the hydration gate, the Core link in both modes with the connection banner, keep-awake and the debug-build `&scenario=` deep links. |
| `secure-credentials.test.ts` | Test: The secure-store wrapper. The store is the in-memory mock of `jest.setup.ts` (TS-16), reached through its two globals: this file does not name the package. Every value below is an obviously fake ... |
| `secure-credentials.ts` | Secure storage of the Live-mode credentials. THE ONE MODULE THAT IMPORTS `expo-secure-store`. |
| `secure-store-import.test.ts` | Test: The secure-store package is imported by exactly one file under `apps/mobile/src/`, the wrapper `runtime/secure-credentials.ts`. |
| `session-diagnostics.test.tsx` | Test: No fix, the diagnostics W98 needs to tell a blocked JS thread from dropped deltas. One quiet `runtime.diag.sessionWindow` record per session-state transition: the JS-lag summary ... |
| `session-diagnostics.ts` | Session-window diagnostics for the release-build measurement W98. RF2-2. |
| `session-route-sync-live.test.tsx` | Test: On a Live reconnect `SessionRouteSync` must resync with the session the Core's snapshot brought, not with the session rendered before the outage. The Live source applies the snapshot and emits ... |
| `session-route-sync.test.tsx` | Test: SessionRouteSync: forced navigation only on a heartbeat resync and on simulator-driven flow transitions; never on mount, never for a plain state change. |
| `session-route-sync.tsx` | `SessionRouteSync`, mounted by `(app)/_layout.tsx`: routes to where the session state belongs after a resync. |
| `signed-out-landing.test.ts` | Test: Tests "signedOutLandingFor: the top screen once (app) is gone". |
| `signed-out-landing.tsx` | After a sign-out, the boot router picks the screen. Mounted by `src/app/_layout.tsx` beside the root navigator. The root navigator's guard removes `(app)` when the operator is signed out (Sign Out, idle expiry, Lock ... |
| `sim-adapters.test.ts` | Test: The mobile simulator adapters — AsyncStorage round trip, no tick before hydration, AppState pause and resume. Uses the AsyncStorage 2.2.0 jest mock (jest.setup.ts) and the shared engine through ... |
| `sim-adapters.ts` | Platform adapters that feed the shared simulator on React Native. The simulator core is reused, not forked: this file only supplies the adapters `createSim` accepts. |
| `sim-runtime-provider.tsx` | `SimRuntimeProvider`: the simulator or Live source, hydration gate, Core link, connection banner and keep-awake; `useMobileLive()`. |
| `stall-tolerant-timers.test.ts` | Test: Tests "the device picture, modelled: a 3.5 s JS stall while the Core keeps beating". |
| `stall-tolerant-timers.ts` | Timers that let the event queue go first after the JS thread was held up. |
| `use-audio-shared-values.test.tsx` | Test: The transient meter path: 20 Hz audio frames land in Reanimated shared values with zero React renders; the debug overlay counts frames; the accessible value updates at most once per second. |
| `use-audio-shared-values.ts` | The transient meter path: zero React renders per audio frame. The simulator ticks audio at 20 Hz on the JS thread (`meterFrameMs` 50). |
| `use-core-link-notice.test.tsx` | Test: The first render of the "Core server unreachable" notice is seeded from the runtime's own knowledge, the app's connection banner, so a screen first opened while the socket reconnects after an outage shows the ... |
| `use-core-link-notice.ts` | The "Core server unreachable" notice of a screen in ONE call, built on row M0's one rule. ```ts const { view, offline } = useCoreLinkNotice(); ``` - `offline` |
| `use-core-link-read-only.test.tsx` | Test: ONE runtime helper for "session actions are read-only while the Core link is down", shared by the Session Monitor and Recovery, which each held a copy. 1. |
| `use-core-link-read-only.ts` | "Session actions are read-only while the Core link is down" in ONE call. The Session Monitor and Recovery each held a copy of this rule; 04_client_integration_spec §3.5 names both screens. ```ts const readOnly = ... |
| `use-pending-press.test.tsx` | Test: The ONE pending-press hook of the mobile app, in the runtime. LB-1, AC-C-57, AC-C-58: busy at once, the spinner after `LIVE_PENDING_REVEAL_MS` on the store's clock, a second press ignored while the command is ... |
| `use-pending-press.ts` | "Busy at once, spinner late" for one control whose press sends a Core command. Built by row W67 for Start Session and moved here by row M1, so every mobile page row takes the ONE hook through `@/runtime` instead of ... |

## Main exports

- Public surface (`index.ts`): `IDLE_SESSION`, `PAIRING_CHECKING`, `PAIRING_NOT_REQUIRED`, `RUNTIME_IMPLEMENTATION`, `RuntimeContractProvider`, `SIMULATED_ONLINE`, `UNAVAILABLE_AUTH`, `createRuntimeContract`, `initialsFor`, `isPairingBlocked`, `useActiveSession`, `useAuth`, `useCoreLink`, `usePairing`, `useRuntime`, `useRuntimeStatus`, `SimRuntimeProvider`, `decideCoreLinkSource`, `logSimError`, `selectActiveSessionInfo`, `simulatorLinkSource`, `useMobileLive`, `useMobileLiveRuntime`, `DEVICE_CREDENTIAL_OPERATIONS`, `FALLBACK_DEVICE_NAME`, `LIVE_CLIENT_REPORT_INTERVAL_MS`, `MOBILE_SECRETS_BUDGET_MS`, `SIM_SNAPSHOT_KEY`, `createAppStateVisibility`, `createAsyncStoragePersistStorage`, `createDeferredPersistStorage`, `createMobileLive`, `createMobileSim`, `createMobileSocketFactory`, `isHiddenAppState`, `liveDeviceDescription`, `logLiveReport`, `mobileLiveOf`, `pairingNoticeOf`, `AUDIO_A11Y_INTERVAL_MS`, `AUDIO_A11Y_MAX`, `AUDIO_A11Y_MIN`, `AUDIO_FLOOR_DBFS`, `audioAccessibilityValue`, `useAudioAccessibilityValue` and 134 more.
- Hooks: `useConnectionBanner`, `useRuntime`, `useAuth`, `useCoreLink`, `useActiveSession`, `useRuntimeStatus`, `usePairing`, `useCoreAddress`, `useCoreAddressKey`, `useCoreAddressSetting`, `useCoreErrorPresenter`, `useCoreLinkSource`, `useCoreLinkSourceSetting`, `useDebugScenarioLinks`, `useDebugHandle`, `useNoticeLiveLink`, `useRuntimeInternals`, `useRecordingTickerSeconds`, `useRecordingElapsedSeconds`, `useRecordingLocalOrigin`, `useLateStopHandoverMark`, `useSessionRanHere`, `useMobileLive`, `useMobileLiveRuntime`, `useConnectionBannerState`, `useAudioSharedValues`, `useAudioAccessibilityValue`, `useCoreLinkNotice`, `useCoreLinkReadOnly`, `usePendingPress`.
- Components: `RuntimeContractProvider`, `KeepAwakeController`, `PendingSpinner`, `SessionDiagnostics`, `SessionRouteSync`, `SignedOutLanding`, `SimRuntimeProvider`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectActiveSessionInfo`, `selectCan`, `selectElapsedSeconds`, `selectIsSignedIn`, `selectOperator`, `selectPendingSummaryId`, `selectTabletLink`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `loadScenario`, `setTabletLink`, `signOut`.
- Operations called directly on the Live client (`useMobileLive()?.client.call`): `getDeviceRegistration` (`sim-adapters.ts`), `getServiceHealth` (`dev-probes.ts`), `getStorageStatus` (`dev-probes.ts`), `unpairDevice` (`sim-adapters.ts`).

Core origin: `core-address.ts` is the one source. `sim-adapters.ts` builds the Live typed client (HTTP), the Live socket (WS) and the media transport from `coreOriginOf(getCoreAddress())`; `camera-stream-transport.ts` takes its origin from that media transport. Default `127.0.0.1:4420`; a changed address deletes the device credential, the owed sign-out and the stored snapshot first (D263, D265, row 236). The debug-only `dev-probes.ts` keeps its own constants.

## Tests

39 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D169: row 170: `core-link.ts` availability.
- D188: row 172: `debug.ts` source switch.
- D199: row 174: `createMobileLive` in release builds.
- D208: row 175: release offers Live only.
- D211: row 224: `owed-sign-out.ts`, `secure-credentials.ts`.
- D216: row 195: live preview built.
- D217: row 195: raw fetch guard.
- D218: row 195: `camera-stream-transport.ts`.
- D250: row 234: `sim-runtime-provider.tsx` import.
- D263: Core server address setting.
- D265: row 236: `core-address.ts`, the single Core origin.
