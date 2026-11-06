---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: data-analyst
step: 18 (blueprint row 18, FIRM); revision 2 and revision 2.1 at the controller's request
status: complete
date: 2026-10-04
last_updated: 2026-10-04 06:14
---

# Progress: data-analyst, step 18 (implementation plan)

## Status

complete (revision 2.1 of the plan; revision 1 was accepted by D17, revision 2 by D20)

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md` | **updated to revision 2.1** (Tier 1, 1,745 lines, a revision history and sections 0 to 23, 105 work rows W01 to W105, 6 conditional fallback rows, 4 reserved numbers W106 to W109) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_analyst_step_18.md` | updated (this file) |

No other file was written. `delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`, the three sibling specifications, `identification/02_structured.md` and the files under `gateway_check/` were read only. No install, no project code, no server, no emulator, no `adb`.

## Revision 2.1: what was done

The patch follows the masterplan consistency check (`gateway_check/02_masterplan_consistency.md`, verdict PASS-WITH-NOTES, D21) and one addition the controller sent while the patch was being written (section 21 against the "Prov." column).

| Finding | What changed in the plan | Sections |
|---|---|---|
| C-02 (Major) | `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` is listed in "Paths with more than one writer" (W01, then W71). W71's rollback is "R-CO; R-PRE (`storage-page.test.tsx`)". "W01's state" is defined once: W01's log records `git hash-object` of its two files; CLG (a), W71, W84 and L-6 compare with that record, not with `acaff20` | 4.3; 8.1; W01; W71; W84; 11.3 |
| C-02, the other file | `apps/core-web/src/test/sim-fetch.test.ts` has no later writer (script) and no rollback touches it. It tests `features/api-reference/sim-fetch` (`apps/core-web/src/test/sim-fetch.test.ts:17`), so the verification of W84 got the same exception | 4.3; W84 |
| C-08 | New section 8.7: one output document per row, 105 distinct paths, equal to the blueprint's "Expected Output" column (steps 23 to 127, read at 06:10) | 8.1; 8.7 |
| C-09 | **Option chosen: the dependency.** W07 depends on W03 and W06; both stay in wave E2 (W07 after W06). W07's own `lsof` probe of 4432 stays and is part of its verification | 4.2; W06; W07; 9; 14.1; 21 |
| C-10 | The nine pairs cite the finding and its criterion: W10, W25 (SD-01, SR-68); W24 (SD-02, SR-69; SD-12, SR-75); W50, W54 (SD-03, AC-C-110); W08 (SD-06, SR-52); W45, W99 (SD-29 and the sentence on `DEVICE_CREDENTIAL_ROTATED`) | 7.2; 8; 13.2; 13.3 |
| C-13 | The shell variable of `device-session.sh` is `DEMS_CORE_HOST_PORT`; the shared constant keeps `CORE_SERVER_PORT` | 3.4; 5.2; 5.3; W13 |
| Controller addition | Section 21 now agrees with the "Prov." column. **Section 21 changed in both cases; the "Prov." column was right.** Provisional row 25: W03, W08 (W09 removed). Provisional row 79: W15, W56 (W15 added) | 21; 23.3 |

How the two section 21 cases were decided (from the scope of the rows):

| Provisional row | Its text in blueprint rev 1 | Work rows | Why |
|---|---|---|---|
| 25 | Scaffold of `apps/core-server`: app factory, entry, config loader, error envelope, log redaction, database plugin, module stubs, health stub, root scripts. No hashing | W03 (manifest), W08 | W09 writes `apps/core-server/src/modules/identity/password-hash/**`; that is the "password-hash verification" of provisional row 32, where section 21 already lists W09 |
| 79 | Mobile sign-in in `apps/mobile/src/auth/`, with "biometric unlock of the stored credential" | W15 (the AVD probe), W56 | The client specification gives row 79 the AVD observations (MB-8, CA-06, CA-07, AC-C-71); in the plan W15 makes them (its "Implements" and "Verification" cells), W56 uses the recorded case |

The text of the two provisional rows was read from the session record of the earlier read of blueprint rev 1, because the blueprint file on disk is now revision 2.

## Script results (last run, on the final file)

```
rows parsed: 105 W01 .. W105
missing ids: []
deps in a later wave than the row: []
deps inside the same wave (serial inside the wave): [('W07', 'W06'), ('W86', 'W84'), ('W95', 'W94'), ('W96', 'W95'), ('W104', 'W58'), ('W105', 'W81')]
PATH OVERLAPS BETWEEN ROWS WITH NO DEPENDENCY PATH: 0
paths shared by rows that are ordered by dependency: 41
AC-B: covered 93/93; missing []
AC-C: covered 110/110; missing []
SR: covered 82/82; missing []
=== REVISION 2.1 CHECKS ===
output documents: rows with exactly one 105/105; distinct paths 105; under an allowed folder 105; rows with "(none)" source paths 24
output documents equal to the blueprint column "Expected Output": 105/105; different: []
finding-to-row pairs of section 7.2: 106; pairs whose row cites neither the finding nor a criterion of it: []
provisional rows with a work row: 95 (23..118); without one (41 is SKIPPED): []; section 21 and the "Prov." column differ in: []
shell variable of device-session.sh: uses with a value under the old name 0 | under the new name 3
storage-page.test.tsx listed in section 4.3: True | W71 rollback: R-CO; R-PRE (`storage-page.test.tsx`)
  W01 file apps/core-web/src/test/sim-fetch.test.ts -> later writers: []
  W01 file apps/core-web/src/features/storage/__tests__/storage-page.test.tsx -> later writers: ['W71']
rows of revision 2: 105 | changed cells by column: {'verif': ['W01', 'W07', 'W13', 'W71', 'W84'], 'title': ['W06', 'W13', 'W45', 'W71', 'W99'], 'deps': ['W07'], 'impl': ['W08', 'W10', 'W24', 'W25', 'W45', 'W50', 'W54', 'W99'], 'rb': ['W71']}
rows changed in all: 14 | agent, wave, write paths, locks or "Prov." changed: []
```

