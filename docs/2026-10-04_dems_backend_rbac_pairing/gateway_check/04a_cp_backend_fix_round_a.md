# CP-B1 Fix Round A — the non-structural fixes of the backend foundation review

- **Task:** DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing
- **Controller row:** "CP-B1 fix round A" (test step label `60a`), after the review `gateway_check/04_cp_backend_foundation.md`
- **Date:** 2026-10-04, 14:46 to 15:50 WIB
- **Agent:** coder-execution (single writer of the foundation folders for this round)
- **Status:** **complete**
- **Result:** 8 fixes for 9 findings (CPB1-2, 3, 4, 6, 7, 8, 13, 14, 15) landed in ONE step at 15:43:39 (36 files: 20 changed, 16 new). CPB1-23 was closed with CPB1-2, because the guarantee of CPB1-2 depends on it (deviation DV-1).
- **End state:** whole `unit` project 110 files / 2,776 tests exit 0 (15:43:59); whole `db` project 80 files / 1,112 tests exit 0 (15:44:46); typecheck exit 0, lint exit 0 without a warning (15:47:25, 15:47:31). No red of another row remained at the end.

Tier 3 document: each statement names a file and line, a test, or a command with its output. Evidence logs are in `gateway_check/assets/04a_*`.

---

## 1. Outcome per finding

| # | Finding | Fix | Red before | Green after | Mutations |
|---|---|---|---|---|---|
| 1 | CPB1-2 (High) an `Error` under any key other than `err` leaks statement, parameters, DETAIL | The logger replaces every `Error` in the object of a line, at any key, nested, in arrays, by the safe description, before serialisation. Static test: `{ err }` is the convention; no child logger | Reproduced: the review's table, rows B to D leak (section 2.1) | 51 logger tests; the table prints `false false false` in every row | 13 of 13 |
| 2 | CPB1-7 (Medium) `describeError` loses the SQLSTATE of a wrapped error | `describeError` follows `cause` (the error and three causes); reports the code and the name of the cause that carried it. ONE helper `codedCauseOf` exported from `plugins/logger` | Reproduced: row A `code: undefined` | `code:"23505"`, `causeName: 'error'` | in the 13 |
| 3 | CPB1-3 (High; F53; D87 option (d) with both additions) | (i) the pool's start-up option; (ii) the check inside B-1; (iii) the unit's third statement pins the path; (iv) static test | Reproduced against PostgreSQL: the audit row appended through the unit's writer was NOT in `public.audit_log` (section 2.3) | 5 + 7 database tests, 12 + 4 unit tests | 6 unit (the pool) + 3 unit (the pin) + 3 database |
| 4 | CPB1-4 (Medium) the statement guard | Row-statement rule (5 rules, no parser) in `core/unit-statement.ts`; every statement of a unit's user is sent with the extended protocol | Reproduced against PostgreSQL: the forms were sent (section 2.4) | 17 unit tests, 4 database tests | 13 unit + 1 database |
| 5 | CPB1-6 (Medium) a connection lost mid-unit answers 500 | 503 `NOT_READY` (`DATABASE_UNAVAILABLE`); readiness off at once, a probe started; the connection is destroyed, no `ROLLBACK` is sent | Reproduced against PostgreSQL: `expected 500 to be 503` (section 2.5) | 36 unit tests, 4 database tests | 12 unit (the pipeline and the unit) + 3 unit (the pool) + 2 database |
| 6 | CPB1-8 (Medium) the read helper | `app.db.read(source, work)` in the pool plugin (additive) | `app.db.read is not a function` | 7 unit tests | 4 of 4 |
| 7 | CPB1-13 (Medium) tests that pin global lists | Relative order of the test's own steps; the engine's log test closed for its own lines, a deny-list for the rest | Reproduced on the scratch copies: a new boot step and a new log key turn the old tests red (section 2.7) | the same changes leave the new tests green | 2 unit + 6 demonstrations |
| 8 | CPB1-14, CPB1-15 (Medium-low) two timing-sensitive tests | The shutdown test polls after the close; the helper test compares the entries that have a role | CPB1-15 reproduced with an injected role-less backend; CPB1-14 not reproducible on demand (section 2.8) | green | 1 database (the poll still fails when a session stays) |

Mutation check in total (on the scratch copy only, rule M15): `unit` 56 of 56 (first pass 55 of 56: one of my own tests had a wrong premise and was repaired, section 5.3), `db` 8 of 8, planted violations for the two static tests 4 of 4.

---

## 2. Per finding: what changed, the test, the evidence

Lines "before" are those of the review (the pre-images under `.cache/rollback/CPB1a/`); lines "after" are of the tree as landed.

### 2.1 CPB1-2 — every `Error` is safe at every key

**Changed.** `src/plugins/logger/logger-options.ts`

| Before | After |
|---|---|
| `:78-88` serializers `req`, `res`, `err`; an error under another key was serialised with its own members (`query`, `params`, `cause` with `detail`, `hint`, `where`) | `:91-100` `loggedError(value)`: the one shape of an error in a line (`type`, `code`, `causeType?`, `message` = the code or the name, `stack` = frames). The `err` serializer is this function (`:209`) |
| — | `:121-163` `safeValue`, `:169-183` `safeLogObject`: every `Error` found in the object of a line is replaced by `loggedError`, under any key, in nested objects, in arrays, in what an object gives as its JSON form, and in instances of classes. Copy on write: the caller's object is never changed, and the same object comes back when it holds no error |
| — | `:211-214` `formatters.log`: runs on the object of EVERY line before the serializers. `req`, `res`, `err` at the top level are left to their serializers (`:103`, `:174`) |
| `:104-105` the hook scrubbed texts only | `:230-236` a value given for a `%s`, `%o` or `%j` of the text is made safe the same way |
| — | Limits, so that nothing unread is written: depth 6 (`:106`), 2,000 members per line (`:108`); what lies beyond is written as `[not logged]` (`:110`). A member that throws when read: the same |

**Not reached by the formatter:** the bindings of a child logger. The installed logger applies no formatter to them (`node_modules/pino/lib/proto.js:98`, `resetChildingsFormatter`). No production source creates a child logger; the static test keeps that.

**Tests.**

| File (project) | Tests | What |
|---|--:|---|
| `src/plugins/logger/__tests__/error-keys.test.ts` (unit) | 17 | The review's five-row table with the installed `DrizzleQueryError` around the installed `DatabaseError` (code `23505`, `detail`, `hint`, `where`, `internalQuery`); deep and in arrays; a driver error under another key; an error as a value for the text; the whole captured log. Then CPB1-7 and CPB1-23 |
| `src/plugins/logger/__tests__/safe-log-object.test.ts` (unit) | 12 | `safeLogObject`: identity when clean, no change in place, `req` / `res` / `err` at the top only, the depth limit, a structure that refers to itself, the member limit, the JSON form, a throwing member, an instance of a class; every level of the logger; a request's line; the persistent error log; `codedCauseOf` |
| `src/plugins/logger/__tests__/error-keys.db.test.ts` (db) | 11 | A REAL unique violation from PostgreSQL through `unit.db` (statement on `engine_counters`, parameter 918273645, `DETAIL: Key (name)=(event) already exists.`), logged under `err`, `error`, `cause`, nested, in a list, and the driver's error alone; as an unexpected failure of a request (500, log and persistent log hold `23505` only) |
| `test/static/log-calls.test.ts` + `log-calls.ts` (unit) | 7 | Server-wide: section 2.9 |

