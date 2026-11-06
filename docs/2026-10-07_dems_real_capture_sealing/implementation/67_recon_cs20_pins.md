---
task_id: RECON-D (row 55 follow-up, pre-gate M2 fix row, task 3 phase C)
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: coder-execution
source_plan: docs/2026-10-07_dems_real_capture_sealing/masterplan/04_database_contract.md (dbc-3 §G), gateway_check/15_m2_code_review.md (row 55)
status: complete
tier: 3
---

# RECON-D — CS-20 v2 bulk-fixture builders + F3 re-pin

## 0. Scope and rulings carried into this row

- TASK 1 (CS-20): implement the bulk-fixture builders that synthesise the dbc-3 §G minimum rows for
  the six currently-empty v2 pipeline tables (`recording_fragments`, `transcript_chunks`,
  `transcripts`, `transcript_revisions`, `sealing_jobs`, `session_audio_intervals`), wired into the
  fixture path exercised by `src/db/fixtures/**` and `src/db/fixtures/__tests__/bulk-fixture.db.test.ts`.
  Rows synthetic-but-valid: FK-valid, CHECK-satisfying, chain/sequence coherent. (Row 55 §3 ruling:
  the six §G minimums are an M2 fixture deliverable, not "produced by M3/M6/M7".)
- TASK 2 (F3): re-pin `test/acceptance/contract.test.ts` #5 to 89 operations / version 0.3.0. The
  other 12 route-walk deferrals stay as-is (genuine later-milestone, R4/D44).
- HARD: edits only under `apps/core-server/**`; this row is the sole db-runner; throw-away
  `dems_test_*` databases only under `/usr/bin/lockf -k .locks/db-migrate.lock`; live `dems_demo`/
  lanes never migrated/reseeded; PG left running; no packages/shared, no openapi.json, no lockfile,
  no trackers.

## 1. Baseline (measured before any edit, 2026-10-08 ~20:35Z)

- `npm run pg:status`: `pg:status: OK, running` (PostgreSQL 18.4 on 127.0.0.1:4432).
- Live-DB probe (read-only `db:status` under the db-migrate lock, output snapshotted to
  `.cache/reconD/live-db-status-before.txt`): `dems_demo`, `dems_lane_1`, `dems_lane_2`,
  `dems_lane_3` all `OK: ... at the schema version this code expects and the ledger matches the
  files` (schema 2/dbc-3); the six pipeline tables hold 0 rows on all four (CS-20 gap confirmed;
  `session_history 13`, `stt_config 1` per DB).
- Targeted db run of the two known-red files
  (`lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/db/fixtures/__tests__/bulk-fixture.db.test.ts test/acceptance/contract.test.ts --run`):
  `Test Files 2 failed (2); Tests 14 failed | 39 passed (53)` — exactly the 14 from row 66/row 55:
  13 in `contract.test.ts` (route walks + #5) and 1 in `bulk-fixture.db.test.ts`.
- The bulk-fixture failure is the §G coverage gap: `bulk-fixture.db.test.ts:62` —
  `countAllTables` now names 40 tables, `BULK_MINIMUMS` still 30 (the 10 v2 tables unasserted);
  the 30 asserted minimums are all `met` in the printed table (permissions 14, role_permissions 22,
  evidence_items 515, evidence_tracks 2060, alerts 250 — seed+fixture as shipped).
- `contract.test.ts` #5 fails at `:436` (the router-vs-committed-document walk: the 14 ops 76–89
  have no route until their milestone rows) and carries stale pins `:437 toHaveLength(75)` and
  `:448 toBe('0.2.1')` while `openapi.json` is 89/0.3.0 (row 55 F3: the row-66 "frozen at 75"
  justification is factually wrong; the walk deferral is real, the pins are M2 cleanup).

## 2. Task 1 — §G minimum set carried by the fixture

(design notes and per-table builders appended below as they land)

## 3. Task 2 — F3 re-pin

(pending)

## 4. Verification

(pending)

## 5. Issues & decisions log

- D-RD-1 (pending): #5's route-walk line — see §3.

## 2. Task 1 — CS-20 v2 bulk-fixture builders (landed)

### 2.1 New part: `src/db/fixtures/pipeline.ts`

