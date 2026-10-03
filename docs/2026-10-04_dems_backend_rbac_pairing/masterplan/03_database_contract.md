---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: database-specialist
blueprint_row: 16 (FIRM); revision 2 by controller row 20a (decision D16); revision 2.1 applies the rulings of D18 and D19; revision 2.2 aligns the text with the plan's revision 2 (consistency check, finding C-07)
tier: 1
type: database-contract (PostgreSQL 18.4; drizzle-orm 0.45.3 over pg 8.23.1; drizzle-kit 0.31.11)
status: completed (design document; nothing installed, nothing executed); the two conflicts of revision 2 are decided and applied (section 15.5); nothing is open
revision: 2.2
confidence: MEDIUM
confidence_note: repository and specification facts are HIGH (read from files). Every PostgreSQL behaviour the design relies on is general knowledge that no research file states and no row has executed; each is listed as PG-n in section 1.9 and labelled hypothesis until row 23 (W07) or row 28 (W17) runs it
based_on: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md
reviewed_by: gateway_check/03_security_design_review.md (row 20, verdict CAUTION)
binding_decisions: D1-D20, DR-01, DR-02, DR-03, DR-04 (decisions/decisions.md)
contract_revision: dbc-2
schema_version: 1
sibling_specs: masterplan/01_specs.md (row 15), masterplan/04_client_integration_spec.md (row 17), masterplan/02_plan.md (row 18)
implemented_by: blueprint rows, with the plan's work rows (plan section 21) in brackets. 23 (W07; roles, credential files, trial), 28 (W17; schema and migrations; W10 proves drizzle-kit, W11 builds the test helper), 29 (W20; seed), 30 (W25; bulk fixture), 31 (W21; audit writer), 32 (W24, W41), 35 (W33) and 36 (W32) (atomic state changes), 48 (W29; reset routine; W43, the demo-control module)
last_updated: 2026-10-04 06:06
---

# Database Contract: DEMS Core server on PostgreSQL 18.4

## Revision history

| Rev | Date | Contract revision | By | Summary |
|--:|---|---|---|---|
| 1 | 2026-10-04 | `dbc-1` | database-specialist, blueprint row 16 | First issue: 29 tables, two roles. Accepted by D14 |
| 2 | 2026-10-04 | `dbc-2` | database-specialist, controller row 20a | The corrections of the security design review (`gateway_check/03_security_design_review.md`, row 20, verdict CAUTION) folded in, as decision D16 directs; the rulings of D14 stated as decided. 30 tables, three roles |
| 2.1 | 2026-10-04 | `dbc-2` (unchanged: no migration exists yet) | database-specialist, controller row 20a | **CONFLICT-1 and CONFLICT-2 ruled by the controller (D18, D19) and applied.** CONFLICT-1: the runtime role `dems_app` has SELECT only on `audit_chain_history`; rows are appended only by the reset routine under `dems_owner`. Sections: 3.3; 4.30; 6.1 to 6.3; 6.5 (T-AO-3); 6.6; 7.3; 7.4 (B-5); 8.3; 12 (CL-11); 13.2; 14.5; 14.6. CONFLICT-2: the superuser trigger check of SD-06 is a check of `scripts/pg/` run at provisioning (trial step T5-j), outside `test:db`. Sections: 1.9 (PG-21); 6.5 (T-AO-2c, T-AO-4); 7.1; 7.6; 10 (TI-9). Both conflicts marked DECIDED and the controller's acceptances recorded: 15.1; 15.3 to 15.5; 15.6 (new). No table, column, constraint or count changed |
| 2.2 | 2026-10-04 | `dbc-2` (unchanged) | database-specialist, controller request after row 19 | **Text only: finding C-07 (Minor) of the masterplan consistency check** (`gateway_check/02_masterplan_consistency.md`). The sentences that still described the plan's first revision are aligned with its revision 2 [D20]: five keys in each connection file with `DEMS_PG_DATABASE`, both project roles created by `pg:init` in W07, `db:create` creating no role. Sections: 7.6 (intro, CR-1); 8.4; 15.4 (plan row); 15.5 (NOTE-1 reconciled). NOTE-4, the provisioning trial step T5-j, is marked ACCEPTED [D19]: 15.5, 15.6. Wherever a provisional blueprint row (23 to 118) is cited, the plan's work-row ID from plan section 21 is added, as in "row 28 (W17)"; the mapping used is the table in section 0. The citation of the plan's name table became `[PL:§3.4]`. Binding decisions D1 to D20 and DR-01 to DR-04. No rule, table, statement or count changed |

Revision 2 changes each rule in the section where it lives. No patch list is appended and no superseded statement is left standing; where a sentence of revision 1 was wrong, the body says what holds now and, once, what revision 1 said. `schema_version` stays 1: no migration of revision 1 was ever generated or applied (section 1.4), so the first migration set is written from this revision.

**Changes of revision 2.** Findings are those of the review (`SD-nn`); `D` and `DR` are rows of `decisions/decisions.md`.

| # | Finding or decision | Change | Sections touched |
|--:|---|---|---|
| 1 | SD-01; DR-03; D16 | **Three roles.** `dems_admin` is the cluster superuser and is used at provisioning only. `dems_owner`, not a superuser, with `CREATEDB`, owns every project database and object and performs migrate, seed, reset and test-database creation. `dems_app` is the runtime role, privileges unchanged. Role provisioning RP-1 to RP-6 and trial steps for row 23 (W07); what the running server may hold (HC-1 to HC-5): `dems_owner` for one reset with the demo flag on, `dems_admin` never; the role of every reset step and a role check at R-0; boot checks B-4 and B-9; templates and clones owned by `dems_owner` | front matter; 0; 1.1 to 1.3; 1.5; 1.7; 1.8 (DA-11, DA-12); 1.9 (PG-02, PG-04, PG-15, PG-22, PG-23, PG-26, PG-27); 6.1; 6.2; 7.1 to 7.5; 8.1 (MG-9); 8.3; 8.4; 8.5; 9.1 (SD-3); 10 (TI-4 to TI-6, TI-9, TI-10, TI-17; 10.1; 10.2); 11 (BF-2); 12 (CL-11, CL-16); 13.2 (GD-02, GD-12, GD-13); 14.5 |
| 2 | SD-06 | Both audit triggers, and the lineage trigger, are `ENABLE ALWAYS`; boot check B-5 expects `'A'`; section 6.2 states exactly what binds the runtime role, the owner role and a superuser, and what does not; the trigger test has four cases | 1.9 (PG-21, PG-22); 4.12; 6.1 (G-2, G-6); 6.2; 6.3 (statement group 6); 6.5 (T-AO-2a to T-AO-2d, T-AO-4); 7.4 (B-5); 8.2; 10.1; 12 (CL-13) |
| 3 | SD-10 | `TOKEN_REUSE` is the eighth value of the closed set of session end reasons; a reused biometric token ends the open biometric sessions of its device and operator; one new CHECK; no new column | 2.4; 4.6; 4.10; 5.2; 5.3; 5.6 (AT-C4); 11 |
| 4 | SD-04 | Atomic state changes: rules AT-1 to AT-6; an attempt consumed before the verification; compare-and-set transitions; single-use redemption of a pairing code and of a biometric token; the last-administrator check under a lock; five cases, each with its statements and a concurrency test; counters advanced by one statement | 1.5; 1.9 (PG-24, PG-25); 4.7; 4.10; 4.11; 5.2; 5.6 (new); 12 (CL-19) |
| 5 | SD-19; D16 | The lineage table `audit_chain_history` (T-30, entity E-26): one row per discarded chain, kept across every reset, protected by privilege (read-only for the runtime role since revision 2.1) and by the same kind of trigger as the audit table; the reset routine carries it over and appends to it; rules LN-1 to LN-6; how `verifyAuditChain` reads it. Table count 29 to 30; the entity map, the inventory, the privilege matrix, the reset routine, the seed expectations and the bulk-fixture minimums updated | 1.5; 2.4; 3.1; 3.3; 4.30 (new); 6.1 (G-7); 6.3 (statement group 5); 6.5 (T-AO-3); 6.6; 7.3; 7.4; 8.2; 8.3; 8.4; 8.5; 9.3; 9.4; 10.1; 11; 12 (CL-04, CL-09, CL-13, CL-14, CL-18); 13.2 (GD-14) |
| 6 | SD-15 | Credentials inventory: three files and their modes, the five field names of each connection file (names only), which process may read which file, no secret in a process argument or an environment variable, how the passwords are generated; the `pg_hba.conf` check: loopback only, `scram-sha-256`, no `trust` line | 1.9 (PG-28); 5.1; 7.1 (RP-1, RP-2, trial steps T3-a, T3-b); 7.6 (new); 8.4; 12 (CL-20) |
| 7 | D14 | SPEC-GAP-1 to SPEC-GAP-7 are DECIDED with the adopted defaults; the three accepted refinements are marked as accepted | 3.1; 4.11; 4.26; 4.28; 8.5; 13.1; 15.2; 15.3 |
| 8 | SD-09 | The session lookup is bound to the transport: the cookie resolves only a session without a device, a bearer value only a session with one | 4.6; 5.2 |
| 9 | SD-03, SD-21, SD-27 (owned by the specification); rulings on GD-01 and GD-02 | One sentence each: the denial budget bounds refusal rows; no pepper, the salt source, the hash always computed; the primary key serves the incremental chain check; GD-01 accepted as is; GD-02 closed with a stated residual | 4.12; 5.1; 5.2; 6.1; 13.2 |
| 10 | this revision | Contract revision `dbc-2`; citation rules for the review and reading notes on colliding IDs; the count of tables per entity put right in words; traceability of the folded corrections; ten new choices; two conflicts raised for the controller (decided in revision 2.1) | front matter; 0; 3.1; 4.29; 13.2 (GD-15 to GD-17); 14.7 (new); 15.1; 15.4; 15.5 (new) |

**The two conflicts of revision 2 are DECIDED** (section 15.5). In revision 2 two corrections contradicted a rule of this contract or each other; each was written with a working default and marked for the controller's decision. Revision 2.1 applies the rulings; nothing is open.

- **CONFLICT-1 — DECIDED** [D18, D19]. The runtime role has **SELECT only** on `audit_chain_history`. Revision 2 had granted INSERT as well, as its brief said. The contract now agrees with the review and with the specification (DC-6, SR-78, AC-B-87).
- **CONFLICT-2 — DECIDED** [D19]. The test "as the bootstrap superuser" that the review asks for is a check of `scripts/pg/`, run at provisioning (trial step T5-j), outside `test:db`. Nothing under `apps/core-server/` reads the superuser's password file, and the role check of R-0 is tested with a stub.

**Consistency checks of revision 2.2.** Run by a read-only script over the final text of this file on 2026-10-04, after the patch; all pass.

| Check | Result |
|---|---|
| Table sections 4.1 to 4.30 = inventory 3.3 = privilege matrix 7.3 | 30 = 30 = 30; same names; `T-nn` equals the section number |
| The seed table 9.4 and the fixture table 11 each cover every table once | 30 of 30 in both |
| Entity map 3.1 | E-01 to E-26, each once |
| Constraint and index names | 192 names, all unique; each starts with its table name, is lower-case `snake_case`, at most 63 bytes, and carries the suffix of its kind (N-4) |
| Counts | 302 columns; 30 primary keys; 25 foreign keys; 15 UNIQUE constraints and 2 partial unique indexes; 22 further indexes; 98 named CHECKs. Revision 1: 292, 29, 24, 14 and 2, 22, 93 |
| Privileges | Every column named in the matrix and in a `GRANT UPDATE` of 8.3 exists in its table; the tables of `GRANT INSERT` in 8.3 equal the I column of the matrix (16; revision 2 had 17, with the lineage table) |
| Value sets | Every value set and format rule used in section 4 is defined in 2.4 |
| Rule and test IDs | PG-01 to PG-28, DA-01 to DA-12, B-1 to B-9, AT-1 to AT-6, LN-1 to LN-6, RP-1 to RP-6, HC-1 to HC-5, CR-1 to CR-7, HA-1 to HA-4, TI-1 to TI-17, MG-1 to MG-11, GD-01 to GD-17, CL-01 to CL-20, OW-1 to OW-9, N-1 to N-6, NOTE-1 to NOTE-4, R-0 to R-9: each defined once, without a gap; 32 test IDs, all unique; every ID that the text refers to is defined, the trial steps T3-a, T3-b and T5-a to T5-j included |
| The two rulings (revision 2.1) | The matrix gives `dems_app` SELECT only on `audit_chain_history`; the table is not in the `GRANT INSERT` of 8.3; the inventory says "read"; B-5 expects INSERT on it to be false; both conflicts are marked DECIDED; no line still calls a conflict open or gives the runtime role INSERT on the lineage table; trial step T5-j is defined once and runs as `dems_admin`; section 15.6 and the history row 2.1 exist |
| The plan alignment (revision 2.2) | The seven connection key names and the file `.data/pg.owner.env` are the same in the plan's revision 2 and here; no sentence still describes the plan's first revision as current; NOTE-1 is marked RECONCILED and NOTE-4 ACCEPTED; the front matter binds D1 to D20 and DR-01 to DR-04; the history row 2.2 names C-07 |
| Work-row IDs (revision 2.2) | The script reads the blueprint delta of the plan (its section 21: 95 provisional rows mapped). Every citation of a provisional blueprint row in this file carries a work-row ID (148 row numbers: 133 in the text and 15 in the row cells of 15.4), and every ID beside a row number is one that the plan gives for that row |
| Markdown | Every table has a constant cell count; code fences are balanced |
| No credential value | The values of `DEMO_OPERATOR_PASSWORD` and `DEMO_PAIRING_CODE` (read from `dataset.ts` by the script, never printed) do not occur. No password literal, no connection URL with a password, no `key=value` secret and no token value occurs; every `PASSWORD` in a statement is followed by the placeholder `'...'` |
| No personal data | No operator name, display name or username of the dataset occurs. The script masks the absolute workspace path first: its account folder name is equal to a given name of the dataset (GD-11), and the path stands in the front matter and in the citation rule since revision 1 |

## 0. Reading guide

| Section | Content | Impact question answered |
|---|---|---|
| 1 | Tier 1 frame: subject, stakeholders, timeline, scope, rationale, method, alternatives, assumptions, PostgreSQL behaviours relied on | |
| 2 | Conventions: naming, types, keys, value sets, JSON, slice-to-table mapping rules | |
| 3 | Entity-to-table map: E-01 to E-26 and the 30 tables | |
| 4 | Tables: columns, types, nullability, defaults, keys, constraints, indexes with a reason each | |
| 5 | Security-relevant storage: stored forms, lookup strategy, expiry and revocation columns, columns that must never be logged, atomic state changes (5.6) | |
| 6 | **Audit table: append-only and chain serialisation**; what binds which role; the lineage of discarded chains | **14** |
| 7 | Roles and privileges: the three roles, ownership, privilege matrix, what the server checks at boot, the credentials inventory and the host-authentication check (7.6) | |
| 8 | **Migration order and reset**: naming, order, commands, lane and demo databases, the reset and carry-over routine with the role of every step | **9** |
| 9 | **Seed mapping and seed clock rule** | **7** |
| 10 | **Test-database isolation** | **6** |
| 11 | Bulk fixture: minimum row counts per entity | |
| 12 | Database design checklist | |
| 13 | Specification gaps (SPEC-GAP-n, decided by D14) and the risk register of this contract (GD-n) | |
| 14 | Traceability, including the review corrections folded in (14.7) | |
| 15 | Decisions for the controller to record; the two conflicts of revision 2, both decided (15.5); what the controller accepted (15.6) | |

**Citation convention.** `[SP:§3.3]` is a section and `[SP:L1289]` a line of `masterplan/01_specs.md`. `[AN:TD-04]` or `[AN:367]` is a record or a line of `research/03_analysis.md`. `[R1:n]` is a line of `research/01_explore.md`, `[R2:n]` of `research/01b_explore_contract_dataset.md`, `[R7:n]` of `research/02b_collection_data_access.md`, `[R12:n]` of `research/02g_collection_test_tooling.md`. `[BP:n]` is a line of `identification/02_structured.md`. `[DEC:D13]`, `[DEC:F6]` are rows of `decisions/decisions.md`. `[RV:SD-06]` is a finding, `[RV:§5.2]` a section and `[RV:R-08]` a residual risk of `gateway_check/03_security_design_review.md`. `[PL:§3.4]` is the section "Pinned names" and `[PL:§21]` the blueprint delta of `masterplan/02_plan.md`, revision 2 (accepted by [DEC:D20]); `W17` is a work row of that plan. Code is cited as `path:line` relative to `/Users/gsp-budi/Documents/DEMS/`. `[PG-n]` is a PostgreSQL behaviour of section 1.9: general knowledge, **hypothesis** until the row named there executes it. A statement without a source is labelled **hypothesis** or carries an assumption ID (DA-n, section 1.8).

**Two reading notes for revision 2.** (1) Line citations `[SP:Lnnn]` point at the specification as it stood at 03:14, when revision 1 was written. The specification was revised under D16 in the same wave as this file, so its line numbers have moved; section numbers and rule IDs (`[SP:§12.4]`, `[SP:DC-5]`) stay valid (GD-16). Where this revision cites a rule that only the revised specification has (E-26, ID-12, ID-13, ENG-23 to ENG-27, DC-10, SR-68 to SR-78, AC-B-72 to AC-B-87, CF-1, CF-2, GS-24, GS-25, GS-28), the text is the one that file held at 05:09. (2) Three ID families of this file look like IDs of other files. The seed rules **SD-1 to SD-8** (one digit, section 9.1) are not the review findings **SD-01 to SD-29** (two digits), which this file always writes as `[RV:SD-nn]`. The reset steps **R-0 to R-9** are not the review's residual risks `[RV:R-nn]`. The seed clock rules **DR-1 to DR-8** (section 9.2) are not the drift records `[DEC:DR-nn]`.

**Blueprint rows and plan work rows.** This file was written against the blueprint's first revision, whose rows 23 to 118 were provisional. The plan replaced them by the work rows W01 to W105 [DEC:D17, D20]. Wherever this file cites a provisional row, the work row follows in brackets, as in "row 28 (W17)". The mapping is the plan's [PL:§21] and nothing else; where the plan splits a row, the third column says which part this file means. Rows 1 to 22 are firm rows and have no work-row ID.

| Provisional row | Work rows, as [PL:§21] gives them | The part this file means, where the row is split |
|---|---|---|
| 23 | W03 (npm part), W07 | W07: provisioning, roles, credential files and the trial |
| 26 | W16 | |
| 27 | W19, W22, W27 | W19: the contract part that carries the one string rule of SPEC-GAP-1 |
| 28 | W10 (proof), W11 (HB-12), W17 | W17: schema, migrations, database commands and their tests. W10 where the point is what `drizzle-kit` emits; W11 where it is the test helper |
| 29 | W20 | |
| 30 | W25 | |
| 31 | W21 | |
| 32 | W09, W23, W24, W41 | W24 (identity core) and W41 (biometric token) |
| 35, 36 | W33, W32 | In that order: 35 is W33 (administration), 36 is W32 (pairing) |
| 37 | W04 (proof), W26 | W26: the engine host |
| 45 | W39 | |
| 48 | W29 (reset routine), W43 (module) | W29 for the routine and its tests; both where the demo controls as a whole are meant |
| 50, 51, 52, 53, 54, 55 | W45, W47, W52, W48, W49, W53 | In that order |
| 105 | W90 | |
| 110, 111, 112, 113 | W98, W99, W100, W91 | In that order |

**Normative words.** "MUST", "MUST NOT" and "MAY" state requirements on the schema, the migrations, the seed and the commands. The numbered units are tables T-01 to T-30, mapping rules MR-n, the append protocol AP-n, the atomic-transition rules AT-n, the lineage rules LN-n, role-provisioning steps RP-n, held-credential rules HC-n, credential-file rules CR-n, host-authentication rules HA-n, boot checks B-n, reset steps R-n, seed rules SD-n, test-isolation rules TI-n and checklist items CL-n.

**No credential value appears in this file.** The demo password and the simulator's pairing code are cited by constant name only: `DEMO_OPERATOR_PASSWORD` (`packages/shared/src/sim/dataset.ts:153`), `DEMO_PAIRING_CODE` (`:157`). Operators are named by ID (`OPR-001` to `OPR-003`) only. The passwords of the three PostgreSQL roles are named by file and by key (section 7.6); a statement that carries one shows `'...'` in its place.

---

## 1. Tier 1 frame

### 1.1 Subject

The database contract of the DEMS Core server (`apps/core-server`): every table, column, key, constraint and index of the PostgreSQL 18.4 database that stores the 26 entities of the server specification [SP:§3.3]; the database features that make the audit table append-only and its hash chain serial; the statement patterns that make a server-native state change atomic; the three roles, their privileges and their credential files; the migration set and the reset, with the lineage of the chains a reset discards; the mapping from the shared demo dataset to the tables; the isolation of test databases; the volumes of the bulk fixture.

### 1.2 Stakeholders

| Stakeholder | What this file gives them |
|---|---|
| The user (demo owner and presenter) | State that survives a restart (SC2), an audit trail that the running server cannot rewrite, a reset that does not sign anybody out or unpair a device [SP:§12.4] |
| Controller | The table inventory, the seven specification gaps as decided by D14 (section 13.1), the decisions of section 15, the two conflicts of section 15.5 with their rulings, the record of what was accepted (15.6) |
| Row 23 (W07; provisioning) | Sections 7.1 and 7.6: the three roles and who creates them, the credential files and their modes, the host-authentication check, the trial steps that prove the owner role is enough |
| Row 28 (W17; migration writer, P16) | Sections 2, 4, 5.6, 6.3, 7 and 8: every statement the migration set needs, with no design choice left open |
| Rows 32 (W24, W41), 35 (W33), 36 (W32) (identity, administration, pairing) | Section 5.6: the statement pattern of each atomic state change and the test that proves it |
| Row 29 (W20; seed) | Section 9: target table and rule per dataset entity, expected row counts, the checksum recipe |
| Row 30 (W25; bulk fixture) | Section 11 |
| Row 31 (W21; audit writer), row 37 (W26; engine host) | The append protocol AP-1 to AP-7 (section 6.4) and the mapping rules MR-1 to MR-9 (section 2.6) |
| Row 48 (W29, W43; demo controls) | The reset routine R-0 to R-9 with the role of every step, its failure table (section 8.5) and the lineage table (4.30, 6.6) |
| Row 20 (security design review) and rows 50 (W45), 111 (W99), 112 (W100) (later reviews) | Section 5, the privilege matrix (7.3), what binds which role (6.2), the credentials inventory (7.6), GD-01, GD-02 as closed by D16 |
| Rows 51-55 (W47, W52, W48, W49, W53; test-expert) | Section 10 and the test ideas T-AO, T-CH, T-AT, T-RS, T-PV, T-CR, T-HA |

### 1.3 Timeline

| When (2026-10-04, WIB) | Event | Source |
|---|---|---|
| 03:14 | Server specification finished (row 15) | [SP:L1900] |
| 03:16 | Row 15 accepted; rows 16 and 17 start in parallel | [DEC:D13]; `ls -l` shows `decisions/decisions.md` last written at 03:16 |
| 03:16-03:53 | This contract, revision 1 (row 16, wave M2) | `date` printed `2026-10-04 03:31 WIB` during the row and `2026-10-04 03:53 WIB` at its end |
| 03:53 onward | Row 16 accepted; the defaults of SPEC-GAP-1 to SPEC-GAP-7 adopted | [DEC:D14] |
| 04:25 | Security design review (row 20): CAUTION, findings SD-01 to SD-29 | [RV] footer |
| after 04:25 | All 24 corrections are folded into the design documents before implementation; SD-19 is a database table that survives every reset | [DEC:D16, DR-03] |
| 04:36-05:12 | Revision 2 of this contract (controller row 20a), in parallel with the revision of the two sibling specifications and with the plan. The revised specification was read at 04:55 and again at 05:09, and the names it left to this contract were fixed | `date` printed `2026-10-04 04:36 WIB` when the edits began and `2026-10-04 05:11 WIB` at the last run of the checks |
| after 05:12 | Row 20b (the two sibling specifications) and row 20a (this file) accepted; CONFLICT-1 and CONFLICT-2 ruled | [DEC:D18, D19] |
| 05:13-05:25 | Revision 2.1 of this contract: the two rulings applied in place | `date` printed `2026-10-04 05:13 WIB` when the patch began and `2026-10-04 05:21 WIB` during it; the end time is in the footer |
| 05:31 | The plan's revision 2 accepted: 105 work rows W01 to W105; five keys in each connection file; after W07 nothing connects as `dems_admin` | [DEC:D20] |
| 05:53 | Masterplan consistency check (row 19): finding C-07 (Minor) on this file, stale remarks about the plan's first revision | `gateway_check/02_masterplan_consistency.md` |
| 05:54-06:06 | Revision 2.2 of this contract: text only (C-07; NOTE-4 accepted; work-row IDs beside provisional row numbers) | `date` printed `2026-10-04 05:54 WIB` when the patch began and `2026-10-04 06:04 WIB` during the checks; the end time is in the footer |
| Next | Rows 21 (blueprint refinement, in parallel with row 19, [DEC:DR-04]) and 22; then row 23 (W07) provisions PostgreSQL and row 28 (W17) implements this file | [DEC:D16, D20]; [BP:296-301] |

No duration estimate is given [AN:69].

### 1.4 Scope

