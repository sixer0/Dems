# Row H4 - the helper's suite holds its rules (agent H4, wave 12, 2026-10-14)

Status: **complete.** Record: `test/h4_helper_suite_holds_its_rules.md`.

- **Helper untouched.** SHA-256 at the start and at the end:
  `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1`. Mutants only on scratch copies
  under `.cache/task4-h4/m/`.
- **B-1, cause.** `Bench.mark` wrote `host clock - age`: negative on a host up for less than the age, which the
  helper reads as no mark. **Fix:** the clock of a mark's age is stated by the test and stood in for the copy's
  process (`STAND_IN`); every age case runs at the youngest possible clock and at a year; an age without a
  stated clock fails in the fixture.
- **Worse than B-1 said:** two of the three stale-mark tests held nothing of the age rule at ANY uptime, the
  third in one row of three. Now red on the rule removed: 20, 4 and 2 results, plus two new tests (9 and 9).
- **Suite on the real helper:** `Ran 91 tests in 56.454s`, `OK` (80 before). The five capture tests: `OK`;
  `captured/` unchanged.
- **Survivors:** the 8 measured ones each have a test that is red on the mutant (H-1 and H-8 in the named
  tests themselves; H-2 to H-7 in a new case of the same class). The 3 read ones were read rightly: C-1
  strengthened (red on a scratch copy, green on the tree); C-2 left (the statement is held by two cases of the
  same file, measured red); W-1 left (equivalent at the page; a request line to the writer of apps/core-web).
- **F-2:** seven behavioural tests, one per line, each seen red; plus the account listed twice and the tool's
  standard error. One equivalent mutant reported: `O_NOFOLLOW` alone at `HP:630`.
- **Defect of the real helper: none.** No expected failure declared.
- **Files:** `scripts/host/netalias/test_dems_core_netalias.py`;
  `apps/core-server/src/modules/capture-config/host-alias/__tests__/service.test.ts` (one case appended; declared
  in `file_claims.md` before writing); the two records; one line in `file_requests.md`.
- **Checks:** `py_compile` ok (helper, suite, build step); `shasum -c SHA256SUMS` three times OK; the Core's
  table test `caller.test.ts` passed, `host-alias-socket.test.ts` 18 passed (sandbox off for the local socket);
  the touched Core test 18 passed; typecheck of core-server exit 0.
- **Driver decisions:** six, section 9 of the record (the first: how the clock is stood in).
- **Unproven:** the suite on a host up for less than 31 minutes (this Mac was at 2,106 s); anything on Linux.
- Edit tool only on existing files. No `sudo`, no network command, no container, nothing installed.
