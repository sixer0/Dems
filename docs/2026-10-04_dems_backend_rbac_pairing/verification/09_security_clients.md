---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-07
agent: security-review
plan_row: W100 (02_plan.md:779)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
narrative_tier: 1
status: completed
verdict: CAUTION
---

# W100: security review of the two clients (web console, mobile app, shared client layer)

## 1. Verdict

**CAUTION. 0 Critical, 0 High, 1 Medium (carried over from W99-1, not re-triaged), 1 Low, 7 Info. 0 FAIL. Nothing blocks.**

| Count | Meaning |
|---|---|
| 0 FAIL | Every point the row asks about holds: SC10 (the client part), AC-C-65, AC-C-103, AC-C-105, SR-16, SR-32, the DEPARTURE-6 conditions, the Try-it deny list, the device log check and the unchanged release manifest |
| 1 Medium (W99-1, carried over) | The `npm audit` highs sit in the client trees: the mobile CLI and build tooling (braces, node-forge) and the web Scalar chain (undici). W99 counted them and placed them (E-11, E-12). This review quotes those numbers and does not triage them again. The CAUTION verdict comes from this item alone |
| 1 Low (W100-1) | The mobile runtime log filters context by key name only. It keeps `error.message` and `stack` with no value-level redaction of the three credential prefixes, while the web sink has that redaction. No leak was found (device: 0 matches). This is a gap in defence in depth |
| 7 Info | W100-2 to W100-8 (section 9) |

**Device log check** (emulator-5554, app `com.dems.demo.tablet`, PID 2681, paired to the main instance): strings that start with `dvc_`, `ses_` or `bio_`:

| Source | Lines / size | `dvc_` | `ses_` | `bio_` |
|---|---|---|---|---|
| `adb logcat -d`, whole buffer (10-06 09:25 to 10-07 09:53) | 329,236 lines | 0 | 0 | 0 |
| The app's process only (PID 2681, 08:48:48 to 09:53:01) | 199,061 lines | 0 | 0 | 0 |
| `ReactNativeJS` lines | 368 lines | 0 | 0 | 0 |
| AsyncStorage (`RKStorage`, whole file, byte scan) | 208,896 bytes | 0 | 0 | 0 |
| The persisted log `dems.mobile.log.v1` (200 records, 2026-10-06T09:57Z to 2026-10-07T02:37Z) | 55,914 chars | 0 | 0 | 0 |

The buffer already holds the flow the row asks for, in the current app process: `POST /api/v1/pairing/redeem 201` at 08:56:56, `POST /api/v1/auth/sign-in 200` at 08:59:19 and `POST /api/v1/auth/sign-out 204` at 09:37:23. No new sign-in was needed and none was made. The buffer has **no biometric enrolment**: there is no `auth/biometric*` call and no `dems.mobile.auth.v1` key. Jest proves the enrolment half (section 5.4).

**Release manifest unchanged**: `release/android/SHA256SUMS.txt` 8 of 8 OK; `release/web/SHA256SUMS.txt` 6 of 6 OK, and all 6 per-file `.sha256` OK. Apart from Finder's `.DS_Store`, the newest file under `release/` is dated 2026-10-01 11:48, before this task began. The six web hashes match the records of task 1 (`docs/2026-09-30_dems_demo_stack_setup`, 2 hits each). The APK hash matches 5 files of that task.

---

## 2. 5W1H (Tier 1)

