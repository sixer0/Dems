---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
step: 61
plan_row: W39
tier: 3
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
status: completed
---

# Step 61 (W39): the security-audit module, operations 58 to 63

Tier 3 (a mechanical record: what was written, what was run, what it printed). All times WIB,
2026-10-04. Sources are cited as `[SP:§n]` (`masterplan/01_specs.md` rev 2.2), `[DB:§n]`
(`masterplan/03_database_contract.md` rev 2.2), `[C:§n]` (`implementation/27_contract_c.md`),
`[EH:§n]` (`implementation/26_engine_host.md`), `[G:§n]` (`implementation/28_rbac_guard_pipeline.md`)
and as `file:line` in the tree. Paths without a prefix are under `apps/core-server/`.

## 1. Result

| Item | Result |
|---|---|
| Operations | 58 `getSecurityStatus`, 59 `listAuditRows`, 60 `verifyAuditChain`, 61 `exportAudit`, 62 `exportLogs`, 63 `listEvents`: six routes, each built from its registry entry. The stub of W08 is replaced; `securityAuditModule` keeps its name |
| Lists | From PostgreSQL, one read-only REPEATABLE READ snapshot per page, keyset by `seq`. **Paging proof on the bulk template: 5,012 rows at the start, 35 appended during the walk, 26 pages of 200 returned sequences 1..5047 each exactly once** (ascending); descending, 5,047 rows at the first page, 40 appended during the walk, sequences 5047..1 each once |
| Cursor | Names the ROW it stands on (the row's ID and 16 digits of its hash; for an event its ID and its instant). A cursor of a chain that a reset discarded answers 422 `INVALID_INPUT`, the contract's "a cursor that is not one" |
| `verifyAuditChain` | `view`: the hosted action. `stored`: the ONE stored-chain check (`checkStoredChain` with `verifyStoredAuditRows`), called by this module, never re-written. `lineage`: the newest 20, newest first, with `lineageTotal` |
| Incremental | **After k appended rows a call reads exactly k audit rows** (query spy; k = 1, 4, 9 on the seed clone, 7 and 1 on the bulk clone; 0 rows when nothing was appended). **Two calls that arrive together run one verification** (2 calls, 1 run, the 3 appended rows read once; and 10 calls, 1 run) |
| Full verification | 5,004 stored rows in one pass: the whole call 35 ms, of which the digest check 18 ms (16:08); 61 ms and 30 ms under a higher load (16:33). Not bounded, not streamed (section 6.4, decision DN-1) |
| Lineage | Bulk: 25 stored, 20 returned, `lineageTotal` 25. After two resets of a seed clone: 2 returned, newest first |
| Exports | Hosted actions through `app.engine.command`. Without a reason, or with one that is too short: 422 `INVALID_REASON`. A caller without `AUDIT_EXPORT`: 403 `NOT_PERMITTED` with exactly one `EXPORT_DENIED` row and event, the guard's. **No file is written or returned** (section 7.1) |
| Tests | `unit` 5 files / 196 tests, exit 0 (16:32:58); `db` 6 files / 126 tests, exit 0, 0 databases remain (16:33:22) (`DEMS_TEST_STEP=61`) |
| Whole projects | `unit` 134 files / 3,503 tests, exit 0 (16:33:42 to 16:34:35); `db` 105 files / 1,513 tests, exit 0, forced drops retried 0, 0 databases remain (16:34:41 to 16:38:20) |
| Typecheck, lint | Typecheck exit 0 (16:33:01 and 16:39:46; red in between only in files of rows in flight, section 13.4). Lint exit 0; no warning under this module; three warnings under `src/realtime` (a row in flight) |
| Mutation check | 99 mutations, **99 detected** (97 in the first pass; one needed a test that was then added; one mutant's text did not parse and was corrected). Through a transform in a scratch runner configuration: no file of the tree was changed (rule M15) |
| End state | 0 databases with the prefix `dems_test_step_61_`; `.locks/postgres.pid` 19121 (16:39:23) |

## 2. What was written

### 2.1 Production code (5 files, 942 lines), all under `src/modules/security-audit/`

| File | Lines | What it is |
|---|--:|---|
| `index.ts` | 268 | The plugin: six routes from the registry, the handler of each, the mapping of an export's refusal, the answer of an accepted export, `securityAuditControl(app)` (counters for tests and measurements) |
| `cursor.ts` | 95 | The two cursors: what they name, their form, encode and decode. Pure |
| `reads.ts` | 205 | The reads from PostgreSQL: the stored head, one page of the audit list, one page of the events, the lineage |
| `export-request.ts` | 62 | The body of the two exports read as VALID, REASON_MISSING or INVALID. Pure |
| `stored-chain.ts` | 312 | The bookkeeping of the incremental stored-chain check: what is remembered, when it is forgotten, one run for calls that arrive together |

### 2.2 Tests (11 files, 322 tests) and test support, under `src/modules/security-audit/__tests__/`

| Project | File | Tests | What it covers |
|---|---|--:|---|
| `unit` | `cursor.test.ts` | 9 | Form, round trip, every refused value, neither list takes the other's cursor |
| `unit` | `export-request.test.ts` | 37 | The three readings of a body, against the real simulator action |
| `unit` | `stored-chain.test.ts` | 39 | The bookkeeping over an in-memory table that answers the statements of the one check; rows built by the shared chain code |
| `unit` | `routes.test.ts` | 88 | MODG route list; the guard's rules; what each handler hands the engine; refusals after the unit; 503 of a failed read |
| `unit` | `static.test.ts` | 23 | Eight rules of the folder, with a positive control |
| `db` | `reads.db.test.ts` | 31 | Operations 58, 59, 63 on a seed clone: source, order, filters, cursor, snapshot, refusals, secret scan |
| `db` | `chain.db.test.ts` | 19 | Operation 60 on seed clones: the query spy, concurrent calls, AUDIT_TAMPER, a new epoch, a reopened pool; the stored check against PostgreSQL with a bad row and with another chain |
| `db` | `exports.db.test.ts` | 47 | Operations 61 and 62: accepted, without a reason, a body that breaks the schema, the denied export |
| `db` | `reset.db.test.ts` | 9 | The reset routine twice on a seed clone: the lineage, the dropped head, a cursor of a discarded chain |
| `db` | `bulk.db.test.ts` | 15 | The bulk template: the paging proof, the full verification measured, the lineage limit, the secret scan |
| `db` | `roundtrips.db.test.ts` | 5 | One call of each operation, statement by statement (section 11) |

`support.ts` (399 lines, not a test file): `auditApp` (the real app on a clone, booted, engine on a
manual timer), the query spy `spyingPool` (every statement with the rows it returned; a statement
can be held back), `walkAudit` / `walkEvents`, `secretFindings`.

### 2.3 Documents and assets

`implementation/39_module_security_audit.md` (this file);
`delegation_progress/coder_execution_step_61.md`; under `implementation/assets/`:
`39_test_unit_verbose.txt`, `39_test_db_verbose.txt`, `39_final_runs.log`,
`39_mutation_harness.vitest.config.mjs.txt`, `39_mutation_harness.run.sh.txt`,
`39_mutations.json`, `39_mutations.log`, `39_end_state.mts.txt`, `39_end_state.txt`.

No file outside the module's folder, its documents and its assets was created or changed
(rule M1). The pre-image of the stub is `.cache/rollback/W39/src/modules/security-audit/index.ts`.

## 3. The operation table

Method, path, access and audit rule are the registry's (`packages/shared/src/api/security-audit.ts:276-426`,
read-only); the module names none of them itself.

| # | operationId | Method and path | Access (registry) | Audit on success | Execution | Answer |
|--:|---|---|---|---|---|---|
| 58 | `getSecurityStatus` | GET `/api/v1/security/status` | AUTHENTICATED | none (a read) | Reads: the engine's committed slice `security`; the stored head | 200 `SecurityStatus` |
| 59 | `listAuditRows` | GET `/api/v1/audit` | AUTHENTICATED | none (a read) | Reads PostgreSQL | 200 `AuditPage` |
| 60 | `verifyAuditChain` | GET `/api/v1/audit/chain` | AUTHENTICATED | none (a read) | Hosted `verifyAuditChain` (the view), then reads PostgreSQL (stored, lineage) | 200 `AuditChainStatus` |
| 61 | `exportAudit` | POST `/api/v1/audit/export` | `AUDIT_EXPORT` | `AUDIT_EXPORTED`; denial `EXPORT_DENIED` | Hosted `exportAudit` | 202 `AuditExportAccepted` |
| 62 | `exportLogs` | POST `/api/v1/logs/export` | `AUDIT_EXPORT` | `AUDIT_EXPORTED` with `details.scope: LOGS`; denial `EXPORT_DENIED` | Hosted `exportLogs` | 202 `AuditExportAccepted` |
| 63 | `listEvents` | GET `/api/v1/events` | AUTHENTICATED | none (a read) | Reads PostgreSQL | 200 `EventPage` |

Module gate, as the test prints both lists (`routes.test.ts`, "registers operations 58 to 63 …"):

```
[w39] MODG routes of src/modules/security-audit: GET /api/v1/security/status getSecurityStatus | GET /api/v1/audit listAuditRows | GET /api/v1/audit/chain verifyAuditChain | POST /api/v1/audit/export exportAudit | POST /api/v1/logs/export exportLogs | GET /api/v1/events listEvents
[w39] MODG registry, operations 58 to 63:           GET /api/v1/security/status getSecurityStatus | GET /api/v1/audit listAuditRows | GET /api/v1/audit/chain verifyAuditChain | POST /api/v1/audit/export exportAudit | POST /api/v1/logs/export exportLogs | GET /api/v1/events listEvents
```

The guard's own view of the six rules (`routes.test.ts`, "the access rule of each route …"): four
AUTHENTICATED rules without a permission (so no denial row exists for them), two PERMISSION rules
`AUDIT_EXPORT` with denial type `EXPORT_DENIED` and error code `NOT_PERMITTED`.

## 4. The handler recipe per operation (rule M13)

| # | Recipe | Lines |
|--:|---|---|
| 58 | Server-native READ, no unit. `app.engine.slice('security')` (committed, by reference; 503 while the engine is not running), then `app.db.read('securityAudit.getSecurityStatus', readStoredHead)`: one statement on `audit_chain_head` | `index.ts:190-199` |
| 59 | Server-native READ, no unit. The cursor is decoded (a form that is none of this list: 422); `app.db.read(…, readAuditPage)`; a cursor whose row is not in the table: 422 | `index.ts:201-221`, `reads.ts:118-149` |
| 60 | HOSTED for the view: `await app.engine.command(request.principal, 'verifyAuditChain')` (one unit of work; it writes nothing). Then two reads through `app.db.read`: `storedChain.status(pool)` and `readLineage(pool, 20)`. A GET: no state position header | `index.ts:223-233`, `stored-chain.ts`, `reads.ts:186-205` |
| 61, 62 | HOSTED: the body is read with the contract's schema IN THE HANDLER (section 7.2); `await app.engine.command(request.principal, action, request or NO_REASON)`; a refusal in the result is answered AFTER the command resolved; the answer is built from the row the export wrote, found by its export ID in the committed ring; `x-dems-epoch` and `x-dems-revision` from the outcome; 202 | `index.ts:174-188, 235-247` |
| 63 | Server-native READ, as 59, on `events` | `index.ts:249-268`, `reads.ts:152-178` |

What no handler does: read a member of the principal, name a permission or a role, append a row,
open a unit of work, call a simulator action directly, read a clock, write or send a file
(`static.test.ts`, rules 1 to 4 and 7). The module's reads go through the helper
`app.db.read(source, work)`, which landed at 15:48 while this row was starting (the foundation fix
round): a failed read is logged by the helper as `{ err }` with the source name, persisted by its
code, followed by a fresh readiness probe, and answered 503 `NOT_READY`.

## 5. The two lists

### 5.1 Source of truth

The engine holds RINGS: the newest 1,000 audit rows and the newest 500 events
(`packages/shared/src/sim/constants.ts:35-36`). The tables hold all. Both lists therefore read the
tables, with the mapping module's `auditRowFromRow` and `eventFromRow` (the functions that
rehydrate the ring), so a row of a list is the row of the realtime channel member by member
(`reads.db.test.ts`, "a row of the list IS the row of the realtime channel …": the walk equals
`engine.slice('audit').rows` on the seed clone, where the ring still holds every row). On the bulk
clone the ring starts above sequence 4,000 and rows 1 to 67 are listed all the same
(`bulk.db.test.ts`, "other page sizes …").

