---
task_id: dems_real_capture_sealing
blueprint_row: 27
agent: test-expert
date: 2026-10-07
status: COMPLETE
---

# Row 27 delegation progress — test-expert

- Blueprint row: 27 (class A, milestone M0, tier 3) — wave-A regression checkpoint
- Task: run all five workspace suites on the post-B2 tree with `--maxWorkers=2`, prove every
  ledger floor holds, name every added test, add root typecheck + lint exit 0, record the LIVE
  audit view per R24-01. Report-only: no file may be edited outside the task folder.
- Depends: rows 23 (B2), 24 (B2 review), 25 (B10 review), 26 (RC-1 review) — all done at launch.

## Result

| Item | Outcome |
|---|---|
| 5/5 workspaces exit 0 | PASS (shared 71/1,851; cs-unit 160/3,954; cs-db 124/1,751; core-web 117/1,495; mobile 193/1,994) |
| Every count >= ledger floor | PASS (4 suites at floor exactly; mobile = floor + the row-22 delta) |
| Added tests named | 6 tests: `live-rc1-elapsed-stop-hold.test.tsx` :96/:117/:143/:164 (new suite, 4) + `elapsed-ticker.test.ts` :91/:108 (2 `freeze()` unit cases) — all in `apps/mobile/src/features/session-live/` |
| Removed tests | 0 (per-file HEAD vs worktree `it()` census in the report §6.3) |
| Root typecheck / lint | exit 0 / exit 0 (5/5 workspaces each) |
| Live audit (R24-01) | live full **53 high / total 80**; live omit-dev 46; lock full 49 / lock omit-dev 46 (further advisory-DB drift since row 24's 53/50, no new root); roots still braces + node-forge (both accepted-risk), 51 propagation-only, `undici` absent; within `<= 53` gate |
| Optional extras | pg-scripts 57/57 pass exit 0 (floor 57); mock-core 4 files/19 tests exit 0 (floor 4/19) |
| Flakes / re-runs | none — every suite passed its single run |
| Post-state | `git status --porcelain` byte-identical to pre-flight (diff empty) |
| PG pre-flight | RUNNING at 127.0.0.1:4432 (`pg:status: OK, running`, PID 47413) — `pg:start` not needed, not run |

**Gate line for row 39 / the controller: `TEST_GENERATION_COMPLETE: 5/5 wave-A regression green —
floors met (mobile +1 suite/+6 tests = row-22 additions, all named); typecheck+lint 0; live audit
high 53 within <=53; 0 files edited outside the task folder.`**

## Commands run (all from repo root, each suite exactly once)

```
node -v; npm -v; uptime
npm run pg:status
git status --porcelain            (pre + post, diffed)
npm run test -w @dems/shared -- --maxWorkers=2
npm run test -w @dems/core-server -- --maxWorkers=2
npm run test:db -w @dems/core-server -- --maxWorkers=2
npm run test -w @dems/core-web -- --maxWorkers=2
npm run test -w @dems/mobile -- --maxWorkers=2
npm run test:pg-scripts
npm run test -w @dems/mock-core -- --maxWorkers=2
npm run typecheck
npm run lint
npm audit --json / --omit=dev / --package-lock-only (+ omit-dev combo)
git show HEAD:<file> | grep -c "it("  (per-file removed-test census, 13 files)
```

## Notes / issues

1. Path correction: the delegation named the ticker unit suite `apps/mobile/src/runtime/__tests__/elapsed-ticker.test.ts`;
   the actual path is `apps/mobile/src/features/session-live/elapsed-ticker.test.ts` (git status + jest PASS line).
2. The mobile delta ties out arithmetically to the row-22 follow-up prediction ("+6 tests … in +1 suite",
   `delegation_progress/coder-execution__row22_followup.md:32`): 1,988 + 4 + 2 = 1,994; 192 + 1 = 193.
3. `worker force exited` notice with `MOB_EXIT=0` observed — the documented N-4/W87-F1/C1-R1 residual,
   quoted in the report §10; not treated as a failure.
4. Audit drift both directions since row 24: lock projection 53 -> 49, installed-tree (LIVE) = 53.
   Per R24-01 this row records the live count rather than re-quoting "49"; row 39 must re-confirm at its own run.
5. masterplan/02_plan.md not updated: row 37's plan tracks only milestone W-rows (rows 16-27 close-out
   lives in `status_tasks.md`), and per D5(d) shared trackers are synthesised by the controller; this
   row's documentation contract allows exactly the two files written here.
6. Host load 2.73/3.40/4.28 at pre-flight (other agents active); single writer for each runner honoured —
   suites ran strictly sequentially, no worker-count lowering was needed.
7. No blocker. Nothing routed to a producing row (0 failing tests).

## Outputs

| Artifact | Path |
|---|---|
| Wave-A regression report (Tier 3) | `docs/2026-10-07_dems_real_capture_sealing/test/01_wave_a_regression.md` |
| This progress note | `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/test-expert__row27.md` |

Raw run logs kept outside the repository at `/var/folders/rn/7bm_xjb14jxcbp36qw981phr0000gn/T/kilo/row27/`
(shared.log, cs_unit.log, cs_db.log, core_web.log, mobile.log, pg_scripts.log, mock_core.log,
typecheck.log, lint.log, audit_live.json, audit_live_omitdev.json, audit_lock.json,
audit_lock_omitdev.json, git_pre.txt, git_post.txt).
