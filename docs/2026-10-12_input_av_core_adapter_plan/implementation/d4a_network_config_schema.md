---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: D4a (the schema half of row D4: the form of an interface name, the allowed ONVIF ports)
date: 2026-10-14
agent: database-specialist (agent D4a, wave 12, track D)
narrative_tier: 2
source_decisions: decisions/decisions.md C114 (F-4), C116 (S2-02), C29
source_records: verification/120_m10_review.md finding F-4 (line 84); verification/120b_m10_review_second_pass.md finding S2-02 (line 65); verification/02_security.md S13-11 point 3; implementation/099_schema_set_b.md and implementation/d3_alias_removal_reason_further.md (the delivery pattern)
status: complete for the schema step (built and green on throw-away databases); the contract and Core halves are NOT built, by instruction (section 3)
branch: task4/input-av-core-port (nothing committed, nothing staged)
---

# Row D4a: the network settings in the database (migration set 15, schema version 13 -> 14, contract revision dbc-14 -> dbc-15)

Paths are relative to the repository root. `CS` = `apps/core-server`. Every figure was measured on this Mac on 2026-10-14 against the local PostgreSQL 18.4 on 127.0.0.1:4432, on throw-away databases of the test helper only; the commands and their result lines are in section 6.

## 1. The two changes

### 1.1 The form of an interface name - three patterns side by side