### 5.2 Order, filters, page

| Point | Rule | Where |
|---|---|---|
| Order | Audit: by `seq`, ascending when `order` is omitted, descending with `order=DESC`. Events: by `seq`, ascending; the query has no `order` member, and one that is sent is dropped (API-4) | `reads.ts:143, 172` |
| Filters | Audit: `category`, `type`, `actorId`, `sessionId`, `evidenceId`, each an equality on its column; each has an index ending in `seq` [DB:§4.12]. Events: `category` (the stored, derived column), `type`, `severity` [DB:§4.14] | `reads.ts:132-136, 164-166` |
| Page | `limit` 1 to 200; 50 when omitted (applied by the handler: the contract's query has no default, [C:§3.5]). One row MORE than the page is read: it says whether another page follows, so the last page never has a cursor and a walk never ends on an empty page | `reads.ts:144-147, 173-176`; `index.ts:215` |
| `head`, `total` | The stored head (`audit_chain_head`), read in the page's snapshot: of the same instant as the rows, whatever the filters | `reads.ts:120` |
| Text search | None: neither query has a search member, so nothing of this module folds text (decision D92 DN-5 does not apply) | — |

### 5.3 The cursor

| Question | Answer |
|---|---|
| Form | Audit: `AUD-000150-9f86d081884c7d65`: the row's ID and the first 16 hexadecimal digits of its hash. Events: `LOG-000150-1790823600000`: the event's ID and its instant. Both fit `LIST_CURSOR_PATTERN` (letters, digits, hyphens; at most 128; no underscore, so no bearer value fits) |
| What it names | The ROW the page ended on, not a bare position. The next page is the rows strictly beyond that row's `seq` in the order asked for (a keyset) |
| Why not a bare sequence | A position alone is valid in any chain. After a reset a client would be handed rows of the NEW chain as the continuation of pages it holds of the old one, and its own chain check over the stitched rows would fail at the seam for no visible reason |
| How it is checked | Before a page is read, the row is looked up by its primary key with its mark (`seq = $1 AND starts_with(hash, $2)`; for an event `seq = $1 AND at = $2`). No such row: the read returns `CURSOR_UNKNOWN` and reads no page |
| What it cannot do | It is parsed by one anchored expression into one whole number and one short text of a fixed alphabet; both are bind parameters. It names no table, no column and no filter: the table is the route's and the access rule is stage 6's, and neither reads the cursor. A forged cursor is refused, or it is the position of a row its author may read anyway (every signed-in role reads both lists) |
| Order and filters | Not part of it: a cursor is a position under any filter and in either order (`reads.db.test.ts`, "a filter and a cursor …") |
| One text per row | An ID with an extra leading zero, upper-case digits, text after the mark, sequence 0 and an instant with a leading zero are refused (`cursor.test.ts`) |

Tests: `cursor.test.ts` (form and refusals); `routes.test.ts` ("a cursor that fits the contract
pattern and is none of …": 422 before any read; a value of the form of a bearer token: 422, and
not in the log); `reads.db.test.ts` ("a cursor that is not one of this list …": a wrong form reads
nothing; a right form whose row is not in the table sends the one lookup, which returns no row, and
no page statement).

### 5.4 One snapshot per page

A page of the audit list is five statements on one connection (`reads.db.test.ts`, "a page is one
read-only REPEATABLE READ transaction …"; rows returned in brackets):

```
begin isolation level repeatable read read only                                                              [0]
select "seq", "hash" from "audit_chain_head" limit $1                                                        [1]
select "seq" from "audit_log" where ("audit_log"."seq" = $1 and starts_with("audit_log"."hash", $2::text)) limit $3   [1]   (only with a cursor)
select … from "audit_log" where "audit_log"."seq" > $1 order by "audit_log"."seq" asc limit $2               [6]   (a page of 5)
commit                                                                                                       [0]
```

That it IS one snapshot is shown by behaviour, not by the text: the row statement of a page is held
back after the page has read its head, three rows are committed on another connection, the
statement is let go. The page shows none of the three, its `total` and `head` are those of before,
and the next request sees them (`reads.db.test.ts`, "rows committed between the head read and the
row read of a page are not in it …"). So `total` is never smaller than a `seq` the page shows.

### 5.5 The paging proof (bulk template)

`bulk.db.test.ts`, block "operation 59 at volume: THE PAGING PROOF"; run of 16:33:22; the same lines at 16:08:38 and 16:14:56:

```
[w39] bulk clone after boot and three sign-ins: 5004 audit rows stored, 1000 in the engine's ring; 3653 events stored, 500 in the ring; 25 lineage rows
[w39] paging proof, ASC: 5012 rows at the start, 35 appended during the walk; 26 pages of 200 returned 5047 rows, sequences 1..5047 each once; totals reported 5012 -> 5047
[w39] paging proof, DESC: 5047 rows at the first page, 40 appended during the walk; 26 pages returned sequences 5047..1 each once; totals reported 5047 -> 5087
[w39] 5200 rows = 26 full pages of 200; the last page has no cursor and no page is empty
[w39] bulk events: 3653 stored, walked in 19 pages of 200, each once
```

| Walk | Appended during the walk | Asserted |
|---|---|---|
| Ascending, `limit=200` | After each of the first ten pages: three rows through a unit of work (`app.pipeline.run` with `unit.audit.appendMany`); after every second of them one more through the ENGINE (the hosted `exportAudit`): 35 rows | The sequences of the walked rows are 1, 2, 3, … without a gap and without a repeat; the first 5,012 rows equal the rows stored before the walk, member by member; the tail is exactly the 35 appended rows; the walk ends ON the head of its last page (`seq` = `total`, `hash` = `head`); every page but the last is full; a page's `total` never falls and is never below a row it shows; the shared `verifyAuditChain` over ALL walked rows, from the genesis hash to that head, is `ok` |
| Descending, `limit=200` | Five rows after each of the first eight pages: 40 rows | Exactly the 5,047 rows that existed at the first page, newest first, each once; the appended rows lie before the first page and are not in the walk; `total` goes 5,047 → 5,087 |
| An exact multiple | Rows appended up to 5,200 first | 26 full pages; the last has no cursor; no empty page |
| Other sizes | — | 199 (whole walk), 50 (the default), 1 and 7 (first pages) give the same rows; on the seed clone 1, 7, 50, 64, 200 and a page size equal to the row count |
| Filters at volume | — | Each of the 8 categories, two types, an actor, a session, an evidence item, in both orders: the sequences equal those of the stored rows that match. Counts by category: AUTH 619, SESSION 2,539, EVIDENCE 832, DEVICE 551, SECURITY 262, STORAGE 105, PAIRING 241, SYSTEM 51 |
| Events | — | 3,653 stored events in 19 pages, each once, by `seq`; the three filters |

Assertions go by `seq`, never by `at` (decision D73 DN-1; the file first asserts that `at` descends
exactly once, at sequence 84). Nothing is asserted about the details of the fixture's
`ROLE_CHANGED`, `USER_DISABLED` and `USER_ENABLED` rows (finding F68).

### 5.6 A reset between two pages: what a client sees

`reset.db.test.ts`, "WHAT A CLIENT SEES with a cursor of the discarded chain …" (run of
16:33:22):

```
[w39] after a reset: a cursor on a row appended to the discarded chain -> 422 INVALID_INPUT; a cursor on seed row 40 -> 422 (the new chain has another row 40)
```

| Moment | Answer |
|---|---|
| While the reset runs (readiness held by its caller) | 503 `NOT_READY` on both lists and on the chain operation (stage 2) |
| After it, with a cursor taken before it | **422 `INVALID_INPUT`, `details.in: querystring`**: the contract's documented "a cursor that is not one" (`packages/shared/src/api/operation-parts.ts:56-58`). The row the cursor names is not in the table. This holds for a row appended to the old chain and for a row of the seed history alike: the reset writes the seed history again with the instants of its own clock, so row 40 of the new chain has another hash. Events: the same, by the event's instant |
| What the client does | Starts its walk again without a cursor. It has learnt of the new epoch from the realtime channel in any case (`cause: 'start'`, a snapshot, [EH:§9]). The walk started again is the new chain, whole, and the shared check accepts it; its `SCENARIO_LOADED` row names the head and the row count of the discarded chain |
| The one case in which an old cursor stays valid | The new chain holds the SAME row (same sequence, same hash). Then the pages before it are equal too, and the walk goes on consistently. The test computes which case applies and asserts accordingly |

## 6. `verifyAuditChain`

### 6.1 `view`

`await app.engine.command(request.principal, 'verifyAuditChain')`: the shared check over the
engine's ring, run by the engine host as one unit of work under the caller's identity. It writes
nothing and publishes nothing (`chain.db.test.ts`, "the GET changes nothing …": no audit row, no
event, the revision unchanged, one unit completed). On the bulk clone `view.checked` is 1,000 (the
ring) and `stored.checked` is 5,004 (the table).

The demo fault `AUDIT_TAMPER` breaks the view and cannot reach the table (`chain.db.test.ts`):

```
[w39] AUDIT_TAMPER: view ok=false at seq 107 (HASH_MISMATCH), stored ok=true through 112; after the fault was cleared both verify
```

The ring's row carries `[altered]`; the list (operation 59) still delivers the stored row, whose
hash is the digest of its body.

### 6.2 `stored`: one implementation, called

Decision D67 DN-9 and rule MR-1: the stored-chain check is
`checkStoredChain(queryable, { limit, verifyDigests: verifyStoredAuditRows })`
(`src/db/schema/boot-checks.ts:342`, `src/db/mapping/audit-verify.ts:37`). `stored-chain.ts` calls
exactly that, once per pass (`stored-chain.ts:181-192`). The folder holds no hash function, no
digest and no comparison of a row with its predecessor (`static.test.ts`, rule 5: no `chainHash`,
`auditBody`, `canonicalJSON`, `sha256`, `createHash`, no call of `verifyAuditChain(`, no
`node:crypto`; `checkStoredChain` and `verifyStoredAuditRows` are each named in one file and called
once).

What `checkStoredChain` gives: it reads the NEWEST `limit` rows in sequence order and verifies
them, link by link and digest by digest, with the first row read as the anchor when older rows
exist. What this module adds is the question whether those were the rows that were due.

| The module's bookkeeping (`stored-chain.ts`) | Why |
|---|---|
| The pass runs in one `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` transaction on one connection: the head, the lookup of the remembered row and `checkStoredChain` see one instant | "The newest k rows" are then exactly the rows above the remembered position, however many are appended while the pass runs (`stored-chain.test.ts`, "rows appended WHILE a pass runs …") |
| `limit` = the head's sequence minus the remembered sequence | The rows that are due |
| The first row read must be the one right above the position and name its hash; the last must be the head's row | `checkStoredChain` anchors on the first row it reads; whether that row continues what was verified before is this module's question |
| An incremental pass that does not cover its rows: the position is forgotten and a full pass decides | The bookkeeping never issues a verdict about a row; the one check does |
| A full pass that does not cover the chain: a break | A missing row, or a head that does not name the newest row |
| The verdict's sequence | `verifyStoredAuditRows` returns it inside a text (`HASH_MISMATCH at sequence 17`); it is read with one expression, and a test pins the format (finding F-2) |
| The lineage rule LN-3 that `checkStoredChain` also reports | Not part of the answer [DB:§15.4]; a mismatch is logged once per chain (`LINEAGE_MISMATCH`) |

### 6.3 The incremental verification as a state table

State is in memory, per server process, for the chain named by `<engine epoch>:<pool generation>`.

| State before the call | What the call does | Audit rows read | State after | Test |
|---|---|--:|---|---|
| Nothing remembered (a start, a reset, a scenario load, a resync, a reopened pool) | FULL pass: every stored row from the first | all (n) | verified through the head (seq, hash) | `chain.db.test.ts` "the first call reads EVERY stored audit row once"; "a new epoch drops …"; "a reopened pool drops …"; `reset.db.test.ts` "the remembered head was dropped …" |
| Verified through (s, h); the row s still has the hash h; k rows above it | One lookup of row s by its key (a truth value, no row body), then an INCREMENTAL pass | **k** | verified through the new head | `chain.db.test.ts` "after %i appended row(s) the call reads exactly that many audit rows" |
| The same, k = 0 | The lookup only | **0** | unchanged | "a call with nothing appended reads NO audit row" |
| Verified through (s, h); no stored row has sequence s and hash h | The position is forgotten; FULL pass, which reports a break where it is | all | verified through the head, or a break | `chain.db.test.ts` "the remembered position no longer names its stored row …" (two clones under one name); `stored-chain.test.ts` |
| Verified through (s, h); the rows above do not start at s + 1 on h, or do not end on the head | The incremental pass proved nothing: forgotten; FULL pass | k, then all | as above | `stored-chain.test.ts` "the rows above the position do not continue it" |
| A break is remembered (`firstBadSeq`) | The remembered answer with the current head hash; no snapshot | **0** (one statement on `audit_chain_head`) | unchanged until a new chain | `chain.db.test.ts` "a stored row whose hash is not its digest …"; `stored-chain.test.ts` "is remembered …" |
| A run is under way | The call awaits that run and gets its answer | 0 of its own | — | section 6.5 |
| The database fails during a pass | The call rejects (503 by `app.db.read`); `ROLLBACK`; the connection goes back (or is destroyed when the rollback failed too); nothing is remembered | — | unchanged | `stored-chain.test.ts` "the database fails" |
| The chain's name changed while a run was under way | The run's answer is returned and NOT remembered | — | nothing remembered | `stored-chain.test.ts` "what a run learnt is not kept …" |

`stored.checked` is the sequence verified through: the head's when the chain verifies,
`firstBadSeq - 1` when it does not. `stored.head` is always the current head hash.

The query spy, as printed (`chain.db.test.ts`, seed clone; `bulk.db.test.ts`):

```
[w39] first call after the boot: full pass over 86 stored rows
[w39] query spy: 1 row(s) appended after a verification -> the next call read 1 audit row(s)
[w39] query spy: 4 row(s) appended after a verification -> the next call read 4 audit row(s)
[w39] query spy: 9 row(s) appended after a verification -> the next call read 9 audit row(s)
[w39] bulk, incremental: 7 appended -> 7 audit row(s) read, the whole call 11 ms
[w39] bulk, incremental: 1 appended -> 1 audit row(s) read, the whole call 10 ms
[w39] bulk, incremental: 0 appended -> 0 audit row(s) read, the whole call 10 ms
[w39] epoch 1 -> 2: the next call read all 113 rows again (full pass); the call after it read 0
```

**What "reads exactly k audit rows" means here, stated without rounding.** The spy records every
statement of every connection with the number of rows it returned. In an incremental call exactly
two statements name the audit table: the lookup of the remembered row
(`SELECT EXISTS (SELECT 1 FROM public.audit_log WHERE seq = $1 AND hash = $2) AS holds`, which
returns one truth value and no member of a row) and the one row statement of `checkStoredChain`,
which returns k rows. The test asserts exactly that list (`[['SELECT EXISTS (SELECT 1 ', 1],
['SELECT seq, id, at, type', k]]`). The lookup is what the brief asks for ("whenever it no longer
matches the stored row at that sequence"); without it the anchor would cost one more row (k + 1).
On a database with a lineage row, `checkStoredChain` also sends its LN-3 lookup
(`SELECT details ->> 'previousRows' … WHERE type = 'SCENARIO_LOADED' …`: one value of one row).

### 6.4 The full verification, measured, and whether it must be bounded

`bulk.db.test.ts`, "the first call verifies ALL stored rows in one pass …" (this host, PostgreSQL
18.4, in-process, other rows' suites running):

```
16:08:38  [w39] full verification of 5004 stored rows: the whole call 35 ms (view over 1,000 ring rows, stored over 5004, lineage); the digest check alone over 5004 rows 18 ms (synchronous); the same call with nothing to verify 7 ms
16:33:22  [w39] full verification of 5004 stored rows: the whole call 61 ms (view over 1,000 ring rows, stored over 5004, lineage); the digest check alone over 5004 rows 30 ms (synchronous); the same call with nothing to verify 12 ms
```

The first run was on a quieter host (the 15-minute load average read at 16:19 was 2.9); the second
ran at a 1-minute load average between 5 and 8 (read at 16:26 and 16:33), with other rows' suites
and this row's other files beside it. The second is the one in the asset `39_test_db_verbose.txt`.

| Question | Answer |
|---|---|
| What `stored` answers for 5,000 rows in time | The whole `verifyAuditChain` call, with the full pass, in 35 ms on a quiet host and 61 ms on a loaded one. The pass is the difference to a call with nothing to verify (7 and 12 ms): about 28 to 49 ms, made of one statement that returns 5,004 rows and one synchronous loop of the shared check (18 to 30 ms measured alone: 3.6 to 6 µs per row) |
| How often | Once per chain: after a start, a reset, a scenario load, a resync or a reopened pool. Every later call is incremental (5 to 12 ms measured, of which the view's unit is the larger part) |
| Is it bounded or streamed | **No, and at this volume it need not be.** One pass is one statement and one loop; both grow with the number of rows. Extrapolated from the measured rate, NOT measured (a hypothesis): about 0.2 s of loop and 50,000 rows in memory at 50,000 rows, about 2 s at 500,000. The engine's own write rate is 12 audit rows a minute while recording (decision D77), about 17,000 rows for 24 hours of recording, and a reset starts a new chain |
| Why it is not bounded here | The one stored-chain check reads "the newest n rows" and offers no range. A bounded pass (verify rows a to b, yield, go on) needs a `fromSeq` on `checkStoredChain`, which is the schema row's file; writing a second reader here would be the second check that rule MR-1 forbids. [DB:§4.12] foresees `WHERE seq > $1 ORDER BY seq` for exactly this. Decision DN-1 |
| What limits abuse today | The pass runs once per chain whoever calls; calls that arrive together share it; a break is remembered; the throttle of stage 5 limits calls per session |

### 6.5 Two calls that arrive together run one verification

`chain.db.test.ts`, block "two calls that arrive together run ONE verification". The row statement
of the first call's pass is held back by the spy; the second call (another operator) runs its own
view and reaches the stored check; the statement is let go.

```
[w39] two concurrent calls: 2 calls, 1 run, 3 audit rows read once
```

Asserted: the verifier counted 2 calls and 1 run; one `BEGIN … READ ONLY` and one row statement
(3 rows) were sent for the two answers; both answers carry the same `stored`. With ten calls at
once: 10 answers, 1 run, the 5 appended rows read once. In `stored-chain.test.ts` the three callers
get the SAME object, and a run that fails is shared too (both callers are rejected; the next call
starts afresh).

The view is not shared: each call runs its own hosted action under its own principal (finding F-4).

### 6.6 The lineage

One statement (`reads.ts:186-205`): the seven members the contract names, `ORDER BY reset_no DESC
LIMIT 20`, with `count(*) OVER ()` for the total, so the list and the total are of one instant.
`reset_no`, `first_seq` and `last_seq` are not read: the contract's entry is strict and has no
member for them [C:§3.2].

```
[w39] bulk lineage: 25 stored, 20 returned (reset numbers 25 down to 6), lineageTotal 25
[w39] after two resets: lineageTotal 2; lineage epochs 2, 1 (newest first); reasons SCENARIO_LOAD, RESET; actors null, OPR-002
```

| Case | Result | Test |
|---|---|---|
| Seed, no reset | `lineage: []`, `lineageTotal: 0` | `chain.db.test.ts` |
| Bulk template, 25 rows | The newest 20 (reset numbers 25 down to 6), newest first, equal to the stored rows member by member; `lineageTotal` 25 | `bulk.db.test.ts` |
| After one reset (`RESET`, `idle`, by the SUPERVISOR) | One entry: the epoch the chain ended in, its row count and head hash (as operation 58 answered them before the reset), the instant of the reset on the server clock, `OPR-002`, `idle`, `RESET` | `reset.db.test.ts` |
| After two resets (the second: `SCENARIO_LOAD`, `recording`, no operator) | Both, newest first; the older entry is as it was; `actorId: null` for the second; `lineageTotal` 2; the answer equals the two stored rows in the reverse of their reset order | `reset.db.test.ts` |
| Who reads it | Every signed-in role gets the same lineage; without a session 401 | `reset.db.test.ts` |

The reset is the ROUTINE itself (`resetDatabase`, `src/db/reset`) on a `tpl_seed` clone, with the
quiesce of its server-side caller as the engine row's test runs it [EH:§10]: readiness held, the
pipeline drained, `engine.stop()`, the pool closed; then `db.reopen()`, `engine.reload()`. The
demo-control module that will call it is another row.

## 7. The two exports

### 7.1 What an export produces, and the question of a file

[SP:§7.13] gives both operations the success answer 202 `AuditExportAccepted` and the audit rule
`AUDIT_EXPORTED`; [SP:§11] says in its table: "An audit or log export file | Built by the client
from server rows (operations 59 and 63) after the server accepted the export (operations 61, 62)
| — | The accepted export and its audit row"; rules MS-3 and MS-4 say the server resolves no file
path and `@fastify/static` is not installed. The contract repeats it on both operations: "The
answer holds no file. The client builds it from the pages of `GET /api/v1/audit` (and of
`GET /api/v1/events` for the log bundle) once the export is accepted."

**So this module writes no file and returns none.** What an accepted export leaves is what the
hosted action and the engine host write (`exports.db.test.ts`, "answers 202 with the export ID …"):

| Left behind | By | Content |
|---|---|---|
| One `AUDIT_EXPORTED` audit row | The simulator's action, written through by the engine host | Actor: the session's operator. Details: `exportId`, `rows`, `head`, `chainOk`, `eventKind: EXPORT`, `reason`, `destination`; for the log bundle also `scope: LOGS` and `events` |
| One row of `exports` | The engine host, derived from that audit row (`src/db/mapping/exports.ts`) | `id`, `scope` (`AUDIT` or `LOGS`), `evidence_id` NULL, `operator_id`, `reason`, `destination`, `at` |
| An operational event | — | **None**: the simulator emits no event for an accepted audit or log export (asserted: the event count does not move). A DENIED export has one (section 7.3) |

`static.test.ts` rule 4 keeps the folder free of every file, path, stream and network module and
of every statement that changes a row.

### 7.2 The reason: two 422 answers, in the specification's order

The route has no body schema of its own. The handler reads the body with the contract's
`AuditExportRequestSchema` (`export-request.ts`) as one of three (decisions D50, D64, D92 DN-2):

| Reading | When | What happens | Answer |
|---|---|---|---|
| `VALID` | The schema accepted it | The action gets `{ reason, destination }` as the schema trimmed them; an absent or blank destination is the empty text, for which the action names its default "Audit archive (simulated)" | 202 |
| `REASON_MISSING` | The ONLY fault is the reason's lower bound: absent, empty, blank, or fewer than 5 characters | The action gets `NO_REASON` (an empty reason), **never the text that was sent**, and refuses it in its own order (401, the audited 403, then the reason) | 422 `INVALID_REASON`, `details.simCode: REASON_TOO_SHORT` |
| `INVALID` | Anything else: not text, longer than 500 code units, U+0000, an unpaired surrogate, a destination that is not text or longer than 120 | The engine is not called | 422 `INVALID_INPUT`, `details.in: body` |

Why the refused text is never handed on: the contract counts characters and the simulator counts
code units, so a reason of three two-unit characters is too short for the first and long enough
for the second (`export-request.test.ts`, "WHY the refused text is never handed on …":
the simulator's action accepts it). Why a request is always handed on: the simulator's form
WITHOUT a request records an export with no reason (`export-request.test.ts`, "WHY a request is
always handed on …").

Seven bodies without a usable reason, on both operations (`exports.db.test.ts`): no body at all,
`{}`, a destination and no reason, an empty reason, a blank one, four characters, three two-unit
characters. Each: 422 `INVALID_REASON`; the action ran and wrote nothing (no audit row, no event,
no export record, the revision unchanged).

### 7.3 The denied export (RB-5; decision D83 DN-4)

`exports.db.test.ts`, block "a caller without AUDIT_EXPORT", for the INVESTIGATOR and the
TECHNICIAN on both operations: 403 `NOT_PERMITTED` with `details: { operationId, permission:
'AUDIT_EXPORT', role }`; exactly ONE new audit row, `EXPORT_DENIED`, WARNING, the operator as its
actor, details `{ operationId, permission, role, scope, eventKind: 'UNAUTHORIZED_EXPORT' }`
(`operationId` and `permission` are what the guard adds to the simulator's row: the row is the
guard's); exactly one event `EXPORT_DENIED`; the hosted action did not run
(`engine.stats().commands` unchanged); no export record. The refusal does not depend on the body:
no body, a short reason and a body that breaks the schema are refused the same way, one row each.

The module writes no denial row and names neither denial type (`static.test.ts`, rule 2). The one
line that maps a `FORBIDDEN` in the action's RESULT (to 403 `NOT_PERMITTED`, the code of these two
operations) is reached only when the right went away between stage 6 and the unit; it is answered
after the unit (`routes.test.ts`, "a refusal the simulator reports IN ITS RESULT …").

### 7.4 The answer: the chain the export covers

`AuditExportAccepted` is `{ exportId, scope, rows, head }`. `exportId` is the action's; `scope` is
the operation's. `rows` and `head` are taken from the `AUDIT_EXPORTED` row the export wrote, found
by its export ID among the newest rows of the committed ring: **`rows` = its sequence minus one,
`head` = its `prevHash`**. So the answer names the stored chain the export covers, and a client
that walks operation 59 up to `rows` ends on the row whose hash is `head`
(`exports.db.test.ts`, "a client that walks the audit list up to `rows` …").

The simulator's own count in the row's details is the length of its RING (finding F-1):

```
[w39] bulk export: the answer says rows 5200 (the stored chain); the AUDIT_EXPORTED row's details say rows 1000 (the engine's ring)
```

On a chain of up to 1,000 rows the two are equal; `details.head` equals the answer's `head` always.

## 8. The security status (operation 58)

`{ security, auditHead, auditTotal }`: the committed slice `security` in its wire form, and the
STORED head: `SELECT "seq", "hash" FROM "audit_chain_head" LIMIT 1`, one row of one statement, so
the two values are of one instant by construction. No transaction, no unit of work, no statement on
`audit_log` (`reads.db.test.ts`, "head and total come from ONE row of ONE statement …"). The head
is the hash of the newest stored row and the total its sequence; after three appended rows the
total is three more. On the bulk clone the total is the stored 5,000-odd, not the ring's 1,000
(`bulk.db.test.ts`, "getSecurityStatus answers the stored head and total").

## 9. No secret in any answer (rule 6 of the brief)

Audit rows and events are returned as stored. `support.ts` `secretFindings` scans a JSON value for:
the three bearer forms and the pairing QR payload of the contract (`looksLikeSecret` of the core,
and the same patterns unanchored), a password hash in the PHC string format, any run of exactly 43
base64url characters (the body of every bearer secret), the shared demo password, and a key of the
audit writer's forbidden list under `details` or `params`. A finding names the place and the kind,
never the value. The positive control plants each kind and finds it; a chain hash, an ID, an
instant and a cursor are not findings.

```
[w39] secret scan, seed clone: 19 answers, 149448 characters, 0 findings
[w39] secret scan, bulk clone: 48 answers, 3106503 characters, 0 findings
```

Seed clone: both lists in both orders and under every category and severity, and the status; also
asserted that no answer holds the username of a seeded operator (the three sign-ins of the file are
among the rows). Bulk clone: every page of both lists, the status and the chain status.

## 10. Status table per operation, with the test of each

Statuses the module itself produces, and the stages' answers it was run through. Every answer
listed was validated with `validateCoreApiResponse`.

| # | Status and code | When | Test |
|--:|---|---|---|
| 58 | 200 | A signed-in operator of any role | `reads.db.test.ts` "answers the committed slice …"; "every signed-in role …" |
| 58 | 401 `NOT_SIGNED_IN` | No session; a paired device without an operator | `reads.db.test.ts`; `routes.test.ts` "%s: nobody, and a paired device …" |
| 58 | 503 `NOT_READY` | The engine is not running; the read on the pool failed | `routes.test.ts` "an engine that is not running …"; "a read that fails …" |
| 59 | 200 | Any role; with and without filters, cursor, order, limit | `reads.db.test.ts`, `bulk.db.test.ts` |
| 59 | 401 | As 58; decided before the query is looked at | `reads.db.test.ts` "every signed-in role may read the audit list …"; `routes.test.ts` |
| 59 | 422 `INVALID_INPUT` | A query member outside its schema (14 cases); a cursor that is none of this list; a cursor whose row is not in the table | `routes.test.ts` "listAuditRows ?%s …"; `reads.db.test.ts` "a query that does not match …", "a cursor that is not one …"; `reset.db.test.ts` |
| 59 | 503 | The read failed | `routes.test.ts` "a read that fails …"; `reset.db.test.ts` (during a reset) |
| 60 | 200 | Any role: view and stored verify; view broken by AUDIT_TAMPER; with a lineage | `chain.db.test.ts`, `reset.db.test.ts`, `bulk.db.test.ts` |
| 60 | 401 | As 58; neither the engine nor the table is asked | `chain.db.test.ts` "every signed-in role may call it …" |
| 60 | 503 | The view's unit was not committed; the engine is not running; the read failed | `routes.test.ts` "a unit of the view that could not be committed …", "a read that fails …" |
| 61, 62 | 202 | The SUPERVISOR with a reason of 5 to 500 characters | `exports.db.test.ts` "an accepted export" (4 tests per operation); `bulk.db.test.ts` |
| 61, 62 | 400 `INVALID_JSON` | A body that is not a JSON object | `exports.db.test.ts`, `routes.test.ts` |
| 61, 62 | 401 | No session; `NOT_SIGNED_IN` in the action's result | `exports.db.test.ts`; `routes.test.ts` |
| 61, 62 | 403 `NOT_PERMITTED` | The role lacks `AUDIT_EXPORT` (the guard, one `EXPORT_DENIED` row); `FORBIDDEN` in the action's result | `exports.db.test.ts` "a caller without AUDIT_EXPORT"; `routes.test.ts` |
| 61, 62 | 403 `ORIGIN_NOT_ALLOWED` | The cookie without the web console `Origin` (stage 3) | `exports.db.test.ts`, `routes.test.ts` |
| 61, 62 | 422 `INVALID_REASON` | No reason, or one shorter than 5 characters | `exports.db.test.ts` "without a reason" (7 bodies per operation); `routes.test.ts` |
| 61, 62 | 422 `INVALID_INPUT` | A body that breaks the schema otherwise | `exports.db.test.ts` (6 bodies per operation); `routes.test.ts` |
| 61, 62 | 500 `INTERNAL_ERROR` | A defect: the export's row is not in the committed ring; a refusal the action does not have | `routes.test.ts` |
| 61, 62 | 503 | The unit was not committed | `routes.test.ts` "a unit that could not be committed …" |
| 63 | 200 | Any role; with and without filters, cursor, limit | `reads.db.test.ts`, `bulk.db.test.ts` |
| 63 | 401 | As 58 | `reads.db.test.ts`, `routes.test.ts` |
| 63 | 422 `INVALID_INPUT` | A query member outside its schema (7 cases); a cursor that is none of this list or whose event is not in the table | `routes.test.ts`, `reads.db.test.ts` "refusals …" |
| 63 | 503 | The read failed | `routes.test.ts` |

The role-by-operation decision is the guard's; one allowed and one refused call per operation is
what this row shows (rule M11): allowed 200 / 200 / 200 / 202 / 202 / 200; refused 401 on all six,
and 403 on the two operations that have a permission. The four reads have no denied cell for a
signed-in operator (AUTHENTICATED).

## 11. Measured round trips (rule M13)

`roundtrips.db.test.ts` sends ONE request per case on a seed clone and lists every statement the
server sent for it, over every connection (the query spy; rows returned in brackets). Times are
in-process (`app.inject`, no socket), on this host while other rows' suites ran: an order of
magnitude, not a benchmark. Run of 16:32:31.

| Call | Statements | Time | What they are |
|---|--:|--:|---|
| 58 `getSecurityStatus` | 2 | 2.8 ms | Stage 4's session lookup; the head |
| 59 `listAuditRows`, first page of 50 | 5 | 4.3 ms | Session lookup; `begin`; the head; the rows [51]; `commit` |
| 59, a page of 5 with a cursor | 6 | 3.0 ms | The same, and the lookup of the cursor's row [1]; rows [6] |
| 63 `listEvents`, first page of 50 | 4 | 3.2 ms | Session lookup; `begin`; the events [51]; `commit` |
| 60 `verifyAuditChain`, first call (full pass, 84 rows) | 12 | 9.5 ms | Session lookup; the view's unit (5); the stored check's snapshot (5, of which one returns the 84 rows); the lineage (1) |
| 60, after 2 appended rows | 13 | 6.5 ms | The same, and the lookup of the remembered row; the row statement returns 2 |
| 60, nothing appended | 11 | 4.5 ms | No row statement and no LN-3 lookup |
| 61 `exportAudit`, accepted | 9 | 7.3 ms | Session lookup; ONE unit of work of the engine host (8) |
| 62 `exportLogs`, accepted | 9 | 4.8 ms | The same |
| 61, without a reason (422) | 6 | 3.6 ms | Session lookup; the unit opens, mirrors the operators, writes nothing, commits |

The two longest, as printed:

```
[w39] round trips, 60 verifyAuditChain, after 2 appended rows: 13 statements, 6.5 ms in-process
     1. SELECT s.id, s.operator_id, s.device_id, s.method, s.issued_at, s.last_seen_at [1]      stage 4
     2. BEGIN ISOLATION LEVEL READ COMMITTED [0]                                               the view: a unit of the engine host
     3. SELECT seq, hash FROM public.audit_chain_lock() [1]
     4. SELECT set_config('statement_timeout', $1, true), set_config('search_path', $2 [1]
     5. select "id", "username", "rank", "name", "display_name", "initials", "role_id" [3]
     6. COMMIT [0]
     7. BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY [0]                                    the stored check: one snapshot
     8. SELECT seq, hash FROM public.audit_chain_head [1]
     9. SELECT EXISTS (SELECT 1 FROM public.audit_log WHERE seq = $1 AND hash = $2) AS [1]     the remembered row: a truth value
    10. SELECT seq, id, at, type, category, severity, actor_id, message, session_id, e [2]     the k = 2 audit rows
    11. SELECT head_hash, row_count FROM audit_chain_history ORDER BY reset_no DESC LI [0]     LN-3 of the one check
    12. COMMIT [0]
    13. select "epoch", "row_count", "head_hash", "reset_at", "actor_id", "scenario",  [0]     the lineage
[w39] round trips, 61 exportAudit, accepted: 9 statements, 7.3 ms in-process
     1. SELECT s.id, s.operator_id, s.device_id, s.method, s.issued_at, s.last_seen_at [1]      stage 4
     2. BEGIN ISOLATION LEVEL READ COMMITTED [0]                                               one unit of the engine host
     3. SELECT seq, hash FROM public.audit_chain_lock() [1]
     4. SELECT set_config('statement_timeout', $1, true), set_config('search_path', $2 [1]
     5. select "id", "username", "rank", "name", "display_name", "initials", "role_id" [3]
     6. insert into "audit_log" ("seq", "id", "at", "type", "category", "severity", "a [1]     AUDIT_EXPORTED
     7. insert into "engine_counters" ("name", "next_value") values ($1, $2) [1]               the export ID's counter
     8. insert into "exports" ("id", "scope", "evidence_id", "operator_id", "reason",  [1]     the export record
     9. COMMIT [0]
```

(The remarks to the right of the brackets are added here; the test prints the statements.) No
statement of the two exports is this module's: all eight are the engine host's. The module's own
statements are the head (58), the page reads (59, 63), lines 7 to 9 and 12 of the chain call, and
the lineage.

## 12. What the two clients can rely on

For the web Security & Audit page (`apps/core-web`) and the mobile Operator Audit screen
(`apps/mobile`), through the Live source.

| Point | Fact |
|---|---|
| Who may read | Every signed-in role: status, audit list, events, chain status with the lineage. Without a session 401 |
| Audit rows | Each row arrives with `seq`, `prevHash`, `hash` and its whole hashed body, in the member order the shared chain hashes. A client's own chain check (`verifyAuditChain` of `@dems/shared/sim`) over rows walked from the first page accepts them (`dropped: 0`, `head` and `total` of the last page) |
| The list is the STORED chain | It can be longer than the ring a client holds from the socket (1,000 rows; events 500). `total` and `head` of a page are the stored chain's at the instant of that page, whatever the filters |
| Paging | `limit` 1 to 200 (50 when omitted); ascending when `order` is omitted, `order=DESC` for newest first; follow `nextCursor` until it is null. The last page is never empty. Rows appended meanwhile: an ascending walk ends on the head of its last page; a descending walk shows exactly what existed at its first page |
| The cursor | Opaque. A position under any filter and either order. **After a reset or a scenario load a cursor answers 422 `INVALID_INPUT`: start the walk again.** During a reset: 503 `NOT_READY` |
| Filters | Audit: `category`, `type`, `actorId` (`OPR-NNN`), `sessionId`, `evidenceId`; any combination (AND). Events: `category`, `type`, `severity`. A value outside its set: 422 |
| Chain status | `view` is the check over the server's ring (what `AUDIT_TAMPER` breaks; `index` and `seq` name the altered row). `stored` is the table: `ok`, `checked` (the sequence verified through), `head`, `firstBadSeq`. A demo fault never changes `stored`. On a chain longer than 1,000 rows `view.checked` is 1,000 and `stored.checked` is the whole count: they count different things |
| Chain status, cost | The first call after a start or a reset takes longer (35 to 61 ms for 5,000 rows here); later calls 5 to 12 ms. It is a GET and changes nothing; it may be polled within the throttle |
| Lineage | At most 20 entries, newest first; `lineageTotal` says how many chains were discarded in all; `actorId` is null for a reset from the command line. The page needs no query of its own |
| Export | POST with `{ reason, destination? }`: the reason is mandatory, 5 to 500 characters after trimming. 202 `{ exportId, scope, rows, head }`: `rows` is how many stored rows the export covers and `head` the hash of the last of them, so the file a client builds is the rows 1 to `rows` of operation 59 (and all events of operation 63 for the log bundle). The server writes no file. The answer carries `x-dems-epoch` and `x-dems-revision` |
| Export refused | 422 `INVALID_REASON` (missing or too short; `details.simCode: REASON_TOO_SHORT`), 422 `INVALID_INPUT` (any other fault of the body), 403 `NOT_PERMITTED` (`details: { operationId, permission, role }`; one `EXPORT_DENIED` row was written and is in the audit list and the events) |
| Status | `auditHead` and `auditTotal` are the stored chain's; `security` is the slice of the socket |
| What an answer never holds | A token, a hash of a credential, a code, a password. No key material: a key record is an identifier, an algorithm, a fingerprint and an expiry |

## 13. Verification

### 13.1 The row commands

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/security-audit        (16:32:58, exit 0)

 Test Files  5 passed (5)
      Tests  196 passed (196)
   Start at  16:32:58
   Duration  2.52s (transform 42%, import 42%, tests 15%)
```

```
$ DEMS_TEST_STEP=61 npm run test:db -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/security-audit        (16:33:21, exit 0)

[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_61_tmdmjmun_
[test:db] stale sweep: dropped 0; kept 12 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_61_tmdmjmun_tpl_schema: built in 202 ms (create 95 ms, hook 103 ms)
[test:db] template dems_test_step_61_tmdmjmun_tpl_seed: built in 318 ms (create 99 ms, hook 217 ms)
[test:db] bulk fixture: dems_test_step_61_tmdmjmun_tpl_bulk as dems_owner; clock 2026-10-01T03:00:00.000Z; seed 20261004
 …
[test:db] bulk fixture: every minimum of the 30 tables is met; audit head seq 5000, hash 46382e11b1601087...; digest 3d2e7fe247a44ec2...; build 163 ms, write 1096 ms, total 1261 ms
 …
 Test Files  6 passed (6)
      Tests  126 passed (126)
   Start at  16:33:22
   Duration  13.03s (tests 70%, import 19%, transform 11%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 164 ms; 0 remain with the run prefix dems_test_step_61_tmdmjmun_
```

Every test by name, with what each printed: `implementation/assets/39_test_unit_verbose.txt` (196
pass marks) and `39_test_db_verbose.txt` (126 pass marks, 0 failures). The database command needs
the per-command sandbox bypass (PostgreSQL on 127.0.0.1:4432), as every database command of the
task does.

### 13.2 The module gate (MODG)

| Gate item | Met by |
|---|---|
| The route list equals the module's registry operations | Section 3 (both lists printed, compared with `toEqual`); "the area of the registry is these six and no other, numbered 58 to 63" |
| Every documented status the module can produce has a test, and every answer validates against the contract | Section 10; `validateCoreApiResponse` on 200, 202, 400, 401, 403, 422 and 503 |
| One allowed and one refused call per operation | Section 10, last paragraph |
| Routes from the registry, schemas from the contract (rule M2) | `static.test.ts` rule 6; the response schemas are the contract's (`index.ts:193, 204, 226, 238, 245, 252`) |
| No check of who calls and no denial row in the module (rule M3) | `static.test.ts` rules 1 and 2; `routes.test.ts` "no route carries a check of its own" |
| Hosted actions through `app.engine.command`, answered after it resolves (rule M4) | `static.test.ts` rule 3; sections 4, 7.3 |
| An error is logged only as `{ err }` (rule M14) | The folder's four log calls carry a code and numbers, never an error (`static.test.ts` rule 8); a failed read is logged by `app.db.read` |
| Tests on the helper's clones, a running engine on a manual timer, counts relative to the state after the boot (rule M9) | `support.ts` `auditApp`; `DEMS_TEST_STEP=61`; templates `seed` and `bulk`; no `dems_demo`, no lane |
| No assertion on what other rows change (rule M10) | The route test filters by the module's four path prefixes; nothing pins the total of routes, the stubs or the boot steps. No test of another row was edited |
| `typecheck` and `lint` exit 0 without a warning | Section 13.3 |
| A mutation check of the module's own logic | Section 14 |

### 13.3 Whole projects, typecheck, lint (final state)

```
$ npm run typecheck -w @dems/core-server                         (16:39:46)   exit 0
$ npm run lint -w @dems/core-server                              (16:39:53)   exit 0
src/realtime/__tests__/support.ts:360:27: warning unicorn(no-useless-spread): …
src/realtime/hub.ts:857:33: warning unicorn(no-useless-spread): …
src/realtime/hub.ts:860:33: warning unicorn(no-useless-spread): …

$ npm run test -w @dems/core-server -- --maxWorkers=2                           (16:33:42 to 16:34:35, exit 0)
 Test Files  134 passed (134)
      Tests  3503 passed (3503)
   Start at  16:33:42
   Duration  52.56s (import 61%, tests 33%, transform 5%, worker 1%)

$ DEMS_TEST_STEP=61 npm run test:db -w @dems/core-server -- --maxWorkers=2      (16:34:40 to 16:38:20, exit 0)
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_61_tmdmltya_
[test:db] stale sweep: dropped 0; kept 7 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 …
 Test Files  105 passed (105)
      Tests  1513 passed (1513)
   Start at  16:34:41
   Duration  219.20s (tests 84%, import 14%, transform 1%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 388 ms; 0 remain with the run prefix dems_test_step_61_tmdmltya_
```

Full output: `implementation/assets/39_final_runs.log`. Each whole project was run ONCE, at the
end, with `--maxWorkers=2` (rule M15).

**Lint "without a warning":** the command exits 0; no warning is in this module's folder; the
three that remain are in `src/realtime/`, the realtime row's folder, in flight. This row cannot
remove them (rule M1).

**Typecheck:** exit 0 at 15:50 (the five production files), at 16:33:01 (the production code as
delivered) and at 16:39:46 (the final tree). Between 16:38:31 and 16:38:53 it was red in files of
rows in flight only (section 13.4). After 16:33:01 this row changed one expression of one test file
(`roundtrips.db.test.ts:73`, a lint fix) and nothing else.

### 13.4 Other rows' reds seen while this row ran (P11, rule M12)

| Time | Command | Result | Whose |
|---|---|---|---|
| 15:59 | `typecheck` | exit 2: `src/realtime/messages.ts(42,53)` TS2305 (`SessionState` is not exported by `@dems/shared/sim`) | The realtime row, in flight |
| 16:13 | `typecheck` | exit 2: `src/db/fixtures/identity.ts(307,13)` and `(318,13)` TS2322; and one of this row (`chain.db.test.ts(236,93)` TS2339, a narrowing lost in a callback; fixed at once) | A change of the bulk fixture in flight (finding F68); this row |
| 16:13 | `lint` | exit 0; warnings: `src/realtime/hub.ts:854, 857`; `src/modules/identity/biometric/__tests__/sign-in.db.test.ts:48`; one of this row (`chain.db.test.ts:19`, an unused import; fixed at once) | The realtime row; the biometric row; this row |
| 16:08, 16:14, 16:33 | The bulk template's digest | `953c92ea…`, then `88536632…`, then `3d2e7fe2…` (head hash `d2d9f9e5…`, `b1a3128a…`, `46382e11…`) | A change under `src/db/fixtures` in flight. This row's bulk tests passed on all three |
| 16:33:08 | `lint` | exit 0; one warning of this row (`roundtrips.db.test.ts:73`, a caret expression where `startsWith` does; fixed at once); three in `src/realtime` | This row; the realtime row |
| 16:38:31, 16:38:53 | `typecheck` | exit 2, the same six lines both times: `src/realtime/__tests__/first-contact.db.test.ts(482,71)` TS2353; `packages/shared/src/realtime/index.ts(3,15)` and `use-heartbeat.ts(3,34)` TS6142; `use-heartbeat.ts(11,38)`, `(11,56)`, `(11,76)` TS2339 | The realtime row, in flight: a test of its folder drew a `.tsx` file of the shared package into the server's program. None under `src/modules/security-audit` |
| 16:39:46 | `typecheck` | exit 0 | — |

No test of any row failed in the two whole-project runs of section 13.3, and none in any run of
this row's own files after its own fixes. This row edited no file outside its folder at any time
and no test of another row.

### 13.5 Verification list of the row

| Item of the row | Result | Where |
|---|---|---|
| MODG | Met | Section 13.2 |
| Paging of `listAuditRows` over the bulk fixture returns every row once while rows are appended | Yes: 5,012 + 35 rows, sequences 1..5047 each once (ASC); 5047..1 each once (DESC) | Section 5.5 |
| An export without a reason answers 422 `INVALID_REASON` | Yes, 7 bodies on each of the two operations | Section 7.2 |
| After two resets the operation returns both lineage rows, newest first | Yes: epochs 2, 1; `lineageTotal` 2 | Section 6.6 |
| After one full verification a call that follows k appended rows reads exactly k audit rows (a query spy) | Yes: k = 1, 4, 9, 7, 1, 0 | Section 6.3 |
| Two concurrent calls run one verification | Yes: 2 calls, 1 run; 10 calls, 1 run | Section 6.5 |
| `DEMS_TEST_STEP=61` for `test:db` | Every run; the run prefix is `dems_test_step_61_…` | Section 13 |
| Whole `unit` and `db` projects at the end | Exit 0 both: 134 files / 3,503 tests; 105 files / 1,513 tests | Section 13.3 |
| Typecheck and lint exit 0 without a warning | Typecheck exit 0 (16:39:46). Lint exit 0; no warning in this module; three warnings in `src/realtime` (another row, in flight) | Section 13.3 |
| A mutation check of the module's own logic | 99 of 99 detected | Section 14 |
| No database of the row's prefix remains | 0 | Section 21 |
| `.locks/postgres.pid` 19121 | 19121 | Section 21 |

## 14. Mutation check

99 defects were planted one at a time in the five production files and the row's own tests run on
each. **99 of 99 detected.**

**No file of the workspace tree was changed, at any time (rule M15).** The harness of the identity,
guard and evidence rows was reused: a scratch Vitest configuration under the session's scratchpad
(outside the repository) whose one transform hands ONE production file to Vitest with ONE text
replaced (`39_mutation_harness.vitest.config.mjs.txt`, `39_mutation_harness.run.sh.txt`,
`39_mutations.json`; result lines `39_mutations.log`). The runner changes no directory (Vitest gets
the workspace as `--root`), writes Vitest's output into a file and reads it afterwards, runs with
`--maxWorkers=2`, and runs the database tests of a mutation only when the unit tests did not
detect it.

| Pass | Result |
|---|---|
| Baseline through the harness, 16:19:15 | 5 unit files / 195 tests and 5 database files / 121 tests, all passing |
| All 99, 16:19:23 to 16:31:51 | **97 detected.** Not detected: S20 (a real gap of the tests) and I10 (the replaced text left a call without its closing parenthesis: the file did not load, so the runner, which counts only failed TESTS, called it "not detected"). No test file was edited while the pass ran |
| Second pass, 16:32:43 to 16:32:49, after one unit test was added (the empty table under a verified position) and the text of I10 was corrected | S20 detected (1 failed of 196); I10 detected (8 failed of 196) |

By file:

| File | Mutations | Examples |
|---|---|---|
| `cursor.ts` | C01 to C09 | A fixed mark instead of the row's hash; text after the mark accepted; upper-case digits; an ID with extra leading zeros; sequence 0; an event cursor without its instant; an instant with a leading zero or above the largest safe integer |
| `export-request.ts` | X01 to X06 | An absent reason as `INVALID_INPUT`; a fault of the destination counted as a missing reason; **a stand-in reason the action accepts (X03: an export without a reason goes through)**; an absent destination given a text; every refused body as a missing reason |
| `reads.ts` | R01 to R28 | **Not one snapshot (R01, and R15: the head read outside it; each detected by the test that holds a page's row statement back)**; **the cursor's mark not compared (R02) and an unknown row accepted (R03, R28): a cursor of a discarded chain goes through**; the keyset the wrong way, or not strict; `order=DESC` ignored; no look-ahead row, the look-ahead row in the page, a cursor on an exactly full last page (R08, R22: one test each); each of the eight filters ignored; the events newest first; **the lineage oldest first (R23), limited to 25 (R24), `lineageTotal` as the number returned (R25) or from the first row's position (R26)** |
| `stored-chain.ts` | S01 to S24 | **Every call reads the whole table (S01)**; **the remembered row not looked up (S02)**; **the first row of a pass need not name the position's hash (S03)**; **no single run for calls that arrive together (S04)**; **a new chain does not forget (S05)**; a break not remembered (S06, S23); `checked` counting the bad row; what a run learnt kept although the chain changed; a verified head not remembered; a pass that stops short of the head, or ends in another hash, taken as verified; the verdict's sequence not read; an incremental pass that does not cover its rows taken as the verdict; the pass not one snapshot; a connection whose rollback failed handed back; the lineage warning at every pass; every pass from the first row |
| `index.ts` | I01 to I32 | The default page 200 (I01, I24); the default order newest first; a foreign cursor ignored; **a cursor of a discarded chain answered as an empty last page (I04, I29)**; `total` as the page size; never a cursor; **`auditTotal` from the ring (I07: detected only by the bulk test)**; **the view answered from the stored check (I08: detected only by the AUDIT_TAMPER test)**; **the lineage not limited to 20 (I09)**; **the refused reason handed to the engine (I10)**; a schema-breaking body reaching the engine; `FORBIDDEN` kept as the code; no state position; 200 for 202; **the answer's row count from the row's details (I15), counting its own row (I16), its own hash as the head (I17)**; the newest export row whichever export it records; `INVALID_REASON` without its details; the log export with the scope or the action of the audit export; **the chain's name without the epoch (I27), without the pool's generation (I26), or constant (I25)**; a copy of the principal handed on (I28, I32); a refusal the action does not have passed on as it came |

The three things the brief names: the cursor (C01 to C09, R02 to R05, R16, R17, R28, I03, I04, I29,
I30), the incremental verification's bookkeeping (S01 to S24, I25 to I27), the lineage limit (R23
to R26, I09).

Limits of the check: each mutation is one text replaced in one file; the static test reads the
sources from disk, not through the transform, so it cannot see a mutation (the rules it keeps have
positive controls of their own); the test files were not mutated; the runner reports a mutant that
does not load as "not detected", never as detected.

## 15. Test ledger (P24)

`@dems/core-server` only. No other workspace was written.

| Project | Controller baseline (15:27, from the brief) | Final | This row | Other rows in flight since the baseline |
|---|---|---|---|---|
| `unit` | 102 files, 2,660 tests | 134 files, 3,503 tests, 0 failed (16:34:35) | **+5 files, +196 tests** | +27 files, +647 tests |
| `db` | 75 files, 1,081 tests | 105 files, 1,513 tests, 0 failed (16:38:20) | **+6 files, +126 tests** | +24 files, +306 tests |

Expected total = baseline + reported additions: this row accounts for 196 and 126; the remainder is
the work of the rows that write at the same time (pairing, sessions, demo control, realtime, the
biometric part of identity, the guard owner's follow-up and the foundation fix round), whose own
ledgers name their files. Both totals are above the baseline and failed is 0.

| Project | File (under `src/modules/security-audit/__tests__/`) | Tests |
|---|---|--:|
| `unit` | `cursor.test.ts` | 9 |
| `unit` | `export-request.test.ts` | 37 |
| `unit` | `stored-chain.test.ts` | 39 |
| `unit` | `routes.test.ts` | 88 |
| `unit` | `static.test.ts` | 23 |
| `db` | `reads.db.test.ts` | 31 |
| `db` | `chain.db.test.ts` | 19 |
| `db` | `exports.db.test.ts` | 47 |
| `db` | `reset.db.test.ts` | 9 |
| `db` | `bulk.db.test.ts` | 15 |
| `db` | `roundtrips.db.test.ts` | 5 |

Test support, not a test file: `src/modules/security-audit/__tests__/support.ts`. No existing test
of any row was changed by this row. The module's stub had no assertion in
`plugins/readiness/__tests__/readiness.test.ts` to delete (checked at 15:46).

## 16. Requirement to test

| Requirement | Statement | Test |
|---|---|---|
| SR-78 (read) | `verifyAuditChain` returns the durable lineage | `reset.db.test.ts` (after one and after two resets; the answer equals the stored rows); `bulk.db.test.ts` (20 of 25) |
| SR-81 | The stored-chain verification is incremental: a call reads only the rows above the last verified position | `chain.db.test.ts` (query spy, on the route); `stored-chain.test.ts` (every state of section 6.3) |
| AC-B-87, for operation 60 | After two resets `verifyAuditChain` returns both rows in `lineage`, newest first | `reset.db.test.ts` "operation 60 returns BOTH lineage rows …", "every signed-in role reads the same lineage", "the answer is what the table holds …". The rest of the criterion (the table's byte equality, the refused UPDATE, DELETE and INSERT) is the reset row's and the schema row's |
| AC-B-88 | After one full verification a call that follows k appended rows reads exactly k audit rows (a query spy); two concurrent calls run one verification | `chain.db.test.ts` "after %i appended row(s) …", "the second call awaits the first …", "ten calls at once …" |
| API-9 | Lists are cursor-paged, ordered by sequence, stable while rows are appended | Section 5.5 |
| RB-5 | The two exports keep the denial type `EXPORT_DENIED` | Section 7.3 |
| SR-54 | No secret in an audit row or an event that is returned | Section 9 |
| SR-64 | Every input is validated by the contract's schema | `routes.test.ts` (the two queries, the body) |
| MS-3, MS-4 | No file path, no file | `static.test.ts` rule 4; section 7.1 |

## 17. What the specification left open, and this row's choices

| # | Open point | Choice | Why |
|--:|---|---|---|
| 1 | The form of the cursor ("opaque"; "a sequence number … fits", [C:§3.5]) | The row's ID and a mark of the row (16 hash digits; an event's instant) | A bare sequence is valid in any chain; section 5.3 |
| 2 | What a cursor of a discarded chain answers | 422 `INVALID_INPUT`, the documented "a cursor that is not one" | The contract has exactly this answer; no new code |
| 3 | `rows` and `head` of `AuditExportAccepted` ("Audit rows the export covers", "Head hash of the chain the export covers") | The stored rows before the export's own row, and the hash of the last of them | A client builds the file from the stored list; the simulator's count is its ring's (finding F-1) |
| 4 | What names "the current epoch" for the remembered head | The engine's epoch AND the pool's generation | A start, a reset, a scenario load and a resync move the epoch; a reopened pool may point at another database |
| 5 | Whether a remembered break is ever re-checked | No, until a new chain | [SP:§7.13] "a failed verification is remembered too … so repeating the call costs nothing"; a stored row cannot be mended by an append |
| 6 | `stored.checked` when the chain does not verify | `firstBadSeq - 1` | "the sequence the stored chain has been verified through" |
| 7 | Whether `stored` includes the lineage rule LN-3 | No; a mismatch is logged | [DB:§15.4]: the answer does not carry it today |
| 8 | The order of the three parts of operation 60 | View, then stored, then lineage, one after the other | A refusal of the engine (503) costs no read; the stored check and the lineage are independent facts |
| 9 | A `FORBIDDEN` in the result of the two actions | 403 `NOT_PERMITTED`, the code of these operations | RB-5: `FORBIDDEN` stays the code of `exportEvidence` |
| 10 | Refusal reasons of `ExportResult` that the audit export never gives (`NOT_FOUND`, `NOT_SEALED`, `SECURITY_FAULT`) | A defect: 500 | They belong to the evidence export; answering them as they come would document statuses the operation does not have |

## 18. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | **The simulator's `AUDIT_EXPORTED` row counts its RING, not the chain.** `details.rows` and the message ("Audit log exported (1000 rows)") are `state.audit.rows.length`; in Live mode with more than 1,000 stored rows the row under-states what the export covers. `details.head` is right | `packages/shared/src/sim/evidence-actions.ts:290-296`; section 7.4 (answer 5,200, row 1,000) | The ANSWER is right (local adapter: sequence minus one). The stored row is the simulator's. `SIM-GAP-W39-1`: no writer is planned for the simulator; decision DN-2 |
| F-2 | **The digest check returns the first bad sequence only inside a text.** `StoredDigestVerdict` is `{ ok, reason?: string }` with `reason` such as `HASH_MISMATCH at sequence 17`; this module needs the number for `firstBadSeq` | `src/db/mapping/audit-verify.ts:19-23, 44`; `stored-chain.ts:204-206` | Read with one expression; `stored-chain.test.ts` "the format this file reads …" pins the format, so a change of it turns this row's tests red. Request to the mapping row's owner: members `seq` and `code` beside `reason` (additive) |
| F-3 | **The one stored-chain check reads only "the newest n rows".** A full verification is therefore one statement and one synchronous loop over the whole table; it cannot be done in bounded pieces without a range | `src/db/schema/boot-checks.ts:346-349`; section 6.4 | Not needed at the demo's volume (35 to 61 ms for 5,000 rows). Decision DN-1 |
| F-4 | The VIEW of operation 60 is a unit of work on the pipeline: it takes the chain lock, mirrors the operators and commits, for a read. It is not shared between concurrent calls | [EH:§4]; section 11 | The only bound on it is the throttle of stage 5. For the security review W45: a signed-in operator can hold the pipeline for one short unit per call |
| F-5 | `checkStoredChain` sends its LN-3 lookups at every pass, also at an incremental one: one statement on `audit_chain_history`, and one on `audit_log` when a lineage row exists | Section 6.3; `chain.db.test.ts` "the statements of one incremental call" | Two short statements per call; no change asked |
| F-6 | The bulk fixture changed while this row ran: its digest was `953c92ea…` (head `d2d9f9e5…`) at 16:08 and `88536632…` (head `b1a3128a…`) from 16:14 | The `[test:db] bulk fixture:` line of the two runs | Another row's change under `src/db/fixtures` (finding F68). This row's bulk tests pass on both |
| F-7 | A stored row with a wrong digest cannot be produced through the server, and one written by another writer makes the engine reload on its next unit (a diverged head, [EH:§11]). What the engine's rehydration does with a chain whose ring does not verify was not run here | Reasoning; `chain.db.test.ts` runs the stored check against such a table WITHOUT the app | Not verified by this row (section 23) |
| F-8 | The reset writes the seed history with the instants of its own clock, so a cursor on a seed row is invalid after a reset too | Section 5.6 | By design of the reset; stated for the client rows |
| F-9 | `app.db.read` turns readiness off after a failed read (a fresh probe), so the next request is answered by stage 2 | `routes.test.ts`: a test that sent two requests to one app saw the second refused before its read | Stated for rows that test a failed read: one app per failing request |

### Contract gaps (decision D84: named with the row)

**CONTRACT-GAP-W39-1** (text only). `packages/shared/src/api/operation-parts.ts:56-58`,
`INVALID_QUERY`: "… a cursor that is not one …" does not say that a cursor stops being one after a
reset. Proposed text for the description:

```
A query parameter does not match its schema (INVALID_INPUT): a value outside its set, a `limit` outside 1 to 200, a cursor that is not one of this list (also a cursor of a chain that a demo reset or a scenario load discarded: start the walk again), or text that holds U+0000 or an unpaired surrogate (API-13).
```

**CONTRACT-GAP-W39-2** (text only). `packages/shared/src/api/security-audit.ts:219-220`,
`AuditExportAcceptedSchema`: the two descriptions do not say which rows. Proposed:

```ts
rows: count().describe('Stored audit rows the export covers: every row before the AUDIT_EXPORTED row it wrote.'),
head: sha256Hex().describe('Hash of the last of those rows: the `prevHash` of the AUDIT_EXPORTED row.'),
```

The example value (`rows: 82`, the head of the example chain) already agrees with this.

**CONTRACT-GAP-W39-3** (comment only). `packages/shared/src/api/patterns.ts:85-90`,
`LIST_CURSOR_PATTERN`: "A sequence number, or a time and an identifier joined by hyphens, both
fit." Add: "So does a row's identifier with a mark of that row (`AUD-000150-9f86d081884c7d65`,
`LOG-000150-1790823600000`), the form of the audit list and of the events."

No `SCHEMA-GAP`. No change of the contract, the schema, the mapping, the core, the engine or a
plugin was needed.

## 19. Deviations from the row text

| # | Row text | What was done | Why |
|--:|---|---|---|
| DV-1 | "a call … reads exactly k audit rows" | k rows through the one row statement, and one lookup by the primary key that returns a truth value | The brief also asks that the remembered head be dropped "whenever it no longer matches the stored row at that sequence"; that needs a look at that row. Section 6.3 states the exact statements |
| DV-2 | "Decide … whether it must be bounded / streamed" | Decided: not at this volume; and it CANNOT be bounded with the one implementation | Finding F-3, decision DN-1 |
| DV-3 | Rule M5 "Reads that change nothing use `app.db.pool`" | The reads use `app.db.read(…)` | The brief's rule 7: the helper had landed (15:48) |
| DV-4 | The body of the two exports is validated in the handler, not by a route schema | As the evidence row (decision D92): the route schema would answer 422 `INVALID_INPUT` for a short reason | [SP:§7.3] lines 8 and 10 |
| DV-5 | A test-only export `securityAuditControl(app)` in `index.ts` | Counters of the stored check (calls, runs, passes, rows read) | The module has no seam of its own to carry them; the proof of "one run" needs them |

## 20. Decisions for the controller

| ID | Decision needed | Recommendation |
|---|---|---|
| DN-1 | A bounded full verification needs a range on the one stored-chain check (`checkStoredChain(pool, { fromSeq, limit })`, ascending), which is the schema row's file. Without it a full pass is one statement and one loop over the whole table | Accept as built for the demo (35 to 61 ms at 5,000 rows; once per chain). If a chain beyond some 50,000 rows is ever expected, schedule the option with the owner of `src/db/schema/boot-checks.ts`; this module then verifies in pieces without a change of its answer |
| DN-2 | `SIM-GAP-W39-1` (finding F-1): the `AUDIT_EXPORTED` row's `details.rows` and message count the ring | Accept and record as a known difference (the answer and `details.head` are right); or have the engine host correct `details.rows` when it writes the row through, which is the engine row's file |
| DN-3 | The verdict of the digest check as text (finding F-2) | Ask the mapping row's owner for the two members at the next change of that file; until then the pinned format holds |
| DN-4 | The cursor names its row, so a reset invalidates it (section 5.3, choice 1) | Accept; route CONTRACT-GAP-W39-1 to W83 and the sentence of section 12 to the client rows |
| DN-5 | The answer of an export: `rows` = the export row's sequence minus one (choice 3) | Accept; route CONTRACT-GAP-W39-2 to W83 |
| DN-6 | The view as a unit of work per call, unshared (finding F-4) | To the security review W45 with the throttle's numbers; no change here |
| DN-7 | A remembered break is not re-checked until a new chain (choice 5) | Accept: it is the specification's sentence |

## 21. End state and cleanup

At 16:39:23 (a scratch script outside the repository, as `dems_owner`, through the test helper's
own reader of the connection file; it prints names and counts; the script of the guard and evidence
rows, reused: `implementation/assets/39_end_state.mts.txt`, output `39_end_state.txt`):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_61_*): 0
test databases of all rows at this moment: 4
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

- `.locks/postgres.pid`: 19121, the process started 07:14:26, as before. PostgreSQL was never
  stopped or reconfigured. Nothing connected as the bootstrap superuser.
- `dems_demo` and the lane databases were never connected to by this row: every test ran on a
  clone of the helper (`DEMS_TEST_STEP=61`, templates `seed` and `bulk`); the further clones a
  test file asks for (`db.another`) are dropped with their file, the one that was reset with the
  reset tests' plain drop. Every `test:db` run of the row ended with "0 remain with the run prefix".
- No port was bound and no process of this row is left: the two background commands (the
  mutation run and a wait for its end) ended by themselves.
- `apps/core-server/logs/` was not written by this row: its apps have no error-log file, and a
  test that inspects the persistent error log captures the entries in memory.
- Nothing under `apps/mock-core`, `release`, `scripts/release`, `packages/shared` or any other
  module folder was written. Nothing was committed or staged.
- Scratch files (the mutation harness, the saved runner outputs) are under the session's
  scratchpad and the system's temporary directory, outside the repository. The harness's link to
  the repository's `node_modules` was removed at the end (the link, not its target). What is
  evidence is kept as text under `implementation/assets/39_*`.

## 22. Rollback (R-NEW; not executed)

The module is new code in one folder; the scaffold registers `securityAuditModule` whatever the
folder holds.

```sh
# 1. Put the stub back (the pre-image of 15:46, SHA-256 e1a3646b…ad3d):
cp .cache/rollback/W39/src/modules/security-audit/index.ts apps/core-server/src/modules/security-audit/index.ts
# 2. Remove what this row added to the folder (the user's or the controller's decision; nothing here deletes):
#    apps/core-server/src/modules/security-audit/{cursor,export-request,reads,stored-chain}.ts
#    apps/core-server/src/modules/security-audit/__tests__/
# 3. Documents: implementation/39_module_security_audit.md, implementation/assets/39_*,
#    delegation_progress/coder_execution_step_61.md
```

After step 1 and 2 the six operations answer 404 (no route), as before this row. No database
object, no migration, no contract file and no other module is touched by the rollback. Nothing was
committed.

## 23. Not done, and not verified by this row

| Item | Why |
|---|---|
| The role-by-operation matrix beyond one allowed and one refused call | The test row W47 |
| A stored break seen THROUGH the route with a running engine | Finding F-7: a row written by another writer makes the engine reload; the stored check itself was run against such tables |
| The view under a real load of concurrent GETs | Finding F-4; the security review W45 |
| A full verification beyond 5,200 rows | Section 6.4 gives the measured rate; no larger table was built |
| The demo-control module calling the reset | Another row; this row ran the routine itself with the caller's quiesce |
| The web page and the mobile screen | Client rows; section 12 is what they can rely on |
| A device session (bearer) on these six operations | The four stages are the foundation's; this row signed in on the web console only |
