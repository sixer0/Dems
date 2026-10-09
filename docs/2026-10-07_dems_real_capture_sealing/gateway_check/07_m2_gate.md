---
task_id: row 56a (SOFTWARE half of the M2 milestone gate)
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: verifier-local
source_plan: docs/2026-10-07_dems_real_capture_sealing/masterplan/02_plan.md (section D)
tier: 1
status: regression-found (1 regression outside the itemised set; M2-RG-MOB stale pin)
---

# Row 56a - M2 milestone gate: SOFTWARE half (task 3, phase C)

> This artifact covers the **software (non-device) half** of the M2 gate. The **device half is row 56b**
> (kill-matrix UAT), which is **blocked** on a user action: `emulator-5556` (`dems2_tablet`) and
> `emulator-5558` (`dems2_phone`) are PIN-locked and agents must not touch device locks
> (user runs `apps/mobile/scripts/emulator-user-lock.sh unlock`). **The M2 gate cannot be signed off
> until 56b runs.** This row does NOT run the device kill-matrix.

| Field | Value |
|---|---|
| Blueprint row | 56 - `[M2\|gate]`, independent +1 verification of all M2 checks (plan section D) |
| Scope of 56a | Non-device M2 checks only (56b owns device UAT) |
| Verifier | `verifier-local` (this session); sole db-runner for throw-away checks |
| Mode | READ-ONLY on source/migrations/openapi; throw-away `dems_test_*` databases only under `/usr/bin/lockf -k .locks/db-migrate.lock`; live `dems_demo`/lanes never migrated/reseeded; running lane Cores 4421-4423 + Vite 5176-5178 never restarted; host :5432 untouched; PG left running; creds in-process never printed; no git push; no sudo |
| Diff basis | working tree at HEAD `main` (post RECON-F2b, per D58); no commit made by this verifier |
| Sources read | identification/02_structured.md rev 2.1 row 56; gateway_check/15_m2_code_review.md (row 55); implementation/66_recon_core_tests.md; implementation/67_recon_cs20_pins.md; decisions D44/D48/D52-D58 |

## Known itemised exception set (from D44/D58 + row 55 + rows 66/67)

The ONLY acceptable non-green results at the M2 software floor are these, all genuine later-milestone
handler/route walks (M4/M5/M6/M7/M8), left failing (NOT skipped, NOT weakened), each owned by its
producing milestone:

- **12** failures in `apps/core-server/test/acceptance/contract.test.ts` (R4 route-walk set; the db project).
  These were 14 at row 66; row 67 (RECON-D) closed the CS-20 `bulk-fixture.db` failure (now green) and
  re-pinned the stale-pin deferral #5 (now green), leaving exactly 12.
- **3** failures in `apps/core-server/src/modules/{sessions,evidence}/__tests__/routes.test.ts` (MODG registry
  walks needing ops 81 switchAudioSource [M5], 82 listAudioSourceIntervals [M5/M7], 83 getSealingProgress
  [M7], 84-88 transcript/evidence [M6-M8]) (the unit project).

Row 55 findings F1 (SH-10 snapshot bump), F2/F3 (CS-20 minimums + openapi pin), and the media-CODE erratum
have since LANDED via RECON-D/E/F (D53-D57), so `M2-MT-7`, `SH-10`, openapi `#5`, and the media `CODE` are
expected GREEN here, not exceptions. Device kill-matrix UAT is out of scope here (56b).

Any failure OUTSIDE this set is a REGRESSION and is flagged prominently below.

## Result log (appended per check)

