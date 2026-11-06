---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: database-specialist
blueprint_row: 129b (controller-added, D109)
source_plan: masterplan/04_database_contract.md section N.17, erratum PE-129b-01; requests of rows 115, 79, 66 (delegation_progress/file_requests.md)
tier: 3
status: needs-review
---

# Row 129b - migration set 6 (`0011` + `0012`), schema version 5 / `dbc-6`: the session's STT snapshot; item mapping at seal; mic order

Status `needs-review` only for the points of section 6; every check of this row passes. No commit,
no lockfile write, 0 edits to `0000`-`0010`, no reseed, no reset, no Core started, `.data/pg*.env`
not read, `dems_admin` not used.

## 1. A - where the snapshot lives, and why

**A new INSERT-only table `session_stt_config` (T-42), not `active_session.stt_config jsonb`**
(decision D-DB-19; contract N.17). The contract already decided this question once, for the
session-start source record (N.3 / D-DB-14), and its reasons hold here unchanged:

- `dems_app` holds table-level UPDATE and DELETE on `active_session` and the engine's write-through
  owns that row. A column there could be write-once only by its statement (`... WHERE stt_config IS
  NULL`); the project adds no trigger in v2 (contract D). With a table the runtime role holds
  SELECT + INSERT and nothing else: a second snapshot meets the primary key, a change or a removal
  answers `42501`. **Write-once is held by the database.**
- Typed columns, no JSON: there is no key deny-list to keep, because **no secret has a column**.
  Ten columns: `session_id` (PK), `enabled`, `backend`, `endpoint`, `model`, `language`,
  `diarization`, `credential_kind`, `config_revision`, `taken_at`; seven CHECKs, the ones of
  `stt_config`. No default, no FK (the T-41 rule), no index beside the key.
- The engine's mapping never names the table: nothing of it is replicated, and the typed row of
  `active_session` is untouched.

**Deviation from the brief, deliberate:** no `credential_ref` column. The brief lists "credential
kind and reference name"; `stt_config.credential_ref` is one of the three columns `0007` hides from
the runtime role, and row 115's own snapshot type excludes it (D-115-5). A readable copy per
session would re-open that carve-out. Measured: `dems_app` cannot copy a hidden column into a
snapshot (`42501`).

**Sealed / reset:** the row stays after the seal (nobody can remove it; manifest field 123 is built
from it). It is not a kept table: a reset rebuilds it empty, like T-41 (tested).
**Fixture:** minimum 0, no rows built (rule S-2 in N.17) - stated, not hidden.

## 2. What was written

| Item | Where |
|---|---|
| Typed table `sessionSttConfig` | `apps/core-server/src/db/schema/stt.ts` (end of file) |
| `0011_session_stt_config.sql` generated (`db:generate --name=session_stt_config`): one CREATE TABLE. sha256 `bdacdd36...d51642` | `src/db/migrations/` + `meta/0011_snapshot.json` |
| `0012_session_stt_config_privileges.sql` hand-written (`--custom`): `GRANT SELECT, INSERT`, boundary `REVOKE UPDATE, DELETE, TRUNCATE`, version row. sha256 `55cf8703...8ae520` | same + `meta/0012_snapshot.json`, journal idx 11, 12 |
| Drift proof | `db:generate` prints `No schema changes, nothing to migrate` |
| Constants `5` / `dbc-6`; thirteen tags; table list | `src/db/schema/meta.ts`, `src/db/commands/migrations.ts`, `src/db/store/store.ts` (`ALL_TABLES`, count only), comment in `src/db/schema/index.ts` |
| Inventory | new `test/db/contract-v5-delta.ts`, composed in `contract-inventory.ts`; `contract-inventory.json` regenerated: 42 tables, 436 columns, 179 CHECKs, 40 FK, 42 PK |
| New db test, 18 cases (M6S-1..8) | `apps/core-server/test/db/set6.db.test.ts` |
| Contract | `masterplan/04_database_contract.md` new section N.17, erratum **PE-129b-01** |
| B - item mapping | `src/db/mapping/rows.ts`: `sealedColumnsOf` (to row), `sealedMembersOf` (way back), types `SealedEvidenceItem` / `SealedItemMembers` exported from the mapping index |
| C - mic order | `src/db/mapping/rows.ts` `captureConfigFromRow`: the two lines sorted by `inputId` |
| Mapping tests | `src/db/mapping/__tests__/to-rows.test.ts` (+7 cases), new `from-rows.test.ts` (8 cases), `round-trip.test.ts` (+2 cases) |

