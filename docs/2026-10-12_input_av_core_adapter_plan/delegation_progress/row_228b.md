# Row 228b - reserved test installation ids; no fixture key below `.data/` (agent K4, track D)

Status: **complete**. Record: `implementation/228b_reserved_ids_and_fixture_hygiene.md`.

- Item 1 DONE: boot check 4b-3, `REAL_PRODUCTION` only, after 4b-2: `CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS`
  (reason `RESERVED_INSTALLATION_ID`) for the closed list `ReservedInstallationId` of `capture/boot/checks.ts`:
  `DEMS-TEST-01`, `DEMS-IR-01`, `DEMS-JKT-07`. The fixture and the test configuration import their id from it.
- `checks.ts`: 6 hunks, 50 insertions, 0 deletions against `3dfea759`; NEW BASELINE `694846fa`. `boot/index.ts`:
  2 added lines; `2d9b9345` (another row changed line 123 in between: `7a2a2e6a` -> `8b6cb6e2` without this row).
- Item 2 DONE: `realBootFixture` gives `dataDir` in the OS temporary root (mkdtemp, 0700) and `programsDir` in
  `.cache/test-row61-programs/`; every maker removes its fixture in a teardown; the end of the test process
  removes what is left.
- Count: `.data/test-row61-*` 322 before, 322 after (22 database suites, the rotation driver); temporary
  directories left: 0; nothing under `.data/` read, written or deleted.
- Files: `src/capture/boot/checks.ts`, `index.ts`, `__tests__/support.ts`, `__tests__/boot.test.ts`, NEW
  `__tests__/reserved-ids.test.ts`, `test/support/config.ts`, and the fixture lines of 13 other suites (listed in
  the record).
- Checks: typecheck exit 0; unit and static 87 files / 1591 passed; database 22 files / 301 passed; row-229 driver
  46 held, 0 differences.
- Driver decisions: `DEMS-JKT-07` reserved; the check after 4b-2; programs in `.cache/`; signal watch in the
  fixture; the attended e2e no longer leaves its folder; four leftovers of the intermediate state removed from
  the temporary root and `.cache/` (none under `.data/`).
- Requests (file_requests.md, none blocking): the key commands refuse a reserved id (K5); the installer note and
  README; the e2e suites and the bench driver not run.
- Edit tool only on every existing file; new files with Write; nothing committed.
