---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 34
plan_row: W12 (early proof e, wave E3)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete (the emulator proof ran on 2026-10-04 11:06 WIB, section 17; the contract A and contract C adaptations are in sections 16 and 18)
---

# 12 Proof (e): the registry-driven typed client and its emulator proof (blueprint step 34, plan row W12)

Row, verbatim: [W12] Early proof e (time box 90 min): the registry-driven typed client HB-9 in
`packages/shared/src/client/` (written against the registry as it stands), a debug-only probe module
with its one hook, a socket route added to the harness; proven on one debug-build emulator with the
default `expo/fetch`; the harness log records which `Origin` the app sends.

**Result line (11:06 WIB, section 17): TD-09 registry-driven client CONFIRMED on Hermes / expo-fetch.**
On the lock-free emulator `dems2_phone` (`emulator-5554`, lane 1) the probe reports 15 of 15 checks
PASS: GET, POST with a body and a bearer header, the error envelope, 429 with `retry-after`, a
contract violation, no answer, the time-out, and a socket with the bearer value in an upgrade header
and close codes 4403 and 4401. Fallback row Fe is not needed. One correction came out of the first
device run (the global `fetch` is Expo's wrapper around `expo/fetch`, not the export itself), and
one finding for the server's socket rules (the upgrade carries a cookie when the app's cookie store
holds one): both in section 17.

Result line of 07:25, kept for the record: the proof was NOT YET PROVEN then, because all three
emulators of that time sat at the Android PIN keyguard (section 8). No FAIL was observed.

| Field | Value |
|---|---|
| Client (HB-9) | Done. `packages/shared/src/client/` (2 files). Generic over the operation registry: 10 operations today, 75 when the registry holds 75, with no change in the folder |
| Unit tests | Done. 3 new files, 76 tests. `@dems/shared`: 584 passed of 584 in 31 files (508 before) |
| Probe and hook | Done. `apps/mobile/src/runtime/dev-probes.ts` (new) and one call in `apps/mobile/src/runtime/debug.ts`. A release bundle holds neither (measured, section 5.3) |
| Harness | Done. `.cache/proof-harness/harness.mjs` extended: contract-valid canned answers checked against the registry at start, header logging, the socket route |
| Host control run | PASS, 7 of 7 checks: the same client under Node against the harness (section 7). It is a control, not the proof |
| Emulator proof | **Done at 11:06 on `dems2_phone`: 15 of 15 PASS** (section 17). At 07:14 it was blocked by the PIN keyguard of the older emulators (section 8) |
| Which `fetch` is active on the device | Measured (17.3): Expo's relative-URL wrapper `_fetch` around `expo/fetch`; its answers have the class of an answer of the `expo/fetch` export. Section 9 is the state before the measurement |
| Headers the app sends (Origin!) | Measured (17.4). REST: **no `Origin`**. Socket upgrade: `Origin: http://127.0.0.1:4420`, the bearer header, and a `Cookie` when the app's store holds one. Section 10 is the static reading before the measurement; the measurement confirms it |
| Mobile gate | `@dems/mobile`: 833 passed of 833 in 72 suites; the release-gate test file is byte-identical to `acaff20` |
| Row window | First timestamp 06:53:51 WIB; last run 07:20:51. Inside the 90-minute box |
| Left running | Nothing. No listener on 4421 or 8082, no reverse rule on `dems_phone`, lane-1 PID file removed (section 13) |
| Fix round after CP-C1 (13:08 to 13:15) | Done (section 19): the credential provider is inside the call's one time-out and can no longer make a call hang or reject (CPC1-3); the URL guard's prefixes are tied to the contract by a test and marked `CONTRACT-GAP-4` (CPC1-12). `@dems/shared` 1,668 of 1,668 in 65 files |
| Contract C adaptation (11:07 to 11:10) | Done (section 18): the input type no longer overflows with 75 operations (TS2590); one by-design test change; one regression test. `@dems/shared` 1,406 of 1,406; `@dems/mobile` 833 of 833; typecheck of shared, mobile, core-web and core-server exit 0 |
| Follow-up, contract A (08:46 to 08:56) | Done, code only (section 16). The client follows the contract of W19: the registry's literal table is its default, so `call` is typed per operation; `epoch` is an integer; `details` and `requestId` of the envelope reach the caller; the query of a GET is parsed with its schema. `@dems/shared` 804 of 804; `@dems/mobile` 833 of 833. Sections 2 to 4 describe the state before it; where they differ, section 16 holds |

