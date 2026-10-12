# Fix wave J, round three, driver J3-W (apps/core-web) - progress

- Status: see the last line.
- Note: `implementation/173_fix_wave_j3_w.md` (the final state of every JW finding, what is proven by test only, the re-drive list).
- Scope kept: `apps/core-web/**` only; no git write; no lane call or restart; no browser; no device.
- Files: listed in note 173, section 7.
- Suite: one whole run 169 of 170 files green (4 tests of live-runtime-startup red, caused by this round, fixed; re-run of that file + the readers' tests green: 14 files / 262 tests). A whole run on the delivered tree is left for the test runner.
- Status: complete (needs the one whole re-run by the test runner).
