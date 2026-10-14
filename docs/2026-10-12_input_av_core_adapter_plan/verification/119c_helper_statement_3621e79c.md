---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: security-review
blueprint_row: 119c
type: re-read of the helper after row H5 (two hunks) and the statement for the new hash (condition C-4 of row 119b, decision C101)
narrative_tier: 1
baseline: branch task4/input-av-core-port, head 1fbeada7; the helper, its suite and SHA256SUMS are UNCOMMITTED in the working tree
helper_sha256: 3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914
helper_sha256_reviewed_before: 1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1
helper_statement: MADE for 3621e79c..., with four conditions (section 1)
diff_against_reviewed_file: two hunks, nothing else (section 3)
new_cautions: 3 (1 Medium in the Core, 2 Low), 4 notes
fail_count: 0
status: complete
---

# Row 119c: the statement on the helper of hash 3621e79c

## 1. The statement

**MADE, with conditions**, for `scripts/host/netalias/dems-core-netalias`, SHA-256
`3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914`:

> S13-08 to S13-10 are closed in the helper as delivered: **closed in code**. S13-08, all nine bounds, and S13-09 as a form are closed in the three delivered files. S13-10 (b) and (c) are closed in the Core (as rated by row 119; not re-read for their own sake here). S13-10 (a) is not closed by any code and cannot be: it is closed only when `9A/H-06` passes on the host.

It replaces the statement of row 119b, which was made for `1e758a24...c7d015b1` and holds for that file only.

| # | Condition | Who closes it | State today |
|---|---|---|---|
| C-1 | **S13-10 (a) remains for the host.** No removal timer is built; the address ends by its kernel lifetime alone (`add:750-755`, unchanged by row H5). Until `9A/H-06` has passed, the temporary-address function is not used on an installation. If it fails, the helper changes, the hash moves, this statement is void, and the mark logic changes with it (R119b-02 stands as written) | the user's host run | open, by its nature |
| C-2 | **The statement is about code read and run on doubles.** What the installed helper does under the service manager is shown only by `HI-01` to `HI-08`, `9A/H-05`, `9A/H-25`, with the additions of section 8. A failed criterion reopens the bound it names | the user's host run | open, by its nature |
| C-3 | **The procedure prints THIS hash before the user installs.** | rows 127 / 125 for the sentences left | **MET for the hash**: `SHA256SUMS:1`, chapter 4 `:179`, `:213`, `:532` (64 digits), chapter 1 `:309` and chapter 2 `:361` ("begins `3621e79c`"). No line of the three chapters prints an older hash as the current one. Left over, on the safe side: chapter 4 `:19`, `:36` still say the statement "is still to be made" and `:166`, `:586` name record 119b and decision C101 (R119c-03) |
| C-4 | **One hash.** Any change of the helper, the removal of the dead function of section 6 included, needs a re-read of the changed lines by this agent type | the controller | stands |

**Not conditions, and why.** R119c-01 is a finding in the Core, not in the helper: the helper is the enforcement boundary and its answer is now true. R119c-02 ends in a state row 119b already rated safe. The dead function changes no behaviour.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | The statement of row 119b, for the helper as changed by row H5: finding F-1 of review 120 (`delete`) and caution R119b-01 (`add`) |
| **Why** | Condition C-4 of decision C101; chapter 4 `:19` holds the installation back until the statement exists for the new hash |
| **Who** | security-review, read-only on source. Subjects: row H5 (the change), row H4 (the suite), the user who installs |
| **When** | 2026-10-14 09:48 WIB, after rows H4 and H5, before any hardware run |
| **Where** | `/Users/gsp-budi/Documents/DEMS`, working tree. `HP` = the helper at the hash above; `HT` = `scripts/host/netalias/test_dems_core_netalias.py`; `CS/` = `apps/core-server/src/` |
| **How** | The reviewed file taken from commit 1fbeada7 (`git show`), hashed, and compared with the working file by `diff`. The helper read in full (830 lines), both unit files, `CS/capture/host-alias/journal.ts` in full, `lifecycle.ts:170-431`, `protocol.ts:1-110`, the effect table of `caller.ts`, the tests of the two hunks and of five bounds, five mutant copies of row H5 against the delivered file, all fifteen mutant logs' result lines. Three checks run (section 9) |

**Limits.** Nothing is proven on Linux or under systemd. I planted no mutant myself: the mutants are row H5's and row H4's, read as copies and logs. The Core's suites were not run. Statements about the service manager and the kernel that rest on my knowledge are marked **(hypothesis)**.

