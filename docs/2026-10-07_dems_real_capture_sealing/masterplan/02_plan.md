---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst-local
blueprint_row: 37
milestone: M0
class: B (row 37 is M0/class B; the W-rows it plans are M2-M9, class A/B/C)
tier: 1
type: implementation-plan
based_on:
  - masterplan/01_specs.md (row 28)
  - masterplan/03_api_contract.md (row 29, post-remediation)
  - masterplan/04_database_contract.md (row 30, post-remediation)
  - masterplan/05_capture_architecture_spec.md (row 31, post-remediation)
  - masterplan/06_evidence_package_spec.md (row 32, post-remediation)
  - masterplan/07_transcript_spec.md (row 33, post-remediation)
  - masterplan/08_client_ux_spec.md (row 34, post-remediation)
  - masterplan/09_security_design_review.md + gateway_check/06_security_remediation.md (row 35)
  - masterplan/10_test_strategy.md (row 36)
  - research/03_analysis.md (row 6 register)
  - decisions/decisions.md (D1-D14)
  - status_tasks.md (current done-state)
source_translated_task: identification/01_translated.md
source_structured_task: identification/02_structured.md (row 37)
last_updated: 2026-10-08 (RV-SPEC errata + R-8 proposal; see masterplan/11_audit_errata.md)
confidence: >-
  HIGH for the W-row set, register-row closure, spec-section mapping, wave plan and collision map
  (mechanical over the ten gated inputs above); MEDIUM for per-row owner-agent assignment and for
  the exact split points of the largest W-rows (analyst judgement, to be confirmed by row 40).
  No spec was edited; this is the plan only (red line: specs are read-only inputs).
gate_status: bridge between the completed spec suite (rows 28-36) and blueprint rev 2 (row 40)
---

# Implementation Plan — W-rows for M2-M9 (blueprint row 37, M0)

> **Authority.** Blueprint row 37 (`identification/02_structured.md:217`) is the hard gate:
> *"Every spec section of rows 28-36 maps to >= 1 W-row; every W-row has class, milestone, owner agent,
> rollback; no wave > 8; no two rows of one wave share an output path."* This document is the bridge
> between the completed spec suite (rows 28-36) and blueprint rev 2 (row 40), which expands each W-row
> into an atomic single-owner row. **No file outside this task folder is written; the specs are
> read-only inputs; no code is changed; no external service is used; no emoji; English; tables over
> prose.**
>
> **The register is the contract** (`research/03_analysis.md`; D10(a)). Where the raw impact map and
> the register disagree, the register wins. Every W-row cites its register rows, spec sections,
> row-36 check IDs, owner agent, dependencies, rollback and output artifact.

**Citation short forms.**

| Short | Source |
|---|---|
| `specs N` / `specs §x` | `masterplan/01_specs.md` (row 28) |
| `C3 §x` | `masterplan/03_api_contract.md` (row 29) |
| `dbc-3 §x` | `masterplan/04_database_contract.md` (row 30) |
| `cap §x` | `masterplan/05_capture_architecture_spec.md` (row 31) |
| `ev §x` | `masterplan/06_evidence_package_spec.md` (row 32) |
| `tx §x` | `masterplan/07_transcript_spec.md` (row 33) |
| `ux §x` | `masterplan/08_client_ux_spec.md` (row 34) |
| `sec §x` / `SEC35-nn` | `masterplan/09_security_design_review.md` + `gateway_check/06_security_remediation.md` (row 35) |
| `test §x` / check ID | `masterplan/10_test_strategy.md` (row 36) |
| `register §x` / `SH-nn`…`NM-nn` | `research/03_analysis.md` (row 6) |
| `Dn` | `decisions/decisions.md` |
| `structured row N` / `structured §x` | `identification/02_structured.md` (rev 1) |

---

## 0. Purpose and how to read this plan

This plan turns the frozen spec suite into a dependency-ordered, owner-assigned, rollback-safe set of
**44 W-rows** across M2-M9 (40 class A/B scheduled on this Mac, 3 class C deferred, 1 conditional
GStreamer sub-plan). Row 40 consumes §B (the catalogue), §C (waves) and §D (gate mapping) to write
blueprint rev 2.

Three reconciliation notes are carried into row 40 because the row-35 remediation post-dates row 36:

| # | row 36 says (stale) | post-remediation truth (row 29 + row 35) | Where used |
|---|---|---|---|
| P-1 | `M2-API-1`: "88 ops, 34 GET / 54 POST" | **89 ops, 34 GET / 55 POST** (op 89 `setCaptureDeviceCredential`) | M2-W7/M2-W8, §D |
| P-2 | `M2-API-2`: "88-1 live-only op" | **89-1**; `offline` grows 10 -> **23** (not 22) | M2-W8, §D |
| P-3 | `M2-AUD-1`: "7 new types (53 -> 60)"; error codes 38 | **9 new types (53 -> 62)**; **9 new codes (31 -> 40)**; forbidden-key CHECK 17 -> 25 | M2-W2/M2-W7, §D |
| P-4 | Gate artifacts `gateway_check/06_m2_gate.md`..`13_m9_gate.md` | `06` is taken by `06_security_remediation.md`; milestone gates shift to **`07_m2_gate.md`..`14_m9_gate.md`** | §D |

No other row-36 value changes. Row 40 must fold P-1..P-4 into rev 2 and into row 36 §0/§A.

---

## A. Start state — verified ground the plan begins from

The plan begins from the state proven in `status_tasks.md` (rows 1-40) and the gate records. M0/M1 are
closed; only rows 24/27 (wave-A close-out), 37 (this plan) and 39/40 remain on the M0/M1 critical path.

| Artifact / spec | Gate result | Evidence |
|---|---|---|
| Row 6 register (`research/03_analysis.md`) | **PASS** — 31/31 errata, 94/94 register rows (SH 25/CS 25/WB 11/MB 13/DOC 6/NM 14), 29/29 gate answers, R 7/7 | D10(a) |
| M1 spike gate (row 38) `gateway_check/04_m1_spike_gate.md` | **M1 GATE PASS 25/25**, 0 FAIL routed; chain equality, live mic switch, AV within ±40 ms, STT byte-identical. **Errata (AU-2, D18):** the gate's "0.001 ms switch" is a blind packet-grid metric (gaplessness re-proven by AU-2 at sample level, AU2-05); the "-1.333 ms AV" is a 10 ms-window artefact (true 0.00 ms, AU2-03); STT-5 passed only the documented GPU adaptation — the CPU clause is unmet until the `cpu-local` functional check (AU2-01/AU3-01) | D13(a); D18 |
| Row 28 `01_specs.md` | done — self-gate R 7/7, gate items 29/29, superseded 5/5, 5W1H present | status row 28 |
| Row 29 `03_api_contract.md` (post-remediation) | done — **89 ops (34 GET / 55 POST), 14 new ops, 24 modified, 62 audit types, 40 error codes, slices 28->30, all 0.3.0 / offline 0.2.0** | D14(c); file header |
| Row 30 `04_database_contract.md` (post-remediation) | done — `dbc-3`; migrations 0004/0005; 9 new / 5 changed tables (30->39); 3/3 FAULT_KIND CHECK sites; kept set 11; §E lane re-creation; §G MT-1..MT-8; 17->25 forbidden keys | D13(f), D14(c) |
| Row 31 `05_capture_architecture_spec.md` (post-remediation) | done — NM 9/9, P25 12/12 by file:line, `M3-RTSP-BIND-1`, hypotheses H-1..H-9 (H-10 two-clock AV added by the AU-2 errata, D18) | D14(c); D18 |
| Row 32 `06_evidence_package_spec.md` (post-remediation) | done — manifest v2 120/120 fields, Signer, 14 verify checks (V-08 tamper), 8 sealing steps, D-EV-1, export | D13(f), D14(c) |
| Row 33 `07_transcript_spec.md` (post-remediation) | done — stages 6/6, TranscriberAdapter (2 backends), DOC-05 15 components, no throughput figure | D13(f), D14(c) |
| Row 34 `08_client_ux_spec.md` (post-remediation) | done — flows 7/7 x 3 clients, P 16/16, E 5/5, gated controls 10/10 | D13(f) |
| Row 35 `09_security_design_review.md` + remediation | **PASS-WITH-FINDINGS**, 0 Critical; 21 APPLIED / 2 DEFERRED (SEC35-18 -> M2; SEC35-26 -> row 40) | D14(c) |
| Row 36 `10_test_strategy.md` | done — **205 active named checks (+10 conditional), 82 run 2+1, 63 pin files, kill matrix 35 distinct cells**; after the RV-SPEC errata (2026-10-08): **207 active (+18 conditional), 84 run 2+1** (`M3-AV-2`, `M3-KC-4`; R-8 conditional §A.6a) | D13(e); file §K; D18/D20 |
| Wave-A test hygiene (row 25) | **PASS** — 11 test files, 0 production, 4 Minor + 2 Nit | D13(b) |
| B2 dependency refresh (row 23) | done — high **54 -> 49** (target <= 53); undici 7.29.1 scoped override; accepted-risk braces/node-forge | D14(a) |
| RC-1 (row 22) + review (row 26) | done — forward-only `ElapsedTicker.freeze()`, RED/GREEN proven; 6/6 paths. **Erratum AU1-4 (D19):** the hold does **not** "never overshoot the stop" — it holds the largest drawn second and can exceed the stored duration by the stop-learning delay (probe 1129 vs 1122). **Ruling D19(b):** the forward-only hold applies only while the Core still reports RECORDING; once the Core reports the stop, the Core's authoritative recorded duration wins (one bounded correction; the evidence record never shows more than the sealed duration) — implemented by the RV-CODE row (AU1-2) | D13(c), D14(b), D19 |

**Rows 24, 27, 37 in flight; 13/14 deferred (D12(d)); row 11 SKIPPED (D7).** Rows 39 (M0 spec gate)
and 40 (rev 2) are pending. This plan assumes the row-27 wave-A regression closes green before M2
opens; it does not depend on row 24/27 output values.

**Plan-level invariants carried into every W-row below:**

| Invariant | Rule | Authority |
|---|---|---|
| Register first | every W-row names the register rows it closes | register §B; `structured` row 37 |
| Check contract | every W-row names >= 1 row-36 check ID; checks are cited, never re-specified | test §0/§M |
| Single writer | lockfile (`/usr/bin/lockf -k .locks/npm.lock`), Homebrew, mobile jest, core-web jest, core-server db runner, oMLX, media ports 8554-8564, emulator access serialise | `structured` §10; D5(c) |
| No media in git | all media under `/.data/` or `.cache/` | OD-25; `cap §H` |
| No wall-clock waits | fake clocks only; `--maxWorkers=2` for all jest/vitest workspaces; `node:test` -> `--test-concurrency` | C-N5; D12(c); test §B.4 |
| Loopback only | no listener outside `127.0.0.1`; RTSP ingest pinned (SEC35-23) | OD-13; `cap §A.4` |
| Test depth | 2+1 for device/browser/spike/DB-gate checks; 1 per workspace per checkpoint for suites | D232/D233; test §B.1 |

---

