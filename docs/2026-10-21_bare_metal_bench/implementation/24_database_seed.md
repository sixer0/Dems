# Row 44: create, migrate, seed, status of dems_demo (Block K, Block O)

Date: 2026-10-22, host .73 (D30).
- Block K (first step): `/home/gsp-dems/dems-install-backup-20261022-2155` gsp-dems 700: core.env, data_without_signer.tar.gz, SHA256SUMS; `signer_members=0`; `sums_ok` (no database yet, so no dump).
- Block O (generator of row 41 pasted): create - `created dems_demo (owner dems_owner, encoding UTF8, locale C) on PostgreSQL 18.6`; migrate - 34 migrations, `schema version after: 15 (dbc-16)`; seed - 312 rows in 24 of 48 tables, audit head seq 82, v2 demo packages NOT generated (SIMULATED operation, named skip); status - `OK: dems_demo is at the schema version this code expects and the ledger matches the files`. Block exit 0.
- Verify: `owner_file_absent`; owner password NULL `t`; public tables not owned by dems_owner `0`; `DB_SCHEMA_VERSION = 15`; journal entries `34`; migration files `34`; session_history `13`, active_session `0` (for rows 52, 53); `ALTER ROLE` in server log `0`. Block E: docker_du_equal, backup_ok.