| Check | Expected | Result (evidence) | Status |
|---|---|---|---|
| M2-QA-1 (shared tsc) | exit 0 | `tsc --noEmit -w @dems/shared` EXIT=0 | PASS |
| M2-QA-1 (shared lint) | exit 0 | `oxlint -w @dems/shared` EXIT=0 | PASS |
| M2-QA-1 (core-server tsc) | exit 0 | `tsc --noEmit -w @dems/core-server` EXIT=0 | PASS |
| M2-QA-1 (core-server lint) | exit 0 | `oxlint -w @dems/core-server` EXIT=0 | PASS |
| M2-RG-SHARED | exit 0, >= 71 files / 1851 tests (expect ~1875) | `Test Files 72 passed (72)`; `Tests 1875 passed (1875)`; EXIT=0 | PASS (above floor) |
| M2-RG-WEB | exit 0, >= 117 files / 1495 tests | `Test Files 117 passed (117)`; `Tests 1496 passed (1496)`; EXIT=0 | PASS (above floor) |
| M2-RG-MOB | exit 0, >= 192 suites / 1988 tests | `Test Suites: 1 failed, 193 passed, 194`; `Tests: 1 failed, 1996 passed, 1997`; EXIT=1. Single failure `src/runtime/sim-adapters.test.ts:77` `expect(snapshot?.version).toBe(1)` -> Received 2. Root cause: SH-10 `SIM_SNAPSHOT_VERSION` 1->2 (RECON-F2a) landed in shared/core-server but this mobile consumer pin was not propagated. Resume assertions (lines 91-93) pass -> behaviour correct, pin stale. NOT in the itemised set | **REGRESSION** (test-side stale pin; owner RECON-F2a / mobile rows 68/87) |
| M2-RG-CSU (core-server unit) | exit non-0 permitted ONLY for the 3 named MODG deferrals; >= 160 files / 3954 tests | `Test Files 2 failed \| 162 passed (164)`; `Tests 3 failed \| 4049 passed (4052)`; EXIT=1. The 3 = exactly the MODG registry walks: `evidence/routes.test.ts` "the area of the registry is these five..."; `sessions/routes.test.ts` "registers operations 24 to 38 ... nothing else"; `sessions/routes.test.ts` "the tag Session ... eleven entries". No other failure | known-exception (3 MODG, itemised) |
| M2-RG-CSD (core-server db, throw-away under lockf) | exit non-0 permitted ONLY for the 12 named R4 route-walks; >= 124 files / 1751 tests; 0 leftover test DBs | `Test Files 1 failed \| 125 passed (126)`; `Tests 12 failed \| 1836 passed (1848)`; EXIT=1. ONLY failing file = `test/acceptance/contract.test.ts`; its 12 titles match the itemised set verbatim (AC-B-09 router/guard, AC-B-10 area 4 + area 5, AC-B-14 401/403/404-405/DEMO-NOT_PERMITTED, SR-20 every-GET, AC-B-93 free-text, SC6 headers/error-codes/coverage). Stale-pin #5 (committed openapi) NOT in failures (now green); `bulk-fixture.db.test.ts` green. Teardown `dropped 8 database(s); 0 remain` | known-exception (12 R4, itemised) |
| M2-RG-MOCK | exit 0, mock-core 4 files / 19 tests | `Test Files 4 passed (4)`; `Tests 19 passed (19)`; EXIT=0 | PASS |
| M2-RG-OFF (offline contract lane) | shared `api-openapi-scope` exit 0; offline doc `0.2.0`, `OPENAPI_DOCUMENT_VERSION='0.2.0'` | targeted run `Test Files 1 passed (1)`; `Tests 24 passed (24)`; EXIT=0 | PASS |
| M2-RG-LIVE (live acceptance contract lane) | core-server `contract.test.ts` routed-operation walks green; only the 12 unrouted-route deferrals red | Same run as M2-RG-CSD: registry==document drift / counts / committed-openapi #5 pass; only the 12 R4 route-walks red | known-exception (the 12 R4 deferrals) |
| M2-DB-1 (MT-1 throw-away v1 copy) | `db:migrate` 0004/0005 exit 0 on clone; ledger current; `schema_meta=(2,'dbc-3')`; 2nd run no-op | executes in CSD `commands.db`/`migrate.db` - that file is green (not among the failing file = only contract.test.ts). `schema_meta` `(2,'dbc-3')` independently confirmed by live read-only probe on all four DBs | PASS (green-by-suite) |
| M2-DB-2 (MT-1 fresh lane 0000..0005) | full set applies to a fresh lane, exit 0 | executes in CSD `migrate.db` - green | PASS (green-by-suite) |
| M2-MT-2 (copy-migration, v1 items keep manifest_version=1) | no data rewrite | CSD mapping/constraints/catalog files green | PASS (green-by-suite) |
| M2-MT-3 (three FAULT_KIND CHECKs accept 14 kinds; 15th rejected) | insert + reject | CSD `constraints.db` (216 tests) green | PASS (green-by-suite) |
| M2-MT-4 (privileges matrix == dbc-3 §D; credential SELECT fails 42501 for dems_app; UPDATE-on-INSERT-only fails) | §D matrix + 42501 | CSD `privileges.db` (13 tests) green | PASS (green-by-suite) |
| M2-MT-5 (reset keeps kept set image-equal; others == v2 seed; epoch+1) | kept set == 12 | CSD reset/demo-reset files green | PASS (green-by-suite) |
| M2-MT-6 (reset guard RESET_BLOCKED_REAL_EVIDENCE; DEMO_PACKAGE never blocks) | guard refuses | CSD `reset.db`/guard files green | PASS (green-by-suite) |
| M2-MT-7 (seed 14/22/1/5/0 + dbc-3 §G bulk minimums) | §G table holds; CS-20 closed | Quoted from CSD loader: `session_audio_intervals 720/1150 yes`; `recording_fragments 6500/8676 yes`; `transcript_chunks 2000/2109 yes`; `transcript_revisions 30/30 yes`; `sealing_jobs 3000/3000 yes`; `bulk fixture: every minimum of the 40 tables is met; digest defda57ead6ece8a...`. `bulk-fixture.db` 25/25 green | PASS (quoted) |
| M2-MT-8 (catalog text == 14-kind shared constant; CL-12) | equality pin | CSD `catalog.db`/`constraints.db` green | PASS (green-by-suite) |
| M2-API-1 (OpenAPI drift @ 0.3.0, 89 ops 34 GET/55 POST; registry==document; openapi regenerated) | drift green; #5 re-pinned | Inside `contract.test.ts`: registry-count/drift/#5 pass (only the 12 route-walks fail). Constants confirmed `OPENAPI_CORE_SERVER_DOCUMENT_VERSION='0.3.0'` | PASS (green-by-suite) |
| M2-API-2 (offline scope 0.2.0; 23 simulated ops; live-only op excluded) | scope green | See M2-RG-OFF (24 tests EXIT=0); `OPENAPI_DOCUMENT_VERSION='0.2.0'` | PASS |
| M2-API-3 (rbac.matrix boot, D88 equality on new permission rows) | boot green | CSD `rbac-matrix.test.ts` + `matrix.db` green | PASS (green-by-suite) |
| M2-PIN-1 (stale-pin sweep over section-C list) | grep `75`/`28`/`dbc-2`/`0.1.0`/`0.2.1` = 0 stale | Grep `.ts/.tsx`: `'0.2.1'` 0 hits; OpenAPI consts `0.3.0`/`0.2.0` correct; `toHaveLength(75)` only at `rbac-matrix.test.ts:1056` = frozen task-2 **base** table (base 75 + delta 14 = 89, per rows 66/67); `dbc-2` only in base-label comment + negative/before-state test injections (`boot-checks.db:116`, `constraints.db:167`, `contract-inventory.test.ts:246`, `schema/index.ts:31` comment); `'0.1.0'` only as device-app/health/launcher version fixtures | PASS |
| M2-SIM-1 (sim suites determinism/isolation/demo-data-alignment/gap-closure/selector-stability + mock-core) | green | All five files present in `packages/shared/test/`; shared project 72/72 files, 1875 tests EXIT=0 (0 FAIL); mock-core 4/19 EXIT=0 | PASS |
| M2-SIM-2 (sim diff since c2c983b lists only row-owned files) | only blueprint-row files | `git diff --name-only c2c983b -- packages/shared/src/sim/` = 15 files (api/audio/auth/constants/evidence/faults/health/index/initial-state/react/selectors/session-machine/store/types/vocabulary), all sim modules owned by rows 47/48/51/51a/F | PASS |
| M2-AUD-1 (9 new audit types 53->62, exact key lists, 0 secret keys; codes 31->40; forbidden-key 17->25) | green | CSD/CSU `audit-details`/vocabulary + contract-inventory green (only sessions/evidence route MODG walks red elsewhere) | PASS (green-by-suite) |
| M2-AUD-2 (camera-credential refusals audited; DEVICE_CREDENTIAL_REQUIRED writes no row) | green (M2 half) | CSD/CSU credential-refusal + audit-rule tests green | PASS (green-by-suite; full behaviour M5/M8) |
| M2-CRD-1 (credential write-only; CAPTURE_CREDENTIAL_SET carries device id only; no credential returned/logged) | green | CSD `privileges.db` (MT-4 carve-out) + unit API-contract tests green | PASS (green-by-suite) |
| M2-STTCFG-DB (`stt_config` kept singleton image-equal after reset; secret SELECT fails 42501 for dems_app; loopback CHECK; seed default) | green | CSD stt_config tests in `privileges.db`/`constraints.db`/`catalog.db`/`reset` green; row 114 seeded value present (probe saw stt_config row) | PASS (green-by-suite) |
| M2-DB-CHK-1 (signature CHECK: Ed25519+128hex+simulated=false AND SIMULATED-SHA256+64hex accepted; mismatches rejected) | green | CSD `constraints.db` signature probes green (part of the 216-test file) | PASS (green-by-suite) |
| M2-QA-1 (typecheck + lint) [brief scope: shared + core-server] | exit 0 | shared tsc/lint EXIT=0; core-server tsc/lint EXIT=0. (Root 7-workspace typecheck/lint and `test:pg-scripts` M2-RG-PG not re-run here - see note.) | PASS (in-scope workspaces) |
| M2-RG-PG (pg-scripts >= 57) | not run in 56a | Excluded from this gate's software suite set (brief did not list it); running `scripts/pg/*` tests risks touching the host cluster vs the read-only mandate. Carried green from row 53 (57/57, D49) | NOT RE-RUN (scope; carried from row 53) |