## B. W-row catalogue for M2-M9

**Conventions.**

- **Class** per `structured` §5: **A** = no new decision, no hardware; **B** = unblocked by a recorded
  gate answer (all M2-M9 rows are B unless C); **C** = needs physical hardware/Q-HW.
- **Milestone** = the section heading; every row belongs to exactly one milestone.
- **Owner agent** = the delegating agent from the blueprint roster (`structured` Agent Mapping).
- **Rollback** = how to undo: which files reverted, which migration/flag disabled. All code rollbacks
  are plain `git checkout` of the named workspace is insufficient where the change is additive; the
  concrete undo is stated per row.
- **Output** = the W-row's own artifact under `implementation/` (or `test/`/`gateway_check/`); row 40
  rows write their own `implementation/` notes and the controller writes the shared trackers.
- **Status** = all rows below are **not started**; row 40 creates them. M0 rows (27/37/39/40) are out of
  scope for the W-row catalogue.

### B.1 M2 — Contract + DB foundation + Simulated parity (class B)

M2 register rows: SH-01..SH-25, CS-12/CS-14/CS-16..CS-20/CS-24/CS-25, WB-09; plus the lane row
(NM-14, E-19/E-24, RK-10). M2 gate: `gateway_check/07_m2_gate.md`.

| ID | Cls | Built (files/modules/tables/ops) | Register rows | Spec sections | Checks | Owner | Deps | Rollback | Output |
|---|---|---|---|---|---|---|---|---|---|
| M2-W1 | B | **First M2 row — lane re-creation + per-lane pairing**: `db:create` `dems_lane_1..3`; `db:migrate` under `.locks/db-migrate.lock`; `db:seed` per lane; Core 4421-4423 + Vite 5176-5178; per-lane `adb reverse` + pairing redeem; `dems_demo` migrate + v2 reseed | CS-17, NM-14, E-19, E-24, RK-10, CS-02 | dbc-3 §F (steps 1-8); test §E; `structured` §10 L383 | M2-LANE-1, M2-RG-CSD, M2-RG-PG | coder-execution | M2-W2, M2-W3, M2-W4 | Drop `dems_lane_1..3`; `adb reverse` back to 4420 and re-pair to `dems_demo`; `dems_demo` kept tables intact | `implementation/09_m2_lane_recreation.md` |
| M2-W2 | B | **Typed schema v2**: `src/db/schema/*` (9 new tables), `value-sets.ts` 14 FAULT_KIND values, CHECK swaps (3 FAULT_KIND `:281/:382/:488`, hashes `:335`, signature `:336`, new `signature_value`, sources `:340`, tracks `:354`, `active_session` json `:260`, forbidden-key `:199/:220` 17->25) | CS-16, SH-01, SH-02, E-01, W1-C10, OD-01/03/04/19, SEC35-22 | dbc-3 §B, §C.1-§C.6 | M2-MT-3, M2-MT-8, M2-DB-CHK-1 | database-specialist | none | Revert `src/db/schema/*` + `value-sets.ts`; no migration applied yet | `implementation/10_m2_schema_check.md` |
| M2-W3 | B | **Migrations 0004/0005**: generated `0004_capture.sql` (9 CREATE + ALTERs + indexes) + hand-written `0005_capture_privileges.sql` (privilege matrix, credential SELECT revoke, `dems_capture_credential_reveal` SECURITY DEFINER fn, `schema_meta=(2,'dbc-3')`), journal/snapshot | CS-17, CS-24, CS-16, RK-12, SEC35-02, DOC-03 | dbc-3 §A, §D, §B.1-§B.12 | M2-DB-1, M2-DB-2, M2-MT-4 | database-specialist | M2-W2 | Delete `0004`/`0005` + snapshots + journal idx 4/5; live `dems_demo` never migrated by a test | `implementation/11_m2_migrations.md` |
| M2-W4 | B | **Mapping + seed + fixture v2**: `db/mapping/*` v2 shapes; v2 seed (14 permissions / 22 grants / 1 config / 5 devices / 0 credentials); bulk fixture per `dbc-3` §G minimums; demo evidence regenerated v2 (SH-24, host FFmpeg + TTS fixture) | CS-18, CS-19, CS-20, SH-09, SH-11, SH-24, E-20, OD-02 | dbc-3 §B, §E.3, §G; C3 §2.4 | M2-MT-2, M2-MT-7 | coder-execution | M2-W3 | Re-run `db:reset` with v1 seed (revert `seed/*`, `fixtures/*`, `mapping/*`); regenerated media in git-ignored `.data/` | `implementation/12_m2_seed_fixture.md` |
| M2-W5 | B | **Reset keep-set + guard**: `kept-tables.ts` 11 kept tables (upsert mode for `capture_config`/`capture_devices`/`capture_device_credentials`); `RESET_BLOCKED_REAL_EVIDENCE` DB+disk guard; op 75 refusal | CS-21, RK-16, OD-19, SEC35-22 | dbc-3 §E.1, §E.2 | M2-MT-5, M2-MT-6 | coder-execution | M2-W4 | Revert `src/db/reset/*`; kept tables unchanged by design | `implementation/13_m2_reset_guard.md` |
| M2-W6 | B | **Shared domain/contract foundation**: enums (SH-01), entities (SH-02), vocabulary (SH-03), RBAC `auth.ts` + `CAPTURE_CONFIG`/`TRANSCRIPT_REVISE` (SH-04), sim types (SH-05), replicated slices 28->30 + own `captureConfig`/`captureDevices` kind (SH-16, E-04), realtime messages + `meters.audio` re-key (SH-17, SH-25), i18n vocab (SH-23) | SH-01, SH-02, SH-03, SH-04, SH-05, SH-16, SH-17, SH-23, SH-25, CS-15 | C3 §0, §2.1, §6; dbc-3 §B; specs §D | M2-RG-SHARED, M2-API-3 | coder-execution | M2-W2 | Revert `packages/shared/src/{domain,sim,api,i18n}` to HEAD | `implementation/14_m2_shared_contract.md` |
| M2-W7 | B | **Core API registry + audit + errors + constants**: ops 76-89 + 24 modified ops + 9 error codes (31->40) + 9 audit types (53->62) + exact `audit-details.ts` key lists + credential write-only path + `SESSION_HOLDER` condition (SEC35-18) + `@dems/shared/api/capture.ts` constants (CS-25) | SH-12, SH-13, SH-14, SH-15, SH-18, SH-19, SH-20, SH-21, CS-12, CS-14, CS-25, SEC35-01/16/17/18/19/21/22, B4 (E-30) | C3 §1-§5, §7, §9 | M2-API-1, M2-API-3, M2-AUD-1, M2-AUD-2, M2-CRD-1 | coder-execution | M2-W6, M2-W3 | Revert `packages/shared/src/api/*` + `apps/core-server/src/core/audit-details.ts` + new modules; registry back to 75 | `implementation/15_m2_api_contract.md` |
| M2-W8 | B | **OpenAPI versions + pinned counts**: `all` 0.2.1->0.3.0, `offline` 0.1.0->0.2.0, regenerate `openapi.json`, re-pin 89 ops / 34 GET / 55 POST / 30 slices / offline 23, section-C pin sweep (P-1..P-3) | SH-19, WB-09, CS-25, E-06, W1-C9 | C3 §8; test §C | M2-API-1, M2-API-2, M2-PIN-1 | coder-execution | M2-W7 | Revert `openapi.ts` + `openapi.json` + pin test files; `openapi:gen` at 0.2.1 | `implementation/16_m2_openapi_pins.md` |
| M2-W9 | B | **Simulated v2 parity**: sim evidence v2 (SH-07), sim devices/audio/faults/scenarios (SH-08), dataset (SH-09), constants (SH-10), demo-alignment/verify (SH-11), live bindings + `live-sim.ts:902-905` minimal edit (SH-21, SH-25); retire the SC8 "simulator untouched" rule; Simulated regression vs `c2c983b` | SH-05, SH-06, SH-07, SH-08, SH-09, SH-10, SH-11, SH-21, SH-25, E-02, E-03, OD-17, OD-23 | `structured` §6 M2; C3 §6; register §F | M2-SIM-1, M2-SIM-2 | coder-execution | M2-W6 | Revert `packages/shared/src/{sim,live,demo-data}/*`; SC8 baseline restored (doc rule text) | `implementation/17_m2_simulated_parity.md` |
| M2-W10 | B | **Capture-config module + real-mode fencing**: `modules/capture-config/*` store/slices boot (NM-09) + `modules/devices` status feed; demo fencing ops 71-75 (`403 DEMO_DISABLED`, `409 RESET_BLOCKED_REAL_EVIDENCE`); `rbac.matrix` boot equality | NM-09, CS-23, CS-06 (read), SH-04, E-04, OD-10, OD-18 | C3 §2.4, §3, §6; specs §E.6 | M2-RG-CSU, M2-MT-7, M2-API-3 | coder-execution | M2-W7 | Revert `modules/capture-config/*` + `modules/demo/*`; demo controls re-enabled | `implementation/18_m2_config_demo.md` |

**M2 note.** M2-W1 is the **first M2 W-row by milestone precedence** and must pass (`M2-LANE-1`)
before any lane-based gate in M4/M5/M7/M8. Its execute step consumes M2-W2/W3/W4 (authored first in
wave order); the row is listed first because it opens the milestone and gates every lane run (DP-7,
RK-10, E-24).

### B.2 M3 — Capture worker + supervisor + IPC on fake devices (class B)

M3 register rows: NM-02, NM-03, NM-04, NM-05 (scheme), NM-14, CS-01..CS-04, CS-22; static rules for
`capture/`; P25 12 edits. M3 gate: `gateway_check/08_m3_gate.md`.

