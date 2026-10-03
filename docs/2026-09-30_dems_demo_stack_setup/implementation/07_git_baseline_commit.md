---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 25
date: 2026-10-01
agent: git-specialist
narrative_tier: 3
status: complete
commit: 33e4c9577ff55c3b8d6375529ad75ad936b8e4ac
source_plan: masterplan/02_plan.md §3 Row 25
decisions: D5, D7, D8, D35, D41 (h), D42
---

# 07: Local baseline commit (blueprint step 25)

Run on 2026-10-01 02:06–02:09 WIB, cwd `/Users/gsp-budi/Documents/DEMS`, git 2.55.0.

## Result summary

| Item | Result | Evidence |
|---|---|---|
| `.locks/` appended to root `.gitignore` (D35, D42); the existing 53 lines are unchanged | done | §2 |
| `.npm-cache/` rule | not needed: no `.npm-cache/` directory exists; the npm cache is `.cache/npm`, which `.gitignore:44:.cache/` already covers | §1 |
| Ignore checks: `.locks/`, the `.docx`, `node_modules`, `apps/mobile/android/`, `graft/` | all exit 0 (ignored) | §3 |
| Staged set reviewed: 178 files; no `.docx`, `.env`, keystore, `node_modules`, `android/`, `graft/` or `.locks/` | done | §4 |
| Secrets re-scan of the staged blobs | clean (1 false positive, explained) | §4.3 |
| Commit `33e4c95` on `main` (root commit), existing global identity | done | §5 |
| No remote, no push, no tag | done | §6 |
| `docs/` tracked locally (D5 default, which settles D8); `ui_design/` included (D41 h) | done | §4.1 |

## 1. Before

```
$ git rev-parse --is-inside-work-tree ; git symbolic-ref HEAD ; git rev-parse --verify -q HEAD
true
refs/heads/main
HEAD exit=1                                          (no commit yet)
$ git remote -v | wc -l
0
$ shasum -a 256 .gitignore ; wc -l -c .gitignore
666eea5735b633e41393c6e79ba6eacd3e9cfa3809ed2090b7d65fdd6ca399e9  .gitignore   (= row 7 C3, row 14, step 26 S-6)
      53     884 .gitignore
$ tail -c 1 .gitignore | xxd
00000000: 0a                                         (ends with LF; clean append)

$ find . -name '.npm-cache' -not -path '*/node_modules/*' -prune -print
(no output)
$ ls -la .cache
drwxr-xr-x@ 6 gsp-budi staff 192 Oct  1 00:39 npm   (npm cache, spec R-4; ignored by .gitignore:44:.cache/)

$ ls -la .locks                                      (step 19 files, F-2)
dems_phone.lock  dems_phone.pid  dems_tablet.lock  dems_tablet.pid  mock-core.lock  mock-core.users/ (empty)

$ GIT_OPTIONAL_LOCKS=0 git status --porcelain --untracked-files=all | wc -l
182                                                  (incl. 5 .locks/ files)

$ find . -name .git -not -path './.git' -not -path '*/node_modules/*'
(no output)                                          (no embedded repositories)
symlinks among candidates: none
candidates > 1 MB: 5 ui_design/*.png (1,718,852 – 2,144,334 bytes; F-7)
```

`ui_design/.claude/.cc-writes/` and `.claude/.cc-writes/` are empty directories. Git does not track empty directories, so nothing under them was staged.

## 2. Append `.locks/` to the root .gitignore

```
$ grep -nxF '.locks/' .gitignore
exit=1                                               (rule absent)
$ printf '\n# Workspace coordination locks and PID files (D35, D42; blueprint step 25)\n.locks/\n' >> .gitignore
append exit=0                                        (inside the sandbox)

$ wc -l -c .gitignore
      56     968 .gitignore
$ head -n 53 .gitignore | shasum -a 256
666eea5735b633e41393c6e79ba6eacd3e9cfa3809ed2090b7d65fdd6ca399e9  -     (first 53 lines byte-identical)
$ shasum -a 256 .gitignore
34d701430f309b7759018cb2c4b840dfafde587a6ff2fbcbe4cb3941fa456e58  .gitignore
$ tail -n 4 .gitignore
.claude/.cc-writes/

# Workspace coordination locks and PID files (D35, D42; blueprint step 25)
.locks/
```

## 3. Ignore checks

