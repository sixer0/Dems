---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 74
plan_row: W52
title: Acceptance test, contract conformance (SC6; AC-B-09, AC-B-10, AC-B-14, AC-B-70, AC-B-93; SR-76)
date: 2026-10-04
agent: test-expert (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§7.1 API-7, API-10, API-13; §7.2; §7.3; §14.2 OR-9; §15 SR-20, SR-64, SR-76; §16 AC-B-08 to AC-B-14, AC-B-70, AC-B-93); gateway_check/01_gate_report.md (M9, M10, M12, M15, M16)
evidence_tier: 2
status: complete
---

# Contract conformance of the Core server (blueprint row 74, plan row W52)

## 1. Result

| Question of the row | Answer | Evidence |
|---|---|---|
| Does the file pass under `test:db`? | Yes: 1 file, 34 tests, exit 0 | Section 9.1 |
| Undocumented routes | `[]` (four comparisons; `GET /ws` is the one named exception) | Section 3 |
| Unregistered operations | `[]` (four comparisons) | Section 3 |
| The committed `openapi.json` equals the generator's output | Yes: `gen-openapi --check` exit 0, and the test compares the file byte for byte | Section 3.3 |
| Every response validates with `validateCoreApiResponse` | Yes: 1,290 answers judged, 0 problems | Section 4 |
| Documented operation-by-status cells produced | 337 of 337, over all 75 operations | Section 4.2, `test/assets/03_contract_coverage.md` |
| 401, 403, 404, 405, 409, 413, 422, 423, 429 each produced and an `ApiError` | Yes: 125, 118, 30, 444, 28, 25, 104, 4, 3 answers | Section 5 |
| A 500 | None in 1,297 answers | Section 5 |
| No GET handler writes | Yes: 45 reads of the 27 GET operations, all 30 tables equal before and after each | Section 6 |
| The five headers of OR-9 on every answer | Yes: 1,297 of 1,297 | Section 7 |
| API-7 on every 2xx POST | Yes: 103 of 103, each at the engine's revision | Section 7 |
| Text rule API-13 | Yes: 49 refused requests over all 25 free-text members, no table moved | Section 8 |
| New mismatches | 2 (both: the CONTRACT departs, text or validator; no server defect) | Section 11 |

No production file, no contract file, no configuration and no other row's test was changed.

## 2. What was tested, why it matters, how it was verified

**What.** One test file, `apps/core-server/test/acceptance/contract.test.ts` (1,658 lines, 34 tests in 9 blocks), with its
support `contract.support.ts` (491 lines) beside it. It asks whether the server IS what the contract registry
(`packages/shared/src/api/**`, 75 operations) and the committed OpenAPI document say.

**Why it matters.** The typed client, the Live source, the web API Reference and both apps are generated from or
checked against the registry. A route the registry does not know, an operation the server does not serve, a status
or a body the contract does not document, or an error code the client cannot map would show as a defect in a client
row, far from its cause. Success criterion SC6 is the place where the two sides are held against each other.

**How.** The real app factory on clones of the seed template, connected as `dems_app`, booted as the entry point
boots it (the boot checks, then the engine's start). Every request is `app.inject` through the real stages 1 to 7 and
the real handlers. The callers are the three seeded operators signed in through the sign-in route (on the web
console, and on a tablet), three tablets that redeemed a pairing code the server issued (one kept, one revoked by
the SUPERVISOR, one that unpaired itself), and callers without a credential. The server clock is a manual clock and
the engine's timer a manual timer (gate rule M9), so no test waits; the tablet link is set `CONNECTED` through
`app.engine.setTabletLink` before a recording.

Every answer the file receives, 1,297 in the run quoted here, passes through ONE function (`Ledger.record`), which
judges it against: the contract (`validateCoreApiResponse` for its operation and status, or
`validateCoreApiEnvelopeResponse` for an answer that belongs to no operation); the members of the schema (section
11, finding 2); the five headers of OR-9; the content type; API-7; the cookie rule of decision D69; `allow` on a 405
and `retry-after` on a 429; `error.requestId` against the `x-request-id` header; "never a 5xx except 503"; no stack
trace; and the error code against the codes the registry names. A departure is collected, each test ends by
asserting that none was collected, and the last block prints the tables.

**Where the expected codes come from** (finding F49, rule F-5 of contract C: the validator checks a documented
status by its schema, not by its code). Both sources were used:

1. **The specification.** Each call of the file states the status and the code that spec §7.2 and §7.3 name for that
   kind of request (`expectCall(…, 401, 'NOT_SIGNED_IN')`, 254 call sites, many of them in a loop over the registry);
   a miss is reported as "the specification says …".
2. **The registry.** `registryCodes(operation, status)` derives, mechanically, the codes an operation's entry names
   for a status: the code words of the status description and the codes of its examples, plus the codes of the
   envelope-level pipeline answers. Every error answer's code must be in that set, or be a contract gap a row
   already reported (section 10).

Databases: the file's own clone of `tpl_seed` and four more clones made inside tests (flag off, bulk, reset, a
scratch one), all under the run prefix `dems_test_step_74_<stamp>_`. Never `dems_demo`, never a lane, never port 5432.

