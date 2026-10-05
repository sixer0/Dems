---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 45
plan_row: W23
title: Request guards of the Core server (Origin guard HB-6, throttle, denial budget)
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3
status: complete
status_history: needs-review at 09:30 (sections 1 to 15); complete at 09:35 after the follow-up of section 16 (decision D52)
---

# W23: request guards

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed into a subfolder. No port was bound, no server was started, no database was
contacted, no package was installed, no process was left running.

## 1. Result

| Item | Result |
|---|---|
| Status | **needs-review**. The row's code and tests are finished and its own command exits 0. One clause of the verification cannot be met inside the row's write paths: two test files of the scaffold (plan row W08) assert the behaviour of the stubs this row replaces, so the whole `unit` project now has 1 failed and 18 skipped tests (section 9). Two small patches in W08's folders close it; they were proven on copies. They need the controller's decision, because the files are outside this row's paths (P6) and an existing test changes only by a recorded decision (P24) |
| Row command | `npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/origin-guard src/plugins/throttle`: **5 files, 345 tests, exit 0** (six runs: 09:21:22, 09:21:23, 09:21:24, 09:22:38, 09:27:54, 09:28:57) |
| Whole `unit` project | 30 files, 909 tests: 890 passed, **1 failed, 18 skipped**, all 19 in the two W08 files of section 9. Before this row: 24 files, 526 passed |
| Typecheck | This row's files: clean. `npm run typecheck -w @dems/core-server` exits 2 with one error, in `test/db/catalog.db.test.ts` of the migration writer, which was running at the same time (section 8.4) |
| Lint | `npm run lint -w @dems/core-server` exits 0 |
| Mutations | 30 of 30 detected by the row's tests (section 8.5) |
| Written | Only `apps/core-server/src/plugins/origin-guard/**` and `apps/core-server/src/plugins/throttle/**`, this document, the progress file, and the rollback pre-image under `.cache/rollback/` |
| For the controller | 1 blocking decision (section 9), 8 more decisions (section 12), 9 deviations (section 11), 12 findings (section 10) |

## 2. What was done

1. Read the row, the protocol P1 to P25, the scaffold's recipe, the plan row and the
   specification sections named in the brief, the two proofs, contract A and the decisions.
2. Read the sources of `@fastify/rate-limit` 11.2.0 and `rate-limiter-flexible` 11.2.1 in
   `node_modules` for the facts the design depends on (findings F-1, F-2).
3. Took the baseline (09:00): `unit` 526 passed in 24 files. Saved the rollback pre-image of the
   two stubs (P23).
4. Replaced the two stubs: 6 production files (771 lines), 5 test files and 1 test-support file
   (2,241 lines).
5. Verified: the row's command, the whole `unit` project, typecheck, lint, three repeat runs,
   30 mutations, and the two proposed scaffold-test patches on temporary copies.

## 3. Files

```
apps/core-server/src/plugins/
  origin-guard/
    index.ts                 the plugin: seam `originDecision`, stage `originGuard`        109
    origin-decision.ts       pure: classify, request kind, the two decision tables         145
    __tests__/
      origin-decision.test.ts   the pure functions; both tables as data                    108 tests
      origin-guard.test.ts      stage 3 in the real app factory                            151 tests
      guard-test-app.ts         test support (not a test): app, principals, assertions
  throttle/
    index.ts                 the plugin: stage `throttle`, seam `denialBudget`             236
    limits.ts                the numbers, the keys, the buckets                              92
    windows.ts               fixed windows by the server clock                               78
    denial-budget.ts         the budget on `rate-limiter-flexible`                          111
    __tests__/
      windows-limits.test.ts    numbers, keys, buckets, windows                              35 tests
      throttle.test.ts          stage 5, the request throttle                                27 tests
      denial-budget.test.ts     the budget and what a caller of the seam sees                24 tests
```

Git-ignored: `.cache/rollback/W23.pre.patch` (section 14).

The exports the scaffold names are kept: `originGuardPlugin`, `OriginDecision`, `OriginFacts`,
`OriginCategory`; `throttlePlugin`, `DenialBudget`. `OriginFacts` has exactly the three members
the scaffold declared, and `DenialBudget` exactly one member with the declared signature, so the
scaffold's recipe and its fake (`{ consume: async () => {} }`) still type-check.

## 4. The Origin guard (stage 3; HB-6)

### 4.1 What it reads

| Fact | Source | Rule |
|---|---|---|
| `category` | The `Origin` header against `app.config.webConsoleOrigins` and `app.config.ownOrigins` | Exact string match (`Array.includes`). No trimming, no case folding, no parsing. Absent header: `ABSENT`. In neither list, the literal `null`, an empty value, a header sent twice: `OTHER` |
| `hasCookie` | `request.cookies[app.config.sessionCookieName]` | Presence of THIS instance's cookie (`dems_session_<port>`). Another instance's cookie is not a credential here |
| `hasBearer` | `request.headers.authorization` | Presence of the header, whatever its scheme or value |
| kind | Method and the `Upgrade` header | `Upgrade` present: `UPGRADE`. Else `GET`: `READ`. Else: `COMMAND` |

Both lists and the cookie name come from the server configuration (`src/config.ts`, frozen):
`http://127.0.0.1` on 5173, 5176, 5177 and 5178; `http://127.0.0.1:4420` and, on a lane, the
lane's port. Nothing in this row names an origin. The guard does not read the `Host` header
(OR-10) and reads no body, query string or path.

### 4.2 The decision table for HTTP requests, as implemented

Each cell is one request through `app.inject` against the real factory. The test is in
`origin-guard.test.ts`, block "stage 3 with stage 4 as the specification defines it > the decision
table for HTTP requests"; its name is the cell: `<row>, <column>, <method> answers <status>`. The
column "any other origin, or `null`" of the specification is two columns here, `other origin`
(`http://evil.example`) and `null`, so the table has 40 requests.

| Credential present | No `Origin` | Own origin (`http://127.0.0.1:4420`) | Web console origin (`http://127.0.0.1:5173`) | Other origin | `null` |
|---|---|---|---|---|---|
| Cookie | GET 200; POST **403** | GET **403**; POST **403** | GET 200; POST 200 | **403**; **403** | **403**; **403** |
| Bearer | 200; 200 | 200; 200 | **403**; **403** | **403**; **403** | **403**; **403** |
| None | 200; 200 | 200; 200 | 200; 200 | **403**; **403** | **403**; **403** |
| Cookie and bearer | GET 401; POST **403** | **403**; **403** | 401; 401 | **403**; **403** | **403**; **403** |

Every 403 is `ORIGIN_NOT_ALLOWED` and comes from stage 3. All 40 cells pass, and each equals the
cell of [SP:§14.2].

Three things about the cells that are not a 403:

- **The 401 cells are stage 4's**, which is plan row W24's and is still a stub. In the block above
  a stand-in at stage 4 does what ID-12 says about the credentials that are present (two
  credentials: 401 `NOT_SIGNED_IN` with `details.reason: CREDENTIAL_CONFLICT`). The stand-in is
  test support (`authenticateBySpecification`), not product code. What this row proves about
  those cells is that stage 3 lets them through: block "stage 3 alone, with the scaffold's stub at
  stage 4" sends the same 40 requests and gets 403 for exactly the 403 cells and 200 for the rest.
