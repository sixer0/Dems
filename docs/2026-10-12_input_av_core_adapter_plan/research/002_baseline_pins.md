---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: data-analyst
type: baseline pin measurement (blueprint row 2, T3)
branch: task4/input-av-core-port
head_measured: 2307e9dc (docs-only commit on top of the plan baseline cf2f8008; `git diff --stat cf2f8008 HEAD -- apps packages` is empty)
source_blueprint: identification/03_implementation_blueprint.md (row 2)
status: complete
---

# Baseline pins at the branch head (row 2)

Read-only on source. No database was opened, no test suite was run. Paths are relative to the repository root `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `SH` = `packages/shared/src`.

## Result

| # | Pin | Plan figure | Measured | Difference | Defining source (file:line) |
|---|---|---|---|---|---|
| 1 | Operations | 97 | **97** (36 GET, 61 POST, 97 unique ids) | none | `SH/api/core-api.ts:760` (table start), `:1079` (`CORE_API_OPERATIONS`); composition comment `:1071-1072` |
| 2 | Audit types | 67 | **67** (and 67 entries in the category map) | none | `SH/sim/vocabulary.ts:346-435` (`AuditType`), `:439-511` (`AUDIT_TYPE_CATEGORY`) |
| 3 | Permissions | 14 | **14** | none | `SH/sim/vocabulary.ts:23-43` (`Permission`) |
| 4 | Value sets | 44 | **44** | none (see note 2) | `CS/test/db/contract-inventory.json:3` (`valueSets`), pinned `CS/test/db/contract-inventory.test.ts:315`; text in `CS/src/db/schema/value-sets.ts` |
| 5 | Migration files | 15 | **15** `.sql` files, `0000` to `0014`; 15 journal tags | none | `CS/src/db/migrations/`; `CS/src/db/commands/migrations.ts:43-59` (`INITIAL_MIGRATION_TAGS`); `.../meta/_journal.json` |
| 6 | Schema version | 6 | **6** | none | `CS/src/db/schema/meta.ts:38`; `CS/src/db/migrations/0014_key_id_fault_reason_media_root_privileges.sql:35` |
| 7 | Contract revision | `dbc-7` | **`dbc-7`** | none | `CS/src/db/schema/meta.ts:40`; same SQL line 35 |
| 8 | Tables | 43 | **43** | none | `CS/src/db/schema/*.ts` (43 `export const x = pgTable(`); header `CS/src/db/schema/index.ts:2`; `CS/test/db/contract-inventory.json:4803` |

Eight pins of eight re-measured; differences in values: 0. Differences in cited lines: 1 (note 1).

## How each was counted

Run from the repository root; output quoted.

1. **Operations.** The table is composed from spread lists (`core-api.ts:1049-1072`), so counting `operationId:` lines is wrong: `grep -c "^\s*operationId: '" packages/shared/src/api/*.ts` sums to 103 and `sort -u` gives 100, because three ids (`adoptCaptureCandidate`, `testCaptureCandidateConnection`, `updateSttConfig`) also occur in type and example blocks. The registry was therefore evaluated: `esbuild` bundled a 5-line script that imports `CORE_API_OPERATIONS` and prints the length (script in the session scratch directory, source untouched). Output: `operations 97 unique 97` and `{"get":36,"post":61}`; last ids `... getCaptureDiscovery, testCaptureCandidateConnection, adoptCaptureCandidate, rescanCaptureInputs`. This agrees with the source comment `core-api.ts:1071-1072` ("92 + 5 = 97 operations, 36 GET / 61 POST"). Test pins that hold the number: `CS/src/plugins/permission-guard/__tests__/access-rules.test.ts:65` and `:67`; `.../guard.test.ts:251`; `apps/core-web/src/test/live-api-reference-page.test.tsx:133` and `:303-304`; `apps/core-web/src/test/live-api-reference-document.test.tsx:146` and `:238`. All seven lines read `97` (`sed -n` on each).
2. **Audit types.** `s=$(grep -n "^export const AuditType = {" vocabulary.ts)` gives 346; the closing `} as const;` is at 435; `sed -n 347,434p | grep -cE "^\s+[A-Z_0-9]+: '[A-Z_0-9]+',"` returns `67`. The category map `AUDIT_TYPE_CATEGORY` (439 to 511) counted with the same method returns `67`. Test pins: `CS/src/core/__tests__/writers.test.ts:54` (`toHaveLength(67)`); `CS/src/db/fixtures/__tests__/audit-details.test.ts:149` (title "all 67 types"), `:272` and `:285` (`toHaveLength(67)`); fixture comment `CS/src/db/fixtures/operations.ts:487` ("all 67 types").
3. **Permissions.** `sed -n 23,43p vocabulary.ts | grep -cE "^  [A-Z_]+: '[A-Z_]+',"` returns `14` (9 base, `PAIRING_MANAGE`, `USER_ADMIN`, `DEMO_CONTROL`, `CAPTURE_CONFIG`, `TRANSCRIPT_REVISE`). Stored-row pin: `CS/test/acceptance/rbac-matrix.test.ts:1109` ("3 roles, 14 permissions, 22 grants"); the seed derives its rows from `Object.values(Permission)` at `CS/src/db/mapping/rbac.ts:22`; `CS/src/db/seed/__tests__/seed-order.test.ts:100` mentions the 14.
4. **Value sets.** `node -e` on `contract-inventory.json`: `valueSets keys 44`. The test that holds it is `contract-inventory.test.ts:315` (`Object.keys(inventory.valueSets)).toHaveLength(44)`); the comment at `:313-314` explains 28 + 14 + 2. `value-sets.ts` has 47 `export const` lines (`grep -c`); the same script found the 3 exports that are not value sets of the contract: `CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND` (`value-sets.ts:145`), `CAPTURE_PRODUCTION_ADAPTER_KINDS` (`:153`), `AUDIT_DETAIL_FORBIDDEN_KEYS` (`:203`); inventory keys not exported: none. 47 - 3 = 44.
5. **Migration files.** `ls -1 apps/core-server/src/db/migrations/*.sql | wc -l` returns `15`; `git ls-files ... | grep -c '\.sql$'` returns `15`; `grep -c '"tag"' meta/_journal.json` returns `15`; last tag `0014_key_id_fault_reason_media_root_privileges` (`_journal.json:107`). Pins: `CS/test/db/contract-inventory.test.ts:265` (`readMigrationSet()).toHaveLength(15)`), `CS/test/db/set7.db.test.ts:177` (`toHaveLength(15)`), `CS/test/db/commands.db.test.ts:87` ("applies the fifteen files").
6. and 7. **Version and revision.** `grep -n "DB_SCHEMA_VERSION = \|DB_CONTRACT_REVISION = " meta.ts` returns `38:export const DB_SCHEMA_VERSION = 6;` and `40:export const DB_CONTRACT_REVISION = 'dbc-7';`. The database side is the last migration file, line 35: `UPDATE public.schema_meta SET schema_version = 6, contract_revision = 'dbc-7' WHERE singleton;`. Tests that hold the pair: `CS/test/db/set7.db.test.ts:56` (`SET_7`), `:166-174`; `CS/test/db/commands.db.test.ts:95,104,106,120,160`; `CS/test/db/set5.db.test.ts:108`; `CS/src/sealing/__tests__/last-resort.db.test.ts:132-135`.
7b. **Tables.** `grep -rnE "^export const \w+ = pgTable\(" apps/core-server/src/db/schema/*.ts | wc -l` returns `43`; per file: audit 4, capture 3, core 9, evidence 4, identity 1, meta 1, pairing 5, rbac 5, recording 4, sessions 2, stt 2, transcript 3 (sum 43); `pgEnum(` search returns 0. The composed inventory states `"tables": 43` (`contract-inventory.json:4803`; the other counts there: columns 440, primaryKeys 43, foreignKeys 40, uniques 15, uniqueIndexes 4, indexes 23, checks 182) and the test pin is `contract-inventory.test.ts:59`.

## Differences and notes for the controller

1. **One cited line does not hold a count.** The design addendum's pin list (`masterplan/04_design_addendum.md:533`) cites `SHARED/sim/api.ts:767` as an operation-count pin. `SH/sim/api.ts:765-768` is a doc comment about the 403 on credential-carrying operations. The simulator's own list carries the 97th operation as a comment at `SH/sim/api.ts:1479` (`// 97 rescanCaptureInputs`); the count itself lives in the registry (`core-api.ts`). Row 63 and later count-moving rows should treat the real pins as: the seven test lines above, the registry, and `sim/api.ts:1479`. The other cited lines of addendum `:532-533` were checked and hold (list in "Pin lines checked").
2. **Value-set wording.** "44 value sets" is the contract inventory (`valueSets` keys), not the number of exports of `value-sets.ts` (47). A row that adds a set must move `contract-inventory.json`, `contract-inventory.test.ts:315` and `value-sets.ts` together; a row that adds an export that is not a contract set (like the three above) moves none of the 44.
3. **Frozen unit list.** `apps/core-server/src/app.ts:308` starts `UNITS` (ends `:339`); `modules/capture-inputs` is registered at `:334`. Not one of the eight pins; recorded because the addendum names the "frozen unit list of `app.ts`" under the operation pins.
4. **Working tree is not clean, by another session.** `git status --short -- apps packages` at the time of measurement shows three modified files: `apps/core-server/src/capture/adapters/types.ts`, `.../mic-transport.ts`, `.../__tests__/static.test.ts` (rows running in parallel; at the start of this row the status listed only the docs folder). None of them is a file named in the table above; `git diff --stat HEAD` over `packages/shared/src`, `apps/core-server/src/db`, `apps/core-server/test/db`, `apps/core-server/src/plugins`, `apps/core-server/src/core`, `apps/core-web/src/test`, `apps/core-server/test/acceptance` is empty. The eight figures are therefore those of the committed branch head.
5. **Method limit.** The operation count was obtained by evaluating the registry module (bundled with `esbuild`, run with `node`); no other source was executed. The figure was cross-checked against the registry's own comment and the seven test pins, which agree.

## Pin lines checked (addendum 04, sections around `:532-533`)

| Cited | Holds | Content at the line |
|---|---|---|
| `VOC:346-435` | yes | `AuditType` object, 67 members |
| `writers.test.ts:54` | yes | `expect(types).toHaveLength(67)` |
| `audit-details.test.ts:149,272,285` | yes | title "all 67 types"; two `toHaveLength(67)` |
| `fixtures/operations.ts:487` | yes | comment "all 67 types" |
| `guard.test.ts:251` | yes | `toHaveLength(97)` |
| `access-rules.test.ts:65,67` | yes | `toHaveLength(97)`; `.size).toBe(97)` |
| `live-api-reference-page.test.tsx:133,303` | yes | `toHaveLength(97)`; `waitFor(... toHaveLength(97))` (`:304` text "97 operations") |
| `live-api-reference-document.test.tsx:146,238` | yes | `toBe(97)` both |
| `SHARED/sim/api.ts:767` | **no** | doc comment; see note 1 |
| `meta.ts:38,40` | yes | `6`, `'dbc-7'` |

## Not measured (outside the eight pins of the row)

Kept-table counts, column and CHECK counts other than those quoted from the inventory, and the 22 grants figure were not re-counted by an independent search; they are quoted from the files named above only.
