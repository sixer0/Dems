# coder-execution-local — row 54 (M2-W5): reset keep-set (11 tables, upsert) + real-evidence guard

## Progress log (one line per step)

- Inspected `git status --porcelain -- apps/core-server/src/db/reset`: 5 modified (cli/errors/index/kept-tables/routine) + new real-evidence.ts. Read all six; shape already coherent.
- Read row 54 text, dbc-3 §E.1/§E.2, artifact 12 (row 49), decisions D38-D40, test strategy M2-MT-5/MT-6. Confirmed 11 kept tables + upsert mode + DB+disk guard + op-75 refusal.
- Verified schema keys: capture_devices.id / capture_device_credentials.device_id / capture_config.singleton; evidence-store module (`../commands/evidence-store`) present and committed.
- Completed index.ts: re-exported the guard API (assertNoRealSealedEvidence et al.) so the server-side op-75/loadScenario caller can run the pre-flight refusal.
- Reconciled tests rippled by 8->11: kept-tables.test.ts (list/modes/FK-order/upsert), static.test.ts (production list += real-evidence.ts), cli.db.test.ts (kept summary line), reset.db.test.ts + modules/demo/reset.db.test.ts (comment eight->eleven).
- Added new tests: real-evidence.test.ts (unit two-sided fail-safe) and m2-guard-keepset.db.test.ts (M2-MT-5 + M2-MT-6 on throw-away).
- Typecheck: my files clean; remaining workspace errors are other rows' partials (rows 48/50/52 + RECON wave) — not touched.
- Ran targeted reset suite under `/usr/bin/lockf -k .locks/db-migrate.lock`, CI=true, --run, stdin closed, throw-away only. First pass surfaced 13 failures -> separated regressions from pre-existing by stashing edits and re-running baseline.
- Baseline (edits stashed) reproduced 2 failures identically => PRE-EXISTING (row 49 seed total 301!=307; "another schema version succeeded"). Not mine.
- Root-caused my regressions to a transient R-0 target connection breaking the W29 connection model + querying evidence_items before the schema check. Relocated the routine's authoritative guard into R-3 (read-only pass, after schema-version check, before R-4); server path keeps the earlier pre-flight refusal. Updated docstrings.
- Fixed my own upsert unit assertion (lineageAppended must be false when no lineage is involved).
- Re-ran targeted suite: row-54-owned files green — 119 passed (kept-tables, real-evidence, static, guard, cli unit + m2-guard-keepset db). Verbose MT-5/MT-6: 4 passed.
- Read-only live probe (creds in-process, never printed): dems_demo still (1,'dbc-2'), 30 base tables, 0 capture/stt tables. pg:status OK running PID 32505 on 127.0.0.1:4432. Temp probe script deleted.

## Status: COMPLETE — CS-21 (OD-19, RK-16, SEC35-22) closed; M2-MT-5 + M2-MT-6 PASS on throw-away

## Throw-away DB verification — ALL PASS
- M2-MT-6: DB REAL sealed row -> `resetDatabase` rejects `{RESET_BLOCKED_REAL_EVIDENCE, R-3, targetUntouched:true}`, audited (warn log w/ code + counts), no chain-discarded line, evidence_items md5 unchanged, no `_next`/`_prev` created. Disk-only REAL package (via readEvidenceStore seam) refuses too ("on disk without a database row"), demo items never block.
- M2-MT-5: planted 4 selector devices + discovered CAM-99 + its credential + selector; permitted reset -> report.kept {capture_devices:5, capture_device_credentials:1, capture_config:1}; three capture checksums equal before/after; CAM-99 + credential + selector(revision 3, updated_by OPR-002) survive = carried by upsert, not wiped.

## End-state safety
- Live dems_demo STILL v1 (re-probed after all work): (1,'dbc-2'), 30 tables, 0 v2-only tables. Running v1 lanes never named.
- Only 127.0.0.1:4432 used; host :5432 never contacted. No .data/pg.* value printed or staged.
- pg:status: OK, running (PID 32505) — LEFT RUNNING.
- Throw-away databases dropped by helper teardown (0 remain with run prefix).
- Tracked changes confined to apps/core-server/src/db/reset/** + one comment line in modules/demo/__tests__/reset.db.test.ts (+ this row's docs). No packages/shared, no apps/core-web/mobile/mock-core/release, no openapi.json, no lockfile, no controller trackers. No git push/remote; no sudo.

## Gated / handed off (see artifact §5/§7)
- Pre-existing failures left for the RECON wave (D38): cli.db first-build 301 vs 307 (row 49 seed total); reset-failures "another schema version" detection. Both reproduced on clean baseline; out of row 54 scope.
- Op-75 HTTP-layer 409 end-to-end assertion needs rows 52/53 (capture-config module + fencing); this row supplies the guard + exported refusal surface.
- Capture built-in seeding (UPDATE-by-key half of upsert) lands with rows 52/53; INSERT-of-unknown-row half proven here.
