# Git specialist note: batch N checkpoint commit

Date: 2026-10-11
Branch: main (local only, no remote, no push, no branch change)
Commit: 035150b (full hash 035150b25dce603814dbc0330fbf79241cbd3752), on top of 713d83f
Totals: 67 files changed, 4079 insertions(+), 295 deletions(-); 0 stash entries; status empty right after the commit (this note is created after it, untracked).

File counts (staged, git name-status): 16 added, 51 modified, 0 deleted, 0 renamed. Docs under docs/: 21 paths; outside docs/: 46 paths (code, tests, package.json x2, .gitignore, README.md, openapi.json, the new `packages/shared/src/evidence-rules/index.ts`, `scripts/test/kill-matrix.sh`, `scripts/test/regression.sh`).
Subject and body as briefed (decisions D241, D242); trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` is the last line (checked). Includes the previously untracked `git_specialist_row97_commits.md`.
Staging was `git add -A` (ignored paths .data, .cache, .locks, release excluded by .gitignore). No rebase, amend, reset, stash or clean.

Checks made before the commit:
- `git status --short` (67 paths: 51 tracked changes, 16 untracked incl. 2 new script files and 1 new shared source file), `git diff --stat` (51 files, 1580 insertions, 295 deletions). Index was empty; no stash.
- Name guard on all 67 paths (release/, signing/, .data, .cache, .locks, node_modules, .docx, .env, key / certificate / model / media / archive extensions): 0 hits.
- Size guard: no added or modified file over 5 MB; one over 1 MB: packages/shared/openapi/openapi.json (1.37 MB, tracked, regenerated contract).
- `.gitignore` changed: after staging, `git ls-files -ci --exclude-standard` printed nothing (0 lines); run again after the commit: 0 lines.
- Secret scan of the whole staged diff (4079 added lines), 0 real hits:
  - token shapes (cloud, git host, JWT, npm, API key shapes): none
  - `mts_` / `exs_` plus 12+ characters: 1 line, a synthetic test case (`mts_abcDEF123456 exs_abcDEF123456`) in the redaction test; fake
  - private-key markers: none
  - credentials in URLs: 15 occurrences, all synthetic: `rtsp://user:pass@host` (1), `rtsp://user:password@host` (6), `rtsp://user:pw@10.0.0.5` (3, private-range example address), `scheme://user:password@host` (4), `scheme://user:password@` (1); no real-looking host with real credentials
  - `username=` / `secret=` / `password=` with a value (strict and loose patterns): 1 line, `const password: string = DEMO_OPERATOR_PASSWORD;` (a reference to the constant, not the value)
  - the published demo operator password: its value (read from `packages/shared/src/sim/dataset.ts`, never printed) compared with every added line of every staged file: 0 copies, no new location
  - labelled pairing code: none; long hex labelled key / secret / token / signature: none; long hex (24+): none
  - Stub-log values: 33 distinct `username=` / `secret=` values of 6+ characters from `.cache/gates/**` and `.cache/gate-env/**`, compared with every added line without printing: 0 hits. The value list was in the scratch dir only. `.locks/camera-stub.lane2.fixture` does not exist. `.data/pg*.env` not read or printed.
- Tracked-file stability: the hash of `git diff` was taken before staging; after staging `git diff` (working tree against index) was 0 lines and no untracked file remained. The environment agent's note `initialization/11_gate_environment_judging.md` did NOT exist when I staged, so it is NOT in this commit.

Excluded on purpose: nothing was left out of the commit except the above-mentioned `initialization/11_gate_environment_judging.md` (not yet present).
This note is left untracked.
