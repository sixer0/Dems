---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: coder-execution (row H5, wave 12, track D)
type: helper change - finding F-1 of review 120 and caution R119b-01 of statement 119b (decision C114)
narrative_tier: 2
baseline: branch task4/input-av-core-port, head 1fbeada7
helper_sha256_before: 1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1
helper_sha256_after: 3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914
status: complete - THE HASH MOVED; the reviewer's statement (C101) does not cover the new file
---

# Row H5: the helper's `del` no longer says "already absent" of an address the host holds; the host is read again after the conflict check

`HP` = `scripts/host/netalias/dems-core-netalias` at the NEW hash unless a line says "old".
`HT` = `scripts/host/netalias/test_dems_core_netalias.py`. Nothing was installed, nothing ran as root,
no `ip`, `arping`, `dpkg`, `sudo` or container was started: every program the suite starts is its
recording stand-in. Mutants were planted only in scratch copies of the folder under
`.cache/task4-h5/m/<mutant>/` by `.cache/task4-h5/mutate.py` (it asserts the file it writes is not the
delivered one and that each replaced text occurs exactly once).

## 1. What was changed, why, how it was verified

| | |
|---|---|
| **Changed** | Two hunks of the helper, 17 lines added, 2 removed (`git diff --stat`): one in `delete`, one in `add`. No code, no fixed word, no constant, no tool vector added or changed. 41 codes as before |
| **Why** | F-1 (`verification/120_m10_review.md:81`): `0 OK note=already-absent` for an address still on ANOTHER interface; the Core reads `0 OK` as "gone" and writes `HOST_ALIAS_REMOVED`. R119b-01 (`verification/119b_helper_statement.md:165, :203`): a carrier lost during the roughly 3 s conflict check still gives `FREE` |
| **Verified** | Tests first: the new suite on the OLD helper `Ran 96 tests in 75.710s`, `FAILED (failures=75)` (`.cache/task4-h5/red_before_change.log`); on the new helper `Ran 96 tests in 59.155s`, `OK` (`final_real.log`); 14 mutants, each red (section 4) |
| **Order of work** | the tests and the stand-in's second answer; red; hunk 1; hunk 2; `SHA256SUMS`; green; mutants; the hash lines of the chapters |

## 2. The diff, hunk by hunk

### Hunk 1 - `add`, new lines `HP:738-749` (after the verdict of the conflict check, before `seconds` / `write_mark`)

Old: `verdict != "FREE"` refuses; then the mark, then `ip addr add`.

New, between the verdict and the mark:

1. four comment lines (`HP:738-741`);
2. `addresses, flags = host_state()` (`HP:742`) - the SAME function and the same fixed vector
   `ip -json -4 addr show` as the first read (`HP:716`); no new vector (the static count of
   `test_the_delivered_file_holds_absolute_constants_and_no_way_around_them` is unchanged);
3. on that second read, in the order of the first pass: the address on any interface -> 42
   `ADDRESS_ALREADY_PRESENT` (`HP:743`); its /24 on another interface -> 40 (`HP:745`); its /24 on the
   camera port -> 43 (`HP:747`);
4. `refuse_unless_askable(interface, flags)` (`HP:749`) -> 46 / 47 / 48 by the unchanged function.

