---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 47
plan_row: W25
title: Bulk fixture at the minimums of the database contract §11, deterministic, test databases only
date: 2026-10-04
agent: database-specialist (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_contract: masterplan/03_database_contract.md rev 2.2 (contract revision dbc-2), §11, §10, §6, §5, §4
evidence_tier: 3
status: complete for everything this row owns; the whole-project test commands are red in files of rows running at the same time (section 8.4)
follow_up: audit detail keys (decisions D91, D93), complete 2026-10-04 16:40; section 21. Whole unit and db green at 16:33 and 16:34
follow_up_2: severities, events, alerts (decision D103), complete 2026-10-04 17:40; section 22. Whole unit and db green at 17:33
---

# W25: the bulk fixture for volume tests

All times are WIB (UTC+7) on 2026-10-04. Every test, typecheck, lint and database command ran from
`/Users/gsp-budi/Documents/DEMS`. Two read-only commands of this row (a scratch probe of the shared dataset
before the first file was written, and a `grep` at 11:48) were prefixed with `cd` into a subfolder, against P10; the tool resets the
directory after every call and both used absolute paths only, so nothing ran from another
directory afterwards (section 12, DV-8). Commands that open a database
connection (`test:db`, `db:status`, one read-only catalog check) ran with the per-command sandbox
bypass, after the sandbox had refused each kind once (`listen EPERM` on the `tsx` pipe at 10:51;
`POSTGRES_UNREACHABLE` from the helper's probe at 11:27). Quoted runner output is unchanged except
that long lines are cut where marked and Vitest's pass mark is written `[pass]`. **No password,
token, pairing code or other credential value appears in this document.** The hash values quoted
(an audit chain head, a fixture digest, a dump digest) are integrity values, not secrets.

**Follow-up of 16:04 to 16:40: section 21.** Sections 1 to 20 are the record of step 47 as it stood
at 11:50. The fixture digest and the audit head they quote (sections 1, 3, 6 and 8) are the values
of that state; the details of 1,635 audit rows changed in the follow-up (section 21).

**Second follow-up of 17:03 to 17:40: section 22.** Severity, message, the events and the pairing
of a fault alert with its row follow their writers. **Section 22.2 gives the digest and the audit
head that hold now**; the values of section 21.2 are those of the state before it.

## 1. Result

| Item | Result |
|---|---|
| Row command `DEMS_TEST_STEP=47 npm run test:db -w @dems/core-server -- src/db/fixtures` | **Exit 0**: 1 file, 19 tests, 0 failed (11:44:02; section 8.1) |
| The loader's printed counts against §11 | **Every minimum of the 30 tables is met** (section 3) |
| The required mix of §11 | Met in every line, counted in SQL on a clone of `tpl_bulk` and again on the pure rows (section 4) |
| Full or reduced (DF-1) | **Full.** Nothing of §11 was left out, the variant flag included |
| The audit chain (BF-6) | The shared `verifyAuditChain` is **ok over all 5,000 stored rows**, from the genesis hash to the head; boot check B-8 as `dems_app` over the whole table: `linkBreaks 0, digests ok, lineage ok` (section 6) |
| Every constraint (the load itself) | The fixture loaded on its **first** contact with the database, and in every run since, with no constraint violation; 98 CHECKs, 25 foreign keys, 30 primary keys, none `NOT VALID`; no trigger disabled; the three audit triggers `ENABLE ALWAYS`; no index invalid (section 7) |
| Determinism (BF-3) | Two loads give **equal rows in all 30 tables** (a digest per table over an ordered dump, generated identifiers and hash columns included). The fixture's own digest is the same in every run and equals the digest the pure builder computes with no database: `953c92ea4c9e1393daa554fb8e1318d513b1e6e8d856d2d2d78d8d76c5ed8577` |
| The name guard (BF-1, TI-13) | `dems_demo`, `dems_lane_1`, `postgres` and 24 other names are refused **before a connection is opened**: a stand-in pool recorded no call, and a real driver pool stayed at 0 connections (section 5.4) |
| Read back as `dems_app` | Reads all 30 tables with the owner's counts; holds exactly the contract's privileges; 8 refusals by privilege on rows the fixture wrote (section 7) |
| Build time of `tpl_bulk` | **1.38 to 1.86 s** when the host is quiet, 2.46 s with other rows testing (section 9) |
| One clone of `tpl_bulk` | **65 to 106 ms** (a clone of `tpl_seed`: 42 to 69 ms); a bulk database is 19,366 kB |
| `tpl_bulk` is built only on request | Confirmed: a run that asks for no bulk clone prints no bulk line and builds two templates (section 9) |
| `dems_demo` | **Untouched**: `db:status` at 10:52:03 and at 11:44:20 prints the same 30 counts, the same seed instant, the same audit head (section 10) |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | Exit 0, exit 0 (no warning in this row's files) at 11:41:45 |
| `unit` project, this row's files | 4 files, 103 tests, 0 failed. Whole project: 51 files, 1,541 tests, all passing at 11:33:57; 7 tests of three files of other rows red from 11:39 on (section 8.4) |
| `SCHEMA-GAP`, `CONTRACT-GAP` | None |
| Deviations | Eight; none changes a file outside this row's folder (section 12) |
| PostgreSQL | Never stopped or reconfigured: PID 19121, started 07:14:26, before and after; no role created; no setting changed; no database of this row left (section 11) |

## 2. What was written

Everything is new and under `apps/core-server/src/db/fixtures/`. No other file of the repository was
edited: no `package.json`, no schema, no migration, no mapping, no seed, no helper. No dependency
was added. There is no command and no script: the loader is a library function.

| File | Lines | Content |
|---|--:|---|
| `index.ts` | 30 | The public surface |
| `minimums.ts` | 114 | The table of §11 as data: `BULK_MINIMUMS` (30 tables), `BULK_MIX` (the required mix), `compareWithMinimums` |
| `rng.ts` | 83 | The seeded generator and the fake secret hashes |
| `target.ts` | 84 | The name guard and the error type `BulkFixtureError` |
| `world.ts` | 202 | The clock, the base, the counters, the streams, the list of what happened |
| `identity.ts` | 844 | Operators and credential rows, pairing codes, devices, device credentials, biometric tokens, auth sessions |
| `recordings.ts` | 618 | Sessions, evidence items with tracks and custody, review, export, verification, archive; the variant with a recording session |
| `operations.ts` | 519 | Alerts, health snapshots, refused requests, audit and log exports, activity of the Core itself, the lineage, the padding |
| `rows.ts` | 82 | The shape of the fixture: rows by table, the table names |
| `build.ts` | 209 | `buildBulkFixture(options, base)`: pure, deterministic; appends the chain with the shared function |
| `validate.ts` | 390 | The schema's CHECK, UNIQUE and FOREIGN KEY rules in TypeScript, applied before a statement is sent |
| `load.ts` | 270 | `loadBulkFixture(pool, options)`: one transaction on an owner pool of a test database; `vacuumFixtureTables` |
| `report.ts` | 61 | The counts against the minimums, as data and as lines |
| `__tests__/template-hook.bulk.ts` | 39 | The hook of `tpl_bulk` (the helper's plug-in point) |
| `__tests__/support.ts` | 114 | Test support: the base without a database, the per-table dump digest |
| `__tests__/bulk-fixture.db.test.ts` | 528 | Project `db`: 19 tests |
| `__tests__/build.test.ts` | 519 | Project `unit`: 42 tests |
| `__tests__/target.test.ts` | 150 | Project `unit`: 41 tests |
| `__tests__/rng.test.ts` | 113 | Project `unit`: 10 tests |
| `__tests__/static.test.ts` | 151 | Project `unit`: 10 tests |

## 3. The minimums of §11 and the loaded counts

The line the loader prints through the template hook, in the run of 11:44:02. "loaded" is the row
count of the table after the load (seed and fixture together), "added" is what the fixture inserted.

```
[test:db] bulk fixture: dems_test_step_47_tmd95fm7_tpl_bulk as dems_owner; clock 2026-10-01T03:00:00.000Z; seed 20261004
[test:db]   table                   minimum   loaded   added  met
[test:db]   roles                         3        3       0  yes
[test:db]   permissions                  12       12       0  yes
[test:db]   role_permissions             18       18       0  yes
[test:db]   operators                    12       12       9  yes
[test:db]   operator_credentials         12       12       9  yes
[test:db]   auth_sessions               300      300     300  yes
[test:db]   pairing_codes                60       60      60  yes
[test:db]   paired_devices               40       40      40  yes
[test:db]   device_credentials           40       40      40  yes
[test:db]   biometric_tokens             80       83      83  yes
[test:db]   registry_counters             2        2       0  yes
[test:db]   audit_log                  5000     5000    4918  yes
[test:db]   audit_chain_head              1        1       0  yes
[test:db]   audit_chain_history          25       25      25  yes
[test:db]   events                     2500     3649    3590  yes
[test:db]   session_history             520      520     507  yes
[test:db]   evidence_items              505      515     502  yes
[test:db]   evidence_tracks            2020     2060    2008  yes
[test:db]   evidence_custody           1200     1220    1192  yes
[test:db]   exports                      60       60      59  yes
[test:db]   alerts                      250      250     250  yes
[test:db]   health_snapshots           1500     1508    1508  yes
[test:db]   engine_counters               6        6       1  yes
[test:db]   active_session                0        0       0  yes
[test:db]   storage_policy                1        1       0  yes
[test:db]   console_settings              1        1       0  yes
[test:db]   core_device                   1        1       0  yes
[test:db]   core_state                    1        1       0  yes
[test:db]   hardware_snapshot             1        1       0  yes
[test:db]   schema_meta                   1        1       0  yes
[test:db] bulk fixture: every minimum of the 30 tables is met; audit head seq 5000, hash d2d9f9e596ed73d2...; digest 953c92ea4c9e1393...; build 214 ms, write 1368 ms, total 1586 ms
```

15,101 rows are inserted (15,100 in the 18 row lists and the `export` counter). The same table is
asserted by the database test on the file's own clone of `tpl_bulk` ("entity -> minimum -> loaded")
and by the pure test on the built rows. The audit log holds exactly 5,000 rows: 25 full pages of
200, so a walk must end without an empty page. The fixture pads the audit log and the events up to
their minimums only when its history falls short (124 audit rows of padding, no event).

Rows the fixture changes instead of inserting: `registry_counters` (device 41, pairing code 61),
five `engine_counters` (event 3650, session 537, caseNumber 376, evidence 516, item 459; `export`
91 is inserted), `core_state` (three columns, section 12 DV-2), and `last_sign_in_at` of the three
seeded operators.

## 4. The spread per entity

Counted on the built rows (a scratch run of the pure builder at 11:43); every line below is also
an assertion of `build.test.ts` and, in SQL, of `bulk-fixture.db.test.ts`.

| Table | What the fixture adds | §11 mix |
|---|---|---|
| `operators` | `OPR-004` to `OPR-012`, usernames `fixture.operator.NNN`. Enabled: SUPERVISOR 2, INVESTIGATOR 2, TECHNICIAN 2. Disabled: one of each role. Two had their role changed; one was disabled and enabled again | 3 enabled SUPERVISOR with the seeded one, 3 disabled, every role |
| `operator_credentials` | One per fixture operator: 16 and 32 pseudo-random bytes with the server's Argon2id parameters. They are the hash of no password, so no fixture operator can sign in (BF-4) | one per operator |
| `auth_sessions` | Open 36: 24 web, 7 device with a password, 5 device with biometric. Ended 264: SIGNED_OUT 96, IDLE_EXPIRED 60, ABSOLUTE_EXPIRED 24, ROTATED 24, DEVICE_REVOKED 20, DEVICE_UNPAIRED 16, USER_DISABLED 12, TOKEN_REUSE 12 | at least 30 open (5 on a device, 3 biometric); every one of the 8 end reasons at least 5 times; TOKEN_REUSE only biometric with a device |
| `pairing_codes` | REDEEMED 40, EXHAUSTED 7, CANCELLED 6, EXPIRED 6, ACTIVE 1; `PCD-000001` to `PCD-000060` in the order of issue | at most 1 ACTIVE, 40 REDEEMED, 5 of each closed state |
| `paired_devices` | PAIRED 20, REVOKED 10, UNPAIRED 10; `DEV-0001` to `DEV-0040` | 20, 10, 10 |
| `device_credentials` | One per device; 8 with a `next_hash` (rotation pending), 6 more with a completed rotation | at least 5 with a `next_hash` |
| `biometric_tokens` | 83 in 47 families: live 20, used 30, past their lifetime and unused 10, revoked 23 (TOKEN_REUSE 12, DEVICE_REVOKED 3, DEVICE_UNPAIRED 2, DISABLED 2, REENROLLED 2, USER_DISABLED 2) | 20 live, 30 used, 20 revoked with every reason, 10 past `expires_at` |
| `audit_log` | 4,918 rows of **all 53 types** in all 8 categories (SESSION 2,296, EVIDENCE 818, AUTH 603, DEVICE 549, SECURITY 257, PAIRING 241, STORAGE 105, SYSTEM 49); 12 actors; one session with 246 rows; ACCESS_DENIED 120; with a session 3,165, with an evidence item 893, with a device 950 | at least 20 types, 8 categories, 200 rows of one session, 100 ACCESS_DENIED, 3 actors |
| `audit_chain_history` | 25 rows, `reset_no` 1 to 25, epochs 2 to 63 rising: RESET 13 (scenario `idle`), SCENARIO_LOAD 12 (3 each of `recording`, `finalizing`, `fault-demo`, `idle`); 6 without an actor; row 13 not intact | both reasons 5 times, 5 without an actor, 3 scenarios, one not intact |
| `events` | 3,590 events of 44 types in all 10 categories and all 4 severities | 10 categories, 4 severities |
| `session_history` | 507 sessions `SES-20260731-0024` to `SES-20260928-0530`: SEALED 488, INCOMPLETE 19, of which 5 never recorded (no evidence) | 500 SEALED and 20 INCOMPLETE with the seed; 5 without evidence |
| `evidence_items` | 502 items `EV-20260731-0014` to `EV-20260928-0515`: SEALED 400, EXPORTED 39, ARCHIVED 30, UNDER_REVIEW 19, RECORDED 14; tampered 11 (every one of the four tracks); verified PASS 84, FAIL 8; three case types; 57 with markers, 31 with notes | with the seed: 410, 40, 30, 20, 15; 12 tampered |
| `evidence_tracks` | Exactly 4 per item | 4 per item, both audio tracks |
| `evidence_custody` | 2 entries on 336 items, 3 on 145, 4 on 20, 5 on 1 | at least 2 per item |
| `exports` | EVIDENCE 39, AUDIT 10, LOGS 10; `EXP-000032` to `EXP-000090` in the order of the exports | with the seed: 40, 10, 10 |
| `alerts` | 238 resolved alerts of the 12 fault kinds (17 to 23 each), 12 active notices of kind `SYSTEM`; acknowledged 123 | 10 active, 100 acknowledged, every fault kind |
| `health_snapshots` | INTERVAL 1,440 (one a minute, the newest at the clock), FAULT_RAISED 34, FAULT_CLEARED 34 | 1,440 and 60 |
| `active_session` | None. With `activeSession: true`: one session in RECORDING with a 200-item timeline | the variant flag |

Text outside ASCII and outside the Basic Multilingual Plane (Latin with diacritics, CJK, a
combining accent, a Gothic letter and an emoji) is in a few rows of `operators`, `paired_devices`,
`session_history`, `evidence_items` (also inside the `notes` and `markers` JSON),
`evidence_custody`, `exports`, `alerts`, `audit_log` (message and details) and `events`. The
database test sends the sample as a bind parameter and finds it in each of them; `char_length` of
the stored name equals the number of code points.

## 5. The generator, the clock and the guard

### 5.1 The generator and its seed (BF-3)

`rng.ts`. The pseudo-random core is the **shared** generator the contract names (`mulberry32`
through `createRng(deriveSeed(seed, name))` of `@dems/shared/sim`); the file adds bytes, an
identifier in UUID form and a shuffle. One stream per kind of row (`operator-credentials`,
`pairing`, `biometric-tokens`, `auth-sessions`, `recordings`, `verification`, `faults`,
`health-snapshots`, `refusals`, `log-exports`, `core-activity`, `lineage`, `administration`,
`refused-sign-ins`), so a change of one entity's rows does not shift what another draws. The seed
is `BULK_FIXTURE_SEED = 20261004`. Nothing in the folder reads a clock, the system's random source
or the environment; `static.test.ts` keeps it so. The three generated keys (`auth_sessions.id`,
`biometric_tokens.id` and `.family_id`, `health_snapshots.id`) come from the generator too, so no
column default decides a value.

### 5.2 Hash columns (§5)

Every hash column holds the SHA-256 of a text that says what it is, for example
`dems-bulk-fixture/session-token/17/seed-20261004`. That text has the form of no credential of the
server (no prefix `ses_`, `dvc_`, `bio_`; not `<code id>:<six digits>`), so no request can present a
value that hashes to a fixture row: **no fixture session, device, token or code can authenticate.**
A test that needs a usable credential on a bulk clone signs in as a seeded operator or inserts its
own rows.

### 5.3 The clock

The clock is injected (`now`); the loader refuses one that is earlier than the seed instant or the
newest seeded row (`OPTION_INVALID`). **Nothing the fixture writes is dated after `now`**, except
the end of a lifetime (`expires_at`, `absolute_expires_at`). The template hook uses the seed
template's instant, 2026-10-01 10:00 WIB (`BULK_TEMPLATE_NOW`), so a test whose manual clock stands
at the usual fixed instant, or later, or a server on the wall clock, finds nothing in its future.
An open session is alive at that instant: inside the 8-hour and the 15-minute limit, its operator
enabled, its device paired.

The history covers the 62 WIB days up to `now`. Recordings fill office hours of the 60 days before
the seeded dataset's own three (one Core, one room: they never overlap, 8 or 9 a day, 3 to 15
minutes each, 628 GB in total against 804 GB used on the seeded volume); everything else runs up to
`now`.

### 5.4 The name guard

`target.ts`, called as the first line of `loadBulkFixture`, before any `await`. It reads the
database the pool is configured for and accepts only `^dems_test_[a-z0-9_]+$` of at most 63 bytes;
the project databases and their `_next` and `_prev` copies, `postgres`, `template0` and `template1`
are named once more. The session is then asked where it really is, and that name must be the same.
The refusal does not echo the refused value.

## 6. The audit chain

The fixture continues the seeded chain (82 rows). Every row is made by the shared `appendAudit`,
which is the one place that computes `seq`, `id`, `prevHash` and `hash`; nothing in the folder
hashes a row. The loader takes the chain lock as the first statement of its transaction (AP-2,
AP-7) and writes the rows with the seed's own `insertRows`: **one INSERT per row in ascending
sequence, through the guard trigger** (AP-4). No trigger is switched off; no audit row is updated.
At the end the stored head must be the head the builder expects, or the transaction is rolled back.

```
[test:db] bulk fixture: verifyAuditChain over all 5000 stored audit rows: ok (head seq 5000, hash d2d9f9e596ed73d2...)
```

The check reads every row as `dems_app` and runs with `dropped: 0`, so the first row must link to
the genesis hash and every digest is recomputed. It can fail: one altered message in a copy gives
`HASH_MISMATCH at sequence 2501`. Boot check B-8 over the whole table returns
`{ ok: true, rowsChecked: 5000, firstSeq: 1, lastSeq: 5000, linkBreaks: 0, digests: 'ok', lineage: 'ok', problems: [] }`.
The seven blocking boot checks pass as `dems_app`, and the state reads back through `fromRows`: a
ring of 1,000 audit rows that verifies, 500 events, 100 alerts, 520 sessions, 515 items, no active
session, no active fault.

**The order of the rows.** The first fixture row (sequence 83) is the `SCENARIO_LOADED` row of the
reset that built the database, stamped with the seed instant; the newest lineage row agrees with it
(LN-3). The history follows in the order it happened, each row with the instant of what it
describes. In sequence order `at` therefore never decreases, **except once**: from the reset marker
back to the start of the fixture's history (sequence 83 to 84; for events 60 to 61). Both tests
assert "exactly one descent". The engine's ring (the newest 1,000 rows) is in time order.

## 7. Constraints, and the runtime role

Before a statement is sent, `validate.ts` checks every row against the CHECK, UNIQUE and FOREIGN
KEY rules of its table, written out in TypeScript, and against what no constraint states (nothing
after the clock, counters above the highest minted number, a chain that verifies). It caught the
one defect of the development (a token used before it was issued) in a pure run, before any
database was touched. 18 planted violations are each refused with the table and the rule and no
value. Consequence for finding F-1 of the migration row (a CHECK violation logs the whole row):
**the fixture never produced a constraint violation in the server log.** In the six time windows of
the fixture-only runs the log holds 0 lines with `violates` or `Failing row`; it holds the 10
deliberate refusals of the test file per run (2 by the append-only triggers as the owner, 8 by
privilege as `dems_app`), none with a value of a row.

On a clone of `tpl_bulk`, from the catalog: 98 CHECK, 25 FOREIGN KEY and 30 PRIMARY KEY
constraints, `convalidated` for every one; no trigger with `tgenabled = 'D'`; the three audit
triggers `'A'`; no index with `indisvalid` or `indisready` false.

As `dems_app` on the clone: all 30 tables readable, counts equal to the owner's. The privilege
matrix is the contract's: SELECT only on the three RBAC tables, the chain head, the lineage and
`schema_meta`; SELECT and INSERT only on `audit_log`, `events`, `session_history`,
`evidence_tracks`, `evidence_custody`, `exports`, `health_snapshots`; no INSERT on `operators`;
DELETE on `active_session` and on nothing else; TRUNCATE nowhere. Refused with `42501`: UPDATE and
DELETE of an audit row, DELETE of evidence and of auth sessions, UPDATE of the lineage, of the
chain head and of a sealed column, and a read of the migrator's table.

## 8. Verification

### 8.1 The row command (11:44:02, outside the sandbox)

```
$ DEMS_TEST_STEP=47 npm run test:db -w @dems/core-server -- src/db/fixtures
> vitest run --project db src/db/fixtures
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_47_tmd95fm7_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_47_tmd95fm7_tpl_schema: built in 105 ms (create 37 ms, hook 66 ms)
[test:db] template dems_test_step_47_tmd95fm7_tpl_seed: built in 165 ms (create 55 ms, hook 109 ms)
[test:db] bulk fixture: dems_test_step_47_tmd95fm7_tpl_bulk as dems_owner; clock 2026-10-01T03:00:00.000Z; seed 20261004
   (the 31 lines of section 3)
[test:db] bulk fixture: every minimum of the 30 tables is met; audit head seq 5000, hash d2d9f9e596ed73d2...; digest 953c92ea4c9e1393...; build 214 ms, write 1368 ms, total 1586 ms

 Test Files  1 passed (1)
      Tests  19 passed (19)
   Start at  11:44:02
   Duration  9.34s (tests 94%, transform 3%, import 3%)

[test:db] teardown: dropped 3 database(s) in 66 ms; 0 remain with the run prefix dems_test_step_47_tmd95fm7_
exit=0
```

The command also exited 0 at 11:28:04 (the first run against the database), 11:37:55, 11:38:28,
11:42:17 and 11:43:52.

### 8.2 The 19 database tests (11:43:52, `--reporter=verbose`)

```
[pass] the bulk template: the minimums of contract §11 > every one of the 30 tables holds at least its minimum (entity, minimum, loaded)
[pass] ... > operators and credentials: the mix, synthetic names, one credential row each
[pass] ... > auth sessions: open ones, every end reason, the reuse rule
[pass] ... > pairing codes, devices, credentials and biometric tokens: the mix
[pass] ... > the audit log, the events and the lineage: the mix
[pass] ... > sessions, evidence, tracks, custody and exports: the mix
[pass] ... > alerts and health snapshots: the mix, and no contradiction with the seeded hardware snapshot
[pass] ... > nothing is dated after the clock of the template, and text outside ASCII and outside the BMP is stored exactly
[pass] the bulk template: every constraint holds, and nothing was switched off > no constraint is NOT VALID, no trigger is disabled, no index is invalid; the three audit triggers are ENABLE ALWAYS
[pass] ... > the fixture did not update or delete an audit row: the append-only triggers refuse the owner too
[pass] the bulk template: the audit chain verifies over all rows (BF-6) > links and digests of every stored row, from the genesis hash to the head, with the shared check
[pass] ... > boot check B-8 as the runtime role, over the whole table: links, digests and the lineage rule
[pass] ... > a server can start on the database: the blocking boot checks pass as the runtime role, and the state reads back
[pass] the loader > is deterministic: a second load on a fresh seed clone gives equal rows in all 30 tables, and the pure builder announces the same digest
[pass] the loader > refuses a database that already holds the fixture, and one that holds no seed; nothing is written
[pass] the loader > refuses a clock before the seed instant, and a session that is not the owner role
[pass] the loader > the variant: one session in RECORDING with a full 200-item timeline
[pass] a clone of the bulk template, read back as the runtime role > dems_app reads every one of the 30 tables, and the counts are the owner's
[pass] a clone of the bulk template, read back as the runtime role > and nothing else: the privilege matrix of the clone is the contract's, and the refusals are real
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

Determinism, from the same run:

```
[test:db] bulk fixture: digest over a stable ordered dump of all 30 tables, template clone and second load: c65c85a90e5180efe301fc5de00f09df6e3781864e86440e042e062665709339 = c65c85a90e5180efe301fc5de00f09df6e3781864e86440e042e062665709339
```

The dump digest covers all 30 tables, so it also covers the three seeded credential rows, whose
salts are fresh in every run: it is equal for two databases of one run and differs between runs.
The fixture's own digest (`953c92ea...`) does not depend on the run. Another seed gives another
digest and still every minimum.

### 8.3 The unit tests, and whether the tests can fail

`npm run test -w @dems/core-server -- --maxWorkers=2 src/db/fixtures` (11:45:14, inside the
sandbox): 4 files, 103 tests, 0 failed. With the five static guard files of the scaffold
(`test/static`): 9 files, 192 tests, 0 failed (11:40:05): the guard that forbids the
trigger-skipping setting, a dropped or disabled trigger, a server setting change and a dropped
database finds none of them in this row's files.

Eight mutations of the production sources, each run against the unit tests and reverted (11:41:21
to 11:41:36). **All eight are caught**:

| Mutation | Result |
|---|---|
| The loader skips the name guard | exit 1; 10 failed (target, static) |
| Every fake secret hashes the same text | exit 1; the builder's own check refuses the rows; rng tests fail |
| Fewer open web sessions (10 instead of 24) | exit 1; 4 failed (the mix) |
| The validator ignores an instant after the clock | exit 1; 1 failed |
| One audit row is changed after the shared function hashed it | exit 1; the builder refuses: the chain does not verify |
| The lineage marker names another head | exit 1; the builder refuses: LN-3 |
| A stream reads the system's random source | exit 1; 2 failed (determinism, static) |
| An alert of a fault kind is left active | exit 1; the builder refuses |

### 8.4 The whole projects, and noise from rows in flight (P11)

| Run | Result | Not this row's |
|---|---|---|
| `unit`, 11:33:57 | **51 files, 1,541 tests, 0 failed** | — |
| `unit`, 11:39:43 and 11:41:45 | 48 files pass; 7 tests fail in 3 files | `src/core/__tests__/core-plugin.test.ts` (2; "boot step engine.rehydrate failed": the engine host row registers a boot step), `src/plugins/origin-guard/__tests__/origin-guard.test.ts` (4; the identity row replaces the stage-4 stub), `src/plugins/readiness/__tests__/readiness.test.ts` (1; a stub got filled) |
| `db`, 11:34:49 | 32 files, 470 tests: 469 pass, 1 fails; 2 files fail | `src/db/reset/__tests__/reset-failures.db.test.ts` > R-5e (the reset row, in flight); `test/helpers/db/__tests__/isolation-b.db.test.ts`: all 6 tests pass, the file's drop is refused (finding F-3) |
| `db`, 11:38:57 | 32 files, 470 tests: 466 pass, 4 fail in 3 files | `test/db/boot-checks.db.test.ts` (1), `src/core/__tests__/boot-checks.db.test.ts` (2), `src/core/__tests__/seeded.db.test.ts` (1): the same new boot step |
| The two helper isolation files alone, 11:36:19 | 2 files, 12 tests, 0 failed | — |

In every one of these runs `src/db/fixtures` passed whole (19 of 19; 103 of 103). The typecheck
was red once, at 11:37, in three files of rows in flight (`src/engine/host.ts`,
`src/modules/identity/sign-in.ts`, `src/plugins/authenticate/index.ts`) and exit 0 at 11:33, 11:39
and 11:41. The lint was exit 0 throughout; its warnings at 11:41 are in two files of other rows.

## 9. Build and clone times

| What | Measured (seven runs, 11:28 to 11:44) |
|---|---|
| The pure build of the rows (15,100 rows, 5 MB as JSON, with the constraint check and the digest) | 107 to 169 ms in process; up to 291 ms under load |
| The loader, whole (checks, base, build, one transaction, counts) | **1,247 to 1,435 ms** quiet; up to 3,024 ms with other rows testing |
| of which the statements | 1,126 to 1,263 ms quiet. About 4/5 of it is the 4,918 single-row audit INSERTs (AP-4) |
| Vacuum and analyze of the 30 tables, one statement | 34 to 44 ms |
| **`tpl_bulk`, whole build** (clone of `tpl_seed`, hook, drain, lock) | **1,383, 1,405, 1,531, 1,856 ms**; **2,464 ms** under load |
| of which the hook | 1,340 to 1,799 ms; 2,391 ms under load |
| **A clone of `tpl_bulk`** | **65, 67, 79, 106 ms** (180 ms in the first run, before the vacuum step existed) |
| A clone of `tpl_seed`, for comparison | 42 to 69 ms |
| Size of a bulk database | 19,366 kB (a seeded one: 10,174 kB) |
| The test file | 7.7 to 11.2 s (it loads the fixture three more times) |

**How long other runs can be delayed.** The helper holds the clone lock for the whole build of
`tpl_bulk`. While it is held, no test file of any run can clone anything. That is **about 1.4 s
when the host is quiet and up to 2.5 s measured under load, once per run that asks for a bulk
clone.** After that, each clone of `tpl_bulk` holds the lock for about 0.07 to 0.1 s, against
0.05 s for a seed clone. The lock timeout of the helper is 120 s, so no run fails for it.

**`tpl_bulk` is built only when a test asks.** The global setup builds `tpl_schema` and `tpl_seed`
only (`EAGER_TEMPLATES` in the helper); `createDatabase` builds `tpl_bulk` at the first request, in
the worker that asks, and a second request builds nothing. Observed: the run of
`src/db/seed/__tests__/cli.db.test.ts` at 11:38:46 printed two template lines and no bulk line.
The hook module is imported before the lock is taken, so transforming the fixture's sources is not
under the lock.

The hook does three things: `loadBulkFixture`, the report (33 lines), `vacuumFixtureTables`. The
last one gives the clones the planner statistics and the visibility map of the loaded tables (a
template is locked right after its hook, so nothing else would ever analyze it); it is also why a
clone became faster.

## 10. `dems_demo` before and after

`npm run db:status -w @dems/core-server -- --database dems_demo`, exit 0 both times.

| | 10:52:03 (before the first file of this row) | 11:44:20 (after the last run) |
|---|---|---|
| `seeded_at` | 2026-10-04T03:28:35.448Z (1791084515448) | the same |
| `last_reset_at` | never | never |
| audit head | seq 82; hash 22eb48f72bb6ffea... | the same |
| lineage | 0 row(s) | 0 row(s) |
| ledger | 4 files, matches | 4 files, matches |

```
row counts       30 table(s)
  active_session           0        alerts                   0        audit_chain_head         1
  audit_chain_history      0        audit_log                82       auth_sessions            0
  biometric_tokens         0        console_settings         1        core_device              1
  core_state               1        device_credentials       0        engine_counters          5
  events                   59       evidence_custody         28       evidence_items           13
  evidence_tracks          52       exports                  1        hardware_snapshot        1
  health_snapshots         0        operator_credentials     3        operators                3
  paired_devices           0        pairing_codes            0        permissions              12
  registry_counters        2        role_permissions         18       roles                    3
  schema_meta              1        session_history          13       storage_policy           1
db:status: OK: dems_demo is at the schema version this code expects and the ledger matches the files.
```

The 30 counts are identical in both outputs (the block above is the second one, set in three
columns). Nothing of this row can name `dems_demo`: the helper hands out pools for databases of
its own run only, and the loader refuses the name.

## 11. End state and cleanup (11:44:19)

A read-only catalog query as `dems_owner` on `127.0.0.1:4432` (a scratch script that uses the
commands' own `readOwnerConnection`; no value of the connection file is printed):

```
19121 Sun Oct  4 07:14:26 2026     .../@embedded-postgres/darwin-arm64/native/bin/postgres
session {"role":"dems_owner","address":"127.0.0.1/32","port":4432,"started":"2026-10-04 07:14:26.046351+07","superuser":false}
databases dems_demo(dems_owner) dems_lane_1(dems_owner) dems_lane_2(dems_owner) dems_lane_3(dems_owner) postgres(dems_admin) template0(dems_admin) template1(dems_admin)
databases of step 47: 0 []
test databases of any run: 0
roles [{"name":"dems_admin","rolsuper":true,"rolcreatedb":true,"rolcreaterole":true},{"name":"dems_app","rolsuper":false,"rolcreatedb":false,"rolcreaterole":false},{"name":"dems_owner","rolsuper":false,"rolcreatedb":true,"rolcreaterole":false}]
settings autovacuum=on(default) fsync=on(default) listen_addresses=127.0.0.1(command line) log_statement=none(default) max_connections=100(configuration file) port=4432(command line) session_replication_role=origin(default)
per-database or per-role setting overrides: 0
```

`.locks/postgres.pid` holds 19121. The three lane databases are the reset row's. This row created
no role, changed no setting, started and stopped no process, and connected only as `dems_owner` and
`dems_app`, only to `127.0.0.1:4432`, only to databases of its own test runs (and once each to
`dems_demo` and `postgres`, read-only, for the two checks above).

## 12. Deviations

| ID | Deviation | Why it still satisfies the contract |
|---|---|---|
| DV-1 | The delegation asks for "a small seeded generator of your own inside the folder"; BF-3 names the shared generator. `rng.ts` is in the folder and is built on the shared one | One generator algorithm in the repository, no dependency, and the folder owns its streams and helpers |
| DV-2 | `core_state` is not "as seeded" in three columns: `epoch` (66, above the highest lineage epoch 63, which §11 itself asks), `last_reset_at` (the seed instant, which is `reset_at` of the newest lineage row, LN-2) and `updated_at` | A database with 25 lineage rows whose state row says "never reset" would contradict itself. Still one row |
| DV-3 | `last_sign_in_at` of the three seeded operators is set to their newest fixture session | The same rule as SPEC-GAP-6 for kept sessions; the rows are otherwise untouched |
| DV-4 | The alerts that are active are of kind `SYSTEM`; every alert of a fault kind is resolved | `hardware_snapshot` stays as seeded and holds no active fault. An active fault alert without a fault would be a start state no server can produce. §11 asks for 10 active alerts and for every fault kind, not for both in one row |
| DV-5 | In sequence order `at` descends once (section 6) | The database checks no time order (§6.3 "What is not checked"). The alternative, stamping 4,918 rows into the 25 minutes between the newest seeded row and the clock, would make every audit row disagree with the record it describes; `exports.at` is derived from the audit row |
| DV-6 | The hook runs one statement more than the load: `VACUUM (ANALYZE)` of the 30 tables (34 to 44 ms) | Statistics and visibility map for every clone; it changes no row |
| DV-7 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes the shared files (P8). This document is the row's output document (02_plan §8.7) |
| DV-8 | Two read-only commands began with `cd` into a subfolder (P10 says never) | A slip, with no effect: the directory is reset after every call, and no test, typecheck, lint or database command was among them |

More than the minimum in six tables (events 3,649, evidence items 515, tracks 2,060, custody 1,220,
tokens 83, snapshots 1,508): the numbers of §11 are minimums (BF-5).

## 13. Findings

| ID | Finding | Evidence |
|---|---|---|
| F-1 | The fixture loads in 1.25 to 1.44 s; `tpl_bulk` holds the clone lock for 1.4 to 2.5 s once per run that asks for it | Section 9 |
| F-2 | Four fifths of the load is the audit log: AP-4 allows one INSERT per row, and the store builds each statement anew | Section 9; `seed/store.ts` `insertInto` |
| F-3 | **The helper's forced drop of a file's database was refused once with `42501` "permission denied to terminate process"; the file is then reported as failed although its tests passed.** Seen in this row's whole-project run at 11:35:59, on the database of the helper's own `isolation-b` file (6 of 6 tests passed); not in the second whole run, and not when the two isolation files ran alone. The same server message is in the log before this row touched the database: 10:45:39 (a database `..._f01_cleanup` of a step-43 run) and 11:22:56 three times (a database `..._f02_rfbulk` of a step-51 run, which is the reset row's own clone of `seed`); whether those were expected by their tests was not checked. **Hypothesis, not confirmed** (`dems_owner` cannot see the backend type of another session): an autovacuum worker is connected at the instant of the drop; it has no role, so the owner may not end it, and the helper's wait counts only sessions that have a role. A database that has just taken thousands of inserts is where a worker goes first and stays longest | `.data/postgres.log` lines 36377, 46175 to 46183, 51667 (the statement lines name the databases); section 8.4 |
| F-4 | What this row does about F-3 inside its own folder: the loaded tables are vacuumed and analyzed, so a worker finds nothing to do; and the test file retries the drop of the clones it loaded itself (up to 8 times, 250 ms apart). The retry was never needed in the seven runs | `load.ts` `vacuumFixtureTables`; `bulk-fixture.db.test.ts` `dropWhenQuiet` |
| F-5 | The server log does not say which database a line belongs to unless the statement names it, and the lines of several rows' runs interleave. The statement of section 7 ("no constraint violation from the fixture") is therefore made on the six time windows in which only this row's test file ran; in the whole-project runs the log also holds the deliberate violations of the migration row's constraint tests | `.data/postgres.log`, 11:27 to 11:44: 0 lines with `violates` in the six windows; 329 and 166 in the two whole-project minutes |
| F-6 | `--exclude` on the Vitest command line does not take files out of a project run here: the ledger's "before" is computed by subtraction from one run | A run at 11:34:15 with five `--exclude` flags: still 51 files, 1,541 tests |
| F-7 | One run of this row's database tests adds to `.data/postgres.log`: 10 expected refusals (no row value) and the checkpoint lines of 8 dropped databases | Section 7 |
| F-8 | The sandbox refuses `ps`; the process check of section 11 ran outside it | 10:51:57 |
| F-9 | The hook file of `tpl_bulk` existed from 11:22:22, five minutes before its first run against the database (11:28:04), and for about four of them with the one defect the constraint guard later caught. No test file of any row asks for the bulk template (searched at 11:48), so no run could have built it in that time; had one asked, the guard would have refused the build before a statement, with nothing written | File times; `grep` over `apps/core-server` |

## 14. Decisions for the controller to record

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | DV-5: fixture rows carry the instant of what they describe, so `at` descends once in sequence order | Accept, and tell W39 (audit paging) and W47: page and assert by `seq`, never by `at` |
| DN-2 | DV-2, DV-3: three columns of `core_state` and `last_sign_in_at` of the seeded operators are written | Accept; §11 "as seeded" for `core_state` becomes "as seeded, with the epoch above the lineage and the instant of the newest reset" |
| DN-3 | DV-4: active alerts are notices | Accept, or schedule a contract change if a test needs an active fault on a bulk clone (it would have to change `hardware_snapshot.faults` too) |
| DN-4 | F-1 against DN-4 of the helper row ("above about 2 s, schedule a lock per template"): 1.4 s quiet, 2.5 s under load | Accept now. If it is to be lowered: a lock per template in the helper, or one prepared audit INSERT in `seed/store.ts` (it would also speed the seed and the reset). Both are files of other rows |
| DN-5 | F-3: the forced drop | Route to the helper's owner: on `42501` "permission denied to terminate process", wait and retry the drop a few times before the file is reported as failed. The cause is a hypothesis; a retry helps whichever session it was, as long as that session leaves by itself |
| DN-6 | The clock of a test on `tpl_bulk` | `BULK_TEMPLATE_NOW` (exported by the hook module; it equals the seed template's instant) or later; the wall clock works too. A session, token or code of the fixture cannot be presented (section 5.2) |
| DN-7 | DV-1: the wording of BF-3 against the delegation | Record that the fixture's generator is the shared one behind a wrapper in the fixture's folder |

## 15. How a test asks for the bulk template

```ts
import { useTestDatabase } from '../../../test/helpers/db';                         // the relative path of the file
import { BULK_TEMPLATE_NOW } from '../../db/fixtures/__tests__/template-hook.bulk';

const db = useTestDatabase({ template: 'bulk' });      // top level of a *.db.test.ts file

it('...', async () => {
  // db.runtime: dems_app on the file's own clone; db.ownerPool(): fixtures and assertions only.
  // A manual clock starts at BULK_TEMPLATE_NOW or later.
});
```

```sh
DEMS_TEST_STEP=<row> npm run test:db -w @dems/core-server -- --maxWorkers=2 <folder>
```

The first file of a run that asks pays the build (about 1.4 s) once; every file pays one clone
(about 0.07 s). For other volumes: clone `seed` and call the loader on the clone's owner pool.

```ts
const other = await db.another({ template: 'seed' });
const report = await loadBulkFixture(other.ownerPool(), { now, seed: 7, activeSession: true });
await vacuumFixtureTables(other.ownerPool());          // before the clone is dropped (finding F-3)
```

`loadBulkFixture(pool, { now, seed?, activeSession?, log? })` returns `{ database, role, counts,
added, minimums, met, auditHead, digest, buildMs, writeMs, totalMs }`. It refuses: a name that is
not a test database (`TARGET_REFUSED`), a session that is not `dems_owner`, a database with no
schema (`NOT_MIGRATED`) or no seed (`NOT_SEEDED`), one that already holds the fixture or anything
in a table the seed leaves empty (`BASE_UNEXPECTED`), a clock before the seed (`OPTION_INVALID`).
Everything is one transaction: a refused or failed load writes nothing. `buildBulkFixture(options,
base)` gives the same rows with no database (`__tests__/support.ts` `pureBase`).

## 16. What is reused from the mapping module and the seed (MR-1)

| Reused | For |
|---|---|
| Shared builders: `sessionIdFor`, `evidenceIdFor`, `caseNumberFor`, `exportIdFor`, `recordingBytes`, `createEvidenceItem`, `tamperEvidenceItem`, `verifyEvidenceItem`, `EVIDENCE_STATUS_STAGE`, `buildScenarioState` | Entities in the shared shape, identifiers in the shared formats, integrity values, the recording session of the variant |
| Shared chain: `appendAudit`, `appendEvent`, `verifyAuditChain`, `canonicalJSON` | Every audit row and event; the checks; the digest |
| Mapping: `operatorToRow`, `sessionHistoryToRow`, `evidenceItemToRow`, `evidenceTracksToRows`, `evidenceCustodyToRows`, `alertToRow`, `healthSnapshotToRow`, `activeSessionToRow`, `auditRowToRow`, `eventToRow`, `countersToRows`, `exportRowsFromAudit` | Every row of a mapped table. Export records are derived from their audit rows, as the seed derives its one |
| Mapping, the way back: `fromRows`, `auditRowFromRow`, `evidenceItemFromRows`, `verifyStoredAuditRows`, `isStorableText` | The base, the chain check, the text rule |
| Store: `lockAuditChain`, `insertRows`, `applyChanges`, `readStoredRows`, `countAllTables`, `ALL_TABLES`, `StoreError` | The chain lock, every INSERT into a mapped table (the audit rows one by one), the counter and state updates, the base, the counts |
| Commands: `verifyOwnerSession`, `readSchemaVersion`, `TEST_DATABASE_PATTERN`, `PROJECT_DATABASES` | The role check, the schema version, the name guard |

No row builder exists for the five identity and pairing tables, for `operator_credentials`,
`registry_counters` and `audit_chain_history`: no simulator slice holds them. The fixture builds
those rows in the select shape of the typed schema and inserts them with the query builder. That
is no second mapping; when the identity and pairing modules have repositories, the fixture can use
them.

## 17. Test ledger (P24)

`@dems/core-server` only; no other workspace was touched, no existing test was changed.

| Project | Before this row | After | This row's files |
|---|---|---|---|
| `db` | 31 files, 451 tests (the whole runs of 11:34:49 and 11:38:57 without this row's file) | **32 files, 470 tests** | `src/db/fixtures/__tests__/bulk-fixture.db.test.ts`: **19** |
| `unit` | 47 files, 1,438 tests (the whole run of 11:33:57 without this row's files) | **51 files, 1,541 tests** | `src/db/fixtures/__tests__/build.test.ts`: **42**; `target.test.ts`: **41**; `rng.test.ts`: **10**; `static.test.ts`: **10** (103 in 4 files) |

Other rows add files while this one runs, so both "before" figures are of the moment named.

## 18. Rollback (R-NEW; not executed)

```sh
git clean -fd -- apps/core-server/src/db/fixtures
```

The folder is new and untracked. Afterwards `tpl_bulk` is "not available" again (its hook is gone)
and a test file that asks for it gets the helper's `TEMPLATE_NOT_AVAILABLE`. Nothing else is to
undo: no database of this row exists, no role, no setting, no file outside the folder and the two
documents.

## 19. Not done, and not verified by this row

- An app built by the factory on a bulk clone. The boot checks and the rehydration through the
  mapping pass; the engine host row is in flight, so the server itself was not started on one.
- Query plans (`EXPLAIN`) on the bulk data. The statistics are there; the paging and index rows
  (W39, W47, W98) own those checks.
- F-3 was not reproduced on purpose, and its cause is a hypothesis.
- The teardown of a run after an interrupt signal (the helper's six-hour sweep is the fallback).

## 20. Verification list of the row

| Check of the row | Result | Section |
|---|---|---|
| `DEMS_TEST_STEP=47 npm run test:db -w @dems/core-server -- src/db/fixtures` exits 0 | Yes: 1 file, 19 tests | 8.1 |
| The loader's printed counts meet every minimum | Yes: 30 of 30 | 3 |
| `verifyAuditChain` passes over all rows | Yes: 5,000 rows | 6 |
| `db:status` of `dems_demo` prints the same counts before and after | Yes | 10 |
| Determinism: the same digest twice | Yes | 8.2 |
| The name guard, without connecting | Yes | 5.4 |
| A clone read back as `dems_app` | Yes | 7 |
| Build and clone times measured | Yes | 9 |
| `unit` for everything that is this row's | 4 files, 103 tests, 0 failed | 8.3 |
| Typecheck and lint exit 0 | Yes | 1 |
| No leftover database; PostgreSQL PID 19121; no role, no setting | Yes | 11 |

## 21. Follow-up: audit detail keys (decisions D91, D93)

Done on 2026-10-04 between 16:04 and 16:40 WIB, after the controller's gate on this row (PASS,
decision D73). Two module rows that landed since (pairing W32, user administration W33; finding
F68) found that the fixture wrote audit rows whose `details` had other keys than the real modules
write, some of them keys the server's audit writer refuses. Sections 1 to 20 describe the fixture
as it was at 11:50; where they quote the fixture digest or the audit head, section 21.2 holds the
values that are true now.

Rules of the follow-up, as kept: only `apps/core-server/src/db/fixtures/**` and the row's two
documents were written; no command began with `cd`; every command that opens a database connection
ran with `DEMS_TEST_STEP=47b` and the per-command sandbox bypass, everything else inside the
sandbox; no `timeout` command; no file of the workspace tree was changed for a mutation check
(M15: the check of section 21.6 works on a copy in the session scratchpad); the whole projects ran
twice, after the change was whole and at the end, with `--maxWorkers=2`.

### 21.1 Result

| Item | Result |
|---|---|
| The three administration types | `ROLE_CHANGED`, `USER_DISABLED`, `USER_ENABLED` hold the keys of spec §13.1 (`targetOperatorId`, `from`, `to`, `sessionsEnded`, optional `reason`) |
| The pairing rows the controller named | No `phase`; `DEVICE_REVOKED` carries `reason` (the text of `paired_devices.revoke_reason`) and `sessionsEnded` |
| Every other type | All 53 audit types the fixture writes were held against the code that writes them. **30 types had other keys or values than their writer gives; all 30 are corrected** (section 21.4) |
| Rows the audit writer would have refused | Before: **101 rows of 7 types**. Now: **0** (section 21.6) |
| The new test | `__tests__/audit-details.test.ts`, 18 tests: every audit row of the fixture against the writer's list, the modules' builders and the driven simulator; it prints the table of section 21.3 |
| What changed in the data | `details` of 1,635 audit rows; the message of 87 audit rows; 3 event rows. **Nothing else**: 16 of the 18 tables the fixture fills are identical row for row (section 21.5) |
| Counts and minimums | Unchanged: the loader's table is line for line the table of section 3 (`diff`, 31 lines) |
| The spread per entity | Unchanged: no audit row differs in `seq`, `id`, `at`, type, category, severity, actor, session, evidence or device |
| The `at` ordering (DN-1) | Unchanged: every `at` is the same; one descent in sequence order, after the reset marker |
| The audit chain | `verifyAuditChain` ok over all 5,000 stored rows; boot check B-8 as `dems_app` ok |
| Determinism | Holds: two loads give equal rows in all 30 tables; the loaded digest equals the pure builder's |
| Row command `DEMS_TEST_STEP=47b npm run test:db -w @dems/core-server -- src/db/fixtures` | **Exit 0**: 1 file, 19 tests (16:38:36) |
| `unit`, this row's files | **5 files, 121 tests**, 0 failed (16:39:06) |
| Whole `unit` | 134 files, 3,503 tests, 0 failed (16:27:04 and again 16:33:41) |
| Whole `db` | 101 files, 1,488 tests, 0 failed (16:27:53); 105 files, 1,513 tests, 0 failed (16:34:39). The six files on the bulk template pass |
| Typecheck, lint | Exit 0, exit 0; no warning in this row's files (16:39) |
| Databases of this row | None left (`pg_database`, 16:39); PostgreSQL PID 19121, started 07:14:26, unchanged |

### 21.2 The pinned values: old to new

The audit chain hashes cover the details, so both values change by design. No source file holds
either value as text: the tests compare what was loaded with what the pure builder announces. The
values are pinned in this document (sections 1, 3, 6, 8) and in the progress file.

| Value | Step 47 (until 16:04) | Now |
|---|---|---|
| Fixture digest (`BULK_TEMPLATE_NOW`, seed 20261004) | `953c92ea4c9e1393daa554fb8e1318d513b1e6e8d856d2d2d78d8d76c5ed8577` | `3d2e7fe247a44ec2a17242431c7fcff249df9207ce74c51b373d0475cc8dbcaa` |
| Audit head, sequence 5000 | `d2d9f9e596ed73d2c8d0cd2cf5c3fe79341cd9f3422161681d677f331e5633c1` | `46382e11b16010879f2e3769cc9ff5de722919318bc2cad941c71c82f55f1b0b` |
| Variant with a session in RECORDING: digest | `f9a359c720432a3a7e810b2ba9707db220f3549b73ecfa7705f79f718a545605` | `d3cda7f5dc17e3611b2b42ef125fa5017f7384051c5c1fe1c140944b6b9532f1` |
| Variant: audit head, sequence 5000 | `38ca943c22a430741b374402e4750898c8a2f7cb3146443504a5c29c3c750185` | `8e563f131571164a496cc6c9563104870baad5875b82643e7aebaf4d9f1593cd` |

The digest over an ordered dump of all 30 tables (section 8.2) differs between runs by design (it
covers the seeded credential rows, whose salts are fresh in every run); in the runs of 16:26 and
16:34 the template clone and the second load were equal to each other.

### 21.3 The table: type, where it is written, keys expected, keys written

Printed by the new test (`--reporter=verbose`, 16:39:06). `list:` is the closed list of the audit
writer, a key in brackets is optional. `builder:` is what the pure builder of the writing module
gives for the facts of the fixture's rows. `simulator:` is every key set the shared simulator wrote
for that type when it was driven.

| Type | Written by | Keys expected | Keys written (rows) |
|---|---|---|---|
| `AUTH_SUCCESS` | MODULE | builder: {method} | {method} x 300 |
| `AUTH_FAILED` | MODULE | builder: {attemptsRemaining, knownOperator, lockedUntil, method} or {attemptsRemaining, knownOperator, lockedUntil, method, reason, sessionsEnded} | {attemptsRemaining, knownOperator, lockedUntil, method} x 60; {attemptsRemaining, knownOperator, lockedUntil, method, reason, sessionsEnded} x 6 |
| `AUTH_LOCKED` | MODULE | builder: {lockedUntil, method, retryInMs} | {lockedUntil, method, retryInMs} x 6 |
| `AUTH_SIGNED_OUT` | MODULE | builder: {reason} | {reason} x 96 |
| `AUTH_EXPIRED` | MODULE | builder: {reason} | {reason} x 84 |
| `SESSION_CREATED` | SIMULATOR | simulator: {caseNumber} or {caseNumber, subjectType} | {caseNumber} x 513 |
| `PRECHECK_PASSED` | SIMULATOR | simulator: {(none)} or {acknowledged, by, warnings} | {(none)} x 507 |
| `PRECHECK_BLOCKED` | SIMULATOR | simulator: {blocks, by, checks, reasons} | {blocks, by, checks, reasons} x 6 |
| `RECORDING_STARTED` | SIMULATOR | simulator: {(none)} or {timeSource} | {(none)} x 502 |
| `RECORDING_STOPPED` | SIMULATOR | simulator: {reason} or {durationMs, reason} | {reason} x 488 |
| `SESSION_CANCELLED` | SIMULATOR | simulator: {fromState} | {fromState} x 6 |
| `EVIDENCE_SEALED` | SIMULATOR | simulator: {manifestHash} or {manifestHash, sizeBytes, tracks} | {manifestHash} x 488 |
| `SESSION_INCOMPLETE` | SIMULATOR | simulator: {(none)} or {faultKind} | {(none)} x 19 |
| `SUMMARY_ACKNOWLEDGED` | SIMULATOR | simulator: {(none)} | {(none)} x 49 |
| `MARKER_ADDED` | SIMULATOR | simulator: {index, label} | {index, label} x 141 |
| `NOTE_ADDED` | SIMULATOR | simulator: {length, noteId} | {length, noteId} x 57 |
| `SNAPSHOT_TAKEN` | SIMULATOR | simulator: {cameraId, index} | {cameraId, index} x 8 |
| `FRAME_HASH` | SIMULATOR | simulator: {segment, sha256, trackId} | {segment, sha256, trackId} x 142 |
| `WRITE_VERIFIED` | SIMULATOR | simulator: {bytesWritten, volume} | {bytesWritten, volume} x 101 |
| `TIMESTAMP_CONFIRMED` | SIMULATOR | simulator: {offsetMs, source} | {offsetMs, source} x 81 |
| `EVIDENCE_VERIFIED` | SIMULATOR | simulator: {failedTracks, manifestOk, signatureOk} | {failedTracks, manifestOk, signatureOk} x 84 |
| `EVIDENCE_VERIFY_FAILED` | SIMULATOR | simulator: {eventKind, failedTracks, manifestOk, signatureOk} | {eventKind, failedTracks, manifestOk, signatureOk} x 8 |
| `EVIDENCE_REVIEW_OPENED` | SIMULATOR | simulator: {(none)} | {(none)} x 27 |
| `EVIDENCE_EXPORTED` | SIMULATOR | simulator: {destination, exportId, reason} or {destination, eventKind, exportId, reason} | {destination, eventKind, exportId, reason} x 39 |
| `EXPORT_DENIED` | MODULE | builder: {eventKind, operationId, permission, role} | {eventKind, operationId, permission, role} x 12 |
| `EVIDENCE_ARCHIVED` | SIMULATOR | simulator: {retentionPolicy} | {retentionPolicy} x 30 |
| `AUDIT_EXPORTED` | SIMULATOR | simulator: {chainOk, destination, eventKind, exportId, head, reason, rows} or {chainOk, destination, eventKind, events, exportId, head, reason, rows, scope} | {chainOk, destination, eventKind, events, exportId, head, reason, rows, scope} x 10; {chainOk, destination, eventKind, exportId, head, reason, rows} x 10 |
| `FAULT_RAISED` | SIMULATOR | simulator: {fromState, kind} or {eventKind, evt, fromState, kind, target} | {eventKind, evt, fromState, kind, target} x 238; {fromState, kind} x 19 |
| `FAULT_CLEARED` | SIMULATOR | simulator: {evt, kind, target} | {evt, kind, target} x 238 |
| `RECOVERY_STARTED` | SIMULATOR | simulator: {(none)} or {faultKind} | {(none)} x 19 |
| `RECOVERY_COMPLETED` | SIMULATOR | simulator: {(none)} | {(none)} x 19 |
| `AUDIT_CHAIN_DISCONTINUITY` | SIMULATOR | simulator: {eventKind, evt, index, kind, seq} | {eventKind, evt, index, kind, seq} x 17 |
| `PAIRING_SUCCESS` | MODULE | builder: {certificateFingerprint, codeId, coreDeviceId} | {certificateFingerprint, codeId, coreDeviceId} x 40 |
| `PAIRING_FAILED` | MODULE | builder: {attemptsRemaining, lockedUntil} | {attemptsRemaining, lockedUntil} x 81 |
| `PAIRING_LOCKED` | MODULE | builder: {lockedUntil, retryInMs} | {lockedUntil, retryInMs} x 7 |
| `UNPAIRED` | MODULE | builder: {sessionsEnded} | {sessionsEnded} x 10 |
| `TABLET_LINK_CHANGED` | SIMULATOR | simulator: {state} | {state} x 24 |
| `DEVICE_COMMAND` | SIMULATOR | simulator: {command} | {command} x 20 |
| `DIAGNOSTICS_RUN` | SIMULATOR | simulator: {checks, runId} | {checks, runId} x 10 |
| `STORAGE_POLICY_CHANGED` | SIMULATOR | simulator: {autoArchive, retentionDays, retentionPolicy} | {autoArchive, retentionDays, retentionPolicy} x 4 |
| `UPDATE_STARTED` | SIMULATOR | simulator: {from, targetSlot, to} | {from, targetSlot, to} x 2 |
| `UPDATE_COMPLETED` | SIMULATOR | simulator: {outcome, slot, version} | {outcome, slot, version} x 2 |
| `SCENARIO_LOADED` | MODULE | builder: {previousHead, previousRows, reset, scenario} | {previousHead, previousRows, reset, scenario} x 1 |
| `SYSTEM_BOOT` | SIMULATOR | simulator: {(none)} or {afterFault} or {slot, version} | {(none)} x 6 |
| `ACCESS_DENIED` | ALLOW-LIST | list: operationId, [permission], [role], [reason]; builder: {operationId, permission, role} | {operationId, permission, role} x 120 |
| `PAIRING_CODE_ISSUED` | ALLOW-LIST | list: codeId, expiresAt; builder: {codeId, expiresAt} | {codeId, expiresAt} x 60 |
| `PAIRING_CODE_CLOSED` | ALLOW-LIST | list: codeId, reason; builder: {codeId, reason} | {codeId, reason} x 19 |
| `DEVICE_REVOKED` | ALLOW-LIST | list: reason, sessionsEnded, [deviceId]; builder: {reason, sessionsEnded} | {reason, sessionsEnded} x 10 |
| `DEVICE_CREDENTIAL_ROTATED` | ALLOW-LIST | list: [deviceId]; builder: {(none)} | {(none)} x 14 |
| `ROLE_CHANGED` | ALLOW-LIST | list: targetOperatorId, from, to, [reason] | {from, reason, targetOperatorId, to} x 1; {from, targetOperatorId, to} x 1 |
| `USER_ENABLED` | ALLOW-LIST | list: targetOperatorId, [reason] | {reason, targetOperatorId} x 1 |
| `USER_DISABLED` | ALLOW-LIST | list: targetOperatorId, sessionsEnded, [reason] | {sessionsEnded, targetOperatorId} x 3; {reason, sessionsEnded, targetOperatorId} x 1 |
| `BIOMETRIC_ENROLLMENT_CHANGED` | ALLOW-LIST | list: enabled, [deviceId]; builder: {deviceId, enabled} | {deviceId, enabled} x 51 |

Sources: ALLOW-LIST 9 types (6 of them also have a builder), MODULE 11, SIMULATOR 33; 53 together,
each type with exactly one.

### 21.4 What was changed, per type

Thirty types, 1,635 rows. "Rows" is the number of fixture rows whose details changed.

| Type | Rows | Details at step 47 | Details now | Values |
|---|---|---|---|---|
| `ROLE_CHANGED` | 2 | `operatorId, fromRole, toRole` | `targetOperatorId, from, to, [reason]` | The roles of the change; one row with a reason, one without |
| `USER_DISABLED` | 4 | `operatorId` | `targetOperatorId, sessionsEnded, [reason]` | `sessionsEnded` 3: the three session rows that end at that instant with `USER_DISABLED` |
| `USER_ENABLED` | 1 | `operatorId` | `targetOperatorId, reason` | |
| `PAIRING_CODE_CLOSED` | 19 | `codeId, state` | `codeId, reason` | `CANCELLED`, `EXPIRED` or `EXHAUSTED`: the state of the code row |
| `PAIRING_SUCCESS` | 40 | `codeId, platform` | `coreDeviceId, certificateFingerprint, codeId` | The Core's ID and the fingerprint of `core_device` (read by the loader; `BulkBase.certificateFingerprint`) |
| `PAIRING_FAILED` | 81 | `codeId, attempt` | `attemptsRemaining, lockedUntil` | 2, 1, 0 failures left before redeeming locks; `lockedUntil` 60 s after the row when 0, else null. The row names no code |
| `PAIRING_LOCKED` | 7 | `codeId, failedAttempts` | `retryInMs, lockedUntil` | The lock of the failure before it; `lockedUntil` is the row's instant plus `retryInMs` |
| `DEVICE_REVOKED` | 10 | `deviceId, sessionsEnded` | `reason, sessionsEnded` | `reason` is `paired_devices.revoke_reason` of that device; `sessionsEnded` 2 |
| `UNPAIRED` | 10 | `deviceId` | `sessionsEnded` | 2 for six devices, 1 for four: the session rows that end with `DEVICE_UNPAIRED` |
| `DEVICE_CREDENTIAL_ROTATED` | 14 | `deviceId, phase` | none | The row carries the device in its own column |
| `BIOMETRIC_ENROLLMENT_CHANGED` | 51 | `deviceId, enabled, reason` | `enabled, deviceId` | |
| `AUTH_SUCCESS` | 300 | `method, transport` | `method` | |
| `AUTH_FAILED` | 60 | `reason, method` | `method, knownOperator, attemptsRemaining, lockedUntil` | 4 to 0 failures left before the console locks; `knownOperator` false (the rows name no operator) |
| `AUTH_FAILED` (token reuse) | 6 | `reason, method, sessionsEnded` | the four above and `reason, sessionsEnded` | `reason` `TOKEN_REUSE` (was `BIOMETRIC_TOKEN_REUSE`); `sessionsEnded` 2 |
| `AUTH_LOCKED` | 6 | `lockedForMs, failures` | `method, retryInMs, lockedUntil` | 13 to 59 s of the lock left |
| `AUTH_EXPIRED` | 84 | `reason` | `reason` | `IDLE` or `ABSOLUTE` (were `IDLE_EXPIRED`, `ABSOLUTE_EXPIRED`, the end reasons of the session table) |
| `ACCESS_DENIED` | 61 of 120 | `operationId, permission, role` | the same | Four of the eleven operations were not ones whose refusal the guard writes as `ACCESS_DENIED`: `openEvidenceReview`, `exportAuditLog` and `sendDeviceCommand` are in no registry, `exportEvidence` is refused as `EXPORT_DENIED`. Now `archiveEvidence`, `assignUserRole`, `restartDevice`, and the any-of `setStoragePolicy` (`EVIDENCE_REVIEW_OR_MAINTENANCE`) |
| `EXPORT_DENIED` | 12 | `role, eventKind` | `operationId, permission, role, eventKind` | `exportEvidence`, `EVIDENCE_EXPORT`: the guard's row |
| `FAULT_RAISED` (alerts) | 238 of 257 | `kind, target, alertId` | `kind, evt, eventKind, target, fromState` | The event number and class of the fault kind; `fromState` null. The 19 rows of incomplete sessions already had the seeded history's form |
| `FAULT_CLEARED` | 238 | `kind, target, alertId` | `kind, evt, target` | |
| `AUDIT_CHAIN_DISCONTINUITY` | 17 | `eventKind, scope` | `kind, evt, eventKind, index, seq` | A place in the engine's ring and its sequence there |
| `AUDIT_EXPORTED` | 20 | without `head` | with `head` | `head`: 64 hexadecimal digits, the SHA-256 of a text that says what it stands for; `rows` at most 1,000 and `events` at most 500 (the engine writes the length of its rings) |
| `DIAGNOSTICS_RUN` | 10 | `runId, result, checks` | `runId, checks` | |
| `STORAGE_POLICY_CHANGED` | 4 | `retentionPolicy, autoArchive` | `retentionPolicy, retentionDays, autoArchive` | The last row is the seeded policy |
| `UPDATE_STARTED` | 2 | `version` | `from, to, targetSlot` | 2.2.0 to 2.3.0 into slot B, then 2.3.0 to the seeded 2.4.1 into slot A, the active one |
| `UPDATE_COMPLETED` | 2 | `version, result` | `version, slot, outcome` | |
| `PRECHECK_BLOCKED` | 6 | `reasonCode` | `blocks, checks, reasons, by` | One blocking check: `LENS_1` with `LENS_FAULT`, or `STORAGE` with `STORAGE_FULL` (the two codes of step 47 warn, they do not block) |
| `SESSION_CANCELLED` | 6 | none | `fromState` | `PRECHECK` |
| `MARKER_ADDED` | 141 | `index` | `label, index` | The label of the marker in the evidence item |
| `FRAME_HASH` | 142 | `segment, track` | `trackId, segment, sha256` | `sha256` drawn from a stream of its own (`frame-hashes`), so no other row's numbers move; all 142 distinct |
| `WRITE_VERIFIED` (padding rows) | 41 of 101 | `volume, segment` | `bytesWritten, volume` | |

`SCENARIO_LOADED` now always holds `reset` (false for a scenario load), as the reset routine writes
it; the one row of the fixture is a reset, so its content did not change.

A row was not turned into a replay of a request. `attemptsRemaining`, `lockedUntil` and `retryInMs`
have the form and the range the modules give them and agree with the row's own instant; the lock
of a console or of redeeming is not simulated across rows (a real lock would turn some
`PAIRING_FAILED` rows into `PAIRING_LOCKED` rows, which would change counts).

### 21.5 What did not change, and how that was established

`apps/core-server` is not under version control yet, so there was no earlier revision to compare
with. The fixture of step 47 was rebuilt outside the workspace: a copy of the folder in the session
scratchpad, with the edits of section 21.4 reversed, standing on the same shared dataset. **That
copy gives the pinned digest and the pinned head of step 47**, so it is the old fixture; it was
then compared with the present one, table by table (16:25):

```
== the fixture
old code rebuilt outside the workspace: digest 953c92ea4c9e1393daa554fb8e1318d513b1e6e8d856d2d2d78d8d76c5ed8577 = the pinned digest of step 47
old head seq 5000 d2d9f9e596ed73d2c8d0cd2cf5c3fe79341cd9f3422161681d677f331e5633c1 = the pinned head of step 47
new digest 3d2e7fe247a44ec2a17242431c7fcff249df9207ce74c51b373d0475cc8dbcaa new head 5000 46382e11b16010879f2e3769cc9ff5de722919318bc2cad941c71c82f55f1b0b
expectedCounts equal: true | added equal: true | updates equal: true
tables with identical rows: operators (9), operatorCredentials (9), pairingCodes (60), pairedDevices (40), deviceCredentials (40), authSessions (300), biometricTokens (83), sessionHistory (507), evidenceItems (502), evidenceTracks (2008), evidenceCustody (1192), exportRecords (59), activeSession (0), alerts (250), healthSnapshots (1508), auditChainHistory (25)
tables whose rows differ: auditLog (4918), events (3590)
audit_log 4918 rows: rows where seq, id, at, type, category, severity, actor, session, evidence or device differ: 0
  rows whose details differ: 1635 of 30 types
  rows whose message differs: 87: ACCESS_DENIED 61, UPDATE_STARTED 1, UPDATE_COMPLETED 1, AUDIT_EXPORTED 17, PAIRING_LOCKED 7
  at in sequence order: 1 descent(s) (DN-1: one, after the reset marker)
events 3590 rows: rows where seq, id, at, type, category, severity, session or device differ: 0; rows that differ at all: 3: UPDATE_AVAILABLE 1, UPDATE_STARTED 1, UPDATE_COMPLETED 1
```

The variant with a session in RECORDING: the same picture (16 tables identical, 0 audit rows
differ outside details and message, 3 event rows differ, one descent).

Why it holds by construction: no existing random stream draws one number more or fewer than before
(the only new draws are from the new stream `frame-hashes`), no call that records an activity was
added, removed or moved, and no row's actor, device, session or evidence reference was touched.
Every figure of section 4 is still an assertion of `build.test.ts` and of the database test, and
both pass unchanged.

### 21.6 The new test

`__tests__/audit-details.test.ts` (18 tests) with its support file `__tests__/audit-reference.ts`.
The expected keys are written down nowhere: they come from the code that writes the rows.

| Source | Types | What a fixture row is held against |
|---|---|---|
| ALLOW-LIST | The nine server-written types | `SERVER_AUDIT_DETAIL_RULES` (`core/audit-details.ts`): no key outside the list, every required key, every value accepted by its rule. And the writer's own gate, `auditInputOf` (`core/audit-writer.ts`), which a module's entry passes before a statement is sent. For six of the nine also the module's builder |
| MODULE | 11 types a server-native module writes with the simulator's shape | The pure builder of that module, called with the facts of the row: `modules/identity/activity.ts`, `modules/identity/biometric/activity.ts`, `modules/pairing/activity.ts`, `plugins/permission-guard/denial.ts` (with the rule of the registry operation the row names), `db/reset/plan.ts`. Same type, same keys, same values. These rows also pass `auditInputOf` |
| SIMULATOR | The 33 engine-written types | The shared simulator, driven headless through its own actions on four engines (a recording to its seal and everything done with evidence and the Core; a cancelled and a blocked session; a recording ended by a power failure and recovered; a software update), plus the four seeded scenario states: 1,305 rows of 34 types in about 90 ms. A fixture row's key set must be one the simulator wrote for that type, and each value of a kind (text, number, boolean, null) the simulator wrote for that key |

The test also holds what a row states against the rows it is about: `sessionsEnded` is the number
of session rows that end at that instant for that reason (and every such session row is counted by
exactly one audit row); a pairing row names the code, the Core and the revoke reason the registry
rows hold; a refusal names an operation of the registry and a role that holds none of the
permissions its rule names; lock times agree with the row's own instant and none is after the clock.

**The comparisons can fail.** Five tests plant what the fixture held at step 47, and other drift,
into a copy of a row and expect the finding: the administration keys (`AUDIT_DETAIL_KEY_NOT_ALLOWED`
from the writer), `phase`, a revoke without `reason` (`AUDIT_DETAIL_MISSING`), a role that is none
(`AUDIT_DETAIL_VALUE_INVALID`), a failed redeem that names a code, the old sign-in keys, an expiry
reason outside its set, `knownOperator` true on a row without an actor, an operation outside the
registry, an export written as a plain refusal, a permission the rule does not name, engine rows
with the old keys, with one key too many and with a value of another kind.

And on the real thing, without touching the workspace (M15): the step 47 fixture of section 21.5,
in the scratchpad, against the same four comparisons (16:26):

```
== the fixture of step 47 (copy outside the workspace): digest 953c92ea4c9e1393..., 4918 audit rows
  allow-list :  139 finding(s) in rows of: BIOMETRIC_ENROLLMENT_CHANGED 51, DEVICE_CREDENTIAL_ROTATED 14, DEVICE_REVOKED 10, PAIRING_CODE_CLOSED 38, ROLE_CHANGED 12, USER_DISABLED 12, USER_ENABLED 2
  writer gate:  101 finding(s) in rows of: BIOMETRIC_ENROLLMENT_CHANGED 51, DEVICE_CREDENTIAL_ROTATED 14, DEVICE_REVOKED 10, PAIRING_CODE_CLOSED 19, ROLE_CHANGED 2, USER_DISABLED 4, USER_ENABLED 1
  module     :  759 finding(s) in rows of: ACCESS_DENIED 59, AUTH_EXPIRED 84, AUTH_FAILED 66, AUTH_LOCKED 6, AUTH_SUCCESS 300, BIOMETRIC_ENROLLMENT_CHANGED 51, DEVICE_CREDENTIAL_ROTATED 14, DEVICE_REVOKED 10, EXPORT_DENIED 12, PAIRING_CODE_CLOSED 19, PAIRING_FAILED 81, PAIRING_LOCKED 7, PAIRING_SUCCESS 40, UNPAIRED 10
  simulator  :  867 finding(s) in rows of: AUDIT_CHAIN_DISCONTINUITY 17, AUDIT_EXPORTED 20, DIAGNOSTICS_RUN 10, FAULT_CLEARED 238, FAULT_RAISED 238, FRAME_HASH 142, MARKER_ADDED 141, PRECHECK_BLOCKED 6, SESSION_CANCELLED 6, STORAGE_POLICY_CHANGED 4, UPDATE_COMPLETED 2, UPDATE_STARTED 2, WRITE_VERIFIED 41

== the fixture now (workspace): digest 3d2e7fe247a44ec2..., 4918 audit rows
  allow-list :    0 finding(s)
  writer gate:    0 finding(s)
  module     :    0 finding(s)
  simulator  :    0 finding(s)
```

"Writer gate 101" is the number of step 47 rows the audit writer would have refused: all rows of
seven of the nine server-written types. The controller's two items were three of those seven types
and part of a fourth; `PAIRING_CODE_CLOSED` (`state` for `reason`) and
`BIOMETRIC_ENROLLMENT_CHANGED` (a key `reason`) were refusable too.

`static.test.ts` lists the two new files; the static guards of the folder pass unchanged.

### 21.7 Verification

The row command (16:38:36, outside the sandbox); the 31 lines of the minimums table are cut here
and are, by `diff`, the lines of section 3:

```
> vitest run --project db src/db/fixtures
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_47b_tmdmscc8_
[test:db] stale sweep: dropped 0; kept 5 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] bulk fixture: dems_test_step_47b_tmdmscc8_tpl_bulk as dems_owner; clock 2026-10-01T03:00:00.000Z; seed 20261004
[test:db]   table                   minimum   loaded   added  met
  ... 30 lines, identical to section 3 ...
[test:db] bulk fixture: every minimum of the 30 tables is met; audit head seq 5000, hash 46382e11b1601087...; digest 3d2e7fe247a44ec2...; build 343 ms, write 1633 ms, total 1979 ms
 Test Files  1 passed (1)
      Tests  19 passed (19)
   Start at  16:38:36
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 141 ms; 0 remain with the run prefix dems_test_step_47b_tmdmscc8_
```

The chain, from the verbose runs of 16:25:56 and 16:34:39 (the default reporter does not show the
output of a passing test):

```
[test:db] bulk fixture: verifyAuditChain over all 5000 stored audit rows: ok (head seq 5000, hash 46382e11b1601087...)
[test:db] bulk fixture: digest over a stable ordered dump of all 30 tables, template clone and second load: 877c1cedbe53986fbd4aae25346e590227fb3fd2b083b807f3d15dd91bdd008f = 877c1cedbe53986fbd4aae25346e590227fb3fd2b083b807f3d15dd91bdd008f
[test:db] bulk fixture size: a clone of tpl_bulk 19366 kB; a clone of tpl_seed with the fixture loaded and vacuumed 19366 kB
```

| Check | When | Result |
|---|---|---|
| `DEMS_TEST_STEP=47b npm run test:db -w @dems/core-server -- src/db/fixtures` | 16:25:31, 16:25:56 (verbose), 16:38:36 | Exit 0 each time: 1 file, 19 tests; minimums table unchanged; 0 databases remain |
| `npm run test -w @dems/core-server -- src/db/fixtures --reporter=verbose` | 16:39:06 | Exit 0: 5 files, 121 tests (`audit-details` 18, `build` 42, `target` 41, `rng` 10, `static` 10) |
| Whole `unit`, `--maxWorkers=2` | 16:27:04; 16:33:41 | Exit 0 both: 134 files, 3,503 tests, 0 failed |
| Whole `db`, `--maxWorkers=2` | 16:27:53 to 16:31:20 | Exit 0: 101 files, 1,488 tests, 0 failed; 0 databases remain |
| Whole `db`, `--maxWorkers=2 --reporter=verbose` | 16:34:39 to 16:38:18 | Exit 0: 105 files, 1,513 tests, 0 failed; 0 databases remain |
| The files on the bulk template, in the run of 16:34:39 | | `db/fixtures/.../bulk-fixture.db.test.ts` 19; `modules/admin/.../bulk.db.test.ts` 2; `modules/evidence/.../bulk.db.test.ts` 14; `modules/sessions/.../history.db.test.ts` 13; `modules/pairing/.../registry.db.test.ts` 6; `modules/security-audit/.../bulk.db.test.ts` 15: all passed |
| `npm run typecheck -w @dems/core-server` | 16:39 | Exit 0 |
| `npm run lint -w @dems/core-server` | 16:39 | Exit 0; 3 warnings, all in `src/realtime` (a row in flight), none in this row's files |
| `pg_database` as `dems_owner` on `127.0.0.1:4432` | 16:39 | 0 databases named `dems_test_step_47...`; the 7 test databases present are a live run of step 62; three roles, no setting override |
| PostgreSQL | 16:39 | PID 19121, started 07:14:26, unchanged |

No test of another row was red in any of the four whole-project runs, so there is no P11 entry to
name. No test of another row pins a detail key or a digest of the fixture (searched before the
change): the administration and pairing tests on the bulk template assert the rows they write
themselves, after the fixture's last sequence. The file count of `db` rose from 101 to 105 between
the two whole runs because other rows added files in those minutes.

### 21.8 Deviations, findings and decisions of the follow-up

| ID | Deviation | Why |
|---|---|---|
| DV-9 | Three event rows changed (`UPDATE_AVAILABLE`, `UPDATE_STARTED`, `UPDATE_COMPLETED` of the first update: the version they name) | The audit row beside them now names the version of that update (2.3.0); the events would have contradicted it |
| DV-10 | The message of 87 audit rows changed: `ACCESS_DENIED` 61 and `AUDIT_EXPORTED` 17 (the message quotes a value that changed), `UPDATE_STARTED` 1, `UPDATE_COMPLETED` 1, `PAIRING_LOCKED` 7 (the old text said "code exhausted"; the row is a redeem during a lock) | A message that contradicts its details is worse than a changed message |
| DV-11 | Values were corrected, not only keys, where the old value was one no writer gives (section 21.4, column "Values") | The comparison with a builder is on values too |
| DV-12 | `BulkBase` has one member more, `certificateFingerprint`; the loader reads it from `core_device` in its transaction | `PAIRING_SUCCESS` names it, and no durable slice holds it |
| DV-13 | The test imports, read-only, the builders of the identity, biometric and pairing modules, the guard and the reset routine, and the headless engine host of the seed row's test support | That is the point: when one of them changes the row it writes, this test turns red in this folder |

| ID | Finding | Evidence |
|---|---|---|
| F-10 | The drift was wider than the two rows reported: 30 of 53 types, 1,635 rows; 101 rows of 7 types were refusable by the audit writer | Section 21.6 |
| F-11 | The six token-reuse rows name no operator (unchanged), so they say `knownOperator: false`. The biometric module names the operator of the reused token. Setting the actor is one line in `identity.ts`; it adds an actor to 6 rows, which is a change of rows per actor, so it was left for a decision | `modules/identity/biometric/sign-in.ts` (the refusal of a reused token); `identity.ts`, the reuse loop |
| F-12 | Severity is not held against the writers and differs in 67 rows of 4 types: `PAIRING_SUCCESS` SUCCESS for INFO (40), `DEVICE_CREDENTIAL_ROTATED` INFO for WARNING (14), `PAIRING_CODE_CLOSED` of an exhausted code INFO for WARNING (7), the token-reuse `AUTH_FAILED` CRITICAL for WARNING (6) | A read-only comparison with the builders, 16:33 |
| F-13 | The message of every module-written type is the fixture's own wording, not the module's | The same comparison |
| F-14 | The `params` of events were not part of this follow-up and are held against nothing. By reading, at least eleven event types differ from their writer (`AUTH_FAILED`, `AUTH_LOCKED`, `AUTH_LOGOUT`, `AUTH_EXPIRED`, `PAIRING_FAILED`, `PAIRED`, `UNPAIRED`, `AUDIT_CHAIN_BROKEN`, `MARKER_ADDED`, `STORAGE_POLICY_CHANGED`, `DIAGNOSTICS_COMPLETED`). No closed list exists for event params | `modules/*/activity.ts`, `packages/shared/src/sim` |
| F-15 | The biometric module (W41) was in flight while this was written (its files are from 15:55 to 16:02). The keys of `BIOMETRIC_ENROLLMENT_CHANGED` and of a refused token are taken from its builders as they are now; if W41 changes them, `audit-details.test.ts` fails, as intended | `modules/identity/biometric/activity.ts` |
| F-16 | The security-audit bulk test (W39, in flight) says in its header that nothing is asserted about the details of the fixture's three administration types. That caution is no longer needed | `modules/security-audit/__tests__/bulk.db.test.ts:8` |
| F-17 | `apps/core-server` is untracked, so an old state can only be rebuilt by reversing edits; the pinned digest is what proves the rebuilt copy | Section 21.5 |
| F-18 | The default reporter hides the output of a passing test: the table of section 21.3 and the chain line need `--reporter=verbose` | 16:23, 16:25 |

| ID | Question | Recommendation |
|---|---|---|
| DN-8 | DV-9 to DV-13 | Accept |
| DN-9 | F-11: should the token-reuse rows name the operator? | Yes, if rows per actor may change by 6; it makes the row what the module writes |
| DN-10 | F-12, F-13, F-14: severity, message and event params | Decide whether the fixture should match there too. Severity is four one-word changes. Event params would be a second follow-up of the same kind, with the same test extended to events; it changes the content of `events`, not its counts |
| DN-11 | F-16 | Tell W39 that its bulk test may assert the details of the administration rows |

### 21.9 Files, ledger, rollback

Edited: `identity.ts`, `operations.ts`, `recordings.ts` (the details), `world.ts` (`BulkBase`, the
stream name), `load.ts` (one read of `core_device`), `__tests__/support.ts` (`pureBase`),
`__tests__/static.test.ts` (the file list). New: `__tests__/audit-details.test.ts`,
`__tests__/audit-reference.ts`. Nothing outside the folder and the two documents. The scratch files
(the rebuilt step 47 copy, four probes, run logs) are in the session scratchpad.

| Project | Before the follow-up | After | This row's files |
|---|---|---|---|
| `unit` | 133 files, 3,485 tests (the whole run of 16:33:41 without the new file) | 134 files, 3,503 tests | 5 files, 121 tests: `audit-details.test.ts` **18** (new); `build` 42, `target` 41, `rng` 10, `static` 10 (unchanged in number) |
| `db` | 105 files, 1,513 tests | the same | `bulk-fixture.db.test.ts` 19, unchanged |

Rollback: the folder is untracked, so there is no revision to return to. Reversing the details of
section 21.4 gives back the digest of step 47 (shown in section 21.5); the two new test files can
be deleted on their own.

## 22. Follow-up 2: severities, events, alerts (decision D103)

Done on 2026-10-04 between 17:03 and 17:40 WIB, after the controller's gate on the first follow-up
(PASS, decision D103) and after the last module rows that write audit rows or events had landed.
Six items were asked: the token-reuse rows name the operator (DN-9); severity follows the writers
(DN-10); events follow their writers (DN-10); each fault alert agrees with the row of its fault
(finding F-W40-3 of the system and alerts row); a message is the builder's where a builder gives
one; the lock that is not replayed is recorded as a known limit. Sections 1 to 21 stand as written;
where they quote the fixture digest or the audit head, section 22.2 holds the values that are true
now.

Rules, as kept: only `apps/core-server/src/db/fixtures/**` and the row's two documents were
written; no command began with `cd`; every command that opens a database connection ran with
`DEMS_TEST_STEP=47c` and the per-command sandbox bypass, everything else inside the sandbox; no
`timeout` command; no file of the workspace tree was changed for a comparison or a mutation check
(M15: both work on a copy of the folder taken at 17:07, before the first edit, in the session
scratchpad); the whole projects ran after the change was whole and again at the end, with
`--maxWorkers=2`. The structural round moved the store while this ran: it changed the import line
of `load.ts` at 17:13:51. That file was not edited in this follow-up, and the two test files that
were replaced as a whole were first compared, byte for byte, with the copy of 17:07.

### 22.1 Result

| Item | Result |
|---|---|
| 1. Token reuse (DN-9) | The six `AUTH_FAILED` rows of a reused token name the operator of that token (`actorId`) and say `knownOperator: true`. The biometric builders were re-read as they landed: `modules/identity/biometric/activity.ts` is unchanged since 15:57:47, so the reference of the first follow-up was not stale. All six refusal reasons and `sessionsEnded` are held by the comparison |
| 2. Severity (DN-10) | The four types follow their builders (67 rows), and one engine type the extended comparison found as well (`UPDATE_COMPLETED`, 2 rows). The test now holds the severity and the category of every audit row against its writer |
| 3. Events (DN-10) | **1,300 events of 18 types** differed from their writer in parameters, severity or text; all are corrected. The test holds every event: type, category, severity, parameter keys; an event a module writes beside its audit row is compared whole |
| 4. Alerts (F-W40-3) | **238 of 238** fault alerts have exactly one row and one event of their fault with the alert's kind, target, instant, text and severity (before: 0 of 238). An audit-tamper alert pairs with an `AUDIT_CHAIN_DISCONTINUITY` row. The alerts row's own bulk test now prints 88 of 88 |
| 5. Messages | Where a module has a builder, the message is the builder's: 11 audit types changed, 6 already had it; the three administration types keep the fixture's wording (no builder exists) |
| 6. Known limit | The lock that is not replayed across rows is recorded in section 22.7, with two more limits found here |
| Counts and minimums | Unchanged: the loader's table is line for line the table of section 3 (`diff`, 31 lines) |
| The spread per entity | Unchanged: rows per type and per category of `audit_log` and of `events` are equal; rows with a session 3,165, with evidence 893, with a device 950; 12 actors. One figure moved as item 1 asked: rows with an actor 3,270 to 3,276 |
| The `at` ordering (DN-1) | Unchanged: every `at`, `seq` and `id` of every audit row and event is the same; one descent |
| What changed in the data | 1,134 audit rows of 14 types and 1,300 events of 18 types. **The other 16 tables the fixture fills are identical row for row**, `alerts` included |
| The audit chain | `verifyAuditChain` ok over all 5,000 stored rows; boot check B-8 as `dems_app` ok |
| Determinism | Holds: two loads give equal rows in all 30 tables; the loaded digest equals the pure builder's |
| Row command `DEMS_TEST_STEP=47c npm run test:db -w @dems/core-server -- src/db/fixtures` | **Exit 0**: 1 file, 19 tests (17:35:44) |
| `unit`, this row's files | **5 files, 138 tests**, 0 failed (17:29:42); `audit-details.test.ts` has 35 tests (18 before) |
| Whole `unit` | 140 files, 3,602 tests, 0 failed (17:25:14); 141 files, 3,604 tests, 0 failed (17:33:14) |
| Whole `db` | 108 files, 1,540 tests passed, 1 skipped, 0 failed (17:26:10); 108 files, 1,540 tests passed, 1 skipped, 0 failed (17:33:55). The eight files on the bulk template pass |
| Typecheck, lint | Exit 0, exit 0; no warning in this row's files (17:33) |
| Databases of this row | None left (`pg_database`, 17:36); PostgreSQL PID 19121, started 07:14:26, unchanged |

### 22.2 The pinned values: old to new

No source file holds either value as text. They are pinned in this document and in the progress
file only.

| Value | Step 47 | After follow-up 1 | Now |
|---|---|---|---|
| Fixture digest | `953c92ea4c9e1393...` | `3d2e7fe247a44ec2a17242431c7fcff249df9207ce74c51b373d0475cc8dbcaa` | `e58f1ae233811851df5aa84ebfb085703ce2b3d423d950a58a019bdfa97f0415` |
| Audit head, sequence 5000 | `d2d9f9e596ed73d2...` | `46382e11b16010879f2e3769cc9ff5de722919318bc2cad941c71c82f55f1b0b` | `26e251887c667e1ee20b74960c0335afa49859128fd9d1ea096d47d42f0f77cf` |
| Variant with a session in RECORDING: digest | `f9a359c720432a3a...` | `d3cda7f5dc17e3611b2b42ef125fa5017f7384051c5c1fe1c140944b6b9532f1` | `623c6d0c952e26e98327ef3494728415797b8beae9de5ab0fec5793ab93e22a7` |
| Variant: audit head, sequence 5000 | `38ca943c22a43074...` | `8e563f131571164a496cc6c9563104870baad5875b82643e7aebaf4d9f1593cd` | `ee4022f9c539052bf182ae1c2728d4bce1485af5b187b610f15d1fdab5dcfaaf` |

### 22.3 What was changed

**Audit rows** (1,134 rows of 14 types). The details changed in six rows only (`knownOperator` of
the reuse rows); the detail keys of every type are those of section 21.3, line for line.

| Type | Rows | What changed |
|---|---|---|
| `AUTH_FAILED` (token reuse) | 6 | Actor: none to the operator of the reused token. `knownOperator` false to true. Severity CRITICAL to WARNING. Message: the builder's |
| `AUTH_FAILED` (password) | 60 | Message: the builder's ("Sign-in failed: invalid credentials"; for the attempt that locks, "Sign-in failed; console locked for 60 s") |
| `AUTH_LOCKED` | 6 | Message: the builder's |
| `AUTH_SUCCESS` | 300 | Message: the builder's (it names the method) |
| `AUTH_SIGNED_OUT` | 96 | Message: the builder's |
| `AUTH_EXPIRED` | 84 | Message: the builder's (one text for an idle expiry, one for the 8 hours) |
| `BIOMETRIC_ENROLLMENT_CHANGED` | 51 | Message: the builder's |
| `PAIRING_SUCCESS` | 40 | Severity SUCCESS to INFO. Message: the builder's (it names the Core) |
| `PAIRING_FAILED` | 81 | Message: the builder's |
| `PAIRING_CODE_CLOSED` | 19 | Message: the builder's, one per close reason. Severity INFO to WARNING for the 7 exhausted codes |
| `DEVICE_CREDENTIAL_ROTATED` | 14 | Severity INFO to WARNING. Message: the builder's |
| `ACCESS_DENIED` | 120 | Message: the guard's ("role R lacks P (operation)"; "holds none of A, B" for the any-of) |
| `UPDATE_COMPLETED` | 2 | Severity SUCCESS to INFO (the simulator's) |
| `FAULT_RAISED` of an alert | 221 | Message: the text of its alert |
| `AUDIT_CHAIN_DISCONTINUITY` and the `FAULT_RAISED` row beside it | 17 and 17 | The two rows of an audit-tamper alert changed places: the discontinuity now stands at the instant of the alert, with its text and severity; the `FAULT_RAISED` row a second later (section 22.7) |

Six module-written types already had the builder's message and severity: `PAIRING_CODE_ISSUED`,
`PAIRING_LOCKED`, `DEVICE_REVOKED`, `UNPAIRED`, `EXPORT_DENIED`, `SCENARIO_LOADED`. The three
administration types (`ROLE_CHANGED`, `USER_DISABLED`, `USER_ENABLED`) keep the fixture's wording:
the module writes them inside its unit of work and has no builder; their severity is the module's.

After this, no audit row has the severity SUCCESS (42 had: 40 `PAIRING_SUCCESS`, 2
`UPDATE_COMPLETED`); no writer gives an audit row that severity. The severities are now INFO 4,272,
WARNING 500, CRITICAL 146. No minimum of §11 asks for a severity of audit rows; the events keep
all four.

**Events** (1,300 events of 18 types).

| Event type | Events | Parameters, severity and text at follow-up 1 | Now |
|---|---|---|---|
| `AUTH_LOGIN` | 300 | INFO | SUCCESS (the builder's) |
| `AUTH_LOGOUT` | 96 | `operatorId` | `operatorId, reason`; the builder's text |
| `AUTH_EXPIRED` | 84 | `operatorId, reason` | `operatorId`; the builder's text |
| `AUTH_FAILED` | 66 | `reason`; CRITICAL for the six reuses | `attemptsRemaining`; WARNING; the builder's text |
| `AUTH_LOCKED` | 6 | `lockedForMs` | `retryInMs`; the builder's text |
| `PAIRING_FAILED` | 81 | `codeId, attempt` | `attemptsRemaining`; the builder's text. The event names no code |
| `PAIRED` | 40 | `deviceId` | no parameter (the event carries the device in its own column); the builder's text, which names the Core |
| `UNPAIRED` | 20 | `deviceId`, for a revoke also `revoked`; INFO for an unpairing | no parameter; WARNING; the builder's two texts |
| `AUDIT_CHAIN_BROKEN` | 17 | `scope` | `index, seq`, the place the row beside it names; the text of the alert |
| `FAULT_RAISED` of an alert | 221 | a text of its own | the text of the alert |
| `DIAGNOSTICS_COMPLETED` | 10 | `runId, result` | `runId, pass, warn, fail` |
| `FINALIZATION_STARTED` | 82 | no parameter | `evidenceId` |
| `RECORDING_STOPPED` | 82 | no parameter | `sessionId, durationMs` |
| `MARKER_ADDED` | 141 | `index` | no parameter |
| `SNAPSHOT_TAKEN` | 8 | `index` | no parameter |
| `PRECHECK_BLOCKED` | 6 | no parameter; WARNING | `blocks`; CRITICAL |
| `RECOVERY_COMPLETED` | 19 | SUCCESS | INFO |
| `STORAGE_POLICY_CHANGED` | 4 | `retentionPolicy` | `retentionPolicy, retentionDays, autoArchive` |

`SCENARIO_LOADED` now always holds `reset` in its parameters, as the reset routine writes it; the
one event of the fixture is a reset, so its content did not change. The severities of the events
moved from INFO 1,462, SUCCESS 1,531, WARNING 445, CRITICAL 152 to INFO 1,171, SUCCESS 1,812,
WARNING 455, CRITICAL 152: all four are still there.

**Alerts and their rows.** The `alerts` table did not change. What changed is the row and the
event of each fault: they now carry the text of the alert, so an alert is found in the trail by
its kind, target, instant, text and severity, as the engine writes them in one step. For the
audit-tamper fault the row of the alert is the chain discontinuity.

### 22.4 The tables of the test

Printed by the test (`--reporter=verbose`, 17:29:42). The table of the detail keys is the
table of section 21.3, unchanged in every line.

**Severity per audit type.** "Builder": the severity the module's builder gives for the facts of
the fixture's rows. "Module source": the administration module, read from its source.
"Simulator": every severity the driven simulator gave that type.

| Type | Category | Severity from | Severity expected | Severity written (rows) |
|---|---|---|---|---|
| `AUTH_SUCCESS` | AUTH | builder | INFO | INFO x 300 |
| `AUTH_FAILED` | AUTH | builder | WARNING | WARNING x 66 |
| `AUTH_LOCKED` | AUTH | builder | WARNING | WARNING x 6 |
| `AUTH_SIGNED_OUT` | AUTH | builder | INFO | INFO x 96 |
| `AUTH_EXPIRED` | AUTH | builder | INFO | INFO x 84 |
| `SESSION_CREATED` | SESSION | simulator | INFO | INFO x 513 |
| `PRECHECK_PASSED` | SESSION | simulator | INFO | INFO x 507 |
| `PRECHECK_BLOCKED` | SESSION | simulator | WARNING | WARNING x 6 |
| `RECORDING_STARTED` | SESSION | simulator | INFO | INFO x 502 |
| `RECORDING_STOPPED` | SESSION | simulator | INFO | INFO x 488 |
| `SESSION_CANCELLED` | SESSION | simulator | INFO | INFO x 6 |
| `EVIDENCE_SEALED` | EVIDENCE | simulator | INFO | INFO x 488 |
| `SESSION_INCOMPLETE` | SESSION | simulator | WARNING | WARNING x 19 |
| `SUMMARY_ACKNOWLEDGED` | SESSION | simulator | INFO | INFO x 49 |
| `MARKER_ADDED` | SESSION | simulator | INFO | INFO x 141 |
| `NOTE_ADDED` | SESSION | simulator | INFO | INFO x 57 |
| `SNAPSHOT_TAKEN` | SESSION | simulator | INFO | INFO x 8 |
| `FRAME_HASH` | EVIDENCE | simulator | INFO | INFO x 142 |
| `WRITE_VERIFIED` | STORAGE | simulator | INFO | INFO x 101 |
| `TIMESTAMP_CONFIRMED` | SECURITY | simulator | INFO | INFO x 81 |
| `EVIDENCE_VERIFIED` | EVIDENCE | simulator | INFO | INFO x 84 |
| `EVIDENCE_VERIFY_FAILED` | EVIDENCE | simulator | CRITICAL | CRITICAL x 8 |
| `EVIDENCE_REVIEW_OPENED` | EVIDENCE | simulator | INFO | INFO x 27 |
| `EVIDENCE_EXPORTED` | EVIDENCE | simulator | INFO | INFO x 39 |
| `EXPORT_DENIED` | SECURITY | builder | WARNING | WARNING x 12 |
| `EVIDENCE_ARCHIVED` | EVIDENCE | simulator | INFO | INFO x 30 |
| `AUDIT_EXPORTED` | SECURITY | simulator | INFO | INFO x 20 |
| `FAULT_RAISED` | DEVICE | simulator | CRITICAL or WARNING | CRITICAL x 121; WARNING x 136 |
| `FAULT_CLEARED` | DEVICE | simulator | INFO | INFO x 238 |
| `RECOVERY_STARTED` | SYSTEM | simulator | INFO | INFO x 19 |
| `RECOVERY_COMPLETED` | SYSTEM | simulator | INFO | INFO x 19 |
| `AUDIT_CHAIN_DISCONTINUITY` | SECURITY | simulator | CRITICAL | CRITICAL x 17 |
| `PAIRING_SUCCESS` | PAIRING | builder | INFO | INFO x 40 |
| `PAIRING_FAILED` | PAIRING | builder | WARNING | WARNING x 81 |
| `PAIRING_LOCKED` | PAIRING | builder | WARNING | WARNING x 7 |
| `UNPAIRED` | PAIRING | builder | INFO | INFO x 10 |
| `TABLET_LINK_CHANGED` | DEVICE | simulator | INFO or WARNING | WARNING x 12; INFO x 12 |
| `DEVICE_COMMAND` | DEVICE | simulator | INFO | INFO x 20 |
| `DIAGNOSTICS_RUN` | DEVICE | simulator | INFO | INFO x 10 |
| `STORAGE_POLICY_CHANGED` | STORAGE | simulator | INFO | INFO x 4 |
| `UPDATE_STARTED` | SYSTEM | simulator | INFO | INFO x 2 |
| `UPDATE_COMPLETED` | SYSTEM | simulator | INFO | INFO x 2 |
| `SCENARIO_LOADED` | SYSTEM | builder | INFO | INFO x 1 |
| `SYSTEM_BOOT` | SYSTEM | simulator | INFO | INFO x 6 |
| `ACCESS_DENIED` | SECURITY | builder | WARNING | WARNING x 120 |
| `PAIRING_CODE_ISSUED` | PAIRING | builder | INFO | INFO x 60 |
| `PAIRING_CODE_CLOSED` | PAIRING | builder | INFO or WARNING | WARNING x 7; INFO x 12 |
| `DEVICE_REVOKED` | PAIRING | builder | WARNING | WARNING x 10 |
| `DEVICE_CREDENTIAL_ROTATED` | PAIRING | builder | WARNING | WARNING x 14 |
| `ROLE_CHANGED` | SECURITY | module source | INFO | INFO x 2 |
| `USER_ENABLED` | SECURITY | module source | INFO | INFO x 1 |
| `USER_DISABLED` | SECURITY | module source | WARNING | WARNING x 4 |
| `BIOMETRIC_ENROLLMENT_CHANGED` | AUTH | builder | INFO | INFO x 51 |

**Parameter keys and severity per event type.** MODULE: the event the module's builder gives
beside its audit row. SIMULATOR: every key set and severity the driven simulator gave that type.
The category is the one stored; the event of a fault takes the category of its kind.

| Event type | Category written | Written by | Keys expected [severity] | Keys written (events) [severity] |
|---|---|---|---|---|
| `AUDIT_CHAIN_BROKEN` | SECURITY | SIMULATOR | {index, seq} [CRITICAL] | {index, seq} x 17 [CRITICAL x 17] |
| `AUTH_EXPIRED` | AUTH | MODULE | {operatorId} [WARNING] | {operatorId} x 84 [WARNING x 84] |
| `AUTH_FAILED` | AUTH | MODULE | {attemptsRemaining} [WARNING] | {attemptsRemaining} x 66 [WARNING x 66] |
| `AUTH_LOCKED` | AUTH | MODULE | {retryInMs} [WARNING] | {retryInMs} x 6 [WARNING x 6] |
| `AUTH_LOGIN` | AUTH | MODULE | {method, operatorId} [SUCCESS] | {method, operatorId} x 300 [SUCCESS x 300] |
| `AUTH_LOGOUT` | AUTH | MODULE | {operatorId, reason} [INFO] | {operatorId, reason} x 96 [INFO x 96] |
| `DIAGNOSTICS_COMPLETED` | DEVICE | SIMULATOR | {fail, pass, runId, warn} [SUCCESS, WARNING] | {fail, pass, runId, warn} x 10 [SUCCESS x 10] |
| `DIAGNOSTICS_STARTED` | DEVICE | SIMULATOR | {runId} [INFO] | {runId} x 10 [INFO x 10] |
| `EVIDENCE_ARCHIVED` | EVIDENCE | SIMULATOR | {evidenceId} [INFO] | {evidenceId} x 30 [INFO x 30] |
| `EVIDENCE_EXPORTED` | EXPORT | SIMULATOR | {evidenceId, exportId} [INFO, SUCCESS] | {evidenceId, exportId} x 39 [SUCCESS x 39] |
| `EVIDENCE_REVIEW` | EVIDENCE | SIMULATOR | {evidenceId} [INFO] | {evidenceId} x 27 [INFO x 27] |
| `EVIDENCE_SEALED` | EVIDENCE | SIMULATOR | {evidenceId} [SUCCESS] | {evidenceId} x 488 [SUCCESS x 488] |
| `EVIDENCE_VERIFIED` | EVIDENCE | SIMULATOR | {evidenceId, failedTracks} [SUCCESS] | {evidenceId, failedTracks} x 84 [SUCCESS x 84] |
| `EVIDENCE_VERIFY_FAILED` | EVIDENCE | SIMULATOR | {evidenceId, failedTracks} [CRITICAL] | {evidenceId, failedTracks} x 8 [CRITICAL x 8] |
| `EXPORT_DENIED` | EXPORT | MODULE | {evidenceId, role} [WARNING] | {evidenceId, role} x 12 [WARNING x 12] |
| `FAULT_CLEARED` | DEVICE, SECURITY, STORAGE, SYSTEM, TIME | SIMULATOR | {kind, target} [SUCCESS] | {kind, target} x 238 [SUCCESS x 238] |
| `FAULT_RAISED` | DEVICE, SECURITY, STORAGE, SYSTEM, TIME | SIMULATOR | {kind} or {kind, target} [CRITICAL, WARNING] | {kind, target} x 238; {kind} x 19 [CRITICAL x 121; WARNING x 136] |
| `FINALIZATION_STARTED` | EVIDENCE | SIMULATOR | {evidenceId} [INFO] | {evidenceId} x 82 [INFO x 82] |
| `HEALTH_CHECK_OK` | SYSTEM | SIMULATOR | {(none)} [SUCCESS] | {(none)} x 6 [SUCCESS x 6] |
| `MARKER_ADDED` | SESSION | SIMULATOR | {(none)} [INFO] | {(none)} x 141 [INFO x 141] |
| `NOTE_ADDED` | SESSION | SIMULATOR | {(none)} [INFO] | {(none)} x 57 [INFO x 57] |
| `PAIRED` | NETWORK | MODULE | {(none)} [SUCCESS] | {(none)} x 40 [SUCCESS x 40] |
| `PAIRING_FAILED` | NETWORK | MODULE | {attemptsRemaining} [WARNING] | {attemptsRemaining} x 81 [WARNING x 81] |
| `PRECHECK_BLOCKED` | SESSION | SIMULATOR | {blocks} [CRITICAL] | {blocks} x 6 [CRITICAL x 6] |
| `PRECHECK_PASSED` | SESSION | SIMULATOR | {(none)} [SUCCESS] | {(none)} x 85 [SUCCESS x 85] |
| `PRECHECK_STARTED` | SESSION | SIMULATOR | {(none)} [INFO] | {(none)} x 85 [INFO x 85] |
| `RECORDING_STARTED` | SESSION | SIMULATOR | {(none)} or {sessionId} [SUCCESS] | {(none)} x 502 [SUCCESS x 502] |
| `RECORDING_STOPPED` | SESSION | SIMULATOR | {durationMs, sessionId} [INFO] | {durationMs, sessionId} x 82 [INFO x 82] |
| `RECOVERY_COMPLETED` | SYSTEM | SIMULATOR | {(none)} [INFO] | {(none)} x 19 [INFO x 19] |
| `RECOVERY_STARTED` | SYSTEM | SIMULATOR | {(none)} [WARNING] | {(none)} x 19 [WARNING x 19] |
| `SCENARIO_LOADED` | SYSTEM | MODULE | {reset, scenario} [INFO] | {reset, scenario} x 1 [INFO x 1] |
| `SESSION_CANCELLED` | SESSION | SIMULATOR | {(none)} [INFO] | {(none)} x 6 [INFO x 6] |
| `SESSION_CREATED` | SESSION | SIMULATOR | {(none)} [INFO] | {(none)} x 513 [INFO x 513] |
| `SESSION_INCOMPLETE` | SESSION | SIMULATOR | {(none)} [WARNING] | {(none)} x 19 [WARNING x 19] |
| `SNAPSHOT_TAKEN` | SESSION | SIMULATOR | {(none)} [INFO] | {(none)} x 8 [INFO x 8] |
| `STORAGE_POLICY_CHANGED` | STORAGE | SIMULATOR | {autoArchive, retentionDays, retentionPolicy} [INFO] | {autoArchive, retentionDays, retentionPolicy} x 4 [INFO x 4] |
| `SYSTEM_BOOT` | SYSTEM | SIMULATOR | {(none)} [INFO, WARNING] | {(none)} x 6 [INFO x 6] |
| `TABLET_CONNECTED` | NETWORK | SIMULATOR | {(none)} [SUCCESS] | {(none)} x 12 [SUCCESS x 12] |
| `TABLET_DISCONNECTED` | NETWORK | SIMULATOR | {(none)} [WARNING] | {(none)} x 12 [WARNING x 12] |
| `TIME_SYNC` | TIME | SIMULATOR | {source} [SUCCESS] | {source} x 6 [SUCCESS x 6] |
| `UNPAIRED` | NETWORK | MODULE | {(none)} [WARNING] | {(none)} x 20 [WARNING x 20] |
| `UPDATE_AVAILABLE` | SYSTEM | SIMULATOR | {version} [INFO] | {version} x 2 [INFO x 2] |
| `UPDATE_COMPLETED` | SYSTEM | SIMULATOR | {version} [SUCCESS] | {version} x 2 [SUCCESS x 2] |
| `UPDATE_STARTED` | SYSTEM | SIMULATOR | {version} [INFO] | {version} x 2 [INFO x 2] |

**Fault alerts and their rows.** "Row type" is the audit type of the row the engine writes when
it raises an alert of that kind. The last column is the reference: the alerts the driven simulator
raised, each with exactly one row and one event by the same rule.

| Kind | Severity | Row type | Fixture alerts | With exactly one row | With exactly one event | Simulator: alerts with one row and one event |
|---|---|---|---|---|---|---|
| `CAMERA_LOSS` | CRITICAL | FAULT_RAISED | 17 | 17 | 17 | 2 of 2 |
| `MIC_NO_SIGNAL` | WARNING | FAULT_RAISED | 23 | 23 | 23 | 1 of 1 |
| `MIC_CLIP` | WARNING | FAULT_RAISED | 23 | 23 | 23 | 3 of 3 |
| `STORAGE_LOW` | WARNING | FAULT_RAISED | 22 | 22 | 22 | 1 of 1 |
| `STORAGE_FULL` | CRITICAL | FAULT_RAISED | 17 | 17 | 17 | 2 of 2 |
| `GNSS_LOSS` | WARNING | FAULT_RAISED | 23 | 23 | 23 | 2 of 2 |
| `TAMPER` | WARNING | FAULT_RAISED | 22 | 22 | 22 | 1 of 1 |
| `FAN_STALL` | WARNING | FAULT_RAISED | 23 | 23 | 23 | 1 of 1 |
| `POWER_FAIL` | CRITICAL | FAULT_RAISED | 17 | 17 | 17 | 2 of 2 |
| `TPM_FAILURE` | CRITICAL | FAULT_RAISED | 17 | 17 | 17 | 1 of 1 |
| `SECURITY_FAULT` | CRITICAL | FAULT_RAISED | 17 | 17 | 17 | 1 of 1 |
| `AUDIT_TAMPER` | CRITICAL | AUDIT_CHAIN_DISCONTINUITY | 17 | 17 | 17 | 1 of 1 |

### 22.5 What did not change, and how that was established

A copy of the folder, taken at 17:07 before the first edit, is the fixture as it was after the
first follow-up: it gives the digest and the head recorded then. It was compared with the present
fixture, table by table (17:24; the copy is in the session scratchpad, nothing in the workspace was
changed for it):

```
== the fixture
baseline copy: digest 3d2e7fe247a44ec2a17242431c7fcff249df9207ce74c51b373d0475cc8dbcaa = the digest recorded after follow-up 1
baseline copy: head seq 5000 46382e11b16010879f2e3769cc9ff5de722919318bc2cad941c71c82f55f1b0b = the head recorded after follow-up 1
now:           digest e58f1ae233811851df5aa84ebfb085703ce2b3d423d950a58a019bdfa97f0415
now:           head seq 5000 26e251887c667e1ee20b74960c0335afa49859128fd9d1ea096d47d42f0f77cf
expectedCounts equal: true | added equal: true | updates equal: true
tables with identical rows: operators (9), operatorCredentials (9), pairingCodes (60), pairedDevices (40), deviceCredentials (40), authSessions (300), biometricTokens (83), sessionHistory (507), evidenceItems (502), evidenceTracks (2008), evidenceCustody (1192), exportRecords (59), activeSession (0), alerts (250), healthSnapshots (1508), auditChainHistory (25)
tables whose rows differ: auditLog (4918), events (3590)
audit_log 4918 rows: rows per type equal: true; rows per category equal: true
  rows with an actor 3270 -> 3276; with a session 3165 -> 3165; with evidence 893 -> 893; with a device 950 -> 950; distinct actors 12 -> 12
  rows where seq, id or at differ: 0
  rows whose type differs (the two rows of an audit-tamper alert changed places): AUDIT_CHAIN_DISCONTINUITY->FAULT_RAISED 17, FAULT_RAISED->AUDIT_CHAIN_DISCONTINUITY 17
  rows of an unchanged type whose severity differs: AUTH_FAILED CRITICAL->WARNING 6, DEVICE_CREDENTIAL_ROTATED INFO->WARNING 14, PAIRING_CODE_CLOSED INFO->WARNING 7, PAIRING_SUCCESS SUCCESS->INFO 40, UPDATE_COMPLETED SUCCESS->INFO 2
  rows whose actor differs: AUTH_FAILED none->set 6
  rows whose session, evidence or device differs: 0
  rows whose details differ: AUTH_FAILED 6
  rows whose message differs: ACCESS_DENIED 120, AUTH_EXPIRED 84, AUTH_FAILED 66, AUTH_LOCKED 6, AUTH_SIGNED_OUT 96, AUTH_SUCCESS 300, BIOMETRIC_ENROLLMENT_CHANGED 51, DEVICE_CREDENTIAL_ROTATED 14, FAULT_RAISED 221, PAIRING_CODE_CLOSED 19, PAIRING_FAILED 81, PAIRING_SUCCESS 40
  at in sequence order: 1 descent(s) (DN-1: one, after the reset marker); every at equal: true
events 3590 rows: rows per type equal: true; rows per category equal: true; per severity {"CRITICAL":152,"INFO":1462,"SUCCESS":1531,"WARNING":445} -> {"CRITICAL":152,"INFO":1171,"SUCCESS":1812,"WARNING":455}
  rows where seq, id or at differ: 0; rows whose type differs: AUDIT_CHAIN_BROKEN->FAULT_RAISED 17, FAULT_RAISED->AUDIT_CHAIN_BROKEN 17
  rows whose severity differs: AUTH_FAILED CRITICAL->WARNING 6, AUTH_LOGIN INFO->SUCCESS 300, PRECHECK_BLOCKED WARNING->CRITICAL 6, RECOVERY_COMPLETED SUCCESS->INFO 19, UNPAIRED INFO->WARNING 10
  rows whose parameters differ: AUTH_EXPIRED 84, AUTH_FAILED 66, AUTH_LOCKED 6, AUTH_LOGOUT 96, DIAGNOSTICS_COMPLETED 10, FINALIZATION_STARTED 82, MARKER_ADDED 141, PAIRED 40, PAIRING_FAILED 81, PRECHECK_BLOCKED 6, RECORDING_STOPPED 82, SNAPSHOT_TAKEN 8, STORAGE_POLICY_CHANGED 4, UNPAIRED 20
  rows whose message differs: AUTH_EXPIRED 84, AUTH_FAILED 66, AUTH_LOCKED 6, AUTH_LOGOUT 96, FAULT_RAISED 221, PAIRED 40, PAIRING_FAILED 81, UNPAIRED 20
  rows whose session or device differs:
audit_log per severity {"CRITICAL":152,"INFO":4251,"SUCCESS":42,"WARNING":473} -> {"CRITICAL":146,"INFO":4272,"WARNING":500}
```

The variant with a session in RECORDING: the same picture (16 tables identical, rows per type and
per category equal, no `seq`, `id` or `at` differs, one descent).

Why it holds by construction: no random stream draws one number more or fewer, no call that
records an activity was added, removed or moved, and each call keeps its instant. For an
audit-tamper alert the two calls keep their two instants and exchange what they record.

### 22.6 The extended test

`__tests__/audit-details.test.ts` now has 35 tests (18 before); `__tests__/audit-reference.ts`
holds the comparisons. Nothing expected is written down in either file; it comes from the code
that writes the rows.

| What | Held against |
|---|---|
| Severity of an audit row | A module's builder (17 types); the administration module, read from its source because it has no builder (3 types); the severities the driven simulator gave the type (33 types). The row of a raised fault, and its event, against the simulator's own table of the fault kinds (`FAULT_SEVERITY`), which the test first shows the simulator obeys; a link row against the severity the simulator gave that state |
| Category of an audit row and of an event | The shared maps (`AUDIT_TYPE_CATEGORY`; `eventCategory`, which gives the event of a fault the category of its kind): the rule the writers apply |
| Message of an audit row | The module's builder, where one exists (17 types) |
| An event a module writes | The builder's event beside the audit row: for every fixture row with a builder, that event must be in the fixture at the row's instant, equal in type, severity, text, parameters, device and session; and an event of a type only a module writes must belong to such a row. 10 event types, 706 events |
| Every other event | The simulator's events of its type: parameter keys, kinds of value, severity. 34 event types, 2,884 events |
| A fault alert | Exactly one row and exactly one event of its fault with the alert's kind, target, instant, text and severity. The rule is first shown on the simulator, for every alert it raised (all 12 kinds, 18 alerts, each with one row and one event; the audit-tamper alert with an `AUDIT_CHAIN_DISCONTINUITY` row and no `FAULT_RAISED` row at all), then asked of the fixture's 238 alerts; and the other way round, every row the engine writes for a fault belongs to exactly one alert |
| A refused token | The row of a reuse names the operator of the family that was revoked at that instant on that device, and the sessions it ended were that operator's; a stated reason means an actor; only a reuse says `sessionsEnded`; each of the six reasons of `TokenRefusalReason` gives the builder's row, and the name the fixture had (`BIOMETRIC_TOKEN_REUSE`) is refused |

The simulator is driven on four engines as before; the fourth now also runs diagnostics on a Core
with no fault, so that both severities of its event are seen. The events and the alerts of each
engine are collected with its rows: with the four seeded scenario states, 1,306 audit rows of 34
types, 632 events of 36 types and 18 alerts.

**The comparisons can fail.** Four more tests plant drift into copies of rows and events and
expect the finding: the severities as they were (module, administration, engine, a fault row with
the severity of another kind); a message that is not the builder's; events with the old
parameters, another severity, an event that is missing and one that no row accounts for; an alert
whose row has another text, stands a second later, or names another target. A source in which the
administration module no longer writes its three rows inline is refused with a message that says
what to do.

And on the real thing, without touching the workspace (M15): the fixture of the first follow-up,
from the copy in the scratchpad, against the same comparisons (17:23):

```
== the fixture after follow-up 1 (copy outside the workspace): digest 3d2e7fe247a44ec2..., 4918 audit rows, 3590 events, 250 alerts
  audit: allow-list            :    0 finding(s)
  audit: writer gate           :    0 finding(s)
  audit: module, details       :    0 finding(s)
  audit: module, severity      :   67 finding(s) in: AUTH_FAILED 6, DEVICE_CREDENTIAL_ROTATED 14, PAIRING_CODE_CLOSED 7, PAIRING_SUCCESS 40
  audit: module, message       :  877 finding(s) in: ACCESS_DENIED 120, AUTH_EXPIRED 84, AUTH_FAILED 66, AUTH_LOCKED 6, AUTH_SIGNED_OUT 96, AUTH_SUCCESS 300, BIOMETRIC_ENROLLMENT_CHANGED 51, DEVICE_CREDENTIAL_ROTATED 14, PAIRING_CODE_CLOSED 19, PAIRING_FAILED 81, PAIRING_SUCCESS 40
  audit: administration        :    0 finding(s)
  audit: simulator             :    2 finding(s) in: UPDATE_COMPLETED 2
  audit: severity of a fault   :    0 finding(s)
  events: beside a module row  :  693 finding(s) in: AUTH_EXPIRED 84, AUTH_FAILED 66, AUTH_LOCKED 6, AUTH_SIGNED_OUT 96, AUTH_SUCCESS 300, DEVICE_REVOKED 10, PAIRING_FAILED 81, PAIRING_SUCCESS 40, UNPAIRED 10
  events: engine, simulator    :  375 finding(s) in: AUDIT_CHAIN_BROKEN 17, DIAGNOSTICS_COMPLETED 10, FINALIZATION_STARTED 82, MARKER_ADDED 141, PRECHECK_BLOCKED 12, RECORDING_STOPPED 82, RECOVERY_COMPLETED 19, SNAPSHOT_TAKEN 8, STORAGE_POLICY_CHANGED 4
  events: severity of a fault  :    0 finding(s)
  alerts: one row, one event   :  476 finding(s) in: AUDIT_TAMPER 34, CAMERA_LOSS 34, FAN_STALL 46, GNSS_LOSS 46, MIC_CLIP 46, MIC_NO_SIGNAL 46, POWER_FAIL 34, SECURITY_FAULT 34, STORAGE_FULL 34, STORAGE_LOW 44, TAMPER 44, TPM_FAILURE 34
  fault alerts with exactly one row by kind, target, instant, text and severity: 0 of 238

== the fixture now (workspace): digest e58f1ae233811851..., 4918 audit rows, 3590 events, 250 alerts
  audit: allow-list            :    0 finding(s)
  audit: writer gate           :    0 finding(s)
  audit: module, details       :    0 finding(s)
  audit: module, severity      :    0 finding(s)
  audit: module, message       :    0 finding(s)
  audit: administration        :    0 finding(s)
  audit: simulator             :    0 finding(s)
  audit: severity of a fault   :    0 finding(s)
  events: beside a module row  :    0 finding(s)
  events: engine, simulator    :    0 finding(s)
  events: severity of a fault  :    0 finding(s)
  alerts: one row, one event   :    0 finding(s)
  fault alerts with exactly one row by kind, target, instant, text and severity: 238 of 238
```

In the lines of the events, a finding is named by the type of the audit row the event stands
beside.

### 22.7 Known limits of the fixture

The fixture is data for volume tests. It is not a replay of requests, and three things follow from
keeping its row counts fixed.

| Limit | What it means | What changing it would cost |
|---|---|---|
| A lock is not replayed across rows (finding F-17 of the first follow-up) | `attemptsRemaining`, `lockedUntil` and `retryInMs` have the form and the range the modules give them and agree with the instant of their own row. But a failed redeem, or a failed sign-in, that follows a lock within its 60 s is still written as a failure; a server would refuse it as locked. The counts toward a lock are those of one code, or of a group of eleven rows, not of a window of time | Some `PAIRING_FAILED` rows would become `PAIRING_LOCKED` rows, some `AUTH_FAILED` rows `AUTH_LOCKED` rows: the rows per type change, and with them the failed-attempt counts of the pairing codes |
| One `FAULT_RAISED` row and event beside each audit-tamper alert, a second after it | The engine writes no `FAULT_RAISED` for that fault: its row is the chain discontinuity. The fixture has had both rows since step 47 and keeps the extra one (17 rows, 17 events). It pairs with no alert, and the test names it | Without them `FAULT_RAISED` falls from 257 to 240 rows and the events from 3,649 to 3,632; the audit log would be padded with 17 more integrity rows on the sealed recordings, which moves the rows per category, per session and per device |
| One of the six reasons of a refused token | The fixture writes the reuse only. A token refused as revoked, expired, of another device, of a retired device or of a disabled operator has no row | Each needs a failed biometric sign-in on a device: new rows, or password failures given a device, which moves the rows with a device |

Two things are the fixture's own by decision, not by limit: the wording of the rows the engine
writes (the simulator is the reference for their keys, kinds and severities, not for their text),
and the names in an alert. An alert's target, and the device of its row, are hardware names of
the fixture (`CAM-01`, `HDD-EVIDENCE`); the simulator names a track or nothing as the target
(`VIDEO-01`, none) and the hardware as the device. Alert and row agree with each other, which is
what a reader of the trail needs; they are not the simulator's values.

### 22.8 Verification

The row command (17:35:44, outside the sandbox); the 31 lines of the minimums table are cut
and are, by `diff`, the lines of section 3:

```
> vitest run --project db src/db/fixtures
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_47c_tmdpfk8k_
[test:db] stale sweep: dropped 0; kept 6 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] bulk fixture: dems_test_step_47c_tmdpfk8k_tpl_bulk as dems_owner; clock 2026-10-01T03:00:00.000Z; seed 20261004
[test:db]   table                   minimum   loaded   added  met
  ... 30 lines, identical to section 3 ...
[test:db] bulk fixture: every minimum of the 30 tables is met; audit head seq 5000, hash 26e251887c667e1e...; digest e58f1ae233811851...; build 235 ms, write 1723 ms, total 1963 ms
 Test Files  1 passed (1)
      Tests  19 passed (19)
   Start at  17:35:44
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 147 ms; 0 remain with the run prefix dems_test_step_47c_tmdpfk8k_
```

The chain (from the verbose run of the folder, 17:23:15, and the whole run of 17:26:10):

```
[test:db] bulk fixture: verifyAuditChain over all 5000 stored audit rows: ok (head seq 5000, hash 26e251887c667e1e...)
```

The alerts row's own bulk test, from the whole run of 17:26:10 (it prints, it does not assert):

```
[w40] bulk template: 250 stored alerts, 100 listed (the ring); [...] of the 88 listed fault alerts of the fixture, 88 have a FAULT_RAISED row with the alert's kind, target, instant and text, 88 one with its kind and instant, 88 one with its kind at any instant; the stored trail holds 275 rows of type FAULT_RAISED or AUDIT_CHAIN_DISCONTINUITY (the fixture's own data, not raised by a server)
```

| Check | When | Result |
|---|---|---|
| `DEMS_TEST_STEP=47c npm run test:db -w @dems/core-server -- src/db/fixtures` | 17:23:15 (verbose); 17:35:44 | Exit 0 each time: 1 file, 19 tests; minimums table unchanged; 0 databases remain |
| `npm run test -w @dems/core-server -- src/db/fixtures --reporter=verbose` | 17:29:42 | Exit 0: 5 files, 138 tests (`audit-details` 35, `build` 42, `target` 41, `rng` 10, `static` 10) |
| Whole `unit`, `--maxWorkers=2` | 17:25:14; 17:33:14 | 140 files, 3,602 tests, 0 failed (17:25:14); 141 files, 3,604 tests, 0 failed (17:33:14) |
| Whole `db`, `--maxWorkers=2 --reporter=verbose` | 17:26:10 to 17:29:04 | 108 files, 1,540 tests passed, 1 skipped, 0 failed (17:26:10); 0 databases remain |
| Whole `db`, `--maxWorkers=2 --reporter=verbose` | 17:33:55 to 17:35:37 | 108 files, 1,540 tests passed, 1 skipped, 0 failed (17:33:55); 0 databases remain |
| The files on the bulk template, in the last whole run | | `db/fixtures/.../bulk-fixture.db.test.ts` 19; `modules/admin/.../bulk.db.test.ts` 2; `modules/evidence/.../bulk.db.test.ts` 14; `modules/sessions/.../history.db.test.ts` 13; `modules/pairing/.../registry.db.test.ts` 6; `modules/security-audit/.../bulk.db.test.ts` 15; `modules/alerts/.../alerts.db.test.ts` 20; `test/acceptance/restart.test.ts` 16: all passed |
| `npm run typecheck -w @dems/core-server` | 17:33 | Exit 0 |
| `npm run lint -w @dems/core-server` | 17:33 | Exit 0; no warning in the whole workspace package |
| `pg_database` as `dems_owner` on `127.0.0.1:4432` | 17:36 | 0 databases named `dems_test_step_47...`; the 12 test databases present belong to live runs of steps 64m and 75; three roles, no setting override |
| PostgreSQL | 17:36 | PID 19121, started 07:14:26, unchanged |

Work of other rows seen while this ran (P11): the typecheck was red at 17:11 and 17:13 in
`test/acceptance/restart.test.ts` (TS18048, lines 1105 and 1107), a file of another row, and
green again at 17:19. The one skipped test of the whole `db` runs is the demo row's own
(`src/modules/demo/__tests__/reset-failures.db.test.ts`, "PENDING (engine)"). Nothing else was red in the four whole-project runs. No
test of another row pins a severity, an event parameter or a text of the fixture: the tests on the
bulk template compare what the server answers with what is stored.

### 22.9 Deviations, findings and decisions of the second follow-up

| ID | Deviation | Why |
|---|---|---|
| DV-14 | The two rows, and the two events, of each audit-tamper alert changed places (34 rows and 34 events have another type at their sequence) | The alert must find its row at its own instant, and no `at` may change. The rows per type are equal |
| DV-15 | One engine type's severity changed that was not among the four reported: `UPDATE_COMPLETED`, SUCCESS to INFO (2 rows). No audit row has the severity SUCCESS any more | Item 2 asks for every row against its writer; the simulator gives that type INFO |
| DV-16 | The text of a module's event is the builder's too, not only its parameters and severity (8 event types) | The event is compared whole with the builder's, as the audit row is |
| DV-17 | The row and the event of a fault carry the text of their alert (221 rows, 221 events); the `alerts` table is untouched | Item 4: one text for the alert and its row, as the engine writes them |
| DV-18 | `padEvents` pads with the three events the engine writes while no session is active; the autosave event is no longer one of them | An autosave belongs to a recording and has other parameters. No event of the fixture comes from the padding today (the events are above their minimum) |
| DV-19 | The test reads the source of the administration module to learn the severity of its three rows | The module has no builder to call; a source that no longer has the form is refused, not guessed at |
| DV-20 | Rows with an actor: 3,270 to 3,276 | Item 1 (DN-9): the six reuse rows name their operator |

| ID | Finding | Evidence |
|---|---|---|
| F-19 | The biometric builders did not change after the first follow-up read them: `biometric/activity.ts` is of 15:57:47, `sign-in.ts` of 16:00:09 (`index.ts` and `tokens.ts` are of 16:28:11). The six reasons are `TOKEN_REUSE`, `USER_DISABLED`, `TOKEN_REVOKED`, `TOKEN_EXPIRED`, `OTHER_DEVICE`, `DEVICE_NOT_PAIRED`; `sessionsEnded` is written for a reuse only | File times at 17:05; `refusalOfToken` in `biometric/sign-in.ts` |
| F-20 | The drift of the events was wider than the eleven types named by reading: 1,300 events of 18 types | Section 22.5 |
| F-21 | Severity differed in 69 audit rows of 5 types (the 67 reported, and `UPDATE_COMPLETED`) | Section 22.6 |
| F-22 | The 17 `FAULT_RAISED` rows of kind `AUDIT_TAMPER`, and their 17 events, are rows no server writes; they are kept so that no count changes | Section 22.7; the test "a known limit" |
| F-23 | The alerts row's bulk test now prints 88 of 88 alerts with a row by kind, target, instant and text (0 of 88 before) | Section 22.8 |
| F-24 | An alert's target and the device of its row are the fixture's hardware names, not the simulator's track names; alert and row agree with each other | Section 22.7; `operations.ts`, `FAULT_DEVICE` |
| F-25 | The pairing of an audit row with its event is compared for the modules' types only. For the engine's types the fixture writes some events for one session in six (by design, for the spread of event types), where the engine writes them for every session | `recordings.ts`, `detailed` |
| F-26 | The administration module has no pure builder; its message and severity are inside the unit of work | `modules/admin/changes.ts` |
| F-27 | The structural round changed the import line of `load.ts` (from the seed to the store) at 17:13:51; `test/support` did not exist at 17:29. Neither was touched here | File times |
| F-28 | After this follow-up the audit log of the fixture has three severities, not four | Section 22.3 |

| ID | Question | Recommendation |
|---|---|---|
| DN-12 | DV-14 to DV-20 | Accept |
| DN-13 | F-22: keep the 17 extra `FAULT_RAISED` rows, or take them out and let the counts change (`FAULT_RAISED` 240, events 3,632, 17 more integrity rows) | Keep, unless a test needs "no `FAULT_RAISED` of kind `AUDIT_TAMPER`" on the bulk template. Taking them out is a change of three lines, and of the loaded counts in section 3 |
| DN-14 | F-24: should an alert of the fixture carry the simulator's own target, device and text for its kind? | Only if a test reads them. It changes the content of `alerts`, and the device of the 493 audit rows of its faults, not a count |
| DN-15 | Section 22.7, third limit: rows for the other five reasons of a refused token | Only with new rows; say how many |
| DN-16 | F-23 | Tell the alerts row that AC-B-71 can be asserted on the bulk template, not only printed |
| DN-17 | F-26 | A pure builder in the administration module would let the fixture's test compare message and severity as for every other module; until then the wording of those three rows is the fixture's |

### 22.10 Files, ledger, rollback

Edited: `identity.ts`, `operations.ts`, `recordings.ts`, `build.ts` (the rows and events they
record), `__tests__/audit-details.test.ts`, `__tests__/audit-reference.ts`. Not edited by this
follow-up: `load.ts` (its import line was changed by the structural round), `world.ts`, the other
tests, `static.test.ts` (no file was added). Nothing outside the folder and the two documents.
The scratch files (the copy of 17:07, four probes, three comparisons, run logs) are in the session
scratchpad.

| Project | Before the follow-up | After | This row's files |
|---|---|---|---|
| `unit` | 141 files, 3,587 tests (the whole run of 17:33:14 without the 17 new tests) | 141 files, 3,604 tests | 5 files, 138 tests: `audit-details.test.ts` **35** (18 before); `build` 42, `target` 41, `rng` 10, `static` 10 |
| `db` | 108 files, 1,541 tests (1 skipped: the demo row's own) | the same | `bulk-fixture.db.test.ts` 19, unchanged |

Rollback: the folder is untracked. The copy of 17:07 in the scratchpad is the state after the
first follow-up and gives its digest; it lives as long as the session does.

---
*Generated: 2026-10-04 11:50*
*Last Updated: 2026-10-04 17:40 (section 22, the second follow-up: severities, events, alerts)*
