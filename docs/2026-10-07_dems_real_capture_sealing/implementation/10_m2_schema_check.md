---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 45 (phase C, milestone M2, class B; M2-W2; blueprint rev 2.1)
date: 2026-10-08
agent: database-specialist (fallback for database-specialist, free tier)
source_plan: identification/02_structured.md rev 2.1 row 45; masterplan/04_database_contract.md (dbc-3) §B, §C.1-§C.6, §A.2, §G
narrative_tier: 3
status: needs-review - schema source authored and verified; root `typecheck` cannot reach exit 0 inside this row's file set (see §8)
closes: CS-16 (schema-source half), E-01, W1-C10, SEC35-22; SH-01/SH-02 half (DB side; shared enums and entities land in row 47)
---

# Row 45 / M2-W2: typed schema v2 in the source tree (no live migration)

## 0. Summary

| Item | Result |
|---|---|
| New tables per dbc-3 §B | **9 / 9** authored (`capture_devices`, `capture_config`, `capture_device_credentials`, `session_audio_intervals`, `recording_fragments`, `transcript_chunks`, `transcripts`, `transcript_revisions`, `sealing_jobs`) |
| `stt_config` (dbc-3 §B.13) | **not authored** - proposed only, uncounted until Q-STT-CFG; the count stays 30 -> 39 |
| Changed tables per dbc-3 §B.10-§B.12 | **3 / 3**: `active_session` +5 columns, `evidence_items` +3, `evidence_tracks` +7 |
| `value-sets.ts` FAULT_KIND | **14 values** (`MIC_SILENT`, `CAPTURE_FAULT` appended in contract order) |
| CHECK swaps per §C | **7 / 7 named sites** plus the two audit secret-key sites `:199`/`:220` expanded **17 -> 25** |
| Typed-schema totals | 39 tables, 405 columns, 156 named CHECKs, 38 foreign keys, 41 indexes/uniques (v1 baseline: 30 / 302 / 98 / 25) |
| Migration applied to any live database | **none** - proved in §7.5 (all four `dems_*` databases still `(1,'dbc-2')`, 30 base tables, journal 4 rows; no `0004`/`0005` file exists) |
| `npm run lint` (root) | exit **0** |
| `npm run typecheck` (root) | exit **2**: 14 errors, **all outside `src/db/schema/`**, all caused by the shared-vocabulary and mapping lag owned by rows 47 and 49 (§8) |
| core-server unit suite (`--maxWorkers=2`) | `Tests 8 failed \| 3946 passed (3954)`, `Test Files 3 failed \| 157 passed (160)` - the 8 are v1 count pins, §7.4 |

## 1. Scope gate (what this row must not do, and did not)

* No `db:migrate`, no `db:generate`, no SQL applied to any database. The commands actually run against
  PostgreSQL were five read-only `SELECT`s through the project's own owner-pool helper
  (`src/db/commands/owner-connection.ts:122`, `:186`), listed verbatim in §7.5.
* Nothing was written to `apps/core-server/src/db/migrations/`; `drizzle-kit generate` is row 46's
  deliverable and would have created `0004_capture.sql` + snapshot + journal entry here.
* `DB_SCHEMA_VERSION` / `DB_CONTRACT_REVISION` (`src/db/schema/meta.ts:16`, `:18`) were **left at
  `1` / `'dbc-2'` on purpose**. MG-5 puts the version in the last file of a migration set, and
  boot check B-3 (`src/db/schema/boot-checks.ts:101-133`) compares those constants with
  `schema_meta`; bumping them now would make the server refuse to boot against the still-unmigrated
  `dems_demo` and the three lanes - i.e. it would be a live-DB effect of a source-only row. The bump
  belongs to row 46 with `0005_capture_privileges.sql`.
* Files touched are exactly the ones named by the row (§2). No file under `apps/mock-core/**`,
  `release/**`, `src/db/mapping/**`, `src/db/fixtures/**`, `packages/shared/**`, or any
  controller-owned tracker was edited.

## 2. Files created and changed

| File | Change | Content |
|---|---|---|
| `apps/core-server/src/db/schema/capture.ts` | **new** (175 lines) | T-32 `capture_devices`, T-31 `capture_config`, T-33 `capture_device_credentials` (dbc-3 §B.2, §B.1, §B.3), declaration order = §A.2 #1-#3 |
| `apps/core-server/src/db/schema/recording.ts` | **new** (164 lines) | T-34 `session_audio_intervals`, T-35 `recording_fragments`, T-39 `sealing_jobs` (§B.5, §B.6, §B.4) |
| `apps/core-server/src/db/schema/transcript.ts` | **new** (177 lines) | T-36 `transcript_chunks`, T-37 `transcripts`, T-38 `transcript_revisions` (§B.7-§B.9) |
| `apps/core-server/src/db/schema/value-sets.ts` | modify (+66/-8) | FAULT_KIND 12 -> 14 (`:63-79`); INTEGRITY_SOURCE + `REAL` (`:96`); AUDIT_DETAIL_FORBIDDEN_KEYS 17 -> 25 (`:169-193`); nine new closed sets (`:134-155`) + their types |
| `apps/core-server/src/db/schema/checks.ts` | modify (+51/-1) | `noSecretKeys` doc now 25 (`:52`); `SIGNATURE_HEX_BY_ALGORITHM` (`:61`), `signatureRule()` (`:75`), `signatureValue()` (`:89`) |
| `apps/core-server/src/db/schema/evidence.ts` | modify (+80/-14) | item v2 columns (`:101-103`), hashes/signature/signature-value/manifest/labels swaps (`:147-181`), track v2 columns (`:209-215`), `:353` kept and `:354` widened (`:228-236`) |
| `apps/core-server/src/db/schema/sessions.ts` | modify (+28/-1) | `started_by`/`stopped_by` (`:55-56`) + 2 FKs, three v2 snapshot columns (`:78-80`), `active_session_json_check` swap (`:131-133`) |
| `apps/core-server/src/db/schema/index.ts` | modify (+25/-8) | re-exports `./capture`, `./recording`, `./transcript`; header now counts 39 tables and records the row-45/row-46 split |

