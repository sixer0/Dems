---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 112 (phase C, milestone M2, class B; R-8 / D20; blueprint rev 2.1)
date: 2026-10-08
agent: database-specialist (fallback for database-specialist, free tier)
source_plan: identification/02_structured.md rev 2.1 row 112; masterplan/04_database_contract.md (dbc-3) §B.13 + §D/0005 pattern; masterplan/01_specs.md R-8
narrative_tier: 3
status: complete
closes: R-8 table half (rows 113/114 consume it); SEC35-22 forbidden-key hardening extended for R-8; RK-12 pattern reused for the STT credential
depends_on: row 46 (migrations 0004/0005 validated and applied on a throw-away, meta.ts at (2,'dbc-3'))
verification: M2-STTCFG-DB schema clause PASS on one throw-away DB, 2 runs (`ALL PASS`, exit 0 both); live `dems_demo` proven never migrated by this test (still `(1,'dbc-2')`, 30 base tables, no `stt_config`, before and after); throw-away dropped; PostgreSQL left running
---

# Row 112 / R-8: `stt_config` kept table authored, migrated (0006/0007), privileged in the 0005 pattern

## 0. Summary

| Item | Result |
|---|---|
| `stt_config` typed schema (dbc-3 §B.13) | **authored** - `apps/core-server/src/db/schema/stt.ts` (new), 14 columns, singleton PK, 10 named CHECKs + 1 FK |
| Generated migration | **`0006_stt_config.sql`** - emitted by `drizzle-kit generate --name=stt_config`, non-interactive |
| Privileges migration | **`0007_stt_config_privileges.sql`** - hand-written via `generate --custom`, the 0005 pattern (§D) incl. a `SECURITY DEFINER` reveal function |
| Forbidden-key list | **extended 25 -> 28** with `credentialRef`, `credentialValue`, `apiKey`; the swap rides inside 0006 at both sites (`audit_log_details_no_secret_keys_check`, `events_params_no_secret_keys_check`) |
| Drift proof | second `db:generate` reports `No schema changes, nothing to migrate` (MG-1) |
| `M2-STTCFG-DB` schema clause | **PASS x2** - `SELECT` of each secret column fails **42501** for `dems_app`; loopback CHECK refuses LAN hosts **23514**; throw-away created, migrated (8 files), verified, dropped |
| Live `dems_demo` / lanes | **never migrated by this row** - all four still `(1,'dbc-2')`, 30 base tables, `stt_config=false`, journal 4, before and after |
| Not done here (other rows) | no seed row and no kept-tables entry (row 114), no API ops 90-92 (row 113, M6), `SIM_SNAPSHOT_VERSION` NOT bumped |

## 1. Contract basis and the one structural decision

Row 112 lands after rows 45/46 froze migrations `0004`/`0005`: those files are validated artifacts with
their own SHA-256 ledger identity (MG-4, an applied/validated file is never edited) and their exact text is
quoted line-by-line into `implementation/11_m2_migrations.md` §2.2. dbc-3 §B.13 was written while R-8 was
still PROPOSED, so its sentence "the DDL joins 0004 (table) and 0005 (privileges)" could not anticipate
that Q-STT-CFG would be confirmed (D24) only after 0004/0005 had landed. The blueprint itself resolves the
sequencing in register row 53: "apply migrations 0004/0005 **(+ 0006 `stt_config` when Q-STT-CFG is confirmed)**".