## M2-LANE-1 infrastructure clause (read-only probe - nothing restarted, live DBs untouched)

Facts read directly at this gate (SELECT-only via the owner seam; creds in-process, not printed; `db:status` and `/health`/`/` are GET-only):

| Lane fact | Expected | Observed | Status |
|---|---|---|---|
| Four DBs at `(2,'dbc-3')` | schema 2 / dbc-3 | probe: all four `{schema_version:2, contract_revision:'dbc-3'}`; `db:status` EXIT=0 each ("schema version this code expects and the ledger matches the files") | PASS |
| `sim_schema_version=2` | 2 | `core_state.sim_schema_version=2` AND `hardware_snapshot.sim_schema_version=2` on all four | PASS |
| Lane Cores 4421-4423 ready.db/engine true | ready:true/true | `/api/v1/health` HTTP 200, `status:ok`, `ready:{database:true,engine:true}`; uptime ~860s (running instances, not restarted by me) | PASS |
| Vite 5176-5178 | HTTP 200 | `/` -> 200 / 200 / 200 | PASS |
| One device paired per lane | 1 each | `paired_devices WHERE state='PAIRED'`: lane_1=1, lane_2=1, lane_3=1 (dems_demo=3, shared demo DB, not a lane) | PASS |
| blocked-until-redeem | recording refused until redeem | Demonstrated live at row 53 and re-proven by RECON-F2b/D58 on lane 3. NOT re-fired here: firing a start-recording would mutate live lane session state, which the read-only constraint forbids | PASS (carried; not re-fired to stay read-only) |
| ws.clients per lane | device-connected demo | 4421=0, 4422=0, 4423=1 - the two zero-client lanes correspond to the PIN-locked AVDs (emulator-5556/5558). Core/API boot + DB pairing are proven; the connected-device demo is the device half (56b) | consistent with 56b blockage (D57) |