| ID | Cls | Built (files/modules) | Register rows | Spec sections | Checks | Owner | Deps | Rollback | Output |
|---|---|---|---|---|---|---|---|---|---|
| M3-W1 | B | **Supervisor + IPC + seam + P25 edits 1-6/11-12**: `packages/capture-protocol`; `src/capture/*` (spawn/heartbeat/back-off/correlation IDs/back-pressure); `capture` seam + `app.ts` module registration; `index.ts` supervisor start/stop | NM-03, CS-01, CS-03, CS-04, SH-18, OD-14 | cap §A.3, §B.1, §B.2, §I (edits 1-6, 11-12); specs §E.1 | M3-KC-3, M3-KC-1, M3-SR-1 | coder-execution | M2-W10 | Remove `src/capture/*` + `packages/capture-protocol`; revert the 8 P25 edits (reviewed per OD-14) | `implementation/19_m3_supervisor_ipc.md` |
| M3-W2 | B | **Worker + engine seam + config keys (P25 edits 7-10)**: `apps/capture-worker/` FFmpeg embedded (NM-04; build form per Q-WORKER, AU3-04), 2 RTSP ingests, 2 mic captures, selector->one encoder->both files, meters, PCM tap, restart-ingest-per-session; `config.ts` capture keys | NM-02, NM-04, CS-02, W1-C1, D10(b) | cap §A.2, §A.4, §B.2, §F, §I (edits 7-10); specs §E.1 | M3-WI-1, M3-AV-1, M3-AV-2, M3-KC-1, M3-BC-1, M3-SR-2 | coder-execution | M3-W1 | Remove `apps/capture-worker/`; revert `config.ts` P25 edits | `implementation/20_m3_worker_engine.md` |
| M3-W3 | B | **fMP4 writer + running hash chain + checkpoints + truncation**: append-only fMP4, stored-bytes + plaintext chains, per-fragment checkpoint records, drop-fragment rule, RECOVERY tail validation by box walk (AU2-08), observed-GOP check + OP-GOP outcome (AU2-08), fsync policy, `recording_fragments` INSERT path | NM-04, SH-07, OD-03, OD-21, OD-25, W1-C1, W1-C2 | cap §A.5, §C.1-§C.6; ev §B.6; dbc-3 §B.6 | M3-WI-1, M3-KC-2, M3-KC-4, M3-SR-3, M3-MG-1 | coder-execution | M3-W2 | Remove writer + `capture/fragments.ts`; `recording_fragments` rows rebuilt on reset | `implementation/21_m3_fmp4_writer.md` |
| M3-W4 | B | **Fixtures + AV analyser (NM-14)**: fake RTSP sources, fake mics, fake ONVIF stub, flash+beep generator (0 / +80 / −80 ms truths) + `analyse.py` with **sample-exact** audio onset (AU2-03/04), long-GOP fake camera (AU2-08), separate-clock fake camera (H-10, AU2-06); **all fixture listeners bind `127.0.0.1:8554-8564`** | NM-14, OD-25, SEC35-23 | cap §A.8, §F, §J; S1 §3; S4; AU-2 §3 | M3-AV-1, M3-AV-2, M3-KC-4, M3-RTSP-BIND-1 | coder-execution | M3-W2 | Remove `apps/capture-worker/test-fixtures/`; ports 8554-8564 freed | `implementation/22_m3_fixtures.md` |
| M3-W5 | B | **Static rules + boot checks + storage**: G-R1..G-R8 guards (`capture/`, `capture-worker/`), pinned `node:fs`/`child_process` allowlist (SEC35-25), `CS-22` boot checks, `CS-09` storage real volumes | CS-05, CS-22, CS-09, SEC35-25, E-05 | cap §G, §A.2; specs R-2 AC-3 | M3-SR-1, M3-SR-2, M3-BC-1, M3-MG-1 | coder-execution | M3-W1, M3-W2, M3-W3 | Remove new static test files + boot-check module; 21-guard baseline restored | `implementation/23_m3_static_boot.md` |
| M3-W6 | B | **B11 instrumentation before the M5 tablet gate**: RF2-2 exact late-stop wait point on the tablet; `CS-10` system module services (worker, transcriber) | CS-10, B11, RK-5 | ux P-12; specs §E.6 | M3-RG-MOB (instrumented), prep for M5-SW-T | coder-execution | M3-W5 | Revert `session-diagnostics` instrumentation; no schema change | `implementation/24_m3_b11_instrumentation.md` |

### B.3 M4 — Device adapters + selector (class B fake / C real)

M4 register rows: NM-01, NM-09, CS-06, CS-11, WB-02/05/06/07/10/11, MB-02/08/09/10/11/12. M4 gate:
`gateway_check/09_m4_gate.md`.

| ID | Cls | Built (files/modules) | Register rows | Spec sections | Checks | Owner | Deps | Rollback | Output |
|---|---|---|---|---|---|---|---|---|---|
| M4-W1 | B | **Adapter layer (NM-01)**: `CameraAdapter`/`PoeController`/`AudioInputAdapter` interfaces + fakes (2 fake cameras per OD-05); selector registry; contract-derived `DEVICE_COMMAND_OF_OPERATION` (E-12); credential-URL handling (SEC35-04) | NM-01, CS-06, CS-11, E-12, SEC35-04, OD-05/06/07/22 | cap §A.1, §A.6, §A.7; specs §E.1 | M4-FAKE-1, M4-SEL-W | coder-execution | M3-W2 | Remove `apps/capture-worker/src/adapters/`; real adapters never load in tests | `implementation/25_m4_adapters.md` |
| M4-W2 | B | **Selector module + API + slices + config lock (NM-09)**: `modules/capture-config/*` (ops 76-80), publish `captureConfig`/`captureDevices`, `409 CAPTURE_CONFIG_LOCKED` while a session is open, devices module status | NM-09, CS-06, SH-16, E-04, OD-10, OD-12 | C3 §2.4, §6; ux §2; specs R-1 | M4-SEL-W, M4-SEL-T, M4-SEL-P, M4-LOCK-1 | coder-execution | M2-W10, M4-W1 | Remove `modules/capture-config/*`; slices back to 28; lock removed | `implementation/26_m4_selector.md` |
| M4-W3 | B | **Web selector + query factories**: Devices page/drawer (WB-05), System entry (WB-07), Dashboard tiles (WB-02), composed meter/stepper/timeline (WB-10), storage (WB-06), `lib/core-queries.ts` factories (WB-11) | WB-02, WB-05, WB-06, WB-07, WB-10, WB-11, E-08, E-17, OD-12 | ux flows 1, specs R-1 | M4-SEL-W, M4-PC-1, M4-RG-WEB | coder-execution | M4-W2 | Revert `apps/core-web/src/features/{devices,system,dashboard}` + `lib/core-queries.ts` | `implementation/27_m4_web_selector.md` |
| M4-W4 | B | **Tablet/phone selector**: Devices (MB-08), Settings capture section (MB-09), Session New precheck (MB-02), Network/Time offset rows (MB-10), runtime audio values (MB-11), audit labels (MB-12), `SelectionGlow` rows (E-15) | MB-02, MB-08, MB-09, MB-10, MB-11, MB-12, E-15/E-16, OD-12 | ux flows 1; specs R-1 | M4-SEL-T, M4-SEL-P, M4-PC-1, M4-RG-MOB | coder-execution | M4-W2 | Revert `apps/mobile/src/features/{devices,settings,session-new,network-time,audit}` | `implementation/28_m4_mobile_selector.md` |
| M4-W5 | **C** | **Class C (not scheduled)**: real `CameraAdapter`/ONVIF discovery/NTP/profile (C-1), real `PoeController` (C-3), real `AudioInputAdapter` (C-4), physical device e2e (C-5) | NM-01, CS-06, CS-11, OD-05/06/07/22, Q-HW | specs §G.2; ux §12 | class-C gates on activation (§E) | coder-execution | M4-W4, Q-HW | N/A (not executed on this Mac) | `implementation/29_m4_class_c_adapters.md` |

### B.4 M5 — Manual mic failover end to end (class B)

M5 register rows: NM-10, SH-03/08/13/17, CS-07, WB-01/02/10, MB-01/03/13. M5 gate:
`gateway_check/10_m5_gate.md`.

| ID | Cls | Built (files/modules) | Register rows | Spec sections | Checks | Owner | Deps | Rollback | Output |
|---|---|---|---|---|---|---|---|---|---|
| M5-W1 | B | **Switch mechanics + warnings**: libavfilter `astreamselect` selector, `avfilter_graph_send_command` switch at the next input-quantum boundary applied on the filtering thread only (AU2-07), sample-count + continuity gap check (AU2-05), OP-CLICK outcome (crossfade or accepted click), `session_audio_intervals` records (media-pts), `AUDIO_SOURCE_SWITCHED` audit with sending device ID, `MIC_SILENT` warning raiser (never auto-switch), `CS-07` session route | NM-10, SH-03, SH-08, SH-13, SH-17, CS-07, E-30, OD-09, OD-11 | cap §E, §E.1, §F; C3 §2.4, §5.2; specs R-3 | M5-GAP-1, M5-WARN-1, M3-AV-1 | coder-execution | M3-W3, M4-W2 | Remove switch controller + warning raiser; intervals rows rebuilt; constants reverted | `implementation/30_m5_mic_switch.md` |
| M5-W2 | B | **Web mic UI**: Session Monitor active/standby + toggle (WB-01), Dashboard mic tiles (WB-02), composed meter/timeline (WB-10), "Checking your permissions..." state | WB-01, WB-02, WB-10, SH-22, E-16 | ux flow 2; specs R-3 | M5-SW-W, M5-WARN-1, M4-PC-1 | coder-execution | M5-W1 | Revert `features/session-monitor` + dashboard tiles | `implementation/31_m5_web_mic.md` |
| M5-W3 | B | **Tablet/phone mic UI + B15**: Session Live mic cards (MB-03), Home mic tiles "No signal" fix (MB-01, B15), test beds (MB-13), B11 result applied (M3-W6 wait point) | MB-01, MB-03, MB-13, B15, E-14, E-16 | ux flow 2; specs R-3 | M5-SW-T, M5-SW-P, M5-WARN-1 | coder-execution | M5-W1, M3-W6 | Revert `apps/mobile/src/features/{session-live,dashboard}` + test beds | `implementation/32_m5_mobile_mic.md` |

### B.5 M6 — Transcript pipeline (class B)

M6 register rows: NM-06, NM-13 (class C), SH-09/SH-14, CS-22, DOC-05. M6 gate:
`gateway_check/11_m6_gate.md`.

| ID | Cls | Built (files/modules) | Register rows | Spec sections | Checks | Owner | Deps | Rollback | Output |
|---|---|---|---|---|---|---|---|---|---|
| M6-W1 | B | **Transcriber app + adapter + fixtures**: `apps/transcriber/`; `TranscriberAdapter` with `omlx-server` (dev) and `cpu-local` (whisper.cpp built **from source under `.cache/` with GPU backends off**, model converted in the isolated `.cache/` venv — Q-INSTALL items 1/2, route per the reframed Q-D7; see the M6 note); `TtsFixtureProvider`; single key-loader (SEC35-14); static rule. Nothing of either backend is coded today (AU3-02) | NM-06, SH-09, CS-22, DOC-05, SEC35-14, W1-C3/C5/C12 | tx §B.1-§B.6; specs §E.3; OD-20/OD-24 | M6-AD-1, M6-CP-1 | coder-execution | M3-W1; Q-INSTALL 1/2/5; `cpu-local` install + functional-check row (rev 2.1) | Remove `apps/transcriber/` source; models under git-ignored `.cache/`; no DB change | `implementation/33_m6_transcriber_adapter.md` |
| M6-W2 | B | **VAD + STT + checkpoints**: Silero VAD chunking, STT per chunk, CPU-priority rule, chunk checkpoints/resume, `transcript_chunks` writes; VAD + diarization model downloads (OD-20) | NM-06, SH-09, E-21, E-22, RK-1, OD-20, OD-24 | tx §A.1-§A.3, §C, §D; dbc-3 §B.7 | M6-TF-1, M6-KR-1, M6-CP-1, M6-DF-1 | coder-execution | M6-W1, M3-W2 | Remove pipeline + `transcript_chunks` writes; models in `.cache/`; rows rebuilt | `implementation/34_m6_vad_stt.md` |
| M6-W3 | B | **Diarization + assembly**: sherpa-onnx + Silero 2-speaker labelling `LABELLED`/`UNAVAILABLE`; canonical `dems.transcript/1` document + hash; `transcripts`/`transcript_revisions`/`evidence_items.transcript_sha256` writes | NM-06, SH-09, SH-14, DOC-05, D226, OD-15/OD-20 | tx §A.4, §A.5; dbc-3 §B.8, §B.9; ev §B.7 | M6-TF-1, M6-LB-1 | coder-execution | M6-W2 | Remove diarizer + assembly; `transcripts`/`transcript_revisions` rows rebuilt | `implementation/35_m6_diarization.md` |
| M6-W4 | B | **Transcript ↔ sealing interaction**: `FINALIZE_TRANSCRIPT` contract + handler consumes the committed transcript + hash; D-EV-1 (`state='PARTIAL'`, `failedChunks`, no fabricated text); transcript summary in the evidence slice (bound by M7-W1) | SH-14, NM-07, D-EV-1, OD-08/OD-15 | ev §E.1, §E.5; tx §D.3, §A.5; C3 §2.4 | M6-TF-1, M6-KR-1 | coder-execution | M6-W3 | Revert transcript step wiring; sealing step falls back | `implementation/36_m6_transcript_seal.md` |

