---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: test-expert (row H4, wave 12, track D)
type: test strengthening - the alias helper's suite (finding B-1, F-2 and section 6 of review 120; decision C114)
narrative_tier: 2
baseline: branch task4/input-av-core-port, head 1fbeada7
helper_sha256_at_start: 1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1
helper_sha256_at_end: 1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1
status: complete (two of the eleven survivors are left as they are, each with its measured reason: section 5)
---

# Row H4: the helper's suite holds its rules

`HP` = `scripts/host/netalias/dems-core-netalias` (line numbers at the hash above). `HT` =
`scripts/host/netalias/test_dems_core_netalias.py`. Every mutant was planted in a SCRATCH COPY of the
folder under `.cache/task4-h4/m/<suite>__<mutant>/` by `.cache/task4-h4/mutate.py` (it asserts the
copy is not the delivered file and that each replaced text occurs exactly once). The delivered
helper was never written. Every program the suite starts is a stand-in; nothing was installed,
nothing ran as root, no `ip`, `arping`, `dpkg`, `sudo` or container.

## 1. What was found, why it matters, how it was verified

| | |
|---|---|
| **Found** | (a) The cause of B-1 is one line of the fixture, `Bench.mark`: it wrote the mark's clock field as `int(time.monotonic()) - age` of the TEST HOST. (b) Beyond B-1: even on a host that has been up for hours, two of the three stale-mark tests the review names held nothing of the age rule, and the third held it in one row of three. (c) The seven behaviours of F-2 had no test, as the review measured. (d) The three survivors read by the review are read rightly. (e) No defect of the delivered helper |
| **Why it matters** | R119-02 ("a mark that outlives its address") was closed on `test_a_mark_past_its_lifetime_does_not_remove_an_address_somebody_else_set`. With the age rule deleted (`HP:676`) the old suite failed in ONE row of it at an uptime over 1,861 s and in NONE below that. The statement of row 119b now rests on tests that fail on that deletion at any uptime |
| **How verified** | Old suite and new suite, each on the unmutated copy and on the mutants (sections 3, 4); the whole new suite on the real helper; the cause shown with the old fixture's own numbers (section 2) |
| **Sources** | `verification/120_m10_review.md` B-1, F-2, section 6; `decisions/decisions.md` C114; the logs `.cache/task4-h4/m/*.log`, `run_a.txt`, `run_b.txt`, `final_real.log` |

## 2. B-1: the fixture's clock

**Cause.** The helper reads the age of a mark from `time.monotonic()` (`HP:634` writes it, `HP:675`
reads it); on macOS and Linux that clock starts near zero at boot. `MARK_LINE` (`HP:170`) takes
digits only for the clock field. The old fixture subtracted the age from the TEST HOST's clock: on a
host up for less than the age the field is negative, `read_mark` answers "no mark", and

- the rows that expect the removal to be DONE are red (`NOT_MARKED` instead of `OK`): the two
  failures of B-1 (ages 1,799 and 1,830);
- the rows that expect a REFUSAL are green for a reason that is not the age rule.

Shown without a young host (`.cache/task4-h4/b1_cause.py`: the texts the old fixture would have
written at an uptime of 1,200 s, given to the unmutated copy and to the copy WITHOUT the age rule):

```
== repo__none (the helper as delivered)
stale mark (1200-1861)       mark clock field  -661 -> NOT_MARKED, vectors after the reads: []
inside lifetime (1200-1799)  mark clock field  -599 -> NOT_MARKED
inside grace (1200-1830)     mark clock field  -630 -> NOT_MARKED
== repo__age_rule_removed
(the same three lines, word for word)
```

**This host at my start:** `time.monotonic()` = 2,106 s. The window of B-1 (under 1,861 s) had closed:
the OLD suite on an unmutated scratch copy gave `Ran 80 tests in 42.333s`, `OK` at 2,291 s. The red
of B-1 is the review's measurement (1,148 s and 1,778 s), not repeated here; its cause is shown above.

**Fix (in `HT` only).**

1. The clock of a mark's age is STATED by the test, never read from the host. `bench(clock=...)` /
   `Bench.clock_reads(seconds)`. `Bench.mark(age=...)` with an age and no stated clock FAILS the test
   with its reason; so does a mark older than the stated clock's boot. (`Bench.mark` without an age
   still writes the host's clock of this instant: valid one second after a boot and a year after.)
