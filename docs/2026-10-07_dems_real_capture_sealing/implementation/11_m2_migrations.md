---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 46 (phase C, milestone M2, class B; M2-W3; blueprint rev 2.1)
date: 2026-10-08
agent: database-specialist (fallback for database-specialist, free tier)
source_plan: identification/02_structured.md rev 2.1 row 46; masterplan/04_database_contract.md (dbc-3) §A, §B.1-§B.12, §C, §D, §G, §H
narrative_tier: 3
status: complete
closes: CS-17, CS-24, CS-16 (migration half), RK-12, B16 (code side); SH-04 privilege surface of 0005
depends_on: row 45 (typed schema v2), row 47 (shared vocabulary landed)
verification: M2-DB-1 (MT-1 mechanics), M2-DB-2 (MT-1 fresh lane), M2-MT-4 (privileges + credential reveal) all PASS on one throw-away DB; live dems_demo + lanes proven still v1
---

# Row 46 / M2-W3: migrations 0004/0005 validated and applied (throw-away), meta.ts bumped

## 0. Summary

| Item | Result |
|---|---|
| `0004_capture.sql` / `0005_capture_privileges.sql` present in tree | yes (emitted by the two aborted prior attempts, per D29/D31) |
| STEP A - static validation vs dbc-3 §A/§B/§C/§D | **PASS** - the SQL is materially correct; no repair needed |
| `drizzle-kit generate` re-run | **NOT run** (anti-hang: the interactive rename prompt is the documented hang cause, D31). Artifacts validated and applied directly instead |
| STEP B - live `dems_demo` + `dems_lane_1/2/3` still v1 | **PROVEN** - all four `(1,'dbc-2')`, 30 base tables, 0 v2 tables, journal 4 rows; no stray throw-away DBs |
| STEP C - apply + verify on one fresh throw-away `dems_test_capture_m2` | **PASS** - M2-DB-2, M2-DB-1 mechanics, MG-10 no-op, ledger current, M2-MT-4 privileges/reveal, live CHECK firing, catalog swaps all green (`ALL PASS`, exit 0) |
| Throw-away DB dropped after verification | **yes** - `pg_database LIKE 'dems%'` returns only the four, before and after |
| `meta.ts` bump to `(2,'dbc-3')` | **present** - `DB_SCHEMA_VERSION = 2` (`:17`), `DB_CONTRACT_REVISION = 'dbc-3'` (`:19`) |
| B16 code-side message fix | **present** with file:line (see §5) |
| Files this row created/edited | none beyond what the prior attempts left; this row **verified and proved**, it did not regenerate or hand-edit the tracked artifacts (STEP D not triggered) |

## 1. Anti-hang contract observed

Every shell command ran as `timeout <secs> <cmd> </dev/null` with stdin closed and a hard wall-clock
cap. The host has no `timeout`/`gtimeout` binary, so a faithful process-group-kill `timeout` shim
(perl `setpgid` + `ALRM`, SIGTERM then SIGKILL to the child group) was installed on `PATH` for the
session and self-tested first (`sleep 5` capped at 2 s -> exit 124; `echo ok` -> exit 0). Every
long step additionally ran under the bash-tool wall-clock cap. `db:create`/`db:migrate` were wrapped
in `/usr/bin/lockf -k .locks/db-migrate.lock`. No command was allowed to block on stdin; the
interactive generator was never invoked. The DB driver connects only to `127.0.0.1:4432` through the
project's own `readOwnerConnection` (host/port from `.data/pg.owner.env`, loopback-only, default port
refused by design).

## 2. STEP A - validation of the already-emitted artifacts (read-only)

Read: `migrations/0004_capture.sql`, `migrations/0005_capture_privileges.sql`,
`migrations/meta/_journal.json`, `meta/0004_snapshot.json`, `meta/0005_snapshot.json`,
`schema/meta.ts`, `commands/migrate.ts`, `seed/cli.ts`, cross-checked against `implementation/10_m2_schema_check.md`
(row 45) and dbc-3 §A/§B/§C/§D.

### 2.1 `0004_capture.sql` (generated-shape) - matches dbc-3 §A.2 / §B / §C