Diff total: `5 files changed, 230 insertions(+), 20 deletions(-)` plus the three new files. No commit was made (none was requested).

## 3. The nine new tables (dbc-3 §B)

Column, CHECK, foreign-key and index counts are rendered from the typed schema with the drizzle PostgreSQL dialect - no
connection, no DDL executed (the render command and its output are the same harness as §7.2; the raw dump is
`/tmp/m2w2_new_tables.txt`).

| Table | Source | Cols | CHECKs | FKs | Indexes | Reset (§B.0) |
|---|---|--:|--:|--:|---|---|
| `capture_devices` | capture.ts:32 | 12 | 6 | 0 | `capture_devices_kind_idx` | KEPT upsert |
| `capture_config` | capture.ts:72 | 10 | 5 | 5 | none (singleton PK) | KEPT upsert |
| `capture_device_credentials` | capture.ts:142 | 7 | 5 | 1 | none | KEPT upsert |
| `session_audio_intervals` | recording.ts:37 | 10 | 6 | 2 | partial unique `session_audio_intervals_one_open_key` (`recording.ts:53-55`, `WHERE to_media_ms IS NULL`, PG-08) | rebuilt |
| `recording_fragments` | recording.ts:94 | 10 | 6 | 0 | PK covers the chain scan | rebuilt |
| `sealing_jobs` | recording.ts:132 | 10 | 8 | 0 | PK covers reads by session | rebuilt |
| `transcript_chunks` | transcript.ts:37 | 9 | 7 | 0 | PK | rebuilt |
| `transcripts` | transcript.ts:76 | 8 | 3 | 1 | singleton per item | rebuilt |
| `transcript_revisions` | transcript.ts:121 | 12 | 7 | 2 | PK (`evidence_id`,`revision_no`) | rebuilt |

Contract-fidelity notes:

* No foreign key to `session_history` anywhere in the new group (D-DB-07: those rows are written
  during `RECORDING`/`FINALIZING`); the session id is format-checked instead
  (`recording_fragments_session_check`, `transcript_chunks_session_check`, `sealing_jobs_session_check`,
  and `session_audio_intervals` carries its own SES-format CHECK (`recording.ts:70`)).
* `capture_device_credentials` uses the single `bytea` type of `bytea.ts` (`secret_ciphertext`,
  `nonce`) with `octet_length(...) >= 33` and `= 12` CHECKs; `key_ref` is `CODE` (a reference, never
  key material, SEC35-03). Privileges (no SELECT for `dems_app`, the `SECURITY DEFINER` reveal
  function) are §D material and therefore row 46's, not this file's.
* Media profiles, transports, PoE port names and sealing step names stay **open** `CODE` sets
  (OD-06/OD-07, MG-11, §B.4), so the `CLOSE_TRACKS..STORE_SEALED_PACKAGE` vocabulary needs no DB CHECK.
* `transcript_chunks_done_check` is written as the implication-disjunction PostgreSQL understands:
  `(status <> 'DONE') OR (segments IS NOT NULL AND computed_at IS NOT NULL)`.
* `transcript_revisions_signature_check` carries C.4 restricted to the two algorithms B.9 names
  (`Ed25519`, `SIMULATED-SHA256`, no class-C pre-declaration); `signature_certificate_sha256` is
  hex64-or-null (SEC35-20).
* `baseRevision` (SEC35-21) got **no column**, as the contract requires: it is `max(revision_no)` read
  inside the minting transaction.

## 4. The three changed tables

| Table | New columns (file:line) | Notes |
|---|---|---|
| `active_session` | `started_by` `:55`, `stopped_by` `:56` (FK operators RESTRICT, closes FXC-1); `capture_config` `:78`, `audio_source` `:79`, `transcript_status` `:80` (`jsonb NOT NULL DEFAULT '{}'::jsonb`) | The three snapshots carry no `$type` yet: their wire types are the SH-05 slices of row 47. `finalization` gains progress/ETA as **shape only** - no DDL, per §B.10 |
| `evidence_items` | `manifest_version smallint NOT NULL DEFAULT 1` `:101`; `transcript_sha256` `:102`; `labels_status` `:103` | Default 1 keeps every v1 row valid before the re-seed (D-DB-01). No new sealed column joins the UPDATE grant list (map §6) - that list is a privilege, row 46 |
| `evidence_tracks` | `kind DEFAULT 'FILE'` `:209`; `contains_audio DEFAULT true` `:210`; `codec` `:211`; `duration_ms` `:212`; `fragment_count` `:213`; `fragment_chain_head` `:214`; `sha256_plain` `:215` | `sha256` is untouched and now documented as the **stored-bytes** hash; `sha256_plain` is the plaintext whole-file hash (D-DB-02), nullable so 0004 adds it without a data rewrite (§A.4, MG-8) |

