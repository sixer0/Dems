---
task_slug: input_av_core_adapter_plan
row: 66
milestone: M4 / WP-08
date: 2026-10-13
agent: coder-execution (batch 6, agent H)
status: complete
tier: T3
---

# Row 66 - the Linux helper argument table beside the macOS one

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `LOC` = `CS/src/capture/adapters/local`, `IAV` = `apps/input-av/nvr` (read only; nothing under `apps/input-av/data/` and no `.env` was opened).

## 1. What was built

| File | State | What it is |
|---|---|---|
| `LOC/mic-helper-args.ts` | MOD, additive | DECLARED place: the Linux table is a new section at the end of the existing file. Three import lines added; no line of the macOS tables changed. New exports: `linuxChannelSelection`, `linuxMicDeviceArgument`, `linuxMicPushArguments`, `linuxMicPrecheckArguments`, `MIC_LINUX_HELPER_TABLE`, `LinuxMicArgumentError`, `LINUX_MIC_ARGUMENT_REFUSED`, `LINUX_MIC_CHANNELS_MAX` (64), `LINUX_MIC_CHANNEL_INDEX_MAX` (63), the types `LinuxMicCard`, `LinuxMicPushArguments`, `LinuxMicArgumentRefusal` |
| `LOC/__tests__/mic-helper-args.test.ts` | MOD, new cases only | 34 new cases (17 named ones, one of them a table of 18 refusals) in three blocks at the end; one import list extended. No existing case changed |
| `CS/src/capture/__tests__/static.test.ts` | MOD | section 4 |

Why the existing file and not a new one: `mic-static.test.ts` (not one of the three lists this agent writes) holds the exact list of the `mic-*.ts` files of the folder and the rule that `-loglevel`, `-flush_packets` and `pcm_f32le` are named by `mic-helper-args.ts` alone. A new `mic-*` file would have needed an edit of that test; a file under another name would have slipped past it. The Linux table reuses the file's own `QUIET`, `PROGRESS`, `OUTPUT` and `PRECHECK_OUTPUT`, so the output line cannot drift from the transport.

Not touched: `LOC/index.ts` (the new names are not in the barrel; row 67 and the static test import the file), `mic-helper.ts`, `mic-adapter.ts`, the production door. Nothing calls the table yet (row 67).

## 2. The lists, and where they come from

Source: `IAV/recorder.py:92-116` (`audio_inputs`, `capture_channels`, `audio_select_filter`) and `:205-215` (`_input_args`); `research/01_explore_input_av.md` (the audio groups of the tested input scheme, with the derived examples). Specification S3-5.

Push list, an interface with 8 inputs (card 2, device 0), input 3:

```
-hide_banner -nostdin -nostats -loglevel warning -progress pipe:1
-thread_queue_size 1024 -f alsa -c:a pcm_s24le -channels 8 -sample_rate 48000 -i dems_2_0
-af pan=mono|c0=c2
-vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <pipe>
```

Pre-check list: the quiet words, the same input section, `-t 0.2 -vn -f null -` (no selection, nothing written).

| Rule of the tested scheme | Here |
|---|---|
| `-thread_queue_size 1024 -f alsa -c:a pcm_s<bits>le -channels <n> -sample_rate <rate> -i <shared pcm>` (`recorder.py:212-215`), defaults 24 bits and 48,000 | the same words as literals; `pcm_s24le` and `48000` fixed |
| The shared PCM, not the hardware (`recorder.py:209-210`) | `linuxMicDeviceArgument(cardIndex, deviceIndex)` = `sharedPcmName` of row 65: `dems_<card index>_<device index>` |
| ALWAYS all device channels; a selected input never lowers the count (`recorder.py:104-108`) | `-channels` is the card's native count, one of the 64 words `'1'` to `'64'` of the table, taken by its number |
| One input selected by `pan`, never mixed: `pan=mono\|c0=c<input - 1>` (`recorder.py:111-116`) | `linuxChannelSelection(k)`, k = input number minus 1, a whole number 0 to 63: one output channel, one source channel, no sum and no gain |
| What the worker needs (`mic-transport.ts`: F32LE, 48,000 Hz, mono; E-6: 24-bit samples survive the float) | the existing output line after the selection, unchanged; the card is asked for 24-bit samples |

