---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 66
date: 2026-10-04
agent: git-specialist
status: complete
commit: acaff203288d4d7b4ad1e744b1aff8716817c52c
parent: 33e4c9577ff55c3b8d6375529ad75ad936b8e4ac
step_log: implementation/34_git_final_commit.md (committed inside acaff20)
this_file: uncommitted on purpose; goes into the later docs commit
---

# Git specialist, step 66: progress record

## Outcome

One local commit on `main` directly above the baseline. Nothing pushed, no remote, no tag, no history rewrite, no gc/prune/clean/reset/stash, no file deleted or renamed by this run.

| Item | Value |
|---|---|
| Commit | `acaff203288d4d7b4ad1e744b1aff8716817c52c` (`acaff20`) |
| Subject | `feat: DEMS demo - web console, mobile app, shared simulator, packaging` |
| Parent | `33e4c9577ff55c3b8d6375529ad75ad936b8e4ac` (baseline, untouched) |
| Size | 2194 files changed, 338,568 insertions(+), 1,056 deletions(-) |
| Composition | 2164 added, 29 modified, 1 deleted (`apps/core-web/src/routes/index.tsx`) |
| Author name | Budi Kusharyanto (existing git identity, `git config` not touched) |
| Trailers | `Co-Authored-By: Claude Sonnet 5.5 ...` then, as the last line, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` |
| Sandbox | `git add` and `git commit` both ran inside the sandbox; no bypass was needed |
| Hooks | none (`.git/hooks` has only samples, no `core.hooksPath`, no `.husky`); no `--no-verify` |

## Post-checks (step 6), recorded output

```
$ git log --oneline -3
acaff20 feat: DEMS demo - web console, mobile app, shared simulator, packaging
33e4c95 chore: baseline DEMS demo stack scaffold (web, mobile, mock-core, shared)

$ git show --stat --format='%H%n%an%n%s' HEAD | tail -5
 packages/shared/theme/scalar.css                   |     84 +
 scripts/release/build-web-packages.ts              |    949 +
 scripts/release/collect-web-licenses.ts            |    248 +
 scripts/release/gen-npm-licenses.mjs               |    192 +
 2194 files changed, 338568 insertions(+), 1056 deletions(-)

$ git rev-list --count 33e4c95..HEAD ; git rev-parse HEAD^
1
33e4c9577ff55c3b8d6375529ad75ad936b8e4ac

$ git status --short
 M docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md
 M docs/2026-09-30_dems_demo_stack_setup/delegation_progress_report.md
 M docs/2026-09-30_dems_demo_stack_setup/status_tasks.md
?? docs/2026-09-30_dems_demo_stack_setup/report/
?? docs/2026-10-04_dems_backend_rbac_pairing/

$ git ls-files | grep -E '^release/|apps/mobile/signing/|\.apk$|\.keystore$|\.jks$|\.p12$|\.docx$'
(empty; grep exit 1)

$ git remote -v
(empty)

