---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: RD1 (the schema of retiring a capture device; design 07 row RD1)
date: 2026-10-14
agent: database-specialist (agent RD1, wave 12, track D)
narrative_tier: 2
source_decisions: decisions/decisions.md C147 (design 07 adopted; Q1-Q4 ruled), C29 (throw-away databases only)
source_design: masterplan/07_design_retire_readopt.md section 4.1 (schema), 4.3-4.4 (what the database must make possible), security points 1, 3, 4, 5; section 5 row RD1 (line 158)
precedent: implementation/d4a_network_config_schema.md (set 15: 13 -> 14 / dbc-14 -> dbc-15, the delivery form copied here)
status: complete for the schema step; the Core operation, the contract and the clients are NOT built (rows RD2-RD5)
branch: task4/input-av-core-port (nothing committed, nothing staged)
---

# Row RD1: retiring a capture device in the database (migration set 16, schema version 14 -> 15, contract revision dbc-15 -> dbc-16)

Paths are relative to the repository root; `CS` = `apps/core-server`. Every figure was measured on this Mac on 2026-10-14 against the local PostgreSQL 18.4 on 127.0.0.1:4432, on throw-away databases of the test helper only (each run ends `0 remain with the run prefix`). No `db:migrate` ran on the demo, a lane or `dems_test_m12_row232` database (C29). No file under `.data/` was read.

## 1. What the database now holds

### 1.1 Columns (published to RD2 in `delegation_progress/file_claims.md`, line "RD1 PUBLISHED NAMES")

| Column | Type | Meaning | Typed member |
|---|---|---|---|
| `capture_devices.retired_at` | bigint NULL (epoch ms, as `last_seen_at`) | the instant the device was retired; NULL = in service | `captureDevices.retiredAt: number \| null` (`CS/src/db/schema/capture.ts:179`) |
| `capture_devices.retired_by` | text NULL, FK `operators(id)` ON DELETE RESTRICT (`capture_devices_retired_by_fkey`) | the operator who retired it | `retiredBy: string \| null` (`:180`) |
| `capture_audio_inputs.retired_at` | bigint NULL | the MIRROR of the microphone's registry value, written in the same unit with the same value | `captureAudioInputs.retiredAt` (`:454`) |

All three are appended last (`ALTER TABLE ... ADD COLUMN`), no default; every existing row reads NULL = in service.

### 1.2 CHECKs (both on `capture_devices`)

| Name | Definition (statement text of `0032`) | Source |
|---|---|---|
| `capture_devices_retired_check` | `("capture_devices"."retired_at" IS NULL) = ("capture_devices"."retired_by" IS NULL)` | design 4.1 "both are NULL or both are set" |
| `capture_devices_retired_kind_check` | `"capture_devices"."retired_at" IS NULL OR "capture_devices"."kind" <> 'POE'` | DRIVER DECISION 1 (design 4.3 refuses the PoE switch; held by the database too) |

### 1.3 Identity rules made partial on rows in service (names kept)

| Name | Before | After |
|---|---|---|
| `capture_devices_onvif_uuid_key` | unique index `WHERE onvif_uuid IS NOT NULL` | unique index `WHERE ((onvif_uuid IS NOT NULL) AND (retired_at IS NULL))` |
| `capture_audio_inputs_card_input_key` | unique CONSTRAINT `(card_id, card_device, input_number)` | unique INDEX on the same three columns `WHERE (retired_at IS NULL)` |

A retired camera no longer holds its ONVIF reference, a retired input no longer holds its card input: the same unit can be adopted / registered again under a NEW id; a second device IN SERVICE with the same reference is still refused 23505 under the same name.

### 1.4 Guard and destroy path (hand-written `0033`)

