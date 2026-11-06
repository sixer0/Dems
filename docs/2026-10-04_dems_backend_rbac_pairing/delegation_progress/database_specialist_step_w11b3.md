---
task_id: 2026-10-04_dems_backend_rbac_pairing
plan_row: W11b3 (third follow-up of W11b; decision D134, reassigned by D140/DR-13 after the local variant failed twice)
agent: database-specialist
date: 2026-10-05
status: complete
artifact: implementation/11b_db_helper_forced_drop_retry.md (section 15)
---

# Row W11b, follow-up 3: the helper sets the limits and takes the needs of a test file

Times are WIB. No credential value appears in this file. Handover label for every database run:
`DEMS_TEST_STEP=33d`.

## Status

**complete.** The work the two dead attempts left in `apps/core-server/test/helpers/db/` was
audited against both pre-images and found **finished in the tree but unmeasured**; nothing needed
writing. This round proved it: the three reds D140 named pass alone, in the folder and in both
whole projects; the folder runs 11/394 (unit) and 15/90 (db); whole `db` 122/1,740 exit 0 twice
with 0 databases left under the prefix; whole `unit` 153/3,912 exit 0; typecheck and lint exit 0
without a warning; the new guard refuses a non-test database; 11 of 11 new mutations caught.
Detail, quotes, findings: `implementation/11b_db_helper_forced_drop_retry.md` section 15.

## What was found (established before any command)

- The folder is wholly untracked against `accaff20` (P23); own pre-images saved to
  `.cache/rollback/W11b3/db/` (55 files) + `SHA256SUMS` before the first command that could write.
- Two dead attempts, not one. **Round A** (Oct 4 20:35–22:05): the limits half — caps applied by
  `index.ts` at import, the per-file `vi.setConfig` lines stripped from the 12 db files + 3
  selfchecks, `limits.test.ts`/`limits.db.test.ts`/`limits-own.db.test.ts` written, and measured
  (its own `11b_fu3_*.log` assets, Oct 4 20:51); its rollback patch is empty — died at the break.
  **Round B** (Oct 5 10:17–10:57, the local variant): the needs half — `DatabaseNeeds`
  (`testTimeoutMs`, `hookTimeoutMs`, `connectTimeoutMs`, `quietCluster`), `NEEDS_INVALID`,
  `DB_NEED_MAX_MS`, `CLUSTER_QUIET_BUDGET_MS`, the keyed `pg_locks` read in `ddl.ts` (F-8),
  `timings.quiet`, `needs.test.ts` (66) and `needs.db.test.ts` (13), `static.test.ts` updated.
  No measurement, no report.
- Handover list corrected: `provided.ts` is W11-original; the dead-run pair belongs to follow-up 2.
- The three named reds were mid-edit states; on the as-found tree they are green (also in the
  16:10 solo runs before anything else was done).

## Milestones

| Time | What |
|---|---|
| 16:07 to 16:10 | Read the protocol bindings (P9–P16, P23), section 14, 29 §21, contract §10, decisions D76/D114/D130/D134/D139/D140; `git status`; pre-images; the three reds run alone: 19, 3, 13 passed, all exit 0 |
| 16:10 to 16:12 | Folder proven green: db 15/90 exit 0, unit 11/394 exit 0 (prefixes `tmfg6kbl_`/`tmfg7r82_`, 0 remain) |
| 16:12 to 16:21 | Full audit: every changed and new file read; both pre-images diffed; isolation-suite and selfcheck child runs confirmed to get the caps via the provided run; the 14 files with own lower limits confirmed to keep them; typecheck and lint exit 0 |
| 16:21 to 16:24 | Scratch tree built outside the repository (links + copies); baselines green: scratch unit 103, scratch db 24 |
| 16:24 to 16:27 | **11 mutations of the needs mechanism, 11 caught**, each applied, run, reverted; repository tree hash-verified unchanged after the loop |
| 16:25 to 16:32 | The measurements: folder command exit 0 again; whole `db` exit 0 (122/1,740) at load 10.75; repeat exit 0 (load 8.13); 0 retried drops, 0 remain with the 33d prefix after every run |
| 16:29 to 16:34 | Whole `unit` first run exit 1: 2 reds in another row's `test/static/audit-protection.test.ts`, caused by the dead variant's stray JSON report inside `apps/core-server/.cache/` (the scan reads `.cache`; sha256 `2ad511cd…`). Moved out of the tree (nothing deleted); audit-protection alone 9/9; whole `unit` repeat **153/3,912 exit 0**. Both runs recorded (P11) |
| 16:35 | Guard: `test:db:drop-run` usage exit 2; `-- dems_demo` → REFUSED (GUARD_NOT_A_TEST_DATABASE) before any statement, exit 1 |
| 16:36 to 16:38 | Per-file counts of the six new tests (18/66/19 unit, 6/5/13 db); typecheck + lint exit 0, no warning; cluster state via the reset row's read-only script: 7 databases, 0 test leftovers, roles and settings digest unchanged, PID 19121 |
| 16:38 to 16:52 | Section 15 + the round-3 `11b_fu3_*` assets + this file; leak check 16:49:24 — 83 files (folder, document, round-3 assets, progress, moved stray report), 0 credential occurrences (`11b_fu3_no_credential.log`); final folder re-run 16:51 exit 0 (15/90, 0 remain, prefix `tmfhznft_`); tree hashes still identical to the 16:08 pre-image |

