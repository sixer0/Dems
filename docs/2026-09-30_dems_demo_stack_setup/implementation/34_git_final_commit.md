---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 66
date: 2026-10-04
agent: git-specialist
narrative_tier: 3
status: complete
commit: see `git log -1` (the hash cannot be inside the commit it describes)
source_plan: identification/02_structured.md row 66 and the "One combined final commit" paragraph (line 144); masterplan/06_packaging_spec.md section 6.1; verification/02_security.md finding F-62-07
decisions: D5, D8, D44 (docs/ committed, local only), D38
---

# 34: Combined final local commit (blueprint step 66)

Run on 2026-10-04, cwd `/Users/gsp-budi/Documents/DEMS`, retry of an attempt (2026-10-01) that the controller reported as having done nothing. Git WRITE commands (`add`, `commit`) were run only where the sandbox refused `.git/index.lock`; this is noted per command in section 5. Post-commit output is recorded in `delegation_progress/git_specialist_step_66.md` (a committed file cannot quote its own commit).

## Result summary

| Item | Result | Evidence |
|---|---|---|
| Pre-checks: branch `main`, HEAD `33e4c95`, no remote | pass | 1a |
| Provenance (`--verify-inputs`): no build input changed since the packages were built | pass (748 files, digests equal), run twice | 1b, 2 |
| Required paths ignored (`release/`, APK, `apps/mobile/signing`, design book `.docx`, `apps/mobile/android`, `.locks`, `.cache`, `graft`) | all 8 ignored | 1c |
| F-62-07: `*.p12`, `*.pfx`, `*.key` in the root `.gitignore` | already present when this run started; no second append (see section 2 and the discrepancy note) | 2 |
| Secret and confidentiality scan of the staged set | clean; 3 pattern hits examined, all non-secret | 3 |
| Staged set | 2193 paths (29 modified, 1 deleted, 2163 new) plus this log | 4 |
| Excluded paths kept unstaged | the 6 pathspecs from the brief | 4 |
| One commit on `main`, existing git identity, no remote, no push, no tag | see `git log -1` | 5 |

## 1. Pre-checks (read-only)

### 1a. Repository state

```
$ git status --short | wc -l
    1001
$ git branch --show-current
main
$ git rev-parse --short HEAD
33e4c95
$ git remote -v
(empty)
$ git diff --cached --name-only | wc -l
       0
$ ls .git/index.lock
ls: .git/index.lock: No such file or directory
$ git rev-list --count 33e4c95..HEAD ; git stash list | wc -l ; git tag | wc -l
0
       0
       0
$ ls docs/.../implementation/34_git_final_commit.md docs/.../delegation_progress/git_specialist_step_66.md
No such file or directory (both)
```

`git status --short` counts untracked directories as one line each, so 1001 lines stand for 2193 paths once expanded (section 4). Nothing was staged, no lock file, no step-66 artefact and no extra commit existed: the earlier attempt left no git state behind.

### 1b. Provenance check (06 section 6.1)

```
$ node --import tsx scripts/release/build-web-packages.ts --verify-inputs
[build-web-packages] build inputs at build time: 748 files, digest 0e324957e189ea867b689e73bd932424c7a7071db9d39282e6d0cef081c2f1a3
[build-web-packages] build inputs now:           748 files, digest 0e324957e189ea867b689e73bd932424c7a7071db9d39282e6d0cef081c2f1a3
[build-web-packages] OK: no build input changed since the packages were built
exit=0
```

Second signal, the `find` from 06 line 1000 and the row-66 acceptance text:

```
$ find apps packages scripts -newer release/web/BUILD-INFO.txt -type f -not -path '*/node_modules/*' -not -path 'apps/mobile/android/*'
apps/.DS_Store
apps/mobile/.DS_Store
apps/mobile/.expo/dev/logs/start.log
$ stat -f '%Sm %N' release/web/BUILD-INFO.txt
Oct  1 11:48:31 2026 release/web/BUILD-INFO.txt
```