$ git count-objects -vH            (first call, while git's own post-commit auto-maintenance was mid-repack)
warning: garbage found: .git/objects/pack/tmp_pack_YtTrhO
count: 2475 / size: 450.66 MiB / in-pack: 0 / packs: 0 / garbage: 1 / size-garbage: 247.00 MiB

$ git count-objects -vH            (settled, a few seconds later)
count: 0
size: 0 bytes
in-pack: 2475
packs: 2
size-pack: 441.80 MiB
prune-packable: 0
garbage: 0
size-garbage: 0 bytes
```

Additional confirmations: the committed `.gitignore` holds `*.p12`, `*.pfx`, `*.key` once each at lines 35-37; the 8 required paths are still ignored (`git check-ignore` printed 8 lines); `--verify-inputs` after the commit again printed `OK: no build input changed since the packages were built`; `git for-each-ref` lists only `refs/heads/main`; no tag, no stash, no other branch.

The three modified files above (`decisions.md`, `delegation_progress_report.md`, `status_tasks.md`) exist in `HEAD` only in their baseline versions; their newer working-tree edits are unstaged, as required. The task-folder `README.md` is tracked from the baseline and had no working-tree change, so it did not enter this commit. `report/` and `docs/2026-10-04_dems_backend_rbac_pairing/` are untracked and untouched (the latter was not listed, read, staged or modified).

## Milestones

1. Pre-checks passed: HEAD `33e4c95`, branch `main`, no remote, 1001 status lines (2193 paths once expanded), provenance OK (748 files), 8 of 8 required paths ignored.
2. F-62-07 resolved: `*.p12`, `*.pfx`, `*.key` active in the root `.gitignore` (verified effective on `foo.p12`, `foo.pfx`, `foo.key`); `*.pem` deliberately left un-ignored (14 demo public certificates).
3. Secret and confidentiality scan clean on both the working-tree candidate list and the staged blobs (`git grep --cached`).
4. Staged set verified equal to the dry-run list plus the step log; none of the six excluded pathspecs staged.
5. Commit created and post-checks passed.

## Decisions and findings for the controller to record

1. **F-62-07 edit pre-existed.** The three patterns were already in the working-tree `.gitignore` when this run started (lines 35-37, mtime `Oct 1 12:06:48 2026`, after the step-62 finding). The brief said the first attempt wrote nothing, so the earlier attempt or another agent made this edit. It is exactly the requested content, so no second append was made (a second append would only duplicate lines). Suggested record: "F-62-07 closed; edit applied 2026-10-01 12:06 by an unrecorded actor, verified and committed in step 66."
2. **Trailer decision.** The brief requires the message to end with the Opus 5.5 trailer; the harness attribution rule asks for a Sonnet 5.5 trailer. Both lines are in the trailer block, Sonnet first, Opus last, so "ends with exactly" holds and attribution is accurate. If the controller wants only the Opus line, that needs `git commit --amend`, which this brief did not authorise.
3. **Scan hits explained (no secret found).** One PEM-header hit is prose in `verification/09_mobile_security.md:42`. Three password-pattern hits are a `$DEM...` variable reference in `apps/mobile/scripts/create-demo-keystore.sh`, `<...>` placeholders in `masterplan/06_packaging_spec.md:182`, and a markdown list of grep pattern names in `verification/09_mobile_security.md:117`. The DEMO Ed25519 key is derived in memory from `DEMO_SEED_PHRASE` in `packages/shared/scripts/gen-demo-evidence.ts` (D51); no key file exists. `apps/mobile/signing/` was never opened or listed.
4. **Brief pointer not confirmed.** The brief says the DEMO key is documented in "step-93 logs under implementation/". No step-93 file was found there; the key is documented in `implementation/65_demo_evidence.md`, `26_page_evidence.md`, `verification/02_security.md` and `09_mobile_security.md`. Cosmetic, no impact.
5. **Repository size.** `docs/` is 418.3 MiB of the 484.3 MiB committed; the `.git` store is 441.8 MiB packed. Consistent with D8/D44 (docs committed, local only). Largest single file 15.0 MiB; nothing over 50 MiB.
6. **Git auto-maintenance ran after the commit.** Git's own background maintenance repacked the loose objects into packs (a transient `tmp_pack_*` file showed as "garbage" for a moment, then disappeared). Not a command issued by this run; no prune of reachable data; `count-objects` is clean now.
7. **Stray file `.git/refs/.DS_Store` (needs-attention, not a blocker).** `git fsck --connectivity-only --no-dangling` exits 8 with exactly two lines, `error: refs/.DS_Store: badRefName` and `badRefContent`. No missing or corrupt object is reported, and `git for-each-ref`, `git log` and `git status` work normally. The file is macOS Finder metadata (6148 B, mtime `Oct  4 00:54:47 2026`); this run did not create it and did not delete it (deleting is outside the brief). Suggested fix for the user: `rm .git/refs/.DS_Store`, then re-run `git fsck`.
8. **Name-only note.** Three docs screenshots have "password" in their file names (`75_dems_phone_home_after_password.png` and two others); they are demo-login UI evidence. Pixel content was not inspected.

## Blockers

None.

## Files created or updated by this run

| Path | Action | Committed |
|---|---|---|
| `docs/2026-09-30_dems_demo_stack_setup/implementation/34_git_final_commit.md` | created (step log) | yes, in `acaff20` |
| `docs/2026-09-30_dems_demo_stack_setup/delegation_progress/git_specialist_step_66.md` | created (this file) | no, by design |
| `/tmp/claude-501/dems_step66_commit_msg.txt` | created (commit message, outside the repo) | n/a |

No source file was modified by this run. `.gitignore` was not edited (patterns were already present).

## Rollback

```
git reset --soft 33e4c95      # undo the commit, keep working tree and index (changes stay staged)
git reset --mixed 33e4c95     # undo the commit, keep working tree, unstage
git checkout 33e4c95 -- apps/mobile   # roll one lane back (also apps/core-web)
```

Do not use `git reset --hard`: it would destroy the uncommitted edits in the excluded docs paths.