## Files created or updated

**Program files: none.** `apps/core-server/test/helpers/db/**` was read and measured, not written:
the audit found the landed work complete and correct, and the goal (D114 item 3 + D134) is served
by the shape already in the tree. Zero edits to other rows' files.

Documents (paths under `docs/2026-10-04_dems_backend_rbac_pairing/`):

- `implementation/11b_db_helper_forced_drop_retry.md` — **section 15 appended**; sections 3–14
  untouched; the front-matter `follow_up:` line names section 15; footer Last Updated.
- `implementation/assets/11b_fu3_folder_db.log`, `11b_fu3_whole_db_1.log`, `11b_fu3_whole_db_2.log`,
  `11b_fu3_whole_unit_1_with_stray.log`, `11b_fu3_whole_unit_2.log`, `11b_fu3_new_file_counts.log`,
  `11b_fu3_typecheck_lint.log`, `11b_fu3_droprun_guard.log`, `11b_fu3_cluster_state.log`,
  `11b_fu3_needs_console.log`, `11b_fu3_needs_mutations.log`, `11b_fu3_roundA_limits.diff` (759),
  `11b_fu3_roundB_needs.diff` (674), `11b_fu3_stray_report.log`, `11b_fu3_no_credential.log` (15
  new files; the predecessor round's own `11b_fu3_*` assets are left untouched).
- `delegation_progress/database_specialist_step_w11b3.md` — this file.

Not written, on purpose: `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, any file outside the two paths above and
`apps/core-server/test/helpers/db/**`.

## Numbers (all measured this session, every run quoted in section 15)

| Command | Exit | Result |
|---|---|---|
| `npm run test:db -w @dems/core-server -- test/helpers/db` | 0 | 15 files, 90 tests |
| `npm run test -w @dems/core-server -- --maxWorkers=2 test/helpers/db` | 0 | 11 files, 394 tests |
| `npm run test:db -w @dems/core-server` (×2: 16:28, 16:32) | 0, 0 | 122 files, 1,740 tests; 0 retried drops; **0 databases left with `dems_test_step_33d_`** |
| `npm run test -w @dems/core-server -- --maxWorkers=2` | 1 then 0 | first: 2 failed (stray artifact, another row's scan); repeat: 153 files, 3,912 tests, 0 failed |
| `npm run typecheck -w @dems/core-server` | 0 | clean |
| `npm run lint -w @dems/core-server` | 0 | no warning |
| `npm run test:db:drop-run` (no args / `dems_demo`) | 2 / 1 | usage / REFUSED (GUARD_NOT_A_TEST_DATABASE) before any statement |

## For the controller

- **D134 can be closed** (DN W3-1): the third item of D114 is complete and measured; this was the
  last blocker named before W58.
- **Finding F W3-3 needs an owner**: `apps/core-server/test/static/scan.ts:19` — add `.cache` to
  the skipped directories (or tighten D30 so json reports never land under `apps/core-server/.cache/`).
  Until then, any row that follows D30's letter can redden `test/static/audit-protection.test.ts:82,90`
  by writing a test report there. Reported, not fixed — not my path.
- **F W3-2**: the handover's dead-run file list was partly wrong (see section 15.1); future
  handovers of this folder should trust the pre-images, not the memory of the round.
- **F W3-4**: no residual flake found in any run of this session; if W58 sees a helper flake,
  start from `timings.quiet` — the per-request knob the helper now exposes.
- The stray JSON report is preserved at `$TMPDIR/kilo/w11b3/stray/w11b3-db-whole.json`
  (sha256 in `11b_fu3_stray_report.log`); move it back if anyone wants the dead variant's full run.

## Rollback

This round wrote nothing to the tree: `.cache/rollback/W11b3/db/` + `SHA256SUMS` are byte-identical
to the folder now (re-checked 16:27 and 16:38). The landed work of the two dead rounds is
undoable from their own pre-images (`.cache/rollback/W11b_followup3.pre/`,
`W11b_followup3b.pre/`) or the reverse of `11b_fu3_roundA_limits.diff` / `11b_fu3_roundB_needs.diff`
— not to be applied blindly (M15).
