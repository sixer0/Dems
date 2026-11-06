---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 114 (phase C, milestone M2, class B; R-8 / D20 confirmed as Q-STT-CFG (a) by D24; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: identification/02_structured.md rev 2.1 row 114; masterplan/04_database_contract.md (dbc-3) §B.13 + §E.1; masterplan/01_specs.md R-8 AC-1 (Q-STT-CFG item 11); implementation/51 (§B.13 table), 13 (kept set + upsert), 12 (seed)
narrative_tier: 3
status: complete
closes: R-8 seed/kept clause; M2-STTCFG-DB reset clause (producing row's 2 runs; +1 stays at the row-56 gate); CS-21 kept set 11 -> 12
depends_on: row 49 (seed program), row 54 (kept-tables upsert carry), row 112 (stt_config table + 0007 privileges) — all DONE
verification: M2-STTCFG-DB seed/kept/reset clauses PASS x2 on throw-away databases (exit 0 each); seeded singleton row image-equal after a permitted db:reset in two independent images; kept set = 12 quoted; no credential value in seed, fixture or git (grep proof); live dems_demo + three lanes proven still (1,'dbc-2') / 30 tables / no stt_config before AND after; every throw-away dropped (0 remain with the run prefix); PostgreSQL left running on 127.0.0.1:4432
---

# Row 114 / R-8: STT configuration seeded, joined the kept set, survives the demo reset

## 0. Summary

| Item | Result |
|---|---|
| Seed writes the single `stt_config` row | DONE - `writeSeed` inserts one row per seed, the Q-STT-CFG item 11 default confirmed by D24: enabled, `cpu-local` (Q-D7 = a), endpoint null, model `ggml-large-v3-turbo`, language `id`, labelling on, revision 1 |
| A secret is never seeded (SD-8) | PROVEN - `credential_kind`, `credential_ref`, `secret_ciphertext`, `nonce` are all `null` in the constant, in the statement and in the stored row; grep over seed + fixture sources returns 0 credential values |
| `kept-tables.ts` 11 -> 12 | DONE - `stt_config` with mode `upsert`, key `singleton`, after the capture selector, lineage still last |
| Reset survival (M2-STTCFG-DB reset clause) | PASS - `report.kept['stt_config'] = 1`; the row is image-equal after a permitted `db:reset` in BOTH images (`to_jsonb` checksum = the form the routine carries, and the independent `t::text` dump) |
| Stronger clause: an EDITED configuration also survives | PASS - an op-91-shaped edit (disabled, `omlx-server`, loopback endpoint, labelling off, REFERENCE credential, revision 7) is image-equal after the reset: the carried row replaces the fresh seed row, the seed default never wins |
| Kept set = 12 | QUOTED below, from the runtime list |
| Runs | 2 independent executions under `/usr/bin/lockf -k .locks/db-migrate.lock`, both `Test Files 1 passed (1) / Tests 4 passed (4)`, exit 0 |
| Live databases | UNTOUCHED - all four still `(1,'dbc-2')`, 30 base tables, `stt_config=false`, journal 4, `strays_outside_four=[]`, identical probe before and after |
| Throw-away databases | DROPPEN - each run's teardown: `dropped 2 database(s) ... 0 remain with the run prefix` |
| PostgreSQL | LEFT RUNNING - `pg:status: OK, running`, PID 32505 listening on `127.0.0.1:4432`; host `:5432` never contacted |
| Not done here (other rows) | ops 90-92 (row 113, M6), the runtime key-loader + boot model check (row 115), the web menu (117), lane re-seeding to schema 2 (row 53), the gate's +1 run (row 56) |

## 1. Contract basis and the three decisions this row took

dbc-3 §B.13 fixes the table (landed by row 112 as `0006`/`0007`) and states its reset policy verbatim:
"Reset: **KEPT**, mode `upsert` (D-DB-08) - the configuration survives a demo reset (OD-19 pattern)",
with §E.1 booking it as the twelfth kept table. §E.3 fixes the seeding rule the row follows: the seed
writes the built-in configuration rows and `capture_device_credentials` is "seeded empty (a secret is
never seeded; SD-8)". Specs R-8 AC-1 is the check: "the kept table `stt_config` ... is image-equal
after `db:reset`; the secret column is never selectable by the runtime role". Q-STT-CFG item 11 gives
the initial value, confirmed as (a) by D24.

**D-a - the seed default.** Item 11 reads "enabled, backend `cpu-local` (if Q-D7 = a or c), otherwise
`omlx-server` on `http://127.0.0.1:8000`; language `id`; labelling on". D24 answered Q-D7 **(a)**, so
the seeded backend is `cpu-local` and `endpoint` stays null (`stt_config_endpoint_required_check` asks
for an endpoint only for the server backend). `model` is the **name** of the CPU engine's weights,
`ggml-large-v3-turbo` - the model built GPU-off in row 107, downloaded hash-pinned in row 108
(`.cache/stt/models/ggml-large-v3-turbo.bin`) and functionally proven in row 109 - not an absolute
path: the same seeded row has to be valid on a lane and on the x86 Core, and §B.13 calls the column a
"model path reference" whose resolution belongs to the transcriber boot check (CS-22, row 115).
Routed as a residual in §7.

**D-b - where the insert sits.** `writeSeed` writes the mapped dataset in the §9.5 order and already
attaches two unmapped tables inside that loop (`operator_credentials` after `operators`,
`registry_counters` after `engine_counters`). The STT singleton joins the same pattern immediately
after `console_settings` - the other configuration singleton, and before the audit log, so the chain
append and its head verification stay the last statements. Its only foreign key names `operators`,
which by then exists; the value is `null` anyway.

**D-c - where the kept entry sits.** After `capture_config`, before `audit_chain_history`: the capture
triple keeps its own FK order (devices -> credentials -> selector, §E.1), the STT row depends on
nothing but `operators`, and the lineage stays last. Mode `upsert` on key `singleton` reuses row 54's
`upsertCarriedStatement` / `compareCarried` machinery unchanged - which is why the row needed no edit
to the routine itself.

## 2. Files changed

### Source
| File | Change |
|---|---|
| `apps/core-server/src/db/seed/seed.ts` | `STT_CONFIG_SEED_DEFAULT` (frozen, typed by `Pick<NewSttConfigRow, ...>`) + `sttConfigSeedRow(at)`; the insert inside `writeSeed` after `console_settings`; header + order docs state the row and the SD-8 rule |
| `apps/core-server/src/db/seed/index.ts` | re-exports the two new names |
| `apps/core-server/src/db/reset/kept-tables.ts` | `kept(schema.sttConfig, 'upsert', 'singleton')` as the twelfth entry; header, `CarryMode` and `KeptImages` docs eleven -> twelve |
| `apps/core-server/src/db/reset/cli.ts` | doc line: twelve kept tables; the surviving-data list names the capture configuration and the STT configuration row |
| `apps/core-server/src/db/reset/index.ts` | doc line: twelve kept tables |
| `apps/core-server/src/db/reset/routine.ts` | R-3 doc line: twelve kept tables |

### Tests
| File | Change |
|---|---|
| `apps/core-server/src/db/reset/__tests__/m2-sttcfg-seed-kept.db.test.ts` | **NEW** - M2-STTCFG-DB seed / kept / reset clauses, including the edited-row case (4 tests) |
| `apps/core-server/src/db/reset/__tests__/kept-tables.test.ts` | 11 -> 12 names and modes; typed-table map gains `stt_config`; new test for the singleton's position, key, column list and upsert statement |
| `apps/core-server/src/db/reset/__tests__/cli.db.test.ts` | the kept-summary line now lists `stt_config 1` |
| `apps/core-server/src/db/seed/__tests__/seed-order.test.ts` | 19 -> 20 tables with `stt_config` after `console_settings`; insert total 299 -> 306 (comment decomposes it: 299 contract §9.4 - 2 migration rows + 6 v2 RBAC rows of row 49 + 1 STT row) |
| `apps/core-server/src/db/reset/__tests__/reset.db.test.ts`, `.../m2-guard-keepset.db.test.ts` | title/comment text "eleven kept tables" -> "twelve" only (no assertion touched) |

Untouched, as required: `packages/shared/**` (incl. `SIM_SNAPSHOT_VERSION`, still 1), `apps/core-web`,
`apps/mobile`, `apps/mock-core`, `release/`, `openapi.json`, the lockfile, the migrations folder
(no new migration: the table already exists since row 112), the controller trackers
(`status_tasks.md`, `delegation_progress_report.md`), `.data/pg.*`. No commit, no remote, no push, no
sudo. Scratch lives in the git-ignored `.cache/row114/`.

## 3. Verification - M2-STTCFG-DB, throw-away databases only, 2 runs

Driver: `vitest --project db --maxWorkers=2 --run` on the one new file, each execution wrapped in its
own `/usr/bin/lockf -k .locks/db-migrate.lock` (released when the command returned), `CI=true`, stdin
closed. The host has no `timeout`, so the row-112 perl shim was reused from `.cache/row112/bin`. The
databases are the run's own (`dems_test_local_*`, template `seed` clone), never `dems_demo` or a lane;
credentials are read in-process by the helper and never printed.

Run 1 and run 2 produced byte-comparable check sets; both exited 0. Quoted from run 1 (run 2 identical
apart from the run prefix):

```
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_local_tmkxpowk_
[row114] seeded stt_config | {"singleton":true,"enabled":true,"backend":"cpu-local","endpoint":null,"model":"ggml-large-v3-turbo","language":"id","diarization":true,"credential_kind":null,"credential_ref":null,"secret_bytes":null,"nonce_bytes":null,"revision":"1","updated_by":null,"updated_at":"1790823600000"}
[row114] kept set (12) | registry_counters, console_settings, pairing_codes, paired_devices, device_credentials, auth_sessions, biometric_tokens, capture_devices, capture_device_credentials, capture_config, stt_config, audit_chain_history
[row114] reset 1 | kept stt_config=1 epoch 0 -> 1
[row114] reset 1 image-equal | checksum true dump true
[row114] edited row before the reset | {"singleton":true,"enabled":false,"backend":"omlx-server","endpoint":"http://127.0.0.1:8000/v1","model":"whisper-large-v3-turbo","language":"id","diarization":false,"credential_kind":"REFERENCE","credential_ref":"omlx-settings:auth.api_key","secret_bytes":null,"nonce_bytes":null,"revision":"7","updated_by":"OPR-002","updated_at":"1791086400000"}
[row114] reset 2 | kept stt_config=1
[row114] reset 2 image-equal | checksum true dump true
 Test Files  1 passed (1)
      Tests  4 passed (4)
[test:db] teardown: dropped 2 database(s) in 63 ms; 0 remain with the run prefix dems_test_local_tmkxpowk_
RUN 1 VITEST_EXIT=0
```

```
[test:db] ... run prefix dems_test_local_tmkxpsuu_
 Test Files  1 passed (1)
      Tests  4 passed (4)
[test:db] teardown: dropped 2 database(s) in 87 ms; 0 remain with the run prefix dems_test_local_tmkxpsuu_
RUN 2 VITEST_EXIT=0
```

What the four tests assert behind those lines:

| Clause | Assertion |
|---|---|
| seed | exactly one row; every column equals `STT_CONFIG_SEED_DEFAULT` (so the test cannot drift from the code); named plainly: `[true,'cpu-local',null,'ggml-large-v3-turbo','id',true]`; `[credential_kind, credential_ref, secret_bytes, nonce_bytes] = [null,null,null,null]`; `updated_at` is the seed instant |
| kept | `KEPT_TABLE_NAMES.length === 12`, contains `stt_config`, its mode is `upsert`, its key is `singleton` |
| reset (seeded row) | `report.kept['stt_config'] === 1` (it was READ and carried, not rebuilt empty); `contractChecksum` equal before/after; `dumpTable` (`t::text`, independent of the routine's own comparison) equal; the row still equals the pre-reset row |
| reset (edited row) | an op-91-shaped edit survives identically in both images and the surviving values are the EDIT's (`enabled=false`, `omlx-server`, loopback endpoint, `diarization=false`, `REFERENCE`, revision 7) - the seed's fresh default never overwrote it; still one row; `dumpKept()['stt_config']` matches too |

The envelope columns are read as `octet_length(...)` only, so no byte of a secret can reach the output
even in principle. In the seeded row both lengths are `null`: nothing exists.

## 4. No credential value in the seed, the fixture, or git (grep proof)

```
$ grep -rnE "(credential|secret|api_?key|apikey|password|token|nonce|ciphertext)[A-Za-z_]*['\"]?\s*[:=]\s*['\"][^'\"]{4,}['\"]" \
      apps/core-server/src/db/seed/ apps/core-server/src/db/fixtures/
apps/core-server/src/db/fixtures/__tests__/support.ts:52:  device_credentials: 'device_id',
apps/core-server/src/db/fixtures/__tests__/support.ts:61:  operator_credentials: 'operator_id',
```

Both hits are table-name-to-primary-key entries in a test-support map, not values: **0 credential
values** in the seed or the fixture. The seed constant itself (quoted in §2 and stored in the row
quoted in §3) sets the four credential columns to `null`. Auditing every line this row adds that even
mentions a credential word returns column names, `null`s and comments only. The one pointer-shaped
string in this row's files is in the TEST, not the seed or the fixture:

```
m2-sttcfg-seed-kept.db.test.ts:164:  "credential_ref = 'omlx-settings:auth.api_key', ..."
```

That is the REFERENCE target example dbc-3 §B.13 itself names ("a pointer such as
`omlx-settings:auth.api_key`; ... Never key material", SEC35-14): a path-shaped label, not a key. The
git side is clean: `staged_files=0`, `git status --porcelain | grep -c '\.data/'` = 0, untracked media
files = 0. Nothing of `.data/pg.*` was printed - `pg:status` lists those file names and their key
NAMES only, and the owner connection is read in-process by the project's own helper.

## 5. Live databases untouched, throw-aways dropped, PG left running

Read-only probe (row 112's STEP B script: SELECTs only, owner connection read in-process, nothing
printed but names and counts), run BEFORE the two runs and AGAIN after them with identical output:

```
STEP B | pg_database LIKE dems% | ["dems_demo","dems_lane_1","dems_lane_2","dems_lane_3"]
STEP B | dems_demo   | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 stt_config=false reveal_fn=false journal_rows=4
STEP B | dems_lane_1 | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 stt_config=false reveal_fn=false journal_rows=4
STEP B | dems_lane_2 | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 stt_config=false reveal_fn=false journal_rows=4
STEP B | dems_lane_3 | schema_meta={"schema_version":1,"contract_revision":"dbc-2"} base_tables=30 stt_config=false reveal_fn=false journal_rows=4
STEP B | strays_outside_four | []
STEP B | dems_demo still (1,'dbc-2') + 30 tables + no stt_config | PROVEN
STEP B DONE (live DBs proven untouched; read-only; no secret printed)
```

No live database was migrated or seeded by this row: the CLI refuses a test name unless the seam is
code-set (`database-names.ts`), and the test routine is reached only through `testRunPrefix`. Every
throw-away the runs created was dropped by their own teardown (`0 remain with the run prefix`, twice),
and the final catalog shows exactly the four project databases. End state:

```
pg:status: OK, running
postgres 32505 ... TCP 127.0.0.1:4432 (LISTEN)
```

PostgreSQL was left running for the next db row; host `:5432` was never used.

## 6. Regression over the touched area, with attribution

Targeted files only (anti-hang rule; the full suite belongs to checkpoint 55 / gate 56).

| Scope | Result |
|---|---|
| unit: `kept-tables.test.ts`, `seed-order.test.ts`, seed `cli.test.ts` | **3 files / 62 tests PASS**, exit 0. Baseline before this row's edits: `seed-order.test.ts` was **RED** (`expected 305 to be 299`) and is now green at 306 |
| db batch 1: `m2-guard-keepset.db.test.ts`, reset `cli.db.test.ts`, seed `cli.db.test.ts`, `seed.db.test.ts` | 1 file passed / 3 failed; `Tests 8 failed | 38 passed (46)`. **`m2-guard-keepset.db.test.ts` (row 54's M2-MT-5/M2-MT-6 kept-set test) PASSES with twelve tables** |
| db batch 2: `reset.db.test.ts`, `guard.db.test.ts`, `seed-clock.db.test.ts` | 2 files passed / 1 failed; `Tests 1 failed | 27 passed (28)`. **`reset.db.test.ts` - the whole R-0..R-9 routine, whose checksums now cover all twelve kept tables - PASSES** |
| typecheck (`tsc --noEmit -p apps/core-server/tsconfig.json`) | **0 errors in any file this row touched** (workspace-wide errors elsewhere are the RECON-wave residuals rows 47/48/49/51/52 recorded) |
| lint (`npx oxlint`, this row's files) | exit 0, no warnings |

Attribution of the nine failures, none of them this row's: every `-`/`+` diff line in the captured
output is exactly `"permissions": 12 -> 14` or `"role_permissions": 18 -> 22`, i.e. the v1 §9.4 pins
against the v2 RBAC vocabulary dbc-3 §E.3 mandates (14 permissions / 22 grants, proven by row 49 and
asserted by row 52). `grep stt_config` over both failure logs returns **0 hits**, and the printed
totals stayed `307 row(s) in 21 of 30 table(s)` - the exact value row 54 §5 recorded as pre-existing -
which proves this row's extra row is invisible to those pins: `countAllTables` iterates `ALL_TABLES`,
the fixed 30 v1 names, and `stt_config` is not among them. Two of the failing files
(`seed.db.test.ts`, `seed-clock.db.test.ts`) and the pin source (`test/support/seed.ts`, lines 62/64:
`permissions: 12`, `role_permissions: 18`) are **unmodified in the working tree** - `git status` shows
no change to them - so they are stale v1 expectations owned by the RECON wave, not a ripple of row 114.

## 7. Residuals and handoff

1. **Row 53 (lane completion)**: the pending set is unchanged (0000-0007); a lane migrated and seeded
   now holds one `stt_config` row, and a permitted `db:reset` carries it. M2-LANE-1 can assert
   `stt_config = 1` beside `capture_config = 1`.
2. **Row 113 (ops 90-92)**: op 90 must read the 11-column list 0007 grants (never `SELECT *` as
   `dems_app`, proven 42501 by row 112); op 91 writes through the all-column UPDATE and bumps
   `revision`; the optimistic-revision floor is the seeded `1`.
3. **Row 115 (runtime + boot check)**: decision D-a stores `model` as a NAME (`ggml-large-v3-turbo`),
   not a path. The CS-22 boot check must resolve it against the configured model directory and refuse
   a name it cannot find; if the controller prefers a path reference in the seeded row instead, that
   is a one-constant change here plus a re-pin of the two tests that name it.
4. **RECON wave / checkpoint 55**: the nine stale §9.4 pins (12/18 permissions-and-grants, the
   "301 row(s)" literals in the two `cli.db.test.ts` files) still need their owner; row 114 left them
   exactly as it found them.
5. **Gate**: `M2-STTCFG-DB` keeps its "+1 at row 56" run; this artifact covers the producing row's 2.
   The catalogue still books the R-8 checks as conditional (routed by row 106 as G-5: activate and
   re-pin active 207 -> 215) - a test-expert edit, not this row's file.

---
*Generated: 2026-10-08 15:25*