- **In scope**: tables, columns, types, keys, constraints, indexes; audit immutability and chain serialisation as database features; roles, ownership and privileges; migration naming, order and reset; lane and test databases; the seed mapping with the date-relative rule; the bulk-fixture minimums; a design checklist [BP:289].
- **Owned by sibling files, only referenced here**: operations, permissions, audit types, the engine and the realtime protocol (row 15); client behaviour (row 17); command names, serial slots and the Host Impact Register (row 18). The names of commands and files in this file were proposals for row 18 [SP:§19.5 Row 18 #2]; the plan's revision 2 pins the same names [PL:§3.4].
- **Not done by this row**: no install, no database, no code, no process. PostgreSQL is not installed on the host [DEC:F1], so **no SQL statement in this file has been executed**. Two files are written: this contract and the progress file.
- **Revision 2** changed this file in place and wrote `delegation_progress/database_specialist_step_20a.md`. It touched no other file: `masterplan/01_specs.md`, `masterplan/04_client_integration_spec.md` and `masterplan/02_plan.md` belong to other agents in the same wave. Where this file needs a change in one of them, the point is listed in section 15.4 as an input, not written there.

### 1.5 Rationale and evidence chain

| Step | Fact | Source |
|---|---|---|
| 1 | The specification names 25 stored entities and asks row 16 for a table (or columns) for each. Its revision 2 adds a 26th, the chain lineage | [SP:§3.3]; [SP:§19.5 Row 16 #1] |
| 2 | The persistence model is fixed: tables for records, one snapshot row for the simulated hardware, no meter frames | [DEC:D11 ADQ-4]; [AN:567] |
| 3 | The audit chain is `sha256(prevHash ‖ canonicalJSON(body))` with `seq = total + 1`, so appends are serial by construction | `packages/shared/src/sim/events.ts:64-66, 123`; [DEC:F14] |
| 4 | The specification requires the database, not only the application, to refuse UPDATE, DELETE and TRUNCATE on the audit table and to refuse a row that does not continue the chain | [SP:ENG-11]; [SP:SR-52, SR-53]; [AN:568] |
| 5 | Three roles are fixed: `dems_admin` (cluster superuser, used at provisioning only), `dems_owner` (not a superuser; owns the databases and objects; migrations, seed, reset, test databases) and `dems_app` (runtime). This amends the two roles of the analysis | [DEC:D16, DR-03]; [RV:SD-01, §5.2]; [AN:273] |
| 6 | Migrations are SQL files generated by `drizzle-kit`, roll-forward only; hand-written SQL files carry triggers and grants | [AN:367]; [R7:66-67] |
| 7 | A reset is a database re-creation by the owner role, and it must keep auth sessions, paired devices, biometric tokens and settings | [SP:§12.4]; [SP:SA-08]; [DEC:D13] |
| 8 | Therefore: privileges are granted per table and per column, so that each "never changed" rule of the specification is a missing privilege of `dems_app`, and the audit rules are also triggers, because privileges do not bind the owner role. The triggers are `ENABLE ALWAYS`, so a session setting cannot skip them. Against a superuser no database feature holds; what holds is that no running process has its credentials | sections 6 and 7; [RV:SD-01, SD-06] |
| 9 | Therefore: the reset builds the new database beside the old one, copies the kept tables into it and swaps the names, so a failure before the swap leaves the old database as it was | section 8.5; accepted by [DEC:D14] |
| 10 | The seed takes `now` as a parameter and calls the shared builders; identifiers carry the seed date; the demo packages join by suffix | [SP:ENG-17 to ENG-20]; [DEC:F6]; [R2:520] |
| 11 | A server-native state change is a check followed by a write. With the password hash computed outside the pipeline, two requests can pass the same check; the pairing-code bound of 5 guesses in 1,000,000 holds only if that cannot happen | [RV:SD-04, §5.1] |
| 12 | Therefore: each such change is one transaction that starts at the chain lock, counts an attempt before it compares, and moves a state by one compare-and-set statement whose row count decides | section 5.6 |
| 13 | A reset discards a chain. One log line and one row of the next chain do not survive a second reset | [RV:SD-19, §5.6] |
| 14 | Therefore: each discarded chain is one row of a table that every reset carries over and appends to, protected like the audit table | [DEC:D16]; sections 4.30, 6.6, 8.5 |

### 1.6 Method

1. Read `masterplan/01_specs.md` in full (sections 3, 4, 5, 6, 7, 8, 12, 13, 15, 16, 19), the records TD-02, TD-03, TD-04, TD-05, TD-06, TD-12, ADQ-1, ADQ-4, ADQ-10 and the gap register of `research/03_analysis.md`, decisions D1-D13 with F6 and F14, the dataset inventory `research/01b` sections 1.9, 2 and 3, blueprint rows 16 and 23-31 (in the plan: W03, W06 to W11, W16, W17, W19 to W22, W25 and W27) with P15, P16 and P19.
2. Read the exact shapes in code: `packages/shared/src/sim/types.ts:65-69, 168-241, 369-418, 513-517, 663-800, 836-884`; `vocabulary.ts` (all value sets); `domain/enums.ts:14-24, 106, 132-137, 192-205`; `events.ts` (canonical form, chain, identifiers); `dataset.ts:47-232, 427-882`; `initial-state.ts:138-420`; `evidence.ts:40-53, 80-119, 173-179`; `evidence-actions.ts:31-42, 60-75, 156-169, 205-207`; `session-machine.ts:411-422, 501-517, 725-738, 780-875, 990-1037`; `scenarios.ts:195-229`; `api/patterns.ts:11-27`.
3. Checked with read-only greps that every timestamp and byte count the shared code produces is an integer (DA-01) and which key names occur in audit details and event params (section 5.5).
4. Designed each table from its shared type; chose the privilege of the runtime role per table and per column from the operations that write it.
5. Wrote each statement of the audit guard, the privileges and the reset as text for row 28 (W17). Where the specification cannot be stored as written, the point was marked **SPEC-GAP-n** with a default that the schema already supports (section 13.1); D14 has since adopted all seven defaults.
6. **Revision 2.** Read the security design review in full (findings section 4, reasoning 5.1, 5.2 and 5.6, rulings section 6, corrections section 7, residual risks section 8), decisions D14 and D16 and drift record DR-03, and the name table of the plan as written at 04:36. Applied every correction whose owning document is this contract in the section where it belongs, and listed them in the revision history. Each new PostgreSQL behaviour is PG-21 to PG-28 in section 1.9 with the row that proves it. Where a correction contradicted a rule of this contract or another correction, the point was marked as a conflict for the controller, with the default that was written (two points, CONFLICT-1 and CONFLICT-2; section 15.5). Re-ran the cross-check of revision 1 with a script: table sections against the inventory and the privilege matrix, constraint names, granted columns, table shapes, and a search for credential values and dataset person names.
7. **Revision 2.1.** Read the controller's rulings on the two conflicts and decisions D18 and D19. Applied CONFLICT-1 in every section that named the grant (the list is in the revision history), and CONFLICT-2 by moving the superuser trigger check to provisioning as trial step T5-j. Marked both conflicts DECIDED, recorded what the controller accepted (15.6), and ran the script again on the patched text.
8. **Revision 2.2.** Read finding C-07 of the masterplan consistency check, the plan's revision 2 (its pinned names in section 3.4, its work rows W07 and W17, and its blueprint delta in section 21) and decisions D20 and DR-04. Rewrote the sentences that still described the plan's first revision; marked NOTE-4 ACCEPTED. Added the plan's work-row ID beside every citation of a provisional blueprint row, from the mapping of the plan's section 21 only (the table in section 0); where the plan splits a row, the part was chosen from the plan's own description of each work row. The script gained a check that no provisional row is cited without a work-row ID.

### 1.7 Alternatives considered

| Alternative | Why not |
|---|---|
| PostgreSQL `ENUM` types for the value sets | A value can be added but not removed, and a new value cannot be used in the transaction that adds it [PG-14]. `text` with a named CHECK is replaced by one forward migration and round-trips as the plain string the shared types use |
| `timestamptz` columns | Every time in the shared state is epoch milliseconds (`types.ts:65-66`), new API schemas use the same form [SP:API-5], and `at` is part of the hashed audit body (`events.ts:69-84`). One integer type means no conversion on the path that must be byte-exact |
| A database-clock column (`DEFAULT now()`) on each table | One clock is authoritative, the server's [SP:ENG-13; SR-65]; tests drive a manual clock [SP:ENG-16]; per-table checksums must be reproducible (AC-B-04, AC-B-57) |
| `serial` or identity keys | Identifiers are minted by counters in the shared code [R1:97]; where the specification has no identifier a `uuid` default is used, so the carry-over of the reset copies rows without resynchronising a sequence |
| Advisory lock (`pg_advisory_xact_lock`) as the chain serialisation | It is cooperative only and its key is a number outside the schema. The row lock on the chain-head row is taken on the object being protected and is taken again by the guard trigger, so one mechanism both queues writers and refuses a writer that did not queue (section 6.3) |
| `SELECT ... FOR UPDATE` on the chain head issued directly by `dems_app` | A row lock needs UPDATE privilege on the table [PG-04]; the runtime role would then be able to rewrite the head. The lock is taken inside two owner-defined functions instead |
| The database recomputes the hash (store the canonical body as text and CHECK `sha256`) | It duplicates the body and ties a constraint to byte-exact agreement of two JSON encoders. The specification asks the database for continuity of sequence and previous hash [AN:568]; hash correctness is checked by `verifyAuditChain` over the stored rows [SP:§7.13]. Recorded as GD-01; it can be added by a forward migration |
| A lookup table for audit types with a foreign key | Nine types are added by row 26 (W16) and row 20 may ask for more [SP:§19.5 Row 20 #3]; the type and its category are set by the one shared function (`events.ts:124-137`). A format CHECK is kept; membership is the shared code's |
| One `sessions` table for the open session and the finished ones | The shapes differ (`types.ts:369-394` against `397-418`), a cancelled session leaves no record (`session-machine.ts:725-738`), and "one active session per Core" (Q16) becomes a primary-key rule on a single-row table |
| Child tables for the session timeline, notes, pre-check and finalization steps | They are value objects of one session, bounded (`TIMELINE_MAX` 200, `constants.ts:41`), written and read whole, referenced by nothing, and gone with the session |
| The whole hardware snapshot as one JSON value | The four series-carrying slices change every second while the eleven others rarely do [SP:§8.7]. One row with one column per slice lets an UPDATE name only the changed slices [PG-12] |
| Password as one encoded string (PHC form) | Node's `crypto.argon2` returns the raw key and has no encoded-string helper [AN:379]; the decision record stores algorithm, parameters, salt and hash separately [AN:380]; typed columns let a CHECK state the floor |
| Credential hashes as columns of `operators` and `paired_devices` | Allowed by the specification for E-07 [SP:L288]. Separate one-to-one tables mean that a read of the operator or device registry cannot select a hash by accident and that the never-log rule is a list of tables |
| Reset by `DROP DATABASE` first, then create, migrate, seed and re-insert the kept rows from memory | A failure after the drop loses the sessions and the devices, which is exactly the fallback that SA-08 names. Build-then-swap keeps the old database until the new one is complete |
| Reset by `TRUNCATE` or `DELETE` under the owner role | The append-only trigger refuses both for every role; the decision record forbids it [AN:368, AN:524] |
| Cross-database copy with `dblink`, `postgres_fdw` or `pg_dump` | The npm binaries ship no client tool [AN:233], and no source says they ship contrib modules (DA-06). The routine copies through two driver connections |
| Schema per test, transaction rollback per test | Rejected by the decision record [AN:488]; rollback cannot exercise code that commits or uses a second connection [R12:126], which the 50-writer test needs |
| The cluster superuser as the owner of the databases and the role of the reset (revision 1) | Rejected by the review and by D16: a superuser can skip an ordinary trigger by a session setting, both `SECURITY DEFINER` functions would run with superuser rights, and the running server would hold superuser credentials during a reset [RV:SD-01, §5.2 option (c)] |
| A separate short-lived reset process instead of a third role | It cannot be enforced inside one uid, adds a process boundary to the most delicate routine, and alone leaves a superuser in the path. It may be added on top later; it is not required [RV:§5.2 option (b)] |
| The lineage of discarded chains as a JSON line file under `.data/` | Rejected by D16: a table is queryable, covered by the same privileges and trigger as the audit table, and carried over by the routine that discards the chain [RV:SD-19 option (ii)] |
| A PostgreSQL store for the sign-in lockout and the pairing redeem lock | Not required by the review: a lock lasts 60 s and clearing it needs a restart, which needs local access [RV:§1.7, §6 GS-05]. The counters stay memory state (DA-05, AT-6) |
| A family column on `auth_sessions`, so that a reuse ends exactly the sessions one token family issued | The rule of the review is "the open sessions of that device and operator whose method is BIOMETRIC" [RV:SD-10], which existing columns express and which is the wider, safer set |
| Lock only the administrators' rows for the last-administrator rule | The set that must be locked is defined by a join that the change itself alters. Locking every operator row in key order needs no reasoning about a re-evaluated predicate; the table has 3 rows (12 in the fixture) and the change is rare (5.6, AT-C5) |
| An advisory lock for the last-administrator rule or for a redeem | Cooperative only, as for the chain (above). A row lock on the row that changes is taken by the statement that changes it |
| Granting `pg_signal_backend` to `dems_owner` so that the test helper can force-drop a database with an open runtime session | Not granted by default: the helper closes its pools first (TI-10). The review allows the grant as a fallback [RV:§5.2 item 5]; it is used only after the trial shows the need and the controller records it |

### 1.8 Assumptions

Assumptions AS-01 to AS-10 [AN:86-97] and SA-01 to SA-11 [SP:§1.8] stay in force. This file adds:

| ID | Assumption | Effect if wrong | Proven by |
|---|---|---|---|
| DA-01 | Every `at` value, every `*Bytes` value and every counter the shared code produces is a safe integer (`clock.ts:23-31` at speed 1; `generator.ts:165, 196`; `session-machine.ts:411-422`; `dataset.ts:207-209, 441-443`; `evidence.ts:80-82`) | A `bigint` column refuses the value and the commit fails; the column becomes `double precision` by a forward migration | Row 29 (W20; seed), row 37 (W26) |
| DA-02 | A flat `Details` map written to `jsonb` and read back gives the same canonical JSON, so the recomputed hash equals the stored one: numbers are kept as exact decimals [PG-11], key order is irrelevant to `canonicalJSON` (`events.ts:48-50`) | The stored chain cannot be verified; `details` becomes `text` holding the canonical JSON | Row 29 (W20): every seeded row is re-read and re-hashed |
| DA-03 | `drizzle-kit` 0.31.11 emits named CHECK constraints, partial and unique indexes and composite keys from the typed schema, accepts `generate --custom --name`, and applies files in generation order [R7:66-67 describes the release-candidate documentation, G-27] | Row 28 (W17) moves the affected constraint into a hand-written file; the contract's names and definitions do not change | Row 28 (W10, the proof of what `drizzle-kit` emits) |
| DA-04 | `ALTER DATABASE ... RENAME` may run inside a transaction block, so the two renames of the swap are atomic [PG-09] | The renames run one after the other with the recovery rule of R-2 | Row 28 (W17) or row 48 (W29) |
| DA-05 | The pairing redeem lock (3 failures, 60 s) is memory state like the sign-in lockout [SP:§3.2 slice 6; SR-25]; only the attempt count toward closing the code is stored [SP:§8.6] | A lock column is added to `pairing_codes` | Row 36 (W32) |
| DA-06 | The npm PostgreSQL binaries may ship no contrib extension (no source says which they ship). This contract needs none: `gen_random_uuid()` is a core function [PG-13] | None for this contract | Row 23 (W07) trial |
| DA-07 | One server process per database: the main instance on `dems_demo`, each lane on its own database [AN:660] | Two engines would compete for the chain; the guard refuses the second writer's rows (section 6.3) and its commands answer 503 [SP:ENG-5] | Row 31 (W21; T-CH-2) |
| DA-08 | Operator identifiers are stable across a reset: no operation creates or deletes a user [SP:L749], and the seed always writes `OPR-001` to `OPR-003` (`dataset.ts:113-147`) | A carried row would name a missing operator, the carry-over transaction fails and the old database stays (section 8.5) | Row 48 (W29; T-RS-1) |
| DA-09 | Array order can be rebuilt from stored columns: evidence by `recorded_at`, session history by `ended_at` descending (`dataset.ts:866-867`; `session-machine.ts:855`), because one session is active at a time (Q16) | A position column is added by a forward migration | Row 55 (W53; AC-B-04) |
| DA-10 | The size of the hardware snapshot is about 40 to 50 KB and four of its columns change every second (**hypothesis**: computed from 120-point series, `constants.ts:39`; not measured) | Write volume differs from GD-03 | Row 110 (W98) |
| DA-11 | A role that is not a superuser and has `CREATEDB` can do every database-level statement of sections 8 and 10 on databases it owns: create from `template0` with the options of this contract, clone, mark as a template, rename inside a transaction, drop [PG-23] | The trial of row 23 (W07) stops at step T5 (7.1). The remedy is a narrower grant or a changed routine, decided by the controller; the superuser is not brought back into the server or the commands | Row 23 (W07; trial T5-a to T5-h) |
| DA-12 | The maintenance database is `postgres`, created by `initdb` and owned by `dems_admin`. `dems_owner` may connect to it [PG-15], take advisory locks in it and read `pg_database` and `pg_stat_activity` there [PG-27]; it creates nothing in it | The reset and the test helper need a database of their own to issue `CREATE DATABASE` from; provisioning then creates an empty database `dems_maint` owned by `dems_owner` | Row 23 (W07; trial T5-a is issued from `postgres`) |

### 1.9 PostgreSQL behaviours this contract relies on

None of these is stated in the research files. Each is general knowledge of PostgreSQL and a **hypothesis** in the sense of the citation rule until the named test of row 23 (W07) or row 28 (W17), or of row 31 (W21) or row 48 (W29), has run it on 18.4. PG-01 to PG-20 are those of revision 1 (PG-02, PG-04, PG-13 and PG-15 are worded more exactly); PG-21 to PG-28 were added by revision 2 for the corrections of the review.

| ID | Behaviour | Used in | Confirmed by |
|---|---|---|---|
| PG-01 | A table privilege that was not granted makes the statement fail with SQLSTATE `42501`; `TRUNCATE` is its own privilege | 6.2, 7.3 | T-AO-1 |
| PG-02 | A trigger in the default mode fires for the table owner and for a superuser as long as the session's `session_replication_role` is `origin` (the default). Privileges do not bind the owner of a table or a superuser | 6.2 | T-AO-2a |
| PG-03 | `BEFORE UPDATE OR DELETE OR TRUNCATE ... FOR EACH STATEMENT` is a valid trigger and fires even when no row matches | 6.3 | T-AO-2a |
| PG-04 | `SELECT ... FOR UPDATE` needs UPDATE privilege on the table; inside a `SECURITY DEFINER` function the privilege of the function's owner applies, and when that owner is not a superuser the function has no superuser right | 6.3 | T-CH-1, T-PV-1 |
| PG-05 | At READ COMMITTED a `SELECT ... FOR UPDATE` that waited for another transaction returns the row version that transaction committed | 6.3 | T-CH-2 |
| PG-06 | A row lock is held until the transaction ends | 6.3 | T-CH-1 |
| PG-07 | `RAISE EXCEPTION ... USING ERRCODE = 'ZA001'` reports a five-character SQLSTATE chosen by the author | 6.3 | T-CH-2 |
| PG-08 | A unique index with a `WHERE` clause enforces uniqueness among the rows that satisfy it | 4.7, 4.10 | catalog test |
| PG-09 | `CREATE DATABASE` and `DROP DATABASE` cannot run in a transaction block; `ALTER DATABASE ... RENAME` can; none of the three works on a database that has another session | 8.5 | T-RS-1 |
| PG-10 | Privileges on tables and functions are stored in the database and are copied by `CREATE DATABASE ... TEMPLATE`; database-level grants are not [R12:101 states the second half] | 7.2, 10 | T-PV-1 on a clone |
| PG-11 | `jsonb` stores a JSON number as an exact decimal and refuses the character U+0000 in a string | 2.5, 13.1 | DA-02 test |
| PG-12 | An UPDATE that does not assign an out-of-line (TOAST) column does not rewrite its stored value | 4.27 | Row 110 (W98) |
| PG-13 | `gen_random_uuid()` and `sha256(bytea)` are core functions; identifiers are at most 63 bytes; `DROP DATABASE ... WITH (FORCE)` ends the other sessions that the caller may end (PG-26) | 2.3, 10 | Row 23 (W07) trial, row 28 (W17) |
| PG-14 | A value added to an `ENUM` type cannot be removed and cannot be used in the adding transaction | 1.7 | not used |
| PG-15 | A new database lets every role connect, and since version 15 only the database owner may create objects in schema `public`. The owner of a database, superuser or not, may create a schema in it, create objects in `public`, and revoke and grant on `public` | 7.2, 8.3 | T-PV-1; row 28 (W17; the migration set applied as `dems_owner`) |
| PG-16 | With the default logging settings the server log holds the text of a failed statement but not its bind parameters | 5.4 | Row 28 (W17) log check |
| PG-17 | Trigger functions and other functions are executable by every role unless EXECUTE is revoked from `PUBLIC`; a trigger function is not checked for EXECUTE when the trigger fires; a function called by a CHECK constraint is checked for the inserting role | 6.3, 7.2 | T-PV-1 |
| PG-18 | The order in which a multi-row statement visits its rows, and so fires row triggers, is not guaranteed | 6.3, 6.4 | not relied on (AP-4) |
| PG-19 | Utility statements (`CREATE ROLE`, `CREATE DATABASE`, `ALTER DATABASE`) take no bind parameter; a name or a password in them is part of the statement text | 7.1, 8.4 | Row 23 (W07), row 28 (W17) |
| PG-20 | Under locale `C`, case folding and character classes cover ASCII only and text sorts by byte | 2.2 | Row 28 (W17) |
| PG-21 | `ALTER TABLE ... ENABLE ALWAYS TRIGGER <name>` sets `pg_trigger.tgenabled` to `'A'`. Such a trigger fires whatever the session's `session_replication_role` is. A trigger in the default mode (`'O'`) does not fire in a session that set the role to `replica` | 6.2, 6.3, 7.4 | Row 23 (W07) trial T5-j (the superuser case T-AO-2c, a provisioning check); T-AO-2d (catalog, row 28 (W17)) |
| PG-22 | `SET session_replication_role` is refused with SQLSTATE `42501` for a role that is not a superuser and was not granted the right to set that parameter | 6.2 | Row 23 (W07) trial T5-f; T-AO-2b |
| PG-23 | A role with `CREATEDB` that is not a superuser can: create a database from `template0` with `ENCODING` and `LOCALE` options and itself as owner; clone a database it owns; set `IS_TEMPLATE` and `ALLOW_CONNECTIONS` on it; rename it (the owner needs `CREATEDB` for that); drop it. It cannot create a role (`42501`) and cannot rename or drop a database it does not own | 7.1, 8.4, 8.5, 10 | Row 23 (W07) trial T5-a to T5-e, T5-g |
| PG-24 | At READ COMMITTED an `UPDATE ... WHERE <predicate>` that waited for another transaction's change of the same row evaluates its predicate again on the committed row version; when the row no longer matches, the statement changes and returns nothing. A row changed by a statement stays locked until its transaction ends | 5.6 | T-AT-2 to T-AT-4 |
| PG-25 | `SELECT ... FOR UPDATE` is allowed with UPDATE privilege on at least one column of the table: a column-level grant is enough. Without any, it fails with `42501` | 5.6 (AT-C5), 6.5 | T-AT-5; T-CH-3 |
| PG-26 | `DROP DATABASE ... WITH (FORCE)` ends only sessions that the caller could end with `pg_terminate_backend`: those of its own role, or any non-superuser session when the caller is a member of `pg_signal_backend`. If a session would remain, the command fails | 10 (TI-10) | Row 23 (W07) trial T5-h |
| PG-27 | A role without `pg_read_all_stats` still sees, in `pg_stat_activity`, the `datname`, `pid` and `usename` of sessions of other roles; the query text and the client address are hidden | 8.5 (R-1, R-7) | Row 48 (W29; T-RS-1), or row 23 (W07) with T5-h |
| PG-28 | `initdb -A scram-sha-256` writes a `pg_hba.conf` in which every line has the method `scram-sha-256` and no line has `trust`; with that file a connection with a wrong password fails with SQLSTATE `28P01` | 7.6 (HA-1 to HA-4) | Row 23 (W07) trial T3-a, T3-b |

---

## 2. Conventions

### 2.1 Naming

| ID | Rule |
|---|---|
| N-1 | Everything lives in schema `public`. Identifiers are lower-case `snake_case`, at most 63 bytes, never quoted |
| N-2 | Tables are plural nouns (`operators`, `auth_sessions`). A table that holds at most one row is singular (`active_session`, `core_state`) and has the key column `singleton` |
| N-3 | A column that holds a time ends in `_at`. A foreign-key column is `<entity>_id` (with a role prefix where two point at the same table: `issued_by_operator_id`). A boolean has no `is_` prefix (`enabled`, `tampered`) |
| N-4 | Constraint and index names: `<table>_pkey`; `<table>_<columns>_key` (UNIQUE); `<table>_<columns>_fkey`; `<table>_<rule>_check`; `<table>_<columns>_idx`. Row 28 (W17) sets every name explicitly in the typed schema, so the catalog test compares names, not only definitions |
| N-5 | Functions and trigger functions start with the table they guard or with `dems_` |
| N-6 | A column keeps the name of the shared member in `snake_case` (`manifestHash` becomes `manifest_hash`). Departures: `role` is `role_id`; `time` and `update` (slice names) are `time_status` and `software_update`, because both words are SQL keywords |

### 2.2 Types

| ID | Rule | Source |
|---|---|---|
| TY-1 | **Time**: `bigint`, epoch milliseconds on the server clock. Typed schema: `bigint(name, { mode: 'number' })`. No `timestamptz`, no `DEFAULT now()` | `types.ts:65-66`; [SP:API-5; ENG-13] |
| TY-2 | **Identifiers**: `text`, minted by the application with the shared formats; a CHECK states the format. Surrogate keys, where the specification names no identifier, are `uuid DEFAULT gen_random_uuid()` | [R1:97]; `api/patterns.ts:11-27` |
| TY-3 | **Value sets**: `text` with a named CHECK (section 2.4). No `ENUM` type | 1.7 |
| TY-4 | **Integrity hashes that clients see** (audit chain, track, manifest, signature): `text`, 64 lower-case hexadecimal digits, CHECK `HEX64` | `events.ts:58-66`; `evidence.ts:84-86, 114` |
| TY-5 | **Hashes of secrets** (session token, device credential, biometric token, pairing code, password): `bytea`, never rendered as text, never returned | section 5 |
| TY-6 | **Byte counts and durations**: `bigint`. **Counts**: `integer` or `smallint`. **Measured values** (percent, temperature, offset): `double precision`, which round-trips a JavaScript number | DA-01 |
| TY-7 | **Flags**: `boolean NOT NULL` with a default where the shared code has one | |
| TY-8 | **JSON**: `jsonb`, only in the three cases of section 2.5 | |
| TY-9 | Database encoding `UTF8`, locale `C` (the cluster is initialised that way, [AN:296]). Under `C` the functions `lower()` and `upper()` fold ASCII only [PG-20], so no constraint uses them; text is compared and sorted by byte | [AN:296] |

### 2.3 Keys

| ID | Rule |
|---|---|
| K-1 | Every table has a primary key. Natural keys are used where the shared code mints the identifier; composite keys for owned rows (`evidence_tracks`, `evidence_custody`, `role_permissions`) |
| K-2 | Every foreign key is `ON UPDATE NO ACTION ON DELETE RESTRICT`. **Nothing in this schema is deleted by cascade.** The only DELETE the runtime role may issue is on `active_session` |
| K-3 | `session_id`, `evidence_id` and `device_id` of `audit_log` and `events`, and `evidence_id` of `active_session`, are **soft references** (no foreign key): an audit row must be insertable whatever became of the thing it names (a cancelled session leaves no row, `session-machine.ts:725-738`), and `device_id` is the Core's ID, a hardware ID or a registry ID [SP:ENG-12] |
| K-4 | A single-row table has `singleton boolean PRIMARY KEY DEFAULT true` and `CHECK (singleton)` |

### 2.4 Value sets (the text of every CHECK list)

Each list is the closed set of the shared code at the cited lines. A vocabulary test (CL-12) compares the catalog text of each CHECK with the shared constant.

| Name | Values | Source |
|---|---|---|
| `ROLE` | `INVESTIGATOR`, `SUPERVISOR`, `TECHNICIAN` | `vocabulary.ts:16-20` |
| `SEVERITY` | `INFO`, `SUCCESS`, `WARNING`, `CRITICAL` | `vocabulary.ts:160-165` |
| `AUDIT_CATEGORY` | `AUTH`, `SESSION`, `EVIDENCE`, `DEVICE`, `SECURITY`, `STORAGE`, `PAIRING`, `SYSTEM` | `vocabulary.ts:279-288` |
| `EVENT_CATEGORY` | `AUTH`, `SESSION`, `EVIDENCE`, `EXPORT`, `STORAGE`, `TIME`, `NETWORK`, `DEVICE`, `SECURITY`, `SYSTEM` | `vocabulary.ts:473-484` |
| `SESSION_STATE` | `CREATE`, `PRECHECK`, `ARMED`, `RECORDING`, `STOPPING`, `FINALIZING`, `SEALED`, `FAULT`, `RECOVERY` | `domain/enums.ts:14-24` |
| `SESSION_OUTCOME` | `SEALED`, `INCOMPLETE` | `vocabulary.ts:79` |
| `SUBJECT_TYPE` | `TERSANGKA`, `SAKSI`, `LAINNYA` | `vocabulary.ts:55-59` |
| `PROFILE` | `STANDARD_1080P25` | `vocabulary.ts:74` |
| `TIME_SOURCE` | `GNSS`, `NTP`, `RTC` | `domain/enums.ts:106` |
| `TRACK_ID` | `VIDEO-01`, `VIDEO-02`, `AUDIO-01`, `AUDIO-02` | `domain/enums.ts:132-137` |
| `VIDEO_TRACK_ID` | `VIDEO-01`, `VIDEO-02` | `domain/enums.ts:139` |
| `FAULT_KIND` | `CAMERA_LOSS`, `MIC_NO_SIGNAL`, `MIC_CLIP`, `STORAGE_LOW`, `STORAGE_FULL`, `GNSS_LOSS`, `TAMPER`, `FAN_STALL`, `POWER_FAIL`, `TPM_FAILURE`, `SECURITY_FAULT`, `AUDIT_TAMPER` | `vocabulary.ts:188-201` |
| `EVIDENCE_STATUS` | `RECORDED`, `SEALED`, `EXPORTED`, `UNDER_REVIEW`, `ARCHIVED` | `vocabulary.ts:140-146` |
| `LIFECYCLE_STAGE` | `CAPTURE`, `RECORDING`, `FINALIZING`, `HASH`, `MANIFEST`, `ENCRYPT`, `SIGN`, `SEALED_LOCAL_EVIDENCE`, `AUTHORIZED_REVIEW`, `AUTHORIZED_EXPORT_TRANSFER`, `DESTINATION_VERIFICATION`, `RETENTION_ARCHIVE_DISPOSITION` | `domain/enums.ts:192-205` |
| `VERIFICATION` | `NOT_RUN`, `PASS`, `FAIL` | `vocabulary.ts:156` |
| `INTEGRITY_SOURCE` | `DEMO_PACKAGE`, `SIMULATED` | `vocabulary.ts:570` |
| `RETENTION` | `DAYS_30`, `DAYS_90`, `YEAR_1`, `CASE_CLOSURE` | `vocabulary.ts:270-275` |
| `SCENARIO` | `idle`, `recording`, `finalizing`, `fault-demo` | `vocabulary.ts:227-232` |
| `STORAGE_STATE` | `READY`, `LOW`, `FULL` | `domain/enums.ts:91` |
| `SECURITY_STATE` | `READY`, `FAULT` | `domain/enums.ts:124` |
| `AUTH_METHOD` | `PASSWORD`, `BIOMETRIC` (the shared set also has `SECURITY_KEY`, `vocabulary.ts:36-40`; no Live session can have it, [SP:§7.17 X-1]) | [SP:§5.5] |
| `SESSION_END_REASON` | `SIGNED_OUT`, `IDLE_EXPIRED`, `ABSOLUTE_EXPIRED`, `ROTATED`, `USER_DISABLED`, `DEVICE_REVOKED`, `DEVICE_UNPAIRED`, `TOKEN_REUSE` (8 values) | [SP:§5.4]; `TOKEN_REUSE` added by [RV:SD-10] and [DEC:D16] **before the first migration**: the set is a closed CHECK, so a later addition would need a migration (MG-11). The same value is added to `session.ended.reason` by the specification |
| `DEVICE_STATE` | `PAIRED`, `REVOKED`, `UNPAIRED` | [SP:§6.3] |
| `CODE_STATE` | `ACTIVE`, `REDEEMED`, `CANCELLED`, `EXPIRED`, `EXHAUSTED` | [SP:§6.2] |
| `BIO_REVOKE_REASON` | `DISABLED`, `REENROLLED`, `TOKEN_REUSE`, `DEVICE_REVOKED`, `DEVICE_UNPAIRED`, `USER_DISABLED` | [SP:§5.6 steps 6, 8]; `REENROLLED` is chosen here |
| `EXPORT_SCOPE` | `EVIDENCE`, `AUDIT`, `LOGS` | [SP:L298] |
| `SNAPSHOT_CAUSE` | `INTERVAL`, `FAULT_RAISED`, `FAULT_CLEARED` | [SP:L306] |
| `CHAIN_DISCARD_REASON` | `RESET` (operation `resetDemo`, or `db:reset` without a scenario), `SCENARIO_LOAD` (operation `loadScenario`, or `db:reset --scenario <name>`) | The `reason` of `AuditChainLineageEntry` in the revised specification [SP:§7.18; E-26]. A reset from the command line is told apart by its missing actor, not by a third value [SP:DC-9] |

Format rules used by name in section 4:

| Name | Expression |
|---|---|
| `HEX64(c)` | `c ~ '^[0-9a-f]{64}$'` |
| `CODE(c)` | `c ~ '^[A-Z][A-Z0-9_]{0,63}$'` (an open set of SCREAMING_SNAKE_CASE values: audit type, event type, permission, custody action) |
| `FLAT(c)` | `public.dems_jsonb_is_flat(c)`: `c` is a JSON object whose values are strings, numbers, booleans or null (`types.ts:68-69`). Function text in section 8.3 |
| `NO_SECRET_KEYS(c)` | `NOT (c ?\| ARRAY['password','passwordHash','salt','token','tokenHash','sessionToken','deviceCredential','credential','credentialHash','biometricToken','code','codeHash','pairingCode','qrPayload','username','cookie','authorization'])`, where `?\|` is the jsonb operator "has any of these keys" (section 5.5) |
| `SESSION_ID(c)` | `c ~ '^SES-[0-9]{8}-[0-9]{4}$'` (`api/patterns.ts:11`) |
| `EVIDENCE_ID(c)` | `c ~ '^EV-[0-9]{8}-[0-9]{4}$'` (`api/patterns.ts:14`) |
| `OPERATOR_ID(c)` | `c ~ '^OPR-[0-9]{3}$'` (`api/patterns.ts:17`) |
| `EXPORT_ID(c)` | `c ~ '^EXP-[0-9]{6}$'` (`api/patterns.ts:20`) |
| `CASE_NUMBER(c)` | `c ~ '^LP/[0-9]{4}/[0-9]{4}-[0-9]{4}$'` (`api/patterns.ts:27`; the calendar part is validated by the contract schema) |

### 2.5 JSON columns

`jsonb` is allowed in exactly three cases. Every other attribute is a typed column.

| Case | Columns | Why not columns or a child table |
|---|---|---|
| J-1 Flat detail maps | `audit_log.details`, `events.params`, `alerts.params` | The shared type is an open map of flat values (`types.ts:68-69`) whose keys differ per type; `FLAT` and `NO_SECRET_KEYS` constrain it |
| J-2 Bounded value objects owned by one row | `active_session.precheck`, `.finalization`, `.timeline`, `.notes`, `.fault`, `.recovery`; `evidence_items.markers`, `.notes` | Written and read whole with the owner, never queried by member, referenced by nothing, bounded (8 checks, 6 steps, 200 timeline items) |
| J-3 Simulated-hardware slices | The 14 slice columns of `hardware_snapshot` | Fixed by the persistence decision [DEC:D11 ADQ-4]; engine-held state that no query reads |

Rule J-4: an absent value object is SQL `NULL`, never the JSON literal `null`; a CHECK on `jsonb_typeof` enforces it.

### 2.6 Slice-to-table mapping rules (for rows 29 (W20) and 37 (W26))

| ID | Rule |
|---|---|
| MR-1 | **One mapping module** writes a `SimState` slice to its tables and reads it back. The seed, the reset and the engine's write-through [SP:ENG-4] all call it; no second mapping exists |
| MR-2 | An optional member that is absent is stored as `NULL` and rehydrated as `null`. The shared code reads these members with `?? null` (`session-machine.ts:804-805`) |
| MR-3 | Row order of an array is rebuilt by `ORDER BY`: operators by `id`; `sessionHistory` by `ended_at DESC, id DESC`; `evidence` by `recorded_at, id`; tracks by `position`; custody by `seq`; alerts by `at, id` (DA-09) |
| MR-4 | The audit ring at start is the newest 1,000 rows by `seq`; `total` and `head` are the two columns of `audit_chain_head`; `dropped = total - rows kept` (`types.ts:791-800`; [SP:§8.6]). The event ring is the newest 500 rows by `seq`; the alert ring the newest 100 by `at, id` (`constants.ts:35-38`) |
| MR-5 | `SessionHistoryEntry.evidenceId` is not a column: it is the `id` of the `evidence_items` row whose `session_id` is the entry's `id`, or null. Both rows are created in one engine step (`session-machine.ts:849-856, 1029-1036`) |
| MR-6 | Within one transaction parents are written before children: `session_history` before `evidence_items` before `evidence_tracks` and `evidence_custody` before `exports` |
| MR-7 | Only rows with `seq` above the stored head are inserted into `audit_log` [SP:ENG-10]. A ring row altered by the `AUDIT_TAMPER` demo fault is never written; the runtime role could not write it anyway (section 6.2) |
| MR-8 | An UPDATE names only the columns that changed and only columns the runtime role may update (section 7.3). The typed schema declares no automatic `updated_at` hook on a table where that column is not granted |
| MR-9 | Before any value reaches a bigint column the mapping asserts `Number.isSafeInteger` (DA-01) |

---

## 3. Entity-to-table map

### 3.1 The 26 stored entities

Every entity of [SP:§3.3] has a table: E-01 to E-25 of the specification's first revision, and E-26, the chain lineage, which its second revision added under D16. "Kept" = carried across a reset (section 8.5).

| Entity | Table(s) | Section | Kept across a reset |
|---|---|---|---|
| E-01 Operator | `operators` (identity, role, enabled) and `operator_credentials` (the hash set of SR-06) | 4.4, 4.5 | no (rebuilt) |
| E-02 Role | `roles` | 4.1 | no (identical) |
| E-03 Permission | `permissions` | 4.2 | no (identical) |
| E-04 Role-permission grant | `role_permissions` | 4.3 | no (identical) |
| E-05 Auth session | `auth_sessions` | 4.6 | **yes** |
| E-06 Paired device | `paired_devices` | 4.8 | **yes** |
| E-07 Device credential | `device_credentials` | 4.9 | **yes** |
| E-08 Pairing code | `pairing_codes` | 4.7 | **yes** (SPEC-GAP-2 and SPEC-GAP-3, decided by D14) |
| E-09 Biometric token | `biometric_tokens` | 4.10 | **yes** |
| E-10 Audit row | `audit_log`, with `audit_chain_head` | 4.12, 4.13 | no (new chain) |
| E-11 Operational event | `events` | 4.14 | no |
| E-12 Active session | `active_session` | 4.15 | no |
| E-13 Session history entry | `session_history` | 4.16 | no |
| E-14 Evidence item | `evidence_items` | 4.17 | no |
| E-15 Evidence track | `evidence_tracks` | 4.18 | no |
| E-16 Custody entry | `evidence_custody` | 4.19 | no |
| E-17 Export record | `exports` | 4.20 | no |
| E-18 Alert | `alerts` | 4.21 | no |
| E-19 Storage policy | `storage_policy` | 4.22 | no |
| E-20 Console settings | `console_settings` | 4.23 | **yes** |
| E-21 Counters | `engine_counters` (the `meta.counters` of `types.ts:168-185`) and `registry_counters` (device, pairing code) | 4.24, 4.11 | engine: no; registry: **yes** (SPEC-GAP-2, decided) |
| E-22 Core device record | `core_device` | 4.25 | no |
| E-23 Core state record | `core_state` | 4.26 | no; `epoch` continues (SPEC-GAP-5, decided) |
| E-24 Hardware snapshot row | `hardware_snapshot` | 4.27 | no |
| E-25 Health snapshot | `health_snapshots` | 4.28 | no (content: SPEC-GAP-4, decided) |
| E-26 Audit chain lineage (added by revision 2 of the specification; [RV:SD-19]; [DEC:D16]) | `audit_chain_history` | 4.30 | **yes, always**: every reset carries the rows over and appends one |
| (contract) Schema version | `schema_meta` | 4.29 | set by the migrations |

Count: 23 entities have one table each (23); E-01 and E-21 have two each (4); E-10 has `audit_log` and the mechanism table `audit_chain_head` (2). That is 29 tables for the 26 entities, and `schema_meta` makes 30. (Revision 1 had 29 tables for 25 entities and described them as "three entities split in two"; the count was right, the description was not: `paired_devices` and `device_credentials` are the tables of two entities, E-06 and E-07.)

### 3.2 The 33 slices against the tables

| Class [SP:§3.1] | Slices | Stored in |
|---|---|---|
| Stored (15) | `meta`, `device`, `operators`, `auth`, `pairing`, `session`, `lastSealedSessionId`, `lastSealedAcknowledged`, `sessionHistory`, `storagePolicy`, `evidence`, `events`, `alerts`, `audit`, `settings` | The tables of 3.1 (`auth` is `auth_sessions`; `pairing` is the four pairing tables) |
| Snapshot (15) | `tabletLink`, `activeCameraId`, `cameras`, `mics`, `storage`, `time`, `network`, `security`, `services`, `health`, `otherDevices`, `ports`, `faults`, `diagnostics`, `update` | One column each of `hardware_snapshot`; `storage` and `activeCameraId` are included as [SP:L274] asks |
| Never stored (3) | `clock`, `authLockout`, `audio` | Nothing [SP:L308] |

15 + 15 + 3 = 33 (`types.ts:849-884`).

### 3.3 Table inventory (30)

| # | Table | Rows | Runtime role may | Append-only for the runtime role |
|--:|---|---|---|---|
| T-01 | `roles` | 3 | read | read-only |
| T-02 | `permissions` | 12 | read | read-only |
| T-03 | `role_permissions` | 18 | read | read-only |
| T-04 | `operators` | 3 | read; update 5 columns | — |
| T-05 | `operator_credentials` | 3 | read; update (re-hash) | — |
| T-06 | `auth_sessions` | grows | read, insert; update 3 columns | — |
| T-07 | `pairing_codes` | grows | read, insert; update 4 columns | — |
| T-08 | `paired_devices` | grows | read, insert; update 7 columns | — |
| T-09 | `device_credentials` | one per device | read, insert; update 3 columns | — |
| T-10 | `biometric_tokens` | grows | read, insert; update 3 columns | — |
| T-11 | `registry_counters` | 2 | read; update 1 column | — |
| T-12 | `audit_log` | grows | read, insert | **yes, and by trigger for every role** |
| T-13 | `audit_chain_head` | 1 | read | written only by the guard trigger |
| T-14 | `events` | grows | read, insert | yes |
| T-15 | `active_session` | 0 or 1 | read, insert, update, delete | — |
| T-16 | `session_history` | grows | read, insert | yes |
| T-17 | `evidence_items` | grows | read, insert; update 7 columns | sealed columns: yes |
| T-18 | `evidence_tracks` | 4 per item | read, insert | yes |
| T-19 | `evidence_custody` | grows | read, insert | yes |
| T-20 | `exports` | grows | read, insert | yes |
| T-21 | `alerts` | grows | read, insert; update 3 columns | — |
| T-22 | `storage_policy` | 1 | read; update | — |
| T-23 | `console_settings` | 1 | read; update | — |
| T-24 | `engine_counters` | 5 or 6 | read, insert; update 1 column | — |
| T-25 | `core_device` | 1 | read; update 3 columns | — |
| T-26 | `core_state` | 1 | read; update 4 columns | — |
| T-27 | `hardware_snapshot` | 1 | read; update | — |
| T-28 | `health_snapshots` | grows | read, insert | yes |
| T-29 | `schema_meta` | 1 | read | read-only |
| T-30 | `audit_chain_history` | one per reset; 0 after a first seed | read | read-only for the runtime role; **append-only by trigger for every role**, the owner included |

The Drizzle migrator adds its own bookkeeping table (`__drizzle_migrations` in schema `drizzle`, [R7:67]); the runtime role has no privilege on it and never reads it (B-3 uses `schema_meta`).

---

## 4. Tables

Column tables read: name, PostgreSQL type, nullability, default, rule. "Keys, constraints, indexes" lists every PRIMARY KEY, FOREIGN KEY, UNIQUE and CHECK by name, and every index with its reason. Value-set and format names are those of section 2.4. All foreign keys are `ON DELETE RESTRICT` (K-2).

### 4.1 T-01 `roles` (E-02)

Written by the seed only. Source: `vocabulary.ts:16-21`.

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `text` | NOT NULL | — | One of `ROLE` |
| `sort_order` | `smallint` | NOT NULL | — | Position in the vocabulary (1 to 3) |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `roles_pkey` | PRIMARY KEY | `(id)` | Target of the foreign keys of `operators` and `role_permissions` |
| `roles_id_check` | CHECK | `id IN (ROLE)` | |
| `roles_sort_order_key` | UNIQUE | `(sort_order)` | The matrix of `getRoleMatrix` has one stable column order |

### 4.2 T-02 `permissions` (E-03)

Written by the seed only. 12 rows [SP:§4.3].

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `text` | NOT NULL | — | `CODE(id)` |
| `sort_order` | `smallint` | NOT NULL | — | Position in the list of [SP:§4.3] (1 to 12) |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `permissions_pkey` | PRIMARY KEY | `(id)` | Target of the foreign key of `role_permissions` |
| `permissions_id_check` | CHECK | `CODE(id)` | |
| `permissions_sort_order_key` | UNIQUE | `(sort_order)` | Stable row order of the matrix |

### 4.3 T-03 `role_permissions` (E-04)

Written by the seed only; read-only for the runtime role, which makes "the matrix cannot be changed through the API" [SP:RB-9] a database rule. 18 rows [SP:§4.4].

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `role_id` | `text` | NOT NULL | — | |
| `permission_id` | `text` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `role_permissions_pkey` | PRIMARY KEY | `(role_id, permission_id)` | The per-request check "does this role hold this permission" [SP:RB-3] is one probe of this index |
| `role_permissions_role_id_fkey` | FOREIGN KEY | `(role_id) REFERENCES roles (id)` | |
| `role_permissions_permission_id_fkey` | FOREIGN KEY | `(permission_id) REFERENCES permissions (id)` | |
| `role_permissions_permission_id_idx` | INDEX | `(permission_id)` | Holders of one permission: the last-administrator rule [SP:RB-8] and the membership of the `admin` topic [SP:§9.2] |

### 4.4 T-04 `operators` (E-01)

Rows are written by the seed and the reset. The runtime role has no INSERT and no DELETE here: no operation creates or deletes a user [SP:L749]. Source: `types.ts:231-241`; [SP:L282].

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `text` | NOT NULL | — | `OPERATOR_ID(id)` |
| `username` | `text` | NOT NULL | — | Stored trimmed and lower-case (`auth.ts:102-109`): `username ~ '^[a-z0-9][a-z0-9._-]{0,63}$'` |
| `rank` | `text` | NULL | — | |
| `name` | `text` | NOT NULL | — | 1 to 120 characters |
| `display_name` | `text` | NOT NULL | — | |
| `initials` | `text` | NOT NULL | — | 1 to 4 characters |
| `role_id` | `text` | NOT NULL | — | The one role of the operator [SP:L314] |
| `enabled` | `boolean` | NOT NULL | `true` | |
| `last_sign_in_at` | `bigint` | NULL | — | |
| `role_changed_at` | `bigint` | NULL | — | |
| `created_at` | `bigint` | NOT NULL | — | Seed time |
| `updated_at` | `bigint` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `operators_pkey` | PRIMARY KEY | `(id)` | Principal lookup on every authenticated request; foreign-key target |
| `operators_username_key` | UNIQUE | `(username)` | Sign-in looks the operator up by username [SP:ID-2] |
| `operators_role_id_fkey` | FOREIGN KEY | `(role_id) REFERENCES roles (id)` | |
| `operators_role_id_idx` | INDEX | `(role_id)` | Enabled operators of the roles that hold `USER_ADMIN` [SP:RB-8] |
| `operators_id_check` | CHECK | `OPERATOR_ID(id)` | |
| `operators_username_check` | CHECK | as above | |
| `operators_name_check` | CHECK | `char_length(name) BETWEEN 1 AND 120 AND char_length(initials) BETWEEN 1 AND 4` | |

### 4.5 T-05 `operator_credentials` (E-01, the hash set of SR-06)

One row per operator. Written by the seed; the runtime role updates it only to re-hash with newer parameters at a successful sign-in [SP:SR-06]. **No column of this table may be logged or returned.**

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `operator_id` | `text` | NOT NULL | — | |
| `algorithm` | `text` | NOT NULL | — | `argon2id` |
| `memory_kib` | `integer` | NOT NULL | — | At least 19,456 [SP:SR-05] |
| `passes` | `integer` | NOT NULL | — | At least 2 |
| `parallelism` | `integer` | NOT NULL | — | At least 1 |
| `salt` | `bytea` | NOT NULL | — | At least 16 bytes, random per password |
| `hash` | `bytea` | NOT NULL | — | Exactly 32 bytes |
| `hashed_at` | `bigint` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `operator_credentials_pkey` | PRIMARY KEY | `(operator_id)` | One hash set per operator; read at sign-in by the operator's ID |
| `operator_credentials_operator_id_fkey` | FOREIGN KEY | `(operator_id) REFERENCES operators (id)` | |
| `operator_credentials_algorithm_check` | CHECK | `algorithm = 'argon2id'` | |
| `operator_credentials_params_check` | CHECK | `memory_kib >= 19456 AND passes >= 2 AND parallelism >= 1` | |
| `operator_credentials_lengths_check` | CHECK | `octet_length(salt) >= 16 AND octet_length(hash) = 32` | |

### 4.6 T-06 `auth_sessions` (E-05)

One row per sign-in; an ended session stays as a row with its reason [SP:L497]. Written by the identity module. **The table has no role, no permission and no token column** [SP:SR-13, SR-09]. `device_id` also states the transport of the session: a row without a device is a web session and is resolved only from the cookie; a row with a device is resolved only from a bearer value (5.2, [RV:SD-09]). A session is ended by one compare-and-set statement (5.6, AT-3).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Internal reference; safe to log; the connection registry keys on it |
| `token_hash` | `bytea` | NOT NULL | — | SHA-256 of the presented value, 32 bytes (section 5.1) |
| `operator_id` | `text` | NOT NULL | — | |
| `device_id` | `text` | NULL | — | NULL for a web session [SP:§4.1] |
| `method` | `text` | NOT NULL | — | One of `AUTH_METHOD` |
| `issued_at` | `bigint` | NOT NULL | — | |
| `last_seen_at` | `bigint` | NOT NULL | — | Last activity [SP:ID-P9]; the idle limit is computed from it, not stored |
| `absolute_expires_at` | `bigint` | NOT NULL | — | `issued_at` plus 8 hours at issue [SP:ID-P5]; stored, so a later policy change does not move it |
| `ended_at` | `bigint` | NULL | — | |
| `end_reason` | `text` | NULL | — | One of `SESSION_END_REASON`. `TOKEN_REUSE` only on a session whose `method` is `BIOMETRIC` [RV:SD-10] |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `auth_sessions_pkey` | PRIMARY KEY | `(id)` | Update of one session (touch, end) |
| `auth_sessions_token_hash_key` | UNIQUE | `(token_hash)` | The lookup of every authenticated request and socket upgrade |
| `auth_sessions_operator_id_fkey` | FOREIGN KEY | `(operator_id) REFERENCES operators (id)` | |
| `auth_sessions_device_id_fkey` | FOREIGN KEY | `(device_id) REFERENCES paired_devices (id)` | |
| `auth_sessions_active_operator_idx` | INDEX | `(operator_id) WHERE ended_at IS NULL` | End every session of an operator (`disableUser`), count `activeSessions`, find the sockets of a role change [SP:§4.7] |
| `auth_sessions_active_device_idx` | INDEX | `(device_id) WHERE ended_at IS NULL AND device_id IS NOT NULL` | End the sessions of a revoked or unpaired device; end the open biometric sessions of one device and operator after a token reuse (5.6, AT-C4); `signedInOperatorId` of the registry [SP:§6.5] |
| `auth_sessions_active_last_seen_idx` | INDEX | `(last_seen_at) WHERE ended_at IS NULL` | The expiry sweep every 5 s [SP:ID-P8] reads only open sessions, whatever the history size |
| `auth_sessions_token_hash_check` | CHECK | `octet_length(token_hash) = 32` | |
| `auth_sessions_method_check` | CHECK | `method IN (AUTH_METHOD)` | |
| `auth_sessions_biometric_device_check` | CHECK | `method <> 'BIOMETRIC' OR device_id IS NOT NULL` | |
| `auth_sessions_times_check` | CHECK | `last_seen_at >= issued_at AND absolute_expires_at > issued_at AND (ended_at IS NULL OR ended_at >= issued_at)` | |
| `auth_sessions_end_check` | CHECK | `(ended_at IS NULL) = (end_reason IS NULL)` | |
| `auth_sessions_end_reason_check` | CHECK | `end_reason IS NULL OR end_reason IN (SESSION_END_REASON)` | |
| `auth_sessions_token_reuse_check` | CHECK | `end_reason IS DISTINCT FROM 'TOKEN_REUSE' OR method = 'BIOMETRIC'` | |

### 4.7 T-07 `pairing_codes` (E-08)

One row per issued code [SP:§6.2]. The code itself is never stored. A redeem attempt first takes one attempt from `failed_attempts` with a single UPDATE and only then compares the presented digits; a successful redeem gives that attempt back in the statement that sets `REDEEMED` (5.6, AT-C2 and AT-C3). The column therefore still means "failed redeems so far" in every committed row.

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `text` | NOT NULL | — | `PCD-NNNNNN` from `registry_counters` (format chosen here): `id ~ '^PCD-[0-9]{6,}$'` |
| `code_hash` | `bytea` | NOT NULL | — | 32 bytes (section 5.1) |
| `state` | `text` | NOT NULL | — | One of `CODE_STATE` |
| `issued_by_operator_id` | `text` | NOT NULL | — | |
| `issued_at` | `bigint` | NOT NULL | — | |
| `expires_at` | `bigint` | NOT NULL | — | `issued_at` plus 300 s at issue [SP:PR-P2] |
| `failed_attempts` | `smallint` | NOT NULL | `0` | 0 to 5 [SP:PR-P5] |
| `closed_at` | `bigint` | NULL | — | Time of redeem, cancel, expiry or exhaustion |
| `closed_by_operator_id` | `text` | NULL | — | The cancelling operator; NULL otherwise |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `pairing_codes_pkey` | PRIMARY KEY | `(id)` | Foreign-key target of `paired_devices` |
| `pairing_codes_one_active_key` | UNIQUE INDEX | `(state) WHERE state = 'ACTIVE'` | "One active code at a time" [SP:PR-P3] as a database rule; also the lookup of the active code by redeem, status and sweeper |
| `pairing_codes_issued_by_operator_id_fkey` | FOREIGN KEY | `(issued_by_operator_id) REFERENCES operators (id)` | |
| `pairing_codes_closed_by_operator_id_fkey` | FOREIGN KEY | `(closed_by_operator_id) REFERENCES operators (id)` | |
| `pairing_codes_id_check` | CHECK | as above | |
| `pairing_codes_code_hash_check` | CHECK | `octet_length(code_hash) = 32` | |
| `pairing_codes_state_check` | CHECK | `state IN (CODE_STATE)` | |
| `pairing_codes_times_check` | CHECK | `expires_at > issued_at AND (closed_at IS NULL OR closed_at >= issued_at)` | |
| `pairing_codes_attempts_check` | CHECK | `failed_attempts BETWEEN 0 AND 5` | |
| `pairing_codes_closed_check` | CHECK | `(state = 'ACTIVE') = (closed_at IS NULL) AND (closed_by_operator_id IS NULL OR state = 'CANCELLED')` | |

No index on `code_hash`: a code is never looked up by its hash (section 5.2).

### 4.8 T-08 `paired_devices` (E-06)

One row per successful redeem; REVOKED and UNPAIRED are final and pairing again creates a new row [SP:L569]. Fields: [SP:§6.5]. `online`, `signedInOperatorId` and `codeIssuedBy` are not columns: the first comes from the connection registry, the second from `auth_sessions`, the third from `pairing_codes`.

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `text` | NOT NULL | — | `DEV-NNNN` [SP:PR-P9]: `id ~ '^DEV-[0-9]{4,}$'` |
| `name` | `text` | NOT NULL | — | 1 to 60 characters [SP:L589] |
| `platform` | `text` | NOT NULL | — | 1 to 32 characters |
| `app_version` | `text` | NOT NULL | — | 1 to 32 characters |
| `state` | `text` | NOT NULL | — | One of `DEVICE_STATE` |
| `paired_at` | `bigint` | NOT NULL | — | |
| `paired_with_code_id` | `text` | NOT NULL | — | |
| `last_seen_at` | `bigint` | NOT NULL | — | Starts as `paired_at`; written at most once a minute [SP:L592] |
| `revoked_at` | `bigint` | NULL | — | |
| `revoked_by_operator_id` | `text` | NULL | — | |
| `revoke_reason` | `text` | NULL | — | 5 to 500 characters [SP:L566] |
| `unpaired_at` | `bigint` | NULL | — | |
| `updated_at` | `bigint` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `paired_devices_pkey` | PRIMARY KEY | `(id)` | Device lookup of `revokeDevice`; foreign-key target |
| `paired_devices_paired_with_code_id_key` | UNIQUE | `(paired_with_code_id)` | A code pairs at most one device (single use, [SP:PR-P3]) |
| `paired_devices_paired_with_code_id_fkey` | FOREIGN KEY | `(paired_with_code_id) REFERENCES pairing_codes (id)` | |
| `paired_devices_revoked_by_operator_id_fkey` | FOREIGN KEY | `(revoked_by_operator_id) REFERENCES operators (id)` | |
| `paired_devices_id_check` | CHECK | as above | |
| `paired_devices_text_check` | CHECK | `char_length(name) BETWEEN 1 AND 60 AND char_length(platform) BETWEEN 1 AND 32 AND char_length(app_version) BETWEEN 1 AND 32` | |
| `paired_devices_state_check` | CHECK | `state IN (DEVICE_STATE)` | |
| `paired_devices_lifecycle_check` | CHECK | `(state = 'PAIRED' AND revoked_at IS NULL AND revoked_by_operator_id IS NULL AND revoke_reason IS NULL AND unpaired_at IS NULL) OR (state = 'REVOKED' AND revoked_at IS NOT NULL AND revoked_by_operator_id IS NOT NULL AND char_length(revoke_reason) BETWEEN 5 AND 500 AND unpaired_at IS NULL) OR (state = 'UNPAIRED' AND unpaired_at IS NOT NULL AND revoked_at IS NULL AND revoked_by_operator_id IS NULL AND revoke_reason IS NULL)` | |

No further index: the registry is listed whole (operation 19 has no paging, [SP:L759]) and grows only by pairing.

### 4.9 T-09 `device_credentials` (E-07)

One row per device, created with it. The row stays after REVOKED and UNPAIRED, so that a retired credential is still recognised and answered 403 `DEVICE_REVOKED` rather than 401 [SP:§6.6]. **No column may be logged or returned.**

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `device_id` | `text` | NOT NULL | — | |
| `current_hash` | `bytea` | NOT NULL | — | 32 bytes |
| `next_hash` | `bytea` | NULL | — | 32 bytes; set by `rotateDeviceCredential`, promoted to `current_hash` at its first use [SP:§6.3 T7] |
| `rotated_at` | `bigint` | NULL | — | Time of the last rotate call (`credentialRotatedAt`) |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `device_credentials_pkey` | PRIMARY KEY | `(device_id)` | One credential row per device |
| `device_credentials_device_id_fkey` | FOREIGN KEY | `(device_id) REFERENCES paired_devices (id)` | |
| `device_credentials_current_hash_key` | UNIQUE | `(current_hash)` | Lookup of a presented `dvc_` value |
| `device_credentials_next_hash_key` | UNIQUE | `(next_hash)` | Lookup of a presented value that is the not-yet-promoted one |
| `device_credentials_lengths_check` | CHECK | `octet_length(current_hash) = 32 AND (next_hash IS NULL OR (octet_length(next_hash) = 32 AND next_hash <> current_hash))` | |

### 4.10 T-10 `biometric_tokens` (E-09)

One row per issued token; a use marks the row and inserts the next row of the same family [SP:§5.6]. The use is one compare-and-set UPDATE on `used_at` whose row count decides which request owns the token; a presentation of a used token revokes the family and ends the open biometric sessions of that device and operator (5.6, AT-C4; [RV:SD-04, SD-10]).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Internal reference; safe to log |
| `token_hash` | `bytea` | NOT NULL | — | 32 bytes |
| `family_id` | `uuid` | NOT NULL | — | One per enrolment; minted by the server at `setBiometricEnrollment` |
| `device_id` | `text` | NOT NULL | — | |
| `operator_id` | `text` | NOT NULL | — | |
| `issued_at` | `bigint` | NOT NULL | — | |
| `expires_at` | `bigint` | NOT NULL | — | `issued_at` plus 30 days at issue [SP:ID-P11] |
| `used_at` | `bigint` | NULL | — | |
| `revoked_at` | `bigint` | NULL | — | |
| `revoke_reason` | `text` | NULL | — | One of `BIO_REVOKE_REASON` |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `biometric_tokens_pkey` | PRIMARY KEY | `(id)` | |
| `biometric_tokens_token_hash_key` | UNIQUE | `(token_hash)` | Lookup of the value sent by `signInWithBiometric`; a used token is still found, which is how reuse is detected [SP:§5.6 step 6] |
| `biometric_tokens_one_live_key` | UNIQUE INDEX | `(device_id, operator_id) WHERE used_at IS NULL AND revoked_at IS NULL` | At most one usable token per device and operator; also the lookup for revocation by device |
| `biometric_tokens_family_id_idx` | INDEX | `(family_id)` | Revoke a whole family |
| `biometric_tokens_live_operator_idx` | INDEX | `(operator_id) WHERE used_at IS NULL AND revoked_at IS NULL` | Revoke the live tokens of a disabled operator |
| `biometric_tokens_device_id_fkey` | FOREIGN KEY | `(device_id) REFERENCES paired_devices (id)` | |
| `biometric_tokens_operator_id_fkey` | FOREIGN KEY | `(operator_id) REFERENCES operators (id)` | |
| `biometric_tokens_token_hash_check` | CHECK | `octet_length(token_hash) = 32` | |
| `biometric_tokens_times_check` | CHECK | `expires_at > issued_at AND (used_at IS NULL OR used_at >= issued_at)` | |
| `biometric_tokens_revoke_check` | CHECK | `(revoked_at IS NULL) = (revoke_reason IS NULL) AND (revoke_reason IS NULL OR revoke_reason IN (BIO_REVOKE_REASON))` | |

### 4.11 T-11 `registry_counters` (E-21, server-native part)

Two rows, seeded with value 1. Kept across a reset, so a device or code identifier is never minted twice (SPEC-GAP-2, decided by D14).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `name` | `text` | NOT NULL | — | `device` or `pairingCode` |
| `next_value` | `bigint` | NOT NULL | — | At least 1; the number the next identifier takes |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `registry_counters_pkey` | PRIMARY KEY | `(name)` | Read and advance one counter inside the redeem or issue transaction with **one statement**: `UPDATE registry_counters SET next_value = next_value + 1 WHERE name = $1 RETURNING next_value - 1` (AT-5). The statement locks the row until the transaction ends, so two transactions can never mint the same number. This does not rely on the pipeline being serial [RV:SD-04]; revision 1 did |
| `registry_counters_name_check` | CHECK | `name IN ('device', 'pairingCode')` | |
| `registry_counters_value_check` | CHECK | `next_value >= 1` | |

### 4.12 T-12 `audit_log` (E-10)

The hash-chained audit trail. Shape: `AuditRow` (`types.ts:769-789`), 12 hashed body fields plus the two links. Mechanisms: section 6.

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `seq` | `bigint` | NOT NULL | — | 1, 2, 3, ... without a gap (guard trigger) |
| `id` | `text` | NOT NULL | — | `AUD-` and `seq` padded to at least six digits (`events.ts:112-114`) |
| `at` | `bigint` | NOT NULL | — | |
| `type` | `text` | NOT NULL | — | `CODE(type)` |
| `category` | `text` | NOT NULL | — | One of `AUDIT_CATEGORY` |
| `severity` | `text` | NOT NULL | — | One of `SEVERITY` |
| `actor_id` | `text` | NULL | — | Operator ID, or NULL for the system. Never a typed username (`types.ts:776-777`) |
| `message` | `text` | NOT NULL | — | |
| `session_id` | `text` | NULL | — | Soft reference (K-3) |
| `evidence_id` | `text` | NULL | — | Soft reference |
| `device_id` | `text` | NULL | — | Soft reference |
| `details` | `jsonb` | NOT NULL | `'{}'` | `FLAT` and `NO_SECRET_KEYS` |
| `prev_hash` | `text` | NOT NULL | — | `HEX64`; the genesis value for `seq = 1` (`constants.ts:44`) |
| `hash` | `text` | NOT NULL | — | `HEX64` |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `audit_log_pkey` | PRIMARY KEY | `(seq)` | Cursor paging by sequence in both directions [SP:API-9]; the newest 1,000 rows at start (MR-4); the stored-chain check reads in `seq` order, and from the last verified sequence onward when the server remembers one (`WHERE seq > $1 ORDER BY seq`, the incremental check of [RV:SD-27], owned by row 45 (W39)) |
| `audit_log_id_key` | UNIQUE | `(id)` | One identifier per row; lookup of a row that an alert or a client names |
| `audit_log_prev_hash_key` | UNIQUE | `(prev_hash)` | No fork: two rows can never link to the same predecessor |
| `audit_log_hash_key` | UNIQUE | `(hash)` | Lookup of the row a head value or an export names |
| `audit_log_actor_id_fkey` | FOREIGN KEY | `(actor_id) REFERENCES operators (id)` | An operator who appears in the trail can never be deleted |
| `audit_log_category_seq_idx` | INDEX | `(category, seq)` | Filter `category` of `listAuditRows` with stable paging [SP:L845] |
| `audit_log_type_seq_idx` | INDEX | `(type, seq)` | Filter `type` |
| `audit_log_actor_id_seq_idx` | INDEX | `(actor_id, seq) WHERE actor_id IS NOT NULL` | Filter `actorId` |
| `audit_log_session_id_seq_idx` | INDEX | `(session_id, seq) WHERE session_id IS NOT NULL` | Filter `sessionId`; the audit rows of one session |
| `audit_log_evidence_id_seq_idx` | INDEX | `(evidence_id, seq) WHERE evidence_id IS NOT NULL` | Filter `evidenceId`; the audit extract of one item |
| `audit_log_seq_check` | CHECK | `seq >= 1` | |
| `audit_log_id_check` | CHECK | `id = 'AUD-' \|\| lpad(seq::text, greatest(6, length(seq::text)), '0')` | |
| `audit_log_type_check` | CHECK | `CODE(type)` | |
| `audit_log_category_check` | CHECK | `category IN (AUDIT_CATEGORY)` | |
| `audit_log_severity_check` | CHECK | `severity IN (SEVERITY)` | |
| `audit_log_hashes_check` | CHECK | `HEX64(prev_hash) AND HEX64(hash) AND prev_hash <> hash` | |
| `audit_log_details_flat_check` | CHECK | `FLAT(details)` | |
| `audit_log_details_no_secret_keys_check` | CHECK | `NO_SECRET_KEYS(details)` | |

Triggers `audit_log_chain_guard` and `audit_log_append_only`, both `ENABLE ALWAYS` [RV:SD-06]: section 6.3.

### 4.13 T-13 `audit_chain_head`

One row: the sequence and hash of the newest audit row. It is the lock point of the chain and gives `total` and `head` without a scan. The migration inserts the genesis row (`seq = 0`, 64 zero digits).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `singleton` | `boolean` | NOT NULL | `true` | K-4 |
| `seq` | `bigint` | NOT NULL | — | 0 for an empty log |
| `hash` | `text` | NOT NULL | — | `HEX64` |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `audit_chain_head_pkey` | PRIMARY KEY | `(singleton)` | At most one row; the row every writer locks |
| `audit_chain_head_singleton_check` | CHECK | `singleton` | |
| `audit_chain_head_values_check` | CHECK | `seq >= 0 AND HEX64(hash)` | |

### 4.14 T-14 `events` (E-11)

Operational events. Shape: `SimEvent` (`types.ts:740-751`). Not chained; append-only for the runtime role by privilege.

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `seq` | `bigint` | NOT NULL | — | The value of the `event` counter the row consumed (`events.ts:266-272`) |
| `id` | `text` | NOT NULL | — | `LOG-` and `seq` padded to at least six digits (`events.ts:216-218`) |
| `at` | `bigint` | NOT NULL | — | |
| `type` | `text` | NOT NULL | — | `CODE(type)` |
| `category` | `text` | NOT NULL | — | One of `EVENT_CATEGORY`. **Derived**: not a member of `SimEvent`; set by the writer with the shared `eventCategory` (`views.ts:26-32`) so that the `category` filter of `listEvents` pages in SQL. Not returned to clients |
| `severity` | `text` | NOT NULL | — | One of `SEVERITY` |
| `message` | `text` | NOT NULL | — | |
| `params` | `jsonb` | NOT NULL | `'{}'` | `FLAT` and `NO_SECRET_KEYS` |
| `session_id` | `text` | NULL | — | Soft reference |
| `device_id` | `text` | NULL | — | Soft reference |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `events_pkey` | PRIMARY KEY | `(seq)` | Cursor paging by sequence [SP:API-9]; the newest 500 rows at start |
| `events_id_key` | UNIQUE | `(id)` | One identifier per event |
| `events_category_seq_idx` | INDEX | `(category, seq)` | Filter `category` of `listEvents` [SP:L849] |
| `events_type_seq_idx` | INDEX | `(type, seq)` | Filter `type` |
| `events_severity_seq_idx` | INDEX | `(severity, seq)` | Filter `severity` (the bell lists warnings and critical events) |
| `events_seq_check` | CHECK | `seq >= 1` | |
| `events_id_check` | CHECK | `id = 'LOG-' \|\| lpad(seq::text, greatest(6, length(seq::text)), '0')` | |
| `events_type_check` | CHECK | `CODE(type)` | |
| `events_category_check` | CHECK | `category IN (EVENT_CATEGORY)` | |
| `events_severity_check` | CHECK | `severity IN (SEVERITY)` | |
| `events_params_flat_check` | CHECK | `FLAT(params)` | |
| `events_params_no_secret_keys_check` | CHECK | `NO_SECRET_KEYS(params)` | |

### 4.15 T-15 `active_session` (E-12)

Zero rows (no session) or one row. The primary key on `singleton` makes "one active session per Core" (Q16, [DEC:D4]) a database rule: a second INSERT fails. Shape: `ActiveSession` (`types.ts:369-394`). State transitions are written at once, the 1 Hz progress columns at most once a second [SP:§3.2 slice 9]; MR-8 keeps the large JSON columns out of the progress write. The mapping deletes the row when the `session` slice becomes null (cancel, incomplete close) and replaces a finished session by DELETE and INSERT in one transaction when a new session is created; this is the only DELETE the runtime role issues (K-2).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `singleton` | `boolean` | NOT NULL | `true` | K-4 |
| `id` | `text` | NOT NULL | — | `SESSION_ID(id)` |
| `state` | `text` | NOT NULL | — | One of `SESSION_STATE` |
| `case_number` | `text` | NOT NULL | — | `CASE_NUMBER` |
| `subject_type` | `text` | NOT NULL | — | One of `SUBJECT_TYPE` |
| `subject_name` | `text` | NOT NULL | — | |
| `investigator_id` | `text` | NOT NULL | — | |
| `room` | `text` | NOT NULL | — | |
| `profile_id` | `text` | NOT NULL | — | One of `PROFILE` |
| `input_notes` | `text` | NOT NULL | `''` | `input.notes` (`types.ts:282, 372`) |
| `created_at` | `bigint` | NOT NULL | — | |
| `created_by` | `text` | NULL | — | |
| `armed_at` | `bigint` | NULL | — | |
| `started_at` | `bigint` | NULL | — | |
| `stopped_at` | `bigint` | NULL | — | |
| `stop_reason` | `text` | NULL | — | |
| `sealed_at` | `bigint` | NULL | — | |
| `marker_count` | `integer` | NOT NULL | `0` | |
| `snapshot_count` | `integer` | NOT NULL | `0` | |
| `bytes_written` | `bigint` | NOT NULL | `0` | |
| `evidence_id` | `text` | NULL | — | Soft reference: assigned before the evidence row exists (`session-machine.ts:742`) |
| `start_time_source` | `text` | NULL | — | One of `TIME_SOURCE` |
| `stop_time_source` | `text` | NULL | — | One of `TIME_SOURCE` |
| `precheck` | `jsonb` | NOT NULL | — | `PrecheckSlice` (`types.ts:309-316`), an object |
| `finalization` | `jsonb` | NOT NULL | — | `FinalizationSlice` (`types.ts:326-330`), an object |
| `timeline` | `jsonb` | NOT NULL | `'[]'` | `TimelineEvent[]`, at most 200 items |
| `notes` | `jsonb` | NOT NULL | `'[]'` | `SessionNote[]` |
| `fault` | `jsonb` | NULL | — | `SessionFault`, an object |
| `recovery` | `jsonb` | NULL | — | `RecoverySlice`, an object |
| `updated_at` | `bigint` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `active_session_pkey` | PRIMARY KEY | `(singleton)` | At most one row |
| `active_session_singleton_check` | CHECK | `singleton` | |
| `active_session_investigator_id_fkey` | FOREIGN KEY | `(investigator_id) REFERENCES operators (id)` | |
| `active_session_created_by_fkey` | FOREIGN KEY | `(created_by) REFERENCES operators (id)` | |
| `active_session_id_check` | CHECK | `SESSION_ID(id) AND CASE_NUMBER(case_number)` | |
| `active_session_state_check` | CHECK | `state IN (SESSION_STATE)` | |
| `active_session_input_check` | CHECK | `subject_type IN (SUBJECT_TYPE) AND profile_id IN (PROFILE)` | |
| `active_session_time_source_check` | CHECK | `(start_time_source IS NULL OR start_time_source IN (TIME_SOURCE)) AND (stop_time_source IS NULL OR stop_time_source IN (TIME_SOURCE))` | |
| `active_session_counts_check` | CHECK | `marker_count >= 0 AND snapshot_count >= 0 AND bytes_written >= 0` | |
| `active_session_json_check` | CHECK | `jsonb_typeof(precheck) = 'object' AND jsonb_typeof(finalization) = 'object' AND jsonb_typeof(timeline) = 'array' AND jsonb_array_length(timeline) <= 200 AND jsonb_typeof(notes) = 'array' AND (fault IS NULL OR jsonb_typeof(fault) = 'object') AND (recovery IS NULL OR jsonb_typeof(recovery) = 'object')` | |

No index beyond the key: one row.

### 4.16 T-16 `session_history` (E-13)

One row per finished session, sealed or incomplete; never changed. A cancelled session has no row. Shape: `SessionHistoryEntry` (`types.ts:397-418`) without `evidenceId` (MR-5).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `text` | NOT NULL | — | `SESSION_ID(id)` |
| `outcome` | `text` | NOT NULL | — | One of `SESSION_OUTCOME` |
| `case_number` | `text` | NOT NULL | — | `CASE_NUMBER` |
| `subject_name` | `text` | NOT NULL | — | |
| `subject_type` | `text` | NOT NULL | — | One of `SUBJECT_TYPE` |
| `investigator_id` | `text` | NOT NULL | — | |
| `room` | `text` | NOT NULL | — | |
| `profile_id` | `text` | NOT NULL | — | One of `PROFILE` |
| `created_at` | `bigint` | NOT NULL | — | |
| `started_at` | `bigint` | NULL | — | NULL when the recording never started |
| `ended_at` | `bigint` | NOT NULL | — | |
| `duration_ms` | `bigint` | NOT NULL | — | |
| `size_bytes` | `bigint` | NOT NULL | — | |
| `fault_kind` | `text` | NULL | — | One of `FAULT_KIND`; INCOMPLETE only |
| `start_time_source` | `text` | NULL | — | One of `TIME_SOURCE` |
| `end_time_source` | `text` | NULL | — | One of `TIME_SOURCE` |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `session_history_pkey` | PRIMARY KEY | `(id)` | Foreign-key target of `evidence_items`; a past-session summary by ID |
| `session_history_ended_at_idx` | INDEX | `(ended_at DESC, id DESC)` | `listSessionHistory` newest first with a keyset cursor [SP:L787]; the rehydration order (MR-3) |
| `session_history_investigator_id_fkey` | FOREIGN KEY | `(investigator_id) REFERENCES operators (id)` | |
| `session_history_id_check` | CHECK | `SESSION_ID(id) AND CASE_NUMBER(case_number)` | |
| `session_history_outcome_check` | CHECK | `outcome IN (SESSION_OUTCOME) AND (fault_kind IS NULL OR (outcome = 'INCOMPLETE' AND fault_kind IN (FAULT_KIND)))` | |
| `session_history_input_check` | CHECK | `subject_type IN (SUBJECT_TYPE) AND profile_id IN (PROFILE)` | |
| `session_history_values_check` | CHECK | `duration_ms >= 0 AND size_bytes >= 0 AND ended_at >= created_at` | |
| `session_history_time_source_check` | CHECK | as `active_session_time_source_check`, on `start_time_source` and `end_time_source` | |

No index on `investigator_id`: operators are never deleted and no operation filters history by investigator.

### 4.17 T-17 `evidence_items` (E-14)

One row per evidence item. Shape: `EvidenceItem` (`types.ts:699-738`); tracks and custody are tables 4.18 and 4.19. The descriptive columns repeat the session's (`case_number`, `subject_name`, ...): the item is the sealed record that the manifest hash covers (`evidence.ts:88-91`), both rows are immutable, and the runtime role has no UPDATE on these columns, so the repetition cannot drift (CL-08).

| Column | Type | Null | Default | Rule | Runtime may update |
|---|---|---|---|---|:-:|
| `id` | `text` | NOT NULL | — | `EVIDENCE_ID(id)` | no |
| `session_id` | `text` | NOT NULL | — | | no |
| `case_number` | `text` | NOT NULL | — | `CASE_NUMBER` | no |
| `subject_name` | `text` | NOT NULL | — | | no |
| `subject_type` | `text` | NOT NULL | — | One of `SUBJECT_TYPE` | no |
| `investigator_id` | `text` | NOT NULL | — | | no |
| `room` | `text` | NOT NULL | — | | no |
| `profile_id` | `text` | NOT NULL | — | One of `PROFILE` | no |
| `recorded_at` | `bigint` | NOT NULL | — | | no |
| `ended_at` | `bigint` | NOT NULL | — | | no |
| `sealed_at` | `bigint` | NULL | — | NULL for a RECORDED item that was never sealed | no |
| `duration_ms` | `bigint` | NOT NULL | — | | no |
| `size_bytes` | `bigint` | NOT NULL | — | | no |
| `status` | `text` | NOT NULL | — | One of `EVIDENCE_STATUS` | **yes** |
| `lifecycle_stage` | `text` | NOT NULL | — | One of `LIFECYCLE_STAGE` | **yes** |
| `manifest_hash` | `text` | NOT NULL | — | `HEX64` | no |
| `signature_value` | `text` | NOT NULL | — | `HEX64` (`evidence.ts:114`) | no |
| `signature_key_id` | `text` | NOT NULL | — | | no |
| `signature_algorithm` | `text` | NOT NULL | — | `SIMULATED-SHA256` (`types.ts:674`) | no |
| `signature_simulated` | `boolean` | NOT NULL | `true` | Always true (`types.ts:675`) | no |
| `verification_status` | `text` | NOT NULL | `'NOT_RUN'` | One of `VERIFICATION` | **yes** |
| `verification_at` | `bigint` | NULL | — | | **yes** |
| `tampered` | `boolean` | NOT NULL | `false` | Demo fault marker [SP:§12.3] | **yes** |
| `tampered_track_id` | `text` | NULL | — | One of `TRACK_ID` | **yes** |
| `case_type` | `text` | NULL | — | One of `SUBJECT_TYPE` (`vocabulary.ts:469`) | no |
| `markers` | `jsonb` | NOT NULL | `'[]'` | `EvidenceMarker[]` | no |
| `notes` | `jsonb` | NOT NULL | `'[]'` | `SessionNote[]` | no |
| `integrity_source` | `text` | NULL | — | One of `INTEGRITY_SOURCE` | no |
| `start_time_source` | `text` | NULL | — | One of `TIME_SOURCE` | no |
| `end_time_source` | `text` | NULL | — | One of `TIME_SOURCE` | no |
| `created_at` | `bigint` | NOT NULL | — | Time the row was written (seal, incomplete close, or seed) | no |
| `updated_at` | `bigint` | NOT NULL | — | | **yes** |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `evidence_items_pkey` | PRIMARY KEY | `(id)` | `getEvidence` and every evidence command by ID; foreign-key target |
| `evidence_items_session_id_key` | UNIQUE | `(session_id)` | One item per session; the join that gives a history entry its `evidenceId` (MR-5) |
| `evidence_items_session_id_fkey` | FOREIGN KEY | `(session_id) REFERENCES session_history (id)` | |
| `evidence_items_investigator_id_fkey` | FOREIGN KEY | `(investigator_id) REFERENCES operators (id)` | |
| `evidence_items_recorded_at_idx` | INDEX | `(recorded_at DESC, id DESC)` | `listEvidence` with a keyset cursor [SP:L799]; "sealed today" lists; the rehydration order |
| `evidence_items_status_recorded_at_idx` | INDEX | `(status, recorded_at DESC, id DESC)` | Filter `status` of `listEvidence` |
| `evidence_items_case_type_recorded_at_idx` | INDEX | `(case_type, recorded_at DESC, id DESC)` | Filter `caseType` of `listEvidence` |
| `evidence_items_id_check` | CHECK | `EVIDENCE_ID(id) AND CASE_NUMBER(case_number)` | |
| `evidence_items_status_check` | CHECK | `status IN (EVIDENCE_STATUS) AND lifecycle_stage IN (LIFECYCLE_STAGE)` | |
| `evidence_items_input_check` | CHECK | `subject_type IN (SUBJECT_TYPE) AND profile_id IN (PROFILE) AND (case_type IS NULL OR case_type IN (SUBJECT_TYPE))` | |
| `evidence_items_hashes_check` | CHECK | `HEX64(manifest_hash) AND HEX64(signature_value)` | |
| `evidence_items_signature_check` | CHECK | `signature_algorithm = 'SIMULATED-SHA256' AND signature_simulated` | |
| `evidence_items_verification_check` | CHECK | `verification_status IN (VERIFICATION) AND ((verification_status = 'NOT_RUN') = (verification_at IS NULL))` | |
| `evidence_items_tamper_check` | CHECK | `tampered_track_id IS NULL OR tampered_track_id IN (TRACK_ID)` | |
| `evidence_items_values_check` | CHECK | `duration_ms >= 0 AND size_bytes >= 0 AND ended_at >= recorded_at AND (sealed_at IS NULL OR sealed_at >= ended_at)` | |
| `evidence_items_sources_check` | CHECK | `(integrity_source IS NULL OR integrity_source IN (INTEGRITY_SOURCE)) AND (start_time_source IS NULL OR start_time_source IN (TIME_SOURCE)) AND (end_time_source IS NULL OR end_time_source IN (TIME_SOURCE))` | |
| `evidence_items_json_check` | CHECK | `jsonb_typeof(markers) = 'array' AND jsonb_typeof(notes) = 'array'` | |

The free-text search `q` of `listEvidence` is a sequential scan by design: no extension is used (DA-06) and the largest volume is the bulk fixture's 500 items.

### 4.18 T-18 `evidence_tracks` (E-15)

Four rows per item; AUDIO-01 and AUDIO-02 are separate rows (I11). Shape: `EvidenceTrack` (`types.ts:663-668`). The runtime role may insert and read only, so a sealed track hash cannot be changed by the server [SP:L805; SR-59].

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `evidence_id` | `text` | NOT NULL | — | |
| `track_id` | `text` | NOT NULL | — | One of `TRACK_ID` |
| `position` | `smallint` | NOT NULL | — | 1 to 4, the order of `TRACK_ORDER` (`evidence.ts:48-53`) |
| `label` | `text` | NOT NULL | — | |
| `size_bytes` | `bigint` | NOT NULL | — | |
| `sha256` | `text` | NOT NULL | — | `HEX64` |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `evidence_tracks_pkey` | PRIMARY KEY | `(evidence_id, track_id)` | The tracks of one item; one row per track ID |
| `evidence_tracks_evidence_id_position_key` | UNIQUE | `(evidence_id, position)` | Stable track order of an answer |
| `evidence_tracks_evidence_id_fkey` | FOREIGN KEY | `(evidence_id) REFERENCES evidence_items (id)` | |
| `evidence_tracks_track_check` | CHECK | `track_id IN (TRACK_ID) AND position BETWEEN 1 AND 4` | |
| `evidence_tracks_values_check` | CHECK | `size_bytes >= 0 AND HEX64(sha256)` | |

### 4.19 T-19 `evidence_custody` (E-16)

The custody log of an item; rows are only added (`evidence-actions.ts:67-75, 165, 207`). Shape: `CustodyEntry` (`types.ts:678-683`).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `evidence_id` | `text` | NOT NULL | — | |
| `seq` | `integer` | NOT NULL | — | 1-based position in the item's custody list |
| `at` | `bigint` | NOT NULL | — | |
| `action` | `text` | NOT NULL | — | `CODE(action)` (the type is an open string; values today: `RECORDING_STARTED`, `RECORDING_STOPPED`, `SEALED`, `SESSION_INCOMPLETE`, `REVIEW_OPENED`, `VERIFIED`, `VERIFY_FAILED`, `EXPORTED`, `ARCHIVED`) |
| `actor_id` | `text` | NULL | — | |
| `detail` | `text` | NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `evidence_custody_pkey` | PRIMARY KEY | `(evidence_id, seq)` | The custody log of one item in order |
| `evidence_custody_evidence_id_fkey` | FOREIGN KEY | `(evidence_id) REFERENCES evidence_items (id)` | |
| `evidence_custody_actor_id_fkey` | FOREIGN KEY | `(actor_id) REFERENCES operators (id)` | |
| `evidence_custody_values_check` | CHECK | `seq >= 1 AND CODE(action)` | |

### 4.20 T-20 `exports` (E-17)

One row per accepted export of evidence, of the audit log or of the log bundle [SP:L298]. The simulator has no slice for it: the engine host writes the row from the action's result (`exportId`) and the audit row's details (`evidence-actions.ts:156-184, 267-281`).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `text` | NOT NULL | — | `EXPORT_ID(id)` |
| `scope` | `text` | NOT NULL | — | One of `EXPORT_SCOPE` |
| `evidence_id` | `text` | NULL | — | Set exactly when `scope` is `EVIDENCE` |
| `operator_id` | `text` | NOT NULL | — | |
| `reason` | `text` | NOT NULL | — | At least 5 characters after trimming [SP:L851]; `EXPORT_REASON_MIN_LENGTH` (`constants.ts:71-73`) |
| `destination` | `text` | NOT NULL | — | At most 120 characters (`evidence-actions.ts:158`) |
| `at` | `bigint` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `exports_pkey` | PRIMARY KEY | `(id)` | One export ID is used once |
| `exports_evidence_id_fkey` | FOREIGN KEY | `(evidence_id) REFERENCES evidence_items (id)` | |
| `exports_operator_id_fkey` | FOREIGN KEY | `(operator_id) REFERENCES operators (id)` | |
| `exports_evidence_id_idx` | INDEX | `(evidence_id) WHERE evidence_id IS NOT NULL` | The exports of one item (evidence detail) |
| `exports_id_check` | CHECK | `EXPORT_ID(id)` | |
| `exports_scope_check` | CHECK | `scope IN (EXPORT_SCOPE) AND ((scope = 'EVIDENCE') = (evidence_id IS NOT NULL))` | |
| `exports_text_check` | CHECK | `char_length(btrim(reason)) >= 5 AND char_length(destination) BETWEEN 1 AND 120` | |

### 4.21 T-21 `alerts` (E-18)

Shape: `SimAlert` (`types.ts:753-766`). The table keeps every alert; the engine keeps the newest 100 (`constants.ts:38`).

| Column | Type | Null | Default | Rule | Runtime may update |
|---|---|---|---|---|:-:|
| `id` | `text` | NOT NULL | — | `ALR-NNNNNN` (`faults.ts:158`): `id ~ '^ALR-[0-9]{6,}$'` | no |
| `at` | `bigint` | NOT NULL | — | | no |
| `severity` | `text` | NOT NULL | — | One of `SEVERITY` | no |
| `kind` | `text` | NOT NULL | — | One of `FAULT_KIND`, or `SYSTEM` | no |
| `message` | `text` | NOT NULL | — | | no |
| `active` | `boolean` | NOT NULL | `true` | | **yes** |
| `acknowledged` | `boolean` | NOT NULL | `false` | | **yes** |
| `resolved_at` | `bigint` | NULL | — | | **yes** |
| `target` | `text` | NULL | — | | no |
| `params` | `jsonb` | NULL | — | `FLAT` when present | no |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `alerts_pkey` | PRIMARY KEY | `(id)` | `acknowledgeAlert` by ID |
| `alerts_at_idx` | INDEX | `(at DESC, id DESC)` | The newest 100 alerts at start (MR-4) |
| `alerts_id_check` | CHECK | as above | |
| `alerts_kind_check` | CHECK | `severity IN (SEVERITY) AND (kind = 'SYSTEM' OR kind IN (FAULT_KIND))` | |
| `alerts_params_check` | CHECK | `params IS NULL OR FLAT(params)` | |

### 4.22 T-22 `storage_policy` (E-19)

One row. Shape: `StoragePolicy` (`types.ts:513-517`).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `singleton` | `boolean` | NOT NULL | `true` | K-4 |
| `retention_policy` | `text` | NOT NULL | — | One of `RETENTION` |
| `retention_days` | `integer` | NOT NULL | — | 1 to 3,650 [SP:L829] |
| `auto_archive` | `boolean` | NOT NULL | — | |
| `updated_at` | `bigint` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `storage_policy_pkey` | PRIMARY KEY | `(singleton)` | At most one row |
| `storage_policy_singleton_check` | CHECK | `singleton` | |
| `storage_policy_values_check` | CHECK | `retention_policy IN (RETENTION) AND retention_days BETWEEN 1 AND 3650` | |

### 4.23 T-23 `console_settings` (E-20)

One row; kept across a reset. Shape: `SettingsSlice` (`types.ts:836-841`); defaults: `DEFAULT_SETTINGS` (`initial-state.ts:79-84`).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `singleton` | `boolean` | NOT NULL | `true` | K-4 |
| `presentation_mode` | `boolean` | NOT NULL | `false` | |
| `time_format` | `text` | NOT NULL | `'24'` | `24` or `12` |
| `notify_warnings` | `boolean` | NOT NULL | `true` | |
| `notify_sound` | `boolean` | NOT NULL | `false` | |
| `updated_at` | `bigint` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `console_settings_pkey` | PRIMARY KEY | `(singleton)` | At most one row |
| `console_settings_singleton_check` | CHECK | `singleton` | |
| `console_settings_time_format_check` | CHECK | `time_format IN ('24', '12')` | |

### 4.24 T-24 `engine_counters` (E-21, `meta.counters`)

One row per counter of `SimCounters` (`types.ts:168-185`). The seed writes five rows. The row `export` is absent until the first export, exactly as the member is absent from a fresh state (`initial-state.ts:150-156`); its first value is `DATASET_EXPORT_SEQ + 1` (`evidence-actions.ts:41`), so the runtime role may insert that one row. Written with the rows that consume the value [SP:§3.2 slice 1].

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `name` | `text` | NOT NULL | — | `event`, `session`, `caseNumber`, `evidence`, `item` or `export` |
| `next_value` | `bigint` | NOT NULL | — | At least 1 |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `engine_counters_pkey` | PRIMARY KEY | `(name)` | Update of one counter |
| `engine_counters_name_check` | CHECK | `name IN ('event', 'session', 'caseNumber', 'evidence', 'item', 'export')` | |
| `engine_counters_value_check` | CHECK | `next_value >= 1` | |

### 4.25 T-25 `core_device` (E-22)

One row. Shape: `DeviceSlice` with `DeviceIdentity` (`types.ts:205-229`), plus the certificate fingerprint that `PairingRedeemed.core` returns [SP:L953], seeded from `DEVICE_CERT_FINGERPRINT` (`dataset.ts:96`). A software update changes `software_version` and `core_software_version` (`maintenance.ts:412-416`); nothing else changes.

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `singleton` | `boolean` | NOT NULL | `true` | K-4 |
| `id` | `text` | NOT NULL | — | |
| `name` | `text` | NOT NULL | — | |
| `room` | `text` | NOT NULL | — | |
| `product_name` | `text` | NOT NULL | — | |
| `software_version` | `text` | NOT NULL | — | |
| `certificate_fingerprint` | `text` | NOT NULL | — | |
| `serial_number`, `hardware_uuid`, `chassis_revision`, `som_part_revision`, `audio_board_revision`, `poe_board_revision`, `power_board_revision`, `bsp_version`, `core_software_version`, `tablet_app_version`, `tpm_model_firmware`, `camera_model_firmware`, `provisioning_record_id`, `device_certificate_id` | `text` (14 columns) | NOT NULL | — | The 14 members of `DeviceIdentity`, one column each |
| `updated_at` | `bigint` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `core_device_pkey` | PRIMARY KEY | `(singleton)` | At most one row |
| `core_device_singleton_check` | CHECK | `singleton` | |

### 4.26 T-26 `core_state` (E-23)

One row [SP:L304]: the scalar parts of `meta` (`types.ts:187-195`), the two `lastSealed` slices, and the seed bookkeeping.

| Column | Type | Null | Default | Rule | Runtime may update |
|---|---|---|---|---|:-:|
| `singleton` | `boolean` | NOT NULL | `true` | K-4 | no |
| `seed` | `bigint` | NOT NULL | — | `meta.seed` (`DEFAULT_SEED`, `constants.ts:9`) | no |
| `sim_schema_version` | `integer` | NOT NULL | — | `meta.schemaVersion` (`SIM_SNAPSHOT_VERSION`, `constants.ts:14`); not the database schema version | no |
| `scenario` | `text` | NOT NULL | — | One of `SCENARIO`: the loaded scenario | no |
| `epoch` | `bigint` | NOT NULL | — | At least 0. The server adds 1 at every start; a reset writes the previous value plus 1 (SPEC-GAP-5, decided by D14: the epoch continues) | **yes** |
| `created_at` | `bigint` | NOT NULL | — | `meta.createdAt` | no |
| `seeded_at` | `bigint` | NOT NULL | — | The `now` of the seed [SP:ENG-21] | no |
| `last_reset_at` | `bigint` | NULL | — | NULL after a first seed | no |
| `last_sealed_session_id` | `text` | NULL | — | Soft reference | **yes** |
| `last_sealed_acknowledged` | `boolean` | NOT NULL | `true` | | **yes** |
| `updated_at` | `bigint` | NOT NULL | — | | **yes** |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `core_state_pkey` | PRIMARY KEY | `(singleton)` | At most one row; its presence is the "seeded" test of B-6 |
| `core_state_singleton_check` | CHECK | `singleton` | |
| `core_state_values_check` | CHECK | `scenario IN (SCENARIO) AND epoch >= 0 AND sim_schema_version >= 1` | |

### 4.27 T-27 `hardware_snapshot` (E-24)

One row; one column per snapshot slice of section 3.2 (14 `jsonb` columns in the wire form of their shared types, and `active_camera_id`). Written at most once a second when a slice changed, and at shutdown [AN:567]; the UPDATE names only the changed slice columns (MR-8).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `singleton` | `boolean` | NOT NULL | `true` | K-4 |
| `sim_schema_version` | `integer` | NOT NULL | — | The shape version of the slices (`constants.ts:14`); a different value at start means the snapshot is rebuilt from the seed builders, not read |
| `tablet_link` | `jsonb` | NOT NULL | — | `TabletLinkSlice`; recomputed at start [SP:§8.6] |
| `active_camera_id` | `text` | NOT NULL | — | One of `VIDEO_TRACK_ID` |
| `cameras` | `jsonb` | NOT NULL | — | Array |
| `mics` | `jsonb` | NOT NULL | — | Array |
| `storage` | `jsonb` | NOT NULL | — | Object |
| `time_status` | `jsonb` | NOT NULL | — | Object (slice `time`) |
| `network` | `jsonb` | NOT NULL | — | Object |
| `security` | `jsonb` | NOT NULL | — | Object |
| `services` | `jsonb` | NOT NULL | — | Array |
| `health` | `jsonb` | NOT NULL | — | Object |
| `other_devices` | `jsonb` | NOT NULL | — | Array |
| `ports` | `jsonb` | NOT NULL | — | Array |
| `faults` | `jsonb` | NOT NULL | — | Object |
| `diagnostics` | `jsonb` | NULL | — | Object, or NULL when no run exists (`types.ts:880`) |
| `software_update` | `jsonb` | NOT NULL | — | Object (slice `update`) |
| `written_at` | `bigint` | NOT NULL | — | |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `hardware_snapshot_pkey` | PRIMARY KEY | `(singleton)` | At most one row |
| `hardware_snapshot_singleton_check` | CHECK | `singleton` | |
| `hardware_snapshot_camera_check` | CHECK | `active_camera_id IN (VIDEO_TRACK_ID)` | |
| `hardware_snapshot_shapes_check` | CHECK | `jsonb_typeof(cameras) = 'array' AND jsonb_typeof(mics) = 'array' AND jsonb_typeof(services) = 'array' AND jsonb_typeof(other_devices) = 'array' AND jsonb_typeof(ports) = 'array' AND jsonb_typeof(tablet_link) = 'object' AND jsonb_typeof(storage) = 'object' AND jsonb_typeof(time_status) = 'object' AND jsonb_typeof(network) = 'object' AND jsonb_typeof(security) = 'object' AND jsonb_typeof(health) = 'object' AND jsonb_typeof(faults) = 'object' AND jsonb_typeof(software_update) = 'object' AND (diagnostics IS NULL OR jsonb_typeof(diagnostics) = 'object')` | |

### 4.28 T-28 `health_snapshots` (E-25)

One row every 60 s and one at every fault raise and clear [SP:L306, L1073]. The specification gives the entity no content and no reader; the 17 columns below were this contract's choice and are **adopted by D14** (SPEC-GAP-4, decided). The interval is a server constant of 60,000 ms.

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | |
| `at` | `bigint` | NOT NULL | — | |
| `cause` | `text` | NOT NULL | — | One of `SNAPSHOT_CAUSE` |
| `fault_kind` | `text` | NULL | — | One of `FAULT_KIND`; set exactly when `cause` is not `INTERVAL` |
| `cpu_percent` | `double precision` | NOT NULL | — | `HealthSlice` (`types.ts:634-644`) |
| `cpu_temp_c` | `double precision` | NOT NULL | — | |
| `storage_temp_c` | `double precision` | NOT NULL | — | |
| `ambient_temp_c` | `double precision` | NOT NULL | — | |
| `fan_rpm` | `integer` | NOT NULL | — | |
| `fan_ok` | `boolean` | NOT NULL | — | |
| `storage_state` | `text` | NOT NULL | — | One of `STORAGE_STATE` |
| `evidence_used_bytes` | `bigint` | NOT NULL | — | Used bytes of the evidence volume |
| `time_source` | `text` | NOT NULL | — | One of `TIME_SOURCE` |
| `time_offset_ms` | `double precision` | NOT NULL | — | |
| `security_state` | `text` | NOT NULL | — | One of `SECURITY_STATE` |
| `session_state` | `text` | NULL | — | One of `SESSION_STATE`; NULL when no session is open |
| `active_faults` | `smallint` | NOT NULL | — | Number of active faults, at least 0 |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `health_snapshots_pkey` | PRIMARY KEY | `(id)` | |
| `health_snapshots_at_idx` | INDEX | `(at)` | A time range of snapshots; the newest snapshot |
| `health_snapshots_cause_check` | CHECK | `cause IN (SNAPSHOT_CAUSE) AND ((cause = 'INTERVAL') = (fault_kind IS NULL)) AND (fault_kind IS NULL OR fault_kind IN (FAULT_KIND))` | |
| `health_snapshots_states_check` | CHECK | `storage_state IN (STORAGE_STATE) AND time_source IN (TIME_SOURCE) AND security_state IN (SECURITY_STATE) AND (session_state IS NULL OR session_state IN (SESSION_STATE)) AND active_faults >= 0` | |

### 4.29 T-29 `schema_meta`

One row, written by the migrations and by nothing else. It is what the server compares at boot (B-3).

| Column | Type | Null | Default | Rule |
|---|---|---|---|---|
| `singleton` | `boolean` | NOT NULL | `true` | K-4 |
| `schema_version` | `integer` | NOT NULL | — | 1 for this contract; each later migration set adds 1 |
| `contract_revision` | `text` | NOT NULL | — | `dbc-2` for this revision of the contract. Revision 1 (`dbc-1`) was never migrated: no database exists yet (1.4), so the first migration set is written from this revision and `schema_version` stays 1. The patch 2.1 keeps `dbc-2` for the same reason: it changed one grant before any migration file existed |

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `schema_meta_pkey` | PRIMARY KEY | `(singleton)` | At most one row |
| `schema_meta_singleton_check` | CHECK | `singleton AND schema_version >= 1` | |

### 4.30 T-30 `audit_chain_history` (E-26, lineage of discarded audit chains)

One row per audit chain that a reset or a scenario load discarded [RV:SD-19]; [DEC:D16]. It is the table of entity E-26 of the revised specification ("audit chain lineage", [SP:§3.3]); the specification left the table name to this contract, and it is the name the review used. The table is **kept across every reset**: the reset routine copies its rows into the new database and appends one row for the chain it is about to discard (8.5, R-3, R-5). It is written by the reset routine only, as `dems_owner`. A first build writes no row: nothing was discarded. A reset of a database whose audit log is empty (migrated, never seeded) writes no row either.

The table is protected more tightly than `audit_log`: the runtime role `dems_app` has **SELECT only** [DEC:D18], and a statement-level trigger, `ENABLE ALWAYS`, of the same kind as the audit table's refuses UPDATE, DELETE and TRUNCATE for every role, the owner included (6.3). It holds integrity values and identifiers only; a head hash is not a secret (like `manifest_hash`), so every column may be returned and logged.

| Column | Type | Null | Default | Rule | Member of `AuditChainLineageEntry` [SP:§7.18] |
|---|---|---|---|---|---|
| `reset_no` | `bigint` | NOT NULL | — | 1, 2, 3, ... in the order of the resets of this database lineage. Assigned by the reset routine as the highest carried value plus 1 | — (the order of the list) |
| `epoch` | `bigint` | NOT NULL | — | The epoch the discarded chain ended in: `core_state.epoch` of the old database as R-3 read it. The new database starts at this value plus 1 | `epoch` |
| `head_hash` | `text` | NOT NULL | — | `HEX64`: `audit_chain_head.hash` of the discarded database | `head` |
| `row_count` | `bigint` | NOT NULL | — | `count(*)` of the discarded `audit_log`; at least 1 | `rows` |
| `first_seq` | `bigint` | NOT NULL | — | `min(seq)` of the discarded `audit_log` (1 in an intact chain) | — |
| `last_seq` | `bigint` | NOT NULL | — | `audit_chain_head.seq` of the discarded database (equal to `row_count` in an intact chain) | — |
| `reset_at` | `bigint` | NOT NULL | — | The `now` of the reset on the server clock; the same value the reset writes to `core_state.last_reset_at` | `resetAt` |
| `actor_id` | `text` | NULL | — | The operator who called `resetDemo` or `loadScenario`. NULL when the reset came from the command line [SP:DC-9] | `actorId` |
| `reason` | `text` | NOT NULL | — | One of `CHAIN_DISCARD_REASON` | `reason` |
| `scenario` | `text` | NOT NULL | — | One of `SCENARIO`: the scenario the reset loaded (`idle` for `resetDemo`) | `scenario` |

`first_seq` and `last_seq` are asked for by the brief of this revision; the entry of the specification has no member for them and gives the head sequence through `rows`. They cost nothing to store and are what lets a reader see that a discarded chain was not intact. Whether the answer carries them is the specification's choice (15.4).

| Name | Kind | Definition | Reason (indexes) |
|---|---|---|---|
| `audit_chain_history_pkey` | PRIMARY KEY | `(reset_no)` | The lineage in order; the newest 20 entries first for `verifyAuditChain` (`ORDER BY reset_no DESC LIMIT 20`); the routine's "highest value plus 1" |
| `audit_chain_history_epoch_key` | UNIQUE | `(epoch)` | One discarded chain per epoch. The epoch rises at every start and at every reset, so two chains cannot end in the same one; lookup of the chain that ended in a given epoch |
| `audit_chain_history_actor_id_fkey` | FOREIGN KEY | `(actor_id) REFERENCES operators (id)` | An operator named in the lineage cannot be deleted; operator IDs are stable across a reset (DA-08) |
| `audit_chain_history_numbers_check` | CHECK | `reset_no >= 1 AND epoch >= 0` | |
| `audit_chain_history_head_hash_check` | CHECK | `HEX64(head_hash)` | |
| `audit_chain_history_values_check` | CHECK | `row_count >= 1 AND first_seq >= 1 AND last_seq >= first_seq` | |
| `audit_chain_history_reason_check` | CHECK | `reason IN (CHAIN_DISCARD_REASON) AND scenario IN (SCENARIO)` | |

Trigger `audit_chain_history_append_only`, `ENABLE ALWAYS`: section 6.3.

Deliberately **not** a CHECK:

- `row_count = last_seq - first_seq + 1`. The routine records what it read. A reset is also the way out of a damaged database, and a constraint that refused the record of a damaged chain would block the repair. A reader derives "the discarded chain was intact" from `first_seq = 1 AND last_seq = row_count`.
- "A server-triggered reset has an actor". The two reasons do not say who called; the routine sets `actor_id` from the session of the request and leaves it NULL from the command line, and T-RS-1 checks both.

How the row is written and read is section 6.6 (LN-1 to LN-6).

---

## 5. Security-relevant storage

### 5.1 Stored forms

| Secret | Columns | Stored form | Exact input of the hash | Source |
|---|---|---|---|---|
| Operator password | `operator_credentials`: `algorithm`, `memory_kib`, `passes`, `parallelism`, `salt`, `hash` | Argon2id raw key (32 bytes), a random salt of 16 bytes per password, and the three cost parameters, **each in its own column** | The password's UTF-8 bytes with the row's salt and parameters | [SP:SR-05, SR-06]; [AN:380] |
| Session token | `auth_sessions.token_hash` | SHA-256, 32 bytes | The UTF-8 bytes of the whole presented value, prefix `ses_` included | [SP:ID-P6; SR-09] |
| Device credential | `device_credentials.current_hash`, `.next_hash` | SHA-256, 32 bytes | The whole value, prefix `dvc_` included | [SP:PR-P8; SR-31] |
| Biometric token | `biometric_tokens.token_hash` | SHA-256, 32 bytes | The whole value, prefix `bio_` included | [SP:SR-36] |
| Pairing code | `pairing_codes.code_hash` | SHA-256, 32 bytes | The UTF-8 bytes of the code ID, one colon, and the six digits (for example the ID `PCD-000007` followed by `:` and the code) | [SP:PR-P6]; the separator is chosen here |

**Password: separate columns, not an encoded string.** This follows the decision record [AN:380] and SR-06. Reasons: Node's `crypto.argon2` returns the raw derived key and offers no encoded form and no verify helper [AN:379], so an encoded string would need hand-written formatting and parsing; with typed columns the floor of SR-05 is a CHECK (`operator_credentials_params_check`, `_lengths_check`), AC-B-30 is one query, and a change of cost needs no migration because each row states its own parameters [AN:382].

**Why a plain SHA-256 is enough for the three tokens.** Each is 256 random bits [SP:ID-P6, PR-P8, SR-36]; it cannot be guessed, so the hash only keeps a dump or a log from being usable as a credential [AN:393]. The pairing code is different: six digits can be searched offline in a moment, so its hash only keeps the code out of dumps and logs, and the protection is the lifetime, the single use and the attempt limits [SP:L544; GS-09].

Never stored in any table in any form: the password itself; the QR payload; a cookie value; the passwords of the three PostgreSQL roles (they live in three files under `.data/`, section 7.6; PostgreSQL itself keeps a SCRAM verifier of each in its catalog, which only a superuser can read).

No pepper exists: it would be one more secret under the same `.data/` and the same uid, so it adds no separation, and the password is a published constant [RV:SD-21 (b)]. No column, file or key of this contract holds one. The salt of SD-4 comes from `crypto.randomBytes(16)` [RV:SD-21 (c)].

### 5.2 Lookup strategy

| Presented value | Lookup | Index used | Then |
|---|---|---|---|
| Session token from the **cookie** | `WHERE token_hash = $1 AND device_id IS NULL` on `auth_sessions`, joined to `operators` | `auth_sessions_token_hash_key` | Refuse when `ended_at` is set, when `absolute_expires_at` has passed, when `last_seen_at` is older than the idle limit, or when the operator is disabled [SP:§4.1] |
| Session token from a **bearer** value `ses_` | `WHERE token_hash = $1 AND device_id IS NOT NULL` on `auth_sessions`, joined to `operators` and `paired_devices` | `auth_sessions_token_hash_key` | As above, and refuse when the device is not `PAIRED` |
| Device credential (bearer `dvc_`) | `WHERE current_hash = $1 OR next_hash = $1` on `device_credentials`, joined to `paired_devices` | `device_credentials_current_hash_key`, `device_credentials_next_hash_key` | A match on `next_hash` promotes it in the same transaction: `UPDATE device_credentials SET current_hash = next_hash, next_hash = NULL WHERE device_id = $2 AND next_hash = $1 RETURNING device_id` [SP:§6.3 T7]; zero rows means another request promoted it first, and the value is looked up again. State `REVOKED` or `UNPAIRED` answers 403 `DEVICE_REVOKED` |
| Biometric token (body, `bio_`) | **By a compare-and-set, not by a read**: the UPDATE of AT-C4 (5.6) on `token_hash`, the presenting device and "not used, not revoked, not expired". Only when it returns no row: `SELECT ... WHERE token_hash = $1` to tell a reuse from an unknown value | `biometric_tokens_token_hash_key` | One row: this request owns the use. No row and `used_at` set: reuse; revoke the family through `biometric_tokens_family_id_idx` and end the biometric sessions of that device and operator [SP:§5.6 step 6]; [RV:SD-10] |
| Pairing code | **Not by hash, and not by a plain read**: the consuming UPDATE of AT-C2 (5.6) on the one `ACTIVE` row returns `id` and `code_hash` to the request that took an attempt | `pairing_codes_one_active_key` | The server hashes the code ID with the presented digits and compares with `code_hash` using `crypto.timingSafeEqual`. No row, or a mismatch, is the generic `INVALID_CODE` [SP:SR-29] |
| Password | `WHERE username = $1` on `operators`, joined to `operator_credentials` | `operators_username_key` | Recompute with the stored parameters and compare in constant time; the Argon2 computation runs for a known, an unknown and a disabled operator alike, against a fixed dummy record when no row matches [SP:ID-2]; [RV:SD-21 (a)]. The lockout attempt is consumed before the computation starts (AT-6) |

**Transport binding [RV:SD-09].** The lookup looks at the transport: a cookie resolves only a session without a device, a bearer `ses_` value only a session with one. A token presented through the other transport is "not found" and answers 401 like any unknown token; the row is not ended by that attempt. That a request carries one credential only (a cookie together with an `Authorization` header is refused, as is a bearer together with a web console Origin) is the specification's rule [SP:ID-12; SR-73]; the two predicates above are the database half of [SP:ID-13], tested by AC-B-81.

An equality probe on the hash of a 256-bit random value is the pattern the decision record chose [AN:393]. The two comparisons that must be constant-time, the password's and the pairing code's, happen in the server, not in SQL.

### 5.3 Expiry and revocation columns

| Credential | Expiry | Revocation | Written in the same transaction as |
|---|---|---|---|
| Session | `absolute_expires_at` (stored); idle expiry computed from `last_seen_at` and `AUTH_IDLE_TIMEOUT_MS` (`constants.ts:54`) | `ended_at`, `end_reason` (eight reasons, section 2.4) | The audit row of the sign-out, expiry, disable, revoke, unpair or token reuse [SP:SR-12]; [RV:SD-10] |
| Device credential | none | `paired_devices.state` with `revoked_at`, `revoked_by_operator_id`, `revoke_reason`, or `unpaired_at`; rotation through `next_hash`, `rotated_at` | The end of the device's sessions and the revocation of its biometric tokens [SP:SR-34] |
| Biometric token | `expires_at` | `used_at` (single use), `revoked_at`, `revoke_reason` | The new token of the family (rotation); or, on a reuse, the family revocation **and** the end of the open biometric sessions of that device and operator (`end_reason = 'TOKEN_REUSE'`) |
| Pairing code | `expires_at` | `state`, `closed_at`, `closed_by_operator_id`, `failed_attempts` | The device row and its credential (redeem), or the `PAIRING_CODE_CLOSED` row |
| Password | none (no change operation, GS-01) | `operators.enabled` | The end of the operator's sessions [SP:§4.7] |

### 5.4 Columns that must never be logged

| ID | Rule |
|---|---|
| NL-1 | These columns MUST NOT appear in a log line, an error message, an audit row, an event, a realtime message, an API answer, a test snapshot, a progress file or a document: **every column of `operator_credentials`**; `auth_sessions.token_hash`; `device_credentials.current_hash` and `.next_hash`; `pairing_codes.code_hash`; `biometric_tokens.token_hash` |
| NL-2 | The values these hashes are made from (password, `ses_`, `dvc_`, `bio_` values, pairing code, QR payload) are never written to any column and never logged [SP:SR-15, SR-28, SR-48] |
| NL-3 | The hashes reach PostgreSQL only as bind parameters, never inside statement text [SP:SR-67]. A failed statement in the server log then shows `$1`, not the value [PG-16] |
| NL-4 | The Drizzle query logger stays off in every environment, or is replaced by one that prints the statement text without its parameters |
| NL-5 | The PostgreSQL logging settings stay at their defaults (`log_statement = 'none'`, `log_min_duration_statement = -1`, `log_parameter_max_length_on_error = 0`). The scripts under `scripts/pg/` MUST NOT change them: the server log is a file under `.data/` [AN:300] |
| NL-6 | The typed schema exports a public column set for `operators`, `paired_devices`, `auth_sessions`, `pairing_codes` and `biometric_tokens` that leaves the hash columns out; a repository function that feeds an answer or a log uses that set, never `SELECT *` |
| NL-7 | Safe to log as references: `auth_sessions.id`, `biometric_tokens.id` and `family_id`, operator IDs, device IDs, code IDs |
| NL-8 | The reset reads the kept rows, hashes included, into process memory and writes them through bind parameters (section 8.5); it logs table names and row counts only |

### 5.5 No secret in an audit or event payload

Free-form payload columns: `audit_log.details` and `.message`, `events.params` and `.message`, `alerts.params`, `evidence_custody.detail`.

| Guard | What it does | Limit |
|---|---|---|
| `FLAT` (CHECK) | A payload map holds only strings, numbers, booleans and null, so no nested object can carry a request body | Shape only |
| `NO_SECRET_KEYS` (CHECK) | A row whose map has one of 17 key names (`password`, `token`, `code`, `credential`, `username`, ... section 2.4) is refused | A tripwire on key names, not a content scan |
| The writer's rule | A server-native row names no secret [SP:ENG-12; SR-54]; the typed username of a failed sign-in is never recorded (`types.ts:776-777`) | Application |
| The tests | AC-B-28 greps a dump, AC-B-41 scans every audit row and event of the pairing lifecycle | Test |

Checked for this row: none of the denied key names is used today. The keys of audit details in `packages/shared/src/sim/` are `reason`, `method`, `lockedUntil`, `eventKind`, `version`, `slot`, `scope`, `role`, `retryInMs`, `retentionPolicy`, `manifestHash`, `kind`, `index`, `fromState`, `faultKind`, `caseNumber` and 38 others (54 distinct names in single-line detail objects; command: `grep -n -o "details: {[^}]*}" *.ts`, key names counted); the nine new audit types use `operationId`, `permission`, `role`, `reason`, `codeId`, `expiresAt`, `sessionsEnded`, `targetOperatorId`, `from`, `to`, `enabled` [SP:§13.1]. `manifestHash`, `sha256` and `certificateFingerprint` are integrity values, not secrets, and stay allowed.

The deny list exists twice, in the CHECK and as a server constant (proposed name `AUDIT_DETAIL_FORBIDDEN_KEYS`); the vocabulary test of CL-12 compares them.

### 5.6 Atomic state changes

This section is the database half of [RV:SD-04] and [RV:SD-10]. The specification owns where a handler runs: every server-native state change is one unit of work in the serial pipeline, an attempt is consumed before it is verified, and only the password hash is computed outside the pipeline [SP:ENG-23 to ENG-27; SR-72]. This contract owns the statements that ENG-25 refers to. They are written so that the result is right **even if two units ran at the same time**: the database does not rely on the pipeline being serial. No statement of this section has been executed (1.4).

| ID | Rule |
|---|---|
| AT-1 | **One unit, one transaction.** The check, the counted attempt, the transition and the audit row of one state change commit or roll back together, at READ COMMITTED (AP-1) |
| AT-2 | **The chain lock comes first.** The unit starts with AP-2, also when it may end in a refusal that appends nothing. Every audited state change therefore queues at the one head row, in one process or in two (DA-07), before it reads anything it will decide on |
| AT-3 | **Compare-and-set.** A transition is one `UPDATE ... WHERE <key> AND <expected current state> ... RETURNING`. The number of rows returned decides the outcome. The server never decides from a value that an earlier statement read without a lock [PG-24] |
| AT-4 | **Consume, then verify.** A counted attempt is taken by an UPDATE before the presented value is compared, and the value is compared only by the request to which that UPDATE returned a row |
| AT-5 | **Read and advance in one statement.** A counter moves by `UPDATE ... SET next_value = next_value + 1 ... RETURNING`, never by a SELECT followed by an UPDATE (4.11) |
| AT-6 | **No stored lockout counter.** The sign-in lockout (5 failures in 300 s, then 60 s) and the pairing redeem lock (3 failures, then 60 s) are memory state (DA-05; [SP:SR-25]), accepted by the review [RV:§6 GS-05]. AT-4 applies to them in the limiter: one attempt is consumed before the Argon2 computation or the redeem unit starts, and a success clears it [RV:SD-04 (2)]. No table of this contract holds them |

**The five cases.** The review lists four tests under SD-04 (5) and speaks of five in its section 7, as D16 does. The fifth is the lockout rule of SD-04 (2); it is case AT-C1 here, and the specification made the same choice (AC-B-80); the controller confirmed it [DEC:D18].

**AT-C1. Sign-in: the attempt is consumed before the verification.** The counter is memory state (AT-6), so the consuming step has no SQL: it is unit 1 of [SP:ENG-26]. What the database adds is the re-check in unit 2: the hash was computed between the two units, and the operator may have been disabled meanwhile.

```sql
BEGIN;
SELECT seq, hash FROM public.audit_chain_lock();                 -- AT-2
UPDATE operators
   SET last_sign_in_at = $2, updated_at = $2
 WHERE id = $1 AND enabled
RETURNING id;                 -- no row: disabled meanwhile. No session; generic 401; AUTH_FAILED
UPDATE auth_sessions          -- only when a valid session was presented with the sign-in (ID-6)
   SET ended_at = $2, end_reason = 'ROTATED'
 WHERE id = $3 AND ended_at IS NULL
RETURNING id;
INSERT INTO auth_sessions (token_hash, operator_id, device_id, method,
                           issued_at, last_seen_at, absolute_expires_at)
VALUES ($4, $1, $5, $6, $2, $2, $7);
-- AP-4: AUTH_SUCCESS
COMMIT;
```

**AT-C2. A wrong pairing code: exactly five attempts per code.** Two counters are involved. The redeem lock (3 failures, then 60 s; PR-P4) is memory state and is consumed first (AT-6); an attempt that it refuses answers 423 and never reaches the statement below. The count toward closing the code (5; PR-P5) is the column `failed_attempts`, consumed by this statement.

```sql
-- After AT-2 and after the redeem lock let the attempt through.
-- Take one attempt and lock the active code row, before any comparison (AT-4).
UPDATE pairing_codes
   SET failed_attempts = failed_attempts + 1
 WHERE state = 'ACTIVE' AND expires_at > $1 AND failed_attempts < 5
RETURNING id, code_hash, failed_attempts;
-- No row: no usable code. PAIRING_FAILED, 401 INVALID_CODE. Nothing was compared.
-- One row: the server compares (5.2). On a mismatch that returned failed_attempts = 5, close the code:
UPDATE pairing_codes
   SET state = 'EXHAUSTED', closed_at = $1
 WHERE id = $2 AND state = 'ACTIVE' AND failed_attempts = 5
RETURNING id;                 -- PAIRING_FAILED, then PAIRING_CODE_CLOSED (EXHAUSTED)
```

**AT-C3. The right pairing code: redeemed once.**

```sql
-- Same transaction, after the consuming UPDATE of AT-C2 returned the row and the comparison matched.
UPDATE pairing_codes
   SET state = 'REDEEMED', closed_at = $1, failed_attempts = failed_attempts - 1
 WHERE id = $2 AND state = 'ACTIVE' AND expires_at > $1
RETURNING id;                 -- one row; the attempt taken above is given back
UPDATE registry_counters
   SET next_value = next_value + 1
 WHERE name = 'device'
RETURNING next_value - 1;     -- AT-5: the number of the new device
INSERT INTO paired_devices (id, name, platform, app_version, state,
                            paired_at, paired_with_code_id, last_seen_at, updated_at)
VALUES ($3, $4, $5, $6, 'PAIRED', $1, $2, $1, $1);
INSERT INTO device_credentials (device_id, current_hash) VALUES ($3, $7);
-- AP-4: PAIRING_SUCCESS
```

A second redeem of the same code in a concurrent transaction waits on the row that the first one's consuming UPDATE locked, then evaluates `state = 'ACTIVE'` again and gets no row [PG-24]. `paired_devices_paired_with_code_id_key` stays as the last line: a second device for one code fails with SQLSTATE `23505`.

**AT-C4. A biometric token: used once; a reuse ends the sessions of its family.**

```sql
-- After AT-2. $3 is the device that the presented device credential resolved to.
UPDATE biometric_tokens
   SET used_at = $2
 WHERE token_hash = $1 AND device_id = $3
   AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $2
RETURNING id, family_id, operator_id;

-- One row: this request owns the use. Same transaction: the operator re-check of AT-C1,
-- the next token of the family ($5), the session, AUTH_SUCCESS.
INSERT INTO biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at)
VALUES ($4, $5, $3, $6, $2, $7);
INSERT INTO auth_sessions (token_hash, operator_id, device_id, method,
                           issued_at, last_seen_at, absolute_expires_at)
VALUES ($8, $6, $3, 'BIOMETRIC', $2, $2, $9);

-- No row: read why.
SELECT id, family_id, device_id, operator_id, used_at, revoked_at, expires_at
  FROM biometric_tokens
 WHERE token_hash = $1;
-- Unknown, revoked, expired, or presented by another device: generic 401, AUTH_FAILED.
-- used_at is set: TOKEN_REUSE. Revoke the family and end its sessions:
UPDATE biometric_tokens
   SET revoked_at = $2, revoke_reason = 'TOKEN_REUSE'
 WHERE family_id = $5 AND revoked_at IS NULL
RETURNING id;
UPDATE auth_sessions
   SET ended_at = $2, end_reason = 'TOKEN_REUSE'
 WHERE device_id = $10 AND operator_id = $11      -- the device and operator of the reused token
   AND method = 'BIOMETRIC' AND ended_at IS NULL
RETURNING id;                 -- the server sends session.ended to these sessions and closes their sockets
-- AP-4: AUTH_FAILED with details.reason TOKEN_REUSE [SP:§5.6 step 6]
```

The columns the reuse rule needs:

| Need | Column | In revision 1 |
|---|---|---|
| The family of the presented token | `biometric_tokens.family_id` | yes |
| The device and the operator of that family | `biometric_tokens.device_id`, `.operator_id` | yes |
| Which sessions came from a biometric sign-in | `auth_sessions.method = 'BIOMETRIC'` | yes |
| Which of them are open | `auth_sessions.ended_at IS NULL` (index `auth_sessions_active_device_idx`) | yes |
| The reason on the ended sessions | `auth_sessions.end_reason = 'TOKEN_REUSE'` | **new value** (2.4), with `auth_sessions_token_reuse_check` (4.6) |
| The reason on the revoked tokens | `biometric_tokens.revoke_reason = 'TOKEN_REUSE'` | yes |

No column is added. The rule ends the open biometric sessions of the device and the operator, as the review words it [RV:SD-10]. That set contains the sessions the family issued and, when the operator enrolled again on the same device, those of the earlier family: the wider set is the safer one. A password session of the same operator on the same device stays open, and so does every session on another device.

**AT-C5. The last administrator [SP:RB-8].**

```sql
-- After AT-2.
SELECT id, role_id, enabled
  FROM operators
 ORDER BY id
   FOR UPDATE;                -- every operator row, in key order: the lock point of the rule
SELECT role_id FROM role_permissions WHERE permission_id = $5;   -- $5 is USER_ADMIN; a read-only table
-- The server applies the requested change to the locked rows and counts the enabled operators
-- whose role holds USER_ADMIN. None left: ROLLBACK, 409 LAST_ADMIN.
UPDATE operators              -- assignUserRole
   SET role_id = $2, role_changed_at = $3, updated_at = $3
 WHERE id = $1 AND role_id = $4                   -- $4: the role read under the lock
RETURNING id;
UPDATE operators              -- disableUser
   SET enabled = false, updated_at = $3
 WHERE id = $1 AND enabled
RETURNING id;
UPDATE auth_sessions          -- disableUser, same transaction
   SET ended_at = $3, end_reason = 'USER_DISABLED'
 WHERE operator_id = $1 AND ended_at IS NULL
RETURNING id;
UPDATE biometric_tokens       -- disableUser, same transaction
   SET revoked_at = $3, revoke_reason = 'USER_DISABLED'
 WHERE operator_id = $1 AND used_at IS NULL AND revoked_at IS NULL
RETURNING id;
-- AP-4: ROLE_CHANGED or USER_DISABLED
```

The runtime role may lock the rows: it holds UPDATE on five columns of `operators`, and a column-level grant is enough for `FOR UPDATE` [PG-25]. Every row is locked, not only the administrators', so that the second of two concurrent changes reads the committed result of the first [PG-05] without any reasoning about a predicate that the first change altered.

**The other transitions (AT-3).**

| Transition | Statement pattern | No row returned means |
|---|---|---|
| End a session (sign-out, expiry) | `UPDATE auth_sessions SET ended_at = $2, end_reason = $3 WHERE id = $1 AND ended_at IS NULL RETURNING id` | Already ended: no second audit row is written |
| Touch a session | `UPDATE auth_sessions SET last_seen_at = $2 WHERE id = $1 AND ended_at IS NULL AND last_seen_at < $2 RETURNING id` | Ended, or a newer touch exists |
| Cancel the active code, also before a new issue | `UPDATE pairing_codes SET state = 'CANCELLED', closed_at = $1, closed_by_operator_id = $2 WHERE state = 'ACTIVE' RETURNING id` | No active code. The new code is then inserted; `pairing_codes_one_active_key` refuses a second `ACTIVE` row |
| Expire the active code (sweeper) | `UPDATE pairing_codes SET state = 'EXPIRED', closed_at = $1 WHERE state = 'ACTIVE' AND expires_at <= $1 RETURNING id` | Not expired, or closed meanwhile |
| Revoke a device | `UPDATE paired_devices SET state = 'REVOKED', revoked_at = $2, revoked_by_operator_id = $3, revoke_reason = $4, updated_at = $2 WHERE id = $1 AND state = 'PAIRED' RETURNING id` | Not `PAIRED` any more |
| Unpair a device | `UPDATE paired_devices SET state = 'UNPAIRED', unpaired_at = $2, updated_at = $2 WHERE id = $1 AND state = 'PAIRED' RETURNING id` | Not `PAIRED` any more |
| Promote a rotated credential | The UPDATE of 5.2 | Promoted by another request |

**Test ideas.** The database-level tests run on a clone, as `dems_app`, **without** AP-2, so that each statement pattern is proven on its own. The HTTP-level form is the acceptance criterion of the specification named in the last column.

| ID | Case | Database level (row 28 (W17)) | Expected | HTTP level (specification) |
|---|---|---|---|---|
| T-AT-1 | AT-C1 | Two connections: one runs the unit of AT-C1 for an operator, the other disables that operator (AT-C5) and commits first | The sign-in's first UPDATE returns no row; no `auth_sessions` row is inserted | AC-B-80: 20 concurrent wrong-password sign-ins on one console key verify exactly five attempts (five `AUTH_FAILED` rows) and answer 423 to the other 15 (row 32 (W24)) |
| T-AT-2 | AT-C2 | 20 connections run the consuming UPDATE at the same time; each that got `failed_attempts = 5` runs the closing UPDATE. No memory lock is in play at this level | Exactly 5 statements return a row, with the values 1 to 5; 15 return none; the row ends `EXHAUSTED` with `failed_attempts = 5` and `closed_at` set | AC-B-76: of 20 concurrent wrong redeems three are counted and 17 answer 423 (the lock of PR-P4); after the lock a second burst counts two more and the code closes at exactly five. The review's wording, "20 parallel wrong redeems consume exactly five and close the code" [RV:SD-04 (5)], cannot happen in one burst with that lock; the specification flagged it as its conflict CF-1, and the controller ruled that AC-B-76 keeps the accepted parameters [DEC:D18]. The database-level test here is the review's wording, taken literally, for the statement alone (row 36 (W32)) |
| T-AT-3 | AT-C3 | Two connections run AT-C2 and then AT-C3 with the right code at the same time | One gets a row from the consuming UPDATE and redeems; the other gets none. One `paired_devices` row and one `device_credentials` row; the code is `REDEEMED` with the `failed_attempts` it had before; the device counter moved by 1 | AC-B-77: two concurrent redeems of the right code give one 201 and one 401 `INVALID_CODE` (row 36 (W32)) |
| T-AT-4 | AT-C4 | (a) Two connections run the first UPDATE of AT-C4 on one token at the same time. (b) The token is presented again and the reuse statements run, while that operator has an open `BIOMETRIC` session and an open `PASSWORD` session on that device and a `BIOMETRIC` session on another device | (a) One row returned in total; one new token row and one new session row. (b) Every row of the family has `revoked_at` and `TOKEN_REUSE`; the `BIOMETRIC` session of that device and operator has `end_reason = 'TOKEN_REUSE'`; the two other sessions stay open. An UPDATE that ends a `PASSWORD` session with `TOKEN_REUSE` fails on `auth_sessions_token_reuse_check` | AC-B-78: two concurrent uses issue exactly one session; the other use answers 401 and is handled as a reuse. AC-B-82: a reuse ends that biometric session, closes its socket within 1 s, and leaves a password session of the same operator on the same device open (row 32 (W41)) |
| T-AT-5 | AT-C5 | On a clone with exactly two enabled administrators: two connections each run the lock SELECT and then demote a different administrator. Variant: one demotion and one disable | The second waits at the SELECT, then counts one administrator and refuses; afterwards one enabled operator holds `USER_ADMIN` | AC-B-79: two concurrent demotions, one of each holder, give one 200 and one 409 `LAST_ADMIN` (row 35 (W33)) |

---

## 6. Audit table: append-only and chain serialisation

This section answers impact question 14 on the database side; the audit types and their writers are [SP:§13].

### 6.1 What the database guarantees

| # | Guarantee | By |
|--:|---|---|
| G-1 | The runtime role cannot change or remove an audit row | Privileges: `dems_app` holds INSERT and SELECT on `audit_log`, nothing else (6.2) |
| G-2 | While the trigger exists, no role changes or removes an audit row by an UPDATE, DELETE or TRUNCATE statement: not the runtime role, not the owner role, not a superuser, in any session mode | Trigger `audit_log_append_only`, `ENABLE ALWAYS` (6.2, 6.3) |
| G-3 | Rows are numbered 1, 2, 3, ... without a gap, and each row's `prev_hash` is the previous row's `hash` | Trigger `audit_log_chain_guard`, `ENABLE ALWAYS`, against `audit_chain_head` (6.3) |
| G-4 | Two writers can never both extend the same head | The row lock on `audit_chain_head`, taken by the lock function and again by the guard trigger (6.3) |
| G-5 | The chain cannot fork | G-3, and the UNIQUE constraints on `seq`, `prev_hash` and `hash` |
| G-6 | The role that could remove the triggers themselves is not a superuser, and no running process holds a superuser's credentials | Ownership by `dems_owner` (7.2); `dems_admin` at provisioning only (7.1, HC-1); boot checks B-5 and B-9 (7.4) |
| G-7 | A chain that a reset discards leaves a record that later resets cannot remove by a statement, and that the runtime role can neither change nor add to | `audit_chain_history`, carried over by every reset; read-only for `dems_app` by privilege [DEC:D18]; append-only for every role by an `ENABLE ALWAYS` trigger (4.30, 6.6) |

**Not guaranteed by the database:**

1. That `hash` really is `sha256(prev_hash ‖ canonicalJSON(body))`. The database checks the link, not the digest (GD-01; accepted as is by [DEC:D16] and [RV:§6]). The digest is computed by the one shared function (`events.ts:64-66`) and checked by `verifyAuditChain` over the stored rows (operation 60, result `stored`, [SP:L851]).
2. That the owner of the table, or a superuser, does not remove the protection itself by a schema change. G-2 says "while the trigger exists" for that reason. Section 6.2 states exactly who can do what, and what notices it.

### 6.2 Append-only

**Mechanism A (primary): privileges.** The migration `0003_privileges` revokes everything and grants `dems_app` only `SELECT, INSERT ON audit_log` (text in section 8.3). UPDATE, DELETE and TRUNCATE are separate privileges [PG-01]; without them the statement fails with SQLSTATE `42501` before any row is touched. The table is owned by `dems_owner`, so `dems_app` can neither grant itself a privilege nor alter the table.

**Mechanism B (defence in depth): triggers, `ENABLE ALWAYS`.** Privileges do not bind the owner of a table [PG-02], and the owner role `dems_owner` runs the migrations, the seed, the fixture loader and the reset routine. The trigger refuses UPDATE, DELETE and TRUNCATE whoever issues them, so none of those programs can rewrite the trail by mistake. A trigger in the default mode is skipped in a session whose `session_replication_role` is `replica`; the audit triggers are therefore set `ENABLE ALWAYS` [RV:SD-06], which makes them fire in every session mode [PG-21].

**What binds which role.** Revision 1 said that the trigger binds every role and that only "to drop or disable the trigger" is left to the owner. For a superuser that was not complete [RV:SD-01]. The exact statement:

| Action on `audit_log` (and on `audit_chain_history`) | `dems_app` (runtime) | `dems_owner` (owner; not a superuser) | `dems_admin` (superuser; provisioning only) |
|---|---|---|---|
| UPDATE, DELETE, TRUNCATE | Refused by privilege, `42501`, before any trigger | Not bound by privilege. **Refused by the trigger**, `ZA002` | Not bound by privilege. **Refused by the trigger**, `ZA002` |
| The same after `SET session_replication_role = replica` | Cannot set it, `42501` [PG-22] | Cannot set it, `42501` [PG-22] | Can set it. The triggers are `ENABLE ALWAYS` and **still fire**, `ZA002` [PG-21]. In revision 1 they would have been skipped |
| INSERT into `audit_log` of a row that does not continue the head | Refused by the guard, `ZA001` | The same | The same, in every session mode |
| INSERT into `audit_chain_history` | Refused by privilege, `42501`: the runtime role only reads the lineage [DEC:D18] | Allowed. Only the reset routine does it (LN-1) | Allowed |
| A schema change that removes the protection: `ALTER TABLE ... DISABLE TRIGGER`, `DROP TRIGGER`, `CREATE OR REPLACE` of a trigger function, `DROP TABLE`, a GRANT to `dems_app` | Refused: not the owner, `42501` | **Not refused.** The owner of a table may change it. No program of this project issues such a statement (T-AO-4), and the result is noticed as listed below | **Not refused.** Nothing in a database binds a superuser |
| `DROP DATABASE` of a project database, which discards the whole chain | Refused, `42501` | Allowed. This is the reset (8.5); it leaves a lineage row (4.30) and the `SCENARIO_LOADED` row of the new chain | Allowed |
| Changing server settings, `pg_hba.conf` or the files of the data directory through SQL | No | No: not a superuser (**hypothesis**: `ALTER SYSTEM` and a per-database override of a logging setting are refused with `42501`; trial step T5-i of 7.1) | Yes |

Two consequences:

- **Against the owner role**, the trigger protects from mistakes and from every statement that is not a schema change. A schema change by the owner is noticed by boot checks B-5 and B-9 at the next start (triggers present and `'A'`, privileges of the runtime role, ownership), by step R-6 before a reset swaps a database in, and by the catalog test of row 28 (W17) at every gate. A trigger function whose body was replaced keeps its name and its `'A'`; only the catalog test, which compares `pg_get_functiondef` with the migration text, notices that.
- **Against a superuser**, no database feature holds. What holds is outside the database: `dems_admin` is used at provisioning only, its password file is read by `scripts/pg/` and by nothing else, and the running server never holds its credentials (7.1, HC-1; 7.6). With `ENABLE ALWAYS` a superuser session can no longer skip the triggers by a setting ([PG-21], a **hypothesis** until trial step T5-j has run at provisioning); it would have to change the schema, which the checks above notice.

The only way the content of an audit table disappears is the reset, which drops the whole old database after building a new one (section 8.5; [SP:DC-8]).

The same privilege pattern (INSERT and SELECT only, no trigger) makes `events`, `session_history`, `evidence_tracks`, `evidence_custody`, `exports` and `health_snapshots` append-only for the runtime role. `audit_chain_history` is stricter on both counts: SELECT only for the runtime role, **and** the trigger for every role (4.30).

### 6.3 Statements (migration `0002_audit_guards`)

Not executed (section 1.4). Row 28 (W17) copies these statements into the hand-written migration file.

```sql
-- 1. The chain head: one row, the genesis state of an empty log (constants.ts:44).
INSERT INTO public.audit_chain_head (singleton, seq, hash)
VALUES (true, 0, repeat('0', 64));

-- 2. The lock a writer takes before it computes a row. It returns the head it must extend.
CREATE FUNCTION public.audit_chain_lock()
RETURNS TABLE (seq bigint, hash text)
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT h.seq, h.hash
    FROM public.audit_chain_head AS h
   WHERE h.singleton
     FOR UPDATE
$$;

-- 3. The guard: every inserted row must continue the head; the head then moves.
CREATE FUNCTION public.audit_log_guard_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  head_seq  bigint;
  head_hash text;
BEGIN
  SELECT h.seq, h.hash INTO STRICT head_seq, head_hash
    FROM public.audit_chain_head AS h
   WHERE h.singleton
     FOR UPDATE;
  IF NEW.seq <> head_seq + 1 OR NEW.prev_hash <> head_hash THEN
    RAISE EXCEPTION 'audit chain: row % does not continue head %', NEW.seq, head_seq
      USING ERRCODE = 'ZA001';
  END IF;
  UPDATE public.audit_chain_head SET seq = NEW.seq, hash = NEW.hash WHERE singleton;
  RETURN NEW;
END
$$;

CREATE TRIGGER audit_log_chain_guard
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_guard_insert();

-- 4. Append-only for every role.
CREATE FUNCTION public.audit_log_refuse_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % refused', TG_OP
    USING ERRCODE = 'ZA002';
END
$$;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_refuse_change();

-- 5. The lineage of discarded chains is append-only for every role, by the same mechanism.
CREATE FUNCTION public.audit_chain_history_refuse_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_chain_history is append-only: % refused', TG_OP
    USING ERRCODE = 'ZA002';
END
$$;

CREATE TRIGGER audit_chain_history_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_chain_history
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_chain_history_refuse_change();

-- 6. The three triggers fire in every session mode: a session that sets
--    session_replication_role = replica does not skip them.
ALTER TABLE public.audit_log           ENABLE ALWAYS TRIGGER audit_log_chain_guard;
ALTER TABLE public.audit_log           ENABLE ALWAYS TRIGGER audit_log_append_only;
ALTER TABLE public.audit_chain_history ENABLE ALWAYS TRIGGER audit_chain_history_append_only;
```

| Point | Explanation |
|---|---|
| Why two `SECURITY DEFINER` functions | Locking a row needs UPDATE privilege [PG-04], and the head must move, but `dems_app` holds only SELECT on `audit_chain_head`. The two functions run with the owner's right, take no argument that reaches a statement, contain no dynamic SQL, and pin `search_path`. The owner is `dems_owner`, so they run **without superuser rights** [RV:SD-01]; boot check B-9 refuses a database in which they belong to another role |
| `ENABLE ALWAYS` | Statement group 6 [RV:SD-06]. `pg_trigger.tgenabled` is `'A'` for the three triggers; boot check B-5 expects exactly that. The statements are part of the migration, so every clone and every database built by a reset has them (R-6 checks it before the swap) |
| The lineage trigger | Statement group 5: the same refusal, the same SQLSTATE `ZA002`, on `audit_chain_history`. INSERT is not restricted by a trigger there but by privilege: the runtime role holds none (7.3), and the reset routine, as the owner, is the only writer (6.6) |
| Why the guard locks again | A writer that did not call `audit_chain_lock()` still cannot fork the chain: its INSERT waits on the head row until the other transaction ends, then reads the committed head [PG-05] and is refused when it no longer continues it |
| SQLSTATE values | `ZA001` chain discontinuity; `ZA002` change of an append-only table refused (`audit_log` or `audit_chain_history`; the message names the table). Both are outside the classes PostgreSQL uses [PG-07]. The server maps either to a commit failure [SP:ENG-5] and one log line |
| What is not checked | Time order of `at` (the shared `recordActivity` keeps it, `events.ts:286-294`; a database rule could refuse a legitimate row of a path that calls `appendActivity` directly) and the digest (GD-01) |
| One row per statement | AP-4. A multi-row INSERT fires the guard once per row in an order that is not guaranteed [PG-18]; the contract does not rely on it |

### 6.4 The append protocol

One protocol for every writer: the engine pipeline, the seed, the reset routine, the bulk fixture and the tests.

| ID | Rule |
|---|---|
| AP-1 | An append runs in a transaction at READ COMMITTED (the default). REPEATABLE READ and SERIALIZABLE are not used for appends: there a stale head fails with a serialisation error instead of waiting |
| AP-2 | The first statement of a transaction that will append is `SELECT seq, hash FROM public.audit_chain_lock();`. It blocks while another writer holds the head and returns the head to extend |
| AP-3 | The writer builds each row with the shared code: `seq = head.seq + 1`, `id = auditId(seq)`, `prevHash = head.hash`, `hash = chainHash(prevHash, body)` (`events.ts:64-66, 112-146`) |
| AP-4 | One `INSERT INTO public.audit_log (...) VALUES (...)` per row, in ascending `seq`, with bind parameters |
| AP-5 | Other rows of the same unit of work (events, session, evidence, counters) follow in the same transaction; `COMMIT` releases the lock [PG-06] |
| AP-6 | **Engine pipeline.** The engine has already built the rows in memory with `appendActivity` [SP:ENG-8]. The head returned by AP-2 MUST equal the head the engine last committed. If it differs, another writer exists (DA-07): the transaction is rolled back, the engine state is set back, the command answers 503 [SP:ENG-5], and the server logs `audit head diverged` with both sequence numbers |
| AP-7 | A transaction that appends takes the chain lock **before** it writes any other table, so two writers can never wait on each other in opposite order |

The statement sequence of one unit of work:

```sql
BEGIN;                                              -- READ COMMITTED
SELECT seq, hash FROM public.audit_chain_lock();    -- AP-2: wait here, then read the head
INSERT INTO public.audit_log (seq, id, at, type, category, severity, actor_id, message,
                              session_id, evidence_id, device_id, details, prev_hash, hash)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);   -- AP-4, once per row
-- AP-5: events, records, counters of the same unit of work
COMMIT;                                             -- the head row lock is released
```

Why this closes edge case E12 [BP:178]: an engine tick and a request handler both pass the one pipeline [SP:ENG-1, ENG-6], and even two processes on one database would queue at AP-2.

### 6.5 Test ideas

| ID | Mechanism | Test | Expected |
|---|---|---|---|
| T-AO-1 | Append-only by privilege | As `dems_app` on a seeded clone: `UPDATE audit_log SET message = 'x' WHERE seq = 1`; `DELETE FROM audit_log WHERE seq = 1`; `TRUNCATE audit_log` | Each fails with SQLSTATE `42501`; the table checksum (section 9.6) is unchanged; `has_table_privilege('dems_app', 'public.audit_log', 'UPDATE')` and the same for `DELETE` and `TRUNCATE` are false |
| T-AO-2a | Append-only by trigger, owner role | The same three statements as `dems_owner`, and an `UPDATE ... WHERE false` | Each fails with `ZA002`; the checksum is unchanged |
| T-AO-2b | The owner role cannot switch the session mode | As `dems_owner`: `SET session_replication_role = replica` | Fails with `42501` [PG-22]. **Hypothesis** until row 23 (W07; T5-f) and row 28 (W17) run it |
| T-AO-2c | `ENABLE ALWAYS` holds against a superuser session | **A check of `scripts/pg/`, run at provisioning** as trial step T5-j (7.1): CONFLICT-2, decided [DEC:D19]. It is not part of `test:db`, and nothing under `apps/core-server/` reads the superuser's password file. The real triggers do not exist at provisioning (row 28 (W17) writes them), so the step uses a scratch table in a trial database with a refusal trigger of the same text as statement group 4 of 6.3. As the bootstrap superuser: set the trigger `ENABLE ALWAYS`; `SET session_replication_role = replica`; `UPDATE`, `DELETE` and `TRUNCATE` on the scratch table. Then set the trigger back to the default mode and repeat the `UPDATE` | With `ENABLE ALWAYS`: `ZA002` three times. In the default mode the `UPDATE` succeeds, which shows that the setting skips an ordinary trigger and that `ALWAYS` is what holds [PG-21]. **Hypothesis** until row 23 (W07) runs it. That the real triggers carry the mode is T-AO-2d, in `test:db`, with no superuser |
| T-AO-2d | The triggers are `ENABLE ALWAYS` | `SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid IN ('public.audit_log'::regclass, 'public.audit_chain_history'::regclass) AND NOT tgisinternal` | Three rows: `audit_log_chain_guard`, `audit_log_append_only`, `audit_chain_history_append_only`, each `'A'` |
| T-AO-3 | The lineage table is read-only for the runtime role and append-only for the owner | On a clone with one lineage row. As `dems_app`: an `INSERT INTO audit_chain_history (...)` of a well-formed row; `UPDATE audit_chain_history SET scenario = 'idle'`; `DELETE FROM audit_chain_history`; `TRUNCATE audit_chain_history`. As `dems_owner`: the same UPDATE, DELETE and TRUNCATE | `42501` four times for `dems_app` (the INSERT included, [DEC:D18]; this is the last clause of AC-B-87); `ZA002` three times for `dems_owner`; the table checksum is unchanged; `has_table_privilege('dems_app', 'public.audit_chain_history', 'INSERT')` is false |
| T-AO-4 | No program of the project removes the protection | A static search of `apps/core-server/` and `scripts/` for `DISABLE TRIGGER`, `DROP TRIGGER`, `session_replication_role`, `ALTER SYSTEM`, for `CREATE OR REPLACE` outside the migration folder, and for `DROP DATABASE` | No match for the first five, except `session_replication_role` in the trial of `scripts/pg/` (T5-f, T5-j) and in the tests that expect its refusal (T-AO-2b, T-PV-2). `DROP DATABASE` occurs in the reset routine, in the test helper and in the trial of `scripts/pg/`, and nowhere else (LN-6) |
| T-CH-1 | Chain serialisation | 50 tasks on at least 10 connections of `dems_app` each run AP-1 to AP-5 for one row, with a random pause of 0 to 20 ms between the lock and the INSERT | 50 commits, no error, no retry; `seq` runs without a gap; `audit_chain_head` equals the last row; the shared `verifyAuditChain` over all rows read back is `ok` (this is AC-B-54 and the check of row 31 (W21), [BP:304]) |
| T-CH-2 | Chain guard | Two connections read the head with a plain SELECT (no lock), both build row n+1, both INSERT. Then: a row with `seq = head + 2`; a row with the right `seq` and a wrong `prev_hash` | Exactly one of the two commits; the other fails with `ZA001`; the gap row and the wrong-link row fail with `ZA001`; the table is unchanged by the failures |
| T-CH-3 | Chain head cannot be moved by the runtime role | As `dems_app`: `UPDATE audit_chain_head SET seq = 0`; `SELECT ... FROM audit_chain_head FOR UPDATE` | Both fail with `42501` |

### 6.6 The reset and the chain

A reset or a scenario load starts a new chain in a new database; the old database, with its audit table, is dropped as a whole by the owner role `dems_owner` after the new one is complete (section 8.5). No UPDATE, DELETE or TRUNCATE touches an audit row at any point. The reset is the one deliberate exception to append-only, accepted by the review with two improvements: the role that performs it (7.1) and a durable lineage [RV:§5.6; R-08].

The discarded chain leaves three traces:

| Trace | Where | Survives the next reset |
|---|---|---|
| The `SCENARIO_LOADED` row, the first row after the seed history of the new chain, with the details `previousHead` and `previousRows` [SP:§12.4; DC-7; SR-56] | `audit_log` of the new database | No: it is part of a chain that the next reset discards |
| **One row of `audit_chain_history`** (4.30): head hash, row count, first and last sequence, time, operator, reason, scenario, epoch | The new database, and every database after it | **Yes**: the table is carried over by every reset [DEC:D16]; [RV:SD-19] |
| One server log line with the same values | `.data/` or the terminal | It is process output, not a record |

Rules for the lineage:

| ID | Rule |
|---|---|
| LN-1 | **Writer.** Only the reset routine writes the table, as `dems_owner`, in the transaction that builds the new database (R-5). The runtime role holds no INSERT privilege on it [DEC:D18]. It first inserts the carried rows unchanged, in `reset_no` order, then one new row with `reset_no` = the highest carried value plus 1 (1 when none was carried). No row is written when nothing was discarded: a first build, or an old database with an empty audit log |
| LN-2 | **Values.** The new row holds what R-3 read from the old database in one `REPEATABLE READ` transaction: `audit_chain_head.hash` and `.seq`, `min(seq)` and `count(*)` of `audit_log`, and `core_state.epoch` (the epoch the chain ended in); and what the caller supplied: `now`, the operator (NULL from the command line), the reason, the scenario |
| LN-3 | **Agreement with the new chain.** The `head_hash` and `row_count` of the newest lineage row equal `previousHead` and `previousRows` of the `SCENARIO_LOADED` row that the same transaction appends. R-6 checks it before the swap. Afterwards anyone can check it: `SELECT seq FROM audit_log WHERE type = 'SCENARIO_LOADED' AND details ->> 'previousHead' = $1` (index `audit_log_type_seq_idx`) returns one row for the newest lineage entry |
| LN-4 | **Reader.** The runtime role holds SELECT and no other privilege on the table. `verifyAuditChain` (operation 60) reads the table with `SELECT reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason, scenario FROM audit_chain_history ORDER BY reset_no DESC LIMIT 20`, served by the primary key, and `SELECT count(*) FROM audit_chain_history` for the total. The Security & Audit page shows what that operation returns; it has no query of its own. `db:status` prints the count and the newest entry |
| LN-5 | **The answer** is the specification's: `AuditChainStatus.lineage`, a list of `AuditChainLineageEntry` (`epoch`, `rows`, `head`, `resetAt`, `actorId`, `scenario`, `reason`), newest first, at most 20, and `lineageTotal` [SP:§7.13, §7.18; DC-10]. The column that feeds each member is in 4.30. Every signed-in role may read it; no column is a secret. Two things this contract stores and the answer does not carry today: `first_seq` and `last_seq`, and the result of the check of LN-3 (15.4) |
| LN-6 | **Limit of the record.** The lineage is written by the role that discards the chain. It records; it does not prove. A project database dropped by `dems_owner` outside the routine would leave no row. `DROP DATABASE` appears in two places of the sources only, the reset routine and the test helper (T-AO-4 extends to it), and the helper cannot name a project database (TI-3). Recorded as GD-14 |

---

## 7. Roles and privileges

### 7.1 Roles

Three roles [DEC:D16, DR-03]; [RV:SD-01, §5.2 option (a)]. This amends the two roles of [AN:273] and closes GD-02 of revision 1.

| Role | Attributes | Used by | Never used by | Created by |
|---|---|---|---|---|
| `dems_admin` | The role `initdb` creates: cluster superuser [AN:296]. It owns the cluster, the maintenance database `postgres` and the two template databases of PostgreSQL. It owns **no** project database and **no** project object | `scripts/pg/` only, **at provisioning**: `initdb` (through its password file), the creation of the two other roles (RP-3), and the one trial step that needs a superuser, T5-j (the trigger check of [RV:SD-06]; CONFLICT-2, decided by [DEC:D19]). Removal needs no connection | The server, in any mode; the `db:*` commands; the test helper and every test of `test:db`; any file under `apps/` or `packages/` | Row 23 (W07; `initdb -U dems_admin`) |
| `dems_owner` | `LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; member of no role, and no role is a member of it | `db:create`, `db:migrate`, `db:seed`, `db:reset`, `db:status` (C-5 of [SP:§2.1]); the test helper and the fixture loader (section 10); the reset routine inside the server, in connections opened only for that routine and only with the demo flag on [SP:DC-5; SR-58] | The server's connection pool; the code under test | `scripts/pg/` at provisioning (RP-3), connected as `dems_admin` |
| `dems_app` | `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; member of no role. Its privileges are those of revision 1 (7.3) | The server's connection pool (C-4), always; the code under test | — | `scripts/pg/` at provisioning (RP-3), connected as `dems_admin`. No longer by `db:create` |

**Role provisioning.** Command names are the plan's (`pg:init`, [PL:§3.4]); the steps are this contract's, and the plan's work row W07 follows them.

| ID | Step |
|---|---|
| RP-1 | `.data/` exists with mode 0700, after `git check-ignore` matched it [SP:SR-60]. Three passwords are generated, each from at least 24 bytes of `crypto.randomBytes`, written as base64url [AN:295]; [RV:SD-15 (e)], into the three files of 7.6, each created exclusively and with mode 0600. Nothing is printed |
| RP-2 | `initdb -U dems_admin -A scram-sha-256 --pwfile=<path>` [AN:296]. The password travels as a file path, never as an argument value (CR-4) |
| RP-3 | After the first start the script connects to `postgres` as `dems_admin` and creates the two roles, each only when `pg_roles` has no such row: `CREATE ROLE dems_owner LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '...'` and `CREATE ROLE dems_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '...'`. A utility statement takes no bind parameter [PG-19], so the password read from the file is placed in the statement as a literal escaped by the driver. The existence check comes first, so the statement cannot fail for that reason and reach the server log; with the default logging (NL-5) a statement that succeeds is not logged. The script prints neither the statement nor a password |
| RP-4 | The host-authentication check HA-1 to HA-4 (7.6) |
| RP-5 | The trial steps below: all connected as `dems_owner`, except T5-j, for which the script opens one more superuser connection, to the trial database, and closes it when the step ends |
| RP-6 | Every superuser connection is closed. From here on nothing connects as `dems_admin`, except a repeat of this script (RP-3 to RP-5 are idempotent). No use of the superuser remains after provisioning |

**Trial steps for row 23 (W07)**, added to steps T3 and T5 of the provisioning trial [AN:330-341] by [RV:§5.2 item 5] and [RV:SD-15 (d)], and T5-j by [RV:SD-06] with the ruling on CONFLICT-2 [DEC:D19]. Each expectation is a **hypothesis** until the step has run. The databases `dems_trial_a` and `dems_trial_b` exist only during the trial.

| Step | As | Statement or action | Pass | Proves |
|---|---|---|---|---|
| T3-a | `scripts/pg/`, by reading the file | HA-1 to HA-3 on `.data/postgres/pg_hba.conf` | No `trust` line; loopback addresses only; `scram-sha-256` on every line | PG-28 |
| T3-b | A client | A connection as `dems_app` with a wrong password | Refused, SQLSTATE `28P01` | PG-28 |
| T5-a | `dems_owner`, on `postgres` | `CREATE DATABASE dems_trial_a OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` | Success | PG-23; DA-11; DA-12 |
| T5-b | `dems_owner` | `CREATE DATABASE dems_trial_b TEMPLATE dems_trial_a OWNER dems_owner` | Success | PG-23; TI-6 |
| T5-c | `dems_owner` | `BEGIN; ALTER DATABASE dems_trial_b RENAME TO dems_trial_c; ALTER DATABASE dems_trial_c RENAME TO dems_trial_b; COMMIT;` | Success | DA-04; PG-09 |
| T5-d | `dems_owner` | `ALTER DATABASE dems_trial_a WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`, then back | Success | TI-5 |
| T5-e | `dems_owner` | `DROP DATABASE dems_trial_b` (and `dems_trial_a` after T5-h) | Success | PG-23 |
| T5-f | `dems_owner` | `SET session_replication_role = replica` | Fails with `42501` | PG-22 |
| T5-g | `dems_owner` | `CREATE ROLE dems_trial_role` | Fails with `42501` | PG-23 |
| T5-h | `dems_owner`, while one `dems_app` session is open on `dems_trial_a` | `SELECT datname, usename FROM pg_stat_activity WHERE datname = 'dems_trial_a'`; then `DROP DATABASE dems_trial_a WITH (FORCE)` | The SELECT shows the session. The outcome of the drop is **recorded**, whichever it is; it decides the wording of TI-10 | PG-26; PG-27 |
| T5-i | `dems_owner` (added by this contract, not by the review) | `ALTER SYSTEM SET log_statement = 'all'`; `ALTER DATABASE dems_trial_a SET log_statement = 'all'` | Both fail with `42501` | The owner role cannot turn on statement logging (NL-5) |
| T5-j | **`dems_admin`**, on `dems_trial_a`, after T5-d and before T5-h; its session is closed before T5-h. The only trial step that runs as the superuser (CONFLICT-2, decided by [DEC:D19]) | The check T-AO-2c of 6.5: a scratch table with a refusal trigger of the text of 6.3 (statement group 4), set `ENABLE ALWAYS`; `SET session_replication_role = replica`; `UPDATE`, `DELETE`, `TRUNCATE`. Then the trigger back in the default mode and the `UPDATE` again. The scratch table goes with the trial database | `ZA002` three times with `ENABLE ALWAYS`; the `UPDATE` succeeds in the default mode | PG-21; [RV:SD-06] |

If T5-a to T5-e fail, DA-11 is wrong and the row stops for a controller decision. The superuser is not put back into the commands or the server to work around it. If T5-j fails (the triggers are skipped although they are `ENABLE ALWAYS`), PG-21 is wrong and guarantee G-2 does not hold against a superuser session; the row reports it, and the protection then rests on HC-1 alone.

**What the running server may hold.**

| ID | Rule |
|---|---|
| HC-1 | The server process never reads `.data/pg.pwfile` and never connects as `dems_admin`, in any mode. No file under `apps/core-server/` names that file (static test T-CR-2) |
| HC-2 | With the demo flag off the server reads `.data/pg.env` and no other credential file. It does not open `.data/pg.owner.env`. `resetDemo` and `loadScenario` answer 403 `DEMO_DISABLED` before any file is read [SP:DC-2] |
| HC-3 | With the demo flag on the server **may hold the credentials of `dems_owner` for the duration of one reset routine**: the routine reads `.data/pg.owner.env` at R-0, keeps the values in a local variable, opens its owner connections, closes them at R-9 and returns. The values are not placed in the configuration object, in `process.env`, in a log line or in an error message |
| HC-4 | The application's pool is `dems_app` at every moment: before a reset, after it, and closed during it [SP:DC-5] |
| HC-5 | What a compromised server could do as `dems_owner` while the flag is on: drop or replace a project database, change a project table, disable a trigger, grant a privilege. What it could not do: skip an `ENABLE ALWAYS` trigger by a session setting, create a role, become a superuser, change a server setting, touch `postgres` or a template of PostgreSQL. This is what remains of GD-02 after D16 (13.2) |

The separation is a rule about what the programs do, enforced by tests. It is not an operating-system boundary: every project process runs under the user's own uid and could open any of the three files. A hostile local process with that uid is outside the boundary [RV:§1.4].

### 7.2 Ownership and schema-level rules

| ID | Rule |
|---|---|
| OW-1 | Every database of this project (`dems_demo`, `dems_lane_1..3`, every `dems_test_*`, every `<name>_next` and `<name>_prev`) is created by and owned by `dems_owner`: `CREATE DATABASE ... OWNER dems_owner` [RV:§5.2 item 2]. `dems_admin` owns none of them |
| OW-2 | Every table, index, function and trigger is created by the migrations under `dems_owner` and owned by it. `dems_app` owns nothing, so it cannot ALTER, DROP, GRANT or disable a trigger. A project object owned by a superuser is a defect: the two `SECURITY DEFINER` functions would then run with superuser rights. Boot check B-9 looks for it |
| OW-3 | `0003_privileges` revokes all privileges on schema `public` from `PUBLIC` and grants `dems_app` only USAGE. `dems_app` cannot create an object [PG-15]. `dems_owner` may issue these statements because it owns the database [PG-15] |
| OW-4 | EXECUTE on every function of schema `public` is revoked from `PUBLIC` [PG-17]; `dems_app` gets EXECUTE on `audit_chain_lock()` and on `dems_jsonb_is_flat(jsonb)` only |
| OW-5 | `dems_app` has no privilege on schema `drizzle` (the migrator's bookkeeping) |
| OW-6 | No `ALTER DEFAULT PRIVILEGES`: each migration that adds a table grants its privileges explicitly (MG-6), and T-PV-1 compares the whole matrix |
| OW-7 | Table privileges are part of the database and are copied into a clone [PG-10], so a test database has the same matrix as `dems_demo` without a second grant step |
| OW-8 | The grants of `0003_privileges` name `dems_app`, so the role must exist before a migration runs. Both roles are created at provisioning (RP-3); `db:create` and `db:migrate` check `pg_roles` for both and stop with a message that names `pg:init` when one is missing. No `db:*` command creates a role: `dems_owner` has `NOCREATEROLE` |
| OW-9 | Neither project role is a member of another role, and no database-level or role-level setting is stored for them (`pg_db_role_setting` has no row of this project) |

### 7.3 Privilege matrix (table by role)

Three roles, three different relations to a table:

- **`dems_owner`** (column "owner"): owner of every table, with every privilege that ownership implies. It is bound by the three triggers of section 6 and by nothing else; what it could still do is in 6.2.
- **`dems_app`**: S = SELECT, I = INSERT, U = UPDATE on the listed columns, D = DELETE. **TRUNCATE, REFERENCES and TRIGGER are granted on no table.** The privileges are those of revision 1; the only new line is the lineage table.
- **`dems_admin`** is not in the matrix. Privileges do not apply to a superuser, and the role holds no grant of this project. It is not used after provisioning (7.1).

| Table | owner (`dems_owner`) | `dems_app` S | I | U (columns) | D |
|---|---|:-:|:-:|---|:-:|
| `roles`, `permissions`, `role_permissions` | owner | yes | — | — | — |
| `operators` | owner | yes | — | `role_id`, `enabled`, `last_sign_in_at`, `role_changed_at`, `updated_at` | — |
| `operator_credentials` | owner | yes | — | `algorithm`, `memory_kib`, `passes`, `parallelism`, `salt`, `hash`, `hashed_at` | — |
| `auth_sessions` | owner | yes | yes | `last_seen_at`, `ended_at`, `end_reason` | — |
| `pairing_codes` | owner | yes | yes | `state`, `failed_attempts`, `closed_at`, `closed_by_operator_id` | — |
| `paired_devices` | owner | yes | yes | `state`, `last_seen_at`, `revoked_at`, `revoked_by_operator_id`, `revoke_reason`, `unpaired_at`, `updated_at` | — |
| `device_credentials` | owner | yes | yes | `current_hash`, `next_hash`, `rotated_at` | — |
| `biometric_tokens` | owner | yes | yes | `used_at`, `revoked_at`, `revoke_reason` | — |
| `registry_counters` | owner | yes | — | `next_value` | — |
| `audit_log` | owner; UPDATE, DELETE, TRUNCATE refused by trigger | yes | yes | — | — |
| `audit_chain_head` | owner | yes | — | — (moved only by the guard trigger) | — |
| `events` | owner | yes | yes | — | — |
| `active_session` | owner | yes | yes | all columns | **yes** |
| `session_history` | owner | yes | yes | — | — |
| `evidence_items` | owner | yes | yes | `status`, `lifecycle_stage`, `verification_status`, `verification_at`, `tampered`, `tampered_track_id`, `updated_at` | — |
| `evidence_tracks` | owner | yes | yes | — | — |
| `evidence_custody` | owner | yes | yes | — | — |
| `exports` | owner | yes | yes | — | — |
| `alerts` | owner | yes | yes | `active`, `acknowledged`, `resolved_at` | — |
| `storage_policy` | owner | yes | — | `retention_policy`, `retention_days`, `auto_archive`, `updated_at` | — |
| `console_settings` | owner | yes | — | `presentation_mode`, `time_format`, `notify_warnings`, `notify_sound`, `updated_at` | — |
| `engine_counters` | owner | yes | yes | `next_value` | — |
| `core_device` | owner | yes | — | `software_version`, `core_software_version`, `updated_at` | — |
| `core_state` | owner | yes | — | `epoch`, `last_sealed_session_id`, `last_sealed_acknowledged`, `updated_at` | — |
| `hardware_snapshot` | owner | yes | — | the 15 slice columns and `written_at` | — |
| `health_snapshots` | owner | yes | yes | — | — |
| `schema_meta` | owner | yes | — | — | — |
| `audit_chain_history` | owner: INSERT by the reset routine only; UPDATE, DELETE, TRUNCATE refused by trigger | yes | — | — | — |

**The lineage table is read-only for the runtime role** [DEC:D18, D19]. `dems_app` holds SELECT on `audit_chain_history` and nothing else; rows are appended only by the reset routine, under `dems_owner` (LN-1). This was CONFLICT-1 of revision 2, which had granted INSERT as well; the controller ruled that D16's phrase "covered by the same privileges" meant the same trigger protection, not INSERT for the runtime role. The contract now agrees with the review [RV:SD-19 (i)] and with the specification [SP:E-26; DC-6; SR-78; AC-B-87], and a runtime that was taken over cannot append a false lineage row.

What the matrix turns into database rules:

| Specification rule | Missing privilege of `dems_app` |
|---|---|
| The matrix is read-only [SP:RB-9] | No INSERT, UPDATE or DELETE on `roles`, `permissions`, `role_permissions` |
| No operation creates or deletes a user [SP:L749] | No INSERT or DELETE on `operators`; no UPDATE on identity columns |
| Sealed evidence is never silently changed: tracks, track hashes, manifest hash, signature (I11, [SP:L805; SR-59]) | No UPDATE on `evidence_tracks`; no UPDATE on `manifest_hash`, the signature columns, sizes, times and subject columns of `evidence_items` |
| Custody entries and exports are records | INSERT and SELECT only |
| The reset cannot be performed by the runtime role [SP:SR-58] | `NOCREATEDB`; not the owner of any database |
| The lineage of discarded chains cannot be rewritten or extended by the running server [DEC:D16, D18] | No INSERT, UPDATE, DELETE or TRUNCATE on `audit_chain_history`; the trigger refuses the last three for the owner as well |

### 7.4 What the server checks at boot

The server connects as `dems_app`, runs these checks in order, and **refuses to start** (non-zero exit, one log line naming the check, no listener) when one of B-1 to B-7 or B-9 fails [SP:§8.6 "Start"]. B-8 is reported, not blocking. Every statement below is one that the runtime role may run: the catalogs it reads are readable by every role. The server never applies a migration at start, and its runtime role never can [DEC:D13]; the one place where code inside the server process applies migrations is the reset routine, which builds the new database as `dems_owner` (R-5a).

| ID | Check | Statement | Pass |
|---|---|---|---|
| B-1 | The database answers | a connection and `SELECT 1` | success |
| B-2 | Server version and encoding | `SHOW server_version_num`, `SHOW server_encoding` | major version 18; `UTF8` |
| B-3 | **Schema version** | `SELECT schema_version, contract_revision FROM schema_meta` | Equals the constant in the server code (proposed name `DB_SCHEMA_VERSION`, value 1). The failure message names both numbers and the migrate command |
| B-4 | The runtime role is not privileged | `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = current_user` | `rolname` is `dems_app`; all five flags false. A pool that was configured with the owner role fails here (`rolcreatedb` is true) |
| B-5 | The audit table and the lineage table are protected | `has_table_privilege(current_user, t, p)` for `p` in `UPDATE`, `DELETE`, `TRUNCATE` and `t` in `public.audit_log`, `public.audit_chain_history`; the same for `INSERT` on `public.audit_chain_history` [DEC:D18]; the same for `UPDATE` on `public.audit_chain_head`; and `SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid IN ('public.audit_log'::regclass, 'public.audit_chain_history'::regclass) AND NOT tgisinternal` | Every privilege false. Exactly three triggers, `audit_log_chain_guard`, `audit_log_append_only` and `audit_chain_history_append_only`, each with `tgenabled = 'A'` [RV:SD-06]. Revision 1 expected `'O'` |
| B-6 | The database is seeded | `SELECT count(*) FROM core_state` | 1. Otherwise the message names the seed command |
| B-7 | The chain head agrees with the table | `SELECT h.seq, h.hash, (SELECT max(seq) FROM audit_log), (SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1) FROM audit_chain_head h` | `h.seq` equals the maximum (or both mean "empty") and the hashes are equal |
| B-8 | The stored chain verifies (reported only) | The shared check over the newest 1,000 rows while the ring is rebuilt (MR-4); the whole table is checked on demand by operation 60. The lineage check of LN-3 is reported with it | `ok`. A failure is logged as an error and shown by `verifyAuditChain` (`stored`); the server still starts, because it cannot repair a stored row in any case (GD-01) |
| B-9 | **The owner role is not a superuser, and it owns the guarded objects** [RV:§5.2 item 3] | `SELECT rolsuper, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = 'dems_owner'`; `SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()`; `SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid IN ('public.audit_log'::regclass, 'public.audit_chain_head'::regclass, 'public.audit_chain_history'::regclass)`; `SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid IN ('public.audit_chain_lock()'::regprocedure, 'public.audit_log_guard_insert()'::regprocedure)` | One role row, all four flags false. The database, the three tables and the two `SECURITY DEFINER` functions belong to `dems_owner`. A database that was created or migrated by the superuser by mistake fails here |

After B-1 to B-9 the server adds 1 to `core_state.epoch` and rehydrates [SP:§8.6]. While it runs, `ready.database` of the health answer follows the pool [SP:§7.4].

What the boot checks do not cover: the host-authentication file and the modes of the credential files. The runtime role cannot read `pg_hba.conf` through SQL, and the server is a client of the database, not its administrator. Those checks belong to `scripts/pg/` (7.6).

### 7.5 Test idea for the matrix

| ID | Test | Expected |
|---|---|---|
| T-PV-1 | On a clone, for every table and every privilege in (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER), compare `has_table_privilege('dems_app', ...)` and, for UPDATE, `has_column_privilege` per column with section 7.3; list the functions `dems_app` may execute; check that `dems_app` cannot `CREATE TABLE` in `public`, cannot `CREATE DATABASE`, and holds no privilege on schema `drizzle` | The catalog equals the matrix; a table that a later migration adds without grants makes the test fail |
| T-PV-2 | Read `pg_roles` and `pg_auth_members` for `dems_owner` and `dems_app`; read the owner of the clone, of every table, index and function of schema `public`, and of schema `drizzle`. As `dems_owner`: `CREATE ROLE x`; `SET session_replication_role = replica`; `ALTER DATABASE postgres RENAME TO y` | `dems_owner`: `rolcreatedb` true, the four other flags false. `dems_app`: all five false. No membership row names either role. Every object belongs to `dems_owner`; none to `dems_admin`. The three statements fail with `42501` |
| T-PV-3 | Start the server on a clone whose pool is configured with the owner role; start it on a clone in which one trigger was set back to the default mode (`ALTER TABLE ... ENABLE TRIGGER`, done by the test as `dems_owner` on its own clone, which TI-17 allows for this one test) | The first start stops at B-4, the second at B-5; each logs the check's ID and opens no listener |

### 7.6 Credentials inventory, connection files and host authentication

This section is the database half of [RV:SD-15] and of the role separation of [RV:SD-01]; the specification states the same rules from the server's side [SP:§14.1; SR-60, SR-77]. **Names only: no value of any password appears here or anywhere in this file.** The name `.data/pg.owner.env` is the one the specification proposed and left to this contract to fix [SP:§14.1; GS-28]; it is fixed here. The plan's revision 2 pins the same three files and the same five keys in each connection file [PL:§3.4]; [DEC:D20]: the ten key names below are equal in both files (row 19, finding C-07). AC-B-86 checks them.

**Inventory.**

| Object | Mode | Holds | Written by | Read by |
|---|---|---|---|---|
| `.data/` | 0700 | The directory of everything below | `pg:init` (RP-1), after `git check-ignore` matched it | — |
| `.data/pg.pwfile` | 0600 | One line: the password of **`dems_admin`**, in the form `initdb --pwfile` reads | `pg:init`, once, created exclusively | `initdb`, by path (RP-2); `scripts/pg/` for the role creation of RP-3 and for trial step T5-j. **Nothing else** (HC-1) |
| `.data/pg.owner.env` | 0600 | The five connection fields of **`dems_owner`**. Keys: `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE` (the maintenance database, DA-12), `DEMS_PG_OWNER_ROLE`, `DEMS_PG_OWNER_PASSWORD` | `pg:init`, once, created exclusively | The `db:*` commands; the test helper and the fixture loader; the reset routine inside the server, only with the demo flag on and only for the routine (HC-3) |
| `.data/pg.env` | 0600 | The five connection fields of **`dems_app`**. Keys: `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE` (the database of the main instance), `DEMS_PG_APP_ROLE`, `DEMS_PG_APP_PASSWORD` | `pg:init`, once, created exclusively | The server's configuration loader at start; the test helper, to run the code under test as `dems_app` (TI-9) |
| `.data/postgres/` | 0700 (set by `initdb`) | The cluster, with `pg_hba.conf` and the SCRAM verifiers of the three roles | `initdb` | The PostgreSQL server process |
| `.data/postgres.log` | 0600 | The server log. With the default logging (NL-5) it holds failed statement texts without bind parameters [PG-16] | `pg_ctl -l` [AN:300] | A person; the log check of row 28 (W17) |

No fourth secret exists on the database side: no connection URL, no `PGPASSWORD`, no `.pgpass` file, no service file.

**Which process may read which file.**

| Process | `pg.pwfile` (`dems_admin`) | `pg.owner.env` (`dems_owner`) | `pg.env` (`dems_app`) |
|---|:-:|:-:|:-:|
| `pg:init` and the other `scripts/pg/` commands | yes (RP-2, RP-3 and trial step T5-j only) | writes it; reads it for the trial (RP-5) | writes it; reads it for T3-b and T5-h |
| `db:create`, `db:migrate`, `db:seed`, `db:reset`, `db:status` | **no** | yes | no |
| Test helper and fixture loader (`test:db`) | **no** | yes | yes |
| Core server, demo flag off | **no** | **no** | yes |
| Core server, demo flag on | **no** | only inside the reset routine (HC-3) | yes |
| Web console, mobile app, dev proxy, mock-core, launcher | no | no | no |

**Rules.**

| ID | Rule |
|---|---|
| CR-1 | **Five discrete fields.** A connection file is plain `KEY=value` lines with the five keys of the inventory and nothing else: host, port, database, user, password [RV:SD-15 (b)]; [SP:§14.1 rule 2]. No connection URL that contains a password exists anywhere in the project. The database field is a default, not the last word: a lane instance takes its database from its port (4420 uses `dems_demo`, 442k uses `dems_lane_k`, [PL:§3.4]), and a `db:*` command takes it from `--database <name>`, checked against the closed list of 8.4. The plan's revision 2 lists the same five keys [PL:§3.4]; reconciled (row 19; 15.5, NOTE-1) |
| CR-2 | **The program reads the file itself.** The server's loader and the commands open the file, parse it and pass the fields to the driver as an object. Not used: `node --env-file`, `source`, `dotenv` into `process.env`, an exported `PGPASSWORD` or `PGUSER`. The keys carry the prefix `DEMS_PG_`, so that a file sourced by mistake sets nothing that `libpq` or the `pg` driver reads on its own |
| CR-3 | **Modes.** `.data/` is 0700; the three credential files and the server log are 0600 [RV:SD-15 (a)]. A loader that finds a credential file readable by group or others stops with a message that names the file and the expected mode, and prints no content |
| CR-4 | **No secret in a process argument** [RV:SD-15 (c)]. No command, npm script or child process takes a password, a token or a connection URL as an argument or through its environment. `initdb` takes a path (`--pwfile`); the `db:*` commands take a database name; `pg_ctl` takes none |
| CR-5 | **Generation.** Each of the three passwords is at least 24 bytes from `crypto.randomBytes`, written as base64url [AN:295]; [RV:SD-15 (e)]. They are generated once, by `pg:init`, and never printed. A file that already exists is not overwritten |
| CR-6 | **Lifetime.** The files live and die with the cluster: `pg:remove-data` deletes `.data/` as a whole [PL:§3.4]. There is no rotation in this task |
| CR-7 | **Ignore rule first.** `.gitignore` has `/.data/` before the directory is created, and `git check-ignore -v` matches the directory and the three files [SP:SR-60; AC-B-64] |

**Host authentication.** `initdb -A scram-sha-256` is what keeps `trust` out of `pg_hba.conf` [AN:296]; revision 1 and the trial of the analysis did not check the result [RV:SD-15 (d)].

| ID | Check on `.data/postgres/pg_hba.conf` (every line that is not empty and not a comment) | Pass |
|---|---|---|
| HA-1 | The method (last field before any option) | `scram-sha-256` on every line. No `trust`, `peer`, `ident`, `password` or `md5` |
| HA-2 | The address of every `host` line | `127.0.0.1/32` or `::1/128`. No other network, no `all`, `samehost` or `samenet`, no host name |
| HA-3 | The line types | `local` and `host` only. The `local` lines are inert, because the Unix socket is off (`unix_socket_directories = ''`, [AN:270]), and must still carry `scram-sha-256` |
| HA-4 | Behaviour | A connection as `dems_app` with a wrong password is refused with `28P01`; `listen_addresses` is `127.0.0.1` and the listener check of the trial (T4) shows one listener |

The checks read the file as a file: it belongs to the user's uid, and the SQL view of it is for superusers. They run in `pg:init` (RP-4, trial steps T3-a and T3-b), again in `pg:status`, and in the rollback proof of row 105 (W90). The server does not run them (7.4).

**Test ideas.**

| ID | Test | Expected |
|---|---|---|
| T-CR-1 | `stat -f '%Lp'` on `.data/`, the three credential files and `.data/postgres.log` (the extension of AC-B-64 that [RV:SD-15 (a)] asks for) | 700, 600, 600, 600, 600 |
| T-CR-2 | A static search. (a) `pg.pwfile` in `apps/` and `packages/`. (b) `PGPASSWORD`, `DATABASE_URL`, `--env-file`, a `postgres://` or `postgresql://` URL with a user part, in `scripts/`, `apps/core-server/` and every `package.json`. (c) `pg.owner.env` in `apps/core-server/src/` outside the reset routine and the command folder | No match for (a), (b), (c) |
| T-CR-3 | The loader is pointed at a directory that holds `pg.env` only. Start the server with the demo flag off; call `resetDemo`. Then with the flag on | Flag off: the server starts and serves; `resetDemo` answers 403 `DEMO_DISABLED`. Flag on: the server starts, and `resetDemo` fails at R-0 with a message that names the missing file. In neither case is `pg.pwfile` asked for |
| T-CR-4 | A credential file with mode 0644 | The loader stops and names the file; the content is not printed |
| T-HA-1 | The check of HA-1 to HA-3 on three fixture files: the one `initdb` wrote, one with an added `trust` line, one with an added line for `0.0.0.0/0` | Pass; fail on HA-1; fail on HA-2 (`npm run test:pg-scripts`, no database needed) |

---

## 8. Migration order and reset

This section answers impact question 9 on the database side; the demo-control operations are [SP:§12].

### 8.1 Rules

| ID | Rule | Source |
|---|---|---|
| MG-1 | One writer: row 28 (W17) and a controller-scheduled migration slot. Files live in `apps/core-server/src/db/migrations/`; the typed schema in `apps/core-server/src/db/schema/` | P16 [BP:460-462] |
| MG-2 | Files are produced by `drizzle-kit` 0.31.11: `generate --name=<purpose>` for the typed schema, `generate --custom --name=<purpose>` for hand-written SQL. Generated and hand-written SQL never share a file | [AN:367]; [R7:66] |
| MG-3 | **Naming**: `NNNN_<purpose>` with a four-digit index and a `snake_case` purpose. The on-disk prefix is whatever `drizzle-kit` 0.31.11 writes (**hypothesis**: a running four-digit index in the 0.31 line; the documentation the research read describes a timestamp folder, [R7:66]); the purpose and the order are fixed here (DA-03) | [R7:66]; G-27 [AN:798] |
| MG-4 | **Roll-forward only.** An applied file is never edited; a correction is a new file. Before the gate of row 28 (W17) has passed, the folder may be deleted and regenerated | [AN:369] |
| MG-5 | The last file of every migration set sets `schema_meta.schema_version` (insert for the first set, `UPDATE ... SET schema_version = schema_version + 1` afterwards). The server constant of B-3 changes in the same commit | this file |
| MG-6 | A set that adds a table adds its privileges in the same set | OW-6 |
| MG-7 | No statement of a migration needs to run outside a transaction, and no migration names a database | this file |
| MG-8 | A migration holds no dataset row. The only rows it inserts are mechanism rows: the genesis row of `audit_chain_head` and the row of `schema_meta`. Roles, permissions and grants come from the seed, which reads the shared vocabulary (AC-B-17) | [BP:302] |
| MG-9 | Migrations are applied under `dems_owner`: by the migrate command, by the test helper when it builds a template, and by the reset routine when it builds the new database (R-5a). Never under `dems_admin`, never under `dems_app`, never by the server at start. On `dems_demo` the command runs under `/usr/bin/lockf -k .locks/db-migrate.lock`; test databases migrate freely | [DEC:D13, D16]; P16 [BP:462] |
| MG-10 | A second run applies nothing (AC-B-01) | [SP:L1540] |
| MG-11 | The additive vocabulary of row 26 (W16; 3 permissions, 9 audit types, [SP:§19.2]) needs **no** migration: permissions, audit types and event types are checked by format, not by list. A change to a closed set of section 2.4 needs one, and is a `SCHEMA-GAP` for a row other than 28 | P12 [BP:448-450] |

### 8.2 The initial migration set (schema version 1)

| Order | Name | Kind | Content |
|--:|---|---|---|
| 1 | `0000_prelude` | hand-written | The function `dems_jsonb_is_flat(jsonb)`, which CHECK constraints of the next file call (text in 8.3) |
| 2 | `0001_tables` | generated from the typed schema | The 30 tables of section 4 with every primary key, foreign key, UNIQUE constraint, CHECK constraint and index, under the names of section 4 |
| 3 | `0002_audit_guards` | hand-written | The six statement groups of section 6.3: genesis row, `audit_chain_lock()`, the chain guard and its trigger, the refusal function and its trigger, the refusal function and trigger of the lineage table, and the three `ENABLE ALWAYS` statements |
| 4 | `0003_privileges` | hand-written | The statements of 8.3: revoke, grant, and the `schema_meta` row |

The set is written once, from this revision. No file of revision 1 was ever generated or applied (1.4), so `TOKEN_REUSE`, the lineage table and `ENABLE ALWAYS` are part of schema version 1 and need no forward migration.

If `drizzle-kit` 0.31.11 cannot emit one of the constraints of section 4 from the typed schema (DA-03), row 28 (W17) adds that constraint to a hand-written file `0002a_extra_constraints` between orders 2 and 3 with the same name and definition, and records it.

Proposed layout of the typed schema (one file per group): `rbac.ts` (T-01 to T-05), `identity.ts` (T-06), `pairing.ts` (T-07 to T-11), `audit.ts` (T-12 to T-14 and T-30), `sessions.ts` (T-15, T-16), `evidence.ts` (T-17 to T-20), `core.ts` (T-21 to T-28), `meta.ts` (T-29), `index.ts`.

### 8.3 Hand-written statements of `0000_prelude` and `0003_privileges`

Not executed (section 1.4). Both files are applied as `dems_owner`, the owner of the database (OW-1). That a role which is not a superuser may issue every statement below is PG-15 and PG-04, proven when row 28 (W17) applies the set.

```sql
-- 0000_prelude
CREATE FUNCTION public.dems_jsonb_is_flat(doc jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(doc) <> 'object' THEN false
    ELSE NOT EXISTS (
      SELECT 1
        FROM jsonb_each(doc) AS e
       WHERE jsonb_typeof(e.value) IN ('object', 'array')
    )
  END
$$;
```

```sql
-- 0003_privileges
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO dems_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, dems_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO dems_app;

GRANT INSERT ON
  auth_sessions, pairing_codes, paired_devices, device_credentials, biometric_tokens,
  audit_log, events, active_session, session_history, evidence_items, evidence_tracks,
  evidence_custody, exports, alerts, engine_counters, health_snapshots
TO dems_app;
-- audit_chain_history is not in this list: the runtime role has SELECT only on it (CONFLICT-1,
-- decided by D18). Its rows are inserted by the reset routine, which runs as the owner.

GRANT UPDATE (role_id, enabled, last_sign_in_at, role_changed_at, updated_at) ON operators TO dems_app;
GRANT UPDATE (algorithm, memory_kib, passes, parallelism, salt, hash, hashed_at) ON operator_credentials TO dems_app;
GRANT UPDATE (last_seen_at, ended_at, end_reason) ON auth_sessions TO dems_app;
GRANT UPDATE (state, failed_attempts, closed_at, closed_by_operator_id) ON pairing_codes TO dems_app;
GRANT UPDATE (state, last_seen_at, revoked_at, revoked_by_operator_id, revoke_reason, unpaired_at, updated_at) ON paired_devices TO dems_app;
GRANT UPDATE (current_hash, next_hash, rotated_at) ON device_credentials TO dems_app;
GRANT UPDATE (used_at, revoked_at, revoke_reason) ON biometric_tokens TO dems_app;
GRANT UPDATE (next_value) ON registry_counters, engine_counters TO dems_app;
GRANT UPDATE, DELETE ON active_session TO dems_app;
GRANT UPDATE (status, lifecycle_stage, verification_status, verification_at, tampered, tampered_track_id, updated_at) ON evidence_items TO dems_app;
GRANT UPDATE (active, acknowledged, resolved_at) ON alerts TO dems_app;
GRANT UPDATE (retention_policy, retention_days, auto_archive, updated_at) ON storage_policy TO dems_app;
GRANT UPDATE (presentation_mode, time_format, notify_warnings, notify_sound, updated_at) ON console_settings TO dems_app;
GRANT UPDATE (software_version, core_software_version, updated_at) ON core_device TO dems_app;
GRANT UPDATE (epoch, last_sealed_session_id, last_sealed_acknowledged, updated_at) ON core_state TO dems_app;
GRANT UPDATE (tablet_link, active_camera_id, cameras, mics, storage, time_status, network, security,
              services, health, other_devices, ports, faults, diagnostics, software_update, written_at)
  ON hardware_snapshot TO dems_app;

GRANT EXECUTE ON FUNCTION public.dems_jsonb_is_flat(jsonb) TO dems_app;
GRANT EXECUTE ON FUNCTION public.audit_chain_lock() TO dems_app;

INSERT INTO public.schema_meta (singleton, schema_version, contract_revision)
VALUES (true, 1, 'dbc-2');
```

No statement of the migration set names `dems_owner` or `dems_admin`: ownership comes from the role that applies the set (MG-9), and B-9 checks the result. `dems_app` must exist before `0003_privileges` runs (OW-8).

### 8.4 Databases and commands

| Database | Purpose | Created by | Reset |
|---|---|---|---|
| `dems_demo` | The main instance on port 4420 [AN:660] | `db:create`, `db:migrate`, `db:seed` (the README path, AC-B-67) | `db:reset`, or the `resetDemo` and `loadScenario` operations |
| `dems_lane_1`, `dems_lane_2`, `dems_lane_3` | Lane instances on 4421 to 4423 [AN:660] | `db:reset --database dems_lane_n` (it creates the database when it does not exist) | `db:reset` before every live check, with the lane's backend stopped [SP:DC-9] |
| `dems_test_*` | Test databases | The test helper only (section 10) | Dropped by the helper |
| `<name>_next`, `<name>_prev` | Staging and previous database of a reset, for the four names above | The reset routine | Removed by the reset routine |

Command names were proposals for row 18 [SP:§19.5 Row 18 #2]; the plan's revision 2 pins them as written here [PL:§3.4], with root aliases of the same names. Each runs under **`dems_owner`** with the fields of `.data/pg.owner.env` (C-5; section 7.6) and prints no secret. None reads `.data/pg.pwfile`, and none takes a secret as an argument or from its environment (CR-4). Every project database is owned by `dems_owner` (OW-1).

| Command | What it does |
|---|---|
| `npm run db:create -w @dems/core-server -- --database <name>` | Checks that the roles `dems_owner` and `dems_app` exist and stops with a message naming `pg:init` when one is missing (OW-8); it creates no role. Creates the database when it is absent: `CREATE DATABASE <name> OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` |
| `npm run db:migrate -w @dems/core-server -- --database <name>` | Applies pending migrations with the Drizzle migrator [R7:67]; prints the schema version before and after |
| `npm run db:seed -w @dems/core-server -- --database <name>` | Section 9. Refuses a database whose `core_state` has a row: a repeat is a reset (SD-3) |
| `npm run db:reset -w @dems/core-server -- --database <name> [--scenario <name>]` | Section 8.5 |
| `npm run db:status -w @dems/core-server -- --database <name>` | Prints schema version and contract revision, `seeded_at`, `last_reset_at`, the row count of every table, the audit head sequence, the owner of the database, the mode of the three audit triggers, and the number of lineage rows with the newest one (LN-4) |
| `npm run test:db -w @dems/core-server` | The database-backed tests [AN:484] |

A command accepts only the names `dems_demo`, `dems_lane_1`, `dems_lane_2`, `dems_lane_3`; any other name is refused before a connection is opened. A database name cannot be a bind parameter [PG-19]: it is placed in a statement only after it has matched this list (or the pattern of TI-3 in the test helper), which is the one place where this project builds statement text from a value. Test databases are reachable only through the helper of section 10.

### 8.5 Reset and carry-over routine

**What a reset is.** A new database is built beside the live one (migrate, seed as of the server clock), the kept tables are copied into it, the names are swapped, the old database is dropped. This order (build, carry over, swap, drop the old database last) is accepted by D14 and amends the wording of TD-04. The same routine serves `resetDemo` (scenario `idle`), `loadScenario`, and the command line [SP:§12.4; DC-9].

**Who does it.** Every database step is done by **`dems_owner`** [RV:SD-01]; [DEC:D16]. `dems_app` cannot do any step [SP:SR-58] and only has its pool closed and reopened. **`dems_admin` takes no part**: the routine never reads `.data/pg.pwfile`, and it refuses to run on a connection whose role is a superuser (R-0). The column "As" of the table states the role of every step. Inside the server the owner's credentials are read at R-0 and dropped at R-9 (HC-3).

**Kept tables (copied whole, SA-08):** `auth_sessions`, `paired_devices`, `device_credentials`, `biometric_tokens`, `console_settings` [SP:§12.4]; `pairing_codes` and `registry_counters` (SPEC-GAP-2, decided by D14); and `audit_chain_history`, to which the routine also appends (D16). That is eight tables. **Continued scalar:** `core_state.epoch` (SPEC-GAP-5, decided by D14). Everything else is rebuilt from the seed, operators included.

| Step | Where | As | What | On failure |
|---|---|---|---|---|
| R-0 Guard | The request, then the maintenance database `postgres` | The request arrived on the pool of `dems_app`. The routine then opens **one connection as `dems_owner`** | The target is one of the four allowed names. Server-triggered: `DEMO_CONTROL` and the demo flag were checked by the guard [SP:DC-1, DC-2]; only now the routine reads `.data/pg.owner.env` (HC-3). Command line: the command reads the same file. **Role check** [RV:§5.2 item 2]: `SELECT rolname, rolsuper FROM pg_roles WHERE rolname = current_user` must return `dems_owner` and `false`; otherwise the routine stops with `RESET_ROLE_PRIVILEGED`. On `dems_demo` the routine holds `.locks/db-migrate.lock` (P16). Then `SELECT pg_try_advisory_lock(442001, <slot>)` with slot 0 for `dems_demo` and 1 to 3 for the lanes; false means another reset of this target runs | Refuse: nothing was touched; the owner connection is closed. The operation answers 503 `NOT_READY`. A failed role check is a configuration defect: it is logged with the code `RESET_ROLE_PRIVILEGED`; which answer the operation gives for it is the specification's (row 15, with DC-5) |
| R-1 Quiesce | server | `dems_app` (its pool is closed here) | Readiness off (every other request gets 503, [SP:DC-4]); the pipeline is drained; the hardware snapshot is written; the pool of `dems_app` is closed. Command line: the target must have no session (`SELECT count(*) FROM pg_stat_activity WHERE datname = <t>`, as `dems_owner`, [PG-27]); the routine ends nobody's session | Reopen the pool; readiness on; nothing changed |
| R-2 Leftovers | `postgres` | `dems_owner` | `<t>_next` exists: drop it. `<t>_prev` and `<t>` both exist: drop `<t>_prev`. `<t>_prev` exists and `<t>` does not: rename `<t>_prev` back to `<t>` and stop with `RESET_RECOVERED_PREVIOUS` | As R-1 |
| R-3 Read the kept data | `<t>`, one `REPEATABLE READ, READ ONLY` transaction | `dems_owner`, a second connection | All rows of the eight kept tables; `core_state.epoch`; the discarded chain for the lineage (LN-2): `audit_chain_head.seq` and `.hash`, `min(seq)` and `count(*)` of `audit_log`; `schema_meta.schema_version`. A version other than the code's stops the routine with `RESET_SCHEMA_MISMATCH` (migrate first). When `<t>` does not exist, nothing is read and steps R-5c to R-5f are empty (a first build). Close the connection | As R-1 |
| R-4 Create | `postgres` | `dems_owner` | `CREATE DATABASE <t>_next OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` [PG-23] | As R-1 |
| R-5 Build | `<t>_next` | `dems_owner`, a second connection | (a) Apply all migrations (MG-9). Then **one transaction**: (b) the seed of section 9 with `now`, the scenario, and `epoch = previous + 1` (0 for a first build), `last_reset_at = now`; (c) the carry-over in this order: `UPDATE registry_counters`, `UPDATE console_settings`, `INSERT pairing_codes`, `INSERT paired_devices`, `INSERT device_credentials`, `INSERT auth_sessions`, `INSERT biometric_tokens`, `INSERT audit_chain_history` (the carried rows, unchanged, in `reset_no` order); (d) a pairing code that was `ACTIVE` is written as `CANCELLED` with `closed_at = now` and `closed_by_operator_id` = the resetting operator, NULL from the command line (SPEC-GAP-3, decided); `operators.last_sign_in_at` is set to the newest `issued_at` of the operator's carried sessions (SPEC-GAP-6, decided); (e) **the lineage row** of the chain being discarded (LN-1, LN-2), when the old audit log had at least one row: `INSERT INTO audit_chain_history (reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason, scenario) VALUES (...)` with bind parameters; (f) one `SCENARIO_LOADED` audit row and event through AP-2 to AP-4, with the actor (the operator, or null from the command line) and the details `scenario`, `reset`, `previousRows`, `previousHead` [SP:DC-7]; commit | Drop `<t>_next` (best effort; R-2 removes it next time). Then as R-1. **The live database was not touched** |
| R-6 Verify | `<t>_next` | `dems_owner` | The row count of each kept table equals the count read in R-3, and `audit_chain_history` has one more row when a chain was discarded; its highest `reset_no` equals its row count; the newest lineage row equals what R-3 read and agrees with the `SCENARIO_LOADED` row (LN-3); `audit_chain_head.seq` equals `count(*)` of `audit_log`; `schema_version` is the code's; the checks of B-5 and B-9 hold (three triggers with `'A'`, the runtime role's privileges, ownership by `dems_owner`). Close the connection | As R-5 |
| R-7 Swap | `postgres` | `dems_owner` | No session may be on `<t>` or `<t>_next`. `BEGIN; ALTER DATABASE <t> RENAME TO <t>_prev; ALTER DATABASE <t>_next RENAME TO <t>; COMMIT;` (DA-04; an owner with `CREATEDB` may rename, [PG-23]). For a first build only the second rename runs | The transaction rolls back: as R-5. If DA-04 is wrong and the second of two separate renames fails: rename `<t>_prev` back; if that fails too, the server stays not ready and R-2 repairs it at the next run |
| R-8 Drop the old | `postgres` | `dems_owner` | `DROP DATABASE <t>_prev`. The discarded chain is gone; its lineage row is in `<t>` | The reset has succeeded; the leftover is logged and removed by R-2 next time |
| R-9 Resume | server | First `dems_owner`: release the advisory lock and **close the owner connection**; the credential values are dropped (HC-3). Then `dems_app` | Open the pool of `dems_app` on `<t>`; boot checks B-1 to B-9; rehydrate; a new snapshot to every operator socket with the new epoch [SP:RT-7]; readiness on; answer 200 with the epoch | The server stays not ready (`ready.database: false`) and logs the failed check. R-6 makes this unreachable in practice |

The owner role has at most two connections open at a time (the one on `postgres`, and one on `<t>` or `<t>_next`), and none after R-9. From the command line R-1 and R-9 have no server part: the command opens and closes its own connections and exits.

Properties:

| Property | Why |
|---|---|
| The name `<t>` always points at a complete database | The swap of R-7 is the only step that changes what `<t>` names; a crash at any other step leaves the old database (before R-7) or the new one (after R-7) |
| Nobody is signed out and no device is unpaired | The session and device rows are copied with their primary keys and hashes; operator IDs do not change (DA-08); the connection registry in memory keys on the same session IDs |
| The runtime role never updates or deletes an audit row | It takes no part. The owner role inserts the new chain through the append protocol and removes the old chain only by dropping its database |
| No superuser takes part | Every step runs as `dems_owner`; R-0 refuses a superuser connection; the server never reads the superuser's password file (HC-1) |
| The discarded chain leaves a durable trace | One row of `audit_chain_history`, which every later reset carries over (6.6); the `SCENARIO_LOADED` row of the new chain holds the same head hash and row count; one server log line holds them too [SP:DC-7; SR-56]; [DEC:D16] |
| The lineage is never rewritten | The carried rows are inserted unchanged; the trigger refuses UPDATE, DELETE and TRUNCATE for the owner as well; T-RS-1 compares their checksum before and after |
| No hash and no secret is logged | NL-8. The head hash of a chain is an integrity value, not a secret, and may be logged |
| A reset needs room for two copies of the database for a short time | The demo database is a few megabytes (**hypothesis**; not measured) |

Test ideas:

| ID | Test | Expected |
|---|---|---|
| T-RS-1 | On a clone used as target: pair a device, sign in on it and on the web, enrol a biometric token, change a setting, change a role, record a session; reset; then reset a second time with another scenario | The checksums of the seven kept tables of revision 1 are equal before and after (apart from a closed `ACTIVE` code); every other table equals the seed checksums for the same `now` (AC-B-57); `audit_log` has the seed rows plus one `SCENARIO_LOADED` row whose details name the old head; `core_state.epoch` grew by 1 each time; the two old session tokens still authenticate. `audit_chain_history` has 1 row after the first reset and 2 after the second; row 1 is byte-equal after the second reset; each row's `head_hash`, `row_count` and `last_seq` equal the head and the count read from the database before that reset; LN-3 holds for the newest row |
| T-RS-2 | Make R-5 fail (a carried session row that names an operator the seed does not create) | The routine reports the failure; `<t>` has the checksums it had before, its lineage table included; `<t>_next` does not exist |
| T-RS-3 | As `dems_app`: `CREATE DATABASE x`; `DROP DATABASE <t>`; `ALTER DATABASE <t> RENAME TO y` | Each fails with `42501` |
| T-RS-4 | The role check of R-0, with a connection stub whose `pg_roles` answer says `rolsuper = true` (no real superuser connection is used, HC-1) | The routine stops with `RESET_ROLE_PRIVILEGED` before R-1; no statement other than the check was sent |
| T-RS-5 | During a reset, list the roles of the sessions the routine opens (`pg_stat_activity.usename`, read by a second `dems_owner` connection of the test) | Only `dems_owner`; never `dems_admin`. After R-9 no `dems_owner` session of the server remains |
| T-RS-6 | Reset a database that was migrated but never seeded, and build a database that does not exist yet | No lineage row is written in either case (LN-1) |

---

## 9. Seed mapping and seed clock rule

This section answers impact question 7.

### 9.1 Seed rules

| ID | Rule | Source |
|---|---|---|
| SD-1 | The seed is a TypeScript program in `apps/core-server/src/db/seed/` that calls the shared builders and writes their result through the one mapping module (MR-1). It copies no dataset value into its own source | [AN:367]; [BP:302] |
| SD-2 | Signature: `seed({ now, seed, scenario, epoch, lastResetAt })`. Defaults: `seed = DEFAULT_SEED` (`constants.ts:9`), `scenario = 'idle'`, `epoch = 0`, `lastResetAt = null`. State: `createIdleState({ now, seed })` (`initial-state.ts:138`) for `idle`, `buildScenarioState(name, base)` (`scenarios.ts:160-193`) for the three others | [SP:ENG-17, ENG-20] |
| SD-3 | The seed runs once, on a freshly migrated database, in **one transaction**, under `dems_owner` (7.1). It refuses a database whose `core_state` has a row. Seeding again is a reset (8.5): the append-only trigger makes an in-place re-seed impossible by design | [AN:367]; section 6.2; [DEC:D16] |
| SD-4 | Operators: the three records of `OPERATORS` (`dataset.ts:119-147`), `enabled = true`, `created_at = now`. Credentials: Argon2id of `DEMO_OPERATOR_PASSWORD` with the parameters of SR-05 and **a fresh random salt per operator and per seed**; the constant's value is never written to a table, a log or the output | [SP:§19.5 Row 16 #6]; Q12 [DEC:D4] |
| SD-5 | Roles from `OperatorRole`, permissions from `Permission`, grants from `ROLE_PERMISSIONS` (`vocabulary.ts:16-34`; `auth.ts:46-67`), read after row 26 (W16) has added the three permissions and three grants [SP:§19.2]. `sort_order` is the declaration order | AC-B-17 |
| SD-6 | Audit rows and events are written in ascending sequence through AP-2 to AP-4, with the hashes the shared replay computed (`initial-state.ts:411-419`); nothing is re-hashed by the seed | [SP:ENG-9] |
| SD-7 | `exports` has no slice: one row is derived from each seeded `EVIDENCE_EXPORTED` audit input whose details hold `exportId` (`dataset.ts:737-766`): `id`, `scope = 'EVIDENCE'`, `evidence_id`, `operator_id = actorId`, `reason`, `destination`, `at` | [SP:L298] |
| SD-8 | Synthetic data only: the seed writes nothing but the shared dataset (U7; [SP:SR-62]) | AC-B-65 |

### 9.2 Seed clock rule and the frozen demo evidence packages

| ID | Rule | Source |
|---|---|---|
| DR-1 | **The seed and every reset run as of the server clock at that moment**: `now` is read once from the server clock and passed down. The seed program computes no date itself; every `*_at` value and every dated identifier comes out of the shared builders | [SP:ENG-17]; [DEC:D11 ADQ-4]; [R2:463-473] |
| DR-2 | Session, evidence and case identifiers therefore carry the WIB date of the seed (`dataset.ts:196-204`), and the audit hashes differ from one seed date to the next [R2:442]. Nothing in the schema depends on a fixed date | [R2:475] |
| DR-3 | **The demo evidence packages stay frozen** at 2026-10-01 10:00 WIB and are never regenerated (P13). They join a seeded item on any day because the join ignores the dated parts: evidence suffix, session suffix, case sequence and subject name (`demo-data/join.ts:43-54`). The four join inputs are the stored columns `evidence_items.id`, `.session_id`, `.case_number`, `.subject_name` | [DEC:F6]; [R2:520-522]; [SP:ENG-18] |
| DR-4 | The seeded track hashes and manifest hash **are** the package's sealed values (`evidence.ts:150-171`), and `integrity_source` is `DEMO_PACKAGE` for all 13 items [R2:427]. No package path, media path or package suffix is stored: `EvidenceMediaRef` is computed by the shared join when it is read [SP:MS-2] | [SP:§11] |
| DR-5 | Tests pass the fixed instant the existing suites use (2026-10-01 10:00 WIB) as `now` | [SP:ENG-20] |
| DR-6 | After the seed the data does not follow the calendar; `core_state.seeded_at` holds `now` and `getDemoStatus` shows it | [SP:ENG-21] |
| DR-7 | Known edge: in the first hours after midnight WIB fewer than seven items are "sealed today" (`dataset.ts:451-452`) | [SP:ENG-22]; [DEC:F20] |
| DR-8 | An example shown against the Live server takes its identifiers from the database, never from the frozen examples | [SP:ENG-19] |

### 9.3 Mapping: every dataset entity of row 2 to its target

Entities and counts: [R2:325-366]. "none" means the entity is deliberately not stored; the reason and the specification anchor are given.

| # | Dataset entity | Count at seed | Target table | Rule |
|--:|---|--:|---|---|
| 1 | Operators | 3 | `operators`, `operator_credentials` | SD-4 |
| 2 | Roles | 3 | `roles` | SD-5 |
| 3 | Permissions | 9, and 3 added by row 26 (W16) | `permissions` | SD-5 |
| 4 | Role-permission grants | 15, and 3 added | `role_permissions` | SD-5 |
| 5 | Auth session (1, signed out) | 0 rows | `auth_sessions` | No row is written: an empty table is "nobody signed in" [SP:§3.2 slice 5] |
| 6 | Auth lockout (1, empty) | — | none: memory state [SP:§3.2 slice 6] | — |
| 7 | Core device | 1 | `core_device` | `id`, `name`, `room`, `product_name`, `software_version` |
| 8 | Device identity record (14 fields) | 1 | `core_device` (14 columns) | `DEVICE_IDENTITY` (`dataset.ts:72-89`) |
| 9 | Recording profile | 1 | none: `RECORDING_PROFILES` is a shared constant, not state (`dataset.ts:55-64`); `profile_id` columns hold its ID under CHECK `PROFILE` | — |
| 10 | Pairing (1 record, PAIRED) | 0 rows | `pairing_codes`, `paired_devices`, `device_credentials` (empty at seed); `core_device.certificate_fingerprint` | The simulator's PAIRED state is not copied: Live pairing is the real flow (Q5; [SP:§3.2 slice 7]). Only the Core's certificate fingerprint is seeded (`initial-state.ts:170-179`) |
| 11 | Tablet link | 1 | `hardware_snapshot.tablet_link` | Stored as built; recomputed at server start [SP:§8.6] |
| 12 | Cameras | 2 | `hardware_snapshot.cameras` | slice as built |
| 13 | Microphones | 2 | `hardware_snapshot.mics` | slice as built |
| 14 | Audio frames | 2 | none: streamed, never stored (Q4) | — |
| 15 | Core services | 16 | `hardware_snapshot.services` | slice as built |
| 16 | Other devices | 3 | `hardware_snapshot.other_devices` | slice as built |
| 17 | Ports | 7 | `hardware_snapshot.ports` | slice as built |
| 18 | Network record with 4 domains | 1 | `hardware_snapshot.network` | slice as built |
| 19 | Storage volumes | 2 | `hardware_snapshot.storage` | slice as built |
| 20 | Storage history | 24 points | `hardware_snapshot.storage` | inside the slice |
| 21 | Storage policy | 1 | `storage_policy` | 3 columns |
| 22 | Time record | 1 | `hardware_snapshot.time_status` | slice as built |
| 23 | Security record, 6 controls, 3 keys | 1 | `hardware_snapshot.security` | slice as built |
| 24 | Update record with 6 steps | 1 | `hardware_snapshot.software_update` | slice as built |
| 25 | Settings | 1 | `console_settings` | `DEFAULT_SETTINGS` at a first seed; the kept row at a reset |
| 26 | Session (active) | 0 | `active_session` | 0 rows for `idle`; 1 row for the scenarios `recording`, `finalizing`, `fault-demo` [R2:450-455] |
| 27 | Session history entries | 13 | `session_history` | MR-5 |
| 28 | Evidence items | 13 | `evidence_items` | DR-3, DR-4 |
| 29 | Evidence tracks | 52 | `evidence_tracks` | 4 per item, `position` 1 to 4 |
| 30 | Custody entries | 28 | `evidence_custody` | `seq` 1 to n per item |
| 31 | Audit rows | 82 | `audit_log`, and `audit_chain_head` | SD-6 |
| 32 | Operational events | 59 | `events` | SD-6; `category` by `eventCategory` |
| 33 | Counters | 5 values | `engine_counters` | `event` 60, `session` 24, `caseNumber` 8, `evidence` 14, `item` 1 [R2:361]; no `export` row |
| 34 | Alerts, active faults, diagnostics | 0, 0, none | `alerts` (0 rows); `hardware_snapshot.faults`, `.diagnostics` (NULL) | slice as built |
| 35 | Health series (up to 120 points per series) | — | Inside `hardware_snapshot.health`, `.network`, `.time_status`, `.storage`; `health_snapshots` starts with 0 rows | slice as built |
| 36 | Tampered item (evidence suffix 0005, track AUDIO-02) | 1 | `evidence_items.tampered`, `.tampered_track_id` | `dataset.ts:577, 789-790` |
| 37 | Exported item (evidence suffix 0004) | 1 | `exports` (1 row), the item's `status`, its custody entry | SD-7 |
| 38 | Recording scenario session | 1, in three scenarios | `active_session` | by `buildScenarioState` |
| 39 | `meta` scalars (seed, schema version, scenario, epoch, created) | 1 | `core_state` | plus `seeded_at`, `last_reset_at` |
| 40 | Active camera | 1 | `hardware_snapshot.active_camera_id` | `DEFAULT_CAMERA_ID` (`dataset.ts:882`) |
| 41 | Last sealed session and its acknowledged flag | 1 | `core_state` | null and true at seed (`initial-state.ts:182-183`) |
| 42 | Scenarios | 4 | `core_state` (column `scenario`) | The name of the loaded scenario; the scenarios themselves are shared builders [R2:446-455] |
| 43 | Demo evidence packages (14) and media (196 files) | — | none: bundled in the clients, not stored and not served [SP:§11]; joined by DR-3 | — |

Server-native rows that have no dataset entity: `registry_counters` (2 rows, value 1, written by the seed); `audit_chain_head` and `schema_meta` (1 row each, written by the migrations). `audit_chain_history` has no dataset entity either and **the seed never writes it**: it is empty after a first seed and gains one row per reset, written by the reset routine (LN-1).

### 9.4 Expected row counts after a first seed (scenario `idle`)

**Every count is derived by reading code, never by running it [R2:431; SP:SA-09], and is to be confirmed by the seed test.** The acceptance criterion compares the audit and event counts with the output of the shared function for the same `now`, not with the two numbers (AC-B-02).

| Table | Rows | Status |
|---|--:|---|
| `operators` | 3 | derived, to be confirmed by the seed test |
| `operator_credentials` | 3 | derived, to be confirmed by the seed test |
| `roles` | 3 | derived, to be confirmed by the seed test |
| `permissions` | 12 | derived (after the additions of row 26 (W16)), to be confirmed by the seed test |
| `role_permissions` | 18 | derived (4 + 10 + 4, [SP:§4.4]), to be confirmed by the seed test |
| `core_device` | 1 | derived, to be confirmed by the seed test |
| `core_state`, `storage_policy`, `console_settings`, `hardware_snapshot` | 1 each | derived, to be confirmed by the seed test |
| `engine_counters` | 5 | derived, to be confirmed by the seed test |
| `registry_counters` | 2 | this contract |
| `session_history` | 13 | derived, to be confirmed by the seed test |
| `evidence_items` | 13 | derived, to be confirmed by the seed test |
| `evidence_tracks` | 52 | derived, to be confirmed by the seed test |
| `evidence_custody` | 28 | derived, to be confirmed by the seed test |
| `exports` | 1 | derived, to be confirmed by the seed test |
| `audit_log` | 82 | derived, to be confirmed by the seed test |
| `audit_chain_head` | 1 (with `seq` 82) | derived, to be confirmed by the seed test |
| `events` | 59 | derived, to be confirmed by the seed test |
| `active_session`, `alerts`, `health_snapshots` | 0 | derived, to be confirmed by the seed test |
| `auth_sessions`, `pairing_codes`, `paired_devices`, `device_credentials`, `biometric_tokens` | 0 | this contract |
| `audit_chain_history` | 0 | this contract: a first seed discards nothing (LN-1) |
| `schema_meta` | 1 | this contract (migration); `contract_revision` is `dbc-2` |

The table above covers all 30 tables: 21 with at least one row and 9 empty. After a reset of that database the counts are the same, except: `audit_log` 83 and `events` 60 (the `SCENARIO_LOADED` row and event, as the shared `loadScenarioState` writes both, `scenarios.ts:214-228`; **hypothesis** for the event in Live mode); `audit_chain_history` 1, and one more after every further reset, with `row_count` 82 in the first row; and the other kept tables hold what they held.

### 9.5 Write order of the seed (one transaction)

`roles`, `permissions`, `role_permissions`, `operators`, `operator_credentials`, `core_device`, `core_state`, `storage_policy`, `console_settings`, `engine_counters`, `registry_counters`, `hardware_snapshot`, `session_history`, `evidence_items`, `evidence_tracks`, `evidence_custody`, `exports`, `active_session` (scenarios only), `alerts` (scenarios only), then the chain lock and `audit_log` in ascending `seq`, then `events`.

The chain lock is taken after the other tables here because the seed is the only session on a database that nothing else can reach yet; AP-7 binds writers of a database in use.

### 9.6 Seed tests and the checksum recipe

| ID | Test | Expected |
|---|---|---|
| ST-1 | Row counts after the seed at the fixed instant | Section 9.4 |
| ST-2 | Every audit row is read back and re-hashed with `chainHash`; `verifyAuditChain` runs over all rows (DA-02) | Every hash equals the stored one; the result is `ok` |
| ST-3 | The audit rows and events read back equal, member by member, those of `createIdleState` for the same `now` | Equal; the counts 82 and 59 are confirmed or corrected |
| ST-4 | The stored grants equal `ROLE_PERMISSIONS` (AC-B-17) | Equal |
| ST-5 | A second seed with `now` one day later | Identifiers carry the later date; `matchDemoPackage` joins all 13 items on both days; `integrity_source` is `DEMO_PACKAGE` 13 times |
| ST-6 | A dump of every table (`to_jsonb` of each row) is searched for the value of `DEMO_OPERATOR_PASSWORD` and for any person name outside the shared dataset (AC-B-28, AC-B-65) | No match |

**Content checksum of a table** (for rows 29 (W20), 48 (W29) and 55 (W53), which compare "checksums per table", AC-B-04 and AC-B-57): `SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY <key>), '')) FROM <table> AS t`, with the primary key as `<key>`. Left out of every comparison between two seeds: `operator_credentials` (fresh salts). For tables keyed by a generated `uuid` the row image is `to_jsonb(t) - 'id'` and the order is `issued_at, token_hash` (`auth_sessions`, `biometric_tokens`) or `at, cause` (`health_snapshots`). Two seeds with the same `now` then give equal checksums on every other table [BP:302].

---

## 10. Test-database isolation

This section answers impact question 6. The strategy is fixed by the decision record: one database per test file, cloned from a template [DEC:D11 TD-12; AN:483].

| ID | Rule | Source |
|---|---|---|
| TI-1 | **Server.** Database-backed tests use the project-local PostgreSQL on `127.0.0.1:4432` and nothing else. `test:db` attaches to the running server or starts it through `scripts/pg/` under `.locks/postgres.lock`, and stops it only if it started it. It fails, never skips, when PostgreSQL cannot be reached | [AN:484] |
| TI-2 | **Naming.** Every test database starts with `dems_test_`. The run prefix is `dems_test_<label>_<stamp>_`, where `<label>` is `step_<N>` when the row sets the environment variable `DEMS_TEST_STEP` (this is P15's `dems_test_step_<N>`) and `local` otherwise, and `<stamp>` is eight base-36 characters: the start time in seconds followed by two random characters. Templates: `<prefix>tpl_schema`, `<prefix>tpl_seed`, `<prefix>tpl_bulk`. Per test file: `<prefix>f<nn>_<slug>`, with a two-digit counter and the file's base name reduced to `[a-z0-9_]` and cut so that the whole name is at most 63 bytes [PG-13] | P15 [BP:458]; [AN:274, AN:483] |
| TI-3 | **Guard.** The helper creates and drops only names that match `^dems_test_[a-z0-9_]+$` **and** start with its own run prefix. It can never name `dems_demo`, a lane database, `postgres`, `template0` or `template1` | [AN:483]; [R12:117] |
| TI-4 | **Templates**, built once per run by the Vitest `globalSetup`, under `dems_owner`, which also owns them (section 10.1) | [AN:483]; [DEC:D16] |
| TI-5 | After a template is built, every connection to it is closed and it is locked: `ALTER DATABASE <tpl> WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`, issued by its owner `dems_owner` [PG-23]. A copy needs a source with no other session | [R12:101, R12:114, R12:117] |
| TI-6 | **Clone**: `CREATE DATABASE <name> TEMPLATE <tpl> OWNER dems_owner`, default copy strategy (stated as the efficient one for a small template, [R12:102]). The clone belongs to `dems_owner`, like its template; the triggers, their `ENABLE ALWAYS` mode and the privileges come with the copy (OW-7) | [AN:336] (trial T5; steps T5-a, T5-b of 7.1) |
| TI-7 | **Clones are serialised.** Before `CREATE DATABASE` the helper takes `SELECT pg_advisory_lock(442002, 0)` on the maintenance database and releases it afterwards, so one clone runs at a time across the two workers and across rows that test at the same time | G-18 [AN:789]; [R12:118] |
| TI-8 | **One database per test file.** `beforeAll` clones; the tests of the file share the database and run in order; a test that needs an untouched database asks the helper for another clone | [AN:483]; [R12:68] |
| TI-9 | **Roles.** The code under test connects as `dems_app`, exactly as in the demo; the helper and the fixtures use `dems_owner`. **Nothing in `test:db` connects as `dems_admin`** or reads `.data/pg.pwfile` (HC-1). The one test that needs a superuser, T-AO-2c, is a provisioning check of `scripts/pg/` (trial step T5-j; [DEC:D19]). The helper reads `.data/pg.owner.env` and `.data/pg.env` (7.6). Table privileges come with the clone (OW-7) | section 7; [RV:SD-01] |
| TI-10 | **Cleanup per file**: `afterAll` closes every pool the file opened (the code under test as `dems_app`, the helper's own), then `DROP DATABASE IF EXISTS <name> WITH (FORCE)` as `dems_owner`. With the pools closed, `FORCE` has at most leftover sessions of `dems_owner` to end, which a role may always do. Whether it may end a leaked `dems_app` session is PG-26 and trial step T5-h. If it may not, the drop fails, the helper reports the file as failed, and TI-12 removes the database later. `pg_signal_backend` is not granted to `dems_owner` unless the trial shows the need and the controller records it [RV:§5.2 item 5] | [PG-13, PG-26] |
| TI-11 | **Cleanup per run**: the teardown of `globalSetup` drops every database with the run prefix; a template needs `ALTER DATABASE <tpl> WITH IS_TEMPLATE false` first | [R12:117] |
| TI-12 | **Stale databases.** At start the helper drops `dems_test_*` databases whose stamp is more than six hours old (a run that crashed). It never drops a younger database of another run: a parallel row may be using it [DEC:D6] | this file |
| TI-13 | The seed, when called by a test, and the bulk-fixture loader refuse a database whose name does not start with `dems_test_`. The fixture is never loaded into `dems_demo` or a lane | [BP:303] |
| TI-14 | Two workers at most (`maxWorkers: 2` in the workspace configuration); a pool of at most five connections per application under test | [AN:482] |
| TI-15 | The root commands `npm test`, `npm run typecheck` and `npm run lint` need no database: the database-backed project runs only through `test:db` | [DEC:D9 DN-6]; [AN:484] |
| TI-16 | Tests drive a manual clock [SP:ENG-16]. No column takes a value from the database clock (TY-1), so a database test is deterministic for a given `now` | 1.7 |
| TI-17 | A test MUST NOT connect to `dems_demo` or a lane, disable or drop a trigger, connect as `dems_admin`, or run the code under test as `dems_owner`. One exception: T-PV-3 sets one trigger of its own clone back to the default mode, to prove that boot check B-5 notices | this file; [RV:SD-01, SD-06] |

### 10.1 What each template contains

| Template | Built from | Contains |
|---|---|---|
| `<prefix>tpl_schema` | `CREATE DATABASE ... OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'`, then all migrations, as `dems_owner` | The 30 tables, the 5 functions, the 3 triggers (each `ENABLE ALWAYS`), every privilege of section 7.3, the genesis row of `audit_chain_head`, the row of `schema_meta`. **No dataset row** |
| `<prefix>tpl_seed` | A clone of `tpl_schema`, then the seed with the fixed instant of DR-5, scenario `idle` | The rows of section 9.4; `audit_chain_history` is empty |
| `<prefix>tpl_bulk` | A clone of `tpl_seed`, then the bulk fixture of section 11. Built at the first request of a test file, under the lock of TI-7 | At least the minimums of section 11 |

A file names the template it needs: `tpl_schema` for migration, guard and privilege tests; `tpl_seed` for module and acceptance tests; `tpl_bulk` for paging, the role-by-endpoint matrix and the contract test [BP:596-612].

Cost as the sources state it: about 30 to 400 ms per clone [AN:481]. No figure exists for this host; row 28 (W11, the test helper) records the first measurement.

### 10.2 Test idea

| ID | Test | Expected |
|---|---|---|
| T-TI-1 | Two test files each insert an auth session with the same token hash into their own clone and read the table | Each sees one row. After the run, `SELECT datname FROM pg_database WHERE datname LIKE '<prefix>%'` returns no row, and `db:status` of `dems_demo` prints the same row counts before and after the run |
| T-TI-2 | The helper is asked to drop `dems_demo`, and to drop a `dems_test_` database of another, younger run | Both are refused before a statement is sent |
| T-TI-3 | After the templates are built: the owner of each template and of one clone (`pg_database.datdba`), and the roles of the sessions on the databases of the run (`pg_stat_activity.usename` where `datname` starts with the run prefix) | Every database of the run belongs to `dems_owner`; the sessions are `dems_owner` and `dems_app` only |

---

## 11. Bulk fixture: minimum row counts

The opt-in fixture of row 30 (W25) [BP:303]. It exists so that paging goes past one page and past the engine's rings, the matrix test meets real volumes, and the chain is verified over thousands of rows.

| ID | Rule |
|---|---|
| BF-1 | Loaded only into a `dems_test_` database (TI-13) |
| BF-2 | Built on top of the canonical seed at the fixed instant, through the same mapping module (MR-1) and the append protocol (section 6.4), under `dems_owner` |
| BF-3 | Deterministic: the shared seeded generator (`packages/shared/src/sim/rng.ts`) with a fixed seed; two loads give equal checksums (section 9.6) |
| BF-4 | Synthetic only: fixture operators are `OPR-004` and up, with generated usernames of the form `fixture.operator.NNN` and no person name taken from anywhere [SP:SR-62]. Every fixture operator gets a credential row made from random bytes that match no password |
| BF-5 | The numbers below are minimums. The loader prints the actual count per table, and the check of row 30 (W25) compares them [BP:303] |
| BF-6 | The audit chain verifies over the whole fixture (`verifyAuditChain` over all rows) |

Paging facts the minimums are derived from: a page has 50 rows by default and 200 at most [SP:API-9]; the engine keeps 1,000 audit rows, 500 events and 100 alerts (`constants.ts:35-38`).

| Table | Minimum rows | Required mix | Why this number |
|---|--:|---|---|
| `roles`, `permissions`, `role_permissions` | 3, 12, 18 | unchanged | The matrix is fixed (Q9) |
| `operators` | 12 | At least 2 enabled SUPERVISOR, at least 2 disabled, every role present | The user list; the last-administrator rule with more than one administrator; a disabled sign-in |
| `operator_credentials` | 12 | One per operator | Key |
| `auth_sessions` | 300 | At least 30 open, of which at least 5 bound to a device and at least 3 with method `BIOMETRIC`; at least 5 of each of the 8 end reasons, the `TOKEN_REUSE` ones all with method `BIOMETRIC` and a device | The three partial indexes must select few rows among many; `activeSessions` counts; the reuse rule of AT-C4 has sessions to end and sessions to leave open |
| `pairing_codes` | 60 | At most 1 `ACTIVE`; at least 40 `REDEEMED`; at least 5 each of `CANCELLED`, `EXPIRED`, `EXHAUSTED` | One per device plus every closed state |
| `paired_devices` | 40 | At least 20 `PAIRED`, 10 `REVOKED`, 10 `UNPAIRED` | The registry list with every state |
| `device_credentials` | 40 | One per device; at least 5 with a `next_hash` | Rotation in both phases |
| `biometric_tokens` | 80 | At least 20 live, 30 used, 20 revoked (every reason at least once), 10 past `expires_at` | Reuse detection and family revocation among many rows |
| `registry_counters` | 2 | Values above the highest minted number | A new device or code after the fixture does not collide |
| `audit_log` | 5,000 | At least 20 different types; all 8 categories; at least 200 rows of one session; at least 100 `ACCESS_DENIED`; at least 3 actors | Five times the ring; 25 pages of 200; each of the five filter indexes is exercised |
| `audit_chain_head` | 1 | `seq` equals the row count | Guard |
| `audit_chain_history` | 25 | `reset_no` 1 to n without a gap and `epoch` rising with it; both reasons at least 5 times; at least 5 rows without an actor (a reset from the command line); at least 3 scenarios; one row that is not intact (`last_seq` above `row_count`). The newest row agrees with one `SCENARIO_LOADED` row of the fixture's chain (LN-3). `core_state.epoch` is above the highest lineage epoch | More rows than the 20 that `verifyAuditChain` returns, so that `lineageTotal` differs from the list length; both reasons and both actor forms; the check of LN-3 has a true case; a reset of the fixture appends row n + 1 |
| `events` | 2,500 | All 10 categories; all 4 severities | Five times the ring; 13 pages of 200 |
| `session_history` | 520 | At least 500 `SEALED` and 20 `INCOMPLETE`; at least 5 without evidence | More than two pages of 200 |
| `evidence_items` | 505 | At least 400 `SEALED`, 40 `EXPORTED`, 30 `ARCHIVED`, 20 `UNDER_REVIEW`, 15 `RECORDED`; at least 10 tampered; all three case types | More than two pages of 200; every filter value of `listEvidence` |
| `evidence_tracks` | 2,020 | Exactly 4 per item, both audio tracks | I11; AC-B-70 |
| `evidence_custody` | 1,200 | At least 2 per item | Custody lists of different lengths |
| `exports` | 60 | At least 40 `EVIDENCE`, 10 `AUDIT`, 10 `LOGS` | Every scope |
| `alerts` | 250 | At least 10 active, 100 acknowledged; every fault kind | Two and a half times the ring |
| `health_snapshots` | 1,500 | At least 1,440 `INTERVAL` (24 hours at 60 s) and 60 caused by a fault | One day of snapshots |
| `engine_counters` | 6 | Values above the highest minted number; the `export` row present | Identifiers after the fixture do not collide |
| `active_session` | 0 | A variant flag adds one session in `RECORDING` with a full 200-item timeline | The largest row |
| `storage_policy`, `console_settings`, `core_device`, `core_state`, `hardware_snapshot`, `schema_meta` | 1 each | as seeded | Single-row tables |

The identifier formats bound the fixture: session and evidence suffixes have four digits (`api/patterns.ts:11-14`), so the fixture stays below 9,999 of each.

---

## 12. Database design checklist

Each item states the rule, where this contract meets it, and what verifies it. No item is empty.

| ID | Topic | Rule | Met in | Verified by |
|---|---|---|---|---|
| CL-01 | **Keys** | Every table has a primary key: a natural key where the shared code mints the identifier, a composite key for owned rows, `singleton` for a single-row table, a `uuid` only where the specification names no identifier | 2.3; every table of section 4 | The catalog test of row 28 (W17): each table of schema `public` has exactly the key of section 4 |
| CL-02 | **Foreign keys** | Every reference to an operator, a role, a permission, a paired device, a pairing code, a session-history row or an evidence item is a foreign key with `ON DELETE RESTRICT`. The soft references are listed with their reason (K-3) | 2.3; section 4 | Catalog test over `pg_constraint`; one refused delete of a referenced row |
| CL-03 | **Constraints** | A column is NOT NULL unless a NULL has a stated meaning. Every closed value set, identifier format, range and lifecycle rule is a named CHECK | 2.4; section 4 | Catalog test of CHECK names and text; one refused row per CHECK (negative insert tests, row 28 (W17)) |
| CL-04 | **Uniqueness** | Business uniqueness is in the database: one username; one row per token, credential and code hash; one active pairing code; one live biometric token per device and operator; one device per code; one evidence item per session; one open session; one discarded chain per epoch | 4.4, 4.6, 4.7, 4.8, 4.9, 4.10, 4.15, 4.17, 4.30 | Negative insert tests |
| CL-05 | **Indexes** | Every index has a query that needs it (the reason column of section 4). A foreign-key column that is read from the child side is indexed. Deliberately not indexed, because operators are never deleted and no operation filters by them: `investigator_id` (three tables), `created_by`, `issued_by_operator_id`, `closed_by_operator_id`, `revoked_by_operator_id`, `exports.operator_id`, `evidence_custody.actor_id` | section 4 | On the bulk fixture, `EXPLAIN` of each list query of section 7 of the specification names the index of section 4 (row 45 (W39): "pagination is stable over the bulk fixture", [BP:318]) |
| CL-06 | **Naming** | Rules N-1 to N-6 | 2.1 | Catalog test: every table, column, constraint and index name is lower-case `snake_case`, at most 63 bytes, with the suffix of N-4 |
| CL-07 | **Types** | Rules TY-1 to TY-9: time as `bigint`, no `timestamptz`, no `ENUM`, no `serial`, integrity hashes as text, secret hashes as `bytea`, JSON only in three cases | 2.2, 2.5 | Catalog test over `information_schema.columns` against section 4 |
| CL-08 | **Normalisation** | Each fact is stored once (third normal form), with four stated exceptions: (a) `evidence_items` repeats the session's descriptive columns, because the item is the sealed record; the runtime role cannot update them. (b) `events.category` is derived at insert by one shared function on an append-only table, for paging. (c) `audit_chain_head` repeats the newest row's `seq` and `hash`; only the guard trigger writes it and B-7 checks it. (d) The JSON columns of section 2.5. Derived values that are **not** stored: a history entry's `evidenceId` (MR-5), a session's idle expiry, a device's `online`, `signedInOperatorId` and `codeIssuedBy` | 2.5, 2.6, 4.8, 4.13, 4.14, 4.17 | Review (rows 20 and 113 (W91)); B-7; the restart test AC-B-04 |
| CL-09 | **Audit columns** | (1) Every row has a creation time from the server clock: its own domain column (`at`, `issued_at`, `paired_at`, `created_at`, `seeded_at`, `hashed_at`, `reset_at`) or the row that consumed it. (2) A table whose rows change in place and have no domain column for the change carries `updated_at`: `operators`, `paired_devices`, `active_session`, `evidence_items`, `storage_policy`, `console_settings`, `core_device`, `core_state`; the others record the change in `last_seen_at`, `ended_at`, `closed_at`, `rotated_at`, `used_at`, `revoked_at`, `resolved_at`, `written_at`. (3) There is no `created_by` or `updated_by` column: who did what is the hash-chained `audit_log`, one source. Actor columns exist only where the registry shows them (`issued_by_operator_id`, `closed_by_operator_id`, `revoked_by_operator_id`, `created_by`, custody `actor_id`, export `operator_id`) and in the lineage table, whose `actor_id` must outlive the chain that held the audit row. (4) No column takes the database clock | 1.7, 2.2, section 4 | Catalog test: no column default calls `now()`; the tables of rule (2) have `updated_at` |
| CL-10 | **Secrets** | No secret is stored; hashes only, in the forms of 5.1; lookup by 5.2; the never-log list NL-1 to NL-8; payload guards 5.5 | section 5 | AC-B-28 (dump), AC-B-29 (log capture), AC-B-30 (hash record), AC-B-41 |
| CL-11 | **Privileges and roles** | Three roles. Least privilege per table and per column for `dems_app`; `dems_owner`, not a superuser, owns every project database and object; `dems_admin` is used at provisioning only and no running process holds its credentials; no TRUNCATE, REFERENCES or TRIGGER privilege granted. The lineage table is read-only for `dems_app` [DEC:D18] | section 7 | T-PV-1, T-PV-2, T-PV-3; T-AO-3; boot checks B-4, B-5, B-9; trial steps T5-a to T5-j |
| CL-12 | **Vocabulary agreement** | Each CHECK list of section 2.4 equals the shared constant it cites, and the key deny list equals the server constant | 2.4, 5.5 | A test reads `pg_get_constraintdef` for each named CHECK and compares the values with `Object.values` of the shared constant |
| CL-13 | **Append-only and chain** | Section 6: privileges, triggers that are `ENABLE ALWAYS`, guard, lock, protocol; an exact statement of what binds the runtime role, the owner role and a superuser; the lineage table protected in the same way | section 6; 4.30 | T-AO-1, T-AO-2a to T-AO-2d, T-AO-3, T-AO-4, T-CH-1, T-CH-2, T-CH-3; AC-B-54 |
| CL-14 | **Migration order and reset** | MG-1 to MG-11; the four files of 8.2 in order; the reset R-0 to R-9 with the role of every step, its failure table, and the lineage row it appends | section 8; 6.6 | AC-B-01 (migrate twice); the catalog diff of row 28 (W17) [BP:301]; T-RS-1 to T-RS-6; AC-B-57 |
| CL-15 | **Seed** | SD-1 to SD-8, DR-1 to DR-8; every dataset entity has a target or a stated reason for none; expected counts | section 9 | ST-1 to ST-6; AC-B-02 |
| CL-16 | **Test isolation** | TI-1 to TI-17; three templates; clone per test file; guarded names; cleanup; templates and clones owned by `dems_owner`; no test connects as the superuser | section 10 | T-TI-1, T-TI-2, T-TI-3 |
| CL-17 | **Transactions** | One transaction per unit of work [SP:ENG-1]; READ COMMITTED; the chain lock first (AP-7); parents before children (MR-6); no transaction waits for a client | 2.6, 6.4 | T-CH-1; the engine tests of row 37 (W26) |
| CL-18 | **Growth** | Tables that only grow between resets: `audit_log` (about 7.5 rows a minute while recording, [R2:487]), `events`, `health_snapshots` (1,440 rows a day), `auth_sessions`, `biometric_tokens`, `pairing_codes`. Nothing is pruned; a reset rebuilds all but the kept tables (GD-07). `audit_chain_history` grows by one row per reset and is never rebuilt | section 4 | Row 110 (W98) measures the write rate during a recording [BP:596-612] |
| CL-19 | **Atomic state changes** | AT-1 to AT-6: one transaction per state change, the chain lock first, compare-and-set transitions whose row count decides, an attempt consumed before the value is compared, counters advanced by one statement. Five cases with their statements | 5.6; 4.7, 4.10, 4.11 | T-AT-1 to T-AT-5 at the database level (row 28 (W17)) and at the HTTP level (rows 32 (W24, W41), 35 (W33), 36 (W32)) |
| CL-20 | **Credentials and host authentication** | Three credential files with mode 0600 under a 0700 directory, discrete fields, no connection URL, no secret in an argument or an environment variable, a table of which process may read which file; `pg_hba.conf` with `scram-sha-256` only, loopback only, no `trust` line | 7.1 (HC-1 to HC-5), 7.6 | T-CR-1 to T-CR-4, T-HA-1; trial steps T3-a, T3-b; AC-B-64 |

---

## 13. Gaps and risks

### 13.1 Specification gaps

Each point is something the specification states that cannot be stored as written. Revision 1 marked each "needs controller decision" and built a default into the contract. **All seven are DECIDED: D14 adopted the default of every one** [DEC:D14]. None is open. The table states the rule as decided and where it lives; the specification takes over the wording under D16's revision (15.4).

| ID | The specification says | Why it cannot be stored as written | Status | Rule as decided (D14) | Where it lives |
|---|---|---|---|---|---|
| SPEC-GAP-1 | Free-text inputs have length limits only: note text, marker label, the reasons of stop, export, revoke and role change, destination, device name, platform, app version, the session-create fields [SP:§7.18] | PostgreSQL `text` and `jsonb` cannot hold the character U+0000 [PG-11]; the insert fails, which the engine treats as a commit failure with 503 and a not-ready database [SP:ENG-5]. An unpaired UTF-16 surrogate is replaced by U+FFFD when the driver encodes the string (**hypothesis**: Node's UTF-8 encoding of a lone surrogate; general knowledge; the test of row 27 (W19) confirms), so the stored audit row would no longer hash to its chain hash | **DECIDED** | One string rule in the contract registry refuses U+0000 and ill-formed UTF-16 in free text, with 422 `INVALID_INPUT`, before the engine runs | Row 27 (W19; contract registry). Nothing in the database |
| SPEC-GAP-2 | A reset rebuilds "counters" and keeps paired devices; pairing codes are in neither list, yet "an ACTIVE code is closed" [SP:§12.4] | A kept device references its code (`paired_with_code_id`, and `codeIssuedBy` of the registry, [SP:§6.5]); and if the device and code counters restart, the next device would be `DEV-0001` again and collide with a kept row | **DECIDED** | Pairing codes and the device and code counters are kept across a reset | 3.1; 4.11; 8.5 (kept tables, R-5c) |
| SPEC-GAP-3 | "Pairing code: an ACTIVE code is closed" by a reset [SP:L1300] | The code states are REDEEMED, CANCELLED, EXPIRED, EXHAUSTED [SP:§6.2]; no state, no reason and no audit row is named for a close by reset | **DECIDED** | An `ACTIVE` code at reset time is written `CANCELLED`, with `closed_at` = the reset time and `closed_by_operator_id` = the resetting operator (NULL from the command line). D14 names the state and does not mention an audit row. The default of revision 1 wrote no separate `PAIRING_CODE_CLOSED` row into the new chain, and D14 adopted the defaults, so none is written: the code row itself carries the state, the time and the operator. The controller confirmed this reading [DEC:D18] (NOTE-3 of 15.5) | 8.5 (R-5d) |
| SPEC-GAP-4 | E-25: "one row every 60 s and at every fault raise and clear" [SP:L306] | The entity has no content, and none of the 75 operations reads it | **DECIDED** | The health snapshot has the 17 columns of T-28 | 4.28 |
| SPEC-GAP-5 | A reset starts a "new" epoch [SP:L1302], and E-23, which holds the epoch, is rebuilt [SP:L304] | A rebuilt epoch starts at 0 again and can equal the epoch the clients already hold, so they would not see a new one | **DECIDED** | The realtime epoch continues: a reset writes the previous epoch plus 1 | 4.26; 8.5 (R-3, R-5b). The lineage row records that epoch (4.30) |
| SPEC-GAP-6 | Operators are rebuilt from the seed; sessions are kept [SP:§12.4] | `lastSignInAt` of `AdminUser` [SP:L949] would be null for an operator who is signed in (`activeSessions` above 0) | **DECIDED** | After a reset `last_sign_in_at` is the issue time of the operator's newest kept session | 8.5 (R-5d) |
| SPEC-GAP-7 | The registry gives one `signedInOperatorId` per device [SP:L594] | Nothing limits a device to one open session: a sign-in ends only the session that was presented with it [SP:ID-6], and the app keeps its token in memory, so a cold start signs in again without presenting the old one [SP:§5.3] | **DECIDED** | Several open sessions per device are allowed; the registry shows the operator of the newest one. No schema rule and no unique index on open sessions per device | 4.6; the registry query of row 36 (W32). A token reuse ends all open biometric sessions of the device and operator (AT-C4), which fits this rule |

**Refinements accepted by D14** (they were listed in 15.3 of revision 1 as wording that this contract refines): the reset order "build, carry over, swap, drop the old database last", which amends TD-04; the hardware snapshot as one row with one column per slice, which amends ADQ-4's "one JSON row"; the test database names `dems_test_step_<N>_<stamp>_...`. Section 15.3 lists them with their status.

### 13.2 Risk register of this contract

G-01 to G-29 [AN:770-800] and GS-01 to GS-19 [SP:§18] stay as recorded. This file adds:

| ID | Type | Item | Effect | Mitigation and owner |
|---|---|---|---|---|
| GD-01 | risk, **accepted as is** | The database checks that a row continues the chain, not that its `hash` is correct | A wrong digest written by the one writer would be continued by later rows | The digest comes from one shared function; `verifyAuditChain` over the stored rows (operation 60), boot check B-8, ST-2 and T-CH-1 detect it. Ruling [RV:§6]; [DEC:D16]: accepted, because a writer that may insert can also compute a valid digest, so a database check would catch defects only. No CHECK is added |
| GD-02 | risk, **closed by D16; the residual is accepted by the controller** [DEC:D19] | Revision 1: `dems_admin`, the cluster superuser, owned everything and performed the reset from inside the server. Now: the owner is `dems_owner`, not a superuser; `dems_admin` is used at provisioning only (7.1) [RV:SD-01]; [DEC:DR-03] | Residual (HC-5): with the demo flag on, a compromised server could act as `dems_owner` during a reset: drop a project database or change its schema. It could not skip the triggers by a session setting, create a role or change a server setting | The flag is off by default [SP:SR-57]; the owner's credentials are read only inside the routine (HC-3); R-0 refuses a superuser connection; B-5 and B-9 notice a changed schema at the next start. Rows 50 (W45) and 111 (W99) re-check the code against HC-1 to HC-4 |
| GD-03 | risk | The hardware snapshot rewrites up to four series-carrying JSON columns every second (DA-10) | Write-ahead-log volume in the order of gigabytes a day (**hypothesis**: 40 to 50 KB a second) | One column per slice limits the rewrite to changed slices [PG-12]; "at most once a second" [SP:§3.1] is an upper bound that row 37 (W26) may lower; row 110 (W98) measures |
| GD-04 | gap | Every SQL statement and every PG-n behaviour of this file is unexecuted: PostgreSQL is not installed [DEC:F1]. Revision 2 added the statements of 5.6, 6.3 (groups 5 and 6), 7.1 and 8.5 and the behaviours PG-21 to PG-28; none has run | A statement may need a correction | Row 23 (W07) runs the trial steps of 7.1; row 28 (W17) runs the rest; a correction that changes a name or a rule of this file is reported as `needs-review` |
| GD-05 | risk | The closed value sets of section 2.4 repeat the shared vocabulary in CHECK text | A change of a closed set needs a migration (MG-11) | CL-12's test fails the gate when the two differ |
| GD-06 | gap | `drizzle-kit` 0.31.11 was never run; its file layout and its support for named CHECK constraints and partial indexes are taken from documentation of another release line (DA-03) | Row 28 (W17) may need the fallback file of 8.2 | Row 28 (W10 proves it first; W17 writes the fallback file if it is needed) |
| GD-07 | risk | The append-only tables are never pruned (CL-18) | Slow growth between resets | Acceptable for a demo; a presenter resets before a demo [SP:ENG-21]. The rate of refusal rows is bounded outside the database by the denial budget of the specification: at most 20 audited refusals per key in 60 s, then 429 without an audit row [RV:SD-03]; [DEC:D16] |
| GD-08 | risk | A reset needs every session off the target and room for two copies | A reset of a lane while its backend runs is refused (R-1) | The lane order of the decision record: reset first, then start the backend [AN:660] |
| GD-09 | gap | No extension is assumed (DA-06) | The search `q` of `listEvidence` is a sequential scan | Fine at the fixture volume of 505 items |
| GD-10 | risk | A test run that crashes leaves locked template databases | Disk use | TI-12 removes them after six hours |
| GD-11 | gap | The seeded operator `OPR-001` shares a given name with the workspace git identity (G-24, [AN:795]) | U7 | Unchanged from the decision record; this file names operators by ID only |
| GD-12 | gap | That a role without superuser rights is enough for every database-level statement of sections 8 and 10 is unproven (DA-11; PG-23, PG-26, PG-27) | The reset, the test helper or the cleanup may need a change | Row 23 (W07) runs T5-a to T5-i before anything depends on the roles. A failure stops the row for a controller decision; the superuser is not put back |
| GD-13 | risk | The owner role can remove the audit protection by a schema change (6.2). Boot checks see it only at the next start; a replaced function body is seen only by the catalog test | A defect or a compromised reset path could weaken the trail between two starts | No program of the project issues such a statement (T-AO-4); R-6 repeats the checks before a swap; the catalog test runs at every gate. Rows 50 (W45) and 111 (W99) re-check |
| GD-14 | risk | The lineage table is written by the role that discards the chain. It records; it does not prove (LN-6) | A database dropped outside the routine leaves no row | `DROP DATABASE` occurs only in the routine, in the test helper and in the provisioning trial; LN-3 ties the newest row to the new chain; existing rows cannot be changed by any role; the runtime role cannot add a row [DEC:D18] |
| GD-15 | gap, **closed** | Revision 2 left two points for the controller: CONFLICT-1 and CONFLICT-2 (15.5) | — | Both are ruled and applied in revision 2.1 [DEC:D18, D19]: the runtime role only reads the lineage table; the superuser trigger check is a provisioning check of `scripts/pg/` |
| GD-16 | gap | Line citations `[SP:Lnnn]` point at the specification of 03:14; it is revised under D16 in the same wave, and its line numbers move. Section numbers and rule IDs stay valid | A cited line may no longer hold the cited text | Row 19 checks the three files against each other; the IDs to look for are in 15.4 |
| GD-17 | gap | Three ID families of this file collide by appearance with IDs of other files: seed rules SD-1 to SD-8 and review findings SD-01 to SD-29; reset steps R-0 to R-9 and residual risks R-01 to R-17; clock rules DR-1 to DR-8 and drift records DR-01 to DR-03 | A reader may take one for the other | This file writes the foreign IDs with a prefix (`[RV:SD-06]`, `[RV:R-08]`, `[DEC:DR-03]`) and keeps its own IDs unchanged, because other files cite them |

---

## 14. Traceability

### 14.1 Open points that the specification left for row 16

| [SP:§19.5] Row 16 # | Open point | Answered in |
|--:|---|---|
| 1 | A table for each of E-01 to E-25; `storage` and `activeCameraId` in the snapshot row | 3.1, 3.2, section 4 |
| 2 | The reset mechanism that carries E-05 to E-09 and E-20 across the re-creation | 8.5 |
| 3 | Which role applies migrations, and the schema-version check at start | 7.1 (`dems_owner`), 7.4 (B-3), 8.1 (MG-9) |
| 4 | The stored form of the hash set, of the pairing code, of the two credential hashes | 4.5, 4.7, 4.9, 5.1 |
| 5 | Cursor paging by sequence for audit rows and events; the health snapshot interval | 4.12, 4.14 (keys on `seq`); 4.28 (60 s) |
| 6 | The seed: `enabled = true`, 18 grants, fresh salts, `seededAt` | 9.1 (SD-4, SD-5), 4.26 |

### 14.2 Controller requirements for this row

| # | Requirement | Section |
|--:|---|---|
| 1 | Per table: column, type, nullability, default, every key and constraint, every index with a reason | 4 (30 tables) |
| 2 | Password hash form decided; tokens, credentials, codes as hashes with the lookup strategy; expiry and revocation columns; no secret in a payload column; columns never logged | 5 |
| 3 | Append-only by GRANT, trigger as defence in depth, chain serialised by a stated mechanism, exact statements, a test idea each; the reset's carry-over, its order and its failure behaviour | 6; 8.5 |
| 4 | Privilege matrix, ownership, boot checks | 7 |
| 5 | Seed mapping with the date-relative rule and expected counts marked as derived | 9 |
| 6 | Test isolation: template, clone per file, naming, cleanup, template content | 10 |
| 7 | Migration naming, order, reset; lane and test databases | 8, 10 |
| 8 | SPEC-GAP-n | 13.1 (seven, all decided by D14) |
| 9 | No personal data, no credential value | Reading guide; operators by ID only; 7.6 names files and keys only |

### 14.3 Verification criteria of the blueprint row

| Criterion [BP:289] | Where |
|---|---|
| Every stored entity of row 15 has a table | 3.1 (26 of 26, with E-26 of the specification's revision 2) |
| Every dataset entity of row 2 has a target table in the seed mapping | 9.3 (43 lines: 39 with a target table; 4 are not stored by a recorded decision, each with its anchor: lockout counters, audio frames, the recording-profile constant, the bundled packages and media) |
| The append-only mechanism is a database feature with a test idea | 6.2; T-AO-1, T-AO-2a to T-AO-2d, T-AO-3, T-AO-4 |
| The chain-serialisation mechanism is a database feature with a test idea | 6.3, 6.4; T-CH-1, T-CH-2, T-CH-3 |
| The checklist has no empty item | 12 (CL-01 to CL-18) |
| Impact questions 6, 7, 9 and 14 answered with section anchors | 14.4 |

### 14.4 Impact questions

| IQ | Question (short) | Answer in |
|--:|---|---|
| 6 | Test database and its isolation | Section 10 "Test-database isolation" |
| 7 | Dataset migration and date-relative seeding | Section 9 "Seed mapping and seed clock rule" |
| 9 | Reset to the seed state | Section 8 "Migration order and reset", 8.5 "Reset and carry-over routine"; the operations are [SP:§12.4] |
| 14 | Audit trail: append-only storage and hash chain | Section 6 "Audit table: append-only and chain serialisation"; the types and writers are [SP:§13] |

### 14.5 Security requirements that are storage rules

| SR | Storage rule | Section |
|---|---|---|
| SR-05, SR-06 | `operator_credentials`: algorithm, three parameters, salt, hash; floors as CHECK | 4.5, 5.1 |
| SR-09, SR-15 | `auth_sessions.token_hash` only; no token column | 4.6, 5.1 |
| SR-11 | `absolute_expires_at`, `last_seen_at` | 4.6, 5.3 |
| SR-12, SR-34 | `ended_at`, `end_reason`, device state and biometric revocation in one transaction | 5.3 |
| SR-13 | No role and no permission column in `auth_sessions` | 4.6 |
| SR-17 | Sessions are rows; ended rows keep their reason | 4.6 |
| SR-26, SR-27, SR-28 | `pairing_codes`: hash only, one active code by a unique index, `failed_attempts` 0 to 5 | 4.7, 5.1 |
| SR-31, SR-33 | `device_credentials`: `current_hash`, `next_hash`, promotion | 4.9, 5.2 |
| SR-35 | `auth_sessions.device_id` with a foreign key | 4.6 |
| SR-36 | `biometric_tokens`: hash, device, operator, family, single use, expiry, revocation; one live token | 4.10 |
| SR-47 | Supported by `operators_role_id_idx` and `role_permissions_permission_id_idx` | 4.3, 4.4 |
| SR-36, SR-74 | A used biometric token ends the open biometric sessions of its device and operator | 5.6 (AT-C4); 2.4 (`TOKEN_REUSE`) |
| SR-47, SR-72 | The last-administrator check and the change are one unit under a lock; the other state changes are compare-and-set, with the attempt consumed first | 5.6 (AT-1 to AT-6, AT-C1 to AT-C5) |
| SR-73 | A session is resolved only through its own transport | 5.2; 4.6 |
| SR-52 | Privileges and triggers that are `ENABLE ALWAYS`; what binds which role | 6.2, 6.3 |
| SR-53 | Chain head, guard trigger, lock function | 6.3, 6.4 |
| SR-54 | `FLAT`, `NO_SECRET_KEYS` | 5.5 |
| SR-56, SR-78 | The reset writes the old head into the new chain **and** into the lineage table that every reset keeps. The runtime role can only read that table, as SR-78 says (CONFLICT-1 here and CF-2 in the specification, both decided by [DEC:D18]) | 8.5 (R-5e, R-5f); 4.30; 6.6; 7.3 |
| SR-58, SR-68 | Reset only by the owner role `dems_owner`, which is not a superuser; `dems_app` has `NOCREATEDB`; the server never reads the superuser's password file and, with the demo flag off, not the owner's either | 7.1 (HC-1 to HC-5), 8.5 (R-0) |
| SR-02, SR-60, SR-77 | Three credential files, mode 0600, under `.data/` with mode 0700; discrete fields; no secret in an argument or an environment variable; `pg_hba.conf` without `trust` | 7.6 |
| SR-59 | No UPDATE on tracks and on the sealed columns; the tamper marker is a separate column | 4.17, 4.18, 7.3 |
| SR-62 | The seed writes the shared dataset only; fixture names are generated | 9.1 (SD-8), 11 (BF-4) |
| SR-67 | Bind parameters only | 5.4 (NL-3) |

### 14.6 Acceptance criteria this contract serves

AC-B-01 (8.1 MG-10), AC-B-02 (9.4), AC-B-04 (2.6, 9.6), AC-B-07 (no table for meter frames, 3.2), AC-B-17 (SD-5), AC-B-28 and AC-B-30 (section 5), AC-B-33 (4.7), AC-B-54 (section 6), AC-B-57 (8.5), AC-B-64 (7.6: the `stat` checks of T-CR-1), AC-B-65 (SD-8). From the specification's revision 2: AC-B-72 (7.1, 7.4, 8.5 R-0; T-RS-4, T-RS-5, T-CR-2, T-CR-3), AC-B-76 to AC-B-80 (5.6; T-AT-1 to T-AT-5), AC-B-81 (5.2), AC-B-82 (5.6 AT-C4), AC-B-86 (7.6; T-CR-2), AC-B-87 (4.30, 6.6, 8.5; T-RS-1, T-AO-3; its last clause, "INSERT by the runtime role is rejected", holds since the ruling on CONFLICT-1 and is the first case of T-AO-3).

### 14.7 Review corrections folded into this contract (D16)

Every correction of the review whose owning document is this contract (owning row 16 or 28 (W17) in [RV:§4]), and the ones owned elsewhere that leave one sentence here.

| Finding | Severity | What this contract now says | Sections |
|---|---|---|---|
| [RV:SD-01] | Medium | Three roles; the owner is not a superuser; the superuser at provisioning only; R-0 role check; boot check B-9; trial steps; what the running server may hold | 1.5, 1.7, 1.8, 1.9; 6.1, 6.2; 7.1 to 7.5; 8.1, 8.3, 8.4, 8.5; 9.1; 10; 11; 13.2 |
| [RV:SD-04] | Medium | Atomic state changes: rules AT-1 to AT-6, five cases with statements, five tests; the counters advance by one statement | 4.7, 4.10, 4.11; 5.2; 5.6; 12 (CL-19) |
| [RV:SD-06] | Low | The audit triggers are `ENABLE ALWAYS`; B-5 expects `'A'`; the trigger test has four cases, T-AO-2a to T-AO-2d | 1.9; 4.12; 6.1, 6.2, 6.3, 6.5; 7.4; 8.2; 10.1 |
| [RV:SD-09] | Low | The session lookup is bound to the transport: cookie to a session without a device, bearer to a session with one | 4.6; 5.2 |
| [RV:SD-10] | Low | `TOKEN_REUSE` in the closed set of session end reasons; a reuse ends the open biometric sessions of the device and operator; one new CHECK | 2.4; 4.6; 4.10; 5.2, 5.3, 5.6 (AT-C4); 11 |
| [RV:SD-15] | Low | Credentials inventory, file modes, discrete fields, no secret in an argument, generation, the `pg_hba.conf` check | 5.1; 7.1 (RP-1 to RP-6); 7.6; 8.4 |
| [RV:SD-19] | Low | The lineage table `audit_chain_history`, kept across every reset, protected like the audit table; rules LN-1 to LN-6 | 2.4; 3.1, 3.3; 4.30; 6.1, 6.3, 6.6; 7.3, 7.4; 8.2, 8.3, 8.5; 9.3, 9.4; 10.1; 11; 12 |
| [RV:SD-03] | Medium, owned by row 15 | One sentence: the denial budget bounds the growth of refusal rows | 13.2 (GD-07) |
| [RV:SD-21] | Low, owned by row 15 | No pepper column or key; the salt source; the hash is always computed | 5.1, 5.2 |
| [RV:SD-27] | Info, owned by rows 15 and 45 (W39) | The primary key of `audit_log` serves the incremental chain check | 4.12 |
| [RV:§6] GD-01 | ruling | Accepted as is; no digest CHECK | 6.1; 13.2 |
| [RV:§6] GD-02 | ruling | Option (a); closed with a stated residual | 7.1; 13.2 |

Findings with no database side, not reflected here: SD-02, SD-05, SD-07, SD-08, SD-11 to SD-14, SD-16 to SD-18, SD-20, SD-22 to SD-26, SD-28, SD-29. One of them leaves a note for row 19: the lookup that [RV:SD-11] introduces ("does a biometric token of this device and operator exist, live or used") has no index of its own; `biometric_tokens_one_live_key` covers the live case only. At the volumes of this task it is a scan of a small table (15.4).

---

## 15. Decisions for the controller to record

### 15.1 Choices made by this row

| # | Choice | Section |
|--:|---|---|
| 1 | 30 tables for the 26 stored entities: two entities have two tables each (`operators` and `operator_credentials`; `engine_counters` and `registry_counters`), the audit row has `audit_chain_head` beside `audit_log`, and `schema_meta` is added. Revision 1 had 29; the 30th is `audit_chain_history` (choice 20) | 3 |
| 2 | Time is `bigint` epoch milliseconds from the server clock in every table; no `timestamptz`, no database-clock default | 2.2 |
| 3 | Value sets are `text` with named CHECK constraints; no `ENUM` type. Closed sets are listed; audit type, event type, permission and custody action are checked by format only, so the additive vocabulary of row 26 (W16) needs no migration | 2.4, 8.1 |
| 4 | Password storage: separate columns (algorithm, memory, passes, parallelism, salt, hash) in a table of its own, with the floor of SR-05 as CHECK constraints | 4.5, 5.1 |
| 5 | Session token, device credential, biometric token: SHA-256 of the whole presented value as `bytea`, looked up through a unique index. Pairing code: SHA-256 of code ID, colon and code; compared in the server against the one active row, never looked up by hash. Code identifier format `PCD-NNNNNN` | 4.7, 5.1, 5.2 |
| 6 | Privileges per table and per column make five specification rules database rules: read-only matrix, no user creation or deletion, immutable sealed evidence, append-only records, no reset by the runtime role | 7.3 |
| 7 | Audit append-only: INSERT and SELECT only for `dems_app`, **and** a statement-level trigger that refuses UPDATE, DELETE and TRUNCATE for every role, because privileges do not bind the owner of a table. Revision 2: the triggers are `ENABLE ALWAYS`, and section 6.2 states exactly what binds the runtime role, the owner role and a superuser | 6.2, 6.3 |
| 8 | Chain serialisation: a single-row `audit_chain_head` table locked `FOR UPDATE` by an owner-defined lock function and again by the insert guard trigger, which refuses a row whose `seq` or `prev_hash` does not continue the head (SQLSTATE `ZA001`). The append protocol AP-1 to AP-7 | 6.3, 6.4 |
| 9 | The database does not recompute the digest (GD-01) | 6.1 |
| 10 | Payload guards in the database: flat maps only, and a deny list of 17 key names | 5.5 |
| 11 | The server's boot checks B-1 to B-9, among them the schema version from `schema_meta` (not from the migrator's table), a refusal to start with a role that could change the audit table, triggers in the mode `'A'`, and (B-9, new) an owner role that is not a superuser and owns the guarded objects | 7.4 |
| 12 | Migration set of four files in a fixed order; rules MG-1 to MG-11; applied under `dems_owner` | 8.1, 8.2 |
| 13 | Reset as build, carry over, swap, drop: R-0 to R-9 with a failure table, every database step as `dems_owner`, a role check at R-0 (`RESET_ROLE_PRIVILEGED`), eight kept tables | 8.5 |
| 14 | Hardware snapshot: one row with one JSON column per slice | 4.27 |
| 15 | Seed rules SD-1 to SD-8 and the clock rule DR-1 to DR-8; expected counts all marked as derived; a checksum recipe for rows 29 (W20), 48 (W29) and 55 (W53) | 9 |
| 16 | Test databases: three templates, one clone per test file, names `dems_test_<label>_<stamp>_...`, clones serialised by an advisory lock, stale databases removed after six hours; templates and clones owned by `dems_owner`; no test connects as the superuser | 10 |
| 17 | Bulk-fixture minimums: 5,000 audit rows, 2,500 events, 505 evidence items, 520 history entries, 25 lineage rows, and the rest of section 11 | 11 |

Choices added by revision 2, while folding the review's corrections. Each is this contract's reading of a correction that left the detail open. **All ten (18 to 27) are accepted by the controller** [DEC:D19]; section 15.6 records it.

| # | Choice | Correction | Section |
|--:|---|---|---|
| 18 | The names and steps of role provisioning: RP-1 to RP-6; both project roles are created by `pg:init` as `dems_admin`, and `db:create` creates no role | [RV:SD-01] | 7.1, 7.2 (OW-8) |
| 19 | Boot check B-9 covers more than the review's one query: besides `rolsuper` of `dems_owner`, it checks that the database, the three guarded tables and the two `SECURITY DEFINER` functions belong to that role | [RV:§5.2 item 3] | 7.4 |
| 20 | The lineage table: name `audit_chain_history`; ten columns, of which `reset_no`, `first_seq` and `last_seq` are not members of the specification's entry; one row per discarded chain and none for a first build; rules LN-1 to LN-6 | [RV:SD-19]; [DEC:D16] | 4.30, 6.6 |
| 21 | A second refusal function and trigger for the lineage table, with the same SQLSTATE `ZA002`, rather than one generic function | [DEC:D16] "the same trigger protection" | 6.3 |
| 22 | Atomic state changes are also safe without the serial pipeline: the chain lock first (AT-2), a consuming UPDATE on `failed_attempts` that also locks the code row and is given back by a successful redeem, a lock on every operator row for the last-administrator rule | [RV:SD-04] | 5.6 |
| 23 | No column is added for the reuse rule; one CHECK is (`auth_sessions_token_reuse_check`) | [RV:SD-10] | 4.6, 5.6 |
| 24 | The file `.data/pg.owner.env`; five keys per connection file with the prefix `DEMS_PG_`; the table of which process may read which file; the rules CR-1 to CR-7 and HA-1 to HA-4 | [RV:SD-15] | 7.6 |
| 25 | One trial step beyond the review's list: T5-i, the owner role cannot turn on statement logging | this contract (NL-5) | 7.1 |
| 26 | `pg_signal_backend` is not granted to `dems_owner`; the test helper closes its pools before a forced drop | [RV:§5.2 item 5] allows either | 10 (TI-10) |
| 27 | `schema_version` stays 1 and `contract_revision` becomes `dbc-2`: no migration of revision 1 exists | — | 4.29, 8.2 |

### 15.2 Specification gaps: decided by D14 (section 13.1)

None is open. D14 adopted the default of each.

| ID | One line | Decided rule |
|---|---|---|
| SPEC-GAP-1 | Text inputs may hold U+0000 or ill-formed UTF-16, which PostgreSQL cannot store or the chain cannot survive | DECIDED: one string rule in the contract registry (row 27 (W19)); nothing in the database |
| SPEC-GAP-2 | Pairing codes and the device and code counters are not in the kept list of a reset | DECIDED: both are kept |
| SPEC-GAP-3 | No state, reason or audit row for an `ACTIVE` code closed by a reset | DECIDED: `CANCELLED` at the reset time; no separate audit row (NOTE-3 of 15.5) |
| SPEC-GAP-4 | The health snapshot has no content and no reader | DECIDED: the 17 columns of T-28 |
| SPEC-GAP-5 | The epoch must be new after a reset but lives in a rebuilt record | DECIDED: continued, previous plus 1 |
| SPEC-GAP-6 | `lastSignInAt` after a reset for an operator whose session was kept | DECIDED: the newest kept session's issue time |
| SPEC-GAP-7 | One `signedInOperatorId` per device, but several open sessions per device are possible | DECIDED: several are allowed; the registry shows the newest; no schema rule |

### 15.3 Wording of earlier records that this row refines

| Record | Wording | This row | Status |
|---|---|---|---|
| TD-04 [AN:367] | The reset "ends the connections, drops and recreates the database, migrates and seeds" | The new database is created, migrated, seeded and filled beside the old one; the names are swapped; the old one is dropped last. Still a re-creation by the owner role; the order changes so that a failure cannot lose the sessions and devices | **Accepted by D14** |
| ADQ-4 [AN:567] | "One snapshot row (JSON)" | One row, with one column per slice (14 JSON columns and `active_camera_id`) | **Accepted by D14** |
| [SP:L288] | E-07 "may be columns of E-06" | A table of its own, like the password hash set | In D14's count of tables |
| TD-02 [AN:274], P15 [BP:458] | `dems_test_*` per test file; `dems_test_step_<N>` per row | Both: `dems_test_step_<N>_<stamp>_f<nn>_<slug>`, and three template databases per run | **Accepted by D14** |
| [SP:L1293] | The `SCENARIO_LOADED` row names "the head hash and row count of the discarded chain" | Detail keys `previousHead` and `previousRows` | Unchanged; the same two values are in the lineage row (LN-3) |
| TD-02 [AN:273], [DEC:D11] | Two roles: `dems_admin` (owner) and `dems_app` | Three roles; the owner is `dems_owner`, not a superuser | **Decided by D16**, recorded as DR-03 |
| [DEC:D14] | "29 tables ... (three entities split in two, plus `audit_chain_head` and `schema_meta`)"; "boot checks B-1..B-8"; "20 PostgreSQL behaviours (PG-1..PG-20)" | 30 tables (the description of the split is corrected in 3.1); B-1 to B-9; PG-01 to PG-28 | **Superseded by D19**, which records the new counts (15.6) |

### 15.4 Inputs for other rows

| Row | Input |
|---|---|
| 15 (specification, revision 2) | The two files were aligned while both were being revised; the specification's text of 05:09 cites this revision by section (4.30, 5.6, 7.1, 7.6, 8.5, 15.5). The names it left to this contract are fixed: `audit_chain_history`, `.data/pg.owner.env`. Its gap GS-28 listed three remaining points. Two are closed by rulings and applied here in revision 2.1: the runtime role only reads the lineage table (CONFLICT-1 here, CF-2 there; [DEC:D18]), so 7.3 now agrees with DC-6, SR-78 and AC-B-87; and the test with a real superuser is a provisioning check of `scripts/pg/` (CONFLICT-2; [DEC:D19]), while both files test the role check of R-0 with a stub. One remains as a matter of choice, not a contradiction: `first_seq`, `last_seq` and the check of LN-3, which this contract stores or computes and `AuditChainLineageEntry` does not carry. Where its AC-B-72 points at "[DB:§15.5], CONFLICT-2", the answer is now trial step T5-j of 7.1 |
| 17 (client specification) | `TOKEN_REUSE` is a value of `session.ended.reason` (2.4). The Security & Audit page reads the lineage through `verifyAuditChain` only (LN-4) |
| 18 (plan) | Command names of 8.4; constants `DB_SCHEMA_VERSION`, `AUDIT_DETAIL_FORBIDDEN_KEYS`; environment variable `DEMS_TEST_STEP`; the lock keys 442001 (reset) and 442002 (test clone); the first-time path of `dems_demo` is create, migrate, seed. **All of it is in the plan's revision 2** [DEC:D20], and so are the inputs that revisions 2 and 2.1 of this contract added: `pg:init` creates both project roles and the three credential files in W07, and `db:create` in W17 creates no role [PL:§3.4]; the file `.data/pg.owner.env` and five keys in each connection file, `DEMS_PG_DATABASE` among them [PL:§3.4]; the trial steps T3-a, T3-b and T5-a to T5-j in W07, of which T5-j is the superuser trigger check; W17's check with 30 tables, 98 named CHECKs, 25 foreign keys, 5 functions and 3 triggers, and the SELECT-only grant on the lineage table; the host-authentication check in `pg:status`. Nothing is left for the plan to pick up (row 19, finding C-07) |
| 19 (consistency check) | Section 15.5: two conflicts, both decided and applied, and four notes. Section 15.6: what the controller accepted. Section 14.7: what was folded and where. Its finding C-07 on this file (stale remarks about the plan's first revision) is answered by revision 2.2 |
| 20 (security review) | GD-01, GD-02; section 5; the seven gaps. Revision 2 answers its findings SD-01, SD-04, SD-06, SD-09, SD-10, SD-15 and SD-19 (14.7) |
| 23 (W07; provisioning) | The cluster needs encoding `UTF8` and locale `C` [AN:296]; the default logging settings must stay (NL-5). **New in revision 2:** RP-1 to RP-6: the directory mode, three passwords and three files, both roles created here as `dems_admin`, the host-authentication check HA-1 to HA-4, the trial steps as `dems_owner`, and the one step as the superuser, T5-j (the trigger check of T-AO-2c on a scratch table); the tests T-CR-1, T-CR-4 and T-HA-1 |
| 26 (W16; vocabulary) | No migration is needed for the additive values (MG-11) |
| 27 (W19; contract registry) | SPEC-GAP-1: one string rule for every text schema |
| 28 (W17, with W10 and W11; schema and migrations) | Sections 2, 4, 5.6, 6.3, 7, 8; DA-03 and the PG-n list to confirm (PG-21 to PG-28 are new); the catalog test; the database-level tests T-AT-1 to T-AT-5, T-AO-1, T-AO-2a, T-AO-2b, T-AO-2d, T-AO-3, T-AO-4, T-PV-1 to T-PV-3 (T-AO-2c does not belong to row 28 (W17): it runs at provisioning, in W07). The migration set is applied as `dems_owner`. `0003_privileges` grants INSERT on 16 tables; `audit_chain_history` is not among them [DEC:D18] |
| 29 (W20; seed) | Section 9; ST-1 to ST-6 |
| 30 (W25; bulk fixture) | Section 11 |
| 31 (W21; audit writer) | AP-1 to AP-7; T-AO, T-CH |
| 32 (W24, W41; identity) | 5.2 (transport binding); 5.6: AT-C1, AT-C4 and the session transitions; the reuse statements of [RV:SD-10]. One observation without an owner yet: the lookup of [RV:SD-11] ("a biometric token of this device and operator exists, live or used") has no index of its own; it is a scan of a small table, and an index `(device_id, operator_id)` can be added before the gate of row 28 (W17) if row 19 asks for it |
| 35 (W33; administration) | 5.6: AT-C5, the lock on the operator rows and the two compare-and-set updates |
| 36 (W32; pairing) | DA-05; the code hash input of 5.1; the comparison in the server (5.2); 5.6: AT-C2, AT-C3, the consuming UPDATE that comes after the redeem lock and before the comparison |
| 37 (W26; engine host) | MR-1 to MR-9; GD-03 |
| 48 (W29, W43; demo controls) | R-0 to R-9 with the role of every step; the role check and `RESET_ROLE_PRIVILEGED`; HC-1 to HC-4; the lineage rules LN-1 to LN-6; T-RS-1 to T-RS-6 |
| 50 (W45), 111 (W99), 112 (W100) (later security reviews) | To re-check against code: HC-1 to HC-5 (what the server holds), 6.2 (what binds which role), GD-13 and GD-14, the static tests T-AO-4 and T-CR-2 |

### 15.5 Conflicts (both decided) and notes

**Both conflicts of revision 2 are DECIDED by the controller and applied in revision 2.1.** In each, a correction contradicted a rule of this contract or another correction; revision 2 wrote a working default and asked for a ruling. Nothing is open.

| ID | The correction | What it conflicted with | Ruling | Applied in revision 2.1 |
|---|---|---|---|---|
| **CONFLICT-1 — DECIDED** [DEC:D18, D19] | The lineage table gives the runtime role `dems_app` INSERT and SELECT (the brief of row 20a, item 5; D16: "covered by the same privileges"). Revision 2 granted both | (1) Least privilege, a rule of this contract (CL-11; 1.5 step 8): no operation of the runtime role writes the table; only the reset routine does, as `dems_owner`. (2) The review gives the runtime role SELECT only [RV:SD-19 (i)]. (3) The specification's revision 2 kept the review's wording, "the runtime role can only read it" [SP:E-26; DC-6; SR-78], and recorded the same point as its conflict CF-2 | **SELECT only.** `dems_app` has SELECT only on `audit_chain_history`; rows are appended only by the reset routine under `dems_owner`. D16's phrase "covered by the same privileges" meant the same trigger protection, not INSERT for the runtime role | The grant of 8.3 (INSERT on 16 tables, without this one); the cells of 7.3 and 3.3; boot check B-5, which now also expects INSERT on the table to be false; 4.30; 6.1 (G-7), 6.2, 6.3, 6.5 (T-AO-3 gains the refused INSERT), 6.6 (LN-1, LN-4); 12 (CL-11); 13.2 (GD-14, GD-15); 14.5, 14.6. The reset routine of 8.5 needed no change: it already wrote as `dems_owner`. The contract now agrees with [SP:DC-6; SR-78; AC-B-87] |
| **CONFLICT-2 — DECIDED** [DEC:D19] | A test "as the bootstrap superuser with the setting on" [RV:SD-06], assigned to row 28 (W17) | `dems_admin` is used at provisioning only, and no file under `apps/core-server/` reads its password file [RV:SD-01]; [DEC:D16]; [SP:SR-68]. A test of `test:db` cannot connect as the superuser without breaking that rule | **Accepted: a check of `scripts/pg/`, run at provisioning, outside `test:db`.** Nothing under `apps/core-server/` reads the superuser's password file. The role check of R-0 is tested with a stub (T-RS-4), as the specification's AC-B-72 does | 6.5 (T-AO-2c); 7.1 (trial step T5-j; RP-5 and RP-6; the roles table); 7.6; 10 (TI-9); 1.9 (PG-21). One point of timing follows from the ruling's words; it is NOTE-4, which the controller accepted |

**Four notes.** None is open: NOTE-1 is reconciled, NOTE-2 and NOTE-3 are confirmed, NOTE-4 is accepted. (They are numbered NOTE-n so that they cannot be taken for the naming rules N-1 to N-6 of section 2.1. Revision 2 called the first three N-1 to N-3; a citation `[DB:§15.5 N-1]` in another file means NOTE-1.)

| ID | Note | For |
|---|---|---|
| NOTE-1 | **RECONCILED** (row 19, finding C-07; [DEC:D20]). The connection files have five fields, as the review and the specification say (host, port, database, user, password). The plan's first revision listed four keys for `pg.env` and derived the database from the instance port; its revision 2 lists the same five keys per file as this contract [PL:§3.4], with `DEMS_PG_DATABASE` as a default that the port rule and `--database` override (CR-1). The ten key names are equal in both files | Closed |
| NOTE-2 | The review counts five concurrency tests and lists four. This contract and the specification both take the sign-in lockout as the fifth (AT-C1; AC-B-80); the controller confirmed it [DEC:D18]. The specification's own conflict on the first test (CF-1) is ruled too: AC-B-76 keeps the accepted parameters, three counted failures, the lock, two more, closed at exactly five [DEC:D18]. T-AT-2 here stays a test of the statement at the database level, where no lock is in play | Row 19 |
| NOTE-3 | SPEC-GAP-3: a code that was `ACTIVE` at a reset is written `CANCELLED` and gets no `PAIRING_CODE_CLOSED` row. Confirmed by the controller: the reset rebuilds the trail, and the lineage table records the reset [DEC:D18] | Row 48 (W29) |
| NOTE-4 | **ACCEPTED by the controller** [DEC:D19]; the plan's revision 2 carries it in W07 [DEC:D20]. **Timing of the superuser trigger check.** Revision 2 had placed T-AO-2c at the gate of row 28 (W17), against a test clone: one use of `dems_admin` after provisioning. The ruling says "run at provisioning (the only place `dems_admin` is legitimately used)", and revision 2.1 follows those words. At provisioning the real triggers do not exist yet (row 28 (W17) writes the migration set), so trial step T5-j proves the behaviour, PG-21, on a scratch table with a trigger of the same text; that the real triggers carry the mode `'A'` is read from the catalog in `test:db` (T-AO-2d), at every start (B-5) and before every swap (R-6), with no superuser. No use of `dems_admin` remains after provisioning. Row 23 (W07) has this one trial step more | Closed |

### 15.6 Accepted by the controller

Recorded by revision 2.1 from the controller's rulings on row 20a [DEC:D18, D19]; the last two rows were added by revision 2.2 [DEC:D19, D20].

| Item | What was accepted | Where it lives |
|---|---|---|
| The ten folding choices | Items 18 to 27 of 15.1. Among them: boot check B-9 also checks the ownership of the guarded objects (item 19), and the last-administrator rule locks every operator row (item 22) | 15.1; 7.4; 5.6 |
| The residual of GD-02 | With the demo flag on, a compromised server could act as `dems_owner` during a reset. It cannot skip the triggers by a session setting, and it cannot create a role | 7.1 (HC-5); 13.2 (GD-02) |
| The superseding counts | 30 tables; boot checks B-1 to B-9; PostgreSQL behaviours PG-01 to PG-28; 98 named CHECKs; 25 foreign keys; 302 columns. They supersede the counts recorded with D14 (29; B-1 to B-8; 20; 93; 24; 292). Revision 2.1 changes none of them | Revision history; 15.3 |
| CONFLICT-1 | The runtime role only reads the lineage table | 15.5; 7.3 |
| CONFLICT-2 | The superuser trigger check is a provisioning check of `scripts/pg/`, outside `test:db`; the R-0 role check is tested with a stub | 15.5; 6.5; 7.1 |
| The timing of the superuser trigger check (NOTE-4 of 15.5) | The check runs at provisioning as trial step T5-j, on a scratch table; after W07 nothing connects as `dems_admin` [DEC:D19, D20] | 15.5; 7.1 (T5-j, RP-6) |
| The names and the connection keys | The plan's revision 2 pins the names this contract uses: `.data/pg.owner.env`, five keys in each connection file, the `db:*` and `pg:*` commands [DEC:D20] | 7.6; 8.4; NOTE-1 |
| The fifth concurrency test and the code cancelled by a reset | NOTE-2 and NOTE-3: the sign-in lockout is the fifth test; a code cancelled by a reset gets no `PAIRING_CODE_CLOSED` row | 15.5; 5.6; 8.5 |

---
*Generated: 2026-10-04 03:53 (revision 1)*
*Last Updated: 2026-10-04 06:06 (revision 2.2, contract revision `dbc-2`)*
