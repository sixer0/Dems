# Row P1 - the platforms of a production Core; the unasked host profile as a fact of the evidence

Status: **complete** (driver, 2026-10-13). Record: `implementation/p1_production_platforms.md`.

| Part | Result |
|---|---|
| (1) platforms | done. Check 4d-2: REAL_PRODUCTION on a platform other than `linux` / `darwin` is refused by `CAPTURE_HOST_PLATFORM_NOT_SUPPORTED`, reason `PLATFORM_NOT_LINUX_OR_DARWIN`. `linux` asks the whole profile; `darwin` keeps the warning. No member, no door added to `provideHost` |
| (2a) audit | done. A production boot's `SYSTEM_BOOT` entry states `hostPlatform` (`linux`, `darwin`, null) and `hostProfile` (`WILL_BE_ASKED`, `WILL_NOT_BE_ASKED`, `PLATFORM_NOT_SUPPORTED`). Written before the checks run: what the platform means, never that a check passed. REAL_DEVELOPMENT: neither |
| (2b) manifest | done. Optional signed member `hostProfileNotAsked: { platform: 'darwin' }` (field 133). Absent on Linux and in development; byte identity proven (two fixtures, manifest and signature `cmp` identical before / after) |

`checks.ts` `694846fa` -> `dfb1a117` (7 hunks: 60 lines added, the last return replaced). `boot/index.ts` `2d9b9345` -> `5a264525`. New baseline: these two.

Checks: Core unit `88 files / 1729 passed`; shared `105 files / 2884 passed`; Core database - every case of this row passes, `0 remain`; typecheck 0 in six workspaces.

Red seen, not this row's: the pin "schema version 12, contract dbc-13" now answers 13 / `dbc-14` in `fence.db.test.ts:170`, `production-key-proof.db.test.ts:243`, `last-resort.db.test.ts:135`, `stt-states.db.test.ts:115`.

Requests: four lines `row P1` in `file_requests.md` (the document row: what a Mac does not check; the schema pins; the member is not shown in a verdict; Linux unproven on hardware).

Driver decisions D-1 to D-5 in the record, section 8 - D-1 (`test/support/capture-host.ts`: the test host's platform word is `darwin`) and D-2 (`sealing-host/session-reader.ts`, `index.ts`) are edits outside the row's ownership list.

Edit-only rule kept; `openapi.json` not regenerated (no contract schema changed).