## 2. The hash and condition C-3

| Check | Result |
|---|---|
| `shasum -a 256 scripts/host/netalias/dems-core-netalias`, before and after the suite | `3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914` both times |
| `shasum -a 256 -c SHA256SUMS` in the folder | three times `OK`; the unit files are `8623c1cd...ffdbcb` and `7e40f25e...38dd60a`, as in rows 119 and 119b |
| Chapter 4 | `:179` (`HI-01.4`), `:213` (`HI-02.6`), `:532` (`HI-10.1`): the 64 digits. `:19`, `:36`: the short form, with the sentence that the statement is not yet made |
| Chapters 1 and 2 | `HW-ACCEPTANCE-1-FRAME.md:309`, `HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md:361`: "begins `3621e79c`" |
| Older hashes in `scripts/` | `1e758a24` as "was" in chapter 4 `:19`, `:36`, in `HT:49` and `captured/README.md:7` (the helper row H3 tested: history), and as the canned text of a stand-in in `test_hw_collectors_host.sh:529,542` (not the helper's hash). `62c0b726` only as "before" in chapter 4 `:19` |

C-3 is met. Record `implementation/104_alias_helper.md` is history and is no longer asked.

## 3. The diff against the file I reviewed

`git show 1fbeada7:scripts/host/netalias/dems-core-netalias` hashes to `1e758a24...c7d015b1`: it is byte for byte the file of row 119b. `diff -u` of it against the working file prints **two hunks and nothing else**: 17 lines added, 2 removed. No constant, code, pattern, tool vector, import or unit file differs.

| Hunk | Lines (`HP`) | What it is | Rating |
|---|---|---|---|
| 1, `add` | `:738-749` | four comment lines; `host_state()` a second time; 42, 40, 43 on that read; `refuse_unless_askable` on its flag words. After the verdict `FREE` (`:736`), before `write_mark` (`:751`) | **sound; closes R119b-01 as asked**, residual stated (section 5) |
| 2, `delete` | `:773-777` | the condition of the refusal inside the "mark does not stand" branch: any interface holding the address, in the place of the camera port's `/24` only; a longer comment | **sound in the helper; F-1 closed in the helper's answer**. Its purpose does not reach the Core's audit entry: R119c-01 (section 4.3) |

## 4. Hunk 2: F-1 in `delete`

### 4.1 Does it refuse in exactly the right cases

`delete` is: no mark, 45 (`:767`); one read of the host (`:769`); every mark that does not stand is dropped (`:770`, `standing_marks:684`); then either the removal (`:781`) or the changed branch.

| Case | What the helper does now | Right |
|---|---|---|
| the address on another interface, the mark not standing (written for another port, stale, or the address not on the camera port as `/24`) | the mark is dropped; 45 `NOT_MARKED`; no tool beyond the two reads | yes |
| the address on another interface, no mark at all | 45 at `:767`, before the host is read | yes, as before |
| a standing mark for the camera port (the address there as `/24`, a lifetime no longer than asked, the mark young) | `ip addr del <address>/24 dev <camera port>`; `0 OK`; the mark dropped. Also when ANOTHER interface holds the same address besides: the helper removes its own and says so; the other one was never its own (both reads of `add` refuse 42 while any interface holds the address) | yes |
| after the interface file changed (the mark names the old port) | `mark_stands:673` is false, the mark is dropped, the address is still on the old port: 45. A second `del`: 45 at `:767`. After the kernel's lifetime: 45 still (no mark) | yes: never `0 OK` for an address the host holds |
| the address on the camera port with another prefix (`/32`, `/16`) | 45 (before: `0 OK note=already-absent`) | yes: it is there, and it is not the helper's |
| on no interface | `0 OK note=already-absent`, as before | yes |

Held by `HT:1092` (7 rows by 2 ages by 2 clocks, and a control: another address of the same `/24` on the office port is not the address asked) and `HT:1128` (the helper itself adds on eth1, the file then names eth2, `del` twice, with a control). Read against the mutant copies: the condition as before row H5 is red in 28 + 1 results; "always refused" is red in three tests (8 results).

### 4.2 Can it now refuse a removal the Core needs

**No.** The changed line sits inside the branch `quad not in standing_marks(...)`. In that branch the old file never started `ip addr del` either: it answered 45 or `0 OK` and returned. Every path that reaches the removal vector (`:781`) is untouched. So no removal that ran for hash `1e758a24` is refused for `3621e79c`; what changed is the ANSWER in the cases of 4.1, from `0 OK` to 45.

The kernel lifetime is untouched: the add vector still carries `valid_lft` and `preferred_lft` (`:753`, held by `HT:958`). In the file-changed case the address on the old port keeps the lifetime it was added with and ends by it, at most 480 minutes (hypothesis H-S, condition C-1).

### 4.3 What the Core does with `NOT_MARKED` on a removal

| Step | Where | What happens |
|---|---|---|
| the answer is judged | `caller.ts:404`, `:216` | 45 is a refusal with effect `NOT_DONE` |
| the removal is judged | `lifecycle.ts:281`, `journal.ts:225` | `gone` is true for `OK` AND for `NOT_MARKED` ("nothing of ours is there", `journal.ts:13`, `:143`) |
| a removal WITH a row | `journal.ts:226-229` | the row is CLOSED with the reason the removal was asked with (`EXPIRED`, `MANUAL`, `JOB_DONE`, `SHUTDOWN`, `BOOT_SWEEP`; `ADD_UNCONFIRMED` only on the path after an add of unknown effect, `lifecycle.ts:352`), and the entry `HOST_ALIAS_REMOVED`, "Alias address removed", is written |
| a removal WITHOUT a row (boot sweep) | `journal.ts:231-240` | `HOST_ALIAS_REMOVE_FAILED`, severity INFO, "No alias address of the Core was there", `failureReason: HELPER_NOT_MARKED` |
| afterwards | `lifecycle.ts:300-303` | no retry is armed, the timer is disarmed; the next `add` is not blocked |

Two consequences.

1. **The Core is never stuck.** A `NOT_MARKED` cannot leave a row open, cannot arm the retry chain and cannot hold back a later `add`. The fear named in the brief (a Core that can never take an alias down) does not arise from this hunk.
2. **F-1's purpose is met in the helper and NOT in the Core's record: R119c-01.** F-1 was raised because the Core wrote `HOST_ALIAS_REMOVED` while the address stayed. For a removal with a row the Core writes exactly the same entry for 45 as it did for `0 OK`. What row H5 changed for the record: the helper's own journal line now reads `result=NOT_MARKED code=45` and no longer `result=OK ... note=already-absent`, and a rowless removal is no longer reported as removed. The sentence of record H5 section 2, "The Core closes such a row as `ADD_UNCONFIRMED`", holds only for the path of `lifecycle.ts:352`; ruling F-9 of C114 is about that path.

Why R119c-01 is not a condition of the statement: the statement is about the helper, and the helper now tells the truth with the one code it has for it. The Core cannot tell "never marked" from "marked, and still held elsewhere" by code 45 alone, but it has its own interface table (`aliasAddressesHeld`, `lifecycle.ts:388`). The change belongs in `journal.ts` / `lifecycle.ts`: keep closing the row (it must never block), and when the helper answered 45 for a row whose add was recorded as done, do not write "Alias address removed": write the entry that says the helper holds no mark of it, and a warning when the Core's own table still shows the address on the host. No helper change, no new code, the hash does not move.

## 5. Hunk 1: the second read in `add`

### 5.1 Does it open a new path

**No.** Order as built: first read (`:716`), stale marks dropped (`:719`), 42 / 40 / 41 / 43 (`:720-727`), flag words (`:728`), probe (`:731`), verdict (`:736`), **second read and its five refusals (`:742-749`)**, mark (`:751`), add (`:752`).

| Question | Finding |
|---|---|
| A refusal after the probe and before the mark | leaves no mark and no address: every one of 42, 40, 43, 46, 47, 48, and 50 from `host_state` itself, is raised before `write_mark:751`. Held by `HT:763` (10 rows) and `HT:799` (5 rows), each asserting the vectors end with the second read and `marks() == []`; the mutant "mark written before the second read" is red in both (15 results) |
| The same function, the same vector | `host_state()` is the one reader of row 119b; the vector `ip -json -4 addr show` is the fixed one. No new tool, argument, file or parser |
| "Unknown" on the second read | not listed, listed twice, words not flag words: 48; listing unreadable or `ip` not answering: 50. Nothing is read as "still fine" |
| The first-pass checks, now that a second pass repeats three of them | still held: each first-pass test asserts the vectors are the two reads ONLY (`HT:611`, `:621`, `:655`, `:733`), so a first-pass line removed is red even though the second pass would give the same code |
| The limit (41) | not judged again. The marks folder is written by the helper alone and calls are serialised by the socket unit (`MaxConnections=1`); note N-2 of row 119b stands unchanged |

### 5.2 The codes 42, 40, 43 on the second read

**Right, not a mis-statement.** Each says what the host showed at that read: the address is on an interface (42), its `/24` is on another interface (40), its `/24` is on the camera port (43). The Core reads all three, and 46, 47, 48, 50, as `NOT_DONE` (`caller.ts:216`, `:404`): the row is closed `NOT_ADDED` and `HOST_ALIAS_ADD_FAILED` carries the code. That is true: nothing was added and no mark exists. My own caution worded the change as "and the bound checks of `:720-727` still hold"; driver decision (a) of row H5 is the reading I meant, and is confirmed.

### 5.3 The time-of-check gap that remains

| Window | Size | Rating |
|---|---|---|
| second read to the kernel's add | one small file written and one process started; milliseconds **(hypothesis: not measured on Linux)** | accepted. No read can be the same instant as the act |
| a carrier that goes AND returns inside the probe (about 3 s) | both reads show `LOWER_UP` | Low, accepted for the statement: a physical event inside 3 s and then a second coincidence (a device holding exactly that address), bounded to one private address on the camera port for at most 480 minutes. `carrier_changes` stays a hypothesis until the host shows the file (section 8) |
| end of the probe to the add: a device takes the address | as in row 119b | inherent in any conflict probe |
| a switch port that does not forward yet, a camera still booting | no flag shows it | the procedure sentence of row 119b section 5 |

R119b-01 is closed as far as a helper without a new input can close it. The residual is the second row.

### 5.4 One thing the second read changed that row H5 does not state: R119c-02

Row 119 confirmed the Core's 35 s bound on "the helper's longest path is 28 s (5 + 5 + 5 + 8 + 5) inside the unit's 30 s". With the second read the sum of the bounds on the `add` path is **33 s** (request 5, route 5, first read 5, probe 8, second read 5, add 5), above `RuntimeMaxSec=30` of `dems-core-netalias@.service`.

Followed to its end: to reach the add at all, every earlier tool must have ANSWERED (a tool at its bound is a refusal: 50 or 51). So the case needs four tools each slow and each just inside its bound. Then the service manager ends the instance during `ip addr add` **(hypothesis: the whole control group is signalled)**: the mark is already written (`:751`), the address is or is not on the port, no answer and no journal line of the helper are written. The Core reads a closed connection as effect UNKNOWN and sends a removal at once (`lifecycle.ts:350-352`); a new instance removes the address if it is there, or drops the mark if it is not. That is the case "killed between mark and add" of row 119b section 4.2: safe. With the Core dead too, the kernel lifetime ends it.

So: Low, no bound opened, a stated number that is no longer true. An ordinary add takes about 3 s (the probe's wait) and is nowhere near the bound.

## 6. The dead function `on_camera_interface` (`HP:648`)

**Harmless; not a condition.** One line, pure, no input or output of its own; `grep` finds its definition and no caller (the only other mention in the tree is a comment at `HT:1096`). The file has no `getattr`, `eval`, `exec`, `globals` or import by name (`grep`: no line), so no request can reach a function by its name. Leaving it was the right call for this re-read: removing it would have been a third hunk. It goes with the next change that moves the hash anyway (note N-1).

## 7. The suite as evidence

`Ran 96 tests in 61.563s`, `OK`, on the delivered helper (host clock 5,318 s). Five bounds sampled by reading the test and the mutation named for it:

| Bound | Test (`HT`) | Mutation | Why the test fails on it |
|---|---|---|---|
| 3, another interface's subnet; the limit | `:607`, `:614`, `:623` | the first-pass line `HP:722` removed; `HP:724-725` removed (by reading; no mutant of rows H4 / H5 is named for these lines) | `:611`, `:621` assert the vectors are the two reads only: without `HP:722` the probe and the second read are started. `:629` expects 41; without the limit the first request is served |
| 4, the conflict check always decides | `:710`, `:763`, `:799`, `:830` | rows H5: first flag check removed (15 results), second read removed (17), second flag check removed (9), 42 / 40 / 43 removed singly (2 / 2 / 1), second read moved before the probe (46) | copies and logs read: the mutant copy differs from the delivered file in the named line only; the red tests are the ones the record names |
| 5, marked before the add, bounded lifetime | `:958`, `:1000`, `:1021`, `:763` | row H4: an unanswered add drops its mark (H-2), `O_EXCL` removed (H-4, H-4b); row H5: mark before the second read | `:963` pins the add vector with both lifetimes; `:1013` expects the mark kept; `:797` expects no mark behind a refusal |
| 6, `del` only what was marked | `:1092`, `:1128`, `:1179`, `:1203`, `:1227` | rows H5: the condition as before (29), always refused (8), any address of the `/24` (1), other interfaces only (66); row H4: the age rule removed (46 results in the suite) | copies and logs read for the first two; the age cases state their clock, so they do not depend on this host's uptime |
| 8 and 9, one journal line, fixed codes | `:1627`, `:1604`, `:1598`; and `CS/capture/host-alias/__tests__/caller.test.ts` compares the Core's 41 names with the helper's file | none named by H4 / H5; by reading | `:1630` pins the whole line byte for byte; `:1604` searches answer and journal for the caller's marker |

Bounds 1, 2 and 7 were not sampled; row H4 measured H-5, H-8 and H-8b for 1 and 7.

Two things the suite does not hold (notes, not gaps of a bound): no case has the address on the camera port under a standing mark AND on another interface (the removal must still run; read from the code, section 4.1); the hash pin was not counted in any mutant result, correctly.

## 8. What the host must show

| Check | What it shows for THIS hash |
|---|---|
| `HI-01` | the three hashes in hand equal chapter 4 `:179-181`; the helper's begins `3621e79c` |
| `9A/H-06` (C-1) | unchanged, with `.7a`: after the lifetime with the Core killed the address is gone, `del` answers `0 OK note=already-absent`, the marks folder is empty. Still true after F-1: the address is on no interface |
| `9A/H-25.7`, added | the camera cable pulled DURING the conflict check (inside about 3 s after the request is sent), three times: the answer is `47 INTERFACE_DOWN`, `ip -br -4 addr show` lists no temporary address, the marks folder is empty, the journal line says `code=47`. A run in which the cable left too late and the answer is `0 OK` is not a failure of the helper; it is recorded and removed with `del` |
| `9A/H-25`, added | `cat /sys/class/net/<camera-interface>/carrier_changes` before and after one pull: the file exists and the number rises. This settles the hypothesis of row 119b before any later change relies on it |
| `9A/H-25.4`, added (R119c-02) | the wall time of one ordinary `add`, from the two journal timestamps or `time`: expected about 3 to 4 s; anything near 20 s is reported |
| `9A/H-05` | as before: `MaxConnections=1` serialises (the limit of one alias and the unjudged limit of the second read rest on it); the unit's options do not stop a SECOND `ip -json -4 addr show` inside one call |
| bench only, optional | F-1 on real tools needs a second eligible port and root changing the interface file with an alias up: `del` answers 45, the address stays on the old port and is gone after its lifetime. Not asked on an installation |

## 9. Evidence

| Check | Command (repository root) | Output |
|---|---|---|
| The helper is the hashed one | `shasum -a 256 scripts/host/netalias/dems-core-netalias`, before and after the suite | `3621e79ccebb05d052efa06b9c1c0dd4d5d4e30d08c2f55f39019857cc7e4914` both times |
| The recorded hashes | `shasum -a 256 -c SHA256SUMS` in the folder | three times `OK` |
| The reviewed file | `git show 1fbeada7:scripts/host/netalias/dems-core-netalias \| shasum -a 256` (to a temporary file) | `1e758a2407f862ebfc461768f11c491ff43f3e89fcbf9d9a2da45763c7d015b1` |
| The diff | `diff -u <that file> scripts/host/netalias/dems-core-netalias` | two hunks, `@@ -735,6 +735,18 @@` and `@@ -758,8 +770,11 @@`; nothing else |
| It compiles | `py_compile.compile(..., cfile=<temporary folder>, doraise=True)` | ok; `ls -a` of the folder: 6 entries and `captured`, no byte-code |
| Its own suite, on doubles | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` | `Ran 96 tests in 61.563s`, `OK`, exit 0 |
| Row H5's mutants | `diff` of five copies under `.cache/task4-h5/m/` against the delivered file; the result lines of the fifteen logs | each copy differs in its named line only; 14 logs `FAILED` with the counts record H5 states, `none.log` `OK` |
| No caller of the dead function, no call by name | `grep -n on_camera_interface`; `grep -n "getattr\|eval(\|exec(\|globals()\|__import__"` | the definition and one test comment; no line |
| The unit's bound | `dems-core-netalias@.service` | `RuntimeMaxSec=30`; the Core's `HOST_ALIAS_CALL_BOUND_MS = 35_000` (`CS/host-alias-socket.ts:71`) |

## 10. Cautions of this row, each routed

| Id | Severity | Caution | Change | Row |
|---|---|---|---|---|
| R119c-01 | Medium (F-1's own rating), in the Core; not a condition | A removal WITH a row that the helper answers `45 NOT_MARKED` is recorded as `HOST_ALIAS_REMOVED`, "Alias address removed" (`journal.ts:225-229`). So in the case F-1 names the Core's audit entry is the same as before row H5 while the address stays up to 480 minutes | Section 4.3: the row still closes; the entry says the helper held no mark; a warning when the Core's own interface table still shows the address. Tests in `lifecycle.test.ts`. No helper change | the owner of `journal.ts` / `lifecycle.ts` (follow-up of row 106), after a ruling by the controller, because ruling F-9 of C114 reads the same lines |
| R119c-02 | Low | The time bounds of one `add` now sum to 33 s, above the unit's 30 s; the sentence "28 s inside the unit's 30 s" (row 119, decision 105 D-8) is no longer true. The end state is safe (section 5.4) | Now: the sentence corrected where it is cited; the host reading of section 8. With the next helper change: one deadline for the whole call, checked before the mark | the next helper row (with note N-1); the host reading: rows 125 / 128 |
| R119c-03 | Low, documents | Chapter 4 `:19`, `:36` say the statement is still to be made; `:166`, `:586` name record 119b and C101; `:59` says "already gone from the port" where the helper now means "held by no interface"; record H5 section 2 on `ADD_UNCONFIRMED` (section 4.3); `9A/H-25` lacks the three readings of section 8 | The sentences moved to this record and its decision; the three readings added | rows 127 / 125 (chapters), 128 (collectors) |

Notes, no row asked:

- **N-1.** `on_camera_interface` has no caller: remove it with the next change that moves the hash.
- **N-2.** One test more for `Bound6`: the address under a standing mark on the camera port and also on another interface is removed from the camera port and answered `0 OK`. Tests only; no hash change.
- **N-3.** The second read does not judge the limit of marks again; it rests on the socket unit as before (row 119b N-2). A lock on the marks folder would make both independent of the unit.
- **N-4.** R119b-02, R119b-03 (closed by I-9b: 41 of 41 names) and the notes of row 119b are unchanged by this row.

## 11. Assumptions, gaps, alternatives

- **Assumption (hypothesis):** the service manager signals the whole control group at `RuntimeMaxSec`; the kernel removes an IPv4 address at its `valid_lft`; `carrier_changes` exists on the host. None checked here.
- **Gap:** no mutant was planted by this row; rows H4 and H5 are taken by their copies and logs, of which five copies were compared with the delivered file.
- **Gap:** the Core's handling of `NOT_MARKED` is read from `journal.ts` and `lifecycle.ts`; its tests were not run.
- **Alternative considered: refuse until R119c-01 is built.** Not taken. The finding is in the Core's record, the helper's answer is the true one, and no code of the helper would change. Refusing would hold the host run back for a change that does not move the hash.
- **Alternative considered: ask for a new helper code ("still held elsewhere").** Not taken: it moves the hash and the Core's table for a case the Core can see in its own interface table.
- **Alternative considered: make the removal of the dead function a condition.** Not taken: it changes no behaviour, and a third hunk would cost another hash and another re-read.

## 12. Verification cell of row 119c, checked

| Cell | Result |
|---|---|
| (1) the hash, `SHA256SUMS`, the chapters; C-3 | section 2: `3621e79c...`, C-3 met for the hash |
| (2) the two hunks and what they touch; the Core on `NOT_MARKED`; the kernel lifetime; the codes of the second read; the gap | sections 4, 5 |
| (3) the dead function | section 6: harmless |
| (4) the diff is only the two hunks | section 3: confirmed |
| (5) the suite as evidence, five bounds sampled | section 7 |
| The statement made or refused, with its conditions | section 1: MADE, C-1 to C-4 |

---
*Generated: 2026-10-14 09:48 WIB*
*Last Updated: 2026-10-14 09:48 WIB*
