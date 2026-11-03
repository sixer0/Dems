# Row 120: RB-1 R-FLEX-only diff and the commit (on the user's word)

Date: 2026-10-22, host .73 (the Mac paths of the blueprint read as the host paths below; D29/D30).

## User's word (D33)
Row 120 question: "setelah G-RF lolos, boleh saya commit perubahan R-FLEX (termasuk fix row 142/143) ke branch lokal task4/input-av-core-port di .73? Tidak ada push." Answer: "Ya, commit lokal".

## RB-1 (`research/03_analysis_rflex_impact.md` §7.2 R-B, step 1)
- Baseline `a` = `~/dems-baseline-r115` (git worktree of e05a1567 + row-80 `tracked.diff` + `untracked.tar.gz` without `docs/*`; code porcelain equal to `porcelain.txt`); `b` = `~/Desktop/DEMS-source`; `diff -ruN --exclude=node_modules --exclude=.data --exclude=dist --exclude=.DS_Store --exclude=.claude --exclude='._*' --exclude=input-av a/<root> b/<root>` for `apps packages scripts`. 75 files, 0 binary.
- Written to `~/Desktop/DEMS-progress-20261022/rflex-restore-20261022/rflex-only.diff` (the host's copy of the row-80 restore folder) and its line appended to `SHA256SUMS`.
- `(cd .../rflex-restore-20261022 && sha256sum -c SHA256SUMS)`: `head.txt: OK`, `porcelain.txt: OK`, `tracked.diff: OK`, `untracked.tar.gz: OK`, `rflex-only.diff: OK` (5 lines).
- `cd ~/Desktop/DEMS-source && patch -R -E -p1 --dry-run < .../rflex-only.diff`: exit 0, 0 failed hunks.
- `apps/input-av` is excluded: a host-local app ignored by `.git/info/exclude:51`, not part of R-FLEX or of the Mac tree.
- Note (row 116 F-5): the diff also holds rows 139 and 141 (both blueprint rows); a rollback by it undoes them too.

## Commit
- `git apply --cached -p1 rflex-only.diff` on a clean index (`git diff --cached --quiet`), then `git -c user.name=gsp-dems -c user.email=<the user's account e-mail> commit` (the host has no git identity; none was configured).
- Commit `c1e46f815d170de90ee78efb81845f7f48beab3e` on `task4/input-av-core-port`, parent e05a1567: 75 files, 2745 insertions, 777 deletions. Not pushed.
- The task-4 LCD work stays uncommitted (`git status --porcelain` = 33 entries after the commit). Two files hold both: `apps/core-web/src/i18n-web.ts`, `packages/shared/openapi/openapi.json` (D21 kept); only the R-FLEX hunks are in the commit (`git apply --cached --check` exit 0).
- The commit's own tree (worktree `~/dems-commit-check`, `npm ci --ignore-scripts`): typecheck `@dems/shared` rc 0, `@dems/core-server` rc 0, `@dems/core-web` rc 2 with 2 x TS6133 in `packages/shared/src/api/capture-retire.ts:39-40` - the SAME 2 errors as e05a1567 alone (checked the same way); the uncommitted task-4 work removes those imports. R-FLEX adds no error.
