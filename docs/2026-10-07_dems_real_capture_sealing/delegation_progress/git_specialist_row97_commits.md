# Git specialist note: row 97 hygiene commits

Date: 2026-10-11
Branch: main (local only; no remote, no push, no branch change); base 951c80e
Result: 20 commits, 951c80e..713d83f; 0 stash entries; status clean after the last commit apart from this note.
Trailer on every message (checked, 20 of 20): `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
No rebase, amend, reset, stash or clean. Staging was by path (`git add -- <paths>`), never interactive; the staged set was compared with the group list before every commit.

## Commits (hash, subject, files in the commit)

| Hash | Subject | Files |
|---|---|---|
| 1379cf3 | chore: mobile - one createHandoffMark for the three session hand-offs | 5 |
| 58488c2 | chore: drop the unused EMPTY_TEMPLATE test constant | 1 |
| c946cb5 | fix: error log keeps the entry written after its folder was removed | 2 |
| 85976c9 | docs: devices panel header says the error record carries componentStack | 1 |
| a1fbb61 | test: pg-behaviours - pid() must be defined before the same-backend comparison | 1 |
| d162ba8 | docs: README troubleshooting row for the Start Session permission wait | 1 |
| eb6f763 | test: waitForSheetExit advances the runner clock instead of sleeping | 3 |
| 0f062cf | test: remove 23 per-file jest.setTimeout overrides in the mobile suite | 23 |
| a02e305 | test: SEC35-41 (c) guard reads the live writer; drop the dead seed builders | 2 |
| d6b55f4 | test: rule A-7 compares the two adapter-kind lists directly | 2 |
| a76e7b1 | chore: .gitignore - key material, model weights and media by extension | 1 |
| abc93a5 | test: reset-failures - replace the stale PENDING comment (F-5, closed by F73) | 1 |
| c0be906 | chore: M9-PIN-1 - stale counts corrected in comments and titles | 24 |
| 4b21cd2 | chore: rename five test-support files that carried wave names | 20 |
| 830f891 | chore: remove unused exports and three unused i18n keys added in task 3 | 11 |
| 7101661 | test: say in the title why the env-gated e2e describes are skipped | 3 |
| f48fe86 | chore: asset README notes are written by their generators (R96-1) | 6 |
| 7827313 | test: comment the two load-sensitive tests (ipc, pipeline) | 2 |
| 2c0855c | chore: mobile log.test.ts - readonly T[] instead of ReadonlyArray<T> | 1 |
| 713d83f | docs: task 3 row 97 - hygiene notes 162 and 163, task index, erratum, progress files | 6 |

Files total: 116 (104 tracked changes incl. 5 deletions, 12 untracked; the 5 renames show in git as renames).

## Checks made before the first commit

- `git status --short` (116 paths: 104 tracked changes, 12 untracked), `git diff --stat` (104 files, 903 insertions, 849 deletions). Index was empty; no stash.
- Name guard on all 116 paths (release/, signing/, .data, .cache, .locks, node_modules, .docx, .env, key / certificate / model / media / archive extensions): 0 hits.
- Size guard: no file over 1 MB (so none over 5 MB).
- Secret scan of the whole pending diff (added lines of tracked changes plus the 12 untracked files, 2317 lines), 0 real hits:
  token shapes: none; private-key markers and credentials in URLs: none; `username=` / `secret=` / `password=` / token / api-key with a literal value (two patterns, strict and loose): none; labelled pairing code: none; long hex labelled key / secret / token / signature: none; long hex (24+): 1, the full hash of a5d75ed in the previous checkpoint note (not a secret); `mts_` / `exs_` plus 12 characters: 1 line, the previous checkpoint note quoting its own scan result (fake padded fixture values, as that note says).
- Stub-log values: 33 distinct `username=` / `secret=` values of 6+ characters from `.cache/gates/**` and `.cache/gate-env/**`, compared with every added line without printing: 0 hits. The value list was deleted afterwards. `.locks/camera-stub.lane2.fixture` does not exist. `.data/pg*.env` not read or printed.
- Mixed-file check: the 24 files outside every named group were read as diffs; every changed line is a count (28 / 75 / 92 / ten operations) in a comment or title. F4 files: only `jest.setTimeout` lines, the "Row CF-M1" comments and the trimmed `jest` import.
- `.gitignore`: after staging it, `git ls-files -ci --exclude-standard` printed nothing (script aborts on any output). Run again at the end: 0 lines.

## Merged into another group, and why

- The 409 example import (web `sealed-player.test.tsx`, note 162 section 4 (a)) is NOT a commit of its own. The file also imports the renamed bed (`./real-item-bed`); committed apart, either the rename commit or the 409 commit would leave an import to a file that does not exist. The file is in commit 4b21cd2 whole; its body says so.
- The five renamed support files with their importers (core-server 2, core-web 5, transcriber 2 children + 3 callers) are one commit (4b21cd2, 20 files incl. the web sealed-player).
- `seed.ts` (dead builders removed) is in the SEC35-41 (c) commit with `capture/__tests__/static.test.ts`: the new rule fails while the builders exist and the old rule fails after they go.
- `kinds.ts` (two TODO rewrites of note 162 section 3.4 plus the rule name) is in the A-7 commit; the TODO rewrite and the rule comment are the same hunk.
- The three dated-history lines (`decision.test.ts:111`, `core-api.ts:1058`, `api-registry.test.ts:171`) are back to plain wording in the working tree, so they need no commit of their own: `api-registry.test.ts` is unchanged; `decision.test.ts` and `core-api.ts` are in the M9-PIN-1 commit for their count lines. The erratum (`masterplan/10_test_strategy.md`) is in the final docs commit as the brief said.
- The task README index is in the final docs commit (713d83f), not a separate one.
- Group added beyond the brief's list: `apps/mobile/src/runtime/log.test.ts` (`ReadonlyArray<T>` -> `readonly T[]`, from the last line of note 162 section 4) as its own small commit 2c0855c.
- No "remaining hygiene edits" commit was needed: all 116 paths are in a named commit.
- Commit order: the order of the brief for the 12 groups of note 163, then the groups of note 162. M9-PIN-1, the rename, dead code, skip titles and the R96-1 commits do not depend on each other.

## After the commits

- `git log --oneline -25`: top 20 are the commits above, then 951c80e, a5d75ed, 7b1aded, b05106b, 57b80a9.
- `git status --short`: empty before this note was written.
- `git ls-files -ci --exclude-standard`: 0 lines.
- Typecheck: the root script `npm run typecheck` (= `npm run typecheck --workspaces --if-present`), run ONCE on the final tree: exit code 0, 0 `error TS` lines, 33 s. Not run per commit; nothing was fixed. Not run: lint, unit/db/web/mobile suites (the coder's note 163 section 8 and note 162 section 7 hold their runs).

## Excluded or suspicious

- Nothing was excluded; no file was left out of the 20 commits except this note (untracked on purpose).
- Items for the controller carried from note 163: the `.gitignore` reading ("stop" if a newly ignored `*.pem` counts; with the re-include none of the 14 tracked certificates is ignored, so nothing tracked is ignored); `jest.setTimeout` / fake-timer items and the NOT DONE list in note 163 section 6 are untouched by this work.
- The two transcriber children renamed in 4b21cd2 were never run (real-engine tests); typecheck covers the paths only.
