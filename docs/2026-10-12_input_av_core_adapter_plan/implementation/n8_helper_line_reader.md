---
task_id: task4-input-av-core-port
row: N8 (masterplan/06_design_macos_microphone.md revision 3, section 10.1)
date: 2026-10-14
agent: coder-execution (wave 12, agent N8)
status: complete
tier: 2
---

# N8 - the reader of the helper's lines (macOS microphone path)

## 1. What was built

| File | Kind | Content |
|---|---|---|
| `apps/core-server/src/capture/adapters/audio/macos-helper-lines.ts` | NEW | a PURE module: no import, no process, no clock, no file, no log. Lines in, typed facts out |
| `apps/core-server/src/capture/adapters/audio/__tests__/macos-helper-lines.test.ts` | NEW | 33 tests |

No existing code file was edited. `delegation_progress/file_claims.md` got one line (Edit tool).

Exports: `classifyHelperLine(line)` (one line by itself), `startHelperLines(index)` / `readHelperLine(state, line)` (the fold that knows WHERE a stream line counts), `readHelperLayout(word)`, `HELPER_LAYOUT_TABLE`, `HELPER_LINE_MAX_CHARS` (512), `HELPER_DEVICE_INDEX_MAX` (31), `HELPER_CHANNELS_MAX` (64), `HELPER_EXIT_STATUS_OPEN_REFUSED` (251), `HELPER_EXIT_STATUS_AFTER_SIGNAL` (255).

Typed results: `HelperLine` (input: `text`, `cut`), `HelperLineFact`, `HelperStreamStatement`, `HelperStreamFormat`, `HelperLayout`, `HelperLayoutEntry`, `HelperLayoutWord`, `HelperLayoutBasis`, `HelperStreamUnknownReason`, `HelperUnrecognisedReason`, `HelperLinesState`, `HelperInputSection`, `HelperLineEffect`, `HelperLineReading`.

## 2. The forms, each a measured line

| Fact | Form (anchored at both ends, every quantifier bounded) | Measured in |
|---|---|---|
| `INPUT_HEADER { deviceIndex }` | `Input #0, avfoundation, from 'none:<n>':`, n 0 to 31 without a leading zero | MM s2 (`:116`), MM2 s1 (`:41`) |
| `STREAM { statement }` | two spaces, `Stream #0:0: Audio: <codec>, <rate> Hz, <layout>, <format>, <n> kb/s, start <n>.<6 digits>` | `Stream #0:0: Audio: pcm_f32le, 48000 Hz, 5.1, flt, 9216 kb/s, start 398060.445104` (MM2 `:43`); `... 96000 Hz, 5.1, flt, 18432 kb/s, start 396415.197563` (MM `:118`) |
| `OUTPUT_HEADER` | the first eight characters `Output #`; the rest (a path) is not read | design 4.6 row 1 ("before any `Output #` line") |
| `QUEUE_FULL { output: 'NOT_STATED' }` | `[fifo @ 0x<hex>] FIFO queue full` | MM2 `:193`, MM3 `:206` (printed there as `[fifo @ 0x<ptr>] FIFO queue full`) |
| `QUEUE_FLUSHED { output: 'NOT_STATED' }` | `[fifo @ 0x<hex>] FIFO queue flushed` | the same lines |
| `OPEN_REFUSED { statedCause: 'AUDIO_FORMAT_NOT_SUPPORTED' }` | `[in#0 @ 0x<hex>] audio format is not supported` | MM `:132`, `:220`; MM2 `:127`; MM3 `:100` (exit 251) |
| `ENDED_ON_SIGNAL { signal: 15 \| 2 }` | `Exiting normally, received signal 15.` / `2.` | MM `:241-242` (exit 255) |
| `UNRECOGNISED { reason }` | everything else; reason `CUT`, `TOO_LONG`, `NOT_PRINTABLE` or `NO_FORM` | - |