- **The row "None"** says more than accepted: `signIn` answers 403 `DEVICE_NOT_PAIRED` unless the
  origin is a web console origin. That answer is the identity module's (W24). This row's part is
  the fact it decides on: an own origin is reported as `OWN`, never as `WEB_CONSOLE` (test "SR-69:
  an own origin is reported as OWN, so it can never satisfy the console rule ID-1 (a)").
- **A GET without an `Origin` and without a credential is accepted** (OP-1, D18): the web login
  page's status read is a same-origin GET, which carries no `Origin` [05_proof_vite_proxy, line 286].

### 4.3 The pure decision function and the upgrade table

`decideOrigin(facts, kind)` in `origin-decision.ts` is the whole table:

```ts
export function decideOrigin(facts: OriginFacts, kind: OriginRequestKind): OriginVerdict {
  const { category, hasCookie, hasBearer } = facts;
  if (category === OriginCategory.OTHER) return OriginVerdict.REFUSE;                 // OR-1
  if (hasCookie) {
    if (category === OriginCategory.WEB_CONSOLE) return OriginVerdict.ALLOW;          // OR-2
    if (category === OriginCategory.OWN) return OriginVerdict.REFUSE;                 // OR-1
    return kind === OriginRequestKind.READ ? OriginVerdict.ALLOW : OriginVerdict.REFUSE; // OR-3, OR-2
  }
  if (hasBearer) return category === OriginCategory.WEB_CONSOLE ? OriginVerdict.REFUSE : OriginVerdict.ALLOW; // OR-4
  return OriginVerdict.ALLOW;
}
```

The decision table for the WebSocket upgrade, as `decideOrigin(facts, 'UPGRADE')` gives it
(`origin-decision.test.ts`, block "the decision table for the WebSocket upgrade", 16 cells, all
pass):

| Credential present | No `Origin` | Own origin | Web console origin | Other, or `null` |
|---|---|---|---|---|
| Cookie | refuse | refuse | allow | refuse |
| Bearer | allow | allow | refuse | refuse |
| None | allow | allow | allow | refuse |
| Cookie and bearer | refuse | refuse | allow (stage 4 then answers 401) | refuse |

It differs from a GET in one place: a cookie without an `Origin`. A test asserts that an upgrade
is decided exactly like a command.

**Who applies it.** `@fastify/websocket` dispatches the upgrade request through the router, so it
passes the scaffold's stage hook like any request (the realtime stub's own contract says so).
Stage 3 therefore holds every request that carries an `Upgrade` header to the upgrade table. The
realtime channel (W42) does not have to decide the Origin again: when its route runs, stage 3 has
passed, and a refusal was the HTTP 403 of the handshake. In unit form this is proven with
`app.inject` and the headers `Connection: Upgrade`, `Upgrade: websocket` (block "a request with an
Upgrade header is held to the upgrade table", 20 cells). **Not proven here**: a real handshake on
a socket. That needs a listener and is W42's test (AC-B-43 upgrade, AC-B-73 socket table, AC-B-74
upgrade).

The seam `app.originDecision(request)` returns the three facts. Stage 3 itself reads them through
the seam, so a replacement in a test is what the stage applies.

### 4.4 AC-B-74 and the other near misses

| `Origin` | POST, each of the four credential rows | GET | GET with `Upgrade` |
|---|---|---|---|
| `http://localhost:5173` | 403 `ORIGIN_NOT_ALLOWED` | 403 | 403 |
| `null` | 403 | 403 | 403 |
| `http://127.0.0.1:5173/` (trailing slash) | 403 | 403 | 403 |
| `HTTP://127.0.0.1:5173` (upper-case scheme) | 403 | 403 | 403 |
| `http://127.0.0.1:5174` | 403 | 403 | 403 |

Also refused, each by a test: `https://127.0.0.1:5173`, a trailing or leading space, no port, a
leading zero in the port, a trailing dot, `http://127.1:5173`, `http://[::1]:5173`, a path, a
query string, `http://127.0.0.1:5173@evil.example`, `http://127.0.0.1:51730`, two listed origins
joined by a comma (how a repeated header arrives), an empty value, a lane's own port on the main
instance, `http://localhost:4420`. The four web console origins are each accepted on a POST with
the cookie.

### 4.5 What a refusal looks like, and what the guard never sends

```
403 {"error":{"code":"ORIGIN_NOT_ALLOWED","message":"This origin may not call the Core server.","requestId":"3bed0b13-…"}}
  content-security-policy: default-src 'none'; frame-ancestors 'none'
  cross-origin-resource-policy: same-origin
  referrer-policy: no-referrer
  x-content-type-options: nosniff
  content-type: application/json; charset=utf-8
  cache-control: no-store
```

(In-process run at 09:23 through `app.inject`, `POST /api/v1/scratch/7?x=1` with
`Origin: http://localhost:5176`. `content-length`, `date` and `connection` are left out here.)

- The text is fixed. A test sends a marker in the `Origin`, the cookie, the bearer value, the
  query string and the body and finds none of them in the answer's headers or body.
- No `Access-Control-Allow-*` header, no `Vary`, on a refusal, on an accepted answer for a listed
  origin, or on a preflight. Every refusal in the row's tests passes `expectRefusal`: the status,
  a body that validates against the shared `ApiErrorSchema`, no stack trace, the five headers of
  OR-9 with their values and no header beyond the scaffold's transport list.
- It is decided before the body is read: a foreign origin with malformed JSON, and with a body
  above the limit, answers 403; the same bodies from an accepted caller answer 400 and 413.

### 4.6 The CORS preflight (D34)

The specification does not name a status. A preflight is an `OPTIONS` request; the API has GET
and POST only (API-2), so it matches no route and is answered by stage 1, which the scaffold
already built: **405 `METHOD_NOT_ALLOWED` with `allow`** for a known path, **404 `NOT_FOUND`** for
an unknown one, with the envelope and without any CORS header. It never reaches stage 3, so the
answer is the same for a listed and for a foreign origin and tells nothing about the lists.

```
405 {"error":{"code":"METHOD_NOT_ALLOWED","message":"OPTIONS is not allowed on this endpoint.","requestId":"b5e46990-…"}}
  allow: POST
  (the five headers of OR-9; no access-control-* header)
```

(The same in-process run; its scratch path had a POST route only, hence `allow: POST`. In the
tests the path has both methods and the header is `GET, POST`.)

Tests: block "a CORS preflight", 7 tests, for the origins `http://127.0.0.1:5173`,
`http://127.0.0.1:4420`, `http://evil.example`, `http://localhost:5176` and `null`.

### 4.7 Log

A refusal writes two lines: the scaffold's request line (route pattern, status, code) and one line
of this row that names the cell.

```
{"level":40,"reqId":"3bed0b13-…","code":"ORIGIN_NOT_ALLOWED","route":"/api/v1/scratch/:id","kind":"COMMAND","category":"OTHER","hasCookie":false,"hasBearer":false,"origin":"http://localhost:5176","msg":"request refused by the Origin guard"}
{"level":30,"reqId":"3bed0b13-…","method":"POST","route":"/api/v1/scratch/:id","status":403,"durationMs":2,"principal":null,"code":"ORIGIN_NOT_ALLOWED","msg":"request completed"}
```

`origin` is the header only when it has exactly the shape scheme, host and port (`originForLog`,
one anchored expression with bounded lengths); the literal `null` is written as it is; anything
else, for example a value with a path, a query, a user part, a space or a line break, is written
as `[not an origin]`. The log-capture test sends markers in the `Origin`'s path and query, the
cookie, the bearer value, the URL's query, a path parameter and the body, at log level `trace`,
and finds none of them.

## 5. The throttle (stage 5, first half; ID-P12)

### 5.1 Keys, buckets, limits

| Key | Who | Counted at 30 per 60 s | Counted at 600 per 60 s |
|---|---|---|---|
| `class:web` | No principal; the Origin category is `WEB_CONSOLE` | Every request and upgrade except health | `getServiceHealth` |
| `class:local` | No principal; every other category. An unknown bearer value, a cookie that does not resolve, a retired device credential | The same | `getServiceHealth` |
| `device:<device ID>` | A DEVICE principal | `signIn`, `getSignInStatus`, `signInWithBiometric`, `reportBiometricFailure` | Every other request and upgrade |
| `operator:<operator ID>` | An OPERATOR principal; all sessions of one operator | (none) | Every request and upgrade |

