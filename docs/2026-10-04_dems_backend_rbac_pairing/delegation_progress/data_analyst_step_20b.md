---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: data-analyst
step: 20b (controller row added by decision D16), with the revision 2.1 patch after the masterplan consistency check
status: complete
date: 2026-10-04
last_updated: 2026-10-04 06:05
---

# Progress: data-analyst, step 20b (security corrections folded into the two specifications)

## Status

complete. Both files are at revision 2.1. Revision 2 folded the security corrections (D16); revision 2.1 is the text-only patch the controller asked for after the masterplan consistency check (`gateway_check/02_masterplan_consistency.md`, PASS-WITH-NOTES). The five points that revision 2 left for the controller were ruled by D18 and are marked DECIDED; no open marker is left in either file.

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md` | updated in place: revision 2.1, 2,236 lines (revision 2: 2,226; revision 1: 1,901) |
| `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/04_client_integration_spec.md` | updated in place: revision 2.1, 1,607 lines (revision 2: 1,599; revision 1: 1,483) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_analyst_step_20b.md` | updated (this file) |

No other file was written. `masterplan/02_plan.md`, `masterplan/03_database_contract.md`, `identification/02_structured.md`, `decisions/decisions.md` and the consistency report were read, not edited. `git status --porcelain -- apps packages scripts release package.json package-lock.json` printed 0 lines after the work. No install, no code, no process. Every edit was an exact-match replacement that asserted one match; the row citations were annotated by a script whose second run found nothing left to change.

## Revision 2.1 (patch after the consistency check)

| Finding | File | What was changed |
|---|---|---|
| C-01 | `01_specs.md` | CF-1, CF-2, OP-1, GS-24 and GS-25 are marked "DECIDED [DEC:D18]" at ID-1, E-26, DC-6, SR-78, section 12.4, AC-B-76, AC-B-80, AC-B-87, GS-24, GS-25, GS-28, GS-29 and section 19.6. Removed: the bold conflict marker of AC-B-76, "depends on the ruling on CF-2" in AC-B-87, the sentence that the contract grants the INSERT and the two files disagree, the "default that needs the controller's decision" sentence of ID-1, "To confirm". The rules did not change: each stated already what D18 ruled |
| C-03 | `01_specs.md` | Section 2.1 (C-6) and section 14.1: `dems_admin` and its password file are used at provisioning only (`initdb`, creating the two other roles, trial step T5-j); removal needs no connection; after the provisioning row nothing connects as `dems_admin` [D19, D20]. AC-B-72: the superuser clause is tested with a stub; the real superuser check is trial step T5-j |
| C-04 | `01_specs.md` | Section 2.2: HB-3 (the reset routine) is in `db/reset/`; `modules/demo/` calls it; new row for `db/commands/`, `db/mapping/`, `db/reset/`; HB-13 has its host half in `engine/` and its mapping half in `db/mapping/` [D17]; `core/` holds the serial unit-of-work queue [D20] |
| C-05 | `04_client_integration_spec.md` | Section 9.5, "Release build": the existing release-gate test passes unchanged and the LIVE cases are a new test file [D17] |
| C-06 | `04_client_integration_spec.md` | FC-13 and section 17.5: OP-1 is decided; no client change. FC-11 (LB-10) and the nine choices marked accepted [D18] |
| C-11 | both | Front matter: revision 2.1; binding decisions D1-D20, DR-01 to DR-04; the sibling files at their current revisions |
| C-12 | both | Every cited provisional blueprint row (23 to 118) is followed by its work rows in brackets, as section 21 of the plan maps them; the convention is stated in section 0 of each file. Also the stale remarks of the client file's section 9.6 and wiring map ("no row owns this script / this folder"): W13 and W51 own them per the plan |

Method of C-12: the mapping was read by script from the table of plan section 21 only (96 provisional rows, row 41 skipped). A single row gets its work rows ("row 62 (W05, W50, W54)"); a list or range gets the union; a run of three or more is written "W63 to W65". Where a provisional row was split, all its work rows are named. Three lists that mixed firm and provisional rows were reworded so that the brackets cannot be read against a firm row. Not annotated: row 41 (skipped, no work row), rows 1 to 22 (firm), and the one mention of the blueprint's whole block "23-118" in the method section.

## Marker scan (command: `python3 check21.py` in the scratchpad; output quoted)