The stream statement: `{ known: true, format: 'PCM_F32LE_FLT' | 'OTHER', rateHz: <whole number>, layout }` or `{ known: false, reason: 'CUT' | 'NOT_THE_FORM' | 'STATED_MORE_THAN_ONCE' }`. The layout: `NAMED { word, channels, basis }`, `COUNT_ONLY { channels }` (exactly `<n> channels`, 1 to 64) or `UNKNOWN`. So the adapter (row N9) can refuse `rateHz !== 48000`, a layout that is UNKNOWN or whose count differs, and a format that is `OTHER`. The gate itself is not in this file.

The queue lines state no output and no amount: they name a pointer. The fact says `output: 'NOT_STATED'`; the amount comes from the worker's counts (decision C110 (5), SM-35 (1)). The pointer is not returned.

The fold: a stream line counts only after the header of the launch's own index and before any `Output #` line. A stream line elsewhere is counted (`streamLinesOutOfPlace`; an output's own stream line is one, which is normal). The state carries `section` (`BEFORE_INPUT`, `INPUT`, `CLOSED`), `stream` and eight counters; no text.

Nothing device-chosen leaves as text (AD-06, SM-12 (3)): a fact holds a kind, whole numbers and words of closed sets. The test parses every reading of a hostile sequence and finds no string outside the closed words.

## 3. The layout table

40 entries, a constant of this one file (`LAYOUT_ROWS`, exported frozen as `HELPER_LAYOUT_TABLE`). Source: the pinned build's own list, run ONCE on 2026-10-14, no device opened, exit 0:

`/Users/gsp-budi/Documents/DEMS/.data/helpers/ffmpeg -hide_banner -layouts`, section "Standard channel layouts", verbatim:

```
NAME           DECOMPOSITION
mono           FC
stereo         FL+FR
2.1            FL+FR+LFE
3.0            FL+FR+FC
3.0(back)      FL+FR+BC
4.0            FL+FR+FC+BC
quad           FL+FR+BL+BR
quad(side)     FL+FR+SL+SR
3.1            FL+FR+FC+LFE
5.0            FL+FR+FC+BL+BR
5.0(side)      FL+FR+FC+SL+SR
4.1            FL+FR+FC+LFE+BC
5.1            FL+FR+FC+LFE+BL+BR
5.1(side)      FL+FR+FC+LFE+SL+SR
6.0            FL+FR+FC+BC+SL+SR
6.0(front)     FL+FR+FLC+FRC+SL+SR
3.1.2          FL+FR+FC+LFE+TFL+TFR
hexagonal      FL+FR+FC+BL+BR+BC
6.1            FL+FR+FC+LFE+BC+SL+SR
6.1(back)      FL+FR+FC+LFE+BL+BR+BC
6.1(front)     FL+FR+LFE+FLC+FRC+SL+SR
7.0            FL+FR+FC+BL+BR+SL+SR
7.0(front)     FL+FR+FC+FLC+FRC+SL+SR
7.1            FL+FR+FC+LFE+BL+BR+SL+SR
7.1(wide)      FL+FR+FC+LFE+BL+BR+FLC+FRC
7.1(wide-side) FL+FR+FC+LFE+FLC+FRC+SL+SR
5.1.2          FL+FR+FC+LFE+SL+SR+TFL+TFR
5.1.2(back)    FL+FR+FC+LFE+BL+BR+TFL+TFR
octagonal      FL+FR+FC+BL+BR+BC+SL+SR
cube           FL+FR+BL+BR+TFL+TFR+TBL+TBR
5.1.4          FL+FR+FC+LFE+SL+SR+TFL+TFR+TBL+TBR
7.1.2          FL+FR+FC+LFE+BL+BR+SL+SR+TFL+TFR
7.1.4          FL+FR+FC+LFE+BL+BR+SL+SR+TFL+TFR+TBL+TBR
7.2.3          FL+FR+FC+LFE+BL+BR+SL+SR+TFL+TFR+TBC+LFE2
9.1.4          FL+FR+FC+LFE+BL+BR+FLC+FRC+SL+SR+TFL+TFR+TBL+TBR
9.1.6          FL+FR+FC+LFE+BL+BR+FLC+FRC+SL+SR+TFL+TFR+TBL+TBR+TSL+TSR
hexadecagonal  FL+FR+FC+BL+BR+BC+SL+SR+TFL+TFC+TFR+TBL+TBC+TBR+WL+WR
binaural       BIL+BIR
downmix        DL+DR
22.2           FL+FR+FC+LFE+BL+BR+FLC+FRC+BC+SL+SR+TC+TFL+TFC+TFR+TBL+TBC+TBR+LFE2+TSL+TSR+BFC+BFL+BFR
```