The key is `principalKeyOf(request.principal)`, else `classKeyOf(app.originDecision(request).category)`
(`limits.ts`). Nothing a caller sends chooses it: a test sends 31 requests with different
`x-forwarded-for`, cookie, bearer and user-agent values and the 31st answers 429.

Stage 4 is a stub today. The throttle is written against the `Principal` type of
`plugins/authenticate` and tested with principals put at stage 4 by `app.stages.replace`, so
nothing here changes when W24 lands.

**Health is not exempt from the throttle.** The specification counts it apart: at 600 per 60 s
for a class, and with everything else for a principal. It is exempt from the 30 of a class and
from the denial budget. A class that used up its 30 still gets health; the 601st health request
of a class in 60 s answers 429.

### 5.2 How the plugin is used

`@fastify/rate-limit` is registered inside the throttle unit with `global: false`, so it adds its
hook to no route. Stage 5 asks it to count through `app.createRateLimit({ max, timeWindow, keyGenerator })`,
one counter set per bucket. That function counts the request in the plugin's store and returns the
outcome (`isExceeded`); the stage then raises the envelope's refusal itself:

```
429 {"error":{"code":"RATE_LIMITED","message":"Too many requests. Try again shortly.","requestId":"c6a1f0a4-…"}}
  retry-after: 60
  (the five headers of OR-9; no x-ratelimit-* header)
```

The scaffold's text names `app.rateLimit()`, the plugin's route handler. `createRateLimit` is the
same plugin and the same store; the difference is that the handler form sets `x-ratelimit-limit`,
`-remaining` and `-reset` on every counted answer and builds its own error, and OR-9 lists the
headers an answer may carry (deviation DV-2).

### 5.3 Windows, and the server clock

Both libraries measure their windows with the system time (`Date.now()` inside their memory
stores) and neither takes a clock (finding F-1). A test that drives the server clock by hand
(ENG-16) could not move them, and ENG-13 says every timer deadline comes from the server clock.

So the libraries count, and `windows.ts` says which window a key is in: a fixed window that opens
at the key's first counted event and ends 60,000 ms later **by `app.clock`**. The window is named
in the key the library counts under, `<key>#<window id>`. A new window is a new counter. With the
production clock (the wall clock) this is the fixed window the libraries would keep by
themselves; both are still configured with the specification's numbers (30 or 600 per 60,000 ms;
20 per 60 s). Decision DN-3.

- The window does not slide: a request late in a window, or a refused request, does not extend it.
- `retry-after` is the whole seconds until the key's window ends, at least 1, which is what the
  shared contract says the header means (`RETRY_AFTER_HEADER_NAME`, `constants.ts:60`).
- The map holds at most one entry per operator, per device and per class, because keys are never
  caller-supplied.

### 5.4 The body limit (AC-B-14, 413)

The limit is the scaffold's (`bodyLimit: 65_536`). Tested here as the row names it: a body above
the limit answers 413 `PAYLOAD_TOO_LARGE` with a valid envelope and the header set; a body of
exactly 65,536 bytes is accepted; a refusal of stage 3 (403) and of stage 5 (429) each wins over
the 413 and over 400 `INVALID_JSON`.

### 5.5 Log

"A throttled request is logged, not audited" (SR-24, GS-07). Each 429 has the scaffold's request
line with the route pattern and `code: RATE_LIMITED`. This row adds one line per key and window,
when the limit is first reached, with what the request line cannot say for a class: the key and
the limiter.

```
{"level":40,"reqId":"c6a1f0a4-…","code":"RATE_LIMITED","route":"/api/v1/scratch/:id","limiter":"throttle","key":"class:local","limit":30,"msg":"rate limit reached"}
{"level":30,"reqId":"c6a1f0a4-…","method":"POST","route":"/api/v1/scratch/:id","status":429,"durationMs":0,"principal":null,"code":"RATE_LIMITED","msg":"request completed"}
```

One line per window, not per request, so a flood does not double the log. A test counts: 7
refusals in two windows give 7 request lines and 2 announcements, and a spy on `auditWriter.append`
is never called.

## 6. The denial budget (stage 5, second half, and the seam `denialBudget`; ID-P13)

### 6.1 What it is

A `RateLimiterMemory` of `rate-limiter-flexible` with `points: 20`, `duration: 60`
(`denial-budget.ts`). Nothing counts by hand. Its key is the throttle key and the key's window
(section 5.3), which opens at the key's first refusal.

It is asked two things:

| Question | By whom | Effect |
|---|---|---|
| `take`: is there a place left? | A row that is about to write a refusal's audit row, through `app.denialBudget.consume(request)` | Takes one of the 20 places, or refuses |
| `check`: has the key used up its budget? | Stage 5, for every REST request except health; not for a request with an `Upgrade` header | Takes nothing. While the key holds 20: 429 before the request reaches the guard, no row |

### 6.2 The seam, for W24, W28, W32 and W41

```ts
export interface DenialBudget {
  consume(request: FastifyRequest): Promise<void>;
}
```

The type is the scaffold's, unchanged. **What it means is this:**

```ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiFailure } from '../../plugins/error-envelope';

/**
 * A refusal that is audited (ACCESS_DENIED, EXPORT_DENIED, AUTH_FAILED, AUTH_LOCKED,
 * PAIRING_FAILED, PAIRING_LOCKED): take a place, write the row, refuse.
 */
export async function refuseAndAudit(app: FastifyInstance, request: FastifyRequest, operatorId: string): Promise<never> {
  // 1. BEFORE the row. Throws 429 RATE_LIMITED when the key already holds 20 refusals in its window.
  await app.denialBudget.consume(request);
  // 2. The row, in its unit of work.
  await app.pipeline.run('rbac.denied', (unit) =>
    app.auditWriter.append(unit, {
      type: 'ACCESS_DENIED',
      actorId: operatorId,
      deviceId: null,
      details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' },
    }),
  );
  // 3. The refusal.
  throw new ApiFailure(403, 'NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.');
}
```