**M6 note — the CPU-only STT path on this Mac (errata AU3-01/AU3-02/AU2-01/AU2-02, D17/D18).** Before
M6-W2, the rev-2.1 blueprint adds one `cpu-local` row: (1) build whisper.cpp from source under
`.cache/` (git-ignored) with GPU backends off (`GGML_METAL=OFF`), `cmake` taken from the isolated
`.cache/` venv (Q-INSTALL item 2), **zero Homebrew change** — a Homebrew `whisper.cpp` install would
upgrade `ca-certificates openssl@3 sdl3 sdl2-compat`, and `openssl@3` has `ffmpeg` and `omlx` as
installed dependents (AU2-02 dry run; D12(d) risk class); (2) convert
`~/.omlx/models/whisper-large-v3-turbo` to ggml in the isolated venv (row 11 un-skipped for
`cpu-local`) or download the official ggml turbo weights under OD-20; (3) run the functional
transcript check on `cpu-local`, **2 + 1**, with `-ng` visible in the quoted command and no RTF/WER
figure (D230). The install route is a second-gate item (reframed Q-D7); OD-24's approved text
("whisper.cpp (Homebrew)") stands until the user answers. The M6 gate runs `M6-TF-1` on **both**
backends and `M6-DF-1` on `cpu-local`.

**M6 note.** `M6-TF-1`'s "sealed and verified inside the package" clause is first asserted on the
transcript document + recorded hash at M6 and re-asserted on the full v2 package by `M7-VV-SRV`
(M7-W4); the transcript pipeline rows do not depend on the package builder except at that clause.

### B.6 M7 — Sealing v2 + package + signer + encryption + RECOVERY (class B)

M7 register rows: NM-05/07/08, SH-06/07/11/14, CS-04/08/13/21, WB-01/04/08, MB-04/05/06/12, B9. M7
gate: `gateway_check/12_m7_gate.md`.

| ID | Cls | Built (files/modules) | Register rows | Spec sections | Checks | Owner | Deps | Rollback | Output |
|---|---|---|---|---|---|---|---|---|---|
| M7-W1 | B | **Sealing pipeline v2**: `sealing_jobs` per-step checkpoints + resume rules, RECOVERY resume, OD-08 interrupted durable-prefix path, `session-machine` v2 seal, `CS-04` engine host INTERNAL actions, reset fence check at R-0 | NM-07, SH-06, CS-04, CS-21, E-13, OD-08 | ev §E.1-§E.5; dbc-3 §B.4; C3 §2.4 | M7-REF-1, M7-KM-P1..P4-0, M7-FF-UNIT | coder-execution | M6-W4, M3-W3 | Remove sealing module + `sealing_jobs` writes; sessions revert to v1 finalization | `implementation/37_m7_sealing_pipeline.md` |
| M7-W2 | B | **Package + manifest v2 + Signer**: `packages/shared/src/evidence-package/` (layout, 120-field manifest, `fragments.json` = manifest serialization); `core-server/src/capture/signer/` software Ed25519 (`CORE-KEY-EVSIGN-01`), key at rest 0600/OS keychain, attestation runbook, `CS-13` real key record | NM-08, SH-07, SH-11, CS-13, SEC35-06/07/11/13, OD-02/03/04/16 | ev §A, §B, §C, §G.4; dbc-3 §C.4/§C.5 | M7-VV-SRV, M7-TP-1, M7-KM-C-S1..S6 | coder-execution | M7-W1 | Remove `evidence-package/` + signer; packages under `.data/` | `implementation/38_m7_package_signer.md` |
| M7-W3 | B | **Per-fragment AES-256-GCM + key store**: GCM outside the muxer over stored ranges, GCM AAD `(trackId, seq, byteOffset, keyId)`, session key in Core credential store, key-loss policy (no escrow default, SEC35-09), Range interaction | NM-05, SH-07, SEC35-08/09/10, OD-03 | cap §D.1-§D.4; ev §A.3, §B.6 | M7-TP-1, M7-VV-SRV | coder-execution | M3-W3 | Remove encryption module + key store; test files revert to unencrypted | `implementation/39_m7_encryption.md` |
| M7-W4 | B | **Verify v2 (14 checks V-01..V-14)**: op 41 rewrite; per-fragment stored + plaintext hashes; chain continuity; `fragments.json` equality (V-02); per-revision certificate (V-11); one-fragment tamper V-08; `CS-08` evidence reads | SH-07, NM-08, CS-08, SH-14, SEC35-11/20/21, OD-02/04 | ev §D; C3 §3 (op 41) | M7-VV-SRV, M7-TP-1 | coder-execution | M7-W2, M7-W3 | Revert `modules/evidence` verify path to v1 | `implementation/40_m7_verify_v2.md` |
| M7-W5 | B | **Kill matrix (35 distinct cells, never a loop)**: harness for P1-P4 x S1-S6 (24 cells) + M7-REF-1 + M7-KM-P*-0; references from per-phase durable-prefix runs; S7/S8 fallback cells parked conditional | NM-07, NM-14, E-13, OD-08/OD-21 | ev §E; test §F | M7-REF-1, M7-KM-P1..P4-0, M7-KM-C-S1..S6, M7-KM-P1..P4 x S1..S6 | coder-execution | M7-W1, M7-W2, M7-W3, M7-W4 | Remove kill harness; no production file affected | `implementation/41_m7_kill_matrix.md` |
| M7-W6 | B | **Clients + verify + tamper demo + B9**: web/mobile v2 verify (WB-04, WB-08, MB-04/05/06/12), progress forward-only, in-place hand-offs, tamper demo EV-0005 re-script (one fragment), B9 FXR-DEV-2 with MB-04 (Reanimated rest values) | WB-01, WB-04, WB-08, MB-04, MB-05, MB-06, MB-12, E-13, E-15, OD-02/08/15 | ux flows 3,4,5,6; ev §F; C3 §5.3 | M7-VV-WEB, M7-VV-PHONE, M7-TP-1, M7-FF-WEB, M7-FF-TAB, M7-FF-PHONE | coder-execution | M7-W4 | Revert client features; demo EV-0005 regenerated to v1 script | `implementation/42_m7_clients_verify.md` |

### B.7 M8 — Playback, export, composite (class B)

M8 register rows: NM-11, NM-12, WB-04, MB-07, SH-14, DOC-05. M8 gate: `gateway_check/13_m8_gate.md`.

| ID | Cls | Built (files/modules) | Register rows | Spec sections | Checks | Owner | Deps | Rollback | Output |
|---|---|---|---|---|---|---|---|---|---|
| M8-W1 | B | **Media streaming (NM-11)**: Range-served decrypted playback route, signed media session (SEC35-12 HMAC key/TTL/binding), `mts_` prefix in both blanking lists (SEC35-13), own static rule, `EVIDENCE_MEDIA_SERVED` audit, op 88 | NM-11, WB-04, MB-07, E-31, SEC35-12/13 | cap §D.4; C3 §2.4, §7; ux flow 5 | M8-PB-W, M8-PB-T, M8-PB-P, M8-RNG-1, M8-BLK-1 | coder-execution | M7-W3, M7-W4 | Remove `modules/evidence-media`; media route gone; blanking regex reverted | `implementation/43_m8_media_stream.md` |
| M8-W2 | B | **Export + composite (NM-12)**: op 42 background job + op 87 poll; decrypted copy + manifest + signature; export block (9 fields); composite on demand marked `derived` + hashed; export audit + secret sweep | NM-12, SH-14, WB-04, MB-07, E-31, SEC35-09, OD-16 | ev §G.1-§G.4; C3 §3 (op 42/87); ux flow 5 | M8-EXP-1, M8-CMP-1, M8-XAU-1, M8-BLK-1 | coder-execution | M7-W2 | Remove export module; `export/` under `.data/`; audit rows rebuilt | `implementation/44_m8_export_composite.md` |
| M8-W3 | B | **Playback UI + revisions**: web Evidence page + player + audio-source band + transcript pane (WB-04), mobile evidence sheet (MB-07), transcript revise UI (op 85/86), verify verdict pinned per run | WB-04, MB-07, SH-14, E-11, E-31, OD-15 | ux flows 5,6; specs R-3/R-4/R-5 | M8-PB-W, M8-PB-T, M8-PB-P, M8-REV-1 | coder-execution | M8-W1, M6-W3 | Revert `features/evidence` web+mobile | `implementation/45_m8_playback_ui.md` |
| M8-W4 | **C** | **Class C (not scheduled)**: OD-13-gated physical tablet/phone playback e2e (C-5) on LAN | C-5, OD-13, Q-HW | ux §12; specs §G.2 | M8-PB-W/T/P on hardware (§E) | coder-execution | M8-W3, Q-HW | N/A (not executed on this Mac) | `implementation/46_m8_class_c_physical.md` |

### B.8 M9 — Hardening and release (class A/B Mac part + class C)

M9 register rows: DOC-01..DOC-06, B6/B8/B12/B13, NM-13 (class C), A1-A6 (pre-handover). M9 gate:
`gateway_check/14_m9_gate.md`.

