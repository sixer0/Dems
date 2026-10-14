---
task_id: 2026-10-12_input_av_core_adapter_plan
row: N8b (wave 12, track D)
date: 2026-10-14
agent: coder-execution (agent N8b)
type: implementation record (Tier 2)
status: complete (one request to row N9: a real start must confirm the composed fixture)
decisions_read: C118, C110, U23, U24; row N8 decision D2; test/n4b_helper_rows_run.md part B and section 6; test/mm, mm2, mm3
source_changed: apps/core-server/src/capture/adapters/audio/macos-helper-lines.ts; its test; 8 new fixtures
devices_opened: none. No helper was started. No file under apps/input-av/data/ was read
---

# Row N8b: the reader of the helper's lines against complete starts

## 1. Frame

| | |
|---|---|
| What | Row N8's pure reader withdrew the input's stream statement on every real start: the lines of the block `Stream mapping:` begin with the stream prefix and were taken for a second stream line (`STATED_MORE_THAN_ONCE`). Found by row N4b (`test/n4b_helper_rows_run.md` s6), ruled in decision C118 |
| Why it passed | 33 tests and 20 mutants read lines one at a time or in folds of at most nine lines; the one fold with `Stream mapping:` did not hold the line under it |
| Fix | (1) whole standard-error texts as fixtures; (2) three kinds for a line with the stream prefix, each counted in its own block; (3) each new rule seen RED on a mutant |
| Verified by | the reader's test file, the audio suite, the capture static set, the workspace typecheck (section 6) |
| The double | TEXT. No helper, no device. What a fixture is - recorded on the device, recorded on the pinned build with a generated source, abridged, or composed - is said in its head and in section 2 |

## 2. The fixtures (`__tests__/fixtures/macos-helper-starts/`)

WHOLE TEXTS WERE KEPT. The measurement rows kept the redacted standard error of every capture in `.cache/task4-mm/session.log`, `session2.log`, `session3.log`, and row N4b kept every line of every run in its number files. So five fixtures are whole records; one is abridged; one is composed.

Each file has a head (`FIXTURE`, `BASIS`, `SOURCE`, `CHANGED` ...) and, after the line `--- helper standard error ---`, the lines.

| Fixture | Basis | Source | Lines | What it holds |
|---|---|---|---|---|
| `device-two-outputs-48k-queue-lines` | DEVICE, verbatim, whole | MM2 capture 15 (`session2.log`, 1,368 bytes) | 25 | TWO outputs through `fifo` at 48,000 Hz, the two queue lines in the middle of the run. The product's two output sections word for word, each behind `-t 9` (not in the product's list) |
| `device-one-output-96k` | DEVICE, verbatim, whole | MM capture 6 (`session.log`, 828 bytes) | 14 | ONE output, the device at 96,000 Hz. NOT the product's list of today: the muxer is `f32le`, with `-progress pipe:1` |
| `device-one-output-96k-signal-15` | DEVICE, verbatim, whole | MM capture 15 (`session.log`, 854 bytes) | 15 | ended by signal 15 (status 255), one output, 96,000 Hz; the same launch form as the row above |
| `device-refused-open` | DEVICE, verbatim, whole | MM2 capture 13 (`session2.log`, 193 bytes) | 4 | `audio format is not supported` and the three lines after it (status 251) |
| `device-two-outputs-48k-interleaved` | DEVICE, ABRIDGED | MM3 capture 33 "product_stallS1" (`session3.log`) | 26 | every line is the device's, in its order; the lines of that run's two MEASURING outputs are taken out (named in the head), and the record had already dropped that output's per-packet lines. Kept because it holds two lines of the helper's own threads RUN INTO EACH OTHER |
| `composed-one-output-48k` | **COMPOSED - not a recorded start** | see below | 14 | the product's ONE output through `fifo` at 48,000 Hz |
| `generated-two-outputs-48k` | PINNED BUILD on a generated source, verbatim, whole | N4b `numbers_A_two_sections.json` | 23 | the product's 55-word list with only the four input words replaced. NO DEVICE. The outputs' blocks come as 1, then 0 |
| `generated-two-outputs-signal-15` | PINNED BUILD on a generated source, verbatim, whole | N4b `numbers_A_two_sigterm.json` | 24 | the same list, ended by signal 15 |

