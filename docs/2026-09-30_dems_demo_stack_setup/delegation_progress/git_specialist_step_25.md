---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 25
agent: git-specialist
status: complete
commit: 33e4c9577ff55c3b8d6375529ad75ad936b8e4ac
started: 2026-10-01 02:06 WIB
finished: 2026-10-01 02:10 WIB
---

# git-specialist, step 25: local baseline commit

## Inputs read
- identification/02_structured.md: row 25; Parallel Execution Protocol P1-P12 (git index single writer: 25, then 66)
- masterplan/02_plan.md §3 Row 25 (rollback `git reset --soft HEAD~1`; see S25-1)
- initialization/02_git_init.md (root .gitignore 53 lines, sha256 666eea57...99e9; global identity; G5 sandbox note)
- verification/05_pre_baseline_gate.md (PASS 7/7; S-6, S-7; F-2, F-6, F-7)
- decisions/decisions.md D5, D7, D8, D35, D41 (h), D42

## Progress
- [x] Pre-state inspected: no commit, no remote, 182 untracked candidates (incl. 5 `.locks/` files); no `.npm-cache/` dir (the npm cache is `.cache/npm`, already ignored)
- [x] Appended `.locks/` to root .gitignore (append only: 53 -> 56 lines; first 53 lines byte-identical)
- [x] Ignore checks: `.locks/`, `.docx`, `node_modules`, `apps/mobile/android`, `graft/` all exit 0
- [x] `git add -A` (sandbox disabled for this one command): 178 files staged, all `A`; 0 forbidden paths; secrets re-scan clean (1 false positive explained)
- [x] Commit `33e4c95` (root commit on `main`), global identity Budi Kusharyanto noreply; ends with the Co-Authored-By line
- [x] Post-commit verification: `git status --porcelain` empty; `git remote -v` empty; docx in ls-files = 0; `.locks` in ls-files = 0; no tag
- [x] Report: implementation/07_git_baseline_commit.md

## Files created or updated
- `/Users/gsp-budi/Documents/DEMS/.gitignore` (appended 3 lines: blank, comment, `.locks/`)
- `/Users/gsp-budi/Documents/DEMS/.git/` (index, objects, refs/heads/main via git add and commit)
- `docs/2026-09-30_dems_demo_stack_setup/implementation/07_git_baseline_commit.md` (new, written after the commit)
- `docs/2026-09-30_dems_demo_stack_setup/delegation_progress/git_specialist_step_25.md` (this file; committed in its in-progress state, then updated)

Shared files NOT written (P6/P8): masterplan/02_plan.md, status_tasks.md, delegation_progress_report.md, implementation/99_implementation_report.md.

## For the controller
- S25-1: the 02_plan §3 Row 25 rollback `git reset --soft HEAD~1` cannot work on a root commit. Use `git update-ref -d refs/heads/main` (keeps the index and working tree). Please update 02_plan.
- S25-2: `.git/` writes need a per-command sandbox bypass, and `$TMPDIR` differs outside the sandbox. Step 66 should pass absolute paths.
- S25-3: the shell `grep` is a ugrep wrapper that missed a positive control; later scans should use `/usr/bin/grep` or `git grep` with a positive control.
- S25-5: `docs/` is now tracked and includes design-book-derived text (01_original.md, 01_translated.md). It is local only; review it before any future remote.
- After-report state: `git status --porcelain` now lists only this file (modified) and 07_git_baseline_commit.md (untracked). Step 66 picks them up.