| | |
|---|---|
| **What** | A read-only security review of the client side of the backend task: `apps/core-web`, `apps/mobile` and the client-facing parts of `packages/shared` (`src/live`, `src/client`, `src/api`). The focus is the uncommitted tree since `057fc17` (229 files changed in client scope, `git diff --stat 057fc17`; 334 `git status` entries). Checked: credential storage, logging, the Try-it deny list, CSP and origin pinning, deep links, the DEPARTURE-6 conditions, dependency risk (cited), a device log check and the release manifest |
| **Who** | Reviewer: security-review agent (tier R). Consumers: the controller, W101 (final verification of SC1 to SC11, which needs "PASS or an acknowledged CAUTION") and W102 (final report). Stakeholder: the single user and operator of a loopback demo on one Mac, with synthetic data only (SR-63 C1 to C4) |
| **When** | 2026-10-07 09:48 to 09:58 WIB. Load average 4.09 at the start and 3.99 at the end. W98 was measuring performance on the same instance and devices at the same time |
| **Where** | Repository `/Users/gsp-budi/Documents/DEMS`. Device emulator-5554 (read only). Dev server `127.0.0.1:5173`, which proxies to Core `127.0.0.1:4420` |
| **Why** | Plan row W100 (`02_plan.md:779`). Criteria: SC10; AC-C-65 (`04_client_integration_spec.md:1269`), AC-C-103 (`:1336`), AC-C-105 (`:1338`); SR-16 (`01_specs.md:1579`), SR-32 (`:1610`); MB-6a (`04_…:891`). W99 handed over two items (`02_security.md` §9: I-4, I-8, I-9) |
| **How** | (1) A static read of every module that stores, sends or logs a credential, cited with file:line. (2) Targeted test runs with one worker. (3) Two read-only GETs through the dev proxy for origin pinning. (4) `adb logcat -d` and a read-only copy of the app's AsyncStorage database through `run-as`, both scanned to a count in the scratchpad (no match printed, copies deleted afterwards). (5) `shasum -c` of the release manifests |
| **Alternatives considered** | A fresh password sign-in on the phone to fill the log. Not needed: the buffer already holds pairing, sign-in and sign-out from the current process, and the brief asks for minimal use of the device. Re-running `npm audit`. Not done, because the brief says to cite W99-1 |
| **Assumptions** | The tree reviewed is the tree that W101 will verify. W98 makes no client code change. A debug build is what runs on the emulators (W15 S0: `debugBuild: true`) |
| **Gaps** | (a) On the device, the marker password and the marker pairing code were not searched for. The rules forbid handling credential values, and the code used at 08:56 is unknown. Jest covers both (AC-C-65, AC-C-75). (b) The biometric enrolment is not in the device buffer (see section 1). (c) Web cookie attributes were not re-observed in a browser in this row. They are cited from W55's lane check and W99's SR-18 |

---

## 3. Commands and output (evidence)

