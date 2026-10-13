---
task_id: 2026-10-12_input_av_core_adapter_plan
row: MM2 (track D)
date: 2026-10-13
agent: test-expert (agent MM2)
type: measurement record (Tier 2)
status: needs-review (measured in full within the 40-start bound; the sample loss remains at 48,000 Hz; a stalled output stops the other one in the plain two-output form)
decisions_read: U23, U24, C96, C104; record of row MM
source_changed: none (no product file; scripts and number files under `.cache/task4-mm/` only)
devices_opened: the user's USB audio interface only (40 helper starts); the built-in microphone, cameras: never
settings_changed: none; no dialog answered
session: 2026-10-13 17:39:40 to 17:43:48 WIB (host `date`)
---

# Row MM2: second measurement on the USB interface, device rate 48,000 Hz

Words as in row MM: "the helper" = `/Users/gsp-budi/Documents/DEMS/.data/helpers/ffmpeg` (`ffmpeg version 9.0.2`); "the USB interface" = the user's one USB audio device, helper audio index 0. Channels are numbered from 0. Levels are dBFS of 32-bit float samples, RMS / peak. BEFORE = row MM (device at 96,000 Hz), AFTER = this row. No audio is kept. Device names, serials and location values are not in this record, the log or the number files (checked: 16 device strings, 0 occurrences).

## 0. Frame

| | |
|---|---|
| Script | `.cache/task4-mm/mm2.py`, which imports row MM's `mm.py` for the three lists, the selection rule, the redaction and the statistics. Log `.cache/task4-mm/session2.log`; numbers `.cache/task4-mm/numbers2_*.json` |
| Selection before EVERY capture | row MM's rule unchanged (fresh listing of the USB tree, the system list and the helper list; exactly one USB input item; its name on exactly one USB audio device and exactly one helper entry; else exit 3). Printed each time: `[AVFoundation indev @ 0x<ptr>] [0] <USB-AUDIO-1> | transport=usb | system list: inputs=6 rate=48000 | audio entries=2`. No abort occurred. In the ten no-pause opens the listing for the next open ran WHILE the previous capture ran (0 to 1.12 s old at the start), so that the helper could start at once |
| Bounds | at most 10 s per capture (`-t`), 40 helper starts: **40 used**, longest `-t 10`. Not counted as starts on the device: listings (`-list_devices`), `-h demuxer=avfoundation`, and script checks on a synthetic source (`-f lavfi`, no device) |
| Outside the command sandbox | the rate listing, every capture stage, the final process and privacy check. Inside: the script checks on the synthetic source, the help text |
| **Deviation from the order, forced by the 40-start bound** | the order's counts add up to more than 40 (18 + 30 + 2 + the two-output and layout tests). Applied: (a) point 2 "with and without `-ar 48000`" was measured as outputs of ONE helper per capture (the same samples through both forms) instead of separate runs: 9 starts + 1 repeat; (b) point 3: 12 opens with a pause (not 20) and 10 without; all 40 starts are in the refusal table with their gap; (c) point 4's second open is the first capture of point 2, 32.3 s after the first open ended |

## 1. The rate now

Command: `/usr/sbin/system_profiler SPAudioDataType -json` (redacted, the USB item):

```
"_name" : "<USB-AUDIO-1>", "coreaudio_default_audio_input_device" : "spaudio_yes", "coreaudio_device_input" : 6,
"coreaudio_device_output" : 6, "coreaudio_device_srate" : 48000, "coreaudio_device_transport" : "coreaudio_device_type_usb"
```

Command (capture 1, the first open of the session): `ffmpeg -hide_banner -nostdin -nostats -loglevel info -f avfoundation -i none:0 -t 5 -vn -c:a pcm_f32le -f f32le -flush_packets 1 -y <work>/cap2_01_first.raw`

```
Input #0, avfoundation, from 'none:0':
  Duration: N/A, start: 398060.445104, bitrate: 9216 kb/s
  Stream #0:0: Audio: pcm_f32le, 48000 Hz, 5.1, flt, 9216 kb/s, start 398060.445104
```