The per-wave lines of the same run (not repeated here) show no wave above 6 agents of one type or 8 in flight: the peak is 7 in flight in B5, B7 and C1, and coder-execution ×6 in B5, B6, C1, C2 and C3. A separate table check found 66 markdown tables and no row whose cell count differs from its header. The plan holds no "CONFLICT — needs controller decision" marker.

The same checks, run on the revision 2 backup, printed the nine pairs of C-10, the two differences of section 21 (rows 25 and 79), three uses of the old variable name and "storage-page.test.tsx listed in section 4.3: False". So the checks see what the findings describe.

Against revision 2: 1,595 lines became 1,745; 55 lines replaced, 146 inserted (105 of them the table of section 8.7), 0 deleted. 14 work rows changed in a cell; no W-number, agent, wave, write path, lock or "Prov." cell changed; one dependency was added (W07 on W06). Totals are unchanged: 105 rows; coder-execution 68, verifier 10, senior-code-reviewer 7, test-expert 6, database-specialist 6, security-review 3, git-specialist 3, data-analyst 2; tiers R 99, D 6.

## Blockers

None.

## For the controller to record

| # | Item |
|--:|---|
| 1 | **C-09: the dependency was chosen**, not the "informative" wording. W07 depends on W03 and W06; no wave moves. Reasons: revision 1 put the environment check before provisioning and was accepted by D17; the blueprint's step 29 already depends on step 28. Cost: provisioning waits for W02 and W06 (not measured). Rule added: if W02 ends `blocked`, the controller starts W06 on that state, so the emulators cannot hold up the backend. The consistency check preferred the other option; the controller may overrule |
| 2 | **Section 21 changed, not the "Prov." column.** Corrected mapping: provisional row 25 is W03, W08 (was W03, W08, W09); provisional row 79 is W15, W56 (was W56). Unchanged for reference: row 32 is W09, W23, W24, W41; row 78 is W15, W51 |
| 3 | Spec citations to adjust (counts read at 06:13, while the files were being patched): `masterplan/01_specs.md` has "W03, W08, W09" in 4 places (SA-13, OR-9, item 6 of its "Row 18" list, and a numbered item 10 on `Strict-Transport-Security`) and "W07 to W09" in 2 (SU-2, AC-B-91); they become "W03, W08" and "W03, W07, W08, W13, W14". `masterplan/03_database_contract.md` has neither. `masterplan/04_client_integration_spec.md` has "79 (W56)" in 16 places, "79, 112 (W56, W100)" in 1 and "79, 97 (W56, W82)" in 1; they gain W15. The blueprint's mapping table has "prov. 25: W03, W08, [W09]"; W09 goes. Its "prov. 79: W56, [W15]" is already right |
| 4 | **C-13:** the name is `DEMS_CORE_HOST_PORT`. The client specification still shows the proposed name `CORE_SERVER_PORT` in §9.6, in AC-C-84 and in its lists for row 18; the plan's name binds for W13. The blueprint's step 35 already defers to section 3.4 of the plan |
| 5 | **C-02:** W01's log must record `git hash-object` of its two files. This is one sentence more in W01's verification; the blueprint's step 23 may repeat it |
| 6 | **C-08:** the 105 names are the blueprint's; if the two ever differ, the blueprint's name is used. A fallback row gets `implementation/<next free number>_fallback_<id>.md` (a proposal, not a decision) |
| 7 | **C-10:** the coverage tables gained rows, the totals did not change: SR-52 gains W08; SR-68 gains W10 and W25; SR-69 and SR-75 gain W24; AC-C-110 gains W50 and W54 |
| 8 | Checkpoint commit 1 (W104) leaves `storage-page.test.tsx` out and names it, as for every multi-writer path whose later writer has not finished; W105 stages it |

## Earlier revisions (kept for the record)

| Revision | Result |
|---|---|
| 1 (04:53) | 103 work rows; accepted by D17 |
| 2 (05:31) | 105 work rows (W104, W105 added); security findings SD-01 to SD-29 assigned; AC-B 93 of 93, AC-C 110 of 110, SR 82 of 82; 0 overlaps; accepted by D20 |

The edits of every revision were made with Python runs over the plan file: row changes by row ID and exact-match replacements, each asserted to match exactly once. The revision 1 and revision 2 texts are kept as backups in the session scratchpad (`.../scratchpad/row18/`), not in the repository.

---
*Generated: 2026-10-04 04:53 (revision 1)*
*Last Updated: 2026-10-04 05:31 (revision 2); 2026-10-04 06:14 (revision 2.1)*