| ID | Cls | Built (files/modules) | Register rows | Spec sections | Checks | Owner | Deps | Rollback | Output |
|---|---|---|---|---|---|---|---|---|---|
| M9-W1 | A/B | **Full regression + Simulated regression + final pin sweep**: 7 workspaces at re-pinned floors, root typecheck/lint, `M9-SIM-1` vs `c2c983b`, `M9-PIN-1` full-repo stale-pin sweep | E-06, RK-14, OD-23 | `structured` §6 M9; test §A.9 | M9-RG-*, M9-QA-1, M9-SIM-1, M9-PIN-1 | test-expert | all M2-M8 | Report-only; no source change | `test/02_m9_regression.md` |
| M9-W2 | A | **Docs**: DOC-01 README, DOC-02 specs refresh, DOC-04 asset READMEs, DOC-05 `THIRD_PARTY_NOTICES.md` (15 components incl. GPL FFmpeg build note, LB-1..LB-5), DOC-06 read-only note; B6 `scripts/pg/server.mjs` runbook | DOC-01, DOC-02, DOC-04, DOC-05, DOC-06, B6 | specs §C.1; tx §F; `structured` §6 M9 | M9-DOC-1 | data-analyst | M9-W1 | Revert doc files to HEAD | `implementation/47_m9_docs.md` |
| M9-W3 | A | **Hygiene backlog**: B8 mobile minors + B15 empty-frame, B12 RC-2..RC-7 nits, row-25 F2 `clearToasts()` 350 ms + F4 20 `jest.setTimeout(30_000)` files + F3 `waitForSheetExit`, B5/B6/B7 splits per OD-26 (only after M9), B13 only if a release build is made; row-26 F1-F4 (see §G) | B8, B12, B5, B6, B7, B13, F2/F3/F4, OD-26 | `structured` §8; OD-26; ux P-08 | M9-HYG-1, X-FC-1, X-PIN-1 | coder-execution | M9-W1 | Revert each hygiene edit (separate small commits) | `implementation/48_m9_hygiene.md` |
| M9-W4 | B | **Final verification chain**: verifier full-gate re-check -> security-review (0 Critical, dependency posture vs B2 baseline) -> test-expert (catalogue vs closed ledger) -> senior-code-reviewer (clean tree, static-rule family intact) | (process) | `structured` §6 M9; specs §F M9 | M9-CH-1, M9-CH-2, M9-CH-3, M9-CH-4 | verifier, security-review, test-expert, senior-code-reviewer | M9-W1, M9-W2, M9-W3 | Report-only; no source change | `gateway_check/14_m9_gate.md` + chain reports |
| M9-W5 | **C** | **Class C (not scheduled) + pre-handover**: Core-device benchmark NM-13 (C-7: RTF/RAM/WER/labelling), TPM/PKCS#11 signer (C-8), 1-2 h AV-drift + repeated kill loops (C-9), A1-A6 release-build/long campaigns only on a handover announcement | NM-13, C-7/C-8/C-9, A1-A6, Q-HW | specs §G.2; `structured` §8; D233 | M9 class-C gates on activation; F.3 only (§E) | coder-execution + verifier | M9-W4, Q-HW, handover | N/A (not executed on this Mac) | `implementation/49_m9_class_c.md` |

### B.9 Conditional sub-plan — deferred rows 13/14 (GStreamer)

| ID | Cls | Built | Register rows | Spec sections | Checks | Owner | Deps | Rollback | Output |
|---|---|---|---|---|---|---|---|---|---|
| G-13/14 | B (conditional) | **Only if the user approves the 11 shared-library upgrades (D12(d))**: re-run row 13 GStreamer install (verify `gst-inspect-1.0 isofmp4mux` first), row 14 prototype in `.cache/spikes/s3/`; refresh row 15 memo **before** any M1-gate re-run (row 38). Must run in a maintenance window with no sibling work in flight and the omlx libexec patch state recorded first | NM-02, NM-14, Q-INSTALL item 3, D12 | `structured` rows 13/14; specs §H.3; cap §A.4 | M1-S1-*, M1-S2-* (re-run) | coder-execution | user approval; quiet host | Uninstall GStreamer; restore the 11 upgraded libs per the blocked-record evidence; no repo source change | `initialization/03_gstreamer_install.md` (existing blocked record) + `research/11_spike_gstreamer_prototype.md` |

---

## C. Wave plan (<= 8 in flight)

Waves are **dependency order**, not launch order; rows are released as soon as dependencies are met.
Class-C rows (M4-W5, M8-W4, M9-W5) and the conditional G-13/14 are **not scheduled** and appear only
in §E. Each wave lists its rows, owner agent, the single-writer resources it must serialise, and its
output paths (all unique within the wave — see the collision map in §C.1).

| Wave | Rows (in flight) | Count | Owners | Single-writer / serialised resources | Why this ordering |
|---|---|--:|---|---|---|
| W1 | M2-W2, M2-W6 | 2 | database-specialist, coder-execution | none shared (different workspaces: `src/db/schema` vs `packages/shared`) | schema and shared contract are independent authoring fronts |
| W2 | M2-W3, M2-W7 | 2 | database-specialist, coder-execution | core-server db runner (M2-W3 only) | migrations need W2; API registry needs W6 |
| W3 | M2-W4, M2-W8, M2-W9, M2-W10 | 4 | coder-execution x4 | core-server db runner (W4), lockfile/`node_modules` (W8 openapi:gen) | seed needs W3; openapi/pins/sim/config need W7/W6 |
| W4 | M2-W1, M2-W5 | 2 | coder-execution x2 | **emulator access + core-server db runner + media ports** (W1); db runner (W5) | lane re-creation needs migrations+seed; reset guard needs seed |
| — | **M2 gate** (verifier) `gateway_check/07_m2_gate.md` | — | verifier | — | milestone boundary |
| W5 | M3-W1, M6-W1 | 2 | coder-execution x2 | **media ports 8554-8564** (M3-W1 spawn path); oMLX (M6-W1 static test only) | supervisor seam and transcriber-adapter scaffold both need only M2 |
| W6 | M3-W2 | 1 | coder-execution | **media ports 8554-8564** | worker needs the supervisor seam |
| W7 | M3-W3, M3-W4, M6-W2 | 3 | coder-execution x3 | media ports 8554-8564 (M3-W3/W4), **oMLX service** (M6-W2, serialised) | writer/fixtures need M3-W2; VAD/STT needs M6-W1 + M3-W2 |
| W8 | M3-W5, M4-W1, M6-W3 | 3 | coder-execution x3 | media ports 8554-8564 (M3-W5 boot), oMLX (M6-W3) | static/boot needs M3-W3; adapters need M3-W2; diarization needs M6-W2 |
| W9 | M3-W6, M4-W2, M6-W4 | 3 | coder-execution x3 | **mobile jest runner** (M3-W6 instrumentation) | B11 instrumentation; selector module; transcript↔seal wiring |
| W10 | M4-W3, M4-W4, M5-W1 | 3 | coder-execution x3 | **core-web jest runner** (W3), **mobile jest runner** (W4) | clients need M4-W2; switch mechanics needs M3-W3 + M4-W2 |
| W11 | M5-W2, M5-W3 | 2 | coder-execution x2 | core-web jest (W2), mobile jest (W3) | mic UI after mechanics |
| — | **M3 gate**, **M4 gate**, **M5 gate** (verifier) `08_m3_gate.md`, `09_m4_gate.md`, `10_m5_gate.md` | — | verifier | — | milestone boundaries |
| W12 | M7-W1, M7-W3 | 2 | coder-execution x2 | media ports 8554-8564 (W1 kill harness later) | sealing pipeline and encryption are independent |
| W13 | M7-W2 | 1 | coder-execution | — | package/signer needs sealing pipeline |
| W14 | M7-W4 | 1 | coder-execution | — | verify needs package + encryption |
| W15 | M7-W5, M8-W1 | 2 | coder-execution x2 | media ports 8554-8564 (kill harness), evidence media route | kill matrix needs verify; media stream needs verify+encryption |
| W16 | M7-W6, M8-W2 | 2 | coder-execution x2 | core-web jest (W6), mobile jest (W6) | clients verify + export |
| W17 | M8-W3 | 1 | coder-execution | core-web jest, mobile jest | playback UI needs media stream + transcript |
| — | **M6 gate**, **M7 gate**, **M8 gate** (verifier) `11_m6_gate.md`, `12_m7_gate.md`, `13_m8_gate.md` | — | verifier | — | milestone boundaries |
| W18 | M9-W1, M9-W2, M9-W3 | 3 | test-expert, data-analyst, coder-execution | **mobile jest, core-web jest, core-server db runner, core-server unit, shared** (M9-W1 full regression serialises all suites) | hardening needs all M2-M8 |
| W19 | M9-W4 | 1 | verifier -> security-review -> test-expert -> senior-code-reviewer | — | final chain after regression/docs/hygiene |

**Wave sizes:** W1 2, W2 2, W3 4, W4 2, W5 2, W6 1, W7 3, W8 3, W9 3, W10 3, W11 2, W12 2, W13 1,
W14 1, W15 2, W16 2, W17 1, W18 3, W19 1 (40 scheduled rows + 4 deferred class-C/conditional).
**Max wave size = 4 (W3), well below the ceiling of 8.** Milestone gates are verifier checkpoints
between waves, not concurrent agents.

**Single-writer rules honoured (every occurrence):**

| Resource | Rule | Waves where it appears |
|---|---|---|
| Lockfile / `node_modules` | one writer, no test row during it | W3 (M2-W8 `openapi:gen`) |
| Homebrew | one installer at a time | W5 (only if a model install is needed; Q-INSTALL branches are pre-approved) |
| core-server db runner | one DB test/migration at a time | W2, W3, W4, W18 |
| mobile jest runner | sequential chain habit | W9 (instrumentation), W10, W11, W16, W17, W18 |
| core-web jest runner | sequential | W10, W11, W16, W17, W18 |
| oMLX service | STT/TTS serialised, never beside a large VLM session | W7, W8 (M6 rows), W18 |
| media ports 8554-8564 | one capture/fixture at a time | W5-W9, W12, W15 |
| emulator access | one lane/emulator pair at a time | W4 (M2-W1 pairing) |

### C.1 Output-path collision map

Each W-row writes **exactly one** own artifact; the map below proves uniqueness across all waves. The
controller-owned trackers (`status_tasks.md`, `delegation_progress_report.md`) and `delegation_progress/<agent>__row<N>.md`
files are excluded (controller-only, per D5(d)).

