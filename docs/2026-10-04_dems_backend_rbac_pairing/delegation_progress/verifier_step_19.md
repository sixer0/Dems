# Delegation progress: verifier, blueprint row 19 (FIRM)

| Field | Value |
|---|---|
| Task | DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing |
| Row | 19: check the masterplan for coverage and cross-consistency, read-only |
| Agent | verifier (session model, tier R) |
| Started / finished | 2026-10-04, after 05:32 WIB (the newest input file at the first listing; the start itself was not timed) / 05:52 WIB (`date`) |
| Status | **complete** |
| Verdict | **PASS-WITH-NOTES** (0 Blocker, 2 Major, 11 Minor) |

## Files created or updated

| Path | Action |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/02_masterplan_consistency.md` | created (the one expected output; Tier 2) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/verifier_step_19.md` | created (this file) |

No source file, no masterplan file, no decision file and no shared tracker was edited. The four masterplan files and `decisions/decisions.md` have the same size after the check as before it (270,122 / 249,133 / 293,840 / 227,441 / 55,333 bytes). The check scripts are in the session scratch folder (`row19/`), outside the repository. No code was run, no process started, nothing installed.

## What was checked (the controller's four verification points)

| Verification point of the row | Result |
|---|---|
| A matrix marks each of the 13 areas, 25 questions, 11 criteria and 16 defaults PASS or FAIL with a section anchor | 65 of 65 PASS, each with document and section (report section 2); U1-U9: none is required by any document |
| Zero operations without a permission or an audit type | 0 of 75 (4 PUBLIC, 5 DEVICE, 25 AUTHENTICATED, 40 with one permission, 1 any-of; 27 GET, 48 POST) |
| Zero entities without a table | 0 of 26; 30 tables in the inventory, the headings, the entity map and the privilege matrix |
| Zero AC without a plan row | AC-B 93 of 93, AC-C 110 of 110, SR 82 of 82, recomputed from the "Implements" cells |
| Each FAIL names the owning row | No FAIL. Each of the 13 findings names its owning row and the exact correction |

Also confirmed by script: 105 plan rows, all with a real agent, existing and acyclic dependencies, a verification and a rollback; 0 write-path overlaps between rows without a dependency path; no wave above 6 of one type or 8 in flight (peak 7); serial resources with one holder at a time; all 42 simulator actions mapped or excluded (compared with the code); SD-01 to SD-29 reflected in the specifications and, for the 27 that need one, in a plan row; no package with two versions; ports, file names, command names, role names, pairing parameters, session timings, Argon2id parameters and cookie rules equal across the files; 0 credential values and 0 personal data in the four files.

## Findings for the controller to record

| ID | Severity | Owning row | In one line |
|---|---|---|---|
| C-01 | Major | 15 | `01_specs.md` still marks CF-1, CF-2, OP-1, GS-24, GS-25 (and GS-28, GS-29) as open, inside ID-1, AC-B-76, AC-B-87 and section 19.6, although D18 ruled them. The rules it states equal the rulings; only the markers and one sentence about the contract ("grants the INSERT") are stale |
| C-02 | Major | 18 | W71 owns `apps/core-web/src/features/storage/**`, which contains the test file W01 fixes. Section 4.3 does not list it; W71's rollback R-CO would undo W01's fix; the client gate (a) cannot hold for that file. Not a collision (W71 depends on W01) |
| C-03 | Minor | 15 | The spec lets `dems_admin` and its password file be used "at removal"; contract, plan, D19 and D20 say provisioning only |
| C-04 | Minor | 15 | Spec section 2.2 places HB-3 in `modules/demo/`; the plan builds it in `src/db/reset/` (D17) |
| C-05 | Minor | 17 | Client spec section 9.5: "the existing release-gate test gains the LIVE cases" against AC-C-83, D17 and W82 (file unchanged, new file) |
| C-06 | Minor | 17 | Client spec FC-13 and section 17.5 still speak of OP-1 as open |
| C-07 | Minor | 16 | Contract CR-1, section 15.4 and NOTE-1 still describe the plan's revision 1 (four keys; W17 creates a role). Reconciled by this row: the ten key names are equal |
| C-08 | Minor | 18, 21 | 24 read-only rows state "(none)" as owned write paths and name no output document |
| C-09 | Minor | 18 | "W06 probes before W07 binds" is not enforced by a dependency (W07 probes 4432 itself) |
| C-10 | Minor | 18 | Section 7.2 names nine row-and-finding pairs whose rows cite neither the finding nor its criteria |
| C-11 | Minor | 15, 17 | Front matter: binding decisions D1-D16; contract revision "in progress" |
| C-12 | Minor | 21 | The specs cite provisional blueprint row numbers; the mapping to W-numbers is the plan's section 21 (all cited rows map) |
| C-13 | Minor | 18 | `CORE_SERVER_PORT` names both a shell variable and a shared constant |

## Milestones

1. Inputs read: translated task, decisions D1-D20 with DR and F, security design review sections 1-7, row 19 of the blueprint.
2. Operation tables parsed: 75 operations, access and audit rule per operation, permissions and audit types against the lists and the code.
3. Entities against tables; three roles and their privileges across the spec, the contract and the plan.
4. Plan rows parsed: attributes, dependency graph, waves, serial resources, collision scan, criteria coverage recomputed.
5. Names, numbers, versions, decisions and leftovers compared across the four files.
6. Output written; structure checked (first line is the verdict; 13 / 25 / 11 / 16 / 9 matrix rows; 29 finding rows of the review; 13 findings).

## Blockers

None.

## Decisions and notes for the controller

- **No FAIL**, so DR-04's patch route to row 21 is not triggered by a failure. C-08 and C-12 are the two findings that row 21 can absorb in the blueprint (an Output path per read-only row; the provisional-to-W mapping).
- C-01 and C-02 are worth a short correction slot before the rows that read them start: C-01 before W17, W24 and W32 (owner of `01_specs.md`); C-02 before W71 (owner of `02_plan.md`). Both corrections are text only; no W-number, wave or dependency moves.
- The row's criterion "every plan row has owned write paths" is met for the 81 rows that write source or host paths; the other 24 are explicit "(none)" (C-08). The controller may want to rule whether that wording is acceptable or whether each read-only row must name its report file.
- Limits of this check are listed in section 12 of the output: rows 23-118 of the blueprint were not used; nothing was executed; 69 of the 105 rows were checked by their structured cells only; several long sections were checked by script (IDs, names, numbers, markers) and not read line by line.
