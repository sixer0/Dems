# Git specialist note: wave M checkpoint commit

Date: 2026-10-11
Branch: main (local only, no remote, no push, no branch change)
Commit: a5d75ed (full hash a5d75edb2ff4bcca40190f71b3652ab1d0132ba7), on top of 7b1aded
Files committed: 76 (5557 insertions, 209 deletions); 0 stash entries; status clean right after the commit.

Procedure: as the wave L note (git_specialist_wave_l_checkpoint.md). Everything modified or untracked was staged with `git add -A`; ignored paths (.data, .cache, .locks, release) are excluded by .gitignore. No rebase, amend, reset, stash or clean was used.

Guards on the staged list (all 0 hits):
- name guard: release/, apps/mobile/signing/, .docx, .data/, .cache/, .locks/, .env, node_modules, key / keystore / certificate names, media / model / archive extensions
- staged files larger than 2 MB (so none above 5 MB): none

Secret scan of the whole staged diff (5557 added lines), all 0 real hits:
- token shapes (cloud, git host, chat, JWT, npm, API key shapes, `mts_` / `exs_` followed by 12+ characters): none. `mts_` / `exs_` appear only as the placeholders `mts_<91>` / `exs_<95>` in notes.
- private-key markers, credentials inside URLs: none
- `username=` / `secret=` / `password=` with a value: none
- pairing code (bare 6-digit code labelled as pairing code): none
- long hex runs (24+): one, the full commit hash of 7b1aded in the wave L note (not a secret)
- long base64 runs: only file paths in test tables; no value labelled key / secret / token / signature.
- Notes scanned like the others: initialization/09_gate_environment_wave_l.md, gateway_check 09d, 10e, 12d, 13d, implementation 158..161, test/12_precommit_wave_m.md, delegation_progress/contract_wave_m.md, fix_brief_wave_m.md, coder_execution_fix_wave_m_m.md, git_specialist_wave_l_checkpoint.md.

Fixture account of the fake camera stub:
- `.locks/camera-stub.lane2.fixture` does not exist at commit time, so current values could not be read from it.
- All `username=` / `secret=` values of length 6+ found in files under `.cache/gates/**` and `.cache/gate-env/**` (2220 files, 31 distinct values, never printed) were compared with every added line of the staged diff: 0 hits.
- `.data/pg*.env` was not read or printed.

Environment note 10: docs/.../initialization/10_gate_environment_wave_m.md did not exist at staging or at commit time, so it is NOT in this commit. It stays for the next commit and must be scanned the same way.

Tracked-file stability: after staging and the scans, just before the commit, `git diff` (working tree against index) was 0 lines and no unstaged change existed; status was clean after the commit. (One sanity comparison of the staged name list against the earlier snapshot could not run because of a sandbox error; the 0-line diff covers it.)

Core db note: stated in the commit body exactly as in test/12_precommit_wave_m.md (one failure in integration-d1b.db.test.ts in run 1, read as a timing race, not proven; run 2 green).

Excluded on purpose: nothing was left out.
This note is left untracked so the next commit can include it.
