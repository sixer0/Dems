# Git specialist note: wave J checkpoint commit

Date: 2026-10-12
Branch: main (local only, no remote, no push, no branch change)
Commit: b4b0c25 (full hash b4b0c25fda41eff32d85e16df4223719679eed83), on top of 035150b
Totals: 524 files changed, 20325 insertions(+), 1918 deletions(-); 0 stash entries; `git status --short` empty right after the commit (this note is created after it, untracked).

File counts (staged, git name-status): 87 added, 437 modified, 0 deleted, 0 renamed. Under docs/: 26 paths; outside docs/: 498 paths. By extension: 277 tsx, 206 ts, 27 md, 12 css, 1 json (openapi.json), 1 .gitignore.
Subject and body as briefed (D243, D244, D245); trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` is the last line (checked). Includes the previously untracked `git_specialist_batch_n_checkpoint.md`, `routeTree.gen.ts` change and `sessions.css`.
Staging was `git add -A`. No rebase, amend, reset, stash or clean.

Housekeeping edit (made first): `.tanstack/` added to the root `.gitignore` under `.cache/` (tooling caches). `git check-ignore -v apps/core-web/.tanstack/tmp` -> `.gitignore:48:.tanstack/`. `git ls-files -ci --exclude-standard` printed nothing (0 lines), before staging and after the commit; no tracked file lives under `.tanstack/`.

Checks made before the commit:
- `git status --short`: 524 paths (437 tracked modifications, 87 untracked). `git diff --stat`: 437 files, 11981 insertions, 1918 deletions. Index was empty; no stash.
- Name guard on all 524 paths (release/, signing/, .data, .cache, .locks, .tanstack, node_modules, .docx, .env, key / certificate / model / media / archive / image extensions): 0 hits. No excluded path staged.
- Size guard: no added or modified file over 5 MB; one over 1 MB: packages/shared/openapi/openapi.json (1.41 MB, tracked, regenerated contract). No binary file in the commit (numstat: 0 binary).
- Secret scan of the whole staged diff (20325 added lines, with file and line positions), 0 real hits:
  - token shapes (cloud, git host, JWT, npm, API-key shapes): none
  - `mts_` / `exs_` plus 12+ characters: 1 line, in the previous checkpoint note quoting its synthetic test case; fake
  - private-key markers: none
  - credentials in URLs: 1 line, the previous note quoting synthetic `rtsp://user:pass@host` style examples; no new real-looking URL with credentials
  - `username=` / `secret=` / `password=` with a real value (strict and loose patterns): none (the 2 loose matches are `username: operator.username` and a function signature)
  - the published demo operator password: its value (read from `packages/shared/src/sim/dataset.ts`) compared with every added line: 6 lines, all in two files that already held it in HEAD (`apps/mobile/src/runtime/route-sync.test.ts` lines 101, 110, 115; `packages/shared/test/sim-own-capture.test.ts` lines 485, 509, 545). No new file holds a copy; none of the new docs, reports or judging notes does.
  - labelled pairing code: none; long hex labelled key / secret / token: none; long hex (32+): 8 in openapi.json (example content hashes: sha256 / manifestHash / hash value), 1 in test/18 (a TanStack temp file name, not a secret)
  - Stub-log values: 63 distinct `username=` / `secret=` / `password=` / `token=` values of 6+ characters from `.cache/gates/**`, `.cache/gate-env/**`, `.cache/judging/**`, `.cache/wave-j/**`, compared with every added line without printing: 1 hit, a 20-character Android application package id (shape aaa.aaaa.aaaa.aaaaaa) appearing in adb commands in 170, 11, judging_a2_phone and judging_b2_motion_on; not a secret. `.locks/camera-stub.lane2.fixture` now exists (written by the environment agent, mode 0600): its two values compared with every added line: 0 hits. Values from `.locks/*.log`: 0 hits. `.data/pg*.env` not read or printed.
  - Judging notes (11_gate_environment_judging, the four judging reports, 167..175, test/18, judging_brief, judging_slots, fix_brief_wave_j, contract_wave_j, wave_j_p3): the judges' disclosed slips (a fixture user name in a control dump, a sign-in value typed into the username field) are described in words only; the stub fixture user name and secret are not in the diff, and no demo-password copy is in any of them. The one screenshot that showed the user name was deleted by its judge, and no image is committed.
- Tracked-file stability: the hash of `git diff` before staging equals the hash of `git diff HEAD` after staging (524c104d...); working tree against index was 0 lines. The environment agent's note `initialization/12_environment_confirmation.md` did NOT exist when I staged, so it is NOT in this commit; `.locks/` changes by the environment agent are ignored paths.

Slip of mine, disclosed: while locating the demo operator password constant I ran a `sed` redaction that did not mask the value, so it appeared once in my own tool output. It is the published demo password (in README.md and `dataset.ts` in HEAD), it is not written to any file, and I did not repeat it.

Excluded on purpose: nothing was left out other than the ignored paths (.data, .cache, .locks, release, signing, `.tanstack/`) and the not-yet-existing `12_environment_confirmation.md`.
This note is left untracked.
