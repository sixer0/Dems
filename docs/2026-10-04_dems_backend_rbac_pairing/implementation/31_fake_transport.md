---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 53
plan_row: W31 (wave B4)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete
---

# 31 Fake transport HB-11 (blueprint step 53, plan row W31)

Row, verbatim: [W31] Fake transport HB-11, contract-checked in both directions, for Vitest and jest.
Writes: `packages/shared/src/live/testing/**`, `packages/shared/test/live-testing-*.test.ts`. Locks:
none. Implements AC-C-02, AC-C-17. Rollback R-NEW.

**Result line: done and verified.** `@dems/shared/live/testing` now exports one test double for the
client tests of both apps: a `fetch`-compatible function for the typed client and a socket constructor
and factory for the socket clients, with one call log, a clock and named errors. `@dems/shared`:
**1,351 passed of 1,351 in 55 files** (1,012 in 47 files when this row started; 209 new tests in six
`live-testing-*` files; the other 130 new tests in two `realtime-live-*` files are row W30's, written
in the same wave). Typecheck and lint of `@dems/shared` exit 0; typecheck of `@dems/core-web` and
`@dems/mobile` exit 0. The module loads and works under the mobile jest configuration (6 of 6 in a
scratch test, two invocations).

| Field | Value |
|---|---|
| Started / last run | 2026-10-04 about 09:45 WIB (reading; baseline run 09:50:37) / final gate 10:31:11 to 10:31:39 WIB, confirmation run in section 6.2 |
| Source files | 9 in `packages/shared/src/live/testing/` (3,373 lines with comments) |
| Test files | 6 in `packages/shared/test/`, 209 tests (2,439 lines) |
| Dependencies | None added. No manifest, no lockfile and no export map edited (the subpath `./live/testing` exists since W03) |
| Contract | Nothing under `packages/shared/src/api/` written (P17). Read only. No `CONTRACT-GAP` |
| Simulator | Nothing under `packages/shared/src/sim/` written (P21). The test files import it to build a whole state; the source folder does not |
| Network, ports, timers, globals | None: no request, no listener, no timer call and no real-time read in the nine files (static test, section 4.4). The global `fetch` and socket constructor are touched only by the opt-in `installFakeTransport` |
| Registry at the time | 37 operations (contract C, row W27, had not written `src/api/` yet at 10:31). The fake and its registry tests read the table at run time and pin no count above "at least 37" |

Abbreviations: [CS] = `masterplan/04_client_integration_spec.md`; [SP] = `masterplan/01_specs.md`;
[AN] = `research/03_analysis.md`; [PL] = `masterplan/02_plan.md`.

---

## 1. What was done

1. Read the inputs: 02_structured (row 53; P6, P9 to P12, P21 to P24), 02_plan (W31 in section 8.3;
   sections 3.4, 11, 12), [CS] sections 2, 5.1, 12, 13.1, [AN] TD-12, [SP] API-1 to API-13, sections
   4.1, 5.2 (ID-1, ID-12), 9.2; `implementation/12_typed_client_emulator_proof.md` (with section 16),
   `18_live_light_api_settle.md`, `19_contract_a.md`, `22_contract_b.md`; the code
   `packages/shared/src/api/**`, `src/client/core-client.ts`, `src/realtime/heartbeat-client.ts`,
   `test/heartbeat-client.test.ts`, `test/client-core.test.ts`, `apps/mobile/jest.config.js`,
   `jest.setup.ts`, the `test` block of `apps/core-web/vite.config.ts`, and, when it appeared at
   10:00, row W30's `src/realtime/live-socket-client.ts` (its injected factory and timers).
2. Baseline taken before the first edit (section 6.1). P23 pre-image saved:
   `.cache/rollback/W31.pre.patch` (0 bytes: the folder is not in `acaff20`) and a copy of W03's
   one-line placeholder, `.cache/rollback/W31.live-testing-index.ts.pre`.
3. Wrote the nine source files, then the six test files. Every behaviour test drives the fake through
   a real consumer: the typed client (`createCoreClient`), the heartbeat client
   (`createHeartbeatClient`) and, in one file, the live socket client (`createLiveSocketClient`).
4. Checked that the tests can fail: 26 single changes of the source, each restored; all 26 are
   detected (section 6.5).
5. Proved the module under jest with the mobile configuration, in a scratch test under `.cache/w31/`
   (section 5), ran the five behaviour files once in a jsdom environment, and compiled a probe under
   each client's own compiler options (section 6.4).

---

## 2. Files

| Path | Lines | Content |
|---|--:|---|
| `packages/shared/src/live/testing/index.ts` | 74 | The barrel; replaces W03's one-line placeholder |
| `.../testing/fake-transport.ts` | 379 | `createFakeTransport`, `withFakeTransport`, the common sequences, `exampleAnswer`, `exampleInput`, `refusal`, `rateLimited`, `notReady` |
| `.../testing/http.ts` | 712 | The `fetch`-compatible function, scripted answers (repeating, one-shot, held, responder), delivery, abort |
| `.../testing/socket.ts` | 804 | `FakeSocket` (the client's end), `FakeConnection` (the server's end), the constructor and the factory, connect scripts |
| `.../testing/contract.ts` | 540 | `checkRequest`, `checkAnswer`, route matching, URL reading, credential form: pure functions over the registry |
| `.../testing/log.ts` | 337 | The shared call log and its masked text |
| `.../testing/clock.ts` | 156 | `createFakeClock` (manual, with `timers`), `clockFromTimers` |
| `.../testing/errors.ts` | 317 | The six named errors, their reason sets, `maskCredentials`, `maskHeaderValue`, `FAKE_CREDENTIALS` |
| `.../testing/install.ts` | 54 | `installFakeTransport`: the opt-in for the global `fetch` and socket constructor |
| `packages/shared/test/live-testing-fetch.test.ts` | 848 | 89 tests: the HTTP half through the real typed client; the registry loop; both contract checks; ending a test |
| `.../test/live-testing-socket.test.ts` | 780 | 63 tests: the socket half through the real heartbeat client; the clock; upgrade, server and client messages, closing |
| `.../test/live-testing-log.test.ts` | 386 | 28 tests: the call log, the masking, the common sequences of TS-13 |
| `.../test/live-testing-platform-neutral.test.ts` | 220 | 20 tests: the static scan (AC-C-02), the export surface, TS-15 |
| `.../test/live-testing-install.test.ts` | 91 | 5 tests: no global touched by default; install and restore |
| `.../test/live-testing-live-socket.test.ts` | 114 | 4 tests: the fake under row W30's live socket client, on the fake clock's timers |