## 3. Routes and operations, both directions (AC-B-09)

Nothing in the file lists operations by hand: the documented side is `listCoreApiOperations('all')` and the committed
document; the registered side is the router's own printed table of the BOOTED server and the guard's
`registeredRules()` (decision D83 DN-11).

### 3.1 The two lists, quoted (run of 18:27:36, `test/assets/03_row_command_console.log`)

```
[w52] routes of the router: 76; rules of the guard: 76; operations of the registry: 75
[w52] undocumented routes (router against registry): []
[w52] undocumented routes (guard against registry): []
[w52] unregistered operations (registry against router): []
[w52] unregistered operations (registry against guard): []
[w52] the one route outside the registry: GET /ws
[w52] undocumented routes (router against the committed openapi.json): []
[w52] unregistered operations (committed openapi.json against router): []
```

### 3.2 What else the block asserts

| Assertion | Source of the expectation |
|---|---|
| The registry holds exactly 75 operations, 75 distinct IDs, 75 distinct method-and-path pairs; 27 GET and 48 POST; each has an access rule and an audit rule | AC-B-09 |
| The router holds 76 routes, each once; the only one outside the registry is `GET /ws` | Decision D83 DN-3 |
| Each rule of the guard carries the operation ID and the access marker of the registry entry with its method and path | D83 DN-11 |
| `app.hasRoute` answers true for every operation (Fastify's own question, without the printed table) | AC-B-09 |
| The committed document lists 75 operations with the same ID on the same method and path; for each, the statuses of the document equal `listCoreApiResponseStatuses(operation, 'all')`; two security schemes (`bearerAuth`, `sessionCookie`); version 0.2.0 | AC-B-11, API-12 |
| The file equals `serializeOpenApiDocument(createOpenApiDocument({ scope: 'all' }))` byte for byte | AC-B-11 |

### 3.3 The generator's own check (read-only, 18:25:09)

```
$ node --import tsx /Users/gsp-budi/Documents/DEMS/packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.0; offline: 10 operations, 0 security schemes, version 0.1.0)
exit 0
```

Note: "committed" is the generator's word for the file in the tree (882,723 bytes, SHA-256 `83e5a186…e37977`). In git
it is a modification that the contract rows made after commit `4b708c8` and that no checkpoint commit holds yet.

## 4. Every response validates (AC-B-10)

### 4.1 How each operation was driven

| Block of the file | Operations | What produces the statuses |
|---|---|---|
| The callers | 1, 2, 15, 18, 20 | Health; three web sign-ins; two tablets paired; an operator signs in on each; one tablet revoked |
| Area 1 | 2 to 9 | Wrong password, no console identity, a revoked device, a foreign Origin, sign-out on the web and on a tablet, the biometric token from enrolment to its use, a token nobody was issued |
| Areas 2 and 3 | 10 to 14 | A role changed and changed back, an unknown operator, the last holder of `USER_ADMIN` (409 `LAST_ADMIN`), disable and enable |
| Area 3 | 15 to 23 | A code issued, read, cancelled; a wrong code; a credential rotated; a tablet that unpairs itself; a second revocation (409) |
| Area 6 | 44 to 52 | A camera restart, a platform device (409 `COMMAND_UNSUPPORTED`), unknown devices, malformed IDs |
| Areas 7 to 11 | 53 to 70 | The storage policy by both permissions of the any-of, the lists with a limit outside 1 to 200, the two exports with and without a reason, diagnostics, a services restart, settings, an alert |
| Area 13 | 71, 73, 74 | A fault injected and cleared, a tamper of unknown evidence (404) |
| Area 4 | 24 to 38 | The eleven `{id}` operations with a malformed and with a foreign ID; a pre-check that blocks (Core link offline), a retry, a cancel; a pre-check that warns (a microphone fault through operation 73), its acknowledgement; a recording with marker, note and snapshot; a power failure, FAULT, recovery; a recording from create to SEALED evidence |
| Area 5 | 39 to 43, 67 | The sealed item read, verified, exported (also while security is in FAULT: 409 `SECURITY_FAULT`), archived; an item never sealed (409 `NOT_SEALED`) |
| Generated, for every operation | all 75 | Section 5 |
| Bulk template | 38, 39, 40, 59, 63 and eight reads | The four lists walked to their end in pages of 200: 520, 515, 5,002 and 3,651 rows in 3, 3, 26 and 19 pages, every page validated, no row twice; 20 evidence details |
| Reset | 72, 75 | A scenario load and a reset through the REAL reset routine on a clone of this file; 30 answers `503 NOT_READY` to other requests while the database was rebuilt, health 200 throughout |

### 4.2 The coverage table (asset)

`test/assets/03_contract_coverage.md` holds the table operation by documented status, generated by the last block from
the ledger: **75 operations, 337 cells, 337 produced, 0 not produced**. The table of statuses that are "not producible
here" (`NOT_PRODUCED` in the test) is therefore empty; the block fails when a documented status is neither produced
nor listed with a reason, and when a listed one was produced. Each operation was answered with a 2xx status.

Statuses an operation was answered with that it does not document itself, all envelope-level (spec §7.2, "defined
once at envelope level"): 413, 429 and 503, on 29 operations.

Code by code: of the codes an operation's own entry names, the file did not produce `DEVICE_REVOKED` on 64 cells and
`ORIGIN_NOT_ALLOWED` on 38 (both are stage refusals that treat every operation alike; they were produced on 5 and 32
operations as samples). Every other named code of every cell was produced.

## 5. The refusals of the stages (AC-B-14)

Answers by status, whole file: `{"200":269,"201":13,"202":15,"204":31,"400":58,"401":125,"403":118,"404":30,"405":444,"409":28,"413":25,"422":104,"423":4,"429":3,"503":30}`.

| Status and code (spec §7.2) | How it was produced | Count |
|---|---|--:|
| 401 `NOT_SIGNED_IN` | Each of the 71 operations that are not `PUBLIC`, without a credential; a cookie together with an `Authorization` header on three operations (`details.reason: CREDENTIAL_CONFLICT`) | 125 with the next rows |
| 401 `INVALID_CREDENTIALS`, `INVALID_CODE` | A wrong password, a token nobody was issued, six digits that are not the code | |
| 403, by the access rule of each operation | Each of the 74 operations that document a 403: `NOT_PERMITTED` for a role without the permission (`FORBIDDEN` on `exportEvidence`), `DEVICE_NOT_PAIRED` for a web session on a device-only operation and for a sign-in without a console identity, `ORIGIN_NOT_ALLOWED` for a cookie with an Origin that is no web console origin, `DEVICE_REVOKED` for a revoked tablet. The table per operation is in the asset | 118 |
| 403 `DEMO_DISABLED` | The five demo operations on a second server whose flag is off; `NOT_PERMITTED` still wins for a role without `DEMO_CONTROL` | 5 |
| 403 `NOT_PERMITTED` on the six operations whose permission every seeded role holds (finding F49) | The INVESTIGATOR's grants of `EVIDENCE_VIEW` and `DIAGNOSTICS_RUN` deleted in that clone as `dems_owner`; the next request is refused | 6 |
| 400 `INVALID_JSON` | Each of the 25 operations with a request body: a body that is no JSON, and a JSON list | 50 |
| 413 `PAYLOAD_TOO_LARGE` | Each of those 25 with a body over 65,536 bytes | 25 |
| 404 `NOT_FOUND`, 405 `METHOD_NOT_ALLOWED`, 400 `INVALID_PATH` (no operation) | Six unknown paths; all 74 paths with DELETE, PUT, PATCH, OPTIONS, HEAD and the method of GET and POST the path does not have (443 requests, `allow` equal to the path's methods each time), and `POST /ws`; a path parameter that is no percent-encoding | 6, 444, 1 |
| 423 `LOCKED` with `lockedUntil` and `retryInMs` | The three entry points that lock: `signIn` (the fifth failure), `redeemPairingCode` (the third), `signInWithBiometric` (the fifth); a right password during the lock | 4 |
| 429 `RATE_LIMITED` with `retry-after` | The request throttle: the 31st request in 60 s of a caller without a principal. The denial budget: the 21st audited refusal of one operator, after which an allowed read of that operator answers 429 too | 3 |
| 401 and 403 before the body | A malformed body without a credential answers 401; an oversized body from a role without the permission answers 403 (§7.3) | 2 |
| 503 `NOT_READY` | Other requests while a reset rebuilds the database | 30 |

No answer was a 500 or carried anything of the form of a stack trace.

## 6. No GET handler writes (AC-B-09, SR-20)

For each of the 27 GET operations, as the caller its rule lets through, and for the 18 that any operator may call
also as the operator's session on the tablet (45 reads): one statement over EVERY table the catalog lists in schema
`public` (30) is read before and after, as `dems_owner`. A row's image is its place (`ctid`), the transaction that
wrote it (`xmin`) and its content, so a row rewritten with the values it had would show too (the last block proves
that on a scratch clone). Result: no table moved; the audit count (243) and the event count (144) are equal.

The two writes that are not a handler's, named and measured instead of excluded:

| Write | Shown by |
|---|---|
| Stage 4 writes `paired_devices.last_seen_at` at most once a minute, also on a GET (pairing row DN-8) | After 61 s of the clock: `[w52] the first GET of a paired device in a new minute moves: ["paired_devices"]`; the second GET of that minute moves nothing; a web session's GET in a new minute moves nothing |
| The engine's ticks | They write only when the test fires the manual timer; no tick is fired between two readings |

A refused GET (401) moves no table either.

## 7. The header table (OR-9, SR-76, AC-B-14; API-7; decision D69)

The expected values are copied from the text of the specification into the test, not imported from the server.

| Header | Expected | On which answers | Judged | Departures |
|---|---|---|--:|--:|
| `Cache-Control` | `no-store` | Every answer: success, error, 404 of an unknown route, 405 | 1,297 | 0 |
| `X-Content-Type-Options` | `nosniff` | The same | 1,297 | 0 |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | The same | 1,297 | 0 |
| `Cross-Origin-Resource-Policy` | `same-origin` | The same | 1,297 | 0 |
| `Referrer-Policy` | `no-referrer` | The same | 1,297 | 0 |
| `Content-Type` | `application/json; charset=utf-8` | Every answer with a body (32 answers have none: the 204s and one 202) | 1,265 | 0 |
| `Strict-Transport-Security`, `x-dems-simulated` | Never sent (OR-9; API-10) | Every answer | 1,297 | 0 |
| `x-dems-epoch`, `x-dems-revision` | Integers; the epoch is the engine's, the revision is not beyond the engine's (API-7) | Every 2xx answer of a POST | 103 | 0 |
| `Set-Cookie` | Exactly the session cookie with a value on a web sign-in; exactly its removal on a web sign-out; absent on every other answer, so on every answer to a bearer or a public request | Every answer | 9 set, 1 cleared, 1,287 without | 0 |
| `allow` | The path's methods | Every 405 | 444 | 0 |
| `retry-after` | Whole seconds | Every 429 | 3 | 0 |
| `x-request-id` | Equal to `error.requestId` of the body | Every answer of status 400 and above | 969 | 0 |

Measured beside the assertion: all 103 revision headers were EQUAL to the engine's revision when the answer arrived.
The test asserts "not beyond" only, so the fix round that moves the two headers into one hook cannot make it red by
a legitimate difference.

## 8. The text rule API-13 (AC-B-93, SR-64)

The free-text members are found mechanically: the walker visits every string of every request body schema and query
schema of the registry; a member is free text when the schema refuses U+0000 with the rule's own message.

```
[w52] API-13: 36 string members in the request and query schemas of 21 operations; 25 are free text, in 15 operations:
[w52]   createSession: body.caseNumber, body.subjectName, body.investigatorId, body.room, body.notes
[w52]   stopSession: body.reason
[w52]   exportEvidence: body.reason, body.destination
[w52]   signIn: body.username, body.password
[w52]   signInWithBiometric: body.token
[w52]   assignUserRole: body.reason
[w52]   enableUser: body.reason
[w52]   disableUser: body.reason
[w52]   redeemPairingCode: body.deviceName, body.platform, body.appVersion
[w52]   revokeDevice: body.reason
[w52]   addSessionMarker: body.label
[w52]   addSessionNote: body.text
[w52]   listEvidence: query.q
[w52]   exportAudit: body.reason, body.destination
[w52]   exportLogs: body.reason, body.destination
```

The other 11 string members are bound by a pattern (IDs, the code, cursors) and carry no rule of their own.

Each of the 24 body members is sent twice, with U+0000 and with an unpaired surrogate inside ordinary text, and the
query member once (`%00`; an unpaired surrogate has no percent-encoding): **49 requests, each answered 422
`INVALID_INPUT`, each with every table of schema `public` equal before and after** (audit and event counts
included). The three operations of AC-B-93 come first.

What makes the refusal count: each request WOULD write without the ill-formed text. While the block runs a session
records (the notes, markers and the stop name it), a pairing code is active and the redeem carries its right digits,
the revocation names the paired tablet, the export names a sealed item, the sign-in carries the right credentials.
Afterwards the tablet is still paired, the code is active with all its attempts, the session records, and the same
note with well-formed text answers 204.

## 9. Verification

### 9.1 The row command (18:32:30, `test/assets/03_row_command.log`)

```
$ DEMS_TEST_STEP=74 npm run test:db -w @dems/core-server -- test/acceptance/contract.test.ts
 Test Files  1 passed (1)
      Tests  34 passed (34)
   Start at  18:32:31
   Duration  6.52s (tests 86%, transform 9%, import 5%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 99 ms; 0 remain with the run prefix dems_test_step_74_tmds27xw_
exit 0
```

Vitest 5 prints the console output of a passing test only with `--silent=false` or `--reporter=verbose`: the lists
quoted in this document are from the same file run with `--silent=false` at 18:27:36 (34 passed, exit 0,
`03_row_command_console.log`) and per test from `--reporter=verbose` (`03_row_command_tests.log`).

### 9.2 Duration and time limits

The file sets its limits as caps: `vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 })`. Measured over 16
green runs of the file between 18:20 and 18:34 (14 alone, 2 inside the whole project): 6.3 to 9.0 s on a quiet host,
11 to 17 s while other rows' runs loaded it, and one run of 66 s at 18:22:09 (section 11, observation O-2). The
slowest single test is the walk of the bulk lists (1.8 to 5.4 s); the two rebuilds take 1.1 to 1.3 s. Inside the file,
up to its last block: 5.3 s at 18:24:19 and 7.0 s at 18:27:36.

### 9.3 Typecheck and lint

```
18:27:58  npm run typecheck -w @dems/core-server   exit 0
18:28:04  npm run lint -w @dems/core-server        exit 0, no warning
```

Earlier runs (P11 noise, another row's file in flight): typecheck at 18:24:35 exit 2 with two errors, both in
`test/acceptance/rbac-matrix.test.ts` (lines 419 and 525; the matrix row), none in this row's files; lint at 18:17:34
with one warning in `test/acceptance/rbac-matrix.support.ts:197`. Both were gone at 18:27:58.

### 9.4 Whole projects

| Project | When | Result | Asset |
|---|---|---|---|
| `db` | 18:25:24 to 18:27:02 | 112 files passed, 1,644 tests passed, 1 skipped, exit 0 | `03_whole_db_1825.log` |
| `db`, with the final file | 18:28:24 to 18:30:58 | 112 files passed, 1,644 tests passed, 1 skipped, exit 0 | `03_whole_db_1828.log` |
| `unit` | 18:31:04 to 18:31:43 | 142 files passed, 3,678 tests passed, exit 0 | none (no file of this row is in it) |

No failure in either `db` run, so none to name as another row's. Test ledger (P24), project `db`: baseline of the
brief 108 files and 1,540 passed + 1 skipped; this row adds 1 file, `test/acceptance/contract.test.ts`, with 34 tests;
the other 3 files and 70 tests are other rows' (acceptance rows in flight; `test/acceptance/` also holds
`rbac-matrix.test.ts` and `pairing-lifecycle.test.ts` now). Project `unit`:
this row adds nothing.

### 9.5 End state (18:32:06 and 18:32:37, `test/assets/03_end_state.mts.txt`)

```
databases with the prefix dems_test_step_74_: 0 []
databases with the prefix dems_test_ (every row's): 0; asked as dems_owner on port 4432
postgres.pid: 19121   (started Sun Oct  4 07:14:26 2026)
```

No port was bound and no process was started that still runs.

### 9.6 Can the test fail?

By a change of its INPUT, never of a file in the tree (rule M15). The last block of the file keeps these as tests:

| Changed input | What the check reports |
|---|---|
| A scratch app with one route more, registered by a plugin of the test (`GET /api/v1/w52/extra`) | `undocumented: ['GET /api/v1/w52/extra']` |
| The real server's routes against a registry with one operation more | `unregistered: ['POST /api/v1/w52/planned']` |
| The real server's routes against a registry without `GET /api/v1/health` | `undocumented: ['GET /api/v1/health']` |
| The same comparison without the named exception | `undocumented: ['GET /ws']` |
| A real answer of `getStorageDetail` with one member more, with one member less, under status 418, with an error body | The validator refuses each |
| A real answer of `getServiceHealth` with two members more | The validator ACCEPTS it (finding 2); the ledger's member check reports `ready.w52` and `w52` |
| A made-up 500 with a foreign header set, a cookie and an unknown code | Problems of the kinds `content-type`, `contract`, `cookie`, `header` (7), `server-error`, and one code mismatch |
| A made-up 2xx POST without the two revision headers | Two `api-7` problems |
| `UPDATE … SET auto_archive = auto_archive` on a scratch clone | `movedTables` reports `storage_policy` although no value changed |
| An empty ledger; a "not produced" reason for a status that was produced | Every cell is missing; the cell is reported as stale |

Two real reds while the file was written show the same on live answers (`03_red_run_1815.log`, `03_red_run_1819.log`):
at 18:15:32 the code table refused `signInWithBiometric 403 DEVICE_NOT_PAIRED` ("NOT NAMED (new)", now finding 1); at
18:19:57 a wrong expectation of the test itself was reported as "… -> 200; the specification says 422 INVALID_INPUT".

## 10. Known contract gaps and known differences: the server's observed behaviour

Not reported again as new. "Observed" is what this file received; an assertion is marked A, a printed line P.

| ID (row) | What the gap says | Observed here |
|---|---|---|
| CONTRACT-GAP-3 (W36, W44) | The contract has no table "device command to operation" | Not observable through HTTP; the three commands answer as the registry says |
| CONTRACT-GAP-4 (W12, W44) | The token prefixes are not exported | Not observable |
| CONTRACT-GAP-5 (W28) | The any-of denial names both permissions joined with `_OR_` | A: `details.permission` is `EVIDENCE_REVIEW_OR_MAINTENANCE` |
| CONTRACT-GAP-6 (W28) | The example of `getRoleMatrix` has another order of grants | A: 18 grants; per role equal to the shared table as sets |
| CONTRACT-GAP-W32-1 | The failure that locks the redeem answers 423 itself | A: `401, 401, 423` |
| CONTRACT-GAP-W32-2 | A text of the form of a credential is refused with 422 | A: a device name of that form answers 422 `INVALID_INPUT` (the revoke reason was not tried) |
| CONTRACT-GAP-W32-3 | A web session on a device-only operation answers `DEVICE_NOT_PAIRED`, which the 403 text does not name | A, in the code table: operations 21, 22, 23 |
| CONTRACT-GAP-W32-4 | Lifetime, attempts and QR prefix are no shared constants | Not observable |
| CONTRACT-GAP-W34-1 | 409 `SESSION_ACTIVE` carries `details.sessionId` | A: it names the open session |
| CONTRACT-GAP-W34-2 | `stopSession` answers 422 `INVALID_INPUT` beside `INVALID_REASON` | A, in the code table: a reason that is no text, the text rule, a malformed `{id}` |
| CONTRACT-GAP-W34-3 | The server's 404 text is fixed and quotes no input | A: "This session is not the open session.", `details: { simCode: NOT_FOUND }` |
| CONTRACT-GAP-W35-1 | The 409 of `archiveEvidence` carries the transition | A: `{ simCode: UNSEALED_EVIDENCE, from: null, event: archiveEvidence }` |
| CONTRACT-GAP-W35-2 | `exportEvidence` answers 422 `INVALID_INPUT` beside `INVALID_REASON` | A, in the code table |
| CONTRACT-GAP-W36-1, -W40-1 | A POST without a request body answers 400 `INVALID_JSON` to a body that is no JSON object; the registry documents no 400 | A: all seven named operations answer 400 `INVALID_JSON`. P: the validator says `UNDOCUMENTED_STATUS` (printed, not pinned, so that closing the gap does not turn this test red) |
| CONTRACT-GAP-W39-1 | A cursor stops being one after a rebuild | A: a cursor on a row only the discarded chain had answers 422; see observation O-1 for a cursor on a seed row |
| CONTRACT-GAP-W39-2, -W39-3, -W40-2 | Description texts | Not observable (the cursor form `AUD-000010-<16 hex>` was seen) |
| CONTRACT-GAP-W41-1, -W41-4 | A constant; the reasons of an audit row | Not read here |
| CONTRACT-GAP-W41-2 | Operation 7 in a session that no password opened: `DEVICE_NOT_PAIRED` with `details.reason` | A: `PASSWORD_SESSION_REQUIRED` |
| CONTRACT-GAP-W41-3 | The failure that locks a sign-in answers 423 itself | A: `signIn` and `signInWithBiometric`: `401 ×4, 423` |
| CONTRACT-GAP-W42-1 to -3, -W44-1, -W44-2 | The realtime messages; a member of the sign-out request | Outside this row (section 12) |
| CONTRACT-GAP-W43-1 | `details.reason` of the 503 of a reset that did not happen | Not produced (it needs a reset that fails); the 503 DURING a reset was received 30 times |
| Finding F66 | The audio levels of operations 44 and 45 are a fixed level per microphone state | P: `AUDIO-01 -52/-52`, `AUDIO-02 -52/-52` in every read, also while a session records. Inside the contract's bounds (−90 to 0), so the answers validate; the finding is still open |
| Drift DR-10 | `SCENARIO_LOADED` always carries `details.reset` | A: `false` after a scenario load, `true` after a reset |
| SIM-GAP-W34-1 | The recording time of a faulted session keeps counting | P: `elapsedMs` 11,000, and 13,000 two seconds of the clock later |
| SIM-GAP-W39-1 | The `AUDIT_EXPORTED` row counts the simulator's ring | P, on the bulk template: the answer says `rows: 5002`, the row `details.rows: 1000` |

## 11. New mismatches (findings), and observations

| # | Severity | Which side departs | Finding | Reproduction |
|--:|---|---|---|---|
| 1 | Low | The CONTRACT (a text) | **`CONTRACT-GAP-W52-1`.** `packages/shared/src/api/identity.ts:429` (`signInWithBiometric`) and `:455` (`reportBiometricFailure`): `403: forbidden()` names `DEVICE_REVOKED` and the Origin only. The server answers 403 `DEVICE_NOT_PAIRED` to an operator's web session, as spec §7.2 says ("a device-only operation called by a web session"). It is the gap CONTRACT-GAP-W32-3 on the two device-only operations of the identity area, which no row reported. Text for W83: `403: forbidden('an operator\'s web console session called a device-only operation (DEVICE_NOT_PAIRED; no audit row)')` on both, and an example | `POST /api/v1/auth/biometric/sign-in` with the SUPERVISOR's cookie, the web console Origin and `{ "token": "bio_…" }`: 403 `DEVICE_NOT_PAIRED`. Run of 18:15:32: `[w52] code NOT NAMED (new): signInWithBiometric 403 answers DEVICE_NOT_PAIRED; the registry names ["DEVICE_REVOKED","ORIGIN_NOT_ALLOWED"]` |
| 2 | Low | The CONTRACT (the validator) | **`validateCoreApiResponse` accepts a body with a top-level member the schema does not have, for 26 response schemas** (25 of success answers and `ApiError`; measured with the registry's own examples plus one member). "Answers strict" (decision D64 DN-9) holds for the schemas of contract C only (21 cells refuse the member). The schemas of the ten existing operations and of contract A are plain objects, which drop an unknown member and parse: 38 operation-by-success-status cells (`HealthResponse`, `SessionCommandResponse`, `CurrentSessionResponse`, the four status reads, `EvidenceExportAccepted`, `SignInResponse`, `SignInStatus`, `AuthSessionInfo`, `AuthSessionExpiry`, `BiometricEnrollment`, `RoleMatrix`, `AdminUserList`, `AdminUser`, the seven pairing answers, `DemoStatus`, `DemoEpoch`) and every `ApiError`. AC-B-10 as worded would not see an added member there. The SERVER does not depart: this test compares every body with what its schema made of it, and 1,258 bodies held no such member | `validateCoreApiResponse('getServiceHealth', 200, { …a real answer, w52: true })` returns `{ ok: true }`; the same with `getStorageDetail` returns `ok: false` (last block of the file) |

Observations (no side departs):

| # | Observation | Evidence |
|--:|---|---|
| O-1 | After a rebuild, a cursor on a row of the SEED is still a cursor: the rebuilt chain holds that row again with the same hash, and the list answers 200. Only a cursor on a row the new chain does not have answers 422. The text proposed for CONTRACT-GAP-W39-1 ("a cursor of a chain that a demo reset or a scenario load discarded") is truer as "a cursor on a row the rebuilt chain does not hold" | `[w52] gap CONTRACT-GAP-W39-1: after a rebuild, a cursor on a row only the discarded chain had answers 422 INVALID_INPUT; a cursor on a row of the seed answers 200` |
| O-2 | One run of the file took 66 s (18:22:09 to 18:23:15, 34 passed); the thirteen other runs of the file alone took 6 to 17 s. All of the time was before the last block; that run had no per-test timing, so the place is NOT known. Hypothesis, not tested: one of the capped polls of the reset block (the routine and its test wrapper each wait up to 30 s for sessions on the clone to end, twice). It did not recur in five verbose runs | `[w52] duration of the file up to its last block: 64703 ms` in that run; 4,530 to 6,955 ms in the others |
| O-3 | `GET /ws` without an upgrade answers 404 `NOT_FOUND` ("No such endpoint.") with the envelope and the five headers; another method on `/ws` answers 405 with `allow: GET`. The route is outside the registry, so nothing documents either answer | Printed by the routing block, judged for headers, cookies and the 5xx rule only |
| O-4 | A POST body sent as `text/plain`, `multipart/form-data`, `application/x-www-form-urlencoded` or `application/octet-stream` answers 400 `INVALID_JSON`: the server accepts no other body form (SR-66 is not this row's; noted for its owner) | Printed by the same block |
| O-5 | `acknowledgeSessionSummary` with the ID of a session that is not open answers 204 and changes nothing; the registry documents no 404 for it, so the two agree | Area 4 |
| O-6 | A sign-in locks at the fifth failure, a redeem at the third, a biometric sign-in at the fifth | The printed attempts of the 423 block |

## 12. What this test does NOT cover

- **The realtime messages** and the socket (`GET /ws` is only compared as a route): another row's.
- **A listening server.** Every request is `app.inject`: no TCP listener, so nothing about the HTTP parser's own
  answers (a malformed request line, header size limits), `Connection` handling, or a HEAD answer on the wire.
- **The role-by-operation matrix.** One refusal per operation here; every cell is the matrix row's (W47).
- **`DEVICE_REVOKED` and `ORIGIN_NOT_ALLOWED` on every operation**: sampled on 5 and 34 operations.
- **500 `INTERNAL_ERROR` and the 503 of a database that does not answer**: not provoked ("without breaking the
  server"). 503 was received only while a reset ran.
- **Concurrency**: one request at a time.
- **The examples of the registry against the server's answers**, and the filters of the lists beyond one search and
  the limits.
- **`details` keys of error answers** in general: checked only where a known gap names them.

## 13. Requirement to test

| Requirement | Test of `contract.test.ts` (block > test) |
|---|---|
| SC6 (the OpenAPI document describes every endpoint; no drift) | "AC-B-09: every registered route …" (3 tests); `gen-openapi --check` (section 3.3) |
| AC-B-09: 75 operations, both directions, 27 GET and 48 POST | "AC-B-09 …" > "the registry holds exactly 75 operations …", "the router of the booted server and the guard …", "the committed openapi.json …" |
| AC-B-09, SR-20: no GET handler writes | "AC-B-09, SR-20: no GET handler writes" (2 tests) |
| AC-B-10: every response validates | Every test, through `Ledger.record`; "SC6 …" > "AC-B-10, AC-B-14, SR-76: every answer validated …", "the coverage …"; "AC-B-10 on the bulk template …" |
| AC-B-14: each of 401, 403, 404, 405 with `allow`, 409, 413, 422, 423, 429 with `retry-after` as `ApiError`; no stack trace; the five headers; the JSON content type; no `Strict-Transport-Security` | "AC-B-14: the refusals of the stages …" (8 tests); "SC6 …" > "AC-B-10, AC-B-14, SR-76 …", "the error codes …" |
| AC-B-70: every answer that lists audio has exactly AUDIO-01 and AUDIO-02 | "SC6 …" > "AC-B-70 …": 823 lists in the answers of the file (`getDeviceHealth audio` 4, `getAudioStatus channels` 4, `getDeviceInventory mics` 4, `listEvidence items[].tracks` 788, `getEvidence evidence.tracks` 22, `verifyEvidence tracks` 1), seed and bulk |
| AC-B-93, API-13, SR-64 | "AC-B-93, API-13 …" (2 tests) |
| SR-76, OR-9 | `Ledger.record` on every answer; "SC6 …" > "AC-B-10, AC-B-14, SR-76 …" |
| API-7 (decision D80: on every 2xx POST) | The same |
| Decision D69 (no `Set-Cookie` on a bearer or public answer) | The same |
| AC-B-08 (health names the Core server and is ready), as far as a test can | "AC-B-10 …" > "the callers …" |

## 14. Deviations, and decisions for the controller

| # | Deviation | Why |
|--:|---|---|
| DV-1 | `masterplan/02_plan.md`, `implementation/99_implementation_report.md` and `test/01_test_report.md` were not written | Shared files in a parallel run (CLAUDE.md §3.4, P8); the state is in `delegation_progress/test_expert_step_74.md` |
| DV-2 | 401 and 403 are produced for EVERY operation that documents them, not for a sample per access kind | It costs 200 requests and fills the coverage table |
| DV-3 | Besides the clones, the reset block makes the server's own routine create `<clone>_next` and `<clone>_prev` under this run's prefix, as the demo row's tests do | Operations 72 and 75 have no other success path |
| DV-4 | Test controls used: `throttleControl(app).reset()`, the two lockout resets, `engine.setTabletLink`, the demo module's `testRoutine` seam; fixture writes as `dems_owner` on this file's own clones: two `DELETE`s of a grant, one `UPDATE` that changes no value | The counters of a standing clock; rule M9; finding F49 |
| DV-5 | A probe file `test/acceptance/w52probe.test.ts` existed in the tree from 18:18 to 18:19 (which answer other HTTP methods get). It was moved out of the tree, not removed with `rm` | It should have been asked through the test file itself |

| # | Decision asked | Proposal |
|--:|---|---|
| DN-1 | `CONTRACT-GAP-W52-1` (finding 1) | To the contract close-out W83, with the text above |
| DN-2 | Finding 2: are the 26 response schemas to be strict? | W83 decides. `HealthResponse` is shared with mock-core and the 0.1.0 launcher, so strictness there needs their answers checked first. Until then this test's own member check covers the server |
| DN-3 | Finding F66 | Still open: the reads answer −52 dBFS in every state |
| DN-4 | Quoting this file at the gate | With `--silent=false` (or `--reporter=verbose`): the two empty lists are console lines of passing tests |
| DN-5 | Observation O-2 | Nothing to do unless it recurs; the gate should record the file's duration |

---
*Generated: 2026-10-04 18:40*
