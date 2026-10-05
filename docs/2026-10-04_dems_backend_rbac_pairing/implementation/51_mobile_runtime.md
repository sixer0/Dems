---
task_slug: dems_backend_rbac_pairing
step: 73
plan_row: W51
date: 2026-10-04
agent: coder-execution
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
tier: 3
status: needs-review
---

# 51. Mobile runtime: LIVE as the third Core link source (step 73, W51)

Sources: `masterplan/04_client_integration_spec.md` rev 2.2 [CS], `implementation/44_live_source.md`
§17.4 (the brief list, rows 8 to 15, 20, 25 to 27), `implementation/15_secure_store_wrapper_probe.md`,
`implementation/12_typed_client_emulator_proof.md` §17.4, decisions D69, D71, D81.

## 1. Result at a glance

**Status: needs-review.** The runtime is built, tested, checked by mutation and run on the lane's
emulator against the real Core server. ONE item of the row's verification is not met, and it
cannot be met inside the row's write paths: **on the Pair screen the chip still reads `SIMULATED`
in LIVE mode.** Its text is hard-wired in `apps/mobile/src/features/pairing/pairing-connection.tsx:162`
(`t('mobile.pairing.simulated')`), a file of the pairing row's folder (W57), which this row may
not write (P6). The runtime side is there: `useCoreLink().source` is `LIVE` and the text
`mobile.pairing.live` ("LIVE") is in the resources. The change is one line (finding F-1, decision
DN-1). Everything else is done.

| Item | Result | Evidence |
|---|---|---|
| `npm run test -w @dems/mobile -- --maxWorkers=2` | exit 0: **82 suites, 992 tests** (19:44 to 19:45 WIB). Baseline at 18:07: 74 suites, 870 tests. This row adds 8 files and 122 tests | `assets/51_gate_final.log`, `51_baseline.log` |
| `npm run typecheck -w @dems/mobile`, `npm run lint -w @dems/mobile` | exit 0, exit 0 (19:45) | `assets/51_gate_final.log` |
| The existing runtime and provider tests | Unchanged: the 74 test files that existed at the start have the same `git hash-object` before and after; `git diff --stat acaff20` over the test files of `acaff20` prints nothing | Section 5.3 |
| The three sources and the release fallback | New tests: `live-core-link.test.tsx` (37), `live-runtime.test.tsx` (11) | Section 5.4 |
| Nothing of the Live layer starts with another source | `fetch` and the socket constructor of the runtime, both replaced by the fake transport: 0 requests, 0 sockets with SIMULATED and with HEARTBEAT, with a stored LIVE in a release build, and with a build that holds no Live source | `live-runtime.test.tsx` |
| Static test "no raw request to the Core server" (D69) | Passes (7 tests); one named exemption, the debug probe | `live-no-raw-fetch.test.tsx`; finding F-4 |
| Single importer of the secure-store package (AC-C-66) | The existing test passes unchanged | `secure-store-import.test.ts` |
| Release gate | Metro's release transform: `createMobileLive` is `return null`, `sim-adapters.ts` loads none of the Live modules, `core=` is an empty function, no probe. A real release bundle: 0 lines with the probe texts, 0 with the Live source, the typed client, the adapters' body or the wrapper | Section 5.7 |
| Mutation check | **100 single changes of the row's production files, 100 detected** (final run, 19:32 to 19:44, on the finished tree). A first run of 89 detected 81: each of the eight survivors showed a test that asserted too little, or an untested line; tests were added, none was weakened | Section 5.6 |
| Device check (lane 1, `dems2_phone`, 19:28:02 to 19:28:51) | The app ran in LIVE mode against `127.0.0.1:4421` (`dems_lane_1`): an anonymous socket, three requests, the same request IDs in the device log and in the server log, no credential in either. Stack Check shows the Core server's heartbeat and its version `0.2.0`. **The Pair chip reads `SIMULATED`** (above). Afterwards: no reverse rule, the app stopped and back in Simulated mode, the backend stopped, no listener | Section 6 |
| Device security | `emulator-user-lock.sh status` printed the same three lines at 18:07 and at 19:29: no keyguard, `CredentialType=NONE`, fingerprint count 0. Nothing was typed, no setting was changed | `assets/51_lock_status_start.txt`, `51_lock_status_end.txt` |
| The controller's note during the row (decisions D118, D116) | Built and tested: the biometric sign-in and the credential rotation always carry the device credential; `DEVICE_NOT_PAIRED` never touches the pairing; nothing is sent with a credential after `DEVICE_REVOKED`; a 429 on redeem is a limit | Section 7 |


## 2. Files

| File | Kind | What |
|---|---|---|
| `apps/mobile/src/runtime/contract.ts` | changed | `CoreLinkSource` gains `LIVE`; `RuntimeImplementation` gains `live`; the optional contract member `pairing` (MP-9) with `PairingInfo`, `PairingGateState`, `PairingNotice`, `PAIRING_NOT_REQUIRED`, `PAIRING_CHECKING`, `isPairingBlocked` (MP-11), `usePairing()` |
| `apps/mobile/src/runtime/core-link.ts` | changed | MD-3: `CORE_LINK_SOURCES` has three entries; `isCoreLinkSourceAvailable` is "SIMULATED, or a debug build"; the parser reads `LIVE`; `coreLinkStateFor` has the LIVE case; `getCoreLinkSource()` |
| `apps/mobile/src/runtime/connection-banner.ts` | changed | The transient rule of `nextBannerKind` covers LIVE |
| `apps/mobile/src/runtime/debug.ts` | changed (R-PRE) | MD-7: `coreSourceFromUrl`, `applyLaunchCoreSource`, `resetDebugLaunchForTests`; `scenario=` is ignored and logged in LIVE mode |
| `apps/mobile/src/runtime/sim-adapters.ts` | changed | The adapters of the Live source: `createMobileLive`, `mobileLiveOf`, `createMobileSocketFactory`, `liveDeviceDescription`, `pairingNoticeOf`, `logLiveReport`, `createDeferredPersistStorage`, `DEVICE_CREDENTIAL_OPERATIONS`; `MobileSimOptions.storageAllowed` |
| `apps/mobile/src/runtime/sim-runtime-provider.tsx` | changed | Chooses the source; mounts the Live source; the heartbeat context of LIVE; the `pairing` member; the role notice; `useMobileLive()`, `useMobileLiveRuntime()`, `decideCoreLinkSource()`, `simulatorLinkSource()` |
| `apps/mobile/src/runtime/core-errors.ts` | new | The refusal presenter: `describeCoreError`, `useCoreErrorPresenter`, `requiredRoleFor`, `createCoreErrorCoalescer` |
| `apps/mobile/src/runtime/index.ts` | changed | Barrel exports of the above |
| `apps/mobile/src/features/home/use-health.ts` | changed | Stack Check: in LIVE mode operation 1 through the typed client |
| `apps/mobile/src/i18n/en.mobile.ts` | changed | 20 new keys: `mobile.pairing.live`, `mobile.coreLink.source.LIVE`, `mobile.live.roleChanged`, and 17 under `mobile.live.refusal.*`. No existing key changed |
| `apps/mobile/src/runtime/live-core-link.test.tsx` | new test | The three sources, the release fallback, the banner rule, the `pairing` member, `core=`, `scenario=` in LIVE |
| `apps/mobile/src/runtime/live-runtime.test.tsx` | new test | The provider with the three sources, built from the preference, on the installed fake transport |
| `apps/mobile/src/runtime/live-device.test.tsx` | new test | The adapters: pairing state at start, credentials from memory, revocation, unknown credential, role change, offline, limit, foreground, the secrets port |
| `apps/mobile/src/runtime/live-core-errors.test.tsx` | new test | The refusal presenter |
| `apps/mobile/src/runtime/live-health.test.tsx` | new test | The health call of Stack Check in LIVE and in SIMULATED |
| `apps/mobile/src/runtime/live-screens.test.tsx` | new test | The Pair screen and Stack Check draw on the Live replica of an unpaired tablet |
| `apps/mobile/src/runtime/live-no-raw-fetch.test.tsx` | new test | Static: no raw request to the Core server's origin (D69) |
| `apps/mobile/src/runtime/live-settings.test.tsx` | new test | The Settings control with LIVE in the source list (finding F-6) |

Not changed, as the row requires: `secure-credentials.ts`, `dev-probes.ts`, `internals.ts`,
`providers/app-providers.tsx`, every feature folder but `features/home/use-health.ts`,
`packages/shared`, `package.json`, the native project, every existing test file.

## 3. What was built

### 3.1 Three Core link sources, one data source per mount (MD-3, MD-5)

| | SIMULATED, HEARTBEAT | LIVE (debug builds only) |
|---|---|---|
| Data source | The simulator (`createMobileSim`) | The app's Live source (`createMobileLive`); the simulator is not started, its snapshot is neither read nor written |
| `HeartbeatContext` below the provider | The mock-core client of `HeartbeatProvider` | The heartbeat view of the Live source's one socket (CL-7). The mock-core client is stopped while a Live source is mounted and started again on leaving LIVE |
| `coreLink` | As before | `{ source: 'LIVE', state, heartbeat }`; the state is ONLINE while that heartbeat is LIVE |
| `status` | `ready` after the snapshot and the preference hydrated; `implementation: 'simulator'` | `ready` after the stored device credential was read (MP-10 step 1), without waiting for the Core server; `implementation: 'live'` |
| `pairing` (MP-9) | Absent (`usePairing()` gives `PAIRING_NOT_REQUIRED`) | `{ required: true, state, notice, deviceId }`: CHECKING, then UNPAIRED or PAIRED |
| Tablet link bridge (S4-7) | HEARTBEAT only, as before | Inactive |
| Resync signal on the bus | `HeartbeatProvider`'s `onResync`, as before | The Live socket's RESYNCED event |