```
$ for p in …; do git check-ignore -q "$p"; git check-ignore -v "$p"; done
.locks/                                                            exit=0  .gitignore:56:.locks/
.locks/x                                                           exit=0  .gitignore:56:.locks/
.locks/dems_phone.pid                                              exit=0  .gitignore:56:.locks/
.locks/mock-core.lock                                              exit=0  .gitignore:56:.locks/
DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx     exit=0  .gitignore:9:*.docx
node_modules                                                       exit=0  .gitignore:12:node_modules/
apps/mobile/node_modules                                           exit=0  apps/mobile/.gitignore:4:node_modules/
apps/core-web/node_modules                                         exit=0  apps/core-web/.gitignore:10:node_modules
apps/mobile/android                                                exit=0  apps/mobile/.gitignore:43:/android
graft/                                                             exit=0  .gitignore:2:/graft/
.cache                                                             exit=0  .gitignore:44:.cache/
.env                                                               exit=0  .gitignore:37:.env
x.keystore                                                         exit=0  .gitignore:31:*.keystore
x.jks                                                              exit=0  .gitignore:32:*.jks
--- trackable controls (expect exit=1):
.gitignore exit=1 | package.json exit=1 | apps/mobile/app.json exit=1
ui_design/DEMS-Mobile.png exit=1 | docs/2026-09-30_dems_demo_stack_setup/README.md exit=1
```

`apps/mobile/android/` exists on disk (generated by row 18). The root rule `.gitignore:25` also covers it.

## 4. Staging and review

### 4.1 Stage

```
$ git add -A --dry-run                               (inside the sandbox)
fatal: Unable to create '/Users/gsp-budi/Documents/DEMS/.git/index.lock': Operation not permitted
exit=128
$ ls -la .git | grep index
exit=1                                               (no index, no stale index.lock)

$ git add -A                                         (sandbox disabled for this one command; G5)
git add exit=0
```

```
$ GIT_OPTIONAL_LOCKS=0 git diff --cached --name-only | wc -l
178
$ git status --short | cut -c1-2 | sort | uniq -c
 178 A
$ git status --short | grep -v '^A '
exit=1                                               (nothing unstaged or untracked left)
$ git diff --cached --shortstat
 178 files changed, 41750 insertions(+)

per area:
   8 root files: .gitignore .ignore .node-version .npmrc THIRD_PARTY_NOTICES.md
                 package-lock.json package.json tsconfig.base.json
  24 apps/core-web
  40 apps/mobile          (includes "apps/mobile/assets/expo.icon/Assets/expo-symbol 2.svg", F-6)
  11 apps/mock-core
  29 packages/shared
  61 docs/                (D5 default settles D8; includes delegation_progress/git_specialist_step_25.md in its in-progress state)
   5 ui_design/           (D41 h)
```

Reconciliation: 182 candidates − 5 `.locks/` files + 1 new progress file (`delegation_progress/git_specialist_step_25.md`, written at 02:06 before staging) = 178. Compared with step 26's 172 candidates at 01:56: `docs/` grew from 52 to 61, and the 5 `.locks/` files are now excluded (172 − 3 `.locks/` + 9 docs = 178).

### 4.2 Forbidden paths among the staged set

```
$ RX='\.docx$|node_modules/|(^|/)\.env($|\.)|keystore|\.jks$|^apps/mobile/android/|^apps/mobile/ios/|^graft/|^\.locks/|(^|/)\.cache/|(^|/)\.expo/|\.tsbuildinfo$|\.log$|\.p12$|\.pem$|\.key$|(^|/)dist/|(^|/)build/|\.DS_Store$|\.apk$|\.aab$|local\.properties$|(^|/)coverage/|^\.claude/'
$ printf '<14 sample paths, 13 forbidden>' | /usr/bin/grep -ciE "$RX"
13                                                   (positive control fires)
$ git -c core.quotePath=false diff --cached --name-only | /usr/bin/grep -inE "$RX"
exit=1                                               (none)
docx=0 locks=0 node_modules=0 android=0 graft=0 env=0 keystore=0 total=178
```

### 4.3 Secrets re-scan (staged blobs, `git grep --cached`)

Step 26 S-7 scanned 172 files at 01:56. This run re-scans the actual index, because 9 docs files were added since then.

```
--- high-confidence patterns (private-key block, AKIA/ASIA, gh*_, github_pat_, sk-ant-, sk-, xox*-, AIza, npm_, _authToken, EXPO_TOKEN=, glpat-)
$ git grep --cached -nIE -e … -- . ':!package-lock.json'
docs/2026-09-30_dems_demo_stack_setup/verification/05_pre_baseline_gate.md:596:--- high-confidence credential patterns (private-key blocks, AKIA/ASIA, gh*_ / github_pat_, sk-, sk-ant-, xox*-, AIza, npm_, _authToken, EXPO_TOKEN=, glpat-):
exit=0                                               (1 hit: the gate report's own list of pattern names, not a credential)
$ git grep --cached -cIE -e '<private-key>' -e '_authToken' -e 'EXPO_TOKEN=' -e 'npm_[A-Za-z0-9]{36}' -- package-lock.json
exit=1                                               (none)

--- generic: (api[_-]?key|secret|passw(or)?d|token)["']?\s*[=:]\s*["'][A-Za-z0-9+/_=-]{12,}["']
$ git grep --cached -nIiE -f generic.pat -- .       (all 178 files incl. the lockfile)
exit=1                                               (none)

--- positive controls via git grep --no-index on a planted $TMPDIR file
generic: pc.txt:2 (expected 2) | high-confidence: pc.txt:2 (expected 2)
```