- **9 CREATE TABLE**: `capture_config`, `capture_device_credentials`, `capture_devices`,
  `recording_fragments`, `sealing_jobs`, `session_audio_intervals`, `transcript_chunks`,
  `transcript_revisions`, `transcripts` (lines 1-172). Column/CHECK/FK counts match row-45 §3 exactly.
- **ALTERs**: `active_session` +5 (`started_by`,`stopped_by`, `capture_config`/`audio_source`/`transcript_status`
  jsonb default `'{}'` NOT NULL) `:184-188`; `evidence_items` +3 (`manifest_version smallint DEFAULT 1 NOT NULL`,
  `transcript_sha256`, `labels_status`) `:189-191`; `evidence_tracks` +7 (`kind DEFAULT 'FILE'`,
  `contains_audio DEFAULT true`, `codec`,`duration_ms`,`fragment_count`,`fragment_chain_head`,`sha256_plain`) `:192-198`.
- **CHECK swaps** (drop+add pairs): three FAULT_KIND sites now 14 kinds (`session_history_outcome_check :217`,
  `alerts_kind_check :227`, `health_snapshots_cause_check :228`); signature pair split -
  `evidence_items_hashes_check :221` carries hash columns only (W1-C10), `evidence_items_signature_check :222`
  the algorithm/simulated rule, **new** `evidence_items_signature_value_check :218` the per-algorithm byte-count
  regexes (SIMULATED `{32}`, Ed25519 `{64}`, ECDSA `{64,72}`); `evidence_items_sources_check :223` gains `REAL`;
  new `evidence_items_manifest_version_check :219 IN (1,2)` and `evidence_items_labels_check :220`;
  `evidence_tracks_values_check :226` widened with the v2 column patterns; `active_session_json_check :216`
  bounds the three v2 snapshots; both audit secret-key lists expanded **17 -> 25** (`audit_log ... :214`,
  `events ... :215`). `evidence_tracks_track_check` (`:353`) and `evidence_items_tamper_check` (`:338`) are
  correctly left untouched (D-DB-05).
- **Indexes**: `capture_devices_kind_idx :210`; partial unique `session_audio_intervals_one_open_key :211`
  (`WHERE to_media_ms IS NULL`, PG-08).
- **Note (not a defect)**: drizzle defers all cross-table FKs to `ALTER ... ADD CONSTRAINT` blocks `:199-209,
  :212-213` that run **after** every CREATE, so the physical CREATE order differs from the §A.2 dependency plan
  yet is valid (all FK targets exist by the time any FK is added). This is normal generated output.

### 2.2 `0005_capture_privileges.sql` (hand-written) - matches dbc-3 §D

Blanket `GRANT SELECT ON ALL TABLES IN SCHEMA public TO dems_app` `:17` then
`REVOKE SELECT ON capture_device_credentials FROM dems_app` `:21` (D-DB-06/RK-12); `GRANT INSERT` on the
8 data tables `:24-28` (`capture_config` deliberately excluded); column-level `GRANT UPDATE` blocks for
`capture_config` `:35-37`, `capture_devices` `:39-40`, `capture_device_credentials` `:44-45`,
`session_audio_intervals (to_media_ms,to_at)` `:47`, `transcript_chunks` `:49`, `sealing_jobs` `:51-52`;
`recording_fragments`/`transcripts`/`transcript_revisions` are INSERT-only (no UPDATE grant);
`dems_capture_credential_reveal(p_device_id text)` `SECURITY DEFINER` with pinned
`search_path = pg_catalog, public, pg_temp` `:61-69`; `REVOKE ALL ON FUNCTION ... FROM PUBLIC` `:71`;
`GRANT EXECUTE ... TO dems_app` `:75`; `UPDATE public.schema_meta SET schema_version = 2,
contract_revision = 'dbc-3' WHERE singleton` `:80` (MG-5).

**SEC35-02 applied alternative (confirmed, not revoke-from-dems_app):** the header `:11-16` states and the
statements implement Q-SEC-3's default - PUBLIC holds nothing (`:71`), sole runtime role keeps EXECUTE (`:75`),
reach narrowed by the single-module static rule
(`apps/core-server/src/modules/capture-config/credential-reveal.ts`, code owned by rows 48/52) and an audited
`CAPTURE_CREDENTIAL_REVEALED` per call; no 4th DB role (D-DB-07 forbids one). The migration therefore does
**not** revoke EXECUTE from `dems_app`; it carves the read path back with the SELECT revoke plus the
owner-owned `SECURITY DEFINER` function.