New columns are declared **after** the pre-existing ones in all three tables, so `db:generate` emits
plain `ADD COLUMN` statements in §A.2 order (#10, #11, #13) and the v1 column order stays a prefix.

## 5. `value-sets.ts` (item 2 of the row)

```ts
63: export const FAULT_KIND = [ ... 'AUDIT_TAMPER',
76:   'MIC_SILENT',
77:   'CAPTURE_FAULT',
78: ] as const;                                   // 14 values
96: export const INTEGRITY_SOURCE = ['DEMO_PACKAGE', 'SIMULATED', 'REAL'] as const;
169: export const AUDIT_DETAIL_FORBIDDEN_KEYS = [ ...17 v1 keys...,
       'secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl' ] // 25
```

The two fault kinds are appended in the order dbc-3 §C.1 writes them, and `value-sets.ts:56-62` records
that the shared enum `FaultKind` (`packages/shared/src/sim/vocabulary.ts:193-206`, today 12 values) must
grow in the **same order** for the CL-12 pin and M2-MT-8 to compare two equal lists. Nine new closed sets
were added at `:134-155`: `CAPTURE_DEVICE_KIND`, `MIC_ROLE`, `AUDIO_INTERVAL_REASON`,
`SEALING_JOB_STATUS`, `TRANSCRIPT_CHUNK_STATUS`, `LABELS_STATUS`, `TRACK_KIND`, `SIGNATURE_ALGORITHM`,
`TRANSCRIPT_SIGNATURE_ALGORITHM`, each with its `...Value` type alias.

## 6. CHECK swaps (item 3 of the row), site by site

"Before" is the quoted current text of `apps/core-server/src/db/migrations/0001_tables.sql` (unchanged,
verified byte-identical with HEAD). "After" is the text the typed schema now generates, rendered offline.

### 6.1 The three FAULT_KIND sites (E-01) - 3 / 3 swapped

All three are built from the single `FAULT_KIND` constant, so one edit of `value-sets.ts:63-79` swaps
each of them; the source sites are unchanged in `sessions.ts` and `core.ts`, which is why CS-16 can list
`core.ts` as affected while `core.ts` needs no diff.

| Site | Before (migration, quoted tail) | Source site | After (generated) |
|---|---|---|---|
| 1 of 3 `session_history_outcome_check` | `0001_tables.sql:281` `... "fault_kind" IN ('CAMERA_LOSS', ... 'AUDIT_TAMPER'))))` (12 kinds) | `sessions.ts:169-171` | `... "fault_kind" IN ('CAMERA_LOSS', ..., 'AUDIT_TAMPER', 'MIC_SILENT', 'CAPTURE_FAULT')))` - 14 kinds; outcome set and the `outcome = 'INCOMPLETE'` gate unchanged |
| 2 of 3 `alerts_kind_check` | `0001_tables.sql:382` `... "kind" = 'SYSTEM' OR "kind" IN (...12 kinds...)` | `core.ts:87-90` (reads `FAULT_KIND`) | same 14-kind list; severity list unchanged |
| 3 of 3 `health_snapshots_cause_check` | `0001_tables.sql:488` `... cause set AND ((cause = 'INTERVAL') = (fault_kind IS NULL)) AND (fault_kind ... IN (...12 kinds...))` | `core.ts:263-266` (reads `FAULT_KIND`) | same 14-kind list; cause set and the `(cause='INTERVAL') = (fault_kind IS NULL)` equality unchanged (column `0001_tables.sql:474`) |

### 6.2 The signature pair, `:335` and `:336` (OD-03/OD-04, W1-C10)

| Site | Before | Source site | After |
|---|---|---|---|
| `evidence_items_hashes_check` (`:335`) | `CHECK ("manifest_hash" ~ '^[0-9a-f]{64}$' AND "signature_value" ~ '^[0-9a-f]{64}$')` | `evidence.ts:147-149` | `"manifest_hash" ~ '^[0-9a-f]{64}$' AND ("transcript_sha256" IS NULL OR "transcript_sha256" ~ '^[0-9a-f]{64}$')` - hash columns only, no signature column |
| `evidence_items_signature_check` (`:336`) | `CHECK ("signature_algorithm" = 'SIMULATED-SHA256' AND "signature_simulated")` | `evidence.ts:153` via `checks.ts:75` | `"signature_algorithm" IN ('SIMULATED-SHA256', 'Ed25519', 'ECDSA-P256-SHA256') AND ((= 'SIMULATED-SHA256' AND "signature_simulated") OR (IN ('Ed25519', 'ECDSA-P256-SHA256') AND NOT "signature_simulated"))` |
| **new** `evidence_items_signature_value_check` | did not exist | `evidence.ts:154-157` via `checks.ts:89` | `(= 'SIMULATED-SHA256' AND ~ '^([0-9a-f]{2}){32}$') OR (= 'Ed25519' AND ~ '^([0-9a-f]{2}){64}$') OR (= 'ECDSA-P256-SHA256' AND ~ '^([0-9a-f]{2}){64,72}$')` - alternations count whole bytes |
| mirrored into revisions (B.9) | n/a (new table) | `transcript.ts:161-168` | `transcript_revisions_signature_check` and `transcript_revisions_signature_value_check`, the same family without the ECDSA branch |

Only the constraint **names** stayed the same, as §C's intro requires; the one addition is
`evidence_items_signature_value_check`.

### 6.3 Sources, tracks, json, and the audit key lists (C.6)

| Site | Before | Source site | After |
|---|---|---|---|
| `evidence_items_sources_check` (`:340`) | `... "integrity_source" IS NULL OR "integrity_source" IN ('DEMO_PACKAGE', 'SIMULATED')) AND ...` | `evidence.ts:177-180` + `value-sets.ts:96` | `IN ('DEMO_PACKAGE', 'SIMULATED', 'REAL')`; both time-source clauses unchanged |
| `evidence_tracks_track_check` (`:353`) | 4 values AND `position BETWEEN 1 AND 4` | `evidence.ts:228` | **unchanged**, asserted identical in the harness (D-DB-05) |
| `evidence_tracks_values_check` (`:354`) | `size_bytes >= 0 AND sha256 ~ '^[0-9a-f]{64}$'` | `evidence.ts:234-237` | plus `codec` CODE, `duration_ms >= 0`, `fragment_count >= 0`, `fragment_chain_head` hex64, `sha256_plain` hex64, each `IS NULL OR ...` |
| `active_session_json_check` (`:260`) | object/array bounds of the six v1 JSON columns | `sessions.ts:131-133` | plus `jsonb_typeof(capture_config) = 'object' AND jsonb_typeof(audio_source) = 'object' AND jsonb_typeof(transcript_status) = 'object'` |
| `audit_log_details_no_secret_keys_check` (`:199`) | 17 denied keys | `audit.ts:83` -> `checks.ts:52` -> `value-sets.ts:169` | 25 denied keys (`...'authorization','secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl'`) |
| `events_params_no_secret_keys_check` (`:220`) | 17 denied keys | `audit.ts:133` -> same constant | same 25-key ARRAY |

`evidence_items_tamper_check` (`:338`) and `engine_counters_name_check` (`:442`) were left alone exactly
as §C.6 requires; the harness asserts the tamper CHECK still lists four values.

## 7. Verification

### 7.1 Commands run (all read-only or build-only), with exit codes

| Command | Exit | Note |
|---|--:|---|
| `npm run typecheck` (root, 5 workspaces) | 2 | 14 errors, all in `@dems/core-server`, none under `src/db/schema/` (§7.3) |
| `npm run lint` (root, 5 workspaces) | 0 | clean |
| `npx oxlint src/db/schema` (core-server) | 0 | clean after removing one unused import |
| `npx vitest run --project unit --maxWorkers=2` (core-server) | 1 | `3 failed \| 157 passed (160)` files, `8 failed \| 3946 passed (3954)` tests - all v1 count pins (§7.4) |
| `npx vitest run --project unit --maxWorkers=2 src/db/mapping/__tests__` | 0 | `135 passed` |
| `npx vitest run --project unit --maxWorkers=2` fixtures + reset-plan files | 0 | `113 passed` |
| `npm run pg:status` | 0 | `pg:status: OK, running` (the server was already up; nothing started, nothing stopped) |
| static CHECK harness (this row, §7.2) | 0 | 46 assertion lines PASS, 0 FAIL |
| read-only DB probes (§7.5) | 0 | SELECTs only |

Baseline before any edit: `npm run typecheck` exit **0** (`/tmp/dems_typecheck_baseline.log`). Load was
checked before the suite run: `9:36 up 6 days, 16:49, load averages: 5.96 5.57 5.65`.

### 7.2 M2-MT-3, M2-MT-8, M2-DB-CHK-1 as far as a source-only row can prove them

dbc-3 §G places all three in the **db project**, i.e. they INSERT rows into migrated databases; the only
migration paths §G allows are a throw-away copy of `dems_demo` and fresh lanes, and that is row 46's
verification line (`M2-DB-1`, `M2-DB-2`). This row therefore ran the same accept/reject decisions
against the CHECK text the typed schema will generate, taken through the drizzle dialect with no
connection. The harness fails the build (exit 1) on any mismatch - it is not a report, it is an
assertion script:

The script is reproduced in full in appendix §A. It was kept out of the tracked tree (`.cache/` is
git-ignored) and run from there; the resolution of `drizzle-orm` walks up to the repo root, so any
location under the repository works:

```sh
mkdir -p .cache/row45            # git-ignored scratch, no tracked file added
# save appendix A as .cache/row45/m2w2_static_check.ts
cd apps/core-server && npx tsx ../../.cache/row45/m2w2_static_check.ts; echo $?
```

Re-run from that path after the last edit: `REPRO_EXIT=0`, 46 PASS lines, `ALL STATIC CHECK-SITE ASSERTIONS
PASS` (`/tmp/m2w2_repro.log`).

Excerpt of the 46 assertions (full output `/tmp/m2w2_static_out.log`, exit 0):

```
PASS | session_history_outcome_check: one fault-kind list of exactly 14 values | 14
PASS | session_history_outcome_check: accepts MIC_SILENT
PASS | session_history_outcome_check: accepts CAPTURE_FAULT
PASS | session_history_outcome_check: rejects a 15th value
PASS | session_history_outcome_check: list equals the 14-kind constant in order
PASS | alerts_kind_check: ...            (same five)
PASS | health_snapshots_cause_check: ... (same five)
PASS | Ed25519 + 128-hex signature accepted
PASS | Ed25519 + 64-hex signature rejected
PASS | SIMULATED-SHA256 + 64-hex still accepted (v1 rows stay valid, A.4)
PASS | SIMULATED-SHA256 + 128-hex rejected
PASS | ECDSA-P256-SHA256 pre-declared for class C
PASS | signature_check: a real algorithm requires NOT simulated
PASS | signature_check: SIMULATED-SHA256 requires simulated=true
PASS | hashes_check carries hash columns only (W1-C10)
PASS | transcript_revisions_signature_check mirrors C.4 without ECDSA (B.9)
PASS | sources_check accepts integrity_source='REAL'
PASS | audit_log_details_no_secret_keys_check: 25 denied keys (:199/:220 swapped 17 -> 25) | 25
PASS | events_params_no_secret_keys_check: 25 denied keys (:199/:220 swapped 17 -> 25) | 25
PASS | active_session_json_check bounds the three v2 snapshots
PASS | evidence_tracks_track_check (:353) unchanged
PASS | evidence_tracks_values_check (:354) widened with the v2 columns
PASS | table <nine names> declared ... | 12 columns, 6 CHECKs, 0 FKs, 1 idx/uniq
PASS | typed schema declares 39 tables | 39
ALL STATIC CHECK-SITE ASSERTIONS PASS
```

Mapping to the three named checks:

* **M2-MT-3** (three FAULT_KIND CHECKs accept the new kinds, a 15th rejected): accepted/rejected at the
  CHECK text of all three tables, 15/15 assertions PASS. The remaining MT-3 rows (`interval
  (to_media_ms IS NULL) <> (to_at IS NULL)` rejection, second-open-interval rejection, unknown
  `capture_devices.kind` rejection) are declared here - `session_audio_intervals_open_check`,
  `session_audio_intervals_one_open_key`, `capture_devices_kind_check` (rendered in §3) - but can only be
  *executed* once 0004 exists, so their execution is row 46.
* **M2-MT-8** (catalog text of the three swapped CHECKs equals the 14-kind shared constant; the file is
  edited in the same commit): the "same commit" half is satisfied here (`value-sets.ts` is in this
  change set) and the three lists were compared element-by-element against the 14-entry constant
  ("list equals the 14-kind constant in order", 3/3 PASS). The **shared-constant half is not yet true on
  this machine**: `FaultKind` is still 12 values and row 47 owns it, which is also why the CL-12 test is
  red (§7.4) and why six typecheck errors sit in `src/db/mapping/rows.ts`. The catalog-text comparison
  against a real `pg_get_constraintdef` needs the migrated database and lands in row 46.
* **M2-DB-CHK-1** (Ed25519 + 128-hex + `simulated=false` accepted; SIMULATED + 64-hex accepted; Ed25519 +
  64-hex and `simulated=true` rejected): all five decisions reproduced against the generated CHECK text,
  plus the structural rule that the algorithm/simulated pair lives in a different constraint from the
  encoding (W1-C10). Execution against rows is row 46.

### 7.3 Typecheck (must be able to fail - it does, and not in the schema folder)

Root run exits 2. All 14 errors are in `@dems/core-server`, in two files, and every message names the
v1-side lag as its cause:

```
src/db/fixtures/operations.ts(73,7):  TS2739 ... missing ... MIC_SILENT, CAPTURE_FAULT
src/db/fixtures/operations.ts(127,22) TS7053 Property 'MIC_SILENT' does not exist on the 12-entry severity map
src/db/fixtures/operations.ts(134,7):  TS2322 '"MIC_SILENT"' is not assignable to type 'FaultKind | "SYSTEM"'
src/db/fixtures/operations.ts(140,44) (140,71) (143,39) (143,66) (174,126) TS7053 same 12-entry maps
src/db/mapping/rows.ts(379,5):  TS2322 '"MIC_SILENT"' is not assignable to type 'FaultKind | null'
src/db/mapping/rows.ts(604,5):  TS2322 '"MIC_SILENT"' is not assignable to type 'FaultKind | "SYSTEM"'
src/db/mapping/rows.ts(490,7):  TS2322 '"Ed25519"' is not assignable to type '"SIMULATED-SHA256"'
src/db/mapping/rows.ts(389,3):  TS2739 ... missing ... manifestVersion, transcriptSha256, labelsStatus
src/db/mapping/rows.ts(427,3):  TS2322 ... missing ... kind, codec, durationMs, containsAudio, and 3 more
src/db/mapping/rows.ts(510,3):  TS2739 ... missing ... startedBy, stoppedBy, captureConfig, audioSource, transcriptStatus
```

`@dems/shared`, `@dems/core-web`, `@dems/mobile`, `@dems/mock-core`: exit 0. `src/db/schema/**`: 0 errors.

### 7.4 Unit-suite reds (all are v1 pins, each owned by another row)

| Failing test | Pin it breaks | Owning row |
|---|---|---|
| `src/core/__tests__/writers.test.ts:159` "none of the 17 key names..." | `toHaveLength(17)` | row 48 (`M2-AUD-1` cites the 17 -> 25 swap); `src/core/payload-rules.ts:11` comment says "17" too |
| `test/db/commands.test.ts` "30 table names, sorted" | `SCHEMA_TABLE_NAMES` length | rows 46/49 (test strategy §D family D lists this file) |
| `test/db/contract-inventory.test.ts` x4 ("30 tables with the same names", "same columns...", "same constraint and index names...", "one bytea type, ... seven hash and salt columns") | the checked-in v1 inventory (30 tables / 302 columns / 98 CHECKs; seven `bytea` columns - there are now nine) | rows 46/49, see decision D-a below |
| `test/db/contract-inventory.test.ts` "every value set of the contract is a constant of the typed schema" | inventory `FAULT_KIND` (12) vs `value-sets.ts` (14) | row 47 (SH-01) + inventory regeneration |
| `test/db/contract-inventory.test.ts` "the 17 denied key names..." | `toHaveLength(17)` against the contract format text | row 48 + inventory regeneration |

Nothing else moved: 3,946 of 3,954 assertions still pass, including every mapping round-trip test
(135/135) and the fixture builder/reset-plan tests (113/113), so no runtime behaviour of the v1 path was
changed by this row.

### 7.5 No migration was applied to any live database (proof)

1. **No migration file exists.** `git status --porcelain -- apps/core-server/src/db/migrations` prints
   nothing, and `ls` shows only `0000_prelude.sql`, `0001_tables.sql`, `0002_audit_guards.sql`,
   `0003_privileges.sql`. There is no `0004_capture.sql`, no `0005_capture_privileges.sql`, and the
   snapshot/journal under `migrations/meta/` is untouched - so even a `db:migrate` run today applies
   nothing new.
2. **Catalog readout, taken after all edits above** (owner role, `SELECT` only):

   ```
   schema_meta        : {"schema_version":1,"contract_revision":"dbc-2"}
   public base tables : 30
   v2 tables present  : {"capture_config":null,"capture_devices":null,"creds":null,"intervals":null,
                         "fragments":null,"chunks":null,"transcripts":null,"revisions":null,"sealing":null}
   drizzle journal    : {"n":4,"last_applied":"1791079059404"}
   v2 item columns    : 0
   ```
3. **Every project database is still v1:**

   ```
   dems databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
   dems_demo    {"schema_version":1,"contract_revision":"dbc-2"} tables=30 journal=4
   dems_lane_1  {"schema_version":1,"contract_revision":"dbc-2"} tables=30 journal=4
   dems_lane_2  {"schema_version":1,"contract_revision":"dbc-2"} tables=30 journal=4
   dems_lane_3  {"schema_version":1,"contract_revision":"dbc-2"} tables=30 journal=4
   ```
   No `dems_test_capture_*` / throw-away database was created (the `LIKE 'dems%'` list above is the
   whole set), so nothing was cloned, migrated or dropped either.
4. `git status --porcelain -- apps packages` lists only the eight schema-source paths of §2 - no
   `migrations/`, `mapping/`, `fixtures/`, `seed/`, `reset/` file.

## 8. Residuals, owners, and the two things the controller must decide

Root `typecheck` cannot reach exit 0 while this row is limited to `src/db/schema/*`: the widened DB-side
value sets are consumed by the row-to-domain mapping and the fixture builder, and the new columns must be
filled by that mapping. Both consumers are explicitly other rows' scopes (row 47 `SH-01`/`SH-02`, row 49
"`db/mapping/*` v2 shapes"), and `packages/shared/**` is outside this row's allowed file set. Options:

1. **Land 45 with 47 and 49 in one commit** (matches dbc-3 §G MT-8's "edited in the same commit" rule and
   the blueprint's own dependency edges 45 -> 47, 45 -> 46 -> 49). Recommended.
2. Or authorise a three-line `packages/shared/src/sim/vocabulary.ts` extension
   (`MIC_SILENT`, `CAPTURE_FAULT`, and `IntegritySource.REAL`) as part of this row; it removes 10 of the
   14 errors but not the four mapping-column ones, so it does not reach green either. It also duplicates
   row 47's work. Not recommended.

Either way the interim state is safe for the live system, because nothing boots or seeds against the v2
source until row 46 applies 0004/0005 - and rows 47/49 must land before row 46's own migration tests run,
since `to-rows.ts` does not yet fill the eleven new NOT-NULL-defaulted columns.

Two decisions to route (neither blocks this row's artifact):

* **D-a** - `test/db/contract-inventory.ts:26-30` parses the **v1** contract
  (`docs/2026-10-04_dems_backend_rbac_pairing/masterplan/03_database_contract.md`) as the source of the
  expected inventory. Refreshing that pin for v2 means either amending a closed task's contract document
  or re-pointing `CONTRACT_FILE` at this task's dbc-3 (whose tables are prose+Markdown tables of a
  different shape, so the parser needs work). That choice belongs to the controller, not to this row.
* **D-b** - confirm the append order `..., 'AUDIT_TAMPER', 'MIC_SILENT', 'CAPTURE_FAULT'` for the shared
  enum in row 47, so CL-12 compares two equal ordered lists rather than failing on order alone.

Handoff to row 46, in one line: generate `0004_capture.sql` from this schema (9 CREATE + the ADD COLUMNs
+ the drop/add CHECK pairs + the partial unique index), hand-write `0005_capture_privileges.sql` per
dbc-3 §D, bump `meta.ts:16`/`:18` to `(2,'dbc-3')` in that same commit (MG-5), then run MT-1..MT-8 on a
throw-away copy of `dems_demo` and on fresh lanes.

## 9. Independence note

This artifact was written from the row text, `identification/02_structured.md` rev 2.1 (`:208`, standing
invariants `:199`), `masterplan/04_database_contract.md` (dbc-3) §A-§C and §G, the committed v1 migration
text, and the typed schema itself. No other agent's intermediate output was relied on. Rollback is
`git checkout -- apps/core-server/src/db/schema` plus deleting the three new files; no database, media or
tracker state was touched.

## Appendix A. The static CHECK-site harness (reproducible, database-free)

Run from inside the repository so that `drizzle-orm` resolves; the absolute import of the schema
entry keeps working from any location under the repo root. Verified `exit 0`, 46 PASS lines and 0 FAIL lines, on 2026-10-08 (twice: from `/tmp` with `NODE_PATH`, and from `.cache/row45/` without it).

```ts
/**
 * Row-45 database-free stand-ins for M2-MT-3 / M2-MT-8 / M2-DB-CHK-1 (exits 1 on any miss).
 * Reads the CHECK text the typed schema will generate (drizzle dialect, no connection) and
 * evaluates it against the accept/reject values named in dbc-3 §G MT-3. Runtime INSERTs on a
 * throw-away copy of `dems_demo` are row 46 (M2-DB-1/M2-DB-2).
 */
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core';
import { getTableName, is } from 'drizzle-orm';
import * as schema from '/Users/gsp-budi/Documents/DEMS/apps/core-server/src/db/schema/index';
import { AUDIT_DETAIL_FORBIDDEN_KEYS, FAULT_KIND, INTEGRITY_SOURCE } from '/Users/gsp-budi/Documents/DEMS/apps/core-server/src/db/schema/index';

const dialect = new PgDialect();
const tables = (Object.values(schema) as unknown[]).filter((v): v is PgTable => is(v, PgTable));
const textOf = (constraint: string): string => {
  for (const t of tables) {
    const c = getTableConfig(t).checks.find((k) => k.name === constraint);
    if (c !== undefined) return dialect.sqlToQuery(c.value as never).sql;
  }
  throw new Error(`CHECK ${constraint} is not declared in the typed schema`);
};
const quoted = (text: string): string[] => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);

let failed = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label}${detail === '' ? '' : ` | ${detail}`}`);
  if (!ok) failed++;
};