**E-1: targeted web tests** (09:53, `apps/core-web`, `npx vitest run --maxWorkers=1 --no-file-parallelism`, with `live-api-reference-page`, `live-runtime-sink`, `fxr-w-dev-console-logging`, `live-runtime-storage`, `live-login-signin` and `lib/__tests__/packaged-csp`):
```
Test Files  6 passed (6)
     Tests  72 passed (72)
```
(The "failed to copy trust settings of system certificate" lines on stderr come from the sandbox's keychain access. They are not a test result.)

**E-2: targeted mobile tests** (09:53, `apps/mobile`, `npx jest --maxWorkers=1 --ci`, with `runtime/secure-credentials`, `runtime/secure-store-import`, `runtime/log`, `runtime/log-console`, `auth/live-auth`, `auth/live-auth-static`, `features/pairing/pairing-live-static` and `features/settings/settings-live-static`):
```
Test Suites: 8 passed, 8 total
Tests:       124 passed, 124 total
```
The full-suite ledger on the final tree is cited from D247: shared 71/1,851, core-web 117/1,495, mobile 191/1,985.

**E-3: origin pinning through the dev proxy** (09:56, two GETs):
```
Origin http://127.0.0.1:5173 -> GET /api/v1/auth/status 200
Origin http://localhost:5173 -> GET /api/v1/auth/status 403
GET /api/v1/health -> 200; content-security-policy: default-src 'none'; frame-ancestors 'none'; cache-control: no-store
```

**E-4: devices and listeners** (09:54). `adb devices -l` lists emulator-5554, 5556 and 5558 (the existing adb server, PID 83893; nothing was started). `lsof` shows only `127.0.0.1:4400`, `:4420`, `:5173` and `:8081` listening.

**E-5: Live HTTP lines in logcat** (method, path template and status only, as CL-6a prints them; 29 lines). They include `POST /api/v1/pairing/redeem 201` (08:56:56), `POST /api/v1/auth/sign-in 200` (08:59:19) and `POST /api/v1/auth/sign-out 204` (09:37:23), all from PID 2681. There are 0 biometric paths.

**E-6: other credential words** (counts):

| Word | Whole buffer | App PID | AsyncStorage |
|---|---|---|---|
| `Bearer ` | 0 | 0 | 0 |
| `authorization` | 6 (other processes) | 0 | 0 |
| `dems_session_` | 0 | 0 | 0 |
| `deviceCredential` / `sessionToken` / `biometricToken` | 0 / 0 / 0 | 0 | 0 |
| `password` | 174 (other processes) | 0 | 34, all in `dems.sim.v1`: the simulator's audit labels `"method":"PASSWORD"` and "signed in … via password" (synthetic). There are 0 in the log and 0 in the prefs |

AsyncStorage keys present: `dems.mobile.log.v1`, `dems.mobile.prefs.v1` and `dems.sim.v1`. The persisted log's context keys are names of states and metrics only (for example `operationId`, `path`, `status`, `requestId`, `sessionId`, `reason`). None of them is a credential key.

**E-7: release manifest**: see section 1. `release/` is git-ignored (`.gitignore:64`), so the SHA256SUMS files are the reference.

---

## 4. Web console (`apps/core-web`)

### 4.1 Token storage (SR-16, AC-C-38): PASS

| Point | Evidence |
|---|---|
| The session is only an `HttpOnly; SameSite=Strict; Path=/` cookie, with no Max-Age and a name per instance. No `Secure` (the accepted loopback deviation, OR-8 / D16) | `apps/core-server/src/modules/identity/cookie.ts:8-12, :25`; W99 SR-18 Met |
| The web client never handles the token. The `'browser-cookie'` mode sends `credentials: 'same-origin'` and never an `Authorization` header | `packages/shared/src/client/core-client.ts:15, :571-572, :687-691` |
| A web sign-in answer holds no token in its body | `packages/shared/src/api/identity.ts:292` |
| Live check: `document.cookie` is empty, no web-storage value starts with `ses_`, and `dems.auth` and `dems.sim.v1` are not written | `implementation/55_web_login.md:37, :322-323` (W55 lane check) |
| What the console writes to web storage: prefs (`dems.core.mode.v1`, rail, motion, presentation, shell intro, demo controls) and the owed sign-out debt. The debt record holds exactly `{operatorId, issuedAt, reason, at}` and no credential | `runtime/owed-sign-out-storage.ts:84-87`; `runtime/core-mode.ts:25`; `features/system/sim-adapter.ts:163-199` |
| Scalar keeps no request body, answer or auth (`persistAuth: false`). After live Try-it calls: `localStorage: []`, `indexedDb: []` | `features/api-reference/scalar-config.ts:30`; `implementation/84_web_api_reference.md:143, :216` (F84-1) |

### 4.2 What the web logs: PASS

| Sink | Rule | Evidence |
|---|---|---|
| `webErrorSink` (in memory, 200 records; console in a dev build only; never sent, never stored) | Every message, stack and context string passes through `redactCredentials` (`(ses\|dvc\|bio)_…` becomes `$1_***`) | `runtime/error-sink.ts:51-55, :70-84, :99` |
| Login errors (D242/D247, W92-5) | A fixed sentence plus `errorName`. The error's own text and stack are never recorded, and the username is not logged | `features/login/report.ts:7-10, :43-56` |
| API Reference log (AR-9, D182) | Method, path (no query) and status only. Never a body, answer, header or stack | `features/api-reference/log.ts:7-17, :41-45` |
| Boot guard (D242 W92-2) | One record without the error text, then a static sentence | `main.tsx:86-101` |
| Route error boundary | Fixed sentence plus error class | `components/shell/root-error.tsx:7-8, :19, :29-32` |
| Direct `console.*` calls | All six sit under `import.meta.env.DEV` or are not credential-bearing: `i18n.ts:40`, `exit-guard.tsx:29`, `use-shell-layout.ts:68`, `camera-feed.tsx:185`, `presentation-mode.ts:45`. `heartbeat-client.ts:85` is the mock-core heartbeat (Simulated), and the API Reference passes its own `onInvalidMessage` (`use-realtime-feed.ts:144`) | grep output (09:50) |
| Tests | `fxr-w-dev-console-logging`, `live-runtime-sink` and `live-login-signin` pass (E-1). AC-C-107 marker scans were run by W55, W81 and W84 | E-1 |

### 4.3 Try-it deny list (AC-C-103, AR-3a, SD-16): PASS

- The list is `signIn`, `setBiometricEnrollment`, `signInWithBiometric`, `issuePairingCode`, `redeemPairingCode` and `rotateDeviceCredential`. These are exactly operations 2, 7, 8, 15, 18 and 23 of AR-3a (`04_client_integration_spec.md` AR-3a). Code: `features/api-reference/try-it.ts:35-42`.
- The check runs before any request. `deniedTryItOperation` matches the request as sent and again on a normalised path (percent-decoded, lower case, slashes folded): `try-it.ts:84-125`. The refusal is thrown at `:204-211`, before `networkFetch` at `:217`. The log line holds method and path only.
- A URL outside `{page origin}/api/v1` is blocked (`:196-203`). The request passes on with `credentials: 'same-origin'` only (`:217-222`).
- Wiring: Live mode uses `createLiveTryItFetch` as Scalar's `customFetch` (`features/api-reference/index.tsx:118, :145`).
- Test: `live-api-reference-page.test.tsx` passes (E-1).

### 4.4 CSP and origin pinning: PASS (with Info W100-4)

| Point | Evidence |
|---|---|
| Live mode exists in dev builds only. A production or packaged build is Simulated, whatever is stored | `runtime/core-mode.ts:11`; `runtime/boot.ts:40` (`import.meta.env.DEV ? import('./live-start') : null`) |
| A Live page that is not on `http://127.0.0.1` starts no data source and shows the refusal | `runtime/live-host.ts:19-21, :42-51`; `main.tsx:64-73` |
| The server refuses `localhost`: 403 (E-3). Vite listens on `127.0.0.1` with `strictPort`, and has `cors: false` while the proxy is on | `apps/core-web/vite.config.ts:41, :57-62` (unchanged since `057fc17`) |
| Packaged CSP: `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` (header). It names no host outside loopback | `lib/packaged-csp.ts:51-65` |
| The packaged CSP `connect-src` also allows `ws://localhost:<port>`. That serves the Simulated packaged build of task 1 (mock-core heartbeat). The file has not changed since `acaff20`, and the release artefacts are frozen | `lib/packaged-csp.ts:60`; Info W100-4 |
| The Core API answer carries `content-security-policy: default-src 'none'; frame-ancestors 'none'` and `cache-control: no-store` | E-3 |

---

## 5. Mobile app (`apps/mobile`)

### 5.1 Credential storage (SR-16, SR-32, MP-1, AC-C-66): PASS

| Point | Evidence |
|---|---|
| Exactly one module imports `expo-secure-store` | `runtime/secure-credentials.ts:26`; the static test `secure-store-import.test.ts` passes (E-2) |
| The device credential (`dems.live.device.v1`) and the biometric token and marker are in the secure store only. A value is never logged and never put into an error. A failure is recorded by code and item name | `secure-credentials.ts:8-23, :151-160` |
| The session token on mobile lives only in memory (`memory.session`). It is dropped at a local end and when the device is forgotten | `runtime/sim-adapters.ts:406-409, :552-554, :588, :609-611` |
| AsyncStorage holds only prefs (`dems.mobile.prefs.v1`), `dems.mobile.auth.v1` (`{lastOperatorId, biometricEnabled}`), the simulator snapshot (gated in Live, `createDeferredPersistStorage`) and the log | `auth/auth-prefs.ts:1-7, :43-47`; `sim-adapters.ts:107-113`; device E-6 |
| `android:allowBackup="false"` | `app.json:23`; `android/app/src/main/AndroidManifest.xml:16` |

### 5.2 What the app logs: PASS (with Low W100-1)

| Sink | Rule | Evidence |
|---|---|---|
| Runtime log (memory, plus AsyncStorage `dems.mobile.log.v1`, 200 records) | Context is filtered by key name (`pass`, `pin`, `token`, `secret`, `credential`, `user`, `code`, `pairingcode`, `otp`). Values are primitives only, truncated to 200 characters | `runtime/log.ts:42, :74-84` |
| Console mirror (D203 DX-6) | `__DEV__` only. `error` goes to `console.error`, everything else to `console.info`. W98's measurement records are kept off the console (D246) | `log.ts:184-188, :242-249`; `navigation/log.ts:25-31`; `motion/log.ts:26-31` |
| Typed-client failures | Operation, method, path template, kind, status and request ID. Never a body, header, URL or provider text | `sim-adapters.ts:446-468`; `core-client.ts:288` |
| `[DEMS-LIVE]` line | `console.info` of method, path template, status and request ID (`core-client.ts:616, :772` emit `operation.path`). It is guarded by `!IN_JEST`, not by `__DEV__` (Info W100-5) | `sim-adapters.ts:476-479` |
| Route error (D243 W93-13, D246) | Recorded once to the runtime log at level `error` (`message` and `stack`). Mirrored once to the dev console | `navigation/route-error-fallback.tsx:25-27` |
| Device | 0 prefix matches in logcat (whole buffer, app PID, ReactNativeJS) and in the persisted log | Section 1, E-6 |
| **Gap** | `toRuntimeLogRecord` and `fromSibling` keep `error.message` and `stack` with no value-level redaction. The web sink has that redaction (`error-sink.ts:51-55`) | `log.ts:95-108, :250-261`; Low W100-1 |

### 5.3 Deep links: PASS

| Point | Evidence |
|---|---|
| Scheme `demsdemo` and one intent filter. No `https` App Links | `app.json` (`scheme: demsdemo`, no `intentFilters`); `AndroidManifest.xml:26-31` |
| No credential travels in a link. The pairing screen reads no route parameter (the code is typed). The core client refuses a bearer-shaped value, and the current bearer, in a URL | `app/pair.tsx`; grep of `features/pairing` (no `SearchParams`); `core-client.ts:435-445` |
| Guarded routes: `(app)` exists only while signed in (`Stack.Protected`). A guarded link while signed out is kept as a pending href in memory and opens `/login`. Sign-out clears it. While the pairing gate holds, a gated link opens `/pair`. The URL is never logged | `app/(app)/_layout.tsx:9-12`; `app/+native-intent.tsx:12-44`; `navigation/pending-href.ts:17, :25` |
| Debug hooks (`scenario=`, `probe=`, `core=`) sit under a literal `__DEV__` and are dropped from a release bundle. In LIVE, `scenario=` is ignored | `runtime/debug.ts:1-24, :74, :89, :126-130` |
| Release is Simulated-only. LIVE and HEARTBEAT need `__DEV__` | `runtime/core-link.ts:33-38` |
| Cleartext only in the `debug` and `debugOptimized` manifests. `main` has none | `android/app/src/debug/AndroidManifest.xml:6`; `debugOptimized/AndroidManifest.xml:6`; `grep` of `main/AndroidManifest.xml` (no `usesCleartextTraffic`) |

### 5.4 DEPARTURE-6 conditions (MB-6a, AC-C-105, SD-18): PASS

| Condition | Evidence |
|---|---|
| (1) The case in use is recorded per AVD | `implementation/15_secure_store_wrapper_probe.md:29, :202-214, :294`: case (c) on `dems2_phone`, `dems2_tablet` and `dems2_phone2`, with `isDevice: false` and a debug build |
| (2) Case (c) only where `isDevice` is false or the build is a debug build. Elsewhere the write is refused with `UNPROTECTED_NOT_ALLOWED` and both items are deleted. No silent fallback: the fallback writes a `warn` record (`biometricFallback`, with `isDevice` and `debugBuild`). A cancelled prompt never falls back | `secure-credentials.ts:256-258` (`Device.isDevice === false \|\| __DEV__ === true`); `:331` (no fallback for `protected` or `USER_CANCELED`); `:334-338`; `:341-350`; rotation `:359-366` |
| (3) No claim of hardware protection. While `protected` is not true, the Live note is exactly "Biometric sign-in asks for this device's screen-lock check." (the MB-6a sentence). The protected variant says only that the screen-lock check comes before the token is read | `auth/i18n.ts:8-9, :26`; `features/settings/settings-model.ts:165-167, :198-205`; `i18n/en.mobile.ts:67`; a grep for `hardware`, `keystore`, `secure enclave` and `strongbox` in the mobile and shared strings finds no claim about the token |
| Tests | `secure-credentials.test.ts`, `live-auth.test.tsx` ("nothing secret is readable", AC-C-65, including enrolment and the marker password and code) and `settings-live-static.test.ts` pass (E-2) |
| Scope note | A Live build on a physical device is U4 and needs a new security review (MB-6a (2)). No such build exists: the release APK is unchanged and Simulated-only |

### 5.5 Owed sign-out (W99 I-4): Info W100-2

On mobile no debt port is passed, so the debt lives in the Live source's memory. A local end drops `memory.session` (`sim-adapters.ts:609-611`). The next socket is a DEVICE socket, and "a socket that is no OPERATOR socket means the credential names no session: nothing is owed" (`packages/shared/src/live/source/live-sim.ts:58-66`). So the client does not retry the sign-out. The server session ends at the 15-minute idle expiry (W99 §7.13). The token cannot be recovered on the device (memory only), so no client can replay it. The web console keeps the debt in `localStorage` and settles it before it takes a session (`owed-sign-out-storage.ts:1-31`). This is accepted as a residual risk.

---

## 6. Shared client layer (`packages/shared/src/client`, `src/live`, `src/api`): PASS

- The client is built only with `'browser-cookie'` or a bearer function (`core-client.ts:536-540`). The bearer value is checked by shape (`:571-577`) and refused in a URL (`:435-445`, `:683`).
- A report holds no body, header, URL or provider text (`core-client.ts:288`). A contract violation names members, never values (`:180`). The log line holds method, path template, status and request ID (`:280-286`, `:616`, `:772`).
- The Live source writes nothing itself. A local end clears the replica. The debt holds no credential (`live-sim.ts:45-56`).
- The mock-core constants `WEB_DEV_ORIGINS` and `SELF_ORIGINS` still list `localhost` (`api/constants.ts:27, :29`). They are used by mock-core (Simulated) only, and the Core server's lists are its own configuration (OR-7). See Info W100-4.

---

## 7. Dependency risk in the client trees (cited from W99-1; not re-triaged)

From `verification/02_security.md` E-11 and E-12 (08:52 to 08:54, lockfile unchanged since `b90a3c6`):

```
npm audit --omit=dev -> 124 (5 low, 23 moderate, 96 high), critical 0
npm audit            -> 132 (5 low, 28 moderate, 99 high), critical 0
17 distinct advisories: high 4 (braces, node-forge, undici x2)
```

Client placement (W99 E-12): braces 3.0.3 and node-forge 1.4.0 are under `@dems/mobile` > expo > `@expo/cli` (build and CLI tooling). undici 7.29.0 (fix `>=7.29.1`) is under `@dems/core-web` > `@scalar/api-reference-react` > … > `@scalar/json-magic`, and is a shared devDependency. The moderates are in mobile tooling and the jest preset. The low is in Scalar's agent-chat (web). **Status: Medium, CAUTION, owned by W99-1.** Remediation as W99 proposed: a final-report item (W102) and the proposed reserved row W106, a dependency refresh through the Scalar packages. Do not run `npm audit fix` blind on the Expo chain.

---

## 8. Requirement and criterion table

| ID | Result | Evidence |
|---|---|---|
| SC10 (client part: no secret committed, no real personal data, nothing sent out) | PASS | No client sink sends anything out (`error-sink.ts:9-10`; `login/report.ts:6-7`). Synthetic data only. Device scans show 0 (section 1). W99 owns the repository secret scan (0 hits) |
| AC-C-65 | PASS | Jest (`live-auth.test.tsx`, E-2). Device: 0 `dvc_`, `ses_`, `bio_` in logcat and in AsyncStorage, the persisted log included, after pairing and sign-in. No enrolment in the buffer (gap b). Marker values are jest-only (gap a) |
| AC-C-103 | PASS | Section 4.3; `live-api-reference-page.test.tsx` (E-1); W84 live check |
| AC-C-105 | PASS | Section 5.4 |
| SR-16 | PASS | Web: sections 4.1 and 4.2. Mobile: section 5.1 (memory only) |
| SR-32 | PASS | Section 5.1; device E-6 (`deviceCredential` 0, `dvc_` 0) |
| DEPARTURE-6 | PASS | Section 5.4 |
| Debug-only cleartext | PASS | Section 5.3 |
| Release manifest unchanged | PASS | Section 1, E-7 |
| W99 I-4 / I-8 / I-9 | Info | W100-2; W100-7; W100-8 |

---

## 9. Findings

| ID | Severity | Finding | Location | Remediation (owner) |
|---|---|---|---|---|
| **W99-1** | **Medium (CAUTION)**, carried over | `npm audit` highs in the client trees (mobile tooling, web Scalar chain). Numbers and placement are from W99. Not re-triaged here | `02_security.md` E-11, E-12 | As W99: a W102 final-report item and the proposed reserved row W106 (controller decision) |
| **W100-1** | Low | The mobile runtime log keeps `error.message` and `stack` (persisted in release builds too) and filters context by key only. Unlike the web sink, it has no value-level redaction of `ses_`, `dvc_`, `bio_`. Today the callers pass only codes (`secure-credentials.ts:151-160`), and the device shows 0 matches. A future caller that logs a raw error would be the only line of defence | `apps/mobile/src/runtime/log.ts:95-108, :250-261` vs `apps/core-web/src/runtime/error-sink.ts:51-55` | Apply the same `/\b(ses\|dvc\|bio)_[A-Za-z0-9_-]+/g` redaction to `message`, `stack` and string context values in `toRuntimeLogRecord` and `fromSibling`, and add one jest case. Small, with no behaviour change. Proposed for the pre-commit tidy-up or one of W106 to W109 (controller decision). Not a blocker |
| W100-2 | Info | The owed sign-out is not retried on mobile. The server session lives until the 15-minute idle expiry. The token is gone from memory | Section 5.5 | None for the demo. Next phase: keep a credential-free debt and settle it with the device credential, if the server gains such an operation |
| W100-3 | Info | No CSP on the dev server page (Vite dev, inline refresh preamble). Live mode exists only there | `packaged-csp.ts:27-29`; `boot.ts:40` | None for the loopback demo. Any build that ships Live mode needs a CSP and a new review (U4) |
| W100-4 | Info | The packaged CSP `connect-src` lists `ws://localhost:<port>`. The mock-core origin constants list `localhost`. Both serve the Simulated paths of task 1 and carry no credential. The Live path is pinned to `127.0.0.1` (E-3: `localhost` gets 403) | `lib/packaged-csp.ts:60`; `packages/shared/src/api/constants.ts:27, :29` | Next phase, at the next packaging: drop `localhost` from both. Not now, because the release artefacts are frozen |
| W100-5 | Info | The `[DEMS-LIVE]` console line is guarded by `!IN_JEST`, not `__DEV__`, although its comment says "development console only". In practice it is dev-only, because LIVE is unavailable in a release build (`core-link.ts:36-38`). Content: method, path template, status and request ID | `apps/mobile/src/runtime/sim-adapters.ts:476-479` | Add `__DEV__ &&` to make the comment true by construction. Cheap; tidy-up |
| W100-6 | Info | The device log check covered pairing, sign-in and sign-out but not enrolment. The marker values were not searched for on the device | Section 2, gaps (a) and (b) | Covered by jest (AC-C-65). If the controller wants device proof of the enrolment half, run one enrolment in W94 to W96 style and read the log, not before W98 ends |
| W100-7 | Info | W99 I-8: Metro (8081) also opens UDP `*:5353` (mDNS). It is dev tooling and not shipped. Not re-measured here (cited from W99 E-02) | `02_security.md:134` | None. Metro runs only on the developer Mac |
| W100-8 | Info | W99 I-9 confirmed as intended. `features/home/use-health.ts` moved to `lib/health-query.ts` (D242 ruling, D247 FXR-W). `core-queries.test.tsx:274` asserts that the old file is absent. `release/web/BUILD-INPUTS.txt:168` still names the old path (a packaging record in frozen `release/`, D247 note) | `apps/core-web/src/lib/health-query.ts:5` | None for security. Packaging takes it at the next release build |

---

## 10. GDPR and ISO 27001 / 27002 / 27701, as applicable to a synthetic-data loopback demo

The clients process synthetic operator records and evidence metadata only (SR-63 C1). No real personal data reaches them. The assessment below is about readiness, not certification.

| Control | Status | Finding |
|---|---|---|
| GDPR Art. 5 (minimisation) | ✅ | The clients store prefs, a credential-free debt, operator IDs (`OPR-…`) and a synthetic simulator snapshot. The log drops identity keys (`user`, `username`) |
| GDPR Art. 5 (storage limitation) | ✅ | The log is a 200-record ring buffer. The web sink is 200 records in memory. The cookie lasts for the browser session. Secrets are deleted on unpair or revoke (`deleteDeviceCredential`) |
| GDPR Art. 25 (privacy by design) | ✅ | No client log endpoint. Sinks are local only. The token is kept off JS on the web and in memory or the secure store on mobile |
| GDPR Art. 32 (security of processing) | ✅ / ⚠️ | Covered by sections 4 and 5. ⚠️ W100-1 (defence in depth) |
| GDPR Art. 15/16/17/20, 30, 33, 35 | n/a | Server-side or organisational. Synthetic demo (W99 §10) |
| ISO A.9 (access control) | ✅ | Guarded routes, a pairing gate and RBAC waits on both clients (W93-11 rule). The server enforces them (W99) |
| ISO A.10 (cryptography) | ⚠️ accepted | Loopback HTTP with no TLS (OR-8 / D16 accepted deviation). Keystore-backed secure store on Android. Case (c) on emulators per DEPARTURE-6 |
| ISO A.12.4 (logging) | ✅ / ⚠️ | Structured logs with no credentials. ⚠️ W100-1 |
| ISO A.12.6 (vulnerability management) | ⚠️ | W99-1 (cited) |
| ISO A.14.2 (secure development) | ✅ | Static tests for importers and wording, mutation-tested gates (D247), and targeted security tests green (E-1, E-2) |
| ISO 27701 (PIMS) | n/a | No real PII. Next phase if real data is ever handled |

---

## 11. Remediation recommendations (priority order)

1. **W99-1** (Medium, carried over): dependency refresh through the Scalar packages (undici `>=7.29.1`), as W99 proposed. The controller decides on W106.
2. **W100-1** (Low): add value-level credential redaction to the mobile runtime log, mirroring `redactCredentials`, with one jest case.
3. **W100-5** (Info): gate `[DEMS-LIVE]` with `__DEV__`.
4. **W100-4** (Info, next packaging): remove `localhost` from the packaged CSP and the mock-core origin constants.
5. Before any build that ships Live mode or runs on a physical device (U4): add a CSP for that build, use TLS, and run a new security review (MB-6a (2)).

---

## 12. Verification

- ✅ Security scan completed (sections 4 to 7, with file:line or command output for every item)
- ✅ Device log check completed: counts only, no match printed, temporary copies deleted
- ✅ Release manifest verified (`shasum -c`)
- ✅ GDPR / ISO mapping completed (section 10)
- ✅ Read-only. Files written: this report and `delegation_progress/w100_security_clients.md`. Two GETs through the dev proxy and the `adb` reads were the only contact with running services. Nothing was started or stopped (adb server PID 83893 is the existing one)

## 13. Issues / decisions

| Item | Issue / decision | Resolution |
|---|---|---|
| Fresh sign-in | Not needed: the buffer of the current app process holds redeem, sign-in and sign-out | No UI was driven on the device |
| Sandbox | The sandbox blocked the adb socket (tcp:5037), `ps` and loopback HTTP. The sandboxed `adb devices` printed "daemon not running; starting now" but failed ("didn't ACK"). The existing server (PID 83893) was untouched | Read-only adb and curl were re-run outside the sandbox |
| Verdict | CAUTION only because the client trees carry W99-1 | W101 can treat it as an acknowledged CAUTION if the controller accepts W99-1's routing |

## 14. Next steps

- Controller: accept or route W100-1 (tidy-up or W106 to W109) and W100-5. Acknowledge W99-1 for W101.
- W101: uses this verdict. W102: lists W99-1, W100-1 and W100-2 to W100-4 in the final report.

---
*Generated: 2026-10-07 09:58*
*Last Updated: 2026-10-07 09:58*