**Red before** (`assets/04a_01_logger_red_before.log`, 15:03:54, the new table on the old code: `Tests 13 failed | 4 passed (17)`):

```
A key err               | statement:false param:false pgDetail:false code:undefined type:"Error"
B key error             | statement:true param:true pgDetail:true code:undefined type:undefined
C key cause             | statement:true param:true pgDetail:true code:undefined type:undefined
D nested                | statement:true param:true pgDetail:true code:undefined type:undefined
E key err, driver error | statement:false param:false pgDetail:false code:"23505" type:"error"
```

Against PostgreSQL on the old code (`assets/04a_04_new_db_tests_RED_before.log`, 15:30:17): `expected [ 'the statement', 'the DETAIL', …(1) ] to deeply equal []`.

**Green after** (`assets/04a_02_logger_green_after.log`, 15:04:04: `Test Files 3 passed (3)`, `Tests 51 passed (51)`):

```
A key err               | statement:false param:false pgDetail:false code:"23505" type:"Error"
B key error             | statement:false param:false pgDetail:false code:"23505" type:"Error"
C key cause             | statement:false param:false pgDetail:false code:"23505" type:"Error"
D nested                | statement:false param:false pgDetail:false code:"23505" type:"Error"
E key err, driver error | statement:false param:false pgDetail:false code:"23505" type:"error"
```

### 2.2 CPB1-7 — the safe description follows `cause` (and CPB1-23, DV-1)

**Changed.** `src/plugins/logger/error-log.ts`

| Before | After |
|---|---|
| `:64-76` `describeError` read `error.code` only | `:70` `CAUSE_CHAIN_DEPTH = 4` (the error and three causes, the depth of the four existing copies); `:88-96` `codedCauseOf(error)`: the first error of the chain with a string `code`, with its code and depth; `:135-145` `describeError`: the code of the error or of the first cause that has one; `causeName` names that cause when it is not the error itself. No message is read, of the error or of a cause, and nothing else of a cause |
| `:67-70` the stack filter kept every line that starts with white space and `at` | `:103` `FRAME_LINE` (the form of a V8 frame), `:111-121` `stackFramesOf`: the message is cut out of the stack first, then only lines in the form of a frame are kept |
| `ErrorLogEntry` | `:47` `causeName?` |

Exported from where the scaffold exports its error utilities, `src/plugins/logger/index.ts`: `codedCauseOf`, `CAUSE_CHAIN_DEPTH`, `type CodedCause` (beside `describeError`). The other copies are not replaced in this round (section 4).

**CPB1-23 was a leak under the key `err` too, reproduced.** A statement of several lines whose second line has the form of a frame (`    at <text> (statement.sql:1:1)`) was written into `err.stack` by the old filter: on the old code row A of the table fails with `expected [ 'statementLine' ] to deeply equal []`, and the test of the frames fails with `expected '    at MARK-statement-line-77e2 (stat…' not to contain 'MARK-statement-line-77e2'`. Fix 1 promises "no statement text" at every key, so the filter was repaired with it.

**Tests** (in `error-keys.test.ts`): the wrapped database error gives `{ errorName: 'Error', code: '23505', causeName: 'error', stackTrace }`; the error's own code comes first; the depth is bounded (a code three causes down is found, four is not) and a chain that loops ends; a cause that is not an error, or a code that is not a text, is not reported; the frames never hold a line of the message, also when the message was changed after the stack was written.

### 2.3 CPB1-3 — the search path (finding F53; decision D87, option (d) with both additions)

One value, `public,pg_temp` (no space: the start-up option is split at white space; PostgreSQL reports exactly this text, measured).

| Part | Before | After |
|---|---|---|
| (i) the pool | `src/plugins/db/index.ts:55-67`: no `options` | `:56` `RUNTIME_SEARCH_PATH = 'public,pg_temp'`, `:58` `RUNTIME_CONNECTION_OPTIONS = '-c search_path=public,pg_temp'`, `:121` `options: RUNTIME_CONNECTION_OPTIONS` in `createRuntimePool` |
| (ii) boot check, inside B-1 | `:184-189`: `SELECT 1` | `:218-242` `checkSearchPath()`, called at `:303` after the probe: `SELECT current_setting('search_path') AS search_path` (`:60`) on a pooled connection must be exactly the value. Else: one error line `boot check failed` (`step: 'B-1'`, `code: 'SEARCH_PATH_NOT_PINNED'`, `expected`, `found` cut to 120 characters), one persistent entry (level `fatal`, source `db.boot`), and the boot stops with `DatabaseBootError` (`:65`, `code: 'SEARCH_PATH_NOT_PINNED'`). No boot step was added: B-1 is two statements now |
| (iii) per unit | `src/core/unit-of-work.ts:44` `SELECT set_config('statement_timeout', $1, true)` | `:59` `SELECT set_config('statement_timeout', $1, true), set_config('search_path', $2, true)`, sent at `:236` with `[ms, RUNTIME_SEARCH_PATH]`. One statement, as before: no extra round trip |
| (iv) static test | — | `test/static/search-path.test.ts` (section 2.9) |

`TEMPORARY` was not revoked; no role, grant or server setting was changed.

**The owner's test, against PostgreSQL** (`src/core/__tests__/search-path.db.test.ts`, 5 tests, as `dems_app`, pool `max: 1`, built WITHOUT the start-up option so that (iii) alone is under test):

1. *The hazard is real:* with the default path, after `CREATE TEMP TABLE audit_log (LIKE public.audit_log)`, the bare name `audit_log` is the table in `pg_temp_N` (passes on the old and the new code).
2. *The unit:* temporary tables `audit_log` and `events` are created outside a unit on the pool's one connection; a unit on that connection (same backend PID, asserted) appends an audit row and an event through its writers. The row and the event are in `public.audit_log` and `public.events` (read as `dems_owner` on another connection), the head moved, the temporary tables are empty, `verifyAuditChain` is ok over all rows; inside the unit `current_setting('search_path')` is `public,pg_temp`, after it the session has `"$user", public` again.
3. The query builder and an unqualified `SELECT … FROM operators` in a unit read the real tables; a unit that rolls back leaves the session's path as it was.

**Red before (iii)** (`assets/04a_04…`, old code, real server): the unit "committed" and the row was nowhere in the real table:

```
AssertionError: expected { pid: 16172, path: '"$user", public' } to deeply equal { pid: 16172, path: 'public,pg_temp' }
AssertionError: expected undefined to deeply equal { seq: 1, id: 'AUD-000001', …(12) }
```

(Two tests of the file on the old code: the first assertion of the unit test, and the later test that looks for the appended row in the real table and finds none. Mutation D2 of section 5.2 removes the pin only and gives the same: `tests 4 failed | 1 passed (5)`.)

**The pool, against PostgreSQL** (`src/plugins/db/__tests__/search-path.db.test.ts`, 7 tests): four connections of `createRuntimePool` opened at once each report `public,pg_temp`; on such a connection, with temporary tables `audit_log` and `events` in place, the bare names are the PUBLIC tables; the control pool without the option has `"$user", public` and finds the temporary table; the boot passes B-1 on the runtime pool; a pool built without the option stops the boot at B-1 with `SEARCH_PATH_NOT_PINNED` and `found: '"$user", public'`; a pool whose option names the temporary schema first: the same with `found: 'pg_temp,public'`; and a default stored FOR THE DATABASE (`ALTER DATABASE <clone> SET search_path = pg_temp, public`, on a clone of the run only) does not reach a connection of the runtime pool: the client's start-up option wins.