The count of a word is the number of channels in its decomposition; the largest is 24 (`22.2`). The test holds the table against this text: same 40 words, same order, same counts. The first section of the output ("Individual channels", 36 names) is not a list of layouts and is not in the table.

## 4. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| D1 | EVERY entry carries a `basis`: `MEASURED` (only `5.1`, MM s2 / MM2 s1) or `BUILD_TABLE` (the other 39) | Design 4.6 row 2 and SM-04 (2) (a) say the table "holds measured entries only" and that a row adding a word cites its measurement; the brief of this row asks for the build's whole list. Both are kept: the basis leaves with the fact, and row N9 can admit `MEASURED` only if the design's letter is to hold. NOT decided here which one N9 applies |
| D2 | A SECOND stream line in the input's place, or a second header of the launch's index, WITHDRAWS the statement (`STATED_MORE_THAN_ONCE`); it never becomes known again | Design says "the first line". Stricter: a device name with line breaks could plant a header and a stream line before the true ones; with "the first wins" the planted one would be believed. Consequence for N9: wait for `section === 'CLOSED'` (the `Output #` line) before believing the statement, or accept that a later line can withdraw it |
| D3 | `COUNT_ONLY` for the exact form `<n> channels`, n 1 to 64 without a leading zero; `<n> channels (FL+...)` and every other text is `UNKNOWN` | The brief: "parsed if it is that exact form, else UNKNOWN". That the pinned build prints this form for a device was NOT measured (one device, one word) |
| D4 | The stream form requires the tail `, <n> kb/s, start <n>.<6 digits>` to the last character | identical in all 34 measured opens; an output's stream line has no start value and is not the form. A build or device that prints another tail is refused (`NOT_THE_FORM`), which is the safe side |
| D5 | A cut or over-long line is compared with two prefixes only (`  Stream #` gives UNKNOWN / `CUT`; `Output #` closes the place); nothing else of it is read | Design: over 512 characters "dropped unread". Reading eight characters of an output line with a long path keeps the place from staying open; closing is the safe direction |
| D6 | The input type is `{ text: string; cut: boolean }` | Row N5 had not landed when this was written. If its observer hands on another shape, N9 maps it (one line) |
| D7 | The two end statuses (251, 255) are exported as constants, not read | The records state them beside the lines; a pure reader sees no status |
| D8 | `OUTPUT_HEADER` before any input header closes the place for good | "before any `Output #` line" |

## 5. Mutations each rule was seen RED on

Each mutation was made in the module with the Edit tool, the test file run, the mutation taken back. Four runs (batches of mutations at different places; the failing case named by its label).