### 2.3 Journal and snapshot chain - coherent

`_journal.json`: 6 entries, `idx` = position 0..5, strictly rising `when`
(`...9059404` -> `...9871996` (0004_capture) -> `...934834` (0005_capture_privileges)); satisfies
`readMigrationSet` (dbc-3 §A.3). Snapshot ids chain unbroken: `0003.id d8902165-...` == `0004.prevId`;
`0004.id 511feb3a-...` == `0005.prevId`; `0005.id 966e9b4c-...`.

### 2.4 `meta.ts` bump

`schema/meta.ts:17 export const DB_SCHEMA_VERSION = 2;` and `:19 export const DB_CONTRACT_REVISION = 'dbc-3';`,
with the MG-5 doc comment updated to name 0005's `UPDATE public.schema_meta` as the paired version row. This is
the bump row 45 intentionally left for row 46.

## 3. STEP B - live databases proven untouched (read-only owner query)

Credentials read in-process by `readOwnerConnection` (mode-0600 file, loopback-only); values never printed;
every statement a `SELECT`. Script: `.cache/row46/probe_live.mts` (git-ignored), run twice (before and after
STEP C), both exit 0.

```
STEP B | pg_database LIKE dems% | ["dems_demo","dems_lane_1","dems_lane_2","dems_lane_3"]
STEP B | dems_demo   | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 v2_present=false journal_rows=4
STEP B | dems_lane_1 | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 v2_present=false journal_rows=4
STEP B | dems_lane_2 | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 v2_present=false journal_rows=4
STEP B | dems_lane_3 | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 v2_present=false journal_rows=4
STEP B | strays_outside_four | []
```

No live database was migrated by any aborted run; no throw-away DB was left behind to drop. No `DB_INTEGRITY`
condition. Lanes were not seeded/migrated (kept at their row-44 v1 state).

## 4. STEP C - apply + verify on ONE fresh throw-away database

Driver `.cache/row46/verify.mts` (git-ignored), run as
`timeout 600 /usr/bin/lockf -k .locks/db-migrate.lock npx tsx ... </dev/null`. Name `dems_test_capture_m2`
matches `TEST_DATABASE_PATTERN`; created via the sanctioned test seam `runCreate/runMigrate(..., { allowTestDatabase: true })`,
i.e. the same production command functions and the same drizzle migrator as `dems_owner` in one transaction -
the CLI itself refuses the name because `allowTestDatabase` is never settable from argv/env (`database-names.ts`).
Final result `STEP C RESULT: ALL PASS`, exit 0.

### 4.1 M2-DB-2 (fresh full set 0000..0005) and M2-DB-1 mechanics (MT-1)

```
db:create: created dems_test_capture_m2 (owner dems_owner, encoding UTF8, locale C) on PostgreSQL 18.4 as dems_owner.
C-CHECK | PASS | db:create exit 0
=== db:migrate pass 1 ===
db:migrate: schema version before: none (not migrated)
db:migrate: applied 6 migration(s): 0000_prelude, 0001_tables, 0002_audit_guards, 0003_privileges, 0004_capture, 0005_capture_privileges
db:migrate: schema version after: 2 (dbc-3)
C-CHECK | PASS | M2-DB-2 full-set migrate exit 0
C-CHECK | PASS | M2-DB-1 applied 6 migrations
C-CHECK | PASS | M2-DB-1 schema version after = 2 (dbc-3)
=== db:migrate pass 2 (MG-10) ===
db:migrate: no pending migration; nothing was applied.
C-CHECK | PASS | second migrate exit 0
C-CHECK | PASS | M2-DB-1 second run applies nothing
C-CHECK | PASS | M2-DB-1 ledger current (ok, 0 pending, 0 problems) | applied=6 pending=0
```

`applyMigrations` internally enforces the MT-1 pass condition: it throws `SCHEMA_VERSION_MISMATCH` unless
`schema_meta == (DB_SCHEMA_VERSION, DB_CONTRACT_REVISION) = (2,'dbc-3')` and `MIGRATION_LEDGER_MISMATCH` unless
every file is applied with its own SHA-256; a clean exit 0 is therefore itself the proof (dbc-3 §A.3).

### 4.2 M2-MT-4 - privileges, credential write-only store, reveal function