Evidence files (copies, so that they outlive the scratch folder): `implementation/assets/12_*`:
`12_run_w12_device_blocked.log`, `12_host_control.txt`, `12_harness_host_control.log`,
`12_release_bundle_check.log`, `12_gate_static.log`, `12_gate_shared_test.log`, `12_gate_mobile_test.log`,
`12_screen_dems_phone_locked.png` (the phone's display: black, keyguard), and the scripts
`12_harness.mjs`, `12_run_w12.sh`, `12_device_w12.sh`, `12_host_control_w12.mjs`,
`12_release_gate_w12.cjs`, `12_release_bundle_check.sh`. No file holds a credential: the only bearer
values are fake strings made at run time, and the harness logs their first 4 characters and length.

---

## 1. Files

| Path | Change | What |
|---|---|---|
| `packages/shared/src/client/core-client.ts` | new (670 lines with comments and types) | The client |
| `packages/shared/src/client/index.ts` | replaced W03's one-line placeholder | Public exports of `@dems/shared/client` |
| `packages/shared/test/client-core.test.ts` | new, 63 tests | Requests, validation, failure classes, headers, credentials, log |
| `packages/shared/test/client-types.test.ts` | new, 6 tests | Type-level proof of "typed in, typed out" (checked by `tsc`) |
| `packages/shared/test/client-platform-neutral.test.ts` | new, 7 tests | Static scan of the client folder (AC-C-02) |
| `apps/mobile/src/runtime/dev-probes.ts` | new | The debug-only probe module |
| `apps/mobile/src/runtime/debug.ts` | 41 lines added, 1 changed | The one hook, inside `if (__DEV__)` |
| `.cache/proof-harness/harness.mjs` | extended (git-ignored) | Canned contract answers, header log, socket hello |
| `.cache/proof-harness/run_w12.sh`, `device_w12.sh`, `host_control_w12.mjs`, `release_gate_w12.cjs`, `release_bundle_check.sh` | new (git-ignored) | The run, the device commands, the control run, the release checks |

Not touched: `packages/shared/src/api/**` (P17), `packages/shared/src/sim/**`, any file of another row.
No package was added; no `package.json` or lockfile was written.

---

## 2. The client's public API (`@dems/shared/client`)

> State of 07:25. Changed by the follow-up (section 16): `epoch` is an integer, the option
> `requestIdHeader` is gone (the header is pinned), a query is parsed with its schema when the
> operation names one, and a client made without `operations` is typed per operation.

```ts
const client = createCoreClient({
  baseUrl: 'http://127.0.0.1:4420',       // an http(s) origin, or '' for same-origin relative URLs
  credentials: () => currentBearer(),      // mobile: `ses_…`, else `dvc_…`, else null. Web: 'browser-cookie'
  fetch,                                   // optional: the global fetch is looked up at each call when left out (CL-3)
  timeoutMs: 8_000,                        // optional: LIVE_COMMAND_TIMEOUT_MS (CL-6)
  log: (line) => {},                       // optional: { method, path, status, requestId } and nothing else (CL-6a)
  report: (entry) => {},                   // optional: NETWORK, TIMEOUT, CONTRACT_VIOLATION go here (CL-4 "reported")
  operations, schemas, requestIdHeader, now, // optional: default to the registry, 'x-request-id', Date.now
});

const result = await client.call('exportEvidence', { params: { id }, body: { reason } });
client.operationIds;                       // the registry's IDs, in its order
client.describe('exportEvidence');         // { operationId, method, path, hasBody, pathParam } or null
```

`call(operationId, input)` takes `{ params?, query?, body? }` and resolves with one of two shapes. It
rejects only with `CoreClientUsageError` (a programming error, CL-1).

| Result | Members |
|---|---|
| Success | `ok: true`, `operationId`, `status`, `data` (parsed by the registry schema of that status; `undefined` for a status without a body), `epoch` (`x-dems-epoch` as text, or null), `revision` (`x-dems-revision` as an integer, or null), `requestId` |
| Failure | `ok: false`, `operationId`, `kind`, `status` (null when there was no answer), `error: { code, message }` (the envelope member as `ApiErrorSchema` parses it), `retryAfterSeconds`, `transport`, `requestId`, and for a contract violation `issues` (`path: issue code`, never a value) |

Failure classes (`CoreErrorKind`) and the transport reason that CL-21 needs:

| Answer | `kind` | `transport` |
|---|---|---|
| 400, and any 4xx without its own class (405, 413) | `BAD_REQUEST` | null |
| 401 | `UNAUTHENTICATED` | null |
| 403 | `FORBIDDEN` | null |
| 404 | `NOT_FOUND` | null |
| 409 | `CONFLICT` | null |
| 422 | `INVALID` | null |
| 423 | `LOCKED` | null |
| 429 | `RATE_LIMITED`; `retryAfterSeconds` holds `retry-after` (delta-seconds or an HTTP date) | `UNAVAILABLE` |
| 503 | `NOT_READY` | `CORE_OFFLINE` |
| Any other 5xx | `SERVER` | `UNAVAILABLE` |
| The transport rejected (no answer) | `NETWORK`, `error.code` `NETWORK` | `CORE_OFFLINE` |
| No answer within the time-out; the request is aborted and not retried | `TIMEOUT`, `error.code` `TIMEOUT` | `CORE_OFFLINE` |
| Not JSON; a 2xx status the operation does not document; a body its schema refuses; a status outside 2xx, 4xx, 5xx | `CONTRACT_VIOLATION`, `error.code` `CONTRACT_VIOLATION`; the body is never returned | `UNAVAILABLE`; `CORE_OFFLINE` when a 502, 503 or 504 has no envelope (the dev proxy with the backend down, WT-4) |

How the rules are met:

| Rule | In the code |
|---|---|
| CL-1 | One generic `call`. Never throws for an HTTP status. `CoreClientUsageError` for: an unknown operation, a missing or unknown path parameter, a body on an operation without one, a missing required body, a query on a POST, a credential in a path or query value, a bearer value that cannot be a header value, a base URL that is not a bare origin |
| CL-2 | `'browser-cookie'`: `credentials: 'same-origin'`, no `Authorization` header. A function: asked at every call (may be asynchronous); its value becomes exactly one `Authorization: Bearer` header; `credentials: 'omit'`, so no cookie jar is used |
| CL-3 | The body is read with `text()` and `JSON.parse`. The static test forbids `.json()`, `.body.`, `getReader(` and every Web Streams name in the folder |
| CL-4 | 2xx: the registry's schema for that status. Other: `ApiErrorSchema`. A failure is `CONTRACT_VIOLATION`, is sent to `report`, and holds no part of the body |
| CL-5 | `epoch` and `revision` on every success (null when the answer has none) |
| CL-6 | One timer bounds the whole exchange, the body read included; it aborts the request through `AbortController` and settles the call even if a transport ignores the signal. No retry (API-11) |
| CL-6a | A value that starts with `dvc_`, `ses_` or `bio_`, or that contains the current bearer value, is refused in a path parameter and in a query value before any request. The debug line holds the registry's path **template** (`/api/v1/evidence/{id}/export`), not the URL. A network failure's own message (it can name the URL) is not passed on |

The request body is **not** validated on the client: an invalid form value must reach the server and
come back as its 422, as the simulator's result unions expect (CL-19). The fake transport of W31
checks request bodies in tests.

"The project's error classes": CL-1 forbids throwing for an HTTP status, so the client returns the
classified failure above. The Live source (W44) rebuilds `SimPermissionError`, `SimNotFoundError`,
`SimTransitionError`, `LiveTransportError` and `CoreRefusalError` from `kind`, `status`, `error` and
`transport` (CL-20, CL-21). The client itself imports nothing from `src/sim`.

Platform neutrality: the folder imports `zod` (types only), `../api/core-api` and its own files. It
uses `setTimeout`, `clearTimeout`, `AbortController`, `Date.now` and, only when no `fetch` is
injected, `globalThis.fetch`.

---

## 3. Unit tests (no network)

`npm run test -w @dems/shared -- --maxWorkers=2`, last run 07:20:32 (`assets/12_gate_shared_test.log`):

```
 Test Files  31 passed (31)
      Tests  584 passed (584)
   Start at  07:20:32
   Duration  2.12s (tests 51%, import 33%, transform 14%, worker 2%)
exit=0
```

| File | Tests | Covers |
|---|--:|---|
| `client-core.test.ts` | 63 | AC-C-01: `operationIds` equals the registry's IDs and count; every operation is called once per documented status with the contract's own example (`CORE_API_EXAMPLES`), 2xx comes back parsed, every other status as the typed envelope. Requests: GET, POST with a body, POST without its optional body, path parameter encoding, query encoding, base URL forms, the global `fetch` default. Nine usage errors, each before any request. AC-C-03: schema failure, undocumented 2xx, non-JSON, empty body, status 302, a non-envelope error body, the proxy's empty 502. Thirteen status rows (400, 401, 403, 404, 405, 409, 413, 422, 423, 429, 500, 502, 503) with class and transport; `retry-after` as seconds and as a date; network failure; time-out with the abort signal, also for a body that never ends. CL-5 headers. AC-C-04: one `Authorization` header on mobile, none on the web, no credential in any URL of the call log; the four-member debug line; sinks that throw |
| `client-types.test.ts` | 6 | With a table declared `as const`: literal operation IDs, the input type per operation, one success member per documented 2xx status with its schema's type, six `@ts-expect-error` misuses. With a widened table: the loose fallback. The default table type follows the contract module (CONTRACT-GAP-1) |
| `client-platform-neutral.test.ts` | 7 | Static scan of `src/client`: imports only `zod`, `./…` and `../api/…`; no `node:`, `react-native`, `expo`, `window`, `document` (comments included); no `Buffer`, `process`, `require`; no Web Streams, no `.json()`; no `console.`; the only `globalThis` use is the `fetch` lookup |

The type assertions are compile-time: `npm run typecheck -w @dems/shared` exits 0 with them
(`assets/12_gate_static.log`).

---

## 4. CONTRACT-GAPs (P12; nothing under `packages/shared/src/api/` was edited)

> Both gaps were closed by W19 (D36) and are in use since the follow-up (section 16).

| ID | Gap | Exact change for the contract owner | Local work-around in `src/client` |
|---|---|---|---|
| CONTRACT-GAP-1 | `CORE_API_OPERATIONS` is declared `readonly CoreApiOperation[]` (`core-api.ts:418`), so operation IDs are `string` and schema names per status are a union: the compiler cannot derive per-operation input and output types. CL-1 asks for "typed input in, typed success out" | In `core-api.ts`: declare the array `as const satisfies readonly CoreApiOperation[]` and export it under the name **`CORE_API_OPERATION_TABLE`**; keep `export const CORE_API_OPERATIONS: readonly CoreApiOperation[] = CORE_API_OPERATION_TABLE` for the existing readers (they index `responses` by a number and read optional members, which a literal union does not allow). 2xx response specs must stay inline object literals (a shared constant typed `CoreApiResponseSpec` would widen the schema name) | The client is generic over the table type. Its default type is `RegistryTableOf<typeof import('../api/core-api')>`: the type of `CORE_API_OPERATION_TABLE` when the module exports it, else of `CORE_API_OPERATIONS`. **The day the owner adds that export, every caller gets literal IDs and typed data with no edit in the client folder.** Until then `call` accepts any string ID, takes `{ params?, query?, body? }` loosely and returns `data: unknown`; the runtime validation is the same either way. The typed path is proven with an `as const` fixture in `client-types.test.ts` |
| CONTRACT-GAP-2 | `CoreApiOperation` has no member for query parameters, while API-9 defines `cursor` and `limit` for the list reads | Add `query?: { schema: CoreApiSchemaName }` to `CoreApiOperation`, naming an object schema of the query | `input.query` is a flat record of string, number or boolean, percent-encoded on a GET, refused on a POST, never validated. The type `QueryOf` already reads `query.schema` when an operation has it |
| Note (no gap) | `ApiErrorSchema` has no `details` and no `requestId` yet (01_specs §7.2 adds them; W19) | Already planned | The client returns `error` as the registry's schema parses it, so both members appear when the schema gains them. Today zod drops them |

---

## 5. The probe and its hook

### 5.1 The hook (`apps/mobile/src/runtime/debug.ts`)

The existing debug hook `useDebugScenarioLinks` already reads the launch URL and later deep links
(`&scenario=`). Its `load` function now calls `runDevProbeFromUrl(url)` first: one call, no new mount
point, no change in any other file.

```ts
function runDevProbeFromUrl(url: string | null | undefined): void {
  if (__DEV__) {
    const request = devProbeFromUrl(url);          // ?probe=<name>&run=<id>
    if (request === null) return;
    try {
      const probes = require('./dev-probes') as typeof import('./dev-probes');
      void probes.runDevProbe(request.name, request.run);
    } catch (error) {
      reportRuntimeIssue('error', 'runtime.debug.probe', error, { probe: request.name, run: request.run });
    }
  }
}
```

Two gates: the effect of `useDebugScenarioLinks` runs only when `enabled` (default `__DEV__`), and the
block is under a literal `__DEV__`, which Metro replaces by `false` and removes in a release build
before it collects a module's dependencies.

Trigger: `adb shell "am start -W -a android.intent.action.VIEW -d 'demsdemo:///?probe=core-client&run=<id>' com.dems.demo.tablet"`.

### 5.2 The probe (`apps/mobile/src/runtime/dev-probes.ts`)

One line per check in the device log (`adb logcat -d -s ReactNativeJS:V`), each starting with the tag
`[DEMS-PROBE-W12 run=<id>]` and holding `PASS` or `FAIL` with the measured values; a last line
`DONE core-client pass=<n> fail=<n>`. A failed check is also written to the app's persistent runtime
log (`reportRuntimeIssue`). A `PROBES` table by name lets W15 add its secure-store probe.

| Check | What it does | PASS when |
|---|---|---|
| P0a | Runtime and global `fetch` | `globalThis.fetch === fetch` imported from `expo/fetch` (identity), and `HermesInternal` exists. Also logged: function name, Hermes version, OS, React Native version, `EXPO_PUBLIC_USE_RN_FETCH`, and whether `ReadableStream`, `AbortController`, `TextDecoder`, `Headers`, `WebSocket` exist |
| P0b | One raw `fetch` to the harness | Status 200 and a body. Logged: the response's class name, `_rawHeaders` (Expo) or `_bodyInit` (the polyfill), the type and class of `response.body`, header lookup case |
| P1 | GET `getServiceHealth` through a client that injects no `fetch` (the global is looked up) | 200, zod-valid |
| P2 | POST `createSession` with the contract's example body and a bearer header, through a client that is handed `globalThis.fetch` | 201, zod-valid, `epoch` not null, `revision` an integer. The harness answers 401 without `Bearer dvc_…` and 422 unless the body parses as `SessionCreateRequest`, so a 201 proves both arrived |
| P3 | POST `exportEvidence` | 403 parsed as `ApiError`, class `FORBIDDEN`, code `FORBIDDEN` |
| P4 | POST `stopSession` | 429, class `RATE_LIMITED`, `retryAfterSeconds === 42`, transport `UNAVAILABLE` |
| P5 | GET `getStorageStatus` (the harness answers a 200 that violates the schema) | `CONTRACT_VIOLATION`, no `data` |
| P6 | GET to device port 4429 (no listener) | `NETWORK`, transport `CORE_OFFLINE` |
| P7 | GET `getVideoStatus` with a 1 s time-out (the harness answers after 3 s) | `TIMEOUT` after about 1 s; the harness logs the abort |
| P8 | The client's debug log | Five lines of four members; the bearer value is in none |
| P9 | `new WebSocket(url, null, { headers: { Authorization: 'Bearer …' } })`, one message, then the harness closes with 4403 | The harness's hello says it saw `Bearer` with prefix `dvc_`; the echo arrives; the device reports close code 4403 (CA-08) |
| P10 | The same with 4401 | Close code 4401 |

The bearer value is `dvc_PROBE_FAKE_` plus 32 random hex characters, made on the device at each run;
only its first 4 characters and its length are logged.

### 5.3 A release build holds neither the hook nor the probe (measured)

`assets/12_release_bundle_check.log`. First, Metro's own release transform of `debug.ts` (its
`inlinePlugin`, then its `constantFoldingPlugin`, as `metro-transform-worker/src/index.js:176-212`
runs them before it collects dependencies):

```
debug build  (dev=true)  {"required":["react","react-native","@dems/shared/sim","./core-link","./log","./dev-probes"],"hasProbeModule":true,"hasProbeHook":true,"hasParser":true}
release build (dev=false) {"required":["react","react-native","@dems/shared/sim","./core-link","./log"],"hasProbeModule":false,"hasProbeHook":false,"hasParser":false}
```

Then two real bundles of the whole app (`expo export`, output in a temp folder, nothing served):

```
## 2. Development bundle
$ EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --dev --platform android --no-bytecode --output-dir <tmp>/dev
exit=0
bundle bytes:  12915692 (a count is the number of bundle lines that hold the text)
  DEMS-PROBE-W12               1
  runtime/dev-probes.ts        1
  client/core-client.ts        1
  CoreClientUsageError         2
  winter/fetch/fetch.ts        1

## 3. Release bundle
$ EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 CI=1 npm exec -w @dems/mobile -- expo export --platform android --no-bytecode --output-dir <tmp>/release
exit=0
bundle bytes:  9702095
  DEMS-PROBE-W12               0
  dev-probes                   0
  runDevProbe                  0
  devProbeFromUrl              0
  probe=                       0
  createCoreClient             0
  CoreClientUsageError         0
  CONTRACT_VIOLATION           0
positive controls (text of the same file, debug.ts, and of the runtime that must be there):
  runtime.sim.hydrated         1
  scenario=                    1
```

So: Metro resolves and transforms the probe, the client and `expo/fetch` for the debug app; the
release bundle holds no probe, no hook, no URL parser and no client code at all (the probe is the
only importer of `@dems/shared/client` in the app today). The existing release-gate test
(`apps/mobile/src/features/settings/heartbeat-release-gate.test.tsx`) is unchanged and passes:
`git hash-object` gives `6aa6db7ef1cc666b03be489a23e2146b3e28f9ac` for the file and for
`acaff20:<the same path>`.

---

## 6. The harness (`.cache/proof-harness/harness.mjs`)

Run with `node --import tsx .cache/proof-harness/harness.mjs` (it now imports the registry, which is
TypeScript source). W05's routes are kept unchanged. Added for this row:

| Route | Answer |
|---|---|
| `GET /api/v1/health` | The contract's `getServiceHealth` example with the current time. It also sets the dummy cookie, so later lines show whether the client sends a cookie back |
| `POST /api/v1/session` | 401 `NOT_SIGNED_IN` without `Authorization: Bearer dvc_…`; 422 `INVALID_INPUT` unless the body parses as `SessionCreateRequest`; else the contract's 201 with `x-dems-epoch` and `x-dems-revision` |
| `POST /api/v1/evidence/:id/export` | The contract's 403 `FORBIDDEN` example |
| `POST /api/v1/session/:id/stop` | 429 `RATE_LIMITED`, `retry-after: 42` |
| `GET /api/v1/storage/status` | A 200 that violates `StorageStatusResponse` on purpose |
| `GET /api/v1/video/status` | A valid answer 3 s late; logs `http-aborted-by-client` when the client gives up |
| `/ws` | Hello with what the upgrade carried (now also the `Authorization` facts and the user agent), one echo, close with a code on `close:<code>` |

Every answer carries `x-request-id`. At start the harness checks each canned body with the registry's
`validateCoreApiResponse` and stops if one does not match; the log's second line records it:

```
2 {'kind': 'canned', 'contractValid': ['health=true', 'created=true', 'notSignedIn=true', 'invalidInput=true', 'exportForbidden=true', 'video=true', 'rateLimited=true'], 'storageViolationIsInvalid': True, 'storageViolationReason': 'INVALID_BODY'}
```