| # | Mutation | RED in (case shown) |
|---|---|---|
| M1 | rate group `[0-9.]{1,7}` | "a rate with a decimal ..." (`48000.0` read as 48,000; `48000.5` was still refused by the whole-number check) |
| M2 | ` Hz` read as ` ?Hz` | "`48000Hz` without the space ..." |
| M3 | `$` off the queue-full form | "the two queue lines ..." (`... FIFO queue full (512 packets)`) |
| M4 | `^` off the refusal form | "the refusal line ..." (`note: [in#0 ...`) |
| M5 | signal group `[0-9]+` | "the two ending lines ..." (signal 9) |
| M6 | `$` off the stream form | "the form holds to the last character ..." |
| M7 | format compared on the codec word alone | "another codec or sample format is OTHER ..." (`s16`) |
| M8 | layout looked up by its first word | "a layout word with trailing text ..." (`5.1 (custom)`), and `6.0 channels` in the count test |
| M9 | count form `^([0-9]+) channels` | "`<n> channels` is read only in that exact form" (`06 channels`), and `6 channels (FL+...)` |
| M10 | the cut mark not looked at in the stream reader | "a cut stream line is UNKNOWN ..."; "a cut or malformed stream line in its place ..." |
| M11 | printable check out of the stream reader | "a control character ... in a stream line" (U+0000) |
| M12 | printable check out of `classifyHelperLine` | "a control character in any line" - RED BY THE REASON ONLY (`NO_FORM` for `NOT_PRINTABLE`): the anchored forms refuse those lines by themselves; no line became an event under the mutant |
| M13 | the bound raised to 100,000 | "a 10,000-character line is not read ..." |
| M14 | the cut mark not looked at for the other forms | "a cut line that is not a stream line ..." (a cut queue line was a queue event) |
| M15 | the fold takes a stream line in any section | "before the header", "after an `Output #` line", "a header of another index", and three more |
| M16 | the header's index not compared with the launch's | "a header of another index opens no place" |
| M17 | a second stream line ignored | "a SECOND `Audio:` line in the place withdraws the statement" |
| M18 | an UNRECOGNISED fact given a `text` member | "a device name in a line ... leaves no character of itself" |
| M19 | `5.1` given 5 channels | "the same words, in the same order ...", and every measured stream line |
| M20 | the row `7.1(wide-side)` taken out | "the same words ..." (39 of 40), "every word of the build ..." |

## 6. Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| the row's tests | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/audio/__tests__/macos-helper-lines.test.ts` | `Tests  33 passed (33)` |
| audio adapter suite + the two capture static files | `... src/capture/adapters/audio/__tests__/ src/capture/adapters/__tests__/static.test.ts src/capture/__tests__/static.test.ts` | `Test Files  9 passed (9)`, `Tests  331 passed (331)` |
| the static set | `... test/static` | `Test Files  17 passed (17)`, `Tests  210 passed (210)` |
| typecheck | `npx tsc --noEmit` | exit 2, three errors, NONE in this row's files: `packages/shared/src/sim/capture-notices.ts(367,106)` `MIC_SILENCE_RUN_MAX_MS`, `(368,24)` `isMicShortfallReason`, `(368,60)` `micShortfallSentence` not found - area of row N2 (in flight, the one writer of `packages/shared`) |

## 7. The double, and what stays unproven

The double: text. The lines are copied from the three records; the pointer (`0x<ptr>` there) is a synthetic number, the device name a synthetic text. No helper was started except the one `-layouts` run; no device was opened.

Unproven, for the user's own session (design 9.3) and the hardware package:
- the exact characters of a real pointer (taken as `0x` and 1 to 16 lower-case hexadecimal digits; the records redact it);
- that the lines arrive with their two leading spaces through the door's observer (row N5);
- the layout word of any channel count but six, and whether the build prints `<n> channels` for a device;
- the helper's lines at the log level the macOS row uses (the records measured `info`; at `warning` the helper prints nothing, MF5) - the row of N4 sets it.

## 8. Requirements

SM-04 (2): the stream line by one anchored form, the rate one whole number, the layout through a closed table that is a constant of one file (with the conflict of D1 stated). SM-16 (1) to (3): the reader makes the refusal of another rate, layout or format possible; the gate is N9's. SM-12 (3): no text of a line kept. SM-35 (4): `QUEUE_FULL` and `QUEUE_FLUSHED` are separate typed events, counted, so N9 can time a `full` without its twin; they carry no amount.

## 9. Requests

None in `file_requests.md`.
