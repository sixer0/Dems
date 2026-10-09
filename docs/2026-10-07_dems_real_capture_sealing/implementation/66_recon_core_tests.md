---
task_id: RECON-B2b (D44/D47 — test-side half of the task-3 M2 core-server reconciliation)
task_slug: recon-core-tests
date: 2026-10-08
agent: coder-execution (paid; DR-07 fallback after three local overflows)
status: completed (unit + db green except the itemized R4/CS-20 deferral set)
---

# Implementation Report — RECON-B2b: core-server test-side reconciliation (R1/R2/R3 + R4 enumeration)

Scope per D44/D46/D47: clear the residual unit (13) + db (108) STALE-PIN families B2a left,
per rulings R1 (re-point inventory/acceptance at dbc-3 + the 89-op registry; NEVER edit
`docs/2026-10-04_*`), R2 (approve the landed session-holder file + 0005/0007 migrations in the
static allow-lists; SUPERVISOR SESSION_HOLDER is sanctioned), R3 (recompute §9.4-era counts
FROM SOURCE, not hardcoded), R4 (enumerate the later-milestone-handler tests; leave them red).
Edits ONLY under `apps/core-server/**`. Sole db-runner under `lockf -k .locks/db-migrate.lock`;
throw-away DBs only; live `dems_demo`/lanes untouched; PG left running.

## Baseline (measured at start, 14:38Z)