```
C-CHECK | PASS | MT-4 app session role = dems_app
C-CHECK | PASS | M2-MT-4 SELECT capture_device_credentials -> 42501            (RK-12 / D-DB-06)
C-CHECK | PASS | M2-MT-4 reveal(CAM-99) returns 1 row via SECURITY DEFINER     {username,encryption,key_ref,ct=34,nc=12}
C-CHECK | PASS | M2-MT-4 reveal(unknown) yields no row                          n=0
C-CHECK | PASS | M2-MT-4 UPDATE recording_fragments -> 42501                    (INSERT-only table)
C-CHECK | PASS | M2-MT-4 UPDATE evidence_items.manifest_version -> 42501        (no grant on new sealed column)
```

The row written to `capture_device_credentials` by `dems_app` (a write the runtime role is allowed) is then
unreadable by `dems_app` (42501) yet returned by the owner-owned `SECURITY DEFINER` function - the exact
write-only + single-read-path model of dbc-3 §B.3.

Privilege matrix vs §D. Table-level bits: `[S,I,U,D]` equal §D for all nine (UPDATE is false at table level by
design because §D grants UPDATE per-column only): `capture_config [T,F,F,F]`, `capture_devices [T,T,F,F]`,
`capture_device_credentials [F,T,F,F]`, and the six data tables `[T,T,F,F]` (three of them INSERT-only, which
match because their UPDATE absence is enforced by the 42501 probes above, not by a table bit). Column-level
UPDATE (`has_column_privilege`) confirms the granted columns are true and adjacent non-granted columns false:
`capture_config.mic_primary_id` T / `.singleton` F; `capture_devices.transport` T / `.id` F;
`capture_device_credentials.key_ref` T / `.device_id` F; `session_audio_intervals.to_media_ms` T / `.seq` F;
`transcript_chunks.status` T / `.seq` F; `sealing_jobs.progress` T / `.session_id` F;
`recording_fragments.byte_length` F, `transcripts.labels_status` F, `transcript_revisions.revision_no` F.

### 4.3 Live CHECK / index firing on the new no-FK tables (constraints are actually enforced)

```
C-CHECK | PASS | sealing_jobs.progress=101 rejected (23514)
C-CHECK | PASS | recording_fragments track_id=AUDIO-01 rejected (23514)
C-CHECK | PASS | second open interval rejected (23505)        (partial unique session_audio_intervals_one_open_key)
C-CHECK | PASS | to_media_ms set / to_at null rejected (23514) (session_audio_intervals_open_check)
```

The three FAULT_KIND sites also reject a value outside the 14-kind set and accept `MIC_SILENT` /
`CAPTURE_FAULT` at definition level (catalog check §4.4); value-level accept/reject against rows is proven
statically in row 45 §7.2 and by these structural firings here.

### 4.4 Catalog text of the swapped constraints (post-migration, `pg_get_constraintdef`)

```
C-CHECK | PASS | catalog: session_history_outcome_check has 14 kinds incl MIC_SILENT+CAPTURE_FAULT
C-CHECK | PASS | catalog: alerts_kind_check has 14 kinds ...
C-CHECK | PASS | catalog: health_snapshots_cause_check has 14 kinds ...
C-CHECK | PASS | catalog: signature_value_check per-algorithm byte counts (Ed25519 {64}, SIMULATED {32}, ECDSA {64,72})
C-CHECK | PASS | catalog: hashes_check carries hash cols only (no signature_value)      (W1-C10 split)
C-CHECK | PASS | catalog: sources_check accepts REAL                                       (D-DB-04)
C-CHECK | PASS | catalog: evidence_tracks_track_check (:353) unchanged (4 values, position 1..4)  (normalised >=1 AND <=4)
C-CHECK | PASS | catalog: audit_log forbidden keys now 25 (incl mediaUrl)                (SEC35-22 17 -> 25)
C-CHECK | PASS | stt_config present? expected absent here  present=false                  (R-8 §B.13 lands in later rows)
```

This is the catalog-text half of M2-MT-8 that row 45 could not reach without a migrated database: the three
swapped FAULT_KIND constraint definitions each carry the 14-kind list matching `value-sets.ts`. `stt_config` is
absent from 0004/0005 by design (proposed §B.13; R-8 rows 112+ own it even though Q-STT-CFG was confirmed), so
its loopback CHECK is reported not-present.