Per request and per upgrade the log holds: `Host`, `Origin`, `User-Agent`, every `Sec-*` header (of
`Sec-WebSocket-Key` the length only), `Cookie` (name, first 6 characters, whether it equals the issued
value), `Authorization` as `{ present, scheme, prefix (4 characters), length }` and never the value,
`Accept`, `Content-Type`, and the list of header names.

---

## 7. Host control run (Node, not the proof)

Inside the lane lock, before the device session: the same client with Node's `fetch` against the
harness. `assets/12_host_control.txt`:

```
[HOST-CONTROL run=w12x071039] P1 GET getServiceHealth PASS {"ok":true,"status":200,"epoch":null,"revision":null,"requestId":"req-000003"}
[HOST-CONTROL run=w12x071039] P2 POST createSession PASS {"ok":true,"status":201,"epoch":"1","revision":101,"requestId":"req-000004"}
[HOST-CONTROL run=w12x071039] P3 POST exportEvidence 403 PASS {"ok":false,"kind":"FORBIDDEN","status":403,"code":"FORBIDDEN","retryAfterSeconds":null,"transport":null}
[HOST-CONTROL run=w12x071039] P4 POST stopSession 429 retry-after PASS {"ok":false,"kind":"RATE_LIMITED","status":429,"code":"RATE_LIMITED","retryAfterSeconds":42,"transport":"UNAVAILABLE"}
[HOST-CONTROL run=w12x071039] P5 GET getStorageStatus contract violation PASS {"ok":false,"kind":"CONTRACT_VIOLATION","status":200,"code":"CONTRACT_VIOLATION","retryAfterSeconds":null,"transport":"UNAVAILABLE"}
[HOST-CONTROL run=w12x071039] P2b POST createSession without a credential is 401 PASS {"ok":false,"kind":"UNAUTHENTICATED","status":401,"code":"NOT_SIGNED_IN","retryAfterSeconds":null,"transport":null}
[HOST-CONTROL run=w12x071039] P7 GET getVideoStatus time-out PASS {"ok":false,"kind":"TIMEOUT","status":null,"code":"TIMEOUT","retryAfterSeconds":null,"transport":"CORE_OFFLINE","elapsedMs":1001}
[HOST-CONTROL run=w12x071039] DONE fail=0
```

The matching harness lines (`assets/12_harness_host_control.log`, shortened):

```
3 GET /api/v1/health | UA: node | Host: 127.0.0.1:4421 | Origin: None | Auth: {'present': True, 'scheme': 'Bearer', 'prefix': 'dvc_', 'length': 30}
4 POST /api/v1/session | UA: node | Origin: None | Auth: {'present': True, 'scheme': 'Bearer', 'prefix': 'dvc_', 'length': 30}
5 {'kind': 'createSession', 'authorization': {...'prefix': 'dvc_'...}, 'bodyIsSessionCreateRequest': True, 'bodyKeys': ['caseNumber', 'subjectType', 'subjectName', 'investigatorId', 'room', 'profileId']}
6 POST /api/v1/evidence/EV-20260930-0004/export | UA: node | Origin: None | Auth: {'present': True, ...}
8 POST /api/v1/session/SES-20261001-0024/stop | UA: node | Origin: None | Auth: {'present': True, ...}
9 GET /api/v1/storage/status | UA: node | Origin: None | Auth: {'present': True, ...}
10 POST /api/v1/session | UA: node | Origin: None | Auth: {'present': False}
12 GET /api/v1/video/status | UA: node | Origin: None | Auth: {'present': True, ...}
13 {'kind': 'http-aborted-by-client', 'url': '/api/v1/video/status'}
```

This shows that the harness and the client agree, and that the time-out really aborts the request.
It says nothing about Hermes or `expo/fetch`.

---

## 8. The emulator run: attempted, blocked

### 8.1 What happened

One command, from the repository root, outside the sandbox:

```
/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_w12.sh
```

`assets/12_run_w12_device_blocked.log` (shortened):

```
== 07:10:39 1. start the proof harness on 127.0.0.1:4421 (node --import tsx)
proof-harness listening on http://127.0.0.1:4421 pid 15183 ...
== 07:10:40 3. device session: dems_phone, Metro 8082, device tcp:4420 -> host tcp:4421
[device-session phone 07:13:58] lock held; hard cap 600 s, until 07:23:58 (watchdog PID 18252)
[device-session phone 07:13:58] session serial: emulator-5554 (dems_phone)
[device-session phone 07:13:58] Metro PID 18279 (own process group) on 127.0.0.1:8082 ...
[device-session phone 07:14:00] emulator-5554: WARNING could not set the bundler location (is com.dems.demo.tablet installed?); the app will use 10.0.2.2:8081
[device-session phone 07:14:00] Metro ready; device tcp:8081 -> host tcp:8082, tcp:4400 -> tcp:4400 on emulator-5554
[device-session phone 07:14:00] Core server: device tcp:4420 -> host tcp:4421 on emulator-5554
-- adb reverse --list (start of commands):
host-16 tcp:8081 tcp:8082
host-16 tcp:4400 tcp:4400
host-16 tcp:4420 tcp:4421
-- installed build:
    versionCode=100 minSdk=24 targetSdk=36
    versionName=0.1.0
    flags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ]
    lastUpdateTime=2026-10-04 07:08:42
Starting: Intent { act=android.intent.action.VIEW dat=demsdemo:///... pkg=com.dems.demo.tablet }
Error: Activity not started, unable to resolve Intent { act=android.intent.action.VIEW dat=demsdemo:///... flg=0x10000000 xflg=0x4 pkg=com.dems.demo.tablet }
[device-session phone 07:16:51] Metro 18279 stopped
[device-session phone 07:16:51] session ended with status 143
== 07:16:51 4. stop the harness and check that nothing is left
harness exit status: 0
lsof exit 1 (1 with no output: no listener on 4421 or 8082)
lockf exit=0
```

The session waited 3 min 18 s for the phone lock (another row's session held it, with a Metro on
8085), then held it for 2 min 53 s. I ended my own session early (TERM to its shell, PID 18237; its
cleanup stopped Metro and removed its three reverse rules) once the cause was clear, instead of
letting it poll to its limit. The reverse rule `tcp:4420 -> tcp:4421` was set and removed by
`device-session.sh` through `DEMS_CORE_HOST_PORT=4421` (step 35 had already added the variable); I set
no rule of my own.

### 8.2 The cause: the emulators are at the PIN keyguard

Read-only `adb` calls at 07:16:41:

```
== emulator-5554
    State: RUNNING_LOCKED
  Started users state: [0=RUNNING_LOCKED]
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
2956.21                      (guest uptime in seconds: booted at about 06:27)
false                        (locksettings get-disabled: a screen lock is set)
== emulator-5556
    State: RUNNING_LOCKED ... isKeyguardShowing=true ... 2931.33 ... false
== emulator-5558
    State: RUNNING_LOCKED ... isKeyguardShowing=true ... 2915.25 ... false
```

While the Android user is locked, only direct-boot-aware components can be started. The app's
activity is not one, so:

```
$ adb -s emulator-5554 shell am start -W -n com.dems.demo.tablet/.MainActivity
Error type 3
Error: Activity class {com.dems.demo.tablet/com.dems.demo.tablet.MainActivity} does not exist.
```

although `dumpsys package` lists the activity, the `demsdemo` scheme filter and `installed=true`. The
device log shows the same refusal for the other row's start right after its install, and for mine:

```
10-04 07:08:43.067 I ActivityTaskManager: START u0 {act=android.intent.action.VIEW dat=demsdemo:///... pkg=com.dems.demo.tablet} ... result code=-91
10-04 07:14:00.946 I ActivityTaskManager: START u0 {act=android.intent.action.VIEW dat=demsdemo:///... pkg=com.dems.demo.tablet} ... result code=-91
10-04 07:15:00.539 I ActivityTaskManager: START u0 {... cmp=com.dems.demo.tablet/.MainActivity} ... result code=-92
```

The same state explains the `device-session.sh` warning: `run-as` cannot write the app's preferences
while its storage is locked. `README.md:141` states it: "After a reboot the PIN keyguard shows", with
the unlock command. Step 24 (W02) booted the three emulators cold at about 06:27 and, by its mandate,
changed nothing on them; the check of step 28 (W06) read the package state, which is readable while
locked.

### 8.3 Why this row did not unlock them

Unlocking means typing the emulator's screen-lock PIN into the Android lock screen. That is an
authentication step on an operating-system prompt; I do not enter credentials there, also not a
documented demo value, and the row's mandate names no change of emulator state (P3). It is left to
the user, or to whoever the controller names with the user's agreement. The command is in
`README.md:141`; it is one line per emulator.

Using `dems_tablet` instead would not have helped: it is in the same state.

**Controller notes received after the first report (about 07:27 to 07:28).** A first note (ruling D33)
asked this row to unlock its emulator with the README procedure; a second note withdrew that ruling
before anything was done. This row sent no input of any kind to a lock screen and ran no unlock
command; its scripts contain none (`grep -c "input text|input keyevent|locksettings"` gives 0 for
`run_w12.sh` and `device_w12.sh`), and none of its files holds the PIN value. State at 07:28:18, read-only:
`emulator-5554`, `emulator-5556` and `emulator-5558` are all still `RUNNING_LOCKED`. **Not unlocked.**
The unlock stays with the user; the controller re-runs the device part afterwards (section 8.4).

### 8.4 To finish the proof after the unlock

```sh
# 1. (user) unlock dems_phone as README.md:141 describes; check:
adb -s emulator-5554 shell dumpsys user | grep -m1 State:        # expect RUNNING_UNLOCKED
# 2. the proof, about 2 to 5 minutes, outside the sandbox, from the repository root:
/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_w12.sh
# 3. evidence: .cache/proof-harness/out_w12/logcat_probe.txt (the probe lines), harness.log, screen_dems_phone.png
```

`device_w12.sh` now stops at once, with exit 69 and a plain message, when the Android user is not
`RUNNING_UNLOCKED` or when `am start` reports an error, so a locked device costs seconds, not
minutes. Expected: twelve `PASS` lines (P0a to P10) and `DONE core-client pass=12 fail=0`. A `FAIL` on
P1 to P5 is the trigger of fallback Fe; a `FAIL` on P9 or P10 only is the CA-08 case of 02_plan §6
(no row; W30 learns a revocation from the next REST call).

---

## 9. Which `fetch` is active on the device

**Not measured.** What exists:

- The probe decides it by identity, not by assumption: P0a compares `globalThis.fetch` with the
  function exported by `expo/fetch`, and P0b logs the class of a raw response and whether it has
  Expo's `_rawHeaders` or the polyfill's `_bodyInit`.
- Static reading: `node_modules/expo/src/winter/runtime.native.ts:41-53` installs `expo/fetch` as the
  global unless `EXPO_PUBLIC_USE_RN_FETCH` is set; no such variable is set in the app.
- The development bundle of the app contains Expo's `winter/fetch/fetch.ts` and the client
  (section 5.3).

## 10. Headers the app sends

**Not measured: the harness log holds no request from the device.** Static reading only, to be
replaced by the harness lines of the real run:

| Question | What the installed source says (hypothesis until measured) | Source |
|---|---|---|
| `Origin` on the socket upgrade | React Native's Android socket module adds `origin: http://<host>:<port>` of the URL it opens, unless the caller passes an `origin` header. For `ws://127.0.0.1:4420/ws` that is `http://127.0.0.1:4420`, which is the case CA-08 and SD-02 expect | `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/websocket/WebSocketModule.kt:104-127, 387-406` |
| `Cookie` on the socket upgrade | The same module adds a `Cookie` header when the platform cookie store holds one for that origin (`:99-101`). The server never sets a cookie for a device, so the store should be empty; if one were there, the upgrade would carry a cookie **and** a bearer value, which 01_specs §9.2 answers with 401 (ID-12). The probe measures it: the harness offers a cookie on the first GET | the same file |
| Cookies on `fetch` | `expo/fetch` sends `credentials: 'include'` when the caller names none, and turns `'same-origin'` into `'include'`. The typed client always passes `'omit'` on mobile | `node_modules/expo/src/winter/fetch/fetch.ts:48-51, 71` |
| `Origin` on `fetch` | Nothing in `expo/fetch`'s JavaScript adds one; the native side was not read | `fetch.ts` |

