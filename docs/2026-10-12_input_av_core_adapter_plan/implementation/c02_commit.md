# c02 commit record (task 4 batch 3, integration pass I-2)

Date: 2026-10-13. Branch: task4/input-av-core-port (verified with `git branch --show-current`).

## Step 1 - status
`git status --short`: 135 entries before staging. Entries outside the expected set: none.
Entries under apps/input-av/, apps/mobile/, apps/capture-worker/src|build, lockfiles, .cache, .claude: 0 (checked by count only; nothing under apps/input-av was read or listed).

## Step 2 - single-file diffs
```
 .gitignore                                                              | 1 +
 docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md | 2 ++
 package.json                                                            | 1 +
 3 files changed, 4 insertions(+)
```
- package.json: one added line, `"test:host-helper": "python3 -I -B scripts/host/netalias/test_dems_core_netalias.py",`
- .gitignore: one added comment line (secret scan usage).
- 03_api_contract.md: two added table rows.
All within the allowed shape; staged.

## Step 3 - staging
`git add` by name with the listed paths only.

## Step 4 - verification
- `git diff --cached --name-only | grep -c '^apps/input-av/'` -> 0
- `git diff --cached --stat | tail -1` -> 141 files changed, 22786 insertions(+), 554 deletions(-)
- Files: 104 code, 37 docs.

## Step 5 - commit
Hash b7ed4c60, message as specified, trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Step 6 - after
```
b7ed4c60 feat: task 4 track D - schema set A, ONVIF session profiles, microphone operations, alias helper, E-11 result (batch 3, integration pass I-2)
7969f0fa feat: task 4 track D - contracts and vocabulary for the production capture adapters (rows 2-160 batch 1-2, integration pass I-1)
2307e9dc docs: task 4 - plan to port the input-av hardware input logic into the Core adapters; design, schema extension, decisions U1-U14, verification, implementation blueprint (160 rows)
```
`git status --short` outside apps/input-av: empty. This record file is uncommitted (expected). No push.