| Output path | Owning W-row | Output path | Owning W-row |
|---|---|---|---|
| `implementation/09_m2_lane_recreation.md` | M2-W1 | `implementation/30_m5_mic_switch.md` | M5-W1 |
| `implementation/10_m2_schema_check.md` | M2-W2 | `implementation/31_m5_web_mic.md` | M5-W2 |
| `implementation/11_m2_migrations.md` | M2-W3 | `implementation/32_m5_mobile_mic.md` | M5-W3 |
| `implementation/12_m2_seed_fixture.md` | M2-W4 | `implementation/33_m6_transcriber_adapter.md` | M6-W1 |
| `implementation/13_m2_reset_guard.md` | M2-W5 | `implementation/34_m6_vad_stt.md` | M6-W2 |
| `implementation/14_m2_shared_contract.md` | M2-W6 | `implementation/35_m6_diarization.md` | M6-W3 |
| `implementation/15_m2_api_contract.md` | M2-W7 | `implementation/36_m6_transcript_seal.md` | M6-W4 |
| `implementation/16_m2_openapi_pins.md` | M2-W8 | `implementation/37_m7_sealing_pipeline.md` | M7-W1 |
| `implementation/17_m2_simulated_parity.md` | M2-W9 | `implementation/38_m7_package_signer.md` | M7-W2 |
| `implementation/18_m2_config_demo.md` | M2-W10 | `implementation/39_m7_encryption.md` | M7-W3 |
| `implementation/19_m3_supervisor_ipc.md` | M3-W1 | `implementation/40_m7_verify_v2.md` | M7-W4 |
| `implementation/20_m3_worker_engine.md` | M3-W2 | `implementation/41_m7_kill_matrix.md` | M7-W5 |
| `implementation/21_m3_fmp4_writer.md` | M3-W3 | `implementation/42_m7_clients_verify.md` | M7-W6 |
| `implementation/22_m3_fixtures.md` | M3-W4 | `implementation/43_m8_media_stream.md` | M8-W1 |
| `implementation/23_m3_static_boot.md` | M3-W5 | `implementation/44_m8_export_composite.md` | M8-W2 |
| `implementation/24_m3_b11_instrumentation.md` | M3-W6 | `implementation/45_m8_playback_ui.md` | M8-W3 |
| `implementation/25_m4_adapters.md` | M4-W1 | `implementation/46_m8_class_c_physical.md` | M8-W4 (C) |
| `implementation/26_m4_selector.md` | M4-W2 | `test/02_m9_regression.md` | M9-W1 |
| `implementation/27_m4_web_selector.md` | M4-W3 | `implementation/47_m9_docs.md` | M9-W2 |
| `implementation/28_m4_mobile_selector.md` | M4-W4 | `implementation/48_m9_hygiene.md` | M9-W3 |
| `implementation/29_m4_class_c_adapters.md` | M4-W5 (C) | `gateway_check/14_m9_gate.md` + chain reports | M9-W4 |
| `initialization/03_gstreamer_install.md` | G-13/14 (existing blocked record) | `implementation/49_m9_class_c.md` | M9-W5 (C) |
| `research/11_spike_gstreamer_prototype.md` | G-13/14 | — | — |

**Result: 44 distinct W-row output paths + the two G-13/14 conditional artifacts; 0 collisions in any
wave.** Code-file-level overlaps (e.g. `app.ts`/`config.ts`/`index.ts` P25 edits, `audit-details.ts`)
are confined to a single owning W-row per file (M3-W1 owns `app.ts`/`index.ts` edits; M3-W2 owns
`config.ts`; M2-W7 owns `audit-details.ts`) so no two rows of one wave touch the same source file.

## D. Milestone gate mapping

Gate artifacts are adjusted for the `06_security_remediation.md` collision (P-4). The verifier owns the
milestone gate row; the gate runs after the milestone's implementation rows and before the next
milestone's dependent rows.

| Milestone | Completing W-rows | Proving check IDs (from row 36) | Gate artifact (verifier) |
|---|---|---|---|
| **M2** | M2-W1..M2-W10 | M2-RG-SHARED/CSU/CSD/WEB/MOB/MOCK/PG, M2-QA-1, M2-LANE-1, M2-DB-1, M2-DB-2, M2-MT-2..M2-MT-8, M2-API-1, M2-API-2, M2-API-3, M2-PIN-1, M2-SIM-1, M2-SIM-2, M2-AUD-1, M2-AUD-2, M2-CRD-1, M2-DB-CHK-1 | `gateway_check/07_m2_gate.md` |
| **M3** | M3-W1..M3-W6 | M3-RG-*, M3-QA-1, M3-WI-1, M3-AV-1, M3-AV-2, M3-KC-1, M3-KC-2, M3-KC-3, M3-KC-4, M3-SR-1, M3-SR-2, M3-SR-3, M3-MG-1, M3-BC-1, **M3-RTSP-BIND-1** (sec SEC35-23) | `gateway_check/08_m3_gate.md` |
| **M4** | M4-W1..M4-W4 (M4-W5 class C) | M4-RG-*, M4-QA-1, M4-SEL-W, M4-SEL-T, M4-SEL-P, M4-LOCK-1, M4-FAKE-1, M4-PC-1 | `gateway_check/09_m4_gate.md` |
| **M5** | M5-W1..M5-W3 | M5-RG-*, M5-QA-1, M5-SW-W, M5-SW-T, M5-SW-P, M5-GAP-1, M5-WARN-1 | `gateway_check/10_m5_gate.md` |
| **M6** | M6-W1..M6-W4 | M6-RG-*, M6-QA-1, M6-TF-1 (both backends), M6-DF-1 (`cpu-local`), M6-KR-1, M6-LB-1, M6-AD-1, M6-CP-1; **conditional** M6-STTCFG-* + M2-STTCFG-DB (8, pending Q-STT-CFG, test §A.6a) | `gateway_check/11_m6_gate.md` |
| **M7** | M7-W1..M7-W6 | M7-RG-*, M7-QA-1, M7-REF-1, M7-KM-P1..P4-0, M7-KM-C-S1..S6, M7-KM-P1..P4 x S1..S6 (24), M7-VV-SRV, M7-VV-WEB, M7-VV-PHONE, M7-TP-1, M7-FF-UNIT, M7-FF-WEB/TAB/PHONE; **conditional** M7-KM-C-S7/S8 + P x S7/S8 (10, parked) | `gateway_check/12_m7_gate.md` |
| **M8** | M8-W1..M8-W3 (M8-W4 class C) | M8-RG-*, M8-QA-1, M8-PB-W, M8-PB-T, M8-PB-P, M8-RNG-1, M8-EXP-1, M8-CMP-1, M8-BLK-1, M8-XAU-1, M8-REV-1; **proposed** M8-EV-SCOPE-1 (sec SEC35-16) | `gateway_check/13_m8_gate.md` |
| **M9** | M9-W1..M9-W4 (M9-W5 class C/pre-handover) | M9-RG-*, M9-QA-1, M9-SIM-1, M9-PIN-1, M9-DOC-1, M9-HYG-1, M9-CH-1..M9-CH-4 | `gateway_check/14_m9_gate.md` |

M0 wave-A (`test/01_wave_a_regression.md`, `gateway_check/05_m0_spec_gate.md`) and M1
(`gateway_check/04_m1_spike_gate.md`) are **complete/pending at M0** and are not re-run by W-rows.

---

## E. Class-C entry criteria (blueprint §9 C-1..C-9 + cap §J hypotheses)

Each class-C item states its entry condition, the W-row it would add (no re-planning needed), and that
it is **not scheduled** on this Mac.

| # | Item | Entry condition | W-row added on activation | Owner | Not scheduled because |
|---|---|---|---|---|---|
| C-1 | ONVIF discovery / NTP / profile on target camera | camera model known (Q-HW), on LAN; OD-05 | M4-W5 | coder-execution | no hardware; fakes cover the contract |
| C-2 | Real `CameraAdapter` RTSP/TCP pull into the worker | C-1 passed; M3 gate passed | M4-W5 | coder-execution | needs real camera; S1 push covers the mechanism |
| C-3 | Real `PoeController` (SNMP RFC 3621) | switch model/control path known (OD-07); OD-22 | M4-W5 | coder-execution | needs real switch |
| C-4 | Real `AudioInputAdapter` | mic model/transport known (OD-06) | M4-W5 | coder-execution | USB is the working assumption; needs real mic |
| C-5 | Physical tablets/phones on LAN | OD-13 = LAN; demo password replaced; B3 applied; TLS/origin | M8-W4 (+ M4/M5 device e2e) | coder-execution | loopback emulators prove the client contract |
| C-6 | Live preview of real cameras | OD-12 not "none" | (new M4 UI row; none planned) | coder-execution | OD-12 = none in this phase |
| C-7 | NM-13 STT benchmark on real Core device | Core device available (Q-HW) | M9-W5 | coder-execution + verifier | no benchmark on this Mac (D230) |
| C-8 | TPM/PKCS#11 signer adapter | OD-04 hardware option chosen; device with TPM | M9-W5 | coder-execution | software Ed25519 is the OD-04 default; DB value pre-declared |
| C-9 | Long AV-drift run (1-2 h) + repeated kill loops | user announces handover (D233) | M9-W5 | verifier | >= 10-run loops are pre-handover only (test §F.3) |

**Row 31 hypotheses (cap §J H-1..H-10) — where each is tested or falsified:**

| Hyp | Content | Tested/falsified by | W-row |
|---|---|---|---|
| H-1 | per-fragment fsync gives OS/power-loss durability | class-C OS-crash test (C-9) | M9-W5 |
| H-2 | in-file GCM keeps the file a usable fMP4 | `M7-TP-1` (one-fragment tamper) + `M7-VV-SRV` | M7-W3/W4 |
| H-3 | Range playback decrypts fragment-granularly in budget | `M8-PB-W/T/P`, `M8-RNG-1` | M8-W1 |
| H-4 | one audio encoder muxed into both files without re-encode | `M3-WI-1` | M3-W2/W3 |
| H-5 | ~20 Hz meters are sufficient under load | `M3-WI-1` + `M5-SW-W` telemetry | M3-W2, M5-W1 |
| H-6 | SNMP PoE control works on the target switch | class C-3 | M4-W5 |
| H-7 | ONVIF discovery/profile/NTP work on the target camera | class C-1 | M4-W5 |
| H-8 | USB is the correct mic transport | class C-4 | M4-W5 |
| H-9 | the S1 command-shape traps suffice for a pull camera | class C-2 (RF-2, MediaMTX Q-INSTALL 4) | M4-W5 |
| H-10 | camera video clock vs host audio clock stay aligned without drift (AU2-06) | `M3-AV-2`; long drift class C-9 | M3-W4 |

---

## F. Open items the plan depends on