| Object | What it does |
|---|---|
| `dems_capture_retired_row_guard()` (plpgsql, invoker rights, search path pinned, owner `dems_owner`, no EXECUTE for anyone) | BEFORE UPDATE FOR EACH ROW: if `OLD.retired_at IS NOT NULL` and the row image without `last_seen_at` and `enabled` differs, raise SQLSTATE `ZD001` ("<table>: a retired row is not changed"). So: no un-retire, no other instant or operator, no model / firmware / address / profile / card edit; a statement that writes the stored values unchanged passes |
| triggers `capture_devices_retired_guard`, `capture_audio_inputs_retired_guard` | the guard on both tables, `ENABLE ALWAYS` (as the three audit triggers of `0002`) |
| `dems_capture_credential_destroy(p_device_id text) RETURNS integer` (sql, SECURITY DEFINER, search path pinned, owner `dems_owner`, EXECUTE for `dems_app` only) | deletes the one credential row of the device ONLY when its registry row is already retired; answers 0 or 1. The mirror of the reveal function of `0005` |
| Grants | `GRANT UPDATE (retired_at, retired_by) ON capture_devices`, `GRANT UPDATE (retired_at) ON capture_audio_inputs`, `GRANT EXECUTE` on the destroy function. Still NO DELETE / TRUNCATE on registry, credential, stream or input tables for the runtime role (measured 42501) |
| Version row | `UPDATE public.schema_meta SET schema_version = 15, contract_revision = 'dbc-16' WHERE singleton;` |

## 2. What was built

| # | Item | Where |
|---|---|---|
| 1 | Columns, FK, CHECKs, partial indexes in the typed schema (the now unused `unique` import removed) | `CS/src/db/schema/capture.ts` |
| 2 | `DB_SCHEMA_VERSION = 15`, `DB_CONTRACT_REVISION = 'dbc-16'`, with the version paragraph | `CS/src/db/schema/meta.ts:121,123`; `CS/src/db/schema/index.ts` "SCHEMA VERSION 15" |
| 3 | GENERATED `0032_capture_device_retirement.sql`, 10 statements (`npm run db:generate -w @dems/core-server -- --name=capture_device_retirement`, drizzle-kit; also `meta/0032_snapshot.json`, journal idx 32). Not edited by hand | `CS/src/db/migrations/` |
| 4 | Hand-written `0033_capture_device_retirement_privileges.sql`: stub and `meta/0033_snapshot.json`, journal idx 33 by the generator (`-- --custom --name=capture_device_retirement_privileges`); content with the Edit tool; 12 statements | same |
| 5 | Tag list and its comment (34 files) | `CS/src/db/commands/migrations.ts` |
| 6 | Contract delta and inventory: NEW `CS/test/db/contract-v15-delta.ts`; composer `contract-inventory.ts` (import, the v15 block, `V15.changedTables`, the source text); `contract-inventory.json` regenerated by its own command (`node --import tsx test/db/contract-inventory.ts --write`) | `CS/test/db/` |
| 7 | NEW per-set test `CS/test/db/set16.db.test.ts`, groups M16S-1 to M16S-8, 38 tests | |

Totals: 48 tables, **501 columns (498)**, **233 CHECKs (231)**, **49 FKs (48)**, 48 PKs, **15 unique constraints (16)**, **8 unique indexes (7)**, 24 indexes, 48 value sets; **9 public functions (7)**; **5 non-internal triggers (3)**; **34 migration files (32), 19 hand-written (18)**. No table, no value set, no permission, no audit type (an open CODE set, design 4.2).

Drift probe after the step: `npm run db:generate -w @dems/core-server -- --name=drift_probe` -> `No schema changes, nothing to migrate` (no file written).

## 3. kept-tables.ts (CHECK ONLY, not edited)

The design's HYPOTHESIS (4.1, 6) "a demo reset carries whole rows, so `retired_at` survives a reset" is CONFIRMED by code and by measurement:
- code: `CS/src/db/reset/kept-tables.ts:67-72` builds each kept table's column list from the typed schema (`getTableColumns`), and `capture_devices`, `capture_device_credentials`, `capture_device_streams`, `capture_audio_inputs` are kept `upsert` (`:94-95`, `:104-105`); the image is `to_jsonb(k)::text` (`:131`), so the new columns travel with no change to the file;
- measured: M16S-8 reads the images of the four tables from a database holding a retired camera and microphone, carries them with `carryStatement` into a new set-16 database where the seed's `CAM-01` is already present, and reads them back text for text equal; the guard holds the carried retired row on the new side (ZD001). The `upsert` of a seeded built-in passes the guard because the seeded row is in service.

## 4. For RD2 / RD3 / RD4a / RD4b (the same text is in `delegation_progress/file_requests.md`, lines "row RD1")

