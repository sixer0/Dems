# verifier-local - row 56a (M2 gate, SOFTWARE half) - progress

Task folder: docs/2026-10-07_dems_real_capture_sealing/
Artifact: gateway_check/07_m2_gate.md (Tier 1, software half only; device half = 56b, blocked on user AVD unlock)

## Constraints in force
- READ-ONLY on source/migrations/openapi; throw-away `dems_test_*` DBs only under `lockf -k .locks/db-migrate.lock`.
- NEVER migrate/reseed live dems_demo/lanes; never stop running lane Cores 4421-4423 / Vite 5176-5178; host :5432 untouched; leave PG running.
- Creds in-process, never printed. No git push / remote / sudo. No emoji. English.
- Capture SUMMARY counts only (grep totals); never paste verbose logs. Anti-hang: CI + --run + </dev/null (no `timeout` binary on this Mac; rely on tool timeout).

## Expected exception baseline (D44/D58, row 55, rows 66/67)
- db project (`test:db`): exactly 12 failures, all in `test/acceptance/contract.test.ts` (R4 route-walks). Row 67 closed CS-20 bulk-fixture + stale-pin #5.
- unit project: exactly 3 failures, MODG registry walks in sessions/evidence routes.test.ts.
- Everything else green at floor (SH-10/media-CODE/CS-20/openapi#5 landed via RECON-D/E/F).

## Running log (append one line per check)
- pg:status: OK, running (start).
- M2-QA-1 shared tsc EXIT=0; shared oxlint EXIT=0; core-server tsc EXIT=0; core-server oxlint EXIT=0. -> PASS
- M2-RG-SHARED: Test Files 72 passed (72); Tests 1875 passed (1875); EXIT=0 -> PASS (>= floor 71/1851)

(continued below as checks complete)
- M2-RG-WEB: Test Files 117 passed (117); Tests 1496 passed (1496); EXIT=0 -> PASS (>= floor 117/1495)
- M2-RG-MOB: Test Suites 1 failed/194; Tests 1 failed/1997; EXIT=1 -> REGRESSION. sim-adapters.test.ts:77 pins snapshot.version=1, got 2 (SH-10 bump not propagated to mobile pin). Outside itemised set.
- M2-RG-CSU: Test Files 2 failed/164; Tests 3 failed/4052; EXIT=1 -> known-exception (exactly the 3 MODG walks).
- M2-RG-CSD: Test Files 1 failed/126; Tests 12 failed/1848; EXIT=1; only contract.test.ts red (12 R4 verbatim); bulk-fixture.db green; teardown dropped 8, 0 remain -> known-exception.
- M2-QA-1 shared tsc/lint EXIT=0; core-server tsc/lint EXIT=0 -> PASS (in-scope).
- M2-RG-MOCK: 4 files/19 tests EXIT=0 -> PASS.
- M2-RG-OFF (api-openapi-scope): 24 tests EXIT=0; OPENAPI_DOCUMENT_VERSION='0.2.0' -> PASS. M2-API-2 PASS.
- M2-API-1/3 green-by-suite (contract.test.ts only the 12 route-walks red; registry count/drift/#5 + rbac.matrix boot green); OPENAPI_CORE_SERVER_DOCUMENT_VERSION='0.3.0'.
- M2-PIN-1 grep: 0 stale '0.2.1'; toHaveLength(75) only = frozen-base table (rbac-matrix:1056); dbc-2 only base-label/negative tests; '0.1.0' only device-app/health fixtures -> PASS.
- M2-SIM-1 five sim suites present, shared 72/1875 0 FAIL -> PASS. M2-SIM-2 git diff = 15 sim files all row-owned -> PASS.
- M2-MT-7 quoted: intervals 1150 / fragments 8676 / chunks 2109 / revisions 30 / jobs 3000; "every minimum of the 40 tables met". DB-1/2, MT-2..8, STTCFG-DB, CRD-1, AUD-1/2, DB-CHK-1 = green-by-suite (only contract.test.ts red in CSD; only sessions/evidence routes in CSU).
- M2-LANE-1 infra (READ-ONLY): four DBs (2,'dbc-3'); core_state+hardware_snapshot sim_schema_version=2; lane Cores :4421-4423 /health 200 ready.db/engine true (not restarted, uptime ~860s); Vite :5176-5178 200; paired_devices 1 per lane (dems_demo 3); ws.clients 0/0/1 = two locked AVDs (56b). blocked-until-redeem carried from row53/F2b (not re-fired to stay read-only). -> PASS.
- M2-RG-PG NOT re-run (out of brief suite set; cluster-touch risk); carried row 53 57/57.

## VERDICT
- 1 regression OUTSIDE itemised set: mobile sim-adapters.test.ts:77 snapshot.version pinned 1, got 2 (SH-10 bump not propagated to mobile pin). Resume assertions pass => stale test pin, not product defect. Breaks M2-RG-MOB exit-0.
- Everything else: PASS or inside itemised set (12 R4 route-walks + 3 MODG).
- SOFTWARE GATE: NOT PASS (one regression, 1-line fix). Device half 56b BLOCKED on user AVD unlock (emulator-5556/5558).
- Constraints honoured: read-only; throw-away dems_test_* only (0 leftover); live lanes/dems_demo never migrated/reseeded; lane Cores/Vite never restarted; host :5432 untouched; creds in-process never printed; no git/sudo.