The three newer files are all git-ignored (`.DS_Store`, `.expo/`, `*.log`) and none is a build input; none appears in the staged set (section 3). The authoritative check is `--verify-inputs` above, which hashes the real input list.

### 1c. Ignore checks

```
$ git check-ignore -v release/web/SHA256SUMS.txt release/android/DEMS-Demo-0.1.0.apk apps/mobile/signing "DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx" apps/mobile/android .locks .cache graft
.gitignore:64:/release/	release/web/SHA256SUMS.txt
.gitignore:64:/release/	release/android/DEMS-Demo-0.1.0.apk
.gitignore:65:apps/mobile/signing/	apps/mobile/signing
.gitignore:9:*.docx	DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx
apps/mobile/.gitignore:43:/android	apps/mobile/android
.gitignore:59:.locks/	.locks
.gitignore:47:.cache/	.cache
.gitignore:2:/graft/	graft
exit=0
```

Eight paths in, eight ignore rules out.

## 2. F-62-07: `.gitignore` patterns

Brief: append `*.p12`, `*.pfx`, `*.key` inside the "Android build artefacts and signing material" block, after confirming no tracked file needs to match `*.key`.

```
$ git ls-files '*.key'
(empty)
$ find . ( -name node_modules -o -name .git ) -prune -o -type f -name '*.key' -print
(empty)
$ find . ( -name node_modules -o -name .git ) -prune -o -type f ( -name '*.p12' -o -name '*.pfx' ) -print
./apps/mobile/signing/dems-demo-release.p12        (inside the ignored signing folder; path only, not read)
```

No file that must be tracked matches `*.key`, so all three patterns are kept.

**Discrepancy found.** When this run started, the three patterns were already in the working-tree `.gitignore`, at lines 35-37, in the correct block, directly after `local.properties`:

```
$ git diff -- .gitignore            (hunk 1, against baseline 33e4c95)
 local.properties
+*.p12
+*.pfx
+*.key
```

The file mtime is `Oct  1 12:06:48 2026`, which is after the F-62-07 finding (step 62) and after `BUILD-INFO.txt` (11:48:31). The brief said the first attempt "did nothing", so the earlier attempt, or another agent, applied this edit before it stalled. The content is exactly the requested append, so a second append would only create duplicate lines; none was made. `.gitignore` is therefore modified only by the pre-existing working-tree edits (hunk 1 above plus hunk 2, the `/release/` and `apps/mobile/signing/` rules from steps 94/100); this run changed no source or config file.

Effect check:

```
$ git check-ignore -v foo.p12 apps/core-web/foo.p12 foo.pfx foo.key apps/core-web/foo.key
.gitignore:35:*.p12	foo.p12
.gitignore:35:*.p12	apps/core-web/foo.p12
.gitignore:36:*.pfx	foo.pfx
.gitignore:37:*.key	foo.key
.gitignore:37:*.key	apps/core-web/foo.key
exit=0
$ git check-ignore -v packages/shared/assets/demo-evidence/x/device-certificate.pem
exit=1                                             (not ignored, as required)
$ grep -nE '^\*\.(p12|pfx|key)$' .gitignore
35:*.p12
36:*.pfx
37:*.key                                           (each exactly once)
```

`*.pem` was deliberately not added: 14 `device-certificate.pem` files are DEMO public certificates the app needs (section 3).

Provenance re-run after the `.gitignore` review: same three lines as 1b, `OK: no build input changed since the packages were built`, exit 0. `.gitignore` is not a build input.

## 3. Secret and confidentiality scan

Scope: the 2193 candidate paths from `git add -A --dry-run` with the six excluded pathspecs (section 4). No `node_modules` was scanned. Matched values were never printed.

