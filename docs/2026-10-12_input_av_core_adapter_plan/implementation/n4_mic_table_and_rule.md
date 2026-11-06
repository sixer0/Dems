---
task_id: 2026-10-12_input_av_core_adapter_plan
row: N4 (wave 12, track D; work package N4 of masterplan/06_design_macos_microphone.md revision 3, section 10.1)
date: 2026-10-14
agent: coder-execution (N4)
head: 1fbeada7 (nothing committed by this row)
status: built and checked as briefed; NOT CLOSED in the design's sense (the one run of section 4.3.3 was not in this agent's brief)
---

# Row N4 - the macOS production microphone table and static rule SR-15

## 1. What this row is (5W1H)

- WHAT: the argument table of the macOS production microphone path (two templates, the device word, three listing rows) and the static rule that holds it: NAMED AMENDMENT SR-15 of G-R12, final words (verification/08b section 8; decision C110).
- WHY: decisions U23 to U25 and C107 build the bench path of this Mac as it was measured (test/mm3 section 8). C107 found that an option which pads or re-times makes the sample count read "100%" by inventing audio. The table must therefore not be a set of admitted words: SR-15 makes each list a WHOLE TEMPLATE.
- WHERE: `apps/core-server/src/capture/adapters/local/mic-helper-args.ts:438-673` (appended; one import line gained one name), `apps/core-server/src/capture/__tests__/static.test.ts:1436-1848` (a new `describe`, after G-R12's) and `:287-296` (two pins served to row N5), `apps/core-server/src/capture/adapters/local/__tests__/mic-helper-args.test.ts:566-716` (the builder's unit tests, one appended block).
- WHO reads it next: N7 (the seam, the three listing rows), N9 (the adapter, the ONE caller of the two list functions).
- HOW it was verified: section 6 (result lines) and section 5 (130 mutations, each named).
- NOT DONE HERE, by the brief: no device opened; the pinned helper was started once, with `-h muxer=fifo` only (section 4).

## 2. The table

### 2.1 The two templates, as built (verbatim; `<D>` `<S>` `<P>` are the three computed places)

```
push head (11 words)
  -hide_banner -nostdin -nostats -loglevel info -thread_queue_size 1024 -f avfoundation -i <D>
push section (22 words; ONE or TWO, ascending)
  -map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <P>
pre-check (26 words)
  -hide_banner -nostdin -nostats -loglevel info -f avfoundation -i <D> -t 1 -map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -
```

33 words with one section, 55 with two. Equal to design 4.3.2 and to SR-15 (2), (3) word for word; the static test pins all three lists as literal arrays (`static.test.ts:1554-1556`).

| Place | Word | Made by | Refusal |
|---|---|---|---|
| `<D>` | one of 32 words `none:0` .. `none:31` | `macMicDeviceWord(audioIndex: number)` (`:529`): the word is TAKEN from a frozen array written from the numbers 0 to 31; one parameter, a number | not a whole number 0 to 31 (text included: `'0'`, `'default'`, a name): `MacMicArgumentError` / `DEVICE_INDEX` |
| `<S>` | one of the 64 words of SR-4 (2) | the EXISTING `linuxChannelSelection` - no twin: the text `pan=mono` stands once in the file (pinned) | input number not whole 1 to 64: `INPUT_NUMBER`; above the LIVE channel count: the existing `AudioInputBeyondCardError` (`AUDIO_INPUT_BEYOND_CARD`) with the registry id |
| `<P>` | the pipe | the caller's transport path | not `isMicPipeArgument`: `PIPE` |

Further refusals of `macMicPushArguments` (`:583`): no section or more than two (`SECTION_COUNT`), a channel count not whole 1 to 64 (`CHANNEL_COUNT`), the same input twice (`INPUT_REPEATED`), the same pipe twice (`PIPE_REPEATED`). Every list is a frozen ARRAY; no function of the table joins a shell string. The refusal text is fixed and names no value.

### 2.2 The three listing rows (design 2.2 L1 to L3; SR-15 (6))

| Row | Program | Arguments | Function | Bound in the table |
|---|---|---|---|---|
| L1 | `/usr/sbin/ioreg` (literal) | `-r -c IOUSBHostDevice -l -d 2 -a` | `macUsbTreeArguments()` | 5,000 ms |
| L2 | `/usr/sbin/system_profiler` (literal) | `SPAudioDataType -json` | `macSystemAudioArguments()` | 10,000 ms |
| L3 | the configured audio helper (no program of this table) | the EXISTING device-list row of `camera-helper-args.ts`, the same array | `macMicDeviceListArguments()` | 5,000 ms |

`-a` is the PROPERTY-LIST form: the text form is forgeable by a device's product string (review SM-02; C96 (2)). No function of a row has a parameter (`.length` is 0, pinned).

### 2.3 What was NOT changed