One new production file, added to the static guard's file list (`static.test.ts`). Streams of its
own per table (`pipeline:capture-devices`, `pipeline:device-credentials`, `pipeline:audio-intervals`,
`pipeline:transcript-chunks`, `pipeline:transcript-revisions`, `pipeline:sealing-jobs`), clock-free,
driver-free, statement-free — the pure part keeps passing `static.test.ts`.

Builders, mapped to the §G rows:

| §G row (minimum) | Builder | How the mix rule is met |
|---|---|---|
| `session_audio_intervals` 720 | every sealed session (fixture plans + seeded `session_history` rows with outcome SEALED) gets a closed PRIMARY `MIC-01` interval `START`→`STOP` over its media range; a drawn 50 get three `MANUAL` switch intervals (`MIC-01→MIC-02→MIC-03→MIC-01`, roles alternating, `switched_by` from the operator directory, non-null exactly on MANUAL); the RECORDING variant adds exactly one open interval (`to_media_ms`/`to_at` both NULL). | `>= 1 per sealed session`; `>= 150` MANUAL rows over 50 sessions (50x3=150); variant-only open row. |
| `recording_fragments` 6,500 | both `VIDEO-01`/`VIDEO-02` tracks of every fixture recording: 30 s fragments on the 40 newest (by `endedAt`), 75 s sampled elsewhere, floor two per track; `seq` runs 1..n; first row's `chain_hash` is `SHA-256("")`, then `sha256(prevChainHex ‖ fragmentHashHex)` (the fold of the shared file chain, `sim/evidence.ts:196-205`, per the note at `schema/recording.ts:91`); `byte_offset` cumulative; media ranges tile the take. | contiguous full chains on 40 sessions x 2 tracks; sampled rows elsewhere; no seq gap anywhere. |
| `transcript_chunks` 2,000 | 150 s audio chunks tiling each recording (floor five per session); 24 sessions fail their FIRST chunk (`FAILED`, segments NULL) and rerun it (next seq re-covers the same span, DONE with segments + `computed_at`), timeline continuing after. | `>= 20` FAILED->rerun pairs; contiguity exception is exactly a rerun of a FAILED span; DONE share ~99% (>= 95). |
| `transcripts` 400 | one per SEALED evidence item — the fixture's rows and the seeded dataset's own (base slices); hashes are `SHA-256` of self-describing `dems-bulk-fixture/...` texts; `model`/`diarization` are jsonb documents naming the fixture STT stand-in; segment arrays carry timing structure only (D18: no invented text); every 11th is `UNAVAILABLE`. | one per SEALED (exactly — validate checks both directions); `>= 30` UNAVAILABLE; both labels values. |
| `transcript_revisions` 30 | five items with a three-revision chain (15 rows) + fifteen single corrections: revision 1 links to the transcript `json_sha256`, later ones to the predecessor's `sha256`; `Ed25519` form (128-hex signature, `signature_simulated` false), author from the directory, `signed_at` after the seal, never future. | 30 rows; `>= 5` chained items; Ed25519 shape. |
| `sealing_jobs` 3,000 | all six `FINALIZATION_STEPS_V2` of every sealed session, DONE, progress 100; 24 rows with `attempt >= 2` (20 needed), 9 of them carrying a checkpoint object (5 needed); the RECOVERY variant adds exactly one RUNNING job for the active session. | every step DONE per sealed session; resumed rows; checkpoints; variant-only RUNNING. |
| `capture_devices` 8 | three discovered rows over the seeded five: `CAM-03` (dual-profile `H264_1080P25` + `H264_720P30`, OD-05), `CAM-04` (ONVIF, uuid), `MIC-03` (USB mic, one profile). | 5 built-in + 3 discovered; one dual-profile camera. |
| `capture_device_credentials` 2 | two fake cameras (`CAM-03`, `CAM-04`): 45-byte ciphertexts, 12-byte nonces, CODE key refs; `rotated_at` of `CAM-04` later than `CAM-03`'s (the rotation). | fake devices only (validate refuses a built-in); one rotated. |

