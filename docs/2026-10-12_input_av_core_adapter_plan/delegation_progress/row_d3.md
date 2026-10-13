# Row D3 - the further alias removal reason (R119-05 (d), C94 (d))

Status: **complete** (agent D3, database-specialist, 2026-10-13). Record: `implementation/d3_alias_removal_reason_further.md`.

- Word: `ADD_UNCONFIRMED` - the review's (`verification/119_commissioning_security.md:209`). ONE value; the timer case uses the existing member `EXPIRED` (`:210`).
- Seven members: `EXPIRED` (lifetime timer, also on a clock that went back), `MANUAL` (technician), `JOB_DONE` (the end of a job, nothing else now), `BOOT_SWEEP`, `SHUTDOWN`, `NOT_ADDED`, `ADD_UNCONFIRMED` (the removal at once after an add of unknown effect).
- Migration set 14: `0028_alias_removal_reason_unconfirmed` (generated), `0029_alias_removal_reason_unconfirmed_privileges` (hand-written, the version step only). Next free number: 0030.
- Schema version 12 -> 13, contract revision `dbc-13` -> `dbc-14`; 28 -> 30 migration files; no count of tables, columns or constraints moves; no stored row rewritten.
- Pins moved `[12, 'dbc-13']` -> `[13, 'dbc-14']` in 18 files (file:line in the record, section 4). NEW PIN for rows in flight (P1, R1, R2, 79b): `toEqual([13, 'dbc-14'])`, or the constants of `apps/core-server/src/db/schema/meta.ts`.
- Call sites, `capture/host-alias/lifecycle.ts`: `:352` (`ADD_UNCONFIRMED`), `:265` (lifetime timer `EXPIRED`), `:253-268` + `:308` (a retry keeps the reason and actor of the removal it repeats - DRIVER DECISION 1); the set's copies in `store.ts:28` and `core/audit-details.ts:204`.
- Tests re-stated: `host-alias/__tests__/lifecycle.test.ts:356-358`, `:683`, extended `:372-375`, new cases `:253`, `:267`; new PostgreSQL case `lifecycle.db.test.ts:200`; `test/db/set13.db.test.ts` two lines (stops at its own set).
- `packages/shared`: not touched; the reason is still not mirrored (one description sentence, `capture-commissioning.ts:671`); no request line needed.
- Checks: drift probe `No schema changes`; `test/db` 21 files, 929 passed + 1 own red fixed and re-run green (batch A 11 files / 179 passed); database-free 1343 passed, 1 red not mine; batch B 114 passed, 1 red not mine; acceptance pair 77 passed, 6 reds not mine; typecheck: no error in this step's files; lint 0.
- Reds, none of this step: `host-alias/__tests__/caller.test.ts:189` (helper codes 46-48, row H2 / `protocol.ts`); `capture-composition.db.test.ts:912` (scan `endpointCount`, rows 111b / V6); six cases of `test/acceptance/contract.test.ts` (openapi, scan, set-IP, acceptance - the contract step in flight); typecheck errors in `camera-network/__tests__/service.test.ts:286`, `contract.test.ts:1407`, `capture/boot/__tests__/host-checks.test.ts`.
- NOT BUILT (DRIVER DECISION 2): `NOT_MARKED` on that removal closing the row as `NOT_ADDED` - needs the journal's close (`journal.ts`) and a ruling; today such a row closes `ADD_UNCONFIRMED`.
- Requests: one information line in `file_requests.md` (migration numbers, the new pair, the new member).
- Edit tool only for existing files: kept (replace-all of the Edit tool on six pin files, each occurrence checked first). Nothing committed or staged. No `db:migrate` on any database; PostgreSQL not started, stopped or reset.
