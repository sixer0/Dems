# database-specialist-local - row 46 (M2-W3 migrations 0004/0005 applied to throw-away + meta bump, tier 3)

Status: **COMPLETE**. Date: 2026-10-08. Session: database-specialist subagent (fallback slot), phase C milestone M2, blueprint rev 2.1; dependencies rows 45 (typed schema) and 47 (shared vocabulary) landed before start. This is the third attempt at row 46; the first two were cancelled by the user for appearing "stuck" (D29/D30/D31) - root cause diagnosed as `drizzle-kit generate` blocking on an interactive rename prompt. This run followed an anti-hang contract and did **not** re-run the generator; it validated and applied the already-emitted migration files non-interactively.

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/11_m2_migrations.md` (Tier 3) plus this note. No live database was migrated; no tracked file was created or edited beyond what the prior attempts left (this row verified and proved); no commit made.

## Anti-hang contract

Every command ran as `timeout <secs> <cmd> </dev/null` (stdin closed, hard wall-clock cap). Host has no
`timeout` binary, so a process-group-kill perl `timeout` shim was installed on PATH and self-tested (SIGTERM
then SIGKILL to the child group; verified exit 124 on a capped sleep, 0 otherwise). `db:create`/`db:migrate`
wrapped in `/usr/bin/lockf -k .locks/db-migrate.lock`. The interactive `db:generate` was never invoked. PG via
the project owner connection only, `127.0.0.1:4432`; credential values read in-process, never printed.

## Result summary

| Measure | Result |
|---|---|
| STEP A - static validation of 0004/0005/journal/snapshots/meta.ts vs dbc-3 §A/§B/§C/§D | **PASS** - SQL materially correct; 9 CREATE + all ALTERs + CHECK swaps + indexes + partial-unique + 25-key audit lists present; privilege matrix + SELECT-revoke + `SECURITY DEFINER` reveal fn + `schema_meta=(2,'dbc-3')` in 0005; SEC35-02 applied alternative (write-only API + single-module static rule + audited reveal, NOT revoke-EXECUTE-from-`dems_app`) documented and implemented |
| Journal / snapshot chain | coherent: idx 0..5 rising `when`; 0003.id->0004.prevId, 0004.id->0005.prevId |
| STEP D - regenerate/repair | **not needed / not run** (STEP A clean) |
| STEP B - live `dems_demo` + lanes still v1 | **PROVEN**: all four `(1,'dbc-2')`, 30 base tables, 0 v2 tables, journal 4; `strays_outside_four=[]`; no `DB_INTEGRITY` condition |
| M2-DB-2 fresh full set 0000..0005 on throw-away | **PASS** exit 0 (drizzle migrator as dems_owner, one transaction) |
| M2-DB-1 mechanics (MT-1) | **PASS** applied 6; `schema version after = 2 (dbc-3)`; second run no-op (MG-10); ledger current 6/6 pending=0 problems=0 |
| M2-MT-4 privileges + credential reveal | **PASS**: `SELECT capture_device_credentials` -> 42501; `dems_capture_credential_reveal('CAM-99')` returns 1 row (SECURITY DEFINER reads what dems_app cannot); unknown device -> no row; UPDATE INSERT-only -> 42501; UPDATE new sealed column -> 42501; table+column privilege matrix equals §D |
| Live CHECK/index firing | **PASS**: sealing progress, fragments track, second-open-interval (23505), open-check (23514) all rejected |
| Catalog text (`pg_get_constraintdef`) | **PASS**: 3 FAULT_KIND sites 14 kinds; signature_value per-algorithm byte counts; hashes-only split; sources REAL; `:353` unchanged; audit keys 25; `stt_config` absent |
| meta.ts bump proof | `DB_SCHEMA_VERSION = 2` (`meta.ts:17`), `DB_CONTRACT_REVISION = 'dbc-3'` (`meta.ts:19`) |
| B16 code-side fix (iii) | present: `migrate.ts:57/:59`, `seed/cli.ts:77/:79` (neutral "note" wording; rule unchanged) |
| Throw-away drop + end state | **PASS**: DB dropped; `pg_database LIKE 'dems%'` = only the four (verified before and after STEP C) |

## How STEP C was run non-interactively (key mechanic)

The CLI refuses any non-closed-list database name and `allowTestDatabase` is never settable from argv/env
(`database-names.ts:35-52`, `cli.ts:120-125`), so a raw `db:create --database dems_m2test` would error. The driver
imported the production command functions `runCreate`/`runMigrate` and passed the sanctioned test seam
`{ allowTestDatabase: true }` on `dems_test_capture_m2` (matches `^dems_test_[a-z0-9_]+$`), exercising the exact
same drizzle migrator as `dems_owner`. Scratch drivers live in git-ignored `.cache/row46/` (not relied upon from
prior attempts). A pre-clean + `finally` drop guarantees the throw-away is never left behind.

## Verification nuance (honest boundary)

- **M2-DB-1 "throw-away copy of `dems_demo`" data-bearing clause (dbc-3 §G MT-2)**: executed via the FRESH
  full-set path this brief prescribed (create + migrate 0000..0005), proving every MT-1 mechanic except cloning
  seeded v1 rows. The clone path was **not** run because it needs exclusive/FORCE access to the live `dems_demo`
  (forbidden to disturb). Closed by construction: all 0004 changes are additive/relaxing, kept value-set CHECKs
  (`:353`/`:338`) unchanged, `signature_value_check` `{32}` accepts the v1 64-hex SIMULATED form, sources/fault-kind
  lists only grew. Recorded as an optional gate-row follow-up in the artifact §6/§7.
- One self-inflicted, non-schema failure aborted the first STEP-C attempt (a synthetic `key_ref` used a hyphen and
  was correctly rejected by `capture_device_credentials_key_ref_check`). The `finally`-drop cleaned it up; the
  corrected run is `ALL PASS` exit 0. No schema or SQL was at fault.

## Protected sets (untouched, confirmed by `git status --porcelain`)

`packages/shared/**` (row 47), row-45 schema files (`checks.ts`,`evidence.ts`,`index.ts`,`sessions.ts`,
`value-sets.ts`,`capture.ts`,`recording.ts`,`transcript.ts`), `apps/mock-core`, `release`, controller trackers.
No git remote/push, no sudo, no `.data/pg.*` printed/staged, no `dems_admin` after provisioning. Tracked tree is
byte-for-byte the prior attempts' artifact set; this row added no tracked changes.

## Files

Created: `implementation/11_m2_migrations.md`, this note.
Read-only scratch (git-ignored): `.cache/row46/probe_live.mts`, `.cache/row46/verify.mts`.