---

## 11. Gate (P24) and test ledger

`assets/12_gate_static.log`, `12_gate_shared_test.log`, `12_gate_mobile_test.log`; all after the last
edit (07:19:11):

```
$ npm run typecheck -w @dems/shared      exit=0
$ npm run lint -w @dems/shared           exit=0
$ npm run typecheck -w @dems/mobile      exit=0
$ npm run lint -w @dems/mobile           exit=0
$ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  31 passed (31)
      Tests  584 passed (584)            exit=0
$ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 72 passed, 72 total
Tests:       833 passed, 833 total
Time:        33.877 s, estimated 37 s    exit=0
```

| Workspace | Before | After | Added by this row |
|---|---|---|---|
| `@dems/shared` | 508 tests, 28 files | 584 tests, 31 files, 0 failed | 76 tests: `client-core.test.ts` (63), `client-types.test.ts` (6), `client-platform-neutral.test.ts` (7) |
| `@dems/mobile` | 833 tests, 72 suites | 833 tests, 72 suites, 0 failed | 0 (the row owns no mobile test path) |

No existing test file was changed. No run failed, so there is no second run to record under P11.

---

## 12. Findings, decisions and deviations for the controller

### Findings

| ID | Finding |
|---|---|
| F34-1 (blocker) | The three emulators are at the PIN keyguard since their cold boot: user 0 `RUNNING_LOCKED`, `isKeyguardShowing=true`. No DEMS activity can start on any of them (`am start` result -91 / -92). This blocks this row's proof, step 35's launch check (its start at 07:08:43 got -91) and every later device row. Unlock: `README.md:141` |
| F34-2 | `device-session.sh` does not notice a locked device: `is_up` checks `sys.boot_completed` only, and the one visible sign is the warning "could not set the bundler location". A check of `dumpsys user` for `RUNNING_UNLOCKED` with exit 69 would stop a session in seconds. The file belongs to W13 |
| F34-3 | The client is larger than the "about 150 lines" of TD-09: 670 lines with types and comments, about 230 of them runtime logic. The growth is the failure classes, the time-out race, the CL-6a guards and the type derivation |
| F34-4 | The contract names no response header for the request ID (CL-6a wants it in the debug log). The client reads `error.requestId` when the envelope schema keeps it, else a header whose name is an option, default `x-request-id` |
| F34-5 | The type of the epoch is not stated in 01_specs API-7. The client returns the header text (`epoch: string or null`) and the revision as an integer |
| F34-6 | While my lane lock was held, another row's device session mapped `tcp:4420 -> tcp:4421` on the phone (its own test of the new variable). No request of it reached the harness (the log holds only my Node control run) |
| F34-7 | `expo export` (used for the release check) wrote only to the temp folder; `git status` shows no new path |

### Decisions needed

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D34-1 | Who unlocks the emulators, and when | (a) the user runs the README line on the three emulators; (b) the controller records a decision that names a row to do it | (a). Then re-run this row's one command (section 8.4); the row needs no code change |
| D34-2 | CONTRACT-GAP-1: the `as const` export `CORE_API_OPERATION_TABLE` | Give it to W19 (the next contract owner), or a contract slot before W18 | W19; the name is binding, because the client's default type looks for exactly it |
| D34-3 | CONTRACT-GAP-2: a `query` member on `CoreApiOperation` | W19 or W22, whichever adds the first list read | With the first operation that has `cursor` and `limit` |
| D34-4 | WT-4 against CL-21 for an answer without an envelope | WT-4 says "any answer that is not valid JSON of the contract" is `CORE_OFFLINE`; CL-21 puts `CONTRACT_VIOLATION` under `UNAVAILABLE` | As built: `CORE_OFFLINE` only for 502, 503, 504 without an envelope (a gateway in front of a dead server), `UNAVAILABLE` otherwise. W44 reads `transport` |
| D34-5 | The request-ID header name (F34-4) | Pin `x-request-id` in the contract (W08 sets it, W19 documents it), or use the envelope member only | Pin it |

### Deviations from the plan

| # | Deviation | Reason |
|---|---|---|
| 1 | The emulator proof is not done | F34-1 |
| 2 | The probe has twelve checks, not four | The delegation's list (GET, POST with headers, 429, socket) plus the fetch identity, a contract violation, no answer, the time-out and close code 4401, each a few lines |
| 3 | A Node control run inside the lane lock | It separates "the harness or the client is wrong" from "the device behaves differently" |
| 4 | `fetch` is optional in the client | CL-3 says the global is the default and injectable; the delegation says "by injection". Both paths exist and both are in the probe (P1 looks it up, P2 injects it) |
| 5 | Two `expo export` runs into a temp folder | The only way to show, without a device, that the release bundle excludes the probe and that Metro accepts the client's TypeScript |
| 6 | Evidence copies under `implementation/assets/12_*` | The scratch folder is deleted by the row that last uses it |

---

## 13. Nothing is left running

At 07:17:34, after the run:

```
-- reverse rules on dems_phone after my session:
(end of list)
-- listeners:   $ lsof -nP -iTCP:4421 -iTCP:8082 -sTCP:LISTEN      lsof exit=1 (no output)
               $ lsof -nP -iTCP:8081-8086 -sTCP:LISTEN            (no output)
```

| Process I started | PID | Stopped |
|---|---|---|
| Harness, host-only run | 14637 | by the run script, exit 0, 07:10:21 |
| Harness, device run | 15183 | by the run script, exit 0, 07:16:51 |
| Metro on 8082 | 18279 | by `device-session.sh`, 07:16:51 |
| Device session shell | 18237 | by me (TERM), status 143, 07:16:51 |
| Log monitor (`tail -f`) | 15644 | stopped, 07:17 |
| Two `expo export` runs, two jest runs, three Vitest runs | — | ended by themselves |

`.locks/core-server.lane1.pid` was written and removed by each run; `.locks/core-server.lane1.lock`
stays (kept by `lockf -k`, as after W05). I stopped no process that I did not start. No emulator was
killed, booted, wiped, unlocked or changed; nothing was installed or uninstalled.

Sandbox bypass was used for: the two `lockf` runs (port binding, `adb`), the read-only `adb` and `ps`
inspections of section 8.2, and the TERM to my own session shell. Everything else ran in the sandbox.

---

## 14. Rollback (R-NEW; R-PRE for `debug.ts`)

Run only on the controller's instruction.

```sh
# R-PRE: debug.ts (pre-image saved before the first edit; it is empty, the file equalled acaff20)
git checkout acaff20 -- apps/mobile/src/runtime/debug.ts
git apply --allow-empty .cache/rollback/W12.pre.patch

# R-NEW: the new files
rm -f apps/mobile/src/runtime/dev-probes.ts
rm -f packages/shared/test/client-core.test.ts packages/shared/test/client-types.test.ts packages/shared/test/client-platform-neutral.test.ts
rm -f packages/shared/src/client/core-client.ts
# the placeholder of W03 (the export subpath `@dems/shared/client` must keep resolving)
printf '%s\n' "export {}; // Placeholder of \`@dems/shared/client\` (plan W03); the typed-client row (W12) replaces this file." > packages/shared/src/client/index.ts

# scratch (git-ignored); the harness is still needed until the proof has run
rm -rf .cache/proof-harness
```

After the rollback `@dems/shared` is back at 508 tests in 28 files. The copies under
`implementation/assets/12_*` are documentation and stay.

---

## 15. Commands run (in order)

| # | Command (from `/Users/gsp-budi/Documents/DEMS`) | Sandbox | Exit |
|---|---|---|---|
| 1 | Reads of the binding documents, the registry, the mobile runtime, Expo's and React Native's source | in | 0 |
| 2 | `npm run typecheck -w @dems/shared`; `vitest run test/client-` (first green at 07:03:53) | in | 0 |
| 3 | `git diff acaff20 -- apps/mobile/src/runtime/debug.ts apps/mobile/src/runtime/dev-probes.ts packages/shared/src/client/index.ts > .cache/rollback/W12.pre.patch` (0 bytes) | in | 0 |
| 4 | Edits of `debug.ts`, `dev-probes.ts`; `npm run typecheck -w @dems/mobile`; `npm run lint -w @dems/mobile` | in | 0 |
| 5 | `SKIP_DEVICE=1 /usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_w12.sh` (harness and host control) | bypass | 0 |
| 6 | `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_w12.sh` (the device run, section 8) | bypass | 0 (device session 143) |
| 7 | `npm run test -w @dems/mobile -- --maxWorkers=2` (twice: 07:11 and 07:19) | in | 0; 0 |
| 8 | `node .cache/proof-harness/release_gate_w12.cjs` | in | 0 |
| 9 | Read-only `adb` (`devices`, `reverse --list`, `dumpsys package`, `dumpsys user`, `dumpsys window`, `logcat -d`, `screencap`), `ps`; one `am start -n` on `dems_phone` while my session held its lock | bypass | 0 |
| 10 | `kill -TERM 18237` (my device session shell) | bypass | 0 |
| 11 | `expo export --dev …` and `expo export …` into `$TMPDIR/w12-export` (three runs) | in | 0 |
| 12 | The four static gates and `npm run test -w @dems/shared -- --maxWorkers=2` (07:20) | in | 0 |

---

## 16. Follow-up: contract A adaptation (08:46 to 08:56 WIB; code only)

Requested by the controller after W19 (contract A, `implementation/19_contract_a.md`) landed: two of
this row's tests were red by design (its finding F-1), and the literal table was not the client's
default yet (its DR-1, DN-8). No device, no emulator, no harness process, no Metro, no port was used.
Nothing under `packages/shared/src/api/**` was edited. **The emulator proof stays open** (section 8).

### 16.1 Result

| Point | Result |
|---|---|
| The two red tests | Adapted as by-design changes (16.2). `npm run typecheck -w @dems/shared` exit 0; the shared suite has no failure |
| A 204 success without a body | Success with `data: undefined`. No `JSON.parse` is called (a spy proves it), nothing is reported. A 204 that does carry a body is `CONTRACT_VIOLATION`. All five operations of contract A are covered (`signOut`, `cancelPairingCode`, `unpairDevice`, `injectFault`, `clearFault`) |
| `details` and `requestId` of the envelope | Carried into `failure.error` exactly as the server sent them (the registry's `ApiErrorSchema` keeps them now). A `details` that is not a flat map is `CONTRACT_VIOLATION` |
| The request ID | `failure.requestId` and the debug line: the `x-request-id` header when the answer has one, the envelope's `error.requestId` otherwise, else null. On a success: the header. The option `requestIdHeader` was removed, because the contract pins the name (`REQUEST_ID_HEADER_NAME`) |
| `x-dems-epoch`, `x-dems-revision` | Both returned as non-negative integers (`epoch: number or null`; before: text). A value that is not decimal digits gives null. This replaces finding F34-5 |
| The query of a GET | Parsed with `operation.query.schema` when the registry entry names one: defaults and normalisation apply, members the schema does not know are not sent, and a query the schema refuses is a `CoreClientUsageError` before any request. Without a query schema the flat record is sent as given. The credential guard of CL-6a applies to the parsed values. No operation of contract A has a query; the tests use a table of their own |
| **The literal table is the default** | **Yes, with no change under `src/api/**`.** `core-api.ts` already exports the type `CoreApiOperationTable`; the client's default table type is now that type, and its run-time default is still `CORE_API_OPERATIONS`, the same array. So `createCoreClient({ baseUrl, credentials })` gives literal operation IDs and per-operation input and success types. The move W19 describes (declare the table in `core-api.ts`, delete `operation-table.ts`) is not needed |
| The loose form | `operations: CORE_API_OPERATIONS` (the widened view): any string ID, loose input, `data: unknown`. For loops over the registry and for tests that send what the types forbid |
| Header names | The client imports the contract's four constants from `../api/constants`. Its own exports `EPOCH_HEADER`, `REVISION_HEADER`, `RETRY_AFTER_HEADER`, `DEFAULT_REQUEST_ID_HEADER` are kept as aliases of them, because `test/api-envelope.test.ts:28, 209-212` (W19's file) imports them and asserts the equality |
| The probe (`dev-probes.ts`) | Uses the default, typed clients. The three request bodies are the contract's examples parsed on the device with `sessionCreateSchema`, `EvidenceExportRequestSchema` and `SessionStopRequestSchema` (that gives them their type); P2 checks that `epoch` and `revision` are integers. `debug.ts` is unchanged |
| Type errors of the switch | W19 measured 18 in `client-core.test.ts` and 3 in `dev-probes.ts`. All gone: the run-time tests build their client on the widened view, the probe types its bodies |