// ── M2-MT-3 + M2-MT-8: the three FAULT_KIND sites carry the same ordered 14-kind list ──────────
for (const site of ['session_history_outcome_check', 'alerts_kind_check', 'health_snapshots_cause_check']) {
  const sqlText = textOf(site);
  const m = sqlText.match(/"(?:\w+\.)?(?:fault_kind|kind)" IN \(([^)]*)\)/);
  const faultList = quoted(m?.[1] ?? '');
  check(`${site}: one fault-kind list of exactly 14 values`, faultList.length === 14, String(faultList.length));
  check(`${site}: accepts MIC_SILENT`, faultList.includes('MIC_SILENT'));
  check(`${site}: accepts CAPTURE_FAULT`, faultList.includes('CAPTURE_FAULT'));
  check(`${site}: rejects a 15th value`, !faultList.includes('DISK_MELTDOWN') && !faultList.includes('MIC_SILENCE'));
  check(`${site}: list equals the 14-kind constant in order`, JSON.stringify(faultList) === JSON.stringify([...FAULT_KIND]));
}
check('value-sets.ts FAULT_KIND has 14 values', FAULT_KIND.length === 14, String(FAULT_KIND.length));

// ── M2-DB-CHK-1 (C.4 + C.5): signature encoding counted in bytes, simulated-flag rule ─────────
const patterns = new Map<string, string>();
for (const m of textOf('evidence_items_signature_value_check').matchAll(/\."signature_algorithm" = '([^']+)' AND "\w+"\."signature_value" ~ '([^']+)'/g)) {
  patterns.set(m[1] as string, m[2] as string);
}
const accepts = (alg: string, value: string): boolean => {
  const p = patterns.get(alg);
  return p !== undefined && new RegExp(p).test(value);
};
const hex32 = 'ab'.repeat(32); // 64 hex characters = 32 bytes
const hex64bytes = 'ab'.repeat(64); // 128 hex characters = 64 bytes
check('Ed25519 + 128-hex signature accepted', accepts('Ed25519', hex64bytes));
check('Ed25519 + 64-hex signature rejected', !accepts('Ed25519', hex32));
check('SIMULATED-SHA256 + 64-hex still accepted (v1 rows stay valid, A.4)', accepts('SIMULATED-SHA256', hex32));
check('SIMULATED-SHA256 + 128-hex rejected', !accepts('SIMULATED-SHA256', hex64bytes));
check('ECDSA-P256-SHA256 pre-declared for class C', accepts('ECDSA-P256-SHA256', hex64bytes));
const sigRule = textOf('evidence_items_signature_check');
check('signature_check: a real algorithm requires NOT simulated', /IN \('Ed25519', 'ECDSA-P256-SHA256'\) AND NOT "evidence_items"\."signature_simulated"/.test(sigRule));
check('signature_check: SIMULATED-SHA256 requires simulated=true', /= 'SIMULATED-SHA256' AND "evidence_items"\."signature_simulated"/.test(sigRule));
check('hashes_check carries hash columns only (W1-C10)', !sigRule.includes('signature_value') && !textOf('evidence_items_hashes_check').includes('signature_value'));
const revRule = textOf('transcript_revisions_signature_check');
check('transcript_revisions_signature_check mirrors C.4 without ECDSA (B.9)', /IN \('Ed25519', 'SIMULATED-SHA256'\)/.test(revRule) && !revRule.includes('ECDSA'));
check('transcript_revisions_signature_value_check counts whole bytes', /\{64\}\$/.test(textOf('transcript_revisions_signature_value_check')) && !textOf('transcript_revisions_signature_value_check').includes('ECDSA'));

