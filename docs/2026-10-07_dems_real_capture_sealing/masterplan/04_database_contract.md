---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: database-specialist
blueprint_row: 30
milestone: M0
class: B (GA:OD-01, OD-02, OD-03, OD-19)
tier: 1
type: database-contract (PostgreSQL 18 on 127.0.0.1:4432; drizzle-orm 0.45.3 over pg 8.23.1; drizzle-kit 0.31.11)
status: draft-for-M0-gate (design document; nothing installed, nothing executed, no file under `apps/core-server/` changed)
contract_revision: dbc-3
schema_version: 2 (from 1)
based_on: masterplan/01_specs.md (row 28, spec line 28-29 names this file)
register: research/03_analysis.md (row 6; errata E-01/E-19/E-20/E-24/E-30, corrections W1-C7/W1-C10, CS-16..CS-21/CS-24, SH-01/SH-02, DOC-03)
predecessor: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/03_database_contract.md (dbc-2, rev 2.2, 30 tables)
binding_decisions: D4 (OD-01 T1, OD-02 L2, OD-03 (a) both hashes, OD-19), D7 (STT reuse; no DB effect), D12 (vitest --maxWorkers), blueprint §6 M2 row
impact_map_input: docs/2026-10-04_dems_backend_rbac_pairing/research/10_next_phase_impact_map.md §6 (T-31..T-39)
b16_errata: docs/2026-10-04_dems_backend_rbac_pairing/report/01_report_inputs.md §4 B16 items (i)-(v) — applied/carried in section H
implemented_by: M2 rows of blueprint rev 2 (row 40); this row writes the plan only
last_updated: 2026-10-09 (status sweep PE-R8-01..05: §B.13 `stt_config` CONFIRMED by D24, Q-STT-CFG answer (a); status wording only); 2026-10-08 (RV-SPEC: §B.13 `stt_config` for R-8 added as a proposal, D20; 2026-10-07 row-35 remediation SEC35-02/03/20/21/22)
---

# Database Contract dbc-3: schema v2, migrations 0004/0005, privileges, kept-on-reset, lane re-creation

> **Plan, not execution.** No SQL in this file has been run; no file `0004_capture.sql` or
> `0005_capture_privileges.sql` exists yet (free numbers confirmed by `research/01_explore.md` §2.8).
> M2 implementation rows own writing the migration files, the typed-schema edits and the code.
> **The register is the contract** (`masterplan/01_specs.md` header; D10(a)): where the raw impact
> map and the errata-applied register (`research/03_analysis.md`) disagree, the register wins.

**Citation short forms used throughout**

| Short | Source |
|---|---|
| `dbc-2 §x` | predecessor contract `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/03_database_contract.md` section x |
| `map §x` | `docs/2026-10-04_dems_backend_rbac_pairing/research/10_next_phase_impact_map.md` section x |
| `register §x` | `research/03_analysis.md` (A errata ledger, B register, C gate mapping, D trace, F W1 corrections, G risks) |
| `specs` | `masterplan/01_specs.md` (row 28) |
| `explore §x` | `research/01_explore.md` (row 1 re-verification) |
| `drift §x` | `docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md` |
| `structured §x / row N` | `identification/02_structured.md` |
| `Dn` | `decisions/decisions.md` decision Dn (D4 = approved gate answers, all defaults) |
| `NNNN_tables.sql:line` | current migration SQL at `apps/core-server/src/db/migrations/` |
| `D-DB-nn` | a new decision of this contract (section K) |

## 0. Scope, non-goals and count reconciliation

### 0.1 What this contract fixes

| Item | Value | Source |
|---|---|---|
| Contract revision | `dbc-3`; schema version 1 -> 2 | map §6; MG-5 (`0003_privileges.sql:69-70` wrote version 1/`dbc-2`) |
| Migration set 2 | `0004_capture.sql` (schema v2 core, generated) + `0005_capture_privileges.sql` (privileges + version row, hand-written) | CS-17, CS-24 (register §B.2); MG-2/MG-6/MG-5 (dbc-2 §8.1) |
| Code constants in the same commit | `DB_SCHEMA_VERSION = 2`, `DB_CONTRACT_REVISION = 'dbc-3'` (`src/db/schema/meta.ts:16-18`); `SIM_SNAPSHOT_VERSION` 1 -> 2 (SH-10) | map §6 |
| Table count | 30 -> 39 | dbc-2 rev-history (30 tables); map §6 T-31..T-39 |

### 0.2 The 9-new / 5-changed count, reconciled with the register

`structured §3.1` (impact dimension) and row 30 state **9 new and 5 changed tables**. Reconciliation:

| Category | Tables | Count | Source |
|---|---|--:|---|
| New (create in 0004) | `capture_config` (T-31), `capture_devices` (T-32), `capture_device_credentials` (T-33), `session_audio_intervals` (T-34), `recording_fragments` (T-35), `transcript_chunks` (T-36), `transcripts` (T-37), `transcript_revisions` (T-38), `sealing_jobs` (T-39) | 9 | map §6; register CS-16 |
| Changed (structure or constraint in 0004), the counted five | `active_session`, `evidence_items`, `evidence_tracks`, `alerts`, `session_history` | 5 | map §6 rows 1-4 |
| Changed by E-01 only (constraint) | `health_snapshots` — `health_snapshots_cause_check` at `0001_tables.sql:488` is the third FAULT_KIND site | +1 | register §A E-01 |
| Data-only (no shape change, not counted) | `permissions`, `role_permissions` (seed rows), `schema_meta` (version row set by 0005) | — | map §6 last rows; MG-8 |

**Declared reconciliation: 9 new / 5 changed stands as the register count; E-01 makes the changed
target set 6 tables (the 5 + `health_snapshots` CHECK-only), and 3 tables change by data only.**
No other table changes in 0004/0005.

### 0.3 Coverage of the task's minimum list, and where the register names different tables

| Concern (task list) | Register table(s) | Note |
|---|---|---|
| Capture device selector / config | `capture_config` | T-31 |
| Devices registry | `capture_devices` | T-32 |
| Camera credentials (encrypted, write-only API, RK-12) | `capture_device_credentials` | T-33; register §G RK-12 |
| Mic primary/standby selection + source intervals | `capture_config` (selection) + `session_audio_intervals` (intervals) | T-31/T-34; SH-02 `AudioSourceInterval` |
| Capture worker state | **no dedicated table** — worker telemetry travels in the realtime slices (`hardware_snapshot` JSON, NM-03), service list (CS-10) and audit (`CAPTURE_WORKER_RESTARTED`); its durable output is `recording_fragments` + `sealing_jobs` | map §6 names no such table; the register's 9 stand |
| Sealing progress checkpoints | `sealing_jobs` | T-39; NM-07 |
| Transcript + revisions | `transcript_chunks`, `transcripts`, `transcript_revisions` | T-36/37/38; SH-02 |
| Fragment / manifest v2 records | `recording_fragments` (checkpoints) + `evidence_tracks`/`evidence_items` v2 columns (manifest records) | T-35; SH-02 `FragmentCheckpoint`, `EvidenceFile` |

Entity-to-table map for SH-02 (`EvidenceFile` -> `evidence_tracks` v2 row; `AudioSourceInterval` ->
`session_audio_intervals`; `FragmentCheckpoint` -> `recording_fragments`; `Transcript` -> `transcripts`
(+`transcript_chunks` working rows); `TranscriptRevision` -> `transcript_revisions`; `CaptureConfig` ->
`capture_config`; `CaptureDevice` -> `capture_devices` + `capture_device_credentials`).

### 0.4 Non-goals (H of the task)

| Non-goal | Authority |
|---|---|
| No SQL executed; no migration file created; no code or schema-file change (M2 rows own implementation) | row 30 brief; dbc-2 §1.4 precedent |
| No database connection was opened; live state was read from the migration SQL files only | row 30 brief |
| No dependency on hardware; class C (C-1..C-9) stays class C | `structured §5/§9` |
| No `release/` or `apps/mock-core` touch; no re-issue of dbc-2 (it stays as history; this file supersedes its DB rules where they collide, DOC-03) | DOC-06; DOC-03 |
| API operation names, audit-type detail keys, error codes belong to row 29; manifest v2 field semantics to row 32; sealing step names to SH-01/row 29 | `structured` rows 29/32 |

## A. Migration plan (task item A)

### A.1 Files, order and kind

| Order | File | Kind | Content |
|--:|---|---|---|
| 5 | `0004_capture.sql` | generated from the typed schema (`drizzle-kit generate --name=capture`) | the 9 CREATE TABLEs, the ADD COLUMNs on `active_session`/`evidence_items`/`evidence_tracks`, all CHECK swaps, the new indexes, snapshots `meta/0004_snapshot.json`, journal entry idx 4 |
| 6 | `0005_capture_privileges.sql` | hand-written (`generate --custom --name=capture_privileges`, text in this section) | the grants for the new tables, the credential SELECT revocation + reveal function, `UPDATE schema_meta ... version 2, 'dbc-3'`, journal entry idx 5 |

MG-2 (generated and hand-written never share a file), MG-6 (a set that adds tables adds privileges in
the same set) and MG-5 (last file sets the version) are satisfied by exactly this split (dbc-2 §8.1).
No `0004a` extra file is needed: every 0004 statement is expressible in the typed schema, because
this contract deliberately avoids any data rewrite in 0004 (see A.4 and D-DB-05).

### A.2 Dependency order inside 0004 (statement list, plan form)