| Subject | Statement |
|---|---|
| The retire unit (RD3) | one transaction: `UPDATE capture_devices SET retired_at = $now, retired_by = $operator` -> for a microphone `UPDATE capture_audio_inputs SET retired_at = <the same value>` (set `updated_by` / `updated_at` in THIS statement if wanted - after it the row is frozen) -> `SELECT dems_capture_credential_destroy($id)`; 1 = destroyed, 0 = there was none. The function answers 0 for a device in service |
| The guard | SQLSTATE `ZD001`; only `last_seen_at` and `enabled` of a retired registry row move; map it to `CAPTURE_DEVICE_RETIRED` if it ever reaches a route |
| The mapping | `CS/src/db/mapping/rows.ts` `captureDevicesToRows` states `retiredAt: null, retiredBy: null` today (RD1's compile fix, section 6): RD3 replaces it with the slice member and adds both to `RUNTIME_UPDATABLE_COLUMNS.captureDevices` (`changes.ts:73`) |
| Matching (RD4a / RD4b) | the database admits a second row with the reference / card input of a RETIRED row; the matcher must skip retired rows and the minting must still count them (design 4.4) |
| Not held by the database | a NEW credential INSERT for a retired id (op 89 must refuse it); a selector slot naming a retired id (ops 77-80 and the fence); the cross-table equality of the two `retired_at` values (the unit writes both; RD3's database test should hold them equal, as M16S-4 does for its own unit) |
| Pins | `[15, 'dbc-16']`; 34 files; next free number 0034; 501 columns; 233 CHECKs; 49 FKs |

## 5. Pins moved (each with the Edit tool)

**The pair `[14, 'dbc-15']` -> `[15, 'dbc-16']`: 18 files** (17 tests + the constants), line numbers after the change:

| File | Lines |
|---|---|
| `CS/src/db/schema/meta.ts` | 121, 123 |
| `CS/test/db/boot-checks.db.test.ts` | 110, 111, 118, 124 and 126 (the "database ahead" case: 16 / `dbc-17`), 131, 137 |
| `CS/test/db/migrate.db.test.ts` | 55, 68, 91, 92, 107 |
| `CS/test/db/commands.db.test.ts` | 95, 104, 106, 120, 160 |
| `CS/test/db/set4.db.test.ts` | 122, 129, 134, 183, 184, 337, 369, 387, 398, 401, 404 |
| `CS/src/capture/fence/__tests__/fence.db.test.ts` | 169, 171 |
| `CS/src/capture/fence/__tests__/development-session.db.test.ts` | 239, 241 |
| `CS/src/transcription/__tests__/snapshot-store.db.test.ts` | 3, 58, 60 |
| `CS/src/plugins/permission-guard/__tests__/session-holder.db.test.ts` | 67, 69 |
| `CS/src/db/seed/__tests__/seed.db.test.ts` | 113 |
| `CS/src/db/reset/__tests__/m4-sec-reset.db.test.ts` | 13, 407 |
| `CS/src/db/reset/__tests__/reset-failures.db.test.ts` | 437 |
| `CS/src/db/reset/__tests__/store-root.db.test.ts` | 123, 125 |
| `CS/src/sealing/__tests__/production-key-proof.db.test.ts` | 242, 244 |
| `CS/src/sealing/__tests__/last-resort.db.test.ts` | 132, 135 |
| `CS/src/sealing/__tests__/stt-states.db.test.ts` | 112, 115 |
| `CS/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts` | 276, 278, 279 |
| `CS/src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` | 157, 159 |

After the step `grep -rnE "\[14, 'dbc-15'\]|schema_version: 14, contract_revision|14 \(dbc-15\)|14 / dbc-15|14, contract dbc-15|\(14, 'dbc-15'\)|DB_SCHEMA_VERSION: 14" CS/src CS/test` finds the old pair only in `set15.db.test.ts` (HISTORY: the pair of set 15) and in the comments of `schema/index.ts` / `commands/migrations.ts` that describe set 15.

**Files 32 -> 34**: `migrations.ts` (tag list, comment); `contract-inventory.test.ts:287, 293, 294` (title, length, the hand-written list 18 -> 19); `migrate.db.test.ts:31, 32, 55`; `commands.db.test.ts:87, 117 (slice 36 -> 38), 121, 156, 161, 186, 188 (31 -> 33)`; `set4.db.test.ts:136, 140, 388, 389 (pending 24 -> 26), 393`.

**Inventory counts**: `contract-inventory.test.ts:55, 84-96`; `catalog.db.test.ts` (title and totals 170 / 207, `byType` `c: 233, f: 49, u: 15`, the functions list 7 -> 9 with the two new rows, the trigger list 3 -> 5, the "nine functions" title); `privileges.db.test.ts` (498 -> 501 in 8 places, the UPDATE lists of `capture_devices` +2 and `capture_audio_inputs` +1, the function list +2, a live call of the destroy function as `dems_app` answering 0, the guard function refused 42501, `public function` total 7 -> 9); `constraints.db.test.ts` (two refused rows for the CHECKs, one for the FK; 231 / 226 -> 233 / 228; 48 -> 49 FKs); `CS/src/db/fixtures/__tests__/bulk-fixture.db.test.ts:488-491` (233 CHECKs, 49 FKs) and its non-internal trigger list (+2, `A`); `set4.db.test.ts` (the last column of `capture_devices` after the full run is `retired_by`; 10 -> 12 updatable columns there).

**Static list**: `CS/test/static/search-path.test.ts` `ALLOWED` gains `src/db/migrations/0033_capture_device_retirement_privileges.sql` (the two functions pin their own path), as rows 46 / 112 added `0005` / `0007` (R2 of D44). DRIVER DECISION 4.

## 6. Compile fixes the new typed columns force (DRIVER DECISION 3)

`CaptureDeviceRow` is `captureDevices.$inferSelect`, so every object literal of that type must state the two new members. Typecheck after the schema edit: 9 errors, 8 of them this step's - `CS/src/db/fixtures/pipeline.ts` x7 (the bulk fixture's registry rows) and `CS/src/db/mapping/rows.ts:876` (`captureDevicesToRows`; the fix stands at `:895-896`). Fixed by `retiredAt: null, retiredBy: null` beside `lastSeenAt` / `adapterKind` (the in-service form; the mapping states the empty form for the columns the engine does not model, as it does for `mac` / `onvifUuid`). `RUNTIME_UPDATABLE_COLUMNS.captureDevices` (`changes.ts:73`) names neither, and both sides of a change set state NULL, so no engine write touches the columns. This also turned `seed.db.test.ts` ST-3 ("the stored rows are the rows toRows gives") green again. Claimed before writing (file_claims.md "row RD1, widened before writing").

## 7. Checks run, with their result lines

Database commands: command sandbox off, `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock`; throw-away databases of the test helper, dropped at teardown. PostgreSQL was neither started nor stopped by this row.

| # | Check | Result |
|---|---|---|
| 1 | Drift probe (generator) | `No schema changes, nothing to migrate` |
| 2 | Database-free: `contract-inventory.test.ts`, `commands.test.ts`, `create-statement.test.ts`, `set4-rules.test.ts` | `Test Files 4 passed (4)`, `Tests 126 passed (126)` |
| 3 | `set16.db.test.ts` alone, run 1 | `Tests 1 failed / 37 passed (38)` - MY OWN expectation (the generated FK clause "ON DELETE restrict ON UPDATE" matched a row-writing regex); fixed to test leading verbs |
| 4 | `npx vitest run --project db test/db --maxWorkers=2` (run 2 of set16, run 1 of the rest) | `Test Files 2 failed / 21 passed (23)`: 3 pins this step moves and had not yet moved (`privileges.db.test.ts:535` public functions 7, `set4.db.test.ts:168` last column, `:329` 10 updatable columns); set16 green |
| 5 | Those two files again | `Test Files 2 passed (2)`, `Tests 50 passed (50)` |
| 6 | Batch A: snapshot store, session holder, `src/db/seed`, `src/db/reset`, `src/db/fixtures`, the three sealing pin files | `Test Files 3 failed / 15 passed (18)`, `Tests 4 failed / 214 passed (218)`: seed ST-3 (mine, section 6), bulk fixture `:151` (RD2's audit type in flight), production-key-proof `:333`, `:368` (capture boot, in flight) |
| 7 | production-key-proof + `src/db/seed` again, after the compile fix | `Test Files 1 failed / 3 passed (4)`, `Tests 2 failed / 52 passed (54)`: seed green; the two production-key-proof cases still red, not schema |
| 8 | `connect.db.test.ts` + `routes.db.test.ts` (no process, no port: db lock only) | `Test Files 1 failed / 1 passed (2)`, `Tests 1 failed / 46 passed (47)`: `routes.db.test.ts:564` (row 88's registry change in flight); both version pins green |
| 9 | Typecheck `apps/core-server` (`npx tsc --noEmit -p .`) after the fix | 1 error: `src/capture/adapters/__tests__/real.test.ts:134` TS2322 (capture adapters, row 88 in flight). 0 errors from this step |
| 10 | Lint of the touched schema, mapping, fixture and test files (`npx oxlint`) | exit 0, no finding |
| 11 | Database-free `npx vitest run --project unit src/db test/db test/static --maxWorkers=2` | `Test Files 2 failed / 46 passed (48)`, `Tests 2 failed / 965 passed (967)`: BOTH MINE - `search-path.test.ts:94` (the new migration pins a path: section 5 "Static list") and `audit-protection.test.ts:78` (my set16 undo statements named a trigger drop: now the guard function is dropped with CASCADE, DRIVER DECISION 5) |
| 12 | `audit-protection.test.ts` + `search-path.test.ts` again | `Test Files 2 passed (2)`, `Tests 13 passed (13)` |
| 13 | `set16.db.test.ts` again (its undo changed) | `Test Files 1 passed (1)`, `Tests 38 passed (38)`; `0 remain with the run prefix` |
| 14 | Mutation scratch (section 8) | `Test Files 1 passed (1)`, `Tests 8 passed (8)` - every mutant observed |
| 15 | The two fence database files (`fence.db.test.ts`, `development-session.db.test.ts`; they boot a Core through `realBootFixture`, heavy-host lock) | see section 7.1 |

### 7.1 The fence pair

See the row file `delegation_progress/row_rd1.md` for the final state of this check (the heavy-host lock was held by another session's long worker run: `apps/capture-worker/test/e2e.py`, 26 minutes at the time; this row released its db-migrate lock rather than hold it idle while waiting, and stopped only its own waiting process).

### 7.2 Both migration paths (asked by the brief)

- FROM EMPTY to 15: M16S-3 "FROM EMPTY" migrates a new clone from nothing through 34 files and compares the catalog digest (columns, constraints, indexes, grants, functions, triggers) with the database stepped from 14: EQUAL. Also `migrate.db.test.ts` (34 files, `versionAfter` 15 / dbc-16) and `commands.db.test.ts` in run 4.
- FROM 14 to 15: M16S-1 builds a genuine (14, 'dbc-15') database with rows, M16S-3 applies exactly `0032` + `0033` (pending list, ledger, version), every stored row equal by digest, nine column-privilege lines new and none gone, object count unchanged; a second run applies nothing (MG-10). M16S-2: `0032` without `0033` is not writable by the runtime role, has no guard and no destroy path, and keeps the version.

## 8. Mutation honesty (each seen RED)

A scratch file of this row (`CS/test/db/zz-scratch-rd1.db.test.ts`, created, run once, removed; its 8 temporary migration folders removed) applied each mutant to a fresh set-16 clone and observed the case set16 asserts:

| Mutant | Observed under the mutant | set16 assertion that is RED under it |
|---|---|---|
| M-A `capture_devices_retired_check` dropped | an instant without an operator: `ok:1` | "BOTH OR NEITHER" (expects 23514) |
| M-B `capture_devices_retired_kind_check` dropped | the PoE switch retired: `ok:1` | "THE POE SWITCH IS NEVER RETIRED" |
| M-C `capture_devices_retired_by_fkey` dropped | an unknown operator: `ok:1` | "an operator the database does not know" (23503) |
| M-D ONVIF index not partial | adopting the retired camera again: `23505` | "ADOPTED AGAIN UNDER A NEW ID" |
| M-E card-input index not partial | the retired card input taken by MIC-04: `23505` | "THE MICROPHONE ... free for a NEW id" |
| M-F guard removed | edit, un-retire (camera and input), owner edit: all `ok:1` | the THE GUARD cases (ZD001) |
| M-G destroy without the retired test | credential of a camera in service destroyed: `1` | "THE DESTROY PATH REFUSES A DEVICE IN SERVICE" |
| M-H UPDATE grant revoked | retire as `dems_app`: `42501` | "THE RETIREMENT, in one unit" (and M16S-2 is the same state as a standing negative control) |

## 9. Rollback (M16S-6)

| Stage | What holds |
|---|---|
| Fails while applying | both files in one transaction on a (14, dbc-15) database with rows, a camera retired and its credential destroyed inside, `ROLLBACK`: catalog digest, row digests, version, ledger equal; no function, no trigger; columns answer 42703 |
| Applied, must be undone | `UNDO_SET_16` (kept in the test): a guard, the guard function dropped with CASCADE (its two triggers go with it), the destroy function, the two indexes back to their earlier forms (the card input a unique CONSTRAINT again), the CHECKs, FK and columns dropped. The catalog digest returns to that of (14, dbc-15) - functions and triggers included - and the code of set 15 passes B-3 |
| Precondition of the undo | NO row is retired: otherwise 55000 and nothing changes (measured). A database that ever retired a device cannot take this undo; a destroyed credential is never restored by any undo |

## 10. Driver decisions (for the controller to confirm)

1. **`capture_devices_retired_kind_check`**: the PoE switch is never retired, held by the database (the design names only the pair CHECK; 4.3 refuses POE at the operation). The simulator's built-in ids (`CAM-01/02`, `MIC-01/02`) are NOT refused by the database - an id rule there would be a value list of demo ids.
2. **The destroy function deletes only for an already-retired device** and answers a count (the design says "deletes the one credential row"): it cannot be used to wipe the credential of a camera in service. Order in the unit: retire first, then destroy.
3. **Compile fixes outside the schema folder** (`rows.ts` one literal, `pipeline.ts` seven literals; section 6), because rule 10 forbids leaving Core not compiling; claimed before writing; RD3 replaces the `rows.ts` value.
4. **One `ALLOWED` entry in `test/static/search-path.test.ts`** (a static-rule list without a named writer in wave 12), following the precedent of rows 46 / 112.
5. **The undo statements drop the guard function with CASCADE** instead of naming the two triggers, because the static rule T-AO-4 admits no trigger drop by name anywhere under the server; the catalog comparison shows that exactly the two guard triggers went.
6. **The guard compares row images** (`to_jsonb(NEW)` minus the two free columns): a column added later is frozen too, and an UPDATE that rewrites the stored values unchanged (an engine write of an unchanged row) is not refused.
7. **The guard's SQLSTATE `ZD001`** (a new class beside the audit's `ZA001` / `ZA002`), so that RD3 can name the refusal.
8. **The trigger function pins its search path** too (the invoker guards of `0002` do not): it costs nothing and closes an operator-lookup question.
9. **Names** `capture_devices_retired_check`, `capture_devices_retired_kind_check`, the function and trigger names: no document names them.

## 11. Doubles, and what stays unproven

No device, no network, no credential: every row is a fixture text; the "credential" is the 33-byte fixture blob. What the design calls the honest limit stays: a destroyed credential's ciphertext remains in dead tuples until VACUUM, in WAL and in backups (design 4.4) - not measurable here. Nothing in this row is a hardware check.

## 12. Edit-only statement

Kept. Every existing file was changed with the Edit tool after reading the lines; no scripted replace, no shell append, no whole-file rewrite. Where a pin text stood several times in ONE file and every occurrence was a pin (checked by grep first), the Edit tool's replace-all of that exact text was used: `privileges.db.test.ts` (498), `migrate.db.test.ts`, `commands.db.test.ts`, `set4.db.test.ts`, `snapshot-store.db.test.ts`, `routes.db.test.ts`, `connect.db.test.ts`, `pipeline.ts` (the three `adapterKind` endings, all inside the registry literal list). Generated by the repository's own tools: `0032`, the stub of `0033`, the two snapshots and the two journal entries (drizzle-kit), and `contract-inventory.json` (`contract-inventory.ts --write`). New files with Write: `set16.db.test.ts`, `contract-v15-delta.ts`, this record, the row file. The scratch file of section 8 was created and removed by this row; nothing else was deleted.

---
*Generated: 2026-10-14 13:45*
*Last Updated: 2026-10-14 13:45*