| Source | BEFORE | AFTER |
|---|---|---|
| System list, USB interface | 96,000 | **48,000** |
| Helper's stream line | `pcm_f32le, 96000 Hz, 5.1, flt` | **`pcm_f32le, 48000 Hz, 5.1, flt`** (identical in all 34 opens with default options) |

Reading: U23 (2) is met; the session continued. Also changed since row MM, not by this row: the system list now marks the USB interface as the default input (before: the built-in one).

## 2. The sample loss

Command, one helper per capture (N = 3, 5, 10; the fourth output only in repetitions 1 and 2):

```
ffmpeg -hide_banner -nostdin -nostats -loglevel info -f avfoundation -i none:0
  -t N -map 0:a -c:a pcm_f32le -f f32le -flush_packets 1 -y <all.raw>                                   (6 channels, no -ar)
  -t N -map 0:a -af pan=mono|c0=c0 -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <c0ar.raw> (WITH -ar 48000)
  -t N -map 0:a -af pan=mono|c0=c2 -c:a pcm_f32le -f f32le -flush_packets 1 -y <c2.raw>                   (no -ar)
  -t N -map 0:a -af ashowinfo -f null -                                                                  (per-frame timestamps)
```

| Capture | N | Expected | Received (all three outputs, identical) | Difference | Share | Wall (start to exit) | Frames per second of wall (fit) |
|---|---|---|---|---|---|---|---|
| 2 | 3 | 144,000 | 131,200 | -12,800 (25 x 512) | 91.11% | 3.284 s | 43,891 |
| 3 | 3 | 144,000 | 130,688 | -13,312 (26 x 512) | 90.76% | 3.326 s | 43,561 |
| 4 (no ashowinfo) | 3 | 144,000 | 130,688 | -13,312 | 90.76% | 3.306 s | 43,571 |
| 5 | 5 | 240,000 | 214,912 | -25,088 (49 x 512) | 89.55% | 5.332 s | 42,896 |
| 6 | 5 | 240,000 | 217,472 | -22,528 (44 x 512) | 90.61% | 5.325 s | 43,331 |
| 7 (no ashowinfo) | 5 | 240,000 | 216,448 | -23,552 (46 x 512) | 90.19% | 5.310 s | 43,465 |
| 8 | 10 | 480,000 | 432,896 | -47,104 (92 x 512) | 90.19% | 10.338 s | 43,161 |
| 9 | 10 | 480,000 | 433,408 | -46,592 (91 x 512) | 90.29% | 10.338 s | 43,205 |
| 10 | 10 | - | refused at open (section 3) | | | 0.326 s | |
| 11 (repeat of 10, no ashowinfo) | 10 | 480,000 | 432,384 | -47,616 (93 x 512) | 90.08% | 10.292 s | 43,209 |
| 1 (first open, 6 channels only) | 5 | 240,000 | 219,520 | -20,480 (40 x 512) | 91.47% | 5.297 s | 43,537 |

BEFORE: 44.5 to 45.9% of the stated samples. AFTER: **89.5 to 91.5%; 8.5 to 10.5% of the audio is still missing.** The wall time from the first to the last data is N seconds (3.00, 4.99, 10.00 s); the helper's own report says `time=00:00:03.00 ... speed=0.992x`, exit 0.

With and without `-ar 48000`: the same count to the sample, and `max|mono c0 with -ar - channel 0 of the 6-channel output| = 0` in all nine captures. At a device rate of 48,000 the option changes nothing; it neither causes nor cures the loss.

Discontinuity, determined from the helper's own frame timestamps (`ashowinfo`, six captures):

```
TIMESTAMPS (ashowinfo): 847 frames; nb_samples {512: 847}; states channels:6 chlayout:5.1 rate:48000; pts units per second 48000.0
TIMESTAMPS: (next pts - pts - nb_samples), most common: {0: 753, 512: 93} | steps with more than 8 samples missing: 93 (sum 47616 samples, largest 512)
ashowinfo line arrival interval ms: median 11.97 p99 20.13 max 22.91
ch0 mean |step|: elsewhere 0.005215 | at 92 boundaries WITH a timestamp gap: 0.033554 (ratio 6.43) | at 753 boundaries WITHOUT: 0.005339 (ratio 1.02)
ch0 CONTROL offset +256: at 752 positions: ratio 0.98
```