| # | Statement | Depends on |
|--:|---|---|
| 1 | `CREATE TABLE capture_devices` (B.2) | — |
| 2 | `CREATE TABLE capture_config` (B.1; FKs to `capture_devices`, `operators`) | 1 |
| 3 | `CREATE TABLE capture_device_credentials` (B.3; FK to `capture_devices`) | 1 |
| 4 | `CREATE TABLE session_audio_intervals` (B.5) | — |
| 5 | `CREATE TABLE recording_fragments` (B.6) | — |
| 6 | `CREATE TABLE transcript_chunks` (B.7) | — |
| 7 | `CREATE TABLE transcripts` (B.8; FK to `evidence_items`) | — |
| 8 | `CREATE TABLE transcript_revisions` (B.9; FKs to `evidence_items`, `operators`) | — |
| 9 | `CREATE TABLE sealing_jobs` (B.4) | — |
| 10 | `ALTER TABLE active_session ADD COLUMN` x5 + drop/add `active_session_json_check` (C.7) | — |
| 11 | `ALTER TABLE evidence_items ADD COLUMN` x3 (manifest_version, transcript_sha256, labels_status) | — |
| 12 | `ALTER TABLE evidence_items` CHECK swaps: drop/add `evidence_items_hashes_check` (`:335`), `evidence_items_signature_check` (`:336`), new `evidence_items_signature_value_check`, `evidence_items_sources_check` (`:340`) (C.4/C.5/C.6) | 11 |
| 13 | `ALTER TABLE evidence_tracks ADD COLUMN` x7 (kind, contains_audio, codec, duration_ms, fragment_count, fragment_chain_head, sha256_plain) | — |
| 14 | `ALTER TABLE evidence_tracks` CHECK swap: add v2 column rules into `evidence_tracks_values_check` (`:354`); `:353` unchanged (D-DB-05) | 13 |
| 15 | FAULT_KIND CHECK swaps x3: drop/add `session_history_outcome_check` (`:281`), `alerts_kind_check` (`:382`), `health_snapshots_cause_check` (`:488`) (C.1-C.3) | — |
| 16 | `CREATE INDEX` statements (listed per table in section B) | 1-9 |

No sequences: dbc-2 §1.7 rejected `serial`/identity and identifiers are counter-minted; 0004/0005
create **no `CREATE SEQUENCE`** (D-DB-07). `gen_random_uuid()` remains core-function default only.

### A.3 How the runner applies them (mechanism, from `src/db/` read-only)

| Step | Mechanism | Evidence |
|---|---|---|
| Generation | M2 edits the typed schema (`src/db/schema/*`, CS-16) and `value-sets.ts` (FAULT_KIND 14 values), then `npm run db:generate -w @dems/core-server` emits 0004 + snapshot + journal entry; 0005 is hand-written text fixed by this contract (`0003_privileges.sql` style) | `apps/core-server/package.json:20`; MG-2; map §6 |
| Journal discipline | `readMigrationSet` requires idx = position and strictly rising `when`, else `MIGRATION_SET_INVALID`; entries 4 and 5 must be appended in order with newer timestamps | `commands/migrations.ts:61-105` |
| Ledger safety | `applyMigrations` first compares every file's SHA-256 with the stored hash (MG-4/D38); an edited or skippable file stops the run with `MIGRATION_LEDGER_MISMATCH` | `commands/migrations.ts:150-269` |
| Apply | Drizzle migrator applies the whole pending set **in one transaction** as `dems_owner` (MG-9); `dems_app` must already exist (OW-8); no statement names the owner or superuser role (MG-9 note, dbc-2 §8.3) | `commands/migrate.ts:33-69`; `0003_privileges.sql:1-6` header |
| Post-check | after apply: `assertLedgerCurrent` + `schema_meta` must read `(2, 'dbc-3')`, else `SCHEMA_VERSION_MISMATCH`; a second run applies nothing (MG-10) | `commands/migrations.ts:250-269` |
| Locking | on `dems_demo` every run is wrapped: `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -- --database dems_demo`; lane/test databases migrate freely, but the M2 re-creation session wraps every migrate step in the same lock (P16, `structured` §10 lane rule; `database-names.ts:55-57`) | `commands/migrate.ts:11-17`; README.md:260-266 |

Command forms: `npm run db:migrate -w @dems/core-server -- --database <name>` (or the root aliases
`npm run db:migrate -- --database <name>`, `package.json:38-39`).

### A.4 Why 0004 must validate against existing v1 data

A migration runs on a copy of the live `dems_demo`, whose 13 evidence items and 14 packages are v1
until the re-seed replaces them (OD-02/E-20). `ALTER TABLE ... ADD CONSTRAINT` validates against
existing rows, so any CHECK that **narrowed** `track_id`, `position` or `tampered_track_id` would
fail the migration itself; deleting the v1 rows inside 0004 would break MG-8 (dbc-2 §8.1). Decision
**D-DB-05**: v2 keeps those value sets permissive and enforces the v2 shape in mapping, seed, verify
and M2 tests (OD-01 T1 "the DB value set can keep 4 values", map §5.1). Every 0004 change above is
additive or relaxing, so the copy-migration path works before the re-seed.

## B. Tables: the 9 new and 5 changed (task item B)

Conventions inherited from dbc-2 unchanged: schema `public`, `snake_case`, names N-4; times are
`bigint` epoch-ms; JSON columns bounded by `jsonb_typeof` CHECKs; a singleton table keys on
`singleton boolean DEFAULT true` (N-2). Privileges column follows the `dems_app` model: three DB
roles only — `dems_admin` (cluster superuser, provisioning, never named in a migration),
`dems_owner` (applies 0004/0005, seeds, resets; owns everything), `dems_app` (runtime).
INVESTIGATOR/SUPERVISOR/TECHNICIAN are stored **application** roles (rows of `roles`), not DB roles;
their access is expressed by the operation/permission contract (row 29), not by DB grants.

### B.0 Change summary table (reset policy and register row, all 14+3)

| Table | New/Changed | Reset policy | Register row(s) |
|---|---|---|---|
| `capture_config` | new T-31 | KEPT (OD-19) | NM-09, SH-02 `CaptureConfig`, OD-19 |
| `capture_devices` | new T-32 | KEPT (OD-19) | NM-01, SH-02 `CaptureDevice`, OD-05 |
| `capture_device_credentials` | new T-33 | KEPT (OD-19) | RK-12, T-33 (map §6), E-30 (audited refusals, row 29) |
| `session_audio_intervals` | new T-34 | rebuilt (rows removed) | R-3, SH-02 `AudioSourceInterval`, NM-10 |
| `recording_fragments` | new T-35 | rebuilt | NM-04, SH-02 `FragmentCheckpoint`, OD-03 |
| `transcript_chunks` | new T-36 | rebuilt | NM-06 (R-5) |
| `transcripts` | new T-37 | rebuilt | R-5, SH-02 `Transcript`, OD-15 |
| `transcript_revisions` | new T-38 | rebuilt | R-5, SH-02 `TranscriptRevision`, OD-15 |
| `sealing_jobs` | new T-39 | rebuilt | NM-07 (R-6, OD-08) |
| `active_session` | changed | rebuilt | map §6; D202; FXC-1 |
| `evidence_items` | changed | rebuilt | CS-16; OD-01/02/03/04/19 |
| `evidence_tracks` | changed | rebuilt | map §6; OD-01/03 |
| `alerts` | changed (CHECK) | rebuilt | E-01; SH-03 |
| `session_history` | changed (CHECK) | rebuilt | E-01; SH-03 |
| `health_snapshots` | changed (CHECK, E-01; the 6th) | rebuilt | E-01 |
| `permissions`, `role_permissions` | data only (seed) | rebuilt (seed writes; matrix equality boot check) | F-15/D88 equality; OD-10/OD-15 |
| `schema_meta` | data only (0005 sets 2/`dbc-3`) | carried | MG-5 |

### B.1 `capture_config` (T-31) — device selector singleton

Purpose: the persistent selector: which device feeds `VIDEO-01`/`VIDEO-02` (device + media profile,
OD-05 both topologies) and which mic inputs are PRIMARY/STANDBY (OD-09). Snapshot at session start
into `active_session.capture_config` (SH-06). Optimistic `revision` (operation 77, `REVISION_CONFLICT`).

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `singleton` | boolean | no | true | PK; CHECK `singleton` (`capture_config_singleton_check`) |
| `video_01_device_id` | text | no | — | FK `capture_devices.id` RESTRICT |
| `video_01_profile` | text | no | — | format `CODE` |
| `video_02_device_id` | text | no | — | FK `capture_devices.id` RESTRICT |
| `video_02_profile` | text | no | — | format `CODE` |
| `mic_primary_id` | text | no | — | FK `capture_devices.id` RESTRICT |
| `mic_standby_id` | text | no | — | FK `capture_devices.id` RESTRICT; CHECK `mic_standby_id <> mic_primary_id` |
| `revision` | bigint | no | 1 | CHECK `revision >= 1` |
| `updated_by` | text | yes | null | FK `operators.id` RESTRICT |
| `updated_at` | bigint | no | — | epoch-ms |

`capture_config_selector_check`: `(video_01_device_id <> video_02_device_id) OR (video_01_profile <>
video_02_profile)` — a dual-lens single device is legal only with two distinct profiles (OD-05, D-DB-10).
Indexes: none beyond the PK (singleton). Privileges (`0005`): SELECT (blanket), UPDATE
(`video_01_device_id, video_01_profile, video_02_device_id, video_02_profile, mic_primary_id,
mic_standby_id, revision, updated_by, updated_at`); **no INSERT, no DELETE** for `dems_app` (row
created by seed/carried by reset; OD-10 edit is an UPDATE). Reset: **KEPT**, mode `upsert` (D-DB-08).

### B.2 `capture_devices` (T-32) — capture-device registry

Purpose: the real/fake capture devices (never the paired-client registry — `AdminResource.DEVICES`
is taken, E-04). IDs match the sim initial state: `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`,
`POE-SWITCH` (`packages/shared/src/sim/initial-state.ts:189-236,373`).

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `id` | text | no | — | PK; `^(CAM\|MIC\|POE)-[0-9]{2,}$` for CAM/MIC, `^POE-[A-Z0-9_]{2,}$` (prefix tied to `kind`, `capture_devices_id_check`) |
| `kind` | text | no | — | CHECK IN ('CAMERA','MIC','POE') |
| `transport` | text | no | — | open set, format `CODE` (OD-06/OD-07 transports change without a migration, MG-11 precedent) |
| `model`, `firmware`, `address`, `mac`, `onvif_uuid` | text | yes | null | length CHECK 1..120 (address 1..120; mac `^[0-9A-F:]{17}$` or null) |
| `profiles` | jsonb | no | '[]' | CHECK `jsonb_typeof = 'array'` (media profiles for OD-05) |
| `poe_port` | text | yes | null | format `CODE` (e.g. `POE_CAM_1`) |
| `enabled` | boolean | no | true | — |
| `last_seen_at` | bigint | yes | null | epoch-ms (discovery/telemetry) |