| Check | Command (summary) | Result |
|---|---|---|
| Forbidden directories | candidates matching `(^\|/)(release\|signing\|android)/`, minus `scripts/release/` | none; `scripts/release/` contributes 3 packager sources |
| Forbidden extensions | `.apk .aab .keystore .jks .p12 .pfx .key .docx .doc` | none |
| Environment files | `.env*` other than `.env.example` | none |
| Caches and junk | `node_modules`, `.cache`, `.locks`, `.expo`, `graft`, `.DS_Store` | none |
| Properties and keystore files | `*.properties`, `keystore`, `*.pem` by name | only `apps/mobile/scripts/create-demo-keystore.sh` (a script) and the 14 demo `.pem` files |
| Files over 50 MB | size test per file | none; largest is 15,768,780 B (`verification/assets/96_tablet_logcat_app_warn_error.txt`) |
| Other secret shapes | AWS `AKIA`, `ghp_`, `xox*-`, `sk-...`, PGP/OpenSSH headers | none |

### 3.1 PEM private keys

`grep -laE 'BEGIN (RSA |EC |OPENSSH |ENCRYPTED |DSA )?PRIVATE KEY'` over the candidates returned one file: `docs/2026-09-30_dems_demo_stack_setup/verification/09_mobile_security.md`, line 42. It is prose describing a planted test string ("a planted `AKIA...` line and a `BEGIN PRIVATE KEY` line gave `2`"). The file has 0 lines that look like a base64 key body. Not a key.

All 14 candidate `.pem` files contain only `-----BEGIN CERTIFICATE-----` blocks (14 of 14); no private-key block. They are the DEMO public device certificates.

### 3.2 The DEMO Ed25519 signing key

