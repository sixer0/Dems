# Row 114 — coder-execution-local (phase C, M2; R-8 seed + kept entry) — FINAL

## Status: COMPLETE
v2 seed writes the single `stt_config` row with the confirmed Q-STT-CFG item 11 default (enabled,
`cpu-local` per Q-D7 = a, endpoint null, model `ggml-large-v3-turbo`, `id`, labelling on, revision 1);
`kept-tables.ts` 11 -> 12 with mode `upsert`; the row is image-equal after a permitted `db:reset`.
Closes the R-8 seed/kept clause and the M2-STTCFG-DB reset clause for the producing row (2 runs).

## Steps (each reported as it happened)
1. Read row 114 + standing invariants, dbc-3 §B.13/§E.1/§E.3, specs R-8 AC-1 + Q-STT-CFG item list, artifacts 51/13/12; board read (no blocker; RECON-C web/mobile only).
2. Mapped the seams: `writeSeed` loop (two unmapped tables already ride there), `KEPT_TABLES`, `countAllTables`/`ALL_TABLES` (30 v1 names), test-support `contractChecksum`/`dumpTable`/`dumpKept` (keys derived from `KEPT_TABLES`).
3. Baseline captured BEFORE edits: `seed-order.test.ts` already RED (`expected 305 to be 299`); kept-tables + seed cli green.
4. Seed: `STT_CONFIG_SEED_DEFAULT` + `sttConfigSeedRow(at)` + the insert after `console_settings`; barrel re-exports; docs state the SD-8 rule.
5. Kept set: `stt_config` upsert/singleton as the twelfth (after `capture_config`, lineage last); eleven -> twelve in kept-tables/cli/index/routine docs.
6. Pins reconciled: kept-tables unit (names/modes/columns/upsert statement), reset `cli.db.test.ts` summary line, `seed-order.test.ts` (20 tables, 306 rows with the decomposition), two "eleven" titles.
7. New db test `m2-sttcfg-seed-kept.db.test.ts`: seed clause, kept clause, reset clause x2 (seeded row + op-91-shaped edited row).
8. Typecheck filtered to touched files: 0 errors. oxlint on this row's files: exit 0.
9. Unit run: 3 files / 62 tests PASS exit 0 (seed-order now green).
10. DB runs x2 under `/usr/bin/lockf -k .locks/db-migrate.lock`, each its own acquisition: `Tests 4 passed (4)`, exit 0 both; teardown `0 remain with the run prefix` twice.
11. Regression batches over the touched area: `m2-guard-keepset.db.test.ts` PASS with 12 tables; `reset.db.test.ts` (R-0..R-9) PASS; 9 failures attributed to stale v1 §9.4 pins (see below).
12. Read-only live probe before AND after: four project DBs still `(1,'dbc-2')`, 30 tables, no `stt_config`, journal 4, `strays_outside_four=[]`.
13. Secret-absent greps (seed + fixture sources, added lines, git index): 0 credential values; only pointer/comment/column-name text.
14. Artifact + this note written; lock released; PG left running.

## Gates (fresh, quotable)
- **M2-STTCFG-DB reset clause**: `[row114] reset 1 | kept stt_config=1 epoch 0 -> 1` / `reset 1 image-equal | checksum true dump true`; edited row: `reset 2 image-equal | checksum true dump true` — equality proven in the carried `to_jsonb` image AND independently in `t::text` dumps, twice per run.
- **kept = 12**: `[row114] kept set (12) | registry_counters, console_settings, pairing_codes, paired_devices, device_credentials, auth_sessions, biometric_tokens, capture_devices, capture_device_credentials, capture_config, stt_config, audit_chain_history`.
- **seed default, no secret**: stored row `{"enabled":true,"backend":"cpu-local","endpoint":null,"model":"ggml-large-v3-turbo","language":"id","diarization":true,"credential_kind":null,"credential_ref":null,"secret_bytes":null,"nonce_bytes":null,"revision":"1","updated_by":null}`.
- **2 runs**: `RUN 1 VITEST_EXIT=0`, `RUN 2 VITEST_EXIT=0`, `Test Files 1 passed (1) / Tests 4 passed (4)` each.
- **live untouched / throw-away dropped**: probe identical before and after; `teardown: dropped 2 database(s) ... 0 remain with the run prefix` (both runs); `pg:status: OK, running`, PID 32505 on `127.0.0.1:4432`.

## Anti-hang / anti-stuck
No `timeout` binary on this macOS host: reused the row-112 perl shim on `PATH`. Every long command ran
under `timeout … </dev/null`, `CI=true`, vitest `--run --maxWorkers=2`, TARGETED files only (never the
full suite), never watch mode, never stdin. The db-migrate lock was taken per command and released when
the command returned; no long-lived process was started.

## Pre-existing failures observed (NOT caused by this row)
9 failures across the touched area, all stale v1 §9.4 pins: every diff line is `"permissions": 12 -> 14`
or `"role_permissions": 18 -> 22` (the v2 vocabulary of dbc-3 §E.3, proven by row 49). `stt_config` has
**0 hits** in the failure output and the printed totals stayed `307 row(s) in 21 of 30 table(s)` — the
value row 54 §5 already recorded — because `countAllTables` iterates the fixed 30 v1 `ALL_TABLES` names.
`seed.db.test.ts`, `seed-clock.db.test.ts` and the pin source `test/support/seed.ts:62,64` are unmodified
in the working tree. Owned by the RECON wave / checkpoint 55. Not stashed: concurrent agents (RECON-C)
own uncommitted work in this tree, so attribution was made from the assertion diffs and `git status`,
not from a baseline stash.

## Boundary
Edited only `apps/core-server/src/db/{seed,reset}/**` (source + tests) and wrote only the two docs named
here. Did NOT touch `packages/shared/**` (`SIM_SNAPSHOT_VERSION` still 1), `apps/core-web`, `apps/mobile`,
`apps/mock-core`, `release/`, `openapi.json`, the lockfile, the migrations folder, or the controller
trackers (`status_tasks.md`, `delegation_progress_report.md`). No migration added. No commit, no remote,
no push, no sudo, no emoji; docs English. `.data/pg.*` never printed or staged; never connected as
`dems_admin`; project cluster `127.0.0.1:4432` only.

## Files
Artifact: `implementation/53_m2_stt_config_seed_kept.md` (Tier 3). Changed-file list in artifact §2.
Scratch: git-ignored `.cache/row114/` (run logs).
