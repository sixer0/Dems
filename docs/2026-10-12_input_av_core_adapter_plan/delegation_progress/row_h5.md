# Row H5 - the helper: F-1 and R119b-01 (agent H5, wave 12, 2026-10-14)

Status: **complete. THE HELPER'S HASH MOVED.** Record: `implementation/h5_helper_f1_r119b01.md`.

- **Hash.** Before `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1`, after
  `3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914`. The reviewer's statement (C101) covers
  the OLD hash only: a re-read of two hunks and a new statement are needed (request line, blocking for
  handing the helper over).
- **F-1.** `delete`, new lines 773-777: "already absent" only when NO interface holds the address; otherwise
  the existing `NOT_MARKED` (the review's fix, word for word).
- **R119b-01.** `add`, new lines 738-749: the host is read a second time after the conflict check and before
  the mark; refused with the existing 46 / 47 / 48 (and 42 / 40 / 43 on the same read, 50 if it cannot be
  read). No new code, word, constant or tool vector; 41 codes.
- **The gap that remains (not zero):** from the second read to the kernel's add (a file write and a process
  start; bounded only by the 5 s tool bound; not measured on a host), and a carrier that goes and returns
  inside the check (`carrier_changes` not read).
- **Tests first.** New suite on the old helper: 96 tests, 75 failures. On the new helper:
  `Ran 96 tests in 59.155s`, `OK` (91 before; 5 new). 14 mutants on scratch copies under `.cache/task4-h5/m/`,
  every one red (table in the record, section 4).
- **Hash places updated:** `SHA256SUMS` (hand-written, one line); chapter 4 lines 19, 36, 179, 213, 532;
  chapter 1 line 309 and chapter 2 line 361 (one word each). Nothing under `apps/core-server` holds the hash.
- **Checks:** `py_compile` 3 of 3; captures `Ran 5 tests`, `OK`; `shasum -c` three times OK; collectors host
  `637 passed, 0 failed`, camera `535 passed, 0 failed`; the Core's table test `22 passed (22)`.
- **Driver decisions:** five, section 7 of the record (the first: the second read also judges 42 / 40 / 43;
  the third: `on_camera_interface` is left without a caller).
- **Files:** the helper, its suite, `SHA256SUMS`; three chapters of `scripts/hardware-acceptance` (hash words
  only); the two records; one line each in `file_claims.md` and `file_requests.md`. Existing files were
  changed with the Edit tool only.
- **Unproven:** anything on Linux; the new statement.