A second read that fails answers 50 `HOST_STATE_UNREADABLE` by `host_state` itself. All refusals lie
BEFORE `write_mark`: no mark is written for an address that is not added. The limit of marks (41) is
not judged again (the marks folder is the helper's own; the socket unit serves one call at a time).

### Hunk 2 - `delete`, new lines `HP:773-777` (old `HP:761-762`)

Old: `if on_camera_interface(addresses, interface, quad): raise Refusal("NOT_MARKED")`.
New: `if any(held == quad for _, held, _, _ in addresses): raise Refusal("NOT_MARKED")` - the review's
smallest fix, word for word - and the comment above it says why. A superset of the old condition: the
camera port's /24 is still refused; so is the address on any other interface and on the camera port
with another prefix. "Already absent" is now said only when NO interface holds the address.

Unchanged behaviour to know: the mark that does not stand is dropped by `standing_marks` BEFORE this
line, as before. After the refusal there is no mark; a second `del` answers `NOT_MARKED` at
`HP:767-768`. The helper never answers `0 OK` for that address while the host holds it, and after the
kernel's lifetime it answers `NOT_MARKED` too (no mark). The Core closes such a row as
`ADD_UNCONFIRMED` (ruling F-9 of C114).

## 3. The time-of-check gap that REMAINS (it is not zero)

| Window | Size | What is not seen |
|---|---|---|
| second read -> the kernel's add | from the end of the second `ip` process to the kernel taking `ip addr add`: one small file written and one process started - milliseconds on a host (**hypothesis: not measured on Linux**), bounded above only by the tool bound of 5 s | the carrier lost, an address or a lease gained, in that window |
| inside the conflict check | about 3 s | a carrier that went AND came back before the second read: both reads say `LOWER_UP`. `carrier_changes` is not read - 119b marks it a hypothesis to confirm on the host; not built (driver decision b) |
| end of the check -> add | as before | a device that takes the address after the check: inherent in any conflict probe (119b section 4.4, accepted) |
| what no flag shows | - | a switch port that does not forward yet, a camera still booting (119b section 5; a sentence of the procedure) |

The change narrows R119b-01 from "about 3 s" to the first row. It does not close it.

## 4. The tests and the mutation each was seen RED on

All mutants are of the NEW helper. Classes run per mutant: `TheWork` + `Bound6DelOnlyWhatWasMarked`
(F-1) or `TheWork` + `Bound4ConflictCheck` (R119b-01); the hash pin is in another class and is not
counted. The unmutated scratch copy: `Ran 22 tests`, `OK`. "results" = failing tests or subtests.
Logs: `.cache/task4-h5/m/<mutant>.log`.

### 4.1 F-1 (`Bound6DelOnlyWhatWasMarked`)

| Case the brief names | Test | Mutant | Result |
|---|---|---|---|
| on the camera port, standing mark: removed as today | existing `test_del_of_a_marked_address_runs_one_del` and the control of the new second test | (unchanged path) | green on every F-1 mutant |
| on no interface: already absent as today | existing `test_a_marked_address_that_is_already_gone_...`, `test_a_stale_mark_whose_address_is_gone_...`; NEW control (another address of the same /24 on the office port) | condition made always true | `failures=8` (1 + 6 + the control) |
| | the same control | "any address of that /24" in the place of the address | `failures=1` |
| on ANOTHER interface, no standing mark: `NOT_MARKED` | NEW `test_a_marked_address_the_host_still_holds_elsewhere_is_not_answered_as_already_absent`: 7 rows (office port with a lifetime, without one, not stated; a third port; office /32; camera port /32 and /16) x mark young or stale x 2 clocks | the condition as before row H5 (`on_camera_interface`) | `failures=29`: 28 here + the next test |
| | the same | "other interfaces only" | `failures=66`: 8 here (the camera-port rows) and 58 in six existing tests |
| on another interface after the interface file changed | NEW `test_an_address_left_on_the_port_the_interface_file_named_before_is_not_answered_as_already_absent`: the HELPER adds on eth1, the file then names eth2, `del` twice; control with the file unchanged | the condition as before row H5 | red (1 of the 29): `0 OK note=already-absent` |

This is the case review 120 read from the code and did not run (its "Gap", `:241`): it is now run. On
the OLD helper both new tests are red (28 + 1 results of the 75).

### 4.2 R119b-01 (`Bound4ConflictCheck`, `TheWork`)

The stand-in: `Bench.addresses_later` is what the SECOND and every later `ip -json -4 addr show` of one
call answers (the double's `later`; it counts its own calls of that vector in `calls.jsonl`).

| Test | Holds | Mutant | Result |
|---|---|---|---|
| NEW `test_a_port_that_can_no_longer_be_asked_when_the_conflict_check_ends_gets_no_mark_and_no_address` (10 rows: 47 x3, 46 x2, 48 x4, 50 x1; vectors end with the second read; no mark) | the second read and its flag check | second read removed | `failures=17` (10 here) |
| | | the second read's flag words not judged (the first read's again) | `failures=9` |
| | | the second flag check removed | `failures=9` |
| | the refusal comes BEFORE the mark | the mark written before the second read | `failures=15` (10 + 5) |
| NEW `test_an_address_the_host_gained_while_the_conflict_check_ran_is_judged_before_the_mark` (5 rows) | 42, 40, 43 on the second read | the second read's addresses not judged | `failures=5` |
| | | line 42 / 40 / 43 removed, one at a time | `failures=2` / `2` / `1` |
| `test_add_runs_route_read_address_read_conflict_check_second_address_read_then_add` (renamed; exact vector order) and NEW `test_a_second_listing_that_differs_in_nothing_...` (control: a second answer that differs harmlessly is served; a port down at the FIRST read is never asked) | the order: check, then read, then add | the second read moved in front of the check | `failures=46` |
| | the first flag check stays | the first flag check removed | `failures=15` |

Existing tests whose expected vectors gained the second read (no rule changed): 13 assertions in 12
tests (`READS + [ARPING_VECTOR, REREAD, ADD_VECTOR]`, the umask list 4 -> 5, the descriptor list 4 ->
5, `MARK_WRITE_FAILED` after the second read, the captured-port case).

Suite: 91 tests before, 96 now (5 new, 1 renamed).

## 5. The hash and every place it was updated

| Place | Change |
|---|---|
| `scripts/host/netalias/SHA256SUMS:1` | hand-written file (three `shasum -a 256` lines; no generator in the tree): the helper's line edited; `shasum -a 256 -c SHA256SUMS` three times `OK` |
| `scripts/hardware-acceptance/HW-ACCEPTANCE-4-HELPER-INSTALLATION.md:179` (`HI-01.4`), `:213` (`HI-02.6`), `:532` (`HI-10.1`) | the 64 digits |
| the same file `:19` (revision list), `:36` (Indonesian summary) | the short form; and the sentence that the review's statement was made for `1e758a24` and is STILL TO BE MADE for `3621e79c` - until then `HI-01.1` is not met |
| `HW-ACCEPTANCE-1-FRAME.md:309`, `HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md:361` | "begins `3621e79c`" (one word each) |
| `HT` head | says that `HP:nnn` of earlier rows are lines of the old file and where three of them are now |

Not changed, each with its reason:

- `apps/core-server`: no file holds the hash (grep of the 64 digits and of `1e758a24`: 0 lines). `protocol.ts` unchanged: no code was added.
- `scripts/hardware-acceptance/test_hw_collectors_host.sh:529, :542`: `1e758a24aaaa` is a canned text of a stand-in `sha256sum`, not the helper's hash; no collector hashes the tree's helper in a test.
- `scripts/host/netalias/captured/README.md:7`: names the helper row H3 tested. The parsers are not changed; `captured/` is byte for byte as it was (21 files).
- chapter 4 `:21`, `:166`, `:586` ("the statement is made for the hash of `HI-01.4`"): not mine; a request line.
- records under `docs/`: history.

## 6. Checks

| Check | Command | Result |
|---|---|---|
| The suite on the new helper | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` (monotonic 4,982 s after it) | `Ran 96 tests in 59.155s`, `OK` |
| Compile | `python3 -m py_compile` of the helper, the suite, `make_test_copy.py` (cache under `.cache/task4-h5/pyc`) | 3 of 3 ok |
| The 21 captures | `... test_dems_core_netalias.py CapturedTexts` | `Ran 5 tests in 0.492s`, `OK` |
| Recorded hashes | `shasum -a 256 -c SHA256SUMS` | three times `OK` |
| Collectors, host group (after the chapter edits) | `bash scripts/hardware-acceptance/test_hw_collectors_host.sh` | `RESULT: 637 passed, 0 failed`; shellcheck not installed: skipped |
| Collectors, camera group | `bash scripts/hardware-acceptance/test_hw_collectors_camera.sh` | `RESULT: 535 passed, 0 failed`; shellcheck skipped |
| The Core's table against the helper's codes | `npx vitest run --project unit --maxWorkers=2 src/capture/host-alias/__tests__/caller.test.ts` | `Tests 22 passed (22)` (41 of 41 names) |

One run each. Not run: the Core's typecheck (no file of a workspace was touched); `host-alias-socket.test.ts` (the client is unchanged).

## 7. Driver decisions, for the controller to confirm

a. The second read judges the three address bounds (42, 40, 43) as well as the flag words. The brief
   names 46 / 47 / 48; caution R119b-01 words its change "and the bound checks still hold", and 119b
   section 4.4 counts the lease-on-the-office-port window as closed by the same change. Refusing more,
   with existing codes, is the conservative reading.
b. `carrier_changes` is not read (a hypothesis of 119b, to confirm on the host first).
c. `on_camera_interface` (`HP:648`) has no caller any more and was LEFT: neither finding asks for its
   removal, and the reviewer re-reads two hunks. Removing it moves the hash again.
d. The header comment of the helper (its nine points) is unchanged; the two new behaviours are stated
   in comments at their lines.
e. Chapters 1 and 2 of the hardware package: one word each, under the brief's "every place in the tree".

## 8. Unproven

- Anything on Linux, with real tools, under the service manager (`9A/H-05`, `H-06`, `H-25`).
- That two `ip -json -4 addr show` inside one call cost what one did on the host (the bound per tool is 5 s).
- The size of the remaining window (section 3) on a host.
- The reviewer's statement for `3621e79c...7e4914`: NOT MADE. Condition C-4 of C101 binds.

---
*Generated: 2026-10-14*
