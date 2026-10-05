---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 57
plan_row: W35
title: Evidence module, operations 39 to 43 (list, detail, verify, export, archive)
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§7.1, §7.2, §7.3, §7.9, §7.17, §8.2, §11, §12.3; SR-59, SR-66; AC-B-69, AC-B-70); masterplan/03_database_contract.md rev 2.2 (§4.17 to §4.20, §7.3)
evidence_tier: 3
status: complete
---

# W35: the evidence module, operations 39 to 43

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command entered a subfolder (one exception without effect: deviation DV-6). Database commands
ran with the per-command sandbox bypass (P10). Quoted runner output is unchanged except that
colour codes are removed.

**No password, token, cookie value, hash of a credential or other secret appears in this
document.** The demo password is used by the identity row's test support by its constant only. A
test takes a session cookie or a bearer value from an answer and hands it on in a header; none is
printed, and no test name holds one. The 64-digit values in section 7 are SHA-256 digests of
stored evidence rows of the synthetic seed, computed for the proof; they are not credentials.

## 1. Result

| Item | Result |
|---|---|
| Row tests, `unit` (5 files of the folder) | **Exit 0**: 5 files, 142 tests, 0 failed (15:25:42) (section 12.1) |
| Row tests, `db` (6 files, `DEMS_TEST_STEP=57`) | **Exit 0**: 6 files, 89 tests, 0 failed; forced drops that needed a retry: 0; 0 databases remain with the run prefix (15:20:27) (section 12.1) |
| Module gate MODG | The route list of the module equals registry operations 39 to 43, both printed by a test; every documented status the module can produce has a test, and every answer validates against the contract; one allowed and one refused call per operation (sections 10, 12.2) |
| **AC-B-69**: after verify, export, archive and an evidence tamper fault the tracks, track hashes, manifest hash and signature are unchanged | **Proven byte-level on the stored rows**: the SHA-256 PostgreSQL computes over the item's sealed columns and its four track rows is the same before and after each of six steps, for five dataset items (the fault on each of the four tracks) and for an item the engine sealed; no track row was rewritten at all; the digest over all 65 sealed rows of the seed, and over all 2,575 of the bulk template, did not move (section 7) |
| The denied export | 403 `FORBIDDEN` with exactly ONE `EXPORT_DENIED` row and one event, **written by the guard**; the hosted action is not reached (0 commands), the module adds no row; INVESTIGATOR and TECHNICIAN, five request shapes (section 6.2) |
| **AC-B-70**: every answer that lists audio has exactly AUDIO-01 and AUDIO-02 | Every track list of every answer is `VIDEO-01, VIDEO-02, AUDIO-01, AUDIO-02`: 13 items of the seed, all 515 of the bulk template, every detail read and every verdict (section 8) |
| The source of truth of the reads | PostgreSQL for operations 39 and 40, in one read-only snapshot; equal to the engine's committed `evidence` slice member by member on both templates: 13 of 13 and 515 of 515 (section 4) |
| The commands | Three hosted actions through `app.engine.command`, each run against PostgreSQL (engine host F-11): `verify` 11 statements, `exportEvidence` 13, `archiveEvidence` 11, one transaction each; the answer after the commit with `x-dems-epoch` and `x-dems-revision` (sections 5, 11) |
| The export's refusal in the RESULT | Answered after the unit: the row the simulator wrote is stored (the unit ends with `COMMIT`), the answer is 403 `FORBIDDEN` (section 6.3) |
| SR-66 | No route returns or takes a file; `getEvidence` answers a reference (`source`, four digits); the folder imports no file, path, stream or network module (section 9) |
| Whole `unit` project | **Exit 0**: 102 files, 2,660 tests, 0 failed (15:26:29 to 15:27:10) (section 12.3) |
| Whole `db` project (`DEMS_TEST_STEP=57`) | **Exit 0**: 75 files, 1,081 tests, 0 failed; forced drops that needed a retry: 0; 0 databases remain with the run prefix (15:22:15 to 15:24:59) (section 12.3) |
| Typecheck, lint of the workspace | Exit 0; exit 0 with no warning (15:25:5x) |
| Mutation check | **56 of 56** planted defects detected, through a transform in a scratch runner configuration: no file of the tree was changed (rule M15; section 13) |
| Other rows' tests | None edited. Three test files of the guard row were red by design once module routes existed; reported at 14:33 (rule M10), fixed by their owner under decision D85, green in the final runs (section 12.4) |
| Gaps | No `SIM-GAP`, no `SCHEMA-GAP`. `CONTRACT-GAP-W35-1` and `CONTRACT-GAP-W35-2`, both about an example or a status text (section 17) |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121. No database with this row's prefix remains (section 20) |

## 2. What was written

Only `apps/core-server/src/modules/evidence/**`, this document, its assets and the row's progress
file. `app.ts`, the contract, the schema, the migrations, the mapping, the seed, the core, the
engine, the plugins and every other module are untouched (rule M1).

### 2.1 Production code (5 files, 542 lines)

| File | Lines | What it holds |
|---|--:|---|
| `src/modules/evidence/index.ts` | 269 | The plugin `evidenceModule` (the stub of W08 replaced, its export kept): the five routes, each built from its registry entry with `routeOfOperation`; `read()` (one read on the pool, the failure recipe); `hosted()` (a thrown refusal keeps status, code and details and gets the area's wording); the export handler |
| `src/modules/evidence/reads.ts` | 137 | `readEvidencePage`, `readEvidenceItem`: the two reads, each one READ ONLY transaction at REPEATABLE READ; the filters, the keyset, the Unicode-folding search; rows to items through the one mapping module |
| `src/modules/evidence/export-request.ts` | 60 | `readExportBody`: the contract's schema, and which of the two 422 answers a failure of it is; `NO_REASON` |
| `src/modules/evidence/cursor.ts` | 44 | `encodeEvidenceCursor`, `decodeEvidenceCursor` |
| `src/modules/evidence/media.ts` | 32 | `mediaRefOf`: the shared demo-package join as an `EvidenceMediaRef` |

No dependency was added; no `package.json` was touched.

### 2.2 Tests (11 files, 231 tests) and test support

| Project | File | Tests | Lines |
|---|---|--:|--:|
| `unit` | `__tests__/cursor.test.ts` | 5 | 78 |
| `unit` | `__tests__/export-request.test.ts` | 36 | 156 |
| `unit` | `__tests__/media.test.ts` | 9 | 83 |
| `unit` | `__tests__/routes.test.ts` | 74 | 698 |
| `unit` | `__tests__/static.test.ts` | 18 | 279 |
| `db` | `__tests__/reads.db.test.ts` | 29 | 466 |
| `db` | `__tests__/commands.db.test.ts` | 33 | 869 |
| `db` | `__tests__/immutability.db.test.ts` | 8 | 310 |
| `db` | `__tests__/bulk.db.test.ts` | 14 | 336 |
| `db` | `__tests__/edge.db.test.ts` | 2 | 102 |
| `db` | `__tests__/consistency.db.test.ts` | 3 | 201 |
| support | `__tests__/support.ts` (not a test file) | | 412 |

`support.ts`: `evidenceApp` (the real app on a clone, every stage as the server has it, booted,
the engine on a manual clock and a manual timer, a counting pool); `sealSession` (a session from
create to seal through hosted commands of the engine host only); the readers of what is stored
(`sealedDigest`, `allSealedDigest`, `sealedMembers`, `trackRowVersions`, `storedCustody`,
`storedState`); `trackListsOf`.

### 2.3 Documents and assets

| Path | What |
|---|---|
| `implementation/35_module_evidence.md` | This document |
| `delegation_progress/coder_execution_step_57.md` | The row's progress file |
| `implementation/assets/35_test_unit_verbose.txt` | The row's unit tests, every test by name (15:25:42) |
| `implementation/assets/35_test_db_verbose.txt` | The row's database tests, every test by name, with the printed digests, statement lists and plans (15:20:27) |
| `implementation/assets/35_final_runs.log` | Typecheck, lint, both whole projects, the end state |
| `implementation/assets/35_mutations.json`, `35_mutations.log` | The 56 mutations and their result lines |
| `implementation/assets/35_mutation_harness.vitest.config.mjs.txt`, `35_mutation_harness.run.sh.txt` | The scratch runner configuration and its script |
| `implementation/assets/35_end_state.mts.txt` | The script of section 20 |

## 3. The operation table

Method, path, access rule and audit rule are the registry's (`packages/shared/src/api/evidence.ts`,
`core-api.ts:813-860`); the module adds nothing to them. "Recipe" is the handler recipe of the
standing rules: **hosted** (rule M4: one call of `app.engine.command`) or **read** (rule M5: a read
that changes nothing, on `app.db.pool`). No operation of this module is a server-native state
change: the module opens no unit of work of its own and appends no audit row and no event.

| # | operationId | Method and path | Access (stage 6) | Recipe | Hosted action | Audit on success | Success | Refusals the module or its hosted action can produce |
|--:|---|---|---|---|---|---|---|---|
| 39 | `listEvidence` | GET `/api/v1/evidence` | `EVIDENCE_VIEW` | read, PostgreSQL | none | none (`NONE-R`) | 200 `EvidencePage` | 422 `INVALID_INPUT` (query; a cursor that is none of this list); 503 `NOT_READY` (the database does not answer) |
| 40 | `getEvidence` | GET `/api/v1/evidence/{id}` | `EVIDENCE_VIEW` | read, PostgreSQL | none | none (`NONE-R`) | 200 `EvidenceDetail` | 404 `NOT_FOUND`; 422 `INVALID_INPUT` (path); 503 `NOT_READY` |
| 41 | `verifyEvidence` | POST `/api/v1/evidence/{id}/verify` | `EVIDENCE_VIEW` | hosted | `verify` | `EVIDENCE_VERIFIED` or `EVIDENCE_VERIFY_FAILED`, by the verdict | 200 `EvidenceVerifyResult` (also for a failed verification: `ok: false`) | 404 `NOT_FOUND`; 422 `INVALID_INPUT` (path); 503 `NOT_READY` (the unit was not committed) |
| 42 | `exportEvidence` | POST `/api/v1/evidence/{id}/export` | `EVIDENCE_EXPORT` | hosted | `exportEvidence` | `EVIDENCE_EXPORTED` | 202 `EvidenceExportAccepted` | 422 `INVALID_INPUT` (body, before the engine); then in the action's order 404 `NOT_FOUND`, 409 `NOT_SEALED`, 409 `SECURITY_FAULT`, 422 `INVALID_REASON`; 503 `NOT_READY` |
| 43 | `archiveEvidence` | POST `/api/v1/evidence/{id}/archive` | `EVIDENCE_REVIEW` | hosted | `archiveEvidence` | `EVIDENCE_ARCHIVED`; none when already archived | 204 | 404 `NOT_FOUND`; 409 `NOT_SEALED`; 422 `INVALID_INPUT` (path); 503 `NOT_READY` |