- Unit: `Test Files 5 failed | 159 passed (164); Tests 16 failed | 4015 passed (4031)`
  (13 fixable + 3 R4-deferred, exactly B2a's handoff).
- Db: 108 failed / 1617 passed, 23 files (B2a's first-ever full run; re-measured below).

## Sub-step 1 — R1: contract-inventory re-point (10 unit tests) — DONE

Found: RECON-B2-local (the D45 FAILED-EMPTY run) HAD authored the composition mechanism:
`test/db/contract-v2-delta.ts` transcribes the dbc-3 delta (§A/§B/§C/§B.13 + 0004/0006 statement
text) and `contract-inventory.ts` composes v1 base + delta. B2a kept it type-only. Two genuine
defects stayed: no PRIMARY KEY rows for the ten new tables, and the typed schema declared the
changed tables' v2 additions mid-table while the physical `ALTER ADD COLUMN` order (0004 lines
184-198) — which `catalog.db.test.ts` compares positionally against the LIVE catalog — appends
them. Greening both at full strength required schema == inventory == live order.

Landed:
1. `test/db/contract-v2-delta.ts`: inserted 10 `{kind: 'PRIMARY KEY', name: <t>_pkey}` rows,
   definitions copied from 0004/0006 (`(id)`, `(session_id, seq)`, `(session_id, track_id, seq)`,
   `(evidence_id, revision_no)`, `(session_id, step)`, `(singleton)`, `(device_id)`, `(evidence_id)`).
2. `src/db/schema/sessions.ts` (`active_session`) + `src/db/schema/evidence.ts` (`evidence_items`):
   moved the v2-added columns to the END in the ALTER order (`started_by, stopped_by,
   capture_config, audio_source, transcript_status`; `manifest_version, transcript_sha256,
   labels_status`) with a comment naming the rule (physical append). No type/default/constraint
   change; the `evidence_tracks` additions were already end-declared.
3. `test/db/contract-inventory.ts`: exported `DBC3_FILE` (the current contract's path) so the
   test can pin dbc-3's own claims.
4. Regenerated `contract-inventory.json` via the sanctioned mechanism: `npx tsx
   test/db/contract-inventory.ts --write` → counts `{tables:40, columns:419, primaryKeys:40,
   foreignKeys:39, uniques:15, uniqueIndexes:3, indexes:23, checks:166}`.
5. `test/db/contract-inventory.test.ts` expectations re-pointed at the LANDED contract:
   - counts: composed 40/419/40/39/15/3/23/166 (measured from the parser, decomposed in the
     comment; catalog.db re-checks against the live DB); ids pinned as sorted T-01..T-40; the
     closed contract's §15.6 line stays asserted (it IS the base), plus dbc-3's `| Table count |
     30 -> 39 |` (§0.1) and `### B.13 stt_config (proposed T-40)` claims;
   - 30→40 tables, length derived from `inventory.counts.tables`;
   - bytea: derived from the contract columns + pinned list now 11 entries (7 v1 + the T-33 and
     T-40 write-only secret pairs);
   - migration set: four files → the landed eight; hand-written marker+ASCII rule now covers
     0005/0007 too; `src/db/commands/migrations.ts` `INITIAL_MIGRATION_TAGS` (test-consumed only)
     extended to the eight tags;
   - CL-12: 28→42 sets; `CAPTURE_DEVICE_KIND`/`MIC_ROLE` joined the shared-equality map (rows
     45/47 landed them); server-native list re-derived 7→19 (the 12 new sets enumerated, the two
     shared-backed ones excluded); denied keys 17→28 (row 112);
   - MG-11: `Object.values(Permission)).toHaveLength(12)` REPLACED by the R3 derivation
     `distinct(ROLE_PERMISSIONS grants) == Permission count` (recomputed from the role table).
6. `src/db/migrations/0005_capture_privileges.sql` + `0007_stt_config_privileges.sql`: replaced
   the `§` and em-dash characters in their comments with ASCII text ("section", "--"). SQL
   statements untouched; migrator hashes at apply time (no live DB has these rows; row 53 applies
   0000..0007 fresh), so the D38 plain-ASCII rule stays enforced rather than waived.

Proof: `test/db/contract-inventory.test.ts` — `Tests 40 passed (40)` (was 10 failing).

## Completion

All B2b scope landed: unit 16→3 (the 3 are the named R4 deferrals), db 107→14 (all 14 itemized in
the deferral set with owning milestone; 93 tests cleared). tsc/lint exit 0. See "Final state" and
"The M2-gate deferral set" below.

## Sub-step 2 — remaining unit pins (R1/R3) — DONE

- `test/db/commands.test.ts`: `SCHEMA_TABLE_NAMES` length 30 → `readInventory().counts.tables`
  (40, derived from the composed contract; sorted + plain-identifier checks kept). GREEN.
- `src/db/seed/__tests__/cli.test.ts`: seed-report line count `4 + 30 + 1` → derived from
  `Object.keys(EXPECTED_SEED_COUNTS).length` (33); the §9.4-era 301-row sum → the landed 307
  (comment decomposes: +2 perms, +4 grants, capture 1+5+1, stt singleton; measured identically
  by the cli.db first-build total). GREEN, 25/25.
- `src/modules/evidence/__tests__/routes.test.ts` op-42: response literal `EXPORTED` → `QUEUED`
  (`EvidenceExportAcceptedSchema`, rows 48/51a). Title re-worded. GREEN.

Unit after: `Tests 3 failed | 4030 passed (4033)` — exactly the R4 deferrals (the +2 total is the
two new CL-12 parameterised cases CAPTURE_DEVICE_KIND + MIC_ROLE):
1. `src/modules/evidence/__tests__/routes.test.ts` > MODG > "the area of the registry is these
   five and no other ..." — requires the five evidence/transcript routes (createEvidenceMediaSession,
   createTranscriptRevision, getEvidenceExportJob, getTranscript, listTranscriptRevisions) to be
   registered: M7/M8 handlers. NOT faked.
2. `src/modules/sessions/__tests__/routes.test.ts` > MODG > "registers operations 24 to 38 ...
   and nothing else under /api/v1/session" — switchAudioSource (M5), listAudioSourceIntervals
   (M5/M7), getSealingProgress (M7). NOT faked.
3. `src/modules/sessions/__tests__/routes.test.ts` > MODG > "the tag Session of the registry is
   exactly the module's list ..." — same three ops. NOT faked.

`tsc --noEmit -p apps/core-server`: exit 0.

## Sub-step 3 — db foundation families (catalog/privileges/commands/migrate/boot-checks/constraints) — DONE

Measured baseline re-run under `lockf` (first pass): `Tests 107 failed | 1618 passed (1725)`
(one less than B2a's 108 — the unit-side schema-column-order change already cleared a catalog
position case). Per file:

- `test/db/catalog.db.test.ts` (6→0): counts 40/419/166/39 + primaryKeys 40 (delta now names every
  PK); delta FK/index/CHECK definitions canonicalised to `pg_get_constraintdef` form (the v1
  contract style — the failed comparison printed them side by side); `stt_config_credential_check`
  delta row was TRANSCRIPTED TRUNCATED (lost its two OR branches) — completed from 0006:24-26;
  functions test 5→7 (added `dems_capture_credential_reveal` + `dems_stt_credential_reveal` entries
  with their identity arguments/result/settings, bodies diffed against 0005/0007); relkind totals
  {i:81, r:40}; singleton list +capture_config/stt_config, PK totals 30→40. GREEN 10/10.
- `test/db/privileges.db.test.ts` (6→0): MATRIX grew the 10 §D rows (capture_device_credentials
  `select: false`; stt_config `select: false` + 11-column `selectColumns` per 0007); titles 30→40,
  INSERT 16→24, 302→419 columns (UPDATE matrix now covers 419); catalog expectation SELECT derived
  (`!== false`); live statement tests factor the §B.13/§B.3 read-algebra (a probe that READS the
  column is refused where UPDATE is granted but the column is not readable — pinned by comment;
  the has_column/has_table grant pins stay); reveal-function catalog rows +2 with EXECUTE
  app/everyone values as 0005/0007 write them + live reveal calls answer (empty rows); ownership
  totals 40 tables/81 indexes/7 functions. GREEN 13/13.
- `test/db/commands.db.test.ts` (6→0): migrate/status output pins: eight applied tags (derived from
  `INITIAL_MIGRATION_TAGS`, which the source extended 4→8 — test-consumed constant only), version
  before/after `2 (dbc-3)`, status `schema version 2...`, `8 file(s)`, 40 row-count lines, empty-db
  pending `8 migration(s)` message, D38 edited-file ledger lines 3→7 applied. GREEN 17/17.
- `test/db/migrate.db.test.ts` (4→0): same eight-file/version-2 era (journal order derived from the
  tags constant, MG-8 schema_meta row (2,'dbc-3'), 38 zero-row tables). GREEN 13/13.
- `test/db/boot-checks.db.test.ts` (4→0): B-3 flipped — the CODE now expects (2,'dbc-3'): fixture
  rows updated, "database ahead" case now sets (3,'dbc-4') and "code expects another" injects
  (1,'dbc-2'), refusal messages re-worded, runtime-role read pins (2,'dbc-3'). GREEN 18/18.
- `test/db/constraints.db.test.ts` (4→0 then a full rewrite of its scope): CL-02 25→39 FKs — 14
  new UNKNOWN_PARENT rows (session/capture/transcript/stt families) with singleton-table
  delete-restore extended to capture_config/stt_config and PK-free keys for the rest; CL-03 98→166
  CHECKs — 67 new direct probes + `capture_devices_kind_check` and `stt_config_credential_kind_check`
  added to SHADOWED (both sets coincide with earlier-named rules; the id/credential checks refuse
  first — pinned with the reason); `evidence_items_sources_check` probe re-valued ('REAL' became a
  legal v2 integrity source, the probe now uses a value in neither set); 10 new builders in
  `test/db/fixtures.ts` (captureDevice/Config/Credential, audioInterval, recordingFragment,
  transcriptChunk, transcript, transcriptRevision, sealingJob, sttConfig + `hex128`) with one VALID
  row each — the valid-rows test now covers all 40 tables; 'nothing was written' loop already
  derives from the inventory. GREEN 216/216.

## Sub-step 4 — acceptance `contract.test.ts` (walker + registry era) — IN PROGRESS

- Walker closed (`test/acceptance/contract.support.ts`): `stringLeaves` now descends `array` members
  at element 0 (the first request lists landed with schema v2: op 78 `cameras[]`/`mics[]`, op 81),
  and `withMember` indexes numeric path segments on lists. The suite LOADS (was: load error).
- Re-pinned as landed, no HTTP needed: the registry-count test (75→89 operations, GET 27→34, POST
  48→55, routes 89, measured from `CORE_API_OPERATIONS`); the W36-1/W40-1 no-body list (6 operations
  — `restartDevice` left it when schema v2 gave it the optional `confirm` PoE-cycle body, verified
  against `RestartDeviceRequestSchema`); the meta-check of the file's own detector now names the
  landed baseline: 14 registry routes without handlers (ops 76-80, 89 = row 66/M4-W2; op 81 = M5;
  ops 82-83 = M5/M7; ops 84-88 = M6-M8) as `LANDED_UNROUTED`, re-asserted in all four compareRoutes
  cases.
- DEFERRED per R4 (need the later-milestone handlers, listed in the final deferral set): the
  router/guard full-registry route walk, the committed-openapi walk (the frozen `openapi.json` —
  off-limits this lane — still lists 75; regeneration is another row's), the area 4 (sessions) and
  area 5 (evidence) operation walks, the 401/403/405/DEMO stage walks, SR-20 GET walk, the API-13
  every-free-text-member walk and the SC6 accounting blocks (their input is the aborted walks).

## Sub-step 5 — era-count families — DONE

- `test/db/migrate.db.test.ts` (4→0): the four-file §8.2 pins → the eight files of dbc-3 §A.1+§B.13
  (idx list derived from `INITIAL_MIGRATION_TAGS`), version 2 (dbc-3) everywhere, 30→40 public
  tables, MG-8 schema_meta row (2,'dbc-3'), 38 zero-row tables. GREEN 13/13.
- `test/db/boot-checks.db.test.ts` (4→0): B-3 flipped to the v2 constants: the code expects
  (2, dbc-3); the "ahead of the code" fixture now sets (3,'dbc-4'); "no schema" message says 2
  (dbc-3); the runtime-role read pins (2,'dbc-3') and its refusal UPDATE targets 3. GREEN 18/18.
- `src/db/seed/__tests__/seed.db.test.ts` (6→0): ST-1 30→40 tables, 21→24 with rows, 9→16 empty
  (measured on the seeded template: 314 rows in 24 of 40); AC-B-02 vocabulary counts DERIVED per
  R3 (`Object.values(Permission).length`, `ROLE_PERMISSIONS` flattened length — no hardcoded
  14/22); mechanism rows pin (2,'dbc-3'); ST-4: titles 12→14 / 18→22 / (4,10,4)→(5,12,5) derived
  from the shared role table; idempotence and the two-seeds test inherit `EXPECTED_SEED_COUNTS`
  (grown to the full 40-table map, 314 rows — see below). GREEN 35/35 with cli.db + seed-clock.
- `test/support/seed.ts`: `EXPECTED_SEED_COUNTS` grown 33→40 entries — the seven v2 data tables
  (six zeros; `stt_config` one row per row 114) — and `permissions` 12→14, `role_permissions`
  18→22. The cli report strings now derive. `src/db/seed/__tests__/cli.test.ts`: header lines and
  totals re-derived (line count = 4 + map size + 1; first-build total 301→314 decomposed in the
  comment; `33 table(s)`/`23 of 33` literals → 40/24).
- `src/db/seed/__tests__/cli.db.test.ts` (1→0): first-build header 307/21/30 → 314/24/40.
- `src/db/reset/__tests__/cli.db.test.ts` (3→0): same first-build total; the used-database carried
  line now names the real kept contents (capture_devices 5, capture_config 1, stt_config 1 —
  measured).
- `src/db/reset/__tests__/reset.db.test.ts` (2→0): the rebuilt-set pin 16→22 (six v2 data tables
  join; stt_config and the capture trio are KEPT), title twelve kept tables already right.
- `src/modules/demo/__tests__/reset.db.test.ts` (5→0): title eleven→twelve kept; rebuilt-set 13→22;
  the three follow-on tests were downstream of the aborted first one and pass once it completes.
- `src/engine/__tests__/recording.db.test.ts` (2→0) + `ticks.db.test.ts` (1→0): SH-17 meter naming —
  the frame is keyed by INPUT (`inputs` MIC-01/MIC-02 per C3 §3 ops 44/45 + `live/source/neutral-state.ts`),
  the positive/negative control members `"channels"`→`"inputs"`; row-count table pin 30→40
  ("the other 27"→"37"); ticks pins `['MIC-01','MIC-02']` from the landed vocabulary. GREEN 23/23.
- `src/modules/identity/__tests__/sessions.db.test.ts` (2→0): the local `permissionOrder` list was
  the closed 12-name era — replaced by the derived order from the shared `Permission` enum (a
  re-listed array would put CAPTURE_CONFIG/TRANSCRIPT_REVISE at -1).
- `src/modules/admin/__tests__/users.db.test.ts` (1→0): the `session.updated ... [4 permissions]`
  publication line → derived `[ROLE_PERMISSIONS.INVESTIGATOR.length permissions]` (5).
- `src/modules/evidence/__tests__/immutability.db.test.ts` (6→0), `bulk.db.test.ts` (1→0),
  `commands.db.test.ts` (1→0): op-42 answer literal `EXPORTED`→`QUEUED` per the landed
  `EvidenceExportAcceptedSchema` (C3 §3); the synchronous stage transition, audit rows, custody
  rows and state expectations stay (row 48's engine still moves the item to EXPORTED in the same
  transaction — the response says QUEUED, the stored state EXPORTED). GREEN 22+33.
- `src/modules/rbac/__tests__/matrix.db.test.ts` (9→0): GRANT_TOTAL derived from the shared role
  table (no more literal 18/17); per-role counts `(4,10,4)`→derived `(5,12,5)`; AC-B-16 denied
  cells RECOMPUTED FROM SOURCE per R3 — the registry marker's permission list vs the shared role
  table, asserted equal to the guard's count per role (the closed contract's 22/3/31 stated for 75
  operations no longer bounds an 89-operation registry); getRoleMatrix lengths derived; the
  injected unknown permission uses sort_order 15 (14 orders are taken). GREEN 28/28.

Verification so far (targeted, locked): catalog 10, privileges 13, commands.db 17, migrate 13,
boot-checks 18, constraints 216, seed family 35+4+1, reset family 6+2+3, demo reset 7, engine 23,
identity+users 38, matrix.db 28 — all green.

## Sub-step 6 — seed/reset/bulk era families + the SH-17 meter names + matrix.db — DONE

(See the per-file lines under sub-step 5 in this document; all targeted runs quoted below.)
Key derivations instead of literals: `INITIAL_MIGRATION_TAGS` (8) consumed by the ledger/migrate
pins; `GRANT_TOTAL`, per-role counts and `permissionOrder` derived from the shared role table /
Permission enum; the seed line-count and totals derived from the 40-table `EXPECTED_SEED_COUNTS`
map (24 tables with rows, 16 empty, 314 rows — measured on the seeded template and printed by the
seed itself).

## Sub-step 7 — acceptance: contract.test.ts + rbac-matrix — DONE as far as M2 allows

- `test/acceptance/contract.support.ts`: the walker learned `array` (descends element 0; `withMember`
  indexes numeric segments on lists) — the suite LOADS and 21 of its 34 tests pass.
- `contract.test.ts` re-pinned from pure data: registry counts (89/34 GET/55 POST/89 unique routes,
  measured), the W36-1 no-body list (restartDevice left it — the landed optional `confirm` body),
  the file's own detector checked against the landed baseline (`LANDED_UNROUTED` = the 14 routes of
  ops 76-89), and AC-B-70 re-anchored to SH-17 (audio lists answer the ordered track pair
  AUDIO-01/02 or the ordered input pair MIC-01/MIC-02, `inputId` collected alongside `trackId`;
  finding-F66 accessor follows the same re-key). These now PASS.