**How the source is chosen.** `SimRuntimeProvider` reads the Core link preference
(`useCoreLinkSource`). An injected `sim` (tests) is used as it is: a simulator runs the simulator
runtime whatever the preference says (the link then never reads LIVE, `simulatorLinkSource`), a
Live source built by `createMobileLive` runs the Live runtime. Without an injected source the
provider builds one: a Live source when `effectiveCoreLinkSource(preference)` is LIVE, else the
simulator. Crossing the LIVE boundary unmounts one source and mounts the other (a React key per
source); SIMULATED ↔ HEARTBEAT keeps the simulator, as before.

**The first frame of a cold start (MD-5).** The stored preference is read asynchronously, and the
existing provider test renders its children in the first frame with a simulator. So in a debug
build the simulator object of the first frame gets a snapshot storage that waits for the source
decision (`createDeferredPersistStorage`, `decideCoreLinkSource`): the stored preference, then the
launch URL's `core=` parameter. Decision "not LIVE": the storage is used as if the wrapper were
not there. Decision LIVE: the storage never reads and never writes, so that simulator never becomes
ready, never starts, and is dropped when the provider mounts the Live source. In a release build
there is no wait at all (`isCoreLinkSourceAvailable('LIVE')` is false): the simulator is created
and hydrated exactly as before this row. Deviation DV-2 says where this differs from the letter of
MD-5.

**Release fallback (MD-3, MD-6, AC-C-28).** Three independent lines:

| Line | Where | Effect in a release build |
|---|---|---|
| 1 | `isCoreLinkSourceAvailable`, `effectiveCoreLinkSource`, `hydrateCoreLinkSource`, `setCoreLinkSource` | A stored `LIVE` hydrates as SIMULATED; `setCoreLinkSource('LIVE')` is ignored, logged and writes nothing; Settings shows the segment disabled (it is built from `CORE_LINK_SOURCES`) |
| 2 | `SimRuntimeProvider`: `effectiveCoreLinkSource(preference) === 'LIVE'` | A LIVE value that reached the store all the same builds no Live source |
| 3 | `createMobileLive`: its whole body is under a literal `__DEV__` test | The function is `return null` in a release bundle, and the Live source, the typed client and the secure-store wrapper are not in the bundle (section 5.7). The provider then mounts the simulator and logs `runtime.live.unavailable` |

### 3.2 The adapters of the Live source (`createMobileLive`, `sim-adapters.ts`)