**Decision D-a (this row):** the table arrives as the generated `0006_stt_config.sql`, and its privileges as
the hand-written `0007_stt_config_privileges.sql` - MG-2 (generated and hand-written never share a file) and
the 0004/0005 split reproduced exactly. MG-6 (a set that adds tables adds privileges in the same set) holds:
both files apply together in every pending set. The contract revision does NOT move: table 40 is part of
`dbc-3`, so `schema_meta` and `src/db/schema/meta.ts` stay `(2, 'dbc-3')`; 0007 re-affirms the same pair as
the new last file of the set (MG-5's rule stated literally), which is idempotent for every database that ran 0005.

## 2. The table (dbc-3 §B.13 verbatim)

`apps/core-server/src/db/schema/stt.ts` - T-40, singleton like `capture_config` (N-2):

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `singleton` | boolean | no | true | PK; `stt_config_singleton_check` |
| `enabled` | boolean | no | true | Q-STT-CFG item 11 (enabled) |
| `backend` | text | no | - | `stt_config_backend_check IN ('omlx-server','cpu-local')` |
| `endpoint` | text | yes | null | `stt_config_endpoint_required_check` (server backend) + `stt_config_endpoint_loopback_check` (OD-13) |
| `model` | text | no | - | format by mapping, never a secret |
| `language` | text | no | 'id' | `stt_config_language_check = 'id'` (OD-20) |
| `diarization` | boolean | no | true | speaker labelling flag (R-5) |
| `credential_kind` | text | yes | null | `stt_config_credential_kind_check IN ('REFERENCE','ENCRYPTED') OR NULL` |
| `credential_ref` | text | yes | null | pointer or key-store ref, never key material (SEC35-14) |
| `secret_ciphertext` | bytea | yes | null | `stt_config_secret_check octet_length >= 17` when present |
| `nonce` | bytea | yes | null | `stt_config_nonce_check octet_length = 12` when present |
| `revision` | bigint | no | 1 | `stt_config_revision_check >= 1` (optimistic lock, op 91) |
| `updated_by` | text | yes | null | FK `operators.id` RESTRICT |
| `updated_at` | bigint | no | - | epoch-ms |

Plus `stt_config_credential_check` - the three-way none / REFERENCE / ENCRYPTED-complete rule quoted exactly
from §B.13. Loopback regex as contracted: `^http://(127\.0\.0\.1|localhost)(:[0-9]{1,5})?(/.*)?$`.

Value sets (`value-sets.ts`): `STT_BACKEND`, `STT_CREDENTIAL_KIND` (+ the two mirror types). `index.ts` now
counts 40 tables and re-exports `./stt`.

## 3. Privileges (`0007_stt_config_privileges.sql`, the 0005 pattern)

| Statement | Effect | Rule |
|---|---|---|
| `GRANT SELECT (11 columns)` | every column except the three carved ones | §B.13 |
| `REVOKE SELECT (secret_ciphertext, nonce, credential_ref)` | pins the carve-out even against a future blanket grant | RK-12 |
| `GRANT UPDATE (all 14 columns)` | write-only credential store, op 91 shape | §B.13 "UPDATE on all columns" |
| no INSERT / no DELETE | row created by the seed (row 114), carried by reset (KEPT, `upsert`) | D-DB-08/OD-19 |
| `dems_stt_credential_reveal()` | owner-owned `SECURITY DEFINER`, `search_path` pinned, returns `(credential_kind, credential_ref, secret_ciphertext, nonce)` of the singleton row or no row | mirrors B.3 / D-DB-06 |
| `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO dems_app` | sole runtime role holds EXECUTE; reach narrowed to the single transcriber key-loader module by the M6 static rule (row 115); no 4th DB role | SEC35-02 applied alternative, Q-SEC-3 (a); D-DB-07 |
| `UPDATE schema_meta SET version 2, 'dbc-3'` | MG-5 re-affirmation (values unchanged) | MG-5 |

The reveal function has **no audit row**: C3 §5.2 adds only `STT_CONFIG_CHANGED` (audit types pinned 62 -> 63
by row 113), so unlike `CAPTURE_CREDENTIAL_REVEALED` the STT read path is narrowed by the static rule alone.
Recorded as a residual for row 115 in §7.

## 4. Forbidden-key list 25 -> 28

`AUDIT_DETAIL_FORBIDDEN_KEYS` gains `credentialRef` (the §B.13 reference target, carved out of the runtime
SELECT exactly because its value is sensitive - the `keyRef` analogue), `credentialValue` (op 91's write-only
`value` member, `03_api_contract.md` §2.5) and `apiKey` (the canonical STT server secret; SEC35-14 keeps it in
`~/.omlx/settings.json`, so naming it in any audit/event key is itself a defect). `credentialKind` is
deliberately absent - it is a returned flag, not a secret. The generated swap lands in 0006 at both catalog
sites, proven by the catalog text (§5.3).

## 5. Verification - `M2-STTCFG-DB` schema clause, throw-away only, 2 runs

Driver `.cache/row112/verify.mts` (git-ignored), run as
`timeout 600 /usr/bin/lockf -k .locks/db-migrate.lock npx tsx ... </dev/null`; the host has no `timeout`, so the
row-46-style process-group-kill perl shim was installed on `PATH` and self-tested first (`sleep 5` capped at 2 s
-> exit 124; `echo ok` -> exit 0). Throw-away `dems_test_stt_cfg` (matches `TEST_DATABASE_PATTERN`) through the
sanctioned seam `runCreate/runMigrate(..., { allowTestDatabase: true })` - the same production code path, the
same drizzle migrator as `dems_owner` in one transaction. Credentials read in-process; nothing printed.
Run A and run B produced an identical 74-line check-set, both `STEP C RESULT: ALL PASS`.

### 5.1 Full-set apply (8 files, MG-10 no-op, ledger current)

```
db:create: created dems_test_stt_cfg (owner dems_owner, encoding UTF8, locale C) on PostgreSQL 18.4 as dems_owner.
C-CHECK | PASS | db:create exit 0 | exit=0
db:migrate: schema version before: none (not migrated)
db:migrate: applied 8 migration(s): 0000_prelude, 0001_tables, 0002_audit_guards, 0003_privileges, 0004_capture, 0005_capture_privileges, 0006_stt_config, 0007_stt_config_privileges
db:migrate: schema version after: 2 (dbc-3)
C-CHECK | PASS | full-set migrate exit 0 | exit=0
=== db:migrate pass 2 (MG-10 no-op) ===
db:migrate: no pending migration; nothing was applied.
C-CHECK | PASS | second migrate exit 0 + no-op
C-CHECK | PASS | ledger current (ok, 0 pending, 0 problems) | applied=8 pending=0
```

Drift (MG-1), separately: a re-run of `npm run db:generate` printed `No schema changes, nothing to migrate` and
created no file.

### 5.2 The role proofs (the clause the row names)

```
C-CHECK | PASS | M2-STTCFG-DB SELECT secret_ciphertext -> 42501 | 42501
C-CHECK | PASS | M2-STTCFG-DB SELECT nonce -> 42501 | 42501
C-CHECK | PASS | M2-STTCFG-DB SELECT credential_ref -> 42501 | 42501
C-CHECK | PASS | M2-STTCFG-DB SELECT * -> 42501 (no whole-row read without secrets) | 42501
C-CHECK | PASS | dems_app INSERT -> 42501 (seed-only row) | 42501
C-CHECK | PASS | dems_app DELETE -> 42501 (carried by reset, not deleted) | 42501
C-CHECK | PASS | dems_app sees the 11 non-secret columns (1 row) | rows=1
C-CHECK | PASS | col SELECT stt_config.credential_ref = false | got false
C-CHECK | PASS | col SELECT stt_config.secret_ciphertext = false | got false
C-CHECK | PASS | col SELECT stt_config.nonce = false | got false
   (and col SELECT true x 11 / col UPDATE true x 14; table-level bits [S,I,U,D]=false x 4, the 0005 column-grant shape)
C-CHECK | PASS | dems_app can WRITE the credential columns (write-only store) | OK
C-CHECK | PASS | still cannot READ them back -> 42501 | 42501
C-CHECK | PASS | reveal() via dems_app returns the one row (20-byte ct, 12-byte nc) | {"credential_kind":"ENCRYPTED","ct":20,"nc":12}
C-CHECK | PASS | reveal fn exists, SECURITY DEFINER, pinned search_path | true
  reveal fn search_path pin | "search_path=pg_catalog, public, pg_temp"
C-CHECK | PASS | reveal fn: PUBLIC holds nothing, sole grantee dems_app EXECUTE | ["dems_owner=X/dems_owner","dems_app=X/dems_owner"]
```

The runtime role writes a credential (the op 91 shape), cannot read it back, and gets it only through the
owner-owned `SECURITY DEFINER` function - lengths printed, bytes never.

### 5.3 Constraints actually fire (owner attempts; CHECKs bind the table owner too)

```
C-CHECK | PASS | CHECK fires: loopback refuses LAN host 192.168.x -> 23514 @ stt_config_endpoint_loopback_check
C-CHECK | PASS | CHECK fires: loopback refuses LAN host 10.x + path -> 23514 @ stt_config_endpoint_loopback_check
C-CHECK | PASS | CHECK fires: loopback refuses remote hostname -> 23514 @ stt_config_endpoint_loopback_check
C-CHECK | PASS | CHECK fires: loopback refuses httpS + IPv6 literal -> 23514 @ stt_config_endpoint_loopback_check
C-CHECK | PASS | CHECK fires: backend refuses unknown engine -> 23514 @ stt_config_backend_check
C-CHECK | PASS | CHECK fires: omlx-server requires endpoint -> 23514 @ stt_config_endpoint_required_check
C-CHECK | PASS | CHECK fires: language refuses 'en' -> 23514 @ stt_config_language_check
C-CHECK | PASS | CHECK fires: credential_kind refuses PLAIN -> 23514 @ stt_config_credential(_kind)
C-CHECK | PASS | CHECK fires: REFERENCE without ref -> 23514 @ stt_config_credential_check
C-CHECK | PASS | CHECK fires: ENCRYPTED without nonce -> 23514 @ stt_config_credential_check
C-CHECK | PASS | CHECK fires: nonce must be 12 bytes -> 23514 @ stt_config_nonce_check
C-CHECK | PASS | CHECK fires: ciphertext floor 17 bytes -> 23514 @ stt_config_secret_check
C-CHECK | PASS | CHECK fires: revision >= 1 -> 23514 @ stt_config_revision_check
C-CHECK | PASS | CHECK fires: singleton CHECK refuses false -> 23514 @ stt_config_singleton_check
C-CHECK | PASS | positive control: REFERENCE + loopback localhost accepted | OK
C-CHECK | PASS | singleton: second row rejected by PK (23505) | 23505
```

Probe note: a value violating BOTH credential CHECKs lets PostgreSQL name either one (it promises no
definition order), so that line accepts `stt_config_credential_kind_check` or `stt_config_credential_check`.
Catalog texts also verified verbatim: backend `= ANY (ARRAY['omlx-server'::text, 'cpu-local'::text])`,
loopback regex character-for-character, `language = 'id'`, forbidden keys
`audit_log ... count=28` and `events ... count=28`, equal to the imported constant element-for-element.

### 5.4 Live databases untouched (STEP B probe, read-only, run before and after)

```
STEP B | pg_database LIKE dems% | ["dems_demo","dems_lane_1","dems_lane_2","dems_lane_3"]
STEP B | dems_demo   | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 stt_config=false reveal_fn=false journal_rows=4
STEP B | dems_lane_1 | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 stt_config=false reveal_fn=false journal_rows=4
STEP B | dems_lane_2 | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 stt_config=false reveal_fn=false journal_rows=4
STEP B | dems_lane_3 | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 stt_config=false reveal_fn=false journal_rows=4
STEP B | strays_outside_four | []
STEP B | dems_demo still (1,'dbc-2') + 30 tables + no stt_config | PROVEN
```

Identical output before the two runs and after them. No live command ran: the CLI refuses the test name unless
the seam is code-set, which argv/env can never do (`database-names.ts`).

### 5.5 Drop and end-state

```
  drop(in-main): remaining=0
C-CHECK | PASS | throw-away DB dropped | remaining=0
STEP C | pg_database LIKE dems% after drop | ["dems_demo","dems_lane_1","dems_lane_2","dems_lane_3"]
STEP C RESULT: ALL PASS          (run A and run B, exit 0 each)
```

Pre-clean and `finally` drops are both wired, so an aborted run cannot leave the throw-away behind; the final
probe shows exactly the four project databases. PostgreSQL left running (`127.0.0.1:4432`, cluster healthy:
every probe above answered through it).

## 6. Files this row wrote

| File | Change |
|---|---|
| `apps/core-server/src/db/schema/stt.ts` | **new** (103 lines) - T-40 typed schema |
| `apps/core-server/src/db/schema/value-sets.ts` | `STT_BACKEND`, `STT_CREDENTIAL_KIND`, 2 types, forbidden keys 25 -> 28 |
| `apps/core-server/src/db/schema/checks.ts` | doc count 25 -> 28 |
| `apps/core-server/src/db/schema/index.ts` | header 39 -> 40 tables + row-112 note + `export * from './stt'` |
| `apps/core-server/src/db/migrations/0006_stt_config.sql` | **new**, generated - CREATE TABLE + the two forbidden-key swaps + FK |
| `apps/core-server/src/db/migrations/0007_stt_config_privileges.sql` | **new**, hand-written privileges + reveal fn |
| `migrations/meta/0006_snapshot.json`, `meta/0007_snapshot.json`, `meta/_journal.json` | generated metadata; chain `0005.id==0006.prevId`, `0006.id==0007.prevId`, idx 0..7 positional, `when` strictly rising |
| `.cache/row112/{bin/timeout,probe_live.mts,verify.mts}` | git-ignored verification drivers |

Nothing under `packages/shared/**` (incl. `SIM_SNAPSHOT_VERSION`, still `1`), no web/mobile/mock-core/release
file, no openapi.json, no lockfile, no controller tracker, no kept-tables/seed file (rows 114/52 own those).
No commit made (none requested); no git remote, no push, no sudo.

## 7. Residuals for other rows

1. **Row 114 (seed + kept)**: write the singleton row (Q-STT-CFG item 11: enabled, `cpu-local` on this Mac per
   Q-D7=(a), language `id`, labelling on; a secret is NEVER seeded - SD-8), and `kept-tables.ts` 11 -> 12 mode
   `upsert`. Until the seed lands, a fresh lane has zero `stt_config` rows - intended, the runtime reads the
   row only from row 115 on.
2. **Row 113 (ops 90-92)**: read 90 must use the column list 0007 grants (never `SELECT *` as `dems_app` -
   proven 42501 here); 91 writes through the all-column UPDATE; 92 never echoes the credential.
3. **Row 115 (runtime key-loader)**: the reveal function's narrowing (single module + static rule) has no DB
   enforcement point and, unlike B.3, no audit type exists to log it - the static test is the only control.
   If the security review of M6 wants an audited reveal, an audit type must be added to the pin list there.
4. **Pin-owner notice**: the forbidden-key constant is now 28; the known-red v1 pins row 45 §7.4 listed
   (`writers.test.ts:159`, `contract-inventory.test.ts` denied-key test) now drift to 28, not 25 - row 48 +
   inventory regeneration should assert 28.
5. `M2-STTCFG-DB` keeps its "+1 at row 56" gate run; this artifact covers the producing row's 2.
