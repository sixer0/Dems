---
task_id: 2026-10-12_input_av_core_adapter_plan
row: N4b (wave 12, track D)
date: 2026-10-14
agent: test-expert (agent N4b)
type: measurement record (Tier 2)
status: needs-review (part A complete: the two provisional sentences HOLD; part B STOPPED before any open, as briefed: the device runs at 96,000 Hz; one fault found in row N8's reader)
decisions_read: U23, U24, C107, C110; design masterplan/06 revision 3 sections 4.2 to 4.3.3, 4.6, 6.1; implementation/n4; verification/08b s2 (rank 4); test/mm2, test/mm3
source_changed: none (no product file; scripts and number files under `.cache/task4-n4b/` only)
devices_opened: none (0 helper starts on the user's USB interface; the built-in microphone, cameras: never)
settings_changed: none; no dialog answered
session: 2026-10-14 08:59 to 09:08 WIB (host `date`)
---

# Row N4b: the one run of design 4.3.3 on the product's own lists

## 0. Verdict

| Provisional sentence of SR-15 (design 4.3.3) | Verdict | Evidence |
|---|---|---|
| SR-15 (3): "THE PRE-CHECK LIST IS A TEMPLATE TOO: `-hide_banner -nostdin -nostats -loglevel info -f avfoundation -i <device word> -t 1 -map 0:a -af <selection> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -`. The word `-t` stands in this list and in no other. What it writes to standard output is read by the Core in memory, within a bound of bytes and of time, counted and stored nowhere." | **HOLDS** on the pinned build, on a generated source | form (a), twice: every word accepted, exit 0, standard output 192,000 bytes = 48,000 samples of mono f32le, the selected channel alone, source indexes 0 to 47,999 with none missing, in 1.04 s (section 3) |
| SR-15 (2) with ONE section: "... then ONE or TWO sections, each `-map 0:a -af <selection> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <pipe>`" | **HOLDS** on the pinned build, on a generated source | form (b): every word accepted, exit 0, 288,000 of 288,000 samples, none missing; with a stalled reader the queue drops and says so in the two lines row N8 reads (section 3) |

**No word of the product's lists is refused by the pinned build.** No `Unrecognized option`, no option error in 15 runs; the only error lines are the helper's own after a reader closed its pipe (section 4).

Not a word of a template, and still to be decided by others (sections 4 to 6; three lines in `delegation_progress/file_requests.md`):

1. Forms (c) and (d) of the run have answers the adapter row must not assume otherwise: a reader that CLOSES its pipe ends the whole helper (status 224); a helper whose pipe no reader opened does not end on SIGTERM.
2. Row N8's fold withdraws the stream statement on the device's real line order (the block `Stream mapping:`).
3. PART B WAS NOT RUN ON THE DEVICE: the interface runs at 96,000 Hz now. The brief says report and stop.

## 1. Frame (what, why, how verified)

| | |
|---|---|
| What | The run design 4.3.3 names (08b rank 4): forms (a) to (d) on a generated source, with the lists the PRODUCT builds; then the same lists on the user's USB interface (part B, decision U24) |
| Why | Two sentences of SR-15 were adopted without a run (decision C110); row N4 does not close and row N9 does not rely on (c), (d) before it |
| Helper | `/Users/gsp-budi/Documents/DEMS/.data/helpers/ffmpeg`; version line `ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers`; SHA-256 `c8173e9755795978bce8e104f8d7044fabe7d6d84044aba37d3648c6f4e4e1a8` (equal to row N4's) |
| NO LIST RETYPED | `.cache/task4-n4b/product.ts` imports `macMicPushArguments`, `macMicPrecheckArguments`, the three listing-row functions and `MACOS_LISTING_HELPER_TABLE` from `apps/core-server/src/capture/adapters/local/mic-helper-args.ts`, `createMacosCardEnumerator` from `adapters/audio/macos-card-listing.ts` and the whole of `adapters/audio/macos-helper-lines.ts`, and prints what they answer as JSON. Run as `node --import tsx` (the `tsx` command itself needs a local socket the command sandbox refuses). `.cache/task4-n4b/n4b.py` hands each array to the helper as it is, with an empty environment |
| THE ONE SUBSTITUTION (part A) | In each product array the four words `-f avfoundation -i none:0` are replaced by the seven words `-re -readrate_initial_burst 0.001 -f lavfi -i <source>`; the script asserts that every word before (5 in the pre-check, 7 in the push list) and after them is the product's, unchanged. Nothing else differs: `-thread_queue_size 1024` and every output section are the product's, word for word |
| The source | `aevalsrc=exprs=(n+0)/8388608|(n+1048576)/8388608|(n+2097152)/8388608|(n+3145728)/8388608|(n+4194304)/8388608|(n+5242880)/8388608:s=48000:c=5.1:n=512:d=<seconds>`: six channels, 48,000 Hz, layout word `5.1`, packets of 512 samples as the device's. Sample n of channel k is (n + k x 2^20) / 2^23, exact in a 32-bit float: EVERY SAMPLE THAT ARRIVES STATES ITS CHANNEL AND ITS INDEX, so "to the sample", "aligned" and "which samples were lost" are read from the data, not inferred from a count. `-re` with no start burst: real-time pace, like a device (the default burst of 0.5 s hands 47 packets at once to a queue of 32) |
| Counting | after `mm2.py` `stage_fifo` and `mm3.py` `FifoReader`: one select loop over non-blocking pipes opened before the helper starts, every read stamped, a stall window counted from the first data. In memory only |
| Lines | standard error split as the production door's observer does (row N5: a line ends at LF or CR, an empty line is none, cut at 512 and marked; mimicked, not the door itself), then EVERY line through the product's `readHelperLine` |
| Helper starts | part A: 20 on the generated source (15 in the number files; 5 earlier ones, forms a and b with a source of 1,024-sample packets and the default burst, gave the same counts and were replaced). Part B: 0 on the device. Listing rows: 4 of the helper's device-list row (it opens no device) |
| Sandbox | part A, the fold check and every `product.ts` call inside the command sandbox; the listing of part B outside it (the two system programs and the device list) |

## 2. The lists as the product built them (verbatim from the builder's output)

```
pre-check, input 1 (26 words):
["-hide_banner","-nostdin","-nostats","-loglevel","info","-f","avfoundation","-i","none:0","-t","1","-map","0:a","-af","pan=mono|c0=c0","-ac","1","-ar","48000","-c:a","pcm_f32le","-f","f32le","-flush_packets","1","-"]

push, one section, input 1 (33 words):
["-hide_banner","-nostdin","-nostats","-loglevel","info","-thread_queue_size","1024","-f","avfoundation","-i","none:0","-map","0:a","-af","pan=mono|c0=c0","-ac","1","-ar","48000","-c:a","pcm_f32le","-f","fifo","-fifo_format","f32le","-drop_pkts_on_overflow","1","-queue_size","32","-format_opts","flush_packets=1","-y","<work>/run/<tag>/MIC-01.pcm"]

push, two sections, inputs 1 and 3 (55 words): the 33 above, then
["-map","0:a","-af","pan=mono|c0=c2","-ac","1","-ar","48000","-c:a","pcm_f32le","-f","fifo","-fifo_format","f32le","-drop_pkts_on_overflow","1","-queue_size","32","-format_opts","flush_packets=1","-y","<work>/run/<tag>/MIC-02.pcm"]
```

`<work>` = `/Users/gsp-budi/Documents/DEMS/.cache/task4-n4b`. The pipe paths pass the product's `isMicPipeArgument` (the builder would have refused them otherwise). Handed in descending (input 3 first), the builder answered the same ascending list.

## 3. Part A: the forms that settle the two sentences, and the stall

Expected = 48,000 x the source's seconds. "Index" = the source's sample number read from the sample's value.

| Form | Product list | Accepted | Exit | Wall | Samples (received / expected) | Channel seen | Index range, missing inside | Lines of the helper |
|---|---|---|---|---|---|---|---|---|
| (a) pre-check, input 1 | pre-check | yes, no refusal line | 0 | 1.039 s | **48,000 / 48,000** (192,000 bytes on standard output) | 0 only | 0 to 47,999, 0 | 14, none an error |
| (a) pre-check, input 3 | pre-check | yes | 0 | 1.040 s | **48,000 / 48,000** | 2 only | 0 to 47,999, 0 | 14 |
| (b) push, ONE section | 33 words | yes | 0 | 6.022 s | **288,000 / 288,000** | 0 only | 0 to 287,999, 0 | 14 |
| push, TWO sections | 55 words | yes | 0 | 6.036 s | **288,000 / 288,000** on each | 0 and 2 | 0 to 287,999, 0, both | 23 |
| two sections, ordered stop (SIGTERM 3.0 s after the first data) | 55 words | yes | **255** | 3.067 s | 144,384 on each (to the stop) | 0 and 2 | 0 to 144,383, 0, both | 24, the last `Exiting normally, received signal 15.` |

Format: every sample of every output decoded as a 32-bit little-endian float to an exact (channel, index) pair, 0 inexact values, 0 bytes over a whole sample; the helper states each output as `  Stream #0:0: Audio: pcm_f32le, 48000 Hz, mono, flt, 1536 kb/s`.

SAMPLE-ALIGNED with two outputs: the same count, and THE SAME SOURCE INDEX AT EVERY POSITION of both outputs (288,000 of 288,000; in the stopped run 144,384 of 144,384). Longest pause between two reads: 51 ms.

**A reader stalled for 3.0 s** (not read from 3.0 to 6.0 s after the first data; source 10 s, expected 480,000):

| Run | Always-read output | Stalled output | What was lost on the stalled output | `FIFO queue full` | `FIFO queue flushed` | Exit |
|---|---|---|---|---|---|---|
| two sections, reader of input 3 stalls | input 1: **480,000 / 480,000, 0 lost**, longest pause 27 ms | 338,688 | ONE run of 141,312 samples (276 packets), indexes 146,944 to 288,255 | 0.40 s after the stall began | 0.001 s after the reader resumed | 0 |
| two sections, reader of input 1 stalls | input 3: **480,000 / 480,000, 0 lost**, longest pause 43 ms | 338,176 | one run of 141,824, from index 147,456 | 0.40 s | 0.004 s | 0 |
| ONE section, its reader stalls | - | 338,688 | one run of 141,312, from index 146,944 | 0.40 s | 0.001 s | 0 |

Reading: the other output loses nothing, in either direction. The stalled output loses the whole stall less what the pipe held (about 0.06 s): when the queue overflows it is EMPTIED, not delivered late - after `flushed` the output continues with the samples of that moment (samples per 0.5 s on the stalled output: 24,064 ... 0, 0, 0, 0, 0, 0, 26,624, 24,064 ...). One line each per stall, not one per dropped packet.

**The queue lines against row N8's constants** (`macos-helper-lines.ts:191-192`: `/^\[fifo @ 0x[0-9a-f]{1,16}\] FIFO queue full$/`, `/^\[fifo @ 0x[0-9a-f]{1,16}\] FIFO queue flushed$/`). As printed:

```
[fifo @ 0x7b82c1c500] FIFO queue full
[fifo @ 0x7b82c1c500] FIFO queue flushed
```

NO DIFFERENCE, character for character: the tag `[fifo @ 0x`, a pointer of 10 lower-case hexadecimal digits (inside 1 to 16), `] `, the three words, nothing after them. The product's own `readHelperLine` answered `QUEUE_FULL` for 8 of 8 such lines (the three stalls, the late reader, the four runs with an absent reader) and `QUEUE_FLUSHED` for 4 of 4 (the three stalls, the late reader). The pointer is the same in both lines of one output and names no output, as the reader's head says. Also equal: `Exiting normally, received signal 15.` gives `ENDED_ON_SIGNAL` 15, and the status 255 equals `HELPER_EXIT_STATUS_AFTER_SIGNAL`.

## 4. Part A: forms (c) and (d), what the helper does

| Form | Run | Result |
|---|---|---|
| (c) reader ABSENT at the start, comes 2.0 s later (one section) | exit 0, wall 6.042 s | THE HELPER WAITS AND DROPS; it does not end. `FIFO queue full` at 0.387 s, `FIFO queue flushed` at 2.003 s. Received 193,792 of 288,000: indexes 94,208 to 287,999, none missing after that. Nothing from before the reader came is delivered |
| (c) reader NEVER comes (one section; source of 4 s) | killed by the script at 9.0 s | `FIFO queue full` at 0.378 s, no `flushed`. THE HELPER DOES NOT END when its source ends: 5 s later it still ran |
| (c) reader never comes, SIGTERM at 3.0 s | killed by the script at 13.0 s | **SIGTERM DOES NOT END IT**: alive 10 s after the signal, no `Exiting normally` line. Only SIGKILL ended it |
| two sections, the reader of input 3 never comes | killed at 11.0 s | input 1: **288,000 / 288,000, 0 lost**; `FIFO queue full` once at 0.385 s; the helper does not end when the source ends |
| the same, SIGTERM 3.0 s after the first data | killed at 13.0 s | input 1 whole to the stop (144,384, none missing) and its output closed; the process stays, no ending line; only SIGKILL |
| (d) two sections, the reader of input 3 CLOSES its pipe 2.0 s after the first data | **exit 224**, 0.03 s after the close | **THE OTHER OUTPUT DOES NOT LIVE ON.** Input 1: 97,280 samples (indexes 0 to 97,279, none missing), then the end |
| (d) the reader of input 1 closes | **exit 224**, 0.03 s after the close | the same: input 3 ends with 97,280 samples |

The helper's lines in form (d), as printed (pointers as printed; none of them is a form of row N8, all nine are `UNRECOGNISED` there):

```
[aost#1:0/pcm_f32le @ 0x77f2c38300] Error submitting a packet to the muxer: Broken pipe
[out#1/fifo @ 0x77f2c0d200] Error muxing a packet
[out#1/fifo @ 0x77f2c0d200] Task finished with error code: -32 (Broken pipe)
[out#1/fifo @ 0x77f2c0d200] Terminating thread with return code -32 (Broken pipe)
[out#0/fifo @ 0x77f2c0cb40] video:0KiB audio:380KiB subtitle:0KiB other streams:0KiB global headers:0KiB muxing overhead: unknown
[out#1/fifo @ 0x77f2c0d200] Error writing trailer: Broken pipe
[out#1/fifo @ 0x77f2c0d200] video:0KiB audio:380KiB subtitle:0KiB other streams:0KiB global headers:0KiB muxing overhead: unknown
size=N/A time=00:00:02.02 bitrate=N/A speed=   1x elapsed=0:00:02.02
Conversion failed!
```

What follows for the design (stated, not decided here):

- Design 6.1, "`close()` of one handle while the other is live ... THE HELPER KEEPS RUNNING": true only while the closed handle's pipe stays OPEN at its reader (that is the stall case, section 3). A reader that closes takes both microphones with it, at once. Design 6.1's own sentence that the worker holds both pipes for its whole life is what the path rests on; the row "the helper ends by itself: every live handle is told once" is what then happens. Status 224 is a third end status beside the 251 and 255 row N8 names.
- Keeping the other output alive through a closed reader would need a recovery option of the queue (`-attempt_recovery`, `-recover_any_error`), which SR-15 (4) forbids: a new amendment, not a row's decision. This row proposes none.
- A helper launched with a pipe nobody opens can be stopped only with SIGKILL; its end status is then the signal's, not 255. With a reader on every pipe the ordered stop is the measured one: SIGTERM, 0.01 s, status 255.
- HYPOTHESIS (the source of the build was not read): the queue's writing thread sits in the open of the pipe and the helper's end waits for it.

## 5. Part B: the listing readers on this Mac's real texts, and the stop

The product's three listing rows, as `product.ts` printed them from the table, run with an empty environment:

```
/usr/sbin/ioreg -r -c IOUSBHostDevice -l -d 2 -a                exit 0, 42,381 bytes
/usr/sbin/system_profiler SPAudioDataType -json                 exit 0, 2,127 bytes
<helper> -hide_banner -nostdin -f avfoundation -list_devices true -i ""    exit 251 (by design), 663 bytes of diagnostics in 12 lines
```

All three inside their bounds (the three together 0.6 to 0.7 s). The three texts went, unchanged and in memory only, to the product's `createMacosCardEnumerator(source).listTied()`. This is the first run of those readers on this Mac's real texts (the gap row N6 left). Its answer, two readings 2 s apart, identical, order mark equal:

| Member | Value |
|---|---|
| `ok` | **true** (no list unreadable: none of `USB_TREE_UNREADABLE`, `SYSTEM_LIST_UNREADABLE`, `CAPTURE_LIST_UNREADABLE`) |
| cards | **1**: `usb` true, `cardIndex` **2**, `deviceIndex` 0, `channelCount` **6**, `ratesHz` **[96000]**, `factsSource` `SYSTEM_PROFILE`; a port and a USB id are stated, a serial is not |
| undecided devices | **0** (no `NAME_NOT_TIEABLE`, `NAME_SHARED`, `NO_SYSTEM_INPUT`, `NO_CAPTURE_ENTRY`, `LISTS_DISAGREE`, `TRANSPORT_NOT_USB`, `NO_USB_DEVICE`) |
| `refusedDevices` | 0 |
| `passedOver` | 2 (inputs that are no USB device) |
| `captureEntries` | 3 |
| `listing` | `truncated` false, `skipped` 0 |

Reading: **the readers TIE the USB interface**, one to one, on the real texts. Its audio index is 2 now (0 in rows MM to MM3, 1 after the restart as the brief says): the index must come from the listing of the launch, as SR-15 (1) says. No device name, serial or location is in this record or in the number files (the script prints numbers and closed words only; 49 device strings of the listings were held in memory for redaction).

**THE RATE: 96,000 Hz, not 48,000.** The system list states it in both readings. By the brief ("if not, report and stop part B") and by U23 (2) / U24 (3) (b) - the user sets the rate, an agent does not - PART B STOPPED HERE. **0 helper starts on the device; nothing was opened or recorded.**

NOT MEASURED in consequence: the product's three lists on the device (accepted or not), the stream line as printed today, samples received against wall time per output, the stall case on the device, the non-zero count of the pre-check. The script is ready and bounded (at most 10 s per capture, at most 20 starts, a fresh tie before every start, abort unless exactly one six-input USB card at 48,000 Hz): after the user sets 48,000 Hz, `python3 .cache/task4-n4b/n4b.py B` outside the command sandbox.

## 6. The product's line reader on the device's recorded lines (no device, no helper)

Because part B could not print a stream line today, the device's OWN start lines as row MM3 recorded them (`.cache/task4-mm/session3.log`, capture 30: the product form on the USB interface at 48,000 Hz; 30 lines) were fed to the product's `readHelperLine` (`.cache/task4-n4b/fold_check.py`, expected index 0). The lines that decide, in their order (abridged: the recorded run had two measuring outputs more, so a third mapping line):

```
[INPUT_HEADER]                 Input #0, avfoundation, from 'none:0':
[STREAM -> STREAM_STATED]        Stream #0:0: Audio: pcm_f32le, 48000 Hz, 5.1, flt, 9216 kb/s, start 399163.910563
(UNRECOGNISED)                 Stream mapping:
[STREAM -> STREAM_WITHDRAWN]     Stream #0:0 -> #0:0 (pcm_f32le (native) -> pcm_f32le (native))
[STREAM -> STREAM_WITHDRAWN]     Stream #0:0 -> #1:0 (pcm_f32le (native) -> pcm_f32le (native))
[OUTPUT_HEADER]                Output #0, fifo, to '<pipe>':
FINAL: section CLOSED, stream { known: false, reason: 'STATED_MORE_THAN_ONCE' }
```

| Fed | Typed facts at the end | Unrecognised |
|---|---|---|
| the 30 lines as recorded | **stream `known: false`, `STATED_MORE_THAN_ONCE`**; section `CLOSED` | 18 of 30 |
| the 10 lines up to the first `Output #` | the same | 4 of 10 |
| CONTROL: those lines without the lines `  Stream #a:b -> #c:d (...)` | `known: true`, format `PCM_F32LE_FLT`, `rateHz` 48000, layout `NAMED` `5.1`, 6 channels, basis `MEASURED` | 4 of 7 |

**FAULT in row N8's fold (not this row's file; request line written):** the helper prints the block `Stream mapping:` between the input's stream line and the first `Output #` line, one line per output, each beginning with the stream prefix. The reader classifies it `STREAM` and, in the input's place, takes it for a second stream line: the statement is withdrawn on EVERY real start, with one output or two. The same block is in all 15 runs of part A on the pinned build (`  Stream #0:0 -> #0:0 (pcm_f64le (native) -> pcm_f32le (native))`). The reader's test fold (`macos-helper-lines.test.ts:256`) holds the line `Stream mapping:` but not the line under it. An adapter that reads the statement at `CLOSED` would refuse every launch. Single-line facts are right: header, stream line, queue lines, ending line.

Lines of a clean start that match no form of the reader (counted, as designed): `  Duration: ...`, `Stream mapping:`, `[Parsed_pan_0 @ 0x...] Pure channel mapping detected: <k>`, the `Metadata:` and `encoder` lines of each output, the two closing lines `[out#<i>/fifo @ 0x...] video:0KiB audio:...` and `size=N/A time=...`: 10 of 14 lines with one output, 16 of 23 with two (generated source).

## 7. Limits of what this row shows

- Part A is the pinned helper on a GENERATED source: it proves that the build accepts every word of the output sections and of the pre-check and what the queue does. It does not prove the input words `-f avfoundation -i none:<n>` (rows MM to MM3 ran them, with index 0 only) and says nothing about the device's tenth of missing samples.
- One run per form (the stall: three; the closing reader and the absent reader: two each). Load average of the host during the runs: 7.7 to 10.3; no count depended on it.
- The line splitting is a mimic of the door's observer, not the door.
- The fold fault is shown on RECORDED device lines of row MM3, not on a start of today.
- Not run: any form on the device (section 5); a queue size other than 32; a reader that closes and opens again.

## 8. End state (evidence)

```
helper starts: part A 20 (generated source), part B 0 (device)      listing rows of the helper: 4 (no device opened)
pgrep -f 'helpers/ffmpeg': 0        pgrep -f 'n4b.py|product.ts': 0
find .cache/task4-n4b -type p: 0     *.raw, *.pcm, *.wav: 0          .cache/task4-n4b/run/: removed after every run
.cache/task4-n4b/ (20 entries): n4b.py, product.ts, fold_check.py, 15 numbers_A_*.json, numbers_B_tie.json, numbers_fold_check.json
git status --short .cache: 0 lines (git-ignored)                     product files changed by this row: 0
```

Files written outside `.cache/`: this record, `delegation_progress/row_n4b.md`, one line in `file_claims.md`, three lines in `file_requests.md` (Edit tool). Nothing committed, staged, installed, sent or copied; no system setting and no dialog touched. No test suite applies to this row (no product or test file changed): the validation is the runs above.

---
*Generated: 2026-10-14 09:10*
*Last Updated: 2026-10-14 09:10*