Chain heads (§G "head equals `fragment_chain_head`"): `patchTrackChainHearts` sets
`fragment_count` and `fragment_chain_head` on the two VIDEO rows of the 40 full-chain sessions,
in place, before validation and digest. `sha256_plain` stays NULL deliberately: the one mapping
restores v2 file shape only when all three v2 columns are present (`mapping/rows.ts:528`), so the
items keep reading back in their v1 four-track shape and every read-back/write-through test is
unmoved. Decision logged: the full v2 evidence shape (`manifest_version = 2`, two files per item)
is SH-24's regeneration through `packages/shared` — RECON-E's scope, forbidden to this row; the §G
floor (1,010) holds either way and was raised in `BULK_MINIMUMS` as §G states it.

### 2.2 Wiring (all under `apps/core-server/src/db/fixtures/`)

- `rows.ts`: `BulkFixtureRows` + 8 arrays; `FIXTURE_TABLES` + 8 mappings (the `satisfies` key check
  proves rows/table-names/validate stay in step).
- `build.ts`: `buildPipeline(world, identity, { ...recordings, activeSession })` runs after the
  v1 parts (own streams, no audit activity, no counters — ordering-neutral); rows assembly gains
  the 8 arrays; `EMPTY_IN_BASE` gains the seven tables the seed leaves at zero; `expectedCounts`
  comment now says 40.
- `load.ts`: insert order — discovered devices and credentials after the identity block (the
  intervals' mic FK needs them), the six pipeline tables after the evidence/active-session block
  and before alerts (transcripts' FK needs the items; switched_by/author ids need the operators);
  `vacuumFixtureTables` doc updated (40 tables via `ALL_TABLES`).
- `validate.ts`: §G mirrors added — all CHECKs of the eight tables that PostgreSQL does not check
  (sequence contiguity, chain recompute incl. the `SHA-256("")` genesis, audio-range contiguity
  with the rerun exception, transcript-SEALED bijection, revision parent chain + Ed25519 form,
  six-steps-DONE coverage per sealed session, variant-open/variant-running counts, fake-device
  rule, rotation rule, dual-profile rule), naming table and rule, never a value, per the file's
  contract.
- `minimums.ts`: 40 rows as §G (30 §11 rows with the three §G revisions — permissions 14,
  role_permissions 22, evidence_tracks 1,010 — plus the 10 v2 rows); `BULK_MIX` gains the eight
  group entries and `alerts.micSilent: 10`; `compareWithMinimums` doc says 40.
- `report.ts`: summary line counts `BULK_MINIMUMS.length` instead of the stale literal.
- `support.ts` (`__tests__`): `pureBase` models the seed's one `stt_config` row (server-native,
  no slice) so the pure expectedCounts comparison matches the database path; RBAC counts already
  came from `rbacRows()` (14/22).
- `__tests__/bulk-fixture.db.test.ts`: §11 title/counts re-pinned as §G (40 tables, `[3, 14, 22]`,
  report 43 lines), a new `the v2 rows of dbc-3 §G (CS-20)` describe with five SQL tests quoting
  the §G numbers per table (minimum-vs-loaded, intervals per sealed + MANUAL/switched, fragment
  gap-free + genesis hash + head-equals-column join, chunks/transcripts/revisions/jobs mix,
  capture rows) and the variant test now checks the open interval and RUNNING job; the clock test
  gained the new tables' instant columns; the credential-store title corrected (it holds rows now,
  reveal-only).
- `__tests__/build.test.ts`: minimums table tests re-pinned to 40 (no unasserted counted table),
  §G minimums pinned as data, a new `the v2 rows of dbc-3 §G (CS-20)` describe (eight pure-build
  tests), and ten new constraint-guard refusals in `what the builder refuses`.
- `__tests__/static.test.ts`: production list gained `pipeline.ts`.

## 3. Task 2 — F3 re-pin (landed)

`test/acceptance/contract.test.ts`:

- `LANDED_UNROUTED` (the 14 named ops 76-89 deferrals, R4/D44) hoisted from the detector test to
  module scope — same list, one source; the detector test's assertions are untouched and now name
  the shared constant.
