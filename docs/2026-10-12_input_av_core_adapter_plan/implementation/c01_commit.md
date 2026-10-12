# c01 commit record

Branch check: `git branch --show-current` -> `task4/input-av-core-port`

## Step 1 - git status --short (before staging)
36 modified + untracked entries. All under apps/core-server, apps/core-web, packages/shared, scripts/host, docs/2026-10-12_input_av_core_adapter_plan. Nothing under apps/input-av, apps/mobile, apps/capture-worker, no lockfile, no .claude. Nothing left unstaged.

## Step 2 - staging
`git add apps/core-server apps/core-web packages/shared scripts/host docs/2026-10-12_input_av_core_adapter_plan`

## Step 3 - verification
- `git diff --cached --name-only | grep -c '^apps/input-av/'` -> 0
- `git diff --cached --stat | tail -1` -> 74 files changed, 4900 insertions(+), 130 deletions(-)
- Code files: 33 (apps/core-server 15, apps/core-web 4, packages/shared 13, scripts/host 1); docs files: 41

## Step 4 - commit
Hash: 7969f0fa
Subject: feat: task 4 track D - contracts and vocabulary for the production capture adapters (rows 2-160 batch 1-2, integration pass I-1)
Trailer used: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the session attribution rule; the request text named Opus 5.5).

## Step 5
`git log --oneline -2`:
- 7969f0fa feat: task 4 track D - contracts and vocabulary ... (rows 2-160 batch 1-2, integration pass I-1)
- 2307e9dc docs: task 4 - plan to port the input-av hardware input logic ...

`git status --short` after commit: clean (this record file excepted, written afterwards, uncommitted as expected). No push.