Tooling note (S25-3): in this environment `grep` is a shell function that wraps ugrep 7.8.4. It returned 0 on the positive control for the generic pattern, while `/usr/bin/grep` returned 1. All scan results in this report come from `git grep` or `/usr/bin/grep`, each with a positive control that fires.

### 4.4 Identity (read-only; nothing set or changed)

```
$ git config --show-origin --get-all user.name
file:/Users/gsp-budi/.gitconfig	Budi Kusharyanto
$ git config --show-origin --get-all user.email
file:/Users/gsp-budi/.gitconfig	60373859+sixer0@users.noreply.github.com
$ git config --show-origin --get commit.gpgsign
exit=1                                               (unset)
$ ls .git/hooks | grep -v '\.sample$'
(none)
```

## 5. Commit

First attempt (sandbox disabled):

```
$ git commit -F "$TMPDIR/step25_commit_msg.txt"
fatal: could not read log file '/var/folders/rn/…/T//step25_commit_msg.txt': No such file or directory
exit=128
```

`$TMPDIR` is `/tmp/claude-501` inside the sandbox but `/var/folders/…` outside it. The file had been written inside the sandbox. No commit was created (`git rev-parse --verify -q HEAD` exit 1; 178 still staged; no `*.lock` in `.git/`).

Retry with the absolute path (sandbox disabled for this one command):

```
$ git commit -F /tmp/claude-501/step25_commit_msg.txt
[main (root-commit) 33e4c95] chore: baseline DEMS demo stack scaffold (web, mobile, mock-core, shared)
 178 files changed, 41750 insertions(+)
exit=0
```

Commit message (verbatim):

```
chore: baseline DEMS demo stack scaffold (web, mobile, mock-core, shared)

Local baseline commit (blueprint step 25) and rollback point for the web
and mobile builds. No remote, no push.

- apps/core-web (24), apps/mobile (40), apps/mock-core (11)
- packages/shared (29)
- root workspace config: package.json, package-lock.json, .npmrc,
  .node-version, tsconfig.base.json, THIRD_PARTY_NOTICES.md, .gitignore,
  .ignore
- docs/ task records, tracked locally (D5, D8)
- ui_design/ reference images (D41 h)
- .gitignore: append .locks/ (D35, D42)

Excluded by .gitignore: *.docx, node_modules/, .cache/, graft/,
apps/mobile/android/, .env, keystores, .locks/.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## 6. Verification (run 02:08:34 WIB, immediately after the commit, before any docs write)

```
$ git log --oneline -1
33e4c95 chore: baseline DEMS demo stack scaffold (web, mobile, mock-core, shared)
$ git rev-parse HEAD
33e4c9577ff55c3b8d6375529ad75ad936b8e4ac
$ git status --porcelain
exit=0 lines=0                                       (empty)
$ git remote -v
exit=0 lines=0                                       (empty)
$ git ls-files | /usr/bin/grep -ci docx
0
$ git ls-files .locks | wc -l
0
$ git check-ignore -q .locks/x
exit=0
$ git tag -l | wc -l
0
$ git branch -a
* main
$ git ls-files | wc -l
178

--- row-25 exclusion list against git ls-files (expect 0 each)
docx 0 | node_modules 0 | (^|/)\.cache/ 0 | ^apps/mobile/android/ 0 | ^graft/ 0 | (^|/)\.env 0 | keystore|\.jks$ 0 | ^\.locks/ 0

$ git log -1 --format='…'
author:    Budi Kusharyanto <60373859+sixer0@users.noreply.github.com>
committer: Budi Kusharyanto <60373859+sixer0@users.noreply.github.com>
date:      Thu Oct 1 02:08:29 2026 +0700
parents:   []                                         (root commit)
tree:      824f6235bad951e76b402530ac65f03736390405
last line of message: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