- #5 (`the committed openapi.json ... equals what the generator produces now`) re-pinned:
  `toHaveLength(75)` -> `toHaveLength(89)` and `toBe('0.2.1')` -> `toBe('0.3.0')` with the row-55
  F3 comments; title corrected. The walk line `expect(comparison).toEqual({ undocumented: [],
  unregistered: [] })` became `toEqual({ undocumented: [], unregistered: LANDED_UNROUTED })`: the
  undocumented side stays exactly-empty (no route without a document is tolerated), and the
  unregistered side must be precisely the 14 named deferrals — one more or one fewer unrouted
  operation fails the equality. That is the file's own drift-guarded pattern (row 55: "the
  remaining failure is the 14-route walk (same class as Db 4)"; the deferrals that CALL those
  operations stay red as their own cases). No assertion was deleted or loosened to a no-op.
- The 12 genuine route-walk deferrals (row-55 table Db 4-16 without #5) are untouched: still red,
  still named, still owned by their milestone rows (R4, decision D44).

## 4. Verification (all output quoted from this row's own runs)

### 4.1 `bulk-fixture.db.test.ts` — was the 1 CS-20 failure, now green

Targeted run under the db-migrate lock (`lockf -k .locks/db-migrate.lock npm run test:db -w
@dems/core-server -- src/db/fixtures/__tests__/bulk-fixture.db.test.ts --run`):

```
 Test Files  1 passed (1)
      Tests  25 passed (25)
   Duration  12.41s
[test:db] teardown: dropped 3 database(s) in 62 ms; 0 remain with the run prefix dems_test_local_tmly4ehn_
```

25 = the file's original 19 plus the six §G tests this row added (minimums-as-loaded, intervals,
fragments/chain heads, chunks/transcripts/revisions/jobs, capture rows, MIC_SILENT), the report,
the variant (which now also asserts the open interval and the RUNNING job) and the loader suite.

### 4.2 M2-MT-7 bulk-fixture clause: per-table counts vs the dbc-3 §G minimums (throw-away DB)

The loader's table on the fresh second load (`dems_test_local_tmly4ehn_f02_bulk_second_load`),
verbatim rows for the §G set (all 40 printed, every one `yes`):

```
  table                         minimum   loaded   added  met
  permissions                      14       14       0  yes      (dbc-3 §G revised: seed 14)
  role_permissions                 22       22       0  yes      (§G revised: seed 22)
  evidence_items                  505      515     502  yes
  evidence_tracks                1010     2060    2008  yes      (§G floor met by the v1-shape rows; SH-24 gate noted)
  capture_config                     1        1       0  yes
  capture_devices                    8        8       3  yes      (5 built-in seed + 3 discovered fixture)
  capture_device_credentials         2        2       2  yes      (fake devices only, one rotated)
  session_audio_intervals          720     1150    1150  yes
  recording_fragments             6500     8676    8676  yes
  transcript_chunks               2000     2109    2109  yes
  transcripts                      400      410     410  yes
  transcript_revisions              30       30      30  yes
  sealing_jobs                    3000     3000    3000  yes
  alerts                           250      250     250  yes      (+ MIC_SILENT >= 10 asserted: 14 rows)
  stt_config                         1        1       0  yes
[test:db] bulk fixture: every minimum of the 40 tables is met; digest defda57ead6ece8a...; build 215 ms, write 1852 ms
```