## Regression statement

**There is exactly ONE failure outside the itemised exception set:**

- `@dems/mobile` `src/runtime/sim-adapters.test.ts:77` asserts the persisted snapshot `version === 1`, but the snapshot is now written at `version === 2`. Root cause: the SH-10 `SIM_SNAPSHOT_VERSION` 1->2 atomic bump (RECON-F2a, D56/D57) landed in `packages/shared` and `apps/core-server` and their test pins were re-pointed, but this single **mobile consumer pin was not propagated**. The rest of the test passes (the session resumes correctly at lines 91-93), so this is a **stale test-side assertion, not a product-behaviour defect**. It breaks the `M2-RG-MOB` exit-0 floor. Owner: RECON-F2a / mobile rows 68/87. Fix: change the expectation at `sim-adapters.test.ts:77` from `1` to `2` (matching the now-canonical snapshot version), then re-run `M2-RG-MOB` to exit 0.

No other failures exist outside the itemised 12 R4 route-walks + 3 MODG deferrals. `@dems/shared` (72/1875), `@dems/core-web` (117/1496), `@dems/mock-core` (4/19), core-server tsc/lint, shared tsc/lint, the offline scope lane, the full db project (except the 12), and the whole M2-LANE-1 infra clause are green.

## Software-gate verdict

**M2 SOFTWARE GATE: NOT PASS (ONE REGRESSION).** 32 of 33 software checks are PASS or fall inside the sanctioned itemised exception set (12 R4 route-walks + 3 MODG later-milestone deferrals). The one blocker is a single stale mobile test pin (`sim-adapters.test.ts:77`, snapshot version 1 vs 2) left by the SH-10 landing - a one-line test fix, no production defect. Re-pin it and `M2-RG-MOB` returns exit 0, at which point the software half is clean.

**Device half pending row 56b.** The kill-matrix / device-connected UAT was NOT run here: emulator-5556 (`dems2_tablet`) and emulator-5558 (`dems2_phone`) are PIN-locked and agents must not touch device locks - the user must run `apps/mobile/scripts/emulator-user-lock.sh unlock`. The M2 gate cannot be signed off until 56b runs.

Net: even ignoring the device half, the software half is currently blocked by exactly one mobile test-pin regression. Recommended path: (1) reconcile `sim-adapters.test.ts:77` to snapshot version 2 (mobile owner), re-run `M2-RG-MOB`; (2) then this gate's software half is clean; (3) user unlocks the two AVDs and row 56b runs the device kill-matrix (+1).

*Generated: 2026-10-08 - verifier-local, row 56a (software half, read-only; PostgreSQL left running; host :5432 untouched).*


