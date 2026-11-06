---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 49 (phase C, milestone M2, class B; M2-W4; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: identification/02_structured.md rev 2.1 row 49; masterplan/04_database_contract.md (dbc-3) §B, §E.3, §G; masterplan/03_api_contract.md (C3) §2.4
narrative_tier: 3
status: needs-review - CS-18 (mapping v2 shapes) complete and verified; CS-19 seed vocabulary proven; CS-20 bulk-fixture v2 and SH-24 v2 media are gated on rows 51/52/53 + packages/shared (see Persistent Issues)
closes: CS-18 (mapping half, complete); CS-19 (seed vocabulary 14/22 proven; capture-table target shape proven); CS-20 (partial - see below); MT-2 (throw-away stand-in)
depends_on: row 46 (migrations landed), row 47 (shared vocabulary landed)
verification: M2-MT-2 PASS (throw-away); M2-MT-7 seed counts 14/22/1/5/0 PASS (throw-away, quoted); bulk-fixture §G minimums NOT MET (root cause documented); live dems_demo + lanes proven still v1; PG left running; oMLX left DOWN (never started); 0 media added to git
---

# Row 49 / M2-W4: mapping v2 shapes + seed vocabulary + fixture/evidence status

## 0. Summary

| Item | Result |
|---|---|
| `db/mapping/*` v2 shapes (CS-18) | **DONE** - all 15 new columns filled; signature narrowed on read-back; round-trip stable |
| core-server typecheck, db source scope (`db/{mapping,seed,fixtures}` non-test) | **0 errors** (was 6) |
| core-server total TS errors | **55 -> 49** (this row cleared exactly its 6 scoped errors) |
| mapping unit tests (`src/db/mapping/__tests__`) | baseline (my edits stashed) **25 failed** -> with my edits **9 failed**; **fixed 16, zero regressions** |
| Seed vocabulary (CS-19): permissions / grants | **14 / 22** proven on a throw-away DB (INVESTIGATOR 5, SUPERVISOR 12, TECHNICIAN 5 - matches dbc-3 §E.3) |
| Capture tables (CS-19 target): config / devices / credentials | **1 / 5 / 0** proven CHECK-valid on a throw-away DB; production seed wiring owned by the capture-config module (row 52 / CS-21) |
| M2-MT-2 (copy-migration validates against v1 rows, no rewrite) | **PASS** on a throw-away (v1-shaped item stored `manifest_version = 1`; 4-track pos 1..4 + tamper AUDIO-02 accepted by kept CHECKs :353/:338) |
| M2-MT-7 bulk-fixture §G minimums (fragments/chunks/sealing_jobs/transcripts/revisions + revised mix) | **NOT MET** - the v2 bulk fixture is unbuilt; root cause in §6 |
| SH-24 demo evidence regenerated as v2 | **NOT RUN** - generator default target is a tracked path and v2-ness is gated on the shared sim (row 51 kept dataset items v1 by design) + row 52/53; see §6 |
| STEP 0 recovery + integrity | cluster recovered from `stopped`; all four live DBs still `(1,'dbc-2')`, 30 base tables, 0 v2 tables, journal 4 |
| Media added to git | **0** (all scratch under git-ignored `.cache/row49/`) |
| oMLX server | **DOWN before and after** - never started; log untouched |
| Project PostgreSQL at close | **running** (left up for rows 112/53) |

## 1. Scope gate (what this row must not do, and did not)

* No migration applied to any live database. Every write went to a fresh `dems_test_capture_row49`
  created through the sanctioned test seam (`runCreate/runMigrate(..., { allowTestDatabase: true })`,
  `seedDatabase(..., { target: 'test' })`), dropped in `finally`. Post-run probe: `dems%` = the four
  project databases only; `dems_test_%` = 0.
* Credentials read in-process by the repo's own `readOwnerConnection` / `createOwnerPool`
  (`src/db/commands/owner-connection.ts`); never printed, never staged, never arg-passed. Never
  connected as `dems_admin`. Every db command wrapped in `/usr/bin/lockf -k .locks/db-migrate.lock`.
* Files changed are exactly three, all inside this row's allowed set:
  `apps/core-server/src/db/mapping/rows.ts`, `apps/core-server/src/db/mapping/slices.ts`,
  `apps/core-server/src/db/fixtures/operations.ts`. No file under `packages/shared/**`,
  `apps/core-web`, `apps/mobile`, `apps/mock-core`, `release`, the migrations folder, or any
  controller-owned tracker was edited. `openapi.json` and the lockfile untouched; `SIM_SNAPSHOT_VERSION`
  not bumped (per the atomic-bump note routed by row 51). No commit made (none requested). No git
  remote/push, no sudo.
* oMLX (shared SMART WMS service) was never started; its log was therefore never touched. It is DOWN
  at close, matching its required resting state.

## 2. STEP 0 - recover and protect the database

`npm run pg:status` reported `stopped` (the prior crashed attempt left the cluster down). Started the
project-local cluster with `npm run pg:start` -> PID on `127.0.0.1:4432` (TCP only, no Unix socket);
`pg:status: OK, running`. Read-only owner probe (under the migrate lock) confirmed integrity BEFORE any
work and again AFTER:

```
dems databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
dems_demo    schema_meta={"schema_version":1,"contract_revision":"dbc-2"} baseTables=30 v2TablesPresent=[] journal=4
dems_lane_1  schema_meta={"schema_version":1,"contract_revision":"dbc-2"} baseTables=30 v2TablesPresent=[] journal=4
dems_lane_2  schema_meta={"schema_version":1,"contract_revision":"dbc-2"} baseTables=30 v2TablesPresent=[] journal=4
dems_lane_3  schema_meta={"schema_version":1,"contract_revision":"dbc-2"} baseTables=30 v2TablesPresent=[] journal=4
```

No corruption, no unexpected migration, no stray throw-away. No `BLOCKED:DB_INTEGRITY` condition.

## 3. Mapping v2 shapes (CS-18) - done

The 15 new columns (dbc-3 §B.10-§B.12) were filled in `db/mapping/rows.ts`:

| Table | Columns added in the builder | Read-back handling |
|---|---|---|
| `evidence_items` | `manifestVersion` (derived: `transcriptSha256 != null ? 2 : 1`, D-DB-01), `transcriptSha256` (`item.transcriptSha256 ?? null`), `labelsStatus` (`null` - no item-level sim home) | `transcriptSha256` restored when non-null; `manifestVersion`/`labelsStatus` are derived/bookkeeping so the way back ignores them, keeping `toRow(fromRow(row))` byte-stable |
| `evidence_tracks` | `kind='FILE'`, `containsAudio=true`, `codec/durationMs/fragmentCount/fragmentChainHead/sha256Plain=null` (the sim `EvidenceTrack` carries only the four v1 members) | ignored on read-back; contract-fixed values for a shape the state does not model |
| `active_session` | `captureConfig/audioSource/transcriptStatus` = `storableJson(session.<field> ?? {})`, `startedBy/stoppedBy = null` | a non-empty snapshot reads back; the `{}` an absent snapshot stored reads back as absent (MR-2), so a v1 session is byte-stable |

Signature read-back (error `rows.ts:490`): the sim `EvidenceSignature` type still carries the literal
`'SIMULATED-SHA256'`/`simulated: true` (v1 simulated-only rehydration). The way back now guards
`signatureSimulated === true` AND `signatureAlgorithm === 'SIMULATED-SHA256'` and assigns the literal;
a real (Ed25519/ECDSA) seal is read through the evidence module, not the state. This respects the
"Do not touch `packages/shared/**`" boundary - the shared signature type is not widened here.

`slices.ts`: the two new `SimState` slices (`captureConfig`, `captureDevices`) were classified as
server-native UNMAPPED (each is its own KEPT table; storage half = row 52), mirroring the existing
`pairing` precedent. This clears the compile-time "every slice is accounted for" proof without claiming
storage behaviour this row does not own.

`fixtures/operations.ts`: `FAULT_DEVICE` extended to the 14 fault kinds (`MIC_SILENT`, `CAPTURE_FAULT`).

## 4. Verification commands and outputs (quoted)

### 4.1 Typecheck (my scope clean; total improved)

```
$ npm run typecheck -w @dems/core-server   # filtered to db source scope, excluding __tests__
(no output -> 0 errors in src/db/{mapping,seed,fixtures})
total core-server TS errors: 49     # was 55 before this row's edits
```

### 4.2 Mapping unit tests (zero regression, 16 fixed)

```
baseline (my 3 edits stashed): Tests 25 failed | 110 passed (135)
with my edits:                 Tests  9 failed | 126 passed (135)
```

The 9 remaining are pre-existing stale v1 count/slice pins caused by row 47's shared widening
(`33 slices ... 5 not mapped`; `3 roles, 12 permissions and 18 grants (4,10,4)`), the same class row 45
§7.4 documented. They are NOT caused by this row's edits (which strictly reduced the failure count).

### 4.3 Throw-away DB: MT-2 + MT-7 seed counts (ALL PASS, exit 0)

Driver `.cache/row49/verify.mts` (git-ignored), run as
`/usr/bin/lockf -k -t 180 .locks/db-migrate.lock npx tsx .cache/row49/verify.mts </dev/null`:

```
PASS | MT-7 | db:create exit 0 | exit=0
PASS | MT-7 | db:migrate exit 0 (schema 2 / dbc-3) | exit=0
PASS | MT-7 | permissions = 14 | 14
PASS | MT-7 | role_permissions = 22 | 22
  grants per role: INVESTIGATOR=5, SUPERVISOR=12, TECHNICIAN=5
PASS | MT-7 | capture_devices = 5 | 5
PASS | MT-7 | capture_config = 1 | 1
PASS | MT-7 | capture_device_credentials = 0 | 0
PASS | MT-2 | v1-shaped item stored with manifest_version = 1 (default, no rewrite) | mv=1
PASS | MT-2 | v1 4-track shape (pos 1..4, tamper AUDIO-02) accepted by kept CHECK :353/:338 | tracks=4
PASS | cleanup | no dems_test_* throw-away left behind | remaining=0
ROW49 THROW-AWAY RESULT: ALL PASS
```

Seed counts equal the listed values: **14 permissions / 22 grants / 1 capture_config / 5 devices /
0 credentials**. The 22-grant split matches dbc-3 §E.3 (SUPERVISOR 12, INVESTIGATOR 5, TECHNICIAN 5).

MT-2 note: the ALTER-on-existing-live-rows half of MT-2 is proven by construction in row 46 §6 (every
0004 change is additive or relaxing; kept CHECKs :353/:338 unchanged). Cloning the live `dems_demo` is
forbidden by this row's red lines, so the data-compatibility half is exercised here directly: a
v1-shaped item (defaulted `manifest_version = 1`, SIMULATED 64-hex signature, four tracks position 1..4,
tamper on AUDIO-02) is accepted by the migrated v2 schema and stored unchanged.

## 5. Media location

No media was generated or written by this row. All scratch (probe + driver scripts) lives under the
git-ignored `.cache/row49/`. `git status --untracked-files=all` shows **0** untracked media files
(mp4/m4a/aac/mp3/wav/mov/mkv); nothing staged.

## 6. Residuals, owners, and the two things this row cannot close alone

CS-20 (bulk fixture v2) and SH-24 (demo evidence regenerated as v2) are NOT completed by this row.
Root cause, precisely:

1. **The v2 evidence dataset is produced in `packages/shared/**`, which this row must not touch.**
   A read-only probe of `buildSeedState('idle')` showed the 13 dataset items are still v1-shaped
   (`tracks.length = 4`, `files`/`transcriptSha256`/`fragmentChainHead` absent). Row 51 (COMPLETE)
   records this as intentional: "dataset items keep byte-identical v1 shape per OD-02 L2"; the v2
   fields ride on the *live seal* path and the *frozen package regeneration*, not the sim item shape.
   The §G bulk-fixture minimums for the nine new tables (`recording_fragments` 6,500;
   `transcript_chunks` 2,000; `sealing_jobs` 3,000; `transcripts` 400; `transcript_revisions` 30;
   `session_audio_intervals` 720; revised `evidence_tracks` 1,010 two-per-item; `capture_devices` 8;
   `capture_device_credentials` 2) require a builder over that v2 dataset - greenfield work entangled
   with the capture-config module (row 52) and lane seeding (row 53).
2. **The SH-24 generator's default target is a tracked path.** `packages/shared/scripts/gen-demo-evidence.ts`
   writes `packages/shared/assets/demo-evidence` and `src/demo-data` unless `--out <dir>` redirects it;
   running it against the repository would add media to git, violating this row's red line. Its v2
   output additionally depends on point 1. Therefore it was not run, and oMLX (needed only for the audio
   fixture) was never started.
3. **Capture-config seed wiring.** The seeded `capture_config` profile code cannot reuse the sim's
   `CAPTURE_PROFILE_1080P25` verbatim: it contains a hyphen, which the DB `code()` CHECK
   (`^[A-Z][A-Z0-9_]{0,63}$`) rejects. The authoritative state->row translation (and the KEPT-table
   upsert carry) is CS-21 / row 52 ("Code lands in CS-21", dbc-3 §E.1). This row proved the target
   *shape and counts* (1/5/0) on a throw-away with CODE-valid values, but did not wire the production
   seed insert to avoid encoding an inconsistency row 52 must resolve.

## 7. Persistent Issues

| Issue | Attempts | Root cause | Current status | Blocking? |
|---|---|---|---|---|
| M2-MT-7 bulk-fixture §G minimums not met | 1 (bounded probe) | v2 evidence dataset lives in `packages/shared/**` (forbidden); row 51 keeps sim items v1 by design; new-table fixture builders are greenfield across rows 52/53 | unresolved / handed off | yes for full MT-7; no for MT-2 or the seed-count half |
| SH-24 v2 media not regenerated | 1 (read-only inspection) | generator default target is tracked; v2-ness gated on the shared sim + row 52/53; oMLX only needed for the audio fixture | unresolved / handed off | yes for SH-24; no for CS-18/CS-19-vocabulary/MT-2 |
| 9 stale mapping-test pins (slice counts, 12/18 grants) | n/a | row 47 widened shared Permission/FaultKind/slices; test expectations not yet refreshed | unresolved / owned by the row-47 consumer set + inventory regen | no (does not affect the quoted seed counts or MT-2) |

## 8. Handoff

- **Row 52 (capture-config module)**: wire the production seed insert of the 5 built-in devices + 1
  default `capture_config` (reconcile the hyphenated profile code), plus the KEPT-table upsert carry
  (CS-21). Then MT-7's capture-table counts come from the seed itself, not a probe.
- **Rows 52/53 + SH-24**: build the v2 bulk fixture over the regenerated v2 dataset to meet the §G
  minimums; regenerate the 14 frozen packages as v2 into a git-ignored location (or the sanctioned
  assets path via the owning row), using host FFmpeg and, for the audio fixture, the installed oMLX TTS
  (back up `~/.omlx/logs/omlx-serve.log` first, serialise calls, never print the key, restore DOWN).
- **Row 47 consumer set**: refresh the stale mapping-test count/slice pins.

## 9. Independence note

Written from the row text, dbc-3 §B/§E.3/§G, C3 §2.4, artifacts 10/11/15, D36, the typed schema, the
committed migrations, and the code itself. Rollback: `git checkout -- apps/core-server/src/db/mapping/rows.ts apps/core-server/src/db/mapping/slices.ts apps/core-server/src/db/fixtures/operations.ts`;
no database, media, or tracker state was touched beyond the docs written for this row.

---
*Generated: 2026-10-08*
