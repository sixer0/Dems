---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 25
agent: git-specialist
status: in-progress
started: 2026-10-01 02:06 WIB
---

# git-specialist, step 25: local baseline commit

## Inputs read
- identification/02_structured.md: row 25; Parallel Execution Protocol P1-P12 (git index single writer: 25, then 66)
- masterplan/02_plan.md §3 Row 25 (rollback `git reset --soft HEAD~1`)
- initialization/02_git_init.md (root .gitignore 53 lines, sha256 666eea57...99e9; global identity; G5 sandbox note)
- verification/05_pre_baseline_gate.md (PASS 7/7; S-6, S-7; F-2, F-6, F-7)
- decisions/decisions.md D5, D7, D8, D35, D41 (h), D42

## Progress
- [x] Pre-state inspected (no commit, no remote, 182 untracked candidates incl. 5 `.locks/` files; no `.npm-cache/` dir)
- [ ] Append `.locks/` to root .gitignore
- [ ] Ignore checks
- [ ] Stage and review
- [ ] Commit
- [ ] Post-commit verification
- [ ] Report implementation/07_git_baseline_commit.md