`packages/shared/scripts/gen-demo-evidence.ts` and its test mention `ed25519`/`privateKey`. The generator derives the Ed25519 key in memory from the published phrase `DEMO_SEED_PHRASE` (file header, line 24: "DEMO key (D51)"; derivation at lines 350-358) and writes no key file. Neither file holds a quoted base64 or hex literal of 40 characters or more. This is the documented DEMO key used only to sign the synthetic demo packages (it is referenced in `implementation/65_demo_evidence.md`, `implementation/26_page_evidence.md`, `verification/02_security.md` and `verification/09_mobile_security.md`; a search of `implementation/` for step-93 file names found none, so the brief's "step-93 logs" pointer was not confirmed by name). No other private key exists in the staged set.

### 3.3 Keystore password patterns

`grep -laE '(storePassword|keyPassword|STORE_PASSWORD|KEY_PASSWORD|store_password|key_password)[[:space:]]*[=:][[:space:]]*[^[:space:]]'` matched three files. Each hit was classified without printing its value:

| File | Line | Classification |
|---|---|---|
| `apps/mobile/scripts/create-demo-keystore.sh` | 59, 60 | placeholder: value starts with `$DEM`, an environment-variable reference |
| `docs/.../masterplan/06_packaging_spec.md` | 182 | placeholder: values start with `<32` and `<sam` (angle-bracket descriptions) |
| `docs/.../verification/09_mobile_security.md` | 117 | prose: the 32-character token had 0 digits and 5 backticks; its letter-masked shape was `` `/`xxxxxxxxxxx=`/`xxxx_xx_xxxx=` ``, i.e. a list of grep pattern names in a markdown sentence, not a password |

`apps/mobile/signing/` is git-ignored (1c) and was not opened, listed or read in this run; the release keystore password is not known to this agent and no staged file carries a literal after `storePassword=` or `keyPassword=`.

### 3.4 Names only: screenshots

Three docs screenshots have "password" in the file name (`75_dems_phone_home_after_password.png`, `75_dems_tablet_home_after_password.png`, `75diag_dems_phone_demo_fill_empty_password.png`). They are UI evidence of the demo login flow (demo operators), not credential files. Pixel content was not inspected.

## 4. Staged set

Candidate list: `git add -A --dry-run -- . ':(exclude)...'` gave 2193 lines: 2192 `add` plus 1 `remove`. The `remove` is the expected scaffold deletion `apps/core-web/src/routes/index.tsx`.

Excluded pathspecs (stay unstaged, go into a later docs commit):

```
:(exclude)docs/2026-10-04_dems_backend_rbac_pairing
:(exclude)docs/2026-09-30_dems_demo_stack_setup/status_tasks.md
:(exclude)docs/2026-09-30_dems_demo_stack_setup/delegation_progress_report.md
:(exclude)docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md
:(exclude)docs/2026-09-30_dems_demo_stack_setup/README.md
:(exclude)docs/2026-09-30_dems_demo_stack_setup/report
```

The `docs/2026-10-04_dems_backend_rbac_pairing/` folder was not listed, read, staged or modified.

Composition of the 2193 candidate paths: 29 modified tracked files, 1 deleted tracked file, 2163 new files. Size of the 2192 files that exist: 507,849,741 B (484.3 MiB).

| Area | Files | MiB |
|---|---:|---:|
| root files (`.gitignore`, `README.md`, `THIRD_PARTY_NOTICES.md`, `package-lock.json`) | 4 | 0.9 |
| `apps/core-web` | 354 | 2.2 |
| `apps/mobile` | 513 | 15.2 |
| `apps/mock-core` | 3 | 0.1 |
| `packages/shared` | 393 | 47.5 |
| `scripts` | 3 | 0.1 |
| `docs/2026-09-30_dems_demo_stack_setup` | 922 | 418.3 |
| total | 2192 existing + 1 deletion | 484.3 |

Plus this log (1 file, under 20 KiB) in `docs/.../implementation/`, so the commit holds 2194 paths.

Inside `packages/shared`: `assets/demo-media` 198, `assets/demo-evidence` 89, `src/sim` 33, `src/i18n` 15, `src/demo-data` 7, `src/api` 6, `src/brand` 3, `assets/brand` 3, `assets/hero` 2, `src/tokens` 2, the rest tests and theme. `apps/mobile`: `src` 417, `assets` 88, `scripts` 3, `plugins` 1, plus config. `apps/mock-core`: `standalone/dems-web-launcher.cjs`, `standalone/tsconfig.json`, `test/standalone-launcher.test.ts`. `scripts/release`: `build-web-packages.ts`, `collect-web-licenses.ts`, `gen-npm-licenses.mjs`.

## 5. Commit

Message subject: `feat: DEMS demo - web console, mobile app, shared simulator, packaging`

Message body (written to `/tmp/claude-501/dems_step66_commit_msg.txt`, passed with `-F`) summarises the web console (10 pages plus the Start Session flow), the mobile app (phone and tablet), the shared simulator, tokens, i18n, OpenAPI and demo media and evidence, the standalone mock-core launcher, the packaging scripts, and the docs and verification records, and states that release binaries and signing material are not versioned. The trailer block has two lines: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the model that ran this git step, per the harness attribution rule) followed by, as the final line, exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (required by the brief; same as the baseline commit). Decision: both lines kept so that the brief's "ends with exactly" holds and the attribution stays accurate. No emoji. No `--no-verify`. The existing git identity was used; `git config` was not touched.

Commit hash: see `git log -1`. Post-commit checks: `delegation_progress/git_specialist_step_66.md`.

## 6. Rollback

All rollbacks are local; nothing was pushed.

| Goal | Command | Effect |
|---|---|---|
| Undo the commit, keep every file and keep it staged | `git reset --soft 33e4c95` | HEAD returns to the baseline; working tree and index unchanged |
| Undo the commit and unstage, keep every file | `git reset --mixed 33e4c95` | working tree unchanged; changes show as unstaged |
| Roll one lane back to the baseline | `git checkout 33e4c95 -- apps/mobile` (or `apps/core-web`) | the lanes own disjoint paths (02_structured.md line 147) |

Do not use `git reset --hard`: ignored release binaries and the signing folder are not tracked, but uncommitted work in the excluded docs paths would be lost.

## 7. Notes for the controller

1. The `.gitignore` F-62-07 lines pre-existed (section 2). Whoever added them should be recorded in the decision log; the end state is as specified.
2. `docs/` is 418 MiB of the 484 MiB (evidence screenshots, logs). The repository grows accordingly (`git count-objects -vH` is in the progress file). This follows D8/D44 (docs committed, local only).
3. The excluded docs files and the new task folder remain for the later docs commit.