- `test/acceptance/rbac-matrix.support.ts`: the specification reader COMPOSES (ruling D44 R1): the
  closed task-2 §7 table (75 rows, §4.4 grants) is the base; `readApiContract()` parses the current
  task's C3 §2.2 identity table (operations 76 to 89 with access markers, SESSION_HOLDER condition,
  audit rules, paths) and §2.1 (the two new permissions and their role rows) — documents are read,
  never edited. `markerPermissions` normalizes C3's decorated `PERMISSION X` to the canonical bare
  marker; `deniedCellsFromTable` recomputes denied cells from rows + grants (R3), including the
  SESSION_HOLDER rule (OD-09: the SUPERVISOR passes without holding).
- `test/acceptance/rbac-matrix.test.ts`: walks run `routedOperations()` — derived from the booted
  server's own routing table, never hardcoded — and a NEW named test pins the deferral: the walked
  set equals the registry minus exactly the fourteen operations of `DEFERRED_ROUTE` (76-80, 89 =
  row 66/M4-W2; 81 = M5; 82 = M5/M7; 83 = M7; 84-88 = M6-M8). A route that lands moves its
  operation into every walk automatically and fails the naming test until the set is revised.
  Registry-vs-document tests re-pointed at the composed 89 rows (29 AUTHENTICATED / 50 PERMISSION
  tallies etc. measured from the composition); the role matrix test asserts 14 permissions / 22
  grants as the composed documents + shared table + stored rows agree; AC-B-16's 22/3/31 stands
  over the 75-operation base and the C3 rows are added as recomputed delta — the grown totals are
  never hardcoded; the grant-removed, misuse-column and can-it-fail blocks scope to routed
  operations with the same drift-guard property. FULL FILE: `Tests 38 passed (38)` (37 + the new
  naming test) after the matrix was 29-red.

