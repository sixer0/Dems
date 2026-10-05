# CP-B1 — Checkpoint Review of the Backend Foundation (step 60, plan row W38)

- **Task:** DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing
- **Date:** 2026-10-04, 14:16 to 14:40 WIB
- **Reviewer:** senior-code-reviewer (read-only; no source file edited)
- **Scope:** `apps/core-server` foundation rows W08, W17, W20, W21, W23, W24, W28, with W09, W11 / W11b, W25, W26, W29 (the controller's extension)
- **Verdict:** **PASS WITH FIXES**
- **Open blockers:** **1** (CPB1-1, owning row W28). It must be closed before the backend gate (step 80, W58).
- **Findings:** 1 Blocker, 2 High, 10 Medium, 9 Low, 4 Info (26 in all)

Tier 2 document: each finding states what was found, why it matters, how it was verified and where it is in the source.

---

## 1. Method and limits

**Read in full (production):** `src/app.ts`, `src/index.ts`, `src/config.ts`; every file of `src/plugins/{config,logger,error-envelope,response-headers,db,readiness,origin-guard,authenticate,throttle,permission-guard}/`; every file of `src/core/`; `src/engine/{index,host,errors,actor-scope,scheduler,timer,write-plan,rehydrate,headless-sim}.ts`; `src/modules/identity/{index,routes,cookie,tokens,console,sweeper,limits,lockout,sessions,sign-in,activity}.ts` and the first 140 lines of `session-store.ts`; `src/modules/{rbac,health,pairing (stub)}/index.ts`; `src/realtime/index.ts`; `src/db/seed/store.ts`; `src/db/mapping/{index,rbac,audit-verify}.ts`; `src/db/commands/{database-names,create}.ts`; `src/db/reset/names.ts` (lines 100 to 194) and `routine.ts` (lines 1 to 45, 300 to 350, 430 to 560, 1052 to 1068); `src/db/schema/{value-sets,public-columns}.ts`.

**Read in part or by search only:** `src/db/mapping/{rows,changes,to-rows,from-rows,slices,guards}.ts`, `src/db/schema/` table files and `boot-checks.ts`, `src/db/fixtures/`, `src/db/seed/seed.ts`, `src/db/commands/{cli,migrate,migrations,status,owner-connection}.ts`, `src/modules/identity/password-hash/`, `src/engine/{ring,delta,hosted-actions,types,limits}.ts`, the test helper `test/helpers/db/` (searched for statements, names and `pg_stat_activity`), the migrations (searched).

**Tests read:** `plugins/permission-guard/__tests__/{static,guard}.test.ts` (parts), `test/static/{logging,scaffold,network}.test.ts`, the lines of every test file that reads `pg_stat_activity` or `pg_locks`, the tests that pin lists.

**Documents:** decisions D12, D28, D52, D62, D67, D72, D77, D78, D82, D83; findings F38, F40, F53, F60 to F64; `gateway_check/01_gate_report.md` (M1 to M13); spec §2.3, §2.4, §13; database contract MR-1, NL-1 to NL-8; the sections "For the code review (W38)" of `21_core_services.md` §18, `26_engine_host.md` §21 and `28_rbac_guard_pipeline.md` §9, §17 DN-6, DN-8.

**Installed packages read to verify a claim:** `node_modules/drizzle-orm/errors.js`, `node_modules/pg/lib/{query,client,connection-parameters}.js`.

**Commands run (all from the workspace root, no `cd`):** see section 2. No `test:db`, no `db:*`, no `pg:*`, no connection to PostgreSQL, no port bound. Scratch files only under `$TMPDIR`, removed at the end (only the files this review created).

**Context graph:** `graft/` exists; the import map of section 4 was built with one script over the sources (every relative import of every file), which gives the same edges with file and line.

**Labels used:** "reproduced" = seen in a command's output in this review; "by reading" = concluded from the source, not executed. Everything that touches PostgreSQL is "by reading".

**In-flight noise.** Six module rows wrote under `src/modules/{pairing,admin,sessions,evidence,devices,storage,network-time}/` during the review. Their folders are out of scope. They are quoted only where they show a consequence of the foundation, and each such quote is marked "in flight".

---

## 2. Evidence of the runs

| Time (WIB) | Command | Result |
|---|---|---|
| 14:22:37 | `npm run typecheck -w @dems/core-server` | exit 0 |
| 14:22:40 | `npm run lint -w @dems/core-server` | exit 0, no warning |
| 14:22:43 | `npm run test -w @dems/core-server -- --maxWorkers=2` | `Test Files 77 passed (77)`, `Tests 1992 passed (1992)`, exit 0 — equal to the controller's baseline of 14:11 |
| 14:31:38 | scratch vitest run of one probe (logger options of the server + the installed `DrizzleQueryError`) | output quoted in CPB1-2 |
| 14:32:09 | same command with `src/plugins/permission-guard/__tests__/guard.test.ts` | `Tests 18 failed \| 11 passed (29)`, exit 1 |
| 14:32:37 | whole `unit` project again | `Test Files 3 failed \| 80 passed (83)`, `Tests 20 failed \| 2148 passed (2168)`, exit 1 — all three files are W28's (CPB1-1) |
| 14:35:25 | typecheck, lint again | typecheck exit 2: one error, `src/modules/admin/__tests__/rule.test.ts(11,127)` TS2345 (in flight, W33). Lint: two warnings, both in `src/modules/admin/__tests__/` (in flight). No error and no warning in a foundation folder |

Every run prints many lines `ERROR: failed to copy trust settings of system certificate`: the sandbox refusing the keychain. They are not test output.

---

## 3. Verdict per dimension

| # | Dimension | Verdict | Findings |
|---|---|---|---|
| 1 | Structure and boundaries | CAUTION | CPB1-5, 10, 11, 20 |
| 2 | One mapping, one chain | PASS | CPB1-19 (two small constants) |
| 3 | Duplication across the pipeline | CAUTION | CPB1-7, 8, 16, 17, 19 |
| 4 | Error handling and failure paths | CAUTION | CPB1-2, 6, 7 |
| 5 | Security-relevant code quality | CAUTION (pointers for W45) | CPB1-2, 3, 4, 5, 23 |
| 6 | Dependency hygiene | PASS (clean) | none |
| 7 | Reuse of the contract | PASS with comments | CPB1-9, 18 |
| 8 | Tests as infrastructure | **FAIL until CPB1-1 is closed** | CPB1-1, 12, 13, 14, 15 |
| 9 | Open design questions | answered | section 7 |

What "clean" means for dimension 6: `package.json` against every bare import of `src/` and `test/` (script over all files). Used and declared: `@dems/shared`, `fastify`, `fastify-type-provider-zod`, `@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`, `drizzle-orm` (public subpaths `node-postgres`, `pg-core`, `node-postgres/migrator` only), `pg`, `rate-limiter-flexible`, `tsx` (the launcher of the scripts), `drizzle-kit`, `vitest`. Declared and not imported, each with a recorded reason: `@fastify/swagger`, `openapi-types`, `zod` (peers of the zod provider; `masterplan/02_plan.md` §3.1, lines 289 to 290, "installed, not registered"), `@fastify/websocket`, `ws`, `@types/ws` (the realtime row W42), `react` (see section 7.8). Used and not declared: none. No import of `pg-pool`, of a `fastify/lib/…` path or of a `@fastify/*` internal. No `any`, no non-null assertion, no `@ts-ignore` / `@ts-expect-error`, one `eslint-disable-next-line` in a test (`test/db/contract-inventory.test.ts:235`). Casts in production: `as never` four times (`src/db/seed/store.ts:134`, `:343`; `src/db/fixtures/load.ts:84`) and `as unknown as` for the Drizzle client shim (`src/core/unit-of-work.ts:316`, `:330`), each with its reason beside it.

---

## 4. Findings

Owner = the plan row whose files hold the fix. "Before" = the latest row by which it should be closed.

### 4.1 Blocker

#### CPB1-1 — The guard row's own tests pin which operations are registered; they are red since the module rows register routes (Blocker; owner W28; before W58, in practice now)

**Reproduced.** 14:22:43: unit project green (77 files). 14:32:37, after the module rows in flight had registered routes: 3 files, 20 tests red, all owned by W28:

| File | Red | Cause |
|---|---|---|
| `src/plugins/permission-guard/__tests__/guard.test.ts` | 18 of 29 | `:131` `REGISTERED_NOW` is a fixed list of 7 operation IDs, compared with `toEqual` at `:139` (`expected [ 'getServiceHealth', 'signIn', …(43) ] to deeply equal [ …(5) ]`). `:132` `NOT_YET_REGISTERED` is derived from it and registered as stand-in routes at `:202` and `:309` (`FastifyError: Method 'POST' already declared for route '/api/v1/session'`); `:208` expects 68. `:283`, `:295` register `listUsers` early (`Method 'GET' already declared for route '/api/v1/admin/users'`). `:371` to `:376` register stand-ins for `startSession`, `listUsers`, `setStoragePolicy`, `unpairDevice`, `resetDemo`: all ten tests of "stage 6 in the pipeline" fail in their set-up. `:500` registers `assignUserRole` |
| `src/plugins/permission-guard/__tests__/boot-registry.test.ts:89` | 1 | uses `listUsers` and `startSession` as "operations whose route is NOT registered" |
| `src/modules/rbac/__tests__/routes.test.ts:187` | 1 | expects `code: 'STORED_MATRIX_MISMATCH'` as the FIRST problem of an empty matrix; with routes that name permissions the first problem is `PERMISSION_NOT_STORED` (`matrix.ts:105` to `:115` come first) |

**By reading, not run (database project):** the same stand-ins are used by `src/plugins/permission-guard/__tests__/denial.db.test.ts:89` and `src/modules/rbac/__tests__/matrix.db.test.ts:79`, `:351` through `support.ts:147` (`registryRoutes`). They will fail the same way.

**Why it matters.** (1) Both whole projects must exit 0 at the backend gate (W58). (2) The ten unit tests of stage 6 do not run at this moment, so the access control of the server has lost its fast tests exactly while seven modules build on it. (3) Every module row sees these reds as another row's failure (M12) and must message the controller (M10): six interruptions for one cause, and six rows must not edit one file.

**Fix.** The tests of the guard must not depend on which modules have landed:
1. Build the app under test without the domain modules: one shared helper that replaces the module units by seam-only stubs (`vi.mock` of the module `index.ts` files; `pairing` must still provide `deviceResolver`), or, if the controller grants it, a `units` option of `buildApp` (the file is frozen, P25). Then stand-in routes never collide.
2. Replace the exact lists by properties: "every registered rule is a registry operation at its registry route" (the loop at `:140` already says it), "registered plus stand-ins equals the registry plus the socket" computed at run time from `permissionGuard(app).registeredRules()`.
3. `routes.test.ts:187`: assert that the problems CONTAIN `STORED_MATRIX_MISMATCH`, not that it is first.
One owner (W28) makes the change once; it is the pattern of D72 / D82 in the other direction.

### 4.2 High

#### CPB1-2 — An error logged under any key other than `err` writes the statement, its parameters and the server's `DETAIL` into the log (High; owner W08; before the module rows' gates and W45)

**Where.** `src/plugins/logger/logger-options.ts:78-88` (the serializers know `req`, `res`, `err`), `:89-106` (the hook handles `log.x(error)` and `{ err }` without text). `node_modules/drizzle-orm/errors.js:10-19`: `DrizzleQueryError` holds `query`, `params` and `cause` as own enumerable properties.

**Reproduced** (scratch test at 14:31:38: the server's `buildLoggerOptions`, the installed `DrizzleQueryError` around a driver error with `code: '23505'` and a `detail`):

```
A key err               | statement:false param:false pgDetail:false code:undefined type:"Error"
B key error             | statement:true  param:true  pgDetail:true
C key cause             | statement:true  param:true  pgDetail:true
D nested                | statement:true  param:true  pgDetail:true
E key err, driver error | statement:false param:false pgDetail:false code:"23505" type:"Error"
```

**Why it matters.** The header of `logger-options.ts` and finding F53 / core services F-2 say "the scaffold's logger never writes an error's message, so the log is safe either way". That holds for the key `err` only. `request.log.warn({ error }, '…')` is the most natural line for a module to write; no lint rule, no static test and no type stops it, and a module's log-capture test catches it only if that error path is exercised. A parameter of a failed statement can be a token hash, a credential hash or the content of an audit row; the `DETAIL` of a unique violation quotes the key (F38). No foundation file has such a call today (searched: every log call that carries an error uses `err`), so nothing leaks now: this is a trap in the mechanism, not a leak.

**Fix.** In `buildLoggerOptions`: replace every `Error` instance found in the merge object, at any key and at least two levels deep, by the output of `describeError` (pino's `formatters.log`, or the existing `logMethod` hook). Add the five lines above as a test of `log-capture.test.ts`. Add one server-wide static test: a log call whose object holds `error`, `cause`, `e` or `reason` as a shorthand member is refused. Row A also shows CPB1-7.

#### CPB1-3 — F53 evaluated: the runtime pool sets no `search_path`, the query builder's statements are unqualified, and the unit's refusal of `CREATE` is weaker than recorded (High as a hardening item; ruling is W45's; owners W08 and W21)

**Where.** `src/plugins/db/index.ts:55-67` (`createRuntimePool`: host, port, database, user, password function, `ssl`, `application_name`, `max`, `connectionTimeoutMillis`; no `options`). Unqualified statements: every Drizzle builder call, among them the audit insert `src/core/audit-writer.ts:244` and the event insert `src/core/event-writer.ts:160`, and all of `src/db/seed/store.ts`. Qualified with `public.`: the raw statements of `src/modules/identity/session-store.ts`, `src/plugins/permission-guard/matrix.ts:51-56`, `src/core/event-writer.ts:41-46`, `src/core/unit-of-work.ts:43`.

**The four options, by reading the code:**

| Option | Assessment |
|---|---|
| (a) accept with the unit's refusal | Not sufficient. The refusal is a first-keyword test (`src/core/unit-of-work.ts:59-60`). It does not see `SELECT … INTO TEMP …`, a `DO` block, `SELECT set_config('search_path', …, false)`, or a text with several statements sent without parameters (CPB1-4). And it does not exist outside a unit |
| (b) revoke `TEMPORARY` at every database creation | The only option that removes the capability, and the most expensive: three creation paths with three copies of the statement (`src/db/commands/create.ts:35-37`, `src/db/reset/names.ts:163-165`, `test/helpers/db/ddl.ts:179`), plus the clones from templates, to which database privileges are not copied. Optional, after (d) |
| (c) a static guard | Cheap and worth having beside (d): one test in `test/static/` that no production source holds `TEMP`, `TEMPORARY`, `search_path` or `set_config(` outside the two places that pin the path |
| (d) explicit `search_path = public, pg_temp` on the runtime pool, with a boot check | **Recommended, and feasible as the controller prefers.** One line in `createRuntimePool`: `options: '-c search_path=public,pg_temp'`. The driver sends `options` in the start-up packet of every pooled connection (`node_modules/pg/lib/client.js:567-568`), so no connection can miss it and no round trip is added; `removeDriverEnvironment` does not touch an explicit option. Boot check: inside the B-1 step (`src/plugins/db/index.ts:184-189`), `current_setting('search_path')` must be `public, pg_temp` — this keeps the list of boot steps unchanged |

**One addition to (d), owner W21.** A pooled connection's session state can still be changed by code outside a unit. Pin the path per unit, at no cost: the unit's third statement (`src/core/unit-of-work.ts:44`) becomes `SELECT set_config('statement_timeout', $1, true), set_config('search_path', 'public, pg_temp', true)`. Then the audit insert of every unit finds the real table whatever happened on the connection before.

**Not verified:** nothing here was executed against PostgreSQL. The owner's test: on a pooled connection create a temporary table named `audit_log`, then append through the writer; the row must be in `public.audit_log`.

### 4.3 Medium

#### CPB1-4 — The unit's statement guard looks at the first keyword of the first statement only (Medium; owner W21; before W45)

**Where.** `src/core/unit-of-work.ts:59-60` (`NOT_A_UNIT_STATEMENT`), `:232-246`, `:252-277`; line `:272` sends a text without values through the simple query protocol, which accepts several statements.

**By reading.** `unit.query('UPDATE … ; COMMIT')` passes the guard and ends the unit's transaction early; what follows runs in autocommit; the unit's own `COMMIT` then answers `COMMIT` (with a warning) and counts as committed (`:369`). The header of the file (lines 19 to 29, "never a half-written unit") therefore holds for single-statement texts only. The guard is a protection against accidents (the query builder's `db.transaction()`), not a boundary; the documents call it more.

**Fix.** Send every statement of a unit's user with the extended protocol (`{ text, values, queryMode: 'extended' }`; supported by the installed driver, `node_modules/pg/lib/query.js:19`, `:36-38`): PostgreSQL then refuses a text with several commands. Add tests for a multi-statement text, `SELECT … INTO TEMP` and `DO`. State in the header what the guard is.

#### CPB1-5 — `stages.replace` and `seams.replace` are test-only by a regular expression, and a replaced stage 6 lets the server start (Medium; owners W08 and W28; before W45)

**Verified.** The static test exists and scans every production source (`src/plugins/permission-guard/__tests__/static.test.ts:39`, `:149-151`); no production file calls `replace` (search). But:
- the pattern `\b(?:stages|seams)\s*\.\s*replace\s*\(` does not match `app.stages['replace'](…)`, `const { replace } = app.stages` (the method uses no `this`: `src/app.ts:182-184`), or `const s = app.stages; s.replace(…)`;
- `replace` works at any time, also after the boot: the stage is read per request (`src/app.ts:345-347`);
- when the stage is not the guard's handler, `onReady` and `checkRouter` write one warn line and return (`src/plugins/permission-guard/index.ts:319-322`, `:367-371`): the server starts with stage 6 off.

**Other escape hatches found (none is used by production code today):**
- `request.principal` is a plain writable member; it is assigned in `src/app.ts:343` and `src/plugins/authenticate/index.ts:253`, `:271` only, and no static test keeps it so. A handler that assigns it forges the actor of `engine.command(request.principal, …)`;
- the controls meant for tests hang on production seams: `identityControl(app).hasher` has a setter (`src/modules/identity/index.ts:152-157`), `identityControl(app).lockout.reset()`, `throttleControl(app).reset()` (`src/plugins/throttle/index.ts:202-206`), `engineControl(app).simulator()` / `useTimer()`. The biometric row W41 is told to use `identityControl(app)` for the lockout, and gets the hasher setter with it.

**Fix.** (1) Complete: `createSlots.replace` throws unless `buildApp` was called with a test option that the entry point never passes (six lines in the frozen `app.ts`: a controller ruling under P25). (2) Without a frozen file, W28: `checkRouter()` throws instead of warning when the stage was replaced; the entry point always boots, so a process that listens always has stage 6. One test file both replaces the stage and boots (`src/plugins/readiness/__tests__/readiness.test.ts`); it switches to `passScratchRoutes`. (3) Static tests: the three forms above; `principal =` outside the two files; no production file outside the owning folder names `throttleControl(`, `engineControl(`, `.hasher =` or `lockout.reset(`. (4) Split `IdentityControl`: what W41 needs (take, fail, succeed, status) apart from what a test needs.

#### CPB1-6 — A connection lost in the middle of a unit answers 500 and does not move readiness (Medium; owner W21; before W53)

**Where.** `src/core/unit-of-work.ts:273-276` (the statement's failure is rethrown as the driver's error), `src/core/pipeline.ts:233-265`: only `DATABASE_UNAVAILABLE` and `COMMIT_FAILED` call `onDatabaseFailure` (`:250`) and answer 503; any other failure goes to `:261-264` (`debug` line, the raw error to the caller).

**By reading.** PostgreSQL stops while a unit has sent `BEGIN` and waits for a statement: the caller gets the driver's error, the error envelope answers 500 `INTERNAL_ERROR` and writes an "unexpected error" entry with a stack; `ready.database` stays true until an idle connection reports the loss or the next unit fails in `#begin`. The specification asks for 503 `NOT_READY` when the database does not answer (stage 9; ENG-5). Reads outside a unit are right already: `readDatabase` answers 503 and probes (`src/modules/identity/sessions.ts:141-152`).

**Fix.** In the failed branch of `execute`: when the unit's connection reported an error (`#onConnectionError` fired) or the failure has no SQLSTATE or one of class 08 or 57P01 to 57P03, treat it as `DATABASE_UNAVAILABLE` (503, `onDatabaseFailure()`). One database test with a terminated backend. Not reproduced: this review has no database access.

#### CPB1-7 — `describeError` does not follow `cause`: the SQLSTATE of every wrapped database error is missing from the log; and the helper that does follow it exists four times (Medium; owners W08, then W20, W21, W25, W29)

**Reproduced** (row A of CPB1-2): a `DrizzleQueryError` logged the safe way gives `code: undefined`, `type: "Error"`. So an "unexpected error" line of any module's failed statement tells an operator neither `23505` nor the constraint.

**Where.** `src/plugins/logger/error-log.ts:64-76` reads `error.code` only. The walk over `cause` (depth 4) is written in `src/core/errors.ts:126-134` and `:140-148`, `src/db/seed/store.ts:63-76`, `src/db/fixtures/load.ts:56`, `src/db/reset/errors.ts:156`. The stack-frame filter of `describeError` is written again in `src/engine/host.ts:181-187`.

**Fix.** `describeError` follows `cause` for `code` (and reports the driver's `name`); the four copies and `framesOf` call it or one exported helper beside it. Rule M5 ("use `sqlStateOf`") then has one implementation.

#### CPB1-8 — "A read on the pool that fails answers 503" exists twice and is not offered to the modules (Medium; owners W08 and W24; now, while the module rows write)

**Where.** `src/modules/identity/sessions.ts:141-152` (`readDatabase`, not exported by the module's index) and `src/modules/rbac/index.ts:66-84` (the same twelve lines written out). Rule M5 says "reads that change nothing use `app.db.pool`" and says nothing about a failure.

**Why it matters.** A module that reads on the pool and lets the driver's error go answers 500 with a persisted stack for every request while the database is away; a module that wants 503 copies the block a third time.

**Fix.** Move `readDatabase` to the pool plugin as `app.db.read(source, work)` (the plugin already owns the probe and readiness), use it in identity and RBAC, add one sentence to M5.

#### CPB1-9 — `ApiFailure.code` is a `string`: nothing ties an error code of the server to the contract (Medium; owner W08; before the module rows' gates)

**Where.** `src/plugins/error-envelope/api-failure.ts:25`, `:30`. Retyped codes: `EnvelopeCode`, eight literals (`api-failure.ts:41-50`), with no test against `ApiErrorCode`; fifteen literals in `src/engine/errors.ts:56`, `:72-85` (tied by `src/engine/__tests__/errors.test.ts:45`). The contract's `ApiErrorSchema` checks a code by pattern only (`packages/shared/src/api/core-api.ts:197-200`), and `validateCoreApiResponse` checks a status by schema, not by code (F49). So a module can answer a code that no client knows, and its module gate (M11) passes.

**Fix.** Type the constructor's `code` as `ApiErrorCode` of `@dems/shared/api` and delete `EnvelopeCode`. Counted over the tree: every production use already passes a contract code; one test uses a made-up code and needs a cast.

#### CPB1-10 — Two stage plugins import from a module; the identity module holds generic helpers that others then import across modules (Medium; owners W24 and W28; before W41 and W91)

**Import map (production, value imports unless marked):**

| From | To | Where |
|---|---|---|
| `plugins/authenticate` | `modules/identity/limits` | `index.ts:59` |
| `plugins/authenticate` | `modules/identity/sessions`, `modules/pairing` (types) | `index.ts:60-61` |
| `plugins/permission-guard` | `modules/identity` (the module's whole index) | `index.ts:72`, `denial.ts:30` |
| `modules/identity` | `plugins/authenticate` | `routes.ts:43`, `sign-in.ts:43` — a cycle with the first line |
| `modules/identity/lockout` | `plugins/throttle/windows` (deep) | `lockout.ts:40` |
| `db/seed`, `db/fixtures` | `modules/identity/password-hash` (deep) | `seed.ts:44`, `fixtures/identity.ts:21` |
| `engine` | `db/seed/store` (deep) | `rehydrate.ts:30`, `write-plan.ts:42` |
| `core` | `plugins/error-envelope`, `plugins/logger` | `errors.ts:23`, `pipeline.ts:40` (the scaffold's base plugins: sound) |

No production file imports from a `__tests__` folder (static test and search).

**Why it matters.** The scaffold's rule is "a module reaches another only through the seams" (`src/app.ts:35`). Because `consoleIdentityOf`, `pairedDeviceOf`, `deviceRevoked`, `deviceNotPaired` and `createSweeper` live in the identity module, the guard imports a module, and the pairing module (in flight, 14:36) imports `'../identity'` four times (`src/modules/pairing/index.ts:48`, `devices.ts:35`, `redeem.ts:49`, `routes.ts:57`). The guard's index loading the identity module's index means the guard's module graph holds the sign-in, the routes and the password hash.

**Fix.** Move below the modules, keeping re-exports from the identity index: `console.ts` (facts of stages 3 and 4) and the two refusal builders to `plugins/authenticate/`; `SESSION_TOUCH_MIN_INTERVAL_MS` with them; `createSweeper` and the fixed windows to `src/core/` (CPB1-16). HB-5 then still has two folders (section 5): record that as accepted.

#### CPB1-11 — The store's place: runtime code imports from the seed program's folder (Medium; owner W20 with W25, W26, W29; before the first checkpoint commit W104)

See the answer in section 7.2. `src/db/seed/store.ts` is used by the seed, the reset routine, the bulk fixture and, at run time, by the engine host. Recommendation: its own folder `src/db/store/`.

#### CPB1-12 — Test support is shared across rows from `__tests__` folders, with one cycle (Medium; owner: one controller row; before W47)

**Where.** 34 files import `src/plugins/config/__tests__/test-config`; 13 import `src/db/seed/__tests__/support`; `src/plugins/permission-guard/__tests__/support.ts:35` imports the identity support, and `src/modules/identity/__tests__/support.ts:21` imports `passScratchRoutes` from the guard support (a cycle). Module rows in flight import both already (`src/modules/{storage,admin,devices}/__tests__/support.ts`).

**Why it matters.** These files are infrastructure of every later row but belong to finished rows; a change of one (CPB1-1 needs one) is a multi-writer edit.

**Fix.** A neutral folder `apps/core-server/test/support/` beside `test/helpers/db/`: the test configuration and log capture, the signed-in operator, `passScratchRoutes` and the stand-in routes, the stub modules of CPB1-1, the seeded state. The `__tests__` files re-export for one round.

#### CPB1-13 — Database tests that pin whole lists will break with the next boot step or log key (Medium; owners W21, W26, W28; before W42 and W43; by reading, not run)

| Pin | Where | Breaks when | Pin instead |
|---|---|---|---|
| The exact list of passed boot steps | `src/core/__tests__/seeded.db.test.ts:28-43`; `src/engine/__tests__/restart.db.test.ts:24`, `:66`, `:97`; `src/modules/rbac/__tests__/matrix.db.test.ts:48`, `:95` | any row adds a boot step | "B-1 to B-9 passed in this order, then `engine.rehydrate`, and my step passed after it" |
| A closed set of log keys over EVERY line after `engine started` | `src/engine/__tests__/commands.db.test.ts:689`, `:717-731` | any unit logs a new key at a commit or at close (the realtime row W42 will). It broke once already (D82, last sentence) | the allow-list for the lines of the engine only (its messages or its unit labels); for all lines keep the content check of `:715` |
| `expect(printed).toHaveLength(76)`, `toHaveLength(68)` | `guard.test.ts:316`, `:208` | part of CPB1-1 | derived from the registry |

#### CPB1-14 — One "no session remains" check does not poll (Medium-low; owner W26; before W53)

`src/engine/__tests__/restart.db.test.ts:556-561` reads `pg_stat_activity` once after `app.close()` and expects 0. Lesson (2) of F63: the pool's end resolves before the server has dropped the backend. Fix: poll with a cap, as the reset tests now do. Its key is its own database (lesson 1 is met).

#### CPB1-15 — One helper test compares a list that can hold a background worker (Medium-low; owner W11b)

`test/helpers/db/__tests__/drop-retry.db.test.ts:87` expects `backendsOn(clone)` to equal exactly one entry. `backendsOn` counts backends without a role too (`test/helpers/db/ddl.ts:91-92`); an autovacuum worker on that clone at that instant adds one, which is the case D76 reproduced. Fix: compare the entries that have a role.

### 4.4 Low and Info

| ID | Sev. | Where | What | Fix | Owner |
|---|---|---|---|---|---|
| CPB1-16 | Low | `src/modules/identity/lockout.ts:40`; in flight `src/modules/pairing/redeem-lock.ts:43` | The window helper of the throttle is deep-imported by two modules | Section 7.4 | W23 |
| CPB1-17 | Low | `src/modules/identity/routes.ts:57-61`, `:89-91`, `:119`, `:130`, `:145`; `src/modules/health/index.ts` (`.get(HEALTH_PATH, …)`) | A local `routeOf` beside `routeOfOperation` (`plugins/permission-guard/index.ts:186`), which the standing rule M2 names; three ways to register a registry route; the route hooks duplicate stage 6 | Section 7.5; use `routeOfOperation` in both modules | W24, W08 |
| CPB1-18 | Low | `src/realtime/index.ts` (`SessionEndedReason`), `src/plugins/error-envelope/api-failure.ts:60` (`allow`), `src/engine/errors.ts:56` and `src/plugins/authenticate/index.ts:131` (two texts for 401 `NOT_SIGNED_IN`), operation IDs as `string` lists (`plugins/throttle/limits.ts:55-64`, `plugins/readiness/index.ts:25`, `plugins/authenticate/index.ts:153`, `plugins/permission-guard/access-rules.ts:157-171`) | Values of the contract typed again. The contract exports `SessionEndedReason` (`packages/shared/src/api/realtime-messages.ts:141`) and `ALLOW_HEADER_NAME`. The operation lists are tied to the registry by tests, except `ACTIVITY_EXEMPT_OPERATIONS`, which is compared with itself (`authenticate.test.ts:426`) | W42 imports the contract's type when it replaces the stub; one `notSignedIn()`; a literal union of operation IDs from `CoreApiOperationTable` | W42, W08, W24 |
| CPB1-19 | Low | `src/db/schema/boot-checks.ts:52` (`GENESIS_HASH = '0'.repeat(64)` beside the shared constant; no test ties them); `src/core/limits.ts:55` (`EVENT_COUNTER_NAME` not typed as `EngineCounterName`); `create.ts:29-37`, `reset/names.ts:49-51`, `:164`, `ddl.ts:179` (one statement three times); `src/db/mapping/rbac.ts:36` with `store.ts:275` beside `plugins/permission-guard/matrix.ts:51` and the sub-select of `session-store.ts` (three readers of the RBAC tables, two styles) | Small second copies | Import the shared constant; type the name; one statement builder in `db/commands` | W17, W21, W29, W11 |
| CPB1-20 | Low | Section 5 | Hand-built parts that have no HB number | A decision of the controller | controller |
| CPB1-21 | Low | `src/db/schema/public-columns.ts` | The public column sets of NL-6 are used by one test and by no production code: the identity statements list their columns by hand | Either the module rows that read `paired_devices`, `pairing_codes`, `biometric_tokens` use the sets, or NL-6 is reworded to "an explicit column list" | W32, W41, W83 |
| CPB1-22 | Low | `src/db/reset/routine.ts:465`, `src/db/commands/cli.ts:189` | `process.env` is touched outside `index.ts` (the driver variables are deleted); the static test exempts `src/db/` (`test/static/network.test.ts:115`), and the routine will run inside the server (W43) | Pass the environment in, or let the caller scrub it | W29 |
| CPB1-23 | Low | `src/plugins/logger/error-log.ts:67-70` | The stack filter keeps every line that starts with white space and `at `. An error message of several lines (the wrapper's holds the statement and the parameters) can place its own line there | Drop the lines up to the first frame, then filter | W08 |
| CPB1-24 | Low | `src/plugins/permission-guard/router-table.ts` | The boot step reads the routes from the PRINTED route table. It fails closed, and a test compares it with the real router (`guard.test.ts:306-316`), but it depends on a print format | Section 7.6 | W28 |
| CPB1-25 | Info | `src/db/schema/value-sets.ts:7`; `src/plugins/throttle/__tests__/throttle.test.ts:120`; `src/plugins/db/index.ts:9-10`; `src/modules/identity/routes.ts:16-20` | Stale comments: a test file that does not exist (the test is `test/db/contract-inventory.test.ts:241`); "the scaffold's stub" at stage 4; "the pool keeps no copy" of the password (each connected client keeps it: `node_modules/pg/lib/client.js:286`, non-enumerable) | Reword | owners |
| CPB1-26 | Info | Section 7.7 | Four files above 800 lines | No split before the gate | W91 |

---

## 5. One folder and own tests per hand-built element (I1, D12)

| HB | Element | Folder(s) | Tests | Remark |
|---|---|---|---|---|
| HB-1 | `scripts/pg/` lifecycle | `scripts/pg/` | `node --test scripts/pg/` (root script `test:pg-scripts`) | outside `apps/core-server`; not reviewed |
| HB-2 | Seed program | `src/db/seed/` | `__tests__/{cli,seed-order}.test.ts`, `{cli,seed,seed-clock,write-through}.db.test.ts` | holds `store.ts`, which is the database half of HB-13 (CPB1-11) |
| HB-3 | Reset routine | `src/db/reset/` | `__tests__/` 6 unit and 4 database files | one folder |
| HB-4 | Password-hash wrapper | `src/modules/identity/password-hash/` | `password-hash.test.ts`, `argon2-builtin.test.ts`, `password-hash.wiring.test.ts` (beside the source) | one folder; constant-time compare `password-hash.ts:278` |
| HB-5 | Session table and `authenticate` hook | **two:** `src/plugins/authenticate/`, `src/modules/identity/` | `plugins/authenticate/__tests__/` 3 files; `modules/identity/__tests__/` 13 files | two folders with an import cycle (CPB1-10). The scaffold splits stage and module; record as accepted or move the session lookup |
| HB-6 | Origin guard | `src/plugins/origin-guard/` | `__tests__/origin-decision.test.ts`, `origin-guard.test.ts` | one folder |
| HB-7 | Permission guard | `src/plugins/permission-guard/` (+ `src/modules/rbac/` for operation 10 and the boot step) | 6 unit and 2 database files; `modules/rbac/__tests__/` 2 files | one folder and one module; tests red now (CPB1-1) |
| HB-8 | Topic registry and send policy | `src/realtime/` | — | not built (W42) |
| HB-10 | Pairing protocol | `src/modules/pairing/` | — | in flight (W32) |
| HB-12 | Template-clone test helper | `test/helpers/db/` | `__tests__/` 19 files, `selfcheck/` | one folder |
| HB-13 | Engine host and mapping | **three:** `src/engine/`, `src/db/mapping/`, `src/db/seed/store.ts` | `engine/__tests__/` 14 files; `db/mapping/__tests__/` 4 files; `db/seed/__tests__/write-through.db.test.ts` | two halves by design; the third place is CPB1-11 |
| HB-9, 11, 14, 15 | shared client layer | `packages/shared` | — | checkpoint CP-C1 |

**Hand-built and without an HB number (CPB1-20).** Each has one folder and tests; none is in D12's list: the serial pipeline and the unit of work (`src/core/pipeline.ts`, `unit-of-work.ts`; planned in `02_plan.md` line 1721), the stage and seam registry (`src/app.ts:170-195`), the persistent error log with its rotation (`src/plugins/logger/error-log.ts`; the rotation and the file mode have no test of their own that I found), the route table for 405 (`src/plugins/error-envelope/route-table.ts`), the fixed windows (`src/plugins/throttle/windows.ts`), the engine scheduler (`src/engine/scheduler.ts`), the reader of the printed route table (`router-table.ts`), the migration status reader (`src/db/commands/migrations.ts`). Not hand-built, as D12 requires: the throttle counts with `@fastify/rate-limit` (`plugins/throttle/index.ts:137`, `:149`) and the lockout and the denial budget with `rate-limiter-flexible` (`lockout.ts:39`, `denial-budget.ts:18`).

---

## 6. Dimension 2 in detail: one mapping, one chain

**Verified by search over every production source** (`createHash`, `chainHash`, `auditBody`, `canonical`, `verifyAuditChain`, `appendAudit`, `audit_chain_lock`, inserts into the two tables):

- The digest, the canonical form and the chain check are the shared code's only. The server calls `appendAudit`, `chainHash`, `auditBody` (`src/core/audit-writer.ts:211`, `:279`) and `verifyAuditChain` through `verifyStoredAuditRows` (`src/db/mapping/audit-verify.ts:37-45`; used by `src/core/boot-checks.ts:79`). No second implementation. Other uses of SHA-256 are unrelated: token hashes (`modules/identity/tokens.ts:31`), migration file hashes, fixture values.
- F40 is closed: `src/core/` holds no row mapping; it imports `auditRowToRow`, `eventToRow`, `verifyStoredAuditRows`, `isStorableText`.
- One mapping in both directions: `src/db/mapping/rows.ts`. The engine's operator mirror uses `operatorFromRow` (`src/engine/host.ts:404`).
- The second insert path into `audit_log` and `events` (`src/db/seed/store.ts:124-129`, `insertRows`; `applyChanges` with its AP-6 check `:317-328`) is the owner-role programs' (seed, reset, fixture). At run time it cannot be reached: the engine removes the two tables from its changes (`src/engine/write-plan.ts:101`) and the unit refuses such an insert before it is sent (`src/core/unit-of-work.ts:73-78`, `:237`). Accepted as recorded (core services F-4). The chain-lock statement is written twice (`unit-of-work.ts:43`, `store.ts:155`); it is one line and each caller needs it in its own form.
- D67 DN-5: section 7.1.

**Verdict: PASS.**

---

## 7. Answers to the open design questions

### 7.1 D67 DN-5 — the statement that takes n event numbers stays in the core: **confirmed**

`EVENT_COUNTER_ADVANCE` and `EVENT_COUNTER_RAISE` (`src/core/event-writer.ts:41-46`) are counter statements whose row count and returned value decide; they map no slice. The mapping keeps the engine's absolute value of the same counter (`src/db/mapping/changes.ts:130-140`); both paths write the same value in one unit (DN-3). Two notes: type `EVENT_COUNTER_NAME` as `EngineCounterName` (CPB1-19); the two statements name the columns by hand, which the writer's database tests cover.

### 7.2 D62 DN-10 / D77 DN-13 — where `readStoredRows` and `applyChanges` live: **`src/db/store/`, not `src/engine/`**

The functions are called by four units: the seed (`seed.ts:58`), the reset routine (`reset/routine.ts:67`), the bulk fixture (`fixtures/load.ts:41`) and the engine (`engine/rehydrate.ts:30`, `write-plan.ts:42`). Three of them are owner-role programs that must not import the engine; the engine must not import the seed program. A folder of its own beside the pure mapping gives one direction: `db/schema` ← `db/mapping` ← `db/store` ← seed, reset, fixtures, engine. It is the database half of HB-13 and belongs to the mapping row W20. What moves: `store.ts` and `write-through.db.test.ts`; six import lines; two static tests that pin the path (`src/db/mapping/__tests__/static.test.ts:102`, `src/engine/__tests__/static.test.ts:116-117`). The tree is untracked until W104, so the move costs no history now. No behaviour changes; if the controller wants no churn while seven rows write, the move can wait for W91.

### 7.3 D78 DN-8 — the two headers of API-7: **one hook, in the engine unit**

An `onSend` hook added by `src/engine/index.ts` (root scope; the engine owns the epoch and the revision): for a POST with a 2xx status that carries neither header, set both from `app.engine`. A handler of a hosted command may still set the exact values of its outcome; the hook does not replace them. Why a late read is right: the revision read when the answer is sent is equal to or above the one that holds the command's effect, and every revision up to it has been published, so a client that waits for it gets what it waits for; a read that is too early would be the defect, and the hook cannot make one. Not in `app.ts` (frozen), not in `plugins/response-headers` (it does not know the engine). Then: delete `withStateRevision` (`src/modules/identity/routes.ts:73-75`, `:95`, `:136`, `:150`), tell W32, W33 and W41 to drop their two lines, and let the conformance test W52 assert both headers on every 2xx POST. By reading; not run.

### 7.4 D78 DN-11 — the window helper: **move `windows.ts` to `src/core/`**

It is clock arithmetic with no dependency, used by the throttle, the lockout (`lockout.ts:40`) and now the pairing redeem lock (in flight). The core already owns the clock, and every unit may import the core. The smaller alternative: export `createFixedWindows`, `counterName` and `OpenWindow` from `plugins/throttle/index.ts`, so that no module names a file inside the plugin.

### 7.5 D83 DN-8 — the identity routes' own checks: **remove them; two handler calls stay**

Confirmed by reading `decision.ts`: `signIn` is `PUBLIC` with the condition `CONSOLE_IDENTITY`, decided with the same `consoleIdentityOf` (`permission-guard/index.ts:251`, `decision.ts:139-141`); operations 4 to 6 are `AUTHENTICATED` (`decision.ts:111-112`); a retired device is refused on operations 2 and 3 by `refusesRetiredDevice` (`access-rules.ts:307`). Remove: the `onRequest` of `signIn` (`routes.ts:89-91`), `onRequest: operatorOnly` (`:119`, `:130`, `:145`) and the function (`:78-81`), and `refuseRetiredDevice` in the handler of `getSignInStatus` (`:108`). **Stay:** `requireConsoleIdentity(app, request)` in the handler of `signIn` (`:93`), which returns the console the sign-in needs, and `operatorSessionOf(request)` in the handlers of operations 4 to 6 (`:121`, `:132`, `:149`), which returns the session. Run the identity tests afterwards: `tokens-cookie.test.ts:78` takes stage 6 out.

### 7.6 D83 DN-6 — the route walk: **leave it in the boot step**

The server's start is always ready, boot, listen (`src/index.ts:98-107`), so both places stop a route before the listener opens; moving the walk into `ready()` changes nothing for production and forces the set-ups with top-level scratch routes to change. What I would change is the source of the walk (CPB1-24): the scaffold's synchronous `onRoute` hook already records every route, top-level ones included (`src/app.ts:332`), so a list from that table would need no parsing of a printed tree. The table is local to `buildApp`; exposing it is an edit of the frozen file and so the controller's call. Until then the parser stays: it fails closed.

### 7.7 Files above about 800 lines

| File | Lines | Justified |
|---|---|---|
| `src/db/reset/routine.ts` | 1,075 | Yes for now. One routine R-0 to R-9 whose steps share two connections and the failure handling. If it grows: the session waits (`:279-330`) and the verification R-6 (`:940-1068`) are separable |
| `src/engine/host.ts` | 874 | Yes for now. One closure over about fifteen variables (phase, the two states, epoch, revision, the reload). A split needs an explicit state object first |
| `src/db/fixtures/identity.ts` | 844 | Yes: generated test data of the bulk fixture, no logic of the server |
| `test/helpers/db/run.ts` | 802 | Test infrastructure with 19 test files |

No `live-…`-sized file. No split before the backend gate.

### 7.8 `react` in this workspace (D28 D-4)

Still needed: `@dems/shared/sim` re-exports `./react` (`packages/shared/src/sim/index.ts:39`), which imports `react` and `zustand`. Loading the module evaluates React and one `createContext` call (`packages/shared/src/sim/react.ts:30`); the server calls no hook, no provider and no renderer (search over `src/`). The React-free entry point remains the clean-up D28 names.

---

## 8. Fixes in order

| # | Finding | Owner | Before |
|---|---|---|---|
| 1 | CPB1-1 guard tests independent of landed modules (**Blocker**) | W28 | now; W58 at the latest |
| 2 | CPB1-2 the logger makes every `Error` safe at every key | W08 | the module rows' gates; W45 |
| 3 | CPB1-8 `app.db.read`; CPB1-9 `ApiFailure.code` typed by the contract | W08 (W24) | the module rows' gates |
| 4 | CPB1-3 `search_path` on the pool and per unit, boot check, static guard | W08, W21 | W45 rules; W58 |
| 5 | CPB1-4 extended protocol in a unit; CPB1-6 lost connection is 503 | W21 | W45; W53 |
| 6 | CPB1-5 `replace` closed by construction; static tests widened | W08 (ruling), W28 | W45 |
| 7 | CPB1-7 `describeError` follows `cause`; one helper | W08, then W20, W21, W25, W29 | W58 |
| 8 | CPB1-13, 14, 15 list pins and the two timing-sensitive tests | W21, W26, W28, W11b | W42, W43, W53 |
| 9 | CPB1-12 neutral test support; CPB1-10, 11, 16 moves | controller row; W24, W28, W20, W23 | W47; W104 |
| 10 | CPB1-17 identity route hooks; the header hook of 7.3 | W24, W26 | W52 |
| 11 | CPB1-18 to 26 | owners | W91 |

---

## 9. Pointers for the security review (W45)

1. **Log:** CPB1-2 (reproduced), CPB1-23, CPB1-7. Check every log call of the seven modules for an error object at a key other than `err`.
2. **F53:** CPB1-3 and CPB1-4. Option (a) rests on a first-keyword test; the pool is created at `src/plugins/db/index.ts:55-67`.
3. **Stage 6 can be taken out:** CPB1-5, with the list of controls reachable from production code.
4. **Constant time:** the password tag is compared with `timingSafeEqual` (`password-hash.ts:278`). A session token is never compared in the process: it is looked up by its SHA-256 (`tokens.ts:30-32`, `session-store.ts` `FIND_SESSION`). I found no other secret comparison in the foundation.
5. **Secrets in memory:** the session token lives in the issuing unit, the answer and the request's parsed cookie or header, and in no map of the server (the per-request record holds the session without its token: `plugins/authenticate/index.ts:109-119`). The password is a string of the request body and a byte copy made by the wrapper; I found no zeroing of that copy. The database password is behind `Secret` (`config.ts:114-136`), but every connected client of the driver keeps it as a non-enumerable member (`node_modules/pg/lib/client.js:286`).
6. **Cookie:** exactly `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Max-Age`, no `Domain`, no `Secure` (`cookie.ts:25`); cleared with `Max-Age=0` (`:34`); set only for a web console's sign-in (`routes.ts:96-98`).
7. **Statement text built from values:** database names pass a closed list and a branded type (`database-names.ts:35-53`), are checked again and quoted in the reset (`reset/names.ts:155-160`) and the helper; table and column names of the carry-over come from constants (`reset/kept-tables.ts:86-119`). `create.ts:36` places the guarded name unquoted (lower-case names only). I found no value of a request in a statement text.
8. **Reset role check:** the first statement of every connection of the routine; a superuser or another role stops it (`reset/routine.ts:439-448`, `:488`).
9. **Environment:** CPB1-22.
10. **Throttle:** a request refused at stage 3 or 4 is never counted (D52 DN-8); 20 audited refusals also block the same key's allowed calls for up to 60 s (D83 DN-10); F62.

---

## 10. What was not reviewed

- Anything that needs PostgreSQL: no database test was run. CPB1-3, 4, 6, 13, 14, 15 and the database half of CPB1-1 are by reading.
- The module folders in flight, `src/modules/identity/password-hash/` beyond its exports and its compare, `src/db/fixtures/` beyond its imports, the SQL of the four migrations, `scripts/pg/`.
- `src/db/mapping/{rows,changes}.ts` line by line: the mapping's correctness is the tests' (round trip, write-through); this review checked that it is the only one.
- The test helper `test/helpers/db/` beyond its statements, names and its use of `pg_stat_activity`.
- Performance, the realtime channel (a stub), the clients.
- Shutdown on a listening server: the order was read (`preClose`: engine, then the identity sweeper; `onClose` in reverse: realtime, engine, core, pool: `engine/index.ts:127-132`, `core/index.ts:133-135`, `plugins/db/index.ts:193-195`), not run. Timers: the engine's and the sweeper's are cleared and `unref`'d; the pipeline's are cleared.

---

## 11. Decisions for the controller to record

1. **CP-B1 verdict PASS WITH FIXES, one open blocker (CPB1-1, W28).** Which row adapts the three test files, and whether a `units` option of the frozen `buildApp` is granted for foundation tests.
2. **CPB1-2:** the logger change goes to the scaffold owner now; a sentence for rule M5 / M8: "an error is logged as `{ err }`, never under another key".
3. **F53:** option (d) confirmed by reading; add the per-unit pin and the static guard; (b) optional. The ruling stays with W45.
4. **CPB1-5:** grant or refuse the edit of `app.ts` that makes `replace` a test-only call by construction; if refused, option (2) of the finding.
5. **Design answers:** DN-5 confirmed; store to `src/db/store/` (when: now or at W91); one header hook in the engine; `windows.ts` to `src/core/`; the route walk stays in the boot step; the identity route hooks go, two handler calls stay.
6. **D12:** record the hand-built parts without an HB number (section 5) and that HB-5 and HB-13 span more than one folder.
7. **M-rules:** add to M5 the read helper (after CPB1-8) and to M10 "a stand-in route for a registry operation is never registered on the real app".

---

## 12. What was done well

- The append protocol is enforced in depth: the chain lock is the first statement of every unit, the two tables are the writers' alone, validation comes before any statement, and the digest is the shared code's.
- A refusal is fail-closed everywhere it was read: a denial whose row cannot be written is still refused; a route without a rule stops the boot; an unreadable route table stops the boot.
- Messages of the server's own errors are fixed texts; the log carries codes and identifiers. Every log call of the foundation that carries an error uses the safe key.
- Identifier handling for statements that cannot take parameters: a closed list, a branded type, a second check where the text is built.
- Type hygiene: no `any`, no non-null assertion, no suppressed compiler error in about 25,000 lines of production code.
- Static tests with positive controls keep the rules that cannot be typed (one listener, one clock, no console, no CORS, no raw URL).
- The standing rules M1 to M13 match what the code offers; where they do not (reads, error codes, log keys) the gaps are small and listed above.
