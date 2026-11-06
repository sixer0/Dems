---
task_id: 2026-10-07_dems_real_capture_sealing
row: 30
agent: database-specialist
milestone: M0
class: B (GA:OD-01, OD-02, OD-03, OD-19)
tier: 1
status: complete
last_updated: 2026-10-07 10:08
---

# Row 30 — database contract dbc-3 (progress)

## Status

Complete. Deliverable `masterplan/04_database_contract.md` written (contract revision `dbc-3`,
schema version 1 -> 2, migrations 0004/0005 planned, no file created under `apps/core-server/`,
no SQL executed, no database connection). No file outside this task folder was edited; all schema,
migration and `src/db/` code files were read-only inputs. `masterplan/02_plan.md` does not exist
yet (it is written by row 37), so no plan tracking table was updated; the W-row routing needs are
listed in the contract's section M for rows 37/40.

## Inputs read (in order)

| # | Input | Used for |
|---|---|---|
| 1 | `identification/02_structured.md` (row 30 + its Verification gate; §3.1 "9 new and 5 changed"; §5/§6 M2 row; §8 B16; §10 lane-re-creation line 383; Gate Questions) | scope, counts, milestone, lane rule |
| 2 | `masterplan/01_specs.md` (row 28; R-1..R-7 acceptance criteria; C-N8/C-N9; D-table OD answers) | the spec contracted against |
| 3 | `research/03_analysis.md` (§A E-01/E-19/E-20/E-24/E-30; §B CS-16..CS-24, SH-01/02, NM-xx; §C OD mapping; §F W1-C7/W1-C10; §G RK-12/RK-16) | the register: tables, errata, corrections |
| 4 | `research/01_explore.md` §2.7/§2.8 | the four CHECK sites at exactly `:281/:382/:488/:336` + the `:335` hashes nuance; 0004/0005 free numbers |
| 5 | `apps/core-server/src/db/migrations/0000..0003.sql` (full read of 0001, 0003) | current CHECK texts quoted verbatim; privilege conventions; MG-5 version row |
| 6 | `apps/core-server/src/db/` — `schema/meta.ts`, `schema/value-sets.ts`, `schema/evidence.ts`, `schema/sessions.ts`, `reset/kept-tables.ts`, `commands/{migrate,migrations,database-names}.ts`, `fixtures/minimums.ts`, `vitest.config.ts`, `package.json` | runner mechanics, kept-set, name guard, fixture minimums, test project + `test:db` script |
| 7 | `docs/2026-10-04_dems_backend_rbac_pairing/research/10_next_phase_impact_map.md` §5-§6 | the nine new tables T-31..T-39, changed set, operations/audit context |
| 8 | `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/03_database_contract.md` (§0 conventions, §8 rules/commands/reset, §9 seed) | style, MG/RP/TI/SD rules inherited, reset step names |
| 9 | `docs/2026-10-04_dems_backend_rbac_pairing/report/01_report_inputs.md` §4 B16 row; `gateway_check/10b_closing_fixes_c2.md` §2.6; `verification/03_clean_state_rebuild.md` §13 (F-4/F-6/F-7); D240 in `decisions/decisions.md` | B16 items (i)-(v) verbatim; lane re-creation facts |
| 10 | `docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md` §4 lines 234-235, 184 | lane re-creation command lines, per-lane pairing, throw-away-copy method (W98) |
| 11 | `README.md:250-266`, `packages/shared/src/sim/{auth.ts,initial-state.ts,vocabulary.ts}`, `.data/` listing (names only) | command forms, built-in device IDs, permission set, credential file names |

## Output

| File | Content |
|---|---|
| `masterplan/04_database_contract.md` | §0 scope/non-goals + 9/5 count reconciliation + coverage map; A migration plan (0004/0005 order, DDL plan, runner mechanics, v1-data validation constraint); B 9 new + changed tables with columns/privileges/reset policy per table + change summary; C CHECK changes with file:line and quoted current/v2 text (3/3 FAULT_KIND + signature + hashes + tamper + 6 others); D 0005 privilege statements + matrix; E kept set (11) + OD-19 guard query shape + `dems_demo` reseed rules; F lane re-creation procedure + red lines; G migration test plan (throw-away copy + fresh lanes, MT-1..MT-8, v2 bulk minimums, command forms); H B16 (i)-(v); I never-log restatement; J register coverage; K ten new decisions; L self-gate; M routed open points |

## Key decisions recorded in the contract

| ID | Decision (short) |
|---|---|
| D-DB-01 | `manifest_version DEFAULT 1 CHECK IN (1,2)`; seed writes 2 |
| D-DB-02 | OD-03 two hashes: `sha256` = stored bytes (kept column), new nullable `sha256_plain`; rule enforced in mapping/seed/verify |
| D-DB-03 | signature values lowercase hex, per-algorithm CHECK |
| D-DB-04 | `integrity_source` gains `'REAL'`; the reset guard keys on it + disk cross-check |
| D-DB-05 | tamper/track CHECKs stay permissive; v2 shape is code-enforced (0004 must validate against v1 rows) |
| D-DB-06 | `dems_app` has no SELECT on `capture_device_credentials`; owner SECURITY DEFINER reveal function |
| D-DB-07 | no FKs from live-session tables, no sequences, no new DB roles |
| D-DB-08 | kept-mode `upsert` for the three capture kept-tables |
| D-DB-09 | permissions arrive by seed only; the map's "permission rows in 0004" cell overridden (MG-8 + E-19/E-20) |
| D-DB-10 | dual-profile single-device selector rows legal (OD-05) |

## Self-gate results (row-30 Verification)

| Check | Result |
|---|---|
| 3/3 FAULT_KIND CHECK sites with file:line | 3/3 — `0001_tables.sql:281`, `:382`, `:488` (plus `:335` hashes, `:336` signature, `:338` tamper, `:340/:353/:354/:260` listed) |
| Every new table has columns + privileges + reset policy | 9/9 (T-31..T-39) |
| B16 items (i)-(v) each applied or carried with a reason | 5/5 — (i) applied, (ii) applied, (iii) carried, (iv) carried, (v) carried |
| Migration test plan names throw-away copy of `dems_demo` + fresh lanes | yes (G: MT-1..MT-8 on `dems_test_*` clone of `dems_demo` + `dems_lane_1..3`) |
| 9-new/5-changed reconciled with the register | yes (§0.2; E-01's `health_snapshots` as the 6th CHECK-only target; 30 -> 39 tables) |

## Notes / issues

- `masterplan/04_database_contract.md` was the row-29-parallel naming target of row 30; no other
  masterplan file was touched. The row-39 M0 gate cross-checks this file against the register
  (`structured` row 39); open points routed to rows 29/31/32/35/36/37/40 are listed in section M.
- Line-citation nuance carried from the register: blueprint row 30 says "relaxed signature CHECK
  (`0001_tables.sql:335-336`)"; per W1-C10 `:335` is the hashes CHECK and `:336` the signature
  CHECK; both are attributed separately in contract C.5/C.4.
- No blocker.

DB_COMPLETE: dbc-3 (migrations 0004/0005 plan, schema v2, CHECK changes, privileges, kept-on-reset, lane re-creation) - masterplan/04_database_contract.md written; self-gate 3/3 CHECK sites, 9/9 tables, 5/5 B16, test plan named, 9/5 reconciled
Contract: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/04_database_contract.md