// ── C.6: integrity source REAL, both audit secret-key sites at 25 keys ────────────────────────
check("sources_check accepts integrity_source='REAL'", textOf('evidence_items_sources_check').includes("IN ('DEMO_PACKAGE', 'SIMULATED', 'REAL')"));
check('INTEGRITY_SOURCE constant has 3 values', INTEGRITY_SOURCE.length === 3);
for (const site of ['audit_log_details_no_secret_keys_check', 'events_params_no_secret_keys_check']) {
  const keys = quoted(textOf(site));
  check(`${site}: 25 denied keys (:199/:220 swapped 17 -> 25)`, keys.length === 25, String(keys.length));
  check(`${site}: denies the eight new capture keys`, ['secret','secretCiphertext','ciphertext','nonce','keyRef','onvifUuid','signedUrl','mediaUrl'].every((k) => keys.includes(k)));
}
check('AUDIT_DETAIL_FORBIDDEN_KEYS has 25 entries', AUDIT_DETAIL_FORBIDDEN_KEYS.length === 25, String(AUDIT_DETAIL_FORBIDDEN_KEYS.length));

// ── C.6: active_session json check, tracks :353 kept and :354 widened ──────────────────────────
const jsonCheck = textOf('active_session_json_check');
check('active_session_json_check bounds the three v2 snapshots', ['capture_config','audio_source','transcript_status'].every((c) => jsonCheck.includes(`jsonb_typeof("active_session"."${c}") = 'object'`)));
check('evidence_tracks_track_check (:353) unchanged', textOf('evidence_tracks_track_check').includes("IN ('VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02') AND \"evidence_tracks\".\"position\" BETWEEN 1 AND 4"));
check('evidence_tracks_values_check (:354) widened with the v2 columns', ['codec','duration_ms','fragment_count','fragment_chain_head','sha256_plain'].every((c) => textOf('evidence_tracks_values_check').includes(c)));

// ── §B: the nine new tables exist with their named constraints ────────────────────────────────
const declared = new Map<string, { columns: number; checks: number; fks: number; indexes: number }>();
for (const t of tables) {
  const cfg = getTableConfig(t);
  declared.set(getTableName(t), {
    columns: Object.keys(cfg.columns).length,
    checks: cfg.checks.length,
    fks: cfg.foreignKeys.length,
    indexes: cfg.indexes.length + cfg.uniqueConstraints.length,
  });
}
for (const name of ['capture_devices','capture_config','capture_device_credentials','session_audio_intervals','recording_fragments','transcript_chunks','transcripts','transcript_revisions','sealing_jobs']) {
  const d = declared.get(name);
  check(`table ${name} declared`, d !== undefined, d === undefined ? '' : `${d.columns} columns, ${d.checks} CHECKs, ${d.fks} FKs, ${d.indexes} idx/uniq`);
}
check('typed schema declares 39 tables', declared.size === 39, String(declared.size));
console.log(failed === 0 ? `\nALL STATIC CHECK-SITE ASSERTIONS PASS` : `\n${failed} ASSERTION(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
```