| Capture | Frames of 512 | Timestamp steps of exactly +512 (a packet missing) | Samples missing by timestamps | Step ratio at gap boundaries | at clean boundaries | control |
|---|---|---|---|---|---|---|
| 2 | 258 | 25 | 12,800 | 7.20 | 1.02 | 1.03 |
| 3 | 257 | 26 | 13,312 | 8.25 | 0.97 | 1.00 |
| 5 | 421 | 49 | 25,088 | 7.19 | 1.07 | 0.98 |
| 6 | 426 | 45 | 23,040 | 7.02 | 0.93 | 0.97 |
| 8 | 847 | 93 | 47,616 | 6.43 | 1.02 | 0.98 |
| 9 | 848 | 91 | 46,592 | 5.44 | 1.01 | 0.97 |

Reading:
- Determined: every frame is 512 samples; the timestamps advance by exactly 512 after about 90% of the frames and by exactly 1,024 after the rest; the count of 1,024-steps times 512 equals the missing samples (to one frame at the `-t` cut). So **whole 512-sample packets are missing, one at a time, about 9 times per second**; the waveform jumps at exactly those places (mean step 5.4 to 8.3 times the mean elsewhere) and is continuous at every other packet boundary (0.93 to 1.07). The raw file carries no gap: the missing 10.7 ms are simply cut out, so the file plays 10% short.
- New against row MM: at info level the loss IS visible in the helper's timestamps (the gaps), though not in its stream line, totals line or exit status.
- HYPOTHESIS (the helper's source was not read): the input layer holds one packet at a time and is read about every 11.7 to 12.0 ms (measured arrival interval), while the device delivers 512 samples every 10.67 ms; a packet that arrives before the previous one was fetched replaces it. That gives about 43,400 samples per second whatever the device rate, which fits BEFORE (45% of 96,000) and AFTER (90% of 48,000).
- Could not be determined: a continuity check on the played source (it is programme material, not a steady tone); whether a different buffer size of the device would change the share (a system setting, not touched).

**Contradiction 1 of row MM stays, smaller: the path loses about one tenth of the audio at the required rate.** The gate "not fit to record until the delivered rate is right" (SM-16 (5), MH-06) is not met by this build at 48,000 Hz either.

Time to the first sample: 0.24 to 0.31 s (BEFORE 0.34 to 0.48 s).

## 3. The refused open

Commands: 12 times `ffmpeg ... -f avfoundation -i none:0 -t 1 -vn -c:a pcm_f32le -f f32le -y <file>` with a pause, then 10 times with none. All 40 starts of the session, by the time between the previous helper's exit and the start:

| Gap since the previous exit | Opens | Refused |
|---|---|---|
| under 0.05 s (the ten no-pause opens; true gap at most about 15 ms) | 9 | 1 |
| 0.30 to 0.70 s | 9 | 2 |
| 0.83 to 0.95 s (the paused series) | 11 | 0 |
| 3.5 s and more, and the first open | 9 | 0 |
| total, opens with a valid argument list | 38 | **3** |

(The two other starts were refused for their option, section 6.) Every refusal, same text, exit 251, after 0.31 to 0.33 s (0.86 s with the FIFOs):

```
[in#0 @ 0x<ptr>] audio format is not supported
[in#0 @ 0x<ptr>] Error opening input: Input/output error
Error opening input file none:0.
Error opening input files: Input/output error
```

| Refused start | What preceded it | Next start |
|---|---|---|
| capture 10 (`-t 10`, four outputs) | a 10 s capture, exit 0, ended 0.613 s before | opened 6.9 s later |
| capture 13 (two FIFO outputs) | a 5 s capture, exit 0, ended 0.683 s before | opened 6.7 s later |
| capture 32 (no-pause open 2) | a 1 s capture, exit 0, ended about 0.01 s before | **opened at once** (about 0.01 s after the refusal) |

BEFORE: 1 of 10 single opens. AFTER: **3 of 38 (7.9%)**; paused series 0 of 12; no-pause series 1 of 10.

Reading: all three refusals came within 0.7 s of a previous close (3 of 18) and none after 0.83 s or more (0 of 20). That points at re-opening soon after a close, but it is NOT established: 8 of 9 immediate re-opens succeeded, the retry directly after a refusal succeeded with no wait, and with 3 events the split can be chance (probability of all three falling in the short-gap group by chance: about 0.1). Not separated: every start was preceded (or, in the no-pause series, overlapped) by this row's listing of the three lists. The previous helper's exit status was 0 in all three cases. A refusal is not persistent: one immediate retry opened in 3 of 3.

## 4. The first open

| | ch 0 | ch 1 | ch 2 | ch 3 | ch 4 | ch 5 |
|---|---|---|---|---|---|---|
| BEFORE, first open (row MM capture 1) | -6.96 / 0.00 | -6.96 / 0.00 | -6.96 / 0.00 | -6.96 / 0.00 | zero | zero |
| AFTER, first open (capture 1, 5 s) | -29.78 / -9.58 | -93.48 / -79.50 | -80.66 / -67.57 | -115.56 / -101.21 | exact zero | exact zero |
| AFTER, first 100 ms of it (RMS) | -32.48 | -93.51 | -82.12 | -115.66 | zero | zero |
| AFTER, 32.3 s later (capture 2, 3 s) | -32.11 / -13.18 | -93.48 / -80.76 | -83.52 / -68.92 | -115.49 / -101.57 | exact zero | exact zero |

Reading: **it did not recur**: not on the first open, not 32 s later, not in any of the 30 further opens whose levels were taken. Samples at or above 0.999 on channel 0 in the first open: 0. The cause of the one observation in row MM stays unknown. Not the same thing, but to be told to the user: channel 0 reached full scale on its own in later captures (peak 0.00 dBFS in capture 12, -0.18, -0.63, -0.97 in three others) while its RMS was -25 to -29: the source's loud moments clip at the present input gain.

## 5. One helper, two outputs

Forms that work in this build (each tried on the device; argument lists exact):

```
A  per-output filter (the form of the design's channel selection):
   -hide_banner -nostdin -nostats -loglevel info -thread_queue_size 1024 -f avfoundation -i none:0
   -t 9 -map 0:a -af pan=mono|c0=c0 -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <out P>
   -t 9 -map 0:a -af pan=mono|c0=c2 -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <out S>

B  one filter graph (depends on the layout word; separator is '+', the form 'FL|FC' is refused: "Error initializing filters"):
   ... -f avfoundation -i none:0 -filter_complex [0:a]channelsplit=channel_layout=5.1:channels=FL+FC[p][s]
   -map [p] -t 5 -c:a pcm_f32le -f f32le -flush_packets 1 -y <out P>  -map [s] -t 5 -c:a pcm_f32le -f f32le -flush_packets 1 -y <out S>

C  form A with each output behind the helper's own queue:
   ... -af pan=mono|c0=c<k> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1
   -queue_size 32 -format_opts flush_packets=1 -y <out>
```

Also working on a synthetic source only (not opened on the device): `-filter_complex [0:a]asplit=2[x][y];[x]pan=mono|c0=c0[p];[y]pan=mono|c0=c2[s]`.

| Question | Finding |
|---|---|
| Same number of samples in both outputs | YES, to the sample, in 10 of 10 file captures (form A in captures 2 to 9 and 11; form B in capture 12: 216,064 / 216,064 / 216,064 with the 6-channel reference) |
| Sample-aligned | YES: against the 6-channel output of the same open, `max|difference| = 0` for channel 0 and for channel 2 in all ten (form B: output P equals channel 0, output S equals channel 2, difference 0; to every other channel not 0) |
| CPU of the helper | two FIFO outputs: 0.448 s of CPU over 9.287 s = **4.8% of one core** (form C: 4.9%); three to four file outputs 3.9 to 5.5%; one 6-channel output 2.7% |
| Trap in form B | the first output's stream line reads `1 channels (FL)`, the second `mono`: two words for a one-channel output |

Both outputs carry the loss of section 2 identically (they are the same packets).

**A reader that stops reading** (two named pipes, both read from the start; the reader of output S stops for 3.0 s, 3.0 s after the first data, then resumes; `-t 9`, expected 432,000):

| | Form A (capture 14) | Form C (capture 15) |
|---|---|---|
| Output P (always read): frames | **275,328** | 388,480 |
| Output P: longest time without data | **2.772 s**, beginning 0.23 s after S stopped being read | 0.031 s |
| Output P: frames per 0.5 s | 21504, 22016, 22528, 22528, 21504, 21504, **10240, 0, 0, 0, 0, 0**, 26624, 21504, ... | 22016, 20992, 21504, ... 21504 throughout |
| Output S (stalled reader): frames | 275,328 | 259,968 |
| Output S: handed over in the first 50 ms after resuming | 16,896 (what the pipe and the helper had held) | 4,608 |
| What the helper printed | **nothing**; totals `time=00:00:09.00 ... speed=0.999x` | `[fifo @ 0x<ptr>] FIFO queue full` at 3.69 s, `FIFO queue flushed` at 6.25 s |
| Exit | 0 | 0 |

Reading:
- **In the plain form (A), a STANDBY consumer that stops reading stops the PRIMARY too**, after about a quarter of a second, for as long as the stall lasts; the device's audio of that time is not delivered later (P received 275,328 frames where an undisturbed 9 s gives about 388,000: about 113,000 frames, 2.4 s, lost on BOTH outputs), and the helper says nothing and exits 0. This is the answer the design needs: with one helper and two plain outputs the STANDBY is not only on the same device (U23) but can damage the PRIMARY.
- Form C keeps the PRIMARY whole (388,480 = the 90% of section 2, no pause longer than 31 ms) while the stalled output drops and says so in two lines. Measured once, with one queue size; NOT measured: a reader that closes its pipe, recovery behaviour, a stalled PRIMARY reader (the same mechanism is expected, by the synthetic-source check, but it was not run on the device). Form C uses the output format name `fifo`, which is outside SR-15's closed set (`avfoundation`, `f32le`, `null`).
- Synthetic-source check before the device runs (no device): the same stop in form A (2.64 s without data on P) with the line `Resumed reading at pts 4.075 with rate 1.050 after a lag of 2.427s`; that line did NOT appear with the device.

## 6. The layout word

| Input options | Result | What the helper stated |
|---|---|---|
| none (device at 48,000) | opened | `48000 Hz, 5.1, flt` (BEFORE at 96,000: `5.1` as well); `ashowinfo` states `channels:6 chlayout:5.1` |
| `-channels 2` before `-i` | REFUSED before any open, exit 8 | `Unrecognized option 'channels'.` / `Error splitting the argument list: Option not found` |
| `-ch_layout stereo` | REFUSED, exit 234, 0.27 s | `[aist#0:0/pcm_f32le @ 0x<ptr>] Specified channel layout 'stereo' has 2 channels, but input has 6 channels.` |
| `-ch_layout 6.0` | ACCEPTED, 1 s captured | `48000 Hz, 6.0, flt` on input and output |

`ffmpeg -h demuxer=avfoundation` lists no channel or layout option for the input (only `list_devices`, the two device-index options and video options).

Reading: the word for this six-channel device is `5.1` at both rates. The input cannot be told to deliver fewer channels. `-ch_layout` is the program's generic stream option: it only renames a layout of the same channel count (`6.0` shown; other six-channel words not tried), so **the word is the program's default label for the count, not a fact read from the device**. Two places state the count as an INTEGER: the `ashowinfo` line (`channels:6`) and the refusal of a wrong `-ch_layout` (`input has 6 channels`). Words for devices with other channel counts: not measurable with one device. Output words seen: `mono`, `1 channels (FL)`, `5.1`, `6.0`.

## 7. Per-channel levels now

5-second capture of all channels (capture 1), and the range over the ten further all-channel captures of 3 to 10 s:

| Channel | AFTER, capture 1 (RMS / peak) | AFTER, range of RMS | BEFORE (row MM) | Reading |
|---|---|---|---|---|
| 0 | -29.78 / -9.58 | -25.2 to -32.4 | -28 to -30 with the source, -70 between | **carries the room's source** |
| 1 | -93.48 / -79.50 | -93.46 to -93.50 | -111 (-91 once) | steady floor, 723 distinct values; no signal |
| 2 | -80.66 / -67.57 | -74.5 to -83.5 | -78 to -82 | faint; now rises with channel 0 (-74.5 when channel 0 was at -25 to -26.5; correlation with channel 0: -0.24) |
| 3 | -115.56 / -101.21 | -115.5 to -115.6 | -111 | floor, 127 distinct values |
| 4, 5 | exact zero | exact zero | exact zero | dead |

Reading: **still ONE channel with a microphone that hears the source (channel 0).** No second microphone is evident: channel 2 is 45 to 50 dB below channel 0 and follows it (crosstalk or a far input, hypothesis); channel 1's floor is 17 dB higher than BEFORE and constant. Which socket is which stays the user's check. The pattern held in all 32 opens whose levels were taken.

## 8. Against the design

| # | Row MM's contradiction / the design | AFTER (48,000 Hz) | State |
|---|---|---|---|
| 1 | delivered rate right at 48,000 | 89.5 to 91.5% delivered; whole 512-sample packets missing about 9 times a second; unreported except as timestamp gaps | **still contradicts** (smaller) |
| 2 | one helper per device, one output per input | same count, sample-aligned, 4.8% of a core | **supports** the form; but in the plain form a stalled output stops the other (new, **contradicts** an independent STANDBY); a queued output form avoids it in one measurement |
| 3 | channel count as an integer | still the word `5.1`; the word can be renamed by an option; integers exist in two other lines | **still contradicts**; a closed word table plus the count from another line |
| 4 | an open is reliable | 3 of 38 refused, same text; all within 0.7 s of a close; an immediate retry opened 3 of 3 | **still contradicts**; a bounded retry is supported by the numbers; the cause is not established |
| 6 | the listing's rate is the control | system list 48,000 = helper line 48,000; `-ar 48000` changes no sample | **supports** (U23 (2) met now) |
| 7 | first-open levels | did not recur in 32 opens with levels | not reproduced; unexplained |

## 9. Not measured

- Separate runs with and without `-ar 48000`, 20 paused opens, the stalled PRIMARY reader on the device, form C beyond one run: the 40-start bound.
- The cause of the refusal; whether this row's own listing plays a part in it.
- Any other buffer size or rate of the device (system settings); other devices; layout words for other channel counts.
- Socket mapping, unplug, reboot, the system's prompt (as in row MM).

## 10. End state (evidence)

```
helper starts on the device: 40 (capture_count2.txt)      capture files (*.raw, cap2_*) left: 0      named pipes left (find -type p): 0
.cache/task4-mm/ (34 entries): row MM's 13 files unchanged; mm2.py, session2.log, session2_dry.log, state2.json, capture_count2.txt,
  numbers2_first.json, numbers2_loss3_r1..r3.json, numbers2_loss5_r1..r3.json, numbers2_loss10_r1.json, numbers2_loss10_r2.json,
  numbers2_loss10_r3_first.json, numbers2_loss10_r3_redo.json, numbers2_split.json, numbers2_fifo_af_stallS.json,
  numbers2_fifo_fifomux_stallS.json, numbers2_opens_pause.json, numbers2_opens_nopause.json      (0 audio files)
pgrep -x ffmpeg: 0 processes        ps | grep ffmpeg: 0        git status --short .cache: 0 lines (git-ignored)
device strings checked against the session-2 log, number files and script: 16, occurrences 0
```

Nothing was committed, sent or copied. No product file, no system setting and no dialog was touched.

---
*Generated: 2026-10-13 17:50*
*Last Updated: 2026-10-13 17:50*