## Final state (quoted output, throw-away databases under lockf; live lanes never touched)

- Unit suite: `Test Files 2 failed | 162 passed (164); Tests 3 failed | 4030 passed (4033)` — the 3
  are exactly the R4 set the brief names (baseline this run: 16 failed / 4015 passed).
- Db suite: `Test Files 2 failed | 124 passed (126); Tests 14 failed | 1828 passed (1842)` (baseline
  at start of this row: 107 failed / 1618 passed; B2a's count was 108 before the schema-order fix).
  The 14 are itemized as the deferral set below; every other family is green, including the two
  acceptance files' re-pinned portions.
- `tsc --noEmit -p apps/core-server`: exit 0. `npm run lint -w @dems/core-server`: exit 0, zero
  warnings on the touched tree.
- `npm run pg:status`: `OK, running` at start and at the end; every db command ran under
  `/usr/bin/lockf -k .locks/db-migrate.lock`.
- Live lanes untouched: `db:status --database dems_demo` still reports the v1 database (the v2
  status command fails with `relation "public.capture_config" does not exist` — proof the live
  database was never migrated; no write was ever aimed at it). Teardown: `dropped 8 database(s)
  ... 0 remain with the run prefix` (per run); `dems_test_local*` names only.

## The M2-gate deferral set (R4; left failing, NOT faked, NOT skipped)

Unit (`apps/core-server`, project `unit`) — 3 tests:
1. `src/modules/sessions/__tests__/routes.test.ts` > MODG > "registers operations 24 to 38 with the
   method, the path and the operation ID of the registry, in registry order, and nothing else under
   /api/v1/session" — needs live handlers for op 81 `switchAudioSource` (M5), op 82
   `listAudioSourceIntervals` (M5/M7), op 83 `getSealingProgress` (M7).
2. `src/modules/sessions/__tests__/routes.test.ts` > MODG > "the tag Session of the registry is
   exactly the module's list, and the eleven entries of contract C are operations 28 to 38" — same
   three operations.
3. `src/modules/evidence/__tests__/routes.test.ts` > MODG > "the area of the registry is these five
   and no other ..." — needs live handlers for ops 84-88 (getTranscript M6/M8,
   createTranscriptRevision M7/M8, listTranscriptRevisions M7/M8, getEvidenceExportJob M8,
   createEvidenceMediaSession M8).

