---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 30
plan_row: W08
title: Backend scaffold of @dems/core-server with the health operation
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3
status: complete
---

# W08: backend scaffold and health

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed into a subfolder. Baseline for every comparison is commit `acaff20`.
No port was bound and no server was started in this row. No database was contacted: PostgreSQL
was being provisioned by step 29 while this row ran, and nothing here needs it.

## 1. Result

| Item | Result |
|---|---|
| Status | **complete**. Every deliverable exists; every check of the row passes (section 12) |
| Tests | `@dems/core-server`, project `unit`: 330 passed in 17 files, of which **255 tests in 13 files are this row's** |
| Typecheck, lint | Workspace and root: exit 0 |
| Protected paths | `git diff --stat acaff20 -- apps/mock-core release scripts/release` prints nothing |
| Contract | `packages/shared/src/api/` untouched. One gap logged: **CONTRACT-GAP-1** (section 13) |
| For the controller | Three deviations to record (a tenth seam, the scaffold's own decorators, the header text of the content-security policy) and five decisions (section 16) |

## 2. What was done

1. Read the row, the protocol P1 to P25, the specification sections, the database contract's rules
   for the connection file, the boot checks and the two static tests, and step 25's output.
2. Probed Fastify 5.12.5, `@fastify/helmet` 13.1.1 and `pg` 8.23.1 in-process (scratch scripts
   outside the repository, `app.inject` only) for the facts the design depends on. They are
   recorded as findings F-1 to F-9.
3. Saved the rollback pre-image (P23): `.cache/rollback/W08.pre.patch`, 0 bytes, because none of
   the multi-writer paths existed at `acaff20`.
4. Wrote the configuration module, the loader, the logger, the error envelope, the response
   headers, the pool, readiness, the app factory, the entry point, the health module, 20 stubs
   and the static guard tests: 55 files.
5. Verified: workspace tests, typecheck and lint; root typecheck and lint; the diff of the
   protected paths; one run of the entry point with a port it refuses (it exits before any file
   is read and long before a listener).

## 3. Final folder tree

Files of this row. `password-hash/` (W09) and `test/helpers/db/` (W11) belong to rows that ran at
the same time and are not listed. `package.json`, `tsconfig.json`, `vitest.config.ts`,
`src/version.ts` and `src/version.test.ts` are step 25's.

```
apps/core-server/
  src/
    index.ts                      entry point: the only listen, the only reader of process.env
    app.ts                        app factory: seams, request stages, static registration
    config.ts                     constants, types, pure derivations, Secret, ConfigError
    plugins/
      config/                     index.ts, load-config.ts, connection-file.ts
        __tests__/                load-config.test.ts, test-config.ts (test support)
      logger/                     index.ts, logger-options.ts, log-controller.ts,
                                  request-log.ts, error-log.ts
        __tests__/                log-capture.test.ts
      error-envelope/             index.ts, api-failure.ts, json-body.ts, route-table.ts
        __tests__/                error-envelope.test.ts
      response-headers/           index.ts
        __tests__/                response-headers.test.ts
      db/                         index.ts
        __tests__/                db.test.ts
      readiness/                  index.ts
        __tests__/                readiness.test.ts, incomplete-scaffold.test.ts
      origin-guard/index.ts       STUB, owner W23
      throttle/index.ts           STUB, owner W23
      authenticate/index.ts       STUB, owner W24
      permission-guard/index.ts   STUB, owner W28
    core/index.ts                 STUB, owner W21
    engine/index.ts               STUB, owner W26
    realtime/index.ts             STUB, owner W42
    modules/
      health/                     index.ts, health-schema.ts (removed by the follow-up)
        __tests__/                health.test.ts
      identity/index.ts           STUB, owner W24
      rbac/index.ts               STUB, owner W28
      admin/index.ts              STUB, owner W33
      pairing/index.ts            STUB, owner W32
      sessions/index.ts           STUB, owner W34
      evidence/index.ts           STUB, owner W35
      devices/index.ts            STUB, owner W36
      storage/index.ts            STUB, owner W37
      network-time/index.ts       STUB, owner W37
      security-audit/index.ts     STUB, owner W39
      system/index.ts             STUB, owner W40
      alerts/index.ts             STUB, owner W40
      demo/index.ts               STUB, owner W43
  test/
    static/                       scan.ts (support), credentials.test.ts,
                                  audit-protection.test.ts, network.test.ts,
                                  logging.test.ts, scaffold.test.ts
```

Counts: 3 top-level sources, 15 sources and 8 test or test-support files in the six plugin
folders of the scaffold, 4 stage stubs, 3 folder stubs, 13 module stubs, 3 health files, 6 static
files: 55 files, 5,560 lines, of which 2,890 are production sources.

Runtime artefact, not a source: the entry point writes a persistent error log to
`apps/core-server/logs/errors.log` (mode 0600; git-ignored by the root `*.log` rule,
`git check-ignore -v` answers `.gitignore:48:*.log`). The app factory writes none unless a file is
passed, so no test creates it.

## 4. The request pipeline as registered

The order of [SP:§2.3] is a constant of the app factory, `REQUEST_STAGES`, not a consequence of
who registers first. One `onRequest` hook runs the five handlers in that order and stops at the
first that refuses.

| # | Stage | Fastify mechanism | Slot | Provided by | Refuses with | State now |
|---|---|---|---|---|---|---|
| 1 | Routing | router; `setNotFoundHandler`; server option `frameworkErrors` | none | `plugins/error-envelope` | 400 `INVALID_PATH`, 404 `NOT_FOUND`, 405 `METHOD_NOT_ALLOWED` with `allow` | real |
| 2 | Readiness | `onRequest` (the stage hook) | `readiness` | `plugins/readiness` | 503 `NOT_READY` | real |
| 3 | Origin guard | `onRequest` (the stage hook) | `originGuard` | `plugins/origin-guard` (W23) | 403 `ORIGIN_NOT_ALLOWED` | stub: passes everything |
| 4 | `authenticate` | `onRequest` (the stage hook) | `authenticate` | `plugins/authenticate` (W24) | 401 with `CREDENTIAL_CONFLICT` | stub: every caller ANONYMOUS |
| 5 | Throttle and denial budget | `onRequest` (the stage hook) | `throttle` | `plugins/throttle` (W23) | 429 `RATE_LIMITED` | stub: no limit |
| 6 | Access rule | `onRequest` (the stage hook) | `accessRule` | `plugins/permission-guard` (W28) | 401, 403 | stub: allows everything |
| 7 | Parsing and validation | content-type parser; `preValidation`; zod validator and serialiser compilers | none | `plugins/error-envelope`, `app.ts` | 413, 400 `INVALID_JSON`, 422 `INVALID_INPUT` | real |
| 8 to 10 | Handler, commit, publish | route handler; `app.pipeline`; `app.publish` | none | the modules, `core`, `realtime` | | stubs |

Hook order on the root instance, which the registration order in `app.ts` fixes:

| Order | Hook | Added by | Why at this position |
|---|---|---|---|
| 1, 2 | `onRequest` ×2 | `@fastify/helmet` | A refusal by a stage already carries the four headers |
| 3 | `onRequest` | `@fastify/cookie` | `request.cookies` is parsed before stage 3 reads the cookie's presence |
| 4 | `onRequest` | the stage hook of `app.ts` | Sets `request.principal` to ANONYMOUS, skips a request that matched no route, then runs stages 2 to 6 |
| | `preValidation` | `plugins/error-envelope` | A POST without a body gets `{}` |
| | `onSend` | `plugins/response-headers` | `Cache-Control`, and the policy text of OR-9 |
| | `onRoute` | `app.ts` | Fills the route table (405 against 404); added before any route |
| | `onReady` | `app.ts` | Stops the boot when a seam or a stage has no provider |
| | `onClose` | `plugins/db` | Closes the pool; added first, so it runs last (`onClose` hooks run in reverse order) |

Two facts that later rows depend on:

- **A hook that a plugin adds on its own runs after all five stages.** So a stage's logic goes
  into its handler (`app.stages.provide(slot, handler)`), not into a separate `onRequest` hook.
  `@fastify/rate-limit` is used through its route-level handler (`app.rateLimit()`) inside the
  `throttle` handler.
- **A request that matched no route skips the stages.** Line 1 of [SP:§7.3] therefore holds: an
  unknown path answers 404 and a wrong method 405 while the server is not ready, and whatever the
  `Origin` is. Proven by tests (section 12).

## 5. Decorators

### 5.1 The seams of P25 (plus one)

Each is a getter on `app` over a registry (`app.seams`). The owning unit fills it with
`app.seams.provide(name, value)`. The **type lives in the owning unit's `index.ts`**, so the owner
can extend it without an edit of `app.ts`; `app.ts` only maps the name to the type.

| Decorator | Type (file) | Stub behaviour | Provided by | Owner | Binding now? |
|---|---|---|---|---|---|
| `clock` | `Clock { now(): number }` (`core/index.ts`) | **Works**: the wall clock, never moving backwards (ENG-14). Health reads it | `core` | W21 | yes: health uses it |
| `pipeline` | `Pipeline { run<T>(label, work): Promise<T>; drain(): Promise<void> }`, `UnitOfWork { label }` (`core/index.ts`) | Throws "pipeline.run is not implemented: plan row W21 fills src/core" | `core` | W21 | no: a sketch; every user runs after W21 |
| `auditWriter` | `AuditWriter { append(unit, entry): Promise<void> }`, `AuditEntry` (`core/index.ts`) | Throws, naming W21 | `core` | W21 | no: a sketch |
| `originDecision` | `OriginDecision = (request) => OriginFacts`; `OriginFacts { category: 'ABSENT' \| 'WEB_CONSOLE' \| 'OWN' \| 'OTHER'; hasCookie; hasBearer }` (`plugins/origin-guard/index.ts`) | Throws, naming W23 | `plugins/origin-guard` | W23 | **yes**: W24 runs beside W23 and calls it for ID-1 |
| `denialBudget` | `DenialBudget { consume(request): Promise<void> }` (`plugins/throttle/index.ts`) | **Safe no-op**: counts nothing | `plugins/throttle` | W23 | **yes**: W24, W28, W32, W41 call it. Not in P25's list (section 15, DV-1) |
| `sessionRegistry` | `SessionRegistry { endForOperator(unit, operatorId, reason); endForDevice(unit, deviceId, reason) }` (`modules/identity/index.ts`) | Throws, naming W24 | `modules/identity` | W24 | no: a sketch; W32, W33, W42 run after W24 |
| `engine` | `EngineHost { epoch; revision }`, `EngineStateChange`, `EngineMeterFrame` (`engine/index.ts`) | Reading a member throws, naming W26. `ready.engine` stays false | `engine` | W26 | no: a sketch |
| `deviceResolver` | `DeviceResolver { resolveCredential(credential): Promise<ResolvedDevice \| null>; resolveDevice(deviceId): Promise<ResolvedDevice \| null> }`; `ResolvedDevice { status: 'PAIRED' \| 'RETIRED'; deviceId }` (`modules/pairing/index.ts`) | **Safe**: answers "unknown" (null), which is true while no device can be paired; a bearer request stays ANONYMOUS | `modules/pairing` | W32 | **yes**: W24 lands first and calls it at stage 4 |
| `publish` | `Publish = (publication: Publication) => void`; `Publication` is a union of `state`, `meters`, `session.updated`, `session.ended`, `device.revoked`, `admin.changed` (`realtime/index.ts`) | **Safe no-op**: no socket is open | `realtime` | W42 | **yes**: W24, W26, W32, W33, W41 land first and call it |
| `readiness` | `Readiness { snapshot(); isReady(); set(part, ready); hold(reason); addBootStep(step); boot() }` (`plugins/readiness/index.ts`) | Real | `plugins/readiness` | W08 | yes |

"Binding now" marks the seams whose users land before or beside the owner: their members may be
added to, not changed. For the others the stub type is a first sketch from the specification and
the owning row defines the real members.

### 5.2 The scaffold's own decorators

| Decorator | Type | Purpose |
|---|---|---|
| `app.config` | `CoreServerConfig` (`config.ts`) | The configuration, loaded once at start, frozen |
| `app.errorLog` | `ErrorLog` (`plugins/logger`) | The persistent error log; `append(entry)` never throws |
| `app.db` | `Database { pool; generation; probe(); close(); reopen() }` (`plugins/db`) | The lazy pool of the runtime role. Available after `ready()` |
| `app.seams` | `SeamRegistry`: `provide`, `replace`, `has`, `get` | Fills and overrides the seams |
| `app.stages` | `RequestStages`: `provide`, `replace`, `has`, `get` | Fills and overrides the five stage handlers |
| `request.principal` | `Principal` (`plugins/authenticate/index.ts`) | ANONYMOUS on every request until stage 4 sets it. Kinds: `ANONYMOUS { retiredDeviceId }`, `DEVICE { deviceId }`, `OPERATOR { operatorId, sessionId, deviceId, role, permissions }` |
| route `config.operationId` | `string` | A route names its operation of the shared registry; stage 2 exempts `getServiceHealth` by it, and the access rule of W28 will read it |

`@fastify/cookie` 11.1.2 is registered by the scaffold, so `request.cookies`, `reply.setCookie`
and `app.parseCookie` exist. **W24 must not register it again** (Fastify would refuse the second
`cookies` decorator).

## 6. How a later row uses the scaffold

1. **Replace your unit's `index.ts` and keep its exports.** Each stub's header lists them under
   "CONTRACT with the scaffold". `test/static/scaffold.test.ts` names the missing export before the
   type checker does.
2. **A unit is registered at root scope.** What it adds (a hook, a decorator, a route) lands on the
   root instance. For a private scope, call `app.register(async (scope) => { ... })` inside it.
3. **The plugin function opens no database connection.** Work that needs the database at start is
   a boot step: `app.readiness.addBootStep({ id, run })`. `buildApp()` then stays usable without
   PostgreSQL, which every database-free test of every row relies on. Steps run in registration
   order; `index.ts` calls `app.readiness.boot()` before `listen`; a step that throws stops the
   process with one log line that names the step's ID, and no listener is opened.
4. **Refuse by throwing `ApiFailure`** (`plugins/error-envelope`):
   `throw new ApiFailure(409, 'SESSION_ACTIVE', 'A session is already active.', { details, headers })`.
   Nobody builds an error body by hand.
5. **Log through `request.log` or `app.log`**, never the console, and never read `request.url`
   (use `request.routeOptions.url`, the pattern). Two static tests enforce both.
6. **`app.db.pool` is a getter.** A reset closes the pool and opens a new one; do not keep the
   pool, or a Drizzle instance built on it, across a change of `app.db.generation`.
7. **Tests**, with no database:

   ```ts
   import { buildApp } from '../../../app';
   import { createFakePool, unitTestConfig } from '../../config/__tests__/test-config';

   const app = buildApp({ config: unitTestConfig(), createPool: () => createFakePool().pool });
   app.get('/api/v1/scratch', async () => ({}));        // routes before ready()
   await app.ready();
   app.readiness.set('database', true);                 // or app.stages.replace('readiness', () => {})
   app.readiness.set('engine', true);
   app.stages.replace('authenticate', (request) => { request.principal = { kind: 'DEVICE', deviceId: 'DEV-0001' }; });
   app.seams.replace('originDecision', () => ({ category: 'WEB_CONSOLE', hasCookie: false, hasBearer: false }));
   ```

   `replace` wins over `provide` whenever it is called. Until W26 lands, `ready.engine` is false,
   so every operation except health answers 503 unless the test sets the flag.

## 7. Configuration

| Item | Where | Value |
|---|---|---|
| Listen host | `LISTEN_HOST` in `config.ts` | `127.0.0.1`, a constant; no variable reaches it |
| Listen port | `DEMS_CORE_PORT` | 4420 by default; 4421 to 4423 accepted; anything else stops the boot (`LISTEN_PORT_NOT_ALLOWED`), before any file is opened |
| Demo flag | `DEMS_DEMO_CONTROLS` | `1` on; unset, empty or `0` off; anything else stops the boot |
| Log level | `DEMS_LOG_LEVEL` | `info` by default |
| Web console origins | `WEB_CONSOLE_ORIGINS` | `http://127.0.0.1` on 5173, 5176, 5177, 5178; no `localhost` |
| Own origins | `ownOriginsFor(port)` | `http://127.0.0.1:4420`, and on a lane also the lane's port |
| Cookie name | `sessionCookieNameFor(port)` | `dems_session_<port>` |
| Database | `databaseNameFor(port)` | 4420 `dems_demo`; 442k `dems_lane_k`. The file's database field is ignored |
| Body limit | `BODY_LIMIT_BYTES` | 65,536 |

The loader (`plugins/config`):

- Opens **one** file, `<data directory>/pg.env`. A test puts the two other credential files beside
  it with mode 000 and the loader still works.
- Checks the mode before it reads: any bit for group or others stops it with a message that names
  the file and the expected mode and says "Nothing was read".
- Accepts exactly the five keys, each once, as `KEY=value` lines: the format `scripts/pg/lib.mjs`
  writes. Every error names the file and a key, never a value.
- Refuses a host other than `127.0.0.1` and refuses port 5432 (F27). There is no default for
  host or port.
- Requires the role `dems_app`.
- Wraps the password in `Secret`: `JSON.stringify`, string conversion and `util.inspect` give
  `[redacted]`; only `reveal()` returns it. The pool receives it through a function, so the pool's
  options hold no copy.

`createConfig(input)` is the pure part (endpoint rules and derivations, no file, no environment);
tests build a configuration with it.

## 8. Logging

| Layer | What it does |
|---|---|
| `CoreLogController` (Fastify's `logController` option) | One line per request: `reqId`, `method`, `route`, `status`, `durationMs`, `principal`, and `code` for a refusal. No "incoming request" line, no "Route … not found" line |
| Serializers | `req` gives the method and the route pattern; `res` the status; `err` the name, the code and the stack frames. An error's own message is never written |
| Redaction | `authorization`, `cookie`, `set-cookie` are censored wherever a header object is logged by hand |
| Log-method hook | An error logged without a text gets the fixed text "error"; a quoted path inside a message text becomes `"[path]"` |
| Persistent error log | JSON lines, mode 0600, one entry per unexpected failure, per database outage and per refusal to start. Same content rule. Rotates at 5 MiB to `errors.1.log` |

`route` is the route pattern (`/api/v1/session/:id/start`). For a known path called with another
method it is still the pattern. For a path that matched nothing it is the path without its query
string, cut at 200 characters, as SR-49 says. `principal` is `operator:<id>`, `device:<id>` or
null.

## 9. Response headers and SA-13

`@fastify/helmet` 13.1.1 (helmet 8.3.0) sets `X-Content-Type-Options`,
`Cross-Origin-Resource-Policy`, `Referrer-Policy` and `Content-Security-Policy` in its `onRequest`
hook. One `onSend` hook sets `Cache-Control: no-store`. `strictTransportSecurity` and the nine
other helmet defaults are off. A test asserts that an answer carries the five headers, the
transport headers (`content-type`, `content-length`, `date`, `connection`, `allow`,
`retry-after`) and nothing else.

**Outcome of SA-13.** The option names are confirmed (they are in
`plugins/response-headers/index.ts`). One difference was found: helmet writes the policy as
`default-src 'none';frame-ancestors 'none'`, without the space that OR-9 has after the semicolon.
It is the same policy. The `onSend` hook states it again with the text of OR-9, so the header
equals the specification byte for byte; a test keeps the directives given to helmet and that text
in step. This is the fallback SA-13 names.

The answer to a URL the router cannot decode passes no hook at all, so `frameworkErrors` sets the
five headers itself.

## 10. Error envelope

`{ error: { code, message, details?, requestId } }`. `requestId` is a UUID made by the server,
never taken from a request header, and equal to `reqId` of the log line.

| Case | Answer |
|---|---|
| URL that cannot be decoded; path parameter over the length limit | 400 `INVALID_PATH` |
| Unknown path | 404 `NOT_FOUND` |
| Known path, other method (also HEAD and OPTIONS) | 405 `METHOD_NOT_ALLOWED`, header `allow` |
| Malformed JSON; valid JSON that is not an object; a content type other than JSON; a prototype-poisoning body | 400 `INVALID_JSON` |
| Body over 65,536 bytes | 413 `PAYLOAD_TOO_LARGE` |
| Body, path parameter, query or header that breaks its zod schema | 422 `INVALID_INPUT`, `details.in` |
| `ApiFailure` thrown anywhere | Its status, code, message, details, headers |
| Anything else, also an answer that breaks its own response schema | 500 `INTERNAL_ERROR`, no detail |

An empty body, and a POST with no body at all, count as `{}`, as in the simulator's REST layer.
Fastify's default `text/plain` parser is removed (finding F-5).

## 11. Static guard tests

`apps/core-server/test/static/`. They belong to the project `unit`, so they run in every later
gate (GR-7). Each file has a positive control: the scanner is shown to find every forbidden text
in a planted sample. Every forbidden text is built from fragments in the test files, so the tests
do not find themselves.

| File | Rule | Scope | Source |
|---|---|---|---|
| `credentials.test.ts` | The superuser password file is named nowhere | `apps/` and `packages/` | T-CR-2 (a); HC-1 |
| | No driver password variable, no connection-URL variable, no env-file option of Node, no connection URL with a user part, no shell that sources a file of the data directory | `apps/core-server/` | T-CR-2 (b); AC-B-86 |
| | No npm script carries a secret or reads the data directory; the server runtime starts no child process | manifest; `src/` without `src/db/` | AC-B-86 |
| | The owner-role file is named under `src/` only in `src/db/reset/` and `src/db/commands/`; the scaffold names neither file; the loader has one file read | `src/` | T-CR-2 (c); HC-2, HC-3 |
| `audit-protection.test.ts` | No trigger is switched off or dropped; no server setting is changed | `apps/core-server/` | T-AO-4 |
| | The session setting that skips triggers appears only in `test/db/` | `apps/core-server/` | T-AO-4 |
| | A function or trigger is replaced only in `src/db/migrations/`; a database is dropped only in `src/db/reset/`, `test/helpers/db/` and `test/global-setup.db.ts` | `apps/core-server/` | T-AO-4, LN-6 |
| `network.test.ts` | Only `src/index.ts` listens; it binds `LISTEN_HOST`, which is `127.0.0.1`; no wildcard address | production sources | SR-01 |
| | The environment is read by `src/index.ts` only | `src/` without `src/db/` | SR-57, D26 |
| | 5432 appears once, in `src/config.ts`, where it is refused; no driver variable is named | production sources and root configuration | D26, F27 |
| | No CORS plugin, no CORS header, no `localhost` origin | workspace; production sources | SR-04, OR-5, OR-7 |
| | No global `fetch`, no outbound client module; nothing imports from mock-core | `src/` without `src/db/`; workspace | SR-03; P5, P21 |
| `logging.test.ts` | No console call; only the logger and the error envelope read the raw request URL | `src/` without `src/db/` | SR-48, SR-49 |
| `scaffold.test.ts` | Each of the 21 units has an `index.ts` with its export; `app.ts` imports it statically and registers it; the factory loads nothing dynamically, does not listen, reads no environment | `src/` | P25; ADQ-8 |

"Production sources" are `src/**` without `*.test.ts` and `__tests__/`. The rules about what code
does (a call, a property read) ignore comments; the rules about credentials and SQL statements
search the raw text, comments included.

## 12. Verification

### 12.1 The row's command (07:41:32)

```
$ npm run test -w @dems/core-server -- --maxWorkers=2

> @dems/core-server@0.2.0 test
> vitest run --project unit --maxWorkers=2

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server

 Test Files  17 passed (17)
      Tests  330 passed (330)
   Start at  07:41:33
   Duration  1.05s (tests 48%, import 38%, transform 12%, worker 2%)
```

Exit 0. Three more runs in a row gave the same totals. Tests per file
(`--reporter=verbose`, counted by file):

```
  11 src/modules/health/__tests__/health.test.ts
   9 src/modules/identity/password-hash/argon2-builtin.test.ts          (W09)
  62 src/modules/identity/password-hash/password-hash.test.ts           (W09)
   3 src/modules/identity/password-hash/password-hash.wiring.test.ts    (W09)
  46 src/plugins/config/__tests__/load-config.test.ts
  17 src/plugins/db/__tests__/db.test.ts
  28 src/plugins/error-envelope/__tests__/error-envelope.test.ts
  18 src/plugins/logger/__tests__/log-capture.test.ts
   3 src/plugins/readiness/__tests__/incomplete-scaffold.test.ts
  30 src/plugins/readiness/__tests__/readiness.test.ts
  15 src/plugins/response-headers/__tests__/response-headers.test.ts
   1 src/version.test.ts                                                (W03)
   7 test/static/audit-protection.test.ts
  13 test/static/credentials.test.ts
   3 test/static/logging.test.ts
  13 test/static/network.test.ts
  51 test/static/scaffold.test.ts
```

### 12.2 The cases of plan W08

| Case of the row | Test | Result |
|---|---|---|
| Health validates with `service: dems-core-server`, `version: 0.2.0` | `health.test.ts`: "answers service dems-core-server, version 0.2.0 and validates against the schema"; "is the shared health shape with two members changed (CONTRACT-GAP-1)" | PASS, against the local widened schema (section 13) |
| Pool pointed at a closed port: 200 with `ready.database: false` | `health.test.ts`: "with the pool pointed at a closed port: 200 with ready.database false"; "with a closed pool: 200 with ready.database false"; `db.test.ts`: "a real pool pointed at a closed port: false, quickly, and the process stays up" | PASS |
| A refusal in `onRequest` wins over an invalid JSON body | `error-envelope.test.ts`: "a refusal raised in onRequest wins over an invalid JSON body" (also over a body above the limit and over a schema failure) | PASS; SA-01 holds |
| Every answer carries the five headers and no `Strict-Transport-Security` | `response-headers.test.ts`: ten cases, status 200, 200, 404, 405, 400, 400, 413, 409, 500, 503, each "carries the five headers and nothing else"; "no answer carries Strict-Transport-Security or a CORS header, whatever the Origin" | PASS |
| Log capture with `authorization`, `cookie`, a body, `?token=<marker>`, malformed JSON with a marker: none of the values, no query string | `log-capture.test.ts`: 8 requests, 8 markers (authorization, cookie, set-cookie, body, query, path parameter, malformed JSON, error message), log level `trace` | PASS |
| A credential file of mode 0644 stops the loader, which prints no content | `load-config.test.ts`: "a file of mode 0644 stops the loader, which names the file and the mode and prints no content", and eight more modes | PASS |
| The static tests find none of the forbidden names | `test/static/*.test.ts`, 87 tests | PASS |
| `git diff --stat acaff20 -- apps/mock-core release scripts/release` prints nothing | section 12.5 | PASS |

Sample from the in-process run (`app.inject`, no listener), 07:42:31. The health answer and its
headers:

```
200 {"status":"ok","service":"dems-core-server","version":"0.2.0","apiVersion":"v1","serverTime":"2026-10-04T00:42:31.838Z","uptimeMs":6,"ws":{"path":"/ws","heartbeatIntervalMs":1000,"clients":0},"ready":{"database":false,"engine":false}}
content-security-policy: default-src 'none'; frame-ancestors 'none'
cross-origin-resource-policy: same-origin
referrer-policy: no-referrer
x-content-type-options: nosniff
content-type: application/json; charset=utf-8
cache-control: no-store
```

The log lines of five requests, each of which carried `?token=…` or `?x=…`:

```
{"level":40,…,"code":"EPERM","msg":"the database does not answer"}
{"level":30,…,"reqId":"88181f4d-…","method":"GET","route":"/api/v1/health","status":200,"durationMs":4,"principal":null,"msg":"request completed"}
{"level":30,…,"reqId":"3e7f0a1b-…","method":"GET","route":"/nope","status":404,"durationMs":0,"principal":null,"code":"NOT_FOUND","msg":"request completed"}
{"level":30,…,"reqId":"a831675f-…","method":"POST","route":"/api/v1/health","status":405,"durationMs":0,"principal":null,"code":"METHOD_NOT_ALLOWED","msg":"request completed"}
{"level":30,…,"reqId":"ce1977ec-…","method":"HEAD","route":"/api/v1/health","status":405,"durationMs":0,"principal":null,"code":"METHOD_NOT_ALLOWED","msg":"request completed"}
{"level":30,…,"reqId":"c363690b-…","method":"GET","route":"/api/v1/%E0%A4%A","status":400,"durationMs":0,"principal":null,"code":"INVALID_PATH","msg":"request completed"}
```

`EPERM` is the sandbox's answer to a connect on a closed loopback port; outside the sandbox it is
`ECONNREFUSED`. Either way the probe gives false (finding F-6).

### 12.3 Typecheck and lint of the workspace

```
$ npm run typecheck -w @dems/core-server
> @dems/core-server@0.2.0 typecheck
> tsc --noEmit
(exit 0)

$ npm run lint -w @dems/core-server
> @dems/core-server@0.2.0 lint
> oxlint
(exit 0, no finding)
```

### 12.4 Root typecheck and lint (after the last source change)

```
$ npm run typecheck
> @dems/shared@0.1.0 typecheck        > tsc --noEmit
> @dems/core-server@0.2.0 typecheck   > tsc --noEmit
> @dems/core-web@0.1.0 typecheck      > tsc -b
> @dems/mobile@0.1.0 typecheck        > tsc --noEmit
> @dems/mock-core@0.1.0 typecheck     > tsc --noEmit
ROOT TYPECHECK EXIT=0

$ npm run lint
> @dems/shared@0.1.0 lint        > oxlint
> @dems/core-server@0.2.0 lint   > oxlint
> @dems/core-web@0.1.0 lint      > oxlint
> @dems/mobile@0.1.0 lint        > eslint .
> @dems/mock-core@0.1.0 lint     > oxlint
ROOT LINT EXIT=0
```

### 12.5 Protected paths

```
$ git diff --stat acaff20 -- apps/mock-core release scripts/release
(no output)
$ git status --short apps/mock-core release scripts/release packages/shared/src/api apps/core-web/src/lib/packaged-csp.ts
(no output)
```

### 12.6 The entry point refuses a wrong port (no listener is ever reached)

```
$ DEMS_CORE_PORT=9999 node --import tsx apps/core-server/src/index.ts
{"level":"fatal","time":"2026-10-04T00:38:46.602Z","source":"index.config","code":"LISTEN_PORT_NOT_ALLOWED","message":"DEMS_CORE_PORT must be one of 4420, 4421, 4422, 4423.","errorName":"ConfigError"}
exit code: 1

$ DEMS_DEMO_CONTROLS=yes node --import tsx apps/core-server/src/index.ts
{"level":"fatal","time":"2026-10-04T00:38:46.741Z","source":"index.config","code":"DEMO_FLAG_INVALID","message":"DEMS_DEMO_CONTROLS must be 1 or 0.","errorName":"ConfigError"}
```

Both stop while the environment is parsed, before the connection file is opened. The entries they
wrote to `apps/core-server/logs/errors.log` (mode 600) were removed again with the file, so the
row leaves no log behind. The start path with a valid configuration (boot steps, then `listen`)
was **not** run: this row binds no port. It runs first in W58.

### 12.7 Test ledger (P24)

| Workspace, project | Before | After | This row |
|---|---|---|---|
| `@dems/core-server`, `unit` | 1 test in 1 file at step 25's state. When this row took its baseline (07:04:44) the tree also held W09's files in progress: 75 tests in 4 files | 330 tests in 17 files | **+255 tests in 13 files** |
| `@dems/core-server`, `db` | 0 | 0 | none |
| `@dems/shared`, `@dems/core-web`, `@dems/mobile`, `@dems/mock-core` | not written | not written | none |

New test files: `src/plugins/config/__tests__/load-config.test.ts` (46),
`src/plugins/logger/__tests__/log-capture.test.ts` (18),
`src/plugins/error-envelope/__tests__/error-envelope.test.ts` (28),
`src/plugins/response-headers/__tests__/response-headers.test.ts` (15),
`src/plugins/db/__tests__/db.test.ts` (17),
`src/plugins/readiness/__tests__/readiness.test.ts` (30),
`src/plugins/readiness/__tests__/incomplete-scaffold.test.ts` (3),
`src/modules/health/__tests__/health.test.ts` (11),
`test/static/credentials.test.ts` (13), `test/static/audit-protection.test.ts` (7),
`test/static/network.test.ts` (13), `test/static/logging.test.ts` (3),
`test/static/scaffold.test.ts` (51).

Expected total for the next gate of `@dems/core-server` `unit`: 1 (W03) + 255 (W08) + W09's
reported count.

### 12.8 Requirement to test

| Requirement | Where it is proven |
|---|---|
| SR-01 | `network.test.ts` (one listener, constant host); `readiness.test.ts` ("performs no listen") |
| SR-03 | `network.test.ts` (no global fetch, no outbound client) |
| SR-04 | `network.test.ts` (no CORS plugin, no CORS header); `response-headers.test.ts` (a preflight answers 405; no `access-control-` header for three origins) |
| SR-48 | `log-capture.test.ts` (redaction, no body, parse failure by code) |
| SR-49 | `log-capture.test.ts` (route pattern, exactly the fields); `logging.test.ts` |
| SR-50 | `error-envelope.test.ts` (500 has no detail, no stack, no SQL text) |
| SR-64 | `error-envelope.test.ts` (zod validation, unknown keys dropped, 65,536 bytes exact and one more) |
| SR-68 (loader) | `load-config.test.ts` (one file; role `dems_app`); `credentials.test.ts` |
| SR-75 (stage order) | `readiness.test.ts` (order; a refusal at each stage stops the later ones; the principal of stage 4 is visible at stage 5) |
| SR-76, AC-B-14 (headers, unit) | `response-headers.test.ts` |
| SR-77, AC-B-86 (server part) | `credentials.test.ts`; `load-config.test.ts` |
| SR-52 (T-AO-4) | `audit-protection.test.ts` |
| AC-B-08 | `health.test.ts`, with CONTRACT-GAP-1 |
| AC-B-58 | Section 12.4; no test of this row needs a database |
| AC-B-61 | Section 12.5 |

## 13. CONTRACT-GAP-1 (P12)

> **Closed on 2026-10-04 09:52** by the follow-up at the end of this document: the shared schema
> was widened by contract A, the local adapter file is removed and the marker is gone. The text
> below is the state at 07:45 and is kept as the record.

**What.** `packages/shared/src/api/health.ts` fixes `service` to the literal `dems-mock-core`
(lines 7 and 25) and has no `ready` member. The server answers `service: dems-core-server` and
`ready: { database, engine }` [SP:§7.4], so its answer does not validate against the shared
`HealthResponseSchema` as it stands.

**Local adapter**, inside this row's folder: `modules/health/health-schema.ts` defines
`CoreServerHealthSchema = HealthResponseSchema.extend({ service: z.literal('dems-core-server'), ready: … })`.
Every other member stays the shared definition, so the two cannot drift, and the local schema
keeps working unchanged after the shared one is widened.

**Exact change needed, by the contract owner (W19):**

```ts
// packages/shared/src/api/health.ts
export interface HealthResponse {
  status: 'ok';
  service: 'dems-mock-core' | 'dems-core-server';
  …
  ready?: { database: boolean; engine: boolean };
}
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.enum(['dems-mock-core', 'dems-core-server']),
  …
  ready: z.object({ database: z.boolean(), engine: z.boolean() }).optional(),
});
```

**Self-closing test.** `health.test.ts` asserts today that the answer, with `service` put back to
mock-core's name, is a valid shared `HealthResponse`. It also holds an assertion that takes effect
by itself once the shared schema accepts the server's name: the answer must then validate against
`HealthResponseSchema` as it is (AC-B-08). No file of this row needs an edit then.

Two more places where the server already follows the specification and the shared contract
follows later. Neither blocks anything, and both are W19's planned work:

- **Constants.** `CORE_SERVER_HOST`, `CORE_SERVER_PORT`, `CORE_SERVER_HTTP_ORIGIN`,
  `CORE_SERVER_WS_URL`, `CORE_SERVER_SERVICE_NAME` do not exist yet in
  `packages/shared/src/api/constants.ts`. `config.ts` holds the server's values. `config.ts` is
  frozen after this row, so `load-config.test.ts` compares the two as soon as the shared names
  exist: the values must be `127.0.0.1`, `4420`, `http://127.0.0.1:4420`,
  `ws://127.0.0.1:4420/ws`, `dems-core-server`.
- **Error envelope.** The server sends `error.details` and `error.requestId`. `ApiErrorSchema`
  accepts such a body today (zod drops unknown keys) and gains the two optional members in W19.

## 14. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | **SA-01 holds**: Fastify runs `onRequest` before it reads the body. A refusal there wins over malformed JSON, over a body above the limit and over a schema failure | `error-envelope.test.ts` | The guards stay in `onRequest`; no fallback needed |
| F-2 | **SA-13 holds with one difference**: helmet 8.3.0 writes the policy without a space after the semicolon | Probe; section 9 | The `onSend` hook states the text of OR-9 |
| F-3 | Fastify 5.12.5 deprecates the top-level option `disableRequestLogging` (warning FSTDEP023) and offers `logController` with a class to extend | `node_modules/fastify/lib/log-controller.js`; the probe printed the warning | The server uses `logController`. It is the framework's own extension point for the request lines |
| F-4 | **A leak that the first version of the log test caught.** When an error is logged without a text, the logger makes the error's own message the log message. Fastify does exactly that for a handler that answers twice, and that message quotes the raw URL with its query string. A custom `err` serializer does not prevent it | First run of `log-capture.test.ts`: the query marker was in the log | A log-method hook gives such a line the fixed text "error". The test now passes at level `trace` |
| F-5 | Fastify's defaults accept a `text/plain` body and hand it to the handler as a string, and accept a JSON array or scalar | Probe | The default parsers are removed; the JSON parser refuses a non-object |
| F-6 | In the sandbox, connecting to a closed loopback port fails with `EPERM`; outside it, with `ECONNREFUSED` | Probe; section 12.2 | None: both are "the database does not answer". The test accepts either |
| F-7 | Fastify answers a URL it cannot decode without running any hook and without a completion log line | Probe | `frameworkErrors` sets the five headers and writes the request line itself |
| F-8 | A hook that a plugin adds after the stage hook runs after all five stages; `onClose` hooks run in reverse order, `preClose` hooks in order | Probe | Section 4; the pool closes last; a `preClose` hook of the engine runs before the realtime channel's |
| F-9 | `fastify-plugin` is not a dependency of `@dems/core-server` (it is present only as a dependency of the plugins) | `apps/core-server/package.json` | `app.ts` marks its units with Fastify's documented `skip-override` property instead (decision DN-4) |
| F-10 | Importing types from `@dems/shared/sim` type-checks under the server's `tsconfig.json` (no DOM library) | Workspace typecheck, exit 0 | Useful for W26: the simulator's types are usable in the server |
| F-11 | W11 began to write `apps/core-server/test/helpers/db/` while this row ran. The static guards passed with its files present at 07:41 | `find apps/core-server` | None |
| F-12 | An unexpected failure is logged with its name, code and stack frames and **without its message**. A driver's or a parser's message can quote the input (SA-12) | Section 8 | Debugging uses the request ID, the route pattern, the code and the frames. Recorded as a trade-off |

## 15. Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | **A tenth seam, `denialBudget`**, owner W23 | ID-P13 says the counter is "consumed when a refusal row is written". The rows that write those rows (W24, W28, W32, W41) are not the row that owns the counter (W23). P25 has no seam for that call, and after this row nobody may add one to `app.ts`. The stub counts nothing |
| DV-2 | The scaffold has decorators of its own beside the seams: `config`, `errorLog`, `db`, `seams`, `stages`; the request decorator `principal`; the route config `operationId` | The pool, the configuration and the persistent error log must be reachable by every unit. `principal` carries stage 4's result to stages 5 and 6 and to the log. `operationId` lets stage 2 exempt health and gives W28 the operation of a route |
| DV-3 | The `onSend` hook sets `Content-Security-Policy` as well as `Cache-Control` | SA-13's fallback; section 9 |
| DV-4 | The static tests follow the database contract's wording, which has exceptions, not "nowhere under `src/`": the owner-role file may be named in `src/db/reset/` and `src/db/commands/`; the trigger-skipping setting in `test/db/`; a database drop in the reset routine and the test helper | T-CR-2 (c), T-AO-4. A stricter test would fail W17, W11 and W29, which need those texts. Today, with no `src/db/`, both readings give the same result. The scaffold's own files are checked without exception |
| DV-5 | `plugins/config` and `plugins/logger` export functions, not Fastify plugins | Both act before the Fastify instance exists (the logger is a constructor option). `config` is decorated by the factory |
| DV-6 | The loader also requires the role `dems_app` | SR-68, HC-4. `createConfig` does not check the role, so T-PV-3 can still start an app with the owner role and reach boot check B-4 |
| DV-7 | A test-support module, `src/plugins/config/__tests__/test-config.ts`, is offered to other rows (`unitTestConfig`, `captureLog`, `createFakePool`) | Every database-free test of the server needs the same three things |
| DV-8 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (CLAUDE.md §3.4, P8) |
| DV-9 | Guards beyond the row's list were added: no console call, no raw-URL read, the environment only in the entry point, no outbound client, no child process in the runtime, the shape of the scaffold | Each traces to a requirement (section 11). They fail with the path and line of the offence |

## 16. Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | Accept `denialBudget` as a seam of P25 (DV-1)? | Accept, and tell W23 that it owns it and W24, W28, W32, W41 that they call `app.denialBudget.consume(request)` after writing a refusal row |
| DN-2 | **Which row registers the boot checks B-2 to B-9?** W17 writes them, but W17 owns no unit that `app.ts` registers. The seam exists: `app.readiness.addBootStep`. B-1 is already registered by the pool plugin | W17 exports one function from `src/db/`; **W21 (`core`) registers it as boot steps**, because `core` is the first unit after the pool and depends on W17. W26 registers the epoch and rehydration step and sets `ready.engine`. W17's own test T-PV-3 can add the steps to an app itself |
| DN-3 | Pass to W24: `@fastify/cookie` is already registered; `Principal` and `ANONYMOUS_PRINCIPAL` must stay exported from `plugins/authenticate/index.ts`. Pass to W23, W24: tests need `app.readiness.set('engine', true)` until W26 lands. Pass to W42: register `@fastify/websocket` at root scope in `realtime/index.ts`; health reads `app.websocketServer.clients.size` | Add to the briefs of W21, W23, W24, W26, W28, W32, W42 together with section 6 |
| DN-4 | The units are registered at root scope through Fastify's `skip-override` property, which the Fastify documentation describes and calls "not recommended" next to `fastify-plugin` | Keep it: it is one helper of eight lines in a frozen file, against a pinned Fastify. The alternative is to add `fastify-plugin` to the manifest in a later npm slot and to edit `app.ts` once |
| DN-5 | The server writes `apps/core-server/logs/errors.log` (git-ignored, mode 0600) when it is started through `index.ts` | Add it to the Host Impact Register beside H-11, and to the files W58 and W90 check with `stat` |

A question that needs no decision now, for the record: the server's loader refuses only port 5432
for the database, as this row's brief says, while `scripts/pg/lib.mjs` accepts exactly 4432. Both
are satisfied by the provisioned file.

## 17. Rollback (R-NEW; not executed)

Every path of this row is new and untracked. Shared folders are named by file, so the files of
W09 (`password-hash/`) and W11 (`test/helpers/db/`) are not touched.

```sh
cd /Users/gsp-budi/Documents/DEMS
git clean -fd -- \
  apps/core-server/src/index.ts apps/core-server/src/app.ts apps/core-server/src/config.ts \
  apps/core-server/src/plugins \
  apps/core-server/src/core apps/core-server/src/engine apps/core-server/src/realtime \
  apps/core-server/src/modules/health \
  apps/core-server/src/modules/identity/index.ts \
  apps/core-server/src/modules/rbac apps/core-server/src/modules/admin \
  apps/core-server/src/modules/pairing apps/core-server/src/modules/sessions \
  apps/core-server/src/modules/evidence apps/core-server/src/modules/devices \
  apps/core-server/src/modules/storage apps/core-server/src/modules/network-time \
  apps/core-server/src/modules/security-audit apps/core-server/src/modules/system \
  apps/core-server/src/modules/alerts apps/core-server/src/modules/demo \
  apps/core-server/test/static
rm -f apps/core-server/logs/errors.log apps/core-server/logs/errors.1.log
```

This is valid only while no later row has replaced a stub: `src/plugins`, `src/core`,
`src/engine`, `src/realtime` and the module folders become other rows' folders. After that the
rollback of this row is P23 for the stubs (`.cache/rollback/W08.pre.patch` is empty: remove the
stub) and the list above without those folders. After the rollback `npm run test -w
@dems/core-server` runs W03's and W09's tests again, and the `dev` and `start` scripts have no
entry file.

## Follow-up: touch-ups after contract A and the request guards

Controller follow-up to step 30, after acceptance (D40). Three touch-ups in this row's own files,
each found by a later row. Done on 2026-10-04 between 09:45 and 09:53 WIB. Project `unit` only:
no port, no database, no server started, no file of another row edited, and `app.ts`, `index.ts`
and `config.ts` untouched.

State found at 09:46:28, before any change: `unit` 979 passed in 31 files. The edits that the
request-guard row made to two of this row's tests under ruling D52 are kept as they were
(`readiness.test.ts`; in `log-capture.test.ts` the three guard stages replaced by no-ops in the
set-up).

### F.1 The health adapter is gone (CONTRACT-GAP-1 closed)

Contract A widened the shared `HealthResponseSchema`: `service` is
`z.enum(['dems-mock-core', 'dems-core-server'])` and `ready` is an optional object
(`packages/shared/src/api/health.ts`; `implementation/19_contract_a.md`, finding F-8).

| Change | File |
|---|---|
| The route validates and serialises its answer through the shared `HealthResponseSchema` directly | `src/modules/health/index.ts` |
| **Removed**: the local schema file with `CoreServerHealthSchema` and `ReadySchema`. Its only importers were the module and its test | `src/modules/health/health-schema.ts` |
| Kept, as a type only: `CoreServerHealth = HealthResponse & { service: 'dems-core-server'; ready: … }`. It is not a schema: it makes the handler unable to forget `ready`, which the shared type leaves optional for mock-core | `src/modules/health/index.ts` |
| The test that "activates by itself" is now the plain assertion: the answer parses with the shared schema as it stands, the parse drops nothing (`parse(body)` equals `body`), and the strict form of the schema accepts it. One new test holds the server to sending `ready`, because the schema alone no longer does | `src/modules/health/__tests__/health.test.ts` (12 tests, was 11) |
| The same kind of self-activating comparison for the constants `CORE_SERVER_HOST`, `_PORT`, `_HTTP_ORIGIN`, `_WS_URL`, `_SERVICE_NAME` is now a plain assertion as well: all five exist in the shared contract and equal the values of `config.ts` | `src/plugins/config/__tests__/load-config.test.ts` (46 tests, unchanged) |

The marker is gone from the code:

```
$ grep -rn "CONTRACT-GAP-1" apps/core-server packages/shared/src
(no output)
```

### F.2 Static guard: the setting that makes the PostgreSQL log quote bound parameters

The migration row found that one of the logging settings of NL-5 has the context `user`: any
role may set it for its own session, and the parameters of a failed statement (a token hash, a
code hash) would then be written to the server log (`implementation/17_db_schema_migrations.md`,
F-4, DN-5).

`test/static/audit-protection.test.ts` now forbids the name of that setting under
`apps/core-server/`, with the exception policy of the trigger-skipping setting: it may appear
only under `test/db/`. As everywhere in these tests the name is built from fragments, the search
is case-insensitive and covers comments, and a positive control shows that the scanner finds it
in a `.ts` file, a `.sql` migration and `drizzle.config.ts` (2 new tests; the file has 9).

What the scan reads in the other rows' folders, and where the name occurs (one-off run at 09:49):

```
src/db/schema/              14 files read, 0 occurrences
src/db/migrations/           9 files read, 0 occurrences
src/db/commands/             7 files read, 0 occurrences
src/db/mapping/              0 files read, 0 occurrences      (being written by another row)
src/db/seed/                 0 files read, 0 occurrences      (being written by another row)
src/core/                    1 files read, 0 occurrences
test/helpers/db/            45 files read, 0 occurrences
test/db/                    16 files read, 2 occurrences
drizzle.config.ts            1 files read, 0 occurrences
test/global-setup.db.ts      1 files read, 0 occurrences
all occurrences under apps/core-server:
  test/db/pg-behaviours.db.test.ts:140
  test/db/pg-behaviours.db.test.ts:148
```

So the migration writer's sources, the commands and the test helper pass. One correction to the
brief's wording: the name **is** used once, by the migration row's own database test
`test/db/pg-behaviours.db.test.ts`, which reads `pg_settings` and asserts that the setting is at
its default `0`. That is inside the exception, and it is exactly the kind of use the exception is
for. No program sets it.

### F.3 The log test searches for a credential value, not for the word

`log-capture.test.ts` proved "no bearer credential is logged" with
`expect(text).not.toContain('Bearer')`. The Origin guard's refusal line has a field named
`hasBearer`, so that search would fail on a clean log as soon as a log test provokes an Origin
refusal with the guard active.

| Change | File |
|---|---|
| New test support, `credentialLeaks(text)`: reports what has the **shape** of a credential. Four patterns: the scheme `Bearer` followed by white space and a value; the scheme in any case followed by a token of this server; a token by its prefix, `ses_`, `dvc_` or `bio_`; a session cookie with its value (`dems_session_<port>=…`). Each entry names a kind and a line, never the value. Additive: the three existing exports that other rows import are unchanged | `src/plugins/config/__tests__/test-config.ts` |
| The requests now carry credentials shaped as the clients send them: `Bearer ses_…` together with the session cookie on four requests, `Bearer dvc_…` on one, a `bio_…` token in one body. The bare-word search and the cookie-pair search are replaced by `expect(credentialLeaks(text)).toEqual([])`. The eight markers and the `token=` search stay | `src/plugins/logger/__tests__/log-capture.test.ts` |
| Three new tests (the file has 21, was 18): the search finds each kind in a planted text; it does not take a field name (`hasBearer`), a code, the cookie name or a sentence for a credential; and, end to end, an app that deliberately logs the headers and the body it received under keys the redaction does not know is caught, while a guard-shaped line beside it is not | the same file |

**Proof that the test is at least as strong** (mutation runs, 09:51). Eight scratch copies of the
test file were run with Vitest outside the repository (a scratch folder with its own config and a
link to `node_modules`; nothing in the repository was mutated, so no other row saw a red test).
Each copy adds one log line to the "by hand" route. "Old search" is the copy with the previous
assertion put back.

| # | Line added to the route | Search | Result of the copy | Meaning |
|---|---|---|---|---|
| 0 | none (control) | new | 21 of 21 pass | |
| 1 | the `Authorization` header under an unknown key | new | **fails**: marker found | A real leak is caught |
| 2 | a bearer value that holds none of the file's markers | new | **fails**: `bearer value in line 9`, `token in line 9` | Caught where the markers cannot see it |
| 3 | a `dvc_` token in a body field, no scheme word before it | new | **fails**: `token in line 9` | Caught |
| 4 | `{ code: 'ORIGIN_NOT_ALLOWED', hasCookie: true, hasBearer: true }` | new | 21 of 21 pass | No false alarm on the field name |
| 5 | as 2 | old | fails: contains `Bearer` | The old search caught it too |
| 6 | as 3 | old | **21 of 21 pass** | The old search **missed** this leak |
| 7 | as 4 | old | **fails**: contains `Bearer` | The old search's false alarm |

```
 Test Files  5 failed | 3 passed (8)
      Tests  5 failed | 163 passed (168)
```

Rows 1 to 3 against 5 and 6: every leak the old search caught is still caught, and one more is.
Rows 4 and 7: the false alarm is gone.

And the real guard, active, in-process (a scratch script; a request with a foreign `Origin` and a
bearer value):

```
status 403 ORIGIN_NOT_ALLOWED
guard line: {"level":40,"reqId":"…","code":"ORIGIN_NOT_ALLOWED","route":"/api/v1/scratch","kind":"COMMAND","category":"OTHER","hasCookie":false,"hasBearer":true,"origin":"http://evil.example","msg":"request refused by the Origin guard"}
the token is in the log: false
old search  text.includes("Bearer"): true => the old assertion would FAIL on a clean log
new search  credentialLeaks(text): [] => the new assertion passes
```

Limits of the search, stated so that nobody relies on more: the scheme without a token prefix is
matched in its usual spelling `Bearer` only, so that a sentence with the word "bearer" in a log
message is not reported; a value sent as `bearer <opaque>` in lower case without one of the three
prefixes is found by a test's own markers, not by this search.

### F.4 Verification

Two runs in a row. Other rows were writing `src/core/` and `src/db/` at the time; neither run
showed a failure, so there is no noise to record.

```
$ npm run test -w @dems/core-server -- --maxWorkers=2          (09:52:01)
 Test Files  31 passed (31)
      Tests  985 passed (985)
   Duration  2.53s
exit 0

$ npm run test -w @dems/core-server -- --maxWorkers=2          (09:52:16)
 Test Files  31 passed (31)
      Tests  985 passed (985)
   Duration  2.64s
exit 0

$ npm run typecheck -w @dems/core-server
> tsc --noEmit
exit 0

$ npm run lint -w @dems/core-server
> oxlint
exit 0
```

| Ledger, `@dems/core-server` `unit` | Before the follow-up | After |
|---|---|---|
| Whole project | 979 tests in 31 files | **985 tests in 31 files** |
| This row's 13 test files | 255 | 261 |
| `src/modules/health/__tests__/health.test.ts` | 11 | 12 |
| `test/static/audit-protection.test.ts` | 7 | 9 |
| `src/plugins/logger/__tests__/log-capture.test.ts` | 18 | 21 |

No test file was added or removed; one source file was removed. The project `db` was not run
(no database in this follow-up); the workspace typecheck, which covers its files, is clean.
`git diff --stat acaff20 -- apps/mock-core release scripts/release` still prints nothing.

### F.5 Observed, not changed

| ID | Observation | Suggestion |
|---|---|---|
| FU-1 (ruled by D55: send it; see F.6) | Contract A pins a response header name, `x-request-id`, and documents it "on every answer" of a Core-server operation; the envelope's `requestId` is described as "the same value as the `x-request-id` header". **The server sends no such header.** It sends the ID in `error.requestId` only, so a success answer carries no request ID. The typed client falls back to the envelope member, so nothing is broken today | A decision for the controller. If the header is wanted, it is one line in the `onSend` hook of `src/plugins/response-headers/index.ts` and one line in its test's list of expected headers, both files of this row. Not done here: it was not asked, and it changes what every answer carries |
| FU-2 | The rollback of section 17 and the tree of section 3 name `health-schema.ts`; the file no longer exists | None needed: `git clean` and `rm -f` ignore a missing path |

### F.6 The `x-request-id` header (ruling D55): prepared, proven, then applied under ruling D57

> **Applied at 10:02:52 WIB under ruling D57; the result is at the end of this section.** The
> text down to "Decision needed" is the state at 10:02, before the ruling, kept as the record.

**Status of this item at 10:02: needs-review.** FU-1 was ruled: the server sends `x-request-id` on every
answer. The change is written and proven, but it cannot go into the tree with this row's two
files alone, so it was taken out again and is stored as a patch.

**Why.** The request-guard row's test support,
`src/plugins/origin-guard/__tests__/guard-test-app.ts`, has its own copy of this row's "the five
headers and nothing else" assertion (`expectResponseHeaders`, lines 31 and 142 to 145, with a
local list of allowed header names). Its three test files call it on every answer. With the
header sent, 97 of that row's tests fail, every one with the same message. That file is another
row's, and this follow-up may not edit it (P6; the precedent for such an edit is a ruling, D52).

| Run | What was run | Result |
|---|---|---|
| A, 09:55:23, in the tree | The plugin change alone, the whole `unit` project | exit 1: **107 failed**, 878 passed (985). 97 in `origin-guard.test.ts` (85), `throttle.test.ts` (8), `denial-budget.test.ts` (4); 10 in this row's own header test, which still said "nothing else". The only message: `AssertionError: expected [ 'x-request-id' ] to deeply equal []` |
| | **The plugin was put back at 09:57:50.** From 09:55:13 to 09:57:50 the shared `unit` project was red because of this row. A row that ran its gate in that window saw those failures: they are this row's noise, not a defect of the guards |
| B, 09:59:36, outside the tree | The whole `unit` project of the repository, read-only, with two modules swapped by a Vitest alias in a scratch config: the plugin with the header, and a copy of the guard helper with its two-line change | exit 0: **970 passed in 30 files** (this row's old header test left out) |
| C, 09:59:25, outside the tree | This row's new header test against the plugin with the header | exit 0: **28 passed** (15 before) |
| D, 09:59, outside the tree | As B, but with the guard helper as it is in the repository | exit 1: 97 failed, 873 passed; the same three files, the same one message |

B and C together are the project as it will be: **998 tests in 31 files, all passing.**

**The patches** (both apply cleanly: `patch --dry-run -p1` from the workspace root, 10:00):

| File | Changes | Whose files |
|---|---|---|
| `implementation/assets/08_x_request_id_scaffold.patch` | `plugins/response-headers/index.ts`: the `onSend` hook and `applyResponseHeaders` (the answer to an undecodable URL passes no hook) set `REQUEST_ID_HEADER_NAME`, imported from `@dems/shared/api`, to `request.id`: the ID the error envelope carries, on successes too. `__tests__/response-headers.test.ts`: 28 tests. Each of the ten kinds of answer carries the header beside the five and nothing else; on an error it equals `error.requestId`, on a success there is no envelope; the value is a non-empty string (the contract's format) and a version-4 UUID (the server's); exactly one request line of the log has it as `reqId`, with the answer's status. Negative test: a caller sends `x-request-id`, `request-id` and `x-correlation-id` and the same value in the path, the query and the body; no answer (200, 409, 404, 400) returns it under any header name, the header stays a UUID, and the log does not hold the caller's value. Fifty requests get fifty different IDs | this row's |
| `implementation/assets/08_x_request_id_guard_helper.patch` | `guard-test-app.ts`: import `REQUEST_ID_HEADER_NAME`; add it to the local list `TRANSPORT_HEADERS`. Two lines | the request-guard row's (W23) |

To apply, once the second patch is allowed:

```sh
cd /Users/gsp-budi/Documents/DEMS
patch -p1 < docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/08_x_request_id_scaffold.patch
patch -p1 < docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/08_x_request_id_guard_helper.patch
npm run test -w @dems/core-server -- --maxWorkers=2     # expected: 999 passed in 31 files
```

(999, not 998: one test was added to the log test after runs B and C, see below.)

**Done now, in the tree: the log part of the ruling.** The request ID is already the correlation
key of the request log line: Fastify binds it as `reqId` to every line a request writes, and the
line of SR-49 has it. `log-capture.test.ts` now asserts it (22 tests, was 21): every `reqId` is a
UUID and no two requests share one; each of the five error answers names, in `error.requestId`,
the `reqId` of exactly one request line with its status; the "unexpected error" line of the 500
carries the same key.

**The repository as it stands** (the header not applied):

```
$ npm run test -w @dems/core-server -- --maxWorkers=2          (10:00:59 and 10:01:01)
 Test Files  31 passed (31)
      Tests  986 passed (986)
exit 0, twice
$ npm run typecheck -w @dems/core-server      exit 0
$ npm run lint -w @dems/core-server           exit 0, no warning
```

Neither of these two runs, nor the one at 10:00:43, showed a failure from the rows that were
writing `src/core/` and `src/db/` at the time.

**Decision needed.** Allow the two-line change in `guard-test-app.ts` as a recorded by-design
change (the mirror of D52), then apply both patches: by this agent, by the request-guard row's
agent, or by anyone, since the patches are fully specified. A lasting alternative to the second
patch: that helper imports the allowed list from one place instead of holding a copy; the header
names of contract A (`x-request-id`, `x-dems-epoch`, `x-dems-revision`) will otherwise meet the
same copy again when a guard test calls an operation that sends them.

#### Applied (ruling D57), 10:02:52 WIB

Ruling D57 allowed the change in the request-guard row's test helper as a recorded by-design test
change, the mirror of D52. Both patches were applied together, as stored, with no hand merge.

| Step | Evidence |
|---|---|
| Pre-images of the three files | `.cache/rollback/W08c.response-headers.index.ts.pre`, `.cache/rollback/W08c.response-headers.test.ts.pre`, `.cache/rollback/W08c.guard-test-app.ts.pre`; the SHA-256 of each equals its file's before the apply (`bd9460ce…`, `d44ffa2b…`, `ff7f0d3a…`) |
| Baseline just before, 10:02:37 | 986 passed in 31 files, exit 0 |
| Dry run of both patches | exit 0 and exit 0; no file had moved |
| **Apply window** | **start 10:02:52.729 WIB, end 10:02:52.747 WIB** (18 ms, one shell command, the two patches back to back); exit 0 and exit 0; no `.orig`, no `.rej` |
| After | The three files are byte-equal (`cmp`) to the versions that runs B and C proved outside the tree |

A gate of another row that started its test run inside those 18 ms could have loaded the plugin
with the header and the helper without it. Outside that window there was no red state.

**The edited lines of `apps/core-server/src/plugins/origin-guard/__tests__/guard-test-app.ts`.**
Three lines, not two: the stored patch also rewords the comment directly above the list. Section
F.6 above and this row's last report called it "two lines"; that undercounted by the comment
line. Nothing else in the file changed (`diff` against the pre-image shows exactly these).

| Line | Before | After |
|---|---|---|
| `guard-test-app.ts:9` | `import { ApiErrorSchema, CREDENTIAL_CONFLICT_REASON } from '@dems/shared/api';` | `import { ApiErrorSchema, CREDENTIAL_CONFLICT_REASON, REQUEST_ID_HEADER_NAME } from '@dems/shared/api';` |
| `guard-test-app.ts:30` (comment) | `/** What a response may carry besides the five headers of OR-9 (the scaffold's own list). */` | `/** What a response may carry besides the five headers of OR-9: the request ID (decision D55), and the scaffold's own list. */` |
| `guard-test-app.ts:31` | `const TRANSPORT_HEADERS = ['content-type', 'content-length', 'date', 'connection', 'allow', 'retry-after'];` | `const TRANSPORT_HEADERS = [REQUEST_ID_HEADER_NAME, 'content-type', 'content-length', 'date', 'connection', 'allow', 'retry-after'];` |

If the ruling is read as the two code lines only, line 30 can be put back from the pre-image; it
is a comment and no test depends on it.

**Verification after the apply.**

```
$ npm run test -w @dems/core-server -- --maxWorkers=2          (10:03:01)
 Test Files  31 passed (31)
      Tests  999 passed (999)
   Duration  2.29s
exit 0
                                                               (10:03:27)  31 passed, 999 passed, exit 0
                                                               (10:03:40)  31 passed, 999 passed, exit 0

$ npm run typecheck -w @dems/core-server                       (run 1, about 10:03:04)
src/core/clock.ts(14,27): error TS2307: Cannot find module './errors' or its corresponding type declarations.
exit 2
$ npm run typecheck -w @dems/core-server                       (run 2, 10:03:25)
> tsc --noEmit
exit 0
                                                               (run 3, 10:03:38)  exit 0

$ npm run lint -w @dems/core-server                            (right after typecheck run 1, and 10:03:38)
> oxlint
exit 0, no warning, both times
```

The one failure is noise from the core-services row, mid-edit, in its own folder: it wrote
`src/core/clock.ts` at 10:02, which imports `./errors`, and `src/core/errors.ts` at 10:03. The
first typecheck fell between the two; the next two are clean. No file of this follow-up is
involved. That row has added no test file yet, so the total is exactly the expected 999.

| Ledger, `@dems/core-server` `unit` | Before the apply | After |
|---|---|---|
| Whole project | 986 tests in 31 files | **999 tests in 31 files** |
| `src/plugins/response-headers/__tests__/response-headers.test.ts` | 15 | 28 |
| The request-guard row's files (`origin-guard.test.ts` 151, `throttle.test.ts` 27, `denial-budget.test.ts` 24) | all pass | all pass, counts unchanged |

Every answer of the Core server now carries `x-request-id`: the server's own UUID for the request,
equal to `error.requestId` of an error envelope and to `reqId` of the request's log lines, on
successes too, and never a value taken from the request.

Rollback of this change, if ever needed (not executed): copy the three pre-images back over
`src/plugins/response-headers/index.ts`, its `__tests__/response-headers.test.ts` and
`src/plugins/origin-guard/__tests__/guard-test-app.ts`; the project is then at 986 in 31 files.

---
*Generated: 2026-10-04 07:45 WIB*
*Last Updated: 2026-10-04 10:04 WIB*
