---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 79b
date: 2026-10-13
agent: coder-execution (driver, track D)
tier: T2
source: decisions/decisions.md C89; test/079_linux_container_checks.md section 5; its line in delegation_progress/file_requests.md
status: complete
---

# Row 79b - the channel option of the Linux microphone helper

## 1. The row, before and after

`apps/core-server/src/capture/adapters/local/mic-helper-args.ts`, the input head of the Linux table and the closed set its one value comes from.

Before:

```ts
const LINUX_INPUT_HEAD = ['-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-channels'] as const;
const LINUX_CHANNEL_COUNTS: readonly string[] = Object.freeze(Array.from({ length: LINUX_MIC_CHANNELS_MAX }, (_unused, index) => String(index + 1)));
```

After:

```ts
const LINUX_INPUT_HEAD = ['-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-ch_layout'] as const;
const LINUX_CHANNEL_LAYOUTS: readonly string[] = Object.freeze(Array.from({ length: LINUX_MIC_CHANNELS_MAX }, (_unused, index) => `${String(index + 1)}C`));
```

The push list of an 8-input card, input 3, as the product builds it now (printed by the product's own function, `.cache/task4-row079b/c/linux_args.json`):

```
-hide_banner -nostdin -nostats -loglevel warning -progress pipe:1
-thread_queue_size 1024 -f alsa -c:a pcm_s24le -ch_layout 8C -sample_rate 48000 -i dems_2_0
-af pan=mono|c0=c2 -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <pipe>
```

Two words per list changed (`-channels 8` became `-ch_layout 8C`), in the same two places; every length of the table is as it was (`inputLength` 12, a push list 34 words). The pre-check list changed in the same two words. Nothing else of the file was touched: the macOS / development tables, the card listing row (85c) and the two commissioning rows (111b) are as they were.

Also added, for the static rule: `MIC_LINUX_HELPER_TABLE.channelLayouts`, the 64 words in order, frozen.

## 2. Why this form, and where the value comes from

What: the pinned FFmpeg 9.0.2 has no option named `channels`. Its sound-device input has two options of its own, `-sample_rate` and `-ch_layout` (`ffmpeg -h demuxer=alsa` in the container, `10_setup.log`). The old word came from the reference system's older program.

Why `<n>C` with a capital C: it states n channels in the card's own order and claims no speaker position. The small-c word (`<n>c`) names the DEFAULT layout of a count; the pinned program has one for 13 counts only (1 to 8, 10, 12, 14, 16, 24 - measured on both platforms, section 4) and refuses the others, and for 8 channels it names `7.1`, for which the ALSA input prints "channel layout unknown or unimplemented" (test/079 section 5). `-ac <n>` in that place is accepted too (test/079), but it is the program's generic output-side word and is already used in the output line of every list (`-ac 1`); the device layer's own option was chosen so that a list holds each word once per side and says what it means. The selection after it, `pan=mono|c0=c<k>`, names its source channel by index, which is what an unpositioned layout offers; that it hands on channel k alone under `<n>C` is measured (section 4).

The closed set (rule G-R12 as amended by SR-4: no argument from data): the value is NOT computed text. It is `LINUX_CHANNEL_LAYOUTS[n - 1]`, one of 64 literal words `1C` to `64C` made once when the module loads, taken by the number n. n is `LinuxMicCard.channelCount`, held to a whole number 1 to 64 by `isWholeIn` before the look-up; anything else is refused `LINUX_MIC_ARGUMENT_REFUSED:CHANNEL_COUNT` and no list is made. n itself is the channel count of the LIVE card listing at the open (`usb-audio-production.ts`: `channelCount: located.card.channelCount`, pinned by the static test of row 67), never a value of the database and never text of the listing.

How the production adapter uses the row (implementation/067, 200): the helper opens the card's shared capture with ALL native channels at 24 bits and 48,000 Hz, selects the one registered input, and writes 32-bit float, 48,000 Hz, MONO into the pipe - the evidence form the worker reads and mixes. The output line is the one of the development tables, unchanged.

## 3. The development rows did not change, and why the two differ

The development rows (`DEVICE`: `-f avfoundation -i none:<name>`; `GENERATED`: `-re -f lavfi -i sine=...`; `FIXTURE`: `-re -stream_loop -1 -f wav -i <path>`) never carried `-channels` or any channel option on the input side: the generated tone and the speech file are mono by themselves, and this Mac's device is opened as it reports itself. They state the channel count only on the OUTPUT side (`-ac 1`), which is the shared output line and is valid on both platforms. There was therefore nothing to change, and nothing was: `git diff HEAD --unified=0` of the file has its first hunk at line 195 (the head comment of the Linux section); no line of the macOS tables (lines 1 to 174) differs from the committed file. The Linux row needs an input-side count because a sound card opened with fewer channels than it has is MIXED by the sound library.

## 4. Proof

All logs under `.cache/task4-row079b/` (untracked). Programs: macOS `/opt/homebrew/bin/ffmpeg` and `.data/helpers/ffmpeg`, both `ffmpeg version 9.0.2`; container `/opt/dems/ffmpeg-9.0.2/bin/ffmpeg`, `ffmpeg version 9.0.2`, Ubuntu 24.04.5, aarch64, image `b914f7078f7b` (not rebuilt), `--network none`.

### 4.1 macOS: development audio unchanged (generated fixtures only; this Mac's microphone was never opened)

| Check | Command | Result line |
|---|---|---|
| The generated microphone, real program, real pipe (existing test) with the adapter test | `vitest run --project unit --maxWorkers=2 .../usb-audio-production.test.ts .../mic-helper.generated.test.ts` under the heavy-host lock (`02_macos_process_tests.log`) | `Test Files 2 passed (2)`, `Tests 53 passed (53)` |
| One short scripted capture, generated tone 880 Hz, 4 s | `node --import tsx .../e2e/local-mic-capture.ts --program .data/helpers/ffmpeg --source generated --seconds 4 --run-dir <scratch>` (`03_macos_generated_capture.log`) | `PASS`; `samples` 217,088; `observedSamplesPerSecond` 48,009 (expected 48,000, tolerance 2 %); `aligned` true (whole 4-byte samples); `formatRefusals` [] (float 32, 48 kHz, mono by the stream judge); `peakDbfs` -18.1, `rmsDbfs` -21.1, `aboveSilence` true, `longestZeroRunMs` 0; `sockets` 0; `helperGone` true |
| The development lists are the committed ones | `git diff HEAD --unified=0 -- .../mic-helper-args.ts` | hunks at lines 195, 199, 208, 211, 266, 306, 313 of the committed file only |

The level: -18.1 dBFS peak and -21.1 dBFS RMS are the figures of the table's tone itself (a sine of amplitude 1/8: 20 log 0.125 = -18.06; RMS 3.01 dB below). I found no earlier record of this script's level figures in the documents to set beside them, so "as before" rests on (a) the argument lists being byte-equal to the committed ones and (b) the measured level being the analytic level of the generated source. NOT RUN: a whole development session with the Core and the capture worker (the worker's own level frames). The helper's list for such a session is the unchanged development list; no worker file and no line the worker reads was touched.

### 4.2 macOS: the Linux lists against the pinned program, device layer replaced

macOS has no ALSA input, so no macOS run can open the product's list as it is. What macOS CAN show, and did: with the raw input of the same sample form in the place of the device layer (`-f alsa` read as `-f s24le`, the device read as a file - the ONLY two words changed, by `c/parse_check.py`; `ffmpeg -h demuxer=s24le` lists the same two options `-sample_rate`, `-ch_layout`), the pinned program takes the product's lists for every count. The input file holds the constant (j+1)/128 in channel j, so the selection is measured, not assumed. `01_macos_parse.log`:

```
{"lists": 130, "precheck_accepted": 130, "push_accepted": 130, "push_selected_the_one_channel": 130, "bytes_each": 9600}
{"control": "the old word -channels", "rc": 8, "refused": true, "stderr": ["Unrecognized option 'channels'."]}
{"control": "a word that is no layout", "rc": 234, "refused": true, ...}
{"information": "counts whose small-c word (<n>c) is taken", "counts": [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 24]}
PARSE CHECK: PASS
```

130 lists = every count 1 to 64 with the last input selected and (from 2 up) the first, plus the three cards of test/079. A correction to C89's sentence "no macOS run could show it": the refusal of the word `-channels` IS visible on macOS with this stand-in (exit 8); what macOS cannot show is the ALSA input itself.

### 4.3 The Ubuntu 24.04 container: the product's own lists against ALSA `null` and `file` devices

The lists are the product's: printed on this Mac by `.cache/task4-row079b/gen_args.mts` (it calls `linuxMicPushArguments`, `linuxMicPrecheckArguments`, `linuxMicDeviceArgument`; nothing is retyped) and handed to the container as JSON. `/etc/asound.conf` gives the product's own device names to ALSA's `null` and `file` plug-ins (`c/setup.sh`).

| Pass | What | Result |
|---|---|---|
| THE SAME 18 CASES AS test/079 (`11_alsa_args_product.log`): row 79's own driver `row079.py alsa`, copied unchanged (`cmp` equal), pass "THE PRODUCT'S LISTS AS BUILT", no what-if switch | pre-check and push, 3 cards (8 inputs / input 3 on `null`; 2 / 1 on `file`; 1 / 1 on `null`), 3 runs each | **18 of 18 accepted** (was 0 of 18): pre-check exit 0; push with 4 progress blocks and 9,876 to 29,292 bytes in the pipe in 2 s, whole 4-byte samples, ended by the driver's SIGTERM (exit 255) |
| Its negative controls | a misspelled option; a device ALSA does not know; a codec name that is none | refused 3 of 3: exit 8 `Unrecognized option 'ch_layoutz'`; exit 251 `Unknown PCM dems_9_9`; exit 8 `Unknown decoder 'pcm_s24xx'` |
| THE RANGE (`12_alsa_range_pattern.log`, `c/alsa_range.py`) | the pre-check list for every count 1 to 64 (`1C` ... `64C`) on an ALSA `null` device | **accepted 64 of 64**, refused [] |
| THE SELECTION THROUGH THE ALSA INPUT (same log) | the push list on ALSA `file` devices whose input file holds the constant (j+1)/128 in channel j: 8 channels / input 3, 8 / 8, 2 / 2, 64 / 64, 64 / 1 | 5 of 5: every sample in the pipe is the constant of the selected channel and no other value (`distinct` 1: 0.0234375, 0.0625, 0.015625, 0.5, 0.0078125; 2,653 to 7,778 samples each) |
| The raw-input stand-in with the Linux build (`13_linux_parse.log`) | as 4.2 | 130 / 130 / 130; the old word: exit 8 `Option channels not found.`; small-c counts the same 13; `PARSE CHECK: PASS` |

As in test/079, every accepted ALSA run prints `Application provided invalid, non monotonically increasing dts to muxer`: the `null` device has no clock. That is the double, not the list.

Container: one, `dems-row079b`, label `dems.agent=row079b`, `--init --network none`, one read-only mount of `.cache/task4-row079b/c`. Every `docker` command held `.locks/heavy-host.lock` for its run only. Removed at the end; `14_containers_left.log`: `docker ps -a --filter label=dems.agent=row079b` 0 rows, no container named `dems-*`. No image was built, pruned or removed; `b914f7078f7b` is still there. The three containers of another project on this host were not touched.

### 4.4 Unit tests, static set, typecheck

| Test | Command (from `apps/core-server`, `--maxWorkers=2`) | Result |
|---|---|---|
| Table, static set, development microphone units (first run) | `vitest run --project unit` on `local/__tests__/mic-helper-args.test.ts`, `capture/__tests__/static.test.ts`, `local/__tests__/mic-helper.test.ts`, `mic-diagnose.test.ts`, `mic-static.test.ts`, `adapters/__tests__/static.test.ts` | `Test Files 1 failed, 5 passed (6)`, `Tests 1 failed, 229 passed (230)`: one more pin of the old row in the table's own test (`swap('8', ...)`, a control) |
| The table's test after moving that pin (second run, after a failure) | `mic-helper-args.test.ts` | `Tests 52 passed (52)` |
| The adapter and the generated microphone | section 4.1 | `Tests 53 passed (53)` |
| Static set once more on the final tree (another row had edited `static.test.ts` in between) | `capture/__tests__/static.test.ts`, `adapters/__tests__/static.test.ts`, `mic-helper-args.test.ts`, `mic-static.test.ts` | `Test Files 4 passed (4)`, `Tests 163 passed (163)` |
| Typecheck | `npx tsc --noEmit` (apps/core-server), twice (after the change; on the final tree) | exit 0 both times |

No full suite was run.

## 5. Changes

| File | Change |
|---|---|
| `apps/core-server/src/capture/adapters/local/mic-helper-args.ts` | the row and its closed set (section 1); `linuxInputArguments` reads the layout word; `MIC_LINUX_HELPER_TABLE.literals` holds the 64 layout words in the place of the 64 counts and gains `channelLayouts`; the head comment of the Linux section and a comment at the row |
| `.../local/__tests__/mic-helper-args.test.ts` | the pins of the row by delta (expected lists, the input-av comparison now names its ONE difference, the digit-literal pin `[1..64, 1024, 48000]` -> `[1, 1024, 48000]` plus the 64 layout words, one control); ONE new case: the closed set, all 64 counts in both lists, `-channels` in no list; two new controls (the old word, a bare count) |
| `apps/core-server/src/capture/__tests__/static.test.ts` | the SR-4 pin of the row: two words per list, with the reason and C89 in a comment; the closed set pinned (64 words, each a literal of the Linux table and of no other, the word for its count, nothing made outside 1 to 64, `-channels` in none of the 13 lists); the control `swap('8','65')` moved to `('8C','65C')`; four new controls (`-channels`, `8`, `8c`, `7.1` each "not of the table"); `64C` no literal of the other lists. No rule, list or count pin of another row was touched |
| `.../audio/__tests__/usb-audio-production.test.ts` | only the lines that spell the row: the written-out vector, two expected lists, and the stand-in helper's option table and count check (it now refuses `-channels` as an unknown option, as the real program does); two new controls in its "no rubber stamp" case |
| `apps/capture-worker/README.md` | ONE passage of the Linux section (the import-net line): it said the Linux-only calls are outside the watched list and "adding them is a decision"; row 141 added them (list `LINUX_ONLY`, 12 names, 72 watched in all - counted from `pinned_calls.py`). The passage now says so and names what is still outside with the file's own reasons |
| `delegation_progress/file_claims.md`, `file_requests.md` | one line each |

## 6. What stays unproven until a real sound card

- `9A/H-07`: the real card listing (the channel count n the row is given comes from it; here n was a number of the test).
- `9A/H-08` (`.1`, `.2`, `.4` to `.6`): that the shared capture (`dsnoop` behind `plug`, written by row 65) of a real card opens with `-ch_layout <native count>C` - the doubles were ALSA `null` and `file`, which accept any count; that two helpers open one card at once; the format the card reports; that the selected input is the microphone that is heard, at an audible level.
- Whether a real card's driver reports a channel map and what the pinned ALSA input does with it under an unpositioned layout: not observable on `null` / `file`. The selection is by index and was measured through the ALSA input on a `file` device, not on hardware.
- `9A/H-01`: the production host's own FFmpeg build is amd64; the options were read on arm64 (container) and on macOS arm64.
- The collector of `9A/H-08.6` does not know the new word (request line; blocking for that reading).

## 7. Driver decisions, for the controller to confirm

1. DRIVER DECISION: `-ch_layout <n>C` (capital C) was chosen over `-ac <n>` and over `<n>c`, for the reasons of section 2. It is the form C89 names and the one measured for all 64 counts.
2. DRIVER DECISION: `usb-audio-production.test.ts` (the adapter's test, written by rows 67 / 200) was edited in the lines that spell this row. The brief gives me "its tests" and asks for the adapter's tests green; without these lines the tree would be red. Nothing else of that file was touched.
3. DRIVER DECISION: the table gained one exported member, `MIC_LINUX_HELPER_TABLE.channelLayouts`, so that the static rule can pin the closed set itself rather than infer it from the literals.
4. The "level frames as before" cell is met by the scripted capture's level figures and by byte-equality of the development lists, not by a whole Core-and-worker session (section 4.1).

## 8. Rules kept

Claims line first. Existing repository files with the Edit tool only (six files: the four above under `apps/core-server`, the README, and the two delegation files); no scripted replace, no shell append on a repository file. New files with Write: this record and `delegation_progress/row_079b.md`. Test code and logs under `.cache/task4-row079b/` (untracked; `gen_args.mts` there was extended once by a scripted replace, which touched no repository file). Nothing committed, staged or stashed. This Mac's microphone was never opened (generated tone only; `--source generated`). No real device, no credential, no network; ports 4423 / 5178 untouched; no database. Nothing under `apps/capture-worker` was built. No full suite.

---
*Generated: 2026-10-13 16:20 WIB*
