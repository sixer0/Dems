---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-06
agent: data-analyst
row: W88 (blueprint step 110)
type: implementation-report
tier: 1
confidence: HIGH for row status, gating decision IDs, log paths, git counts and gap counts (each read in decisions.md or re-measured by a read-only command); MEDIUM for the attribution of files on multi-writer paths to one row (section 9.3)
status: complete (this document); the row stays "in flight" in the controller's tracker until it is gated
source_plan: masterplan/02_plan.md (row W88 at line 767; artifact table section 8.7, lines 806-916)
source_trackers: status_tasks.md, delegation_progress_report.md (read 08:46-08:50 WIB)
source_decisions: decisions/decisions.md (D1-D189, DR-01-DR-13, F1-F79)
git_snapshot: 2026-10-06 09:03:46 WIB
last_updated: 2026-10-06 09:16
---

# Implementation report (plan row W88, step 110)

## 0. Summary

| Measure | Value | Evidence |
|---|---|---|
| Plan work rows W01-W105 | **89 done**, **1 in flight** (W88, this report), **15 not started** (W89-W103) | section 2; `status_tasks.md:23-121`; D25-D189 |
| Controller-added implementation rows | **20 done**, **1 in flight** (C1 closing-fix round) | section 2.6; `delegation_progress_report.md:284` |
| Plan log paths | 89 done rows: every log exists; **5 exist under another name** than plan section 8.7 (W72, W73, W76, W80, W83 - only W83's is recorded, D184 DQ-9); W88 = this file; W89-W103 absent as expected | section 2.8 (script over `02_plan.md:810-916`) |
| Commits (local only, `git remote -v` prints nothing) | `4b708c8` docs (59 files), `b90a3c6` checkpoint 1 (1,562 files), `057fc17` checkpoint 2 (754 files) | `git log`, `git show --stat` |
| `git diff --stat acaff20 \| tail -1` at 09:03:46 | `2367 files changed, 491935 insertions(+), 8196 deletions(-)`; plus 86 untracked files | section 9 (sum of areas = 2,367) |
| Contract gaps | 0 `CONTRACT-GAP-` lines under `apps/` and `packages/`; 17 `RESIDUAL-W*` IDs on 45 marker lines; KI-07 13 IDs / 62 markers, equal to `acaff20` | section 4 (grep, this report) |
| Final test ledger (D189) | shared 69 / 1,840; mock-core 4 / 19; core-web 103 / 1,392; mobile 145 / 1,743; core-server `unit` 154 / 3,916, `db` 122 / 1,740; `test:pg-scripts` 7 / 55 | section 6 |
| Success criteria | proven in part for all eleven; the end-to-end, regression, clean-rebuild, security and final-verification halves remain for W89-W103 | section 7 |
| Open items for the controller | 16 items not tied to a decision (section 8.1), routed items per owner row W89-W103 (section 8.2), 9 user decisions (section 8.3) | section 8 |

---

## 1. Tier 1 frame (5W1H)

| | |
|---|---|
| **Subject (what)** | The record of the implementation phase of the task "Core server on PostgreSQL, integrated RBAC and portal-mobile pairing": each plan work row and each controller-added row with its status, gating decision, log, files changed and deviations; the gap IDs closed and left open; every host change with its rollback; the test ledger; the success criteria; the open items; the reconciliation of file counts against `git diff --stat acaff20`. Plan row W88 [`masterplan/02_plan.md:767`]; it implements SC9 [`02_plan.md:1361`] |
| **Stakeholders (who)** | The controller (gates W89 onward and writes the final report from this file and W102); the rows W89-W103 (their routed items are in section 8.2); the user (host changes, the user-only decisions of section 8.3, the emulator lock of D125); later sessions (section 5 is the removal list) |
| **Timeline (when)** | Implementation ran from wave E1 after the docs commit `4b708c8` (2026-10-04 06:25:02 WIB, D24) to the test-completion row W87 (gated 2026-10-06 08:42-08:46, D189). Interruptions: a controller pause 2026-10-04 19:45-20:24 (`delegation_progress_report.md:200-205`); a session break 2026-10-04 22:05 to 2026-10-05 09:00 (D130); a run in another tool 2026-10-05 10:00-19:57 (D130-D149, handed back in D150); a stalled wave 2026-10-05 20:40-22:23 (`delegation_progress_report.md:232`); a stalled W87 stream 2026-10-06 06:13-08:14 (D189). This report: 2026-10-06 08:46-09:16 |
| **Scope (where)** | Read-only over the whole tree; the only writes are this file and `delegation_progress/data_analyst_step_110.md`. In scope: rows W01-W105 and the controller-added rows. Out of scope: re-running tests (numbers are quoted from the decisions), the research rows 1-22 (one paragraph in 2.7) |
| **Rationale and evidence chain (why)** | The plan requires that every work row appears with its log path and status, every deviation cites a D, DR or F ID or is listed for the controller, and the file counts match `git diff --stat acaff20` [`02_plan.md:767`]. The authority for each gate result is `decisions/decisions.md`; for status, the controller's two trackers; for files, git. Each row cell names its decision; each count names its command (section 12) |
| **Method (how)** | (1) Read the W88 row, the work-row tables and the artifact table of the plan; both trackers in full; `decisions.md` in full (D1-D189, DR-01-DR-13, F1-F79). (2) Read W83 part 1 (ledger) and part 2 (applied landings, residual sentences), the W87 test report sections 9-14, the README Live and Rollback sections, the CP-B1 report section 5, the B2b report sections 1-4, the CP-W1 findings. (3) Checked every plan log path by script. (4) Measured git: `log`, `show --stat`, `diff --stat` and `--name-status` against `acaff20` per owned path, untracked and ignored files. (5) Grepped gap markers, KI-07 markers, protected test-file hashes. (6) Targeted scan of row logs for findings routed to "W83" or "W88" and compared them with the decisions and the W83 ledger |
| **Alternatives considered** | (a) Summing per-row file counts from the row logs: rejected as the reconciliation basis because many paths have more than one writer by design (the 11 path groups of `02_plan.md:393-405`, plus the by-design grants of D37, D41, D52, D72, D82, D85, D98, D99, D122, D131 and the W83 grants of D184), so per-row sums exceed the distinct total; used instead: a partition of the distinct diff by owned area (section 9.3). (b) Re-running the suites: not needed by the brief; numbers quoted from D189 |
| **Assumptions** | (A1) The controller's gate result in `decisions.md` is the authority where a row log differs. (A2) "Done" means gated by a decision, or for W02 gated in `delegation_progress_report.md:51`. (A3) Counts are a snapshot at 09:03:46 WIB; the C1 round was writing in parallel (section 9.4) |
| **Gaps in evidence** | (G1) Emulator processes were not probed: `ps` is refused by the sandbox (`operation not permitted: ps`); their state is quoted from D130 and D188. (G2) Not every finding table of every row log was read line by line: the scan was targeted (method step 6); findings routed elsewhere and ruled in the gating decision are taken from the decision. (G3) `release/` is git-ignored, so `git diff` cannot show it; its byte check is W97's |

---

## 2. Row register

### 2.1 Legend

- **Status**: done (gated) / in flight / not started. **Gate**: the decision that accepted the row; "+" lists later decisions on the same row (follow-ups by its owner).
- **Log**: the plan's output document (section 8.7) or the real name, with "exists" checked by script at 09:0x.
- **Files**: what the row log or the controller trail reports at the gate, then the current footprint of the row's owned paths against `acaff20` (A added, M modified, U untracked; all writers of those paths included).
- **Deviations**: plan deviations and rulings with their D, DR or F ID. Row-local labels (DN-, DV-, row-local DR-n of D64) are named with the decision that ruled them.

### 2.2 Early rows (waves E1-E4)

| ID | Row | Status | Gate | Log | Files | Deviations, rulings |
|---|---|---|---|---|---|---|
| W01 | Baseline test fix | done | D25 | `implementation/01_baseline_test_fix.md` (exists) | 2 test files M: `apps/core-web/src/test/sim-fetch.test.ts`, `.../features/storage/__tests__/storage-page.test.tsx`; recorded hashes `9e8b97c8...`, `71f6f033...` - both still equal (`git hash-object`, this report) | Instant taken from `DEMO_EVIDENCE_INDEX.datasetNow`, `issuedAt` pinned (accepted, D25). Third calendar test found (F26) -> controller row W01b (DR-05) |
| W02 | Emulator cold boot (`dems_*`) | done; AVDs replaced for use | controller gate `delegation_progress_report.md:51` (no D) | `initialization/05_emulator_cold_boot.md` (exists) | none tracked; `.locks/dems_*.pid` (ignored) | Tier D override (sonnet, plan tier). adb server left running (recorded exception to P7, same report row). All three AVDs at the PIN keyguard (F33) -> D33 withdrawn by D35 -> lock-free AVDs (W02b; DR-08, D58, D63) |
| W03 | npm slot N1 | done | D27 | `implementation/03_npm_slot_n1_server_shared.md` (exists) | `.gitignore`, root `package.json`, `package-lock.json` M (+102 lock entries, 0 removed, 0 of 1,804 changed); 5 skeleton files of `apps/core-server` A; `packages/shared/package.json` M; 4 placeholder `index.ts` A | needs-review -> option B: 7 install scripts reviewed, not approved (D27); advisory GHSA-67mh-4wv8-2f99 accepted (D27); `@types/pg` 8.23.1; `npm audit` 80 entries -> W45 / W99 (F29); entry paths fixed for W08, W17, W20, W29, W11 (D27) |
| W04 | Proof (d) headless engine | done - CONFIRMED | D28 | `implementation/04_proof_headless_engine.md` (exists) | scratch `.cache/proof-engine/**` only | Rulings D-1 to D-4 for W26; AC-B-53 reworded (D28 D-2); facts F31 |
| W05 | Proof (f) Vite proxy | done - CONFIRMED | D29 (+ D34 follow-up) | `implementation/05_proof_vite_proxy.md` (exists) | `apps/core-web/vite.config.ts` M; scratch `.cache/proof-harness/**` | Proxy only for `DEMS_CORE_PROXY_PORT` 4420-4423 (D29); Vite's own CORS layer off while the proxy is on (F30; D29, D34) |
| W06 | Environment check | done - PASS-WITH-NOTES | D26 | `initialization/01_env_check.md` (exists) | two stale markers removed under `.locks/` (H-16) | DP-1 = option A (D26); a PostgreSQL on `*:5432` that this task did not install - not used, not touched (F27, D26); keystore inside the prebuild folder (F28) |
| W07 | PostgreSQL provisioning and trial | done - CONFIRMED | D32 | `initialization/04_postgres_provisioning.md` (exists) | `scripts/pg/**` 22 A (8 commands, 4 support, 7 tests, 3 fixtures); `.data/**`, `.locks/postgres.{pid,lock}` (ignored) | Accepted (D32 (4)): SCRAM verifier computed by the script; extra `.data/pg-scripts.log`; four support files; `pg:remove-data` stops the server first. Every database client needs the per-command bypass (D32 (1), D62 DN-9). T5-j branch not re-run after a later edit; next real run W90 (D32 (6)) |
| W08 | Backend scaffold and health | done | D40 (+ D55, D57) | `implementation/08_backend_scaffold_health.md` (exists) | 55 new files at the gate (D40); owned plugin and module folders now 34 A, `test/static` 15 A | Tenth seam `denialBudget` (D40 (1)); `skip-override` instead of `fastify-plugin` (D40 (3)); `logs/errors.log` joins the register (D40 (5)); local health adapter removed (D55); `x-request-id` with a two-file by-design change (D55, D57); F35 |
| W09 | Password-hash wrapper | done - TD-05 CONFIRMED | D30 | `implementation/09_password_hash_wrapper.md` (exists) | `src/modules/identity/password-hash/` 5 A | Rulings D-a to D-d (D30); D-a corrected by D50 DN-1 (a code-unit bound) |
| W10 | Proof (c) drizzle-kit | done - CONFIRMED | D38 | `implementation/10_proof_drizzle_kit.md` (exists) | scratch `.cache/proof-drizzle/**` only | Rulings for W17 (D38); the hash comparison became a command check, not a boot check (D54 DN-2) |
| W11 | Template-clone test helper | done | D48 (+ W11b: D76, D114, D142) | `implementation/11_db_test_helper.md` (exists); **amended by reference** by `implementation/11b_db_helper_forced_drop_retry.md` (D76 DN-5) | 45 helper files + `test/global-setup.db.ts` at the gate (`delegation_progress_report.md:82`); now 56 A | `test:db` attaches only and never starts PostgreSQL - amends plan GR-2 [`02_plan.md:1056`] and the contract (D48); pool 10 per instance, amends the contract's five (D48); one by-design change of its own test (D54 DN-1); F58 -> W11b |
| W12 | Typed client and emulator proof (e) | done - CONFIRMED | D36 (code), D51, D69 (device), D81 (CP-C1 fixes) | `implementation/12_typed_client_emulator_proof.md` (exists) | `packages/shared/src/client/` 2 A; `client-*` tests 4 A; `apps/mobile/src/runtime/dev-probes.ts` A, `debug.ts` M | Device half delayed by the keyguard (DR-06, D35); about 670 lines instead of "about 150" (D36); seven by-design assertions (D51); cubic input type fixed (F48; D64 DN-0, D69); cookie on the socket upgrade, measures D34-6 (F55, D69); request facts F56 |
| W13 | npm slot N3, native rebuild | done | D34 (open clause closed by D63) | `implementation/13_npm_slot_n3_mobile_native.md` (exists) | `apps/mobile/package.json` M (`expo-secure-store` `~57.0.4`, the `reverse` script); lockfile +1 entry; `apps/mobile/scripts/device-session.sh` M; `apps/mobile/android/**` (ignored prebuild output); `.cache/apk-backup/**` | Manifest edit + `npm install --ignore-scripts` instead of `expo install` (D34); `deps:check` and `doctor` dropped from later gates (D34); RB-06 needs `-r -d` (versionCode 100 vs 1, D34); app data compared by install time only (D34); launch check blocked (F33), closed on the `dems2_*` AVDs (D63) |
| W14 | npm slot N2 | done | D39 | `implementation/14_npm_slot_n2_web.md` (exists) | `apps/core-web/package.json` M (`qrcode.react` 4.2.0); `apps/core-server/package.json` (`react` 19.2.3 declared, D28 D-4); lockfile +1 entry | Tier D override (sonnet). `fsevents` line reviewed, not approved (D39 DN-1); `npm audit` not deterministic -> compare name sets (D39 DN-2); React pinned in three places (D39) |
| W15 | Secure-store wrapper and probe (g) | done - proof (g) on the unprotected path | D71 | `implementation/15_secure_store_wrapper_probe.md` (exists) | `runtime/secure-credentials.ts` A, `secure-credentials.test.ts` A, `secure-store-import.test.ts` A, `jest.setup.ts` M; `dev-probes.ts` (W12's file) | DP-2 = MB-5 case (c), observed without enrolment (D71); DR-09; write mode `'unprotected'` for W56 (D71 DN37-2). **The re-probe with the user's lock present has not run** (D71, D125 (3), D141 (3)): open, section 8.1 O-12 |

### 2.3 Backend, contract and shared client layer (waves B1-B9)

| ID | Row | Status | Gate | Log | Files | Deviations, rulings |
|---|---|---|---|---|---|---|
| W16 | Shared vocabulary | done | D37 (+ D41) | `implementation/16_shared_vocabulary.md` (exists) | `packages/shared/src/sim/vocabulary.ts` (+27), `auth.ts` (+5) M, additions only; `i18n/en/common.ts` M; `i18n/en/security-audit.ts` M (+4, D41); two shared tests | Missed label file (F34) -> option A (D37 DN-1), a two-writer path; `git apply --allow-empty` for P23 (D37 DN-3); stale comment in `common.ts` left for the next writer (D41) - still present (O-10) |
| W17 | Schema, migrations, database commands | done | D54 | `implementation/17_db_schema_migrations.md` (exists) | `drizzle.config.ts`, `src/db/{schema,migrations,commands}/**`, `test/db/**`: 47 A | No deviation from the contract (D54); PG-16 corrected; DN-2 hash check as a command check (amends D38); DN-4 no SCHEMA-GAP for the restart instant; server-log leak of failing rows (F38) -> W45 (CPS1-9) |
| W18 | Light Live API and settle | done | D43 | `implementation/18_live_light_api_settle.md` (exists) | `packages/shared/src/live/{index,settle,core-actions,errors,mode,hooks,constants}.ts` 7 A; `live-light-*` tests 7 A | `constants.ts` added (D43); the coalescing constant stayed in the web runtime (D121 (2)); additive hooks written by the Live source's owner (CPC1-13; D80, D84) |
| W19 | Contract A | done | D50 | `implementation/19_contract_a.md` (exists) | 13 updated, 16 created under `packages/shared/{src/api,openapi,scripts,test}` (`delegation_progress_report.md:84`); the contract slot is shared with W22, W27, W83 (section 9.3) | needs-review -> the typed-client owner adapts its tests (DN-0, DN-8; D50, D51); correction of D30 D-a (DN-1); `openapi.test.ts:177-178` changed by design |
| W20 | Mapping, seed, first build of `dems_demo` | done | D62 | `implementation/20_db_mapping_seed.md` (exists) | 15 files `src/db/mapping`, 13 `src/db/seed` at the gate; now mapping 15, seed 10, store 4 (moved by B1, D112) | CONTRACT-DEVIATION-1 and -2 accepted (D62 DN-1, DN-2); `-0` stored as `0` (DN-3); host change H-15 (`dems_demo`, 10:28:35); second mapping removed (F40, D62 DN-5, D67); F41, F42 |
| W21 | Core services | done | D67 | `implementation/21_core_services.md` (exists) | 12 production + 9 test files at the gate; `src/core/**` now 29 A | DV-1 to DV-8 accepted (D67); three tests of other rows adapted by design (D67); shadowing temporary tables (F53) -> closed by round A (D96, D113); F54 |
| W22 | Contract B | done | D53 | `implementation/22_contract_b.md` (exists) | 2 new + 6 changed contract files + 2 `api-*` tests | `api-registry.test.ts:359` changed by design; ill-formed text in the simulator (F37) -> controller row SIM-GAP-1 (DR-07, D53) |
| W23 | Request guards | done | D52 (+ D57) | `implementation/23_request_guards.md` (exists) | `src/plugins/{origin-guard,throttle}/**` now 11 A | needs-review -> scaffold tests adapted (D52 DN-1); standing rule on `readiness.test.ts` (D52); preflight answered by routing (DN-6); DN-8 -> W45 |
| W24 | Identity core | done | D78 (+ D72; Lows D123 (c)) | `implementation/24_identity_core.md` (exists) | 12 production + 17 test files at the gate; now `plugins/authenticate` 6 A + identity core 26 A (the `biometric/` 20 and `password-hash/` 5 belong to W41 and W09) | Controller brief error corrected (DN-4: attempts during a lock are not verified, D78); DN-1 to DN-16 (D78); by-design lines (D72); sign-in residuals (F62) -> W45 |
| W25 | Bulk fixture | done (full minimums; DF-1 not used) | D73 (+ D103, D109) | `implementation/25_db_bulk_fixture.md` (exists) | 13 source + 7 test files at the gate; `src/db/fixtures/**` now 22 A | Generator per the contract (D73 DN-7); detail keys and events bound to the writers, digests changed by design (F68; D103, D109); 17 extra `FAULT_RAISED` rows kept (D109) |
| W26 | Engine host | done | D77 (+ B2a: D122, D127) | `implementation/26_engine_host.md` (exists) | 14 production + 15 test files at the gate; `src/engine/**` now 37 A | DN-2 snapshot per clock second, DN-3 self-reload (D77); six assertions in four files by design (D77); F60, F61; F66, F71, F73, F74, F78 fixed in B2a (D122, D127) |
| W27 | Contract C | done | D64 (condition closed by D69) (+ D118, D126) | `implementation/27_contract_c.md` (exists) | 21 changed, 12 created under `packages/shared/{src/api,scripts,openapi,test}` | needs-review -> client owner's patch (D64 DN-0, D69); row-local DR-2 to DR-9 accepted (D64); F48, F49; the CPS1-3 condition delivered as a patch (D118) |
| W28 | RBAC guard and pipeline integration | done | D83 (+ D82, D85/D95, D123 (a)) | `implementation/28_rbac_guard_pipeline.md` (exists) | 6 production + 10 test files at the gate; now `permission-guard` 18 A + `rbac` 3 A | Per-request permissions instead of a boot-loaded matrix (D83); by-design patch in 10 files (D82); route-list pinning (CPB1-1 blocker) fixed (D85, D95); stored grants asserted (F65; D88 DN-1, D95); condition `DEVICE_CREDENTIAL` (D118, D123 (a)); F64 |
| W29 | Reset routine and lane databases | done | D74 (+ D79) | `implementation/29_db_reset_routine.md` (exists) | 7 source + 13 test files at the gate; `src/db/reset/**` now 19 A; host change H-15 (`dems_lane_1..3`) | R-1 counts sessions with a role; a never-seeded target keeps seed rows (D74 DN-2); DR-10; early "closed" defect fixed (D79); F61, F63 |
| W30 | Live socket client | done | D59 (+ D86 one export line) | `implementation/30_live_socket_client.md` (exists) | `realtime/live-socket-client.ts` A, `realtime/index.ts` M; 2 `realtime-live-*` tests A | Brief corrected (4403 / 4408 meanings, D59); inert client in the mobile bundles accepted (D59) |
| W31 | Fake transport | done | D61 | `implementation/31_fake_transport.md` (exists) | `live/testing/**` 9 A; 6 `live-testing-*` tests A | Every Live test ends with `assertNoViolations()` (D61); `.gitignore` swallows evidence logs (F39) - the ruled negation rule was **never added** (O-1) |
| W32 | Pairing and device registry | done | D93 | `implementation/32_pairing_device_registry.md` (exists) | 13 production + 12 test files at the gate; `src/modules/pairing/**` now 24 A | "17 answer 423" read as "17 not counted" (18 answer 423) (D93 DN-1, DN-2); DV-1, DV-5 accepted; `CONTRACT-GAP-W32-1..4` closed by W83 (D185) |
| W33 | User and role administration | done | D91 | `implementation/33_user_role_admin.md` (exists) | `src/modules/admin/**` 14 A | DR-12; F67, F68 |
| W34 | Sessions | done | D94 (+ D108) | `implementation/34_module_sessions.md` (exists) | `src/modules/sessions/**` 16 A | Brief error (pause / resume do not exist) corrected (D94); one error precedence (DN-2 not accepted; D108); two routes without `schema.body`, an exception to M2 (D108); `SIM-GAP-W34-1` residual (R-E2); F69 for the user |
| W35 | Evidence | done | D92 | `implementation/35_module_evidence.md` (exists) | `src/modules/evidence/**` 17 A | Collation `pg_unicode_fast` for text search (D92 DN-5); export body validated in the handler; a test drops a CHECK on its own clone (D92) |
| W36 | Devices | done | D89 | `implementation/36_module_devices.md` (exists) | `src/modules/devices/**` 9 A | `BE-GAP-W36-1` (F66) closed by `meters()` (D122; B2b item 2); a simulated restart has no duration (D89 F-4) |
| W37 | Storage and network-time | done | D88 | `implementation/37_modules_storage_network_time.md` (exists) | `src/modules/{storage,network-time}/**` 13 A | Stored grants (F65) -> boot assertion (D88 DN-1, D95); mutation in the tree -> rule M15 (D88); 503 after a committed change, residual (DN-2) |
| W38 | CHECKPOINT CP-B1 | done - PASS WITH FIXES | D87 (blocker closed D95) | `gateway_check/04_cp_backend_foundation.md` (exists) | none (read-only) | Scope extended by the controller to W26, W29, W25, W11 (D87); header miscount 10 vs 12 Medium (D87); open blockers 0 (D95); hand-built parts without an HB number listed for W88 (D87 CPB1-20; section 10) |
| W39 | Security-audit | done | D102 | `implementation/39_module_security_audit.md` (exists) | `src/modules/security-audit/**` 17 A | `SIM-GAP-W39-1` (R-E2); full verification unbounded, accepted (DN-1) |
| W40 | System and alerts | done | D104 | `implementation/40_modules_system_alerts.md` (exists) | `src/modules/{system,alerts}/**` 17 A | Brief corrected (unknown key dropped; restart has no duration) (D104); full mutation set not re-run after two test changes (accepted, D104); F71 -> B2a (D122) |
| W41 | Biometric token | done | D105 (+ D98, D126) | `implementation/41_biometric_token.md` (exists; W83 appended an errata note) | `src/modules/identity/biometric/**` 20 A; two lines in `modules/identity/index.ts` (D78 DN-6) | The loser of two concurrent uses is a reuse (DN-1, F72); audited beyond the budget (DN-3); one revoke function (DN-14); operation 8 condition (D118, D126, F77) |
| W42 | Realtime channel | done | D111 (+ D99, D120) | `implementation/42_realtime_channel.md` (exists) | 8 production + 15 test files at the gate; `src/realtime/**` now 27 A; `test/support/realtime.ts` | needs-review -> accepted; three handshake defects fixed (D111); dead-run databases removed through the helper (D111 DN-9, D114); socket caps CPS1-4, CPS1-5 (D120); F79 |
| W43 | Demo controls | done | D101 (+ D106) | `implementation/43_module_demo_controls.md` (exists) | `src/modules/demo/**` 15 A | DN-3 not accepted -> a failed reset takes a new epoch (D106); F73 -> B2a (D122) |
| W44 | Live source | done | D75 (+ D84, D86, D97, D107) | `implementation/44_live_source.md` (exists) | 13 files + 7 tests at the gate; now `live/source/**` 13 A, `live-source-*` tests 10 A | Shared baseline is 517 tests, not 508 (D75); DR-11 (local end, D80); `CONTRACT-GAP-7` withdrawn (D97); `-W44-1`, `-W44-2` residuals R-C1, R-C2; split of `live-sim.ts` revisited at W92 (D84) |
| W45 | CHECKPOINT CP-S1 | done - CAUTION | D113 | `gateway_check/05_cp_access_control_security.md` (exists) | none | `npm audit` refused by the proxy, discharged at W58 (D146); CPS1-1 to CPS1-8 closed (D120, D122, D123, D126, B2b item 4); **CPS1-9 open** (O-14) |
| W46 | CHECKPOINT CP-C1 | done - PASS WITH FIXES (three passes) | D80, D90, D100 | `gateway_check/07_cp_shared_client.md` (exists) | none | DR-11; CPC1-17 -> W97 reads the simulator diff as "W16 plus SIM-GAP-1" (D80, D90) |
| W47 | TEST role-by-endpoint matrix | done | D117 (+ D123 (b)) | `test/02_rbac_matrix.md` (exists) | `test/acceptance/rbac-matrix.{test,support}.ts` 2 A | 16 callers instead of 5, 1,200 cells (D117), 1,649 after the condition (D123 (b)); specification errata F-W47-1, -2 (applied as W83 errata); F-W47-4 |
| W48 | TEST pairing lifecycle | done | D116 | `test/04_pairing_lifecycle.md` (exists) | `test/acceptance/pairing-lifecycle.test.ts` 1 A | A revoked device can delay a new pairing (F76) -> question for W99 |
| W49 | TEST shared state | done | D119 | `test/05_shared_state_realtime.md` (exists) | `test/acceptance/shared-state.{test,support}.ts` 2 A (a comment is being reworded by C1 now) | Heartbeat not strict -> DQ-3 (b), erratum S-7 (D185); F78 closed (D127); TCP relay as the cut network (accepted, D119) |
| W50 | Web runtime and mode | done | D121 | `implementation/50_web_runtime_mode.md` (exists) | `runtime/**` and `lib/core-errors.ts` A; `main.tsx`, `router.tsx`, `routes/__root.tsx`, `lib/core-endpoint.ts` M; nine new tests; `common.ts` additive - now 23 A + 4 M | Coalescing constant kept in `core-errors.ts` (D121 (2)); F72-2 to F72-6 routed (D121 (6)); the row renamed its own scratch tests once (noted, D121) |
| W51 | Mobile runtime | done | D124 | `implementation/51_mobile_runtime.md` (exists) | `runtime/**`, `features/home/use-health.ts`, `i18n/en.mobile.ts`, eight new tests; owned paths now 27 A + 11 M + 1 U (all writers, C1 included) | The Pair chip `LIVE` moved to W57 (D124); rulings (2) to (6) (D124); a simulator object exists for the first frame of a debug build (accepted) |
| W52 | TEST contract conformance | done | D115 | `test/03_contract_conformance.md` (exists) | `test/acceptance/contract.{test,support}.ts` 2 A (later edited by W83 L3, L8) | W52-F2 -> 17 strict schemas (D185); `CONTRACT-GAP-W52-1` closed (D185) |
| W53 | TEST restart and recovery | done | D110 | `test/06_restart_recovery.md` (exists) | `test/acceptance/restart.test.ts` 1 A | Clock behind the stored state (F74) -> B2a (D122); AC-B-05 names four rows, five are written -> erratum (W83) |
| W54 | Web shell and admin routes | done - GATED PASS | D136 (D144 supersedes D136 (g); fix round D147) | `implementation/54_web_shell_admin_routes.md` (exists) | owned paths now 16 A + 10 M (the row's three test files hold 84 tests, D136) | Returned needs-review at the break (D130); Decisions 1, 2, 11 accepted; Decisions 3, 9 -> CP-W1 and fixed (D144, D147); F76-13 withdrawn (D144); **CPW1-2 and CPW1-10 still open** (O-5, O-6) |
| W55 | Web Login | done | D128 | `implementation/55_web_login.md` (exists) | `features/login` 9 changed + 4 new, `en/login.ts`, three `live-login-*` tests; two granted lines outside (D128) | One by-design line in `live-runtime-startup.test.tsx`; the presentation follow-up installed in the root route, later moved to `runtime/presentation-follow.ts` (D128, D144 (4), D147); the login copy of the mode switch deleted (D144 (1), D147) |
| W56 | Mobile sign-in | done | D129 | `implementation/56_mobile_sign_in.md` (exists) | `apps/mobile/src/auth/**` 4 changed + 7 new + 4 new tests (15) | Two providers instead of one changed provider (accepted, D129); a died process re-presents a sent token (DN-1 / F-3) -> W100; two letters typed into the app's own field (noted, D129) |
| W57 | Mobile pairing flow | done - GATED PASS | D137 | `implementation/57_mobile_pairing_flow.md` (exists) | pairing folder now 5 A + 7 M (+1 U written by W87); four new test files (51 tests) | Returned needs-review at the break; DN-1 accepted as KI-01's state, DN-2 declined, DN-6 binding (lane 2 keeps its pairing) (D137) |
| W58 | GATE backend | done - PASS-WITH-NOTES | D146 | `gateway_check/06_backend_gate.md` (exists) | none | Notes F-1 to F-9 (D146); live `npm audit` discharged; **the observation "does a refused POST move the Core's idle expiry" asked by D90 is not in the report** (O-3) |

### 2.4 Client rows (waves B9-C4)

| ID | Row | Status | Gate | Log | Files | Deviations, rulings |
|---|---|---|---|---|---|---|
| W59 | Mobile Login in LIVE | done - GATED PASS | D138 (D133) | `implementation/59_mobile_login.md` (exists) | `features/login/**` 4 A + 5 M | Half-written at the break; audited and kept (D133, D138); one block rewritten for the React Compiler lint (DN-2); the paired-device evidence moved to W60 and W94 (DN-1); step number corrected (D130) |
| W60 | Mobile pairing gate | done - GATED PASS | D143 | `implementation/60_mobile_pairing_gate.md` (exists) | `navigation/**` now 3 A + 3 M (M1 later changed `back-guard.tsx`) | Split device evidence accepted on condition that W94 shows one continuous session (DN-1); lane 1 keeps `DEV-0001` (DN-2) |
| W61 | CHECKPOINT CP-W1 | done - PASS WITH FIXES | D144 (fix round D147) | `gateway_check/08_cp_web_runtime.md` (exists) | none (a build into the git-ignored `dist`, CPW1-15) | Corrected D136 (g) (D144); ten-rule carry list for the page rows |
| W62 | CHECKPOINT CP-M1 | done - PASS WITH FIXES | D148 | `gateway_check/09_cp_mobile_runtime.md` (exists) | none | Row M0 added (CPM1-3); CPM1-1, -2 -> W82 (closed D177); KI-07 13 / 62 measured |
| W63 | Web Dashboard | done | D152 | `implementation/63_web_dashboard.md` (exists) | 3 A + 6 M | Console stricter than the Core for Test signal (F63-1, D152); F63-2, F63-3 into later briefs; F63-4 (R-E10); DV-1 accepted |
| W64 | Web Start New Session | done | D153 | `implementation/64_web_session_new.md` (exists) | 5 A + 8 M (+1 U, a copy-round test) | Row W0 queued (D153 (5)); F69 hint -> README (done, D188) |
| W65 | Web Session Monitor | done | D154 | `implementation/65_web_session_monitor.md` (exists) | 2 A + 10 M | DV-1 (session started by page script), DV-2 (A9 after 700 ms) accepted; clip reset (F-3) -> W0 (D154, D165) |
| W66 | Mobile Home and More | done | D159 | `implementation/66_mobile_home_more.md` (exists) | 6 A + 5 M | Notice seed (F-1) -> M1 (D164); app-wide banner (DN-5 / F-2) -> W100; `CONTRACT-GAP-W66-1, -2` residuals |
| W67 | Mobile Start Session | done | D157 | `implementation/67_mobile_session_new.md` (exists) | 6 A + 6 M | DN-4 erratum; hook consolidation -> M1 (DN-7); F-3 not a defect (D164); F-4 -> W68 |
| W68 | Mobile Session Monitor | done | D170 | `implementation/68_mobile_session_live.md` (exists) | 10 tracked (+2 U written by W87) | Banner defect (F-1) -> runtime writer, fixed (D173); CLIP chip look (F-5) -> W100; DV-2, DV-8 accepted |
| W69 | Web Evidence | done | D158 | `implementation/69_web_evidence.md` (exists) | 7 A + 12 M (+1 U) | StrictMode double-send (F69-1), a defect class -> W0 item 1 (D158 DC-2, D165); destination labels stay (DC-4) |
| W70 | Web Devices | done | D156 | `implementation/70_web_devices.md` (exists) | 5 A + 10 M (+1 U) | `CONTRACT-GAP-W70-1` residual R-C4; the one deliberate Simulated change "Identify (blink)" (F70-1; D156, D165); F70-4, F70-5 -> W0 |
| W71 | Web Storage and Network & Time | done | D155 | `implementation/71_web_storage_network_time.md` (exists) | 2 A + 7 M; `storage-page.test.tsx` at W01's state | F64 seen on a lane; F71-3 -> W0 (closed D165) |
| W72 | Mobile Finalization, Summary, Sessions hub | done | D169 (+ D171) | **`implementation/72_mobile_finalization_summary_sessions.md`** (exists; plan names `72_mobile_finalizing_summary_sessions.md`) | 5 A + 5 M | Brief erratum: operation 37, not 70 (F-4); CLG (c) hit since `acaff20` removed; F-1 follow-up (D171); F-2 -> runtime writer (D173); F-3 -> W100; F-5 to F-7 noted |
| W73 | Mobile Recovery | done | D175 | **`implementation/73_mobile_recovery.md`** (exists; plan names `73_mobile_session_recovery.md`) | 4 A + 4 M | Spec sentence on the Start button is an erratum (DN-1); read-only rule duplicated -> M2 (DN-4, D180); `CONTRACT-GAP-W73-1` residual R-E5 |
| W74 | Mobile Evidence | done | D162, D163 | `implementation/74_mobile_evidence.md` (exists) | 10 A + 11 M | Device re-run granted and passed (D162, D163); DN-3, DN-4 residuals; LogBox banner in debug builds (F-9) -> W100 |
| W75 | Web Security & Audit | done | D176 | `implementation/75_web_security_audit.md` (exists) | 7 A + 12 M (+1 U) | F75-2 fixed and made a brief rule (DC-6); DC-5 -> W83 (R-D2, R-D4, R-E9, copy item 94) |
| W76 | Web System and Demo Control Panel | done | D178 | **`implementation/76_web_system_demo.md`** (exists; plan names `76_web_system_demo_panel.md`) | 7 A + 10 M | Lane 3 reset by its own allowed demo action (D178); DC-1, FW76-5 -> W1 (D182); **FW76-1, FW76-3, FW76-6 not ruled anywhere** (O-4) |
| W77 | Web Users & Roles | done | D172, D174 | `implementation/77_web_users_roles.md` (exists) | 17 A | Gate held until the whole suite was green (D172, D174); F77-1, F77-2 -> W0c; the demo password printed to the agent's own console once (process slip, D172) |
| W78 | Mobile Devices | done | D160 | `implementation/78_mobile_devices.md` (exists) | 6 A + 7 M | Hook twins -> M1b (D166); `CONTRACT-GAP-W78-1, -2` residual R-E5; stale marker text (F78-3) reworded by W83 L9 |
| W79 | Mobile Storage and Network & Time | done | D168 | `implementation/79_mobile_storage_network_time.md` (exists) | 5 A + 4 M | Sheet closable while in flight (DV-6) -> W100 note; DN-2, DN-3 closed by W83 / copy round (D185, D186); F79-1 reworded (W83 L9) |
| W80 | Mobile Operator Audit | done | D167 | **`implementation/80_mobile_operator_audit.md`** (exists; plan names `80_mobile_audit.md`) | 5 A + 6 M | Typed-username wording (DN-2, R-E10); KI-07 count rule for W72 (DN-4); evidence on the build before D166 (DN-5) |
| W81 | Web Paired Devices | done | D179 | `implementation/81_web_paired_devices.md` (exists) | 19 A | Two ordering defects fixed; DC-1, DC-2 -> W1 (D182); DC-3 erratum; `CONTRACT-GAP-W81-1` closed, `-2` residual R-C6 |
| W82 | Mobile Settings | done | D177 | `implementation/82_mobile_settings.md` (exists) | 8 A + 7 M (+1 U written by W87); one key in `en.mobile.ts` | CPM1-1, -2 closed; owed sign-out at the switch (DN-3 / F82-2) -> W100; expanded demo panel proven in jest only (DN-4); a `prettier --write` reformat restored (DV-4) |

### 2.5 Closing rows (waves F1-V6) and checkpoint commits

| ID | Row | Status | Gate | Log | Files | Deviations, rulings |
|---|---|---|---|---|---|---|
| W83 | Contract close-out and OpenAPI | done | D184, D185 | **`implementation/83_contract_closeout.md`** (exists; plan names `83_contract_close_out_openapi.md`; recorded D184 DQ-9) | 99 files pre-imaged, 78 changed, 53 outside the owned paths by grant (P2.4 point 8); `api-closeout.test.ts` U; errata appended to three specifications | DQ-3 (b) for the heartbeat (erratum S-7); DV-4 ratified; DV-5 to DV-9 accepted (D185) |
| W84 | Web API Reference | done | D187 | `implementation/84_web_api_reference.md` (exists, untracked) | 13 changed + 2 new in `features/api-reference`, `en/api-reference.ts`, two Live tests (14 M + 4 U now) | All-scope health example is mock-core's (F84-3) -> C1 (in flight); health query move (CPW1-9) -> W92 |
| W85 | THIRD_PARTY_NOTICES | done | D65, D66, D68 | `implementation/85_third_party_notices.md` (exists) | `THIRD_PARTY_NOTICES.md` M: +128 lines, 0 removed, 305 lines | Tier D (sonnet). The PostgreSQL License text fetched once by the controller (D66); facts F50; script slips F51 |
| W86 | README Live-mode guide | done | D188 | `implementation/86_readme_live_mode.md` (exists, untracked) | `README.md` M: +190, additions only | Old emulator scripts (F86-1) -> C1; old PIN lines kept with corrections beside them (F86-2); `dems_demo` state binding for later holders of 4420 (F86-6) |
| W87 | TEST completion and coverage | done | D189 | `test/01_test_report.md` (exists; saved by the controller from the agent's text, D189) | 7 new test files U: `live-static-ac-c-53` (web, mobile), 5 `live-gap-*` (web 1, mobile 4) | No server `gap-*` file needed; W87-F1, -F2 -> C1; W87-F3 -> W92, W93; W87-F5 sentence for this report (section 11) |
| W88 | Implementation report | **in flight** | - | `implementation/99_implementation_report.md` (this file) | none outside the task folder | - |
| W89 | GATE root | not started | - | `gateway_check/10_root_gate.md` (absent, expected) | - | routed items: section 8.2 |
| W90 | Clean-state rebuild | not started | - | `verification/03_clean_state_rebuild.md` (absent) | - | needs a word with the user first (`status_tasks.md:122`) |
| W91 | Code review core-server | not started | - | `verification/10_code_review_backend.md` (absent) | - | |
| W92 | Code review shared and web | not started | - | `verification/11_code_review_shared_web.md` (absent) | - | |
| W93 | Code review mobile | not started | - | `verification/12_code_review_mobile.md` (absent) | - | |
| W94 | E2E SC5 pairing | not started | - | `verification/06_e2e_pairing.md` (absent) | - | |
| W95 | E2E SC3 shared state | not started | - | `verification/04_e2e_shared_state.md` (absent) | - | |
| W96 | E2E SC4 role change | not started | - | `verification/05_e2e_rbac.md` (absent) | - | |
| W97 | REGRESSION SC8 | not started | - | `verification/07_regression_simulated_release.md` (absent) | - | |
| W98 | Performance (DEFERRABLE, reduced) | not started | - | `verification/08_performance_realtime.md` (absent) | - | |
| W99 | Security review backend | not started | - | `verification/02_security.md` (absent) | - | |
| W100 | Security review clients | not started | - | `verification/09_security_clients.md` (absent) | - | |
| W101 | Final verification SC1-SC11 | not started | - | `verification/01_verification.md` (absent) | - | |
| W102 | Report inputs | not started | - | `report/01_report_inputs.md` (absent) | - | |
| W103 | Final local commit | not started | - | `report/02_git_final_commit.md` (absent) | - | |
| W104 | Checkpoint commit 1 | done - `b90a3c6` | D150 (launched D149) | `implementation/97_checkpoint_commit_1_backend.md` (exists) | git index only: 1,562 files, +386,422 / -6,324 | Staging of the other tool finished after a content scan; 11 token-shaped hits ruled harmless; `.vitest/` ignore rule added; **the ruled `!docs/**/assets/*.log` negation (F39) was not added** (O-1) |
| W105 | Checkpoint commit 2 | done - `057fc17` | D183 | `implementation/98_checkpoint_commit_2_web.md` (exists, untracked by design) | git index only: 754 files (596 added, 158 modified), +82,162 / -1,859 | One scan hit ruled a false positive; about 116 MB accepted (D183) |

### 2.6 Controller-added rows of the implementation phase

Follow-ups that a plan row's own agent ran (for example W25's fixture follow-ups, W34's error precedence, W43's new epoch, W72's hub stamp, W74's device re-run) are listed in that row's cell above. The rows below are new scope the plan did not have.

| Row | What | Status | Gate | Log | Files | Deviations, rulings |
|---|---|---|---|---|---|---|
| W01b | Calendar-robustness sweep | done | D31 | `implementation/01b_calendar_sweep.md` (exists) | `features/dashboard/__tests__/dashboard.test.tsx` M; hash `1ab07579...` (equal now) | DR-05; the shifted-clock sweep added to W58 and W89 (D31) |
| W01c | Flaky assertion fix (KI-24) | done | D42 | `implementation/01c_flaky_test_fix.md` (exists) | `features/security-audit/__tests__/security-audit.test.tsx` M; hash `5470ce3f...` (equal now) | Tier override R -> D (sonnet); KI-24 open for one more full gate cycle (D42) |
| W02b | Lock-free emulators, port guard, user-run lock helper | done | D63, D70 | `initialization/06_lock_free_emulators.md` (exists) | `apps/mobile/scripts/device-session.sh` M; `emulator-user-lock.sh` A; three AVDs (host) | DR-08; the one recorded exception to "no emulator is stopped" (D58, D63); F44, F45, F46, F47 |
| W11b | Helper forced-drop retry; limits; dead-run drop; `needs` mechanism | done | D76; follow-ups D114, D142 | `implementation/11b_db_helper_forced_drop_retry.md` (exists) | `apps/core-server/test/helpers/db/**` (part of the 56 above) | Follow-up 3 on the non-local tier after two failures of the local agent (DR-13, D140, D142); F54, F58, F63 |
| SIM-GAP-1 | Simulator text cut at code-point boundaries | done | D56 | `implementation/22b_sim_text_cut_fix.md` (exists) | `packages/shared/src/sim/text-cut.ts` A (+42), `session-machine.ts` M (+5 -2), `evidence-actions.ts` M (+3 -2), `test/sim-text-cut.test.ts` A | DR-07 (recorded exception to "nothing under `src/sim/`"); F37 |
| CP-C1 fix rounds | Typed client (CPC1-3, -12); Live source rounds 1-3 and follow-ups (22 + 10 + 6 findings) | done | D81, D84, D86, D97, D107 | `implementation/12_typed_client_emulator_proof.md` section 19; `implementation/44_live_source.md` sections 14-18 | `packages/shared/src/{client,live,realtime}` (inside W12, W18, W30, W44 above) | DR-11 (local end); CPC1-24 persistence port; `CONTRACT-GAP-7` withdrawn (D97) |
| CP-B1 round A | Logger, `search_path`, unit statement guard, lost connection, read helper (CPB1-2, -3, -4, -6, -7, -8, -13 to -15) | done | D96 | `gateway_check/04a_cp_backend_fix_round_a.md` (exists) | 20 changed, 16 new files in `apps/core-server` | F53 shown to be a real silent loss of an audit row (D96); rule M16 |
| CP-B1 round B1 | Ten module-level structural items | done | D112 | `gateway_check/04b_cp_backend_fix_round_b1.md` (exists) | 181 paths in `apps/core-server` (19 new, 162 changed, 2 moved) | Proof that the removed duplicate hooks hid stage-6 defects (D112); shims for one round |
| CP-B1 round B2a | Engine and clock: F74 / CPS1-1, F73, F71, F66, one API-7 hook, boot-check runner; follow-up F78 | done | D122, D127 | `implementation/26_engine_host.md` sections 26, 27 | `src/core`, `src/engine`, granted test lines | One by-design line `reset-failures.db.test.ts:391` (D122); `meters` required (D122, D127) |
| CP-B1 round B2b | 14 structural items (0-8 on 2026-10-04; 8a, 9-13 on 2026-10-05) | done (closed on the whole-project green, D150) | D131, D132, D139, D150 | `gateway_check/04c_cp_backend_fix_round_b2b.md` (exists); `delegation_progress/coder_execution_fix_round_b2b.md` | `apps/core-server` structural paths; item 4 closed CPS1-2 / CPB1-5 | Item 10 delivered as a safe subset, the rest routed (D139 DN-2; O-15); F-B2b-1, -2 open (O-15); DV-5, DV-6 accepted (D139) |
| CP-S1 identity Lows | CPS1-6, -7, -8 and the operation 8 condition | done | D123 (c), D126 | `implementation/24b_identity_security_lows.md` (exists) | 13 files in `src/modules/identity/**`; six contract files by patch; three spec lines | GD-1: the dead `ROTATED` branch removed (D126); F77 closed |
| W54 / W57 evidence | Verifier evidence and two repair runs | done | D135, D136, D137 | `gateway_check/06a_w54_w57_gate_evidence.md` (exists); repairs in the two row logs | documents and assets only | D136 (g) later superseded (D144) |
| CP-W1 fix round | High + 4 Medium + 2 Low of CP-W1 | done | D147 | `gateway_check/08_cp_web_runtime.md` sections 22-31 | `apps/core-web/**` (the login copy of the mode switch moved to `.cache/rollback/CPW1/removed/`) | DN-1 granted (`live-shell-indicator.test.tsx:358`); DN-2 coverage gap to W87 (done D189); **CPW1-7 left for "a structural slot before W89"** (O-7) |
| Static-scan slot | `test/static/scan.ts` skips `.cache` (F W3-3) | done | D161 | `gateway_check/04d_static_scan_cache.md` (exists) | `scan.ts` one entry; `scan-skips.test.ts` new | Tier override R -> D (sonnet) |
| M0 | One link rule in `@/runtime` (CPM1-3) | done | D151 | `gateway_check/09a_m0_link_rule.md` (exists) | `runtime/link-notice{,.test,-static.test}.ts` A, `runtime/index.ts`, two live-model files M | DN-1 to DN-5 ratified |
| M1 | Mobile consolidation (+ M1b, the two runtime fixes) | done | D164, D166, D173 | `gateway_check/09b_m1_mobile_consolidation.md` (exists) | `runtime/{use-pending-press,use-core-link-notice,pending-control,live-resync-watch}` A; `navigation/back-guard.tsx`, session-new, devices | The cancel defect in Start Session fixed (D166); the resync cause differed from the brief (D173) |
| M2 | Closing mobile round (+ M2b Login link visuals) | done | D180, D181 | `gateway_check/09c_m2_mobile_closing.md` (exists) | `runtime/use-core-link-read-only` A; call sites; Login visuals | Two assertions of W73's static test changed (DN-1, D180); sweep list -> W93 |
| W0 | Web consolidation (+ W0b reporter move, W0c shared-test round) | done | D165, D166, D174 | `gateway_check/08a_w0_web_consolidation.md` (exists) | `lib/{effect-start,pending-control,page-report}.ts` A; 27 files updated; 7 new tests; harness +6 lines | StrictMode double-send also in Simulated mode (DC-2, D165); "LIVE / DEMO" burnt into the video, option A |
| W1 | Closing web round (+ DC-3 follow-up) | done | D182 (follow-up: `status_tasks.md:115`, re-measured in D183) | `gateway_check/08b_w1_web_closing.md` (exists) | `lib/core-page-walk.ts` A; two export files and dialogs; test IDs renamed | DC-1 to DC-3 accepted (D182) |
| Copy round | W83's seven F items | done | D186 | `gateway_check/08c_copy_round.md` (exists, untracked) | 31 files modified, 4 web test files added | Item 90 option A; item 94 the one deliberate Simulated change; about 17 read-only commands began with `cd` (D186) |
| **C1** | Closing-fix round: W87-F1, W87-F2, F84-3, F86-1 | **in flight** | launched after D189 (`delegation_progress_report.md:284`) | expected `gateway_check/10_closing_fixes_c1.md` (absent at 09:03); progress `delegation_progress/coder_execution_c1.md` (present) | so far: `apps/mobile/src/runtime/log.ts` M, `runtime/log-flush-timer.test.ts` U, `shared-state.test.ts` comment, `packages/shared/src/api/{examples,openapi}.ts`, `openapi.json`, root `package.json` (from `git status` at 09:03) | not gated |

### 2.7 Research and planning rows 1-22 (for completeness)

Rows 1-12 (explore, data-collector) PASS with findings F4-F19; row 13 baseline gate D10; row 14 analysis D11, D12; row 15 specification D13; rows 16, 17 contracts D14, D15; row 20 security design review D16; controller rows 20a, 20b folded the corrections (D18, D19), row 20c a citation patch on the deterministic tier (D23); row 18 plan rev 1 / 2 / 2.1 (D17, D20, D23); row 19 consistency D21; row 21 blueprint rev 2 / 2.1 (D22); row 22 docs commit `4b708c8` (D24).

### 2.8 Log-path check (script over the artifact table, 09:0x)

| Result | Rows |
|---|---|
| Exists under the plan's name | W01-W71, W74, W75, W77-W79, W81, W82, W84-W87, W104, W105 (and W38, W45, W46, W47, W48, W49, W52, W53, W58, W61, W62 under `gateway_check/` and `test/`) |
| Exists under another name | W72 `72_mobile_finalization_summary_sessions.md`; W73 `73_mobile_recovery.md`; W76 `76_web_system_demo.md`; W80 `80_mobile_operator_audit.md`; W83 `83_contract_closeout.md` (only this one is recorded, D184 DQ-9) |
| This document | W88 |
| Absent, not started | W89-W103 (the `verification/` and `report/` folders do not exist yet) |
| **Missing for a done row** | **none** |

---

## 3. Deviations from the plan

### 3.1 Drift log (the authority: `decisions.md:197-213`)

| ID | Planned | Actual | Ref |
|---|---|---|---|
| DR-01 | Fallback keg `postgresql@17` | `postgresql@18`; the fallback was never used (D32) | D11 |
| DR-02 | The app may scan the QR | Code entry only; QR scanning deferred | D11 |
| DR-03 | Two database roles | Three: `dems_admin`, `dems_owner`, `dems_app` | D16 |
| DR-04 | Row 21 after row 19 | In parallel | D20 |
| DR-05 | W01 fixes two tests | W01b swept three suites and fixed a third | D25, D31 |
| DR-06 | Proofs (e), (g) in waves E3 / E4 | Device halves waited for the lock-free AVDs | D35 |
| DR-07 | Nothing under `packages/shared/src/sim/` except the vocabulary | Two files and one helper (SIM-GAP-1) | D53 |
| DR-08 | Device checks on the `dems_*` AVDs | Three new lock-free `dems2_*` AVDs | D58 |
| DR-09 | MB-5 case (b) premise | Measured on Android: a protected write is refused at once | D71 |
| DR-10 | `reset` detail only for a reset | Always present | D74 |
| DR-11 | Sign-out rejects while offline | A local end, debt paid later | D80 |
| DR-12 | `admin.changed USERS` on role change and enable | Also after a disable | D91 |
| DR-13 | All resumed steps on the local tier | Helper follow-up 3 on the non-local tier | D140 |

### 3.2 Plan or contract text amended by a decision (not drift entries)

| Amendment | Decision |
|---|---|
| `test:db` attaches only, never starts PostgreSQL (plan GR-2 said "attaches to or starts") | D48 |
| Server pool 10 connections per instance (contract said five) | D48 |
| AC-B-53 reworded (actor taken from the session, two stated exceptions) | D28 D-2 |
| RB-06 needs `adb install -r -d` (versionCode 100) | D34 |
| `deps:check` and `doctor` removed from every later gate (they contact Expo's services) | D34 |
| The migration-file hash check is a command check, not a runtime boot check | D54 DN-2 (amends D38) |
| A row that fills a seam deletes its own "still a stub" assertion in `readiness.test.ts` (standing rule) | D52 |
| Standing rules M1-M16 for module rows | D83, D87, D88, D96 (`gateway_check/01_gate_report.md:46-61`) |
| Row-scoped gap names `CONTRACT-GAP-W<row>-<n>` | D84 |
| Concurrency 6 / 8 then 8 / 8 | D6, D44 |
| A failed reset takes a new epoch; the epoch no longer counts resets | D106 |
| One error precedence for every module (404, 409, then 422 `INVALID_REASON`) | D94, D108 |
| Errata sections appended to `01_specs.md`, `03_database_contract.md`, `04_client_integration_spec.md` (S-1 to S-13, D-1 to D-3, C-1 to C-4); the specs are not re-issued | D184 DQ-6, D185 |
| Step numbering of the resume: step 80 = W58, step 81 = W59 | D130 |
| The plan's artifact name for W83 | D184 DQ-9 (W72, W73, W76, W80 not recorded: O-2) |

### 3.3 Controller errors corrected on the record

| Error | Correction |
|---|---|
| Authorised agents to type the emulator PIN | Withdrawn; no input was sent (D33 -> D35) |
| Brief said the Argon2id derivation runs during a lock | The row built the specification (D78 DN-4) |
| Brief named "pause / resume" session commands | Do not exist; nothing built (D94) |
| Accepted the claim that two protected test files never existed | Superseded; the files exist (D136 (g) -> D144) |
| Brief expected unknown settings keys to be refused and a restart duration | Contract and simulator win (D104) |

### 3.4 Process deviations of agents (all recorded)

| Deviation | Ref |
|---|---|
| Read-only commands that began with `cd` (against P10) | D73, D119, D120, D122, D153, D186; `test/01_test_report.md` section 13 |
| A mutation check changed files in the tree for seconds -> rule M15 | D88, D94 |
| The demo password printed into an agent's own console output (no file, log or asset) | D172 |
| Two letters tapped into the app's own Username field | D129 |
| Scratch-file slips (a stray file created and removed by the same command) | F51, D160, `test/01_test_report.md` section 13 |
| A red window in the shared `unit` project caused by a follow-up (09:55:13-09:57:50 on 2026-10-04) | D57 |
| Three files edited before their pre-image was copied; empty P23 patch for untracked paths | D139 DV-5, DV-6; D147 DV-a |
| One slip without a pre-image of the first gate's files | D108 |

### 3.5 Tier overrides (CLAUDE.md section 11, rule 3)

| Row | Override | Reason | Ref |
|---|---|---|---|
| W02, W14, W85 | sonnet (the plan's tier D for a coder row) | mechanical | `delegation_progress_report.md:50, 75, 104` (W103-W105 are git-specialist rows whose default tier is D: no override) |
| Row 20c, W01c, static-scan slot | R -> D (sonnet) | specified patch | `delegation_progress_report.md:45, 78, 248` |
| Whole resumed run 2026-10-05 | every agent to its `*-local` variant | the other tool's controller variant | D130 |
| Helper follow-up 3 | local -> non-local | local agent failed twice | DR-13, D140 |

---

## 4. Gap IDs

### 4.1 Totals (W83 ledger, `implementation/83_contract_closeout.md` part 1 section 5 and part 2 section P2.6)

| Class | Part 1 | After phase 2 and the copy round |
|---|--:|---|
| A contract fixes | 34 | 33 closed in the contract; 1 (row 38, strict heartbeat) moved to B by DQ-3 (b) |
| B errata | 13 | 14 applied (13 + S-7) |
| C server behaviour | 7 | 7 residuals |
| D client layer | 5 | 1 done (R-D1), 4 residuals |
| E documented residuals | 28 | 28 accepted (27 distinct + one umbrella) |
| F copy merges | 7 | 7 done by the closing copy round (D186) |
| Already closed | 7 | 7 |
| **Total** | **101** | |

Measured now (section 12): `grep -rn 'CONTRACT-GAP-' apps packages --include=*.ts --include=*.tsx` -> **0 lines**; `RESIDUAL-W*` -> **17 distinct IDs on 45 lines**.

### 4.2 Closed

| ID or item | Closed by |
|---|---|
| `CONTRACT-GAP-1`, `-2` | W19 and the scaffold touch-up (D50, D55) |
| `CONTRACT-GAP-3` (device command table), `-4` (`BEARER_SECRET_PREFIXES`), `-5` (any-of spelling, with R-D1), `-6` ("order not significant") | W83 L4, L1, L5, DQ-4 (D185) |
| `CONTRACT-GAP-7` | withdrawn (D97) |
| `-W32-1..4`, `-W34-1..3`, `-W35-1..2`, `-W36-1`, `-W39-1..3`, `-W40-1..2`, `-W41-1..5`, `-W42-1..3`, `-W43-1`, `-W52-1`, `-W81-1` | W83 landings L1-L3, L7 (D185) |
| `-W49-1` (heartbeat strictness) | closed as erratum S-7 (DQ-3 (b), D185) |
| W52-F2 (26 lax response schemas) | 17 Core-only schemas strict (L7); the offline ones stay with an AC-B-10 sentence (D185) |
| KI-18 (stale "served by mock-core ... CORS" sentence) | L6; exactly two offline hashes moved (D185) |
| `BE-GAP-W36-1` (meter frames) | `EngineHost.meters()` (D122) and B2b item 2 |
| `SIM-GAP-1` (text cut) | D56 |
| `BE-GAP-W23-1`, `-2` | inside W23 (not counted by W83) |
| B errata W83-T13 to T24, T35 | appended errata, a note in `41_biometric_token.md`, three code comments (D185) |
| F copy items 89-95 | D186 |

### 4.3 Open residuals, with their README and report sentences (from `83_contract_closeout.md` P2.5, binding by D185)

| Item | Marker | Reason | README (W86) | Final report |
|---|---|---|---|---|
| R-C1 | `RESIDUAL-W44-1` | `hello` names no session | - | After a reconnect the console confirms its session with one request before it shows the Core's data; `hello` does not name the session |
| R-C2 | `RESIDUAL-W44-2` | a sign-out names no session | - | A sign-out owed by one tab and paid after another tab signed in can end that newer session; the operator signs in again |
| R-C3 | `RESIDUAL-W66-1`, `RESIDUAL-W74-2` | no media reference in replicated rows | In Live mode the session list and the evidence list show the bundled poster by evidence number, or the brand still; an item's own picture opens in its detail (`README.md:333`) | The replicated history and evidence rows carry no media reference |
| R-C4 | `RESIDUAL-W70-1` | no `admin.changed DEVICES` on presence | With two paired devices, one leaving while the other stays shows as offline only at the next refresh of the Devices drawer or the Paired Devices page (`README.md:334`) | A paired device's socket opening or closing publishes no `admin.changed DEVICES`; clients re-read on a tablet-link change |
| R-C5 | `RESIDUAL-W77-1` | no `admin.changed` on sign-in, sign-out, expiry | On Users & Roles, active sessions and the last sign-in are as fresh as the page's last read; it reads again when the window regains focus (`README.md:335`) | No `admin.changed` on sign-in, sign-out or expiry |
| R-C6 | (gap W81-2, no marker) | no `REPLACED` close reason | - | A pairing code replaced by a new issue is closed with the reason `CANCELLED`; the page tells the two apart by a status read |
| R-D2 | (gap W75-1) | web export destination label | In Live mode an export from the web console is recorded with the Core's default destination label, "Audit archive (simulated)" (`README.md:336`) | - |
| R-D3 | `RESIDUAL-W76-1` | 503 `details.reason` dropped | - | A reset refused because another runs and a reset that failed both read "The Core server is starting. Nothing was changed." |
| R-D4 | (gap W76-3, F75-1) | export `rows` / `head` dropped | - | The export pages read the row count and head from the `AUDIT_EXPORTED` row in the replica, not from the answer |
| R-D5 | (`@dems/shared/realtime`) | entry re-exports a React file | - | The entry re-exports a React file; server-side tests import the socket client by file |
| R-E1 | `RESIDUAL-W63-1`, `-W66-2`, `-W69-1`, `-W70-2`, `-W80-1` | no seeded role can be refused | - | Operations 41, 49, 50, 60, 65 and 70 show no NOT_PERMITTED example: no seeded role can be refused there; their 403 texts still name the code |
| R-E2 | `SIM-GAP-W34-1`, `SIM-GAP-W39-1` (not renamed) | known differences of both modes | - | A faulted session's recording time keeps counting; the simulator's `AUDIT_EXPORTED` row counts its ring of 1,000 |
| R-E5 | `RESIDUAL-W71-1`, `-W73-1`, `-W78-2`, gap W78-1 | new Core capabilities | In Live mode the SMART counters, the recovery check details and the device health lines are derived on the client from the Core's data, and the camera picture is the bundled demo loop (`README.md:337`) | - |
| R-E6, R-E7, R-E8, R-E10, R-E11 | `RESIDUAL-W74-1`; `SIM-GAP-2`; T6, T7; T25, T33, T34; T36 | as the ruling sheet says (part 1 section 6.3) | - | as the sheet says; R-E11 (CLIP chip press guard) handed to W100 |
| R-E9 | (reason length) | units differ | - | A reason is counted in characters by the Core server and in UTF-16 code units in Simulated mode; only astral input differs |
| DQ-3 (b) | - | heartbeat member not strict | - | The union's `heartbeat` member is not strict (AC-B-46 erratum S-7); the shared-state test checks its members |
| - | `RESIDUAL-W69-2` | accepted evidence-media cache key (D158 DC-1) | - | covered by R-E4 |

Not counted as gaps but kept: `SIM-GAP-W36-1` (hypothetical, R-E3), the design-book refactors T4, T5, T9 (deferred to W92, R-E3).

### 4.4 Predecessor known issues touched

| Issue | State | Evidence |
|---|---|---|
| KI-07 (`SIM-GAP-M*` markers in the mobile app) | **13 IDs / 62 markers at `acaff20` and in the worktree, unchanged**. The plan's text says 68 (O-9) | `grep -rhoE "SIM-GAP-M[0-9]+-[0-9]+" apps/mobile/src` and `git grep ... acaff20` (section 12); D148, D167 DN-4, D169, D186 |
| KI-18 | closed | D185 |
| KI-01 | the tablet's Pair-screen layout squeeze recorded as KI-01's state; candidate fix filed with KI-10 | D137 DN-1 |
| KI-02 | open (no Maestro flows); Maestro CLI starts outside the sandbox | D26 |
| KI-21 | APK and keystore backed up before prebuild | D34 |
| KI-24 | fixed by W01c; open for one more full gate cycle | D42 |

---

## 5. Host changes and their rollbacks

Commands are quoted, never run by this row. Credential files are named by path and mode only.

### 5.1 Register

| ID | Change | State at this report | Rollback (verbatim; the user's or controller's instruction only) | Source |
|---|---|---|---|---|
| H-01 | npm: root dev `embedded-postgres` 18.4.0-beta.17 (brings `@embedded-postgres/darwin-arm64`, PostgreSQL 18.4) and `pg` 8.23.1; one `allowScripts` entry `@embedded-postgres/darwin-arm64@18.4.0-beta.17`; server workspace slot N1: `drizzle-orm` 0.45.3, `drizzle-kit` 0.31.11, `@fastify/cookie` 11.1.2, `@fastify/rate-limit` 11.2.0, `@fastify/helmet` 13.1.1, `fastify-type-provider-zod` 7.0.0, `@fastify/swagger` 9.9.1, `openapi-types` 12.1.3, `rate-limiter-flexible` 11.2.1, `@vitest/coverage-v8` 5.0.3, `@types/pg` 8.23.1, `pg` 8.23.1; slot N3 `expo-secure-store` `~57.0.4` (lock 57.0.4); slot N2 `qrcode.react` 4.2.0 and `react` 19.2.3 declared in the server workspace | installed (manifest diffs, section 12) | `npm run pg:remove` = RB-02 then RB-01: `/usr/bin/lockf -k -t 3600 "$ROOT/.locks/npm.lock" npm uninstall embedded-postgres pg` and `npm install-scripts prune` (written, never run: `README.md:348`). The other packages: the tracked-source rollback of `02_plan.md:1490`, only on an explicit request | D27, D34, D39; `02_plan.md:1433-1436` |
| H-02 | PostgreSQL cluster `.data/postgres/`; credential files `.data/pg.pwfile` (superuser `dems_admin`), `.data/pg.owner.env` (`dems_owner`), `.data/pg.env` (`dems_app`); logs `.data/postgres.log`, `.data/pg-scripts.log` | `.data/` mode 700, the five files 600 (`ls -la`, names and modes only); 207 MB; `postgres.log` 57 MB at D146 and not rotated (F41; CPS1-9 open) | `npm run pg:remove-data` (RB-02): `"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop` then `rm -rf "$ROOT/.data"` | D32, D146; `02_plan.md:1438-1440` |
| H-03 | PostgreSQL process on `127.0.0.1:4432`, PID 19121 | listening at 09:0x (`lsof`); never restarted since D32 (D142, D146) | `npm run pg:stop` (RB-03): `"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop`; `lsof -nP -iTCP:4432 -sTCP:LISTEN` prints nothing | D32 |
| H-15 | Roles `dems_admin` (superuser, provisioning only), `dems_owner` (CREATEDB), `dems_app` (no flag); databases `dems_demo`, `dems_lane_1`, `dems_lane_2`, `dems_lane_3` (`pg_database` 7 rows incl. PostgreSQL's own three) | last recorded states: `dems_demo` reset by W86 - audit head 90, 1 lineage row, 6 auth sessions, 0 paired devices (D188 F86-6); `dems_lane_1` holds `DEV-0001` (the phone, D143 DN-2); `dems_lane_2` holds `DEV-0001` (the tablet, D137 DN-6); `dems_lane_3` reset to epoch 19 by W76 (D178) | `npm run db:reset -- --database dems_demo` (RB-15; likewise the lanes); the databases go with RB-02 | D32, D62, D74, D114, D142 |
| H-04 | Core server processes on 4420-4423 | none listening at 09:0x; PID and lock files remain under `.locks/core-server*` | RB-04: `kill "$(cat "$ROOT/.locks/core-server.pid")"`; `kill "$(cat "$ROOT/.locks/core-server.lane1.pid")"` (likewise lane2, lane3); `lsof -nP -iTCP:4420-4423 -sTCP:LISTEN` | `02_plan.md:1446-1449` |
| H-05 | `adb reverse tcp:4420` rules | removed by each device session per the rows; not probed now | RB-05: `adb -s emulator-5554 reverse --remove tcp:4420` (likewise 5556, 5558); README form `adb -s emulator-5554 reverse --remove-all` | `02_plan.md:1452`; `README.md:349` |
| H-06 | Debug APK rebuilt (versionCode 100, SHA-256 `d89c9be3...8a14ec`) installed with `adb install -r` on the `dems_*` and the `dems2_*` AVDs | installed | RB-06 as amended: `adb -s emulator-5554 install -r -d "$ROOT/.cache/apk-backup/app-debug.apk"` | D34, D63 |
| H-07 | Device credentials and possible biometric tokens in the app's secure storage: `dems2_phone` (paired with lane 1), `dems2_tablet` (paired with lane 2) | as recorded | RB-07: Revoke in Paired Devices, or Unpair in the app (Settings -> Pairing); `pm clear` not used without a recorded decision | D137, D143; `02_plan.md:1457-1459` |
| H-08 | Session cookies for `127.0.0.1` and `localStorage['dems.core.mode.v1']` in the browsers the rows drove | browser profiles of the rows | RB-08: sign out; `localStorage.removeItem('dems.core.mode.v1')` in the console of each origin used; clear the cookies of `127.0.0.1` | `02_plan.md:1461-1464` |
| H-09 | Network: npm registry (W03, W13, W14), Maven (W13), `npm audit signatures` (W03, W14), live `npm audit` (W58), one anonymous GET of PostgreSQL's `COPYRIGHT` at tag `REL_18_4` by the controller | caches only | none needed | D27, D34, D39, D66, D146 |
| H-10 | AVD camera settings | **not changed** | - | DR-02 |
| H-11 | `.locks/` files (postgres, db-migrate, core-server and lane PID / lock / log files, emulator PID and log files, npm, gradle, vite, mock-core) | present (names listed in section 12) | RB-11: `rm -f "$ROOT"/.locks/postgres.pid "$ROOT"/.locks/postgres.lock "$ROOT"/.locks/db-migrate.lock "$ROOT"/.locks/contract.lock "$ROOT"/.locks/core-server*.pid "$ROOT"/.locks/core-server*.lock "$ROOT"/.locks/core-server*.log` | `02_plan.md:1466-1468` |
| H-12 | Homebrew fallback | **not used** (fallback Fb not needed) | - | D32 |
| H-13 | Per-command sandbox bypass | session-only | - | - |
| H-14 | Emulator processes: three `dems_*` booted by W02, stopped gracefully by W02b; three `dems2_*` booted by W02b, running since 2026-10-04 10:38 (D130) | not probed now (`ps` refused by the sandbox) | RB-14: the user closes each emulator window | D63, D130 |
| H-16 | Two stale `user-manual-test` markers removed | done | RB-16: `mkdir -p "$ROOT/.locks/mock-core.users" "$ROOT/.locks/vite.users"`; `touch "$ROOT/.locks/mock-core.users/user-manual-test" "$ROOT/.locks/vite.users/user-manual-test"` | D26 |
| H-17 | `.cache/` scratch: proofs, `apk-backup`, `rollback/**` pre-images of every row and round (W01b ... C1), per-row scratch folders | 5.3 GB | RB-17: `rm -rf "$ROOT"/.cache/proof-engine "$ROOT"/.cache/proof-harness "$ROOT"/.cache/proof-drizzle "$ROOT"/.cache/rollback` (keep `.cache/apk-backup` until the task has ended) | `02_plan.md:1486-1487` |
| H-18 | Vite and Metro processes of live checks | none listening on 5173-5178 or 8081 at 09:0x | the rows stop the PIDs they record | - |

### 5.2 Host changes the register did not foresee

| ID | Change | State | Rollback / undo | Source |
|---|---|---|---|---|
| X-1 | Three new AVDs `dems2_phone`, `dems2_tablet`, `dems2_phone2` under `~/.android/avd/` (about 5.9 GiB at creation) | in use | the user's action, after `adb -s <serial> emu kill`: `zsh -l -c 'avdmanager delete avd -n dems2_tablet'`, `zsh -l -c 'avdmanager delete avd -n dems2_phone'`, `zsh -l -c 'avdmanager delete avd -n dems2_phone2'` | D58, D63, DR-08; `README.md:465-468` |
| X-2 | The predecessor's AVDs `dems_phone`, `dems_tablet`, `dems_phone2` kept on disk (about 15.3 GiB), not booted again; their PIN was set by the predecessor's agents (F36) | kept | the user's decision (D63 DN-7): `zsh -l -c 'avdmanager delete avd -n dems_tablet'` (likewise `dems_phone`, `dems_phone2`) | `README.md:461-464` |
| X-3 | **The user's own emulator lock** (not an agent's): at about 20:33 on 2026-10-04 the user ran `apps/mobile/scripts/emulator-user-lock.sh setup phone` and `... setup tablet` -> PIN and one fingerprint on `dems2_phone` and `dems2_tablet`; `dems2_phone2` stays lock-free. The value is not printed in any document | unchanged per every later device row (D129-D188) | **Undo (the user's command):** `apps/mobile/scripts/emulator-user-lock.sh remove phone` and `apps/mobile/scripts/emulator-user-lock.sh remove tablet` | D125 |
| X-4 | The adb server started by W02 left running (`127.0.0.1:5037`, `lsof`) | running | `~/Library/Android/sdk/platform-tools/adb kill-server` (`README.md:471`) | `delegation_progress_report.md:51` |
| X-5 | At the user's explicit request: `~/.claude/CLAUDE.md` section 6 (8 per type / 8 in flight) and four restatements (`skills/master-controller/SKILL.md`, `skills/orchestrator-worker/SKILL.md`, `skills/long-document-assembly/SKILL.md`, `commands/delegate.md`); `skills/vendor-crawler/SKILL.md` left as it was | in effect | no undo command recorded (the earlier figures were 2 / 4) | D45, D46 |
| X-6 | Project memory notes: the concurrency preference; the user's emulator test-PIN choice | persisted | - | D44, D60 |
| X-7 | `apps/core-server/logs/errors.log` (mode 0600, git-ignored) joined the register | never created yet | - | D40 (5), D146 F-7 |
| X-8 | `.gitignore` gained `/.data/` (W03) and `.vitest/` (W104) | tracked | tracked-source rollback | D27, D150 |
| X-9 | `apps/core-web/dist` (pre-existing, git-ignored) rebuilt by the CP-W1 reviewer | present | - | D144 CPW1-15 |

### 5.3 Git commits (local; `git remote -v` prints nothing)

| Commit | Time (WIB) | Files | Rollback |
|---|---|---|---|
| `4b708c8` docs: research, specs, plan | 2026-10-04 06:25:02 | 59 (Markdown only) | `git reset --soft acaff20` (D24) |
| `b90a3c6` checkpoint 1 after the backend gate | 2026-10-05 20:16:38 | 1,562, +386,422 / -6,324 | `git reset --soft 4b708c8` (D150) |
| `057fc17` checkpoint 2 after the client waves | 2026-10-06 03:31:50 | 754, +82,162 / -1,859 | `git reset --soft b90a3c6` (D183) |

The predecessor's open item F3 (`.git/refs/.DS_Store` makes `git fsck` exit 8) was not touched; the user was told `rm .git/refs/.DS_Store`.

---

## 6. Test ledger

### 6.1 Over time (quoted from the decisions; "files / tests"; blank = not reported at that gate)

| # | When (WIB) | Source | shared | mock-core | core-web | mobile | server `unit` | server `db` | pg-scripts |
|--:|---|---|---|---|---|---|---|---|---|
| 0 | baseline `acaff20` | D10 | 28 / 508 | 4 / 19 | 39 / 436 of 438 | 72 / 833 | - | - | - |
| 1 | 10-04 W01 | D25 | | | 39 / 438 | | | | |
| 2 | W03 | D27 | 508 | | | | 1 / 1 | | |
| 3 | W07 | D32 | | | | | | | 7 / 55 |
| 4 | W08 | D40 | | | | | 17 / 330 | | |
| 5 | W11 | D48 | | | | | 24 / 526 | 10 / 52 | |
| 6 | W17 | D54 | | | 438 | | 979 | 19 / 285 | |
| 7 | SIM-GAP-1 | D56 | 47 / 1,012 | | 438 | 833 | | | |
| 8 | W21 11:09 | D67 | | | | | 41 / 1,281 | 27 / 382 | |
| 9 | W12 device 11:14 | D69 | 57 / 1,406 | | | 72 / 833 | | | |
| 10 | W15 | D71 | | | | 74 / 870 | | | |
| 11 | W11b, W26 12:28-12:42 | D76, D77 | | | | | 70 / 1,848 | 45 / 623 | |
| 12 | W44 12:38 | D75 | 64 / 1,650 (baseline restated 28 / 517) | | | | | | |
| 13 | W28 14:11 | D83 | | | | | 77 / 1,992 | 48 / 740 | |
| 14 | CP-C1 round 1 14:18 | D84 | 68 / 1,735 | | | | | | |
| 15 | D85 fix, round A 15:54 | D95, D96 | | | | | 112 / 2,822 | 80 / 1,112 | |
| 16 | W40 16:52 | D104 | | | | | 137 / 3,536 | 106 / 1,516 | |
| 17 | CP-C1 round 3 17:05 | D107 | 68 / 1,807 | | | | | | |
| 18 | W42 17:54 | D111 | | | | | 141 / 3,609 | 108 / 1,540 + 1 skipped | |
| 19 | W50 19:40 | D121 | | | 48 / 598 | | | | |
| 20 | B2a, W51 20:25-20:29 | D122, D123, D124 | 68 / 1,813 | | | 82 / 992 | 147 / 3,795 | 119 / 1,707 + 1 by-design red | |
| 21 | W55, W56 21:47-21:58 | D128, D129 | | | 55 / 758 | 90 / 1,185 | | | |
| 22 | resume 10-05 08:59-09:05 | D130 | 68 / 1,814 | 4 / 19 | 55 / 759 | 90 / 1,187 | 152 / 3,845 | 121: 1,725 passed, **2 failed** | |
| 23 | W58 backend gate | D146 | 68 / 1,814 | | 759 -> 760 (D147) | | 153 / 3,912 | 122 / 1,740 | 55 / 55 |
| 24 | before checkpoint 1, 20:07-20:12 | D150 | 68 / 1,814 | 4 / 19 | 55 / 760 | 94 / 1,230 | 153 / 3,912 | 122 / 1,740 | |
| 25 | M0 22:38 | D151 | | | | 96 / 1,257 | | | |
| 26 | W0 10-06 00:48 | D165 | | | 78 / 1,012 | | | | |
| 27 | W77 + W0c 02:04 | D174 | | | 93 / 1,242 | | | | |
| 28 | M2b 03:01 | D181 | | | | 140 / 1,721 | | | |
| 29 | checkpoint 2, 03:22-03:28 | D183 | 68 / 1,814 | 4 / 19 | 95 / 1,255 | 140 / 1,721 | 154 / 3,916 | 122 / 1,740 | |
| 30 | W83 04:24-04:30 | D185 | 69 / 1,840 | | 95 / 1,255 | 140 / 1,721 | 154 / 3,916 | 122 / 1,740 | |
| 31 | copy round, W84 05:15-05:29 | D186, D187 | 69 / 1,840 | | 101 / 1,384 | 140 / 1,721 | | | |
| 32 | **W87 final 08:25-08:32 (controller 08:42-08:46)** | **D189**; `test/01_test_report.md` section 10 | **69 / 1,840** | **4 / 19** | **103 / 1,392** | **145 / 1,743** | **154 / 3,916** | **122 / 1,740** (0 databases left) | 7 / 55 (D32, D146) |

### 6.2 The final ledger and what W89 expects

The final ledger is row 32 (D189); no later decision changes it. W87 states the expectation for W89: web 103 / 1,392 and mobile 145 / 1,743, and the 78 protected files compared with `test/assets/01_protected_tests_sha256.txt` (`test/01_test_report.md:663`). Backend coverage at W87: lines 96.93 %, statements 95.78 %, branches 90.12 %, functions 97.81 % (D189). In flight, not gated: C1 adds `apps/mobile/src/runtime/log-flush-timer.test.ts` (1 test, `delegation_progress/coder_execution_c1.md`), so the mobile floor is expected to move to 146 / 1,744 when C1 is gated; C1 also changes assertions inside `packages/shared/test/api-openapi-scope.test.ts`.

---

## 7. Success criteria SC1-SC11

| SC | Statement [`02_plan.md:1351-1363`] | Proven so far | Remaining for W89-W103 |
|---|---|---|---|
| SC1 | Spec and plan dated before the first implementation log | Docs commit `4b708c8` at 2026-10-04T06:25:02+07:00 holds the specs and the plan (D24); W01's log file was created 2026-10-04T06:37:47 (`stat`, section 12) | W101 states the verdict |
| SC2 | Documented start, migrations from empty, seed, state survives a restart | Migrate from empty and the catalog diff (D54); seed (D62); restart acceptance, 12 restarts over 30 tables (D110); gate smoke on 4420 (D146); every new README command run once (D188) | W90 follows the README from `pg:remove-data` (H-02 / H-03 proven, SU-1 hashes, the real T5-j run); W101 |
| SC3 | Both clients use the backend; an action on one is visible on the other | Two-client acceptance test, 2,934 frames (D119); first contact of the client layer with the server, no mismatch (D111); a real recording on the paired tablet with meters on the web console (D154); the twenty page rows (D152-D179) | W95 end-to-end on the main instance and the reserved emulator; W101 |
| SC4 | Role-by-endpoint test; a denial refused and audited; a role change on both clients | 1,200 cells, later 1,649 (D117, D123 (b)); denied call with one `ACCESS_DENIED` row in the gate smoke (D146); next-request rule (D91); role change through Users & Roles on lane 3 (D172, D174) | W96 end-to-end within 1 s on both clients; W101 |
| SC5 | Pairing gate, listing, revocation, an audit row per step | 47-row lifecycle trail incl. revocation mid-recording (D116); tablet paired on lane 2 (D137); gate and release on lane 1 (D143); issue and cancel on lane 3 (D179) | W94 in **one continuous session** (D143 DN-1); W101 |
| SC6 | OpenAPI describes every endpoint; drift test; API Reference live | 337 of 337 operation-status cells, empty undocumented and unregistered lists (D115); close-out: 0 gap markers, `all` 75 operations v0.2.1, offline 10 v0.1.0 (D185); live Try-it on `127.0.0.1:5178` (D187) | C1 replaces the mock-core health example of the `all` scope (F84-3, in flight); W101 |
| SC7 | Existing suites and new backend tests pass | 75 / 75 operations with a success test, 41 / 41 denial, 25 / 25 validation; 54 / 54 sites; every workspace green at the ledger (D189) | W89 root gate (with PostgreSQL stopped, then `test:db`); W101 |
| SC8 | Simulated mode and the 0.1.0 packages still work | Partial, by command (section 12): the four protected web test files at their recorded hashes; 0 of the 72 mobile baseline test files changed; simulator diff = W16 + SIM-GAP-1 (5 files); `apps/mock-core` and `scripts/release` unchanged; KI-07 13 / 62 as at `acaff20` | W97: the 61 files, `shasum -a 256 -c` over `release/` (git-ignored, so git cannot show it), the launcher self-test, mock-core 19, Simulated walk; W101 |
| SC9 | Decisions, drift and findings recorded | `decisions.md` D1-D189, DR-01-DR-13, F1-F79; this report | W102 cross-check; W101 |
| SC10 | No secret committed, no personal data, nothing sent out | Content scans of both checkpoint commits (D150, D183); `git remote -v` empty; network actions listed in H-09 | W99, W100; W103's scan; W101 |
| SC11 | README gives the exact Live-mode commands | W86 ran every new command once; additions only; `127.0.0.1` not `localhost`; the two AC-B-92 sentences present (D188) | W90 follows the README literally; W101 |

---

## 8. Open items for the controller

### 8.1 Deviations or findings not yet tied to a decision (or ruled but not executed)

| # | Item | Evidence | Suggested owner |
|--:|---|---|---|
| O-1 | **The evidence `.log` files of the task folder are not versioned.** F39 ruled that W104 appends `!docs/**/assets/*.log`; `.gitignore` has no such line, W104's log does not mention it, W105's log lists five `81_*.log` as ignored. **650 `.log` files** under the task folder are git-ignored and absent from `b90a3c6` and `057fc17`; row documents cite them as evidence (for example `assets/57_gate_final.log`, `.gitignore:48 *.log`) | `git ls-files --others --ignored --exclude-standard -- docs/2026-10-04_dems_backend_rbac_pairing` (650 `log`, 1 `.DS_Store`); `git check-ignore -v`; `98_checkpoint_commit_2_web.md:166` | a ruling before W103 (an append-only `.gitignore` edit) |
| O-2 | Plan section 8.7 names differ from the real logs of W72, W73, W76, W80 (section 2.8); only W83's difference is recorded (D184 DQ-9) | script over `02_plan.md:810-916` | a one-line record in `decisions.md` |
| O-3 | D90 (and D86 decision 34) asked W58 to "observe whether a refused POST moves the Core's idle expiry"; `gateway_check/06_backend_gate.md` has no such observation | `grep -i "refused POST" gateway_check/06_backend_gate.md` -> nothing | W89 or W90, or an explicit acceptance |
| O-4 | FW76-1 (a rebuilt 422 carries no HTTP status), FW76-3 ("Nothing was changed." beside an accepted export), FW76-6 (the kit `Select` drops `aria-busy`) were routed by W76 to "W83 / W88"; D178 does not rule them and W83's ledger does not hold them | `implementation/76_web_system_demo.md:360-365` | W92 or a ruling |
| O-5 | CPW1-2 still open in W54's document: `implementation/54_web_shell_admin_routes.md` section 24.1 (lines 801-813) says two of the three named files "have never existed". **Corrected record:** `apps/core-web/src/test/routes.test.tsx`, `apps/core-web/src/lib/__tests__/core-endpoint.test.tsx` and `apps/core-web/src/lib/__tests__/packaged-csp.test.ts` exist and `git diff --stat acaff20` prints nothing for them; F76-13 is withdrawn (D144); the plan's CLG clause is met by name | `find`, `git diff --stat acaff20 -- <the three paths>` (section 12) | W54's document holder |
| O-6 | CPW1-10 open: `packages/shared/test/i18n.test.ts:2` says "13 namespaces" while `:93` pins 15. Owner "W54 or W88" (`08_cp_web_runtime.md:658`); W88 writes no source | `grep -n namespace packages/shared/test/i18n.test.ts` | a writer row (W92's follow-up) |
| O-7 | CPW1-7 (an unguarded `await bootCoreRuntime(...)` at `apps/core-web/src/main.tsx:45`: a rejected boot leaves a white page) is open; not a one-line fix because `main.tsx`'s import lists are pinned by `live-runtime-static.test.tsx:106-134`; D147 routes it "to a structural slot before W89" - no such slot has run | `08_cp_web_runtime.md:323, 656`; D147 | a slot before W89, or a ruling |
| O-8 | F43 routes the scratchpad check to "the closing security review (W96)"; W96 is the SC4 end-to-end row, the security reviews are W99 and W100 | `decisions.md:261` | relabel to W99 |
| O-9 | Plan section 17 and W97's verification cell say KI-07 "at most 13 IDs and 68 markers"; measured 62 at `acaff20` and now (D148) | `02_plan.md:1537`; grep in section 12 | W97's brief uses 62 |
| O-10 | Stale comment left by D41 for "the next writer": `packages/shared/src/i18n/en/common.ts` near line 565 says the nine earlier labels are in `securityAudit.rbac.permissions.*` (that map holds all twelve since D41) | `sed -n 560,572p` of the file | W92 |
| O-11 | Numeric prefix shared in `gateway_check/`: C1's `10_closing_fixes_c1.md` and W89's planned `10_root_gate.md` (names differ; ordering only) | `delegation_progress_report.md:284`; `02_plan.md:900` | the controller |
| O-12 | The W15 secure-store re-probe with the user's lock present has no owner row; it needs the user's finger | D71, D125 (3), D141 (3); `status_tasks.md:123` | a slot with the user, or accept the unprotected mode as final (W100) |
| O-13 | Tracker hygiene: `status_tasks.md:22` ("rows 14 ... 22 pending"), `:37` (B2b "queued"), `:122` (fragments naming W105 as still to come) and `:123` ("queue after wave 4") are stale against D150-D189 | `status_tasks.md` | the controller |
| O-14 | CPS1-9 (`log_error_verbosity = terse` and a size bound through `scripts/pg`) and D146 F-6 (`postgres.log` 57 MB) wait for "the quiet restart of W89"; W89 is a read-only verifier row, so no writer is assigned | D113, D141 (4), D146 | a `scripts/pg` writer slot around W89 |
| O-15 | B2b leftovers routed without a scheduled slot: F-B2b-1 (the realtime shim pinned by `support.db.test.ts:142`), F-B2b-2 (core / engine / admin support decoupling), CPB1-18, -19, -22, -25 (owner folders), CPB1-24 (a controller ruling), CPB1-26 (W91) | `04c_cp_backend_fix_round_b2b.md:76-85, 189-195`; D139 DN-2 | W91 and one small serial slot |
| O-16 | CPB1-20: "record hand-built parts without an HB number" is "a decision of the controller"; D87 lists it for W88. The register is section 10; the ruling (accept under I1, or not) is still to be made | D87; `04_cp_backend_foundation.md:244, 271` | the controller |

### 8.2 Routed items whose owner row is still to come

| Owner | Items |
|---|---|
| **C1 (in flight)** | W87-F1 (`log.ts` timer `unref`), W87-F2 (`shared-state.test.ts:706-712` wording), F84-3 (the `all` scope health example), F86-1 (root `package.json:26-27` emulator scripts name the old AVDs) (D187, D188, D189) |
| **W89** root gate | Repeat the shifted-clock sweep at three instants (D31); expect web 103 / 1,392, mobile 145 / 1,743 (plus C1's +1 / +1) and compare the 78 protected files (D189); restate the server ledger (D142 F W3-5); KI-24 one more cycle (D42); O-3, O-7, O-14 if the controller assigns them here |
| **W90** clean rebuild | Talk to the user first (it removes `.data/`, `status_tasks.md:122`); four expired web sessions or the reset state of `dems_demo` (D146 F-4, D188 F86-6); the real T5-j run (D32 (6)); SU-1 hashes; H-02 and H-03 proven |
| **W91** code review core-server | B2b item-10 leftovers and CPB1-26 (O-15); `limits.ts` may import the new pairing constants and the server may adopt `PAIRING_CODE_CLOSE_REASONS` (W83 ledger rows 11, 59); the `BE-GAP-W36-1` history markers (ledger row 19) |
| **W92** code review shared and web | `live-sim.ts` split (D84); the W77 query pattern of F75-2 (D176); Retry buttons calling `refetch()` past the signed-in gate, `devices/motion.ts:82` logging message and stack, page loggers not on `createPageReporter`, near-copy download helpers (D182); the health query to `lib/` (CPW1-9, D187); W83-T4, T5, T9 (R-E3); W87-F3 "one toast" titles (D189); O-4, O-6, O-10 |
| **W93** code review mobile | M2's sweep list of 11 places (D180 DN-6); stored tablet link during an outage (D180 D-1); W87-F3 |
| **W94** E2E pairing | One continuous session from the unpaired app to the LIVE sign-in (D138, D143 DN-1); the lane split of reconnect checks (D173 DN-G4); no burst of refused calls before re-pairing (D116) |
| **W95, W96, W98** | Count audit deltas relative to the state after their boot (D146 F-4, D188 F86-6); W98 inputs: snapshot about 195 kB, `health` replace 19.5 kB at 1 Hz (D53) |
| **W97** regression | Simulator diff read as "W16 plus SIM-GAP-1" (D80, D90); KI-07 62, not 68 (O-9); the four web test files at their recorded hashes (D25, D31, D42) |
| **W99** security backend | `npm audit` triage: 80 entries, 50 high, 0 critical, none in the server's runtime chain (F29, D146 F-3); F76 (class bucket after a revoke); F79 (2), (3); clock ahead of stored state, refuse beyond a threshold? (D122 DN-B2a-3); the presenting device on `TOKEN_REUSE` rows (D123 DN-2); a row for the `DEVICE_CREDENTIAL_REQUIRED` refusal? (D118 FU-4); `errors.log` never created (D146 F-7); Fastify deprecation warning (D146 F-8); a guard reading the repository root must skip `.locks` and `.data` (D161); the scratchpad check (F43, O-8); the three Info items for use beyond one loopback computer (D113) |
| **W100** security clients | MB-6a: biometric sign-in off on a physical device in a release build (D71 DN37-2); a died process re-presents a sent token (D129 DN-1, D148 answer 1: the `presented` flag); DN-8 of W57 (D137); app-wide link banner (D159 DN-5); LogBox banner over the export sheet in debug builds (D163 F-9); closable sheet while in flight (D168 DV-6); CLIP chip look and press guard (D170 F-5, R-E11); Finalization shows no link notice (D171); owed sign-out when the link is down at the mode switch, both clients (D177 DN-3); reconnect lane split (D173 DN-G4) |
| **W101** | SC1 comparison (section 7) |
| **W102** | Cross-check every D, DR, F against the row logs; this report's open items |
| **W103** | O-1 (the `.log` evidence files); the untracked task documents incl. `98_checkpoint_commit_2_web.md` (left for checkpoint 3 by D183); never `release/`, `.data/`, `.cache/`, `.locks/`, `apps/mobile/signing/`, the design book, any credential file |

### 8.3 Decisions that stay with the user

| Item | Ref |
|---|---|
| Keep or delete the predecessor's AVDs (about 15.3 GiB) | D63 DN-7 |
| The PostgreSQL on `*:5432` that this task did not install: keep the project-local instance (default) or point the backend at it | F27, D26 |
| `.git/refs/.DS_Store` (`git fsck` exit 8): `rm .git/refs/.DS_Store` | F3 |
| A web-only Live demo cannot record without a connected paired tablet (default: as specified) | F69 |
| W90 removes `.data/`: a word with the user first | `status_tasks.md:122` |
| The W15 re-probe needs the user's finger | D125 (3), O-12 |
| Undo of the emulator lock: `apps/mobile/scripts/emulator-user-lock.sh remove phone` / `remove tablet` | D125 |
| Any network exposure beyond loopback requires replacing the seeded password first | D16 (C1-C4); `README.md:228` |
| A live package for another PC is a separate task | D11 TD-13; `02_plan.md:1500-1507` |

---

## 9. File-count reconciliation

### 9.1 The total

```text
$ git diff --stat acaff20 | tail -1          # 2026-10-06 09:03:46 WIB
 2367 files changed, 491935 insertions(+), 8196 deletions(-)
$ git diff --stat acaff20 HEAD | tail -1
 2349 files changed, 490362 insertions(+), 8089 deletions(-)
$ git diff --stat HEAD | tail -1
 127 files changed, 2007 insertions(+), 541 deletions(-)
$ git ls-files --others --exclude-standard | wc -l
      86
```

### 9.2 Commits against the distinct count

The three commits hold 59 + 1,562 + 754 = 2,375 file entries. 23 files appear in more than one commit (20 in two, 3 in all three; for example `decisions.md`, `status_tasks.md`, `delegation_progress_report.md`, `01_gate_report.md`, `01_specs.md`), so 2,375 - 26 = **2,349** distinct files, equal to `git diff --stat acaff20 HEAD`. Since `057fc17`, 127 tracked files differ from HEAD; 18 of them were unchanged between `acaff20` and HEAD - `README.md` (W86), 13 files of `apps/core-web/src/features/api-reference` (W84), `packages/shared/src/i18n/en/api-reference.ts` (W84), the two mobile `sim-adapter.ts` comments (W83 L9) and `apps/mobile/src/runtime/log.ts` (C1) - and none of the 2,349 has gone back to its `acaff20` content (`comm` over the three name lists, section 12), so 2,349 + 18 = **2,367**. Untracked files (86) are not in `--stat`.

### 9.3 Partition of the 2,367 tracked files by owned area (`git diff --name-status acaff20`, per path)

| Area | Files (A / M) | Rows that wrote it |
|---|--:|---|
| `apps/core-server` | 573 (573 / 0; the workspace is new) | W03 5; W08 34 + `test/static` 15 (and rounds A, B1, B2b, static slot); W09 5; W11 + W11b 56; W17 47; W20 29; W21 29; W23 11; W24 32; W25 22; W26 37; W28 21; W29 19; W32 24; W33 14; W34 16; W35 17; W36 9; W37 13; W39 17; W40 17; W41 20; W42 27; W43 15; acceptance W47-W53 8; `test/support` + `drop-dead-run.ts` 12 (B1, W42 follow-up, B2b item 13); `src/__tests__` + `test-configuration.ts` 2 (B2b item 4) - sum 573 |
| `scripts/pg` | 22 (22 / 0) | W07 |
| root files | 5 (0 / 5) | `.gitignore` (W03, W104), `package.json` (W03; C1 now), `package-lock.json` (W03, W13, W14), `README.md` (W86), `THIRD_PARTY_NOTICES.md` (W85) |
| `packages/shared` | 133 (97 / 36) | contract slot 33 (W19, W22, W27, W83, C1) + contract tests 13 (+1 U); W12 client 2 + tests 4; W16 / SIM-GAP-1 `src/sim` 5 + tests 4 (`auth`, `i18n-vocabulary-sync`, `i18n` by W54 under D126, `sim-text-cut`); W18 14; W30 4; W31 15; W44 23; `i18n` 15 (W16, W50, W54, W55, the page rows, the copy round); `package.json` 1 (W03) - sum 133 |
| `apps/core-web` | 238 (129 / 109) | features 136 (W54-W84 page folders; `home` 1 by grant D136); `src/test` 52 (W01 1 M; live tests of W50-W84, W0, W1); `components/shell` 15 (W54); `components/{composed,media}` 4 (W0); `runtime` 13 (W50, CP-W1 fix); `lib` 9 (W50, W0, W1); `routes` 4, `main.tsx`, `router.tsx`, `routeTree.gen.ts` 3 (W50, W54); `vite.config.ts` 1 (W05); `package.json` 1 (W14) - sum 238 |
| `apps/mobile` | 205 (109 / 96) | features 143 (W57-W82 folders); `runtime` 36 (W12, W15, W51, M0, M1, M2, the D173 fixes, C1); `auth` 15 (W56); `navigation` 6 (W60, M1); `scripts` 2 (W13, W02b); `jest.setup.ts`, `package.json`, `i18n/en.mobile.ts` 3 (W15, W13, W51 / W82) - sum 205 |
| `docs/2026-10-04_dems_backend_rbac_pairing` | 1,186 (1,186 / 0 against `acaff20`) | every row's document and assets; delegation progress 133; `implementation/assets` 816; `gateway_check/assets` 81; `test/assets` 25 |
| `docs/2026-09-30_dems_demo_stack_setup` | 5 (2 / 3) | the predecessor's closing trackers, committed with the docs commit (D3) |
| **Total** | **2,367** | 573 + 22 + 5 + 133 + 238 + 205 + 1,186 + 5 |

**Why per-row sums exceed the total.** A file counted once above was written by several rows: the contract slot (W19, W22, W27, W83, C1); `readiness.test.ts` and other seam tests (D52, D72, D77); the guard's tests (D82, D85); the scaffold health test (D99); the shared i18n namespaces; the page folders later edited by W0, W1, M1, M2, the copy round and W83's marker renames (31 files, D185); `shared-state.test.ts` (W49, C1). The row cells of section 2 therefore give the footprint of each owned path with all its writers, not a disjoint share.

### 9.4 What is outside `--stat`, and the parallel writer

| Class | Count | What |
|---|--:|---|
| Untracked docs | 69 | W84, W86, W87, copy round, checkpoint-2 documents and assets (63), plus C1's progress file and 5 assets (6) |
| Untracked code | 17 | web 10 (W84 4, copy round 4, W87 2), mobile 6 (W87 5, C1 1), shared 1 (`api-closeout.test.ts`, W83) |
| This row | +2 after writing | this file and `delegation_progress/data_analyst_step_110.md` |
| Ignored, never counted | - | `.data/`, `.cache/`, `.locks/`, `node_modules/`, `apps/mobile/android/` (prebuild output), `apps/core-web/dist`, `.vitest/`, and **650 `.log` evidence files under the task folder** (O-1) |
| C1 delta so far | +1 tracked, +1 untracked code, +6 docs | `apps/mobile/src/runtime/log.ts` newly modified against `acaff20` (the total moved 2,366 -> 2,367 between 08:50 and 09:03); `log-flush-timer.test.ts`; its other edits fall on files already counted. Its log `gateway_check/10_closing_fixes_c1.md` will add one more untracked document |

---

## 10. Hand-built parts register (D12, D87 CPB1-20)

| HB | Element | Folder(s) | Note |
|---|---|---|---|
| HB-1 to HB-15 | as approved | as in D12 | **HB-5** spans `src/plugins/authenticate/` and `src/modules/identity/` (two folders; the import cycle CPB1-10 was removed in B2b item 6); **HB-13** spans `src/engine/` and `src/db/mapping/`, with the store moved to `src/db/store/` (B1, D112) |
| no HB number | the serial pipeline and unit of work (`src/core/pipeline.ts`, `unit-of-work.ts`); the stage and seam registry (`src/app.ts:170-195`); the persistent error log with its rotation (`src/plugins/logger/error-log.ts`; no own test of the rotation and file mode found by CP-B1); the 405 route table (`src/plugins/error-envelope/route-table.ts`); the fixed windows (`windows.ts`, moved to `src/core/` by B1); the engine scheduler (`src/engine/scheduler.ts`); the reader of the printed route table (`router-table.ts`); the migration status reader (`src/db/commands/migrations.ts`) | one folder and tests each | listed by CP-B1 (`04_cp_backend_foundation.md:271`); the controller's ruling is open (O-16) |

---

## 11. Amendments by reference and sentences for the final report

| Item | Text |
|---|---|
| D76 DN-5 | `implementation/11_db_test_helper.md` is amended by reference by `implementation/11b_db_helper_forced_drop_retry.md` (forced-drop retry, explicit limits, `dropDeadRun`, the `needs` mechanism) and is not rewritten |
| D144 / CPW1-2 | The W54 plan-wording finding F76-13 is withdrawn: the three named files exist and are unchanged against `acaff20` (O-5) |
| Specifications | Not re-issued; errata appended by W83 (S-1 to S-13, D-1 to D-3, C-1 to C-4) and the drift entries DR-09, DR-11, DR-12 stand beside them |
| W83 residuals | The report sentences of section 4.3 |
| MB-6a (D71 DN37-2) | On a physical device in a release build the wrapper refuses the unprotected biometric item and biometric sign-in stays off |
| F50 | If a later release bundles the PostgreSQL binaries, the Apache License 2.0 text and the PostgreSQL License must ship with it |
| F69 | In Live mode a recording needs a connected paired tablet; the web console alone cannot start one (`README.md:330`) |
| 08a DC-2 (D165) | The StrictMode double-send (F69-1) also existed in Simulated mode on Start Session (a second, refused pre-check and a false toast in development builds); fixed |
| W87-F5 | A 403 `DEVICE_REVOKED` on operation 22 (unpair) follows the revocation path (notice "revoked"), not a generic "could not unpair"; MP-7 names only the 204 and link-down cases |
| D113 Info | Before any use beyond one loopback computer: the sign-in lock is per console and any success clears it; a page on another `127.0.0.1` port can send blind GETs with the operator's cookie; `AUTH_FAILED` names the operator whose username was typed |
| F76, F79 | A revoked device's refusals can delay a new pairing by up to 60 s; more than four tabs per sign-in rotate (`README.md:332`); the per-session socket cap and the undecodable-path request rate are questions for W99 |

---

## 12. Evidence (commands run by this row, all read-only) and limits

| Command | Result used in |
|---|---|
| `git -C <repo> log --oneline -8`; `log -3 --format='%h %ad %s' --date=iso` | sections 0, 5.3 |
| `git show --stat --format='' 4b708c8` / `b90a3c6` / `057fc17`; `git show --name-only` and `sort \| uniq -d` | 9.2 (59, 1,562, 754; 23 shared files) |
| `git diff --name-only acaff20 HEAD`, `HEAD`, `acaff20` and `comm` over the three lists -> 18 first changed after HEAD, 0 reverted | 9.2 |
| `git diff --stat acaff20`; `acaff20 HEAD`; `HEAD`; `git ls-files --others --exclude-standard` | 0, 9.1 |
| `git diff --name-status acaff20 -- <owned paths>` per row (a bash script over the plan's write paths) | section 2 footprints, 9.3 |
| `git ls-files --others --ignored --exclude-standard -- docs/<task>`; `git check-ignore -v .../57_gate_final.log` | O-1 (650 `.log`; `.gitignore:48`) |
| `git diff acaff20 -- .gitignore`, `*/package.json` | 5.1 H-01, X-8, O-1 |
| `git remote -v \| wc -l` -> 0 | 5.3, SC10 |
| `grep -rn 'CONTRACT-GAP-' apps packages --include=*.ts --include=*.tsx \| wc -l` -> 0; `grep -rhoE 'RESIDUAL-W[0-9]+-[0-9]+' ... \| sort \| uniq -c` -> 17 IDs, 45 lines | 4.1 |
| `grep -rhoE "SIM-GAP-M[0-9]+-[0-9]+" apps/mobile/src` and `git grep -hoE ... acaff20 -- apps/mobile/src` -> 13 IDs, 62 markers both | 4.4, O-9 |
| `git hash-object` of the four protected web test files -> `9e8b97c8...`, `71f6f033...`, `1ab07579...`, `5470ce3f...` | SC8, W01, W01b, W01c |
| `git diff --numstat acaff20 -- packages/shared/src/sim` -> `auth.ts` 5/0, `evidence-actions.ts` 3/2, `session-machine.ts` 5/2, `text-cut.ts` 42/0, `vocabulary.ts` 27/0 | SC8 |
| `git diff --stat acaff20 -- apps/mock-core release scripts/release` -> nothing | SC8 |
| `git diff --name-only --diff-filter=M acaff20 -- apps/mobile \| grep test \| wc -l` -> 0 | SC8 |
| `find apps/core-web/src -name routes.test.tsx -o ...`; `git diff --stat acaff20 -- <the three files>` -> nothing | O-5 |
| `stat -f '%SB'` of `implementation/01_baseline_test_fix.md` -> 2026-10-04T06:37:47 | SC1 |
| `lsof -nP -iTCP -sTCP:LISTEN` -> `postgres 19121 127.0.0.1:4432`, `adb 83893 127.0.0.1:5037`, nothing on 4420-4423, 5173-5178, 8081 | H-03, H-04, H-18, X-4 |
| `ls -la .data` (names and modes only), `du -sh .data .cache`, `ls .locks`, `ls .cache/rollback` | H-02, H-11, H-17 |
| Path-existence script over `02_plan.md:810-916` | 2.8 |
| `ps` | refused by the sandbox (`operation not permitted: ps`); emulator state quoted from D130 / D188 (gap G1) |

**Limits.** No test was run (numbers are the decisions'). The emulators and the browser state were not probed. Row-log finding tables were scanned by routing keyword, not read line by line (gap G2). Counts are a snapshot taken while C1 was writing (section 9.4).

---
*Generated: 2026-10-06 09:16*
*Last Updated: 2026-10-06 09:16*