### 16.2 By-design test changes (P24: an existing assertion changes only as a recorded decision)

Line numbers are those of the files before this follow-up (pre-images in `.cache/rollback/W12b.*.pre`),
then where the text is now.

| # | File:line before | Was | Is now (file:line) | Reason |
|---|---|---|---|---|
| 1 | `packages/shared/test/client-types.test.ts:123` | `expectTypeOf(result.error).toEqualTypeOf<{ code: string; message: string }>()` | `:128-129` `toEqualTypeOf<ApiError['error']>()` and `toExtend<{ code: string; message: string }>()`; `:130-131` two new lines pin the types of `details` and `requestId` | The envelope gained the optional `details` and `requestId` (01_specs §7.2; W19 F-1 a). W19's proposed patch, plus the two member assertions |
| 2 | `packages/shared/test/client-core.test.ts:118` | `const body = example(operation.operationId, status);` for every status | `:138-139` the example is taken only for a status that has a schema; else the answer is empty | Five operations answer 204 without a body, so there is no example (W19 F-1 b). W19's proposed patch |
| 3 | `packages/shared/test/client-core.test.ts:129-130` | `const schemaName = ...; expect(schemaName).toBeDefined();` for every 2xx | Removed; `:152` `if (result.ok && !schemaName) expect(result.data).toBeUndefined();` | The same. A success without a schema is now asserted to carry no data |
| 4 | `packages/shared/test/client-core.test.ts:145` | `expect(exchanges).toBeGreaterThanOrEqual(CORE_API_OPERATIONS.length)` | `:165` `expect(exchanges).toBe(<the number of documented statuses of the registry>)`, and `:166` at least 37 operations | Stronger: the loop must have made one exchange per documented status, 204 included |
| 5 | `packages/shared/test/client-core.test.ts:413` | `epoch: '3'` | `:434` `epoch: 3`, and `:435` both values are integers | `x-dems-epoch` is an integer (API-7 as W19 states it in `constants.ts`; D36) |
| 6 | `packages/shared/test/client-core.test.ts:416-420` | "a malformed revision is null"; `epoch: 'e-1'` passed through | `:443-447` "a value that is not a non-negative integer is null"; `epoch: null` | The same: a malformed epoch is no longer passed on as text |
| 7 | `packages/shared/test/client-types.test.ts:163-173` (one test, "the default table follows the contract module (CONTRACT-GAP-1)") | Three assertions on the helper type `RegistryTableOf` | Removed with the helper type. Replaced by the block at `:172` ("the default client: typed by the registry"), two tests and five `@ts-expect-error` misuses on the real default client | The gap is closed: the default is the registry's literal table itself, so the look-up type has no use |

Not assertion changes, but changes of test set-up that the typed default requires: the helper
`mobileClient` (`client-core.test.ts:86`) and two clients made directly (`:406`, `:736`) now pass
`operations: CORE_API_OPERATIONS`, because those tests send unknown IDs, empty bodies and missing
parameters on purpose. One describe title in `client-types.test.ts:155` was reworded.

### 16.3 Tests added (19)

| File | Before | After | New |
|---|--:|--:|---|
| `client-core.test.ts` | 63 | 81 | CL-5: a 204 carries the two headers; `parseCounterHeader`. Four tests on the 204 operations. Three on `details` and `requestId`. Eight on the query schema (valid, defaults, unknown members, three refusals, the credential guard, no schema, a schema that is not an object). One on the default client at run time |
| `client-types.test.ts` | 6 | 7 | The default client: IDs as a union, input and success per operation, `epoch` and `revision` as `number or null`, five misuses that must not compile |
| `client-platform-neutral.test.ts` | 7 | 7 | unchanged; it passes on the changed folder (the client now also imports `../api/constants`) |

### 16.4 Verification (final runs 08:54:51 to 08:55:12; mobile suite 08:53:28 to 08:54:02, after the last edit)

`assets/12b_gate_static.log`, `12b_gate_shared_test.log`, `12b_gate_mobile_test.log`,
`12b_release_bundle_check.log`, `12b_harness_canned_check.txt`:

```
$ npm run typecheck -w @dems/shared      exit=0
$ npm run lint -w @dems/shared           exit=0
$ npm run typecheck -w @dems/mobile      exit=0
$ npm run lint -w @dems/mobile           exit=0
$ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  44 passed (44)
      Tests  804 passed (804)            exit=0
$ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 72 passed, 72 total
Tests:       833 passed, 833 total
Time:        34.332 s, estimated 36 s    exit=0
```

No run failed, so there is no second run to record (P11). The release-gate test is unchanged:
`git hash-object` gives `6aa6db7ef1cc666b03be489a23e2146b3e28f9ac`, as for `acaff20`.

`dev-probes.ts` changed, so the release check was repeated with two new bundles
(`assets/12b_release_bundle_check.log`):

```
debug build  (dev=true)  {"required":["react","react-native","@dems/shared/sim","./core-link","./log","./dev-probes"],...}
release build (dev=false) {"required":["react","react-native","@dems/shared/sim","./core-link","./log"],"hasProbeModule":false,"hasProbeHook":false,"hasParser":false}
## 2. Development bundle   exit=0   bundle bytes: 13000108
  DEMS-PROBE-W12 1 | runtime/dev-probes.ts 1 | client/core-client.ts 1 | CoreClientUsageError 2 | winter/fetch/fetch.ts 1
## 3. Release bundle       exit=0   bundle bytes: 9784172
  DEMS-PROBE-W12 0 | dev-probes 0 | runDevProbe 0 | devProbeFromUrl 0 | probe= 0 | createCoreClient 0 | CoreClientUsageError 0 | CONTRACT_VIOLATION 0
  positive controls: runtime.sim.hydrated 1 | scenario= 1
```

The harness was not started. Its canned answers were checked against the registry as it stands,
without a port (`node --import tsx .cache/proof-harness/canned_check_w12.mjs`): the six answers are
valid, the 429 envelope is valid as an answer of `stopSession`, the storage body is still refused
(`INVALID_BODY`), 37 operations; exit 0. So `run_w12.sh` is still ready for the device part.

Test ledger (P24): `@dems/shared` 785 (784 passed, 1 failed, as W19 left it) → 804 passed, 0 failed;
this row's three files 76 → 95. `@dems/mobile` 833 → 833.

### 16.5 Files of the follow-up

| Path | Change |
|---|---|
| `packages/shared/src/client/core-client.ts` | Default table type, integer epoch, pinned request-ID header, envelope members, query parsing, no parse for a bodiless success; 670 → 713 lines |
| `packages/shared/src/client/index.ts` | Exports: `parseCounterHeader` added, `RegistryTableOf` removed |
| `packages/shared/test/client-core.test.ts` | 16.2 rows 2 to 6; 18 tests added |
| `packages/shared/test/client-types.test.ts` | 16.2 rows 1 and 7; the default-client block |
| `apps/mobile/src/runtime/dev-probes.ts` | Typed request bodies; integer check of the epoch |
| `.cache/proof-harness/canned_check_w12.mjs` (git-ignored) | New: the harness's start check without a port |
| `.cache/rollback/W12b.*.pre` (git-ignored) | Pre-images of the five files above and of `client-platform-neutral.test.ts` (not changed) |
| `implementation/assets/12b_*` | Five evidence files and the copy of the check script |

Rollback of the follow-up alone: copy the pre-images back
(`cp .cache/rollback/W12b.core-client.ts.pre packages/shared/src/client/core-client.ts`, and likewise
for `index.ts`, the two test files and `dev-probes.ts`). The shared typecheck and the client loop are
then red again, as W19 left them.

### 16.6 For the controller

| Item | Content |
|---|---|
| Status of this row's earlier points | CONTRACT-GAP-1 and CONTRACT-GAP-2: closed and in use. D34-2, D34-3, D34-5: done by W19 (D36). F34-4, F34-5: closed (header pinned; epoch an integer). D34-4 (the transport reason of an answer without an envelope) and D34-1 (the unlock) stay open |
| F34-8 | A caller that makes the client without `operations` now gets compile errors for an unknown ID, a missing path parameter or body, and a wrong body type. A loop over the registry, or a test that sends invalid input on purpose, must pass `operations: CORE_API_OPERATIONS`. W18, W30, W31 and W44 should know |
| F34-9 | One text in W19's files is now out of date: the comment of `packages/shared/src/api/operation-table.ts:14-21` (it says the client takes its default from the exports of `core-api.ts` and describes a switch: "declare the table in `core-api.ts` ... and delete this module"). Nothing has to move; a later contract row can shorten the comment. `api-registry.test.ts:465` passes `operations: CORE_API_OPERATION_TABLE` explicitly, which stays valid |
| F34-10 | A POST 2xx without `x-dems-epoch` or `x-dems-revision`, or with a value that is not an integer, is still a success with `null` in that member. Whether the Live source treats that as a contract violation or waits for its settle time-out (CL-17) is W44's decision |
| F34-11 | The query is sent as the schema's **output** (after defaults and normalisation). A query schema therefore has to yield strings, numbers or booleans per member; anything else is a `CoreClientUsageError`. For contract C when it writes the first list read |
| Deviation | The four `*_HEADER` exports of the client were kept as aliases instead of removed, because a test of W19 imports them |

---

## 17. The emulator proof (11:04 to 11:07 WIB)

The controller replaced the PIN-locked emulators by three lock-free ones on the same serials
(`dems2_phone` = `emulator-5554`, lane 1). The run is the one command of section 8.4, unchanged:

```
/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_w12.sh
```

It uses the proof harness on `127.0.0.1:4421` (not the Core server, not port 4420, no database), the
device side `tcp:4420` mapped by `DEMS_CORE_HOST_PORT=4421`, Metro on 8082. No lock, PIN, fingerprint
or device setting was read, typed or changed by this row; `device-session.sh` reported
"screen awake, no keyguard".

### 17.1 Two runs

| Run | Time | Result | Evidence |
|---|---|---|---|
| 1 (`w12x110420`) | 11:04:20 to 11:04:32 | 13 PASS, **1 FAIL (P0a)**: the probe assumed `globalThis.fetch === fetch` of `expo/fetch`; on the device the global is a wrapper named `_fetch`. Every REST and socket check passed | `assets/12c_run1_device.log`, `12c_run1_logcat_probe.txt`, `12c_run1_harness.log`, `12c_run1_screen_dems2_phone.png` |
| 2 (`w12x110630`) | 11:06:30 to 11:06:40 | **15 PASS, 0 FAIL** | `assets/12c_run2_device.log`, `12c_run2_logcat_probe.txt`, `12c_run2_harness.log`, `12c_run2_screen_dems2_phone.png`, `12c_run2_app_data_before.txt`, `12c_run2_app_data_after.txt` |

Between the runs only the probe changed (`dev-probes.ts`), not the client: P0a now accepts the
`expo/fetch` export **or** Expo's own wrapper around it (identified by the wrapper's marker symbol),
P0b additionally requires that the answer of the global fetch has the same constructor as an answer
of the `expo/fetch` export, and P1b was added. The first run's FAIL line, verbatim:

```
10-04 11:04:27.818 I ReactNativeJS: [DEMS-PROBE-W12 run=w12x110420] P0a runtime and global fetch FAIL {"globalFetchIsExpoFetch":false,"globalFetchName":"_fetch","hermes":true,"hermesVersion":"250829098.0.17","os":"android","osVersion":36,"reactNative":{"minor":86,"prerelease":null,"patch":3,"major":0},"useRnFetchFlag":null,"globals":{"ReadableStream":"function","AbortController":"function","TextDecoder":"function","Headers":"function","WebSocket":"function"}}
10-04 11:04:28.329 I ReactNativeJS: [DEMS-PROBE-W12 run=w12x110420] P0b raw global fetch answer PASS {"status":200,"responseClass":"FetchResponse","hasRawHeaders":true,"hasPolyfillBodyInit":false,"bodyType":"object","bodyClass":"ReadableStream",...}
10-04 11:04:29.710 I ReactNativeJS: [DEMS-PROBE-W12 run=w12x110420] DONE core-client pass=13 fail=1
```