| Adapter | Implementation |
|---|---|
| Typed client | `createCoreClient({ baseUrl: CORE_SERVER_HTTP_ORIGIN, credentials: bearer, now, report, log })`. Transport: the app's global `fetch`, looked up by the client at each call (Expo's wrapper around `expo/fetch`, measured in W12); a test injects the fake's. `credentials: 'omit'` is the client's own for a credential function |
| Credential provider | `bearer()`: the session token when signed in, else the device credential, else `null`. **Memory only, synchronous** (D81). **Two operations always carry the device credential, whatever session is in memory** (decision D118): `signInWithBiometric` and `rotateDeviceCredential` (`DEVICE_CREDENTIAL_OPERATIONS`). The typed client has one credential provider per instance, so the adapter builds two instances on the same transport and hands the Live source one object whose `call` picks the instance by operation ID; everything else of a call (checks, validation, time-out, log, report) is the typed client's own |
| Socket | `createMobileSocketFactory()`: `new WebSocket(url, null, { headers })`, no subprotocol; URL `CORE_SERVER_WS_URL`. `headers()` is synchronous and reads the same memory: `{ Authorization: 'Bearer …' }` or `null` |
| Secrets port | Section 3.3 |
| Device description (MP-5) | `liveDeviceDescription(Device.modelName, Constants.expoConfig?.version)`: the model name cut to 60 characters ("Android device" when absent), `platform: 'android'`, the app version. No hardware identifier |
| Visibility | `createAppStateVisibility()` (the simulator's adapter). Back in the foreground with a STALE link: `live.reconnect('RETRY')` (brief row 15) |
| Reports | Every report of the Live source goes to the persistent runtime log (`logLiveReport`; an envelope code travels as `errorCode`, because the log drops a member named `code`). Failures of the typed client that are no answer of the contract go there too (`live.client`), once per operation and kind in 30 s, with the count of what was left out. The request line (method, path template, status, request ID) is printed to the development console only (`[DEMS-LIVE] …`), never to the persistent log |
| `owedSignOut` | Not passed (brief row 10): the session token is dropped at a local end |
| Start | `autoStart: false`. `mobile.start()` reads the stored credential (once per object), then `live.start()`, then operation 21 when a credential is held |

### 3.3 The secrets port of a device, and the `pairing` member at start

Memory is one object inside `createMobileLive`: `{ device: PairingRedeemed | null, session: string | null }`.
Nothing outside the closure can read it: `MobileLive` has nine members (`live`, `sim`, `start`,
`stop`, `ready`, `isReady`, `getPairing`, `subscribe`, `setBiometricPort`), none returns a
credential (MP-3; pinned by a test).

| Port call | What the adapter does, in order |
|---|---|
| `sessionIssued(issued)` | The session token into memory (before anything is awaited); then the biometric port of the sign-in row, when one is registered: given 4 s, and a throw, a rejection or a time-out of it is logged (by the error's name only) and never fails the sign-in (MB-6: a failed write of the rotated token costs the enrolment, not the session) |
| `sessionCleared(end)` | The session token out of memory (synchronous) |
| `biometricToken(operatorId)` | Passed to the registered biometric port; `null` without one |
| `devicePaired(redeemed)` | `writeDeviceCredential` (the wrapper), bounded to 4 s. Stored: the credential into memory, the gate PAIRED. Not stored: ONE `unpairDevice` with that credential (no unusable registration is left, [CS:§9.4]), then it is forgotten; the port throws, so the action rejects with `CoreRefusalError` (`NOT_AVAILABLE`) |
| `deviceUnpaired(end)` | Session token and device credential out of memory (synchronous, before anything is awaited); the gate UNPAIRED with the notice (`unpaired` for the reason UNPAIRED, else `revoked`); `deleteDeviceCredential` (the three items), bounded to 4 s. Idempotent |

The 4 s budget (`MOBILE_SECRETS_BUDGET_MS`) is inside the Live source's own wait of 5 s
(`LIVE_SECRETS_TIMEOUT_MS`; a test holds the order): the port has decided "stored" or "not stored"
before the source gives the wait up.

**The pairing state at start (MP-10).**

| Step | What happens |
|---|---|
| 1 | `mobile.start()` reads `dems.live.device.v1` through the wrapper, ONCE per object, outside every request path, bounded to 4 s. Absent, unreadable, corrupt or late: UNPAIRED (MP-4). Present: PAIRED at once, the device ID from the stored value, and the stored Core identity fills the `pairing` slice (`live.setPairing`). The runtime's `ready` resolves here |
| 2 | With a credential: `live.client.call('getDeviceRegistration')`. 200: the slice and the device ID are the server's. 401: the three items are deleted, UNPAIRED with the notice `unknown`, `live.reconnect('CREDENTIAL')` (AC-C-79). 403 `DEVICE_REVOKED`: the Live source ends the pairing itself (CL-23) and calls `deviceUnpaired` (AC-C-78). No answer: stays PAIRED; asked again when the link turns ONLINE. Any answered status ends the asking |
| Later | Close 4401 with nobody signed in and a device credential in memory (the Core refused it): operation 21 is asked, and its 401 deletes the credential. The report `DEVICE_CLEANUP_GAVE_UP` (brief row 14): the credential is forgotten and `live.reconnect('CREDENTIAL')` is called |

### 3.4 The refusal presenter (`core-errors.ts`)

`describeCoreError(error)` is pure and returns a presentation (kind, toast variant, i18n keys with
values, the role, `retryAfterSeconds`, `outage`, `coalesced`, the haptic) or `null` for an error
that is not the presenter's. `useCoreErrorPresenter()` shows the toast.

| The action rejected with | Kind | Toast (mobile wording) | One per 3 s |
|---|---|---|---|
| `SimPermissionError` `NOT_PERMITTED` | `DENIED` | danger: "Not permitted" / "Requires the X role" (the shared `common.rbac.*` sentences, the role by the web console's order) | no |
| `SimPermissionError` `NOT_SIGNED_IN` | `SIGNED_OUT` | warning: "You are signed out" / "Sign in to continue." | yes |
| `LiveTransportError` with status 429 or code `RATE_LIMITED` (**LB-10, decided first**) | `LIMIT` | warning: "The Core server is limiting requests from this tablet" / "Try again in N s." (N = `retry-after`, rounded up; "Try again in a moment." without a usable value). `outage` is false | yes |
| `LiveTransportError`, code `STOPPED` | `STOPPED` | none | — |
| `LiveTransportError`, code `CREDENTIALS_UNAVAILABLE` or `CREDENTIALS_TIMEOUT` | `CREDENTIALS` | danger: "This tablet could not read its credential" / "Nothing was sent. Try again." | yes |
| `LiveTransportError` `CORE_OFFLINE`, code `TIMEOUT` (LB-7) | `TIMEOUT` | danger: "Core server unreachable" / "The command may or may not have been applied; the screen updates when the Core is reachable." | yes |
| `LiveTransportError` `CORE_OFFLINE`, code `SNAPSHOT_TIMEOUT` | `SNAPSHOT_TIMEOUT` | danger: "Core server unreachable" / "The Core did not send its data in time. Try again." | yes |
| `LiveTransportError` `CORE_OFFLINE`, anything else (LB-6) | `OFFLINE` | danger: "Core server unreachable" / "Nothing was changed." | yes |
| `LiveTransportError` `UNAVAILABLE`, anything else | `FAILED` | danger: "The Core server could not complete the request" | yes |
| `CoreRefusalError` `NOT_AVAILABLE` | `NOT_AVAILABLE` | warning: "Not available right now" | no |
| `CoreRefusalError`, another code | `REFUSED` | danger: "Demo controls are turned off on the Core server" for `DEMO_DISABLED`, else "The Core refused this action". **`DEVICE_NOT_PAIRED` has no wording of its own** (decision D118): the Core also answers it, with `details.reason: 'DEVICE_CREDENTIAL_REQUIRED'`, when an operation wants the device credential; the error carries no `details`, so it always reads as an ordinary refused action and never as "this tablet is not paired" | no |
| `SimTransitionError`, `SimNotFoundError`, anything else | — (`null`) | none: the call site's own branch (LB-5) | — |

### 3.5 The banner rule, the debug parameter, the health call

| Item | What |
|---|---|
| Banner (`nextBannerKind`) | A source whose link follows a heartbeat (HEARTBEAT, LIVE) keeps the current banner while that heartbeat is CONNECTING; OFFLINE and STALE show "Core link lost …"; coming back shows "Resynced". A 429 never reaches it: the banner follows the link only |
| `core=LIVE\|SIMULATED\|HEARTBEAT` (MD-7) | Parsed by `coreSourceFromUrl` (the three names, exactly as written). Applied through `setCoreLinkSource`, so the choice is stored like the Settings choice (`dems.mobile.prefs.v1`, field `coreLinkSource`); a value that is already the source changes and stores nothing. The LAUNCH URL's value is applied once per process and BEFORE the runtime builds its data source (`applyLaunchCoreSource`, awaited by `decideCoreLinkSource`), so a launch with `core=LIVE` never starts the simulator. A later deep link is applied when it arrives. Under a literal `__DEV__` test: an empty function in a release bundle |
| `scenario=` in LIVE mode | Ignored and logged (`runtime.debug.scenario`, "Scenario ignored …") when the data source is the Live source, or when the same URL asks for `core=LIVE` |
| Stack Check (`use-health.ts`) | LIVE: `live.client.call('getServiceHealth')`; the query key is `['health', 'core-server']`; an answer that is no valid answer rejects, so the screen shows "Core unreachable"; a RESYNCED event of the Live socket reads it again (one request, however many readers). Other modes: the shared `fetchHealth()` to mock-core, as before |

## 4. The runtime's public surface for the mobile rows that follow

Everything is exported from `@/runtime`.

| To | Import | Notes |
|---|---|---|
| Know the source and the link | `useCoreLink()` → `{ source, state, heartbeat? }` | `source === 'LIVE'` picks the LIVE wording (the Pair chip `mobile.pairing.live`, the Core chips of MD-8). For the data mode: `useCoreMode()` of `@dems/shared/live` |
| Call a Core action | `useCoreActions()` and `settle` of `@dems/shared/live` | In every mode. Never `useSimActions()` in a feature folder (AC-C-53) |
| Call an operation that is no simulator action | `useMobileLive()?.client.call(operationId, input)` | `null` outside LIVE. Type-checked against the contract. Through nothing else (D69; the static test `live-no-raw-fetch.test.tsx` holds it) |
| Present a refusal | `const present = useCoreErrorPresenter()`; in `fail`: `if (present(error)) return;` | `present.present(error)` tells `'shown' \| 'coalesced' \| 'silent' \| 'unhandled'`. A screen that draws the refusal in place reads `describeCoreError(error)` (`kind`, `retryAfterSeconds`, `outage`) |
| Read the pairing gate | `usePairing()`, `isPairingBlocked(pairing)` | The gate of MP-11 for `navigation/` (W60). `pairing.notice` for the notices of the Pair screen (W57) |
| React to the end of a session or of the pairing | `useLiveSelector((live: MobileLiveSim \| null) => live?.lastSessionEnd ?? null)` of `@dems/shared/live`; `useMobileLive()?.onSessionEnd(listener)` | `TOKEN_REUSE` (W56) arrives here. The device credential is already deleted by the runtime when `kind === 'DEVICE_REVOKED'` |
| Register the biometric token storage (W56) | `useMobileLiveRuntime()?.setBiometricPort({ token, sessionIssued })` | `token(operatorId)` may wait behind the OS prompt. `sessionIssued({ biometricToken, operatorId })` gets the rotated token after the session token is in memory; it is given 4 s and its failure never fails the sign-in |
| Switch the source | `setCoreLinkSource(source)`; `useCoreLinkSourceSetting()` | The confirmation dialog and the sign-out of [CS:§3.3] are the Settings row's (W82) |
| Build a Live source in a test | `createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 })`, then `<AppProviders sim={mobile.sim}>` or `renderWithRuntime(ui, { sim: mobile.sim })` | End every test with `mobile.stop()` and `fake.assertNoViolations()`. Seed a paired tablet with `__DEMS_SECURE_STORE_MOCK__.seed('dems.live.device.v1', JSON.stringify(redeemed))`. A bare `createLiveSim` source is refused by the provider with a message that says so |

**For the tests of the rows that follow** (what this row's tests had to learn):

| # | Note |
|--:|---|
| 1 | The fake's `startAnonymous()` and `startDevice()` send `hello` only. The Core link is ONLINE only after a `heartbeat` (the real server sends one at connect): add `connection.heartbeat()` to the connect script |
| 2 | `fake.hold('getAuthSession').release()` without an argument answers the FIRST example (`webConsole`, 200): a tablet that is not signed in then looks signed in, and the source reports "the socket the app opens does not carry it". Release with `fake.example('getAuthSession', 401)`, or answer from a session model |
| 3 | The contract's only example of operation 1 is mock-core's (`service: 'dems-mock-core'`): script the Core server's body (finding F-3) |
| 4 | The storage mock's functions are jest spies that keep their calls across tests; `mockRestore()` on one of them removes its implementation for the rest of the file. Use `mockImplementationOnce`, and `mockClear()` in `beforeEach` |
| 5 | A `QueryClient` with the default `gcTime` keeps a jest process alive for five minutes when a test file is run alone. Pass `gcTime: Infinity` |
| 6 | The kit draws the text of one toast more than once: count toasts by the presenter's outcome, not by `getAllByText(...).length` |

## 5. Verification

Every command was run from `/Users/gsp-budi/Documents/DEMS` (no `cd`).

### 5.1 Baseline, before the first edit (`assets/51_baseline.log`)

```
## 2026-10-04 18:07:30 WIB $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 74 passed, 74 total
Tests:       870 passed, 870 total
exit=0
## 18:08:12 $ npm run typecheck -w @dems/mobile      exit=0
## 18:08:18 $ npm run lint -w @dems/mobile           exit=0
```

### 5.2 Final gate on the finished tree (`assets/51_gate_final.log`)

```
## 2026-10-04 19:44:34 WIB $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 82 passed, 82 total
Tests:       992 passed, 992 total
Snapshots:   0 total
Time:        51.816 s, estimated 98 s
Ran all test suites.
exit=0
## 19:45:26 $ npm run typecheck -w @dems/mobile      > tsc --noEmit    exit=0
## 19:45:34 $ npm run lint -w @dems/mobile           > eslint .        exit=0
```

Earlier whole runs: 18:53, after the first coherent step, 80 suites / 981 tests, exit 0; 19:29,
right after the device check, 81 suites / 990 tests, exit 0 (the eighth test file was added after
it). No production file was edited after 19:27: the device check (19:28), the release-bundle
check (19:31), the final mutation run (19:32) and this gate ran on the same production code. This row wrote nothing under `packages/shared` (section 2 is its whole write list); the
shared suite was not run here.

### 5.3 The existing tests are unchanged (rule 2 of the brief; AC-C-101)

`git hash-object` of every test file under `apps/mobile/src` at 18:07 and at 19:46
(`assets/51_test_hashes_before.txt`, `51_test_hashes_after.txt`): the 74 lines of the first list
are in the second list unchanged; the second has eight more lines, this row's files.

```
lines starting with '<' (a changed or removed existing file): 0

named existing runtime, provider and gate tests (git hash-object, before = after):
  6a609d17881a3377ba2cb539a00ad7d7f4a7bf2d same apps/mobile/src/runtime/runtime.test.tsx
  7b2b83b76338e6b2134896140c869812177a818d same apps/mobile/src/runtime/sim-adapters.test.ts
  084b60a16c6ed9ed92dc81e84438da51f08f6efe same apps/mobile/src/runtime/route-sync.test.ts
  69c54ad355c2eeeebf23a7f95c6bf19ba21fd7ea same apps/mobile/src/runtime/session-route-sync.test.tsx
  e3a70bda9ca1064958755ecbd1cf36a0ce79aa15 same apps/mobile/src/runtime/log.test.ts
  3b14b243529f5eebf6e68c0af11d90e15efd6068 same apps/mobile/src/runtime/use-audio-shared-values.test.tsx
  5408d63920556627743ab8231ba5f21fc0122e5f same apps/mobile/src/runtime/secure-credentials.test.ts
  762afd66050137a7b4f12f18b1403a63cf1662c8 same apps/mobile/src/runtime/secure-store-import.test.ts
  9633c4c4fef9cbfbafeeee66ce80772b55e219d6 same apps/mobile/src/providers/app-providers.test.tsx
  fd65283880362ff3be0d666ca667dab146cea84a same apps/mobile/src/providers/runtime-contract.test.tsx
  6aa6db7ef1cc666b03be489a23e2146b3e28f9ac same apps/mobile/src/features/settings/heartbeat-release-gate.test.tsx
  84ef38f72af91c26c08ad5abff651cabcaf817b7 same apps/mobile/src/features/home/home-screen.test.tsx
  fb38f2941a5694bd7845dd16322ad86402965c86 same apps/mobile/src/i18n/i18n.test.ts

git diff --stat acaff20 over the test files that exist at acaff20:
(empty above = none differs)
```

`6aa6db7e…` is the hash W12 recorded for the release-gate test, equal to `acaff20`. The two frozen
runtime files are as they were: `dev-probes.ts` `70db856b…`, `secure-credentials.ts` `a55c9845…`
(the same values at 18:07 and at 19:32).

### 5.4 The new tests (`assets/51_live_tests_verbose.txt`: every name)

| File | Tests | Covers |
|---|--:|---|
| `src/runtime/live-core-link.test.tsx` | 37 | The three sources and the pure gate; the stored value; the release build (a stored LIVE hydrates as SIMULATED, `setCoreLinkSource(LIVE)` ignored, the source decision); the banner rule for the three sources; the `pairing` member and `isPairingBlocked`; `coreSourceFromUrl` (13 URLs); `core=` at launch, as a later link, in a release build; `scenario=` in LIVE; the device description |
| `src/runtime/live-runtime.test.tsx` | 11 | The provider as the app mounts it, the source built from the preference, the runtime's own `fetch` and socket constructor replaced by the fake: SIMULATED and HEARTBEAT start nothing of the Live layer; a stored LIVE at a cold start; crossing the LIVE boundary; an injected simulator; the three release cases; the log of a LIVE start |
| `src/runtime/live-device.test.tsx` | 32 | The adapters on the fake transport with the fake's clock: the pairing state at start (6), an unknown credential (3), a revoked device (6), the device-credential operations (2), a 429 on redeem (1), the role change (1), offline and the limit (2), the link coming back (1), the foreground rule (1), the secrets port (5), what the runtime exposes (4) |
| `src/runtime/live-core-errors.test.tsx` | 25 | The refusal presenter: the 429 wording (10), no answer (4), refusals (6), the coalescer (1), the hook with real toasts (4) |
| `src/runtime/live-health.test.tsx` | 6 | Stack Check's health call in LIVE (4), across a change of source (1), in SIMULATED (1) |
| `src/runtime/live-screens.test.tsx` | 2 | The Pair screen and Stack Check draw on the Live replica of an unpaired tablet; no misuse report |
| `src/runtime/live-no-raw-fetch.test.tsx` | 7 | Static: no raw request to the Core server's origin |
| `src/runtime/live-settings.test.tsx` | 2 | What MD-3 does to the Settings control, which is built from `CORE_LINK_SOURCES`: three segments in a debug build, the LIVE segment disabled in a release build (finding F-6). The segment is not pressed: the dialog of [CS:§3.3] is the Settings row's |
| **Total** | **122** | |

Every Live test ends with `fake.assertNoViolations()` (an `afterEach` in each file), and injects
`now` and `timers` of the fake clock where it builds the source itself. `live-runtime.test.tsx`
lets the runtime build its source from globals, as the app does, so the fake stands on the runner's
timers there (`clockFromTimers`); nobody is signed in in that file.

### 5.5 Requirement to test

| Requirement | Test (file: name) |
|---|---|
| **AC-C-28** the default source is SIMULATED; `isCoreLinkSourceAvailable('LIVE', false)` is false; `effectiveCoreLinkSource('LIVE', false)` is SIMULATED; a stored LIVE hydrates as SIMULATED in a release build | `live-core-link`: "SIMULATED is the default; LIVE is the third source"; "pure gate (AC-C-28) …"; "a LIVE value stored by a debug build hydrates as SIMULATED"; "`setCoreLinkSource(LIVE)` is ignored and nothing is written"; "the source decision of the runtime is SIMULATED whatever is stored and whatever the launch URL says". `live-runtime`: "a LIVE value stored by a debug build starts the simulator: no Live source, no request, no socket"; "a LIVE preference that reaches the runtime all the same is not followed"; "a build that holds no Live source (MD-6) …"; "`createMobileLive` builds nothing in a release build". The existing `heartbeat-release-gate.test.tsx` passes unchanged beside them (D17) |
| **AC-C-29** in LIVE mode the simulator is not started; `dems.sim.v1` and `dems.mobile.auth.v1` are unchanged after a Live session | `live-runtime`: "a stored LIVE at a cold start: the Live source runs, the simulator never reads or writes its snapshot, the mock-core client is stopped" (no read and no write of `dems.sim.v1`, no write of `dems.mobile.auth.v1`, both values byte-equal after the unmount). On the device: `dems.sim.v1` has 119,907 characters before the LIVE launch and in LIVE mode (section 6) |
| **AC-C-32** `core=LIVE` sets the source in a debug build and does nothing in a release build; `scenario=` is ignored in LIVE mode | `live-core-link`: the 13 URL cases; "debug build, launch URL: `core=LIVE` sets and stores the source before the runtime decides its data source"; "… a later deep link: `core=` switches the source while the app runs"; "release build: `core=LIVE` does nothing, at launch and as a later link"; "release build: even a hook that is forced on applies no `core=` …"; "is ignored and logged when the data source is the Live source: no demo control is called"; "is ignored when the same URL asks for LIVE …"; "with the simulator it loads as before". On the device: section 6 |
| **AC-C-49** `session.updated` changes the gated controls without a reload or a sign-in and shows the role notice | `live-device`: "the gated controls change in place and one notice names the new role; nobody is signed out, nothing is reloaded" (a control gated by the static table on the replicated role, and one gated by `useCorePermission`; the probe is not mounted again; no `signIn` request; no new socket; both directions) |
| **AC-C-59** offline: a command rejects at once, five presses show one toast, no request is sent | `live-device`: "link down: a command rejects at once, five presses show one toast, and no request is sent". `live-core-errors`: "five refusals on a dead link are one toast; after the window the next one shows again"; "the coalescer admits a kind once per window, each kind on its own" |
| **AC-C-78** `device.revoked`, a close with 4403, or a 403 `DEVICE_REVOKED` deletes the three items, signs out and … the revoked notice (the runtime's half; the route is W60's) | `live-device`: "`device.revoked` REVOKED on the socket"; "a close with 4403 and no message before it"; "a 403 `DEVICE_REVOKED` on a REST call"; "`device.revoked` UNPAIRED: the same deletion, with the notice `unpaired`"; "the clean-up that gave up (brief row 14) …"; "a sign-out keeps the pairing …" (the control) |
| **AC-C-79** a stored credential the Core does not know (401 on operation 21) is deleted, and … the "not registered" notice (the runtime's half) | `live-device`: "401 on operation 21: the stored items are deleted, the gate is UNPAIRED with the notice `unknown`, and the socket is reopened without a credential"; "the socket alone says so (close 4401 with nobody signed in) …"; "a 4401 while the Core cannot be asked deletes nothing: the device stays PAIRED" |
| **AC-C-101** the existing tests pass and are unchanged; typecheck and lint exit 0 | Sections 5.2, 5.3 |
| **LB-10** a 429 is worded as a limit with the seconds of `retry-after`; never the offline notice, never a changed indicator | `live-core-errors`: the ten tests of "a limit is not an outage (LB-10)". `live-device`: "a 429 is worded as a limit, with the seconds of `retry-after`; the link, the banner and the mode stay as they are" |
| The banner rule | `live-core-link`: "HEARTBEAT: …", "LIVE: CONNECTING is a transient and keeps the banner; OFFLINE and STALE show it; coming back shows "Resynced"", "SIMULATED is as before …". `live-device`: "the resync bus is emitted once when the Live socket is back …" |
| The `pairing` member and its state at start (MP-9, MP-10; rule 4 of the brief) | `live-device`: the six tests of "the pairing state at start", among them "the credential is read ONCE: every request and every socket afterwards takes it from memory (D81)" (one read of the secure store, then three requests and a reconnect). `live-core-link`: the two tests of "the pairing member of the contract" |
| Stack Check's health call (rule 5) | `live-health`: six tests. `live-screens`: "Stack Check shows the Core server …" |
| No raw `fetch` to the Core origin (D69, D34-6 a) | `live-no-raw-fetch`: seven tests |
| `expo-secure-store` has one importer (AC-C-66, D71) | The existing `secure-store-import.test.ts`, unchanged, passes. This row's tests name the package only through a string put together at run time |
| The secrets port (brief rows 11 to 13) | `live-device`: the five tests of "the secrets port of a device" |
| Foreground with a STALE link (brief row 15) | `live-device`: "a STALE link is reconnected at once; an ONLINE link is left alone" |
| Decision D118: the device credential on operations 8 and 23; `DEVICE_CREDENTIAL_REQUIRED` | `live-device`: the two tests of "operations that want the device itself (decision D118)". `live-core-errors`: "`NOT_AVAILABLE`, and the envelope codes without a simulator class" |
| Decision D116: nothing with the credential after `DEVICE_REVOKED`; a 429 on redeem | `live-device`: every test of "a revoked device" ends with `expectRevoked`, which sends two more calls, lets 3 s pass and finds no `Authorization` on any request after the revocation; "means "wait `retry-after`", never "wrong code" …" |

### 5.6 Mutation check of the runtime's own logic

`assets/51_mutate.py.txt` (the list and the driver), `51_mutating_transformer.cjs.txt`,
`51_jest_mut_config.cjs.txt`, `51_mutations_run1.log`, `51_mutations_final.log`.

**Method.** A jest transformer OUTSIDE the repository (in the session's scratch folder) changes one
text of one production file in memory and hands the result to the app's own transformer
(babel-jest with jest-expo's options). Nothing in the tree is edited: the SHA-256 of the eight
production files is compared before and after the run and is identical. Each change is run against
eleven test files: the row's seven of that time, and the existing `runtime.test.tsx`,
`sim-adapters.test.ts`, `heartbeat-release-gate.test.tsx` and `app-providers.test.tsx`. A change
is detected when jest exits non-zero.

**Final run, on the finished tree (19:32:03 to 19:44):**

```
## W51 mutation check, 2026-10-04 19:32:03; 11 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       159 passed, 159 total (5 s)
…
## 100 detected, 0 not detected, of 100
## the mutated files in the tree, before and after: identical
```

| Group | File | Changes | Detected | Examples (change → a test that fails) |
|---|---|--:|--:|---|
| S: the source selection and the release fallback | `core-link.ts` | 9 | 9 | `isCoreLinkSourceAvailable` returns true → 9 tests, the first of them "pure gate …" of the EXISTING release-gate test; the rule before this row (`source !== 'HEARTBEAT' \|\| isDevBuild`) → 5 tests, among them "a LIVE preference that reaches the runtime all the same is not followed"; a stored LIVE hydrates as LIVE in a release build; `setCoreLinkSource` accepts LIVE in a release build; the default source is LIVE |
| P: the provider | `sim-runtime-provider.tsx` | 16 | 16 | The simulator reads its snapshot although the source is LIVE → "a stored LIVE at a cold start …"; no gate on the snapshot storage; a runtime with a simulator reports LIVE; HEARTBEAT builds a Live source; the build flag is not asked before a Live source is built; the mock-core client is not stopped, or not started again; no `pairing` member; no role notice; the fallback simulator waits for ever; the resync bus is not emitted |
| A: the adapters | `sim-adapters.ts` | 24 | 24 | `if (__DEV__)` → `if (true)` in `createMobileLive` → "`createMobileLive` builds nothing in a release build"; the bearer order; a revoked device keeps its credential in memory, or in the store; the two notices swapped; a 401 on operation 21 deletes nothing; no socket after the credential was forgotten; a 4401 asks nothing; a failed write leaves the registration, or the credential in memory; the STALE rule; `autoStart: true`; a refused snapshot storage is read all the same |
| B: the banner rule | `connection-banner.ts` | 5 | 5 | CONNECTING is no transient in LIVE; CONNECTING is a transient in every mode; no "Resynced" after an outage; an outage shows no banner |
| E: the 429 wording and the presenter | `core-errors.ts` | 21 | 21 | A 429 is not told apart → 13 tests fail; the status alone, or the code alone, does not make a limit; the seconds rounded down; zero seconds shown as a number; the seconds never shown; a limit counts as an outage, is a danger toast, gets the offline wording; STOPPED shows a toast; a time-out says "Nothing was changed."; the offline toast is not coalesced; the window one millisecond longer; a clock that went back silences the toast; the roles ordered the other way |
| D: the debug parameter | `debug.ts` | 8 | 8 | `core=` applied in a release build; the launch URL read in a release build; a scenario loaded in LIVE mode; `core=live` accepted; `score=LIVE` read as `core=LIVE`; a value that is already the source stored again |
| C: the contract | `contract.ts` | 3 | 3 | CHECKING does not block; a gate that is not required blocks; every contract carries a `pairing` member → "is optional: a contract built without it has no such member …" |
| H: the health call | `use-health.ts` | 4 | 4 | LIVE reads mock-core; a failed call is shown as an answer; both services share one query; the health is not read again when the link is back |
| N: the storage budget and the biometric port | `sim-adapters.ts` | 5 | 5 | A biometric storage that fails costs the session; a failed storage call is not logged, or is logged with its own text; the budget is outside the wait of the Live source |
| K: decision D118 | `sim-adapters.ts`, `core-errors.ts` | 5 | 5 | The biometric sign-in carries the session token; the device client prefers the session token; the rotation is not on the list; `DEVICE_NOT_PAIRED` has a wording of its own |
| **Total** | | **100** | **100** | |

**The first run (19:02 to 19:18, 89 changes): 81 detected, 8 not.** Each survivor was read, and
each led to a test, not to a weaker check:

| ID | The change that was not detected | What it showed | What was added |
|---|---|---|---|
| P06 | The provider builds a Live source without asking the build flag | The second line of the release fallback (`createMobileLive` is null) hid the first | "a LIVE preference that reaches the runtime all the same is not followed" now asserts that `createMobileLive` is not even called and nothing is logged |
| P07 | The mock-core client is stopped only on the later promise job | The stop inside the commit was not asserted at that moment | "crossing the LIVE boundary …" asserts it right after the `act` |
| P08 | The mock-core client is not stopped after the commit | No test mounted a Live source in the first frame AND looked at the mock-core socket | "no stored credential …" asserts that every mock-core socket is closed |
| P15 | The resync bus is not emitted when the link is back | Not tested | "the resync bus is emitted once when the Live socket is back …" |
| A24 | The device name is not bounded | `liveDeviceDescription` had no test | "the model name, at most 60 characters …" |
| B02 | CONNECTING is a transient in every mode | The rule was tested only with the links the runtime builds | One assertion: the rule goes by the source, not by the presence of a heartbeat member |
| D01 | `core=` is applied in a release build | `setCoreLinkSource` refuses the value there anyway, so the outcome was the same | "release build: even a hook that is forced on …" asserts that nothing at all is logged: the preference is not even asked |
| H02 | A refused health call is shown as data | The change was equivalent (the query library refuses `undefined` data). Replaced by a real one, "a failed health call is shown as an answer", which is detected | — |

Reading beside the first run also changed production code: a failed storage call is now logged
by the error's name; the biometric port of the sign-in row is bounded and cannot fail a sign-in;
an answered refusal of operation 21 other than 401 is logged. Those lines are groups N and A of
the final run.

### 5.7 What a release build holds (`assets/51_release_bundle_check.log`, `51_release_gate_w51.cjs`, `51_release_bundle_check.sh`)

The method of W12 and W15, repeated on the finished tree at 19:31. First Metro's own release
transform of the row's files (Babel with the app's preset, Metro's `inlinePlugin`, then, for a
release build, its `constantFoldingPlugin`; dependencies are collected from what is left):

```
debug build   sim-adapters.ts  required: … "@dems/shared/live/source","@dems/shared/client","./secure-credentials","expo-device","expo-constants"
    debug build loads the Live source, the typed client and the wrapper=ok debug build applies core==ok
release build sim-adapters.ts  required: "@react-native-async-storage/async-storage","react-native","zustand/middleware","@dems/shared/api","@dems/shared/sim","./contract","./log"
              createMobileLive: "var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}; return null;"
release build debug.ts         required: "react","react-native","@dems/shared/live","@dems/shared/sim","./core-link","./log"     applyCoreSourceFromUrl: ""
    release: sim-adapters.ts loads none of the five modules=ok release: createMobileLive is `return null`=ok release: no createLiveSim, no createCoreClient, no bearer header, no request log=ok
    release: debug.ts holds no probe=ok release: core= is not applied (empty function)=ok release: no other file of the row loads the Live source or the typed client=ok
exit=0
## 1b. The earlier rows' transform check, unchanged (15_release_gate_w15.cjs)
    release build holds no probe=ok release build keeps the wrapper=ok
```

Then two real bundles of the whole app (`expo export`, output in a temporary folder, nothing
served, nothing installed). A count is the number of bundle lines that hold the text:

```
## 2. Release bundle
$ EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --platform android --no-bytecode --output-dir <tmp>/release
release exit=0     bundle bytes: 9968521
probe and debug text of the earlier rows (must be 0):
  DEMS-PROBE-W15 0   DEMS-PROBE-W12 0   dev-probes 0   runDevProbe 0   devProbeFromUrl 0   probe= 0
  secure-store-wait 0   dems.live.probe.v1 0   DEMS secure-store probe 0   secureStoreDevProbe 0   PROBE_W15_ 0
the Live layer of this row (must be 0):
  createLiveSim 0   createCoreClient 0   CoreClientUsageError 0   createCommandGate 0   DEVICE_CLEANUP_GAVE_UP 0
  DEMS-LIVE 0   runtime.live.registration 0   runtime.live.credentials 0   "Bearer " 0   secure-credentials 0
  dems.live.device.v1 0   ExpoSecureStore 0   isUnprotectedBiometricItemAllowed 0   "Core link source set from a deep link" 0
what does ship:
  runtime.sim.hydrated 1   scenario= 1   runtime.live.unavailable 1   "limiting requests from this tablet" 1
  LiveTransportError 2   CoreRefusalError 2   createLiveSocketClient 1   core=([^&#]*) 1
## 3. Development bundle (positive control)
dev exit=0         bundle bytes: 13285556
  DEMS-PROBE-W15 1   runtime/dev-probes.ts 1   createLiveSim 3   createCoreClient 4   live/source/live-sim.ts 1
  client/core-client.ts 1   DEVICE_CLEANUP_GAVE_UP 3   DEMS-LIVE 1   runtime.live.registration 1
  runtime/secure-credentials.ts 1   dems.live.device.v1 1   "Core link source set from a deep link" 1
```

**What ships in a release build, and what does not.**

| In a release bundle | Not in a release bundle |
|---|---|
| The light Live API (`@dems/shared/live`: the error classes, the hooks, `settle`, the mode helpers), which feature files import statically by design [CS:§2] | The Live source (`@dems/shared/live/source`), the typed client (`@dems/shared/client`) |
| The refusal presenter and its texts; the `pairing` types and helpers; the provider's LIVE branch (unreachable: no Live source can be built, and LIVE is not available) | The body of `createMobileLive`: the credential memory, the secrets port, the bearer header, the request log |
| `coreSourceFromUrl` (a parser; nothing applies its result: `applyCoreSourceFromUrl` is empty, and the debug hook is off) | The secure-store wrapper and the `expo-secure-store` JavaScript (still 0, as W15 measured: its only importers are inside `__DEV__` blocks) |
| `createLiveSocketClient`: by the shared package's own layout, not by this row (finding F-5). Nothing can call it: its only caller, the Live source, is absent | The probe, its hook and its texts (W12, W15: still 0) |

The release bundle grew from 9,942,919 bytes (W15) to 9,968,521 bytes.

## 6. The device check: the first run of the app against the real Core server

One command, inside the lane lock (19:28:02 to 19:28:51 WIB; sandbox bypass for the port, `adb`
and the database):

```
/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/w51/run_w51.sh
```

`assets/51_run_w51.sh` and `51_device_w51.sh` are the two scripts; `assets/51_device_run.log` is
the whole output. The device commands ran inside
`METRO_PORT=8082 DEMS_CORE_HOST_PORT=4421 apps/mobile/scripts/device-session.sh phone '…'`.

| Step | What | Output (quoted from `51_device_run.log`) |
|---|---|---|
| Backend | `DEMS_CORE_PORT=4421 npm run start:server`, from the tree, first attempt; demo flag off | `npm PID 47710, listener PID 47764`; `"port":4421,"database":"dems_lane_1","demoControls":false` |
| Health from the host | `curl` | `{"status":"ok","service":"dems-core-server","version":"0.2.0","apiVersion":"v1",…,"ready":{"database":true,"engine":true}}`; `cache-control: no-store`; no `Set-Cookie` |
| Device session | The script's own lines | `emulator-5554: screen awake, no keyguard`; `Metro ready; device tcp:8081 -> host tcp:8082, tcp:4400 -> tcp:4400`; `Core server: device tcp:4420 -> host tcp:4421` |
| Before the launch | The app's stored keys (names and lengths) | `dems.mobile.log.v1\|3056`, `dems.sim.v1\|119907`; no `dems.mobile.prefs.v1`; no secure-store entry |
| **A** cold start `demsdemo:///pair?core=LIVE` | `am start -W` said `Status: timeout` (finding F47, as known); the app was up: the device log held `runtime.debug.core` and `runtime.live.ready` within 1 s of the first look | Screencap `assets/51_pair_live.png` |
| | The stored preference | `{"coreLinkSource":"LIVE"}` |
| **B** `demsdemo:///stack-check` into the running app (no `core=`: the choice is kept) | The health line came within 1 s | Screencap `assets/51_stack_check_live.png` |
| **C** stop the app, launch `demsdemo:///?core=SIMULATED` | `LaunchState: COLD`, `runtime.debug.core`, `runtime.sim.hydrated`; request lines to the Core server after it: 0 | Screencap `assets/51_after_reset_simulated.png`; the preference `{"coreLinkSource":"SIMULATED"}` |

**What the app shows** (read from the three screencaps):

| Screencap | On screen |
|---|---|
| `51_pair_live.png` (LIVE, unpaired) | "Pair this tablet". Core connection: chip "Not paired"; "Ready to pair with ." (no Core name: an anonymous socket carries no state); stepper Discover / Verify code / Paired with step 1 active; Device and Room empty; "Paired at: Not paired"; "Last pairing audit: No pairing event yet"; "Certificate fingerprint · SHA-256 (DEMO)" with the chip **`SIMULATED`**; the six code slots; Pair; Cancel. The header subtitle still says "simulated in this demo". These texts are the Pair screen's own (W57); the runtime gives it `source: 'LIVE'` |
| `51_stack_check_live.png` (LIVE) | "DEMS EDGE CLIENT", "Secure"; HEARTBEAT chip **"Live"**, sequence number **30**: the Core server's heartbeat on the app's one socket; SERVICE: **"mock-core v0.2.0 · api v1"**: the Core server's version (`0.2.0`; mock-core is `0.1.0` and was not running) behind the screen's fixed label "mock-core" (finding F-2) |
| `51_after_reset_simulated.png` | The sign-in screen in Simulated mode: "Core online", "Core: DEMS-IR-01 • paired (simulated)", "Biometrics not set up on this device" |

**Request IDs on both sides, and no token in either log.** The app's request lines in the device
log (`adb logcat -s ReactNativeJS:V`, the typed client's debug line: method, path template, status,
request ID) and the backend's request log of the same run:

```
device   [DEMS-LIVE] GET /api/v1/auth/session 401 bdaa01df-ca35-49f7-9645-1fc224b4714d
device   [DEMS-LIVE] GET /api/v1/auth/status  200 94cc452f-c19d-429b-960a-900d42e5fd6b
device   [DEMS-LIVE] GET /api/v1/health       200 d5b1de00-9575-414e-b5cb-7147962e0b64
server   bdaa01df-ca35-49f7-9645-1fc224b4714d GET /api/v1/auth/session 401 principal=null
server   94cc452f-c19d-429b-960a-900d42e5fd6b GET /api/v1/auth/status  200 principal=null
server   d5b1de00-9575-414e-b5cb-7147962e0b64 GET /api/v1/health       200 principal=null
server   60994dd8-a10f-4a37-a8f1-353b22aa7632 GET /api/v1/health       200 principal=null      <- the host's curl of step 2
server   {"connectionId":"09125865-…","principal":null,"kind":"ANONYMOUS","msg":"socket opened"}
server   {"connectionId":"09125865-…","code":1006,"closedBy":"peer","durationMs":15534,"msg":"socket closed"}   <- the app was stopped (step C)
-- a credential or a bearer value in the device log of this run (count of lines; must be 0):      0
-- a bearer value, a cookie or a credential in the server log of this run (count of lines; must be 0): 0
```

Three requests in LIVE mode, all three in both logs with the same ID; one socket, ANONYMOUS, as
rule 7 of the brief expects for an unpaired device (`hello` and `heartbeat` only; the socket
carried the heartbeat that Stack Check counts). The 401 of `getAuthSession` is the answer "nobody
is signed in", not a refusal that counts towards the denial budget of a signed-in caller; it was
asked once.

**Afterwards** (19:29:05):

| Point | State | Evidence |
|---|---|---|
| Reverse rules | None on `emulator-5554` | `adb -s emulator-5554 reverse --list`: empty, exit 0. They were set and removed by `device-session.sh`; this row set none by hand |
| App process | Not running | `pidof com.dems.demo.tablet`: exit 1 |
| The stored key this check changed | **`dems.mobile.prefs.v1`**, field `coreLinkSource`. Absent before; `{"coreLinkSource":"LIVE"}` after step A (the `core=` choice IS stored: MD-7 sets it through `setCoreLinkSource`, like the Settings choice); `{"coreLinkSource":"SIMULATED"}` after step C. So the app is back on the default source; the key now exists with the default value, where it was absent before. It was reset by the app's own code path (a launch with `core=SIMULATED`), not by editing the app's data |
| Other stored keys | `dems.sim.v1`: 119,907 characters before and in LIVE mode (not written in LIVE), 119,911 after the Simulated launch (each Simulated launch rewrites it, as W12 saw). `dems.mobile.log.v1`: 3,056 → 3,843 (the runtime log). No secure-store entry before, in LIVE or after | `51_device_run.log` |
| Backend | Stopped by this row: `shutdown complete`; `process 47764 is gone` | The log's last lines |
| Listeners | None on 4421 or 8081 to 8086 | `lsof -nP -iTCP:4421 -iTCP:8081-8086 -sTCP:LISTEN`: no output, exit 1 |
| `.locks/core-server.lane1.pid` | Exists, empty (0 bytes): this row removes nothing outside the temp folder, so the PID file is emptied where earlier rows removed it | `wc -c` |
| Device lock | As at the start | `isKeyguardShowing=false`, `RUNNING_UNLOCKED`, `CredentialType: NONE`, `"count":0` at both ends of the session; `emulator-user-lock.sh status` identical at 18:07 and 19:29 |
| Ports 4420, 4422, 4423, 4400, 4432, 5173 to 5178 | Not used, nothing stopped | The script names only 4421 and 8082 |

Processes started and stopped by this row: the lane backend (npm 47710, node 47764); Metro 47893
through `device-session.sh`; two `expo export` pairs; the test runs. The lane database was not
reset: an unpaired tablet can make no state-changing call, and none was made (deviation DV-6).

## 7. The controller's note during the row (decisions D118 and D116)

| Point of the note | What is built | Test |
|---|---|---|
| 2. The biometric sign-in sends the DEVICE credential, whatever session is in memory | `DEVICE_CREDENTIAL_OPERATIONS` (`signInWithBiometric`, `rotateDeviceCredential`) are sent through a second typed client whose provider returns the device credential only (`sim-adapters.ts`: `deviceBearer`, `deviceClient`, the dispatching `client.call`). Nothing under `packages/shared` was edited | `live-device`: "the biometric sign-in carries the DEVICE credential while a session token is in memory; every other call carries the session token" |
| 3. A 403 `DEVICE_NOT_PAIRED` with `details.reason: 'DEVICE_CREDENTIAL_REQUIRED'` is not "this device is not paired" | The adapter reacts to no `DEVICE_NOT_PAIRED` at all: only the Live source's end of the pairing (`DEVICE_REVOKED`), a 401 on operation 21 and the give-up report retire a credential. The presenter gives `DEVICE_NOT_PAIRED` no wording of its own (the error carries no `details`); the key `mobile.live.refusal.notPaired` that an earlier version of this row had was removed | `live-device`: "403 `DEVICE_NOT_PAIRED` with `details.reason: DEVICE_CREDENTIAL_REQUIRED` is an ordinary failed action: the credential stays, the gate stays PAIRED, nobody is signed out" (as an action and as a call through `live.client`). `live-core-errors`: the refusal codes |
| 4a. After `DEVICE_REVOKED` nothing more is sent with that credential | Already so by construction: `deviceUnpaired` empties the memory before it awaits anything, and both credential providers read memory only. Now asserted on every trigger | `live-device`: `expectRevoked` in the five revocation tests: two more calls and 3 s later, no request after the revocation carries an `Authorization` header, and no open socket does |
| 4b. A 429 on redeem means "wait `retry-after`" | Already so: the Live source rejects `pair` with `LiveTransportError` (status 429, `retryAfterSeconds`), not with the result union of a wrong code; the presenter says `LIMIT`. Asserted | `live-device`: "means "wait `retry-after`", never "wrong code": the action rejects as a limit and no failed attempt is counted" |

**Nothing of the note contradicts what was built.** One line did change because of it:
`sim-adapters.ts`, the bearer rule (now `bearer` for the session client and `deviceBearer` for
the device client, in place of one provider). One observation for the sign-in row, from the first
version of that test: after a biometric sign-in that was answered 401 while an operator was signed
in, the next call carried the device credential again, so the session token was no longer in
memory. What a biometric sign-in attempt does to an open session is the Live source's rule; that
the fingerprint button exists on the login screen only is the auth layer's.

## 8. Findings (P22)

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| **F-1** | **The Pair screen's mode chip is hard-wired to the Simulated text.** In LIVE mode it reads `SIMULATED`, against [CS:§3.2] ("a screen that says "simulated" shows simulator data") and against this row's own verification | `apps/mobile/src/features/pairing/pairing-connection.tsx:162`: `label={t('mobile.pairing.simulated')}`; screencap `51_pair_live.png` | The file is in the pairing row's folder (W57, [CS:§7.4] lists it as a D file of that row); this row may not write it. One line closes it: `label={t(useCoreLink().source === 'LIVE' ? 'mobile.pairing.live' : 'mobile.pairing.simulated')}`. The same screen says "simulated in this demo" in its subtitle (`features/pairing/i18n.ts`), also W57's. Decision DN-1 |
| **F-2** | **Stack Check prints a fixed service label.** In LIVE mode the line reads "mock-core v0.2.0 · api v1": the Core server's version under mock-core's name | `apps/mobile/src/features/home/home-screen.tsx:217`; screencap `51_stack_check_live.png`. The answer itself is right (`service: 'dems-core-server'`, tested) | `home-screen.tsx` is the predecessor's frozen proof screen and not in this row's paths (only `use-health.ts` is). One line: print `health.data.service` in place of the literal. Decision DN-2 |
| **F-3** | The contract's only example of operation 1 `getServiceHealth` is mock-core's answer (`service: 'dems-mock-core'`, summary "mock-core is up") | `packages/shared/src/api` (the example `live` of `getServiceHealth`); first seen as a red test of this row | A Live test that "answers from the example" sees mock-core. For the contract close-out (W83): add a Core-server example with `ready` |
| **F-4** | `runtime/dev-probes.ts` (W12, W15) makes raw requests to the device-side Core address, by design: that is how F55 was measured | `dev-probes.ts:104`, `:263` (`fetch(\`${CORE_ORIGIN}…\`)`), `:30` (`expo/fetch`) | The static test exempts that one file by name. It is debug-only, runs only from a `?probe=` deep link, and is in no release bundle (0 lines, section 5.7). Decision DN-4 |
| **F-5** | `createLiveSocketClient` is in the release bundle (1 line), because `@dems/shared/realtime` re-exports `live-socket-client.ts` from the same barrel as `HeartbeatProvider`, which the app imports statically | `packages/shared/src/realtime/index.ts:2`; section 5.7 | Not this row's, and nothing can call it in a release build. For the code review of `packages/shared` (W92): a subpath of its own would keep it out, the same remedy as W42's F-8 |
| **F-6** | **Settings shows a third segment "Live" now.** MD-3 adds `LIVE` to `CORE_LINK_SOURCES`, and the Settings control is built from that list (`features/settings/preferences-section.tsx:69`) | `live-settings.test.tsx` (three segments; LIVE disabled in a release build); the existing Settings tests pass unchanged; `mobile.coreLink.source.LIVE` was added so the segment has its text | In a debug build the segment switches to LIVE at once, without the confirmation dialog and the sign-out of [CS:§3.3] (W82). In a release build it is disabled, like HEARTBEAT. Until W56, W57, W59 and W60 land, a debug build in LIVE mode has a sign-in screen that is not Live-aware (finding F-7). Decision DN-3 |
| **F-7** | Until the later rows land, LIVE mode on the app is the runtime only: no pairing gate (`/login` is reachable while unpaired), the auth layer still reads a sign-in result as a value (the Live source would report `live.misuse`), `isSignInBlocked` knows HEARTBEAT only | `auth/auth-provider.tsx:146`, `:218`; `navigation/root-navigator.tsx` | By plan (W56, W59, W60). Nothing crashes at mount: `live-screens.test.tsx` and the device check |
| **F-8** | The first frame of a cold start in a debug build is drawn with a simulator object although the source may be LIVE | `app-providers.test.tsx` ("provides i18n, Query, heartbeat, the runtime stub and safe areas to the app") expects the children in the first frame, with a simulator | Solved by the waiting snapshot storage (section 3.1): nothing is read, written or started. Deviation DV-2 |
| **F-9** | `refetch()` of TanStack Query cancels a read that is out and starts another: two readers of the health query made two requests per resync | Found by this row's test | `use-health.ts` calls `refetch({ cancelRefetch: false })` |
| **F-10** | The first version of the presenter looked a refusal code up in a plain object: the code `toString` found an inherited function and crashed `t()` | Found by this row's own test before the first whole run | A `Map` now |
| **F-11** | The first version of the release fallback hung: with LIVE asked for and no Live source in the build, the simulator of the first frame had been told never to read its snapshot, so the runtime never became ready | Found by the test "a build that holds no Live source (MD-6) …" | The fallback mounts a simulator of its own that reads at once |
| **F-12** | A launch URL's `scenario=` is applied once per data source object (the existing rule, for StrictMode). After LIVE → SIMULATED a new simulator is mounted, and a scenario of the launch URL would be loaded again | `debug.ts`, `initialApplied` | Debug builds only; the `core=` value of the launch URL is applied once per process. Not changed |
| **F-13** | The 1-minute load average was 13 to 22 between 19:03 and 19:20 (this row's mutation run with seven other agents) | `uptime` | P9: the device check waited until 19:28 (load 11) |
| F-14 | `am start -W` reported `Status: timeout` for the cold start although the app was up one second later | Section 6, step A | F47, as known |

**Mismatches between the client layer and the real server: none found.** `hello` ANONYMOUS, the
connect-time heartbeat, `getAuthSession` 401, `getSignInStatus` 200 and `getServiceHealth` 200 were
taken by the typed client and the Live socket client without a contract violation and without a
report (`live.socket`, `live.client`: none in the device log). No REST request of the app carried
an `Origin` problem (the server answered all three). The sign-in, the pairing and the state topics
were not exercised: the device is not paired in this row.

## 9. Deviations

| ID | Deviation | Why |
|---|---|---|
| **DV-1** | The health call goes through the typed client (`live.client.call('getServiceHealth')`), not through the `fetchImpl` seam of the shared `fetchHealth` that [CS:§7.4] names | That seam would send a raw request with default options to the Core origin, which D69 forbids (the cookie store). The brief's rule 5 says the same |
| **DV-2** | MD-5 says "in LIVE mode `createSim` is not called". At a cold start of a DEBUG build the simulator object of the first frame is created before the stored source is known; with LIVE it reads nothing, writes nothing, never starts and is dropped | The existing provider test must pass unchanged (children in the first frame, with a simulator). What MD-5 protects holds: the snapshot is neither read nor written (tested), and no simulated data is shown (`BootGate` holds the splash until the runtime is ready). When the source is already known in the process (a later mount) the Live source is built in the first render and no simulator object is created; in a release build there is no wait and the simulator is the source |
| **DV-3** | The limit toast says "from this tablet" where LB-10's sentence says "from this console" | The mobile copy speaks of "this tablet" everywhere. Decision DN-5 |
| **DV-4** | A close with 4401 while nobody is signed in does not delete the credential by itself: operation 21 is asked, and its 401 deletes it ([CS:§6.5] and the Live source's §3.5 say "the app deletes the credential") | A deletion costs a new pairing code from a supervisor; it now rests on the Core's explicit 401 for this credential, which is also AC-C-79's wording. When the Core cannot be asked, nothing is deleted (tested) |
| **DV-5** | `RuntimeImplementation` gained the value `live` (`status.implementation` in LIVE mode) | The debug handle and the tests can tell the runtime apart; `RUNTIME_IMPLEMENTATION` stays `'simulator'` |
| **DV-6** | The lane database was not reset before the check ([PL:§5.3] resets it) | The check makes no state-changing call; the brief's rule 6 names no reset |
| **DV-7** | `.locks/core-server.lane1.pid` is emptied, not removed | "no `rm` outside `$TMPDIR`" |
| **DV-8** | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | The parallel-run contract of this delegation (P8): this document and the progress file are the row's |
| **DV-9** | Eight test files; two of them (`live-screens.test.tsx`, `live-settings.test.tsx`) render screens of other folders | They hold what the runtime owes those screens (they draw on the Live replica; the source list they are built from has its texts and its release gate); they change no file of theirs and press nothing that a later row will change |

## 10. Decisions for the controller

| ID | Decision | Recommendation |
|---|---|---|
| **DN-1** | F-1: the Pair chip `LIVE`, the one open item of this row's verification | Either allow this row one line in `features/pairing/pairing-connection.tsx` (plus `useCoreLink` in its import) and a repeat of step A of the device check, or make it the first line of W57 and take the screencap there. The text key and the source are ready |
| **DN-2** | F-2: the label "mock-core" on Stack Check in LIVE mode | One line in `features/home/home-screen.tsx` (no row owns that file). Or accept: the screen is a stack proof, and the version it prints is the Core server's |
| **DN-3** | F-6: the Settings segment "Live" is visible in debug builds from now on, before W82 adds the dialog and the sign-out | Accept for the interim (debug builds only; a release build shows it disabled), or schedule W82's dialog earlier |
| **DN-4** | F-4: the static test's one exemption, `runtime/dev-probes.ts` | Accept. The alternative is to remove the probe's raw calls (P0b, P11, P12), which were the measurement of F55 |
| **DN-5** | DV-3: "from this tablet" in the limit toast | Accept, or give the sentence |
| **DN-6** | The seam for the sign-in row (W56): `useMobileLiveRuntime()?.setBiometricPort({ token, sessionIssued })` | Put it into W56's brief. The row writes `src/auth/**` only and cannot reach the secrets port otherwise. A `sessionIssued` of that port gets 4 s and cannot fail the sign-in |
| **DN-7** | The seam for the gate row (W60): `usePairing()`, `isPairingBlocked()`; the notice texts (`revoked`, `unknown`, `unpaired`) are the Pair screen's (W57) | Put it into both briefs |
| **DN-8** | F-3: a Core-server example for operation 1 | To the contract close-out (W83) |
| **DN-9** | `core=` is stored like the Settings choice (MD-7 says "through `setCoreLinkSource`") | Every device check that opens the app with `core=LIVE` must end with a launch with `core=SIMULATED`, as this one did. Put it into the briefs of the device rows |

## 11. Error handling and logging

| Path | What is logged, where |
|---|---|
| Every report of the Live source (`onError`) | The persistent runtime log (`dems.mobile.log.v1`), under the report's own source (`live.…`), with its context; an envelope code as `errorCode` |
| A failure of the typed client that is no answer of the contract (no answer, time-out, contract violation, no credential) | `live.client`: operation ID, method, path template, class, status, request ID; once per operation and class in 30 s, with the count of what was left out |
| The stored credential cannot be read, written or deleted in time, or the storage call fails | `runtime.live.credentials.read`, `.write`, `.delete`, level `error`; a failing call by the error's NAME only. The wrapper logs its own failure by code (W15) |
| Operation 21 answered 401; another refusal | `runtime.live.registration`, level `warn`: status, envelope code, request ID |
| A registration that could not be removed after a failed write | `runtime.live.credentials.abandon`, level `error`: device ID, status, request ID |
| The biometric port fails or does not answer | `runtime.live.biometricPort`, level `error` |
| LIVE asked for in a build without a Live source | `runtime.live.unavailable`, level `warn` |
| `core=` applied; a scenario ignored in LIVE | `runtime.debug.core`, `runtime.debug.scenario`, level `info` |
| A toast that cannot be shown | `runtime.coreErrors.present`, `runtime.live.roleNotice`, level `error` |

No log line holds a credential, a token, a pairing code or a request body: asserted in
`live-device.test.tsx` ("nothing the app can read back holds the credential …") and
`live-runtime.test.tsx` ("holds no credential …"), and counted on the device and in the server
log (0 and 0). The request line `[DEMS-LIVE] …` goes to the development console only.

## 12. Rollback (not executed)

| Class | Paths | Command |
|---|---|---|
| R-NEW | `apps/mobile/src/runtime/core-errors.ts`, the eight `apps/mobile/src/runtime/live-*.test.tsx`, this document, the progress file, `assets/51_*` | `git clean -fd -- <paths>` |
| R-CO | `apps/mobile/src/runtime/{contract,core-link,sim-adapters,connection-banner,index}.ts`, `src/runtime/sim-runtime-provider.tsx`, `src/features/home/use-health.ts`, `src/i18n/en.mobile.ts` | `git checkout acaff20 -- <paths>` |
| R-PRE | `apps/mobile/src/runtime/debug.ts` (W12 wrote it before this row) | `git checkout acaff20 -- apps/mobile/src/runtime/debug.ts && git apply .cache/rollback/W51.pre.patch` (72 lines, saved at 18:07 before the first edit; SHA-256 `3329fb8d…a296b7d1b6`) |
| Device | `dems.mobile.prefs.v1` on `dems2_phone` holds `{"coreLinkSource":"SIMULATED"}` (absent before) | Nothing to undo: it is the default value. No other device state was changed |

## 13. Limits of this evidence

| Limit | Why it stands |
|---|---|
| The device ran unpaired only | Rule 7 of the brief. A paired start, a sign-in, a revocation and a role change are proven on the fake transport, not against the real server; W56, W57, W60 and the end-to-end rows do that |
| One emulator, one run | `dems2_phone` (phone layout). The tablet layout of the two screens was not looked at |
| The React Compiler | On in the Metro build, off in jest. The device run shows the provider, the adapters, the debug parameter and the health hook work compiled; the presenter's hook and the role notice were not exercised on the device (nobody was signed in) |
| The release behaviour | Proven by the release transform, by a release bundle's text, and in jest with the build flag flipped. No release APK was built or installed (no Gradle in this row) |
| Static test | It reads source text. A request built from an address that is put together at run time would pass it; rule 2 (the address is named by one file) is what makes that unlikely |
| Mutation check | Single text changes of this row's production files, each run against 11 test files; not the whole suite, and not `packages/shared` |

## 14. Assets (`implementation/assets/`)

`51_baseline.log`, `51_gate_final.log`, `51_test_hashes_before.txt`, `51_test_hashes_after.txt`,
`51_live_tests_verbose.txt`, `51_mutate.py.txt`, `51_mutating_transformer.cjs.txt`,
`51_jest_mut_config.cjs.txt`, `51_mutations_run1.log`, `51_mutations_final.log`,
`51_release_gate_w51.cjs`, `51_release_bundle_check.sh`, `51_release_bundle_check.log`,
`51_run_w51.sh`, `51_device_w51.sh`, `51_device_run.log`, `51_pair_live.png`,
`51_stack_check_live.png`, `51_after_reset_simulated.png`, `51_lock_status_start.txt`,
`51_lock_status_end.txt`.

---
*Generated: 2026-10-04 19:48 WIB*


*Last Updated: 2026-10-04 19:48 WIB*
