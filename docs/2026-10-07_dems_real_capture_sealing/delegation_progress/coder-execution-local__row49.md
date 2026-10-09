# coder-execution-local — row 49 (M2-W4): mapping + seed + fixture v2

## Progress log (one line per step)

- STEP 0.1 pg:status was `stopped`; started project-local cluster via `npm run pg:start` -> PID 32505 on 127.0.0.1:4432; `pg:status: OK, running`.
- STEP 0.2 read-only owner probe (under db-migrate.lock, creds in-process, never printed): all four DBs intact v1 `(1,'dbc-2')`, 30 base tables, 0 v2 tables, journal=4. No corruption, no unexpected migration. Lock released.
- Read row 49 text, dbc-3 §B/§E.3/§G, C3 §2.4, artifacts 10/11/15, D36. Confirmed 15 new columns = active_session(+5) evidence_items(+3) evidence_tracks(+7).
- core-server typecheck baseline captured. My-scope errors: rows.ts x4 (new cols+signature), fixtures/operations.ts severity map, mapping/slices.ts + to-rows.test.ts (AudioSlice reshape). Remaining devices/permission-guard/rbac/evidence/acceptance errors owned by rows 52/54/50a/51a.

## Status: NEEDS-REVIEW (CS-18 complete + verified; CS-19 vocabulary proven; CS-20 fixture + SH-24 media gated on rows 51/52/53 + packages/shared)

## Throw-away DB verification (MT-2 + MT-7 seed) — ALL PASS, exit 0
- dems_test_capture_row49 created via allowTestDatabase seam, migrated to schema 2/dbc-3, seeded target:'test', dropped in finally. Post-run: dems% = four only; dems_test_% = 0.
- MT-7 seed: permissions=14, role_permissions=22 (INVESTIGATOR=5/SUPERVISOR=12/TECHNICIAN=5), capture_devices=5, capture_config=1, capture_device_credentials=0.
- MT-2: v1-shaped item stored manifest_version=1 (no rewrite); 4-track pos 1..4 + tamper AUDIO-02 accepted by kept CHECKs :353/:338.

## End-state safety
- Live dems_demo + lanes STILL v1-intact (re-probed after all work): (1,'dbc-2'), 30 tables, 0 v2, journal 4.
- pg:status: OK, running (LEFT RUNNING for rows 112/53).
- oMLX: DOWN before and after; never started; log untouched.
- 0 media added to git; nothing staged; scratch under git-ignored .cache/row49/.
- Tracked changes: only rows.ts, slices.ts, fixtures/operations.ts (+ this row's docs). No packages/shared, no migrations, no lockfile, no openapi.json, no SIM_SNAPSHOT_VERSION bump, no trackers.

## Gated / handed off (see artifact §6/§7)
- M2-MT-7 bulk-fixture §G minimums NOT met: v2 dataset is in packages/shared (forbidden); row 51 keeps sim items v1 by design; new-table fixture builders greenfield across rows 52/53.
- SH-24 v2 media NOT regenerated: generator default target is tracked; v2-ness gated on shared sim + row 52/53; oMLX only needed for audio fixture.
- Capture-config production seed wiring = row 52 (profile-code hyphen vs code() CHECK; KEPT-upsert carry CS-21).
- 9 stale mapping-test pins (slice counts, 12/18 grants) owned by row-47 consumer set + inventory regen.


## Mapping (CS-18) — DONE + verified
- `db/mapping/rows.ts`: filled the 15 new columns (evidence_items +3, evidence_tracks +7, active_session +5); narrowed signature algorithm on read-back to the sim literal + guard; restored transcriptSha256 + non-empty snapshots for round-trip stability.
- `db/fixtures/operations.ts`: FAULT_DEVICE severity map extended to 14 kinds (MIC_SILENT/CAPTURE_FAULT).
- `db/mapping/slices.ts`: classified the two new SimState slices (captureConfig/captureDevices) as server-native UNMAPPED (own tables; storage half = row 52), clearing the compile-proof.
- core-server typecheck: db source scope (mapping/seed/fixtures) = 0 errors. Total core-server TS errors 55 -> 49 (cleared exactly the 6 scoped errors). Remaining 49 all OUTSIDE db source scope: devices(24)/permission-guard(17)/rbac(2)/evidence(1)/engine(1)/acceptance(1)/db-mapping-tests(channels) — owned by rows 47/48/50a/52/54.
- mapping unit tests: baseline (my edits stashed) 25 FAILED -> with my edits 9 FAILED. Fixed 16, ZERO regressions. Remaining 9 = stale v1 count/slice pins from row 47 shared widening (row 45 §7.4 class), not mine.