Indexes: `capture_devices_kind_idx` on (`kind`). Privileges: SELECT, INSERT, UPDATE (`transport,
model, firmware, address, mac, onvif_uuid, profiles, poe_port, enabled, last_seen_at`); **no DELETE**
(discovery only adds/updates; removal is a reset, owner). Reset: **KEPT**, mode `upsert`.

### B.3 `capture_device_credentials` (T-33) — write-only camera secrets (RK-12)

Purpose: per-camera ONVIF/RTSP credentials, encrypted at rest, written only through operation **89**
(`setCaptureDeviceCredential`; row 29 §2.2 adds it — the row-35 review found the earlier "operation
80" reference collided with `setPrimaryMic`, SEC35-01) and read only through the single owning reveal
module. Never in a slice, a log or an audit row — the `CAPTURE_CREDENTIAL_SET` detail holds the device
ID only, and the `CAPTURE_CREDENTIAL_REVEALED` detail holds the device ID and a reason code only
(map §5.4; E-30; RK-12; SEC35-01/SEC35-02).

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `device_id` | text | no | — | PK; FK `capture_devices.id` RESTRICT |
| `username` | text | no | — | length 1..120 |
| `encryption` | text | no | 'AES-256-GCM' | CHECK `= 'AES-256-GCM'` |
| `secret_ciphertext` | bytea | no | — | CHECK `octet_length >= 33` (16-min plaintext + 16-byte GCM tag) |
| `nonce` | bytea | no | — | CHECK `octet_length = 12` (GCM 96-bit standard nonce) |
| `key_ref` | text | no | — | format `CODE`; a key-directory reference, never key material |
| `rotated_at` | bigint | no | — | epoch-ms |

Indexes: none (PK by device). Privileges: INSERT, UPDATE (`username, encryption, secret_ciphertext,
nonce, key_ref, rotated_at`); **SELECT revoked from `dems_app`** (blanked by the blanket SELECT in
0005, then explicitly revoked) — the store is read only through the owner-owned `SECURITY DEFINER`
function `dems_capture_credential_reveal(text)` (one row, bind-parameter device ID; D-DB-06;
precedent `audit_chain_lock()`, dbc-2 §6.3/PG-04). Reset: **KEPT**, mode `upsert`.

**Key store (SEC35-03).** `key_ref` resolves to the per-camera AES-256-GCM key in the **Core
credential store** (the same store as the session keys; `cap §D.2`), one random 256-bit key per
credential, held separately from the media volume and never in the DB, a slice, a log or an audit
row. `key_ref` is a `CODE`-format reference into that store, never key material. Rotation writes a new
key and updates `key_ref` + `rotated_at` in one UPDATE; the previous key is retained read-only until
the credential is re-encrypted, then destroyed. Only the reveal module (below) may resolve it.

**Reveal control (SEC35-02).** `GRANT EXECUTE` is **not** a blanket capability: PUBLIC is revoked and
the grant is held only by the sole runtime role; the runtime role's reach is narrowed to **exactly one
module**, `apps/core-server/src/modules/capture-config/credential-reveal.ts`, enforced by a static
rule in the capture-config guard (G-R4 family; row 36 capture-config static test) — no other module
may reference the function. The function is invoked only from the write-only API path (op 89's
credential-management path; row 29 §2.1 lists the credential-custody permission row), and **every
invocation writes `CAPTURE_CREDENTIAL_REVEALED` with `deviceId` and a reason code only** (never the
username, ciphertext, nonce or key). A 4th, narrower DB role was considered and rejected: `D-DB-07`
and section B forbid new DB roles, so the narrowing is application-layer + static + audited rather
than a second role. The function returns NULL and writes no row for an unknown device. Reveal
verification: `M2-MT-4` asserts `SELECT capture_device_credentials` fails 42501 for `dems_app` and the
static rule asserts the single calling module.

### B.4 `sealing_jobs` (T-39) — sealing progress checkpoints (NM-07, R-6)

Purpose: one row per sealing step of one session; per-step progress/ETA source for all clients;
RECOVERY resume reads the `checkpoint` (OD-08; MB-06; E-13 forward-only is a code rule, not a DB
CHECK — a resumed attempt legitimately rewrites progress).

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `session_id` | text | no | — | PK part; format `^SES-[0-9]{8}-[0-9]{4}$`; **no FK** (rows written during FINALIZING before `session_history` exists, D-DB-07) |
| `step` | text | no | — | PK part; format `CODE`; closed set lives in SH-01 (`CLOSE_TRACKS`..`STORE_SEALED_PACKAGE`), pinned by the vocabulary test, not a DB CHECK (MG-11) |
| `status` | text | no | — | CHECK IN ('RUNNING','DONE','FAILED') |
| `progress` | integer | no | 0 | CHECK `BETWEEN 0 AND 100` |
| `eta_ms` | bigint | yes | null | CHECK `>= 0` or null |
| `attempt` | integer | no | 1 | CHECK `>= 1` |
| `checkpoint` | jsonb | yes | null | CHECK `jsonb_typeof = 'object'` or null |
| `error_code` | text | yes | null | format `CODE` |
| `started_at`, `updated_at` | bigint | no | — | epoch-ms |

Indexes: PK (`session_id`,`step`) covers reads by session. Privileges: SELECT, INSERT,
UPDATE (`status, progress, eta_ms, attempt, checkpoint, error_code, updated_at`); no DELETE. Reset: rebuilt.

### B.5 `session_audio_intervals` (T-34) — mic source intervals (R-3)

Purpose: each interval of one mic (`MIC-01`/`MIC-02` in PRIMARY/STANDBY role) inside `AUDIO-01`;
`from_media_ms`/`to_media_ms` are **media-pts domain** (S2 §6 finding 3; specs E.2 — never operator
wall clock). Rows feed the manifest v2 `audio.sourceIntervals` and the playback band.

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `session_id` | text | no | — | PK part; SES format; **no FK** (written during RECORDING, D-DB-07) |
| `seq` | integer | no | — | PK part; CHECK `>= 1` |
| `mic_device_id` | text | no | — | FK `capture_devices.id` RESTRICT |
| `role` | text | no | — | CHECK IN ('PRIMARY','STANDBY') (OD-09/OD-01) |
| `from_media_ms`, `to_media_ms` | bigint | to_ yes | — | CHECK `from_media_ms >= 0`; closed interval: `to_media_ms >= from_media_ms` |
| `from_at`, `to_at` | bigint | to_ yes | — | UTC-ms record alongside media pts; CHECK open/closed agreement `((to_media_ms IS NULL) = (to_at IS NULL))` (`session_audio_intervals_open_check`) |
| `switched_by` | text | yes | null | FK `operators.id` RESTRICT (the actor of the manual toggle, OD-09) |
| `reason` | text | no | — | CHECK IN ('START','MANUAL','STOP') |

Exactly one open interval (latest `to_media_ms` IS NULL) per session is a mapping rule (MR; DB cannot
enforce without a partial unique index on a moving target — the open row is the one with
`to_media_ms IS NULL`: a **partial unique index** `session_audio_intervals_one_open_key` on
(`session_id`) `WHERE to_media_ms IS NULL` enforces it, PG-08). Privileges: SELECT, INSERT,
UPDATE (`to_media_ms, to_at`) only (map §6 "UPDATE of `to_*` on the open row only"); no DELETE.
Reset: rebuilt.

### B.6 `recording_fragments` (T-35) — fragment checkpoints (NM-04, OD-03)

Purpose: one row per closed fragment per camera file: byte range + per-fragment SHA-256 of the
**stored bytes** + chain hash + running prefix anchor, so crash detection and the one-fragment
tamper demo (OD-02) are locatable writer-independently (S1 §3.1 SP-7, §5.4). Batched at ~1 row/s/camera.

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `session_id` | text | no | — | PK part; SES format; **no FK** (D-DB-07) |
| `track_id` | text | no | — | PK part; CHECK IN ('VIDEO-01','VIDEO-02') (`recording_fragments_track_check`) |
| `seq` | integer | no | — | PK part; CHECK `>= 1` |
| `byte_offset` | bigint | no | — | CHECK `>= 0` |
| `byte_length` | bigint | no | — | CHECK `>= 1` |
| `media_start_ms` | bigint | no | — | CHECK `>= 0` |
| `media_duration_ms` | bigint | no | — | CHECK `>= 1` |
| `sha256` | text | no | — | CHECK `^[0-9a-f]{64}$` (stored fragment bytes) |
| `chain_hash` | text | no | — | CHECK hex64; `chain_0 = SHA-256("")` rule: first row's previous-chain anchor is the empty digest, recomputed by mapping (row 31) |
| `durable_at` | bigint | no | — | fsync-recorded time (row 31 policy; S1 §8 SP-2) |

Indexes: PK (`session_id`,`track_id`,`seq`) covers the chain scan; CHECK
`byte_offset = seq-derived` stays in mapping. Privileges: **INSERT only** (map §6; append-only
demo-state table; no UPDATE/DELETE for `dems_app`). Reset: rebuilt.

### B.7 `transcript_chunks` (T-36) — incremental STT checkpoints (NM-06)

Purpose: one row per VAD chunk while recording; the resume-after-kill checkpoint; speaker embeddings
for the 2-speaker clustering (OD-20; D7 `TranscriberAdapter`; CPU-priority rule is code, C-N2).

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `session_id` | text | no | — | PK part; SES format; **no FK** (D-DB-07) |
| `seq` | integer | no | — | PK part; CHECK `>= 1` |
| `audio_from_ms`, `audio_to_ms` | bigint | no | — | CHECK `audio_to_ms > audio_from_ms >= 0` |
| `status` | text | no | 'PENDING' | CHECK IN ('PENDING','RUNNING','DONE','FAILED') |
| `segments` | jsonb | yes | null | CHECK `jsonb_typeof='array'` or null; DONE requires non-null (`transcript_chunks_done_check`: `(status='DONE') => (segments IS NOT NULL AND computed_at IS NOT NULL)`) |
| `embedding_ref` | text | yes | null | format `CODE` (diarization artifact reference; bytes live in the git-ignored model/cache store, OD-25) |
| `model_id` | text | yes | null | format `CODE` (configurable model path, R-7) |
| `computed_at` | bigint | yes | null | epoch-ms |

Privileges: SELECT, INSERT, UPDATE (`status, segments, embedding_ref, model_id, computed_at`); no DELETE.
Reset: rebuilt.

### B.8 `transcripts` (T-37) — sealed machine transcript (R-5)

Purpose: the sealed transcript's per-format hashes, model provenance and diarization status;
machine transcript = revision 0, byte-unchanged forever (OD-15).

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `evidence_id` | text | no | — | PK; FK `evidence_items.id` RESTRICT |
| `json_sha256` | text | no | — | hex64 CHECK |
| `srt_sha256` | text | no | — | hex64 CHECK |
| `vtt_sha256` | text | no | — | hex64 CHECK |
| `model` | jsonb | no | — | object CHECK (name, version, quantisation, params, model-file hash — manifest v2 fields, row 32) |
| `diarization` | jsonb | no | — | object CHECK (`numSpeakers`, status, confidence; row 32) |
| `labels_status` | text | no | — | CHECK IN ('LABELLED','UNAVAILABLE') (OD-15/OD-20) |
| `created_at` | bigint | no | — | epoch-ms |

Privileges: **INSERT only**. Reset: rebuilt.

### B.9 `transcript_revisions` (T-38) — signed corrections (R-5, OD-15)

Purpose: one row per signed revision; `parent_sha256` chains them; the sealed machine transcript
(inside `transcripts`) is never rewritten.

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `evidence_id` | text | no | — | PK part; FK `evidence_items.id` RESTRICT |
| `revision_no` | integer | no | — | PK part; CHECK `>= 1`; numbering rule: next = max+1 inside the write transaction (no sequence, D-DB-07) |
| `parent_sha256` | text | no | — | hex64 CHECK (0's parent = `transcripts.json_sha256`, mapping rule MR) |
| `sha256` | text | no | — | hex64 CHECK (canonical revision body) |
| `author_id` | text | no | — | FK `operators.id` RESTRICT (author recorded, OD-15) |
| `reason` | text | no | — | length 5..500 |
| `signature_value` | text | no | — | same per-algorithm CHECK family as C.5 (Ed25519 64-byte hex = 128 chars; Core key signs, OD-04/OD-15) |
| `signature_key_id` | text | no | — | format `CODE` |
| `signature_algorithm` | text | no | — | CHECK IN ('Ed25519','SIMULATED-SHA256') + simulated-flag rule as C.4 (`transcript_revisions_signature_check`) |
| `signature_simulated` | boolean | no | false | — |
| `signature_certificate_sha256` | text | yes | null | hex64 or null — the signing certificate's sha256 at revision time (SEC35-20); after a key rotation the old revision stays re-verifiable from the package, and V-11 checks against it (`ev §C.3/§D V-11`) |
| `created_at` | bigint | no | — | epoch-ms |

Privileges: **INSERT only**. Reset: rebuilt.

**`baseRevision` mapping (SEC35-21).** `baseRevision` (op 85, row 29 §2.3) has no column here: it is the
item's current `max(revision_no)` (`0` when none), read and compared inside the same INSERT
transaction that mints `revision_no = max+1` (no sequence, `D-DB-07`); a mismatch is
`409 TRANSCRIPT_REVISION_CONFLICT`. **Per-revision certificate (SEC35-20):**
`signature_certificate_sha256` binds each revision to the certificate that signed it; the package
retains the certificate set (row 32 `06_evidence_package_spec.md §C.3`) so an old revision verifies
after rotation.

### B.10 `active_session` (changed) — v2 columns

| Addition | Type | Null/Default | Rule |
|---|---|---|---|
| `capture_config` | jsonb | not null, default `'{}'::jsonb` | snapshot of the selector at start (SH-06); object CHECK joins `active_session_json_check` (C.7) |
| `audio_source` | jsonb | not null, default `'{}'::jsonb` | active mic + open interval mirror (SH-05); object CHECK |
| `transcript_status` | jsonb | not null, default `'{}'::jsonb` | incremental transcript state (SH-05); object CHECK |
| `started_by` | text | yes | FK `operators.id` RESTRICT (closes FXC-1) |
| `stopped_by` | text | yes | FK `operators.id` RESTRICT |

The `finalization` JSON gains progress/ETA fields as **shape only** (no DDL; map §6 row 1).
Privileges unchanged: `dems_app` has table-level UPDATE+DELETE (0003 pattern `:45`), so the new
columns need no extra grant; INSERT already granted. Reset: rebuilt.

### B.11 `evidence_items` (changed) — v2 manifest/signature/transcript columns

| Addition | Type | Null/Default | Rule |
|---|---|---|---|
| `manifest_version` | smallint | not null, default **1** | CHECK IN (1,2); existing v1 rows keep 1 until the re-seed rewrites them as v2 (D-DB-01); the v2 seed writes 2 |
| `transcript_sha256` | text | yes | hex64 CHECK when present (JSON transcript summary for list panes; full per-format hashes in `transcripts`) |
| `labels_status` | text | yes | CHECK IN ('LABELLED','UNAVAILABLE') when present (R-5) |
| `integrity_source` value set | — | — | gains **'REAL'**: CHECK becomes IN ('DEMO_PACKAGE','SIMULATED','REAL') (C.6; OD-19 guard key; D-DB-04) |

New sealed columns get **no UPDATE grant** ("as today + none on the new sealed columns", map §6);
the existing UPDATE list (`0003_privileges.sql:47`: status, lifecycle_stage, verification_status,
verification_at, tampered, tampered_track_id, updated_at) stays exactly as is. `integrity_source`
stays outside that list (immutable at seal). v1 items are unreachable under L2 but the columns
remain readable (D-DB-05). Reset: rebuilt.

### B.12 `evidence_tracks` (changed) — one row per FILE in v2 (OD-01/OD-03)

| Addition | Type | Null/Default | Rule |
|---|---|---|---|
| `kind` | text | not null, default 'FILE' | CHECK IN ('FILE') (`evidence_tracks_kind_check`); the only value v2 code writes; harmless label on the temporary pre-re-seed v1 rows (A.4) |
| `contains_audio` | boolean | not null, default true | CHECK `contains_audio` (R-4: both camera files carry the single `AUDIO-01` session track) |
| `codec` | text | yes | format `CODE` or null (video codec copied from camera + audio codec AAC-LC, OD-06; manifest v2 row) |
| `duration_ms` | bigint | yes | `>= 0` or null |
| `fragment_count` | integer | yes | `>= 0` or null; must equal the `recording_fragments` row count of that item's session+track — a mapping/verify invariant (MR-V1, not a DB CHECK) |
| `fragment_chain_head` | text | yes | hex64 or null; the chain head at close (S1 §3.1) |
| `sha256_plain` | text | yes | hex64 or null — **plaintext whole-file hash** (D-DB-02); existing `sha256` column is declared the **stored-bytes whole-file hash** (no rename; S1 running prefix equals it at close) |

CHECK :353 (`track_id IN 4 values AND position BETWEEN 1 AND 4`) is **kept unchanged** (D-DB-05);
the v2 rule "exactly 2 rows, `VIDEO-01`/`VIDEO-02`, position 1..2, both hashes present" is enforced
by mapping (CS-18), seed and the M2 tests, and re-checked by verify v2 (row 32). `evidence_tracks_values_check`
(`:354`) is replaced by the same rule plus the new-column patterns (C.6). Privileges unchanged:
SELECT + INSERT only (map §6 "INSERT only"). Reset: rebuilt.

### B.13 `stt_config` (T-40) — STT configuration singleton (CONFIRMED — D24, Q-STT-CFG answer (a); R-8, D20) **Erratum PE-R8-02 (D24)**

> **Status: confirmed (D24, 2026-10-08: Q-STT-CFG answered (a), all 13 defaults).** This table implements
> R-8 (`01_specs.md` R-8; D20). With it: tables **39 -> 40**, kept set **11 -> 12**, and the DDL joins
> 0004 (table) and 0005 (privileges). The 39-table and 11-table figures elsewhere in this file were not
> restated by the status sweep (**Erratum PE-R8-02 (D24)**, status wording only).

Purpose: the persistent STT configuration edited from the web configuration menu (op 91,
`03_api_contract.md §2.5`): enabled/disabled, backend, loopback endpoint, model, language, speaker
labelling, and a **secret held only as a reference or as ciphertext**. Snapshot at session start into
`active_session` (the same pattern as `capture_config`, B.1), so a change applies to the next session.

| Column | Type | Null | Default | Key/Check |
|---|---|---|---|---|
| `singleton` | boolean | no | true | PK; CHECK `singleton` (`stt_config_singleton_check`) |
| `enabled` | boolean | no | seed value `true` (Q-STT-CFG item 11, confirmed D24; **Erratum PE-R8-03**) | — |
| `backend` | text | no | — | CHECK IN ('omlx-server','cpu-local') |
| `endpoint` | text | yes | null | required when `backend = 'omlx-server'`; CHECK `endpoint IS NULL OR endpoint ~ '^http://(127\.0\.0\.1\|localhost)(:[0-9]{1,5})?(/.*)?$'` (`stt_config_endpoint_loopback_check`; OD-13) |
| `model` | text | no | — | model id (server) or model path reference (`cpu-local`); format checked by the mapping, never a secret |
| `language` | text | no | 'id' | CHECK `language = 'id'` (OD-20) |
| `diarization` | boolean | no | true | speaker labelling on/off (R-5 labels when possible) |
| `credential_kind` | text | yes | null | CHECK IN ('REFERENCE','ENCRYPTED') or null |
| `credential_ref` | text | yes | null | `REFERENCE`: a pointer such as `omlx-settings:auth.api_key` (the key stays in `~/.omlx/settings.json`, SEC35-14); `ENCRYPTED`: the `key_ref` into the Core credential store (same store as B.3). Never key material |
| `secret_ciphertext` | bytea | yes | null | only for `ENCRYPTED`; AES-256-GCM; CHECK `octet_length >= 17` when present |
| `nonce` | bytea | yes | null | only for `ENCRYPTED`; CHECK `octet_length = 12` when present |
| `revision` | bigint | no | 1 | CHECK `revision >= 1` (optimistic revision, op 91) |
| `updated_by` | text | yes | null | FK `operators.id` RESTRICT |
| `updated_at` | bigint | no | — | epoch-ms |

`stt_config_credential_check`: `(credential_kind IS NULL AND credential_ref IS NULL AND
secret_ciphertext IS NULL AND nonce IS NULL) OR (credential_kind = 'REFERENCE' AND credential_ref IS
NOT NULL AND secret_ciphertext IS NULL AND nonce IS NULL) OR (credential_kind = 'ENCRYPTED' AND
credential_ref IS NOT NULL AND secret_ciphertext IS NOT NULL AND nonce IS NOT NULL)`.

Privileges (`0005`; confirmed, D24; **Erratum PE-R8-04**): column-level SELECT on every column **except**
`secret_ciphertext` and `nonce` (and `credential_ref`, whose target is sensitive); UPDATE on all
columns; **no INSERT, no DELETE** for `dems_app` (row created by the seed, carried by reset). The
secret columns are read only by the single transcriber key-loader module (`07_transcript_spec.md
§B.2` SEC35-14 rule), mirroring the B.3 reveal control; the exact reveal mechanism follows the D-DB-07
"no new DB roles" rule. Never in a slice, a log or an audit row (`STT_CONFIG_CHANGED` carries field
names only). Reset: **KEPT**, mode `upsert` (D-DB-08) — the configuration survives a demo reset
(OD-19 pattern). Check: `M2-STTCFG-DB` (active, D24/D64; `10_test_strategy.md §A.6a`; **Erratum PE-R8-04**).

## C. CHECK changes in 0004 (task item C)

All seven named sites, each with file:line, quoted current text and proposed v2 text. Each swap is
one `ALTER TABLE ... DROP CONSTRAINT` + `ALTER TABLE ... ADD CONSTRAINT` (generated from the typed
schema; the names are unchanged except the added `evidence_items_signature_value_check`).

### C.1 `session_history_outcome_check` — `0001_tables.sql:281` (E-01 site 1 of 3)

Current (quoted): `CHECK (outcome IN ('SEALED','INCOMPLETE') AND (fault_kind IS NULL OR (outcome = 'INCOMPLETE' AND fault_kind IN ('CAMERA_LOSS','MIC_NO_SIGNAL','MIC_CLIP','STORAGE_LOW','STORAGE_FULL','GNSS_LOSS','TAMPER','FAN_STALL','POWER_FAIL','TPM_FAILURE','SECURITY_FAULT','AUDIT_TAMPER'))))`

v2: same shape; the 12-kind list becomes **14 kinds**, adding `MIC_SILENT` and `CAPTURE_FAULT`
(map §5.8 F-14; SH-03 vocabulary; decision E-01). If M0 adds no further fault kind, nothing else
changes at this site — the `outcome='INCOMPLETE'` gate and the 2-value outcome set stay.

### C.2 `alerts_kind_check` — `0001_tables.sql:382` (E-01 site 2 of 3)

Current: `CHECK (severity IN ('INFO','SUCCESS','WARNING','CRITICAL') AND (kind = 'SYSTEM' OR kind IN (…same 12 kinds…)))`

v2: severity list unchanged; the 12-kind list becomes the same **14 kinds** (`MIC_SILENT`,
`CAPTURE_FAULT` added). `MIC_SILENT` raises as WARNING, `CAPTURE_FAULT` as CRITICAL when a file
stops growing (map §5.8; OD-11 warning rule — the values are contract constants, row 29).

### C.3 `health_snapshots_cause_check` — `0001_tables.sql:488` (E-01 site 3 of 3; the row the map missed)

Current: `CHECK (cause IN ('INTERVAL','FAULT_RAISED','FAULT_CLEARED') AND ((cause = 'INTERVAL') = (fault_kind IS NULL)) AND (fault_kind IS NULL OR fault_kind IN (…same 12 kinds…)))`

v2: cause set and the `(cause='INTERVAL') = (fault_kind IS NULL)` equality **unchanged**; the 12-kind
list becomes the same **14 kinds**. Column `health_snapshots.fault_kind` is `0001_tables.sql:474`;
the added site is what E-01 corrects against the map's two-site count.

### C.4 `evidence_items_signature_check` — `0001_tables.sql:336` (OD-04 + OD-03)

Current: `CHECK (signature_algorithm = 'SIMULATED-SHA256' AND signature_simulated)` — blocks every
real signature.

v2:
```sql
CHECK (
  signature_algorithm IN ('SIMULATED-SHA256','Ed25519','ECDSA-P256-SHA256')
  AND (
    (signature_algorithm = 'SIMULATED-SHA256' AND signature_simulated)
    OR (signature_algorithm IN ('Ed25519','ECDSA-P256-SHA256') AND NOT signature_simulated)
  )
)
```
Ed25519 (software, OD-04/D4) is the value v2 seals write now; `ECDSA-P256-SHA256` is pre-declared
for the class-C TPM adapter (C-8) so a hardware key needs no further migration. Same rule mirrored
into `transcript_revisions_signature_check` (B.9).

### C.5 `evidence_items_hashes_check` — `0001_tables.sql:335`, and the new signature-value CHECK (OD-03/W1-C10)

Current: `CHECK (manifest_hash ~ '^[0-9a-f]{64}$' AND signature_value ~ '^[0-9a-f]{64}$')`.
W1-C10 (register §F) fixes the citation: **`:335` is the hashes CHECK, `:336` the signature CHECK**;
a real Ed25519 signature is 64 **bytes** (128 lowercase hex characters), not 64 hex characters, so
the two rules must live in different constraints in v2:

- `evidence_items_hashes_check` (v2 text) carries **only hash columns**, all true SHA-256 digests,
  all 64 hex:
  `CHECK (manifest_hash ~ '^[0-9a-f]{64}$' AND (transcript_sha256 IS NULL OR transcript_sha256 ~ '^[0-9a-f]{64}$'))`
- new `evidence_items_signature_value_check` carries the signature encoding per algorithm:
```sql
CHECK (
  (signature_algorithm = 'SIMULATED-SHA256'    AND signature_value ~ '^([0-9a-f]{2}){32}$')  -- 32-byte digest stand-in
  OR (signature_algorithm = 'Ed25519'           AND signature_value ~ '^([0-9a-f]{2}){64}$')  -- 64-byte signature, lowercase hex (D-DB-03)
  OR (signature_algorithm = 'ECDSA-P256-SHA256' AND signature_value ~ '^([0-9a-f]{2}){64,72}$') -- DER 64-72 bytes, class C pre-declaration
)
```
  (alternation counts whole **bytes**; this also keeps the existing v1 rows — 64 hex chars under
  SIMULATED-SHA256 — valid before the re-seed, A.4).
- OD-03's **two file hashes** are not item columns: they are per-file rows — `evidence_tracks.sha256`
  (stored bytes, the existing column and its hex64 rule at `:354`) and the new
  `evidence_tracks.sha256_plain` (plaintext whole file, nullable column with the same hex64 rule,
  D-DB-02). "Both recorded on every v2 file" is a mapping/seed/verify rule (row 32); the DB column
  stays nullable so 0004 adds it without a data rewrite (MG-8, A.4).

### C.6 Other CHECK swaps required by the register

| Site (file:line) | Constraint | Current | v2 | Decision |
|---|---|---|---|---|
| `0001_tables.sql:338` | `evidence_items_tamper_check` | `tampered_track_id IS NULL OR tampered_track_id IN ('VIDEO-01','VIDEO-02','AUDIO-01','AUDIO-02')` | **unchanged.** OD-01 T1 keeps the 4-value set (map §5.1 "the DB value set can keep 4 values"); OD-01's ID model means `AUDIO-01` now denotes the session audio *inside the camera files*, and `AUDIO-02` is legacy v1 — so what v2 needs is a **code rule**, not a constraint: v2 items may record tampering only on `VIDEO-01`/`VIDEO-02` (the file the fragment lives in; per-fragment location stays in the manifest/verify report, row 32 — the map §6 v2 column list adds no fragment column). Narrowing the CHECK would break the copy-migration path on v1 tamper-demo rows (A.4, D-DB-05) | OD-01 (D4); E-20 |
| `0001_tables.sql:340` | `evidence_items_sources_check` | `integrity_source IN ('DEMO_PACKAGE','SIMULATED') …` | `IN ('DEMO_PACKAGE','SIMULATED','REAL')`; time-source parts unchanged | D-DB-04 (OD-19 guard key) |
| `0001_tables.sql:353` | `evidence_tracks_track_check` | `track_id IN (4 values) AND position BETWEEN 1 AND 4` | **unchanged** (D-DB-05); v2 2-row/position-1..2 shape enforced by mapping/seed/tests | OD-01, OD-02 |
| `0001_tables.sql:354` | `evidence_tracks_values_check` | `size_bytes >= 0 AND sha256 ~ hex64` | plus `codec`/`fragment_chain_head`/`sha256_plain` patterns and `duration_ms >= 0` / `fragment_count >= 0` when present | OD-03 |
| `0001_tables.sql:260` | `active_session_json_check` | object/array bounds of the existing JSON columns | add `jsonb_typeof(capture_config)='object' AND jsonb_typeof(audio_source)='object' AND jsonb_typeof(transcript_status)='object'` | map §6 row 1 |
| `0001_tables.sql:442` | `engine_counters_name_check` | 6 counter names | **unchanged** — v2 mints no new global counter (fragment seq per session; revision_no per item max+1). If row 29/32 later needs one, it is a new CHECK swap + seed row (flagged) | D-DB-07 |
| `0001_tables.sql:199` / `:220` | `*_details_no_secret_keys_check` (audit_log, events) | 17 forbidden keys | **APPLIED (SEC35-22; hardening).** The row-35 review confirmed the extension is needed for the new vocabulary: the swap adds `secret`, `secretCiphertext`, `ciphertext`, `nonce`, `keyRef`, `onvifUuid`, `signedUrl`, `mediaUrl` — **17 -> 25 keys** — and lands in 0004 at both `:199` and `:220`. No defect existed; this closes the reserved hardening | RK-12; E-30; `09_security_design_review.md §3` |

No other CHECK in `0001_tables.sql` changes. Open-set constraints (audit type `:194`, event type
`:216`, permission `:38`, custody action `:295`) are format-checked, so the new vocabulary needs no
migration (MG-11; map §5.4 F-13 "no migration needed"; E-30 rides on those formats).

## D. Privileges in `0005_capture_privileges.sql` (hand-written, task items A+B)

Order of statements (plan text, not executed):

```sql
-- 0005_capture_privileges (hand-written; dbc-3 §D; MG-5, MG-6).
-- No statement names dems_owner or dems_admin (MG-9/OW-9); dems_app exists before this file
-- (OW-8). New tables exist (0004), so the blanket SELECT below covers them; the credential table
-- is then carved back out.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dems_app;                    -- covers the 9 new tables
--> statement-breakpoint
REVOKE SELECT ON capture_device_credentials FROM dems_app;                  -- D-DB-06; RK-12
--> statement-breakpoint
GRANT INSERT ON
  session_audio_intervals, recording_fragments, transcript_chunks,
  transcripts, transcript_revisions, sealing_jobs,
  capture_devices, capture_device_credentials
TO dems_app;
--> statement-breakpoint
GRANT UPDATE (video_01_device_id, video_01_profile, video_02_device_id, video_02_profile,
              mic_primary_id, mic_standby_id, revision, updated_by, updated_at)
  ON capture_config TO dems_app;
--> statement-breakpoint
GRANT UPDATE (transport, model, firmware, address, mac, onvif_uuid, profiles, poe_port,
              enabled, last_seen_at) ON capture_devices TO dems_app;
--> statement-breakpoint
GRANT UPDATE (username, encryption, secret_ciphertext, nonce, key_ref, rotated_at)
  ON capture_device_credentials TO dems_app;
--> statement-breakpoint
GRANT UPDATE (to_media_ms, to_at) ON session_audio_intervals TO dems_app;   -- close the open row only
--> statement-breakpoint
GRANT UPDATE (status, segments, embedding_ref, model_id, computed_at) ON transcript_chunks TO dems_app;
--> statement-breakpoint
GRANT UPDATE (status, progress, eta_ms, attempt, checkpoint, error_code, updated_at)
  ON sealing_jobs TO dems_app;
--> statement-breakpoint
-- recording_fragments, transcripts, transcript_revisions: INSERT only (no UPDATE/DELETE granted).
CREATE FUNCTION public.dems_capture_credential_reveal(p_device_id text) ...; -- owner-defined, SECURITY DEFINER,
-- returns (username, encryption, secret_ciphertext, nonce, key_ref) of one device or no row (D-DB-06);
-- body + narrowing fixed by the row-35 remediation (SEC35-02, B.3): called only by
-- apps/core-server/src/modules/capture-config/credential-reveal.ts, under CAPTURE_CONFIG, and every
-- call writes CAPTURE_CREDENTIAL_REVEALED (deviceId + reason only). PUBLIC revoked; no 4th DB role.
REVOKE ALL ON FUNCTION public.dems_capture_credential_reveal(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.dems_capture_credential_reveal(text) TO dems_app;  -- sole runtime role;
-- runtime reach is narrowed by the single-module static rule, not by a second role (SEC35-02; D-DB-07)
--> statement-breakpoint
UPDATE public.schema_meta SET schema_version = 2, contract_revision = 'dbc-3' WHERE singleton;  -- MG-5
```

Matrix per table (the dbc-2 §7.3 form, runtime role only; `dems_owner` owns and is unbound by
privileges but bound by the append-only triggers precedent — no new trigger is added in v2;
`dems_admin` holds no part in any command, MG-9/HC rules):

| Table | dems_app SELECT | INSERT | UPDATE | DELETE |
|---|:-:|:-:|:-:|:-:|
| `capture_config` | yes | no | 9 columns | no |
| `capture_devices` | yes | yes | 10 columns | no |
| `capture_device_credentials` | **no** (reveal fn only; reach narrowed to one module + audited — SEC35-02) | yes | 6 columns | no |
| `session_audio_intervals` | yes | yes | `to_media_ms, to_at` | no |
| `recording_fragments` | yes | yes | no | no |
| `transcript_chunks` | yes | yes | 5 columns | no |
| `transcripts` | yes | yes | no | no |
| `transcript_revisions` | yes | yes | no | no |
| `sealing_jobs` | yes | yes | 7 columns | no |
| `active_session` | yes (unchanged) | yes (unchanged) | all (unchanged; new columns included) | yes (unchanged) |
| `evidence_items` | yes (unchanged) | yes (unchanged) | unchanged 7-column list; **no grant on `manifest_version`, `transcript_sha256`, `labels_status`** | no |
| `evidence_tracks` | yes (unchanged) | yes (unchanged) | no (unchanged) | no |
| `alerts`, `session_history`, `health_snapshots` | unchanged | unchanged | unchanged/none | no |

## E. Kept-on-reset set, guard and reseed (task item D; OD-19, OD-02/E-20)

### E.1 The kept set (dbc-3 exact list: 11 tables)

| Group | Tables | Carry mode (dbc-2 §8.5) |
|---|---|---|
| Unchanged from dbc-2 | `registry_counters` (update), `console_settings` (update), `pairing_codes`, `paired_devices`, `device_credentials`, `auth_sessions`, `biometric_tokens`, `audit_chain_history` (insert; + lineage append) | `src/db/reset/kept-tables.ts:62-71` |
| Added by R-8 (D20; confirmed, D24, Q-STT-CFG (a); **Erratum PE-R8-05**) | `stt_config` (§B.13) | mode `upsert`; makes the kept set **12** |
| Added by OD-19 | `capture_config`, `capture_devices`, `capture_device_credentials` | **new mode `upsert`** (D-DB-08): UPDATE the seeded built-ins by key, INSERT carried rows the seed does not know (a real discovered device must survive; the seed writes the 5 built-ins `CAM-01/CAM-02/MIC-01/MIC-02/POE-SWITCH`, no credentials). Order: devices -> credentials -> config (FK order). Code lands in CS-21 (M2) |

Everything else is rebuilt from the seed; `core_state.epoch` continues (SPEC-GAP-5 unchanged).
`session_audio_intervals`, `recording_fragments`, `transcript_*`, `sealing_jobs` are data of demo
sessions: **rows removed, tables kept** (rebuilt by seed/fixture — no DDL at reset).

### E.2 Guard: reset blocked while real sealed packages exist (OD-19; RK-16)

Precondition of R-0 (before any quiesce), checked on BOTH sides — DB and disk (fail-safe: any
disagreement blocks):

```sql
-- shape, not executed (owner connection, database <t>):
SELECT 1 FROM evidence_items
 WHERE integrity_source = 'REAL' AND sealed_at IS NOT NULL
 LIMIT 1;
```

- A hit blocks the reset with `RESET_BLOCKED_REAL_EVIDENCE` (reconciled into row 29's final error list
  by SEC35-22; `03_api_contract.md §4`; refuses from the command line and from
  `resetDemo`/`loadScenario`).
- Disk side: the evidence-store package directory (path fixed by CS-02/row 31) must hold **zero**
  packages whose manifest carries `"integrity": "REAL"`-sealed state. DB rows without files or files
  without DB rows also block (a half-deleted real evidence set is exactly what the guard protects).
- Demo items (`DEMO_PACKAGE`, `SIMULATED` — including the v2-regenerated demo evidence, E.3) never
  block; only `REAL` (D-DB-04) does. `release/` packages are outside every project database (DOC-06).
- The check is SELECT-only, so `dems_app` could run a pre-flight preview; the authoritative run
  happens as `dems_owner` inside R-0.

### E.3 What reseeding `dems_demo` does (OD-02 L2; E-20)

| Rule | Content |
|---|---|
| Scope | **one database, `dems_demo`** — lanes do not exist (E-19/E-20) and are created fresh, not reseeded; `release/` untouched (DOC-06; D4 OD-02) |
| Mechanism | `db:seed` refuses a seeded database (SD-3, `seed/seed.ts` rule), so "reseed" is the **reset routine** (R-0..R-9, dbc-2 §8.5) with the v2 seed — build-next/carry/swap/drop |
| v2 evidence | the 13 dataset items + 14 frozen packages are regenerated as v2 by the SH-24 generators (host FFmpeg; D7 TTS fixture) and seeded: `manifest_version = 2`, two file tracks with both hashes, fragment chain rows, one `transcripts` row per sealed item, intervals for every session; `integrity_source = 'DEMO_PACKAGE'`; demo signature `Ed25519` + `signature_simulated = false` or simulated per generator choice fixed by row 32 — the CHECKs accept both (C.4) |
| Tamper demo | EV-0005 re-scripted on one fragment of one file (`tampered`, `tampered_track_id = VIDEO-0n`; D4 OD-02) |
| Vocabulary | seed writes 14 permissions (+`CAPTURE_CONFIG`, +`TRANSCRIPT_REVISE`) and 22 role-permission grants (from `ROLE_PERMISSIONS`, `packages/shared/src/sim/auth.ts:46-71`; SUPERVISOR 12, INVESTIGATOR 5, TECHNICIAN 5 — SH-04, D88 boot equality kept) |
| Site config | default `capture_config` row + 5 built-in `capture_devices` rows written; `capture_device_credentials` seeded empty (a secret is never seeded; SD-8) |

## F. Lane re-creation procedure (task item E; E-24, D240)

State today: only `dems_demo` exists; the lane databases and lane pairings are gone (drift §4; D240:
"databases afterwards `dems_demo`, `postgres`, `template0`, `template1`"). Three emulators
(DEV-0003/0004/0005) stay paired to the main instance until M2 re-pairs per lane
(`structured` §Cross-task continuity).

**Who runs it:** the first M2 row of blueprint rev 2 (row 40 creates it; `structured` §10 line 383,
DP-7), after 0004/0005 exist and pass the M2 migration checks. Procedure, per lane `dems_lane_n`
(n = 1..3), from the repository root:

| # | Command | Note |
|--:|---|---|
| 1 | `npm run pg:start` | project cluster only; refuses silently when already running (D240) |
| 2 | `npm run db:create -- --database dems_lane_n` | creates the database owned by `dems_demo` owner role; refuses names outside the closed list (`database-names.ts:18`) |
| 3 | `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -- --database dems_lane_n` | applies 0000..0005 in journal order (lanes migrate freely per code; the lock wraps the whole session for P16 hygiene); `/usr/bin/lockf`, never `flock` (memory `reference-dems-environment-gotchas`) |
| 4 | `npm run db:seed -- --database dems_lane_n` | v2 seed (E.3); `lockf` also covers `db:seed` on `dems_demo` per README:260-266 |
| 5 | start Core per lane: ports **4421, 4422, 4423** (one server process per database, DA-07); main instance stays on 4420 | `structured` line 383; drift line 234 |
| 6 | start Vite per lane: **5176, 5177, 5178** | drift line 234 |
| 7 | per-lane device re-pairing: map `tcp:4420` to the lane port (`adb reverse`, `README.md:141`), issue a pairing code on that lane, redeem, then record — **recordings start only after the redeem call has returned** (D258; E-24) | pairing is per database (drift line 235) |
| 8 | on `dems_demo` itself: `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -- --database dems_demo`, then the v2 reseed via `db:reset` (E.3) — while it is not blocked by E.2 | the main instance keeps its three pairings (kept tables survive) |

Expected state afterwards: four project databases (`dems_demo`, `dems_lane_1..3`) all at schema 2 /
`dbc-3`, seeded v2; three lanes each with a paired tablet/phone session of its own; three emulators
re-pairable; `postgres`/`template0`/`template1` untouched.

**Red lines (hard):** project PostgreSQL only on `127.0.0.1:4432`, managed solely through
`scripts/pg` (`pg:start`/`pg:stop`/`pg:status`; D240 "4432 and 4420 on 127.0.0.1 only") — never the
host's `*:5432`, never connect to a non-project cluster. Never print or pass the values of
`.data/pg.pwfile`, `.data/pg.owner.env`, `.data/pg.env` (existence verified in `.data/`; CR-4/HC-1..5:
no secret in an argument, an environment variable or any log; commands read the files themselves).
Never touch SMART WMS ports 5173/5174/5175.

## G. Migration test plan (task item F)

**Ground rule: migrations are never applied to the live `dems_demo` by a test.** The named paths:

| Path | Target | How |
|---|---|---|
| Throw-away copy of `dems_demo` (the hard-gate phrase) | `dems_test_capture_*` (`TEST_DATABASE_PATTERN`, `database-names.ts:22`; commands accept it only with the test seam `allowTestDatabase`, TI rule) | clone the seeded v1 `dems_demo` into a throw-away database the way W98 did ("copy via a throw-away database", drift line 184; dbc-2 §10 isolation), apply 0004/0005 there, destroy after |
| Fresh lanes | `dems_lane_1..3` after `db:create` | real names, closed list; empty -> full set 0000..0005 |
| Unit-style migration/catalog tests | the test helper's template-built databases | once per checkpoint (blueprint §6: unit/regression suites run once per workspace per checkpoint) |

Named checks:

| # | Check | Pass condition | Where |
|--:|---|---|---|
| MT-1 | Migration applies cleanly on both paths | `db:migrate` exit 0 on the v1 copy and on a fresh lane; ledger current; `schema_meta = (2,'dbc-3')`; second run applies nothing (MG-10) | db project |
| MT-2 | Copy-migration on live data | 0004 validates against the v1 rows without any data rewrite (A.4): v1 items keep `manifest_version = 1`, old tracks/position/tamper rows still satisfy the kept CHECKs (D-DB-05) | db project, on the throw-away copy |
| MT-3 | CHECKs accept the new / reject the old | inserts of fault kinds `MIC_SILENT`/`CAPTURE_FAULT` (all three tables) and rejection of a 15th value; `Ed25519` + 128-hex + `signature_simulated=false` accepted, `Ed25519` + 64-hex or `simulated=true` rejected; `SIMULATED-SHA256` + 64-hex still accepted; `integrity_source='REAL'` accepted; unknown `kind` on `capture_devices` rejected; `(to_media_ms IS NULL) <> (to_at IS NULL)` interval rejected; second open-interval partial-unique rejection | db project |
| MT-4 | Privileges match section D | `has_table_privilege('dems_app', ...)` matrix equals D; the nine SELECT probes; **`SELECT capture_device_credentials` fails 42501 for `dems_app`**, the reveal function returns the row; UPDATE on an INSERT-only table (`recording_fragments`) fails 42501; UPDATE on a sealed new column fails 42501 | db project (T-PV pattern, dbc-2 §7) |
| MT-5 | Reset keeps the kept set, rebuilds the rest | after a reset on the copy/lane: 11 kept tables image-equal (R-6 compare incl. the three upsert tables — a runtime-added device row survives), all other tables equal the v2 seed checksums for the same `now`; epoch +1; lineage appended | db project |
| MT-6 | Reset guard (OD-19) | seed a `REAL` sealed row into the copy -> `db:reset` refuses `RESET_BLOCKED_REAL_EVIDENCE` before R-1, database untouched; demo (`DEMO_PACKAGE` v2) rows never block | db project |
| MT-7 | Seed + bulk fixture v2 counts (CS-19/CS-20) | seed: 14 permissions, 22 grants, 1 `capture_config`, 5 built-in devices, 0 credentials, v2 items with both track hashes and one transcript each; bulk fixture meets the G minimums table; `rbac.matrix` boot equality (D88) holds | db project |
| MT-8 | Catalog/vocabulary pin | catalog text of the three swapped FAULT_KIND CHECKs equals the 14-kind shared constant (CL-12/GD-05 pattern); `value-sets.ts` edited in the same commit (file header rule `value-sets.ts:5-9`) | db project |

Bulk-fixture v2 minimums added to the dbc-2 §11 table (total after seed + fixture; the 12 rows of
the unchanged tables keep their dbc-2 numbers, three are revised):

| Table | Minimum | Mix |
|---|--:|---|
| `permissions` / `role_permissions` | **14 / 22** (revised) | +`CAPTURE_CONFIG`, +`TRANSCRIPT_REVISE`, all three roles present |
| `evidence_items` | 505 (**revised mix**) | as dbc-2 §11 and all rows `manifest_version = 2`, every SEALED row with `transcript_sha256` non-null; ≥10 tampered on `VIDEO-0n` |
| `evidence_tracks` | **1,010 (revised)** | exactly 2 per item, both files, both hashes present and distinct when encrypted |
| `capture_config` | 1 | default singleton |
| `capture_devices` | 8 | 5 built-ins + 3 discovered variants; ≥1 dual-profile camera (OD-05) |
| `capture_device_credentials` | 2 | fake devices only; ≥1 rotated (`rotated_at` later than another row) |
| `session_audio_intervals` | 720 | ≥1 per sealed session; ≥150 rows over 50 switched sessions (2-3 intervals, `reason='MANUAL'`, `switched_by` non-null); one open interval in the RECORDING variant |
| `recording_fragments` | 6,500 | contiguous full chains for the 40 newest sessions (2 tracks; head equals `fragment_chain_head`); sampled rows elsewhere; `seq` gaps rejected in a negative test |
| `transcript_chunks` | 2,000 | contiguous audio ranges; ≥20 FAILED->rerun pairs; ≥95% DONE with segments arrays |
| `transcripts` | 400 | one per SEALED; ≥30 `labels_status='UNAVAILABLE'`; both labels values present |
| `transcript_revisions` | 30 | ≥5 items with chained revisions (`parent_sha256` links); Ed25519-shaped signature |
| `sealing_jobs` | 3,000 | every step of every SEALED session DONE; ≥20 `attempt >= 2` with `status='DONE'` (resumed via RECOVERY); one RUNNING job in the RECOVERY variant; ≥5 non-null checkpoints |
| `alerts` | 250 (mix revised) | every fault kind **of 14** present; `MIC_SILENT` ≥10 rows |

Run counts: the blueprint's rule applies — **2 + 1 for the DB-backed gate checks** where the
milestone gate asks for a device/DB-backed verification (M2 gate: "migrations 0004/0005 on a
throw-away copy of `dems_demo` and on fresh lanes" runs 2 + 1, `structured` §6 M2), and
**once per checkpoint** for the unit-style migration/catalog tests (MT-8 class, blueprint §6 intro).
Command forms (workspace scripts quoted from `apps/core-server/package.json:12` and the root alias
`package.json:42`):

```sh
npm run test:db -w @dems/core-server -- --maxWorkers=2   # vitest 5.0.3 honours --maxWorkers (D12(c), corrected W1-C7)
npm run db:status -- --database dems_demo               # version/ledger readout after migration
/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -- --database dems_demo
```

No test connects to `dems_demo` for a migration (TI rule: database tests run on their own
databases; `database-names.ts:12-13`).

## H. B16 errata (i)-(v) — applied or carried (task item G)

Source row: `docs/2026-10-04_dems_backend_rbac_pairing/report/01_report_inputs.md:215` (B16), with
the proposal texts at `gateway_check/10b_closing_fixes_c2.md` §2.6 and the W90 findings at
`verification/03_clean_state_rebuild.md` §13 (F-4 `:218`-area, F-6, F-7; hour-change per D244/C3).

| # | Item (quote, condensed) | Disposition in dbc-3 | Where / reason |
|--:|---|---|---|
| (i) | C2-R3: the NL-1, NL-5 and file-table sentences proposed at `10b_closing_fixes_c2.md:145-151`; `grep -c terse masterplan/03_database_contract.md` gives 0, so not applied | **APPLIED** | Section I restates NL-1/NL-5 with the proposed text verbatim in effect (terse verbosity, collector ring of 24 hourly `postgresql-HH.log` files mode 0600, `log_rotation_age = 1h`, `log_truncate_on_rotation = on`, `log_rotation_size = 0`; the `.data/postgres.log` file-table row corrected to "what the server writes before the collector starts"). dbc-2's stale sentences are not re-issued (B16: "specs are not re-issued"); dbc-3 supersedes them here (DOC-03) |
| (ii) | W90 F-4: terse logging still writes one `STATEMENT:` line per ERROR, placeholders only, no secret (`03_clean_state_rebuild.md:218`; confirmed by C3, D244) | **APPLIED** | Folded into the NL-1 restatement in section I: a refused statement writes its ERROR line (constraint name) and its STATEMENT line (placeholders only, NL-3), no DETAIL line — so no failing row and no key value reaches the log. This matters for the new v2 CHECK rejections (MT-3 relies on it: the failed inserts of secrets-shaped values are named by constraint, never by value) |
| (iii) | W90 F-6: lock-message wording, cosmetic — `db:migrate`/`db:seed` print the "must be run under the migrate lock" line even when run under it (exit 0) | **CARRIED** | It is a message-string fix in code (`commands/migrate.ts:53`), not a schema/contract rule; owned by the M2 row that edits the commands (CS-17 family; original route W93 per the B16 row). dbc-3 restates the rule the message describes (§A.3, F lane step 3) so no contract text is wrong meanwhile |
| (iv) | W90 F-7 / C2-R2: a failed `pg:start` after the collector starts shows the wrong log tail (`.data/postgres.log` holds ~1 line), not exercised | **CARRIED** | It lives in `scripts/pg/start.mjs`, outside the database contract's schema/command surface (dbc-2 §7.6/HA rules; routed W102 in D195). Contract-level consequence is stated in section I so any later fix keeps it: on a `pg:init`-built cluster the server's own log is the collector ring file, so failure guidance must name it, not `.data/postgres.log`. Exercising it needs an induced start failure — a `scripts/pg` test, proposed to row 36 as a named check outside the lane DB |
| (v) | C3: the hour-change path of the log ring not exercised (D244) | **CARRIED** | Rotation behaviour is cluster/logging state, not schema; dbc-3 applies the *wording* (I) and carries the *test gap*: named idea T-NL-2 (force `log_rotation_age` rollover or fake the hour in a `scripts/pg` unit test — assert 24 ring files, truncate-on-rotation, mode 0600). Route: row 36 test strategy + the M2/M9 scripts test slot; D244 already logged it |

## I. Never-log restatement (absorbs (i)+(ii); NL-1/NL-5 as they hold for dbc-3)

| Rule | Text |
|---|---|
| NL-1 (never-log tables) | Carried unchanged from dbc-2, extended: the credential-bearing tables are now `operator_credentials`, `device_credentials`, `auth_sessions.token_hash`, `biometric_tokens.token_hash`, `pairing_codes.code_hash`, and **`capture_device_credentials`** (whole row; the reveal function's result likewise never enters a log, a slice or an audit detail). PostgreSQL's own log: with `log_error_verbosity = terse` a refused statement writes its ERROR line (with the constraint's name) and its STATEMENT line (placeholders only, NL-3), but no DETAIL line — so no failing row and no key value. Holds for the cluster created by `pg:init` after closing-fix round C2 (W90) |
| NL-5 (logging settings) | What PostgreSQL logs stays at its defaults (`log_statement = 'none'`, `log_min_duration_statement = -1`, `log_parameter_max_length_on_error = 0`); `scripts/pg/` MUST NOT change these. How the log is written is set by `pg:init` (security ruling 14, CPS1-9): `log_error_verbosity = terse`; collector on; ring of 24 hourly files `.data/postgres/log/postgresql-HH.log`, truncated when its hour comes round (`log_rotation_age = 1h`, `log_truncate_on_rotation = on`, `log_rotation_size = 0`, `log_file_mode = 0600`). `.data/postgres.log` (`pg_ctl -l`) keeps only what the server writes before the collector starts (about one line per start); the log check of W17-class reads the collector file |
| Constraint names carry information | Every v2 rejection (MT-3) is identifiable from the constraint name alone; the new constraint names follow N-4 and each contains its table name |

## J. Register-row coverage for this contract

| Register row | Contract section |
|---|---|
| CS-16 schema files | B, C (typed-schema edits listed per table; `value-sets.ts` 14 kinds) |
| CS-17 migrations 0004/0005 + snapshots | A; E-19 folded (lane path F) |
| CS-18 mapping v2 shapes | B (MR rules named where a DB CHECK cannot reach: MR-V1 fragment-count equality, revision parent chain, D-DB-05 shape rules) |
| CS-19 seed v2/permissions/config | E.3 |
| CS-20 bulk fixture v2 | G minimums |
| CS-21 reset keep + fence | E |
| CS-24 privileges 0005 | D |
| SH-01/SH-02 vocab+entities | B (track/step enumerations; entity map §0.3) |
| E-01 / E-19 / E-20 / E-24 / E-30 | C.1-C.3 / A.3+F / E.3 / F / C.6 last row + E.2 + B.3 |
| W1-C7 / W1-C10 | G command forms / C.5 citation split |
| OD-01 / OD-02 / OD-03 / OD-04 / OD-19 | C.5-C.6, B.12 / E.3 / C.5, B.12, B.6 / C.4, B.9 / E |
| RK-12 / RK-16 | B.3, D, I / E.2 |
| DOC-03 | this file supersedes the dbc-2 DB contract position; dbc-2 stays as issued history |

## K. Decisions taken by this contract (for the controller and the row-39 gate)

| ID | Decision | Alternative rejected | Why |
|---|---|---|---|
| D-DB-01 | `manifest_version smallint NOT NULL DEFAULT 1 CHECK IN (1,2)`; seed/fixture write 2 | default 2 | 0004 labels nothing falsely: live copy rows are v1 until reseed (A.4); map §6 proposed default 1 |
| D-DB-02 | two-hash shape: `sha256` = stored bytes (kept column), `sha256_plain` = plaintext (new nullable column); "both recorded" enforced by mapping/seed/verify | rename `sha256`; NOT NULL + backfill | rename/backfill put a data rewrite or a hand statement into a generated file (MG-2/MG-8); nullable column keeps 0004 pure-generated (A.4) |
| D-DB-03 | signature values stored as lowercase hex; 1 byte = 2 regex units per algorithm | base64 | matches the existing lowercase-hex house style (`:335`, audit hashes) |
| D-DB-04 | `integrity_source` gains `REAL`; the OD-19 guard keys on it | file-only guard | the DB and the disk must agree (E.2); a marker value in the sealed row is queryable, auditable and survives as evidence metadata |
| D-DB-05 | tamper/track value-set CHECKs (`:338`, `:353`) kept permissive; v2 shape enforced by code | narrow now | narrowing would fail 0004 validation against the v1 rows (A.4) and contradicts OD-01 T1's stated benefit |
| D-DB-06 | no SELECT on `capture_device_credentials` for `dems_app`; owner `SECURITY DEFINER` reveal function | SELECT kept (map §6 "SELECT only for supervisor path") | the map's own parenthetical ("design review") + least privilege: one table, one function, one grant line; RK-12 |
| D-DB-07 | no FKs from live-session tables (`session_audio_intervals`, `recording_fragments`, `transcript_chunks`, `sealing_jobs`) to `session_history`; format CHECK + mapping rule; no new sequences; no new DB roles | FK DEFERRABLE | rows are written while the session exists only in `active_session`; a deferred FK could not validate at those commits; the dbc-2 §1.7 counter precedent |
| D-DB-08 | kept-mode `upsert` for the three kept capture tables | pure insert/update | the seed writes built-ins (collision on insert) while runtime-added real devices must survive (loss on update) |
| D-DB-09 | permission/grant rows arrive by the seed only; **no permission inserts in 0004** | map §6 "in 0004 for live databases" | MG-8 (a migration holds no dataset rows) and E-19/E-20 removed the "live lane database" that needed them: lanes are fresh create+migrate+seed; `dems_demo` is reset (E.3). This overrides that map cell — recorded as an errata application |
| D-DB-10 | `capture_config` selector CHECK allows one device in both video slots only with distinct profiles | require distinct device IDs | OD-05 supports the dual-lens topology |

## L. Self-gate (row-30 Verification, stated explicitly)

| Gate item | Result |
|---|---|
| 3/3 FAULT_KIND CHECK sites with file:line | C.1 `0001_tables.sql:281`, C.2 `:382`, C.3 `:488` (plus the signature site C.4 `:336` and hashes site C.5 `:335`, tamper C.6 `:338`, sources `:340`, tracks `:353/:354`, json `:260`) — PASS |
| Every new table has columns, privileges, reset policy | B.1-B.9: 9/9 (each: column table, privilege line, reset line); changed tables B.10-B.12 + C — PASS |
| B16 items (i)-(v) each applied or carried with a reason | H: (i) APPLIED, (ii) APPLIED, (iii) CARRIED, (iv) CARRIED, (v) CARRIED — 5/5 — PASS |
| Migration test plan names a throw-away copy of `dems_demo` plus fresh lanes | G paths 1-2 (MT-1..MT-8) — PASS |
| 9-new/5-changed count reconciled with the register | §0.2 reconciliation table (9/5 + E-01's 6th CHECK-only + 3 data-only; 30 -> 39 tables) — PASS |
| Security-review remediation applied (SEC35-02/03/20/21/22) | B.3 (reveal narrowing + key store + audit), B.9 (`signature_certificate_sha256` column + `baseRevision` mapping), C.6 (forbidden-key swap 17 -> 25 at `:199`/`:220`), E.2 (code reconciled with row 29) — PASS |
| Kept-on-reset set + guard query shape + reseed scope | E.1 (11 tables), E.2 (query + disk), E.3 (`dems_demo` only, `release/` untouched) — PASS |
| No emoji; English; no file outside the task folder touched; no SQL executed; no DB connection | this document + `delegation_progress/database-specialist__row30.md` are the only writes — PASS |

## M. Open points routed out (not blockers for this row)

| # | Point | Routed to |
|--:|---|---|
| 1 | Exact `dems_capture_credential_reveal` body + whether any read is audited | Row 35 review found SEC35-02; the **design is now fixed** in B.3/D (single module, `CAPTURE_CONFIG`, `CAPTURE_CREDENTIAL_REVEALED`); M2 (rev 2) writes the body |
| 2 | Forbidden-key list additions (`secret`, `secretCiphertext`, `ciphertext`, `nonce`, `keyRef`, `onvifUuid`, `signedUrl`, `mediaUrl`) at `:199/:220` | **APPLIED** (SEC35-22) — swap lands in 0004 (17 -> 25 keys); M2 writes it |
| 3 | Final error code name for `RESET_BLOCKED_REAL_EVIDENCE`; sealing `step` enum pinning | row 29 (contract C3) |
| 4 | Manifest v2 semantics for both file hashes, verify invariants (MR-V1), demo signature simulated-or-real | row 32 (evidence package spec) |
| 5 | fsync/durable_at write policy | row 31 (capture architecture) |
| 6 | Pinned run counts of MT checks in the gate table | row 36 (test strategy) |
| 7 | W-rows implementing 0004/0005 + kept-tables.ts + reveal function; lane re-creation as first M2 row | row 37 (plan) and row 40 (rev-2 rows) |

---
*Generated: 2026-10-07 10:05*
*Last Updated: 2026-10-09 (status sweep PE-R8-01..05: §B.13 confirmed by D24); 2026-10-08 (RV-SPEC: §B.13 `stt_config`, R-8/D20, added as a proposal; earlier: row-35 security remediation SEC35-02/03/20/21/22)*