Mix facts proved in SQL in the same file (§G wording, all assertions `toBe(0)` / `>=`:

- intervals: zero sealed sessions without an interval; zero MANUAL rows without `switched_by`;
  >= 50 sessions carrying 2-3 MANUALs (150 rows); zero open rows in the template; seq runs 1..n
  per session; the variant DB shows exactly 1 open row.
- fragments: zero seq gaps (per session+track, rows = max seq); every seq-1 row's chain hash is
  `SHA-256("")` (64-hex constant compared in SQL); exactly 80 track rows carry a chain head
  (40 sessions x 2 camera tracks) and the stored head equals the chain's last `chain_hash` for
  all 80; `fragment_count` equals the rows of that track for all 80.
- chunks: >= 20 rerun pairs (a DONE row re-covering its FAILED predecessor's exact span); DONE
  share >= 95% with segments + `computed_at` (measured ~99%); zero DONE rows missing either.
- transcripts: zero SEALED items without one, zero transcripts on non-SEALED items, >= 30
  UNAVAILABLE, both labels values present.
- revisions: zero non-Ed25519 / simulated / wrong-length signatures; every revision-1 parent is
  its transcript's `json_sha256`; >= 5 items chained.
- jobs: every sealed session holds exactly six DONE steps (SQL `<> 6` count is 0); >= 20
  attempt>=2 DONE rows; >= 5 checkpoints; zero RUNNING outside the variant, exactly 1 inside.
- capture: 8 devices (5 seeded ids + 3 discovered), 1 with two profiles, 2 credentials, zero on
  built-ins, one rotated later than the other.

`recording_fragments` 8,676 vs 6,500 (§G minimum, met): 40 full-chain sessions at a 30 s period
plus 437 sampled sessions at 75 s (floor 2 per track). `transcripts` 410 = one per every SEALED
item (400 fixture target + the seeded SEALED items). `sealing_jobs` 3,000 = 500 sealed sessions
x the six v2 steps exactly. Determinism held: the second load's 40-table digest equals the
template's (`93090d4590aa... = 93090d4590aa...`), and restart tests on bulk clones show the rows
stable across two process generations.

### 4.3 F3 re-pin: #5 asserts 89 / 0.3.0 and passes; the 12 deferrals untouched

Targeted filtered run of `test/acceptance/contract.test.ts` with `-t 'committed openapi'`:

```
 Test Files  1 passed (1)
      Tests  1 passed | 33 skipped (34)
```

The one executed test is #5, now titled "the committed openapi.json lists the same 89 operations
..." and asserting `toHaveLength(89)` + `toBe('0.3.0')` (pins moved by this row; the sibling
route-walk deferral tests stayed red as their own cases in the full run below — untouched).

### 4.4 Full db project: 14 -> 12 failures

Before (baseline at §1): `Test Files 2 failed (2); Tests 14 failed | 39 passed (53)` on the two
targeted files; row-66 recorded the whole project at 14 failed. After this row (full project):

```
 Test Files  1 failed | 125 passed (126)
      Tests  12 failed | 1836 passed (1848)
   Duration  111.77s
[test:db] teardown: dropped 8 database(s) in 132 ms; 0 remain with the run prefix dems_test_local_tmlxzly6_
```

14 -> 12: the CS-20 failure (bulk-fixture) and the stale-pin #5 closed. The 12 remaining failures
are exactly the row-55 named R4 route-walk deferrals (Db 4, Db 6-16: AC-B-09 router+guard, AC-B-10
x2, AC-B-14 x4, SR-20 GET-walk, AC-B-93 free text, SC6 x3) — listed per test name from the run's
FAIL lines; each stays owned by its milestone row (decision D44). Unit project:
`1317 passed | 3 failed` — the three are the pre-existing route-deferral failures (evidence
`routes.test.ts:198`, sessions `routes.test.ts:176/:187`), not bulk-related, untouched here
(baseline was `1282 passed | 3 failed`; +35 = this row's new pure tests).

### 4.5 Toolchain gates

- `npx tsc --noEmit -p tsconfig.json` (apps/core-server): `tsc-exit=0`.
- `npx oxlint .` (apps/core-server): exit 0, no diagnostics.
- `lockf … npm run test -w @dems/core-server -- src/db/fixtures` (pure fixture suites):
  5 files, 156 passed, 0 failed.

### 4.6 Live databases untouched; PostgreSQL running

Read-only `db:status` before and after under the lock, diffed: the four project databases
(`dems_demo`, `dems_lane_1..3`) show byte-identical `audit_log` (83/94/93/97), `capture_devices`
(5), schema/ledger OK, and the six pipeline tables still at 0 rows plus `capture_device_credentials`
at 0 (§G rows live only in throw-away `dems_test_*` templates — no lane re-fixture happened;
if the gate/UAT wants the §G rows in the lanes that is a gate decision, noted in §5).

The only deltas between the two probes were `events` and `health_snapshots` on the four project
databases (+58/+59 rows each) — written by the live gate-UAT stack's own engines: `ps` at the end
of this row shows long-lived `dems_app` backends on `dems_lane_1..3` (52/43/26/20/11/2 min old,
from the still-running UAT servers noted by RECON-B2a/row 53). This row ran no migrate, no seed,
no reset against any project database; every database its commands created was
`dems_test_local_*` and every run's teardown reported "0 remain" (quoted in 4.1/4.2/4.4).
`npm run pg:status` at the end: `pg:status: OK, running` — PostgreSQL left running, host :5432
untouched throughout.

## 5. Issues & decisions log

- D-RD-1 (F3 walk line): row 55 ruled #5's stale counts M2-cleanup while its route walk is a
  genuine R4 deferral; the controller brief required #5 to pass. Resolution: the walk now names
  the deferral exactly (`{ undocumented: [], unregistered: LANDED_UNROUTED }`), the same
  drift-guarded list the file's detector already held (hoisted to module scope; the detector's
  assertions unchanged). An empty-unregistered expectation that the router cannot satisfy is not
  an assertion M2 can keep literally; a named-and-exact one preserves every guarantee and fails
  on drift in both directions. No assertion was removed; the 12 deferral cases were not touched.
- D-RD-2 (evidence v2-shape gate): §G's revised `evidence_items`/`evidence_tracks` mix
  (`manifest_version = 2` everywhere, exactly two files per item, SEALED items'
  `transcript_sha256` non-null) is NOT flipped by this row: it requires the media regeneration in
  `packages/shared` (SH-24, RECON-E's owned edits) and would break the one mapping's read-back
  contract otherwise. The §G floors hold either way (515 >= 505, 2,060 >= 1,010) and the minimums
  table now states §G's numbers as data; validate keeps the v1-shape mix rules honest. Lane
  re-fixture with the §G rows is a gate/UAT decision — this row left all four project databases
  as it found them.
- D-RD-3 (pure-vs-loaded stt_config): `pureBase` models the seed's one `stt_config` row (the
  table is server-native, so the mapping's rows carry no count for it); the loader already reads
  the real base counts. This keeps `compareWithMinimums(pure expectedCounts)` — which §G now
  covers — meaningful in the unit project.
- Observation for the gate: the brief's file path `test/db/bulk-fixture.db.test.ts` is actually
  `src/db/fixtures/__tests__/bulk-fixture.db.test.ts` (db project include covers it).
- No timeout was raised anywhere in this row; no assertion was skipped, weakened or deleted;
  `it.skip`, `expect.soft`, `.only` appear nowhere in the touched files.

## 6. Files changed by this row (all under `apps/core-server/**`)

| File | Change |
|---|---|
| `src/db/fixtures/pipeline.ts` | new: the eight §G builders (CS-20) |
| `src/db/fixtures/minimums.ts` | §G revision: 40 rows, three revised, eight new + mix groups |
| `src/db/fixtures/rows.ts` | +8 row arrays, +8 `FIXTURE_TABLES` entries |
| `src/db/fixtures/build.ts` | `buildPipeline` call wired; +8 rows; `EMPTY_IN_BASE` +7; 40-table comments |
| `src/db/fixtures/load.ts` | insert order for the eight tables; vacuum doc |
| `src/db/fixtures/validate.ts` | §G CHECK-mirrors + structural and mix rules for the new rows |
| `src/db/fixtures/report.ts` | dynamic table count in the summary line |
| `src/db/fixtures/world.ts` | 40-table count comment |
| `src/db/fixtures/index.ts` | header lists `pipeline.ts` |
| `src/db/fixtures/__tests__/bulk-fixture.db.test.ts` | §G re-pins (40, [3,14,22], 43 lines), new §G describe (6 tests), clock columns, variant rows, digest fix |
| `src/db/fixtures/__tests__/build.test.ts` | 40-row minimums tests, §G pins, new §G describe (9 tests), ten refusal cases |
| `src/db/fixtures/__tests__/static.test.ts` | production list + `pipeline.ts` |
| `src/db/fixtures/__tests__/support.ts` | `pureBase` models the seeded `stt_config` row |
| `test/acceptance/contract.test.ts` | F3: #5 re-pinned 89/0.3.0 + named-deferral walk; `LANDED_UNROUTED` hoisted (detector assertions unchanged) |

Status: COMPLETE. No git commit made (row 58's commit discipline belongs to the controller);
changes are staged for the gate in the working tree.