The example was compiled once against the workspace (`tsc --noEmit`, exit 0, from a temporary file
in this row's folder that was removed again); it is not part of the sources. `pipeline` and
`auditWriter` are still W21's stubs, so it was not run.

| The call | What the caller does |
|---|---|
| Resolves (the first 20 refusals of the key within 60 s) | Write the row, then refuse |
| Throws an `ApiFailure` 429 `RATE_LIMITED` with `retry-after` (from the 21st) | Nothing: let it propagate. No row is written; the error envelope answers 429. Inside a unit of work the unit rolls back |
| The budget itself fails (not expected of a memory limiter) | Nothing: the call resolves, the failure is logged and written to the persistent error log, and the refusal is audited without the budget. A refusal is never lost because its counter broke |

Rules for callers:

1. **Call it before the row, once per row.** The place is taken first so that refusals which
   arrive together cannot write more than 20 rows: 100 concurrent denied calls of one operator
   write exactly 20 (test "AC-B-75, all at once"). Called after the row, the 21st of such a burst
   would have written its row already.
2. **Do not catch what it throws.**
3. **Do not call it** for a 401 that writes no row (RB-6), for an allowed call, or for a refusal
   that is logged and not audited (`DEMO_DISABLED`, a 429).
4. The key is read from the request: its principal, else its class. A retired device credential
   is not a principal, so its `ACCESS_DENIED` rows count in `class:local` (RB-6).

This differs from the stub's comment, which said "called after the row is written" and "never
throws" (deviation DV-1; decision DN-2). The brief of this row describes the form above ("audit
this refusal" for the first 20, "answer 429, write no row" from the 21st).

Tests, in `denial-budget.test.ts`, block "what a caller of app.denialBudget.consume(request)
sees": the first 20 calls resolve with nothing; the 21st throws the 429 with `retry-after`; used
the way above, 20 refusals write 20 rows; a call with something that is not a request resolves,
logs one error line and writes one entry to the error log.

### 6.3 For tests: the server clock, `reset`, `inspect` (SA-14)

```ts
import { throttleControl } from '../../plugins/throttle';

app.seams.replace('clock', clock);                 // the manual clock every backend test uses (ENG-16)
clock.advance(60_000);                             // every window that was open is over: throttle and budget

const control = throttleControl(app);
control.reset();                                   // or: forget every open window now
control.reset('operator:OP-0001');                 // or: of one key
await control.inspect('operator:OP-0001');         // { key, limit: 20, used, remaining, exhausted, windowEndsAt }
control.keyOf(request);                            // 'operator:OP-0001' | 'device:DEV-0001' | 'class:web' | 'class:local'
```

`throttleControl(app)` returns what the throttle unit put behind the seam and throws if a test
replaced the seam. The controls are not members of `DenialBudget`, so a fake stays one function.

**SA-14 holds.** The counter is the library's. A test resets it (`reset`) or advances it (the
server clock). GS-20 asked whether the counter follows a test clock: it does, through the window
in the key; the library by itself would not (finding F-1).

### 6.4 What the tests show

| Clause | Test (`denial-budget.test.ts`) | Result |
|---|---|---|
| The 21st refusal of one key answers 429 and writes no row | "the 21st refusal of one key answers 429 and writes no row" | PASS |
| AC-B-75: 100 denied calls of one operator write exactly 20 rows, the other 80 answer 429 | "AC-B-75, one after the other", "AC-B-75, all at once" | PASS (unit form: the rows are counted by a stand-in guard; no audit writer exists yet) |
| After the 60 s window a denied call is audited again | "after the 60 s window a denied call is audited again": 429 at 59,999 ms with `retry-after: 1`, 403 and a 21st row at 60,000 ms | PASS |
| The test can reset the counter | "reset of one key", "reset of everything, as a matrix test does between batches" (31 denied cells, no 429) | PASS |
| AC-B-75: 25 calls with five retired device credentials write at most 20 rows | "25 calls with five different retired device credentials write at most 20 rows: one class bucket" | PASS |
| Every REST request of the key answers 429, health excepted | "while the key holds 20, every REST request of the key answers 429 at stage 5, health excepted" (stage 6 is not reached) | PASS |
| An upgrade is not blocked | "a request with an Upgrade header is not blocked by the budget" | PASS |
| Each key has its own budget | "each key has its own budget" | PASS |
| Logged, not audited | "one announcement per key and window, and a request line per 429" | PASS |

## 7. What the specification left open, and the choice made

| # | Open point | Choice | Why |
|--:|---|---|---|
| 1 | The status of a CORS preflight | 405 with `allow` (404 for an unknown path), from stage 1 | The scaffold's answer for a method that is no route; no new code; the same for every origin |
| 2 | Fixed or sliding window | Fixed, opened by the key's first counted event | What both libraries do; "counted per key over 60 s" |
| 3 | The time base of the windows | The server clock (section 5.3) | ENG-13, ENG-16; GS-20 |
| 4 | Whether health passes the Origin guard | It follows the table like every operation | SR-19 says every request; a same-origin or app call of health carries no `Origin` |
| 5 | What "bearer present" means | Any `Authorization` header, whatever its scheme | The table says "an `Authorization` header is present"; stage 3 looks at presence only |
| 6 | An empty `Origin`, a repeated `Origin` | `OTHER`, refused | Neither is a listed origin; a browser sends neither |
| 7 | Which request is an upgrade | Any request with an `Upgrade` header, whatever the route | It can only make the request's own rule stricter |
| 8 | Methods other than GET | A command | No such route exists (API-2); the stricter rule is the safe default |
| 9 | Whether a refused request is counted by the throttle | A 429 of the throttle is counted (the plugin counts first); a 403 of stage 3 and a 401 of stage 4 are not (they stop before stage 5) | The stage order of [SP:§2.3] |
| 10 | The class of a request whose category is `OTHER` | `class:local` | Unreachable while stage 3 runs; the pre-authentication bucket is the stricter reading |
| 11 | `details` of a 429 | None; the header `retry-after` only | [SP:§7.2] names the header |
| 12 | A failure of the budget itself | The call resolves; logged and persisted | The budget guards the audit trail's volume, not access: the refusal still happens |
| 13 | A place whose audit write then fails | Stays taken | The bound is "at most 20 rows" |
| 14 | Log level of a refusal | `warn` | A refused origin is a forged or misdirected request |

## 8. Verification

### 8.1 The row's command (09:22:38; again at 09:27:54, section 15)

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/origin-guard src/plugins/throttle

> @dems/core-server@0.2.0 test
> vitest run --project unit --maxWorkers=2 src/plugins/origin-guard src/plugins/throttle

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server

 Test Files  5 passed (5)
      Tests  345 passed (345)
   Start at  09:22:38
   Duration  742ms (tests 35%, transform 34%, import 31%, worker 1%)

