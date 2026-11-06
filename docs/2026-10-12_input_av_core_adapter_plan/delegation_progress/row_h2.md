# Row H2 - alias helper: R119-01, R119-02 (agent H2, 2026-10-13)

Status: **complete on doubles; unproven on Linux.** Record: `implementation/h2_helper_r119_fixes.md`.

- **R119-01 done.** `add` no longer reads exit 0 of `arping -D` as "free": the program must be the packaged one (`/usr/bin/arping` of `iputils-arping`, by the package manager's file list and checksum, nothing started), the camera port must be askable (flag words of the existing `ip -json -4 addr show`), and the tool's whole printed result must agree with its exit status. Unknown refuses.
- **R119-02 done, residual stated.** A mark stands only inside its recorded lifetime (monotonic clock, 60 s grace) and while the kernel lists the address with a lifetime no longer than asked; every `add` and every `del` of a marked address drops the others. Residual: the file sits in the folder until the next call; nothing acts on it.
- New codes: `38 CONFLICT_TOOL_NOT_EXPECTED`, `46 INTERFACE_NOT_ARPABLE`, `47 INTERFACE_DOWN`, `48 INTERFACE_STATE_UNKNOWN`, `55 CONFLICT_RESULT_UNKNOWN`. The 36 existing pairs are unchanged.
- Changed: `scripts/host/netalias/dems-core-netalias`, `test_dems_core_netalias.py`, `make_test_copy.py` (one constant), `SHA256SUMS` (one line).
- Checks: suite `Ran 75 tests in 51.246s` `OK` (second run; the first found one defect of the new reading, fixed); `py_compile` exit 0; helper SHA-256 `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1`.
- Not mine, seen: `node --test scripts/pg/static.test.mjs` fails on entries naming `scripts/hardware-acceptance/test_hw_collectors_*.sh`.
- Requests: three lines in `file_requests.md` (the Core's code table; the host profile HOST-18; the new hash and the host captures).
- Unproven: the text forms of iputils `arping`, of `ip -json` (`flags`, `valid_life_time`) and of the two package records are recollection; each fails closed (`9A/H-25`, `H-05`, `H-06`).
- Edit tool only on existing files. No `sudo`, no network command, nothing installed.