Refusals, before any argument is built: an input above the card's channel count -> `AudioInputBeyondCardError` (`AUDIO_INPUT_BEYOND_CARD`, with the registry id only); an input number that is no whole number, below 1 or above 64 -> `INPUT_NUMBER`; a channel count not 1 to 64 -> `CHANNEL_COUNT`; a card or device index not 0 to 31, or text in its place -> `CARD_INDEX` / `DEVICE_INDEX`; a channel index not 0 to 63 -> `CHANNEL_INDEX`; a pipe path not of its shape -> `PIPE`. All `LinuxMicArgumentError` (`LINUX_MIC_ARGUMENT_REFUSED`), fixed text, no value in the message.

### Deviations from the source

| # | Source | Here | Why |
|---|---|---|---|
| V-1 | device `dems_<card id>_<dev>` | `dems_<card index>_<device index>` | AD-07 (2); SR-4 (3) |
| V-2 | no `-af` when all inputs of a card of 1 or 2 channels are recorded | a selection in every push list, also `pan=mono\|c0=c0` for a 1-channel card | one microphone is one input and the pipe is mono: with no selection `-ac 1` would MIX a 2-channel card |
| V-3 | several inputs in one source (`pan=stereo\|...`, `pan=<n>c\|...`) | one input per list | the transport is mono, one registered input is one input number; a second input is a second microphone with its own helper (shared capture, row 65) |
| V-4 | bits and rate from the stored configuration | literals `pcm_s24le`, `48000` | no value of the database reaches an argument; the worker refuses any other rate |
| V-5 | `-n -progress pipe:1 -stats_period 0.5` | the quiet and progress words of the macOS table | the door and the no-delivery bound of this Core read those |

## 3. AD-07 (2) in this row

The table has no parameter that is text. The device argument is made by one function from two integers; the selection by one function from one integer; the channel count is a word of a closed table. Tests that fail if device text could reach an argument: a card object carrying hostile `cardId`, `product`, `usbId`, `usbPort` and four more text members gives exactly the list of the bare integers, for the push and the pre-check, and none of eight planted strings is part of any argument; text in the place of an integer (`'EVO8'`, `'1'`, `'1,DEV=0'`, `'0 -i x'`, `''`) is refused; a rule function over 2,835 lists (5 card indexes, 3 device indexes, every channel count, 3 inputs) finds nothing, and its control finds a card named by text, a device beyond 31, a mixing selection, a selection beyond channel 63, a second bar argument, a second input and an extra option.

## 4. Static rule lists (SR-4, places 1 to 3 - and nothing else)

`CS/src/capture/__tests__/static.test.ts`, block G-R12:

| SR-4 | Edit |
|---|---|
| (1) format | `FORMATS` gains `'alsa'`: five become six |
| (2) the one bar argument | `CHANNEL_SELECTIONS`, the 64 texts made by `linuxChannelSelection`. The bar stays in `FORBIDDEN`; an argument is excused only when it is one of the 64, stands after `-af`, and the list is of the Linux table - and it is then tested again with its bars taken out. New violation "more than one argument holds a bar" |
| (3) the device from two integers | `LINUX_DEVICES`, the 1,024 texts made by `linuxMicDeviceArgument`; admitted only after `-i` in a Linux list |
| the count of lists | ten stay ten; the three Linux lists are a second group; the pin states 10 and 13 |
| kept | every other rule of the block. The literals of the Linux table (with its 64 channel-count words) are NOT lent to the ten earlier lists: `violations(args, linux)` judges a Linux list by the Linux table only (control: `'64'` added to a camera list is "not of the table") |

One new case with its controls (a selection in a macOS list, a mixing selection, channel 64, a second selection, a card named by text, a device of the hardware directly, a bar in the device, a count of 65, a shell mark, the format `pulse`, ...), and the pin that `'alsa'` is named by `mic-helper-args.ts` alone. One import line added (the file itself, since the barrel is not edited). `adapters/__tests__/static.test.ts` and `test/static/credentials.test.ts`: not edited by this row.

NOT done here, by SR-4's own text: "no value read from the database and no string of a live listing reaches an argument (static test)" is row 67's check, on the adapter that calls the table; the last sentence of SR-4 (the alias helper) takes effect with row 105.

### Static-list requests of the batch

None was filed in `file_requests.md` during the work. Four reds were SEEN in the lists this agent writes, all caused by agent I's in-flight module `CS/src/modules/capture-audio-cards/` and its edit of `CS/src/app.ts`, and NOT amended, because neither SR-1 nor SR-4 admits them (one line filed in `file_requests.md`):