**B in one paragraph.** The seal hands `itemColumns {manifestVersion: 2, transcriptSha256,
labelsStatus}`; `transcriptSha256` is a member of the state item already, the other two are not.
The mapping now reads them as optional members of the item (local type, the `adapterKindOf`
precedent): `manifest_version` = 2 when the item states 2 **or** binds a hash (old reading kept for
the simulator's seal), `labels_status` = the item's. Way back: `(1,NULL,NULL)` no member;
`(2,hash,NULL)` the hash alone, as before; `(2,hash,labels)` and `(2,NULL,NULL)` all three members.
Every other combination is refused (`ROW_SHAPE`) in both directions. `toRow(fromRow(row))` is the
same row for the five shapes. The shared type and schema were **not** edited (request filed).

**Pins moved** (by delta): `test/db/{boot-checks.db,migrate.db,commands.db,commands,catalog.db,
constraints.db,privileges.db,set4.db,set5.db,contract-inventory}.test.ts`, `test/db/fixtures.ts`
(one builder), `test/support/seed.ts` (one count line, Edit tool); `src/db/seed/__tests__/{seed.db,
cli,cli.db}.test.ts`, `src/db/reset/__tests__/{m4-sec-reset.db,reset-failures.db,reset.db,cli.db}.test.ts`,
`src/db/fixtures/{minimums.ts,__tests__/build.test.ts,__tests__/support.ts,__tests__/bulk-fixture.db.test.ts}`.
`set5.db.test.ts` now stops its set at `0010` (a genuine `(4, 'dbc-5')` database) instead of
running to the end of the folder.

**One-line pins in other rows' finished files** (Edit tool, one line each):
`src/sealing/__tests__/stt-states.db.test.ts:115`, `src/modules/transcript-chunks/__tests__/transcript-chunks.db.test.ts:66`,
`src/modules/transcripts/__tests__/transcripts.db.test.ts:166` (`[4,'dbc-5']` -> `[5,'dbc-6']`; their
titles still read "4 / dbc-5"), `src/engine/__tests__/recording.db.test.ts:141` (41 -> 42 tables),
`src/modules/demo/__tests__/reset.db.test.ts:368` (23 -> 24 rebuilt tables).
**Row 66's test** `src/modules/capture-config/__tests__/capture-config.db.test.ts`: the exclusion
`micsByInput` is removed; `expectStoredEqualsCommitted` compares strictly. It passes.

## 3. Checks (throw-away databases, under `lockf -k .locks/db-migrate.lock`)

| Check | Result | Negative control |
|---|---|---|
| M6S-1 pre-state `(4,'dbc-5')` with rows | no table; set 6 pending; this code refused by B-3 naming `db:migrate`; code of row 129a accepted | - |
| M6S-3 apply | applies exactly `0011`, `0012`; `(5,'dbc-6')`; ledger 13; +2 catalog objects (table, key index); stored rows identical; second run applies nothing | M6S-2: with `0012` left out SELECT and INSERT are `42501` and the version stays |
| M6S-4 write-once as `dems_app` | first put stored and read back; second put `ok:0`, the first snapshot stays; plain INSERT `23505`; 7 forms of UPDATE / upsert-update / DELETE / TRUNCATE `42501`; CHECKs bind (`23514`) | M6S-6: after a planted `GRANT UPDATE` the snapshot is replaced |
| M6S-5 no secret | exactly ten columns of types text / boolean / bigint; 6 secret-looking column names refused `42703` (runtime role and owner); copying `credential_ref`, `secret_ciphertext`, `nonce` out of `stt_config` `42501` | the same statement with `model` stores the row |
| M6S-6 grants | SELECT + INSERT only; UPDATE on 0 of 10 columns; owner `dems_owner`; 0 triggers | planted grant, above |
| M6S-7 B-3 | old code `(4,'dbc-5')` refused on the migrated database; this code passes | both directions |
| M6S-8 files | `0011` one CREATE TABLE; `0012` three statements, no blanket form; `0008`-`0010` hash to the values the live ledgers store | - |
| Mapping (unit) | 155 passed; 4 of 4 mutations red (no sort; old version rule; labels NULL; way back drops the members) | the mutations |

Runs. db project, files of this row only (`test/db`, `src/db`, capture-config, the five pinned
files): **31 files, 671 passed, 1 failed** - `bulk-fixture.db.test.ts` "the mix", 63 vs 67 audit
types (row 132's contract landing; not this row). `set4/5/6` a second time: 69 passed.
Unit `src/db test/db test/static`: 790 passed, 6 failed, none from this row -
`fixtures/__tests__/audit-details.test.ts` x4 and `build.test.ts` x1 (the same 63 vs 67),
`test/static/imports.test.ts` x1 (`src/modules/capture-discovery` has no index yet).
Typecheck: 0 errors in this row's paths; 3 elsewhere (`onvif-session.test.ts:331`,
`capture-discovery/connect/__tests__/limits.test.ts:183`, `rbac-matrix.support.ts:623`). Lint: 0
findings in this row's paths. The whole db project was not run.

## 4. The four development databases

Pre-flight: `pg:status: OK, running`; 0 listeners on 4420-4423 (before and after).

| Database | Before | After | Run 1 | Run 2 | Row counts |
|---|---|---|---|---|---|
| `dems_lane_1` | 4 (dbc-5) | 5 (dbc-6) | applied `0011`, `0012` | nothing | 41 lines identical; + `session_stt_config 0` |
| `dems_lane_2` | 4 (dbc-5) | 5 (dbc-6) | applied `0011`, `0012` | nothing | same |
| `dems_lane_3` | 4 (dbc-5) | 5 (dbc-6) | applied `0011`, `0012` | nothing | same |
| `dems_demo` | 4 (dbc-5) | 5 (dbc-6) | applied `0011`, `0012` | nothing | same |

`diff` of `db:status` before / after without the migration lines: only the version line, `41 -> 42
table(s)`, the one new count line and the closing lines differ; `seeded_at`, audit head and every
other count are identical (`capture_devices 5`, `evidence_items 13`, `paired_devices` 1/1/1/5).
After: `db:status: OK` and `13 file(s); ledger matches` on all four. Raw outputs: session
scratchpad `row129b/`.

## 5. For row 115 - the snapshot store

Replace `createMemorySnapshotStore` by two statements as `dems_app` (typed table `sessionSttConfig`,
`SessionSttConfigRow` in `src/db/schema`):

```sql
-- put (then get): returns what the session HOLDS - the first snapshot, always
INSERT INTO public.session_stt_config
  (session_id, enabled, backend, endpoint, model, language, diarization, credential_kind, config_revision, taken_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (session_id) DO NOTHING;
-- get
SELECT session_id, enabled, backend, endpoint, model, language, diarization, credential_kind, config_revision, taken_at
  FROM public.session_stt_config WHERE session_id = $1;
```

`config_revision` = `StoredSttSelection.revision`, `credential_kind` = `credentialKind`,
`taken_at` = `takenAt`; bigint columns answer as text through raw `pg`. Never UPDATE or DELETE
(`42501`). A database refusal on put (`23514`: an endpoint the CHECK refuses) must end as "no
snapshot", i.e. no transcription - not as the current configuration.

## 6. Not proven here / for the controller

1. **Row 115 is not wired**: the statements are proven as `dems_app`, not through the port;
   `M6-STTCFG-NEXT` across a real Core restart is row 115's to re-run.
2. **Shared type for B (blocking rows 82 / 83, request filed 10:35:39Z):** `manifestVersion?` and
   `labelsStatus?` on the sim `EvidenceItem` and in `EvidenceItemSchema`. Until then no producer
   sets them; a Core restarted on a `(2, hash, labels)` or `(2, NULL, NULL)` row would hold an item
   the strict slice schema refuses. No such row exists on the four databases (13 v1 items each).
3. **Stricter way back:** a stored item row `(1, hash, *)`, `(1, *, labels)` or `(2, NULL, labels)`
   is now refused at load (`ROW_SHAPE`) where it was read leniently. None exists in the seed, the
   fixture or the four databases; say so if a lenient reading is preferred.
4. **`credential_ref` is not in the snapshot** (section 1) - a deviation from the brief's list.
5. **Stale version pin, files not touchable:** none found in the tree today. Rows 116, 132, 133,
   136, 142 are writing db tests with `[4, 'dbc-5']`: each such assertion is red from now on and
   needs `[5, 'dbc-6']` (grep: `dbc-5` under `apps/core-server/src` outside `src/db`).
6. **Fixture vs 67 audit types** (6 red tests, row 132's landing) - note filed, not fixed here.
7. `capture-config/routes.ts` `micsInInputOrder` (now a no-op) and the describe text in
   `state-slices.ts`: requested, not edited.
8. "Old code refused" is B-3 called with the old pair, not a booted older build. A Core built from
   code older than this row is now refused by B-3 on all four databases.

---
*Generated: 2026-10-09*