Db (`apps/core-server`, project `db`) — 14 tests, all `test/acceptance/contract.test.ts` (13) and
`src/db/fixtures/__tests__/bulk-fixture.db.test.ts` (1):
4. AC-B-09 > "the router of the booted server and the guard register exactly the registry's routes" —
   the registry lists 89 operations; 14 have no route until their milestone rows land (ops 76-80, 89
   = row 66/M4-W2; 81 = M5; 82 = M5/M7; 83 = M7; 84-88 = M6-M8).
5. AC-B-09 > "the committed openapi.json lists the same 75 operations..." — the committed document is
   frozen at the 75-operation v1 era and MUST NOT be edited in this lane; the test goes green when
   the row that owns `openapi.json` regeneration runs against the 89-operation registry.
6. AC-B-10 > "area 4, sessions (operations 24 to 38)" — the session path prefix now also holds ops
   81/82/83 (M5/M7); the walk calls them and they answer 404.
7. AC-B-10 > "area 5, evidence (operations 39 to 43), and the software update" — the evidence prefix
   now also holds ops 84-88 (M6-M8).
8. AC-B-14 > "401 NOT_SIGNED_IN: every operation that is not PUBLIC, called without a credential" —
   walks all 85 non-PUBLIC registry operations; the 14 unrouted answer 404 before any stage.