| Rule | Red |
|---|---|
| P25 (`static.test.ts:508`, `:595`) | `app.ts` holds lines that are not waived edits; the digest of the frozen file differs |
| SEC35-41 (c) (`static.test.ts:1040`) | `src/modules/capture-audio-cards/statements.ts`: a second file with an INSERT into `capture_devices` |
| A-5 (`adapters/__tests__/static.test.ts:278`) | `src/modules/capture-audio-cards/index.ts:38`, `service.ts:59` import the adapter layer and are no wiring unit |

## 5. Evidence

| Check | Command (from `CS`) | Result |
|---|---|---|
| Row's files and the static files | `npx vitest run --project unit --maxWorkers=2` on `mic-helper-args.test.ts`, `mic-static.test.ts`, the three static files | `Test Files 2 failed \| 3 passed (5)`, `Tests 4 failed \| 141 passed (145)`; `mic-helper-args.test.ts`, `mic-static.test.ts` and `credentials.test.ts` green; the 4 failures are the reds of section 4 |
| Second run (after that failure), both rows | the 7 files of rows 65 and 66 | `Test Files 2 failed \| 5 passed (7)`, `Tests 4 failed \| 204 passed (208)`; the same 4, none in a case of rows 65 / 66; the G-R2 and G-R12 blocks green |
| macOS table: 0 changed results | the existing cases of `mic-helper-args.test.ts` (unchanged) and `mic-static.test.ts` | all pass; plus one new assertion that the macOS literals hold no word of the Linux table and its five lengths are 7, 4, 5, 7, 12 |
| Typecheck | `npm run -s typecheck` | exit 0 |
| Lint | `npx oxlint` on the files of both rows | exit 0 |

Verification cell: "the argument list equals the quoted input-av values as text" - cases "a 2-input card, input 2", "a multi-input interface, input 3 of 8", "equals the lists of the tested input-av scheme as text"; "an integer outside 0 to 63 is refused" - "the selection function takes a whole number 0 to 63 and nothing else"; "the macOS table's tests show 0 changed results" - above.

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| DD-1 | The Linux table lives in the existing `mic-helper-args.ts` | section 1: the folder's own static test then covers it without an edit |
| DD-2 | The channel count is a word of a closed table of 64, not a fourth computed value | SR-4 admits two new computed arguments and says every other argument is a literal |
| DD-3 | V-2: a selection in every push list | never a mix |
| DD-4 | V-3: one input per list; the maximum is channel index 63 / input 64 / 64 channels | SR-4 (2); the transport is mono |
| DD-5 | V-4: `pcm_s24le` and `48000` are literals. A card whose one rate (row 65) is not 48,000 is still asked for 48,000 here: the `plug` layer converts | the worker refuses another rate; whether a resampling `plug` is acceptable for such a card is for `9A/H-08` |
| DD-6 | A new error class `LinuxMicArgumentError`; the macOS `MicHelperArgumentError` and its four reasons are untouched | 0 changed results |
| DD-7 | A pre-check list is provided (row 67 implements the short open) | the macOS table has one; it selects nothing and writes nothing |
| DD-8 | `local/` imports `../audio/alsa-config` for the one name function | one source of the name the configuration and the argument must share |
| DD-9 | The requests of agent I's module were not applied (section 4) | the brief: only what SR-1 and SR-4 admit |

## 7. The double, and what stays unproven

The double: no ALSA and no helper process on this Mac; the table is held to text against the quoted input-av lists. Nothing was started.

| Unproven | Proven by |
|---|---|
| That the FFmpeg program of the target accepts the list for the `alsa` device layer (option names, their order before `-i`) | row 79, container check (the list parsed against an ALSA `null` or `file` device); `9A/H-08` |
| That `dems_<card index>_<device index>` opens through the configuration of row 65 handed by `ALSA_CONFIG_PATH` | `9A/H-08` |
| That input k of the interface is channel k - 1 of the capture and that the selected input is the one heard, with no bleed of another input | `9A/H-08` (speak into each microphone, read the level), `9A/H-07` criterion 1 (channel figures) |
| The 24-bit request against the card's native format; the first-second full-scale sample; levels (the bench recordings of this scheme were practically silent); the rate figure the worker reports | `9A/H-08`, E-5 |
| `-thread_queue_size 1024` and the `dsnoop` period against the worker's placement by arrival | `9A/H-08`, E-5 |
| V-2 on a real 1-channel card | `9A/H-08` if such a card is used |

## 8. Identifiers

Closed on doubles: WP-08 (argument table part); S3-5; SR-4 places (1) to (3) with the sentence of AD-07 (2) for the table; the audio groups of the tested input scheme as text; P12-F04 for this entry. Open: row 67's static test of the argument origin; row 79; `9A/H-07`, `9A/H-08`; E-5.