### 4.5 Drop and end-state

```
drop(in-main): remaining=0
C-CHECK | PASS | throw-away DB dropped | remaining=0
STEP C | pg_database LIKE dems% after drop | ["dems_demo","dems_lane_1","dems_lane_2","dems_lane_3"]
STEP C RESULT: ALL PASS
```

A pre-clean and a `finally` drop were both wired so that an aborted run (as happened once - see §6) cannot leave
the throw-away behind; the post-drop probe (§3, run again after STEP C) shows the four intact and `strays_outside_four=[]`.

## 5. B16 erratum (iii) - code-side message fix (file:line)

- `apps/core-server/src/db/commands/migrate.ts:57` guard `if (target === MIGRATE_LOCK_DATABASE)`, new neutral
  string at `:59`: `"... note - <db> is shared with db:reset, so its caller runs this command under <lockf>. This
  command takes no lock of its own and never checks for one; it prints this note on every <db> run."`
- `apps/core-server/src/db/seed/cli.ts:77` guard, new string at `:79` (identical fix; the W90 F-6 finding named
  the two commands together).

The rule it points at (P16/MG-9: the caller wraps a `dems_demo` migration in the migrate lock) is unchanged;
only the misleading "this command must be run as ..." wording that looked like a warning on a command that
exits 0 was fixed. dbc-3 §H row (iii) routed this to the M2 command-editing row (CS-17 family), i.e. here.

## 6. Scope honesty / residuals

- **M2-DB-1 "throw-away copy of `dems_demo`" clause**: STEP C used a **fresh** throw-away brought up through the
  whole set (`db:create` + migrate 0000..0005) exactly as this row's brief prescribed, which proves M2-DB-2 fully
  and every M2-DB-1 mechanic except the data-bearing clone. The clone-of-seeded-v1 path (dbc-3 §G MT-2) was
  **not executed** because cloning `dems_demo` needs exclusive/FORCE access to the live database, and terminating
  a live `dems_demo` session is forbidden by this row's red lines. That risk is closed by construction instead:
  every 0004 change is additive or relaxing (A.4 / D-DB-05), the kept value-set CHECKs `:353`/`:338` are
  unchanged (proven §4.4), the split `signature_value_check` accepts the v1 64-hex SIMULATED form (`{32}` = 32
  bytes = the 64 hex chars v1 stored, proven accepted statically in row 45), and the sources/fault-kind lists
  grew only. A future gate row may add the clone run without disturbing the live set.
- No `drizzle-kit generate` was invoked (the interactive prompt is the documented hang). STEP D was therefore
  never needed: STEP A found the emitted SQL materially correct and STEP C applied it cleanly.
- One self-inflicted, non-schema failure occurred mid-STEP-C (a synthetic `key_ref` fixture used a hyphen and
  was correctly rejected by `capture_device_credentials_key_ref_check`); it aborted the first run before its drop.
  The `finally`-drop and pre-clean cleaned up; the corrected run is §4. The leftover `.cache/row46/{probe.ts,validate.ts,verify.ts,*.mjs}`
  files belong to the two earlier aborted attempts and were not relied upon.
- Tracked tree: unchanged by this row beyond the prior attempts' artifacts. Protected sets untouched -
  `packages/shared/**` (row 47), row-45 schema files (`checks.ts`,`evidence.ts`,`index.ts`,`sessions.ts`,
  `value-sets.ts`,`capture.ts`,`recording.ts`,`transcript.ts`), `apps/mock-core`, `release`, controller trackers.
  No commit made (none requested). No git remote/push, no sudo.

## 7. Residuals for the controller

- Rows 48/52 must land the `credential-reveal.ts` module + the capture-config static rule and the audited
  `CAPTURE_CREDENTIAL_REVEALED` call so the SEC35-02 narrowing asserted in 0005 has code behind it (asserted
  here only at the DB-grant level).
- The unit-suite v1 count pins listed in row 45 §7.4 (`test/db/*`) still need the rows-46/47/49 landing sequence to
  go green; the live-migration evidence here is independent of those source-side pins.
- Consider a dedicated MT-2 clone run at the M2 gate on a non-live copy, if the controller wants the
  data-bearing copy-migration exercised beyond the by-construction argument above.