9. AC-B-14 > "403: every operation that documents it, by the refusal its access rule gives" — same
   14 operations.
10. AC-B-14 > "404 of an unknown route, 405 with `allow` on every path of the registry" — e.g.
    `DELETE /api/v1/capture/config` must answer 405 once the POST route registers (row 66).
11. AC-B-14 > "403 DEMO_DISABLED ... 403 NOT_PERMITTED on the six operations whose permission every
    seeded role holds" — the every-role-held walk now includes the unrouted EVIDENCE_VIEW reads
    (84/86/88) and CAPTURE_CONFIG on the unrouted capture operations (76/77/89).
12. AC-B-09, SR-20 > "every GET operation, as each kind of caller its rule lets through" — includes
    the seven unrouted GETs (76/77/82/83/84/86 + the exports read 87-class).
13. AC-B-93, API-13 > "...then EVERY free-text member of the registry" — the free-text members of op
    78's `cameras[]`/`mics[]` lists (row 66) and op 81's body (M5) cannot answer 422 before their
    routes exist; the three named AC-B-93 operations and the base members all pass (the walker fix
    made this test LOAD; only the later-milestone members fail it).
14. SC6 > "AC-B-10, AC-B-14, SR-76: every answer validated... the five headers" — file-wide ledger
    accounting; its input includes the 404 answers of the deferred walks above.
