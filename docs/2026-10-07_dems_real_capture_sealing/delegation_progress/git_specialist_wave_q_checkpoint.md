# Git specialist note: wave Q checkpoint commit

Date: 2026-10-12
Branch: main (local only, no remote, no push, no branch change)
Commit: 64a4858 (full hash 64a4858478616090b028b94885d07a7550d87159), on top of b4b0c25
Totals: 143 files changed, 5494 insertions(+), 365 deletions(-); 0 stash entries.

File counts (staged): 23 added, 120 modified, 0 deleted, 0 renamed. By area: apps/core-web 52, apps/mobile 75 (incl. patches/, scripts/apply-patches.sh, plugins/with-dems-library-patches.js, app.json, package.json), docs/2026-10-07_dems_real_capture_sealing 13 (incl. initialization/12, report/confirm_c1..c3, implementation/176..178, test/19, decisions, the wave J checkpoint note), root package.json 1, README.md 1. No change under .gitignore.
Subject and body as briefed (D246, D247, D248); trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` is the last line (checked).
Staging was by explicit path list (143 paths from `git status --short -uall`, minus the other task); no `git add -A` / `git add .`. No rebase, amend, reset, stash or clean.

Core / shared claim: `git diff --cached --stat -- apps/core-server packages` was empty (0 lines) before the commit, so the sentence "No Core or shared source changed in this commit" is true as written.

Checks before the commit:
- Name guard on the 143 paths (release/, signing/, .data, .cache, .locks, node_modules, .docx, .apk, .mp4, .webm, .env, key/certificate/model/media/archive/image extensions): 0 hits. Nothing from .cache/wave-q. `git check-ignore -v` confirms apps/mobile/android/app/build (apps/mobile/.gitignore:43), .cache/wave-q (.gitignore:47), apps/core-web/.tanstack/tmp (.gitignore:48). `git ls-files -ci --exclude-standard`: 0 lines, before and after.
- Size guard: no staged file over 5 MB (none over 1 MB); numstat: 0 binary files.
- Secret scan of the whole staged diff (5493 added lines), 0 real hits:
  - token shapes (cloud, git host, JWT, npm, API-key shapes): none
  - `mts_` / `exs_` plus 12+ characters: none; private-key markers: none
  - credentials in URLs: 1 line, the wave J note quoting a synthetic `rtsp://user:pass@host` example; fake
  - `username=` / `secret=` / `password=` / `token=` with a real value: none (1 false match, a `const token = typography[size]` line)
  - published demo operator password (read from `packages/shared/src/sim/dataset.ts`, never printed): 0 added lines contain it, so no new copy anywhere
  - labelled pairing code: none (1 prose line saying none is present); long hex labelled key / secret / token: none; long hex 32+: 4 lines, all non-secret (two test fixtures in box-check tests, the wave J note's commit hash, the debug APK sha256 in a report)
  - stub-log values: 72 distinct values of 6+ characters from `.cache/**` and `.locks/**` logs, plus the tokens of `.locks/camera-stub.lane2.fixture`, compared with every added line without printing. Hits: only the Android package id `com.dems.demo.tablet` and two generic field-label words (`username`, `secret`) that the fixture file also contains as keys. Non-word values: 0 hits. `.data/pg*.env` not read or printed.
- Tracked-file stability: the Core/shared emptiness and the totals above were taken from the staged index immediately before the commit.

Suspicious / for the controller:
1. `docs/2026-10-07_dems_real_capture_sealing/report/report.md` was rewritten at 18:48, AFTER my status snapshot and staging (it was not in the 143 paths). It is now modified (89 insertions, 1 deletion: new "FINAL REPORT" text, prepared 2026-10-14 by the controller). It is task-3 documentation, but it looks mid-edit, so it was left unstaged and uncommitted. Commit it with the next checkpoint when the controller is done with it.
2. `docs/2026-10-07_dems_real_capture_sealing/test/19_final_regression.md` (committed) mentions input-av / NVR by name, only to document that another task's files were present in the tree during the run; it is task-3 content and was committed on purpose.
3. No path outside the allowed areas was found other than the other task's.

Left unstaged on purpose:
- apps/input-av/ (50 files) and docs/2026-10-12_input_av_core_adapter_plan/ (33 files): another task from another session.
- docs/2026-10-07_dems_real_capture_sealing/report/report.md (modified after staging; see above).
- this note (untracked).

Slip: none this time (the demo password was compared via a variable and never printed).
