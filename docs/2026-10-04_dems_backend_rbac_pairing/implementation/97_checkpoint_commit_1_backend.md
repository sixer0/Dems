---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-05
agent: git-specialist
plan_row: W104 (step 125)
status: completed
evidence_tier: 3
commit: b90a3c690c5f635a4af1edf95e316c24540c4431
---

# Checkpoint commit 1 (after the backend gate): COMPLETE

Status: **completed**. One local commit, `b90a3c6`, on `main`, parent `4b708c8`. No remote, no push,
no tag, no amend, no reset, no stash, no hook bypass.

This file and `delegation_progress/git_specialist_step_125.md` were written AFTER the commit, because
they must carry its hash. They are untracked and are NOT in `b90a3c6`; the next checkpoint commit takes them.

Run history: the run first stopped (status `blocked`, 20:10 to 20:16 WIB) on a content-scan hit class,
then continued on the controller's ruling D150 (hits are synthetic placeholders and agent-tool session
ids; the `.data/pg.*` content match was run by the controller with fixed-string patterns, 0 hits).
Sections 1 and 2 are the first-pass evidence; sections 3 to 5 are the continuation.

## 1. Inherited state (read-only commands, 2026-10-05 20:10 to 20:15 WIB)

| Check | Command | Output |
|-------|---------|--------|
| index lock | `ls .git/index.lock` | `No such file or directory` |
| HEAD / branch | `git rev-parse --short HEAD`; `git branch --show-current` | `4b708c8`; `main` |
| porcelain total | `git status --porcelain \| wc -l` | `1563` |
| staged | `git diff --cached --name-only \| wc -l` | `1558` |
| status codes | `git status --porcelain \| cut -c1-2 \| sort \| uniq -c` | `1464 "A "`, `94 "M "`, `2 " M"`, `3 "??"` |
| not staged | `git status --porcelain \| grep -vE '^[AMRD] '` | 2 ` M` (the two web tests), 3 `??` (the two mobile models, `packages/shared/.vitest/`) |
| remote | `git remote -v` | empty |
| forbidden classes in staged names | `git diff --cached --name-only \| grep -E '(release\|.data\|.cache\|.locks)/\|apps/mobile/signing/\|.env\|.pwfile\|.keystore\|.jks\|.docx\|.pem\|.p12\|.key'` | no match (grep exit 1) |
| `git ls-files release .data .cache .locks apps/mobile/signing \| wc -l` | | `0` |
| staged file edited after staging | status codes `A ` and `M ` only (no `AM`/`MM`) | none |
| source changed after 2026-10-05 19:31 | `find apps packages -type f -newermt '2026-10-05 19:31:00'` (excl. node_modules, dist, coverage, .vitest, build, .expo) | empty (run twice: 20:14 and again before staging) |
| `docs/` newer than the index | `find docs -type f -newer .git/index` | empty (index mtime 19:56:05) |
| `.vitest` pattern collision | `git ls-files \| grep -cE '(^\|/)\.vitest(/\|$)'` (index included) | `0` |
| existing `.vitest` ignore | `grep -n vitest .gitignore` | none (exit 1) |

mtimes of the five left-out paths: dashboard test 10-04 06:48:01, storage-page test 10-04 06:29:25,
`login-live-model.ts` 10-05 10:29:45, `pairing-live-model.ts` 10-04 21:05:36, `.vitest/json/output.json`
10-04 09:32:32. All predate 19:31.

## 2. Content scan of the staged diff (counts only, no matching line printed)

Scanned: `git diff --cached -U0` (23,575,407 bytes; 385,493 added lines), plus the four added files.

| Pattern | Hits |
|---------|------|
| private-key header `-----BEGIN ... PRIVATE KEY` (added lines and whole diff) | 0 |
| `postgres://user:password@` URL | 0 |
| AWS / GitHub / Slack / `sk-` style keys | 0 |
| pgpass-style `host:port:db:user:password` line | 0 |
| `dvc_` / `ses_` / `bio_` followed by 20 or more token characters | **11** |
| the four added files, same patterns | 0 |
| `.data/pg.*` password values as fixed strings (run by the controller, D150; this agent never read `.data/*`) | 0 in the staged diff, 0 in the four paths |

The 11 hits, by file (token text never printed):

| File | Hits | Reading |
|------|------|---------|
| `packages/shared/openapi/openapi.json` | 7 | one example body (43 chars, 16 distinct, run of 9) reused across `ses`/`bio`/`dvc`; synthetic placeholder |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22_mutate.py` | 1 | same placeholder (mutation M35) |
| `apps/core-server/src/realtime/__tests__/upgrade.db.test.ts` | 1 | 43 identical characters, stray-cookie test filler |
| `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/06_backend_gate.md` | 1 | 26-char agent-tool session id in prose (F-1) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/request_translator_resume.md` | 1 | 26-char agent-tool session id ("Session:") |

Ruling D150 (controller, checked independently): synthetic placeholders `ses_EXAM...0000`,
`bio_EXAM...0000`, `dvc_EXAM...0000`; the two 26-char ids are session ids of the other agent tool, not
credentials, left as they are. Nothing here is a DEMS device, session or biometric token, a password or a
connection string.