The development lists (`QUIET`, `OUTPUT`, `PRECHECK_OUTPUT`, `micPushArguments`, `micPrecheckArguments`) and the Linux lists are untouched: `git diff` of the table file shows 239 added lines and ONE changed line (the import of `camera-helper-args` gained `deviceListArguments`). The macOS literals are their own (design 4.4: not `QUIET`, `PROGRESS`, `OUTPUT`). The existing tests of both tables pass unedited (section 6).

## 3. The static rule: SR-15 as a named amendment

Entry words, as they stand in the capture static list (`static.test.ts:1436-1449`):

> Task 4 row N4 (wave 12). NAMED AMENDMENT SR-15 of rule G-R12 as amended by SR-4 and SR-12, in its FINAL WORDS (verification/08b section 8; decision C110; design masterplan/06 revision 3, sections 4.3.1 and 4.3.2). It is for the production microphone of kind `USB_AUDIO` on `darwin`, in a KIND OF LIST OF ITS OWN - neither a development list nor a Linux list. ADDITIVE: no rule above is changed, no pin above moves, and the lists of this block are counted here alone.

`describe('SR-15 (named amendment of G-R12; decision C110): the macOS production microphone lists are whole templates with three computed places; the forbidden list holds wherever a word stands')` - seven cases:

| # | Case | Holds |
|---|---|---|
| 1 | the two templates, verbatim | the three lists as literal arrays; 11 / 22 / 26; the places of `<D>` `<S>` `<P>`; the table's literals are exactly the template's literal words |
| 2 | EVERY list the table can make | 68,608 lists: 32 device words x (64 one-section + 64 pre-check + 2,016 pairs handed in DESCENDING). Template equality on all; the forbidden list on every one-section and pre-check list and on the pairs of device 0 and 31 |
| 3 | the template rule, line by line | controls for the count, a word, the order, a third section, a selection twice, a pipe twice, descending sections, 14 words at `<D>`, 9 at `<S>`, 6 at `<P>` |
| 4 | the forbidden list | 44 rule lines, their ids PINNED as a written list, 70 controls; every control must be named by ITS OWN line and refused by the template too |
| 5 | SR-15 (1) at the table | the text of `macMicDeviceWord` and of the closed set; the six literal groups; the queue's options named by the table file alone; BEFORE THE CALLER EXISTS: no production source but the table file names a function of the macOS table |
| 6 | SR-15 (6) | the two rows and programs verbatim; program literals named by the table file alone in the whole server; 12 controls |
| 7 | SR-15 (7) | a rule over a start vector `[helper, ...list]` with controls `nice`, `taskpolicy`, a shell. NOT pinned at a caller: there is none yet |