**The composed fixture, line by line.** No record holds a whole start of the product's one-output list on the device (rows MM to MM3 ran one output only through `f32le`; row N4b part B did not open the device).

| Lines | Basis |
|---|---|
| 1 to 3 (input header, duration, the input's stream line) | DEVICE, verbatim: MM3 capture 30 |
| 4 to 6 (`Stream mapping:`, the one mapping line, the filter's line) | DEVICE, verbatim: as the device printed them with one output, MM capture 6 |
| 7 to 12 (the block `Output #0, fifo, ...`) | DEVICE, verbatim: MM2 capture 15 |
| 13, 14 (the two closing lines) | THE BUILD'S STANDARD FORM: N4b's one-section run on a generated source, verbatim |
| the ORDER and the number of lines | THE BUILD'S STANDARD FORM: those of N4b's one-section run. That the device prints one `fifo` output in this order is not a record |

**What was changed in every fixture.** (a) Pointers: the measurement records print `0x<ptr>`; the fixtures hold synthetic hexadecimal numbers, one per object (the two queue lines share one, as N4b printed them). The N4b fixtures keep the run's own pointers. (b) Paths: the output paths held the user's home directory (`session*.log`) or `<work>` (N4b); the fixtures hold `/synthetic/run/<name>`. (c) DEVICE NAMES: none of these lines holds one - the launch names the device by index (`none:0`) and at level `info` the helper does not print the name. No name, serial or location id entered the repository; the test holds every quoted text of every fixture line to `none:0`, a generated source or a synthetic path, and refuses `/Users/`, `0x<ptr>`, `<work>`, `<USB`, `.cache`.

## 3. The reader's change

File: `apps/core-server/src/capture/adapters/audio/macos-helper-lines.ts`. Still pure: no import, no process, no clock.

**Three kinds begin with the stream prefix** (`classifyHelperLine`; a cut, over-long or non-printable line is never one of the two new kinds):

| Kind | Form, anchored at both ends | States |
|---|---|---|
| `MAPPING` | `  Stream #0:0 -> #<0-3>:0 (<codec> (native) -> <codec> (native))` | the output index. The codec words do not leave |
| `OUTPUT_STREAM` | `  Stream #<0-3>:0: Audio: <codec>, <rate> Hz, <layout>, <format>, <n> kb/s` - the input's form WITHOUT `, start <value>` | output index, format (`PCM_F32LE_FLT` or `OTHER`), `rateHz`, layout through the same closed table |
| `STREAM` | every other line with the prefix | the input's form (known) or `NOT_THE_FORM` / `CUT`, as before |

and `MAPPING_HEADER`: the line `Stream mapping:`, those fifteen characters.

**Where each counts** (`readHelperLine`; `section` gained the value `MAPPING`):

| Block | Rule |
|---|---|
| `Input #0` (section `INPUT`) | the first line with the prefix is THE INPUT's statement; a second one, or a second header of the launch's index anywhere, withdraws it (row N8's D2, unchanged). An output's form here is `NOT_THE_FORM` |
| `Stream mapping:` (section `MAPPING`) | ends the input's block wherever it comes. Mapping lines are counted (`mappingLines`). Any OTHER line with the prefix here - the input's form, an output's form, a cut or malformed mapping line - withdraws the input's statement |
| `Output #<n>` (section `CLOSED`) | the first line with the prefix is THAT output's statement: known only as the output's form with the block's own `<n>`; anything else makes it unknown; a second one withdraws it. A line here never changes the input's statement. The header's index is read from a WHOLE line only (a cut header, or an index above 3, opens no block) |

**New members of `HelperLinesState`:** `outputs` (`{ output, statement }[]`, in the order stated), `openOutput`, counts `mappingLines`, `mappingLinesOutOfPlace`, `outputHeaders`. `streamLinesOutOfPlace` no longer counts an output's own line. `effect` still speaks of the input's statement only. New constant `HELPER_OUTPUT_INDEX_MAX = 3`; new exported types `HelperKnownStreamStatement`, `HelperOutputStatement`.

**What a complete two-output start now yields** (`device-two-outputs-48k-queue-lines`, the whole state, held by `toEqual`):

```
section  CLOSED
stream   { known: true, format: PCM_F32LE_FLT, rateHz: 48000, layout: NAMED 5.1, 6 channels, MEASURED }
outputs  [ { output: 0, statement: { known: true, PCM_F32LE_FLT, 48000, NAMED mono, 1 channel, BUILD_TABLE } },
           { output: 1, statement: the same } ]
openOutput 1
counts   lines 25, unrecognised 14, mappingLines 2, outputHeaders 2, queueFull 1, queueFlushed 1,
         streamLinesOutOfPlace 0, mappingLinesOutOfPlace 0, inputHeadersOfAnotherIndex 0, openRefused 0, endedOnSignal 0
```

Before this row the same text gave `stream: { known: false, reason: 'STATED_MORE_THAN_ONCE' }` (mutant N1 below restores it: 16 cases RED).

## 4. The existing tests

31 of row N8's 33 cases pass UNEDITED. Two pinned the fault's design and were edited:

| Case | What it pinned | Edit |
|---|---|---|
| "the form holds to the last character and from the first" | two entries of its list - the stream line without its start value, and `OUTPUT_STREAM` - as `STREAM / NOT_THE_FORM`: "an output's line is not read" | the two entries left the list; three lines added: both are `OUTPUT_STREAM` of output 0, and in the input's block the fold still answers `NOT_THE_FORM` |
| "the measured open: header, duration, stream line, output" | `unrecognised: 2, streamLinesOutOfPlace: 1`: the line `Stream mapping:` as noise and the output's line as out of place | the counts as they are now (11 members), and `outputs` |

22 cases added (55 in all): 4 on the kinds, 8 on the blocks, 10 on the whole texts.

## 5. Mutations each new rule was seen RED on

Made in the module with the Edit tool, the test file run, taken back; the module was read back clean before the final run. Four runs.

| # | Mutation | RED in (first failing assertion) |
|---|---|---|
| N1 | THE FAULT: a mapping line is a stream line again | 16 cases; every whole text that states an input ends `STATED_MORE_THAN_ONCE` |
| N2 | the `$` off the mapping form | "a mapping line is that form to its last character" (a line with a trailing space was `MAPPING`) |
| N3 | a line with the prefix in the mapping block is only counted | "a line with the stream prefix in the mapping block ..." (`NONE` for `STREAM_WITHDRAWN`) |
| N4 | an output's line states the output IT names, whatever block is open | "an output is stated by the line of ITS OWN block only" (`[{ output: 1, known }]`) |
| N5 | a second line in an output's block ignored | "a SECOND line with the stream prefix in an output`s block ..." |
| N6 | the cut mark not looked at before the two forms | "a CUT line with the stream prefix is never a mapping line ..." |
| N7 | (a) the `$` off the output's form; (b) ` (default)` admitted before it | (a) the named case AND 13 cases of row N8 - the input's own line became an output's line (run shared with N2, N5, N6, N9, N10; none of the 13 was RED in the same run without it); (b) the named case and "in an output`s block a cut, malformed or input-form line ..." |
| N8 | in an output's block a line that is not the output's form is only counted | "in an output`s block a cut, malformed or input-form line ..." (`[]`) |
| N9 | `Stream mapping:` leaves the section as it is | "`Stream mapping:` ends the block of the input ..." (`INPUT` for `MAPPING`) |
| N10 | the index of an `Output #` line read from a cut line too | "an `Output #` line that was cut ..." (0 for `null`) |
| N11 | an output's form in the input's block taken as the input's statement | "the form holds to the last character ..." (`known: true`) |

Attribution: N2, N5, N6, N9, N10 ran together and N3, N4, N8, N11 ran together; each named case is touched by its own mutant only, except where the table says otherwise (N6 also turns the cut line of N8's case).

## 6. Checks (from `apps/core-server`)

| Check | Command | Result |
|---|---|---|
| the reader's tests, existing cases unedited, after the reader's change | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/audio/__tests__/macos-helper-lines.test.ts` | `Tests  2 failed | 31 passed (33)` - the two of section 4 |
| the reader's tests, final | the same | `Test Files  1 passed (1)` / `Tests  55 passed (55)` |
| the audio suite and the capture static set | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/audio src/capture/__tests__/static.test.ts` | `Test Files  9 passed (9)` / `Tests  366 passed (366)` |
| typecheck | `npx tsc --noEmit` | exit 0, no error line |
| lint of the two files | `npx oxlint <the two files>` | 0 errors; 6 warnings `unicorn(no-useless-spread)`, all in the test file, 3 of them in row N8's lines |

One run each after the last edit; the second and third runs of the test file were after the two failures of my own new cases (a directory order and one closed word).

## 7. Limits, and what stays unproven

- NO WHOLE START OF THE PRODUCT'S OWN LIST ON THE DEVICE is among the fixtures: the nearest are MM2 capture 15 (two outputs, with `-t 9`) and the composed one-output text. Request line to row N9 written: the first real start is fed to the reader before the gate is trusted (hardware package).
- Lines of two threads run into each other were RECORDED on the device between the filter's lines (MM3 capture 33). If that breaks an output's stream line, the reader answers `NOT_THE_FORM` for that output. How often that happens is not measured: 0 of the recorded starts. HYPOTHESIS (the build's source was not read): the input's block is printed before any thread starts and cannot be broken this way.
- The mapping form admits ` (native)` on both sides only, and outputs 0 to 3. A copy or a library codec is another form; the product's list makes neither.
- The stream line of a generated source has no start value, so it reads as an output's form; before the input's header it is counted out of place and states nothing.
- Not changed: the line bound, the layout table, the queue, refusal and ending forms, the statuses.

## 8. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| D1 | The line `Stream mapping:` ENDS the input's block (row N4b's conservative proposal) AND the mapping lines are their own kind | either alone leaves a hole: without the kind, a malformed line in the block would be noise; without the section, a mapping-form line could not be told from a second statement |
| D2 | An unreadable line with the prefix in an output's block makes THAT output unknown and leaves the input's statement | the brief wants the output stated separately; coupling them would let one broken output line refuse the input |
| D3 | The block of an output is tied to the header's index, read by the fold from the first eleven characters of a whole line; the fact `OUTPUT_HEADER` is unchanged | the fact's shape is held by an existing case that did not pin the fault; the path after the index is still not read |
| D4 | `HELPER_OUTPUT_INDEX_MAX = 3` | the product launches 0 and 1; the widest recorded start had four outputs |
| D5 | The layout word `mono` keeps the basis `BUILD_TABLE` | `MEASURED` means a DEVICE stated the word of its input; `mono` is the helper's word for its own output |

## 9. How the files were written

Existing files: `macos-helper-lines.ts`, `file_claims.md` and `file_requests.md` with the Edit tool only. **ONE DEVIATION:** the new test blocks were APPENDED to the existing `macos-helper-lines.test.ts` with a shell here-document (`cat >>`), not with the Edit tool; no existing line was touched by it, and every other change to that file (the head, the two pinned cases, two corrections) was made with the Edit tool. New files (the eight fixtures, this record, `row_n8b.md`) were created whole. Nothing staged, committed, stashed or deleted.

---
*Generated: 2026-10-14 09:27*
*Last Updated: 2026-10-14 09:27*
