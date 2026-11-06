# Row D2 - the honest alias removal reasons (C74 D-2 / D-3, C83)

Status: **complete** (agent D2, database-specialist, 2026-10-13). Record: `implementation/d2_alias_removal_reasons.md`.

- Words: `SHUTDOWN`, `NOT_ADDED` - decision C74's; the design names none (`masterplan/03_db_schema_extension.md:293` holds four members; `01_specs.md` and S13-10 name no removal reason).
- Migration set 13: `0026_alias_removal_reasons` (generated), `0027_alias_removal_reasons_privileges` (hand-written, the version step only). Next free number: 0028.
- Schema version 11 -> 12, contract revision `dbc-12` -> `dbc-13`; 26 -> 28 migration files; no count of tables, columns or constraints moves; no stored row rewritten.
- Pins moved `[11, 'dbc-12']` -> `[12, 'dbc-13']` in 18 files (list with file:line in the record, section 4). NEW PIN for tests of rows in flight (111, 106c, 191c, 146c, 226c): `toEqual([12, 'dbc-13'])`, or the constants of `apps/core-server/src/db/schema/meta.ts`.
- Call sites: `capture/host-alias/lifecycle.ts:415` (shutdown -> `SHUTDOWN`), `journal.ts:141` (`NEVER_ADDED_CLOSES_AS` -> `NOT_ADDED`); the set's copies in `store.ts:28` and `core/audit-details.ts:204`.
- Tests re-stated: `host-alias/__tests__/lifecycle.test.ts:299`, `:443-447`; `lifecycle.db.test.ts:178`; `src/__tests__/capture-composition.db.test.ts:757-758` (not proven by a run, see reds).
- `packages/shared`: not touched (the reason is not mirrored there); `openapi.json` not regenerated.
- Checks: drift probe `No schema changes`; `test/db` 20 files / 898 passed; batch A 11 files / 175 passed; typecheck clean; lint 0.
- Reds, none of this step: (1) 11 cases in `fence.db.test.ts` and `capture-composition.db.test.ts` - a production boot refused `CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS` (owner: the row of `capture/boot/checks.ts` / `reserved-ids.test.ts`); (2) acceptance `contract.test.ts` 1 case - `getCameraNetworkJob ... expected 404 to be 200` (row 111, in flight). Acceptance pair otherwise 82 passed.
- Driver decisions to confirm: the "contract document's line" is the composer's `source` text; the one-line edit of `core/audit-details.ts`; the two-line edit of `capture-composition.db.test.ts`; the reworded comment of `0027` (static rule F53).
- Driver note: `JOB_DONE` is still written for a removal after an add of unknown effect (`lifecycle.ts:345`) and for a timer that fires early (`lifecycle.ts:259`) - outside this brief.
- Requests: one information line in `file_requests.md` (migration numbers, the new pair).
- Edit tool only for existing files: kept. Nothing committed or staged. No `db:migrate` on any database; PostgreSQL not started, stopped or reset.