Refusals that are NOT the module's, on all five: 401 `NOT_SIGNED_IN` and 403 (`NOT_PERMITTED`;
`FORBIDDEN` for operation 42; `DEVICE_REVOKED`) from stage 6 with its one row, 403
`ORIGIN_NOT_ALLOWED` from stage 3, 429 from stage 5, 503 from stage 2, 400 `INVALID_JSON` and 413
from the body parser. The module has no check of who calls (rule M3; static test, section 10).

`verify` is one of the 23 hosted actions the simulator does not check (spec §7.17, "Rule today:
none"; engine host F-6): for operation 41 the access rule is the only check there is.

## 4. The source of truth of each read

**Operations 39 and 40 answer from PostgreSQL**, through the pool of the runtime role, in a
read-only transaction. Neither reads the engine.

### 4.1 What the sources say

| Source | Statement | Reading |
|---|---|---|
| Spec §1.1 (`01_specs.md:103`) | The server is "a PostgreSQL-backed process that becomes the single source of truth" | The tables are the truth |
| Spec §3.2, row 26 | `evidence`: class **S** (stored), written by the engine, replicated; no ring is named for it, unlike `events` (500) and `audit` (1,000) | The slice is the tables' content, whole |
| Spec §7.9 | Operations 39 and 40 "reads `evidence`" | Names the entity; API-6 gives its wire form (the slice's element schema) |
| Contract, `operation-parts.ts` `LIST_READ_NOTE`, the last paragraph of BOTH operations (`evidence.ts:165, 189`) | "the rows come from the stored tables, which may hold more than the rings a client receives on the socket" | **The list and the detail read are answered from the tables** |
| Database contract §4.17 (`03_database_contract.md:975, 979-981, 993`) | `evidence_items_pkey`: "`getEvidence` and every evidence command by ID"; `evidence_items_recorded_at_idx (recorded_at DESC, id DESC)`: "`listEvidence` with a keyset cursor"; the two filter indexes; "The free-text search `q` … is a sequential scan by design" | The list is a keyset query on the table |
| Standing rule M5 | "Reads that change nothing use `app.db.pool`" | The pool, not the pipeline |

So the source of truth of the LIST per the specification, the contract and the database contract
is the stored tables, and the same holds for the detail read.

### 4.2 Why the answer equals the engine's committed slice

| Reason | Evidence |
|---|---|
| **No ring.** A start rehydrates every item: `readStoredRows` reads `evidence_items`, `evidence_tracks` and `evidence_custody` without a limit (`src/db/seed/store.ts:222-236`); only alerts, the audit log and the events are cut (`:241, 246, 249`) | `bulk.db.test.ts` "515 items, 2,060 tracks and 1,220 custody entries are stored, and the engine rehydrated EVERY item": 515 stored, 515 in the slice, while the audit ring holds 1,000 of 5,003 rows |
| **One writer at run time.** Only the engine host's write-through writes the three tables, in the unit of the command or tick that changed the slice; the answer of a command comes after the commit, and the committed slice moves on in the same turn | Engine host §4, §5; `commands.db.test.ts` (every command: the stored rows and the slice after it) |
| **One mapping, both ways.** The engine's slice is `fromRows(...)`, the answer is `evidenceItemFromRows(...)` of the same module (`src/db/mapping/rows.ts:455`); this folder builds no item from columns (static test, rule 4) | `static.test.ts` "the row-to-item mapping is the one mapping module's" |
| **Tested on both templates**, member by member, as the JSON that travels (`toStrictEqual`) | Seed (13 items): `reads.db.test.ts` "SOURCE OF TRUTH …", after an engine-made seal "the list equals the engine's slice again (14 items)", every detail read. Bulk (515 items): `bulk.db.test.ts` "SOURCE OF TRUTH: the default page size walks all 515 stored items in 11 pages, and the walk IS the engine's committed slice", again after an export, three refusals and two archives |

The one instant at which they differ: between a `COMMIT` and the engine's synchronous settle of
it (the same turn of the event loop that resolves the command). A read that starts exactly then
is one commit AHEAD of what was published on the socket. It is never behind: when a client holds
the revision of a command's answer (API-7), the tables hold the command's effect.

### 4.3 Per operation

| # | Source | Statements | What is added to the stored item |
|--:|---|---|---|
| 39 | PostgreSQL: `evidence_items` filtered and ordered `recorded_at DESC, id DESC`, `limit + 1` rows; then the tracks and the custody entries of the page's items | 5 (`begin isolation level repeatable read read only`, items, tracks, custody, `commit`); 3 for an empty page | Nothing: `items` are the stored items; `nextCursor` is the position of the last item when one more row was read |
| 40 | PostgreSQL: the item by primary key, its tracks, its custody entries | 5; 3 for an unknown ID | `media`: the shared join `matchDemoPackage` over four stored columns (section 9) |

**One snapshot.** The three statements of a read run in ONE transaction, READ ONLY at REPEATABLE
READ, so an item is as one commit left it. `consistency.db.test.ts` holds a read back between
its statements while a verification (and, for the list, an export) of the same item commits:
the answer is the whole item of BEFORE (verification `NOT_RUN` and no `VERIFIED` entry; `SEALED`
and no `EXPORTED` entry), and a read that starts afterwards sees all of it.

### 4.4 The list in detail

| Item | Rule | Test |
|---|---|---|
| Order | "newest recording first": `recorded_at DESC, id DESC`, a total order (the ID breaks a tie) | `edge.db.test.ts` (four items with one instant, page sizes 1 to 13); `bulk.db.test.ts` "the order of the list is total" |
| Cursor | The position of the last item of a page, `<recorded_at>-<evidence ID>` (for example `1790823600000-EV-20260930-0004`): 33 characters at most, letters, digits and hyphens, so it fits `LIST_CURSOR_PATTERN` and can never have the form of a bearer value. It holds nothing the page did not give, and no server state. The next page is `(recorded_at, id) < (cursor)`, a row comparison that the index answers | `cursor.test.ts` (5); `bulk.db.test.ts` "the keyset is answered through the index of the order" (the plan is quoted in section 11) |
| A cursor that is none of this list | 422 `INVALID_INPUT`, `details.in: querystring`, before any read (the contract: "a cursor that is not one") | `routes.test.ts`, 6 values that pass the contract's pattern |
| Page size | `limit` 1 to 200; 50 when omitted (`API_PAGE_LIMIT_DEFAULT`) | Seed: every limit from 1 to 14. Bulk: 50 (11 pages), 200 (200, 200, 115), 1, 7, 64, 199 |
| Stability | A walk never repeats or skips an item: an item sealed while a client walks is newer than every position and lands before page 1 | `reads.db.test.ts` "a session sealed between two pages does not shift the walk" |
| `status`, `caseType` | Equality on the indexed columns; both together narrow both | Seed and bulk, every value of both vocabularies, against the engine's slice and against `count(*)` |
| `q` | Matched "without regard to case" against the evidence ID, the session ID, the case number and the subject name; trimmed by the contract's schema. Both sides are folded with `casefold(… COLLATE "pg_unicode_fast")` and compared with `strpos`: the text is never a pattern | Seed: each of the four columns in both cases, parts, `%`, `_`, a backslash and two injection texts (0 hits each). Bulk: the fixture's Unicode sample in upper case, its CJK part and each of its two astral characters (14 items each) |

**Why not `ILIKE`.** The cluster's locale is `C` (database contract TY-9, PG-20): `lower()` and
`ILIKE` fold ASCII letters only. Measured on this cluster (PostgreSQL 18.4, a probe at 14:33):
`'É' ILIKE 'é'` is false; `casefold('ÉCOLE Straße' COLLATE "pg_unicode_fast")` is `école strasse`.
`pg_unicode_fast` is a built-in collation of PostgreSQL 18 (no extension, DA-06). With the plain
`lower()` the search for `ÜNÏCØDÉ` finds none of the 14 fixture subjects (mutation M21).

## 5. The handler recipe per operation

```ts
// 39, 40: a read (rule M5)
const page = await read(request, 'listEvidence', (pool) => readEvidencePage(pool, { status, caseType, search: q, after, limit: limit ?? API_PAGE_LIMIT_DEFAULT }));
return { items: page.items, nextCursor: page.next === null ? null : encodeEvidenceCursor(page.next) };

// 41, 43: a hosted action that refuses by throwing (rule M4)
const outcome = await hosted(() => app.engine.command(request.principal, 'verify', request.params.id));
withStatePosition(reply, outcome);          // x-dems-epoch, x-dems-revision of the outcome
return outcome.value;

// 42: a hosted action that refuses IN ITS RESULT (rule M4)
const body = readExportBody(request.body);                       // the contract's schema
if (body.kind === 'INVALID') throw invalidInput('body');         // spec §7.3 line 8
if (!exportIdPattern.test(evidenceId)) throw exportRefused({ ok: false, status: 404, reason: 'NOT_FOUND' });
const outcome = await app.engine.command(request.principal, 'exportEvidence', evidenceId, body.kind === 'VALID' ? body.request : NO_REASON);
const result = outcome.value;               // the unit has ended
if (!result.ok) throw exportRefused(result);                     // answered only now
withStatePosition(reply, outcome);
void reply.code(202);
return { exportId: result.exportId, evidenceId, status: 'EXPORTED' };
```

| Point | How |
|---|---|
| The actor | `request.principal`, handed on as the object stage 4 set (`routes.test.ts` asserts identity with `toBe`). Nothing of a body is an actor, a time or an ID (`commands.db.test.ts` "SR-65 …") |
| A refusal the simulator THROWS (`SimNotFoundError`, `SimTransitionError`) | Arrives as the engine host's `ApiFailure` with `details.simCode` (and `from`, `event`). `hosted()` lets it pass with the wording the contract's examples show: "Evidence not found.", "Unsealed evidence cannot be archived." Status, code and details stay the host's (`simRefusal(error.cause, text)`) |
| A refusal IN THE RESULT (the export) | Taken out of `command` as a value; the `ApiFailure` is thrown after it resolved, so a row the action wrote is committed (section 6.3) |
| Everything else `command` rejects with | Passes unchanged: 503 `NOT_READY` for a unit that was not run or committed, 500 for an unexpected failure |
| A read that fails | `read()`: one error line `{ code, operationId }` with the DRIVER's code (`driverErrorOf`), one entry in the persistent error log, a fresh readiness probe, 503 `NOT_READY`. No error object reaches the logger at all (rule M14). A row the one mapping refuses (`MappingError`) is not a database failure: it stays an unexpected failure, 500, reported by the envelope (`edge.db.test.ts`) |
| Path parameter | Operations 40, 41, 43: a zod object built from the registry's own `pathParam.pattern`; a mismatch is 422 `INVALID_INPUT`, `details.in: params`, at the schema stage. Operation 42 (the design-book operation, which documents no 422 for its path): an ID of another form answers 404, as in Simulated mode, without a unit |
| Response schemas | The contract's, on every success with a body (`EvidencePage`, `EvidenceDetail`, `EvidenceVerifyResult`, `EvidenceExportAccepted`): an answer outside the schema never leaves the server (500; `routes.test.ts` "a verdict that is not the contract's shape …") |

## 6. The export: two 422 answers, the denied export, the refusal in the result

### 6.1 Where a body is refused

The specification gives `exportEvidence` two 422 answers at two places of the precedence table
(§7.3): line 8 "422 `INVALID_INPUT` (schema)", and line 10 "404 resource, then 409, then 422
business validation, in the order the hosted action checks them (for `exportEvidence`: 404, 409,
422)". The Live source maps a 404 to `NOT_FOUND` and a 409 to `NOT_SEALED` or `SECURITY_FAULT`
(`packages/shared/src/live/source/bindings.ts:222-238`), so the order is visible to a client.

`export-request.ts` reads the body with the contract's `EvidenceExportRequestSchema`, unchanged,
and sorts the outcome:

| Body | Outcome | Answer |
|---|---|---|
| The schema accepts it | `VALID`: the reason as the schema trimmed it, the destination as sent (absent: the empty text, so the action names its default "Case file transfer (simulated)") | The action decides: 202, or 404, 409, 409 |
| The ONLY fault is the reason's lower bound: the reason is absent, or text of fewer than 5 characters after trimming | `REASON_MISSING`: the action is handed `NO_REASON` (`{ reason: '', destination: '' }`), never the text | The action decides in its own order: 404, then 409 `NOT_SEALED`, then 409 `SECURITY_FAULT`, then 422 `INVALID_REASON`. It changes nothing |
| Anything else: a reason that is not text, or longer than 500 code units, or holds U+0000 or an unpaired surrogate; a destination that is not text or longer than 120; both a short reason and a bad destination | `INVALID` | 422 `INVALID_INPUT`, `details.in: body`, before the engine, also for an unknown item |

Why `NO_REASON` and not the caller's text: the contract counts CHARACTERS and the simulator code
UNITS. A reason of three two-unit characters is too short for the contract (3) and long enough
for the simulator (6): handed on, the action would export with a reason the contract refuses
(`export-request.test.ts` "why the text itself is not handed on …" runs the real action both
ways). With the empty reason the action cannot accept, and no refused text reaches the engine.

### 6.2 The denied export (RB-5; decision D83 DN-4)

A caller without `EVIDENCE_EXPORT` is refused by the GUARD, before the body is read: 403
`FORBIDDEN` and exactly one `EXPORT_DENIED` row with its event. The module writes no denial row,
and the hosted action is not reached.

`commands.db.test.ts`, block "the denied export …", for the INVESTIGATOR and for the TECHNICIAN,
through the real stages:

| Asserted | Value |
|---|---|
| Answer | 403 `FORBIDDEN`, "Your role cannot export evidence (RBAC). The attempt was audited.", `details: { operationId: 'exportEvidence', permission: 'EVIDENCE_EXPORT', role }`; valid against the contract |
| Rows the call added to the trail | **Exactly 1**: `EXPORT_DENIED`, WARNING, the caller as actor, the evidence ID of the path, `details: { operationId, permission, role, eventKind: 'UNAUTHORIZED_EXPORT' }` |
| Whose row it is | The guard's: it names `operationId` and `permission`, which the simulator's own denial row does not |
| Events | Exactly 1: `EXPORT_DENIED` |
| Hosted commands run | **0** (`engine.stats().commands` unchanged): the module and the simulator added nothing |
| Units of work | 1: the guard's `rbac.denied` |
| The item | Sealed digest, custody chain, the six mutable columns and the count of `exports`: all unchanged |
| A broken body, no body, a short reason, an unknown item, an unsealed item | The same 403 with one row each: decided before the body and the item are looked at |

### 6.3 A refusal in the result is answered after the unit

The engine mirrors the operators table before every action (ENG-3), so the action sees the role
that is stored NOW. If an operator's role is changed between stage 4 of a request and its unit,
stage 6 has let the request through and the action reports `{ ok: false, status: 403, reason:
'FORBIDDEN' }` in its result, having written its own `EXPORT_DENIED` row.

`commands.db.test.ts`, block "a refusal the simulator reports IN ITS RESULT …": stage 4 is a
stand-in that gives the seeded INVESTIGATOR the permissions of a SUPERVISOR (the state of such a
request). Result: 403 `FORBIDDEN`; the hosted command ran (1) and its unit was COMMITTED (the last
statement is `COMMIT`); the trail holds exactly one `EXPORT_DENIED` row, the simulator's (it has
`role` and `eventKind` and no `operationId`), with its event; no export record, no custody entry,
the sealed digest unchanged. Had the handler thrown inside a unit, that row would have been rolled
back; it cannot, because it owns no unit.

## 7. The immutability proof (AC-B-69, SR-59, I11)

**Claim.** After a verification, an export, an archive and an evidence tamper fault, the tracks,
the track hashes, the manifest hash and the signature of the item are unchanged.

**What is compared, and how** (`immutability.db.test.ts`; helpers in `__tests__/support.ts`).
Before the first step and after EVERY step, as `dems_owner`:

| # | Comparison | Form |
|--:|---|---|
| 1 | **Byte-level digest of the stored rows.** PostgreSQL computes `sha256` over the item's row WITHOUT its seven columns the runtime role may update (`status`, `lifecycle_stage`, `verification_status`, `verification_at`, `tampered`, `tampered_track_id`, `updated_at`) and its four track rows whole, each row as `to_jsonb(row)::text`, joined in a fixed order. What is covered: the manifest hash, the four signature columns, the recording instants, the size, the descriptive columns, and of every track its ID, position, label, size and SHA-256 | `sealedDigest()`: 5 rows, one 64-digit value |
| 2 | The sealed members one by one: manifest hash; signature value, key ID, algorithm, simulated flag; per track ID, position, label, size, hash | `sealedMembers()` |
| 3 | The row VERSION of each track row (`xmin`, `ctid`): equal versions mean no statement rewrote the row at all, not even with equal values | `trackRowVersions()` |
| 4 | The same digest over every OTHER item and track of the database | `othersDigest()` |
| 5 | The sealed members as `getEvidence` answers them, and as the engine's committed slice holds them | equal to 2 |
| 6 | What DID change: only `status`, the verification state and the tamper flag, as the step implies; the custody chain only grew (the entries of before are byte-equal, at most one is added) | `storedState()`, `storedCustody()` |

The verification, the export and the archive go through the module's routes. The tamper fault is
injected through the ENGINE HOST, `app.engine.command(principal, 'inject', 'TAMPER', { evidenceId,
trackId })`, and cleared the same way: no route of the demo-control module is used.

### 7.1 The digests (run of 15:20:27; `implementation/assets/35_test_db_verbose.txt`)

A dataset item (`integritySource: DEMO_PACKAGE`), the fault on AUDIO-02, the test "a dataset item
(hashes of its demo package): six steps, one digest":

```
[w35] AC-B-69 EV-20260929-0001 (DEMO_PACKAGE): SHA-256 of the stored sealed rows (item row without its 7 mutable columns + 4 track rows)
[w35]   before                                  b9e5fc5eb5f170f7be9a84cd8b78494e444ddfbe79849cdbcef4b9915c313346  rows 5
[w35]   after verify (every hash matches)       b9e5fc5eb5f170f7be9a84cd8b78494e444ddfbe79849cdbcef4b9915c313346  equal; status SEALED, verification PASS, tampered false, custody 3
[w35]   after evidence TAMPER fault (AUDIO-02)  b9e5fc5eb5f170f7be9a84cd8b78494e444ddfbe79849cdbcef4b9915c313346  equal; status SEALED, verification NOT_RUN, tampered true, custody 3
[w35]   after verify (fails on the track)       b9e5fc5eb5f170f7be9a84cd8b78494e444ddfbe79849cdbcef4b9915c313346  equal; status SEALED, verification FAIL, tampered true, custody 4
[w35]   after the fault cleared                 b9e5fc5eb5f170f7be9a84cd8b78494e444ddfbe79849cdbcef4b9915c313346  equal; status SEALED, verification NOT_RUN, tampered false, custody 4
[w35]   after export                            b9e5fc5eb5f170f7be9a84cd8b78494e444ddfbe79849cdbcef4b9915c313346  equal; status EXPORTED, verification NOT_RUN, tampered false, custody 5
[w35]   after archive                           b9e5fc5eb5f170f7be9a84cd8b78494e444ddfbe79849cdbcef4b9915c313346  equal; status ARCHIVED, verification NOT_RUN, tampered false, custody 6
[w35] AC-B-69 all 65 sealed rows of the database (13 items, 52 tracks): 52811c3067b7655cde7912c06fe0e66dd4b70b15269a7f3a6b9b6c4884cc8c37 before and after
```

The six steps wrote exactly six audit rows, in this order: `EVIDENCE_VERIFIED`, `FAULT_RAISED`,
`EVIDENCE_VERIFY_FAILED`, `FAULT_CLEARED`, `EVIDENCE_EXPORTED`, `EVIDENCE_ARCHIVED`.

An item the ENGINE sealed (a session recorded through hosted commands; `integritySource:
SIMULATED`), the same six steps:

```
[w35] AC-B-69 EV-20261001-0014 (SIMULATED): SHA-256 of the stored sealed rows (item row without its 7 mutable columns + 4 track rows)
[w35]   before                                  697d5a50422eb0c5255cf22f626dbf5e4ab1f277788dd18aedb0d02ad6450928  rows 5
[w35]   after verify (every hash matches)       697d5a50422eb0c5255cf22f626dbf5e4ab1f277788dd18aedb0d02ad6450928  equal; status SEALED, verification PASS, tampered false, custody 4
[w35]   after evidence TAMPER fault (AUDIO-02)  697d5a50422eb0c5255cf22f626dbf5e4ab1f277788dd18aedb0d02ad6450928  equal; status SEALED, verification NOT_RUN, tampered true, custody 4
[w35]   after verify (fails on the track)       697d5a50422eb0c5255cf22f626dbf5e4ab1f277788dd18aedb0d02ad6450928  equal; status SEALED, verification FAIL, tampered true, custody 5
[w35]   after the fault cleared                 697d5a50422eb0c5255cf22f626dbf5e4ab1f277788dd18aedb0d02ad6450928  equal; status SEALED, verification NOT_RUN, tampered false, custody 5
[w35]   after export                            697d5a50422eb0c5255cf22f626dbf5e4ab1f277788dd18aedb0d02ad6450928  equal; status EXPORTED, verification NOT_RUN, tampered false, custody 6
[w35]   after archive                           697d5a50422eb0c5255cf22f626dbf5e4ab1f277788dd18aedb0d02ad6450928  equal; status ARCHIVED, verification NOT_RUN, tampered false, custody 7
```

The fault on each of the four tracks, four more dataset items, the same six steps each (first and
last line of each; all lines are in the asset):

| Item | Track of the fault | Digest before | Digest after the sixth step |
|---|---|---|---|
| `EV-20261001-0007` | VIDEO-01 | `0327a1b3b4e60dc3b009781dac85f951bdf27602f6af17ac93ed1f71cb84ffe8` | equal |
| `EV-20261001-0009` | VIDEO-02 | `bcc6baca261b0510f9a31ca56ef50b1c766603623258870e46c1ab38c4a87d77` | equal |
| `EV-20261001-0011` | AUDIO-01 | `8e44ebd7b2c7442b006f64e3ad1eface315e694965a851fda7fbcef40c01fb65` | equal |
| `EV-20261001-0013` | AUDIO-02 | `b52eecb898cb76ccbae64b1b0d7d8fd5054342c70cb3750f3caff3f59714ea64` | equal |

The bulk template (`bulk.db.test.ts`): an export, three refused commands and two archives on
fixture items, and a verification of a tampered and of a clean fixture item:

```
[w35] bulk: SHA-256 of all 2575 sealed rows (515 items, 2,060 tracks) ff908eee2738ff7d1248b949572e18ae3960053378ed8ab7d159e38516ad1c22 before and after an export, three refusals and two archives
```

### 7.2 What each step changed, and why nothing sealed can move

| Step | Changed (the columns the runtime role may update, and custody) | Sealed rows |
|---|---|---|
| verify | `verification_status`, `verification_at`; one custody entry `VERIFIED` or `VERIFY_FAILED` | equal |
| evidence tamper fault | `tampered`, `tampered_track_id`; the verification goes back to `NOT_RUN` (finding F-4); no custody entry | equal |
| clearing the fault | the same three columns back | equal |
| export | `status`, `lifecycle_stage`; one custody entry `EXPORTED`; one row in `exports` | equal |
| archive | `status`, `lifecycle_stage`; one custody entry `ARCHIVED` | equal |

Three independent reasons, each tested:

1. **The module names no sealed column and no track.** It hands the engine an ID; `static.test.ts`
   ("the row-to-item mapping is the one mapping module's …", "the folder changes no row").
2. **The write-through writes only what changed.** The `UPDATE` of `evidence_items` a command
   sends names the changed columns; no statement of a command touches `evidence_tracks`
   (`commands.db.test.ts`, the statement lists of section 11).
3. **The runtime role may not.** As `dems_app`, an `UPDATE` of `evidence_tracks.sha256`, of
   `manifest_hash` or of `signature_value`, a `DELETE` of a track or a custody entry and an
   `UPDATE` of a custody entry are refused with SQLSTATE `42501` (`immutability.db.test.ts`, "why
   nothing sealed can move …"; database contract §7.3).

The dataset's own tampered item (`EV-…-0005`, altered after sealing by the dataset) keeps its
sealed AUDIO-02 hash through a failed verification and an archive: its verdict's `expected` is
the sealed hash and `actual` differs ("the dataset's own tampered item …").

## 8. Two audio tracks in every answer (AC-B-70)

Every answer of the module that lists tracks lists exactly `VIDEO-01`, `VIDEO-02`, `AUDIO-01` and
`AUDIO-02`, in that order, the two audio tracks as two entries with their own hashes. The module
never merges, reorders or drops a track: an item's `tracks` are the four stored rows by
`position`, and a verdict's `tracks` are what the hosted `verify` returns.

| Answer | Test | Asserted |
|---|---|---|
| `listEvidence`, seed | `reads.db.test.ts` "AC-B-70: every item lists exactly four tracks …" | 13 track lists, each the four IDs; per item the two audio hashes differ and the four hashes are distinct |
| `listEvidence`, bulk | `bulk.db.test.ts` "AC-B-70: all 515 items …" | 515 track lists, each the four IDs; two separate audio tracks per item |
| `getEvidence` | `reads.db.test.ts` "answers each of the 13 items …"; `bulk.db.test.ts` "MS-2 …" (27 items) | one list per answer, the four IDs |
| `verifyEvidence` | `commands.db.test.ts` "a sealed item verifies …" and "the dataset's tampered item fails …"; `bulk.db.test.ts`; `immutability.db.test.ts` | one result per track, the four IDs; a failure names exactly its track |
| An item the engine sealed | `reads.db.test.ts` "the new item is the newest …" | the four IDs |
| The helper | `trackListsOf(body)` walks an answer and returns every `tracks` list it holds | |

## 9. No file, no path (SR-66; MS-1 to MS-4)

| Rule | How it is kept | Test |
|---|---|---|
| The server serves no media and no package file | The module has five routes, all JSON or empty; none has `media`, `file`, `download`, `upload` or `package` in its path | `routes.test.ts` "the area of the registry is these five …"; `static.test.ts` rule 5 (every route comes from the registry) |
| No value of a request is used as a path | The folder imports no file, path, process, stream or network module and calls no `fetch`; the import list of the folder is pinned | `static.test.ts` rule 7 |
| `getEvidence` answers a reference | `EvidenceMediaRef`: `source` and `packageSuffix`. The source and the suffix go together; the suffix is the package's own join key, the four digits `demoIdSuffix` reads from the evidence ID | `media.test.ts` (9 tests); `reads.db.test.ts` "SR-66, MS-3 …" |
| The server decides which bundled media belongs to an item (MS-2) | The shared join `matchDemoPackage` of `@dems/shared/demo-data` over four STORED columns (evidence suffix, session suffix, case sequence, subject name); nothing of the request enters it | Seed: all 13 dataset items `DEMO_PACKAGE`. Bulk: exactly those 13 of 515, and the fixture's item numbered `0014` answers `NONE`. A session the engine sealed (it takes number `0014` on the seed day, the number of the recording scenario's package): `NONE` |
| A malformed or hostile ID | 422 at the schema stage (40, 41, 43) or 404 without a unit (42); never sent to the database, never in a log line | `routes.test.ts` (`..%2F..%2Fetc%2Fpasswd`, `%00`, a marker text); `reads.db.test.ts` |

## 10. Status table per operation, with the test of each

`U` = `routes.test.ts` (in-process, stub engine); `R` = `reads.db.test.ts`; `C` =
`commands.db.test.ts`; `B` = `bulk.db.test.ts`; `E` = `edge.db.test.ts`. Every listed answer is
checked with `validateCoreApiResponse` in at least one of the named tests. One allowed and one
refused call per operation is in the rows 200/202/204 and 401/403.

| # | Status and code | Produced by | Test |
|--:|---|---|---|
| 39 | 200 | the read | R "answers the 13 stored items …", B (515 items) |
| 39 | 401 `NOT_SIGNED_IN` | stage 6 | U "listEvidence: nobody, and a paired device …"; R "nobody without a session …" |
| 39 | 403 `NOT_PERMITTED` | stage 6, one `ACCESS_DENIED` row | C "with the grant of EVIDENCE_VIEW taken away in the clone …" |
| 39 | 422 `INVALID_INPUT` (query) | schema stage; the handler for a foreign cursor | U: 16 queries, 6 cursors, and a value of the form of a bearer token |
| 39 | 500 `INTERNAL_ERROR` | a row the mapping refuses | E "a stored row the mapping refuses" |
| 39 | 503 `NOT_READY` | a database that does not answer | U "operations 39 and 40: a database that does not answer"; R "a read while the database fails" (2) |
| 40 | 200 | the read | R "answers each of the 13 items …"; B |
| 40 | 401, 403 | stage 6 | U; R; C (as 39) |
| 40 | 404 `NOT_FOUND` | the module | R "an unknown ID answers 404 …" |
| 40 | 422 `INVALID_INPUT` (path) | schema stage | U "the path parameter of operations 40, 41 and 43"; R "an ID that is no evidence ID …" |
| 40 | 503 `NOT_READY` | as 39 | U |
| 41 | 200, verdict passed | hosted `verify` | C "a sealed item verifies …"; U |
| 41 | 200, verdict failed | hosted `verify` | C "the dataset's tampered item fails …"; B; U |
| 41 | 401, 403 | stage 6 | U; C "nobody without a session verifies"; C (the grant) |
| 41 | 404 `NOT_FOUND` | the action throws | C "an unknown item …"; U |
| 41 | 422 `INVALID_INPUT` (path) | schema stage | C; U |
| 41 | 503 `NOT_READY` | a unit that was not committed | C "ENG-5 …"; U |
| 42 | 202 | hosted `exportEvidence` | C "the SUPERVISOR exports a sealed item …" and three more; B; U |
| 42 | 400 `INVALID_JSON`, 413 | the body parser | U "a body that is not a JSON object …" |
| 42 | 401 | stage 6 | U; C "nobody without a session exports" |
| 42 | 403 `FORBIDDEN` | stage 6, one `EXPORT_DENIED` row | C "the denied export …" (INVESTIGATOR, TECHNICIAN, five request shapes) |
| 42 | 403 `FORBIDDEN` | the action's result (a role changed mid-request) | C "a refusal the simulator reports IN ITS RESULT …"; U |
| 42 | 404 `NOT_FOUND` | the action's result; the module for an ID of another form | C "line 10 of the precedence table …", "an ID that is no evidence ID …"; U |
| 42 | 409 `NOT_SEALED` | the action's result | C (a RECORDED item; an ARCHIVED item); B |
| 42 | 409 `SECURITY_FAULT` | the action's result | C (a `SECURITY_FAULT` raised through the engine host) |
| 42 | 422 `INVALID_REASON` | the action's result | C (short, blank, absent); U |
| 42 | 422 `INVALID_INPUT` (body) | the module, before the engine | C "line 8 before line 10 …"; U (7 bodies × 3 IDs) |
| 42 | 503 `NOT_READY` | a unit that was not committed | U |
| 43 | 204 | hosted `archiveEvidence` | C "the SUPERVISOR archives a sealed item …", "an item that is already archived …", "an EXPORTED and an UNDER_REVIEW item …"; B; U |
| 43 | 401 | stage 6 | U |
| 43 | 403 `NOT_PERMITTED` | stage 6, one `ACCESS_DENIED` row | C "INVESTIGATOR / TECHNICIAN lacks EVIDENCE_REVIEW …" |
| 43 | 404 `NOT_FOUND` | the action throws | C; U |
| 43 | 409 `NOT_SEALED` | the action throws (`UNSEALED_EVIDENCE`) | C "an item that was never sealed …"; B; U |
| 43 | 422 `INVALID_INPUT` (path) | schema stage | C; U |
| all | 503 `NOT_READY` at stage 2 | the engine is stopped | C "while the engine is not running" |

## 11. Measured round trips

Counted by the counting pool of the engine row's test support on the connection each request
checked out (run of 15:20:27; in-process, PostgreSQL 18.4 on this host, other rows running).
Stage 4's look-up of the session goes through `pool.query` and is not part of these counts.

| Operation | Statements | Transaction |
|---|--:|---|
| 39 `listEvidence`, a page with items | 5 | `begin isolation level repeatable read read only`, items, tracks, custody, `commit` |
| 39, an empty page | 3 | begin, items, commit |
| 40 `getEvidence` | 5 | begin, item, tracks, custody, commit |
| 40, an unknown ID | 3 | begin, item, commit |
| 41 `verifyEvidence` | 11 | one unit of work |
| 42 `exportEvidence`, accepted | 13 | one unit of work |
| 42, refused in the result (404, 409, 422, and the 403 of section 6.3) | not counted one by one | one unit that ends with `COMMIT` (asserted for the 403); when nothing is written it is the unit of the next line but one |
| 43 `archiveEvidence` | 11 | one unit of work |
| 43, an item that is already archived | 5 | none of them a write |
| 41, 43 refused by a thrown error (404, 409) | not counted | the unit ends with `ROLLBACK` (asserted) |
| A walk of all 515 items in pages of 200 | 15 | 52 ms in-process, read, mapped, validated by the response schema and serialised |

One command, statement by statement (`verifyEvidence`):

```
[w35] verifyEvidence: 11 statements on one connection, one transaction:
[w35]    1 BEGIN ISOLATION LEVEL READ COMMITTED
[w35]    2 SELECT seq, hash FROM public.audit_chain_lock()
[w35]    3 SELECT set_config('statement_timeout', $1, true)
[w35]    4 select "id", "username", "rank", "name", "display_name", "initia
[w35]    5 insert into "audit_log" ("seq", "id", "at", "type", "category", 
[w35]    6 insert into "events" ("seq", "id", "at", "type", "category", "se
[w35]    7 UPDATE public.engine_counters SET next_value = GREATEST(next_val
[w35]    8 update "engine_counters" set "next_value" = $1 where "engine_cou
[w35]    9 update "evidence_items" set "verification_status" = $1, "verific
[w35]   10 insert into "evidence_custody" ("evidence_id", "seq", "at", "act
[w35]   11 COMMIT
```

`exportEvidence` adds the export counter's row on the first export of a database and the export
record:

```
[w35] exportEvidence: 13 statements on one connection, one transaction:
[w35]    1 BEGIN ISOLATION LEVEL READ COMMITTED
[w35]    2 SELECT seq, hash FROM public.audit_chain_lock()
[w35]    3 SELECT set_config('statement_timeout', $1, true)
[w35]    4 select "id", "username", "rank", "name", "display_name", "initia
[w35]    5 insert into "audit_log" ("seq", "id", "at", "type", "category", 
[w35]    6 insert into "events" ("seq", "id", "at", "type", "category", "se
[w35]    7 UPDATE public.engine_counters SET next_value = GREATEST(next_val
[w35]    8 update "engine_counters" set "next_value" = $1 where "engine_cou
[w35]    9 insert into "engine_counters" ("name", "next_value") values ($1,
[w35]   10 update "evidence_items" set "status" = $1, "lifecycle_stage" = $
[w35]   11 insert into "evidence_custody" ("evidence_id", "seq", "at", "act
[w35]   12 insert into "exports" ("id", "scope", "evidence_id", "operator_i
[w35]   13 COMMIT
```

`archiveEvidence` is the 11 statements of the verification with `"status"` and
`"lifecycle_stage"` in the item's `UPDATE`. In none of the three does a statement name
`evidence_tracks` or a sealed column (asserted).

The keyset page is answered through the index of the order (the bulk template; sequential scan
and sort priced out, so that the plan shows what the index CAN do, not what the planner prefers
at 515 rows):

```
[w35] bulk: plan of the keyset page
[w35]   Limit
[w35]     ->  Index Only Scan using evidence_items_recorded_at_idx on evidence_items
[w35]           Index Cond: (ROW(recorded_at, id) < ROW('1788163524000'::bigint, 'EV-20260831-0278'::text))
```

## 12. Verification

### 12.1 The row commands

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/evidence        (15:25:42, exit 0)

 Test Files  5 passed (5)
      Tests  142 passed (142)
   Start at  15:25:42
   Duration  2.84s (transform 47%, import 40%, tests 13%)
```

```
$ DEMS_TEST_STEP=57 npm run test:db -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/evidence        (15:20:27, exit 0)

[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_57_tmdj634c_
[test:db] stale sweep: dropped 0; kept 20 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_57_tmdj634c_tpl_schema: built in 332 ms (create 95 ms, hook 132 ms)
[test:db] template dems_test_step_57_tmdj634c_tpl_seed: built in 322 ms (create 137 ms, hook 182 ms)
[test:db] bulk fixture: dems_test_step_57_tmdj634c_tpl_bulk as dems_owner; clock 2026-10-01T03:00:00.000Z; seed 20261004
 …
 Test Files  6 passed (6)
      Tests  89 passed (89)
   Start at  15:20:27
   Duration  12.88s (tests 71%, import 18%, transform 10%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 199 ms; 0 remain with the run prefix dems_test_step_57_tmdj634c_
```

Every test by name: `implementation/assets/35_test_unit_verbose.txt` (142 pass marks) and
`35_test_db_verbose.txt` (89 pass marks). The one edit after 15:20:27 was in a unit test file
(a token-shaped value taken out of a test NAME); no database test file changed after its run.

### 12.2 The module gate (MODG)

Route list of the module against the registry, as the test prints both (`routes.test.ts`, "registers
operations 39 to 43 …"):

```
[w35] MODG routes of src/modules/evidence: GET /api/v1/evidence listEvidence | GET /api/v1/evidence/:id getEvidence | POST /api/v1/evidence/:id/verify verifyEvidence | POST /api/v1/evidence/:id/export exportEvidence | POST /api/v1/evidence/:id/archive archiveEvidence
[w35] MODG registry, operations 39 to 43:   GET /api/v1/evidence listEvidence | GET /api/v1/evidence/:id getEvidence | POST /api/v1/evidence/:id/verify verifyEvidence | POST /api/v1/evidence/:id/export exportEvidence | POST /api/v1/evidence/:id/archive archiveEvidence
```

| Gate item | Met by |
|---|---|
| The route list equals the module's registry operations | The two lines above, compared with `toEqual`; "the area of the registry is these five and no other"; each route, called with an ID, is matched by `matchCoreApiOperation` to the operation it names |
| Every documented status the module can produce has a test, and every answer validates against the contract | Section 10; `validateCoreApiResponse` on 200, 202, 204, 400, 401, 403, 404, 409, 422 and 503 of the operations that document or can send them |
| One allowed and one refused call per operation | Allowed: 200 / 200 / 200 / 202 / 204. Refused: 401 on all five; 403 on all five (39, 40, 41 with the stored grant taken away; 42 `FORBIDDEN`; 43 `NOT_PERMITTED`), each with exactly one row of the guard |
| Routes from the registry, schemas from the contract (rule M2) | `static.test.ts` rule 5; the response schemas of section 5 |
| No check of who calls and no denial row in the module (rule M3) | `static.test.ts` rules 1 and 2; `routes.test.ts` "no route carries a check of its own" |
| Hosted actions through `app.engine.command`, answered after it resolves (rule M4) | `static.test.ts` rule 3; sections 5, 6.3 |
| Tests on the helper's clones, a running engine on a manual timer, counts relative to the state after the boot (rule M9) | `support.ts` `evidenceApp`; `DEMS_TEST_STEP=57`; templates `seed` and `bulk`; no `dems_demo`, no lane |
| No assertion on what other rows change (rule M10) | The route test filters by the path prefix of this module; nothing pins the total of routes, the stubs or the boot steps |
| `typecheck` and `lint` exit 0 without a warning | Section 12.3 |
| A mutation check of the module's own logic | Section 13 |

### 12.3 Whole projects, typecheck, lint (final state)

```
$ npm run typecheck -w @dems/core-server                         (15:25:5x)   exit 0
$ npm run lint -w @dems/core-server                              (15:25:4x)   exit 0, no warning

$ DEMS_TEST_STEP=57 npm run test:db -w @dems/core-server -- --maxWorkers=2      (15:22:15 to 15:24:59, exit 0)
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_57_tmdj93ug_
[test:db] stale sweep: dropped 0; kept 14 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 …
 Test Files  75 passed (75)
      Tests  1081 passed (1081)
   Start at  15:22:15
   Duration  163.30s (tests 85%, import 14%, transform 1%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 315 ms; 0 remain with the run prefix dems_test_step_57_tmdj93ug_

$ npm run test -w @dems/core-server -- --maxWorkers=2                           (15:26:29 to 15:27:10, exit 0)
 Test Files  102 passed (102)
      Tests  2660 passed (2660)
   Start at  15:26:29
   Duration  40.66s (import 58%, tests 35%, transform 7%, worker 1%)
```

A first whole `unit` run at 15:21:31 gave 102 files and 2,659 tests, exit 0; the one test more at
15:26 is another row's (this row's count is 142 in both). Full output:
`implementation/assets/35_final_runs.log`.

### 12.4 Other rows' tests and runs (P11, rule M10, decision D85)

| Time | Command | Result | Whose |
|---|---|---|---|
| 14:30 | `typecheck` | exit 2: `src/modules/admin/__tests__/rule.test.ts(11,127)` TS2345, `src/modules/sessions/current.ts(37,12)` TS2322 | Rows W33, W34 in flight. None under `modules/evidence` |
| 14:33:16 | `npm run test … src/plugins/permission-guard/__tests__/guard.test.ts` | exit 1: 18 failed, 11 passed. `expected [ 'getServiceHealth', 'signIn', …(43) ] to deeply equal [ 'getServiceHealth', 'signIn', …(5) ]`; `FastifyError: Method 'POST' already declared for route '/api/v1/session'` (`FST_ERR_DUPLICATED_ROUTE`) | **Red by design** (rule M10): the guard row's test pinned the list of registered routes (`guard.test.ts:131-139`) and added stand-in routes for registry operations that now have real routes (`:198-210`, `support.ts:75-86`; `denial.db.test.ts:54-67` names `exportEvidence` and `listEvidence`). Reported to the controller at 14:33 with file:line, the failure text and three proposals. Ruling D85: the guard row's owner fixes its files in one patch; no module row edits them |
| 14:42 | `typecheck` | exit 2: `src/modules/sessions/__tests__/memory-engine.ts(197,19)` TS2304 | Row W34 in flight |
| 14:42 | `lint` | exit 0; two warnings in `src/modules/pairing/__tests__/devices.db.test.ts`, one in this row's `static.test.ts` (fixed at once) | Row W32; this row |
| 14:54 | `typecheck` | exit 2: `src/modules/pairing/__tests__/routes.test.ts(184,94)` TS2345 | Row W32 in flight |
| 14:54 | `lint` | exit 0; six warnings in this row's test files (a caret regular expression where `startsWith` does; fixed at once), five in `src/modules/pairing/__tests__/` | This row; row W32 |
| 15:20 to 15:27 | The final runs of section 12.3 | All exit 0, no warning: the guard row's files are green | D85 landed |

This row edited no file outside its folder at any time.

### 12.5 Verification list of the row

| Item of the row | Result | Where |
|---|---|---|
| MODG | Met | Section 12.2 |
| After verify, export, archive and an evidence tamper fault the tracks, track hashes, manifest hash and signature are unchanged | Proven on the stored rows, byte-level | Section 7 |
| A denied export answers 403 `FORBIDDEN` with one `EXPORT_DENIED` row | Yes; the row is the guard's; the module added none | Section 6.2 |
| Every answer that lists audio has exactly AUDIO-01 and AUDIO-02 | Yes | Section 8 |
| `DEMS_TEST_STEP=57` for `test:db` | Every run; the run prefix is `dems_test_step_57_…` | Sections 12.1, 12.3 |
| Whole `unit` and `db` projects at the end | Exit 0 both | Section 12.3; ledger in section 14 |
| Typecheck and lint exit 0 | Yes, no warning | Section 12.3 |
| No database of the row's prefix remains | 0 | Section 20 |
| `.locks/postgres.pid` 19121 | 19121 | Section 20 |

## 13. Mutation check

56 defects were planted one at a time in the five production files and the row's own tests run
on each. **56 of 56 detected.**

**No file of the workspace tree was changed, at any time (rule M15).** The harness of the
identity and guard rows was reused: a scratch Vitest configuration under the session's scratchpad
(outside the repository) whose one transform hands ONE production file to Vitest with ONE text
replaced (`35_mutation_harness.vitest.config.mjs.txt`, `35_mutation_harness.run.sh.txt`,
`35_mutations.json`; result lines `35_mutations.log`). The runner changes no directory (Vitest
gets the workspace as `--root`), writes Vitest's output into a file and reads it afterwards, and
runs with `--maxWorkers=2`.

| Pass | Result |
|---|---|
| Baseline through the harness, 14:57 to 14:58 | 5 unit files / 142 tests and 5 database files / 85 tests, all passing |
| All 56, 14:58:22 to 15:20:04, each against the 142 unit and the 85 database tests | **56 detected**, none survived. No test file was edited while it ran |
| After four tests were added (the three of `consistency.db.test.ts`, a device session), 15:21:07: M26 again, against 142 unit and 89 database tests | Detected by 6 database tests, two of them behavioural (a read held back between its statements) where before only the text of the `begin` was asserted |

By file:

| File | Mutations | Examples |
|---|---|---|
| `cursor.ts` | M01 to M04 | The cursor without the instant; leading zeros accepted; an instant above the largest safe integer accepted; text after the ID accepted |
| `export-request.ts` | M05 to M10 | An absent reason as `INVALID_INPUT`; every fault of the reason sent to the engine as a missing reason; a fault of the destination counted as a missing reason; an absent destination given a text; **a stand-in reason the action accepts (M09): an export without a reason goes through**; a short reason refused before the 404 and the 409 |
| `media.ts` | M11 to M13 | No item has media; the session's suffix; **every item claims the package of its number (M13)** |
| `reads.ts` | M14 to M30 | Oldest first; a keyset that is not strict; **a keyset by the instant alone (M16: detected only by the test with tied instants)**; no look-ahead row; a cursor on an exactly full last page; a filter ignored (status, case type); **the search folded with the cluster's locale (M21: detected only by the bulk test with the Unicode sample)**; the search as a `LIKE` pattern; a searched column left out (three); **not one snapshot (M26)**; the tracks of the whole page on every item; no custody; an item whatever the ID; the look-ahead row in the page |
| `index.ts` | M31 to M56 | The default page 200; a foreign cursor ignored; an unknown item 503; the 404 without `simCode`; no state position (verify, export); a copy of the principal handed to the engine; **a schema-breaking body reaching the engine (M37)**; a malformed ID handed to the engine; **a missing reason replaced by a text of the module (M39)**; **a `FORBIDDEN` in the result not answered as a refusal (M40)**; 200 for 202 and for 204; the archive running the verification; a reworded refusal without its details; the host's wording kept; a failed read as 500; **the failure line carrying the error's message (M48)**; **a row the mapping refuses reported as "the database does not answer" (M49: detected only by the edge test)**; no persistent entry; no probe; no package named; the path parameter unchecked; a refusal text that differs from the contract's example; no next cursor |

Limits of the check: each mutation is one text replaced in one file; the static test reads the
sources from disk, not through the transform, so it cannot see a mutation (the rules it keeps
have positive controls of their own); the test files were not mutated.

## 14. Test ledger (P24)

`@dems/core-server` only. No other workspace was written.

| Project | Controller baseline (14:11) | Final | This row | Other rows in flight since the baseline |
|---|---|---|---|---|
| `unit` | 77 files, 1,992 tests | 102 files, 2,660 tests, 0 failed (15:27:10) | **+5 files, +142 tests** | +20 files, +526 tests |
| `db` | 48 files, 740 tests | 75 files, 1,081 tests, 0 failed (15:24:59) | **+6 files, +89 tests** | +21 files, +252 tests |

Expected total = baseline + reported additions: this row accounts for 142 and 89; the remainder
is the work of the rows that write at the same time (W32, W33, W34, W36, W37, the guard row's
D85 patch and the foundation fix round of D87), whose own ledgers name their files. Both totals
are above the baseline and failed is 0.

| Project | File (under `src/modules/evidence/__tests__/`) | Tests |
|---|---|--:|
| `unit` | `cursor.test.ts` | 5 |
| `unit` | `export-request.test.ts` | 36 |
| `unit` | `media.test.ts` | 9 |
| `unit` | `routes.test.ts` | 74 |
| `unit` | `static.test.ts` | 18 |
| `db` | `reads.db.test.ts` | 29 |
| `db` | `commands.db.test.ts` | 33 |
| `db` | `immutability.db.test.ts` | 8 |
| `db` | `bulk.db.test.ts` | 14 |
| `db` | `edge.db.test.ts` | 2 |
| `db` | `consistency.db.test.ts` | 3 |

Test support, not a test file: `src/modules/evidence/__tests__/support.ts`. No existing test of
any row was changed by this row.

## 15. Requirement to test

| Requirement | Statement | Test |
|---|---|---|
| SR-59 | The evidence `TAMPER` demo fault never alters a sealed hash, a manifest hash or a signature | `immutability.db.test.ts`: the fault on each of the four tracks, on a dataset item and on an engine-sealed item; digest, members and track row versions equal after it and after its clearing |
| SR-66, MS-3 | The server resolves no file path from a client and accepts no upload | `static.test.ts` rule 7 (no file, path, stream or network module; the import list is pinned); `routes.test.ts` (no route of the area names a file; hostile IDs); `media.test.ts`; `reads.db.test.ts` "SR-66, MS-3 …" |
| AC-B-69 | After verify, export, archive and an evidence tamper fault, the tracks, track hashes, manifest hash and signature are unchanged | `immutability.db.test.ts` (8 tests; section 7); `bulk.db.test.ts` (the digest over all 2,575 sealed rows); `commands.db.test.ts` (no statement of a command names a track or a sealed column) |
| AC-B-70 | Every answer that lists audio has exactly AUDIO-01 and AUDIO-02 | Section 8 |
| I11 (spec §7.9, domain rules) | A status change adds a custody entry and an audit row; no operation sets UNDER_REVIEW | `commands.db.test.ts`: per command one audit row, one event, one custody entry appended and the earlier entries equal; the module has no operation that sets UNDER_REVIEW (three hosted actions, `static.test.ts` rule 3) |
| RB-5, D83 DN-4 | The guard writes `EXPORT_DENIED`; the module writes no denial row | Section 6.2; `static.test.ts` rule 2 |
| Rule M3 | Who may call is stage 6, only | `static.test.ts` rule 1; `routes.test.ts` "no route carries a check of its own" |
| Rule M4, engine host §3 | A refusal in the result is answered after the unit | Section 6.3 |
| API-7 | A 2xx answer of a POST carries epoch and revision of the outcome | `routes.test.ts` (200, 202, 204 with both headers; no refusal has them); `commands.db.test.ts` `expectStatePosition` on every success, "an item that is already archived …" (the current revision when nothing changed) |
| API-9 | Cursor paging, default 50, at most 200 | Section 4.4 |
| ENG-5 | A unit that cannot be committed: 503, nothing stored, the engine set back | `commands.db.test.ts` "ENG-5 …" and "a statement of the write-through that fails …" |
| ENG-6 | Commands are serialised | `consistency.db.test.ts` "two exports and ten verifications of one item at once" |
| SR-48, rule M14 | No request value and no statement in a log line | `routes.test.ts` "nothing of a request …", "the code of a failure the query builder wrapped …"; `reads.db.test.ts` "rule M14 …" (a real failing statement whose parameter is the search text); `commands.db.test.ts` "SR-48 …" |
| SR-65 | The actor comes from the session | `routes.test.ts` (the principal by identity); `commands.db.test.ts` "SR-65 …" |
| Engine host F-11 | Each hosted action of the module is run against PostgreSQL | `commands.db.test.ts`: `verify`, `exportEvidence`, `archiveEvidence`; also `inject` and `clearFault` with an evidence target and `SECURITY_FAULT` |

## 16. What the specification left open, and this row's choices

| # | Open point | Choice | Why |
|--:|---|---|---|
| 1 | Where a read answers from (the spec says "reads `evidence`", the contract "from the stored tables") | PostgreSQL, in one read-only snapshot | Section 4.1 |
| 2 | The form of the cursor | `<recorded_at>-<evidence ID>` | Stateless, fits `LIST_CURSOR_PATTERN`, the keyset of the index the database contract built for it |
| 3 | A value that fits the contract's cursor pattern and is no cursor of this list | 422 `INVALID_INPUT`, `details.in: querystring` | The contract's text for 422: "a cursor that is not one" |
| 4 | How "without regard to case" is met under locale `C` | `casefold` with the built-in collation `pg_unicode_fast` | Section 4.4 |
| 5 | Whether `q` is a pattern | No: `strpos`, so `%` and `_` are plain characters | A search text is data |
| 6 | An ABSENT reason of an export: `INVALID_REASON` or `INVALID_INPUT` | `INVALID_REASON`, decided by the action in its order | A mandatory reason that is not given is a reason of no characters; the simulator's REST layer answers so; the Live source sends `''` for it |
| 7 | A reason of the wrong type (a number, null) | 422 `INVALID_INPUT` at line 8 | "any other body that does not match its schema" (the operation's text for the Core server) |
| 8 | A malformed `{id}` on `exportEvidence` | 404 `NOT_FOUND`, without a unit | The design-book operation documents 404 and no 422 for its path; the simulator answers 404 (contract C, F-4). No item can have such an ID (a CHECK of the table) |
| 9 | A malformed `{id}` on 40, 41, 43 | 422 `INVALID_INPUT`, `details.in: params` | The registry documents it (`INVALID_PATH_PARAMETER`) |
| 10 | The text of a refusal | The texts of the contract's examples | One wording in the document and on the wire |
| 11 | The 404 of the READ `getEvidence` | `details: { simCode: 'NOT_FOUND' }`, as the contract's example and as a hosted action's 404 | A client reads one form for "no such item" |
| 12 | A read that fails | 503 `NOT_READY` for a database that does not answer or refuses a statement; 500 for a row the mapping refuses | The recipe of `getRoleMatrix` (W28); a corrupt row is not an outage |
| 13 | The `caseType` filter on an item without a stored case type | Not matched (`case_type = $1`) | The index of the database contract; both templates hold no such item (the counts by case type add up to 13 and to 515) |

## 17. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | **Three test files of the guard row (W28) pinned the registered routes and added stand-in routes for operations that now have real ones.** Reported to the controller at 14:33 with file:line, the failure text and three proposals; decision D85: the guard row's owner fixes them in one patch | Section 12.4; `guard.test.ts:131-139, 198-210` at that time | No file of that row was edited by this row |
| F-2 | **The cluster's locale is `C`: `ILIKE` and `lower()` fold ASCII only.** `'É' ILIKE 'é'` is false on this cluster | The probe of 14:33 (section 4.4); database contract PG-20, TY-9 | The search folds with a built-in collation of PostgreSQL 18. For W39 if the audit list ever searches text |
| F-3 | **zod's `.min(5)` counts characters, the simulator's check code units.** A reason of three two-unit characters is refused by the contract and accepted by the action | `export-request.test.ts` "why the text itself is not handed on …" | The action is never handed a text the contract refused (section 6.1). The same holds for the stop reason of a session (W34) and the reason of the audit exports (W39): a module that forwards a schema-refused reason to learn the action's order would let the action accept it |
| F-4 | **The evidence tamper fault sets the item's verification back to `NOT_RUN`, and so does its clearing.** A verdict of before the fault no longer stands; the item shows "not verified" until it is verified again | `immutability.db.test.ts`, the lines of section 7; `packages/shared/src/sim/evidence.ts:335-342` | For the client rows (W69, W75): after a tamper fault the badge is "not run", then FAIL after a verification. The change is in the columns the runtime role may update; nothing sealed moves |
| F-5 | The `FAULT_CLEARED` row of an evidence tamper fault does not name the evidence item; the `FAULT_RAISED` row does | `immutability.db.test.ts` "a dataset item …" | An audit filter by `evidenceId` (operation 59, W39) shows the raising and not the clearing |
| F-6 | `verify` runs on an item of any status, also RECORDED and ARCHIVED; an EXPORTED item can be exported again (a new export ID each time); an ARCHIVED item answers 409 `NOT_SEALED` to an export, with the text "Only sealed evidence can be exported." | `commands.db.test.ts`; `bulk.db.test.ts` | The simulator's rules, kept. For the client rows: the code of "archived" is `NOT_SEALED` |
| F-7 | When the action's own denial branch runs (a role changed between stage 4 and the unit, section 6.3) the `EXPORT_DENIED` row is the simulator's: without `operationId` and `permission` in its details, and without a place in the denial budget | `commands.db.test.ts` "a refusal the simulator reports IN ITS RESULT …" | Residual. One row per refused call still holds. For the security review W45 |
| F-8 | The query builder sends a statement to a stand-in pool through `query`, not through `connect`: `drizzle(pool).transaction()` asks for a connection only when the object is a `pg.Pool` | `routes.test.ts` (the stand-in counts both) | A note for authors of database-free tests of a module that reads through a transaction |
| F-9 | The digest of the sealed rows of a seeded item is the same in every run (`b9e5fc5e…` for `EV-20260929-0001`): the seed is deterministic down to the bytes of the stored rows | Every run of `immutability.db.test.ts`, the mutation runs included | A regression of the seed or of the mapping of a sealed column would show as a changed digest |
| F-10 | The statements of the two reads name their tables without the schema, as the query builder writes them and as the store's own reads do (finding F53) | `reads.db.test.ts` (the quoted statement texts) | Covered by the pinned `search_path` of the foundation fix round (D87); nothing to change here |
| F-11 | No `SIM-GAP`, no `SCHEMA-GAP`. Two `CONTRACT-GAP`s, both about texts and examples (below) | | W83 |

### Contract gaps (decision D84: named with the row)

**CONTRACT-GAP-W35-1** (an example is less than the answer). `packages/shared/src/api/evidence.ts:369-376`,
the 409 example of `archiveEvidence`, shows `details: { simCode: 'UNSEALED_EVIDENCE' }`. The
server's answer carries the transition as spec §7.2 lists it: `details: { simCode:
'UNSEALED_EVIDENCE', from: null, event: 'archiveEvidence' }`. Exact text for W83: give
`simRefusalExample` its fifth argument,

```ts
        notSealed: simRefusalExample(
          `${STATE_EXAMPLE_IDS.recordedEvidenceId}: incomplete session, never sealed`,
          'NOT_SEALED',
          'Unsealed evidence cannot be archived.',
          'UNSEALED_EVIDENCE',
          { from: null, event: 'archiveEvidence' },
        ),
```

Marker in the code: `commands.db.test.ts`, "an item that was never sealed …".

**CONTRACT-GAP-W35-2** (a status text names one of two codes). `packages/shared/src/api/core-api.ts:849`,
`exportEvidence.responses[422]`: "The reason is shorter than 5 characters (INVALID_REASON)." and
`examples.ts:493-498` shows `invalidReason` only. The Core server also answers `422 INVALID_INPUT`
(`details.in: body`) for a body that breaks its schema; today only the operation's
`coreServerDescription` says so. The component and its texts belong to the pinned offline scope,
so the form is W83's choice; the two texts it needs:

- status text, `all` scope: "The reason is missing or shorter than 5 characters (INVALID_REASON),
  decided after the 404 and the 409; or the body does not match its schema (INVALID_INPUT,
  Core server only): a reason that is not text or is longer than 500 UTF-16 code units, a
  destination longer than 120, U+0000 or an unpaired surrogate."
- a second example, `all` scope: `invalidInput: ERROR_EXAMPLES.invalidInput` (`{ code:
  'INVALID_INPUT', message: 'The request does not match the expected input.', details: { in:
  'body' } }`).

Marker in the code: `commands.db.test.ts`, "line 8 before line 10 …". Related, already W83's
(contract C, F-6): the text of `EvidenceExportRequest.destination` still says "is cut".

## 18. Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (P8). This document is the row's output document |
| DV-2 | The too-short reason of an export is not mapped from the schema stage's refusal (the wording of D50); it reaches the hosted action as `NO_REASON` and the ACTION answers `INVALID_REASON`, after its 404 and 409 checks | Spec §7.3 line 10 names that order for `exportEvidence`, and the Live source maps the statuses back to the simulator's result. The code a client gets for a too-short reason is the one D50 names. Decision DN-2 |
| DV-3 | The body of `exportEvidence` is validated in the handler with the contract's schema, not through the route's `schema.body` | A `schema.body` refuses a short reason at stage 7 as `INVALID_INPUT`, before the 404 and 409. The schema itself is the contract's, unchanged |
| DV-4 | The test support imports the test support of four other rows, read-only (`core`, `engine`, `identity`, `db/seed`) and the bulk template's instant | Their files say other rows may |
| DV-5 | One test takes a CHECK constraint away on its own clone, as `dems_owner`, to store a row no program can write | The only way to show what a read does with a row the mapping refuses. No project database, no template |
| DV-6 | One read-only command (a Node one-liner that probed zod, between 14:20 and 14:26) began with `cd /Users/gsp-budi/Documents/DEMS`, the workspace root itself | A slip against P10's wording; no subfolder was entered and it had no effect. Every later command, the mutation runner included, changes no directory |

## 19. Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | The two reads answer from PostgreSQL, in one read-only snapshot; equality with the engine's slice is a tested invariant on both templates | Accept (section 4) |
| DN-2 | The order of the export's refusals (DV-2): `INVALID_INPUT` for a body that breaks the schema at line 8; `INVALID_REASON` for a missing or too-short reason at line 10, after 404 and 409, decided by the action | Accept. If the literal reading of D50 is preferred (422 before 404), the change is one line: answer `INVALID_REASON` for `REASON_MISSING` without calling the engine |
| DN-3 | An absent reason is `INVALID_REASON`; a reason of the wrong type is `INVALID_INPUT` | Accept |
| DN-4 | A malformed ID answers 404 on `exportEvidence` and 422 on operations 40, 41, 43 | Accept; pass to W52 (conformance) and W47 (matrix): the cell of `exportEvidence` with a malformed ID is 404 |
| DN-5 | The search folds with `casefold(… COLLATE "pg_unicode_fast")`: it needs PostgreSQL 18, which the project pins | Accept, or rule "ASCII only" and replace it with `ILIKE` on an escaped pattern (the bulk test of the Unicode sample then goes) |
| DN-6 | The cursor `<recorded_at>-<evidence ID>` | Accept; pass to W64 / W69 (the Live evidence pages): the value is opaque, send it back as it came |
| DN-7 | The wording of the refusals follows the contract's examples; the 404 of the read carries `details.simCode` | Accept |
| DN-8 | A read that fails answers 503, a row the mapping refuses 500 | Accept |
| DN-9 | CONTRACT-GAP-W35-1 and CONTRACT-GAP-W35-2 | To W83 with the texts of section 17 |
| DN-10 | Pass to W47 (matrix): operations 39, 40, 41 have no denied cell with seeded data (contract F-8); a denied case exists after `DELETE FROM role_permissions` for one role in the clone, as `commands.db.test.ts` does | |
| DN-11 | Pass to the client rows W64, W69, W75 and their mobile counterparts: findings F-4 and F-6; the export's refusals in their order; a reason of three two-unit characters is refused (F-3) | |
| DN-12 | Pass to the security review W45: finding F-7 | |
| DN-13 | The read helper `app.db.read(…)` of the foundation fix round (D87) | The two reads can move onto it in one place (`read()` of `index.ts` and the two `transaction(…, SNAPSHOT)` calls of `reads.ts`) when it has landed; nothing waits for it |

## 20. End state and cleanup

At 15:26:23 (a scratch script outside the repository, as `dems_owner`, through the test helper's
own reader of the connection file; it prints names and counts; the script of the guard row,
reused: `implementation/assets/35_end_state.mts.txt`):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_57_*): 0
test databases of all rows at this moment: 13
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

- `.locks/postgres.pid`: 19121, the process started 07:14:26, as before. PostgreSQL was never
  stopped or reconfigured. Nothing connected as the bootstrap superuser.
- `dems_demo` and the lane databases were never connected to by this row: every test ran on a
  clone of the helper (`DEMS_TEST_STEP=57`, templates `seed` and `bulk`); the further clones a
  test file asks for (`db.another`) are dropped with their file. Every `test:db` run of the row
  ended with "0 remain with the run prefix".
- No port was bound and no process of this row is left: the two background commands (the
  mutation run and a wait for its end) ended by themselves.
- `apps/core-server/logs/` was not written by this row: its apps have no error-log file, and a
  test that inspects the persistent error log captures the entries in memory.
- Nothing under `apps/mock-core`, `release`, `scripts/release`, `packages/shared` or any other
  module folder was written.
- Scratch files (the mutation harness, the saved runner outputs, the drafts of this document)
  are under the session's scratchpad and the system's temporary directory, outside the
  repository. The harness's link to the repository's `node_modules` was removed at the end (the
  link, not its target). What is evidence is kept as text under
  `implementation/assets/35_*`.

## 21. Rollback (R-NEW; not executed)

Pre-image, saved at 14:26:54 before the first edit (a file copy: `apps/core-server/` is untracked):

| Pre-image | Restores | SHA-256 |
|---|---|---|
| `.cache/rollback/W35/src/modules/evidence/index.ts` | `apps/core-server/src/modules/evidence/index.ts` (the stub of W08) | `c04cb5d911d9796378c4b6676966526246e134d4348314472b45a51c3c2695a3` |

Steps:

1. Copy the pre-image back over `apps/core-server/src/modules/evidence/index.ts`.
2. Remove the files this row added: `cursor.ts`, `export-request.ts`, `media.ts`, `reads.ts` and
   `__tests__/` under `apps/core-server/src/modules/evidence/`.
3. Nothing else: no package, no schema, no migration, no contract file, no file of another row,
   no database and no host setting was changed.

With the stub back, operations 39 to 43 answer 404 (no route); the guard's rules for them stay in
the registry. The rows that depend on this one (W47, W52, the Live evidence pages) lose their
endpoints.

## 22. Not done, and not verified by this row

| Item | Why | Where it belongs |
|---|---|---|
| The role-by-operation matrix for all roles and caller kinds | One allowed and one refused call per operation is the module gate's measure | W47 |
| A real HTTP listener, the web console and the mobile app against these routes | Backend rows test in-process (P18) | W58, the client rows |
| The demo-control route for the tamper fault | The fault is injected through the engine host here | W43 |
| Evidence created through the sessions module's routes | The items here are seeded, of the bulk fixture, or sealed by driving the engine | W34; the acceptance rows |
| A restart with evidence that was verified, exported and archived | The engine host proved the restart for all 28 slices; this row asserts tables equal to the engine after its commands | W53 |
| The behaviour of the two reads under a statement that runs long | No statement limit is set on the read-only transaction; the largest table of the fixture is 515 rows and the search is a sequential scan by design | The read helper of D87, if it sets one |
| A second pass of the whole mutation check after the four tests added at the end | The additions only add assertions; M26 was run again against them (section 13) | |

---
*Generated: 2026-10-04 15:30 WIB*
*Last Updated: 2026-10-04 15:30 WIB*
