# Git specialist note: wave I checkpoint commit

Date: 2026-10-10
Branch: main (local only, no remote, no push)
Commit: 57b80a94faf3b4341fa0c40e3124e7e3afb1a2c6 (57b80a9), on top of 74fd1f1
Files committed: 200 (11458 insertions, 437 deletions); 0 stash entries; status clean after the commit.

Procedure: as the wave G/H note (git_specialist_wave_h_checkpoint.md). Everything modified or untracked was staged with `git add -A`; ignored paths (.data, .cache, .locks, release) are excluded by .gitignore.

Guards on the staged list (all 0 hits):
- name guard: release/, apps/mobile/signing/, .docx, .data/, .cache/, .locks/, .env, node_modules, key / keystore / certificate / pwfile names, media / model / archive extensions
- staged files larger than 2 MB (so none above 5 MB): none
- token-shaped strings (cloud, git host, chat, JWT, API key shapes) and credentials inside URLs: none
- private-key marker: only the code test apps/core-server/src/evidence-export/__tests__/export.test.ts (lines 271, 272; it asserts the marker is detected, no key present) and older notes that quote the marker words; no key material

Fixture account of the fake camera stub:
- The first staging attempts (twice) were stopped because initialization/06_gate_environment_regate.md carried the stub's fixture account (user name and secret) at lines 88, 89 and 193. The values were a per-start random fixture of the fake camera stub, dead since lane 2's restart.
- The controller redacted the account in that file before the commit (three places); the account was found and redacted before the commit.
- Final scan of the staged tree: zero hits for the two old literal values; the current values of .locks/camera-stub.lane2.fixture (compared without printing) are in no staged file; no other username= / secret= pair with a stub value in docs.
- initialization/07_gate_environment_wave_i.md did not exist at commit time, so it is not in this commit (it stays untracked/unwritten for the next commit and must be scanned the same way).

Excluded on purpose: nothing was left out. Mid-run the earlier unstaging used `git restore --staged .` (index only, working tree untouched).
This note is left untracked so the next commit can include it.