| Where | File:line | Pattern | Upper case |
|---|---|---|---|
| The alias helper (root) | `scripts/host/netalias/dems-core-netalias:163` (read only; the file as it stands in the tree, sha256 `3621e79c...`, row H5's) | `\A[A-Za-z0-9][A-Za-z0-9_.-]{0,14}\Z` | admitted |
| The Core's caller | `CS/src/capture/host-alias/caller.ts:256` | `/^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$/` | admitted |
| The Core's reader of the interface file | `CS/src/capture/host-alias/facts.ts:79` | `/^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$/` | admitted |
| The table, BEFORE | migration `0017:13` and `:34` | `'^[a-z0-9][a-z0-9._-]{0,14}$'` | REFUSED |
| The table, AFTER (chosen) | `CS/src/db/schema/capture.ts:107`; migration `0030` | `'^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$'` | admitted |

The chosen pattern is the helper's, character for character between the anchors, and no wider. The three engines agree on the anchors: `\A...\Z` (Python), `^...$` without the multi-line flag (JavaScript) and `^...$` in PostgreSQL's default mode all mean the whole text; a name followed by a line end is refused (measured: M15S-4, "a line end after the name"). `set15.db.test.ts` (M15S-7) reads the helper's pattern line from the script and holds it equal to the table's.

Two columns of set B hold an interface name, and both CHECKs move (one constant, `INTERFACE_NAME`): `capture_network_config.interface_name` (`capture_network_config_interface_name_check`) and `host_network_aliases.interface_name` (`host_network_aliases_interface_name_check`). `grep -n "interface_name\|interfaceName" CS/src/db/schema/*.ts` finds no third column.

### 1.2 The seventh setting

| Property | Value |
|---|---|
| Column | `capture_network_config.onvif_ports` (typed member `onvifPorts`, `CS/src/db/schema/capture.ts:505`) |
| Type | `jsonb`, NOT NULL, DEFAULT `'[80]'::jsonb` |
| Why jsonb | the repository's other bounded lists are jsonb with CHECKs (`capture_devices.profiles`, migration `0022`; `capture_network_config.factory_addresses`, `0017`); the contract's column types are a closed list of nine (rule TY-1) and an array type is not among them |
| Place | the LAST column of the table (11th): `ALTER TABLE ... ADD COLUMN` appends |
| Meaning of the order | the list is kept in the order written; the destination rule reads the FIRST element as the port of an address that names none (`CS/src/capture/destination-rule.ts:330`) |

The two CHECKs (the statement text of `0030`):

```
capture_network_config_onvif_ports_check
CASE WHEN jsonb_typeof("capture_network_config"."onvif_ports") = 'array' THEN jsonb_array_length("capture_network_config"."onvif_ports") BETWEEN 1 AND 8 AND NOT jsonb_path_exists("capture_network_config"."onvif_ports", 'strict $[*]?(@.type() != "number")') AND NOT jsonb_path_exists("capture_network_config"."onvif_ports", 'strict $[*]?(@ < 1 || @ > 65535)') AND NOT jsonb_path_exists("capture_network_config"."onvif_ports", 'strict $[*]?(@ != @.floor())') ELSE false END

capture_network_config_onvif_ports_distinct_check
CASE WHEN jsonb_typeof("capture_network_config"."onvif_ports") = 'array' THEN NOT ((P -> 0) = (P -> 1) OR (P -> 0) = (P -> 2) OR ... OR (P -> 6) = (P -> 7)) ELSE false END
   with P = "capture_network_config"."onvif_ports"; 28 comparisons, every two of the places 0 to 7
```

| Bound | Held by |
|---|---|
| at most 8 entries (the rule's `DESTINATION_MAX_PORTS`, `destination-rule.ts:111`) | `onvif_ports_check`, the length |
| at least 1 entry | `onvif_ports_check`, the length - DRIVER DECISION 1 |
| each a number | `onvif_ports_check`, first path |
| each 1 to 65535 | `onvif_ports_check`, second path |
| each whole | `onvif_ports_check`, third path |
| no two equal | `onvif_ports_distinct_check` |
| a list at all | both (CASE ... ELSE false), and NOT NULL |

The three paths print back from PostgreSQL 18.4 as they are written (measured before the generator ran), so the statement text and the catalog's text hold the same literals - the catalog test compares them.

## 2. What was built

| # | Item | Built as | Where |
|---|---|---|---|
| 1 | The pattern | `INTERFACE_NAME` widened, with its comment | `CS/src/db/schema/capture.ts:94-107` |
| 2 | The column and its CHECKs | `onvifPorts`, `ONVIF_PORTS_DEFAULT`, `ONVIF_PORTS_MAX`, the helper `anyTwoEqual` (statement text only) | `capture.ts:125-146`, `:505`, `:530-542` |
| 3 | Generated migration | `0030_network_config_onvif_ports.sql`, 7 statements: two `DROP CONSTRAINT`, `ADD COLUMN`, four `ADD CONSTRAINT`. sha256 `32f40e9d...0762b111`, 4361 bytes. Written by `npm run db:generate -w @dems/core-server -- --name=network_config_onvif_ports` (drizzle-kit), which also wrote `meta/0030_snapshot.json` and journal entry idx 30 (when 1791944690296). Not edited by hand | `CS/src/db/migrations/` |
| 4 | Hand-written file | `0031_network_config_onvif_ports_privileges.sql`, 2 statements: the grant and the version step. sha256 `fed56c86...595e0c5c`, 2057 bytes. Stub by the generator (`-- --custom --name=network_config_onvif_ports_privileges`: the stub, `meta/0031_snapshot.json`, journal idx 31, when 1791944690680); content by hand with the Edit tool | same |
| 5 | Grant | ONE: `GRANT UPDATE (onvif_ports) ON capture_network_config TO dems_app;`. SELECT and INSERT are the table-level grants of `0018` and cover a new column; UPDATE there is a column list. M15S-2 shows the need: with `0031` left out the runtime role answers 42501 | `0031` |
| 6 | Version step | `UPDATE public.schema_meta SET schema_version = 14, contract_revision = 'dbc-15' WHERE singleton;`; constants `CS/src/db/schema/meta.ts:110,112`; tag list `CS/src/db/commands/migrations.ts:91-92`; the paragraph "SCHEMA VERSION 14" in `CS/src/db/schema/index.ts:108` | |
| 7 | Contract delta, inventory | new `CS/test/db/contract-v14-delta.ts`; composer `contract-inventory.ts` (import, the v14 block, `V14.changedTables`, the `source` text - the contract document's line: a closed contract document is never edited, ruling D44 R1); `contract-inventory.json` regenerated by its own command (`node --import tsx test/db/contract-inventory.ts --write`: 48 tables, 498 columns, 231 CHECKs) | |
| 8 | Per-set test | new `CS/test/db/set15.db.test.ts`, groups M15S-1 to M15S-7, 66 tests | |

Totals: 48 tables, **498 columns (497)**, **231 CHECKs (229)**, 48 foreign keys, 48 primary keys, 16 unique constraints, 7 unique indexes, 24 indexes, 48 value sets. **32 migration files (30); 18 hand-written (17).** No value set changed.

**No stored row is rewritten by a statement.** The existing settings row keeps its interface name and every other value and gains `[80]` through the column's default (M15S-3). Alias rows are untouched.

**Simulated mode is unchanged**: no file of the simulator, the seed or the network module was touched; the seed writes no settings row (`test/support/seed.ts:98`, minimum 0).

## 3. What the step does NOT hold

| Item | Why |
|---|---|
| The network module reading and writing the list (`CS/src/modules/capture-config/network/*`: `store.ts:22-29,48,125`, `facts.ts:155-160`) | another agent owns the module in this wave; section 4 |
| `allowedPorts` set in the destination rule's context from the stored list | the same follow-up; `destination-rule.ts` was read only |
| The contract of operations 101 / 102, `CAPTURE_INTERFACE_NAME_PATTERN` (`packages/shared/src/api/capture-commissioning.ts:108`, still lower case), `openapi.json`, the settings screen | `packages/shared` has its own writer; section 4 |
| The two comments "the CHECK of the stored column" (`caller.ts:255`, `facts.ts:78`) | they are TRUE again after this step; not edited (not this row's files) |
| The demo reset's kept-table handling of `capture_network_config` | a queued row, by instruction. Until then a reset empties the table, and with it a stored port list |
| A step on the demo database, a lane database or `dems_test_m12_row232` | decision C29. Throw-away databases only |

So F-4 and S2-02 are NOT closed by this row: until the follow-up, operation 102 still refuses a name with a capital at the contract (422) and the rule still runs on port 80 alone. What changed is that the database no longer stands in the way.

## 4. For the follow-up row

| Subject | Exact statement |
|---|---|
| Column | `capture_network_config.onvif_ports`, `jsonb`, NOT NULL, DEFAULT `'[80]'::jsonb`; typed `captureNetworkConfig.onvifPorts: number[]` (`CS/src/db/schema/capture.ts:505`). The runtime role may SELECT, INSERT and UPDATE it |
| CHECK 1 | `capture_network_config_onvif_ports_check`: a JSON array of 1 to 8 elements, each a JSON number, each 1..65535, each whole (text in section 1.2). SQLSTATE 23514 with this constraint name |
| CHECK 2 | `capture_network_config_onvif_ports_distinct_check`: no two elements equal (`80` and `80.0` are equal to it). SQLSTATE 23514 with this constraint name |
| NULL | refused, 23502 |
| Interface-name pattern | `^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$` in both tables (`capture_network_config_interface_name_check`, NULL admitted; `host_network_aliases_interface_name_check`) |
| Writing the list | send JSON text of whole numbers (`JSON.stringify([80, 8080])` cast to jsonb), in the order the technician gave: the first is the default port of the rule. The module should refuse before the database does, by the same bounds, and name the reason; the CHECKs are the last line |
| Reading the list | the driver returns a JavaScript array of numbers; a value such as `80.0` would read as `80` |
| The contract of operations 101 / 102 must now state | a seventh member (suggested name `onvifPorts`): an array of integers, `minItems` 1, `maxItems` 8, each `minimum` 1 and `maximum` 65535, `uniqueItems`, default `[80]`; the first element is the port used when a stored address names none. And `CAPTURE_INTERFACE_NAME_PATTERN` becomes `/^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$/` with its comment ("lower-case letters" is no longer true) |
| The network module must now state | `NetworkConfigValues` and the SELECT / INSERT / UPDATE column lists of `network/store.ts` gain the column; `networkFactsOf` (`network/facts.ts:155-160`) hands the stored list to the rule's context as `allowedPorts`; the audit entry of a settings change names the member; a row read from a database holds `[80]` unless changed |
| Tests that assert on a context production could not build | `capture-discovery/__tests__/readdress.test.ts:193` (the 8080 case, T-5 of review 120b) becomes buildable once the module hands the list over |
| S2-05 of review 120b | goes live the day a port list other than `[80]` is stored (`READDRESS_ADDRESS_TAKEN` compares stored text) |
| Pins | `[14, 'dbc-15']`; 32 files; next free number 0032 |

## 5. Pins moved (each with the Edit tool; re-measured by the runs of section 6)

**The pair `[13, 'dbc-14']` -> `[14, 'dbc-15']`**, 18 files (file:line after the change):

| File | Lines |
|---|---|
| `CS/src/db/schema/meta.ts` | 110, 112 |
| `CS/test/db/boot-checks.db.test.ts` | 110, 111, 118, 124, 126 (the "database ahead" case: 15 / `dbc-16`), 131, 137, 139 |
| `CS/test/db/migrate.db.test.ts` | 55, 68, 91, 92, 107 |
| `CS/test/db/commands.db.test.ts` | 95, 104, 106, 120, 160 |
| `CS/test/db/set4.db.test.ts` | 122, 129, 134, 181, 182, 334, 366, 384, 395, 398, 401 |
| `CS/src/capture/fence/__tests__/fence.db.test.ts` | 168, 170 |
| `CS/src/capture/fence/__tests__/development-session.db.test.ts` | 239, 241 |
| `CS/src/transcription/__tests__/snapshot-store.db.test.ts` | 3, 58, 60 |
| `CS/src/plugins/permission-guard/__tests__/session-holder.db.test.ts` | 67, 69 |
| `CS/src/db/seed/__tests__/seed.db.test.ts` | 113 |
| `CS/src/db/reset/__tests__/m4-sec-reset.db.test.ts` | 13, 406 |
| `CS/src/db/reset/__tests__/reset-failures.db.test.ts` | 437 |
| `CS/src/db/reset/__tests__/store-root.db.test.ts` | 123, 125 |
| `CS/src/sealing/__tests__/production-key-proof.db.test.ts` | 242, 244 |
| `CS/src/sealing/__tests__/last-resort.db.test.ts` | 132, 135 |
| `CS/src/sealing/__tests__/stt-states.db.test.ts` | 112, 115 |
| `CS/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts` | 276, 278, 279 |
| `CS/src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` | 157, 159 |

After the step `grep -rnE "\[13, 'dbc-14'\]|schema_version: 13, contract_revision|schemaVersion: 13, contractRevision: 'dbc-14'|13 \(dbc-14\)|13 / dbc-14|13, contract dbc-14" CS/src CS/test` finds the old pair only in `set14.db.test.ts` and `set15.db.test.ts`, where it is HISTORY (the pair of set 14).

**Migration files 30 -> 32**: `CS/src/db/commands/migrations.ts:91-92` (and the comment `:55-58`); `contract-inventory.test.ts:283 (title: thirty-two, eighteen hand-written), 289, 290 (the hand-written list 17 -> 18)`; `migrate.db.test.ts:31, 32, 55`; `commands.db.test.ts:87, 117 (slice 34 -> 36), 121, 156, 161, 186, 188 (29 -> 31)`; `set4.db.test.ts:129, 136, 140, 385, 386 (pending 22 -> 24), 390`.

**Columns 497 -> 498**: `contract-inventory.test.ts:55, 84`; `catalog.db.test.ts:170, 206`; `privileges.db.test.ts:6, 227, 235, 239, 285, 293, 316, 338`, and the UPDATE list of the table `:155` (9 -> 10 columns).

**Named CHECKs 229 -> 231**: `contract-inventory.test.ts:55, 90`; `catalog.db.test.ts:170, 206, 250`; `constraints.db.test.ts:357, 360, 361 (direct 224 -> 226)` with two refused rows added `:302-303`; `CS/src/db/fixtures/__tests__/bulk-fixture.db.test.ts:488, 490`.

Unchanged: tables, keys, indexes, value sets, permissions, audit types, operations. `set14.db.test.ts` needed no edit: it already stops at its own set (`LATER`, `isThisCode`). `test/db/fixtures.ts` needed no edit: the fixture row leaves the column to its default.

### FOR THE AGENTS IN FLIGHT AND THE INTEGRATION PASS

A test written against the old value moves to exactly:

```
expect([Number(meta.schema_version), meta.contract_revision]).toEqual([14, 'dbc-15']);
```

or `{ schema_version: 14, contract_revision: 'dbc-15' }`, title text `schema version 14, contract dbc-15`; 32 migration files; the next free migration number is 0032; 498 columns; 231 CHECKs. Better: `DB_SCHEMA_VERSION` / `DB_CONTRACT_REVISION` of `CS/src/db/schema/meta.ts`. The same text stands in `delegation_progress/file_requests.md` (line "row D4a").

## 6. Checks run, with their result lines

Database commands: command sandbox off, `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock` (and `.locks/heavy-host.lock` inside it, taken second, for the batch that boots a Core), throw-away databases dropped at teardown. PostgreSQL was not started, stopped, initialised or reset by this row: at the first attempt (09:2x) nothing answered on 127.0.0.1:4432 (`pg:status: stopped`); the row went on with the database-free work and did not start it; the controller started it and said so, and every database check below was run after that. No `db:migrate` on any database.

| # | Check | Result |
|---|---|---|
| 0 | The expressions, before the generator ran: 30 values through both CASE expressions, the three paths printed back, 13 names through the pattern (a scratch test file of this row on a throw-away database, deleted afterwards) | every value as expected; the three paths print back as written |
| 1 | Drift probe: `npm run db:generate -w @dems/core-server -- --name=drift_probe` | `No schema changes, nothing to migrate` (no file written) |
| 2 | `set15.db.test.ts` alone | run 1: `Tests 2 failed | 64 passed (66)` - MY OWN, both in the test's expectations (the catalog view states the table-level INSERT and SELECT for the new column too; a hand-written file is one chunk). Run 2: `Test Files 1 passed (1)`, `Tests 66 passed (66)`; `0 remain with the run prefix` |
| 3 | `npx vitest run --project db test/db --maxWorkers=2` (one run) | `Test Files 22 passed (22)`, `Tests 998 passed (998)`; `0 remain with the run prefix` |
| 4 | Batch A: snapshot store, session holder, `src/db/seed`, `src/db/reset`, `src/db/fixtures`, the three sealing pin files, and THE NETWORK MODULE'S DATABASE TESTS (`src/modules/capture-config/network`) | `Test Files 19 passed (19)`, `Tests 234 passed (234)`; `0 remain with the run prefix`. The module does not know the column and passes with it defaulted |
| 5 | Batch B under both locks: the two fence files, camera connect, sound-card routes | `Test Files 4 passed (4)`, `Tests 101 passed (101)`; `0 remain with the run prefix` |
| 6 | Database-free: `npx vitest run --project unit test/db test/static src/db --maxWorkers=2` | `Test Files 48 passed (48)`, `Tests 964 passed (964)` |
| 7 | The same with `src/modules/capture-config/network src/capture/host-alias` added | `Test Files 1 failed | 50 passed (51)`, `Tests 8 failed | 1108 passed (1116)` - RED 1, below |
| 8 | Typecheck `apps/core-server` (`npx tsc --noEmit`) | exit 0, 0 errors |
| 9 | Lint of the 15 touched schema and test/db files (`npx oxlint`) | no finding |

**What M15S measured.** M15S-1: on a genuine (13, dbc-14) database that holds the settings row and two aliases, `enP2p1s0` is refused 23514 in both tables, the column answers 42703, this code is refused by B-3 naming `db:migrate`, the code of set 14 passes. M15S-2 (negative control): with `0031` left out the column and the widened forms are there, the runtime role cannot write the list (42501) and the version stays. M15S-3 (APPLY): exactly two files; the existing row keeps `eth1`, its revision, its lifetime and its factory list, and holds `[80]`; no alias row moved; the count of objects did not move; the only new privilege lines are those of the new column; four CHECKs validated; 8 -> 10 CHECKs on the settings, 8 on the aliases; a second run applies nothing; a first-use row inserted by the runtime role starts with `[80]`. M15S-4, as `dems_app`: seven names of the helper's form accepted, eleven outside it refused in BOTH tables; five lists inside the bounds accepted (the order kept); twenty-one planted lists refused 23514 by the named CHECK - among them NINE PORTS, PORT 0, 65536, A PORT TWICE - with the row unchanged after each; NULL refused 23502; every one of the 28 pairs of places refused. M15S-5: B-3 in both directions. M15S-7: the files, statement by statement, and the helper's pattern read from the script.

**Mutation honesty.** No separate mutant of the migration was run. What stands in for it: M15S-1 is the database WITHOUT the set (the name is refused, the column is absent) and M15S-2 the set WITHOUT its second file (the write is refused); every refusal case names the constraint that must answer, so a list refused by the wrong rule is red; check 0 saw each expression answer true and false. The 28-pair case would be red on a pair left out of the generated text.

**RED 1 (not this step's; owner: the agent editing `CS/src/capture/host-alias/lifecycle.ts` and `journal.ts`, both modified in the tree by another row - the helper's `del` change of row H5 / finding F-1 by its subject).** `src/capture/host-alias/__tests__/lifecycle.test.ts`: 8 cases "..., the address not shown: ONE intent and ONE result HOST_ALIAS_REMOVE_FAILED { HELPER_NOT_MARKED }" and "the boot sweep WITHOUT a row". The count moved between two runs minutes apart (20+, then 8): the file is being written. Nothing of it reads the schema.

The seed stays valid (`seed.db.test.ts` and the reset files pass in batch A on the seeded template). Simulated mode is unchanged (`routes.db.test.ts:157`, "the capture operation is SIMULATED", passes in batch B).

## 7. Rollback (`set15.db.test.ts`, M15S-6)

| Stage | What holds | Proof |
|---|---|---|
| Fails while applying | one transaction: nothing remains | both files in a transaction on a (13, dbc-14) database with rows, the name and a list written inside, `ROLLBACK`; catalog digest, row digests, version and ledger equal before and after; the column answers 42703 again |
| Merged, not applied to a database that matters | revert the one commit; a development database is rebuilt by `db:reset` | the change set of section 8 |
| Applied, and must be undone | a NEW forward set carrying `UNDO_SET_15` (kept in the test): a guard, drop the column (its two CHECKs and its grant go with it), drop and re-add the two name CHECKs with the lower-case form, step the version | the statements return the catalog digest to that of (13, dbc-14), every other stored value is what it was, the code of set 14 passes B-3 again, a name with a capital is refused again |
| Precondition of the undo | no stored interface name outside the earlier form, in the settings row or in ANY alias row, open or closed | two cases: the guard answers 55000 and nothing changes. An alias row is history and is not rewritten, so a database that ever held an alias on a port named with a capital cannot take this undo |
| What an undo loses | the stored port list: the rule is back at port 80 alone. The code that reads the column goes back in the same release | stated in the comment of `UNDO_SET_15` |

## 8. Can the step be committed alone?

**Yes, as ONE commit on top of head 1fbeada7**: the step's journal entries, constants and pins follow set 14's, which is committed.

(a) NEW, only this step: `CS/src/db/migrations/0030_network_config_onvif_ports.sql`, `0031_network_config_onvif_ports_privileges.sql`, `meta/0030_snapshot.json`, `meta/0031_snapshot.json`; `CS/test/db/contract-v14-delta.ts`, `CS/test/db/set15.db.test.ts`; `docs/.../implementation/d4a_network_config_schema.md`, `delegation_progress/row_d4a.md`.

(b) CHANGED, by this step only (no other row's line seen in them at the time of writing): `CS/src/db/migrations/meta/_journal.json` (idx 30, 31); `CS/src/db/schema/capture.ts`, `meta.ts`, `index.ts`; `CS/src/db/commands/migrations.ts`; `CS/test/db/contract-inventory.ts`, `.json`, `.test.ts`, `catalog.db.test.ts`, `constraints.db.test.ts`, `privileges.db.test.ts`, `boot-checks.db.test.ts`, `migrate.db.test.ts`, `commands.db.test.ts`, `set4.db.test.ts`; pin lines in the thirteen outside files of section 5 and in `CS/src/db/fixtures/__tests__/bulk-fixture.db.test.ts`.

(c) Shared documents, one line each: `delegation_progress/file_claims.md`, `file_requests.md`.

The code and the database must go together: B-3 refuses either side alone.

## 9. Driver decisions (for the controller to confirm)

1. **AT LEAST ONE PORT.** The brief bounds the list above (8); the database also refuses the empty list. The rule refuses it (`destination-rule.ts:329`, `list.length === 0` -> `PORT_LIST_INVALID`), and an empty list has no first element for an address that names no port. Conservative: a state the rule cannot use is not storable.
2. **Two CHECKs, not one**, so that a refusal names its rule: the form and size, and the distinctness. Counts +2.
3. **Distinctness in plain SQL (28 comparisons), not a path**: a CHECK admits no sub-select; the SQL form has no behaviour that depends on a path mode, and it treats `80` and `80.0` as one port. The text is long (the generated file is 4361 bytes).
4. **A whole number is judged by value**: `80.0` is accepted (and reads back as 80). The module should write integers.
5. **The column's name `onvif_ports`**: no document names it; the rule's member is `allowedPorts`, the decision says "allowed ONVIF ports".
6. **The undo does not rewrite a stored name** and is refused while one does not fit the earlier form (section 7).
7. **M15S-7 reads the helper script** (read only) to hold the two patterns equal. If the helper's pattern ever moves, that test turns red and names the schema step that must follow - intended.

## 10. Doubles, and what stays unproven

No device, no host interface, no helper call: every name and address is a fixture text. Unproven until hardware: that the real camera port's name fits the helper's form at all (`9A/H-05`, now for both cases of letters), and which ONVIF port the user's cameras answer on (finding S2-02; the stored list makes any of them reachable only after the follow-up row).

## 11. Edit-only statement

Kept. Every existing file was changed with the Edit tool after reading the lines; no scripted replace, no shell append. Where a pin text stood several times in ONE file and every occurrence was a pin (checked by grep first), the Edit tool's replace-all of that exact text was used: `migrate.db.test.ts`, `commands.db.test.ts`, `set4.db.test.ts`, `privileges.db.test.ts` (the number 497), `snapshot-store.db.test.ts`, `routes.db.test.ts`, `connect.db.test.ts`. Generated by the repository's own tools: `0030`, the stub of `0031`, the two snapshots and the two journal entries (`drizzle-kit generate`), and `contract-inventory.json` (`contract-inventory.ts --write`). New files with Write. One scratch test file of this row (`CS/test/db/zz-scratch-d4a.db.test.ts`) was created and removed by this row; nothing else was deleted.

---
*Generated: 2026-10-14 10:05*
*Last Updated: 2026-10-14 10:05*