```
[SP] open markers: needs controller decision = 0; needs the controller's decision = 0; CONFLICT (not counting the detail value CREDENTIAL_CONFLICT) = 0; OPEN — = 0; depends on the ruling = 0; DEPARTURE — = 0; Controller (confirm) = 0; To confirm = 0; until the controller rules = 0; the two files disagree = 0; grants the INSERT = 0; TODO / TBD / FIXME = 0
[SP] CREDENTIAL_CONFLICT (a detail value, not a marker): 9; 'DECIDED [DEC:D18]': 17
[SP] prose citations of a provisional row: 70 with the work rows of [PL:§21]; without: []; with other work rows: []
[SP] every numbered list has the same IDs in the same order as revision 2: True
[SP] operation rows: 75; byte-equal to revision 2: True
[CL] open markers: needs controller decision = 0; needs the controller's decision = 0; CONFLICT (not counting the detail value CREDENTIAL_CONFLICT) = 0; OPEN — = 0; depends on the ruling = 0; DEPARTURE — = 0; Controller (confirm) = 0; To confirm = 0; until the controller rules = 0; the two files disagree = 0; grants the INSERT = 0; TODO / TBD / FIXME = 0
[CL] prose citations of a provisional row: 90 with the work rows of [PL:§21]; without: []; with other work rows: []
[CL] 'Row' column cells with a provisional row: 187 with the work rows of [PL:§21]; without or different: []
[CL] every numbered list has the same IDs in the same order as revision 2: True
PROBLEMS: none
```

The word CONFLICT remains only inside `CREDENTIAL_CONFLICT`, the value of `details.reason` for a request with two credentials (9 occurrences in the server file, accepted by D18).

## Consistency checks, re-run on revision 2.1 (command: `python3 check.py`; output quoted)

```
[SP] operations: 75 rows; numbers 1..75 complete: True
[SP] GET 27 / POST 48
[SP] access rules: {'PUBLIC': 4, 'DEVICE': 5, 'AUTHENTICATED': 25, 'ANY-OF': 1, 'permission': 40}
[SP] matrix: 12 permissions; grants per role [4, 10, 4], total 18; rows equal to revision 1: True
[SP] SR-nn rows: 82; 1..82 gap-free and unique: True; duplicates: []
[SP] AC-B-nn rows: 93; 1..93 gap-free and unique: True; duplicates: []
[CL] AC-C-nn rows: 110; 1..110 gap-free and unique: True; duplicates: []
[CL] synchronous site IDs: 70; same set and order as revision 1: True
PROBLEMS: none
```

Also clean: every item and section reference resolves in both directions; the `[DB:§n]` references match headings of the database contract as it stands; 0 table rows with a wrong cell count; the wiring map differs from revision 2 only in its "Row" column and in three cells that cite a row. Credential scan: 0 matches in both files for the demo password literal, the simulator's pairing code literal, the nine operator name and username strings of the dataset, and any token-shaped string (the literals were read into shell variables and never printed).

## Revision 2 (kept for the record)

Every correction of the security design review owned by rows 15 and 17 was written into the section where its rule lives. Server file: SR-68 to SR-82 (15 new, 27 changed in place), AC-B-72 to AC-B-93 (22 new, 13 changed in place); new rules ID-12, ID-13, ID-P13, ENG-23 to ENG-27, OR-9, OR-10, RT-P14, DC-10, API-13, SU-1 to SU-3, SA-12 to SA-16, entity E-26. Client file: AC-C-102 to AC-C-110 (9 new, 4 changed in place); new rules WT-2a, RC-3, LB-10, MB-6a, PG-6a, AR-3a, AR-9, CA-11. The operation count (75), the IDs, methods, paths and access markers, and the role matrix are those of revision 1.

## For the controller

| Item | State |
|---|---|
| CF-1, CF-2, OP-1, GS-24, GS-25 | DECIDED by D18 and marked so in the files |
| The 13 server and 9 client value choices; LB-10 | Accepted by D18 and marked so (server section 19.6; client section 17.5) |
| Observation on the plan (not edited) | Section 21 and the "Prov." column of the plan's row tables differ on two provisional rows: section 21 gives row 25 the work rows W03, W08, W09 and the "Prov." column only W03, W08; section 21 gives row 79 the work row W56 and the "Prov." column W15 and W56. The two specifications follow section 21, as instructed |
| Observation on the database contract (not edited) | Its front matter says revision 2.2; the specifications cite "revision 2.1" for the rulings of D18 and D19 and name no later revision |
| Extra line beyond the findings | Server section 2.2, `core/`: "the serial unit-of-work queue ..., which the engine host shares [DEC:D20]", so that the folder table agrees with D20 |

## Blockers

None.