## 3. The four paths added, and the ignore line

| Path | Why |
|------|-----|
| `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` | modified; calendar-robust clock fix of rows W01 / W01b (decision D31), +12/-1 |
| `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | modified; same fix, +12/-1 |
| `apps/mobile/src/features/login/login-live-model.ts` | new (W59, gated D138), 122 lines; imported by staged files, the commit would not typecheck without it |
| `apps/mobile/src/features/pairing/pairing-live-model.ts` | new (W57, gated D137), 190 lines; same reason |

Command (explicit paths only; no `git add -A` / `git add .`):

```
git add -- apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx \
  apps/core-web/src/features/storage/__tests__/storage-page.test.tsx \
  apps/mobile/src/features/login/login-live-model.ts \
  apps/mobile/src/features/pairing/pairing-live-model.ts .gitignore
```
exit 0, staged count 1,558 -> 1,562.

Ignore line appended to `.gitignore` (the only file edited by this run), then re-staged:

```

# Test runner output (vitest JSON reporter); generated, never versioned.
.vitest/
```
`git check-ignore -v packages/shared/.vitest/json/output.json` -> `.gitignore:73:.vitest/	packages/shared/.vitest/json/output.json`.
`packages/shared/.vitest/json/output.json` (a test runner's output) is therefore not committed.

## 4. Pre-commit confirmations

| Check | Output |
|-------|--------|
| `git status --porcelain \| grep -vE '^[AM]  '` | the two new `??` documents of this run only |
| `git ls-files release .data .cache .locks apps/mobile/signing \| wc -l` | `0` |
| `git remote -v` | empty |

## 5. The commit

| Property | Value |
|----------|-------|
| Operation | one local commit, message from file (`git commit -F`), no `--no-verify`, no hook failed |
| Branch | `main` |
| Hash (short / full) | `b90a3c6` / `b90a3c690c5f635a4af1edf95e316c24540c4431` |
| Parent | `4b708c83c15979f52842b8450754d5f16f0ae0fc` (`4b708c8`) |
| Commit time | `2026-10-05T20:16:38+07:00` |
| Subject | `feat: PostgreSQL backend, RBAC, device pairing and first client rows; checkpoint 1 after the backend gate` |
| Trailer (last line) | `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` |
| Files | 1,562 (1,466 added, 96 modified; none deleted or renamed) |
| Lines | 386,422 insertions, 6,324 deletions |

`git log -1 --stat | tail -5`:

```
 scripts/pg/static.test.mjs                         |   133 +
 scripts/pg/status.mjs                              |   119 +
 scripts/pg/stop.mjs                                |    18 +
 scripts/pg/trial.mjs                               |   260 +
 1562 files changed, 386422 insertions(+), 6324 deletions(-)
```

`git log --oneline -3`:

```
b90a3c6 feat: PostgreSQL backend, RBAC, device pairing and first client rows; checkpoint 1 after the backend gate
4b708c8 docs: backend, RBAC and pairing — research, specs, plan; close demo stack task
acaff20 feat: DEMS demo - web console, mobile app, shared simulator, packaging
```

Post-commit checks:

| Check | Output |
|-------|--------|
| `git status --porcelain \| wc -l` | `2` (not 0: the two documents of this run, by design) |
| the two lines | `?? docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/git_specialist_step_125.md` and `?? docs/2026-10-04_dems_backend_rbac_pairing/implementation/97_checkpoint_commit_1_backend.md` |
| `git remote -v` | empty |
| `git branch -a` / `git tag \| wc -l` | `* main` only / `0` |
| `git ls-files release .data .cache .locks apps/mobile/signing \| wc -l` | `0` |
| forbidden-class paths in `git show --name-only HEAD` (`release/`, `.data/`, `.cache/`, `.locks/`, `signing/`, `.env*`, `.pwfile`, `.keystore`, `.jks`, `.docx`) | `0` |
| `.vitest/` paths in the commit | `0` |

Verification quoted in the commit message (controller, 20:07 to 20:12 WIB, this exact tree; not re-run here):
typecheck exit 0 in shared, core-server, core-web, mobile, mock-core; lint exit 0 in shared, core-server,
core-web, mobile; shared 68 files / 1,814, core-web 55 / 760, mobile 94 suites / 1,230, mock-core 4 / 19,
core-server `unit` 153 / 3,912, core-server `db` 122 / 1,740 (0 databases left), all exit 0.

## 6. Left out of the commit

| Path | Why |
|------|-----|
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/97_checkpoint_commit_1_backend.md` | carries the commit hash, so written after it; next checkpoint |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/git_specialist_step_125.md` | same |
| `packages/shared/.vitest/` | test-runner output; now ignored by `.vitest/` |

Not staged by design (never in the index): `release/`, `.data/`, `.cache/`, `.locks/`, `apps/mobile/signing/`,
the design book, every env or credential file.

## 7. Rollback

```
git reset --soft 4b708c8
```

Local only. Keeps the working tree and re-stages everything of this commit; nothing was pushed.

---
*Generated: 2026-10-05 20:16*
*Last Updated: 2026-10-05 20:22*