**Red before (i), (ii):** `expected [ '"$user", public', …(3) ] to deeply equal [ … ]`, `expected { audit: false, events: false } to deeply equal { audit: true, events: true }`, `expected 'B-6' to be 'B-1'` (the old boot does not stop a pool without the option).

**Database-free** (`src/plugins/db/__tests__/search-path.test.ts`, 12 tests): the value and the option; six wrong values (PostgreSQL's default, the temporary schema first, the same schemas with a space, the project schema alone, another schema first, an empty path) each stop the boot at B-1 with the code, the line and the persistent entry; no row or a value that is not a text: refused the same way; a long value is cut; when the question itself fails, B-1 fails as "the database does not answer" by the driver's code.

### 2.4 CPB1-4 — the statement guard of a unit

**Decision on the form.** A unit of work "is one transaction that changes rows" (the file's own header). So the guard says what a statement of a unit IS, instead of listing what it is not: a ROW statement. It reads the text without a parser, in `src/core/unit-statement.ts` (new, 163 lines):

| Rule | Text | Refuses |
|---|---|---|
| R1 `UNREADABLE` | every quote and comment ends (`withoutLiterals`, `:68`) | an open string, quoted name, comment or dollar quote |
| R2 `NOT_A_ROW_STATEMENT` | after white space, comments and opening parentheses the text starts with `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `WITH`, `VALUES`, `SET LOCAL` or `SET CONSTRAINTS` (`:139`) | `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `RELEASE`, `END`, `ABORT`, `SET`, `RESET`, `DISCARD`, every `CREATE`, **`DO`**, `CALL`, `PREPARE`, `EXECUTE`, `LISTEN`, `NOTIFY`, `LOCK`, `TRUNCATE`, `DROP`, `ALTER`, `GRANT`, `COPY`, `DECLARE`, `SHOW`, `EXPLAIN`, an empty text |
| R3 `SEVERAL_STATEMENTS` | nothing but white space follows the first `;` (`:141`) | **`…; COMMIT`**, `SELECT 1; SELECT 2` |
| R4 `CREATES_A_TABLE` | `INTO` only as `INSERT INTO` or `MERGE INTO` (`:143`) | **`SELECT … INTO TEMP`**, `INTO TEMPORARY`, `INTO UNLOGGED`, `INTO name`, `INTO pg_temp.name` |
| R5 `TRANSACTION_CONTROL`, `SESSION_SETTING`, `TEMPORARY_SCHEMA` | none of these words outside strings, quoted names and comments (`:145-149`) | `commit`, `rollback`, `savepoint`, `start transaction`, `prepare transaction`; **`set_config(`**, `search_path` (so also `SET LOCAL search_path`); `pg_temp`, `pg_temp_N` |

The words of R4 and R5 are searched in the text WITHOUT its strings, quoted names and comments, so a row statement may hold any of them as a value (`WHERE reason = 'ROLLBACK; COMMIT'`). Strings follow the standard: a quote is doubled; a backslash escapes only in an `E'…'` string.

`src/core/unit-of-work.ts`: before `:59-60` (first-keyword pattern) and `:252-277`; after `:70-72` (`isTransactionControl` keeps its name and now means "the unit refuses it"), `:287-295` (the refusal; the error text names the rule and never the statement), `:74-82` and `:305-306` (**the extended protocol**: every statement of the unit's user is sent as `{ …, queryMode: 'extended' }`, with values or without, so the server refuses a text with more than one command; the unit's own five statements are constants).

**What remains possible, and why it is accepted.**

| Remains | Why accepted |
|---|---|
| A function called from a `SELECT` with an effect that outlasts the unit (`pg_advisory_lock`, `pg_notify`). The guard names one function, not every function | No production source calls one (search); it leaves a lock or a message, not a table that shadows another |
| `SET LOCAL` of a setting other than the path (the unit's own statement limit) | Ends with the transaction; the pipeline's watchdog still abandons a unit after its limit |
| A text this reader takes for one statement and the server for two | The protocol: PostgreSQL refuses it with `42601` (measured, below) |
| A temporary table that code OUTSIDE a unit left on the connection | The unit's pin (2.3): a table named without its schema is the real one. This is the real protection; the guard is against accidents |
| An unquoted column named `commit`, `rollback`, `savepoint`, `into`, `search_path` in a statement of a unit | The schema has none; such a statement is refused, and its sender reports it |

**Tests.** `src/core/__tests__/unit-statement.test.ts` (unit, 17): the texts the server sends pass unchanged (the two counter statements, eight texts generated by the query builder for the typed tables, among them `on conflict … do update` and a parenthesised `union`; **every statement constant the identity module exports**, 15 or more; 27 row statements in the forms a module may write, with the words of the rules inside strings, comments, an `E` string and a dollar quote); 80 refused texts, each by its rule; the reader of literals; inside a unit the refusals reach no connection and the unit commits; every statement of the user asks for the extended protocol; the copy made for the driver. `src/core/__tests__/unit-guard.db.test.ts` (db, 4): fourteen refusals inside one real unit and one through the query builder: the transaction is not failed, the unit commits, and nothing is left on the connection (no temporary table, no prepared statement, no channel; path and statement limit of the session are the server's defaults); what two of the forms do on a plain connection; the protocol; row statements still run.

**Measured against PostgreSQL 18.4** (`unit-guard.db.test.ts`): `SELECT 1 AS one; SELECT 2 AS two` runs both commands with the simple protocol and is refused with SQLSTATE `42601` with the extended one; on a plain connection `SELECT * INTO TEMP audit_log …` leaves a table that the bare name then means, and `UPDATE …; COMMIT` commits in the middle of the caller's transaction.

**Red before** (old code, real server): the test "fourteen refusals" fails, because the old guard sent the forms. Mutation D4 (the guard not asked): `files 2 failed (2); tests 2 failed | 21 passed (23)`.

**The module rows in flight.** The whole `db` project was run once after the landing: 80 files, 1,112 tests, exit 0. No test of a module row turned red; no statement a module sends today is refused.

### 2.5 CPB1-6 — a connection lost in the middle of a unit

**Changed.**

| File | Before | After |
|---|---|---|
| `src/core/errors.ts` | — | `:121-136` the connection class: SQLSTATE class 08 (`/^08[0-9A-Z]{3}$/`), `57P01`, `57P02`, `57P03`, and the driver's socket errors (`ECONNRESET`, `ECONNREFUSED`, `ECONNABORTED`, `EPIPE`, `ETIMEDOUT`, `ENOTCONN`, `EHOSTUNREACH`, `ENETUNREACH`, `ENETDOWN`); `:138` `isConnectionFailureCode`, `:148` `isConnectionFailure` (reads the code through the `cause` chain) |
| `src/core/unit-of-work.ts` | `:132-134` the `error` event only marked the unit; `:273-276` a failed statement was rethrown | `:138`, `:151-154`, `:180-182` the unit remembers what took its connection away: the `error` event of the client, or (`:309`) a statement that failed with a code of the class. `:429-434` nothing is sent to a lost connection (no `ROLLBACK`) and it is destroyed, never returned to the pool |
| `src/core/pipeline.ts` | `:233-265` only `DATABASE_UNAVAILABLE` and `COMMIT_FAILED` told readiness; anything else reached the caller raw (500) | `:248-253` a failed unit that lost its connection is rejected with `PipelineFailure(DATABASE_UNAVAILABLE, cause)`: 503 `NOT_READY`, the pipeline's existing class (one error line `unit not committed` and one persistent entry per outage). `:88` new dependency `onConnectionLost`, called before `onDatabaseFailure` |
| `src/core/index.ts` | `:114-117` | `:125-130` `onConnectionLost: () => app.db.connectionLost()` |
| `src/plugins/db/index.ts` | — | `:99`, `:277-282` `connectionLost()`: the flag off at once, the last probe result forgotten, a fresh probe started |

The readiness plugin's files were not touched.

**How readiness reflects it.** As after an error on an idle connection of the pool (the scaffold's own path): `ready.database` is set off at the loss and stays off until the next probe that succeeds. The pool starts that probe at once, so when only the unit's backend went away the flag is off for one round trip (`readiness changed` false, then true); while the database stays away it stays off. A probe result from before the loss is not reused.

**The 503 wins over what the work threw.** If the work caught the failed statement and returned, or threw a refusal of its own (a 409 decided on a statement that never answered), the caller still gets the 503: nothing was stored and the decision rests on nothing. Stated in the header of `pipeline.ts`.

**What was provoked for real, and what was not.**

| | How | Result |
|---|---|---|
| **Real, against PostgreSQL** (`src/core/__tests__/connection-lost.db.test.ts`, 4 tests, cloned database) | The socket of the unit's own client is destroyed from the test's side (`client.connection.stream.destroy()`) while the unit holds `BEGIN` and the chain lock: during a statement, between two statements, and in the app on the runtime pool behind a scratch route | The driver reports `Error` without any code (`[cpb1-6] the driver's error for a closed socket: name Error, code undefined`) and the client's `error` event. The unit answers 503 `DATABASE_UNAVAILABLE`; the stored head and row count are unchanged (read as `dems_owner`); the next unit gets the lock at once on another backend and commits the very next sequence; in the app the request answers 503 `NOT_READY`, `ready.database` logs `true, false, true`, no "unexpected error" entry, the next request answers 200 |
| **Not real: a stand-in connection** (`src/core/__tests__/connection-lost.test.ts`, 36 tests) | A stand-in client whose statement rejects with each code of the class (`08000`, `08003`, `08006`, `08001`, `08004`, `08007`, `08P01`, `57P01`, `57P02`, `57P03`, `ECONNRESET`, `EPIPE`, `ETIMEDOUT`, `ECONNREFUSED`, `ENOTCONN`), also wrapped by the query builder; the `error` event with a codeless error; the app with a stand-in pool, a database that answers and one that stays away | 503 with the driver's error as cause, readiness told `lost` then `failure`, no `COMMIT` and no `ROLLBACK` sent, connection destroyed, one error line by the two codes |
| **Not provoked at all** | A PostgreSQL that stops or restarts (P7), and the end of a backend by the server | — |

**What stays as it was** (11 codes tested): a statement that fails with any other SQLSTATE (`22012`, `23505`, `40001`, `42P01`, …) is the caller's failure: the same error, a rollback, readiness not told. A failure without a code and without an `error` event (a value the driver cannot send) is not a loss. `57014` is still the time-out refusal. No connection at the start of a unit is told as before.

**Red before** (old code): real server `expected Error: Connection terminated unexpectedly to be an instance of PipelineFailure`, `expected 500 to be 503`; stand-in `expected 500 to be 503` (3 times), `expected Error: … EPIPE { code: '…' } to be an instance of PipelineFailure`.

### 2.6 CPB1-8 — `app.db.read(source, work)`

`src/plugins/db/index.ts:92` (the type), `:259-276`:

```ts
read<T>(source: string, work: (pool: Pool) => Promise<T>): Promise<T>;
```

`work` gets the CURRENT pool (after a `reopen()` the new one) and returns what it read. A rejection that is not an `ApiFailure` is the database's failure: one error line `a read on the pool failed` with `{ err, source }`, one persistent entry by the code with `{ database, generation }`, a fresh probe, and the rejection is `notReady()` (503). An `ApiFailure` thrown by `work` passes unchanged. This is the block of the identity module (`src/modules/identity/sessions.ts:141-152`), with the pool handed over instead of the module's `Queryable`, so that the RBAC module's form (`readStoredMatrix(pool)`) and the query builder fit too.

Tests: `src/plugins/db/__tests__/read.test.ts` (unit, 7). Red before: `TypeError: app.db.read is not a function` (6 tests).

No module folder was touched. The replacements are in section 4.

### 2.7 CPB1-13 — tests that pinned global lists

| File | Before | After |
|---|---|---|
| `src/core/__tests__/support.ts` | — | `BOOT_CHECKS` (B-1 to B-9), `passedAmong(passed, steps)`: of the steps that passed, those a test names, in the order in which they passed; `answersBootStepOne` |
| `src/core/__tests__/seeded.db.test.ts:28-43` | the exact list of ALL boot steps, ending with `engine.rehydrate`, `rbac.matrix` | the whole boot resolves; of the nine checks, all passed in the contract's order |
| `src/core/__tests__/boot-checks.db.test.ts:59-63`, `:93-94`, `:197-198` | `passed` = every step; `stopped.stepId` `toBe('engine.rehydrate')` | `passed` = the nine among them; the step that stopped the boot is none of the nine |
| `src/core/__tests__/core-plugin.test.ts:240-244`, `:251-252`, `:263-264`, `:298` | the same | the same |
| `test/db/boot-checks.db.test.ts:316-320`, `:351-353` | the same | the same (`NINE_BOOT_CHECKS` from the plugin's and the contract's constants) |
| `src/engine/__tests__/restart.db.test.ts:24-30` | `BOOT_STEPS` = all eleven steps of that moment | the engine's own: the nine checks, then `engine.rehydrate`, compared through `passedAmong` |
| `src/engine/__tests__/commands.db.test.ts:716-730` | ONE closed set of keys over every line after the start | (1) closed for the engine's own lines (its messages, the lines of its hosted actions, the lines of units labelled `engine.`): 29 keys; (2) every other line: no key that names a secret (`pass`, `secret`, `token`, `credential`, `authorization`, `cookie`, `salt`, `hash`, `pairingcode`, `qrpayload`), no value in the form of a credential (`looksLikeSecret`); (3) the whole log: `credentialLeaks` is empty |

The guard row's files (`src/plugins/permission-guard/**`, `src/modules/rbac/**`) were not touched.

**Red before / green after, shown on the two scratch copies** (`assets/04a_10_pins_red_green.log`; `before` = the tests as they were, `tree` = the tests of this round; each case changes one production file the way a later row would):

```
a later row adds a boot step between B-9 and the engine (unit) [before]: RED — files 1 failed (1); tests 2 failed | 12 passed (14)
a later row adds a boot step between B-9 and the engine (unit) [tree]:   GREEN — tests 14 passed (14)
a later row adds a boot step between B-9 and the engine (db) [before]:   RED — files 4 failed (4); tests 7 failed | 40 passed (47)
a later row adds a boot step between B-9 and the engine (db) [tree]:     GREEN — files 4 passed (4); tests 47 passed (47)
another unit logs a new, harmless key on a line of its own [before]:     RED — tests 1 failed | 19 passed (20)
another unit logs a new, harmless key on a line of its own [tree]:       GREEN — tests 20 passed (20)
another unit logs a key that names a secret [tree]:                      RED — tests 1 failed | 19 passed (20)
another unit logs a value in the form of a session token [tree]:         RED — tests 1 failed | 19 passed (20)
the engine logs a new key on a line of its own [tree]:                   RED — tests 1 failed | 19 passed (20)
```

The new tests still see a wrong order and a missing check: mutations T1 (the checks registered in reverse order) and T2 (B-8 not registered) are detected.

### 2.8 CPB1-14 and CPB1-15 — two timing-sensitive tests

| Finding | File | Change | Evidence |
|---|---|---|---|
| CPB1-14 | `src/engine/__tests__/restart.db.test.ts:556-561` (now `:569-584`) | After `app.close()` the question "sessions of `dems_app` on this database" is asked until the answer is 0, every 50 ms, for 5 s at most. It was already keyed by the test's own database | **Not reproduced:** the race (the driver's `pool.end()` resolving before the server removed the backend, F63 lesson 2) is a few milliseconds wide and did not occur on demand. Why the new code is right: it accepts 0 at any moment within 5 s and nothing else. It still fails when a session really stays: mutation D8 (the pool is never closed) gives `tests 2 failed | 12 passed (14)` |
| CPB1-15 | `test/helpers/db/__tests__/drop-retry.db.test.ts:87` (now `:86-91`) | The list of backends is compared after the entries WITHOUT a role are left out: a client session has a role, an autovacuum worker has none (D76) | Reproduced with an injected role-less group in `backendsOn` on the scratch copies: the old test `1 failed | 6 passed (7)`, the new one `7 passed (7)` (`assets/04a_10…`, last two lines) |

### 2.9 The two static tests (server-wide, `apps/core-server/test/static/`)

**`log-calls.test.ts`** (with the reader `log-calls.ts`, not a test file). In production sources under `src/`:

1. the object literal of a log call (`log.<level>(`, `logger.<level>(`) holds no member named `error`, `cause`, `e` or `reason`, in the short form or keyed, at any depth of the literal. A keyed member whose value is fixed in the source (a string, a number, a constant in capitals such as `CREDENTIAL_CONFLICT_REASON`, a member in capitals such as `PipelineRefusal.CLOSED`) cannot be something that was caught and is not refused;
2. no child logger is created (`log.child(`).

It passes on the tree as it is, the six module folders in flight included. **No module file violates it** (nothing to list). **The allow-list is explicit and has ONE entry, in the foundation** (deviation DV-2):

| File | Member | Holds |
|---|---|---|
| `src/plugins/readiness/index.ts:83`, `:85` | `{ reason, held }` (short form, 2 times) | the NAME of a readiness hold: `hold(reason: string)` |

That file is the readiness plugin's and was outside my write paths for this fix. (`src/plugins/authenticate/index.ts:236` logs `reason: CREDENTIAL_CONFLICT_REASON`, a constant: passed by rule 1, not by the list.) A test asserts that the foundation part of the list is exactly this entry.

What the scan does not see: an object built in a variable and logged by its name (`src/core/pipeline.ts:258`, `const line = { …, cause: <a code> }`), and a member that arrives through a spread. The logger is the protection there.

**`search-path.test.ts`.** In production sources under `src/` (TypeScript without comments, SQL as it is) the words `TEMP`, `TEMPORARY` (any case, as a word), `pg_temp`, `search_path` and `set_config(` appear in exactly these files:

| File | What it does with them |
|---|---|
| `src/plugins/db/index.ts` | pins the path on every connection of the runtime pool and reads it back in B-1 |
| `src/core/unit-of-work.ts` | pins the path, with the statement limit, for the transaction of every unit |
| `src/db/migrations/0002_audit_guards.sql:17`, `:30` | the two `SECURITY DEFINER` functions pin their own path (`pg_catalog, public, pg_temp`) |

The list is exact both ways: another file fails the test, and so does a listed file that no longer holds them. `src/core/unit-statement.ts` (the guard that refuses these words) is not in the list and is not found: it holds them only inside regular expressions, behind an anchor.

Planted violations on the scratch copy (`assets/04a_11_static_planted.log`): `log.warn({ error }, …)`, `log.child(…)`, a string `CREATE TEMP TABLE …`, a string with `set_config(` in a module file: each turns its test red, naming `src/modules/health/index.ts`.

---

## 3. What a module row may notice

| # | What | Before | Now | Who notices, and what to do |
|---|---|---|---|---|
| 1 | **A statement of a unit that is not a row statement** | Refused only when its FIRST word was transaction control, `SET` / `RESET` / `DISCARD` or `CREATE` | Refused unless it is one `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `WITH`, `VALUES`, `SET LOCAL` or `SET CONSTRAINTS` statement; also refused: a second statement, `SELECT … INTO`, and outside strings the words `commit`, `rollback`, `savepoint`, `start transaction`, `prepare transaction`, `set_config(`, `search_path`, `pg_temp` | A module that sends `LOCK TABLE`, `SHOW`, `EXPLAIN`, `CALL`, `DO`, `TRUNCATE`, `LISTEN`, `NOTIFY`, `PREPARE` through `unit.query` / `unit.db` gets `CoreError` `UNIT_STATEMENT_NOT_ALLOWED` (a 500). None does today (whole `db` project). Report the statement; the list is one pattern (`unit-statement.ts:139`) |
| 2 | The text of that `CoreError` | fixed | the same text plus ` (rule <NAME>)` | a test that pins the whole message |
| 3 | **The protocol of a unit's statements** | values: extended; no values: simple | always extended | A stand-in client now receives `{ text, queryMode: 'extended' }` instead of a string for `unit.query('…')` without values. Read the text as `typeof q === 'string' ? q : q.text` (every stand-in in the tree does) |
| 4 | **The third statement of every unit** | `SELECT set_config('statement_timeout', $1, true)` | `SELECT set_config('statement_timeout', $1, true), set_config('search_path', $2, true)`, values `[ms, 'public,pg_temp']` | a test that pins a unit's statement list by literal text (one did: `src/engine/__tests__/plugin.test.ts:113`, adapted). Tests that classify by `text.includes('set_config')` are unaffected |
| 5 | The search path inside a unit and on every connection of the runtime pool | `"$user", public` | `public,pg_temp` | a bare table name never means a temporary table |
| 6 | **Boot step B-1** | `SELECT 1` | `SELECT 1`, then `SELECT current_setting('search_path') AS search_path` | A database-free test that BOOTS with a stand-in pool: the pool must answer that question with `public,pg_temp`, or the boot stops at B-1 (`SEARCH_PATH_NOT_PINNED`). Use `standInDatabase()` (it answers), or `answersBootStepOne` of `src/core/__tests__/support.ts`. A `createPool` that builds a REAL pool by hand must pass `options: RUNTIME_CONNECTION_OPTIONS` (`createRuntimePool` does) |
| 7 | **A connection lost in the middle of a unit** | the caller got the driver's error (500), or what the work threw | `PipelineFailure` 503 `NOT_READY`, reason `DATABASE_UNAVAILABLE`, whatever the work threw; no `ROLLBACK` is sent; the connection is destroyed | a handler that lets the rejection go answers 503. `ready.database` goes off and, when the database answers, on again |
| 8 | Log lines of such a unit | a debug line `unit rolled back` | an error line `unit not committed` (`code: DATABASE_UNAVAILABLE`, `cause: <driver code or name>`) and a persistent entry, once per outage; two `readiness changed` lines | a log-capture test |
| 9 | **The shape of an error in a log line (`err`)** | `{ type, code, message, stack }`; `code` only from the error itself | `code` also from the `cause` chain; `causeType` when it came from a cause; `message` is then that code; `stack` holds frames only | a test that compares `err` exactly for a wrapped database error: `code` is `'23505'`, no longer undefined |
| 10 | An `Error` under any other key of a line | its own members as they were | the same object as under `err` | — (nothing in the tree logged one) |
| 11 | A log object deeper than 6 levels, or with more than 2,000 members | written | `[not logged]` | none expected |
| 12 | `describeError()` | `{ errorName, code?, stackTrace? }` | plus `causeName?`; `code` from the chain | an entry of the persistent error log built with `...describeError(error)` may carry `causeName`, and a code where there was none |
| 13 | `Database` (`app.db`) | `pool`, `generation`, `probe`, `close`, `reopen` | plus `read`, `connectionLost` | additive |
| 14 | Two new static tests in the `unit` project | — | section 2.9 | a module file that logs `{ error }`, `{ cause }`, `{ e }`, `{ reason }` with a value that is not fixed, creates a child logger, or holds `TEMP` / `TEMPORARY` / `pg_temp` / `search_path` / `set_config(` in code or a string fails the `unit` project by `file:line` |
| 15 | `src/core/__tests__/support.ts` | — | `standInDatabase()`: `sent` (text, protocol, values), `failOnPool`, the pool answers the path question; `BOOT_CHECKS`, `passedAmong`, `answersBootStepOne` | additive |

Unchanged: `app.pipeline.run`, the unit's tools, `app.db.pool`, the logger's API, every answer of the error envelope, the list of boot steps.

**Sentences for the standing rules** (the controller's to add):

- M5: "A read outside a unit goes through `await app.db.read('<module>.<what>', (pool) => …)`; do not copy the block. A statement of a unit is ONE row statement: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `WITH`, `VALUES`, `SET LOCAL`, `SET CONSTRAINTS`."
- M9: "A database-free test that boots: the stand-in pool answers B-1 (`standInDatabase()`, or `answersBootStepOne`)."
- M10: "To assert boot steps use `passedAmong(passed, steps)` of the core's test support with the test's own steps."

---

## 4. Left for the structural round, with exact lines

| # | What | Where | Change |
|---|---|---|---|
| S-1 | The identity module's copy of the read block (CPB1-8) | `src/modules/identity/sessions.ts:141-152` | Two lines: the body becomes `return app.db.read(source, (pool) => work(onPool(pool)));` and `READ_FAILED` (`:134`) goes. Its log message changes from "the identity module could not read the database" to "a read on the pool failed"; check `src/modules/identity/__tests__/` for that text |
| S-2 | The RBAC module's copy | `src/modules/rbac/index.ts:66-84` | `stored = await app.db.read('rbac.getRoleMatrix', (pool) => readStoredMatrix(pool));`. Its line was written with `request.log` (it carried the request ID) and the entry had `context.requestId`; with the helper the line is the app's. If the request ID is wanted, `read` needs an optional context |
| S-3 | **A third copy, written by the pairing row in flight** (the review predicted it) | `src/modules/pairing/database.ts:25-38`, used at `codes.ts:67`, `:99`, `devices.ts:94`, `:103`, `:156`, `resolver.ts:88`, `:111` | The same two lines as S-1, by its owner |
| S-4 | The cause-walking copies (CPB1-7) | `src/core/errors.ts:158-166` (`driverErrorOf`), `:172-180` (`sqlStateOf`); `src/db/seed/store.ts:62-76`; `src/db/fixtures/load.ts:55-66`; `src/db/reset/errors.ts:156-170`, `:173-181` | Call `codedCauseOf` of `plugins/logger`: `sqlStateOf = (e) => codedCauseOf(e)?.code`, `driverErrorOf = (e) => codedCauseOf(e)?.error ?? e`. The three `db/` copies also read `constraint` (and `table`): take it from `codedCauseOf(e)?.error` |
| S-5 | The second stack filter | `src/engine/host.ts:181-187` (`framesOf`: every line that starts with white space and `at`, the form CPB1-23 names) | Use `describeError(error).stackTrace` |
| S-6 | The one allow-list entry of the log static test | `src/plugins/readiness/index.ts:83`, `:85` | By the plugin's owner: rename the logged key (for example `hold: reason`), then delete the entry in `test/static/log-calls.test.ts` (`ALLOWED`). No test in the tree reads the key `reason` of the two `readiness hold` lines (search at 15:50; the engine's closed list named it and is now a deny-list for those lines); `src/modules/demo/reset.ts:133` names the lines in a comment |
| S-7 | A key named `cause` that holds a code | `src/core/pipeline.ts:258` (`const line = { …, cause: … }`) | Optional: rename to `causeCode`. Not done here: it changes a log line that tests of other rows may read |
| S-8 | Not in this round by the brief | `ApiFailure.code` typed by the contract (CPB1-9), the moves (CPB1-10, 11, 12, 16), `app.ts` (CPB1-5) | — |

---

## 5. Verification

### 5.1 Whole projects, typecheck, lint (the tree, after the landing)

```
$ npm run typecheck -w @dems/core-server                         (15:43:45, again 15:47:25)   exit 0
$ npm run lint -w @dems/core-server                              (15:43:52, again 15:47:31)   exit 0, no warning
$ npm run test -w @dems/core-server -- --maxWorkers=2            (15:43:59)
 Test Files  110 passed (110)
      Tests  2776 passed (2776)
   Duration  29.72s                                                                            exit 0
$ DEMS_TEST_STEP=60a npm run test:db -w @dems/core-server -- --maxWorkers=2   (15:44:46 to 15:46:27)
 Test Files  80 passed (80)
      Tests  1112 passed (1112)
   Duration  100.24s
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 456 ms; 0 remain with the run prefix dems_test_step_60a_tmdkamw3_   exit 0
```

**Failures of other rows at my end: none.** Earlier, at 14:56:17, the first run on the scratch copy showed two red tests in `src/modules/network-time/__tests__/` (`routes.test.ts`, `static.test.ts`), in flight then (the controller reported that row as landed at 15:12); the three files of the guard row (D85) were green in every run of this round.

**Runs before the landing, on the scratch copy** (the tree of 15:31 plus this round's changes): whole `unit` once at 15:31:49, 110 files / 2,776 tests, exit 0; `db` for `src/core src/engine src/plugins src/modules/identity src/modules/rbac test/db/boot-checks.db.test.ts` and the helper test at 15:32:39, 26 files / 363 tests, exit 0.

### 5.2 Mutation check (scratch copy only; `assets/04a_08_mutations_unit.log`, `04a_09_mutations_db.log`, script `04a_mutate.py.txt`)

Each mutation changes one production file of the scratch copy, runs the tests of the folder, and puts the file back; the hashes of the scratch sources before and after are equal.

| Area | Mutations | Detected |
|---|--:|--:|
| The logger's sanitiser and describer (L1 to L13): the formatter off; causes not read; the old stack filter; the loose frame form; arrays not read; nested objects not read; past the depth limit written; past the member limit written; a value for the text not described; `req` / `res` / `err` skipped at every depth; the JSON form not read; the cause's name not reported; the caller's object changed in place | 13 | 13 |
| The pool (P1 to P13): no start-up option; the boot check not run; any path with `public` accepted; the temporary schema first; no row accepted; the failure not logged; `read()` without a probe, letting the driver's error go, turning a refusal into 503, not persisting; `connectionLost()` keeping the last probe result, leaving the flag on, starting no probe | 13 | 13 |
| The unit (U1 to U16): no pin; the pin for the session; the value not sent; the guard not asked; each of R1 to R5 removed or loosened; strings read as code; a backslash escaping everywhere; each forbidden word removed; no extended protocol; extended only with values | 16 | 16 |
| The lost connection (C1 to C12): no 503; readiness not told; each third of the class removed; every failure a loss; the `error` event ignored; a class failure ignored; a rollback sent and the connection returned; the app not telling the pool; no cause; the wrong reason | 12 | 12 |
| The relative-order tests (T1, T2): the checks in reverse order; B-8 not registered | 2 | 2 |
| Against PostgreSQL (D1 to D8): no option; no pin; the pin for the session; the guard not asked; no 503; the `error` event ignored; the formatter off; the pool never closed | 8 | 8 |
| Planted violations for the two static tests | 4 | 4 |
| **Total** | **68** | **68** |

### 5.3 What the first pass missed

L4 (the frame form loosened to "any line that starts with `at`") survived the first pass: 55 of 56. Cause: my test's premise. This runtime writes the text of `error.stack` when it is first READ, so a message replaced before that read is simply the message of the stack, and the fall-back path of the filter was never entered. The test now reads the stack before it replaces the message, asserts that premise, and detects L4 (`1 of 1`).

### 5.4 Test ledger (P24)

| Project | New files | New tests | In changed files |
|---|--:|--:|---|
| `unit` | 8: `core/__tests__/connection-lost.test.ts` (36), `core/__tests__/unit-statement.test.ts` (17), `plugins/db/__tests__/search-path.test.ts` (12), `plugins/db/__tests__/read.test.ts` (7), `plugins/logger/__tests__/error-keys.test.ts` (17), `plugins/logger/__tests__/safe-log-object.test.ts` (12), `test/static/log-calls.test.ts` (7), `test/static/search-path.test.ts` (4) | 112 | `pipeline.test.ts` 39 to 40; `db.test.ts` 17 to 19. **Total +115** |
| `db` | 5: `core/__tests__/search-path.db.test.ts` (5), `core/__tests__/unit-guard.db.test.ts` (4), `core/__tests__/connection-lost.db.test.ts` (4), `plugins/db/__tests__/search-path.db.test.ts` (7), `plugins/logger/__tests__/error-keys.db.test.ts` (11) | 31 | none. **Total +31** |

Controller's `unit` total at 15:12: 101 files / 2,647. Plus this round: 109 / 2,762. Measured at 15:43:59: 110 / 2,776 (one file and 14 tests of another row in between).

### 5.5 Existing tests changed by design

| File | Lines (before) | Why |
|---|---|---|
| `src/core/__tests__/pipeline.test.ts` | `:62`, `:134` | the third statement of a unit (fix 3 (iii)); `:302-314` "the connection is lost while the unit holds it" expected the driver's own error, now the 503 with it as cause (fix 5) |
| `src/core/__tests__/core-plugin.test.ts` | `:211`, `:286-288`, `:311-314`; `:240-264`, `:298` | the stand-in pool answers the second half of B-1 (fix 3 (ii)); relative order (fix 7) |
| `src/core/__tests__/static.test.ts` | `:41-54` | the list of the folder's production files gains `unit-statement.ts` |
| `src/core/__tests__/seeded.db.test.ts`, `boot-checks.db.test.ts`, `test/db/boot-checks.db.test.ts`, `src/engine/__tests__/restart.db.test.ts`, `commands.db.test.ts` | section 2.7, 2.8 | fix 7, fix 8 |
| `src/plugins/db/__tests__/db.test.ts` | `:224-247` | the stand-in pool answers the second half of B-1 |
| `src/engine/__tests__/plugin.test.ts` | `:88-93`, `:110-114` | The boot test used a pool that answers nothing and expected a stop at B-2: it now uses the core's stand-in, which answers B-1. The literal text of the unit's third statement is replaced by "starts with `SELECT set_config('statement_timeout', $1, true)`" (deviation DV-3) |
| `test/helpers/db/__tests__/drop-retry.db.test.ts` | `:87` | fix 8 |

---

## 6. Deviations, findings, decisions

### 6.1 Deviations from the brief

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | CPB1-23 (Low, not in the scope list) was closed | Fix 1 asks for "no statement text" at every key. With the old stack filter a line of a multi-line statement that has the form of a frame was written into `stack`, under `err` as well (reproduced, section 2.2). Three lines of `error-log.ts` |
| DV-2 | The allow-list of the log static test is not empty for the foundation: one entry, `src/plugins/readiness/index.ts` (`{ reason, held }`, 2 times) | The brief names `reason`; the readiness plugin logs the NAME of a hold under that key, and its files were outside my write paths for this fix. Left to its owner (S-6). The rule was also narrowed in one respect: a keyed member with a value that is fixed in the source is not refused, otherwise `src/plugins/authenticate/index.ts:236` (`reason: CREDENTIAL_CONFLICT_REASON`) would be a second entry |
| DV-3 | `src/engine/__tests__/plugin.test.ts` was edited (two places) | It is covered by the path `src/engine/__tests__/**` of fix 7, but the two changes are consequences of fix 3, not list pins: listed in 5.5 |
| DV-4 | The guard is an ALLOW-list of row statements, not the review's deny-list with more words | It closes `DO`, `CALL`, `PREPARE`, `LISTEN`, `LOCK` and whatever else by one rule that states what a unit is. Nothing a module sends today is refused. If the controller prefers the deny-list: rule R2 is one pattern |
| DV-5 | The pool plugin got a second new member, `connectionLost()`, beyond `read` | The readiness plugin was not to be changed, and "off until the next successful probe" needs the pool's own probe cache to be forgotten; the pool plugin owns both |
| DV-6 | One whole `unit` run on the scratch copy before the landing (15:31:49), beside the one after it | Controller note D88 (2) allows whole projects after a landing and at the end. Landing 36 files of the foundation unverified under six rows was the larger risk; it was one run of 40 s with two workers. The `db` project was run whole only once, after the landing |
| DV-7 | `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (P8) |
| DV-8 | The first argument of `work` in `app.db.read` is the `Pool`, not the identity module's `Queryable` | So that the RBAC form and the query builder fit; the identity replacement stays two lines (S-1) |

### 6.2 Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| F-1 | **F53 is a silent loss of audit rows, not only a theory.** On the old code, with a temporary table `audit_log` on its connection, a unit "committed" an audit row that was in no real table; the head did not move and nothing failed | Section 2.3, red before | W45; closed for a unit by the pin |
| F-2 | **CPB1-23 leaked under `err`:** a multi-line statement with a line in the form of a frame reached `err.stack` and the persistent error log | Section 2.2 | closed |
| F-3 | The pairing row wrote a third copy of the read block while this round ran | `src/modules/pairing/database.ts:25-38` | S-3 |
| F-4 | The bindings of a child logger pass no formatter in the installed logger (`pino` 10.3.1 resets the bindings formatter for children) | `node_modules/pino/lib/proto.js:98` | kept by the static test; W45 |
| F-5 | The text PostgreSQL reports for the path is the text that was set: `public,pg_temp` from the start-up option, `"$user", public` by default, `pg_temp, public` from a database default. So "exactly the pinned value" compares one constant, and a space matters | `search-path.db.test.ts` | — |
| F-6 | A start-up option of the client wins over a default stored for the database | the same file, last test | supports OW-9 |
| F-7 | With the simple protocol the driver runs a text with several statements and returns an ARRAY of results; a `COMMIT` among them ends the caller's transaction | `unit-guard.db.test.ts` | W45 |
| F-8 | For a socket that closes, the driver's error has NO code: `Error`, "terminated" in its text. It is recognised by the `error` event of the client, not by a code | `[cpb1-6]` line, section 2.5 | — |
| F-9 | This runtime (Node 26.8.2) writes `error.stack` lazily: a message changed before the first read of the stack is the message in the stack | section 5.3 | whoever tests stack texts |
| F-10 | **Hypothesis, not run:** PostgreSQL lets a role end a backend of the SAME role with `pg_terminate_backend`. A second `dems_app` session could then end the backend of a unit that holds the chain lock, and a test could provoke a real `57P01` that way. Not done here: the brief limits the real provocation to closing the socket | PostgreSQL documentation of the function; not executed | W45 (and W53, if a real `57P01` is wanted) |
| F-11 | What the log sanitiser does not cover: an error that was COPIED into a plain object (`{ ...error }`) is no `Error` any more; its `query` and `params` members would be written | reasoning; no production source does it | W45 |

### 6.3 Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | DV-4: the row-statement rule (allow-list) | Accept; add the sentence to M5 (section 3) |
| DN-2 | DV-2 / S-6: the one foundation entry of the log allow-list | Let the readiness plugin's owner rename the key in the structural round, then empty the list |
| DN-3 | DV-1: CPB1-23 closed here | Record it as closed with CPB1-2 |
| DN-4 | S-1 to S-3: three copies of the read block | One instruction to the three owners, with the two lines |
| DN-5 | The 503 wins over a refusal the work threw after a lost connection | Accept (section 2.5) |
| DN-6 | F-10 | To W45 as a hypothesis to check |
| DN-7 | Limits of the log sanitiser (depth 6, 2,000 members) | Accept; constants of `logger-options.ts` |

---

## 7. Residuals

- The guard reads text; it is not a parser and not a boundary (section 2.4, the table of what remains).
- `TEMPORARY` is still granted to `PUBLIC` in every project database (option (b) is not in this round): a temporary table can still be CREATED outside a unit. It can no longer stand in for a real table on a connection of the runtime pool or inside a unit.
- A read on the pool that goes through a pool built WITHOUT the start-up option (a test's own pool) is not protected outside a unit; the server's pool always has it, and the boot check refuses another.
- A server that stops, and the end of a backend by the server, were not provoked (section 2.5).
- CPB1-14 was not reproduced (section 2.8).
- The static log test reads the object literal of a call; an object in a variable and a spread are not followed (section 2.9).
- The bindings of a child logger (F-4) and an error copied into a plain object (F-11).

---

## 8. How it was applied, end state, rollback

**Applied atomically.** Developed and proven on a copy outside the repository (`$TMPDIR/…/scratchpad/cpb1a/tree`, with links to `node_modules`, `packages`, `docs` and the data folder; a second copy `before` held the code as it was, for the red runs). At 15:43:01 the 40 pre-image files in the tree were still equal to the copies taken at 14:56:04 and no other writer had added a file to the four folders. At **15:43:39** the 36 files were copied beside their targets under a name no tool reads and renamed within one second, the production files in dependency order (`logger/error-log`, `logger-options`, `logger/index`, `core/errors`, `core/unit-statement`, `plugins/db/index`, `core/unit-of-work`, `core/pipeline`, `core/types`, `core/index`, then the test support and the tests). Afterwards the tree equals the scratch copy for the 36 files and no temporary file is left (`assets/04a_land.sh.txt`, `04a_landed_files.txt`).

**End state (15:48).** PostgreSQL 18.4 on 127.0.0.1:4432, PID 19121, postmaster started 07:14:26, never stopped. Databases with the prefix `dems_test_step_60a_`: 0 (read from the catalog through the helper's owner session). No process of this row is running; no port was bound; `dems_demo` and the lane databases were not touched; no credential file was printed or copied (the scratch copies held a link to `.data/`; both links were removed at the end). No file was removed from the repository.

**Files written (36 in `apps/core-server`).**

- Changed (20): `src/plugins/logger/{error-log,logger-options,index}.ts`; `src/plugins/db/index.ts`, `src/plugins/db/__tests__/db.test.ts`; `src/core/{errors,index,pipeline,types,unit-of-work}.ts`; `src/core/__tests__/{support,pipeline.test,core-plugin.test,static.test,seeded.db.test,boot-checks.db.test}.ts`; `src/engine/__tests__/{plugin.test,commands.db.test,restart.db.test}.ts`; `test/db/boot-checks.db.test.ts`; `test/helpers/db/__tests__/drop-retry.db.test.ts`.
- New (16): `src/core/unit-statement.ts`; `src/core/__tests__/{unit-statement.test,connection-lost.test,search-path.db.test,unit-guard.db.test,connection-lost.db.test}.ts`; `src/plugins/db/__tests__/{search-path.test,read.test,search-path.db.test}.ts`; `src/plugins/logger/__tests__/{error-keys.test,safe-log-object.test,error-keys.db.test}.ts`; `test/static/{log-calls.ts,log-calls.test.ts,search-path.test.ts}`.

Not written: `app.ts`, `index.ts`, `config.ts`, any folder under `src/modules/`, `src/plugins/{permission-guard,authenticate,origin-guard,throttle,readiness,error-envelope,config}/`, `src/db/**`, the production files of `src/engine/`, `packages/shared`.

**Rollback (not executed).** `apps/core-server/` is untracked, so the pre-images are file copies (P23): `.cache/rollback/CPB1a/` holds the 40 files of the write paths as they were at 14:56:04, with `.cache/rollback/CPB1a.pre.sha256`; `.cache/rollback/CPB1a.post.sha256` holds the hashes of the 36 files as landed.

1. Check that the 36 files still have the hashes of `CPB1a.post.sha256` (a later writer may have changed one: merge by hand then).
2. For each of the 20 changed files: `cp -p .cache/rollback/CPB1a/<path> apps/core-server/<path>`.
3. Remove the 16 new files listed above.
4. The row that replaced a copy of the read block (S-1 to S-3) or calls `codedCauseOf` (S-4) must be rolled back first.

A partial rollback of one fix is possible only for the tests of fix 7 and fix 8 (they touch no production file); the production changes of fixes 1 to 6 share files.