| # | Open item | Blocks (hard) | Does NOT block (work that can proceed) | Where it lands if resolved |
|---|---|---|---|---|
| F-1 | **SEC35-16 role scope** (REAL-evidence case scope on op 88 / `EVIDENCE_VIEW` reads) — second-gate flag D14(d) | M8 real-evidence playback auth only | all M2-M7; M8 on simulated/demo evidence | **Confirm:** M8-W1 op 88 case-scope + new check `M8-EV-SCOPE-1`. **Reject:** M8-W1 keeps blanket `EVIDENCE_VIEW`; add the accepted residual to `specs §A` (no re-plan) |
| F-2 | **SEC35-09 no key escrow** — second-gate flag D14(d) | real-evidence custody/handover only | all M2-M7 (fakes); M7-W3 key-loss policy already records the default | **Confirm no escrow:** M7-W3 as written. **Want escrow:** add an escrow module W-row in M7/M9 (new row, no re-plan) |
| F-3 | **SEC35-02 mitigation deviation** (single-module static rule + audit instead of literal `dems_app` revoke) — second-gate flag D14(d) | M2-W3 privilege statement only | schema/migration authoring (the grant is one line) | **Accept applied mechanism:** M2-W3 as written. **Intended literal revoke:** revisit `D-DB-07` and add a 4th DB role in M2-W3 |
| F-4 | **OD-21 legal confirmation** (fMP4 as "one whole file") | handover only; default fMP4 path stands | all M2-M8 default path | **Legal says no:** activate the fallback `S7`/`S8` cells (M7-W1 + conditional M7-KM-C-S7/S8) — already listed, not scheduled |
| F-5 | **SP-4 fragment quantum** (GOP = fragment quantum; pair `CAPTURE_GOP_FRAMES`/`CAPTURE_FRAGMENT_TARGET_MS`) — confirm at the M0 spec gate (row 39) | M2-W7 constants final value; M3-W3 default | authoring (constants already proposed) | **Confirm:** M2-W7 records the pairing; **change:** one constant edit, no re-plan (row 39/40) |
| F-6 | **OD-24 / D7 TranscriberAdapter** confirmation — second-gate flag (D7(c), W1-C12), **reframed by AU3-02** as Q-D7 with three options plus the CPU-runtime route (AU2-02) | M6-W1 design text (which backends ship) and the `cpu-local` row | M6-W1 implements both backends behind one interface (none coded today) | **(a) oMLX only:** the CPU path is first proven on the Core device (class C) — D222 stays unproven on this Mac. **(b) recommended, consistent with D7(b):** oMLX for development **plus** `cpu-local` built from source under `.cache/` (GPU off), converted and proven 2 + 1 on this Mac (M6 note). **(c) `cpu-local` only:** M6-W1 drops `omlx-server`; interface unchanged |
| F-9 | **Q-STT-CFG — R-8 STT configuration menu (D20)**: enabled/disabled, backend, endpoint, model, language, labelling; kept table; `CAPTURE_CONFIG`; `STT_CONFIG_CHANGED`; next-session rule | the R-8 rows only (ops 90-92, `stt_config`, web menu, manifest `DISABLED` state) | everything else | **Confirm:** rev 2.1 adds the R-8 rows (M2 table + M6 API/UI/pipeline) and activates test §A.6a (+8 checks). **Reject:** delete the proposed R-8 sections; no other change |
| F-10 | **Q-WORKER — capture-worker build form** (C program linking libav* vs a Node native binding; AU3-04) | M3-W2 first deliverable (H-4 proof) | M2 entirely | **C program:** record the hand-built-component decision (ready-made-frameworks rule). **Binding:** name the package, licence and `allowScripts`/B2 impact |
| F-11 | **OP-GOP / OP-CLICK** (technical, AU2-08/AU2-07) | M3-W3 (observed-GOP outcome), M5-W1 (crossfade or accepted click) | all else | decided in the owning W-row and recorded in `decisions.md`; OP-CLICK is a UX choice and may be put to the user |
| F-7 | **GStreamer install decision** (D12(d)) | row 13/14 + any M1-gate re-run | the FFmpeg path (chosen; R-3 unaffected) | **Approve 11 upgrades:** activate G-13/14 in a maintenance window; refresh row 15 before any M1 re-run. **Decline:** row 15 stays the desk memo |
| F-8 | **Q-HW hardware** | class C (M4-W5, M8-W4, M9-W5) | the entire M2-M9 Mac part | **Hardware arrives:** class-C rows activate with their entry criteria (no re-plan) |

---

## G. Backlog placement and deliberate exclusions

### G.1 Backlog placement (`structured` §8 + row-25/row-26 follow-ups)

