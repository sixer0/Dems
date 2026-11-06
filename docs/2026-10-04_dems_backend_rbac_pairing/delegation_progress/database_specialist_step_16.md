---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: database-specialist
step: 16 (blueprint row 16, FIRM)
status: complete
date: 2026-10-04
last_updated: 2026-10-04 03:54
---

# Progress: database-specialist, step 16 (database contract)

## Status

complete

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/03_database_contract.md` | created (Tier 1, 2,032 lines, 15 sections, contract revision `dbc-1`, schema version 1) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/database_specialist_step_16.md` | created (this file) |

No other file was written. `masterplan/04_client_integration_spec.md`, `status_tasks.md` and `delegation_progress_report.md` were not touched. `git status --porcelain -- apps packages scripts release package.json package-lock.json` printed 0 lines after the work. No install, no database, no code, no process: PostgreSQL is not installed (F1), so no SQL statement of the contract was executed.

## Milestones

1. Read `masterplan/01_specs.md` in full (1,901 lines), the records TD-02 to TD-06, TD-12, ADQ-1, ADQ-4, ADQ-10 and the gap register of `research/03_analysis.md`, `decisions/decisions.md` (D1-D13, F1-F22), `research/01b_explore_contract_dataset.md` sections 1.9, 2 and 3, the findings table of `research/01_explore.md`, the Drizzle and template-clone evidence in `02b` and `02g`, blueprint rows 16 and 23-31 with P12, P15, P16, P19.
2. Read the shapes in code, read-only: `packages/shared/src/sim/types.ts`, `vocabulary.ts`, `events.ts`, `dataset.ts`, `initial-state.ts`, `constants.ts`, parts of `evidence.ts`, `evidence-actions.ts`, `session-machine.ts`, `scenarios.ts`, `maintenance.ts`, `faults.ts`, `views.ts`, `clock.ts`, `auth.ts`; `domain/enums.ts`, `domain/entities.ts`; `api/patterns.ts`; `demo-data/join.ts`.
3. Checked by grep that timestamps and byte counts of the shared code are integers and which key names occur in audit details and event params.
4. Wrote the contract: conventions and value sets; 29 tables for the 25 stored entities (292 columns, 29 primary keys, 24 foreign keys, 14 UNIQUE constraints, 2 partial unique indexes, 22 further indexes, 93 CHECK constraints, each index with its reason); security-relevant storage; the audit mechanisms with their statements; the privilege matrix and eight boot checks; the migration set and the reset routine; the seed mapping for 43 dataset lines; test isolation; bulk-fixture minimums; an 18-item checklist; seven specification gaps; an 11-line risk register; traceability; decisions.
5. Checked the file with a script: 29 table sections equal the inventory and the privilege matrix; every granted column exists in its table; every constraint name starts with its table name and is unique; every Markdown table has a constant cell count; all 25 entities are mapped; the file holds neither credential constant's value and no dataset person name.

## Verification the controller will apply

| Criterion | Where in the file |
|---|---|
| Every stored entity of row 15 has a table | Section 3.1 (25 of 25) |
| Every dataset entity of row 2 has a target in the seed mapping | Section 9.3 (43 lines: 39 with a target table; 4 not stored by a recorded decision, each with its anchor) |
| Append-only as a database feature with a test idea | Section 6.2; T-AO-1, T-AO-2 |
| Chain serialisation as a database feature with a test idea | Sections 6.3, 6.4; T-CH-1, T-CH-2, T-CH-3 |
| The checklist has no empty item | Section 12 (CL-01 to CL-18) |
| Impact questions 6, 7, 9, 14 with section anchors | Section 14.4: sections 10, 9, 8 (8.5) and 6 |
| Ends with "Decisions for the controller to record" | Section 15 |

## Blockers

None.

## Findings for the controller (candidates for F-n)

1. `dems_admin` is the cluster superuser (it is the role `initdb -U dems_admin` creates). Privileges therefore do not bind it; the append-only trigger does. With the demo flag on, the server process can open a connection as that role for a reset (GD-02, for row 20).
2. The reset as worded in TD-04 (drop, then recreate) would lose the kept sessions and devices on any failure after the drop. The contract builds the new database beside the old one, copies the kept tables, swaps the names and drops the old one last.
3. The kept list of the specification (section 12.4) is incomplete for storage: pairing codes and the device and code counters must also be kept, the epoch must continue, and an ACTIVE code closed by a reset has no state or reason (SPEC-GAP-2, 3, 5).
4. PostgreSQL cannot store U+0000 in `text` or `jsonb`, and an ill-formed UTF-16 string would be changed on the way in, which would break the hash of an audit row that holds it. The contract registry needs one string rule (SPEC-GAP-1, row 27).
5. The health snapshot entity (E-25) has no content and no reader in the specification (SPEC-GAP-4).
6. `drizzle-kit` 0.31.11's file layout and its support for named CHECK constraints and partial indexes were never run; the research quotes the release-candidate documentation (DA-03, GD-06). Row 28 confirms.
7. The npm PostgreSQL binaries may ship no contrib extension; the contract needs none.
8. The database checks the chain link (sequence and previous hash), not the digest itself (GD-01).

## Deviations from the agent's standard workflow

- `masterplan/02_plan.md` does not exist yet (row 18 writes it), so no tracking table was updated.
- No `implementation/99_implementation_report.md` was written: the controller asked for exactly one output file plus this progress file.
- 29 tables, not 25: three entities are split in two, and `audit_chain_head` and `schema_meta` are added.

## Decisions for the controller to record

See section 15 of the contract. In short:

- 15.1: 17 choices made by this row (tables, types, hash forms and lookups, privileges, audit mechanisms, boot checks, migration set, reset, snapshot layout, seed and clock rules, test databases, fixture minimums).
- 15.2: seven specification gaps, each with a default the schema already supports: SPEC-GAP-1 (text that PostgreSQL cannot store), SPEC-GAP-2 (pairing codes and registry counters kept across a reset), SPEC-GAP-3 (state of an ACTIVE code closed by a reset), SPEC-GAP-4 (health snapshot content), SPEC-GAP-5 (epoch continued across a reset), SPEC-GAP-6 (`lastSignInAt` after a reset), SPEC-GAP-7 (one `signedInOperatorId` per device).
- 15.3: five refinements of earlier wording (TD-04 reset order, ADQ-4 snapshot row, E-07 as its own table, test database names, detail keys of `SCENARIO_LOADED`).
- 15.4: inputs for rows 18, 20, 23, 26, 27, 28, 29, 30, 31, 36, 37, 48.

---
*Last Updated: 2026-10-04 03:54*