A shell slip before run 1, with no effect on anything: my first command line removed old evidence
files with a pattern that matched nothing, the shell stopped the line there, and `lockf` never ran.

### 17.2 Run 2: the device log (`adb logcat -d -s ReactNativeJS:V`, filtered by the run ID)

```
11:06:36.903 [DEMS-PROBE-W12 run=w12x110630] START core-client
11:06:36.907 ... P0a runtime and global fetch PASS {"globalFetchIsExpoFetch":false,"globalFetchIsExpoRelativeUrlWrapper":true,"globalFetchName":"_fetch","hermes":true,"hermesVersion":"250829098.0.17","os":"android","osVersion":36,"reactNative":{"minor":86,"prerelease":null,"patch":3,"major":0},"useRnFetchFlag":null,"globals":{"ReadableStream":"function","AbortController":"function","TextDecoder":"function","Headers":"function","WebSocket":"function"}}
11:06:37.333 ... P1 GET getServiceHealth PASS {"ok":true,"status":200,"epoch":null,"revision":null,"requestId":"req-000014","service":"dems-mock-core"}
11:06:37.384 ... P1b cookie store after a 'credentials: omit' answer PASS {"status":200,"cookieStoredByOmitRequest":false,"error":null}
11:06:37.535 ... P0b raw global fetch answer PASS {"status":200,"responseClass":"FetchResponse","sameClassAsExpoFetchAnswer":true,"hasRawHeaders":true,"hasPolyfillBodyInit":false,"bodyType":"object","bodyClass":"ReadableStream","textLength":193,"contentType":"application/json; charset=utf-8","headerLookupIsCaseInsensitive":true}
11:06:37.553 ... P2 POST createSession PASS {"ok":true,"status":201,"epoch":1,"revision":103,"requestId":"req-000018","sessionId":"SES-20261001-0024","state":"CREATE","bearer":{"prefix":"dvc_","length":47}}
11:06:37.559 ... P3 POST exportEvidence 403 PASS {"ok":false,"kind":"FORBIDDEN","status":403,"code":"FORBIDDEN","retryAfterSeconds":null,"transport":null,"requestId":"req-000020","messageLength":65}
11:06:37.564 ... P4 POST stopSession 429 retry-after PASS {"ok":false,"kind":"RATE_LIMITED","status":429,"code":"RATE_LIMITED","retryAfterSeconds":42,"transport":"UNAVAILABLE","requestId":"req-000022"}
11:06:37.572 ... P5 GET getStorageStatus contract violation PASS {"ok":false,"kind":"CONTRACT_VIOLATION","status":200,"code":"CONTRACT_VIOLATION","retryAfterSeconds":null,"transport":"UNAVAILABLE","requestId":"req-000023","issues":["totalBytes: invalid_type","usedBytes: invalid_type","freeBytes: invalid_type","usedPercent: invalid_type","estimatedRemainingMs: invalid_type","writeBytesPerSec: invalid_type","bitrateMbps: invalid_type","volumes: invalid_type","retention: invalid_type"]}
11:06:37.575 ... P6 GET with no listener PASS {"ok":false,"kind":"NETWORK","status":null,"code":"NETWORK","retryAfterSeconds":null,"transport":"CORE_OFFLINE","requestId":null,"elapsedMs":3}
11:06:38.632 ... P7 GET getVideoStatus time-out PASS {"ok":false,"kind":"TIMEOUT","status":null,"code":"TIMEOUT","retryAfterSeconds":null,"transport":"CORE_OFFLINE","requestId":null,"elapsedMs":1057}
11:06:38.632 ... P8 debug log PASS {"lines":["GET /api/v1/health 200 req-000014","POST /api/v1/session 201 req-000018","POST /api/v1/evidence/{id}/export 403 req-000020","POST /api/v1/session/{id}/stop 429 req-000022","GET /api/v1/storage/status 200 req-000023"]}
11:06:38.642 ... P9 WebSocket Authorization header, echo, close 4403 PASS {"opened":true,"serverSawAuthorization":{"present":true,"scheme":"Bearer","prefix":"dvc_","length":47},"serverSawOrigin":"http://127.0.0.1:4420","serverSawHost":"127.0.0.1:4420","serverSawCookie":true,"serverSawUserAgent":"okhttp/4.12.0","echoed":true,"closeCode":4403,"closeReason":"requested","error":null}
11:06:38.652 ... P10 WebSocket close 4401 PASS {"opened":true,"echoed":true,"closeCode":4401,"closeReason":"requested","error":null}
11:06:38.667 ... P11 raw fetch, default credentials: cookie sent back? PASS {"status":200,"cookieSentBack":true,"serverSawOrigin":null,"error":null}
11:06:38.676 ... P12 no cookie is left in the app PASS {"status":200,"cookiePresent":false,"error":null}
11:06:38.676 ... DONE core-client pass=15 fail=0
```

(`...` stands for `10-04 <time> 5636 5667 I ReactNativeJS: [DEMS-PROBE-W12 run=w12x110630]`; the
file holds the full lines.) The row's four required lines are P1, P2, P3 and P9.

The matching harness lines (`assets/12c_run2_harness.log`; lines 3 to 13 are the Node control run).
**The request ID is the same on both sides**: the harness answers line `#n` with
`x-request-id: req-<n, six digits>`, and the device prints what it read.

```
#14 http    GET  /api/v1/health | Host: 127.0.0.1:4420 | Origin: (none) | User-Agent: okhttp/4.12.0 | Authorization: Bearer dvc_… (47 chars) | Cookie: absent | Sec-*: (none) | names: accept,authorization,accept-encoding,host,connection,user-agent            <- P1,  device: req-000014
#15 http    POST /api/v1/proof/echo | ... | Authorization: absent | Cookie: absent                                                                             <- P1b
#16 http    GET  /api/v1/health | ... | Authorization: absent | Cookie: absent | names: accept-encoding,host,connection,user-agent                             <- P0b, global fetch
#17 http    GET  /api/v1/health | ... | Authorization: absent | Cookie: present, equals the issued value: True                                                 <- P0b, the expo/fetch export
#18 http    POST /api/v1/session | Host: 127.0.0.1:4420 | Origin: (none) | User-Agent: okhttp/4.12.0 | Authorization: Bearer dvc_… (47 chars) | Cookie: absent | Sec-*: (none) | names: accept,authorization,accept-encoding,content-type,content-length,host,connection,user-agent   <- P2, device: req-000018
#19 {"kind": "createSession", "authorization": {"present": true, "scheme": "Bearer", "prefix": "dvc_", "length": 47}, "bodyIsSessionCreateRequest": true, "bodyKeys": ["caseNumber", "subjectType", "subjectName", "investigatorId", "room", "profileId"]}
#20 http    POST /api/v1/evidence/EV-20260930-0004/export | ... | Origin: (none) | Authorization: Bearer dvc_… | Cookie: absent                           <- P3, device: req-000020
#22 http    POST /api/v1/session/SES-20261001-0024/stop | ... | Origin: (none) | Authorization: Bearer dvc_… | Cookie: absent                             <- P4, device: req-000022
#23 http    GET  /api/v1/storage/status | ... | Origin: (none) | Authorization: Bearer dvc_… | Cookie: absent                                             <- P5, device: req-000023
#24 http    GET  /api/v1/video/status | ... | Origin: (none) | Authorization: Bearer dvc_… | Cookie: absent                                               <- P7
#25 {"kind": "http-aborted-by-client", "url": "/api/v1/video/status"}
#26 upgrade GET  /ws | Host: 127.0.0.1:4420 | Origin: http://127.0.0.1:4420 | User-Agent: okhttp/4.12.0 | Authorization: Bearer dvc_… (47 chars) | Cookie: present, equals the issued value: True | Sec-*: {'sec-websocket-key': '(24 chars)', 'sec-websocket-version': '13', 'sec-websocket-extensions': 'permessage-deflate'} | names: cookie,authorization,origin,upgrade,connection,sec-websocket-key,sec-websocket-version,sec-websocket-extensions,host,accept-encoding,user-agent   <- P9
#28 {"kind": "ws-message", "text": "ping-w12"}
#29 {"kind": "ws-message", "text": "close:4403"}
#30 {"kind": "ws-close", "code": 4403}
#31 upgrade GET  /ws | ... the same headers ...                                                                                                             <- P10
#35 {"kind": "ws-close", "code": 4401}
#36 http    POST /api/v1/proof/forget-cookie | ... | Authorization: absent | Cookie: present, equals the issued value: True                                <- P11
#37 http    POST /api/v1/proof/echo | ... | Authorization: absent | Cookie: absent                                                                          <- P12
```

Of the `Authorization` header the harness logs presence, scheme, the first 4 characters and the
length. The value is a fake string made on the device at each run (`dvc_PROBE_FAKE_` and 32 random
hex characters); it is in no file.

### 17.3 Which `fetch` is active on the device (measured)