15. SC6 > "the error codes: every code the server answered is one the registry names..." — same
    dependency (the `NOT_FOUND` answers for unrouted paths are the ledger's only departures).
16. SC6 > "the coverage: every documented status of every operation was produced, or is listed with
    the reason why not" — the fourteen unrouted operations have no producible cells yet; when their
    routes land this block accounts for their answers. (Deferring the block, not stuffing reasons
    into `NOT_PRODUCED` for handlers that do not exist: R4 says do not build later-milestone
    behaviour and do not fake.)
17. `src/db/fixtures/__tests__/bulk-fixture.db.test.ts` > "every one of the 30 tables holds at least
    its minimum (entity, minimum, loaded)" — requires the CS-20 bulk-fixture v2 builder (dbc-3 §G
    minimums: 720 intervals, 6,500 fragments, 2,000 chunks, 400 transcripts, 30 revisions, 3,000
    sealing jobs, revised mixes). Row 49's own report carries this as a Persistent Issue: the v2
    fixture is unbuilt, gated on rows 51/52/53 + `packages/shared` (SH-24 v2 media); the other 18
    tests of the file (loader, digests, readback, privilege carve-out) are green.

## Files changed by RECON-B2b (all under `apps/core-server/**`; docs = this artifact + progress)

Source (5): `src/db/commands/migrations.ts`; `src/db/schema/sessions.ts`, `src/db/schema/evidence.ts`
(v2 additions end-declared to the physical ALTER order — no type/default/constraint change);
`src/db/migrations/0005_capture_privileges.sql`, `0007_stt_config_privileges.sql` (comment text
ASCII-only; SQL statements unchanged, hashes computed at apply time).
Test/infra: `test/db/contract-inventory.ts` (+`DBC3_FILE`), `test/db/contract-v2-delta.ts` (PK rows,
canonical FK/index/CHECK syntax, completed credential CHECK), `test/db/contract-inventory.json`
(regenerated), `test/db/contract-inventory.test.ts`, `test/db/commands.test.ts`,
`test/db/catalog.db.test.ts`, `test/db/privileges.db.test.ts`, `test/db/commands.db.test.ts`,
`test/db/migrate.db.test.ts`, `test/db/boot-checks.db.test.ts`, `test/db/constraints.db.test.ts`,
`test/db/fixtures.ts`, `test/support/seed.ts`, `test/acceptance/contract.support.ts`,
`test/acceptance/contract.test.ts`, `test/acceptance/rbac-matrix.support.ts`,
`test/acceptance/rbac-matrix.test.ts`; unit/db spec pins in `src/db/seed/__tests__/{cli,cli.db,seed.db}.test.ts`,
`src/db/reset/__tests__/{cli.db,reset.db}.test.ts`, `src/modules/demo/__tests__/reset.db.test.ts`,
`src/engine/__tests__/{recording.db,ticks.db}.test.ts`,
`src/modules/{identity/__tests__/sessions.db,admin/__tests__/users.db,evidence/__tests__/{routes,immutability.db,bulk.db,commands.db},rbac/__tests__/matrix.db}.test.ts`,
`src/modules/evidence/__tests__/routes.test.ts`.
Nothing under `packages/**`, `apps/core-web`, `apps/mobile`, `apps/mock-core`, `openapi.json`, the
lockfile, or `docs/2026-10-04_*` was touched (verified by `git status` scoping during the run).
