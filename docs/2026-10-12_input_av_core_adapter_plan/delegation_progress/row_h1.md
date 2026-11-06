---
row: H1
agent: H1
date: 2026-10-13
status: complete
---

# Row H1 - progress

- Task: remove `.data/test-row61-*` fixture folders (decision U21 (1)); only if proven unused.
- Status: complete. Count before 322 directories (0 symbolic links), after 0. About 1596.4 MiB freed.
- Proofs of non-use: lsof 0 (sandbox on and off), ps 0, user instance (ports 4423/5178, `.cache/task4-row232/`) no `test-row61` in its command lines, none modified in the last 60 minutes (0).
- Sources that mention the name: `apps/core-server/src/capture/boot/__tests__/support.ts` (:40 prefix `dems-test-row61-` in the OS-temporary directory; :42 `.cache/test-row61-programs`) and `.../reserved-ids.test.ts` (:246, :404 assert the `.cache` path). None reads or writes `.data/test-row61-*`.
- Rest of `.data/`: 22 other names, `diff` before/after empty. `git status --short` unchanged by this row (`.data/` is ignored).
- Sandbox off for the read-only `lsof` repeat and the `ps` checks only (sandbox refused `ps`); the deletion ran in the sandbox.
- Files written: `implementation/h1_fixture_folders_removed.md` (the full record) and this file. No tracked file or source changed.
