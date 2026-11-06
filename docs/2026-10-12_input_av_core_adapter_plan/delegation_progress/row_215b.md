# Row 215b - status: complete

Record: `implementation/215b_connection_file_location.md`.

- FINDING: the command already read `<--data-dir>/pg.env`; the bench session of row 220 had passed it the helper's directory (`.cache/task4-row220/bench-session.mts:166`; `test/220_m11_bench_boot_session.md:55`). C66 (4) describes the session, not a wrong path in the command. For the controller to reword.
- Fix chosen: the FIRST (located as the Core does, from the stated directory: `load-config.ts:95-97`; design B15 `<data dir>/pg.owner.env`, probe 214 line 40 `<data dir>/pg.env`). Added: the file's full path in the summary before the word; the entry must be a regular file, of the caller, private - else `REFUSED (CONNECTION_FILE) <path> could not be used (CONNECTION_FILE_MISSING | _LINK | _NOT_A_FILE | _OWNER | _MODE)` before any prompt.
- Changed: `apps/core-server/cli/operator-set-password-command.ts`, `cli/operator-set.ts` (comment only), `test/cli/operator-set-password.test.ts` (+4 cases; rig uid), `test/cli/operator-set-password.db.test.ts` (+1 case).
- Checks: unit + static `17 passed (17)` files, `218 passed (218)` tests; db `16 passed (16)`, 0 databases left; `tsc --noEmit` exit 0; oxlint exit 0.
- Existing expectations edited: none for the location; rig `uid` 1000 -> the real user, and `invokerUid: 1000` -> that user (forced by the owner check).
- Driver decisions: built although the defect was not in the command; owner check skipped for uid < 0; the directory above the file and the check-then-open window left to row 221.
- No line in `file_requests.md`. Edit-only rule kept for existing files.