exit=0
```

Three more runs in a row (09:21:22 to 09:21:24): 345 passed each, exit 0. Tests per file
(`--reporter=json`): `origin-decision.test.ts` 108, `origin-guard.test.ts` 151,
`windows-limits.test.ts` 35, `throttle.test.ts` 27, `denial-budget.test.ts` 24.

### 8.2 The clauses of the row

| Clause | Test | Result |
|---|---|---|
| Every cell of the HTTP decision table gives the stated answer, for the four credential rows, with an injected principal | `origin-guard.test.ts`: 40 cells (section 4.2), and the same 40 with the stub at stage 4; `origin-decision.test.ts`: 32 cells of the pure function | PASS |
| `http://localhost:5173`, `null`, a trailing slash, an upper-case scheme and port 5174 each answer 403 `ORIGIN_NOT_ALLOWED` | `origin-guard.test.ts`, block "AC-B-74": 5 values on a POST for each credential row, and on a GET and an upgrade-marked GET | PASS |
| No answer carries an `access-control-allow-` header, the preflight included | `expectNoCorsHeader` inside `expectRefusal` and `expectResponseHeaders` on every answer the tests check; "carries no CORS header, and neither does an accepted answer"; block "a CORS preflight" | PASS |
| The 31st request of one class in 60 s answers 429 with `retry-after` | `throttle.test.ts`: "the 31st request of class:local in 60 s answers 429 RATE_LIMITED with retry-after" (`retry-after: 50` ten seconds into the window) | PASS |
| With the budget at 20 the 21st refusal of one key answers 429 and writes no row | Section 6.4 | PASS |
| The test can reset or advance the counter (SA-14) | Section 6.4; `throttle.test.ts`, block "the window follows the server clock" | PASS |
| AC-B-14: 429 with `retry-after`, 413, 403 validate against `ApiError`, carry the five headers, no stack trace | `expectRefusal` on every refusal; section 5.4 | PASS |
| AC-B-84, REST: 31 requests with 31 different unknown bearer values share one bucket | `throttle.test.ts`: "AC-B-84: 31 requests with 31 different unknown bearer values share one bucket" (unit form; the integration test is W28's) | PASS |
| A log-capture test for the refusals | Three: `origin-guard.test.ts` "the log of a refusal"; `throttle.test.ts` and `denial-budget.test.ts` "logged, not audited" | PASS |
| The whole `unit` project still passes | Section 8.3 | **NOT MET**: 2 files of W08, section 9 |
| `npm run typecheck -w @dems/core-server` exits 0 | Section 8.4 | Exit 2 in a file of another row in flight; this row's files are clean |
| `npm run lint -w @dems/core-server` exits 0 | Section 8.4 | PASS |

### 8.3 The whole `unit` project (09:23:36)

```
$ npm run test -w @dems/core-server -- --maxWorkers=2

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server
 ❯ |unit| src/plugins/logger/__tests__/log-capture.test.ts (18 tests | 18 skipped) 37ms
 ❯ |unit| src/plugins/readiness/__tests__/readiness.test.ts (30 tests | 1 failed) 72ms
   ❯ the seams (P25) (9)
     × the stubs that are not implemented say which row fills them 3ms
 FAIL  |unit| src/plugins/logger/__tests__/log-capture.test.ts [ src/plugins/logger/__tests__/log-capture.test.ts ]
AssertionError: expected [ 403, 403, 404, 500, 405, 200, …(2) ] to deeply equal [ 200, 400, 404, 500, 405, 200, …(2) ]
 ❯ src/plugins/logger/__tests__/log-capture.test.ts:89:55
 FAIL  |unit| src/plugins/readiness/__tests__/readiness.test.ts > the seams (P25) > the stubs that are not implemented say which row fills them
AssertionError: expected [Function] to throw error including 'plan row W23' but got 'Cannot read properties of undefined (…'
Expected: "plan row W23"
Received: "Cannot read properties of undefined (reading 'origin')"
 ❯ src/plugins/readiness/__tests__/readiness.test.ts:253:86
 Test Files  2 failed | 28 passed (30)
      Tests  1 failed | 890 passed | 18 skipped (909)
   Start at  09:23:36
   Duration  2.21s (tests 42%, import 41%, transform 16%, worker 1%)
npm error code 1
```

Every other file passes, the five static guard files included (`test/static/`: 87 tests):
no CORS plugin, no CORS header, no `localhost` origin in a production source, no console call, no
raw-URL read, the two exports of this row present.

### 8.4 Typecheck and lint (09:22:38)

```
$ npm run typecheck -w @dems/core-server
> tsc --noEmit
test/db/catalog.db.test.ts(198,21): error TS2352: Conversion of type 'readonly ContractTable[]' to type '{ name: string; … }[]' may be a mistake …
exit=2

$ npm run lint -w @dems/core-server
> oxlint
test/db/boot-checks.db.test.ts:327:13: warning eslint(no-unsafe-optional-chaining): Unsafe usage of optional chaining …
test/db/boot-checks.db.test.ts:337:13: warning eslint(no-unsafe-optional-chaining): Unsafe usage of optional chaining …
exit=0
```

`test/db/**` is the migration writer's folder (plan row W17), which was running at the same time
(P11). The typecheck was clean at 09:09, before that file appeared. The same compiler with the
workspace's configuration and `test/db` left out (a configuration file in the session's scratch
folder, nothing in the repository):

```
$ tsc --noEmit -p <the workspace tsconfig, extended, with "exclude": ["…/apps/core-server/test/db"]>
exit=0
```

and the workspace typecheck reports 0 errors outside `test/db/`. The controller should re-run the
workspace typecheck when W17 has returned.

### 8.5 Mutations

Thirty changes to the production files, one at a time; after each, the row's command; the file
restored afterwards. **30 of 30 detected**; the final run with the sources restored: 345 passed.

| # | Mutation | Tests that fail |
|--:|---|--:|
| M01 | The upper-case scheme accepted (`toLowerCase`) | 3 |
| M02 | A trailing slash accepted | 3 |
| M03 | A cookie with an own origin allowed | 19 |
| M04 | A cookie without an `Origin` allowed on a command | 15 |
| M05 | A bearer with a web console origin allowed | 9 |
| M06 | A foreign origin allowed without a credential | 39 |
| M07 | The `Upgrade` header ignored | 5 |
| M08 | Any cookie counts as the session cookie | 3 |
| M09 | The literal `null` treated as no `Origin` | 19 |
| M10 | An own origin classified as a web console | 22 |
| M11 | The raw `Origin` logged | 2 |
| M12 | Strict limit 31 | 20 |
| M13 | Wide limit 601 | 6 |
| M14 | Budget 21 | 19 |
| M15 | Budget 19 | 18 |
| M16 | The class always `class:local` | 4 |
| M17 | Health of a class in the strict bucket | 4 |
| M18 | A device's sign-in entry points in the wide bucket | 6 |
| M19 | The window boundary off by one | 11 |
| M20 | `retry-after` rounded down | 4 |
| M21 | Stage 5 skips the budget check | 3 |
| M22 | `consume` swallows the refusal | 3 |
| M23 | Health blocked by the budget | 1 |
| M24 | An upgrade blocked by the budget | 1 |
| M25 | The throttle keyed by a request header | 22 |
| M26 | The throttle never refuses | 23 |
| M27 | A failure of the budget fails the caller | 1 |
| M28 | The budget counts without the window in its key | 11 |
| M29 | The budget's limit announced on every refusal | 3 |
| M30 | The throttle's limit announced on every refusal | 1 |

### 8.6 Test ledger (P24)

| Workspace, project | Before (09:00:08) | After (09:23:36) | This row |
|---|---|---|---|
| `@dems/core-server`, `unit` | 526 tests in 24 files, all passed | 909 tests in 30 files: 890 passed, 1 failed, 18 skipped | **+345 tests in 5 files**, all passed |
| `@dems/core-server`, `db` | not run | not run | none |
| `@dems/shared`, `@dems/core-web`, `@dems/mobile`, `@dems/mock-core` | not written | not written | none |

526 + 345 = 871. The other 38 tests are `test/db/contract-inventory.test.ts`, a new file of the
migration writer (W17) that appeared while this row ran.

New test files: `src/plugins/origin-guard/__tests__/origin-decision.test.ts` (108),
`src/plugins/origin-guard/__tests__/origin-guard.test.ts` (151),
`src/plugins/throttle/__tests__/windows-limits.test.ts` (35),
`src/plugins/throttle/__tests__/throttle.test.ts` (27),
`src/plugins/throttle/__tests__/denial-budget.test.ts` (24). Test support, not a test file:
`src/plugins/origin-guard/__tests__/guard-test-app.ts`.

**The ledger is short by 19 until the decision of section 9**: 1 failed and 18 skipped are tests
of W08 that existed before.

## 9. The two scaffold tests that this row breaks by design (blocking decision DN-1)

Both files are W08's, in other plugins' folders, which this row may not write (P6; rule 1 of the
brief). They were green only because the two stubs let every request through and answered
nothing.

### BE-GAP-W23-1: `src/plugins/readiness/__tests__/readiness.test.ts:253`

```ts
it('the stubs that are not implemented say which row fills them', async () => {
  …
  expect(() => app.originDecision({} as Parameters<typeof app.originDecision>[0])).toThrow('plan row W23');
```

The line asserts that `originDecision` is not implemented. It is now. The same test holds one
such line for W21 (250 to 252), W24 (254, 255) and W26 (256, 257); each of those rows will meet
the same thing.

**Patch asked for:** delete line 253. Nothing else.

Not done instead: making the real function throw a message that contains "plan row W23" for an
argument without headers. It would pass the line and leave a test that says the seam is a stub.

### BE-GAP-W23-2: `src/plugins/logger/__tests__/log-capture.test.ts:89`

