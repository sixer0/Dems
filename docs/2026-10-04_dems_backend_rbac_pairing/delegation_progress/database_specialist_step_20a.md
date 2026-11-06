---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: database-specialist
step: 20a (controller row added by decision D16; revises the output of blueprint row 16)
status: complete
date: 2026-10-04
last_updated: 2026-10-04 06:06
---

# Progress: database-specialist, step 20a (database contract, revisions 2, 2.1 and 2.2)

## Status

**complete.** Revision 2 folded the review's corrections into the contract and raised two conflicts. Revision 2.1 applied the controller's rulings on both (D18, D19). Revision 2.2 is a text-only patch after the masterplan consistency check (finding C-07, Minor): the contract now describes the plan's revision 2. Nothing is open in the contract.

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/03_database_contract.md` | revised in place: revision 2.2, contract revision `dbc-2`, schema version 1, 2,670 lines (2.1: 2,641; 2: 2,619; 1: 2,031) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/database_specialist_step_20a.md` | updated (this file) |

Nothing else was written. `masterplan/01_specs.md`, `masterplan/04_client_integration_spec.md`, `masterplan/02_plan.md`, `gateway_check/02_masterplan_consistency.md`, `decisions/decisions.md`, `status_tasks.md` and `delegation_progress_report.md` were read or left alone, never written. `git status --porcelain -- apps packages scripts release package.json package-lock.json .gitignore` printed 0 lines at the end. No install, no database, no code, no process: PostgreSQL is still not installed, so no SQL statement of the contract has been executed.

## Revision 2.2: what changed (text only; no rule, table, statement or count)

| Request | What was done | Where |
|---|---|---|
| C-07: sentences that still described the plan's first revision | Rewritten to the plan's revision 2 (D20): five keys in each connection file with `DEMS_PG_DATABASE`; both project roles created by `pg:init` in W07; `db:create` in W17 creates no role; the counts of W17's check; the trial steps in W07. The remark "the plan's W17 says ..." is deleted and "leaves the reconciliation to row 19" is replaced by "reconciled" | 7.6 (intro and CR-1); 8.4; 1.4; 15.4 (the plan row and the row-19 row); 15.5 (NOTE-1) |
| NOTE-4 accepted | Marked **ACCEPTED** (D19; carried by W07 in the plan, D20); NOTE-1 marked RECONCILED; both added to the record of 15.6 | 15.5; 15.6 |
| Binding decisions | Front matter: D1-D20 and DR-01 to DR-04 | front matter |
| Work-row IDs beside provisional blueprint rows | Every citation of a provisional row (23 to 118 of blueprint rev 1) now carries the plan's work-row ID, as in "row 28 (W17)": 133 row numbers in the text and 15 in the row cells of 15.4. The mapping is the plan's section 21 only; it is reproduced as a table in section 0 of the contract. Where the plan splits a row, the part was taken from the plan's own description of the work row: 23 is W07 (W03 is the npm part); 27 is W19 (the part that carries the string rule of SPEC-GAP-1); 28 is W17, with W10 where the point is what `drizzle-kit` emits and W11 where it is the test helper; 32 is W24 and W41; 37 is W26; 48 is W29 for the routine and W29, W43 where the demo controls as a whole are meant | section 0 (table); throughout |
| Citation of the plan | `[PL:names]` (the name table as it stood at 04:36) became `[PL:§3.4]` and `[PL:§21]` of the plan's revision 2 | section 0; 7.1, 7.6, 8.4 |
| One revision-history line | Row 2.2, naming C-07 | top of the file |

The work-row IDs were added by a small script (dry run printed all 110 planned changes, which were read before applying; 23 more had been written by hand where the context needed a specific part or a possessive had to be reworded). A second run of that script finds nothing left.

### One thing for the plan's owner (not changed by me)

Revision 2.1 renamed the notes of contract section 15.5 from N-1..N-3 to NOTE-1..NOTE-4, because they collided with the naming rules N-1 to N-6 of section 2.1. The plan's revision 2 still cites "[DB:§15.5 N-1]" in two places (its revision history and its section 3.4). The contract now says in 15.5 that such a citation means NOTE-1, so nothing dangles; the plan can correct the two citations at its next patch.

## Consistency checks (script, read-only, last run 2026-10-04 06:04 WIB on the patched text: 66 checks, 0 failed)

| Check | Result |
|---|---|
| Table sections 4.1 to 4.30 = inventory 3.3 = privilege matrix 7.3 | 30 = 30 = 30, same names, `T-nn` equals the section number |
| Seed table 9.4 and fixture table 11 cover every table once | 30 of 30 in both |
| Entity map | E-01 to E-26, each once |
| Constraint and index names unique | 192 names, no duplicate; each starts with its table name; lower-case `snake_case`; at most 63 bytes; suffix matches the kind |
| Counts | 302 columns, 30 primary keys, 25 foreign keys, 15 UNIQUE and 2 partial unique indexes, 22 further indexes, 98 named CHECKs (unchanged by 2.1 and 2.2) |
| Granted columns exist; `GRANT INSERT` of 8.3 = I column of the matrix | pass; 16 tables |
| The two rulings (10 checks, from 2.1) | pass: SELECT only on `audit_chain_history` in the matrix, the grant, the inventory and B-5; both conflicts DECIDED; trial step T5-j; section 15.6 |
| The plan alignment (5 checks, new in 2.2) | The seven connection key names and `.data/pg.owner.env` are the same in the plan's revision 2 and in the contract; no sentence still describes the plan's first revision as current; NOTE-1 RECONCILED and NOTE-4 ACCEPTED; front matter D1-D20 and DR-01..DR-04; the history row 2.2 names C-07 |
| Work-row IDs (3 checks, new in 2.2) | The script parses the plan's section 21 (95 provisional rows mapped); every one of the 148 cited provisional row numbers carries a work-row ID; every ID beside a row number is one that section 21 gives for that row |
| Rule and test IDs defined once, contiguous; every referenced ID defined | pass |
| Markdown tables with a constant cell count; code fences balanced | pass |
| No credential value | The values of `DEMO_OPERATOR_PASSWORD` and `DEMO_PAIRING_CODE` (read from `dataset.ts` by the script, never printed) do not occur; no password literal, no connection URL with a password, no `key=value` secret, no token value; every `PASSWORD` in a statement is followed by `'...'` |
| No personal data | No operator name, display name or username of the dataset occurs (the absolute workspace path is masked first; 2 occurrences, both from revision 1) |