| Fact | Evidence |
|---|---|
| Engine and platform | Hermes `250829098.0.17` (Hermes V1), React Native 0.86.3, Android API 36 (P0a) |
| `globalThis.fetch` is **not** the function `expo/fetch` exports | `globalFetchIsExpoFetch: false`, name `_fetch` (P0a, both runs) |
| It is Expo's relative-URL wrapper around it | It carries `Symbol.for('expo.polyfillFetchWithWindowLocation')` (P0a run 2). Source: `node_modules/@expo/metro-runtime/src/location/install.native.ts:55-91`: `_fetch` rewrites a URL that starts with `/` and then calls the fetch it wrapped; lines 88-91 install it as the global |
| The wrapped function is `expo/fetch` | The answer of the global fetch and an answer of the `expo/fetch` export have the same constructor (`sameClassAsExpoFetchAnswer: true`), named `FetchResponse`, with `_rawHeaders`, without the polyfill's `_bodyInit`, and with `body` a `ReadableStream` (P0b). `EXPO_PUBLIC_USE_RN_FETCH` is not set (`useRnFetchFlag: null`) |
| The typed client works on it both ways | P1 and P5 use a client that looks the global up itself; P2, P3 and P4 use a client that is handed `globalThis.fetch` |
| The body is read without the stream | The client reads `text()`; zod validated the bodies on the device (P1, P2 valid; P5 refused with nine issue paths) |
| The abort works | P7: the call settled as `TIMEOUT` after 1,057 ms and the harness logged `http-aborted-by-client` (line #25) |
| Globals present | `ReadableStream`, `AbortController`, `TextDecoder`, `Headers`, `WebSocket`: all `function` |

The wrapper is not a debug-only layer: the same module installs it in a release build (its condition
is `extra.router.origin !== false`, `install.native.ts:77`).

### 17.4 What the app sends (measured; input to SR-69, SD-02, ID-12, CA-08)

| Header | REST call through the typed client | Socket upgrade (`new WebSocket(url, null, { headers })`) |
|---|---|---|
| `Origin` | **absent** on every request, GET and POST | **`http://127.0.0.1:4420`**: the origin of the URL the app opens, as CA-08 and SA-03 assumed |
| `Host` | `127.0.0.1:4420` (the device-side address, also on a lane backend that listens on 4421) | `127.0.0.1:4420` |
| `Authorization` | `Bearer <value>`, exactly one, as the credential provider returned it | `Bearer <value>`: the `headers` option of React Native's socket reaches the upgrade |
| `Cookie` | **absent**, also while the app's cookie store held a cookie for that host (lines #18 to #24) | **present** while the store holds one for that host (lines #26, #31) |
| `User-Agent` | `okhttp/4.12.0` | `okhttp/4.12.0` |
| `Sec-*` | none (no `Sec-Fetch-*`) | `sec-websocket-key`, `sec-websocket-version: 13`, `sec-websocket-extensions: permessage-deflate`; no `sec-websocket-protocol` |
| Others | `accept: application/json`; `content-type: application/json` and `content-length` with a body; `accept-encoding`; `connection: Keep-Alive` | `upgrade`, `connection: Upgrade`, `accept-encoding` |

Close codes: the device reports 4403 and 4401 exactly, with the reason text (P9, P10). CA-08 holds.

The cookie store, in the order of run 2:

| Step | Request | What it shows |
|---|---|---|
| #14 | Typed client, `credentials: 'omit'`; the answer offers a cookie | — |
| #15 | Raw fetch, default options | No cookie came back: **an answer to an `omit` request is not stored** (P1b) |
| #16 | Raw global fetch, default options; the answer offers the cookie again | — |
| #17 | Raw fetch through the `expo/fetch` export, default options | The cookie came back: **default options store and send cookies** |
| #18 to #24 | Typed client, `omit` | **No cookie is sent although the store holds one** |
| #26, #31 | Socket upgrades | **The cookie is sent**, together with the bearer header |
| #36, #37 | Raw fetch: the harness deletes the cookie, then sees none | The app is left without it (P12); it also had `Max-Age=60` |

### 17.5 The app and the device afterwards

| Point | State | Evidence |
|---|---|---|
| Reverse rules | None left on `emulator-5554` | `adb reverse --list` at 11:06:55: empty. They were set and removed by `device-session.sh` (`DEMS_CORE_HOST_PORT=4421`); this row set none by hand |
| App process | Not running (force-stopped by the session's cleanup) | `pidof com.dems.demo.tablet`: exit 1 |
| Mode | Simulated, sign-in screen | Screencap `assets/12c_run2_screen_dems2_phone.png`: "Core online", "Core: DEMS-IR-01 • paired (simulated)". No preference key is stored: the query for `dems.mobile.prefs.v1` returns nothing, so the Core link source is its default |
| Stored keys | The same two as before the first launch: `dems.sim.v1` and `dems.mobile.log.v1` | `assets/12c_run2_app_data_before.txt`, `12c_run2_app_data_after.txt` |
| What did change | The runtime log grew from 187 bytes (before run 1) to 2,686 bytes: it holds the probe's reports, among them one error record of run 1's FAIL. `dems.sim.v1` was rewritten by each launch (119,897 → 119,899 bytes). `shared_prefs/com.dems.demo.tablet_preferences.xml` holds the bundler location that `device-session.sh` writes | the two listings; run 1's screencap shows the development error toast of that record, run 2's shows none |
| Cookie store | No harness cookie | P12, harness line #37 |
| Device lock | Untouched: no keyguard before and after; nothing was typed or set | `isKeyguardShowing=false`, user 0 `RUNNING_UNLOCKED`, read-only |
| Host | Nothing listens on 4421 or 8081 to 8086; lane PID file removed; no process of the run left | `lsof` exit 1 at 11:06:55 |

Processes started and stopped by this part: harness 91133 (run 1) and 91906 (run 2), Metro
91206 and 91988 (through `device-session.sh`), two `expo export` runs, test runs. Timings: bundle of
6,084 modules in 1,031 ms and 883 ms; cold start 3.7 s and 3.5 s; the probe took 1.8 s.

### 17.6 Findings and decisions of the device part

| ID | Finding |
|---|---|
| F34-12 | **The global `fetch` of the app is Expo's wrapper `_fetch` around `expo/fetch`**, in debug and in release builds (17.3). The client is not affected. A check "is this expo/fetch" must go by the answer's class, not by function identity |
| F34-13 (security) | **React Native's socket sends the cookie store's cookie for the host on the upgrade, next to the bearer header** (17.4). By 01_specs §9.2 the server answers a cookie together with an `Authorization` header with 401 at the handshake (ID-12). The store is filled only by a fetch with default options: the typed client (`credentials: 'omit'`) neither sends nor stores a cookie. Cookies are scoped by host, not by port, so a cookie set by anything on `127.0.0.1` (the web console's session cookie on a developer's machine cannot reach the emulator; mock-core sets none) would travel to the Core server's socket |
| F34-14 | REST calls of the app carry **no `Origin`**; the socket upgrade carries `http://127.0.0.1:4420`. A lane backend on 4421 sees `Host: 127.0.0.1:4420` and that origin, so its own-origin list needs `http://127.0.0.1:4420` (as 02_plan §5.2 says). Now measured |
| F34-15 | The upgrade offers `permessage-deflate`. The server has compression off (RT-P7); the harness's `ws` did not negotiate it and the socket worked |
| F34-16 | zod 4.6.5 validates on Hermes V1 without `jitless`: three request examples parsed and five answers validated on the device |
| F34-17 | The older PIN-locked emulators play no part here; `device_w12.sh` still stops (exit 77) if the Android user is not `RUNNING_UNLOCKED` |

| ID | Decision for the controller | Recommendation |
|---|---|---|
| D34-6 | F34-13: how the server and the app keep a cookie off the mobile socket | (a) Rule for the mobile rows (W30, W44, W51 onward): every request to the Core origin goes through the typed client; no raw `fetch` to it. A static test in the mobile app can enforce that. (b) For W23, W24, W42: the server never sends `Set-Cookie` on an answer to a bearer or public request of a device, and its 401 for "cookie and bearer together" looks only at its own cookie name. (c) Give F34-13 to the security review (W45) |
| D34-7 | F34-12 | Record; no action |
| D34-1 | The unlock of the older emulators | Closed by the lock-free emulators (D58) |

---

## 18. Contract C adaptation (11:07 to 11:10 WIB; controller decision D64)

Contract C (`implementation/27_contract_c.md`, findings F-1 and F-2) brought the registry to 75
operations and left a proposed patch for this row's files. It was applied after the device session
had ended, so no running app saw a file change. Nothing under `packages/shared/src/api/**` was edited.

### 18.1 What was red

`assets/12c_gate_before_contract_c_patch.log` (11:03, before the patch):

```
$ npm run typecheck -w @dems/shared
test/api-registry.test.ts(841,29): error TS2590: Expression produces a union type that is too complex to represent.
test/api-registry.test.ts(857,7): error TS2578: Unused '@ts-expect-error' directive.   (and 859, 861, 863, 865)
test/client-types.test.ts(211,5): error TS2578: Unused '@ts-expect-error' directive.   (and 213, 215, 217)
exit=2
$ npm run typecheck -w @dems/mobile
src/runtime/dev-probes.ts(239,24): error TS2590: Expression produces a union type that is too complex to represent.
exit=2
```

The cause is in the client's types, not in the contract: `CoreCallInput` was written as
`ParamsOf<U> & BodyOf<U> & QueryOf<U>` over the union `U` of all operations. Inside the generic
`call` signature that is the cross product of three unions, n × n × n members; the compiler refuses a
union above 100,000 members, which is reached at n = 47 (46³ = 97,336; 47³ = 103,823; 75³ = 421,875).
After that error the input of a typed call was no longer checked (the four unused directives).
Nothing was wrong at run time, which is why the device proof did not need the fix.

### 18.2 The change (`assets/12c_contract_c_client.diff`)

Applied as proposed: `git apply -p0 implementation/assets/27_proposed_client_changes.patch` (exit 0),
then one regression test of my own.

| # | File:line before | Was | Is now (file:line) | Reason |
|---|---|---|---|---|
| 1 | `packages/shared/src/client/core-client.ts:244-247` | `CoreCallInput = IsLiteralTable<Ops> extends true ? ParamsOf<OperationOf<Ops, Id>> & BodyOf<OperationOf<Ops, Id>> & QueryOf<OperationOf<Ops, Id>> : CoreLooseCallInput` | `:243-249` a new helper `type InputOfOperation<Op> = Op extends unknown ? ParamsOf<Op> & BodyOf<Op> & QueryOf<Op> : never` with a comment that names the limit (n × n × n above 100,000 at n = 47); `:252-253` `CoreCallInput = IsLiteralTable<Ops> extends true ? InputOfOperation<OperationOf<Ops, Id>> : CoreLooseCallInput` | The conditional type distributes over the union, so the intersection is taken per operation: n members, not n³. A call with a literal ID has the same input type as before. Type only: no run-time change |
| 2 (by-design test change) | `packages/shared/test/client-core.test.ts:483-485` | The loop over the 204 operations called each with its request example and no path parameter | `:482-490` it also passes `examples.pathParams` | Ten of contract C's 204 operations have `{id}` (W27 F-2). The client is right to refuse a call without it; the main loop of the same file already passed the parameter (`:130`) |
| 3 (new test) | — | — | `packages/shared/test/client-types.test.ts:208-232`, "the input type of the full registry can be evaluated: one intersection per operation, not a cross product (TS2590)" | The regression test D64 asks for (18.3) |

I did not deviate from the proposed patch: its form is the smallest one that fixes the cause.

### 18.3 The regression test

Checked by `npm run typecheck -w @dems/shared` against the **full registry table** (75 operations;
the test asserts at run time that the table has at least 47, the size at which the limit is reached):

- `CoreCallInput<RegistryTable, CoreOperationId>` (the input over all IDs, as the compiler forms it
  in the generic signature) is neither `any` nor `never`: it can be evaluated at all.
- For the literal ID `exportEvidence` the input is exactly
  `{ params: { id: string } } & { body: EvidenceExportRequest } & { query?: CoreQuery }`.
- A value with the path parameter but without the body, and one with the body but without the path
  parameter, are **not** assignable to it (a cross product would mix the parts of different
  operations).
- **An unknown operation ID is a compile error**: `client-types.test.ts:238-239`
  (`// @ts-expect-error` over `client.call('noSuchOperation')`). The four directives that were
  reported as unused before the fix are in use again: `:240-247` (missing path parameter, missing
  body, wrong body type, a body on an operation without one). W27's own five in
  `api-registry.test.ts:857-865` are in use again too.

That the test can fail is the state of 18.1: with the old type the typecheck exits 2.

### 18.4 Verification (11:08:12 to 11:09:45, after the last edit at 11:07:54)

`assets/12c_gate_static.log`, `12c_gate_shared_test.log`, `12c_gate_mobile_test.log`,
`12c_release_bundle_check.log`:

```
$ npm run typecheck -w @dems/shared        exit=0
$ npm run lint -w @dems/shared             exit=0
$ npm run typecheck -w @dems/mobile        exit=0
$ npm run lint -w @dems/mobile             exit=0
$ npm run typecheck -w @dems/core-web      exit=0
$ npm run typecheck -w @dems/core-server   exit=0
$ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  57 passed (57)
      Tests  1406 passed (1406)            exit=0
$ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 72 passed, 72 total
Tests:       833 passed, 833 total
Time:        39.832 s                      exit=0
```

No run failed, so no second run is recorded (P11). The contract row measured 1,404 of 1,405 before
the patch and 1,405 with it; the one more is this row's regression test. This row's three files hold
96 tests now (`client-core` 81, `client-types` 8, `client-platform-neutral` 7). The release-gate test
is unchanged (`6aa6db7ef1cc666b03be489a23e2146b3e28f9ac`, as at `acaff20`).

`dev-probes.ts` changed in section 17, so the release check was repeated: the release bundle holds
no `DEMS-PROBE-W12`, `dev-probes`, `runDevProbe`, `devProbeFromUrl`, `probe=`, `createCoreClient`,
`CoreClientUsageError` or `CONTRACT_VIOLATION` (all 0; positive controls 1); the development bundle
holds the probe, the client and `expo/fetch`.

### 18.5 Files of sections 17 and 18

| Path | Change |
|---|---|
| `packages/shared/src/client/core-client.ts` | 18.2 row 1 (713 → 719 lines) |
| `packages/shared/test/client-core.test.ts` | 18.2 row 2 |
| `packages/shared/test/client-types.test.ts` | 18.2 row 3 (7 → 8 tests) |
| `apps/mobile/src/runtime/dev-probes.ts` | The fetch check corrected (P0a, P0b), P1b, P11 and P12 added, request ID in failure lines (368 → 427 lines). `debug.ts` unchanged |
| `.cache/proof-harness/harness.mjs`, `device_w12.sh`, `host_control_w12.mjs` (git-ignored) | The health cookie has `Max-Age=60`; route `POST /api/v1/proof/forget-cookie`; the device script lists the app's stored keys before and after and stops with 77 on a locked user |
| `.cache/rollback/W12c.*.pre`, `W12d.*.pre` (git-ignored) | Pre-images of the files changed in sections 17 and 18 |
| `implementation/assets/12c_*` | 20 files: two device runs (logs, harness logs, logcat lines, screencaps, app data listings), the scripts as run, the gate logs, the diff, the release bundle check |

Rollback of section 18 alone: `cp .cache/rollback/W12d.core-client.ts.pre packages/shared/src/client/core-client.ts`
and likewise for the two test files (the typecheck is then red again, as in 18.1). Rollback of the
probe changes of section 17: `cp .cache/rollback/W12c.dev-probes.ts.pre apps/mobile/src/runtime/dev-probes.ts`.

---

## 19. Fix round after CP-C1 (decision D80; 13:08 to 13:15 WIB)

The checkpoint review of the shared client layer (`gateway_check/07_cp_shared_client.md` §5) reported
two findings in this row's files. Both are fixed. Written: `packages/shared/src/client/core-client.ts`
and one new test file, `packages/shared/test/client-credentials.test.ts`. Nothing under
`packages/shared/src/api/**`, `packages/shared/src/live/**` or `apps/**` was edited.

### 19.1 CPC1-3 (Medium): the credential provider was outside the time-out

**Before.** `call` awaited the provider first (`core-client.ts:555` at that time) and created its
timer afterwards (`:619-625`). A provider that never answered made the call hang for ever; one that
rejected made the call reject with the provider's own error (text included); one that answered late
still sent its request.

**Now** (`core-client.ts:591-737`):

| Step | Lines | What happens |
|---|---|---|
| 1 | `:598-609` | Everything that needs no credential is checked first: path parameters, the query, the body, the transport. An invalid call rejects with `CoreClientUsageError` **without asking the provider** |
| 2 | `:657-665` | **One budget.** The timer of `timeoutMs` starts here, before the provider is asked. When it fires it marks the call expired, settles the race and aborts the request, if one is out |
| 3 | `:675-705` | One piece of work that never rejects: ask the provider; if the budget is already spent, stop (**no request**); check that the bearer value is not in the URL; send; read the body. Every failure of the provider or the transport becomes a value |
| 4 | `:706-737` | The race between that work and the timer decides the result |

| What the provider does | Result of `call` |
|---|---|
| Answers in time | As before. The exchange has what is left of the budget: 3 s in the provider leave 5 s for the answer |
| Rejects or throws | Resolves with `kind: 'CREDENTIALS'`, `status: null`, `error.code: 'CREDENTIALS_UNAVAILABLE'`, `transport: 'CORE_OFFLINE'`. Message: "The credential for this request could not be read. Nothing was sent." The provider's own error is not passed on, so no token and no provider text can leak |
| Does not answer within `timeoutMs` | Resolves at the time-out with `kind: 'CREDENTIALS'`, `error.code: 'CREDENTIALS_TIMEOUT'`, `transport: 'CORE_OFFLINE'`. Message: "The credential for this request was not available within 8000 ms. Nothing was sent." |
| Answers after the time-out (with a value, an invalid value, or a rejection) | Nothing: no request, no rejection, no unhandled promise. The call settled at the time-out |
| Returns a value that cannot be a header value | `CoreClientUsageError`, as before (a programming error) |

The exchange's own time-out keeps its kind `TIMEOUT` ("the command may or may not have been
applied"). The new kind says the opposite, **nothing was sent**, which is why it is a kind of its
own and not a second code under `TIMEOUT`. Both are reported to the `report` sink (level `warn`) and
write one debug line with `status: null`.

**Red before, green after.** The new tests were written first and run against the unchanged client
(`assets/12d_cpc1_red_before.log`: `core-client.ts` hash `84db3a2f…`, 8 failed, 10 passed, exit 1),
then against the fixed one (`assets/12d_cpc1_green_after.log`: hash `37a7782b…`, 18 passed, exit 0).

| Test (`client-credentials.test.ts`) | Before the fix | After |
|---|---|---|
| A provider that never resolves: the call settles at the time-out as `CREDENTIALS_TIMEOUT` and nothing is sent | **red**: `expected false to be true` (not settled after 8,000 ms on the fake clock) | green |
| A provider that fails with a rejected promise | **red**: `expected Error: secure store refused: dvc_TEST_FAK… to be undefined` (the call rejected with the provider's own error and text) | green |
| A provider that fails by throwing | **red**: the same | green |
| A provider that fails with something that is not an Error | **red**: `expected 'secure store refused: dvc_TEST_FAKE_0…' to be undefined` | green |
| A provider that answers after the time-out has fired: no request is made | **red**: `expected "vi.fn()" to not be called at all, but actually been called 1 times` (a late request) | green |
| A provider that answers late with an invalid value, or rejects late: nothing is sent, nothing is thrown | **red**: `expected CoreClientUsageError: The credential prov… to be undefined` (a late rejection) | green |
| One budget, not two: 3 s in the provider leave 5 s for the answer | **red**: `expected false to be true` (the old timer started after the provider: 11 s in all) | green |
| An invalid call is refused before the provider is asked | **red**: `expected "vi.fn()" to not be called at all, but actually been called 3 times` | green |
| Normal path: a slow provider inside the budget | green | green |
| Normal path: a synchronous provider, an asynchronous one, one without a value | green | green |
| Normal path: the web client asks no provider and is bounded by the same time-out | green | green |
| Normal path: a value that cannot be a bearer token is a programming error | green | green |
| Normal path: the bearer value in a URL is a programming error, found after the provider answered | green | green |

"The call rejects at the time-out" in the request reads, in this client's terms, "the call settles
with a failure at the time-out": by CL-1 the client resolves with a typed failure and rejects only
for a programming error. The clock of the tests is Vitest's fake timer, which is the clock the client
uses (`setTimeout`).

### 19.2 CPC1-12 (Low): the token prefixes of the URL guard

The contract exports the three bearer secrets as whole patterns
(`packages/shared/src/api/patterns.ts:52-54`: `SESSION_TOKEN_PATTERN`, `DEVICE_CREDENTIAL_PATTERN`,
`BIOMETRIC_TOKEN_PATTERN`) and **no constant for their prefixes**. So, as ruled for that case:

- The client keeps its expression, `core-client.ts:70`, now under a comment that carries the text
  `CONTRACT-GAP-4` (`:59-69`) and says what to do when the contract exports the prefixes.
- A test ties the two until then (`client-credentials.test.ts`, block "CPC1-12", 5 tests): it reads
  the literal head of **every** exported pattern whose name ends in `_TOKEN_PATTERN` or
  `_CREDENTIAL_PATTERN`, asserts that there are exactly three (`ses_`, `dvc_`, `bio_`), and that a
  value of each form is refused in a query value and as a path parameter before any request. A fourth
  secret added to the contract turns the first of them red.
- That the test can fail (`assets/12d_cpc1_prefix_mutation.log`): with `bio` removed from the
  expression, "a value of the form of BIOMETRIC_TOKEN_PATTERN is refused" fails
  (`promise resolved "{ ok: true, … }" instead of rejecting`); the file was restored (`cmp` equal).

**CONTRACT-GAP-4, the exact export for the contract close-out row (W83)**, in
`packages/shared/src/api/patterns.ts`, next to the three patterns:

```ts
/** The prefixes of the three bearer secrets (ID-P6, PR-P8, §5.6): session token, device credential, biometric token. */
export const BEARER_SECRET_PREFIXES = ['ses_', 'dvc_', 'bio_'] as const;
```

(the three patterns can be built from it). The client then replaces line 70 by an expression built
from that list, and the test compares with the list instead of reading the patterns' heads. Both are
a change of a few lines in this row's two files.

### 19.3 API of `@dems/shared/client`: what changed

No export was removed or renamed, no option was added, `index.ts` is unchanged.

| Change | Kind |
|---|---|
| `CoreErrorKind.CREDENTIALS` (`'CREDENTIALS'`), a new member of the failure kinds | additive |
| Two new values of `failure.error.code`, built by the client: `CREDENTIALS_UNAVAILABLE`, `CREDENTIALS_TIMEOUT` | additive |
| `coreTransportReason('CREDENTIALS', null)` is `'CORE_OFFLINE'` | additive |
| `CoreClientReport.kind` can be `'CREDENTIALS'` (level `warn`) | additive |
| The provider's time counts against `timeoutMs` (one budget) | behaviour, the fix |
| A provider that rejects no longer makes `call` reject | behaviour, the fix |
| The input of a call is checked before the provider is asked; the "bearer value in a URL" check runs after it | behaviour: an invalid call no longer reads a credential |

**What the Live source maps it to: nothing new has to be written.** `transportErrorOf`
(`packages/shared/src/live/source/rebuild-error.ts:81-89`) builds a `LiveTransportError` from
`failure.transport` and passes `failure.error.code` on. So both new cases arrive as
`LiveTransportError('CORE_OFFLINE', { status: null, code: 'CREDENTIALS_UNAVAILABLE' | 'CREDENTIALS_TIMEOUT' })`:
a transport error of the class `CORE_OFFLINE`, with the wording of "the command was never sent"
(LB-6), not of a time-out (LB-7, which is keyed to the code `TIMEOUT`). No switch over the kinds
exists outside this row's files (searched: `packages/shared/src`, `packages/shared/test`, `apps`).
The Live source's own tests pass on the changed client (19.4).

### 19.4 Verification (13:13:39 to 13:14:00, after the last edit)

`assets/12d_gate_static.log`, `12d_gate_shared_test.log`:

```
$ npm run typecheck -w @dems/shared      exit=0
$ npm run lint -w @dems/shared           exit=0
$ npm run typecheck -w @dems/mobile      exit=0
$ npm run typecheck -w @dems/core-web    exit=0
$ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  65 passed (65)
      Tests  1668 passed (1668)          exit=0
```

Baseline at 12:38: 64 files, 1,650 tests. Added by this round: one file,
`packages/shared/test/client-credentials.test.ts`, 18 tests (64 + 1 = 65; 1,650 + 18 = 1,668). No
existing test was changed; no run failed, so no second run is recorded (P11). This row's four client
test files hold 114 tests (`client-core` 81, `client-types` 8, `client-platform-neutral` 7,
`client-credentials` 18).

`apps/mobile/src/runtime/dev-probes.ts` still type-checks (the mobile typecheck above); this round
did not edit it or any other mobile file. The mobile release-gate test is untouched
(`git hash-object`: `6aa6db7ef1cc666b03be489a23e2146b3e28f9ac`, as at `acaff20`). The static scan of
the client folder (`client-platform-neutral.test.ts`) passes on the changed file.

### 19.5 Files, findings, rollback

| Path | Change |
|---|---|
| `packages/shared/src/client/core-client.ts` | 19.1 and 19.2 (719 → 815 lines; `assets/12d_cpc1_core_client.diff`) |
| `packages/shared/test/client-credentials.test.ts` | New, 18 tests |
| `implementation/assets/12d_*` | Six files: red before, green after, the mutation, the gates, the diff |
| `.cache/rollback/W12e.core-client.ts.pre` (git-ignored) | The pre-image |

| ID | Finding |
|---|---|
| F34-19 | CPC1-3 was real in all three forms the reviewer read: a hang, a rejection that carried the provider's text (in the test it holds a token-shaped value), and a late request. Measured in 19.1 |
| F34-20 | The old order also read a credential for a call that was then refused as invalid. On mobile that would have been a secure-store read for nothing; the new order avoids it |
| F34-21 | The provider gets no abort signal: after the time-out it may still be running. The client ignores what it returns then. If W51's provider can wait behind an OS prompt, the reviewer's rule stays sensible: return a value held in memory |
| CONTRACT-GAP-4 | 19.2: the export `BEARER_SECRET_PREFIXES` in `api/patterns.ts`, for W83 |

Rollback of this round: `cp .cache/rollback/W12e.core-client.ts.pre packages/shared/src/client/core-client.ts`
and `rm packages/shared/test/client-credentials.test.ts`.

---
*Generated: 2026-10-04 07:25 WIB*
*Last Updated: 2026-10-04 13:18 WIB*