$ git diff --quiet HEAD -- .gitignore ; git show HEAD:.gitignore | shasum -a 256
exit=0
34d701430f309b7759018cb2c4b840dfafde587a6ff2fbcbe4cb3941fa456e58  -     (= §2)
```

Files that must stay untracked are unchanged and still ignored:

```
$ shasum -a 256 "DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx" .ignore
d29761195cf3a318029dab5515aa5e7e98b13f303374d40eb8dabf7e14b1a46c  DEMS_Edge_…docx   (= row 7 §1)
5b345696ac9daf0b07ce5b9c56d5ec914815e395286f4c9f9ac3ec8ec83bf507  .ignore           (= row 7 §1)
$ ls .locks
dems_phone.lock dems_phone.pid dems_tablet.lock dems_tablet.pid mock-core.lock mock-core.users   (untouched)
$ git status --porcelain --ignored | grep '^!!'
!! .DS_Store  !! .cache/  !! .locks/  !! DEMS_…docx  !! apps/core-web/dist/  !! apps/core-web/node_modules/
!! apps/mobile/.expo/  !! apps/mobile/android/  !! apps/mobile/expo-env.d.ts  !! apps/mobile/node_modules/
!! apps/mock-core/node_modules/  !! graft/  !! node_modules/  !! packages/shared/node_modules/
```

**After-report state.** This report contains the commit hash, so it could only be written after the commit. After 02:08:34 this step wrote exactly two files, both under `docs/`: this report (new, untracked) and `delegation_progress/git_specialist_step_25.md` (modified from its committed in-progress state). `git status --porcelain` therefore now lists only those two paths. The single-writer scan gives the git index to step 66 next, and step 66 picks them up.

## 7. Rollback

- **Correction for 02_plan §3 Row 25 (S25-1):** the planned rollback `git reset --soft HEAD~1` **cannot work** here, because `33e4c95` is a root commit:
  ```
  $ git rev-parse --verify -q HEAD~1
  exit=1                                             (HEAD~1 does not resolve)
  $ git rev-list --count HEAD
  1
  ```
- **Equivalent for a root commit** (not run): `git update-ref -d refs/heads/main`. It deletes the branch ref only, so `main` becomes unborn again, the 178 files stay staged in the index and the working tree is untouched. Use `git rm -r --cached -q .` afterwards to unstage everything. Both commands write under `.git/` and need the one-command sandbox bypass (G5).
- To undo the `.gitignore` append: delete its last 3 lines (the blank line, the comment and `.locks/`). `head -n 53 .gitignore` has sha256 `666eea57…99e9`.
- `git reset --hard 33e4c95` remains the workspace rollback point for later W/M rows (02_plan §3). It is destructive and only run on explicit request.

## 8. Decisions and issues

| ID | Item | Resolution |
|---|---|---|
| S25-1 | 02_plan §3 Row 25 rollback `git reset --soft HEAD~1` fails on a root commit (`HEAD~1` does not resolve) | Recorded the working equivalent in §7. **Controller:** update 02_plan §3 Row 25 (shared file, not edited here, P6/P8) |
| S25-2 | The sandbox denies every write under `.git/` (`index.lock: Operation not permitted`), as row 7 G5 predicted. `$TMPDIR` also differs between sandboxed and unsandboxed shells | `git add -A` and `git commit` each ran with the sandbox disabled for that one command, as the brief authorises. The first commit attempt failed harmlessly (no commit, index intact) and was retried with an absolute path. Step 66 should pass absolute paths to unsandboxed git commands. The user can change the sandbox scope with `/sandbox` |
| S25-3 | The shell `grep` is a ugrep 7.8.4 wrapper function. It missed the generic secret pattern (positive control 0), while `/usr/bin/grep` matched | Scans re-run with `git grep` and `/usr/bin/grep`, each with a firing positive control. **Recommendation for later verifiers and security steps (62, 63):** use `/usr/bin/grep` or `git grep` and always run a positive control |
| S25-4 | Secrets re-scan: 1 high-confidence hit | False positive: `05_pre_baseline_gate.md:596` is the gate report's own list of pattern names. 0 generic hits, including the lockfile |
| S25-5 | `docs/` is now tracked (D5 default, settles D8). It includes `identification/01_original.md` and `01_translated.md`, which are derived from the confidential design book (row 7 G4) | Local only: no remote exists. **Flag:** review `docs/` before any future remote or push (outside this task's scope, D5) |
| S25-6 | No `.npm-cache/` directory exists; the npm cache is `.cache/npm` | No rule added; `.cache/` (line 44) covers it |
| S25-7 | The root rule `.claude/.cc-writes/` is anchored to the root. `ui_design/.claude/.cc-writes/` is currently empty, so nothing was tracked | Informational. If files ever appear there they would be trackable; step 66 should re-check `git status` before staging |
| S25-8 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` are shared files | Not written (P6/P8; the controller synthesises them). Row 25 → done with commit `33e4c95` is for the controller to record |
