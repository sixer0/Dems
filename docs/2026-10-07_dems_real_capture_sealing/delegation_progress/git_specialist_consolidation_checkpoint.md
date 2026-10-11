# Git specialist note: test-suite consolidation checkpoint commit

Date: 2026-10-11
Branch: main (local only, no remote, no push, no branch change)
Commit: 951c80e (full hash 951c80e5b36f5d6f74f4379671d4f93071460e85), on top of a5d75ed
Totals: 384 files changed, 27782 insertions(+), 23808 deletions(-); 0 stash entries; status clean right after the commit.

File counts (staged, git name-status): 36 added, 176 modified, 138 deleted, 34 renamed (git detected the renames itself; no git mv). Deleted plus renamed-away = 172 test paths, matching the 172 deleted entries seen before staging.

Procedure: as the wave M note (git_specialist_wave_m_checkpoint.md). Everything staged with `git add -A`; ignored paths (.data, .cache, .locks, release) excluded by .gitignore. No rebase, amend, reset, stash or clean.

Checks made before the commit:
- Deleted paths: all 172 are `*.test.ts(x)` files, except one: apps/mobile/src/features/evidence/testing/wave-h-c2-kit.tsx (test kit inside a `testing/` folder, allowed). Note: about 60 deleted mobile test files sit next to their source (not under `__tests__/`, `test/` or `testing/`) but all are named `*.test.ts(x)`; read as test files by the name rule.
- Untracked files (65 before staging): all under docs/ or test files / test support (`__tests__/`, `test/`, `testing/`, `*.test.ts(x)`); no product file.
- Modified non-test, non-doc files: exactly the five named product files; each diff contains only comment lines (no code line added or removed): packages/shared/src/sim/selector-in-force.ts, apps/core-server/src/capture/supervisor.ts, apps/core-server/src/capture/boot/checks.ts, apps/mobile/src/features/capture-selector/source-state.ts, apps/mobile/src/features/capture-selector/selector-in-force.ts.
- Name guard on the 384 staged paths (release/, apps/mobile/signing/, .docx, .data/, .cache/, .locks/, .env, node_modules, key / keystore / certificate names, media / model / archive extensions): 0 hits.
- Size guard: no added or modified file over 1 MB (so none over 5 MB).

Secret scan of the whole staged diff (27782 added lines), 0 real hits:
- token shapes (cloud, git host, JWT, npm, API key shapes): none
- `mts_` / `exs_` plus 12+ characters: 2 lines, both in a mobile test fixture, obviously fake padded values (`mts_onecameraAAAA...`, `mts_reconcileRAAAA...` in 127.0.0.1 URLs); not real tokens
- private-key markers, credentials inside URLs: none
- `username=` / `secret=` / `password=` with a value: 3 lines, all code (`operator.username`, `signInAs = (username: string)`), no literal value
- labelled pairing code: none; long value labelled key / secret / token / signature: none
- long hex (24+): one, the full hash of a5d75ed in the wave M note (not a secret)
- Pay-attention docs all in the commit and covered by the scan: initialization/10_gate_environment_wave_m.md, gateway_check/14_wave_m_confirmation.md, test/13, test/14_consolidation_*.md (5 files), test/15, test/16, delegation_progress/consolidation_brief.md, git_specialist_wave_m_checkpoint.md.
- Fixture account of the camera stub: `.locks/camera-stub.lane2.fixture` does not exist; all `username=` / `secret=` values of length 6+ in 2291 files under `.cache/gates/**` and `.cache/gate-env/**` (32 distinct values, never printed) compared with every added line: 0 hits. `.data/pg*.env` not read or printed.

Tracked-file stability: after staging, `git diff` (working tree against index) was 0 lines and no untracked file remained.

Excluded on purpose: nothing was left out.
This note is left untracked.