The file's requests carry `Authorization: Bearer …` and this instance's cookie together, with no
`Origin`, on two POSTs. The specification answers that cell with 403 [SP:§14.2, row "cookie and
bearer", column "no Origin", POST], so the two requests now answer 403 instead of 200 and 400,
the `beforeAll` fails, and the file's 18 tests are skipped. The file is about the log, not about
the guards.

**Patch asked for:** in `beforeAll`, after `await app.ready();`, three lines and a comment:

```ts
  // This file is about the log, not about the guards: its requests carry this instance's cookie
  // and a bearer value together, which stages 3 and 4 refuse.
  app.stages.replace('originGuard', () => {});
  app.stages.replace('authenticate', () => {});
  app.stages.replace('throttle', () => {});
```

The second line is for W24: the file's two routed GETs with both credentials would answer 401 as
soon as the real stage 4 lands.

### Evidence that the two patches are enough

Copies of both files with exactly these patches, placed for one run in this row's own folder
(only the import path of the unit under test adjusted) and removed again (09:19:43):

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/throttle/__tests__/zz-tmp-w08

 Test Files  2 passed (2)
      Tests  48 passed (48)
```

18 + 30 = 48. With the two patches the `unit` project would be 909 passed in 30 files.

**A third place that still passes but no longer says what it tests** (no patch needed for green):
`readiness.test.ts:236-245`, "the stubs: … a budget that counts nothing", calls
`app.denialBudget.consume({})` and expects it to resolve. It still does, because the real budget
resolves when it cannot read the key (section 6.2), and this row has its own test of that. The
title is stale.

## 10. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | **SA-14 holds, with one addition.** `rate-limiter-flexible` 11.2.1's memory limiter counts, refuses and can be reset, but it reads `Date.now()` itself and takes no clock; the same is true of the local store of `@fastify/rate-limit` 11.2.0 | `node_modules/rate-limiter-flexible/lib/component/MemoryStorage/MemoryStorage.js` (`incrby`, `set`, `get`); `node_modules/@fastify/rate-limit/store/LocalStore.js` (`incr`, `read`) | The window is named in the counter's key and opened and closed by `app.clock` (`windows.ts`). The library also has `dump()` and `restore()`, which could shift expiry times; not used |
| F-2 | `@fastify/rate-limit` has `createRateLimit(options)`, which counts and returns the outcome without answering; its handler form sets `x-ratelimit-*` headers | `node_modules/@fastify/rate-limit/index.js` (`applyRateLimit`, `rateLimitRequestHandler`) | DV-2 |
| F-3 | Two test files of the scaffold assert stub behaviour and fail when the stubs are filled | Section 9 | DN-1. The same test will stop W21, W24 and W26 |
| F-4 | The upgrade request passes the stage hook, so stage 3 and stage 5 see it | `node_modules/@fastify/websocket/index.js` (`onUpgrade` calls `fastify.routing`); the realtime stub's header | Stage 3 applies the upgrade table; the throttle counts upgrades with no code in W42 |
| F-5 | A request refused at stage 3 or 4 is not counted by the throttle: those stages run first | Tests "line 3 before line 5", "line 4 before line 5" | A flood of requests with a foreign `Origin` is bounded by nothing here and visible only in the log, two lines each. It is the stage order of [SP:§2.3]; for the security review (W45) |
| F-6 | **The 20 rows of AC-B-80 (5 `AUTH_FAILED` and 15 `AUTH_LOCKED`) and of each burst of AC-B-76 use the key's whole budget.** The next REST request of that key answers 429 until the server clock is 60 s past the key's first refusal | ID-P13; section 6 | W24 and W32: advance the manual clock or call `throttleControl(app).reset()` before the next step of such a test |
| F-7 | With the real guards in an app, **the 31st request without a principal in 60 s of the server clock answers 429**, in every test of every row that uses `buildApp` | Section 5.1 | Tests that are not about the throttle: a manual clock, `throttleControl(app).reset()`, or `app.stages.replace('throttle', () => {})`. The matrix test (W47) sends 75 anonymous cells |
| F-8 | If the wall clock is set back while the server runs, the server clock stands still (ENG-14) while the libraries' own expiry goes on, so a counter can end before its window does, by at most the size of the step | Reasoning from F-1; not run | More permissive for that long, after a clock step only. Not handled |
| F-9 | The static readings of the mobile client fit the table: the socket module adds `origin: http://127.0.0.1:4420` (an own origin, accepted with a bearer); `fetch` adds none. A reading would matter in two cases: a value such as `http://localhost:4420` or `null` would be refused, and a `Cookie` header on the upgrade matters only if it holds a cookie named `dems_session_<port>`, which the server never sets for a device | `implementation/12_typed_client_emulator_proof.md:493-496` (not measured on a device) | W30 and W59 record what is sent |
| F-10 | The measured browser facts fit the table: a same-origin GET carries the cookie and no `Origin` (accepted, OR-3); a page opened at `http://localhost:5176` sends that origin (refused) | `implementation/05_proof_vite_proxy.md:286, 316` | None |
| F-11 | The typecheck of the workspace was red in a file of W17 while this row finished | Section 8.4 | Re-run after W17 |
| F-12 | `light-my-request` passes `Connection` and `Upgrade` headers to the app unchanged, so the stage's decision for an upgrade can be tested without a listener | The upgrade tests | The handshake itself stays W42's to test |

## 11. Deviations from the row text and from the scaffold

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | `consume` is called **before** the row and **throws** the 429. The stub's comment said after the row and "never throws" | The brief of this row describes it; taking the place first is what keeps concurrent refusals at 20 rows. The type is unchanged, so the scaffold's fake still compiles |
| DV-2 | `app.createRateLimit()` instead of `app.rateLimit()` | F-2; OR-9 |
| DV-3 | A file of this row, `windows.ts`, decides which window a key is in (about 30 lines of logic) | F-1; ENG-13, ENG-16. It is not a counter: both counters are the libraries' |
| DV-4 | The throttle's constants are in `plugins/throttle/limits.ts`, not in `src/config.ts` | The plan (§3.4) left their names to W08 and W23 and placed them in the configuration module; that file is frozen and holds none of them. They are not configuration: no environment value reaches them |
| DV-5 | Stage 3 applies the upgrade table to a request with an `Upgrade` header | F-4. Without it a cookie without an `Origin` would pass stage 3 on the upgrade's GET |
| DV-6 | `ThrottleControl` and `throttleControl(app)` are exported from `plugins/throttle` for tests | The brief asks for reset and inspect; as members of `DenialBudget` they would break the scaffold's fake |
| DV-7 | Two log lines of this row besides the request line: one per Origin refusal, one per key and window when a limit is reached | The request line cannot name the cell or a class key |
| DV-8 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (CLAUDE.md §3.4, P8) |
| DV-9 | The clause "the whole `unit` project still passes" is not met | Section 9 |

## 12. Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| **DN-1** (blocking) | The two patches of section 9, in W08's test files | Accept both as recorded by-design test changes and have them applied (by this agent, resumed, or by any coder slot: four changed lines in all). Then re-run the `unit` project: 909 passed is expected |
| DN-2 | `consume` before the row, throwing the 429 (DV-1) | Accept, and give section 6.2 to W24, W28, W32 and W41. It replaces the note of D40 "call it after writing a refusal row" |
| DN-3 | The window by the server clock (DV-3) | Accept. The alternative with no code of this row is the libraries' own windows on the system time: then a test that advances the manual clock must also call `reset()`, and ENG-13 does not hold for these deadlines |
| DN-4 | The constants outside `config.ts` (DV-4) | Accept |
| DN-5 | Stage 3 decides the Origin of an upgrade (DV-5) | Accept, and tell W42: do not decide the Origin again; test the handshake statuses on a socket; the 401 of the cell "cookie and bearer, web console origin" is stage 4's |
| DN-6 | The preflight answers 405 or 404 from routing (section 4.6) | Accept; W50's negative test through the dev server can expect it |
| DN-7 | Tests of other rows and the real guards (F-6, F-7) | Add to the briefs of W21, W24, W28, W32, W41, W42 and W47: section 6.3, and "a test app answers 429 after 30 signed-out requests or 20 audited refusals of one key within 60 s of the server clock" |
| DN-8 | A flood with a foreign `Origin` is not throttled (F-5) | Leave to the security review W45; it follows from the specified stage order |
| DN-9 | The stale title in `readiness.test.ts:236` (section 9) | Fix with DN-1 or leave |

## 13. Notes for the rows that follow

- **W24 (identity).** The console rule ID-1 (a) is `facts.category === 'WEB_CONSOLE' && !facts.hasBearer`
  with `facts = app.originDecision(request)`. Stage 3 has already refused a bearer with a web
  console origin and a cookie without one. `request.principal` decides the throttle key: leave it
  ANONYMOUS for a credential that does not resolve.
- **W28 (permission guard).** Section 6.2. The integration tests of stages 3 to 6 are yours; the
  unit forms here are written so that they hold unchanged with the real stage 4.
- **W32, W41.** Section 6.2 for `PAIRING_FAILED`, `PAIRING_LOCKED`, `AUTH_FAILED`, `AUTH_LOCKED`.
- **W42 (realtime).** DN-5. Upgrades are counted by stage 5 under the principal's key or the
  class and are not blocked by the denial budget. The anonymous cap of 6 is yours.
- **Every row with `buildApp` in a test.** `throttleControl(app).reset()`, a manual clock, or
  `app.stages.replace('throttle', () => {})`.

## 14. Rollback (R-NEW; not executed)

The two folders held one stub each before this row. Their pre-image is
`.cache/rollback/W23.pre.patch` (115 lines; SHA-256 `054fc0d0…5cf5ee`), two "new file" patches. A
trial in a scratch repository showed that applying it recreates both stubs byte for byte
(SHA-256 `169d9aeb…cdd52f` and `5cc8e63c…c95fd1`, the values recorded before the first edit).

```sh
cd /Users/gsp-budi/Documents/DEMS
git clean -fd -- apps/core-server/src/plugins/origin-guard apps/core-server/src/plugins/throttle
git apply .cache/rollback/W23.pre.patch
```

After the rollback the `unit` project is the baseline again (the two W08 files pass against the
stubs). If the patches of section 9 were applied, they are reverted separately.

## 15. The last run before this document was closed

At 09:27:54 (load average 2.8):

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/origin-guard src/plugins/throttle
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server
 Test Files  5 passed (5)
      Tests  345 passed (345)
   Start at  09:27:54
   Duration  873ms (transform 36%, tests 33%, import 31%, worker 1%)
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2
 ❯ |unit| src/plugins/logger/__tests__/log-capture.test.ts (18 tests | 18 skipped) 43ms
 ❯ |unit| src/plugins/readiness/__tests__/readiness.test.ts (30 tests | 1 failed) 92ms
     × the stubs that are not implemented say which row fills them 4ms
 Test Files  2 failed | 28 passed (30)
      Tests  1 failed | 890 passed | 18 skipped (909)
   Start at  09:27:55
exit=1

$ npm run lint -w @dems/core-server
exit=0

$ npm run typecheck -w @dems/core-server
test/db/catalog.db.test.ts(198,21): error TS2352: …
exit=2

$ tsc --noEmit -p <the workspace configuration without test/db>
exit=0
```

One comment in `throttle/index.ts` was reworded after that. The runs that follow it (09:28:57 and
09:29:00) give the same numbers: the row's command 5 files and 345 passed, exit 0; lint exit 0;
the compiler without `test/db` exit 0; the whole `unit` project 2 failed and 28 passed of 30
files, 1 failed, 890 passed and 18 skipped of 909 tests.

## 16. Follow-up: scaffold test adaptation (D52)

The controller ruled on section 12 (decision D52): DN-2 to DN-6 accepted, DN-7 noted for later
briefs, DN-8 to the backend security review, and **DN-1 and DN-9 to be applied now** as recorded
by-design changes of two test files of the scaffold. This section is that change. Sections 1 to 15
are left as they were written at 09:30 and describe the state before it; only the status in the
front matter was changed, from `needs-review` to `complete`.

Authorised and edited: exactly the two files below. No source file, no other test file, no
configuration and no manifest was touched; `find apps/core-server/src -newer <the progress file of
09:30>` lists these two files and nothing else.

### 16.1 Pre-images (saved before the first edit, 09:31:07)

Both files are untracked new files of the scaffold row, so a diff against `acaff20` is empty; the
files themselves were copied.

| Pre-image | Of | SHA-256 (equal to the file at the time of the copy) | `git hash-object` |
|---|---|---|---|
| `.cache/rollback/W23b.readiness.test.ts.pre` (360 lines) | `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts` | `a666500af747445e…64cbe0eb` | `3a0444f5e340ba4d88c58c73d25b300e9b0637ff` |
| `.cache/rollback/W23b.log-capture.test.ts.pre` (298 lines) | `apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts` | `47b02b4be311d5c6…9194f559` | `a6196aa7b659193d05a5e83036cd74adf4465c03` |

### 16.2 Every edited line

**File 1: `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`** (360 lines before,
361 after: 1 line changed, 2 added, 1 removed).

| # | Line | Before | After | Reason |
|--:|---|---|---|---|
| 1 | 236 (same line before and after) | `it('the stubs: a working clock, a publish that does nothing, a resolver that knows no device, a budget that counts nothing', async () => {` | `it('the seams that answer as they are: a working clock, a publish that does nothing, a resolver that knows no device, and the budget, which resolves for a request it cannot read', async () => {` | DN-9. The title was stale: the budget is no longer a stub that counts nothing. The body of the test (lines 237 to 245) is unchanged and says what the new title says: `app.denialBudget.consume({})` resolves, because the real budget logs and resolves when it cannot read the key (section 6.2) |
| 2 | 247, 248 after (inserted before the old line 247) | (no line) | `// Standing rule (decision D52): a row that fills one of these seams deletes its own assertion` and `// here, as a recorded by-design change, and nothing else. \`originDecision\` is filled (W23).` | The standing rule the controller asked for, above the block it is about, in the file's comment style |
| 3 | 253 before (removed) | `expect(() => app.originDecision({} as Parameters<typeof app.originDecision>[0])).toThrow('plan row W23');` | (no line) | DN-1. The assertion pinned `app.originDecision` as not implemented; this row implements it |

Not touched, as instructed: the assertions for the seams that are still stubs. They are now at
lines 252 to 254 (`pipeline.drain`, `pipeline.run`, `auditWriter.append`: W21), 255 and 256
(`sessionRegistry`: W24), 257 and 258 (`engine.epoch`, `engine.revision`: W26), with their text
unchanged.

```
$ diff -U1 .cache/rollback/W23b.readiness.test.ts.pre apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts
@@ -235,3 +235,3 @@
 
-  it('the stubs: a working clock, a publish that does nothing, a resolver that knows no device, a budget that counts nothing', async () => {
+  it('the seams that answer as they are: a working clock, a publish that does nothing, a resolver that knows no device, and the budget, which resolves for a request it cannot read', async () => {
     const app = await readyApp();
@@ -246,2 +246,4 @@
 
+  // Standing rule (decision D52): a row that fills one of these seams deletes its own assertion
+  // here, as a recorded by-design change, and nothing else. `originDecision` is filled (W23).
   it('the stubs that are not implemented say which row fills them', async () => {
@@ -252,3 +254,2 @@
     expect(() => app.auditWriter.append(unit, { type: 'X', actorId: null, deviceId: null, details: {} })).toThrow('plan row W21');
-    expect(() => app.originDecision({} as Parameters<typeof app.originDecision>[0])).toThrow('plan row W23');
     expect(() => app.sessionRegistry.endForOperator(unit, 'OP-0001', 'USER_DISABLED')).toThrow('plan row W24');
```

**File 2: `apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts`** (298 lines before,
302 after: 4 lines added, none changed, none removed).

| # | Line | Before | After | Reason |
|--:|---|---|---|---|
| 4 | 66 after (inserted after line 65, `await app.ready();`) | (no line) | `// About the log, not the guards: these requests carry the cookie and a bearer value together (D52).` | The one comment line the controller asked for |
| 5 | 67 after | (no line) | `app.stages.replace('originGuard', () => {});` | The file's two POSTs carry this instance's cookie and an `Authorization` header with no `Origin`; stage 3 answers that cell with 403 [SP:§14.2] |
| 6 | 68 after | (no line) | `app.stages.replace('authenticate', () => {});` | The file's two routed GETs carry both credentials; the real stage 4 (W24) will answer them with 401 `CREDENTIAL_CONFLICT`. A no-op today, because stage 4 is still a stub |
| 7 | 69 after | (no line) | `app.stages.replace('throttle', () => {});` | The file is not about the throttle; with a no-op the number of requests the file sends can grow without a 429 |

```
$ diff -U1 .cache/rollback/W23b.log-capture.test.ts.pre apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts
@@ -65,2 +65,6 @@
   await app.ready();
+  // About the log, not the guards: these requests carry the cookie and a bearer value together (D52).
+  app.stages.replace('originGuard', () => {});
+  app.stages.replace('authenticate', () => {});
+  app.stages.replace('throttle', () => {});
   app.readiness.set('database', true);
```

**Does any single test of that file need a guard to be active?** No; all 18 were read.

- The 13 tests of "the captured log" (10) and "the persistent error log" (3) read what the eight
  requests of `beforeAll` left in the log and in the error log file; one of the three builds an
  app and sends nothing. One test, "logs every refusal with its code", expects exactly the codes
  `INVALID_JSON`, `INVALID_PATH`, `NOT_FOUND`, `METHOD_NOT_ALLOWED` and `INTERNAL_ERROR`: a
  refusal by a guard would add a code, so for this file the guards have to be out of the way, not
  merely may be.
- Of the 2 tests of "the principal reference of a request line", "is the operator ID or the
  device ID, and null for an anonymous caller" builds a second app of its own. The three
  replacements are made on the file's first app only, so this test **runs with the real stages 3
  and 5** and passes with them: its three GETs carry no `Origin` and no credential. The other
  test calls a pure function.
- The 3 tests of "the helpers" call pure functions.

Reference state of the two files after the change, for the rows that edit them next (W21, W24 and
W26 delete their own assertions in file 1):

| File | SHA-256 | `git hash-object` |
|---|---|---|
| `…/readiness/__tests__/readiness.test.ts` | `d584267b004b04a8…f788cf5a` | `b7f56e8b9122343db81c09a6e626cbb688e375b6` |
| `…/logger/__tests__/log-capture.test.ts` | `b6b965d277539fa9…93f5cf06` | `57642327a9ddba8b2fde5daf878b92b43790849b` |

### 16.3 Verification after the change

The whole `unit` project (09:32:21):

```
$ npm run test -w @dems/core-server -- --maxWorkers=2

> @dems/core-server@0.2.0 test
> vitest run --project unit --maxWorkers=2

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server

 Test Files  31 passed (31)
      Tests  979 passed (979)
   Start at  09:32:21
   Duration  2.75s (import 45%, tests 40%, transform 13%, worker 1%)

exit=0
```

This row's five files (09:32:24):

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/origin-guard src/plugins/throttle

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server

 Test Files  5 passed (5)
      Tests  345 passed (345)
   Start at  09:32:24
   Duration  749ms (tests 36%, transform 33%, import 31%, worker 1%)

exit=0
```

Lint and typecheck (09:32:44):

```
$ npm run lint -w @dems/core-server
> oxlint
exit=0

$ npm run typecheck -w @dems/core-server
> tsc --noEmit
exit=0

$ tsc --noEmit -p <the workspace configuration with test/db excluded>
exit=0
```

The workspace typecheck is green now with `test/db` included: the error of section 8.4 was in the
migration writer's file `test/db/catalog.db.test.ts`, which that row has changed since. The two
lint warnings of section 8.4, in its `test/db/boot-checks.db.test.ts`, are gone as well. Neither
was this row's.

### 16.4 The skipped tests

**Now: none.** A second run of the whole `unit` project with `--reporter=json` (runner exit 0)
gives, per test: 979 with status `passed`, 0 `failed`, 0 `pending` or `skipped`, 0 `todo`, in 31
files. A search of the `unit` project's test files for `.skip`, `.todo`, `.skipIf`, `.runIf`,
`.fails`, `.only`, `xit(` and `xdescribe(` finds nothing.

**The 18 that sections 8.3 and 15 report as skipped** were all in one file, and none was this
row's:

| File | Owner | Skipped | Why |
|---|---|--:|---|
| `src/plugins/logger/__tests__/log-capture.test.ts` | W08 (the scaffold) | 18 of 18 | The file's `beforeAll` hook threw: its expectation at line 89 got `[403, 403, …]` where it expected `[200, 400, …]` (section 9, BE-GAP-W23-2). When a `beforeAll` hook fails, the runner runs none of the file's tests and reports each as skipped; the file itself was reported as failed |

They were not skipped silently: the run reported the file as a failed suite with the assertion,
and section 9 named it. The 18, by block: "the captured log" 10, "the persistent error log" 3,
"the principal reference of a request line" 2, "the helpers" 3. All 18 now run and pass. No test
of this row's five files was skipped in any run: 345 passed of 345 each time.

### 16.5 Test ledger after the follow-up (P24)

| `@dems/core-server`, `unit` | Files | Tests | Passed | Failed | Skipped |
|---|--:|--:|--:|--:|--:|
| Baseline of this row (09:00:08) | 24 | 526 | 526 | 0 | 0 |
| End of the row before the follow-up (09:29:00) | 30 | 909 | 890 | 1 | 18 |
| After the follow-up (09:32:21) | 31 | 979 | 979 | 0 | 0 |

979 = 526 (baseline) + 345 (this row, 5 files) + 38 (`test/db/contract-inventory.test.ts`) + 70
(`test/db/commands.test.ts`). The last two files are the migration writer's; the second appeared
between 09:29 and 09:32. The follow-up added no test and removed none: `readiness.test.ts` still
has 30 tests (one of them lost one assertion) and `log-capture.test.ts` still has 18.

### 16.6 One observation for later rows (no change made)

`log-capture.test.ts:103` asserts that the captured log does not contain the text `Bearer`. The
Origin guard's refusal line has a field named `hasBearer` (the name of the scaffold's own
`OriginFacts` member), which contains that text. With stage 3 replaced in that file the line is
never written there. A later log test that keeps stage 3 active, provokes a refusal and searches
for `Bearer` would find the field name, not a header value; this row's own log tests search for
`Bearer ` with the space, and for the markers. If the controller prefers that the substring never
appears, the field can be renamed in a later slot; nothing was changed now.

### 16.7 Rollback of the follow-up (not executed)

```sh
cd /Users/gsp-budi/Documents/DEMS
cp .cache/rollback/W23b.readiness.test.ts.pre apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts
cp .cache/rollback/W23b.log-capture.test.ts.pre apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts
```

It is only meaningful together with the rollback of section 14: against the real guards the two
pre-images fail as section 9 describes.

---
*Generated: 2026-10-04 09:30 WIB*
*Last Updated: 2026-10-04 09:35 WIB (section 16, follow-up of decision D52)*
