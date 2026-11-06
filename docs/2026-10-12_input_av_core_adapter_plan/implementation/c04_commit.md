# c04 commit record (batch 6, integration pass I-6)

Date: 2026-10-13. Branch: task4/input-av-core-port (verified with `git branch --show-current`).

## Pre-stage status
- `git status --short`: 223 entries. Every path fell under the allowed list; no path outside it appeared (no apps/input-av/, apps/capture-worker/build/, lockfile, .cache/, .claude/, root package.json, .gitignore, other docs folder).
- 31 entries under scripts/hardware-acceptance/ (collect-h01..h27 except h20, e11b-announce-probe/, hw-collect-lib.sh, record-line.sh, test_hw_collectors_host.sh, test_hw_common.sh): left unstaged, an agent is still writing them.

## Staging
`git add apps/core-server apps/core-web apps/mobile apps/capture-worker/src apps/capture-worker/test apps/capture-worker/test-fixtures apps/capture-worker/Makefile apps/capture-worker/README.md apps/capture-worker/relay-check.sh packages/shared packages/capture-protocol scripts/host docs/2026-10-12_input_av_core_adapter_plan` -> exit 0.

## Verification (staged)
- apps/input-av/ count: 0
- scripts/hardware-acceptance/ count: 0
- apps/capture-worker/build/ count: 0
- stat: 203 files changed, 20271 insertions(+), 786 deletions(-)
- files: 203 total = 140 code + 63 docs

## Commit
Hash: 3b388746 (subject: feat: task 4 track D - relay candidate with hardened RTSP client, unassigned selector slots end to end, microphone operations live, session pairing (batch 6, integration pass I-6)). No push.

`git log --oneline -5`: 3b388746, 6e6707dd, b7ed4c60, 7969f0fa, 2307e9dc.

## Status after commit
Only the 31 untracked entries under scripts/hardware-acceptance/ remain. This record (c04_commit.md) was written after the commit and stays uncommitted until the next commit.