2. Every age case runs on TWO clocks (`clocks(age)`): the youngest host on which such a mark can exist
   (the clock reads exactly the age; the mark's field is `0`) and a host up for a year (31,536,000 s).
   A case for a host that booted a minute ago (clock 60) is in three tests.
3. HOW the clock is stood in (DRIVER DECISION 1). The helper has no door for a test and none was
   added. When a clock is stated, the same test copy is started as
   `python3 -I -S -B -c STAND_IN '{"clock": N}' <copy> [arguments]`: a few lines replace
   `time.monotonic` in that one process and then execute the copy's text, unchanged, as the main
   program. The copy is not edited (`test_the_test_copy_differs_from_the_delivered_file_in_the_constants_only`
   still holds); the form is the one `CapturedTexts` already uses (executing the copy's text). A bench
   that states nothing starts the copy directly, as before (pinned in
   `test_a_mark_with_an_age_and_no_stated_clock_is_refused_by_the_fixture`).
4. The stated clock STANDS STILL for the call (DRIVER DECISION 2), so a bound is exact to the second:
   a mark of 30 minutes is taken at an age of 1,860 s and refused at 1,861 s.

The review's smaller fix (lifetime 5 minutes, a guard, a `skipUnless` for the 9-hour row) was not
taken: it still needs a host up for six minutes and skips a row on a young one; the brief asks for
values valid on any host.

**The two red tests, green for the right reason.** `test_a_mark_inside_its_lifetime_and_its_grace_still_removes_its_own_address`
now has 11 rows x 2 clocks, among them ages 1,799, 1,830 and 1,860 with the clock at exactly that age.
Green on the real helper; RED on the grace removed (8 results) and on `>` made `>=` (6 results).

**Not proven:** the new suite was not run on a host that had been up for less than 31 minutes (this
Mac was past that when I began; restarting it is not mine to do). What makes it independent of the
uptime is by construction: no case with an age reads the host's clock, and a case that tried would
fail in the fixture.

## 3. The stale-mark tests and the other survivors: mutation, red, green

GREEN in every row = the whole suite on the REAL helper: `Ran 91 tests in 56.454s`, `OK`
(`python3 -I -B scripts/host/netalias/test_dems_core_netalias.py`, monotonic 3,754 s). RED = the whole
suite on the scratch copy with that mutant; the hash pin (`test_the_delivered_files_have_the_recorded_hashes`)
fails on every mutant, as it must, and is NOT counted. "results" = failing tests or subtests.

### 3.1 H-1: the age rule of a mark (`HP:675-677`) - the rule R119-02 was closed on

| Test (`Bound6DelOnlyWhatWasMarked`) | Before (old suite, 2,338 s of uptime) | What changed | Mutant: age rule removed (`HP:676-677` deleted) | Mutant: upper half removed (`if age < 0:`) |
|---|---|---|---|---|
| `test_a_mark_past_its_lifetime_does_not_remove_an_address_somebody_else_set` | 1 row of 3 red; the two rows with an address WITHOUT a lifetime pass (the lifetime rule `HP:681` refuses them by itself); on a host under 1,861 s all 3 pass | 12 rows x 2 clocks; in 10 rows the address has a lifetime NO LONGER than the mark asked, so only the age refuses (minutes 5, 30, 480; ages one second past the bound up to 30 days) | RED, 20 results: answer `OK`, `ip addr del` started | RED, 20 results |
| `test_a_stale_mark_does_not_count_and_does_not_stay_at_the_next_add` | 0 rows red, at ANY uptime: in every row the address was absent or had no lifetime | rows 5 and 6 added (the stale mark's address is on the port again with a short lifetime), all rows x 2 clocks, a control (the same mark at 1,860 s DOES count) | RED, 4 results: `ALIAS_LIMIT_REACHED`, the stale mark stays | RED, 4 results |
| `test_del_of_one_marked_address_drops_every_other_stale_mark` | 0 red, at ANY uptime: the stale marks had no address | a third stale mark whose address is on the port with a short lifetime; x 2 clocks | RED, 2 results: the mark of 192.168.7.250 is left | RED, 2 results |
| NEW `test_the_helpers_own_mark_ends_one_second_after_its_lifetime_and_its_grace` | - | no fixture: the HELPER writes the mark at a stated second (0, 60, a year), minutes 5 / 30 / 480; removal asked at +0, at the bound, at the bound + 1 | RED, 9 results | RED, 9 results |
| NEW `test_a_mark_from_before_this_boot_is_no_mark` | - | the clock reads less than the mark's field; clocks 0, 60, a year | RED, 9 results | green (this half is the other mutant's) |

Whole-suite lines: age rule removed `Ran 91 tests in 70.481s`, `FAILED (failures=46)` (45 behavioural
results in 6 tests); upper half removed `FAILED (failures=36)` (35 in 4 tests). On the OLD suite the
same two mutants: `Ran 80 tests`, `FAILED (failures=3)` and `(failures=2)` - one row of the first
test, and for the full deletion one row of `..._not_what_the_helper_writes_...`.

Further mutants of the same lines, all RED on the new suite and green on the real helper:

| Mutant | Result | Red tests |
|---|---|---|
| `age < 0` removed | `failures=11` | `..._from_before_this_boot_...` x9, `..._not_what_the_helper_writes_...` x1 |
| the grace removed (`age > mark[2] * 60`) | `failures=20` | `..._inside_its_lifetime_and_its_grace_...` x8, `..._helpers_own_mark_...` x9, the control of `..._at_the_next_add` x2 |
| `>` made `>=` | `failures=18` | the same three tests: x6, x9, x2 (the rows ON the bound) |
| the age taken from the wall clock (`HP:675`, `time.time()`) | `failures=65` | 17 tests |
| the lifetime comparison removed (`HP:681`) | `failures=9` | `test_an_address_set_again_by_hand_inside_the_marks_lifetime_is_not_removed` x6, `..._at_the_next_add` x2 |

### 3.2 H-2 to H-8 = the seven behaviours of F-2: one behavioural test each

Before: the seven mutants TOGETHER on the old suite: `Ran 80 tests in 37.520s`, `FAILED (failures=1)`,
the hash pin only (the review's measurement, repeated). After, each mutant alone:

| # | Rule (`HP`) | Mutation | Test that is now RED (class) | How it reaches the line | RED result | The review's named test |
|---|---|---|---|---|---|---|
| H-2 | `:748` an unanswered add keeps its mark | the condition removed: the mark is dropped whatever the tool did | NEW `test_an_add_the_tool_does_not_answer_keeps_its_mark_so_that_del_can_still_remove_the_address` (`Bound5`) | the `ip addr add` stand-in records its call and sleeps 30 s; the helper stops it at its own 5 s bound; then the address is listed and `del` asked | `failures=2`: no mark left | `test_an_add_the_tool_refuses_leaves_no_mark` cannot see it (its tool answers); it is RED on the OPPOSITE mutant (the mark kept after a "no"), `failures=2` |
| H-3 | `:379-380` nothing after the line | the two lines removed | NEW `test_a_second_line_the_kernel_hands_over_after_the_first_is_refused` (`TheFormOfTheCall`) | the connection is handed over ONE BYTE PER READ (`short_reads`), so the read that completes the line holds nothing behind it and the second line is still in the connection; controls: one line, byte by byte, is served | `failures=7`: 6 results, the first line is served | `test_a_second_line_is_refused` holds `:377` (both lines in one read) |
| H-4 | `:630` the mark is created, never opened | `O_EXCL` and `O_NOFOLLOW` removed | NEW `test_a_mark_planted_while_the_conflict_check_runs_is_refused_and_nothing_is_written_through_it` (`Bound5`) | the conflict stand-in, while it "asks", plants an entry under the mark's name: a link to a file, a link to nothing, a file | `failures=4`: 3 results (the linked file written over, the missing one made, the planted text written over) | `test_marks_folder_others_can_write_or_with_a_foreign_entry` holds the folder's look, not the write |
| H-4b | the same line | `O_EXCL` alone removed | the same test | the planted FILE | `failures=2`: 1 result | |
| H-4c | the same line | `O_NOFOLLOW` alone removed | NONE - **equivalent, measured** (`failures=1`, the hash pin) | `O_CREAT` with `O_EXCL` refuses a link by itself; the flag is a second lock on the same door | - | |
| H-5 | `:232` `_read_small` does not follow a link | `O_NOFOLLOW` removed | NEW `test_an_interface_file_changed_into_a_link_after_it_was_looked_at_is_not_read` (`Bound1`), NEW `test_a_mark_changed_into_a_link_after_the_folder_was_read_is_no_mark` (`Bound6`) | the file is plain when `lstat` looks and a link when it is opened (`swap_after_lstat`: the stand-in swaps it right after the n-th look); controls in both | `failures=3`: 2 results (the other interface is used; a forged mark is read and `ip addr del` started) | the two named tests hold the `lstat`, which refuses first |
| H-6 | `:292-293` a group listed twice | the two lines removed (the last line wins) | NEW `test_a_group_or_an_account_that_is_listed_twice_names_nobody` (`TheFormOfTheCall`) | 4 pairs of group lines in both orders | `failures=6`: 5 results, answer `OK` | `test_the_service_user_is_the_one_member_of_the_group_or_nobody` has no file with the group twice |
| H-6b | the same | the two lines made `continue` (the first wins) | the same test | | `failures=6`: 5 results | |
| H-6c | `:301` the account listed twice | `found is not None` removed | the same test | 3 pairs of account lines in both orders | `failures=6`: 5 results. On the old suite: the hash pin only | (F-2's "the account listed twice") |
| H-7 | `:794` `os.umask(0o022)` | removed | NEW `test_the_mode_of_a_mark_and_the_umask_of_a_tool_do_not_come_from_whoever_started_the_helper` (`Bound5`) | the helper is started under umask 0, 077 and 027; each stand-in records ITS umask; the mark's mode is read | `failures=4`: 3 results | `test_the_mark_and_the_lifetime_of_the_shortest_and_the_longest_request` ran under the test's own umask |
| H-8 | `:464` the tool's standard input is nothing | removed (the tool inherits the connection) | `test_a_hostile_environment_changes_nothing` (the review's named test), NEW `test_a_tool_is_handed_neither_the_connection_nor_the_journal` (`Bound7`), and every test that starts a tool | each stand-in records what its descriptors 0 and 2 ARE; `Bench.run` asserts "the null device" on EVERY run; a control shows the stand-in tells a socket | `failures=234`: 50 tests | red itself |
| H-8b | `:466` the tool's standard error | removed (the tool inherits the journal) | the same | | `failures=234`: 50 tests. On the old suite: the hash pin only | |

All seven together on the new suite: `Ran 91 tests in 50.136s`, `FAILED (failures=245)`.

For H-2 to H-7 the test that fails is a new case in the same class, not the test the review names:
those tests reach another line (stated in the last column) and no row of theirs could be made to
reach the mutated one without becoming the new case.

## 4. The three stand-ins that were added, and what each one is

| Stand-in | What it replaces, in ONE process of the test copy | Why it is fair |
|---|---|---|
| `clock` | `time.monotonic()` reads a stated number | the helper's only source of a mark's age; the copy's text is executed unchanged |
| `short_reads` | `os.read` of descriptor 0 gives one byte | a kernel may hand a stream over in any pieces; `HP:379-380` exists for that |
| `swap_after_lstat` | right after the n-th `os.lstat` of one path, that path becomes a link | the look and the opening are two steps; `O_NOFOLLOW` at `HP:232` exists for whoever gets between them (root only, on a real host) |

The tool stand-in (`DOUBLE`) gained: what its descriptors 0 and 2 are, its umask, a `sleep`, and
entries to plant before it answers. Its record of arguments, environment and folder is as before.

## 5. The three survivors the review found by reading: measured

| # | Mutation | Measured | Verdict | Done |
|---|---|---|---|---|
| C-1 | `HELPER_NOT_INSTALLED: 'HELPER_IS_NOT_INSTALLED'` in `capture/host-alias/caller.ts` | in memory (`.cache/task4-h4/vitest.mut.config.mjs`, 1 text replaced): `Tests 17 passed (17)` - **survives, read rightly** | a hole (F-11) | ONE case appended to `modules/capture-config/host-alias/__tests__/service.test.ts`: the four words the service types are read from its text and must be values of the unit's refusal set, read from the unit's file. RED on a scratch copy of the workspace (`.cache/task4-h4/ws`, a text read cannot be reached in memory): `Tests 1 failed \| 17 passed (18)`, `expected [...] to include 'HELPER_NOT_INSTALLED'`. GREEN on the tree: `Tests 18 passed (18)` |
| C-2 | ` ${INSERT_CLOCK_FLOOR}` taken out of the INSERT (`installation-acceptance/store.ts:92`) | in memory, 1 text replaced: `Tests 2 failed \| 25 passed (27)`. The two cases the review names (`:338`, `:488`) stay GREEN - **read rightly**; the two that fail are the word-for-word entry and its planted controls in the SAME file | not a hole, as the review says: the unit cases assert on the file's own store and cannot hold a statement; the statement IS held (measured red) | nothing changed. NOT run: `routes.db.test.ts:475` on a database |
| W-1 | `clearAccount()` removed from `cancel` (`apps/core-web/.../set-ip.tsx:211-214`) | in memory, 1 text replaced: `Tests 1 passed \| 28 skipped (29)` - **survives, read rightly** | at the level of the page the mutant is EQUIVALENT: `onCancel` unmounts the form and the layout effect's cleanup empties both fields | no file written (apps/core-web has one writer in this wave, W5): a line in `file_requests.md` with the two ways (export `SetIpForm` and one case, or say in the comment that the line is a second lock) |

None of the three was misread.

## 6. The 21 captures

`git status --short scripts/host/netalias`: one line, ` M test_dems_core_netalias.py`. `captured/` is
unchanged; its five tests: `Ran 5 tests in 0.552s`, `OK` (`... test_dems_core_netalias.py CapturedTexts`).

## 7. Defects of the delivered helper

**None.** No test that now holds its rule is red on the real file; no expected failure was declared.

Seen and NOT a defect:

- `HP:630`: `O_NOFOLLOW` beside `O_EXCL` changes no behaviour (H-4c). Harmless; no test can hold it.
- After `MARK_WRITE_FAILED` on a planted entry the entry stays in the folder (the helper did not
  write it and does not remove it); a planted link then makes every call answer `STATE_DIR_UNSAFE`.
  Planting needs root.
- `HP:681` compares the kernel's lifetime with the minutes asked, not with the mark's REMAINING time.
  Known and accepted: `verification/119b_helper_statement.md:124`. No row here pins that looseness.

## 8. Checks

| Check | Command | Result |
|---|---|---|
| The helper's hash at the start | `shasum -a 256 scripts/host/netalias/dems-core-netalias` | `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1` |
| The whole suite on the real helper | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` | `Ran 91 tests in 56.454s`, `OK` (80 before; 11 new tests) |
| Compile | `py_compile` of the helper, the suite and `make_test_copy.py`, the cache written under `.cache/task4-h4/` | three times ok |
| The helper's hash at the end; the recorded hashes | the same; `shasum -a 256 -c SHA256SUMS` | the same value; three times `OK` |
| The Core's table against the helper's codes | `vitest run --project unit --maxWorkers=2 src/capture/host-alias/__tests__/caller.test.ts` (it reads the helper's file, `:186`) | passed (22 of the 40 of the pair run) |
| The Core's socket client | `... src/__tests__/host-alias-socket.test.ts`, command sandbox off (a local socket in a temporary folder; inside the sandbox `listen EPERM`) | `Tests 18 passed (18)` |
| The touched Core test | `... src/modules/capture-config/host-alias/__tests__/service.test.ts` | `Tests 18 passed (18)` |
| Typecheck, lint | `npm run typecheck` in `apps/core-server`; `oxlint` on the touched file | exit 0; exit 0 |

One run each; the suite a second time only as the last check after the mutants.

## 9. Driver decisions, for the controller to confirm

1. The clock is stood in by replacing `time.monotonic` in the copy's process, not by the review's
   smaller fix (section 2).
2. The stated clock stands still for a call.
3. `Bench.run` asserts on EVERY run that no tool was handed the connection or the journal.
4. Two stand-ins of the kernel (`short_reads`, `swap_after_lstat`), because no arrangement of files or
   of the tool stand-in reaches `HP:379-380` or `HP:232` without a race.
5. `test_a_mark_that_is_not_what_the_helper_writes_is_no_mark` now writes its texts at the stated
   clock and lists the address with 200 s, so that each row is refused for the one thing its text has
   wrong (before, the texts carried the second 1: on a host up for over 31 minutes also a stale mark).
6. C-1 is held by a text read of the unit's file, not by an import: the folder's own rule lets it
   reach the capture unit through the fence only, and the fence does not carry the set.

## 10. Unproven, and what stays in scratch

- Nothing on Linux or under the service manager (as before: `9A/H-05`, `H-06`, `H-25`).
- The suite on a host up for less than 31 minutes (section 2).
- `.cache/task4-h4/` holds the driver, the logs and the mutated COPIES (`m/`); the copy of the
  workspace used for C-1 (`ws/`) is removed. Nothing there is read by the repository.

---
*Generated: 2026-10-14*