The forbidden list (44 ids; the brief's nine are in it, the rest are design 4.2a and 08b HB-3 / HB-4): `asetpts`, `aresample` (ANY form, so also with `async`), `async` (the option `-async` and the text `async=`), `apad`, `atempo`, `asetrate`, `adelay`, `aloop`, `channelsplit`, `-use_wallclock_as_timestamps`, `-fflags`, `-copyts`, `-itsoffset`, `-re`, `-ss`, `-shortest`, `-t` in a push list, `-t` of the pre-check (another value, or twice), `-progress`, a filter option in another spelling or from a file (`-filter:a`, `-filter_complex`, `-lavfi`, `-/af`, `-/filter:a`, `-filter_script:a`, `-af:0`), a second `-af` in a section, filter text that is not the one selection, `-ch_layout`, `-channels`, `-audio_device_index`, `-video_device_index`, `default` as a device, any `-i` that is not `none:<n>`, a second `-i`, `-drop_pkts_on_overflow` not `1`, `-queue_size` not `32`, `-fifo_format` not `f32le`, `-format_opts` not `flush_packets=1`, the seven further options of the queue (section 4), `-loglevel` not `info`, `-v`, a second log level, a format outside the kind (push: `avfoundation`, `fifo`; pre-check: `avfoundation`, `f32le`).

## 4. The `fifo` option check (the only start of the pinned helper)

Binary: `/Users/gsp-budi/Documents/DEMS/.data/helpers/ffmpeg`, `ffmpeg version 9.0.2`, SHA-256 `c8173e9755795978bce8e104f8d7044fabe7d6d84044aba37d3648c6f4e4e1a8`. Command: `ffmpeg -hide_banner -h muxer=fifo` (prints help, opens nothing; exit 0). Output, whole:

```
Muxer fifo [FIFO queue pseudo-muxer]:
Fifo muxer AVOptions:
  -attempt_recovery  <boolean>    E.......... Attempt recovery in case of failure (default false)
  -drop_pkts_on_overflow <boolean>    E.......... Drop packets on fifo queue overflow not to block encoder (default false)
  -fifo_format       <string>     E.......... Target muxer
  -format_opts       <dictionary> E.......... Options to be passed to underlying muxer
  -max_recovery_attempts <int>        E.......... Maximal number of recovery attempts (from 0 to INT_MAX) (default 0)
  -queue_size        <int>        E.......... Size of fifo queue (from 1 to INT_MAX) (default 60)
  -recovery_wait_streamtime <boolean>    E.......... Use stream time instead of real time while waiting for recovery (default false)
  -recovery_wait_time <duration>   E.......... Waiting time between recovery attempts (default 5)
  -recover_any_error <boolean>    E.......... Attempt recovery regardless of type of the error (default false)
  -restart_with_keyframe <boolean>    E.......... Wait for keyframe when restarting output (default false)
  -timeshift         <duration>   E.......... Delay fifo output (default 0)
```

What it settles: the four option names of the row exist in the pinned build with these spellings and types; the build has ELEVEN options of this output format; the seven beside the four are each a rule line with its own control (08b HB-3), and the eleven are pinned as a list in case 4. Two defaults make the row's literals load-bearing: `-drop_pkts_on_overflow` defaults to FALSE (the blocking form) and `-queue_size` to 60.

What it does NOT settle: the two provisional sentences of SR-15 (the pre-check to standard output; the push list with one section). A help text confirms names, not behaviour. They stay provisional until the run of design 4.3.3 (forms a to d, on a generated source).

## 5. Mutation honesty: each rule and the mutation it was seen RED on

Method: `.cache/task4-n4/mutate.py` (git-ignored, in no commit) writes COPIES of the two test files and of the table with absolute imports, applies ONE mutation to a copy, and runs the copy filtered to this row's blocks. The repository's files are only read. Baselines (no mutation) before and after: green (static 7 passed, unit 10 passed). 130 mutations, each seen red where stated (17 of the 23 table mutations in both files, 6 in the unit tests alone: 5.3); raw result lines in `.cache/task4-n4/out/*.log`.

### 5.1 The 44 forbidden lines (two series, 88 runs, 88 red)

- F-blind (44 runs): the line is replaced by one that finds nothing, ITS ID STAYS in the list - so the id pin stays green and only the line's OWN control can fail. Result for each of the 44: `Tests 1 failed | 6 passed`, the failing assertion the control of that id (example, `async`: `AssertionError: async: ... -af pan=mono|c0=c0,aresample=async=1 ...`).
- F-delete (44 runs): the line is taken away. Each: `Tests 1 failed | 6 passed` (the id pin).

### 5.2 The template rule, the listing rule, the start-vector rule (17 runs, 17 red)

| Rule line | Mutation | Red in |
|---|---|---|
| count (push) | any whole number of sections is a form | case 3 |
| count (pre-check) | the length is not held | case 3 |
| word for word | the line taken away | cases 3, 4 |
| a literal is of its PLACE | a literal is admitted when it is any word of the template | cases 3, 4 |
| `<D>` | any word beginning `none:` | cases 3, 4 |
| `<D>` range | two digits of any value | cases 2, 3 |
| `<S>` | any word beginning with the selection | cases 3, 4 |
| `<S>` range | channels 64 to 69 | case 3 |
| `<P>` | any word | case 3 |
| a selection twice | line taken away | case 3 |
| sections ascend | line taken away | case 3 |
| a pipe twice | line taken away | case 3 |
| the pinned template | `-queue_size 60` in the test's template | 5 cases |
| listing row, count | held by words only (the text form without `-a` passes) | case 6 |
| listing row, words | held by count only | case 6 |
| listing program | a program that is no literal passes | case 6 |
| before the helper | the first word is not looked at | case 7 |

### 5.3 The table itself (23 mutations of a COPY of the table, static and unit both run)

| Mutation of the table | Static | Unit |
|---|---|---|
| `-loglevel warning` in the push head | red (5) | red (2) |
| `-drop_pkts_on_overflow 0` | red (5) | red (3) |
| `-queue_size 60` | red (5) | red (3) |
| a section ends with the development output line (no queue) | red (5) | red (2) |
| the push list carries `-progress pipe:1` | red (5) | red (3) |
| `,aresample=async=1` after the selection | red (5) | red (4) |
| sections in the order handed in | red (1) | red (1) |
| device word written from whatever is handed in | red (1) | red (1) |
| the closed set has 33 words | red (2) | red (2) |
| `-audio_device_index <n> -i default` in the pre-check | red (5) | red (2) |
| selection off by one | red (4) | red (4) |
| pre-check `-t 10` | red (5) | red (2) |
| pre-check `-f null` | red (5) | red (1) |
| USB tree row without `-a` | red (1) | red (1) |
| `SPUSBDataType` | red (1) | red (1) |
| `ioreg` by name | red (1) | red (1) |
| the device-list row names a device | red (1) | red (1) |
| the same input twice is made | green | red (1) |
| the same pipe twice is made | green | red (1) |
| three sections are made | green | red (1) |
| an input above the live channel count is made | green | red (1) |
| a pipe not held to its shape | green | red (1) |
| channel count not held | green | red (1) |

The six "green" static cells are REFUSALS of the builder: the static rule looks at lists the table makes from valid input and at planted lists, so a missing refusal is the unit tests' to see, and each is seen there.

### 5.4 The two pins served to N5 (2 runs, 2 red)

A door text with `child.stderr.pause();` appended: red (`expected [ '.pause(' ] to be null`). A door text with a fourth `timers.after(`: red (`to have a length of 3`).

## 6. Checks (2026-10-14, after the last edit)

| Check | Command (in `apps/core-server`) | Result line |
|---|---|---|
| capture static file | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/static.test.ts` | `Test Files 1 passed (1)`, `Tests 79 passed (79)` |
| whole static set | the same with `test/static`, both adapter static files, `mic-static.test.ts` and every `*static*.test.ts` under `src` | `Test Files 46 passed (46)`, `Tests 794 passed (794)`. Reds not mine: none |
| table unit tests, Linux adapter, development helper (UNEDITED but for my appended block) | `... mic-helper-args.test.ts usb-audio-production.test.ts mic-helper.test.ts` | `Test Files 3 passed (3)`, `Tests 157 passed (157)` |
| typecheck | `npx tsc --noEmit` | exit 0, no line |

First run of the static file: 2 red, both in my own new block (a pin of the bare word `'fifo'`, which `mic-pipe.ts` / `pipe-files.ts` use for a file kind; a pin of `SPAudioDataType`, which N6's reader names as the JSON top member). Both pins were narrowed to the ARGUMENT forms; second run green. No full suite was run.

## 7. Requests

- SERVED: N5's request line (file_requests.md, "row N5 (agent N5; record `implementation/n5_door_stderr_observer.md`)", item 1) - two pins in the G-R8 case of the production door: no `.pause(` in the door; exactly three `timers.after(`. Each with a planted control and a mutation run (5.4). Items 2 and 3 of that line are for other writers.
- WRITTEN, three lines in file_requests.md: (1) to N5, "served"; (2) to N7 / N9: the pin "no production source but the table file names a function of the macOS table" moves with their caller pins, with the signatures of the table; (3) to the controller: the run of 4.3.3 is not made (DD-1).

## 8. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | THE RUN OF 4.3.3 WAS NOT MADE. The design says row N4 does not CLOSE before it; this agent's brief limits the pinned helper to `-h muxer=fifo`. The brief was followed. Row N9 "does not rely on (c) and (d) before it" and depends on "N4 closed" | The brief wins over the design for the agent; the gap is stated, not papered over. A row or the controller has to make that one run (generated six-channel source, no device, forms a to d) |
| DD-2 | The builder ORDERS the sections ascending itself; a descending hand-in is not a refusal | Design 4.2: "the adapter does not know a role". A refusal would fail a start whose PRIMARY is the higher channel. The pipe stays with its input (unit test) |
| DD-3 | The forbidden list is wider than the brief's nine words (44 ids) and `aresample` is refused in ANY form | Design 4.2a ("`aresample` in any form") and 08b SM-08 (2) |
| DD-4 | The bounds of the three listing rows are carried in the table (`MACOS_LISTING_HELPER_TABLE.*.boundMs`) | SR-15 (6) names them with the rows; N7 reads them from one place |
| DD-5 | A pin that N7 / N9 must move: "no production source names a macOS table function" | The caller rule (SM-08 (3)) cannot be pinned before the caller exists; the pin makes its arrival visible |
| DD-6 | SR-15 (7) is a rule over a vector with controls, pinned at no caller | Same reason. NOT claimed: that the product starts the helper this way |
| DD-7 | The unit tests extend `adapters/local/__tests__/mic-helper-args.test.ts` (claimed) | driver rule 7 |
| DD-8 | `SPAudioDataType` is pinned as an ARGUMENT only | N6's reader must name the JSON member |

## 9. What stays unproven

- The two provisional sentences of SR-15 (DD-1).
- That an index other than 0 opens another device (one interface on this Mac; row MM).
- Everything at the caller: once per launch, the retry's listing, the empty environment, the guard (N7, N9).
- "A listing program handed in by a product file" and "a wrapper before the helper" are controls at the CALLER; here they exist only as rule functions over planted input.

## 10. Edit-only statement

Existing files were changed with the Edit tool only (the table file, the two test files, file_claims.md, file_requests.md). No scripted replace, no shell append, no generated rewrite. New files with Write: this record and row_n4.md. The mutation harness wrote only under the git-ignored `.cache/task4-n4/`; its `mut/` copies are removed. Nothing committed, staged or stashed.
