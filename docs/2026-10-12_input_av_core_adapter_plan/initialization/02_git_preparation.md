# Git preparation for task 4 (Tier 3: commands and output)

Date: 2026-10-12. Agent: git-specialist. Basis: decisions U12 (B3, B6), C6, C12.

## 1. State before (matches the controller's description)
```
$ git status --short
?? apps/input-av/
?? docs/2026-10-12_input_av_core_adapter_plan/
$ git branch --show-current
main
$ git log --oneline -3
cf2f8008 docs: task 3 - final report, closing decisions D249 ...
64a48584 fix: task 3 wave Q ...
b4b0c25f fix: task 3 wave J ...
```

## 2. Exclude rule (C12 point 1)
Appended to `.git/info/exclude` (untracked file; existing content kept). Note: three lines were appended, not one: a blank line, a comment line, and the rule `apps/input-av/`.
```
$ git check-ignore -v apps/input-av/README.md
.git/info/exclude:51:apps/input-av/	apps/input-av/README.md     (rc=0)
$ git check-ignore -v apps/input-av/data
.git/info/exclude:51:apps/input-av/	apps/input-av/data          (rc=0)
$ git status --short
?? docs/2026-10-12_input_av_core_adapter_plan/
```
Nothing under apps/input-av/ was read, listed or modified.

## 3. Branch (B3)
```
$ git switch -c task4/input-av-core-port
Switched to a new branch 'task4/input-av-core-port'
$ git branch --show-current
task4/input-av-core-port
$ git log --oneline -1
cf2f8008 docs: task 3 - final report ...
```
`main` still at cf2f8008, untouched. No push, no commit.

## 4. Final state
```
$ git status --short
?? docs/2026-10-12_input_av_core_adapter_plan/
$ git branch --show-current
task4/input-av-core-port
```
Rules for the rest of the task (C12 point 2): no git clean, no stash, no git add -A / add .; stage by path name.
