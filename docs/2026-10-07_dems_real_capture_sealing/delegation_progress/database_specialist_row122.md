---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: database-specialist
blueprint_row: 122
type: database contract delta (record of the row)
tier: 3 (working record of a Tier 1 edit)
status: needs-review
reason_for_needs_review: the delta is complete, but three of its decisions cross a sibling spec row (D-DB-13 against row 123's device ids; the matching key against row 121; "migration 0008" is two files) and one finding reaches the user's requirement (O-3). They are for the controller and the spec gate row 128
file_edited: masterplan/04_database_contract.md (894 -> 1486 lines)
confidence: HIGH for the CHECK inventory, the grants, the pins and the arithmetic (each read from the migration SQL, the typed schema and the tests); HIGH for the state of dems_demo (one read-only command); MEDIUM for the lanes (not read); MEDIUM for the generated text of 0008 (plan form, the generator decides formatting)
last_updated: 2026-10-09
---

# Row 122 — database contract delta for R-9, R-10, R-11 (record)

## 1. Verdict

**Schema change: YES.** Migration set 4 = `0008_capture_sources.sql` (generated) +
`0009_capture_sources_privileges.sql` (hand-written). Schema version 2 -> 3, contract revision
`dbc-3` -> `dbc-4`. Row 129 is needed, row 130 is needed.

Nothing was written under `apps/core-server/`. No migration file exists, no SQL of the delta was
run, no test was edited, migrations `0004`-`0007` are untouched. The one file edited is
`masterplan/04_database_contract.md`: a new section N (lines 940-1483) and eight short pointers in
the earlier sections.

| Question of the row | Answer | Section |
|---|---|---|
| 1. Adapter kind / source class storage | **change**: column `capture_devices.adapter_kind`, closed set of five, `NOT NULL DEFAULT 'FAKE'`, two CHECKs, no UPDATE grant. The source class is derived, not stored | N.2 |
| 2. Per-session record of each slot's source | **change**: new INSERT-only table `session_capture_sources` (T-41), four rows per session, written with the transition to `RECORDING`. Plus `evidence_items.development_sources boolean NULL` for the list label (row 124 hand-over (b)) | N.3, N.4 |
| 3. Discovery candidates | **no schema change**: Core memory only, confirmed. One index added for adoption: partial unique `capture_devices_onvif_uuid_key` | N.5 |
| 4. Audit / alert storage | **no schema change**: no CHECK lists audit types; categories `DEVICE` and `SECURITY` exist; `SYSTEM` and `CAPTURE_FAULT` are admitted by `alerts_kind_check`; all detail keys pass the flat and denied-key CHECKs | N.6 |
| 5. Credential rows | **no schema change**: table, grants and reveal function cover operation 96. One finding for the sealer (F-122-2) | N.7 |
| 6. Migration | set 4 specified statement by statement, with matrix, totals, down-path policy and order of application | N.8-N.12 |
| 7. Hand-over | rows 129, 130, 132, 142, 136, 61, 65, 66, 71, 82, 83, 141, 84, 127, 128 | N.14 |

## 2. Migration content, short

`0008` (generated):

- `CREATE TABLE session_capture_sources` (`session_id`, `slot`, `device_id`, `adapter_kind`,
  `recorded_at`; PK (`session_id`, `slot`); 4 CHECKs; FK `device_id` -> `capture_devices.id`).
- `ALTER TABLE capture_devices ADD COLUMN adapter_kind text DEFAULT 'FAKE' NOT NULL` +
  `capture_devices_adapter_kind_check` + `capture_devices_adapter_pairing_check`.
- `CREATE UNIQUE INDEX capture_devices_onvif_uuid_key ... WHERE onvif_uuid IS NOT NULL`.
- `ALTER TABLE evidence_items ADD COLUMN development_sources boolean`.

`0009` (hand-written, four statements): `GRANT SELECT, INSERT ON session_capture_sources TO
dems_app`; two boundary `REVOKE UPDATE (...)` no-ops; `UPDATE schema_meta SET schema_version = 3,
contract_revision = 'dbc-4'`. **No blanket `GRANT SELECT ON ALL TABLES`** — it would re-open the
SELECT carve-outs of `capture_device_credentials` and of `stt_config`.

New totals: 41 tables, 426 columns, 172 named CHECKs, 40 foreign keys, 41 primary keys, 15 UNIQUE,
4 unique indexes, 23 indexes, 44 value sets, 10 migration files (6 hand-written), kept set 12
(unchanged), seeded devices 5 (unchanged), fault kinds 14 (unchanged).

Existing rows: the five device rows of each database receive `FAKE` by the column default, which
is what the new seed writes; the 13 evidence items read NULL ("not recorded"); the new table is
empty. **No reseed and no reset is needed after the migration.**

## 3. Evidence gathered

One command against the database, read-only, sandbox disabled as allowed, no credential file read
or printed:

```
$ npm run db:status -w @dems/core-server -- --database dems_demo      (2026-10-09)
database         dems_demo on PostgreSQL 18.4
schema version   2; contract revision dbc-3; this code expects 2 (dbc-3)
migrations       8 file(s); ledger matches
row counts       40 table(s)
  active_session           0
  capture_config           1
  capture_device_credentials 0
  capture_devices          5
  evidence_items           13
  evidence_tracks          52
  recording_fragments      0
  sealing_jobs             0
  session_audio_intervals  0
db:status: OK: dems_demo is at the schema version this code expects and the ledger matches the files.
```

(abridged to the lines the delta uses; the eight ledger lines all read "applied", file hash =
stored hash.) The three lane databases were **not** read: the row allowed this command for
`dems_demo` only (assumption A-122-1, checked by row 130 at its step 1).

Code and SQL read (no edit): `apps/core-server/src/db/schema/{capture,recording,sessions,meta,
value-sets,boot-checks}.ts`; `migrations/0001_tables.sql:194-199,216-220,260,382-383`,
`0003_privileges.sql:20-24,45,47`, `0004_capture.sql:29,34-52,176-228`,
`0005_capture_privileges.sql` (whole), `0006`, `0007` (whole), `meta/_journal.json`;
`seed/seed.ts:127-185`; `store/store.ts:125-170`; `reset/kept-tables.ts:40-95`;
`mapping/rows.ts:684-760`; `commands/migrations.ts:30-45`; `test/db/contract-inventory.test.ts`,
`contract-inventory.ts`, `contract-v2-delta.ts` (head), and a search of every test under
`test/db`, `src/db/**/__tests__` for the counts and version strings.

Check after the edit: the two pinned strings are still in the file, on their old lines' text
(`grep -n`: line 67 the "Table count" row, line 505 the B.13 heading); a `diff` against the
pre-edit copy (session scratch directory, `04_pre_row122.md`) shows exactly 2 removed lines — the
front-matter `last_updated` and the footer, both replaced by an extended version of themselves;
every other change is an added line. Table column counts in section N: 0 inconsistent rows
(script). Marks `PE-122-01`..`PE-122-15` each occur at least once.

## 4. Pins

The tests read this document for two strings only, both unchanged:
`test/db/contract-inventory.test.ts:67` (the "Table count" row of §0.1) and `:70` (the heading of
§B.13). **No pin was broken by this edit; no test was edited.**

Pins on code and catalog that must move in row 129's commit are listed with file:line and the new
value in `04_database_contract.md` N.12 (15 groups): the composed counts in
`contract-inventory.test.ts` (40 / 419 / 40 / 39 / 15 / 3 / 23 / 166 -> 41 / 426 / 41 / 40 / 15 /
4 / 23 / 172), `T-01..T-40` -> `T-41`, value sets 42 -> 44, "eight files" -> ten and the
hand-written list, `contract-v2-delta.ts` + `contract-inventory.json`, the catalog counts
(`{ i: 81, r: 40 }` -> `{ i: 83, r: 41 }`), the constraint and privilege lists (INSERT on 24 -> 25
tables), every `2` / `dbc-3` version string (boot-checks, commands, migrate, seed, reset), "24 of
40 table(s)" -> "24 of 41", `BULK_MINIMUMS` 40 -> 41. Two pins stay: `KEPT_TABLE_NAMES` (12) and
`BOOT_CHECK_IDS` (`B-2`..`B-9`). Note: `test/db/boot-checks.db.test.ts:126` already uses
`3 (dbc-4)` as its "newer database" example; it becomes `4 (dbc-5)`.

## 5. Decisions for the controller to record

| ID | Decision | Needs a ruling? |
|---|---|---|
| D-DB-11 | Adapter kind = column `capture_devices.adapter_kind`; closed set `ONVIF_RTSP`, `USB_AUDIO`, `SNMP_POE`, `FAKE`, `LOCAL_DEVICE` (row 123's proposed names, fixed here); pairing CHECK to `kind`; no UPDATE grant; source class never stored | no |
| D-DB-12 | `DEFAULT 'FAKE'`, permanent (true for every existing row; errs to the safe side) | no |
| D-DB-13 | A device never changes its adapter kind; the local camera and microphone are rows of their own with the next free ids; the seeded built-ins are `FAKE` | **yes — conflicts with row 123** (§A.1.1 "Development slots" gives the local devices the ids `CAM-01` / `MIC-01`). If the ids of row 123 stand, the delta changes by one grant line and loses immutability; no DDL changes |
| D-DB-14 | Session-start record = INSERT-only table `session_capture_sources` (T-41) | no (answers row 124 hand-over (a) and assumption A-3) |
| D-DB-15 | Candidates never stored; matching key `onvif_uuid`, else the **whole** `address`; partial unique index on `onvif_uuid` | **yes — diverges from row 121** ("host of `address`"): the two seeded cameras share the host `127.0.0.1` |
| D-DB-16 | `evidence_items.development_sources boolean NULL`; nothing on `evidence_tracks` | no (answers row 124 hand-over (b)) |
| D-DB-17 | Two files, version step to `(3, 'dbc-4')` | **wording**: blueprint rows 129, 130, 132, 136 say "migration `0008`"; it is the set `0008` + `0009` |
| D-DB-18 | No database boot check B-10; the fence is a capture boot check (CS-22, rows 61 / 136) reading query Q-SRC; assigned development sources refused in production, unassigned ones ignored, all stored kinds inert in `SIMULATED` | no |

Open points (N.15), in order of weight:

1. **O-3 — no path from the demo seed to a production recording.** The seed assigns four `FAKE`
   devices, which a production boot refuses (R-11 AC-1 (a)); in development mode an adopted real
   camera cannot be assigned (row 123 RG-3). On this Mac a real camera can be found, tested and
   adopted but not recorded until a production site seed exists (class C). R-9's "only then
   assignable in the R-1 selector" is not reachable in this phase. Likely for the user.
2. **O-2 — row 123 §A.1.2 row 1** must say that stored kinds are inert in `SIMULATED` whatever
   they are; after `0008` all four databases hold assigned `FAKE` devices and must keep booting.
3. **O-7 — coordination of the version step.** After row 130, code without row 129's commit is
   refused at boot (B-3) on every one of the four databases, and the reverse. With agents working
   in parallel on the lanes this needs one moment chosen by the controller.
4. **O-5 — reset guard.** A package sealed in development mode is `integrity_source = 'REAL'` and
   blocks every later reset of that database (OD-19, a user-approved answer). The new column would
   allow an exemption; not changed here.
5. **F-122-2 — sealer.** `capture_device_credentials_secret_check` asks for 33 bytes of
   ciphertext; a camera password under 17 bytes fails `23514` unless row 84's sealer frames the
   plaintext. No schema change; rows 84, 126, 127.
6. **O-8** — whether the local camera enters as an adopted candidate (row 121 A-2) or by row 136's
   registration; the microphone has only the second way.
7. **A-122-1** — the lanes were not read.

## 6. Erratum rows for `masterplan/11_audit_errata.md` (not edited; for the controller to place)

Format of its §5.1. Line numbers are after the edit.

| ID | spec file:line | old text (abridged) | new text | source file:line | decision |
|---|---|---|---|---|---|
| **PE-122-01** | `masterplan/04_database_contract.md:14,22,33-42,1486` | front matter `contract_revision: dbc-3` only; no note on a later delta | `pending_revision: dbc-4, schema_version 3`; note under the title: sections 0-M are dbc-3, section N is the dbc-4 delta, verdict "schema change — yes", figures of 0-M not restated; footer | `identification/02_structured.md:374` | D73, D78, D80, D81 |
| **PE-122-02** | `04:964-976` (N.1, new) | §B.13 "the DDL joins 0004 (table) and 0005 (privileges)" | as built: `0006` + `0007`; version `(2, 'dbc-3')`; `dems_demo` read 2026-10-09; composed counts 40 / 419 / 166 / 39; next free numbers `0008`, `0009` | `apps/core-server/src/db/migrations/meta/_journal.json`; `0007_stt_config_privileges.sql:61` | D24 (as built by row 112) |
| **PE-122-03** | `04:253-259`, `04:978-1058` (N.2) | `capture_devices`: 12 columns; "discovery only adds/updates" | 13th column `adapter_kind` (closed set of five, `DEFAULT 'FAKE'`, no UPDATE grant), two CHECKs; options (a)/(b)/(c); writers table; a search adds nothing | `masterplan/03_api_contract.md` §2.6 "Device shapes"; `masterplan/05_capture_architecture_spec.md` §A.1.1 | D73, D80(9), D81; D-DB-11..13 |
| **PE-122-04** | `04:358-360`, `04:1060-1112` (N.3) | (no session-start record) | new table `session_capture_sources` (T-41), INSERT-only, four rows per session; rules MR-S1..S5; `session_audio_intervals` gets no column | `masterplan/06_evidence_package_spec.md` §B.12 rule 3, §E.6; `delegation_progress/data_analyst_row124.md` §7 | D81; D-DB-14 |
| **PE-122-05** | `04:481-485`, `04:1114-1130` (N.4) | `evidence_items`: three v2 sealed columns | fourth sealed column `development_sources boolean NULL` (copy of manifest field 126; NULL = not recorded); nothing on `evidence_tracks` | `delegation_progress/data_analyst_row124.md` §7 (b); `masterplan/01_specs.md` R-11 AC-6 | D78(2), D81; D-DB-16 |
| **PE-122-06** | `04:1132-1168` (N.5, new) | (no statement) | candidates: Core memory only, consequences; matching key `onvif_uuid` then whole `address`; partial unique index `capture_devices_onvif_uuid_key`; id minting | `masterplan/03_api_contract.md` §2.6; `apps/core-server/src/db/seed/seed.ts:157-158` | D75, D76(1), D81; D-DB-15 |
| **PE-122-07** | `04:1170-1188` (N.6, new) | (no statement) | CHECK inventory for the four audit types, their categories and keys, and the alerts: no CHECK change | `apps/core-server/src/db/migrations/0001_tables.sql:194-199,216-220,383`; `0004_capture.sql:217,227,228` | D80(8), D81 |
| **PE-122-08** | `04:306-311`, `04:1190-1201` (N.7) | §B.3: written "only through operation 89" | operation 96 writes the row in the adoption transaction through the same store; grants cover it; finding F-122-2 (plaintext framed to 17 bytes or more) | `apps/core-server/src/db/migrations/0005_capture_privileges.sql:17-28,44-45`; `0004_capture.sql:29` | D80(7), D81 |
| **PE-122-09** | `04:1203-1303` (N.8, new) | (no set 4) | files `0008_capture_sources.sql` + `0009_capture_sources_privileges.sql`, statements, matrix, no blanket SELECT, down path none, order of application | dbc-2 MG-2, MG-4, MG-5, MG-6 | D-DB-17 |
| **PE-122-10** | `04:1305-1334` (N.9, new) | B-3 expects `(2, 'dbc-3')` | `(3, 'dbc-4')` after row 129; no B-10; fence = capture boot check with query Q-SRC; refused / ignored / inert rules | `masterplan/05_capture_architecture_spec.md` §A.1.2; `apps/core-server/src/db/schema/boot-checks.ts:36` | D72(l), D73; D-DB-18 |
| **PE-122-11** | `04:723-727`, `04:838-841`, `04:1336-1356` (N.10) | kept set 12; fixture `capture_devices` 8 | kept set 12 unchanged, adopted devices kept; seed 5 built-ins `FAKE`, 0 source rows today; fixture `capture_devices` 12, `session_capture_sources` 1,600, `evidence_items` mix | `apps/core-server/src/db/reset/kept-tables.ts:58-62`; `seed/seed.ts:133-163` | D-DB-08 (kept), D81 |
| **PE-122-12** | `04:1358-1378` (N.11, new) | 40 tables, 419 columns, 166 CHECKs, 39 foreign keys | 41 / 426 / 172 / 40; 41 PKs; 4 unique indexes; 44 value sets; 10 files; `(3, 'dbc-4')` | `apps/core-server/test/db/contract-inventory.test.ts:50-59` | — |
| **PE-122-13** | `04:1380-1423` (N.12, new) | checks MT-1..MT-8 | MT-9..MT-16; the two document pins unchanged; 15 groups of code pins that move with row 129; 2 that stay | `apps/core-server/test/db/*.ts` (file:line in N.12) | — |
| **PE-122-14** | `04:913`, `04:1425-1436` (N.13) | decisions D-DB-01..10 | D-DB-11..18 with rejected alternatives | — | this row |
| **PE-122-15** | `04:1438-1483` (N.14-N.16) | (no hand-over for rev 2.3) | hand-over per row; assumptions A-122-1..3, open points O-1..O-8, gaps G-1..G-2; self-gate | `identification/02_structured.md:374-393` | D73 |

## 7. Not done, by instruction

- No migration written, generated or applied; no database write; no test run against a database.
- No test, schema file, seed or fixture edited. `masterplan/11_audit_errata.md`,
  `masterplan/02_plan.md`, `identification/02_structured.md`, `decisions/decisions.md`,
  `status_tasks.md`, `delegation_progress_report.md` and the sibling specs (03, 05, 06, 08, 10)
  were not touched. The tracking table of `masterplan/02_plan.md` that this agent normally updates
  was left to the controller (parallel run).
- `apps/core-server/src/db/store/store.ts` shows as modified in `git status`; that change predates
  this row (it is in the session's starting status) and is not this row's.

## 8. Files

- Updated: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/04_database_contract.md`
- Created: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/delegation_progress/database_specialist_row122.md`

---
*Generated: 2026-10-09*
*Last Updated: 2026-10-09*