Evidence, in `implementation/assets/`: `31_baseline_shared_test.log`, `31_baseline_shared_static.log`,
`31_gate_final.log`, `31_live_testing_tests_verbose.log` (the 209 test names), `31_jest_proof.log`,
`31_jest_proof.test.ts.txt`, `31_jest_microtask.log`, `31_jest_microtask.test.ts.txt`,
`31_vitest_jsdom.log`, `31_client_probe.log`, `31_client_probe.ts.txt`, `31_mutations.log`,
`31_mutate.py.txt`, `31_doc_examples.log`.

Not touched: every file outside the two write paths, including `src/api/**`, `src/client/**`,
`src/realtime/**`, `src/sim/**`, `src/live/*.ts`, `src/live/source/**`, every `package.json`, the
lockfile, every file under `apps/`, every existing test file.

---

## 3. Public API of `@dems/shared/live/testing`

For tests and test harnesses only (TS-15). The exported names are pinned by a test (33 names).

### 3.1 Making a fake

```ts
function createFakeTransport<Clock extends FakeClock = ManualFakeClock>(options?: {
  operations?: readonly CoreApiOperation[];             // default: the registry, CORE_API_OPERATIONS
  schemas?: Readonly<Record<string, ContractSchema>>;   // default: CORE_API_SCHEMAS
  examples?: Readonly<Record<string, OperationExamples>>; // default: CORE_API_EXAMPLES
  clock?: Clock;                                        // default: a manual clock at the examples' instant
  epoch?: number;                                       // default 1
  revision?: number;                                    // default 0
}): FakeTransport<Clock>;

function withFakeTransport<Result>(run: (fake: FakeTransport) => Result | Promise<Result>, options?): Promise<Result>;
```

`withFakeTransport` makes a fake, runs the body and ends with `assertNoViolations()`. When the body
fails after a violation was recorded, the violation is thrown and the body's failure is its `cause`.

### 3.2 The two transports and what they share

| Member | Type | Use |
|---|---|---|
| `fake.fetch` | `(input: unknown, init?: FakeFetchInit) => Promise<FakeFetchResponse>` | `createCoreClient({ fetch: fake.fetch })`. Assignable to the client's `CoreFetch` |
| `fake.socketFactory` | `(url: string, ...rest: readonly unknown[]) => FakeSocket` | A socket client's `socketFactory`. Assignable to `SocketFactory` (heartbeat client) and to `LiveSocketFactory` (`(url, headers)`, W30) |
| `fake.WebSocket` | `new (url, protocols?, options?: { headers }) => FakeSocket`, with `CONNECTING` to `CLOSED` | A constructor of the platform's shape; the React Native form passes the upgrade headers as the third argument |
| `fake.clock` | `Clock` | The fake's time: `now()`, `schedule(delayMs, task)`; the manual clock adds `advance(ms)`, `pendingTasks`, `timers` |
| `fake.log` | `FakeCallLog` | Section 3.5 |
| `fake.calls` | `readonly FakeHttpCall[]` | The requests of the log |
| `fake.position` | `{ epoch, revision }` | Where the fake Core server stands. `setPosition({ epoch?, revision? })`, `startEpoch()` (epoch plus 1, revision 0) |

### 3.3 Scripting answers (per operation ID)

```ts
fake.answer(operationId, reply | responder): void       // repeating; a static reply is checked HERE
fake.answerOnce(operationId, reply | responder): void   // one-shot; used in order, before the repeating one
fake.answerFromExample(operationId, status?, name?): void      // the contract's own example
fake.answerOnceFromExample(operationId, status?, name?): void
fake.answerAllFromExamples(): void                      // every unscripted operation answers its first 2xx example
fake.example(operationId, status?, name?): FakeAnswer   // the example as an object, to change or pass on
fake.exampleInput(operationId): { params?, body? }      // the example path parameters and request body
fake.fail(operationId): void;  fake.failOnce(operationId): void   // an outage: the transport rejects
fake.hold(operationId): FakeHeldAnswer                  // { call, settled, release(reply?), fail() }

type FakeReply = FakeAnswer | { outage: true; delayMs? } | { noAnswer: true };   // OUTAGE, NO_ANSWER
type FakeResponder = (call: FakeHttpCall) => FakeReply | Promise<FakeReply>;     // checked at answer time

interface FakeAnswer {
  status: number;
  body?: unknown;                       // JSON value; left out for a 204
  headers?: Record<string, string | number | null>;   // wins over what the fake adds; null leaves a header out
  epoch?: number; revision?: number;    // x-dems-epoch, x-dems-revision
  retryAfterSeconds?: number;           // retry-after
  requestId?: string;                   // x-request-id
  text?: string;                        // a body that is not JSON; only with violatesContract
  delayMs?: number;                     // kept on the fake's clock
  violatesContract?: boolean;           // a deliberate violation: delivered as scripted, not checked
}
```

Headers the fake adds by itself: `x-request-id` on every answer (the envelope's `error.requestId` when
the body has one, else `fake-request-<seq>`), `content-type` on an answer with a body, `x-dems-epoch`
and `x-dems-revision` (the position) on a 2xx answer of a POST [SP:API-7].

Helpers that need no fake (they read the registry): `exampleAnswer(operationId, status?, name?)`,
`exampleInput(operationId)`, `refusal(status, code, message?, details?)`, `rateLimited(seconds = 30)`
(429 with `retry-after`), `notReady()` (503).

### 3.4 Sockets

```ts
fake.connections: readonly FakeConnection[];
fake.connection(index?): FakeConnection;                 // the socket opened last, or the one at index
fake.onConnect((connection) => void): () => void;        // runs for every later socket, on a promise job
fake.runPendingConnects(): void;                         // runs them now, for a test that does not await
```

`FakeConnection` is the server's end of one socket:

| Group | Members |
|---|---|
| What the client did | `id`, `url`, `headers` (the upgrade headers, as given), `protocols`, `state`, `closed` (`{ by: 'server' or 'client' or 'network', code, reason }`), `frames`, `sent`, `received`, `receivedOf(type)`, `socket` (the client's end) |
| The upgrade | `accept()`, `refuse()` (error, then close 1006) |
| Messages | `send(message, { violatesContract? })` (checked here), `sendRaw(text)` (always a deliberate violation) |
| Ending | `close(code, reason?, { violatesContract? })` (a code of `REALTIME_CLOSE_CODES`), `drop()` (error, then close 1006) |
| Built from the clock and the position | `hello(principal, overrides?)`, `heartbeat(overrides?)`, `beatEvery(intervalMs = 1000)` (returns the stop function), `snapshot(state, { epoch?, revision?, serverTime? })`, `delta(ops, ...)` (revision = position plus 1, and the position moves), `meters(audio)` |
| The four control messages | `sessionUpdated(operator, permissions)`, `sessionEnded(reason)` (then close 4401), `deviceRevoked(reason)` (then close 4403), `adminChanged(resource)` |
| Common starts | `startAnonymous(reason?)`, `startDevice()`, `startOperator(state, { admin? })` |

`FakeSocket` (the client's end) has `url`, `readyState`, the constants, `onopen`, `onmessage`,
`onclose`, `onerror`, `send(data)`, `close(code?, reason?)`, `addEventListener`, `removeEventListener`.
After the client closes, the state is CLOSING at once and the close event arrives on a promise job.

Common sequences on both halves (TS-13):

```ts
fake.scriptAnonymousStart(reason?): void          // getAuthSession 401, getSignInStatus 200, each socket: hello ANONYMOUS
fake.scriptSignedInStart(state, { admin?, session? }): void   // getAuthSession 200, each socket: hello OPERATOR + snapshot
fake.scriptCommand(operationId, { ops, order: 'delta-first' | 'answer-first', answer?, connection? }):
  { revision: number | null; deltaSent: boolean; sendDelta(): void }
```

`delta-first`: when the request arrives the delta of revision N is sent, then the answer with
revision N. `answer-first`: the answer with revision N arrives; the delta is sent when the test calls
`sendDelta()`. The other sequences of TS-13 are single calls: a refusal envelope (`refusal`,
`answerFromExample(id, 403)`), an outage (`fail`, `OUTAGE`), the four control messages and a close
with a code (the table above).

### 3.5 The call log (TS-14)

`fake.log`: `entries` (requests and sockets in order), `requests`, `sockets`, `requestsOf(operationId)`,
`operationIds()`, `urls()`, `clear()`, `toString()`, `toJSON()`.

| Entry | Members |
|---|---|
| `FakeHttpCall` | `kind: 'http'`, `seq`, `at`, `method`, `url`, `path`, `query`, `operationId` (null when no operation matched), `params`, `headers` (lower-case names, values as given), `credentials`, `bodyText`, `body` (parsed), `status`, `outcome` (`pending`, `answered`, `outage`, `aborted`, `refused`, `unscripted`, `bad-answer`) |
| `FakeSocketRecord` | `kind: 'socket'`, `seq`, `at`, `id`, `url`, `protocols`, `headers`, `state`, `frames` (`seq`, `at`, `direction`, `data`, `message`, `type`, `deliberate`), `closed` |

`seq` is one scale for requests, sockets and frames, so the order across both halves can be asserted.
Values are kept as given. Every text the log produces masks them: `toString()`, `toJSON()` and the
console form of the log, of one entry and of one header record. A bearer value prints
`Bearer ses_***`, a cookie its names only, a URL its path and the names of its query members, a body
its size and the names of its members.

### 3.6 The clock

```ts
createFakeClock(startMs = FAKE_CLOCK_START_MS): ManualFakeClock   // now(), schedule(), advance(ms), pendingTasks, timers
clockFromTimers({ now, setTimeout, clearTimeout }): FakeClock     // a clock on timer functions the test passes in
```

`ManualFakeClock.timers` has `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` on that
clock: the shape of W30's `LiveSocketTimers`, so one `advance` moves a client and the fake together.
`clockFromTimers` is for a client that takes its timers from the runtime (the typed client's
time-out, the heartbeat client): the test passes the functions its runner fakes.

### 3.7 The verdict, and the wait points

```ts
fake.violations: readonly FakeTransportError[];   // every error the client under test could swallow
fake.assertNoViolations(): void;                  // throws the first one
fake.assertDone(): void;                          // and no one-shot answer is left unused
fake.arrived(count = 1): Promise<void>;           // at least `count` requests arrived and each got its answer or is parked
fake.idle(): Promise<void>;                       // every request in flight got its answer or is parked
fake.reset(): void;                               // answers, connect scripts, violations and the log
```

### 3.8 The opt-in for code that cannot inject

```ts
installFakeTransport(fake, target = globalThis): () => void   // sets fetch and WebSocket; returns the restore function
```

### 3.9 Usage: a web test (Vitest)

```ts
import { afterEach, expect, it } from 'vitest';
import { createCoreClient } from '@dems/shared/client';
import { createFakeTransport, refusal, type FakeTransport } from '@dems/shared/live/testing';

let fake: FakeTransport;
afterEach(() => fake.assertNoViolations());          // what the client swallowed still fails the test

it('a refused export shows the denied toast', async () => {
  fake = createFakeTransport();
  fake.scriptSignedInStart(state);                   // state: the 28 replicated slices, built by the test
  fake.answerOnce('exportEvidence', refusal(403, 'NOT_PERMITTED', 'Your role does not allow this action.'));
  const client = createCoreClient({ baseUrl: '', credentials: 'browser-cookie', fetch: fake.fetch });
  // createLiveSim({ client, socketFactory: fake.socketFactory, ... }) and the render go here (W44, the page row)
  const result = await client.call('exportEvidence', { params: { id: 'EV-20260930-0004' }, body: { reason: 'Prosecutor review' } });
  expect(result).toMatchObject({ ok: false, status: 403 });
  expect(fake.log.operationIds()).toEqual(['exportEvidence']);
  expect(fake.calls[0]?.headers.authorization).toBeUndefined();   // the web client sends no bearer value
});
```

### 3.10 Usage: a mobile test (jest)

```ts
import { afterEach, expect, it, jest } from '@jest/globals';
import { createCoreClient } from '@dems/shared/client';
import { FAKE_CREDENTIALS, clockFromTimers, createFakeTransport } from '@dems/shared/live/testing';

afterEach(() => jest.useRealTimers());

it('a paired device signs in', async () => {
  jest.useFakeTimers();
  const fake = createFakeTransport({
    clock: clockFromTimers({ now: () => Date.now(), setTimeout: (task, ms) => setTimeout(task, ms), clearTimeout: (handle) => clearTimeout(handle) }),
  });
  fake.answerFromExample('signIn', 200, 'pairedDevice');   // an example name of the contract; the first one when left out
  const client = createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: () => FAKE_CREDENTIALS.deviceCredential, fetch: fake.fetch });
  const result = await client.call('signIn', { body: { username: 'andi.pratama', password: 'not-a-real-password' } });
  expect(result.ok).toBe(true);
  expect(fake.calls[0]?.headers.authorization?.startsWith('Bearer dvc_')).toBe(true);
  fake.assertNoViolations();
});
```

`pairedDevice` is the name of the contract's example of a sign-in from a paired device
(`CORE_API_EXAMPLES.signIn.responses[200]`); without a name the first example of the status is taken.
A mobile row needs no configuration change: `apps/mobile/jest.config.js` already has `@dems/.*` on
its transform allowlist (section 5).

Both examples were run as they are written here, as scratch tests under `.cache/w31/`
(`assets/31_doc_examples.log`): the web example under Vitest in a jsdom environment (1 of 1, exit 0),
the mobile example under jest with the mobile configuration (1 of 1, exit 0).

---

## 4. Contract checks: rule, named error, test

Every error extends `FakeTransportError` (`name`, `reason`, `operationId`, `issues`). An issue is
`path: issue code` for a request and a client message (never a value), and `path: finding` of the
contract's own checker for a scripted answer and a scripted server message. Every message is masked.

### 4.1 On the way in: a request (TS-11)

Raised as `FakeTransportRequestError` (`reason`, `operationId`, `method`, `route`, `issues`). The
`fetch` promise rejects with it, and it is recorded. File: `live-testing-fetch.test.ts`.

| Rule | `reason` | Test |
|---|---|---|
| Method and path match one operation | `UNKNOWN_ROUTE`, `METHOD_NOT_ALLOWED` | "no operation has this path", "a value in an unknown path is not echoed", "the path exists with another method", "a method the contract does not have" |
| The URL can be read; no fragment; http or relative | `INVALID_URL` | "a fragment", "a query part that is not valid percent-encoding", "a scheme that is not http is refused; a relative URL is the same-origin form" |
| The body parses with the operation's request schema | `INVALID_BODY` | "a request body that violates the schema of its operation is refused: FakeTransportRequestError with the operation ID and the issue paths"; "the error of a refused request never holds a value of the request" |
| A body only where the operation takes one; required when the operation says so; JSON text; at most 65,536 bytes [SP:API-4] | `UNEXPECTED_BODY`, `MISSING_BODY`, `BODY_NOT_JSON`, `BODY_TOO_LARGE` | The eight rows of "... is refused" |
| The query parses with the operation's query schema; none where the operation states none, none on a POST | `INVALID_QUERY`, `UNEXPECTED_QUERY` | "a query the schema refuses fails with the issue path" (a table with a query schema, since the registry has none yet); "a query on an operation that states none, and a query on a POST" |
| The path parameter fits the operation's pattern | `INVALID_PATH_PARAM` | "a path parameter that does not match the pattern of its operation is refused, without the value" |
| No credential in a URL [CS:CL-6a]; [SP:SR-15] | `CREDENTIAL_IN_URL` | "a credential in the URL (...) is refused and never echoed" (4 rows), "a user part in the URL" |
| `Authorization` is `Bearer` plus a session token or a device credential; no biometric token; no cookie beside it [SP:ID-12, §5.6] | `INVALID_CREDENTIAL_FORM` | "credential form: ..." (4 rows), "a cookie header beside a bearer value", "the typed client with a credential provider that returns no token form" |
| Header values are text; a body travels as `application/json` | `INVALID_HEADERS` | "a body without content-type: application/json", "a header value that is not text" |
| A valid request has a scripted answer | `FakeTransportUnscriptedError`, `NO_ANSWER_SCRIPTED` | "a valid request with no scripted answer fails with FakeTransportUnscriptedError" |

### 4.2 On the way out: a scripted answer (TS-12, AC-C-17)

Raised as `FakeTransportResponseError` (`reason`, `operationId`, `status`, `stage`, `issues`).
**When it is checked is said by `stage` and by the message:**

| How the answer was scripted | Checked | `stage` | Surfaces as |
|---|---|---|---|
| A static answer: `answer`, `answerOnce`, `answerFromExample`, `fail`, `scriptSignedInStart` | When it is scripted | `scripting` | Thrown by the scripting call, in the test body |
| A held answer | When `release` is called | `scripting` | Thrown by `release` |
| What a responder function returns (also `answerAllFromExamples`, `scriptCommand`) | When the request is answered | `answering` | The `fetch` promise rejects with it, and it is recorded |

The verdict on status and body is the contract's own `validateCoreApiResponse` when the table is the
registry (TS-12); a table passed in is checked by the same rules against its own schemas.

| Rule | `reason` | Test |
|---|---|---|
| The body parses with the schema of its status | `INVALID_BODY` | "a scripted response that violates the schema of its status fails at scripting time: FakeTransportResponseError" (AC-C-17); rows "no body where the status has a schema", "an error status whose body is no envelope", "a pipeline status with a code that is not its own", "a body that is not a JSON value" |
| The status is one the operation names, or a pipeline answer of the envelope | `UNDOCUMENTED_STATUS` | Rows "a status the operation does not name", "a routing answer for a matched operation", "a number that is no HTTP status" |
| No body on a 204 | `UNEXPECTED_BODY` | Rows "a body on a 204", "a null body on a 204" |
| JSON only | `BODY_NOT_JSON` | Row "a body given as raw text" |
| A 429 carries `retry-after` in whole seconds; a 2xx of a POST carries epoch and revision as integers [SP:API-7]; the request ID is there and equals the envelope's | `INVALID_HEADERS` | Six rows from "a 429 without retry-after" to "a request ID that differs from the one of the envelope" |
| The operation exists | `UNKNOWN_OPERATION` | "an answer for an operation ID the registry does not hold is refused at scripting time" |
| A responder returns a reply | `NOT_A_REPLY` | "a responder that returns no reply, or throws, fails the request" |
| At answer time | any of the above, `stage: 'answering'` | "what a responder function returns is checked at answer time: rejected, recorded, and the log says so" |
| A held answer | any of the above | "a held answer is checked when it is released, in the test body" |
| **A deliberate violation is let through** (`violatesContract: true`) | none | "a deliberate violation (...) is delivered as scripted, and the real client reports CONTRACT_VIOLATION" (5 rows); "a deliberate violation may leave out a header the contract requires" |
| The fake agrees with the contract's checker over the whole registry | | "agrees with the contract checker on every example, and on a body that is not the schema of its status" |

### 4.3 The socket (TS-12; [SP:§9])

File: `live-testing-socket.test.ts`.

| Rule | Error and `reason` | Test |
|---|---|---|
| The upgrade: socket scheme, the contract's path, no query, no credential in the URL or a subprotocol [SP:SR-38], the bearer form, text headers | `FakeSocketUpgradeError`: `INVALID_URL`, `UNKNOWN_ROUTE`, `UNEXPECTED_QUERY`, `CREDENTIAL_IN_URL`, `INVALID_CREDENTIAL_FORM`, `INVALID_HEADERS`. Thrown by the constructor and recorded | "... is refused: FakeSocketUpgradeError, thrown and recorded, and no value is echoed" (13 rows); "an upgrade the contract forbids ...; the real client swallows it, the fake recorded it" |
| A server message parses with `WsServerMessageSchema` | `FakeSocketMessageError`, `direction: 'server'`, `INVALID_MESSAGE`. Thrown by the scripting call | "to a signed-in operator, ... is refused" (rows 1 to 3); "the issues of a refused server message name the members" |
| `hello` comes first, and once | `HELLO_FIRST`, `HELLO_TWICE` | "hello comes first ..."; row "a second hello" |
| A message goes only to a principal that may receive it [SP:SR-40] | `NOT_FOR_PRINCIPAL` | "... is something the Core server never sends (SR-40): refused" (5 rows) |
| A message goes only on a topic `hello` gave | `TOPIC_NOT_GIVEN` | Row "a topic hello did not give (admin)" |
| Nothing is sent on a socket that is not open | `NOT_OPEN` | "nothing can be sent on a socket that is not open" |
| The server closes with a code the contract lists | `UNDOCUMENTED_CLOSE_CODE` | "the server closes with every code the contract lists; any other code is refused unless it is the test" |
| A deliberate violation is let through | none | "a deliberate violation is delivered and the real client drops it" |
| A client message is text, JSON, at most 65,536 bytes, parses with `WsClientMessageSchema` | `FakeSocketMessageError`, `direction: 'client'`: `NOT_TEXT`, `NOT_JSON`, `TOO_LARGE`, `INVALID_MESSAGE`. Thrown by `send` and recorded | "... is refused: FakeSocketMessageError, thrown by send and recorded" (6 rows); "the issues of a refused client message are paths with issue codes, never a value" |
| Only an OPERATOR sends | `NOT_FOR_PRINCIPAL` | "a ANONYMOUS / DEVICE connection may send nothing" |
| The client sends only on an open socket, and closes with 1000 or 3000 to 4999 | `NOT_OPEN`, `INVALID_CLOSE_CODE` | "sending while the socket connects is refused ..."; "a close code a socket does not accept from its client is refused" |

### 4.4 Other rules of the row

| Rule | Test (file) |
|---|---|
| The call log holds method, path, operation ID, headers and body; per socket the URL, the upgrade headers and every message | "per request: ...", "per socket: ..." (`live-testing-log`) |
| Credentials are kept as given and masked in every text | "AC-C-04 on the log ...", "toString: ...", "the console form and the JSON form ...", "one entry and its header record print masked too ...", `maskHeaderValue` (11 rows) (`live-testing-log`) |
| Time is the injected clock; no real timer | "a delay is kept on the fake clock", "a clock on the runner timers" (`fetch`); "a heartbeat series on the clock", "the manual clock" (3 tests) (`socket`); the static test below |
| No global is touched by default; the opt-in installs and restores | 5 tests (`live-testing-install`) |
| The whole registry, answered from its examples | "every operation is called through the real client once per status it names", "every operation takes the pipeline answers of the envelope" (`fetch`) |
| AC-C-02; no Node built-in, no runner API, nothing outside `api`, and the two clients as types only; no timer, no real time, no connection, no storage | 10 tests "static scan of src/live/testing" (`live-testing-platform-neutral`) |
| TS-15: no production file imports the fake | 7 tests (`live-testing-platform-neutral`): the shared package, and the `src` folders of the four apps |

---

## 5. The two runners: what is proven, and what is not

### 5.1 Vitest

The six `live-testing-*` files are part of `npm run test -w @dems/shared` (environment `node`):
209 of 209. The five behaviour files also pass in a jsdom environment, the environment of the web
tests (`assets/31_vitest_jsdom.log`):

```
$ npx vitest run --root packages/shared test/live-testing-fetch test/live-testing-socket test/live-testing-log test/live-testing-install test/live-testing-live-socket --environment jsdom --maxWorkers=2
 Test Files  5 passed (5)
      Tests  189 passed (189)
exit=0
```

The sixth file is a file-system scan and is not meant for jsdom (its `import.meta.url` is not a file
URL there).

### 5.2 jest, with the mobile configuration

No file was added under `apps/mobile`. A scratch test, `.cache/w31/jest/live-testing-jest-proof.test.ts`
(git-ignored; copy: `assets/31_jest_proof.test.ts.txt`), imports `@dems/shared/live/testing`,
`@dems/shared/client`, `@dems/shared/realtime` and `@dems/shared/api` by their package names and runs
six tests. It was run twice (`assets/31_jest_proof.log`; here the runner's check marks are written
`[pass]`, and the timing of each test and the blank lines are left out):

```
## 2026-10-04 10:29:27 WIB from the workspace root, with the mobile jest config
$ npx jest --config apps/mobile/jest.config.js --roots "$PWD/.cache/w31/jest" --maxWorkers=2
PASS .cache/w31/jest/live-testing-jest-proof.test.ts
  @dems/shared/live/testing under the mobile jest transform
    [pass] loads through the export subpath, with its whole surface
    [pass] the real typed client on the fake fetch: every registry operation, answered from the contract examples
    [pass] the named errors keep their class and their name under the class transform
    [pass] the real heartbeat client on the fake socket, under the jest fake timers
    [pass] a held answer and the manual clock, with no runner timer
    [pass] the opt-in install replaces the global fetch and socket constructor and puts them back
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
exit=0

## 10:29:29 WIB through the mobile workspace's own test script (jest starts in apps/mobile)
$ npm run test -w @dems/mobile -- --roots "$PWD/.cache/w31/jest" --maxWorkers=2
> jest --roots /Users/gsp-budi/Documents/DEMS/.cache/w31/jest --maxWorkers=2
PASS ../../.cache/w31/jest/live-testing-jest-proof.test.ts
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
exit=0
```

`--roots` replaces the configuration's default root (`apps/mobile`) for that run, so only the scratch
file was collected; the preset, the transform, the transform allowlist, the module mapper and
`jest.setup.ts` are those of `apps/mobile/jest.config.js`. jest 29.7.0, jest-expo 57.0.5, Node 26.8.2.

| Proven | Evidence |
|---|---|
| The subpath `@dems/shared/live/testing` resolves and the nine files pass the mobile transform (the class transform included: `instanceof` and `name` of the errors hold) | Tests 1 and 3 |
| The real typed client works on the fake `fetch` for every registry operation and status | Test 2 |
| The real heartbeat client works on the fake socket under `jest.useFakeTimers()`, with `clockFromTimers` | Test 4 |
| What the fake delivers on a promise job (an answer, the close event after a client close) is not held back by the jest fake timers | Tests 2 and 4; and `assets/31_jest_microtask.log`: under `jest.useFakeTimers()` a promise job runs, a `queueMicrotask` callback waits until the fake timers are advanced |
| The opt-in install works in the jest environment | Test 6 |
| The same transform is used from both working directories | Neither `apps/mobile` nor the workspace root has a Babel configuration file, so the preset takes its default in both |

| Not proven | Why |
|---|---|
| A test file that lives under `apps/mobile/src` | Not this row's path. It differs from the scratch file only in its location: module resolution walks up to the same root `node_modules`, and the same transform applies |
| A whole mobile screen rendered on the fake | That needs the Live source (W44) and the mobile providers (W51, W56); the fake's part of it is the two transports proven here |
| A device or an emulator | The fake is a test double; it is not part of any bundle (TS-15) |
| The web test configuration itself (`apps/core-web/vite.config.ts`, its set-up file) | The jsdom run above uses the shared package's Vitest configuration with the environment switched. A web row imports the module as any other shared subpath |

**What a mobile row must do to use the fake:** import it in a test file or in a harness under a
`testing/` folder. Nothing else.

---

## 6. Verification (command output)

All commands were run from `/Users/gsp-budi/Documents/DEMS` (P10). The lines
`ERROR: failed to copy trust settings of system certificate` that the sandbox prints are filtered out.

### 6.1 Baseline, before the first edit (`assets/31_baseline_shared_test.log`, `31_baseline_shared_static.log`)

```
Sun Oct  4 09:50:37 WIB 2026   $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  47 passed (47)
      Tests  1012 passed (1012)
exit=0
$ npm run typecheck -w @dems/shared    typecheck exit=0
$ npm run lint -w @dems/shared         lint exit=0
```

### 6.2 Final gate (`assets/31_gate_final.log`)

```
## 2026-10-04 10:31:11 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  55 passed (55)
      Tests  1351 passed (1351)
exit=0
## 10:31:17 WIB $ npm run typecheck -w @dems/shared      exit=0
## 10:31:23 WIB $ npm run lint -w @dems/shared           exit=0
## 10:31:23 WIB $ npm run typecheck -w @dems/core-web    exit=0
## 10:31:34 WIB $ npm run typecheck -w @dems/mobile      exit=0

## confirmation after the documents were written
## 2026-10-04 10:37:09 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  55 passed (55)
      Tests  1351 passed (1351)
exit=0
## 10:37:16 WIB $ npm run typecheck -w @dems/shared      exit=0
## 10:37:28 WIB $ npm run lint -w @dems/shared           exit=0
## 10:37:29 WIB $ npm run typecheck -w @dems/core-web    exit=0
## 10:37:46 WIB $ npm run typecheck -w @dems/mobile      exit=0
```

No run of the gate failed. Before the gate, two typecheck runs of `@dems/shared` were red (P11):
- the first one after the source files were written (about 10:12 WIB, not kept as a file) failed in
  a file of row W30 only, which was being written at that moment:
  `test/realtime-live-socket.test.ts(1432,58): error TS2532: Object is possibly 'undefined'`. The
  next run no longer showed it;
- the run of about 10:21 failed in this row's own test,
  `test/live-testing-socket.test.ts(406,55): error TS2345`, which was corrected; the run of 10:22 and
  every later one exit 0.

### 6.3 Test ledger (P24)

| Workspace | Before (09:50) | After (10:31) | Added by this row | Added by others in the same time |
|---|---|---|---|---|
| `@dems/shared` | 1,012 in 47 files | 1,351 in 55 files | **209 in 6 files** | 130 in 2 files of W30 (`realtime-live-socket.test.ts` 117, `realtime-live-platform-neutral.test.ts` 13) |
| `@dems/core-web`, `@dems/mobile`, `@dems/core-server` | not run | not run | 0 (no file written there) | |

| New test file | Tests |
|---|--:|
| `live-testing-fetch.test.ts` | 89 |
| `live-testing-socket.test.ts` | 63 |
| `live-testing-log.test.ts` | 28 |
| `live-testing-platform-neutral.test.ts` | 20 |
| `live-testing-install.test.ts` | 5 |
| `live-testing-live-socket.test.ts` | 4 |
| Total | 209 |

No existing test file was changed. The names of the 209 tests: `assets/31_live_testing_tests_verbose.log`.

### 6.4 The module under each client's compiler options (`assets/31_client_probe.log`)

The client typechecks above do not reach the folder, because no client file imports it yet. A probe
under `.cache/w31/` (copy: `assets/31_client_probe.ts.txt`) imports the module by its package name;
its `tsconfig.json` extends the client's own and lists only the probe.

```
## web (tsconfig extends apps/core-web/tsconfig.app.json; include: the probe only)
$ npx tsc -p .cache/w31/probe-web/tsconfig.json --noEmit --listFiles | grep -E 'error TS|packages/shared/src/live/testing|probe.ts'
packages/shared/src/live/testing/errors.ts ... index.ts   (the nine files)
.cache/w31/probe-web/probe.ts
exit=0
## web: negative control (two wrong lines appended to the probe)
probe.ts(58,32): error TS2345: Argument of type '{ body: {}; }' is not assignable to parameter of type 'FakeReply | FakeResponder'.
probe.ts(59,14): error TS2322: Type 'string' is not assignable to type 'number'.
exit=2
## mobile (tsconfig extends apps/mobile/tsconfig.json; include: the probe only)
(the same nine files and the probe)      exit=0
## mobile: negative control              (the same two errors)  exit=2
```

So the nine files compile under the web's stricter options (`noUnusedLocals`, `noUnusedParameters`,
the DOM library) and under the mobile base configuration, and `fake.fetch`, `fake.socketFactory` and
`fake.clock.timers` are assignable to `CoreFetch`, `SocketFactory`, `LiveSocketFactory` and
`LiveSocketTimers`.

### 6.5 The tests can fail (`assets/31_mutations.log`, `31_mutate.py.txt`)

26 single changes of the source, one at a time, each followed by the six test files and then
restored from a copy (`diff -rq` at the end: identical). Run at 10:29 to 10:30 on the final source;
one test was reworded afterwards (the delay test waits for the answer instead of polling).

```
BASE   exit=0  209 passed (209)
CAUGHT M01 the request body is not parsed with its schema [contract.ts]  exit=1  3 failed | 206 passed (209)  fetch
CAUGHT M02 the verdict on a scripted answer is ignored [contract.ts]  exit=1  11 failed | 198 passed (209)  fetch, log
CAUGHT M04 a static answer is not checked when it is scripted [http.ts]  exit=1  22 failed | 187 passed (209)  fetch, log
CAUGHT M05 maskCredentials returns its input [errors.ts]  exit=1  6 failed | 203 passed (209)  fetch, log, socket
CAUGHT M07 server messages are not checked [socket.ts]  exit=1  15 failed | 194 passed (209)  socket
CAUGHT M08 client messages are not parsed with the client union [socket.ts]  exit=1  4 failed | 205 passed (209)  socket
CAUGHT M12 restore puts nothing back [install.ts]  exit=1  4 failed | 205 passed (209)  install
CAUGHT M16 assertNoViolations never throws [fake-transport.ts]  exit=1  10 failed | 199 passed (209)  fetch, socket
... (26 lines in the log)
AFTER  exit=0  209 passed (209)
26 of 26 mutations caught
source restored: identical to the pre-mutation copy
```

### 6.6 The row's verification items

| Item of the row | Result | Where |
|---|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2` exits 0 | Pass: 1,351 of 1,351 in 55 files | 6.2 |
| A scripted response that violates its schema fails with a named error | Pass: `FakeTransportResponseError`, `INVALID_BODY`, `stage: 'scripting'` | 4.2 row 1 |
| A request body that violates the operation's schema fails | Pass: `FakeTransportRequestError`, `INVALID_BODY`, `issues: ['reason: too_small']`, through the real client | 4.1 row 3 |
| The call log holds method, path, headers and body | Pass: a whole entry is compared member by member | 4.4 row 1 |
| `npm run typecheck -w @dems/shared`, `npm run lint -w @dems/shared` exit 0 | Pass | 6.2 |
| `npm run typecheck -w @dems/core-web` and `-w @dems/mobile` exit 0 | Pass; and the folder itself under both option sets | 6.2, 6.4 |
| The jest loadability evidence of rule 4 | Pass: 6 of 6, two invocations | 5.2 |
| AC-C-02 | Pass: static test, comments included | 4.4 |
| AC-C-17 | Pass | 4.2 |

---

## 7. What the specification left open, and the choice made

| # | Open point | Choice | Why |
|---|---|---|---|
| 1 | How a violation fails a test when the consumer swallows a transport rejection (the typed client reports it as `NETWORK`, CL-1; the heartbeat client catches a factory that throws) | Every such error is rejected or thrown **and recorded**. `assertNoViolations()` throws the first; `withFakeTransport` calls it for the test | A thrown error alone would turn a contract violation into a green test with a `NETWORK` result |
| 2 | Scripting time or answer time | A static answer and a held answer are checked when they are scripted or released (the error is thrown into the test body). Only what a responder function returns is checked at answer time. `stage` says which | The earliest point is the clearest failure |
| 3 | Which headers "the contract states" | Request: `content-type: application/json` with a body; the bearer form; one credential per request. Answer: `retry-after` on a 429, epoch and revision on a 2xx of a POST, a request ID equal to the envelope's. The fake fills the answer headers by default, so a test only sees this check when it removes or malforms one | [SP:API-4, API-7, ID-12, §7.2] |
| 4 | The bearer value | It must match the contract's own patterns (`SESSION_TOKEN_PATTERN`, `DEVICE_CREDENTIAL_PATTERN`: prefix plus 43 characters). `FAKE_CREDENTIALS` gives three values of that form that open nothing | The contract's example placeholders live in a module `src/api` does not export |
| 5 | A query on the wire | Members travel as text. A member the query schema refuses as text is tried once more as the number or the boolean it spells. A query on an operation without a query schema, or on a POST, is refused | A query the server ignores is a client defect; the typed client sends the schema's output as text (W12, F34-11) |
| 6 | The path parameter | Checked against the operation's `pathParam.pattern` | An ID that cannot exist is a client defect, and the server would answer 422 |
| 7 | What the fake does not simulate | Access rules, permissions, the denial budget, a cookie jar, the Origin guard. A test scripts the 401, 403 and 429 it wants | They are server behaviour; the acceptance rows test them against the real server (T3) |
| 8 | Socket rules beyond the schema | `hello` first and once; principal and topic of each server message, from the contract's catalogue; the contract's close codes. Not checked: that revisions are gap-free (a test of the resync path needs a gap), the resync and message rates | "A test cannot script what the server may not send" (TS-12), without blocking the tests of AC-C-15 |
| 9 | The client's end of a socket | A client close code must be 1000 or 3000 to 4999 (a browser throws otherwise); after a client close the event arrives on a promise job; `send` while connecting is refused, after a close it is discarded | As a platform socket behaves; a shared client must run in a browser and on React Native |
| 10 | Bodies in the log's text | Size and member names only, never a value | A body can hold a password, a pairing code or a token |
| 11 | The fake Core server's position | One epoch and one revision per fake. A 2xx of a POST carries them by default ("the current revision when nothing replicated changed", API-7); `connection.delta` moves the revision on; `scriptCommand` ties an answer to its delta | TS-13 |
| 12 | Waiting without timers | `arrived(count)` and `idle()`: a client reaches its transport a few promise jobs after it was called, so a test waits for the request, not for a time | No real timer in the fake or in its tests |
| 13 | The clock | A manual clock by default, with `timers` of the shape W30's client injects; `clockFromTimers` for a client that takes its timers from the runtime | Rule 2 of the row |
| 14 | Tables other than the registry | `operations`, `schemas`, `examples` options, as the typed client has | The query check can be tested today; a client test with its own table can use the fake |
| 15 | Promise jobs, not `queueMicrotask` | The fake delivers asynchronously through promise jobs only | Measured: the jest fake timers hold `queueMicrotask` back (`assets/31_jest_microtask.log`) |
| 16 | mock-core's stream (heartbeat only, no `hello`) | Not modelled: the fake is the Core server of Live mode | The Simulated-mode tests keep their own socket doubles (TS-1 to TS-9) |
| 17 | The response body | Read once, as with a fetch response; no stream member | [CS:CL-3] |

---

## 8. For the controller

### 8.1 Findings

| ID | Finding | Consequence |
|---|---|---|
| F53-1 | The typed client reports any transport rejection as its `NETWORK` failure (CL-1). A request the fake refuses therefore looks like an outage to the code under test | A Live test on the fake must end with `fake.assertNoViolations()` (or run inside `withFakeTransport`). This belongs in the instructions of W44 and of every client row (CLG item b) |
| F53-2 | Vitest and jest print a failed comparison through `toJSON()`. A log entry therefore prints masked in a failure diff, with the entry's own member names, while the comparison used the real values | A diff on a log entry shows `Bearer dvc_***` and the body's shape on the received side. Compare single members (`call.headers.authorization`) when the value matters |
| F53-3 | Under the jest fake timers of the mobile configuration a `queueMicrotask` callback does not run until the fake timers are advanced; a promise job runs (measured) | The fake uses promise jobs only. No file under `packages/shared/src` uses `queueMicrotask` today; W44 should keep it that way for anything a jest test must see |
| F53-4 | W30's live socket client ran on the fake without a change on either side: `fake.socketFactory` fits `LiveSocketFactory`, `fake.clock.timers` fits `LiveSocketTimers`, and every message that client sent passed the client union | W44 can build `createLiveSim` on `fake.fetch`, `fake.socketFactory` and `fake.clock` as they are |
| F53-5 | `OperationExamples` has no member for a query example. The registry had no query schema at 10:31. If contract C adds a query schema with a required member, the registry loops (this row's and W12's) fail and name the operation, because the typed client refuses the empty query before any request | For W27: give list queries defaults (as API-9 does), or add a query example to the examples |
| F53-6 | `EXAMPLE_PLACEHOLDERS` (`src/api/example-parts.ts`) is not exported by `@dems/shared/api` | Not a gap: the fake has `FAKE_CREDENTIALS`. W83 may export the placeholders if a client test wants the example's own values |
| F53-7 | The registry held 37 operations for the whole run | The loop tests were proven for 37; they hold no count above "at least 37" and read the table at run time |
| F53-8 | `.gitignore:48` (`*.log`) ignores the evidence logs under `implementation/assets/` | They stay on disk and are not part of a commit staged by path unless forced. This holds for the logs of earlier rows too |

### 8.2 Deviations from the plan

| # | Deviation | Reason |
|---|---|---|
| 1 | A sixth test file, `live-testing-live-socket.test.ts`, imports row W30's `src/realtime/live-socket-client.ts`. The row's dependencies are W22 and W12 | The live socket client is the socket consumer of the Live source; proving the fake against it now saves W44 a discovery. **If W30 is rolled back, this one file must be removed with it**; the other five do not depend on W30 |
| 2 | The static test for TS-15 also reads the `src` folders of the four apps (read only) | [PL:§12] lists W31 for "no production import of the fake transport". It tells a test file by its place (`test/`, `tests/`, `__tests__/`, `__mocks__/`, `testing/`, `e2e/`) or its name (`*.test.*`, `*.spec.*`, `jest.setup.*`). A harness that imports the fake must sit in one of those. W87 still owns the app-side static tests |
| 3 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run (P8; CLAUDE.md §3.4). This document and the progress file stand in |
| 4 | Evidence beyond the row: the jsdom run, the compile probe, the mutation run, the microtask measurement | They close what the row's commands do not reach (no client imports the folder yet) |

### 8.3 Decisions to record

| ID | Decision asked | Proposal |
|---|---|---|
| DN53-1 | Accept the strictness of section 7 rows 4, 5, 6 and 8 (the exact bearer form, a refused undocumented query, the path parameter pattern, `hello` first) | Accept. Each can be relaxed in one place of `contract.ts` or `socket.ts` if a client row shows a legitimate need |
| DN53-2 | The rule of F53-1 as part of the client gate | Add "the test ends with `assertNoViolations()`" to CLG item (b) |
| DN53-3 | Keep or drop the app-side part of the TS-15 scan in the shared test (deviation 2) | Keep until W87 lands its own; then W87 decides |
| DN53-4 | Keep `live-testing-live-socket.test.ts` (deviation 1) | Keep; note its dependency on W30 in the rollback table |

### 8.4 Error handling and logging

The module is a test double. It is loaded by test files only (TS-15), runs inside a test runner and
has no deployed run time, so there is no persistent error log to write to and nothing here writes to
a console. Its own error handling is its purpose: every failed check is a named error that is thrown
into the test body or recorded for `assertNoViolations()`; the four `catch` blocks classify input
(text that is not JSON, percent-encoding that cannot be decoded, a body that is not a JSON value) or
record what a connect script threw on a promise job. No error message holds a value of a request.

---

## 9. Rollback (R-NEW)

```sh
# from /Users/gsp-budi/Documents/DEMS
git clean -fd -- packages/shared/src/live/testing packages/shared/test/live-testing-fetch.test.ts \
  packages/shared/test/live-testing-socket.test.ts packages/shared/test/live-testing-log.test.ts \
  packages/shared/test/live-testing-install.test.ts packages/shared/test/live-testing-platform-neutral.test.ts \
  packages/shared/test/live-testing-live-socket.test.ts
mkdir -p packages/shared/src/live/testing
cp .cache/rollback/W31.live-testing-index.ts.pre packages/shared/src/live/testing/index.ts   # W03's placeholder
```

The export subpath `./live/testing` of `packages/shared/package.json` points at `index.ts`, so the
placeholder must be put back (`git hash-object` of it: `0733335ba79b660ccfb3841f5e52403368d0e6b9`).
`.cache/rollback/W31.pre.patch` is 0 bytes, because the folder is not in `acaff20`. After the
rollback the shared suite is back at its count without the six files. Nothing outside the two write
paths has to be restored. The evidence files `implementation/assets/31_*` and the scratch folder
`.cache/w31/` can stay or go; nothing reads them.

---

## 10. Limits of this evidence

- The registry had 37 operations. The claim "covers 75 when the registry does" rests on the code
  reading the table at run time and on tests that hold no count; it was not run against 75.
- The query check was run against a table written for the test, because no registry operation has a
  query schema yet.
- No web page and no mobile screen was rendered on the fake; the consumers proven are the typed
  client, the heartbeat client and the live socket client.
- jest: section 5.2 lists what was not proven.
- The fake's input is a URL as text (or an object with `href` or `url`) and an `init` object. A
  `Request` object's own method, headers and body are not read.
- A query value's `+` is not read as a space; the typed client encodes a space as `%20`.

## 11. Not done here

- The Live source and its tests on the fake (W44).
- The mobile jest mocks for the secure store and the device module (TS-16; W15, W51).
- The app-side static tests (W87).
- No commit, no install, no port, no process left running.

---
*Generated: 2026-10-04 10:36 WIB*
*Last Updated: 2026-10-04 10:40 WIB*