The scripts are in the session scratchpad, not in the repository.

## Revision 2.1, for the record

| Conflict | Ruling | What changed in the contract |
|---|---|---|
| CONFLICT-1 — DECIDED (D18, D19) | `dems_app` has SELECT only on `audit_chain_history`; rows are appended only by the reset routine under `dems_owner` | 8.3 (INSERT on 16 tables); 7.3; 3.3; 7.4 (B-5 also expects INSERT false); 4.30; 6.1 to 6.3; 6.5 (T-AO-3); 6.6; 12; 13.2; 14.5; 14.6 |
| CONFLICT-2 — DECIDED (D19) | The superuser trigger check of SD-06 is a `scripts/pg/` check at provisioning, outside `test:db`; the R-0 role check is tested with a stub | 6.5 (T-AO-2c); 7.1 (trial step T5-j, RP-5, RP-6); 7.6; 10 (TI-9); 1.9 (PG-21) |

Section 15.6 of the contract records what the controller accepted: the ten folding choices of 15.1 items 18 to 27, the residual of GD-02, the superseding counts (30 tables, B-1 to B-9, PG-01 to PG-28, 98 named CHECKs, 25 foreign keys, 302 columns), the two rulings, NOTE-2 to NOTE-4, and the names shared with the plan.

## Revision 2, for the record (brief items 1 to 9)

| # | Item | Where in the contract |
|--:|---|---|
| 1 | SD-01 / DR-03: three roles; role provisioning RP-1 to RP-6 and trial steps; what the running server may hold (HC-1 to HC-5); the role of every reset step and the role check at R-0; boot checks B-4 and B-9; templates and clones owned by `dems_owner`; what binds a superuser and what does not | 6.1, 6.2; 7.1 to 7.5; 8.1, 8.3, 8.4, 8.5; 9.1; 10; 11; 13.2 |
| 2 | SD-06: the audit triggers and the lineage trigger `ENABLE ALWAYS`; B-5 expects `'A'` | 6.3; 6.5; 7.4 |
| 3 | SD-10: `TOKEN_REUSE` in the closed set of session end reasons; the reuse rule | 2.4; 4.6; 5.3; 5.6 (AT-C4) |
| 4 | SD-04: rules AT-1 to AT-6; five cases with their SQL patterns; tests T-AT-1 to T-AT-5 | 5.6; 4.7, 4.10, 4.11; 5.2 |
| 5 | SD-19 (D16): the lineage table `audit_chain_history` (T-30, entity E-26); rules LN-1 to LN-6 | 4.30; 3.1, 3.3; 6.3, 6.6; 7.3; 8.2, 8.3, 8.5; 9.3, 9.4; 10.1; 11 |
| 6 | SD-15: three credential files, key names only, modes, who reads which, the `pg_hba.conf` check | 7.6; 7.1 |
| 7 | D14: SPEC-GAP-1 to SPEC-GAP-7 marked DECIDED | 13.1; 15.2; 15.3 |
| 8 | SD-09 (transport binding); one sentence each for SD-03, SD-21, SD-27, GD-01, GD-02 | 4.6, 5.2; 14.7 |
| 9 | Revision history at the top; consistency checks re-run and stated | top of the file |

## Still true for later rows

1. Every new PostgreSQL behaviour is a hypothesis (PG-21 to PG-28), each with the row that proves it: row 23 (W07) or row 28 (W17). If T5-a to T5-e fail, the row stops for a decision; the superuser is not put back. If T5-j fails, guarantee G-2 does not hold against a superuser session and the protection rests on HC-1 alone.
2. The contract's `[SP:Lnnn]` citations point at the specification of 03:14 (GD-16); check by rule ID, not by line.
3. One matter of choice between the contract and the specification: `first_seq`, `last_seq` and the agreement check LN-3 are stored or computed by the contract and not carried by `AuditChainLineageEntry`.
4. An observation without an owner: the lookup that SD-11 introduces has no index of its own; at these volumes it is a scan of a small table.

## Deviations from the agent's standard workflow

- `masterplan/02_plan.md` was not updated: another agent owns it, and the brief forbids touching it.
- No `implementation/99_implementation_report.md` or `99_database_report.md` was written: the brief names exactly one target file plus this progress file.
- The plan, the specification, the consistency check and `decisions/decisions.md` (D18 to D20, DR-04) were read, not written.

---
*Last Updated: 2026-10-04 06:06*