| ID | Item | Route in this plan |
|---|---|---|
| B2 | Dependency refresh (54->49 high; undici 7.29.1) | **done** (rows 5/23/24/27); enforce at M2-W7/W8 (`X-DEP-1`) |
| B3 | W99-2 pairing bucket, W99-3 socket cap | precondition of OD-13 = LAN; not scheduled (class C, §D C-5) |
| B4 | Camera-credential refusal audited; `DEVICE_CREDENTIAL_REQUIRED` no row | M2-W7 (audit rules); check `M2-AUD-2` |
| B5 | DR-1 `live-sim.ts` split | OD-26(b): **not scheduled** (after M9/separate task); the required `live-sim.ts:902-905` minimal edit is in M2-W9 (SH-25) |
| B6 | W91-10 splits; W91-17 `scripts/pg/server.mjs` runbook | runbook in M9-W2; splits OD-26(b) after M9 |
| B7 | HBX-13 static scanners -> lint rules | OD-26(b): **not scheduled** (after M9/separate task) |
| B8 | W93-10/-18/-19/-26/-27 mobile minors + B15 empty frame | M9-W3 hygiene |
| B9 | FXR-DEV-2 Reanimated warnings at Finalizing hand-over | M7-W6 with MB-04 |
| B10 | Wall-clock-independent tests (4 files) + RC-8 + `chrome-lost-updates` | **done** (rows 16-21/25/27); row 16 closed "no change required" (D10(e)) |
| B11 | RF2-2 exact late-stop wait point on tablet | M3-W6 instrumentation + M5-W3 applied |
| B12 | RC-1 (done row 22) + RC-2..RC-7 nits | RC-1 done; nits M9-W3 |
| B13 | Packaged CSP `localhost` | M9-W3 **only if a release build is made**; otherwise carried |
| B14 | QR scanning on device | **not scheduled** — out of scope (DR-02), carried |
| B15 | Tablet Home mic tiles; phone-sent device ID in audit | device ID via M2-W7 (`E-30`); tiles M5-W3 |
| B16 | Database-contract errata (C2-R3, F-4, F-6, F-7, hour-change) | **applied/carried by row 30** (dbc-3 §H): (i)(ii) APPLIED, (iii)(iv)(v) CARRIED; code-side message fix folded into M2-W3 |
| A1-A3, A6 | Release-build revoke-to-Pair, timer lag, tablet late stop, long campaigns | **only on a handover announcement** -> M9-W5 (class C/pre-handover) |
| A4 | RC-1 device check | code done (row 22); device check pre-handover -> M9-W5 |
| A5 / C7 | Biometric device test | **not scheduled** — skipped (D231) unless the user asks |
| C1-C4, C6, C8 | Shim, AVDs, host PostgreSQL, `.DS_Store`, host clean-up | not in scope; task-2 defaults stand |
| row-25 F3 | `monitor-harness.tsx waitForSheetExit` real sleep (2 out-of-scope files) | M9-W3 |
| row-25 F4 | 20 files with `jest.setTimeout(30_000)` | M9-W3 |
| row-25 F2 | shared `clearToasts()` 350 ms (30 core-web files) | M9-W3 |
| row-26 F1-F4 | RC-1 review minors routed to row 22 | **scheduled as the D14(b) W9 row-22 follow-up before row 27**; if that follow-up already applied F1-F4 to the tree row 27 sees, mark **done/omitting**; otherwise fold into M9-W3 |
| AU1-2 (row-26 F4/R1) | hub row steps back at the SEALED→history swap (probe 1129 → 1122) | **Ruling D19(b)** (the Core's authoritative recorded duration wins once the Core reports the stop; forward-only hold only while RECORDING) — implemented now by the RV-CODE revision row with a fake-clock SEALED-swap test; the A4 device check stays pre-handover |

**Deliberately left, with reason:**

| Item | Why not scheduled |
|---|---|
| B14 QR scanning | out of scope (DR-02, `structured` §8); carried |
| A5/C7 biometric device test | D231; zero biometric checks exist in row 36 (test §G) |
| B5/B7 (and B6 splits) | OD-26(b): minimal targeted edits now, large refactors after M9 or a separate task |
| C-6 live preview | OD-12 = "none in this phase" |
| Physical LAN exposure | OD-13 = keep loopback; class C-5 gated on demo-password replacement + B3 |
| M4-W5 / M8-W4 / M9-W5 class-C rows | Q-HW unknown; no re-planning needed on activation (§E) |

### G.2 Plan dependencies on the three second-gate flags (D14(d))

| Flag | Landing if confirmed | Landing if rejected | Re-plan needed? |
|---|---|---|---|
| SEC35-16 role scope | M8-W1 + `M8-EV-SCOPE-1` | M8-W1 broader read; residual note in `specs §A` | **No** — one check/branch differs |
| SEC35-09 no key escrow | M7-W3 default | new escrow W-row in M7/M9 | **No** — a new row, listed |
| SEC35-02 mitigation deviation | M2-W3 as written | M2-W3 with a 4th DB role (revisit `D-DB-07`) | **No** — one privilege statement |

SEC35-26 (privacy/DPIA) is deferred to **row 40** (it owns no W-row here; it is a specs/rev-2 text
item and is listed as a row-40 carry).

---

## H. Self-gate (row 37 hard gate, stated explicitly)

### H.1 Every spec section of rows 28-36 maps to >= 1 W-row

| Spec | Sections mapped | n/n |
|---|---|---|
| Row 28 `01_specs.md` | §0 -> M2-W6; §A.1 -> all milestone sections; §A.2 -> M9-W5; §A.3 -> M9-W5 + §F exclusions; §B R-1 -> M4-W2/W3/W4; R-2 -> M3-W1/W2; R-3 -> M5-W1/W2/W3; R-4 -> M3-W3 + M7-W4; R-5 -> M6-W1..W4 + M7-W6; R-6 -> M2-W10 + M7-W1/W6; R-7 -> M6-W1 + M9-W5; §C C-N1..C-N12 -> M3-W5, M6-W1/W2, M7-W3, M8-W1, M9-W1/W3; §C.1 -> M9-W2; §D -> M2-W6/W7 + M6-W1; §E.1 -> M3-W2/W3; §E.2 -> M5-W1; §E.3 -> M6-W1..W4; §E.4 -> M7-W2/W3/W4; §E.5 -> M7-W1/W6; §E.6 -> M4-W3/W4, M5-W2/W3, M7-W6, M8-W3; §F -> §D gates; §G.1 -> M9-W5; §G.2 -> §E; §H.1 -> §G; §H.2 -> M9-W3 + M2-W9; §H.3 -> G-13/14; §I -> this self-gate | **30/30** |
| Row 29 `03_api_contract.md` | §0 -> M2-W6/W7; §1 -> M2-W7/W8; §2.1-§2.4 -> M2-W7 + M4-W2 + M5-W1 + M6-W3 + M8-W1; §3 -> M2-W7 + M7-W4 + M8-W2; §4 -> M2-W7; §5.1-§5.3 -> M2-W7; §6 -> M2-W6; §7 -> M2-W7 + M8-W1; §8 -> M2-W8; §9 -> M2-W7/W8; §10 -> §G + row 40 | **11/11** |
| Row 30 `04_database_contract.md` | §0.1-§0.4 -> M2-W2/W3/W4/W5; §A.1-§A.4 -> M2-W3; §B.0-§B.12 -> M2-W2/W3/W4/W5; §C.1-§C.6 -> M2-W2; §D -> M2-W3; §E.1-§E.3 -> M2-W4/W5; §F -> M2-W1; §G -> M2-W3 (MT checks); §H -> M2-W3/W5 + carried note; §I -> M2-W2; §J -> M2 rows; §K -> M2 rows; §L -> §H; §M -> row 40 | **13/13** |
| Row 31 `05_capture_architecture_spec.md` | §0 -> M3-W2; §A.1-§A.8 -> M3-W1/W2/W3/W4 + M4-W1 + M5-W1 + M7-W3; §B.1-§B.2 -> M3-W1; §C.1-§C.6 -> M3-W3; §D.1-§D.4 -> M7-W3 + M8-W1; §E.1 -> M5-W1; §F -> M3-W2 + M5-W1; §G -> M3-W5; §H -> M3-W3; §I -> M3-W1/W2; §J -> §E hypotheses | **12/12** |
| Row 32 `06_evidence_package_spec.md` | §0.1-§0.2 -> M7-W2; §A.1-§A.4 -> M7-W2; §B.1-§B.11 -> M7-W2; §C.1-§C.3 -> M7-W2; §D -> M7-W4; §E.1-§E.5 -> M7-W1; §F.1-§F.4 -> M7-W6; §G.1-§G.4 -> M8-W2 + M8-W1; §H.1-§H.4 -> §F (F-4, F-1, F-7); §I -> this self-gate | **10/10** |
| Row 33 `07_transcript_spec.md` | §0.1-§0.2 -> M6-W1/W2; §A.0-§A.6 -> M6-W2/W3/W4; §B.1-§B.6 -> M6-W1; §C -> M6-W2; §D.1-§D.3 -> M6-W2/W4; §E.1-§E.3 -> M6-W2/W3; §F -> M9-W2 + M6-W1; §G -> §E; §H -> this self-gate | **9/9** |
| Row 34 `08_client_ux_spec.md` | §0 -> M4-W3/W4; §1 -> M4-W3/W4 + M5-W2/W3 + M7-W6 + M8-W3; §2-§8 (flows 1-7) -> M4-W3/W4, M5-W2/W3, M7-W6, M8-W3; §9 -> M9-W3 (P-08); §10 -> M4-W3; §11 -> M4-W3/W4 + M5-W2/W3; §12 -> §D; §13 -> this self-gate | **13/13** |
| Row 35 `09_security_design_review.md` (+ remediation) | §1 S1-S10 -> M2-W3/W7, M7-W2/W3, M8-W1, M3-W5, M5-W1, M6-W1, M7-W4; §2 -> M2-W3/W7 + M7-W2/W3; §3 -> M2-W2; §4 -> M2-W6/W7; §5 -> carried (M9-W3/M9-W1); §6 -> M3-W4/W5; §7 -> row 40 (SEC35-26); §8 -> this self-gate; §9 -> §F routing | **9/9** |
| Row 36 `10_test_strategy.md` | §0 -> §D gate naming; §A.0-§A.9 -> every W-row's Checks column + §D; §B.1-§B.4 -> all test-bearing rows; §C -> M2-W8; §D.1-§D.2 -> M3-W5, M4-W2, M6-W1, M7-W2, M8-W1; §E -> M2-W1; §F.1-§F.3 -> M7-W5 + M9-W5; §G -> M9-W3; §H -> M2-W4; §I -> M9-W1; §J -> every checkpoint; §K-§L -> this self-gate; §M -> M2-W1 + §D | **16/16** |

**Spec-section mapping: 123/123 sections across rows 28-36 mapped to at least one W-row (0 unmapped).**

### H.2 Every W-row has class + milestone + owner agent + rollback

| ID | Class | Milestone | Owner | Rollback | ID | Class | Milestone | Owner | Rollback |
|---|---|:-:|---|---|---|:-:|---|---|---|
| M2-W1 | B | M2 | coder-execution | drop lanes, re-pair | M5-W3 | B | M5 | coder-execution | revert mobile features |
| M2-W2 | B | M2 | database-specialist | revert schema/value-sets | M6-W1 | B | M6 | coder-execution | remove transcriber app |
| M2-W3 | B | M2 | database-specialist | delete migrations | M6-W2 | B | M6 | coder-execution | remove pipeline |
| M2-W4 | B | M2 | coder-execution | re-run v1 reset | M6-W3 | B | M6 | coder-execution | remove diarizer |
| M2-W5 | B | M2 | coder-execution | revert reset module | M6-W4 | B | M6 | coder-execution | revert step wiring |
| M2-W6 | B | M2 | coder-execution | revert shared src | M7-W1 | B | M7 | coder-execution | remove sealing module |
| M2-W7 | B | M2 | coder-execution | revert api/audit | M7-W2 | B | M7 | coder-execution | remove package/signer |
| M2-W8 | B | M2 | coder-execution | revert openapi/pins | M7-W3 | B | M7 | coder-execution | remove encryption |
| M2-W9 | B | M2 | coder-execution | revert sim src | M7-W4 | B | M7 | coder-execution | revert verify v1 |
| M2-W10 | B | M2 | coder-execution | revert config/demo | M7-W5 | B | M7 | coder-execution | remove kill harness |
| M3-W1 | B | M3 | coder-execution | remove capture/ + P25 | M7-W6 | B | M7 | coder-execution | revert client features |
| M3-W2 | B | M3 | coder-execution | remove worker | M8-W1 | B | M8 | coder-execution | remove evidence-media |
| M3-W3 | B | M3 | coder-execution | remove writer | M8-W2 | B | M8 | coder-execution | remove export |
| M3-W4 | B | M3 | coder-execution | remove fixtures | M8-W3 | B | M8 | coder-execution | revert evidence UI |
| M3-W5 | B | M3 | coder-execution | remove guards/boot | M8-W4 | C | M8 | coder-execution | N/A (not run) |
| M3-W6 | B | M3 | coder-execution | revert diagnostics | M9-W1 | A/B | M9 | test-expert | report-only |
| M4-W1 | B | M4 | coder-execution | remove adapters | M9-W2 | A | M9 | data-analyst | revert docs |
| M4-W2 | B | M4 | coder-execution | remove capture-config | M9-W3 | A | M9 | coder-execution | revert hygiene commits |
| M4-W3 | B | M4 | coder-execution | revert web features | M9-W4 | B | M9 | verifier/security/test/reviewer | report-only |
| M4-W4 | B | M4 | coder-execution | revert mobile features | M9-W5 | C | M9 | coder-execution + verifier | N/A (not run) |
| M4-W5 | C | M4 | coder-execution | N/A (not run) | G-13/14 | B (cond.) | M1 | coder-execution | uninstall GStreamer |
| M5-W1 | B | M5 | coder-execution | remove switch module | — | — | — | — | — |
| M5-W2 | B | M5 | coder-execution | revert web monitor | — | — | — | — | — |

**W-row field completeness: 44/44** rows carry a class, a milestone, an owner agent and a concrete
rollback (M2-W1 also carries the milestone-precedence note).

### H.3 Wave count + max size

**19 waves** (W1-W19) plus 8 milestone-gate checkpoints. **Max size = 4 (W3)** — **no wave exceeds 8.**
Wave sizes: 2,2,4,2,2,1,3,3,3,3,2,2,1,1,2,2,1,3,1.

### H.4 Collision map result

**44 distinct W-row output paths (+2 G-13/14 conditional) — 0 collisions within any wave.** Code-file
single ownership per wave is documented in §C.1 (P25 files each owned by one M3 row; `audit-details.ts`
owned by M2-W7).

### H.5 Register-row coverage (each family closed by at least one W-row)

| Family | Count | Closed by | Result |
|---|---|---|---|
| SH-01..SH-25 | 25 | W6, W2, W7, W10, W4, W9, W8, M5-W1/W2/W3, M6-W3/W4, M7-W1/W2/W3/W4/W6, M8-W1/W2/W3, M2-W1 | **25/25** |
| CS-01..CS-25 | 25 | M2-W1/W2/W3/W4/W5/W6/W7, M3-W1/W2/W5/W6/M4-W1/W2, M5-W1, M6-W1/W3, M7-W1/W2/W4, M8-W1 | **25/25** |
| WB-01..WB-11 | 11 | M2-W8 (WB-09), M4-W3, M5-W2, M7-W6, M8-W1/W3 | **11/11** |
| MB-01..MB-13 | 13 | M4-W4, M5-W3, M7-W6, M8-W1/W3 | **13/13** |
| DOC-01..DOC-06 | 6 | DOC-01/02/04/05/06 -> M9-W2; DOC-05 also M6-W1; **DOC-03 -> row 30 (M0, done) — explicit exception, closed outside M2-M9** | **6/6 (1 at M0)** |
| NM-01..NM-14 | 14 | M4-W1 (NM-01), M3-W1/W2/W3/W4 (NM-02/03/04/14), M7-W3/W1/W2 (NM-05/07/08), M6-W1..W4 (NM-06), M2-W10 + M4-W2 (NM-09), M5-W1 (NM-10), M8-W1 (NM-11), M8-W2 (NM-12), M9-W5 (NM-13, class C), M7-W5 (NM-14) | **14/14** |

**Register coverage: SH 25/25, CS 25/25, WB 11/11, MB 13/13, DOC 6/6 (DOC-03 closed at M0), NM 14/14
= 94/94.**

### H.6 Row-36 check IDs referenced

Counted mechanically over §B and §D (gates): **106 distinct check-ID tokens are named explicitly**, plus
6 range families that expand to the catalogue (`M2-RG-*`, `M3-RG-*`, `M4-RG-*`, `M5-RG-*`, `M6-RG-*`,
`M7-RG-*`) and the two kill-matrix families (`M7-KM-P1..P4-0`, `M7-KM-C-S1..S6`, `M7-KM-P1..P4 x
S1..S6`). Per milestone: M2 23, M3 13 (incl. proposed `M3-RTSP-BIND-1`), M4 8, M5 7, M6 8,
M7 51 scheduled + 10 conditional, M8 11 (incl. proposed `M8-EV-SCOPE-1`), M9 16; M0 7 and M1 21 are
cited for context and the conditional G-13/14 re-run. The standing `X-FC-1`/`X-PIN-1`/`X-DEP-1` sweep
checks attach to M9-W1/M9-W3. **Effective distinct checks attached to W-rows: ~135** (123 catalogue
IDs + the ranges above); the remainder of the 205 are the M0/M1 checks already executed at their gates.
No check is re-specified (test §M).

### H.7 Self-gate summary

| Hard-gate item (`structured` row 37) | Result |
|---|---|
| Every spec section of rows 28-36 maps to >= 1 W-row | **123/123 sections; 0 unmapped** (§H.1) |
| Every W-row has class, milestone, owner, rollback | **44/44** (§H.2) |
| No wave > 8 | **19 waves, max 4** (§C, §H.3) |
| No two rows of one wave share an output path | **0 collisions** (§C.1, §H.4) |
| Register rows each closed by >= 1 W-row | **94/94** (DOC-03 at M0) (§H.5) |
| Row-36 check IDs referenced | **106 explicit + 6 RG ranges + kill-matrix families (~135 effective)** (§H.6) |
| No external service / no code change / no emoji / no file outside the task folder | PASS |
| Class-C entry criteria + row-31 hypotheses mapped | **C-1..C-9 + H-1..H-10** (§E; H-10 added by the AU-2 errata) |
| Open items with block/no-block/landing | **F-1..F-11** (§F; F-9..F-11 added by the RV-SPEC revision, D17-D20) |

**Blocker: none.** Two deliberate row-36 pick-ups (P-1..P-4) are handed to row 40; SEC35-26 is carried
to row 40; the three second-gate flags and OD-21/SP-4/D7/GStreamer/Q-HW are recorded with their
confirm/reject landings and require no re-planning.

---

*Generated: 2026-10-07 14:28*
*Last Updated: 2026-10-08 (RV-SPEC: AU-1/AU-2/AU-3 errata, R-8 proposal D20; see masterplan/11_audit_errata.md)*
